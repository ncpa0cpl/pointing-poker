import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import {
  type ConnectedUser,
  connectToRoom,
  IncomingMessageType,
  type MessageMatcher,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
} from "../helpers/ws";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const allSockets: RoomClient[] = [];

async function newRoom(opts: { username?: string } = {}) {
  const room = await setupRoom(opts);
  allSockets.push(room.owner.client);
  return room;
}

async function join(
  roomID: string,
  opts: { username?: string; role?: "voter" | "viewer" } = {},
) {
  const user = await connectToRoom({ roomID, ...opts });
  allSockets.push(user.client);
  return user;
}

function roundUpdateMatcher(roundID: string): MessageMatcher {
  return (msg) =>
    msg.type === OutgoingMessageType.ROUND_UPDATE && msg.id === roundID;
}

function roomModeMatcher(mode: string): MessageMatcher {
  return (msg) =>
    msg.type === OutgoingMessageType.ROOM_UPDATE && msg.mode === mode;
}

function sendVote(
  user: ConnectedUser,
  roomID: string,
  roundID: string,
  optionRef: string,
  userID?: string,
): string {
  return user.client.send({
    type: IncomingMessageType.ADD_ROUND_VOTE,
    roomID,
    userID: userID ?? user.userID,
    roundID,
    optionRef,
  });
}

