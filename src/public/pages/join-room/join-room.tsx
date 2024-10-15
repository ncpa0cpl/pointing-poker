import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Card, Typography } from "adwavecss";
import { PointingPokerDescription } from "../../components/pp-description/pp-description";
import { RepoLink } from "../../components/repo-link/repo-link";
import { UserService } from "../../services/user-service/user-service";
import { RoomConnectionForm } from "./components/room-connection-form/room-connection-form";
import { RoomCreateForm } from "./components/room-create-form/room-create-form";
import "./styles.css";
import { Router } from "../routes";

export const JoinRoom = () => {
  const userExists = UserService.userExists();
  const disableControls = sig(false);

  if (!userExists) {
    Router.nav.register.$open();
  }

  return (
    <div class={["join-room-page", Card.card]}>
      <PointingPokerDescription endMsg="Create new room or join an existing one below." />
      <div class="join-form">
        <RoomCreateForm disable={disableControls} />
        <div class="or-divider">
          <p class={Typography.label}>or</p>
        </div>
        <RoomConnectionForm disable={disableControls} />
      </div>
      <RepoLink />
    </div>
  );
};
