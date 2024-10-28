import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import { Link } from "../../components/link/link";
import { PageLayout } from "../../components/page-layout/page-layout";
import { UserService } from "../../services/user-service/user-service";
import { Router } from "../routes";

export const PrivacyPage = () => {
  return (
    <PageLayout class="privacy-page">
      <div class={[Card.card, "column"]}>
        <Link
          class={[Button.button, Button.flat, "privacy-start-playing-btn"]}
          to={UserService.userExists().derive(exists =>
            exists ? Router.nav.join : Router.nav.register
          )}
        >
          Start Playing
        </Link>
        <div class="column privacy-contents">
          <h1 class={[Typography.header, "privacy-header"]}>
            Privact Policy
          </h1>
          <ul>
            <li>
              <p>
                We do not collect any personally identifiable information from
                you.
              </p>
            </li>
            <li>
              <p>
                The only information you provide us is the username you choose,
                which is only stored on our servers while you are playing the
                game. Once the room you joined/created expires or gets closed
                this information is ereased.
              </p>
            </li>
            <li>
              <p>
                We collect some informations on your interactions with this web
                app (like visit count, visiting the referal links, etc.),
                however these informations are only stored locally in your
                browser and never leave your device.
              </p>
            </li>
            <li>
              <p>
                We are using an application monitoring service (
                <a class="blue-link" href="https://sentry.io/" target="_blank">
                  Sentry
                </a>
                ) for collecting data on potential issues and problems with our
                services. This service may collect some information about your
                device and browser.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </PageLayout>
  );
};
