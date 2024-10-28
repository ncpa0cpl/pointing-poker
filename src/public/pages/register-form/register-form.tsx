import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button, Card, Input } from "adwavecss";
import { PointingPokerDescription } from "../../components/pp-description/pp-description";
import { RepoLink } from "../../components/repo-link/repo-link";
import { UserService } from "../../services/user-service/user-service";
import "./styles.css";
import { Link } from "../../components/link/link";
import { PageLayout } from "../../components/page-layout/page-layout";
import { Router } from "../routes";

export const RegisterPage = (props: {
  qparams: ReadonlySignal<{ roomID?: string }>;
}) => {
  if (UserService.userExists().get()) {
    Router.nav.join.$open();
  }

  const username = sig("");

  const onSubmit = (e: Event) => {
    e.preventDefault();

    if (username.get()) {
      UserService.createNewUser(username.get());

      const { roomID } = props.qparams.get();
      if (roomID) {
        Router.nav.room.$open({
          roomID,
        });
      } else {
        Router.nav.join.$open();
      }
    }
  };

  const onInput = (e: Event) => {
    const target = e.target as any as HTMLInputElement;
    username.dispatch(target.value);
  };

  return (
    <PageLayout class="register-page">
      <div class={[Card.card, "register-form"]}>
        <PointingPokerDescription endMsg="Enter your username below to get started." />
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
            <button class={Button.button} type="submit">
              Start Playing
            </button>
          </div>
        </form>
        <RepoLink />
      </div>
      <Link class="privacy-link blue-link" to={Router.nav.privacy}>
        Privacy
      </Link>
    </PageLayout>
  );
};
