import type { Infer } from "dilswer";
import { Omit, Type } from "dilswer";

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

export const DTParticipant = Type.Record({
  isActive: Type.Boolean,
  publicID: Type.String,
  username: Type.String,
});

export const DTDefaultOption = Type.Record({
  id: Type.String,
  name: Type.String,
});

export const DTChatMessage = Type.Record({
  text: Type.String,
  publicUserID: Type.Option(Type.String),
  username: Type.Option(Type.String),
  sentAt: Type.String,
});

export const DTRoundUpdateOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ROUND_UPDATE),
  id: Type.String,
  isInProgress: Type.Boolean,
  hasResults: Type.Boolean,
  options: Type.Array(
    Type.Record({
      id: Type.String,
      name: Type.String,
    }),
  ),
  results: Type.Array(
    Type.Record({
      publicUserID: Type.String,
      username: Type.String,
      vote: Type.String,
    }),
  ),
  finalResult: Type.Option(
    Type.Record({
      votes: Type.Number,
      mean: Type.String,
      mode: Type.String,
      median: Type.String,
    }),
  ),
});

export const DTRoomChatUpdateOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ROOM_CHAT_UPDATE),
  chatMessages: Type.Array(DTChatMessage),
});

export const DTRoomOwnerUpdateOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.OWNER_UPDATE),
  ownerPublicID: Type.String,
  ownerName: Type.String,
});

export const DTRoomUpdateOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ROOM_UPDATE),
  ownerPublicID: Type.String,
  ownerName: Type.String,
  roomID: Type.String,
  chatMessages: Type.Array(DTChatMessage),
  rounds: Type.Array(Omit(DTRoundUpdateOutgoingMessage, "type")),
  participants: Type.Array(DTParticipant),
  defaultOptions: Type.Array(DTDefaultOption),
});

export const DTRoomConnectionOpenedOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ROOM_CONNECTED),
  connectionID: Type.String,
  room: Omit(DTRoomUpdateOutgoingMessage, "type"),
  userPublicID: Type.String,
});

export const DTRoomParticipantsUpdateOutgoingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ROOM_PARTICIPANTS_UPDATE),
  participants: Type.Array(DTParticipant),
});

export const DTErrorMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.ERROR),
  code: Type.Number,
  message: Type.String,
  causedBy: Type.String,
});

export const DTPingMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.PING),
});

export const DTMessageReceivedMessage = Type.Record({
  type: Type.EnumMember(OutgoingMessageType.MESSAGE_RECEIVED),
  messageID: Type.String,
});

export const DTRoomClosedOutgoingMessage = Type.Record({
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

export type DefaultOption = Infer<typeof DTDefaultOption>;

export type ChatMessageView = Infer<typeof DTChatMessage>;

export type RoomConnectionInitiatedOutgoingMessage = Infer<
  typeof DTRoomConnectionOpenedOutgoingMessage
>;

export type RoomOwnerUpdateOutgoingMessage = Infer<
  typeof DTRoomOwnerUpdateOutgoingMessage
>;

export type RoundUpdateOutgoingMessage = Infer<
  typeof DTRoundUpdateOutgoingMessage
>;

export type RoomChatUpdateOutgoingMessage = Infer<
  typeof DTRoomChatUpdateOutgoingMessage
>;

export type RoomUpdateOutgoingMessage = Infer<
  typeof DTRoomUpdateOutgoingMessage
>;

export type RoomParticipantsUpdateOutgoingMessage = Infer<
  typeof DTRoomParticipantsUpdateOutgoingMessage
>;

export type ErrorMessage = Infer<typeof DTErrorMessage>;

export type RoomWSOutgoingMessage = Infer<typeof DTRoomWSOutgoingMessage>;

export type MessageReceivedOutgoingMessage = Infer<
  typeof DTMessageReceivedMessage
>;
