import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button, Card, Input } from "adwavecss";
import { PointingPokerDescription } from "../../components/pp-description/pp-description";
import { RepoLink } from "../../components/repo-link/repo-link";
import { UserService } from "../../services/user-service/user-service";
import { router } from "../routes";
import "./styles.css";

export const RegisterPage = (
  props: { qparams: ReadonlySignal<{ roomID?: string }> },
) => {
  if (UserService.userExists().current()) {
    router.navigate("join");
  }

  const username = sig("");

  const onSubmit = (e: Event) => {
    e.preventDefault();

    if (username.current()) {
      UserService.createNewUser(username.current());

      const { roomID } = props.qparams.current();
      if (roomID) {
        router.navigate("room", { roomID });
      } else {
        router.navigate("join");
      }
    }
  };

  const onInput = (e: Event) => {
    const target = e.target as any as HTMLInputElement;
    username.dispatch(target.value);
  };

  return (
    <div class={[Card.card, "register-form"]}>
      <PointingPokerDescription />
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
      <RepoLink />
    </div>
  );
};
