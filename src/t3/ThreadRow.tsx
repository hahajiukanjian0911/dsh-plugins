import { useLayoutEffect, useRef, useId, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderIcon, PinIcon, ClockIcon, CheckIcon, Undo2Icon, SquarePenIcon, NewChatIcon, EllipsisIcon, CircleAlertIcon, InboxIcon } from './icons';
import { animateSidebarLayoutChanges } from '../vendor/t3-sidebar/Sidebar.logic';
import { SidebarThreadPresentation } from '../vendor/t3-web/components/sidebar/SidebarThreadPresentation';
import { cn } from '../vendor/t3-web/lib/utils';
import { Spinner } from '../vendor/t3-web/components/ui/spinner';
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator, MenuSub, MenuSubTrigger, MenuSubPopup } from '../vendor/t3-web/components/ui/menu';
import { Menu as ContextMenu, MenuTrigger as ContextTrigger, MenuPopup as ContextPopup } from '../vendor/t3-web/components/ui/context-menu';
import { useSidebarRuntime } from './runtime';
export const SIDEBAR_SORTABLE_DRAG_DISABLED={draggable:true};
const ENABLED={draggable:false};
export function relativeTime(at,t) {
  const n=Math.max(0,Math.floor((Date.now()-at)/60000));
  return n<1?t('now'):n<60?t('minutes',{n}):n<1440?t('hours',{n:Math.floor(n/60)}):t('days',{n:Math.floor(n/1440)});
}
export function snoozePresets(now) {
  const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(9,0,0,0);
  const monday=new Date(now);monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));monday.setHours(9,0,0,0);
  return [['hourLater',now+3600000],['tomorrow',+tomorrow],['monday',+monday]];
}
export function ThreadRow({row,rename,drag,order,busy,snippet,searchProps}) {
  const {t,actions,onCustomSnooze,preferences}=useSidebarRuntime();
  const edit=rename.state?.id===row.id?rename.state:null;
  const slim=row.section==='settled',draft=row.section==='draft',parked=slim||row.section==='snoozed';
  const sortable=useSortable({id:row.id,disabled:draft||busy||drag.disabled||!!edit?SIDEBAR_SORTABLE_DRAG_DISABLED:ENABLED,
    animateLayoutChanges:animateSidebarLayoutChanges});
  const [menuOpen,setMenuOpen]=useState(false),[contextOpen,setContextOpen]=useState(false);
  const rowRef=useRef(null),input=useRef(null),errorId=useId();
  const project=row.workspace?.title||row.workspace?.path||row.session.cwd||t('ungrouped');
  const title=row.session.displayTitle||row.session.title||t('newSession');
  const begin=()=>{ if(!busy) rename.begin(row,title); };
  useLayoutEffect(()=>{if(edit){input.current?.focus({preventScroll:true});input.current?.select();}},[!!edit]);
  const titleNode=edit?<input ref={input} aria-label={t('rename')} value={edit.value} readOnly={edit.saving}
    aria-busy={edit.saving} aria-invalid={!!edit.error} aria-describedby={edit.error?errorId:undefined}
    className="dsi-title-input min-w-0 flex-1"
    onChange={e=>rename.change(row.id,e.target.value)} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
    onBlur={()=>void rename.commit(row.id,false)} onKeyDown={e=>{
      e.stopPropagation();if(e.nativeEvent.isComposing||e.keyCode===229)return;
      if(e.key==='Enter'){e.preventDefault();void rename.commit(row.id,true);}
      if(e.key==='Escape'){e.preventDefault();rename.cancel(row.id);}
    }}/>:<span dir="auto" data-row-title="" className={cn('min-w-0 flex-1 truncate text-start text-sm transition-opacity motion-reduce:transition-none',
      !slim&&(row.unread||row.attention)?'font-medium':'font-normal')}>{title}</span>;
  const critical=!slim&&!!(row.running||row.attention||row.record.error||row.unread||draft||row.section==='snoozed');
  let label=relativeTime(row.activityAt,t),StatusIcon=null,tone='text-secondary-label';
  if(draft){label=t('unsent');tone='text-secondary-label';}
  else if(!slim&&row.attention){label=t(row.attention==='approval'?'approval':row.attention==='plan-review'?'plan':'answer');StatusIcon=CircleAlertIcon;tone='text-warning-foreground';}
  else if(!slim&&row.record.error){label=t('failed');StatusIcon=CircleAlertIcon;tone='text-destructive-foreground';}
  else if(!slim&&row.running){label=t('working');StatusIcon=Spinner;tone='text-primary';}
  else if(row.section==='snoozed'){label=new Date(row.record.snoozedUntil).toLocaleString([],{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});StatusIcon=ClockIcon;}
  else if(!slim&&row.unread){label=relativeTime(row.activityAt,t);tone='text-secondary-label';}
  const status=<span data-row-status="" aria-label={!slim&&row.unread?t('completed')+', '+label:undefined} className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums',tone,
    !critical&&!edit&&'dsi-t3-quiet-time')}>{!slim&&row.unread&&<span className="dsi-unread-dot"/>}{StatusIcon&&<StatusIcon aria-hidden="true" className="size-3.5"/>}{label}{!slim&&row.running&&<span>{relativeTime(row.activityAt,t)}</span>}</span>;
  const settle=()=>actions.settle(row.id,order);
  const restore=()=>actions.restore(row.id);
  const menuItems=<>
    <MenuItem onClick={()=>actions.open(row.id)}>{t('openSession')}</MenuItem>
    <MenuItem disabled={busy||draft||row.archived} onClick={begin}><SquarePenIcon/>{t('rename')}</MenuItem>
    {!draft&&<>
      <MenuSeparator/>
      {parked?<MenuItem disabled={busy} onClick={restore}><Undo2Icon/>{t('restore')}</MenuItem>:<>
        <MenuItem disabled={busy} onClick={()=>actions.pin(row.id)}><PinIcon/>{t(row.pinned?'unpin':'pin')}</MenuItem>
        <MenuSub><MenuSubTrigger disabled={busy||!!row.attention}><ClockIcon/>{t('snooze')}</MenuSubTrigger>
          <MenuSubPopup>{snoozePresets(Date.now()).map(([key,until])=><MenuItem key={key} onClick={()=>actions.snooze(row.id,until,order)}>{t(key)}</MenuItem>)}
            <MenuItem onClick={()=>onCustomSnooze(row,order)}>{t('customTime')}</MenuItem></MenuSubPopup>
        </MenuSub>
        <MenuItem disabled={busy||row.running||!!row.attention} onClick={settle}><CheckIcon/>{t('settle')}</MenuItem>
      </>}
    </>}
  </>;
  const controls=!edit&&!draft?<span data-row-actions="" className={cn('dsi-t3-actions items-center gap-0.5',critical&&'ml-1',menuOpen&&'dsi-t3-actions-open')} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <button className="inline-flex h-5 items-center rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
      type="button" disabled={busy||!parked&&(row.running||!!row.attention)} aria-label={t(parked?'restore':'settle')} onClick={parked?restore:settle}>
      {parked?<Undo2Icon className="size-3.5"/>:t('settle')}</button>
    <Menu open={menuOpen} onOpenChange={setMenuOpen}><MenuTrigger aria-label={t('sessionActions')} className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"><EllipsisIcon className="size-3.5"/></MenuTrigger>
      <MenuPopup side="bottom" align="end">{menuItems}</MenuPopup></Menu>
  </span>:null;
  const keyDown=e=>{
    if(edit||e.target!==e.currentTarget)return;
    if(e.key==='F2'){e.preventDefault();begin();}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();void actions.open(row.id);}
    if(!e.altKey&&['ArrowUp','ArrowDown','Home','End'].includes(e.key)){
      const all=[...rowRef.current.closest('ul').querySelectorAll('[data-sidebar-row]')];
      const index=all.indexOf(rowRef.current),direction=e.key==='ArrowUp'?-1:1;
      const next=all[e.key==='Home'?0:e.key==='End'?all.length-1:Math.max(0,Math.min(all.length-1,index+direction))];
      if(next){e.preventDefault();next.focus();}
    }
    if(e.altKey&&!parked&&['ArrowUp','ArrowDown'].includes(e.key)){
      const index=order.indexOf(row.id)+(e.key==='ArrowUp'?-1:1),anchor=drag.rows.find(r=>r.id===order[index]);
      if(anchor&&anchor.pinned===row.pinned){e.preventDefault();void actions.move(row.id,{section:row.pinned?'pinned':'inbox',[e.key==='ArrowUp'?'beforeId':'afterId']:anchor.id});}
    }
  };
  const rowProps={ref:rowRef,'data-session-id':row.id,'data-section':row.section,'aria-label':[project,title,label].join(', '),
    onClick:edit?undefined:()=>void actions.open(row.id),onDoubleClick:edit?undefined:begin,onKeyDown:keyDown,...searchProps};
  return <ContextMenu open={contextOpen} onOpenChange={setContextOpen}>
    <ContextTrigger render={<SidebarThreadPresentation id={row.id} tooltipsEnabled={preferences.sessionTooltips} slim={slim} active={row.current} draft={draft}
      quiet={parked} dragging={sortable.isDragging} editing={!!edit} rowProps={rowProps}
      sortableProps={{ref:sortable.setNodeRef,'data-session-id':row.id,'data-dragging':sortable.isDragging||undefined,
        style:{transform:CSS.Translate.toString(sortable.transform),transition:sortable.transition,
          visibility:!sortable.isDragging&&sortable.transform?.scaleY===0?'hidden':undefined},
        onPointerDown:e=>{if(!e.target.closest('input,button,[role=menuitem]'))sortable.listeners?.onPointerDown?.(e);}}}
      project={project} projectIcon={<FolderIcon className={cn('dsi-project-icon size-3.5 shrink-0',row.current&&'dsi-project-current')}/>}
      draftIndicator={draft&&<NewChatIcon className="size-3.5 shrink-0 text-secondary-label"/>}
      pin={row.pinned&&<button type="button" aria-label={t('unpin')} disabled={busy} className="inline-flex shrink-0 text-muted-foreground/65 hover:text-foreground" onClick={e=>{e.stopPropagation();void actions.pin(row.id);}}><PinIcon className="size-3"/></button>}
      status={status} title={titleNode} actions={controls} snippet={snippet}
      details={<><div>{project} · {title}</div><div className="mt-1 text-muted-foreground">{new Date(row.activityAt).toLocaleString()}</div></>}
      error={edit?.error&&<div id={errorId} role="alert" className="px-2.5 py-1 text-xs text-destructive-foreground">{edit.error}</div>}
    />}/>
    <ContextPopup>{menuItems}</ContextPopup>
  </ContextMenu>;
}
