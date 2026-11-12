// src/host.mjs
import { randomUUID as randomUUID3 } from "node:crypto";
import os from "node:os";
import { stat, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { credentialKey } from "@deepseek-ai/dsh-credentials";
import { z } from "zod";

// src/model.mjs
var COLORS = [
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899"
];
var GLYPHS = [
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
  "link"
];
function text(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label}\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E14\u4E0D\u80FD\u8D85\u8FC7 ${max} \u4E2A\u5B57\u7B26\u3002`);
  return value.trim();
}
function iconValue(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("\u56FE\u6807\u683C\u5F0F\u65E0\u6548\u3002");
  const color = COLORS.includes(value.color) ? value.color : COLORS[7];
  if (value.kind === "glyph" && GLYPHS.includes(value.value))
    return { kind: "glyph", value: value.value, color };
  if (value.kind === "monogram")
    return { kind: "monogram", value: text(value.value, "\u5B57\u6BCD\u56FE\u6807", 2), color };
  if (value.kind === "emoji")
    return { kind: "emoji", value: text(value.value, "Emoji", 12), color };
  if (value.kind === "image" && typeof value.value === "string" && value.value.length < 35e4 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.value))
    return { kind: "image", value: value.value, color };
  throw new Error(
    "\u8BF7\u9009\u62E9\u56FE\u6807\u3001Emoji\u3001\u5B57\u6BCD\uFF0C\u6216\u5C0F\u4E8E 256 KB \u7684 PNG\uFF0FJPEG\uFF0FWebP \u56FE\u7247\u3002"
  );
}
function actionValue(value) {
  return {
    id: text(value.id, "\u64CD\u4F5C\u6807\u8BC6", 80),
    name: text(value.name, "\u64CD\u4F5C\u540D\u79F0", 80),
    command: text(value.command, "\u547D\u4EE4", 12e3),
    icon: GLYPHS.includes(value.icon) ? value.icon : "code"
  };
}
function actionsValue(values) {
  if (!Array.isArray(values) || values.length > 64)
    throw new Error("\u6700\u591A\u4FDD\u5B58 64 \u4E2A\u64CD\u4F5C\u3002");
  const actions = values.map(actionValue);
  if (new Set(actions.map((a) => a.id)).size !== actions.length)
    throw new Error("\u64CD\u4F5C\u6807\u8BC6\u91CD\u590D\u3002");
  return actions;
}
function repositoryKey(origin) {
  if (!origin) return null;
  const value = origin.trim().replace(/^git@([^:]+):/, "https://$1/").replace(/^ssh:\/\/git@/, "https://").replace(/\.git\/?$/, "").replace(/\/$/, "");
  try {
    const url = new URL(value);
    return `git:${url.hostname.toLowerCase()}${url.pathname}`;
  } catch {
    return null;
  }
}
var defaultActions = (state, environmentId) => state.defaults.byEnvironment?.[environmentId] ?? state.defaults.actions;
function projectActions(state, key, environmentId) {
  const metadata = state.projects[key] ?? {}, byEnvironment = metadata.actionsByEnvironment ?? {};
  return Object.hasOwn(byEnvironment, environmentId) ? byEnvironment[environmentId] ?? defaultActions(state, environmentId) : metadata.actions ?? defaultActions(state, environmentId);
}
function projectGroups(state, environments) {
  const map = /* @__PURE__ */ new Map();
  for (const env of environments)
    for (const workspace of env.workspaces ?? []) {
      const checkoutKey = `${env.id}:${workspace.id}`;
      const key = state.assignments[checkoutKey] || workspace.repoKey || `directory:${checkoutKey}`;
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
          checkouts: []
        });
      map.get(key).actionsByEnvironment[env.id] = projectActions(
        state,
        key,
        env.id
      );
      map.get(key).inheritanceByEnvironment[env.id] = Object.hasOwn(
        metadata.actionsByEnvironment ?? {},
        env.id
      ) ? metadata.actionsByEnvironment[env.id] == null : metadata.actions == null;
      map.get(key).checkouts.push({
        ...workspace,
        key: checkoutKey,
        environmentId: env.id,
        environmentName: env.name,
        online: env.online
      });
    }
  for (const group of map.values()) {
    group.actionsMixed = new Set(
      Object.values(group.actionsByEnvironment).map((a) => JSON.stringify(a))
    ).size > 1;
    group.inherited = Object.values(group.inheritanceByEnvironment).every(
      Boolean
    );
  }
  return [...map.values()].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, "zh-Hans") || a.key.localeCompare(b.key)
  );
}
function selectProject(view, key, environmentId = "all") {
  const project = view.projects.find((p) => p.key === key);
  if (!project) throw new Error("\u9879\u76EE\u5DF2\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5237\u65B0\u5217\u8868\u3002");
  const checkouts = project.checkouts.filter(
    (c) => environmentId === "all" || c.environmentId === environmentId
  );
  if (!checkouts.length) throw new Error("\u6240\u9009\u73AF\u5883\u4E2D\u6CA1\u6709\u8FD9\u4E2A\u9879\u76EE\u3002");
  return { ...project, checkouts };
}
function checkRevision(state, revision) {
  if (!Number.isInteger(revision) || state.revision !== revision)
    throw new Error("\u9879\u76EE\u914D\u7F6E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
}

// src/runner.mjs
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
var OUTPUT_LIMIT = 128 * 1024;
var ActionRunner = class {
  constructor() {
    this.runs = /* @__PURE__ */ new Map();
    this.children = /* @__PURE__ */ new Map();
  }
  start(action, cwd, checkoutId) {
    if (this.children.size >= 8)
      throw new Error("\u5DF2\u6709 8 \u4E2A\u64CD\u4F5C\u5728\u8FD0\u884C\uFF0C\u8BF7\u5148\u505C\u6B62\u4E00\u4E2A\u3002");
    const id = randomUUID(), run = {
      id,
      name: action.name,
      command: action.command,
      cwd,
      checkoutId,
      startedAt: Date.now(),
      endedAt: null,
      status: "running",
      exitCode: null,
      output: ""
    };
    const child = spawn(
      process.env.SHELL || "/bin/sh",
      ["-lc", action.command],
      {
        cwd,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
      }
    );
    this.runs.set(id, run);
    this.children.set(id, child);
    const append = (data) => {
      run.output = (run.output + String(data)).slice(-OUTPUT_LIMIT);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      append(error.message);
      run.status = "failed";
      run.endedAt = Date.now();
      this.children.delete(id);
    });
    child.on("close", (code, signal) => {
      if (run.status === "running")
        run.status = code === 0 ? "completed" : "failed";
      run.exitCode = code;
      run.signal = signal;
      run.endedAt = Date.now();
      this.children.delete(id);
    });
    for (const [key, value] of this.runs)
      if (this.runs.size > 40 && value.status !== "running")
        this.runs.delete(key);
    return { ...run };
  }
  get(id) {
    const run = this.runs.get(id);
    if (!run) throw new Error("\u627E\u4E0D\u5230\u8FD9\u6B21\u64CD\u4F5C\u7684\u8FD0\u884C\u8BB0\u5F55\u3002");
    return { ...run };
  }
  list() {
    return [...this.runs.values()].map(({ output, ...run }) => ({ ...run })).reverse();
  }
  async stop(id) {
    const run = this.runs.get(id), child = this.children.get(id);
    if (!run) throw new Error("\u8FD0\u884C\u8BB0\u5F55\u5DF2\u4E0D\u5B58\u5728\u3002");
    if (!child) return { ...run };
    run.status = "stopped";
    const kill = (signal) => {
      try {
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          signal
        );
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    const closed = new Promise((resolve) => child.once("close", resolve)), timer = setTimeout(() => kill("SIGKILL"), 2e3);
    timer.unref();
    kill("SIGTERM");
    try {
      await closed;
    } finally {
      clearTimeout(timer);
    }
    return { ...run };
  }
  async dispose() {
    await Promise.allSettled(
      [...this.children.keys()].map((id) => this.stop(id))
    );
  }
};

// src/environments.mjs
import { randomUUID as randomUUID2 } from "node:crypto";
function environmentAddress(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("\u8BF7\u8F93\u5165\u5B8C\u6574\u7684 DSH \u8BBF\u95EE\u5730\u5740\u3002");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("\u73AF\u5883\u5730\u5740\u5FC5\u987B\u662F HTTP \u6216 HTTPS \u5730\u5740\u3002");
  const token = url.searchParams.get("token");
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return { url: url.href, token };
}
async function loginEnvironment(input, fetcher = fetch) {
  const { url, token } = environmentAddress(input);
  if (!token) throw new Error("\u9996\u6B21\u8FDE\u63A5\u8BF7\u586B\u5199\u5E26 token \u7684 DSH \u542F\u52A8\u5730\u5740\u3002");
  const login = new URL(url);
  login.searchParams.set("token", token);
  let response;
  try {
    response = await fetcher(login, {
      redirect: "manual",
      signal: AbortSignal.timeout(8e3)
    });
  } catch {
    throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u8BE5\u73AF\u5883\uFF0C\u8BF7\u68C0\u67E5\u5730\u5740\u3002");
  }
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  if (response.status !== 302 || !cookie)
    throw new Error("\u73AF\u5883\u6388\u6743\u5931\u8D25\uFF0C\u8BF7\u4F7F\u7528\u8BE5 DSH \u5F53\u524D\u7684\u542F\u52A8\u5730\u5740\u3002");
  return { url, cookie, token };
}
async function remoteCall(environment, grant, method, request = {}, fetcher = fetch) {
  if (!grant?.cookie) throw new Error("\u73AF\u5883\u6388\u6743\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");
  const rpcId = randomUUID2();
  let response;
  try {
    response = await fetcher(
      new URL(`api/projectManager/${method}`, environment.url),
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: grant.cookie },
        body: JSON.stringify({
          type: "client-request",
          rpcId,
          method: `projectManager/${method}`,
          payload: { args: { request } }
        }),
        signal: AbortSignal.timeout(method === "local" ? 3500 : 1e4)
      }
    );
  } catch {
    throw new Error("\u73AF\u5883\u79BB\u7EBF\u6216\u8FDE\u63A5\u8D85\u65F6\u3002");
  }
  if (response.status === 401 || response.status === 403)
    throw new Error("\u73AF\u5883\u6388\u6743\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");
  if (!response.ok)
    throw new Error("\u8BE5\u73AF\u5883\u672A\u80FD\u54CD\u5E94\uFF0C\u8BF7\u786E\u8BA4\u5DF2\u5B89\u88C5\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u3002");
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("\u8BE5\u73AF\u5883\u672A\u8FD4\u56DE\u6709\u6548\u7684 DSH \u54CD\u5E94\u3002");
  }
  if (body.rpcId !== rpcId || !body.result)
    throw new Error("\u73AF\u5883\u54CD\u5E94\u4E0E\u8BF7\u6C42\u4E0D\u5339\u914D\u3002");
  if (!body.result.ok)
    throw new Error(body.result.error?.message || "\u8FDC\u7A0B\u64CD\u4F5C\u5931\u8D25\u3002");
  return body.result.value;
}

// src/host.mjs
var exec = promisify(execFile);
var initializers = [];
var initial = () => ({
  version: 1,
  hostId: "",
  revision: 0,
  projects: {},
  assignments: {},
  environments: [],
  defaults: { actions: [] }
});
var stateSchema = z.object({
  version: z.literal(1),
  hostId: z.string(),
  revision: z.number().int().nonnegative(),
  projects: z.record(z.string(), z.any()),
  assignments: z.record(z.string(), z.string()),
  environments: z.array(z.any()).max(24),
  defaults: z.object({
    actions: z.array(z.any()),
    byEnvironment: z.record(z.string(), z.array(z.any())).optional()
  })
});
var spec = Object.freeze({
  name: "dsh_project_manager",
  version: 1,
  tables: {},
  global: { schema: stateSchema, initial: initial() }
});
var credentialsId = (id) => credentialKey("dsh-project-manager", "environment-" + id);
var safeRequest = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("\u8BF7\u6C42\u683C\u5F0F\u65E0\u6548\u3002");
  return value;
};
var ProjectManagerService = class extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, "projectManager");
    for (const initialize of initializers) initialize.call(this);
    this.runner = new ActionRunner();
    this.cache = /* @__PURE__ */ new Map();
    this.probes = /* @__PURE__ */ new Map();
    this.chain = Promise.resolve();
    this.ready = ctx.storageDomain.open(spec).then(async (domain) => {
      this.domain = domain;
      const state = domain.global.get();
      if (!state.hostId)
        await domain.global.set({ ...state, hostId: randomUUID3() });
      return domain;
    });
    ctx.effect(
      () => () => this.dispose(),
      "project-manager: domain and owned actions"
    );
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    await this.runner.dispose();
    await this.ready;
    await this.domain.close();
  }
  owner() {
    if (this.disposed) throw new Error("\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u5DF2\u5378\u8F7D\uFF0C\u8BF7\u5237\u65B0 DSH\u3002");
    if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== "owner")
      throw new Error("\u53EA\u6709\u6B64 DSH \u7684\u6240\u6709\u8005\u53EF\u4EE5\u7BA1\u7406\u9879\u76EE\u3002");
  }
  async state() {
    await this.ready;
    return this.domain.global.get();
  }
  async save(state) {
    await this.domain.global.set(stateSchema.parse(state));
  }
  serial(fn) {
    const task = this.chain.then(fn);
    this.chain = task.catch(() => {
    });
    return task;
  }
  workspace(id) {
    const workspace = this.ctx.workspaceRegistry.list().find((w) => w.id === id);
    if (!workspace) throw new Error("\u68C0\u51FA\u76EE\u5F55\u5DF2\u4ECE DSH \u79FB\u9664\uFF0C\u8BF7\u5237\u65B0\u3002");
    return workspace;
  }
  async grant(id) {
    const record = await this.ctx.credentials.readRecord(credentialsId(id));
    return record?.kind === "grant" ? record.payload : null;
  }
  async probe(workspace) {
    const cached = this.probes.get(workspace.id);
    if (cached && cached.path === workspace.path && Date.now() - cached.at < 2e4)
      return cached.value;
    let missing = false;
    try {
      missing = !(await stat(workspace.path)).isDirectory();
    } catch {
      missing = true;
    }
    const git = async (args) => {
      try {
        return (await exec("git", ["-C", workspace.path, ...args], {
          timeout: 2e3,
          maxBuffer: 65536
        })).stdout.trim();
      } catch {
        return "";
      }
    };
    const [origin, branch] = missing ? ["", ""] : await Promise.all([
      git(["remote", "get-url", "origin"]),
      git(["symbolic-ref", "--quiet", "--short", "HEAD"])
    ]);
    const value = {
      id: workspace.id,
      title: workspace.title,
      path: workspace.path,
      sessionCount: workspace.sessionIds.length,
      repoKey: repositoryKey(origin),
      branch,
      missing
    };
    this.probes.set(workspace.id, {
      path: workspace.path,
      at: Date.now(),
      value
    });
    return value;
  }
  async local(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state(), workspaces = [];
    const all = this.ctx.workspaceRegistry.list();
    for (let i = 0; i < all.length; i += 4)
      workspaces.push(
        ...await Promise.all(all.slice(i, i + 4).map((w) => this.probe(w)))
      );
    return {
      protocol: 1,
      environment: {
        id: state.hostId,
        name: os.hostname(),
        platform: process.platform
      },
      workspaces,
      runs: this.runner.list()
    };
  }
  async snapshots() {
    const state = await this.state(), local = await this.local({}), environments = [
      {
        ...local.environment,
        local: true,
        online: true,
        workspaces: local.workspaces,
        runs: local.runs
      }
    ];
    const remote = await Promise.all(
      state.environments.map(async (env) => {
        try {
          const snapshot = await remoteCall(
            env,
            await this.grant(env.id),
            "local",
            {}
          );
          if (snapshot.protocol !== 1 || snapshot.environment?.id !== env.id)
            throw new Error("\u73AF\u5883\u8EAB\u4EFD\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");
          this.cache.set(env.id, snapshot);
          return {
            ...env,
            name: env.name || snapshot.environment.name,
            local: false,
            online: true,
            platform: snapshot.environment.platform,
            workspaces: snapshot.workspaces,
            runs: snapshot.runs
          };
        } catch (error) {
          const previous = this.cache.get(env.id) || env.lastKnown;
          return {
            ...env,
            local: false,
            online: false,
            error: error.message,
            workspaces: previous?.workspaces || []
          };
        }
      })
    );
    return [...environments, ...remote].map(({ lastKnown, ...env }) => env);
  }
  async load(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state(), environments = await this.snapshots(), resolved = Object.fromEntries(
      environments.map((e) => [e.id, defaultActions(state, e.id)])
    );
    return {
      revision: state.revision,
      localId: state.hostId,
      environments,
      projects: projectGroups(state, environments),
      defaults: {
        ...state.defaults,
        resolved,
        mixed: new Set(Object.values(resolved).map((a) => JSON.stringify(a))).size > 1
      },
      runs: environments.flatMap(
        (env) => (env.runs || []).map((run) => ({
          ...run,
          environmentId: env.id,
          environmentName: env.name
        }))
      )
    };
  }
  async target(environmentId, request) {
    const state = await this.state();
    if (environmentId === state.hostId) return this.execute(request);
    const env = state.environments.find((e) => e.id === environmentId);
    if (!env) throw new Error("\u73AF\u5883\u5DF2\u4E0D\u5B58\u5728\u3002");
    return remoteCall(env, await this.grant(env.id), "execute", request);
  }
  async change(request) {
    this.owner();
    safeRequest(request);
    return this.serial(async () => {
      const state = await this.state();
      checkRevision(state, request.revision);
      const next = structuredClone(state);
      const metadata = (key) => next.projects[key] ?? (next.projects[key] = {});
      const view = await this.load({});
      const project = () => selectProject(view, request.projectKey, request.environmentId || "all");
      switch (request.op) {
        case "rename": {
          const group = project(), name = text(request.name, "\u9879\u76EE\u540D\u79F0", 100);
          if (group.checkouts.some((c) => !c.online))
            throw new Error("\u8BF7\u5148\u8FDE\u63A5\u8BE5\u9879\u76EE\u7684\u5168\u90E8\u76EE\u6807\u73AF\u5883\uFF0C\u518D\u4FEE\u6539\u540D\u79F0\u3002");
          const done = [];
          try {
            for (const c of group.checkouts) {
              await this.target(c.environmentId, {
                op: "rename",
                workspaceId: c.id,
                name
              });
              done.push(c);
            }
          } catch (error) {
            const rollback = await Promise.allSettled(
              done.map(
                (c) => this.target(c.environmentId, {
                  op: "rename",
                  workspaceId: c.id,
                  name: c.title
                })
              )
            );
            throw new Error(
              error.message + (rollback.some((r) => r.status === "rejected") ? "\uFF1B\u90E8\u5206\u73AF\u5883\u56DE\u9000\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u6838\u5BF9\u540D\u79F0\u3002" : "")
            );
          }
          if ((request.environmentId || "all") === "all")
            metadata(group.key).name = name;
          break;
        }
        case "icon": {
          const group = project();
          metadata(group.key).icon = iconValue(request.icon);
          break;
        }
        case "organize": {
          const group = project();
          if (typeof request.pinned === "boolean")
            metadata(group.key).pinned = request.pinned;
          if (typeof request.archived === "boolean")
            metadata(group.key).archived = request.archived;
          break;
        }
        case "actions": {
          const group = project(), meta = metadata(group.key), actions = request.actions === null ? null : actionsValue(request.actions);
          if (!request.environmentId || request.environmentId === "all") {
            meta.actions = actions;
            delete meta.actionsByEnvironment;
          } else
            (meta.actionsByEnvironment ??= {})[request.environmentId] = actions;
          break;
        }
        case "defaults": {
          const actions = actionsValue(request.actions);
          if (!request.environmentId || request.environmentId === "all") {
            next.defaults.actions = actions;
            delete next.defaults.byEnvironment;
          } else {
            if (!view.environments.some((e) => e.id === request.environmentId))
              throw new Error("\u73AF\u5883\u5DF2\u4E0D\u5B58\u5728\u3002");
            (next.defaults.byEnvironment ??= {})[request.environmentId] = actions;
          }
          break;
        }
        case "assign": {
          const c = view.projects.flatMap((p) => p.checkouts).find((c2) => c2.key === request.checkoutKey);
          if (!c) throw new Error("\u68C0\u51FA\u76EE\u5F55\u5DF2\u4E0D\u5B58\u5728\u3002");
          if (request.destination === "auto") delete next.assignments[c.key];
          else if (request.destination === "separate")
            next.assignments[c.key] = `group:${randomUUID3()}`;
          else {
            selectProject(view, request.destination);
            next.assignments[c.key] = request.destination;
          }
          break;
        }
        case "addCheckout": {
          const env = view.environments.find(
            (e) => e.id === request.environmentId
          );
          if (!env?.online) throw new Error("\u8BF7\u5148\u8FDE\u63A5\u76EE\u6807\u73AF\u5883\u3002");
          const result = await this.target(env.id, {
            op: "addCheckout",
            path: text(request.path, "\u76EE\u5F55\u8DEF\u5F84", 4096),
            name: request.name?.trim() || void 0
          });
          if (request.projectKey) {
            selectProject(view, request.projectKey);
            next.assignments[`${env.id}:${result.id}`] = request.projectKey;
          }
          break;
        }
        case "removeCheckout": {
          const c = view.projects.flatMap((p) => p.checkouts).find((c2) => c2.key === request.checkoutKey);
          if (!c) throw new Error("\u68C0\u51FA\u76EE\u5F55\u5DF2\u4E0D\u5B58\u5728\u3002");
          if (!c.online) throw new Error("\u8BF7\u5148\u8FDE\u63A5\u8BE5\u73AF\u5883\u3002");
          await this.target(c.environmentId, {
            op: "removeCheckout",
            workspaceId: c.id
          });
          delete next.assignments[c.key];
          break;
        }
        case "removeProject": {
          const group = project();
          if (group.checkouts.some((c) => !c.online))
            throw new Error("\u8BF7\u5148\u8FDE\u63A5\u5168\u90E8\u76EE\u6807\u73AF\u5883\u3002");
          const failed = [];
          for (const c of group.checkouts) {
            try {
              await this.target(c.environmentId, {
                op: "removeCheckout",
                workspaceId: c.id
              });
              delete next.assignments[c.key];
            } catch (error) {
              failed.push(`${c.environmentName}: ${error.message}`);
            }
          }
          if (failed.length) {
            next.revision++;
            await this.save(next);
            throw new Error("\u90E8\u5206\u76EE\u5F55\u672A\u80FD\u79FB\u9664\uFF1A" + failed.join("\uFF1B"));
          }
          break;
        }
        case "connect": {
          const auth = await loginEnvironment(
            text(request.address, "\u73AF\u5883\u5730\u5740", 8192)
          ), candidate = { url: auth.url };
          const snapshot = await remoteCall(candidate, auth, "local", {});
          if (snapshot.protocol !== 1 || !snapshot.environment?.id)
            throw new Error("\u5BF9\u65B9 DSH \u672A\u5B89\u88C5\u517C\u5BB9\u7684\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u3002");
          if (snapshot.environment.id === state.hostId)
            throw new Error("\u8FD9\u662F\u5F53\u524D\u73AF\u5883\uFF0C\u65E0\u9700\u91CD\u590D\u8FDE\u63A5\u3002");
          const id = snapshot.environment.id, name = request.name?.trim() || snapshot.environment.name;
          if (next.environments.length >= 24 && !next.environments.some((e) => e.id === id))
            throw new Error("\u6700\u591A\u8FDE\u63A5 24 \u4E2A\u73AF\u5883\u3002");
          await this.ctx.credentials.modifyRecord(
            credentialsId(id),
            async () => ({ kind: "grant", payload: auth })
          );
          next.environments = next.environments.filter((e) => e.id !== id);
          next.environments.push({
            id,
            name,
            url: auth.url,
            lastKnown: snapshot
          });
          this.cache.set(id, snapshot);
          break;
        }
        case "disconnect": {
          const env = next.environments.find(
            (e) => e.id === request.environmentId
          );
          if (!env) throw new Error("\u73AF\u5883\u5DF2\u4E0D\u5B58\u5728\u3002");
          await this.ctx.credentials.deleteRecord(credentialsId(env.id));
          next.environments = next.environments.filter((e) => e.id !== env.id);
          this.cache.delete(env.id);
          break;
        }
        default:
          throw new Error("\u4E0D\u652F\u6301\u7684\u9879\u76EE\u64CD\u4F5C\u3002");
      }
      next.revision++;
      await this.save(next);
      return { revision: next.revision };
    });
  }
  async execute(request) {
    this.owner();
    safeRequest(request);
    if (request.op === "runStatus")
      return this.runner.get(text(request.runId, "\u8FD0\u884C\u6807\u8BC6", 80));
    if (request.op === "stop")
      return this.runner.stop(text(request.runId, "\u8FD0\u884C\u6807\u8BC6", 80));
    const workspace = request.op === "addCheckout" ? null : this.workspace(text(request.workspaceId, "\u68C0\u51FA\u6807\u8BC6", 100));
    switch (request.op) {
      case "rename":
        await workspace.setTitle(text(request.name, "\u9879\u76EE\u540D\u79F0", 100));
        this.probes.delete(workspace.id);
        return { ok: true };
      case "addCheckout": {
        const w = await this.ctx.workspaceRegistry.create(
          text(request.path, "\u76EE\u5F55\u8DEF\u5F84", 4096),
          request.name
        );
        this.probes.delete(w.id);
        return this.probe(w);
      }
      case "removeCheckout":
        await this.ctx.workspaceRegistry.delete(workspace.id);
        this.probes.delete(workspace.id);
        return { ok: true };
      case "open": {
        const app = request.application || "finder";
        if (!["finder", "vscode", "cursor"].includes(app))
          throw new Error("\u4E0D\u652F\u6301\u8FD9\u4E2A\u5E94\u7528\u3002");
        const binary = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer.exe" : "xdg-open";
        const args = process.platform === "darwin" && app !== "finder" ? [
          "-a",
          app === "vscode" ? "Visual Studio Code" : "Cursor",
          workspace.path
        ] : [workspace.path];
        if (process.platform !== "darwin" && app !== "finder")
          throw new Error("\u6B64\u73AF\u5883\u6682\u672A\u914D\u7F6E\u8FD9\u4E2A\u7F16\u8F91\u5668\u3002");
        await exec(binary, args, { timeout: 5e3, maxBuffer: 65536 });
        return { ok: true };
      }
      case "importActions": {
        const filePath = join(workspace.path, "t3.json");
        let fileStat;
        try {
          fileStat = await stat(filePath);
        } catch {
          throw new Error("\u6240\u9009\u68C0\u51FA\u76EE\u5F55\u4E2D\u6CA1\u6709\u53EF\u8BFB\u53D6\u7684 t3.json\u3002");
        }
        if (fileStat.size > 256e3) throw new Error("t3.json \u8FC7\u5927\u3002");
        const content = await readFile(filePath, "utf8");
        const file = JSON.parse(content);
        return actionsValue(
          (file.scripts || []).map((a) => ({
            id: randomUUID3(),
            name: a.name,
            command: a.command,
            icon: "code"
          }))
        );
      }
      case "run":
        return this.runner.start(
          actionValue(request.action),
          workspace.path,
          workspace.id
        );
      default:
        throw new Error("\u4E0D\u652F\u6301\u8FD9\u4E2A\u76EE\u5F55\u64CD\u4F5C\u3002");
    }
  }
  async operation(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state();
    if (["runStatus", "stop"].includes(request.op))
      return this.target(request.environmentId, request);
    const view = await this.load({}), project = selectProject(view, request.projectKey), checkout = project.checkouts.find((c) => c.key === request.checkoutKey);
    if (!checkout || !checkout.online)
      throw new Error("\u8BF7\u5148\u8FDE\u63A5\u6240\u9009\u68C0\u51FA\u76EE\u5F55\u3002");
    if (request.op === "run") {
      const action = project.actionsByEnvironment[checkout.environmentId].find(
        (a) => a.id === request.actionId
      );
      if (!action) throw new Error("\u64CD\u4F5C\u5DF2\u88AB\u4FEE\u6539\u6216\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u3002");
      return {
        environmentId: checkout.environmentId,
        ...await this.target(checkout.environmentId, {
          op: "run",
          workspaceId: checkout.id,
          action
        })
      };
    }
    if (request.op === "launch") {
      if (checkout.environmentId === state.hostId)
        return { local: true, workspaceId: checkout.id };
      const env = state.environments.find(
        (e) => e.id === checkout.environmentId
      ), grant = await this.grant(env.id), url = new URL(env.url);
      if (grant?.token) url.searchParams.set("token", grant.token);
      url.hash = "dsh-project-manager=" + encodeURIComponent(checkout.id);
      return { local: false, url: url.href };
    }
    if (!["open", "importActions"].includes(request.op))
      throw new Error("\u4E0D\u652F\u6301\u6B64\u64CD\u4F5C\u3002");
    return this.target(checkout.environmentId, {
      ...request,
      workspaceId: checkout.id
    });
  }
};
for (const name of ["local", "load", "change", "execute", "operation"])
  Remote(ProjectManagerService.prototype[name], {
    kind: "method",
    name,
    static: false,
    private: false,
    addInitializer: (fn) => initializers.push(fn)
  });
var inject = ["workspaceRegistry", "storageDomain", "credentials"];
async function apply(ctx) {
  const service = new ProjectManagerService(ctx);
  await service.ready;
}
export {
  ProjectManagerService,
  apply,
  inject
};
