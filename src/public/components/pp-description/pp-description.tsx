import { Typography } from "adwavecss";
import "./styles.css";

export const PointingPokerDescription = ({ endMsg }: { endMsg: string }) => {
  return (
    <div class="pp-description">
      <h1 class={Typography.header}>Pointing Poker</h1>
      <p class={Typography.subtitle}>
        Pointing Poker is a tool that allows agile teams to estimate their work
        effort via an online game. {endMsg}
      </p>
    </div>
  );
};
