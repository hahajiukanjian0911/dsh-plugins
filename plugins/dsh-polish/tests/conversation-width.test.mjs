import test from 'node:test';
import assert from 'node:assert/strict';
import{createConversationWidthPreference,installConversationWidthSettings}from'../src/conversation-width.js';
const key='dsh.conversation.contentWidth';
function fixture(initial){
 const values=new Map(initial===undefined?[]:[[key,initial]]),listeners=new Map(),writes=[];
 const storage={getItem:k=>{if(storage.failRead)throw Error('blocked');return values.get(k)??null;},setItem(k,v){if(storage.fail)throw Error('quota');values.set(k,v);writes.push([k,v]);},removeItem(k){if(storage.fail)throw Error('quota');values.delete(k);writes.push([k,null]);}};
 const make=width=>{const props=new Map([['--unrelated','keep']]);return{offsetWidth:width,parentElement:{style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}},props};};
 const bodies=[make(1200),make(800)];
 const doc={querySelectorAll:selector=>{assert.equal(selector,'[data-conversation-content]:not(.kiGsTW_embeddedBody)');return bodies;},querySelector:()=>bodies[0]};
 const win={localStorage:storage,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{if(listeners.get(k)===v)listeners.delete(k);}};
 const emit=(type,details={})=>listeners.get(type)?.({type,...details});
 return{values,listeners,writes,storage,bodies,doc,win,emit,model:createConversationWidthPreference(doc,win)};
}
test('接入时读取原生宽度，不改现有偏好或布局；停用清理监听',()=>{
 const f=fixture('1037.5');assert.equal(f.model.getSnapshot().value,1037.5);assert.equal(f.writes.length,0);assert.equal(f.bodies[0].props.has('--dsh-chat-user-width'),false);
 const off=f.model.start();assert.equal(f.listeners.size,2);off();assert.equal(f.listeners.size,0);assert.equal(f.values.get(key),'1037.5');
});
test('设置沿用原生键并即时适配各主窗口；恢复自动只移除该偏好',()=>{
 const f=fixture('700');assert.equal(f.model.set(1000),true);assert.equal(f.values.get(key),'1000');assert.equal(f.bodies[0].props.get('--dsh-chat-user-width'),'1000px');assert.equal(f.bodies[1].props.get('--dsh-chat-user-width'),'640px');
 assert.equal(f.model.set(null),true);assert.equal(f.values.has(key),false);for(const b of f.bodies){assert.equal(b.props.has('--dsh-chat-user-width'),false);assert.equal(b.props.get('--unrelated'),'keep');}
});
test('保存失败保留原值和布局，重试成功后清除错误',()=>{
 const f=fixture('800');f.storage.fail=true;assert.equal(f.model.set(1000),false);assert.equal(f.model.getSnapshot().value,800);assert.equal(f.model.getSnapshot().error,true);assert.equal(f.values.get(key),'800');assert.equal(f.bodies[0].props.has('--dsh-chat-user-width'),false);
 const off=f.model.start();f.storage.fail=false;f.emit('focus');assert.equal(f.model.getSnapshot().error,true);assert.equal(f.model.set(1000),true);assert.deepEqual(f.model.getSnapshot(),{value:1000,error:false});off();
});
test('跨窗口只响应对应localStorage键；清空和窗口回焦同步已保存值',()=>{
 const f=fixture('800');const off=f.model.start();let updates=0;f.model.subscribe(()=>updates++);f.values.set(key,'920');f.emit('storage',{key:'other',storageArea:f.storage});assert.equal(updates,0);
 f.emit('storage',{key,storageArea:{}});assert.equal(updates,0);f.emit('storage',{key,storageArea:f.storage});assert.equal(f.model.getSnapshot().value,920);assert.equal(updates,1);
 f.values.delete(key);f.emit('storage',{key:null,storageArea:f.storage});assert.equal(f.model.getSnapshot().value,null);f.values.set(key,'1120');f.emit('focus');assert.equal(f.model.getSnapshot().value,1120);off();
});
test('无效新值不写入；损坏的旧值沿用宿主自动回退且不擅自清理',()=>{
 const f=fixture('corrupt');assert.equal(f.model.getSnapshot().value,null);for(const value of[NaN,Infinity,0,-1,639,'1000'])assert.equal(f.model.set(value),false);assert.equal(f.values.get(key),'corrupt');assert.equal(f.writes.length,0);
});

test('读取暂时失败不把已有自定义宽度误报成自动',()=>{
 const f=fixture('840');const off=f.model.start();f.storage.failRead=true;f.emit('focus');assert.deepEqual(f.model.getSnapshot(),{value:840,error:true});assert.equal(f.values.get(key),'840');f.storage.failRead=false;f.emit('focus');assert.deepEqual(f.model.getSnapshot(),{value:840,error:false});off();
});

test('页面宽度通过声明依赖的子上下文读取服务，等待服务期间没有副作用',()=>{
 const f=fixture('800'),effects=[],registrations=[],dictionaries=[];
 let activate;
 const ctx={
  get slots(){throw Error('root slots access without inject');},
  get locale(){throw Error('root locale access without inject');},
  inject(dependencies,callback){assert.deepEqual(dependencies,['slots','locale']);activate=callback;},
 };
 const React={useSyncExternalStore(){},createElement(){}};
 installConversationWidthSettings(ctx,React,{},f.doc,f.win);
 assert.equal(f.listeners.size,0);assert.equal(f.writes.length,0);
 const scope={
  effect(callback){const off=callback();effects.push(off);return off;},
  locale:{register(name){dictionaries.push(name);return()=>dictionaries.pop();}},
  slots:{inject(name,callback){assert.equal(name,'settings.general.item');effects.push(callback());},register(meta){registrations.push(meta.id);return()=>registrations.pop();}},
 };
 activate(scope);
 assert.deepEqual(dictionaries,['polishWidth']);assert.deepEqual(registrations,['polish.page-width']);
 assert.equal(f.listeners.size,2);assert.equal(f.writes.length,0);
 for(const off of effects.reverse())off();
 assert.equal(f.listeners.size,0);assert.deepEqual(dictionaries,[]);assert.deepEqual(registrations,[]);
});
