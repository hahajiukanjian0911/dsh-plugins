import React from 'react';
import { createRoot } from 'react-dom/client';
import { createHostFixture, source } from '../tests/host-fixture.js';
import { seedSidebarDemo } from './sidebar-demo-data.js';
import { zh, en } from '../src/locales.js';
import { createPlugin as createProjectPlugin } from '../plugins/dsh-project-manager/src/client.mjs';
import { installProjectManagerFixture } from '../tests/project-manager-fixture.js';
import { renderComposerPreview } from './composer-preview.jsx';
import { installNativeRegistry } from '../tests/native-registry-fixture.jsx';
import { renderGlassPreview } from './glass-preview.jsx';

const fixture = createHostFixture(window);
const params = new URLSearchParams(location.search);
if (params.has('composer') && params.has('assembly')) installNativeRegistry(fixture);
const projectDemo = params.has('projects') || params.has('composer') ? installProjectManagerFixture(fixture) : null;
if (projectDemo && params.has('composer')) {
  fixture.projectLoadUnavailable = params.has('project-error');
  const call = fixture.ctx.connection.rpc.call;
  fixture.ctx.connection.rpc.call = (...args) => {
    if (fixture.projectLoadUnavailable && args[1] === 'projectManager/load') throw new Error('示例项目服务暂不可用');
    return call(...args);
  };
}
if (projectDemo) {
  const require = id => globalThis.__DSH_NATIVE_MODULES__[id];
  const plugin = params.has('assembly') ? window.__projectManagerFactory(require) : createProjectPlugin(require);
  plugin.apply(fixture.ctx);
}
const { AccountMenu, zh: accountZh, en: accountEn } = globalThis.__DSH_NATIVE_ACCOUNT__;
const account = source({ view: { status: 'credential-stored' }, details: { profile: { status: 'ready', value: { name: '示例账号' } } } });
fixture.ctx.slots.register({ name: 'settings.launcher', priority: 0, locale: 'settings.account',
  inject: () => ({ hooks: { account }, refreshAccount() {}, signOut: async () => {}, hasRunningAccountTasks: async () => 'none',
    contactUs() { window.inboxDemo.feedbackOpened++; }, bonusNoticeShown() {}, bonusNoticeDismissed() {},
    showLogin() {}, start: async () => {}, cancel() {}, avatarFailed() {} }) }, AccountMenu);
