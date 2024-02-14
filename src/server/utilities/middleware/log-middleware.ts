import { logger } from "../../app-logger";
import type { ResponseMiddleware } from "../simple-server/http-server";

export function LogMiddleware(): ResponseMiddleware {
  return (resp, req) => {
    logger.info(`Sending response with status ${resp.status}.`, {
      url: req.url,
      method: req.method,
      status: resp.status,
      contentLength: resp.getBuffer().byteLength,
      isgzipped: resp.headers.get("Content-Encoding") === "gzip",
      lastModified: resp.headers.get("Last-Modified"),
    });
    return resp;
  };
}
