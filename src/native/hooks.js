import { useState, useRef, useEffect } from 'react';
export function useInlineRename(actions, t) {
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

export function useStableRows(rows, interactionId) {
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

