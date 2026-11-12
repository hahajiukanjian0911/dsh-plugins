export const STORAGE_PREFIX = 'dsh.inbox-sidebar.v1.session.';
export const ORDER_KEY = 'dsh.inbox-sidebar.v1.order';

export const PLACEMENT_FIELDS = ['settledAt', 'settledThrough', 'settledFromArchive',
  'snoozedAt', 'snoozedUntil', 'returnedAt'];

function timestamp(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function initialRecord(session, status, initialBaseline) {
  const activity = timestamp(session.updatedAt);
  return {
    version: 1,
    readThrough: initialBaseline && !status?.completionUnread ? activity : 0,
    lastActivity: activity,
    returnedAt: activity,
    sentAt: activity,
    wasRunning: status?.running ?? session.running ?? false,
    attentionKind: status?.pendingInteraction?.kind ?? null,
    settledAt: 0,
    settledThrough: 0,
    settledFromArchive: false,
    archiveThrough: null,
    archiveErrorThrough: 0,
    snoozedAt: 0,
    snoozedUntil: 0,
    error: null,
    errorAt: 0,
  };
}

function validateRecord(value) {
  if (!value || value.version !== 1 || typeof value.wasRunning !== 'boolean') return false;
  const numberKeys = [
    'readThrough', 'lastActivity', 'returnedAt', 'sentAt', 'settledAt',
    'settledThrough', 'snoozedAt', 'snoozedUntil', 'errorAt',
  ];
  return numberKeys.every((key) => Number.isFinite(value[key]) && value[key] >= 0)
    && (value.settledFromArchive === undefined || typeof value.settledFromArchive === 'boolean')
    && (value.archiveThrough == null || Number.isFinite(value.archiveThrough) && value.archiveThrough >= 0)
    && (value.archiveErrorThrough === undefined || Number.isFinite(value.archiveErrorThrough) && value.archiveErrorThrough >= 0)
    && (value.attentionKind === null || typeof value.attentionKind === 'string')
    && (value.error === null || typeof value.error === 'string');
}

export function activityStamp(session, record, now) {
  const wokeAt = record.snoozedUntil > 0 && record.snoozedUntil <= now
    ? record.snoozedUntil : 0;
  return Math.max(timestamp(session.updatedAt), record.returnedAt, record.errorAt, wokeAt);
}

export function createInboxModel({ storage, now = Date.now }) {
  const records = new Map();
  const blocked = new Set();
  const listeners = new Set();
  let baselineReady = false;
  let order = [];
  let orderBlocked = false;
  let snapshot = { records, order, persistenceError: null, version: 0 };

  function loadOrder() {
    try {
      const text = storage.getItem(ORDER_KEY);
      const value = text === null ? [] : JSON.parse(text);
      if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) throw new Error('Invalid saved session order.');
      order = [...new Set(value)];
      orderBlocked = false;
    } catch (error) {
      orderBlocked = true;
      snapshot = { ...snapshot, persistenceError: String(error.message ?? error) };
    }
  }
  loadOrder();

  function publish() {
    snapshot = { ...snapshot, records: new Map(records), order: [...order], version: snapshot.version + 1 };
    for (const listener of listeners) listener();
  }

  function save(id, record, required = false, overwriteFields = []) {
    const previous = records.get(id);
    if (JSON.stringify(previous) === JSON.stringify(record) && overwriteFields.length === 0) return false;
    try {
      if (blocked.has(id)) throw new Error('Saved inbox metadata cannot be read.');
      // An already-open client can have written a reminder before its storage event reaches this tab.
      // Merge only this operation's changed fields so a read receipt keeps that reminder intact.
      const latestText = storage.getItem(STORAGE_PREFIX + id);
      if (previous && latestText !== null) {
        const latest = JSON.parse(latestText);
        if (!validateRecord(latest)) throw new Error('Unsupported inbox metadata.');
        const changes = Object.fromEntries(Object.entries(record).filter(([key, value]) =>
          value !== previous[key] || overwriteFields.includes(key)));
        record = { ...latest, ...changes, readThrough: Math.max(latest.readThrough, record.readThrough) };
      }
      storage.setItem(STORAGE_PREFIX + id, JSON.stringify(record));
    } catch (error) {
      snapshot = { ...snapshot, persistenceError: String(error.message ?? error) };
      if (required) {
        publish();
        throw error;
      }
    }
    records.set(id, record);
    return true;
  }

  function load(session, status) {
    if (records.has(session.id)) return records.get(session.id);
    let record = initialRecord(session, status, !baselineReady);
    try {
      const saved = storage.getItem(STORAGE_PREFIX + session.id);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (!validateRecord(parsed)) throw new Error('Unsupported inbox metadata.');
        record = { ...record, ...parsed };
      }
    } catch (error) {
      blocked.add(session.id);
      snapshot = { ...snapshot, persistenceError: String(error.message ?? error) };
    }
    save(session.id, record);
    return record;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    reconcile(sessions, statuses, archivedIds = []) {
      if (sessions.phase !== 'ready') return;
      const archived = new Set(archivedIds);
      let changed = false;
      for (const id of sessions.ids) {
        const session = sessions.byId[id];
        if (!session || session.origin === 'subagent') continue;
        const status = statuses.get(id);
        const existing = records.has(id);
        const previous = load(session, status);
        const next = { ...previous };
        const running = status?.running ?? session.running ?? false;
        const attention = status?.pendingInteraction?.kind ?? null;
        const revision = timestamp(session.updatedAt);
        if (archived.has(id) && previous.archiveThrough === null) {
          next.archiveThrough = revision;
          next.archiveErrorThrough = previous.errorAt;
        } else if (!archived.has(id)) next.archiveThrough = null;
        if (running && !previous.wasRunning) {
          next.sentAt = now();
          next.error = null;
          next.errorAt = 0;
          next.settledAt = 0;
          next.settledFromArchive = false;
        }
        if (!running && previous.wasRunning) next.returnedAt = now();
        if (attention !== null && attention !== previous.attentionKind) {
          next.returnedAt = now();
          next.snoozedUntil = 0;
          next.settledAt = 0;
          next.settledFromArchive = false;
        }
        if (!running && revision > previous.lastActivity) {
          next.lastActivity = revision;
          next.returnedAt = Math.max(next.returnedAt, revision);
        }
        if (revision > previous.settledThrough && (previous.settledAt > 0 || previous.settledFromArchive)) {
          next.settledAt = 0;
          next.settledFromArchive = false;
        }
        next.wasRunning = running;
        next.attentionKind = attention;
        changed = save(id, next) || !existing || changed;
      }
      baselineReady = true;
      if (changed) publish();
    },
    noteError(id, message) {
      const record = records.get(id);
      if (!record) return;
      const at = now();
      save(id, { ...record, error: String(message), errorAt: at, returnedAt: at,
        settledAt: 0, settledFromArchive: false, snoozedUntil: 0 });
      publish();
    },
    read(session) {
      const record = records.get(session.id);
      if (!record) return;
      const through = activityStamp(session, record, now());
      if (through <= record.readThrough) return;
      save(session.id, { ...record, readThrough: through });
      publish();
    },
    settle(session, status) {
      if ((status?.running ?? session.running) || status?.pendingInteraction) {
        throw new Error('This session still needs an active response.');
      }
      const record = records.get(session.id);
      save(session.id, { ...record, settledAt: now(), settledFromArchive: false, settledThrough: timestamp(session.updatedAt),
        snoozedUntil: 0, readThrough: activityStamp(session, record, now()) }, true,
      ['settledAt', 'settledThrough', 'settledFromArchive', 'snoozedUntil', 'readThrough']);
      publish();
    },
    keepArchived(session, status) {
      if ((status?.running ?? session.running) || status?.pendingInteraction) return;
      const record = records.get(session.id);
      // The host must unarchive to view. Preserve the shelf without inventing an archive date.
      save(session.id, { ...record, settledAt: now(), settledFromArchive: true,
        settledThrough: timestamp(session.updatedAt), snoozedUntil: 0 }, true,
      ['settledAt', 'settledFromArchive', 'settledThrough', 'snoozedUntil']);
      publish();
    },
    snooze(session, status, until) {
      if (status?.pendingInteraction) throw new Error('This session needs your response.');
      if (!Number.isFinite(until) || until <= now()) throw new Error('Choose a future time.');
      const record = records.get(session.id);
      save(session.id, { ...record, snoozedAt: now(), snoozedUntil: until, settledAt: 0, settledFromArchive: false }, true,
        ['snoozedAt', 'snoozedUntil', 'settledAt', 'settledFromArchive']);
      publish();
    },
    restore(session) {
      const record = records.get(session.id);
      save(session.id, { ...record, settledAt: 0, settledFromArchive: false, snoozedUntil: 0, returnedAt: now() }, true,
        ['settledAt', 'settledFromArchive', 'snoozedUntil', 'returnedAt']);
      publish();
    },
    restorePlacement(id, previous, expected) {
      const current = records.get(id);
      if (!current || PLACEMENT_FIELDS.some(key => current[key] !== expected[key])) return false;
      const fields = Object.fromEntries(PLACEMENT_FIELDS.map(key => [key, previous[key]]));
      save(id, { ...current, ...fields }, true, PLACEMENT_FIELDS);
      publish();
      return true;
    },
    setOrder(ids) {
      if (orderBlocked) throw new Error('Saved session order cannot be read.');
      const next = [...new Set(ids)];
      try { storage.setItem(ORDER_KEY, JSON.stringify(next)); }
      catch (error) { snapshot = { ...snapshot, persistenceError: String(error.message ?? error) }; publish(); throw error; }
      order = next;
      publish();
    },
    receiveStorageChange(key) {
      if (key === null || key === ORDER_KEY) { loadOrder(); if (key === ORDER_KEY) { publish(); return; } }
      if (key !== null && !key.startsWith(STORAGE_PREFIX)) return;
      const id = key?.slice(STORAGE_PREFIX.length);
      if (id) { records.delete(id); blocked.delete(id); }
      else { records.clear(); blocked.clear(); }
      publish();
    },
  };
}

