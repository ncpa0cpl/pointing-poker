import { ReadonlySignal, sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Alert, Button, Card } from "adwavecss";
import { compileFastValidator } from "dilswer";
import { StatHistory, Stats, StatsType } from "../../../shared/stats";
import { PageLayout } from "../../components/page-layout/page-layout";
import { SentryService } from "../../services/sentry-service/sentry-service";
import "./styles.css";
import { $component, If } from "@ncpa0cpl/vanilla-jsx";
import { Link } from "../../components/link/link";
import { Router } from "../routes";

type GraphType =
  | null
  | "thisMonthRoomCountHistory"
  | "thisMonthRoundsHistory"
  | "thisMonthUserCountHistory"
  | "thisMonthVotesHistory";

const validate = compileFastValidator(StatsType);

export function StatsPage() {
  const selectedGraph = sig<GraphType>(null);
  const error = sig<Error>();
  const stats = sig<Stats>({
    activeRooms: 0,
    activeUsers: 0,
    thisMonthRoomCount: 0,
    thisMonthUserCount: 0,
    thisMonthRounds: 0,
    thisMonthVotes: 0,
    thisMonthRoomCountHistory: [],
    thisMonthRoundsHistory: [],
    thisMonthUserCountHistory: [],
    thisMonthVotesHistory: [],
  });

  const handleGraphBtnPress = (graph: GraphType) => {
    selectedGraph.dispatch(graph);
  };

  const getStats = async () => {
    try {
      error.dispatch(undefined);

      const response = await fetch("/api/stats");
      if (response.ok) {
        const data = await response.json();
        if (validate(data)) {
          stats.dispatch(data);
        } else {
          const err = new Error("invalid response type for /api/stats");
          SentryService.error(err, { data });
          error.dispatch(err);
        }
      } else {
        const err = new Error("error response received from /api/stats");
        SentryService.error(err, {
          status: response.statusText,
          code: response.status,
        });
        error.dispatch(err as Error);
      }
    } catch (err) {
      SentryService.error(err);
      error.dispatch(err as Error);
    }
  };

  getStats();

  return (
    <PageLayout class="stats-page">
      {error.derive(err => {
        if (err != null) {
          return (
            <div class={[Alert.alert, Alert.error]}>
              Due to an error it was not possible to get the stats.
            </div>
          );
        }
      })}
      <div class={[Card.card, "stats-view"]}>
        <div>
          <Link to={Router.nav.join}>
            <button class={Button.button}>Home</button>
          </Link>
          <button class={Button.button} onclick={getStats}>Refresh</button>
        </div>
        <div class="stats-table">
          <h2>Active Rooms:</h2>
          <p>{stats.derive(({ activeRooms }) => `${activeRooms}`)}</p>
          <h2>Active Users:</h2>
          <p>{stats.derive(({ activeUsers }) => `${activeUsers}`)}</p>

          <h2
            onclick={() => handleGraphBtnPress("thisMonthRoomCountHistory")}
            class={{
              interactable: true,
              selected: sig.eq(selectedGraph, "thisMonthRoomCountHistory"),
            }}
          >
            Created Rooms in the last month:
          </h2>
          <p>
            {stats.derive(({ thisMonthRoomCount }) => `${thisMonthRoomCount}`)}
          </p>

          <h2
            onclick={() => handleGraphBtnPress("thisMonthUserCountHistory")}
            class={{
              interactable: true,
              selected: sig.eq(selectedGraph, "thisMonthUserCountHistory"),
            }}
          >
            Opened connections in the last month:
          </h2>
          <p>
            {stats.derive(({ thisMonthUserCount }) => `${thisMonthUserCount}`)}
          </p>

          <h2
            onclick={() => handleGraphBtnPress("thisMonthRoundsHistory")}
            class={{
              interactable: true,
              selected: sig.eq(selectedGraph, "thisMonthRoundsHistory"),
            }}
          >
            Rounds played in the last month:
          </h2>
          <p>
            {stats.derive(({ thisMonthRounds }) => `${thisMonthRounds}`)}
          </p>

          <h2
            onclick={() => handleGraphBtnPress("thisMonthVotesHistory")}
            class={{
              interactable: true,
              selected: sig.eq(selectedGraph, "thisMonthVotesHistory"),
            }}
          >
            Votes placed in the last month:
          </h2>
          <p>
            {stats.derive(({ thisMonthVotes }) => `${thisMonthVotes}`)}
          </p>
        </div>
        <If
          condition={selectedGraph.derive(s => s !== null)}
          then={() => <Graph selectedGraph={selectedGraph} stats={stats} />}
        />
      </div>
    </PageLayout>
  );
}

