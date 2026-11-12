import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectCatalog, projectGroups } from '../src/project-catalog.js';
import { source } from './host-fixture.js';

test('sidebar shares the settings controller, follows later registration and releases it on unload', () => {
  const entries = [], slotListeners = new Set(), workspaces = source({ items: [] });
  const ctx = { slots: { entries: () => entries, subscribe(_key, listener) { slotListeners.add(listener); return () => slotListeners.delete(listener); } }, workspaces: { list: workspaces } };
  const catalog = createProjectCatalog(ctx), dispose = catalog.start();
  assert.equal(catalog.getSnapshot().ready, false);
  let mounted = 0, loaded = 0, notifications = 0;
  const controller = { ...source({ view: { localId: 'local', projects: [{ key: 'git:x', name: '项目', icon: null,
    checkouts: [{ id: 'one', environmentId: 'local', path: '/one' }, { id: 'one', environmentId: 'remote', path: '/remote' }] }] } }),
    mount() { mounted++; return () => mounted--; }, load() { loaded++; } };
  catalog.subscribe(() => notifications++);
  entries.push({ id: 'dsh-project-manager', inject: () => ({ hooks: { projectManager: controller } }) });
  for (const fn of slotListeners) fn();
  assert.equal(mounted, 1); assert.equal(catalog.getSnapshot().projects[0].checkouts.length, 1);
  assert.equal(catalog.getSnapshot().projects[0].checkouts[0].path, '/one');
  const old = controller.getSnapshot();
  controller.set({ ...old, view: { ...old.view, runs: [{ id: 'not-an-identity-change' }] } });
  assert.equal(notifications, 1);
  controller.set({ view: { ...old.view, projects: [{ ...old.view.projects[0], name: '新名称', icon: { kind: 'emoji', value: '🌿' } }] } });
  assert.equal(catalog.getSnapshot().projects[0].name, '新名称');
  workspaces.set({ items: [{ workspaceId: 'new' }] }); assert.equal(loaded, 1);
  entries.pop(); for (const fn of slotListeners) fn();
  assert.equal(mounted, 0); assert.equal(catalog.getSnapshot().ready, false);
  dispose(); assert.equal(slotListeners.size, 0); assert.equal(workspaces.listeners.size, 0);
});

test('projects merge local checkouts without confusing remote workspace IDs or duplicating sessions', () => {
  const workspaces = [{ workspaceId: 'one', title: '旧名称' }, { workspaceId: 'two', title: '另一个检出' }];
  const rows = [{ id: 'a', workspace: workspaces[0], session: {} }, { id: 'b', workspace: workspaces[1], session: {} }];
  const groups = projectGroups(workspaces, rows, { projects: [{ key: 'git:x', name: '统一项目', pinned: true,
    checkouts: [{ id: 'one' }, { id: 'two' }] }, { key: 'remote-only', name: '远程项目', checkouts: [] }] });
  assert.equal(groups.length, 1); assert.deepEqual(groups[0].rows.map(r => r.id), ['a', 'b']);
  assert.deepEqual(groups[0].workspaceIds, ['one', 'two']); assert.equal(groups[0].name, '统一项目');
});

test('workspaces and orphaned sessions remain browsable without a project-manager installation', () => {
  const workspaces = [{ workspaceId: 'one', title: '本地项目' }];
  const groups = projectGroups(workspaces, [{ id: 'orphan', session: { cwd: '/kept/project' } },
    { id: 'known', workspace: workspaces[0], session: {} }], { projects: [] });
  assert.deepEqual(groups.map(g => g.rows.map(r => r.id)), [['known'], ['orphan']]);
  assert.equal(groups[1].name, 'project'); assert.equal(groups[1].workspaceIds.length, 0);
});
