import type { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { Router } from "../../../routes";

export const RoomCreateForm = (props: { disable: Signal<boolean> }) => {
  const disable = props.disable;

  const createRoom = async () => {
    disable.dispatch(true);
    try {
      const roomID = await PokerRoomService.createRoom();
      await PokerRoomService.connectToRoom(roomID);
      await Router.nav.room.$open({
        roomID: roomID,
      });
    } catch (err) {
      Router.nav.error.$open();
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
