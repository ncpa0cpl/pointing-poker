import { Case, Range, Switch } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Box } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import type { PokerRoomRound } from "../../../../services/poker-room-service/types";
import { VoteHighlights } from "../../vote-higlights";
import "./styles.css";

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
      into={<div class={["participants", Box.box, Box.bg4]} />}
    >
      {participant => {
        const badgeType = sig.derive(
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
            class={{
              "participant": true,
              "center-y": true,
              "disconnected": !participant.isActive,
              "highlight": sig.includes(VoteHighlights, participant.publicID),
            }}
          >
            <p
              class={{
                "username": true,
                "text": true,
                "inactive": !participant.isActive,
              }}
            >
              {participant.username}
            </p>
            <Switch value={badgeType} into={<div class="badge" />}>
              <Case match="awaiting-vote">
                {() => <p class="awaiting-vote text">…</p>}
              </Case>
              <Case match="voted">
                {() => <p class="voted text">Voted</p>}
              </Case>
              <Case match="vote-result">
                {() => (
                  <p class="vote-result text">
                    {userVote()}
                  </p>
                )}
              </Case>
              <Case match="own-vote-result">
                {() => (
                  <p class="own-vote-result text">
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
