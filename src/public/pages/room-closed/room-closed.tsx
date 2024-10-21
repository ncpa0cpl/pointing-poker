import { Button, Card, Typography } from "adwavecss";
import { Router } from "../routes";
import "./styles";

export function RoomClosed() {
  return (
    <div class={[Card.card, "room-closed-page", "column"]}>
      <h2 class={Typography.label}>
        Room you were in has been closed by the host.
      </h2>
      <button
        class={[Button.button, Button.primary]}
        onclick={() => {
          Router.nav.join.$open();
        }}
      >
        Join other Room
      </button>
    </div>
  );
}
