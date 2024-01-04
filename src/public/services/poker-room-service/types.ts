import type { RoundUpdateOutgoingMessage } from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";

export type PokerRoomRound = Omit<RoundUpdateOutgoingMessage, "type">;
