import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button, Card, Input, Typography } from "adwavecss";
import { PageLayout } from "../../components/page-layout/page-layout";
import { UserService } from "../../services/user-service/user-service";
import "./styles.css";
import { AdwSelectorChangeEvent } from "adwaveui";
import { validator } from "dilswer";
import { DTParticipantRole } from "../../../shared";
import { Link } from "../../components/link/link";
import { Router } from "../routes";

const isValidRole = validator(DTParticipantRole);

export function UserSettings() {
  const inputVal = sig(UserService.username().get());
  const selectedRole = sig(UserService.defaultRole());

  const save = () => {
    const newname = inputVal.get().trim();
    const defaultRole = selectedRole.get();

    if (newname != "") {
      UserService.changeName(newname);
    }

    if (defaultRole != UserService.defaultRole()) {
      UserService.changeDefaultRole(defaultRole);
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      save();
    }
  };

  const onRoleChange = (e: AdwSelectorChangeEvent) => {
    if (isValidRole(e.value)) {
      selectedRole.dispatch(e.value);
    }
  };

  return (
    <PageLayout class="user-settings-page">
      <div class={[Card.card]}>
        <h1 class={Typography.header}>User Settings</h1>
        <div class="user-settings-form">
          <label htmlFor="username">
            Username:
          </label>
          <input
            id="username"
            name="username"
            class={Input.input}
            defaultValue={UserService.username().get()}
            oninput={e => inputVal.dispatch(e.target.value)}
            onkeydown={onKeydown}
          />
          <label>
            Default role:
          </label>
          <adw-selector value={selectedRole.get()} onchange={onRoleChange}>
            <adw-option value="voter">
              Voter
            </adw-option>
            <adw-option value="viewer">
              Viewer
            </adw-option>
          </adw-selector>
          <div class="buttons">
            <Link
              class={Button.className({})}
              to={Router.nav.join}
            >
              Back
            </Link>
            <button
              class={Button.className({ color: "primary" })}
              onclick={save}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
