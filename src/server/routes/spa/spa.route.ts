import path from "path";
import { fileURLToPath } from "url";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pubDir = path.resolve(__dirname, "../../../public");

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
