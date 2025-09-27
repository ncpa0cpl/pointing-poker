import { Infer, Type } from "dilswer";

export const StatHistoryType = Type.Array(Type.Record({
  month: Type.String,
  day: Type.Int,
  value: Type.Int,
}));

export const StatsType = Type.Record({
  activeRooms: Type.Int,
  activeUsers: Type.Int,
  thisMonthRoomCount: Type.Int,
  thisMonthUserCount: Type.Int,
  thisMonthRounds: Type.Int,
  thisMonthVotes: Type.Int,

  thisMonthRoomCountHistory: StatHistoryType,
  thisMonthUserCountHistory: StatHistoryType,
  thisMonthRoundsHistory: StatHistoryType,
  thisMonthVotesHistory: StatHistoryType,
});

export type Stats = Infer<typeof StatsType>;
export type StatHistory = Infer<typeof StatHistoryType>;
export type StatHistoryElem = Infer<typeof StatHistoryType>[number];
