import { logger } from "../../app-logger";
import type {
  RequestMiddleware,
  ResponseMiddleware,
} from "../simple-server/http-server";

function getProtocol(req: Request): string {
  const url = new URL(req.url);
  return url.protocol.replace(":", "");
}

function getForwardProtocol(req: Request): string {
  const forwarderProto = req.headers.get("X-Forwarded-Proto");
  if (forwarderProto != null) {
    return forwarderProto;
  }
  const forwarded = req.headers.get("Forwarded");
  const protoIdx = forwarded?.indexOf("proto=");
  if (protoIdx != null && protoIdx === -1) {
    let endIdx = forwarded!.indexOf(";", protoIdx);
    if (endIdx === -1) {
      endIdx = forwarded!.length;
    }
    return forwarded!.substring(protoIdx + 6, endIdx);
  }
  return "";
}

export function LogResponseMiddleware(): ResponseMiddleware {
  return (resp, req) => {
    const status = resp.status;
    const info = {
      ...resp.getLogData(),
      url: req.url,
      protocol: getProtocol(req),
      forward_protocol: getForwardProtocol(req),
      method: req.method,
      status: resp.status,
      content_length: resp.getBuffer().byteLength,
      is_gzipped: resp.headers.get("Content-Encoding") === "gzip",
      last_modified: resp.headers.get("Last-Modified"),
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
