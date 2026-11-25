import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ensureServer,
  recreateServer,
  restartServer,
  waitForReadiness,
} from "../helpers/docker";
import { uniqueId } from "../helpers/http";
import {
  type ConnectedUser,
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
} from "../helpers/ws";

/**
 * Live-server tests for room lifecycle (join / leave / participants /
 * ownership reassignment) and room persistence across a server RESTART.
 *
 * The restart/recreate tests are intentionally LAST in the file: restarting
 * the container kills every open websocket.
 *
 * NOTE: other test suites may run against the same container concurrently
 * (and may restart it). The restart tests therefore verify the persisted
 * state on the container disk before restarting, and retry the whole
 * scenario once if the environment interferes.
 */

const allClients: RoomClient[] = [];

function track(client: RoomClient): RoomClient {
  allClients.push(client);
  return client;
}

async function closeQuietly(client: RoomClient | undefined): Promise<void> {
  try {
    if (client && !client.isClosed) {
      await client.close();
    }
  } catch {
    // leftover/broken sockets are fine — just make sure we tried
  }
}

/** makes sure the test server is actually reachable (restart-proof) */
async function ensureUp(readinessTimeoutMs = 60_000): Promise<void> {
  try {
    await waitForReadiness(10_000);
  } catch {
    await $`docker compose -f docker-compose.test.yml up -d --wait`.quiet()
      .nothrow();
    await waitForReadiness(readinessTimeoutMs);
  }
}

/**
 * Connects to a room without throwing when the room is not (yet) available.
 * Retries a few times to ride out the (small, but real) race between the
 * server's HTTP readiness and `RoomService.loadRoomsFromDisk()` finishing,
 * which the server fires without awaiting on startup.
 */
