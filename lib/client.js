window.__ModuleLoader__.load({ id: "dsh-inbox-sidebar", factory(require) { const module = { exports: {} }; const exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  createPlugin: () => createPlugin
});
module.exports = __toCommonJS(client_exports);

// src/react-inject.js
var React = __toESM(require("react"), 1);

// src/preferences.js
var PREFERENCES_KEY = "dsh.inbox-sidebar.v1.preferences";
var DEFAULT_PREFERENCES = Object.freeze({
  density: "comfortable",
  sessionTooltips: true,
  settledNotice: true,
  settledExpanded: false,
  snoozedExpanded: false,
  listMotion: true
});
function valid(key, value) {
  return key === "density" ? ["comfortable", "compact"].includes(value) : Object.hasOwn(DEFAULT_PREFERENCES, key) && typeof value === "boolean";
}
function parse(raw) {
  if (raw === null) return { ...DEFAULT_PREFERENCES };
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Invalid sidebar preferences");
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [key, valid(key, saved[key]) ? saved[key] : fallback]));
}
function createSidebarPreferences(environment = window) {
  const listeners = /* @__PURE__ */ new Set();
  let snapshot = { value: DEFAULT_PREFERENCES, error: null };
  const publish = (value, error = null) => {
    snapshot = { value: Object.freeze(value), error };
    for (const listener of listeners) listener();
  };
  function reload() {
    try {
      publish(parse(environment.localStorage.getItem(PREFERENCES_KEY)));
    } catch (error) {
      publish(snapshot.value, String(error.message ?? error));
    }
  }
  function save(value) {
    try {
      environment.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
      publish(value);
      return true;
    } catch (error) {
      publish(snapshot.value, String(error.message ?? error));
      return false;
    }
  }
  const storage = (event) => {
    if (event.key === PREFERENCES_KEY || event.key === null) reload();
  };
  reload();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      environment.addEventListener("storage", storage);
      return () => environment.removeEventListener("storage", storage);
    },
    set(key, value) {
      if (!valid(key, value)) return false;
      try {
        return save({ ...parse(environment.localStorage.getItem(PREFERENCES_KEY)), [key]: value });
      } catch (error) {
        publish(snapshot.value, String(error.message ?? error));
        return false;
      }
    },
    reset: () => save({ ...DEFAULT_PREFERENCES })
  };
}

// src/settings.jsx
function createSidebarSettings(React2, { Switch, Button }, stylesheet) {
  function Row({ label, hint, children }) {
    return /* @__PURE__ */ React2.createElement("div", { className: "dsi-settings-row" }, /* @__PURE__ */ React2.createElement("div", { className: "dsi-settings-copy" }, /* @__PURE__ */ React2.createElement("div", { className: "dsi-settings-label" }, label), hint && /* @__PURE__ */ React2.createElement("p", { className: "dsi-settings-hint" }, hint)), /* @__PURE__ */ React2.createElement("div", { className: "dsi-settings-control" }, children));
  }
  return function SidebarSettings({ useSidebarPreferences, setPreference, resetPreferences, t }) {
    const { value, error } = useSidebarPreferences((state) => state);
    const id = React2.useId();
    const toggle = (key, label, hint) => /* @__PURE__ */ React2.createElement(Row, { key, label: t(label), hint: hint && t(hint) }, /* @__PURE__ */ React2.createElement(Switch, { checked: value[key], label: t(label), onChange: (next) => setPreference(key, next) }));
    return /* @__PURE__ */ React2.createElement("section", { className: "dsi-settings", "aria-labelledby": id }, /* @__PURE__ */ React2.createElement("style", null, stylesheet), /* @__PURE__ */ React2.createElement("header", null, /* @__PURE__ */ React2.createElement("h2", { id }, t("settingsTitle")), /* @__PURE__ */ React2.createElement("p", null, t("settingsDescription"))), error && /* @__PURE__ */ React2.createElement("p", { className: "dsi-settings-error", role: "alert" }, t("settingsSaveFailed", { message: error })), /* @__PURE__ */ React2.createElement("section", { "aria-labelledby": id + "-display" }, /* @__PURE__ */ React2.createElement("h3", { id: id + "-display" }, t("settingsDisplay")), /* @__PURE__ */ React2.createElement(Row, { label: t("settingsDensity"), hint: t("settingsDensityHint") }, /* @__PURE__ */ React2.createElement(
      "select",
      {
        className: "dsi-density-select",
        "aria-label": t("settingsDensity"),
        value: value.density,
        onChange: (event) => setPreference("density", event.target.value)
      },
      /* @__PURE__ */ React2.createElement("option", { value: "comfortable" }, t("settingsComfortable")),
      /* @__PURE__ */ React2.createElement("option", { value: "compact" }, t("settingsCompact"))
    )), toggle("sessionTooltips", "settingsTooltips"), toggle("settledNotice", "settingsSettledNotice", "settingsSettledNoticeHint")), /* @__PURE__ */ React2.createElement("section", { "aria-labelledby": id + "-behavior" }, /* @__PURE__ */ React2.createElement("h3", { id: id + "-behavior" }, t("settingsBehavior")), toggle("listMotion", "settingsListMotion", "settingsListMotionHint")), /* @__PURE__ */ React2.createElement("footer", null, /* @__PURE__ */ React2.createElement(Button, { variant: "outline", size: "sm", onClick: resetPreferences }, t("settingsReset"))));
  };
}

// src/settings.css
var settings_default = '.dsi-settings {width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:400 14px/20px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;}\n.dsi-settings header {margin-bottom:24px;}\n.dsi-settings h2 {margin:0;font-size:22px;font-weight:600;line-height:30px;}\n.dsi-settings header p {margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}\n.dsi-settings section+section {margin-top:28px;}\n.dsi-settings h3 {margin:0;font-size:14px;font-weight:600;line-height:20px;}\n.dsi-settings-row {display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l3));}\n.dsi-settings-row:last-child {border-bottom:0;}\n.dsi-settings-copy {min-width:0;overflow-wrap:anywhere;}\n.dsi-settings-label {font-size:14px;line-height:20px;}\n.dsi-settings-hint {max-width:420px;margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}\n.dsi-settings-control {display:flex;flex:none;align-items:center;}\n.dsi-settings .dsi-density-select {min-width:100px;height:32px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;padding:0 24px 0 10px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-elevated-fill,var(--dsw-alias-bg-base));font:inherit;font-size:13px;line-height:20px;}\n.dsi-settings .dsi-density-select:focus-visible {outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;}\n.dsi-settings footer {display:flex;justify-content:flex-end;margin-top:24px;}\n.dsi-settings-error {margin:0 0 16px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere;}\n';

// src/inbox-state.js
var STORAGE_PREFIX = "dsh.inbox-sidebar.v1.session.";
var ORDER_KEY = "dsh.inbox-sidebar.v1.order";
var PLACEMENT_FIELDS = [
  "settledAt",
  "settledThrough",
  "settledFromArchive",
  "snoozedAt",
  "snoozedUntil",
  "returnedAt"
];
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
    errorAt: 0
  };
}
function validateRecord(value) {
  if (!value || value.version !== 1 || typeof value.wasRunning !== "boolean") return false;
  const numberKeys = [
    "readThrough",
    "lastActivity",
    "returnedAt",
    "sentAt",
    "settledAt",
    "settledThrough",
    "snoozedAt",
    "snoozedUntil",
    "errorAt"
  ];
  return numberKeys.every((key) => Number.isFinite(value[key]) && value[key] >= 0) && (value.settledFromArchive === void 0 || typeof value.settledFromArchive === "boolean") && (value.archiveThrough == null || Number.isFinite(value.archiveThrough) && value.archiveThrough >= 0) && (value.archiveErrorThrough === void 0 || Number.isFinite(value.archiveErrorThrough) && value.archiveErrorThrough >= 0) && (value.attentionKind === null || typeof value.attentionKind === "string") && (value.error === null || typeof value.error === "string");
}
function activityStamp(session, record, now) {
  const wokeAt = record.snoozedUntil > 0 && record.snoozedUntil <= now ? record.snoozedUntil : 0;
  return Math.max(timestamp(session.updatedAt), record.returnedAt, record.errorAt, wokeAt);
}
function createInboxModel({ storage, now = Date.now }) {
  const records = /* @__PURE__ */ new Map();
  const blocked = /* @__PURE__ */ new Set();
  const listeners = /* @__PURE__ */ new Set();
  let baselineReady = false;
  let order = [];
  let orderBlocked = false;
  let snapshot = { records, order, persistenceError: null, version: 0 };
  function loadOrder() {
    try {
      const text = storage.getItem(ORDER_KEY);
      const value = text === null ? [] : JSON.parse(text);
      if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) throw new Error("Invalid saved session order.");
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
      if (blocked.has(id)) throw new Error("Saved inbox metadata cannot be read.");
      const latestText = storage.getItem(STORAGE_PREFIX + id);
      if (previous && latestText !== null) {
        const latest = JSON.parse(latestText);
        if (!validateRecord(latest)) throw new Error("Unsupported inbox metadata.");
        const changes = Object.fromEntries(Object.entries(record).filter(([key, value]) => value !== previous[key] || overwriteFields.includes(key)));
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
        if (!validateRecord(parsed)) throw new Error("Unsupported inbox metadata.");
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
      if (sessions.phase !== "ready") return;
      const archived = new Set(archivedIds);
      let changed = false;
      for (const id of sessions.ids) {
        const session = sessions.byId[id];
        if (!session || session.origin === "subagent") continue;
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
      save(id, {
        ...record,
        error: String(message),
        errorAt: at,
        returnedAt: at,
        settledAt: 0,
        settledFromArchive: false,
        snoozedUntil: 0
      });
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
        throw new Error("This session still needs an active response.");
      }
      const record = records.get(session.id);
      save(
        session.id,
        {
          ...record,
          settledAt: now(),
          settledFromArchive: false,
          settledThrough: timestamp(session.updatedAt),
          snoozedUntil: 0,
          readThrough: activityStamp(session, record, now())
        },
        true,
        ["settledAt", "settledThrough", "settledFromArchive", "snoozedUntil", "readThrough"]
      );
      publish();
    },
    keepArchived(session, status) {
      if ((status?.running ?? session.running) || status?.pendingInteraction) return;
      const record = records.get(session.id);
      save(
        session.id,
        {
          ...record,
          settledAt: now(),
          settledFromArchive: true,
          settledThrough: timestamp(session.updatedAt),
          snoozedUntil: 0
        },
        true,
        ["settledAt", "settledFromArchive", "settledThrough", "snoozedUntil"]
      );
      publish();
    },
    snooze(session, status, until) {
      if (status?.pendingInteraction) throw new Error("This session needs your response.");
      if (!Number.isFinite(until) || until <= now()) throw new Error("Choose a future time.");
      const record = records.get(session.id);
      save(
        session.id,
        { ...record, snoozedAt: now(), snoozedUntil: until, settledAt: 0, settledFromArchive: false },
        true,
        ["snoozedAt", "snoozedUntil", "settledAt", "settledFromArchive"]
      );
      publish();
    },
    restore(session) {
      const record = records.get(session.id);
      save(
        session.id,
        { ...record, settledAt: 0, settledFromArchive: false, snoozedUntil: 0, returnedAt: now() },
        true,
        ["settledAt", "settledFromArchive", "snoozedUntil", "returnedAt"]
      );
      publish();
    },
    restorePlacement(id, previous, expected) {
      const current = records.get(id);
      if (!current || PLACEMENT_FIELDS.some((key) => current[key] !== expected[key])) return false;
      const fields = Object.fromEntries(PLACEMENT_FIELDS.map((key) => [key, previous[key]]));
      save(id, { ...current, ...fields }, true, PLACEMENT_FIELDS);
      publish();
      return true;
    },
    setOrder(ids) {
      if (orderBlocked) throw new Error("Saved session order cannot be read.");
      const next = [...new Set(ids)];
      try {
        storage.setItem(ORDER_KEY, JSON.stringify(next));
      } catch (error) {
        snapshot = { ...snapshot, persistenceError: String(error.message ?? error) };
        publish();
        throw error;
      }
      order = next;
      publish();
    },
    receiveStorageChange(key) {
      if (key === null || key === ORDER_KEY) {
        loadOrder();
        if (key === ORDER_KEY) {
          publish();
          return;
        }
      }
      if (key !== null && !key.startsWith(STORAGE_PREFIX)) return;
      const id = key?.slice(STORAGE_PREFIX.length);
      if (id) {
        records.delete(id);
        blocked.delete(id);
      } else {
        records.clear();
        blocked.clear();
      }
      publish();
    }
  };
}
function deriveInboxRows({ sessions, workspaces, statuses, records, now, order = [] }) {
  const workspaceBySession = /* @__PURE__ */ new Map();
  for (const workspace of workspaces.items) {
    for (const id of workspace.sessionIds) workspaceBySession.set(id, workspace);
  }
  const pinned = new Set(workspaces.pinnedSessionIds);
  const archived = new Set(workspaces.archivedSessionIds);
  const rows = [];
  for (const id of sessions.ids) {
    const session = sessions.byId[id];
    const record = records.get(id);
    if (!session || !record || session.origin === "subagent") continue;
    const current = (session.retainedBy?.mainView ?? 0) > 0;
    if (session.blank && !current) continue;
    const status = statuses.get(id);
    const running = status?.running ?? session.running ?? false;
    const attention = status?.pendingInteraction?.kind ?? null;
    const sleeping = record.snoozedUntil > now && !attention && record.errorAt <= record.snoozedAt;
    const settled = (record.settledAt > 0 || record.settledFromArchive) && timestamp(session.updatedAt) <= record.settledThrough && !running && !attention && record.errorAt <= record.settledAt;
    const nativeSettled = archived.has(id) && !running && !attention && timestamp(session.updatedAt) <= (record.archiveThrough ?? timestamp(session.updatedAt)) && record.errorAt <= (record.archiveErrorThrough ?? record.errorAt);
    let section = "inbox";
    if (session.blank && !running && !attention && !record.error) section = "draft";
    else if (nativeSettled || settled) section = "settled";
    else if (sleeping) section = "snoozed";
    else if (pinned.has(id)) section = "pinned";
    else if (running && !attention && !record.error) section = "working";
    const stamp = activityStamp(session, record, now);
    rows.push({
      id,
      session,
      record,
      current,
      running,
      attention,
      section,
      workspace: workspaceBySession.get(id),
      pinned: pinned.has(id),
      archived: archived.has(id),
      pinRank: workspaces.pinnedSessionIds.indexOf(id),
      unread: !running && !session.blank && stamp > record.readThrough,
      activityAt: stamp,
      sortAt: section === "working" ? record.sentAt : stamp
    });
  }
  const rank = new Map(order.map((id, index) => [id, index]));
  const group = (row) => row.section === "draft" ? 0 : row.section === "pinned" ? 1 : row.section === "inbox" || row.section === "working" ? 2 : row.section === "snoozed" ? 3 : 4;
  return rows.sort((left, right) => {
    const difference = group(left) - group(right);
    if (difference) return difference;
    if (group(left) <= 2) {
      const a = rank.get(left.id), b = rank.get(right.id);
      if (a !== void 0 || b !== void 0) return (a ?? -1) - (b ?? -1) || right.sortAt - left.sortAt || left.id.localeCompare(right.id);
      if (left.pinned && right.pinned) return left.pinRank - right.pinRank;
    }
    if (left.section === "settled") {
      const settledStamp = (row) => row.record.settledFromArchive ? row.activityAt : row.record.settledAt || row.activityAt;
      const settledDifference = settledStamp(right) - settledStamp(left);
      if (settledDifference) return settledDifference;
    }
    return right.sortAt - left.sortAt || left.id.localeCompare(right.id);
  });
}

