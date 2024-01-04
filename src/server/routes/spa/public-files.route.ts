import path from "node:path";
import { fileURLToPath } from "url";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function addPublicDirRoute(server: HttpServer) {
  server.static("/public", path.resolve(__dirname, "../../../public"));
}
