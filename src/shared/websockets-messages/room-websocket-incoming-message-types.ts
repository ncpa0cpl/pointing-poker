import type { GetDataType } from "dilswer";
import { OptionalField, Type } from "dilswer";

export enum IncomingMessageType {
  INITIATE = "connection:initiate",
  CLOSE = "connection:close",
  PONG = "connection:pong",
  SET_DEFAULT_OPTIONS = "room:set-default-options",
  ADD_ROUND_VOTE = "round:add-vote",
  CHANGE_OWNER = "room:change-owner",
  POST_MESSAGE = "room:post-message",
  CANCEL_LAST_ROUND = "round:cancel",
  FINISH_LAST_ROUND = "round:finish",
  CREATE_NEW_ROUND = "round:create",
}

export const DTRoomCreateNewRoundOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.CREATE_NEW_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTRoomOpenConnectionIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.INITIATE),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  publicUserID: Type.String,
  username: Type.String,
});

export const DTSetRoomDefaultOptionsIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.SET_DEFAULT_OPTIONS),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  options: Type.ArrayOf(Type.String),
});

export const DTAddRoundVoteIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.ADD_ROUND_VOTE),
  messageID: Type.String,
  userID: Type.String,
  roomID: Type.String,
  roundID: Type.String,
  optionRef: Type.String,
});

export const DTPostMessageIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.POST_MESSAGE),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  text: Type.String,
});

export const DTCancelLastRoundIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.CANCEL_LAST_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTChangeRoomOwnerIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.CHANGE_OWNER),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  newOwnerID: Type.String,
});

export const DTFinishLastRoundIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.FINISH_LAST_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTCloseRoomConnectionIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.CLOSE),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTPongIncomingMessage = Type.RecordOf({
  type: Type.EnumMember(IncomingMessageType.PONG),
  messageID: OptionalField(Type.Undefined),
});

export const DTRoomWSIncomingMessage = Type.OneOf(
  DTRoomOpenConnectionIncomingMessage,
  DTRoomCreateNewRoundOutgoingMessage,
  DTSetRoomDefaultOptionsIncomingMessage,
  DTAddRoundVoteIncomingMessage,
  DTPostMessageIncomingMessage,
  DTCancelLastRoundIncomingMessage,
  DTChangeRoomOwnerIncomingMessage,
  DTFinishLastRoundIncomingMessage,
  DTCloseRoomConnectionIncomingMessage,
  DTPongIncomingMessage,
);

// TS types

export type RoomCreateNewRoundOutgoingMessage = GetDataType<
  typeof DTRoomCreateNewRoundOutgoingMessage
>;

export type RoomOpenConnectionIncomingMessage = GetDataType<
  typeof DTRoomOpenConnectionIncomingMessage
>;

export type SetRoomDefaultOptionsIncomingMessage = GetDataType<
  typeof DTSetRoomDefaultOptionsIncomingMessage
>;

export type AddRoundVoteIncomingMessage = GetDataType<
  typeof DTAddRoundVoteIncomingMessage
>;

export type PostMessageIncomingMessage = GetDataType<
  typeof DTPostMessageIncomingMessage
>;

export type CancelLastRoundIncomingMessage = GetDataType<
  typeof DTCancelLastRoundIncomingMessage
>;

export type ChangeRoomOwnerIncomingMessage = GetDataType<
  typeof DTChangeRoomOwnerIncomingMessage
>;

export type FinishLastRoundIncomingMessage = GetDataType<
  typeof DTFinishLastRoundIncomingMessage
>;

export type CloseRoomConnectionIncomingMessage = GetDataType<
  typeof DTCloseRoomConnectionIncomingMessage
>;

export type RoomWSIncomingMessage = GetDataType<typeof DTRoomWSIncomingMessage>;
