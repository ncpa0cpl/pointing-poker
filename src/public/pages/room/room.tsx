import { $component } from "@ncpa0cpl/vanilla-jsx";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/dist/types/signals/signal";
import { Box, Skeleton } from "adwavecss";
import { PokerRoomService } from "../../services/poker-room-service/poker-room-service";
import { UserService } from "../../services/user-service/user-service";
import { Chat } from "./components/chat/chat";
import { LeftBar } from "./components/left-bar/left-bar";
import { OwnerControls } from "./components/owner-controls/owner-controls";
import { Participants } from "./components/participants/participants";
import { RoomIDDisplay } from "./components/room-id-display/room-id-display";
import { VoteButtons } from "./components/vote-buttons/vote-buttons";
import "./styles.css";
import { PageLayout } from "../../components/page-layout/page-layout";
import { Router } from "../routes";

type RoomProps = {
  roomID: ReadonlySignal<string>;
};

export const Room = $component<RoomProps>((props, api) => {
  const handleExitRoom = () => {
    Router.nav.join.$open().then(() => {
      PokerRoomService.disconnectFromRoom();
    });
  };

  api.onMount(() => {
    Router.setTitle(`Pointing Poker - Room ${props.roomID.get()}`);
    PokerRoomService.onRoomClosed = () => {
      Router.nav.roomclosed.$replace();
    };
    return () => {
      PokerRoomService.onRoomClosed = undefined;
    };
  });

  api.onChange(() => {
    if (!UserService.userExists().get()) {
      return;
    }

    const roomID = props.roomID.get();
    if (PokerRoomService.roomID.get() !== roomID) {
      PokerRoomService.connectToRoom(roomID).catch(() => {
        Router.nav.notfound.$open();
      });
    }
  }, [props.roomID]);

  const isSkeleton = PokerRoomService.connected.derive((c) => !c);

  return (
    <PageLayout class="room-page">
      <div
        class={{
          column: true,
          [Box.box]: true,
          [Skeleton.skeleton]: isSkeleton,
        }}
      >
        <button class="btn exit-room-btn" onclick={handleExitRoom}>
          Exit Room
        </button>
        <div class="room-view">
          <LeftBar isSkeleton={isSkeleton} />
          <div class="column card voting-section room-view-card">
            <div class="voting-section-top-bar column">
              <RoomIDDisplay />
              <OwnerControls />
            </div>
            <VoteButtons isSkeleton={isSkeleton} />
            <Participants />
          </div>
          <Chat />
        </div>
      </div>
    </PageLayout>
  );
});
