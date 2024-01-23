import { Card, Typography } from "adwavecss";
import clsx from "clsx";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import "./styles.css";

export const Chat = () => {
  return (
    <div class={clsx(Card.card, "column", "chat-window")}>
      <h1 class={Typography.header}>Chat</h1>
      <div class="column">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
};
