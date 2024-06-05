import type { BunFile } from "bun";

export class RouterResponse extends Response {
  public static async from(
    body: Response | ArrayBuffer | Uint8Array | Buffer | BunFile | string,
    init: ResponseInit = {},
    comesFrom?: RouterResponse,
  ): Promise<RouterResponse> {
    const headers = new Headers(init.headers);
    init.headers = headers;

    let buffer: Buffer;
    if (body instanceof Buffer) {
      buffer = body;
    } else if (body instanceof Uint8Array) {
      buffer = Buffer.from(body);
    } else if (body instanceof ArrayBuffer) {
      buffer = Buffer.from(body);
    } else if (typeof body === "string") {
      buffer = Buffer.from(new TextEncoder().encode(body));
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "text/plain");
      }
    } else {
      if (!(body instanceof Response)) {
        if (!(await body.exists())) {
          return new RouterResponse(Buffer.from("File Not Found"), {
            status: 404,
          }, comesFrom);
        }
        headers.set("Content-Type", body.type);
        headers.set("Last-Modified", new Date(body.lastModified).toUTCString());
      }
      const bytes = await body.arrayBuffer();
      buffer = Buffer.from(bytes);
    }
    return new RouterResponse(buffer, init, comesFrom);
  }

  private logData: Record<string, string> = {};

  public constructor(
    private _arrBuff: Buffer,
    init?: ResponseInit,
    comesFrom?: RouterResponse,
  ) {
    super(_arrBuff, init);
    if (comesFrom) {
      this.logData = { ...comesFrom.logData };
    }
  }

  public setLogData(key: string, data: string): void {
    this.logData[key] = data;
  }

  public getLogData(): Record<string, string> {
    return this.logData;
  }

  public getBuffer(): Buffer {
    return this._arrBuff;
  }
}
