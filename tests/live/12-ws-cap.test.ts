import { afterAll, beforeAll, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import { RoomClient } from "../helpers/ws";

// must match WS_MAX_CONNECTIONS in docker-compose.test.yml
const CAP = 60;

/** every socket this file opens, closed in afterAll */
const sockets: RoomClient[] = [];

beforeAll(async () => {
  await ensureServer();
}, 20_000);

afterAll(async () => {
  await Promise.allSettled(sockets.map((client) => client.close()));
});

test(
  "connection cap: 60 sockets connect, the 61st upgrade fails, and a closed socket frees its slot",
  async () => {
    for (let i = 0; i < CAP; i++) {
      sockets.push(await RoomClient.connect());
    }

    let capError: Error | undefined;
    let overCap: RoomClient | undefined;
    try {
      overCap = await RoomClient.connect();
    } catch (e) {
      capError = e as Error;
    }
    if (overCap) {
      sockets.push(overCap);
    }
    expect(capError?.message).toBe("WebSocket connection failed");

    await sockets[0]!.close();
    await new Promise((r) => setTimeout(r, 500));
    sockets.push(await RoomClient.connect());
  },
  60_000,
);
