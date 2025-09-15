import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Alert, Button, Card } from "adwavecss";
import { compileFastValidator, Infer } from "dilswer";
import { StatsType } from "../../../shared/stats";
import { PageLayout } from "../../components/page-layout/page-layout";
import { SentryService } from "../../services/sentry-service/sentry-service";
import "./styles.css";
import { Link } from "../../components/link/link";
import { Router } from "../routes";

const validate = compileFastValidator(StatsType);

export function StatsPage() {
  const error = sig<Error>();
  const stats = sig<Infer<typeof StatsType>>({
    activeRooms: 0,
    activeUsers: 0,
    thisMonthRoomCount: 0,
    thisMonthUserCount: 0,
  });

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
          <h2>Created Rooms in the last month:</h2>
          <p>
            {stats.derive(({ thisMonthRoomCount }) => `${thisMonthRoomCount}`)}
          </p>
          <h2>Opened connections in the last month:</h2>
          <p>
            {stats.derive(({ thisMonthUserCount }) => `${thisMonthUserCount}`)}
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
