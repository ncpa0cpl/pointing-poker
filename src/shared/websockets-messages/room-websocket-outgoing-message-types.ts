import type { GetDataType } from "dilswer";
import { Omit, OptionalField, Type } from "dilswer";

export enum OutgoingMessageType {
  INITIATED = "connection:initiated",
  ERROR = "connection:error",
  PING = "connection:ping",
  OWNER_UPDATE = "room:owner-change",
  ROUND_UPDATE = "round:update",
  ROOM_UPDATE = "room:update",
  ROOM_CHAT_UPDATE = "room:chat-update",
  ROOM_PARTICIPANTS_UPDATE = "room:participants-change",
  MESSAGE_RECEIVED = "message:received",
}

export const DTParticipant = Type.RecordOf({
  isActive: Type.Boolean,
  publicID: Type.String,
  username: Type.String,
});

export const DTDefaultOption = Type.RecordOf({
  id: Type.String,
  name: Type.String,
});

export const DTChatMessage = Type.RecordOf({
  text: Type.String,
  publicUserID: OptionalField(Type.String),
  username: OptionalField(Type.String),
  sentAt: Type.String,
});

export const DTRoundUpdateOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ROUND_UPDATE),
  id: Type.String,
  isInProgress: Type.Boolean,
  hasResults: Type.Boolean,
  options: Type.ArrayOf(
    Type.RecordOf({
      id: Type.String,
      name: Type.String,
    }),
  ),
  results: Type.ArrayOf(
    Type.RecordOf({
      publicUserID: Type.String,
      username: Type.String,
      vote: Type.String,
    }),
  ),
  finalResult: OptionalField(
    Type.RecordOf({
      votes: Type.Number,
      mean: Type.String,
      mode: Type.String,
      median: Type.String,
    }),
  ),
});

export const DTRoomChatUpdateOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ROOM_CHAT_UPDATE),
  chatMessages: Type.ArrayOf(DTChatMessage),
});

export const DTRoomOwnerUpdateOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.OWNER_UPDATE),
  ownerPublicID: Type.String,
  ownerName: Type.String,
});

export const DTRoomUpdateOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ROOM_UPDATE),
  ownerPublicID: Type.String,
  ownerName: Type.String,
  roomID: Type.String,
  chatMessages: Type.ArrayOf(DTChatMessage),
  rounds: Type.ArrayOf(Omit(DTRoundUpdateOutgoingMessage, "type")),
  participants: Type.ArrayOf(DTParticipant),
  defaultOptions: Type.ArrayOf(DTDefaultOption),
});

export const DTRoomConnectionOpenedOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.INITIATED),
  connectionID: Type.String,
  room: Omit(DTRoomUpdateOutgoingMessage, "type"),
  userPublicID: Type.String,
});

export const DTRoomParticipantsUpdateOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE),
  participants: Type.ArrayOf(DTParticipant),
});

export const DTErrorMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ERROR),
  code: Type.Number,
  message: Type.String,
  causedBy: Type.String,
});

export const DTPingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.PING),
});

export const DTMessageReceivedMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.MESSAGE_RECEIVED),
  messageID: Type.String,
});

export const DTRoomWSOutgoingMessage = Type.OneOf(
  DTRoomConnectionOpenedOutgoingMessage,
  DTRoomOwnerUpdateOutgoingMessage,
  DTRoundUpdateOutgoingMessage,
  DTRoomChatUpdateOutgoingMessage,
  DTRoomUpdateOutgoingMessage,
  DTRoomParticipantsUpdateOutgoingMessage,
  DTErrorMessage,
  DTPingMessage,
  DTMessageReceivedMessage,
);

// TS types

export type DefaultOption = GetDataType<typeof DTDefaultOption>;

export type ChatMessageView = GetDataType<typeof DTChatMessage>;

export type RoomConnectionInitiatedOutgoingMessage = GetDataType<
  typeof DTRoomConnectionOpenedOutgoingMessage
>;

export type RoomOwnerUpdateOutgoingMessage = GetDataType<
  typeof DTRoomOwnerUpdateOutgoingMessage
>;

export type RoundUpdateOutgoingMessage = GetDataType<
  typeof DTRoundUpdateOutgoingMessage
>;

export type RoomChatUpdateOutgoingMessage = GetDataType<
  typeof DTRoomChatUpdateOutgoingMessage
>;

export type RoomUpdateOutgoingMessage = GetDataType<
  typeof DTRoomUpdateOutgoingMessage
>;

export type RoomParticipantsUpdateOutgoingMessage = GetDataType<
  typeof DTRoomParticipantsUpdateOutgoingMessage
>;

export type ErrorMessage = GetDataType<typeof DTErrorMessage>;

export type RoomWSOutgoingMessage = GetDataType<typeof DTRoomWSOutgoingMessage>;

export type MessageReceivedOutgoingMessage = GetDataType<
  typeof DTMessageReceivedMessage
>;
