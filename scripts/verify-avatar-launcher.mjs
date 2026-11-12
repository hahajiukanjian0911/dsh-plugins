import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 360, height: 850 }, colorScheme: 'light', reducedMotion: 'reduce' });
page.setDefaultTimeout(5000);
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
const trigger = () => page.locator('[data-slot="settings.launcher"] button[aria-haspopup=dialog]');
try {
  await page.goto(pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href);
  await page.locator('[data-sidebar-row=current]').waitFor();
  await check('The real DSH account trigger shows only its 36px avatar mode', async () => {
    assert.equal(await trigger().count(), 1);
    assert.equal(await trigger().getAttribute('data-collapsed'), 'true');
    assert.deepEqual(await trigger().evaluate(n => [n.offsetWidth, n.offsetHeight, n.innerText]), [36, 36, '']);
    assert.equal(await page.getByText('示例账号', { exact: true }).count(), 0);
    assert.equal(await trigger().locator('[data-avatar-status],svg').count(), 1);
  });
  await check('One click opens Settings directly and never mounts an account menu', async () => {
    await page.evaluate(() => { window.accountMenuAppeared = false; window.accountMenuObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches('[role=menu]') || node.querySelector('[role=menu]'))) window.accountMenuAppeared = true;
    }); window.accountMenuObserver.observe(document.body, { childList: true, subtree: true }); });
    await trigger().click();
    await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.inboxDemo.settingsOpened), 1);
    assert.equal(await page.evaluate(() => window.accountMenuAppeared), false);
    assert.equal(await trigger().getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
  });
  await check('Enter and Space open Settings directly and dismissal returns focus to the avatar', async () => {
    await trigger().focus(); await trigger().press('Enter'); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
    await page.keyboard.press('Escape'); assert.equal(await trigger().evaluate(n => n === document.activeElement), true);
    await trigger().press('Space'); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor(); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.inboxDemo.settingsOpened), 3);
    assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger().getAttribute('aria-label'), '设置');
  });
  await check('Settings remains directly accessible while signed out', async () => {
    await page.evaluate(() => window.inboxDemo.account.set({ view: { status: 'signed-out' } }));
    await trigger().click(); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
    assert.equal(await page.getByRole('menu').count(), 0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.inboxDemo.account.set({ view: { status: 'credential-stored' }, details: { profile: { status: 'ready', value: { name: '示例账号' } } } }));
  });
  await check('The avatar stays compact with installed DSH Polish CSS in both appearances', async () => {
    const source = await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'), 'utf8');
    await page.addStyleTag({ content: JSON.parse(source.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]) });
    for (const appearance of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: appearance });
      await page.waitForFunction(dark => document.body.hasAttribute('data-ds-dark-theme') === dark, appearance === 'dark');
      assert.deepEqual(await trigger().evaluate(n => [n.offsetWidth, n.offsetHeight]), [36, 36]);
      await trigger().click(); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
      assert.equal(await page.getByRole('menu').count(), 0);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: 'outputs/avatar-settings-0.3.2-' + appearance + '.png', clip: { x: 0, y: 620, width: 320, height: 230 } });
    }
  });
  await check('Unloading the sidebar restores the original account launcher registration', async () => {
    assert.equal(await page.evaluate(() => { const d = window.inboxDemo; d.fixture.dispose();
      return d.fixture.winner('settings.launcher').component === globalThis.__DSH_NATIVE_ACCOUNT__.AccountMenu
        && d.fixture.ctx.slots.entries('settings.launcher').length === 1; }), true);
  });
  assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => window.accountMenuAppeared), false);
} finally {
  await browser.close();
  await writeFile('outputs/avatar-settings-checks.json', JSON.stringify({ version: '0.3.2', checks, errors,
    scope: 'Actual installed DSH AccountMenu, shell, controls and theme; fixture account data and settings callback in headless Chrome. No user account or native window interaction.' }, null, 2) + '\n');
}
