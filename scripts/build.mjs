import { build } from "@ncpa0cpl/nodepack";
import { execSync, spawn } from "child_process";
import crc32 from "crc-32";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, URL } from "url";
import { buildIndexPage } from "./generate-index.mjs";
import dedent from "dedent";
const js = dedent;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const p = (arg) => path.resolve(__dirname, "..", arg);

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const dev = process.argv.includes("--dev");

const packageJson = JSON.parse(
  fsSync.readFileSync(p("package.json"), { encoding: "utf-8" }),
);

const gitHash = new TextDecoder().decode(execSync("git rev-parse HEAD")).trim();

async function main() {
  try {
    await fs.mkdir(p("dist/public/esm"), { recursive: true });

    await Promise.all([
      build({
        bundle: true,
        entrypoint: p("src/public/index.tsx"),
        srcDir: p("src/public"),
        outDir: p("dist/public"),
        tsConfig: p("tsconfig.json"),
        formats: ["esm"],
        target: "ES2022",
        exclude: [/\/server\//],
        banner: {
          index: {
            text: js`
              const ENVIRONMENT = "${dev ? "development" : "production"}";
              const RLS_VERSION = "${packageJson.version}#${gitHash}";
              `.trim(),
          },
        },
        esbuildOptions: {
          platform: "browser",
          jsxImportSource: "@ncpa0cpl/vanilla-jsx",
          jsx: "transform",
          keepNames: true,
          sourcemap: dev ? "inline" : "external",
          minify: !dev,
          treeShaking: true,
          loader: {
            ".svg": "file",
          },
          publicPath: "/public/esm",
        },
        compileVendors: ["@sentry/browser"],
        watch,
        parsableExtensions: [".css"],
        onBuildComplete() {
          postBuild();
          return runServer();
        },
      }),
    ]);

    if (!watch) {
      await postBuild();
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function postBuild() {
  try {
    const stylesheet = await hashFileName(p("dist/public/esm/index.css"));
    const script = await hashFileName(p("dist/public/esm/index.mjs"));
    if (!dev) {
      await fs.rename(p("dist/public/esm/index.css.map"), `${stylesheet}.map`);
      await fs.rename(p("dist/public/esm/index.mjs.map"), `${script}.map`);
    }

    console.log("Building index page...");
    await buildIndexPage({
      entrypointPath: script,
      htmlTemplatePath: p("src/public/index.html"),
      outDir: p("dist/public"),
      scriptFilename: path.basename(script),
      stylesheetFilename: path.basename(stylesheet),
    });
    console.log("Index page built.");
  } catch (error) {
    console.error(error);
  }
}

/**
 * @param {string} file
 */
async function hashFileName(file) {
  const fileContent = await fs.readFile(file);
  const hash = crc32.buf(fileContent).toString(16);

  const basename = path.basename(file, path.extname(file));
  const hashedName = `${basename}_${hash}${path.extname(file)}`;
  const newFilePath = path.join(path.dirname(file), hashedName);
  if (fsSync.existsSync(newFilePath)) {
    await fs.unlink(newFilePath);
  }
  await fs.rename(file, newFilePath);

  return newFilePath;
}

function runServer() {
  if (serve) {
    try {
      console.log("Starting server...");
      const proc = spawn(
        "bun",
        ["--hot", p("src/server/start.ts"), "--debug"],
        {
          stdio: "inherit",
        },
      );

      const cleanup = () => {
        try {
          console.log("Stopping the server...");
          proc.kill("SIGKILL");
        } catch {}
      };

      process.on("exit", cleanup);

      return () => {
        process.off("exit", cleanup);
        cleanup();
      };
    } catch (error) {
      console.error(error);
    }
  }
}

main();
