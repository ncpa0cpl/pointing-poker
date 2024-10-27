import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Alert, Card, Typography } from "adwavecss";
import { PointingPokerDescription } from "../../components/pp-description/pp-description";
import { RepoLink } from "../../components/repo-link/repo-link";
import { UserService } from "../../services/user-service/user-service";
import { RoomConnectionForm } from "./components/room-connection-form/room-connection-form";
import { RoomCreateForm } from "./components/room-create-form/room-create-form";
import "./styles.css";
import { KofiLink } from "../../components/kofi-link/kofi-link";
import { PageLayout } from "../../components/page-layout/page-layout";
import { PokerRoomService } from "../../services/poker-room-service/poker-room-service";
import { Router } from "../routes";

export const JoinRoom = () => {
  const userExists = UserService.userExists();
  const disableControls = sig(false);

  if (!userExists) {
    Router.nav.register.$open();
  }

  return (
    <PageLayout class="join-room-page">
      <div class={[Card.card]}>
        {PokerRoomService.socketOpened.derive(open => {
          if (!open) {
            return (
              <div class={[Alert.alert, Alert.error]}>
                There is an issue with the connection. We are unable to create
                new rooms or join existing ones.
              </div>
            );
          }
        })}
        <PointingPokerDescription endMsg="Create new room or join an existing one below." />
        <div class="join-form">
          <RoomCreateForm disable={disableControls} />
          <div class="or-divider">
            <p class={Typography.label}>or</p>
          </div>
          <RoomConnectionForm disable={disableControls} />
        </div>
        <RepoLink />
        <KofiLink />
      </div>
    </PageLayout>
  );
};
