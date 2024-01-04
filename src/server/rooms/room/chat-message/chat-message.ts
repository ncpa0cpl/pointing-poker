import { DateTime } from "luxon";
import type { ChatMessageView } from "../../../../shared";
import type { Room } from "../room";
import { ChatMessageSerializer } from "./serializer";

export class ChatMessage {
  public static serializer = ChatMessageSerializer;

  public readonly sentAt: DateTime;

  public constructor(
    public readonly text: string,
    public readonly authorPublicID?: string,
    overrides: { sentAt?: DateTime } = {},
  ) {
    this.sentAt = overrides.sentAt ?? DateTime.now();
  }

  public toView(room: Room): ChatMessageView {
    return {
      text: this.text,
      sentAt: this.sentAt.toISO(),
      publicUserID: this.authorPublicID,
      username: this.authorPublicID
        ? room.getUsernameByPublicID(this.authorPublicID)
        : undefined,
    };
  }
}
