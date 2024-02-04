import { Box, Theme } from "adwavecss";
import "adwaveui";
import clsx from "clsx";
import "../../node_modules/adwavecss/dist/styles.css";
import { ThemeSwitch } from "./components/theme-switch/theme-switch";
import "./index.css";
import { PageRouterRoutes } from "./pages/routes";

const start = () => {
  const App = () => {
    return (
      <div class={clsx(Theme.dark, Box.box, "grow", "theme-provider")}>
        <PageRouterRoutes />
        <ThemeSwitch />
      </div>
    );
  };

  const container = document.getElementById("root");
  container!.replaceChildren(<App />);
};

start();
