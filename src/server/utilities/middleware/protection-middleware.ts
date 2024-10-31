import { logger } from "../../app-logger";
import { RequestMiddleware } from "../simple-server/http-server";
import { RouterResponse } from "../simple-server/router-response";

class RequestCounter {
  private count = 0;
  private lastChange = Date.now();

  constructor(
    readonly clientIp: string,
  ) {}

  incr() {
    this.count++;
    this.lastChange = Date.now();
  }

  decr() {
    this.count--;
    this.lastChange = Date.now();
  }

  get() {
    return this.count;
  }

  getLastChangeTs() {
    return this.lastChange;
  }
}

export function LimiterMiddleware(options?: {
  /**
   * Maximum number of requests per client allowed within the time frame.
   * Default: 50
   */
  clientRequestThreshold?: number;
  /**
   * Maximum number of requests allowed overall within the time frame.
   * Default: 10_000
   */
  maxOverallRequests?: number;
  /**
   * Time frame in milliseconds.
   * Default: 60_000 (1 minute)
   */
  timeFrame?: number;
}): RequestMiddleware {
  const {
    clientRequestThreshold: requestThreshold = 50,
    timeFrame = 60_000,
    maxOverallRequests = 10_000,
  } = options ?? {};

  const reqCounters = new Map<string, RequestCounter>();
  setInterval(() => {
    const now = Date.now();
    const cleanOlderThan = now - (4 * timeFrame);
    for (let counter of reqCounters.values()) {
      if (counter.getLastChangeTs() < cleanOlderThan) {
        reqCounters.delete(counter.clientIp);
      }
    }
  }, Math.max(30_000, 2 * timeFrame));

  const getCounter = (clientIp: string) => {
    if (!reqCounters.has(clientIp)) {
      reqCounters.set(clientIp, new RequestCounter(clientIp));
    }
    return reqCounters.get(clientIp)!;
  };

  let overallCounter = 0;
  return (req) => {
    if (overallCounter >= maxOverallRequests) {
      return tooManyrequests();
    }

    const clientIp = req.headers.get("x-forwarded-for")
      ?? req.clientIp();

    if (!clientIp) {
      return;
    }

    const clientCounter = getCounter(clientIp);

    overallCounter++;
    clientCounter.incr();
    setTimeout(() => {
      overallCounter--;
      clientCounter.decr();
    }, timeFrame);

    if (clientCounter.get() > requestThreshold) {
      return tooManyrequests();
    }
  };
}

function tooManyrequests() {
  logger.warn("Server is receiving too many requests - returning 429");
  return RouterResponse.from("Too many requests", {
    status: 429,
    statusText: "Too Many Requests",
  });
}
