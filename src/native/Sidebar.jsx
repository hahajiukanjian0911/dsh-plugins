import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_PREFERENCES } from '../preferences.js';
import { useInlineRename, useStableRows } from './hooks.js';
import { mountFooterIconTitles } from './footer-icons.js';
import { projectGroups } from '../project-catalog.js';
import { createProjectIcon } from '../../plugins/dsh-project-manager/src/identity.jsx';

export const NATIVE_CONTROLS = ['AnimatedRows', 'Button', 'HoverCard', 'HoverCardGroup', 'Input', 'Menu', 'Modal', 'StateDot', 'Tooltip', 'useRowDragPreview'];
export const NATIVE_ICONS = ['IconArchiveOutlineRegular', 'IconChevronLeftOutlineRegular', 'IconChevronRightOutlineRegular', 'IconClockOutlineRegular',
  'IconCloseOutlineRegular', 'IconEditOutlineRegular', 'IconEllipsisOutlineRegular', 'IconFolderCloseRegular',
  'IconNewChatOutlineRegular', 'IconPinOutlineRegular', 'IconProjectAddOutlineRegular', 'IconSearchOutlineRegular',
  'IconSlidersTwoOutlineRegular', 'IconUnarchiveOutlineRegular', 'IconWarningOutlineRegular', 'IconPanelLeftOutlineRegular'];

export function relativeTime(at, t) {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  return minutes < 1 ? t('now') : minutes < 60 ? t('minutes', { n: minutes })
    : minutes < 1440 ? t('hours', { n: Math.floor(minutes / 60) }) : t('days', { n: Math.floor(minutes / 1440) });
}

const EMPTY_SEARCH_ITEMS = Object.freeze([]);
const EMPTY_CATALOG = Object.freeze({ ready: false, projects: [], localId: null });

function reminderPresets(now) {
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now); monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7)); monday.setHours(9, 0, 0, 0);
  return [['hourLater', now + 3600000], ['tomorrow', +tomorrow], ['monday', +monday]];
}

