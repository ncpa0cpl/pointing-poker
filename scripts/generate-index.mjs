import fs from "fs";
import globalizeJSDOM from "jsdom-global";
import {
  isMainThread,
  Worker,
  parentPort,
  workerData,
} from "node:worker_threads";

let root;

const __filename = new URL(import.meta.url).pathname;

function addMissingGlobals() {
  globalThis.customElements = class {
    static define() {}
  };

  globalThis.localStorage = class {
    static setItem() {}
    static getItem() {}
  };

  globalThis.WebSocket = class {
    send() {}
  };

  globalThis.DOMParser = class {
    parseFromString() {}
  };

  // window.history.pushState = function() {};

  globalThis.URL = window.URL;
}

/**
 * @param {string} htmlTemplatePath filepath of the HTML template
 * @param {{
 *  stylesheetFilename: string;
 *  scriptFilename: string;
 * }} data
 * @returns
 */
export async function generatePage(htmlTemplatePath, data, path = "/") {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  await AppRouter.navigate(path);

  const template = await fs.promises.readFile(htmlTemplatePath, "utf8");

  const html = root.innerHTML;
  const titleElem = document.querySelector("title");
  return template
    .replace("%TITLE%", AppRouter.titleElem.innerText)
    .replace("%CONTENT%", html)
    .replace("%SCRIPT%", data.scriptFilename)
    .replace("%STYLESHEET%", data.stylesheetFilename);
}

/**
 * @param {{
 *  entrypointPath: string;
 *  htmlTemplatePath: string;
 *  outDir: string;
 *  stylesheetFilename: string;
 *  scriptFilename: string;
 *  pages: {path: string; name: string}[];
 * }} params
 */
export async function buildStaticPages(params) {
  if (isMainThread) {
    const worker = new Worker(__filename, {
      workerData: params,
    });
    return new Promise((resolve, reject) => {
      worker.on("message", (v) => {
        if (v == "done") {
          resolve();
        }
      });
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
      worker.postMessage("start");
    });
  } else {
    await import(`file://${params.entrypointPath}`);
    for (const page of params.pages) {
      const indexPage = await generatePage(
        params.htmlTemplatePath,
        {
          scriptFilename: params.scriptFilename,
          stylesheetFilename: params.stylesheetFilename,
        },
        page.path,
      );
      const fname = page.name.includes(".") ? page.name : `${page.name}.html`;
      await fs.promises.writeFile(`${params.outDir}/${fname}`, indexPage);
    }
    parentPort.postMessage("done");
  }
}

if (!isMainThread) {
  globalizeJSDOM(null, {
    url: "http://localhost/",
  });
  addMissingGlobals();
  root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  parentPort.on("message", (v) => {
    if (v == "start") {
      buildStaticPages(workerData);
    }
  });
}
