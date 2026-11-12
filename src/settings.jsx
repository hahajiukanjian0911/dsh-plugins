export function createSidebarSettings(React, { Switch, Button }, stylesheet) {
  function Row({ label, hint, children }) {
    return <div className="dsi-settings-row"><div className="dsi-settings-copy">
      <div className="dsi-settings-label">{label}</div>
      {hint && <p className="dsi-settings-hint">{hint}</p>}
    </div><div className="dsi-settings-control">{children}</div></div>;
  }
  return function SidebarSettings({ useSidebarPreferences, setPreference, resetPreferences, t }) {
    const { value, error } = useSidebarPreferences(state => state);
    const id = React.useId();
    const toggle = (key, label, hint) => <Row key={key} label={t(label)} hint={hint && t(hint)}>
      <Switch checked={value[key]} label={t(label)} onChange={next => setPreference(key, next)} />
    </Row>;
    return <section className="dsi-settings" aria-labelledby={id}>
      <style>{stylesheet}</style>
      <header><h2 id={id}>{t('settingsTitle')}</h2><p>{t('settingsDescription')}</p></header>
      {error && <p className="dsi-settings-error" role="alert">{t('settingsSaveFailed', { message: error })}</p>}
      <section aria-labelledby={id + '-display'}><h3 id={id + '-display'}>{t('settingsDisplay')}</h3>
        <Row label={t('settingsDensity')} hint={t('settingsDensityHint')}>
          <select className="dsi-density-select" aria-label={t('settingsDensity')} value={value.density}
            onChange={event => setPreference('density', event.target.value)}>
            <option value="comfortable">{t('settingsComfortable')}</option>
            <option value="compact">{t('settingsCompact')}</option>
          </select>
        </Row>
        {toggle('sessionTooltips', 'settingsTooltips')}
        {toggle('settledNotice', 'settingsSettledNotice', 'settingsSettledNoticeHint')}
      </section>
      <section aria-labelledby={id + '-behavior'}><h3 id={id + '-behavior'}>{t('settingsBehavior')}</h3>
        {toggle('listMotion', 'settingsListMotion', 'settingsListMotionHint')}
      </section>
      <footer><Button variant="outline" size="sm" onClick={resetPreferences}>{t('settingsReset')}</Button></footer>
    </section>;
  };
}
