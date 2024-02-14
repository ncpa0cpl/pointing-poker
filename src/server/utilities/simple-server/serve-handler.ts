import type { Server } from "bun";
import type {
  HttpServerOptions,
  RequestMiddleware,
  ResponseMiddleware,
} from "./http-server";
import { HttpServer } from "./http-server";
import { RouterResponse } from "./router-response";
import { WsHandler } from "./websocket-handler";

export class ServeHandler {
  public onRouteError: HttpServerOptions["onRouteError"] | undefined;

  public constructor(
    private readonly server: HttpServer,
    private readonly requestMiddleware: RequestMiddleware[],
    private readonly responseMiddleware: ResponseMiddleware[],
    public readonly port: number = 8080,
  ) {
    this.fetch = this.fetch.bind(this);
  }

  private notFoundResp() {
    return RouterResponse.from("Not Found", {
      status: 404,
      statusText: "Not Found",
    });
  }

  private internalErrorResp() {
    return RouterResponse.from("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  public websocket = new WsHandler(this.server, this);

  public async respond(
    request: Request,
    bunServer: Server,
  ): Promise<RouterResponse | undefined> {
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

  public async fetch(request: Request, bunServer: Server) {
    for (let i = 0; i < this.requestMiddleware.length; i++) {
      const middleware = this.requestMiddleware[i]!;
      const result = await middleware(request);
      if (result instanceof Response) {
        return result;
      }
      if (result instanceof Request) {
        request = result;
      }
    }

    let response = await this.respond(request, bunServer);

    if (response) {
      for (let i = 0; i < this.responseMiddleware.length; i++) {
        const middleware = this.responseMiddleware[i]!;
        response = await middleware(response, request);
      }
    }

    return response;
  }
}
