import { Server } from "bun";

export interface RouterRequest extends Request {
  kv: RequestKvStore;
  clientIp(): string | undefined;
}

const ROUTER_REQUEST_SYMBOL = Symbol("RouterRequest");

export function routerRequest(server: Server, request: Request): RouterRequest {
  const kvStore = new RequestKvStore();

  function getRequestClientIp(): string | undefined {
    return server.requestIP(request)?.address;
  }

  Object.defineProperty(request, "clientIp", {
    value: getRequestClientIp,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(request, "kv", {
    value: kvStore,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(request, ROUTER_REQUEST_SYMBOL, {
    value: true,
    writable: false,
    configurable: false,
  });

  return request as RouterRequest;
}

export function isRouterRequest(request: Request): request is RouterRequest {
  return ROUTER_REQUEST_SYMBOL in request;
}

class RequestKvStore {
  private _entries: Array<[string, any]> = [];

  has(key: string): boolean {
    return this._entries.some(([k]) => k === key);
  }

  get(key: string): any {
    const entry = this._entries.find(([k]) => k === key);
    return entry ? entry[1] : undefined;
  }

  set(key: string, value: any): void {
    const entry = this._entries.find(([k]) => k === key);
    if (entry) {
      entry[1] = value;
    } else {
      this._entries.push([key, value]);
    }
  }

  delete(key: string): void {
    const index = this._entries.findIndex(([k]) => k === key);
    if (index !== -1) {
      this._entries.splice(index, 1);
    }
  }

  clear(): void {
    this._entries.splice(0, this._entries.length);
  }

  keys(): Array<string> {
    return this._entries.map(([k]) => k);
  }

  values(): Array<any> {
    return this._entries.map(([, v]) => v);
  }

  entries(): Array<[string, any]> {
    return this._entries.slice();
  }
}

export { type RequestKvStore };
