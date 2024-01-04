import type { Server, ServerWebSocket } from "bun";
import { CompiledPath } from "../compiled-path";
import type { Route } from "../router";

export interface WsHandlers<T> {
  message(ws: ServerWebSocket<T>, message: string | Buffer): void;
  close(ws: ServerWebSocket<T>): void;
}

export type GetWsHandlers<T> = (ws: ServerWebSocket<T>) => WsHandlers<T>;

export class WebsocketRoute<T> implements Route {
  private readonly compiledPath: CompiledPath;

  public constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly onOpen: GetWsHandlers<T>,
  ) {
    this.compiledPath = new CompiledPath(path);
  }

  public matches(
    method: string,
    url: string,
  ): boolean {
    if (this.method !== method) {
      return false;
    }

    return this.compiledPath.compare(url);
  }

  public async handleRequest(
    request: Request,
    bunServer: Server,
  ): Promise<Response | undefined> {
    const ok = bunServer.upgrade(request, {
      data: { getHandlers: this.onOpen },
    });
    if (ok) {
      return;
    }
    return new Response("Internal server error", {
      status: 500,
      statusText: "Internal server error",
    });
  }

  public toView() {
    return {
      httpMethod: this.method,
      urlPattern: this.path,
      type: "websocket-route",
    };
  }
}
