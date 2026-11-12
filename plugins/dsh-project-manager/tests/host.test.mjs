import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  stat,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Context } from "@deepseek-ai/cordis";
import { remoteMethods } from "@deepseek-ai/dsh-typert-protocol";
import { ProjectManagerService } from "../src/host.mjs";
import { gatewayFor, ownerPeer } from "./gateway.mjs";
import {
  repositoryKey,
  iconValue,
  actionsValue,
  projectGroups,
} from "../src/model.mjs";
const exec = promisify(execFile),
  quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
async function waitFor(fn) {
  for (let i = 0; i < 250; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Timed out");
}
async function fixture(t) {
  const dir = await realpath(
      await mkdtemp(join(tmpdir(), "dsh-project-manager-")),
    ),
    contexts = [],
    services = [],
    records = new Map(),
    projects = new Map();
  let revisionStore = null;
  const workspace = async (id, name, origin) => {
    const path = join(dir, id);
    await mkdir(path);
    await exec("git", ["init", "-q", path]);
    if (origin)
      await exec("git", ["-C", path, "remote", "add", "origin", origin]);
    const value = {
      id,
      title: name,
      path,
      sessionIds: ["session-" + id],
      async setTitle(title) {
        this.title = title;
      },
    };
    projects.set(id, value);
    return value;
  };
  const create = () => {
    const ctx = new Context();
    contexts.push(ctx);
    ctx.provide("storageDomain", {
      open: async (spec) => {
        revisionStore ??= structuredClone(spec.global.initial);
        return {
          global: {
            get: () => revisionStore,
            set: async (value) => {
              revisionStore = structuredClone(value);
              await writeFile(
                join(dir, "metadata.json"),
                JSON.stringify(value),
              );
            },
          },
          close: async () => {},
        };
      },
    });
    ctx.provide("workspaceRegistry", {
      list: () => [...projects.values()],
      async create(path, title) {
        assert.equal((await stat(path)).isDirectory(), true);
        const old = [...projects.values()].find((p) => p.path === path);
        if (old) return old;
        const id = "created-" + projects.size,
          value = {
            id,
            title: title || path.split("/").at(-1),
            path,
            sessionIds: [],
            async setTitle(v) {
              this.title = v;
            },
          };
        projects.set(id, value);
        return value;
      },
      async delete(id) {
        return projects.delete(id);
      },
    });
    ctx.provide("credentials", {
      async readRecord(key) {
        return records.get(key);
      },
      async modifyRecord(key, fn) {
        const next = await fn(records.get(key));
        if (next !== undefined) records.set(key, next);
        return records.get(key);
      },
      async deleteRecord(key) {
        records.delete(key);
      },
    });
    const service = new ProjectManagerService(ctx);
    services.push(service);
    return service;
  };
  t.after(async () => {
    await Promise.all(services.map((s) => s.dispose()));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    projects,
    records,
    workspace,
    create,
    get state() {
      return revisionStore;
    },
  };
}
async function change(service, request) {
  return service.change({
    revision: (await service.state()).revision,
    ...request,
  });
}
async function remoteHost(t, service) {
  const gateway = gatewayFor(service);
  const server = createServer(async (req, res) => {
    if (req.url === "/?token=fixture-only") {
      res.writeHead(302, {
        "set-cookie": "dsh_session=fixture-only; HttpOnly; Path=/",
        location: "./",
      });
      res.end();
      return;
    }
    if (req.headers.cookie !== "dsh_session=fixture-only") {
      res.writeHead(401);
      res.end();
      return;
    }
    let input = "";
    for await (const part of req) input += part;
    const body = JSON.parse(input);
    res.setHeader("content-type", "application/json");
    try {
      const result = await gateway.dispatchRpc(
        body.method,
        body.payload,
        undefined,
        ownerPeer,
      );
      res.end(
        JSON.stringify({ type: "server-response", rpcId: body.rpcId, result }),
      );
    } catch (error) {
      res.end(
        JSON.stringify({
          type: "server-response",
          rpcId: body.rpcId,
          result: {
            ok: false,
            error: { code: "fixture/error", message: error.message },
          },
        }),
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    url: `http://127.0.0.1:${server.address().port}/?token=fixture-only`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
test("repository groups normalize Git transports and validate icons/actions", () => {
  assert.equal(
    repositoryKey("git@github.com:example/demo.git"),
    repositoryKey("https://github.com/example/demo.git"),
  );
  assert.throws(() =>
    iconValue({ kind: "image", value: "data:image/svg+xml;base64,AAAA" }),
  );
  assert.throws(() => actionsValue([{ id: "a", name: "", command: "pwd" }]));
  const groups = projectGroups(
    { projects: {}, assignments: {}, defaults: { actions: [] } },
    [
      {
        id: "a",
        name: "A",
        online: true,
        workspaces: [{ id: "x", repoKey: "git:example/repo", title: "Repo" }],
      },
      {
        id: "b",
        name: "B",
        online: false,
        workspaces: [{ id: "y", repoKey: "git:example/repo", title: "Repo" }],
      },
    ],
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].checkouts.length, 2);
  assert.equal(groups[0].checkouts[1].online, false);
});
test("host markers, persistent edits, stale revisions and remove-without-files semantics", async (t) => {
  const f = await fixture(t),
    w = await f.workspace("demo", "Demo"),
    s = f.create(),
    view = await s.load({}),
    key = view.projects[0].key;
  assert.deepEqual(
    remoteMethods(s).map((m) => m.method),
    ["local", "load", "change", "execute", "operation"],
  );
  await change(s, { op: "rename", projectKey: key, name: "新的名称" });
  assert.equal(w.title, "新的名称");
  await assert.rejects(
    s.change({ op: "organize", projectKey: key, pinned: true, revision: 0 }),
    /其他窗口/,
  );
  await change(s, {
    op: "icon",
    projectKey: key,
    icon: { kind: "monogram", value: "DS", color: "#6366f1" },
  });
  await change(s, {
    op: "organize",
    projectKey: key,
    pinned: true,
    archived: true,
  });
  await s.dispose();
  const reopened = f.create(),
    updated = await reopened.load({});
  assert.equal(updated.projects[0].icon.value, "DS");
  assert.equal(updated.projects[0].pinned, true);
  await change(reopened, { op: "removeProject", projectKey: key });
  assert.equal((await reopened.load({})).projects.length, 0);
  assert.equal((await stat(w.path)).isDirectory(), true);
  assert.deepEqual(w.sessionIds, ["session-demo"]);
});
test("two authenticated environments group checkouts, bulk rename and report offline state without leaking grants", async (t) => {
  const a = await fixture(t),
    b = await fixture(t);
  await a.workspace("a", "Local", "git@github.com:example/shared.git");
  await b.workspace("b", "Remote", "https://github.com/example/shared.git");
  const local = a.create(),
    remote = b.create(),
    server = await remoteHost(t, remote);
  await change(local, { op: "connect", address: server.url, name: "远程测试" });
  const view = await local.load({});
  assert.equal(view.environments.length, 2);
  assert.equal(view.projects.length, 1);
  assert.equal(view.projects[0].checkouts.length, 2);
  assert.equal(JSON.stringify(view).includes("fixture-only"), false);
  assert.equal(JSON.stringify(a.state).includes("fixture-only"), false);
  assert.equal(a.records.size, 1);
  await change(local, {
    op: "rename",
    projectKey: view.projects[0].key,
    name: "Shared",
  });
  assert.equal(a.projects.get("a").title, "Shared");
  assert.equal(b.projects.get("b").title, "Shared");
  await change(local, {
    op: "assign",
    checkoutKey: view.projects[0].checkouts[1].key,
    destination: "separate",
  });
  assert.equal((await local.load({})).projects.length, 2);
  await server.close();
  const offline = await local.load({});
  assert.equal(offline.environments[1].online, false);
  assert.equal(offline.projects.length, 2);
});
test("actions import without execution, run in the chosen checkout, survive UI reload and stop", async (t) => {
  const f = await fixture(t),
    w = await f.workspace("scripts", "Scripts"),
    s = f.create(),
    view = await s.load({}),
    project = view.projects[0],
    checkout = project.checkouts[0];
  await writeFile(
    join(w.path, "t3.json"),
    JSON.stringify({
      scripts: [
        {
          name: "Check",
          command: "echo exact-command",
          runOnWorktreeCreate: true,
        },
      ],
    }),
  );
  const imported = await s.operation({
    op: "importActions",
    projectKey: project.key,
    checkoutKey: checkout.key,
  });
  assert.equal(imported[0].command, "echo exact-command");
  assert.equal(s.runner.list().length, 0);
  const command =
    quote(process.execPath) +
    " -e " +
    quote("process.stdout.write('cwd:'+process.cwd())");
  await change(s, {
    op: "actions",
    projectKey: project.key,
    actions: [
      { id: "check", name: "Check", command, icon: "code" },
      {
        id: "long",
        name: "Long",
        command:
          quote(process.execPath) +
          " -e " +
          quote("console.log('ready');setInterval(()=>{},1000)"),
        icon: "code",
      },
    ],
  });
  const run = await s.operation({
    op: "run",
    projectKey: project.key,
    checkoutKey: checkout.key,
    actionId: "check",
  });
  await waitFor(() => s.runner.get(run.id).status !== "running");
  assert.equal(s.runner.get(run.id).exitCode, 0);
  assert.equal(s.runner.get(run.id).output, "cwd:" + w.path);
  assert.equal((await s.load({})).runs.length, 1);
  const long = await s.operation({
    op: "run",
    projectKey: project.key,
    checkoutKey: checkout.key,
    actionId: "long",
  });
  await waitFor(() => s.runner.get(long.id).output.includes("ready"));
  await s.operation({
    op: "stop",
    environmentId: view.localId,
    runId: long.id,
  });
  assert.equal(s.runner.get(long.id).status, "stopped");
  await waitFor(() => !s.runner.children.has(long.id));
});

test("real DSH Gateway accepts shipped argument names and rejects operator access", async (t) => {
  const f = await fixture(t);
  await f.workspace("gateway", "Gateway");
  const s = f.create(),
    gateway = gatewayFor(s);
  const call = (method, request) =>
    gateway.dispatchRpc(
      "projectManager/" + method,
      { args: { request } },
      undefined,
      ownerPeer,
    );
  const view = await call("load", {});
  assert.equal(view.ok, true, JSON.stringify(view));
  const key = view.value.projects[0].key;
  const changed = await call("change", {
    op: "rename",
    projectKey: key,
    name: "Through Gateway",
    revision: view.value.revision,
  });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  const launched = await call("operation", {
    op: "launch",
    projectKey: key,
    checkoutKey: view.value.projects[0].checkouts[0].key,
  });
  assert.equal(launched.ok, true, JSON.stringify(launched));
  assert.equal(launched.value.workspaceId, "gateway");
  const direct = await call("execute", {
    op: "rename",
    workspaceId: "gateway",
    name: "Direct Gateway",
  });
  assert.equal(direct.ok, true, JSON.stringify(direct));
  const invalid = await gateway.dispatchRpc(
    "projectManager/load",
    { request: {} },
    undefined,
    ownerPeer,
  );
  assert.equal(invalid.ok, false);
  const denied = await gateway.dispatchRpc(
    "projectManager/load",
    { args: { request: {} } },
    undefined,
    { ...ownerPeer, principal: { kind: "operator", id: "operator-fixture" } },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "remote-access/denied");
});

test("project and default actions follow environment overrides and reset inheritance", async (t) => {
  const a = await fixture(t),
    b = await fixture(t);
  await a.workspace("a", "Local", "git@github.com:example/actions.git");
  await b.workspace("b", "Remote", "https://github.com/example/actions.git");
  const s = a.create(),
    other = b.create(),
    server = await remoteHost(t, other);
  await change(s, { op: "connect", address: server.url });
  const v = await s.load({}),
    local = v.localId,
    remote = v.environments[1].id,
    key = v.projects[0].key;
  const base = [
      { id: "base", name: "默认检查", command: "echo base", icon: "code" },
    ],
    remoteDefaults = [
      {
        id: "remote-default",
        name: "远程默认",
        command: "echo remote",
        icon: "code",
      },
    ],
    own = [{ id: "own", name: "项目操作", command: "echo own", icon: "code" }];
  await change(s, { op: "defaults", actions: base });
  await change(s, {
    op: "defaults",
    environmentId: remote,
    actions: remoteDefaults,
  });
  let view = await s.load({}),
    p = view.projects[0];
  assert.equal(p.actionsMixed, true);
  assert.deepEqual(p.actionsByEnvironment[local], base);
  assert.deepEqual(p.actionsByEnvironment[remote], remoteDefaults);
  assert.equal(view.defaults.mixed, true);
  await change(s, {
    op: "actions",
    projectKey: key,
    environmentId: remote,
    actions: own,
  });
  p = (await s.load({})).projects[0];
  assert.deepEqual(p.actionsByEnvironment[remote], own);
  assert.equal(p.inheritanceByEnvironment[remote], false);
  assert.deepEqual(p.actionsByEnvironment[local], base);
  await change(s, {
    op: "actions",
    projectKey: key,
    environmentId: remote,
    actions: null,
  });
  p = (await s.load({})).projects[0];
  assert.deepEqual(p.actionsByEnvironment[remote], remoteDefaults);
  assert.equal(p.inheritanceByEnvironment[remote], true);
  await change(s, {
    op: "actions",
    projectKey: key,
    environmentId: "all",
    actions: own,
  });
  p = (await s.load({})).projects[0];
  assert.equal(p.actionsMixed, false);
  assert.deepEqual(p.actionsByEnvironment[remote], own);
  assert.deepEqual(p.actionsByEnvironment[local], own);
});

test("client controller uses the real Gateway, retains failed drafts and starts the native workspace", async (t) => {
  const { createController } = await import("../src/controller.mjs");
  const f = await fixture(t),
    w = await f.workspace("client", "Client"),
    s = f.create(),
    gateway = gatewayFor(s),
    started = [];
  const controller = createController({
    connection: {
      rpc: {
        call: async (channel, endpoint, payload) => {
          assert.equal(channel, "/api");
          return gateway.dispatchRpc(endpoint, payload, undefined, ownerPeer);
        },
      },
    },
    uiWorkspace: { startSession: (id) => started.push(id) },
  });
  t.after(() => controller.dispose());
  await controller.load();
  const p = controller.getSnapshot().view.projects[0];
  assert.equal(
    await controller.mutate({
      op: "rename",
      projectKey: p.key,
      name: "Controller Project",
    }),
    true,
  );
  assert.equal(w.title, "Controller Project");
  assert.equal(
    await controller.mutate({ op: "rename", projectKey: p.key, name: "" }),
    false,
  );
  const error = controller.getSnapshot().error;
  assert.match(error, /项目名称/);
  await controller.load();
  assert.equal(controller.getSnapshot().error, error);
  controller.dismissError();
  assert.equal(controller.getSnapshot().error, null);
  await controller.newSession(p.key, p.checkouts[0].key, () =>
    started.push("close-settings"),
  );
  assert.deepEqual(started, ["client", "close-settings"]);
});
