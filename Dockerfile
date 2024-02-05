FROM oven/bun:alpine

# update and install node (needed for build step)
RUN apk add nodejs npm

WORKDIR /usr/src/app

ENV NODE_ENV production

COPY package.json bun.lockb tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
RUN bun install
RUN bun build:prod

CMD [ "bun", "start" ]