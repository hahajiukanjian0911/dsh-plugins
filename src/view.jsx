import { DragProvider, DragMarker, SortableRow, SortableShelfToggle, buildDragItems,
  optimisticRows, useSidebarDrag } from './sidebar-drag.jsx';

const paths = {
  search: ['M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm15 15 6 6'],
  filter: ['M4 6h16M7 12h10M10 18h4'],
  folder: ['M3 7V5h6l3 3h9v12H3V7Z'],
  addFolder: ['M3 7V5h6l3 3h9v12H3V7Z', 'M12 11v6m-3-3h6'],
  compose: ['M13 5H4v15h15v-9', 'm10 11 9-9 3 3-9 9-4 1 1-4Z'],
  pin: ['m8 3 8 0-1 6 4 5H5l4-5-1-6Z', 'M12 14v8'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
  check: ['m5 12 4 4L20 5'],
  restore: ['M4 8a9 9 0 1 1-1 9', 'M4 2v6h6'],
  chevron: ['m9 5 7 7-7 7'],
  close: ['m6 6 12 12M6 18 18 6'],
  inbox: ['M3 5h18v15H3V5Z', 'M3 13h5l2 3h4l2-3h5'],
  alert: ['M12 3 2 21h20L12 3Z', 'M12 9v5m0 3v1'],
  spinner: ['M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9'],
};

export function snoozePresets(now) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [['hourLater', now + 3_600_000], ['tomorrow', +tomorrow], ['monday', +monday]];
}

function projectIdentity(name) {
  const words = name.replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
  const initials = words.length > 1 ? words.slice(0, 2).map((word) => Array.from(word)[0]).join('')
    : Array.from(words[0] ?? name).slice(0, /\p{Script=Han}/u.test(name) ? 2 : 1).join('');
  let hash = 0;
  for (const character of name.normalize('NFC').toLowerCase()) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)) | 0;
  }
  return { initials: initials.toUpperCase(), hue: [265, 165, 25, 215, 85][(hash >>> 0) % 5] };
}

