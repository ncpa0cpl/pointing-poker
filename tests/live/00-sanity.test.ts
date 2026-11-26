import { describe, expect, test } from "bun:test";
import { ensureServer } from "../helpers/docker";
import { api } from "../helpers/http";
import {
  connectToRoom,
  IncomingMessageType,
  OutgoingMessageType,
  setupRoom,
} from "../helpers/ws";

describe("sanity", () => {
  test("server responds", async () => {
    await ensureServer();
    const res = await api("/api/stats");
    expect(res.status).toBe(200);
  });

  test("room create + ws flow works", async () => {
    const { roomID, owner } = await setupRoom({ username: "sanity-owner" });
    expect(roomID.length).toBeGreaterThan(3);

    const voter = await connectToRoom({ roomID, username: "sanity-voter" });
    expect(voter.response.type).toBe(OutgoingMessageType.ROOM_CONNECTED);

    const roundID = owner.response.room.rounds.at(-1)!.id;
    const optID = owner.response.room.defaultOptions[3]!.id;

    const voteMsgID = voter.client.send({
      type: IncomingMessageType.ADD_ROUND_VOTE,
      roomID,
      userID: voter.userID,
      roundID,
      optionRef: optID,
    });

    const update = await owner.client.waitFor(
      (m) => m.type === OutgoingMessageType.ROUND_UPDATE,
    );
    expect(update.results.length).toBe(1);
    await voter.client.expectAck(voteMsgID);

    const finish = owner.client.send({
      type: IncomingMessageType.FINISH_LAST_ROUND,
      roomID,
      userID: owner.userID,
    });
    const finished = await voter.client.waitFor(
      (m) => m.type === OutgoingMessageType.ROUND_UPDATE && !m.isInProgress,
    );
    expect(finished.finalResult!.votes).toBe(1);
    await owner.client.expectAck(finish);
    await owner.client.close();
    await voter.client.close();
  });

  test("invalid body -> 400", async () => {
    const res = await api("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
