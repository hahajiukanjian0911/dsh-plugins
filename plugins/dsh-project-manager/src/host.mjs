import { randomUUID } from "node:crypto";
import os from "node:os";
import { stat, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { credentialKey } from "@deepseek-ai/dsh-credentials";
import { z } from "zod";
import {
  actionValue,
  actionsValue,
  iconValue,
  text,
  repositoryKey,
  projectGroups,
  selectProject,
  checkRevision,
  defaultActions,
} from "./model.mjs";
import { ActionRunner } from "./runner.mjs";
import { loginEnvironment, remoteCall } from "./environments.mjs";

const exec = promisify(execFile),
  initializers = [];
const initial = () => ({
  version: 1,
  hostId: "",
  revision: 0,
  projects: {},
  assignments: {},
  environments: [],
  defaults: { actions: [] },
});
const stateSchema = z.object({
  version: z.literal(1),
  hostId: z.string(),
  revision: z.number().int().nonnegative(),
  projects: z.record(z.string(), z.any()),
  assignments: z.record(z.string(), z.string()),
  environments: z.array(z.any()).max(24),
  defaults: z.object({
    actions: z.array(z.any()),
    byEnvironment: z.record(z.string(), z.array(z.any())).optional(),
  }),
});
// Public structural DomainSpec; the host owns opening and persisting this domain.
const spec = Object.freeze({
  name: "dsh_project_manager",
  version: 1,
  tables: {},
  global: { schema: stateSchema, initial: initial() },
});
const credentialsId = (id) =>
  credentialKey("dsh-project-manager", "environment-" + id);
const safeRequest = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("请求格式无效。");
  return value;
};

