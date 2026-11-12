import { createController } from "./controller.mjs";
import { createProjectPage } from "./page.jsx";
import styles from "./page.css";
import { installComposerProjects } from "./composer.jsx";
export function createPlugin(require) {
  const React = require("react"),
    P = require("@deepseek-ai/dsh-client-ui-primitives"),
    Page = createProjectPage(React, P, styles);
  return {
    inject: ["slots", "locale", "connection", "uiWorkspace", "workspaces"],
    apply(ctx) {
      const controller = createController(ctx);
      installComposerProjects(ctx, React, P, require("react-dom"), controller);
      ctx.effect(
        () => () => controller.dispose(),
        "project-manager: UI source",
      );
      ctx.effect(
        () =>
          ctx.locale.register("projectManager", {
            zh: { title: "项目", environments: "环境", chooseProject: "选择项目", addProject: "添加项目…", showArchivedProjects: "显示已归档项目", hideArchivedProjects: "隐藏已归档项目" },
            en: { title: "Projects", environments: "Environments", chooseProject: "Choose project", addProject: "Add project…", showArchivedProjects: "Show archived projects", hideArchivedProjects: "Hide archived projects" },
          }),
        "project-manager: locale",
      );
      for (const [id, label, view, order] of [
        ["dsh-project-manager", "title", "projects", 30],
        ["dsh-project-environments", "environments", "environments", 31],
      ]) {
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            {
              name: "settings.section",
              id,
              order,
              locale: "projectManager",
              label: () => ctx.locale.bind("projectManager")(label),
              inject: () => ({
                controller,
                initialView: view,
                hooks: { projectManager: controller },
              }),
            },
            Page,
          ),
        );
        const Icon = () =>
          React.createElement(
            view === "projects"
              ? P.IconFolderCloseRegular
              : P.IconGlobeOutlineRegular,
            { size: 16 },
          );
        ctx.slots.inject("settings.section.icon", () =>
          ctx.slots.register({ name: "settings.section.icon", id }, Icon),
        );
      }
      ctx.effect(() => {
        const match = globalThis.location?.hash.match(
          /^#dsh-project-manager=(.+)$/,
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
          if (
            !ctx.workspaces.list
              .getSnapshot()
              .items.some((w) => w.workspaceId === id)
          )
            return;
          handled = true;
          history.replaceState(
            history.state,
            "",
            location.pathname + location.search,
          );
          ctx.uiWorkspace.startSession(id);
        };
        const unsubscribe = ctx.workspaces.list.subscribe(open);
        open();
        return unsubscribe;
      }, "project-manager: environment workspace link");
    },
  };
}
