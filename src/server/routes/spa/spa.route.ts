import path from "path";
import { ROOT_DIR } from "../../root-dir";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const pubDir = path.resolve(ROOT_DIR, "./dist/esm/public");

export function addSpaRoute(server: HttpServer) {
  server.get("/*", async (ctx) => {
    const wildcard = ctx.getPathWildcard();
    if (wildcard) {
      const filepath = path.join(pubDir, wildcard);
      const file = Bun.file(filepath);
      if (await file.exists()) {
        return ctx.sendFile(200, file);
      }
    }

    const indexFile = Bun.file(
      path.join(pubDir, "index.html"),
    );
    return ctx.sendFile(200, indexFile);
  });
}
