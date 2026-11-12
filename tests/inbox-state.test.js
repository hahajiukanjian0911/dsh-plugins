import assert from 'node:assert/strict';
import test from 'node:test';
import { createInboxModel, deriveInboxRows, STORAGE_PREFIX } from '../src/inbox-state.js';

function fixture() {
  let time = 10_000;
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value) };
  const model = createInboxModel({ storage, now: () => time });
  const sessions = { phase: 'ready', ids: ['a', 'b'], byId: {
    a: { id: 'a', updatedAt: 1_000, running: false, displayTitle: 'A' },
    b: { id: 'b', updatedAt: 2_000, running: false, displayTitle: 'B' },
  } };
  const statuses = new Map();
  const workspaces = { items: [], pinnedSessionIds: [], archivedSessionIds: [] };
  const rows = () => deriveInboxRows({ sessions, workspaces, statuses,
    records: model.getSnapshot().records, now: time });
  const sync = () => model.reconcile(sessions, statuses);
  sync();
  return { model, sessions, statuses, storage, saved, workspaces, rows, sync,
    tick: (value) => { time = value; } };
}

test('existing history starts read, a returned result becomes unread, reading keeps it in the inbox', () => {
  const f = fixture();
  assert.ok(f.rows().every((row) => !row.unread));
  f.statuses.set('a', { running: true });
  f.sync();
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'working');
  f.tick(20_000);
  f.sessions.byId.a.updatedAt = 3_000;
  f.statuses.set('a', { running: false });
  f.sync();
  assert.equal(f.rows()[0].id, 'a');
  assert.equal(f.rows()[0].sortAt, 20_000);
  assert.equal(f.rows()[0].unread, true);
  f.model.read(f.sessions.byId.a);
  assert.equal(f.rows()[0].unread, false);
  assert.equal(f.rows()[0].section, 'inbox');
});

test('settlement survives reload and new activity returns a session to the inbox', () => {
  const f = fixture();
  f.model.settle(f.sessions.byId.a);
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'settled');
  const reloaded = createInboxModel({ storage: f.storage, now: () => 30_000 });
  reloaded.reconcile(f.sessions, f.statuses);
  assert.equal(reloaded.getSnapshot().records.get('a').settledAt, 10_000);
  f.sessions.byId.a.updatedAt = 31_000;
  f.sync();
  assert.equal(f.rows()[0].section, 'inbox');
  assert.equal(f.rows()[0].unread, true);
});

test('background completion respects snooze and the timer returns an unread item', () => {
  const f = fixture();
  f.model.snooze(f.sessions.byId.a, undefined, 40_000);
  f.statuses.set('a', { running: true });
  f.sync();
  f.tick(20_000);
  f.statuses.set('a', { running: false });
  f.sessions.byId.a.updatedAt = 19_000;
  f.sync();
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'snoozed');
  f.model.read(f.sessions.byId.a);
  f.tick(40_000);
  const woke = f.rows().find((row) => row.id === 'a');
  assert.equal(woke.section, 'inbox');
  assert.equal(woke.unread, true);
  assert.equal(woke.sortAt, 40_000);
});

test('a request or a fresh failure interrupts snooze, an old failure can be snoozed', () => {
  const f = fixture();
  f.model.noteError('a', 'old failure');
  f.tick(15_000);
  f.model.snooze(f.sessions.byId.a, undefined, 40_000);
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'snoozed');
  f.tick(20_000);
  f.model.noteError('a', 'fresh failure');
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'inbox');
  f.model.snooze(f.sessions.byId.a, undefined, 40_000);
  f.statuses.set('a', { running: true, pendingInteraction: { kind: 'approval' } });
  f.sync();
  const row = f.rows().find((item) => item.id === 'a');
  assert.equal(row.section, 'inbox');
  assert.equal(row.attention, 'approval');
});

test('active work and pending requests cannot be settled, pending requests cannot be snoozed', () => {
  const f = fixture();
  assert.throws(() => f.model.settle(f.sessions.byId.a, { running: true }));
  const pending = { pendingInteraction: { kind: 'question' } };
  assert.throws(() => f.model.settle(f.sessions.byId.a, pending));
  assert.throws(() => f.model.snooze(f.sessions.byId.a, pending, 20_000));
  assert.throws(() => f.model.snooze(f.sessions.byId.a, undefined, 9_000));
});

test('stream updates do not rewrite records or continuously reorder working sessions', () => {
  const f = fixture();
  f.statuses.set('a', { running: true });
  f.sync();
  const saved = f.saved.get(STORAGE_PREFIX + 'a');
  f.tick(20_000);
  for (let index = 0; index < 30; index++) {
    f.sessions.byId.a.updatedAt++;
    f.sync();
  }
  assert.equal(f.saved.get(STORAGE_PREFIX + 'a'), saved);
  assert.equal(f.rows().find((row) => row.id === 'a').sortAt, 10_000);
});

test('a running session that finishes while the client reloads is returned unread', () => {
  const f = fixture();
  f.statuses.set('a', { running: true });
  f.sync();
  const restored = createInboxModel({ storage: f.storage, now: () => 25_000 });
  restored.reconcile(f.sessions, new Map([['a', { running: false }]]));
  const record = restored.getSnapshot().records.get('a');
  assert.equal(record.wasRunning, false);
  assert.equal(record.returnedAt, 25_000);
  assert.ok(record.returnedAt > record.readThrough);
});

