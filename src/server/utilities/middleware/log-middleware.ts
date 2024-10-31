import { randomUUID } from "crypto";
import { logger } from "../../app-logger";
import type {
  RequestMiddleware,
  ResponseMiddleware,
} from "../simple-server/http-server";

const CORRELATION_ID = "reqCorrelationID";

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

export function LogRequestMiddleware(): RequestMiddleware {
  return (req) => {
    const uid = randomUUID();

    req.kv.set(CORRELATION_ID, uid);

    const info = {
      correlation_id: uid,
      url: req.url,
      method: req.method,
      protocol: getProtocol(req),
      forward_protocol: getForwardProtocol(req),
      referer: req.headers.get("Referer") ?? "NULL",
      user_agent: req.headers.get("User-Agent") ?? "NULL",
      sec_mobile: req.headers.get("Sec-Ch-Ua-Mobile") ?? "NULL",
    };

    queueMicrotask(() => {
      logger.info(`request received`, info);
    });
  };
}

export function LogResponseMiddleware(): ResponseMiddleware {
  return (resp, req) => {
    const uid = req.kv.get(CORRELATION_ID);
    const info = {
      correlation_id: uid,
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
      logger.info(`sending response`, info);
    });
    return resp;
  };
}
