import type { RoundUpdateOutgoingMessage } from "../../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { RoundResultSerializer } from "./serializer";

export class RoundResult {
  public static serializer = RoundResultSerializer;

  public constructor(
    public readonly userID: string,
    public readonly publicUserID: string,
    public readonly username: string,
    public readonly vote: string,
  ) {
  }

  public toView(): Omit<RoundUpdateOutgoingMessage, "type">["results"][number] {
    return {
      vote: this.vote,
      username: this.username,
      publicUserID: this.publicUserID,
    };
  }
}
