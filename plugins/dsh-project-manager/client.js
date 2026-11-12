window.__ModuleLoader__.load({id:"dsh-project-manager",factory(require){const module={exports:{}};const exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.mjs
var client_exports = {};
__export(client_exports, {
  createPlugin: () => createPlugin
});
module.exports = __toCommonJS(client_exports);

// src/controller.mjs
function createController(ctx) {
  let state = {
    view: null,
    error: null,
    loading: false,
    busy: false,
    runs: []
  }, timer = null, users = 0, pending = null, disposed = false, writeError = false;
  const listeners = /* @__PURE__ */ new Set(), watched = /* @__PURE__ */ new Map(), publish = (patch) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  async function call(method, request = {}) {
    const result = await ctx.connection.rpc.call(
      "/api",
      "projectManager/" + method,
      { args: { request } }
    );
    if (!result.ok)
      throw new Error(result.error?.message || "\u9879\u76EE\u7BA1\u7406\u8BF7\u6C42\u5931\u8D25\u3002");
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
                (old) => old.id === run.id && old.environmentId === run.environmentId
              ),
              ...run
            })),
            error: writeError ? state.error : null,
            loading: false
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
            ...await call("operation", {
              op: "runStatus",
              environmentId: runs[i].environmentId,
              runId: runs[i].id
            })
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
        timer = setInterval(() => void poll(), 3e3);
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
        runId: run.id
      });
      publish({
        runs: state.runs.map(
          (r) => r.id === run.id && r.environmentId === run.environmentId ? { ...r, ...value } : r
        )
      });
    },
    watchRun(run) {
      const key = run.environmentId + ":" + run.id;
      watched.set(key, true);
      void poll();
      return () => watched.delete(key);
    },
    async newSession(projectKey, checkoutKey, close) {
      const checkout = state.view?.projects.find((p) => p.key === projectKey)?.checkouts.find((c) => c.key === checkoutKey), remote = checkout && checkout.environmentId !== state.view.localId;
      const tab = remote ? window.open("about:blank", "_blank") : null;
      if (remote && !tab)
        throw new Error("\u6D4F\u89C8\u5668\u963B\u6B62\u4E86\u65B0\u7A97\u53E3\uFF0C\u8BF7\u5141\u8BB8\u6B64 DSH \u6253\u5F00\u65B0\u7A97\u53E3\u540E\u91CD\u8BD5\u3002");
      if (tab) tab.opener = null;
      try {
        const result = await operation({
          op: "launch",
          projectKey,
          checkoutKey
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
    }
  };
}

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

// src/identity.jsx
var GLYPHS2 = {
  folder: "IconFolderCloseRegular",
  code: "IconCodeOutlineRegular",
  document: "IconDeliverDocOutlineRegular",
  globe: "IconGlobeOutlineRegular",
  settings: "IconSettingsOutlineRegular",
  database: "IconDatabaseOutlineRegular",
  shield: "IconShieldOutlineRegular",
  branch: "IconBranchOutlineRegular",
  sparkle: "IconSparkleOutlineRegular",
  clock: "IconClockOutlineRegular",
  chat: "IconNewChatOutlineRegular",
  link: "IconLinkOutlineRegular"
};
function createProjectIcon(React, P) {
  return function ProjectIcon({ project, large = false, compact = false }) {
    const value = project.icon, name = project.name || "\u9879\u76EE";
    const letters = [...name.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("").toUpperCase() || "P";
    const color = value?.color || COLORS[[...name].reduce((a, c) => a + c.codePointAt(0), 0) % COLORS.length];
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        "aria-hidden": "true",
        className: "dpm-project-icon" + (large ? " dpm-large" : "") + (compact ? " dpm-compact" : ""),
        style: { "--dpm-icon-color": color }
      },
      value?.kind === "image" ? /* @__PURE__ */ React.createElement("img", { alt: "", src: value.value }) : value?.kind === "glyph" ? React.createElement(P[GLYPHS2[value.value]] || P.IconFolderCloseRegular, { size: large ? 24 : compact ? 16 : 18 }) : value?.kind === "emoji" ? /* @__PURE__ */ React.createElement("span", { className: "dpm-emoji" }, value.value) : /* @__PURE__ */ React.createElement("span", null, value?.kind === "monogram" ? value.value : letters)
    );
  };
}

