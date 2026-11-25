/**
 * Live tests for the GLOBAL request limit (maxOverallRequests / REQ_LIMIT).
 *
 * Runs after 18-nginx and before 20-retired-rooms. The test container runs
 * with REQ_LIMIT=5000 — low enough to exhaust, high enough that the rest of
 * the suite never comes near it within any LIMIT_TIMEFRAME window.
 *
 * The per-IP threshold (REQ_THRESHOLD=1000) trips long before the global one,
 * so the flood IP starts seeing per-IP 429s after ~1000 requests; those still
 * count towards the global counter, which is why a single IP can exhaust it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureServer, restartServer } from "../helpers/docker";
import { api, randomIp } from "../helpers/http";

/**
 * Dedicated IP for the flood. Never used by any other request in this file
 * so the per-IP and global counters stay attributable.
 */
const FLOOD_IP = randomIp();

const BATCH = 100;
// REQ_LIMIT=5000 plus whatever baseline traffic the earlier suites left in
// the current timeframe window — 5500 covers it with headroom
const MAX_REQUESTS = 5500;

describe("global request limit (maxOverallRequests)", () => {
  beforeAll(async () => {
    await ensureServer();
  }, 30_000);

  test(
    "once the global counter exceeds REQ_LIMIT, requests from IPs that never flooded also get 429 with statusText 'Too Many Requests' and a 'server overloaded' body",
    async () => {
      let globallyLimited = false;
      let attempts = 0;

      // flood until a FRESH IP gets 429 — the global limit is the only thing
      // that can limit an IP with no per-IP history
      outer: for (let sent = 0; sent < MAX_REQUESTS; sent += BATCH) {
        const batch = await Promise.all(
          Array.from(
            { length: BATCH },
            () => api("/api/stats", { ip: FLOOD_IP }),
          ),
        );
        attempts += BATCH;
        for (const res of batch) {
          await res.text(); // drain — per-IP 429s en route are expected
        }
        if ((sent / BATCH) % 10 === 9) {
          const probe = await api("/api/stats", { ip: randomIp() });
          await probe.text();
          if (probe.status === 429) {
            globallyLimited = true;
            break outer;
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `[global-limit] global 429 reached after ~${attempts} flooded requests (REQ_LIMIT=5000)`,
      );
      expect(globallyLimited).toBe(true);

      // the global limit is IP-independent: a fresh IP with no per-IP
      // history is limited too
      const firstVictim = await api("/api/stats", { ip: randomIp() });
      expect(firstVictim.status).toBe(429);
      expect(firstVictim.statusText).toBe("Too Many Requests");
      const firstBody = await firstVictim.text();
      expect(firstBody).toContain("server overloaded");

      const secondVictim = await api("/api/stats", { ip: randomIp() });
      expect(secondVictim.status).toBe(429);
      await secondVictim.text();
    },
    420_000,
  );

  /**
   * The global counter only decays via per-request timeouts (120s), which
   * would 429 everything that runs after this file (including the Playwright
   * smoke suite, which hits /api/stats in beforeEach). A restart resets the
   * in-memory limiter.
   */
  afterAll(async () => {
    await restartServer();
    const res = await api("/api/stats", { ip: randomIp() });
    expect(res.status).toBe(200);
    await res.text();
  }, 120_000);
});
