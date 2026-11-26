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

export function generateCacheControlHeader(config: CacheConfig) {
  if (config.noStore) {
    return "no-store";
  }

  if (config.noCache) {
    return "no-cache";
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

  return cacheControl;
}