// src/page.jsx
function createProjectPage(React, P, stylesheet) {
  const { useState, useEffect, useRef } = React, { Button, Input, Menu, Modal } = P;
  const names = {
    folder: "\u6587\u4EF6\u5939",
    code: "\u4EE3\u7801",
    document: "\u6587\u6863",
    globe: "\u7F51\u7AD9",
    settings: "\u5DE5\u5177",
    database: "\u6570\u636E",
    shield: "\u5B89\u5168",
    branch: "\u5206\u652F",
    sparkle: "\u7075\u611F",
    clock: "\u65F6\u949F",
    chat: "\u5BF9\u8BDD",
    link: "\u94FE\u63A5"
  };
  const glyphs = {
    folder: "IconFolderCloseRegular",
    code: "IconCodeOutlineRegular",
    document: "IconDeliverDocOutlineRegular",
    globe: "IconGlobeOutlineRegular",
    settings: "IconSettingsOutlineRegular",
    database: "IconDatabaseOutlineRegular",
    shield: "IconShieldOutlineRegular",
    branch: "IconBranchOutlineRegular",
    sparkle: "IconSparkleOutlineRegular",
    clock: "IconClockOutlineRegular",
    chat: "IconNewChatOutlineRegular",
    link: "IconLinkOutlineRegular"
  };
  const icon = (name, size = 16) => React.createElement(P[name] || P.IconFolderCloseRegular, { size });
  const ProjectIcon = createProjectIcon(React, P);
  function SelectMenu({
    label,
    value,
    items,
    onSelect,
    disabled = false,
    compact = false
  }) {
    const [open, setOpen] = useState(false);
    return /* @__PURE__ */ React.createElement(
      Menu,
      {
        open,
        onClose: () => setOpen(false),
        onSelect: (id) => {
          setOpen(false);
          onSelect(id);
        },
        items,
        selectedId: value,
        autoFocus: true,
        portal: true,
        dense: true,
        anchor: /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "outline",
            disabled,
            "aria-label": label,
            "aria-haspopup": "menu",
            "aria-expanded": open,
            onClick: () => setOpen(!open)
          },
          compact ? icon("IconEllipsisOutlineRegular") : /* @__PURE__ */ React.createElement(
            "span",
            {
              className: "dpm-select-label",
              title: items.find((i) => i.id === value)?.label || label
            },
            items.find((i) => i.id === value)?.label || label
          ),
          !compact && icon("IconChevronDownOutlineRegular", 12)
        )
      }
    );
  }
  function IconPicker({ project, onSave, onClose, busy, saveError }) {
    const [kind, setKind] = useState(project.icon?.kind || "auto"), [value, setValue] = useState(project.icon?.value || ""), [color, setColor] = useState(project.icon?.color || COLORS[7]), [error, setError] = useState(null), file = useRef(null);
    const draft = {
      ...project,
      icon: kind === "auto" ? null : { kind, value, color }
    };
    const loadImage = async (event) => {
      const item = event.target.files?.[0];
      if (!item) return;
      if (item.size > 256 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(item.type)) {
        setError("\u8BF7\u9009\u62E9\u5C0F\u4E8E 256 KB \u7684 PNG\u3001JPEG \u6216 WebP \u56FE\u7247\u3002");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setValue(String(reader.result));
        setError(null);
      };
      reader.readAsDataURL(item);
    };
    return /* @__PURE__ */ React.createElement(
      Modal,
      {
        open: true,
        title: "\u9879\u76EE\u56FE\u6807",
        closeLabel: "\u5173\u95ED",
        onClose,
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: onClose }, "\u53D6\u6D88"), /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "primary",
            disabled: busy || kind !== "auto" && !value.trim(),
            onClick: () => onSave(draft.icon)
          },
          "\u4FDD\u5B58"
        ))
      },
      /* @__PURE__ */ React.createElement("div", { className: "dpm-icon-preview" }, /* @__PURE__ */ React.createElement(ProjectIcon, { project: draft, large: true }), /* @__PURE__ */ React.createElement("span", null, project.name)),
      /* @__PURE__ */ React.createElement("div", { className: "dpm-options" }, [
        ["auto", "\u81EA\u52A8"],
        ["glyph", "\u56FE\u6807"],
        ["emoji", "Emoji"],
        ["monogram", "\u6587\u5B57"],
        ["image", "\u56FE\u7247"]
      ].map(([id, label]) => /* @__PURE__ */ React.createElement(
        Button,
        {
          key: id,
          variant: "outline",
          "aria-pressed": kind === id,
          onClick: () => {
            setKind(id);
            setValue(id === "glyph" ? "folder" : "");
            setError(null);
          }
        },
        label
      ))),
      kind === "glyph" && /* @__PURE__ */ React.createElement("div", { className: "dpm-icon-grid" }, GLYPHS.map((id) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: id,
          className: "dpm-glyph",
          "aria-label": names[id],
          "aria-pressed": value === id,
          onClick: () => setValue(id)
        },
        icon(glyphs[id], 20)
      ))),
      ["emoji", "monogram"].includes(kind) && /* @__PURE__ */ React.createElement(
        Input,
        {
          "aria-label": kind === "emoji" ? "Emoji" : "\u56FE\u6807\u6587\u5B57",
          maxLength: kind === "emoji" ? 12 : 2,
          value,
          onChange: (event) => setValue(event.target.value),
          placeholder: kind === "emoji" ? "\u8F93\u5165\u4E00\u4E2A Emoji" : "1\u20132 \u4E2A\u5B57\u6BCD\u6216\u6C49\u5B57"
        }
      ),
      kind === "image" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "file",
          accept: "image/png,image/jpeg,image/webp",
          hidden: true,
          ref: file,
          onChange: loadImage
        }
      ), /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: () => file.current.click() }, "\u9009\u62E9\u56FE\u7247")),
      kind !== "auto" && kind !== "image" && /* @__PURE__ */ React.createElement("div", { className: "dpm-colors" }, COLORS.map((c) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: c,
          "aria-label": "\u989C\u8272 " + c,
          "aria-pressed": color === c,
          style: { background: c },
          onClick: () => setColor(c)
        }
      ))),
      (error || saveError) && /* @__PURE__ */ React.createElement("p", { role: "alert", className: "dpm-error" }, error || saveError)
    );
  }
  function TextForm({
    kind,
    initial,
    environments,
    localId,
    onSubmit,
    onClose,
    busy,
    pickDirectory,
    saveError
  }) {
    const [name, setName] = useState(initial?.name || ""), [path, setPath] = useState(""), [environment, setEnvironment] = useState(
      initial?.environmentId || localId
    ), [error, setError] = useState(null);
    const connection = kind === "environment", script = kind === "action";
    const [command, setCommand] = useState(initial?.command || ""), [actionIcon, setActionIcon] = useState(initial?.icon || "code");
    return /* @__PURE__ */ React.createElement(
      Modal,
      {
        open: true,
        title: connection ? "\u8FDE\u63A5\u73AF\u5883" : script ? initial?.id ? "\u7F16\u8F91\u64CD\u4F5C" : "\u6DFB\u52A0\u64CD\u4F5C" : initial?.projectKey ? "\u6DFB\u52A0\u68C0\u51FA\u76EE\u5F55" : "\u6DFB\u52A0\u9879\u76EE",
        closeLabel: "\u5173\u95ED",
        onClose,
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: onClose }, "\u53D6\u6D88"), /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "primary",
            disabled: busy || !connection && !script && !path.trim() || connection && !path.trim() || script && (!name.trim() || !command.trim()),
            onClick: () => onSubmit(
              script ? {
                id: initial?.id || crypto.randomUUID(),
                name,
                command,
                icon: actionIcon
              } : connection ? { name, address: path } : { name, path, environmentId: environment }
            )
          },
          busy ? "\u4FDD\u5B58\u4E2D\u2026" : connection ? "\u8FDE\u63A5" : "\u4FDD\u5B58"
        ))
      },
      /* @__PURE__ */ React.createElement("div", { className: "dpm-form" }, /* @__PURE__ */ React.createElement("label", null, "\u540D\u79F0", !script && /* @__PURE__ */ React.createElement("span", { className: "dpm-muted" }, "\uFF08\u53EF\u9009\uFF09"), /* @__PURE__ */ React.createElement(
        Input,
        {
          "aria-label": script ? "\u64CD\u4F5C\u540D\u79F0" : connection ? "\u73AF\u5883\u540D\u79F0" : "\u9879\u76EE\u540D\u79F0",
          value: name,
          onChange: (e) => setName(e.target.value),
          maxLength: 100
        }
      )), script ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", null, "\u56FE\u6807", /* @__PURE__ */ React.createElement(
        SelectMenu,
        {
          label: "\u64CD\u4F5C\u56FE\u6807",
          value: actionIcon,
          items: GLYPHS.map((id) => ({ id, label: names[id] })),
          onSelect: setActionIcon
        }
      )), /* @__PURE__ */ React.createElement("label", null, "\u547D\u4EE4", /* @__PURE__ */ React.createElement(
        "textarea",
        {
          "aria-label": "\u64CD\u4F5C\u547D\u4EE4",
          value: command,
          onChange: (e) => setCommand(e.target.value),
          rows: 5,
          spellCheck: false,
          placeholder: "\u4F8B\u5982 npm run dev"
        }
      ))) : connection ? /* @__PURE__ */ React.createElement("label", null, "DSH \u8BBF\u95EE\u5730\u5740", /* @__PURE__ */ React.createElement(
        Input,
        {
          "aria-label": "DSH \u8BBF\u95EE\u5730\u5740",
          type: "password",
          value: path,
          onChange: (e) => setPath(e.target.value),
          autoComplete: "off",
          placeholder: "\u7C98\u8D34\u5E26 token \u7684\u542F\u52A8\u5730\u5740"
        }
      )) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", null, "\u73AF\u5883", /* @__PURE__ */ React.createElement(
        SelectMenu,
        {
          label: "\u76EE\u6807\u73AF\u5883",
          value: environment,
          items: environments.filter((e) => e.online).map((e) => ({ id: e.id, label: e.name })),
          onSelect: setEnvironment
        }
      )), /* @__PURE__ */ React.createElement("label", null, "\u76EE\u5F55", /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, /* @__PURE__ */ React.createElement(
        Input,
        {
          "aria-label": "\u76EE\u5F55\u8DEF\u5F84",
          value: path,
          onChange: (e) => setPath(e.target.value),
          placeholder: "\u5DF2\u6709\u9879\u76EE\u7684\u7EDD\u5BF9\u8DEF\u5F84"
        }
      ), environment === localId && /* @__PURE__ */ React.createElement(
        Button,
        {
          variant: "outline",
          onClick: async () => {
            try {
              const selected = await pickDirectory();
              if (selected)
                setPath(
                  typeof selected === "string" ? selected : selected.path
                );
            } catch (e) {
              setError(e.message);
            }
          }
        },
        "\u9009\u62E9\u76EE\u5F55"
      )))), connection && /* @__PURE__ */ React.createElement("p", { className: "dpm-muted" }, "\u76EE\u6807 DSH \u9700\u5B89\u88C5\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u3002\u8FDE\u63A5\u5730\u5740\u4E0D\u4F1A\u663E\u793A\u5728\u9879\u76EE\u5217\u8868\u4E2D\u3002"), (error || saveError) && /* @__PURE__ */ React.createElement("p", { role: "alert", className: "dpm-error" }, error || saveError))
    );
  }
  return function ProjectPage({
    controller,
    useProjectManager,
    close,
    initialView = "projects"
  }) {
    const state = useProjectManager((s) => s), view = state.view;
    const [page, setPage] = useState(initialView), [selected, setSelected] = useState("all"), [environment, setEnvironment] = useState("all"), [query, setQuery] = useState(""), [showArchived, setShowArchived] = useState(false), [modal, setModal] = useState(null), [name, setName] = useState(""), [target, setTarget] = useState(""), [error, setError] = useState(null);
    useEffect(() => controller.mount(), [controller]);
    useEffect(() => setPage(initialView), [initialView]);
    const groups = view?.projects || [], envs = view?.environments || [], project = groups.find((p) => p.key === selected);
    const checkouts = project?.checkouts.filter(
      (c) => environment === "all" || c.environmentId === environment
    ) || [];
    const currentTarget = checkouts.find((c) => c.key === target) || checkouts.find((c) => c.environmentId === view?.localId) || checkouts[0];
    const displayName = project && (environment === "all" ? project.name : checkouts[0]?.title || project.name);
    const acceptedName = useRef({ key: "", value: "" });
    useEffect(() => {
      const key = (project?.key || "") + ":" + environment;
      if (acceptedName.current.key !== key || name === acceptedName.current.value)
        setName(displayName || "");
      acceptedName.current = { key, value: displayName || "" };
    }, [project?.key, displayName, environment]);
    const run = state.runs.find(
      (r) => r.id === modal?.id && r.environmentId === modal?.environmentId
    );
    useEffect(
      () => modal?.kind === "run" && run ? controller.watchRun(run) : void 0,
      [controller, modal?.kind, modal?.id, modal?.environmentId]
    );
    const handle = (fn) => Promise.resolve().then(fn).catch((e) => setError(e.message));
    const save = async (request) => {
      if (await controller.mutate(request)) {
        setModal(null);
        setError(null);
      }
    };
    const scoped = { projectKey: project?.key, environmentId: environment };
    const scopedCheckouts = (p) => p.checkouts.filter(
      (c) => environment === "all" || c.environmentId === environment
    );
    const shownName = (p) => environment === "all" ? p.name : scopedCheckouts(p)[0]?.title || p.name;
    const iconItems = groups.filter(
      (p) => (!p.archived || showArchived || p.key === selected) && scopedCheckouts(p).length
    ).map((p) => ({ id: p.key, label: shownName(p) }));
    const visible = groups.filter(
      (p) => (showArchived || !p.archived) && (environment === "all" || p.checkouts.some((c) => c.environmentId === environment)) && [p.name, ...p.checkouts.flatMap((c) => [c.path, c.title])].some(
        (s) => s.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      )
    );
    const actionsMixed = environment === "all" && (page === "defaults" ? view?.defaults.mixed : project?.actionsMixed);
    const inherited = environment === "all" ? project?.inherited : project?.inheritanceByEnvironment?.[environment];
    const actions = page === "defaults" ? (environment === "all" ? view?.defaults.actions : view?.defaults.resolved?.[environment]) || [] : (environment === "all" ? project?.actions : project?.actionsByEnvironment?.[environment]) || [];
    const saveActions = (values) => save(
      page === "defaults" ? { op: "defaults", environmentId: environment, actions: values } : { op: "actions", ...scoped, actions: values }
    );
    return /* @__PURE__ */ React.createElement("div", { className: "dpm" }, /* @__PURE__ */ React.createElement("style", null, stylesheet), /* @__PURE__ */ React.createElement("header", { className: "dpm-header" }, /* @__PURE__ */ React.createElement("div", null, (page !== "projects" || selected !== "all") && /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        onClick: () => {
          setPage("projects");
          setSelected("all");
        },
        "aria-label": "\u8FD4\u56DE\u9879\u76EE\u5217\u8868"
      },
      icon("IconChevronLeftOutlineRegular"),
      "\u9879\u76EE"
    ), /* @__PURE__ */ React.createElement("h2", null, page === "environments" ? "\u73AF\u5883" : page === "defaults" ? "\u9ED8\u8BA4\u64CD\u4F5C" : displayName || "\u9879\u76EE")), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.loading || state.busy,
        onClick: () => controller.load(),
        "aria-label": "\u5237\u65B0\u9879\u76EE"
      },
      icon("IconRefreshOutlineRegular"),
      "\u5237\u65B0"
    )), (error || state.error) && /* @__PURE__ */ React.createElement("div", { role: "alert", className: "dpm-error-box" }, /* @__PURE__ */ React.createElement("span", null, error || state.error), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        onClick: () => {
          setError(null);
          controller.dismissError();
        }
      },
      "\u5173\u95ED"
    )), !view ? /* @__PURE__ */ React.createElement("p", { role: "status", className: "dpm-muted" }, state.loading ? "\u6B63\u5728\u8BFB\u53D6\u9879\u76EE\u2026" : "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u9879\u76EE\u3002") : /* @__PURE__ */ React.createElement(React.Fragment, null, ["projects", "defaults"].includes(page) && /* @__PURE__ */ React.createElement("div", { className: "dpm-scope" }, page === "projects" && /* @__PURE__ */ React.createElement(
      SelectMenu,
      {
        label: "\u9879\u76EE\u8303\u56F4",
        value: selected,
        items: [{ id: "all", label: "\u5168\u90E8\u9879\u76EE" }, ...iconItems],
        onSelect: setSelected
      }
    ), /* @__PURE__ */ React.createElement("span", { className: "dpm-muted" }, "\u6240\u5728\u73AF\u5883"), /* @__PURE__ */ React.createElement(
      SelectMenu,
      {
        label: "\u73AF\u5883\u8303\u56F4",
        value: environment,
        items: [
          { id: "all", label: "\u5168\u90E8\u73AF\u5883" },
          ...envs.map((e) => ({
            id: e.id,
            label: e.name + (e.online ? "" : " \xB7 \u79BB\u7EBF")
          }))
        ],
        onSelect: (id) => {
          setEnvironment(id);
          if (selected !== "all" && !project?.checkouts.some(
            (c) => c.environmentId === id || id === "all"
          ))
            setSelected("all");
        }
      }
    )), page === "environments" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "dpm-toolbar" }, /* @__PURE__ */ React.createElement("p", { className: "dpm-muted" }, "\u8FDE\u63A5 DSH \u73AF\u5883\uFF0C\u5728\u4E00\u4E2A\u5217\u8868\u4E2D\u7BA1\u7406\u5404\u5904\u7684\u9879\u76EE\u3002"), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "primary",
        onClick: () => setModal({ kind: "environment" })
      },
      icon("IconPlusOutlineRegular"),
      "\u8FDE\u63A5\u73AF\u5883"
    )), /* @__PURE__ */ React.createElement("div", { className: "dpm-list" }, envs.map((env) => /* @__PURE__ */ React.createElement("div", { key: env.id, className: "dpm-environment" }, /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, icon("IconGlobeOutlineRegular", 18), /* @__PURE__ */ React.createElement("div", { className: "dpm-row-text" }, /* @__PURE__ */ React.createElement("strong", null, env.name, env.local && /* @__PURE__ */ React.createElement("span", { className: "dpm-tag" }, "\u5F53\u524D\u73AF\u5883")), /* @__PURE__ */ React.createElement("small", null, env.local ? "\u6B64 DSH \u4E3B\u673A" : env.url)), /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "dpm-status " + (env.online ? "" : "dpm-offline")
      },
      env.online ? "\u5DF2\u8FDE\u63A5" : "\u79BB\u7EBF"
    )), !env.local && /* @__PURE__ */ React.createElement("div", { className: "dpm-environment-actions" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        onClick: () => setModal({ kind: "environment", name: env.name })
      },
      "\u91CD\u65B0\u8FDE\u63A5"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        onClick: () => setModal({
          kind: "confirm",
          title: "\u65AD\u5F00\u73AF\u5883",
          message: `\u65AD\u5F00\u201C${env.name}\u201D\u7684\u8FDE\u63A5\uFF1F\u9879\u76EE\u3001\u4F1A\u8BDD\u548C\u76EE\u5F55\u90FD\u4F1A\u4FDD\u7559\u3002`,
          request: {
            op: "disconnect",
            environmentId: env.id
          }
        })
      },
      "\u65AD\u5F00"
    )), env.error && /* @__PURE__ */ React.createElement("p", { className: "dpm-muted" }, env.error))))) : selected === "all" && page === "projects" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "dpm-toolbar" }, /* @__PURE__ */ React.createElement(
      Input,
      {
        "aria-label": "\u641C\u7D22\u9879\u76EE",
        placeholder: "\u641C\u7D22\u9879\u76EE\u6216\u76EE\u5F55",
        value: query,
        onChange: (e) => setQuery(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "primary",
        disabled: state.busy,
        onClick: () => setModal({
          kind: "checkout",
          environmentId: environment === "all" ? view.localId : environment
        })
      },
      icon("IconPlusOutlineRegular"),
      "\u6DFB\u52A0\u9879\u76EE"
    )), /* @__PURE__ */ React.createElement("div", { className: "dpm-list" }, visible.map((p) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.key,
        className: "dpm-project-row",
        onClick: () => setSelected(p.key)
      },
      /* @__PURE__ */ React.createElement(ProjectIcon, { project: p }),
      /* @__PURE__ */ React.createElement("span", { className: "dpm-row-text" }, /* @__PURE__ */ React.createElement("strong", null, shownName(p), p.pinned && icon("IconPinOutlineRegular", 12), p.archived && /* @__PURE__ */ React.createElement("span", { className: "dpm-tag" }, "\u5DF2\u5F52\u6863")), /* @__PURE__ */ React.createElement("small", null, scopedCheckouts(p).length === 1 ? scopedCheckouts(p)[0].path : `${scopedCheckouts(p).length} \u4E2A\u68C0\u51FA\u76EE\u5F55 \xB7 ${new Set(scopedCheckouts(p).map((c) => c.environmentId)).size} \u4E2A\u73AF\u5883`)),
      icon("IconChevronRightOutlineRegular", 14)
    )), !visible.length && /* @__PURE__ */ React.createElement("p", { className: "dpm-empty" }, query ? "\u6CA1\u6709\u5339\u914D\u7684\u9879\u76EE" : "\u8FD8\u6CA1\u6709\u9879\u76EE\uFF0C\u6DFB\u52A0\u4E00\u4E2A\u5DF2\u6709\u76EE\u5F55\u5373\u53EF\u5F00\u59CB\u3002")), /* @__PURE__ */ React.createElement("footer", { className: "dpm-list-footer" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowArchived(!showArchived) }, showArchived ? "\u9690\u85CF\u5DF2\u5F52\u6863\u9879\u76EE" : "\u663E\u793A\u5DF2\u5F52\u6863\u9879\u76EE"), /* @__PURE__ */ React.createElement("button", { onClick: () => setPage("defaults") }, "\u9ED8\u8BA4\u64CD\u4F5C"), /* @__PURE__ */ React.createElement("button", { onClick: () => setPage("environments") }, "\u7BA1\u7406\u73AF\u5883"))) : page === "defaults" || project ? /* @__PURE__ */ React.createElement(React.Fragment, null, project && page !== "defaults" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "dpm-section" }, /* @__PURE__ */ React.createElement("h3", null, "\u57FA\u672C\u4FE1\u606F"), /* @__PURE__ */ React.createElement("div", { className: "dpm-setting" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "dpm-name" }, "\u540D\u79F0"), /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, /* @__PURE__ */ React.createElement(
      Input,
      {
        id: "dpm-name",
        "aria-label": "\u9879\u76EE\u540D\u79F0",
        value: name,
        onChange: (e) => setName(e.target.value),
        maxLength: 100
      }
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "primary",
        disabled: state.busy || !name.trim() || name.trim() === displayName,
        onClick: () => save({ op: "rename", ...scoped, name })
      },
      "\u4FDD\u5B58"
    ))), /* @__PURE__ */ React.createElement("div", { className: "dpm-setting" }, /* @__PURE__ */ React.createElement("span", null, "\u56FE\u6807"), /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, /* @__PURE__ */ React.createElement(ProjectIcon, { project }), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy,
        onClick: () => setModal({ kind: "icon" })
      },
      "\u9009\u62E9\u56FE\u6807"
    ))), /* @__PURE__ */ React.createElement("div", { className: "dpm-setting" }, /* @__PURE__ */ React.createElement("span", null, "\u6574\u7406"), /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        "aria-pressed": project.pinned,
        disabled: state.busy,
        onClick: () => save({
          op: "organize",
          ...scoped,
          pinned: !project.pinned
        })
      },
      icon("IconPinOutlineRegular"),
      project.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876\u9879\u76EE"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy,
        onClick: () => save({
          op: "organize",
          ...scoped,
          archived: !project.archived
        })
      },
      project.archived ? "\u53D6\u6D88\u5F52\u6863" : "\u5F52\u6863\u9879\u76EE"
    )))), /* @__PURE__ */ React.createElement("section", { className: "dpm-section" }, /* @__PURE__ */ React.createElement("div", { className: "dpm-section-heading" }, /* @__PURE__ */ React.createElement("h3", null, "\u68C0\u51FA\u76EE\u5F55"), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy,
        onClick: () => setModal({
          kind: "checkout",
          projectKey: project.key,
          environmentId: environment === "all" ? view.localId : environment
        })
      },
      icon("IconPlusOutlineRegular"),
      "\u6DFB\u52A0\u76EE\u5F55"
    )), checkouts.map((c) => /* @__PURE__ */ React.createElement("div", { className: "dpm-checkout", key: c.key }, /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, /* @__PURE__ */ React.createElement("span", { className: "dpm-row-text" }, /* @__PURE__ */ React.createElement("strong", null, c.environmentName, /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "dpm-tag " + (!c.online ? "dpm-offline" : "")
      },
      !c.online ? "\u79BB\u7EBF" : c.missing ? "\u76EE\u5F55\u4E0D\u53EF\u7528" : c.branch || "\u76EE\u5F55"
    )), /* @__PURE__ */ React.createElement("small", { title: c.path }, c.path)), /* @__PURE__ */ React.createElement(
      SelectMenu,
      {
        compact: true,
        label: "\u76EE\u5F55\u64CD\u4F5C " + c.path,
        value: "",
        items: [
          {
            id: "new",
            label: "\u65B0\u4F1A\u8BDD",
            disabled: !c.online || c.missing
          },
          {
            id: "finder",
            label: "\u6253\u5F00\u76EE\u5F55",
            disabled: !c.online || c.missing
          },
          {
            id: "vscode",
            label: "\u5728 VS Code \u4E2D\u6253\u5F00",
            disabled: !c.online || c.missing
          },
          {
            id: "cursor",
            label: "\u5728 Cursor \u4E2D\u6253\u5F00",
            disabled: !c.online || c.missing
          },
          { type: "separator", id: "sep" },
          { id: "auto", label: "\u81EA\u52A8\u5206\u7EC4" },
          { id: "separate", label: "\u72EC\u7ACB\u4E3A\u4E00\u4E2A\u9879\u76EE" },
          ...groups.filter((g) => g.key !== project.key).map((g) => ({
            id: "group:" + g.key,
            label: "\u5F52\u5165 " + g.name
          })),
          { type: "separator", id: "remove-sep" },
          {
            id: "remove",
            label: "\u79FB\u9664\u68C0\u51FA\u76EE\u5F55",
            danger: true,
            disabled: !c.online
          }
        ],
        onSelect: (id) => {
          if (id === "new")
            void handle(
              () => controller.newSession(
                project.key,
                c.key,
                close
              )
            );
          else if (["finder", "vscode", "cursor"].includes(id))
            void handle(
              () => controller.operation({
                op: "open",
                projectKey: project.key,
                checkoutKey: c.key,
                application: id
              })
            );
          else if (id === "remove")
            setModal({
              kind: "confirm",
              title: "\u79FB\u9664\u68C0\u51FA\u76EE\u5F55",
              message: `\u79FB\u9664\u201C${c.path}\u201D\u7684\u9879\u76EE\u767B\u8BB0\uFF1F\u76EE\u5F55\u4E0E\u4F1A\u8BDD\u90FD\u4F1A\u4FDD\u7559\u3002`,
              request: {
                op: "removeCheckout",
                checkoutKey: c.key
              }
            });
          else
            void save({
              op: "assign",
              checkoutKey: c.key,
              destination: id.startsWith("group:") ? id.slice(6) : id
            });
        }
      }
    )))))), /* @__PURE__ */ React.createElement("section", { className: "dpm-section" }, /* @__PURE__ */ React.createElement("div", { className: "dpm-section-heading" }, /* @__PURE__ */ React.createElement("h3", null, page === "defaults" ? "\u64CD\u4F5C" : "\u9879\u76EE\u64CD\u4F5C", inherited && page !== "defaults" && /* @__PURE__ */ React.createElement("span", { className: "dpm-tag" }, "\u4F7F\u7528\u9ED8\u8BA4\u64CD\u4F5C")), /* @__PURE__ */ React.createElement("div", { className: "dpm-inline" }, project && !inherited && page !== "defaults" && /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy,
        onClick: () => save({ op: "actions", ...scoped, actions: null })
      },
      "\u6062\u590D\u9ED8\u8BA4"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy || actionsMixed,
        onClick: () => setModal({ kind: "action" })
      },
      icon("IconPlusOutlineRegular"),
      "\u6DFB\u52A0\u64CD\u4F5C"
    ))), actionsMixed && /* @__PURE__ */ React.createElement("p", { className: "dpm-muted" }, "\u5404\u73AF\u5883\u7684\u64CD\u4F5C\u4E0D\u540C\uFF0C\u8BF7\u9009\u62E9\u73AF\u5883\u540E\u7F16\u8F91\u6216\u8FD0\u884C\u3002"), !actionsMixed && page !== "defaults" && currentTarget && /* @__PURE__ */ React.createElement("div", { className: "dpm-action-target" }, /* @__PURE__ */ React.createElement("span", { className: "dpm-muted" }, "\u8FD0\u884C\u4E8E"), /* @__PURE__ */ React.createElement(
      SelectMenu,
      {
        label: "\u64CD\u4F5C\u8FD0\u884C\u76EE\u5F55",
        value: currentTarget.key,
        items: checkouts.map((c) => ({
          id: c.key,
          label: c.environmentName + " \xB7 " + c.path,
          disabled: !c.online || c.missing
        })),
        onSelect: setTarget
      }
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy || !currentTarget.online || currentTarget.missing,
        onClick: () => void handle(async () => {
          const imported = (await controller.operation({
            op: "importActions",
            projectKey: project.key,
            checkoutKey: currentTarget.key
          })).filter(
            (item) => !actions.some(
              (a) => a.command === item.command || a.name.toLocaleLowerCase() === item.name.toLocaleLowerCase()
            )
          );
          setModal({ kind: "import", actions: imported });
        })
      },
      "\u5BFC\u5165 t3.json"
    )), !actionsMixed && /* @__PURE__ */ React.createElement("div", { className: "dpm-actions" }, actions.map((action) => /* @__PURE__ */ React.createElement("div", { key: action.id, className: "dpm-action" }, /* @__PURE__ */ React.createElement("span", { className: "dpm-action-glyph" }, icon(
      glyphs[action.icon] || "IconCodeOutlineRegular"
    )), /* @__PURE__ */ React.createElement("span", { className: "dpm-row-text" }, /* @__PURE__ */ React.createElement("strong", null, action.name), /* @__PURE__ */ React.createElement("code", { title: action.command }, action.command)), page !== "defaults" && /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy || !currentTarget?.online || currentTarget.missing,
        "aria-label": "\u8FD0\u884C " + action.name,
        onClick: () => void handle(async () => {
          const r = await controller.run({
            projectKey: project.key,
            checkoutKey: currentTarget.key,
            actionId: action.id
          });
          setModal({
            kind: "run",
            id: r.id,
            environmentId: r.environmentId
          });
        })
      },
      icon("IconPlayOutlineRegular", 14)
    ), /* @__PURE__ */ React.createElement(
      SelectMenu,
      {
        compact: true,
        label: "\u7BA1\u7406\u64CD\u4F5C " + action.name,
        value: "",
        items: [
          { id: "edit", label: "\u7F16\u8F91" },
          { id: "delete", label: "\u5220\u9664", danger: true }
        ],
        onSelect: (id) => id === "edit" ? setModal({ kind: "action", ...action }) : saveActions(
          actions.filter((a) => a.id !== action.id)
        )
      }
    ))), !actions.length && /* @__PURE__ */ React.createElement("p", { className: "dpm-empty" }, "\u6DFB\u52A0\u6784\u5EFA\u3001\u5F00\u53D1\u6216\u68C0\u67E5\u547D\u4EE4\uFF0C\u5728\u9009\u5B9A\u76EE\u5F55\u4E2D\u8FD0\u884C\u3002"))), project && page !== "defaults" && /* @__PURE__ */ React.createElement("section", { className: "dpm-section" }, /* @__PURE__ */ React.createElement("div", { className: "dpm-section-heading" }, /* @__PURE__ */ React.createElement("h3", null, "\u6700\u8FD1\u8FD0\u884C")), state.runs.filter(
      (r) => project.checkouts.some(
        (c) => c.id === r.checkoutId && c.environmentId === r.environmentId
      )
    ).slice(0, 8).map((r) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: r.environmentId + r.id,
        className: "dpm-run-row",
        onClick: () => setModal({
          kind: "run",
          id: r.id,
          environmentId: r.environmentId
        })
      },
      /* @__PURE__ */ React.createElement("span", null, r.name),
      /* @__PURE__ */ React.createElement("span", { className: "dpm-muted" }, r.status === "running" ? "\u8FD0\u884C\u4E2D" : r.status === "completed" ? "\u5DF2\u5B8C\u6210" : r.status === "stopped" ? "\u5DF2\u505C\u6B62" : "\u5931\u8D25", r.exitCode !== null && r.exitCode !== void 0 ? " \xB7 " + r.exitCode : ""),
      icon("IconChevronRightOutlineRegular", 14)
    ))), project && page !== "defaults" && /* @__PURE__ */ React.createElement("div", { className: "dpm-danger" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        disabled: state.busy,
        onClick: () => setModal({
          kind: "confirm",
          title: "\u79FB\u9664\u9879\u76EE",
          message: `\u4ECE\u6240\u9009\u73AF\u5883\u79FB\u9664\u201C${project.name}\u201D\u7684\u9879\u76EE\u767B\u8BB0\uFF1F\u76EE\u5F55\u4E0E\u4F1A\u8BDD\u90FD\u4F1A\u4FDD\u7559\u3002`,
          request: { op: "removeProject", ...scoped }
        })
      },
      "\u79FB\u9664\u9879\u76EE"
    ))) : /* @__PURE__ */ React.createElement("p", { className: "dpm-empty" }, "\u8FD9\u4E2A\u9879\u76EE\u5DF2\u4E0D\u5B58\u5728\uFF0C\u8FD4\u56DE\u9879\u76EE\u5217\u8868\u67E5\u770B\u3002")), modal?.kind === "icon" && project && /* @__PURE__ */ React.createElement(
      IconPicker,
      {
        project,
        busy: state.busy,
        saveError: state.error,
        onClose: () => setModal(null),
        onSave: (value) => save({ op: "icon", ...scoped, icon: value })
      }
    ), ["environment", "checkout", "action"].includes(modal?.kind) && view && /* @__PURE__ */ React.createElement(
      TextForm,
      {
        kind: modal.kind,
        initial: modal,
        saveError: state.error,
        environments: envs,
        localId: view.localId,
        busy: state.busy,
        onClose: () => setModal(null),
        pickDirectory: controller.pickDirectory,
        onSubmit: (value) => modal.kind === "action" ? saveActions([
          ...actions.filter((a) => a.id !== value.id),
          value
        ]) : save(
          modal.kind === "environment" ? { op: "connect", ...value } : {
            op: "addCheckout",
            projectKey: modal.projectKey,
            ...value
          }
        )
      }
    ), modal?.kind === "confirm" && /* @__PURE__ */ React.createElement(
      Modal,
      {
        open: true,
        title: modal.title,
        closeLabel: "\u5173\u95ED",
        onClose: () => setModal(null),
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: () => setModal(null) }, "\u53D6\u6D88"), /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "primary",
            disabled: state.busy,
            onClick: async () => {
              if (await controller.mutate(modal.request)) {
                setModal(null);
                if (modal.request.op === "removeProject")
                  setSelected("all");
              }
            }
          },
          modal.request.op === "disconnect" ? "\u786E\u8BA4\u65AD\u5F00" : "\u786E\u8BA4\u79FB\u9664"
        ))
      },
      /* @__PURE__ */ React.createElement("p", null, modal.message),
      state.error && /* @__PURE__ */ React.createElement("p", { role: "alert", className: "dpm-error" }, state.error)
    ), modal?.kind === "import" && /* @__PURE__ */ React.createElement(
      Modal,
      {
        open: true,
        title: "\u5BFC\u5165\u9879\u76EE\u64CD\u4F5C",
        closeLabel: "\u5173\u95ED",
        onClose: () => setModal(null),
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: () => setModal(null) }, "\u53D6\u6D88"), /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "primary",
            disabled: state.busy || !modal.actions.length,
            onClick: () => saveActions([...actions, ...modal.actions])
          },
          "\u5BFC\u5165 ",
          modal.actions.length,
          " \u4E2A\u64CD\u4F5C"
        ))
      },
      /* @__PURE__ */ React.createElement("p", null, modal.actions.length ? "\u4EC5\u5BFC\u5165\u547D\u4EE4\uFF0C\u5BFC\u5165\u540E\u4E0D\u8FD0\u884C\u3002" : "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u65B0\u64CD\u4F5C\u3002"),
      modal.actions.map((a) => /* @__PURE__ */ React.createElement("div", { className: "dpm-import-action", key: a.id }, /* @__PURE__ */ React.createElement("strong", null, a.name), /* @__PURE__ */ React.createElement("code", null, a.command)))
    ), modal?.kind === "run" && run && /* @__PURE__ */ React.createElement(
      Modal,
      {
        open: true,
        title: run.name,
        closeLabel: "\u5173\u95ED",
        onClose: () => setModal(null),
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, run.status === "running" && /* @__PURE__ */ React.createElement(
          Button,
          {
            variant: "outline",
            disabled: state.busy,
            onClick: () => void handle(() => controller.stop(run))
          },
          icon("IconStopFillRegular", 14),
          "\u505C\u6B62"
        ), /* @__PURE__ */ React.createElement(Button, { variant: "outline", onClick: () => setModal(null) }, "\u5173\u95ED"))
      },
      /* @__PURE__ */ React.createElement("div", { className: "dpm-run-meta" }, /* @__PURE__ */ React.createElement("code", null, run.command), /* @__PURE__ */ React.createElement("span", null, run.cwd), /* @__PURE__ */ React.createElement("span", null, run.status === "running" ? "\u8FD0\u884C\u4E2D" : run.status === "completed" ? "\u5DF2\u5B8C\u6210" : run.status === "stopped" ? "\u5DF2\u505C\u6B62" : "\u5931\u8D25", run.exitCode !== null ? " \xB7 " + run.exitCode : "")),
      run.connectionError && /* @__PURE__ */ React.createElement("p", { className: "dpm-error" }, run.connectionError),
      /* @__PURE__ */ React.createElement("pre", { className: "dpm-output" }, run.output || "\u7B49\u5F85\u8F93\u51FA\u2026")
    ));
  };
}

