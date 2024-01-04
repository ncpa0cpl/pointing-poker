import type { WriteStream } from "node:fs";
import fs from "node:fs";
import type { LogType, LogWriter } from "../logger";

export class LogFileWriter implements LogWriter {
  private writeStream!: WriteStream;

  public constructor(
    private readonly filepath: string,
  ) {
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
    type: LogType,
    message: Uint8Array,
  ): Promise<true | Error> {
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
