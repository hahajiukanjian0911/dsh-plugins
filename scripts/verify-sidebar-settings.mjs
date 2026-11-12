import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1050,height:850},colorScheme:'light',reducedMotion:'no-preference'});
const page=await context.newPage();page.setDefaultTimeout(6000);
const errors=[],checks=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const row=id=>page.locator('[data-sidebar-row="'+id+'"]');
const toggle=label=>page.getByRole('switch',{name:label,exact:true});
const primary=()=>page.locator('li[data-thread-item] [data-testid=sidebar-row-card]').evaluateAll(ns=>ns.map(n=>n.dataset.sidebarRow));
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
try{
 await page.goto(url+'?settings');await page.getByRole('heading',{name:'会话侧边栏',exact:true}).waitFor();
 await check('Native settings registration exposes six controls with existing defaults',async()=>{
  assert.equal(await page.getByRole('switch').count(),5);assert.equal(await page.getByRole('combobox',{name:'显示密度'}).inputValue(),'comfortable');
  assert.equal(await toggle('默认展开「已收起」').getAttribute('aria-checked'),'false');
  assert.equal(await toggle('会话详情提示').getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>window.inboxDemo.fixture.winner('settings.section').options.label()),'会话侧边栏');
 });
 await check('Compact density changes live, keeps metadata and survives reload',async()=>{
  const before=(await row('current').boundingBox()).height;
  await page.getByRole('combobox',{name:'显示密度'}).selectOption('compact');
  const after=(await row('current').boundingBox()).height;assert.ok(after<before);assert.match(await row('current').innerText(),/dsh-plugins/);
  await page.reload();await page.getByRole('heading',{name:'会话侧边栏',exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'显示密度'}).inputValue(),'compact');
  assert.equal((await row('current').boundingBox()).height,after);
  const long=await context.newPage();await long.goto(url);await long.locator('[data-sidebar-row=current]').waitFor();
  await long.evaluate(()=>{
    const f=window.inboxDemo.fixture,s=f.sessions.getSnapshot();
    const added=Array.from({length:70},(_,i)=>({...s.byId.current,id:'density-'+i,displayTitle:'紧凑列表 '+i,updatedAt:Date.now()-3600000-i*60000,retainedBy:{}}));
    f.sessions.set({...s,ids:[...s.ids,...added.map(r=>r.id)],byId:{...s.byId,...Object.fromEntries(added.map(r=>[r.id,r]))}});
  });
  await long.waitForFunction(()=>document.querySelectorAll('li[data-thread-item]').length>=60);
  await long.waitForFunction(()=>document.getAnimations().every(a=>a.effect?.target?.tagName!=='LI'));
  const sizes=await long.locator('[data-slot=scroll-area-viewport]').evaluate(view=>{
    const before=view.scrollHeight;view.querySelectorAll('li[data-thread-item]').forEach(n=>n.style.contentVisibility='visible');
    return [before,view.scrollHeight];
  });
  assert.ok(Math.abs(sizes[0]-sizes[1])<=2,JSON.stringify(sizes));await long.close();

 });
 await check('Default shelf preferences apply immediately while manual collapse remains temporary',async()=>{
  await toggle('默认展开「已收起」').click();await row('old').waitFor();
  await toggle('默认展开「稍后提醒」').click();await row('later').waitFor();
  await page.getByTestId('sidebar-settled-shelf-toggle').click();assert.equal(await row('old').count(),0);
  await page.reload();await row('old').waitFor();await row('later').waitFor();
 });
 await check('Session tooltips can be disabled without removing toolbar help',async()=>{
  await toggle('会话详情提示').click();await row('current').hover({position:{x:90,y:32}});await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-slot=tooltip-popup]:visible').count(),0);
  await page.getByRole('button',{name:'新建会话',exact:true}).hover();await page.locator('[data-slot=tooltip-popup][data-open]').waitFor();
  assert.equal(await page.locator('[data-slot=tooltip-popup][data-open]').innerText(),'新建会话');
  await toggle('会话详情提示').click();await row('current').hover({position:{x:90,y:32}});await page.locator('[data-slot=tooltip-popup][data-open]').waitFor();
  assert.match(await page.locator('[data-slot=tooltip-popup][data-open]').innerText(),/实现会话收件箱/);
  await page.evaluate(()=>window.inboxDemo.hooks.sidebarPreferences.set('sessionTooltips',false));
  await page.waitForFunction(()=>!document.querySelector('[data-slot=tooltip-popup]'));
  await page.evaluate(()=>window.inboxDemo.hooks.sidebarPreferences.set('sessionTooltips',true));
 });
 await check('Settled notice preference updates another window through the shared local setting',async()=>{
  const conversation=await context.newPage();await conversation.goto(url+'?conversation');
  await conversation.waitForFunction(()=>window.inboxDemo?.setNoticeSession);await conversation.evaluate(()=>window.inboxDemo.setNoticeSession('old'));
  await conversation.locator('.dsi-settled-notice').waitFor();await toggle('收起状态提示').click();
  await conversation.locator('.dsi-settled-notice').waitFor({state:'hidden'});
  await toggle('收起状态提示').click();await conversation.locator('.dsi-settled-notice').waitFor();await conversation.close();
 });
 await check('Motion preference stops list transitions; compact drag and Undo still work',async()=>{
  await toggle('列表过渡动效').click();assert.equal(await page.locator('.dsi-root').getAttribute('data-dsi-list-motion'),'false');
  await page.evaluate(()=>window.inboxDemo.actions.settle('result',[]));
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.tagName==='LI').length),0);
  const before=await primary();await row('working').dragTo(row('answer'),{targetPosition:{x:90,y:5}});
  await page.getByRole('button',{name:'撤销',exact:true}).waitFor();const after=await primary();assert.equal(after.indexOf('working')+1,after.indexOf('answer'));
  await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await primary(),before);
 });
 await check('Reset restores preferences while leaving settled sessions and order intact',async()=>{
  const before=await page.evaluate(()=>window.inboxDemo.hooks.inbox.getSnapshot().rows.map(r=>[r.id,r.section]));
  await page.getByRole('button',{name:'重置侧栏偏好',exact:true}).click();
  assert.equal(await page.getByRole('combobox',{name:'显示密度'}).inputValue(),'comfortable');
  assert.equal(await toggle('列表过渡动效').getAttribute('aria-checked'),'true');
  assert.equal(await toggle('默认展开「已收起」').getAttribute('aria-checked'),'false');
  assert.deepEqual(await page.evaluate(()=>window.inboxDemo.hooks.inbox.getSnapshot().rows.map(r=>[r.id,r.section])),before);
 });
 await check('Light, dark, narrow and English settings layouts remain readable',async()=>{
  await page.mouse.move(1040,840);await page.waitForFunction(()=>!document.querySelector('[data-slot=tooltip-popup]'));
  await page.screenshot({path:'outputs/sidebar-settings-light.png',fullPage:true});await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:'outputs/sidebar-settings-dark.png',fullPage:true});
  await page.setViewportSize({width:440,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'outputs/sidebar-settings-narrow.png',fullPage:true});
  await page.goto(url+'?settings&lang=en');await page.getByRole('heading',{name:'Session sidebar',exact:true}).waitFor();
  assert.equal(await page.getByRole('switch',{name:'Session detail tooltips',exact:true}).getAttribute('aria-checked'),'true');
 });
 assert.deepEqual(errors,[]);
} catch(error){console.log('ERRORS',errors);console.log(await page.locator('body').innerText());throw error;}
finally{const {version}=JSON.parse(await readFile('package.json','utf8'));await writeFile('outputs/sidebar-settings-checks.json',JSON.stringify({version,checks,errors,scope:'Built plugin with an isolated DSH slot/store fixture. Production uses native DSH Switch/Button; their fixture only follows the verified contracts.'},null,2)+'\n');await browser.close();}
