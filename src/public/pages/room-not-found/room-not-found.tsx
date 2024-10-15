import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { Router } from "../routes";

export const RoomNotFound = () => {
  const handleJoinOtherRoomClick = () => {
    Router.nav.join.$open();
  };

  return (
    <div class={[Card.card, "room-not-found-page", "column"]}>
      <h2 class={Typography.label}>
        Room with the specified ID could not be found.
      </h2>
      <button
        class={[Button.button, Button.primary]}
        onclick={handleJoinOtherRoomClick}
      >
        Join other Room
      </button>
    </div>
  );
};
