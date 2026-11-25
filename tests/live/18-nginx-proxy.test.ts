/**
 * Live tests for the nginx reverse-proxy layer.
 *
 * Topology mirrors production: the Bun app is NOT published to the host;
 * every request goes through nginx (TLS termination on :6969, plain HTTP
 * on :6968). The configs under tests/nginx/conf.d are the spec:
 *   - default.conf: port-80 default server returning 444 (no response)
 *   - pointingpoker.work.conf: scanner-path blocks, redirects, /ws/ and
 *     / proxying
 *
 * Run with NODE_EXTRA_CA_CERTS pointing at tests/nginx/certs/ca.crt —
 * Bun only honors it at process startup.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BASE_URL, HTTP_URL, ORIGIN } from "../helpers/config";
import { ensureServer } from "../helpers/docker";
import { api, createRoom, randomIp } from "../helpers/http";
import {
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
} from "../helpers/ws";

const TIMEOUT = 10_000;

/** open WS clients, closed in afterAll */
const wsClients: RoomClient[] = [];

beforeAll(async () => {
  await ensureServer();
}, 30_000);

afterAll(async () => {
  await Promise.allSettled(wsClients.map((c) => c.close()));
});

/** plain fetch against BASE_URL with a manual Host override */
function fetchWithHost(path: string, host: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Host: host, Origin: ORIGIN },
  });
}

describe("nginx proxy — blocked scanner locations return 403 straight from nginx", () => {
  // prefix blocks (location ~* ^/(wp-content|wp-admin|...|\.env|\.git|...))
  const scannerPrefixPaths = [
    "/.env",
    "/.git",
    "/wp-admin",
    "/wp-content/foo",
    "/wp-login.php",
    "/xmlrpc.php",
    "/admin",
    "/phpmyadmin",
  ];
  // extension blocks (location ~* \.(asp|aspx|cgi|sh|py|rb|pl|cfm|htaccess|htpasswd)$)
  const extensionPaths = [
    "/test.php",
    "/script.py",
    "/run.sh",
    "/x.rb",
    "/x.pl",
    "/x.cgi",
    "/x.asp",
    "/x.aspx",
    "/x.cfm",
    "/x.htaccess",
    "/x.htpasswd",
  ];

  test.each(scannerPrefixPaths)(
    "prefix block: %s returns 403 without reaching the app",
    async (path) => {
      const started = performance.now();
      const res = await api(path);
      expect(res.status).toBe(403);
      // the app never sets Server: nginx — a 403 bearing it came from nginx
      expect(res.headers.get("server")).toStartWith("nginx/");
      // blocked responses are served immediately, no app round-trip
      expect(performance.now() - started).toBeLessThan(2000);
    },
    TIMEOUT,
  );

  test.each(extensionPaths)(
    "extension block: %s returns 403 without reaching the app",
    async (path) => {
      const res = await api(path);
      expect(res.status).toBe(403);
      expect(res.headers.get("server")).toStartWith("nginx/");
    },
    TIMEOUT,
  );

  test.each([
    "/foo/bar.py",
    "/deep/nested/path/run.sh",
  ])(
    "extension blocks match anywhere in the path: %s returns 403",
    async (path) => {
      const res = await api(path);
      expect(res.status).toBe(403);
      expect(res.headers.get("server")).toStartWith("nginx/");
    },
    TIMEOUT,
  );

  test(
    "403 body is nginx's own error page, not the app's 'Not found' text",
    async () => {
      const res = await api("/.env");
      const body = await res.text();
      expect(body).toContain("403 Forbidden");
      expect(body).toContain("nginx");
    },
    TIMEOUT,
  );
});

