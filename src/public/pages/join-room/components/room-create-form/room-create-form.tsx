import type { Signal } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { router } from "../../../routes";

export const RoomCreateForm = (props: { disable: Signal<boolean> }) => {
  const disable = props.disable;

  const createRoom = async () => {
    disable.dispatch(true);
    try {
      const roomID = await PokerRoomService.createRoom();
      router.navigate("room", { roomID: roomID });
      await PokerRoomService.connectToRoom(roomID);
    } finally {
      disable.dispatch(false);
    }
  };

  return (
    <div class="grow">
      <button
        class={{
          [Button.button]: true,
          [Button.disabled]: disable,
        }}
        onclick={createRoom}
        disabled={disable}
      >
        Create a new Room
      </button>
    </div>
  );
};
