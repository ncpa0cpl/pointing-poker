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

  // window.history.pushState = function() {};

  globalThis.URL = window.URL;
}

export async function generateIndexPage(entrypointPath, htmlTemplatePath) {
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
  return template.replace("%CONTENT%", html);
}

/**
 * @param {{
 *  entrypointPath: string;
 *  htmlTemplatePath: string;
 *  outDir: string;
 * }} params
 */
export async function buildIndexPage(params) {
  const indexPage = await generateIndexPage(
    params.entrypointPath,
    params.htmlTemplatePath,
  );
  await fs
    .promises.writeFile(`${params.outDir}/index.html`, indexPage);
}
