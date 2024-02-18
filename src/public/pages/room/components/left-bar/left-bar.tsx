import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx";
import { Card } from "adwavecss";
import { RoundHistory } from "../round-history/round-history";
import { Statistics } from "../statistics/statistics";
import "./styles.css";

export const LeftBar = (props: { isSkeleton: ReadonlySignal<boolean> }) => {
  return (
    <div class={[Card.card, "room-left-bar", "column", "room-view-card"]}>
      <Statistics />
      <RoundHistory isSkeleton={props.isSkeleton} />
    </div>
  );
};
