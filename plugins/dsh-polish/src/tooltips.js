// 侧栏图标和截断的候选使用委托提示；其他原生 Tooltip 保留原交互。
export function mountTooltips(doc = document, win = window) {
  const selector = '[data-slot="sidebar"] > div:has(.dsi-root:not(.dsi-rail)) > nav button[aria-label], '
    + '.dsi-root .dsi-icon-button, .dsi-root .dsi-filter[title], '
    + '[data-composer-card] [data-slot="conversation.input.permission"] button, [data-dsp-composer-mode] button, '
    + '[data-trigger-menu] .z8WDjq_item';
  const id = 'dsh-polish-tooltip';
  let active;
  let bubble;
  let showTimer;
  let hideTimer;
  let pointerFocus = false;
  let warmGroup;
  let warmUntil = 0;
  const now = () => win.performance?.now?.() ?? Date.now();
  const groupFor = element => element.closest('[data-dsp-composer-layout], .dsi-toolbar, .dsi-row-actions, .dsi-project-filter, [data-slot="sidebar"] > div > nav');
  const labelFor = element => {
    if (element.matches('.z8WDjq_item')) {
      const parts = ['.z8WDjq_itemName', '.z8WDjq_itemAlias', '.z8WDjq_itemDescription'].map(selector => element.querySelector(selector));
      if (!parts.some(part => part && part.scrollWidth > part.clientWidth + 1)) return '';
      const [name, alias, description] = parts.map(part => part?.textContent?.trim() || '');
      return [alias ? `${name} (${alias})` : name, description].filter(Boolean).join('\n');
    }
    return element.querySelector('[class*="_triggerLabel"], [class*="_seatLabel"]')?.textContent?.trim()
      || element.getAttribute('title') || element.getAttribute('aria-label') || '';
  };
  const resetWarm = () => { warmGroup = undefined; warmUntil = 0; };
  const listeners = [];
  const listen = (target, type, callback, capture = false) => {
    target.addEventListener(type, callback, capture);
    listeners.push(() => target.removeEventListener(type, callback, capture));
  };
  const clearTimers = () => {
    win.clearTimeout(showTimer);
    win.clearTimeout(hideTimer);
    showTimer = hideTimer = undefined;
  };
  const hide = () => {
    clearTimers();
    if (active?.input === 'pointer' && active.element.isConnected && bubble && !bubble.hidden) {
      warmGroup = groupFor(active.element);
      warmUntil = now() + 300;
    }
    if (bubble) bubble.hidden = true;
    if (!active) return;
    const { element, title } = active;
    if (title !== null && !element.hasAttribute('title')) element.setAttribute('title', title);
    const descriptions = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id);
    if (descriptions.length) element.setAttribute('aria-describedby', descriptions.join(' '));
    else element.removeAttribute('aria-describedby');
    active = undefined;
  };
  const reset = () => { hide(); resetWarm(); };
  const show = () => {
    showTimer = undefined;
    if (!active?.element.isConnected || active.element.getAttribute('aria-expanded') === 'true') { hide(); return; }
    if (!bubble) {
      bubble = doc.createElement('div');
      bubble.id = id;
      bubble.dataset.dshPolishTooltip = '';
      bubble.setAttribute('role', 'tooltip');
      doc.body.appendChild(bubble);
    }
    bubble.toggleAttribute('data-polish-candidate', active.element.matches('.z8WDjq_item'));
    const label = active.element.matches('.z8WDjq_item') ? labelFor(active.element) : active.element.querySelector('[class*="_triggerLabel"], [class*="_seatLabel"]')?.textContent?.trim() || active.label;
    if (!label) { hide(); return; }
    bubble.textContent = label;
    bubble.hidden = false;
    bubble.style.visibility = 'hidden';
    const anchor = active.element.getBoundingClientRect();
    const box = bubble.getBoundingClientRect();
    const inset = 12;
    const clamp = (value, max) => Math.max(inset, Math.min(value, Math.max(inset, max)));
    const left = clamp((anchor.left + anchor.right - box.width) / 2, win.innerWidth - inset - box.width);
    const above = anchor.top - 8 - box.height;
    const side = above >= inset ? 'top' : 'bottom';
    const top = clamp(side === 'top' ? above : anchor.bottom + 8, win.innerHeight - inset - box.height);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.dataset.polishSide = side;
    bubble.style.visibility = 'visible';
    const descriptions = new Set((active.element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    descriptions.add(id);
    active.element.setAttribute('aria-describedby', [...descriptions].join(' '));
  };
  const begin = (element, immediate = false) => {
    if (!element || element.getAttribute('aria-expanded') === 'true') return;
    win.clearTimeout(hideTimer);
    if (active?.element === element) {
      if (immediate) { win.clearTimeout(showTimer); show(); }
      else if ((!bubble || bubble.hidden) && showTimer === undefined) showTimer = win.setTimeout(show, 400);
      return;
    }
    hide();
    const title = element.getAttribute('title');
    const label = labelFor(element).trim();
    if (!label) return;
    const group = groupFor(element);
    const warm = group && group === warmGroup && now() < warmUntil;
    active = { element, title, label, input: immediate ? 'keyboard' : 'pointer' };
    // 悬停期间移除浏览器 title，关闭后原样归还。
    if (title !== null) element.removeAttribute('title');
    if (immediate || warm) show();
    else showTimer = win.setTimeout(show, 400);
  };
  const trigger = target => target?.closest?.(selector);
  const contains = (parent, node) => !!node && parent?.contains(node);
  listen(doc, 'pointerover', event => {
    if (event.pointerType === 'touch') return;
    if (contains(bubble, event.target)) { win.clearTimeout(hideTimer); return; }
    const element = trigger(event.target);
    if (element && !contains(element, event.relatedTarget)) begin(element);
  }, true);
  listen(doc, 'pointerout', event => {
    if (!active) return;
    if (contains(active.element, event.relatedTarget) || contains(bubble, event.relatedTarget)) return;
    if (contains(active.element, event.target) || contains(bubble, event.target)) {
      win.clearTimeout(showTimer);
      showTimer = undefined;
      win.clearTimeout(hideTimer);
      hideTimer = win.setTimeout(hide, 100);
    }
  }, true);
  listen(doc, 'pointerdown', () => { pointerFocus = true; reset(); }, true);
  listen(doc, 'keydown', event => {
    pointerFocus = false;
    if (event.key === 'Escape' || event.key === 'Tab') reset();
  }, true);
  listen(doc, 'focusin', event => { if (!pointerFocus) { resetWarm(); begin(trigger(event.target), true); } }, true);
  listen(doc, 'focusout', event => {
    if (active && !contains(active.element, event.relatedTarget) && !contains(bubble, event.relatedTarget)) hide();
  }, true);
  listen(win, 'scroll', event => { if (!contains(bubble, event.target)) reset(); }, true);
  listen(win, 'resize', reset);
  listen(win, 'blur', reset);
  return () => {
    reset();
    listeners.forEach(dispose => dispose());
    bubble?.remove();
  };
}
