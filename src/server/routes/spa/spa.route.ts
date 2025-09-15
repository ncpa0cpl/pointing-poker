import path from "path";
import { ROOT_DIR } from "../../root-dir";
import { removeTrailing } from "../../utilities/remove-trailing";
import type { HttpServer } from "../../utilities/simple-server/http-server";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const pubDir = path.resolve(ROOT_DIR, "./dist/public");

const SPA_ROUTES = [
  "/join",
  "/notfound",
  "/register",
  "/room",
  "/about",
  "/stats",
  "/privacy",
  "/error",
  "/roomclosed",
];

const isSpaRoute = (path: string) => {
  const pathname = removeTrailing(
    new URL(path, "http://localhost/").pathname,
    "/",
  );
  for (let i = 0; i < SPA_ROUTES.length; i++) {
    const spaRoute = SPA_ROUTES[i]!;
    if (spaRoute === pathname) {
      return true;
    }
  }
  return false;
};

export function addSpaRoute(server: HttpServer) {
  const favicon = Bun.file(
    path.join(__dirname, "./favicon.ico"),
  );

  server.get(
    "/favicon.ico",
    ctx => {
      ctx.setCacheControl({
        maxAge: 60 * 60,
      });
      return ctx.sendFile(200, favicon);
    },
  );

  server.get("/*", async (ctx) => {
    const wildcard = ctx.getPathWildcard();

    if (!wildcard || isSpaRoute(wildcard)) {
      let filepath = pubDir;
      if (wildcard) {
        const fp = path.join(
          pubDir,
          removeTrailing(wildcard, "/") + ".html",
        );
        if (await Bun.file(fp).exists()) {
          filepath = fp;
        } else {
          filepath = path.join(pubDir, "index.html");
        }
      } else {
        filepath = path.join(pubDir, "index.html");
      }

      const resFile = Bun.file(
        filepath,
      );

      ctx.setCacheControl({
        noStore: true,
      });

      ctx.logValue("file_location", filepath);
      return ctx.sendFile(200, resFile);
    }

    return ctx.sendText(404, "Not found");
  });
}
