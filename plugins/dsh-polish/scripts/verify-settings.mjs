import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { buildSettingsPreview, settingsPreview } from './build-settings-preview.mjs';

const root = new URL('../', import.meta.url), repo = new URL('../../../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const output = new URL('outputs/dsh-polish-' + version + '/', repo);
await mkdir(output, { recursive: true });
const reference = await buildSettingsPreview();
const checks = [], errors = [], layouts = [], contrasts = [];
const client = await readFile(new URL('client.js', root), 'utf8');
const baseline = execFileSync('tar', ['-xOf', new URL('releases/dsh-polish-0.1.9.tgz', repo).pathname, 'package/client.js'], { encoding: 'utf8', maxBuffer: 2e6 });
const style = /const stylesheet = ("(?:[^"\\]|\\.)*");/;
assert.equal(client.replace(style, 'const stylesheet = "";'), baseline.replace(style, 'const stylesheet = "";'));
const beforeSettings = await readFile(new URL('outputs/dsh-polish-0.1.10/before/src-settings.css', repo), 'utf8');
const afterSettings = await readFile(new URL('src/settings.css', root), 'utf8');
const beforeType = await readFile(new URL('outputs/dsh-polish-0.1.12/before/src-typography.css', repo), 'utf8');
const afterType = await readFile(new URL('src/typography.css', root), 'utf8');
const materials = await readFile(new URL('src/materials.css', root), 'utf8');
assert.equal(JSON.parse(client.match(style)[1]), JSON.parse(baseline.match(style)[1]).replace(beforeSettings, () => afterSettings).replace(beforeType, () => afterType) + materials);
checks.push('与 0.1.9 比较，只变更设置、排版及浮层材质 CSS，业务逻辑和服务调用保留');

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  const open = async query => {
    await page.goto(settingsPreview.href + (query ? '?' + query : ''));
    await page.locator('[data-shortcut-modal="settings"]').waitFor();
  };
  const settled = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const capture = async name => { await settled(); await page.screenshot({ path: new URL(name, output).pathname, animations: 'disabled' }); };
  const content = () => page.locator('._77Pn0W_options').evaluate(node => ({
    text: node.textContent,
    controls: [...node.querySelectorAll('input,select,button')].map(n => ({ tag: n.tagName, role: n.getAttribute('role'), name: n.getAttribute('aria-label'), value: n.value,
      pressed: n.getAttribute('aria-pressed'), checked: n.getAttribute('aria-checked'), disabled: n.disabled })),
  }));
  await open('polish=before');
  const previous = await content();
  await capture('settings-before.png');
  await page.evaluate(() => window.setSettingsPolish('after'));
  assert.deepEqual(await content(), previous);
  await capture('settings-light.png');
  for (const section of ['account', 'models', 'plugins', 'dsh-session-sidebar']) {
    await page.evaluate(id => window.settingsDemo.select(id), section); await settled();
    await page.evaluate(() => window.setSettingsPolish('before'));
    const original = await content();
    await page.evaluate(() => window.setSettingsPolish('after'));
    assert.deepEqual(await content(), original);
  }
  checks.push('通用、账号、模型、内置插件、会话侧边栏五个实际组件，文字、控件值、角色和禁用状态不变');

  await page.evaluate(() => window.settingsDemo.select('general')); await settled();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '深色', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '跟随系统', exact: true }).click();
  const language = page.getByRole('button', { name: '中文', exact: true });
  await language.click();
  await page.getByRole('menuitem', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).waitFor();
  await page.locator('.KaH-Nq_expander').click();
  const textInput = page.getByRole('textbox', { name: '正文字体', exact: true });
  await textInput.fill('Georgia'); await textInput.press('Enter');
  assert.equal(await page.evaluate(() => window.settingsDemo.fonts.fontFamilies.text), '"Georgia"');
  // Use the actual host label rather than a fixture label.
  const arrow = page.locator('.KaH-Nq_arrow').first();
  await arrow.click();
  assert.equal(await page.evaluate(() => window.settingsDemo.fonts.fontSizes.text), 17);
  checks.push('真实主题选择、语言菜单、字体展开、字体输入提交及字号加减仍可操作（写入隔离状态）');

  await page.evaluate(() => window.settingsDemo.select('dsh-session-sidebar')); await settled();
  const toggle = page.getByRole('switch', { name: '会话详情提示', exact: true });
  await toggle.click(); assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  await page.getByRole('button', { name: '重置侧栏偏好', exact: true }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await capture('settings-sidebar.png');
  checks.push('侧栏开关和重置仍沿用原生控件及原回调');

  await page.evaluate(() => window.settingsDemo.select('models')); await settled();
  await page.evaluate(() => window.settingsDemo.setModelState('error')); await settled();
  assert.ok((await page.locator('._77Pn0W_options').innerText()).includes('预览连接失败'));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '重试', exact: true }).count(), 0);
  checks.push('模型页的失败信息和重试路径保留');

  // Match both the host's form breakpoint (767px) and the modal breakpoints.
  for (const width of [1440, 1024, 900, 768, 767, 728, 640, 639, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open('section=general'); await page.locator('.KaH-Nq_expander').click(); await settled();
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector('[data-shortcut-modal="settings"]'), options = dialog.querySelector('._77Pn0W_options');
      const fields = [...dialog.querySelectorAll('.rQMTkq_field')].map(n => n.getBoundingClientRect());
      const cubes = [...dialog.querySelectorAll('.RrNL-q_themeCube')].map(n => n.getBoundingClientRect());
      return { width: innerWidth, dialog: dialog.getBoundingClientRect().toJSON(), bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        contentOverflow: options.scrollWidth > options.clientWidth + 1, inputHeights: fields.map(n => n.height), cubeWidths: cubes.map(n => n.width), cubeTop: cubes.map(n => n.top),
        navOverflow: dialog.querySelector('._77Pn0W_navList').scrollWidth > dialog.querySelector('._77Pn0W_navList').clientWidth,
        contentMeasure: dialog.querySelector('.YSv5hq_section').getBoundingClientRect().width };
    });
    assert.equal(layout.bodyOverflow, false); assert.equal(layout.contentOverflow, false);
    assert.ok(layout.dialog.x >= -1 && layout.dialog.x + layout.dialog.width <= width + 1);
    assert.ok(layout.inputHeights.every(height => height >= 30 && height <= 40), JSON.stringify(layout));
    assert.ok(Math.max(...layout.cubeWidths) - Math.min(...layout.cubeWidths) <= 1);
    assert.equal(new Set(layout.cubeTop).size, 1);
    assert.ok(layout.contentMeasure <= 761, JSON.stringify(layout));
    layouts.push(layout);
    if (width === 728) await capture('settings-medium.png');
    if (width === 390) await capture('settings-narrow.png');
  }
  checks.push('1440/1024/900/768/767/728/640/639/390px 九种宽度无横向溢出；字体输入高度正常、主题按钮等宽且同排');

  await page.setViewportSize({ width: 1240, height: 900 });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme }); await open();
    await page.locator('.KaH-Nq_expander').click(); await settled();
    // Resolve theme colors in the browser, including color-mix and transparent ancestors.
    const values = await page.evaluate(() => {
      function rgb(css) { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; }
      function over(fg,bg) { const alpha=fg[3]/255; return [...fg.slice(0,3).map((v,i)=>v*alpha+bg[i]*(1-alpha)),255]; }
      function background(node) {
        const ancestors=[]; for(let n=node;n;n=n.parentElement) ancestors.unshift(n);
        let value=[255,255,255,255];
        for(const n of ancestors) {
          value=over(rgb(getComputedStyle(n).backgroundColor),value);
          // The native mask is a sibling behind the panel. Transparent glass is
          // painted by its ::before, so neither layer may be skipped here.
          if(n.classList.contains('_77Pn0W_overlay')) { const mask=n.querySelector(':scope > ._77Pn0W_mask'); if(mask)value=over(rgb(getComputedStyle(mask).backgroundColor),value); }
          const pseudo=getComputedStyle(n,'::before');
          if(pseudo.content!=='none'&&pseudo.content!=='normal') value=over(rgb(pseudo.backgroundColor),value);
        }
        return value;
      }
      const luminance = rgb => rgb.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
      return ['.RrNL-q_themeCube[aria-pressed="true"]', '.KaH-Nq_desc', '.xdKASq_description', '._77Pn0W_navCell', 'input'].map(selector => {
        const node = document.querySelector(selector), foreground = rgb(getComputedStyle(node, selector === 'input' ? '::placeholder' : null).color);
        const a = luminance(foreground), b = luminance(background(node));
        return { selector, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
      });
    });
    values.forEach(value => assert.ok(value.contrast >= 4.5, colorScheme + ': ' + JSON.stringify(value)));
    contrasts.push({ colorScheme, values });
    await capture(colorScheme === 'light' ? 'settings-fonts-light.png' : 'settings-dark.png');
  }
  checks.push('深浅色下导航、选中主题文字、字体说明、工作视图说明及输入占位文字对比度均 ≥4.5:1');

  await page.emulateMedia({ colorScheme: 'light' }); await open();
  await page.getByRole('button', { name: '模型', exact: true }).focus();
  assert.equal(await page.getByRole('button', { name: '模型', exact: true }).evaluate(n => getComputedStyle(n).outlineStyle), 'solid');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('[data-shortcut-modal="settings"]')), true);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-shortcut-modal="settings"]').count(), 0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  assert.equal(await page.locator('[data-shortcut-modal="settings"]').count(), 0);
  checks.push('键盘焦点可见且限制在原生弹窗内；Escape 和关闭按钮可关闭');

  await open('lang=en'); await page.locator('.KaH-Nq_expander').click(); await settled();
  assert.equal(await page.locator('._77Pn0W_options').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
  await page.setViewportSize({ width: 620, height: 450 }); await settled();
  const options = page.locator('._77Pn0W_options');
  await options.evaluate(n => n.scrollTop = n.scrollHeight);
  assert.ok(await options.evaluate(n => n.scrollTop > 0));
  await page.getByRole('button', { name: 'Close', exact: true }).waitFor({ state: 'visible' });
  checks.push('英文内容与约 200% 缩放等效视口可阅读，长表单可独立滚动且关闭入口保持可见');

  await page.setViewportSize({ width: 1240, height: 900 }); await open('polish=before');
  const geometry = () => page.locator('[data-shortcut-modal="settings"]').evaluate(n => ({ nav: n.querySelector('nav').getBoundingClientRect().width, bg: getComputedStyle(n.querySelector('nav')).backgroundColor }));
  const initial = await geometry();
  await page.evaluate(() => window.setSettingsPolish('after'));
  assert.notDeepEqual(await geometry(), initial);
  await page.evaluate(() => window.setSettingsPolish('before'));
  assert.deepEqual(await geometry(), initial);
  await page.evaluate(() => window.setSettingsPolish('none'));
  assert.equal(await page.locator('[data-dsh-polish]').count(), 0);
  assert.equal(await page.getByRole('dialog', { name: '设置', exact: true }).count(), 1);
  checks.push('停用撤销所有美化样式，设置组件继续存在；切回 0.1.9 时原有布局还原');
  assert.deepEqual(errors, []);
  const report = { version, passed: checks.length, checks, layouts, contrasts, errors, ...reference,
    scope: '后台 Chrome；本机 DSH 0.2.2-rc.1 的真实 SettingsPanel、主题/语言/账号/模型/插件组件、React、primitives 和主题 CSS。数据、插槽组合和保存回调为隔离替身；未操作用户窗口或真实设置。' };
  await writeFile(new URL('settings-check.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} finally { await browser.close(); }
