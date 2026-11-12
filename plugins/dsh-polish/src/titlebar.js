// The host keeps all window controls and their callbacks. The overlay adds only
// the native brand and a drag rectangle that stays clear of interactive seats.
export function attachTitlebarControls(node, view) {
  const frame = node?.closest('.PIRFFq_frame');
  if (!frame) return () => {};
  const doc = frame.ownerDocument;
  let lastFocused = doc.activeElement, disposed = false;
  const focusChanged = event => { lastFocused = event.target; };
  doc.addEventListener('focusin', focusChanged, true);
  const observer = new view.MutationObserver(() => {
    if (disposed || !frame.isConnected) return;
    if (!lastFocused?.matches?.('[data-sidebar-toggle],[data-sidebar-opener]')) return;
    const active = doc.activeElement;
    // Hiding/unmounting the previous owner can put focus on body. A focused
    // editor or another control must never be displaced by sidebar changes.
    if (active !== lastFocused && active !== doc.body && active !== null) return;
    const selector = frame.hasAttribute('data-sidebar-collapsed')
      ? '[data-shell-leading] [data-sidebar-opener]'
      : '[data-slot="sidebar"] [data-sidebar-toggle]';
    const next = frame.querySelector(selector);
    if (next && next !== lastFocused && !next.closest('[inert]')) next.focus({ preventScroll: true });
  });
  observer.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-drawer'] });
  return () => {
    disposed = true;
    observer.disconnect();
    doc.removeEventListener('focusin', focusChanged, true);
  };
}

export function installTitlebar(ctx, React, P) {
  if (typeof ctx.inject !== 'function') return;
  function Titlebar() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => attachTitlebarControls(ref.current, window), []);
    if (document.documentElement.dataset.platform !== 'darwin') return null;
    return React.createElement('div', { ref, 'data-dsp-titlebar': '', 'aria-hidden': true },
      React.createElement('span', { 'data-dsp-titlebar-brand': '' },
        React.createElement(P.BrandWordmark, { includeMark: true })),
      React.createElement('div', { 'data-dsp-titlebar-drag': '', 'data-window-drag': true }));
  }
  ctx.inject(['slots'], scope => scope.slots.inject('shell.overlay', () => scope.slots.register({
    name: 'shell.overlay', id: 'dsh-polish-titlebar', order: -100,
  }, Titlebar)));
}
