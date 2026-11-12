import React from 'react';
import { createRoot } from 'react-dom/client';
import { source } from '../tests/host-fixture.js';

// Real installed ConversationContent and WorkspacePicker; isolated directories,
// sessions, directory flow and RPC. Never drive the user's native window.
export function renderComposerPreview(fixture, projectDemo) {
  const { ConversationContent, zh, en } = globalThis.__DSH_NATIVE_CONVERSATION__;
  const { WorkspacePicker, zh: workspaceZh, en: workspaceEn } = globalThis.__DSH_NATIVE_WORKSPACE__;
  const P = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'];
  const current = source('draft:TimeRing'), flow = source(true), drafts = new Map();
  const language = document.documentElement.lang;
  const translate = dictionary => key => dictionary[key] || key;
  const t = translate(language === 'en' ? en : zh), workspaceT = translate(language === 'en' ? workspaceEn : workspaceZh);
  fixture.ctx.locale.register('workspace', { zh: workspaceZh, en: workspaceEn });
  const hook = value => select => React.useSyncExternalStore(value.subscribe, () => select(value.getSnapshot()));
  const snapshot = fixture.workspaces.getSnapshot();
  fixture.workspaces.set({ ...snapshot, items: snapshot.items.map(w => ({ ...w, sessionIds: [...w.sessionIds, 'draft:' + w.workspaceId] })) });
  const summaries = fixture.sessions.getSnapshot();
  fixture.sessions.set({ ...summaries, byId: { ...summaries.byId, ...Object.fromEntries(snapshot.items.map(w => ['draft:' + w.workspaceId, { id: 'draft:' + w.workspaceId, cwd: w.path, blank: true }])) } });
  const inputHub = { shell(id) {
    if (!drafts.has(id)) drafts.set(id, { text: '', attachmentIds: [], phase: 'plain' });
    const value = drafts.get(id);
    return { get snapshot() { return value; }, get draftSnapshot() { return { text: value.text }; },
      setDraft(draft) { value.text = typeof draft === 'string' ? draft : draft.text; },
      addAttachments(ids) { value.attachmentIds.push(...ids); return true; },
      removeAttachment(id) { value.attachmentIds = value.attachmentIds.filter(x => x !== id); } };
  } };
  let pickerOff, directoryPath = '/example/added-project';
  const demo = window.composerDemo = { fixture, projectDemo, current, flow, drafts, failSelection: false, failCreate: false, rebinds: [], selections: [],
    load: () => fixture.winner('settings.section').inject().controller.load(),
    disable() { pickerOff?.(); },
    setDirectory(path) { directoryPath = path; },
  };
  const controller = fixture.ctx.slots.entries('settings.section').find(e => e.options.id === 'dsh-project-manager').inject().controller;
  demo.controller = controller;
  Object.defineProperty(demo, 'failLoad', { get: () => fixture.projectLoadUnavailable,
    set: value => { fixture.projectLoadUnavailable = value; } });
  pickerOff = fixture.ctx.slots.register({ name: 'conversation.hero.workspace', priority: 0, locale: 'workspace',
    children: { 'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' } },
    inject: () => ({ hooks: { directoryFlow: flow }, createWorkspace: async ({ path }) => {
      if (demo.failCreate) throw new Error('示例目录登记失败');
      const workspace = { workspaceId: 'added-project', title: 'added-project', path, sessionIds: ['draft:added-project'] };
      const s = fixture.workspaces.getSnapshot(); fixture.workspaces.set({ ...s, items: [...s.items.filter(w => w.workspaceId !== workspace.workspaceId), workspace] });
      return workspace;
    } }),
  }, WorkspacePicker);
  const DirectoryFlow = owner => owner.open ? <P.Modal open title="选择示例目录" closeLabel="关闭" onClose={owner.onCancel}>
    <P.Button disabled={owner.busy} onClick={() => owner.onPicked(directoryPath)}>选择此目录</P.Button>
  </P.Modal> : null;
  fixture.ctx.slots.register({ name: 'conversation.hero.workspace.directoryFlow' }, DirectoryFlow);
  const rootStyle = document.createElement('style'); rootStyle.textContent = '#preview[data-composer-preview]{width:100vw;background:var(--dsw-alias-bg-base)}#preview[data-composer-preview]>div{width:100%;min-width:0}.composer-fixture-input{width:min(680px,calc(100vw - 48px));padding:12px;border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major)}.composer-fixture-input textarea{box-sizing:border-box;width:100%;height:96px;border:0;outline:none;resize:none;background:transparent;color:var(--dsw-alias-label-primary);font:14px/24px var(--dsw-font-family)}';
  document.head.append(rootStyle); document.getElementById('preview').setAttribute('data-composer-preview', '');
  const Nothing = () => null;
  function App({ renderSlot: nativeRenderSlot } = {}) {
    const id = React.useSyncExternalStore(current.subscribe, current.getSnapshot);
    const [revision, update] = React.useState(0);
    const nativeSelect = globalThis.__DSH_NATIVE_SELECT_WORKSPACE__({ sessionId: id, inputHub,
      workspaceNavigation: { async openWorkspace(workspaceId, onNext) {
        if (demo.failSelection) throw new Error('示例工作区切换失败');
        demo.selections.push(workspaceId);
        const nextId = 'draft:' + workspaceId; onNext(nextId); current.set(nextId);
      } }, sessions: { binding: () => ({ session: { getSnapshot: () => ({ subagent: null }) } }) },
      ctx: {}, concreteConversation: () => ({ rebindDraftFiles: (...args) => demo.rebinds.push(args) }),
    });
    const renderSlot = (name, props) => {
      if (name === 'conversation.hero.workspace') {
        if (nativeRenderSlot) return nativeRenderSlot(name, props);
        const entry = fixture.winner(name), Component = entry.component, injected = entry.inject();
        return <Component {...props} {...injected} useWorkspaces={hook(fixture.workspaces)} useDirectoryFlow={hook(flow)} t={workspaceT}
          renderSlot={(_name, owner) => <DirectoryFlow {...owner} />} />;
      }
      if (name === 'conversation.composer.bar') {
        const draft = inputHub.shell(id).snapshot;
        return <div className="composer-fixture-input"><textarea aria-label="示例会话草稿" value={draft.text} disabled={props.disabled}
          onChange={e => { inputHub.shell(id).setDraft(e.target.value); update(revision + 1); }} placeholder="发送消息或创建任务" /></div>;
      }
      return null;
    };
    return <ConversationContent sessionId={id} phase="ready" hero t={t} renderSlot={renderSlot}
      renderSlotChain={(_name, _props, options) => options.fallback} useFactorySlot={() => Nothing}
      useSession={select => select({ phase: 'ready' })} useSessions={hook(fixture.sessions)} useSessionStatus={hook(fixture.status)}
      useWorkspaces={hook(fixture.workspaces)} useInput={select => select(inputHub.shell(id).snapshot)}
      useComposerBlock={select => select(undefined)} selectWorkspace={nativeSelect} />;
  }
  if (fixture.renderNativeComposer) fixture.renderNativeComposer(App);
  else createRoot(document.getElementById('preview')).render(<App />);
  window.addEventListener('pagehide', () => fixture.dispose(), { once: true });
}
