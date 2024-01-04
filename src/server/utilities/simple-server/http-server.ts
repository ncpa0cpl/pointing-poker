import path from "path";
import type { Route } from "./router";
import { Router } from "./router";
import type { RouteHandler } from "./routes/custom-route";
import { CustomRoute } from "./routes/custom-route";
import { StaticFileRoute } from "./routes/static-file-route";
import type { GetWsHandlers } from "./routes/websocket-route";
import { WebsocketRoute } from "./routes/websocket-route";
import { ServeHandler } from "./serve-handler";

export interface HttpServerOptions {
  onRouteError?(
    err: unknown,
    request: Request,
    route: Route,
  ): Response | Promise<Response>;
}

export class HttpServer {
  public static findRoute(
    method: string,
    url: string,
    server: HttpServer,
  ) {
    return server.router.findRoute(method, url);
  }

  private readonly router = new Router();

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

  public options(
    path: string,
    handler: RouteHandler,
  ) {
    this.router.addRoute(
      new CustomRoute(
        "OPTIONS",
        path,
        handler,
      ),
    );
  }

  public ws<T>(
    path: string,
    onOpen: GetWsHandlers<T>,
  ) {
    this.router.addRoute(
      new WebsocketRoute(
        "GET",
        path,
        onOpen,
      ),
    );
  }

  public static(urlPath: string, dirPath: string) {
    this.router.addRoute(
      new StaticFileRoute(
        "GET",
        path.join(urlPath, "/*subpath"),
        dirPath,
      ),
    );
  }

  public listen(port: number, options: HttpServerOptions = {}) {
    const serve = new ServeHandler(this, port);
    serve.onRouteError = options.onRouteError;
    return Bun.serve(serve);
  }
}