// src/page.css
var page_default = '.dpm {\n  color: var(--dsw-alias-label-primary);\n  font: 14px/20px var(--dsw-font-family, system-ui);\n  max-width: 920px;\n  margin: 0 auto;\n  padding: 0 0 24px;\n}\n.dpm *,\n.dpm *::before,\n.dpm *::after {\n  box-sizing: border-box;\n}\n.dpm h2 {\n  font-size: 20px;\n  line-height: 28px;\n  font-weight: 600;\n  margin: 0;\n}\n.dpm-header h2 {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dpm-header > button {\n  flex: none;\n}\n.dpm h3 {\n  font-size: 14px;\n  line-height: 20px;\n  font-weight: 600;\n  margin: 0;\n}\n.dpm button,\n.dpm input,\n.dpm textarea {\n  font-family: inherit;\n}\n.dpm-header,\n.dpm-header > div,\n.dpm-toolbar,\n.dpm-inline,\n.dpm-scope,\n.dpm-section-heading {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n}\n.dpm-header {\n  justify-content: space-between;\n  margin-bottom: 24px;\n}\n.dpm-toolbar {\n  justify-content: space-between;\n  margin: 18px 0 14px;\n}\n.dpm-toolbar > input {\n  max-width: 320px;\n}\n.dpm-scope {\n  gap: 8px;\n  margin-bottom: 24px;\n  flex-wrap: wrap;\n}\n.dpm-scope button {\n  max-width: 300px;\n}\n.dpm-select-label {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dpm-muted {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  line-height: 18px;\n}\n.dpm-list {\n  border: 0.5px solid var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-lg);\n  overflow: hidden;\n}\n.dpm-project-row {\n  width: 100%;\n  border: 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 14px 16px;\n  text-align: left;\n  cursor: pointer;\n}\n.dpm-project-row:last-child {\n  border-bottom: 0;\n}\n.dpm-row-text {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  min-width: 0;\n  gap: 2px;\n  text-align: left;\n}\n.dpm-row-text > strong {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 14px;\n  line-height: 20px;\n  font-weight: 500;\n  overflow-wrap: anywhere;\n}\n.dpm-row-text > small,\n.dpm-row-text > code {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dpm-row-text > code {\n  font-family: var(--ds-font-family-code, monospace);\n}\n.dpm-project-icon {\n  width: 24px;\n  height: 24px;\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 6px;\n  color: var(--dpm-icon-color);\n  background: color-mix(in srgb, var(--dpm-icon-color) 12%, transparent);\n  font-size: 9px;\n  line-height: 16px;\n  font-weight: 650;\n}\n.dpm-project-icon:has(> svg) {\n  background: transparent;\n}\n.dpm-project-icon img {\n  width: 100%;\n  height: 100%;\n  object-fit: contain;\n  border-radius: inherit;\n}\n.dpm-project-icon .dpm-emoji {\n  font-size: 20px;\n  line-height: 24px;\n}\n.dpm-project-icon.dpm-large {\n  width: 48px;\n  height: 48px;\n  border-radius: var(--dsw-radius-md);\n  font-size: 18px;\n}\n.dpm-large .dpm-emoji {\n  font-size: 32px;\n  line-height: 40px;\n}\n.dpm-tag {\n  display: inline-flex;\n  align-items: center;\n  border-radius: 4px;\n  padding: 0 5px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-interactive-bg-hover);\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 18px;\n  white-space: nowrap;\n}\n.dpm-list-footer {\n  display: flex;\n  gap: 20px;\n  margin-top: 16px;\n  flex-wrap: wrap;\n}\n.dpm-list-footer > button {\n  border: 0;\n  padding: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  line-height: 20px;\n  cursor: pointer;\n}\n.dpm-section {\n  margin: 26px 0 0;\n}\n.dpm-section > h3,\n.dpm-section-heading {\n  margin-bottom: 10px;\n}\n.dpm-section-heading {\n  justify-content: space-between;\n  flex-wrap: wrap;\n}\n.dpm-section-heading h3 {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.dpm-setting {\n  min-height: 62px;\n  display: grid;\n  grid-template-columns: 140px minmax(0, 1fr);\n  align-items: center;\n  gap: 16px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n  padding: 12px 0;\n}\n.dpm-setting > .dpm-inline {\n  justify-content: flex-end;\n}\n.dpm-setting input {\n  max-width: 300px;\n}\n.dpm-checkout {\n  padding: 12px 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n}\n.dpm-checkout .dpm-inline {\n  justify-content: space-between;\n}\n.dpm-checkout .dpm-row-text {\n  max-width: calc(100% - 150px);\n}\n.dpm-action-target {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin-bottom: 10px;\n}\n.dpm-action-target > span:not(.dpm-muted) {\n  min-width: 0;\n  max-width: min(400px, 100%);\n}\n.dpm-action-target > button[aria-haspopup] {\n  min-width: 0;\n  max-width: min(400px, 100%);\n}\n.dpm-action-target button {\n  max-width: 100%;\n}\n.dpm-actions {\n  border-top: 0.5px solid var(--dsw-alias-border-l3);\n}\n.dpm-action {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 12px 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n}\n.dpm-action-glyph {\n  display: inline-flex;\n  flex: none;\n  color: var(--dsw-alias-label-secondary);\n}\n.dpm-empty {\n  padding: 24px 16px;\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n.dpm-environment {\n  padding: 16px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n}\n.dpm-environment:last-child {\n  border-bottom: 0;\n}\n.dpm-environment-actions {\n  display: flex;\n  gap: 8px;\n  margin-top: 12px;\n}\n.dpm-status {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  flex: none;\n}\n.dpm-offline {\n  color: var(--dsw-alias-state-warn-primary);\n}\n.dpm-danger {\n  margin-top: 30px;\n}\n.dpm-danger button {\n  color: var(--dsw-alias-state-error-primary);\n}\n.dpm-run-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  background: transparent;\n  border: 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l3);\n  padding: 12px 0;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.dpm-run-row > span:first-child {\n  flex: 1;\n}\n.dpm-form {\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  min-width: 0;\n}\n.dpm-form label {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  font-size: 13px;\n  line-height: 20px;\n}\n.dpm-form .dpm-inline input {\n  flex: 1;\n  min-width: 0;\n}\n.dpm-form textarea {\n  width: 100%;\n  resize: vertical;\n  border: 0.5px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  border-radius: var(--dsw-radius-md);\n  padding: 10px 12px;\n  font: 12px/20px var(--ds-font-family-code, monospace);\n}\n.dpm-icon-preview {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  margin-bottom: 20px;\n}\n.dpm-options {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin-bottom: 16px;\n}\n.dpm-options button[aria-pressed="true"] {\n  color: var(--dsw-alias-state-business-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dpm-icon-grid {\n  display: grid;\n  grid-template-columns: repeat(6, minmax(0, 1fr));\n  gap: 8px;\n  margin-bottom: 20px;\n}\n.dpm-glyph {\n  width: 100%;\n  height: 40px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border: 0.5px solid var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-sm);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n}\n.dpm-glyph[aria-pressed="true"] {\n  color: var(--dsw-alias-state-business-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.dpm-colors {\n  display: flex;\n  gap: 10px;\n  flex-wrap: wrap;\n  margin-top: 18px;\n}\n.dpm-colors button {\n  width: 22px;\n  height: 22px;\n  border-radius: 50%;\n  border: 2px solid transparent;\n  cursor: pointer;\n}\n.dpm-colors button[aria-pressed="true"] {\n  outline: 2px solid var(--dsw-alias-label-primary);\n  outline-offset: 2px;\n}\n.dpm-error-box {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n  margin: 12px 0;\n  padding: 12px;\n  border: 0.5px solid var(--dsw-alias-state-error-primary);\n  border-radius: var(--dsw-radius-md);\n  color: var(--dsw-alias-state-error-primary);\n}\n.dpm-error {\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 12px;\n  overflow-wrap: anywhere;\n}\n.dpm-run-meta {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  overflow-wrap: anywhere;\n}\n.dpm-run-meta code,\n.dpm-import-action code {\n  font: 12px/18px var(--ds-font-family-code, monospace);\n}\n.dpm-output {\n  max-height: 400px;\n  overflow: auto;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  padding: 12px;\n  margin: 16px 0 0;\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-primary);\n  font: 12px/18px var(--ds-font-family-code, monospace);\n}\n.dpm-import-action {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  margin-top: 12px;\n  overflow-wrap: anywhere;\n}\n.dpm button:focus-visible,\n.dpm textarea:focus-visible,\n.dpm-glyph:focus-visible,\n.dpm-colors button:focus-visible {\n  outline: var(--dsw-focus-ring-width, 2px) solid\n    var(--dsw-alias-state-business-primary);\n  outline-offset: 2px;\n}\n@media (hover: hover) {\n  .dpm-project-row:hover,\n  .dpm-run-row:hover {\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n  .dpm-list-footer button:hover {\n    color: var(--dsw-alias-label-primary);\n  }\n}\n@media (max-width: 700px) {\n  .dpm {\n    padding: 0 0 24px;\n  }\n  .dpm-setting {\n    grid-template-columns: 1fr;\n    gap: 10px;\n  }\n  .dpm-setting > .dpm-inline {\n    justify-content: flex-start;\n  }\n  .dpm-checkout .dpm-row-text {\n    max-width: calc(100% - 100px);\n  }\n  .dpm-toolbar {\n    align-items: flex-start;\n    flex-wrap: wrap;\n  }\n  .dpm-scope button {\n    max-width: 200px;\n  }\n}\n';