window.__inboxFactory(id => globalThis.__DSH_NATIVE_MODULES__[id]).apply(fixture.ctx);
const { actions, hooks } = fixture.winner().inject();
const { SidebarRoot, HeaderLeadingControls, zh: nativeZh, en: nativeEn } = globalThis.__DSH_NATIVE_SIDEBAR__;
const { AppFrame } = globalThis.__DSH_NATIVE_LAYOUT__;
// The renderer normally mounts this sprite; the isolated preview mounts the
// installed symbols verbatim, so <use> icons render exactly like the host.
const svgNS = 'http://www.w3.org/2000/svg', sprite = document.createElementNS(svgNS, 'svg');
sprite.setAttribute('aria-hidden', 'true'); sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
for (const [id, source] of Object.entries(globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'].ICON_SYMBOLS)) {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement, symbol = document.createElementNS(svgNS, 'symbol');
  symbol.id = id; for (const attr of svg.attributes) if (attr.name !== 'xmlns') symbol.setAttribute(attr.name, attr.value);
  while (svg.firstChild) symbol.append(svg.firstChild); sprite.append(symbol);
}
document.body.prepend(sprite);
const framePreview = params.has('frame');
document.documentElement.toggleAttribute('data-preview-frame', framePreview);
const frameStore = source({ layoutInfo: { viewportWidth: innerWidth, sidebar: 320, narrowExpanded: true, rightbarShown: false, rightbarTrack: false } });
const updateLayout = change => frameStore.set({ layoutInfo: { ...frameStore.getSnapshot().layoutInfo, ...change } });
const frameActions = {
  setViewportWidth(viewportWidth) { if (viewportWidth !== frameStore.getSnapshot().layoutInfo.viewportWidth) updateLayout({ viewportWidth }); },
  toggleSidebar() { const layout = frameStore.getSnapshot().layoutInfo; updateLayout({ sidebar: layout.sidebar ? 0 : 320, narrowExpanded: !layout.narrowExpanded }); },
  setSidebar(sidebar) { updateLayout({ sidebar }); }, setRightbar(rightbar) { updateLayout({ rightbar }); },
};
const lang = params.get('lang') === 'en' ? 'en' : 'zh'; document.documentElement.lang = lang;
const media = matchMedia('(prefers-color-scheme:dark)');
function setAppearance() { document.body.toggleAttribute('data-ds-dark-theme', media.matches); }
setAppearance(); media.addEventListener('change', setAppearance);
const translate = dictionary => (key, values = {}) => Object.entries(values).reduce((s, [key, value]) => s.replaceAll('{' + key + '}', String(value)), dictionary[key] || key);
const t = translate(lang === 'en' ? en : zh), nativeT = translate(lang === 'en' ? nativeEn : nativeZh);
const accountT = translate(lang === 'en' ? accountEn : accountZh);
const { EntryMenuContent, zh: entryMenuZh, en: entryMenuEn } = globalThis.__DSH_NATIVE_ENTRY_MENU__;
const entryMenuT = translate(lang === 'en' ? entryMenuEn : entryMenuZh);
const selectorHook = source => selector => React.useSyncExternalStore(source.subscribe, () => selector(source.getSnapshot()));
const panelRows = [{ id: 'plugins', label: '插件', order: 0 }, { id: 'schedules', label: '自动化任务', order: 1 }];

function App() {
  const [wide, setWide] = React.useState(true), [settingsOpen, setSettingsOpen] = React.useState(false);
  const entry = fixture.winner(), Sidebar = entry.component;
  React.useEffect(() => { window.inboxDemo.setWide = setWide; }, []);
  const slot = (name, props, options) => {
    const P = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'];
    if (name === 'sidebar') return <div data-slot="sidebar">{renderSidebar(props)}</div>;
    if (name === 'shell.leading') return <div data-slot="shell.leading" style={{ display: 'contents' }}><HeaderLeadingControls
      toggleSidebar={frameActions.toggleSidebar} startSession={() => actions.start()} trackEntryClick={() => {}}
      useRemoteAccess={() => true} useShortcuts={select => select([{ id:'session.new', keys:['⌘','N'], aria:'Meta+N' }])} t={nativeT} /></div>;
    if (name === 'sidebar.panellist') return React.createElement(options.only === 'plugins' ? P.IconPluginPinwheelOutlineRegular : P.IconClockOutlineRegular, { size: props.size });
    if (name === 'sidebar.panellist.actions') return <EntryMenuContent {...props} region="sidebar" usePluginNavigation={select => select(true)}
      browsePlugins={() => { window.inboxDemo.browsePluginsOpened++; fixture.ctx.layout.panelInfo.set({ activePanelId: 'plugins' }); }}
      createPlugin={() => { window.inboxDemo.createPluginOpened++; }} t={entryMenuT} />;
    if (name === 'sidebar.brand.name') return <span data-slot={name} style={{ display:'contents' }}><P.BrandWordmark includeMark={false} /></span>;
    if (name === 'sidebar.workspaces') return <div data-slot={name} style={{ display: 'contents' }}><Sidebar {...props}
      actions={actions} t={t} useInbox={selectorHook(hooks.inbox)} useSidebarPreferences={selectorHook(hooks.sidebarPreferences)} useProjectCatalog={selectorHook(hooks.projectCatalog)}
      useNativeShortcuts={selectorHook(hooks.nativeShortcuts)} useRemoteAccess={action => !window.inboxDemo.denied.has('global:' + action)} useSessionAccess={(id, action) => !window.inboxDemo.denied.has(id + ':' + action)} /></div>;
    if (name === 'sidebar.settings') {
      const launcher = fixture.winner('settings.launcher'), Launcher = launcher.component, injected = launcher.inject();
      return <div data-slot="sidebar.settings"><div style={{ display: 'flex', alignItems: 'center' }}><div data-slot="settings.launcher" style={{ display: 'contents' }}>
        <Launcher {...injected} wide={props.wide} settingsOpen={settingsOpen} t={accountT} useAccount={selectorHook(account)}
          useTheme={select => select({ active: { colorScheme: media.matches ? 'dark' : 'light' } })}
          openSettings={() => { window.inboxDemo.settingsOpened++; setSettingsOpen(true); }} openOnboarding={() => {}} />
      </div></div></div>;
    }
    return options?.fallback || null;
  };
  const settings = fixture.winner('settings.section'), Settings = settings.component, settingsProps = settings.inject();
  const settingsHooks = Object.fromEntries(Object.entries(settingsProps.hooks).map(([name, source]) => ['use' + name[0].toUpperCase() + name.slice(1), selectorHook(source)]));
  const renderSidebar = props => <SidebarRoot {...props}
    startSession={() => actions.start()} toggleSidebar={framePreview ? frameActions.toggleSidebar : () => setWide(value => !value)} selectPanel={id => fixture.ctx.layout.panelInfo.set({ activePanelId: id })}
    setPinned={() => {}} trackEntryClick={() => {}} useRemoteAccess={() => true} usePanels={select => select(panelRows)}
    useEntryPins={select => select([])} useEntryActions={select => select(true)} useShortcuts={select => select([{ id:'session.new', keys:['⌘','N'], aria:'Meta+N' }])}
    usePanelInfo={selectorHook(fixture.ctx.layout.panelInfo)} t={nativeT} renderSlot={slot} />;
  return <>{framePreview ? <AppFrame useStore={selectorHook(frameStore)} useSessions={selectorHook(fixture.sessions)}
    usePanelInfo={selectorHook(fixture.ctx.layout.panelInfo)} useFoldedLandscape={select => select(false)}
    actions={frameActions} renderSlot={slot} t={nativeT} /> : <div data-slot="sidebar">{renderSidebar({ collapsed:!wide, width:Math.min(320, innerWidth), drawer:false })}</div>}
    {params.has('settings') && <section className="native-preview-settings"><Settings {...settingsProps} {...settingsHooks} t={t} /></section>}
    {settingsOpen && React.createElement(globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'].Modal, {
      open: true, onClose: () => setSettingsOpen(false), title: accountT('settings'), closeLabel: t('close'),
    }, <Settings {...settingsProps} {...settingsHooks} t={t} />)}</>;
}

async function start() {
  if (params.has('glass')) { renderGlassPreview(); return; }
  if (params.has('composer')) { renderComposerPreview(fixture, projectDemo); return; }
  await actions.snooze('later', Date.now() + 3600000, []); await actions.settle('old', []);
  const states = new Map(fixture.status.getSnapshot()); states.set('result', { running: true }); fixture.status.set(states); fixture.finish('result'); actions.dismissUndo();
  window.inboxDemo = { fixture, actions, hooks, account, projectDemo, settingsOpened: 0, feedbackOpened: 0, browsePluginsOpened: 0, createPluginOpened: 0, denied: new Set(), search() {
    const state = fixture.shortcutState.getSnapshot(); fixture.shortcutState.set({ ...state, searchRequest: state.searchRequest + 1 });
  } };
  if (params.has('history') || params.has('active')) await seedSidebarDemo(fixture, actions, { history: Math.min(240, Math.max(0, Number(params.get('history')) || 0)), active: Math.min(240, Math.max(0, Number(params.get('active')) || 0)) });
  createRoot(document.getElementById('preview')).render(<App />);
  window.addEventListener('pagehide', () => { fixture.dispose(); media.removeEventListener('change', setAppearance); }, { once: true });
}
void start();
