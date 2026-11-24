import { sig, type Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { Router } from "../../../routes";

export const RoomCreateForm = (props: { disable: Signal<boolean> }) => {
  const persistent = sig(false);
  const disable = props.disable;

  const createRoom = async () => {
    disable.dispatch(true);
    try {
      const roomID = await PokerRoomService.createRoom(
        persistent.get(),
      );
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
    <div class="grow room-create-form">
      <button
        class={{
          [Button.button]: true,
          [Button.disabled]: d,
          "create-room-btn": true,
        }}
        onclick={createRoom}
        disabled={d}
      >
        Create a new Room
      </button>
      <div class="persistent-toggle">
        <span
          class="persistent-label"
          title="Persistent rooms are never deleted automatically. The link to the room will remain valid indefinitely."
        >
          Persistent room
        </span>
        <adw-switch
          active={persistent}
          onchange={ev => persistent.dispatch(ev.active)}
        />
      </div>
    </div>
  );
};
