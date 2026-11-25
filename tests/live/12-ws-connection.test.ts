import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import { uniqueId } from "../helpers/http";
import {
  connectToRoom,
  IncomingMessageType,
  nextMessageID,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
} from "../helpers/ws";

const TIMEOUT = 15_000;

/** every socket created by this suite, closed in afterAll */
const sockets: RoomClient[] = [];

let roomID = "";
let ownerUserID = "";
let owner!: Awaited<ReturnType<typeof setupRoom>>["owner"];

interface ConnectOpts {
  roomID: string;
  userID: string;
  publicUserID: string;
  username: string;
  role?: "voter" | "viewer";
}

/** sends a room:connect with explicit field values (for negative tests) */
function sendConnect(client: RoomClient, opts: ConnectOpts): string {
  return client.send({
    type: IncomingMessageType.ROOM_CONNECT,
    roomID: opts.roomID,
    userID: opts.userID,
    publicUserID: opts.publicUserID,
    username: opts.username,
    role: opts.role ?? "voter",
  });
}

beforeAll(async () => {
  await ensureServer();
  const room = await setupRoom({ username: uniqueId("wsconn-owner") });
  roomID = room.roomID;
  ownerUserID = room.userID;
  owner = room.owner;
  sockets.push(owner.client);
}, 20_000);

afterAll(async () => {
  await Promise.allSettled(sockets.map((client) => client.close()));
});

