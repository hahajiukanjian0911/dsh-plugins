import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
execFileSync(process.execPath, ['scripts/build-native-preview.mjs'], { cwd: workspace, stdio: 'inherit' });
const output = resolve(workspace, 'temp/design/polish-glass');
await mkdir(output, { recursive: true });
const html = (await readFile(resolve(workspace, 'temp/design/inbox-sidebar/index.html'), 'utf8'))
  .replace('<title>DSH 会话收件箱</title>', '<title>DSH 磨砂浮层</title>')
  .replace('<script>', '<script>history.replaceState(null,"",location.pathname+"?glass");');
await writeFile(resolve(output, 'index.html'), html);
console.log(resolve(output, 'index.html'));
