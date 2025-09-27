import { StatHistory, Stats } from "../../../shared/stats";
import { RoomService } from "../../rooms/room-sevice";
import { usage } from "../../usage-log";
import { HttpServer } from "../../utilities/simple-server/http-server";
import { Time } from "../../utilities/time";
import { LogLine } from "../../utilities/usage";

function createLogHistory<T extends string>(logs: LogLine<T>[]): StatHistory {
  const history = logs.reduce(
    (acc: StatHistory, log) => {
      const logDay = log.timestamp.getDate();
      const logMonth = MONTHS[log.timestamp.getMonth() + 1]!;

      const sameDayStat = acc.find(s =>
        s.day === logDay && s.month === logMonth
      );
      if (sameDayStat) {
        sameDayStat.value += log.value;
      } else {
        acc.push({
          month: logMonth,
          day: logDay,
          value: log.value,
        });
      }

      return acc;
    },
    [],
  );

  return history;
}

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
    const votesPlacedLogs = usageLogs.filter(log =>
      log.type === "VOTES_PLACED"
    );
    const votesPlaced = votesPlacedLogs.reduce(
      (sum, log) => log.value + sum,
      0,
    );

    const thisMonthRoomCountHistory = createLogHistory(roomCreatedLogs);
    const thisMonthRoundsHistory = createLogHistory(roundsCompleted);
    const thisMonthUserCountHistory = createLogHistory(connOpenedLogs);
    const thisMonthVotesHistory = createLogHistory(votesPlacedLogs);

    const data: Stats = {
      activeRooms: RoomService.roomCount(),
      activeUsers: RoomService.userCount(),
      thisMonthRoomCount: roomCreatedLogs.length,
      thisMonthUserCount: connOpenedLogs.length,
      thisMonthRounds: roundsCompleted.length,
      thisMonthVotes: votesPlaced,

      thisMonthRoomCountHistory,
      thisMonthRoundsHistory,
      thisMonthUserCountHistory,
      thisMonthVotesHistory,
    };

    return ctx
      .sendJson(200, data)
      .setCacheControl({
        noStore: true,
      });
  });
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
