import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const url = pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const checks = [], errors = [], motion = [];
let page;
const row = id => page.locator('.dsi-card[data-session-id="' + id + '"]');
const order = () => page.locator('.dsi-primary .dsi-card').evaluateAll(nodes => nodes.map(node => node.dataset.sessionId));
async function fresh(options = {}) {
  await page?.close();
  page = await browser.newPage({ viewport: { width: 520, height: 850 }, reducedMotion: 'reduce', ...options });
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await row('current').waitFor();
}
async function begin(id) {
  const bounds = await row(id).boundingBox();
  await page.mouse.move(bounds.x + 100, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + bounds.height / 2 + 8, { steps: 3 });
  await page.locator('[data-sidebar-dragging=true]').waitFor();
  return bounds;
}
async function check(name, action) { await action(); checks.push(name); console.log('PASS ' + name); }
try {
  await check('T3 six-pixel threshold preserves a normal click and starts only beyond the threshold', async () => {
    await fresh();
    const source = await row('working').boundingBox();
    await page.mouse.move(source.x + 100, source.y + 30); await page.mouse.down();
    await page.mouse.move(source.x + 100, source.y + 35);
    assert.equal(await page.locator('[data-sidebar-dragging=true]').count(), 0);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId), 'working');
    await begin('result');
    assert.equal(await page.locator('[data-dragging=true]').count(), 1);
    await page.keyboard.press('Escape'); await page.mouse.up();
  });
  for (const theme of ['light', 'dark']) {
    await check('real row follows the pointer while peers project a slot, with continuous per-frame DOM visibility in ' + theme, async () => {
      await fresh({ colorScheme: theme, reducedMotion: 'no-preference' });
      await page.evaluate(() => {
        window.dragSource = document.querySelector('[data-session-id="working"]');
        window.nativeDragStarts = 0;
        document.addEventListener('dragstart', () => window.nativeDragStarts++);
        window.dragSamples = [];
        window.sampleDrag = true;
        const sample = () => {
          if (!window.sampleDrag) return;
          const source = document.querySelector('[data-session-id="working"]');
          const bounds = source?.getBoundingClientRect();
          window.dragSamples.push({ at: performance.now(), y: bounds?.y, height: bounds?.height,
            sameNode: source === window.dragSource,
            visible: Boolean(source && getComputedStyle(source).visibility !== 'hidden' && bounds.height > 0) });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const target = await row('answer').boundingBox();
      await begin('working');
      await page.mouse.move(target.x + 100, target.y + target.height / 2, { steps: 16 });
      await page.waitForTimeout(240);
      assert.equal(await row('working').getAttribute('draggable'), 'false');
      assert.equal(await row('working').evaluate(node => node === window.dragSource), true);
      assert.ok(await page.locator('.dsi-sortable-slot').evaluateAll(nodes => nodes.some(node =>
        node.dataset.sortableId !== 'working' && node.style.transform.includes('translate3d'))));
      await page.screenshot({ path: 'outputs/t3-pointer-drag-' + theme + '.png' });
      await page.mouse.up();
      await page.waitForTimeout(260);
      const ids = await order();
      assert.equal(ids.indexOf('working') + 1, ids.indexOf('answer'));
      const frames = await page.evaluate(() => { window.sampleDrag = false; return window.dragSamples; });
      assert.ok(frames.length > 8);
      assert.ok(frames.every(frame => frame.visible && frame.sameNode));
      assert.equal(await page.evaluate(() => window.nativeDragStarts), 0);
      const tail = frames.slice(-5).map(frame => frame.y);
      assert.ok(Math.max(...tail) - Math.min(...tail) < .5);
      motion.push({ theme, frames });
    });
  }
  await check('Escape rolls back the preview and leaves the next click usable', async () => {
    await fresh(); const before = await order();
    const target = await row('answer').boundingBox(); await begin('working');
    await page.mouse.move(target.x + 100, target.y + 20, { steps: 12 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await order(), before);
    assert.equal(await page.locator('[data-sidebar-dragging=true]').count(), 0);
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().undo), null);
    await row('result').locator('.dsi-card-main').click();
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId), 'result');
  });
  await check('leaving the sidebar, window blur and zero-button release cancel without stale drops', async () => {
    for (const kind of ['outside', 'blur', 'zero']) {
      await fresh(); const before = await order(); const source = await begin('working');
      if (kind === 'outside') {
        const bounds = await page.locator('.dsi-root').boundingBox();
        await page.mouse.move(bounds.x + bounds.width + 50, source.y + 20, { steps: 10 });
      } else if (kind === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      else await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 1, buttons: 0, clientX: 220, clientY: 300, bubbles: true, cancelable: true,
      })));
      await page.mouse.up();
      assert.deepEqual(await order(), before, kind);
      assert.equal(await page.locator('[data-sidebar-dragging=true]').count(), 0, kind);
    }
  });
  await check('edge autoscroll works with a stationary pointer over long history and stops on cancel', async () => {
    await fresh();
    await page.evaluate(async () => {
      const { fixture, actions } = window.inboxDemo;
      const source = fixture.sessions.getSnapshot();
      const ids = Array.from({ length: 70 }, (_, i) => 'drag-history-' + i);
      fixture.sessions.set({ ...source, ids: [...source.ids, ...ids], byId: { ...source.byId,
        ...Object.fromEntries(ids.map((id, index) => [id, { ...source.byId.old, id,
          displayTitle: '历史 ' + index, retainedBy: {}, updatedAt: Date.now() - 86400000 * (index + 1) }])) } });
      for (const id of ids) await actions.settle(id, []);
      actions.dismissUndo();
    });
    await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
    await begin('working');
    const footer = await page.locator('.preview-native-foot').boundingBox();
    await page.mouse.move(220, footer.y - 8, { steps: 15 });
    await page.waitForFunction(() => document.querySelector('.dsi-content-scroll').scrollTop > 20);
    await page.keyboard.press('Escape'); await page.mouse.up();
    const before = await page.locator('.dsi-content-scroll').evaluate(node => node.scrollTop);
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.dsi-content-scroll').evaluate(node => node.scrollTop), before);
    assert.notEqual(await row('working').getAttribute('data-section'), 'settled');
  });
  await check('settled history can be dragged into an empty active section without changing the current draft', async () => {
    await fresh();
    await page.evaluate(async () => {
      const { fixture, actions } = window.inboxDemo;
      fixture.status.set(new Map()); fixture.finish('working');
      for (const id of [...fixture.sessions.getSnapshot().ids]) await actions.settle(id, []);
      actions.dismissUndo();
    });
    const current = await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId);
    await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
    const first = await page.locator('.dsi-shelf-settled [data-session-id]').first().getAttribute('data-session-id');
    await begin(first);
    const bounds = await page.locator('.dsi-header-tools').boundingBox();
    await page.mouse.move(bounds.x + 120, bounds.y + bounds.height + 66, { steps: 14 });
    await page.mouse.up();
    await page.waitForFunction(id => document.querySelector('.dsi-primary [data-session-id="' + id + '"]'), first);
    assert.equal(await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId), current);
  });
  assert.deepEqual(errors, []);
  await writeFile('outputs/t3-drag-check.json', JSON.stringify({ version, checks, errors,
    sourceCommit: '5d5ab80a685774f3911c32d842b02a512e60d8ce', motion,
    scope: 'Real pointer events in headless Chrome, using the shipped plugin and isolated DSH fixture; native DSH gestures remain unverified' }, null, 2) + '\n');
} finally { await browser.close(); }