// src/controller.js
function createInboxController(ctx, environment = window) {
  const model = createInboxModel({ storage: {
    getItem: (key) => environment.localStorage.getItem(key),
    setItem: (key, value) => environment.localStorage.setItem(key, value)
  } });
  const listeners = /* @__PURE__ */ new Set();
  const busy = /* @__PURE__ */ new Set();
  let snapshot;
  let timer;
  let undoTimer;
  let undo = null;
  const archiveWakeAttempts = /* @__PURE__ */ new Map();
  let refreshing = false;
  let stopped = false;
  let operationError = null;
  let native;
  function currentId() {
    if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return void 0;
    return Object.values(ctx.sessions.list.getSnapshot().byId).find((session) => (session.retainedBy?.mainView ?? 0) > 0)?.id;
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
      if (selected && (!(selectedStatus?.running ?? selected.running) || selectedStatus?.pendingInteraction) && environment.document.visibilityState === "visible" && environment.document.hasFocus()) {
        model.read(selected);
      }
      const metadata = model.getSnapshot();
      const rows = deriveInboxRows({
        sessions,
        workspaces,
        statuses,
        records: metadata.records,
        order: metadata.order,
        now: Date.now()
      });
      if (undo && (Date.now() >= undo.expiresAt || !sessions.byId[undo.id] || sessions.byId[undo.id].updatedAt > undo.after.revision || metadata.records.get(undo.id)?.errorAt > undo.after.record.errorAt || (statuses.get(undo.id)?.running ?? sessions.byId[undo.id].running) && !undo.after.running)) {
        undo = null;
        clearTimeout(undoTimer);
      }
      snapshot = {
        rows,
        workspaces: workspaces.items,
        phase: sessions.phase,
        connectionState: workspaces.state,
        currentId: currentId(),
        undo: undo && { id: undo.id, kind: undo.kind, expiresAt: undo.expiresAt },
        persistenceError: metadata.persistenceError,
        operationError,
        busy: new Set(busy)
      };
      for (const row of rows) {
        if (!row.archived) {
          archiveWakeAttempts.delete(row.id);
          continue;
        }
        const signature = JSON.stringify([row.session.updatedAt, row.running, row.attention, row.record.errorAt]);
        if (row.section === "settled" || busy.has(row.id) || archiveWakeAttempts.get(row.id) === signature) continue;
        archiveWakeAttempts.set(row.id, signature);
        void Promise.resolve().then(() => perform(row.id, () => ctx.uiWorkspace.unarchiveSession(row.id)));
      }
      clearTimeout(timer);
      const futureWakes = rows.map((row) => row.record.snoozedUntil).filter((wake) => wake > Date.now());
      const delay = Math.min(6e4, ...futureWakes.map((wake) => wake - Date.now()));
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
    if (!session) throw new Error("Session is no longer available.");
    return { session, status: ctx.uiSession.sessionStatus.getSnapshot().get(id) };
  }
  function advance(id, order, previousWorkspace) {
    if (currentId() !== id) return;
    const index = order.indexOf(id);
    const ordered = [...order.slice(index + 1), ...order.slice(0, index)];
    const next = ordered.find((candidate) => candidate !== id && snapshot.rows.some((row) => row.id === candidate && (row.section === "inbox" || row.section === "pinned")));
    if (next) ctx.uiWorkspace.openSession(next);
    else ctx.uiWorkspace.startSession(previousWorkspace);
    return next ? { next } : { draftWorkspace: previousWorkspace };
  }
  function capture(id) {
    const { session, status } = latest(id);
    const metadata = model.getSnapshot();
    return {
      record: { ...metadata.records.get(id) },
      order: [...metadata.order],
      primary: snapshot.rows.filter((row) => ["pinned", "inbox", "working"].includes(row.section)).map((row) => row.id),
      pinned: ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id),
      archived: ctx.workspaces.list.getSnapshot().archivedSessionIds.includes(id),
      revision: session.updatedAt,
      running: status?.running ?? session.running,
      current: currentId()
    };
  }
  async function setPinned(id, value) {
    if (ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id) !== value) {
      await ctx.uiWorkspace[value ? "pinSession" : "unpinSession"](id);
    }
  }
  function remember(id, kind, before, navigation) {
    const after = capture(id);
    undo = { id, kind, before, after, navigation, expiresAt: Date.now() + 5e3 };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      undo = null;
      refresh();
    }, 5e3);
  }
  function change(id, kind, operation) {
    return perform(id, async () => {
      const before = capture(id);
      try {
        const navigation = await operation(before);
        remember(id, kind, before, navigation);
      } catch (error) {
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
          if (snapshot.rows.find((row) => row.id === id)?.section === "settled") model.keepArchived(target.session, target.status);
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
      return change(id, "settled", async () => {
        const previousWorkspace = snapshot.rows.find((row) => row.id === id)?.workspace?.workspaceId;
        let target = latest(id);
        if ((target.status?.running ?? target.session.running) || target.status?.pendingInteraction) {
          throw new Error("This session is still working or waiting for your response.");
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
      return change(id, "snoozed", async () => {
        const target = latest(id);
        const previousWorkspace = snapshot.rows.find((row) => row.id === id)?.workspace?.workspaceId;
        model.snooze(target.session, target.status, until);
        refresh();
        return advance(id, order, previousWorkspace);
      });
    },
    restore(id) {
      return change(id, "restored", () => restoreToInbox(id));
    },
    pin(id) {
      const pinned = ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id);
      return change(id, pinned ? "unpinned" : "pinned", async () => {
        if (ctx.workspaces.list.getSnapshot().pinnedSessionIds.includes(id)) {
          await ctx.uiWorkspace.unpinSession(id);
        } else {
          const row = snapshot.rows.find((item) => item.id === id);
          if (row?.section === "settled" || row?.section === "snoozed") await restoreToInbox(id);
          await ctx.uiWorkspace.pinSession(id);
        }
      });
    },
    move(id, destination) {
      return change(id, destination.section === "settled" ? "settled" : "moved", async (before) => {
        let target = latest(id);
        if (target.session.blank) throw new Error("Drafts cannot be moved.");
        if (!["inbox", "pinned", "settled"].includes(destination.section)) throw new Error("Invalid drop destination.");
        const anchor = destination.beforeId || destination.afterId;
        const anchorRow = anchor && snapshot.rows.find((row2) => row2.id === anchor);
        if (anchor && (anchor === id || !anchorRow || !["inbox", "pinned", "working"].includes(anchorRow.section) || anchorRow.pinned !== (destination.section === "pinned"))) throw new Error("The drop destination changed.");
        if (destination.section === "settled") {
          if ((target.status?.running ?? target.session.running) || target.status?.pendingInteraction) {
            throw new Error("This session is still working or waiting for your response.");
          }
          const workspaceId = snapshot.rows.find((row2) => row2.id === id)?.workspace?.workspaceId;
          await setPinned(id, false);
          target = latest(id);
          model.settle(target.session, target.status);
          refresh();
          return advance(id, before.primary, workspaceId);
        }
        const row = snapshot.rows.find((row2) => row2.id === id);
        if (row.section === "settled" || row.section === "snoozed") await restoreToInbox(id);
        await setPinned(id, destination.section === "pinned");
        const ids = snapshot.rows.filter((row2) => ["inbox", "pinned", "working"].includes(row2.section) && row2.id !== id).map((row2) => row2.id);
        const index = anchor ? ids.indexOf(anchor) + (destination.afterId ? 1 : 0) : destination.section === "pinned" ? 0 : ids.filter((key) => snapshot.rows.find((row2) => row2.id === key)?.pinned).length;
        ids.splice(Math.max(0, index), 0, id);
        model.setOrder(ids);
      });
    },
    undo() {
      const notice = undo;
      if (!notice || Date.now() >= notice.expiresAt || busy.has(notice.id) || busy.has("undo")) return;
      return perform("undo", async () => {
        busy.add(notice.id);
        try {
          if (undo !== notice) return;
          undo = null;
          clearTimeout(undoTimer);
          const current = capture(notice.id);
          if (current.revision > notice.after.revision || current.running !== notice.after.running || current.record.errorAt > notice.after.record.errorAt) return;
          await setPinned(notice.id, notice.before.pinned);
          const checked = capture(notice.id);
          if (checked.revision > notice.after.revision || checked.running !== notice.after.running || checked.record.errorAt > notice.after.record.errorAt) return;
          if (notice.before.archived) {
            const target = latest(notice.id);
            model.keepArchived(target.session, target.status);
          } else model.restorePlacement(notice.id, notice.before.record, notice.after.record);
          if (JSON.stringify(model.getSnapshot().order) === JSON.stringify(notice.after.order)) {
            model.setOrder(notice.before.pinned ? notice.before.primary : notice.before.order);
          }
          const selected = ctx.sessions.list.getSnapshot().byId[currentId()];
          const expectedNavigation = notice.navigation && (currentId() === notice.navigation.next || selected?.blank && notice.navigation.draftWorkspace !== void 0 && snapshot.rows.find((row) => row.id === selected.id)?.workspace?.workspaceId === notice.navigation.draftWorkspace);
          if (expectedNavigation && notice.before.current && ctx.sessions.list.getSnapshot().byId[notice.before.current]) ctx.uiWorkspace.openSession(notice.before.current);
        } finally {
          busy.delete(notice.id);
        }
      });
    },
    dismissUndo() {
      undo = null;
      clearTimeout(undoTimer);
      refresh();
    },
    start(workspaceId) {
      ctx.uiWorkspace.startSession(workspaceId || void 0);
    },
    addWorkspace() {
      return perform("workspace", async () => {
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
      if (!trimmed) throw new Error("A session title is required.");
      if (latest(id).session.blank) throw new Error("Send the first message before renaming this session.");
      const result = await ctx.sessions.using(
        id,
        { source: "workspaceOperation" },
        (reference) => reference.binding.session.rename(trimmed)
      );
      if (!result.ok) throw new Error(result.error.message);
    },
    async search(query, signal) {
      const result = await ctx.sessions.search(query, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    dismissError() {
      operationError = null;
      refresh();
    },
    retry() {
      archiveWakeAttempts.clear();
      return perform("retry", () => ctx.sessions.refresh());
    }
  };
  return {
    actions,
    setNative(bridge) {
      native = bridge;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start() {
      const disposers = [
        ctx.sessions.list.subscribe(refresh),
        ctx.workspaces.list.subscribe(refresh),
        ctx.uiSession.sessionStatus.subscribe(refresh),
        ctx.layout.panelInfo.subscribe(refresh),
        model.subscribe(refresh),
        ctx.remote.$on("api-session/error", (id, message) => model.noteError(id, message))
      ];
      const onStorage = (event) => model.receiveStorageChange(event.key);
      environment.addEventListener("storage", onStorage);
      environment.addEventListener("focus", refresh);
      environment.document.addEventListener("visibilitychange", refresh);
      refresh();
      return () => {
        stopped = true;
        clearTimeout(timer);
        clearTimeout(undoTimer);
        for (const dispose of disposers) dispose();
        environment.removeEventListener("storage", onStorage);
        environment.removeEventListener("focus", refresh);
        environment.document.removeEventListener("visibilitychange", refresh);
        listeners.clear();
      };
    }
  };
}

// src/project-catalog.js
var EMPTY = Object.freeze({ ready: false, projects: [], localId: null });
function createProjectCatalog(ctx) {
  let snapshot = EMPTY, controller, unsubscribe, unmount, signature = "";
  const listeners = /* @__PURE__ */ new Set();
  function publish() {
    const view = controller?.getSnapshot().view;
    const next = view ? {
      ready: true,
      localId: view.localId,
      projects: view.projects.map(({ key, name, icon, pinned, archived, checkouts }) => ({
        key,
        name,
        icon,
        pinned,
        archived,
        checkouts: checkouts.filter((c) => c.environmentId === view.localId).map(({ id, key: key2, path, title, online, missing }) => ({ id, key: key2, path, title, online, missing }))
      }))
    } : EMPTY;
    const nextSignature = JSON.stringify(next);
    if (signature === nextSignature) return;
    snapshot = next;
    signature = nextSignature;
    for (const listener of listeners) listener();
  }
  function connect() {
    const entry = ctx.slots.entries("settings.section").find((entry2) => (entry2.id ?? entry2.options?.id) === "dsh-project-manager");
    const next = entry?.inject?.().hooks?.projectManager;
    if (next === controller) return;
    unsubscribe?.();
    unmount?.();
    controller = next;
    unsubscribe = controller?.subscribe(publish);
    unmount = controller?.mount();
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      const dispose = ctx.slots.subscribe("settings.section", connect);
      const workspaceChange = ctx.workspaces.list.subscribe(() => {
        void controller?.load();
      });
      connect();
      return () => {
        dispose();
        workspaceChange();
        unsubscribe?.();
        unmount?.();
        listeners.clear();
      };
    }
  };
}
function projectGroups(workspaces, rows, catalog) {
  const byWorkspace = /* @__PURE__ */ new Map(), groups = [];
  for (const project of catalog.projects) {
    const ids = project.checkouts.map((checkout) => checkout.id).filter((id) => workspaces.some((w) => w.workspaceId === id));
    if (!ids.length) continue;
    const group = { ...project, workspaceIds: ids, rows: [] };
    groups.push(group);
    for (const id of ids) byWorkspace.set(id, group);
  }
  for (const workspace of workspaces) if (!byWorkspace.has(workspace.workspaceId)) {
    const group = {
      key: "workspace:" + workspace.workspaceId,
      name: workspace.title || workspace.path,
      icon: null,
      workspaceIds: [workspace.workspaceId],
      checkouts: [{ id: workspace.workspaceId, path: workspace.path }],
      rows: []
    };
    groups.push(group);
    byWorkspace.set(workspace.workspaceId, group);
  }
  const orphans = /* @__PURE__ */ new Map();
  for (const row of rows) {
    let group = byWorkspace.get(row.workspace?.workspaceId);
    if (!group) {
      const cwd = row.session.cwd || "";
      group = orphans.get(cwd);
      if (!group) {
        group = {
          key: "unregistered:" + cwd,
          name: cwd.split(/[\\/]/).filter(Boolean).at(-1),
          workspaceIds: [],
          checkouts: [],
          rows: [],
          unregistered: true
        };
        orphans.set(cwd, group);
        groups.push(group);
      }
    }
    group.rows.push(row);
  }
  return groups.sort((a, b) => Number(!!a.unregistered) - Number(!!b.unregistered) || Number(!!b.pinned) - Number(!!a.pinned) || (a.name || "").localeCompare(b.name || "", "zh-Hans") || a.key.localeCompare(b.key));
}

// src/native/Sidebar.jsx
var import_react2 = require("react");

// src/native/hooks.js
var import_react = require("react");
function useInlineRename(actions, t) {
  const [state, setState] = (0, import_react.useState)(null);
  const current = (0, import_react.useRef)(null);
  const focusId = (0, import_react.useRef)(null);
  const focusAfterSave = (0, import_react.useRef)(false);
  const update = (value) => {
    current.current = value;
    setState(value);
  };
  const close = (id, focus) => {
    focusId.current = focus ? id : null;
    update(null);
  };
  (0, import_react.useEffect)(() => () => {
    current.current = null;
  }, []);
  return {
    state,
    focusId,
    begin(row, title) {
      if (row.session.blank || row.archived || current.current?.saving) return;
      update({ id: row.id, original: title, value: title, saving: false, error: null });
    },
    change(id, value) {
      if (current.current?.id === id && !current.current.saving) update({ ...current.current, value, error: null });
    },
    cancel(id) {
      if (current.current?.id === id && !current.current.saving) close(id, true);
    },
    async commit(id, focus) {
      const edit = current.current;
      if (edit?.id !== id) return;
      if (edit.saving) {
        if (!focus) focusAfterSave.current = false;
        return;
      }
      const trimmed = edit.value.trim();
      if (!trimmed) {
        update({ ...edit, error: t("renameEmpty") });
        return;
      }
      if (trimmed === edit.original) {
        close(id, focus);
        return;
      }
      const request = { ...edit, saving: true, error: null };
      focusAfterSave.current = focus;
      update(request);
      try {
        await actions.rename(id, trimmed);
        if (current.current === request) close(id, focusAfterSave.current);
      } catch (error) {
        if (current.current === request) update({
          ...request,
          saving: false,
          error: t("renameFailed", { message: String(error.message ?? error) })
        });
      }
    }
  };
}
function useStableRows(rows, interactionId) {
  const shown = (0, import_react.useRef)(rows);
  const lock = (0, import_react.useRef)(null);
  if (!interactionId) lock.current = null;
  else if (lock.current?.id !== interactionId) lock.current = { id: interactionId, rows: shown.current };
  if (!lock.current) {
    shown.current = rows;
    return rows;
  }
  const latest = new Map(rows.map((row) => [row.id, row]));
  const stable = lock.current.rows.filter((row) => latest.has(row.id)).map((row) => ({
    ...latest.get(row.id),
    section: row.section,
    pinned: row.pinned,
    pinRank: row.pinRank
  }));
  const known = new Set(stable.map((row) => row.id));
  shown.current = [...stable, ...rows.filter((row) => !known.has(row.id))];
  return shown.current;
}

// src/native/footer-icons.js
function mountFooterIconTitles(browser) {
  const shell = browser?.closest('[data-slot="sidebar"]')?.firstElementChild;
  if (!shell) return;
  const saved = /* @__PURE__ */ new Map();
  function update() {
    for (const button of shell.querySelectorAll(":scope > nav button[aria-label], :scope > button[aria-label]")) {
      const label = button.getAttribute("aria-label");
      if (!saved.has(button)) saved.set(button, { original: button.getAttribute("title"), label });
      const previous = saved.get(button);
      if (previous.original === null && (!button.hasAttribute("title") || button.getAttribute("title") === previous.label)) {
        button.setAttribute("title", label);
        previous.label = label;
      }
    }
  }
  const observer = new MutationObserver(update);
  observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
  update();
  return () => {
    observer.disconnect();
    for (const [button, value] of saved) if (button.getAttribute("title") === value.label) {
      if (value.original === null) button.removeAttribute("title");
      else button.setAttribute("title", value.original);
    }
  };
}

// plugins/dsh-project-manager/src/model.mjs
var COLORS = [
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899"
];

// plugins/dsh-project-manager/src/identity.jsx
var GLYPHS = {
  folder: "IconFolderCloseRegular",
  code: "IconCodeOutlineRegular",
  document: "IconDeliverDocOutlineRegular",
  globe: "IconGlobeOutlineRegular",
  settings: "IconSettingsOutlineRegular",
  database: "IconDatabaseOutlineRegular",
  shield: "IconShieldOutlineRegular",
  branch: "IconBranchOutlineRegular",
  sparkle: "IconSparkleOutlineRegular",
  clock: "IconClockOutlineRegular",
  chat: "IconNewChatOutlineRegular",
  link: "IconLinkOutlineRegular"
};
function createProjectIcon(React2, P) {
  return function ProjectIcon({ project, large = false, compact = false }) {
    const value = project.icon, name = project.name || "\u9879\u76EE";
    const letters = [...name.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("").toUpperCase() || "P";
    const color = value?.color || COLORS[[...name].reduce((a, c) => a + c.codePointAt(0), 0) % COLORS.length];
    return /* @__PURE__ */ React2.createElement(
      "span",
      {
        "aria-hidden": "true",
        className: "dpm-project-icon" + (large ? " dpm-large" : "") + (compact ? " dpm-compact" : ""),
        style: { "--dpm-icon-color": color }
      },
      value?.kind === "image" ? /* @__PURE__ */ React2.createElement("img", { alt: "", src: value.value }) : value?.kind === "glyph" ? React2.createElement(P[GLYPHS[value.value]] || P.IconFolderCloseRegular, { size: large ? 24 : compact ? 16 : 18 }) : value?.kind === "emoji" ? /* @__PURE__ */ React2.createElement("span", { className: "dpm-emoji" }, value.value) : /* @__PURE__ */ React2.createElement("span", null, value?.kind === "monogram" ? value.value : letters)
    );
  };
}

// src/native/Sidebar.jsx
function relativeTime(at, t) {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 6e4));
  return minutes < 1 ? t("now") : minutes < 60 ? t("minutes", { n: minutes }) : minutes < 1440 ? t("hours", { n: Math.floor(minutes / 60) }) : t("days", { n: Math.floor(minutes / 1440) });
}
var EMPTY_SEARCH_ITEMS = Object.freeze([]);
var EMPTY_CATALOG = Object.freeze({ ready: false, projects: [], localId: null });
function reminderPresets(now) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [["hourLater", now + 36e5], ["tomorrow", +tomorrow], ["monday", +monday]];
}
function createNativeSidebar(React2, stylesheet, P) {
  const { AnimatedRows, Button, HoverCard, HoverCardGroup, Input, Menu, Modal, StateDot, Tooltip } = P;
  const icon = (name, size = 16, className) => React2.createElement(P[name], { size, className });
  const ProjectIcon = createProjectIcon(React2, P);
  function IconButton({ label, name, onClick, disabled, active, className = "" }) {
    return /* @__PURE__ */ React2.createElement(Tooltip, { label, side: "bottom", delayMs: 500, portal: true }, /* @__PURE__ */ React2.createElement(
      "button",
      {
        type: "button",
        className: "dsi-dsh-icon-button " + className,
        "aria-label": label,
        "aria-pressed": active,
        disabled,
        onClick
      },
      icon(name)
    ));
  }
  function ProjectNewSession({ group, start, canCreate, t }) {
    const [open, setOpen] = (0, import_react2.useState)(false), anchor = (0, import_react2.useRef)(null);
    const checkouts = group.checkouts.filter((c) => c.online !== false && !c.missing);
    const label = group.name || t("ungrouped");
    return /* @__PURE__ */ React2.createElement(
      Menu,
      {
        open,
        onClose: () => setOpen(false),
        portal: true,
        dense: true,
        autoFocus: true,
        align: "end",
        returnFocus: () => anchor.current?.querySelector("button"),
        items: checkouts.map((c) => ({ id: c.id, label: c.title || c.path, description: c.path })),
        onSelect: (workspaceId) => {
          setOpen(false);
          start(workspaceId);
        },
        anchor: /* @__PURE__ */ React2.createElement("span", { ref: anchor, className: "dsi-dsh-project-create-anchor" }, /* @__PURE__ */ React2.createElement(
          IconButton,
          {
            label: t("newSessionInProject", { name: label }),
            name: "IconNewChatOutlineRegular",
            disabled: !canCreate || !checkouts.length,
            onClick: () => checkouts.length === 1 ? start(checkouts[0].id) : setOpen(!open)
          }
        ))
      }
    );
  }
  function SessionRow({ row, actions, t, rename, busy, order, preferences, inlineDetails, useSessionAccess, drag, onCustomSnooze, snippet, searchProps, historyView = false, onRestoreStart }) {
    const edit = rename.state?.id === row.id ? rename.state : null;
    const draft = row.section === "draft", parked = ["settled", "snoozed"].includes(row.section);
    const rowRef = (0, import_react2.useRef)(null), input = (0, import_react2.useRef)(null), errorId = React2.useId();
    const [menu, setMenu] = (0, import_react2.useState)(null);
    const preview = P.useRowDragPreview("dsi-dsh-drag-preview", ["--dsw-alias-label-primary", "--dsw-specific-sidebar-fill"]);
    const canRename = useSessionAccess(row.id, "session/rename");
    const canPin = useSessionAccess(row.id, row.pinned ? "workspace/unpinSession" : "workspace/pinSession");
    const canUnpin = useSessionAccess(row.id, "workspace/unpinSession");
    const canRestore = useSessionAccess(row.id, "workspace/unarchiveSession");
    const canMove = useSessionAccess(row.id, "workspace/insertSessionBefore");
    const writablePlacement = !busy && (!row.pinned || canUnpin) && (!row.archived || canRestore);
    const canSettle = writablePlacement && !row.running && !row.attention && !draft;
    const draggable = !draft && !busy && !edit && !drag.disabled && canMove && writablePlacement;
    const project = row.projectName || row.workspace?.title || row.workspace?.path || row.session.cwd || t("ungrouped");
    const detailProject = row.projectName || row.workspace?.title || (row.workspace?.path || row.session.cwd || "").split(/[\\/]/).filter(Boolean).at(-1) || t("ungrouped");
    const title = row.session.displayTitle || row.session.title || t("newSession");
    const begin = () => {
      if (!busy && canRename) rename.begin(row, title);
    };
    const restore = () => {
      const cancel = onRestoreStart?.(row.id);
      return actions.restore(row.id).catch((error) => {
        cancel?.();
        throw error;
      });
    }, settle = () => actions.settle(row.id, order);
    let state = "idle", label = relativeTime(row.activityAt, t);
    if (draft) label = t("unsent");
    else if (row.attention) {
      state = "warning";
      label = t(row.attention === "approval" ? "approval" : row.attention === "plan-review" ? "plan" : "answer");
    } else if (row.record.error) {
      state = "error";
      label = t("failed");
    } else if (row.running) {
      state = "ongoing";
      label = t("working");
    } else if (row.unread && !parked) state = "done";
    else if (row.section === "snoozed") label = new Date(row.record.snoozedUntil).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const activityMinutes = Math.max(0, Math.floor((Date.now() - row.activityAt) / 6e4));
    const activityLabel = activityMinutes < 1 ? t("settledNow") : activityMinutes < 60 ? t("settledMinutesAgo", { n: activityMinutes }) : activityMinutes < 1440 ? t("settledHoursAgo", { n: Math.floor(activityMinutes / 60) }) : t("settledDaysAgo", { n: Math.floor(activityMinutes / 1440) });
    const detailLabel = row.section === "snoozed" ? t("reminderAt", { time: label }) : state === "done" ? t("completed") : state === "idle" && !draft ? activityLabel : label;
    (0, import_react2.useLayoutEffect)(() => {
      if (edit) {
        input.current?.focus({ preventScroll: true });
        input.current?.select();
      }
    }, [!!edit]);
    (0, import_react2.useEffect)(() => {
      if (drag.active) setMenu(null);
    }, [!!drag.active]);
    const menuItems = [
      { id: "open", label: t(row.archived ? "archivedOpen" : "openSession"), disabled: busy },
      { id: "rename", label: t("rename"), icon: icon("IconEditOutlineRegular"), disabled: busy || draft || row.archived || !canRename },
      ...draft ? [] : [
        { type: "separator", id: "placement" },
        ...parked ? [{ id: "restore", label: t("restore"), icon: icon("IconUnarchiveOutlineRegular"), disabled: !writablePlacement }] : [
          { id: "pin", label: t(row.pinned ? "unpin" : "pin"), icon: icon("IconPinOutlineRegular"), disabled: busy || !canPin },
          {
            id: "snooze",
            label: t("snooze"),
            icon: icon("IconClockOutlineRegular"),
            disabled: !writablePlacement || !!row.attention,
            submenu: [...reminderPresets(Date.now()).map(([key]) => ({ id: key, label: t(key) })), { id: "customTime", label: t("customTime") }]
          },
          { id: "settle", label: t("settle"), icon: icon("IconArchiveOutlineRegular"), disabled: !canSettle }
        ]
      ]
    ];
    const selectMenu = (id) => {
      setMenu(null);
      if (id === "open") void actions.open(row.id);
      else if (id === "rename") begin();
      else if (id === "restore") void restore();
      else if (id === "pin") void actions.pin(row.id);
      else if (id === "settle") void settle();
      else if (id === "customTime") onCustomSnooze(row, order);
      else {
        const preset = reminderPresets(Date.now()).find(([key]) => key === id);
        if (preset) void actions.snooze(row.id, preset[1], order);
      }
    };
    const keyDown = (e) => {
      if (edit || e.target !== e.currentTarget) return;
      if (e.key === "F2") {
        e.preventDefault();
        begin();
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void actions.open(row.id);
      }
      if (e.key === "ContextMenu" || e.shiftKey && e.key === "F10") {
        e.preventDefault();
        const rect = rowRef.current.getBoundingClientRect();
        setMenu({ x: rect.left, y: rect.bottom, contextual: true });
      }
      if (!e.altKey && ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
        const all = [...rowRef.current.closest(".dsi-dsh-list").querySelectorAll("[data-sidebar-row]")], index = all.indexOf(rowRef.current);
        const next = all[e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : Math.max(0, Math.min(all.length - 1, index + (e.key === "ArrowUp" ? -1 : 1)))];
        if (next) {
          e.preventDefault();
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
        }
      }
      if (e.altKey && !parked && canMove && ["ArrowUp", "ArrowDown"].includes(e.key)) {
        const index = order.indexOf(row.id) + (e.key === "ArrowUp" ? -1 : 1), anchor = drag.rows.find((r) => r.id === order[index]);
        if (anchor && anchor.pinned === row.pinned) {
          e.preventDefault();
          void actions.move(row.id, { section: row.pinned ? "pinned" : "inbox", [e.key === "ArrowUp" ? "beforeId" : "afterId"]: anchor.id });
        }
      }
    };
    const settledAt = !row.record.settledFromArchive && row.record.settledAt || 0;
    const historyMinutes = Math.max(0, Math.floor((Date.now() - (settledAt || row.activityAt)) / 6e4));
    const historyRelative = historyMinutes < 1 ? t("settledNow") : historyMinutes < 60 ? t("settledMinutesAgo", { n: historyMinutes }) : historyMinutes < 1440 ? t("settledHoursAgo", { n: Math.floor(historyMinutes / 60) }) : t("settledDaysAgo", { n: Math.floor(historyMinutes / 1440) });
    const historyTime = t(settledAt ? "settledAgo" : "lastActiveAgo", { time: historyRelative });
    const marker = drag.over?.id === row.id ? drag.over.half : "";
    const rowNode = /* @__PURE__ */ React2.createElement(
      "div",
      {
        ref: rowRef,
        role: "treeitem",
        tabIndex: 0,
        "aria-selected": row.current,
        "aria-label": [project, title, historyView ? historyTime : label].join(", "),
        "data-sidebar-row": row.id,
        "data-project-key": row.projectInfo?.key,
        "data-row-key": "session:" + row.id,
        "data-section": row.section,
        "data-state": state,
        "data-current": row.current || void 0,
        "data-editing": !!edit || void 0,
        "data-dragging": drag.active === row.id || void 0,
        "data-drop": marker || void 0,
        "data-menu-open": !!menu || void 0,
        className: "dsi-dsh-row" + (parked ? " dsi-dsh-parked" : "") + (historyView ? " dsi-dsh-history-row" : ""),
        onClick: edit ? void 0 : () => {
          if (!drag.active && !busy) void actions.open(row.id);
        },
        onDoubleClick: edit ? void 0 : begin,
        onKeyDown: keyDown,
        onContextMenu: draft || edit ? void 0 : (e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY, contextual: true });
        },
        draggable,
        onDragStart: (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.id);
          drag.start(row.id);
          preview.start(e);
        },
        onDragEnd: () => {
          preview.clear();
          drag.cancel();
        },
        onDragOver: (e) => {
          if (historyView || draft || row.section === "snoozed" || !drag.active || drag.active === row.id) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          drag.hover({ id: row.id, section: row.pinned ? "pinned" : parked ? "settled" : "inbox", half: e.clientY < rect.top + rect.height / 2 ? "before" : "after" });
        },
        onDrop: (e) => {
          if (!drag.active || draft || row.section === "snoozed" || drag.active === row.id) return;
          e.preventDefault();
          e.stopPropagation();
          drag.drop();
        },
        ...searchProps
      },
      /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-thread-meta", "data-row-metadata": "" }, /* @__PURE__ */ React2.createElement(ProjectIcon, { project: row.projectInfo || { name: project }, compact: true }), row.pinned && /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-thread-pin", "aria-label": t("pinned") }, icon("IconPinOutlineRegular", 12)), /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-thread-project", dir: "auto", title: row.session.cwd || row.workspace?.path || project }, project), /* @__PURE__ */ React2.createElement("time", { className: "dsi-dsh-time", title: new Date(historyView ? settledAt || row.activityAt : row.activityAt).toLocaleString() }, historyView ? historyTime : draft ? t("unsent") : relativeTime(row.activityAt, t))),
      /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-thread-title-line", "data-row-title-line": "" }, edit ? /* @__PURE__ */ React2.createElement(
        "input",
        {
          ref: input,
          className: "dsi-dsh-rename",
          "aria-label": t("rename"),
          value: edit.value,
          readOnly: edit.saving,
          "aria-busy": edit.saving,
          "aria-invalid": !!edit.error,
          "aria-describedby": edit.error ? errorId : void 0,
          onChange: (e) => rename.change(row.id, e.target.value),
          onClick: (e) => e.stopPropagation(),
          onDoubleClick: (e) => e.stopPropagation(),
          onBlur: () => void rename.commit(row.id, false),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") {
              e.preventDefault();
              void rename.commit(row.id, true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              rename.cancel(row.id);
            }
          }
        }
      ) : /* @__PURE__ */ React2.createElement("span", { dir: "auto", "data-row-title": "", className: "dsi-dsh-title" }, title), /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-thread-trailing" }, !edit && /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-thread-status", "data-row-status": "", "aria-label": detailLabel, title: detailLabel }, state !== "idle" ? /* @__PURE__ */ React2.createElement(StateDot, { state }) : row.section === "snoozed" ? icon("IconClockOutlineRegular", 16) : null, ["warning", "error"].includes(state) && /* @__PURE__ */ React2.createElement("span", null, label)), !edit && !draft && /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-row-actions", onClick: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React2.createElement(
        "button",
        {
          type: "button",
          className: "dsi-dsh-icon-button",
          "aria-label": t("sessionActions"),
          "aria-haspopup": "menu",
          "aria-expanded": !!menu,
          onClick: (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenu(menu ? null : { x: rect.left, y: rect.bottom });
          }
        },
        icon("IconEllipsisOutlineRegular")
      ), /* @__PURE__ */ React2.createElement(
        "button",
        {
          type: "button",
          className: "dsi-dsh-icon-button",
          "aria-label": t(parked ? "restore" : "settle"),
          disabled: parked ? !writablePlacement : !canSettle,
          onClick: () => void (parked ? restore() : settle())
        },
        icon(parked ? "IconUnarchiveOutlineRegular" : "IconArchiveOutlineRegular")
      ))))
    );
    return /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-entry", "data-session-id": row.id }, /* @__PURE__ */ React2.createElement(
      Menu,
      {
        open: !!menu,
        onClose: () => setMenu(null),
        items: menuItems,
        onSelect: selectMenu,
        portal: true,
        dense: true,
        contextual: !!menu?.contextual,
        autoFocus: !!menu?.contextual,
        align: "start",
        returnFocus: () => input.current || rowRef.current,
        getAnchorRect: () => ({ x: menu?.x || 0, y: menu?.y || 0, left: menu?.x || 0, right: menu?.x || 0, top: menu?.y || 0, bottom: menu?.y || 0, width: 0, height: 0 }),
        className: "dsi-dsh-row-menu",
        anchor: /* @__PURE__ */ React2.createElement(
          HoverCard,
          {
            key: edit ? "rename-editor" : "session-details",
            anchor: rowNode,
            disabled: !preferences.sessionTooltips || !!edit || !!menu || !!drag.active,
            openDelayMs: 800,
            grouped: true,
            inline: inlineDetails,
            fitContent: inlineDetails,
            content: /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-details" }, /* @__PURE__ */ React2.createElement("strong", { title }, title), /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-detail-line", title: row.session.cwd || row.workspace?.path }, icon("IconFolderCloseRegular", 14), /* @__PURE__ */ React2.createElement("span", null, detailProject)), /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-detail-line", title: state === "idle" && !draft && row.section !== "snoozed" ? new Date(row.activityAt).toLocaleString() : detailLabel }, state === "idle" ? icon("IconClockOutlineRegular", 14) : /* @__PURE__ */ React2.createElement(StateDot, { state }), /* @__PURE__ */ React2.createElement("span", null, detailLabel)))
          }
        )
      }
    ), edit?.error && /* @__PURE__ */ React2.createElement("div", { id: errorId, role: "alert", className: "dsi-dsh-rename-error" }, edit.error), snippet && /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-snippet" }, snippet));
  }
  function CustomSnooze({ target, close, actions, t }) {
    const [value, setValue] = (0, import_react2.useState)(""), [saving, setSaving] = (0, import_react2.useState)(false), [error, setError] = (0, import_react2.useState)(false);
    const id = React2.useId(), until = new Date(value).getTime();
    return /* @__PURE__ */ React2.createElement(
      Modal,
      {
        open: true,
        onClose: saving ? () => {
        } : close,
        title: t("snooze"),
        closeLabel: t("close"),
        description: target.row.session.displayTitle || t("newSession"),
        footer: /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(Button, { variant: "outline", disabled: saving, onClick: close }, t("cancel")), /* @__PURE__ */ React2.createElement(Button, { disabled: saving || !(until > Date.now()), onClick: async () => {
          setSaving(true);
          setError(false);
          const ok = await actions.snooze(target.row.id, until, target.order);
          setSaving(false);
          if (ok) close();
          else setError(true);
        } }, t("confirmSnooze")))
      },
      /* @__PURE__ */ React2.createElement("label", { htmlFor: id }, t("customTime")),
      /* @__PURE__ */ React2.createElement(Input, { id, type: "datetime-local", value, disabled: saving, onChange: (e) => setValue(e.target.value) }),
      error && /* @__PURE__ */ React2.createElement("p", { role: "alert" }, t("reminderFailed"))
    );
  }
  return function NativeInboxSidebar({
    wide,
    expandSidebar,
    useInbox,
    useNativeShortcuts,
    useRemoteAccess,
    useSessionAccess = () => false,
    useSidebarPreferences = (select) => select({ value: DEFAULT_PREFERENCES }),
    useProjectCatalog = (select) => select(EMPTY_CATALOG),
    actions,
    t
  }) {
    const preferences = useSidebarPreferences((s) => s.value), data = useInbox((s) => s), shortcuts = useNativeShortcuts((s) => s);
    const catalog = useProjectCatalog((s) => s);
    const canCreate = useRemoteAccess("session/create"), canAdd = useRemoteAccess("workspace/create");
    const [showArchived, setShowArchived] = (0, import_react2.useState)(false);
    const [view, setView] = (0, import_react2.useState)("main"), [browsers, setBrowsers] = (0, import_react2.useState)({ main: { query: "", project: "", limit: 60 }, settled: { query: "", project: "", limit: 60 } });
    const historyView = view === "settled", { query, project, limit } = browsers[view];
    const setField = (key, value) => setBrowsers((previous) => ({ ...previous, [view]: { ...previous[view], [key]: typeof value === "function" ? value(previous[view][key]) : value } }));
    const setQuery = (value) => setField("query", value), setProject = (value) => setField("project", value), setLimit = (value) => setField("limit", value);
    const positions = (0, import_react2.useRef)({ main: { top: 0, anchors: [] }, settled: { top: 0, anchors: [] } }), previousBrowser = (0, import_react2.useRef)(null);
    const entryButton = (0, import_react2.useRef)(null), backButton = (0, import_react2.useRef)(null), scrollReserve = (0, import_react2.useRef)(null), navigationFocus = (0, import_react2.useRef)(false), removedFocus = (0, import_react2.useRef)(null), historyScopeInitialized = (0, import_react2.useRef)(false);
    const capturePosition = () => {
      const viewport = scroll.current;
      if (!viewport) return;
      const tail = scrollReserve.current, retained = tail?.offsetHeight || 0;
      if (retained && viewport.scrollTop <= Math.max(0, viewport.scrollHeight - retained - viewport.clientHeight) + 0.5) tail.style.height = "0px";
      const bounds = viewport.getBoundingClientRect();
      positions.current[view] = { top: viewport.scrollTop, anchors: [...viewport.querySelectorAll("[data-sidebar-row]")].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      }).map((node) => ({ id: node.dataset.sidebarRow, offset: node.getBoundingClientRect().top - bounds.top })) };
    };
    const showView = (next, focus = true) => {
      capturePosition();
      navigationFocus.current = focus;
      removedFocus.current = null;
      setFilterOpen(false);
      setView(next);
    };
    const rememberRestoredRow = (id) => {
      capturePosition();
      const nodes = [...scroll.current?.querySelectorAll("[data-sidebar-row]") || []], index = nodes.findIndex((node) => node.dataset.sidebarRow === id);
      if (historyView && nodes[index]?.contains(document.activeElement)) {
        const intent = { id, next: (nodes[index + 1] || nodes[index - 1])?.dataset.sidebarRow };
        removedFocus.current = intent;
        return () => {
          if (removedFocus.current === intent) removedFocus.current = null;
        };
      }
    };
    const showSettled = () => {
      if (!historyScopeInitialized.current) {
        setBrowsers((previous) => ({ ...previous, settled: { ...previous.settled, project: previous.main.project } }));
        historyScopeInitialized.current = true;
      }
      showView("settled");
    };
    const [searches, setSearches] = (0, import_react2.useState)({ main: { query: "", items: [], pending: false }, settled: { query: "", items: [], pending: false } }), [activeResult, setActiveResult] = (0, import_react2.useState)(0);
    const search = searches[view], setSearch = (value) => setSearches((previous) => ({ ...previous, [view]: typeof value === "function" ? value(previous[view]) : value }));
    const [filterOpen, setFilterOpen] = (0, import_react2.useState)(false), [customSnooze, setCustomSnooze] = (0, import_react2.useState)(null);
    const [dragState, setDragState] = (0, import_react2.useState)(null), [over, setOver] = (0, import_react2.useState)(null);
    const [inlineDetails, setInlineDetails] = (0, import_react2.useState)(false);
    const root = (0, import_react2.useRef)(null), scroll = (0, import_react2.useRef)(null), input = (0, import_react2.useRef)(null), activeDrag = (0, import_react2.useRef)(null), target = (0, import_react2.useRef)(null), focusRequested = (0, import_react2.useRef)(false);
    (0, import_react2.useLayoutEffect)(() => wide ? mountFooterIconTitles(root.current) : void 0, [wide]);
    (0, import_react2.useLayoutEffect)(() => {
      if (!wide || !root.current) return;
      const browser = root.current;
      const measure = () => setInlineDetails(browser.getBoundingClientRect().right + 260 > window.innerWidth);
      const observer = new ResizeObserver(measure);
      observer.observe(browser);
      window.addEventListener("resize", measure);
      measure();
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", measure);
      };
    }, [wide]);
    const rename = useInlineRename(actions, t), needle = query.trim().toLocaleLowerCase();
    (0, import_react2.useEffect)(() => {
      if (!needle) return;
      const abort = new AbortController();
      setSearch((previous) => ({ query: needle, view, items: previous.query === needle ? previous.items : [], pending: true }));
      const timer = setTimeout(() => actions.search(query.trim(), abort.signal).then((result) => {
        if (!abort.signal.aborted) setSearch({ ...result, query: needle, view, pending: false });
      }, (error) => {
        if (!abort.signal.aborted) setSearch({ query: needle, view, items: [], pending: false, error: String(error.message || error) });
      }), 250);
      return () => {
        clearTimeout(timer);
        abort.abort();
      };
    }, [needle, view]);
    const currentSearch = search.query === needle && search.view === view ? search : { items: EMPTY_SEARCH_ITEMS, pending: !!needle };
    const matches = new Map(currentSearch.items.map((item) => [item.sessionId, item.snippet]));
    const stableRows = useStableRows(data.rows, rename.state?.id || dragState);
    const groups = projectGroups(data.workspaces, stableRows, catalog);
    const rowGroups = new Map(groups.flatMap((group) => group.rows.map((row) => [row.id, group])));
    const rows = stableRows.map((row) => ({ ...row, projectName: rowGroups.get(row.id)?.name, projectInfo: rowGroups.get(row.id) }));
    const selectedGroup = groups.find((group) => group.key === project || group.workspaceIds.some((id) => id === project || "workspace:" + id === project));
    const inScope = (row) => !project || !!selectedGroup?.rows.some((candidate) => candidate.id === row.id);
    const visible = rows.filter((row) => row.section !== "draft" && (!historyView || row.section === "settled") && inScope(row) && (!needle || matches.has(row.id) || [row.id, row.session.displayTitle, row.session.title, row.session.cwd, row.workspace?.title, row.projectName].some((value) => value?.toLocaleLowerCase().includes(needle))));
    const settled = visible.filter((row) => row.section === "settled");
    const allSettledCount = rows.filter((row) => row.section === "settled").length;
    const settledCount = rows.filter((row) => row.section === "settled" && inScope(row)).length;
    const shownGroups = groups.filter((group) => (!project || group === selectedGroup) && (!group.archived || showArchived || needle || group === selectedGroup || group.rows.some((row) => row.section !== "settled" && (row.current || row.running || row.attention || row.unread || row.record.error))));
    const shownKeys = new Set(shownGroups.map((group) => group.key));
    const mainRows = rows.filter((row) => inScope(row) && shownKeys.has(row.projectInfo?.key) && (needle ? visible.some((match) => match.id === row.id) : row.section !== "settled"));
    (0, import_react2.useLayoutEffect)(() => {
      if (!wide || !scroll.current) return;
      const previous = previousBrowser.current, changedView = previous?.view !== view;
      if (data.operationError) removedFocus.current = null;
      if (previous && !changedView && (previous.query !== query || previous.project !== project)) {
        positions.current[view] = { top: 0, anchors: [] };
        removedFocus.current = null;
      }
      const saved = positions.current[view], viewport = scroll.current, tail = scrollReserve.current;
      const changedScope = previous && !changedView && (previous.query !== query || previous.project !== project);
      if (!previous || changedView || changedScope || historyView || previous.viewport !== viewport || previous.catalog !== catalog) {
        if (tail) tail.style.height = "0px";
        const naturalMax = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        viewport.scrollTop = saved.top;
        let desired = Math.min(saved.top, naturalMax);
        if (saved.top > 0) {
          const top = viewport.getBoundingClientRect().top;
          for (const anchor of saved.anchors) {
            const node = [...viewport.querySelectorAll("[data-sidebar-row]")].find((node2) => node2.dataset.sidebarRow === anchor.id);
            if (node) {
              desired = Math.max(0, viewport.scrollTop + node.getBoundingClientRect().top - top - anchor.offset);
              break;
            }
          }
        }
        if (tail) tail.style.height = Math.max(0, desired - naturalMax) + "px";
        viewport.scrollTop = desired;
      }
      capturePosition();
      previousBrowser.current = { view, query, project, viewport, catalog };
      if (previous && changedView && navigationFocus.current) (historyView ? backButton : entryButton).current?.focus({ preventScroll: true });
      if (removedFocus.current && ![...viewport.querySelectorAll("[data-sidebar-row]")].some((node) => node.dataset.sidebarRow === removedFocus.current.id)) {
        const next = [...viewport.querySelectorAll("[data-sidebar-row]")].find((node) => node.dataset.sidebarRow === removedFocus.current.next);
        (next || backButton.current)?.focus({ preventScroll: true });
        removedFocus.current = null;
      }
    }, [wide, view, query, project, data.rows, data.operationError, currentSearch.items, limit, preferences.density, catalog]);
    const lastCurrent = (0, import_react2.useRef)(null);
    (0, import_react2.useEffect)(() => {
      const current = data.rows.find((row) => row.current);
      if (current && current.id !== lastCurrent.current && current.session.blank && historyView) showView("main", false);
      if (current) lastCurrent.current = current.id;
    }, [data.rows]);
    const order = mainRows.filter((row) => ["pinned", "inbox", "working"].includes(row.section)).map((row) => row.id);
    const searchRows = historyView ? settled.slice(0, limit) : mainRows.slice(0, limit);
    const cancelDrag = () => {
      activeDrag.current = null;
      target.current = null;
      setDragState(null);
      setOver(null);
    };
    const drag = {
      active: dragState,
      over,
      rows: data.rows,
      disabled: !wide || !!needle || !!rename.state,
      start(id) {
        activeDrag.current = id;
        target.current = null;
        setDragState(id);
        setOver(null);
      },
      cancel: cancelDrag,
      hover(next) {
        target.current = next;
        setOver((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      },
      drop() {
        const id = activeDrag.current, destination = target.current;
        cancelDrag();
        if (!id || !destination || destination.id === id) return;
        void actions.move(id, { section: destination.section, ...destination.id ? { [destination.half === "after" ? "afterId" : "beforeId"]: destination.id } : {} });
      }
    };
    (0, import_react2.useEffect)(() => {
      if (!dragState) return;
      const escape = (e) => {
        if (e.key === "Escape") cancelDrag();
      }, leave = (e) => {
        if (!root.current?.contains(e.target)) cancelDrag();
      };
      window.addEventListener("blur", cancelDrag);
      document.addEventListener("keydown", escape);
      document.addEventListener("drop", leave);
      return () => {
        window.removeEventListener("blur", cancelDrag);
        document.removeEventListener("keydown", escape);
        document.removeEventListener("drop", leave);
      };
    }, [dragState]);
    (0, import_react2.useLayoutEffect)(() => {
      if (rename.state || !rename.focusId.current) return;
      const id = rename.focusId.current;
      rename.focusId.current = null;
      [...root.current.querySelectorAll("[data-sidebar-row]")].find((n) => n.dataset.sidebarRow === id)?.focus({ preventScroll: true });
    }, [rename.state]);
    const lastSearch = (0, import_react2.useRef)(0), lastAdd = (0, import_react2.useRef)(false);
    (0, import_react2.useEffect)(() => {
      if (shortcuts.searchRequest !== lastSearch.current) {
        lastSearch.current = shortcuts.searchRequest;
        if (shortcuts.searchRequest) {
          focusRequested.current = true;
          if (historyView) showView("main", false);
          expandSidebar();
          if (wide && !historyView) input.current?.focus({ preventScroll: true });
        }
      }
      if (shortcuts.addRequested !== lastAdd.current) {
        lastAdd.current = shortcuts.addRequested;
        if (shortcuts.addRequested && canAdd) void actions.addWorkspace();
      }
    }, [shortcuts.searchRequest, shortcuts.addRequested, canAdd]);
    (0, import_react2.useEffect)(() => {
      if (wide && focusRequested.current) {
        input.current?.focus({ preventScroll: true });
        focusRequested.current = false;
      }
    }, [wide, view]);
    (0, import_react2.useEffect)(() => {
      if (!data.undo) return;
      const key = (e) => {
        if (!e.defaultPrevented && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z" && !e.target.closest("input,textarea,[contenteditable=true]")) {
          e.preventDefault();
          void actions.undo();
        }
      };
      document.addEventListener("keydown", key);
      return () => document.removeEventListener("keydown", key);
    }, [data.undo]);
    (0, import_react2.useEffect)(() => setActiveResult(0), [needle, project]);
    const rowElement = (row) => {
      const index = searchRows.findIndex((item) => item.id === row.id);
      return /* @__PURE__ */ React2.createElement(
        SessionRow,
        {
          key: "session:" + row.id,
          row,
          actions,
          t,
          rename,
          busy: data.busy.has(row.id),
          order,
          preferences,
          inlineDetails,
          historyView,
          onRestoreStart: rememberRestoredRow,
          useSessionAccess,
          drag,
          snippet: matches.get(row.id),
          onCustomSnooze: (row2, order2) => setCustomSnooze({ row: row2, order: order2 }),
          searchProps: needle ? { id: "dsi-search-result-" + index, role: "option", "aria-selected": index === activeResult } : void 0
        }
      );
    };
    const children = [];
    if (historyView) children.push(...(needle ? searchRows : settled.slice(0, limit)).map(rowElement));
    else children.push(...mainRows.slice(0, limit).map(rowElement));
    if (data.phase === "pending") children.push(/* @__PURE__ */ React2.createElement("div", { key: "loading", role: "status", className: "dsi-dsh-empty" }, t("loading")));
    if (data.phase === "error") children.push(/* @__PURE__ */ React2.createElement("div", { key: "error", role: "alert", className: "dsi-dsh-error" }, t("loadFailed"), /* @__PURE__ */ React2.createElement(Button, { variant: "outline", onClick: actions.retry }, t("retry"))));
    if (data.phase === "ready" && !(historyView ? settled : mainRows).length && !needle) children.push(/* @__PURE__ */ React2.createElement("div", { key: "empty", role: "status", className: "dsi-dsh-empty" }, t(historyView ? "emptySettled" : "empty")));
    if (needle && currentSearch.pending && !visible.length) children.push(/* @__PURE__ */ React2.createElement("div", { key: "searching", role: "status", className: "dsi-dsh-empty" }, t("searching")));
    if (needle && !visible.length && !currentSearch.pending) children.push(/* @__PURE__ */ React2.createElement("div", { key: "noMatches", className: "dsi-dsh-empty" }, t("noMatches")));
    if (needle && currentSearch.error) children.push(/* @__PURE__ */ React2.createElement("div", { key: "searchError", role: "alert", className: "dsi-dsh-error" }, t("searchFailed", { message: currentSearch.error })));
    if ((historyView ? settled : mainRows).length > limit) children.push(/* @__PURE__ */ React2.createElement("button", { key: "more", className: "dsi-dsh-more", onClick: () => setLimit((n) => n + 60) }, t("more", { n: Math.min(60, (historyView ? settled : mainRows).length - limit) })));
    if (needle && currentSearch.hasMore) children.push(/* @__PURE__ */ React2.createElement("div", { key: "searchMore", className: "dsi-dsh-empty" }, t("searchMore")));
    if (data.connectionState === "loading" && data.phase === "ready") children.push(/* @__PURE__ */ React2.createElement("div", { key: "connection", role: "status", className: "dsi-dsh-empty" }, t("reconnecting")));
    const placementDrop = (section) => ({
      onDragOver(e) {
        if (activeDrag.current) {
          e.preventDefault();
          drag.hover({ section });
        }
      },
      onDrop(e) {
        if (activeDrag.current) {
          e.preventDefault();
          e.stopPropagation();
          drag.drop();
        }
      }
    });
    return /* @__PURE__ */ React2.createElement("div", { ref: root, className: "dsi-root dsi-dsh" + (!wide ? " dsi-rail" : ""), "data-sidebar-view": view, "data-dsi-density": preferences.density, "data-dsi-list-motion": preferences.listMotion }, /* @__PURE__ */ React2.createElement("style", null, stylesheet), !wide ? /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-rail" }, /* @__PURE__ */ React2.createElement(IconButton, { label: t("search"), name: "IconSearchOutlineRegular", onClick: () => {
      focusRequested.current = true;
      expandSidebar();
    } }), /* @__PURE__ */ React2.createElement(IconButton, { label: t("projects"), name: "IconFolderCloseRegular", onClick: () => {
      setFilterOpen(true);
      expandSidebar();
    } })) : /* @__PURE__ */ React2.createElement(React2.Fragment, null, historyView && /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-history-header" }, /* @__PURE__ */ React2.createElement(
      "button",
      {
        ref: backButton,
        type: "button",
        className: "dsi-dsh-back",
        "aria-label": t("backToSessions"),
        "data-testid": "sidebar-settled-back",
        "data-drop": over?.section === "inbox" && !over.id || void 0,
        onClick: () => showView("main"),
        ...placementDrop("inbox")
      },
      icon("IconChevronLeftOutlineRegular", 16),
      /* @__PURE__ */ React2.createElement("span", null, t("settled"))
    ), /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-count" }, settledCount)), /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-toolbar" }, /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-search" }, icon("IconSearchOutlineRegular", 14), /* @__PURE__ */ React2.createElement(
      "input",
      {
        ref: input,
        type: "text",
        role: "combobox",
        "aria-label": t(historyView ? "searchSettled" : "search"),
        placeholder: t(historyView ? "searchSettled" : "search"),
        value: query,
        maxLength: 500,
        "aria-autocomplete": "list",
        "aria-expanded": !!needle,
        "aria-controls": needle ? "dsi-search-results" : void 0,
        "aria-activedescendant": needle && searchRows.length ? "dsi-search-result-" + Math.min(activeResult, searchRows.length - 1) : void 0,
        onChange: (e) => {
          setQuery(e.target.value.replaceAll("\0", "").slice(0, 500));
          setLimit(60);
        },
        onKeyDown: (e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setQuery("");
          }
          if (needle && searchRows.length && ["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "Enter") void actions.open(searchRows[Math.min(activeResult, searchRows.length - 1)].id);
            else setActiveResult((n) => (n + (e.key === "ArrowUp" ? -1 : 1) + searchRows.length) % searchRows.length);
          }
        }
      }
    ), !!query && /* @__PURE__ */ React2.createElement("button", { type: "button", className: "dsi-dsh-icon-button", "aria-label": t("clearSearch"), onClick: () => {
      setQuery("");
      input.current?.focus();
    } }, icon("IconCloseOutlineRegular", 14))), /* @__PURE__ */ React2.createElement(
      Menu,
      {
        open: filterOpen,
        onClose: () => setFilterOpen(false),
        portal: true,
        dense: true,
        autoFocus: true,
        align: "end",
        selectedId: project ? "group:" + (selectedGroup?.key || project) : "scope:all",
        items: [
          { id: "scope:all", label: t("allProjects") },
          ...groups.filter((group) => !group.archived || showArchived || group === selectedGroup).map((group) => ({ id: "group:" + group.key, label: group.name || t("ungrouped"), icon: /* @__PURE__ */ React2.createElement(ProjectIcon, { project: group, compact: true }) })),
          ...historyView ? [] : [{ type: "separator", id: "workspace-actions" }, ...groups.some((group) => group.archived) ? [{ id: "action:archived-projects", label: t(showArchived ? "hideArchivedProjects" : "showArchivedProjects") }] : [], { id: "action:add-workspace", label: t("addProject"), icon: icon("IconProjectAddOutlineRegular"), disabled: !canAdd || data.busy.has("workspace") }]
        ],
        onSelect: (id) => {
          setFilterOpen(false);
          if (id === "action:add-workspace") {
            if (canAdd && !data.busy.has("workspace")) void actions.addWorkspace();
          } else if (id === "scope:all") setProject("");
          else if (id === "action:archived-projects") setShowArchived(!showArchived);
          else if (id.startsWith("group:")) setProject(id.slice("group:".length));
        },
        anchor: /* @__PURE__ */ React2.createElement(Tooltip, { label: t("projects"), side: "bottom", delayMs: 500, portal: true, disabled: filterOpen }, /* @__PURE__ */ React2.createElement(
          "button",
          {
            type: "button",
            className: "dsi-dsh-icon-button",
            "aria-label": t("projects"),
            "aria-haspopup": "menu",
            "aria-expanded": filterOpen,
            "data-active": !!project || void 0,
            onClick: () => setFilterOpen(!filterOpen)
          },
          icon("IconFolderCloseRegular")
        ))
      }
    )), project && /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-filter" }, /* @__PURE__ */ React2.createElement("span", null, selectedGroup?.name || t("ungrouped")), !historyView && !!selectedGroup?.workspaceIds.length && /* @__PURE__ */ React2.createElement(ProjectNewSession, { group: selectedGroup, canCreate, start: (workspaceId) => actions.start(workspaceId), t }), /* @__PURE__ */ React2.createElement(IconButton, { label: t("allProjects"), name: "IconCloseOutlineRegular", onClick: () => setProject("") })), (data.persistenceError || data.operationError) && /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-error", role: "alert" }, /* @__PURE__ */ React2.createElement("span", null, data.persistenceError ? t("storageFailed", { message: data.persistenceError }) : t("operationFailed", { message: data.operationError })), !data.persistenceError && /* @__PURE__ */ React2.createElement(IconButton, { label: t("close"), name: "IconCloseOutlineRegular", onClick: actions.dismissError })), /* @__PURE__ */ React2.createElement("div", { ref: scroll, onScroll: capturePosition, className: "dsi-dsh-scroll", "data-slot": "scroll-area-viewport", onDragOver: (e) => {
      if (activeDrag.current) e.preventDefault();
    } }, /* @__PURE__ */ React2.createElement(HoverCardGroup, { className: "dsi-dsh-list-seat" }, /* @__PURE__ */ React2.createElement("div", { id: needle ? "dsi-search-results" : void 0, className: "dsi-dsh-list-frame" }, /* @__PURE__ */ React2.createElement(
      AnimatedRows,
      {
        className: "dsi-dsh-list",
        role: needle ? "listbox" : "tree",
        label: needle ? t("search") : t(historyView ? "settled" : "inbox"),
        rowKeys: children.map((child) => String(child.key)),
        ready: !historyView && preferences.listMotion && data.phase === "ready" && !dragState && !rename.state,
        resetKey: [view, wide, project, needle, preferences.density].join(":")
      },
      children
    ))), /* @__PURE__ */ React2.createElement("div", { ref: scrollReserve, className: "dsi-dsh-scroll-reserve", "aria-hidden": "true" })), !historyView && /* @__PURE__ */ React2.createElement(
      "button",
      {
        ref: entryButton,
        type: "button",
        className: "dsi-dsh-settled-entry",
        "data-testid": "sidebar-settled-entry",
        "aria-label": t("openSettled", { n: allSettledCount }),
        "data-drop": over?.section === "settled" && !over.id || void 0,
        onClick: showSettled,
        ...placementDrop("settled")
      },
      icon("IconArchiveOutlineRegular", 16),
      /* @__PURE__ */ React2.createElement("span", null, t("settled")),
      /* @__PURE__ */ React2.createElement("span", { className: "dsi-dsh-count" }, allSettledCount),
      icon("IconChevronRightOutlineRegular", 14)
    ), data.undo && /* @__PURE__ */ React2.createElement("div", { className: "dsi-dsh-undo", role: "status" }, /* @__PURE__ */ React2.createElement("span", null, t("undo_" + data.undo.kind)), /* @__PURE__ */ React2.createElement("button", { type: "button", disabled: data.busy.has(data.undo.id) || data.busy.has("undo"), title: t("undoShortcut"), onClick: () => void actions.undo() }, t("undo")), /* @__PURE__ */ React2.createElement(IconButton, { label: t("close"), name: "IconCloseOutlineRegular", onClick: actions.dismissUndo })), customSnooze && /* @__PURE__ */ React2.createElement(CustomSnooze, { target: customSnooze, close: () => setCustomSnooze(null), actions, t })));
  };
}

