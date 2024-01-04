import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx";
import { v4 } from "uuid";

export type User = {
  id: string;
  publicID: string;
  name: string;
};

const LOCAL_STORAGE_USER_KEY = "user";

export class UserService {
  static #user = sig<User | null>(null);

  public static get user(): ReadonlySignal<User> {
    if (!UserService.#user.current()) {
      throw new Error("User does not exist.");
    }
    return UserService.#user as any;
  }

  public static userExists(): ReadonlySignal<boolean> {
    return this.#user.derive((user) => !!user);
  }

  public static createNewUser(name: string): User {
    const user: User = {
      id: v4(),
      publicID: v4(),
      name,
    };

    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
    UserService.#user.dispatch(user);

    return user;
  }

  private static loadUserFromStorage() {
    const user = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (user) {
      const userObj = JSON.parse(user);
      this.#user.dispatch(userObj);
    }
  }
}

UserService["loadUserFromStorage"]();
