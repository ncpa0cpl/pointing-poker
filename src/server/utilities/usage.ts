import { RWMutex } from "@ncpa0cpl/mutex.js";
import fs from "fs";
import { Time, unix } from "./time";

export class Usage<Type extends string> {
  private mutex = new RWMutex();
  private writeStream;
  private interval;

  constructor(
    private readonly file: string,
  ) {
    this.writeStream = this.createWriteStream();
    this.interval = setInterval(() => {
      this.vacuum();
    }, 12 * Time.HOUR);

    // this.vacuum();
  }

  private createWriteStream() {
    return fs.createWriteStream(
      this.file,
      {
        encoding: "utf8",
        flush: true,
        flags: "a",
      },
    );
  }

  private async readAllLines() {
    const content = await fs.promises.readFile(this.file, "utf-8");
    return content.split("\n").flatMap(line => {
      let [ts, type, val] = line.split(", ");
      if (val == null) {
        return [];
      }
      return {
        timestamp: new Date(ts!),
        type: type as Type,
        value: Number(val),
      };
    });
  }

  vacuum() {
    this.mutex.acquireWrite()
      .then(async () => {
        let lines = await this.readAllLines();

        const threeMonthAgo = new Date(Date.now() - (3 * Time.MONTH));
        lines = lines.filter(line => {
          return line.timestamp >= threeMonthAgo;
        });

        const content = lines
          .map(line => `${unix(line.timestamp)}, ${line.type}, ${line.value}\n`)
          .join("");

        await fs.promises.writeFile(this.file, content, "utf8");

        this.writeStream = this.createWriteStream();
      }).finally(() => {
        this.mutex.releaseWrite();
      });
  }

  logStart(type: Type, value = 1) {
    this.mutex.acquireWrite()
      .then(() => {
        const ts = new Date().toISOString();
        this.writeStream.write(`${ts}, ${type}, ${value}\n`);
      }).finally(() => {
        this.mutex.releaseWrite();
      });
  }

  logEnd(type: Type, value = -1) {
    this.mutex.acquireWrite()
      .then(() => {
        const ts = new Date().toISOString();
        this.writeStream.write(`${ts}, ${type}, ${value}\n`);
      }).finally(() => {
        this.mutex.releaseWrite();
      });
  }

  async getUsageLogs() {
    return this.mutex.acquireRead()
      .then(async () => {
        return this.readAllLines();
      }).finally(() => {
        this.mutex.releaseRead();
      });
  }
}
