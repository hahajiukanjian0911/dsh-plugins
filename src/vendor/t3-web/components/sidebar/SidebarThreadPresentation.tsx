// Adapted presentation extract from SidebarThreadRow.tsx, T3 Code 5d5ab80.
// Application queries, providers, PRs, terminals and file-drop UI are excluded.
// DSH-native surfaces wrap the retained T3 row/drag/tooltip structure.
import { forwardRef, useCallback } from 'react';
import { cn } from '~/lib/utils';
import { Tooltip, TooltipTrigger, TooltipPopup } from '../ui/tooltip';
export const SidebarThreadPresentation=forwardRef(function SidebarThreadPresentation({id,tooltipsEnabled=true,slim,active,draft,quiet,dragging,editing,
  sortableProps,rowProps,projectIcon,pin,draftIndicator,project,status,title,actions,details,error,snippet,...outer},ref) {
  const setRef=useCallback(node=>{sortableProps.ref?.(node);if(typeof ref==='function')ref(node);else if(ref)ref.current=node;},[sortableProps.ref,ref]);
  const surface='dsi-thread-row group/sidebar-row relative w-full cursor-pointer overflow-hidden text-left outline-none select-none';
  return <li {...outer} data-thread-item={id} {...sortableProps} ref={setRef} className={cn(
    'dsi-thread-item list-none [content-visibility:auto]',
    dragging&&'relative z-20',editing&&'[content-visibility:visible]')}>
    <Tooltip disabled={!tooltipsEnabled||editing||dragging}>
      <TooltipTrigger nativeButton={false} render={<div {...rowProps} role={rowProps.role||'button'} tabIndex={0}
        data-sidebar-row={id} data-testid={slim?'sidebar-row-slim':'sidebar-row-card'}
        data-dsi-active={active||undefined} data-dsi-draft={draft||undefined} data-dsi-quiet={quiet||undefined} data-dsi-dragging={dragging||undefined}
        aria-current={active?'page':undefined} className={cn(surface,slim&&'dsi-thread-slim flex items-center')}/> }>
        {slim?<>
          <span className="flex shrink-0 items-center">{projectIcon}</span>
          {title}{pin}<span className="relative ml-auto flex h-6 min-w-8 shrink-0 items-center justify-end">{status}{actions}</span>
        </>:<div data-sidebar-card-content="" className="relative z-10 h-auto">
          <div data-row-metadata="" className="flex min-w-0 items-center gap-1.5">
            {draftIndicator}{projectIcon}{pin}
            <span className="min-w-0 flex-1 truncate font-normal text-secondary-label text-xs">{project}</span>
            <span className="relative ml-auto flex h-5 min-w-8 shrink-0 items-center justify-end">{status}{actions}</span>
          </div>
          <div data-row-title-line="" className="flex min-w-0 items-center gap-1.5">{title}</div>
          {snippet&&<div className="mt-1 line-clamp-2 text-xs text-secondary-label">{snippet}</div>}
        </div>}
      </TooltipTrigger>
      <TooltipPopup side="right" align="start">{details}</TooltipPopup>
    </Tooltip>
    {error}
  </li>;
});
