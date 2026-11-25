import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import { api, uniqueId } from "../helpers/http";
import {
  type ConnectedUser,
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
} from "../helpers/ws";

const clients: RoomClient[] = [];

function track<T>(user: T & { client?: RoomClient; owner?: ConnectedUser }): T {
  const client = user.client ?? user.owner?.client;
  if (client) {
    clients.push(client);
  }
  return user;
}

/** votes via round:add-vote and waits for the ack */
async function castVote(
  roomID: string,
  roundID: string,
  voter: ConnectedUser,
  optionID: string,
): Promise<void> {
  const mid = voter.client.send({
    type: IncomingMessageType.ADD_ROUND_VOTE,
    roomID,
    userID: voter.userID,
    roundID,
    optionRef: optionID,
  });
  await voter.client.expectAck(mid);
}

function optionIDByName(
  user: ConnectedUser,
  name: string,
): string {
  const opt = user.response.room.defaultOptions.find((o) => o.name === name);
  if (!opt) {
    throw new Error(`option "${name}" not present in default options`);
  }
  return opt.id;
}

const isRoomUpdate = (m: { type: string }): boolean =>
  m.type === OutgoingMessageType.ROOM_UPDATE;
const isChatUpdate = (m: { type: string }): boolean =>
  m.type === OutgoingMessageType.ROOM_CHAT_UPDATE;
const isOwnerUpdate = (m: { type: string }): boolean =>
  m.type === OutgoingMessageType.OWNER_UPDATE;

/** the two usage gauges the double-finish test watches for re-counting */
async function fetchUsageGauge(): Promise<{
  thisMonthRounds: number;
  thisMonthVotes: number;
}> {
  const res = await api("/api/stats");
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  return {
    thisMonthRounds: body.thisMonthRounds as number,
    thisMonthVotes: body.thisMonthVotes as number,
  };
}

