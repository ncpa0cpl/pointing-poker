import { build } from "@ncpa0cpl/nodepack";
import { spawn } from "child_process";
import crc32 from "crc-32";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, URL } from "url";
import { buildIndexPage } from "./generate-index.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const p = (arg) => path.resolve(__dirname, "..", arg);

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const dev = process.argv.includes("--dev");

async function main() {
  try {
    await fs.mkdir(p("dist/esm/public"), { recursive: true });

    await Promise.all([
      build({
        bundle: true,
        entrypoint: p("src/public/index.tsx"),
        srcDir: p("src"),
        outDir: p("dist"),
        tsConfig: p("tsconfig.json"),
        formats: ["esm"],
        target: "es2022",
        exclude: [/\/server\//],
        esbuildOptions: {
          platform: "browser",
          jsxImportSource: "@ncpa0cpl/vanilla-jsx",
          jsx: "transform",
          keepNames: true,
          plugins: [AxiosImportReplacerPlugin()],
          sourcemap: dev ? "inline" : undefined,
          minify: !dev,
          loader: {
            ".svg": "file",
          },
          publicPath: "/public",
        },
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
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function postBuild() {
  try {
    const stylesheet = await hashFileName(
      p("dist/esm/public/index.css"),
    );
    const script = await hashFileName(p("dist/esm/public/index.mjs"));

    await buildIndexPage({
      entrypointPath: script,
      htmlTemplatePath: p("src/public/index.html"),
      outDir: p("dist/esm/public"),
      scriptFilename: path.basename(script),
      stylesheetFilename: path.basename(stylesheet),
    });
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

function AxiosImportReplacerPlugin() {
  return {
    name: "axios-import-replacer",
    setup(build) {
      build.onResolve({ filter: /axios/ }, async args => {
        if (args.pluginData) {
          return;
        }

        const r = await build.resolve("axios", {
          kind: "import-statement",
          resolveDir: args.resolveDir,
          importer: args.importer,
          pluginData: {},
        });

        return {
          path: path.join(
            path.dirname(r.path),
            "dist/browser/axios.cjs",
          ),
        };
      });
    },
  };
}

function runServer() {
  if (serve) {
    try {
      console.log("Starting server...");
      const proc = spawn("bun", [p("src/server/start.ts"), "--debug"], {
        stdio: "inherit",
      });

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
