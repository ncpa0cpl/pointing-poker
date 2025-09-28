import type { ServerWebSocket } from "bun";
import { isTypedArray } from "util/types";
import { createWsMsgParser } from "../../../shared/websockets-messages/parse-ws-message";
import type {
  AddRoundVoteIncomingMessage,
  CancelLastRoundIncomingMessage,
  ChangeRoomOwnerIncomingMessage,
  CloseRoomConnectionIncomingMessage,
  FinishLastRoundIncomingMessage,
  PostMessageIncomingMessage,
  RoomCreateNewRoundOutgoingMessage,
  RoomOpenConnectionIncomingMessage,
  RoomWSIncomingMessage,
  SetRoomDefaultOptionsIncomingMessage,
} from "../../../shared/websockets-messages/room-websocket-incoming-message-types";
import {
  DTRoomWSIncomingMessage,
  IncomingMessageType,
} from "../../../shared/websockets-messages/room-websocket-incoming-message-types";
import type {
  ErrorMessage,
  MessageReceivedOutgoingMessage,
  RoomConnectionInitiatedOutgoingMessage,
  RoomWSOutgoingMessage,
} from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { OutgoingMessageType } from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { logger } from "../../app-logger";
import { RoomService } from "../../rooms/room-sevice";
import { RoundOption } from "../../rooms/round/option/round-option";
import { usage } from "../../usage-log";
import { RequestError } from "../../utilities/request-error";
import { createResponse } from "../../utilities/response";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const MAX_WS_CONNECTIONS = 2500;

const parseMessage = createWsMsgParser(
  DTRoomWSIncomingMessage,
);

class RoomWsHandler {
  private static connectionCount = 0;

  public static beforeUpgrade() {
    if (RoomWsHandler.connectionCount >= MAX_WS_CONNECTIONS) {
      logger.info("too many connections, refusing WebSocket with 503");
      return createResponse(503, "Server is busy");
    }
  }

  public static open(ws: ServerWebSocket<unknown>) {
    RoomWsHandler.connectionCount++;
    return new RoomWsHandler();
  }

  private intervalTimer;
  private onclosecb: (() => void) | undefined = undefined;
  private readonly msgsReceived = new Map<string, number>();

