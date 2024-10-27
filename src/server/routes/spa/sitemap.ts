import dedent from "dedent";
import path from "path";
import type { HttpServer } from "../../utilities/simple-server/http-server";
import { PUBLIC_DIR } from "./public-files.route";
const xml = dedent;

const INDEX_URL = `https://${process.env.HOSTNAME}/`;
const ABOUT_URL = `https://${process.env.HOSTNAME}/about`;

function fmtTs(ts: number) {
  const date = new Date(ts);
  return `${date.getUTCFullYear()}-${
    date.getUTCMonth() + 1
  }-${date.getUTCDate()}`;
}

const getSitemap = (
  lastMod: {
    index: string;
    about: string;
  },
) =>
  xml`
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${INDEX_URL.toString()}</loc>
    <lastmod>${lastMod.index}</lastmod>
  </url>
  <url>
    <loc>${ABOUT_URL.toString()}</loc>
    <lastmod>${lastMod.about}</lastmod>
  </url>
</urlset>
  `;

export function addSitemapRoute(server: HttpServer) {
  server.get("/sitemap.xml", async (ctx) => {
    if (!process.env.HOSTNAME) {
      return ctx.sendText(500, "HOSTNAME not known");
    }

    const INDEX_FILE = Bun.file(path.join(PUBLIC_DIR, "index.html"));
    const ABOUT_FILE = Bun.file(path.join(PUBLIC_DIR, "about.html"));
    const lastMod = {
      index: fmtTs(INDEX_FILE.lastModified),
      about: fmtTs(ABOUT_FILE.lastModified),
    };
    return ctx.sendXml(200, getSitemap(lastMod));
  });
}
