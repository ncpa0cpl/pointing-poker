import { DateTime } from "luxon";
import { RoomService } from "../room-sevice";
import { RoundOption } from "../round/option/round-option";
import type { SerializedRoundOption } from "../round/option/serializer";
import { Round } from "../round/round";
import type { SerializedRound } from "../round/serializer";
import { ChatMessage } from "./chat-message/chat-message";
import type { SerializedChatMessage } from "./chat-message/serializer";
import { Room } from "./room";

type SerializedRoom = {
  id: string;
  createdAt: string;
  rounds: SerializedRound[];
  ownerID: string;
  ownerPublicID?: string;
  ownerName: string;
  defaultOptions: SerializedRoundOption[];
  chatMessages: SerializedChatMessage[];
};

export class RoomSerializer {
  public static serialize(roomConnection: Room): SerializedRoom {
    const serializedData: SerializedRoom = {
      id: roomConnection.id,
      createdAt: roomConnection.createdAt.toISO(),
      ownerID: roomConnection.ownerID,
      ownerPublicID: roomConnection.ownerPublicID,
      ownerName: roomConnection.ownerName,
      rounds: roomConnection.rounds.map((round) => {
        return Round.serializer.serialize(round);
      }),
      defaultOptions: roomConnection.defaultOptions.map((option) => {
        return RoundOption.serializer.serialize(option);
      }),
      chatMessages: roomConnection.chatMessages.map((message) => {
        return ChatMessage.serializer.serialize(message);
      }),
    };
    return serializedData;
  }

  public static deserialize(serializedData: SerializedRoom): Room {
    const room = new Room(serializedData.ownerID, serializedData.ownerName, {
      id: serializedData.id,
      createdAt: DateTime.fromISO(serializedData.createdAt),
      ownerPublicID: serializedData.ownerPublicID,
      rounds: serializedData.rounds.map((round) => {
        return Round.serializer.deserialize(round);
      }),
      defaultOptions: serializedData.defaultOptions.map((option) => {
        return RoundOption.serializer.deserialize(option);
      }),
      chatMessages: serializedData.chatMessages.map((message) => {
        return ChatMessage.serializer.deserialize(message);
      }),
    });

    RoomService.putRoom(room);

    return room;
  }
}
