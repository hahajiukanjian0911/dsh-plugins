import React from 'react';
import{createRoot}from'react-dom/client';
import * as ReactDOM from 'react-dom';
import {createWidthSettingsFixture} from './width-settings-preview.jsx';
import {mountFloatingMaterialFixture} from './floating-material-preview.jsx';
import {createTitlebarFrame} from './titlebar-preview.jsx';
import {installComposerProjects} from '../../dsh-project-manager/src/composer.jsx';
const wholeFrame=new URLSearchParams(location.search).has('titlebar');
const widthScene=new URLSearchParams(location.search).has('width-settings');
const M=globalThis.__DSH_NATIVE_MODULES__,C=globalThis.__DSH_NATIVE_COMPONENTS__,P=M['@deepseek-ai/dsh-client-ui-primitives'];
function store(value){const listeners=new Set();return{getSnapshot:()=>value,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),set:v=>{value=v;listeners.forEach(fn=>fn());}};}
const hook=s=>select=>select(React.useSyncExternalStore(s.subscribe,s.getSnapshot));
const tr=d=>(key,v={})=>Object.entries(v).reduce((s,[k,x])=>s.replaceAll('{'+k+'}',String(x)),d[key]??({'workspace.defaultName':'默认工作区'}[key])??key);
const noop=()=>{},resolved=()=>Promise.resolve(),t=tr(C.conversation.zh);
const id='composer-fixture',session=store({phase:'ready',blank:true,running:false,removed:false,subagent:null,promptError:null}),status=store(new Map()),workspaces=store({phase:'ready',items:[{workspaceId:'timering',title:'TimeRing',path:'/fixture/TimeRing',sessionIds:[id]}]});
const shell=new C.conversation.SessionInputShell({submissionState:()=>({running:false,removed:false}),quoteRemoveLabel:()=>''});
const menu=store({open:false,groups:[{source:'command',showGroupTitle:false,status:'ready',items:[{name:'file',label:'文件',section:'添加',icon:P.IconPaperclipOutlineRegular},{name:'goal',label:'目标',section:'添加',description:'设置或查看长期任务目标',icon:P.IconGoalOutlineRegular},{name:'plan',label:'计划',section:'添加',description:'进入或退出计划模式',icon:P.IconPlanOutlineRegular},{name:'feedback',label:'反馈',section:'添加',description:'发送关于当前会话的反馈',icon:P.IconPaperPlaneOutlineRegular},{name:'compact',label:'压缩',section:'指令',description:'压缩以上对话内容',icon:P.IconCompactOutlineRegular},{name:'permission',label:'权限',section:'指令',description:'切换权限预设（沙箱模式与审批策略）',icon:P.IconShieldOutlineRegular},{name:'model',label:'模型',section:'指令',description:'选择本会话使用的模型',icon:P.IconDataOutlineRegular},{name:'export',label:'下载日志',section:'指令',description:'将当前会话内容导出为 ZIP',icon:P.IconDownloadOutlineRegular}]}],highlight:{source:'command',index:0}}),launcher=store(null),headers=store(new Map());
const space=store(null),hero=store(true),preset=store({options:[{id:'default',name:'标准模式',description:'处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。'},{id:'ptc',name:'PTC 模式',description:'包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。'},{id:'minimal',name:'极简模式',description:'Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试和对比其基础表现。'},{id:'creative',name:'创造模式',description:'用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。'}],current:'default',busy:false,error:null,introduce:false}),permission=store({currentValue:'workspace-write'}),catalog=store({value:{options:[{value:'workspace-write',name:'工作区内修改'},{value:'read-only',name:'只读'},{value:'danger-full-access',name:'完全权限'}]}}),forge=store({state:{worktree:{editable:true,blocker:null,creation:null,request:null},checkout:{state:'ready',checkout:{branch:'main',commit:null}}}}),models=store({groups:[{id:'deepseek-account',name:'DeepSeek',models:[{id:'flash',name:'DeepSeek-V4.1-Flash',reasoning:{defaultEffort:'max',efforts:[{id:'high',name:'High'},{id:'max',name:'Max'}]}}]}],current:{provider:'deepseek-account',model:'flash',reasoningEffort:'max'},retainedEffort:null,pending:null,error:null,failures:[],status:'ready'});
const fixture=window.composerFixture={shell,hero,preset,forge,permission,models,menu,submissions:[],projectPicks:[],filePicks:[],errors:[]};
shell.submit=(mode,gesture)=>{fixture.submissions.push({mode,gesture,draft:shell.snapshot.draft});};
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';svg.setAttribute('aria-hidden','true');for(const[id,src]of Object.entries(P.ICON_SYMBOLS)){const root=new DOMParser().parseFromString(src,'image/svg+xml').documentElement,node=document.createElementNS(svg.namespaceURI,'symbol');node.id=id;for(const a of root.attributes)if(a.name!=='xmlns')node.setAttribute(a.name,a.value);while(root.firstChild)node.append(root.firstChild);svg.append(node);}document.body.prepend(svg);
const forgeCore=new C.renderer.SlotRegistry(new M['@deepseek-ai/cordis'].Context());
forgeCore.install(C.renderer.createSlotRenderer());
const sessionBinding=store({key:id,ctx:{},props:{},hooks:{},keyedHooks:{}});fixture.sessionBinding=sessionBinding;for(const name of['session','session-maybe'])forgeCore.installScope(name,{current:sessionBinding,bindingSource:()=>sessionBinding,renderArea:(_binding,props)=>props.children});
const localeCatalog=new Map(),localeRevision=store({revision:0});
const localeBind=namespace=>(key,params)=>tr(localeCatalog.get(namespace)?.[document.documentElement.lang.startsWith('en')?'en':'zh']??(namespace==='forgePanel'?C.forge.zh:namespace==='workspace'?C.workspace.zh:{chooseProject:'选择项目',addProject:'添加项目'}))(key,params);
forgeCore.installLocale({...localeRevision,bind:localeBind});forgeCore.provideRoot({hooks:{workspaces}});
const WidthSettingsFixture=widthScene?createWidthSettingsFixture({C,forgeCore,fixture,localeRevision,ReactDOM}):null;
forgeCore.register({name:'root',children:{'shell.overlay':{kind:'list',scope:'root'},'settings.general.item':{kind:'list',scope:'root'},'conversation.hero.options':{kind:'list',scope:'session'},'conversation.hero.workspace':{kind:'single',scope:'root'},'conversation.composer.bar':{kind:'single',scope:'session'},'conversation.input.dock':{kind:'list',scope:'session'}}},props=>React.createElement(React.Fragment,null,React.createElement(wholeFrame?Frame:App,props),WidthSettingsFixture&&React.createElement(WidthSettingsFixture,props)));
const nativeForgeProps={usePanel:hook(forge),t:tr(C.forge.zh),
 request:async from=>{fixture.worktreeCalls.push({action:'request',from});if(fixture.holdRequest)await new Promise(resolve=>{fixture.finishRequest=resolve;});if(fixture.rejectRequest)throw new Error('fixture request failure');const old=forge.getSnapshot();forge.set({state:{...old.state,worktree:{...old.state.worktree,request:{from}}}});},
 cancel:async()=>{fixture.worktreeCalls.push({action:'cancel'});const old=forge.getSnapshot();forge.set({state:{...old.state,worktree:{...old.state.worktree,request:null}}});},
 branches:async()=>{fixture.worktreeCalls.push({action:'branches'});if(fixture.rejectBranches)throw new Error('fixture branches failure');return{current:'main',branches:['main','feature/composer']};}};
