import React from "react";
import { createRoot } from "react-dom/client";
import { projectGroups, defaultActions } from "../src/model.mjs";
const P =
    globalThis.__DSH_NATIVE_MODULES__["@deepseek-ai/dsh-client-ui-primitives"],
  params = new URLSearchParams(location.search);
const localId = "env-local",
  remoteId = "env-remote",
  metadata = {
    revision: 0,
    projects: {},
    assignments: {},
    defaults: {
      actions: [
        { id: "check", name: "检查", command: "npm run check", icon: "code" },
        {
          id: "dev",
          name: "启动开发服务",
          command: "npm run dev",
          icon: "globe",
        },
      ],
    },
  };
const environments = [
  {
    id: localId,
    name: "MacBook Air",
    online: true,
    local: true,
    workspaces: [
      {
        id: "plugins",
        title: "dsh-plugins",
        path: "/Users/example/Development/tools/dsh-plugins",
        repoKey: "git:github.com/example/dsh-plugins",
        branch: "main",
        sessionCount: 12,
      },
      {
        id: "timering",
        title: "TimeRing",
        path: "/Users/example/Development/products/TimeRing",
        repoKey: "git:github.com/example/timering",
        branch: "main",
        sessionCount: 8,
      },
      {
        id: "learn",
        title: "AgentLearn",
        path: "/Users/example/Development/experiments/AgentLearn",
        branch: "main",
        sessionCount: 2,
      },
      {
        id: "notes",
        title: "个人日志",
        path: "/Users/example/Documents/个人日志",
        sessionCount: 6,
      },
    ],
  },
  {
    id: remoteId,
    name: "开发服务器",
    url: "https://dev.example.test/",
    online: !params.has("offline"),
    workspaces: [
      {
        id: "plugins-vps",
        title: "dsh-plugins",
        path: "/home/example/projects/dsh-plugins",
        repoKey: "git:github.com/example/dsh-plugins",
        branch: "feature/projects",
        sessionCount: 3,
      },
    ],
  },
];
metadata.projects["git:github.com/example/dsh-plugins"] = {
  icon: { kind: "monogram", value: "DP", color: "#6366f1" },
};
metadata.projects["git:github.com/example/timering"] = {
  icon: { kind: "glyph", value: "globe", color: "#0ea5e9" },
};
const runs = [],
  calls = [],
  sessions = [];
function snapshot() {
  return {
    ...structuredClone(metadata),
    localId,
    environments: structuredClone(environments),
    projects: projectGroups(metadata, environments),
    defaults: {
      ...structuredClone(metadata.defaults),
      resolved: Object.fromEntries(
        environments.map((e) => [e.id, defaultActions(metadata, e.id)]),
      ),
      mixed:
        new Set(
          environments.map((e) =>
            JSON.stringify(defaultActions(metadata, e.id)),
          ),
        ).size > 1,
    },
    runs: structuredClone(runs),
  };
}
const ctx = {
  connection: {
    rpc: {
      async call(route, method, { args: { request: r } }) {
        calls.push({ method, request: r });
        try {
          if (method === "projectManager/load")
            return { ok: true, value: snapshot() };
          if (method === "projectManager/change") {
            const p = projectGroups(metadata, environments).find(
                (p) => p.key === r.projectKey,
              ),
              meta = p ? (metadata.projects[p.key] ??= {}) : null;
            if (r.op === "rename") {
              meta.name = r.name;
              for (const c of p.checkouts)
                environments
                  .find((e) => e.id === c.environmentId)
                  .workspaces.find((w) => w.id === c.id).title = r.name;
            } else if (r.op === "icon") meta.icon = r.icon;
            else if (r.op === "organize") {
              if ("pinned" in r) meta.pinned = r.pinned;
              if ("archived" in r) meta.archived = r.archived;
            } else if (r.op === "actions") {
              if (!r.environmentId || r.environmentId === "all") {
                meta.actions = r.actions;
                delete meta.actionsByEnvironment;
              } else
                (meta.actionsByEnvironment ??= {})[r.environmentId] = r.actions;
            } else if (r.op === "defaults") {
              if (!r.environmentId || r.environmentId === "all") {
                metadata.defaults.actions = r.actions;
                delete metadata.defaults.byEnvironment;
              } else
                (metadata.defaults.byEnvironment ??= {})[r.environmentId] =
                  r.actions;
            } else if (r.op === "assign") {
              if (r.destination === "auto")
                delete metadata.assignments[r.checkoutKey];
              else
                metadata.assignments[r.checkoutKey] =
                  r.destination === "separate"
                    ? "group:" + crypto.randomUUID()
                    : r.destination;
            } else if (r.op === "removeProject")
              for (const e of environments)
                e.workspaces = e.workspaces.filter(
                  (w) =>
                    !p.checkouts.some(
                      (c) => c.id === w.id && c.environmentId === e.id,
                    ),
                );
            else if (r.op === "removeCheckout")
              for (const e of environments)
                e.workspaces = e.workspaces.filter(
                  (w) => e.id + ":" + w.id !== r.checkoutKey,
                );
            else if (r.op === "addCheckout") {
              const id = crypto.randomUUID();
              environments
                .find((e) => e.id === r.environmentId)
                .workspaces.push({
                  id,
                  title: r.name || "新项目",
                  path: r.path,
                });
              if (r.projectKey)
                metadata.assignments[r.environmentId + ":" + id] = r.projectKey;
            } else if (r.op === "connect")
              throw new Error("示例页面不连接实际环境。");
            else if (r.op === "disconnect")
              environments.splice(
                environments.findIndex((e) => e.id === r.environmentId),
                1,
              );
            metadata.revision++;
            return { ok: true, value: { revision: metadata.revision } };
          }
          if (r.op === "launch")
            return {
              ok: true,
              value: {
                local: true,
                workspaceId: r.checkoutKey.split(":").at(-1),
              },
            };
          if (r.op === "importActions")
            return {
              ok: true,
              value: [
                {
                  id: crypto.randomUUID(),
                  name: "测试",
                  command: "npm test",
                  icon: "code",
                },
              ],
            };
          if (r.op === "run") {
            const action = projectGroups(metadata, environments)
              .find((p) => p.key === r.projectKey)
              .actionsByEnvironment[r.checkoutKey.split(":")[0]].find(
                (a) => a.id === r.actionId,
              );
            const run = {
              id: crypto.randomUUID(),
              environmentId: r.checkoutKey.split(":")[0],
              checkoutId: r.checkoutKey.split(":")[1],
              name: action.name,
              command: action.command,
              cwd: "/Users/example/Development/tools/dsh-plugins",
              status: "running",
              exitCode: null,
              output:
                "> " + action.command + "\n示例输出；此页面未运行命令。\n",
            };
            runs.unshift(run);
            return { ok: true, value: structuredClone(run) };
          }
          if (r.op === "runStatus")
            return {
              ok: true,
              value: structuredClone(runs.find((run) => run.id === r.runId)),
            };
          if (r.op === "stop") {
            const run = runs.find((run) => run.id === r.runId);
            run.status = "stopped";
            return { ok: true, value: structuredClone(run) };
          }
          return { ok: true, value: { ok: true } };
        } catch (e) {
          return { ok: false, error: { message: e.message } };
        }
      },
    },
  },
  uiWorkspace: {
    startSession: (id) => sessions.push(id),
    pickDirectory: async () => "/Users/example/Development/new-project",
  },
  workspaces: {
    list: {
      getSnapshot: () => ({ phase: "ready", items: [] }),
      subscribe: () => () => {},
    },
  },
  locale: {
    register: () => () => {},
    bind: () => (key) => ({ title: "项目", environments: "环境" })[key],
  },
  effect(fn) {
    fn();
  },
};
const entries = [];
ctx.slots = {
  inject(name, fn) {
    fn();
  },
  register(entry, component) {
    entries.push({ ...entry, component });
    return () => {};
  },
};
window
  .__projectManagerFactory((id) => globalThis.__DSH_NATIVE_MODULES__[id])
  .apply(ctx);
