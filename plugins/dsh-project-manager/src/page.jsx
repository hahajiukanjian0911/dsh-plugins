import { COLORS, GLYPHS } from "./model.mjs";
import { createProjectIcon } from "./identity.jsx";
export function createProjectPage(React, P, stylesheet) {
  const { useState, useEffect, useRef } = React,
    { Button, Input, Menu, Modal } = P;
  const names = {
    folder: "文件夹",
    code: "代码",
    document: "文档",
    globe: "网站",
    settings: "工具",
    database: "数据",
    shield: "安全",
    branch: "分支",
    sparkle: "灵感",
    clock: "时钟",
    chat: "对话",
    link: "链接",
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
    link: "IconLinkOutlineRegular",
  };
  const icon = (name, size = 16) =>
    React.createElement(P[name] || P.IconFolderCloseRegular, { size });
  const ProjectIcon = createProjectIcon(React, P);
  function SelectMenu({
    label,
    value,
    items,
    onSelect,
    disabled = false,
    compact = false,
  }) {
    const [open, setOpen] = useState(false);
    return (
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(id) => {
          setOpen(false);
          onSelect(id);
        }}
        items={items}
        selectedId={value}
        autoFocus
        portal
        dense
        anchor={
          <Button
            variant="outline"
            disabled={disabled}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {compact ? (
              icon("IconEllipsisOutlineRegular")
            ) : (
              <span
                className="dpm-select-label"
                title={items.find((i) => i.id === value)?.label || label}
              >
                {items.find((i) => i.id === value)?.label || label}
              </span>
            )}
            {!compact && icon("IconChevronDownOutlineRegular", 12)}
          </Button>
        }
      />
    );
  }
  function IconPicker({ project, onSave, onClose, busy, saveError }) {
    const [kind, setKind] = useState(project.icon?.kind || "auto"),
      [value, setValue] = useState(project.icon?.value || ""),
      [color, setColor] = useState(project.icon?.color || COLORS[7]),
      [error, setError] = useState(null),
      file = useRef(null);
    const draft = {
      ...project,
      icon: kind === "auto" ? null : { kind, value, color },
    };
    const loadImage = async (event) => {
      const item = event.target.files?.[0];
      if (!item) return;
      if (
        item.size > 256 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(item.type)
      ) {
        setError("请选择小于 256 KB 的 PNG、JPEG 或 WebP 图片。");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setValue(String(reader.result));
        setError(null);
      };
      reader.readAsDataURL(item);
    };
    return (
      <Modal
        open
        title="项目图标"
        closeLabel="关闭"
        onClose={onClose}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={busy || (kind !== "auto" && !value.trim())}
              onClick={() => onSave(draft.icon)}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="dpm-icon-preview">
          <ProjectIcon project={draft} large />
          <span>{project.name}</span>
        </div>
        <div className="dpm-options">
          {[
            ["auto", "自动"],
            ["glyph", "图标"],
            ["emoji", "Emoji"],
            ["monogram", "文字"],
            ["image", "图片"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant="outline"
              aria-pressed={kind === id}
              onClick={() => {
                setKind(id);
                setValue(id === "glyph" ? "folder" : "");
                setError(null);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        {kind === "glyph" && (
          <div className="dpm-icon-grid">
            {GLYPHS.map((id) => (
              <button
                key={id}
                className="dpm-glyph"
                aria-label={names[id]}
                aria-pressed={value === id}
                onClick={() => setValue(id)}
              >
                {icon(glyphs[id], 20)}
              </button>
            ))}
          </div>
        )}
        {["emoji", "monogram"].includes(kind) && (
          <Input
            aria-label={kind === "emoji" ? "Emoji" : "图标文字"}
            maxLength={kind === "emoji" ? 12 : 2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={
              kind === "emoji" ? "输入一个 Emoji" : "1–2 个字母或汉字"
            }
          />
        )}
        {kind === "image" && (
          <>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              ref={file}
              onChange={loadImage}
            />
            <Button variant="outline" onClick={() => file.current.click()}>
              选择图片
            </Button>
          </>
        )}
        {kind !== "auto" && kind !== "image" && (
          <div className="dpm-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={"颜色 " + c}
                aria-pressed={color === c}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        )}
        {(error || saveError) && (
          <p role="alert" className="dpm-error">
            {error || saveError}
          </p>
        )}
      </Modal>
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
    saveError,
  }) {
    const [name, setName] = useState(initial?.name || ""),
      [path, setPath] = useState(""),
      [environment, setEnvironment] = useState(
        initial?.environmentId || localId,
      ),
      [error, setError] = useState(null);
    const connection = kind === "environment",
      script = kind === "action";
    const [command, setCommand] = useState(initial?.command || ""),
      [actionIcon, setActionIcon] = useState(initial?.icon || "code");
    return (
      <Modal
        open
        title={
          connection
            ? "连接环境"
            : script
              ? initial?.id
                ? "编辑操作"
                : "添加操作"
              : initial?.projectKey
                ? "添加检出目录"
                : "添加项目"
        }
        closeLabel="关闭"
        onClose={onClose}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                (!connection && !script && !path.trim()) ||
                (connection && !path.trim()) ||
                (script && (!name.trim() || !command.trim()))
              }
              onClick={() =>
                onSubmit(
                  script
                    ? {
                        id: initial?.id || crypto.randomUUID(),
                        name,
                        command,
                        icon: actionIcon,
                      }
                    : connection
                      ? { name, address: path }
                      : { name, path, environmentId: environment },
                )
              }
            >
              {busy ? "保存中…" : connection ? "连接" : "保存"}
            </Button>
          </>
        }
      >
        <div className="dpm-form">
          <label>
            名称{!script && <span className="dpm-muted">（可选）</span>}
            <Input
              aria-label={
                script ? "操作名称" : connection ? "环境名称" : "项目名称"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </label>
          {script ? (
            <>
              <label>
                图标
                <SelectMenu
                  label="操作图标"
                  value={actionIcon}
                  items={GLYPHS.map((id) => ({ id, label: names[id] }))}
                  onSelect={setActionIcon}
                />
              </label>
              <label>
                命令
                <textarea
                  aria-label="操作命令"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder="例如 npm run dev"
                />
              </label>
            </>
          ) : connection ? (
            <label>
              DSH 访问地址
              <Input
                aria-label="DSH 访问地址"
                type="password"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                autoComplete="off"
                placeholder="粘贴带 token 的启动地址"
              />
            </label>
          ) : (
            <>
              <label>
                环境
                <SelectMenu
                  label="目标环境"
                  value={environment}
                  items={environments
                    .filter((e) => e.online)
                    .map((e) => ({ id: e.id, label: e.name }))}
                  onSelect={setEnvironment}
                />
              </label>
              <label>
                目录
                <div className="dpm-inline">
                  <Input
                    aria-label="目录路径"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="已有项目的绝对路径"
                  />
                  {environment === localId && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const selected = await pickDirectory();
                          if (selected)
                            setPath(
                              typeof selected === "string"
                                ? selected
                                : selected.path,
                            );
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      选择目录
                    </Button>
                  )}
                </div>
              </label>
            </>
          )}
          {connection && (
            <p className="dpm-muted">
              目标 DSH 需安装项目管理插件。连接地址不会显示在项目列表中。
            </p>
          )}
          {(error || saveError) && (
            <p role="alert" className="dpm-error">
              {error || saveError}
            </p>
          )}
        </div>
      </Modal>
    );
  }
  return function ProjectPage({
    controller,
    useProjectManager,
    close,
    initialView = "projects",
  }) {
    const state = useProjectManager((s) => s),
      view = state.view;
    const [page, setPage] = useState(initialView),
      [selected, setSelected] = useState("all"),
      [environment, setEnvironment] = useState("all"),
      [query, setQuery] = useState(""),
      [showArchived, setShowArchived] = useState(false),
      [modal, setModal] = useState(null),
      [name, setName] = useState(""),
      [target, setTarget] = useState(""),
      [error, setError] = useState(null);
    useEffect(() => controller.mount(), [controller]);
    useEffect(() => setPage(initialView), [initialView]);
    const groups = view?.projects || [],
      envs = view?.environments || [],
      project = groups.find((p) => p.key === selected);
    const checkouts =
      project?.checkouts.filter(
        (c) => environment === "all" || c.environmentId === environment,
      ) || [];
    const currentTarget =
      checkouts.find((c) => c.key === target) ||
      checkouts.find((c) => c.environmentId === view?.localId) ||
      checkouts[0];
    const displayName =
      project &&
      (environment === "all"
        ? project.name
        : checkouts[0]?.title || project.name);
    const acceptedName = useRef({ key: "", value: "" });
    useEffect(() => {
      const key = (project?.key || "") + ":" + environment;
      if (acceptedName.current.key !== key || name === acceptedName.current.value)
        setName(displayName || "");
      acceptedName.current = { key, value: displayName || "" };
    }, [project?.key, displayName, environment]);
    const run = state.runs.find(
      (r) => r.id === modal?.id && r.environmentId === modal?.environmentId,
    );
    useEffect(
      () =>
        modal?.kind === "run" && run ? controller.watchRun(run) : undefined,
      [controller, modal?.kind, modal?.id, modal?.environmentId],
    );
    const handle = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => setError(e.message));
    const save = async (request) => {
      if (await controller.mutate(request)) {
        setModal(null);
        setError(null);
      }
    };
    const scoped = { projectKey: project?.key, environmentId: environment };
    const scopedCheckouts = (p) =>
      p.checkouts.filter(
        (c) => environment === "all" || c.environmentId === environment,
      );
    const shownName = (p) =>
      environment === "all" ? p.name : scopedCheckouts(p)[0]?.title || p.name;
    const iconItems = groups
      .filter(
        (p) =>
          (!p.archived || showArchived || p.key === selected) &&
          scopedCheckouts(p).length,
      )
      .map((p) => ({ id: p.key, label: shownName(p) }));
    const visible = groups.filter(
      (p) =>
        (showArchived || !p.archived) &&
        (environment === "all" ||
          p.checkouts.some((c) => c.environmentId === environment)) &&
        [p.name, ...p.checkouts.flatMap((c) => [c.path, c.title])].some((s) =>
          s.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        ),
    );
    const actionsMixed =
      environment === "all" &&
      (page === "defaults" ? view?.defaults.mixed : project?.actionsMixed);
    const inherited =
      environment === "all"
        ? project?.inherited
        : project?.inheritanceByEnvironment?.[environment];
    const actions =
      page === "defaults"
        ? (environment === "all"
            ? view?.defaults.actions
            : view?.defaults.resolved?.[environment]) || []
        : (environment === "all"
            ? project?.actions
            : project?.actionsByEnvironment?.[environment]) || [];
    const saveActions = (values) =>
      save(
        page === "defaults"
          ? { op: "defaults", environmentId: environment, actions: values }
          : { op: "actions", ...scoped, actions: values },
      );
    return (
      <div className="dpm">
        <style>{stylesheet}</style>
        <header className="dpm-header">
          <div>
            {(page !== "projects" || selected !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setPage("projects");
                  setSelected("all");
                }}
                aria-label="返回项目列表"
              >
                {icon("IconChevronLeftOutlineRegular")}项目
              </Button>
            )}
            <h2>
              {page === "environments"
                ? "环境"
                : page === "defaults"
                  ? "默认操作"
                  : displayName || "项目"}
            </h2>
          </div>
          <Button
            variant="outline"
            disabled={state.loading || state.busy}
            onClick={() => controller.load()}
            aria-label="刷新项目"
          >
            {icon("IconRefreshOutlineRegular")}刷新
          </Button>
        </header>
        {(error || state.error) && (
          <div role="alert" className="dpm-error-box">
            <span>{error || state.error}</span>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                controller.dismissError();
              }}
            >
              关闭
            </Button>
          </div>
        )}
        {!view ? (
          <p role="status" className="dpm-muted">
            {state.loading ? "正在读取项目…" : "暂时无法读取项目。"}
          </p>
        ) : (
          <>
            {["projects", "defaults"].includes(page) && (
              <div className="dpm-scope">
                {page === "projects" && (
                  <SelectMenu
                    label="项目范围"
                    value={selected}
                    items={[{ id: "all", label: "全部项目" }, ...iconItems]}
                    onSelect={setSelected}
                  />
                )}
                <span className="dpm-muted">所在环境</span>
                <SelectMenu
                  label="环境范围"
                  value={environment}
                  items={[
                    { id: "all", label: "全部环境" },
                    ...envs.map((e) => ({
                      id: e.id,
                      label: e.name + (e.online ? "" : " · 离线"),
                    })),
                  ]}
                  onSelect={(id) => {
                    setEnvironment(id);
                    if (
                      selected !== "all" &&
                      !project?.checkouts.some(
                        (c) => c.environmentId === id || id === "all",
                      )
                    )
                      setSelected("all");
                  }}
                />
              </div>
            )}
            {page === "environments" ? (
              <>
                <div className="dpm-toolbar">
                  <p className="dpm-muted">
                    连接 DSH 环境，在一个列表中管理各处的项目。
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setModal({ kind: "environment" })}
                  >
                    {icon("IconPlusOutlineRegular")}连接环境
                  </Button>
                </div>
                <div className="dpm-list">
                  {envs.map((env) => (
                    <div key={env.id} className="dpm-environment">
                      <div className="dpm-inline">
                        {icon("IconGlobeOutlineRegular", 18)}
                        <div className="dpm-row-text">
                          <strong>
                            {env.name}
                            {env.local && (
                              <span className="dpm-tag">当前环境</span>
                            )}
                          </strong>
                          <small>{env.local ? "此 DSH 主机" : env.url}</small>
                        </div>
                        <span
                          className={
                            "dpm-status " + (env.online ? "" : "dpm-offline")
                          }
                        >
                          {env.online ? "已连接" : "离线"}
                        </span>
                      </div>
                      {!env.local && (
                        <div className="dpm-environment-actions">
                          <Button
                            variant="outline"
                            onClick={() =>
                              setModal({ kind: "environment", name: env.name })
                            }
                          >
                            重新连接
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setModal({
                                kind: "confirm",
                                title: "断开环境",
                                message: `断开“${env.name}”的连接？项目、会话和目录都会保留。`,
                                request: {
                                  op: "disconnect",
                                  environmentId: env.id,
                                },
                              })
                            }
                          >
                            断开
                          </Button>
                        </div>
                      )}
                      {env.error && <p className="dpm-muted">{env.error}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : selected === "all" && page === "projects" ? (
              <>
                <div className="dpm-toolbar">
                  <Input
                    aria-label="搜索项目"
                    placeholder="搜索项目或目录"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <Button
                    variant="primary"
                    disabled={state.busy}
                    onClick={() =>
                      setModal({
                        kind: "checkout",
                        environmentId:
                          environment === "all" ? view.localId : environment,
                      })
                    }
                  >
                    {icon("IconPlusOutlineRegular")}添加项目
                  </Button>
                </div>
                <div className="dpm-list">
                  {visible.map((p) => (
                    <button
                      key={p.key}
                      className="dpm-project-row"
                      onClick={() => setSelected(p.key)}
                    >
                      <ProjectIcon project={p} />
                      <span className="dpm-row-text">
                        <strong>
                          {shownName(p)}
                          {p.pinned && icon("IconPinOutlineRegular", 12)}
                          {p.archived && (
                            <span className="dpm-tag">已归档</span>
                          )}
                        </strong>
                        <small>
                          {scopedCheckouts(p).length === 1
                            ? scopedCheckouts(p)[0].path
                            : `${scopedCheckouts(p).length} 个检出目录 · ${new Set(scopedCheckouts(p).map((c) => c.environmentId)).size} 个环境`}
                        </small>
                      </span>
                      {icon("IconChevronRightOutlineRegular", 14)}
                    </button>
                  ))}
                  {!visible.length && (
                    <p className="dpm-empty">
                      {query
                        ? "没有匹配的项目"
                        : "还没有项目，添加一个已有目录即可开始。"}
                    </p>
                  )}
                </div>
                <footer className="dpm-list-footer">
                  <button onClick={() => setShowArchived(!showArchived)}>
                    {showArchived ? "隐藏已归档项目" : "显示已归档项目"}
                  </button>
                  <button onClick={() => setPage("defaults")}>默认操作</button>
                  <button onClick={() => setPage("environments")}>
                    管理环境
                  </button>
                </footer>
              </>
            ) : page === "defaults" || project ? (
              <>
                {project && page !== "defaults" && (
                  <>
                    <section className="dpm-section">
                      <h3>基本信息</h3>
                      <div className="dpm-setting">
                        <label htmlFor="dpm-name">名称</label>
                        <div className="dpm-inline">
                          <Input
                            id="dpm-name"
                            aria-label="项目名称"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={100}
                          />
                          <Button
                            variant="primary"
                            disabled={
                              state.busy ||
                              !name.trim() ||
                              name.trim() === displayName
                            }
                            onClick={() =>
                              save({ op: "rename", ...scoped, name })
                            }
                          >
                            保存
                          </Button>
                        </div>
                      </div>
                      <div className="dpm-setting">
                        <span>图标</span>
                        <div className="dpm-inline">
                          <ProjectIcon project={project} />
                          <Button
                            variant="outline"
                            disabled={state.busy}
                            onClick={() => setModal({ kind: "icon" })}
                          >
                            选择图标
                          </Button>
                        </div>
                      </div>
                      <div className="dpm-setting">
                        <span>整理</span>
                        <div className="dpm-inline">
                          <Button
                            variant="outline"
                            aria-pressed={project.pinned}
                            disabled={state.busy}
                            onClick={() =>
                              save({
                                op: "organize",
                                ...scoped,
                                pinned: !project.pinned,
                              })
                            }
                          >
                            {icon("IconPinOutlineRegular")}
                            {project.pinned ? "取消置顶" : "置顶项目"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={state.busy}
                            onClick={() =>
                              save({
                                op: "organize",
                                ...scoped,
                                archived: !project.archived,
                              })
                            }
                          >
                            {project.archived ? "取消归档" : "归档项目"}
                          </Button>
                        </div>
                      </div>
                    </section>
                    <section className="dpm-section">
                      <div className="dpm-section-heading">
                        <h3>检出目录</h3>
                        <Button
                          variant="outline"
                          disabled={state.busy}
                          onClick={() =>
                            setModal({
                              kind: "checkout",
                              projectKey: project.key,
                              environmentId:
                                environment === "all"
                                  ? view.localId
                                  : environment,
                            })
                          }
                        >
                          {icon("IconPlusOutlineRegular")}添加目录
                        </Button>
                      </div>
                      {checkouts.map((c) => (
                        <div className="dpm-checkout" key={c.key}>
                          <div className="dpm-inline">
                            <span className="dpm-row-text">
                              <strong>
                                {c.environmentName}
                                <span
                                  className={
                                    "dpm-tag " +
                                    (!c.online ? "dpm-offline" : "")
                                  }
                                >
                                  {!c.online
                                    ? "离线"
                                    : c.missing
                                      ? "目录不可用"
                                      : c.branch || "目录"}
                                </span>
                              </strong>
                              <small title={c.path}>{c.path}</small>
                            </span>
                            <SelectMenu
                              compact
                              label={"目录操作 " + c.path}
                              value=""
                              items={[
                                {
                                  id: "new",
                                  label: "新会话",
                                  disabled: !c.online || c.missing,
                                },
                                {
                                  id: "finder",
                                  label: "打开目录",
                                  disabled: !c.online || c.missing,
                                },
                                {
                                  id: "vscode",
                                  label: "在 VS Code 中打开",
                                  disabled: !c.online || c.missing,
                                },
                                {
                                  id: "cursor",
                                  label: "在 Cursor 中打开",
                                  disabled: !c.online || c.missing,
                                },
                                { type: "separator", id: "sep" },
                                { id: "auto", label: "自动分组" },
                                { id: "separate", label: "独立为一个项目" },
                                ...groups
                                  .filter((g) => g.key !== project.key)
                                  .map((g) => ({
                                    id: "group:" + g.key,
                                    label: "归入 " + g.name,
                                  })),
                                { type: "separator", id: "remove-sep" },
                                {
                                  id: "remove",
                                  label: "移除检出目录",
                                  danger: true,
                                  disabled: !c.online,
                                },
                              ]}
                              onSelect={(id) => {
                                if (id === "new")
                                  void handle(() =>
                                    controller.newSession(
                                      project.key,
                                      c.key,
                                      close,
                                    ),
                                  );
                                else if (
                                  ["finder", "vscode", "cursor"].includes(id)
                                )
                                  void handle(() =>
                                    controller.operation({
                                      op: "open",
                                      projectKey: project.key,
                                      checkoutKey: c.key,
                                      application: id,
                                    }),
                                  );
                                else if (id === "remove")
                                  setModal({
                                    kind: "confirm",
                                    title: "移除检出目录",
                                    message: `移除“${c.path}”的项目登记？目录与会话都会保留。`,
                                    request: {
                                      op: "removeCheckout",
                                      checkoutKey: c.key,
                                    },
                                  });
                                else
                                  void save({
                                    op: "assign",
                                    checkoutKey: c.key,
                                    destination: id.startsWith("group:")
                                      ? id.slice(6)
                                      : id,
                                  });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </section>
                  </>
                )}
                <section className="dpm-section">
                  <div className="dpm-section-heading">
                    <h3>
                      {page === "defaults" ? "操作" : "项目操作"}
                      {inherited && page !== "defaults" && (
                        <span className="dpm-tag">使用默认操作</span>
                      )}
                    </h3>
                    <div className="dpm-inline">
                      {project && !inherited && page !== "defaults" && (
                        <Button
                          variant="outline"
                          disabled={state.busy}
                          onClick={() =>
                            save({ op: "actions", ...scoped, actions: null })
                          }
                        >
                          恢复默认
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={state.busy || actionsMixed}
                        onClick={() => setModal({ kind: "action" })}
                      >
                        {icon("IconPlusOutlineRegular")}添加操作
                      </Button>
                    </div>
                  </div>
                  {actionsMixed && (
                    <p className="dpm-muted">
                      各环境的操作不同，请选择环境后编辑或运行。
                    </p>
                  )}
                  {!actionsMixed && page !== "defaults" && currentTarget && (
                    <div className="dpm-action-target">
                      <span className="dpm-muted">运行于</span>
                      <SelectMenu
                        label="操作运行目录"
                        value={currentTarget.key}
                        items={checkouts.map((c) => ({
                          id: c.key,
                          label: c.environmentName + " · " + c.path,
                          disabled: !c.online || c.missing,
                        }))}
                        onSelect={setTarget}
                      />
                      <Button
                        variant="outline"
                        disabled={
                          state.busy ||
                          !currentTarget.online ||
                          currentTarget.missing
                        }
                        onClick={() =>
                          void handle(async () => {
                            const imported = (
                              await controller.operation({
                                op: "importActions",
                                projectKey: project.key,
                                checkoutKey: currentTarget.key,
                              })
                            ).filter(
                              (item) =>
                                !actions.some(
                                  (a) =>
                                    a.command === item.command ||
                                    a.name.toLocaleLowerCase() ===
                                      item.name.toLocaleLowerCase(),
                                ),
                            );
                            setModal({ kind: "import", actions: imported });
                          })
                        }
                      >
                        导入 t3.json
                      </Button>
                    </div>
                  )}
                  {!actionsMixed && (
                    <div className="dpm-actions">
                      {actions.map((action) => (
                        <div key={action.id} className="dpm-action">
                          <span className="dpm-action-glyph">
                            {icon(
                              glyphs[action.icon] || "IconCodeOutlineRegular",
                            )}
                          </span>
                          <span className="dpm-row-text">
                            <strong>{action.name}</strong>
                            <code title={action.command}>{action.command}</code>
                          </span>
                          {page !== "defaults" && (
                            <Button
                              variant="outline"
                              disabled={
                                state.busy ||
                                !currentTarget?.online ||
                                currentTarget.missing
                              }
                              aria-label={"运行 " + action.name}
                              onClick={() =>
                                void handle(async () => {
                                  const r = await controller.run({
                                    projectKey: project.key,
                                    checkoutKey: currentTarget.key,
                                    actionId: action.id,
                                  });
                                  setModal({
                                    kind: "run",
                                    id: r.id,
                                    environmentId: r.environmentId,
                                  });
                                })
                              }
                            >
                              {icon("IconPlayOutlineRegular", 14)}
                            </Button>
                          )}
                          <SelectMenu
                            compact
                            label={"管理操作 " + action.name}
                            value=""
                            items={[
                              { id: "edit", label: "编辑" },
                              { id: "delete", label: "删除", danger: true },
                            ]}
                            onSelect={(id) =>
                              id === "edit"
                                ? setModal({ kind: "action", ...action })
                                : saveActions(
                                    actions.filter((a) => a.id !== action.id),
                                  )
                            }
                          />
                        </div>
                      ))}
                      {!actions.length && (
                        <p className="dpm-empty">
                          添加构建、开发或检查命令，在选定目录中运行。
                        </p>
                      )}
                    </div>
                  )}
                </section>
                {project && page !== "defaults" && (
                  <section className="dpm-section">
                    <div className="dpm-section-heading">
                      <h3>最近运行</h3>
                    </div>
                    {state.runs
                      .filter((r) =>
                        project.checkouts.some(
                          (c) =>
                            c.id === r.checkoutId &&
                            c.environmentId === r.environmentId,
                        ),
                      )
                      .slice(0, 8)
                      .map((r) => (
                        <button
                          key={r.environmentId + r.id}
                          className="dpm-run-row"
                          onClick={() =>
                            setModal({
                              kind: "run",
                              id: r.id,
                              environmentId: r.environmentId,
                            })
                          }
                        >
                          <span>{r.name}</span>
                          <span className="dpm-muted">
                            {r.status === "running"
                              ? "运行中"
                              : r.status === "completed"
                                ? "已完成"
                                : r.status === "stopped"
                                  ? "已停止"
                                  : "失败"}
                            {r.exitCode !== null && r.exitCode !== undefined
                              ? " · " + r.exitCode
                              : ""}
                          </span>
                          {icon("IconChevronRightOutlineRegular", 14)}
                        </button>
                      ))}
                  </section>
                )}
                {project && page !== "defaults" && (
                  <div className="dpm-danger">
                    <Button
                      variant="outline"
                      disabled={state.busy}
                      onClick={() =>
                        setModal({
                          kind: "confirm",
                          title: "移除项目",
                          message: `从所选环境移除“${project.name}”的项目登记？目录与会话都会保留。`,
                          request: { op: "removeProject", ...scoped },
                        })
                      }
                    >
                      移除项目
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="dpm-empty">这个项目已不存在，返回项目列表查看。</p>
            )}
          </>
        )}
        {modal?.kind === "icon" && project && (
          <IconPicker
            project={project}
            busy={state.busy}
            saveError={state.error}
            onClose={() => setModal(null)}
            onSave={(value) => save({ op: "icon", ...scoped, icon: value })}
          />
        )}
        {["environment", "checkout", "action"].includes(modal?.kind) &&
          view && (
            <TextForm
              kind={modal.kind}
              initial={modal}
              saveError={state.error}
              environments={envs}
              localId={view.localId}
              busy={state.busy}
              onClose={() => setModal(null)}
              pickDirectory={controller.pickDirectory}
              onSubmit={(value) =>
                modal.kind === "action"
                  ? saveActions([
                      ...actions.filter((a) => a.id !== value.id),
                      value,
                    ])
                  : save(
                      modal.kind === "environment"
                        ? { op: "connect", ...value }
                        : {
                            op: "addCheckout",
                            projectKey: modal.projectKey,
                            ...value,
                          },
                    )
              }
            />
          )}
        {modal?.kind === "confirm" && (
          <Modal
            open
            title={modal.title}
            closeLabel="关闭"
            onClose={() => setModal(null)}
            footer={
              <>
                <Button variant="outline" onClick={() => setModal(null)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  disabled={state.busy}
                  onClick={async () => {
                    if (await controller.mutate(modal.request)) {
                      setModal(null);
                      if (modal.request.op === "removeProject")
                        setSelected("all");
                    }
                  }}
                >
                  {modal.request.op === "disconnect" ? "确认断开" : "确认移除"}
                </Button>
              </>
            }
          >
            <p>{modal.message}</p>
            {state.error && (
              <p role="alert" className="dpm-error">
                {state.error}
              </p>
            )}
          </Modal>
        )}
        {modal?.kind === "import" && (
          <Modal
            open
            title="导入项目操作"
            closeLabel="关闭"
            onClose={() => setModal(null)}
            footer={
              <>
                <Button variant="outline" onClick={() => setModal(null)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  disabled={state.busy || !modal.actions.length}
                  onClick={() => saveActions([...actions, ...modal.actions])}
                >
                  导入 {modal.actions.length} 个操作
                </Button>
              </>
            }
          >
            <p>
              {modal.actions.length
                ? "仅导入命令，导入后不运行。"
                : "没有可导入的新操作。"}
            </p>
            {modal.actions.map((a) => (
              <div className="dpm-import-action" key={a.id}>
                <strong>{a.name}</strong>
                <code>{a.command}</code>
              </div>
            ))}
          </Modal>
        )}
        {modal?.kind === "run" && run && (
          <Modal
            open
            title={run.name}
            closeLabel="关闭"
            onClose={() => setModal(null)}
            footer={
              <>
                {run.status === "running" && (
                  <Button
                    variant="outline"
                    disabled={state.busy}
                    onClick={() => void handle(() => controller.stop(run))}
                  >
                    {icon("IconStopFillRegular", 14)}停止
                  </Button>
                )}
                <Button variant="outline" onClick={() => setModal(null)}>
                  关闭
                </Button>
              </>
            }
          >
            <div className="dpm-run-meta">
              <code>{run.command}</code>
              <span>{run.cwd}</span>
              <span>
                {run.status === "running"
                  ? "运行中"
                  : run.status === "completed"
                    ? "已完成"
                    : run.status === "stopped"
                      ? "已停止"
                      : "失败"}
                {run.exitCode !== null ? " · " + run.exitCode : ""}
              </span>
            </div>
            {run.connectionError && (
              <p className="dpm-error">{run.connectionError}</p>
            )}
            <pre className="dpm-output">{run.output || "等待输出…"}</pre>
          </Modal>
        )}
      </div>
    );
  };
}
