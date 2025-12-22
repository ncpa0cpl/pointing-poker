import { validator } from "dilswer";
import escapeHtml from "escape-html";
import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import type {
  ParticipantRole,
  RoomChatUpdateOutgoingMessage,
  RoomMode,
  RoomOwnerUpdateOutgoingMessage,
  RoomParticipantsUpdateOutgoingMessage,
  RoomUpdateOutgoingMessage,
  RoomWSOutgoingMessage,
  RoundUpdateOutgoingMessage,
} from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import {
  DTParticipantRole,
  DTRoomMode,
  OutgoingMessageType,
} from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { usage } from "../../usage-log";
import { Persistent } from "../../utilities/persistent-objects/persistent-decorator";
import { PDependency } from "../../utilities/persistent-objects/persistent-property-dependency-decorator";
import { PWatch } from "../../utilities/persistent-objects/persistent-property-watcher-decorator";
import { Storages } from "../../utilities/persistent-objects/storage/storages";
import { RequestError } from "../../utilities/request-error";
import { RoomConnection } from "../room-connection/room-connection";
import { RoomService } from "../room-sevice";
import { RoundOption } from "../round/option/round-option";
import { RoundResult } from "../round/result/round-result";
import { Round } from "../round/round";
import { ChatMessage } from "./chat-message/chat-message";
import { RoomSerializer } from "./serializer";

const getDefaultOptions = () => [
  new RoundOption("0"),
  new RoundOption("1"),
  new RoundOption("2"),
  new RoundOption("3"),
  new RoundOption("5"),
  new RoundOption("8"),
  new RoundOption("13"),
  new RoundOption("?"),
];

const generateRoomID = (): string => {
  /**
   * generate a string of random alphanumeric characters of length 8
   */
  return Math.random().toString(36).substring(2, 10);
};

const isRoomMode = validator(DTRoomMode);
const isValidRole = validator(DTParticipantRole);

@Persistent
export class Room {
  public static serializer = RoomSerializer;

  public readonly id: string;
  public readonly createdAt: DateTime;
  public lastActivity: DateTime;

  @PWatch()
  public ownerID: string;
  @PWatch()
  public ownerPublicID?: string;
  @PWatch()
  public ownerName: string;
  @PWatch()
  public ownerRole: ParticipantRole;
  @PWatch()
  public mode: RoomMode;
  @PDependency()
  public rounds: Array<Round>;
  @PDependency()
  public defaultOptions: ReadonlyArray<RoundOption>;
  @PDependency()
  public chatMessages: Array<ChatMessage>;
  private connections: Array<RoomConnection> = [];

  public constructor(
    ownerID: string,
    ownerName: string,
    ownerRole: ParticipantRole,
    overrides: {
      id?: string;
      createdAt?: DateTime;
      lastActivity?: DateTime;
      ownerPublicID?: string;
      rounds?: Round[];
      defaultOptions?: RoundOption[];
      chatMessages?: ChatMessage[];
      mode?: RoomMode;
    } = {},
  ) {
    this.ownerID = ownerID;
    this.ownerName = ownerName;
    this.ownerRole = ownerRole;

    this.ownerPublicID = overrides.ownerPublicID;
    this.id = overrides.id ?? generateRoomID();
    this.createdAt = overrides.createdAt ?? DateTime.now();
    this.lastActivity = overrides.lastActivity ?? this.createdAt;
    this.defaultOptions = overrides.defaultOptions ?? getDefaultOptions();
    this.rounds = overrides.rounds
      ?? [new Round(undefined, this.defaultOptions.slice())];
    this.chatMessages = overrides.chatMessages ?? [];
    this.mode = overrides.mode ?? "default";
  }

  private getOption(optionID: string): RoundOption | RequestError {
    const option = this.defaultOptions.find((option) => option.id === optionID);
    if (!option) {
      return new RequestError(
        StatusCodes.NOT_FOUND,
        `Option with id ${optionID} not found.`,
      );
    }
    return option;
  }

  public addSystemMessage(text: string): void {
    this.chatMessages = this.chatMessages.concat(
      new ChatMessage(
        text,
      ),
    );

    const chatMessageUpdateMessage: RoomChatUpdateOutgoingMessage = {
      type: OutgoingMessageType.ROOM_CHAT_UPDATE,
      chatMessages: this.chatMessages.map((message) => message.toView(this)),
    };

    this.propagateMessage(chatMessageUpdateMessage);
  }

  private getLastRound(): Round {
    const round = this.rounds[this.rounds.length - 1];

    if (!round) {
      const round = new Round(undefined, this.defaultOptions.slice());
      this.addRound(round);
      return round;
    }

    return round;
  }

  private propagateMessage(message: RoomWSOutgoingMessage): void {
    this.connections.forEach((connection) => {
      connection.propagateMessage(message);
    });
  }

  private addRound(round: Round): void {
    this.rounds = [...this.rounds, round];
    this.sendRoomUpdate();
  }

  public countUsers() {
    return this.connections.length;
  }

  public setMode(mode: RoomMode): void {
    this.lastActivity = DateTime.now();
    this.mode = mode;
    this.sendRoomUpdate();
  }

