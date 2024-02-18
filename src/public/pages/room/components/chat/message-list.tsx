import { Range } from "@ncpa0cpl/vanilla-jsx";
import { Box } from "adwavecss";
import { DateTime } from "luxon";
import { UpsideDownScrollView } from "../../../../components/upside-down-scrollview/upside-down-scrollview";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";

const formatTime = (time: DateTime) => {
  return time.toLocaleString(DateTime.TIME_SIMPLE);
};

export const MessageList = () => {
  return (
    <UpsideDownScrollView dep={PokerRoomService.chatMessages}>
      <Range
        data={PokerRoomService.chatMessages}
        into={<div class={["chat-messages", Box.className({ bg: 2 })]} />}
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
