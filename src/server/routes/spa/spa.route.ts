import path from "path";
import { fileURLToPath } from "url";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function addSpaRoute(server: HttpServer) {
  server.get("/*", (ctx) => {
    const file = Bun.file(
      path.resolve(__dirname, "../../../public/index.html"),
    );
    return ctx.sendFile(200, file);
  });
}
