import React from 'react';
import {createHostFixture,source} from '../../../tests/host-fixture.js';

// Actual installed frame, sidebar and right opener; isolated stores/callbacks.
export function createTitlebarFrame({M,C,P,App,hero,session,id,forgeCore}) {
  const {ExpandButton,PanelChrome}=C['sidebar-right'];
  const fixture=createHostFixture(window),hook=s=>select=>select(React.useSyncExternalStore(s.subscribe,s.getSnapshot));
  fixture.ctx.inject=(_deps,fn)=>fn(fixture.ctx);
  window.__INBOX_FACTORY__(name=>M[name]).apply(fixture.ctx);
  const {actions,hooks}=fixture.winner().inject(),Sidebar=fixture.winner().component;
  const layout=source({layoutInfo:{viewportWidth:innerWidth,sidebar:280,narrowExpanded:false,rightbarShown:false,rightbarTrack:false}});
  const panel=source({activePanelId:null}),right=source({bySession:{[id]:{layout:{expanded:false}}}});
  const change=patch=>layout.set({layoutInfo:{...layout.getSnapshot().layoutInfo,...patch}});
  const frameActions={setViewportWidth:viewportWidth=>{if(viewportWidth!==layout.getSnapshot().layoutInfo.viewportWidth)change({viewportWidth});},toggleSidebar:()=>{const x=layout.getSnapshot().layoutInfo;change(x.viewportWidth<1024?{narrowExpanded:!x.narrowExpanded}:{sidebar:x.sidebar?0:280});},setSidebar:sidebar=>change({sidebar}),setRightbar:rightbar=>change({rightbar})};
  const rightActions={toggleExpanded:()=>rightActions.setExpanded(id,!right.getSnapshot().bySession[id].layout.expanded),setExpanded:(_id,expanded)=>{right.set({bySession:{[id]:{layout:{expanded}}}});change({rightbarShown:expanded,rightbarTrack:expanded});}};
  const t=key=>C.sidebar.zh[key]??key;
  const css=document.createElement('style');css.textContent='body{background:var(--dsw-alias-bg-base)}#preview{height:100vh}.titlebar-preview-main{height:100%;min-height:0;display:flex;flex-direction:column}.titlebar-preview-main>.preview-main{flex:1;min-height:0;height:auto}.titlebar-preview-right{height:100%;background:var(--dsw-alias-bg-base);padding:12px}';document.head.append(css);
  const media=matchMedia('(prefers-color-scheme:dark)'),appearance=()=>{document.body.toggleAttribute('data-ds-dark-theme',media.matches);document.documentElement.style.backgroundColor=getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base');};appearance();media.addEventListener('change',appearance);
  const shortcuts=select=>select([{id:'session.new',keys:['⌘','N'],aria:'Meta+N'},{id:'sidebar.left.toggle',keys:['⌘','B'],aria:'Meta+B'}]);
  function Frame(props) {
    const expanded=React.useSyncExternalStore(right.subscribe,right.getSnapshot).bySession[id].layout.expanded;
    const blank=React.useSyncExternalStore(hero.subscribe,hero.getSnapshot);
    const slots=(name,owner,options)=>{
      if(name==='shell.overlay')return props.renderSlot(name,owner);
      if(name==='shell.leading')return <C.sidebar.HeaderLeadingControls toggleSidebar={frameActions.toggleSidebar} startSession={()=>actions.start()} trackEntryClick={()=>{}} useRemoteAccess={()=>true} useShortcuts={shortcuts} t={t}/>;
      if(name==='sidebar')return <div data-slot="sidebar"><C.sidebar.SidebarRoot {...owner} startSession={()=>actions.start()} toggleSidebar={frameActions.toggleSidebar} selectPanel={activePanelId=>panel.set({activePanelId})} setPinned={()=>{}} trackEntryClick={()=>{}} useRemoteAccess={()=>true} usePanels={s=>s([])} useEntryPins={s=>s([])} useEntryActions={s=>s(false)} useShortcuts={shortcuts} usePanelInfo={hook(panel)} t={t} renderSlot={(slot,p,o)=>{
        if(slot==='sidebar.brand.name')return <span data-slot={slot}><P.BrandWordmark includeMark={false}/></span>;
        if(slot==='sidebar.workspaces')return <span data-slot={slot} style={{display:'contents'}}><Sidebar {...p} actions={actions} t={fixture.ctx.locale.bind('inboxSidebar')} useInbox={hook(hooks.inbox)} useSidebarPreferences={hook(hooks.sidebarPreferences)} useProjectCatalog={hook(hooks.projectCatalog)} useNativeShortcuts={hook(hooks.nativeShortcuts)} useRemoteAccess={()=>true} useSessionAccess={()=>true}/></span>;
        return o?.fallback??null;
      }}/></div>;
      if(name==='main')return <div className="titlebar-preview-main"><C.conversation.ConversationHeader sessionId={id} useSession={s=>s({...session.getSnapshot(),blank})} useConversation={s=>s({activeTargets:new Set()})} renderSlot={slot=>slot==='conversation.session.header'?<div className="kiGsTW_titleRow">{!blank&&<span>标题栏核对</span>}<ExpandButton sessionId={id} useStore={hook(right)} actions={rightActions} useShortcuts={s=>s([])} t={k=>C['sidebar-right'].zh[k]??k}/></div>:null}/><App {...props}/></div>;
      if(name==='rightbar'&&expanded)return <aside className="titlebar-preview-right Dv5QdW_panel" data-sidebar-right-panel="push" data-sidebar-right-open="" style={{width:owner.width,pointerEvents:"auto"}}><div data-dockkit-host="dock" style={{position:"relative",zIndex:10,background:"var(--dsw-alias-bg-base)",flex:1,pointerEvents:"auto"}}/><PanelChrome sessionId={id} fullscreen={false} actions={rightActions} t={k=>C['sidebar-right'].zh[k]??k} shortcuts={[]} toggleFullscreen={()=>{window.titlebarFixture.modeCalls=(window.titlebarFixture.modeCalls??0)+1;}}/></aside>;
      return options?.fallback??null;
    };
    return <C.layout.AppFrame useStore={hook(layout)} useSessions={hook(fixture.sessions)} usePanelInfo={hook(panel)} useFoldedLandscape={s=>s(false)} actions={frameActions} renderSlot={slots} t={t}/>;
  }
  window.titlebarFixture={layout,frameActions,fixture,panel,right,rightActions,registry:forgeCore};
  return Frame;
}
