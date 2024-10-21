import { compileFastValidator } from "dilswer";
import { RoomService } from "../../rooms/room-sevice";
import { createResponse } from "../../utilities/response";
import type { HttpServer } from "../../utilities/simple-server/http-server";
import { DTCreateRoomRequestData } from "./create-room-request-data";

const validate = compileFastValidator(DTCreateRoomRequestData);

export function addCreateRoomRoute(server: HttpServer) {
  server.post("/api/room", async (ctx) => {
    const body = await ctx.body("json");
    if (!validate(body)) {
      return ctx.send(createResponse(400));
    }

    const room = RoomService.createRoom(body.userID, body.username);

    if (!room) {
      return ctx.sendStatus(503, "Too many rooms.");
    }

    ctx.logValue("created_room", room.id);
    return ctx.sendJson(200, { roomID: room.id });
  });
}
