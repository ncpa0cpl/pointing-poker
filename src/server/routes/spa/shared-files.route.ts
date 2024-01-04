import path from "path";
import { fileURLToPath } from "url";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function addSharedFilesRoute(server: HttpServer) {
  server.static("/shared", path.resolve(__dirname, "../../../shared"));
}
