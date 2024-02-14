import type { Server } from "bun";
import type { RouterResponse } from "./router-response";

export interface Route {
  matches(method: string, url: string): boolean;
  handleRequest(
    request: Request,
    bunServer: Server,
    url: URL,
  ): RouterResponse | Promise<RouterResponse | undefined> | undefined;
  toView(): any;
}

export class Router {
  private routes: Route[] = [];

  public addRoute(
    route: Route,
  ) {
    this.routes.push(route);
  }

  public findRoute(
    method: string,
    url: string,
  ): Route | undefined {
    return this.routes.find((route) => {
      return route.matches(method, url);
    });
  }
}