// src/composer-projects.mjs
function composerProjects(view, workspaces, selectedId, showArchived = false) {
  const registered = new Map(workspaces.items.map((w) => [w.workspaceId, w]));
  const claimed = /* @__PURE__ */ new Set(), projects = [];
  for (const project of view.projects) {
    const checkouts = project.checkouts.filter((c) => c.environmentId === view.localId && registered.has(c.id));
    if (!checkouts.length) continue;
    for (const c of checkouts) claimed.add(c.id);
    projects.push({ ...project, checkouts: checkouts.map((c) => ({ ...registered.get(c.id), ...c })) });
  }
  for (const w of workspaces.items) if (!claimed.has(w.workspaceId)) {
    projects.push({
      key: "workspace:" + w.workspaceId,
      name: w.title,
      icon: null,
      checkouts: [{ ...w, id: w.workspaceId, path: w.path }]
    });
  }
  projects.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  return {
    selected: projects.find((p) => p.checkouts.some((c) => c.id === selectedId)),
    hasArchived: projects.some((p) => p.archived),
    projects: projects.filter((p) => showArchived || !p.archived || p.checkouts.some((c) => c.id === selectedId))
  };
}

// src/composer.css
var composer_default = "/* Keep the native workspace button, chevron, menu and focus behavior. */\n[data-dpm-project-anchor] { max-width: min(440px, calc(100vw - 32px), 100%); }\n[data-dpm-project-anchor] > :nth-child(-n+2) { display: none; }\n[data-dpm-project-anchor] > :nth-child(3) { order: 1; flex: none; }\n.dpm-composer-chip { display: inline-flex; align-items: center; gap: 6px; min-width: 0; pointer-events: none; }\n.dpm-composer-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.dpm-composer-context { display: inline-flex; align-items: baseline; gap: 8px; min-width: 0; max-width: 200px; color: var(--dsw-alias-label-secondary); font-size: 14px; font-weight: 400; line-height: 20px; }\n.dpm-composer-context > span:first-child { flex: none; }\n.dpm-composer-context > span:last-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.dpm-composer-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 18px; height: 18px; }\n.dpm-composer-icon > .dpm-project-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 18px; height: 18px; border-radius: 4px; color: var(--dpm-icon-color); background: color-mix(in srgb, var(--dpm-icon-color) 12%, transparent); font: 650 9px/16px var(--dsw-font-family, system-ui); }\n.dpm-composer-icon > .dpm-project-icon:has(> svg), .dpm-composer-icon > .dpm-project-icon:has(> .dpm-emoji) { background: transparent; }\n.dpm-composer-icon .dpm-emoji { font-size: 16px; line-height: 18px; }\n.dpm-composer-icon img { width: 100%; height: 100%; object-fit: contain; border-radius: inherit; }\n.dpm-composer-option { display: flex; flex-direction: column; min-width: 0; max-width: min(340px, calc(100vw - 100px)); text-align: start; line-height: 20px; }\n.dpm-composer-option > span, .dpm-composer-option > small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.dpm-composer-option > small { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }\n";