// src/settled-notice.jsx
function settledAge(at, now, t) {
  const minutes = Math.max(0, Math.floor((now - at) / 6e4));
  if (minutes < 1) return t("settledNow");
  if (minutes < 60) return t("settledMinutesAgo", { n: minutes });
  if (minutes < 1440) return t("settledHoursAgo", { n: Math.floor(minutes / 60) });
  return t("settledDaysAgo", { n: Math.floor(minutes / 1440) });
}
function createSettledNotice(React2, stylesheet) {
  const { useId, useState: useState3 } = React2;
  function Notice({ row, busy, error, actions, t }) {
    const [attempted, setAttempted] = useState3(false);
    const errorId = useId();
    const at = row.record.settledFromArchive ? 0 : row.record.settledAt;
    const date = at > 0 ? new Date(at) : null;
    const knownTime = date !== null && Number.isFinite(date.getTime());
    const failure = attempted && !busy && error;
    return /* @__PURE__ */ React2.createElement(
      "aside",
      {
        className: "dsi-settled-notice",
        "aria-label": t("settledNotice"),
        "data-session-id": row.id
      },
      /* @__PURE__ */ React2.createElement("style", null, stylesheet),
      /* @__PURE__ */ React2.createElement("div", { className: "dsi-settled-notice-row" }, /* @__PURE__ */ React2.createElement("span", { className: "dsi-settled-notice-status", role: "status" }, /* @__PURE__ */ React2.createElement(
        "svg",
        {
          width: "15",
          height: "15",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.6",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true"
        },
        /* @__PURE__ */ React2.createElement("circle", { cx: "12", cy: "12", r: "9" }),
        /* @__PURE__ */ React2.createElement("path", { d: "m8 12 3 3 5-6" })
      ), /* @__PURE__ */ React2.createElement("span", null, t("settled")), knownTime && /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("span", { "aria-hidden": "true" }, "\xB7"), /* @__PURE__ */ React2.createElement("time", { dateTime: date.toISOString(), title: date.toLocaleString() }, settledAge(at, Date.now(), t)))), /* @__PURE__ */ React2.createElement("span", { className: "dsi-settled-notice-divider", "aria-hidden": "true" }, "\xB7"), /* @__PURE__ */ React2.createElement(
        "button",
        {
          type: "button",
          disabled: busy,
          "aria-busy": busy,
          "aria-describedby": failure ? errorId : void 0,
          onClick: () => {
            setAttempted(true);
            void actions.restore(row.id);
          }
        },
        t(busy ? "restoringSettled" : "restore")
      )),
      failure && /* @__PURE__ */ React2.createElement("p", { id: errorId, role: "alert", className: "dsi-settled-notice-error" }, t("restoreSettledFailed", { message: error }))
    );
  }
  return function SettledNotice({ sessionId, useInbox, useSidebarPreferences = (select) => select({ value: DEFAULT_PREFERENCES }), actions, t }) {
    const data = useInbox((state) => state);
    const row = data.rows.find((item) => item.id === sessionId && item.section === "settled");
    const enabled = useSidebarPreferences((state) => state.value.settledNotice);
    if (!row || !enabled) return null;
    return /* @__PURE__ */ React2.createElement(
      Notice,
      {
        key: row.id + ":" + row.record.settledAt,
        row,
        busy: data.busy.has(row.id),
        error: data.operationError,
        actions,
        t
      }
    );
  };
}

