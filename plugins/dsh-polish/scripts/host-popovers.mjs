import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

// 所有读取均针对已安装 App；返回构建预览和核对选择器所需的源码证据。
export async function inspectPopovers(app = process.env.DSH_APP || '/Applications/DeepSeek Harness.app') {
  const file = await open(`${app}/Contents/Resources/app.asar`, 'r');
  try {
    const prefix = Buffer.alloc(16);
    await file.read(prefix, 0, 16, 0);
    const header = Buffer.alloc(prefix.readUInt32LE(12));
    await file.read(header, 0, header.length, 16);
    const tree = JSON.parse(header.toString()).files;
    const base = 8 + prefix.readUInt32LE(4);
    async function read(path) {
      let node = { files: tree };
      for (const part of path.split('/')) node = node?.files?.[part];
      assert.ok(node?.offset !== undefined, `宿主文件不存在：${path}`);
      const bytes = Buffer.alloc(node.size);
      await file.read(bytes, 0, bytes.length, base + Number(node.offset));
      return bytes.toString();
    }
    const root = 'dsh/node_modules/@deepseek-ai/';
    const assets = tree.dsh.files.node_modules.files['@deepseek-ai'].files['dsh-web-frontend'].files.dist.files.assets.files;
    const js = await read(root + 'dsh-web-frontend/dist/assets/' + Object.keys(assets).find(name => /^index-.*\.js$/.test(name)));
    const css = await read(root + 'dsh-web-frontend/dist/assets/' + Object.keys(assets).find(name => /^index-.*\.css$/.test(name)));
    const chat = await read(root + 'dsh-client-ui-chat/lib/client.js');
    const model = await read(root + 'dsh-client-ui-model-selection/lib/client.js');
    const aliases = Object.fromEntries([...js.matchAll(/(?:const |,)([\w$]+)="([^"\n]+)"/g)]
      .filter(match => match[2].startsWith('_')).map(match => [match[1], match[2]]));
    function classMap(name) {
      const body = js.match(new RegExp(`${name}=\\{([^}]+)\\}`))?.[1];
      assert.ok(body, `宿主类名表变化：${name}`);
      return Object.fromEntries(body.split(',').map(entry => {
        const [key, reference] = entry.split(':');
        assert.ok(aliases[reference], `找不到宿主类名：${entry}`);
        return [key, aliases[reference]];
      }));
    }
    const material = classMap('Ds');
    const menu = classMap('Ne');
    function moduleStyles(source, variable) {
      const map = source.match(new RegExp(`var ${variable} = (\\{[\\s\\S]*?\\n\\t\\t\\});`))?.[1];
      assert.ok(map, `宿主 CSS 模块变化：${variable}`);
      const classes = JSON.parse(map);
      const owner = Object.values(classes)[0].split('_')[0];
      const literal = [...source.matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)]
        .find(match => match[1].includes(`.${owner}_`));
      assert.ok(literal, `找不到宿主样式：${variable}`);
      return { classes, css: JSON.parse(literal[1]) };
    }
    const stats = moduleStyles(chat, 'stat_dialog_module_css_default');
    const models = moduleStyles(model, 'ModelSelect_module_css_default');
    const materialStart = css.indexOf(`.${material.surface}`);
    const menuStart = css.indexOf(`.${menu.root}`);
    const materialEnd = css.indexOf('._bubble_', materialStart);
    const menuEnd = css.indexOf(':where(._panel_', menuStart);
    assert.ok(materialStart >= 0 && materialEnd > materialStart && menuStart >= 0 && menuEnd > menuStart);
    for (const marker of ['data-turn-usage-details', 'data-session-stats-details', 'data-session-stats-usage']) assert.ok(chat.includes(marker));
    assert.ok(js.includes('"data-menu-material":"translucent"') && js.includes('"data-menu-backing":""'));
    const manifest = JSON.parse(await read('dsh/package.json'));
    return {
      version: manifest.version,
      hashes: Object.fromEntries(Object.entries({ frontend: js, chat, model }).map(([key, value]) => [key, createHash('sha256').update(value).digest('hex')])),
      material, menu, stats: stats.classes, models: models.classes,
      css: css.slice(materialStart, materialEnd) + css.slice(menuStart, menuEnd) + stats.css + models.css,
    };
  } finally { await file.close(); }
}
