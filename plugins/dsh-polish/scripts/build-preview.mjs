import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build, iconSvg, manifest, root } from './build.mjs';
import { inspectHost } from './host-icons.mjs';

await build();
const host = await inspectHost();
assert.deepEqual([...Object.keys(manifest.native), ...Object.keys(manifest.preserved)].sort(), host.icons.map(icon => icon.key).sort(), '宿主图标覆盖不完整');
const folder = new URL('../../temp/design/polish-icons/', root);
await mkdir(folder, { recursive: true });
await writeFile(new URL('host-icons.json', folder), JSON.stringify(host, null, 2) + '\n');
const definitions = host.icons.flatMap(icon => ['regular', 'medium'].map(weight =>
  icon[weight].replace('<svg ', `<symbol id="dsw-icon-${icon.key}-${weight}" `).replace('</svg>', '</symbol>'))).join('');
const native = (key, label, size = 18, extra = '') => `<svg ${extra} width="${size}" height="${size}" data-icon="dsw-icon-${key}-regular" aria-hidden="true"><use href="#dsw-icon-${key}-regular"/></svg>`;
const button = (key, label, extra = '') => `<button type="button" class="icon-button dsi-icon-button" aria-label="${label}" title="${label}" ${extra}>${native(key, label)}</button>`;
const favorite = ['new-chat-outline', 'panel-left-outline', 'settings-outline', 'plugin-pinwheel-outline', 'skill-outline', 'think-outline', 'agent-preset-outline', 'clock-outline', 'project-add-outline', 'personalization-outline', 'archive-outline', 'search-outline', 'user-outline', 'gauge-outline', 'paperclip-outline', 'send-outline'];
const rows = [];
for (const icon of host.icons) {
  const replacement = manifest.native[icon.key];
  const label = replacement?.[1] ?? manifest.preserved[icon.key];
  let refined;
  let enlarged;
  if (replacement) {
    const [name, , variant] = replacement;
    const svg = await iconSvg(name, manifest.stroke.regular, variant);
    const mask = `data:image/svg+xml,${encodeURIComponent(svg).replaceAll("'", '%27')}`;
    refined = `<span class="new-icon" style="--mask:url('${mask}')"></span>`;
    enlarged = refined;
  } else {
    refined = native(icon.key, label, 16);
    enlarged = native(icon.key, label, 24);
  }
  rows.push(`<tr data-key="${icon.key}"><th scope="row">${label}${replacement ? '' : ' · 原版'}</th><td><span class="old-icon">${native(icon.key, label, 16).replace('data-icon=', 'data-original=')}</span></td><td>${refined}</td><td class="enlarged">${enlarged}</td></tr>`);
}
const client = await readFile(new URL('client.js', root), 'utf8');
const body = `<header><h1>DSH Polish</h1><div class="controls"><div class="segmented" role="group" aria-label="图标外观"><button id="original" aria-pressed="false">原版</button><button id="polished" aria-pressed="true">圆角细线</button></div><button id="theme" class="theme-button" aria-label="切换深浅色">${native('dark-outline', '切换深浅色', 18)}</button></div></header>
<section class="sample dsi-root" aria-label="图标场景预览"><aside data-slot="sidebar"><div class="sidebar-heading"><strong>DeepSeek</strong>${button('panel-left-outline', '折叠侧栏')}</div><button class="new-session">${native('new-chat-outline', '新建会话')}新建会话</button><div class="sidebar-links"><button>${native('folder-close', '项目')}我的项目</button><button>${native('archive-outline', '归档')}已收起</button></div><nav class="sidebar-footer" aria-label="全局面板">${button('user-outline', '账号')}${button('plugin-pinwheel-outline', '插件')}${button('alarm-clock-outline', '自动化任务')}${button('apps-add-outline', '更多', 'aria-haspopup="menu"')}</nav></aside><div class="conversation"><div class="conversation-heading"><strong>新对话</strong>${button('settings-outline', '设置')}</div><div class="empty-space">今天想做些什么？</div><div class="composer"><textarea aria-label="消息" placeholder="发送消息…"></textarea><div class="composer-toolbar">${button('paperclip-outline', '添加附件')}${button('think-outline', '思考')}${button('agent-preset-outline', 'Agent 预设')}${button('skill-outline', '技能')}<span class="spacer"></span>${button('send-outline', '发送', 'disabled')}</div></div></div></section>
<section class="catalog" aria-label="全部图标对照"><h2>图标对照</h2><table><thead><tr><th>功能</th><th>原版 · 16px</th><th>细线 · 16px</th><th>细线 · 24px</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>`;
const css = `:root{color-scheme:light;--bg:#f8f9fb;--panel:#fff;--side:#f0f1f4;--text:#292d35;--muted:#5d6672;--border:#e1e4e9;--hover:#e7eaf0;--accent:#315ecb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body.dark{color-scheme:dark;--bg:#1a1c20;--panel:#22252b;--side:#25282e;--text:#e1e5ec;--muted:#a0a9b6;--border:#3a4049;--hover:#343b46;--accent:#9fb9ff}main{max-width:920px;margin:0 auto;padding:32px 24px 64px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px}h1{font-size:24px;letter-spacing:-.6px;font-weight:650;margin:0}h2{font-size:18px;margin:32px 0 12px}.controls{display:flex;align-items:center;gap:12px}button,textarea{font:inherit;color:inherit}button{cursor:pointer}button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button{border:0;background:none}button:disabled{cursor:default;opacity:.35}button:not(:disabled):hover{background:var(--hover)}.segmented{display:flex;padding:3px;border:1px solid var(--border);border-radius:9px}.segmented button{padding:5px 12px;border-radius:6px;color:var(--muted)}.segmented button[aria-pressed=true]{background:var(--panel);color:var(--text);box-shadow:0 1px 3px #0001}.theme-button,.icon-button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:7px;flex-shrink:0}.sample{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--panel);display:grid;grid-template-columns:200px 1fr;min-height:340px}aside{background:var(--side);padding:14px 10px;display:flex;flex-direction:column}.sidebar-heading,.conversation-heading{display:flex;align-items:center;justify-content:space-between}.sidebar-heading{padding-left:10px;margin-bottom:16px}.new-session{display:flex;align-items:center;gap:8px;text-align:left;padding:9px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel)}.sidebar-links{display:flex;flex-direction:column;margin-top:22px;gap:4px}.sidebar-links button{display:flex;align-items:center;gap:9px;text-align:left;padding:8px 10px;border-radius:7px}.sidebar-footer{display:flex;justify-content:space-between;margin-top:auto;padding-top:20px}.conversation{padding:18px;display:flex;flex-direction:column}.empty-space{display:flex;flex:1;min-height:100px;align-items:center;justify-content:center;font-size:19px;font-weight:500;color:var(--muted)}.composer{border:1px solid var(--border);border-radius:13px;padding:8px;background:var(--panel)}textarea{resize:none;background:none;border:0;display:block;padding:8px;width:100%;height:50px;outline-offset:0}textarea::placeholder{color:var(--muted)}.composer-toolbar{display:flex;align-items:center;gap:3px}.spacer{flex:1}.catalog table{width:100%;border-collapse:collapse;text-align:center}.catalog th:first-child{text-align:left}.catalog th,.catalog td{height:48px;border-bottom:1px solid var(--border);padding:8px 12px}.catalog thead{font-size:12px;color:var(--muted)}.catalog tbody th{font-weight:450}.old-icon{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center}.new-icon{display:inline-block;width:16px;height:16px;background:currentColor;mask-image:var(--mask);mask-size:contain;mask-position:center;mask-repeat:no-repeat;vertical-align:middle}.enlarged .new-icon{width:24px;height:24px}svg{vertical-align:middle;flex-shrink:0}::selection{background:var(--hover);color:var(--text)}@media(max-width:600px){main{padding:20px 14px 40px}header{align-items:flex-start;flex-wrap:wrap}.sample{grid-template-columns:150px 1fr}aside{padding:10px 6px}.conversation{padding:12px}.sidebar-footer{gap:0}.catalog th,.catalog td{padding:8px 4px;font-size:12px}.empty-space{font-size:15px}.composer-toolbar{gap:0}.composer-toolbar .icon-button{width:26px}.controls{gap:5px}}`;
const script = `const cleanup=[];window.__ModuleLoader__={load(module){window.polishPreview=module.factory();window.polishPreview.apply({effect(fn){cleanup.push(fn())}})}};${client}\nwindow.disablePolish=()=>cleanup.splice(0).reverse().forEach(fn=>fn());for(const id of ['original','polished'])document.getElementById(id).onclick=()=>{if(id==='original')window.disablePolish();else if(!document.querySelector('[data-dsh-polish]'))window.polishPreview.apply({effect(fn){cleanup.push(fn())}});for(const key of ['original','polished'])document.getElementById(key).setAttribute('aria-pressed',String(key===id))};document.getElementById('theme').onclick=()=>document.body.classList.toggle('dark');`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH Polish · 图标预览</title><style>${css}</style><body><svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${definitions}</defs></svg><main>${body}</main><script>${script}</script></body></html>`;
await writeFile(new URL('index.html', folder), html);
const inlineCells = [];
for (const key of favorite) {
  const entry = manifest.native[key];
  const label = entry?.[1] ?? manifest.preserved[key];
  const svg = entry ? (await iconSvg(entry[0])).replaceAll('#000', 'currentColor')
    : host.icons.find(icon => icon.key === key).regular;
  inlineCells.push(`<div class="item">${svg}<span>${label}</span></div>`);
}
await writeFile(new URL('inline.html', folder), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;color:var(--foreground);font-family:var(--font-sans)}.icons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}.item{display:flex;align-items:center;gap:12px;min-height:62px;padding:12px 8px;border-bottom:1px solid var(--border);font-size:13px}.item svg{width:20px;height:20px;flex-shrink:0}@media(max-width:450px){.icons{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><body><div class="icons">${inlineCells.join('')}</div></body></html>`);
console.log(JSON.stringify({preview:new URL('index.html',folder).pathname,native:host.icons.length,sidebar:Object.keys(manifest.sidebar).length,host:host.version,bytes:Buffer.byteLength(html)}));
