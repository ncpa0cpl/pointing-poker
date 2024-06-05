import zlib from "zlib";
import { logger } from "../../app-logger";
import type { ResponseMiddleware } from "../simple-server/http-server";
import { RouterResponse } from "../simple-server/router-response";

const gzip = (data: Buffer): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(data, (err, buff) => {
      if (err) {
        reject(err);
      } else {
        resolve(buff);
      }
    });
  });
};

const isGzipAcceptable = (req: Request): boolean => {
  const acceptEncoding = req.headers.get("Accept-Encoding");
  return acceptEncoding != null && acceptEncoding.includes("gzip");
};

export const GzipMiddleware = (): ResponseMiddleware => (resp, req) => {
  if (
    resp.status < 200
    || resp.status >= 300
    || resp.headers.get("Content-Encoding") != null
    || !isGzipAcceptable(req)
  ) {
    return resp;
  }

  const buff = resp.getBuffer();
  return gzip(buff).then(compressed => {
    const newResp = new RouterResponse(compressed, {
      headers: resp.headers,
      status: resp.status,
      statusText: resp.statusText,
    });

    newResp.headers.set("Content-Encoding", "gzip");

    return newResp;
  }).catch(err => {
    logger.error("GZip compression failed", err);
    return resp;
  });
};
