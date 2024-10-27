import * as uuid from "uuid";
import type { RoundUpdateOutgoingMessage } from "../../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { RoundOptionSerializer } from "./serializer";

export class RoundOption {
  public static serializer = RoundOptionSerializer;

  public readonly id: string;
  public readonly name: string;

  public constructor(name: string, id?: string) {
    this.id = id ?? uuid.v4();
    this.name = name;
  }

  public toView(): Omit<RoundUpdateOutgoingMessage, "type">["options"][number] {
    return {
      id: this.id,
      name: this.name,
    };
  }
}
