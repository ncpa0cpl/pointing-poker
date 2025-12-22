import { Case, If, Range, Switch } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Box, Button, ScrollView, Typography } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import type { PokerRoomRound } from "../../../../services/poker-room-service/types";
import { VoteHighlights } from "../../vote-higlights";
import "./styles.css";
import { StyleDict } from "@ncpa0cpl/vanilla-jsx/dist/types/jsx-namespace/jsx.types";
import { Icon } from "../../../../assets/icons";

type BadgeType = "own-vote-result" | "vote-result" | "voted" | "awaiting-vote";

const getUserVote = (
  results: PokerRoomRound["results"],
  publicUserID: string,
) => {
  const userResult = results.find(r => r.publicUserID === publicUserID);

  return userResult;
};

function resolveBadgeType(
  round: PokerRoomRound,
  voterID: string,
  currentUserID: string,
) {
  if (
    round?.isInProgress && currentUserID === voterID
  ) {
    return "own-vote-result";
  } else if (round?.isInProgress === false) {
    return "vote-result";
  } else if (
    round?.results.some(result => result.publicUserID === voterID)
  ) {
    return "voted";
  } else {
    return "awaiting-vote";
  }
}

export const Participants = () => {
  const isViewerOnly = PokerRoomService.isViewer;

  const viewData = sig.derive(
    PokerRoomService.participants,
    PokerRoomService.currentRound,
    PokerRoomService.publicUserID,
    (participants, round, currentUserID) => {
      const roundParicipants = participants.map(p => {
        return {
          publicUID: p.publicID,
          role: p.role,
          isActive: p.isActive,
          username: p.username,
          hideUsername: false,
          vote: "-",
          badge: "own-vote-result" as BadgeType,
          isCurrentUser: p.publicID === currentUserID,
          show: p.role === "voter",
        };
      });

      if (round) {
        for (const result of round.results) {
          let rp = roundParicipants.find(p =>
            p.publicUID === result.publicUserID
          );
          if (!rp) {
            rp = {
              publicUID: result.publicUserID,
              role: "voter",
              isActive: false,
              username: result.username,
              hideUsername: false,
              vote: "-",
              badge: "own-vote-result" as BadgeType,
              isCurrentUser: result.publicUserID === currentUserID,
              show: true,
            };
            roundParicipants.push(rp);
          }

          rp.show = true;
          rp.vote = result.vote;
          rp.hideUsername = result.hideUsername && !rp.isCurrentUser;
          rp.badge = resolveBadgeType(
            round,
            result.publicUserID,
            currentUserID ?? "",
          );
        }
      }
      // current user should always be first
      roundParicipants.sort((a, b) =>
        Number(b.isCurrentUser) - Number(a.isCurrentUser)
      );

      // for (let i = 0; i < 20; i++) {
      //   roundParicipants.push({
      //     badge: "vote-result",
      //     hideUsername: false,
      //     isActive: true,
      //     isCurrentUser: false,
      //     publicUID: "",
      //     role: "voter",
      //     show: true,
      //     username: "Test",
      //     vote: "1",
      //   });
      // }

      return {
        currentUserID,
        participants: roundParicipants.filter(p => p.show),
      };
    },
  );

  return (
    <>
      <If
        condition={isViewerOnly}
        then={() => (
          <button
            class={["set-role-voter-btn", Button.className({ flat: true })]}
            onclick={() => PokerRoomService.setRole("voter")}
          >
            Join voting
          </button>
        )}
      />
      <div class={[ScrollView.scrollView, "participant-wrapper"]}>
        <div class={["participants", Box.box, Box.bg4]}>
          {viewData.derive(({ participants }) => {
            return participants.map(participant => {
              return (
                <div
                  class={{
                    "participant": true,
                    "center-y": true,
                    "disconnected": !participant.isActive,
                    "highlight": sig.includes(
                      VoteHighlights,
                      participant.publicUID,
                    ),
                  }}
                  style={participant.hideUsername
                    ? {
                      order: Math.round(Math.random() * 1000).toFixed(0),
                    }
                    : {}}
                >
                  <div
                    class={{
                      "username": true,
                      "text": true,
                      "inactive": !participant.isActive,
                    }}
                  >
                    {participant.hideUsername
                      ? <p>Anonymous User</p>
                      : <p>{participant.username}</p>}
                    {participant.isCurrentUser && participant.role === "voter"
                      && (
                        <button
                          class={[
                            "set-role-viewer-btn",
                            Button.className({
                              shape: "circular",
                              adaptive: true,
                            }),
                          ]}
                          title="Change role to a viewer."
                          onclick={() => PokerRoomService.setRole("viewer")}
                        >
                          <Icon.Eye alt="Change role to a viewer." />
                        </button>
                      )}
                  </div>
                  <Switch
                    value={sig.as(participant.badge)}
                    into={<div class="badge" />}
                  >
                    <Case match="awaiting-vote">
                      {() => <p class="awaiting-vote text">…</p>}
                    </Case>
                    <Case match="voted">
                      {() => <p class="voted text">Voted</p>}
                    </Case>
                    <Case match="vote-result">
                      {() => (
                        <p class="vote-result text">
                          {participant.vote}
                        </p>
                      )}
                    </Case>
                    <Case match="own-vote-result">
                      {() => (
                        <p class="own-vote-result text">
                          {participant.vote}
                        </p>
                      )}
                    </Case>
                  </Switch>
                </div>
              );
            });
          })}
        </div>
        <div
          class={{
            "audience": true,
            hidden: PokerRoomService.participants.derive(p =>
              !p.some(p => p.role === "viewer")
            ),
          }}
        >
          <h5
            class={Typography.header_sm}
            title="Users with a viewer role. These users do not participate in the voting but can see what is happening in the room."
          >
            Audience
          </h5>
          <div class="audience-list">
            {PokerRoomService.participants.derive(p =>
              p.filter(p => p.role === "viewer").map(p => (
                <div class="audience-entry">
                  <p class={Typography.subtitle}>{p.username}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};
