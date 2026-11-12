// DSH 0.2.2-rc.1's existing transcript preference and width resolver. Settings
// write the same key; native ResizeObserver continues to own later layout changes.
const dspWidthKey = 'dsh.conversation.contentWidth';
const dspWidthLocales = {
  zh: { title: '页面宽度', hint: '调整对话正文宽度，较窄的窗口会自动适配。', auto: '自动', custom: '自定义', pixels: '宽度（像素）', invalid: '请输入不小于 640 的有效宽度。', failed: '无法保存页面宽度，请重试。' },
  en: { title: 'Page width', hint: 'Set the conversation width. Narrower windows adapt automatically.', auto: 'Automatic', custom: 'Custom', pixels: 'Width in pixels', invalid: 'Enter a valid width of at least 640 pixels.', failed: 'Could not save page width. Try again.' },
};

export function resolveConversationWidth(column, preference) {
  if (preference === null) return Math.max(680, Math.min(column * .64, 920));
  return Math.min(Math.max(preference, 640), Math.max(640, column - 176));
}

export function createConversationWidthPreference(doc, win) {
  const listeners = new Set();
  let started = false, writeError = false;
  const read = () => {
    try {
      const raw = win.localStorage.getItem(dspWidthKey), value = raw === null ? null : Number(raw);
      return { value: Number.isFinite(value) && value > 0 ? value : null, error: false };
    } catch { return { value: null, error: true }; }
  };
  let snapshot = read();
  const publish = next => {
    if (snapshot.value === next.value && snapshot.error === next.error) return;
    snapshot = next; for (const listener of listeners) listener();
  };
  const apply = value => {
    for (const body of doc.querySelectorAll('[data-conversation-content]:not(.kiGsTW_embeddedBody)')) {
      const target = body.parentElement ?? body;
      if (value === null) target.style.removeProperty('--dsh-chat-user-width');
      else target.style.setProperty('--dsh-chat-user-width', resolveConversationWidth(body.offsetWidth, value) + 'px');
    }
  };
  const refresh = event => {
    if (event?.type === 'storage') {
      if (event.key !== null && event.key !== dspWidthKey) return;
      try { if (event.storageArea && event.storageArea !== win.localStorage) return; } catch { return; }
    }
    const next = read();
    if (next.error) { publish({ ...snapshot, error: true }); return; }
    if (next.value !== snapshot.value) { apply(next.value); writeError = false; }
    publish({ ...next, error: writeError });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh: () => refresh(),
    currentWidth: () => {
      const body = doc.querySelector('[data-conversation-content]:not(.kiGsTW_embeddedBody)');
      return resolveConversationWidth(body?.offsetWidth || 1440, snapshot.value);
    },
    set(value) {
      if (value !== null && (!Number.isFinite(value) || value < 640)) return false;
      try {
        if (value === null) win.localStorage.removeItem(dspWidthKey);
        else win.localStorage.setItem(dspWidthKey, String(value));
      } catch { writeError = true; publish({ ...snapshot, error: true }); return false; }
      writeError = false;
      apply(value); publish({ value, error: false }); return true;
    },
    start() {
      if (started) return () => {};
      started = true;
      win.addEventListener('storage', refresh); win.addEventListener('focus', refresh);
      return () => {
        started = false;
        win.removeEventListener('storage', refresh); win.removeEventListener('focus', refresh);
        listeners.clear();
        // A saved width is a native user preference, not a temporary override.
      };
    },
  };
}

export function installConversationWidthSettings(ctx, React, P, doc = document, win = window) {
  if (typeof ctx.inject !== 'function' || !React.useSyncExternalStore) return;
  ctx.inject(['slots', 'locale'], scope => {
    const h = React.createElement, preference = createConversationWidthPreference(doc, win);
    scope.effect(() => preference.start(), 'polish: native conversation width preference');
    scope.effect(() => scope.locale.register('polishWidth', dspWidthLocales), 'polish: page width locale');
    function WidthRow({ t }) {
      const state = React.useSyncExternalStore(preference.subscribe, preference.getSnapshot);
      const [draft, setDraft] = React.useState(String(state.value ?? Math.round(preference.currentWidth())));
      const [invalid, setInvalid] = React.useState(false);
      const id = React.useId();
      React.useEffect(() => { setDraft(String(state.value ?? Math.round(preference.currentWidth()))); setInvalid(false); }, [state.value]);
      React.useEffect(() => { preference.refresh(); }, []);
      const commit = () => {
        const next = Number(draft);
        if (!draft.trim() || !Number.isFinite(next) || next < 640) { setInvalid(true); return; }
        setInvalid(false);
        if (preference.set(next)) setDraft(String(next));
      };
      const error = invalid ? t('invalid') : state.error ? t('failed') : null;
      return h('div', { className: 'dsp-width-setting', 'data-dsp-width-setting': '' },
        h('div', { className: 'dsp-width-copy' },
          h('label', { htmlFor: id, className: 'dsp-width-title' }, t('title')),
          h('p', { id: id + '-hint', className: 'dsp-width-hint' }, t('hint'))),
        h('div', { className: 'dsp-width-controls' },
          h('select', { id, 'aria-label': t('title'), 'aria-invalid': state.error, 'aria-describedby': error ? id + '-hint ' + id + '-error' : id + '-hint', value: state.value === null ? 'auto' : 'custom', onChange: event => {
            setInvalid(false);
            preference.set(event.target.value === 'auto' ? null : Math.round(preference.currentWidth()));
          } }, h('option', { value: 'auto' }, t('auto')), h('option', { value: 'custom' }, t('custom'))),
          state.value !== null && h('div', { className: 'dsp-width-number' },
            h(P.Input, { type: 'number', min: 640, step: 'any', value: draft, 'aria-label': t('pixels'), 'aria-invalid': !!error, 'aria-describedby': error ? id + '-error' : id + '-hint',
              onChange: event => { setDraft(event.target.value); setInvalid(false); }, onBlur: commit,
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); commit(); }
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(String(state.value)); setInvalid(false); }
              } }), h('span', { 'aria-hidden': true }, 'px'))),
        error && h('p', { id: id + '-error', className: 'dsp-width-error', role: 'alert' }, error));
    }
    scope.slots.inject('settings.general.item', () => scope.slots.register({ name: 'settings.general.item', id: 'polish.page-width', order: 14, locale: 'polishWidth' }, WidthRow));
  });
}