  public setDefaultOptions(options: RoundOption[]): void {
    this.lastActivity = DateTime.now();

    this.defaultOptions = options.slice();

    const lastRound = this.rounds[this.rounds.length - 1];
    if (lastRound && lastRound?.isInProgress) {
      lastRound.setOptions(options.slice());
    }

    this.sendRoomUpdate();
  }

  public onConnectionStatusChange(): void {
    const updateMessage: RoomParticipantsUpdateOutgoingMessage = {
      type: OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE,
      participants: this.connections.map((connection) =>
        connection.toUserView()
      ),
    };

    this.propagateMessage(updateMessage);
  }

  public removeConnection(
    by:
      | {
        connectionID?: undefined;
        userID: string;
      }
      | {
        connectionID: string;
        userID?: undefined;
      },
  ): void {
    const idx = this.connections.findIndex((c) => {
      if (by.connectionID) {
        return c.connID === by.connectionID;
      }
      return c.userID === by.userID;
    });

    const conn = this.connections[idx]!;
    this.connections.splice(idx, 1);

    this.onConnectionStatusChange();
    this.addSystemMessage(
      `*${conn.username}* has left.`,
    );
  }

  private addVote(conn: RoomConnection, result: RoundResult) {
    if (conn.role !== "voter") {
      return;
    }

    const lastRound = this.getLastRound();

    if (lastRound.isInProgress) {
      lastRound.addVote(
        result,
      );

      const roundUpdateMessage: RoundUpdateOutgoingMessage = {
        type: OutgoingMessageType.ROUND_UPDATE,
        ...lastRound.toView(),
      };

      this.propagateMessage(roundUpdateMessage);
    }
  }

  public postUserVote(
    userID: string,
    publicUserID: string,
    optionID: string,
  ): void {
    this.lastActivity = DateTime.now();

    const conn = this.connections.find(c => c.isConnectionOwner(userID))!;

    const option = this.getOption(optionID);
    this.addVote(
      conn,
      new RoundResult(
        userID,
        publicUserID,
        conn.username,
        option.name,
        this.mode === "private",
      ),
    );
  }

  public cancelLastRound(userID: string): void {
    this.lastActivity = DateTime.now();

    const username = this.getUsername(userID);

    const lastRound = this.rounds[this.rounds.length - 1];
    if (lastRound?.isInProgress) {
      this.rounds = this.rounds.slice(0, -1);
    }

    this.addSystemMessage(
      username
        ? `Round was cancelled by ${username}.`
        : "Round was cancelled.",
    );

    this.sendRoomUpdate();
  }

  public startNewRound(userID: string): void {
    this.lastActivity = DateTime.now();

    const lastRound = this.getLastRound();

    if (lastRound.isInProgress) {
      lastRound.finish();
    }

    const newRound = new Round(undefined, this.defaultOptions.slice());
    this.addRound(newRound);

    const username = this.getUsername(userID);
    this.addSystemMessage(
      username
        ? `New round was started by ${username}.`
        : "New round was started.",
    );

    this.sendRoomUpdate();
  }

  public setOwner(
    user: RoomConnection,
  ): void {
    this.lastActivity = DateTime.now();

    this.ownerID = user.userID;
    this.ownerPublicID = user.publicUserID;

    const roomOwnerChangeMessage: RoomOwnerUpdateOutgoingMessage = {
      type: OutgoingMessageType.OWNER_UPDATE,
      ownerName: user.username,
      ownerPublicID: user.publicUserID,
      ownerRole: user.role,
    };

    this.propagateMessage(roomOwnerChangeMessage);
  }

  public finishLastRound(): void {
    this.lastActivity = DateTime.now();

    const lastRound = this.getLastRound();

    lastRound.finish();

    const roundUpdateMessage: RoundUpdateOutgoingMessage = {
      type: OutgoingMessageType.ROUND_UPDATE,
      ...lastRound.toView(),
    };

    this.propagateMessage(roundUpdateMessage);
  }

  public createConnection(
    userID: string,
    publicUserID: string,
    username: string,
    role: ParticipantRole,
  ): RoomConnection {
    this.lastActivity = DateTime.now();

    const connection = new RoomConnection(
      this,
      userID,
      publicUserID,
      username,
      role,
    );
    this.connections.push(connection);
    this.addSystemMessage(
      `*${connection.username}* has joined.`,
    );
    return connection;
  }

