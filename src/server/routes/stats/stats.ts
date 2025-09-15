import { Infer } from "dilswer";
import { type StatsType } from "../../../shared/stats";
import { RoomService } from "../../rooms/room-sevice";
import { usage } from "../../usage-log";
import { HttpServer } from "../../utilities/simple-server/http-server";
import { Time } from "../../utilities/time";

export function addStatsRoutes(server: HttpServer) {
  server.get("/api/stats", async (ctx) => {
    let usageLogs = await usage.getUsageLogs();
    console.log({ usageLogs });
    const oneMonthAgo = new Date(Date.now() - Time.MONTH);
    usageLogs = usageLogs.filter(log => log.timestamp >= oneMonthAgo);
    console.log({ usageLogs });

    const roomCreatedLogs = usageLogs.filter(log =>
      log.type === "ROOM_CREATED" && log.value === 1
    );
    const connOpenedLogs = usageLogs.filter(log =>
      log.type === "CONNECTION_OPENED" && log.value === 1
    );

    console.log({ roomCreatedLogs, connOpenedLogs });

    const data: Infer<typeof StatsType> = {
      activeRooms: RoomService.roomCount(),
      activeUsers: RoomService.userCount(),
      thisMonthRoomCount: roomCreatedLogs.length,
      thisMonthUserCount: connOpenedLogs.length,
    };

    return ctx
      .sendJson(200, data)
      .setCacheControl({
        noStore: true,
      });
  });
}
