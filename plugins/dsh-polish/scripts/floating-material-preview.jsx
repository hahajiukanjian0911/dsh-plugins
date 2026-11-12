import React from 'react';
import {createRoot} from 'react-dom/client';

// Actual installed statistics, context, team and Menu primitives. Isolated data;
// no user session, external application, clipboard, download or model operation.
export function mountFloatingMaterialFixture({P,C,fixture}) {
  fixture.hero.set(false);
  const t=d=>(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),d[key]??({'number.thousand':'{value}K','number.million':'{value}M'}[key])??key);
  let attempts=0;
  const mount=()=>{
    const scroller=document.querySelector('[data-conversation-scroll]');
    if(!scroller){if(++attempts<20)requestAnimationFrame(mount);else throw Error('Native conversation did not mount');return;}
    const article=document.createElement('article');article.id='floating-native-chat';
    article.style.cssText='position:relative;flex:none;min-height:1800px;padding:24px 60px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:16px/2 system-ui';
    article.innerHTML=Array.from({length:24},(_,i)=>`<p style="margin:0 0 20px">${i+1}. 当前在 TimeRing 项目里。检查代码、查看文档、构建和测试。<span style="background:#d5e8ff;color:#111114;border-radius:5px;padding:3px">待处理</span></p>`).join('');
    const seat=document.createElement('div');seat.dataset.materialFixture='';seat.style.cssText='position:absolute;top:460px;left:40px;right:40px;display:flex;align-items:center;justify-content:center;gap:16px;min-height:36px';article.append(seat);scroller.prepend(article);scroller.scrollTop=0;
    const id='fixture-material-lead',calls=[],Team=C['agent-team'].TeamAction;
    const usage={totalTokens:17554,inputTokens:14833,uncachedInputTokens:14833,cacheReadTokens:2560,cacheWriteTokens:0,outputTokens:161,routes:[{provider:'deepseek-official',model:'deepseek-flash'}]};
    const projections={tokenUsage:usage,sessionStats:{turns:1,steps:1,llmMs:2200,toolMs:0,ttftMs:1300,ttftSteps:1,decodeMs:915,decodeTokens:161},contextPressure:{projectedTokens:17554,contextWindow:1000000},contextBreakdown:{systemTokens:1800,toolsTokens:7700,messageTokens:5700}};
    const team={members:[{id,name:'lead',phase:'active'}],tasks:[]};
    const sessions={phase:'ready',byId:{[id]:{running:false}},projectionsBySession:{[id]:{values:{agentTeam:team}}}};
    const state=window.floatingMaterialFixture={calls,projections,team,sessions};
    const appNames=['访达','VS Code','Zed（默认）','Xcode','Sourcetree','Ghostty','kitty','终端'];
    function MenuScene({scene}){
      const[open,setOpen]=React.useState(false);
      const items=scene==='apps'?appNames.map((label,i)=>({id:'app-'+i,label,icon:<img alt="" src={'assets/app-'+i+'.png'} width="16" height="16"/>})):
        scene==='plugins'?[{id:'browse',label:'浏览更多插件',icon:<P.IconPluginPinwheelOutlineRegular size={16}/>},{id:'create',label:'创建你的插件',icon:<P.IconPlusOutlineRegular size={16}/>}]:
        [{id:'copy',label:'复制会话为 Markdown',icon:<P.IconCopyOutlineRegular size={16}/>},{id:'export',label:'下载 Session 日志',icon:<P.IconDownloadOutlineRegular size={16}/>},{id:'feedback',label:'反馈',icon:<P.IconPaperPlaneOutlineRegular size={16}/>}];
      return <P.Menu open={open} onClose={()=>setOpen(false)} anchor={<P.Button onClick={()=>setOpen(v=>!v)} aria-haspopup="menu">{scene}</P.Button>} items={items} portal onSelect={value=>{calls.push({scene,value});setOpen(false);}}/>;
    }
    function App(){
      const[scene,setScene]=React.useState('usage');state.setScene=setScene;state.scene=scene;
      const native={useProjection:name=>projections[name],usePerformanceUsage:select=>select('full'),t:t(C.chat.zh)};
      if(scene==='hover')return <P.HoverCard anchor={<P.Button data-floating-hover>会话详情</P.Button>} content={<div><strong className="JoiKIa_hoverTitle">重新设计侧边栏插件</strong><p className="JoiKIa_hoverPath">dsh-plugins · /fixture/Development/tools/dsh-plugins</p></div>} openDelayMs={70} inline variant="preview"/>;
      if(scene==='usage')return <C.chat.TurnUsagePanel usage={usage} t={native.t}/>;
      if(scene==='stats')return <C.chat.ActivityPill {...native} useChat={select=>select({legacy:{nodes:[]}})}/>;
      if(scene==='tokens')return <C.chat.UsagePill {...native}/>;
      if(scene==='context')return <C.conversation.ContextMeter useProjection={native.useProjection} t={t(C.conversation.zh)}/>;
      if(scene==='team')return <Team sessionId={id} useSession={select=>select({subagent:null,openState:'ready'})} useSessions={select=>select(sessions)} useSessionStatus={select=>select(new Map([[id,{running:false}]]))} openTeammate={(...args)=>calls.push({scene,args})} t={t(C['agent-team'].zh)}/>;
      return <MenuScene key={scene} scene={scene}/>;
    }
    const root=createRoot(seat);root.render(<App/>);state.unmount=()=>{root.unmount();article.remove();};
  };
  requestAnimationFrame(mount);
}
