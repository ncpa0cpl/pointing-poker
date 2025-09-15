import { Infer } from "dilswer";
import { type StatsType } from "../../../shared/stats";
import { RoomService } from "../../rooms/room-sevice";
import { usage } from "../../usage-log";
import { HttpServer } from "../../utilities/simple-server/http-server";
import { Time } from "../../utilities/time";

export function addStatsRoutes(server: HttpServer) {
  server.get("/api/stats", async (ctx) => {
    let usageLogs = await usage.getUsageLogs();
    const oneMonthAgo = new Date(Date.now() - Time.MONTH);
    usageLogs = usageLogs.filter(log => log.timestamp >= oneMonthAgo);

    const roomCreatedLogs = usageLogs.filter(log =>
      log.type === "ROOM_CREATED" && log.value === 1
    );
    const connOpenedLogs = usageLogs.filter(log =>
      log.type === "CONNECTION_OPENED" && log.value === 1
    );
    const roundsCompleted = usageLogs.filter(log =>
      log.type === "ROUND_COMPLETED" && log.value === 1
    );
    const votesPlaced = usageLogs.filter(log => log.type === "VOTES_PLACED")
      .reduce((sum, log) => log.value + sum, 0);

    const data: Infer<typeof StatsType> = {
      activeRooms: RoomService.roomCount(),
      activeUsers: RoomService.userCount(),
      thisMonthRoomCount: roomCreatedLogs.length,
      thisMonthUserCount: connOpenedLogs.length,
      thisMonthRounds: roundsCompleted.length,
      thisMonthVotes: votesPlaced,
    };

    return ctx
      .sendJson(200, data)
      .setCacheControl({
        noStore: true,
      });
  });
}
