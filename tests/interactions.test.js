import assert from 'node:assert/strict';
import test from 'node:test';
import { createInboxController } from '../src/controller.js';
import { createHostFixture } from './host-fixture.js';

function load(t, saved = new Map()) {
  const env = { localStorage: { getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value) },
  document: { visibilityState: 'visible', hasFocus: () => false, addEventListener() {}, removeEventListener() {} },
  addEventListener() {}, removeEventListener() {} };
  const fixture = createHostFixture(env);
  const controller = createInboxController(fixture.ctx, env);
  const stop = controller.start();
  t.after(stop);
  return { ...fixture, env, saved, stop, actions: controller.actions, snapshot: controller.getSnapshot,
    row: id => controller.getSnapshot().rows.find(row => row.id === id),
    primary: () => controller.getSnapshot().rows.filter(row => ['pinned', 'inbox', 'working'].includes(row.section)).map(row => row.id) };
}

test('settle Undo restores the pinned position and the automatically advanced selection', async t => {
  const f = load(t);
  await f.actions.pin('current');
  const original = f.primary();
  await f.actions.settle('current', original);
  assert.equal(f.row('current').section, 'settled');
  assert.equal(f.snapshot().undo.kind, 'settled');
  await f.actions.undo();
  assert.equal(f.row('current').section, 'pinned');
  assert.deepEqual(f.primary(), original);
  assert.equal(f.snapshot().currentId, 'current');
  assert.equal(f.snapshot().undo, null);
});

test('Undo does not reopen a session after the user navigates elsewhere', async t => {
  const f = load(t);
  await f.actions.settle('current', ['current', 'result']);
  await f.actions.open('answer');
  await f.actions.undo();
  assert.equal(f.row('current').section, 'inbox');
  assert.equal(f.snapshot().currentId, 'answer');
});

test('Undo respects user navigation during an awaited settle as well', async t => {
  const f = load(t);
  await f.actions.pin('current');
  let complete;
  const unpin = f.ctx.uiWorkspace.unpinSession;
  f.ctx.uiWorkspace.unpinSession = id => new Promise(resolve => { complete = () => unpin(id).then(resolve); });
  const change = f.actions.settle('current', ['current', 'result']);
  f.ctx.uiWorkspace.openSession('answer');
  complete(); await change;
  await f.actions.undo();
  assert.equal(f.snapshot().currentId, 'answer');
});

test('snooze and unpin Undo restore their previous lifecycle and pin order', async t => {
  const f = load(t);
  await f.actions.snooze('result', Date.now() + 60_000, []);
  assert.equal(f.row('result').section, 'snoozed');
  await f.actions.undo();
  assert.equal(f.row('result').section, 'inbox');
  await f.actions.pin('result');
  const before = f.primary();
  await f.actions.pin('pin');
  assert.equal(f.row('pin').pinned, false);
  await f.actions.undo();
  assert.deepEqual(f.primary(), before);
});

test('viewing native archives preserves settlement and does not invent a known settlement time', async t => {
  const f = load(t);
  f.workspaces.set({ ...f.workspaces.getSnapshot(), archivedSessionIds: ['old'] });
  await f.actions.open('old');
  assert.equal(f.row('old').section, 'settled');
  assert.equal(f.row('old').archived, false);
  assert.equal(f.row('old').record.settledFromArchive, true);
  assert.equal(f.snapshot().currentId, 'old');
  await f.actions.restore('old');
  assert.equal(f.row('old').section, 'inbox');
  await f.actions.undo();
  assert.equal(f.row('old').section, 'settled');
});

test('a failed native-archive open keeps the shelf and the previous selection', async t => {
  const f = load(t);
  f.workspaces.set({ ...f.workspaces.getSnapshot(), archivedSessionIds: ['old'] });
  f.ctx.uiWorkspace.unarchiveSession = async () => { throw new Error('offline'); };
  assert.equal(await f.actions.open('old'), false);
  assert.equal(f.row('old').section, 'settled');
  assert.equal(f.snapshot().currentId, 'current');
  assert.match(f.snapshot().operationError, /offline/);
});

test('new activity returns both native archives and viewed archives to active work', async t => {
  const f = load(t);
  f.workspaces.set({ ...f.workspaces.getSnapshot(), archivedSessionIds: ['old', 'result'] });
  await f.actions.open('old');
  for (const id of ['old', 'result']) {
    const source = f.sessions.getSnapshot();
    f.sessions.set({ ...source, byId: { ...source.byId, [id]: { ...source.byId[id], updatedAt: Date.now() } } });
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.row('old').section, 'inbox');
  assert.equal(f.row('result').section, 'inbox');
  assert.deepEqual(f.workspaces.getSnapshot().archivedSessionIds, []);
});