// src/avatar-launcher.js
function installAvatarLauncher(ctx, React2) {
  function AvatarOnlyLauncher({ nativeAccountLauncher, openSettings, settingsOpen, t, ...props }) {
    const root = React2.useRef(null);
    React2.useLayoutEffect(() => {
      const trigger = root.current?.querySelector("button[data-collapsed][aria-haspopup]");
      if (!trigger) return;
      trigger.setAttribute("aria-label", t("settings"));
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", String(!!settingsOpen));
    }, [settingsOpen, t]);
    function activate(event) {
      if (!root.current?.contains(event.target)) return;
      const trigger = event.target.closest?.("button[data-collapsed][aria-haspopup]");
      if (!trigger || trigger.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    }
    return React2.createElement(
      "div",
      { ref: root, style: { display: "contents" }, onClickCapture: activate },
      React2.createElement(nativeAccountLauncher, { ...props, openSettings, settingsOpen, t, wide: false })
    );
  }
  ctx.slots.inject("settings.launcher", () => ctx.effect(() => {
    let original;
    let disposeEntry;
    let installing = false;
    function install() {
      if (installing) return;
      const next = ctx.slots.entries("settings.launcher").find((entry) => entry.component !== AvatarOnlyLauncher);
      if (next === original) return;
      installing = true;
      try {
        disposeEntry?.();
        disposeEntry = void 0;
        original = next;
        if (!next) return;
        disposeEntry = ctx.slots.register({
          name: "settings.launcher",
          priority: -100,
          locale: next.locale ?? next.options?.locale,
          ...next.store ? { store: next.store } : {},
          inject: (...args) => ({ ...next.inject?.(...args), nativeAccountLauncher: next.component })
        }, AvatarOnlyLauncher);
      } finally {
        installing = false;
      }
    }
    const unsubscribe = ctx.slots.subscribe("settings.launcher", install);
    install();
    return () => {
      unsubscribe();
      disposeEntry?.();
    };
  }, "inbox-sidebar: avatar-only account launcher"));
}

// src/locales.js
var zh = {
  settingsTitle: "\u4F1A\u8BDD\u4FA7\u8FB9\u680F",
  settingsDescription: "\u4EC5\u5F71\u54CD\u5F53\u524D\u8BBE\u5907\uFF0C\u4FEE\u6539\u540E\u7ACB\u5373\u751F\u6548\u3002",
  settingsDisplay: "\u663E\u793A",
  settingsBehavior: "\u884C\u4E3A",
  settingsDensity: "\u663E\u793A\u5BC6\u5EA6",
  settingsDensityHint: "\u4F1A\u8BDD\u5747\u663E\u793A\u9879\u76EE\u4E0E\u6807\u9898\u4E24\u884C\uFF1B\u7D27\u51D1\u4F1A\u51CF\u5C0F\u884C\u95F4\u7559\u767D\u3002",
  settingsComfortable: "\u6807\u51C6",
  settingsCompact: "\u7D27\u51D1",
  settingsTooltips: "\u4F1A\u8BDD\u8BE6\u60C5\u63D0\u793A",
  settingsSettledNotice: "\u6536\u8D77\u72B6\u6001\u63D0\u793A",
  settingsSettledNoticeHint: "\u5728\u8F93\u5165\u6846\u4E0A\u65B9\u663E\u793A\u5F53\u524D\u4F1A\u8BDD\u7684\u6536\u8D77\u72B6\u6001\u3002",
  settingsSettledExpanded: "\u9ED8\u8BA4\u5C55\u5F00\u300C\u5DF2\u6536\u8D77\u300D",
  settingsSnoozedExpanded: "\u9ED8\u8BA4\u5C55\u5F00\u300C\u7A0D\u540E\u63D0\u9192\u300D",
  settingsListMotion: "\u5217\u8868\u8FC7\u6E21\u52A8\u6548",
  settingsListMotionHint: "\u9075\u5FAA\u7CFB\u7EDF\u7684\u51CF\u5C11\u52A8\u6001\u6548\u679C\u8BBE\u7F6E\u3002",
  settingsReset: "\u91CD\u7F6E\u4FA7\u680F\u504F\u597D",
  settingsSaveFailed: "\u65E0\u6CD5\u8BFB\u53D6\u6216\u4FDD\u5B58\u504F\u597D\uFF1A{message}",
  openSession: "\u6253\u5F00\u4F1A\u8BDD",
  sessionActions: "\u4F1A\u8BDD\u64CD\u4F5C",
  cancel: "\u53D6\u6D88",
  search: "\u641C\u7D22\u4F1A\u8BDD",
  allProjects: "\u6240\u6709\u9879\u76EE",
  filterProject: "\u6309\u9879\u76EE\u7B5B\u9009",
  addProject: "\u6DFB\u52A0\u9879\u76EE",
  projects: "\u9879\u76EE",
  toggleProject: "\u5C55\u5F00\u6216\u6536\u8D77 {name}",
  showArchivedProjects: "\u663E\u793A\u5DF2\u5F52\u6863\u9879\u76EE",
  hideArchivedProjects: "\u9690\u85CF\u5DF2\u5F52\u6863\u9879\u76EE",
  newSession: "\u65B0\u5EFA\u4F1A\u8BDD",
  newSessionInProject: "\u5728 {name} \u4E2D\u65B0\u5EFA\u4F1A\u8BDD",
  inbox: "\u5F85\u5904\u7406",
  working: "\u5DE5\u4F5C\u4E2D",
  snoozed: "\u7A0D\u540E\u63D0\u9192",
  settled: "\u5DF2\u6536\u8D77",
  searchSettled: "\u641C\u7D22\u5DF2\u6536\u8D77",
  backToSessions: "\u8FD4\u56DE\u4F1A\u8BDD\u5217\u8868",
  openSettled: "\u67E5\u770B\u5DF2\u6536\u8D77\uFF08{n}\uFF09",
  emptySettled: "\u6682\u65E0\u5DF2\u6536\u8D77\u4F1A\u8BDD",
  settledAgo: "{time}\u6536\u8D77",
  lastActiveAgo: "\u6700\u540E\u6D3B\u52A8 {time}",
  pinned: "\u5DF2\u7F6E\u9876",
  pin: "\u7F6E\u9876",
  unpin: "\u53D6\u6D88\u7F6E\u9876",
  settle: "\u6536\u8D77",
  restore: "\u79FB\u56DE\u4F1A\u8BDD\u5217\u8868",
  snooze: "\u7A0D\u540E\u63D0\u9192",
  rename: "\u91CD\u547D\u540D",
  approval: "\u5F85\u5BA1\u6279",
  plan: "\u8BA1\u5212\u5F85\u5BA1",
  answer: "\u5F85\u56DE\u590D",
  completed: "\u672A\u8BFB\u7ED3\u679C",
  failed: "\u51FA\u9519\u4E86",
  ready: "\u5DF2\u8BFB",
  now: "\u521A\u521A",
  minutes: "{n}m",
  hours: "{n}h",
  days: "{n}d",
  hourLater: "1 \u5C0F\u65F6\u540E",
  tomorrow: "\u660E\u5929\u4E0A\u5348 9 \u70B9",
  monday: "\u4E0B\u5468\u4E00\u4E0A\u5348 9 \u70B9",
  customTime: "\u81EA\u5B9A\u65F6\u95F4",
  confirmSnooze: "\u8BBE\u5B9A\u63D0\u9192",
  close: "\u5173\u95ED",
  reminderFailed: "\u63D0\u9192\u672A\u4FDD\u5B58\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  reminderAt: "\u63D0\u9192\uFF1A{time}",
  empty: "\u6682\u65E0\u4F1A\u8BDD",
  drafts: "\u8349\u7A3F",
  unsent: "\u672A\u53D1\u9001",
  settledNotice: "\u4F1A\u8BDD\u6536\u8D77\u72B6\u6001",
  settledNow: "\u521A\u521A",
  settledMinutesAgo: "{n} \u5206\u949F\u524D",
  settledHoursAgo: "{n} \u5C0F\u65F6\u524D",
  settledDaysAgo: "{n} \u5929\u524D",
  restoringSettled: "\u6B63\u5728\u6062\u590D\u2026",
  restoreSettledFailed: "\u65E0\u6CD5\u79FB\u56DE\u4F1A\u8BDD\u5217\u8868\uFF1A{message}",
  renameEmpty: "\u8BF7\u8F93\u5165\u4F1A\u8BDD\u540D\u79F0",
  renameFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}",
  noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD",
  clearSearch: "\u6E05\u9664\u641C\u7D22",
  loading: "\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u2026",
  retry: "\u91CD\u8BD5",
  loadFailed: "\u65E0\u6CD5\u8BFB\u53D6\u4F1A\u8BDD",
  operationFailed: "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  storageFailed: "\u6536\u4EF6\u7BB1\u72B6\u6001\u65E0\u6CD5\u4FDD\u5B58\uFF1A{message}",
  reconnecting: "\u6B63\u5728\u91CD\u65B0\u8FDE\u63A5\u2026",
  archivedOpen: "\u6062\u590D\u5E76\u6253\u5F00\u4F1A\u8BDD",
  show: "\u5C55\u5F00{section}",
  hide: "\u6536\u8D77{section}",
  dropPin: "\u62D6\u5230\u8FD9\u91CC\u7F6E\u9876",
  undo: "\u64A4\u9500",
  undoShortcut: "\u64A4\u9500\uFF08\u2318Z / Ctrl+Z\uFF1B\u6587\u5B57\u8F93\u5165\u65F6\u4FDD\u7559\u6587\u672C\u64A4\u9500\uFF09",
  drag_pin: "\u7F6E\u9876",
  drag_unpin: "\u53D6\u6D88\u7F6E\u9876",
  drag_settle: "\u6536\u8D77",
  drag_unsettle: "\u79FB\u56DE\u4F1A\u8BDD\u5217\u8868",
  drag_wake: "\u5524\u56DE\u4F1A\u8BDD\u5217\u8868",
  undo_settled: "\u5DF2\u6536\u8D77\u4F1A\u8BDD",
  undo_snoozed: "\u5DF2\u8BBE\u5B9A\u7A0D\u540E\u63D0\u9192",
  undo_restored: "\u5DF2\u79FB\u56DE\u4F1A\u8BDD\u5217\u8868",
  undo_pinned: "\u5DF2\u7F6E\u9876\u4F1A\u8BDD",
  undo_unpinned: "\u5DF2\u53D6\u6D88\u7F6E\u9876",
  undo_moved: "\u5DF2\u79FB\u52A8\u4F1A\u8BDD",
  more: "\u518D\u663E\u793A {n} \u9879",
  ungrouped: "\u672A\u5206\u7EC4",
  searching: "\u6B63\u5728\u641C\u7D22\u6D88\u606F\u5185\u5BB9\u2026",
  searchFailed: "\u6D88\u606F\u641C\u7D22\u5931\u8D25\uFF1A{message}",
  searchMore: "\u8FD8\u6709\u66F4\u591A\u5339\u914D\uFF0C\u8BF7\u7F29\u5C0F\u641C\u7D22\u8303\u56F4\u3002"
};
var en = {
  settingsTitle: "Session sidebar",
  settingsDescription: "Applies immediately on this device.",
  settingsDisplay: "Display",
  settingsBehavior: "Behavior",
  settingsDensity: "Display density",
  settingsDensityHint: "Every conversation shows its project and title. Compact reduces the spacing between them.",
  settingsComfortable: "Standard",
  settingsCompact: "Compact",
  settingsTooltips: "Session detail tooltips",
  settingsSettledNotice: "Settled status notice",
  settingsSettledNoticeHint: "Show the current session\u2019s settled status above the composer.",
  settingsSettledExpanded: "Expand Settled by default",
  settingsSnoozedExpanded: "Expand Snoozed by default",
  settingsListMotion: "List transitions",
  settingsListMotionHint: "Respects the system\u2019s reduced motion preference.",
  settingsReset: "Reset sidebar preferences",
  settingsSaveFailed: "Could not read or save preferences: {message}",
  openSession: "Open session",
  sessionActions: "Session actions",
  cancel: "Cancel",
  search: "Search sessions",
  allProjects: "All projects",
  filterProject: "Filter by project",
  addProject: "Add project",
  projects: "Projects",
  toggleProject: "Expand or collapse {name}",
  showArchivedProjects: "Show archived projects",
  hideArchivedProjects: "Hide archived projects",
  newSession: "New session",
  newSessionInProject: "New session in {name}",
  inbox: "Inbox",
  working: "Working",
  snoozed: "Snoozed",
  settled: "Settled",
  searchSettled: "Search settled sessions",
  backToSessions: "Back to sessions",
  openSettled: "View settled sessions ({n})",
  emptySettled: "No settled sessions",
  settledAgo: "Settled {time}",
  lastActiveAgo: "Last active {time}",
  pinned: "Pinned",
  pin: "Pin",
  unpin: "Unpin",
  settle: "Settle",
  restore: "Move to inbox",
  snooze: "Snooze",
  rename: "Rename",
  approval: "Approval",
  plan: "Plan review",
  answer: "Needs reply",
  completed: "Unread result",
  failed: "Failed",
  ready: "Read",
  now: "now",
  minutes: "{n}m",
  hours: "{n}h",
  days: "{n}d",
  hourLater: "In 1 hour",
  tomorrow: "Tomorrow at 9 AM",
  monday: "Monday at 9 AM",
  customTime: "Custom time",
  confirmSnooze: "Set reminder",
  close: "Close",
  reminderFailed: "Reminder was not saved. Try again.",
  reminderAt: "Reminder: {time}",
  empty: "No sessions to review",
  drafts: "Drafts",
  unsent: "Unsent",
  settledNotice: "Settled session status",
  settledNow: "just now",
  settledMinutesAgo: "{n}m ago",
  settledHoursAgo: "{n}h ago",
  settledDaysAgo: "{n}d ago",
  restoringSettled: "Restoring\u2026",
  restoreSettledFailed: "Could not move to inbox: {message}",
  renameEmpty: "Enter a session name",
  renameFailed: "Could not save: {message}",
  noMatches: "No matching sessions",
  clearSearch: "Clear search",
  loading: "Loading sessions\u2026",
  retry: "Retry",
  loadFailed: "Could not load sessions",
  operationFailed: "Action failed: {message}",
  storageFailed: "Inbox state could not be saved: {message}",
  reconnecting: "Reconnecting\u2026",
  archivedOpen: "Restore and open session",
  show: "Expand {section}",
  hide: "Collapse {section}",
  dropPin: "Drop here to pin",
  undo: "Undo",
  undoShortcut: "Undo (\u2318Z / Ctrl+Z; text fields keep their text undo)",
  drag_pin: "Pin",
  drag_unpin: "Unpin",
  drag_settle: "Settle",
  drag_unsettle: "Move to inbox",
  drag_wake: "Wake",
  undo_settled: "Session settled",
  undo_snoozed: "Reminder set",
  undo_restored: "Moved to inbox",
  undo_pinned: "Session pinned",
  undo_unpinned: "Session unpinned",
  undo_moved: "Session moved",
  more: "Show {n} more",
  ungrouped: "Ungrouped",
  searching: "Searching message content\u2026",
  searchFailed: "Message search failed: {message}",
  searchMore: "More matches are available. Refine your search."
};

