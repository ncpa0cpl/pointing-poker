import type { Server } from "bun";
import { CompiledPath } from "../compiled-path";
import { Context } from "../context";
import type { Route } from "../router";

export type RouteHandler = (ctx: Context) => Context | Promise<Context>;

export class CustomRoute implements Route {
  private readonly compiledPath: CompiledPath;

  public constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly handler: RouteHandler,
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
    url: URL,
  ): Promise<Response | undefined> {
    const parsedUrl = this.compiledPath.parse(url.pathname);

    if (parsedUrl instanceof Error) {
      return new Response(
        "Internal server error",
        { status: 500, statusText: "Internal server error" },
      );
    }

    const ctx = new Context(
      request,
      bunServer,
      url,
      parsedUrl.params,
      parsedUrl.wildcardValue,
    );
    await this.handler(ctx);
    return Context.createResponse(ctx);
  }

  public toView() {
    return {
      httpMethod: this.method,
      urlPattern: this.path,
      type: "custom-route",
    };
  }
}
