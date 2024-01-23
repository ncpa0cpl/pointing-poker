import { Card } from "adwavecss";
import clsx from "clsx";
import { RoundHistory } from "../round-history/round-history";
import { Statistics } from "../statistics/statistics";
import "./styles.css";

export const LeftBar = () => {
  return (
    <div class={clsx(Card.card, "room-left-bar", "column")}>
      <Statistics />
      <RoundHistory />
    </div>
  );
};
