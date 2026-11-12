import React from 'react';
import { nativePrimitives } from '../tests/native-primitives.js';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createHostFixture, source } from '../tests/host-fixture.js';
import { NativeUpdatePreview, NativeConnectionPreview, NativeUpdateBadgePreview } from './native-update-preview.jsx';
import { en, zh } from '../src/locales.js';

let registration;
window.__ModuleLoader__ = { load(plugin) { registration = plugin; } };
const fixture = createHostFixture(window);
const desktopUpdate = source({ presentation: { phase: 'idle' }, failed: false, opening: false });
const previewQuery = new URLSearchParams(location.search);
if (previewQuery.has('settings')) document.documentElement.dataset.previewSettings = '';
if (previewQuery.has('conversation')) document.documentElement.dataset.previewConversation = '';
if (previewQuery.get('lang')) document.documentElement.lang = previewQuery.get('lang');
const selectorHook = source => selector => React.useSyncExternalStore(source.subscribe,
  () => selector(source.getSnapshot()));
const translate = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) =>
  text.replaceAll('{' + name + '}', String(value)), (document.documentElement.lang === 'en' ? en : zh)[key] ?? key);

function PreviewConversation() {
  const sessions = React.useSyncExternalStore(fixture.sessions.subscribe, fixture.sessions.getSnapshot);
  const [scopeId, setScopeId] = React.useState(null);
  React.useEffect(() => { window.inboxDemo.setNoticeSession = setScopeId; }, []);
  const id = scopeId ?? Object.values(sessions.byId).find(item => item.retainedBy?.mainView > 0)?.id;
  const entry = fixture.winner('conversation.input.dock');
  const injected = entry.inject(id);
  const Notice = entry.component;
  return <section className="preview-conversation" aria-label="会话预览">
    <header>{sessions.byId[id]?.displayTitle || '新建会话'}</header>
    <div className="preview-conversation-scroll" data-conversation-scroll="">
      <article><p>本次会话已结束，可以随时继续。</p></article>
      <div className="preview-composer-seat" data-composer-seat="">
        <div className="preview-composer-stack">
          <div data-slot="conversation.input.dock" style={{ display: 'contents' }}>
            <Notice sessionId={id} actions={injected.actions} useInbox={selectorHook(injected.hooks.inbox)} useSidebarPreferences={selectorHook(injected.hooks.sidebarPreferences)} t={translate} />
          </div>
          <div className="preview-composer-bar">
            <textarea key={id} aria-label="消息" placeholder="发消息或创建任务" />
            <div><span>工作区内修改</span><span>DeepSeek</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function PreviewSidebarSettings() {
  const entry = fixture.winner('settings.section');
  const Page = entry.component, props = entry.inject();
  return <aside className="preview-settings-panel" aria-label="设置预览"><Page {...props} useSidebarPreferences={selectorHook(props.hooks.sidebarPreferences)} t={translate}/></aside>;
}

function FixtureIcon({ type }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    {type === 'clock' ? <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>
      : type === 'collapse' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m6-11-3 3 3 3" /></>
        : type === 'more' ? <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>
          : <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
  </svg>;
}

function App() {
  const [wide, setWide] = React.useState(true);
  const entry = fixture.winner();
  const injected = entry.inject();
  const Component = entry.component;
  const BrandName = fixture.winner('sidebar.brand.name').component;
  const dictionary = document.documentElement.lang === 'en' ? en : zh;
  const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) =>
    text.replaceAll('{' + name + '}', String(value)), dictionary[key] ?? key);
  React.useEffect(() => { window.inboxDemo.setWide = setWide; }, []);
  return <><div data-slot="sidebar">
    <div className={'preview-native-root' + (wide ? '' : ' preview-rail')}>
      <div className="preview-native-caption" data-window-drag="true">
        <span className="preview-window-controls" aria-hidden="true"><i /><i /><i /></span>
        <button type="button" data-sidebar-toggle="true" aria-label="Toggle sidebar" onClick={() => setWide(!wide)}>
          <FixtureIcon type="collapse" />
          <NativeUpdateBadgePreview wide={wide} source={desktopUpdate} />
        </button>
      </div>
      <div className="preview-native-brand" data-window-drag="true">
        <span className="preview-brand">
        <span className="preview-brand-identity">
        <span data-slot="sidebar.brand.mark" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9c4 3 6-4 11-2 2 1 2 3 3 3l4-3-1 6c-1 5-6 7-11 5-4-1-6-4-6-9Zm7 4 2 3 2-2-4-1Z" />
          </svg>
        </span>
        <span data-slot="sidebar.brand.name"><BrandName /></span>
        </span>
        </span>
      </div>
      <button className="preview-new" type="button" aria-label="新建会话"
        onClick={() => injected.actions.start()}>新建会话</button>
      <nav className="preview-native-panels" aria-label="全局面板">
        <button type="button" aria-label="插件" onClick={() => fixture.ctx.layout.panelInfo.set({ activePanelId: 'plugins' })}>
          <span aria-hidden="true"><FixtureIcon type="plugins" /></span><span>插件</span>
        </button>
        <button type="button" aria-label="自动化任务" onClick={() => fixture.ctx.layout.panelInfo.set({ activePanelId: 'schedules' })}>
          <span aria-hidden="true"><FixtureIcon type="clock" /></span><span>自动化任务</span>
        </button>
        <div><button type="button" aria-label="更多" aria-haspopup="menu"
          onClick={() => { window.inboxDemo.moreOpened = true; }}>
          <span aria-hidden="true"><FixtureIcon type="more" /></span><span>更多</span>
        </button></div>
      </nav>
      <div className="preview-native-browser">
        <div data-slot="sidebar.workspaces" style={{ display: 'contents' }}>
          <Component wide={wide} expandSidebar={() => setWide(true)} actions={injected.actions} t={t}
            useInbox={selectorHook(injected.hooks.inbox)} useSidebarPreferences={selectorHook(injected.hooks.sidebarPreferences)}
            useNativeShortcuts={selectorHook(injected.hooks.nativeShortcuts)} useRemoteAccess={() => true} />
        </div>
      </div>
      <div className="preview-native-foot">
        <div><div data-slot="sidebar.footer.action" style={{ display: 'contents' }} /></div>
        <div><div data-slot="sidebar.settings" style={{ display: 'contents' }}>
        <div className="preview-settings-trigger-row"><div data-slot="settings.launcher" style={{ display: 'contents' }}>
        <button type="button" aria-label="账号菜单" onClick={() => { window.inboxDemo.accountOpened = true; }}>
          <span className="preview-avatar">D</span><span>示例账号</span>
        </button></div>
          <NativeConnectionPreview source={desktopUpdate} />
          <NativeUpdatePreview wide={wide} source={desktopUpdate}
            onOpen={() => { window.inboxDemo.updateOpenCount++; }} />
        </div></div></div>
      </div>
    </div>
  </div>{previewQuery.has('conversation') && <PreviewConversation />}{previewQuery.has('settings') && <PreviewSidebarSettings />}</>;
}

import('../lib/client.js').then(async () => {
  registration.factory((id) => {
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return nativePrimitives(React);
    if (id === 'react-dom') return ReactDOM;
    if (id === 'react/jsx-runtime') return JSXRuntime;
    if (id !== 'react') throw new Error('Unexpected module request: ' + id);
    return React;
  }).apply(fixture.ctx);
  const { actions, hooks } = fixture.winner().inject();
  await actions.snooze('later', Date.now() + 3_600_000, []);
  await actions.settle('old', []);
  const states = new Map(fixture.status.getSnapshot());
  states.set('result', { running: true });
  fixture.status.set(states);
  fixture.finish('result');
  actions.dismissUndo();
  window.inboxDemo = { fixture, actions, hooks, desktopUpdate, updateOpenCount: 0,
    search() {
      const state = fixture.shortcutState.getSnapshot();
      fixture.shortcutState.set({ ...state, searchRequest: state.searchRequest + 1 });
    },
  };
  createRoot(document.getElementById('preview')).render(<App />);
  window.addEventListener('pagehide', () => fixture.dispose(), { once: true });
});