// src/native/sidebar.css
var sidebar_default = "/* The surrounding sidebar belongs to DSH. These rules only style our browser. */\n.dsi-dsh { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; position:relative; color:var(--dsw-alias-label-primary); font-family:var(--dsw-font-family,inherit); font-size:14px; line-height:20px; }\n.dsi-dsh *, .dsi-dsh-drag-preview * { box-sizing:border-box; }\n.dsi-dsh button, .dsi-dsh input { font:inherit; color:inherit; }\n.dsi-dsh button { cursor:pointer; }\n.dsi-dsh button:disabled { cursor:default; opacity:.4; }\n.dsi-dsh button:focus-visible, .dsi-dsh-row:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }\n.dsi-dsh-toolbar { display:flex; align-items:center; gap:10px; flex:none; min-height:36px; padding:0 8px; }\n.dsi-dsh-icon-button { display:inline-flex; flex:none; align-items:center; justify-content:center; width:24px; height:24px; padding:0; border:0; border-radius:var(--dsw-radius-xs,4px); background:transparent; color:var(--dsw-alias-label-tertiary); }\n.dsi-dsh-icon-button[data-active], .dsi-dsh-icon-button[aria-pressed=true] { color:var(--dsw-alias-state-business-primary); }\n.dsi-dsh-search { display:flex; align-items:center; gap:6px; flex:1; min-width:0; color:var(--dsw-alias-label-tertiary); }\n.dsi-dsh-search input { width:100%; min-width:0; padding:4px 0; border:0; outline:0; background:transparent; font-size:14px; line-height:20px; caret-color:var(--dsw-alias-state-business-primary); }\n.dsi-dsh-search:focus-within { color:var(--dsw-alias-label-primary); }\n.dsi-dsh-search input::placeholder { color:var(--dsw-alias-label-tertiary); }\n.dsi-dsh-search:has(input:focus-visible) { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; border-radius:var(--dsw-radius-xs,4px); }\n.dsi-dsh-filter { display:flex; align-items:center; gap:6px; padding:0 8px 4px 14px; font-size:12px; color:var(--dsw-alias-label-secondary); }\n.dsi-dsh-filter>span { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }\n.dsi-dsh-scroll { overflow:auto; overscroll-behavior:contain; flex:1; min-height:0; scrollbar-width:none; }\n.dsi-dsh-scroll::-webkit-scrollbar { display:none; }\n.dsi-dsh-list-seat, .dsi-dsh-list-frame { display:flex; flex-direction:column; min-height:100%; position:relative; }\n.dsi-dsh-list { display:flex; flex-direction:column; flex:1; min-height:100%; padding:0 4px 8px; }\n.dsi-dsh-list-frame { flex:1; }\n.dsi-dsh-count { margin-left:auto; font-size:12px; color:var(--dsw-alias-label-tertiary); font-variant-numeric:tabular-nums; }\n.dsi-dsh-entry { flex:none; min-width:0; position:relative; margin:2px 0; }\n.dsi-dsh-row-menu { display:contents; }\n.dsi-dsh-row { display:flex; flex-direction:column; align-items:stretch; gap:4px; height:64px; padding:8px 10px; border:1px solid transparent; border-radius:var(--dsw-radius-md,8px); background:transparent; color:var(--dsw-alias-label-primary); cursor:pointer; outline-offset:-2px; position:relative; }\n.dsi-dsh-row[data-current] { background:var(--dsw-alias-bg-base); border-color:var(--dsw-alias-border-l3); }\n.dsi-dsh-row[data-menu-open]:not([data-current]) { background:var(--dsw-alias-interactive-bg-hover); }\n.dsi-dsh-row[data-dragging] { opacity:.4; }\n.dsi-dsh-title { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:15px; line-height:22px; font-weight:400; color:var(--dsw-alias-label-primary); }\n.dsi-dsh-row[data-current] .dsi-dsh-title { font-weight:600; }\n.dsi-dsh-time { flex:none; font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; white-space:nowrap; }\n.dsi-dsh-row-actions { display:none; position:absolute; right:0; top:0; height:24px; align-items:center; gap:2px; }\n.dsi-dsh-rename { flex:1; width:0; min-width:0; margin:0; height:22px; padding:0 2px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-sm,6px); background:var(--dsw-alias-button-elevated-fill); outline:none; font-size:14px; line-height:20px; }\n.dsi-dsh-rename[aria-invalid=true] { border-color:var(--dsw-alias-state-error-primary); }\n.dsi-dsh-rename-error { position:absolute; top:100%; left:10px; right:10px; z-index:2; padding:6px 8px; border:1px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-sm,6px); background:var(--dsw-alias-button-elevated-fill); color:var(--dsw-alias-state-error-primary); font-size:12px; overflow-wrap:anywhere; }\n/* Scope the host card through our content so other DSH hover cards keep their style. */\ndiv:has(> .dsi-dsh-details) { width:240px; max-width:calc(100vw - 24px); padding:10px 12px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-md); color:var(--dsw-alias-label-primary); background:var(--dsw-specific-menu); backdrop-filter:var(--dsw-menu-backdrop-filter); box-shadow:var(--dsw-elevation-panel); }\n.dsi-dsh-entry span:has(> .dsi-dsh-row) { display:block; }\n.dsi-dsh-details { display:flex; flex-direction:column; gap:6px; min-width:0; color:var(--dsw-alias-label-secondary); font-family:var(--dsw-font-family,inherit); font-size:12px; line-height:18px; }\n.dsi-dsh-details>strong { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; margin-bottom:2px; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; font-weight:600; }\n.dsi-dsh-detail-line { display:flex; align-items:center; gap:6px; min-width:0; }\n.dsi-dsh-detail-line>svg { flex:none; }\n.dsi-dsh-detail-line>span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.dsi-dsh-snippet { margin:0 10px 5px; color:var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; line-height:17px; }\n.dsi-dsh-empty { flex:none; padding:8px 10px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:20px; }\n.dsi-dsh-error { display:flex; align-items:flex-start; gap:6px; flex:none; padding:8px; color:var(--dsw-alias-state-error-primary); font-size:12px; line-height:20px; overflow-wrap:anywhere; }\n.dsi-dsh-error>span { flex:1; min-width:0; }\n.dsi-dsh-more { flex:none; width:100%; min-height:30px; border:0; border-radius:var(--dsw-radius-sm,6px); background:transparent; color:var(--dsw-alias-label-secondary); font-size:12px; text-align:center; }\n.dsi-dsh-undo { position:absolute; z-index:2; bottom:8px; left:4px; right:4px; display:flex; align-items:center; gap:8px; min-height:36px; padding:4px 8px; border:1px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-sm,6px); background:var(--dsw-alias-button-elevated-fill); box-shadow:0 3px 12px #00000014; font-size:12px; }\n.dsi-dsh-undo>span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.dsi-dsh-undo>button:not(.dsi-dsh-icon-button) { flex:none; padding:0; border:0; background:transparent; color:var(--dsw-alias-state-business-primary); font-size:12px; }\n.dsi-dsh-rail { display:flex; flex-direction:column; align-items:center; gap:4px; }\n.dsi-dsh-rail .dsi-dsh-icon-button { width:36px; height:36px; }\n.dsi-dsh-row[data-drop=before]::before, .dsi-dsh-row[data-drop=after]::after { content:''; position:absolute; left:4px; right:4px; z-index:1; height:2px; background:var(--dsw-alias-state-business-primary); pointer-events:none; }\n.dsi-dsh-row[data-drop=before]::before { top:-1px; }\n.dsi-dsh-row[data-drop=after]::after { bottom:-1px; }\n.dsi-dsh-drag-preview { color:var(--dsw-alias-label-primary); background:var(--dsw-specific-sidebar-fill); }\n.dsi-dsh[data-dsi-density=compact] .dsi-dsh-row { height:52px; padding-block:4px; gap:0; }\n.dsi-dsh[data-dsi-density=compact] .dsi-dsh-title { font-size:14px; line-height:20px; }\n.dsi-dsh[data-dsi-list-motion=false] .dsi-dsh-section>button>svg { transition:none; }\n@media (hover:hover) {\n  .dsi-dsh-icon-button:hover { color:var(--dsw-alias-label-primary); }\n  .dsi-dsh-row:not([data-current]):hover, .dsi-dsh-more:hover { background:var(--dsw-alias-interactive-bg-hover); }\n  .dsi-dsh-row:hover .dsi-dsh-row-actions, .dsi-dsh-row:focus-within .dsi-dsh-row-actions, .dsi-dsh-row[data-menu-open] .dsi-dsh-row-actions { display:inline-flex; }\n  .dsi-dsh-row:hover .dsi-dsh-thread-status, .dsi-dsh-row:focus-within .dsi-dsh-thread-status, .dsi-dsh-row[data-menu-open] .dsi-dsh-thread-status { visibility:hidden; }\n}\n@media (hover:none) { .dsi-dsh-row-actions { display:inline-flex; } .dsi-dsh-row-actions>button:last-child { display:none; } .dsi-dsh-thread-status { visibility:hidden; } }\n@media (prefers-reduced-motion:reduce) { .dsi-dsh-section>button>svg { transition:none; } }\n\n/* Settled sessions have their own browser; the entry shares the sidebar plane. */\n.dsi-dsh[data-sidebar-view=settled] .dsi-dsh-scroll { overflow-anchor:none; }\n.dsi-dsh-scroll-reserve { height:0; flex:none; pointer-events:none; overflow-anchor:none; }\n.dsi-dsh-settled-entry { display:flex; align-items:center; gap:8px; flex:none; height:34px; min-width:0; margin:0 4px 4px; padding:0 10px; border:0; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-secondary); text-align:left; font-size:13px; }\n.dsi-dsh-settled-entry>svg { flex:none; color:var(--dsw-alias-label-secondary); }\n.dsi-dsh-settled-entry>.dsi-dsh-count { color:var(--dsw-alias-label-secondary); }\n.dsi-dsh-history-header { display:flex; align-items:center; gap:8px; flex:none; height:36px; padding:0 12px 0 4px; }\n.dsi-dsh-back { display:flex; align-items:center; gap:6px; height:30px; min-width:0; padding:0 8px; border:0; border-radius:var(--dsw-radius-sm); background:transparent; text-align:left; font-size:14px; font-weight:500; }\n.dsi-dsh-back>svg { flex:none; }\n.dsi-dsh-settled-entry[data-drop], .dsi-dsh-back[data-drop] { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; background:var(--dsw-alias-interactive-bg-hover); }\n.dsi-dsh[data-sidebar-view=main] .dsi-dsh-undo { bottom:44px; }\n@media (hover:hover) { .dsi-dsh-settled-entry:hover, .dsi-dsh-back:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }\n\n/* Project identity is shared with Settings \u2192 Projects; no second theme. */\n.dpm-project-icon.dpm-compact { display:inline-flex; align-items:center; justify-content:center; width:16px; height:18px; flex:none; border-radius:3px; color:var(--dpm-icon-color); background:color-mix(in srgb,var(--dpm-icon-color) 12%,transparent); font-size:8px; line-height:16px; font-weight:650; }\n.dpm-project-icon.dpm-compact:has(>svg), .dpm-project-icon.dpm-compact:has(>.dpm-emoji) { background:transparent; }\n.dpm-compact>img { width:100%; height:100%; object-fit:contain; border-radius:inherit; }\n.dpm-compact>.dpm-emoji { font-size:16px; line-height:18px; }\n\n/* Each conversation repeats its project identity; there are no project headers. */\n.dsi-dsh-thread-meta { display:flex; align-items:center; gap:6px; min-width:0; height:20px; flex:none; }\n.dsi-dsh-thread-project { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); }\n.dsi-dsh-thread-pin { display:inline-flex; flex:none; align-items:center; color:var(--dsw-alias-label-tertiary); }\n.dsi-dsh-thread-title-line { display:flex; align-items:center; gap:6px; min-width:0; height:22px; flex:none; }\n.dsi-dsh-thread-trailing { position:relative; display:flex; align-items:center; justify-content:flex-end; width:58px; height:24px; flex:none; }\n.dsi-dsh-thread-status { display:inline-flex; align-items:center; justify-content:flex-end; gap:4px; color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; white-space:nowrap; }\n.dsi-dsh-row[data-state=warning] .dsi-dsh-thread-status { color:var(--dsw-alias-state-warn-primary); }\n.dsi-dsh-row[data-state=error] .dsi-dsh-thread-status { color:var(--dsw-alias-state-error-primary); }\n.dsi-dsh-project-create-anchor { display:contents; }\n.dsi-dsh-filter>.dsi-dsh-project-create-anchor { flex:none; }\n";

