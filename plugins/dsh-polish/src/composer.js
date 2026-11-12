// Keep the host's React tree, editor and event handlers intact. Only its hero
// controls receive temporary layout markers; disposal restores every marker.
export function attachComposerLayout(spacer, view) {
  const card = spacer.closest('[data-composer-card]');
  const stack = card?.closest('[class*="_composerStack"]');
  if (!card || !stack) return () => {};
  const rows = '[class*="_heroWorkspaceRow"]';
  let row, mode, options, disposed = false, frame = null;
  const marked = new Map();
  const anchors = view.CSS?.supports?.('anchor-scope', '--dsp-composer-space')
    && view.CSS?.supports?.('left', 'anchor(left)');
  function mark(node, name, value = '') {
    if (!node) return;
    let values = marked.get(node);
    if (!values) marked.set(node, values = new Map());
    if (!values.has(name)) values.set(name, node.getAttribute(name));
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  function restore(node) {
    const values = marked.get(node);
    if (!values) return;
    for (const [name, value] of values) {
      if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
    }
    marked.delete(node);
  }
  function property(node, name, value) {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  }
  function schedule() {
    if (disposed || frame !== null) return;
    frame = view.requestAnimationFrame(() => { frame = null; measure(); });
  }
  const resize = new view.ResizeObserver(schedule);
  const rowChanges = new view.MutationObserver(schedule);
  function measure() {
    if (disposed || !spacer.isConnected) return;
    const nextRow = stack.querySelector(rows);
    const nextMode = nextRow?.querySelector('[data-slot="conversation.hero.agentPreset"] > span') ?? null;
    const nextOptions = nextRow?.querySelector('[class*="_heroOptions"]') ?? null;
    const changed = nextRow !== row || nextMode !== mode || nextOptions !== options;
    if (changed) {
      resize.disconnect(); rowChanges.disconnect();
      restore(mode); restore(options); restore(stack);
      row = nextRow; mode = nextMode; options = nextOptions;
      if (row) {
        mark(stack, 'data-dsp-composer-layout', anchors ? 'anchor' : 'measured');
        mark(mode, 'data-dsp-composer-mode'); mark(options, 'data-dsp-composer-options');
        rowChanges.observe(row, { childList: true, subtree: true, characterData: true });
        for (const node of [card, mode, options]) if (node) resize.observe(node);
      }
    }
    spacer.hidden = !row;
    if (!row) return;
    for (const node of [...marked.keys()]) if (!node.isConnected) restore(node);
    const modeButton = mode?.querySelector('button');
    const modeLabel = modeButton?.querySelector('[class*="_seatLabel"]')?.textContent?.trim();
    if (modeLabel) mark(modeButton, 'aria-label', modeLabel);
    const modeBox = mode?.getBoundingClientRect();
    const optionsBox = options?.getBoundingClientRect();
    const modeWidth = modeBox?.width ?? 0, optionsWidth = optionsBox?.width ?? 0;
    const gap = modeWidth > 0 && optionsWidth > 0 ? 8 : 0;
    const available = Math.max(0, card.clientWidth - 32);
    const wrap = modeWidth + optionsWidth + gap > available;
    const width = wrap ? Math.max(modeWidth, optionsWidth) : modeWidth + optionsWidth + gap;
    const height = wrap && gap ? 60 : 28;
    property(spacer, 'width', Math.ceil(width) + 'px');
    property(spacer, 'height', height + 'px');
    // CSS properties inherited by the existing controls, not by the spacer.
    property(stack, '--dsp-options-x', wrap ? '0px' : Math.ceil(modeWidth + gap) + 'px');
    property(stack, '--dsp-options-y', wrap && gap ? '32px' : '0px');
    if (!anchors) {
      const base = stack.getBoundingClientRect(), seat = spacer.getBoundingClientRect();
      const x = seat.left - base.left, y = seat.top - base.top;
      property(stack, '--dsp-controls-left', x + 'px'); property(stack, '--dsp-controls-top', y + 'px');
    }
  }
  const stackChanges = new view.MutationObserver(schedule);
  stackChanges.observe(stack, { childList: true });
  view.addEventListener('resize', schedule);
  measure();
  return () => {
    disposed = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    resize.disconnect(); rowChanges.disconnect(); stackChanges.disconnect();
    view.removeEventListener('resize', schedule);
    for (const node of [...marked.keys()]) restore(node);
    for (const key of ['--dsp-options-x', '--dsp-options-y', '--dsp-controls-left', '--dsp-controls-top']) stack.style.removeProperty(key);
  };
}

export function installComposerLayout(ctx, React) {
  if (typeof ctx.inject !== 'function') return;
  function ComposerLayoutSpace() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const layout = attachComposerLayout(ref.current, window);
      const scrollbar = attachNativeScrollbarGutter(ref.current, window);
      return () => { scrollbar(); layout(); };
    }, []);
    return React.createElement('span', { ref, 'data-dsp-composer-space': '', 'aria-hidden': true, hidden: true });
  }
  ctx.inject(['slots'], scope => scope.slots.inject('conversation.input.left', () => scope.slots.register({
    name: 'conversation.input.left', id: 'dsh-polish-composer-layout', order: 10000,
  }, ComposerLayoutSpace)));
}
