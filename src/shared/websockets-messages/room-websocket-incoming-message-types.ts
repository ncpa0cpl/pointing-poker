import type { Infer } from "dilswer";
import { Type } from "dilswer";

export enum IncomingMessageType {
  /** A message sent to the client to check if the connection is still alive. */
  PONG = "connection:pong",
  /** A message sent by the client to request joining a room. */
  ROOM_CONNECT = "room:connect",
  /** A message sent by the client to request leaving a room. */
  ROOM_DISCONNECT = "room:disconnect",
  /** A message sent by the client to set the default options for the room. (owner only) */
  SET_DEFAULT_OPTIONS = "room:set-default-options",
  /** A message sent by the client to add a vote to the current round. */
  ADD_ROUND_VOTE = "round:add-vote",
  /** A message sent by the client to transfer the ownership to another user. */
  CHANGE_OWNER = "room:change-owner",
  /** A message sent by the client to post a message to the chat. */
  POST_MESSAGE = "room:post-message",
  /** A message sent by the client to cancel the last round. */
  CANCEL_LAST_ROUND = "round:cancel",
  /** A message sent by the client to finish the current round. */
  FINISH_LAST_ROUND = "round:finish",
  /** A message sent by the client to start a new round. */
  CREATE_NEW_ROUND = "round:create",
}

export const DTRoomCreateNewRoundOutgoingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.CREATE_NEW_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTRoomOpenConnectionIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.ROOM_CONNECT),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  publicUserID: Type.String,
  username: Type.String,
});

export const DTSetRoomDefaultOptionsIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.SET_DEFAULT_OPTIONS),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  options: Type.Array(Type.String),
});

export const DTAddRoundVoteIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.ADD_ROUND_VOTE),
  messageID: Type.String,
  userID: Type.String,
  roomID: Type.String,
  roundID: Type.String,
  optionRef: Type.String,
});

export const DTPostMessageIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.POST_MESSAGE),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  text: Type.String,
});

export const DTCancelLastRoundIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.CANCEL_LAST_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTChangeRoomOwnerIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.CHANGE_OWNER),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
  newOwnerID: Type.String,
});

export const DTFinishLastRoundIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.FINISH_LAST_ROUND),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTCloseRoomConnectionIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.ROOM_DISCONNECT),
  messageID: Type.String,
  roomID: Type.String,
  userID: Type.String,
});

export const DTPongIncomingMessage = Type.Record({
  type: Type.EnumMember(IncomingMessageType.PONG),
  messageID: Type.Option(Type.Undefined),
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

export type RoomCreateNewRoundOutgoingMessage = Infer<
  typeof DTRoomCreateNewRoundOutgoingMessage
>;

export type RoomOpenConnectionIncomingMessage = Infer<
  typeof DTRoomOpenConnectionIncomingMessage
>;

export type SetRoomDefaultOptionsIncomingMessage = Infer<
  typeof DTSetRoomDefaultOptionsIncomingMessage
>;

export type AddRoundVoteIncomingMessage = Infer<
  typeof DTAddRoundVoteIncomingMessage
>;

export type PostMessageIncomingMessage = Infer<
  typeof DTPostMessageIncomingMessage
>;

export type CancelLastRoundIncomingMessage = Infer<
  typeof DTCancelLastRoundIncomingMessage
>;

export type ChangeRoomOwnerIncomingMessage = Infer<
  typeof DTChangeRoomOwnerIncomingMessage
>;

export type FinishLastRoundIncomingMessage = Infer<
  typeof DTFinishLastRoundIncomingMessage
>;

export type CloseRoomConnectionIncomingMessage = Infer<
  typeof DTCloseRoomConnectionIncomingMessage
>;

export type RoomWSIncomingMessage = Infer<typeof DTRoomWSIncomingMessage>;
