import type { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Immediate, type Resolvable } from "../resolvable";

declare global {
  interface ViewTransition {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition(): void;
  }

  interface Document {
    startViewTransition?(cb: () => void): ViewTransition;
  }
}

export type AsString<T> = T extends string ? T : string;

export type RouteDefWithoutParams = {
  title?: string;
  params?: undefined;
  memoized?: boolean;
  default?: boolean;
  component: () => JSX.Element;
};
export type RouteDefWithParams<PNames extends string[], PDict extends object> =
  {
    title?: string;
    params: PNames;
    memoized?: boolean;
    default?: boolean;
    component: (
      params: ReadonlySignal<PDict>,
    ) => JSX.Element;
  };

export type ParamlessRoutes<R extends Record<string, any>> = {
  [K in keyof R as R[K] extends RouteDefWithParams<any, any> ? never : K]: R[K];
};
export type ParamRoutes<R extends Record<string, any>> = {
  [K in keyof R as R[K] extends RouteDefWithParams<any, any> ? K : never]: R[K];
};

export type GetParamRoute<
  R extends Record<string, any>,
  RName extends string,
> = R[RName] extends RouteDefWithParams<infer P, infer O>
  ? RouteDefWithParams<P, O>
  : never;

export type ParamName<N extends string> = N extends `?${infer PN}` ? PN : N;

export type ParamDict<
  ParamNames extends string[],
> =
  & {
    [
      K in ParamNames[number] as K extends `?${string}` ? ParamName<K>
        : never
    ]?: string;
  }
  & {
    [
      K in ParamNames[number] as K extends `?${string}` ? never
        : ParamName<K>
    ]: string;
  };

export type ParamDictFor<
  Routes extends Record<string, any>,
  RName extends string,
> = GetParamRoute<Routes, RName> extends RouteDefWithParams<any, infer O> ? O
  : never;

class Route {
  private element: JSX.Element | null = null;
  private params: Signal<Record<string, any>> = sig({});

  public constructor(
    public readonly path: string,
    public readonly def: RouteDefWithParams<any, any> | RouteDefWithoutParams,
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
  private history: Array<[url: string, params: object, title: string]> = [];

  public push(title: string) {
    this.history.push([
      this.current.href,
      Object.fromEntries(this.current.searchParams.entries()),
      title,
    ]);
    window.history.pushState({}, "", this.current);
  }

  public replace(title: string) {
    this.history.splice(this.history.length - 1, 1, [
      this.current.href,
      Object.fromEntries(this.current.searchParams.entries()),
      title,
    ]);
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

  public getPrevious() {
    return this.history.at(-2);
  }
}

export interface RouterOptions {
  enableTransition: boolean;
}

export class SimpleRouter<
  const ROUTES extends Record<
    string,
    RouteDefWithParams<string[], any> | RouteDefWithoutParams
  >,
> {
  private readonly titleElem: HTMLTitleElement;
  private readonly container = <div class={"routerbox"} />;
  private currentRoute: Route | null = null;
  private readonly routes: Route[];
  private readonly url = new UrlController();
  private options: RouterOptions = {
    enableTransition: true,
  };
  private currentTransition: ViewTransition | null = null;

  public constructor(
    routes: ROUTES,
  ) {
    const titleElem = document.head.getElementsByTagName("title")[0];
    if (titleElem) {
      this.titleElem = titleElem as HTMLTitleElement;
    } else {
      this.titleElem = <title></title> as any;
      document.head.appendChild(this.titleElem);
    }

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

  private withTransition<R>(changeDom: () => R): Resolvable<R> {
    if (!document.startViewTransition || !this.options.enableTransition) {
      return new Immediate(() => {
        return changeDom();
      });
    }

    if (this.currentTransition) {
      this.currentTransition.skipTransition();
    }

    let result: R;
    const transistion = document.startViewTransition(() => {
      result = changeDom();
    });

    return transistion.finished.then(() => {
      this.currentTransition = null;
      return result;
    });
  }

  private findRoute(path: string): Route | undefined {
    const r = this.routes.find((route) => route.matches(path));
    if (r) {
      return r;
    }
    return this.routes.find((route) => route.def.default);
  }

  private getCurrentTitle() {
    return this.titleElem.innerText;
  }

  public updateContainer(path: string, params?: any): Resolvable<void> {
    const newRoute = this.findRoute(path);

    if (!newRoute) {
      throw new Error(`Invalid Route: ${path}`);
    }

    if (this.currentRoute === newRoute) {
      this.currentRoute.render(params);
      this.url.setParams(
        this.currentRoute.getCurrentParams(),
      );

      return new Immediate(() => {});
    }

    return this.withTransition(() => {
      this.currentRoute?.detach();

      const elem = newRoute.render(params);
      this.url.setPath(newRoute.path, newRoute.getCurrentParams());
      this.container.appendChild(elem);
      this.currentRoute = newRoute;

      if (newRoute.def.title) {
        this.setTitle(newRoute.def.title);
      }
    });
  }

  public navigate<PATH extends keyof ParamlessRoutes<ROUTES>>(
    path: PATH,
  ): Promise<void>;
  public navigate<PATH extends keyof ParamRoutes<ROUTES>>(
    path: PATH,
    params: ParamDictFor<ROUTES, AsString<PATH>>,
  ): Promise<void>;
  public navigate(path: string, params?: any): Promise<void> {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        this.updateContainer(path, params).then(() => {
          this.url.push(this.getCurrentTitle());
          resolve();
        });
      });
    });
  }

  public replace<PATH extends keyof ParamlessRoutes<ROUTES>>(
    path: PATH,
  ): Promise<void>;
  public replace<PATH extends keyof ParamRoutes<ROUTES>>(
    path: PATH,
    params: Record<AsString<ROUTES[PATH]["params"]>, string>,
  ): Promise<void>;
  public replace(path: string, params?: any): Promise<void> {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        this.updateContainer(path, params).then(() => {
          this.url.replace(this.getCurrentTitle());
          resolve();
        });
      });
    });
  }

  public goBack(): Promise<void> {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        const prev = this.url.getPrevious();
        if (prev) {
          const [url, params, title] = prev;
          this.updateContainer(url, params).then(() => {
            this.setTitle(title);
            this.url.replace(title);
            resolve();
          });
        }
      });
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

  public setOptions(options: RouterOptions) {
    this.options = options;
  }

  /**
   * Sets the title of the current page.
   */
  public setTitle(title: string) {
    this.titleElem.innerText = title;
  }
}

export function route(def: RouteDefWithoutParams): RouteDefWithoutParams;
export function route<
  const P extends string[],
>(
  def: RouteDefWithParams<P, ParamDict<P>>,
): RouteDefWithParams<P, ParamDict<P>>;
export function route(
  def: any,
): any {
  return def;
}
