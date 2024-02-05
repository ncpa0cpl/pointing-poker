import { Card, Typography } from "adwavecss";
import { clsx } from "clsx";
import { PointingPokerDescription } from "../../components/pp-description/pp-description";
import { RepoLink } from "../../components/repo-link/repo-link";
import { UserService } from "../../services/user-service/user-service";
import { router } from "../routes";
import { RoomConnectionForm } from "./components/room-connection-form/room-connection-form";
import { RoomCreateForm } from "./components/room-create-form/room-create-form";
import "./styles.css";

export const JoinRoom = () => {
  const userExists = UserService.userExists();

  if (!userExists) {
    router.navigate("register");
  }

  return (
    <div class={clsx("join-room-page", "grow", Card.card)}>
      <PointingPokerDescription />
      <div class="join-form">
        <RoomCreateForm />
        <div class="or-divider">
          <p class={Typography.label}>or</p>
        </div>
        <RoomConnectionForm />
      </div>
      <RepoLink />
    </div>
  );
};