export function createInboxView(React, stylesheet) {
  const { useEffect, useId, useLayoutEffect, useRef, useState } = React;

  function useGlassHeader(wide, rootRef, headerRef, outerRef, activeRef, shelvesRef) {
    useLayoutEffect(() => {
      if (!wide) return;
      const shell = rootRef.current.closest('[data-slot="sidebar"]')?.querySelector(':scope > div');
      if (!shell?.matches(':has(> [data-window-drag] + [data-window-drag])')) return;
      const properties = ['--dsi-glass-height', '--dsi-glass-inset'];
      const previous = properties.map(name => shell.style.getPropertyValue(name));
      const materialProperties = ['--dsi-material-shelf-start', '--dsi-material-shelf-height', '--dsi-material-join-distance'];
      const previousMaterial = materialProperties.map(name => shell.style.getPropertyValue(name));
      const previousShelf = shell.getAttribute('data-dsi-glass-shelf');
      const scroll = outerRef.current;
      const previousReserve = scroll.style.getPropertyValue('--dsi-scroll-reserve');
      let lastInset;
      const measureMaterial = () => {
        const shelf = rootRef.current.querySelector('.dsi-shelf-settled');
        const heading = shelf?.querySelector('.dsi-shelf-toggle');
        if (!heading) { shell.removeAttribute('data-dsi-glass-shelf'); return; }
        const headerHeight = parseFloat(shell.style.getPropertyValue('--dsi-glass-height'));
        const start = Math.max(headerHeight,
          shelf.getBoundingClientRect().top - shell.getBoundingClientRect().top + outerRef.current.scrollTop);
        shell.style.setProperty(materialProperties[0], start + 'px');
        shell.style.setProperty(materialProperties[1], heading.getBoundingClientRect().height + 'px');
        shell.style.setProperty(materialProperties[2], Math.max(.001, start - headerHeight) + 'px');
        shell.setAttribute('data-dsi-glass-shelf', '');
      };
      const measure = () => {
        const bottom = headerRef.current.getBoundingClientRect().bottom;
        const height = bottom - shell.getBoundingClientRect().top;
        const inset = bottom - outerRef.current.getBoundingClientRect().top;
        if (inset === lastInset) { measureMaterial(); return; }
        const offset = scroll.scrollTop;
        const compensate = lastInset !== undefined && offset > 0;
        const anchorStyle = scroll.style.getPropertyValue('overflow-anchor');
        const oldGlassBottom = outerRef.current.getBoundingClientRect().top + (lastInset ?? inset);
        const anchor = [...scroll.querySelectorAll('.dsi-card')]
          .find(node => node.getBoundingClientRect().bottom > oldGlassBottom);
        const anchorTop = anchor?.getBoundingClientRect().top;
        if (compensate) scroll.style.setProperty('overflow-anchor', 'none');
        shell.style.setProperty(properties[0], height + 'px');
        shell.style.setProperty(properties[1], inset + 'px');
        if (compensate) {
          const delta = anchor ? anchor.getBoundingClientRect().top - anchorTop + scroll.scrollTop - offset
            : inset - lastInset;
          const targetOffset = offset + delta;
          const reserve = parseFloat(scroll.style.getPropertyValue('--dsi-scroll-reserve')) || 0;
          const naturalMax = scroll.scrollHeight - scroll.clientHeight - reserve;
          // Keep the visible row anchored while the shared scroll viewport's
          // header inset changes, including any browser range clamping.
          scroll.style.setProperty('--dsi-scroll-reserve', Math.ceil(Math.max(0, targetOffset - naturalMax)) + 'px');
          scroll.scrollTop = targetOffset;
          scroll.getBoundingClientRect();
          if (anchorStyle) scroll.style.setProperty('overflow-anchor', anchorStyle);
          else scroll.style.removeProperty('overflow-anchor');
        }
        lastInset = inset;
        measureMaterial();
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(headerRef.current);
      observer.observe(shell);
      observer.observe(activeRef.current);
      observer.observe(shelvesRef.current);
      return () => {
        observer.disconnect();
        if (previousReserve) scroll.style.setProperty('--dsi-scroll-reserve', previousReserve);
        else scroll.style.removeProperty('--dsi-scroll-reserve');
        properties.forEach((name, index) => previous[index]
          ? shell.style.setProperty(name, previous[index]) : shell.style.removeProperty(name));
        materialProperties.forEach((name, index) => previousMaterial[index]
          ? shell.style.setProperty(name, previousMaterial[index]) : shell.style.removeProperty(name));
        if (previousShelf === null) shell.removeAttribute('data-dsi-glass-shelf');
        else shell.setAttribute('data-dsi-glass-shelf', previousShelf);
      };
    }, [wide]);
  }

  function Icon({ name, size = 16, spinning = false }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={spinning ? 'dsi-spinner' : undefined}>
      {(paths[name] ?? paths.inbox).map((path, index) => <path d={path} key={index} />)}
    </svg>;
  }

  function IconButton({ name, label, onClick, disabled, children, ...props }) {
    return <button type="button" className="dsi-icon-button" aria-label={label} title={label}
      disabled={disabled} onClick={onClick} {...props}>
      <Icon name={name} />{children}
    </button>;
  }

  function relativeTime(at, t) {
    const minutes = Math.max(0, Math.floor((Date.now() - at) / 60_000));
    if (minutes < 1) return t('now');
    if (minutes < 60) return t('minutes', { n: minutes });
    if (minutes < 1440) return t('hours', { n: Math.floor(minutes / 60) });
    return t('days', { n: Math.floor(minutes / 1440) });
  }

  function statusOf(row, t) {
    if (row.section === 'draft') return { text: t('unsent'), tone: 'draft' };
    if (row.attention) return { text: t(row.attention === 'approval' ? 'approval'
      : row.attention === 'plan-review' ? 'plan' : 'answer'), icon: 'alert', tone: 'attention' };
    if (row.record.error) return { text: t('failed'), icon: 'alert', tone: 'error' };
    if (row.running) return { text: t('working'), icon: 'spinner', tone: 'working' };
    if (row.section === 'snoozed') return {
      text: new Date(row.record.snoozedUntil).toLocaleString([], { month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit' }), icon: 'clock', tone: 'quiet',
    };
    if (row.unread) return { text: t('completed'), icon: 'inbox', tone: 'unread' };
    return { text: relativeTime(row.activityAt, t), tone: 'quiet' };
  }

  function useInlineRename(actions, t) {
    const [state, setState] = useState(null);
    const current = useRef(null);
    const focusId = useRef(null);
    const focusAfterSave = useRef(false);
    const update = value => { current.current = value; setState(value); };
    const close = (id, focus) => { focusId.current = focus ? id : null; update(null); };
    useEffect(() => () => { current.current = null; }, []);
    return {
      state, focusId,
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
        if (edit.saving) { if (!focus) focusAfterSave.current = false; return; }
        const trimmed = edit.value.trim();
        if (!trimmed) { update({ ...edit, error: t('renameEmpty') }); return; }
        if (trimmed === edit.original) { close(id, focus); return; }
        const request = { ...edit, saving: true, error: null };
        focusAfterSave.current = focus;
        update(request);
        try {
          await actions.rename(id, trimmed);
          if (current.current === request) close(id, focusAfterSave.current);
        } catch (error) {
          if (current.current === request) update({ ...request, saving: false,
            error: t('renameFailed', { message: String(error.message ?? error) }) });
        }
      },
    };
  }

  function useStableRows(rows, interactionId) {
    const shown = useRef(rows);
    const lock = useRef(null);
    if (!interactionId) lock.current = null;
    else if (lock.current?.id !== interactionId) lock.current = { id: interactionId, rows: shown.current };
    if (!lock.current) { shown.current = rows; return rows; }
    const latest = new Map(rows.map(row => [row.id, row]));
    const stable = lock.current.rows.filter(row => latest.has(row.id)).map(row => ({
      ...latest.get(row.id), section: row.section, pinned: row.pinned, pinRank: row.pinRank,
    }));
    const known = new Set(stable.map(row => row.id));
    shown.current = [...stable, ...rows.filter(row => !known.has(row.id))];
    return shown.current;
  }

  function SessionCard({ row, actions, order, onSnooze, t, busy, selected, snippet, rename, drag, as: Row = 'li' }) {
    const edit = rename.state?.id === row.id ? rename.state : null;
    const editing = Boolean(edit);
    const name = edit?.value ?? '';
    const renameError = edit?.error;
    const saving = edit?.saving;
    const editor = useRef(null);
    const errorId = useId();
    useLayoutEffect(() => {
      if (editing) {
        editor.current?.focus({ preventScroll: true });
        editor.current?.select();
      }
    }, [editing]);
    const status = statusOf(row, t);
    const draft = row.section === 'draft';
    const history = row.section === 'settled';
    const parked = row.section === 'settled' || row.section === 'snoozed';
    const project = row.workspace?.title || row.session.cwd?.split(/[\\/]/).filter(Boolean).at(-1)
      || t('ungrouped');
    const identity = projectIdentity(project);
    const title = draft ? row.session.title?.trim() || t('newSession') : row.session.displayTitle;
    const beginRename = () => rename.begin(row, title);
    const Main = editing ? 'div' : 'button';
    const statusLabel = drag?.id === row.id && drag.verb ? <span className="dsi-drag-verb" role="status">{t('drag_' + drag.verb)}</span> : <span className={'dsi-status dsi-status-' + status.tone}>
      {status.icon && <Icon name={status.icon} size={14} spinning={row.running && !row.attention} />}
      <span>{status.text}</span>
    </span>;
    const quiet = !selected && !row.unread && !row.attention && !row.record.error;
    return <Row className={'dsi-card' + (selected ? ' dsi-selected' : '') + (quiet ? ' dsi-quiet' : '')
      + (history ? ' dsi-history' : '') + (draft ? ' dsi-draft' : '')
      + (editing ? ' dsi-renaming' : '')}
      data-session-id={row.id} data-section={row.section} draggable={false}>
      <Main type={editing ? undefined : 'button'} className="dsi-card-main" aria-current={selected ? 'page' : undefined}
        aria-label={project + ', ' + title + ', ' + status.text}
        title={[project + ' · ' + title,
          new Date(row.activityAt).toLocaleString()].filter(Boolean).join('\n')}
        onClick={editing ? undefined : () => void actions.open(row.id)}
        onDoubleClick={editing ? undefined : beginRename}
        onKeyDown={editing ? undefined : event => {
          if (event.key === 'F2') { event.preventDefault(); beginRename(); }
          if (event.altKey && !parked && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
            const index = order.indexOf(row.id) + (event.key === 'ArrowUp' ? -1 : 1);
            const anchor = drag.rows.find(item => item.id === order[index]);
            if (anchor && anchor.pinned === row.pinned) {
              event.preventDefault();
              void actions.move(row.id, { section: row.pinned ? 'pinned' : 'inbox',
                [event.key === 'ArrowUp' ? 'beforeId' : 'afterId']: anchor.id });
            }
          }
        }}>
        {history ? <span className="dsi-history-project" title={project} aria-hidden="true">
          <span className="dsi-project-mark" style={{ '--dsi-project-hue': identity.hue }}>{identity.initials}</span>
        </span> : <span className="dsi-meta">
          <span className="dsi-project">
            {draft && <span className="dsi-draft-mark"><Icon name="compose" size={13} /></span>}
            <span className="dsi-project-mark" aria-hidden="true"
              style={{ '--dsi-project-hue': identity.hue }}>{identity.initials}</span>
            {row.pinned && !draft && <span title={t('pinned')}><Icon name="pin" size={12} /></span>}
            <span title={row.workspace?.path || row.session.cwd}>{project}</span>
          </span>
          {statusLabel}
        </span>}
        {editing ? <input ref={editor} className="dsi-title-input" aria-label={t('rename')}
          value={name} readOnly={saving} aria-busy={saving} aria-invalid={Boolean(renameError)}
          aria-describedby={renameError ? errorId : undefined} autoComplete="off" spellCheck={false}
          onChange={event => rename.change(row.id, event.target.value)}
          onBlur={() => void rename.commit(row.id, false)}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter') { event.preventDefault(); void rename.commit(row.id, true); }
            if (event.key === 'Escape') { event.preventDefault(); rename.cancel(row.id); }
          }} /> : <span className={'dsi-title' + (row.unread || row.attention ? ' dsi-unread-title' : '')}>{title}</span>}
        {history && statusLabel}
        {snippet && <span className="dsi-snippet">{snippet}</span>}
      </Main>
      {renameError && <div id={errorId} role="alert" className="dsi-rename-error">{renameError}</div>}
      {!draft && !editing && <span className="dsi-row-actions">
        {parked ? <IconButton name="restore" label={t('restore')} disabled={busy}
          onClick={() => actions.restore(row.id)} /> : <>
          <IconButton name="pin" label={t(row.pinned ? 'unpin' : 'pin')} disabled={busy}
            onClick={() => actions.pin(row.id)} />
          <IconButton name="clock" label={t('snooze')} disabled={busy || Boolean(row.attention)}
            onClick={(event) => onSnooze(row, event.currentTarget)} />
          <IconButton name="check" label={t('settle')} disabled={busy || row.running || Boolean(row.attention)}
            onClick={() => actions.settle(row.id, order)} />
        </>}
      </span>}
    </Row>;
  }

  function SnoozeMenu({ target, onClose, onChoose, t }) {
    const menu = useRef(null);
    const [custom, setCustom] = useState('');
    useLayoutEffect(() => {
      const element = menu.current;
      const anchor = target.anchor.getBoundingClientRect();
      const close = (event) => { if (event.newState === 'closed') onClose(); };
      element.addEventListener('toggle', close);
      element.showPopover();
      const height = element.getBoundingClientRect().height;
      element.style.left = Math.max(8, Math.min(anchor.right - 240, window.innerWidth - 248)) + 'px';
      element.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - height - 8)) + 'px';
      element.querySelector('button')?.focus({ preventScroll: true });
      return () => {
        element.removeEventListener('toggle', close);
        if (target.anchor.isConnected) target.anchor.focus({ preventScroll: true });
      };
    }, []);
    const customTimestamp = new Date(custom).getTime();
    return <div ref={menu} popover="auto" className="dsi-snooze-menu" role="dialog"
      aria-label={t('snooze')}>
      <div className="dsi-menu-heading">{t('snooze')}
        <IconButton name="close" label={t('close')} onClick={onClose} />
      </div>
      {snoozePresets(Date.now()).map(([key, until]) =>
        <button type="button" className="dsi-menu-item" key={key} onClick={() => onChoose(until)}>
          {t(key)}<span>{new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </button>)}
      <label className="dsi-custom-label">{t('customTime')}
        <input type="datetime-local" value={custom} onChange={(event) => setCustom(event.target.value)} />
      </label>
      <button type="button" className="dsi-confirm" disabled={!(customTimestamp > Date.now())}
        onClick={() => onChoose(customTimestamp)}>{t('confirmSnooze')}</button>
    </div>;
  }

  function useShelfView(autoExpandKey) {
    const [expanded, setExpanded] = useState(false);
    const [collapsedAutoKey, setCollapsedAutoKey] = useState(null);
    const [limit, setLimit] = useState(40);
    useEffect(() => { setCollapsedAutoKey(null); }, [autoExpandKey]);
    const open = expanded || Boolean(autoExpandKey && autoExpandKey !== collapsedAutoKey);
    return { open, limit, toggle() { setExpanded(!open); setCollapsedAutoKey(open ? autoExpandKey : null); },
      more() { setLimit(value => value + 40); } };
  }

  function Shelf({ section, rows, renderRow, view, t, drag }) {
    if (rows.length === 0 && !(section === 'settled' && drag.id)) return null;
    const { open, limit } = view;
    return <section className={'dsi-shelf dsi-shelf-' + section} data-expanded={open} aria-label={t(section)}>
      <SortableShelfToggle section={section} className="dsi-shelf-toggle" aria-expanded={open}
        active={drag.targetSection === section} aria-label={t(open ? 'hide' : 'show', { section: t(section) })}
        onClick={view.toggle}>
        <Icon name="chevron" size={13} /><span>{t(section)}</span><span>{rows.length}</span>
      </SortableShelfToggle>
      <ul className={'dsi-list dsi-sortable-list' + (section === 'settled' ? ' dsi-history-list' : '')}>
        {section === 'settled' && <DragMarker marker="settled-placeholder">
          {drag.dragging && !open && <div className="dsi-drag-placeholder">{t('settled')}</div>}
        </DragMarker>}
        {open && rows.slice(0, limit).map(renderRow)}
      </ul>
      {open && rows.length > limit && <button className="dsi-load-more" type="button"
        onClick={view.more}>{t('more', { n: Math.min(40, rows.length - limit) })}</button>}
    </section>;
  }

  return function InboxSidebar({ wide, expandSidebar, useInbox, useNativeShortcuts, useRemoteAccess, actions, t }) {
    const rename = useInlineRename(actions, t);
    const data = useInbox((state) => state);
    const shortcuts = useNativeShortcuts((state) => state);
    const canCreate = useRemoteAccess('session/create');
    const canAdd = useRemoteAccess('workspace/create');
    const [query, setQuery] = useState('');
    const [project, setProject] = useState('');
    const [snoozeTarget, setSnoozeTarget] = useState(null);
    const [limit, setLimit] = useState(60);
    const [focusOnExpand, setFocusOnExpand] = useState(false);
    const [remoteSearch, setRemoteSearch] = useState({ query: '', items: [], pending: false, error: null, hasMore: false });
    const [dragState, setDragState] = useState(null);
    const [optimistic, setOptimistic] = useState(null);
    const searchInput = useRef(null);
    const sidebarRoot = useRef(null);
    useLayoutEffect(() => {
      if (rename.state || !rename.focusId.current) return;
      const id = rename.focusId.current;
      rename.focusId.current = null;
      [...sidebarRoot.current.querySelectorAll('[data-session-id]')]
        .find(node => node.dataset.sessionId === id)?.querySelector('.dsi-card-main')?.focus({ preventScroll: true });
    }, [rename.state]);
    const headerTools = useRef(null);
    const activeContent = useRef(null);
    const shelves = useRef(null);
    const contentScroll = useRef(null);
    useGlassHeader(wide, sidebarRoot, headerTools, contentScroll, activeContent, shelves);
    const rows = optimisticRows(useStableRows(data.rows, rename.state?.id || dragState?.activeKey), optimistic);
    useEffect(() => {
      if (!data.undo) return;
      const onKey = event => {
        if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'z'
          || event.target.closest('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault(); void actions.undo();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [data.undo]);
    const searchRequested = useRef(0);
    useEffect(() => {
      if (shortcuts.searchRequest === searchRequested.current) return;
      searchRequested.current = shortcuts.searchRequest;
      if (shortcuts.searchRequest > 0) {
        expandSidebar();
        setFocusOnExpand(true);
      }
    }, [shortcuts.searchRequest, wide]);
    useEffect(() => {
      if (wide && focusOnExpand) {
        searchInput.current?.focus({ preventScroll: true });
        setFocusOnExpand(false);
      }
    }, [wide, focusOnExpand]);
    useEffect(() => { if (shortcuts.addRequested) void actions.addWorkspace(); }, [shortcuts.addRequested]);
    const searchQuery = query.trim();
    const needle = searchQuery.toLocaleLowerCase();
    useEffect(() => {
      if (!searchQuery) return;
      const abort = new AbortController();
      setRemoteSearch({ query: searchQuery, items: [], pending: true, error: null, hasMore: false });
      const timer = setTimeout(() => {
        actions.search(searchQuery, abort.signal).then((result) => {
          if (!abort.signal.aborted) setRemoteSearch({ ...result, query: searchQuery, pending: false, error: null });
        }, (error) => {
          if (!abort.signal.aborted) setRemoteSearch({ query: searchQuery, items: [], pending: false,
            error: String(error.message ?? error), hasMore: false });
        });
      }, 250);
      return () => { clearTimeout(timer); abort.abort(); };
    }, [searchQuery]);
    const currentSearch = remoteSearch.query === searchQuery ? remoteSearch : { items: [], pending: Boolean(searchQuery) };
    const contentMatches = new Map(currentSearch.items.map((item) => [item.sessionId, item.snippet]));
    const drafts = rows.filter((row) => row.section === 'draft');
    const visible = rows.filter((row) => row.section !== 'draft' && (!project || row.workspace?.workspaceId === project)
      && (!needle || contentMatches.has(row.id)
        || [row.id, row.session.displayTitle, row.session.cwd, row.workspace?.title]
          .some((text) => text?.toLocaleLowerCase().includes(needle))));
    // Running is a card status, not a separate collapsible destination.
    const primary = visible.filter((row) => row.section === 'pinned' || row.section === 'inbox'
      || row.section === 'working');
    const order = primary.map((row) => row.id);
    const shelfExpansionContext = (section) => {
      if (needle) return JSON.stringify(['search', project, needle]);
      const current = visible.find(row => row.current && row.section === section);
      return current ? JSON.stringify(['session', section, current.id]) : null;
    };
    const snoozed = visible.filter(row => row.section === 'snoozed');
    const settled = visible.filter(row => row.section === 'settled');
    const views = { snoozed: useShelfView(shelfExpansionContext('snoozed')),
      settled: useShelfView(shelfExpansionContext('settled')) };
    const drag = useSidebarDrag({ items: buildDragItems(primary.slice(0, limit), snoozed, settled, views),
      rows: data.rows, state: dragState, setState: setDragState, optimistic, setOptimistic,
      actions, blocked: !wide || Boolean(rename.state), root: sidebarRoot, scroll: contentScroll,
      header: headerTools, views });
    const openSnooze = (row, anchor) => setSnoozeTarget({ row, anchor });
    const renderRow = row => row.section === 'draft' ? <SessionCard key={row.id} row={row} actions={actions}
      order={order} onSnooze={openSnooze} busy={data.busy.has(row.id)} selected={row.id === data.currentId}
      snippet={contentMatches.get(row.id)} t={t} rename={rename} drag={drag} />
      : <SortableRow key={row.id} id={row.id} history={row.section === 'settled'}
        disabled={drag.disabled || data.busy.has(row.id) || rename.state?.id === row.id}>
        <SessionCard as="div" row={row} actions={actions} order={order} onSnooze={openSnooze}
          busy={data.busy.has(row.id)} selected={row.id === data.currentId}
          snippet={contentMatches.get(row.id)} t={t} rename={rename} drag={drag} />
      </SortableRow>;
    const focusSearch = () => { expandSidebar(); setFocusOnExpand(true); };
    return <DragProvider drag={drag}><div ref={sidebarRoot} className={'dsi-root' + (wide ? '' : ' dsi-rail')}
      data-sidebar-dragging={drag.dragging || undefined} data-sidebar-drop-section={drag.targetSection || undefined}
      data-sidebar-drop-id={dragState?.overId || undefined}>
      <style>{stylesheet}</style>
      <div className="dsi-rail-tools">
        <IconButton name="search" label={t('search')} onClick={focusSearch} />
      </div>
      <div className="dsi-header-tools" ref={headerTools}>
      <div className="dsi-toolbar">
        <label className="dsi-search"><Icon name="search" />
          <input ref={searchInput} type="search" placeholder={t('search')} aria-label={t('search')}
            value={query} maxLength={500} onChange={(event) => {
              setQuery(event.target.value.replaceAll('\0', '')); setLimit(60);
            }} />
        </label>
        <span className="dsi-filter" title={t('filterProject')}><Icon name="filter" />
          <select aria-label={t('filterProject')} value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">{t('allProjects')}</option>
            {data.workspaces.map((workspace) => <option key={workspace.workspaceId}
              value={workspace.workspaceId}>{workspace.title || workspace.path}</option>)}
          </select>
        </span>
        <IconButton name="addFolder" label={t('addProject')}
          disabled={!canAdd || data.busy.has('workspace')} onClick={actions.addWorkspace} />
        <IconButton name="compose" label={t('newSession')} disabled={!canCreate}
          onClick={() => actions.start(project)} />
      </div>
      {project && <div className="dsi-project-filter">
        <span>{data.workspaces.find((item) => item.workspaceId === project)?.title || project}</span>
        <IconButton name="close" label={t('allProjects')} onClick={() => setProject('')} />
      </div>}
      {data.phase === 'ready' && drafts.length > 0 && <section className="dsi-drafts" aria-label={t('drafts')}>
        <ul className="dsi-list">{drafts.map(renderRow)}</ul>
      </section>}
      {data.persistenceError && <p role="alert" className="dsi-error">
        {t('storageFailed', { message: data.persistenceError })}</p>}
      {data.operationError && <div role="alert" className="dsi-error">
        <span>{t('operationFailed', { message: data.operationError })}</span>
        <IconButton name="close" label={t('close')} onClick={actions.dismissError} />
      </div>}
      {needle && currentSearch.error && <p role="alert" className="dsi-error">
        {t('searchFailed', { message: currentSearch.error })}</p>}
      {data.connectionState === 'loading' && data.phase === 'ready'
        && <p role="status" className="dsi-connection">{t('reconnecting')}</p>}
      </div>
      <div ref={contentScroll} className="dsi-content-scroll">
      <div ref={activeContent} className="dsi-active-content" aria-label={t('inbox')}>
        {needle && currentSearch.pending && <p className="dsi-connection" role="status">{t('searching')}</p>}
        {data.phase === 'pending' && <p className="dsi-empty" role="status">{t('loading')}</p>}
        {data.phase === 'error' && <div className="dsi-empty" role="alert"><p>{t('loadFailed')}</p>
          <button type="button" onClick={actions.retry}>{t('retry')}</button></div>}
        {data.phase === 'ready' && <>
          <ul className="dsi-list dsi-primary dsi-sortable-list">
            <DragMarker marker="pinned-header" label={t('pinned')} visible={drag.dragging} active={drag.targetSection === 'pinned'} />
            {primary.slice(0, limit).filter(row => row.pinned).map(renderRow)}
            <DragMarker marker="pinned-divider" label={t('inbox')} visible={drag.dragging} active={drag.targetSection === 'active'} />
            <DragMarker marker="active-placeholder">
              {drag.dragging && !primary.some(row => !row.pinned) && <div className="dsi-drag-placeholder">{t('inbox')}</div>}
            </DragMarker>
            {primary.slice(0, limit).filter(row => !row.pinned).map(renderRow)}
          </ul>
          {primary.length > limit && <button type="button" className="dsi-load-more"
            onClick={() => setLimit(limit + 60)}>{t('more', { n: Math.min(60, primary.length - limit) })}</button>}
          {primary.length === 0 && (!needle || visible.length === 0 && !currentSearch.pending) && (needle
            ? <div className="dsi-empty">
              <Icon name="search" size={26} /><p>{t('noMatches')}</p>
              <button type="button" onClick={() => setQuery('')}>{t('clearSearch')}</button>
            </div>
            : <div className="dsi-empty-inbox" role="status">
              <Icon name="inbox" size={14} /><span>{t('empty')}</span>
            </div>)}
          {needle && currentSearch.hasMore && <p className="dsi-connection">{t('searchMore')}</p>}
        </>}
      </div>
      <div className="dsi-shelves" ref={shelves}>
      {data.phase === 'ready' && <>
        <Shelf section="snoozed" rows={snoozed}
          renderRow={renderRow} view={views.snoozed} t={t} drag={drag} />
        <Shelf section="settled"
        rows={settled}
        renderRow={renderRow} view={views.settled} t={t} drag={drag} />
      </>}
      </div>
      </div>
      {data.undo && <div className="dsi-undo-notice" role="status">
        <span>{t('undo_' + data.undo.kind)}</span>
        <button type="button" disabled={data.busy.has(data.undo.id) || data.busy.has('undo')}
          title={t('undoShortcut')} onClick={() => void actions.undo()}>{t('undo')}</button>
      </div>}
      {snoozeTarget && <SnoozeMenu target={snoozeTarget} t={t} onClose={() => setSnoozeTarget(null)}
        onChoose={(until) => {
          void actions.snooze(snoozeTarget.row.id, until, order);
          setSnoozeTarget(null);
        }} />}
    </div></DragProvider>;
  };
}
