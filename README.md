# Pointing Poker Web App

Check it out here: [pointingpoker.work](https://pointingpoker.work)

## Setup

Clone the repo

```sh
git clone git@github.com:ncpa0cpl/pointing-poker.git
```

Go into the repo directory

```sh
cd pointing-poker
```

Install dependencies

```sh
bun i
```

Build it

```sh
bun build:prod
```

Run it

```sh
bun start
```

## Testing

Tests run against a production-like Docker stack (see `Dockerfile`,
`docker-compose.test.yml`): a Bun app container (`NODE_ENV=production`, port
6969, prod env vars, logs in `/var/log/pp`) behind an nginx reverse proxy
container that mirrors the production nginx config — TLS termination, port-80
redirects, 444 default server, scanner-path blocks, `/ws/` upgrade handling.
All test traffic goes through the proxy (`https://localhost:6969`), so
proxy-related regressions (stripped headers, blocked paths, broken WS
upgrades) surface in the suite.

```sh
bun test:docker:up    # build & start the test stack (idempotent)
bun test:server       # server-side tests (bun:test, tests/live/**)
bun test:smoke        # frontend smoke tests (Playwright, tests/smoke/**)
bun test              # both
bun test:docker:down  # stop the stack
```

- `tests/TESTPLAN.md` — what is covered.
- `tests/helpers/` — shared docker/http/websocket helpers.
- `tests/nginx/` — proxy config mirrors + test CA/server certificate.
- `TEST_PORT` changes the host port for nginx's 443 (default 6969),
  `TEST_HTTP_PORT` for nginx's 80 (default 6968); helpers and Playwright
  pick them up automatically.
- TLS: the proxy uses a self-signed certificate signed by
  `tests/nginx/certs/ca.crt`; the `test:server` script sets
  `NODE_EXTRA_CA_CERTS` to it (must be set at process start), Playwright
  runs with `ignoreHTTPSErrors`. Run `bun test` ad hoc with
  `NODE_EXTRA_CA_CERTS=$PWD/tests/nginx/certs/ca.crt`.
- The app container persists rooms on its filesystem; `tests/live/16-*` will
  restart/recreate it, everything else assumes the stack is running.
