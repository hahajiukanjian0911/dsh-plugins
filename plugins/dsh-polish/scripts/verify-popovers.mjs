import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { root } from './build.mjs';
import { buildPopoverPreview, previewFolder } from './build-popover-preview.mjs';

const { contract, surfaces } = await buildPopoverPreview();
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const evidence = new URL(`../../outputs/dsh-polish-${version}/`, root);
await mkdir(evidence, { recursive: true });
const errors = [];
const results = [];
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 940, height: 760 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('index.html', previewFolder).href);
  for (const surface of surfaces) {
    await page.evaluate(id => { window.chooseSurface(id); window.setPolish(false); }, surface.id);
    const root = page.locator('#seat > div');
    const before = await root.evaluate(node => ({
      text: node.textContent,
      roles: [...node.querySelectorAll('[role]')].map(element => [element.tagName, element.getAttribute('role'), element.getAttribute('aria-current')]),
      images: [...node.querySelectorAll('img')].map(element => [element.getAttribute('src'), element.getAttribute('alt')]),
      style: [getComputedStyle(node).position, getComputedStyle(node).transform, getComputedStyle(node).pointerEvents],
      font: getComputedStyle(node).fontFamily,
    }));
    if (['account', 'usage'].includes(surface.id)) await page.screenshot({ path: new URL(`${surface.id}-before.png`, evidence).pathname });
    await page.evaluate(() => window.setPolish(true));
    const after = await root.evaluate(node => ({
      text: node.textContent,
      roles: [...node.querySelectorAll('[role]')].map(element => [element.tagName, element.getAttribute('role'), element.getAttribute('aria-current')]),
      images: [...node.querySelectorAll('img')].map(element => [element.getAttribute('src'), element.getAttribute('alt')]),
      style: [getComputedStyle(node).position, getComputedStyle(node).transform, getComputedStyle(node).pointerEvents],
      font: getComputedStyle(node).fontFamily,
      radius: getComputedStyle(node).borderRadius,
    }));
    assert.deepEqual(after.text, before.text);
    assert.deepEqual(after.roles, before.roles);
    assert.deepEqual(after.images, before.images);
    assert.deepEqual(after.style, before.style);
    assert.match(before.font, /Times New Roman/);
    assert.match(after.font, /system-ui/);
    assert.equal(after.radius, '10px');
    assert.equal(await root.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    const fonts = await root.locator('button').evaluateAll(nodes => nodes.map(node => ({
      font: getComputedStyle(node).fontFamily, size: getComputedStyle(node).fontSize,
      height: node.getBoundingClientRect().height,
    })));
    for (const font of fonts) { assert.match(font.font, /system-ui/); assert.equal(font.size, '13px'); assert.ok(font.height >= 32); }
    if (surface.id === 'apps') assert.equal(after.images.length, 8);
    if (['usage', 'stats'].includes(surface.id)) {
      const data = await root.locator('dd').evaluateAll(nodes => nodes.map(node => ({
        text: node.textContent, align: getComputedStyle(node).textAlign,
        numeric: getComputedStyle(node).fontVariantNumeric,
      })));
      for (const value of data) { assert.equal(value.align, 'right'); assert.equal(value.numeric, 'tabular-nums'); }
    }
    for (const appearance of ['light', 'dark']) {
      await page.evaluate(dark => document.body.classList.toggle('dark', dark), appearance === 'dark');
      await page.screenshot({ path: new URL(`${surface.id}-${appearance}.png`, evidence).pathname });
    }
    await page.evaluate(() => document.body.classList.remove('dark'));
    results.push({ scene: surface.id, textAndRolesPreserved: true, appImagesPreserved: true,
      systemFont: true, radius: after.radius, menuRows: fonts.length });
  }

  await page.evaluate(() => window.chooseSurface('account'));
  const keyboard = page.locator('#seat button').first();
  await page.keyboard.press('Tab');
  await keyboard.focus();
  assert.equal(await keyboard.evaluate(node => node === document.activeElement), true);
  assert.notEqual(await keyboard.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
  await page.evaluate(({ menu }) => {
    const viewport = document.querySelector('#seat [role=presentation]');
    const button = document.createElement('button');
    button.className = `${menu.item} ${menu.danger}`;
    button.setAttribute('role', 'menuitem');
    button.textContent = '删除';
    button.disabled = true;
    viewport.appendChild(button);
  }, contract);
  const disabled = page.getByRole('menuitem', { name: '删除', exact: true });
  assert.equal(await disabled.isDisabled(), true);
  const dangerColor = await disabled.evaluate(node => getComputedStyle(node).color);
  await page.evaluate(() => window.setPolish(false));
  assert.equal(await disabled.evaluate(node => getComputedStyle(node).color), dangerColor);
  await page.evaluate(() => window.setPolish(true));

  for (const width of [390, 728]) {
    await page.setViewportSize({ width, height: 760 });
    for (const id of ['apps', 'model', 'usage', 'stats']) {
      await page.evaluate(id => window.chooseSurface(id), id);
      assert.equal(await page.locator('#seat > div').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
      const box = await page.locator('#seat > div').boundingBox();
      assert.ok(box.x >= 12 && box.x + box.width <= width - 12, `${width}px ${id} 超出边缘`);
    }
  }
  await page.emulateMedia({ forcedColors: 'active' });
  assert.notEqual(await page.locator('#seat > div').evaluate(node => getComputedStyle(node).outlineColor), 'rgba(0, 0, 0, 0)');
  await page.emulateMedia({ forcedColors: 'none' });
  await page.setViewportSize({ width: 940, height: 760 });

  // 用同一份已核对的宿主结构生成 QA 合页，方便一次看完整套排版。
  await page.evaluate(surfaces => {
    document.body.classList.remove('dark');
    document.querySelector('main').innerHTML = '<div id="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:34px;padding:10px"></div>';
    for (const surface of surfaces) {
      const cell = document.createElement('section');
      cell.style.cssText = 'min-height:175px;display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:12px';
      cell.innerHTML = `<h2 style="font:500 13px/20px system-ui;margin:0">${surface.label}</h2>${surface.html.replaceAll('--preview-menu', `--preview-${surface.id}`)}`;
      document.querySelector('#qa').appendChild(cell);
    }
  }, surfaces);
  const overviewHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 940, height: overviewHeight });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: new URL('overview-light.png', evidence).pathname });
  await page.evaluate(() => document.body.classList.add('dark'));
  await page.screenshot({ path: new URL('overview-dark.png', evidence).pathname });
  assert.deepEqual(errors, []);
  const report = { version, host: contract.version, scenes: results,
    checks: ['八种场景的文字、值、角色、图像来源保持一致', '系统字体、10px 圆角与菜单行高生效',
      '统计数值右对齐及等宽数字生效', '键盘焦点可见，禁用与危险颜色保留',
      '390px/728px 的菜单和长路径没有水平裁切', '强制对比模式保留轮廓', '深浅色截图均已生成'],
    errors, scope: '后台 Chrome；使用本机宿主 CSS、类名及对应 DOM 结构，数据取自用户截图；不是实际 DSH 菜单操作验收。' };
  await writeFile(new URL('popovers-check.json', evidence), JSON.stringify(report, null, 2) + '\n');
  const { css, ...identity } = contract;
  await writeFile(new URL('host-contract.json', evidence), JSON.stringify(identity, null, 2) + '\n');
  console.log(JSON.stringify({ scenes: results.length, checks: report.checks, errors }, null, 2));
} finally { await browser.close(); }
