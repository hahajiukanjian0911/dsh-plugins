import { createInboxModel, deriveInboxRows } from './inbox-state.js';

export function createInboxController(ctx, environment = window) {
  const model = createInboxModel({ storage: {
    getItem: (key) => environment.localStorage.getItem(key),
    setItem: (key, value) => environment.localStorage.setItem(key, value),
  } });
  const listeners = new Set();
  const busy = new Set();
  let snapshot;
  let timer;
  let undoTimer;
  let undo = null;
  const archiveWakeAttempts = new Map();
  let refreshing = false;
  let stopped = false;
  let operationError = null;
  let native;

  function currentId() {
    if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return undefined;
    return Object.values(ctx.sessions.list.getSnapshot().byId)
      .find((session) => (session.retainedBy?.mainView ?? 0) > 0)?.id;
  }

  function refresh() {
    if (refreshing || stopped) return;
    refreshing = true;
    try {
      const sessions = ctx.sessions.list.getSnapshot();
      const workspaces = ctx.workspaces.list.getSnapshot();
      const statuses = ctx.uiSession.sessionStatus.getSnapshot();
      model.reconcile(sessions, statuses, workspaces.archivedSessionIds);
      const selected = sessions.byId[currentId()];
      const selectedStatus = selected && statuses.get(selected.id);
      if (selected && (!(selectedStatus?.running ?? selected.running) || selectedStatus?.pendingInteraction)
        && environment.document.visibilityState === 'visible' && environment.document.hasFocus()) {
        model.read(selected);
      }
      const metadata = model.getSnapshot();
      const rows = deriveInboxRows({ sessions, workspaces, statuses,
        records: metadata.records, order: metadata.order, now: Date.now() });
      if (undo && (Date.now() >= undo.expiresAt || !sessions.byId[undo.id]
        || sessions.byId[undo.id].updatedAt > undo.after.revision
        || metadata.records.get(undo.id)?.errorAt > undo.after.record.errorAt
        || (statuses.get(undo.id)?.running ?? sessions.byId[undo.id].running) && !undo.after.running)) {
        undo = null;
        clearTimeout(undoTimer);
      }
      snapshot = { rows, workspaces: workspaces.items, phase: sessions.phase,
        connectionState: workspaces.state, currentId: currentId(),
        undo: undo && { id: undo.id, kind: undo.kind, expiresAt: undo.expiresAt },
        persistenceError: metadata.persistenceError, operationError, busy: new Set(busy) };
      // Native archives cannot remain open in the host. Fresh activity follows the
      // same return-to-inbox rule as local settlement, including across reloads.
      for (const row of rows) {
        if (!row.archived) { archiveWakeAttempts.delete(row.id); continue; }
        const signature = JSON.stringify([row.session.updatedAt, row.running, row.attention, row.record.errorAt]);
        if (row.section === 'settled' || busy.has(row.id) || archiveWakeAttempts.get(row.id) === signature) continue;
        archiveWakeAttempts.set(row.id, signature);
        void Promise.resolve().then(() => perform(row.id, () => ctx.uiWorkspace.unarchiveSession(row.id)));
      }
      clearTimeout(timer);
      const futureWakes = rows.map((row) => row.record.snoozedUntil)
        .filter((wake) => wake > Date.now());
      const delay = Math.min(60_000, ...futureWakes.map((wake) => wake - Date.now()));
      timer = setTimeout(refresh, Math.max(1, delay));
    } finally {
      refreshing = false;
    }
    for (const listener of listeners) listener();
  }

  async function perform(id, operation) {
    if (stopped || busy.has(id)) return;
    busy.add(id);
    operationError = null;
    refresh();
    try {
      await operation();
      return true;
    } catch (error) {
      operationError = String(error.message ?? error);
      return false;
    } finally {
      busy.delete(id);
      refresh();
    }
  }

  function latest(id) {
    const session = ctx.sessions.list.getSnapshot().byId[id];
    if (!session) throw new Error('Session is no longer available.');
    return { session, status: ctx.uiSession.sessionStatus.getSnapshot().get(id) };
  }

  function advance(id, order, previousWorkspace) {
    if (currentId() !== id) return;
    const index = order.indexOf(id);
    const ordered = [...order.slice(index + 1), ...order.slice(0, index)];
    const next = ordered.find((candidate) => candidate !== id && snapshot.rows.some((row) =>
      row.id === candidate && (row.section === 'inbox' || row.section === 'pinned')));
    if (next) ctx.uiWorkspace.openSession(next);
    else ctx.uiWorkspace.startSession(previousWorkspace);
    return next ? { next } : { draftWorkspace: previousWorkspace };
  }

  function capture(id) {
    const { session, status } = latest(id);
    const metadata = model.getSnapshot();
    return { record: { ...metadata.records.get(id) }, order: [...metadata.order],
      primary: snapshot.rows.filter(row => ['pinned', 'inbox', 'working'].includes(row.section)).map(row => row.id),
      pinned: ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id),
      archived: ctx.workspaces.list.getSnapshot().archivedSessionIds.includes(id),
      revision: session.updatedAt, running: status?.running ?? session.running,
      current: currentId() };
  }

  async function setPinned(id, value) {
    if (ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id) !== value) {
      await ctx.uiWorkspace[value ? 'pinSession' : 'unpinSession'](id);
    }
  }

  function remember(id, kind, before, navigation) {
    const after = capture(id);
    undo = { id, kind, before, after, navigation, expiresAt: Date.now() + 5_000 };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { undo = null; refresh(); }, 5_000);
  }

  function change(id, kind, operation) {
    return perform(id, async () => {
      const before = capture(id);
      try {
        const navigation = await operation(before);
        remember(id, kind, before, navigation);
      } catch (error) {
        // A failed persistence write must not leave an earlier native unpin behind.
        await setPinned(id, before.pinned);
        const after = capture(id);
        if (after.revision === before.revision && after.running === before.running) {
          if (before.archived && !after.archived) {
            const target = latest(id);
            model.keepArchived(target.session, target.status);
          } else model.restorePlacement(id, before.record, after.record);
        }
        throw error;
      }
    });
  }

  async function restoreToInbox(id) {
    if (ctx.workspaces.list.getSnapshot().archivedSessionIds.includes(id)) {
      await ctx.uiWorkspace.unarchiveSession(id);
    }
    model.restore(latest(id).session);
  }

  const actions = {
    open(id) {
      return perform(id, async () => {
        if (ctx.workspaces.list.getSnapshot().archivedSessionIds.includes(id)) {
          const before = capture(id);
          const target = latest(id);
          if (snapshot.rows.find(row => row.id === id)?.section === 'settled') model.keepArchived(target.session, target.status);
          try {
            await ctx.uiWorkspace.unarchiveSession(id);
          } catch (error) {
            model.restorePlacement(id, before.record, capture(id).record);
            throw error;
          }
        }
        ctx.uiWorkspace.openSession(id);
      });
    },
    settle(id, order) {
      return change(id, 'settled', async () => {
        const previousWorkspace = snapshot.rows.find((row) => row.id === id)?.workspace?.workspaceId;
        let target = latest(id);
        if ((target.status?.running ?? target.session.running) || target.status?.pendingInteraction) {
          throw new Error('This session is still working or waiting for your response.');
        }
        if (ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id)) {
          await ctx.uiWorkspace.unpinSession(id);
        }
        target = latest(id);
        model.settle(target.session, target.status);
        refresh();
        return advance(id, order, previousWorkspace);
      });
    },
    snooze(id, until, order) {
      return change(id, 'snoozed', async () => {
        const target = latest(id);
        const previousWorkspace = snapshot.rows.find((row) => row.id === id)?.workspace?.workspaceId;
        model.snooze(target.session, target.status, until);
        refresh();
        return advance(id, order, previousWorkspace);
      });
    },
    restore(id) {
      return change(id, 'restored', () => restoreToInbox(id));
    },
    pin(id) {
      const pinned = ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id);
      return change(id, pinned ? 'unpinned' : 'pinned', async () => {
        if (ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id)) {
          await ctx.uiWorkspace.unpinSession(id);
        } else {
          const row = snapshot.rows.find((item) => item.id === id);
          if (row?.section === 'settled' || row?.section === 'snoozed') await restoreToInbox(id);
          await ctx.uiWorkspace.pinSession(id);
        }
      });
    },
    move(id, destination) {
      return change(id, destination.section === 'settled' ? 'settled' : 'moved', async (before) => {
        let target = latest(id);
        if (target.session.blank) throw new Error('Drafts cannot be moved.');
        if (!['inbox', 'pinned', 'settled'].includes(destination.section)) throw new Error('Invalid drop destination.');
        const anchor = destination.beforeId || destination.afterId;
        const anchorRow = anchor && snapshot.rows.find(row => row.id === anchor);
        if (anchor && (anchor === id || !anchorRow || !['inbox', 'pinned', 'working'].includes(anchorRow.section)
          || anchorRow.pinned !== (destination.section === 'pinned'))) throw new Error('The drop destination changed.');
        if (destination.section === 'settled') {
          if ((target.status?.running ?? target.session.running) || target.status?.pendingInteraction) {
            throw new Error('This session is still working or waiting for your response.');
          }
          const workspaceId = snapshot.rows.find(row => row.id === id)?.workspace?.workspaceId;
          await setPinned(id, false);
          target = latest(id);
          model.settle(target.session, target.status);
          refresh();
          return advance(id, before.primary, workspaceId);
        }
        const row = snapshot.rows.find(row => row.id === id);
        if (row.section === 'settled' || row.section === 'snoozed') await restoreToInbox(id);
        await setPinned(id, destination.section === 'pinned');
        const ids = snapshot.rows.filter(row => ['inbox', 'pinned', 'working'].includes(row.section) && row.id !== id).map(row => row.id);
        const index = anchor ? ids.indexOf(anchor) + (destination.afterId ? 1 : 0)
          : destination.section === 'pinned' ? 0 : ids.filter(key => snapshot.rows.find(row => row.id === key)?.pinned).length;
        ids.splice(Math.max(0, index), 0, id);
        model.setOrder(ids);
      });
    },
    undo() {
      const notice = undo;
      if (!notice || Date.now() >= notice.expiresAt || busy.has(notice.id) || busy.has('undo')) return;
      return perform('undo', async () => {
        busy.add(notice.id);
        try {
          if (undo !== notice) return;
          undo = null;
          clearTimeout(undoTimer);
          const current = capture(notice.id);
          if (current.revision > notice.after.revision || current.running !== notice.after.running
            || current.record.errorAt > notice.after.record.errorAt) return;
          await setPinned(notice.id, notice.before.pinned);
          const checked = capture(notice.id);
          if (checked.revision > notice.after.revision || checked.running !== notice.after.running
            || checked.record.errorAt > notice.after.record.errorAt) return;
          if (notice.before.archived) {
            const target = latest(notice.id);
            model.keepArchived(target.session, target.status);
          } else model.restorePlacement(notice.id, notice.before.record, notice.after.record);
          if (JSON.stringify(model.getSnapshot().order) === JSON.stringify(notice.after.order)) {
            model.setOrder(notice.before.pinned ? notice.before.primary : notice.before.order);
          }
          const selected = ctx.sessions.list.getSnapshot().byId[currentId()];
          const expectedNavigation = notice.navigation && (currentId() === notice.navigation.next
            || selected?.blank && notice.navigation.draftWorkspace !== undefined
              && snapshot.rows.find(row => row.id === selected.id)?.workspace?.workspaceId === notice.navigation.draftWorkspace);
          if (expectedNavigation && notice.before.current
            && ctx.sessions.list.getSnapshot().byId[notice.before.current]) ctx.uiWorkspace.openSession(notice.before.current);
        } finally { busy.delete(notice.id); }
      });
    },
    dismissUndo() { undo = null; clearTimeout(undoTimer); refresh(); },
    start(workspaceId) { ctx.uiWorkspace.startSession(workspaceId || undefined); },
    addWorkspace() {
      return perform('workspace', async () => {
        native?.closeAddWorkspace();
        native?.setDirectoryBusy(true);
        try {
          const path = await ctx.uiWorkspace.pickDirectory();
          if (path === null) return;
          const workspace = await ctx.workspaces.create({ path });
          ctx.uiWorkspace.startSession(workspace.workspaceId);
        } finally {
          native?.setDirectoryBusy(false);
        }
      });
    },
    async rename(id, title) {
      const trimmed = title.trim();
      if (!trimmed) throw new Error('A session title is required.');
      if (latest(id).session.blank) throw new Error('Send the first message before renaming this session.');
      const result = await ctx.sessions.using(id, { source: 'workspaceOperation' },
        reference => reference.binding.session.rename(trimmed));
      if (!result.ok) throw new Error(result.error.message);
    },
    async search(query, signal) {
      const result = await ctx.sessions.search(query, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    dismissError() { operationError = null; refresh(); },
    retry() { archiveWakeAttempts.clear(); return perform('retry', () => ctx.sessions.refresh()); },
  };

  return {
    actions,
    setNative(bridge) { native = bridge; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    start() {
      const disposers = [
        ctx.sessions.list.subscribe(refresh), ctx.workspaces.list.subscribe(refresh),
        ctx.uiSession.sessionStatus.subscribe(refresh), ctx.layout.panelInfo.subscribe(refresh),
        model.subscribe(refresh),
        ctx.remote.$on('api-session/error', (id, message) => model.noteError(id, message)),
      ];
      const onStorage = (event) => model.receiveStorageChange(event.key);
      environment.addEventListener('storage', onStorage);
      environment.addEventListener('focus', refresh);
      environment.document.addEventListener('visibilitychange', refresh);
      refresh();
      return () => {
        stopped = true;
        clearTimeout(timer);
        clearTimeout(undoTimer);
        for (const dispose of disposers) dispose();
        environment.removeEventListener('storage', onStorage);
        environment.removeEventListener('focus', refresh);
        environment.document.removeEventListener('visibilitychange', refresh);
        listeners.clear();
      };
    },
  };
}
