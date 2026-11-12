import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
await build({
  entryPoints: ["src/host.mjs"],
  outfile: "index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
});
await build({
  entryPoints: ["src/client.mjs"],
  outfile: "client.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  loader: { ".css": "text" },
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "transform",
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-project-manager",factory(require){const module={exports:{}};const exports=module.exports;',
  },
  footer: { js: "return module.exports.createPlugin(require);}});" },
});
console.log("Built DSH project manager host and client.");
