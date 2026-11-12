import assert from "node:assert/strict";
import { build } from "esbuild";
import { parse } from "@babel/parser";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withInstalledHost } from "../../../scripts/installed-host.mjs";
const project = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  workspace = resolve(project, "../..");
const scratch = resolve(workspace, "temp/project-manager-preview"),
  destination = resolve(workspace, "temp/design/project-manager");
await mkdir(scratch, { recursive: true });
try {
  const host = await withInstalledHost(async (host) => {
    const root = "dsh/node_modules/@deepseek-ai/",
      base = root + "dsh-web-frontend/dist/assets/",
      files = host.list(base);
    const frontend = await host.read(
        base + files.find((n) => /^index-.*\.js$/.test(n)),
      ),
      ast = parse(frontend, { sourceType: "module" }),
      boot = ast.program.body.at(-1);
    assert.equal(boot.type, "TryStatement");
    const modules = ast.program.body.find(
      (n) =>
        n.type === "FunctionDeclaration" &&
        n.params.length === 0 &&
        frontend
          .slice(n.start, n.end)
          .includes('"@deepseek-ai/dsh-client-ui-primitives":'),
    );
    assert.ok(modules);
    await writeFile(
      scratch + "/runtime.js",
      frontend.slice(0, boot.start) +
        "\nglobalThis.__DSH_NATIVE_MODULES__=" +
        modules.id.name +
        "();",
    );
    for (const statement of ast.program.body.filter(
      (n) => n.type === "ImportDeclaration",
    )) {
      const name = statement.source.value.replace(/^\.\//, "");
      await writeFile(scratch + "/" + name, await host.read(base + name));
    }
    const source = await host.read(root + "dsh-client-ui-theme/lib/client.js"),
      styles = new Map(),
      names = [
        "base_css_default",
        "design_platform_css_default",
        "gradient_shadow_text_css_default",
      ];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (
        node.type === "VariableDeclarator" &&
        names.includes(node.id?.name) &&
        node.init?.type === "StringLiteral"
      )
        styles.set(node.id.name, node.init.value);
      for (const value of Object.values(node))
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") visit(value);
    };
    visit(parse(source, { sourceType: "script" }));
    assert.equal(styles.size, 3);
    const settings = await host.read(
      root + "dsh-client-ui-settings-general/lib/client.js",
    );
    const settingsPreview = settings.replace(
      "return module.exports;",
      "exports.__preview={SettingsPanel};return module.exports;",
    );
    assert.notEqual(settingsPreview, settings);
    return {
      settingsPreview,
      css:
        names.map((n) => styles.get(n)).join("\n") +
        "\n" +
        (await host.read(base + files.find((n) => /^index-.*\.css$/.test(n)))),
      frontendSha256: createHash("sha256").update(frontend).digest("hex"),
      themeStyleNames: names,
    };
  });
  const runtime = await build({
    entryPoints: [scratch + "/runtime.js"],
    bundle: true,
    write: false,
    format: "iife",
    minify: true,
    target: "es2022",
    define: { "import.meta.url": "location.href" },
    plugins: [
      {
        name: "native-unused-imports",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            args.kind === "dynamic-import"
              ? { path: args.path, external: true }
              : undefined,
          );
        },
      },
    ],
  });
  const preview = await build({
    entryPoints: [project + "/scripts/preview.jsx"],
    bundle: true,
    write: false,
    format: "iife",
    minify: true,
    target: "es2022",
    plugins: [
      {
        name: "native-react",
        setup(b) {
          b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
            path: args.path,
            namespace: "native-host",
          }));
          b.onLoad({ filter: /.*/, namespace: "native-host" }, (args) => ({
            contents:
              "module.exports=globalThis.__DSH_NATIVE_MODULES__[" +
              JSON.stringify(args.path) +
              "];",
            loader: "js",
          }));
        },
      },
    ],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const client = await readFile(project + "/client.js", "utf8"),
    script =
      runtime.outputFiles[0].text +
      "\nwindow.__ModuleLoader__={load(entry){window.__settingsFactory=entry.factory;}};\n" +
      host.settingsPreview +
      "\nglobalThis.__DSH_NATIVE_SETTINGS__=window.__settingsFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\nwindow.__ModuleLoader__={load(entry){window.__projectManagerFactory=entry.factory;}};\n" +
      client +
      "\n" +
      preview.outputFiles[0].text;
  await mkdir(destination, { recursive: true });
  await mkdir(project + "/outputs", { recursive: true });
  await writeFile(
    destination + "/index.html",
    '<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH 项目管理</title><style>' +
      host.css +
      '</style></head><body><div id="preview"></div><script>' +
      script.replaceAll("</script", "<\\/script") +
      "</script></body></html>",
  );
  await writeFile(
    project + "/outputs/native-preview-host.json",
    JSON.stringify(
      {
        ...host,
        css: undefined,
        settingsPreview: undefined,
        scope:
          "Installed DSH React, UI primitives, icons and themes; shipped plugin client; fixture RPC and section navigation, real native SettingsPanel. No native app interaction.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(destination + "/index.html");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
