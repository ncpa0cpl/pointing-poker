import { SentryService } from "./services/sentry-service/sentry-service";

import { Box, Theme } from "adwavecss";
import { KofiModal } from "./components/kofi-modal/kofi-modal";
import { ThemeSwitch } from "./components/theme-switch/theme-switch";
import { PageRouterRoutes } from "./pages/routes";

import "../../node_modules/adwavecss/dist/styles.css";
import "./index.css";

declare global {
  const RLS_VERSION: string;
  const ENVIRONMENT: string;
  const SENTRY_DSN: string;
}

const start = () => {
  try {
    const App = () => {
      return (
        <div class={[Theme.dark, Box.box, "grow", "theme-provider"]}>
          <PageRouterRoutes />
          <ThemeSwitch />
          <KofiModal />
        </div>
      );
    };

    const container = document.getElementById("root");
    container!.replaceChildren(<App />);
  } catch (error) {
    SentryService.fatal(error);
  }
};

start();
