import type { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
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
  content: string | Element;
  sentAt: DateTime;
};

// @ts-expect-error
window.stubVotes = () => {
  PokerRoomService.stubVotes();
};

export class PokerRoomService {
  public static stubVotes() {
    PokerRoomService.#rounds.dispatch([
      {
        id: "01",
        hasResults: true,
        isInProgress: false,
        options: PokerRoomService.options.get(),
        results: [
          {
            publicUserID: "u1",
            username: "User 1",
            vote: "5",
          },
          {
            publicUserID: "u2",
            username: "User 2",
            vote: "3",
          },
          {
            publicUserID: "u3",
            username: "User 3",
            vote: "5",
          },
          {
            publicUserID: "u4",
            username: "User 4",
            vote: "5",
          },
          {
            publicUserID: "u5",
            username: "User 5",
            vote: "3",
          },
          {
            publicUserID: "u6",
            username: "User 6",
            vote: "2",
          },
          {
            publicUserID: "u7",
            username: "User 7",
            vote: "5",
          },
          {
            publicUserID: "u8",
            username: "User 8",
            vote: "8",
          },
          {
            publicUserID: "u9",
            username: "User 9",
            vote: "3",
          },
          {
            publicUserID: "u10",
            username: "User 10",
            vote: "5",
          },
        ],
        finalResult: {
          mean: "5",
          median: "5",
          mode: "5",
          votes: 8,
        },
      },
    ]);
  }

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
  static #currentRound = sig.derive(
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

  public static onRoomClosed?: Function;

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

  public static get socketOpened(): ReadonlySignal<boolean> {
    return PokerRoomService.#connection.isOpen;
  }

  public static get chatMessages(): ReadonlySignal<
    ReadonlySignal<ClientChatMessage>[]
  > {
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
      content: marked.parse(msg.text, { async: false }) as string,
      sentAt: DateTime.fromISO(msg.sentAt).toLocal(),
    };
  }

  private static reconcileChatMessages(newMessageList: ChatMessageView[]) {
    const msgs = newMessageList
      .map((msg): ClientChatMessage => {
        return this.mapChatMsg(msg);
      })
      .sort((a, b) => {
        return a.sentAt > b.sentAt ? 1 : -1;
      });

    const isMsgSame = (a: ClientChatMessage, b: ClientChatMessage) => {
      return (
        a.publicUserID === b.publicUserID
        && a.username === b.username
        && a.content === b.content
        && a.sentAt.toMillis() === b.sentAt.toMillis()
      );
    };

    this.#chatMessages.dispatch((currentList) => {
      const newList: Signal<ClientChatMessage>[] = [];

      for (let i = 0; i < msgs.length; i++) {
        const newMsg = msgs[i]!;
        const oldMsg = currentList[i];

        if (oldMsg?.get().clientOnly) {
          newList.push(oldMsg);
          newList.push(sig(newMsg));
          continue;
        } else if (oldMsg) {
          newList.push(oldMsg);
          if (!isMsgSame(newMsg, oldMsg.get())) {
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
  public static showSystemChatMsg(content: string | Element) {
    this.#chatMessages.dispatch((current) => {
      return current.concat(
        sig<ClientChatMessage>({
          clientOnly: true,
          sentAt: DateTime.local(),
          content: content,
        }),
      );
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
      this.#options.dispatch(data.defaultOptions);
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
      this.#options.dispatch(data.options);
    });

    this.#connection.on(OutgoingMessageType.ROOM_CHAT_UPDATE, (data) => {
      this.reconcileChatMessages(data.chatMessages);
    });

    this.#connection.on(OutgoingMessageType.PING, () => {
      this.#connection.sendSimple({
        type: IncomingMessageType.PONG,
      });
    });

    this.#connection.on(OutgoingMessageType.ROOM_CLOSED, () => {
      this.onRoomClosed?.();
      this.disconnectFromRoom();
    });
  }

  public static connectToRoom(roomID: string) {
    const user = UserService.user.get();

    this.#roomID.dispatch(roomID);
    this.#connected.dispatch(false);

    return this.#connection
      .openConnection({
        roomID,
        userID: user.id,
        publicUserID: user.publicID,
        username: user.name,
      })
      .then((data) => {
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
          data.room.chatMessages.map((msg) => sig(this.mapChatMsg(msg))),
        );
        this.selectedRound.dispatch("");
      })
      .catch((err) => {
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
    this.selectedRound.dispatch("");
  }

  public static async createRoom() {
    const user = UserService.user.get();

    const { roomID } = await fetch("/api/room", {
      method: "POST",
      body: JSON.stringify({
        userID: user.id,
        username: user.name,
      }),
    })
      .then(resp => resp.json() as Promise<{ roomID: string }>);

    return roomID;
  }

  public static sendVote(optionID: string) {
    const roomID = this.roomID.get();
    const currentRound = this.#currentRound.get();

    if (roomID && currentRound) {
      return this.#connection.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        messageID: v4(),
        optionRef: optionID,
        roomID: roomID,
        roundID: currentRound.id,
        userID: UserService.user.get().id,
      });
    }

    return Promise.reject(new Error("No room or round present."));
  }

  private static handleChatCommands(text: string): boolean {
    switch (text) {
      case "/help":
        this.showSystemChatMsg(
          <pre class="nomargin">
            Available commands:
            {"\n  "}/transfer [username]
            {"\n  "}/vote [value]
            {"\n  "}/exit
            {"\n  "}/close
            {"\n  "}/setoptions
            {"\n  "}/addoption
            {"\n  "}
            {"\n  "}Use /help [command] for
            {"\n  "}more information.
          </pre>,
        );
        return true;
      case "/exit":
        this.disconnectFromRoom();
        return true;
    }

    if (text.startsWith("/help ")) {
      const command = text.split(" ")[1];
      switch (command) {
        case "transfer":
        case "/transfer":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /transfer [username]
              {"\n  "}Transfer the room ownership to
              {"\n  "}another user.
            </pre>,
          );
          break;
        case "vote":
        case "/vote":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /vote [value]
              {"\n  "}Send a vote for the current
              {"\n  "}round with the specified value,
              {"\n  "}similar to clicking the vote
              {"\n  "}button, but allows arbitrary
              {"\n  "}values.
            </pre>,
          );
          break;
        case "exit":
        case "/exit":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /exit
              {"\n  "}Leave the current room. Same
              {"\n  "}as the exit button.
            </pre>,
          );
          break;
        case "close":
        case "/close":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /close
              {"\n  "}Close the current room, and
              {"\n  "}disconnect all players from
              {"\n  "}it. Only available to the owner.
            </pre>,
          );
          break;
        case "setoptions":
        case "/setoptions":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /setoptions [...newoptions]
              {"\n  "}Changes the availalbe vote
              {"\n  "}options for the current and
              {"\n  "}future rounds. The option list
              {"\n  "}should be a whitespace separated
              {"\n  "}list of values.
              {"\n  "}(e.g. `/setoptions 1 2 3 4`)
            </pre>,
          );
          break;
        case "addoption":
        case "/addoption":
          this.showSystemChatMsg(
            <pre class="nomargin">
              /addoption [newoption]
              {"\n  "}Add a new option to the list of
              {"\n  "}available vote options for the
              {"\n  "}current and future rounds.
              {"\n  "}(e.g. `/addoption ?`)
            </pre>,
          );
          break;
        default:
          this.showSystemChatMsg(
            <pre class="nomargin">
              Unknown command: {command}
            </pre>,
          );
          break;
      }
      return true;
    }

    return false;
  }

  public static postChatMessage(text: string) {
    if (this.handleChatCommands(text)) {
      return;
    }

    const roomID = this.roomID.get();

    if (roomID) {
      return this.#connection.send({
        type: IncomingMessageType.POST_MESSAGE,
        messageID: v4(),
        text,
        roomID: roomID,
        userID: UserService.user.get().id,
      });
    }

    return Promise.reject(new Error("No room present."));
  }

  public static showResults() {
    const roomID = this.roomID.get();
    const currentRound = this.#currentRound.get();

    if (roomID && currentRound) {
      return this.#connection.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        messageID: v4(),
        roomID: roomID,
        userID: UserService.user.get().id,
      });
    }

    return Promise.reject(new Error("No room or round present."));
  }

  public static startNextRound() {
    const roomID = this.roomID.get();

    if (roomID) {
      return this.#connection.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        messageID: v4(),
        roomID: roomID,
        userID: UserService.user.get().id,
      });
    }

    return Promise.reject(new Error("No room present."));
  }
}

PokerRoomService.connectListeners();
