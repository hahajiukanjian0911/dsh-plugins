import React from 'react';
import { createRoot } from 'react-dom/client';
import { createSidebarSettings } from '../../../src/settings.jsx';
import settingsCSS from '../../../src/settings.css';
import { zh, en } from '../../../src/locales.js';

const P = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'];
const host = key => globalThis.__settingsHost['dsh-client-' + key];
const general = host('ui-settings-general'), theme = host('ui-theme'), locale = host('locale');
const account = host('ui-settings-account');
const models = host('ui-settings-models'), plugins = host('ui-settings-plugins');
const query = new URLSearchParams(location.search), lang = query.get('lang') === 'en' ? 'en' : 'zh';
const tr = dict => (key, values = {}) => Object.entries(values).reduce((text, [k, v]) => text.replaceAll('{' + k + '}', String(v)), dict[key] ?? key);
const t = module => tr(module[lang]);
const media = matchMedia('(prefers-color-scheme:dark)');
const appearance = () => document.body.toggleAttribute('data-ds-dark-theme', media.matches);
appearance(); media.addEventListener('change', appearance);
document.documentElement.lang = lang;
const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
sprite.setAttribute('aria-hidden', 'true'); sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
for (const [id, source] of Object.entries(P.ICON_SYMBOLS)) {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const symbol = document.createElementNS(svg.namespaceURI, 'symbol'); symbol.id = id;
  for (const attr of svg.attributes) if (attr.name !== 'xmlns') symbol.setAttribute(attr.name, attr.value);
  while (svg.firstChild) symbol.append(svg.firstChild); sprite.append(symbol);
}
document.body.prepend(sprite);
window.setSettingsPolish = mode => {
  window.__polishEffects.splice(0).reverse().forEach(dispose => dispose?.());
  if (mode !== 'none') (mode === 'before' ? window.__beforePolish : window.__afterPolish)().apply({ effect(fn) { window.__polishEffects.push(fn()); } });
};
window.setSettingsPolish(query.get('polish') || 'after');
const defaults = { density: 'comfortable', sessionTooltips: true, settledNotice: true, settledExpanded: false, snoozedExpanded: false, listMotion: true };
const SidebarSettings = createSidebarSettings(React, P, settingsCSS);

function App() {
  const [activeId, setActiveId] = React.useState(query.get('section') || 'general');
  const [open, setOpen] = React.useState(true), [fonts, setFonts] = React.useState({ fontSizes: { text: 16, code: 13, terminal: 20 }, fontFamilies: { text: '', code: 'Menlo', terminal: '' }, preference: 'system' });
  const [language, setLanguage] = React.useState('zh'), [dev, setDev] = React.useState(false), [prefs, setPrefs] = React.useState(defaults);
  const [modelState, setModelState] = React.useState('ready');
  window.settingsDemo = { open: () => setOpen(true), select: setActiveId, setModelState, fonts, prefs };
  const rows = [
    { id: 'account', label: t(account)('nav') },
    { id: 'general', label: t(general)('general.nav') },
    { id: 'models', label: t(models)('title') },
    { id: 'plugins', label: t(plugins)('title') },
    { id: 'dsh-session-sidebar', label: (lang === 'en' ? en : zh).settingsTitle },
  ];
  const generalItems = <>
    <theme.AppearanceRow t={t(theme)} useStore={select => select(fonts)} setTheme={preference => setFonts(value => ({ ...value, preference }))} />
    <locale.LanguageRow t={t(locale)} useStore={select => select({ active: language, options: [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }] })} setLocale={setLanguage} />
    <theme.FontSettingsGroup t={t(theme)} useStore={select => select(fonts)} setFontFamily={(role, value) => setFonts(previous => ({ ...previous, fontFamilies: { ...previous.fontFamilies, [role]: value } }))}
      setFontSize={(role, value) => setFonts(previous => ({ ...previous, fontSizes: { ...previous.fontSizes, [role]: value } }))} />
    <general.DeveloperToolsRow t={t(general)} useDeveloperTools={select => select(dev)} setEnabled={async value => setDev(value)} />
    <general.CurrentVersionRow t={t(general)} />
  </>;
  const renderSlot = (name, props, options) => {
    if (name === 'settings.header') return t(general)('title');
    if (name === 'settings.close') return t(general)('close');
    if (name === 'settings.section.icon') return options.fallback;
    if (name === 'settings.action') return <P.Button size="sm" variant="text">{t(general)('openDocument')}</P.Button>;
    if (name === 'settings.section') return <div data-slot={name} style={{ display: 'contents' }}>
      {options.only === 'account' && <account.AccountSection t={t(account)} useAccount={select => select({ view: { status: 'signed-out' } })}
        useTheme={select => select({ active: { colorScheme: media.matches ? 'dark' : 'light' } })} start={async () => {}} cancel={() => {}} avatarFailed={() => {}} />}
      {options.only === 'general' && <general.GeneralSection renderSlot={name => name === 'settings.general.item' ? <div data-slot={name} style={{ display: 'contents' }}>{generalItems}</div> : null} />}
      {options.only === 'models' && <models.ModelsSection controller={{ load: async () => setModelState('ready') }} useSnapshot={select => select({ status: modelState, rows: [], namespaces: new Map(), error: '预览连接失败' })} operations={{}} schema={{}} t={t(models)} renderSlot={() => null} />}
      {options.only === 'plugins' && <plugins.PluginsSettingsSection t={t(plugins)} useTabs={select => select([])} renderSlot={() => null} />}
      {options.only === 'dsh-session-sidebar' && <SidebarSettings useSidebarPreferences={select => select({ value: prefs })} t={tr(lang === 'en' ? en : zh)} setPreference={(key, value) => setPrefs(previous => ({ ...previous, [key]: value }))} resetPreferences={() => setPrefs(defaults)} />}
    </div>;
    return null;
  };
  return open ? <general.SettingsPanel rows={rows} renderSlot={renderSlot} activeId={activeId} onSelect={setActiveId} onClose={() => setOpen(false)} /> : <P.Button onClick={() => setOpen(true)}>{t(general)('title')}</P.Button>;
}
createRoot(document.getElementById('settings-preview')).render(<App />);