fixture.worktreeCalls=[];
let nativeForgeOff;
fixture.setForgeEnabled=value=>{if(value&&!nativeForgeOff)nativeForgeOff=forgeCore.register({name:'conversation.hero.options',id:'forge-panel.worktree',locale:'forgePanel',inject:sessionId=>{if(sessionId!==id)throw new Error('Forge received wrong session: '+sessionId);fixture.injectedSessionIds??=[];fixture.injectedSessionIds.push(sessionId);return{hooks:{panel:forge},request:nativeForgeProps.request,cancel:nativeForgeProps.cancel,branches:nativeForgeProps.branches,fixtureNativeInjection:true};}},C.forge.WorktreeToggle);else if(!value&&nativeForgeOff){nativeForgeOff();nativeForgeOff=undefined;}};
fixture.setForgeEnabled(true);fixture.forgeCore=forgeCore;
let cleanups=[];const track=off=>{if(typeof off==='function'&&!cleanups.includes(off))cleanups.push(off);return off;};
const ctx={locale:{bind:localeBind,register:(name,dict)=>{const old=localeCatalog.get(name);localeCatalog.set(name,dict);return()=>{if(localeCatalog.get(name)===dict){if(old)localeCatalog.set(name,old);else localeCatalog.delete(name);}};}},effect:fn=>track(fn()),inject:(_deps,fn)=>fn(ctx),slots:{
 inject:(_name,fn)=>track(fn()),entries:name=>forgeCore.entries(name),subscribe:(name,fn)=>forgeCore.subscribe(name,fn),
 register:(meta,Component)=>{if(['shell.overlay','conversation.hero.options','conversation.hero.workspace','settings.general.item'].includes(meta.name))return forgeCore.register(meta,Component);if(meta.name!=='conversation.input.left')throw new Error('Unexpected slot '+meta.name);space.set(Component);return()=>space.set(null);}}};
