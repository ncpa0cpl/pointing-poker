import { v4 } from "uuid";
import type {
  MessageReceivedOutgoingMessage,
  RoomConnectionInitiatedOutgoingMessage,
  RoomWSIncomingMessage,
  RoomWSOutgoingMessage,
} from "../../../shared/index";
import {
  DTRoomWSOutgoingMessage,
  IncomingMessageType,
  OutgoingMessageType,
} from "../../../shared/index";
import { createWsMsgParser } from "../../../shared/websockets-messages/parse-ws-message";
import type { FindInUnion } from "../../type-utils/find-in-union";

type ConnectionParams = {
  roomID: string;
  userID: string;
  publicUserID: string;
  username: string;
  connectionID?: string;
};

const parseMsg = createWsMsgParser(DTRoomWSOutgoingMessage);

const RECONNECT_BACKOFFS = {
  [-1]: -1,
  0: 100,
  100: 500,
  500: 1000,
  1000: 2000,
  2000: 5000,
  5000: 5000,
} as const;

class WsMessage {
  private readonly strdata: string;
  private sentSuccessfully = false;

  public constructor(
    private readonly data: RoomWSIncomingMessage,
    private readonly eventEmitter: EventTarget,
    private readonly getCurrentSocket: () => WebSocket,
  ) {
    this.handleMsgReceivedEvent = this.handleMsgReceivedEvent.bind(this);

    this.strdata = JSON.stringify(data);
    this.eventEmitter.addEventListener(
      OutgoingMessageType.MESSAGE_RECEIVED,
      this.handleMsgReceivedEvent as any,
    );
  }

  private handleMsgReceivedEvent(event: CustomEvent<MessageEvent<any>>) {
    const data = parseMsg(event.detail.data) as MessageReceivedOutgoingMessage;
    if (data.messageID === this.data.messageID) {
      this.sentSuccessfully = true;
      this.eventEmitter.removeEventListener(
        OutgoingMessageType.MESSAGE_RECEIVED,
        this.handleMsgReceivedEvent as any,
      );
    }
  }

  public send(attemptCount = 0): Promise<void> {
    if (this.sentSuccessfully) return Promise.resolve();
    if (attemptCount > 10) {
      this.eventEmitter.removeEventListener(
        OutgoingMessageType.MESSAGE_RECEIVED,
        this.handleMsgReceivedEvent as any,
      );
      return Promise.reject(new Error("Could not send message."));
    }

    const socket = this.getCurrentSocket();
    const isOpen = socket.readyState === WebSocket.OPEN;
    if (isOpen) {
      socket.send(this.strdata);
    }
    attemptCount++;

    return new Promise((res, rej) => {
      setTimeout(() => {
        if (this.sentSuccessfully) return res();
        this.send(attemptCount).then(res).catch(rej);
      }, attemptCount === 0 ? 50 : 500);
    });
  }
}

export class WsConnection {
  #socket!: WebSocket;
  #isOpened = false;
  #isInitiated = false;
  #attemptingConnection = false;
  #connectionParams: null | ConnectionParams = null;
  #eventEmitter = new EventTarget();
  private onopen = () => {};

  public constructor() {
    this.createWs().catch(() => {});
  }

  private createWs() {
    return new Promise<void>((resolve, reject) => {
      const isSecure = location.protocol.startsWith("https");
      const protocol = isSecure ? "wss" : "ws";
      this.#socket = new WebSocket(`${protocol}://${location.host}/ws/room`);

      this.#socket.onopen = () => {
        this.#socket.onerror = null;
        this.#isOpened = true;
        this.#attemptingConnection = false;
        this.#socket.onclose = () => {
          this.#isOpened = false;

          if (this.#connectionParams) {
            this.tryReconnect();
          }
        };
        resolve();
        this.onopen();
      };

      this.#socket.onerror = () => {
        reject(
          new Error(
            "Connection could not be established.",
          ),
        );
      };

      this.#socket.onmessage = (event) => {
        const data = parseMsg(event.data);
        this.#eventEmitter.dispatchEvent(
          new CustomEvent(data.type, { detail: event }),
        );
      };
    });
  }

  private tryReconnect() {
    // retry up to 5 times with a exponential backoff
    let nextBackoff: keyof typeof RECONNECT_BACKOFFS = RECONNECT_BACKOFFS[0];
    const retry = () => {
      if (nextBackoff !== -1) {
        setTimeout(async () => {
          if (this.#isOpened) return;
          nextBackoff = RECONNECT_BACKOFFS[nextBackoff];
          try {
            await this.createWs();
            await this.openConnection(this.#connectionParams!);
          } catch {
            retry();
          }
        }, nextBackoff);
      }
    };

    retry();
  }

  public send(message: RoomWSIncomingMessage) {
    const msg = new WsMessage(
      message,
      this.#eventEmitter,
      () => this.#socket,
    );
    return msg.send();
  }

  public sendSimple(message: RoomWSIncomingMessage) {
    if (!this.#isOpened) return;
    this.#socket.send(JSON.stringify(message));
  }

  public on<M extends OutgoingMessageType>(
    messageType: M,
    handler: (data: FindInUnion<RoomWSOutgoingMessage, { type: M }>) => void,
    once = false,
  ) {
    const listener = ((event: CustomEvent<MessageEvent<any>>) => {
      const data = parseMsg(event.detail.data);
      handler(data as any);
    }) as any;
    this.#eventEmitter.addEventListener(messageType, listener, { once });
    return {
      remove: () => {
        this.#eventEmitter?.removeEventListener(messageType, listener);
      },
    };
  }

  public once<M extends OutgoingMessageType>(
    messageType: M,
    handler: (data: FindInUnion<RoomWSOutgoingMessage, { type: M }>) => void,
  ) {
    return this.on(messageType, handler, true);
  }

  public openConnection(connectionParams: ConnectionParams) {
    if (this.#attemptingConnection) {
      throw new Error("Connection already initiated");
    }

    const init = () =>
      new Promise<RoomConnectionInitiatedOutgoingMessage>(
        (resolve, reject) => {
          this.#attemptingConnection = true;

          this.#connectionParams = { ...connectionParams };

          this.once(OutgoingMessageType.INITIATED, (data) => {
            this.#isInitiated = true;
            this.#attemptingConnection = false;
            resolve(data);
          });

          this.once(OutgoingMessageType.ERROR, (data): void => {
            this.#attemptingConnection = false;
            reject(new Error(data.message));
          });

          this.#socket.onerror = () => {
            this.#attemptingConnection = false;
            reject(
              new Error(
                "Connection could not be established.",
              ),
            );
          };

          this.send({
            type: IncomingMessageType.INITIATE,
            messageID: v4(),
            ...connectionParams,
          }).catch(() => {});
        },
      );

    if (this.#isOpened) {
      return init();
    } else {
      return new Promise<Awaited<ReturnType<typeof init>>>(
        (resolve, reject) => {
          this.onopen = async () => {
            try {
              const data = await init();
              resolve(data);
            } catch (err) {
              reject(err);
            }
          };
        },
      );
    }
  }

  public closeRoomConnection() {
    if (this.#connectionParams) {
      this.send({
        type: IncomingMessageType.CLOSE,
        messageID: v4(),
        roomID: this.#connectionParams.roomID,
        userID: this.#connectionParams.userID,
      }).catch(() => {});
      this.#connectionParams = null;
    }
  }

  public isOpen() {
    return this.#isInitiated;
  }
}