async function tryConnect(opts: {
  roomID: string;
  userID: string;
  username: string;
  role?: "voter" | "viewer";
  retries?: number;
}): Promise<{ ok: true; user: ConnectedUser } | { ok: false }> {
  const retries = opts.retries ?? 5;
  for (let attempt = 0; attempt < retries; attempt++) {
    const client = track(await RoomClient.connect());
    const messageID = client.send({
      type: IncomingMessageType.ROOM_CONNECT,
      roomID: opts.roomID,
      userID: opts.userID,
      publicUserID: uniqueId("pub"),
      username: opts.username,
      role: opts.role ?? "voter",
    });
    const response = await client.waitFor(
      (msg) =>
        msg.type === OutgoingMessageType.ROOM_CONNECTED
        || msg.type === OutgoingMessageType.ROOM_CLOSED,
    );
    if (response.type === OutgoingMessageType.ROOM_CONNECTED) {
      client.expectAck(messageID).catch(() => {});
      return {
        ok: true,
        user: {
          client,
          userID: opts.userID,
          username: opts.username,
          publicUserID: response.userPublicID,
          connectionID: response.connectionID,
          response,
        },
      };
    }
    await closeQuietly(client);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { ok: false };
}

/**
 * Seeds a room with a finished round (1 vote) and a chat message. The
 * clients are returned still open so the persistence check below can nudge
 * the room if needed.
 */
async function seedRoomState(opts: { persistent?: boolean; suffix: string }) {
  const { roomID, owner } = await setupRoom({
    persistent: opts.persistent,
    username: `seed-owner-${opts.suffix}`,
  });
  const voter = await connectToRoom({
    roomID,
    username: `seed-voter-${opts.suffix}`,
  });
  track(voter.client);

  const roundID = owner.response.room.rounds.at(-1)!.id;
  const option = owner.response.room.defaultOptions[3]!;

  const voteMsgID = voter.client.send({
    type: IncomingMessageType.ADD_ROUND_VOTE,
    roomID,
    userID: voter.userID,
    roundID,
    optionRef: option.id,
  });
  await voter.client.expectAck(voteMsgID);

  const finishMsgID = owner.client.send({
    type: IncomingMessageType.FINISH_LAST_ROUND,
    roomID,
    userID: owner.userID,
  });
  await owner.client.expectAck(finishMsgID);

  const chatText = `persist-check-${opts.suffix}`;
  const chatMsgID = voter.client.send({
    type: IncomingMessageType.POST_MESSAGE,
    roomID,
    userID: voter.userID,
    text: chatText,
  });
  await voter.client.expectAck(chatMsgID);

  return { roomID, owner, voter, option, chatText };
}

/**
 * Keeps (or re-establishes) a connection to the room and posts a chat
 * message — posting re-triggers the room's serialization. Used to recover
 * from lost writes (see ensurePersistedState) even if the original sockets
 * were killed by an external restart.
 */
function makeNudger(roomID: string, userID: string, username: string) {
  let client: RoomClient | undefined;
  const nudge = async (): Promise<void> => {
    try {
      if (!client || client.isClosed) {
        const fresh = track(await RoomClient.connect());
        fresh.send({
          type: IncomingMessageType.ROOM_CONNECT,
          roomID,
          userID,
          publicUserID: uniqueId("pub"),
          username,
          role: "voter",
        });
        await fresh.waitFor(
          (m) =>
            m.type === OutgoingMessageType.ROOM_CONNECTED
            || m.type === OutgoingMessageType.ROOM_CLOSED,
          5000,
        );
        client = fresh;
      }
      if (!client.isClosed) {
        client.send({
          type: IncomingMessageType.POST_MESSAGE,
          roomID,
          userID,
          text: `persist-nudge-${Date.now()}`,
        });
      }
    } catch {
      // environment interference (restart in progress) — retry on next nudge
      client = undefined;
    }
  };
  const close = async (): Promise<void> => {
    await closeQuietly(client);
    client = undefined;
  };
  return { nudge, close };
}

/**
 * Serialized room snapshot as written to the container disk.
 */
interface PersistedSnapshot {
  id: string;
  ownerID: string;
  ownerName: string;
  persistent: boolean;
  rounds: Array<{
    isInProgress: boolean;
    results: Array<{ vote: string }>;
    finalResult?: { votes: number } | null;
  }>;
  chatMessages: Array<{ text: string }>;
}

/** reads the room's serialized snapshot from inside the test container */
async function readPersistedRoomFile(roomID: string): Promise<string | null> {
  const proc =
    await $`docker exec pointing-poker-test cat /var/www/pointing-poker/dist/persistent-storage/Room/${roomID}.json`
      .quiet().nothrow();
  return proc.exitCode === 0 ? proc.stdout.toString() : null;
}

async function readPersistedSnapshot(
  roomID: string,
): Promise<PersistedSnapshot> {
  const content = await readPersistedRoomFile(roomID);
  if (content == null) {
    throw new Error(
      `room ${roomID} was never persisted to disk (snapshot file missing)`,
    );
  }
  return JSON.parse(content) as PersistedSnapshot;
}

/**
 * Polls until the room's finished-round state and chat message have reached
 * the disk snapshot. Posting a chat message re-triggers the room's
 * serialization (the server's debounced write can be cancelled by a
 * concurrent state change), so we nudge when the snapshot is still stale.
 * Returns false when the state never landed within the timeout.
 */
async function waitForPersistedState(
  roomID: string,
  chatText: string,
  nudge: () => Promise<void>,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let nudgedAt = 0;
  while (Date.now() < deadline) {
    const content = await readPersistedRoomFile(roomID);
    if (content != null) {
      try {
        const data = JSON.parse(content) as PersistedSnapshot;
        const round = data.rounds?.[0];
        const persistedOk = round?.isInProgress === false
          && round.finalResult != null
          && (round.results?.length ?? 0) >= 1
          && data.chatMessages?.some((c) => c.text === chatText) === true;
        if (persistedOk) {
          return true;
        }
      } catch {
        // not valid JSON yet — keep polling
      }
    }
    // re-trigger serialization at most every 400ms
    if (Date.now() - nudgedAt > 400) {
      nudgedAt = Date.now();
      await nudge();
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/**
 * Asserts that the restored room view matches the snapshot that was on disk
 * right before the restart.
 */
function assertRoomMatchesSnapshot(
  room: ConnectedUser["response"]["room"],
  snap: PersistedSnapshot,
): void {
  expect(room.persistent).toBe(snap.persistent);
  expect(room.ownerName).toBe(snap.ownerName);
  expect(room.rounds.length).toBe(snap.rounds.length);
  snap.rounds.forEach((sRound, i) => {
    const round = room.rounds[i]!;
    expect(round.isInProgress).toBe(sRound.isInProgress);
    if (sRound.finalResult != null) {
      expect(round.finalResult).toBeDefined();
      expect(round.finalResult!.votes).toBe(sRound.finalResult.votes);
    }
    expect(round.results.length).toBe(sRound.results.length);
    sRound.results.forEach((r, j) =>
      expect(round.results[j]!.vote).toBe(r.vote)
    );
  });
  snap.chatMessages.forEach((m) => {
    expect(
      room.chatMessages.some((c) => c.text === m.text),
      `chat message "${m.text}" should be restored`,
    ).toBe(true);
  });
}

/** recreates the container, tolerating transient compose failures */
async function recreateServerWithRetry(): Promise<void> {
  try {
    await recreateServer();
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    await recreateServer();
  }
}

beforeAll(async () => {
  await ensureServer();
  await ensureUp();
});

afterAll(async () => {
  for (const client of allClients.splice(0, allClients.length)) {
    await closeQuietly(client);
  }
});

describe("room lifecycle (no restart)", () => {
  test(
    "room:disconnect removes the participant, posts a system chat message, and later messages from that userID fail with 404",
    async () => {
      const { roomID, owner } = await setupRoom({ username: "lc-owner" });
      const voter = await connectToRoom({ roomID, username: "lc-voter" });
      track(voter.client);

      // sanity: both participants are present after the join (the owner
      // also receives a participants-change for its OWN join, so match on 2)
      const joined = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE
          && m.participants.length === 2
          && m.participants.some((p) => p.publicID === voter.publicUserID),
      );
      expect(joined.participants.length).toBe(2);

      voter.client.send({
        type: IncomingMessageType.ROOM_DISCONNECT,
        roomID,
        userID: voter.userID,
      });

      // the voter is gone from the participants list
      const gone = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE
          && !m.participants.some((p) => p.publicID === voter.publicUserID),
      );
      expect(gone.participants.length).toBe(1);
      expect(gone.participants[0]!.publicID).toBe(owner.publicUserID);

      // ...and a "*<username>* has left." system chat message was posted
      const chat = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.some(
            (c) => c.text === `*${voter.username}* has left.`,
          ),
      );
      expect(chat.chatMessages.at(-1)!.text).toBe(
        `*${voter.username}* has left.`,
      );

      // the socket itself stays open, but the server no longer knows the user
      const voteMsgID = voter.client.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        roomID,
        userID: voter.userID,
        roundID: owner.response.room.rounds.at(-1)!.id,
        optionRef: owner.response.room.defaultOptions[0]!.id,
      });
      const err = await voter.client.expectError(voteMsgID);
      expect(err.code).toBe(404);

      await closeQuietly(owner.client);
      await closeQuietly(voter.client);
    },
    15_000,
  );

  test(
    "plain socket close keeps the participant but marks it inactive; reconnecting with the same userID re-attaches to the same connectionID",
    async () => {
      const { roomID, owner } = await setupRoom({ username: "lc-owner2" });
      const voter = await connectToRoom({ roomID, username: "lc-voter2" });
      track(voter.client);

      // hard-close the socket without room:disconnect
      await voter.client.close();

      // the connection REMAINS in the participants list, inactive
      const inactive = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE
          && m.participants.some(
            (p) => p.publicID === voter.publicUserID && p.isActive === false,
          ),
      );
      expect(inactive.participants.length).toBe(2);

      // reconnecting with the same userID re-attaches to the SAME connection
      const reattached = await connectToRoom({
        roomID,
        userID: voter.userID,
        username: voter.username,
      });
      track(reattached.client);
      expect(reattached.connectionID).toBe(voter.connectionID);
      expect(reattached.publicUserID).toBe(voter.publicUserID);

      // ...and the participant is active again
      const active = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE
          && m.participants.some(
            (p) => p.publicID === voter.publicUserID && p.isActive === true,
          ),
      );
      expect(active.participants.length).toBe(2);

      await closeQuietly(owner.client);
      await closeQuietly(reattached.client);
    },
    15_000,
  );

  test(
    "owner disconnect transfers ownership to the first remaining participant, who can then perform owner actions",
    async () => {
      const { roomID, owner } = await setupRoom({ username: "lc-owner3" });
      const first = await connectToRoom({ roomID, username: "lc-first" });
      track(first.client);
      const second = await connectToRoom({ roomID, username: "lc-second" });
      track(second.client);

      owner.client.send({
        type: IncomingMessageType.ROOM_DISCONNECT,
        roomID,
        userID: owner.userID,
      });

      // ownership falls to the first remaining participant (join order)
      const ownerChange = await first.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.OWNER_UPDATE
          && m.ownerPublicID === first.publicUserID,
      );
      expect(ownerChange.ownerName).toBe(first.username);

      // the new owner can perform owner actions (round:create)
      const createMsgID = first.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: first.userID,
      });
      await first.client.expectAck(createMsgID);

      const roomUpdate = await second.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE,
      );
      // 1 initial round + the newly created one
      expect(roomUpdate.rounds.length).toBe(2);
      expect(roomUpdate.ownerPublicID).toBe(first.publicUserID);

      await closeQuietly(first.client);
      await closeQuietly(second.client);
    },
    15_000,
  );

  test(
    "when the last participant leaves, the room keeps no participants and the join/leave chat trail survives",
    async () => {
      const { roomID, owner } = await setupRoom({
        username: "lc-last-owner",
      });

      owner.client.send({
        type: IncomingMessageType.ROOM_DISCONNECT,
        roomID,
        userID: owner.userID,
      });

      // a fresh join sees an (effectively) empty participants list: only
      // itself
      const next = await connectToRoom({ roomID, username: "lc-next" });
      track(next.client);
      expect(next.response.room.participants.length).toBe(1);
      expect(next.response.room.participants[0]!.publicID).toBe(
        next.publicUserID,
      );

      // the previous owner's leave message is in the chat history
      const chat = next.response.room.chatMessages;
      expect(
        chat.some((c) => c.text === `*${owner.username}* has left.`),
      ).toBe(true);

      await closeQuietly(next.client);
    },
    15_000,
  );
});

