import type { ServerWebSocket } from "bun";
import type { HttpServer } from "./http-server";
import type { WsHandlers } from "./routes/websocket-route";
import type { ServeHandler } from "./serve-handler";

export class WsHandler<T> {
  private handlers: Map<ServerWebSocket<T>, WsHandlers<T>> = new Map();

  public constructor(
    private readonly server: HttpServer,
    private readonly serverHandler: ServeHandler,
  ) {
    this.open = this.open.bind(this);
    this.message = this.message.bind(this);
    this.close = this.close.bind(this);
  }

  public open(ws: ServerWebSocket<T>) {
    const { getHandlers } = ws.data as {
      getHandlers: (ws: ServerWebSocket<T>) => WsHandlers<T>;
    };

    const handlers = getHandlers(ws);
    this.handlers.set(ws, handlers);
  }

  public message(ws: ServerWebSocket<T>, message: string | Buffer) {
    const handlers = this.handlers.get(ws);
    handlers?.message(ws, message);
  }

  public close(ws: ServerWebSocket<T>) {
    const handlers = this.handlers.get(ws);
    this.handlers.delete(ws);
    handlers?.close(ws);
  }
}
