import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { nativePrimitives } from './native-primitives.js';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHostFixture } from './host-fixture.js';

function environment() {
  const saved = new Map();
  return {
    localStorage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    document: { visibilityState: 'visible', hasFocus: () => false,
      addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
  };
}

async function load(t) {
  const env = environment();
  const fixture = createHostFixture(env);
  let registration;
  env.__ModuleLoader__ = { load(value) { registration = value; } };
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: env, setTimeout, clearTimeout, console,
  });
  const plugin = registration.factory((id) => {
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return nativePrimitives(React);
    if (id === 'react-dom') return ReactDOM;
    if (id === 'react/jsx-runtime') return JSXRuntime;
    assert.equal(id, 'react');
    return React;
  });
  plugin.apply(fixture.ctx);
  t.after(() => fixture.dispose());
  const injected = fixture.winner().inject();
  return { ...fixture, injected, actions: injected.actions, snapshot: () => injected.hooks.inbox.getSnapshot() };
}

test('packaged factory overrides the native browser and disposal restores it', async (t) => {
  const f = await load(t);
  assert.equal(f.winner().options.priority, -100);
  assert.equal(f.injected.hooks.nativeShortcuts, f.shortcutState);
  assert.equal(f.snapshot().rows.length, 7);
  assert.equal(f.winner('sidebar.brand.name').options.priority, 0);
  assert.equal(f.winner('conversation.input.dock').options.id, 'inbox-settled-notice');
  f.dispose();
  assert.equal(f.winner(), f.original);
  assert.equal(f.winner('sidebar.brand.name').options.priority, 0);
  assert.equal(f.winner('conversation.input.dock'), undefined);
  assert.equal(f.sessions.listeners.size, 0);
  assert.equal(f.status.listeners.size, 0);
});

test('settling the current session opens the next inbox item and preserves session data', async (t) => {
  const f = await load(t);
  const ids = f.sessions.getSnapshot().ids;
  await f.actions.settle('current', ['pin', 'answer', 'current', 'result']);
  assert.equal(f.snapshot().rows.find((row) => row.id === 'current').section, 'settled');
  assert.deepEqual(f.calls.at(-1), ['open', 'result']);
  assert.equal(f.sessions.getSnapshot().ids, ids);
  assert.equal(f.workspaces.getSnapshot().archivedSessionIds.length, 0);
});

test('settled notice joins the native composer dock list and unloads without removing other entries', async (t) => {
  const f = await load(t);
  const disposeTodo = f.ctx.slots.register({ name: 'conversation.input.dock', id: 'todo', order: 0 }, () => null);
  const disposeQueue = f.ctx.slots.register({ name: 'conversation.input.dock', id: 'queue', order: 20 }, () => null);
  t.after(disposeTodo); t.after(disposeQueue);
  assert.deepEqual(f.ctx.slots.entries('conversation.input.dock').map(entry => entry.options.id),
    ['inbox-settled-notice', 'todo', 'queue']);
  f.dispose();
  assert.deepEqual(f.ctx.slots.entries('conversation.input.dock').map(entry => entry.options.id), ['todo', 'queue']);
});

test('settled notice tolerates unknown or out-of-range saved dates and does not leak into another session', async (t) => {
  const f = await load(t);
  const Notice = f.winner('conversation.input.dock').component;
  const row = f.snapshot().rows.find(row => row.id === 'old');
  const html = (at, sessionId = 'old') => renderToStaticMarkup(React.createElement(Notice, {
    sessionId, actions: f.actions, t: key => key,
    useInbox: select => select({ ...f.snapshot(), rows: [{ ...row, section: 'settled', record: { ...row.record, settledAt: at } }] }),
  }));
  assert.doesNotMatch(html(0), /<time /);
  assert.doesNotMatch(html(Number.MAX_VALUE), /<time /);
  assert.match(html(1_700_000_000_000), /datetime="2023-11-14T22:13:20.000Z"/i);
  assert.equal(html(1_700_000_000_000, 'current'), '');
});

test('an active session cannot be hidden by settle and the user sees the refusal', async (t) => {
  const f = await load(t);
  await f.actions.settle('working', []);
  assert.equal(f.snapshot().rows.find((row) => row.id === 'working').section, 'working');
  assert.ok(f.snapshot().operationError);
  assert.equal(f.calls.length, 0);
});

test('native pin failures are shown and keep the existing inbox state', async (t) => {
  const f = await load(t);
  f.ctx.uiWorkspace.pinSession = async () => { throw new Error('permission denied'); };
  await f.actions.pin('result');
  assert.match(f.snapshot().operationError, /permission denied/);
  assert.equal(f.snapshot().rows.find((row) => row.id === 'result').pinned, false);
});

test('a user navigation during an awaited settle is respected', async (t) => {
  const f = await load(t);
  await f.actions.pin('current');
  let complete;
  f.ctx.uiWorkspace.unpinSession = () => new Promise((resolve) => { complete = resolve; });
  const settling = f.actions.settle('current', ['current', 'result']);
  f.ctx.uiWorkspace.openSession('answer');
  complete();
  await settling;
  assert.deepEqual(f.calls.at(-1), ['open', 'answer']);
});

test('inline rename uses the host session operation and preserves inbox state', async (t) => {
  const f = await load(t);
  await f.actions.settle('old', []);
  await f.actions.rename('old', '  新名称🙂  ');
  assert.deepEqual(f.calls.at(-1), ['renameSaved', 'old', '新名称🙂']);
  const row = f.snapshot().rows.find(item => item.id === 'old');
  assert.equal(row.session.displayTitle, '新名称🙂');
  assert.equal(row.section, 'settled');
  assert.equal(f.calls.some(item => item[0] === 'rename'), false);
});

test('rename rejects empty titles and returns host failures to the inline editor', async (t) => {
  const f = await load(t);
  await assert.rejects(f.actions.rename('current', '  '), /required/);
  assert.equal(f.calls.length, 0);
  f.ctx.sessions.using = async () => ({ ok: false, error: { message: 'permission denied' } });
  await assert.rejects(f.actions.rename('current', '新的名称'), /permission denied/);
  assert.equal(f.snapshot().rows.find(row => row.id === 'current').session.displayTitle, '实现会话收件箱');
});

test('sidebar preferences join native Settings with localized navigation and dispose cleanly', async t => {
 const f=await load(t),entry=f.winner('settings.section'),props=entry.inject();
 assert.equal(entry.options.id,'dsh-session-sidebar');assert.equal(entry.options.label(),'会话侧边栏');
 assert.equal(f.winner('settings.section.icon').options.id,'dsh-session-sidebar');
 const preferences=f.injected.hooks.sidebarPreferences;assert.equal(props.hooks.sidebarPreferences,preferences);
 assert.equal(f.winner('conversation.input.dock').inject().hooks.sidebarPreferences,preferences);
 props.setPreference('settledNotice',false);assert.equal(preferences.getSnapshot().value.settledNotice,false);
 const Page=entry.component;
 const html=renderToStaticMarkup(React.createElement(Page,{...props,useSidebarPreferences:select=>select(preferences.getSnapshot()),t:f.ctx.locale.bind('inboxSidebar')}));
 assert.match(html,/显示密度/);assert.equal((html.match(/role="switch"/g)||[]).length,3);assert.doesNotMatch(html,/默认展开「已收起」|默认展开「稍后提醒」/);
 f.dispose();assert.equal(f.winner('settings.section'),undefined);assert.equal(f.winner('settings.section.icon'),undefined);
});
