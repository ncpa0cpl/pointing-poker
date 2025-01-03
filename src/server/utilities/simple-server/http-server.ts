import { BunFile, Server } from "bun";
import path from "path";
import type { Context } from "./context";
import type { Route } from "./router";
import { Router } from "./router";
import { RouterRequest } from "./router-request";
import type { RouterResponse } from "./router-response";
import type { RouteHandler } from "./routes/custom-route";
import { CustomRoute } from "./routes/custom-route";
import { StaticFileRoute } from "./routes/static-file-route";
import type {
  BeforeUpgradeHandler,
  GetWsHandlers,
} from "./routes/websocket-route";
import { WebsocketRoute } from "./routes/websocket-route";
import { ServeHandler } from "./serve-handler";

export type MaybePromise<T> = T | Promise<T>;

export interface HttpServerOptions {
  allowedOrigins?: string[] | "*";
  allowedHeaders?: string[] | "*";
  accessControlMaxAge?: number;
  mode?: "development" | "production";
  forceHttps?: boolean;
  maxBodySize?: number;
  tlsCert?: BunFile;
  tlsKey?: BunFile;
  onRouteError?(
    err: unknown,
    request: Request,
    route: Route,
  ): RouterResponse | Promise<RouterResponse>;
}

export interface RequestMiddleware {
  (
    request: RouterRequest,
    server: Server,
  ): MaybePromise<RouterResponse | Request | void>;
}

export interface ResponseMiddleware {
  (
    response: RouterResponse,
    request: RouterRequest,
    server: Server,
  ): MaybePromise<RouterResponse>;
}

export class HttpServer {
  public static findRoute(
    method: string,
    url: string,
    server: HttpServer,
  ) {
    return server.router.findRoute(method, url);
  }

  private readonly requestMiddleware: RequestMiddleware[] = [];
  private readonly responseMiddleware: ResponseMiddleware[] = [];
  private readonly router = new Router();

  public onRequest(middleware: RequestMiddleware) {
    this.requestMiddleware.push(middleware);
  }

  public onResponse(middleware: ResponseMiddleware) {
    this.responseMiddleware.push(middleware);
  }

  public any(
    method: string,
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        method,
        path,
        handler,
      ),
    );
  }

  public get(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "GET",
        path,
        handler,
      ),
    );
  }

  public post(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "POST",
        path,
        handler,
      ),
    );
  }

  public delete(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "DELETE",
        path,
        handler,
      ),
    );
  }

  public put(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "PUT",
        path,
        handler,
      ),
    );
  }

  public patch(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "PATCH",
        path,
        handler,
      ),
    );
  }

  public head(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "HEAD",
        path,
        handler,
      ),
    );
  }

  public ws<T>(
    path: string,
    onOpen: GetWsHandlers<T>,
    beforeUpgrade?: BeforeUpgradeHandler,
  ) {
    this.router.addRoute(
      new WebsocketRoute(
        "GET",
        path,
        onOpen,
        beforeUpgrade,
      ),
    );
  }

  public static(
    urlPath: string,
    dirPath: string,
    beforeSend?: (ctx: Context) => Context,
  ) {
    this.router.addRoute(
      new StaticFileRoute(
        "GET",
        path.join(urlPath, "/*subpath"),
        dirPath,
        beforeSend,
      ),
    );
  }

  public listen(port: number, options: HttpServerOptions = {}) {
    const serve = new ServeHandler(
      this,
      this.requestMiddleware,
      this.responseMiddleware,
      options,
      port,
    );
    return Bun.serve({
      fetch(...args) {
        return serve.fetch(...args);
      },
      websocket: serve.websocket,
      port: serve.port,
      development: options.mode === "development",
      // 512KB max body size
      maxRequestBodySize: options.maxBodySize,
      tls: {
        cert: options.tlsCert,
        key: options.tlsKey,
      },
    });
  }
}
