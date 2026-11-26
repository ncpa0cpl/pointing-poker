import { Button, Card, Typography } from "adwavecss";
import { Link } from "../../components/link/link";
import { PageLayout } from "../../components/page-layout/page-layout";
import { UserService } from "../../services/user-service/user-service";
import { Router } from "../routes";
import "./styles.css";

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
            Privacy Policy
          </h1>
          <ul>
            <li>
              <p>
                We do not collect any personally identifiable information.
              </p>
            </li>
            <li>
              <p>
                The only information you provide us is the username you choose.
                This username is stored on our servers solely for the duration
                of your session and is permanently erased once the room you
                created or joined expires or is closed.
              </p>
            </li>
            <li>
              <p>
                Messages sent in a room's chat are stored on our servers for as
                long as the room remains active. If the room is persistent, chat
                history is retained indefinitely until the room is closed by its
                owner or the chat history is deleted by a user.
              </p>
            </li>
            <li>
              <p>
                We collect limited information about your interactions with this
                web application (such as visit counts and referral link usage).
                This information is stored exclusively in your browser and never
                leaves your device.
              </p>
            </li>
            <li>
              <p>
                We use an application monitoring service (
                <a
                  class="blue-link"
                  href="https://sentry.io/"
                  target="_blank"
                >
                  Sentry
                </a>
                ) to collect data on potential issues and errors in our
                services. Depending on the event, this may include:
              </p>
              <ul>
                <li>
                  <p>
                    your browser type and version, operating system, and device
                    type,
                  </p>
                </li>
                <li>
                  <p>your screen resolution,</p>
                </li>
                <li>
                  <p>the URL of the page where the issue occurred,</p>
                </li>
                <li>
                  <p>
                    error details, such as error messages and stack traces, and
                  </p>
                </li>
                <li>
                  <p>
                    performance data about page loads and user interactions.
                  </p>
                </li>
              </ul>
              <p>
                Your IP address is not stored with these events. All of this
                information is processed by Sentry on our behalf and under our
                instructions.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </PageLayout>
  );
};
