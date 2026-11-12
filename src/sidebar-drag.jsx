import React, { useEffect, useMemo, useRef } from 'react';
import { DndContext, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SidebarPointerSensor } from './vendor/t3-sidebar/Sidebar.pointer.ts';
import { createSidebarCollisionDetection, createSidebarSortingStrategy,
  restrictBelowSidebarLabel } from './vendor/t3-sidebar/Sidebar.drag.ts';
import { animateSidebarLayoutChanges, resolveSidebarDropTarget, resolveSidebarDropVerb,
  sidebarListItemId, sidebarMarkerId } from './vendor/t3-sidebar/Sidebar.logic.ts';

// The sensor, hit testing and projection above are T3 Code's implementation.
// This adapter supplies DSH's row structure, scroll bounds and state operations.
const ENABLED = { draggable: false };
const DISABLED = { draggable: true };
const MARKER_HEIGHT = 24;
const sectionOf = row => row.pinned ? 'pinned' : row.section === 'settled' ? 'settled'
  : row.section === 'snoozed' ? 'snoozed' : 'active';

export function buildDragItems(primary, snoozed, settled, views) {
  const row = value => ({ kind: 'thread', key: value.id, section: sectionOf(value) });
  const marker = name => ({ kind: 'marker', marker: name });
  return [marker('pinned-header'), ...primary.filter(value => value.pinned).map(row),
    marker('pinned-divider'), marker('active-placeholder'), ...primary.filter(value => !value.pinned).map(row),
    ...(snoozed.length ? [marker('snoozed-header'), ...(views.snoozed.open ? snoozed.slice(0, views.snoozed.limit).map(row) : [])] : []),
    marker('settled-header'), marker('settled-placeholder'),
    ...(views.settled.open ? settled.slice(0, views.settled.limit).map(row) : [])];
}

export function destinationFor(items, id, overId, rows) {
  const target = resolveSidebarDropTarget(items, id, overId);
  const source = rows.find(row => row.id === id);
  if (!source || source.session.blank || !target) return null;
  if (target.section === 'settled') return source.running || source.attention || source.section === 'settled'
    ? null : { section: 'settled' };
  const sequence = target.section === 'pinned' ? target.pinnedOrder : target.activeOrder;
  const index = sequence.indexOf(id);
  const beforeId = sequence[index + 1];
  const afterId = sequence[index - 1];
  return { section: target.section === 'active' ? 'inbox' : 'pinned',
    ...(beforeId ? { beforeId } : afterId ? { afterId } : {}) };
}

export function optimisticRows(rows, move) {
  if (!move) return rows;
  const source = rows.find(row => row.id === move.id);
  if (!source) return rows;
  const next = { ...source, section: move.destination.section, pinned: move.destination.section === 'pinned' };
  const rest = rows.filter(row => row.id !== move.id);
  const { beforeId, afterId, section } = move.destination;
  let index = beforeId ? rest.findIndex(row => row.id === beforeId)
    : afterId ? rest.findIndex(row => row.id === afterId) + 1
      : section === 'pinned' ? 0 : section === 'settled'
        ? rest.findIndex(row => row.section === 'settled') : rest.filter(row => row.pinned).length;
  if (index < 0) index = rest.length;
  rest.splice(index, 0, next);
  return rest;
}

