// Keep native avatar loading and account notices; activate Settings directly.
export function installAvatarLauncher(ctx, React) {
  function AvatarOnlyLauncher({ nativeAccountLauncher, openSettings, settingsOpen, t, ...props }) {
    const root = React.useRef(null);
    // AccountMenu has no direct-settings prop. Adapt its public trigger markup
    // without replacing its avatar, account subscriptions or notice surfaces.
    React.useLayoutEffect(() => {
      const trigger = root.current?.querySelector('button[data-collapsed][aria-haspopup]');
      if (!trigger) return;
      trigger.setAttribute('aria-label', t('settings'));
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', String(!!settingsOpen));
    }, [settingsOpen, t]);
    function activate(event) {
      // Native account notices use portals: their actions must remain their own.
      if (!root.current?.contains(event.target)) return;
      const trigger = event.target.closest?.('button[data-collapsed][aria-haspopup]');
      if (!trigger || trigger.disabled) return;
      event.preventDefault(); event.stopPropagation(); openSettings();
    }
    return React.createElement('div', { ref: root, style: { display: 'contents' }, onClickCapture: activate },
      React.createElement(nativeAccountLauncher, { ...props, openSettings, settingsOpen, t, wide: false }));
  }
  ctx.slots.inject('settings.launcher', () => ctx.effect(() => {
    let original;
    let disposeEntry;
    let installing = false;
    function install() {
      if (installing) return;
      const next = ctx.slots.entries('settings.launcher').find(entry => entry.component !== AvatarOnlyLauncher);
      if (next === original) return;
      installing = true;
      try {
        disposeEntry?.(); disposeEntry = undefined; original = next;
        if (!next) return;
        disposeEntry = ctx.slots.register({
          name: 'settings.launcher', priority: -100,
          locale: next.locale ?? next.options?.locale,
          ...(next.store ? { store: next.store } : {}),
          inject: (...args) => ({ ...next.inject?.(...args), nativeAccountLauncher: next.component }),
        }, AvatarOnlyLauncher);
      } finally { installing = false; }
    }
    const unsubscribe = ctx.slots.subscribe('settings.launcher', install);
    install();
    return () => { unsubscribe(); disposeEntry?.(); };
  }, 'inbox-sidebar: avatar-only account launcher'));
}
