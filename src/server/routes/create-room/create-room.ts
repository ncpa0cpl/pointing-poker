import { compileFastValidator } from "dilswer";
import { RoomService } from "../../rooms/room-sevice";
import { createResponse } from "../../utilities/response";
import type { HttpServer } from "../../utilities/simple-server/http-server";
import { DTCreateRoomRequestData } from "./create-room-request-data";

const validate = compileFastValidator(DTCreateRoomRequestData);

export function addCreateRoomRoute(server: HttpServer) {
  server.post("/api/room", async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.body("json");
    } catch {
      // ctx.body("json") throws on unparsable payloads; left uncaught it
      // escapes the route handler and the error handler answers a 500
      return ctx.sendStatus(400);
    }
    if (!validate(body)) {
      return ctx.send(createResponse(400));
    }
    // Type.String still accepts "", which is not a usable identifier
    if (body.userID === "" || body.username === "") {
      return ctx.send(createResponse(400));
    }

    const room = RoomService.createRoom(
      body.userID,
      body.username,
      body.persistent ?? false,
    );

    if (!room) {
      return ctx.sendStatus(503, "Too many rooms.");
    }

    ctx.logValue("created_room", room.id);
    return ctx.sendJson(200, { roomID: room.id });
  });
}
