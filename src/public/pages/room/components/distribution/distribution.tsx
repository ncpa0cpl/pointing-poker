import { Range } from "@ncpa0cpl/vanilla-jsx";
import { Typography } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { groupBy } from "../../../../utilities/group-by";
import { VoteHighlights } from "../../vote-higlights";
import "./styles.css";

export const VotesDistribution = () => {
  const round = PokerRoomService.currentRound;

  const results = round.derive(round => {
    if (round?.finalResult) {
      const groupedVotes = Object.entries(
        groupBy(round?.results, res => res.vote),
      );

      /** highest vote count */
      const max = groupedVotes.reduce((max, [, votes]) => {
        return Math.max(max, votes.length);
      }, 0);

      return groupedVotes.map(([option, votes]) => {
        return {
          label: option,
          voteCount: votes.length,
          height: `${Math.round(100 * votes.length / max)}%` as const,
          users: Object.freeze(votes.map(v => v.publicUserID)),
        };
      });
    }

    return [];
  });

  return (
    <Range data={results} into={<div class={["votes-distribution"]} />}>
      {(res) => {
        const handleMouseEnter = () => {
          VoteHighlights.dispatch(res.users);
        };

        const handleMouseLeave = () => {
          VoteHighlights.dispatch([]);
        };

        return (
          <div class="dist-col">
            <div
              class="distribution-bar"
              style={`height: ${res.height};`}
              onmouseenter={handleMouseEnter}
              onmouseleave={handleMouseLeave}
            >
              <span class={[Typography.subtitle, "col-top-symbol"]}>
                {res.voteCount}
              </span>
              <span class={[Typography.text, "col-bottom-symbol"]}>
                <span>
                  {res.label}
                </span>
              </span>
            </div>
          </div>
        );
      }}
    </Range>
  );
};
