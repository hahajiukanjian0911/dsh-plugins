import { DEFAULT_PREFERENCES } from '../preferences';
// DSH data / capability coordinator for T3 Code's extracted sidebar presentation.
import { useEffect,useLayoutEffect,useRef,useState,useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@base-ui/react/dialog';
import { NativeIcons,ListFilterIcon,CheckIcon,InboxIcon,SearchIcon,XIcon } from './icons';
import { SidebarRuntime } from './runtime';
import { useInlineRename,useStableRows } from './hooks';
import { ThreadRow } from './ThreadRow';
import { DragProvider,buildDragItems,optimisticRows,useSidebarDrag } from '../sidebar-drag';
import { SidebarContent,SidebarGroup,SidebarMenuButton } from '../vendor/t3-web/components/ui/sidebar';
import { SidebarThreadHeader,SidebarHeaderIconButton } from '../vendor/t3-web/components/sidebar/SidebarThreadHeader';
import { SidebarSectionHeader,SidebarDragBoundary,SidebarSectionPlaceholder } from '../vendor/t3-web/components/sidebar/SidebarListMarkers';
import { TooltipProvider,TooltipScrollDismissArea } from '../vendor/t3-web/components/ui/tooltip';
import { Menu,MenuTrigger,MenuPopup,MenuRadioGroup,MenuRadioItem } from '../vendor/t3-web/components/ui/menu';
import { Button } from '../vendor/t3-web/components/ui/button';
import { Input } from '../vendor/t3-web/components/ui/input';
import { createSidebarListMotion } from '../vendor/t3-web/components/Sidebar.motion';
import { cn } from '../vendor/t3-web/lib/utils';

function useShelfView(autoKey,defaultExpanded){
  const [expanded,setExpanded]=useState(defaultExpanded),[collapsedKey,setCollapsedKey]=useState(null),[limit,setLimit]=useState(40);
  const previousDefault=useRef(defaultExpanded);
  useEffect(()=>{if(previousDefault.current!==defaultExpanded){previousDefault.current=defaultExpanded;setExpanded(defaultExpanded);setCollapsedKey(defaultExpanded?null:autoKey);}},[defaultExpanded,autoKey]);
  const open=expanded||!!autoKey&&autoKey!==collapsedKey;
  return {open,limit,toggle(){setExpanded(!open);setCollapsedKey(open?autoKey:null);},more(){setLimit(n=>n+40);}};
}
function useHostSurface(root,portal,wide){
  const [dark,setDark]=useState(false),[titlebarHeight,setTitlebarHeight]=useState(0);
  useLayoutEffect(()=>{
    if(!root.current)return;
    const el=root.current, probe=document.createElement('span');
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;color:var(--dsw-alias-bg-base)';
    el.parentElement.append(probe);
    const update=()=>{
      const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=getComputedStyle(probe).color;ctx.fillRect(0,0,1,1);
      const [r,g,b]=ctx.getImageData(0,0,1,1).data;setDark(.2126*r+.7152*g+.0722*b<128);
      const caption=el.closest('[data-slot=sidebar]')?.querySelector('[data-window-drag]');
      setTitlebarHeight(caption?.getBoundingClientRect().bottom||0);
    };
    const observer=new MutationObserver(update);
    for(let ancestor=el.parentElement;ancestor;ancestor=ancestor.parentElement) observer.observe(ancestor,{attributes:true,attributeFilter:['class','style','data-theme','data-ds-dark-theme']});
    const media=matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',update);update();
    const resize=new ResizeObserver(update);resize.observe(el);
    return()=>{observer.disconnect();resize.disconnect();media.removeEventListener('change',update);probe.remove();};
  },[wide]);
  useLayoutEffect(()=>{portal.className='dsi-t3 dsi-native dsi-t3-portal'+(dark?' dark':'');},[portal,dark]);
  return {dark,titlebarHeight};
}
function CustomSnooze({target,close,t,actions,portal}){
  const [value,setValue]=useState('');
  const until=new Date(value).getTime();
  return <Dialog.Root open={!!target} onOpenChange={open=>{if(!open)close();}}>
    <Dialog.Portal container={portal}><Dialog.Backdrop className="fixed inset-0 z-[150] bg-black/25 backdrop-blur-xs"/>
      <Dialog.Popup className="fixed top-1/2 left-1/2 z-[151] w-[min(360px,calc(100vw-32px))] -translate-1/2 rounded-xl border border-border bg-popover p-5 text-foreground shadow-xl outline-none">
        <Dialog.Title className="text-sm font-medium">{t('snooze')}</Dialog.Title>
        <Dialog.Description className="mt-1 truncate text-xs text-muted-foreground">{target?.row.session.displayTitle||t('newSession')}</Dialog.Description>
        <label className="mt-4 block text-xs text-muted-foreground">{t('customTime')}<Input nativeInput type="datetime-local" value={value} onChange={e=>setValue(e.target.value)} className="mt-2"/></label>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={close}>{t('cancel')}</Button><Button disabled={!(until>Date.now())} onClick={()=>{void actions.snooze(target.row.id,until,target.order);close();}}>{t('confirmSnooze')}</Button></div>
      </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
export function createT3Sidebar(React,stylesheet,primitives){
  return function T3Sidebar({wide,expandSidebar,useInbox,useNativeShortcuts,useRemoteAccess,useSidebarPreferences=select=>select({value:DEFAULT_PREFERENCES}),actions,t}){
    const preferences=useSidebarPreferences(s=>s.value);
    const data=useInbox(s=>s),shortcuts=useNativeShortcuts(s=>s);
    const canCreate=useRemoteAccess('session/create'),canAdd=useRemoteAccess('workspace/create');
    const [query,setQuery]=useState(''),[project,setProject]=useState(''),[limit,setLimit]=useState(60);
    const [search,setSearch]=useState({query:'',items:[],pending:false}),[activeResult,setActiveResult]=useState(0);
    const [dragState,setDragState]=useState(null),[optimistic,setOptimistic]=useState(null),[customSnooze,setCustomSnooze]=useState(null);
    const root=useRef(null),header=useRef(null),scroll=useRef(null),list=useRef(null),input=useRef(null),motion=useRef(null);
    const [portal]=useState(()=>document.createElement('div'));
    const rename=useInlineRename(actions,t),{dark,titlebarHeight}=useHostSurface(root,portal,wide);
    useLayoutEffect(()=>{document.body.append(portal);return()=>portal.remove();},[portal]);
    const needle=query.trim().toLocaleLowerCase();
    useEffect(()=>{
      if(!needle)return;
      const abort=new AbortController();setSearch({query:needle,items:[],pending:true});
      const timer=setTimeout(()=>actions.search(query.trim(),abort.signal).then(result=>{if(!abort.signal.aborted)setSearch({...result,query:needle,pending:false});},error=>{if(!abort.signal.aborted)setSearch({query:needle,items:[],pending:false,error:String(error.message||error)});}),250);
      return()=>{clearTimeout(timer);abort.abort();};
    },[needle]);
    const currentSearch=search.query===needle?search:{items:[],pending:!!needle};
    const matches=new Map(currentSearch.items.map(item=>[item.sessionId,item.snippet]));
    const rows=optimisticRows(useStableRows(data.rows,rename.state?.id||dragState?.activeKey),optimistic);
    const drafts=rows.filter(row=>row.section==='draft');
    const visible=rows.filter(row=>row.section!=='draft'&&(!project||row.workspace?.workspaceId===project)&&(!needle||matches.has(row.id)||[row.id,row.session.displayTitle,row.session.title,row.session.cwd,row.workspace?.title].some(value=>value?.toLocaleLowerCase().includes(needle))));
    const primary=visible.filter(row=>['pinned','inbox','working'].includes(row.section));
    const snoozed=visible.filter(row=>row.section==='snoozed'),settled=visible.filter(row=>row.section==='settled');
    const expansion=section=>needle?JSON.stringify(['search',project,needle]):visible.find(row=>row.current&&row.section===section)?.id||null;
    const views={snoozed:useShelfView(expansion('snoozed'),preferences.snoozedExpanded),settled:useShelfView(expansion('settled'),preferences.settledExpanded)};
    const drag=useSidebarDrag({items:buildDragItems(primary.slice(0,limit),snoozed,settled,views),rows:data.rows,
      state:dragState,setState:setDragState,optimistic,setOptimistic,actions,blocked:!wide||!!rename.state||!!needle,
      root,header,scroll,views,motion,motionEnabled:preferences.listMotion});
    const order=primary.map(row=>row.id),searchRows=visible.slice(0,limit);
    useLayoutEffect(()=>{scroll.current=root.current?.querySelector('[data-slot=scroll-area-viewport]')||null;},[wide]);
    useLayoutEffect(()=>{
      if(!wide||!list.current)return;
      const m=createSidebarListMotion(list.current);motion.current=m;m.update(false);
      return()=>{m.dispose();if(motion.current===m)motion.current=null;};
    },[wide]);
    useLayoutEffect(()=>{
      if(!wide||!header.current)return;
      const shell=root.current.closest('[data-slot=sidebar]')?.firstElementChild;
      if(!shell)return;
      const previous=shell.style.getPropertyValue('--dsi-glass-height');
      const measure=()=>shell.style.setProperty('--dsi-glass-height',(header.current.getBoundingClientRect().bottom-shell.getBoundingClientRect().top)+'px');
      const resize=new ResizeObserver(measure);resize.observe(header.current);measure();
      return()=>{resize.disconnect();if(previous)shell.style.setProperty('--dsi-glass-height',previous);else shell.style.removeProperty('--dsi-glass-height');};
    },[wide]);
    const layoutKey=[...drag.items.map(i=>i.key||i.marker),...drafts.map(r=>r.id),limit,needle].join('\n');
    const shelfKey=views.snoozed.open+':'+views.settled.open,previousShelf=useRef(shelfKey);
    useLayoutEffect(()=>{
      const unchanged=previousShelf.current===shelfKey;previousShelf.current=shelfKey;
      if(!preferences.listMotion)motion.current?.suspend();
      motion.current?.update(preferences.listMotion&&!drag.dragging&&unchanged&&!rename.state);
    },[layoutKey,shelfKey,drag.dragging,!!rename.state,preferences.listMotion,preferences.density]);
    useLayoutEffect(()=>{
      if(rename.state||!rename.focusId.current)return;
      const id=rename.focusId.current;rename.focusId.current=null;
      [...root.current.querySelectorAll('[data-sidebar-row]')].find(n=>n.dataset.sidebarRow===id)?.focus({preventScroll:true});
    },[rename.state]);
    const focusRequested=useRef(false),lastSearch=useRef(0),lastAdd=useRef(0);
    useEffect(()=>{
      if(shortcuts.searchRequest!==lastSearch.current){lastSearch.current=shortcuts.searchRequest;if(shortcuts.searchRequest){focusRequested.current=true;expandSidebar();if(wide)input.current?.focus();}}
      if(shortcuts.addRequested!==lastAdd.current){lastAdd.current=shortcuts.addRequested;if(shortcuts.addRequested)void actions.addWorkspace();}
    },[shortcuts.searchRequest,shortcuts.addRequested]);
    useEffect(()=>{if(wide&&focusRequested.current){input.current?.focus();focusRequested.current=false;}},[wide]);
    useEffect(()=>{
      if(!data.undo)return;
      const key=e=>{if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable=true]')){e.preventDefault();void actions.undo();}};
      document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
    },[data.undo]);
    useEffect(()=>setActiveResult(0),[needle,project]);
    const runtime={wide,t,actions,portal,titlebarHeight,preferences,onCustomSnooze:(row,order)=>setCustomSnooze({row,order})};
    function rowElement(row){
      const index=searchRows.findIndex(item=>item.id===row.id);
      return <ThreadRow key={row.id} row={row} rename={rename} drag={drag} order={order} busy={data.busy.has(row.id)} snippet={matches.get(row.id)}
        searchProps={needle?{id:`sidebar-thread-search-result-${index}`,role:'option','aria-selected':index===activeResult}:undefined}/>;
    }
    const projectScope=<Menu><MenuTrigger render={<SidebarMenuButton size="icon" type="button" aria-label={t('filterProject')}
      className={cn('size-7',project&&'text-primary')}/>}><ListFilterIcon className="size-4"/></MenuTrigger>
      <MenuPopup align="end"><MenuRadioGroup value={project} onValueChange={setProject}>
        <MenuRadioItem closeOnClick value="">{t('allProjects')}</MenuRadioItem>
        {data.workspaces.map(w=><MenuRadioItem closeOnClick key={w.workspaceId} value={w.workspaceId}>{w.title||w.path}</MenuRadioItem>)}
      </MenuRadioGroup></MenuPopup></Menu>;
    return <NativeIcons.Provider value={primitives}><SidebarRuntime.Provider value={runtime}><TooltipProvider delay={150} closeDelay={0} timeout={400}>
      <DragProvider drag={drag}><div ref={root} className={cn('dsi-root dsi-t3 dsi-native',!wide&&'dsi-rail',dark&&'dark')}
        style={{'--dsi-footer-inset':'0px'}} data-dsi-density={preferences.density} data-dsi-list-motion={preferences.listMotion} data-sidebar-dragging={drag.dragging||undefined} data-sidebar-drop-section={drag.targetSection||undefined}>
        <style>{stylesheet}</style>
        {!wide?<div className="p-1"><SidebarHeaderIconButton label={t('search')} onClick={()=>{focusRequested.current=true;expandSidebar();}}><SearchIcon/></SidebarHeaderIconButton></div>:<>
          <SidebarContent className="min-h-full" fixedHeader={<SidebarGroup className="dsi-t3-header" ref={header}>
            <SidebarThreadHeader hasProjects={true} projectScope={projectScope} onNewProject={()=>{if(canAdd)void actions.addWorkspace();}}
              onNewThread={()=>void actions.start(project)} newThreadDisabled={!canCreate} newProjectDisabled={!canAdd}
              searchInputRef={input} searchQuery={query} onSearchQueryChange={value=>{setQuery(value.replaceAll('\0','').slice(0,500));setLimit(60);}}
              onSearchKeyDown={e=>{
                if(e.nativeEvent.isComposing)return;
                if(e.key==='Escape'){e.preventDefault();setQuery('');}
                if(needle&&searchRows.length&&['ArrowUp','ArrowDown','Enter'].includes(e.key)){
                  e.preventDefault();if(e.key==='Enter')void actions.open(searchRows[Math.min(activeResult,searchRows.length-1)].id);
                  else setActiveResult(n=>(n+(e.key==='ArrowUp'?-1:1)+searchRows.length)%searchRows.length);
                }
              }} isSearching={!!needle} searchResultCount={searchRows.length} activeSearchResultIndex={Math.min(activeResult,searchRows.length-1)} onClearSearch={()=>setQuery('')}
              showNewThreadInProjectHint={false}/>
            {project&&<div className="mt-1 flex items-center gap-1 px-2 text-xs text-secondary-label"><span className="min-w-0 flex-1 truncate">{data.workspaces.find(w=>w.workspaceId===project)?.title||project}</span><Button size="icon-micro" variant="ghost-muted" aria-label={t('allProjects')} onClick={()=>setProject('')}><XIcon className="size-3"/></Button></div>}
            {data.persistenceError&&<p role="alert" className="p-2 text-xs text-destructive-foreground">{t('storageFailed',{message:data.persistenceError})}</p>}
            {data.operationError&&<div role="alert" className="flex items-start gap-1 p-2 text-xs text-destructive-foreground"><span className="min-w-0 flex-1 wrap-anywhere">{t('operationFailed',{message:data.operationError})}</span><Button size="icon-micro" variant="ghost" aria-label={t('close')} onClick={actions.dismissError}><XIcon className="size-3"/></Button></div>}
          </SidebarGroup>}>
            <SidebarGroup className="min-h-full flex-1">
              <TooltipScrollDismissArea className="flex min-h-full flex-1 flex-col">
                <ul ref={list} role={needle?'listbox':'presentation'} id={needle?'sidebar-thread-search-results':undefined} aria-label={needle?t('search'):undefined} className="relative flex min-h-full flex-1 flex-col gap-px">
                  {!!needle&&searchRows.map(rowElement)}
                  {!needle&&<>{drafts.map(rowElement)}
                  <SidebarDragBoundary marker="pinned-header" label={t('pinned')} visible={drag.dragging} isDropTarget={drag.targetSection==='pinned'}/>
                  {primary.slice(0,limit).filter(r=>r.pinned).map(rowElement)}
                  <SidebarDragBoundary marker="pinned-divider" label={t('inbox')} visible={drag.dragging} isDropTarget={drag.targetSection==='active'}/>
                  <SidebarSectionPlaceholder marker="active-placeholder" label={t('inbox')} showHint={drag.dragging&&!primary.some(r=>!r.pinned)} isDropTarget={drag.targetSection==='active'}/>
                  {primary.slice(0,limit).filter(r=>!r.pinned).map(rowElement)}
                  {primary.length>limit&&<li className="list-none"><Button variant="ghost-muted" className="w-full text-xs" onClick={()=>setLimit(n=>n+60)}>{t('more',{n:Math.min(60,primary.length-limit)})}</Button></li>}
                  </>}
                  {data.phase==='pending'&&<li className="list-none px-2.5 py-2 text-xs text-secondary-label" role="status">{t('loading')}</li>}
                  {data.phase==='error'&&<li className="list-none p-2 text-xs" role="alert">{t('loadFailed')}<Button variant="ghost" onClick={actions.retry}>{t('retry')}</Button></li>}
                  {data.phase==='ready'&&!primary.length&&!needle&&<li className="flex h-9 list-none items-center gap-2 px-2.5 text-xs text-secondary-label" role="status"><InboxIcon className="size-3.5"/>{t('empty')}</li>}
                  {!!needle&&currentSearch.pending&&<li role="status" className="list-none p-2 text-xs text-secondary-label">{t('searching')}</li>}
                  {!!needle&&!visible.length&&!currentSearch.pending&&<li className="list-none p-2 text-sm text-secondary-label">{t('noMatches')}</li>}
                  {!!needle&&currentSearch.error&&<li role="alert" className="list-none p-2 text-xs text-destructive-foreground">{t('searchFailed',{message:currentSearch.error})}</li>}
                  {data.connectionState==='loading'&&data.phase==='ready'&&<li role="status" className="list-none p-2 text-xs text-secondary-label">{t('reconnecting')}</li>}
                  {!needle&&snoozed.length>0&&<><SidebarSectionHeader marker="snoozed-header" label={t('snoozed')} count={snoozed.length} className="mt-auto" dragging={drag.dragging} isDropTarget={drag.targetSection==='snoozed'} toggle={{expanded:views.snoozed.open,onToggle:views.snoozed.toggle}}/>
                    {views.snoozed.open&&snoozed.slice(0,views.snoozed.limit).map(rowElement)}
                    {views.snoozed.open&&snoozed.length>views.snoozed.limit&&<li className="list-none"><Button variant="ghost-muted" className="w-full text-xs" onClick={views.snoozed.more}>{t('more',{n:Math.min(40,snoozed.length-views.snoozed.limit)})}</Button></li>}</>}
                  {!needle&&(settled.length>0||drag.dragging)&&<><SidebarSectionHeader marker="settled-header" label={t('settled')} count={settled.length} className={cn(!snoozed.length&&'mt-auto')} dragging={drag.dragging} isDropTarget={drag.targetSection==='settled'} toggle={{expanded:views.settled.open,onToggle:views.settled.toggle}}/>
                    <SidebarSectionPlaceholder marker="settled-placeholder" label={t('settled')} showHint={drag.dragging&&(!views.settled.open||!settled.length)} isDropTarget={drag.targetSection==='settled'}/>
                    {views.settled.open&&settled.slice(0,views.settled.limit).map(rowElement)}
                    {views.settled.open&&settled.length>views.settled.limit&&<li className="list-none"><Button variant="ghost-muted" className="w-full text-xs" onClick={views.settled.more}>{t('more',{n:Math.min(40,settled.length-views.settled.limit)})}</Button></li>}
                  </>}
                  {!!needle&&visible.length>limit&&<li className="list-none"><Button variant="ghost-muted" className="w-full text-xs" onClick={()=>setLimit(n=>n+60)}>{t('more',{n:Math.min(60,visible.length-limit)})}</Button></li>}
                  {!!needle&&currentSearch.hasMore&&<li className="list-none p-2 text-xs text-secondary-label">{t('searchMore')}</li>}
                </ul>
              </TooltipScrollDismissArea>
            </SidebarGroup>
          </SidebarContent>
          {data.undo&&<div className="dsi-t3-undo" role="status"><span className="min-w-0 flex-1 truncate">{t('undo_'+data.undo.kind)}</span><Button size="xs" variant="ghost" disabled={data.busy.has(data.undo.id)||data.busy.has('undo')} title={t('undoShortcut')} onClick={()=>void actions.undo()}>{t('undo')}</Button><Button size="icon-micro" variant="ghost-muted" aria-label={t('close')} onClick={actions.dismissUndo}><XIcon className="size-3"/></Button></div>}
        </>}
      </div></DragProvider>
      {customSnooze&&<CustomSnooze target={customSnooze} close={()=>setCustomSnooze(null)} t={t} actions={actions} portal={portal}/>}
    </TooltipProvider></SidebarRuntime.Provider></NativeIcons.Provider>;
  };
}
