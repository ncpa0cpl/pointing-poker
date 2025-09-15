import { Type } from "dilswer";

export const StatsType = Type.Record({
  activeRooms: Type.Int,
  activeUsers: Type.Int,
  thisMonthRoomCount: Type.Int,
  thisMonthUserCount: Type.Int,
});
