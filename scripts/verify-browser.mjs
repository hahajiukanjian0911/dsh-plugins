import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { verifyContentFlow } from './verify-content-flow.mjs';
import { verifyWorkingInbox } from './verify-working-inbox.mjs';
import { verifySettledNotice } from './verify-settled-notice.mjs';
import { verifyDesktopUpdate } from './verify-desktop-update.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
const failures = [];
const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
page.on('pageerror', (error) => failures.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
const url = pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
async function check(name, operation) {
  await operation();
  results.push(name);
  console.log('PASS ' + name);
}
try {
  await page.goto(url);
  await page.locator('[data-session-id="result"]').waitFor();
  await check('top row shares window controls, collapse and brand above the session toolbar', async () => {
    const caption = await page.locator('.preview-native-caption').boundingBox();
    const controls = await page.locator('.preview-window-controls').boundingBox();
    const brand = await page.locator('.preview-native-brand').boundingBox();
    const identity = await page.locator('.preview-brand-identity').boundingBox();
    const name = await page.locator('.dsi-brand-name').boundingBox();
    const toggle = await page.getByRole('button', { name: 'Toggle sidebar' }).boundingBox();
    const toolbar = await page.locator('.dsi-toolbar').boundingBox();
    assert.equal(caption.height, 32);
    assert.equal(brand.height, 32);
    assert.ok(Math.abs(toggle.y + toggle.height / 2 - caption.y - caption.height / 2) <= 1);
    assert.equal(brand.y, caption.y);
    assert.ok(toggle.x >= controls.x + controls.width + 8);
    assert.ok(brand.x >= toggle.x + toggle.width);
    assert.ok(name.width > 65 && name.x + name.width <= identity.x + identity.width + 1,
      'the native brand wrapper must keep the full DeepSeek name visible');
    assert.equal(toolbar.y, caption.y + caption.height);
    assert.equal(await page.getByRole('button', { name: '新建会话', exact: true }).count(), 1);
    assert.match(await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').backdropFilter), /blur\(/);
    assert.equal(await page.locator('.dsi-header-tools').evaluate(node => getComputedStyle(node).backdropFilter), 'none');
    const contentEdges = await page.evaluate(() => {
      const shell = document.querySelector('.preview-native-root').getBoundingClientRect();
      const header = document.querySelector('.dsi-header-tools').getBoundingClientRect();
      const card = document.querySelector('.dsi-card').getBoundingClientRect();
      return { headerStart: header.left - shell.left, headerEnd: shell.right - header.right,
        cardStart: card.left - shell.left, cardEnd: shell.right - card.right };
    });
    assert.deepEqual(contentEdges, { headerStart: 8, headerEnd: 8, cardStart: 8, cardEnd: 8 });
    const surface = await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::after').backgroundColor),
      await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').backgroundColor));
    assert.equal(await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::after').backdropFilter),
      await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').backdropFilter));
    assert.equal(await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('.dsi-shelf-settled .dsi-shelf-toggle').evaluate(node => getComputedStyle(node).backdropFilter), 'none');
    assert.equal(await page.locator('.preview-native-root').getAttribute('data-dsi-glass-shelf'), '');
  });
  await check('native management actions and account share a compact footer and remain wired', async () => {
    const panels = await page.getByRole('navigation', { name: '全局面板' }).boundingBox();
    const row = await page.locator('[data-session-id="current"]').boundingBox();
    const account = await page.getByRole('button', { name: '账号菜单' }).boundingBox();
    assert.ok(panels.y > row.y + row.height);
    assert.ok(Math.abs(account.y + account.height / 2 - panels.y - panels.height / 2) <= 1);
    assert.ok(account.x + account.width <= panels.x);
    assert.equal(panels.height, 40);
    assert.equal((await page.locator('.preview-native-foot').boundingBox()).height, 40);
    assert.equal(await page.locator('.preview-native-foot').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await page.getByRole('navigation', { name: '全局面板' }).evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.getByRole('button', { name: '插件', exact: true }).click();
    assert.equal(await page.evaluate(() => window.inboxDemo.fixture.ctx.layout.panelInfo.getSnapshot().activePanelId), 'plugins');
    await page.getByRole('button', { name: '自动化任务', exact: true }).click();
    assert.equal(await page.evaluate(() => window.inboxDemo.fixture.ctx.layout.panelInfo.getSnapshot().activePanelId), 'schedules');
    await page.getByRole('button', { name: '更多', exact: true }).click();
    assert.equal(await page.evaluate(() => window.inboxDemo.moreOpened), true);
    await page.getByRole('button', { name: '账号菜单' }).click();
    assert.equal(await page.evaluate(() => window.inboxDemo.accountOpened), true);
    await page.evaluate(() => window.inboxDemo.fixture.ctx.layout.panelInfo.set({ activePanelId: null }));
  });
  await check('initial unread result and request use the real plugin component', async () => {
    assert.equal(await page.locator('[data-session-id="result"] .dsi-unread-title').count(), 1);
    assert.equal(await page.locator('[data-session-id="answer"]').getByText('待回复').count(), 1);
  });
  await mkdir('outputs', { recursive: true });
  await page.mouse.move(359, 840);
  await page.screenshot({ path: 'outputs/sidebar-light.png', fullPage: true });
  await check('reading a result clears unread and retains it in the inbox', async () => {
    await page.locator('[data-session-id="result"] .dsi-card-main').click();
    await page.waitForFunction(() => document.querySelector('[data-session-id="result"] .dsi-unread-title') === null);
    assert.equal(await page.locator('[data-session-id="result"]').getAttribute('data-section'), 'inbox');
  });
  await check('settle removes the current item and opens the next inbox item', async () => {
    const row = page.locator('[data-session-id="result"]');
    await row.hover();
    await row.getByRole('button', { name: '收起', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.dsi-primary [data-session-id="result"]'));
    const id = await page.evaluate(() => window.inboxDemo.hooks.inbox.getSnapshot().currentId);
    assert.notEqual(id, 'result');
  });
  await check('native Cmd+K request expands the rail and focuses search', async () => {
    await page.evaluate(() => window.inboxDemo.setWide(false));
    await page.locator('.dsi-rail').waitFor();
    assert.equal(await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').content), 'none');
    assert.equal(await page.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::after').content), 'none');
    await page.evaluate(() => window.inboxDemo.search());
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '搜索会话');
  });
  await check('search finds snoozed and settled sessions', async () => {
    await page.getByRole('searchbox').fill('侧栏交互');
    await page.locator('[data-session-id="later"]').waitFor();
    assert.equal(await page.getByText('没有匹配的会话', { exact: true }).count(), 0);
    await page.getByRole('searchbox').fill('');
  });
  await check('message-content search includes a session whose title does not match', async () => {
    await page.getByRole('searchbox').fill('消息关键字');
    await page.locator('[data-session-id="working"] .dsi-snippet').waitFor();
    assert.equal(await page.getByText('这里包含消息关键字。', { exact: true }).count(), 1);
    await page.getByRole('searchbox').fill('');
  });
  await check('snooze popover stays inside the viewport and saves a future reminder', async () => {
    const row = page.locator('[data-session-id="current"]');
    await row.hover();
    await row.getByRole('button', { name: '稍后提醒', exact: true }).click();
    const menu = page.getByRole('dialog', { name: '稍后提醒' });
    await menu.waitFor();
    const box = await menu.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 360 && box.y + box.height <= 850);
    await menu.getByRole('button', { name: '1 小时后' }).click();
    await page.waitForFunction(() => window.inboxDemo.hooks.inbox.getSnapshot().rows
      .find((row) => row.id === 'current').section === 'snoozed');
  });
  await check('a new pending request wakes a snoozed session', async () => {
    await page.evaluate(() => {
      const source = window.inboxDemo.fixture.status;
      const next = new Map(source.getSnapshot());
      next.set('current', { running: false, pendingInteraction: { kind: 'approval' } });
      source.set(next);
    });
    await page.locator('.dsi-primary [data-session-id="current"]').waitFor();
  });
  await check('long unbroken titles and project names do not overflow at 280px', async () => {
    await page.setViewportSize({ width: 280, height: 850 });
    await page.evaluate(() => {
      const source = window.inboxDemo.fixture.sessions;
      const value = source.getSnapshot();
      source.set({ ...value, byId: { ...value.byId,
        current: { ...value.byId.current, displayTitle: '非常长的会话标题🙂'.repeat(20) } } });
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await page.setViewportSize({ width: 360, height: 850 });
  await page.mouse.move(359, 840);
  await page.evaluate(() => {
    const source = window.inboxDemo.fixture.sessions;
    const value = source.getSnapshot();
    source.set({ ...value, byId: { ...value.byId,
      current: { ...value.byId.current, displayTitle: '实现会话收件箱' } } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'outputs/sidebar-dark.png', fullPage: true });
  await check('empty inbox renders without errors', async () => {
    await page.evaluate(() => window.inboxDemo.fixture.sessions.set({ phase: 'ready', ids: [], byId: {} }));
    await page.getByText('暂无待处理会话', { exact: true }).waitFor();
  });
  const review = await browser.newPage({ viewport: { width: 280, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  review.on('pageerror', (error) => failures.push(error.message));
  await review.goto(url);
  await review.locator('[data-session-id="answer"]').waitFor();
  await check('important states remain visible and separate from hover and keyboard actions at 280px', async () => {
    await review.evaluate(() => {
      for (const listener of window.inboxDemo.fixture.events.get('api-session/error') ?? []) listener('current', 'Example failure');
    });
    for (const id of ['answer', 'result', 'working', 'current']) {
      const row = review.locator('[data-session-id="' + id + '"]');
      await row.hover();
      const status = row.locator('.dsi-status');
      assert.equal(await status.isVisible(), true);
      const stateBox = await status.boundingBox();
      const actionsBox = await row.locator('.dsi-row-actions').boundingBox();
      assert.ok(stateBox.y + stateBox.height <= actionsBox.y + 1);
      await row.locator('.dsi-row-actions button:enabled').first().focus();
      assert.equal(await status.isVisible(), true);
    }
  });
  await review.setViewportSize({ width: 360, height: 850 });
  await review.evaluate(async () => {
    const { fixture, actions } = window.inboxDemo;
    const value = fixture.sessions.getSnapshot();
    const ids = Array.from({ length: 24 }, (_, index) => 'history-' + index);
    fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), items: fixture.workspaces.getSnapshot().items.map(item =>
      item.workspaceId === 'TimeRing' ? { ...item, sessionIds: [...item.sessionIds, ...ids] } : item) });
    fixture.sessions.set({ ...value, ids: [...value.ids, ...ids], byId: { ...value.byId,
      ...Object.fromEntries(ids.map((id, index) => [id, { ...value.byId.old, id, retainedBy: { mainView: 0 },
        displayTitle: '历史会话 ' + (index + 1), updatedAt: Date.now() - (index + 2) * 86400000 }])) } });
    for (const id of ids) await actions.settle(id, []);
  });
  await review.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
  await check('settled rows put icon title and date on one line with project names in tooltips', async () => {
    const first = review.locator('.dsi-shelf-settled .dsi-card').first();
    const rows = review.locator('.dsi-shelf-settled .dsi-card');
    assert.equal(await review.locator('.dsi-shelf-settled .dsi-meta').count(), 0);
    assert.equal(await review.locator('.dsi-shelf-settled .dsi-history-project').count(), await rows.count());
    assert.match(await first.locator('.dsi-card-main').getAttribute('title'), /TimeRing/);
    assert.match(await first.locator('.dsi-card-main').getAttribute('aria-label'), /TimeRing/);
    assert.equal(await first.locator('.dsi-status').isVisible(), true);
    assert.equal(await rows.nth(1).locator('.dsi-status').isVisible(), true);
    assert.equal(await first.locator('.dsi-title').evaluate(node => getComputedStyle(node).fontWeight), '400');
    assert.equal(await first.locator('.dsi-status').evaluate(node => getComputedStyle(node).color),
      await first.locator('.dsi-title').evaluate(node => getComputedStyle(node).color));
    assert.equal((await first.boundingBox()).height, 34);
    const title = await first.locator('.dsi-title').boundingBox();
    const time = await first.locator('.dsi-status').boundingBox();
    assert.ok(Math.abs(title.y + title.height / 2 - time.y - time.height / 2) <= 1);
    assert.ok(title.x + title.width + 7 <= time.x);
  });
  await check('compact history keeps title and date fixed on hover and restores to the full inbox row', async () => {
    await review.evaluate(() => {
      const source = window.inboxDemo.fixture.sessions;
      const value = source.getSnapshot();
      source.set({ ...value, byId: { ...value.byId, 'history-22': { ...value.byId['history-22'],
        displayTitle: '一个非常长的历史会话标题🙂'.repeat(12) } } });
    });
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await review.mouse.move(359, 840);
    await review.screenshot({ path: 'outputs/sidebar-history-light.png', fullPage: true });
    await review.emulateMedia({ colorScheme: 'dark' });
    await review.screenshot({ path: 'outputs/sidebar-history-dark.png', fullPage: true });
    await review.setViewportSize({ width: 280, height: 850 });
    const row = review.locator('[data-session-id="history-22"]');
    await row.scrollIntoViewIfNeeded();
    const title = await row.locator('.dsi-title').boundingBox();
    const time = await row.locator('.dsi-status').boundingBox();
    await row.hover();
    assert.deepEqual(await row.locator('.dsi-title').boundingBox(), title);
    assert.deepEqual(await row.locator('.dsi-status').boundingBox(), time);
    const restore = row.getByRole('button', { name: '移回待处理', exact: true });
    assert.equal(await restore.isVisible(), true);
    const action = await restore.boundingBox();
    assert.ok(action.x + action.width <= title.x + 1);
    assert.equal(await row.locator('.dsi-title').evaluate(node => getComputedStyle(node).textOverflow), 'ellipsis');
    assert.equal(await review.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await restore.click();
    const restored = review.locator('.dsi-primary [data-session-id="history-22"]');
    await restored.waitFor();
    assert.equal(await restored.locator('.dsi-project').getByText('TimeRing', { exact: true }).count(), 1);
    const meta = await restored.locator('.dsi-meta').boundingBox();
    assert.ok((await restored.locator('.dsi-title').boundingBox()).y >= meta.y + meta.height);
    await writeFile('outputs/compact-history-check.json', JSON.stringify({ version, rowHeight: 34,
      singleLine: true, projectInTooltipAndAccessibleName: true, timeAlwaysVisible: true,
      hoverKeepsTitleAndTimePosition: true, restoreReturnsFullMetadataRow: true,
      narrowWidth: 280, appearances: ['light', 'dark'] }, null, 2) + '\n');
    await review.emulateMedia({ colorScheme: 'light' });
    await review.setViewportSize({ width: 360, height: 850 });
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 0; });
  });
  await check('overflowing sections share one scrolling flow and the settled heading reaches the search glass', async () => {
    const outer = review.locator('.dsi-content-scroll');
    const heading = review.locator('.dsi-shelf-settled .dsi-shelf-toggle');
    const panel = await review.locator('.preview-native-root').boundingBox();
    const header = await review.locator('.dsi-header-tools').boundingBox();
    const initial = await heading.boundingBox();
    assert.equal(await review.locator('.dsi-shelves').evaluate(node => getComputedStyle(node).marginTop), '0px');
    assert.equal(initial.x, panel.x);
    assert.equal(initial.width, panel.width);
    await review.mouse.move(359, 840);
    await review.screenshot({ path: 'outputs/sidebar-list-light.png', fullPage: true });
    await review.emulateMedia({ colorScheme: 'dark' });
    await review.screenshot({ path: 'outputs/sidebar-list-dark.png', fullPage: true });
    const live = review.locator('.dsi-primary .dsi-card').first();
    const liveBefore = await live.boundingBox();
    await review.mouse.move(initial.x + 150, initial.y + 50);
    await review.mouse.wheel(0, 180);
    await review.waitForFunction(() => document.querySelector('.dsi-content-scroll').scrollTop >= 170);
    const raised = await heading.boundingBox();
    assert.ok(raised.y < initial.y - 100);
    assert.ok((await live.boundingBox()).y < liveBefore.y - 100);
    await outer.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const pinned = await heading.boundingBox();
    assert.ok(Math.abs(pinned.y - header.y - header.height) <= 1, JSON.stringify({ pinned, header, scroll: await outer.evaluate(node => ({ top: node.getBoundingClientRect().top, offset: node.scrollTop, height: node.clientHeight, content: node.scrollHeight, inset: getComputedStyle(node).getPropertyValue('--dsi-glass-inset') })) }));
    assert.equal(await heading.evaluate(node => getComputedStyle(node).borderRadius), '0px');
    await review.screenshot({ path: 'outputs/sidebar-settled-raised-dark.png', fullPage: true });
    await review.emulateMedia({ colorScheme: 'light' });
    await review.screenshot({ path: 'outputs/sidebar-settled-raised-light.png', fullPage: true });
    await outer.evaluate(node => { node.scrollTop = 0; });
    assert.deepEqual(await heading.boundingBox(), initial);
  });
  await check('glass inset preserves focus and geometry without overlay fades', async () => {
    await review.locator('.dsi-shelf-settled .dsi-card').nth(4).locator('.dsi-card-main').focus();
    const before = await review.locator('.dsi-content-scroll').evaluate(node => node.scrollTop);
    await review.keyboard.press('Tab');
    assert.equal(await review.locator('.dsi-content-scroll').evaluate(node => getComputedStyle(node, '::before').content), 'none');
    assert.equal(await review.locator('.dsi-shelf-settled .dsi-shelf-toggle').evaluate(node => getComputedStyle(node, '::after').content), 'none');
    assert.equal(await review.locator('.dsi-content-scroll').evaluate(node => node.scrollTop), before);
    await review.getByRole('searchbox').focus();
    assert.equal(await review.locator('.dsi-content-scroll').evaluate(node => node.scrollTop), before);
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 0; });
  });
  await check('header and settled heading use one material plane and merge into the same pixels as a single rectangle', async () => {
    // The material comparison excludes the focused search ring. Chromium can
    // antialias its rounded corners differently after replacing a clip primitive.
    await review.getByRole('searchbox').evaluate(node => node.blur());
    const samples = [];
    const distance = await review.locator('.preview-native-root').evaluate(node =>
      parseFloat(getComputedStyle(node).getPropertyValue('--dsi-material-join-distance')));
    for (const offset of [0, distance / 3, distance - 10, distance + 1, 100000]) {
      await review.locator('.dsi-content-scroll').evaluate((node, offset) => { node.scrollTop = offset; }, offset);
      await review.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const sample = await review.evaluate(() => {
        const shell = document.querySelector('.preview-native-root');
        const heading = document.querySelector('.dsi-shelf-settled .dsi-shelf-toggle');
        const material = getComputedStyle(shell, '::before');
        const bounds = heading.getBoundingClientRect();
        return { offset: document.querySelector('.dsi-content-scroll').scrollTop,
          headingTop: bounds.top - shell.getBoundingClientRect().top,
          clip: material.clipPath, timeline: material.animationTimeline,
          headingFilter: getComputedStyle(heading).backdropFilter,
          headingReceivesPointer: document.elementFromPoint(bounds.left + 20, bounds.top + 16)?.closest('.dsi-shelf-toggle') === heading };
      });
      assert.equal(sample.headingFilter, 'none');
      assert.equal(sample.headingReceivesPointer, true);
      assert.match(sample.timeline, /dsi-history-glass/);
      const clipHeading = Number.parseFloat(sample.clip.split(',')[4].trim().split(' ').at(-1));
      assert.ok(Math.abs(clipHeading - sample.headingTop) <= 1, JSON.stringify(sample));
      samples.push(sample);
    }
    const appearances = [];
    for (const colorScheme of ['light', 'dark']) {
      await review.emulateMedia({ colorScheme });
      await review.mouse.move(359, 840);
      // Compare settled paints after the theme change, not two adjacent theme frames.
      await review.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const actual = await review.screenshot({ omitBackground: true });
      const reference = await review.addStyleTag({ content: '.preview-native-root::before { animation: none !important; clip-path: inset(0 0 calc(100% - var(--dsi-glass-height) - var(--dsi-material-shelf-height)) 0) !important; }' });
      const rectangle = await review.screenshot({ omitBackground: true });
      const pixels = await review.evaluate(async ({ actual, rectangle }) => {
        const images = await Promise.all([actual, rectangle].map(async base64 => {
          const image = new Image();
          image.src = 'data:image/png;base64,' + base64;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height);
        }));
        const shell = document.querySelector('.preview-native-root').getBoundingClientRect();
        const heading = document.querySelector('.dsi-shelf-settled .dsi-shelf-toggle').getBoundingClientRect();
        // Compare the whole material interior, including the former join.
        // Different clip primitives can antialias their outside edge differently.
        let comparedPixels = 0, differentPixels = 0, maxDifference = 0;
        const changedPixels = [];
        for (let y = Math.ceil(shell.top + 12); y < Math.floor(heading.bottom - 1); y++) {
          for (let x = Math.ceil(shell.left + 12); x < Math.floor(shell.right - 12); x++) {
            const offset = (y * images[0].width + x) * 4;
            let difference = 0;
            for (let channel = 0; channel < 4; channel++) difference = Math.max(difference,
              Math.abs(images[0].data[offset + channel] - images[1].data[offset + channel]));
            comparedPixels++;
            if (difference) {
              differentPixels++;
              if (changedPixels.length < 16) changedPixels.push({ x, y,
                actual: [...images[0].data.slice(offset, offset + 4)], reference: [...images[1].data.slice(offset, offset + 4)] });
            }
            maxDifference = Math.max(maxDifference, difference);
          }
        }
        return { comparedPixels, differentPixels, maxDifference, changedPixels };
      }, { actual: actual.toString('base64'), rectangle: rectangle.toString('base64') });
      assert.equal(pixels.differentPixels, 0, 'continuous material interior in ' + colorScheme + ': ' + JSON.stringify(pixels));
      await reference.evaluate(node => node.remove());
      await writeFile('outputs/sidebar-unified-glass-' + colorScheme + '.png', actual);
      appearances.push({ colorScheme, interiorIdenticalToSingleRectangle: true, ...pixels });
    }
    await writeFile('outputs/unified-glass-check.json', JSON.stringify({ version, samples, appearances,
      singleBackdropFilterForHeaderAndSettled: true, nativeScrollTimeline: true }, null, 2) + '\n');
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 0; });
  });
  await check('overflowing content keeps natural section positions at different sizes without resizing controls or scrollbars', async () => {
    const shelf = review.locator('.dsi-shelf-settled');
    const outer = review.locator('.dsi-content-scroll');
    const heading = review.locator('.dsi-shelf-settled .dsi-shelf-toggle');
    const initial = await heading.boundingBox();
    await review.mouse.move(initial.x + 150, initial.y + 2);
    await review.mouse.down();
    await review.mouse.move(initial.x + 150, initial.y - 100, { steps: 5 });
    await review.mouse.up();
    assert.deepEqual(await heading.boundingBox(), initial);
    assert.equal(await shelf.evaluate(node => getComputedStyle(node).resize), 'none');
    assert.equal(await review.getByRole('separator').count(), 0);
    assert.equal(await outer.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    const sizes = [];
    for (const height of [520, 1020, 780]) {
      await review.locator('.preview-native-root').evaluate((node, height) => { node.style.height = height + 'px'; }, height);
      await review.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await outer.evaluate(node => { node.scrollTop = 0; });
      const panel = await shelf.boundingBox();
      assert.ok(Math.abs(panel.y - initial.y) <= 1);
      assert.equal(await review.locator('.dsi-shelves').evaluate(node => getComputedStyle(node).marginTop), '0px');
      sizes.push({ hostHeight: height, settledNaturalTop: panel.y });
    }
    await writeFile('outputs/settled-panel-check.json', JSON.stringify({ version, sizes,
      contentDriven: true, singleScrollViewport: true, wholeSectionScrollsUp: true,
      resizable: false, scrollbarHidden: true }, null, 2) + '\n');
  });
  await review.evaluate(() => window.inboxDemo.actions.open('pin'));
  await review.emulateMedia({ colorScheme: 'light' });
  await review.getByRole('searchbox').evaluate(node => node.blur());
  await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 70; });
  await review.mouse.move(359, 840);
  await check('sessions scroll behind one glass plane and cannot receive clicks through the toolbar', async () => {
    const geometry = await review.evaluate(() => {
      const shell = document.querySelector('.preview-native-root');
      const bounds = shell.getBoundingClientRect();
      const panelBottom = bounds.top + parseFloat(getComputedStyle(shell).getPropertyValue('--dsi-glass-height'));
      const title = document.querySelector('[data-session-id="pin"] .dsi-title').getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.left + 170, panelBottom - 4);
      return { panelBottom, titleBottom: title.bottom, hiddenRowReceivesPointer: !!hit.closest('[data-session-id]') };
    });
    assert.ok(geometry.titleBottom < geometry.panelBottom);
    assert.equal(geometry.hiddenRowReceivesPointer, false);
    await review.screenshot({ path: 'outputs/sidebar-glass-light.png', fullPage: true });
    await review.emulateMedia({ colorScheme: 'dark' });
    await review.screenshot({ path: 'outputs/sidebar-glass-dark.png', fullPage: true });
    await review.locator('[data-session-id="pin"] .dsi-card-main').focus();
    const card = await review.locator('[data-session-id="pin"] .dsi-card-main').boundingBox();
    const toolbar = await review.locator('.dsi-header-tools').boundingBox();
    assert.ok(card.y >= toolbar.y + toolbar.height);
  });
  await check('header error messages preserve the list reading anchor when glass height changes', async () => {
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 70; });
    const before = await review.locator('[data-session-id="working"] .dsi-title').boundingBox();
    const scrollBefore = await review.locator('.dsi-content-scroll').evaluate(node => ({ offset: node.scrollTop, height: node.clientHeight, content: node.scrollHeight, inset: getComputedStyle(node).getPropertyValue('--dsi-glass-inset') }));
    await review.evaluate(async () => {
      window.inboxDemo.fixture.ctx.uiWorkspace.pinSession = async () => { throw new Error('Example operation could not finish. '.repeat(4)); };
      try { await window.inboxDemo.actions.pin('answer'); } catch {}
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const after = await review.locator('[data-session-id="working"] .dsi-title').boundingBox();
    assert.ok(Math.abs(after.y - before.y) <= 1, JSON.stringify({ before, after, scrollBefore,
      scrollAfter: await review.locator('.dsi-content-scroll').evaluate(node => ({ offset: node.scrollTop, height: node.clientHeight, content: node.scrollHeight, inset: getComputedStyle(node).getPropertyValue('--dsi-glass-inset') })) }));
    await review.evaluate(async () => {
      window.inboxDemo.actions.dismissError();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const restored = await review.locator('[data-session-id="working"] .dsi-title').boundingBox();
    assert.ok(Math.abs(restored.y - before.y) <= 1, JSON.stringify({ before, restored,
      scroll: await review.locator('.dsi-content-scroll').evaluate(node => ({ offset: node.scrollTop, height: node.clientHeight, content: node.scrollHeight, inset: getComputedStyle(node).getPropertyValue('--dsi-glass-inset') })),
      outer: await review.locator('.dsi-content-scroll').evaluate(node => node.scrollTop) }));
  });
  await check('transparent-host backing prevents sharp session text from showing through the glass', async () => {
    await review.emulateMedia({ colorScheme: 'light' });
    const bounds = await review.locator('.preview-native-root').boundingBox();
    const panelHeight = await review.locator('.preview-native-root').evaluate(node =>
      parseFloat(getComputedStyle(node).getPropertyValue('--dsi-glass-height')));
    const png = await review.screenshot({ omitBackground: true });
    const alpha = await review.evaluate(async ({ base64, x, y, width, height }) => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(x, y, width, height).data;
      let min = 255;
      for (let index = 3; index < pixels.length; index += 4) min = Math.min(min, pixels[index]);
      return { min, outerAlpha: context.getImageData(0, canvas.height - 1, 1, 1).data[3] };
    // Sample the material interior, clear of the host's antialiased rounded corners.
    }, { base64: png.toString('base64'), x: Math.ceil(bounds.x + 12), y: Math.ceil(bounds.y + 12),
      width: Math.floor(bounds.width - 24), height: Math.floor(panelHeight - 24) });
    assert.equal(alpha.min, 255, 'the unified sidebar supplies an opaque backdrop inside the transparent host');
    assert.equal(alpha.outerAlpha, 0, 'the host outside the sidebar must remain transparent for this check');
  });
  await check('footer glass blurs scrolling rows, blocks hidden clicks and keeps focused and final rows visible', async () => {
    await review.evaluate(() => window.inboxDemo.actions.open('history-8'));
    const footerTop = await review.locator('.preview-native-foot').evaluate(node => node.getBoundingClientRect().top);
    await review.evaluate(top => {
      const scroll = document.querySelector('.dsi-content-scroll');
      const card = document.querySelector('[data-session-id="history-8"]');
      scroll.scrollTop += card.getBoundingClientRect().top - top - 6;
    }, footerTop);
    const covered = await review.locator('[data-session-id="history-8"]').boundingBox();
    assert.ok(covered.y >= footerTop && covered.y < footerTop + 40);
    assert.equal(await review.evaluate(top => !!document.elementFromPoint(170, top + 20)?.closest('[data-session-id]'), footerTop), false);
    await review.screenshot({ path: 'outputs/sidebar-footer-glass-light.png', fullPage: true });
    await review.emulateMedia({ colorScheme: 'dark' });
    await review.screenshot({ path: 'outputs/sidebar-footer-glass-dark.png', fullPage: true });
    await review.locator('[data-session-id="history-8"] .dsi-card-main').focus();
    const focused = await review.locator('[data-session-id="history-8"] .dsi-card-main').boundingBox();
    assert.ok(focused.y + focused.height <= footerTop + 1);
    await review.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
    const last = await review.locator('.dsi-shelf-settled .dsi-card-main').last().boundingBox();
    assert.ok(last.y + last.height <= footerTop + 1);
  });
  await check('increased contrast replaces the glass blur with a solid material', async () => {
    await review.emulateMedia({ contrast: 'more' });
    assert.equal(await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').backdropFilter), 'none');
    assert.equal(await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::after').backdropFilter), 'none');
    assert.equal(await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').backgroundColor),
      await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node).backgroundColor));
    assert.equal(await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::after').backgroundColor),
      await review.locator('.preview-native-root').evaluate(node => getComputedStyle(node).backgroundColor));
    assert.equal(await review.locator('.dsi-shelf-settled .dsi-shelf-toggle').evaluate(node => getComputedStyle(node).backdropFilter), 'none');
    assert.equal(await review.locator('.dsi-shelf-settled .dsi-shelf-toggle').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    await review.emulateMedia({ contrast: 'no-preference' });
  });
  await review.emulateMedia({ colorScheme: 'light' });
  await review.screenshot({ path: 'outputs/sidebar-edge-light.png', fullPage: true });
  await review.close();
  await verifyWorkingInbox(browser, url, check, failures, version);
  await verifyContentFlow(browser, url, check, failures, version);
  const folding = await browser.newPage({ viewport: { width: 360, height: 850 }, reducedMotion: 'reduce' });
  folding.on('pageerror', error => failures.push(error.message));
  await folding.goto(url);
  await folding.locator('[data-session-id="current"]').waitFor();
  await folding.evaluate(async () => {
    const { fixture, actions } = window.inboxDemo;
    const value = fixture.sessions.getSnapshot();
    fixture.sessions.set({ ...value, ids: ['old'], byId: { old: value.byId.old } });
    fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), items: fixture.workspaces.getSnapshot().items.map(item =>
      ({ ...item, sessionIds: item.workspaceId === 'TimeRing' ? ['old'] : [] })) });
    await actions.open('old');
  });
  await folding.getByText('暂无待处理会话', { exact: true }).waitFor();
  const settledToggle = folding.locator('.dsi-shelf-settled .dsi-shelf-toggle');
  await check('an active settled session can be manually collapsed with an empty inbox and stays collapsed on ordinary updates', async () => {
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'true');
    await settledToggle.click();
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'false');
    const collapsed = await settledToggle.boundingBox();
    const footer = await folding.locator('.preview-native-foot').boundingBox();
    assert.ok(Math.abs(collapsed.y + collapsed.height - footer.y) <= 1);
    assert.equal(collapsed.height, 32);
    const empty = await folding.locator('.dsi-empty-inbox').boundingBox();
    assert.equal(empty.height, 36);
    assert.ok(empty.y + empty.height < collapsed.y);
    await folding.evaluate(() => {
      const source = window.inboxDemo.fixture.workspaces;
      source.set({ ...source.getSnapshot(), items: [...source.getSnapshot().items] });
    });
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'false');
    await settledToggle.click();
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'true');
  });
  await check('new search and session contexts may expand a shelf without blocking manual collapse', async () => {
    await settledToggle.click();
    await folding.getByRole('searchbox').fill('调整');
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'true');
    await settledToggle.click();
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'false');
    await folding.getByRole('searchbox').fill('文案');
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'true');
    await folding.getByRole('searchbox').fill('');
    await settledToggle.click();
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'false');
    await folding.evaluate(async () => {
      const { fixture, actions } = window.inboxDemo;
      const value = fixture.sessions.getSnapshot();
      fixture.sessions.set({ ...value, ids: [...value.ids, 'old-2'], byId: { ...value.byId,
        'old-2': { ...value.byId.old, id: 'old-2', displayTitle: '另一个已收起会话', retainedBy: { mainView: 0 } } } });
      fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), items: fixture.workspaces.getSnapshot().items.map(item =>
        item.workspaceId === 'TimeRing' ? { ...item, sessionIds: [...item.sessionIds, 'old-2'] } : item) });
      await actions.settle('old-2', []);
      await actions.open('old-2');
    });
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'true');
    await settledToggle.click();
    assert.equal(await settledToggle.getAttribute('aria-expanded'), 'false');
  });
  await folding.screenshot({ path: 'outputs/sidebar-settled-collapsed.png', fullPage: true });
  await settledToggle.click();
  await check('short and empty inbox states expand only to their content height and keep the last row at the bottom', async () => {
    const panel = await folding.locator('.dsi-shelf-settled').boundingBox();
    const footer = await folding.locator('.preview-native-foot').boundingBox();
    const last = await folding.locator('.dsi-shelf-settled .dsi-card').last().boundingBox();
    assert.ok(panel.height < 200);
    assert.ok(Math.abs(last.y + last.height - footer.y) <= 5);
    assert.ok(await folding.locator('.dsi-shelves').evaluate(node => parseFloat(getComputedStyle(node).marginTop)) > 0);
    assert.equal(await folding.locator('.dsi-content-scroll').evaluate(node => node.scrollHeight - node.clientHeight), 0);
  });
  await folding.screenshot({ path: 'outputs/sidebar-empty-light.png', fullPage: true });
  await folding.emulateMedia({ colorScheme: 'dark' });
  await folding.screenshot({ path: 'outputs/sidebar-empty-dark.png', fullPage: true });
  await folding.close();
  const drafting = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  drafting.on('pageerror', error => failures.push(error.message));
  await drafting.goto(url);
  await drafting.locator('[data-session-id="current"]').waitFor();
  const draftTray = drafting.getByRole('region', { name: '草稿', exact: true });
  await check('new-session action places the unsent conversation in a separate tray below search', async () => {
    await drafting.getByRole('button', { name: '新建会话', exact: true }).click();
    await draftTray.locator('[data-session-id="draft-1"]').waitFor();
    assert.equal(await draftTray.getByText('未发送', { exact: true }).count(), 1);
    assert.equal(await draftTray.getByText('dsh-plugins', { exact: true }).count(), 1);
    assert.equal(await draftTray.locator('.dsi-row-actions').count(), 0);
    assert.equal(await draftTray.evaluate(node => getComputedStyle(node).borderBottomWidth), '0px');
    assert.equal(await draftTray.locator('.dsi-card').evaluate(node => getComputedStyle(node).borderColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await drafting.locator('.preview-native-root').evaluate(node => getComputedStyle(node, '::before').boxShadow), 'none');
    assert.equal(await drafting.locator('.dsi-content-scroll [data-session-id="draft-1"]').count(), 0);
    // The installed host does not define this optional warning alias.
    await drafting.evaluate(() => document.documentElement.style.setProperty('--dsw-alias-state-warning-primary', 'initial'));
    assert.notEqual(await draftTray.locator('.dsi-status').evaluate(node => getComputedStyle(node).color),
      await draftTray.locator('.dsi-title').evaluate(node => getComputedStyle(node).color));
    const toolbar = await drafting.locator('.dsi-toolbar').boundingBox();
    const card = await draftTray.boundingBox();
    assert.ok(card.y >= toolbar.y + toolbar.height);
    const before = await drafting.locator('.dsi-shelf-settled .dsi-shelf-toggle').boundingBox();
    const footer = await drafting.locator('.preview-native-foot').boundingBox();
    assert.ok(Math.abs(before.y + before.height - footer.y) <= 1);
    await drafting.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
    const panel = await drafting.locator('.dsi-shelf-settled').boundingBox();
    assert.ok(panel.height < 100);
    assert.ok(Math.abs(panel.y + panel.height - footer.y) <= 4);
    // Add enough inbox rows to exercise a pinned draft in an overflowing flow.
    await drafting.evaluate(() => {
      const { fixture } = window.inboxDemo;
      const value = fixture.sessions.getSnapshot();
      const ids = Array.from({ length: 12 }, (_, index) => 'inbox-scroll-' + index);
      fixture.workspaces.set({ ...fixture.workspaces.getSnapshot(), items: fixture.workspaces.getSnapshot().items.map(item =>
        item.workspaceId === 'TimeRing' ? { ...item, sessionIds: [...item.sessionIds, ...ids] } : item) });
      fixture.sessions.set({ ...value, ids: [...value.ids, ...ids], byId: { ...value.byId,
        ...Object.fromEntries(ids.map(id => [id, { ...value.byId.old, id, retainedBy: { mainView: 0 } }])) } });
    });
    await drafting.locator('.dsi-content-scroll').evaluate(node => { node.scrollTop = 70; });
    assert.ok(await drafting.locator('.dsi-content-scroll').evaluate(node => node.scrollTop) > 0);
    assert.deepEqual(await draftTray.boundingBox(), card);
    await drafting.mouse.move(359, 840);
    await drafting.screenshot({ path: 'outputs/sidebar-draft-light.png', fullPage: true });
    await drafting.emulateMedia({ colorScheme: 'dark' });
    await drafting.screenshot({ path: 'outputs/sidebar-draft-dark.png', fullPage: true });
  });
  await check('the current draft survives filters, reuses the native blank and fits a narrow sidebar', async () => {
    await drafting.getByRole('searchbox').fill('不会命中的搜索');
    await draftTray.getByText('未发送', { exact: true }).waitFor();
    await drafting.getByRole('combobox', { name: '按项目筛选' }).selectOption('LiQun');
    assert.equal(await draftTray.getByText('dsh-plugins', { exact: true }).count(), 1);
    await drafting.getByRole('searchbox').fill('');
    await drafting.getByRole('combobox', { name: '按项目筛选' }).selectOption('');
    await drafting.getByRole('button', { name: '新建会话', exact: true }).click();
    assert.equal(await drafting.evaluate(() => window.inboxDemo.fixture.sessions.getSnapshot().ids.filter(id => id.startsWith('draft-')).length), 1);
    await drafting.evaluate(() => window.inboxDemo.actions.start('TimeRing'));
    await draftTray.locator('[data-session-id="draft-2"]').waitFor();
    assert.equal(await drafting.locator('[data-session-id="draft-1"]').count(), 0);
    await drafting.evaluate(() => window.inboxDemo.actions.open('draft-1'));
    await draftTray.locator('[data-session-id="draft-1"]').waitFor();
    await drafting.setViewportSize({ width: 280, height: 850 });
    assert.equal(await drafting.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await draftTray.getByText('未发送', { exact: true }).isVisible(), true);
    const card = await draftTray.locator('.dsi-card-main').boundingBox();
    const mark = await draftTray.locator('.dsi-status').boundingBox();
    assert.ok(mark.x + mark.width <= card.x + card.width);
    await drafting.setViewportSize({ width: 360, height: 850 });
  });
  await check('first send removes the draft tray and moves the same session through working into inbox', async () => {
    await drafting.evaluate(() => {
      const source = window.inboxDemo.fixture.status;
      source.set(new Map([...source.getSnapshot(), ['draft-1', { running: true }]]));
    });
    await drafting.locator('.dsi-primary [data-session-id="draft-1"] .dsi-status-working').waitFor();
    assert.equal(await draftTray.count(), 0);
    await drafting.evaluate(() => {
      const { fixture } = window.inboxDemo;
      const list = fixture.sessions.getSnapshot();
      fixture.sessions.set({ ...list, byId: { ...list.byId, 'draft-1': { ...list.byId['draft-1'],
        blank: false, displayTitle: '整理新项目的需求', updatedAt: Date.now() } } });
      fixture.finish('draft-1');
    });
    await drafting.locator('.dsi-primary [data-session-id="draft-1"]').waitFor();
    assert.equal(await drafting.locator('[data-session-id="draft-1"]').count(), 1);
    assert.equal(await drafting.locator('[data-session-id="draft-2"]').count(), 0);
    assert.equal(await draftTray.count(), 0);
    await writeFile('outputs/draft-check.json', JSON.stringify({ version, currentDraftPinnedBelowSearch: true,
      currentBlankOnly: true, firstSendLeavesDraft: true, selectedDraftVisibleWhileFiltering: true,
      nativeBlankReused: true, contentDrivenSettledLayoutPreserved: true, narrowWidth: 280,
      appearances: ['light', 'dark'], scope: 'background Chrome with real plugin and simulated host events' }, null, 2) + '\n');
  });
  await drafting.close();
  const renaming = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  renaming.on('pageerror', error => failures.push(error.message));
  await renaming.goto(url);
  const renameRow = renaming.locator('[data-session-id="current"]');
  await renameRow.waitFor();
  const nameInput = renaming.getByRole('textbox', { name: '重命名', exact: true });
  const saveCount = () => renaming.evaluate(() => window.inboxDemo.fixture.calls.filter(call => call[0] === 'renameSaved').length);
  await check('double click edits a session title in place without opening a modal or changing row geometry', async () => {
    const before = await renameRow.boundingBox();
    await renameRow.locator('.dsi-title').dblclick();
    await nameInput.waitFor();
    assert.equal((await renameRow.boundingBox()).height, before.height);
    assert.equal(await nameInput.inputValue(), '实现会话收件箱');
    assert.equal(await nameInput.evaluate(node => node.selectionEnd - node.selectionStart), '实现会话收件箱'.length);
    assert.equal(await nameInput.evaluate(node => node === document.activeElement), true);
    assert.equal(await renameRow.locator('.dsi-row-actions').count(), 0);
    assert.equal(await renaming.getByRole('dialog').count(), 0);
    assert.equal(await renaming.evaluate(() => window.inboxDemo.fixture.calls.some(call => call[0] === 'rename')), false);
    await renaming.mouse.move(359, 840);
    await renaming.screenshot({ path: 'outputs/sidebar-rename-light.png', fullPage: true });
    await renaming.emulateMedia({ colorScheme: 'dark' });
    await renaming.screenshot({ path: 'outputs/sidebar-rename-dark.png', fullPage: true });
  });
  await check('inline rename respects IME confirmation, saves once with Enter and supports Escape cancellation', async () => {
    await nameInput.fill('整理需求🙂');
    await nameInput.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true })));
    assert.equal(await saveCount(), 0);
    await nameInput.press('Enter');
    await renameRow.getByText('整理需求🙂', { exact: true }).waitFor();
    assert.equal(await saveCount(), 1);
    assert.equal(await nameInput.count(), 0);
    await renameRow.locator('.dsi-title').dblclick();
    await nameInput.fill('不要保存这个名称');
    await nameInput.press('Escape');
    assert.equal(await saveCount(), 1);
    assert.equal(await renameRow.locator('.dsi-title').textContent(), '整理需求🙂');
    assert.equal(await renameRow.locator('.dsi-card-main').evaluate(node => node === document.activeElement), true);
  });
  await check('blur saves an edited title without stealing focus or submitting a second rename', async () => {
    await renameRow.locator('.dsi-card-main').press('F2');
    await nameInput.fill('点击别处保存');
    await renaming.getByRole('searchbox').click();
    await renameRow.getByText('点击别处保存', { exact: true }).waitFor();
    assert.equal(await saveCount(), 2);
    assert.equal(await renaming.getByRole('searchbox').evaluate(node => node === document.activeElement), true);
  });
  await check('empty and rejected names retain the inline editor and can be corrected and retried', async () => {
    await renameRow.locator('.dsi-title').dblclick();
    await nameInput.fill('   ');
    await nameInput.press('Enter');
    await renameRow.getByRole('alert').getByText('请输入会话名称', { exact: true }).waitFor();
    assert.equal(await saveCount(), 2);
    const before = await renameRow.boundingBox();
    await renaming.evaluate(() => {
      const sessions = window.inboxDemo.fixture.ctx.sessions;
      window.inboxDemo.originalUsing = sessions.using;
      sessions.using = async () => ({ ok: false, error: { message: 'permission denied' } });
    });
    await nameInput.fill('保存失败后可以继续编辑');
    await nameInput.press('Enter');
    await renameRow.getByRole('alert').getByText('保存失败：permission denied', { exact: true }).waitFor();
    assert.equal(await nameInput.inputValue(), '保存失败后可以继续编辑');
    assert.equal((await renameRow.boundingBox()).height, before.height);
    await renaming.evaluate(() => { window.inboxDemo.fixture.ctx.sessions.using = window.inboxDemo.originalUsing; });
    await nameInput.press('Enter');
    await renameRow.getByText('保存失败后可以继续编辑', { exact: true }).waitFor();
    assert.equal(await saveCount(), 3);
  });
  await check('a background completion preserves the edited name in the main list', async () => {
    await renaming.locator('[data-session-id="working"] .dsi-title').dblclick();
    await nameInput.fill('任务完成时仍保留的名称');
    await renaming.evaluate(() => window.inboxDemo.fixture.finish('working'));
    await renaming.locator('.dsi-primary [data-session-id="working"] .dsi-title-input').waitFor();
    assert.equal(await nameInput.inputValue(), '任务完成时仍保留的名称');
    assert.equal(await nameInput.count(), 1);
    await nameInput.press('Enter');
    await renaming.locator('[data-session-id="working"]').getByText('任务完成时仍保留的名称', { exact: true }).waitFor();
  });
  await check('an in-flight rename submits once and respects focus moved away before saving finishes', async () => {
    await renameRow.locator('.dsi-title').dblclick();
    await nameInput.fill('等待保存确认');
    const before = await saveCount();
    await renaming.evaluate(() => {
      const sessions = window.inboxDemo.fixture.ctx.sessions;
      const using = sessions.using;
      window.inboxDemo.renameRequests = 0;
      sessions.using = (...args) => {
        window.inboxDemo.renameRequests++;
        return new Promise(resolve => { window.inboxDemo.finishRename = () => using(...args).then(resolve); });
      };
      window.inboxDemo.restoreUsing = () => { sessions.using = using; };
    });
    await nameInput.press('Enter');
    assert.equal(await nameInput.getAttribute('aria-busy'), 'true');
    await nameInput.press('Enter');
    await renaming.getByRole('searchbox').click();
    assert.equal(await renaming.evaluate(() => window.inboxDemo.renameRequests), 1);
    await renaming.evaluate(() => window.inboxDemo.finishRename());
    await renameRow.getByText('等待保存确认', { exact: true }).waitFor();
    assert.equal(await saveCount(), before + 1);
    assert.equal(await renaming.getByRole('searchbox').evaluate(node => node === document.activeElement), true);
    await renaming.evaluate(() => window.inboxDemo.restoreUsing());
  });
  await check('settled titles can be renamed inline at 280px and retain their settled state', async () => {
    await renaming.setViewportSize({ width: 280, height: 850 });
    await renaming.locator('.dsi-shelf-settled .dsi-shelf-toggle').click();
    const old = renaming.locator('[data-session-id="old"]');
    await old.locator('.dsi-title').dblclick();
    const input = await nameInput.boundingBox();
    const row = await old.boundingBox();
    assert.ok(input.x >= row.x && input.x + input.width <= row.x + row.width);
    await nameInput.fill('历史会话的新名称');
    await nameInput.press('Enter');
    await old.getByText('历史会话的新名称', { exact: true }).waitFor();
    assert.equal(await old.getAttribute('data-section'), 'settled');
    assert.equal(await renaming.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await writeFile('outputs/rename-check.json', JSON.stringify({ version, inlineDoubleClick: true,
      enterSaves: true, escapeCancels: true, blurSavesOnce: true, imeConfirmedSeparately: true,
      invalidAndFailedNamesRetained: true, backgroundSectionChangePreservesEditor: true,
      pendingSaveDeduplicated: true, delayedSavePreservesOutsideFocus: true,
      settledStatePreserved: true, narrowWidth: 280,
      scope: 'background Chrome with real plugin and simulated host rename API' }, null, 2) + '\n');
  });
  await renaming.close();
  await verifySettledNotice(browser, url, check, failures, version);
  await verifyDesktopUpdate(browser, url, check, failures, version);
  assert.deepEqual(failures, []);
  results.push('no browser console errors');
  await writeFile('outputs/browser-check.json', JSON.stringify({ version, passed: results.length, results }, null, 2) + '\n');
} finally {
  await browser.close();
}
