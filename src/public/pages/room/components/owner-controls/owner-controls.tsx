import { If } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const OwnerControls = () => {
  const disableAll = sig(false);
  const disableShowResults = sig.derive(
    disableAll,
    PokerRoomService.currentRound,
    (disableAll, round) => {
      return disableAll || round?.finalResult != null;
    },
  );
  const disableNextRound = sig.derive(
    disableAll,
    PokerRoomService.currentRound,
    (disableAll, round) => {
      return disableAll || round?.finalResult == null;
    },
  );

  const isOwner = sig.derive(
    PokerRoomService.publicUserID,
    PokerRoomService.roomOwner,
    (userID, owner) => {
      return userID === owner.publicID;
    },
  );

  const endRound = () => {
    if (!disableAll.get()) {
      disableAll.dispatch(true);
      PokerRoomService.showResults()
        .catch((e) => {
          PokerRoomService.showSystemChatMsg(
            "ERROR: Unable to show results, due to connection issues.",
          );
        })
        .finally(() => {
          disableAll.dispatch(false);
        });
    }
  };

  const startNextRound = () => {
    if (!disableAll.get()) {
      disableAll.dispatch(true);
      PokerRoomService.startNextRound()
        .catch((e) => {
          PokerRoomService.showSystemChatMsg(
            "ERROR: Unable to start the next round, due to connection issues.",
          );
        })
        .finally(() => {
          disableAll.dispatch(false);
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
              class={{
                [Button.button]: true,
                [Button.disabled]: disableShowResults,
              }}
              disabled={disableShowResults}
              onclick={endRound}
            >
              Show Results
            </button>
            <button
              class={{
                [Button.button]: true,
                [Button.disabled]: disableNextRound,
              }}
              disabled={disableNextRound}
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
