import { DateTime } from "luxon";

type MaybeAsync<T> = Promise<T> | T;

export enum LogType {
  Warning = "warn",
  Error = "error",
  Info = "info",
  Debug = "debug",
}

export interface LogWriter {
  write(
    type: LogType,
    message: Uint8Array,
  ): MaybeAsync<true | Error>;
  start(): MaybeAsync<true | Error>;
  end(): MaybeAsync<true | Error>;
}

export class Logger {
  private readonly encoder = new TextEncoder();

  public constructor(
    private readonly writers: LogWriter[],
    private readonly options: Readonly<{
      format: "compact" | "expanded";
    }> = { format: "compact" },
  ) {
    this.writers.forEach((writer) => {
      Promise.resolve(writer.start()).catch((e) => {
        console.error("Failed to start logger writer.");
        console.error(e);
      });
    });
  }

  private createLogPreamble(type: LogType): string {
    const date = DateTime.now();
    const timestamp = date.toFormat("[yyyy-MM-dd HH:mm:ss.SSS]");

    let typeIndicator: string;
    switch (type) {
      case LogType.Warning:
        typeIndicator = "[WARN]";
        break;
      case LogType.Error:
        typeIndicator = "[ERROR]";
        break;
      case LogType.Info:
        typeIndicator = "[INFO]";
        break;
      case LogType.Debug:
        typeIndicator = "[DEBUG]";
        break;
    }

    return `${timestamp} ${typeIndicator}:`;
  }

  private formatMessages(msg: any[]): string {
    return msg.map(m =>
      JSON.stringify(m, (k, v) => {
        if (v instanceof Error) {
          return {
            INSTANCEOF: Object.getPrototypeOf(v).constructor.name,
            message: v.message,
            stack: v.stack,
            name: v.name,
          };
        }
        if (v instanceof Request) {
          return {
            INSTANCEOF: "Request",
            method: v.method,
            url: v.url,
            headers: Object.fromEntries(v.headers.entries()),
          };
        }
        return v;
      }, this.options.format === "expanded" ? 2 : undefined)
    ).join(", ");
  }

  private write(type: LogType, msg: Uint8Array) {
    for (let i = 0; i < this.writers.length; i++) {
      const writer = this.writers[i]!;
      Promise.resolve(writer.write(type, msg)).catch((e) => {
        console.error("Failed to write to logger writer.");
        console.error(e);
      });
    }
  }

  public warn(...msg: any[]) {
    this.write(
      LogType.Warning,
      this.encoder.encode(
        `${this.createLogPreamble(LogType.Warning)} ${
          this.formatMessages(msg)
        }`,
      ),
    );
  }

  public error(...msg: any[]) {
    this.write(
      LogType.Error,
      this.encoder.encode(
        `${this.createLogPreamble(LogType.Error)} ${this.formatMessages(msg)}`,
      ),
    );
  }

  public info(...msg: any[]) {
    this.write(
      LogType.Info,
      this.encoder.encode(
        `${this.createLogPreamble(LogType.Info)} ${this.formatMessages(msg)}`,
      ),
    );
  }

  public debug(...msg: any[]) {
    this.write(
      LogType.Debug,
      this.encoder.encode(
        `${this.createLogPreamble(LogType.Debug)} ${this.formatMessages(msg)}`,
      ),
    );
  }

  public dispose() {
    for (let i = 0; i < this.writers.length; i++) {
      const writer = this.writers[i]!;
      Promise.resolve(writer.end()).catch((e) => {
        console.error("Failed to end logger writer.");
        console.error(e);
      });
    }
  }
}
