import { Button, Typography } from "adwavecss";
import "./styles.css";
import { Icon } from "../../assets/icons";
import { Router } from "../../pages/routes";
import { Link } from "../link/link";

export const PointingPokerDescription = ({ endMsg }: { endMsg: string }) => {
  return (
    <div class="pp-description">
      <h1 class={Typography.header}>
        Pointing Poker
        <Link
          to={Router.nav.about}
          class={[Button.button, Button.flat, "learn-more-btn"]}
          title="More about Pointing Poker"
        >
          <Icon.Questionmark alt="More about Pointing Poker" />
        </Link>
      </h1>
      <p class={Typography.subtitle}>
        Pointing Poker is a tool that allows agile teams to estimate their work
        effort via an online game. {endMsg}
      </p>
    </div>
  );
};
