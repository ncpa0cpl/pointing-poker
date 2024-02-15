import { Button, Card, Typography } from "adwavecss";
import { clsx } from "clsx";
import { router } from "../routes";
import "./styles.css";

export const RoomNotFound = () => {
  const handleJoinOtherRoomClick = () => {
    router.navigate("join");
  };

  return (
    <div class={clsx(Card.card, "room-not-found-page", "column")}>
      <h2 class={Typography.label}>
        Room with the specified ID could not be found.
      </h2>
      <button class={Button.button} onclick={handleJoinOtherRoomClick}>
        Join other Room
      </button>
    </div>
  );
};
