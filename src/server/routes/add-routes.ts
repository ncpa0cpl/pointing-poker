import type { HttpServer } from "../utilities/simple-server/http-server";
import { addCreateRoomRoute } from "./create-room/create-room";
import { addRoomWsRoute } from "./room-ws/room-ws.route";
import { addPublicDirRoute } from "./spa/public-files.route";
import { addSpaRoute } from "./spa/spa.route";

export function addRoutes(server: HttpServer) {
  addCreateRoomRoute(server);
  addRoomWsRoute(server);
  addPublicDirRoute(server);
  addSpaRoute(server);
}
