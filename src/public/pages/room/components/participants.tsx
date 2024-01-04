import { Case, deriveMany, Range, Switch } from "@ncpa0cpl/vanilla-jsx";
import { Box } from "adwavecss";
import { clsx } from "clsx";
import { PokerRoomService } from "../../../services/poker-room-service/poker-room-service";
import type { PokerRoomRound } from "../../../services/poker-room-service/types";

const getUserVote = (
  results: PokerRoomRound["results"],
  publicUserID: string,
) => {
  const userResult = results.find(r => r.publicUserID === publicUserID);

  return userResult;
};

export const Participants = () => {
  return (
    <Range
      data={PokerRoomService.participants}
      into={<div class={clsx("participants", Box.box, Box.bg2)} />}
    >
      {participant => {
        const badgeType = deriveMany(
          PokerRoomService.currentRound,
          PokerRoomService.publicUserID,
          (r, currentUserPubID) => {
            if (
              r?.isInProgress && currentUserPubID === participant.publicID
            ) {
              return "own-vote-result";
            } else if (r?.isInProgress === false) {
              return "vote-result";
            } else if (
              r?.results.some(result =>
                result.publicUserID === participant.publicID
              )
            ) {
              return "voted";
            } else {
              return "awaiting-vote";
            }
          },
        );

        const userVote = () =>
          PokerRoomService.currentRound.derive(r => {
            let v = "-";
            if (r) {
              const userVote = getUserVote(r.results, participant.publicID);
              if (userVote) {
                v = userVote.vote;
              }
            }
            return v;
          });

        return (
          <div
            class={clsx("participant", "center-y", {
              disconnected: !participant.isActive,
            })}
          >
            <p
              class={clsx("participant", "text", {
                inactive: !participant.isActive,
              })}
            >
              {participant.username}
            </p>
            <Switch value={badgeType}>
              <Case match="awaiting-vote">
                {() => <p class="badge awaiting-vote text">...</p>}
              </Case>
              <Case match="voted">
                {() => <p class="badge voted text">Voted</p>}
              </Case>
              <Case match="vote-result">
                {() => (
                  <p class="badge vote-result text">
                    {userVote()}
                  </p>
                )}
              </Case>
              <Case match="own-vote-result">
                {() => (
                  <p class="badge own-vote-result text">
                    {userVote()}
                  </p>
                )}
              </Case>
            </Switch>
          </div>
        );
      }}
    </Range>
  );
};
