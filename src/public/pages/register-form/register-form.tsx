import { sig } from "@ncpa0cpl/vanilla-jsx";
import { Button, Card, Input, Typography } from "adwavecss";
import { clsx } from "clsx";
import { UserService } from "../../services/user-service/user-service";
import { router } from "../routes";
import "./styles.css";

export const RegisterPage = () => {
  if (UserService.userExists().current()) {
    router.navigate("join");
  }

  const username = sig("");

  const onSubmit = (e: Event) => {
    e.preventDefault();

    if (username.current()) {
      UserService.createNewUser(username.current());
      router.navigate("join");
    }
  };

  const onInput = (e: Event) => {
    const target = e.target as any as HTMLInputElement;
    username.dispatch(target.value);
  };

  return (
    <div class={clsx(Card.card, "register-form")}>
      <h1 class={Typography.header}>Pointing Poker</h1>
      <p class={Typography.subtitle}>
        Pointing Poker is a tool that allows agile teams to estimate their work
        effort via an online game. Enter your username below to get started.
      </p>
      <form onsubmit={onSubmit}>
        <div class={Button.linked}>
          <input
            class={Input.input}
            id="username"
            type="text"
            value={username}
            oninput={onInput}
            placeholder={"Enter your username"}
          />
          <button class={Button.button} type="submit">Start Playing</button>
        </div>
      </form>
      <a
        href="https://github.com/ncpa0cpl/pointing-poker"
        target="_blank"
        rel="noopener noreferrer"
      >
        <button class={clsx(Button.button, Button.flat)}>
          View Source Code on GitHub
        </button>
      </a>
    </div>
  );
};
