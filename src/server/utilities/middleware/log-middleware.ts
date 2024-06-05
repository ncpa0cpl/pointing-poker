import { logger } from "../../app-logger";
import type { RequestMiddleware, ResponseMiddleware } from "../simple-server/http-server";

function getProtocol(req: Request): string {
  const url = new URL(req.url);
  return url.protocol;
}

export function LogResponseMiddleware(): ResponseMiddleware {
  return (resp, req) => {
    const status = resp.status;
    const info = {
      ...resp.getLogData(),
      url: req.url,
      protocol: getProtocol(req),
      method: req.method,
      status: resp.status,
      contentLength: resp.getBuffer().byteLength,
      isgzipped: resp.headers.get("Content-Encoding") === "gzip",
      lastModified: resp.headers.get("Last-Modified"),
    };
    queueMicrotask(() => {
      logger.info(`Sending response with status ${status}.`, info);
    });
    return resp;
  };
}

export function LogRequestMiddleware(): RequestMiddleware {
  return (req) => {
    const method = req.method;
    const url = req.url;
    queueMicrotask(() => {
      logger.info(`Received a request: ${method} ${url}`);
    });
  };
}