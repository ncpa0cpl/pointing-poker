import { Settings } from "luxon";
import "reflect-metadata";
import { logger } from "./app-logger";
import { Room } from "./rooms/room/room";
import { addRoutes } from "./routes/add-routes";
import { CacheMiddleware } from "./utilities/middleware/cache-middleware";
import { GzipMiddleware } from "./utilities/middleware/gzip-middleware";
import { LogRequestMiddleware, LogResponseMiddleware } from "./utilities/middleware/log-middleware";
import { deserializeClassInstancesFromPersistentStorage } from "./utilities/persistent-objects/deserialize-class-instances-from-persistent-storage";
import { HttpServer } from "./utilities/simple-server/http-server";
import { RouterResponse } from "./utilities/simple-server/router-response";

Settings.throwOnInvalid = true;
declare module "luxon" {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

const port = Number(process.env.PORT) || 8080;
const isDev = process.env.NODE_ENV === "development";

deserializeClassInstancesFromPersistentStorage(Room).catch((e) => {
  logger.error({
    message: "Deserialization of persisted class instances failed.",
    error: e,
  });
});

const app = new HttpServer();
app.onRequest(LogRequestMiddleware());
app.onResponse(CacheMiddleware());
app.onResponse(GzipMiddleware());
app.onResponse(LogResponseMiddleware());

addRoutes(app);

app.listen(port, {
  forceHttps: !isDev,
  onRouteError(err, req, route) {
    logger.error({
      message: "Unexpected error occurred.",
      error: err,
      request: req,
      route: route.toView(),
    });
    return RouterResponse.from("Internal server error", { status: 500 });
  },
});

logger.info(`Server started at http://localhost:${port}`);
