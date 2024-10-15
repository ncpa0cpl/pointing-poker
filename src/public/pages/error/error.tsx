import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { Router } from "../routes";

export const ErrorPage = () => {
  const handleGoHome = () => {
    Router.nav.join.$open();
  };

  return (
    <div class={[Card.card, "error-page", "column"]}>
      <h2 class={Typography.label}>
        There was an unexpected error. Please try again later.
      </h2>
      <button class={[Button.button, Button.primary]} onclick={handleGoHome}>
        Home
      </button>
    </div>
  );
};
