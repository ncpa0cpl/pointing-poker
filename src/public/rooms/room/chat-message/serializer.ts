import { DateTime } from "luxon";
import { ChatMessage } from "./chat-message";

export type SerializedChatMessage = {
  text: string;
  authorPublicID?: string;
  sentAt: string;
};

export class ChatMessageSerializer {
  public static serialize(roundOption: ChatMessage): SerializedChatMessage {
    return {
      text: roundOption.text,
      authorPublicID: roundOption.authorPublicID,
      sentAt: roundOption.sentAt.toISO(),
    };
  }

  public static deserialize(
    serializedData: SerializedChatMessage,
  ): ChatMessage {
    return new ChatMessage(
      serializedData.text,
      serializedData.authorPublicID,
      {
        sentAt: DateTime.fromISO(serializedData.sentAt),
      },
    );
  }
}