export function createNativeSidebar(React, stylesheet, P) {
  const { AnimatedRows, Button, HoverCard, HoverCardGroup, Input, Menu, Modal, StateDot, Tooltip } = P;
  const icon = (name, size = 16, className) => React.createElement(P[name], { size, className });
  const ProjectIcon = createProjectIcon(React, P);

  function IconButton({ label, name, onClick, disabled, active, className = '' }) {
    return <Tooltip label={label} side="bottom" delayMs={500} portal>
      <button type="button" className={'dsi-dsh-icon-button ' + className} aria-label={label}
        aria-pressed={active} disabled={disabled} onClick={onClick}>{icon(name)}</button>
    </Tooltip>;
  }

  function ProjectNewSession({ group, start, canCreate, t }) {
    const [open, setOpen] = useState(false), anchor = useRef(null);
    const checkouts = group.checkouts.filter(c => c.online !== false && !c.missing);
    const label = group.name || t('ungrouped');
    return <Menu open={open} onClose={() => setOpen(false)} portal dense autoFocus align="end" returnFocus={() => anchor.current?.querySelector('button')}
      items={checkouts.map(c => ({ id: c.id, label: c.title || c.path, description: c.path }))}
      onSelect={workspaceId => { setOpen(false); start(workspaceId); }}
      anchor={<span ref={anchor} className="dsi-dsh-project-create-anchor"><IconButton label={t('newSessionInProject', { name: label })} name="IconNewChatOutlineRegular"
        disabled={!canCreate || !checkouts.length} onClick={() => checkouts.length === 1 ? start(checkouts[0].id) : setOpen(!open)} /></span>} />;
  }

  function SessionRow({ row, actions, t, rename, busy, order, preferences, inlineDetails, useSessionAccess, drag, onCustomSnooze, snippet, searchProps, historyView = false, onRestoreStart }) {
    const edit = rename.state?.id === row.id ? rename.state : null;
    const draft = row.section === 'draft', parked = ['settled', 'snoozed'].includes(row.section);
    const rowRef = useRef(null), input = useRef(null), errorId = React.useId();
    const [menu, setMenu] = useState(null);
    const preview = P.useRowDragPreview('dsi-dsh-drag-preview', ['--dsw-alias-label-primary', '--dsw-specific-sidebar-fill']);
    const canRename = useSessionAccess(row.id, 'session/rename');
    const canPin = useSessionAccess(row.id, row.pinned ? 'workspace/unpinSession' : 'workspace/pinSession');
    const canUnpin = useSessionAccess(row.id, 'workspace/unpinSession');
    const canRestore = useSessionAccess(row.id, 'workspace/unarchiveSession');
    const canMove = useSessionAccess(row.id, 'workspace/insertSessionBefore');
    const writablePlacement = !busy && (!row.pinned || canUnpin) && (!row.archived || canRestore);
    const canSettle = writablePlacement && !row.running && !row.attention && !draft;
    const draggable = !draft && !busy && !edit && !drag.disabled && canMove && writablePlacement;
    const project = row.projectName || row.workspace?.title || row.workspace?.path || row.session.cwd || t('ungrouped');
    const detailProject = row.projectName || row.workspace?.title || (row.workspace?.path || row.session.cwd || '').split(/[\\/]/).filter(Boolean).at(-1) || t('ungrouped');
    const title = row.session.displayTitle || row.session.title || t('newSession');
    const begin = () => { if (!busy && canRename) rename.begin(row, title); };
    const restore = () => { const cancel = onRestoreStart?.(row.id); return actions.restore(row.id).catch(error => { cancel?.(); throw error; }); }, settle = () => actions.settle(row.id, order);
    let state = 'idle', label = relativeTime(row.activityAt, t);
    if (draft) label = t('unsent');
    else if (row.attention) { state = 'warning'; label = t(row.attention === 'approval' ? 'approval' : row.attention === 'plan-review' ? 'plan' : 'answer'); }
    else if (row.record.error) { state = 'error'; label = t('failed'); }
    else if (row.running) { state = 'ongoing'; label = t('working'); }
    else if (row.unread && !parked) state = 'done';
    else if (row.section === 'snoozed') label = new Date(row.record.snoozedUntil).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const activityMinutes = Math.max(0, Math.floor((Date.now() - row.activityAt) / 60000));
    const activityLabel = activityMinutes < 1 ? t('settledNow') : activityMinutes < 60 ? t('settledMinutesAgo', { n: activityMinutes })
      : activityMinutes < 1440 ? t('settledHoursAgo', { n: Math.floor(activityMinutes / 60) }) : t('settledDaysAgo', { n: Math.floor(activityMinutes / 1440) });
    const detailLabel = row.section === 'snoozed' ? t('reminderAt', { time: label }) : state === 'done' ? t('completed') : state === 'idle' && !draft ? activityLabel : label;
    useLayoutEffect(() => { if (edit) { input.current?.focus({ preventScroll: true }); input.current?.select(); } }, [!!edit]);
    useEffect(() => { if (drag.active) setMenu(null); }, [!!drag.active]);
    const menuItems = [
      { id: 'open', label: t(row.archived ? 'archivedOpen' : 'openSession'), disabled: busy },
      { id: 'rename', label: t('rename'), icon: icon('IconEditOutlineRegular'), disabled: busy || draft || row.archived || !canRename },
      ...draft ? [] : [
        { type: 'separator', id: 'placement' },
        ...parked ? [{ id: 'restore', label: t('restore'), icon: icon('IconUnarchiveOutlineRegular'), disabled: !writablePlacement }]
          : [
            { id: 'pin', label: t(row.pinned ? 'unpin' : 'pin'), icon: icon('IconPinOutlineRegular'), disabled: busy || !canPin },
            { id: 'snooze', label: t('snooze'), icon: icon('IconClockOutlineRegular'), disabled: !writablePlacement || !!row.attention,
              submenu: [...reminderPresets(Date.now()).map(([key]) => ({ id: key, label: t(key) })), { id: 'customTime', label: t('customTime') }] },
            { id: 'settle', label: t('settle'), icon: icon('IconArchiveOutlineRegular'), disabled: !canSettle },
          ],
      ],
    ];
    const selectMenu = id => {
      setMenu(null);
      if (id === 'open') void actions.open(row.id);
      else if (id === 'rename') begin();
      else if (id === 'restore') void restore();
      else if (id === 'pin') void actions.pin(row.id);
      else if (id === 'settle') void settle();
      else if (id === 'customTime') onCustomSnooze(row, order);
      else { const preset = reminderPresets(Date.now()).find(([key]) => key === id); if (preset) void actions.snooze(row.id, preset[1], order); }
    };
    const keyDown = e => {
      if (edit || e.target !== e.currentTarget) return;
      if (e.key === 'F2') { e.preventDefault(); begin(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void actions.open(row.id); }
      if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') {
        e.preventDefault(); const rect = rowRef.current.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom, contextual: true });
      }
      if (!e.altKey && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        const all = [...rowRef.current.closest('.dsi-dsh-list').querySelectorAll('[data-sidebar-row]')], index = all.indexOf(rowRef.current);
        const next = all[e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.max(0, Math.min(all.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)))];
        if (next) { e.preventDefault(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest' }); }
      }
      if (e.altKey && !parked && canMove && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
        const index = order.indexOf(row.id) + (e.key === 'ArrowUp' ? -1 : 1), anchor = drag.rows.find(r => r.id === order[index]);
        if (anchor && anchor.pinned === row.pinned) { e.preventDefault(); void actions.move(row.id, { section: row.pinned ? 'pinned' : 'inbox', [e.key === 'ArrowUp' ? 'beforeId' : 'afterId']: anchor.id }); }
      }
    };
    const settledAt = !row.record.settledFromArchive && row.record.settledAt || 0;
    const historyMinutes = Math.max(0, Math.floor((Date.now() - (settledAt || row.activityAt)) / 60000));
    const historyRelative = historyMinutes < 1 ? t('settledNow') : historyMinutes < 60 ? t('settledMinutesAgo', { n: historyMinutes }) : historyMinutes < 1440 ? t('settledHoursAgo', { n: Math.floor(historyMinutes / 60) }) : t('settledDaysAgo', { n: Math.floor(historyMinutes / 1440) });
    const historyTime = t(settledAt ? 'settledAgo' : 'lastActiveAgo', { time: historyRelative });
    const marker = drag.over?.id === row.id ? drag.over.half : '';
    const rowNode = <div ref={rowRef} role="treeitem" tabIndex={0} aria-selected={row.current} aria-label={[project, title, historyView ? historyTime : label].join(', ')}
      data-sidebar-row={row.id} data-project-key={row.projectInfo?.key} data-row-key={'session:' + row.id} data-section={row.section} data-state={state}
      data-current={row.current || undefined} data-editing={!!edit || undefined} data-dragging={drag.active === row.id || undefined}
      data-drop={marker || undefined} data-menu-open={!!menu || undefined} className={'dsi-dsh-row' + (parked ? ' dsi-dsh-parked' : '') + (historyView ? ' dsi-dsh-history-row' : '')}
      onClick={edit ? undefined : () => { if (!drag.active && !busy) void actions.open(row.id); }} onDoubleClick={edit ? undefined : begin} onKeyDown={keyDown}
      onContextMenu={draft || edit ? undefined : e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, contextual: true }); }}
      draggable={draggable} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', row.id); drag.start(row.id); preview.start(e); }}
      onDragEnd={() => { preview.clear(); drag.cancel(); }}
      onDragOver={e => { if (historyView || draft || row.section === 'snoozed' || !drag.active || drag.active === row.id) return;
        e.preventDefault(); e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect();
        drag.hover({ id: row.id, section: row.pinned ? 'pinned' : parked ? 'settled' : 'inbox', half: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' }); }}
      onDrop={e => { if (!drag.active || draft || row.section === 'snoozed' || drag.active === row.id) return; e.preventDefault(); e.stopPropagation(); drag.drop(); }} {...searchProps}>
      <div className="dsi-dsh-thread-meta" data-row-metadata="">
        <ProjectIcon project={row.projectInfo || { name: project }} compact />
        {row.pinned && <span className="dsi-dsh-thread-pin" aria-label={t('pinned')}>{icon('IconPinOutlineRegular', 12)}</span>}
        <span className="dsi-dsh-thread-project" dir="auto" title={row.session.cwd || row.workspace?.path || project}>{project}</span>
        <time className="dsi-dsh-time" title={new Date(historyView ? settledAt || row.activityAt : row.activityAt).toLocaleString()}>
          {historyView ? historyTime : draft ? t('unsent') : relativeTime(row.activityAt, t)}</time>
      </div>
      <div className="dsi-dsh-thread-title-line" data-row-title-line="">
        {edit ? <input ref={input} className="dsi-dsh-rename" aria-label={t('rename')} value={edit.value} readOnly={edit.saving}
          aria-busy={edit.saving} aria-invalid={!!edit.error} aria-describedby={edit.error ? errorId : undefined}
          onChange={e => rename.change(row.id, e.target.value)} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
          onBlur={() => void rename.commit(row.id, false)} onKeyDown={e => { e.stopPropagation(); if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') { e.preventDefault(); void rename.commit(row.id, true); } if (e.key === 'Escape') { e.preventDefault(); rename.cancel(row.id); } }} />
          : <span dir="auto" data-row-title="" className="dsi-dsh-title">{title}</span>}
        <span className="dsi-dsh-thread-trailing">
          {!edit && <span className="dsi-dsh-thread-status" data-row-status="" aria-label={detailLabel} title={detailLabel}>
            {state !== 'idle' ? <StateDot state={state} /> : row.section === 'snoozed' ? icon('IconClockOutlineRegular', 16) : null}
            {['warning', 'error'].includes(state) && <span>{label}</span>}
          </span>}
          {!edit && !draft && <span className="dsi-dsh-row-actions" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
            <button type="button" className="dsi-dsh-icon-button" aria-label={t('sessionActions')} aria-haspopup="menu" aria-expanded={!!menu}
              onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setMenu(menu ? null : { x: rect.left, y: rect.bottom }); }}>{icon('IconEllipsisOutlineRegular')}</button>
            <button type="button" className="dsi-dsh-icon-button" aria-label={t(parked ? 'restore' : 'settle')}
              disabled={parked ? !writablePlacement : !canSettle} onClick={() => void (parked ? restore() : settle())}>{icon(parked ? 'IconUnarchiveOutlineRegular' : 'IconArchiveOutlineRegular')}</button>
          </span>}
        </span>
      </div>
    </div>;
    return <div className="dsi-dsh-entry" data-session-id={row.id}>
      <Menu open={!!menu} onClose={() => setMenu(null)} items={menuItems} onSelect={selectMenu} portal dense
        contextual={!!menu?.contextual} autoFocus={!!menu?.contextual} align="start" returnFocus={() => input.current || rowRef.current}
        getAnchorRect={() => ({ x: menu?.x || 0, y: menu?.y || 0, left: menu?.x || 0, right: menu?.x || 0, top: menu?.y || 0, bottom: menu?.y || 0, width: 0, height: 0 })}
        className="dsi-dsh-row-menu" anchor={<HoverCard key={edit ? 'rename-editor' : 'session-details'} anchor={rowNode} disabled={!preferences.sessionTooltips || !!edit || !!menu || !!drag.active}
          openDelayMs={800} grouped inline={inlineDetails} fitContent={inlineDetails} content={<div className="dsi-dsh-details">
            <strong title={title}>{title}</strong>
            <div className="dsi-dsh-detail-line" title={row.session.cwd || row.workspace?.path}>
              {icon('IconFolderCloseRegular', 14)}<span>{detailProject}</span>
            </div>
            <div className="dsi-dsh-detail-line" title={state === 'idle' && !draft && row.section !== 'snoozed' ? new Date(row.activityAt).toLocaleString() : detailLabel}>
              {state === 'idle' ? icon('IconClockOutlineRegular', 14) : <StateDot state={state} />}<span>{detailLabel}</span>
            </div>
          </div>} />} />
      {edit?.error && <div id={errorId} role="alert" className="dsi-dsh-rename-error">{edit.error}</div>}
      {snippet && <div className="dsi-dsh-snippet">{snippet}</div>}
    </div>;
  }

  function CustomSnooze({ target, close, actions, t }) {
    const [value, setValue] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState(false);
    const id = React.useId(), until = new Date(value).getTime();
    return <Modal open onClose={saving ? () => {} : close} title={t('snooze')} closeLabel={t('close')}
      description={target.row.session.displayTitle || t('newSession')}
      footer={<><Button variant="outline" disabled={saving} onClick={close}>{t('cancel')}</Button>
        <Button disabled={saving || !(until > Date.now())} onClick={async () => { setSaving(true); setError(false);
          const ok = await actions.snooze(target.row.id, until, target.order); setSaving(false); if (ok) close(); else setError(true); }}>{t('confirmSnooze')}</Button></>}>
      <label htmlFor={id}>{t('customTime')}</label><Input id={id} type="datetime-local" value={value} disabled={saving} onChange={e => setValue(e.target.value)} />
      {error && <p role="alert">{t('reminderFailed')}</p>}
    </Modal>;
  }

  return function NativeInboxSidebar({ wide, expandSidebar, useInbox, useNativeShortcuts, useRemoteAccess, useSessionAccess = () => false,
    useSidebarPreferences = select => select({ value: DEFAULT_PREFERENCES }), useProjectCatalog = select => select(EMPTY_CATALOG), actions, t }) {
    const preferences = useSidebarPreferences(s => s.value), data = useInbox(s => s), shortcuts = useNativeShortcuts(s => s);
    const catalog = useProjectCatalog(s => s);
    const canCreate = useRemoteAccess('session/create'), canAdd = useRemoteAccess('workspace/create');
    const [showArchived, setShowArchived] = useState(false);
    const [view, setView] = useState('main'), [browsers, setBrowsers] = useState({ main: { query: '', project: '', limit: 60 }, settled: { query: '', project: '', limit: 60 } });
    const historyView = view === 'settled', { query, project, limit } = browsers[view];
    const setField = (key, value) => setBrowsers(previous => ({ ...previous, [view]: { ...previous[view], [key]: typeof value === 'function' ? value(previous[view][key]) : value } }));
    const setQuery = value => setField('query', value), setProject = value => setField('project', value), setLimit = value => setField('limit', value);
    const positions = useRef({ main: { top: 0, anchors: [] }, settled: { top: 0, anchors: [] } }), previousBrowser = useRef(null);
    const entryButton = useRef(null), backButton = useRef(null), scrollReserve = useRef(null), navigationFocus = useRef(false), removedFocus = useRef(null), historyScopeInitialized = useRef(false);
    const capturePosition = () => {
      const viewport = scroll.current; if (!viewport) return;
      const tail = scrollReserve.current, retained = tail?.offsetHeight || 0;
      if (retained && viewport.scrollTop <= Math.max(0, viewport.scrollHeight - retained - viewport.clientHeight) + .5) tail.style.height = '0px';
      const bounds = viewport.getBoundingClientRect();
      positions.current[view] = { top: viewport.scrollTop, anchors: [...viewport.querySelectorAll('[data-sidebar-row]')]
        .filter(node => { const rect = node.getBoundingClientRect(); return rect.bottom > bounds.top && rect.top < bounds.bottom; })
        .map(node => ({ id: node.dataset.sidebarRow, offset: node.getBoundingClientRect().top - bounds.top })) };
    };
    const showView = (next, focus = true) => { capturePosition(); navigationFocus.current = focus; removedFocus.current = null; setFilterOpen(false); setView(next); };
    const rememberRestoredRow = id => {
      capturePosition();
      const nodes = [...(scroll.current?.querySelectorAll('[data-sidebar-row]') || [])], index = nodes.findIndex(node => node.dataset.sidebarRow === id);
      if (historyView && nodes[index]?.contains(document.activeElement)) { const intent = { id, next: (nodes[index + 1] || nodes[index - 1])?.dataset.sidebarRow }; removedFocus.current = intent; return () => { if (removedFocus.current === intent) removedFocus.current = null; }; }
    };
    const showSettled = () => { if (!historyScopeInitialized.current) { setBrowsers(previous => ({ ...previous, settled: { ...previous.settled, project: previous.main.project } })); historyScopeInitialized.current = true; } showView('settled'); };
    const [searches, setSearches] = useState({ main: { query: '', items: [], pending: false }, settled: { query: '', items: [], pending: false } }), [activeResult, setActiveResult] = useState(0);
    const search = searches[view], setSearch = value => setSearches(previous => ({ ...previous, [view]: typeof value === 'function' ? value(previous[view]) : value }));
    const [filterOpen, setFilterOpen] = useState(false), [customSnooze, setCustomSnooze] = useState(null);
    const [dragState, setDragState] = useState(null), [over, setOver] = useState(null);
    const [inlineDetails, setInlineDetails] = useState(false);
    const root = useRef(null), scroll = useRef(null), input = useRef(null), activeDrag = useRef(null), target = useRef(null), focusRequested = useRef(false);
    useLayoutEffect(() => wide ? mountFooterIconTitles(root.current) : undefined, [wide]);
    useLayoutEffect(() => {
      if (!wide || !root.current) return;
      const browser = root.current;
      const measure = () => setInlineDetails(browser.getBoundingClientRect().right + 260 > window.innerWidth);
      const observer = new ResizeObserver(measure);
      observer.observe(browser); window.addEventListener('resize', measure); measure();
      return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
    }, [wide]);
    const rename = useInlineRename(actions, t), needle = query.trim().toLocaleLowerCase();
    useEffect(() => {
      if (!needle) return;
      const abort = new AbortController(); setSearch(previous => ({ query: needle, view, items: previous.query === needle ? previous.items : [], pending: true }));
      const timer = setTimeout(() => actions.search(query.trim(), abort.signal).then(result => {
        if (!abort.signal.aborted) setSearch({ ...result, query: needle, view, pending: false });
      }, error => { if (!abort.signal.aborted) setSearch({ query: needle, view, items: [], pending: false, error: String(error.message || error) }); }), 250);
      return () => { clearTimeout(timer); abort.abort(); };
    }, [needle, view]);
    const currentSearch = search.query === needle && search.view === view ? search : { items: EMPTY_SEARCH_ITEMS, pending: !!needle };
    const matches = new Map(currentSearch.items.map(item => [item.sessionId, item.snippet]));
    const stableRows = useStableRows(data.rows, rename.state?.id || dragState);
    const groups = projectGroups(data.workspaces, stableRows, catalog);
    const rowGroups = new Map(groups.flatMap(group => group.rows.map(row => [row.id, group])));
    const rows = stableRows.map(row => ({ ...row, projectName: rowGroups.get(row.id)?.name, projectInfo: rowGroups.get(row.id) }));
    const selectedGroup = groups.find(group => group.key === project || group.workspaceIds.some(id => id === project || 'workspace:' + id === project));
    const inScope = row => !project || !!selectedGroup?.rows.some(candidate => candidate.id === row.id);
    const visible = rows.filter(row => row.section !== 'draft' && (!historyView || row.section === 'settled') && inScope(row)
      && (!needle || matches.has(row.id) || [row.id, row.session.displayTitle, row.session.title, row.session.cwd, row.workspace?.title, row.projectName].some(value => value?.toLocaleLowerCase().includes(needle))));
    const settled = visible.filter(row => row.section === 'settled');
    const allSettledCount = rows.filter(row => row.section === 'settled').length;
    const settledCount = rows.filter(row => row.section === 'settled' && inScope(row)).length;
    const shownGroups = groups.filter(group => (!project || group === selectedGroup) && (!group.archived || showArchived || needle || group === selectedGroup
      || group.rows.some(row => row.section !== 'settled' && (row.current || row.running || row.attention || row.unread || row.record.error))));
    const shownKeys = new Set(shownGroups.map(group => group.key));
    const mainRows = rows.filter(row => inScope(row) && shownKeys.has(row.projectInfo?.key)
      && (needle ? visible.some(match => match.id === row.id) : row.section !== 'settled'));
    useLayoutEffect(() => {
      if (!wide || !scroll.current) return;
      const previous = previousBrowser.current, changedView = previous?.view !== view;
      if (data.operationError) removedFocus.current = null;
      if (previous && !changedView && (previous.query !== query || previous.project !== project)) { positions.current[view] = { top: 0, anchors: [] }; removedFocus.current = null; }
      const saved = positions.current[view], viewport = scroll.current, tail = scrollReserve.current;
      const changedScope = previous && !changedView && (previous.query !== query || previous.project !== project);
      // Main-list updates keep the host's normal behavior. Explicit navigation and
      // history edits use one layout-phase owner for range and anchor compensation.
      if (!previous || changedView || changedScope || historyView || previous.viewport !== viewport || previous.catalog !== catalog) {
        if (tail) tail.style.height = '0px';
        const naturalMax = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        viewport.scrollTop = saved.top;
        let desired = Math.min(saved.top, naturalMax);
        if (saved.top > 0) {
          const top = viewport.getBoundingClientRect().top;
          for (const anchor of saved.anchors) {
            const node = [...viewport.querySelectorAll('[data-sidebar-row]')].find(node => (node.dataset.sidebarRow) === anchor.id);
            if (node) { desired = Math.max(0, viewport.scrollTop + node.getBoundingClientRect().top - top - anchor.offset); break; }
          }
        }
        if (tail) tail.style.height = Math.max(0, desired - naturalMax) + 'px';
        viewport.scrollTop = desired;
      }
      capturePosition(); previousBrowser.current = { view, query, project, viewport, catalog };
      if (previous && changedView && navigationFocus.current) (historyView ? backButton : entryButton).current?.focus({ preventScroll: true });
      if (removedFocus.current && ![...viewport.querySelectorAll('[data-sidebar-row]')].some(node => node.dataset.sidebarRow === removedFocus.current.id)) {
        const next = [...viewport.querySelectorAll('[data-sidebar-row]')].find(node => node.dataset.sidebarRow === removedFocus.current.next);
        (next || backButton.current)?.focus({ preventScroll: true }); removedFocus.current = null;
      }
    }, [wide, view, query, project, data.rows, data.operationError, currentSearch.items, limit, preferences.density, catalog]);
    const lastCurrent = useRef(null);
    useEffect(() => {
      const current = data.rows.find(row => row.current);
      if (current && current.id !== lastCurrent.current && current.session.blank && historyView) showView('main', false);
      if (current) lastCurrent.current = current.id;
    }, [data.rows]);
    const order = mainRows.filter(row => ['pinned', 'inbox', 'working'].includes(row.section)).map(row => row.id);
    const searchRows = historyView ? settled.slice(0, limit) : mainRows.slice(0, limit);
    const cancelDrag = () => { activeDrag.current = null; target.current = null; setDragState(null); setOver(null); };
    const drag = { active: dragState, over, rows: data.rows, disabled: !wide || !!needle || !!rename.state,
      start(id) { activeDrag.current = id; target.current = null; setDragState(id); setOver(null); }, cancel: cancelDrag,
      hover(next) { target.current = next; setOver(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); },
      drop() { const id = activeDrag.current, destination = target.current; cancelDrag(); if (!id || !destination || destination.id === id) return;
        void actions.move(id, { section: destination.section, ...destination.id ? { [destination.half === 'after' ? 'afterId' : 'beforeId']: destination.id } : {} }); } };
    useEffect(() => {
      if (!dragState) return;
      const escape = e => { if (e.key === 'Escape') cancelDrag(); }, leave = e => { if (!root.current?.contains(e.target)) cancelDrag(); };
      window.addEventListener('blur', cancelDrag); document.addEventListener('keydown', escape); document.addEventListener('drop', leave);
      return () => { window.removeEventListener('blur', cancelDrag); document.removeEventListener('keydown', escape); document.removeEventListener('drop', leave); };
    }, [dragState]);
    useLayoutEffect(() => {
      if (rename.state || !rename.focusId.current) return;
      const id = rename.focusId.current; rename.focusId.current = null;
      [...root.current.querySelectorAll('[data-sidebar-row]')].find(n => n.dataset.sidebarRow === id)?.focus({ preventScroll: true });
    }, [rename.state]);
    const lastSearch = useRef(0), lastAdd = useRef(false);
    useEffect(() => {
      if (shortcuts.searchRequest !== lastSearch.current) { lastSearch.current = shortcuts.searchRequest;
        if (shortcuts.searchRequest) { focusRequested.current = true; if (historyView) showView('main', false); expandSidebar(); if (wide && !historyView) input.current?.focus({ preventScroll: true }); } }
      if (shortcuts.addRequested !== lastAdd.current) { lastAdd.current = shortcuts.addRequested; if (shortcuts.addRequested && canAdd) void actions.addWorkspace(); }
    }, [shortcuts.searchRequest, shortcuts.addRequested, canAdd]);
    useEffect(() => { if (wide && focusRequested.current) { input.current?.focus({ preventScroll: true }); focusRequested.current = false; } }, [wide, view]);
    useEffect(() => {
      if (!data.undo) return;
      const key = e => { if (!e.defaultPrevented && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z'
        && !e.target.closest('input,textarea,[contenteditable=true]')) { e.preventDefault(); void actions.undo(); } };
      document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
    }, [data.undo]);
    useEffect(() => setActiveResult(0), [needle, project]);
    const rowElement = row => { const index = searchRows.findIndex(item => item.id === row.id);
      return <SessionRow key={'session:' + row.id} row={row} actions={actions} t={t} rename={rename} busy={data.busy.has(row.id)} order={order}
        preferences={preferences} inlineDetails={inlineDetails} historyView={historyView} onRestoreStart={rememberRestoredRow} useSessionAccess={useSessionAccess} drag={drag} snippet={matches.get(row.id)}
        onCustomSnooze={(row, order) => setCustomSnooze({ row, order })}
        searchProps={needle ? { id: 'dsi-search-result-' + index, role: 'option', 'aria-selected': index === activeResult } : undefined} />; };
    const children = [];
    if (historyView) children.push(...(needle ? searchRows : settled.slice(0, limit)).map(rowElement));
    else children.push(...mainRows.slice(0, limit).map(rowElement));
    if (data.phase === 'pending') children.push(<div key="loading" role="status" className="dsi-dsh-empty">{t('loading')}</div>);
    if (data.phase === 'error') children.push(<div key="error" role="alert" className="dsi-dsh-error">{t('loadFailed')}<Button variant="outline" onClick={actions.retry}>{t('retry')}</Button></div>);
    if (data.phase === 'ready' && !(historyView ? settled : mainRows).length && !needle) children.push(<div key="empty" role="status" className="dsi-dsh-empty">{t(historyView ? 'emptySettled' : 'empty')}</div>);
    if (needle && currentSearch.pending && !visible.length) children.push(<div key="searching" role="status" className="dsi-dsh-empty">{t('searching')}</div>);
    if (needle && !visible.length && !currentSearch.pending) children.push(<div key="noMatches" className="dsi-dsh-empty">{t('noMatches')}</div>);
    if (needle && currentSearch.error) children.push(<div key="searchError" role="alert" className="dsi-dsh-error">{t('searchFailed', { message: currentSearch.error })}</div>);
    if ((historyView ? settled : mainRows).length > limit) children.push(<button key="more" className="dsi-dsh-more" onClick={() => setLimit(n => n + 60)}>{t('more', { n: Math.min(60, (historyView ? settled : mainRows).length - limit) })}</button>);
    if (needle && currentSearch.hasMore) children.push(<div key="searchMore" className="dsi-dsh-empty">{t('searchMore')}</div>);
    if (data.connectionState === 'loading' && data.phase === 'ready') children.push(<div key="connection" role="status" className="dsi-dsh-empty">{t('reconnecting')}</div>);
    const placementDrop = section => ({ onDragOver(e) { if (activeDrag.current) { e.preventDefault(); drag.hover({ section }); } },
      onDrop(e) { if (activeDrag.current) { e.preventDefault(); e.stopPropagation(); drag.drop(); } } });
    return <div ref={root} className={'dsi-root dsi-dsh' + (!wide ? ' dsi-rail' : '')} data-sidebar-view={view} data-dsi-density={preferences.density} data-dsi-list-motion={preferences.listMotion}>
      <style>{stylesheet}</style>
      {!wide ? <div className="dsi-dsh-rail"><IconButton label={t('search')} name="IconSearchOutlineRegular" onClick={() => { focusRequested.current = true; expandSidebar(); }} />
        <IconButton label={t('projects')} name="IconFolderCloseRegular" onClick={() => { setFilterOpen(true); expandSidebar(); }} /></div> : <>
        {historyView && <div className="dsi-dsh-history-header">
          <button ref={backButton} type="button" className="dsi-dsh-back" aria-label={t('backToSessions')} data-testid="sidebar-settled-back"
            data-drop={over?.section === 'inbox' && !over.id || undefined} onClick={() => showView('main')} {...placementDrop('inbox')}>
            {icon('IconChevronLeftOutlineRegular', 16)}<span>{t('settled')}</span></button><span className="dsi-dsh-count">{settledCount}</span>
        </div>}
        <div className="dsi-dsh-toolbar"><div className="dsi-dsh-search">{icon('IconSearchOutlineRegular', 14)}
          <input ref={input} type="text" role="combobox" aria-label={t(historyView ? 'searchSettled' : 'search')} placeholder={t(historyView ? 'searchSettled' : 'search')} value={query} maxLength={500}
            aria-autocomplete="list" aria-expanded={!!needle} aria-controls={needle ? 'dsi-search-results' : undefined}
            aria-activedescendant={needle && searchRows.length ? 'dsi-search-result-' + Math.min(activeResult, searchRows.length - 1) : undefined}
            onChange={e => { setQuery(e.target.value.replaceAll('\0', '').slice(0, 500)); setLimit(60); }} onKeyDown={e => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Escape') { e.preventDefault(); setQuery(''); }
              if (needle && searchRows.length && ['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) { e.preventDefault();
                if (e.key === 'Enter') void actions.open(searchRows[Math.min(activeResult, searchRows.length - 1)].id);
                else setActiveResult(n => (n + (e.key === 'ArrowUp' ? -1 : 1) + searchRows.length) % searchRows.length); } }} />
          {!!query && <button type="button" className="dsi-dsh-icon-button" aria-label={t('clearSearch')} onClick={() => { setQuery(''); input.current?.focus(); }}>{icon('IconCloseOutlineRegular', 14)}</button>}</div>
          <Menu open={filterOpen} onClose={() => setFilterOpen(false)} portal dense autoFocus align="end" selectedId={project ? 'group:' + (selectedGroup?.key || project) : 'scope:all'}
            items={[{ id: 'scope:all', label: t('allProjects') }, ...groups.filter(group => !group.archived || showArchived || group === selectedGroup).map(group => ({ id: 'group:' + group.key, label: group.name || t('ungrouped'), icon: <ProjectIcon project={group} compact /> })),
              ...historyView ? [] : [{ type:'separator', id:'workspace-actions' }, ...(groups.some(group => group.archived) ? [{ id:'action:archived-projects', label:t(showArchived ? 'hideArchivedProjects' : 'showArchivedProjects') }] : []), { id:'action:add-workspace', label:t('addProject'), icon:icon('IconProjectAddOutlineRegular'), disabled:!canAdd || data.busy.has('workspace') }]]}
            onSelect={id => { setFilterOpen(false); if (id === 'action:add-workspace') { if (canAdd && !data.busy.has('workspace')) void actions.addWorkspace(); }
              else if (id === 'scope:all') setProject(''); else if (id === 'action:archived-projects') setShowArchived(!showArchived); else if (id.startsWith('group:')) setProject(id.slice('group:'.length)); }}
            anchor={<Tooltip label={t('projects')} side="bottom" delayMs={500} portal disabled={filterOpen}><button type="button" className="dsi-dsh-icon-button" aria-label={t('projects')}
              aria-haspopup="menu" aria-expanded={filterOpen} data-active={!!project || undefined} onClick={() => setFilterOpen(!filterOpen)}>{icon('IconFolderCloseRegular')}</button></Tooltip>} />
        </div>
        {project && <div className="dsi-dsh-filter"><span>{selectedGroup?.name || t('ungrouped')}</span>
          {!historyView && !!selectedGroup?.workspaceIds.length && <ProjectNewSession group={selectedGroup} canCreate={canCreate} start={workspaceId => actions.start(workspaceId)} t={t} />}
          <IconButton label={t('allProjects')} name="IconCloseOutlineRegular" onClick={() => setProject('')} /></div>}
        {(data.persistenceError || data.operationError) && <div className="dsi-dsh-error" role="alert"><span>{data.persistenceError ? t('storageFailed', { message: data.persistenceError }) : t('operationFailed', { message: data.operationError })}</span>
          {!data.persistenceError && <IconButton label={t('close')} name="IconCloseOutlineRegular" onClick={actions.dismissError} />}</div>}
        <div ref={scroll} onScroll={capturePosition} className="dsi-dsh-scroll" data-slot="scroll-area-viewport" onDragOver={e => { if (activeDrag.current) e.preventDefault(); }}>
          <HoverCardGroup className="dsi-dsh-list-seat"><div id={needle ? 'dsi-search-results' : undefined} className="dsi-dsh-list-frame">
            <AnimatedRows className="dsi-dsh-list" role={needle ? 'listbox' : 'tree'} label={needle ? t('search') : t(historyView ? 'settled' : 'inbox')}
              rowKeys={children.map(child => String(child.key))} ready={!historyView && preferences.listMotion && data.phase === 'ready' && !dragState && !rename.state}
              resetKey={[view, wide, project, needle, preferences.density].join(':')}>{children}</AnimatedRows>
          </div></HoverCardGroup>
          <div ref={scrollReserve} className="dsi-dsh-scroll-reserve" aria-hidden="true" />
        </div>
        {!historyView && <button ref={entryButton} type="button" className="dsi-dsh-settled-entry" data-testid="sidebar-settled-entry"
          aria-label={t('openSettled', { n: allSettledCount })} data-drop={over?.section === 'settled' && !over.id || undefined}
          onClick={showSettled} {...placementDrop('settled')}>
          {icon('IconArchiveOutlineRegular', 16)}<span>{t('settled')}</span><span className="dsi-dsh-count">{allSettledCount}</span>{icon('IconChevronRightOutlineRegular', 14)}
        </button>}
        {data.undo && <div className="dsi-dsh-undo" role="status"><span>{t('undo_' + data.undo.kind)}</span>
          <button type="button" disabled={data.busy.has(data.undo.id) || data.busy.has('undo')} title={t('undoShortcut')} onClick={() => void actions.undo()}>{t('undo')}</button>
          <IconButton label={t('close')} name="IconCloseOutlineRegular" onClick={actions.dismissUndo} /></div>}
        {customSnooze && <CustomSnooze target={customSnooze} close={() => setCustomSnooze(null)} actions={actions} t={t} />}
      </>}
    </div>;
  };
}
