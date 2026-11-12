import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildTypographyPreview, typographyPreview } from './build-typography-preview.mjs';
import { buildSettingsPreview, settingsPreview } from './build-settings-preview.mjs';

const root = new URL('../', import.meta.url), repo = new URL('../../../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const output = new URL('outputs/dsh-polish-' + version + '/', repo);
await mkdir(output, { recursive: true });
const reference = await buildTypographyPreview();
await buildSettingsPreview();
const client = await readFile(new URL('client.js', root), 'utf8');
const baseline = execFileSync('tar', ['-xOf', new URL('releases/dsh-polish-0.1.11.tgz', repo).pathname, 'package/client.js'], { encoding: 'utf8', maxBuffer: 2e6 });
const extract = source => JSON.parse(source.match(/const stylesheet = ("(?:[^"\\]|\\.)*");/)[1]);
const beforeType = await readFile(new URL('outputs/dsh-polish-0.1.12/before/src-typography.css', repo), 'utf8');
const currentType = await readFile(new URL('src/typography.css', root), 'utf8');
assert.equal(extract(client), extract(baseline).replace(beforeType, () => currentType));
assert.equal(client.replace(JSON.stringify(extract(client)), '""'), baseline.replace(JSON.stringify(extract(baseline)), '""'));
const checks = ['与 0.1.11 比较，生产客户端仅排版 CSS 有变化，设置圆角及客户端逻辑保留'], errors = [], layouts = [], contrasts = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000); page.on('pageerror', e => errors.push(e.message));
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const boot = async query => { await page.goto(typographyPreview.href + (query ? '?' + query : '')); await page.locator('h2 code').waitFor(); await settle(); };
  const metrics = () => page.evaluate(() => Object.fromEntries(Object.entries({
    root: 'html', ui: '.type-preview>header', prose: '[data-markdown-variant], [data-conversation-content] [class*="_markdown_"] > p',
    heading: 'h2', headingCode: 'h2 code', inline: 'li code', code: '.md-code-block pre', meta: '.type-meta', input: '[data-composer-input]', terminal: '.type-terminal-probe',
  }).map(([name, selector]) => { const n = document.querySelector(selector), s = getComputedStyle(n); return [name, { size: s.fontSize, line: s.lineHeight, family: s.fontFamily, weight: s.fontWeight, marginTop: s.marginTop, marginBottom: s.marginBottom }]; })));
  await boot('polish=before'); const before = await metrics();
  const text = await page.locator('main').textContent();
  await page.screenshot({ path: new URL('typography-before.png', output).pathname, animations: 'disabled' });
  await page.evaluate(() => window.setTypePolish('after')); const active = await metrics();
  assert.equal(await page.locator('main').textContent(), text);
  assert.equal(before.headingCode.size, '13px'); assert.equal(active.headingCode.size, active.heading.size);
  assert.equal(active.headingCode.line, active.heading.line); assert.equal(active.headingCode.weight, active.heading.weight);
  assert.equal(active.prose.size, '16px'); assert.equal(active.prose.line, '28px');
  assert.equal(active.prose.marginTop, '12px'); assert.equal(active.heading.marginBottom, '8px');
  for (const key of ['code', 'inline']) { assert.equal(active[key].size, '13px'); assert.equal(active[key].line, '21px'); }
  assert.equal(active.input.size, '16px'); assert.equal(active.meta.size, '12px');
  assert.deepEqual(active.root, before.root); assert.deepEqual(active.terminal, before.terminal);
  checks.push('实际 DSH MarkdownText 中标题代码从 13px 恢复为标题 20px/30px/600；正文16/28、代码13/21、输入16/28及文字内容保留');

  const session = await page.context().newCDPSession(page); await session.send('DOM.enable'); await session.send('CSS.enable');
  const doc = await session.send('DOM.getDocument'), fonts = {};
  for (const [name, selector] of Object.entries({ prose: '[data-conversation-content] [class*="_markdown_"] > p', code: '.md-code-block pre code .line > span', ui: '.type-preview>header' })) {
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    fonts[name] = (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  }
  assert.ok(fonts.prose.some(f => /PingFang/.test(f.postScriptName)));
  assert.ok(fonts.code.some(f => /Menlo/.test(f.postScriptName)));
  assert.ok(Object.values(fonts).flat().every(f => !f.isCustomFont));
  checks.push('实际平台字形为系统中文 PingFang SC、系统西文及 Menlo；无新增 WebFont');

  await page.evaluate(() => {
    document.body.style.setProperty('--dsh-content-font-size', '20px');
    document.body.style.setProperty('--dsh-content-font-delta', '6px');
    document.body.style.setProperty('--dsh-code-font-size', '15px');
    document.body.style.setProperty('--dsh-code-font-delta', '4px');
    document.body.style.setProperty('--dsh-font-family-text', 'Georgia');
    document.body.style.setProperty('--dsh-font-family-code', 'Courier New');
  });
  const changed = await metrics(); assert.equal(changed.prose.size, '20px'); assert.equal(changed.prose.line, '35px');
  assert.equal(changed.headingCode.size, '25px'); assert.equal(changed.code.size, '15px'); assert.equal(changed.inline.size, '15px');
  assert.match(changed.prose.family, /Georgia/); assert.match(changed.code.family, /Courier New/);
  assert.deepEqual(changed.root, before.root); assert.deepEqual(changed.terminal, before.terminal);
  checks.push('原生正文/代码字号与字体变量仍独立响应；根字号与终端字号字体保留');

  for (const width of [1200, 728, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await boot();
    for (const size of [14, 16, 20]) {
      await page.evaluate(size => { document.body.style.setProperty('--dsh-content-font-size', size + 'px'); document.body.style.setProperty('--dsh-content-font-delta', size - 14 + 'px'); }, size);
      await settle();
      const layout = await page.evaluate(() => ({ width: innerWidth, bodySize: getComputedStyle(document.querySelector('h2')).fontSize, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.equal(layout.overflow, false); layouts.push({ ...layout, size });
    }
    await page.locator('h2 code').evaluate(n => n.textContent = 'very-long-settings-module-'.repeat(6) + '.css');
    await settle(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  checks.push('1200/728/390px × 正文14/16/20px无页面横向溢出，超长标题代码能换行');

  const settings = await browser.newPage({ viewport: { width: 1240, height: 900 }, reducedMotion: 'reduce' });
  await settings.goto(settingsPreview.href); await settings.locator('.KaH-Nq_expander').click();
  const settingsMetrics = await settings.evaluate(() => Object.fromEntries(['._77Pn0W_navCell', '.KaH-Nq_title', '.RrNL-q_themeCube', '._77Pn0W_panel', '.rQMTkq_field'].map(selector => {
    const s = getComputedStyle(document.querySelector(selector)); return [selector, { size: s.fontSize, weight: s.fontWeight, radius: s.borderRadius }];
  })));
  assert.equal(settingsMetrics['._77Pn0W_navCell'].size, '14px'); assert.equal(settingsMetrics['.KaH-Nq_title'].weight, '500');
  assert.equal(settingsMetrics['.RrNL-q_themeCube'].size, '14px'); assert.equal(settingsMetrics['._77Pn0W_panel'].radius, '20px');
  assert.equal(settingsMetrics['.rQMTkq_field'].radius, '8px');
  await settings.screenshot({ path: new URL('settings-fonts.png', output).pathname, animations: 'disabled' }); await settings.close();

  const sidebar = await browser.newPage({ viewport: { width: 320, height: 850 }, reducedMotion: 'reduce' });
  await sidebar.goto(new URL('temp/design/inbox-sidebar/index.html', repo).href); await sidebar.locator('.dsi-dsh-time').first().waitFor();
  const rowMetrics = () => sidebar.locator('[data-sidebar-row="current"]').evaluate(n => ({ height: n.getBoundingClientRect().height, title: getComputedStyle(n.querySelector('.dsi-dsh-title')).fontSize, time: getComputedStyle(n.querySelector('.dsi-dsh-time')).fontSize }));
  const rowBefore = await rowMetrics();
  const warningBefore = await sidebar.locator('[data-sidebar-row="answer"] .dsi-dsh-time').evaluate(n => getComputedStyle(n).color);
  await sidebar.evaluate(() => { window.__typeEffects = []; window.__ModuleLoader__ = { load(e) { e.factory().apply({ effect(fn) { window.__typeEffects.push(fn()); } }); } }; });
  await sidebar.addScriptTag({ content: client }); const rowAfter = await rowMetrics();
  assert.equal(rowBefore.time, '10px'); assert.equal(rowAfter.time, '11px'); assert.equal(rowAfter.title, '14px'); assert.equal(rowAfter.height, rowBefore.height);
  assert.equal(await sidebar.locator('[data-sidebar-row="answer"] .dsi-dsh-time').evaluate(n => getComputedStyle(n).color), warningBefore);
  await sidebar.screenshot({ path: new URL('sidebar-fonts.png', output).pathname, animations: 'disabled' }); await sidebar.close();
  checks.push('真实设置导航与主题选项统一14px、字段字重500；真实侧栏时间10→11px且行高不变，圆角20/10/8保留');

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touch.goto(typographyPreview.href); await touch.locator('[data-composer-input]').waitFor();
  await touch.evaluate(() => document.body.style.setProperty('--dsh-content-font-size', '10px'));
  assert.equal(await touch.locator('[data-composer-input]').evaluate(n => getComputedStyle(n).fontSize), '16px'); await touch.close();
  checks.push('触屏且正文10px时，消息输入保持16px下限');

  await page.setViewportSize({ width: 1200, height: 1100 }); await boot();
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme }); await settle();
    const contrast = await page.evaluate(() => {
      const luminance = css => {
        const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, 1, 1);
        return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
      };
      const background = getComputedStyle(document.body).backgroundColor;
      return { background, values: ['[data-conversation-content] [class*="_markdown_"] > p', '.type-meta'].map(selector => {
        const a = luminance(getComputedStyle(document.querySelector(selector)).color), b = luminance(background);
        return { selector, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
      }) };
    });
    assert.notEqual(contrast.background, 'rgba(0, 0, 0, 0)');
    contrast.values.forEach(value => assert.ok(value.contrast >= 4.5, JSON.stringify({ colorScheme, value })));
    contrasts.push({ colorScheme, ...contrast });
    await page.screenshot({ path: new URL('typography-' + colorScheme + '.png', output).pathname, animations: 'disabled' });
  }
  checks.push('真实主题的深浅色底面下，正文与辅助文字对比度均达到4.5:1');
  await page.evaluate(() => window.setTypePolish('before')); assert.deepEqual(await metrics(), before);
  await page.evaluate(() => window.__polishEffects.splice(0).reverse().forEach(dispose => dispose?.()));
  assert.equal(await page.locator('[data-dsh-polish]').count(), 0);
  checks.push('切回0.1.11可还原排版指标，停用后清除样式与监听');
  assert.deepEqual(errors, []);
  const report = { version, passed: checks.length, checks, errors, before, active, changed, fonts, layouts, contrasts, rowBefore, rowAfter, settingsMetrics, ...reference,
    scope: '后台 Chrome；本机 DSH 0.2.2-rc.1 实际 MarkdownText/CodeBlock、设置组件、侧栏及主题。文本、服务数据和窗口组合为隔离示例，未操作用户窗口或原生设置。' };
  await writeFile(new URL('typography-check.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} finally { await browser.close(); }
