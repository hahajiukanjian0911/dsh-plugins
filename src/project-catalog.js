const EMPTY = Object.freeze({ ready: false, projects: [], localId: null });

// Reuse the project manager's public settings injection and its controller.
// This remains optional: ordinary DSH workspaces are usable without that plugin.
export function createProjectCatalog(ctx) {
  let snapshot = EMPTY, controller, unsubscribe, unmount, signature = '';
  const listeners = new Set();
  function publish() {
    const view = controller?.getSnapshot().view;
    const next = view ? { ready: true, localId: view.localId,
      projects: view.projects.map(({ key, name, icon, pinned, archived, checkouts }) => ({ key, name, icon, pinned, archived,
        checkouts: checkouts.filter(c => c.environmentId === view.localId).map(({ id, key, path, title, online, missing }) => ({ id, key, path, title, online, missing })) })) } : EMPTY;
    const nextSignature = JSON.stringify(next);
    if (signature === nextSignature) return;
    snapshot = next; signature = nextSignature;
    for (const listener of listeners) listener();
  }
  function connect() {
    const entry = ctx.slots.entries('settings.section').find(entry => (entry.id ?? entry.options?.id) === 'dsh-project-manager');
    const next = entry?.inject?.().hooks?.projectManager;
    if (next === controller) return;
    unsubscribe?.(); unmount?.(); controller = next;
    unsubscribe = controller?.subscribe(publish);
    unmount = controller?.mount();
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      const dispose = ctx.slots.subscribe('settings.section', connect);
      const workspaceChange = ctx.workspaces.list.subscribe(() => { void controller?.load(); });
      connect();
      return () => { dispose(); workspaceChange(); unsubscribe?.(); unmount?.(); listeners.clear(); };
    },
  };
}

export function projectGroups(workspaces, rows, catalog) {
  const byWorkspace = new Map(), groups = [];
  for (const project of catalog.projects) {
    const ids = project.checkouts.map(checkout => checkout.id).filter(id => workspaces.some(w => w.workspaceId === id));
    if (!ids.length) continue;
    const group = { ...project, workspaceIds: ids, rows: [] };
    groups.push(group); for (const id of ids) byWorkspace.set(id, group);
  }
  for (const workspace of workspaces) if (!byWorkspace.has(workspace.workspaceId)) {
    const group = { key: 'workspace:' + workspace.workspaceId, name: workspace.title || workspace.path, icon: null,
      workspaceIds: [workspace.workspaceId], checkouts: [{ id: workspace.workspaceId, path: workspace.path }], rows: [] };
    groups.push(group); byWorkspace.set(workspace.workspaceId, group);
  }
  const orphans = new Map();
  for (const row of rows) {
    let group = byWorkspace.get(row.workspace?.workspaceId);
    if (!group) {
      const cwd = row.session.cwd || '';
      group = orphans.get(cwd);
      if (!group) {
        group = { key: 'unregistered:' + cwd, name: cwd.split(/[\\/]/).filter(Boolean).at(-1),
          workspaceIds: [], checkouts: [], rows: [], unregistered: true };
        orphans.set(cwd, group); groups.push(group);
      }
    }
    group.rows.push(row);
  }
  return groups.sort((a, b) => Number(!!a.unregistered) - Number(!!b.unregistered)
    || Number(!!b.pinned) - Number(!!a.pinned) || (a.name || '').localeCompare(b.name || '', 'zh-Hans') || a.key.localeCompare(b.key));
}
