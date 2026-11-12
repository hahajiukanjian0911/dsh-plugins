import React from 'react';

// Equivalent presentation of the installed 0.2.2 native control. Only the
// isolated preview uses this fixture; production keeps the host's component.
const busyPhases = new Set(['checking', 'downloading', 'verifying', 'installing']);
const labels = {
  zh: { checking: '正在检查更新…', available: '新版本', downloading: '{percent}%',
    verifying: '正在校验更新文件…', installing: '正在准备重启…', ready: '安装并重启', error: '重试更新' },
  en: { checking: 'Checking for updates…', available: 'Update', downloading: '{percent}%',
    verifying: 'Verifying update files…', installing: 'Preparing to restart…', ready: 'Install and Restart', error: 'Retry update' },
};

export function NativeUpdatePreview({ wide, source, onOpen }) {
  const { presentation: state, failed, opening, connection } = React.useSyncExternalStore(source.subscribe, source.getSnapshot);
  if (!wide || connection && state?.phase !== 'installing' || !failed && (!state || state.phase === 'idle')) return null;
  const text = labels[document.documentElement.lang === 'en' ? 'en' : 'zh'];
  const label = failed ? text.error : text[state.phase].replace('{percent}', String(state.percent ?? 0));
  const busy = opening || state && busyPhases.has(state.phase);
  const error = failed || state?.phase === 'error';
  const detail = state?.phase === 'downloading'
    ? `正在下载更新：${state.percent ?? 0}%\n目标版本：${state.version}`
    : state?.phase === 'error' ? '更新失败，请重试。' : state?.version ? `${label}：${state.version}` : label;
  return <button type="button" className="preview-native-update" aria-label={label} aria-disabled={Boolean(busy)}
    title={detail} onClick={() => { if (!busy) onOpen(); }}>
    <span className="preview-native-update-icon" aria-hidden="true">
      {error ? <span className="preview-native-update-error" />
        : busy ? <svg className="preview-native-update-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9" /></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></svg>}
    </span><span>{label}</span>
  </button>;
}

export function NativeConnectionPreview({ source }) {
  const { connection } = React.useSyncExternalStore(source.subscribe, source.getSnapshot);
  if (!connection) return null;
  return <button type="button" className="preview-native-connection" data-phase={connection} aria-label="重新连接">
    连接中断
  </button>;
}

export function NativeUpdateBadgePreview({ wide, source }) {
  const { presentation: state, failed, connection } = React.useSyncExternalStore(source.subscribe, source.getSnapshot);
  if (wide || connection && state?.phase !== 'installing' || !failed && (!state || state.phase === 'idle')) return null;
  return <span className="preview-native-update-badge" role="img" aria-label="有更新" />;
}
