import { Button, Typography } from "adwavecss";
import { KofiService } from "../../services/kofi/kofi-service";
import { KofiLink } from "../kofi-link/kofi-link";
import "./styles.css";
import { $component } from "@ncpa0cpl/vanilla-jsx";

export const KofiModal = $component(function KofiModal(_, api) {
  const handleDialogPress = (ev: MouseEvent | PointerEvent) => {
    const isWithinContent = !!(ev.target as HTMLElement).closest(".kofi-modal");
    if (!isWithinContent) {
      KofiService.modalVisisble.dispatch(false);
    }
  };

  api.onMount(() => {
    KofiService.modalVisisble.add((open) => {
      if (typeof dialog.showModal !== "undefined") {
        if (open) {
          dialog.showModal();
        } else {
          dialog.close();
        }
      }
    });
  });

  const dialog = (
    <dialog onclick={handleDialogPress}>
      <div class="kofi-modal">
        <h1 class={Typography.header}>Consider donating</h1>
        <p class={Typography.text}>
          It looks like you are enjoying this app. Please consider donating so
          that I can keep it running and ad-free.
        </p>
        <div class="buttons">
          <KofiLink />
          <button
            class={[Button.button, Button.flat]}
            onclick={() => KofiService.modalVisisble.dispatch(false)}
          >
            No
          </button>
        </div>
      </div>
    </dialog>
  ) as HTMLDialogElement;

  return dialog;
});
