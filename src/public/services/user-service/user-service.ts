import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { v4 } from "uuid";
import { ParticipantRole } from "../../../shared";

export type User = {
  id: string;
  publicID: string;
  name: string;
  defaultRole?: ParticipantRole;
};

const LOCAL_STORAGE_USER_KEY = "user";

export class UserService {
  static #user = sig<User | null>(null);

  public static get userOrNull() {
    return UserService.#user.readonly();
  }

  public static get user(): ReadonlySignal<User> {
    if (!UserService.#user.get()) {
      throw new Error("User does not exist.");
    }
    return UserService.#user as any;
  }

  public static userExists(): ReadonlySignal<boolean> {
    return this.#user.derive((user) => !!user);
  }

  public static username(): ReadonlySignal<string> {
    return this.#user.derive((user) => user?.name ?? "User");
  }

  public static defaultRole(): ParticipantRole {
    return this.#user.get()?.defaultRole ?? "voter";
  }

  public static createNewUser(name: string): User {
    const user: User = {
      id: v4(),
      publicID: v4(),
      name,
      defaultRole: "voter",
    };

    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
    UserService.#user.dispatch(user);

    return user;
  }

  public static changeName(name: string) {
    const userData = this.#user.get();
    if (userData) {
      const newUser = {
        ...userData,
        name,
      };

      localStorage.setItem(
        LOCAL_STORAGE_USER_KEY,
        JSON.stringify(newUser),
      );
      UserService.#user.dispatch(newUser);
    }
  }

  public static changeDefaultRole(role: ParticipantRole) {
    const userData = this.#user.get();
    if (userData) {
      const newUser: User = {
        ...userData,
        defaultRole: role,
      };

      localStorage.setItem(
        LOCAL_STORAGE_USER_KEY,
        JSON.stringify(newUser),
      );
      UserService.#user.dispatch(newUser);
    }
  }

  private static loadUserFromStorage() {
    const user = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (user) {
      const userObj = JSON.parse(user) as User;
      this.#user.dispatch(userObj);
    }
  }
}

UserService["loadUserFromStorage"]();
