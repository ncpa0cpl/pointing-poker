import { If, Range } from "@ncpa0cpl/vanilla-jsx";
import { type ReadonlySignal, sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button } from "adwavecss";
import CloseSvg from "../../../../assets/close.svg";
import CogwheelSvg from "../../../../assets/cogwheel.svg";
import PlusSvg from "../../../../assets/plus.svg";
import { PokerRoomService } from "../../../../services/poker-room-service/poker-room-service";
import "./styles.css";

export const VoteButtons = (props: { isSkeleton: ReadonlySignal<boolean> }) => {
  const round = PokerRoomService.currentRound;
  const clickHandler = (optionID: string) => () => {
    PokerRoomService.sendVote(optionID);
  };
  const isOwner = PokerRoomService.isCurrentUserTheOwner;

  return (
    <If
      into={<div class="center-h vote-btns" />}
      condition={props.isSkeleton}
      then={() => {
        const skeletonBtns = [0, 1, 2, 3, 5, 8, 13];
        return (
          <div class="vote-buttons-container">
            {skeletonBtns.map(opt => {
              return (
                <button
                  class={{
                    [Button.button]: true,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }}
      else={() => {
        return (
          <div>
            <Range
              data={PokerRoomService.currentRound.derive(r => r?.options ?? [])}
              into={<div class="vote-buttons-container" />}
            >
              {opt => {
                return (
                  <button
                    class={{
                      [Button.button]: true,
                      [Button.disabled]: round.derive(r => !r?.isInProgress),
                    }}
                    onclick={clickHandler(opt.id)}
                    disabled={round.derive(r => !r?.isInProgress)}
                  >
                    {opt.name}
                  </button>
                );
              }}
            </Range>
            {sig.and(isOwner, <SettingsButton />)}
          </div>
        );
      }}
    />
  );
};

function SettingsButton() {
  const inProgress = sig(false);
  const nextOptValue = sig("");
  const editOptions = sig<{ id: string; name: string }[]>([]);

  const handleOpen = () => {
    if (dialog.open) return;
    editOptions.dispatch(PokerRoomService.currentRound.get()?.options ?? []);
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
    dialog.close();
  };

  const handleConfirm = async () => {
    const opts = editOptions
      .get()
      .map((o) => o.name);

    try {
      inProgress.dispatch(true);
      await PokerRoomService.setOptions(opts);
      dialog.close();
    } catch (err) {
      window.alert("There was an error when attempting this action.");
    } finally {
      inProgress.dispatch(false);
    }
  };

  const handleSavePreset = () => {
    const opts = editOptions
      .get()
      .map((o) => o.name)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    localStorage.setItem("vote-options-preset", JSON.stringify(opts));
  };

  const dialog = (
    <dialog onclick={e => e.stopPropagation()}>
      <div class="settings-modal-content dialog">
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
            Cancel
          </button>
          <span class="dialog-title">Change vote options</span>
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
        <div class="dialog-body">
          <ul class="scrollview">
            {editOptions.$map((opt, idx) => (
              <li class="linked">
                <button
                  class="btn danger close-btn"
                  title="Remove"
                  onclick={() => handleRemove(idx)}
                >
                  <CloseSvg />
                </button>
                <button
                  class="btn disabled opt-value-preview"
                  ariaReadOnly="true"
                  disabled
                >
                  {opt.name}
                </button>
              </li>
            ))}
          </ul>
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
                <PlusSvg />
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
    </dialog>
  ) as HTMLDialogElement;

  return (
    <button
      class={[Button.button, "settings-btn"]}
      onclick={handleOpen}
    >
      <CogwheelSvg alt="Settings" title="Settings" />
      {dialog}
    </button>
  );
}
