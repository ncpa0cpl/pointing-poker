import path from "path";
import { ROOT_DIR } from "../../root-dir";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const pubDir = path.resolve(ROOT_DIR, "./dist/esm/public");

const SPA_ROUTES = [
  "/join",
  "/notfound",
  "/register",
  "/room",
];

const isSpaRoute = (path: string) => {
  const pathname = new URL(path, "http://localhost/").pathname;
  for (let i = 0; i < SPA_ROUTES.length; i++) {
    const spaRoute = SPA_ROUTES[i]!;
    if (spaRoute === pathname) {
      return true;
    }
  }
  return false;
};

export function addSpaRoute(server: HttpServer) {
  server.get("/*", async (ctx) => {
    const wildcard = ctx.getPathWildcard();

    if (!wildcard || isSpaRoute(wildcard)) {
      const indexFile = Bun.file(
        path.join(pubDir, "index.html"),
      );

      ctx.setCacheControl({
        noStore: true,
      });

      return ctx.sendFile(200, indexFile);
    }

    return ctx.sendText(404, "Not found");
  });
}