/** asserts that NO message matching `matcher` arrives within `ms` */
async function expectSilence(
  client: RoomClient,
  matcher: MessageMatcher,
  ms = 800,
): Promise<void> {
  const received = await client.waitFor(matcher, ms).then(
    (msg) => msg,
    () => undefined,
  );
  if (received !== undefined) {
    throw new Error(
      `expected no matching message, but received: ${JSON.stringify(received)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe("live: round:add-vote (voting flow)", () => {
  beforeAll(async () => {
    await ensureServer();
  });

  afterAll(async () => {
    await Promise.allSettled(allSockets.map((socket) => socket.close()));
  });

  test(
    "happy path: voter votes propagate as round:update to every socket",
    async () => {
      const { roomID, owner } = await newRoom({ username: "vote-owner" });
      const voterA = await join(roomID, { username: "vote-alice" });
      const voterB = await join(roomID, { username: "vote-bob" });

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const optHigh = owner.response.room.defaultOptions[3]!;
      const optLow = owner.response.room.defaultOptions[0]!;

      // first vote (alice)
      const msgA = sendVote(voterA, roomID, roundID, optHigh.id);
      await voterA.client.expectAck(msgA);

      const updateA = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(updateA.isInProgress).toBe(true);
      expect(updateA.hasResults).toBe(true);
      expect(updateA.results).toHaveLength(1);
      expect(updateA.results[0]).toEqual({
        publicUserID: voterA.publicUserID,
        username: "vote-alice",
        vote: optHigh.name,
        hideUsername: false,
      });

      // every other participant socket sees the same update
      const updateAonB = await voterB.client.waitFor(
        roundUpdateMatcher(roundID),
      );
      expect(updateAonB.results).toHaveLength(1);
      expect(updateAonB.results[0]!.username).toBe("vote-alice");

      // second vote (bob)
      const msgB = sendVote(voterB, roomID, roundID, optLow.id);
      await voterB.client.expectAck(msgB);

      const updateB = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(updateB.isInProgress).toBe(true);
      expect(updateB.results).toHaveLength(2);
      expect(updateB.results.map((r) => r.vote)).toEqual([
        optHigh.name,
        optLow.name,
      ]);
      expect(updateB.results.map((r) => r.username)).toEqual([
        "vote-alice",
        "vote-bob",
      ]);
    },
    15_000,
  );

  test(
    "a voter can change their vote: the previous entry is replaced",
    async () => {
      const { roomID, owner } = await newRoom();
      const voter = await join(roomID, { username: "switcher" });

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const optA = owner.response.room.defaultOptions[0]!;
      const optB = owner.response.room.defaultOptions[1]!;

      const msg1 = sendVote(voter, roomID, roundID, optA.id);
      await voter.client.expectAck(msg1);
      const update1 = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update1.results).toHaveLength(1);
      expect(update1.results[0]!.vote).toBe(optA.name);

      const msg2 = sendVote(voter, roomID, roundID, optB.id);
      await voter.client.expectAck(msg2);
      const update2 = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update2.results).toHaveLength(1);
      expect(update2.results[0]!.vote).toBe(optB.name);
      expect(update2.results[0]!.publicUserID).toBe(voter.publicUserID);
    },
    15_000,
  );

  test(
    "vote on a non-active (unknown) roundID is silently ignored",
    async () => {
      const { roomID, owner } = await newRoom();
      const voter = await join(roomID, { username: "silent-voter" });

      const optID = owner.response.room.defaultOptions[3]!.id;

      const msgID = voter.client.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        roomID,
        userID: voter.userID,
        roundID: "00000000-0000-0000-0000-000000000000",
        optionRef: optID,
      });

      // only the ack arrives — no round:update, no error
      await voter.client.expectAck(msgID);
      await expectSilence(
        owner.client,
        roundUpdateMatcher("00000000-0000-0000-0000-000000000000"),
      );
      await expectSilence(
        voter.client,
        roundUpdateMatcher("00000000-0000-0000-0000-000000000000"),
      );
      await expectSilence(
        voter.client,
        (msg) =>
          msg.type === OutgoingMessageType.ERROR && msg.causedBy === msgID,
      );

      // the real round is still untouched: voting on it works afterwards
      const realRoundID = owner.response.room.rounds.at(-1)!.id;
      const msg2 = sendVote(voter, roomID, realRoundID, optID);
      await voter.client.expectAck(msg2);
      const update = await owner.client.waitFor(
        roundUpdateMatcher(realRoundID),
      );
      expect(update.results).toHaveLength(1);
    },
    15_000,
  );

  test("vote on a finished round is silently ignored", async () => {
    const { roomID, owner } = await newRoom();
    const voter = await join(roomID, { username: "late-voter" });

    const roundID = owner.response.room.rounds.at(-1)!.id;
    const optID = owner.response.room.defaultOptions[3]!.id;

    // vote once while the round is in progress
    const msg1 = sendVote(voter, roomID, roundID, optID);
    await voter.client.expectAck(msg1);
    const inProgress = await owner.client.waitFor(roundUpdateMatcher(roundID));
    expect(inProgress.isInProgress).toBe(true);
    await voter.client.waitFor(roundUpdateMatcher(roundID));

    // owner finishes the round
    const finishID = owner.client.send({
      type: IncomingMessageType.FINISH_LAST_ROUND,
      roomID,
      userID: owner.userID,
    });
    await owner.client.expectAck(finishID);
    const finished = await owner.client.waitFor(roundUpdateMatcher(roundID));
    expect(finished.isInProgress).toBe(false);
    await voter.client.waitFor(roundUpdateMatcher(roundID));

    // voting again on the now-finished round is ignored
    const msg2 = sendVote(voter, roomID, roundID, optID);
    await voter.client.expectAck(msg2);
    await expectSilence(owner.client, roundUpdateMatcher(roundID));
    await expectSilence(
      voter.client,
      (msg) => msg.type === OutgoingMessageType.ERROR && msg.causedBy === msg2,
    );
  }, 15_000);

  test(
    "vote from a userID with no connection in the room -> connection:error 404",
    async () => {
      const { roomID, owner } = await newRoom();
      const voter = await join(roomID, { username: "real-voter" });

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const optID = owner.response.room.defaultOptions[3]!.id;

      const msgID = voter.client.send({
        type: IncomingMessageType.ADD_ROUND_VOTE,
        roomID,
        userID: "no-such-user-in-this-room",
        roundID,
        optionRef: optID,
      });

      const err = await voter.client.expectError(msgID);
      expect(err.code).toBe(404);
      expect(err.message).toContain("RoomConnection with userID");
      // the ack still arrives (sent in the finally block of the handler)
      await voter.client.expectAck(msgID);

      // server is unaffected: a subsequent valid vote still works
      const msg2 = sendVote(voter, roomID, roundID, optID);
      await voter.client.expectAck(msg2);
      const update = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update.results).toHaveLength(1);
    },
    15_000,
  );

  test(
    "voting with an invalid optionRef is rejected with an error",
    async () => {
      const { roomID, owner } = await newRoom();
      const voter = await join(roomID, { username: "typo-voter" });

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const optID = owner.response.room.defaultOptions[3]!.id;

      const msgID = sendVote(voter, roomID, roundID, "no-such-option-id");
      await voter.client.expectAck(msgID);

      const err = await voter.client.expectError(msgID);
      expect(err.code).toBe(404);
      expect(err.message).toMatch(/no-such-option-id|Option/);

      // the real round is untouched — no round:update for the bogus vote
      await expectSilence(owner.client, roundUpdateMatcher(roundID));

      // the server did not crash: a subsequent valid vote registers normally
      const msg2 = sendVote(voter, roomID, roundID, optID);
      await voter.client.expectAck(msg2);
      const update2 = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update2.results).toHaveLength(1);
      expect(update2.results[0]!.vote).toBe(
        owner.response.room.defaultOptions[3]!.name,
      );
    },
    15_000,
  );

  test("viewers cannot vote (silently ignored)", async () => {
    const { roomID, owner } = await newRoom();
    const viewer = await join(roomID, {
      username: "just-watching",
      role: "viewer",
    });

    const roundID = owner.response.room.rounds.at(-1)!.id;
    const optID = owner.response.room.defaultOptions[3]!.id;

    const msgID = sendVote(viewer, roomID, roundID, optID);
    await viewer.client.expectAck(msgID);

    await expectSilence(owner.client, roundUpdateMatcher(roundID));
    await expectSilence(viewer.client, roundUpdateMatcher(roundID));
    await expectSilence(
      viewer.client,
      (msg) => msg.type === OutgoingMessageType.ERROR && msg.causedBy === msgID,
    );

    // a regular voter joining afterwards can still vote normally
    const voter = await join(roomID, { username: "normal-voter" });
    const msg2 = sendVote(voter, roomID, roundID, optID);
    await voter.client.expectAck(msg2);
    const update = await owner.client.waitFor(roundUpdateMatcher(roundID));
    expect(update.results).toHaveLength(1);
    expect(update.results[0]!.username).toBe("normal-voter");
  }, 15_000);

  test(
    "private mode hides usernames in vote results; default mode shows them",
    async () => {
      const { roomID, owner } = await newRoom();
      const voter = await join(roomID, { username: "shy-voter" });

      const roundID = owner.response.room.rounds.at(-1)!.id;
      const optID = owner.response.room.defaultOptions[3]!.id;

      // owner switches the room to private mode via chat command
      const privID = owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: owner.userID,
        text: "/setmode private",
      });
      await owner.client.expectAck(privID);
      await owner.client.waitFor(roomModeMatcher("private"));
      await voter.client.waitFor(roomModeMatcher("private"));

      const msg1 = sendVote(voter, roomID, roundID, optID);
      await voter.client.expectAck(msg1);
      const update1 = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update1.results).toHaveLength(1);
      expect(update1.results[0]!.hideUsername).toBe(true);
      expect(update1.results[0]!.publicUserID).toBe(voter.publicUserID);
      expect(update1.results[0]!.vote).toBe(
        owner.response.room.defaultOptions[3]!.name,
      );

      // owner switches back to default mode
      const defID = owner.client.send({
        type: IncomingMessageType.POST_MESSAGE,
        roomID,
        userID: owner.userID,
        text: "/setmode default",
      });
      await owner.client.expectAck(defID);
      await owner.client.waitFor(roomModeMatcher("default"));

      const msg2 = sendVote(voter, roomID, roundID, optID);
      await voter.client.expectAck(msg2);
      const update2 = await owner.client.waitFor(roundUpdateMatcher(roundID));
      expect(update2.results).toHaveLength(1); // still one entry per user
      expect(update2.results[0]!.hideUsername).toBe(false);
    },
    15_000,
  );
});
