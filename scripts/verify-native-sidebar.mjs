import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const { version: testedVersion } = JSON.parse(await readFile('package.json','utf8'));
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
page.setDefaultTimeout(6000);
const errors = [], checks = [], surfaces = [];
page.on('pageerror', error => errors.push(error.message));
const url = pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const row = id => page.locator('[data-sidebar-row="' + id + '"]');
const main = () => page.locator('[data-sidebar-row]').evaluateAll(nodes => nodes.filter(n => ['inbox', 'working', 'pinned'].includes(n.dataset.section)).map(n => n.dataset.sidebarRow));
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
const fresh = async (query = '') => { await page.goto(url + query); await page.evaluate(() => localStorage.clear()); await page.reload(); await row('current').waitFor(); };
const context = async id => { await row(id).click({ button: 'right' }); await page.getByRole('menu').waitFor(); };
const undo = () => page.getByRole('button', { name: '撤销', exact: true }).click();
let failure;
try {
  await fresh();
  await check('Installed DSH shell and real primitives render 64px rows with working icon symbols', async () => {
    assert.equal(await page.locator('.dsi-t3,.dsi-t3-portal').count(), 0);
    assert.equal(await row('current').evaluate(n => n.getBoundingClientRect().height), 64);
    assert.equal(await page.locator('[data-sidebar-row]').count(), 6);
    assert.equal(await page.getByRole('button', { name: '新建会话', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: '插件', exact: true }).count(), 1);
    assert.ok(await page.locator('symbol#dsw-icon-folder-close-regular').count());
    assert.ok(await page.locator('.dsi-dsh-toolbar svg use').count());
    assert.equal(await row('answer').getAttribute('data-state'), 'warning');
    assert.ok(await row('working').locator('[data-state=ongoing]').count());
  });
  await check('Flat conversation rows retain reminders and the independent settled browser', async () => {
    assert.equal(await row('later').count(), 1);
    assert.equal(await row('later').getAttribute('data-project-key'), 'workspace:dsh-plugins');
    await page.getByTestId('sidebar-settled-entry').click();await row('old').waitFor();assert.equal(await row('current').count(),0);assert.equal(await row('old').evaluate(n=>n.getBoundingClientRect().height),64);await page.getByTestId('sidebar-settled-back').click();
  });
  await check('Native context menu renames, restores row focus and preserves text when cancelled', async () => {
    await context('current'); await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
    const input = page.getByRole('textbox', { name: '重命名', exact: true }); await input.fill('原生侧栏🙂'); await input.press('Enter');
    await page.waitForFunction(() => window.inboxDemo.fixture.sessions.getSnapshot().byId.current.displayTitle === '原生侧栏🙂');
    assert.equal(await row('current').evaluate(n => n === document.activeElement), true);
    await row('current').press('F2'); await input.fill('取消修改'); await input.press('Escape');
    assert.equal(await row('current').locator('[data-row-title]').innerText(), '原生侧栏🙂');
  });
  await check('Rename failures keep the editor and user input available for retry', async () => {
    await page.evaluate(() => { const f = window.inboxDemo.fixture; window.inboxDemo.savedUsing = f.ctx.sessions.using; f.ctx.sessions.using = async () => ({ ok: false, error: { message: '测试保存失败' } }); });
    await row('current').press('F2'); const input = page.getByRole('textbox', { name: '重命名', exact: true });
    await input.fill('失败后保留'); await input.press('Enter'); await page.getByRole('alert').filter({ hasText: '测试保存失败' }).waitFor();
    assert.equal(await input.inputValue(), '失败后保留'); await input.press('Escape');
    await page.evaluate(() => { window.inboxDemo.fixture.ctx.sessions.using = window.inboxDemo.savedUsing; });
  });
  await check('Native project menu and content search keep the inbox organization', async () => {
    await page.getByRole('button', { name: '项目' }).click(); await page.getByRole('menuitem', { name: 'LiQun', exact: true }).click();
    assert.deepEqual(await main(), ['answer', 'working']); await page.getByRole('button', { name: '所有项目', exact: true }).click();
    const search = page.getByRole('combobox', { name: '搜索会话' }); await search.fill('消息关键字'); await page.locator('.dsi-dsh-snippet').waitFor();
    assert.equal(await row('working').count(), 1); await search.press('Escape');
  });
  await check('The selected project retains its own new-session action', async () => {
    await page.getByRole('button', { name: '项目' }).click(); await page.getByRole('menuitem', { name: 'LiQun', exact: true }).click();
    await page.getByRole('button', { name: '在 LiQun 中新建会话', exact: true }).click();
    await page.locator('[data-sidebar-row][data-section=draft]').waitFor();
    assert.ok(await page.evaluate(() => window.inboxDemo.fixture.calls.some(call => call[0] === 'start' && call[1] === 'LiQun')));
  });
  await fresh();
  await check('Settle and Undo retain session data; working and pending rows cannot be settled', async () => {
    const before = await main(), ids = await page.evaluate(() => window.inboxDemo.fixture.sessions.getSnapshot().ids);
    await row('result').hover(); await row('result').getByRole('button', { name: '收起', exact: true }).click();
    await page.getByRole('button', { name: '撤销', exact: true }).waitFor(); assert.equal(await row('result').count(), 0);
    await undo(); assert.deepEqual(await main(), before);
    assert.deepEqual(await page.evaluate(() => window.inboxDemo.fixture.sessions.getSnapshot().ids), ids);
    for (const id of ['working', 'answer']) { await row(id).hover(); assert.equal(await row(id).getByRole('button', { name: '收起', exact: true }).isDisabled(), true); }
  });
  await check('Native reminder submenu and modal save a real reminder and restore it', async () => {
    await context('current'); await page.getByRole('menuitem', { name: '稍后提醒', exact: true }).hover();
    await page.getByRole('menuitem', { name: '自定时间', exact: true }).click(); await page.getByRole('dialog').waitFor();
    const future = new Date(Date.now() + 86400000), local = new Date(+future - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await page.locator('input[type=datetime-local]').fill(local); await page.getByRole('button', { name: '设定提醒', exact: true }).click();
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r => r.id === 'current').section === 'snoozed');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await row('current').hover();
    await row('current').getByRole('button', { name: '移回会话列表', exact: true }).click();
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r => r.id === 'current').section === 'inbox');
  });
  await fresh();
  await check('Native HTML drag and keyboard reorder share the retained undoable model', async () => {
    const before = await main(); await row('working').dragTo(row('answer'), { targetPosition: { x: 90, y: 4 } });
    await page.getByRole('button', { name: '撤销', exact: true }).waitFor(); const after = await main();
    assert.equal(after.indexOf('working') + 1, after.indexOf('answer')); await undo(); assert.deepEqual(await main(), before);
    await row('working').press('Alt+ArrowUp'); await page.getByRole('button', { name: '撤销', exact: true }).waitFor();
    assert.notDeepEqual(await main(), before); await undo(); assert.deepEqual(await main(), before);
  });
  await check('Native drag moves between Inbox, Pinned and Settled without changing session identity', async () => {
    await row('result').dragTo(page.getByTestId('sidebar-settled-entry'));
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r => r.id === 'result').section === 'settled');
    await page.getByTestId('sidebar-settled-entry').click(); await row('result').waitFor();
    await row('result').dragTo(page.getByTestId('sidebar-settled-back'));
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r => r.id === 'result').section === 'inbox');await page.getByTestId('sidebar-settled-back').click();
  });
  await check('Session access disables native rename and placement controls', async () => {
    await page.evaluate(() => { const d = window.inboxDemo; for (const key of ['session/rename', 'workspace/pinSession']) d.denied.add('result:' + key);
      const f = d.fixture; f.sessions.set({ ...f.sessions.getSnapshot() }); });
    await context('result'); assert.equal(await page.getByRole('menuitem', { name: '重命名', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('menuitem', { name: '置顶', exact: true }).isDisabled(), true); await page.keyboard.press('Escape');
  });
  await fresh('?settings');
  await check('Density changes use 64px and 52px rows and keep the existing preference key', async () => {
    await page.getByRole('combobox', { name: '显示密度' }).selectOption('compact');
    assert.equal(await row('current').evaluate(n => n.getBoundingClientRect().height), 52);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dsh.inbox-sidebar.v1.preferences')).density), 'compact');
    await page.getByRole('combobox', { name: '显示密度' }).selectOption('comfortable');
  });
  await fresh();
  await check('Official new-session control creates a draft; rail search and native shortcut focus work', async () => {
    await page.getByRole('button', { name: '新建会话', exact: true }).click(); await page.locator('[data-sidebar-row][data-section=draft]').waitFor();
    await page.evaluate(() => window.inboxDemo.setWide(false)); await page.locator('.dsi-rail').waitFor();
    await page.getByRole('button', { name: '搜索会话', exact: true }).click(); await page.getByRole('combobox', { name: '搜索会话' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: '搜索会话' }).evaluate(n => n === document.activeElement), true);
    await row('pin').focus(); await page.evaluate(() => window.inboxDemo.search());
    assert.equal(await page.getByRole('combobox', { name: '搜索会话' }).evaluate(n => n === document.activeElement), true);
  });
  await fresh();
  for (const appearance of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: appearance });
    await page.waitForFunction(dark => document.body.hasAttribute('data-ds-dark-theme') === dark, appearance === 'dark');
    await page.getByTestId('sidebar-settled-entry').click(); await row('old').waitFor();await row('old').click();
    await page.mouse.move(350, 840);
    await check('DSH tokens, single-row geometry and overflow remain correct in ' + appearance, async () => {
      const result = await row('old').evaluate(n => { const probe = document.createElement('span'); probe.style.color = 'var(--dsw-alias-interactive-bg-hover)'; document.body.append(probe);
        probe.style.color='var(--dsw-alias-bg-base)'; const selection = getComputedStyle(probe).color; probe.remove(); return { height: n.getBoundingClientRect().height, fill: getComputedStyle(n).backgroundColor, selection,
          text: getComputedStyle(n).color, font: getComputedStyle(n).fontFamily, overflow: document.documentElement.scrollWidth > innerWidth }; });
      assert.equal(result.height, 64); assert.equal(result.fill, result.selection); assert.equal(result.overflow, false); surfaces.push({ appearance, ...result });
    });
    await page.screenshot({ path: 'outputs/sidebar-dsh-' + testedVersion + '-' + appearance + '.png', fullPage: true });
    await page.getByTestId('sidebar-settled-back').click();
  }
  await check('Narrow sidebar and English copy stay usable', async () => {
    await page.setViewportSize({ width: 280, height: 640 }); await fresh('?lang=en');
    assert.equal(await page.locator('html').evaluate(n => n.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Projects', exact: true }).click(); await page.getByRole('menuitem', { name: 'All projects', exact: true }).waitFor();
  });
  await check('Installed DSH Polish CSS coexists with the rebuilt browser', async () => {
    const source = await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'), 'utf8');
    const css = JSON.parse(source.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);
    await page.keyboard.press('Escape'); await page.addStyleTag({ content: css });
    assert.equal(await row('current').evaluate(n => n.getBoundingClientRect().height), 64);
    assert.equal(await page.locator('html').evaluate(n => n.scrollWidth > innerWidth), false);
  });
  assert.deepEqual(errors, []);
} catch (error) {
  failure = String(error.stack || error); await mkdir('temp/dsh-rewrite', { recursive: true });
  await page.screenshot({ path: 'temp/dsh-rewrite/failure.png', fullPage: true }); throw error;
} finally {
  await browser.close(); const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  await writeFile('outputs/native-sidebar-checks.json', JSON.stringify({ version, checks, errors, failure, surfaces,
    scope: 'Real installed DSH SidebarRoot, React, primitives and theme in headless Chrome; fixture sessions. No DSH native-window test.' }, null, 2) + '\n');
}
