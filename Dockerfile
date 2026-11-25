# Production-like image for the pointing-poker server.

# ---------- build stage ----------
FROM oven/bun:1.4.5 AS builder

# git is required by scripts/build.mjs (`git rev-parse HEAD`)
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lockb ./
# --ignore-scripts: the `prepare` script (husky) needs a .git checkout, and
# no dependency in the image needs its install scripts
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

# build.mjs embeds the git hash into the bundle; create a repo for it
RUN git init -q \
  && git config user.email "build@localhost" \
  && git config user.name "build" \
  && git add -A \
  && git commit -qm "build"

# SENTRY_DSN is baked into the client bundle at build time, like in prod;
# a dummy value is fine here since the build skips sentry uploads without
# an auth token.
RUN NODE_ENV=production \
    SENTRY_DSN="https://testkey@o000000.ingest.sentry.io/0000000" \
    bun ./scripts/build.mjs

# ---------- runtime stage ----------
FROM oven/bun:1.4.5

ENV NODE_ENV=production \
    PORT=6969 \
    HOSTNAMES=https://pointingpoker.work,http://localhost:6969 \
    FORCE_TLS=false \
    TLS_CERT= \
    TLS_KEY= \
    LOG_DIR=/var/log/pp \
    DEBUG=0 \
    LOGLEVEL= \
    SITEMAP_URL=https://pointingpoker.work \
    REQ_THRESHOLD=1000 \
    REQ_LIMIT=40000 \
    LIMIT_TIMEFRAME=120000

WORKDIR /var/www/pointing-poker

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN useradd --create-home --shell /bin/false bun_server \
  && mkdir -p /var/log/pp /var/www/pointing-poker/dist/persistent-storage \
  && chown -R bun_server:bun_server /var/log/pp /var/www/pointing-poker

USER bun_server

EXPOSE 6969

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 \
  CMD bun -e "fetch('http://127.0.0.1:6969/api/stats').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "src/server/start.ts"]
