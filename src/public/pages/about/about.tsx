import { Button, Card, Typography } from "adwavecss";
import "./styles.css";
import CommandsImg from "../../assets/images/commands.webp";
import DistributionImg from "../../assets/images/distribution.webp";
import RoundListImg from "../../assets/images/round-list.webp";
import StatisticsImg from "../../assets/images/statistics.webp";
import BotingButtonsImg from "../../assets/images/voting-buttons.webp";
import { Link } from "../../components/link/link";
import { PageLayout } from "../../components/page-layout/page-layout";
import { UserService } from "../../services/user-service/user-service";
import { Router } from "../routes";
import { ImagesView } from "./components/images-view";

export const AboutPage = () => {
  return (
    <PageLayout class="about-page">
      <div class={[Card.card, "column"]}>
        <Link
          class={[Button.button, Button.flat, "about-start-playing-btn"]}
          to={UserService.userExists().derive(exists =>
            exists ? Router.nav.join : Router.nav.register
          )}
        >
          Start Playing
        </Link>
        <div class="column about-contents">
          <h1 class={[Typography.header, "about-header"]}>
            What is Pointing Poker?
          </h1>
          <p class={Typography.text}>
            Pointing Poker is a simple way to estimate the work needed to
            complete a task. It is a game that is commonly used in Agile
            software development teams to estimate the complexity of a task.
          </p>

          <h2 class={[Typography.header, "about-header"]}>
            How to Start Playing
          </h2>
          <p class={Typography.text}>
            To start playing you will first need a username. When you first
            visit the site you will be prompted to choose one, you will not be
            able to join any games without it.
          </p>
          <p class={Typography.text}>
            Once your username is set, you will need to create a new room or
            join an existing one. To create a new room go to the main page and
            click the "Create a New Room" button. To join, you can either open a
            link that can be shared by other to you or go to the main page,
            enter the room code in the input field and click "Connect".
          </p>

          <h2 class={[Typography.header, "about-header"]}>How to Play</h2>
          <p class={Typography.text}>
            After joining a room, you will be presented with three main
            sections:
          </p>
          <p class={Typography.text}>
            <ol>
              <li>
                <p>
                  On the left you can find the informations on the current round
                  results, like the point average, median and the mode (most
                  common vote placed by players) as well as the distribution
                  graph:
                </p>
                <ImagesView
                  images={[
                    {
                      url: DistributionImg,
                      alt: "Distribution Graph",
                    },
                    {
                      url: StatisticsImg,
                      alt: "Round Statistics",
                    },
                  ]}
                />
                <p>
                  Below it there's also a list of all the rounds that were
                  played, by clikcing on them you can see the results of those
                  rounds:
                </p>
                <ImagesView
                  images={[
                    {
                      url: RoundListImg,
                      alt: "Round List",
                    },
                  ]}
                />
              </li>
              <li>
                <p>
                  In the middle you can find the room id, voting buttons and the
                  list of all players. To vote, simply click on the button with
                  the number that you think is the best estimate for the task.
                  You can also change your vote at any time as long as the round
                  hasn't finished by clicking on a different button.
                </p>
                <ImagesView
                  images={[
                    {
                      url: BotingButtonsImg,
                      alt: "Voting Buttons",
                    },
                  ]}
                />
                <p>
                  In the player list, you can see which players have placed
                  their votes, and once the round is finished it will show what
                  each player has voted.
                </p>
              </li>
              <li>
                <p>
                  Finally, in the third section on the right there's a chat. You
                  can use it to communicate with other players in the room and
                  executing text commands.
                </p>
                <p>
                  To see what commands are available, type <code>/help</code>
                  {" "}
                  , and to get specific information on given command type
                  <code>/help [command]</code>
                </p>
                <ImagesView
                  images={[
                    {
                      url: CommandsImg,
                      alt: "Text Commands",
                    },
                  ]}
                />
              </li>
            </ol>
          </p>

          <h2 class={[Typography.header, "about-header"]}>Privacy Policy</h2>
          <p>
            You can find our privacy policy in
            <Link class="blue-link" to={Router.nav.privacy}>{" "}here</Link>.
          </p>
        </div>
      </div>
    </PageLayout>
  );
};
