import { BASE_URL, ORIGIN } from "./config";

/**
 * The rate limiter keys clients on the X-Forwarded-For header. Each HTTP
 * client (or test file) uses its own unique IP so suites never trip the
 * limiter unintentionally.
 */
export function randomIp(): string {
  const a = 10 + Math.floor(Math.random() * 200);
  return `${a}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export type ApiInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  /** sent as X-Forwarded-For — the key the server's rate limiter uses */
  ip?: string;
};

export async function api(path: string, init: ApiInit = {}): Promise<Response> {
  const { ip = randomIp(), headers = {}, ...rest } = init;
  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      Origin: ORIGIN,
      "X-Forwarded-For": ip,
      ...headers,
    },
  });
}

export interface CreateRoomOptions {
  userID?: string;
  username?: string;
  persistent?: boolean;
}

export interface CreatedRoom {
  roomID: string;
  userID: string;
  username: string;
  persistent: boolean;
}

const counters = new Map<string, number>();
export function uniqueId(prefix = "user"): string {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  return `${prefix}-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * throws with the status code and response body text on failure
 */
export async function createRoom(
  opts: CreateRoomOptions = {},
): Promise<CreatedRoom> {
  const userID = opts.userID ?? uniqueId();
  const username = opts.username ?? uniqueId("username");
  const persistent = opts.persistent ?? false;

  const res = await api("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userID,
      username,
      ...(opts.persistent != null ? { persistent } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(
      `createRoom failed with ${res.status}: ${await res.text()}`,
    );
  }

  const body = (await res.json()) as { roomID: string };
  return { roomID: body.roomID, userID, username, persistent };
}
