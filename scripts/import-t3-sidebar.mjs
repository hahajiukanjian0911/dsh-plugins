// Reproducible extraction from the pinned, local MIT-licensed T3 Code checkout.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import postcss from 'postcss';
import { execFileSync } from 'node:child_process';
const source = resolve(process.env.T3_SOURCE || '../t3code/apps/web/src');
const target = resolve('src/vendor/t3-web');
if(execFileSync('git',['-C',resolve(source,'../../..'),'rev-parse','HEAD'],{encoding:'utf8'}).trim()!=='5d5ab80a685774f3911c32d842b02a512e60d8ce') throw new Error('T3 source commit changed; review the port before importing');
const files=[];
const hash=s=>createHash('sha256').update(s).digest('hex');
function react18(text) {
  text=text.replace(/\buse,/, 'useContext,').replace(/\buse\((Tooltip\w+Context)\)/g,'useContext($1)')
    .replace(/(<\/?)(Tooltip\w+Context)(?=[\s>])/g,'$1$2.Provider');
  const ast=parse(text,{sourceType:'module',plugins:['typescript','jsx']});
  const edits=[];
  for(const statement of ast.program.body) {
    const exported=statement.type==='ExportNamedDeclaration';
    const node=exported?statement.declaration:statement;
    if(node?.type!=='FunctionDeclaration'||!node.id||! /^[A-Z]/.test(node.id.name)) continue;
    const name=node.id.name;
    edits.push([node.id.start,node.id.end,name+'Impl']);
    if(exported) edits.push([statement.start,node.start,'']);
    edits.push([node.end,node.end,`\n${exported?'export ':''}const ${name} = withNativeRef(${name}Impl);\n`]);
  }
  for(const [start,end,replacement] of edits.sort((a,b)=>b[0]-a[0])) text=text.slice(0,start)+replacement+text.slice(end);
  return 'import { withNativeRef, useCleanupRef } from "@dsh-t3/compat";\n'+text;
}
async function put(path, original, text, mode) {
  const destination=resolve(target,path); await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,text);
  files.push({path,source:'apps/web/src/'+path,originalSha256:hash(original),sha256:hash(text),mode});
}
const copies=['components/ui/button.tsx','components/ui/input.tsx','components/ui/closing-positioner.tsx',
  'components/ui/menu.tsx','components/ui/tooltip.tsx','components/ui/scroll-area.tsx',
  'components/ui/collapsible-section-header.tsx','components/ui/spinner.tsx',
  'components/ProjectMonogram.tsx','projectIconColors.ts','projectIdentity.ts',
  'lib/visibleAnimation.ts','lib/observeResize.ts','components/Sidebar.motion.ts',
  'components/sidebar/SidebarThreadHeader.tsx','components/sidebar/SidebarListMarkers.tsx'];
