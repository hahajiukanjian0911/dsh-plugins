import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const root = new URL('../', import.meta.url);
export const manifest = JSON.parse(await readFile(new URL('src/icons.json', root), 'utf8'));

export async function iconSvg(name, stroke = manifest.stroke.regular, variant) {
  const original = await readFile(new URL(`icons/lucide/${name}.svg`, root), 'utf8');
  let svg = original.slice(original.indexOf('<svg')).trim()
    .replace(/^<svg\b[^>]*>/, opening => opening.replace(/\s+(?:width|height)="[^"]*"/g, ''))
    .replace(/stroke-width="[^"]*"/, `stroke-width="${stroke}"`)
    .replaceAll('currentColor', '#000');
  if (variant === 'fill') svg = svg.replace('fill="none"', 'fill="#000"');
  if (variant === 'cutout') {
    const start = svg.indexOf('>') + 1;
    const content = svg.slice(start, svg.lastIndexOf('</svg>'));
    const circle = content.match(/<circle\b[^>]*\/>/)?.[0];
    assert.ok(circle, `镂空图标需要圆形外框：${name}`);
    const marks = content.replace(circle, '');
    const mask = '<defs><mask id="cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24" style="mask-type:luminance">'
      + '<rect width="24" height="24" fill="#fff" stroke="none"/>' + marks + '</mask></defs>';
    svg = svg.slice(0, start) + mask + '<g mask="url(#cutout)">'
      + circle.replace('<circle ', '<circle fill="#000" ') + '</g></svg>';
  }
  return svg.replace(/\s+/g, ' ');
}

export async function buildStyles() {
  const entries = [];
  for (const [key, [name, , variant]] of Object.entries(manifest.native)) {
    for (const [weight, stroke] of Object.entries(manifest.stroke)) {
      entries.push([`svg[data-icon="dsw-icon-${key}-${weight}"]`, await iconSvg(name, stroke, variant)]);
    }
  }
  for (const [, [name, , path]] of Object.entries(manifest.sidebar)) {
    let selector = `.dsi-root svg:has(> path[d="${path}"])`;
    // 两个旧图标共用文件夹外轮廓，用内部的加号区分。
    if (name === 'folder') selector += ':not(:has(> path[d="M12 11v6m-3-3h6"]))';
    entries.push([selector, await iconSvg(name)]);
  }
  for (const [selector, name] of Object.entries(manifest.scoped ?? {})) {
    entries.push([selector, await iconSvg(name)]);
  }
  const selectors = entries.map(([selector]) => selector).join(',');
  const masks = entries.map(([selector, svg]) => {
    const uri = `data:image/svg+xml,${encodeURIComponent(svg).replaceAll("'", '%27')}`;
    return `${selector}{--dsp-icon:url("${uri}")}`;
  });
  return `${masks.join('\n')}\n:is(${selectors}){background-color:currentColor;mask-image:var(--dsp-icon);mask-size:contain;mask-position:center;mask-repeat:no-repeat;forced-color-adjust:none}\n:is(${selectors})>*{visibility:hidden}\n`;
}

export async function build() {
  const template = await readFile(new URL('src/client.js', root), 'utf8');
  const token = "/* @polish-styles */ ''";
  assert.equal(template.split(token).length, 2, '样式注入标记必须唯一');
  const styles = await buildStyles() + await readFile(new URL('src/tooltips.css', root), 'utf8')
    + await readFile(new URL('src/popovers.css', root), 'utf8')
    + await readFile(new URL('src/motion.css', root), 'utf8')
    + await readFile(new URL('src/settings.css', root), 'utf8')
    + await readFile(new URL('src/typography.css', root), 'utf8')
    + await readFile(new URL('src/materials.css', root), 'utf8')
    + await readFile(new URL('src/composer.css', root), 'utf8')
    + await readFile(new URL('src/composer-popovers.css', root), 'utf8')
    + await readFile(new URL('src/dropdowns.css', root), 'utf8')
    + await readFile(new URL('src/titlebar.css', root), 'utf8')
    + await readFile(new URL('src/sidebar-footer.css', root), 'utf8')
    + await readFile(new URL('src/native-scrollbars.css', root), 'utf8')
    + await readFile(new URL('src/conversation-width.css', root), 'utf8');
  const tooltips = (await readFile(new URL('src/tooltips.js', root), 'utf8')).replace('export function', 'function');
  assert.equal(template.split('/* @polish-tooltips */').length, 2, '提示模块注入标记必须唯一');
  const motion = (await readFile(new URL('src/motion.js', root), 'utf8')).replace('export function', 'function');
  assert.equal(template.split('/* @polish-motion */').length, 2, '动效模块注入标记必须唯一');
  const composer = (await readFile(new URL('src/composer.js', root), 'utf8')).replaceAll('export function', 'function');
  assert.equal(template.split('/* @polish-composer */').length, 2, '输入区布局注入标记必须唯一');
  const worktree = (await readFile(new URL('src/worktree.js', root), 'utf8')).replaceAll('export function', 'function');
  assert.equal(template.split('/* @polish-worktree */').length, 2, '工作树菜单注入标记必须唯一');
  const dropdowns = (await readFile(new URL('src/dropdowns.js', root), 'utf8')).replace('export function', 'function');
  assert.equal(template.split('/* @polish-dropdowns */').length, 2, '下拉框定位注入标记必须唯一');
  const titlebar = (await readFile(new URL('src/titlebar.js', root), 'utf8')).replaceAll('export function', 'function');
  assert.equal(template.split('/* @polish-titlebar */').length, 2, '标题栏注入标记必须唯一');
  const nativeScrollbars = (await readFile(new URL('src/native-scrollbars.js', root), 'utf8')).replaceAll('export function', 'function');
  assert.equal(template.split('/* @polish-native-scrollbars */').length, 2, '原生滚动条注入标记必须唯一');
  const conversationWidth = (await readFile(new URL('src/conversation-width.js', root), 'utf8')).replaceAll('export function', 'function');
  assert.equal(template.split('/* @polish-conversation-width */').length, 2, '页面宽度注入标记必须唯一');
  const client = template.replace(token, () => JSON.stringify(styles)).replace('/* @polish-tooltips */', () => tooltips)
    .replace('/* @polish-motion */', () => motion).replace('/* @polish-composer */', () => composer)
    .replace('/* @polish-worktree */', () => worktree).replace('/* @polish-dropdowns */', () => dropdowns)
    .replace('/* @polish-titlebar */', () => titlebar).replace('/* @polish-native-scrollbars */', () => nativeScrollbars)
    .replace('/* @polish-conversation-width */', () => conversationWidth);
  await writeFile(new URL('client.js', root), client);
  console.log(`Built ${Object.keys(manifest.native).length} native icons and ${Object.keys(manifest.sidebar).length} sidebar icons.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
