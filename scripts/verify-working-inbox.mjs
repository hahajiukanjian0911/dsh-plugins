import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function verifyWorkingInbox(browser, url, check, failures, version) {
  const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(url);
  const current = page.locator('.dsi-primary [data-session-id="current"]');
  const working = page.locator('.dsi-primary [data-session-id="working"]');
  try {
    await current.waitFor();
    await check('running sessions remain in the main list with status badges and no working shelf', async () => {
      await working.waitFor();
      await working.getByText('工作中', { exact: true }).waitFor();
      assert.equal(await working.getByRole('button', { name: '收起', exact: true }).isDisabled(), true);
      await current.evaluate(node => { window.currentBeforeRunning = node; });
      const before = await current.boundingBox();
      await page.evaluate(() => {
        const source = window.inboxDemo.fixture.status;
        source.set(new Map([...source.getSnapshot(), ['current', { running: true }]]));
      });
      await current.getByText('工作中', { exact: true }).waitFor();
      assert.equal(await current.evaluate(node => node === window.currentBeforeRunning), true);
      const running = await current.boundingBox();
      // A new send can move a recent session upward in the normal activity
      // order; it must keep the same card and stay in the main list.
      assert.equal(running.x, before.x);
      assert.equal(running.width, before.width);
      assert.equal(running.height, before.height);
      assert.equal(await page.locator('.dsi-primary .dsi-status-working').count(), 2);
      assert.equal(await page.locator('.dsi-shelf-working').count(), 0);
      assert.equal(await page.getByRole('button', { name: /^(展开|收起)工作中$/ }).count(), 0);
      assert.equal(await page.getByText('暂无待处理会话', { exact: true }).count(), 0);
      await page.mouse.move(359, 840);
      await page.screenshot({ path: 'outputs/sidebar-working-light.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'outputs/sidebar-working-dark.png', fullPage: true });
    });
    await check('an inbox containing only running work stays visible and completion or a request does not move it to a shelf', async () => {
      await page.evaluate(async () => {
        const { fixture, actions } = window.inboxDemo;
        const value = fixture.sessions.getSnapshot();
        fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), pinnedSessionIds: [],
          items: fixture.workspaces.getSnapshot().items.map(item => ({ ...item,
            sessionIds: item.sessionIds.filter(id => id === 'working' || id === 'old') })) });
        fixture.sessions.set({ ...value, ids: ['working', 'old'], byId: { working: value.byId.working, old: value.byId.old } });
        await actions.open('working');
      });
      await working.getByText('工作中', { exact: true }).waitFor();
      assert.equal(await page.getByText('暂无待处理会话', { exact: true }).count(), 0);
      const settled = await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').boundingBox();
      const footer = await page.locator('.preview-native-foot').boundingBox();
      assert.ok(Math.abs(settled.y + settled.height - footer.y) <= 1);
      await working.evaluate(node => { window.workingBeforeFinish = node; });
      await page.evaluate(() => window.inboxDemo.fixture.finish('working'));
      await page.waitForFunction(() => document.querySelector('.dsi-primary [data-session-id="working"]')?.dataset.section === 'inbox');
      assert.equal(await working.evaluate(node => node === window.workingBeforeFinish), true);
      assert.equal(await page.locator('.dsi-shelf-working').count(), 0);
      await page.evaluate(() => {
        const source = window.inboxDemo.fixture.status;
        source.set(new Map([['working', { running: false, pendingInteraction: { kind: 'question' } }]]));
      });
      await working.getByText('待回复', { exact: true }).waitFor();
      assert.equal(await working.evaluate(node => node === window.workingBeforeFinish), true);
    });
    await writeFile('outputs/working-inbox-check.json', JSON.stringify({ version, workingShelfRendered: false,
      runningSessionsInMainList: true, runningStatusAndSettleProtectionPreserved: true,
      runningStartsWithoutMovingCardToShelf: true, multipleRunningSessionsVisible: true,
      runningOnlyInboxHasNoEmptyHint: true, completionAndRequestKeepSameCard: true,
      scope: 'background Chrome with real plugin and isolated host events' }, null, 2) + '\n');
  } finally { await page.close(); }
}
