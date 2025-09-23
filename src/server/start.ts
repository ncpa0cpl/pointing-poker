#!/usr/bin/env bun

import { Settings as LuxonSettings } from "luxon";
import "reflect-metadata";
import { logger } from "./app-logger";
import { Room } from "./rooms/room/room";
import { addRoutes } from "./routes/add-routes";
import { CacheMiddleware } from "./utilities/middleware/cache-middleware";
import { GzipMiddleware } from "./utilities/middleware/gzip-middleware";
import {
  LogRequestMiddleware,
  LogResponseMiddleware,
} from "./utilities/middleware/log-middleware";
import { LimiterMiddleware } from "./utilities/middleware/protection-middleware";
import { deserializeClassInstancesFromPersistentStorage } from "./utilities/persistent-objects/deserialize-class-instances-from-persistent-storage";
import { HttpServer } from "./utilities/simple-server/http-server";
import { RouterResponse } from "./utilities/simple-server/router-response";

LuxonSettings.throwOnInvalid = true;
declare module "luxon" {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

const port = Number(process.env.PORT) || 8080;
const hostnames = process.env.HOSTNAMES;
const forceTls = process.env.FORCE_TLS === "true";
const isDev = process.env.NODE_ENV === "development";
const tlsCertLocation = process.env.TLS_CERT;
const tlsKeyLocation = process.env.TLS_KEY;

const tlsCert = tlsCertLocation ? Bun.file(tlsCertLocation) : undefined;
const tlsKey = tlsKeyLocation ? Bun.file(tlsKeyLocation) : undefined;

const hostnamesList = isDev
  ? ["http://localhost:8080"]
  : (hostnames ? hostnames.split(",").map(h => h.trim()) : []);

logger.info(
  `ENV:
  HOSTNAMES=${hostnamesList}
  PORT=${port}
  FORCE_TLS=${forceTls}
  TLS_CERT=${tlsCertLocation}
  TLS_KEY=${tlsKeyLocation}
`,
);

deserializeClassInstancesFromPersistentStorage(Room).catch((e) => {
  logger.error({
    message: "Deserialization of persisted class instances failed.",
    error: e,
  });
});

const app = new HttpServer();
app.onRequest(LimiterMiddleware());
app.onRequest(LogRequestMiddleware());
app.onResponse(CacheMiddleware());
app.onResponse(GzipMiddleware());
app.onResponse(LogResponseMiddleware());

addRoutes(app);

app.listen(port, {
  allowedOrigins: hostnamesList,
  allowedHeaders: "*",
  forceHttps: isDev ? false : forceTls,
  maxBodySize: 512 * 1024,
  tlsCert,
  tlsKey,
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

if (isDev) {
  logger.info(`Server started at http://localhost:${port} in DEV mode`);
} else {
  logger.info(`Server started at http://localhost:${port}`);
}
