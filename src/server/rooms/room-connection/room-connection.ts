import type { ServerWebSocket } from "bun";
import { DateTime } from "luxon";
import * as uuid from "uuid";
import {
  OutgoingMessageType,
  type RoomParticipantsUpdateOutgoingMessage,
  type RoomWSOutgoingMessage,
} from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { WsReadyState } from "../../utilities/ws-utils";
import type { Room } from "../room/room";

export class RoomConnection {
  public readonly id: string;
  public readonly createdAt: DateTime;
  public readonly room: Room;
  public readonly userID: string;
  public readonly username: string;
  public readonly publicUserID: string;

  public webSockets: ServerWebSocket<unknown>[] = [];

  public constructor(
    room: Room,
    userID: string,
    publicUserID: string,
    username: string,
    overrides: { id?: string; createdAt?: DateTime } = {},
  ) {
    this.room = room;
    this.userID = userID;
    this.username = username;
    this.publicUserID = publicUserID;
    this.id = overrides.id ?? uuid.v4();
    this.createdAt = overrides.createdAt ?? DateTime.now();
  }

  public get isActive(): boolean {
    return this.webSockets.some((s) => s.readyState === WsReadyState.Open);
  }

  public isConnectionOwner(id: string): boolean {
    return this.userID === id;
  }

  public addWebSocket(webSocket: ServerWebSocket<unknown>): () => void {
    this.webSockets = [...this.webSockets, webSocket];
    this.room.onConnectionStatusChange();

    return () => {
      this.webSockets = this.webSockets.filter((ws) => ws !== webSocket);
      this.room.onConnectionStatusChange();
    };
  }

  public propagateMessage(message: RoomWSOutgoingMessage): void {
    this.webSockets.forEach((webSocket) => {
      if (webSocket.readyState === WsReadyState.Open) {
        webSocket.send(JSON.stringify(message));
      }
    });
  }

  close() {
    this.propagateMessage({
      type: OutgoingMessageType.ROOM_CLOSED,
      roomID: this.room.id,
    });
    this.webSockets.splice(0, this.webSockets.length);
    this.room.removeConnection({
      connectionID: this.id,
    });
  }

  public toUserView(): Omit<
    RoomParticipantsUpdateOutgoingMessage,
    "type"
  >["participants"][number] {
    return {
      publicID: this.publicUserID,
      username: this.username,
      isActive: this.isActive,
    };
  }
}
