import {
  type CacheConfig,
  generateCacheControlHeader,
} from "../simple-server/headers/generate-cache-control-header";
import type { ResponseMiddleware } from "../simple-server/http-server";
import { RouterResponse } from "../simple-server/router-response";

const DEFAULT_CONFIG: CacheConfig = {
  // 30 minutes
  maxAge: 30 * 60,
};

const addCacheHeadersFactory =
  (config: CacheConfig) => (resp: RouterResponse) => {
    if (resp.headers.get("Cache-Control") != null) {
      return resp;
    }
    resp.headers.set("Cache-Control", generateCacheControlHeader(config));
    return resp;
  };

export const CacheMiddleware = (
  config: CacheConfig = DEFAULT_CONFIG,
): ResponseMiddleware => {
  const addCacheHeaders = addCacheHeadersFactory({ ...config });
  return (resp, req) => {
    // Only cache GET requests are cacheable
    if (req.method !== "GET") {
      return resp;
    }

    // responses with a no-store directive are not cacheable
    const cacheControl = resp.headers.get("Cache-Control");
    if (cacheControl?.includes("no-store")) {
      return resp;
    }

    let etag = resp.headers.get("ETag");
    if (etag == null || etag === "") {
      const lastMod = resp.headers.get("Last-Modified");
      if (lastMod != null) {
        const hash = Bun.hash.crc32(lastMod).toString(16);
        resp.headers.set("ETag", hash);
        etag = hash;
      }
    }

    if (!!etag && req.headers.get("If-None-Match") === etag) {
      return addCacheHeaders(
        new RouterResponse(Buffer.from(""), {
          status: 304,
          headers: resp.headers,
        }, resp),
      );
    }

    return addCacheHeaders(resp);
  };
};