  public constructor() {
    this.intervalTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, receivedAt] of [...this.msgsReceived.entries()]) {
        if (now - receivedAt >= 30_000) {
          this.msgsReceived.delete(key);
        }
      }
    }, 30_000);
    usage.logStart("CONNECTION_OPENED");
  }

  public close(ws: ServerWebSocket<unknown>) {
    RoomWsHandler.connectionCount--;
    this.onclosecb?.();
    clearInterval(this.intervalTimer);
    usage.logEnd("CONNECTION_OPENED");
  }

  public message(
    ws: ServerWebSocket<unknown>,
    message: string | Buffer,
  ) {
    let data: RoomWSIncomingMessage | undefined = undefined;
    try {
      data = parseMessage(message);
      if (data.messageID) {
        if (this.msgsReceived.has(data.messageID)) {
          return;
        }
        this.msgsReceived.set(data.messageID, Date.now());
      }

      switch (data.type) {
        case IncomingMessageType.ROOM_CONNECT:
          this.onclosecb = this.handleRoomConnect(ws, data);
          break;
        case IncomingMessageType.ADD_ROUND_VOTE:
          this.handleAddVote(ws, data);
          break;
        case IncomingMessageType.POST_MESSAGE:
          this.handlePostMessage(ws, data);
          break;
        case IncomingMessageType.CANCEL_LAST_ROUND:
          this.handleCancelLastRound(ws, data);
          break;
        case IncomingMessageType.CHANGE_OWNER:
          this.handleChangeRoomOwner(ws, data);
          break;
        case IncomingMessageType.FINISH_LAST_ROUND:
          this.handleFinishRound(ws, data);
          break;
        case IncomingMessageType.CREATE_NEW_ROUND:
          this.handleCreateNewRound(ws, data);
          break;
        case IncomingMessageType.SET_DEFAULT_OPTIONS:
          this.handleSetDefaultOptions(ws, data);
          break;
        case IncomingMessageType.ROOM_DISCONNECT:
          this.handleCloseRoomConnection(ws, data);
          break;
      }
    } catch (e) {
      logger.error({
        message: "Unexpected error occurred in a websocket handler.",
        error: e,
        wsmessage: isTypedArray(message)
          ? new TextDecoder().decode(message)
          : message,
      });
      ws.send(
        JSON.stringify(
          <ErrorMessage> {
            type: OutgoingMessageType.ERROR,
            code: 500,
            message: "Internal server error.",
            causedBy: data?.messageID ?? "unknown",
          },
        ),
      );
    } finally {
      if (data && data.messageID) {
        ws.send(JSON.stringify(
          <MessageReceivedOutgoingMessage> {
            type: OutgoingMessageType.MESSAGE_RECEIVED,
            messageID: data.messageID,
          },
        ));
      }
    }
  }

  private sendError(
    ws: ServerWebSocket<unknown>,
    msgData: RoomWSIncomingMessage,
    err: RequestError,
  ) {
    ws.send(JSON.stringify(
      <ErrorMessage> {
        type: OutgoingMessageType.ERROR,
        code: err.code,
        message: err.message,
        causedBy: msgData.messageID,
      },
    ));
  }

  private sendUnauthorizedError(
    ws: ServerWebSocket<unknown>,
    msgData: RoomWSIncomingMessage,
    action: string,
  ) {
    ws.send(JSON.stringify(
      <ErrorMessage> {
        type: OutgoingMessageType.ERROR,
        code: 401,
        message:
          `Unauthorized access. Only room owner can perform ${action} action.`,
        causedBy: msgData.messageID,
      },
    ));
  }

  private handleRoomConnect(
    ws: ServerWebSocket<unknown>,
    data: RoomOpenConnectionIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      ws.send(JSON.stringify(
        <RoomWSOutgoingMessage> {
          type: OutgoingMessageType.ROOM_CLOSED,
          roomID: data.roomID,
        },
      ));
      return undefined;
    }

    let connection = room.findUserConnection(data.userID);
    if (!connection) {
      connection = room.createConnection(
        data.userID,
        data.publicUserID,
        data.username,
      );
    }

    if (
      room.isOwner(data.userID)
      && connection.publicUserID !== room.ownerPublicID
    ) {
      room.setOwner(data.userID, connection.publicUserID, data.username);
    }

    const removeWs = connection.addWebSocket(ws);

    const response: RoomConnectionInitiatedOutgoingMessage = {
      type: OutgoingMessageType.ROOM_CONNECTED,
      connectionID: connection.id,
      room: room.toView(),
      userPublicID: connection.publicUserID,
    };

    ws.send(JSON.stringify(response));

    return removeWs;
  }

  private handleSetDefaultOptions(
    ws: ServerWebSocket<unknown>,
    data: SetRoomDefaultOptionsIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    if (!room.isOwner(data.userID)) {
      return this.sendUnauthorizedError(
        ws,
        data,
        IncomingMessageType.SET_DEFAULT_OPTIONS,
      );
    }

    room.setDefaultOptions(
      data.options.map((option) => new RoundOption(option)),
    );
  }

  private handleAddVote(
    ws: ServerWebSocket<unknown>,
    data: AddRoundVoteIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    const userConnection = room.getUserConnection(data.userID);

    if (RequestError.is(userConnection)) {
      return this.sendError(ws, data, userConnection);
    }

    if (room.isActiveRound(data.roundID)) {
      room.postUserVote(
        data.userID,
        userConnection.publicUserID,
        data.optionRef,
      );
    }
  }

  private handlePostMessage(
    ws: ServerWebSocket<unknown>,
    data: PostMessageIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    room.postMessage(data.userID, data.text);
  }

  private handleCancelLastRound(
    ws: ServerWebSocket<unknown>,
    data: CancelLastRoundIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    if (!room.isOwner(data.userID)) {
      return this.sendUnauthorizedError(
        ws,
        data,
        IncomingMessageType.CANCEL_LAST_ROUND,
      );
    }

    room.cancelLastRound(data.userID);
  }

  private handleCreateNewRound(
    ws: ServerWebSocket<unknown>,
    data: RoomCreateNewRoundOutgoingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    if (!room.isOwner(data.userID)) {
      return this.sendUnauthorizedError(
        ws,
        data,
        IncomingMessageType.CREATE_NEW_ROUND,
      );
    }

    room.startNewRound(data.userID);
  }

  private handleChangeRoomOwner(
    ws: ServerWebSocket<unknown>,
    data: ChangeRoomOwnerIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    if (!room.isOwner(data.userID)) {
      return this.sendUnauthorizedError(
        ws,
        data,
        IncomingMessageType.CHANGE_OWNER,
      );
    }

    const user = room.getUserConnection(data.newOwnerID);

    if (RequestError.is(user)) {
      return this.sendError(ws, data, user);
    }

    room.setOwner(data.newOwnerID, user.publicUserID, user.username);
  }

  private handleFinishRound(
    ws: ServerWebSocket<unknown>,
    data: FinishLastRoundIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    if (!room.isOwner(data.userID)) {
      return this.sendUnauthorizedError(
        ws,
        data,
        IncomingMessageType.FINISH_LAST_ROUND,
      );
    }

    room.finishLastRound();
  }

  private handleCloseRoomConnection(
    ws: ServerWebSocket<unknown>,
    data: CloseRoomConnectionIncomingMessage,
  ) {
    const room = RoomService.getRoom(data.roomID);

    if (RequestError.is(room)) {
      return this.sendError(ws, data, room);
    }

    room.closeUserConnection(data.userID);
    this.onclosecb?.();
  }
}

export function addRoomWsRoute(server: HttpServer) {
  server.ws(
    "/ws/room",
    (ws) => RoomWsHandler.open(ws),
    (req) => RoomWsHandler.beforeUpgrade(),
  );
}