test('storage failure rejects explicit settlement without hiding the session', () => {
  const f = fixture();
  f.storage.setItem = () => { throw new Error('quota exceeded'); };
  assert.throws(() => f.model.settle(f.sessions.byId.a), /quota/);
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'inbox');
  assert.match(f.model.getSnapshot().persistenceError, /quota/);
});

test('invalid saved metadata is preserved and reported', () => {
  const f = fixture();
  f.saved.set(STORAGE_PREFIX + 'a', '{broken');
  f.model.receiveStorageChange(STORAGE_PREFIX + 'a');
  f.sync();
  assert.equal(f.saved.get(STORAGE_PREFIX + 'a'), '{broken');
  assert.ok(f.model.getSnapshot().persistenceError);
  assert.throws(() => f.model.settle(f.sessions.byId.a));
});

test('cross-tab changes reload only the changed session and retain other sessions', () => {
  const f = fixture();
  const other = createInboxModel({ storage: f.storage, now: () => 12_000 });
  other.reconcile(f.sessions, f.statuses);
  other.settle(f.sessions.byId.a);
  f.model.receiveStorageChange(STORAGE_PREFIX + 'a');
  f.sync();
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'settled');
  assert.equal(f.rows().find((row) => row.id === 'b').section, 'inbox');
});

test('native pins and archives are respected and subagents and unused blank sessions stay hidden', () => {
  const f = fixture();
  f.workspaces.pinnedSessionIds = ['a'];
  f.workspaces.archivedSessionIds = ['b'];
  assert.equal(f.rows().find((row) => row.id === 'a').section, 'pinned');
  assert.equal(f.rows().find((row) => row.id === 'b').section, 'settled');
  f.sessions.byId.a.origin = 'subagent';
  f.sessions.byId.b.blank = true;
  assert.equal(f.rows().length, 0);
});

test('only the current unsent blank is a draft, separate from stored inbox and settled metadata', () => {
  const f = fixture();
  Object.assign(f.sessions.byId.a, { blank: true, retainedBy: { mainView: 1 } });
  f.sessions.byId.b.blank = true;
  f.model.settle(f.sessions.byId.a);
  f.workspaces.pinnedSessionIds = ['a'];
  f.sync();
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].section, 'draft');
  assert.equal(f.rows()[0].unread, false);
  f.sessions.byId.a.retainedBy.mainView = 0;
  assert.equal(f.rows().length, 0);
});

test('sending a draft leaves its tray and follows working, attention and result states', () => {
  const f = fixture();
  Object.assign(f.sessions.byId.a, { blank: true, retainedBy: { mainView: 1 } });
  f.sync();
  assert.equal(f.rows().find(row => row.id === 'a').section, 'draft');
  // Status may arrive before the summary's blank flag clears.
  f.statuses.set('a', { running: true });
  f.sync();
  assert.equal(f.rows().find(row => row.id === 'a').section, 'working');
  f.statuses.set('a', { running: true, pendingInteraction: { kind: 'approval' } });
  f.sync();
  assert.equal(f.rows().find(row => row.id === 'a').section, 'inbox');
  f.sessions.byId.a.blank = false;
  f.sessions.byId.a.updatedAt = 20_000;
  f.statuses.set('a', { running: false });
  f.tick(20_000);
  f.sync();
  const row = f.rows().find(row => row.id === 'a');
  assert.equal(row.section, 'inbox');
  assert.equal(row.unread, true);
});

test('a stale read receipt preserves a reminder written by another client', () => {
  const f = fixture();
  const other = createInboxModel({ storage: f.storage, now: () => 12_000 });
  other.reconcile(f.sessions, f.statuses);
  other.snooze(f.sessions.byId.a, undefined, 50_000);
  f.sessions.byId.a.updatedAt = 14_000;
  f.model.read(f.sessions.byId.a);
  assert.equal(f.model.getSnapshot().records.get('a').snoozedUntil, 50_000);
  assert.equal(JSON.parse(f.saved.get(STORAGE_PREFIX + 'a')).snoozedUntil, 50_000);
});

test('native archive baseline survives restart and recognizes new activity received while closed', () => {
  const f = fixture();
  f.model.reconcile(f.sessions, f.statuses, ['a']);
  const reloaded = createInboxModel({ storage: f.storage, now: () => 30_000 });
  f.workspaces.archivedSessionIds = ['a'];
  f.sessions.byId.a.updatedAt = 25_000;
  reloaded.reconcile(f.sessions, f.statuses, ['a']);
  const row = deriveInboxRows({ sessions: f.sessions, statuses: f.statuses,
    workspaces: f.workspaces, records: reloaded.getSnapshot().records, now: 30_000 }).find(row => row.id === 'a');
  assert.equal(row.section, 'inbox');
  assert.equal(row.archived, true);
  assert.equal(row.unread, true);
});

test('newly settled history lands first even when its last message is older', () => {
  const f = fixture();
  f.model.settle(f.sessions.byId.b);
  f.tick(12_000);
  f.model.settle(f.sessions.byId.a);
  assert.deepEqual(f.rows().map(row => row.id), ['a', 'b']);
});

test('viewing a native archive with unknown settlement time does not move it above newer settlement', () => {
  const f = fixture();
  f.workspaces.archivedSessionIds = ['b'];
  f.model.reconcile(f.sessions, f.statuses, ['b']);
  f.model.settle(f.sessions.byId.a);
  const before = f.rows().map(row => row.id);
  f.tick(15_000);
  f.model.keepArchived(f.sessions.byId.b);
  f.workspaces.archivedSessionIds = [];
  f.sync();
  assert.deepEqual(f.rows().map(row => row.id), before);
});
