import fs from "fs";
import globalizeJSDOM from "jsdom-global";

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
  }

  // window.history.pushState = function() {};

  globalThis.URL = window.URL;
}

/**
 * @param {string} entrypointPath filepath of the JavaScript application
 * @param {string} htmlTemplatePath filepath of the HTML template
 * @param {{
 *  stylesheetFilename: string;
 *  scriptFilename: string;
 * }} data
 * @returns
 */
export async function generateIndexPage(
  entrypointPath,
  htmlTemplatePath,
  data,
) {
  globalizeJSDOM(null, {
    url: "http://localhost",
  });
  addMissingGlobals();
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  await import(`file://${entrypointPath}`);
  while (true) {
    const currentPath = approuter.current().path;
    if (currentPath === "register") {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const template = await fs.promises.readFile(htmlTemplatePath, "utf8");

  const html = root.innerHTML;
  return template
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
 * }} params
 */
export async function buildIndexPage(params) {
  const indexPage = await generateIndexPage(
    params.entrypointPath,
    params.htmlTemplatePath,
    {
      scriptFilename: params.scriptFilename,
      stylesheetFilename: params.stylesheetFilename,
    },
  );
  await fs
    .promises.writeFile(`${params.outDir}/index.html`, indexPage);
}
