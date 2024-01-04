import type { LogType, LogWriter } from "../logger";

export class StdoutLogWriter implements LogWriter {
  private decoder = new TextDecoder();

  public start(): true {
    return true;
  }

  public end(): true {
    return true;
  }

  public write(
    type: LogType,
    message: Uint8Array,
  ): true {
    console[type](this.decoder.decode(message));
    return true;
  }
}