describe("owner-only actions and round statistics", () => {
  beforeAll(async () => {
    await ensureServer();
  });

  afterAll(async () => {
    await Promise.allSettled(clients.map((c) => c?.close?.()));
  });

  describe("round:create", () => {
    test("owner appends a fresh in-progress round", async () => {
      const { roomID, owner, username } = track(
        await setupRoom({ username: "create-owner" }),
      );

      const initialCount = owner.response.room.rounds.length;
      expect(initialCount).toBe(1);

      const mid = owner.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: owner.userID,
      });

      const update = await owner.client.waitFor(
        (m) => isRoomUpdate(m) && m.rounds.length === initialCount + 1,
      );

      const newRound = update.rounds.at(-1)!;
      expect(newRound.isInProgress).toBe(true);
      expect(newRound.hasResults).toBe(false);
      expect(newRound.results).toEqual([]);
      expect(newRound.finalResult).toBeUndefined();
      // fresh round carries the room's default options
      expect(newRound.options).toEqual(update.defaultOptions);

      const chat = await owner.client.waitFor(isChatUpdate);
      expect(chat.chatMessages.at(-1)!.text).toBe(
        `New round was started by ${username}.`,
      );

      await owner.client.expectAck(mid);
    }, 15_000);

    test(
      "owner starting a round finishes the in-progress round first",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "create-finish-owner" }),
        );
        const voter = track(
          await connectToRoom({ roomID, username: "cv-voter" }),
        );

        const roundID = owner.response.room.rounds.at(-1)!.id;
        await castVote(roomID, roundID, voter, optionIDByName(owner, "8"));
        await owner.client.waitFor(
          (m) =>
            m.type === OutgoingMessageType.ROUND_UPDATE
            && m.results.length === 1,
        );

        const mid = owner.client.send({
          type: IncomingMessageType.CREATE_NEW_ROUND,
          roomID,
          userID: owner.userID,
        });

        const update = await voter.client.waitFor(
          (m) => isRoomUpdate(m) && m.rounds.length === 2,
        );

        // the previously in-progress round was finished, votes preserved
        const finishedRound = update.rounds[0]!;
        expect(finishedRound.isInProgress).toBe(false);
        expect(finishedRound.finalResult).toEqual({
          votes: 1,
          mean: "8.00",
          median: "8",
          mode: "8",
        });

        // ...and a new empty round is now active
        const newRound = update.rounds.at(-1)!;
        expect(newRound.isInProgress).toBe(true);
        expect(newRound.hasResults).toBe(false);

        // NOTE: unlike round:finish, round:create broadcasts no standalone
        // round:update for the auto-finished round — the finished state is only
        // visible inside the room:update payload.
        await owner.client.expectAck(mid);
      },
      15_000,
    );

    test("non-owner gets 401", async () => {
      const { roomID } = track(
        await setupRoom({ username: "create-401-owner" }),
      );
      const voter = track(await connectToRoom({ roomID, username: "cv-401" }));

      const mid = voter.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: voter.userID,
      });
      const err = await voter.client.expectError(mid);
      expect(err.code).toBe(401);
      expect(err.message).toBe(
        "Unauthorized access. Only room owner can perform round:create action.",
      );

      // room state untouched (a 401 broadcasts nothing, so probe fresh state)
      const probe = track(await connectToRoom({ roomID }));
      expect(probe.response.room.rounds.length).toBe(1);
    }, 15_000);
  });

  describe("round:finish statistics", () => {
    test("finalResult: votes/mean/median/mode of numeric votes", async () => {
      const { roomID, owner } = track(
        await setupRoom({ username: "finish-owner" }),
      );
      const voterA = track(await connectToRoom({ roomID, username: "fv-a" }));
      const voterB = track(await connectToRoom({ roomID, username: "fv-b" }));
      const voterC = track(await connectToRoom({ roomID, username: "fv-c" }));

      const roundID = owner.response.room.rounds.at(-1)!.id;
      await castVote(roomID, roundID, voterA, optionIDByName(owner, "8"));
      await castVote(roomID, roundID, voterB, optionIDByName(owner, "8"));
      await castVote(roomID, roundID, voterC, optionIDByName(owner, "13"));
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROUND_UPDATE && m.results.length === 3,
      );

      const mid = owner.client.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        roomID,
        userID: owner.userID,
      });

      const update = await voterA.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROUND_UPDATE && !m.isInProgress,
      );

      expect(update.finalResult).toEqual({
        votes: 3,
        mean: "9.67", // (8 + 8 + 13) / 3 = 9.666...
        median: "8", // odd count -> middle value as integer string
        mode: "8",
      });
      expect(update.isInProgress).toBe(false);

      await owner.client.expectAck(mid);
    }, 15_000);

    test(
      "mode tie renders as '8, 13' and non-numeric votes are excluded",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "tie-owner" }),
        );
        const voterA = track(await connectToRoom({ roomID, username: "tv-a" }));
        const voterB = track(await connectToRoom({ roomID, username: "tv-b" }));
        const voterC = track(await connectToRoom({ roomID, username: "tv-c" }));

        const roundID = owner.response.room.rounds.at(-1)!.id;
        await castVote(roomID, roundID, voterA, optionIDByName(owner, "8"));
        await castVote(roomID, roundID, voterB, optionIDByName(owner, "13"));

        // non-numeric vote via chat command — must not count into the stats
        const chatMid = voterC.client.send({
          type: IncomingMessageType.POST_MESSAGE,
          roomID,
          userID: voterC.userID,
          text: "/vote ?",
        });
        await voterC.client.expectAck(chatMid);

        await owner.client.waitFor(
          (m) =>
            m.type === OutgoingMessageType.ROUND_UPDATE
            && m.results.length === 3,
        );

        const mid = owner.client.send({
          type: IncomingMessageType.FINISH_LAST_ROUND,
          roomID,
          userID: owner.userID,
        });

        const update = await voterA.client.waitFor(
          (m) => m.type === OutgoingMessageType.ROUND_UPDATE && !m.isInProgress,
        );

        // votes: 8, 13, "?" -> only the two numeric votes count
        expect(update.finalResult).toEqual({
          votes: 2,
          mean: "10.50", // even count -> average of middle two, 2 decimals
          median: "10.50",
          mode: "8, 13", // tie -> "first, rest"
        });

        await owner.client.expectAck(mid);
      },
      15_000,
    );

    test("no votes at all -> N/A placeholders", async () => {
      const { roomID, owner } = track(
        await setupRoom({ username: "empty-owner" }),
      );

      const mid = owner.client.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        roomID,
        userID: owner.userID,
      });

      const update = await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROUND_UPDATE && !m.isInProgress,
      );

      expect(update.finalResult).toEqual({
        votes: 0,
        mean: "N/A",
        median: "N/A",
        mode: "N/A",
      });

      await owner.client.expectAck(mid);
    }, 15_000);

    test("non-owner gets 401", async () => {
      const { roomID } = track(
        await setupRoom({ username: "finish-401-owner" }),
      );
      const voter = track(await connectToRoom({ roomID, username: "fv-401" }));

      const mid = voter.client.send({
        type: IncomingMessageType.FINISH_LAST_ROUND,
        roomID,
        userID: voter.userID,
      });
      const err = await voter.client.expectError(mid);
      expect(err.code).toBe(401);
      expect(err.message).toBe(
        "Unauthorized access. Only room owner can perform round:finish action.",
      );

      // round still in progress
      const probe = track(await connectToRoom({ roomID }));
      expect(probe.response.room.rounds.at(-1)!.isInProgress).toBe(true);
    }, 15_000);
  });

  describe("round:cancel", () => {
    test("owner removes the in-progress round", async () => {
      const { roomID, owner, username } = track(
        await setupRoom({ username: "cancel-owner" }),
      );
      const voter = track(
        await connectToRoom({ roomID, username: "cancel-voter" }),
      );

      expect(owner.response.room.rounds.length).toBe(1);

      const mid = owner.client.send({
        type: IncomingMessageType.CANCEL_LAST_ROUND,
        roomID,
        userID: owner.userID,
      });

      const update = await voter.client.waitFor(
        (m) => isRoomUpdate(m) && m.rounds.length === 0,
      );
      expect(update.rounds).toEqual([]);

      const chat = await voter.client.waitFor(isChatUpdate);
      expect(chat.chatMessages.at(-1)!.text).toBe(
        `Round was cancelled by ${username}.`,
      );

      await owner.client.expectAck(mid);
    }, 15_000);

    test("non-owner gets 401", async () => {
      const { roomID } = track(
        await setupRoom({ username: "cancel-401-owner" }),
      );
      const voter = track(await connectToRoom({ roomID, username: "cv-401" }));

      const mid = voter.client.send({
        type: IncomingMessageType.CANCEL_LAST_ROUND,
        roomID,
        userID: voter.userID,
      });
      const err = await voter.client.expectError(mid);
      expect(err.code).toBe(401);
      expect(err.message).toBe(
        "Unauthorized access. Only room owner can perform round:cancel action.",
      );

      // round untouched
      const probe = track(await connectToRoom({ roomID }));
      expect(probe.response.room.rounds.length).toBe(1);
    }, 15_000);
  });

  describe("room:set-default-options", () => {
    test(
      "owner replaces default options and the in-progress round's options",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "options-owner" }),
        );
        const voter = track(
          await connectToRoom({ roomID, username: "ov-voter" }),
        );

        const oldIDs = owner.response.room.defaultOptions.map((o) => o.id);

        const mid = owner.client.send({
          type: IncomingMessageType.SET_DEFAULT_OPTIONS,
          roomID,
          userID: owner.userID,
          options: ["1", "2", "3"],
        });

        const update = await voter.client.waitFor(
          (m) => isRoomUpdate(m) && m.defaultOptions.length === 3,
        );

        expect(update.defaultOptions.map((o) => o.name)).toEqual([
          "1",
          "2",
          "3",
        ]);
        // new RoundOptions get fresh ids
        for (const opt of update.defaultOptions) {
          expect(oldIDs).not.toContain(opt.id);
        }

        // the still in-progress round uses the new options as well
        const lastRound = update.rounds.at(-1)!;
        expect(lastRound.isInProgress).toBe(true);
        expect(lastRound.options.map((o) => o.id)).toEqual(
          update.defaultOptions.map((o) => o.id),
        );

        await owner.client.expectAck(mid);
      },
      15_000,
    );

    test("non-owner gets 401", async () => {
      const { roomID, owner } = track(
        await setupRoom({ username: "options-401-owner" }),
      );
      const voter = track(await connectToRoom({ roomID, username: "ov-401" }));

      const mid = voter.client.send({
        type: IncomingMessageType.SET_DEFAULT_OPTIONS,
        roomID,
        userID: voter.userID,
        options: ["x"],
      });
      const err = await voter.client.expectError(mid);
      expect(err.code).toBe(401);
      expect(err.message).toBe(
        "Unauthorized access. Only room owner can perform room:set-default-options action.",
      );

      // default options unchanged
      const probe = track(await connectToRoom({ roomID }));
      expect(probe.response.room.defaultOptions.map((o) => o.name)).toEqual(
        owner.response.room.defaultOptions.map((o) => o.name),
      );
    }, 15_000);
  });

  describe("room:change-owner", () => {
    test(
      "owner transfers ownership; new owner gains owner powers",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "transfer-owner" }),
        );
        const voter = track(
          await connectToRoom({ roomID, username: "new-owner" }),
        );

        // non-owner cannot transfer ownership
        const badMid = voter.client.send({
          type: IncomingMessageType.CHANGE_OWNER,
          roomID,
          userID: voter.userID,
          newOwnerID: voter.userID,
        });
        const badErr = await voter.client.expectError(badMid);
        expect(badErr.code).toBe(401);
        expect(badErr.message).toBe(
          "Unauthorized access. Only room owner can perform room:change-owner action.",
        );

        const mid = owner.client.send({
          type: IncomingMessageType.CHANGE_OWNER,
          roomID,
          userID: owner.userID,
          newOwnerID: voter.userID,
        });

        const ownerChange = await voter.client.waitFor(isOwnerUpdate);
        expect(ownerChange.ownerName).toBe(voter.username);
        expect(ownerChange.ownerPublicID).toBe(voter.publicUserID);
        expect(ownerChange.ownerRole).toBe("voter");

        const ownerChangeForOldOwner = await owner.client.waitFor(
          isOwnerUpdate,
        );
        expect(ownerChangeForOldOwner.ownerName).toBe(voter.username);

        await owner.client.expectAck(mid);

        // the new owner can now create rounds...
        const createMid = voter.client.send({
          type: IncomingMessageType.CREATE_NEW_ROUND,
          roomID,
          userID: voter.userID,
        });
        const update = await owner.client.waitFor(
          (m) => isRoomUpdate(m) && m.rounds.length === 2,
        );
        expect(update.rounds.at(-1)!.isInProgress).toBe(true);
        await voter.client.expectAck(createMid);

        // ...while the previous owner lost the power
        const oldMid = owner.client.send({
          type: IncomingMessageType.CREATE_NEW_ROUND,
          roomID,
          userID: owner.userID,
        });
        const err = await owner.client.expectError(oldMid);
        expect(err.code).toBe(401);
        expect(err.message).toBe(
          "Unauthorized access. Only room owner can perform round:create action.",
        );
      },
      15_000,
    );

    test("unknown newOwnerID gets 404", async () => {
      const { roomID, owner } = track(
        await setupRoom({ username: "co-404-owner" }),
      );

      const mid = owner.client.send({
        type: IncomingMessageType.CHANGE_OWNER,
        roomID,
        userID: owner.userID,
        newOwnerID: "no-such-user-id",
      });
      const err = await owner.client.expectError(mid);
      expect(err.code).toBe(404);
      expect(err.message).toBe(
        "RoomConnection with userID no-such-user-id not found.",
      );
    }, 15_000);
  });

  describe("unknown roomID", () => {
    test("owner-action messages for a missing room get 404", async () => {
      // room:connect to a missing room answers room:closed (the helper throws
      // and closes the socket), so use a bare socket for the spot-check
      let client: RoomClient;
      try {
        client = (await connectToRoom({ roomID: "no-such-room" })).client;
        clients.push(client);
      } catch {
        client = await RoomClient.connect();
        clients.push(client);
      }

      const cases: Array<[IncomingMessageType, Record<string, unknown>]> = [
        [IncomingMessageType.CREATE_NEW_ROUND, {}],
        [IncomingMessageType.FINISH_LAST_ROUND, {}],
        [IncomingMessageType.CANCEL_LAST_ROUND, {}],
        [IncomingMessageType.SET_DEFAULT_OPTIONS, { options: ["1"] }],
        [IncomingMessageType.CHANGE_OWNER, { newOwnerID: "whatever" }],
      ];

      for (const [type, extra] of cases) {
        const mid = client.send(
          {
            type,
            roomID: "no-such-room",
            userID: "some-user",
            ...extra,
          } as Parameters<RoomClient["send"]>[0],
        );
        const err = await client.expectError(mid);
        expect(err.code).toBe(404);
        expect(err.message).toBe("Room with id no-such-room not found.");
        await client.expectAck(mid);
      }
    }, 15_000);
  });

  describe("empty-rounds edge cases (rounds list can be empty)", () => {
    /** cancels the room's only round; resolves once the owner observed an empty rounds list */
    async function cancelOnlyRound(
      roomID: string,
      owner: ConnectedUser,
    ): Promise<void> {
      const mid = owner.client.send({
        type: IncomingMessageType.CANCEL_LAST_ROUND,
        roomID,
        userID: owner.userID,
      });
      await owner.client.waitFor(
        (m) => isRoomUpdate(m) && m.rounds.length === 0,
      );
      await owner.client.expectAck(mid);
    }

    test(
      "round:add-vote into an empty rounds list is acked but broadcasts no round:update and materializes no phantom round",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "void-vote-owner" }),
        );
        await cancelOnlyRound(roomID, owner);

        const mid = owner.client.send({
          type: IncomingMessageType.ADD_ROUND_VOTE,
          roomID,
          userID: owner.userID,
          roundID: "no-such-round",
          optionRef: owner.response.room.defaultOptions[0]!.id,
        });
        await owner.client.expectAck(mid);

        let phantomBroadcast = false;
        try {
          await owner.client.waitFor(
            (m) => isRoomUpdate(m) && m.rounds.length > 0,
            1200,
          );
          phantomBroadcast = true;
        } catch {
          // expected: nothing materialized
        }
        expect(phantomBroadcast).toBe(false);

        const probe = track(await connectToRoom({ roomID }));
        expect(probe.response.room.rounds.length).toBe(0);
      },
      15_000,
    );

    test(
      "round:finish into an empty rounds list is acked but broadcasts no round:update and materializes no phantom round",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "void-finish-owner" }),
        );
        await cancelOnlyRound(roomID, owner);

        const mid = owner.client.send({
          type: IncomingMessageType.FINISH_LAST_ROUND,
          roomID,
          userID: owner.userID,
        });
        await owner.client.expectAck(mid);

        let phantomBroadcast = false;
        try {
          await owner.client.waitFor(
            (m) => isRoomUpdate(m) && m.rounds.length > 0,
            1200,
          );
          phantomBroadcast = true;
        } catch {
          // expected: nothing materialized
        }
        expect(phantomBroadcast).toBe(false);

        const probe = track(await connectToRoom({ roomID }));
        expect(probe.response.room.rounds.length).toBe(0);
      },
      15_000,
    );

    test(
      "round:cancel on an already-empty rounds list is acked but posts no second 'Round was cancelled' chat message and keeps 0 rounds",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "void-cancel-owner" }),
        );
        await cancelOnlyRound(roomID, owner);

        const mid = owner.client.send({
          type: IncomingMessageType.CANCEL_LAST_ROUND,
          roomID,
          userID: owner.userID,
        });
        await owner.client.expectAck(mid);

        // the sentinel pins down the chat state observed after the void cancel
        const sentinelText = uniqueId("void-cancel-sentinel");
        owner.client.send({
          type: IncomingMessageType.POST_MESSAGE,
          roomID,
          userID: owner.userID,
          text: sentinelText,
        });
        const sentinel = await owner.client.waitFor(
          (m) =>
            isChatUpdate(m) && m.chatMessages.at(-1)?.text === sentinelText,
        );
        expect(
          sentinel.chatMessages.filter((m) =>
            m.text.startsWith("Round was cancelled")
          ).length,
        ).toBe(1);

        const probe = track(await connectToRoom({ roomID }));
        expect(probe.response.room.rounds.length).toBe(0);
      },
      15_000,
    );

    test(
      "round:create on an empty rounds list yields exactly ONE fresh in-progress round (no phantom create-then-finish round)",
      async () => {
        const { roomID, owner } = track(
          await setupRoom({ username: "void-create-owner" }),
        );
        await cancelOnlyRound(roomID, owner);

        const mid = owner.client.send({
          type: IncomingMessageType.CREATE_NEW_ROUND,
          roomID,
          userID: owner.userID,
        });
        await owner.client.expectAck(mid);

        const probe = track(await connectToRoom({ roomID }));
        expect(probe.response.room.rounds.length).toBe(1);
        expect(probe.response.room.rounds[0]!.isInProgress).toBe(true);
      },
      15_000,
    );

    test(
      "a second round:finish on an already-finished round must not re-count usage: thisMonthRounds/thisMonthVotes stay put and finalResult is unchanged",
      async () => {
        const before = await fetchUsageGauge();
        const { roomID, owner } = track(
          await setupRoom({ username: "dblfinish-owner" }),
        );
        const voter = track(
          await connectToRoom({ roomID, username: "dblfinish-voter" }),
        );

        const roundID = owner.response.room.rounds.at(-1)!.id;
        await castVote(roomID, roundID, voter, optionIDByName(owner, "8"));
        await owner.client.waitFor(
          (m) =>
            m.type === OutgoingMessageType.ROUND_UPDATE
            && m.results.length === 1,
        );

        const finishMid = owner.client.send({
          type: IncomingMessageType.FINISH_LAST_ROUND,
          roomID,
          userID: owner.userID,
        });
        const finished = await owner.client.waitFor(
          (m) => m.type === OutgoingMessageType.ROUND_UPDATE && !m.isInProgress,
        );
        const expectedFinalResult = {
          votes: 1,
          mean: "8.00",
          median: "8",
          mode: "8",
        };
        expect(finished.finalResult).toEqual(expectedFinalResult);
        await owner.client.expectAck(finishMid);

        // usage-log writes are async — the baseline must be taken BEFORE the
        // seeded activity, and the settle wait must ride out the write lag
        // before the no-second-count baseline is taken
        let settled: Awaited<ReturnType<typeof fetchUsageGauge>> | undefined;
        const settleDeadline = Date.now() + 10_000;
        while (Date.now() < settleDeadline) {
          const now = await fetchUsageGauge();
          if (
            now.thisMonthRounds >= before.thisMonthRounds + 1
            && now.thisMonthVotes >= before.thisMonthVotes + 1
          ) {
            settled = now;
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        if (!settled) {
          throw new Error(
            "the seeded activity's usage deltas never showed up in /api/stats",
          );
        }

        const secondMid = owner.client.send({
          type: IncomingMessageType.FINISH_LAST_ROUND,
          roomID,
          userID: owner.userID,
        });
        await owner.client.expectAck(secondMid);

        // poll past the async write window: the gauges must never move above
        // the baseline taken after the first finish
        const pollDeadline = Date.now() + 6_000;
        let maxRounds = settled.thisMonthRounds;
        let maxVotes = settled.thisMonthVotes;
        while (Date.now() < pollDeadline) {
          const now = await fetchUsageGauge();
          maxRounds = Math.max(maxRounds, now.thisMonthRounds);
          maxVotes = Math.max(maxVotes, now.thisMonthVotes);
          await new Promise((r) => setTimeout(r, 400));
        }
        expect(maxRounds).toBe(settled.thisMonthRounds);
        expect(maxVotes).toBe(settled.thisMonthVotes);

        const probe = track(await connectToRoom({ roomID }));
        expect(probe.response.room.rounds.at(-1)!.finalResult).toEqual(
          expectedFinalResult,
        );
      },
      30_000,
    );
  });
});
