import { UserService } from "../services/user-service/user-service";
import { route, SimpleRouter } from "../utilities/simple-router/simple-router";
import { JoinRoom } from "./join-room/join-room";
import { RegisterPage } from "./register-form/register-form";
import { RoomNotFound } from "./room-not-found/room-not-found";
import { Room } from "./room/room";

export const router = new SimpleRouter({
  join: route({
    title: "Join Room - Pointing Poker",
    default: true,
    memoized: true,
    component: () => {
      if (UserService.userExists().current() === false) {
        router.navigate("register", {});
      }
      return <JoinRoom />;
    },
  }),
  register: route({
    title: "Register - Pointing Poker",
    params: ["?roomID"],
    component: (params) => <RegisterPage qparams={params} />,
  }),
  room: route({
    params: ["roomID"],
    component: (params) => {
      if (UserService.userExists().current() === false) {
        router.navigate("register", { roomID: params.current().roomID });
      }
      return <Room roomID={params.derive(p => p.roomID)} />;
    },
  }),
  notfound: route({
    title: "Room Not Found - Pointing Poker",
    component: RoomNotFound,
  }),
});

declare global {
  const approuter: typeof router;
}

Object.defineProperty(globalThis, "approuter", {
  value: router,
  writable: true,
  configurable: true,
  enumerable: false,
});

export const PageRouterRoutes = () => {
  return (
    <div class="box grow center">
      <router.Out />
    </div>
  );
};
