import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Router } from "../routes";

export const ErrorPage = (
  props: { params: ReadonlySignal<Record<"message", string>> },
) => {
  const handleGoHome = () => {
    Router.nav.join.$open();
  };

  return (
    <div class={[Card.card, "error-page", "column"]}>
      <h2 class={Typography.label}>
        {props.params.derive(({ message }) => {
          if (message) return message;
          return "There was an unexpected error. Please try again later.";
        })}
      </h2>
      <button class={[Button.button, Button.primary]} onclick={handleGoHome}>
        Home
      </button>
    </div>
  );
};
