import path from "path";
import fs from "fs";
import dedent from "dedent";

export function svgPlugin() {
  return {
    name: "svg-loader-plugin",
    /** @param {import("esbuild").PluginBuild} build */
    setup(build) {
      build.onLoad({ filter: /\.svg$/ }, async (args) => {
        const contents = await fs.promises.readFile(args.path, "utf8");

        const componentName = path
          .basename(args.path, ".svg")
          .replace(/^\w/, (char) => char.toUpperCase()) // capitalize first letter
          .replace(/-\w/, (char) => char[1].toUpperCase()); // to camel case

        const code = /* js */ `
          import { bindProps } from "@ncpa0cpl/vanilla-jsx";
          import { jsx } from "jsxte/jsx-runtime";

          const svgXml = ${JSON.stringify(contents)};
          const svgDoc = new DOMParser().parseFromString(svgXml, "image/svg+xml");
          const svg = svgDoc.firstChild;

          export default function Svg(props) {
            const elem = svg.cloneNode(true);
            bindProps(elem, props);
            return elem;
          }

          Svg.displayName = ${JSON.stringify(componentName)};
          `;

        return { contents: dedent(code.trimStart()), loader: "js" };
      });
    },
  };
}
