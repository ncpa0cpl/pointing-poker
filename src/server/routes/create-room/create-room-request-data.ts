import { Type } from "dilswer";

export const DTCreateRoomRequestData = Type.Record({
  userID: Type.String,
  username: Type.String,
  persistent: Type.Option(Type.Boolean),
});
