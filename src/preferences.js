export const PREFERENCES_KEY = 'dsh.inbox-sidebar.v1.preferences';
export const DEFAULT_PREFERENCES = Object.freeze({
  density: 'comfortable',
  sessionTooltips: true,
  settledNotice: true,
  settledExpanded: false,
  snoozedExpanded: false,
  listMotion: true,
});
function valid(key, value) {
  return key === 'density' ? ['comfortable', 'compact'].includes(value)
    : Object.hasOwn(DEFAULT_PREFERENCES, key) && typeof value === 'boolean';
}
function parse(raw) {
  if (raw === null) return { ...DEFAULT_PREFERENCES };
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid sidebar preferences');
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) =>
    [key, valid(key, saved[key]) ? saved[key] : fallback]));
}
export function createSidebarPreferences(environment = window) {
  const listeners = new Set();
  let snapshot = { value: DEFAULT_PREFERENCES, error: null };
  const publish = (value, error = null) => {
    snapshot = { value: Object.freeze(value), error };
    for (const listener of listeners) listener();
  };
  function reload() {
    try { publish(parse(environment.localStorage.getItem(PREFERENCES_KEY))); }
    catch (error) { publish(snapshot.value, String(error.message ?? error)); }
  }
  function save(value) {
    try { environment.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value)); publish(value); return true; }
    catch (error) { publish(snapshot.value, String(error.message ?? error)); return false; }
  }
  const storage = event => { if (event.key === PREFERENCES_KEY || event.key === null) reload(); };
  reload();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() { environment.addEventListener('storage', storage); return () => environment.removeEventListener('storage', storage); },
    set(key, value) {
      if (!valid(key, value)) return false;
      // Merge the latest disk value so concurrent windows do not erase each other's options.
      try { return save({ ...parse(environment.localStorage.getItem(PREFERENCES_KEY)), [key]: value }); }
      catch (error) { publish(snapshot.value, String(error.message ?? error)); return false; }
    },
    reset: () => save({ ...DEFAULT_PREFERENCES }),
  };
}
