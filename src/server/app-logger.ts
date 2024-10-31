import path from "node:path";
import type { LogWriter } from "./utilities/logger/logger";
import { Logger, LogType } from "./utilities/logger/logger";
import { LogFileWriter } from "./utilities/logger/writers/file-writer";
import { StdoutLogWriter } from "./utilities/logger/writers/stdout-writer";

const IS_DEV = process.env.NODE_ENV === "development";
const LOG_DIR = process.env.LOG_DIR ?? ".";
const LOG_FILEPATH = path.resolve(LOG_DIR, "pointing_poker_server.log");
const DEBUG = process.argv.includes("--debug") || process.env.DEBUG === "1"
  || false;
const LOGLEVEL = LogType.fromString(process.env.LOGLEVEL ?? "");

const writers: LogWriter[] = [
  new LogFileWriter(LOG_FILEPATH, LOGLEVEL),
];
if (DEBUG) {
  writers.push(new StdoutLogWriter());
}
export const logger = new Logger(writers, {
  format: IS_DEV ? "expanded" : "compact",
});

// before process exiting dispose of the logger
process.on("exit", () => {
  logger.dispose();
});
