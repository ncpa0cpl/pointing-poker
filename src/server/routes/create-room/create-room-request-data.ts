import { Type } from "dilswer";

export const DTCreateRoomRequestData = Type.Record({
  userID: Type.String,
  username: Type.String,
});
