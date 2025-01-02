import { Range } from "@ncpa0cpl/vanilla-jsx";
import { Typography } from "adwavecss";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import { groupBy } from "../../../../utilities/group-by";
import { VoteHighlights } from "../../vote-higlights";
import "./styles.css";

export const VotesDistribution = () => {
  const round = PokerRoomService.currentRound;

  return (
    <div class="votes-distribution">
      <h2 class={Typography.header}>
        Distribution Graph
      </h2>
      {round.derive(round => {
        const results = (() => {
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
        })();

        if (results.length == 0) {
          return (
            <>
              <span class={[Typography.header, "ditribution-empty-msg"]}>
                N/A
              </span>
              <span class={[Typography.text, "ditribution-empty-msg"]}>
                Complete the round to see the results.
              </span>
            </>
          );
        }

        const handleMouseLeave = () => {
          VoteHighlights.dispatch([]);
        };

        return (
          <div class="graph">
            {results.map((res) => {
              const handleMouseEnter = () => {
                VoteHighlights.dispatch(res.users);
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
                      <span
                        title={res.label + (res.voteCount !== 1
                          ? ` (${res.voteCount} votes)`
                          : ` (${res.voteCount} vote)`)}
                      >
                        {res.label}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
