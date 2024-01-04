import { Range, sig } from "@ncpa0cpl/vanilla-jsx";
import { Box, Button, Card, Typography } from "adwavecss";
import clsx from "clsx";
import { DateTime } from "luxon";
import { UpsideDownScrollView } from "../../../components/upside-down-scrollview/upside-down-scrollview";
import { PokerRoomService } from "../../../services/poker-room-service/poker-room-service";

const formatTime = (time: DateTime) => {
  return time.toLocaleString(DateTime.TIME_SIMPLE);
};
const ChatMessages = () => {
  return (
    <UpsideDownScrollView dep={PokerRoomService.chatMessages}>
      <Range
        data={PokerRoomService.chatMessages}
        into={<div class={clsx("chat-messages", Box.box, Box.bg2)} />}
      >
        {msg => (
          <div class="chat-message">
            {msg.derive(m => {
              return (
                <>
                  <p class="text timestamp">
                    {formatTime(m.sentAt)}
                  </p>
                  <span class="message-text text" unsafeHTML>
                    <span class="username">
                      {m.username ? m.username + ": " : ""}
                    </span>
                    {m.text.trim()}
                  </span>
                </>
              );
            })}
          </div>
        )}
      </Range>
    </UpsideDownScrollView>
  );
};

const ChatInput = () => {
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

export const Chat = () => {
  return (
    <div class={clsx(Card.card, "column", "chat-window")}>
      <h1 class={Typography.header}>Chat</h1>
      <div class="column">
        <ChatMessages />
        <ChatInput />
      </div>
    </div>
  );
};
