// Placement only: native menus retain their content, material, focus and callbacks.
// Owned CSS variables override (rather than mutate) the host's live coordinates,
// so disabling Polish immediately returns positioning to the native component.
export function mountDropdowns(doc, win) {
  if (!doc.body || !win.MutationObserver || !doc.querySelectorAll) return () => {};
  const selectors = {
    project: '[data-dpm-project-anchor], [class*="_heroWorkspaceRow"] > button[aria-haspopup="menu"]',
    commands: '[data-composer-card] button[aria-haspopup="listbox"]',
    permission: '[data-composer-card] [data-slot="conversation.input.permission"] button',
    presets: '[data-dsp-composer-mode] button, [data-slot="conversation.hero.agentPreset"] button',
    model: '[data-composer-card] [data-slot="conversation.input.model"] button',
    worktree: '.dsp-worktree-trigger',
  };
  const selector = Object.values(selectors).join(', ');
  const records = new Map();
  const properties = ['left', 'top', 'max-width', 'max-height', 'width'];
  let recent = null, frame = 0, disposed = false;
  const visible = node => node?.isConnected && node.getBoundingClientRect().width > 0;
  const variable = (node, name, value) => {
    const key = '--dsp-dropdown-' + name;
    if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  };
  function capture(event) {
    if (event.type === 'keydown' && !['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const trigger = event.target.closest?.(selector);
    recent = trigger ? { trigger, kind: Object.keys(selectors).find(key => trigger.matches(selectors[key])), at: win.performance.now() } : null;
  }
  function anchorFor(panel) {
    if (panel.parentElement?.closest('[data-menu-material]')) return null;
    let kind = panel.matches('[data-trigger-menu]') ? 'commands'
      : panel.matches('.htuFrW_menu') ? 'model'
      : panel.querySelector('.dpm-composer-option') ? 'project'
      : panel.querySelector('.ufIuna_item') ? 'presets' : null;
    const current = recent && win.performance.now() - recent.at < 1000 && visible(recent.trigger) ? recent : null;
    if (current && (!kind || current.kind === kind)) return current;
    // A slash/mention result list belongs to the text caret, not the plus button.
    if (kind === 'commands' || !kind) return null;
    const trigger = [...doc.querySelectorAll(selectors[kind])].find(node => visible(node) && node.getAttribute('aria-expanded') === 'true');
    return trigger ? { trigger, kind } : null;
  }
  function active(record, enabled) {
    if (enabled) { if (!record.trigger.hasAttribute('data-dsp-dropdown-active')) record.trigger.setAttribute('data-dsp-dropdown-active', ''); }
    else if (![...records.values()].some(other => other !== record && other.trigger === record.trigger && !other.closing)) record.trigger.removeAttribute('data-dsp-dropdown-active');
  }
  function release(panel, record) {
    records.delete(panel);
    record.observer?.disconnect();
    panel.removeAttribute('data-dsp-dropdown');
    panel.removeAttribute('data-dsp-dropdown-side');
    for (const name of properties) panel.style.removeProperty('--dsp-dropdown-' + name);
    active(record, false);
  }
  function place(panel, record) {
    if (!visible(panel) || !visible(record.trigger)) return;
    const viewport = win.visualViewport;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? win.innerWidth, height = viewport?.height ?? win.innerHeight;
    const margin = 12, gap = 8;
    variable(panel, 'max-width', Math.max(0, width - margin * 2) + 'px');
    const anchor = record.trigger.getBoundingClientRect();
    const card = record.kind === 'commands' ? record.trigger.closest('[data-composer-card]')?.getBoundingClientRect() : null;
    if (card) variable(panel, 'width', Math.min(card.width, width - margin * 2) + 'px');
    const above = Math.max(0, Math.min(height - margin * 2, anchor.top - y - margin - gap));
    const below = Math.max(0, Math.min(height - margin * 2, y + height - margin - anchor.bottom - gap));
    const scroller = [...panel.querySelectorAll('[class*="_viewport"], .htuFrW_groups')]
      .find(node => node.closest('[data-menu-material]') === panel);
    const natural = scroller ? panel.offsetHeight - scroller.clientHeight + scroller.scrollHeight
      : panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
    const desired = Math.min(400, natural);
    const side = above >= desired || above >= below ? 'top' : 'bottom';
    const available = side === 'top' ? above : below;
    variable(panel, 'max-height', Math.min(400, available) + 'px');
    const rect = panel.getBoundingClientRect(), style = win.getComputedStyle(panel);
    // An inline command menu can have a transformed containing block. Subtract
    // its current origin without moving the native DOM node or its backing.
    const originX = rect.left - (parseFloat(style.left) || 0);
    const originY = rect.top - (parseFloat(style.top) || 0);
    const aligned = card ? card.left : record.kind === 'model' ? anchor.right - rect.width : anchor.left;
    const left = Math.max(x + margin, Math.min(aligned, x + width - margin - rect.width));
    const alignedTop = side === 'top' ? anchor.top - gap - rect.height : anchor.bottom + gap;
    const top = Math.max(y + margin, Math.min(alignedTop, y + height - margin - rect.height));
    // Blink lays out at 1/64 CSS px. Decimal rounding at 0.01px feeds its
    // quantization error back into the next origin measurement and can jitter.
    variable(panel, 'left', Math.round((left - originX) * 64) / 64 + 'px');
    variable(panel, 'top', Math.round((top - originY) * 64) / 64 + 'px');
    if (panel.getAttribute('data-dsp-dropdown-side') !== side) panel.setAttribute('data-dsp-dropdown-side', side);
  }
  function update() {
    if (disposed) return;
    for (const [panel, record] of records) {
      if (!panel.isConnected || !record.trigger.isConnected) { release(panel, record); continue; }
      record.closing = ['dismiss', 'replace'].includes(panel.getAttribute('data-menu-phase'));
      active(record, !record.closing);
      place(panel, record);
    }
    // Native hooks also follow moving anchors. Only watch frames while a menu
    // is open; never leave a permanent polling loop after dismissal or unload.
    if (records.size && !frame) frame = win.requestAnimationFrame(() => { frame = 0; update(); });
  }
  function scan() {
    if (disposed) return;
    for (const panel of doc.querySelectorAll('[data-menu-material]')) {
      if (records.has(panel)) continue;
      const anchor = anchorFor(panel);
      if (!anchor) continue;
      const record = { ...anchor, observer: null, closing: false };
      records.set(panel, record);
      variable(panel, 'left', '0px'); variable(panel, 'top', '0px');
      panel.setAttribute('data-dsp-dropdown', record.kind);
      if (win.ResizeObserver) {
        record.observer = new win.ResizeObserver(update);
        record.observer.observe(panel); record.observer.observe(record.trigger);
      }
    }
    update();
  }
  const observer = new win.MutationObserver(scan);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'data-menu-phase'] });
  doc.addEventListener('pointerdown', capture, true);
  doc.addEventListener('keydown', capture, true);
  win.addEventListener('resize', update);
  doc.addEventListener('scroll', update, true);
  win.visualViewport?.addEventListener('resize', update);
  win.visualViewport?.addEventListener('scroll', update);
  scan();
  return () => {
    disposed = true;
    observer.disconnect();
    win.cancelAnimationFrame(frame);
    doc.removeEventListener('pointerdown', capture, true);
    doc.removeEventListener('keydown', capture, true);
    win.removeEventListener('resize', update);
    doc.removeEventListener('scroll', update, true);
    win.visualViewport?.removeEventListener('resize', update);
    win.visualViewport?.removeEventListener('scroll', update);
    for (const [panel, record] of records) release(panel, record);
  };
}
