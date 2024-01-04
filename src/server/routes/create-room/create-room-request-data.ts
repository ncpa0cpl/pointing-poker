import { DataType } from "dilswer";

export const DTCreateRoomRequestData = DataType.RecordOf({
  userID: DataType.String,
  username: DataType.String,
});
