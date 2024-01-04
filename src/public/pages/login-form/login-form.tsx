import { sig } from "@ncpa0cpl/vanilla-jsx";
import { Button, Card, Input } from "adwavecss";
import { UserService } from "../../services/user-service/user-service";
import { router } from "../routes";

export const LoginForm = () => {
  if (UserService.userExists().current()) {
    router.navigate("join");
  }

  const username = sig("");

  const onSubmit = (e: Event) => {
    e.preventDefault();

    if (username.current()) {
      UserService.createNewUser(username.current());
      router.navigate("join");
    }
  };

  const onInput = (e: Event) => {
    const target = e.target as any as HTMLInputElement;
    username.dispatch(target.value);
  };

  return (
    <div class={Card.card}>
      <form onsubmit={onSubmit}>
        <div class={Button.linked}>
          <input
            class={Input.input}
            id="username"
            type="text"
            value={username}
            oninput={onInput}
            placeholder={"Username"}
          />
          <button class={Button.button} type="submit">Submit</button>
        </div>
      </form>
    </div>
  );
};
