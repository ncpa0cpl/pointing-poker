import { deriveMany, If, sig } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import clsx from "clsx";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const OwnerControls = () => {
  const btnDisable = sig(false);

  const isOwner = deriveMany(
    PokerRoomService.publicUserID,
    PokerRoomService.roomOwner,
    (userID, owner) => {
      return userID === owner.publicID;
    },
  );

  const endRound = () => {
    if (!btnDisable.current()) {
      btnDisable.dispatch(true);
      PokerRoomService.showResults().catch(e => {
        PokerRoomService.showSystemChatMsg(
          "ERROR: Unable to show results, due to connection issues.",
        );
      }).finally(() => {
        btnDisable.dispatch(false);
      });
    }
  };

  const startNextRound = () => {
    if (!btnDisable.current()) {
      btnDisable.dispatch(true);
      PokerRoomService.startNextRound().catch(e => {
        PokerRoomService.showSystemChatMsg(
          "ERROR: Unable to start the next round, due to connection issues.",
        );
      }).finally(() => {
        btnDisable.dispatch(false);
      });
    }
  };

  return (
    <If
      into={<div class="room-controls" />}
      condition={isOwner}
      then={() => (
        <>
          <div class="separator vertical" />
          <div class="linked">
            <button
              class={btnDisable.derive(d =>
                clsx(Button.button, { [Button.disabled]: d })
              )}
              disabled={btnDisable}
              onclick={endRound}
            >
              Show Results
            </button>
            <button
              class={btnDisable.derive(d =>
                clsx(Button.button, { [Button.disabled]: d })
              )}
              disabled={btnDisable}
              onclick={startNextRound}
            >
              Start Next Round
            </button>
          </div>
        </>
      )}
    />
  );
};