// src/native/footer-icons.css
var footer_icons_default = '/* Keep native panel buttons and selection; share one footer row. */\n[data-slot="sidebar"] > div:has(.dsi-dsh) > nav > span:has(> button[aria-haspopup="menu"]) { display:none; }\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) {\n  display:grid;\n  grid-template-columns:minmax(0,1fr) max-content;\n  grid-template-rows:auto auto auto minmax(0,1fr) auto;\n}\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > * { grid-column:1 / -1; }\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > div:has(> [data-slot="sidebar.workspaces"]) {\n  grid-row:4;\n  min-height:0;\n}\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > div:has([data-slot="sidebar.settings"]) {\n  grid-column:1;\n  grid-row:5;\n  min-width:0;\n  align-self:center;\n}\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > nav {\n  grid-column:2;\n  grid-row:5;\n  display:flex;\n  flex-direction:row;\n  align-items:center;\n  align-self:center;\n  justify-self:end;\n  gap:0;\n  margin:0;\n  padding:0;\n}\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > nav > span:has(> button) { flex:none; width:36px; }\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > nav button {\n  flex:none;\n  justify-content:center;\n  gap:0;\n  width:36px;\n  min-width:36px;\n  height:36px;\n  margin:0;\n  padding:0;\n}\n[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > nav button > span:not([aria-hidden="true"]) { display:none; }\n';

