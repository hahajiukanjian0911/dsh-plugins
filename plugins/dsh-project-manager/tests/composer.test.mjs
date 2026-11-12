import test from 'node:test';
import assert from 'node:assert/strict';
import { composerProjects } from '../src/composer-projects.mjs';

test('composer matches local registered checkouts, retains grouped identities and newly registered directories', () => {
  const view = { localId: 'local', projects: [
    { key: 'repo', name: '项目名称', icon: { kind: 'glyph', value: 'code' }, pinned: true,
      checkouts: [{ id: 'a', environmentId: 'local' }, { id: 'b', environmentId: 'local', missing: true },
        { id: 'collision', environmentId: 'remote' }, { id: 'removed', environmentId: 'local' }] },
  ] };
  const workspaces = { items: ['a', 'b', 'collision', 'new'].map(workspaceId => ({ workspaceId, title: workspaceId, path: '/'+workspaceId })) };
  const result = composerProjects(view, workspaces, 'b');
  assert.equal(result.projects.length, 3);
  assert.equal(result.selected.name, '项目名称');
  assert.equal(result.selected.icon.value, 'code');
  assert.deepEqual(result.selected.checkouts.map(c => c.id), ['a', 'b']);
  assert.equal(result.selected.checkouts[1].missing, true);
  assert.equal(result.projects.find(p => p.key === 'workspace:collision').name, 'collision');
  assert.equal(result.projects.some(p => p.checkouts.some(c => c.id === 'removed')), false);
});

test('archived projects stay selected and discoverable without changing workspace membership', () => {
  const workspaces = { items: ['a','b'].map(workspaceId => ({ workspaceId, title: workspaceId, path: '/'+workspaceId })) };
  const view = { localId: 'local', projects: ['a','b'].map(key => ({ key, name: key, archived: true, checkouts: [{ id: key, environmentId:'local' }] })) };
  assert.deepEqual(composerProjects(view, workspaces, 'a').projects.map(p => p.key), ['a']);
  assert.equal(composerProjects(view, workspaces, 'a').hasArchived, true);
  assert.equal(composerProjects(view, workspaces, 'a', true).projects.length, 2);
  assert.deepEqual(workspaces.items.map(w => w.workspaceId), ['a','b']);
});
