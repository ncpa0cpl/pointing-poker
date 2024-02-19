import type { Signal } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx";
import { Button, Input } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { router } from "../../../routes";
import "./styles.css";

export const RoomConnectionForm = (props: { disable: Signal<boolean> }) => {
  const inputValue = sig("");
  const disable = props.disable;

  const onConnect = async () => {
    const roomID = inputValue.current();

    if (!roomID) return;

    disable.dispatch(true);
    try {
      await PokerRoomService.connectToRoom(roomID);
      router.navigate("room", { roomID: roomID });
    } catch (e) {
      router.navigate("notfound");
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
      const hasModifier = e.ctrlKey
        || e.altKey
        || e.metaKey
        || e.shiftKey;
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
