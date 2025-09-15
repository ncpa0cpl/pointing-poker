import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const RoomIDDisplay = () => {
  const copyRoomID = () => {
    const roomID = PokerRoomService.roomID.get();
    if (roomID) {
      navigator.clipboard.writeText(roomID);
    }
  };

  return (
    <div class="linked flexbox room-id-display">
      <input
        class="input"
        disabled
        value={sig.nuc(PokerRoomService.roomID, "        ")}
      />
      <button class="btn" onclick={copyRoomID}>
        Copy
      </button>
    </div>
  );
};
