import path from "node:path";
import { ROOT_DIR } from "../../root-dir";
import type { HttpServer } from "../../utilities/simple-server/http-server";

export const PUBLIC_DIR = path.resolve(ROOT_DIR, "./dist/public");

export function addPublicDirRoute(server: HttpServer) {
  server.static(
    "/public",
    PUBLIC_DIR,
    ctx => {
      return ctx.setCacheControl({
        maxAge: 30 * 24 * 60 * 60,
        mustRevalidate: true,
      });
    },
  );
}
