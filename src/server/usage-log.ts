import path from "path";
import { Usage } from "./utilities/usage";

const LOG_DIR = process.env.LOG_DIR ?? ".";
const LOG_FILEPATH = path.resolve(LOG_DIR, "ppoker_usage.log");

export const usage = new Usage<"ROOM_CREATED" | "CONNECTION_OPENED">(
  LOG_FILEPATH,
);
