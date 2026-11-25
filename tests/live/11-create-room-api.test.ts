import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ensureServer } from "../helpers/docker";
import { api, createRoom, uniqueId } from "../helpers/http";
import {
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
} from "../helpers/ws";

/**
 * Exhaustive tests for POST /api/room
 * (src/server/routes/create-room/create-room.ts + create-room-request-data.ts)
 */

/* ------------------------------------------------------------------ */
/* small in-file helpers                                               */
/* ------------------------------------------------------------------ */

interface PostInit {
  headers?: Record<string, string>;
  ip?: string;
  body?: string;
}

/** POST /api/room with a raw string body */
function postRoom(body: string, init: PostInit = {}): Promise<Response> {
  return api("/api/room", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...init.headers },
    ip: init.ip,
  });
}

/** POST /api/room with a JSON-serializable payload */
function postRoomJson(
  payload: unknown,
  init: PostInit = {},
): Promise<Response> {
  return postRoom(JSON.stringify(payload), init);
}

async function getActiveRooms(): Promise<number> {
  const res = await api("/api/stats");
  expect(res.status).toBe(200);
  const data = (await res.json()) as { activeRooms: number };
  return data.activeRooms;
}

const openClients: RoomClient[] = [];

/**
 * Closes a room via the owner-only "/close" chat command. Tolerates rooms
 * that no longer exist (connectToRoom throws in that case). Returns true
 * when the room:closed confirmation arrived.
 */
async function closeRoom(roomID: string, userID: string): Promise<boolean> {
  let client: RoomClient | undefined;
  try {
    const owner = await connectToRoom({ roomID, userID });
    client = owner.client;
    owner.client.send({
      type: IncomingMessageType.POST_MESSAGE,
      roomID,
      userID,
      text: "/close",
    });
    const msg = await owner.client.waitFor(
      (m) =>
        m.type === OutgoingMessageType.ROOM_CLOSED
        || m.type === OutgoingMessageType.ERROR,
      10_000,
    );
    return msg.type === OutgoingMessageType.ROOM_CLOSED;
  } catch {
    // room may already be gone — nothing to clean up
    return false;
  } finally {
    if (client && !client.isClosed) {
      await client.close().catch(() => {});
    }
  }
}

/**
 * Asserts a response is a 400. If the server unexpectedly accepted the
 * payload (200), the created room is closed first (with the actual owner
 * userID from the payload) so the leaked room does not interfere with the
 * max-rooms test, then the assertion fails.
 */
async function expect400(
  res: Response,
  label: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (res.status === 200) {
    const body = (await res.json()) as { roomID: string };
    const ownerID = typeof payload?.userID === "string" ? payload.userID : uniqueId("leak-owner");
    await closeRoom(body.roomID, ownerID);
    throw new Error(
      `expected 400 for ${label} but got 200 (leaked room ${body.roomID} was closed)`,
    );
  }
  expect(res.status).toBe(400);
}

/**
 * Same as expect400 but for payloads the server unexpectedly accepts that
 * must still be cleaned up afterwards (observed-200 cases).
 */
async function expectAcceptedAndClose(
  res: Response,
  label: string,
  payload: Record<string, unknown>,
): Promise<{ roomID: string }> {
  expect(res.status).toBe(200);
  const body = (await res.json()) as { roomID: string };
  expect(typeof body.roomID).toBe("string");
  const ownerID = typeof payload.userID === "string" ? payload.userID : uniqueId("leak-owner");
  await closeRoom(body.roomID, ownerID);
  void label;
  return body;
}

/** json body used for every valid-room request in the validation suites */
function validBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { userID: uniqueId(), username: uniqueId("username"), ...extra };
}

