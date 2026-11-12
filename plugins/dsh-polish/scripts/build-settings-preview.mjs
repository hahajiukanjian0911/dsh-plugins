import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { withInstalledHost } from '../../../scripts/installed-host.mjs';
import { inspectTypography } from './host-typography.mjs';

const repo = new URL('../../../', import.meta.url);
export const settingsPreview = new URL('temp/design/polish-settings/index.html', repo);
const exposures = {
  'dsh-client-ui-settings-general': 'SettingsPanel, GeneralSection, DeveloperToolsRow, CurrentVersionRow, zh, en',
  'dsh-client-ui-settings-account': 'AccountSection, zh, en',
  'dsh-client-ui-theme': 'AppearanceRow, FontSettingsGroup, zh, en',
  'dsh-client-locale': 'LanguageRow, zh, en',
  'dsh-client-ui-settings-models': 'ModelsSection, zh, en',
  'dsh-client-ui-settings-plugins': 'PluginsSettingsSection, zh, en',
};

// All settings components and their copy are read from the installed host.
// Only stores, slot composition and service results are fixtures.
export async function buildSettingsPreview({ entry = new URL('settings-preview.jsx', import.meta.url), destination = settingsPreview, baselineVersion = '0.1.9' } = {}) {
  const scratch = await mkdtemp(fileURLToPath(new URL('temp/settings-preview-build-', repo)));
  try {
    const host = await inspectTypography();
    const sources = await withInstalledHost(async host => {
      const base = 'dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/';
      const frontend = await host.read(base + host.list(base).find(name => /^index-.*\.js$/.test(name)));
      const ast = parse(frontend, { sourceType: 'module' });
      const boot = ast.program.body.at(-1);
      assert.equal(boot.type, 'TryStatement');
      const map = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.params.length === 0
        && frontend.slice(node.start, node.end).includes('"@deepseek-ai/dsh-client-ui-primitives":'));
      assert.ok(map, 'Installed module map is required.');
      await writeFile(scratch + '/runtime.js', frontend.slice(0, boot.start) + '\nglobalThis.__DSH_NATIVE_MODULES__=' + map.id.name + '();');
      for (const node of ast.program.body.filter(node => node.type === 'ImportDeclaration')) {
        const name = node.source.value.replace(/^\.\//, '');
        await writeFile(scratch + '/' + name, await host.read(base + name));
      }
      return Object.fromEntries(await Promise.all(Object.keys(exposures).map(async name => [name,
        await host.read('dsh/node_modules/@deepseek-ai/' + name + '/lib/client.js')])));
    });
    const runtime = await build({ entryPoints: [scratch + '/runtime.js'], bundle: true, write: false, format: 'iife', minify: true,
      target: 'es2022', define: { 'import.meta.url': 'location.href' }, plugins: [{ name: 'unused-lazy-assets', setup(b) {
        b.onResolve({ filter: /.*/ }, args => args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined);
      } }] });
    const fixture = await build({ entryPoints: [fileURLToPath(entry)], bundle: true,
      write: false, format: 'iife', minify: true, target: 'es2022', loader: { '.css': 'text' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'native-react', setup(b) {
        b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: args.path, namespace: 'host' }));
        b.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: 'module.exports=globalThis.__DSH_NATIVE_MODULES__[' + JSON.stringify(args.path) + '];' }));
      } }] });
    let bootstrap = 'globalThis.__settingsHost={};';
    for (const [name, source] of Object.entries(sources)) {
      const instrumented = source.replace('return module.exports;', 'exports.__preview={' + exposures[name] + '};return module.exports;');
      assert.notEqual(instrumented, source);
      bootstrap += '\nwindow.__ModuleLoader__={load(e){window.__settingsFactory=e.factory;}};\n' + instrumented
        + '\nglobalThis.__settingsHost[' + JSON.stringify(name) + ']=window.__settingsFactory(Object.assign(id=>globalThis.__DSH_NATIVE_MODULES__[id],{asset:path=>path})).__preview;';
    }
    const client = await readFile(new URL('../client.js', import.meta.url), 'utf8');
    // Pin the released baseline so the comparison still works after installation.
    const installed = execFileSync('tar', ['-xOf', fileURLToPath(new URL('releases/dsh-polish-' + baselineVersion + '.tgz', repo)), 'package/client.js'], { encoding: 'utf8', maxBuffer: 2e6 });
    bootstrap += '\nwindow.__polishEffects=[];window.__ModuleLoader__={load(e){window.__polishFactory=e.factory;}};\n' + installed
      + '\nwindow.__beforePolish=window.__polishFactory;\n' + client + '\nwindow.__afterPolish=window.__polishFactory;';
    const script = runtime.outputFiles[0].text + '\n' + bootstrap + '\n' + fixture.outputFiles[0].text;
    await mkdir(new URL('./', destination), { recursive: true });
    await writeFile(destination, '<!doctype html><html lang="zh-CN" data-platform="darwin"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH</title><style>'
      + host.css + '\nhtml,body{margin:0;height:100%;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}#settings-preview{height:100%}</style></head><body><div id="settings-preview"></div><script>'
      + script.replaceAll('</script', '<\\/script') + '</script></body></html>');
    return { host: { version: host.version, hashes: host.hashes }, modules: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')])),
      clientSha256: createHash('sha256').update(client).digest('hex'), beforeSha256: createHash('sha256').update(installed).digest('hex') };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildSettingsPreview(), null, 2));
