import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { build, root } from './build.mjs';

await build();
const repo = new URL('../../', root);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const folder = new URL(`outputs/dsh-polish-${version}/`, repo);
await mkdir(folder, { recursive: true });
const client = await readFile(new URL('client.js', root), 'utf8');
const checks = [];
const errors = [];
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 850 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('temp/design/inbox-sidebar/index.html', repo).href);
  const more = page.getByRole('button', { name: '更多', exact: true });
  await more.waitFor();
  await more.evaluate(button => {
    button.setAttribute('aria-haspopup', 'menu');
    button.querySelector('svg').dataset.icon = 'dsw-icon-apps-add-outline-regular';
    document.body.style.fontFamily = '"Times New Roman", serif';
  });
  const geometry = await more.boundingBox();
  const clip = { x: 0, y: Math.max(0, geometry.y - 70), width: 360,
    height: Math.min(130, 850 - Math.max(0, geometry.y - 70)) };
  await more.hover();
  await page.screenshot({ path: new URL('before.png', folder).pathname, clip });
  await page.mouse.move(350, 400);
  await page.evaluate(() => {
    window.savedPolishLoader = window.__ModuleLoader__;
    window.polishDisposers = [];
    window.__ModuleLoader__ = { load(module) {
      module.factory().apply({ effect(fn) { window.polishDisposers.push(fn()); } });
    } };
  });
  await page.addScriptTag({ content: client });
  await page.evaluate(() => { window.__ModuleLoader__ = window.savedPolishLoader; });
  const tip = page.locator('[data-dsh-polish-tooltip]');
  await more.hover();
  await page.waitForTimeout(100);
  assert.equal(await tip.count(), 0);
  await tip.waitFor({ state: 'visible' });
  assert.equal(await tip.textContent(), '更多');
  const metrics = await tip.evaluate(node => {
    const style = getComputedStyle(node), box = node.getBoundingClientRect();
    return { font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
      padding: style.padding, radius: style.borderRadius, height: box.height,
      x: box.x, y: box.y, width: box.width };
  });
  assert.match(metrics.font, /system-ui/);
  assert.equal(metrics.fontSize, '13px');
  assert.equal(metrics.lineHeight, '18px');
  assert.equal(metrics.padding, '4px 8px');
  assert.equal(metrics.radius, '6px');
  assert.equal(metrics.height, 28);
  assert.ok(Math.abs(geometry.y - metrics.y - metrics.height - 8) < 1);
  assert.ok(metrics.x >= 12 && metrics.x + metrics.width <= 348);
  assert.equal(await more.evaluate(node => getComputedStyle(node, '::after').content), 'none');
  assert.equal(await page.locator('[role="tooltip"]:visible').count(), 1);
  assert.deepEqual(await more.boundingBox(), geometry);
  assert.match(await more.locator('svg').evaluate(node => getComputedStyle(node).maskImage), /layout-grid/);
  checks.push('悬停延迟、系统字体、13px 单行、4×8px 留白、6px 圆角、8px 间距、12px 边缘留白及单层提示通过');
  checks.push('更多使用应用网格，按钮几何不变，旧伪元素提示关闭');
  await page.screenshot({ path: new URL('after-light.png', folder).pathname, clip });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: new URL('after-dark.png', folder).pathname, clip });
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
  assert.equal(await more.getAttribute('aria-describedby'), null);
  await more.click();
  assert.equal(await page.evaluate(() => window.inboxDemo.moreOpened), true);
  checks.push('Escape 可关闭提示，点击继续调用原入口');

  await page.evaluate(() => {
    const region = document.createElement('div');
    region.className = 'dsi-root';
    region.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:visible';
    region.innerHTML = '<button id="edge-tip" class="dsi-icon-button" title="这是用于核对边缘避让与长说明换行的提示文字。这里保留完整信息，并避免超出窗口。" aria-label="边缘工具" aria-describedby="existing-help" style="position:fixed;top:12px;right:12px;width:28px;height:28px">A</button>';
    document.body.appendChild(region);
  });
  const edge = page.locator('#edge-tip');
  await edge.hover();
  await tip.waitFor({ state: 'visible' });
  assert.equal(await edge.getAttribute('title'), null);
  const edgeBox = await tip.boundingBox();
  assert.ok(edgeBox.x >= 12 && edgeBox.x + edgeBox.width <= 348);
  assert.ok(edgeBox.y >= 48);
  assert.equal(await tip.getAttribute('data-polish-side'), 'bottom');
  assert.ok(edgeBox.height > 28);
  assert.match(await edge.getAttribute('aria-describedby'), /existing-help dsh-polish-tooltip/);
  await page.screenshot({ path: new URL('edge-long.png', folder).pathname });
  await page.mouse.move(200, 400);
  await tip.waitFor({ state: 'hidden' });
  assert.match(await edge.getAttribute('title'), /边缘避让/);
  assert.equal(await edge.getAttribute('aria-describedby'), 'existing-help');
  checks.push('顶部空间不足自动翻转，长文案换行；原 title 与已有无障碍说明恢复');

  await page.keyboard.press('Tab');
  await edge.focus();
  await tip.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
  checks.push('键盘聚焦显示提示，Escape 关闭且不清除原说明');

  await page.evaluate(() => {
    const tooltip = document.createElement('span');
    tooltip.id = 'native-tooltip-fixture';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.style.cssText = 'position:fixed;left:30px;top:200px';
    tooltip.innerHTML = '<span>原生提示</span><kbd>⌘ K</kbd>';
    document.body.appendChild(tooltip);
  });
  const native = await page.locator('#native-tooltip-fixture').evaluate(node => ({
    font: getComputedStyle(node).fontFamily, childFont: getComputedStyle(node.firstElementChild).fontFamily,
    radius: getComputedStyle(node).borderRadius, shortcut: node.querySelector('kbd').textContent,
  }));
  assert.match(native.font, /system-ui/);
  assert.match(native.childFont, /system-ui/);
  assert.equal(native.radius, '6px');
  assert.equal(native.shortcut, '⌘ K');
  await page.locator('#native-tooltip-fixture').evaluate(node => node.remove());
  checks.push('原生 role=tooltip 的文本样式统一，快捷键内容保留');

  await edge.hover();
  await tip.waitFor({ state: 'visible' });
  await page.evaluate(() => window.polishDisposers.toReversed().forEach(dispose => dispose()));
  assert.equal(await tip.count(), 0);
  assert.equal(await page.locator('[data-dsh-polish]').count(), 0);
  assert.match(await edge.getAttribute('title'), /边缘避让/);
  assert.equal(await edge.getAttribute('aria-describedby'), 'existing-help');
  await more.hover();
  assert.notEqual(await more.evaluate(node => getComputedStyle(node, '::after').content), 'none');
  checks.push('停用移除浮层、样式及事件处理，原 title、说明和旧提示可恢复');
  assert.deepEqual(errors, []);
  await writeFile(new URL('tooltips-check.json', folder), JSON.stringify({
    version, passed: checks.length, checks, metrics, errors,
    scope: '后台 Chrome；真实收件箱组件及模拟宿主数据，原生 Tooltip 仅验证 role 标记的样式。未在真实应用内合成悬停或点击。',
  }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} finally { await browser.close(); }