for(const path of copies) {
  const original=await readFile(resolve(source,path),'utf8'); let text=original;
  if(path.endsWith('.tsx')) text=react18(text);
  if(path.endsWith('tooltip.tsx')) text='import { useSidebarRuntime } from "@dsh-t3/runtime";\n'+text.replace('<TooltipPrimitive.Portal>', '<TooltipPrimitive.Portal container={useSidebarRuntime().portal}>');
  if(path.endsWith('menu.tsx')) text='import { useSidebarRuntime } from "@dsh-t3/runtime";\n'+text.replace('<MenuPrimitive.Portal keepMounted={keepMounted}>','<MenuPrimitive.Portal container={useSidebarRuntime().portal} keepMounted={keepMounted}>');
  if(path.endsWith('spinner.tsx')) text=text.replace('ref={observeVisibleAnimation}','ref={useCleanupRef(observeVisibleAnimation)}');
  if(path.endsWith('SidebarListMarkers.tsx')) text=text.replace('from "../Sidebar.logic"','from "../../../t3-sidebar/Sidebar.logic"').replace('from "./SidebarThreadRow"','from "@dsh-t3/ThreadRow"');
  if(path.endsWith('SidebarThreadHeader.tsx')) {
    text='import { useSidebarRuntime } from "@dsh-t3/runtime";\n'+text;
    text=text.replace('  onNewProject: () => void;', '  onNewProject: () => void;\n  newProjectDisabled?: boolean;').replace('  onNewProject,','  onNewProject,\n  newProjectDisabled,').replace('label={t("addProject")} onClick={onNewProject}', 'label={t("addProject")} disabled={newProjectDisabled} onClick={onNewProject}');
    text=text.replace('const resultsVisible =', 'const { t } = useSidebarRuntime();\n  const resultsVisible =');
    text=text.replace('`New thread (${newThreadShortcutLabel})`','`${t("newSession")} (${newThreadShortcutLabel})`');
    for(const [a,b] of [['"New thread"','{t("newSession")}'],['"Search"','{t("search")}'],['"Search threads"','{t("search")}'],['"Clear thread search"','{t("clearSearch")}'],['"Add project"','{t("addProject")}']]) {
      text=text.replaceAll('='+a,'='+b);
    }
    text=text.replace(': "New thread"', ': t("newSession")').replace('label={t("addProject")} onClick={onNewProject}', 'label={t("addProject")} disabled={newProjectDisabled} onClick={onNewProject}');
  }
  if (['SidebarThreadHeader.tsx','collapsible-section-header.tsx','menu.tsx','spinner.tsx'].some(name=>path.endsWith(name))) text=text.replaceAll('from "lucide-react"', 'from "@dsh-t3/icons"');
  if(path.endsWith('SidebarThreadHeader.tsx')) text=text.replaceAll('SquarePenIcon','NewChatIcon').replace('className="flex items-center gap-1"', 'className="dsi-native-toolbar flex items-center gap-1"').replace('className="flex h-8 min-w-0', 'className="dsi-native-search flex h-8 min-w-0');
  await put(path,original,text,text===original?'verbatim':'React 18 refs; scoped portals; DSH translation/import adaptation');
}
const menuOriginal=await readFile(resolve(source,'components/ui/menu.tsx'),'utf8');
let context=react18(menuOriginal.replace('Menu as MenuPrimitive','ContextMenu as MenuPrimitive').replace('@base-ui/react/menu','@base-ui/react/context-menu'));
context='import { useSidebarRuntime } from "@dsh-t3/runtime";\n'+context.replace('<MenuPrimitive.Portal keepMounted={keepMounted}>','<MenuPrimitive.Portal container={useSidebarRuntime().portal} keepMounted={keepMounted}>');
context=context.replaceAll('from "lucide-react"', 'from "@dsh-t3/icons"');
await put('components/ui/context-menu.tsx',menuOriginal,context,'T3 menu presentation applied to Base UI ContextMenu primitives; React 18 refs; scoped portal');
files.at(-1).source='apps/web/src/components/ui/menu.tsx';
const original=await readFile(resolve(source,'components/ui/sidebar.tsx'),'utf8');
const ast=parse(original,{sourceType:'module',plugins:['typescript','jsx']});
const names=['SidebarInput','SidebarHeader','SidebarFooter','SidebarContent','SidebarGroup','SidebarMenu','SidebarMenuItem','sidebarMenuButtonVariants','SidebarMenuButton'];
const selected=ast.program.body.filter(n=> names.includes(n.id?.name || n.declarations?.[0]?.id?.name));
let subset=`import * as React from 'react';\nimport { mergeProps } from '@base-ui/react/merge-props';\nimport { useRender } from '@base-ui/react/use-render';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { cn } from '~/lib/utils';\nimport { Input, type InputProps } from './input';\nimport { ScrollArea } from './scroll-area';\nimport { Tooltip, TooltipPopup, TooltipTrigger } from './tooltip';\nimport { useSidebar } from '@dsh-t3/runtime';\n`+selected.map(n=>original.slice(n.start,n.end)).join('\n')+`\nexport {${names.filter(n=>n!=='sidebarMenuButtonVariants').join(',')}};\n`;
await put('components/ui/sidebar.tsx',original,react18(subset),'Verbatim presentation declarations; DSH context and React 18 ref adaptation');
const themeOriginal=await readFile(resolve(source,'index.css'),'utf8');
const themeParts=[];
for(const node of postcss.parse(themeOriginal).nodes) {
  if(node.type==='atrule' && (['theme','custom-variant'].includes(node.name)||node.name==='utility'&&['dropdown-glass','visible-animate-spin'].includes(node.params))) themeParts.push(node.toString()+(node.nodes?'':';'));
  if(node.type==='rule'&&(node.selector===':root'||node.selector==='[data-app-sidebar]'||node.nodes?.some(n=>n.type==='decl'&&n.prop.startsWith('--contrast-')))) {
    const copy=node.clone();copy.selector='.dsi-t3';themeParts.push(copy.toString());
  }
}
await put('theme.css',themeOriginal,themeParts.join('\n'),'T3 theme tokens, contrast, dropdown glass and visible-spinner utilities; root scoped to plugin');
files.at(-1).source='apps/web/src/index.css';
for(const [path,origin,mode] of [
  ['components/sidebar/SidebarThreadPresentation.tsx','components/sidebar/SidebarThreadRow.tsx','DSH-native card/slim surfaces over the adapted T3 row structure; backend-dependent UI removed'],
]) {
  const contents=await readFile(resolve(target,path),'utf8');
  files.push({path,source:'apps/web/src/'+origin,originalSha256:hash(await readFile(resolve(source,origin))),sha256:hash(contents),mode});
}
await writeFile(resolve(target,'SOURCE.json'),JSON.stringify({repository:'https://github.com/pingdotgg/t3code',commit:'5d5ab80a685774f3911c32d842b02a512e60d8ce',files},null,2)+'\n');
await writeFile(resolve(target,'LICENSE'),await readFile(resolve(source,'../../../LICENSE')));