describe("WS connection protocol", () => {
  test(
    "room:connect responds with room:connected and a full room view",
    async () => {
      const username = uniqueId("wsconn-voter");
      const voter = await connectToRoom({ roomID, username });
      sockets.push(voter.client);

      expect(voter.response.type).toBe(OutgoingMessageType.ROOM_CONNECTED);
      expect(typeof voter.response.connectionID).toBe("string");
      expect(voter.response.connectionID.length).toBeGreaterThan(0);
      // server echoes the publicUserID it stored for the connection
      expect(voter.publicUserID).toBe(voter.response.userPublicID);

      const room = voter.response.room;
      expect(room.roomID).toBe(roomID);

      // the chat contains a system message announcing the join; system
      // messages have no author (no publicUserID / username)
      const joinMsg = room.chatMessages.find(
        (m) => m.text === `*${username}* has joined.`,
      );
      expect(joinMsg).toBeDefined();
      expect(joinMsg!.publicUserID).toBeUndefined();
      expect(joinMsg!.username).toBeUndefined();

      // one round, already in progress
      expect(room.rounds.length).toBe(1);
      expect(room.rounds[0]!.isInProgress).toBe(true);

      // the 8 default options
      expect(room.defaultOptions.map((o) => o.name)).toEqual([
        "0",
        "1",
        "2",
        "3",
        "5",
        "8",
        "13",
        "?",
      ]);

      // the new user is listed as an active voter participant
      const me = room.participants.find(
        (p) => p.publicID === voter.publicUserID,
      );
      expect(me).toBeDefined();
      expect(me!.username).toBe(username);
      expect(me!.isActive).toBe(true);
      expect(me!.role).toBe("voter");

      expect(room.mode).toBe("default");
      expect(room.persistent).toBe(false);

      // the room creator from setupRoom is the owner
      expect(room.ownerName).toBe(owner.username);
      expect(room.ownerRole).toBe("voter");
    },
    TIMEOUT,
  );

  test(
    "empty / whitespace-only username -> 422 'invalid username' (still acked)",
    async () => {
      for (const badUsername of ["", "   "]) {
        const client = await RoomClient.connect();
        sockets.push(client);

        const mid = sendConnect(client, {
          roomID,
          userID: uniqueId(),
          publicUserID: uniqueId("pub"),
          username: badUsername,
        });

        const err = await client.expectError(mid);
        expect(err.code).toBe(422);
        expect(err.message).toBe("invalid username");

        // failing messages are acknowledged too
        const ack = await client.expectAck(mid);
        expect(ack.type).toBe(OutgoingMessageType.MESSAGE_RECEIVED);
        expect(ack.messageID).toBe(mid);

        await client.close();
      }
    },
    TIMEOUT,
  );

  test(
    "unknown roomID responds with room:closed carrying the requested roomID",
    async () => {
      const client = await RoomClient.connect();
      sockets.push(client);

      const missingRoomID = "no-such-room-x9";
      const mid = sendConnect(client, {
        roomID: missingRoomID,
        userID: uniqueId(),
        publicUserID: uniqueId("pub"),
        username: uniqueId("ghost"),
      });

      const closed = await client.waitFor(OutgoingMessageType.ROOM_CLOSED);
      expect(closed.type).toBe(OutgoingMessageType.ROOM_CLOSED);
      expect(closed.roomID).toBe(missingRoomID);

      // the message parsed fine, so it is acknowledged despite the failure
      const ack = await client.expectAck(mid);
      expect(ack.messageID).toBe(mid);

      await client.close();
    },
    TIMEOUT,
  );

  test(
    "malformed input -> 4xx connection:error; causedBy echoes messageID when one was sent",
    async () => {
      const client = await RoomClient.connect();
      sockets.push(client);

      // raw non-JSON text — no messageID can be recovered, so causedBy stays
      // "unknown", but the code must still be a 4xx, not a 500
      client.raw("this is not json at all");
      let err = await client.expectError("unknown");
      expect(err.code).toBeGreaterThanOrEqual(400);
      expect(err.code).toBeLessThan(500);

      // valid JSON with a messageID but missing required fields — the server
      // must echo that messageID as causedBy
      const missingFields = {
        type: IncomingMessageType.ROOM_CONNECT,
        messageID: nextMessageID(),
      };
      client.raw(JSON.stringify(missingFields));
      err = await client.expectError(missingFields.messageID);
      expect(err.code).toBeGreaterThanOrEqual(400);
      expect(err.code).toBeLessThan(500);

      // unknown message type, messageID present
      const unknownType = {
        type: "foo:bar",
        messageID: nextMessageID(),
      };
      client.raw(JSON.stringify(unknownType));
      err = await client.expectError(unknownType.messageID);
      expect(err.code).toBeGreaterThanOrEqual(400);
      expect(err.code).toBeLessThan(500);

      // wrong field type (roomID as number), messageID present
      const badTypes = {
        type: IncomingMessageType.ROOM_CONNECT,
        messageID: nextMessageID(),
        roomID: 123,
        userID: "u",
        publicUserID: "p",
        username: "n",
        role: "voter",
      };
      client.raw(JSON.stringify(badTypes));
      err = await client.expectError(badTypes.messageID);
      expect(err.code).toBeGreaterThanOrEqual(400);
      expect(err.code).toBeLessThan(500);

      // NOTE: messages that fail JSON parsing / schema validation never
      // produce a message:received ack (the parsed `data` is undefined),
      // even when a messageID was present in the payload.
      let ackedUnparsable = false;
      try {
        await client.expectAck(badTypes.messageID, 800);
        ackedUnparsable = true;
      } catch {
        // expected: no ack
      }
      expect(ackedUnparsable).toBe(false);

      await client.close();
    },
    TIMEOUT,
  );

  test(
    "duplicate messageID is deduplicated but still acked (one chat message)",
    async () => {
      const text = uniqueId("dedup-msg");

      const mid = nextMessageID();
      const payload = {
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: ownerUserID,
        text,
      } as const;
      owner.client.send({ ...payload, messageID: mid });
      owner.client.send({ ...payload, messageID: mid });

      // both occurrences are acknowledged
      const ack1 = await owner.client.expectAck(mid);
      const ack2 = await owner.client.expectAck(mid);
      expect(ack1.messageID).toBe(mid);
      expect(ack2.messageID).toBe(mid);

      // exactly one chat entry was created by the first occurrence
      const update = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === text),
      );
      const matching = update.chatMessages.filter((c) => c.text === text);
      expect(matching.length).toBe(1);

      // NOTE: the duplicate is silently ignored — no second broadcast
      let duplicateBroadcast = false;
      try {
        await owner.client.waitFor(
          (m) =>
            m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
            && m.chatMessages.filter((c) => c.text === text).length > 1,
          800,
        );
        duplicateBroadcast = true;
      } catch {
        // expected: the duplicate never processed
      }
      expect(duplicateBroadcast).toBe(false);
    },
    TIMEOUT,
  );

  test(
    "multi-tab: same userID + publicUserID shares one connection; broadcasts reach both tabs",
    async () => {
      const userID = uniqueId("mt-user");
      const publicUserID = uniqueId("pub");
      const username = uniqueId("mt-user");

      const tab1 = await connectToRoom({
        roomID,
        userID,
        publicUserID,
        username,
      });
      const tab2 = await connectToRoom({
        roomID,
        userID,
        publicUserID,
        username,
      });
      sockets.push(tab1.client, tab2.client);

      expect(tab2.response.type).toBe(OutgoingMessageType.ROOM_CONNECTED);
      // both sockets attach to the same connection object
      expect(tab2.connectionID).toBe(tab1.connectionID);
      expect(tab2.publicUserID).toBe(publicUserID);

      // participants list contains exactly ONE entry for the user
      const entries = tab2.response.room.participants.filter(
        (p) => p.publicID === publicUserID,
      );
      expect(entries.length).toBe(1);
      expect(entries[0]!.isActive).toBe(true);
      expect(entries[0]!.username).toBe(username);

      // server broadcasts reach both tabs
      const text = uniqueId("mt-broadcast");
      owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: ownerUserID,
        text,
      });

      const seen1 = await tab1.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === text),
      );
      const seen2 = await tab2.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === text),
      );
      expect(seen1.chatMessages.at(-1)!.text).toBe(text);
      expect(seen2.chatMessages.at(-1)!.text).toBe(text);
    },
    TIMEOUT,
  );

  test(
    "abrupt socket close keeps an inactive connection; reconnect reattaches to it",
    async () => {
      const userID = uniqueId("rc-user");
      const publicUserID = uniqueId("pub");
      const username = uniqueId("rc-user");

      const first = await connectToRoom({
        roomID,
        userID,
        publicUserID,
        username,
      });
      sockets.push(first.client);
      const originalConnectionID = first.connectionID;

      // close the socket without sending room:disconnect
      await first.client.close();
      // small grace period for the server-side close handler to run
      await new Promise((r) => setTimeout(r, 300));

      // a fresh observer sees the user still listed, but inactive
      const observer = await connectToRoom({
        roomID,
        username: uniqueId("obs"),
      });
      sockets.push(observer.client);
      const stale = observer.response.room.participants.find(
        (p) => p.publicID === publicUserID,
      );
      expect(stale).toBeDefined();
      expect(stale!.isActive).toBe(false);

      // reconnecting with the same userID re-attaches to the SAME connection
      const second = await connectToRoom({
        roomID,
        userID,
        publicUserID,
        username,
      });
      sockets.push(second.client);

      expect(second.connectionID).toBe(originalConnectionID);
      expect(second.publicUserID).toBe(publicUserID);

      const me = second.response.room.participants.find(
        (p) => p.publicID === publicUserID,
      );
      expect(me).toBeDefined();
      expect(me!.isActive).toBe(true);

      // NOTE: reattaching does NOT add a second "has joined" system message
      const joins = second.response.room.chatMessages.filter(
        (m) => m.text === `*${username}* has joined.`,
      );
      expect(joins.length).toBe(1);
    },
    TIMEOUT,
  );

  test(
    "a valid room:post-message payload sent as a BINARY frame is processed exactly like a text frame: acked and its text broadcast",
    async () => {
      const text = uniqueId("bin-frame");
      const mid = nextMessageID();
      owner.client.raw(
        new TextEncoder().encode(
          JSON.stringify({
            type: IncomingMessageType.POST_MESSAGE,
            roomID,
            userID: ownerUserID,
            text,
            messageID: mid,
          }),
        ),
      );

      await owner.client.expectAck(mid);
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === text),
      );
    },
    TIMEOUT,
  );

  test(
    "a binary frame of garbage bytes gets connection:error 400 causedBy 'unknown' and the socket stays open and usable",
    async () => {
      const client = await RoomClient.connect();
      sockets.push(client);

      client.raw(new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0xab]));
      const err = await client.expectError("unknown");
      expect(err.code).toBe(400);

      // the socket was not torn down: a full room:connect still works on it
      const mid = sendConnect(client, {
        roomID,
        userID: uniqueId(),
        publicUserID: uniqueId("pub"),
        username: uniqueId("after-garbage-bin"),
      });
      const connected = await client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CONNECTED
          || m.type === OutgoingMessageType.ROOM_CLOSED,
      );
      expect(connected.type).toBe(OutgoingMessageType.ROOM_CONNECTED);
      await client.expectAck(mid);
    },
    TIMEOUT,
  );

  test(
    "a messageID resent after the 30s dedup expiry is processed again: acked and its new text broadcast",
    async () => {
      const mid = nextMessageID();
      const firstText = uniqueId("dedup-exp-first");
      owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: ownerUserID,
        text: firstText,
        messageID: mid,
      });
      await owner.client.expectAck(mid);
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === firstText),
      );

      // entries expire after 30s; waiting 35s rides past the expiry without
      // waiting for the expiry sweeper's next 30s tick (which can be up to
      // 60s after the first send)
      await new Promise((r) => setTimeout(r, 35_000));

      const secondText = uniqueId("dedup-exp-second");
      owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: ownerUserID,
        text: secondText,
        messageID: mid,
      });
      await owner.client.expectAck(mid);
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some((c) => c.text === secondText),
      );
    },
    45_000,
  );
});