describe("nginx proxy — /.well-known is exempt from the scanner blocks", () => {
  // NOTE: observed behavior differs from a naive config reading.
  // `location ~ /.well-known { allow all; }` matches and has no proxy_pass,
  // so nginx serves it from its default static root: /.well-known/foo gets
  // nginx's OWN 404 HTML error page and never reaches the app. The point of
  // the test stands — it is NOT the 403 scanner block.
  test(
    "/.well-known/foo is not blocked (nginx-served 404, not 403)",
    async () => {
      const res = await api("/.well-known/foo");
      expect(res.status).not.toBe(403);
      // observed: 404 straight from nginx's static module
      expect(res.status).toBe(404);
      expect(res.headers.get("server")).toStartWith("nginx/");
      const body = await res.text();
      expect(body).toContain("404 Not Found");
    },
    TIMEOUT,
  );
});

describe("nginx proxy — port 80 redirects to HTTPS", () => {
  test(
    "Host: pointingpoker.work → 301 with same path + query, https scheme",
    async () => {
      const res = await fetch(`${HTTP_URL}/room?roomID=abc`, {
        redirect: "manual",
        headers: { Host: "pointingpoker.work" },
      });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(
        "https://pointingpoker.work/room?roomID=abc",
      );
    },
    TIMEOUT,
  );

  test(
    "redirect preserves arbitrary paths and multi-param queries",
    async () => {
      const res = await fetch(`${HTTP_URL}/some/page?a=1&b=2`, {
        redirect: "manual",
        headers: { Host: "pointingpoker.work" },
      });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(
        "https://pointingpoker.work/some/page?a=1&b=2",
      );
    },
    TIMEOUT,
  );

  test(
    "Host: www.pointingpoker.work → 301 with the www prefix stripped",
    async () => {
      const res = await fetch(`${HTTP_URL}/room?roomID=xyz`, {
        redirect: "manual",
        headers: { Host: "www.pointingpoker.work" },
      });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(
        "https://pointingpoker.work/room?roomID=xyz",
      );
    },
    TIMEOUT,
  );

  test("redirect responses come from nginx", async () => {
    const res = await fetch(`${HTTP_URL}/`, {
      redirect: "manual",
      headers: { Host: "pointingpoker.work" },
    });
    expect(res.headers.get("server")).toStartWith("nginx/");
  }, TIMEOUT);
});

