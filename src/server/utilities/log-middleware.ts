import { logger } from "../app-logger";
import type { ResponseMiddleware } from "./simple-server/http-server";

export function LogMiddleware(): ResponseMiddleware {
  return (resp, req) => {
    logger.debug(`Sending response with status ${resp.status}.`, {
      url: req.url,
      method: req.method,
      status: resp.status,
    });
    return resp;
  };
}
