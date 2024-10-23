import type { WriteStream } from "node:fs";
import fs from "node:fs";
import type { EnumVal, LogWriter } from "../logger";
import { LogType } from "../logger";

export class LogFileWriter implements LogWriter {
  private writeStream!: WriteStream;
  private intervalTimer;

  public constructor(
    private readonly filepath: string,
    private readonly loglevel: EnumVal<typeof LogType> = LogType.Warning,
    private readonly maxLines = 10_000,
  ) {
    this.intervalTimer = setInterval(() => {
      this.truncate(this.maxLines);
    }, 30_000);
  }

  private shouldWrite(type: EnumVal<typeof LogType>): boolean {
    switch (this.loglevel) {
      case LogType.Error:
        return type === LogType.Error;
      case LogType.Warning:
        return [LogType.Error, LogType.Warning].includes(type);
      case LogType.Info:
        return [LogType.Error, LogType.Warning, LogType.Info].includes(type);
      case LogType.Debug:
        return true;
    }
  }

  private truncate(maxLines: number) {
    try {
      const contents = fs.readFileSync(this.filepath, "utf8");
      const lines = contents.split("\n");
      if (lines.length > maxLines) {
        fs.writeFileSync(this.filepath, lines.slice(-maxLines).join("\n"));
      }
      return true;
    } catch (e) {
      return e;
    }
  }

  public async start(): Promise<true | Error> {
    try {
      this.writeStream = fs.createWriteStream(this.filepath, { flags: "a" });
      return true;
    } catch (e) {
      return e as Error;
    }
  }

  public async end(): Promise<true | Error> {
    try {
      await new Promise<void>((res) => {
        clearInterval(this.intervalTimer);
        this.writeStream.end(undefined, () => {
          res();
        });
      });
      return true;
    } catch (e) {
      return e as Error;
    }
  }

  public async write(
    type: EnumVal<typeof LogType>,
    message: Uint8Array,
  ): Promise<true | Error> {
    if (!this.shouldWrite(type)) {
      return true;
    }

    try {
      await new Promise<void>((res, rej) => {
        // add a newline to the message buffer
        const line = new Uint8Array(message.length + 1);
        line.set(message);
        line.set([0x0A], line.length - 1);

        this.writeStream.write(line, err => {
          if (err) {
            rej(err);
          } else {
            res();
          }
        });
      });
      return true;
    } catch (e) {
      return e as Error;
    }
  }
}
