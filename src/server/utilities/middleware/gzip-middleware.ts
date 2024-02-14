import zlib from "zlib";
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

export const GzipMiddleware = (): ResponseMiddleware => (resp) => {
  if (
    resp.status < 200
    || resp.status >= 300
    || resp.headers.get("Content-Encoding") != null
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
  });
};
