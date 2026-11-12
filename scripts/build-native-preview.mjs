import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withInstalledHost } from './installed-host.mjs';

const scratch = resolve('temp/dsh-native-preview');
await mkdir(scratch, { recursive: true });
const root = 'dsh/node_modules/@deepseek-ai/';
try {
  const host = await withInstalledHost(async host => {
    const base = root + 'dsh-web-frontend/dist/assets/', files = host.list(base);
    const entry = files.find(name => /^index-.*\.js$/.test(name)), frontend = await host.read(base + entry);
    const ast = parse(frontend, { sourceType: 'module' });
    const boot = ast.program.body.at(-1); assert.equal(boot.type, 'TryStatement');
    const modules = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.params.length === 0
      && frontend.slice(node.start, node.end).includes('"@deepseek-ai/dsh-client-ui-primitives":'));
    assert.ok(modules, 'Installed frontend must expose its static module map.');
    const runtime = frontend.slice(0, boot.start) + '\nglobalThis.__DSH_NATIVE_MODULES__=' + modules.id.name + '();';
    await writeFile(scratch + '/runtime.js', runtime);
    for (const statement of ast.program.body.filter(node => node.type === 'ImportDeclaration')) {
      const name = statement.source.value.replace(/^\.\//, ''); await writeFile(scratch + '/' + name, await host.read(base + name));
    }
    const sidebar = await host.read(root + 'dsh-client-ui-sidebar/lib/client.js');
    const instrumented = sidebar.replace('return module.exports;', 'exports.__preview = { SidebarRoot, HeaderLeadingControls, zh, en }; return module.exports;');
    assert.notEqual(instrumented, sidebar);
    const layout = await host.read(root + 'dsh-client-ui-layout/lib/client.js');
    const layoutPreview = layout.replace('return module.exports;', 'exports.__preview = { AppFrame }; return module.exports;');
    assert.notEqual(layoutPreview, layout);
    const account = await host.read(root + 'dsh-client-ui-settings-account/lib/client.js');
    const accountPreview = account.replace('return module.exports;', 'exports.__preview = { AccountMenu, zh, en }; return module.exports;');
    assert.notEqual(accountPreview, account);
    const entryMenu = await host.read(root + 'dsh-client-ui-entry-customization/lib/client.js');
    const entryMenuPreview = entryMenu.replace('return module.exports;', 'exports.__preview = { EntryMenuContent, zh, en }; return module.exports;');
    assert.notEqual(entryMenuPreview, entryMenu);
    const workspaceSource = await host.read(root + 'dsh-client-ui-workspace/lib/client.js');
    const workspacePreview = workspaceSource.replace('return module.exports;', 'exports.__preview = { WorkspacePicker, zh, en }; return module.exports;');
    const conversationSource = await host.read(root + 'dsh-client-ui-conversation/lib/client.js');
    let selectWorkspace;
    function findSelection(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'ObjectProperty' && node.key?.name === 'selectWorkspace'
        && conversationSource.slice(node.value.start, node.value.end).includes('inputHub.shell(sessionId)')) selectWorkspace = conversationSource.slice(node.value.start, node.value.end);
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(findSelection); else if (value && typeof value === 'object') findSelection(value);
    }
    findSelection(parse(conversationSource, { sourceType: 'script' }));
    assert.ok(selectWorkspace, 'Use the installed host draft/attachment transfer callback.');
    const conversationPreview = conversationSource.replace('return module.exports;', 'exports.__preview = { ConversationContent, zh, en }; return module.exports;');
    assert.notEqual(workspacePreview, workspaceSource); assert.notEqual(conversationPreview, conversationSource);
    const rendererSource = await host.read(root + 'dsh-client-ui-renderer/lib/client.js');
    const rendererPreview = rendererSource.replace('return module.exports;', 'exports.__preview = { SlotRegistry, createSlotRenderer }; return module.exports;');
    assert.notEqual(rendererPreview, rendererSource);
    const themeModule = await host.read(root + 'dsh-client-ui-theme/lib/client.js');
    const themeStyleNames = ['base_css_default', 'design_platform_css_default', 'gradient_shadow_text_css_default'];
    const themeStyles = new Map();
    function findThemeStyles(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'VariableDeclarator' && themeStyleNames.includes(node.id?.name) && node.init?.type === 'StringLiteral') themeStyles.set(node.id.name, node.init.value);
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(findThemeStyles); else if (value && typeof value === 'object') findThemeStyles(value);
    }
    findThemeStyles(parse(themeModule, { sourceType: 'script' }));
    assert.equal(themeStyles.size, themeStyleNames.length, 'Load the host foundation, palette, typography and elevation styles together.');
    const theme = themeStyleNames.map(name => themeStyles.get(name)).join('\n');
    const manifest = JSON.parse(await host.read(root + 'dsh-client-ui-workspace/package.json'));
    return { version: manifest.version, theme, themeStyleNames, themeSha256: createHash('sha256').update(theme).digest('hex'), css: await host.read(base + files.find(name => /^index-.*\.css$/.test(name))), sidebar: instrumented, layout: layoutPreview, account: accountPreview, entryMenu: entryMenuPreview,
      workspace: workspacePreview, conversation: conversationPreview, renderer: rendererPreview, selectWorkspace,
      selectWorkspaceSha256: createHash('sha256').update(selectWorkspace).digest('hex'),
      frontendSha256: createHash('sha256').update(frontend).digest('hex'), sidebarSha256: createHash('sha256').update(sidebar).digest('hex'), accountSha256: createHash('sha256').update(account).digest('hex') };
  });
  const native = await build({ entryPoints: [scratch + '/runtime.js'], bundle: true, write: false, format: 'iife', minify: true, target: 'es2022', define: { 'import.meta.url': 'location.href' },
    plugins: [{ name: 'unused-lazy-host-assets', setup(builder) { builder.onResolve({ filter: /.*/ }, args => args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined); } }] });
  const preview = await build({ entryPoints: ['scripts/native-preview.jsx'], bundle: true, write: false, format: 'iife', minify: true, target: 'es2022', loader: { '.css': 'text' },
    plugins: [{ name: 'share-real-installed-react', setup(builder) {
      builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: args.path, namespace: 'native-host' }));
      builder.onLoad({ filter: /.*/, namespace: 'native-host' }, args => ({ contents: 'module.exports=globalThis.__DSH_NATIVE_MODULES__[' + JSON.stringify(args.path) + '];', loader: 'js' }));
    } }], define: { 'process.env.NODE_ENV': '"production"' } });
  const plugin = await readFile('lib/client.js', 'utf8');
  const projectPlugin = await readFile('plugins/dsh-project-manager/client.js', 'utf8');
  const polishPlugin = await readFile('plugins/dsh-polish/client.js', 'utf8');
  // Keep the before comparison meaningful after installing the candidate.
  const previousPolish = execFileSync('tar', ['-xOf', resolve('releases/dsh-polish-0.1.12.tgz'), 'package/client.js'], { encoding: 'utf8', maxBuffer: 2e6 });
  const polishBaseline = JSON.parse(previousPolish.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);
  const bootstrap = 'window.__ModuleLoader__={load(entry){window.__nativeSidebarFactory=entry.factory;}};\n' + host.sidebar
    + '\nglobalThis.__DSH_NATIVE_SIDEBAR__=window.__nativeSidebarFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeLayoutFactory=entry.factory;}};\n' + host.layout
    + '\nglobalThis.__DSH_NATIVE_LAYOUT__=window.__nativeLayoutFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeAccountFactory=entry.factory;}};\n' + host.account
    + '\nglobalThis.__DSH_NATIVE_ACCOUNT__=window.__nativeAccountFactory(Object.assign(id=>globalThis.__DSH_NATIVE_MODULES__[id],{asset:path=>path})).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeEntryMenuFactory=entry.factory;}};\n' + host.entryMenu
    + '\nglobalThis.__DSH_NATIVE_ENTRY_MENU__=window.__nativeEntryMenuFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeWorkspaceFactory=entry.factory;}};\n' + host.workspace
    + '\nglobalThis.__DSH_NATIVE_WORKSPACE__=window.__nativeWorkspaceFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeConversationFactory=entry.factory;}};\n' + host.conversation
    + '\nglobalThis.__DSH_NATIVE_CONVERSATION__=window.__nativeConversationFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'window.__ModuleLoader__={load(entry){window.__nativeRendererFactory=entry.factory;}};\n' + host.renderer
    + '\nglobalThis.__DSH_NATIVE_RENDERER__=window.__nativeRendererFactory(id=>globalThis.__DSH_NATIVE_MODULES__[id]).__preview;\n'
    + 'globalThis.__DSH_NATIVE_SELECT_WORKSPACE__=({sessionId,workspaceNavigation,inputHub,sessions,ctx,concreteConversation})=>(' + host.selectWorkspace + ');\n'
    + 'window.__ModuleLoader__={load(entry){window.__projectManagerFactory=entry.factory;}};\n' + projectPlugin + '\n'
    + 'window.__ModuleLoader__={load(entry){window.__polishFactory=entry.factory;}};\n' + polishPlugin + '\n'
    + 'globalThis.__DSH_POLISH_BASELINE__=' + JSON.stringify(polishBaseline) + ';\n'
    + 'window.__ModuleLoader__={load(entry){window.__inboxFactory=entry.factory;}};\n' + plugin;
  const script = native.outputFiles[0].text + '\n' + bootstrap + '\n' + preview.outputFiles[0].text;
  const css = host.theme + '\n' + host.css + '\n'
    + 'html,body{margin:0;height:100%;background:var(--dsw-alias-bg-base);font-family:var(--dsw-font-family,system-ui,sans-serif)}'
    + '#preview{height:100vh;display:flex;min-height:0;width:320px;max-width:100vw;background:var(--dsw-specific-sidebar-fill)}'
    + '#preview>[data-slot=sidebar]{display:flex;flex:1;min-height:0}button{font:inherit}.native-preview-account{display:flex;align-items:center;gap:8px;height:40px;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary);padding:8px;font-size:13px;text-align:left}'
    + 'html[data-preview-frame] #preview{width:100vw;display:block}'
    + '.native-preview-avatar{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--dsw-alias-interactive-bg-hover);font-size:11px}'
    + '.native-preview-settings{position:absolute;left:320px;top:0;bottom:0;width:520px;overflow:auto;background:var(--dsw-alias-bg-base);padding:24px;box-sizing:border-box}';
  await mkdir('temp/design/inbox-sidebar', { recursive: true });
  await writeFile('temp/design/inbox-sidebar/index.html', '<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH 会话收件箱</title><style>' + css + '</style></head><body><div id="preview"></div><script>' + script.replaceAll('</script', '<\\/script') + '</script></body></html>');
  await writeFile('outputs/native-preview-host.json', JSON.stringify({ version: host.version, frontendSha256: host.frontendSha256, sidebarSha256: host.sidebarSha256, accountSha256: host.accountSha256, themeStyleNames: host.themeStyleNames, themeSha256: host.themeSha256,
    selectWorkspaceSha256: host.selectWorkspaceSha256,
    scope: 'Real installed DSH SidebarRoot, AccountMenu, ConversationContent, WorkspacePicker, native draft-transfer callback, React and UI primitives; fixture session/account/RPC data. No native process interaction.' }, null, 2) + '\n');
  console.log('temp/design/inbox-sidebar/index.html — installed DSH shell and primitives, fixture sessions');
} finally { await rm(scratch, { recursive: true, force: true }); }
