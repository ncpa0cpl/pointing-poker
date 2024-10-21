import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
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
      Router.nav.error.$open({
        message: "We were unable to create a new room. Please try again later.",
      });
    } finally {
      disable.dispatch(false);
    }
  };

  const d = sig.or(
    disable,
    sig.not(PokerRoomService.socketOpened),
  );

  return (
    <div class="grow">
      <button
        class={{
          [Button.button]: true,
          [Button.disabled]: d,
        }}
        onclick={createRoom}
        disabled={d}
      >
        Create a new Room
      </button>
    </div>
  );
};