// src/native/compact-header.css
var compact_header_default = `/* One window-control row followed by search, Projects and New Session. */
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) {
  grid-template-rows:auto 0 0 minmax(0,1fr) auto;
}
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:not(:has([data-slot="sidebar.brand.name"])) {
  grid-row:1;
  height:40px;
  min-height:40px;
}
/* Match the native macOS AppFrame shell.leading seat (88px, 11px).
   Fullscreen has no traffic lights and uses the host's 12px leading inset. */
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:not(:has([data-slot="sidebar.brand.name"])) {
  justify-content:flex-start;
  align-items:flex-start;
  padding:11px 12px 1px 88px;
}
html[data-platform="darwin"][data-fullscreen] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:not(:has([data-slot="sidebar.brand.name"])) {
  padding-left:12px;
}
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag] > [data-sidebar-toggle] {
  transform:none;
  -webkit-app-region:no-drag;
}
/* Both the fully hidden macOS sidebar and the native icon rail omit New Session. */
html:has([data-slot="sidebar"] .dsi-dsh) [data-shell-leading] [data-sidebar-opener] ~ button,
[data-sidebar-collapsed] [data-slot="sidebar"] > div:has(.dsi-dsh) > button,
[data-slot="sidebar"] > div:has(.dsi-rail) > button {
  display:none;
}
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) {
  display:none;
}
/* Reuse the native brand identity in the existing caption row.
   Offset its drag rectangle with margin, not transparent padding: Electron
   still treats pointer-events:none elements as native window-drag regions. */
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) {
  display:flex;
  grid-row:1;
  grid-column:1 / -1;
  height:40px;
  margin:-6px 0 0 116px;
  padding:11px 0 1px;
  pointer-events:none;
}
html[data-platform="darwin"][data-fullscreen] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) {
  margin-left:40px;
}
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) > span > span {
  max-width:100%;
  gap:4px;
}
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) svg {
  width:18px;
  height:18px;
}
html[data-platform="darwin"] [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > [data-window-drag]:has([data-slot="sidebar.brand.name"]) [data-slot="sidebar.brand.name"] svg {
  width:117px;
  max-width:100%;
  min-width:0;
  height:auto;
}
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button {
  grid-row:4;
  grid-column:1 / -1;
  justify-self:end;
  align-self:start;
  justify-content:center;
  z-index:1;
  width:28px;
  min-width:28px;
  height:28px;
  min-height:28px;
  margin:4px 0 0;
  padding:0;
  border:0;
  border-radius:var(--dsw-radius-sm,6px);
  background:transparent;
  -webkit-app-region:no-drag;
}
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button svg,
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) [data-sidebar-toggle] svg { width:16px; height:16px; }
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) [data-sidebar-toggle] { width:28px; height:28px; }
.dsi-dsh:not(.dsi-rail) .dsi-dsh-toolbar { gap:8px; padding-right:44px; }
.dsi-dsh-toolbar .dsi-dsh-icon-button { width:28px; height:28px; }
.dsi-dsh-toolbar .dsi-dsh-search { min-height:28px; padding:0 6px; margin-left:-6px; border-radius:var(--dsw-radius-sm,6px); }
.dsi-dsh-toolbar .dsi-dsh-search:focus-within { background:var(--dsw-alias-interactive-bg-hover); }
.dsi-dsh-toolbar .dsi-dsh-search:has(input:focus-visible) { outline-width:1px; outline-offset:1px; }
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button > span:first-child { mask-image:none; overflow:visible; }
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button > span:first-child > span { gap:0; }
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button > span:first-child > span > span,
[data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button > span:not(:first-child) { display:none; }
@media (hover:hover) {
  [data-slot="sidebar"] > div:has(.dsi-dsh:not(.dsi-rail)) > button:hover { background:var(--dsw-alias-interactive-bg-hover); }
}
/* The archive browser uses this row for its own navigation and total. */
[data-slot="sidebar"] > div:has(.dsi-dsh[data-sidebar-view="settled"]:not(.dsi-rail)) > button { display:none; }
.dsi-dsh[data-sidebar-view="settled"]:not(.dsi-rail) .dsi-dsh-toolbar { padding-right:8px; }
`;

