import type { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx";
import { UserService } from "../services/user-service/user-service";
import { route, SimpleRouter } from "../utilities/simple-router/simple-router";
import { JoinRoom } from "./join-room/join-room";
import { RegisterPage } from "./register-form/register-form";
import { Room } from "./room/room";

export const AuthRoute = <RF extends (...args: any[]) => JSX.Element>(
  route: RF,
): RF =>
  ((...args) => {
    if (UserService.userExists().current() === false) {
      router.navigate("register");
    }

    return route(...args);
  }) as RF;

export const router = new SimpleRouter({
  join: route({
    default: true,
    memoized: true,
    component: AuthRoute(JoinRoom),
  }),
  register: route({
    component: () => <RegisterPage />,
  }),
  room: route({
    param: "roomID",
    component: AuthRoute((params: ReadonlySignal<{ roomID: string }>) => (
      <Room roomID={params.derive(p => p.roomID)} />
    )),
  }),
});

declare global {
  const approuter: typeof router;
}

Object.defineProperty(globalThis, "approuter", {
  value: router,
  writable: false,
  configurable: false,
  enumerable: false,
});

export const PageRouterRoutes = () => {
  return (
    <div class="box grow center">
      <router.Out />
    </div>
  );
};
