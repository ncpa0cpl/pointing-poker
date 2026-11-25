import { beforeAll, describe, expect, test } from "bun:test";
import { BASE_URL, ORIGIN } from "../helpers/config";
import { ensureServer } from "../helpers/docker";
import { api } from "../helpers/http";

const SPA_ROUTES = [
  "/",
  "/join",
  "/notfound",
  "/register",
  "/room",
  "/about",
  "/stats",
  "/privacy",
  "/error",
  "/roomclosed",
  "/user",
];

describe("http static surface", () => {
  beforeAll(async () => {
    await ensureServer();
  });

  describe("SPA routes", () => {
    test("all known routes return 200 html", async () => {
      for (const route of SPA_ROUTES) {
        const res = await api(route);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/html");
        const body = await res.text();
        expect(body).toContain("<html");
      }
    }, 15_000);

    test("trailing slash variants work", async () => {
      const res = await api("/join/");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    test("sub-path under a SPA route is NOT a SPA route -> 404", async () => {
      const res = await api("/room/abc123");
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
    });
  });

  describe("404s", () => {
    test("unknown path returns 404 'Not found'", async () => {
      const res = await api("/definitely-not-a-real-path");
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(await res.text()).toBe("Not found");
    });

    test("unknown method on known path -> 404", async () => {
      const res = await api("/api/room", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("static files", () => {
    test("favicon.ico returns an image with 1h cache", async () => {
      const res = await api("/favicon.ico");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/");
      expect(parseInt(res.headers.get("content-length") ?? "0")).toBeGreaterThan(0);
      expect(res.headers.get("cache-control")).toContain("max-age=3600");
    });

    test("/public/index.html has 30d must-revalidate cache and an ETag", async () => {
      const res = await api("/public/index.html");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      // NOTE: observed — the real value includes a `public` prefix.
      expect(res.headers.get("cache-control")).toBe(
        "public, max-age=2592000, must-revalidate",
      );
      expect(res.headers.get("etag")).toBeTruthy();
    });

    test("If-None-Match with the ETag yields 304", async () => {
      const first = await api("/public/index.html");
      const etag = first.headers.get("etag")!;
      expect(etag).toBeTruthy();

      const second = await api("/public/index.html", {
        headers: { "If-None-Match": etag },
      });
      expect(second.status).toBe(304);
      expect((await second.arrayBuffer()).byteLength).toBe(0);
    });
  });

  describe("sitemap", () => {
    test("returns XML with all three URLs and lastmod stamps", async () => {
      const res = await api("/sitemap.xml");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("xml");
      const body = await res.text();
      expect(body).toContain("<urlset");
      expect(body).toContain("<loc>https://pointingpoker.work</loc>");
      expect(body).toContain("<loc>https://pointingpoker.work/about</loc>");
      expect(body).toContain("<loc>https://pointingpoker.work/privacy</loc>");
      expect(body).toContain("<lastmod>");
    });
  });

  describe("cache headers", () => {
    // NOTE: observed — SPA routes send `Cache-Control: no-store`, not the
    // default max-age=1800 the source suggests; the default only shows up on
    // 404s and the sitemap.
    test("SPA routes are no-store", async () => {
      const res = await api("/about");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });

    test("404 responses use the default max-age=1800", async () => {
      const res = await api("/nope-nope");
      expect(res.headers.get("cache-control")).toBe("public, max-age=1800");
    });

    test("/api/stats is no-store", async () => {
      const res = await api("/api/stats");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("gzip", () => {
    // NOTE: Bun's fetch decompresses gzip responses transparently while still
    // exposing the Content-Encoding header, so we assert the header and that
    // the (decompressed) body is valid html.
    test("html responses >= 256 bytes are gzipped with Accept-Encoding", async () => {
      const res = await api("/about", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBe("gzip");
      const body = await res.text();
      expect(body).toContain("<html");
    });

    test("no gzip when the client asks for identity", async () => {
      // NOTE: Bun's fetch always injects `Accept-Encoding: gzip` unless we
      // override it, so "no encoding" is asserted with an explicit identity.
      const res = await api("/about", {
        headers: { "Accept-Encoding": "identity" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBeNull();
    });

    test("small responses (< 256 bytes) are not gzipped", async () => {
      const res = await api("/definitely-not-a-real-path", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-encoding")).toBeNull();
    });

    test("non-text content types (favicon) are not gzipped", async () => {
      const res = await api("/favicon.ico", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBeNull();
    });

    test("application/json is gzipped", async () => {
      const res = await api("/api/stats", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBe("gzip");
      const body = await res.text();
      expect(JSON.parse(body)).toBeInstanceOf(Object);
    });
  });

  describe("CORS", () => {
    // NOTE: observed — only preflight (OPTIONS) responses carry
    // `Vary: Origin` and `Access-Control-Allow-Methods`; plain GET responses
    // only get `Access-Control-Allow-Origin` when the origin is allowed, and
    // a disallowed origin gets NO ACAO header at all (not `*`).
    test("GET with allowed origin gets Access-Control-Allow-Origin", async () => {
      const res = await api("/");
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    });

    test("GET with disallowed origin gets 200 and no ACAO", async () => {
      const res = await api("/", {
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("GET without Origin gets 200 and no ACAO", async () => {
      // raw fetch: the api() helper always injects Origin
      const res = await fetch(`${BASE_URL}/`, {
        headers: { "X-Forwarded-For": "10.200.0.1" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("OPTIONS preflight returns 204 with allow headers", async () => {
      const res = await api("/", { method: "OPTIONS" });
      expect(res.status).toBe(204);
      expect(res.headers.get("vary")).toContain("Origin");
      expect(res.headers.get("access-control-allow-methods")).toBeTruthy();
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect((await res.arrayBuffer()).byteLength).toBe(0);
    });

    test("OPTIONS with disallowed origin: 204 but no ACAO", async () => {
      const res = await api("/", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-methods")).toBeTruthy();
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("OPTIONS works even without Origin header", async () => {
      const res = await fetch(`${BASE_URL}/`, {
        method: "OPTIONS",
        headers: { "X-Forwarded-For": "10.200.0.2" },
      });
      expect(res.status).toBe(204);
    });

    test("preflight is handled globally, even on unknown paths", async () => {
      const res = await api("/no-such-path", { method: "OPTIONS" });
      expect(res.status).toBe(204);
    });

    test("non-GET with disallowed Origin -> 403", async () => {
      const res = await api("/api/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });

    test("non-GET without any Origin -> 403", async () => {
      const res = await fetch(`${BASE_URL}/api/room`, {
        method: "POST",
        headers: {
          "X-Forwarded-For": "10.200.0.3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });
  });
});
