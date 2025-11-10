import { ReadonlySignal, sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import { AdwSwitchChangeEvent } from "adwaveui";
import { DefaultOption } from "../../../../../shared";
import { Icon } from "../../../../assets/icons";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";

export function SettingsButton() {
  const inProgress = sig(false);
  const nextOptValue = sig("");
  const visiblePanel = sig<"main" | "vote-editor">("main");

  const editOptions = sig<{ id: string; name: string }[]>([]);
  const privateMode = sig(false);

  const initial = {
    voteOptions: [] as DefaultOption[],
    privateMode: false,
  };

  const handleOpen = () => {
    if (dialog.open) return;
    const { options = [] } = PokerRoomService.currentRound.get() ?? {};
    const mode = PokerRoomService.mode.get();

    editOptions.dispatch(options);
    privateMode.dispatch(mode === "private");

    initial.voteOptions = options;
    initial.privateMode = mode === "private";

    dialog.showModal();
  };

  const handleInput = (ev: Event & { target: HTMLInputElement }) => {
    nextOptValue.dispatch(ev.target.value);
  };

  const handleAdd = () => {
    editOptions.dispatch(opt => {
      return [...opt, { id: "", name: nextOptValue.get() }];
    });
    nextOptValue.dispatch("");
  };

  const handleInputKeydown = (ev: Event) => {
    if ((ev as KeyboardEvent).key == "Enter") {
      handleAdd();
    }
  };

  const handleRemove = (idx: number) => {
    editOptions.dispatch(opt => {
      opt = opt.slice();
      opt.splice(idx, 1);
      return opt;
    });
  };

  const handleCancel = () => {
    if (visiblePanel.get() === "main") {
      dialog.close();
    } else {
      visiblePanel.dispatch("main");
    }
  };

  const handleConfirm = async () => {
    if (
      editOptions.get() !== initial.voteOptions
    ) {
      const opts = editOptions
        .get()
        .map((o) => o.name);

      try {
        inProgress.dispatch(true);
        await PokerRoomService.setOptions(opts);
      } catch (err) {
        window.alert(
          "There was an error when trying to change the voting options.",
        );
      }
    }

    if (privateMode.get() != initial.privateMode) {
      try {
        inProgress.dispatch(true);
        await PokerRoomService.setMode(
          privateMode.get() ? "private" : "default",
        );
      } catch (err) {
        window.alert(
          "There was an error when attempting to change the private mode setting.",
        );
      }
    }

    inProgress.dispatch(false);
    visiblePanel.dispatch("main");
    dialog.close();
  };

  const handleSavePreset = () => {
    const opts = editOptions
      .get()
      .map((o) => o.name)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    localStorage.setItem("vote-options-preset", JSON.stringify(opts));
  };

  const dialog = (
    <dialog
      class="settings-modal"
      onclick={e => e.stopPropagation()}
    >
      <div class="settings-modal-content dialog disabled-cursor-none">
        <div class="dialog-header">
          <button
            class={{
              btn: true,
              flat: true,
              disabled: inProgress,
            }}
            disabled={inProgress}
            onclick={handleCancel}
          >
            {visiblePanel.derive(v => v === "vote-editor" ? "Back" : "Cancel")}
          </button>
          <span class="dialog-title">Settings</span>
          <button
            class={{
              btn: true,
              primary: true,
              disabled: inProgress,
            }}
            disabled={inProgress}
            onclick={handleConfirm}
          >
            Confirm
          </button>
        </div>
        <div class={["dialog-body", visiblePanel]}>
          <div class="settings-main">
            <span class="switch-label">
              Anonymous Mode
              <span title="When anonymous mode is active, votes placed will have the voter username hidden from all other participants.">
                <Icon.Questionmark alt="When anonymous mode is active, votes placed will have the voter username hidden from all other participants." />
              </span>
            </span>
            <adw-switch
              active={privateMode}
              onchange={ev => privateMode.dispatch(ev.active)}
            />
            <button
              class="btn open-vote-editor-btn"
              onclick={() => visiblePanel.dispatch("vote-editor")}
            >
              Modify Vote Options
            </button>
          </div>
          <div class="vote-options-editor">
            <div class="scrollview options-list">
              {editOptions.$map((opt, idx) => (
                <div class="linked option">
                  <button
                    class="btn danger close-btn"
                    title="Remove"
                    onclick={() => handleRemove(idx)}
                  >
                    <Icon.Close />
                  </button>
                  <button
                    class="btn disabled opt-value-preview"
                    ariaReadOnly="true"
                    disabled
                  >
                    {opt.name}
                  </button>
                </div>
              ))}
            </div>
            <div class="bottom-controls">
              <div class="linked">
                <input
                  class="input"
                  value={nextOptValue}
                  oninput={handleInput}
                  onkeydown={handleInputKeydown}
                  placeholder={"Add new vote option"}
                />
                <button
                  class="btn add-btn"
                  title="Add Option"
                  onclick={handleAdd}
                >
                  <Icon.Plus />
                </button>
              </div>
              <button
                class="btn save-preset-btn"
                title="Save this vote options as a preset that will be used for any rooms you create in the future."
                onclick={handleSavePreset}
              >
                Save preset
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  ) as HTMLDialogElement;

  return (
    <div>
      <button
        class={[Button.button, "settings-btn"]}
        onclick={handleOpen}
      >
        <Icon.Cogwheel alt="Settings" title="Settings" />
      </button>
      {dialog}
    </div>
  );
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "adw-switch": {
        onchange?: (ev: AdwSwitchChangeEvent) => void;
        active?: boolean | ReadonlySignal<boolean>;
      };
    }
  }
}
