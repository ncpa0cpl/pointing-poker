import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import {
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  RoomClient,
  setupRoom,
} from "../helpers/ws";

const TIMEOUT = 15_000;

type Matcher = Parameters<RoomClient["waitFor"]>[0];

const clients: RoomClient[] = [];
const rooms: {
  roomID: string;
  ownerClient: RoomClient;
  ownerUserID: string;
}[] = [];

function track<T extends { client: RoomClient }>(user: T): T {
  clients.push(user.client);
  return user;
}

/**
 * creates a room, connects its owner and registers everything for cleanup.
 * Rooms are explicitly /close-d in afterAll because the server only purges
 * unused rooms after 5 minutes — repeated suite runs would otherwise hit
 * the server's MAX_ACTIVE_ROOMS (100) limit.
 */
async function newRoom(username: string) {
  const room = await setupRoom({ username });
  clients.push(room.owner.client);
  rooms.push({
    roomID: room.roomID,
    ownerClient: room.owner.client,
    ownerUserID: room.owner.userID,
  });
  return room;
}

/** posts a chat message (or chat command) as the given user */
function postChat(
  client: RoomClient,
  roomID: string,
  userID: string,
  text: string,
): string {
  return client.send({
    type: IncomingMessageType.POST_MESSAGE,
    roomID,
    userID,
    text,
  });
}

/** waits for a room:chat-update whose LAST entry has the given text */
function waitForChatEndingWith(client: RoomClient, text: string, timeoutMs = 5000) {
  return client.waitFor(
    (m) =>
      m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
      && m.chatMessages.at(-1)?.text === text,
    timeoutMs,
  );
}

/** asserts that NO message matching the matcher arrives within the timeout */
async function expectNoMessage(
  client: RoomClient,
  matcher: Matcher,
  timeoutMs = 1500,
): Promise<void> {
  let received: unknown;
  try {
    received = await client.waitFor(matcher, timeoutMs);
  } catch {
    return; // nothing arrived — as expected
  }
  throw new Error(
    `expected no matching message, but received: ${JSON.stringify(received)}`,
  );
}

function voteNormally(
  client: RoomClient,
  roomID: string,
  userID: string,
  ownerResponse: { room: { rounds: { id: string }[]; defaultOptions: { id: string }[] } },
) {
  return client.send({
    type: IncomingMessageType.ADD_ROUND_VOTE,
    roomID,
    userID,
    roundID: ownerResponse.room.rounds.at(-1)!.id,
    optionRef: ownerResponse.room.defaultOptions[0]!.id,
  });
}

