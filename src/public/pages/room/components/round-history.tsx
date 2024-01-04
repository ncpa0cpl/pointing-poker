import { Range } from "@ncpa0cpl/vanilla-jsx";
import { Box, NavSidebar, Typography } from "adwavecss";
import clsx from "clsx";
import { UpsideDownScrollView } from "../../../components/upside-down-scrollview/upside-down-scrollview";
import { PokerRoomService } from "../../../services/poker-room-service/poker-room-service";

export const RoundHistory = () => {
  const cround = PokerRoomService.currentRound;
  const allRounds = PokerRoomService.rounds.derive((rounds) =>
    rounds.map((r, idx) => ({ ...r, idx: idx + 1 }))
  );
  return (
    <div class={clsx(Box.box, Box.bg2, "round-history", "column")}>
      <h2 class={Typography.header}>Previous Rounds</h2>
      <UpsideDownScrollView dep={allRounds}>
        <Range
          data={allRounds}
          into={<div class={NavSidebar.navSidebar} />}
        >
          {round => (
            <button
              onclick={() => {
                const lastRoundIdx = -1
                  + PokerRoomService.rounds.current().length;
                if (
                  round.idx - 1 === lastRoundIdx
                ) {
                  PokerRoomService.selectedRound.dispatch("");
                } else {
                  PokerRoomService.selectedRound.dispatch(round.id);
                }
              }}
              class={cround.derive(cr =>
                clsx(NavSidebar.button, "prev-round-btn", {
                  [NavSidebar.active]: cr?.id === round.id,
                })
              )}
            >
              <p class={Typography.text}>Round {round.idx}</p>
              <p class={Typography.subtitle}>
                {round.finalResult
                  ? `Mod: ${round.finalResult.mode} | Med: ${round.finalResult.median} | Avg: ${round.finalResult?.mean}`
                  : ""}
              </p>
            </button>
          )}
        </Range>
      </UpsideDownScrollView>
    </div>
  );
};
