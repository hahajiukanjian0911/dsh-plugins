// A matching ::-webkit-scrollbar rule keeps Chromium on its custom-scrollbar
// path even when its properties are reverted. Make every authored scrollbar
// selector non-matching; all application pages then use platform scrollbars.
export function mountNativeScrollbars(doc, view) {
  if (!doc.styleSheets || typeof view.MutationObserver !== 'function') return () => {};
  const changed = new Map();
  let disposed = false;
  function nativeSelector(selector) {
    let result = '', quote = '';
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      // Do not rewrite quoted attribute values or escaped identifier text.
      if (char === '\\') { result += selector.slice(i, i + 2); i++; continue; }
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (selector.startsWith('::-webkit-scrollbar', i)) result += ':not(*)';
      result += char;
    }
    return result;
  }
  function restore(rule, record) {
    if (rule.selectorText === record.patched) rule.selectorText = record.original;
  }
  function update() {
    if (disposed) return;
    const live = new Set(), visited = new Set();
    function sheet(stylesheet) {
      if (!stylesheet || visited.has(stylesheet)) return;
      visited.add(stylesheet);
      try { rules(stylesheet.cssRules); } catch { /* Cross-origin sheets are not host-owned. */ }
    }
    function rules(list) {
      for (const rule of list) {
        if (typeof rule.selectorText === 'string' && rule.selectorText.includes('::-webkit-scrollbar')) {
          live.add(rule);
          const current = rule.selectorText, previous = changed.get(rule);
          const patched = nativeSelector(current);
          if (previous?.patched !== current && patched !== current) {
            rule.selectorText = patched;
            if (rule.selectorText === patched) changed.set(rule, { original: current, patched });
          }
        }
        if (rule.styleSheet) sheet(rule.styleSheet);
        else if (rule.cssRules) rules(rule.cssRules);
      }
    }
    for (const stylesheet of doc.styleSheets) sheet(stylesheet);
    for (const [rule, record] of changed) if (!live.has(rule)) {
      // A lazily loaded sheet can be detached and reused after Polish stops.
      restore(rule, record);
      changed.delete(rule);
    }
  }
  const isSheet = node => node?.nodeType === 1 && (node.matches('style, link[rel~="stylesheet"]') || node.querySelector('style, link[rel~="stylesheet"]'));
  const observer = new view.MutationObserver(records => {
    // Ordinary streamed content must not rescan every stylesheet. Also cover
    // styles mounted inside page/modal subtrees, not only those in document.head.
    if (records.some(record => record.target.parentElement?.closest('style')
      || record.target.nodeType === 1 && record.target.matches('style, link')
      || [...record.addedNodes, ...record.removedNodes].some(isSheet))) update();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['href', 'rel', 'media', 'disabled'] });
  const loaded = event => { if (event.target?.tagName === 'LINK') update(); };
  doc.addEventListener('load', loaded, true);
  update();
  return () => {
    disposed = true;
    observer.disconnect();
    doc.removeEventListener('load', loaded, true);
    for (const [rule, record] of changed) restore(rule, record);
    changed.clear();
  };
}

// The existing public composer-layout seat owns this observation. Keep the
// browser-measured gutter local instead of overwriting host-owned layout tokens.
export function attachNativeScrollbarGutter(seat, view) {
  const scrollport = seat?.closest('[data-conversation-scroll]');
  if (!scrollport) return () => {};
  const property = '--dsp-native-scrollbar-width';
  const previous = scrollport.style.getPropertyValue(property);
  const priority = scrollport.style.getPropertyPriority(property);
  let written, disposed = false;
  function measure() {
    if (disposed) return;
    const style = view.getComputedStyle(scrollport);
    const border = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    const width = Math.max(0, scrollport.offsetWidth - scrollport.clientWidth - border);
    written = width + 'px';
    if (scrollport.style.getPropertyValue(property) !== written) scrollport.style.setProperty(property, written);
  }
  const observer = new view.ResizeObserver(measure);
  observer.observe(scrollport);
  measure();
  return () => {
    disposed = true;
    observer.disconnect();
    if (scrollport.style.getPropertyValue(property) !== written) return;
    if (previous) scrollport.style.setProperty(property, previous, priority);
    else scrollport.style.removeProperty(property);
  };
}
