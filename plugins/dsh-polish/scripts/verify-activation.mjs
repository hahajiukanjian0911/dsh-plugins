import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { withInstalledHost } from '../../../scripts/installed-host.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const assets = resolve(repo, 'temp/design/polish-composer-native/assets');
const out = resolve(repo, 'outputs/dsh-polish-' + version);
await mkdir(out, { recursive: true });
await mkdir(resolve(repo, 'temp'), { recursive: true });
const scratch = await mkdtemp(resolve(repo, 'temp/polish-activation-'));
const report = {
  scope: 'Built client activated through installed Cordis Context.plugin, unmodified SlotRegistry and LocaleRuntime in isolated headless Chrome. Service providers and slot declarations have controlled lifetimes. No native app launch or real user preference access.',
  checks: [], errors: [],
};
let browser;
try {
  const sources = await withInstalledHost(async host => {
    const base = 'dsh/node_modules/@deepseek-ai/';
    const frontendRoot = base + 'dsh-web-frontend/dist/assets/';
    const frontendName = host.list(frontendRoot).find(name => /^index-.*\.js$/.test(name));
    return {
      frontend: await host.read(frontendRoot + frontendName),
      renderer: await host.read(base + 'dsh-client-ui-renderer/lib/client.js'),
      locale: await host.read(base + 'dsh-client-locale/lib/client.js'),
    };
  });
  const nativeSource = JSON.parse(await readFile(resolve(assets, 'native-source.json'), 'utf8'));
  assert.equal(createHash('sha256').update(sources.frontend).digest('hex'), nativeSource.frontendSha256,
    'Rebuild the composer fixture from the current installed host before checking activation.');
  report.hostFrontendSha256 = nativeSource.frontendSha256;
  const baseline = execFileSync('tar', ['-xOf', resolve(repo, 'releases/dsh-polish-0.1.41.tgz'), 'package/client.js'],
    { encoding: 'utf8', maxBuffer: 2e6 });
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  report.clientSha256 = createHash('sha256').update(client).digest('hex');
  await writeFile(resolve(scratch, 'index.html'), '<!doctype html><html lang="zh-CN" data-platform="darwin"><head><meta charset="utf-8"></head><body></body></html>');
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('file://' + resolve(scratch, 'index.html'));
  await page.addScriptTag({ path: resolve(assets, 'native-runtime.js') });
  await page.evaluate(() => {
    window.activationModules = {};
    window.__ModuleLoader__ = { load(entry) {
      window.activationModules[entry.id] = entry.factory(id => {
        const module = window.__DSH_NATIVE_MODULES__[id];
        if (!module) throw new Error('Missing installed module ' + id);
        return module;
      });
    } };
  });
  await page.addScriptTag({ content: sources.renderer });
  await page.addScriptTag({ content: sources.locale });
  await page.evaluate(() => {
    window.__ModuleLoader__ = { load(entry) { window.activationBaseline = entry.factory; } };
  });
  await page.addScriptTag({ content: baseline });
  await page.evaluate(() => {
    window.__ModuleLoader__ = { load(entry) { window.activationCandidate = entry.factory; } };
  });
  await page.addScriptTag({ content: client });

  const result = await page.evaluate(async () => {
    const M = window.__DSH_NATIVE_MODULES__;
    const { Context } = M['@deepseek-ai/cordis'];
    const { SlotRegistry } = window.activationModules['@deepseek-ai/dsh-client-ui-renderer'];
    const { LocaleRuntime } = window.activationModules['@deepseek-ai/dsh-client-locale'];
    const checks = [], errors = [], key = 'dsh.conversation.contentWidth';
    const expect = (condition, message) => { if (!condition) throw new Error(message); };
    const dictionaryCount = locale => locale.dicts.get('polishWidth')?.size ?? 0;
    const settle = () => new Promise(resolve => setTimeout(resolve, 20));
    localStorage.setItem(key, '800');

    function composition() {
      const root = new Context();
      root.on('internal/error', error => errors.push(error?.message ?? String(error)));
      let slots, locale, slotProvider, localeProvider, declaration, plugin;
      return {
        get slots() { return slots; }, get locale() { return locale; },
        async provideSlots() {
          slotProvider = await root.plugin({ name: 'activation.slots', apply(scope) { slots = new SlotRegistry(scope); } });
          await settle();
        },
        async provideLocale() {
          localeProvider = await root.plugin({ name: 'activation.locale', apply(scope) {
            locale = new LocaleRuntime(scope);
            scope.provide('locale', locale);
          } });
          await settle();
        },
        async declare() {
          declaration = await root.plugin({ name: 'activation.declarations', inject: ['slots'], apply(scope) {
            scope.slots.register({ name: 'root', children: {
              'shell.overlay': { kind: 'list', scope: 'root' },
              'conversation.input.left': { kind: 'list', scope: 'root' },
              'conversation.hero.options': { kind: 'list', scope: 'session' },
              'settings.general.item': { kind: 'list', scope: 'root' },
            } }, () => null);
          } });
          await settle();
        },
        async activate(factory = window.activationCandidate) {
          plugin = await root.plugin({ ...factory(id => M[id]), name: 'activation.polish' });
          await settle();
        },
        async disable() { await plugin?.dispose(); plugin = undefined; await settle(); },
        async removeLocale() { await localeProvider.dispose(); localeProvider = undefined; await settle(); },
        async collapse() { await declaration.dispose(); declaration = undefined; await settle(); },
        widthCount() { return slots.entries('settings.general.item').filter(entry => entry.options.id === 'polish.page-width').length; },
        async dispose() {
          await this.disable();
          await declaration?.dispose();
          await localeProvider?.dispose();
          await slotProvider?.dispose();
          await settle();
        },
      };
    }

    const broken = composition();
    await broken.provideSlots(); await broken.provideLocale(); await broken.declare();
    let failure;
    try { await broken.activate(window.activationBaseline); } catch (error) { failure = error.message; }
    expect(/^cannot get property "(?:slots|locale)" without inject$/.test(failure ?? ''), 'Released 0.1.41 must fail the real service-access guard. Received ' + failure);
    await broken.dispose();
    checks.push('0.1.41 在真实 Cordis 中复现未声明服务的启动错误');

    const ready = composition();
    await ready.provideSlots(); await ready.provideLocale(); await ready.declare(); await ready.activate();
    expect(ready.widthCount() === 1, 'Ready services must register exactly one width row.');
    ready.locale.setLocale('en');
    expect(ready.locale.bind('polishWidth')('title') === 'Page width', 'The real locale registry must resolve the registered dictionary.');
    ready.locale.setLocale('zh');
    expect(ready.locale.bind('polishWidth')('title') === '页面宽度', 'The real locale registry must resolve the Chinese dictionary.');
    checks.push('服务已就绪时，完整客户端激活成功，设置条目及真实字典正确注册');
    await ready.collapse();
    expect(ready.widthCount() === 0, 'Collapsing the declaration must release the width row.');
    await ready.declare();
    expect(ready.widthCount() === 1, 'A later declaration must reinstall one width row.');
    checks.push('设置插槽折叠及重新声明后，条目随声明生命周期清理并恢复');
    const previousLocale = ready.locale;
    await ready.removeLocale();
    expect(ready.widthCount() === 0 && dictionaryCount(previousLocale) === 0, 'Locale removal must release the dependent row and dictionaries.');
    await ready.provideLocale();
    expect(ready.widthCount() === 1 && dictionaryCount(ready.locale) === 2, 'A replacement locale provider must reactivate the width settings.');
    checks.push('locale 服务卸载及重新提供后，依赖作用域正确清理并恢复');
    for (let cycle = 0; cycle < 5; cycle++) {
      await ready.disable();
      expect(ready.widthCount() === 0 && dictionaryCount(ready.locale) === 0, 'Plugin unload must clear the row and dictionary.');
      expect(document.querySelectorAll('[data-dsh-polish]').length === 0, 'Plugin unload must remove its stylesheet.');
      await ready.activate();
      expect(ready.widthCount() === 1 && dictionaryCount(ready.locale) === 2, 'Reactivation must register each contribution once.');
      expect(document.querySelectorAll('[data-dsh-polish]').length === 1, 'Reactivation must keep one stylesheet.');
    }
    await ready.dispose();
    checks.push('连续五次启停后，条目、字典及样式均无重复或残留');

    for (const delayed of ['locale', 'slots', 'declaration']) {
      const test = composition();
      if (delayed !== 'slots') await test.provideSlots();
      if (delayed !== 'locale') await test.provideLocale();
      if (delayed !== 'declaration') await test.declare();
      await test.activate();
      if (delayed === 'locale') await test.provideLocale();
      if (delayed === 'slots') await test.provideSlots();
      if (delayed === 'declaration') await test.declare();
      expect(test.widthCount() === 1, 'Late ' + delayed + ' must activate exactly one width row.');
      await test.dispose();
      checks.push(delayed + ' 延迟就绪时，客户端先激活并在依赖到达后注册设置');
    }
    expect(localStorage.getItem(key) === '800', 'Activation must preserve the existing native width preference.');
    expect(errors.length === 0, 'Cordis must not report asynchronous activation errors.');
    return { checks, errors, baselineError: failure, storedWidth: localStorage.getItem(key) };
  });
  const browserErrors = report.errors;
  Object.assign(report, result);
  report.errors = [...browserErrors, ...result.errors];
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
  await writeFile(resolve(out, 'activation-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