  private handleMsgCommand(userID: string, text: string): void {
    this.lastActivity = DateTime.now();

    const [command, ...rest] = text.substring(1).split(" ");

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (command) {
      case "transfer": {
        const [newOwnerName] = rest;
        if (newOwnerName) {
          const conn = this.findConnectionByUsername(newOwnerName);
          if (conn) {
            this.setOwner(conn);
          }
        }
        break;
      }
      case "vote": {
        const [value] = rest;
        if (value != null) {
          const conn = this.findUserConnection(userID);
          if (conn) {
            this.addVote(
              conn,
              new RoundResult(
                conn.userID,
                conn.publicUserID!,
                conn.username,
                value,
                this.mode === "private",
              ),
            );
          }
        }
        break;
      }
      case "close": {
        if (this.isOwner(userID)) {
          RoomService.removeRoom(this.id);
        }
        break;
      }
      case "setoptions": {
        if (this.isOwner(userID)) {
          const options = rest.filter(Boolean);
          this.setDefaultOptions(options.map(optLabel => {
            return new RoundOption(optLabel);
          }));
        }
        break;
      }
      case "addoption": {
        if (this.isOwner(userID)) {
          const optionLabel = rest.filter(Boolean).join(" ");
          const option = new RoundOption(optionLabel);
          this.setDefaultOptions(
            this.defaultOptions.concat(option),
          );
        }
        break;
      }
      case "setmode": {
        if (this.isOwner(userID)) {
          const mode = rest[0]!;
          if (mode && isRoomMode(mode)) {
            this.setMode(mode);
          }
        }
        break;
      }
      case "setrole": {
        const conn = this.findUserConnection(userID);
        const [role] = rest;
        if (conn && isValidRole(role)) {
          conn.setRole(role);
          this.sendRoomUpdate();
        }
        break;
      }
    }
  }

  public postMessage(userID: string, text: string): void {
    this.lastActivity = DateTime.now();

    if (text.startsWith("/")) {
      this.handleMsgCommand(userID, text);
      return;
    }

    text = escapeHtml(text);

    const connection = this.findUserConnection(userID);

    this.chatMessages = this.chatMessages.concat(
      new ChatMessage(
        text,
        connection?.publicUserID,
      ),
    );

    const chatMessageUpdateMessage: RoomChatUpdateOutgoingMessage = {
      type: OutgoingMessageType.ROOM_CHAT_UPDATE,
      chatMessages: this.chatMessages.map((message) => message.toView(this)),
    };

    this.propagateMessage(chatMessageUpdateMessage);
  }

  public closeUserConnection(userID: string): void {
    const connection = this.findUserConnection(userID);

    if (connection) {
      this.removeConnection({ connectionID: connection.connID });

      if (connection.userID === this.ownerID) {
        const newOwner = this.connections[0];
        if (newOwner) {
          this.setOwner(newOwner);
        }
      }
    }
  }

  public isOwner(userID: string): boolean {
    return this.ownerID === userID;
  }

  public isStale(): boolean {
    const hasActiveConnections = this.connections.length > 0
      && this.connections.some(c => c.isActive);

    // room has active connections, and an activity was detected within the last 12 hours
    if (
      hasActiveConnections && this.lastActivity.diffNow("hours").hours > -12
    ) {
      return false;
    }

    // if the room had seen some activity within last 5 minutes,
    // though it may not have any active connections
    if (this.lastActivity.diffNow("minutes").minutes >= -5) {
      return false;
    }

    return true;
  }

  public isActiveRound(id: string): boolean {
    const lastRound = this.getLastRound();

    return lastRound.id === id;
  }

  public findUserConnection(userID: string): RoomConnection | undefined {
    return this.connections.find(conn => conn.userID === userID);
  }

  public findConnectionByUsername(
    username: string,
  ): RoomConnection | undefined {
    return this.connections.find(conn => conn.username === username);
  }

  public getConnection(id: string): RoomConnection | RequestError {
    const connection = this.connections.find(
      (connection) => connection.connID === id,
    );

    if (!connection) {
      return new RequestError(
        StatusCodes.NOT_FOUND,
        `RoomConnection with id ${id} not found.`,
      );
    }

    return connection;
  }

  public getUsername(userID: string): string | undefined {
    const connection = this.findUserConnection(userID);
    return connection?.username;
  }

  public getUsernameByPublicID(publicUserID: string): string | undefined {
    const connection = this.connections.find(c =>
      c.publicUserID === publicUserID
    );
    return connection?.username;
  }

  public getUserConnection(id: string): RoomConnection | RequestError {
    const connection = this.connections.find(
      (connection) => connection.userID === id,
    );

    if (!connection) {
      return new RequestError(
        StatusCodes.NOT_FOUND,
        `RoomConnection with userID ${id} not found.`,
      );
    }

    return connection;
  }

  private sendRoomUpdate() {
    const roomUpdateMessage: RoomUpdateOutgoingMessage = {
      type: OutgoingMessageType.ROOM_UPDATE,
      ...this.toView(),
    };

    this.propagateMessage(roomUpdateMessage);
  }

  public toView(): Omit<RoomUpdateOutgoingMessage, "type"> {
    return {
      roomID: this.id,
      chatMessages: this.chatMessages.map((message) => message.toView(this)),
      rounds: this.rounds.map((round) => round.toView()),
      defaultOptions: this.defaultOptions.map((option) => option.toView()),
      participants: this.connections.map((connection) =>
        connection.toUserView()
      ),
      ownerName: this.ownerName,
      ownerPublicID: this.ownerPublicID ?? "",
      ownerRole: this.ownerRole,
      mode: this.mode,
    };
  }

  public dispose() {
    for (const conn of this.connections) {
      conn.close();
    }

    setTimeout(() => {
      Storages.remove(Room.name, this.id);
    }, 100);

    usage.logEnd("ROOM_CREATED");
  }
}
