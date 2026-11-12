import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('outputs', { recursive: true });
const nativeSource=await readFile('src/native/Sidebar.jsx','utf8');
const nativeIconExports=[...new Set([...nativeSource.matchAll(/'(Icon\w+Regular)'/g)].map(m=>m[1]))];
const result = await build({
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  bundle: true,
  inject: ['src/react-inject.js'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  loader: { '.css': 'text' },
  legalComments: 'eof',
  minify: false,
  metafile: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-inbox-sidebar", factory(require) { const module = { exports: {} }; const exports = module.exports;' },
  footer: { js: 'return module.exports.createPlugin(require); } });' },
});
const bundledReact = Object.keys(result.metafile.inputs).filter(name => /node_modules\/(react|react-dom)\//.test(name));
assert.deepEqual(bundledReact, [], 'React and ReactDOM must come from the host, not a second bundled copy.');
const fixturesBundled=Object.keys(result.metafile.inputs).filter(name=>/^(tests|scripts)\//.test(name));
assert.deepEqual(fixturesBundled, [], 'The installed plugin must use native DSH controls, not preview fixtures.');
const imports = result.metafile.outputs['lib/client.js'].imports.filter(item => item.external).map(item => item.path);
const externalImports=[...new Set(imports)];
assert.ok(imports.includes('react'));
const bundledLegacy=Object.keys(result.metafile.inputs).filter(name=>/^src\/(?:t3|vendor)\//.test(name));
assert.deepEqual(bundledLegacy, [], 'The rebuilt sidebar must use DSH controls without bundled T3 components or styles.');
await import('./write-notices.mjs').then(m=>m.writeNotices(result.metafile));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('outputs', { recursive: true });
await writeFile('outputs/build-contract.json', JSON.stringify({ version, bundledReact,
  externalImports, fixturesBundled, bundledLegacy, hostUiPrimitives: ['AnimatedRows','Button','HoverCard','HoverCardGroup','Input','Menu','Modal','StateDot','Switch','Tooltip','useRowDragPreview',...nativeIconExports], sharedHostReact: true }, null, 2) + '\n');
