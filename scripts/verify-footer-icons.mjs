import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { parse } from '@babel/parser';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
page.setDefaultTimeout(5000);
const checks = [], errors = [], appearances = [];
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
page.on('pageerror', error => errors.push(error.message));
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
const button = name => page.getByRole('button', { name, exact: true });
const avatar = () => page.locator('[data-slot="settings.launcher"] button[aria-haspopup=dialog]');
const nav = () => page.locator('[data-slot=sidebar] > div > nav');
async function geometry() {
  const nodes = [await avatar().boundingBox(), ...await Promise.all(['插件', '自动化任务'].map(name => button(name).boundingBox()))];
  assert.ok(nodes.every(n => n && n.width === 36 && n.height === 36));
  assert.ok(nodes.every(n => Math.abs(n.y - nodes[0].y) < 1));
  assert.ok(nodes.every(n => n.x >= 0 && n.x + n.width <= page.viewportSize().width));
  return nodes;
}
try {
  await page.goto(pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href); await page.locator('[data-sidebar-row=current]').waitFor();
  await check('Native panel buttons share the avatar footer row and display icons without labels', async () => {
    await geometry();
    assert.deepEqual(await nav().getByRole('button').allInnerTexts(), ['', '']);
    assert.equal(await nav().getByRole('button').locator('svg').count(), 2);
    assert.ok((await page.getByRole('combobox', { name: '搜索会话' }).boundingBox()).y < 200);
    for (const name of ['插件', '自动化任务']) assert.equal(await button(name).getAttribute('title'), name);
  });
  await check('Plugin and automation icons keep native navigation and active states', async () => {
    for (const [name, id] of [['插件', 'plugins'], ['自动化任务', 'schedules']]) {
      await button(name).click(); assert.equal(await page.evaluate(() => window.inboxDemo.fixture.ctx.layout.panelInfo.getSnapshot().activePanelId), id);
      assert.equal(await button(name).getAttribute('aria-current'), 'page');
    }
  });
  await check('More is absent from the footer and keyboard focus order, with no menu shown', async () => {
    assert.equal(await button('更多').count(), 0);
    assert.equal(await nav().getByRole('button').count(), 2);
    assert.equal(await page.getByRole('menu').count(), 0);
    await button('自动化任务').focus(); await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '更多');
  });
  await check('The avatar continues to open Settings directly without an account menu', async () => {
    await avatar().click(); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
    assert.equal(await page.getByRole('menu').count(), 0); assert.equal(await page.evaluate(() => window.inboxDemo.settingsOpened), 1);
    await page.keyboard.press('Escape');
  });
  await check('Hover names use the installed DSH Polish tooltip implementation', async () => {
    const source = await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'), 'utf8');
    const ast = parse(source, { sourceType: 'script' }); let found;
    function find(node) { if (!node || typeof node !== 'object' || found) return;
      if (node.type === 'FunctionDeclaration' && node.id?.name === 'mountTooltips') { found = node; return; }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(find); else if (value && typeof value === 'object') find(value);
    }
    find(ast); assert.ok(found);
    await page.addStyleTag({ content: JSON.parse(source.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]) });
    await page.addScriptTag({ content: 'window.stopPolishTooltip=(' + source.slice(found.start, found.end) + ')(document,window);' });
    for (const name of ['插件', '自动化任务']) {
      await button(name).hover(); const tooltip = page.locator('#dsh-polish-tooltip'); await tooltip.waitFor({ state: 'visible' });
      assert.equal(await tooltip.innerText(), name);
    }
    await page.mouse.move(350, 50); await page.locator('#dsh-polish-tooltip').waitFor({ state: 'hidden' });
  });
  await check('Light, dark and narrow sidebar layouts retain the shared footer and usable session area', async () => {
    for (const appearance of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: appearance });
      await page.waitForFunction(dark => document.body.hasAttribute('data-ds-dark-theme') === dark, appearance === 'dark');
      const bounds = await geometry(); appearances.push({ appearance, bounds });
      await page.screenshot({ path: 'outputs/footer-icons-' + version + '-' + appearance + '.png', clip: { x: 0, y: 650, width: 320, height: 200 } });
    }
    await page.setViewportSize({ width: 260, height: 640 }); await page.reload(); await page.locator('.dsi-root').waitFor(); await geometry();
    assert.equal(await page.locator('html').evaluate(n => n.scrollWidth > innerWidth), false);
    assert.ok((await page.locator('.dsi-dsh-scroll').boundingBox()).height > 350);
  });
  await check('Collapsing and reopening uses the native rail and restores the footer layout', async () => {
    await page.evaluate(() => window.inboxDemo.setWide(false)); await page.locator('.dsi-rail').waitFor();
    assert.equal(await button('更多').count(), 0);
    assert.ok((await button('自动化任务').boundingBox()).y > (await button('插件').boundingBox()).y);
    await page.evaluate(() => window.inboxDemo.setWide(true)); await page.locator('.dsi-dsh:not(.dsi-rail)').waitFor(); await geometry();
    assert.equal(await button('插件').getAttribute('title'), '插件');
  });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile('outputs/footer-icons-checks.json', JSON.stringify({ version, checks, errors, appearances,
    scope: 'Installed DSH SidebarRoot, native icons, More menu content, AccountMenu, primitives and Polish tooltip code with fixture callbacks in headless Chrome. Native-window acceptance remains with the user.' }, null, 2) + '\n');
}
