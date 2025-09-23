import dedent from "dedent";
import path from "path";
import { logger } from "../../app-logger";
import type { HttpServer } from "../../utilities/simple-server/http-server";
import { PUBLIC_DIR } from "./public-files.route";
const xml = dedent;

function fmtTs(ts: number) {
  const date = new Date(ts);
  return date.toISOString();
}

const getSitemap = (
  url: string,
  lastMod: {
    index: string;
    about: string;
    privacy: string;
  },
) => {
  return xml`
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${lastMod.index}</lastmod>
    <priority>1.00</priority>
  </url>
  <url>
    <loc>${url}/about</loc>
    <lastmod>${lastMod.about}</lastmod>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>${url}/privacy</loc>
    <lastmod>${lastMod.privacy}</lastmod>
    <priority>0.80</priority>
  </url>
</urlset>
  `;
};

export function addSitemapRoute(server: HttpServer) {
  server.get("/sitemap.xml", async (ctx) => {
    if (!process.env.SITEMAP_URL) {
      logger.error("SITEMAP_URL env var not set");
      return ctx.sendText(500, "URL not known");
    }

    const indexFile = Bun.file(path.join(PUBLIC_DIR, "index.html"));
    const aboutFile = Bun.file(path.join(PUBLIC_DIR, "about.html"));
    const privacyFile = Bun.file(path.join(PUBLIC_DIR, "privacy.html"));

    const lastMod = {
      index: fmtTs(indexFile.lastModified),
      about: fmtTs(aboutFile.lastModified),
      privacy: fmtTs(privacyFile.lastModified),
    };

    return ctx.sendXml(200, getSitemap(process.env.SITEMAP_URL, lastMod));
  });
}
