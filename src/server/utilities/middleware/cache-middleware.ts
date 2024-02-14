import type { ResponseMiddleware } from "../simple-server/http-server";
import { RouterResponse } from "../simple-server/router-response";

export type CacheConfig = {
  /**
   * The max-age=N response directive indicates that the response
   * remains fresh until N seconds after the response is generated.
   */
  maxAge?: number;
  /**
   * The no-cache response directive indicates that the response
   * can be stored in caches, but the response must be validated
   * with the origin server before each reuse, even when the cache
   * is disconnected from the origin server.
   */
  noCache?: boolean;
  /**
   * The no-store response directive indicates that any caches
   * of any kind (private or shared) should not store this response.
   */
  noStore?: boolean;
  /**
   * The private response directive indicates that the response can
   * be stored only in a private cache (e.g. local caches in browsers).
   */
  private?: boolean;
  /**
   * The must-revalidate response directive indicates that the
   * response can be stored in caches and can be reused while
   * fresh. If the response becomes stale, it must be validated
   * with the origin server before reuse.
   */
  mustRevalidate?: boolean;
  /**
   * The max-stale=N request directive indicates that the client
   * allows a stored response that is stale within N seconds.
   */
  maxStale?: number;
  /**
   * The min-fresh=N request directive indicates that the client
   * allows a stored response that is fresh for at least N seconds.
   */
  minFresh?: number;
};

const DEFAULT_CONFIG: CacheConfig = {
  // 30 minutes
  maxAge: 30 * 60,
};

const addCacheHeadersFactory =
  (config: CacheConfig) => (resp: RouterResponse) => {
    if (resp.headers.get("Cache-Control") != null) {
      return resp;
    }

    if (config.noStore) {
      resp.headers.set("Cache-Control", "no-store");
      return resp;
    }

    if (config.noCache) {
      resp.headers.set("Cache-Control", "no-cache");
      return resp;
    }

    let cacheControl = "public";
    if (config.private) {
      cacheControl = "private";
    }
    if (config.maxAge != null) {
      cacheControl += `, max-age=${config.maxAge}`;
    }
    if (config.mustRevalidate) {
      cacheControl += ", must-revalidate";
    }
    if (config.maxStale != null) {
      cacheControl += `, max-stale=${config.maxStale}`;
    }
    if (config.minFresh != null) {
      cacheControl += `, min-fresh=${config.minFresh}`;
    }
    resp.headers.set("Cache-Control", cacheControl);
    return resp;
  };

export const CacheMiddleware = (
  config: CacheConfig = DEFAULT_CONFIG,
): ResponseMiddleware => {
  const addCacheHeaders = addCacheHeadersFactory(config);
  return (resp, req) => {
    let etag = resp.headers.get("ETag");
    if (etag == null) {
      const lastMod = resp.headers.get("Last-Modified");
      if (lastMod != null) {
        const hash = Bun.hash.crc32(lastMod).toString(16);
        resp.headers.set("ETag", hash);
        etag = hash;
      }
    }

    if (req.headers.get("If-None-Match") === etag) {
      return addCacheHeaders(
        new RouterResponse(Buffer.from(""), {
          status: 304,
          headers: resp.headers,
        }),
      );
    }

    return addCacheHeaders(resp);
  };
};
