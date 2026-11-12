import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const output = resolve('plugins/dsh-project-manager/outputs');
const { version } = JSON.parse(await readFile('plugins/dsh-project-manager/package.json', 'utf8'));
const url = pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href + '?composer&assembly';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const checks = [], errors = [];
const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, colorScheme: 'light' });
const polishSource = await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'), 'utf8');
const polish = JSON.parse(polishSource.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);
await page.addInitScript(css => addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
}, { once: true }), polish);
page.setDefaultTimeout(7000);
page.on('pageerror', e => errors.push(e.message));
const chip = () => page.locator('[data-dpm-project-anchor]');
const menu = () => page.getByRole('menu').first();
const check = async (name, run) => { await run(); checks.push(name); };
async function closeMenu() { if (await menu().isVisible()) await page.keyboard.press('Escape'); }
async function openMenu() { await closeMenu(); await chip().click(); await menu().waitFor(); }
try {
  await page.goto(url);
  await chip().waitFor();
  await check('real SlotRegistry elects the replacement and preserves the native child declaration', async () => {
    const actual = await page.evaluate(() => {
      const slots = window.composerDemo.fixture.ctx.slots;
      const entries = slots.entries('conversation.hero.workspace');
      const native = entries.find(e => (e.options.priority ?? 0) === 0);
      const replacement = entries.find(e => e.options.priority === -100);
      let oldError;
      try {
        slots.register({ name: 'conversation.hero.workspace', priority: -101, children: native.children }, () => null);
      } catch (error) { oldError = error.message; }
      return { realRegistry: slots.constructor.name, activePriority: slots.entriesOfSlot('conversation.hero.workspace')[0].options.priority,
        replacementDeclaresChildren: !!replacement.children, nativeKeepsChild: !!native.children?.['conversation.hero.workspace.directoryFlow'], oldError };
    });
    assert.equal(actual.realRegistry, 'SlotRegistry');
    assert.equal(actual.activePriority, -100); assert.equal(actual.replacementDeclaresChildren, false);
    assert.equal(actual.nativeKeepsChild, true);
    assert.match(actual.oldError, /conversation.hero.workspace.directoryFlow.*already declared/);
  });
  await check('native composer chip and menu use the same project identity as settings', async () => {
    assert.equal(await chip().innerText(), 'TimeRing');
    await page.evaluate(async () => {
      const d = window.composerDemo;
      d.projectDemo.metadata.projects['directory:local-demo:TimeRing'].name = '时光环';
      d.projectDemo.metadata.projects['directory:local-demo:TimeRing'].icon = { kind: 'monogram', value: 'TR', color: '#6366f1' };
      await d.controller.load();
    });
    await page.getByRole('button', { name: '选择项目: 时光环', exact: true }).waitFor();
    assert.equal(await chip().innerText(), 'TR\n时光环');
    await openMenu();
    await page.getByRole('menuitem', { name: /时光环.*\/example\/TimeRing/ }).waitFor();
    assert.equal(await page.evaluate(() => window.composerDemo.fixture.workspaces.getSnapshot().items.find(w => w.workspaceId === 'TimeRing').title), 'TimeRing');
  });
  await check('native selection transfers the unsent draft and attachments without project launch RPC', async () => {
    await closeMenu();
    await page.getByRole('textbox', { name: '示例会话草稿' }).fill('切换后保留这段草稿');
    await page.evaluate(() => window.composerDemo.drafts.get('draft:TimeRing').attachmentIds.push('attachment-1'));
    await openMenu();
    await page.getByRole('menuitem', { name: /LiQun.*\/example\/LiQun/ }).click();
    await page.getByRole('button', { name: '选择项目: LiQun', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '示例会话草稿' }).inputValue(), '切换后保留这段草稿');
    const result = await page.evaluate(() => {
      const d = window.composerDemo;
      return { old: d.drafts.get('draft:TimeRing'), current: d.drafts.get(d.current.getSnapshot()), rebinds: d.rebinds, selections: d.selections,
        launches: d.fixture.calls.filter(c => c[0] === 'projectManager/operation') };
    });
    assert.equal(result.old.text, ''); assert.deepEqual(result.old.attachmentIds, []);
    assert.deepEqual(result.current.attachmentIds, ['attachment-1']);
    assert.deepEqual(result.rebinds, [['draft:LiQun', ['attachment-1'], true]]);
    assert.deepEqual(result.selections, ['LiQun']); assert.deepEqual(result.launches, []);
  });
  await check('failed native selection restores the current chip and preserves the draft', async () => {
    await page.evaluate(() => window.composerDemo.failSelection = true);
    await openMenu(); await page.getByRole('menuitem', { name: /dsh-plugins.*\/example\/dsh-plugins/ }).click();
    await page.getByRole('button', { name: '选择项目: LiQun', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '示例会话草稿' }).inputValue(), '切换后保留这段草稿');
    assert.equal(await page.evaluate(() => window.composerDemo.current.getSnapshot()), 'draft:LiQun');
    await page.evaluate(() => window.composerDemo.failSelection = false);
  });
  await check('one project with multiple checkouts chooses the explicit local directory', async () => {
    await page.evaluate(async () => {
      const d = window.composerDemo, s = d.fixture.workspaces.getSnapshot();
      d.fixture.workspaces.set({ ...s, items: [...s.items, { workspaceId: 'worktree', title: 'feature-project', path: '/example/worktrees/feature', sessionIds: ['draft:worktree'] }] });
      d.projectDemo.metadata.assignments['local-demo:worktree'] = 'directory:local-demo:dsh-plugins';
      await d.controller.load();
    });
    await openMenu();
    await page.getByRole('menuitem', { name: 'dsh-plugins', exact: true }).hover();
    await page.getByRole('menuitem', { name: /feature-project.*\/example\/worktrees\/feature/ }).click();
    await page.getByRole('button', { name: '选择项目: dsh-plugins', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.composerDemo.current.getSnapshot()), 'draft:worktree');
  });
  await check('missing checkout is disabled and archived projects can be revealed', async () => {
    await page.evaluate(async () => {
      const d = window.composerDemo;
      d.projectDemo.metadata.projects['directory:local-demo:TimeRing'].archived = true;
      const s = d.fixture.workspaces.getSnapshot();
      d.fixture.workspaces.set({ ...s, items: s.items.map(w => w.workspaceId === 'worktree' ? { ...w, missing: true } : w) });
      await d.controller.load();
    });
    await openMenu(); assert.equal(await page.getByRole('menuitem', { name: /时光环/ }).count(), 0);
    await page.getByRole('menuitem', { name: '显示已归档项目', exact: true }).click();
    if (!await menu().isVisible()) await openMenu();
    await page.getByRole('menuitem', { name: /时光环.*\/example\/TimeRing/ }).waitFor();
    await closeMenu();
    await openMenu();
    await page.getByRole('menuitem', { name: 'dsh-plugins', exact: true }).hover();
    assert.equal(await page.getByRole('menuitem', { name: /feature-project.*\/example\/worktrees\/feature/ }).isDisabled(), true);
    await closeMenu();
  });
  await check('adding a project retains native directory error/retry and draft transfer', async () => {
    await openMenu(); await page.getByRole('menuitem', { name: '添加项目…', exact: true }).click();
    const directory = () => page.getByRole('dialog', { name: '选择示例目录' });
    await directory().waitFor();
    await page.evaluate(() => window.composerDemo.failCreate = true);
    await directory().getByRole('button', { name: '选择此目录', exact: true }).click();
    const errorDialog = page.getByRole('dialog').filter({ hasText: '示例目录登记失败' });
    await errorDialog.waitFor();
    await page.evaluate(() => window.composerDemo.failCreate = false);
    await errorDialog.getByRole('button').last().click();
    await directory().waitFor();
    await directory().getByRole('button', { name: '选择此目录', exact: true }).click();
    await page.getByRole('button', { name: '选择项目: added-project', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '示例会话草稿' }).inputValue(), '切换后保留这段草稿');
    assert.deepEqual(await page.evaluate(() => window.composerDemo.drafts.get('draft:added-project').attachmentIds), ['attachment-1']);
  });
  await check('unavailable directory flow removes the add action', async () => {
    await page.evaluate(() => window.composerDemo.flow.set(false));
    await openMenu();
    assert.equal(await page.getByRole('menuitem', { name: '添加项目…', exact: true }).count(), 0);
    await closeMenu(); await page.evaluate(() => window.composerDemo.flow.set(true));
  });
  await check('native button keyboard opening and escape keep focus on the project selector', async () => {
    await closeMenu(); await chip().focus(); await page.keyboard.press('Enter'); await menu().waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await chip().evaluate(n => n === document.activeElement), true);
  });
  await check('native light and dark menus display project identities and directory paths', async () => {
    await page.goto(url); await chip().waitFor();
    await openMenu(); await page.screenshot({ path: output + '/composer-' + version + '-light.png' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: output + '/composer-' + version + '-dark.png' });
  });
  await check('long project names keep the native chip and menu within a narrow viewport', async () => {
    await closeMenu(); await page.setViewportSize({ width: 360, height: 700 });
    await page.evaluate(async () => {
      const d = window.composerDemo;
      d.projectDemo.metadata.projects['directory:local-demo:TimeRing'].name = '一个非常长的项目名称😀项目'.repeat(8);
      await d.controller.load();
    });
    await openMenu();
    const bounds = await page.evaluate(() => {
      const chip = document.querySelector('[data-dpm-project-anchor]').getBoundingClientRect();
      const menus = [...document.querySelectorAll('[role=menu]')].map(n => n.getBoundingClientRect());
      return { chip: { left: chip.left, right: chip.right }, menus: menus.map(r => ({ left: r.left, right: r.right })), width: innerWidth };
    });
    assert.ok(bounds.chip.left >= 0 && bounds.chip.right <= bounds.width, JSON.stringify(bounds));
    assert.ok(bounds.menus.every(r => r.left >= 0 && r.right <= bounds.width), JSON.stringify(bounds));
  });
  await check('project service failure falls back to native picker and recovers without hook errors', async () => {
    await page.goto(url + '&project-error');
    await page.getByRole('button', { name: /选择工作区/ }).waitFor();
    assert.equal(await chip().count(), 0);
    await page.getByRole('button', { name: /选择工作区/ }).click();
    await page.getByRole('menuitem', { name: 'TimeRing', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(async () => { window.composerDemo.failLoad = false; await window.composerDemo.controller.load(); });
    await chip().waitFor();
    await openMenu(); await page.getByRole('menuitem', { name: /TimeRing.*\/example\/TimeRing/ }).waitFor();
  });
  await check('workspace refresh restores the native chip while pending and reapplies identity when ready', async () => {
    await closeMenu();
    await page.evaluate(() => { const d = window.composerDemo, s = d.fixture.workspaces.getSnapshot(); d.fixture.workspaces.set({ ...s, phase: 'pending' }); });
    await page.getByRole('button', { name: /选择工作区/ }).waitFor();
    assert.equal(await chip().count(), 0);
    await page.evaluate(() => { const d = window.composerDemo, s = d.fixture.workspaces.getSnapshot(); d.fixture.workspaces.set({ ...s, phase: 'ready' }); });
    await chip().waitFor();
  });
  assert.deepEqual(errors, []);
} catch (error) { errors.push(error.stack || error.message); throw error; }
finally {
  await writeFile(output + '/composer-' + version + '-checks.json', JSON.stringify({ version, checksPassed: checks.length, checks, errors,
    scope: 'Real installed DSH Cordis Context, SlotRegistry, SlotCore, slot renderer, ConversationContent, WorkspacePicker, UI primitives, theme, installed Polish CSS and native draft/attachment transfer callback; built project-manager client bundle loaded through its ModuleLoader factory; fixture RPC, sessions and directory flow in headless Chrome. No native-window interaction.' }, null, 2) + '\n');
  await browser.close();
}
console.log('Composer project picker: ' + checks.length + ' passed.');
