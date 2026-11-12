import React from 'react';
import { createRoot } from 'react-dom/client';

export function renderGlassPreview() {
  const P = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'];
  const baseline = document.createElement('style'); baseline.textContent = globalThis.__DSH_POLISH_BASELINE__; document.head.append(baseline);
  const fixtureStyle = document.createElement('style');
  fixtureStyle.textContent = '#preview[data-glass-preview]{display:block;width:100%;height:auto;min-height:100vh;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.glass-fixture{max-width:920px;margin:auto;padding:32px 32px 64px;font:14px/20px var(--dsw-font-family)}.glass-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:36px}.glass-controls select{font:inherit;max-width:160px}.glass-controls button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover)}.glass-workspace{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.glass-workspace h1{font-size:22px;font-weight:600;line-height:30px;margin:0}.glass-targets{display:flex;gap:12px;align-items:center;flex-wrap:wrap;min-height:36px;margin-bottom:16px}.glass-list{display:flex;flex-direction:column;gap:24px}.glass-row{display:flex;gap:16px;align-items:center;min-height:76px}.glass-row>span:first-child{width:48px;height:48px;display:grid;place-items:center;color:var(--dsw-alias-state-business-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex:none}.glass-row p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.glass-row strong{font-weight:500}.glass-native-select{min-width:132px;height:32px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;padding:4px 24px 4px 10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.glass-legacy-card{display:flex;flex-direction:column;gap:8px}.glass-counts{display:grid;grid-template-columns:1fr auto;gap:8px 32px;margin:0}.glass-counts dt{color:var(--dsw-alias-label-secondary)}.glass-counts dd{margin:0;font-variant-numeric:tabular-nums}.glass-modal-content{margin:0;line-height:24px}.glass-modal-field{display:flex;flex-direction:column;gap:8px;margin-top:16px} @media(max-width:600px){.glass-fixture{padding:20px 16px 40px}.glass-controls{margin-bottom:24px}}';
  document.head.append(fixtureStyle); document.getElementById('preview').setAttribute('data-glass-preview', '');
  let disposers = [], active = false;
  const apply = enabled => {
    if (active === enabled) return;
    for (const dispose of disposers.toReversed()) dispose(); disposers = []; active = enabled;
    if (enabled) window.__polishFactory(id => globalThis.__DSH_NATIVE_MODULES__[id]).apply({ effect(factory) { const dispose = factory(); if (typeof dispose === 'function') disposers.push(dispose); return dispose; } });
  };
  apply(true);
  const views = [['menu','下拉菜单'],['tooltip','文字提示'],['hover','会话详情'],['preview','预览卡片'],['modal','对话框'],['select','原生下拉'],['toast','操作反馈']];
  const icons = ['IconAgentFlowRegular','IconTerminalOutlineRegular','IconPeopleTeamOutlineRegular','IconMicOutlineRegular','IconShieldOutlineRegular','IconBranchOutlineRegular'];
  const rows = [['Agent 循环','控制 Agent 派发工具调用的方式。'],['终端','配置命令时长和输出内容。'],['智能体团队','将工作分配给队友，在共享任务看板上跟踪进度。'],['语音输入','在本机转写录音。'],['自动授权审查','在调用工具前，检查操作是否符合你的要求。'],['变更请求与工作树','查看分支、变更和代码审阅。']];
  function App() {
    const [view, setView] = React.useState('menu'), [enabled, setEnabled] = React.useState(true);
    const [open, setOpen] = React.useState(true), [selected, setSelected] = React.useState('all');
    const widthAnchor = React.useRef(null);
    const [dark, setDark] = React.useState(matchMedia('(prefers-color-scheme:dark)').matches);
    React.useEffect(() => { window.glassDemo = { setView: value => { setView(value); setOpen(true); }, setPolish: value => { apply(value); setEnabled(value); },
      setOpen, setAppearance: value => { document.body.toggleAttribute('data-ds-dark-theme', value === 'dark'); setDark(value === 'dark'); },
      dispose: () => apply(false), get active() { return active; } }; }, []);
    const details = <div className="glass-legacy-card"><strong className="JoiKIa_hoverTitle">重新设计侧边栏插件</strong><span className="JoiKIa_hoverPath">dsh-plugins · /example/Development/tools/dsh-plugins</span><span className="JoiKIa_hoverStatus">已完成 · 12 分钟前</span></div>;
    return <main className="glass-fixture">
      <nav className="glass-controls" aria-label="浮层示例">
        {views.map(([id,label]) => <P.Button key={id} variant="ghost" aria-pressed={view===id} onClick={() => { setView(id); setOpen(true); }}>{label}</P.Button>)}
        <P.Button variant="outline" onClick={() => { apply(!enabled); setEnabled(!enabled); }}>{enabled ? '改前' : '磨砂'}</P.Button>
        <P.Button variant="outline" onClick={() => { document.body.toggleAttribute('data-ds-dark-theme', !dark); setDark(!dark); }}>{dark ? '浅色' : '深色'}</P.Button>
      </nav>
      <div className="glass-workspace"><h1>插件</h1><P.Button variant="outline">刷新</P.Button></div>
      <div className="glass-targets" ref={widthAnchor}>
        {view === 'menu' && <P.Menu open={open} onClose={() => setOpen(false)} anchor={<P.Button variant="outline" onClick={() => setOpen(v=>!v)}>添加插件</P.Button>}
          selectedId={selected} onSelect={id=>{setSelected(id);setOpen(false);}} items={[
            {id:'all',label:'浏览更多插件',icon:<P.IconPluginPinwheelOutlineRegular size={16}/>},
            {id:'create',label:'创建你的插件',icon:<P.IconPlusOutlineRegular size={16}/>},
            {id:'scope',label:'项目范围',submenu:[{id:'local',label:'当前项目'},{id:'global',label:'全部项目'}]},
            {type:'separator',id:'line'}, {id:'disabled',label:'安装本地插件',disabled:true},
            {id:'remove',label:'移除插件',danger:true},
          ]} portal />}
        {view === 'tooltip' && <P.Tooltip label="插件" shortcutKeys={['⌘','P']} openOnClick portal side="bottom"><P.Button variant="outline" data-glass-trigger="tooltip">插件</P.Button></P.Tooltip>}
        {view === 'hover' && <P.HoverCard anchor={<P.Button variant="outline" data-glass-trigger="hover">会话详情</P.Button>} content={details} openDelayMs={70} inline />}
        {view === 'preview' && <P.HoverCard anchor={<P.Button variant="outline" data-glass-trigger="preview">查看用量</P.Button>} openDelayMs={70} inline variant="preview" widthAnchorRef={widthAnchor} content={<dl data-turn-usage-details className="glass-counts"><dt>模型</dt><dd>DeepSeek V4.1</dd><dt>输入</dt><dd>12,480 tok</dd><dt>输出</dt><dd>2,080 tok</dd><dt>缓存命中</dt><dd>84%</dd></dl>} />}
        {view === 'modal' && <><P.Button variant="outline" onClick={()=>setOpen(true)}>编辑项目</P.Button><P.Modal open={open} onClose={()=>setOpen(false)} title="项目名称" closeLabel="关闭" footer={<P.Button variant="primary" onClick={()=>setOpen(false)}>保存</P.Button>}><p className="glass-modal-content">修改项目在侧栏和选择器中显示的名称。</p><label className="glass-modal-field">名称<P.Input defaultValue="dsh-plugins" aria-label="项目名称" /></label><P.Tooltip label="名称会同步到侧栏和项目选择器" openOnClick side="right"><P.Button variant="ghost" data-glass-trigger="modal-tip">名称说明</P.Button></P.Tooltip></P.Modal></>}
        {view === 'select' && <label>项目范围 <select className="glass-native-select" aria-label="项目范围" value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">全部项目</option><option value="local">当前项目</option><option value="other">其他项目</option></select></label>}
        {view === 'toast' && <P.Toast text="已保存项目设置" tone="success" holdMs={60000} onDone={()=>setOpen(false)} />}
      </div>
      <section className="glass-list" aria-label="插件列表">{rows.map(([title, description],i) => { const Icon=P[icons[i]] || P.IconPluginPinwheelOutlineRegular; return <div className="glass-row" key={title}><span><Icon size={24}/></span><div><strong>{title}</strong><p>{description}</p></div></div>; })}</section>
    </main>;
  }
  createRoot(document.getElementById('preview')).render(<App />);
  window.addEventListener('pagehide', () => apply(false), { once: true });
}
