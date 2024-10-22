import type { Server } from "bun";
import { removeTrailing } from "../remove-trailing";
import type {
  HttpServerOptions,
  RequestMiddleware,
  ResponseMiddleware,
} from "./http-server";
import { HttpServer } from "./http-server";
import { RouterResponse } from "./router-response";
import { WsHandler } from "./websocket-handler";

export class ServeHandler {
  public websocket;
  private onRouteError: HttpServerOptions["onRouteError"] | undefined;

  public constructor(
    private readonly server: HttpServer,
    private readonly requestMiddleware: RequestMiddleware[],
    private readonly responseMiddleware: ResponseMiddleware[],
    private readonly options: HttpServerOptions,
    public readonly port: number = 8080,
  ) {
    this.fetch = this.fetch.bind(this);
    this.websocket = new WsHandler(this.server, this);

    if (options.onRouteError) {
      this.onRouteError = options.onRouteError;
    }

    if (Array.isArray(options.allowedHeaders)) {
      options.allowedHeaders = options.allowedHeaders.map(h =>
        h.trim().toLowerCase()
      );
    }
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

  private isHttps(request: Request): boolean {
    const url = new URL(request.url);
    if (url.protocol === "https:") {
      return true;
    }

    const forwardProto = request.headers.get("x-forwarded-proto");
    if (forwardProto === "https") {
      return true;
    }

    const forwarded = request.headers.get("forwarded");
    if (forwarded?.includes("proto=https")) {
      return true;
    }

    return false;
  }

  private isAllowedOrigin(origin: string | null): boolean | "*" {
    if (origin) {
      origin = removeTrailing(origin, "/");
      const { allowedOrigins } = this.options;
      if (allowedOrigins === "*") {
        return "*";
      } else if (
        Array.isArray(allowedOrigins)
      ) {
        for (let allowed of allowedOrigins) {
          allowed = removeTrailing(allowed, "/");
          if (allowed.startsWith("https") || allowed.startsWith("http")) {
            // only allows https origins
            if (origin === allowed) {
              return true;
            }
          } else {
            if (origin.startsWith("http")) {
              origin = origin.replace(/http(s)?:\/\//, "");
            }
            if (origin === allowed) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private async redirectToHttps(request: Request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    const Location = url.toString();
    const response = await RouterResponse.from("redirecting", {
      status: 308,
      headers: { Location },
    });
    response.setLogData("redirect_to", Location);
    return response;
  }

  private async respondToOptionsRequest(request: Request, bunServer: Server) {
    if (this.options.forceHttps && !this.isHttps(request)) {
      const response = await this.redirectToHttps(request);
      return response;
    }

    const url = new URL(request.url);
    const getRoute = HttpServer.findRoute(
      "GET",
      url.pathname,
      this.server,
    );
    const postRoute = HttpServer.findRoute(
      "POST",
      url.pathname,
      this.server,
    );
    const deleteRoute = HttpServer.findRoute(
      "DELETE",
      url.pathname,
      this.server,
    );
    const putRoute = HttpServer.findRoute(
      "PUT",
      url.pathname,
      this.server,
    );
    const patchRoute = HttpServer.findRoute(
      "PATCH",
      url.pathname,
      this.server,
    );

    const allowedMethods = [];
    if (getRoute) {
      allowedMethods.push("GET");
    }
    if (postRoute) {
      allowedMethods.push("POST");
    }
    if (deleteRoute) {
      allowedMethods.push("DELETE");
    }
    if (putRoute) {
      allowedMethods.push("PUT");
    }
    if (patchRoute) {
      allowedMethods.push("PATCH");
    }

    const respHeaders = new Headers();
    respHeaders.set("Vary", "Origin");
    respHeaders.set("Connection", "keep-alive");
    respHeaders.set("Access-Control-Allow-Methods", allowedMethods.join(", "));

    const reqOrigin = request.headers.get("Origin");
    const isAllowed = this.isAllowedOrigin(reqOrigin);
    if (isAllowed === "*") {
      respHeaders.set("Access-Control-Allow-Origin", "*");
    } else if (isAllowed) {
      respHeaders.set("Access-Control-Allow-Origin", reqOrigin!);
    }

    const requestedAllowedHeaders = request.headers.get(
      "Access-Control-Request-Headers",
    );
    if (requestedAllowedHeaders) {
      const { allowedHeaders } = this.options;
      if (allowedHeaders === "*") {
        respHeaders.set(
          "Access-Control-Allow-Headers",
          "*",
        );
      } else if (Array.isArray(allowedHeaders)) {
        const reqAskedHeaders = requestedAllowedHeaders.split(",").map(h =>
          h.trim().toLowerCase()
        );
        const respAllowedHeaders = [];
        for (const askedHeader of reqAskedHeaders) {
          if (allowedHeaders.includes(askedHeader)) {
            respAllowedHeaders.push(askedHeader);
          }
        }
        respHeaders.set(
          "Access-Control-Allow-Headers",
          respAllowedHeaders.join(", "),
        );
      }
    }

    if (this.options.accessControlMaxAge != null) {
      respHeaders.set(
        "Access-Control-Max-Age",
        String(this.options.accessControlMaxAge),
      );
    }

    return RouterResponse.empty(
      {
        headers: respHeaders,
        status: 204,
      },
    );
  }

  public async respond(
    request: Request,
    bunServer: Server,
  ): Promise<RouterResponse | undefined> {
    if (request.method !== "GET") {
      const origin = request.headers.get("Origin");
      const isAllowed = this.isAllowedOrigin(origin);
      if (isAllowed === false) {
        return RouterResponse.from("Forbidden", {
          status: 403,
          statusText: "Forbidden",
        });
      } else {
        if (isAllowed === "*") {
        }
      }
    }

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

  private addCorsHeaders(
    request: Request,
    response: RouterResponse | undefined,
  ): RouterResponse | undefined {
    if (response) {
      const respHeaders = response.headers;
      if (!respHeaders.has("Access-Control-Allow-Origin")) {
        const origin = request.headers.get("Origin");
        const isAllowed = this.isAllowedOrigin(origin);
        if (isAllowed === "*") {
          respHeaders.set("Access-Control-Allow-Origin", "*");
        } else if (isAllowed) {
          respHeaders.set("Access-Control-Allow-Origin", origin!);
        }
      }
      return response;
    }
  }

  public async fetch(request: Request, bunServer: Server) {
    if (request.method === "OPTIONS") {
      return this.respondToOptionsRequest(request, bunServer);
    }

    for (let i = 0; i < this.requestMiddleware.length; i++) {
      const middleware = this.requestMiddleware[i]!;
      const result = await middleware(request, bunServer);
      if (result instanceof Response) {
        return this.addCorsHeaders(request, result);
      }
      if (result instanceof Request) {
        request = result;
      }
    }

    let response: RouterResponse | undefined;
    if (this.options.forceHttps && !this.isHttps(request)) {
      response = await this.redirectToHttps(request);
    } else {
      response = await this.respond(request, bunServer);
    }

    if (response) {
      for (let i = 0; i < this.responseMiddleware.length; i++) {
        const middleware = this.responseMiddleware[i]!;
        response = await middleware(response, request, bunServer);
      }
    }

    return this.addCorsHeaders(request, response);
  }
}
