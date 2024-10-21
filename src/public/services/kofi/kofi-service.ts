import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { localStorageSignal } from "../../utilities/local-storage-signal";

export class KofiService {
  private static visitedCount = localStorageSignal(
    "kofi:visitedCount",
    0,
  );
  private static kofiLinkVisited = localStorageSignal(
    "kofi:kofiLinkVisited",
    false,
  );
  private static modalShown = localStorageSignal(
    "kofi:modalShown",
    false,
  );

  public static modalVisisble = sig(false);

  static visited() {
    KofiService.kofiLinkVisited.dispatch(true);
  }

  static {
    if (!KofiService.modalShown.get() && !KofiService.kofiLinkVisited.get()) {
      KofiService.visitedCount.dispatch(v => ++v);

      if (KofiService.visitedCount.get() >= 10) {
        KofiService.modalVisisble.dispatch(true);
        KofiService.modalShown.dispatch(true);
      }
    }
  }
}
