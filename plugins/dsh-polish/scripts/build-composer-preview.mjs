import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {withInstalledHost} from '../../../scripts/installed-host.mjs';
const dir=fileURLToPath(new URL('../../../temp/design/polish-composer-native/',import.meta.url));
const scratch=dir+'.build-native/';
await mkdir(scratch,{recursive:true});await mkdir(dir+'assets/',{recursive:true});
try{
 const host=await withInstalledHost(async h=>{
  const root='dsh/node_modules/@deepseek-ai/';
  const base=root+'dsh-web-frontend/dist/assets/';const names=h.list(base);
  const frontend=await h.read(base+names.find(n=>/^index-.*\.js$/.test(n)));
  const ast=parse(frontend,{sourceType:'module'});const boot=ast.program.body.at(-1);assert.equal(boot.type,'TryStatement');
  const modules=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.params.length===0&&frontend.slice(n.start,n.end).includes('"@deepseek-ai/dsh-client-ui-primitives":'));
  assert.ok(modules);
  await writeFile(scratch+'runtime.js',frontend.slice(0,boot.start)+'\nglobalThis.__DSH_NATIVE_MODULES__='+modules.id.name+'();');
  for(const n of ast.program.body.filter(n=>n.type==='ImportDeclaration')){const name=n.source.value.replace(/^\.\//,'');await writeFile(scratch+name,await h.read(base+name));}
  const definitions={conversation:['ConversationContent','ConversationWidthControls','InputBar','SessionInputShell','ConversationHeader','WorkspaceChip','HeroShell','HeroShell_module_css_default','ConversationRoot_module_css_default','ContextMeter','zh'],chat:['TurnUsagePanel','ActivityPill','UsagePill','zh'],'agent-team':['TeamAction','zh'],workspace:['WorkspacePicker','zh'],'settings-general':['DesktopUpdateIndicator','DesktopUpdateBadge','SettingsPanel','GeneralSection','zh','en'],'model-selection':['ModelSelect','zh'],'agent-preset':['AgentPresetSeat','zh'],'permission-presets':['PermissionSelect','accessZh','zh'],layout:['AppFrame'],sidebar:['SidebarRoot','HeaderLeadingControls','zh'],'sidebar-right':['ExpandButton','PanelChrome','zh'],'input-trigger':['MenuView','zh'],forge:['WorktreeToggle','zh'],renderer:['SlotRegistry','createSlotRenderer']};
  let components='globalThis.__DSH_NATIVE_COMPONENTS__={};';const identities={},moduleStyles=[];
  for(const [name,exports]of Object.entries(definitions)){
   const src=await h.read(root+(name==='forge'?'dsh-experimental-client-ui-forge':name==='agent-team'?'dsh-experimental-client-ui-agent-team':'dsh-client-ui-'+name)+'/lib/client.js');
   const collect=n=>{if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&/^css(?:\$\d+)?$/.test(n.id?.name??'')&&n.init?.type==='StringLiteral')moduleStyles.push(n.init.value);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')collect(v);};collect(parse(src,{sourceType:'script'}));
   identities[name]=createHash('sha256').update(src).digest('hex');
   assert.ok(src.includes('return module.exports;'));
   components+='\nwindow.__ModuleLoader__={load(entry){globalThis.__DSH_NATIVE_COMPONENTS__['+JSON.stringify(name)+']=entry.factory(Object.assign(id=>globalThis.__DSH_NATIVE_MODULES__[id],{asset:path=>path})).__design;}};\n'+src.replace('return module.exports;','exports.__design={'+exports.join(',')+'};return module.exports;');
  }
  const themeSource=await h.read(root+'dsh-client-ui-theme/lib/client.js');const themeNames=['base_css_default','design_platform_css_default','gradient_shadow_text_css_default','scrollbar_css_default'];const styles={};
  const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&themeNames.includes(n.id?.name)&&n.init?.type==='StringLiteral')styles[n.id.name]=n.init.value;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);};visit(parse(themeSource,{sourceType:'script'}));assert.equal(Object.keys(styles).length,4);
  const theme=themeNames.map(n=>styles[n]).join('\n');
  return{components,css:theme+'\n'+await h.read(base+names.find(n=>/^index-.*\.css$/.test(n)))+'\n'+moduleStyles.join('\n'),identities,frontendSha256:createHash('sha256').update(frontend).digest('hex'),version:JSON.parse(await h.read(root+'dsh-client-ui-workspace/package.json')).version};
 });
 const runtime=await build({entryPoints:[scratch+'runtime.js'],bundle:true,write:false,format:'iife',minify:true,target:'es2022',define:{'import.meta.url':'location.href'},plugins:[{name:'unused-lazy-assets',setup(b){b.onResolve({filter:/.*/},a=>a.kind==='dynamic-import'?{path:a.path,external:true}:undefined);}}]});
 const components=await build({stdin:{contents:host.components,resolveDir:dir},write:false,minify:true,target:'es2022'});
 const scene=await build({entryPoints:[fileURLToPath(new URL('composer-preview.jsx',import.meta.url))],bundle:true,write:false,minify:true,format:'iife',target:'es2022',loader:{'.css':'text'},plugins:[{name:'share-host-react',setup(b){b.onResolve({filter:/^(react|react-dom)(\/.*)?$/},a=>({path:a.path,namespace:'host'}));b.onLoad({filter:/.*/,namespace:'host'},a=>({contents:'module.exports=globalThis.__DSH_NATIVE_MODULES__['+JSON.stringify(a.path)+'];',loader:'js'}));}}]});
 await Promise.all([writeFile(dir+'assets/native-runtime.js',runtime.outputFiles[0].text),writeFile(dir+'assets/native-components.js',components.outputFiles[0].text),writeFile(dir+'assets/native.css',host.css),writeFile(dir+'assets/preview.js',scene.outputFiles[0].text),writeFile(dir+'assets/native-source.json',JSON.stringify({app:'/Applications/DeepSeek Harness.app',version:host.version,frontendSha256:host.frontendSha256,modules:host.identities,scope:'Read-only installed host components and theme; isolated design fixtures; no backend or native window interaction.'},null,2)+'\n')]);
 const appPaths=['/System/Library/CoreServices/Finder.app','/Applications/Visual Studio Code.app','/Applications/Zed.app','/Applications/Xcode.app','/Applications/Sourcetree.app','/Applications/Ghostty.app','/Applications/kitty.app','/System/Applications/Utilities/Terminal.app'];
 const appIcons=[];
 for(const [index,app]of appPaths.entries()){
  let file;
  try{file=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',app+'/Contents/Info.plist'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  const source=file?app+'/Contents/Resources/'+file+(file.endsWith('.icns')?'':'.icns'):'';
  if(source&&existsSync(source)){const output=dir+'assets/app-'+index+'.png';execFileSync('sips',['-s','format','png','-Z','32',source,'--out',output],{stdio:'ignore'});appIcons.push({app,file:'assets/app-'+index+'.png',sha256:createHash('sha256').update(await readFile(output)).digest('hex')});}
 }
 await writeFile(dir+'assets/native-app-icons.json',JSON.stringify(appIcons,null,2)+'\n');
 await writeFile(dir+'assets/inbox-client.js',await readFile(new URL('../../../lib/client.js',import.meta.url),'utf8'));
 const plugin=await readFile(new URL('../client.js',import.meta.url),'utf8');
 await writeFile(dir+'assets/polish-client.js',plugin);
 await writeFile(dir+'index.html',`<!doctype html><html lang="zh-CN" data-platform="darwin"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH 原生输入框接入核对</title><style>${host.css}</style><style>html,body{margin:0;font-family:var(--dsw-font-family,system-ui);background:var(--dsw-alias-bg-base)}#preview{height:900px}.preview-main{height:100%;display:flex;flex-direction:column}.preview-main>[data-conversation-content]{flex:1;min-height:0}</style></head><body><div id="preview"></div><script src="assets/native-runtime.js"></script><script src="assets/native-components.js"></script><script>window.__ModuleLoader__={load(entry){window.__POLISH_FACTORY__=entry.factory}}</script><script src="assets/polish-client.js"></script><script>window.__ModuleLoader__={load(entry){window.__INBOX_FACTORY__=entry.factory}}</script><script src="assets/inbox-client.js"></script><script src="assets/preview.js"></script></body></html>`);
 console.log('Built real ConversationContent, InputBar and SessionInputShell fixture.');
}finally{await rm(scratch,{recursive:true,force:true});}