const plugin=window.__POLISH_FACTORY__(name=>M[name]);fixture.enable=()=>{if(!cleanups.length)plugin.apply(ctx);};fixture.disable=()=>{const list=cleanups;cleanups=[];for(const off of list.reverse())off();};fixture.enable();
const controller=Object.assign(store({view:{localId:'local',projects:[{key:'timering',name:'TimeRing',icon:{kind:'glyph',value:'code',color:'#e865a4'},checkouts:[{id:'timering',environmentId:'local',path:'/fixture/TimeRing'}]}]}}),{mount:()=>()=>{},load:resolved});
forgeCore.register({name:'conversation.hero.workspace',locale:'workspace',children:{'conversation.hero.workspace.directoryFlow':{kind:'single',scope:'root'}},inject:()=>({hooks:{directoryFlow:store(true)},createWorkspace:resolved})},C.workspace.WorkspacePicker);
const projectCtx={effect:fn=>fn(),locale:ctx.locale,slots:{inject:(_name,fn)=>fn(),entries:name=>forgeCore.entries(name),subscribe:(name,fn)=>forgeCore.subscribe(name,fn),register:(meta,component)=>forgeCore.register(meta,component)}};
let projectOff;fixture.enableProjectManager=()=>{if(!projectOff)projectOff=installComposerProjects(projectCtx,React,P,ReactDOM,controller);};fixture.disableProjectManager=()=>{projectOff?.();projectOff=undefined;};
fixture.controller=controller;fixture.workspaces=workspaces;
fixture.enableProjectManager();
const emptyFiles=store({}),busy=store('queue'),stopKeys=store([]);
function Mode(){const Seat=C['agent-preset'].AgentPresetSeat;return <Seat sessionId={id} useSessionRetainInfo={s=>s({retainedBy:{mainView:1}})} useAgentPresetSeat={hook(preset)} useDeveloperTools={s=>s(false)} load={noop} select={v=>{preset.set({...preset.getSnapshot(),current:v});return Promise.resolve();}} dismissRefusal={noop} introduced={noop} t={tr(C['agent-preset'].zh)}/>;}
function Permission(props){const Select=C['permission-presets'].PermissionSelect;return <Select {...props} usePermissionCatalog={hook(catalog)} useProjection={()=>React.useSyncExternalStore(permission.subscribe,permission.getSnapshot)} select={v=>{permission.set({currentValue:v});return Promise.resolve();}} t={tr(C['permission-presets'].accessZh)}/>;}
function Model(props){const Select=C['model-selection'].ModelSelect;return <Select {...props} available directory={models} load={noop} select={(...args)=>{fixture.modelPicks??=[];fixture.modelPicks.push(args);return Promise.resolve();}} resolveText={x=>x} renderSlot={(_n,_p,o)=>o?.fallback??null} t={tr(C['model-selection'].zh)}/>;}
function NativeBar(owner){const InputBar=C.conversation.InputBar,Space=React.useSyncExternalStore(space.subscribe,space.getSnapshot);const renderSlot=(name,props)=>{
 if(name==='conversation.input.left')return <span data-slot={name} style={{display:'contents'}}>{Space&&<Space/>}</span>;
 if(name==='conversation.input.permission')return <span data-slot={name} style={{display:'contents'}}><Permission {...props}/></span>;
 if(name==='conversation.input.model')return <span data-slot={name} style={{display:'contents'}}><Model {...props}/></span>;
 if(name==='conversation.input.overlay'){const Menu=C['input-trigger'].MenuView;return <Menu menu={menu} headers={headers} onPick={(source,index)=>{fixture.commandPicks??=[];fixture.commandPicks.push({source,index});menu.set({...menu.getSnapshot(),open:false});launcher.set(null);}} onCrumb={noop} onHover={(source,index)=>menu.set({...menu.getSnapshot(),highlight:{source,index}})} onDismiss={()=>{menu.set({...menu.getSnapshot(),open:false});launcher.set(null);}} t={tr(C['input-trigger'].zh)}/>;}
 if(name==='conversation.input.activity')return <button type="button" aria-label="语音输入" onClick={()=>{window.composerVoiceActive=!window.composerVoiceActive;props.onActiveChange(window.composerVoiceActive);}} style={{border:0,background:'transparent',padding:4,color:'inherit'}}><P.IconMicrophoneOutlineRegular size={18}/></button>;
 return null;
};return <InputBar {...owner} sessionId={id} useSession={hook(session)} useInput={hook(shell.state)} inputActions={shell.actions} keyboard={shell} addFiles={files=>{fixture.filePicks.push(files.map(f=>f.name));return null;}} removeAttachment={noop} resolveDraftAttachments={()=>[]} retryFileUpload={noop} toggleCommandMenu={()=>{const next=!menu.getSnapshot().open;menu.set({...menu.getSnapshot(),open:next});launcher.set(next?'command':null);}} stop={noop} t={t} renderSlot={renderSlot} useBusyEnter={hook(busy)} useFileUploads={hook(emptyFiles)} useNotices={hook(shell.notices)} useLexicon={hook(shell.lexicon)} useMenuLauncher={hook(launcher)} useStopShortcut={hook(stopKeys)} useAccess={()=>true} useProjection={(name,select)=>select?select(undefined):undefined}/>;}
forgeCore.register({name:'conversation.composer.bar',id:'fixture.input-bar'},NativeBar);
const Nothing=()=>null;function App({renderSlot:nativeRenderSlot}){const isHero=React.useSyncExternalStore(hero.subscribe,hero.getSnapshot),Content=C.conversation.ConversationContent;const renderSlot=(name,props,opts)=>{
 if(name==='conversation.composer.bar'||name==='conversation.input.dock')return nativeRenderSlot(name,props);
 if(name==='conversation.hero.agentPreset')return <span data-slot={name} style={{display:'contents'}}><Mode/></span>;
 if(name==='conversation.hero.options')return <span data-slot={name} style={{display:'contents'}}>{nativeRenderSlot(name,props)}</span>;
 if(name==='conversation.hero.workspace')return nativeRenderSlot(name,props);
 return opts?.fallback??null;
};return <div className={'preview-main '+C.conversation.ConversationRoot_module_css_default.root} data-phase={isHero?'hero':'active'}><Content sessionId={id} phase={isHero?'hero':'active'} hero={isHero} t={t} renderSlot={renderSlot} renderSlotChain={(_n,_p,o)=>o.fallback} useFactorySlot={name=>widthScene&&name==='widthControls'?C.conversation.ConversationWidthControls:Nothing} useSession={hook(session)} useSessions={s=>s({byId:{[id]:{id,cwd:'/fixture/TimeRing',blank:true}}})} useSessionStatus={hook(status)} useWorkspaces={hook(workspaces)} useInput={hook(shell.state)} useComposerBlock={s=>s(undefined)} selectWorkspace={v=>{fixture.projectPicks.push(v);return Promise.resolve();}}/></div>;}
const Frame=wholeFrame?createTitlebarFrame({M,C,P,App,hero,session,id,forgeCore}):null;
createRoot(document.getElementById('preview')).render(forgeCore.renderSlot('root',{}));

if(new URLSearchParams(location.search).has('surfaces'))mountFloatingMaterialFixture({P,C,fixture,ReactDOM});


