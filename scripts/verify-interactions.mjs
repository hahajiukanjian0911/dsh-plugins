import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const url = pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const checks = [], errors = [];
const page = await browser.newPage({ viewport: { width: 360, height: 850 }, reducedMotion: 'reduce' });
page.on('pageerror', error => errors.push(error.message));
const row = id => page.locator('.dsi-card[data-session-id="' + id + '"]');
const primary = () => page.locator('.dsi-primary .dsi-card').evaluateAll(nodes => nodes.map(node => node.dataset.sessionId));
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
const fresh = async () => {
  await page.goto(url); await row('current').waitFor();
};
try {
  await fresh();
  await check('T3 pointer drag reorders and Undo restores the previous order without adding layout height', async () => {
    const before = await primary();
    const height = await page.locator('.dsi-content-scroll').boundingBox();
    await row('working').dragTo(row('answer'), { targetPosition: { x: 90, y: 6 } });
    await page.getByRole('button', { name: '撤销', exact: true }).waitFor();
    const moved = await primary();
    assert.equal(moved.indexOf('working') + 1, moved.indexOf('answer'));
    assert.deepEqual(await page.locator('.dsi-content-scroll').boundingBox(), height);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    assert.deepEqual(await primary(), before);
  });
  await check('drag to settled and back to active keeps conversation data and project identity', async () => {
    await row('result').dragTo(page.locator('.dsi-shelf-settled .dsi-shelf-toggle'));
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'result').section === 'settled');
    await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
    const mark = row('result').locator('.dsi-history-project .dsi-project-mark');
    assert.equal(await mark.textContent(), 'TR');
    assert.equal((await row('result').boundingBox()).height, 34);
    await page.screenshot({ path: 'outputs/sidebar-history-interactions-light.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: 'outputs/sidebar-history-interactions-dark.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
    await row('result').dragTo(row('current'), { targetPosition: { x: 90, y: 6 } });
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'result').section === 'inbox');
    const ids = await primary();
    assert.equal(ids.indexOf('result') + 1, ids.indexOf('current'));
  });
  await check('T3 pinned boundary pins and dragging back below an active row unpins', async () => {
    const source = await row('result').boundingBox();
    await page.mouse.move(source.x + 90, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + 90, source.y + source.height / 2 - 8, { steps: 3 });
    await page.locator('[data-sidebar-dragging=true]').waitFor();
    const label = await page.locator('[data-drag-marker="pinned-header"] .sidebar-drag-boundary-label').boundingBox();
    await page.mouse.move(label.x + 90, label.y + label.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'result').pinned);
    assert.ok((await primary()).indexOf('result') < (await primary()).indexOf('answer'));
    await row('result').dragTo(row('current'), { targetPosition: { x: 90, y: 55 } });
    await page.waitForFunction(() => !window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'result').pinned);
    const ids = await primary();
    assert.equal(ids.indexOf('result'), ids.indexOf('current') + 1);
  });
  await check('running and pending-response sessions cannot be dropped into settled', async () => {
    for (const id of ['working', 'answer']) {
      await row(id).dragTo(page.locator('.dsi-shelf-settled .dsi-shelf-toggle'));
      assert.notEqual(await row(id).getAttribute('data-section'), 'settled');
    }
    assert.equal(await page.locator('.dsi-sortable-slot[data-dragging=true]').count(), 0);
  });
  await check('keyboard reorder offers the same move and Undo as pointer drag', async () => {
    const before = await primary();
    const index = before.indexOf('working');
    const pins = await page.locator('.dsi-primary [data-section=pinned]').count();
    const direction = index === pins ? 1 : -1;
    await row('working').locator('.dsi-card-main').press(direction === 1 ? 'Alt+ArrowDown' : 'Alt+ArrowUp');
    await page.waitForFunction(({ index, direction }) => [...document.querySelectorAll('.dsi-primary .dsi-card')]
      .findIndex(node => node.dataset.sessionId === 'working') === index + direction, { index, direction });
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    assert.deepEqual(await primary(), before);
  });
  await check('editing position, text and focus survive completion and a new incoming row', async () => {
    await fresh();
    await row('working').locator('.dsi-title').dblclick();
    const input = row('working').locator('.dsi-title-input');
    await input.fill('完成时仍原地编辑的会话');
    const before = await input.boundingBox();
    await page.evaluate(() => {
      const { fixture } = window.inboxDemo;
      fixture.finish('working');
      const source = fixture.sessions.getSnapshot();
      fixture.sessions.set({ ...source, ids: [...source.ids, 'incoming'], byId: { ...source.byId,
        incoming: { ...source.byId.result, id: 'incoming', displayTitle: '新的后台结果', updatedAt: Date.now(), retainedBy: {} } } });
    });
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'working').section === 'inbox');
    assert.deepEqual(await input.boundingBox(), before);
    assert.equal(await input.inputValue(), '完成时仍原地编辑的会话');
    assert.equal(await input.evaluate(node => node === document.activeElement), true);
    await input.press('Enter');
    await row('working').getByText('完成时仍原地编辑的会话', { exact: true }).waitFor();
    await page.screenshot({ path: 'outputs/sidebar-interactions-light.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: 'outputs/sidebar-interactions-dark.png', fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
  });
  await check('native archive click is view-only, shows its notice, and new activity returns it to active', async () => {
    await page.setViewportSize({ width: 1040, height: 850 });
    await page.goto(url + '?conversation');
    await row('current').waitFor();
    await page.evaluate(() => {
      const source = window.inboxDemo.fixture.workspaces;
      source.set({ ...source.getSnapshot(), archivedSessionIds: ['current'] });
    });
    await page.locator('.dsi-shelf-settled .dsi-shelf-toggle[aria-expanded=true]').waitFor();
    await row('current').locator('.dsi-card-main').click();
    const notice = page.getByRole('complementary', { name: '会话收起状态' });
    await notice.waitFor();
    assert.equal(await row('current').getAttribute('data-section'), 'settled');
    assert.equal(await notice.locator('time').count(), 0);
    await page.evaluate(() => window.inboxDemo.fixture.finish('current'));
    await notice.waitFor({ state: 'detached' });
    assert.equal(await row('current').getAttribute('data-section'), 'inbox');
  });
  await check('Undo shortcut keeps text undo in the composer and works on sidebar controls', async () => {
    await page.evaluate(async () => {
      await window.inboxDemo.actions.restore('old');
      await window.inboxDemo.actions.settle('old', []);
    });
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('保留文字撤销');
    await input.press('Control+z');
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'old').section), 'settled');
    await page.getByRole('button', { name: '新建会话', exact: true }).focus();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'old').section === 'inbox');
  });
  await check('narrow history stays single-line and Undo expires after five seconds', async () => {
    await page.setViewportSize({ width: 280, height: 650 });
    await fresh();
    await page.evaluate(() => window.inboxDemo.actions.settle('current', []));
    await page.getByRole('button', { name: '撤销', exact: true }).waitFor();
    const notice = await page.locator('.dsi-undo-notice').boundingBox();
    assert.ok(notice.x >= 0 && notice.x + notice.width <= 280);
    await page.getByRole('button', { name: '撤销', exact: true }).waitFor({ state: 'detached', timeout: 6500 });
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().undo), null);
  });
  assert.deepEqual(errors, []);
  await writeFile('outputs/interactions-check.json', JSON.stringify({ version, scope: 'Headless Chrome with real plugin and isolated host fixture; native DSH gestures remain for user verification', checks, errors }, null, 2) + '\n');
} finally { await browser.close(); }
