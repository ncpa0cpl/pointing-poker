import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Button, Card, Input, Typography } from "adwavecss";
import { PageLayout } from "../../components/page-layout/page-layout";
import { UserService } from "../../services/user-service/user-service";
import "./styles.css";
import { Link } from "../../components/link/link";
import { Router } from "../routes";

export function UserSettings() {
  const inputVal = sig(UserService.username().get());

  const save = () => {
    const newname = inputVal.get().trim();
    if (newname != "") {
      UserService.changeName(newname);
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      save();
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
