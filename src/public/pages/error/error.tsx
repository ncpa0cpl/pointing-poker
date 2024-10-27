import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { PageLayout } from "../../components/page-layout/page-layout";
import { Router } from "../routes";

export const ErrorPage = (
  props: { params: ReadonlySignal<Record<"message", string>> },
) => {
  const handleGoHome = () => {
    Router.nav.join.$open();
  };

  return (
    <PageLayout class="error-page">
      <div class={[Card.card, "column"]}>
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
    </PageLayout>
  );
};
