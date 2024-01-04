import type { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx";
import clsx from "clsx";

type AsString<T> = T extends string ? T : string;
type IsLiteral<S extends string> = string extends S ? false : true;

export type RouteDefWithoutParams = {
  param?: undefined;
  memoized?: boolean;
  default?: boolean;
  component: () => JSX.Element;
};
export type RouteDefWithParams<P extends string> = {
  param: P;
  memoized?: boolean;
  default?: boolean;
  component: (params: ReadonlySignal<Record<P, string>>) => JSX.Element;
};

export type RouteDef<P extends string = string> = IsLiteral<P> extends true
  ? RouteDefWithParams<P>
  : RouteDefWithoutParams;

type ParamlessRoutes<R extends Record<string, any>> = {
  [K in keyof R as R[K] extends RouteDefWithParams<any> ? never : K]: R[K];
};
type ParamRoutes<R extends Record<string, any>> = {
  [K in keyof R as R[K] extends RouteDefWithParams<any> ? K : never]: R[K];
};

class Route {
  private element: JSX.Element | null = null;
  private params: Signal<Record<string, any>> = sig({});

  public constructor(
    public readonly path: string,
    public readonly def: RouteDefWithParams<any> | RouteDefWithoutParams,
  ) {}

  private updateParams(params: Record<string, string>) {
    this.params.dispatch(current => {
      return {
        ...current,
        ...params,
      };
    });
  }

  public render(params: Record<string, any>) {
    this.updateParams(params);

    if (!this.element) {
      this.element = this.def.component(this.params);
    }

    return this.element;
  }

  public detach() {
    this.element?.remove();

    if (this.def.memoized) {
      return;
    }

    this.element = null;
  }

  public matches(path: string): boolean {
    return path === this.path || path === "/" + this.path;
  }

  public getCurrentParams(): Record<string, any> {
    return this.params.current();
  }
}

class UrlController {
  private current = new URL(window.location.href);

  public push() {
    window.history.pushState({}, "", this.current);
  }

  public replace() {
    window.history.replaceState({}, "", this.current);
  }

  public setParams(params: Record<string, string>) {
    for (const key of this.current.searchParams.keys()) {
      this.current.searchParams.delete(key);
    }

    for (const [key, value] of Object.entries(params)) {
      this.current.searchParams.set(key, value);
    }
  }

  public setPath(path: string, params: Record<string, string>) {
    this.current.pathname = path;
    this.setParams(params);
  }

  public getPath() {
    return this.current.pathname;
  }

  public getParams() {
    return Object.fromEntries(this.current.searchParams.entries());
  }
}

export class SimpleRouter<
  const ROUTES extends Record<
    string,
    RouteDefWithParams<string> | RouteDefWithoutParams
  >,
> {
  private readonly container = <div class={clsx("routerbox")} />;
  private currentRoute: Route | null = null;
  private readonly routes: Route[];
  private readonly url = new UrlController();

  public constructor(
    routes: ROUTES,
  ) {
    this.routes = Object.entries(routes).map(([path, def]) => {
      return new Route(path, def);
    });

    window.addEventListener("popstate", () => {
      const newParams = Object.fromEntries(
        new URLSearchParams(window.location.search).entries(),
      );
      const newPathname = window.location.pathname;

      if (newPathname === this.url.getPath()) {
        // only update params
        this.url.setParams(newParams);
        return;
      }

      this.updateContainer(newPathname, newParams);
    });

    this.Out = this.Out.bind(this);

    setTimeout(() => {
      this.navigate(this.url.getPath() as any, this.url.getParams() as any);
    });
  }

  private findRoute(path: string): Route | undefined {
    const r = this.routes.find((route) => route.matches(path));
    if (r) {
      return r;
    }
    return this.routes.find((route) => route.def.default);
  }

  public updateContainer(path: string, params?: any): void {
    const newRoute = this.findRoute(path);

    if (!newRoute) {
      throw new Error(`Invalid Route: ${path}`);
    }

    if (this.currentRoute === newRoute) {
      this.currentRoute.render(params);
      this.url.setParams(
        this.currentRoute.getCurrentParams(),
      );
      return;
    }

    this.currentRoute?.detach();

    const elem = newRoute.render(params);
    this.url.setPath(newRoute.path, newRoute.getCurrentParams());
    this.container.appendChild(elem);
    this.currentRoute = newRoute;
  }

  public navigate<PATH extends keyof ParamlessRoutes<ROUTES>>(
    path: PATH,
  ): void;
  public navigate<PATH extends keyof ParamRoutes<ROUTES>>(
    path: PATH,
    params: Record<AsString<ROUTES[PATH]["param"]>, string>,
  ): void;
  public navigate(path: string, params?: any): void {
    queueMicrotask(() => {
      this.updateContainer(path, params);
      this.url.push();
    });
  }

  public replace<PATH extends keyof ParamlessRoutes<ROUTES>>(
    path: PATH,
  ): void;
  public replace<PATH extends keyof ParamRoutes<ROUTES>>(
    path: PATH,
    params: Record<AsString<ROUTES[PATH]["param"]>, string>,
  ): void;
  public replace(path: string, params?: any): void {
    queueMicrotask(() => {
      this.updateContainer(path, params);
      this.url.replace();
    });
  }

  public goBack() {
    queueMicrotask(() => {
      window.history.back();
    });
  }

  public current() {
    return {
      path: this.currentRoute?.path,
      params: this.currentRoute?.getCurrentParams(),
    };
  }

  public Out() {
    return this.container;
  }
}

export const route = <const P extends string>(
  def: RouteDefWithParams<P> | RouteDefWithoutParams,
): IsLiteral<P> extends true ? RouteDefWithParams<P> : RouteDefWithoutParams =>
  def as any;
