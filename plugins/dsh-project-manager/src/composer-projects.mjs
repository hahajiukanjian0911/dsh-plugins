// The composer can select only directories registered on its own DSH host.
// Keep the native workspace ID so ConversationContent owns draft/attachment transfer.
export function composerProjects(view, workspaces, selectedId, showArchived = false) {
  const registered = new Map(workspaces.items.map(w => [w.workspaceId, w]));
  const claimed = new Set(), projects = [];
  for (const project of view.projects) {
    const checkouts = project.checkouts.filter(c => c.environmentId === view.localId && registered.has(c.id));
    if (!checkouts.length) continue;
    for (const c of checkouts) claimed.add(c.id);
    projects.push({ ...project, checkouts: checkouts.map(c => ({ ...registered.get(c.id), ...c })) });
  }
  for (const w of workspaces.items) if (!claimed.has(w.workspaceId)) {
    projects.push({ key: 'workspace:' + w.workspaceId, name: w.title, icon: null,
      checkouts: [{ ...w, id: w.workspaceId, path: w.path }] });
  }
  projects.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)
    || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  return {
    selected: projects.find(p => p.checkouts.some(c => c.id === selectedId)),
    hasArchived: projects.some(p => p.archived),
    projects: projects.filter(p => showArchived || !p.archived || p.checkouts.some(c => c.id === selectedId)),
  };
}
