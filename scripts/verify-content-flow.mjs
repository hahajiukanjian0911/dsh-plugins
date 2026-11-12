import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Exercise the free-space/overflow boundary with real components and an isolated
// host fixture. No real DSH sessions or native desktop input are used here.
export async function verifyContentFlow(browser, url, check, failures, version) {
  const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(url);
  await page.locator('[data-session-id="current"]').waitFor();
  await page.evaluate(() => { window.flowTemplate = window.inboxDemo.fixture.sessions.getSnapshot().byId.current; });
  const outer = page.locator('.dsi-content-scroll');
  const heading = page.locator('.dsi-shelf-settled .dsi-shelf-toggle');
  const samples = [];
  let sequence = 0;
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function populate(live, history, expanded) {
    await page.evaluate(async ({ live, history, sequence }) => {
      const { fixture, actions } = window.inboxDemo;
      const liveIds = Array.from({ length: live }, (_, i) => `flow-${sequence}-live-${i}`);
      const historyIds = Array.from({ length: history }, (_, i) => `flow-${sequence}-history-${i}`);
      const ids = [...liveIds, ...historyIds];
      const template = window.flowTemplate;
      fixture.status.set(new Map());
      fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), pinnedSessionIds: [], archivedSessionIds: [],
        items: [{ workspaceId: 'dsh-plugins', title: 'dsh-plugins', path: template.cwd, sessionIds: ids }] });
      fixture.sessions.set({ phase: 'ready', ids, byId: Object.fromEntries(ids.map((id, i) => [id, {
        ...template, id, displayTitle: i < live ? '待处理 ' + (i + 1) : '已收起 ' + (i - live + 1),
        updatedAt: Date.now() - (i + 1) * 300000, retainedBy: { mainView: i === 0 && live > 0 ? 1 : 0 },
      }])) });
      for (const id of historyIds) await actions.settle(id, []);
    }, { live, history, sequence: ++sequence });
    await heading.waitFor();
    if ((await heading.getAttribute('aria-expanded') === 'true') !== expanded) {
      // Keep the viewport at its natural origin; clicking an offscreen locator
      // through Playwright would first scroll the collapsed heading into view.
      await heading.evaluate(node => node.click());
    }
    await outer.evaluate(node => { node.scrollTop = 0; });
    await frames();
  }
  async function geometry(label) {
    const value = await page.evaluate(() => {
      const box = selector => {
        const { top, bottom, height } = document.querySelector(selector).getBoundingClientRect();
        return { top, bottom, height };
      };
      const scroll = document.querySelector('.dsi-content-scroll');
      const rows = document.querySelectorAll('.dsi-shelf-settled .dsi-card');
      return { shell: box('.preview-native-root'), outer: box('.dsi-content-scroll'),
        active: box('.dsi-active-content'), shelf: box('.dsi-shelf-settled'),
        heading: box('.dsi-shelf-settled .dsi-shelf-toggle'), footer: box('.preview-native-foot'),
        lastBottom: rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom : null,
        freeSpace: parseFloat(getComputedStyle(document.querySelector('.dsi-shelves')).marginTop),
        scrollRange: scroll.scrollHeight - scroll.clientHeight,
        padding: parseFloat(getComputedStyle(scroll).paddingTop) + parseFloat(getComputedStyle(scroll).paddingBottom),
        shelvesHeight: document.querySelector('.dsi-shelves').getBoundingClientRect().height,
        nestedScrollers: [...scroll.querySelectorAll('*')].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY)).length };
    });
    samples.push({ label, ...value });
    return value;
  }
  try {
    await check('short history uses its actual height and consumes remaining space instead of reserving half the sidebar', async () => {
      await populate(1, 2, false);
      const collapsed = await geometry('one active, two history, collapsed');
      assert.ok(Math.abs(collapsed.heading.bottom - collapsed.footer.top) <= 1);
      await heading.click();
      await frames();
      const two = await geometry('one active, two history, expanded');
      assert.ok(Math.abs(two.shelf.bottom - two.footer.top) <= 4, JSON.stringify({ collapsed, two }));
      assert.ok(two.lastBottom <= two.footer.top && two.lastBottom > two.footer.top - 8);
      assert.ok(Math.abs(collapsed.heading.top - two.heading.top - (two.shelvesHeight - collapsed.shelvesHeight)) <= 1);
      assert.ok(two.freeSpace > 0);
      assert.equal(two.scrollRange, 0);
      assert.equal(two.nestedScrollers, 0);
      await populate(1, 8, true);
      const eight = await geometry('one active, eight history, expanded');
      assert.ok(eight.heading.top < two.heading.top - 200);
      assert.ok(Math.abs(eight.lastBottom - two.lastBottom) <= 1);
      assert.equal(eight.scrollRange, 0);
      await page.mouse.move(359, 840);
      await page.screenshot({ path: 'outputs/sidebar-flow-short-light.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'outputs/sidebar-flow-short-dark.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'light' });
    });
    await check('overflowing history removes the empty space and grows downward in the same scroll viewport', async () => {
      await populate(1, 30, true);
      const value = await geometry('one active, thirty history, expanded');
      assert.equal(value.freeSpace, 0);
      assert.ok(Math.abs(value.shelf.top - value.active.bottom - 7) <= 1);
      assert.ok(value.scrollRange > 400, JSON.stringify(value));
      assert.equal(value.nestedScrollers, 0);
      await outer.evaluate(node => { node.scrollTop = node.scrollHeight; });
      const end = await geometry('history scrolled to end');
      assert.ok(end.lastBottom <= end.footer.top && end.lastBottom > end.footer.top - 8);
      await page.mouse.move(359, 840);
      await page.screenshot({ path: 'outputs/sidebar-flow-overflow-light.png', fullPage: true });
      await outer.evaluate(node => { node.scrollTop = 0; });
    });
    await check('an already overflowing inbox appends collapsed and expanded history without taking space from inbox rows', async () => {
      await populate(25, 2, false);
      const collapsed = await geometry('twenty-five active, collapsed');
      assert.equal(collapsed.freeSpace, 0);
      assert.ok(collapsed.heading.top > collapsed.footer.top);
      await heading.evaluate(node => node.click());
      await frames();
      const expanded = await geometry('twenty-five active, expanded');
      assert.equal(expanded.active.height, collapsed.active.height);
      assert.equal(expanded.shelf.top, collapsed.shelf.top);
      assert.ok(Math.abs(expanded.scrollRange - collapsed.scrollRange - expanded.shelvesHeight + collapsed.shelvesHeight) <= 1);
      assert.equal(expanded.nestedScrollers, 0);
    });
    await check('the fit-to-overflow boundary has no reserved panel height, overlap or extra scrollbar', async () => {
      await populate(1, 8, true);
      const baseline = await geometry('threshold baseline');
      const natural = baseline.padding + baseline.active.height + baseline.shelvesHeight;
      const chrome = baseline.shell.height - baseline.outer.height;
      for (const delta of [2, -2]) {
        await page.locator('.preview-native-root').evaluate((node, height) => { node.style.height = height + 'px'; }, natural + chrome + delta);
        await frames();
        const value = await geometry(delta > 0 ? 'two pixels free' : 'two pixels overflowing');
        if (delta > 0) { assert.ok(value.freeSpace >= 1); assert.equal(value.scrollRange, 0); }
        else { assert.equal(value.freeSpace, 0); assert.ok(value.scrollRange >= 1 && value.scrollRange <= 3); }
        assert.ok(value.shelf.top >= value.active.bottom + 6);
        assert.equal(value.nestedScrollers, 0);
      }
    });
    await writeFile('outputs/content-flow-check.json', JSON.stringify({ version, singleScrollViewport: true,
      contentDrivenFreeSpace: true, samples, scope: 'real plugin in background Chrome with isolated host fixture' }, null, 2) + '\n');
  } finally { await page.close(); }
}