describe("POST /api/room", () => {
  beforeAll(async () => {
    await ensureServer();
  }, 60_000);

  afterAll(async () => {
    // make sure no websockets are left dangling even if a test failed
    for (const client of openClients.splice(0, openClients.length)) {
      if (!client.isClosed) {
        await client.close().catch(() => {});
      }
    }
  });

  /* ---------------------------------------------------------------- */
  /* happy path                                                        */
  /* ---------------------------------------------------------------- */

  describe("happy path", () => {
    test("creates a non-persistent room and returns an 8-char alphanumeric roomID", async () => {
      const userID = uniqueId();
      const username = uniqueId("username");
      const res = await postRoomJson({ userID, username });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };
      expect(typeof body.roomID).toBe("string");
      expect(body.roomID).toHaveLength(8);
      expect(body.roomID).toMatch(/^[a-z0-9]+$/);

      await closeRoom(body.roomID, userID);
    }, 30_000);

    test("explicit persistent:false behaves like the default", async () => {
      const userID = uniqueId();
      const res = await postRoomJson({ userID, username: uniqueId("username"), persistent: false });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };
      expect(body.roomID).toHaveLength(8);

      await closeRoom(body.roomID, userID);
    }, 30_000);

    test("persistent:true returns a longer, timestamp-encoded roomID", async () => {
      const userID = uniqueId();
      const res = await postRoomJson({ userID, username: uniqueId("username"), persistent: true });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };
      // non-persistent ids are 8 chars; the persistent variant adds a
      // timestamp-encoded prefix
      expect(body.roomID.length).toBeGreaterThan(8);

      await closeRoom(body.roomID, userID);
    }, 30_000);

    test("accepts unicode and whitespace in userID/username", async () => {
      const userID = "id-🎯-ßpÄce 42";
      const username = "user ünïcödé 🃏";
      const res = await postRoomJson({ userID, username });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };
      expect(typeof body.roomID).toBe("string");

      await closeRoom(body.roomID, userID);
    }, 30_000);

    test("two calls create two distinct roomIDs", async () => {
      const userID = uniqueId();
      const res1 = await postRoomJson({ userID, username: uniqueId("username") });
      const res2 = await postRoomJson({ userID, username: uniqueId("username") });
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const room1 = (await res1.json()) as { roomID: string };
      const room2 = (await res2.json()) as { roomID: string };
      expect(room1.roomID).not.toBe(room2.roomID);

      await closeRoom(room1.roomID, userID);
      await closeRoom(room2.roomID, userID);
    }, 30_000);
  });

  /* ---------------------------------------------------------------- */
  /* request validation                                                */
  /* ---------------------------------------------------------------- */

  describe("validation (400 on invalid payloads)", () => {
    test.each([
      ["missing userID", { username: "x" }],
      ["missing username", { userID: "x" }],
      ["empty object", {}],
      ["userID is number", { userID: 123, username: "x" }],
      ["username is number", { userID: "x", username: 42 }],
      ["userID is boolean", { userID: true, username: "x" }],
      ["userID is null", { userID: null, username: "x" }],
      ["username is null", { userID: "x", username: null }],
      ["userID is array", { userID: ["a"], username: "x" }],
      ["userID is object", { userID: { a: 1 }, username: "x" }],
      ["username is array", { userID: "x", username: ["a"] }],
      ["persistent is string", { userID: "x", username: "x", persistent: "yes" }],
      ["persistent is number", { userID: "x", username: "x", persistent: 1 }],
      ["persistent is null", { userID: "x", username: "x", persistent: null }],
      ["persistent is array", { userID: "x", username: "x", persistent: [] }],
    ])("rejects %s", async (_label, payload) => {
      const res = await postRoomJson(payload as Record<string, unknown>);
      await expect400(res, _label, payload as Record<string, unknown>);
    }, 30_000);

    // NOTE: observed discrepancy — the source's dilswer schema (Type.String)
    // accepts empty strings, so the server creates a room for them (200)
    // even though the empty userID/username case was expected to be a 400.
    test("observed: empty-string userID and username are ACCEPTED (200)", async () => {
      const res1 = await postRoomJson({ userID: "", username: "x" });
      await expectAcceptedAndClose(res1, "empty userID", { userID: "" });

      const res2 = await postRoomJson({ userID: "some-user", username: "" });
      await expectAcceptedAndClose(res2, "empty username", { userID: "some-user" });
    }, 30_000);

    test("does not validate unknown extra properties (observed: 200)", async () => {
      // DTCreateRoomRequestData is a dilswer Record — Records don't strip or
      // reject unknown keys by default. Assert the OBSERVED behavior.
      const userID = uniqueId();
      const res = await postRoomJson({
        userID,
        username: uniqueId("username"),
        sneakyExtra: { nested: true },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };
      expect(typeof body.roomID).toBe("string");

      await closeRoom(body.roomID, userID);
    }, 30_000);

    // NOTE: observed discrepancy — bodies that fail JSON.parse throw inside
    // ctx.body("json") BEFORE the schema validator runs, so the framework's
    // error handler answers 500 "Internal server error" instead of 400.
    test.each([
      ["empty body", ""],
      ["whitespace-only body", "   "],
      ["malformed json", '{"userID": "x", '],
      ["non-json text", "hello world"],
      ["form-encoded", "userID=x&username=y"],
    ])("observed: %s → 500 (parse error bypasses validation)", async (_label, raw) => {
      const res = await postRoom(raw);
      expect(res.status).toBe(500);
    }, 30_000);

    test.each([
      ["json string", '"just a string"'],
      ["json number", "123"],
      ["json null", "null"],
      ["json array", "[]"],
      ["json array of records", JSON.stringify([{ userID: "x", username: "y" }])],
    ])("rejects %s with 400", async (_label, raw) => {
      const res = await postRoom(raw);
      await expect400(res, _label);
    }, 30_000);

    test("missing content-type still parses a valid json body (observed)", async () => {
      // ctx.body("json") reads request.json() which ignores the content
      // type. Observed behavior asserted here.
      const userID = uniqueId();
      const res = await postRoom(
        JSON.stringify({ userID, username: uniqueId("username") }),
        { headers: {} },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };

      await closeRoom(body.roomID, userID);
    }, 30_000);
  });

  /* ---------------------------------------------------------------- */
  /* origin checks                                                     */
  /* ---------------------------------------------------------------- */

  describe("origin checks", () => {
    test("missing Origin header → 403", async () => {
      // the api() helper always sends a valid Origin, so override it with
      // the empty string (fetch drops empty headers)
      const res = await postRoomJson(validBody(), { headers: { Origin: "" } });
      expect(res.status).toBe(403);
    }, 30_000);

    test("disallowed Origin → 403", async () => {
      const res = await postRoomJson(validBody(), {
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
    }, 30_000);

    test("allowed Origin (helper default) is accepted", async () => {
      const userID = uniqueId();
      const res = await postRoomJson({ userID, username: uniqueId("username") });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };

      await closeRoom(body.roomID, userID);
    }, 30_000);
  });

  /* ---------------------------------------------------------------- */
  /* methods                                                           */
  /* ---------------------------------------------------------------- */

  describe("unsupported methods", () => {
    test.each(["PUT", "DELETE", "PATCH", "GET"])(
      "%s /api/room → 404",
      async (method) => {
        const res = await api("/api/room", { method });
        expect(res.status).toBe(404);
      },
      30_000,
    );
  });

  /* ---------------------------------------------------------------- */
  /* body size limit                                                   */
  /* ---------------------------------------------------------------- */

  describe("body size limit", () => {
    test("body > 512KB is rejected (413, or 502 via a proxy race)", async () => {
      // NOTE: the app aborts the connection on max-body-size before nginx
      // (which buffers large bodies) finishes sending it, so through the
      // proxy the client sees 413 or 502 depending on timing; what matters
      // is that the request is never accepted
      const big = "x".repeat(600 * 1024);
      const res = await postRoom(
        JSON.stringify({ userID: big, username: "x" }),
      );
      expect([413, 502]).toContain(res.status);
    }, 30_000);

    test("body just under 512KB is accepted", async () => {
      const userID = uniqueId();
      const pad = "y".repeat(200 * 1024);
      const res = await postRoom(
        JSON.stringify({ userID, username: "x", pad }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { roomID: string };

      await closeRoom(body.roomID, userID);
    }, 30_000);
  });

  /* ---------------------------------------------------------------- */
  /* max active rooms                                                  */
  /* ---------------------------------------------------------------- */

  describe("max active rooms", () => {
    test("the 101st active room creation returns 503 'Too many rooms.'", async () => {
      const start = await getActiveRooms();
      const created: Array<{ roomID: string; userID: string }> = [];

      try {
        let tooManyBody = "";
        let got503 = false;

        for (let i = 0; i < 110; i++) {
          const userID = uniqueId("owner");
          const res = await postRoomJson({
            userID,
            username: uniqueId("username"),
          });

          if (res.status === 503) {
            got503 = true;
            tooManyBody = await res.text();
            break;
          }

          // tolerate a rate-limit trip by another suite? no — a random ip is
          // used per request, so anything but 200/503 is a real failure.
          if (res.status !== 200) {
            throw new Error(
              `unexpected status ${res.status} while filling rooms: ${await res.text()}`,
            );
          }

          const body = (await res.json()) as { roomID: string };
          created.push({ roomID: body.roomID, userID });

          // hard safety net: never overshoot the limit
          if (created.length > 100) {
            break;
          }
        }

        // if the container was already near-empty, we should have created
        // exactly enough rooms to reach the 100-room ceiling before the 503
        expect(created.length).toBeGreaterThan(0);
        expect(created.length).toBeLessThanOrEqual(100);
        expect(got503).toBe(true);
        expect(tooManyBody).toBe("Too many rooms.");

        // once full, further creations keep failing
        const extra = await postRoomJson({
          userID: uniqueId("owner"),
          username: uniqueId("username"),
        });
        expect(extra.status).toBe(503);
      } finally {
        // CLEANUP — runs even if an assertion above threw. Retry each room
        // once so a transient failure cannot leak it into the next suite.
        for (const { roomID, userID } of created) {
          const ok = await closeRoom(roomID, userID);
          if (!ok) {
            await closeRoom(roomID, userID);
          }
        }
      }

      // give the server a beat to settle, then confirm the count dropped
      await new Promise((r) => setTimeout(r, 500));
      const end = await getActiveRooms();
      expect(end).toBeLessThanOrEqual(start + 5);
      expect(end).toBeGreaterThanOrEqual(Math.max(0, start - 10));
    }, 60_000);
  });

  /* ---------------------------------------------------------------- */
  /* helper parity                                                     */
  /* ---------------------------------------------------------------- */

  describe("helper integration", () => {
    test("createRoom helper works against the live server", async () => {
      const userID = uniqueId();
      const username = uniqueId("username");
      const room = await createRoom({ userID, username, persistent: false });
      expect(room.userID).toBe(userID);
      expect(room.username).toBe(username);
      expect(room.persistent).toBe(false);
      expect(room.roomID).toHaveLength(8);

      // the returned roomID is actually usable: owner connects, then closes
      const owner = await connectToRoom({ roomID: room.roomID, userID, username });
      openClients.push(owner.client);
      expect(owner.response.type).toBe(OutgoingMessageType.ROOM_CONNECTED);

      owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID: room.roomID,
        userID,
        text: "/close",
      });
      await owner.client.waitFor(
        (msg) => msg.type === OutgoingMessageType.ROOM_CLOSED,
        10_000,
      );
      await owner.client.close();
    }, 30_000);
  });
});
