# Pointing Poker — Test Plan

All tests run against the real server packaged in `Dockerfile` / `docker-compose.test.yml`
(a production-like Bun runtime, `NODE_ENV=production`, `PORT=6969`, prod env vars).
Server-side tests use `bun:test` (`tests/live/**`), frontend smoke tests use Playwright (`tests/smoke/**`).

Shared helpers (created once, used by every suite):

- `tests/helpers/docker.ts` — `ensureServer()`, `restartServer()`, `recreateServer()`, readiness polling.
- `tests/helpers/config.ts` — `BASE_URL`, `WS_URL`, `ORIGIN`, `TEST_PORT`.
- `tests/helpers/http.ts` — `api()` (adds `Origin` + unique `X-Forwarded-For` per client, required because the limiter keys on XFF and non-GET requests are 403'd without an allowed `Origin`), `createRoom()`.
- `tests/helpers/ws.ts` — `RoomClient` (Bun `WebSocket` wrapper with message inbox, `send()` with auto `messageID`, `waitFor(type|predicate, timeout)`, `expectAck()`), `connectToRoom()`, `setupRoom()`.

## Server surface under test

### HTTP endpoints

| Route                  | Notes                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/room`       | body: `{ userID, username, persistent? }`; 400 on invalid body; 503 "Too many rooms." at 100 active rooms                                                       |
| `GET /ws/room`         | WebSocket endpoint (upgrade)                                                                                                                                    |
| `GET /api/stats`       | usage stats, `Cache-Control: no-store`                                                                                                                          |
| `GET /sitemap.xml`     | uses `SITEMAP_URL`; 500 if unset                                                                                                                                |
| `GET /favicon.ico`     | 1h cache                                                                                                                                                        |
| `GET /public/*`        | static bundle, 30d cache + `must-revalidate`                                                                                                                    |
| `GET /` and SPA routes | `/join /notfound /register /room /about /stats /privacy /error /roomclosed /user` → respective `dist/public/*.html` or `index.html` fallback; other paths → 404 |
| OPTIONS                | CORS preflight; non-GET with disallowed/missing `Origin` → 403                                                                                                  |

### WebSocket incoming message types (`src/shared/websockets-messages/room-websocket-incoming-message-types.ts`)

1. `room:connect` — happy path (`room:connected` + full room view), empty/whitespace username → 422 error, unknown room → `room:closed`, reconnecting owner claims ownership, multi-tab (same `userID`, several sockets), duplicate connection object reuse.
2. `room:set-default-options` — owner only (401 error otherwise), updates default + in-progress round options, broadcast `room:update`.
3. `round:add-vote` — voter only; vote stored/replaced (one vote per user); unknown round id → ignored; unknown optionRef → handler crash → 500 error msg; round update broadcast to all clients; private mode sets `hideUsername`; non-connected user → 404 error.
4. `room:change-owner` — owner only; new owner must be a participant (404 otherwise); `room:owner-change` broadcast; non-owner → 401.
5. `room:post-message` — chat update broadcast; HTML escaping; system messages for join/leave/kick events; unknown room → 404 error.
6. `round:cancel` — owner only; removes in-progress round + system message + `room:update`.
7. `round:finish` — owner only; freezes round, computes `finalResult` (mean/mode/median/`N/A` cases), `round:update` broadcast.
8. `round:create` — owner only; finishes in-progress round if any, appends new round, system message + `room:update`.
9. `room:disconnect` — removes user, participants update + system message, ownership reassignment when owner leaves.

### Cross-cutting WS behavior

- `message:received` ack for every message carrying a `messageID` (even failures); **deduplication** of repeated `messageID`s.
- Malformed JSON / schema-invalid / binary messages → `connection:error` 500 ("Internal server error.", `causedBy: "unknown"` for unparseable ones).
- Messages referencing non-existent rooms → `connection:error` 404.
- Error shape: `{ type, code, message, causedBy }`.

### Text chat commands (`Room.handleMsgCommand`, messages starting with `/`)

| Command              | Who         | Effect                                  |
| -------------------- | ----------- | --------------------------------------- |
| `/transfer <name>`   | anyone      | owner change if username found          |
| `/vote <value>`      | voters only | adds vote with arbitrary value          |
| `/close`             | owner       | removes room, clients get `room:closed` |
| `/reset`             | owner       | wipes round history                     |
| `/clearchat`         | owner       | clears chat                             |
| `/setoptions a b c`  | owner       | replaces default options                |
| `/addoption <label>` | owner       | appends option (multi-word allowed)     |
| `/setmode private\\  | default`    | owner                                   | mode change, affects `hideUsername` |
| `/setrole voter\\    | viewer`     | anyone (self)                           | role change + system message; viewers can't vote |

- Unknown commands, owner commands by non-owner (no-op), `/vote` by viewer (ignored), `/transfer` to unknown name (no-op).

### Room lifecycle & persistence

- Participants list updates (`room:participants-change`), active/inactive flags per socket.
- Owner leaves → first remaining participant becomes owner; rejoining original owner reclaims it.
- Rooms survive **container restart** (rooms are persisted to `dist/persistent-storage` and reloaded on boot); persistent rooms keep data, reconnect works.
- Stale-room purge / 503 when 100 active rooms exist (cleanup: owner `/close`s rooms afterwards).

### Middleware / infra behavior

- Rate limiter: > `REQ_THRESHOLD` (1000) requests from one IP (keyed by `X-Forwarded-For`) within `LIMIT_TIMEFRAME` → 429; other IPs unaffected.
- Gzip for `Accept-Encoding: gzip` on text responses ≥256B.
- Cache headers: defaults (30 min) on API GETs, `no-store` on `/api/stats` & SPA, long max-age on `/public`, ETag/`If-None-Match` → 304.
- `maxRequestBodySize` 512KB → oversized POST rejected.
- `/api/stats` counters: rooms created, users, rounds completed, votes placed, per-day history.

## Smoke tests (Playwright, `tests/smoke/`)

1. **Full game round**: open `/`, register username, create room, room page shows room ID; second browser context joins by room ID; both vote different options; owner starts/finishes round; results visible.
2. **Navigation & room join**: `/`, `/about`, `/join` pages render; joining a nonexistent room id surfaces room-not-found/room-closed handling gracefully.

## Nginx reverse proxy (`tests/live/18-*`, `tests/nginx/`)

The test stack mirrors production topology: the Bun app is **not** published to
the host — every HTTP and WebSocket request goes through an nginx proxy
container (`nginx:1.27-alpine`) running the production server config verbatim
(`tests/nginx/conf.d/pointingpoker.work.conf` + default 444 server), with TLS
terminated by the repo's test CA (`tests/nginx/certs/ca.crt`, `NODE_EXTRA_CA_CERTS`
is set by the `test:server` script). Covered:

- Scanner-path / script-extension blocks → 403 (straight from nginx, app never sees them)
- Port 80: `pointingpoker.work` → 301 HTTPS preserving path+query, `www.` stripped, any other Host → 444 (connection closed, no response)
- 443: `pointingpoker.work` block is also the implicit default server
- `/ws/` upgrade location: full WS handshake over `wss://` through the proxy
- `Server: nginx` header, `X-Forwarded-For` appending (rate limiter keys through the proxy), app origin-check 403 passthrough
- TLS certificate actually verified against the committed test CA
