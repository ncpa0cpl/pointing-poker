import type { Server } from "bun";
import path from "node:path";
import { CompiledPath } from "../compiled-path";
import { Context } from "../context";
import type { Route } from "../router";
import { routerRequest } from "../router-request";
import { RouterResponse } from "../router-response";

export class StaticFileRoute implements Route {
  private readonly compiledPath: CompiledPath;

  public constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly dirPath: string,
    public readonly beforeSend: (ctx: Context) => Context = (ctx) => ctx,
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
  ): Promise<RouterResponse | undefined> {
    const result = this.compiledPath.parse(url.pathname);
    if (result instanceof Error || !result.wildcardValue) {
      return RouterResponse.from(
        "Not Found",
        { status: 404, statusText: "Not Found" },
      );
    }

    let subpath = result.wildcardValue;
    if (subpath.split("/").includes("..")) {
      return RouterResponse.from(
        "Not Found",
        { status: 404, statusText: "Not Found" },
      );
    }
    if (subpath.startsWith("/")) {
      subpath = subpath.substring(1);
    }

    const filePath = path.resolve(this.dirPath, subpath);
    const file = Bun.file(filePath);

    let ctx = new Context(
      routerRequest(bunServer, request),
      bunServer,
      url,
      {},
      result.wildcardValue,
    );
    ctx.sendFile(200, file);
    ctx.logValue("file_location", filePath);
    ctx = this.beforeSend(ctx);

    return Context.createResponse(ctx);
  }

  public toView() {
    return {
      httpMethod: this.method,
      urlPattern: this.path,
      directory: this.dirPath,
      type: "static-file-route",
    };
  }
}
