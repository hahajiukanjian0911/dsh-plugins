import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:360,height:850},reducedMotion:'reduce',colorScheme:'light'});
page.setDefaultTimeout(7000);
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const row=id=>page.locator('[data-sidebar-row="'+id+'"]');
const input=id=>row(id).getByRole('textbox',{name:'重命名'});
const shelf=()=>page.getByTestId('sidebar-settled-shelf-toggle');
const scroll=()=>page.locator('[data-slot=scroll-area-viewport]');
const main=()=>page.locator('li[data-thread-item] [data-testid=sidebar-row-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.sidebarRow));
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const fresh=async()=>{await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();await row('current').waitFor();};
try{
 await fresh();
 await check('T3 fixed header, flat row list and real DSH native controls render without overflow',async()=>{
   assert.equal(await page.locator('.dsi-primary,.dsi-shelves,.dsi-shelf,.dsi-card').count(),0);
   assert.equal(await page.locator('ul>li[data-thread-item]').count(),5);
   assert.equal(await page.getByRole('button',{name:'工作中',exact:true}).count(),0);
   assert.equal(await page.getByRole('button',{name:'插件',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:'自动化任务',exact:true}).count(),1);
   const b=await shelf().boundingBox(),s=await scroll().boundingBox();assert.ok(Math.abs(b.y+b.height-(s.y+s.height-8))<2);
   assert.notEqual(await page.locator('.dsi-t3').first().evaluate(n=>getComputedStyle(n).color),'rgba(0, 0, 0, 0)');
 });
 await check('context menu uses real rename, inline edit saves and restores focus',async()=>{
   await row('current').click({button:'right'});
   await page.getByRole('menuitem',{name:'重命名',exact:true}).click();
   await input('current').fill('源码侧边栏');await input('current').press('Enter');
   await page.waitForFunction(()=>window.inboxDemo.fixture.sessions.getSnapshot().byId.current.displayTitle==='源码侧边栏');
   assert.equal(await row('current').evaluate(n=>n===document.activeElement),true);
   await row('current').dblclick();await input('current').fill('取消');await input('current').press('Escape');
   assert.equal(await row('current').locator('[data-row-title]').innerText(),'源码侧边栏');
 });
 await check('project menu filters real projects and search includes message matches',async()=>{
   await page.getByRole('button',{name:'按项目筛选'}).click();await page.getByRole('menuitemradio',{name:'LiQun'}).click();
   assert.deepEqual(await main(),['answer','working']);
   await page.getByRole('button',{name:'所有项目',exact:true}).click();
   await page.getByRole('combobox',{name:'搜索会话'}).fill('消息关键字');
   await page.waitForFunction(()=>document.body.textContent.includes('这里包含消息关键字。'));
   assert.equal(await row('working').count(),1);
   await page.getByRole('combobox',{name:'搜索会话'}).press('Escape');
 });
 await check('settled expands into remaining space and uses single-line source rows',async()=>{
   await shelf().click();await row('old').waitFor();
   assert.equal(await row('old').getAttribute('data-testid'),'sidebar-row-slim');
   assert.equal(Math.round((await row('old').boundingBox()).height),30);
   await shelf().click();assert.equal(await row('old').count(),0);
 });
 await check('hover menu settle and Undo keep data and restore prior list order',async()=>{
   const before=await main();
   await row('result').focus();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'收起');
   await page.keyboard.press('Enter');await page.getByRole('button',{name:'撤销',exact:true}).waitFor();
   assert.equal(await row('result').count(),0);await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await main(),before);
   await row('result').hover();await row('result').getByRole('button',{name:'收起',exact:true}).click();
   await page.getByRole('button',{name:'撤销',exact:true}).waitFor();
   assert.equal(await row('result').count(),0);await page.getByRole('button',{name:'撤销',exact:true}).click();
   assert.deepEqual(await main(),before);
 });
 await check('pointer drag reorders T3 rows, keyboard reorder and Undo share the same operation',async()=>{
   const before=await main();await row('working').dragTo(row('answer'),{targetPosition:{x:90,y:5}});
   await page.getByRole('button',{name:'撤销',exact:true}).waitFor();
   const after=await main();assert.equal(after.indexOf('working')+1,after.indexOf('answer'));
   await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await main(),before);
   await row('working').press('Alt+ArrowUp');await page.getByRole('button',{name:'撤销',exact:true}).waitFor();
   assert.notDeepEqual(await main(),before);await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await main(),before);
 });
 await check('drag between card and slim settled rows preserves real session identity',async()=>{
   await row('result').dragTo(shelf());
   await page.waitForFunction(()=>window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r=>r.id==='result').section==='settled');
   await shelf().click();await row('result').waitFor();
   assert.equal(await row('result').getAttribute('data-testid'),'sidebar-row-slim');
   await row('result').dragTo(row('current'),{targetPosition:{x:90,y:5}});
   await page.waitForFunction(()=>window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r=>r.id==='result').section==='inbox');
 });
 await check('snooze submenu and custom dialog use actual reminder writes',async()=>{
   await row('current').click({button:'right'});await page.getByRole('menuitem',{name:'稍后提醒',exact:true}).hover();
   await page.getByRole('menuitem',{name:'自定时间',exact:true}).click();await page.getByRole('dialog').waitFor();
   const future=new Date(Date.now()+2*86400000),local=new Date(+future-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await page.locator('input[type=datetime-local]').fill(local);await page.getByRole('button',{name:'设定提醒'}).click();
   await page.waitForFunction(()=>window.inboxDemo.hooks.inbox.getSnapshot().rows.find(r=>r.id==='current').section==='snoozed');
   assert.equal(await page.getByRole('dialog').count(),0);
 });
 await fresh();
 await check('new unsent current session has a dedicated T3 draft row without extra dividers',async()=>{
   await page.getByRole('button',{name:'新建会话',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[data-section=draft]'));
   const draft=page.locator('[data-sidebar-row][data-section=draft]');await page.waitForFunction(()=>document.querySelector('[data-sidebar-row][data-section=draft]')?.innerText.includes('未发送'));assert.ok((await draft.innerText()).includes('未发送'));
   assert.equal(await page.locator('ul>li[data-thread-item]').first().getAttribute('data-thread-item'),await draft.getAttribute('data-sidebar-row'));
 });
 await fresh();
 await check('empty main list leaves settled at the bottom; a short expansion uses only remaining space',async()=>{
   await page.evaluate(async()=>{
     const {fixture,actions}=window.inboxDemo;
     fixture.status.set(new Map());
     const list=fixture.sessions.getSnapshot();fixture.sessions.set({...list,byId:Object.fromEntries(Object.entries(list.byId).map(([id,row])=>[id,{...row,running:false}]))});
     for(const row of window.inboxDemo.hooks.inbox.getSnapshot().rows)if(row.section!=='settled')await actions.settle(row.id,[]);
     const current=fixture.sessions.getSnapshot();fixture.sessions.set({...current,byId:Object.fromEntries(Object.entries(current.byId).map(([id,row])=>[id,{...row,retainedBy:{mainView:0}}]))});
   });
   await page.waitForFunction(()=>document.querySelector('[data-testid=sidebar-settled-shelf-toggle]')?.textContent.includes('7'));
   const sb=await shelf().boundingBox(),vp=await scroll().boundingBox();assert.ok(sb.y+sb.height>vp.y+vp.height-12);
   await shelf().click();await row('old').waitFor();
   const expanded=await shelf().boundingBox();assert.ok(expanded.y<sb.y-150);assert.ok(expanded.y>vp.y+100);
   await shelf().click();const collapsed=await shelf().boundingBox();assert.ok(Math.abs(collapsed.y-sb.y)<2);
 });
 await fresh();
 await check('overflow extends history below active rows, loads more and scrolls the whole section',async()=>{
   await page.evaluate(()=>{
     const f=window.inboxDemo.fixture,l=f.sessions.getSnapshot(),w=f.workspaces.getSnapshot();
     const added=Array.from({length:95},(_,i)=>({id:'long-'+i,title:'很长的会话名称，用来核对截断与滚动 '+i,displayTitle:'很长的会话名称，用来核对截断与滚动 '+i,cwd:'/example/TimeRing',updatedAt:Date.now()-i*100000,running:false,blank:false,retainedBy:{mainView:0}}));
     f.sessions.set({...l,ids:[...l.ids,...added.map(r=>r.id)],byId:{...l.byId,...Object.fromEntries(added.map(r=>[r.id,r]))}});
     f.workspaces.set({...w,archivedSessionIds:added.slice(65).map(r=>r.id)});
   });
   await page.waitForFunction(()=>document.querySelector('[data-testid=sidebar-settled-shelf-toggle]')?.textContent.includes('31'));
   const head=await shelf().boundingBox(),vp=await scroll().boundingBox();assert.ok(head.y>vp.y+vp.height);
   await shelf().click();await row('long-65').waitFor({state:'attached'});
   const before=await shelf().boundingBox();await scroll().evaluate(n=>n.scrollTop=n.scrollHeight);
   const after=await shelf().boundingBox();assert.ok(after.y<before.y-200);
   assert.ok(await scroll().evaluate(n=>n.scrollHeight>n.clientHeight));
   assert.equal(await scroll().evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
   const bounds=await row('long-70').boundingBox();assert.equal(Math.round(bounds.height),30);
   await page.screenshot({path:'outputs/t3-sidebar-port-history.png',fullPage:true});
 });
 await fresh();
 await check('rail search restores real host expansion and shortcut focuses the search field',async()=>{
   await page.evaluate(()=>window.inboxDemo.setWide(false));await page.getByRole('button',{name:'搜索会话',exact:true}).click();
   await page.getByRole('combobox',{name:'搜索会话'}).waitFor();
   assert.equal(await page.getByRole('combobox',{name:'搜索会话'}).evaluate(n=>n===document.activeElement),true);
 });
 await check('T3 theme follows host appearance; portals do not restyle the host page',async()=>{
   await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.querySelector('.dsi-root.dark'));
   await page.screenshot({path:'outputs/t3-sidebar-port-dark.png',fullPage:true});
   await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.querySelector('.dsi-root.dark'));
   await page.screenshot({path:'outputs/t3-sidebar-port-light.png',fullPage:true});
   const body=await page.locator('body').evaluate(n=>({font:getComputedStyle(n).fontFamily,background:getComputedStyle(n).backgroundColor}));
   assert.notEqual(body.font,'Inter Variable');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>{const f=window.inboxDemo.fixture;const states=new Map(f.status.getSnapshot());states.set('result',{running:true});f.status.set(states);});
   await page.waitForFunction(()=>{
     const icons=[...document.querySelectorAll('[data-sidebar-row] .dsi-native-spinner[role=status]')];
     return icons.length===2&&icons.every(n=>n.style.getPropertyValue('--visible-animation-state')==='running');
   });
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-sidebar-row] .dsi-native-spinner[role=status]')].every(n=>n.style.getPropertyValue('--visible-animation-state')==='paused'));

 });
 assert.deepEqual(errors,[]);
}catch(error){console.log('FAILED BODY',await page.locator('body').innerText());console.log('ERRORS',errors);throw error;}finally{
 const {version}=JSON.parse(await readFile('package.json','utf8'));
 await writeFile('outputs/t3-sidebar-port-checks.json',JSON.stringify({version,checks,errors},null,2)+'\n');await browser.close();
}
