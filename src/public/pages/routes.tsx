import { router } from "@ncpa0cpl/vrouter";
import { UserService } from "../services/user-service/user-service";
import { AboutPage } from "./about/about";
import { ErrorPage } from "./error/error";
import { JoinRoom } from "./join-room/join-room";
import { RegisterPage } from "./register-form/register-form";
import { RoomClosed } from "./room-closed/room-closed";
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
        title: "Pointing Poker - Join Room",
        default: true,
        component: () => {
          if (UserService.userExists().get() === false) {
            Router.nav.register.$open();
          }
          return <JoinRoom />;
        },
      }),
      register: define({
        title: "Pointing Poker",
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
      about: define({
        paramNames: [],
        title: "Pointing Poker - About",
        component: AboutPage,
      }),
      error: define({
        paramNames: ["message"],
        title: "Pointing Poker - Error",
        component: ctx => <ErrorPage params={ctx.params} />,
      }),
      notfound: define({
        paramNames: [],
        title: "Pointing Poker - Room Not Found",
        component: RoomNotFound,
      }),
      roomclosed: define({
        paramNames: [],
        title: "Pointing Poker - Room Closed",
        component: RoomClosed,
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
