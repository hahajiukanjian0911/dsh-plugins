export function mountMotion(doc = document, win = window) {
  const root = doc.documentElement;
  if (!root) return () => {};
  const attribute = 'data-dsh-polish-motion';
  const previousMode = root.getAttribute(attribute);
  const owned = new WeakMap();
  const animations = new Map();
  const frames = new Map();
  const listeners = [];
  const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const fine = win.matchMedia?.('(hover: hover) and (pointer: fine)');
  let lastAnchor;
  let mounted = true;
  const listen = (target, type, callback, capture = false) => {
    target.addEventListener(type, callback, capture);
    listeners.push(() => target.removeEventListener(type, callback, capture));
  };
  const input = mode => { if (root.getAttribute(attribute) !== mode) root.setAttribute(attribute, mode); };
  input('keyboard');
  const candidate = node => node?.matches?.('.dsi-snooze-menu[popover]');
  const pointerMode = () => root.getAttribute(attribute) === 'pointer' && fine?.matches !== false;
  const mode = () => !pointerMode() ? 'keyboard' : reduce?.matches ? 'reduced' : 'pointer';
  const cancelFrame = element => {
    if (!frames.has(element)) return;
    win.cancelAnimationFrame(frames.get(element));
    frames.delete(element);
  };
  const cancelAnimation = element => {
    const record = animations.get(element);
    animations.delete(element);
    record?.animation.cancel();
  };
  const remember = element => {
    if (!owned.has(element)) owned.set(element, {
      mode: element.getAttribute('data-dsh-polish-snooze'),
      phase: element.getAttribute('data-dsh-polish-phase'),
      origin: element.style.getPropertyValue('transform-origin'),
      priority: element.style.getPropertyPriority('transform-origin'),
      revision: 0,
    });
    return owned.get(element);
  };
  const restore = element => {
    cancelFrame(element);
    cancelAnimation(element);
    const saved = owned.get(element);
    if (!saved) return;
    for (const animation of element.getAnimations?.() ?? []) {
      if (animation.transitionProperty === 'display' || animation.transitionProperty === 'overlay') animation.cancel();
    }
    for (const [name, value] of [['data-dsh-polish-snooze', saved.mode], ['data-dsh-polish-phase', saved.phase]]) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    if (element.style.getPropertyValue('transform-origin') === saved.appliedOrigin) {
      if (saved.origin) element.style.setProperty('transform-origin', saved.origin, saved.priority);
      else element.style.removeProperty('transform-origin');
    }
    owned.delete(element);
    // 让移除后的离散过渡立即结算，调用方等待的 finished Promise 才能及时释放节点。
    if (element.isConnected) win.getComputedStyle(element).transitionProperty;
  };
  const sample = element => {
    const style = win.getComputedStyle(element);
    return { opacity: style.opacity, transform: style.transform };
  };
  const animate = (element, kind, selectedMode, from) => {
    const previous = animations.get(element);
    const start = from ?? (previous || kind === 'exit' ? sample(element) : {
      opacity: 0, transform: selectedMode === 'reduced' ? 'none' : 'scale(0.97)',
    });
    if (selectedMode === 'reduced') start.transform = 'none';
    cancelAnimation(element);
    if (selectedMode === 'keyboard' || typeof element.animate !== 'function') return;
    const style = win.getComputedStyle(element);
    const duration = Number.parseFloat(style.getPropertyValue(selectedMode === 'reduced'
      ? '--dsp-motion-reduced-duration' : '--dsp-motion-popover-duration'));
    const easing = style.getPropertyValue('--dsp-motion-ease-out').trim();
    if (!(duration > 0) || !easing) return;
    const end = kind === 'enter' ? { opacity: 1, transform: 'none' }
      : { opacity: 0, transform: selectedMode === 'reduced' ? 'none' : 'scale(0.97)' };
    // 退场保持最后一帧，直到 display/overlay 的离散过渡也结束，避免先回到不透明再消失。
    const animation = element.animate([start, end], { duration, easing, fill: kind === 'exit' ? 'forwards' : 'none' });
    const record = { animation, kind };
    animations.set(element, record);
    const settled = () => {
      if (kind === 'enter' && animations.get(element) === record) animations.delete(element);
      else if (kind === 'exit' && animations.get(element) === record && !element.isConnected) restore(element);
    };
    animation.finished.then(settled, settled);
  };
  listen(doc, 'pointerdown', event => {
    input(event.pointerType === 'touch' ? 'keyboard' : 'pointer');
    lastAnchor = event.target?.closest?.('.dsi-row-actions .dsi-icon-button');
  }, true);
  listen(doc, 'keydown', () => { input('keyboard'); lastAnchor = undefined; }, true);
  listen(doc, 'beforetoggle', event => {
    const element = event.target;
    if (!candidate(element)) return;
    const saved = remember(element);
    saved.revision++;
    cancelFrame(element);
    const selectedMode = typeof element.animate === 'function' ? mode() : 'keyboard';
    element.setAttribute('data-dsh-polish-snooze', selectedMode);
    if (event.newState === 'open') {
      if (selectedMode === 'keyboard') {
        cancelAnimation(element);
        element.setAttribute('data-dsh-polish-phase', 'open');
        return;
      }
      const anchor = lastAnchor;
      element.setAttribute('data-dsh-polish-phase', 'preparing');
      frames.set(element, win.requestAnimationFrame(() => {
        frames.delete(element);
        if (!mounted || !element.isConnected || !element.matches(':popover-open')) { restore(element); return; }
        const current = animations.has(element) ? sample(element) : undefined;
        const position = win.getComputedStyle(element);
        if (anchor?.isConnected) {
          const box = anchor.getBoundingClientRect();
          const x = Math.max(0, Math.min(element.offsetWidth, (box.left + box.right) / 2 - Number.parseFloat(position.left)));
          const y = Math.max(0, Math.min(element.offsetHeight, (box.top + box.bottom) / 2 - Number.parseFloat(position.top)));
          saved.appliedOrigin = `${x}px ${y}px`;
          element.style.setProperty('transform-origin', saved.appliedOrigin);
        }
        element.setAttribute('data-dsh-polish-phase', 'open');
        animate(element, 'enter', selectedMode, current);
      }));
    } else {
      const current = sample(element);
      const closingMode = Number(current.opacity) <= .001 ? 'keyboard' : selectedMode;
      element.setAttribute('data-dsh-polish-snooze', closingMode);
      element.setAttribute('data-dsh-polish-phase', 'closing');
      animate(element, 'exit', closingMode, current);
    }
  }, true);
  listen(doc, 'toggle', event => {
    const element = event.target;
    if (!candidate(element) || event.newState !== 'closed') return;
    const revision = owned.get(element)?.revision;
    const pending = element.getAnimations?.().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)) ?? [];
    Promise.allSettled(pending.map(animation => animation.finished)).then(() => {
      if (mounted && owned.get(element)?.revision === revision && !element.matches(':popover-open')) restore(element);
    });
  }, true);
  if (reduce?.addEventListener) listen(reduce, 'change', () => {
    for (const element of [...animations.keys()]) {
      if (element.matches(':popover-open')) {
        cancelAnimation(element);
        element.setAttribute('data-dsh-polish-snooze', mode());
        element.setAttribute('data-dsh-polish-phase', 'open');
      } else restore(element);
    }
  });
  return () => {
    mounted = false;
    listeners.forEach(dispose => dispose());
    for (const element of [...frames.keys()]) restore(element);
    for (const element of [...animations.keys()]) restore(element);
    for (const element of doc.querySelectorAll('.dsi-snooze-menu[data-dsh-polish-snooze]')) restore(element);
    if (previousMode === null) root.removeAttribute(attribute);
    else root.setAttribute(attribute, previousMode);
  };
}
