// 对已发布会话收件箱 0.1.32 的最小回补。提醒动作先执行，关闭仅等待节点已有的有限视觉过渡。
function SnoozeMenu({ target, onClose, onChoose, t }) {
  const menu = useRef(null);
  const [custom, setCustom] = useState('');
  useLayoutEffect(() => {
    const element = menu.current;
    const anchor = target.anchor.getBoundingClientRect();
    let alive = true;
    let closing = false;
    const close = event => {
      if (event.newState !== 'closed' || closing || element.matches(':popover-open')) return;
      closing = true;
      const active = element.ownerDocument.activeElement;
      if (target.anchor.isConnected && (element.contains(active) || active === element.ownerDocument.body)) {
        target.anchor.focus({ preventScroll: true });
      }
      const motions = element.getAnimations?.().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)) ?? [];
      if (!motions.length) { onClose(); return; }
      Promise.allSettled(motions.map(animation => animation.finished)).then(() => {
        if (alive && !element.matches(':popover-open')) onClose();
      });
    };
    element.addEventListener('toggle', close);
    if (!element.matches(':popover-open')) element.showPopover();
    const height = element.offsetHeight;
    element.style.left = Math.max(8, Math.min(anchor.right - 240, window.innerWidth - 248)) + 'px';
    element.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - height - 8)) + 'px';
    element.querySelector('button')?.focus({ preventScroll: true });
    return () => { alive = false; element.removeEventListener('toggle', close); };
  }, [target]);
  const requestClose = () => { if (menu.current?.matches(':popover-open')) menu.current.hidePopover(); };
  const choose = until => { onChoose(until); requestClose(); };
  const customTimestamp = new Date(custom).getTime();
  return <div ref={menu} popover="auto" className="dsi-snooze-menu" role="dialog" aria-label={t('snooze')}>
    <div className="dsi-menu-heading">{t('snooze')}
      <IconButton name="close" label={t('close')} onClick={requestClose} />
    </div>
    {snoozePresets(Date.now()).map(([key, until]) =>
      <button type="button" className="dsi-menu-item" key={key} onClick={() => choose(until)}>
        {t(key)}<span>{new Date(until).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </button>)}
    <label className="dsi-custom-label">{t('customTime')}
      <input type="datetime-local" value={custom} onChange={event => setCustom(event.target.value)} />
    </label>
    <button type="button" className="dsi-confirm" disabled={!(customTimestamp > Date.now())}
      onClick={() => choose(customTimestamp)}>{t('confirmSnooze')}</button>
  </div>;
}
