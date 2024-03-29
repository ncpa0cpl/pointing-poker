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

    if (ctx.responseData instanceof RouterResponse) {
      copyHeaders(ctx.responseHeaders, ctx.responseData.headers);
      return ctx.responseData;
    }

    return RouterResponse.from(
      ctx.responseData.body,
      {
        headers: ctx.responseHeaders,
        status: ctx.responseData.status,
        statusText: ctx.responseData.statusText,
      },
    );
  }

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

  public getJsonBody<T>(): Promise<T> {
    return this.request.json();
  }

  public getParam(name: string): string | undefined {
    return this.params[name];
  }

  public getQParam(name: string): string | null {
    return this.url.searchParams.get(name);
  }

  public getAllQParams(name: string): string[] {
    return this.url.searchParams.getAll(name);
  }

  public getPathWildcard(): string | null {
    return this.wildcardValue;
  }

  public send(response: RouterResponse): Context {
    this.responseData = response;
    return this;
  }

  public sendJson(code: number, data: any): Context {
    this.responseHeaders.set("Content-Type", "application/json");
    this.responseData = {
      body: JSON.stringify(data),
      status: code,
      statusText: "OK",
    };
    return this;
  }

  public sendHtml(code: number, data: string): Context {
    this.responseHeaders.set("Content-Type", "text/html");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    return this;
  }

  public sendText(code: number, data: string): Context {
    this.responseHeaders.set("Content-Type", "text/plain");
    this.responseData = {
      body: data,
      status: code,
      statusText: "OK",
    };
    return this;
  }

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
    return this;
  }

  public noResponse(): Context {
    this.dontSendResponse = true;
    return this;
  }

  public redirect(code: number, url: string): Context {
    this.responseHeaders.set("Location", url);
    this.responseData = {
      body: "",
      status: code,
      statusText: "OK",
    };
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
}
