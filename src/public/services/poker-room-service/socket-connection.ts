import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
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
import { SentryService } from "../sentry-service/sentry-service";

type ConnectionParams = {
  roomID: string;
  userID: string;
  publicUserID: string;
  username: string;
  connectionID?: string;
};

const noop = () => {};
const parseMsg = createWsMsgParser(DTRoomWSOutgoingMessage);

const RECONNECT_BACKOFFS = {
  [-1]: -1,
  0: 200,
  200: 1000,
  1000: 5000,
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

  public send(
    prevTimeout: keyof typeof RECONNECT_BACKOFFS = 200,
  ): Promise<void> {
    if (this.sentSuccessfully) return Promise.resolve();

    const socket = this.getCurrentSocket();
    const isOpen = socket.readyState === WebSocket.OPEN;
    if (isOpen) {
      socket.send(this.strdata);
    }

    const nextTimeout = RECONNECT_BACKOFFS[prevTimeout];

    return new Promise((res, rej) => {
      setTimeout(() => {
        if (this.sentSuccessfully) return res();
        this.send(nextTimeout).then(res).catch(rej);
      }, nextTimeout);
    });
  }
}

export class WsConnection {
  #socket!: WebSocket;
  #isOpened = false;
  #attemptingConnection = false;
  #connectionParams: null | ConnectionParams = null;
  #eventEmitter = new EventTarget();
  private onopen = noop;

  private isOpenSig = sig(false);
  public isOpen = this.isOpenSig.readonly();

  public constructor() {
    this.on(OutgoingMessageType.ERROR, (errMsg) => {
      SentryService.error(new Error(`Server error: ${errMsg.message}`), errMsg);
    });
    this.createWs().catch(() => {});
  }

  private setOpened(opened: boolean) {
    this.isOpenSig.dispatch(opened);
    this.#isOpened = opened;
  }

  private createWs() {
    return new Promise<void>((resolve, reject) => {
      try {
        const isSecure = location.protocol.startsWith("https");
        const protocol = isSecure ? "wss" : "ws";
        this.#socket = new WebSocket(`${protocol}://${location.host}/ws/room`);

        this.#socket.onopen = () => {
          this.#socket.onerror = (err) => {
            console.error(err);
            if (
              this.#socket.readyState === WebSocket.CLOSED
              || this.#socket.readyState === WebSocket.CLOSING
            ) {
              this.tryReconnect();
            }
          };
          this.setOpened(true);
          this.#attemptingConnection = false;
          this.#socket.onclose = () => {
            this.setOpened(false);
            this.disposeOfSocket();
            this.tryReconnect();
          };
          resolve();
          this.onopen();
        };

        this.#socket.onerror = (errEvent) => {
          console.error(errEvent);
          this.tryReconnect();
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
      } catch (err) {
        reject(err);
      }
    });
  }

  private disposeOfSocket() {
    try {
      this.#socket.onclose = null;
      this.#socket.onerror = null;
      this.#socket.onopen = null;
      this.#socket.onmessage = null;
      this.#socket.close();
    } catch {
      //
    }
  }

  private incomingRetry?: Timer;
  private lastRetry?: [
    at: number,
    backoff: keyof typeof RECONNECT_BACKOFFS,
    isPending: boolean,
  ];

  private tryReconnect() {
    if (this.incomingRetry) return;

    const retry = (backoff: number) => {
      if (this.#isOpened) return;

      const retryEntry = [Date.now(), backoff, true] as Exclude<
        typeof this.lastRetry,
        undefined
      >;
      this.lastRetry = retryEntry;

      this.createWs()
        .then(async () => {
          if (this.#connectionParams) {
            await this.openConnection(this.#connectionParams);
          }
          retryEntry[2] = false;
        })
        .catch(() => {
          retryEntry[2] = false;
          this.tryReconnect();
        });
    };

    if (this.lastRetry) {
      const [lastRetriedAt, lastBackoff, isPending] = this.lastRetry;
      if (isPending) return;
      const now = Date.now();
      const nextBackoff = RECONNECT_BACKOFFS[lastBackoff];
      const nextRunAfter = nextBackoff - (now - lastRetriedAt);
      if (nextRunAfter >= 0) {
        this.incomingRetry = setTimeout(() => {
          this.incomingRetry = undefined;
          retry(nextBackoff);
        }, nextRunAfter);
      } else {
        retry(nextBackoff);
      }
    } else {
      retry(RECONNECT_BACKOFFS[0]);
    }
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

          this.once(OutgoingMessageType.ROOM_CONNECTED, (data) => {
            this.#attemptingConnection = false;
            resolve(data);
          });

          this.once(OutgoingMessageType.ERROR, (data): void => {
            this.#attemptingConnection = false;
            this.#connectionParams = null;
            reject(new Error(data.message));
          });

          this.#socket.onerror = () => {
            this.#attemptingConnection = false;
            this.#connectionParams = null;
            reject(
              new Error(
                "Connection could not be established.",
              ),
            );
          };

          this.send({
            type: IncomingMessageType.ROOM_CONNECT,
            messageID: v4(),
            ...connectionParams,
          });
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
            } finally {
              this.onopen = noop;
            }
          };
        },
      );
    }
  }

  public closeRoomConnection() {
    if (this.#connectionParams) {
      this.send({
        type: IncomingMessageType.ROOM_DISCONNECT,
        messageID: v4(),
        roomID: this.#connectionParams.roomID,
        userID: this.#connectionParams.userID,
      }).catch(() => {});
      this.#connectionParams = null;
    }
  }
}
