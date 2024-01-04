import type { Server } from "bun";
import type { HttpServerOptions } from "./http-server";
import { HttpServer } from "./http-server";
import { WsHandler } from "./websocket-handler";

export class ServeHandler {
  public onRouteError: HttpServerOptions["onRouteError"] | undefined;

  public constructor(
    private readonly server: HttpServer,
    public readonly port: number = 8080,
  ) {
    this.fetch = this.fetch.bind(this);
  }

  private notFoundResp() {
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  }

  private internalErrorResp() {
    return new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  public websocket = new WsHandler(this.server, this);

  public async fetch(
    request: Request,
    bunServer: Server,
  ): Promise<Response | undefined> {
    const url = new URL(request.url);

    const route = HttpServer.findRoute(
      request.method,
      url.pathname,
      this.server,
    );

    if (!route) {
      return this.notFoundResp();
    }

    try {
      const resp = await route.handleRequest(request, bunServer, url);
      return resp;
    } catch (err) {
      if (this.onRouteError) {
        return this.onRouteError(err, request, route);
      } else {
        return this.internalErrorResp();
      }
    }
  }
}
