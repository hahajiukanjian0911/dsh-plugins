export const COLORS = [
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];
export const GLYPHS = [
  "folder",
  "code",
  "document",
  "globe",
  "settings",
  "database",
  "shield",
  "branch",
  "sparkle",
  "clock",
  "chat",
  "link",
];
export function text(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label}不能为空，且不能超过 ${max} 个字符。`);
  return value.trim();
}
export function iconValue(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("图标格式无效。");
  const color = COLORS.includes(value.color) ? value.color : COLORS[7];
  if (value.kind === "glyph" && GLYPHS.includes(value.value))
    return { kind: "glyph", value: value.value, color };
  if (value.kind === "monogram")
    return { kind: "monogram", value: text(value.value, "字母图标", 2), color };
  if (value.kind === "emoji")
    return { kind: "emoji", value: text(value.value, "Emoji", 12), color };
  if (
    value.kind === "image" &&
    typeof value.value === "string" &&
    value.value.length < 350000 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.value)
  )
    return { kind: "image", value: value.value, color };
  throw new Error(
    "请选择图标、Emoji、字母，或小于 256 KB 的 PNG／JPEG／WebP 图片。",
  );
}
export function actionValue(value) {
  return {
    id: text(value.id, "操作标识", 80),
    name: text(value.name, "操作名称", 80),
    command: text(value.command, "命令", 12000),
    icon: GLYPHS.includes(value.icon) ? value.icon : "code",
  };
}
export function actionsValue(values) {
  if (!Array.isArray(values) || values.length > 64)
    throw new Error("最多保存 64 个操作。");
  const actions = values.map(actionValue);
  if (new Set(actions.map((a) => a.id)).size !== actions.length)
    throw new Error("操作标识重复。");
  return actions;
}
export function repositoryKey(origin) {
  if (!origin) return null;
  const value = origin
    .trim()
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/\.git\/?$/, "")
    .replace(/\/$/, "");
  try {
    const url = new URL(value);
    return `git:${url.hostname.toLowerCase()}${url.pathname}`;
  } catch {
    return null;
  }
}
export const defaultActions = (state, environmentId) =>
  state.defaults.byEnvironment?.[environmentId] ?? state.defaults.actions;
export function projectActions(state, key, environmentId) {
  const metadata = state.projects[key] ?? {},
    byEnvironment = metadata.actionsByEnvironment ?? {};
  return Object.hasOwn(byEnvironment, environmentId)
    ? (byEnvironment[environmentId] ?? defaultActions(state, environmentId))
    : (metadata.actions ?? defaultActions(state, environmentId));
}
export function projectGroups(state, environments) {
  const map = new Map();
  for (const env of environments)
    for (const workspace of env.workspaces ?? []) {
      const checkoutKey = `${env.id}:${workspace.id}`;
      const key =
        state.assignments[checkoutKey] ||
        workspace.repoKey ||
        `directory:${checkoutKey}`;
      const metadata = state.projects[key] ?? {};
      if (!map.has(key))
        map.set(key, {
          key,
          name: metadata.name || workspace.title,
          icon: metadata.icon ?? null,
          pinned: !!metadata.pinned,
          archived: !!metadata.archived,
          actions: projectActions(state, key, env.id),
          actionsByEnvironment: {},
          inheritanceByEnvironment: {},
          checkouts: [],
        });
      map.get(key).actionsByEnvironment[env.id] = projectActions(
        state,
        key,
        env.id,
      );
      map.get(key).inheritanceByEnvironment[env.id] = Object.hasOwn(
        metadata.actionsByEnvironment ?? {},
        env.id,
      )
        ? metadata.actionsByEnvironment[env.id] == null
        : metadata.actions == null;
      map
        .get(key)
        .checkouts.push({
          ...workspace,
          key: checkoutKey,
          environmentId: env.id,
          environmentName: env.name,
          online: env.online,
        });
    }
  for (const group of map.values()) {
    group.actionsMixed =
      new Set(
        Object.values(group.actionsByEnvironment).map((a) => JSON.stringify(a)),
      ).size > 1;
    group.inherited = Object.values(group.inheritanceByEnvironment).every(
      Boolean,
    );
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      a.name.localeCompare(b.name, "zh-Hans") ||
      a.key.localeCompare(b.key),
  );
}
export function selectProject(view, key, environmentId = "all") {
  const project = view.projects.find((p) => p.key === key);
  if (!project) throw new Error("项目已不存在，请刷新列表。");
  const checkouts = project.checkouts.filter(
    (c) => environmentId === "all" || c.environmentId === environmentId,
  );
  if (!checkouts.length) throw new Error("所选环境中没有这个项目。");
  return { ...project, checkouts };
}
export function checkRevision(state, revision) {
  if (!Number.isInteger(revision) || state.revision !== revision)
    throw new Error("项目配置已在其他窗口更改，请刷新后重试。");
}
