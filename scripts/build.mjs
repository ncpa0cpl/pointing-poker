import { build } from "@ncpa0cpl/nodepack";
import SentryCli from "@sentry/cli";
import { execSync, spawn } from "child_process";
import dedent from "dedent";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, URL } from "url";
import { buildStaticPages } from "./generate-index.mjs";
import { svgPlugin } from "./svg-loader.mjs";
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
    await fs.mkdir(p("dist/public"), { recursive: true });

    const result = await build({
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
            const SENTRY_DSN = ${
              process.env.SENTRY_DSN
                ? JSON.stringify(process.env.SENTRY_DSN)
                : "undefined"
            };
            `.trim(),
        },
      },
      esbuildOptions: {
        platform: "browser",
        jsxImportSource: "@ncpa0cpl/vanilla-jsx",
        jsx: "transform",
        keepNames: true,
        sourcemap: dev ? "linked" : "external",
        minify: !dev,
        treeShaking: true,
        loader: {
          ".webp": "file",
        },
        publicPath: "/public",
        plugins: [svgPlugin()],
      },
      compileVendors: ["@sentry/browser"],
      watch,
      parsableExtensions: [".css"],
      bundleOutfile: "[name].[hash][ext]",
      pathAliases: {
        "@Root/*": "./*",
      },
      replaceImports: {
        "@ncpa0cpl/vanilla-jsx/signals":
          "@Root/../../node_modules/@ncpa0cpl/vanilla-jsx/dist/esm/signals/signal",
      },
      onBuildComplete(result) {
        postBuild(result);
        return runServer();
      },
    });

    if (!watch) {
      await postBuild(result);
      await uploadSourcemapsToSentry(result);
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

/**
 * @param {undefined | { outputs: string[] }} result
 */
async function postBuild(result) {
  const script = result.outputs.find((f) => f.endsWith(".mjs"));
  const scriptSourcemap = result.outputs.find((f) => f.endsWith(".mjs.map"));
  const stylesheet = result.outputs.find((f) => f.endsWith(".css"));
  const stylesheetSourcemap = result.outputs.find((f) =>
    f.endsWith(".css.map")
  );

  try {
    console.log("Building index page...");

    if (!script) {
      throw new Error(
        "couldn't find the JavaScript bundle in the output files",
      );
    }

    if (!stylesheet) {
      throw new Error("couldn't find the CSS bundle in the output files");
    }

    await buildStaticPages({
      entrypointPath: script,
      htmlTemplatePath: p("src/public/index.html"),
      outDir: p("dist/public"),
      scriptFilename: path.basename(script),
      stylesheetFilename: path.basename(stylesheet),
      pages: [
        {
          name: "index.html",
          path: "/register",
        },
        {
          name: "about.html",
          path: "/about",
        },
        {
          name: "privacy.html",
          path: "/privacy",
        },
        {
          name: "roomclosed.html",
          path: "/roomclosed",
        },
        {
          name: "notfound.html",
          path: "/notfound",
        },
        {
          name: "user.html",
          path: "/user",
        },
      ],
    });
    console.log("Index page built.");
  } catch (error) {
    console.error(error);
  }
}

/**
 * @param {undefined | { outputs: string[] }} result
 */
async function uploadSourcemapsToSentry(result) {
  if (dev || watch) return;

  if (!process.env.SENTRY_DSN) {
    console.log("Sentry not configured, skipping sourcemap upload.");
    return;
  }

  const requiredEnv = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
  const missingEnv = requiredEnv.filter((name) => !process.env[name]);
  if (missingEnv.length > 0) {
    console.warn(
      `Skipping sourcemap upload to Sentry, missing env vars: ${
        missingEnv.join(", ")
      }`,
    );
    return;
  }

  const sourcemap = result?.outputs.find((f) => f.endsWith(".mjs.map"));
  if (!sourcemap) {
    console.warn(
      "No sourcemaps found in the build output, skipping Sentry upload.",
    );
    return;
  }

  // Must match the release the browser SDK reports (RLS_VERSION banner).
  const release = `${packageJson.version}#${gitHash}`;
  const sourcemapDir = path.dirname(sourcemap);

  try {
    console.log(`Uploading sourcemaps to Sentry (release ${release})...`);

    const cli = new SentryCli();

    await cli.releases.new(release);
    await cli.releases.uploadSourcemaps(sourcemapDir, {
      ext: ["js", "mjs", "css", "map"],
      // Bundles are served from /public/esm; artifacts must match that URL.
      urlPrefix: "/public/esm",
      // Resolves the bundle-internal source paths to the original files.
      rewrite: true,
    });
    await cli.releases.finalize(release);

    console.log("Sourcemaps uploaded to Sentry.");
  } catch (error) {
    // A failed upload must not fail the build.
    console.error("Failed to upload sourcemaps to Sentry:");
    console.error(error);
  }
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
