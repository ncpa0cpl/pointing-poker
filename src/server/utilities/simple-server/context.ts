import type { BunFile, Server } from "bun";
import type { CacheConfig } from "./headers/generate-cache-control-header";
import { generateCacheControlHeader } from "./headers/generate-cache-control-header";
import type { MaybePromise } from "./http-server";
import { RouterResponse } from "./router-response";

type ResponseData = {
  body: any;
  status: number;
  statusText: string;
};

const copyHeaders = (from: Headers, to: Headers) => {
  for (const [name, value] of from.entries()) {
    to.set(name, value);
  }
};

export class Context {
  public static createResponse(
    ctx: Context,
  ): MaybePromise<RouterResponse | undefined> {
    if (ctx.dontSendResponse) {
      return;
    }

    let response: Promise<RouterResponse>;

    if (ctx.responseData instanceof RouterResponse) {
      copyHeaders(ctx.responseHeaders, ctx.responseData.headers);
      response = Promise.resolve(ctx.responseData);
    } else {
      response = RouterResponse.from(
        ctx.responseData.body,
        {
          headers: ctx.responseHeaders,
          status: ctx.responseData.status,
          statusText: ctx.responseData.statusText,
        },
      );
    }

    const logs = Object.entries(ctx.logData);
    if (ctx.sendType || logs.length > 0) {
      return response.then(r => {
        for (let i = 0; i < logs.length; i++) {
          const [key, value] = logs[i]!;
          r.setLogData(key, value);
        }
        if (ctx.sendType) {
          r.setLogData("responded_with", ctx.sendType);
        }
        return r;
      });
    }

    return response;
  }

  private sendType?: string;
  private logData: Record<string, string> = {};
  private responseData: ResponseData | RouterResponse = {
    body: "Not Found",
    status: 404,
    statusText: "Not Found",
  };
  private responseHeaders: Headers = new Headers();
  private dontSendResponse = false;

  public constructor(
    public readonly request: Request,
    public readonly bunServer: Server,
    public readonly url: URL,
    public readonly params: Record<string, string>,
    public readonly wildcardValue: null | string,
  ) {
  }

  public body(): ReadableStream<Uint8Array> | null;
  public body(type: "arrayBuffer"): Promise<ArrayBuffer>;
  public body(type: "blob"): Promise<Blob>;
  public body(type: "form"): Promise<FormData>;
  public body(type: "text"): Promise<string>;
  public body(type: "json"): Promise<unknown>;
  public body(
    type?: "arrayBuffer" | "blob" | "text" | "json" | "form",
  ):
    | Promise<
      | ArrayBuffer
      | Blob
      | FormData
      | string
      | unknown
    >
    | ReadableStream<Uint8Array>
    | null
  {
    switch (type) {
      case "arrayBuffer":
        return this.request.arrayBuffer();
      case "text":
        return this.request.text();
      case "json":
        return this.request.json();
      case "blob":
        return this.request.blob();
      case "form":
        return this.request.formData();
    }
    return this.request.body;
  }

  /**
   * Get the value of the url pattern parameter (defined with a colon in the route path)
   *
   * @example
   * server.get("/api/user/:id", (ctx) => {
   *   const id = ctx.getParam("id");
   * });
   */
  public getParam(name: string): string | undefined {
    return this.params[name];
  }

  /**
   * Get the value of the search parameter defined by the client in the url.
   * Search parameters are defined after the question mark in the url
   * (ex. /books?author=John+Doe)
   */
  public getSearchParam(name: string): string | null {
    return this.url.searchParams.get(name);
  }

  /**
   * Get all values associated with a given search parameter.
   * (ex. `/books?author=John&author=Bob` -> `getSearchParamAll("author") == ["John", "Bob"]`)
   */
  public getSearchParamAll(name: string): string[] {
    return this.url.searchParams.getAll(name);
  }

  /**
   * Get the url part that was matched agains the wildcard in the route path.
   *
   * @example
   * server.get("/api/user/*", (ctx) => {
   *  const wildcard = ctx.getPathWildcard();
   *  // wildcard == "123/info" (full url path was `/api/user/123/info`)
   * })
   */
  public getPathWildcard(): string | null {
    return this.wildcardValue;
  }

  /**
   * Sends the given response object.
   */
  public send(response: RouterResponse): Context {
    this.responseData = response;
    this.sendType = "response";
    return this;
  }

  /**
   * Sends a empty response with the given status code and status message.
   */
  public sendStatus(code: number, statusMessage?: string): Context {
    this.responseHeaders.delete("Content-Type");
    this.responseData = {
      body: statusMessage ?? "",
      status: code,
      statusText: statusMessage ?? "",
    };
    this.sendType = "status";
    return this;
  }

  /**
   * Creates a Response object with the given status code, and the given
   * data object encoded in JSON, and sends it.
   */
  public sendJson(code: number, data: any): Context {
    this.responseHeaders.set("Content-Type", "application/json");
    this.responseData = {
      body: JSON.stringify(data),
      status: code,
      statusText: "OK",
    };
    this.sendType = "json";
    return this;
  }

  /**
   * Creates a Response object with the given status code, and the given
   * data string with a html content type, and sends it.
   */
  public sendHtml(code: number, data: string): Context {
    this.responseHeaders.set("Content-Type", "text/html");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    this.sendType = "html";
    return this;
  }

  /**
   * Creates a Response object with the given status code, and the given
   * data string with a html content type, and sends it.
   */
  public sendXml(code: number, data: string): Context {
    this.responseHeaders.set("Content-Type", "application/xml");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    this.sendType = "xml";
    return this;
  }

  /**
   * Creates a Response object with the given status code, and the given
   * data string with a text content type, and sends it.
   */
  public sendText(code: number, data: string): Context {
    this.responseHeaders.set("Content-Type", "text/plain");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    this.sendType = "text";
    return this;
  }

  /**
   * Creates a Response object with the given status code, and the given
   * file data, and sends it.
   */
  public sendFile(
    code: number,
    data: Uint8Array | Blob | ReadableStream | BunFile,
  ): Context {
    this.responseHeaders.delete("Content-Type");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    this.sendType = "file";
    return this;
  }

  public noResponse(): Context {
    this.dontSendResponse = true;
    return this;
  }

  /**
   * Redirects the client to the given url with the given status code.
   * The code given should be one of: 301, 302, 303, 307, or 308.
   *
   * Codes reference:
   * - 301 - Moved Permanently (Reorganization of a website.)
   * - 302 - Found (The Web page is temporarily unavailable for unforeseen reasons.)
   * - 303 - See Other (Used to redirect after a PUT or a POST, so that refreshing the result page doesn't re-trigger the operation.)
   * - 307 - Temporary Redirect (The Web page is temporarily unavailable for unforeseen reasons. Better than 302 when non-GET operations are available on the site.)
   * - 308 - Permanent Redirect (Reorganization of a website, with non-GET links/operations.)
   */
  public redirect(code: number, url: string): Context {
    this.responseHeaders.set("Location", url);
    this.responseData = {
      body: "",
      status: code,
      statusText: "OK",
    };
    this.sendType = undefined;
    return this;
  }

  public setHeader(name: string, value: string): Context {
    this.responseHeaders.set(name, value);
    return this;
  }

  public setCacheControl(options: CacheConfig): Context {
    this.setHeader("Cache-Control", generateCacheControlHeader(options));
    return this;
  }

  /**
   * Adds a key-value pair to the log entry of the response
   * generated by this context.
   */
  public logValue(key: string, value: string): Context {
    this.logData[key] = value;
    return this;
  }
}
