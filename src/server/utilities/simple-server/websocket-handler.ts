import type { ServerWebSocket } from "bun";
import { logger } from "../../app-logger";
import type { HttpServer } from "./http-server";
import type { WsHandlers } from "./routes/websocket-route";
import type { ServeHandler } from "./serve-handler";

export class WsHandler<T> {
  private handlers: Map<ServerWebSocket<T>, WsHandlers<T>> = new Map();

  public constructor(
    protected readonly server: HttpServer,
    protected readonly serverHandler: ServeHandler,
  ) {
    this.open = this.open.bind(this);
    this.message = this.message.bind(this);
    this.close = this.close.bind(this);
  }

  public open(ws: ServerWebSocket<T>) {
    try {
      const { getHandlers } = ws.data as {
        getHandlers: (ws: ServerWebSocket<T>) => WsHandlers<T>;
      };

      const handlers = getHandlers(ws);
      this.handlers.set(ws, handlers);
    } catch (err) {
      logger.error("Failed to open websocket", err);
      this.handlers.delete(ws);
      ws.terminate();
    }
  }

  public message(ws: ServerWebSocket<T>, message: string | Buffer) {
    try {
      const handlers = this.handlers.get(ws);
      handlers?.message(ws, message);
    } catch (err) {
      logger.error("Failed to handle websocket message", err);
      this.handlers.delete(ws);
      ws.terminate();
    }
  }

  public close(ws: ServerWebSocket<T>) {
    try {
      const handlers = this.handlers.get(ws);
      this.handlers.delete(ws);
      handlers?.close(ws);
    } catch (err) {
      logger.error("Failed to close websocket", err);
      this.handlers.delete(ws);
      ws.terminate();
    }
  }
}
