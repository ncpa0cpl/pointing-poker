import type { Server } from "bun";
import path from "node:path";
import { CompiledPath } from "../compiled-path";
import type { Route } from "../router";

export class StaticFileRoute implements Route {
  private readonly compiledPath: CompiledPath;

  public constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly dirPath: string,
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
    const result = this.compiledPath.parse(url.pathname);
    if (result instanceof Error || !result.wildcardValue) {
      return new Response(
        "Not Found",
        { status: 404, statusText: "Not Found" },
      );
    }

    let subpath = result.wildcardValue;
    if (subpath.startsWith("/")) {
      subpath = subpath.substring(1);
    }

    const filePath = path.resolve(this.dirPath, subpath);
    const file = Bun.file(filePath);

    return new Response(file, { status: 200 });
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
