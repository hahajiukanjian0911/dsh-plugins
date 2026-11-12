import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import vm from 'node:vm';

// 只读本机安装包。用于构建时核对，不随插件进入宿主运行。
export async function inspectHost(app = process.env.DSH_APP || '/Applications/DeepSeek Harness.app') {
  const file = await open(`${app}/Contents/Resources/app.asar`, 'r');
  try {
    const prefix = Buffer.alloc(16);
    await file.read(prefix, 0, prefix.length, 0);
    const header = Buffer.alloc(prefix.readUInt32LE(12));
    await file.read(header, 0, header.length, 16);
    const tree = JSON.parse(header.toString()).files;
    const base = 8 + prefix.readUInt32LE(4);
    async function read(path) {
      let node = { files: tree };
      for (const part of path.split('/')) node = node?.files?.[part];
      if (!node || node.offset === undefined) throw new Error(`宿主文件不可读：${path}`);
      const bytes = Buffer.alloc(node.size);
      await file.read(bytes, 0, bytes.length, base + Number(node.offset));
      return bytes.toString();
    }
    const root = 'dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/';
    const assets = tree.dsh.files.node_modules.files['@deepseek-ai'].files['dsh-web-frontend']
      .files.dist.files.assets.files;
    const asset = Object.keys(assets).find(name => /^index-.*\.js$/.test(name));
    const source = await read(root + asset);
    const start = source.indexOf('Qv={');
    const end = source.indexOf(',Vp=', start);
    if (start < 0 || end < 0 || !source.includes('`dsw-icon-${e}-${t}`')) {
      throw new Error('宿主图标结构已变化，请重新核对提取器与 data-icon 约定。');
    }
    const catalog = vm.runInNewContext(`(${source.slice(start + 3, end)})`, {}, { timeout: 1000 });
    const manifest = JSON.parse(await read('dsh/package.json'));
    return {
      app,
      version: manifest.version,
      asset,
      frontendSha256: createHash('sha256').update(source).digest('hex'),
      icons: Object.entries(catalog).map(([key, value]) => ({
        key, size: value.size, aspect: value.aspect ?? [1, 1],
        regular: value.svg(1), medium: value.svg(1.3),
      })),
    };
  } finally { await file.close(); }
}
