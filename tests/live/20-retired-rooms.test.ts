/**
 * Live tests for persistent-room retirement: a persistent room with no
 * active connections and >=1h of inactivity is dropped from memory at
 * startup and reloaded from disk on demand (RoomService.loadRetiredRoom).
 *
 * Waiting an hour is impossible, so the room's on-disk lastActivity is
 * rewritten to ~2h ago. This file restarts the container, so it must be the
 * LAST live test file.
 */
import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PERSISTENT_ROOM_RETIRE_AFTER_MIN } from "../../src/server/rooms/room/constants";
import {
  ensureServer,
  restartServer,
  waitForReadiness,
} from "../helpers/docker";
import { api, uniqueId } from "../helpers/http";
import {
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
  type WSMessage,
} from "../helpers/ws";

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

interface PersistedRound {
  isInProgress: boolean;
  results: Array<{ vote: string }>;
  finalResult?: { votes: number } | null;
}

interface PersistedRoom {
  id: string;
  ownerName: string;
  persistent: boolean;
  lastActivity: string;
  rounds: PersistedRound[];
  chatMessages: Array<{ text: string }>;
}

/** reads the room's serialized snapshot from inside the test container */
async function readPersistedRoomFile(roomID: string): Promise<string | null> {
  const proc =
    await $`docker exec pointing-poker-test cat /var/www/pointing-poker/dist/persistent-storage/Room/${roomID}.json`
      .quiet().nothrow();
  return proc.exitCode === 0 ? proc.stdout.toString() : null;
}

/** parses the on-disk snapshot, failing loudly when the file is missing */
async function readPersistedRoom(roomID: string): Promise<PersistedRoom> {
  const content = await readPersistedRoomFile(roomID);
  if (content == null) {
    throw new Error(`room ${roomID} was never persisted (file missing)`);
  }
  return JSON.parse(content) as PersistedRoom;
}

/**
 * Polls until the finished-round state and the seeded chat message have
 * reached the disk snapshot. Returns undefined on timeout.
 */
