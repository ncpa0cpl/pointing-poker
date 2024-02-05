import { Settings } from "luxon";
import "reflect-metadata";
import { logger } from "./app-logger";
import { Room } from "./rooms/room/room";
import { addRoutes } from "./routes/add-routes";
import { LogMiddleware } from "./utilities/log-middleware";
import { deserializeClassInstancesFromPersistentStorage } from "./utilities/persistent-objects/deserialize-class-instances-from-persistent-storage";
import { HttpServer } from "./utilities/simple-server/http-server";

Settings.throwOnInvalid = true;
declare module "luxon" {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

const port = Number(process.env.PORT) || 8080;

deserializeClassInstancesFromPersistentStorage(Room).catch((e) => {
  logger.error({
    message: "Deserialization of persisted class instances failed.",
    error: e,
  });
});

const app = new HttpServer();
app.onResponse(LogMiddleware());

addRoutes(app);

app.listen(port, {
  onRouteError(err, req, route) {
    logger.error({
      message: "Unexpected error occurred.",
      error: err,
      request: req,
      route: route.toView(),
    });
    return new Response("Internal server error", { status: 500 });
  },
});

logger.info(`Server started at http://localhost:${port}`);
