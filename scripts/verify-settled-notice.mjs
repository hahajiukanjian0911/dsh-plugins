import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function verifySettledNotice(browser, url, check, failures, version) {
  const page = await browser.newPage({ viewport: { width: 1040, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(url + '?conversation');
  const notice = page.getByRole('complementary', { name: '会话收起状态' });
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  try {
    await input.waitFor();
    await check('composer notice appears only for the viewed settled session and uses the actual settlement time', async () => {
      assert.equal(await notice.count(), 0);
      await page.evaluate(() => window.inboxDemo.actions.open('old'));
      await notice.waitFor();
      assert.equal(await notice.getAttribute('data-session-id'), 'old');
      const at = await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().rows.find(row => row.id === 'old').record.settledAt);
      assert.equal(await notice.locator('time').getAttribute('datetime'), new Date(at).toISOString());
      await page.evaluate(at => {
        window.noticeRealNow = Date.now;
        Date.now = () => at + 5 * 60000;
        const source = window.inboxDemo.fixture.workspaces;
        source.set({ ...source.getSnapshot(), items: [...source.getSnapshot().items] });
      }, at);
      await notice.getByText('5 分钟前', { exact: true }).waitFor();
      assert.equal(await notice.getByRole('button', { name: '移回待处理', exact: true }).count(), 1);
      const banner = await notice.boundingBox();
      const composer = await page.locator('.preview-composer-bar').boundingBox();
      assert.ok(banner.y + banner.height <= composer.y);
      assert.equal(banner.x, composer.x);
      assert.equal(banner.width, composer.width);
      assert.equal(await notice.evaluate(node => getComputedStyle(node).borderWidth), '0px');
      await page.mouse.move(1030, 840);
      await page.screenshot({ path: 'outputs/settled-notice-light.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'outputs/settled-notice-dark.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.evaluate(() => { Date.now = window.noticeRealNow; });
    });
    await check('restore dismisses the notice and preserves the composer element, draft, selection and bottom position', async () => {
      await input.fill('这段草稿还没有发送');
      await input.evaluate(node => { node.setSelectionRange(3, 3); window.noticeInput = node; });
      const before = await input.boundingBox();
      await notice.getByRole('button', { name: '移回待处理', exact: true }).click();
      await notice.waitFor({ state: 'detached' });
      assert.equal(await input.inputValue(), '这段草稿还没有发送');
      assert.equal(await input.evaluate(node => node === window.noticeInput), true);
      assert.equal(await input.evaluate(node => node.selectionStart), 3);
      assert.deepEqual(await input.boundingBox(), before);
      assert.equal(await page.locator('.dsi-primary [data-session-id="old"]').count(), 1);
    });
    await check('unknown native archive time is omitted and restore failure stays actionable with a deduplicated retry', async () => {
      await page.evaluate(async () => {
        const { fixture, actions } = window.inboxDemo;
        await actions.open('current');
        const source = fixture.workspaces;
        source.set({ ...source.getSnapshot(), archivedSessionIds: ['current'] });
        window.noticeUnarchive = fixture.ctx.uiWorkspace.unarchiveSession;
        fixture.ctx.uiWorkspace.unarchiveSession = async () => { throw new Error('Example restore failure'); };
      });
      await notice.waitFor();
      assert.equal(await notice.locator('time').count(), 0);
      await notice.getByRole('button', { name: '移回待处理', exact: true }).click();
      await notice.getByRole('alert').getByText('无法移回待处理：Example restore failure', { exact: true }).waitFor();
      assert.equal(await notice.getByRole('button', { name: '移回待处理', exact: true }).isEnabled(), true);
      await page.evaluate(() => {
        window.noticeRestoreCount = 0;
        window.inboxDemo.fixture.ctx.uiWorkspace.unarchiveSession = id => {
          window.noticeRestoreCount++;
          return new Promise(resolve => { window.noticeFinishRestore = () => window.noticeUnarchive(id).then(resolve); });
        };
      });
      await notice.getByRole('button', { name: '移回待处理', exact: true }).click();
      const pending = notice.getByRole('button', { name: '正在恢复…', exact: true });
      assert.equal(await pending.isDisabled(), true);
      await pending.evaluate(node => node.click());
      assert.equal(await page.evaluate(() => window.noticeRestoreCount), 1);
      await page.evaluate(() => window.noticeFinishRestore());
      await notice.waitFor({ state: 'detached' });
      await page.evaluate(() => { window.inboxDemo.fixture.ctx.uiWorkspace.unarchiveSession = window.noticeUnarchive; });
    });
    await check('notice follows its session scope rather than global selection and disappears on new activity', async () => {
      await page.evaluate(async () => {
        await window.inboxDemo.actions.settle('old', []);
        window.inboxDemo.setNoticeSession('old');
      });
      await notice.waitFor();
      assert.equal(await notice.getAttribute('data-session-id'), 'old');
      assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId), 'current');
      await page.evaluate(() => {
        const source = window.inboxDemo.fixture.status;
        source.set(new Map([...source.getSnapshot(), ['old', { running: true }]]));
      });
      await notice.waitFor({ state: 'detached' });
      await page.locator('.dsi-primary [data-session-id="old"] .dsi-status-working').waitFor();
      await page.evaluate(async () => {
        window.inboxDemo.fixture.finish('old');
        await window.inboxDemo.actions.start('TimeRing');
        window.inboxDemo.setNoticeSession(null);
      });
      assert.equal(await notice.count(), 0);
      await page.locator('.dsi-drafts .dsi-card').waitFor();
    });
    await check('settled notice remains readable and usable in a 320px composer and English locale', async () => {
      await page.evaluate(async () => {
        await window.inboxDemo.actions.settle('old', []);
        await window.inboxDemo.actions.open('old');
      });
      await notice.waitFor();
      await page.setViewportSize({ width: 320, height: 850 });
      const banner = await notice.boundingBox();
      const action = await notice.getByRole('button', { name: '移回待处理', exact: true }).boundingBox();
      assert.ok(banner.x >= 0 && banner.x + banner.width <= 320);
      assert.ok(action.x >= banner.x && action.x + action.width <= banner.x + banner.width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: 'outputs/settled-notice-narrow.png', fullPage: true });
      await page.evaluate(() => {
        document.documentElement.lang = 'en';
        const source = window.inboxDemo.fixture.workspaces;
        source.set({ ...source.getSnapshot(), items: [...source.getSnapshot().items] });
      });
      const english = page.getByRole('complementary', { name: 'Settled session status' });
      await english.waitFor();
      await english.getByRole('button', { name: 'Move to inbox', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    });
    await writeFile('outputs/settled-notice-check.json', JSON.stringify({ version, sessionScoped: true,
      beforeOriginalComposer: true, actualSettlementTimestamp: true, unknownTimestampOmitted: true,
      restorePreservesDraftAndComposer: true, failedRestoreRetriable: true, pendingRestoreDeduplicated: true,
      newActivityRemovesNotice: true, noNoticeForOrdinaryOrDraftSessions: true, narrowWidth: 320,
      appearances: ['light', 'dark'], locales: ['zh', 'en'],
      scope: 'real plugin in background Chrome; composer seat uses a simulated host layout' }, null, 2) + '\n');
  } finally { await page.close(); }
}
