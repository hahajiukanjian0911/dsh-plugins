import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import vm from 'node:vm';
import { iconSvg, manifest, root } from './build.mjs';
import './build-preview.mjs';

const repo = new URL('../../', root);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const evidence = new URL(`outputs/dsh-polish-${version}/`, repo);
await mkdir(evidence, { recursive: true });
const client = await readFile(new URL('client.js', root), 'utf8');
const pageErrors = [];
const checks = [];
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 920, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.goto(new URL('temp/design/polish-icons/index.html', repo).href);
  await page.locator('[data-dsh-polish]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.catalog tbody tr').count(), 98);
  checks.push(`本机宿主 98 个图标均有明确处理，其中 ${Object.keys(manifest.preserved).length} 个保留原版`);

  const nativeKeys = Object.keys(manifest.native);
  const masks = await page.evaluate(keys => {
    const fragment = document.createElement('div');
    fragment.id = 'native-contract';
    fragment.innerHTML = keys.flatMap(key => ['regular', 'medium'].map(weight =>
      `<svg width="16" height="16" data-icon="dsw-icon-${key}-${weight}"><use href="#dsw-icon-${key}-${weight}"/></svg>`)).join('')
      + '<svg width="16" height="16" data-icon="dsw-icon-unknown-regular"><path d="M2 2h12v12H2Z"/></svg>';
    fragment.style.cssText = 'position:absolute;left:-10000px;top:0';
    document.body.appendChild(fragment);
    return [...fragment.querySelectorAll('svg')].map(svg => ({ key: svg.dataset.icon,
      mask: getComputedStyle(svg).maskImage,
      visible: getComputedStyle(svg.firstElementChild).visibility,
      width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height }));
  }, nativeKeys);
  for (const value of masks.slice(0, -1)) {
    assert.notEqual(value.mask, 'none', value.key);
    assert.equal(value.visible, 'hidden');
    assert.equal(value.width, 16);
    assert.equal(value.height, 16);
  }
  assert.equal(masks.at(-1).mask, 'none');
  assert.equal(masks.at(-1).visible, 'visible');
  for (const key of Object.keys(manifest.preserved)) {
    for (const weight of ['regular', 'medium']) {
      const icon = page.locator(`.sample svg[data-icon="dsw-icon-${key}-${weight}"]`).first();
      if (await icon.count()) assert.equal(await icon.evaluate(svg => getComputedStyle(svg).maskImage), 'none');
    }
  }
  checks.push(`${Object.keys(manifest.native).length * 2} 个原生字重选择器生效，保留项和未知图标保持原样，尺寸不变`);

  const regularMasks = masks.filter(value => value.key.endsWith('-regular') && value.mask !== 'none');
  const raster = await page.evaluate(async entries => {
    const results = [];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    for (const entry of entries) {
      const image = new Image();
      image.src = JSON.parse(entry.mask.slice(4, -1));
      await image.decode();
      context.clearRect(0, 0, 48, 48);
      context.drawImage(image, 0, 0, 48, 48);
      const pixels = context.getImageData(0, 0, 48, 48).data;
      let visible = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 10) visible++;
      results.push({ key: entry.key, visible, centerAlpha: pixels[(24 * 48 + 24) * 4 + 3] });
    }
    return results;
  }, regularMasks);
  for (const icon of raster) assert.ok(icon.visible > 20, `图标为空：${icon.key}`);
  assert.equal(raster.find(icon => icon.key === 'dsw-icon-close-circle-fill-regular').centerAlpha, 0);
  assert.ok(raster.find(icon => icon.key === 'dsw-icon-stop-fill-regular').centerAlpha > 200);
  for (const base of ['pin', 'like', 'dislike']) {
    const outline = raster.find(icon => icon.key === `dsw-icon-${base}-outline-regular`);
    const fill = raster.find(icon => icon.key === `dsw-icon-${base}-fill-regular`);
    assert.ok(fill.visible > outline.visible, `${base} 的选中态应更饱满`);
  }
  checks.push(`${Object.keys(manifest.native).length} 个蒙版均能离线解码和绘制，实心选中态及镂空关闭图标可区分`);

  const measure = () => page.locator('.sample button').evaluateAll(nodes => nodes.map(node => ({
    label: node.getAttribute('aria-label'), disabled: node.disabled,
    x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y,
    width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
  })));
  const polishedGeometry = await measure();
  await page.locator('#original').click();
  assert.deepEqual(await measure(), polishedGeometry);
  await page.locator('.sample').screenshot({ path: new URL('native-before-light.png', evidence).pathname });
  await page.locator('#polished').click();
  await page.locator('.sample').screenshot({ path: new URL('native-after-light.png', evidence).pathname });
  await page.screenshot({ path: new URL('icons-light.png', evidence).pathname });
  await page.locator('#theme').click();
  assert.equal(await page.locator('body').getAttribute('class'), 'dark');
  await page.locator('.sample').screenshot({ path: new URL('native-after-dark.png', evidence).pathname });
  await page.screenshot({ path: new URL('icons-dark.png', evidence).pathname });
  checks.push('预览切换前后按钮位置、尺寸、标签及禁用状态完全一致，深浅色均已截图');

  for (const width of [390, 728]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.locator('.sample [data-icon]').first().evaluate(svg => ({
    mask: getComputedStyle(svg).maskImage, background: getComputedStyle(svg).backgroundColor,
  }));
  assert.notEqual(forced.mask, 'none');
  assert.notEqual(forced.background, 'rgba(0, 0, 0, 0)');
  await page.emulateMedia({ forcedColors: 'none' });
  checks.push('390px 与 728px 不产生横向溢出，强制对比模式保留图标颜色');

  const source = await readFile(new URL('src/view.jsx', repo), 'utf8');
  const paths = vm.runInNewContext(`(${source.match(/const paths = (\{[\s\S]*?\n\});/)[1]})`);
  assert.deepEqual(Object.keys(paths).sort(), Object.keys(manifest.sidebar).sort());
  for (const [key, [, , path]] of Object.entries(manifest.sidebar)) assert.ok(paths[key].includes(path), key);
  const sidebarCases = Object.entries(paths).map(([key, values]) => ({key, paths:Array.from(values)}));
  const sidebarMasks = await page.evaluate(cases => {
    const fragment = document.createElement('div');
    fragment.className = 'dsi-root';
    fragment.style.cssText = 'position:absolute;left:-10000px';
    fragment.innerHTML = cases.map(icon => `<svg width="16" height="16" data-case="${icon.key}">${icon.paths.map(d => `<path d="${d}"/>`).join('')}</svg>`).join('');
    document.body.appendChild(fragment);
    return [...fragment.querySelectorAll('svg')].map(svg => ({key:svg.dataset.case,mask:getComputedStyle(svg).maskImage}));
  }, sidebarCases);
  for (const value of sidebarMasks) assert.notEqual(value.mask, 'none', value.key);
  assert.notEqual(sidebarMasks.find(icon => icon.key === 'folder').mask, sidebarMasks.find(icon => icon.key === 'addFolder').mask);
  checks.push('14 个收件箱自绘图标均匹配，文件夹与添加项目没有误匹配');

  await page.evaluate(() => window.disablePolish());
  assert.equal(await page.locator('[data-dsh-polish]').count(), 0);
  assert.equal(await page.locator('.sample [data-icon]').first().evaluate(svg => getComputedStyle(svg).maskImage), 'none');
  checks.push('停用后样式节点移除，原图标恢复');

  const sidebar = await browser.newPage({ viewport: { width: 360, height: 850 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  sidebar.on('pageerror', error => pageErrors.push(error.message));
  await sidebar.goto(new URL('temp/design/inbox-sidebar/index.html', repo).href);
  await sidebar.locator('.dsi-root').waitFor();
  const before = await sidebar.locator('.dsi-toolbar').boundingBox();
  await sidebar.evaluate(() => {
    window.polishFixtureLoader = window.__ModuleLoader__;
    window.polishFixtureDisposers = [];
    window.__ModuleLoader__ = { load(module) { module.factory().apply({ effect(fn) { window.polishFixtureDisposers.push(fn()); } }); } };
  });
  await sidebar.addScriptTag({ content: client });
  await sidebar.evaluate(() => { window.__ModuleLoader__ = window.polishFixtureLoader; });
  assert.deepEqual(await sidebar.locator('.dsi-toolbar').boundingBox(), before);
  const counts = await sidebar.locator('.dsi-root svg').evaluateAll(nodes => ({ total: nodes.length,
    replaced: nodes.filter(node => getComputedStyle(node).maskImage !== 'none').length }));
  assert.ok(counts.replaced > 5);
  for (const theme of ['light', 'dark']) {
    await sidebar.emulateMedia({ colorScheme: theme });
    await sidebar.screenshot({ path: new URL(`sidebar-${theme}.png`, evidence).pathname });
  }
  await sidebar.evaluate(() => window.polishFixtureDisposers.toReversed().forEach(dispose => dispose()));
  assert.equal(await sidebar.locator('[data-dsh-polish]').count(), 0);
  checks.push(`真实收件箱组件的现有离线预览替换了 ${counts.replaced} 个可见图标，工具栏几何不变，停用可恢复`);
  await sidebar.close();
  assert.deepEqual(pageErrors, []);
  await writeFile(new URL('check.json', evidence), JSON.stringify({
    version, library: manifest.library, nativeDefinitions: Object.keys(manifest.native).length,
    nativeWeightVariants: Object.keys(manifest.native).length * 2, preservedDefinitions: Object.keys(manifest.preserved), sidebarDefinitions: 14,
    passed: checks.length, checks, raster, pageErrors,
    scope: '后台 Chrome；宿主原始 SVG 与真实插件样式；收件箱为真实组件及模拟宿主数据。未安装或前台操作 DSH。',
  }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks, pageErrors }, null, 2));
} finally { await browser.close(); }
