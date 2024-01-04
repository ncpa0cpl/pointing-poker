import type { RouteDef, Routes } from "./types";

class RoutePathSegment<S extends string> {
  private readonly segment: S;
  private readonly parent?: RoutePathSegment<string>;
  private readonly subRoutes = new Map<string, RoutePathSegment<string>>();
  private readonly parameters = new Map<string, RoutePathSegment<string>>();
  private readonly paramValue?: string;
  public readonly isAParameter: boolean;

  public constructor(
    segment: S,
    parent?: RoutePathSegment<string>,
    isAParameter?: boolean,
    paramValue?: string,
  ) {
    this.segment = segment;
    this.isAParameter = isAParameter ?? false;
    this.parent = parent;
    this.paramValue = paramValue;
  }

  public get name() {
    return this.segment;
  }

  public cloneWithParamValue(paramValue: string): RoutePathSegment<string> {
    const clone = new RoutePathSegment(
      this.segment,
      this.parent,
      this.isAParameter,
      paramValue,
    );
    return clone;
  }

  public addSubRoute(
    subSegment: RoutePathSegment<string>,
    parametrized: boolean,
  ): void {
    if (parametrized) {
      this.parameters.set(subSegment.name, subSegment);
    } else {
      this.subRoutes.set(subSegment.segment, subSegment);
    }
  }

  public getSubSegmentRoute(name: string): RoutePathSegment<string> {
    const route = this.subRoutes.get(name);
    if (!route) {
      throw new Error(`Route ${name} not found`);
    }
    return route;
  }

  public getParametrizedRoute(
    name: string,
    value: string,
  ): RoutePathSegment<string> {
    const param = this.parameters.get(name);
    if (!param) {
      throw new Error(`Route parameter ${name} not found`);
    }
    return param.cloneWithParamValue(value);
  }

  public buildPath(): string {
    const pathPart = this.paramValue !== undefined
      ? this.paramValue
      : this.segment;

    if (this.parent) {
      return `${this.parent.buildPath()}/${pathPart}`;
    }

    return `/${pathPart}`;
  }

  public hasParametrizedRoute(name: string): boolean {
    return this.parameters.has(name);
  }

  public getProxy(): any {
    return new Proxy(this, {
      get: (target, prop) => {
        if (typeof prop !== "string") {
          throw new Error("Route path segment property must be a string");
        }

        if (prop === "path") {
          return () => target.buildPath();
        }

        if (target.hasParametrizedRoute(prop)) {
          function getWithParam(value: string) {
            return target
              .getParametrizedRoute(prop as string, value)
              .getProxy();
          }

          Object.defineProperty(getWithParam, "pattern", {
            get() {
              return target
                .getParametrizedRoute(prop as string, `:${prop}`)
                .buildPath();
            },
          });

          return getWithParam;
        }

        return target.getSubSegmentRoute(prop).getProxy();
      },
    });
  }
}

const parseRoutes = (
  routes: RouteDef,
  parent?: RoutePathSegment<string>,
): RoutePathSegment<string>[] => {
  const segments: RoutePathSegment<string>[] = [];

  for (const [key, value] of Object.entries(routes)) {
    if (!key) continue;

    const route = new RoutePathSegment(
      key.replace(/^:/, ""),
      parent,
      key.startsWith(":"),
    );
    segments.push(route);

    if (value) {
      const subSegments = parseRoutes(value, route);
      for (const seg of subSegments) {
        route.addSubRoute(seg, seg.isAParameter);
      }
    }
  }

  return segments;
};

export const RoutesMap = <D extends RouteDef>(routes: D): Routes<D> => {
  const segments = parseRoutes(routes);

  return new Proxy(segments, {
    get(target, propKey) {
      if (typeof propKey !== "string") {
        throw new Error("Route path segment property must be a string");
      }

      const seg = target.find((seg) => seg.name === propKey);
      if (!seg) {
        return () => "/";
      }

      return seg.getProxy();
    },
  }) as any;
};
