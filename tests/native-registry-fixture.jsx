import React from 'react';
import { createRoot } from 'react-dom/client';
import { source } from './host-fixture.js';

// Real installed Cordis, SlotRegistry, SlotCore and React slot renderer. Only
// application/session/RPC sources are fixtures; declarations and assembly are not.
export function installNativeRegistry(fixture) {
  const { Context } = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/cordis'];
  const { SlotRegistry, createSlotRenderer } = globalThis.__DSH_NATIVE_RENDERER__;
  const context = new Context(), registry = new SlotRegistry(context);
  let App;
  registry.install(createSlotRenderer());
  const locale = source({ revision: 0 });
  registry.installLocale({ ...locale, bind: ns => fixture.ctx.locale.bind(ns) });
  const session = source(undefined);
  registry.installScope('session', { current: session, bindingSource: () => session,
    renderArea: (_binding, props) => props.children });
  registry.provideRoot({ hooks: { workspaces: fixture.workspaces } });
  registry.register({ name: 'root', children: {
    'settings.section': { kind: 'list', scope: 'root' },
    'settings.section.icon': { kind: 'list', scope: 'root' },
    'settings.launcher': { kind: 'single', scope: 'root' },
    'sidebar.workspaces': { kind: 'single', scope: 'root' },
    'conversation.hero.workspace': { kind: 'single', scope: 'root' },
    'conversation.input.dock': { kind: 'list', scope: 'session' },
  } }, props => App ? React.createElement(App, props) : null);
  registry.register({ name: 'sidebar.workspaces', priority: 0,
    children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
    inject: fixture.original.inject,
  }, () => null);
  fixture.ctx.slots = registry;
  fixture.nativeRegistry = registry;
  fixture.winner = (key = 'sidebar.workspaces') => registry.entriesOfSlot(key)[0];
  fixture.renderNativeComposer = Component => {
    App = Component;
    createRoot(document.getElementById('preview')).render(registry.renderSlot('root', {}));
  };
}
