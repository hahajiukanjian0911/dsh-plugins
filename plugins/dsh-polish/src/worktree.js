// Native Forge owns the session store, validation and RPCs. The optional Project
// Manager contribution only changes where that session context is presented.
export function installWorktreeMenu(ctx, React, P) {
  if (typeof ctx.inject !== 'function') return;
  const h = React.createElement;
  const channels = new WeakMap(), emptyMenu = { open: false, anchorRef: null };
  const noSubscribe = () => () => {}, noModel = () => null, noMenu = () => emptyMenu;
  function source(value) {
    const listeners = new Set();
    return { getSnapshot: () => value, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      set(next) { if (next === value) return; value = next; for (const listener of listeners) listener(); } };
  }
  function channelFor(node) {
    const row = node?.closest('[class*="_heroWorkspaceRow"]');
    if (!row) return null;
    let channel = channels.get(row);
    if (!channel) channels.set(row, channel = { model: source(null), menu: source(emptyMenu) });
    return channel;
  }
  function useSource(store, fallback) { return React.useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getSnapshot ?? fallback); }
  const supported = props => ['usePanel', 'request', 'cancel', 'branches', 't'].every(key => typeof props[key] === 'function');
  function useWorktree({ usePanel, request, cancel, branches, t }, open, anchorRef) {
    const state = usePanel(s => s.state);
    const [pending, setPending] = React.useState(false);
    const [catalog, setCatalog] = React.useState(null);
    const [error, setError] = React.useState(null);
    const alive = React.useRef(false), inFlight = React.useRef(false);
    const requested = state?.worktree.request !== null && state?.worktree.request !== undefined;
    const usable = state?.worktree.blocker === null;
    const visible = state !== null && state?.worktree.editable === true
      && state.worktree.blocker !== 'not-git' && state.checkout.state === 'ready';
    React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    React.useEffect(() => {
      let current = true;
      setCatalog(null);
      if (open && visible && requested && usable) {
        Promise.resolve().then(() => branches()).then(value => { if (current) setCatalog(value ?? null); })
          .catch(() => { if (current) setError(t('toast.branchesFailed')); });
      }
      return () => { current = false; };
    }, [open, visible, requested, usable, branches, t]);
    const toast = error && h(P.Toast, { text: error, anchor: anchorRef?.current, onDone: () => setError(null) });
    if (!visible) return { visible, toast };
    const held = state.worktree.creation !== null;
    const disabled = held || pending || (!usable && !requested);
    const current = state.checkout.checkout.branch, commit = state.checkout.checkout.commit;
    const base = requested ? state.worktree.request.from : current;
    const summary = requested ? base === null ? t('worktree.baseHead') : t('worktree.base', { branch: base })
      : current ?? (commit === null ? t('checkout.detached') : t('worktree.detachedTip', { commit }));
    const hint = state.worktree.blocker === null ? t('worktree.hint') : t('worktree.blocked.' + state.worktree.blocker);
    const branchTip = requested || current === null ? summary : t('worktree.currentBranchTip', { branch: current });
    async function change(action) {
      if (inFlight.current) return;
      inFlight.current = true; setPending(true); setError(null);
      try { await action(); }
      catch { if (alive.current) setError(t('toast.worktreeFailed')); }
      finally { inFlight.current = false; if (alive.current) setPending(false); }
    }
    const items = [{ id: 'worktree:toggle', label: t('worktree.label'), disabled }];
    if (requested && usable) {
      items.push({ type: 'separator', id: 'worktree:separator' });
      items.push({ type: 'label', id: 'worktree:base-label', text: t('worktree.baseMenu') });
      if (current === null) items.push({ id: 'head:', label: t('worktree.baseHead'), disabled: held || pending });
      for (const name of catalog?.branches ?? []) items.push({ id: 'branch:' + name, label: name,
        disabled: held || pending, icon: h(P.IconBranchOutlineRegular, { size: 14 }) });
    }
    return { visible, summary, requested, busy: pending || held, tip: branchTip + '\n' + hint, items, toast,
      selectedIds: requested ? ['worktree:toggle', base === null ? 'head:' : 'branch:' + base] : [],
      onSelect: id => {
        if (id === 'worktree:toggle') { if (!disabled) void change(() => requested ? cancel() : request(current)); return true; }
        if (id === 'head:' || id.startsWith('branch:')) {
          const from = id === 'head:' ? null : id.slice(7);
          if (requested && usable && !held && !pending && from !== base) void change(() => request(from));
          return true;
        }
        return false;
      },
    };
  }
  function WorktreeMenu(props) {
    return supported(props) ? h(props.polishFuseProject ? ProjectContextSource : BranchMenu, { ...props, key: props.polishSessionId }) : h(props.polishNativeWorktree, props);
  }
  function BranchMenu(props) {
    const [open, setOpen] = React.useState(false), trigger = React.useRef(null);
    const context = useWorktree(props, open, trigger);
    React.useEffect(() => { if (!context.visible) setOpen(false); }, [context.visible]);
    if (!context.visible) return null;
    return h('span', { 'data-forge-worktree': '', 'data-dsp-worktree-menu': '' },
      h(P.Menu, { open, items: context.items, selectedIds: context.selectedIds, portal: true, side: 'top', autoFocus: true,
        onClose: () => setOpen(false), returnFocus: () => trigger.current,
        onSelect: id => { if (context.onSelect(id)) setOpen(false); },
        anchor: h(P.Tooltip, { label: context.tip, side: 'top', delayMs: 400 },
          h('button', { ref: trigger, type: 'button', className: 'dsp-worktree-trigger',
            'aria-label': context.summary + ' · ' + props.t('worktree.label'), 'aria-haspopup': 'menu', 'aria-expanded': open,
            'aria-busy': context.busy, 'data-requested': context.requested ? '' : undefined,
            'data-forge-current-branch': context.requested ? undefined : '', 'data-forge-base-branch': context.requested ? '' : undefined,
            onClick: () => setOpen(v => !v) },
          h(P.IconBranchOutlineRegular, { size: 14 }), h('span', null, context.summary), h(P.IconChevronDownOutlineRegular, { size: 12 }))),
      }), context.toast);
  }
  // Workspace is a root slot; Forge is a strict-session slot. Keep Forge's
  // injection in that session and exchange only UI state within this hero row.
  function ProjectContextSource(props) {
    const ref = React.useRef(null), [channel, setChannel] = React.useState(undefined);
    React.useLayoutEffect(() => { setChannel(channelFor(ref.current)); }, []);
    return h(React.Fragment, null, h('span', { ref, hidden: true, 'data-dsp-context-source': '' }),
      channel ? h(ContextPublisher, { ...props, channel }) : channel === null ? h(BranchMenu, props) : null);
  }
  function ContextPublisher(props) {
    const { channel } = props, token = React.useRef({});
    const menu = useSource(channel.menu, noMenu);
    const model = useWorktree(props, menu.open, menu.anchorRef);
    React.useLayoutEffect(() => () => { if (channel.modelOwner === token.current) { channel.modelOwner = null; channel.model.set(null); } }, [channel]);
    React.useLayoutEffect(() => { channel.modelOwner = token.current; channel.model.set(model); });
    return model.toast;
  }
  function WorkspaceAdapter(props) {
    const [channel, setChannel] = React.useState(null), token = React.useRef({});
    const model = useSource(channel?.model, noModel);
    React.useLayoutEffect(() => { setChannel(channelFor(props.anchorRef?.current)); }, [props.anchorRef]);
    React.useLayoutEffect(() => () => { if (channel?.menuOwner === token.current) { channel.menuOwner = null; channel.menu.set(emptyMenu); } }, [channel]);
    React.useLayoutEffect(() => {
      if (!channel) return;
      channel.menuOwner = token.current;
      const menu = channel.menu.getSnapshot();
      if (menu.open !== props.open || menu.anchorRef !== props.anchorRef) channel.menu.set({ open: props.open, anchorRef: props.anchorRef });
    }, [channel, props.open, props.anchorRef]);
    return h(props.polishNativeWorkspace, { ...props, projectContext: model?.visible ? model : undefined });
  }
  ctx.inject(['slots'], scope => scope.slots.inject('conversation.hero.options', () => scope.effect(() => {
    const optionsSlot = 'conversation.hero.options', workspaceSlot = 'conversation.hero.workspace';
    let originalForge, originalProject, disposeForge, disposeProject, installing = false;
    function install() {
      if (installing) return;
      const forge = scope.slots.entries(optionsSlot).find(e => e.component !== WorktreeMenu
        && e.options?.id === 'forge-panel.worktree');
      const winner = scope.slots.entries(workspaceSlot).find(e => e.component !== WorkspaceAdapter);
      const project = winner?.component.dshProjectContextVersion === 1 ? winner : undefined;
      if (forge === originalForge && project === originalProject) return;
      installing = true;
      try {
        disposeProject?.(); disposeProject = undefined; disposeForge?.(); disposeForge = undefined;
        originalForge = forge; originalProject = project;
        if (!forge) return;
        if (project) disposeProject = scope.slots.register({ name: workspaceSlot,
          priority: (project.options?.priority ?? 0) - 100, locale: project.locale ?? project.options?.locale,
          ...(project.store ? { store: project.store } : {}),
          inject: (...args) => ({ ...project.inject?.(...args), polishNativeWorkspace: project.component }),
        }, WorkspaceAdapter);
        disposeForge = scope.slots.register({ name: optionsSlot, id: forge.options.id,
          priority: (forge.options.priority ?? 0) - 100, order: forge.options.order,
          locale: forge.locale ?? forge.options.locale, ...(forge.store ? { store: forge.store } : {}),
          inject: (...args) => ({ ...forge.inject?.(...args), polishNativeWorktree: forge.component, polishSessionId: args[0], polishFuseProject: !!project }),
        }, WorktreeMenu);
      } finally { installing = false; }
    }
    const offForge = scope.slots.subscribe(optionsSlot, install), offProject = scope.slots.subscribe(workspaceSlot, install);
    install();
    return () => { offForge(); offProject(); disposeProject?.(); disposeForge?.(); };
  }, 'polish: native session context in project picker')));
}
