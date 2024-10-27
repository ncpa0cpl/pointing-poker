import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { PageLayout } from "../../components/page-layout/page-layout";
import { Router } from "../routes";

export const RoomNotFound = () => {
  const handleJoinOtherRoomClick = () => {
    Router.nav.join.$open();
  };

  return (
    <PageLayout class="room-not-found-page">
      <div class={[Card.card, "column"]}>
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
    </PageLayout>
  );
};
