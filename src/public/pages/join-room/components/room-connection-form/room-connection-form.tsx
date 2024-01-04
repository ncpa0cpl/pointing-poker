import { sig } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { router } from "../../../routes";
import "./styles.css";

export const RoomConnectionForm = () => {
  const inputValue = sig("");
  const disableBtn = sig(false);

  const onConnect = async () => {
    disableBtn.dispatch(true);
    const roomID = inputValue.current();
    try {
      await PokerRoomService.connectToRoom(roomID);
      router.navigate("room", { roomID: roomID });
    } catch (e) {
      // TODO: redirect to 404 page
    } finally {
      disableBtn.dispatch(false);
    }
  };

  return (
    <div class="column room-connection-form">
      <h2 class="header">Join existing Room</h2>
      <div class={Button.linked}>
        <input
          class="input"
          placeholder="Room ID"
          oninput={(e) => {
            const target = e.target as HTMLInputElement;
            inputValue.dispatch(target.value);
          }}
        />
        <button class="btn" onclick={onConnect} disabled={disableBtn}>
          Connect
        </button>
      </div>
    </div>
  );
};