describe("live: chat messages and chat commands", () => {
  beforeAll(async () => {
    await ensureServer();
  });

  afterAll(async () => {
    // destroy every room this suite created so the server's room limit is
    // not exhausted by back-to-back runs
    for (const r of rooms) {
      if (!r.ownerClient.isClosed) {
        r.ownerClient.send({
          type: IncomingMessageType.POST_MESSAGE,
          roomID: r.roomID,
          userID: r.ownerUserID,
          text: "/close",
        });
      }
    }
    await Promise.allSettled(
      clients.filter(Boolean).map((c) => c.close()),
    );
  });

  // ---------------------------------------------------------------- chat ---

  test(
    "plain message is broadcast to everyone with escaped text and author metadata",
    async () => {
      const { roomID, owner } = await newRoom("chat-owner");
      const voter = track(await connectToRoom({ roomID, username: "chat-voter" }));

      postChat(owner.client, roomID, owner.userID, `hi <b>bold</b> & "quotes" 'ap'`);

      const expected = "hi &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quotes&quot; &#39;ap&#39;";
      const ownerMsg = await waitForChatEndingWith(owner.client, expected);
      const voterMsg = await waitForChatEndingWith(voter.client, expected);

      for (const msg of [ownerMsg, voterMsg]) {
        const entry = msg.chatMessages.at(-1)!;
        expect(entry.publicUserID).toBe(owner.publicUserID);
        expect(entry.username).toBe("chat-owner");
        expect(Number.isNaN(Date.parse(entry.sentAt))).toBe(false);
      }
    },
    TIMEOUT,
  );

  test(
    "system messages have no author metadata",
    async () => {
      const { owner, username } = await newRoom("sys-owner");
      const first = owner.response.room.chatMessages[0]!;
      expect(first.text).toBe(`*${username}* has joined.`);
      expect(first.publicUserID).toBeUndefined();
      expect(first.username).toBeUndefined();
    },
    TIMEOUT,
  );

  // ------------------------------------------------------------ commands ---

  test(
    "/transfer hands ownership to the named participant; unknown name is a no-op",
    async () => {
      const { roomID, owner } = await newRoom("transfer-owner");
      const voter = track(await connectToRoom({ roomID, username: "transfer-voter" }));

      // unknown target: no-op — nothing is added to the chat
      postChat(owner.client, roomID, owner.userID, "/transfer nobody-here");
      postChat(owner.client, roomID, owner.userID, "after unknown transfer");
      const sentinel = await waitForChatEndingWith(owner.client, "after unknown transfer");
      expect(sentinel.chatMessages).toHaveLength(3); // 2 joins + 1 message

      // real transfer
      postChat(owner.client, roomID, owner.userID, "/transfer transfer-voter");
      const change = await owner.client.waitFor(OutgoingMessageType.OWNER_UPDATE);
      expect(change.ownerName).toBe("transfer-voter");
      expect(change.ownerPublicID).toBe(voter.publicUserID);
      expect(change.ownerRole).toBe("voter");
      // broadcast to everyone
      await voter.client.waitFor(OutgoingMessageType.OWNER_UPDATE);

      // the new owner can perform owner actions (create a round)
      voter.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: voter.userID,
      });
      const update = await voter.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.rounds.length === 2,
      );
      expect(update.rounds).toHaveLength(2);
      await owner.client.waitFor(OutgoingMessageType.ROOM_UPDATE);

      // the previous owner is no longer owner
      const deniedID = owner.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: owner.userID,
      });
      const err = await owner.client.expectError(deniedID);
      expect(err.code).toBe(401);
    },
    TIMEOUT,
  );

  test(
    "/vote adds a free-form vote for voters",
    async () => {
      const { roomID, owner } = await newRoom("vote-owner");
      const voter = track(await connectToRoom({ roomID, username: "vote-voter" }));

      postChat(voter.client, roomID, voter.userID, "/vote banana");

      const update = await owner.client.waitFor(OutgoingMessageType.ROUND_UPDATE);
      expect(update.results).toHaveLength(1);
      expect(update.results[0]).toEqual({
        vote: "banana",
        username: "vote-voter",
        publicUserID: voter.publicUserID,
        hideUsername: false,
      });
      // NOTE: chat /vote bypasses option validation — the raw value is stored
      // even though it is not one of the room's options
      expect(update.options.map((o) => o.name)).not.toContain("banana");
    },
    TIMEOUT,
  );

  test(
    "viewer's /vote is silently ignored",
    async () => {
      const { roomID, owner } = await newRoom("viewer-vote-owner");
      const viewer = track(
        await connectToRoom({ roomID, username: "quiet-viewer", role: "viewer" }),
      );
      const voter = track(await connectToRoom({ roomID, username: "real-voter" }));

      postChat(viewer.client, roomID, viewer.userID, "/vote 42");

      // a real vote from a voter lands as the ONLY result
      voteNormally(voter.client, roomID, voter.userID, owner.response);
      const update = await owner.client.waitFor(OutgoingMessageType.ROUND_UPDATE);
      expect(update.results).toHaveLength(1);
      expect(update.results[0]!.username).toBe("real-voter");
    },
    TIMEOUT,
  );

  test(
    "/reset replaces all rounds with a single fresh empty round",
    async () => {
      const { roomID, owner } = await newRoom("reset-owner");
      const voter = track(await connectToRoom({ roomID, username: "reset-voter" }));

      // build up state: a vote on round 1, then a second round
      voteNormally(voter.client, roomID, voter.userID, owner.response);
      await owner.client.waitFor(OutgoingMessageType.ROUND_UPDATE);
      owner.client.send({
        type: IncomingMessageType.CREATE_NEW_ROUND,
        roomID,
        userID: owner.userID,
      });
      await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.rounds.length === 2,
      );

      postChat(owner.client, roomID, owner.userID, "/reset");

      const update = await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.rounds.length === 1,
      );
      expect(update.rounds).toHaveLength(1);
      expect(update.rounds[0]!.results).toHaveLength(0);
      expect(update.rounds[0]!.isInProgress).toBe(true);
      await voter.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.rounds.length === 1,
      );

      const sysMsg = await waitForChatEndingWith(
        voter.client,
        "All previous rounds were deleted by reset-owner.",
      );
      expect(sysMsg.chatMessages.at(-1)!.publicUserID).toBeUndefined();
    },
    TIMEOUT,
  );

  test(
    "/reset by a non-owner is a no-op",
    async () => {
      const { roomID, owner } = await newRoom("noreset-owner");
      const voter = track(await connectToRoom({ roomID, username: "noreset-voter" }));

      postChat(voter.client, roomID, voter.userID, "/reset");
      postChat(owner.client, roomID, owner.userID, "rounds intact");
      const sentinel = await waitForChatEndingWith(owner.client, "rounds intact");
      // 2 joins + sentinel, and no "All previous rounds were deleted" message
      expect(sentinel.chatMessages).toHaveLength(3);
      expect(
        sentinel.chatMessages.some((m) => m.text.includes("deleted")),
      ).toBe(false);
    },
    TIMEOUT,
  );

  test(
    "/clearchat empties the chat and leaves a system message",
    async () => {
      const { roomID, owner } = await newRoom("clear-owner");
      const voter = track(await connectToRoom({ roomID, username: "clear-voter" }));

      postChat(owner.client, roomID, owner.userID, "one");
      postChat(voter.client, roomID, voter.userID, "two");
      await waitForChatEndingWith(owner.client, "two");

      postChat(owner.client, roomID, owner.userID, "/clearchat");

      const msg = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.length === 1,
      );
      const entry = msg.chatMessages[0]!;
      expect(entry.text).toBe("Chat history was cleared by clear-owner.");
      expect(entry.publicUserID).toBeUndefined();
      expect(entry.username).toBeUndefined();
      await voter.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_CHAT_UPDATE
          && m.chatMessages.length === 1,
      );
    },
    TIMEOUT,
  );

  test(
    "/clearchat by a non-owner is a no-op",
    async () => {
      const { roomID, owner } = await newRoom("noclear-owner");
      const voter = track(await connectToRoom({ roomID, username: "noclear-voter" }));

      postChat(voter.client, roomID, voter.userID, "keep me");
      postChat(voter.client, roomID, voter.userID, "/clearchat");
      postChat(owner.client, roomID, owner.userID, "history intact");
      const sentinel = await waitForChatEndingWith(owner.client, "history intact");
      // owner join + voter join + "keep me" + sentinel
      expect(sentinel.chatMessages).toHaveLength(4);
      expect(sentinel.chatMessages.some((m) => m.text.includes("cleared"))).toBe(
        false,
      );
    },
    TIMEOUT,
  );

  test(
    "/setoptions replaces default options and the in-progress round's options",
    async () => {
      const { roomID, owner } = await newRoom("opts-owner");

      postChat(owner.client, roomID, owner.userID, "/setoptions alpha beta gamma");

      const update = await owner.client.waitFor(OutgoingMessageType.ROOM_UPDATE);
      expect(update.defaultOptions.map((o) => o.name)).toEqual([
        "alpha",
        "beta",
        "gamma",
      ]);
      // the in-progress round inherits the new options too
      expect(update.rounds.at(-1)!.options.map((o) => o.name)).toEqual([
        "alpha",
        "beta",
        "gamma",
      ]);
    },
    TIMEOUT,
  );

  test(
    "/addoption appends a label (spaces allowed)",
    async () => {
      const { roomID, owner } = await newRoom("addopt-owner");
      const initialNames = owner.response.room.defaultOptions.map((o) => o.name);

      postChat(owner.client, roomID, owner.userID, "/addoption my new option");

      const update = await owner.client.waitFor(OutgoingMessageType.ROOM_UPDATE);
      expect(update.defaultOptions.map((o) => o.name)).toEqual([
        ...initialNames,
        "my new option",
      ]);
    },
    TIMEOUT,
  );

  test(
    "option commands by non-owners are no-ops",
    async () => {
      const { roomID, owner } = await newRoom("noopts-owner");
      const voter = track(await connectToRoom({ roomID, username: "noopts-voter" }));
      const initialNames = owner.response.room.defaultOptions.map((o) => o.name);

      postChat(voter.client, roomID, voter.userID, "/setoptions x y");
      postChat(voter.client, roomID, voter.userID, "/addoption nope");
      postChat(owner.client, roomID, owner.userID, "still original options");
      const sentinel = await waitForChatEndingWith(owner.client, "still original options");
      expect(sentinel.chatMessages).toHaveLength(3); // 2 joins + sentinel

      // an owner-side command confirms the original options were untouched
      postChat(owner.client, roomID, owner.userID, "/addoption probe");
      const update = await owner.client.waitFor(OutgoingMessageType.ROOM_UPDATE);
      expect(update.defaultOptions.map((o) => o.name)).toEqual([
        ...initialNames,
        "probe",
      ]);
      expect(update.defaultOptions.map((o) => o.name)).not.toContain("nope");
    },
    TIMEOUT,
  );

  test(
    "/setmode switches the room mode; invalid mode is a no-op",
    async () => {
      const { roomID, owner } = await newRoom("mode-owner");
      const voter = track(await connectToRoom({ roomID, username: "mode-voter" }));

      postChat(owner.client, roomID, owner.userID, "/setmode private");
      await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.mode === "private",
      );
      await voter.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.mode === "private",
      );

      postChat(owner.client, roomID, owner.userID, "/setmode default");
      await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROOM_UPDATE && m.mode === "default",
      );

      // invalid mode: no-op, nothing is added to the chat
      postChat(owner.client, roomID, owner.userID, "/setmode hardcore");
      postChat(owner.client, roomID, owner.userID, "mode sentinel");
      const sentinel = await waitForChatEndingWith(owner.client, "mode sentinel");
      expect(sentinel.chatMessages).toHaveLength(3); // 2 joins + sentinel
      // NOTE: the invalid mode cannot be observed beyond "no room:update with
      // a mode change and no crash" — "hardcore" is not a valid mode value
    },
    TIMEOUT,
  );

  test(
    "/setrole changes the sender's own role and affects voting",
    async () => {
      const { roomID, owner } = await newRoom("role-owner");
      const voterA = track(await connectToRoom({ roomID, username: "role-a" }));
      const voterB = track(await connectToRoom({ roomID, username: "role-b" }));

      // switch to viewer
      postChat(voterA.client, roomID, voterA.userID, "/setrole viewer");
      const sys = await waitForChatEndingWith(
        owner.client,
        "**role-a** is now a viewer only.",
      );
      expect(sys.chatMessages.at(-1)!.publicUserID).toBeUndefined();

      // NOTE: role changes surface via room:update's participants list — no
      // room:participants-change is broadcast for role changes
      const update = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_UPDATE
          && m.participants.find((p) => p.publicID === voterA.publicUserID)?.role
            === "viewer",
      );
      expect(
        update.participants.find((p) => p.publicID === voterA.publicUserID)!.role,
      ).toBe("viewer");
      expect(
        update.participants.find((p) => p.publicID === voterB.publicUserID)!.role,
      ).toBe("voter");

      // viewer's /vote is ignored
      postChat(voterA.client, roomID, voterA.userID, "/vote 8");
      voteNormally(voterB.client, roomID, voterB.userID, owner.response);
      const voteUpdate = await owner.client.waitFor(OutgoingMessageType.ROUND_UPDATE);
      expect(voteUpdate.results).toHaveLength(1);
      expect(voteUpdate.results[0]!.username).toBe("role-b");

      // invalid role: no-op
      postChat(voterA.client, roomID, voterA.userID, "/setrole admin");
      postChat(owner.client, roomID, owner.userID, "role sentinel");
      const sentinel = await waitForChatEndingWith(owner.client, "role sentinel");
      expect(sentinel.chatMessages.some((m) => m.text.includes("admin"))).toBe(
        false,
      );

      // back to voter
      postChat(voterA.client, roomID, voterA.userID, "/setrole voter");
      await waitForChatEndingWith(owner.client, "**role-a** is back to voting.");
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_UPDATE
          && m.participants.find((p) => p.publicID === voterA.publicUserID)?.role
            === "voter",
      );

      // and now /vote works again
      postChat(voterA.client, roomID, voterA.userID, "/vote 5");
      const voteUpdate2 = await owner.client.waitFor(
        (m) => m.type === OutgoingMessageType.ROUND_UPDATE && m.results.length === 2,
      );
      expect(voteUpdate2.results.map((r) => r.vote)).toContain("5");
    },
    TIMEOUT,
  );

  test(
    "/setrole by the owner updates ownerRole too",
    async () => {
      const { roomID, owner } = await newRoom("ownrole-owner");

      postChat(owner.client, roomID, owner.userID, "/setrole viewer");
      const viewerUpdate = await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_UPDATE && m.ownerRole === "viewer",
      );
      expect(viewerUpdate.ownerName).toBe("ownrole-owner");

      postChat(owner.client, roomID, owner.userID, "/setrole voter");
      await owner.client.waitFor(
        (m) =>
          m.type === OutgoingMessageType.ROOM_UPDATE && m.ownerRole === "voter",
      );
    },
    TIMEOUT,
  );

  test(
    "unknown commands are no-ops",
    async () => {
      const { roomID, owner } = await newRoom("unknown-cmd-owner");
      track(await connectToRoom({ roomID, username: "unknown-cmd-voter" }));

      postChat(owner.client, roomID, owner.userID, "/foobar do stuff");
      postChat(owner.client, roomID, owner.userID, "after unknown command");
      const sentinel = await waitForChatEndingWith(owner.client, "after unknown command");
      expect(sentinel.chatMessages).toHaveLength(3); // 2 joins + sentinel
      // NOTE: chat commands never produce a connection:error reply, so there
      // is no error to assert on — the unchanged chat is the observable
    },
    TIMEOUT,
  );

  test(
    "/close by a non-owner is a no-op",
    async () => {
      const { roomID, owner } = await newRoom("noclose-owner");
      const voter = track(await connectToRoom({ roomID, username: "noclose-voter" }));

      postChat(voter.client, roomID, voter.userID, "/close");
      postChat(owner.client, roomID, owner.userID, "room still open");
      await waitForChatEndingWith(owner.client, "room still open");
      await waitForChatEndingWith(voter.client, "room still open");
    },
    TIMEOUT,
  );

  // NOTE: this test destroys its room, so it must run LAST in this file.
  //
  // NOTE (SERVER BUG, asserted as observed): room.dispose() iterates
  // this.connections while conn.close() splices entries out of that same
  // array — so only every SECOND participant (indices 0, 2, 4, ...) receives
  // room:closed. The remaining sockets are silently left connected to a room
  // that no longer exists.
  test(
    "/close by the owner destroys the room (notification only reaches every second participant)",
    async () => {
      const { roomID, owner } = await newRoom("close-owner");
      const userA = track(await connectToRoom({ roomID, username: "close-a" }));
      const userB = track(await connectToRoom({ roomID, username: "close-b" }));
      const userC = track(await connectToRoom({ roomID, username: "close-c" }));

      postChat(owner.client, roomID, owner.userID, "/close");

      // connections at indices 0 and 2 are notified ...
      const ownerClosed = await owner.client.waitFor(OutgoingMessageType.ROOM_CLOSED);
      expect(ownerClosed.roomID).toBe(roomID);
      const bClosed = await userB.client.waitFor(OutgoingMessageType.ROOM_CLOSED);
      expect(bClosed.roomID).toBe(roomID);

      // ... while connections at indices 1 and 3 are NOT
      await expectNoMessage(
        userA.client,
        (m) => m.type === OutgoingMessageType.ROOM_CLOSED,
      );
      await expectNoMessage(
        userC.client,
        (m) => m.type === OutgoingMessageType.ROOM_CLOSED,
      );

      // the room is gone from the service either way: reconnecting to it
      // answers with room:closed
      const late = await RoomClient.connect();
      clients.push(late);
      late.send({
        type: IncomingMessageType.ROOM_CONNECT,
        roomID,
        userID: "late-user",
        publicUserID: "late-pub",
        username: "late-joiner",
        role: "voter",
      });
      const closed = await late.waitFor(OutgoingMessageType.ROOM_CLOSED);
      expect(closed.roomID).toBe(roomID);
    },
    TIMEOUT,
  );
});
