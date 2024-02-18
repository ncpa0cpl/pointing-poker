import type { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx";
import { deriveMany, sig } from "@ncpa0cpl/vanilla-jsx";
import axios from "axios";
import { DateTime } from "luxon";
import { marked } from "marked";
import { v4 } from "uuid";
import { IncomingMessageType } from "../../../shared";
import type {
  ChatMessageView,
  DefaultOption,
} from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { OutgoingMessageType } from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { UserService } from "../user-service/user-service";
import { WsConnection } from "./socket-connection";
import type { PokerRoomRound } from "./types";

type Participant = {
  publicID: string;
  username: string;
  isActive: boolean;
};

type ClientChatMessage = {
  clientOnly?: boolean;
  publicUserID?: string | undefined;
  username?: string | undefined;
  text: string;
  sentAt: DateTime;
};

export class PokerRoomService {
  static #roomID = sig<string | null>(null);
  static #connected = sig(false);
  static #roomOwner = sig<Participant>({
    publicID: "",
    username: "",
    isActive: false,
  });
  static #publicUserID = sig<string | null>(null);
  static #participants = sig<Participant[]>([]);
  static #rounds = sig<PokerRoomRound[]>([]);
  static #options = sig<DefaultOption[]>([]);
  static #chatMessages = sig<Signal<ClientChatMessage>[]>([]);
  static #connection = new WsConnection();

  public static selectedRound = sig("");
  static #currentRound = deriveMany(
    this.#rounds,
    this.selectedRound,
    (rounds, selected) => {
      if (selected.length > 0) {
        return rounds.find((r) => r.id === selected);
      } else {
        return rounds.at(-1);
      }
    },
  );

  static #lastRound = this.#rounds.derive((rounds) => {
    return rounds.at(-1);
  });

  public static get roomID(): ReadonlySignal<string | null> {
    return PokerRoomService.#roomID;
  }

  public static get connected(): ReadonlySignal<boolean> {
    return PokerRoomService.#connected;
  }

  public static get roomOwner(): ReadonlySignal<Participant> {
    return PokerRoomService.#roomOwner;
  }

  public static get publicUserID(): ReadonlySignal<string | null> {
    return PokerRoomService.#publicUserID;
  }

  public static get participants(): ReadonlySignal<Participant[]> {
    return PokerRoomService.#participants;
  }

  public static get rounds(): ReadonlySignal<PokerRoomRound[]> {
    return PokerRoomService.#rounds;
  }

  public static get options(): ReadonlySignal<DefaultOption[]> {
    return PokerRoomService.#options;
  }

  public static get chatMessages(): ReadonlySignal<
    ReadonlySignal<ClientChatMessage>[]
  > {
    // @ts-expect-error
    return PokerRoomService.#chatMessages;
  }

  public static get currentRound(): ReadonlySignal<PokerRoomRound | undefined> {
    return PokerRoomService.#currentRound;
  }

  public static get lastRound(): ReadonlySignal<PokerRoomRound | undefined> {
    return PokerRoomService.#lastRound;
  }

  private static mapChatMsg(msg: ChatMessageView): ClientChatMessage {
    return {
      publicUserID: msg.publicUserID,
      username: msg.username,
      text: marked.parse(msg.text, { async: false }) as string,
      sentAt: DateTime.fromISO(msg.sentAt).toLocal(),
    };
  }

  private static reconcileChatMessages(
    newMessageList: ChatMessageView[],
  ) {
    const msgs = newMessageList.map((msg): ClientChatMessage => {
      return this.mapChatMsg(msg);
    }).sort((a, b) => {
      return a.sentAt > b.sentAt ? 1 : -1;
    });

    const isMsgSame = (a: ClientChatMessage, b: ClientChatMessage) => {
      return (
        a.publicUserID === b.publicUserID
        && a.username === b.username
        && a.text === b.text
        && a.sentAt.toMillis() === b.sentAt.toMillis()
      );
    };

    this.#chatMessages.dispatch(currentList => {
      const newList: Signal<ClientChatMessage>[] = [];

      for (let i = 0; i < msgs.length; i++) {
        const newMsg = msgs[i]!;
        const oldMsg = currentList[i];

        if (oldMsg?.current().clientOnly) {
          newList.push(oldMsg);
          newList.push(sig(newMsg));
          continue;
        } else if (oldMsg) {
          newList.push(oldMsg);
          if (!isMsgSame(newMsg, oldMsg.current())) {
            oldMsg.dispatch(newMsg);
          }
        } else {
          newList.push(sig(newMsg));
        }
      }

      return newList;
    });
  }

  /**
   * Displays a message to this client only in a form of a chat message.
   */
  public static showSystemChatMsg(text: string) {
    this.#chatMessages.dispatch(current => {
      return current.concat(sig<ClientChatMessage>({
        clientOnly: true,
        sentAt: DateTime.local(),
        text,
      }));
    });
  }

  public static connectListeners() {
    this.#connection.on(OutgoingMessageType.OWNER_UPDATE, (data) => {
      this.#roomOwner.dispatch({
        publicID: data.ownerPublicID,
        username: data.ownerName,
        isActive: true,
      });
    });

    this.#connection.on(OutgoingMessageType.ROOM_UPDATE, (data) => {
      this.#participants.dispatch(data.participants);
      this.#rounds.dispatch(data.rounds);
    });

    this.#connection.on(
      OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE,
      (data) => {
        this.#participants.dispatch(data.participants);
      },
    );

    this.#connection.on(OutgoingMessageType.ROUND_UPDATE, (data) => {
      this.#rounds.dispatch((currentRounds) => {
        const round = currentRounds.find((r) => r.id === data.id);

        if (round) {
          return currentRounds.map((r) => {
            if (r.id === data.id) {
              return data;
            }
            return r;
          });
        } else {
          return [...currentRounds, data];
        }
      });
    });

    this.#connection.on(OutgoingMessageType.ROOM_CHAT_UPDATE, data => {
      this.reconcileChatMessages(data.chatMessages);
    });

    this.#connection.on(OutgoingMessageType.PING, () => {
      this.#connection.sendSimple({
        type: IncomingMessageType.PONG,
      });
    });
  }

  public static connectToRoom(roomID: string) {
    this.#roomID.dispatch(roomID);
    this.#connected.dispatch(false);
    const user = UserService.user.current();

    return this.#connection.openConnection({
      roomID,
      userID: user.id,
      publicUserID: user.publicID,
      username: user.name,
    }).then((data) => {
      this.#connected.dispatch(true);
      this.#participants.dispatch(data.room.participants);
      this.#rounds.dispatch(data.room.rounds);
      this.#publicUserID.dispatch(data.userPublicID);
      this.#options.dispatch(data.room.defaultOptions);
      this.#roomOwner.dispatch({
        publicID: data.room.ownerPublicID,
        username: data.room.ownerName,
        isActive: true,
      });
      this.#chatMessages.dispatch(
        data.room.chatMessages.map(msg => sig(this.mapChatMsg(msg))),
      );
    }).catch((err) => {
      this.#roomID.dispatch(null);
      throw err;
    });
  }

  public static disconnectFromRoom() {
    this.#connected.dispatch(false);
    this.#roomID.dispatch(null);
    this.#roomOwner.dispatch({
      publicID: "",
      username: "",
      isActive: false,
    });
    this.#connection.closeRoomConnection();
    this.#participants.dispatch([]);
    this.#rounds.dispatch([]);
    this.#publicUserID.dispatch(null);
    this.#options.dispatch([]);
    this.#chatMessages.dispatch([]);
  }

  public static async createRoom() {
    const user = UserService.user.current();

    const {
      data: { roomID },
    } = await axios.post<{ roomID: string }>("/api/room", {
      userID: user.id,
      username: user.name,
    });

    return roomID;
  }

  public static sendVote(optionID: string) {
    const roomID = this.roomID.current();
    const currentRound = this.#currentRound.current();

    if (roomID && currentRound) {
      return this.#connection.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        messageID: v4(),
        optionRef: optionID,
        roomID: roomID,
        roundID: currentRound.id,
        userID: UserService.user.current().id,
      });
    }

    return Promise.reject(new Error("No room or round present."));
  }

  public static postChatMessage(text: string) {
    if (text.startsWith("/help")) {
      this.showSystemChatMsg(`Available commands:
                        <br />/transfer <username>
                        <br />/vote <value>`);
    }

    const roomID = this.roomID.current();

    if (roomID) {
      return this.#connection.send({
        type: IncomingMessageType.POST_MESSAGE,
        messageID: v4(),
        text,
        roomID: roomID,
        userID: UserService.user.current().id,
      });
    }

    return Promise.reject(new Error("No room present."));
  }

  public static showResults() {
    const roomID = this.roomID.current();
    const currentRound = this.#currentRound.current();

    if (roomID && currentRound) {
      return this.#connection.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        messageID: v4(),
        roomID: roomID,
        userID: UserService.user.current().id,
      });
    }

    return Promise.reject(new Error("No room or round present."));
  }

  public static startNextRound() {
    const roomID = this.roomID.current();

    if (roomID) {
      return this.#connection.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        messageID: v4(),
        roomID: roomID,
        userID: UserService.user.current().id,
      });
    }

    return Promise.reject(new Error("No room present."));
  }
}

PokerRoomService.connectListeners();
