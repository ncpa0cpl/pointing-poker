import { Button, Card, Typography } from "adwavecss";
import { Router } from "../routes";
import "./styles";
import { PageLayout } from "../../components/page-layout/page-layout";

export function RoomClosed() {
  return (
    <PageLayout class="room-closed-page">
      <div class={[Card.card, "column"]}>
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
    </PageLayout>
  );
}