async function waitForPersistedState(
  roomID: string,
  chatText: string,
  timeoutMs = 10_000,
): Promise<PersistedRoom | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await readPersistedRoomFile(roomID);
    if (content != null) {
      try {
        const data = JSON.parse(content) as PersistedRoom;
        const round = data.rounds?.[0];
        const ok = round?.isInProgress === false
          && round.finalResult != null
          && (round.results?.length ?? 0) >= 1
          && data.chatMessages?.some((c) => c.text === chatText) === true;
        if (ok) {
          return data;
        }
      } catch {
        // not valid JSON yet — keep polling
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return undefined;
}

/**
 * Rewrites the on-disk snapshot's lastActivity to ~2 hours ago via a script
 * inside the container (the file is owned by the container user).
 */
async function ageRoomOnDisk(
  roomID: string,
  ageBy = 2 * PERSISTENT_ROOM_RETIRE_AFTER_MIN * 60 * 1000,
): Promise<void> {
  const script = `
const fs = require("fs");
const f = "/var/www/pointing-poker/dist/persistent-storage/Room/${roomID}.json";
const data = JSON.parse(fs.readFileSync(f, "utf8"));
data.lastActivity = new Date(Date.now() - ${ageBy}).toISOString();
fs.writeFileSync(f, JSON.stringify(data, null, 2));
`;
  const proc = await $`docker exec pointing-poker-test bun -e ${script}`.quiet()
    .nothrow();
  if (proc.exitCode !== 0) {
    throw new Error(
      `aging the room file failed:\n${proc.stderr.toString()}\n${proc.stdout.toString()}`,
    );
  }
}

/**
 * Counts the room files on disk and how many PERSISTENT ones are inactive
 * for over an hour — i.e. how many the server must retire (not load) at
 * startup. Non-persistent rooms load regardless of age, so they don't count.
 */
async function countDiskRooms(): Promise<{ total: number; retired: number }> {
  const minAge = PERSISTENT_ROOM_RETIRE_AFTER_MIN * 60 * 1000;
  const script = `
const fs = require("fs");
const dir = "/var/www/pointing-poker/dist/persistent-storage/Room";
let total = 0, retired = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  total++;
  const d = JSON.parse(fs.readFileSync(dir + "/" + f, "utf8"));
  if (d.persistent && Date.now() - Date.parse(d.lastActivity) > ${minAge}) {
    retired++;
  }
}
console.log(JSON.stringify({ total, retired }));
`;
  const proc = await $`docker exec pointing-poker-test bun -e ${script}`.quiet()
    .nothrow();
  if (proc.exitCode !== 0) {
    throw new Error(
      `disk census failed:\n${proc.stderr.toString()}\n${proc.stdout.toString()}`,
    );
  }
  return JSON.parse(proc.stdout.toString().trim()) as {
    total: number;
    retired: number;
  };
}

async function fetchActiveRooms(): Promise<number> {
  const res = await api("/api/stats");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { activeRooms: number };
  return body.activeRooms;
}

/**
 * Connects to a room without throwing, riding out the race between HTTP
 * readiness and the (un-awaited) loadRoomsFromDisk on startup. Returns the
 * room:connected/room:closed response along with the client.
 */
async function tryConnect(opts: {
  roomID: string;
  username: string;
  retries?: number;
}): Promise<{ client: RoomClient; response: WSMessage } | undefined> {
  for (let attempt = 0; attempt < (opts.retries ?? 5); attempt++) {
    const client = track(await RoomClient.connect());
    client.send({
      type: IncomingMessageType.ROOM_CONNECT,
      roomID: opts.roomID,
      userID: uniqueId(),
      publicUserID: uniqueId("pub"),
      username: opts.username,
      role: "voter",
    });
    const response = await client.waitFor(
      (msg) =>
        msg.type === OutgoingMessageType.ROOM_CONNECTED
        || msg.type === OutgoingMessageType.ROOM_CLOSED,
    );
    if (response.type === OutgoingMessageType.ROOM_CONNECTED) {
      return { client, response };
    }
    await closeQuietly(client);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return undefined;
}

beforeAll(async () => {
  await ensureServer();
}, 30_000);

afterAll(async () => {
  for (const client of allClients.splice(0, allClients.length)) {
    await closeQuietly(client);
  }
});

describe("persistent-room retirement and on-demand reload", () => {
  test(
    "a persistent room whose disk snapshot is >=1h inactive is retired at startup and fully restored from disk on the first connect",
    async () => {
      // ---- seed a persistent room: vote + finish + chat -----------------
      const { roomID, owner } = await setupRoom({
        persistent: true,
        username: uniqueId("retire-owner"),
      });
      const voter = await connectToRoom({
        roomID,
        username: uniqueId("retire-voter"),
      });
      track(voter.client);

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const option = owner.response.room.defaultOptions[3]!;

      const voteMid = voter.client.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        roomID,
        userID: voter.userID,
        roundID,
        optionRef: option.id,
      });
      await voter.client.expectAck(voteMid);

      const finishMid = owner.client.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        roomID,
        userID: owner.userID,
      });
      await owner.client.expectAck(finishMid);

      const chatText = uniqueId("retire-chat");
      const chatMid = voter.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: voter.userID,
        text: chatText,
      });
      await voter.client.expectAck(chatMid);

      await closeQuietly(owner.client);
      await closeQuietly(voter.client);

      const persisted = await waitForPersistedState(roomID, chatText);
      if (!persisted) {
        throw new Error(
          `room ${roomID}'s finished-round state and chat never reached disk`,
        );
      }

      // ---- baseline BEFORE any restart: the room is still in memory -----
      const baseline = await tryConnect({
        roomID,
        username: uniqueId("retire-baseline"),
        retries: 1,
      });
      if (!baseline) {
        throw new Error("room stopped being connectable before the restart");
      }
      expect(baseline.response.room.persistent).toBe(true);
      await closeQuietly(baseline.client);

      // let the baseline connect's debounced disk write settle BEFORE aging
      // the file — a write after the rewrite would clobber lastActivity
      await new Promise((r) => setTimeout(r, 1500));
      const postBaseline = await readPersistedRoom(roomID);
      expect(postBaseline.rounds[0]!.isInProgress).toBe(false);
      expect(postBaseline.rounds[0]!.finalResult).toBeDefined();

      // ---- force the retirement age on disk -----------------------------
      await ageRoomOnDisk(roomID);
      const aged = await readPersistedRoom(roomID);
      const agedAge = Date.now() - Date.parse(aged.lastActivity);
      expect(agedAge).toBeGreaterThan(10 * 60 * 1000);

      // ---- restart: the room must be retired, not loaded ----------------
      await restartServer();
      await waitForReadiness();

      // the census taken after aging says how many rooms must be in memory
      // once the startup load settles — the aged room excluded. If the room
      // shows up in the gauge, it was loaded at startup instead of retired.
      const census = await countDiskRooms();
      const expectedActiveRooms = census.total - census.retired;
      let observedActiveRooms = -1;
      const gaugeDeadline = Date.now() + 10_000;
      while (Date.now() < gaugeDeadline) {
        observedActiveRooms = await fetchActiveRooms();
        if (observedActiveRooms === expectedActiveRooms) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(observedActiveRooms).toBe(expectedActiveRooms);

      // ---- the first connect reloads the room from disk -----------------
      const reloaded = await tryConnect({
        roomID,
        username: uniqueId("retire-rejoin"),
      });
      // room:closed (even after retries) means the room was not reloaded
      if (!reloaded) {
        throw new Error(
          "retired room was not reloaded from disk: connect got room:closed",
        );
      }
      expect(reloaded.response.type).toBe(OutgoingMessageType.ROOM_CONNECTED);

      const room = reloaded.response.room;
      expect(room.persistent).toBe(true);
      expect(room.ownerName).toBe(persisted.ownerName);
      expect(
        room.chatMessages.some((c: { text: string }) => c.text === chatText),
      ).toBe(true);
      expect(room.rounds.length).toBe(persisted.rounds.length);
      expect(room.rounds[0]!.isInProgress).toBe(false);
      expect(room.rounds[0]!.finalResult).toEqual(
        persisted.rounds[0]!.finalResult,
      );
      expect(room.rounds[0]!.finalResult!.votes).toBe(1);

      await closeQuietly(reloaded.client);
    },
    120_000,
  );
});