// src/composer.jsx
function installComposerProjects(ctx, React, P, ReactDOM, controller) {
  const ProjectIcon = createProjectIcon(React, P);
  const empty = { phase: "ready", items: [] };
  const useEmptyWorkspaces = (select) => select(empty);
  const Icon = ({ project }) => /* @__PURE__ */ React.createElement("span", { className: "dpm-composer-icon" }, /* @__PURE__ */ React.createElement(ProjectIcon, { project, compact: true }));
  const flowSlot = "conversation.hero.workspace.directoryFlow";
  const flowEntries = () => ctx.slots.entries(flowSlot);
  const subscribeFlows = (listener) => ctx.slots.subscribe(flowSlot, listener);
  function ProjectPicker(props) {
    const { nativePicker: NativePicker, useWorkspaces, anchorRef, open, selectedId, onPick, onClose, projectT: t, projectContext } = props;
    const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    const workspaces = useWorkspaces((s) => s);
    const flows = React.useSyncExternalStore(subscribeFlows, flowEntries);
    const flow = flows[0];
    const flowInjected = React.useMemo(() => flow?.inject?.() ?? {}, [flow]);
    const renderDirectoryFlow = React.useCallback((name, owner) => name === flowSlot && flow ? React.createElement(flow.component, { ...flowInjected, ...owner }) : null, [flow, flowInjected]);
    const [showArchived, setShowArchived] = React.useState(false);
    const [directoryOpen, setDirectoryOpen] = React.useState(false);
    const [anchor, setAnchor] = React.useState(null);
    React.useEffect(() => controller.mount(), []);
    React.useEffect(() => {
      void controller.load();
    }, [workspaces]);
    React.useLayoutEffect(() => {
      setAnchor(anchorRef?.current ?? null);
    }, [anchorRef]);
    React.useEffect(() => {
      if (!anchor || !open) return;
      const keepTriggerPress = (event) => event.stopPropagation();
      anchor.addEventListener("pointerdown", keepTriggerPress);
      return () => anchor.removeEventListener("pointerdown", keepTriggerPress);
    }, [anchor, open]);
    const view = state.view ?? (projectContext ? { localId: "", projects: [] } : null);
    const catalog = view ? composerProjects(view, workspaces, selectedId, showArchived) : null;
    const project = workspaces.phase === "ready" ? catalog?.selected : null;
    const checkout = project?.checkouts.find((c) => c.id === selectedId);
    const summary = projectContext?.summary;
    const chipLabel = project ? t("chooseProject") + ": " + project.name + (summary ? " \xB7 " + summary : "") : null;
    React.useLayoutEffect(() => {
      if (!anchor || !project) return;
      const label2 = anchor.getAttribute("aria-label"), title = anchor.getAttribute("title");
      const busy = anchor.getAttribute("aria-busy");
      anchor.setAttribute("data-dpm-project-anchor", "");
      anchor.toggleAttribute("data-dpm-project-context", !!summary);
      if (projectContext) anchor.setAttribute("aria-busy", String(projectContext.busy));
      anchor.setAttribute("aria-label", chipLabel);
      anchor.setAttribute("title", [checkout?.path || project.name, projectContext?.tip].filter(Boolean).join("\n"));
      return () => {
        anchor.removeAttribute("data-dpm-project-anchor");
        anchor.removeAttribute("data-dpm-project-context");
        if (busy === null) anchor.removeAttribute("aria-busy");
        else anchor.setAttribute("aria-busy", busy);
        if (label2 === null) anchor.removeAttribute("aria-label");
        else anchor.setAttribute("aria-label", label2);
        if (title === null) anchor.removeAttribute("title");
        else anchor.setAttribute("title", title);
      };
    }, [anchor, chipLabel, checkout?.path, projectContext?.tip, projectContext?.busy]);
    const getAnchorRect = React.useCallback(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
    const closeDirectory = React.useCallback(() => setDirectoryOpen(false), []);
    const canAdd = props.useDirectoryFlow((s) => s);
    if (!catalog || workspaces.phase !== "ready") return /* @__PURE__ */ React.createElement(NativePicker, { ...props, renderSlot: renderDirectoryFlow });
    const label = (name, path) => /* @__PURE__ */ React.createElement("span", { className: "dpm-composer-option", title: path }, /* @__PURE__ */ React.createElement("span", null, name), /* @__PURE__ */ React.createElement("small", null, path));
    const items = catalog.projects.map((p) => {
      const available = p.checkouts.some((c) => !c.missing && c.online !== false);
      if (p.checkouts.length === 1) {
        const c = p.checkouts[0];
        return { id: "checkout:" + c.id, label: label(p.name, c.path), icon: /* @__PURE__ */ React.createElement(Icon, { project: p }), disabled: !available };
      }
      return {
        id: "project:" + p.key,
        label: p.name,
        icon: /* @__PURE__ */ React.createElement(Icon, { project: p }),
        disabled: !available,
        submenu: p.checkouts.map((c) => ({
          id: "checkout:" + c.id,
          label: label(c.title || p.name, c.path),
          icon: /* @__PURE__ */ React.createElement(P.IconFolderCloseRegular, { size: 16 }),
          disabled: !!c.missing || c.online === false
        }))
      };
    });
    const footer = [
      ...catalog.hasArchived ? [{ id: "action:archived", label: t(showArchived ? "hideArchivedProjects" : "showArchivedProjects"), icon: /* @__PURE__ */ React.createElement(P.IconArchiveOutlineRegular, { size: 16 }) }] : [],
      ...canAdd ? [{ id: "action:add", label: t("addProject"), icon: /* @__PURE__ */ React.createElement(P.IconPlusOutlineRegular, { size: 16 }) }] : []
    ];
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, composer_default), anchor && project && ReactDOM.createPortal(/* @__PURE__ */ React.createElement("span", { className: "dpm-composer-chip" }, /* @__PURE__ */ React.createElement(Icon, { project }), /* @__PURE__ */ React.createElement("span", { className: "dpm-composer-name" }, project.name), summary && /* @__PURE__ */ React.createElement("span", { className: "dpm-composer-context" }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "\xB7"), /* @__PURE__ */ React.createElement("span", null, summary))), anchor), /* @__PURE__ */ React.createElement(
      P.Menu,
      {
        open,
        anchor: null,
        getAnchorRect,
        items: projectContext?.items?.length ? [...items, { type: "separator", id: "project-context:separator" }, ...projectContext.items] : items,
        footer,
        selectedIds: ["checkout:" + selectedId, ...project ? ["project:" + project.key] : [], ...projectContext?.selectedIds ?? []],
        onClose,
        portal: true,
        autoFocus: true,
        returnFocus: () => anchorRef?.current ?? null,
        onSelect: (id) => {
          if (projectContext?.onSelect?.(id)) {
            onClose();
            return;
          }
          if (id === "action:archived") {
            setShowArchived((v) => !v);
            return;
          }
          if (id === "action:add") {
            onClose();
            setDirectoryOpen(true);
            return;
          }
          const c = catalog.projects.flatMap((p) => p.checkouts).find((c2) => "checkout:" + c2.id === id);
          if (c && !c.missing && c.online !== false) onPick(c.id);
        }
      }
    ), /* @__PURE__ */ React.createElement(NativePicker, { ...props, open: directoryOpen, useWorkspaces: useEmptyWorkspaces, onClose: closeDirectory, renderSlot: renderDirectoryFlow }));
  }
  ProjectPicker.dshProjectContextVersion = 1;
  return ctx.slots.inject("conversation.hero.workspace", () => ctx.effect(() => {
    let original, disposeEntry, installing = false;
    function install() {
      if (installing) return;
      const next = ctx.slots.entries("conversation.hero.workspace").find((e) => e.component !== ProjectPicker && e.children?.["conversation.hero.workspace.directoryFlow"]);
      if (next === original) return;
      installing = true;
      try {
        disposeEntry?.();
        disposeEntry = void 0;
        original = next;
        if (!next) return;
        disposeEntry = ctx.slots.register({
          name: "conversation.hero.workspace",
          priority: -100,
          locale: next.locale ?? next.options?.locale,
          ...next.store ? { store: next.store } : {},
          inject: (...args) => ({ ...next.inject?.(...args), nativePicker: next.component, projectT: ctx.locale.bind("projectManager") })
        }, ProjectPicker);
      } finally {
        installing = false;
      }
    }
    const unsubscribe = ctx.slots.subscribe("conversation.hero.workspace", install);
    install();
    return () => {
      unsubscribe();
      disposeEntry?.();
    };
  }, "project-manager: composer project picker"));
}

