import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const plugin = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  outputs = plugin + "/outputs",
  url = pathToFileURL(
    resolve(plugin, "../../temp/design/project-manager/index.html"),
  ).href;
await mkdir(outputs, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const checks = [],
  errors = [],
  context = await browser.newContext({
    viewport: { width: 1240, height: 1000 },
  }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, fn) => async () => {
  await fn();
  checks.push(name);
};
try {
  await page.goto(url);
  await page.getByRole("button", { name: /dsh-plugins/ }).waitFor();
  await check("native list and shared-repository grouping", async () => {
    assert.equal(await page.locator(".dpm-project-row").count(), 4);
    assert.match(
      await page
        .locator(".dpm-project-row")
        .filter({ hasText: "dsh-plugins" })
        .innerText(),
      /2 个检出目录/,
    );
  })();
  await page.screenshot({ path: outputs + "/projects-light.png" });
  await check("search and empty state", async () => {
    await page.getByRole("textbox", { name: "搜索项目" }).fill("unmatched");
    await page.getByText("没有匹配的项目").waitFor();
    await page.getByRole("textbox", { name: "搜索项目" }).fill("");
  })();
  await page.getByRole("button", { name: /dsh-plugins/ }).click();
  await page.getByRole("heading", { name: "检出目录", exact: true }).waitFor();
  await check("rename preserves both checkout registrations", async () => {
    await page
      .getByRole("textbox", { name: "项目名称", exact: true })
      .fill("DSH 项目");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .getByRole("heading", { name: "DSH 项目", exact: true })
      .waitFor();
    assert.equal(await page.locator(".dpm-checkout").count(), 2);
  })();
  await check("native icon picker and custom glyph/color", async () => {
    await page.getByRole("button", { name: "选择图标", exact: true }).click();
    const d = page.getByRole("dialog", { name: "项目图标" });
    await d.getByRole("button", { name: "图标", exact: true }).click();
    await d.getByRole("button", { name: "数据", exact: true }).click();
    await d.getByRole("button", { name: "颜色 #14b8a6" }).click();
    await d.getByRole("button", { name: "保存", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () =>
          window.projectDemo.metadata.projects[
            "git:github.com/example/dsh-plugins"
          ].icon.value,
      ),
      "database",
    );
  })();
  await page.screenshot({ path: outputs + "/project-detail-light.png" });
  const menu = () => page.getByRole("menu");
  await check("checkout menu starts a native local session", async () => {
    await page
      .getByRole("button", {
        name: "目录操作 /Users/example/Development/tools/dsh-plugins",
        exact: true,
      })
      .click();
    await page.getByRole("menuitem", { name: "新会话", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.projectDemo.sessions), [
      "plugins",
      "close-settings",
    ]);
  })();
  await check(
    "open-directory action routes the selected checkout",
    async () => {
      await page
        .getByRole("button", {
          name: "目录操作 /Users/example/Development/tools/dsh-plugins",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", { name: "打开目录", exact: true })
        .click();
      await page.waitForFunction(() =>
        window.projectDemo.calls.some((c) => c.request?.op === "open"),
      );
    },
  )();
  await check("environment scope filters checkouts", async () => {
    await page.getByRole("button", { name: "环境范围", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "开发服务器", exact: true })
      .click();
    assert.equal(await page.locator(".dpm-checkout").count(), 1);
  })();
  await check("custom actions persist for a selected environment", async () => {
    await page.getByRole("button", { name: "添加操作", exact: true }).click();
    const d = page.getByRole("dialog", { name: "添加操作" });
    await d.getByRole("textbox", { name: "操作名称" }).fill("构建项目");
    await d.getByRole("textbox", { name: "操作命令" }).fill("npm run build");
    await d.getByRole("button", { name: "保存", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "运行 构建项目", exact: true })
      .waitFor();
  })();
  await check("run, output, stop and recent-run state", async () => {
    await page
      .getByRole("button", { name: "运行 构建项目", exact: true })
      .click();
    const d = page.getByRole("dialog", { name: "构建项目", exact: true });
    await d.getByText(/此页面未运行命令/).waitFor();
    await d.getByRole("button", { name: "停止", exact: true }).click();
    await d.getByText("已停止", { exact: true }).waitFor();
    await d.getByRole("button", { name: "关闭", exact: true }).last().click();
    await d.waitFor({ state: "hidden" });
  })();
  await check("mixed environment actions are explicit", async () => {
    await page.getByRole("button", { name: "环境范围", exact: true }).click();
    await page.getByRole("menuitem", { name: "全部环境", exact: true }).click();
    await page
      .getByText("各环境的操作不同，请选择环境后编辑或运行。")
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "添加操作", exact: true })
        .isDisabled(),
      true,
    );
  })();
  await page.getByRole("button", { name: "环境范围", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "MacBook Air", exact: true })
    .click();
  await check(
    "add checkout uses the native directory picker result",
    async () => {
      await page.getByRole("button", { name: "添加目录", exact: true }).click();
      const d = page.getByRole("dialog", { name: "添加检出目录" });
      await d.getByRole("button", { name: "选择目录", exact: true }).click();
      assert.equal(
        await d.getByRole("textbox", { name: "目录路径" }).inputValue(),
        "/Users/example/Development/new-project",
      );
      await d.getByRole("button", { name: "保存", exact: true }).click();
      await d.waitFor({ state: "hidden" });
    },
  )();
  await check(
    "remove checkout confirmation and cancel preserve rows",
    async () => {
      const before = await page.locator(".dpm-checkout").count();
      await page
        .getByRole("button", {
          name: "目录操作 /Users/example/Development/tools/dsh-plugins",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", { name: "移除检出目录", exact: true })
        .click();
      const d = page.getByRole("dialog", { name: "移除检出目录", exact: true });
      await d.getByText(/目录与会话都会保留/).waitFor();
      await d.getByRole("button", { name: "取消", exact: true }).click();
      assert.equal(await page.locator(".dpm-checkout").count(), before);
    },
  )();
  await check(
    "t3.json import previews and skips repeated actions",
    async () => {
      await page
        .getByRole("button", { name: "导入 t3.json", exact: true })
        .click();
      const d = page.getByRole("dialog", { name: "导入项目操作" });
      await d.getByText("仅导入命令，导入后不运行。").waitFor();
      await d
        .getByRole("button", { name: "导入 1 个操作", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "运行 测试", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "导入 t3.json", exact: true })
        .click();
      await d.getByText("没有可导入的新操作。").waitFor();
      assert.equal(
        await d
          .getByRole("button", { name: "导入 0 个操作", exact: true })
          .isDisabled(),
        true,
      );
      await d.getByRole("button", { name: "取消", exact: true }).click();
    },
  )();
  await check("background refresh preserves an edited project name", async () => {
    const input=page.getByRole("textbox",{name:"项目名称",exact:true});await input.fill("尚未保存的草稿");
    await page.evaluate(async()=>{window.projectDemo.environments[0].workspaces.find(w=>w.id==="plugins").title="其他窗口的名称";window.projectDemo.metadata.revision++;await window.projectDemo.controller.load();});
    await page.getByRole("heading",{name:"其他窗口的名称",exact:true}).waitFor();assert.equal(await input.inputValue(),"尚未保存的草稿");
  })();
  await page.goto(url);await page.getByRole("button",{name:/dsh-plugins/}).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator(".dpm").evaluate((el) => (el.parentElement.scrollTop = 0));
  await page.screenshot({ path: outputs + "/project-detail-dark.png" });
  await page.getByRole("button", { name: "选择图标", exact: true }).click();
  await page.getByRole("dialog", { name: "项目图标" }).waitFor();
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector('[aria-label="项目图标"][role=dialog]'),
      ).opacity === "1",
  );
  await check(
    "settled icon dialog is above the native settings panel",
    async () => {
      assert.equal(
        await page.getByRole("dialog", { name: "项目图标" }).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
        true,
      );
    },
  )();
  await page.screenshot({ path: outputs + "/icon-dialog-dark.png" });
  await page
    .getByRole("dialog", { name: "项目图标" })
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await page.setViewportSize({ width: 460, height: 960 });
  await page.evaluate(() =>
    document.documentElement.removeAttribute("data-platform"),
  );
  await page.locator(".dpm").evaluate((el) => (el.parentElement.scrollTop = 0));
  await page.screenshot({ path: outputs + "/project-detail-narrow.png" });
  await check("narrow layout has no horizontal document overflow", async () => {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  })();
  await page.setViewportSize({ width: 1240, height: 900 });
  await page.goto(url + "?page=environments&offline");
  await page.getByText("离线", { exact: true }).waitFor();
  await page.screenshot({ path: outputs + "/environments-dark.png" });
  await check("offline environment remains visible", async () => {
    assert.equal(await page.locator(".dpm-environment").count(), 2);
  })();
  await check(
    "connection failure stays inside the native form and preserves input",
    async () => {
      await page.getByRole("button", { name: "连接环境", exact: true }).click();
      const d = page.getByRole("dialog", { name: "连接环境", exact: true });
      await d.getByRole("textbox", { name: "环境名称" }).fill("示例");
      await d
        .locator("input[type=password]")
        .fill("https://dev.example.test/?token=fixture");
      await d.getByRole("button", { name: "连接", exact: true }).click();
      await d
        .getByRole("alert")
        .filter({ hasText: "示例页面不连接实际环境。" })
        .waitFor();
      assert.equal(
        await d.locator("input[type=password]").inputValue(),
        "https://dev.example.test/?token=fixture",
      );
      await d.getByRole("button", { name: "取消", exact: true }).click();
    },
  )();
  assert.deepEqual(errors, []);
  await writeFile(
    outputs + "/ui-checks.json",
    JSON.stringify(
      {
        checksPassed: checks.length,
        checks,
        errors,
        scope:
          "Offline shipped client + installed DSH React/primitives/themes. Fixture RPC only. No native application interaction.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checksPassed: checks.length, errors }));
} catch (error) {
  await page.screenshot({ path: outputs + "/ui-failure.png" });
  console.error("Completed checks:", checks);
  console.error((await page.locator("body").innerText()).slice(-3000));
  throw error;
} finally {
  await browser.close();
}
