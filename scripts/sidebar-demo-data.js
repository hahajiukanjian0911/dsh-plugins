import { STORAGE_PREFIX } from '../src/inbox-state.js';
// Preview fixtures only. This module never enters the installed client bundle.
export async function seedSidebarDemo(fixture, actions, { active = 0, history = 0 } = {}) {
  const base = Date.now(), day = 86400000, snapshot = fixture.sessions.getSnapshot(), byId = { ...snapshot.byId }, ids = [];
  const projects = ['TimeRing', 'LiQun', 'dsh-plugins'], titles = ['调整项目目录与检出规则', '修复输入框保存状态', '整理会话侧边栏', '核对打印流程', '问候', '检查同步结果'];
  for (const [kind, count] of [['active', active], ['history', history]]) for (let i = 0; i < Math.min(240, count); i++) {
    const id = kind + '-' + String(i).padStart(3, '0'), project = projects[i % projects.length];
    byId[id] = { id, title: kind === 'history' ? titles[i % titles.length] : '进行中的会话 ' + (i + 1), displayTitle: kind === 'history' ? titles[i % titles.length] : '进行中的会话 ' + (i + 1),
      cwd: '/example/' + project, updatedAt: base - (i + 10) * day, running: false, blank: false, retainedBy: { mainView: 0 } };
    ids.push(id);
  }
  fixture.sessions.set({ ...snapshot, ids: [...snapshot.ids, ...ids], byId });
  const workspaces = fixture.workspaces.getSnapshot();
  fixture.workspaces.set({ ...workspaces, items: workspaces.items.map(w => ({ ...w, sessionIds: [...w.sessionIds, ...ids.filter(id => byId[id].cwd === w.path)] })) });
  for (let i = 0; i < Math.min(240, history); i++) {
    const id = 'history-' + String(i).padStart(3, '0');
    await actions.settle(id, []);
    const key = STORAGE_PREFIX + id, record = JSON.parse(localStorage.getItem(key));
    record.settledAt = base - (i + 1) * 3600000;
    const value = JSON.stringify(record);localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  }
  actions.dismissUndo();
}
