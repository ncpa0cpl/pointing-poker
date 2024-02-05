FROM oven/bun

WORKDIR /usr/src/app

ENV NODE_ENV production

COPY package*.json bun.lockb ./
RUN bun install
RUN bun build:prod
COPY . .

CMD [ "bun", "start" ]