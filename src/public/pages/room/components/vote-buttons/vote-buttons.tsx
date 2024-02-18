import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx";
import { If, Range } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const VoteButtons = (props: { isSkeleton: ReadonlySignal<boolean> }) => {
  const round = PokerRoomService.currentRound;
  const clickHandler = (optionID: string) => () => {
    PokerRoomService.sendVote(optionID);
  };

  return (
    <If
      into={<div class="center-h" />}
      condition={props.isSkeleton}
      then={() => {
        const skeletonBtns = [0, 1, 2, 3, 5, 8, 13];
        return (
          <div class="vote-buttons-container">
            {skeletonBtns.map(opt => {
              return (
                <button
                  class={{
                    [Button.button]: true,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }}
      else={() => {
        return (
          <Range
            data={PokerRoomService.options}
            into={<div class="vote-buttons-container" />}
          >
            {opt => {
              return (
                <button
                  class={{
                    [Button.button]: true,
                    [Button.disabled]: round.derive(r => !r?.isInProgress),
                  }}
                  onclick={clickHandler(opt.id)}
                  disabled={round.derive(r => !r?.isInProgress)}
                >
                  {opt.name}
                </button>
              );
            }}
          </Range>
        );
      }}
    />
  );
};
