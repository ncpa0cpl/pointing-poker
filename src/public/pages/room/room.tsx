import { bindSignal } from "@ncpa0cpl/vanilla-jsx";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/dist/types/signals/signal";
import { Box } from "adwavecss";
import { clsx } from "clsx";
import { PokerRoomService } from "../../services/poker-room-service/poker-room-service";
import { router } from "../routes";
import { Chat } from "./components/chat";
import { LeftBar } from "./components/left-bar";
import { OwnerControls } from "./components/owner-controls";
import { Participants } from "./components/participants";
import { RoomIDDisplay } from "./components/room-id-display";
import { VoteButtons } from "./components/vote-buttons";
import "./styles.css";

export const Room = (props: { roomID: ReadonlySignal<string> }) => {
  const room = (
    <div class={clsx(Box.box, "column")}>
      <button
        class="btn exit-room-btn"
        onclick={() => {
          router.navigate("join");
        }}
      >
        Exit Room
      </button>
      <div class="room-view">
        <LeftBar />
        <div class="column card voting-section">
          <div>
            <RoomIDDisplay />
            <OwnerControls />
          </div>
          <VoteButtons />
          <Participants />
        </div>
        <Chat />
      </div>
    </div>
  );

  bindSignal(props.roomID, room, (_, roomID) => {
    if (PokerRoomService.roomID.current() !== roomID) {
      PokerRoomService.connectToRoom(roomID);
    }
  });

  return room;
};
