import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { buildStyles, iconSvg, manifest, root } from '../scripts/build.mjs';

test('原生与侧栏映射均能生成内嵌图标，矩形尺寸保留', async () => {
  const css = await buildStyles();
  for (const key of Object.keys(manifest.native)) {
    for (const weight of ['regular', 'medium']) assert.ok(css.includes(`dsw-icon-${key}-${weight}`));
  }
  assert.equal(Object.keys(manifest.native).length, 95);
  assert.deepEqual(Object.keys(manifest.preserved).sort(), ['paper-plane-outline', 'plugin-pinwheel-outline', 'send-outline']);
  for (const key of Object.keys(manifest.preserved)) {
    assert.doesNotMatch(css, new RegExp(`dsw-icon-${key}-`), `${key} 应保留原版的所有字重`);
  }
  assert.equal(Object.keys(manifest.sidebar).length, 14);
  const panel = await iconSvg('panel-left');
  assert.match(panel, /<rect[^>]*width="18"[^>]*height="18"/);
  assert.doesNotMatch(css, /https?:\/\//);
  assert.doesNotMatch(css, /(?:^|[;{])(?:width|height|padding|margin|position|transform|animation):/);
});

test('选中与未选中保持不同形状，实心完成和关闭保留镂空', async () => {
  assert.notEqual(await iconSvg('pin'), await iconSvg('pin', 1.8, 'fill'));
  assert.notEqual(await iconSvg('thumbs-up'), await iconSvg('thumbs-up', 1.8, 'fill'));
  for (const name of ['circle-check', 'circle-x']) {
    const svg = await iconSvg(name, 1.8, 'cutout');
    assert.match(svg, /<mask /);
    assert.match(svg, /mask="url\(#cutout\)"/);
  }
});

test('包内入口注册图标样式与提示，停用清理且不接触业务服务', async () => {
  let registration;
  const styles = [];
  const cleanups = [];
  const listeners = new Set();
  const document = {
    addEventListener(type, callback) { listeners.add(callback); },
    removeEventListener(type, callback) { listeners.delete(callback); },
    createElement(tag) {
      assert.equal(tag, 'style');
      return { dataset: {}, remove() { styles.splice(styles.indexOf(this), 1); } };
    },
    head: { appendChild(style) { styles.push(style); } },
  };
  const window = { __ModuleLoader__: { load(value) { registration = value; } },
    clearTimeout, setTimeout, addEventListener(type, callback) { listeners.add(callback); },
    removeEventListener(type, callback) { listeners.delete(callback); } };
  vm.runInNewContext(await readFile(new URL('client.js', root), 'utf8'), { window, document });
  assert.equal(registration.id, 'dsh-polish');
  const plugin = registration.factory(id => { assert.ok(['react', '@deepseek-ai/dsh-client-ui-primitives'].includes(id)); return {}; });
  assert.equal(styles.length, 0);
  assert.equal(listeners.size, 0);
  plugin.apply({ effect(callback) { cleanups.push(callback()); } });
  assert.equal(styles.length, 1);
  assert.equal(styles[0].dataset.dshPolish, 'icons');
  assert.ok(styles[0].textContent.includes('mask-image'));
  cleanups.reverse().forEach(dispose => dispose());
  assert.equal(styles.length, 0);
});
