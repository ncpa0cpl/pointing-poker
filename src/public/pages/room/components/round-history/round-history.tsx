import { If, Range } from "@ncpa0cpl/vanilla-jsx";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Box, Button, NavSidebar, Typography } from "adwavecss";
import { UpsideDownScrollView } from "../../../../components/upside-down-scrollview/upside-down-scrollview";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import type { PokerRoomRound } from "../../../../services/poker-room-service/types";
import "./styles.css";

type PokerRoomRoundWithId = PokerRoomRound & { idx: number };

export const RoundHistory = (props: {
  isSkeleton: ReadonlySignal<boolean>;
}) => {
  const cround = PokerRoomService.currentRound;
  const allRounds = PokerRoomService.rounds.derive(
    (rounds): PokerRoomRoundWithId[] =>
      rounds.map((r, idx) => ({ ...r, idx: idx + 1 })),
  );

  const handleResetRounds = () => {
    if (
      !window.confirm(
        "This will delete all previous rounds and start a new empty round. Continue?",
      )
    ) {
      return;
    }
    PokerRoomService.resetRounds()?.catch(() => {
      PokerRoomService.showSystemChatMsg(
        "ERROR: Unable to reset the rounds, due to connection issues.",
      );
    });
  };

  const renderRoundBtn = (round: PokerRoomRoundWithId) => (
    <button
      onclick={() => {
        const lastRoundIdx = -1 + PokerRoomService.rounds.get().length;
        if (round.idx - 1 === lastRoundIdx) {
          PokerRoomService.selectedRound.dispatch("");
        } else {
          PokerRoomService.selectedRound.dispatch(round.id);
        }
      }}
      class={{
        "prev-round-btn": true,
        [NavSidebar.button]: true,
        [NavSidebar.active]: cround.derive((cr) => cr?.id === round.id),
      }}
    >
      <p class={Typography.text}>Round {round.idx}</p>
      <p class={Typography.subtitle}>
        {round.finalResult
          ? `Mod: ${round.finalResult.mode} | Med: ${round.finalResult.median} | Avg: ${round.finalResult?.mean}`
          : ""}
      </p>
    </button>
  );

  return (
    <div class={[Box.box, Box.bg4, "round-history", "column"]}>
      <h2 class={Typography.header}>Previous Rounds</h2>
      <UpsideDownScrollView dep={allRounds}>
        <If
          condition={props.isSkeleton}
          then={() => {
            return (
              <div class={NavSidebar.navSidebar}>
                {renderRoundBtn({
                  id: "",
                  idx: 1,
                  hasResults: false,
                  results: [],
                  isInProgress: true,
                  options: [],
                })}
              </div>
            );
          }}
          else={() => {
            return (
              <Range
                data={allRounds}
                into={<div class={NavSidebar.navSidebar} />}
              >
                {renderRoundBtn}
              </Range>
            );
          }}
        />
      </UpsideDownScrollView>
      <If
        into={<div class="reset-rounds-container" />}
        condition={PokerRoomService.isCurrentUserTheOwner}
        then={() => (
          <button
            class={{
              "reset-rounds-btn": true,
              [Button.button]: true,
            }}
            title="Delete all previous rounds and start a new empty round."
            onclick={handleResetRounds}
          >
            Reset Rounds
          </button>
        )}
      />
    </div>
  );
};
