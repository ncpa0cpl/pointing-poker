import type { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button, Input } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";
import { Router } from "../../../routes";

export const RoomConnectionForm = (props: { disable: Signal<boolean> }) => {
  const inputValue = sig("");
  const disable = props.disable;

  const onConnect = async () => {
    const roomID = inputValue.get();

    if (!roomID) return;

    disable.dispatch(true);
    try {
      await PokerRoomService.connectToRoom(roomID);
      Router.nav.room.$open({
        roomID,
      });
    } catch (e) {
      Router.nav.notfound.$open();
    } finally {
      disable.dispatch(false);
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    inputValue.dispatch(target.value);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const hasModifier = e.ctrlKey || e.altKey || e.metaKey || e.shiftKey;
      if (!hasModifier) {
        onConnect();
      }
    }
  };

  return (
    <div class="column room-connection-form">
      <h2 class="header">Join existing Room</h2>
      <div class={Button.linked}>
        <input
          class={{
            [Input.input]: true,
            [Input.disabled]: disable,
          }}
          placeholder="Room ID"
          oninput={handleInput}
          onkeyup={handleKeyUp}
        />
        <button
          class={{
            [Button.button]: true,
            [Button.disabled]: disable,
          }}
          onclick={onConnect}
          disabled={disable}
        >
          Connect
        </button>
      </div>
    </div>
  );
};
