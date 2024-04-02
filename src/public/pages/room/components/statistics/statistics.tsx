import { Box, Typography } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const Statistics = () => {
  const round = PokerRoomService.currentRound;
  const mean = round.derive(round => round?.finalResult?.mean ?? "N/A");
  const median = round.derive(round => round?.finalResult?.median ?? "N/A");
  const mode = round.derive(round => round?.finalResult?.mode ?? "N/A");
  const votesCount = round.derive(round =>
    String(round?.finalResult?.votes ?? "N/A")
  );

  return (
    <div class={[Box.box, Box.bg2, "column", "statistics"]}>
      <h2 class={Typography.header}>
        Statistics
      </h2>
      <div class="statistics-grid">
        <h4 class={Typography.label}>
          Mode:
        </h4>
        <p class={Typography.text}>
          {mode}
        </p>
        <h4 class={Typography.label}>
          Median:
        </h4>
        <p class={Typography.text}>
          {median}
        </p>
        <h4 class={Typography.label}>
          Average:
        </h4>
        <p class={Typography.text}>
          {mean}
        </p>
        <h4 class={Typography.label}>
          Votes:
        </h4>
        <p class={Typography.text}>
          {votesCount}
        </p>
      </div>
    </div>
  );
};