describe("room persistence across server restart/recreate", () => {
  test(
    "persistent room survives docker compose restart (rounds, finalResult, votes, chat)",
    async () => {
      const { roomID, owner, voter, option, chatText } = await seedRoomState({
        persistent: true,
        suffix: `persistent-${Date.now().toString(36)}`,
      });
      const nudger = makeNudger(roomID, owner.userID, owner.username);

      try {
        // give the finished-round state a chance to reach the disk
        const persisted = await waitForPersistedState(
          roomID,
          chatText,
          nudger.nudge,
        );
        expect(persisted).toBe(true);
      } finally {
        await nudger.close();
      }

      await closeQuietly(owner.client);
      await closeQuietly(voter.client);

      // whatever is on disk NOW is what must come back after the restart
      const snapshot = await readPersistedSnapshot(roomID);

      await restartServer();
      await ensureUp();

      // reconnect the original owner userID
      const ownerReconnect = await tryConnect({
        roomID,
        userID: owner.userID,
        username: owner.username,
      });
      expect(ownerReconnect.ok).toBe(true);
      if (!ownerReconnect.ok) {
        throw new Error("persistent room was not available after restart");
      }
      const user = ownerReconnect.user;

      const room = user.response.room;
      expect(room.persistent).toBe(true);
      // ownership survives the restart via the persisted ownerID — the
      // reconnecting original owner is still treated as the room owner
      expect(room.ownerName).toBe(owner.username);
      expect(room.ownerPublicID).toBe(user.publicUserID);

      // the whole room state is restored from the disk snapshot, including
      // the finished round
      assertRoomMatchesSnapshot(room, snapshot);
      expect(snapshot.rounds[0]!.results.length).toBe(1);
      expect(snapshot.rounds[0]!.results[0]!.vote).toBe(option.name);
      expect(room.chatMessages.some((c) => c.text === chatText)).toBe(true);

      await closeQuietly(user.client);
    },
    90_000,
  );

  test(
    "regular (non-persistent) room also survives docker compose restart",
    async () => {
      const { roomID, owner, voter, chatText } = await seedRoomState({
        persistent: false,
        suffix: `regular-${Date.now().toString(36)}`,
      });
      const nudger = makeNudger(roomID, owner.userID, owner.username);

      try {
        const persisted = await waitForPersistedState(
          roomID,
          chatText,
          nudger.nudge,
        );
        expect(persisted).toBe(true);
      } finally {
        await nudger.close();
      }

      await closeQuietly(owner.client);
      await closeQuietly(voter.client);

      const snapshot = await readPersistedSnapshot(roomID);

      await restartServer();
      await ensureUp();

      const ownerReconnect = await tryConnect({
        roomID,
        userID: owner.userID,
        username: owner.username,
      });
      expect(ownerReconnect.ok).toBe(true);
      if (!ownerReconnect.ok) {
        throw new Error("regular room was not available after restart");
      }
      const user = ownerReconnect.user;

      const room = user.response.room;
      // NOTE: observed behavior — non-persistent rooms are persisted to
      // disk and reloaded on startup too, exactly like persistent ones.
      expect(room.persistent).toBe(false);
      expect(room.ownerName).toBe(owner.username);

      assertRoomMatchesSnapshot(room, snapshot);

      // the original voter can reconnect too
      const voterReconnect = await tryConnect({
        roomID,
        userID: voter.userID,
        username: voter.username,
      });
      expect(voterReconnect.ok).toBe(true);
      if (voterReconnect.ok) {
        await closeQuietly(voterReconnect.user.client);
      }

      await closeQuietly(user.client);
    },
    90_000,
  );

  test(
    "recreateServer wipes the filesystem: previously-existing roomID becomes unknown (room:closed)",
    async () => {
      const { roomID, owner } = await setupRoom({
        username: "recreate-owner",
      });
      await closeQuietly(owner.client);

      await recreateServerWithRetry();
      // keep the server healthy for subsequent suites
      await ensureServer();
      await ensureUp();

      const result = await tryConnect({
        roomID,
        userID: owner.userID,
        username: owner.username,
        retries: 1,
      });
      expect(result.ok).toBe(false);

      // the server is back up and serving new rooms
      const fresh = await setupRoom({ username: "post-recreate-owner" });
      await closeQuietly(fresh.owner.client);
    },
    90_000,
  );
});
