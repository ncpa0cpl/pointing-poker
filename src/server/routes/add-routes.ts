import type { HttpServer } from "../utilities/simple-server/http-server";
import { addCreateRoomRoute } from "./create-room/create-room";
import { addRoomWsRoute } from "./room-ws/room-ws.route";
import { addPublicDirRoute } from "./spa/public-files.route";
import { addSitemapRoute } from "./spa/sitemap";
import { addSpaRoute } from "./spa/spa.route";
import { addStatsRoutes } from "./stats/stats";

export function addRoutes(server: HttpServer) {
  addCreateRoomRoute(server);
  addRoomWsRoute(server);
  addPublicDirRoute(server);
  addSitemapRoute(server);
  addStatsRoutes(server);
  addSpaRoute(server);
}
