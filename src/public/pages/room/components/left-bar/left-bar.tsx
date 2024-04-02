import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx";
import { Card } from "adwavecss";
import { ResultTabs } from "../result-tabs/result-tabs";
import { RoundHistory } from "../round-history/round-history";
import "./styles.css";

export const LeftBar = (props: { isSkeleton: ReadonlySignal<boolean> }) => {
  return (
    <div class={[Card.card, "room-left-bar", "column", "room-view-card"]}>
      <ResultTabs />
      <RoundHistory isSkeleton={props.isSkeleton} />
    </div>
  );
};
