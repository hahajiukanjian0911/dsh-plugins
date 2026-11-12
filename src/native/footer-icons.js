// Native expanded controls disable their tooltips because labels were visible.
// Supply names for the icon layout. DSH Polish uses these for its DSH-styled
// tooltips; a browser title remains available when Polish is not installed.
export function mountFooterIconTitles(browser) {
  const shell = browser?.closest('[data-slot="sidebar"]')?.firstElementChild;
  if (!shell) return;
  const saved = new Map();
  function update() {
    for (const button of shell.querySelectorAll(':scope > nav button[aria-label], :scope > button[aria-label]')) {
      const label = button.getAttribute('aria-label');
      if (!saved.has(button)) saved.set(button, { original: button.getAttribute('title'), label });
      const previous = saved.get(button);
      if (previous.original === null && (!button.hasAttribute('title') || button.getAttribute('title') === previous.label)) {
        button.setAttribute('title', label); previous.label = label;
      }
    }
  }
  const observer = new MutationObserver(update);
  observer.observe(shell, { childList:true, subtree:true, attributes:true, attributeFilter:['aria-label'] });
  update();
  return () => {
    observer.disconnect();
    for (const [button, value] of saved) if (button.getAttribute('title') === value.label) {
      if (value.original === null) button.removeAttribute('title'); else button.setAttribute('title', value.original);
    }
  };
}
