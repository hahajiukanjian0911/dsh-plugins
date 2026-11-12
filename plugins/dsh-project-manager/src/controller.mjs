export function createController(ctx) {
  let state = {
      view: null,
      error: null,
      loading: false,
      busy: false,
      runs: [],
    },
    timer = null,
    users = 0,
    pending = null,
    disposed = false,
    writeError = false;
  const listeners = new Set(),
    watched = new Map(),
    publish = (patch) => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    };
  async function call(method, request = {}) {
    const result = await ctx.connection.rpc.call(
      "/api",
      "projectManager/" + method,
      { args: { request } },
    );
    if (!result.ok)
      throw new Error(result.error?.message || "项目管理请求失败。");
    return result.value;
  }
  async function load() {
    if (pending) return pending;
    publish({ loading: !state.view });
    pending = (async () => {
      try {
        const view = await call("load");
        if (!disposed)
          publish({
            view,
            runs: (view.runs || []).map((run) => ({
              ...state.runs.find(
                (old) =>
                  old.id === run.id && old.environmentId === run.environmentId,
              ),
              ...run,
            })),
            error: writeError ? state.error : null,
            loading: false,
          });
      } catch (error) {
        if (!disposed) publish({ error: error.message, loading: false });
      } finally {
        pending = null;
      }
    })();
    return pending;
  }
  async function operation(request) {
    writeError = false;
    publish({ busy: true, error: null });
    try {
      return await call("operation", request);
    } catch (error) {
      writeError = true;
      publish({ error: error.message });
      throw error;
    } finally {
      publish({ busy: false });
    }
  }
  async function mutate(request) {
    writeError = false;
    publish({ busy: true, error: null });
    try {
      await call("change", { ...request, revision: state.view.revision });
      if (pending) await pending;
      await load();
      return true;
    } catch (error) {
      writeError = true;
      publish({ error: error.message });
      return false;
    } finally {
      publish({ busy: false });
    }
  }
  async function poll() {
    await load();
    const runs = [...state.runs];
    let changed = false;
    for (let i = 0; i < runs.length; i++)
      if (watched.has(runs[i].environmentId + ":" + runs[i].id)) {
        try {
          runs[i] = {
            ...runs[i],
            connectionError: null,
            ...(await call("operation", {
              op: "runStatus",
              environmentId: runs[i].environmentId,
              runId: runs[i].id,
            })),
          };
          changed = true;
        } catch (error) {
          runs[i] = { ...runs[i], connectionError: error.message };
          changed = true;
        }
      }
    if (changed) publish({ runs });
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    mutate,
    operation,
    mount() {
      users++;
      if (users === 1) {
        void poll();
        timer = setInterval(() => void poll(), 3000);
      }
      return () => {
        users--;
        if (!users) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    async run(request) {
      const run = await operation({ ...request, op: "run" });
      publish({ runs: [run, ...state.runs].slice(0, 40) });
      return run;
    },
    async stop(run) {
      const value = await operation({
        op: "stop",
        environmentId: run.environmentId,
        runId: run.id,
      });
      publish({
        runs: state.runs.map((r) =>
          r.id === run.id && r.environmentId === run.environmentId
            ? { ...r, ...value }
            : r,
        ),
      });
    },
    watchRun(run) {
      const key = run.environmentId + ":" + run.id;
      watched.set(key, true);
      void poll();
      return () => watched.delete(key);
    },
    async newSession(projectKey, checkoutKey, close) {
      const checkout = state.view?.projects
          .find((p) => p.key === projectKey)
          ?.checkouts.find((c) => c.key === checkoutKey),
        remote = checkout && checkout.environmentId !== state.view.localId;
      const tab = remote ? window.open("about:blank", "_blank") : null;
      if (remote && !tab)
        throw new Error("浏览器阻止了新窗口，请允许此 DSH 打开新窗口后重试。");
      if (tab) tab.opener = null;
      try {
        const result = await operation({
          op: "launch",
          projectKey,
          checkoutKey,
        });
        if (result.local) {
          tab?.close();
          ctx.uiWorkspace.startSession(result.workspaceId);
          close?.();
        } else if (tab) tab.location.replace(result.url);
      } catch (error) {
        tab?.close();
        throw error;
      }
    },
    async pickDirectory() {
      return ctx.uiWorkspace.pickDirectory();
    },
    dismissError() {
      writeError = false;
      publish({ error: null });
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      listeners.clear();
    },
  };
}
