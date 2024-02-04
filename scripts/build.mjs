import { build } from "@ncpa0cpl/nodepack";
import { spawn } from "child_process";
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
          loader: {
            ".svg": "file",
          },
        },
        watch,
        parsableExtensions: [".css"],
      }),
      build({
        srcDir: p("src"),
        outDir: p("dist"),
        tsConfig: p("tsconfig.json"),
        formats: ["esm"],
        target: "es2022",
        exclude: [/\/public\//],
        preset: {
          node: true,
        },
        decoratorsMetadata: true,
        watch,
        esbuildOptions: {
          keepNames: true,
          sourcemap: dev ? "inline" : undefined,
        },
        onBuildComplete() {
          return runServer();
        },
      }),
    ]);
    await buildIndexPage({
      entrypointPath: p("dist/esm/public/index.mjs"),
      htmlTemplatePath: p("src/public/index.html"),
      outDir: p("dist/esm/public"),
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
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
          pluginData: { v: "lol" },
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
      const proc = spawn("bun", [p("dist/esm/server/start.mjs"), "--debug"], {
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
