import { Case, Switch } from "@ncpa0cpl/vanilla-jsx";
import { Button } from "adwavecss";
import { localStorageSignal } from "../../../../utilities/local-storage-signal";
import { VotesDistribution } from "../distribution/distribution";
import { Statistics } from "../statistics/statistics";
import "./styles.css";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

export enum ResultsTab {
  Statistics,
  Distribution,
}

export const ResultTabs = () => {
  const openedTab = localStorageSignal("results-tab", ResultsTab.Statistics);

  return (
    <div class="result-tabs">
      <div class={[Button.linked, "result-tabs-switch-btns"]}>
        <button
          class={{
            [Button.button]: true,
            [Button.toggled]: sig.eq(openedTab, ResultsTab.Statistics),
          }}
          onclick={() => {
            openedTab.dispatch(ResultsTab.Statistics);
          }}
        >
          Statistics
        </button>
        <button
          class={{
            [Button.button]: true,
            [Button.toggled]: sig.eq(openedTab, ResultsTab.Distribution),
          }}
          onclick={() => {
            openedTab.dispatch(ResultsTab.Distribution);
          }}
        >
          Distribution
        </button>
      </div>
      <div class="results-tab-contents">
        <Switch value={openedTab}>
          <Case match={ResultsTab.Statistics}>
            {() => <Statistics />}
          </Case>
          <Case match={ResultsTab.Distribution}>
            {() => <VotesDistribution />}
          </Case>
        </Switch>
      </div>
    </div>
  );
};
