import { withNativeRef, useCleanupRef } from "@dsh-t3/compat";
import * as React from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';
import { Input, type InputProps } from './input';
import { ScrollArea } from './scroll-area';
import { Tooltip, TooltipPopup, TooltipTrigger } from './tooltip';
import { useSidebar } from '@dsh-t3/runtime';
function SidebarInputImpl({ className, ...props }: Omit<InputProps, "unstyled" | "variant">) {
  return (
    <Input
      className={cn(
        "[&_[data-slot=input]]:h-auto [&_[data-slot=input]]:p-0 [&_[data-slot=input]]:font-medium [&_[data-slot=input]]:text-sidebar-foreground [&_[data-slot=input]]:text-sm [&_[data-slot=input]]:leading-normal [&_[data-slot=input]]:placeholder:text-sidebar-muted-foreground",
        className,
      )}
      unstyled
      {...props}
    />
  );
}
const SidebarInput = withNativeRef(SidebarInputImpl);

function SidebarHeaderImpl({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}
const SidebarHeader = withNativeRef(SidebarHeaderImpl);

function SidebarFooterImpl({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-[var(--sidebar-content-inset)] pt-1 pb-[var(--sidebar-content-inset)]",
        className,
      )}
      data-sidebar="footer"
      data-slot="sidebar-footer"
      {...props}
    />
  );
}
const SidebarFooter = withNativeRef(SidebarFooterImpl);

function SidebarContentImpl({
  className,
  fixedHeader,
  ...props
}: React.ComponentProps<"div"> & {
  fixedHeader?: React.ReactNode;
}) {
  return (
    <>
      {fixedHeader ? <div className="w-full shrink-0">{fixedHeader}</div> : null}
      <ScrollArea
        hideScrollbars
        scrollFade
        scrollFadePadding={false}
        // Rows provide keyboard access; exclude the viewport from tab order to flatten VoiceOver's WebKit
        // interaction boundary.
        viewportTabIndex={-1}
        className="h-auto min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:[--fade-size:0.75rem]"
      >
        <div
          className={cn(
            "flex w-full min-w-0 flex-col [overflow-anchor:none] group-data-[collapsible=icon]:overflow-hidden [&>[data-sidebar=group]+[data-sidebar=group]]:pt-0",
            fixedHeader && "[&>[data-sidebar=group]:first-child]:pt-0",
            className,
          )}
          data-sidebar="content"
          data-slot="sidebar-content"
          {...props}
        />
      </ScrollArea>
    </>
  );
}
const SidebarContent = withNativeRef(SidebarContentImpl);

function SidebarGroupImpl({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-col p-[var(--sidebar-content-inset)]",
        className,
      )}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}
const SidebarGroup = withNativeRef(SidebarGroupImpl);

function SidebarMenuImpl({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}
const SidebarMenu = withNativeRef(SidebarMenuImpl);

function SidebarMenuItemImpl({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("group/menu-item relative", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}
const SidebarMenuItem = withNativeRef(SidebarMenuItemImpl);

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full cursor-pointer items-center gap-[var(--sidebar-control-gap)] overflow-hidden text-left outline-hidden ring-ring transition-[width,height,padding] hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset active:bg-sidebar-row-active active:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-64 aria-disabled:pointer-events-none aria-disabled:opacity-64 data-[active=true]:bg-sidebar-row-selected data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground data-[state=open]:hover:bg-sidebar-row-hover data-[state=open]:hover:text-sidebar-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-[var(--sidebar-content-inset)]! [&>span:last-child]:truncate [&>svg:not([class*='size-'])]:size-4 [&>svg]:shrink-0 [&>svg]:text-[var(--sidebar-icon-color)] hover:[&>svg]:text-sidebar-foreground active:[&>svg]:text-sidebar-foreground data-[active=true]:[&>svg]:text-sidebar-foreground",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-8 rounded-[var(--control-radius)] px-[var(--sidebar-row-content-inset)] py-1.5 text-sm",
        icon: "size-8 justify-center rounded-[var(--control-radius)] p-0",
        lg: "h-12 rounded-[var(--control-radius)] px-[var(--sidebar-row-content-inset)] py-2 text-sm group-data-[collapsible=icon]:p-0!",
        sm: "h-7 rounded-[var(--control-radius)] px-[var(--sidebar-row-content-inset)] py-2 text-xs",
      },
      variant: {
        default: "font-medium text-sidebar-muted-foreground/80",
        outline: "bg-sidebar-control-surface ring-1 ring-sidebar-border",
      },
    },
  },
);
function SidebarMenuButtonImpl({
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipPopup>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();

  const defaultProps = {
    className: cn(sidebarMenuButtonVariants({ size, variant }), className),
    "data-active": isActive,
    "data-sidebar": "menu-button",
    "data-size": size,
    "data-slot": "sidebar-menu-button",
  };

  const buttonProps = mergeProps<"button">(defaultProps, props);

  const buttonElement = useRender({
    defaultTagName: "button",
    props: buttonProps,
    render,
  });

  if (!tooltip) {
    return buttonElement;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger render={buttonElement as React.ReactElement<Record<string, unknown>>} />
      <TooltipPopup
        align="center"
        hidden={state !== "collapsed" || isMobile}
        side="right"
        {...tooltip}
      />
    </Tooltip>
  );
}
const SidebarMenuButton = withNativeRef(SidebarMenuButtonImpl);

export {SidebarInput,SidebarHeader,SidebarFooter,SidebarContent,SidebarGroup,SidebarMenu,SidebarMenuItem,SidebarMenuButton};
