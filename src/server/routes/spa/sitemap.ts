import dedent from "dedent";
import path from "path";
import type { HttpServer } from "../../utilities/simple-server/http-server";
import { PUBLIC_DIR } from "./public-files.route";
const xml = dedent;

const INDEX_URL = `https://${process.env.HOSTNAME}/`;
const ABOUT_URL = `https://${process.env.HOSTNAME}/about`;
const PRIVACY_URL = `https://${process.env.HOSTNAME}/privacy`;

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
    privacy: string;
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
  <url>
    <loc>${PRIVACY_URL.toString()}</loc>
    <lastmod>${lastMod.privacy}</lastmod>
  </url>
</urlset>
  `;

export function addSitemapRoute(server: HttpServer) {
  server.get("/sitemap.xml", async (ctx) => {
    if (!process.env.HOSTNAME) {
      return ctx.sendText(500, "HOSTNAME not known");
    }

    const indexFile = Bun.file(path.join(PUBLIC_DIR, "index.html"));
    const aboutFile = Bun.file(path.join(PUBLIC_DIR, "about.html"));
    const privacyFile = Bun.file(path.join(PUBLIC_DIR, "privacy.html"));

    const lastMod = {
      index: fmtTs(indexFile.lastModified),
      about: fmtTs(aboutFile.lastModified),
      privacy: fmtTs(privacyFile.lastModified),
    };
    return ctx.sendXml(200, getSitemap(lastMod));
  });
}