export function useSidebarDrag({ items: freshItems, rows, state, setState, optimistic, setOptimistic,
  actions, blocked, root, scroll, header, views, motion, motionEnabled = true }) {
  const sensor = useRef(null);
  const latest = useRef(null);
  const key = freshItems.map(sidebarListItemId).join('\n');
  const items = useMemo(() => freshItems, [key]);
  const outside = useRef(false);
  const activationY = useRef(null);
  latest.current = { items, rows, blocked, actions, optimistic, motionEnabled };
  const options = useMemo(() => ({
    distance: 6,
    onAttach(value) { sensor.current = value; },
    onFinish(started) { sensor.current = null; if (started) { if(latest.current.motionEnabled) motion?.current?.release(); else motion?.current?.suspend(); setState(null); } },
    onMove(point) {
      const bounds = root.current?.getBoundingClientRect();
      const value = !bounds || point.x < bounds.left || point.x > bounds.right;
      if (value !== outside.current) {
        outside.current = value;
        setState(current => current && { ...current, outside: value, targetSection: value ? null : current.targetSection });
      }
      return value;
    },
    onDrop(point) {
      const bounds = scroll.current?.getBoundingClientRect();
      return !bounds || point.x < bounds.left || point.x > bounds.right
        || point.y < header.current.getBoundingClientRect().bottom || point.y > bounds.bottom - footerInset();
    },
  }), []);
  const sensors = useSensors(useSensor(SidebarPointerSensor, options));
  function footerInset() { return parseFloat(getComputedStyle(root.current).getPropertyValue('--dsi-footer-inset')) || 0; }
  useEffect(() => () => sensor.current?.cancel(), []);
  useEffect(() => {
    if (state && (blocked || !items.some(item => item.kind === 'thread' && item.key === state.activeKey))) sensor.current?.cancel();
  }, [blocked, key, state?.activeKey]);

  const collision = useMemo(() => createSidebarCollisionDetection(id => {
    const value = latest.current;
    return Boolean(state && destinationFor(value.items, state.activeKey, id, value.rows));
  }, { items, activationY: activationY.current }), [items, state?.activeKey,
    rows.find(row => row.id === state?.activeKey)?.running, rows.find(row => row.id === state?.activeKey)?.attention]);
  const settledIds = rows.filter(row => row.section === 'settled').map(row => row.id);
  const projectedSettled = state?.targetSection === 'settled'
    ? [state.activeKey, ...settledIds.filter(id => id !== state.activeKey)] : settledIds;
  const strategy = useMemo(() => createSidebarSortingStrategy({ items, settledOrder: projectedSettled,
    settledExpanded: views.settled.open, settledVisibleCount: views.settled.limit,
    snoozedThreadCount: rows.filter(row => row.section === 'snoozed').length,
    boundaryLabelHeight: MARKER_HEIGHT,
    // T3 calculates the target order from the hovered slot. DSH's active list is
    // manually sortable, so do not override it with a time-ordered projection.
  }), [items, projectedSettled.join('\n'), views.settled.open, views.settled.limit]);
  const modifiers = useMemo(() => [restrictToVerticalAxis, args => {
    const bounds = scroll.current?.getBoundingClientRect();
    if (!bounds) return args.transform;
    return restrictBelowSidebarLabel({ ...args, containerNodeRect: bounds },
      header.current.getBoundingClientRect().bottom - bounds.top + MARKER_HEIGHT);
  }, args => {
    const bounds = scroll.current?.getBoundingClientRect();
    if (!bounds) return args.transform;
    const top = header.current.getBoundingClientRect().bottom;
    const bottom = bounds.bottom - footerInset();
    return restrictToFirstScrollableAncestor({ ...args, scrollableAncestorRects: [
      { ...bounds.toJSON(), top, bottom, height: bottom - top },
    ] });
  }], []);
  return {
    id: state?.activeKey, targetSection: state?.targetSection, dragging: Boolean(state), rows,
    items, strategy, disabled: blocked || Boolean(optimistic),
    verb: state ? resolveSidebarDropVerb(state.activeSection, state.targetSection) : null,
    context: { sensors, modifiers, collisionDetection: collision, autoScroll: !state?.outside,
      onDragStart(event) {
        const source = latest.current.rows.find(row => row.id === String(event.active.id));
        if (!source || latest.current.blocked) { sensor.current?.cancel(); return; }
        motion?.current?.suspend();
        activationY.current = event.activatorEvent.clientY;
        outside.current = false;
        setState({ activeKey: source.id, activeSection: sectionOf(source), targetSection: sectionOf(source), outside: false });
      },
      onDragOver(event) {
        const target = event.over && resolveSidebarDropTarget(latest.current.items, String(event.active.id), String(event.over.id));
        setState(current => current && { ...current, targetSection: outside.current ? null : target?.section ?? null,
          overId: event.over && String(event.over.id) });
      },
      onDragEnd(event) {
        if (!event.over || outside.current) return;
        const id = String(event.active.id);
        const value = latest.current;
        const destination = destinationFor(value.items, id, String(event.over.id), value.rows);
        if (!destination || String(event.over.id) === id) return;
        const move = { id, destination };
        setOptimistic(move);
        void actions.move(id, destination).finally(() => setOptimistic(current => current === move ? null : current));
      },
      onDragCancel() { setState(null); },
    },
  };
}

export function DragProvider({ drag, children }) {
  return <DndContext {...drag.context}><SortableContext items={drag.items.map(sidebarListItemId)}
    strategy={drag.strategy}>{children}</SortableContext></DndContext>;
}

export function SortableRow({ id, disabled, history, children }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id,
    disabled: disabled ? DISABLED : ENABLED, animateLayoutChanges: animateSidebarLayoutChanges });
  return <li ref={setNodeRef} className={'dsi-sortable-slot' + (history ? ' dsi-sortable-history' : '')}
    data-sortable-id={id} data-dragging={isDragging || undefined}
    style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined,
      visibility: !isDragging && transform?.scaleY === 0 ? 'hidden' : undefined }}
    onPointerDown={event => {
      if (!event.target.closest('.dsi-card-main') || event.target.closest('input,textarea,[contenteditable=true]')) return;
      listeners?.onPointerDown?.(event);
    }}>{children}</li>;
}

export function DragMarker({ marker, label, visible, active, children }) {
  const { setNodeRef, transform, transition } = useSortable({ id: sidebarMarkerId(marker),
    disabled: DISABLED, animateLayoutChanges: animateSidebarLayoutChanges });
  return <li ref={setNodeRef} className="dsi-drag-marker" data-drag-marker={marker}
    style={{ transform: CSS.Translate.toString(transform), transition,
      visibility: transform?.scaleY === 0 ? 'hidden' : undefined }}>
    {visible && <div className={'sidebar-drag-boundary-label' + (active ? ' dsi-boundary-active' : '')}>
      <span>{label}</span><i aria-hidden="true" />
    </div>}{children}
  </li>;
}

export function SortableShelfToggle({ section, active, children, ...props }) {
  const { setNodeRef, transform, transition } = useSortable({ id: sidebarMarkerId(section + '-header'),
    disabled: DISABLED, animateLayoutChanges: animateSidebarLayoutChanges });
  return <button {...props} type="button" ref={setNodeRef} data-drop-active={active || undefined}
    style={{ transform: CSS.Translate.toString(transform), transition }}>{children}</button>;
}
