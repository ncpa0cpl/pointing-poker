import type { Signal } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { clsx } from "clsx";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { router } from "../../../routes";

export const RoomCreateForm = (props: { disable: Signal<boolean> }) => {
  const disable = props.disable;

  const createRoom = async () => {
    disable.dispatch(true);
    try {
      const roomID = await PokerRoomService.createRoom();
      await PokerRoomService.connectToRoom(roomID);
      router.navigate("room", { roomID: roomID });
    } finally {
      disable.dispatch(false);
    }
  };

  return (
    <div class="grow">
      <button
        class={disable.derive(d =>
          clsx({
            [Button.button]: true,
            [Button.disabled]: d,
          })
        )}
        onclick={createRoom}
        disabled={disable}
      >
        Create a new Room
      </button>
    </div>
  );
};
