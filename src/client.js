import { createSidebarPreferences } from './preferences.js';
import { createSidebarSettings } from './settings.jsx';
import settingsStyles from './settings.css';
import { createInboxController } from './controller.js';
import { createProjectCatalog } from './project-catalog.js';
import { createNativeSidebar } from './native/Sidebar.jsx';
import { createSettledNotice } from './settled-notice.jsx';
import { installAvatarLauncher } from './avatar-launcher.js';
import { en, zh } from './locales.js';
import stylesheet from './native/sidebar.css';
import footerIconsStyles from './native/footer-icons.css';
import compactHeaderStyles from './native/compact-header.css';
import settledNoticeStyles from './settled-notice.css';

export function createPlugin(require) {
    const React = require('react');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const SidebarSettings = createSidebarSettings(React, primitives, settingsStyles);
    const InboxSidebar = createNativeSidebar(React, stylesheet + footerIconsStyles + compactHeaderStyles, primitives);
    const SettledNotice = createSettledNotice(React, settledNoticeStyles);
    function SidebarSettingsIcon({ size = 16 }) { return React.createElement(primitives.IconPanelLeftOutlineRegular, { size }); }
    return {
      inject: ['slots', 'sessions', 'uiSession', 'workspaces', 'uiWorkspace', 'locale', 'layout', 'remote'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('inboxSidebar', { en, zh }), 'inbox-sidebar: locale');
        const preferences = createSidebarPreferences();
        ctx.effect(() => preferences.start(), 'inbox-sidebar: local preferences');
        installAvatarLauncher(ctx, React);
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'dsh-session-sidebar', order: 25,
          label: () => ctx.locale.bind('inboxSidebar')('settingsTitle'), locale: 'inboxSidebar',
          inject: () => ({ hooks: { sidebarPreferences: preferences },
            setPreference: preferences.set, resetPreferences: preferences.reset }),
        }, SidebarSettings));
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon', id: 'dsh-session-sidebar',
        }, SidebarSettingsIcon));
        const controller = createInboxController(ctx);
        ctx.effect(() => controller.start(), 'inbox-sidebar: data and clock');
        const projectCatalog = createProjectCatalog(ctx);
        ctx.effect(() => projectCatalog.start(), 'inbox-sidebar: shared project catalog');
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock', id: 'inbox-settled-notice', order: 100,
          locale: 'inboxSidebar',
          inject: () => ({ actions: controller.actions, hooks: { inbox: controller, sidebarPreferences: preferences } }),
        }, SettledNotice));
        ctx.slots.inject('sidebar.workspaces', () => ctx.effect(() => {
          let original;
          let disposeEntry;
          let installing = false;
          function install() {
            if (installing) return;
            const next = ctx.slots.entries('sidebar.workspaces')
              .find((entry) => entry.children?.['sidebar.workspaces.directoryFlow']);
            if (next === original) return;
            installing = true;
            try {
              disposeEntry?.();
              disposeEntry = undefined;
              original = next;
              if (!original) return;
              // Reuse the original command source so Cmd+K and Add workspace still reach this view.
              const native = original.inject();
              controller.setNative(native);
              disposeEntry = ctx.slots.register({
                name: 'sidebar.workspaces',
                priority: -100,
                locale: 'inboxSidebar',
                inject: () => ({
                  actions: controller.actions,
                  hooks: { inbox: controller, projectCatalog, sidebarPreferences: preferences, nativeShortcuts: native.hooks.workspaceShortcuts },
                }),
              }, InboxSidebar);
            } finally {
              installing = false;
            }
          }
          const unsubscribe = ctx.slots.subscribe('sidebar.workspaces', install);
          install();
          return () => { unsubscribe(); disposeEntry?.(); };
        }, 'inbox-sidebar: replace session browser'));
      },
    };
}
