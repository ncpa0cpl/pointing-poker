import { Button, Typography } from "adwavecss";
import QuestionmarkSvg from "../../assets/questionmark.svg";
import "./styles.css";
import { Router } from "../../pages/routes";
import { Link } from "../link/link";

export const PointingPokerDescription = ({ endMsg }: { endMsg: string }) => {
  return (
    <div class="pp-description">
      <h1 class={Typography.header}>
        Pointing Poker
        <Link
          to={Router.nav.about}
          class={[Button.button, Button.flat]}
        >
          <QuestionmarkSvg
            alt="More about Pointing Poker"
            title="More about Pointing Poker"
          />
        </Link>
      </h1>
      <p class={Typography.subtitle}>
        Pointing Poker is a tool that allows agile teams to estimate their work
        effort via an online game. {endMsg}
      </p>
    </div>
  );
};