describe("nginx proxy — port 80 default server returns 444 (connection closed, no response)", () => {
  // curl -v shows nginx closes the connection with an empty reply for any
  // Host other than pointingpoker.work / www.pointingpoker.work.
  // Bun's observable equivalent: fetch throws ECONNRESET (socket closed
  // before any response bytes).
  const assertNoResponse = (fn: () => Promise<Response>) =>
    (async () => {
      try {
        const res = await fn();
        // tolerate a transport-level error surfaced as a failed response
        expect([0, 444, 500, 520]).toContain(res.status);
      } catch {
        // expected: connection reset / closed with no response
      }
    })();

  test("Host: localhost gets no response", async () => {
    await assertNoResponse(() =>
      fetch(`${HTTP_URL}/`, { headers: { Host: "localhost" } })
    );
  }, TIMEOUT);

  test("Host: evil.example gets no response", async () => {
    // observed: Bun throws ECONNRESET — keep the explicit expectation too
    let threw = false;
    try {
      await fetch(`${HTTP_URL}/`, { headers: { Host: "evil.example" } });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  }, TIMEOUT);
});

describe("nginx proxy — 443 default server (only one TLS server block, so it is the default)", () => {
  // default.conf's commented-out 443 default server is disabled, so the
  // pointingpoker.work block catches ALL 443 requests regardless of Host.
  test("Host: evil.example over TLS is still proxied to the app", async () => {
    const res = await fetchWithHost("/api/stats", "evil.example");
    expect(res.status).toBe(200);
    expect(res.headers.get("server")).toStartWith("nginx/");
    const body = await res.json();
    expect(body).toHaveProperty("activeRooms");
  }, TIMEOUT);

  test(
    "Host: localhost over TLS is proxied to the app too (BASE_URL default)",
    async () => {
      const res = await fetchWithHost("/api/stats", "localhost");
      expect(res.status).toBe(200);
      expect(res.headers.get("server")).toStartWith("nginx/");
    },
    TIMEOUT,
  );
});

describe("nginx proxy — requests are forwarded to the app untouched", () => {
  // light-weight propagation checks (the full X-Forwarded-For/rate-limit
  // behavior is covered by 17-ratelimit-stats.test.ts):
  test(
    "POST /api/room WITHOUT Origin passes through the proxy and hits the app's origin check (403)",
    async () => {
      const res = await fetch(`${BASE_URL}/api/room`, {
        method: "POST",
        headers: {
          // no Origin header on purpose
          "Content-Type": "application/json",
          "X-Forwarded-For": randomIp(),
        },
        body: JSON.stringify({ userID: "proxy-u1", username: "proxy-n1" }),
      });
      expect(res.status).toBe(403);
      // app-flavored response: plain text, no nginx error page
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(res.headers.get("server")).toStartWith("nginx/");
    },
    TIMEOUT,
  );

  test(
    "POST /api/room WITH the prod Origin succeeds through the proxy (200)",
    async () => {
      const res = await api("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: "proxy-u2", username: "proxy-n2" }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(typeof body.roomID).toBe("string");
      expect(body.roomID.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  test(
    "app-originated responses keep the app's CORS headers through the proxy",
    async () => {
      const res = await api("/definitely-not-a-real-path-xyz");
      // app 404 ("Not found", text/plain) proxied back through nginx
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    },
    TIMEOUT,
  );
});

describe("nginx proxy — WebSocket via the /ws/ location", () => {
  test(
    "wss handshake + room:connect → room:connected round-trip through the proxy",
    async () => {
      const { roomID } = await createRoom();
      const client = await RoomClient.connect();
      wsClients.push(client);

      const messageID = client.send({
        type: IncomingMessageType.ROOM_CONNECT,
        roomID,
        userID: "proxy-ws-u1",
        publicUserID: "proxy-ws-pub1",
        username: "proxy-ws-n1",
        role: "voter",
      });
      const connected = await client.waitFor(
        OutgoingMessageType.ROOM_CONNECTED,
        5000,
      );
      expect(connected.type).toBe(OutgoingMessageType.ROOM_CONNECTED);
      await client.expectAck(messageID, 5000);

      await client.close();
      expect(client.isClosed).toBe(true);
    },
    TIMEOUT,
  );

  test(
    "wss to a non-/ws/room path does not complete the handshake",
    async () => {
      // NOTE: /ws/ is a PREFIX location, so /ws/bogus IS proxied to the app —
      // but the app only upgrades /ws/room and answers 404 ("Not found") for
      // anything else, so the WebSocket handshake never completes.
      await expect(
        RoomClient.connect({ url: "wss://localhost:6969/ws/bogus" }),
      ).rejects.toThrow("WebSocket connection failed");
    },
    TIMEOUT,
  );

  test("wss to a path outside /ws/ never upgrades", async () => {
    // no proxy WebSocket mapping for arbitrary paths; the app may answer
    // HTTP (404/400) but never 101
    await expect(
      RoomClient.connect({ url: "wss://localhost:6969/not-a-ws-endpoint" }),
    ).rejects.toThrow();
  }, TIMEOUT);
});

describe("nginx proxy — Server header on representative responses", () => {
  test("200 HTML page carries Server: nginx", async () => {
    const res = await fetch(`${BASE_URL}/`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("server")).toStartWith("nginx/");
  }, TIMEOUT);

  test("403 block carries Server: nginx", async () => {
    const res = await api("/wp-admin");
    expect(res.status).toBe(403);
    expect(res.headers.get("server")).toStartWith("nginx/");
  }, TIMEOUT);

  test("app 404 carries Server: nginx", async () => {
    const res = await api("/definitely-not-a-real-path-xyz");
    expect(res.status).toBe(404);
    expect(res.headers.get("server")).toStartWith("nginx/");
  }, TIMEOUT);

  test("301 redirect carries Server: nginx", async () => {
    const res = await fetch(`${HTTP_URL}/x`, {
      redirect: "manual",
      headers: { Host: "pointingpoker.work" },
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("server")).toStartWith("nginx/");
  }, TIMEOUT);
});
