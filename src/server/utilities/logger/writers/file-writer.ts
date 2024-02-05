import type { WriteStream } from "node:fs";
import fs from "node:fs";
import type { EnumVal, LogWriter } from "../logger";
import { LogType } from "../logger";

export class LogFileWriter implements LogWriter {
  private writeStream!: WriteStream;

  public constructor(
    private readonly filepath: string,
    private readonly loglevel: EnumVal<typeof LogType> = LogType.Warning,
  ) {
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
        this.writeStream.write(message, err => {
          if (err) {
            rej(err);
          } else {
            this.writeStream.write("\n", err => {
              if (err) {
                rej(err);
              } else {
                res();
              }
            });
          }
        });
      });
      return true;
    } catch (e) {
      return e as Error;
    }
  }
}