test('manual ordering survives reload and completion; Undo restores the old order', async t => {
  const f = load(t);
  const before = f.primary();
  await f.actions.move('working', { section: 'inbox', beforeId: 'answer' });
  const moved = f.primary();
  assert.equal(moved.indexOf('working') + 1, moved.indexOf('answer'));
  await f.actions.undo();
  assert.deepEqual(f.primary(), before);
  await f.actions.move('working', { section: 'inbox', beforeId: 'answer' });
  f.finish('working');
  assert.deepEqual(f.primary(), moved);
  f.stop();
  const reloaded = load(t, f.saved);
  assert.deepEqual(reloaded.primary(), moved);
});

test('dragging between active, pinned and settled preserves session IDs and can be undone', async t => {
  const f = load(t);
  const ids = f.sessions.getSnapshot().ids;
  await f.actions.move('result', { section: 'pinned', beforeId: 'pin' });
  assert.equal(f.primary()[0], 'result');
  assert.equal(f.row('result').pinned, true);
  await f.actions.move('result', { section: 'settled' });
  assert.equal(f.row('result').section, 'settled');
  assert.equal(f.row('result').pinned, false);
  await f.actions.undo();
  assert.equal(f.row('result').section, 'pinned');
  assert.equal(f.primary()[0], 'result');
  await f.actions.move('result', { section: 'inbox', afterId: 'current' });
  assert.equal(f.row('result').pinned, false);
  assert.equal(f.primary().indexOf('result'), f.primary().indexOf('current') + 1);
  assert.equal(f.sessions.getSnapshot().ids, ids);
});

test('invalid or active drop destinations leave lifecycle and pin state intact', async t => {
  const f = load(t);
  assert.equal(await f.actions.move('working', { section: 'settled' }), false);
  assert.equal(f.row('working').section, 'working');
  assert.equal(await f.actions.move('answer', { section: 'settled' }), false);
  const before = f.primary();
  assert.equal(await f.actions.move('pin', { section: 'inbox', beforeId: 'missing' }), false);
  assert.equal(f.row('pin').pinned, true);
  assert.deepEqual(f.primary(), before);
});

test('a failed reorder write rolls back native pin changes', async t => {
  const f = load(t);
  const write = f.env.localStorage.setItem;
  f.env.localStorage.setItem = (key, value) => {
    if (key.endsWith('.order')) throw new Error('quota exceeded');
    write(key, value);
  };
  assert.equal(await f.actions.move('pin', { section: 'inbox', beforeId: 'result' }), false);
  assert.equal(f.row('pin').pinned, true);
  assert.match(f.snapshot().operationError, /quota/);
});

test('a fresh result invalidates old Undo so it cannot hide the result', async t => {
  const f = load(t);
  await f.actions.settle('result', []);
  await f.actions.restore('result');
  const source = f.sessions.getSnapshot();
  f.sessions.set({ ...source, byId: { ...source.byId,
    result: { ...source.byId.result, updatedAt: Date.now() + 1 } } });
  assert.equal(f.snapshot().undo, null);
  await f.actions.undo();
  assert.equal(f.row('result').section, 'inbox');
  assert.equal(f.row('result').unread, true);
});

test('opening after a failed native archive wake does not re-settle the new result', async t => {
  const f = load(t);
  f.workspaces.set({ ...f.workspaces.getSnapshot(), archivedSessionIds: ['old'] });
  const unarchive = f.ctx.uiWorkspace.unarchiveSession;
  f.ctx.uiWorkspace.unarchiveSession = async () => { throw new Error('offline'); };
  f.finish('old');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.row('old').section, 'inbox');
  assert.equal(f.row('old').archived, true);
  f.ctx.uiWorkspace.unarchiveSession = unarchive;
  await f.actions.open('old');
  assert.equal(f.row('old').section, 'inbox');
  assert.equal(f.row('old').archived, false);
});

test('a result arriving during an awaited Undo is not sent back to the settled shelf', async t => {
  const f = load(t);
  f.workspaces.set({ ...f.workspaces.getSnapshot(), archivedSessionIds: ['old'] });
  await f.actions.pin('old');
  let complete;
  const unpin = f.ctx.uiWorkspace.unpinSession;
  f.ctx.uiWorkspace.unpinSession = id => new Promise(resolve => { complete = () => unpin(id).then(resolve); });
  const undo = f.actions.undo();
  f.finish('old');
  complete(); await undo;
  assert.equal(f.row('old').section, 'inbox');
  assert.equal(f.row('old').unread, true);
});