// src/settled-notice.css
var settled_notice_default = '.dsi-settled-notice {\n  box-sizing: border-box;\n  flex: none;\n  width: calc(100% - var(--dsh-composer-side-clearance, 24px) - var(--dsh-composer-side-clearance, 24px));\n  max-width: var(--dsh-composer-card-max-width, 100%);\n  margin: 0 auto;\n  padding: 0 12px;\n  color: var(--dsw-alias-label-secondary);\n  font: 12px/20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;\n}\n.dsi-settled-notice-row { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; min-height: 28px; }\n.dsi-settled-notice-status { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }\n.dsi-settled-notice-status > svg { flex: none; }\n.dsi-settled-notice time { white-space: nowrap; }\n.dsi-settled-notice button {\n  flex: none;\n  min-height: 28px;\n  min-width: 84px;\n  padding: 3px 4px;\n  border: 0;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-weight: 500;\n  text-align: start;\n  cursor: pointer;\n}\n.dsi-settled-notice button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }\n.dsi-settled-notice button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }\n.dsi-settled-notice button:disabled { cursor: default; opacity: .55; }\n.dsi-settled-notice-error { margin: 2px 0 4px 21px; color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }\n';

// src/client.js
function createPlugin(require2) {
  const React2 = require2("react");
  const primitives = require2("@deepseek-ai/dsh-client-ui-primitives");
  const SidebarSettings = createSidebarSettings(React2, primitives, settings_default);
  const InboxSidebar = createNativeSidebar(React2, sidebar_default + footer_icons_default + compact_header_default, primitives);
  const SettledNotice = createSettledNotice(React2, settled_notice_default);
  function SidebarSettingsIcon({ size = 16 }) {
    return React2.createElement(primitives.IconPanelLeftOutlineRegular, { size });
  }
  return {
    inject: ["slots", "sessions", "uiSession", "workspaces", "uiWorkspace", "locale", "layout", "remote"],
    apply(ctx) {
      ctx.effect(() => ctx.locale.register("inboxSidebar", { en, zh }), "inbox-sidebar: locale");
      const preferences = createSidebarPreferences();
      ctx.effect(() => preferences.start(), "inbox-sidebar: local preferences");
      installAvatarLauncher(ctx, React2);
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "dsh-session-sidebar",
        order: 25,
        label: () => ctx.locale.bind("inboxSidebar")("settingsTitle"),
        locale: "inboxSidebar",
        inject: () => ({
          hooks: { sidebarPreferences: preferences },
          setPreference: preferences.set,
          resetPreferences: preferences.reset
        })
      }, SidebarSettings));
      ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
        name: "settings.section.icon",
        id: "dsh-session-sidebar"
      }, SidebarSettingsIcon));
      const controller = createInboxController(ctx);
      ctx.effect(() => controller.start(), "inbox-sidebar: data and clock");
      const projectCatalog = createProjectCatalog(ctx);
      ctx.effect(() => projectCatalog.start(), "inbox-sidebar: shared project catalog");
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "inbox-settled-notice",
        order: 100,
        locale: "inboxSidebar",
        inject: () => ({ actions: controller.actions, hooks: { inbox: controller, sidebarPreferences: preferences } })
      }, SettledNotice));
      ctx.slots.inject("sidebar.workspaces", () => ctx.effect(() => {
        let original;
        let disposeEntry;
        let installing = false;
        function install() {
          if (installing) return;
          const next = ctx.slots.entries("sidebar.workspaces").find((entry) => entry.children?.["sidebar.workspaces.directoryFlow"]);
          if (next === original) return;
          installing = true;
          try {
            disposeEntry?.();
            disposeEntry = void 0;
            original = next;
            if (!original) return;
            const native = original.inject();
            controller.setNative(native);
            disposeEntry = ctx.slots.register({
              name: "sidebar.workspaces",
              priority: -100,
              locale: "inboxSidebar",
              inject: () => ({
                actions: controller.actions,
                hooks: { inbox: controller, projectCatalog, sidebarPreferences: preferences, nativeShortcuts: native.hooks.workspaceShortcuts }
              })
            }, InboxSidebar);
          } finally {
            installing = false;
          }
        }
        const unsubscribe = ctx.slots.subscribe("sidebar.workspaces", install);
        install();
        return () => {
          unsubscribe();
          disposeEntry?.();
        };
      }, "inbox-sidebar: replace session browser"));
    }
  };
}
return module.exports.createPlugin(require); } });