export class ProjectManagerService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, "projectManager");
    for (const initialize of initializers) initialize.call(this);
    this.runner = new ActionRunner();
    this.cache = new Map();
    this.probes = new Map();
    this.chain = Promise.resolve();
    this.ready = ctx.storageDomain.open(spec).then(async (domain) => {
      this.domain = domain;
      const state = domain.global.get();
      if (!state.hostId)
        await domain.global.set({ ...state, hostId: randomUUID() });
      return domain;
    });
    ctx.effect(
      () => () => this.dispose(),
      "project-manager: domain and owned actions",
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
    if (this.disposed) throw new Error("项目管理插件已卸载，请刷新 DSH。");
    if (
      this.ctx.invocation &&
      this.ctx.invocation.peer.principal.kind !== "owner"
    )
      throw new Error("只有此 DSH 的所有者可以管理项目。");
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
    this.chain = task.catch(() => {});
    return task;
  }
  workspace(id) {
    const workspace = this.ctx.workspaceRegistry
      .list()
      .find((w) => w.id === id);
    if (!workspace) throw new Error("检出目录已从 DSH 移除，请刷新。");
    return workspace;
  }
  async grant(id) {
    const record = await this.ctx.credentials.readRecord(credentialsId(id));
    return record?.kind === "grant" ? record.payload : null;
  }
  async probe(workspace) {
    const cached = this.probes.get(workspace.id);
    if (
      cached &&
      cached.path === workspace.path &&
      Date.now() - cached.at < 20000
    )
      return cached.value;
    let missing = false;
    try {
      missing = !(await stat(workspace.path)).isDirectory();
    } catch {
      missing = true;
    }
    const git = async (args) => {
      try {
        return (
          await exec("git", ["-C", workspace.path, ...args], {
            timeout: 2000,
            maxBuffer: 65536,
          })
        ).stdout.trim();
      } catch {
        return "";
      }
    };
    const [origin, branch] = missing
      ? ["", ""]
      : await Promise.all([
          git(["remote", "get-url", "origin"]),
          git(["symbolic-ref", "--quiet", "--short", "HEAD"]),
        ]);
    const value = {
      id: workspace.id,
      title: workspace.title,
      path: workspace.path,
      sessionCount: workspace.sessionIds.length,
      repoKey: repositoryKey(origin),
      branch,
      missing,
    };
    this.probes.set(workspace.id, {
      path: workspace.path,
      at: Date.now(),
      value,
    });
    return value;
  }
  async local(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state(),
      workspaces = [];
    const all = this.ctx.workspaceRegistry.list();
    for (let i = 0; i < all.length; i += 4)
      workspaces.push(
        ...(await Promise.all(all.slice(i, i + 4).map((w) => this.probe(w)))),
      );
    return {
      protocol: 1,
      environment: {
        id: state.hostId,
        name: os.hostname(),
        platform: process.platform,
      },
      workspaces,
      runs: this.runner.list(),
    };
  }
  async snapshots() {
    const state = await this.state(),
      local = await this.local({}),
      environments = [
        {
          ...local.environment,
          local: true,
          online: true,
          workspaces: local.workspaces,
          runs: local.runs,
        },
      ];
    const remote = await Promise.all(
      state.environments.map(async (env) => {
        try {
          const snapshot = await remoteCall(
            env,
            await this.grant(env.id),
            "local",
            {},
          );
          if (snapshot.protocol !== 1 || snapshot.environment?.id !== env.id)
            throw new Error("环境身份已改变，请重新连接。");
          this.cache.set(env.id, snapshot);
          return {
            ...env,
            name: env.name || snapshot.environment.name,
            local: false,
            online: true,
            platform: snapshot.environment.platform,
            workspaces: snapshot.workspaces,
            runs: snapshot.runs,
          };
        } catch (error) {
          const previous = this.cache.get(env.id) || env.lastKnown;
          return {
            ...env,
            local: false,
            online: false,
            error: error.message,
            workspaces: previous?.workspaces || [],
          };
        }
      }),
    );
    return [...environments, ...remote].map(({ lastKnown, ...env }) => env);
  }
  async load(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state(),
      environments = await this.snapshots(),
      resolved = Object.fromEntries(
        environments.map((e) => [e.id, defaultActions(state, e.id)]),
      );
    return {
      revision: state.revision,
      localId: state.hostId,
      environments,
      projects: projectGroups(state, environments),
      defaults: {
        ...state.defaults,
        resolved,
        mixed:
          new Set(Object.values(resolved).map((a) => JSON.stringify(a))).size >
          1,
      },
      runs: environments.flatMap((env) =>
        (env.runs || []).map((run) => ({
          ...run,
          environmentId: env.id,
          environmentName: env.name,
        })),
      ),
    };
  }
  async target(environmentId, request) {
    const state = await this.state();
    if (environmentId === state.hostId) return this.execute(request);
    const env = state.environments.find((e) => e.id === environmentId);
    if (!env) throw new Error("环境已不存在。");
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
      const project = () =>
        selectProject(view, request.projectKey, request.environmentId || "all");
      switch (request.op) {
        case "rename": {
          const group = project(),
            name = text(request.name, "项目名称", 100);
          if (group.checkouts.some((c) => !c.online))
            throw new Error("请先连接该项目的全部目标环境，再修改名称。");
          const done = [];
          try {
            for (const c of group.checkouts) {
              await this.target(c.environmentId, {
                op: "rename",
                workspaceId: c.id,
                name,
              });
              done.push(c);
            }
          } catch (error) {
            const rollback = await Promise.allSettled(
              done.map((c) =>
                this.target(c.environmentId, {
                  op: "rename",
                  workspaceId: c.id,
                  name: c.title,
                }),
              ),
            );
            throw new Error(
              error.message +
                (rollback.some((r) => r.status === "rejected")
                  ? "；部分环境回退失败，请刷新核对名称。"
                  : ""),
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
          const group = project(),
            meta = metadata(group.key),
            actions =
              request.actions === null ? null : actionsValue(request.actions);
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
              throw new Error("环境已不存在。");
            (next.defaults.byEnvironment ??= {})[request.environmentId] =
              actions;
          }
          break;
        }
        case "assign": {
          const c = view.projects
            .flatMap((p) => p.checkouts)
            .find((c) => c.key === request.checkoutKey);
          if (!c) throw new Error("检出目录已不存在。");
          if (request.destination === "auto") delete next.assignments[c.key];
          else if (request.destination === "separate")
            next.assignments[c.key] = `group:${randomUUID()}`;
          else {
            selectProject(view, request.destination);
            next.assignments[c.key] = request.destination;
          }
          break;
        }
        case "addCheckout": {
          const env = view.environments.find(
            (e) => e.id === request.environmentId,
          );
          if (!env?.online) throw new Error("请先连接目标环境。");
          const result = await this.target(env.id, {
            op: "addCheckout",
            path: text(request.path, "目录路径", 4096),
            name: request.name?.trim() || undefined,
          });
          if (request.projectKey) {
            selectProject(view, request.projectKey);
            next.assignments[`${env.id}:${result.id}`] = request.projectKey;
          }
          break;
        }
        case "removeCheckout": {
          const c = view.projects
            .flatMap((p) => p.checkouts)
            .find((c) => c.key === request.checkoutKey);
          if (!c) throw new Error("检出目录已不存在。");
          if (!c.online) throw new Error("请先连接该环境。");
          await this.target(c.environmentId, {
            op: "removeCheckout",
            workspaceId: c.id,
          });
          delete next.assignments[c.key];
          break;
        }
        case "removeProject": {
          const group = project();
          if (group.checkouts.some((c) => !c.online))
            throw new Error("请先连接全部目标环境。");
          const failed = [];
          for (const c of group.checkouts) {
            try {
              await this.target(c.environmentId, {
                op: "removeCheckout",
                workspaceId: c.id,
              });
              delete next.assignments[c.key];
            } catch (error) {
              failed.push(`${c.environmentName}: ${error.message}`);
            }
          }
          if (failed.length) {
            next.revision++;
            await this.save(next);
            throw new Error("部分目录未能移除：" + failed.join("；"));
          }
          break;
        }
        case "connect": {
          const auth = await loginEnvironment(
              text(request.address, "环境地址", 8192),
            ),
            candidate = { url: auth.url };
          const snapshot = await remoteCall(candidate, auth, "local", {});
          if (snapshot.protocol !== 1 || !snapshot.environment?.id)
            throw new Error("对方 DSH 未安装兼容的项目管理插件。");
          if (snapshot.environment.id === state.hostId)
            throw new Error("这是当前环境，无需重复连接。");
          const id = snapshot.environment.id,
            name = request.name?.trim() || snapshot.environment.name;
          if (
            next.environments.length >= 24 &&
            !next.environments.some((e) => e.id === id)
          )
            throw new Error("最多连接 24 个环境。");
          await this.ctx.credentials.modifyRecord(
            credentialsId(id),
            async () => ({ kind: "grant", payload: auth }),
          );
          next.environments = next.environments.filter((e) => e.id !== id);
          next.environments.push({
            id,
            name,
            url: auth.url,
            lastKnown: snapshot,
          });
          this.cache.set(id, snapshot);
          break;
        }
        case "disconnect": {
          const env = next.environments.find(
            (e) => e.id === request.environmentId,
          );
          if (!env) throw new Error("环境已不存在。");
          await this.ctx.credentials.deleteRecord(credentialsId(env.id));
          next.environments = next.environments.filter((e) => e.id !== env.id);
          this.cache.delete(env.id);
          break;
        }
        default:
          throw new Error("不支持的项目操作。");
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
      return this.runner.get(text(request.runId, "运行标识", 80));
    if (request.op === "stop")
      return this.runner.stop(text(request.runId, "运行标识", 80));
    const workspace =
      request.op === "addCheckout"
        ? null
        : this.workspace(text(request.workspaceId, "检出标识", 100));
    switch (request.op) {
      case "rename":
        await workspace.setTitle(text(request.name, "项目名称", 100));
        this.probes.delete(workspace.id);
        return { ok: true };
      case "addCheckout": {
        const w = await this.ctx.workspaceRegistry.create(
          text(request.path, "目录路径", 4096),
          request.name,
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
          throw new Error("不支持这个应用。");
        const binary =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "explorer.exe"
              : "xdg-open";
        const args =
          process.platform === "darwin" && app !== "finder"
            ? [
                "-a",
                app === "vscode" ? "Visual Studio Code" : "Cursor",
                workspace.path,
              ]
            : [workspace.path];
        if (process.platform !== "darwin" && app !== "finder")
          throw new Error("此环境暂未配置这个编辑器。");
        await exec(binary, args, { timeout: 5000, maxBuffer: 65536 });
        return { ok: true };
      }
      case "importActions": {
        const filePath = join(workspace.path, "t3.json");
        let fileStat;
        try {
          fileStat = await stat(filePath);
        } catch {
          throw new Error("所选检出目录中没有可读取的 t3.json。");
        }
        if (fileStat.size > 256000) throw new Error("t3.json 过大。");
        const content = await readFile(filePath, "utf8");
        const file = JSON.parse(content);
        return actionsValue(
          (file.scripts || []).map((a) => ({
            id: randomUUID(),
            name: a.name,
            command: a.command,
            icon: "code",
          })),
        );
      }
      case "run":
        return this.runner.start(
          actionValue(request.action),
          workspace.path,
          workspace.id,
        );
      default:
        throw new Error("不支持这个目录操作。");
    }
  }
  async operation(request) {
    this.owner();
    safeRequest(request);
    const state = await this.state();
    if (["runStatus", "stop"].includes(request.op))
      return this.target(request.environmentId, request);
    const view = await this.load({}),
      project = selectProject(view, request.projectKey),
      checkout = project.checkouts.find((c) => c.key === request.checkoutKey);
    if (!checkout || !checkout.online)
      throw new Error("请先连接所选检出目录。");
    if (request.op === "run") {
      const action = project.actionsByEnvironment[checkout.environmentId].find(
        (a) => a.id === request.actionId,
      );
      if (!action) throw new Error("操作已被修改或删除，请刷新。");
      return {
        environmentId: checkout.environmentId,
        ...(await this.target(checkout.environmentId, {
          op: "run",
          workspaceId: checkout.id,
          action,
        })),
      };
    }
    if (request.op === "launch") {
      if (checkout.environmentId === state.hostId)
        return { local: true, workspaceId: checkout.id };
      const env = state.environments.find(
          (e) => e.id === checkout.environmentId,
        ),
        grant = await this.grant(env.id),
        url = new URL(env.url);
      if (grant?.token) url.searchParams.set("token", grant.token);
      url.hash = "dsh-project-manager=" + encodeURIComponent(checkout.id);
      return { local: false, url: url.href };
    }
    if (!["open", "importActions"].includes(request.op))
      throw new Error("不支持此操作。");
    return this.target(checkout.environmentId, {
      ...request,
      workspaceId: checkout.id,
    });
  }
}
for (const name of ["local", "load", "change", "execute", "operation"])
  Remote(ProjectManagerService.prototype[name], {
    kind: "method",
    name,
    static: false,
    private: false,
    addInitializer: (fn) => initializers.push(fn),
  });
export const inject = ["workspaceRegistry", "storageDomain", "credentials"];
export async function apply(ctx) {
  const service = new ProjectManagerService(ctx);
  await service.ready;
}
