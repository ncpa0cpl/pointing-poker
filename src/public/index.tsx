import { Theme } from "adwavecss";
import "adwaveui";
import clsx from "clsx";
import "../../node_modules/adwavecss/dist/styles.css";
import "./index.css";
import { PageRouterRoutes } from "./pages/routes";

const start = () => {
  const App = () => {
    return (
      <div class={clsx(Theme.dark, "grow")}>
        <PageRouterRoutes />
      </div>
    );
  };

  const container = document.getElementById("root");
  container!.appendChild(<App />);
};

setTimeout(start, 0);