// src/client.mjs
function createPlugin(require2) {
  const React = require2("react"), P = require2("@deepseek-ai/dsh-client-ui-primitives"), Page = createProjectPage(React, P, page_default);
  return {
    inject: ["slots", "locale", "connection", "uiWorkspace", "workspaces"],
    apply(ctx) {
      const controller = createController(ctx);
      installComposerProjects(ctx, React, P, require2("react-dom"), controller);
      ctx.effect(
        () => () => controller.dispose(),
        "project-manager: UI source"
      );
      ctx.effect(
        () => ctx.locale.register("projectManager", {
          zh: { title: "\u9879\u76EE", environments: "\u73AF\u5883", chooseProject: "\u9009\u62E9\u9879\u76EE", addProject: "\u6DFB\u52A0\u9879\u76EE\u2026", showArchivedProjects: "\u663E\u793A\u5DF2\u5F52\u6863\u9879\u76EE", hideArchivedProjects: "\u9690\u85CF\u5DF2\u5F52\u6863\u9879\u76EE" },
          en: { title: "Projects", environments: "Environments", chooseProject: "Choose project", addProject: "Add project\u2026", showArchivedProjects: "Show archived projects", hideArchivedProjects: "Hide archived projects" }
        }),
        "project-manager: locale"
      );
      for (const [id, label, view, order] of [
        ["dsh-project-manager", "title", "projects", 30],
        ["dsh-project-environments", "environments", "environments", 31]
      ]) {
        ctx.slots.inject(
          "settings.section",
          () => ctx.slots.register(
            {
              name: "settings.section",
              id,
              order,
              locale: "projectManager",
              label: () => ctx.locale.bind("projectManager")(label),
              inject: () => ({
                controller,
                initialView: view,
                hooks: { projectManager: controller }
              })
            },
            Page
          )
        );
        const Icon = () => React.createElement(
          view === "projects" ? P.IconFolderCloseRegular : P.IconGlobeOutlineRegular,
          { size: 16 }
        );
        ctx.slots.inject(
          "settings.section.icon",
          () => ctx.slots.register({ name: "settings.section.icon", id }, Icon)
        );
      }
      ctx.effect(() => {
        const match = globalThis.location?.hash.match(
          /^#dsh-project-manager=(.+)$/
        );
        if (!match) return;
        let id;
        try {
          id = decodeURIComponent(match[1]);
        } catch {
          return;
        }
        if (id.length > 100) return;
        let handled = false;
        const open = () => {
          if (handled || ctx.workspaces.list.getSnapshot().phase !== "ready")
            return;
          if (!ctx.workspaces.list.getSnapshot().items.some((w) => w.workspaceId === id))
            return;
          handled = true;
          history.replaceState(
            history.state,
            "",
            location.pathname + location.search
          );
          ctx.uiWorkspace.startSession(id);
        };
        const unsubscribe = ctx.workspaces.list.subscribe(open);
        open();
        return unsubscribe;
      }, "project-manager: environment workspace link");
    }
  };
}
return module.exports.createPlugin(require);}});
