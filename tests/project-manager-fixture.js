import { projectGroups, defaultActions } from '../plugins/dsh-project-manager/src/model.mjs';

// In-memory RPC backend for the shipped project-manager client. Never touches a
// registered user project; session and workspace data belong to the preview.
export function installProjectManagerFixture(fixture) {
  const localId = 'local-demo', metadata = { revision: 0, projects: {}, assignments: {}, defaults: { actions: [] } };
  metadata.projects['directory:local-demo:TimeRing'] = { icon: { kind: 'glyph', value: 'globe', color: '#0ea5e9' } };
  metadata.projects['directory:local-demo:LiQun'] = { icon: { kind: 'glyph', value: 'shield', color: '#22c55e' } };
  metadata.projects['directory:local-demo:dsh-plugins'] = { icon: { kind: 'monogram', value: 'DP', color: '#6366f1' } };
  const snapshot = () => {
    const environments = [{ id: localId, local: true, name: '示例 Mac', online: true,
      workspaces: fixture.workspaces.getSnapshot().items.map(w => ({ id: w.workspaceId, title: w.title, path: w.path, missing: !!w.missing, sessionCount: w.sessionIds.length })) }];
    return { ...structuredClone(metadata), localId, environments, projects: projectGroups(metadata, environments),
      defaults: { actions: [], mixed: false, resolved: { [localId]: defaultActions(metadata, localId) } }, runs: [] };
  };
  fixture.ctx.connection = { rpc: { async call(_route, method, { args: { request: r } }) {
    fixture.calls.push([method, structuredClone(r)]);
    if (method === 'projectManager/load') return { ok: true, value: snapshot() };
    if (method === 'projectManager/change') {
      if (r.revision !== metadata.revision) return { ok: false, error: { message: '项目配置已在其他窗口更改，请刷新后重试。' } };
      const project = snapshot().projects.find(p => p.key === r.projectKey), meta = metadata.projects[r.projectKey] ??= {};
      if (r.op === 'icon') meta.icon = r.icon;
      else if (r.op === 'rename') { meta.name = r.name; const workspaces = fixture.workspaces.getSnapshot();
        fixture.workspaces.set({ ...workspaces, items: workspaces.items.map(w => project.checkouts.some(c => c.id === w.workspaceId) ? { ...w, title: r.name } : w) }); }
      else if (r.op === 'organize') { for (const key of ['pinned', 'archived']) if (key in r) meta[key] = r[key]; }
      else if (r.op === 'assign') metadata.assignments[r.checkoutKey] = r.destination;
      metadata.revision++; return { ok: true, value: {} };
    }
    throw new Error('Unsupported preview RPC: ' + method);
  } } };
  return { snapshot, metadata };
}
