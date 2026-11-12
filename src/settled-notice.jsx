import { DEFAULT_PREFERENCES } from './preferences.js';
export function settledAge(at, now, t) {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return t('settledNow');
  if (minutes < 60) return t('settledMinutesAgo', { n: minutes });
  if (minutes < 1440) return t('settledHoursAgo', { n: Math.floor(minutes / 60) });
  return t('settledDaysAgo', { n: Math.floor(minutes / 1440) });
}

export function createSettledNotice(React, stylesheet) {
  const { useId, useState } = React;

  function Notice({ row, busy, error, actions, t }) {
    const [attempted, setAttempted] = useState(false);
    const errorId = useId();
    const at = row.record.settledFromArchive ? 0 : row.record.settledAt;
    const date = at > 0 ? new Date(at) : null;
    const knownTime = date !== null && Number.isFinite(date.getTime());
    const failure = attempted && !busy && error;
    return <aside className="dsi-settled-notice" aria-label={t('settledNotice')}
      data-session-id={row.id}>
      <style>{stylesheet}</style>
      <div className="dsi-settled-notice-row">
        <span className="dsi-settled-notice-status" role="status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
          </svg>
          <span>{t('settled')}</span>
          {knownTime && <><span aria-hidden="true">·</span>
            <time dateTime={date.toISOString()} title={date.toLocaleString()}>
              {settledAge(at, Date.now(), t)}
            </time></>}
        </span>
        <span className="dsi-settled-notice-divider" aria-hidden="true">·</span>
        <button type="button" disabled={busy} aria-busy={busy} aria-describedby={failure ? errorId : undefined}
          onClick={() => { setAttempted(true); void actions.restore(row.id); }}>
          {t(busy ? 'restoringSettled' : 'restore')}
        </button>
      </div>
      {failure && <p id={errorId} role="alert" className="dsi-settled-notice-error">
        {t('restoreSettledFailed', { message: error })}
      </p>}
    </aside>;
  }

  return function SettledNotice({ sessionId, useInbox, useSidebarPreferences = select => select({ value: DEFAULT_PREFERENCES }), actions, t }) {
    const data = useInbox(state => state);
    const row = data.rows.find(item => item.id === sessionId && item.section === 'settled');
    const enabled = useSidebarPreferences(state => state.value.settledNotice);
    if (!row || !enabled) return null;
    return <Notice key={row.id + ':' + row.record.settledAt} row={row} busy={data.busy.has(row.id)}
      error={data.operationError} actions={actions} t={t} />;
  };
}