const entry = entries.find(
    (e) =>
      e.id ===
        (params.get("page") === "environments"
          ? "dsh-project-environments"
          : "dsh-project-manager") && e.name === "settings.section",
  ),
  injected = entry.inject(),
  controller = injected.controller;
const svgNS = "http://www.w3.org/2000/svg",
  sprite = document.createElementNS(svgNS, "svg");
sprite.setAttribute("aria-hidden", "true");
sprite.style.cssText =
  "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
for (const [id, source] of Object.entries(P.ICON_SYMBOLS)) {
  const svg = new DOMParser().parseFromString(
      source,
      "image/svg+xml",
    ).documentElement,
    symbol = document.createElementNS(svgNS, "symbol");
  symbol.id = id;
  for (const attr of svg.attributes)
    if (attr.name !== "xmlns") symbol.setAttribute(attr.name, attr.value);
  while (svg.firstChild) symbol.append(svg.firstChild);
  sprite.append(symbol);
}
document.body.prepend(sprite);
const media = matchMedia("(prefers-color-scheme:dark)"),
  theme = () =>
    document.body.toggleAttribute("data-ds-dark-theme", media.matches);
theme();
media.addEventListener("change", theme);
const styles = document.createElement("style");
styles.textContent =
  "html,body{margin:0;height:100%;font-family:var(--dsw-font-family,system-ui);color:var(--dsw-alias-label-primary)}*{box-sizing:border-box}.preview-surface{height:100vh;background:var(--dsw-alias-bg-base)}";
document.head.append(styles);
function App() {
  const [active, setActive] = React.useState(entry.id),
    { SettingsPanel } = globalThis.__DSH_NATIVE_SETTINGS__;
  const renderSlot = (name, props = {}, options = {}) => {
    if (name === "settings.header") return "设置";
    if (name === "settings.close") return "关闭设置";
    const e = entries.find((e) => e.name === name && e.id === options.only);
    if (!e) return null;
    const Component = e.component,
      values = e.inject?.() || {};
    return (
      <Component
        {...props}
        {...values}
        useProjectManager={(selector) =>
          React.useSyncExternalStore(controller.subscribe, () =>
            selector(controller.getSnapshot()),
          )
        }
      />
    );
  };
  return (
    <div className="preview-surface">
      <SettingsPanel
        rows={entries
          .filter((e) => e.name === "settings.section")
          .map((e) => ({ id: e.id, label: e.label() }))}
        renderSlot={renderSlot}
        activeId={active}
        onSelect={setActive}
        onClose={() => sessions.push("close-settings")}
      />
    </div>
  );
}
window.projectDemo = { controller, calls, sessions, environments, metadata };
createRoot(document.getElementById("preview")).render(<App />);
