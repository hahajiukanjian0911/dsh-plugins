import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, root } from './build.mjs';
import { inspectHost } from './host-icons.mjs';
import { inspectPopovers } from './host-popovers.mjs';

export const previewFolder = new URL('../../temp/design/polish-popovers/', root);

export async function buildPopoverPreview() {
  await build();
  await mkdir(new URL('assets/', previewFolder), { recursive: true });
  const contract = await inspectPopovers();
  const icons = await inspectHost();
  const { menu: m, material: a, stats: s, models: model } = contract;
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const icon = key => `<svg width="16" height="16" data-icon="dsw-icon-${key}-regular" aria-hidden="true"><use href="#dsw-icon-${key}-regular"/></svg>`;
  const symbols = icons.icons.map(value => value.regular.replace('<svg ', `<symbol id="dsw-icon-${value.key}-regular" `).replace('</svg>', '</symbol>')).join('');
  const item = (label, key, options = {}) => `<button type="button" role="menuitem" class="${m.item}${options.danger ? ' ' + m.danger : ''}"${options.selected ? ' aria-current="page"' : ''}${options.disabled ? ' disabled' : ''}>`
    + `<span class="${m.itemIcon}" aria-hidden="true">${options.image ? `<img alt="" src="${options.image}">` : key ? icon(key) : ''}</span>`
    + `<span class="${m.itemLabel}">${esc(label)}${options.exp ? ' <small>EXP</small>' : ''}</span>`
    + (options.shortcut ? `<span class="${m.shortcut}" aria-hidden="true"><kbd>${esc(options.shortcut)}</kbd></span>` : '')
    + (options.selected ? icon('check-outline') : '') + '</button>';
  const menu = contents => `<div data-menu-material="translucent" role="menu" class="${a.surface} ${m.list}" style="position:relative;inset:auto;--dsh-menu-anchor:--preview-menu"><div class="${a.material}" aria-hidden="true"></div><div class="${m.viewport}" role="presentation">${contents}</div></div>`;
  const panel = (title, total, key, marker, rows) => `<div role="dialog" aria-label="${title}" class="${s.panel}" style="position:relative;inset:auto"><div class="${s.title}"><span class="${s.titleLabel}">${icon(key)}${title}</span><span class="${s.titleValue}">${total}</span></div><div class="${s.titleRule}" aria-hidden="true"></div><dl class="${s.details}" ${marker}>${rows.map(([label, value, route]) => `<dt>${esc(label)}</dt><dd${route ? ` class="${s.route}"` : ''}>${esc(value)}</dd>`).join('')}</dl></div>`;

  const appNames = ['访达', 'VS Code', 'Zed（默认）', 'Xcode', 'Sourcetree', 'Ghostty', 'kitty', '终端'];
  const appPaths = ['/System/Library/CoreServices/Finder.app', '/Applications/Visual Studio Code.app', '/Applications/Zed.app', '/Applications/Xcode.app', '/Applications/Sourcetree.app', '/Applications/Ghostty.app', '/Applications/kitty.app', '/System/Applications/Utilities/Terminal.app'];
  const appImages = [];
  for (let index = 0; index < appPaths.length; index++) {
    const app = appPaths[index];
    let iconFile;
    try {
      iconFile = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIconFile', `${app}/Contents/Info.plist`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    const source = iconFile ? `${app}/Contents/Resources/${iconFile}${iconFile.endsWith('.icns') ? '' : '.icns'}` : '';
    if (source && existsSync(source)) {
      const output = new URL(`assets/app-${index}.png`, previewFolder);
      execFileSync('sips', ['-s', 'format', 'png', '-Z', '32', source, '--out', fileURLToPath(output)], { stdio: 'ignore' });
      appImages.push(`assets/app-${index}.png`);
    } else appImages.push(undefined);
  }

  const surfaces = [
    { id: 'plugins', label: '插件菜单', html: menu(item('浏览更多插件', 'plugin-pinwheel-outline') + item('创建你的插件', 'plus-outline')) },
    { id: 'account', label: '账号菜单', html: menu(item('设置', 'settings-outline', { shortcut: '⌘ ,' }) + item('意见反馈', 'paper-plane-outline') + item('退出登录', 'right-up-outline')) },
    { id: 'apps', label: '打开方式', html: menu(appNames.map((name, index) => item(name, undefined, { image: appImages[index] })).join('')) },
    { id: 'actions', label: '会话菜单', html: menu(item('复制会话为 Markdown', 'copy-outline') + item('下载 Session 日志', 'download-outline') + item('反馈', 'paper-plane-outline')) },
    { id: 'model', label: '模型选择', html: `<div data-menu-material="translucent" role="menu" class="${a.surface} ${model.menu}" style="position:relative;inset:auto;--dsh-menu-anchor:--preview-menu"><div class="${a.material}" aria-hidden="true"></div>${[['模型', 'DeepSeek-V4.1-Flash'], ['推理等级', 'Max']].map(([label, value]) => `<button type="button" role="menuitem" class="${model.cell}"><span class="${model.cellLabel}">${label}</span><span class="${model.cellValue}">${value}</span>${icon('chevron-right-outline')}</button>`).join('')}</div>` },
    { id: 'usage', label: '本轮用量', html: panel('本轮用量', '187,919 tok', 'database-outline', 'data-turn-usage-details', [['提供方 / 模型', 'deepseek-official/deepseek-flash', true], ['缓存命中', '83.6%'], ['未缓存输入', '28,623 tok'], ['缓存读取', '145,664 tok'], ['缓存写入', '0 tok'], ['输出', '13,632 tok']]) },
    { id: 'permissions', label: '访问模式', html: menu(item('仅可查看', 'shield-outline') + item('工作区内修改', 'shield-outline', { selected: true }) + item('完全权限', 'shield-outline') + item('自动审查', 'shield-outline', { exp: true })) },
    { id: 'stats', label: '会话统计', html: panel('会话统计', '1 轮 7 步', 'gauge-outline', 'data-session-stats-details', [['模型用时', '1 分 36 秒'], ['工具调用用时', '14.1 秒'], ['首 token 平均（TTFT）', '0.7 秒'], ['输出速度（TPS）', '149 tok/s']]) },
  ];
  const css = `:root{color-scheme:light;--dsw-alias-bg-base:#fff;--dsw-alias-label-primary:#242830;--dsw-alias-label-secondary:#757a82;--dsw-alias-label-tertiary:#9c9fa5;--dsw-alias-label-caption:#969aa2;--dsw-alias-menu-icon:#6d737c;--dsw-alias-border-l1:#0000000f;--dsw-alias-border-l2:#00000010;--dsw-alias-interactive-bg-hover:#eceef2;--dsw-alias-interactive-bg-hover-danger:#fee9e9;--dsw-alias-state-error-primary:#c33739;--dsw-specific-menu:#fafafbf2;--dsw-menu-surface-fill:#ffffffed;--dsw-menu-backdrop-filter:blur(16px);--dsw-radius-lg:14px;--dsw-radius-md:7px;--dsw-radius-sm:5px;--dsw-elevation-prominent:0 6px 18px #0000000d,0 0 0 .5px #0000000a}body.dark{color-scheme:dark;--dsw-alias-bg-base:#22252a;--dsw-alias-label-primary:#e5e9f0;--dsw-alias-label-secondary:#9ca4b0;--dsw-alias-label-tertiary:#7d8490;--dsw-alias-label-caption:#8d96a3;--dsw-alias-menu-icon:#abb3c0;--dsw-alias-border-l1:#ffffff14;--dsw-alias-border-l2:#ffffff14;--dsw-alias-interactive-bg-hover:#343a45;--dsw-alias-state-error-primary:#ff9c9c;--dsw-alias-interactive-bg-hover-danger:#5c2b32;--dsw-specific-menu:#292d34ed;--dsw-menu-surface-fill:#292d34ed}*{box-sizing:border-box}body{margin:0;background:Canvas;color:CanvasText;font:14px/1.5 system-ui,-apple-system,sans-serif}main{max-width:940px;margin:0 auto;padding:30px 24px 48px}header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:24px}h1{font-size:23px;letter-spacing:-.5px;margin:0;font-weight:600}.controls{display:flex;gap:8px;align-items:center}button{cursor:pointer}header button,nav button{font:inherit;color:inherit;border:0;background:none;border-radius:6px;padding:6px 10px}header button:hover,nav button:hover{background:var(--dsw-alias-interactive-bg-hover)}header button[aria-pressed=true],nav button[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover)}nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:18px}nav button{font-size:13px}.stage{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-height:440px;display:grid;place-items:center;padding:34px 20px;background:var(--dsw-alias-bg-base)}#seat{max-width:100%;font-family:"Times New Roman","Songti SC",serif}#seat button{font-family:inherit}small{font-size:10px;color:var(--dsw-alias-label-secondary)}svg,img{vertical-align:middle;flex-shrink:0}button:focus-visible{outline:2px solid #4672d9;outline-offset:-2px}::selection{background:var(--dsw-alias-interactive-bg-hover)}@media(max-width:500px){main{padding:20px 12px}header{align-items:flex-start;flex-wrap:wrap}.stage{padding:24px 12px;min-height:400px}}`;
  const client = await readFile(new URL('client.js', root), 'utf8');
  const popoverCss = await readFile(new URL('src/popovers.css', root), 'utf8');
  const styleLiteral = client.match(/const stylesheet = ("(?:[^"\\]|\\.)*");/)[1];
  const allStyles = JSON.parse(styleLiteral);
  if (!allStyles.endsWith(popoverCss)) throw new Error('样式拼接顺序变化，停止构建改前对照');
  const baselineClient = client.replace(styleLiteral, () => JSON.stringify(allStyles.slice(0, -popoverCss.length)));
  const script = `let disposers=[];const plugins={};let target='before';window.__ModuleLoader__={load(module){plugins[target]=module.factory()}};${baselineClient};target='after';${client}\nconst surfaces=${JSON.stringify(surfaces).replaceAll('<', '\\u003c')};const seat=document.getElementById('seat');window.chooseSurface=id=>{const surface=surfaces.find(value=>value.id===id)||surfaces[0];seat.innerHTML=surface.html;document.body.dataset.surface=surface.id;for(const button of document.querySelectorAll('nav button')){if(button.dataset.surface===surface.id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}};window.setPolish=enabled=>{disposers.splice(0).reverse().forEach(fn=>fn());plugins[enabled?'after':'before'].apply({effect(fn){disposers.push(fn())}});document.getElementById('refined').setAttribute('aria-pressed',String(enabled));document.getElementById('original').setAttribute('aria-pressed',String(!enabled))};for(const button of document.querySelectorAll('nav button'))button.onclick=()=>chooseSurface(button.dataset.surface);document.getElementById('original').onclick=()=>setPolish(false);document.getElementById('refined').onclick=()=>setPolish(true);document.getElementById('theme').onclick=()=>document.body.classList.toggle('dark');chooseSurface(new URLSearchParams(location.search).get('surface'));setPolish(true);`;
  const html = `<!doctype html><html lang="zh-CN" data-platform="darwin"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH Polish · 菜单与面板</title><style>${css}${contract.css}</style><body><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg><main><header><h1>菜单与面板</h1><div class="controls"><button id="original" aria-pressed="false">改前</button><button id="refined" aria-pressed="true">统一样式</button><button id="theme" aria-label="切换深浅色">${icon('dark-outline')}</button></div></header><nav aria-label="预览场景">${surfaces.map(surface => `<button data-surface="${surface.id}">${surface.label}</button>`).join('')}</nav><section class="stage"><div id="seat"></div></section></main><div data-menu-backing="" class="${a.backing}" style="--dsh-menu-anchor:--preview-menu" aria-hidden="true"></div><script>${script}</script></body></html>`;
  await writeFile(new URL('index.html', previewFolder), html);
  const { css: omitted, ...identity } = contract;
  await writeFile(new URL('host-contract.json', previewFolder), JSON.stringify({ ...identity, source: '本机安装包，只读提取 CSS 与类名；预览内容为用户截图中的示例值', appIcons: appImages.map((image, index) => ({ name: appNames[index], source: appPaths[index], available: !!image })) }, null, 2) + '\n');
  console.log(JSON.stringify({ preview: fileURLToPath(new URL('index.html', previewFolder)), scenes: surfaces.length, appIcons: appImages.filter(Boolean).length }));
  return { contract, surfaces };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPopoverPreview();
