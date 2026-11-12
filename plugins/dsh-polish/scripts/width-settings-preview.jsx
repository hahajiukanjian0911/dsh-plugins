import React from 'react';

// Real SettingsPanel/GeneralSection; render the actual registered child slot via
// the root component's props face, preserving native scope and locale providers.
export function createWidthSettingsFixture({C,forgeCore,fixture,localeRevision,ReactDOM}){
 const native=C['settings-general'],tr=key=>native.zh[key]??key;
 return function WidthSettingsFixture({renderSlot}){
  const[open,setOpen]=React.useState(false);
  React.useEffect(()=>{
   fixture.hero.set(false);
   const frame=requestAnimationFrame(()=>{
    const scroller=document.querySelector('[data-conversation-scroll]');if(!scroller)return;
    const article=document.createElement('article');article.id='width-native-transcript';article.className='tnXGgG_column';article.style.cssText='min-height:1800px;padding:24px 0;font:16px/2 system-ui;color:var(--dsw-alias-label-primary)';
    article.innerHTML=Array.from({length:24},(_,i)=>`<p>${i+1}. 对话正文宽度检查。设置中调整宽度，保留原来的阅读与输入内容。</p>`).join('');scroller.prepend(article);
   });return()=>cancelAnimationFrame(frame);
  },[]);
  window.widthSettingsFixture={open:()=>setOpen(true),close:()=>setOpen(false),entries:()=>forgeCore.entries('settings.general.item'),refreshLanguage:()=>localeRevision.set({revision:localeRevision.getSnapshot().revision+1})};
  if(!open)return null;
  return ReactDOM.createPortal(<native.SettingsPanel rows={[{id:'general',label:tr('general.nav')}]} activeId="general" onSelect={()=>{}} onClose={()=>setOpen(false)} renderSlot={(name,props,options)=>{
   if(name==='settings.header')return tr('title');
   if(name==='settings.close')return tr('close');
   if(name==='settings.section')return <native.GeneralSection renderSlot={slot=>slot==='settings.general.item'?renderSlot(slot,{}):null}/>;
   return options?.fallback??null;
  }}/>,document.body);
 };
}
