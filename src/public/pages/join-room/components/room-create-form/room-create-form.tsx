import { sig } from "@ncpa0cpl/vanilla-jsx";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { router } from "../../../routes";

export const RoomCreateForm = () => {
  const disableBtn = sig(false);

  const createRoom = async () => {
    disableBtn.dispatch(true);
    try {
      const roomID = await PokerRoomService.createRoom();
      await PokerRoomService.connectToRoom(roomID);
      router.navigate("room", { roomID: roomID });
    } finally {
      disableBtn.dispatch(false);
    }
  };

  return (
    <div class="grow">
      <button class="btn" onclick={createRoom} disabled={disableBtn}>
        Create a new Room
      </button>
    </div>
  );
};