function Graph(
  props: {
    selectedGraph: ReadonlySignal<GraphType>;
    stats: ReadonlySignal<Stats>;
  },
) {
  return (
    <figure class="stat-graph">
      <div class="grap-content">
        {sig.derive(props.selectedGraph, props.stats, (selected, stats) => {
          const grapDecorations: JSX.Element[] = [];

          const statsHistory: StatHistory = [];
          const statsData = stats[selected as Exclude<GraphType, null>]
            .slice();

          const oneMonth = 2.628e+9;
          const oneDay = 8.64e+7;
          const today = new Date();
          let date = new Date(Date.now() - oneMonth);
          date.setHours(0, 0, 1);

          while (today >= date) {
            const day = date.getDate();
            const month = MONTHS[date.getMonth() + 1]!;

            const data = statsData.find(data =>
              data.month === month && data.day === day
            );

            const i = statsHistory.length;
            statsHistory.push({
              day,
              month,
              value: data?.value ?? 0,
            });

            // draw a legend on the bottoms of the graph
            if (i % 3 == 0) {
              grapDecorations.push(
                <div
                  class="y-scale-value"
                  style={{
                    left: `calc(0.1em + ${i * 3}%)`,
                    bottom: "-1.8em",
                  }}
                >
                  <div class="dash"></div>
                  <span class="date">{`${month.slice(0, 3)} ${day}`}</span>
                </div>,
              );
            }

            date = new Date(date.getTime() + oneDay);
          }

          const max = statsHistory.reduce(
            (max, { value }) => value > max ? value : max,
            0,
          );

          const elems = statsHistory.map((entry, idx) => {
            return (
              <li
                style={`--bottom: ${(0.9 * 100 * entry.value / max) + "%"};
                 --left: ${(idx * 3) + "%"}`}
              >
                <div
                  class="data-point"
                  data-value={entry.value}
                  title={`${entry.month} ${entry.day}`}
                >
                  <span>
                    {entry.value}
                  </span>
                </div>
                <div class="line-segment" />
              </li>
            );
          });

          // draw lines between points on the graph
          for (let i = 0; i < statsHistory.length - 1; i++) {
            const entry = statsHistory[i]!;
            const nextEntry = statsHistory[i + 1]!;

            const y1 = 0.9 * 100 * entry.value / max;
            const x1 = i * 3;

            const y2 = 0.9 * 100 * nextEntry.value / max;
            const x2 = (i + 1) * 3;

            grapDecorations.push(
              <div
                class="graph-line-box"
                style={{
                  top: `calc(${(100 - Math.max(y1, y2))}% - .6em)`,
                  bottom: `calc(${Math.min(y1, y2)}% + .6em)`,
                  left: `calc(${x1}% + .4em)`,
                  right: `calc(${(100 - x2)}% - .4em)`,
                }}
              >
                <DiagonalBox direction={y2 > y1 ? "up" : "down"} />
              </div>,
            );
          }

          // draw a legend on the left of the graph
          for (let i = 0; i <= max; i++) {
            if (max > 8) {
              let breakpoint = Math.round(max / 10);
              breakpoint = Math.max(1, breakpoint - (breakpoint % 5));

              if (i % breakpoint != 0) {
                continue;
              }
            }

            grapDecorations.push(
              <div
                class="x-scale-value"
                style={{
                  right: "calc(100% + .3em)",
                  bottom: `${.9 * 100 * i / max}%`,
                }}
              >
                <span>{i}</span>
                <div class="dash"></div>
              </div>,
            );
          }

          return (
            <>
              <ul class="line-chart">
                {elems}
              </ul>
              {grapDecorations}
            </>
          );
        })}
      </div>
    </figure>
  );
}

const DiagonalBox = $component(
  function DiagonalBox(
    props: JSX.IntrinsicElements["div"] & { direction: "up" | "down" },
    api,
  ) {
    const line = <div class="graph-line" /> as HTMLDivElement;
    const box = (
      <div {...props}>
        {line}
      </div>
    ) as HTMLDivElement;

    box.classList.add("diagonal-box");

    const updateLineAngle = () => {
      let dir = props.direction == "up" ? 1 : -1;

      const { width, height } = box.getBoundingClientRect();
      let angle = -1 * (calcAngle(
        { x: 0, y: 500 },
        { x: width, y: 500 + dir * Math.max(0, height - 2) },
      ));

      if (angle < 0) {
        angle = angle + 6.28319;
      }

      line.style.transform = `rotate(${angle}rad)`;

      if (angle < 1.5708) {
        line.style.top = "0";
      } else {
        line.style.bottom = "0";
      }
    };

    api.onMount(() => {
      updateLineAngle();

      const onresize = () => {
        updateLineAngle();
      };
      window.addEventListener("resize", onresize);

      return () => {
        window.removeEventListener("resize", onresize);
      };
    });

    return box;
  },
);

type Point = { x: number; y: number };
function calcAngle(point1: Point, point2: Point) {
  // Calculate the difference in x and y coordinates
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;

  // Use Math.atan2 to get the angle in radians
  // Math.atan2(dy, dx) returns an angle in the range of -PI to PI
  const angleRadians = Math.atan2(dy, dx);

  return angleRadians;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