export function deriveInboxRows({ sessions, workspaces, statuses, records, now, order = [] }) {
  const workspaceBySession = new Map();
  for (const workspace of workspaces.items) {
    for (const id of workspace.sessionIds) workspaceBySession.set(id, workspace);
  }
  const pinned = new Set(workspaces.pinnedSessionIds);
  const archived = new Set(workspaces.archivedSessionIds);
  const rows = [];
  for (const id of sessions.ids) {
    const session = sessions.byId[id];
    const record = records.get(id);
    if (!session || !record || session.origin === 'subagent') continue;
    const current = (session.retainedBy?.mainView ?? 0) > 0;
    if (session.blank && !current) continue;
    const status = statuses.get(id);
    const running = status?.running ?? session.running ?? false;
    const attention = status?.pendingInteraction?.kind ?? null;
    const sleeping = record.snoozedUntil > now && !attention && record.errorAt <= record.snoozedAt;
    const settled = (record.settledAt > 0 || record.settledFromArchive) && timestamp(session.updatedAt) <= record.settledThrough
      && !running && !attention && record.errorAt <= record.settledAt;
    const nativeSettled = archived.has(id) && !running && !attention
      && timestamp(session.updatedAt) <= (record.archiveThrough ?? timestamp(session.updatedAt))
      && record.errorAt <= (record.archiveErrorThrough ?? record.errorAt);
    let section = 'inbox';
    if (session.blank && !running && !attention && !record.error) section = 'draft';
    else if (nativeSettled || settled) section = 'settled';
    else if (sleeping) section = 'snoozed';
    else if (pinned.has(id)) section = 'pinned';
    else if (running && !attention && !record.error) section = 'working';
    const stamp = activityStamp(session, record, now);
    rows.push({ id, session, record, current, running, attention, section,
      workspace: workspaceBySession.get(id),
      pinned: pinned.has(id), archived: archived.has(id),
      pinRank: workspaces.pinnedSessionIds.indexOf(id),
      unread: !running && !session.blank && stamp > record.readThrough,
      activityAt: stamp,
      sortAt: section === 'working' ? record.sentAt : stamp,
    });
  }
  const rank = new Map(order.map((id, index) => [id, index]));
  const group = row => row.section === 'draft' ? 0 : row.section === 'pinned' ? 1
    : row.section === 'inbox' || row.section === 'working' ? 2 : row.section === 'snoozed' ? 3 : 4;
  return rows.sort((left, right) => {
    const difference = group(left) - group(right);
    if (difference) return difference;
    if (group(left) <= 2) {
      const a = rank.get(left.id), b = rank.get(right.id);
      if (a !== undefined || b !== undefined) return (a ?? -1) - (b ?? -1)
        || right.sortAt - left.sortAt || left.id.localeCompare(right.id);
      if (left.pinned && right.pinned) return left.pinRank - right.pinRank;
    }
    if (left.section === 'settled') {
      // Match T3's projected landing slot. Viewing a native archive does not
      // supply a real settlement date and must not move it to the top.
      const settledStamp = row => row.record.settledFromArchive ? row.activityAt
        : row.record.settledAt || row.activityAt;
      const settledDifference = settledStamp(right) - settledStamp(left);
      if (settledDifference) return settledDifference;
    }
    return right.sortAt - left.sortAt || left.id.localeCompare(right.id);
  });
}
