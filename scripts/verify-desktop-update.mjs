import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function verifyDesktopUpdate(browser, url, check, failures, version) {
  const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(url);
  await page.locator('[data-session-id="current"]').waitFor();
  const indicator = page.locator('.preview-native-update');
  const set = (phase, extra = {}) => page.evaluate(({ phase, extra }) => {
    window.inboxDemo.desktopUpdate.set({ presentation: { phase, version: '0.0.0-demo', percent: 37 },
      failed: false, opening: false, ...extra });
  }, { phase, extra });
  const size = async () => {
    const bounds = await indicator.boundingBox();
    assert.equal(bounds.width, 28); assert.equal(bounds.height, 28);
    assert.equal(await indicator.locator('span').last().isVisible(), false);
    return bounds;
  };
  const phases = [];
  try {
    await check('native update entry uses a normal icon with a small dot, full tooltip and original click or keyboard action', async () => {
      assert.equal(await indicator.count(), 0);
      await set('available');
      await indicator.waitFor();
      await size();
      assert.equal(await indicator.getAttribute('aria-label'), '新版本');
      assert.equal(await indicator.getAttribute('title'), '新版本：0.0.0-demo');
      assert.equal(await indicator.evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
      assert.equal(await indicator.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.equal(await indicator.evaluate(node => getComputedStyle(node, '::after').width), '5px');
      assert.equal((await indicator.locator('svg').boundingBox()).width, 16);
      await indicator.click();
      await indicator.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.inboxDemo.updateOpenCount), 2);
      await indicator.evaluate(node => node.blur());
      await page.mouse.move(359, 840);
      await page.screenshot({ path: 'outputs/desktop-update-icon-light.png', fullPage: true });
      await page.locator('.preview-native-root').screenshot({ path: 'outputs/desktop-update-sidebar-light.png' });
      const shell = await page.locator('.preview-native-root').boundingBox();
      const footerClip = { x: shell.x, y: shell.y + shell.height - 40, width: shell.width, height: 40 };
      await page.screenshot({ path: 'outputs/desktop-update-footer-light.png', clip: footerClip });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'outputs/desktop-update-icon-dark.png', fullPage: true });
      await page.screenshot({ path: 'outputs/desktop-update-footer-dark.png', clip: footerClip });
      await page.emulateMedia({ colorScheme: 'light' });
    });
    await check('checking download verification restart and error keep one icon width and their native labels and busy guard', async () => {
      for (const [phase, label, busy] of [['checking', '正在检查更新…', true], ['downloading', '37%', true],
        ['verifying', '正在校验更新文件…', true], ['installing', '正在准备重启…', true],
        ['ready', '安装并重启', false], ['error', '重试更新', false]]) {
        await set(phase);
        const bounds = await size();
        assert.equal(await indicator.getAttribute('aria-label'), label);
        assert.equal(await indicator.getAttribute('aria-disabled'), String(busy));
        const before = await page.evaluate(() => window.inboxDemo.updateOpenCount);
        await indicator.evaluate(node => node.click());
        assert.equal(await page.evaluate(() => window.inboxDemo.updateOpenCount), before + Number(!busy));
        if (phase === 'downloading') assert.match(await indicator.getAttribute('title'), /37%\n目标版本：0.0.0-demo/);
        if (busy || phase === 'error') assert.equal(await indicator.evaluate(node => getComputedStyle(node, '::after').content), 'none');
        if (phase === 'error') assert.equal(await indicator.evaluate(node => getComputedStyle(node).color),
          await page.evaluate(() => {
            const sample = document.createElement('span');
            sample.style.color = 'var(--dsw-alias-state-error-primary)';
            document.body.append(sample);
            const color = getComputedStyle(sample).color;
            sample.remove(); return color;
          }));
        phases.push({ phase, label, busy, width: bounds.width });
      }
    });
    await check('the compact update icon stays clickable beside a long account name at 280px and does not shrink connection recovery', async () => {
      await set('ready');
      await page.getByRole('button', { name: '账号菜单' }).locator('span').last().evaluate(node => { node.textContent = '哈哈就看见 · 很长的账户名称'; });
      for (const width of [280, 360]) {
        await page.setViewportSize({ width, height: 850 });
        const bounds = await size();
        const account = await page.getByRole('button', { name: '账号菜单' }).boundingBox();
        const tools = await page.getByRole('navigation', { name: '全局面板' }).boundingBox();
        assert.ok(account.width >= 32);
        assert.ok(account.x + account.width <= bounds.x);
        assert.ok(bounds.x + bounds.width <= tools.x);
        assert.equal(await indicator.evaluate(node => {
          const b = node.getBoundingClientRect();
          return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('button') === node;
        }), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await set('available', { connection: 'disconnected' });
      assert.equal(await indicator.count(), 0);
      const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
      await reconnect.evaluate(node => { node.setAttribute('aria-disabled', 'false'); });
      assert.ok((await reconnect.boundingBox()).width > 28);
      assert.equal(await reconnect.isVisible(), true);
    });
    await check('native rail badge is retained and leaving the expanded plugin scope restores native update text', async () => {
      await set('ready');
      await page.evaluate(() => window.inboxDemo.setWide(false));
      await page.getByRole('img', { name: '有更新', exact: true }).waitFor();
      assert.equal(await indicator.count(), 0);
      await page.evaluate(() => window.inboxDemo.setWide(true));
      await indicator.waitFor(); await size();
      await page.locator('.dsi-root').evaluate(node => node.classList.add('dsi-rail'));
      assert.equal(await indicator.locator('span').last().isVisible(), true);
      assert.ok((await indicator.boundingBox()).width > 28);
      await page.locator('.dsi-root').evaluate(node => node.classList.remove('dsi-rail'));
      await size();
      await page.evaluate(() => { document.documentElement.lang = 'en'; });
      await set('ready');
      assert.equal(await indicator.getAttribute('aria-label'), 'Install and Restart');
      assert.match(await indicator.getAttribute('title'), /0\.0\.0-demo/);
      await size();
    });
    await writeFile('outputs/desktop-update-icon-check.json', JSON.stringify({ version, iconButtonSize: 28, iconSize: 16,
      notificationDotSize: 5, idleHasNoPlaceholder: true, fullNativeLabelsAndDetailsRetained: true,
      clickAndKeyboardReachSimulatedNativeAction: true, actualUpdateApiInvoked: false,
      narrowWidth: 280, connectionRecoveryUnchanged: true,
      expandedScopeOnly: true, nativeRailBadgeRetained: true, phases,
      scope: 'real plugin CSS with equivalent native update markup and a simulated action; no actual update API invoked' }, null, 2) + '\n');
  } finally { await page.close(); }
}
