import type {
  RoomWSIncomingMessage,
} from "../../src/shared/websockets-messages/room-websocket-incoming-message-types";
import {
  IncomingMessageType,
} from "../../src/shared/websockets-messages/room-websocket-incoming-message-types";
import type {
  RoomConnectionInitiatedOutgoingMessage,
  RoomWSOutgoingMessage,
} from "../../src/shared/websockets-messages/room-websocket-outgoing-message-types";
import {
  OutgoingMessageType,
} from "../../src/shared/websockets-messages/room-websocket-outgoing-message-types";
import { ORIGIN, WS_URL } from "./config";
import { createRoom, randomIp, uniqueId } from "./http";

/** Omit over a union keeps every member instead of collapsing to shared keys */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K>
  : never;

/** payloads come from JSON.parse — tests read arbitrary fields off any
 * union member without narrowing boilerplate */
export type WSMessage = RoomWSOutgoingMessage & Record<string, any>;

let msgCounter = 0;

export function nextMessageID(): string {
  return `msg-${Date.now().toString(36)}-${++msgCounter}-${
    Math.random()
      .toString(36)
      .slice(2, 6)
  }`;
}

export type MessageMatcher = (msg: WSMessage) => boolean;

interface Waiter {
  test: MessageMatcher;
  resolve: (msg: WSMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function describeInbox(inbox: WSMessage[]): string {
  return inbox
    .map((m) => JSON.stringify(m))
    .join("\n  ")
    .slice(0, 2000);
}

export class RoomClient {
  private readonly ws: WebSocket;
  private readonly inbox: WSMessage[] = [];
  private readonly consumed = new WeakSet<object>();
  private readonly waiters: Waiter[] = [];
  private closed = false;
  private closePromise: Promise<void>;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.closePromise = new Promise<void>((resolve) => {
      ws.onclose = () => {
        this.closed = true;
        resolve();
      };
    });
    ws.onmessage = (event) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      this.inbox.push(msg);
      this.checkWaiters();
    };
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  public waitUntilClosed(timeoutMs = 5000): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Socket was not closed within the timeout")),
        timeoutMs,
      );
      this.closePromise.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  public static connect(
    opts: { ip?: string; url?: string; headers?: Record<string, string> } = {},
  ): Promise<RoomClient> {
    const ws = new WebSocket(opts.url ?? WS_URL, {
      headers: {
        Origin: ORIGIN,
        "X-Forwarded-For": opts.ip ?? randomIp(),
        ...opts.headers,
      },
    });
    const client = new RoomClient(ws);
    return new Promise<RoomClient>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("WebSocket connection timed out")),
        10_000,
      );
      ws.onopen = () => {
        clearTimeout(timer);
        resolve(client);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket connection failed"));
      };
    });
  }

  public close(): Promise<void> {
    this.ws.close();
    return this.closePromise;
  }

  /**
   * stamps a unique messageID unless one is provided (the server dedups
   * repeated messageIDs) and returns the messageID used, for expectAck
   */
  public send(
    data: DistributiveOmit<RoomWSIncomingMessage, "messageID"> & {
      messageID?: string;
    },
  ): string {
    const messageID = data.messageID ?? nextMessageID();
    this.ws.send(JSON.stringify({ ...data, messageID }));
    return messageID;
  }

  /**
   * sends an arbitrary raw payload — string for malformed-text tests,
   * Uint8Array for binary-frame tests (Bun sends typed arrays as binary
   * frames)
   */
  public raw(data: string | Uint8Array): void {
    this.ws.send(data);
  }

  /**
   * Resolves with the first matching message that has not been consumed by
   * an earlier waitFor call. Messages of any type may arrive between the
   * send and the awaited one — they are skipped, not consumed.
   */
  public waitFor(
    matcher: OutgoingMessageType | MessageMatcher,
    timeoutMs = 5000,
  ): Promise<WSMessage> {
    const test: MessageMatcher = typeof matcher === "string"
      ? (msg) => msg.type === matcher
      : matcher;

    const existing = this.inbox.find(
      (m) => !this.consumed.has(m) && test(m),
    );
    if (existing) {
      this.consumed.add(existing);
      return Promise.resolve(existing);
    }

    return new Promise<WSMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.reject === reject);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        reject(
          new Error(
            `waitFor timed out after ${timeoutMs}ms. Inbox at timeout:\n  ${
              describeInbox(this.inbox)
            }`,
          ),
        );
      }, timeoutMs);
      this.waiters.push({ test, resolve, reject, timer });
    });
  }

  private checkWaiters(): void {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i]!;
      const match = this.inbox.find(
        (m) => !this.consumed.has(m) && waiter.test(m),
      );
      if (match) {
        this.consumed.add(match);
        this.waiters.splice(i, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(match);
      }
    }
  }

  public expectAck(messageID: string, timeoutMs = 5000) {
    return this.waitFor(
      (msg) =>
        msg.type === OutgoingMessageType.MESSAGE_RECEIVED
        && msg.messageID === messageID,
      timeoutMs,
    );
  }

  public expectError(
    causedBy: string,
    timeoutMs = 5000,
  ): Promise<{ code: number; message: string }> {
    return this.waitFor(
      (msg) =>
        msg.type === OutgoingMessageType.ERROR && msg.causedBy === causedBy,
      timeoutMs,
    ) as Promise<{ code: number; message: string }>;
  }
}

export interface ConnectedUser {
  client: RoomClient;
  userID: string;
  username: string;
  publicUserID: string;
  connectionID: string;
  /** the room:connected response */
  response: RoomConnectionInitiatedOutgoingMessage;
}

export async function connectToRoom(opts: {
  roomID: string;
  userID?: string;
  username?: string;
  role?: "voter" | "viewer";
  publicUserID?: string;
}): Promise<ConnectedUser> {
  const userID = opts.userID ?? uniqueId();
  const username = opts.username ?? uniqueId("username");
  const client = await RoomClient.connect();

  const messageID = client.send({
    type: IncomingMessageType.ROOM_CONNECT,
    roomID: opts.roomID,
    userID,
    publicUserID: opts.publicUserID ?? uniqueId("pub"),
    username,
    role: opts.role ?? "voter",
  });

  const response = (await client.waitFor(
    (msg) =>
      msg.type === OutgoingMessageType.ROOM_CONNECTED
      || msg.type === OutgoingMessageType.ROOM_CLOSED,
  )) as RoomConnectionInitiatedOutgoingMessage;

  if (response.type !== OutgoingMessageType.ROOM_CONNECTED) {
    await client.close();
    throw new Error(
      `connectToRoom: server responded with room:closed for room ${opts.roomID}`,
    );
  }
  client.expectAck(messageID).catch(() => {});

  return {
    client,
    userID,
    username,
    publicUserID: response.userPublicID,
    connectionID: response.connectionID,
    response,
  };
}

/** owner.userID is the id the server checks with isOwner */
export async function setupRoom(
  opts: { persistent?: boolean; username?: string; userID?: string } = {},
): Promise<{
  roomID: string;
  owner: ConnectedUser;
  userID: string;
  username: string;
}> {
  const room = await createRoom({
    persistent: opts.persistent,
    username: opts.username,
    userID: opts.userID,
  });
  const owner = await connectToRoom({
    roomID: room.roomID,
    userID: room.userID,
    username: room.username,
  });
  return {
    roomID: room.roomID,
    owner,
    userID: room.userID,
    username: room.username,
  };
}

export { IncomingMessageType, OutgoingMessageType };
