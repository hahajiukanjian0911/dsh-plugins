import { createProjectIcon } from './identity.jsx';
import { composerProjects } from './composer-projects.mjs';
import styles from './composer.css';

export function installComposerProjects(ctx, React, P, ReactDOM, controller) {
  const ProjectIcon = createProjectIcon(React, P);
  const empty = { phase: 'ready', items: [] };
  const useEmptyWorkspaces = select => select(empty);
  const Icon = ({ project }) => <span className="dpm-composer-icon"><ProjectIcon project={project} compact /></span>;
  const flowSlot = 'conversation.hero.workspace.directoryFlow';
  const flowEntries = () => ctx.slots.entries(flowSlot);
  const subscribeFlows = listener => ctx.slots.subscribe(flowSlot, listener);

  function ProjectPicker(props) {
    const { nativePicker: NativePicker, useWorkspaces, anchorRef, open, selectedId, onPick, onClose, projectT: t, projectContext } = props;
    const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    const workspaces = useWorkspaces(s => s);
    const flows = React.useSyncExternalStore(subscribeFlows, flowEntries);
    const flow = flows[0];
    // The native picker owns this child declaration. Reuse its selected leaf
    // provider and cached injected callbacks without declaring the slot again.
    const flowInjected = React.useMemo(() => flow?.inject?.() ?? {}, [flow]);
    const renderDirectoryFlow = React.useCallback((name, owner) => name === flowSlot && flow
      ? React.createElement(flow.component, { ...flowInjected, ...owner }) : null, [flow, flowInjected]);
    const [showArchived, setShowArchived] = React.useState(false);
    const [directoryOpen, setDirectoryOpen] = React.useState(false);
    const [anchor, setAnchor] = React.useState(null);
    React.useEffect(() => controller.mount(), []);
    React.useEffect(() => { void controller.load(); }, [workspaces]);
    React.useLayoutEffect(() => { setAnchor(anchorRef?.current ?? null); }, [anchorRef]);
    React.useEffect(() => {
      if (!anchor || !open) return;
      // Menu's portal treats the native external trigger as an outside press.
      // Keep that pointerdown local so its original click can toggle once.
      const keepTriggerPress = event => event.stopPropagation();
      anchor.addEventListener('pointerdown', keepTriggerPress);
      return () => anchor.removeEventListener('pointerdown', keepTriggerPress);
    }, [anchor, open]);
    const view = state.view ?? (projectContext ? { localId: '', projects: [] } : null);
    const catalog = view ? composerProjects(view, workspaces, selectedId, showArchived) : null;
    const project = workspaces.phase === 'ready' ? catalog?.selected : null;
    const checkout = project?.checkouts.find(c => c.id === selectedId);
    const summary = projectContext?.summary;
    const chipLabel = project ? t('chooseProject') + ': ' + project.name + (summary ? ' · ' + summary : '') : null;
    // The host exposes the picker slot and its button ref, but no chip-content slot.
    // Portal only the identity into that button; retain its click/focus/expanded state.
    React.useLayoutEffect(() => {
      if (!anchor || !project) return;
      const label = anchor.getAttribute('aria-label'), title = anchor.getAttribute('title');
      const busy = anchor.getAttribute('aria-busy');
      anchor.setAttribute('data-dpm-project-anchor', '');
      anchor.toggleAttribute('data-dpm-project-context', !!summary);
      if (projectContext) anchor.setAttribute('aria-busy', String(projectContext.busy));
      anchor.setAttribute('aria-label', chipLabel);
      anchor.setAttribute('title', [checkout?.path || project.name, projectContext?.tip].filter(Boolean).join('\n'));
      return () => {
        anchor.removeAttribute('data-dpm-project-anchor');
        anchor.removeAttribute('data-dpm-project-context');
        if (busy === null) anchor.removeAttribute('aria-busy'); else anchor.setAttribute('aria-busy', busy);
        if (label === null) anchor.removeAttribute('aria-label'); else anchor.setAttribute('aria-label', label);
        if (title === null) anchor.removeAttribute('title'); else anchor.setAttribute('title', title);
      };
    }, [anchor, chipLabel, checkout?.path, projectContext?.tip, projectContext?.busy]);
    const getAnchorRect = React.useCallback(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
    const closeDirectory = React.useCallback(() => setDirectoryOpen(false), []);

    const canAdd = props.useDirectoryFlow(s => s);
    if (!catalog || workspaces.phase !== 'ready') return <NativePicker {...props} renderSlot={renderDirectoryFlow} />;
    const label = (name, path) => <span className="dpm-composer-option" title={path}>
      <span>{name}</span><small>{path}</small>
    </span>;
    const items = catalog.projects.map(p => {
      const available = p.checkouts.some(c => !c.missing && c.online !== false);
      if (p.checkouts.length === 1) {
        const c = p.checkouts[0];
        return { id: 'checkout:' + c.id, label: label(p.name, c.path), icon: <Icon project={p} />, disabled: !available };
      }
      return { id: 'project:' + p.key, label: p.name, icon: <Icon project={p} />, disabled: !available,
        submenu: p.checkouts.map(c => ({ id: 'checkout:' + c.id, label: label(c.title || p.name, c.path),
          icon: <P.IconFolderCloseRegular size={16} />, disabled: !!c.missing || c.online === false })) };
    });
    const footer = [
      ...(catalog.hasArchived ? [{ id: 'action:archived', label: t(showArchived ? 'hideArchivedProjects' : 'showArchivedProjects'), icon: <P.IconArchiveOutlineRegular size={16} /> }] : []),
      ...(canAdd ? [{ id: 'action:add', label: t('addProject'), icon: <P.IconPlusOutlineRegular size={16} /> }] : []),
    ];
    return <>
      <style>{styles}</style>
      {anchor && project && ReactDOM.createPortal(<span className="dpm-composer-chip"><Icon project={project} /><span className="dpm-composer-name">{project.name}</span>{summary && <span className="dpm-composer-context"><span aria-hidden="true">·</span><span>{summary}</span></span>}</span>, anchor)}
      <P.Menu open={open} anchor={null} getAnchorRect={getAnchorRect}
        items={projectContext?.items?.length ? [...items, {type:'separator',id:'project-context:separator'}, ...projectContext.items] : items} footer={footer}
        selectedIds={['checkout:' + selectedId, ...(project ? ['project:' + project.key] : []), ...(projectContext?.selectedIds ?? [])]}
        onClose={onClose} portal autoFocus returnFocus={() => anchorRef?.current ?? null}
        onSelect={id => {
          if (projectContext?.onSelect?.(id)) { onClose(); return; }
          if (id === 'action:archived') { setShowArchived(v => !v); return; }
          if (id === 'action:add') { onClose(); setDirectoryOpen(true); return; }
          const c = catalog.projects.flatMap(p => p.checkouts).find(c => 'checkout:' + c.id === id);
          if (c && !c.missing && c.online !== false) onPick(c.id);
        }} />
      <NativePicker {...props} open={directoryOpen} useWorkspaces={useEmptyWorkspaces} onClose={closeDirectory} renderSlot={renderDirectoryFlow} />
    </>;
  }
  // Optional session context contribution; consumers must retain native callbacks.
  ProjectPicker.dshProjectContextVersion = 1;

  return ctx.slots.inject('conversation.hero.workspace', () => ctx.effect(() => {
    let original, disposeEntry, installing = false;
    function install() {
      if (installing) return;
      const next = ctx.slots.entries('conversation.hero.workspace').find(e => e.component !== ProjectPicker
        && e.children?.['conversation.hero.workspace.directoryFlow']);
      if (next === original) return;
      installing = true;
      try {
        disposeEntry?.(); disposeEntry = undefined; original = next;
        if (!next) return;
        disposeEntry = ctx.slots.register({ name: 'conversation.hero.workspace', priority: -100,
          locale: next.locale ?? next.options?.locale,
          ...(next.store ? { store: next.store } : {}),
          inject: (...args) => ({ ...next.inject?.(...args), nativePicker: next.component, projectT: ctx.locale.bind('projectManager') }),
        }, ProjectPicker);
      } finally { installing = false; }
    }
    const unsubscribe = ctx.slots.subscribe('conversation.hero.workspace', install);
    install();
    return () => { unsubscribe(); disposeEntry?.(); };
  }, 'project-manager: composer project picker'));
}
