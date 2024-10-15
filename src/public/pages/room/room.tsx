import { $component } from "@ncpa0cpl/vanilla-jsx";
import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/dist/types/signals/signal";
import { Box, Skeleton } from "adwavecss";
import { PokerRoomService } from "../../services/poker-room-service/poker-room-service";
import { UserService } from "../../services/user-service/user-service";
import { router } from "../routes";
import { Chat } from "./components/chat/chat";
import { LeftBar } from "./components/left-bar/left-bar";
import { OwnerControls } from "./components/owner-controls/owner-controls";
import { Participants } from "./components/participants/participants";
import { RoomIDDisplay } from "./components/room-id-display/room-id-display";
import { VoteButtons } from "./components/vote-buttons/vote-buttons";
import "./styles.css";

type RoomProps = {
  roomID: ReadonlySignal<string>;
};

export const Room = $component<RoomProps>((props, api) => {
  const handleExitRoom = () => {
    router.navigate("join").then(() => {
      PokerRoomService.disconnectFromRoom();
    });
  };

  api.onMount(() => {
    router.setTitle(`Room ${props.roomID.get()} - Pointing Poker`);
  });

  api.onChange(() => {
    if (!UserService.userExists().get()) {
      return;
    }

    const roomID = props.roomID.get();
    if (PokerRoomService.roomID.get() !== roomID) {
      PokerRoomService.connectToRoom(roomID).catch(() => {
        router.navigate("notfound");
      });
    }
  }, [props.roomID]);

  const isSkeleton = PokerRoomService.connected.derive((c) => !c);

  return (
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
          <div class="voting-section-top-bar">
            <RoomIDDisplay />
            <OwnerControls />
          </div>
          <VoteButtons isSkeleton={isSkeleton} />
          <Participants />
        </div>
        <Chat />
      </div>
    </div>
  );
});