describe("WS connection cap", () => {
  test(
    "connection cap (WS_MAX_CONNECTIONS=30 in the test container): 30 sockets connect, the 31st upgrade fails, and a closed socket frees its slot",
    async () => {
      // free the sockets earlier tests in this file left open — the cap
      // arithmetic below must be exact (the file-level afterAll would close
      // them anyway)
      await Promise.allSettled(
        sockets.splice(0, sockets.length).map((c) => c.close()),
      );
      // give the server's close handler time to release the slots
      await new Promise((r) => setTimeout(r, 500));

      const capSockets: RoomClient[] = [];
      for (let i = 0; i < 30; i++) {
        capSockets.push(await RoomClient.connect());
      }
      sockets.push(...capSockets);

      // the 31st upgrade is refused (503 "Server is busy" before upgrade) —
      // the client sees a failed handshake, not an open socket
      let thirtyFirstError: Error | undefined;
      let thirtyFirst: RoomClient | undefined;
      try {
        thirtyFirst = await RoomClient.connect();
      } catch (e) {
        thirtyFirstError = e as Error;
      }
      // leak-guard: if the cap is not enforced the socket must still be closed
      if (thirtyFirst) {
        sockets.push(thirtyFirst);
      }
      expect(thirtyFirstError?.message).toBe("WebSocket connection failed");

      // closing one socket frees its slot for a fresh connection
      await capSockets[0]!.close();
      await new Promise((r) => setTimeout(r, 500));
      sockets.push(await RoomClient.connect());
    },
    60_000,
  );
});
