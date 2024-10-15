import { router } from "@ncpa0cpl/vrouter";
import { UserService } from "../services/user-service/user-service";
import { ErrorPage } from "./error/error";
import { JoinRoom } from "./join-room/join-room";
import { RegisterPage } from "./register-form/register-form";
import { RoomNotFound } from "./room-not-found/room-not-found";
import { Room } from "./room/room";

export const Router = router({
  paramNames: [],
  component(ctx) {
    return <div class="box grow center-h">{ctx.out()}</div>;
  },
  subroutes(define) {
    return {
      join: define({
        paramNames: [],
        title: "Join Room - Pointing Poker",
        default: true,
        memo: true,
        component: () => {
          if (UserService.userExists().get() === false) {
            Router.nav.register.$open();
          }
          return <JoinRoom />;
        },
      }),
      register: define({
        title: "Register - Pointing Poker",
        paramNames: ["roomID"],
        component: (ctx) => <RegisterPage qparams={ctx.params} />,
      }),
      room: define({
        paramNames: ["roomID"],
        component: (ctx) => {
          const params = ctx.params;
          if (UserService.userExists().get() === false) {
            Router.nav.register.$open({
              roomID: params.get().roomID,
            });
          }
          return <Room roomID={params.derive((p) => p.roomID)} />;
        },
      }),
      error: define({
        paramNames: [],
        title: "Error",
        component: ErrorPage,
      }),
      notfound: define({
        paramNames: [],
        title: "Room Not Found - Pointing Poker",
        component: RoomNotFound,
      }),
    };
  },
});

declare global {
  const AppRouter: typeof Router;
}

Object.defineProperty(globalThis, "AppRouter", {
  value: Router,
  writable: true,
  configurable: true,
  enumerable: false,
});

export const PageRouterRoutes = () => {
  return Router.rootElement();
};
