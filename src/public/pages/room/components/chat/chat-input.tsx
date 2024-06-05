import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";

export const ChatInput = () => {
  const input = sig("");

  const handleInput = (e: Event) => {
    input.dispatch((e.target as HTMLTextAreaElement).value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      sendMsg();
      e.preventDefault();
    }
  };

  const sendMsg = () => {
    const value = input.current();
    if (value) {
      input.dispatch("");
      PokerRoomService.postChatMessage(value);
    }
  };

  return (
    <div class="column chat-input-container">
      <textarea
        value={input}
        rows={1}
        class="chat-input input"
        oninput={handleInput}
        onkeydown={handleKeyDown}
      />
      <div class="chat-input-controls">
        <button class={Button.button} onclick={sendMsg}>
          Send
        </button>
      </div>
    </div>
  );
};
