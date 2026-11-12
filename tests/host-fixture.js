export function source(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next) { value = next; for (const listener of [...listeners]) listener(); },
    listeners,
  };
}

export function createHostFixture(environment) {
  const now = Date.now();
  const definitions = [
    ['pin', '提醒时间规则', 'TimeRing'], ['answer', '核对提货单有效期', 'LiQun'],
    ['result', '检查快速记录的解析结果', 'TimeRing'], ['current', '实现会话收件箱', 'dsh-plugins'],
    ['working', '整理接口调用记录', 'LiQun'], ['later', '审阅侧栏交互细节', 'dsh-plugins'],
    ['old', '调整设置页文案', 'TimeRing'],
  ];
  const byId = Object.fromEntries(definitions.map(([id, title, project], index) => [id, {
    id, title, displayTitle: title, cwd: '/example/' + project,
    updatedAt: now - (index + 1) * 300_000, running: id === 'working', blank: false,
    retainedBy: { mainView: id === 'current' ? 1 : 0 },
  }]));
  const sessions = source({ phase: 'ready', ids: Object.keys(byId), byId });
  const workspaces = source({ phase: 'ready', state: 'idle', pinnedSessionIds: ['pin'], archivedSessionIds: [],
    items: ['TimeRing', 'LiQun', 'dsh-plugins'].map((title) => ({
      workspaceId: title, title, path: '/example/' + title,
      sessionIds: definitions.filter((entry) => entry[2] === title).map((entry) => entry[0]),
    })),
  });
  const status = source(new Map([
    ['working', { running: true }],
    ['answer', { running: false, pendingInteraction: { kind: 'question' } }],
  ]));
  const shortcutState = source({ searchRequest: 0, addRequested: false, directoryBusy: false, renameTarget: null });
  const slotListeners = new Map();
  const effects = [];
  const events = new Map();
  const dictionaries = new Map();
  const calls = [];
  let draftSequence = 0;
  const native = {
    hooks: { workspaceShortcuts: shortcutState },
    closeAddWorkspace() { shortcutState.set({ ...shortcutState.getSnapshot(), addRequested: false }); },
    setDirectoryBusy(busy) { shortcutState.set({ ...shortcutState.getSnapshot(), directoryBusy: busy }); },
    requestSessionRename(id) { calls.push(['rename', id]); },
  };
  const original = { options: { priority: 0 }, children: { 'sidebar.workspaces.directoryFlow': {} }, inject: () => native };
  const entriesBySlot = new Map([
    ['sidebar.workspaces', [original]],
    ['sidebar.brand.name', [{ options: { priority: 0 } }]],
  ]);
  const emptyEntries = [];
  const notifySlots = (key) => { for (const listener of slotListeners.get(key) ?? []) listener(); };
  const panelInfo = source({ activePanelId: null });
  const ctx = {
    effect(factory) {
      const result = factory();
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        if (typeof result === 'function') result();
      };
      effects.push(dispose);
      return dispose;
    },
    locale: {
      register(namespace, bundles) { dictionaries.set(namespace, bundles); return () => dictionaries.delete(namespace); },
      bind(namespace) { return (key, params = {}) => {
        const lang = environment.document?.documentElement?.lang === 'en' ? 'en' : 'zh';
        return Object.entries(params).reduce((text, [name,value]) => text.replaceAll('{'+name+'}', String(value)), dictionaries.get(namespace)?.[lang]?.[key] ?? key);
      }; },
    },
    sessions: { list: sessions, refresh: async () => {},
      async using(id, options, operation) {
        calls.push(['using', id, options.source]);
        try {
          if (!sessions.getSnapshot().byId[id]) throw new Error('Session is no longer available.');
          const value = await operation({ binding: { session: { async rename(title) {
            calls.push(['renameSaved', id, title]);
            const list = sessions.getSnapshot();
            sessions.set({ ...list, byId: { ...list.byId, [id]: { ...list.byId[id], title, displayTitle: title } } });
          } } } });
          return { ok: true, value };
        } catch (error) { return { ok: false, error: { message: error.message } }; }
      },
      search: async (query) => ({ ok: true, value: { hasMore: false,
        items: query === '消息关键字' ? [{ sessionId: 'working', snippet: '这里包含消息关键字。' }] : [] } }),
    },
    workspaces: { list: workspaces, create: async ({ path }) => ({ workspaceId: path }) },
    uiSession: { sessionStatus: status },
    layout: { panelInfo },
    remote: { $on(name, listener) {
      const set = events.get(name) ?? new Set();
      set.add(listener); events.set(name, set);
      return () => set.delete(listener);
    } },
    uiWorkspace: {
      openSession(id) {
        calls.push(['open', id]);
        const current = sessions.getSnapshot();
        sessions.set({ ...current, byId: Object.fromEntries(Object.entries(current.byId)
          .map(([key, value]) => [key, { ...value, retainedBy: { mainView: key === id ? 1 : 0 } }])) });
      },
      startSession(workspaceId) {
        calls.push(['start', workspaceId]);
        const current = sessions.getSnapshot();
        const projects = workspaces.getSnapshot();
        const selected = Object.values(current.byId).find(item => item.retainedBy?.mainView > 0);
        const workspace = projects.items.find(item => item.workspaceId === workspaceId)
          ?? projects.items.find(item => item.sessionIds.includes(selected?.id)) ?? projects.items[0];
        if (!workspace) return;
        const existing = workspace.sessionIds.find(id => current.byId[id]?.blank && !projects.archivedSessionIds.includes(id));
        const id = existing ?? 'draft-' + (++draftSequence);
        const blank = current.byId[id] ?? { id, title: null, displayTitle: '新建会话', cwd: workspace.path,
          updatedAt: Date.now(), running: false, blank: true };
        if (!existing) workspaces.set({ ...projects, items: projects.items.map(item => item === workspace
          ? { ...item, sessionIds: [...item.sessionIds, id] } : item) });
        sessions.set({ ...current, ids: existing ? current.ids : [...current.ids, id],
          byId: Object.fromEntries(Object.entries({ ...current.byId, [id]: blank })
            .map(([key, value]) => [key, { ...value, retainedBy: { mainView: key === id ? 1 : 0 } }])) });
        panelInfo.set({ activePanelId: null });
      },
      pickDirectory: async () => null,
      async pinSession(id) {
        const current = workspaces.getSnapshot();
        workspaces.set({ ...current, pinnedSessionIds: [...current.pinnedSessionIds, id] });
      },
      async unpinSession(id) {
        const current = workspaces.getSnapshot();
        workspaces.set({ ...current, pinnedSessionIds: current.pinnedSessionIds.filter((item) => item !== id) });
      },
      async unarchiveSession(id) {
        const current = workspaces.getSnapshot();
        workspaces.set({ ...current, archivedSessionIds: current.archivedSessionIds.filter((item) => item !== id) });
      },
    },
    slots: {
      entries: (key) => entriesBySlot.get(key) ?? emptyEntries,
      subscribe(key, listener) {
        const listeners = slotListeners.get(key) ?? new Set();
        listeners.add(listener); slotListeners.set(key, listeners);
        return () => listeners.delete(listener);
      },
      inject(key, callback) { return ctx.effect(callback); },
      register(options, component) {
        const entries = entriesBySlot.get(options.name) ?? [];
        if (entries.some((entry) => entry.options.priority === options.priority
          && (!['conversation.input.dock','settings.section','settings.section.icon'].includes(options.name) || entry.options.id === options.id))) throw new Error('Duplicate slot priority');
        const entry = { options, component, inject: options.inject, children: options.children, locale: options.locale };
        entriesBySlot.set(options.name, [...entries, entry].sort((a, b) => a.options.priority - b.options.priority));
        notifySlots(options.name);
        return () => {
          entriesBySlot.set(options.name, entriesBySlot.get(options.name).filter((item) => item !== entry));
          notifySlots(options.name);
        };
      },
    },
  };
  return { ctx, environment, sessions, workspaces, status, shortcutState, original, calls, events,
    winner: (key = 'sidebar.workspaces') => entriesBySlot.get(key)[0],
    finish(id) {
      const next = new Map(status.getSnapshot());
      next.set(id, { running: false }); status.set(next);
      const list = sessions.getSnapshot();
      sessions.set({ ...list, byId: { ...list.byId, [id]: { ...list.byId[id], running: false, updatedAt: Date.now() } } });
    },
    dispose() { for (const dispose of effects.toReversed()) dispose(); },
  };
}
