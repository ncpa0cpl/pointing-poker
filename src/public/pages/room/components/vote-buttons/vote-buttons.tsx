import { Range } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { clsx } from "clsx";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const VoteButtons = () => {
  const round = PokerRoomService.currentRound;
  const clickHandler = (optionID: string) => () => {
    PokerRoomService.sendVote(optionID);
  };

  return (
    <Range
      data={PokerRoomService.options}
      into={<div class="vote-buttons-container" />}
    >
      {opt => {
        return (
          <button
            class={round.derive(r =>
              clsx(Button.button, { [Button.disabled]: !r?.isInProgress })
            )}
            onclick={clickHandler(opt.id)}
            disabled={round.derive(r => !r?.isInProgress)}
          >
            {opt.name}
          </button>
        );
      }}
    </Range>
  );
};
