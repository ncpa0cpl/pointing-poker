import type { GetDataType } from "dilswer";
import { Omit, OptionalField, Type } from "dilswer";

export enum OutgoingMessageType {
  /** A message notifiying about an error that occured while processing an incoming message. */
  ERROR = "connection:error",
  /** A message sent to the client to check if the connection is still alive. */
  PING = "connection:ping",
  /** A message sent back to the client when the client has successfully joined the room requested. */
  ROOM_CONNECTED = "room:connected",
  /** A message sent back to the client when the Room owner has changed. */
  OWNER_UPDATE = "room:owner-change",
  /** A message sent back to the client when the current round has been updated (votes added, round finished, etc). */
  ROUND_UPDATE = "round:update",
  /** A message sent back to the client when the room state has changed (new round started, round config change) */
  ROOM_UPDATE = "room:update",
  /** A message sent back to the client when new chat messages have been added to the room. */
  ROOM_CHAT_UPDATE = "room:chat-update",
  /** Notifies the clients that some other user has joined or left the room. */
  ROOM_PARTICIPANTS_UPDATE = "room:participants-change",
  /** Notifies the clients that the room they are connected to has been closed or is not available. */
  ROOM_CLOSED = "room:closed",
  /** Sent back to the sender of a WS message to acknowledge that it was received. */
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
  type: Type.EnumMember(OutgoingMessageType.ROOM_CONNECTED),
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

export const DTRoomClosedOutgoingMessage = Type.RecordOf({
  type: Type.EnumMember(OutgoingMessageType.ROOM_CLOSED),
  roomID: Type.String,
});

export const DTRoomWSOutgoingMessage = Type.OneOf(
  DTRoomConnectionOpenedOutgoingMessage,
  DTRoomClosedOutgoingMessage,
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
