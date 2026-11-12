import { desktopProfilePath } from './desktop-profile.mjs';
// Project metadata integration checks for the flat, two-line conversation list.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'reduce'});page.setDefaultTimeout(6000);
const errors=[],checks=[],url=pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
page.on('pageerror',e=>errors.push(e.message));
const row=id=>page.locator('[data-sidebar-row="'+id+'"]');
const projectRows=id=>page.locator('[data-sidebar-row][data-project-key="directory:local-demo:'+id+'"]');
const ids=()=>page.locator('[data-sidebar-row]').evaluateAll(ns=>ns.map(n=>n.dataset.sidebarRow));
const search=()=>page.getByRole('combobox',{name:'搜索会话',exact:true});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
async function fresh(query=''){await page.goto(url+'?projects'+query);await page.evaluate(()=>localStorage.clear());await page.reload();await projectRows('TimeRing').first().waitFor();}
async function mutate(request){assert.equal(await page.evaluate(async request=>window.inboxDemo.fixture.winner('settings.section').inject().controller.mutate(request),request),true);}
async function selectProject(name){await page.getByRole('button',{name:'项目',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
const anchor=()=>page.locator('.dsi-dsh-scroll').evaluate(node=>{const rect=node.getBoundingClientRect(),row=[...node.querySelectorAll('[data-sidebar-row]')].find(n=>n.getBoundingClientRect().bottom>rect.top);return{id:row?.dataset.sidebarRow,offset:row?.getBoundingClientRect().top-rect.top,top:node.scrollTop};});
try{
  await fresh();
  await check('flat conversations repeat project identities above titles without project headers or indentation',async()=>{
    assert.equal(await page.locator('.dsi-dsh-project,.dsi-dsh-project-toggle').count(),0);
    assert.equal(await projectRows('TimeRing').count(),2);
    assert.deepEqual((await ids()).sort(),['answer','current','later','pin','result','working']);
    const geometry=await page.locator('[data-sidebar-row]').evaluateAll(ns=>ns.map(n=>{const row=n.getBoundingClientRect(),meta=n.querySelector('[data-row-metadata]').getBoundingClientRect(),title=n.querySelector('[data-row-title-line]').getBoundingClientRect();return{height:row.height,left:row.left,above:meta.bottom<=title.top,icon:!!n.querySelector('.dpm-project-icon'),time:!!n.querySelector('time')}}));
    assert.equal(new Set(geometry.map(g=>g.left)).size,1);assert.ok(geometry.every(g=>g.height===64&&g.above&&g.icon&&g.time));
  });
  await check('project settings update every matching conversation while project pinning preserves conversation order',async()=>{
    const before=await ids();await page.getByRole('button',{name:'设置',exact:true}).click();const dialog=page.getByRole('dialog',{name:'设置',exact:true});
    await dialog.getByRole('button',{name:/^TimeRing/}).click();await dialog.getByRole('textbox',{name:'项目名称',exact:true}).fill('Zeta 项目');await dialog.getByRole('button',{name:'保存',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-project-key="directory:local-demo:TimeRing"] .dsi-dsh-thread-project')].every(n=>n.textContent==='Zeta 项目'));
    await dialog.getByRole('button',{name:'选择图标',exact:true}).click();const picker=page.getByRole('dialog',{name:'项目图标',exact:true});
    await picker.getByRole('button',{name:'图标',exact:true}).click();await picker.getByRole('button',{name:'数据',exact:true}).click();await picker.getByRole('button',{name:'颜色 #14b8a6',exact:true}).click();await picker.getByRole('button',{name:'保存',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-project-key="directory:local-demo:TimeRing"] .dpm-project-icon')].every(n=>n.style.getPropertyValue('--dpm-icon-color')==='#14b8a6'));
    await dialog.getByRole('button',{name:'置顶项目',exact:true}).click();await dialog.getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual(await ids(),before);
  });
  await fresh();
  await check('project and message searches retain the flat layout and filters survive settled navigation',async()=>{
    await search().fill('消息关键字');await row('working').waitFor();assert.deepEqual(await ids(),['working']);await search().press('Escape');
    await selectProject('TimeRing');assert.equal(await projectRows('TimeRing').count(),2);assert.equal(await row('current').count(),0);
    await page.getByTestId('sidebar-settled-entry').click();await row('old').waitFor();await page.getByTestId('sidebar-settled-back').click();assert.equal(await projectRows('TimeRing').count(),2);assert.equal(await row('current').count(),0);
  });
  await fresh();
  await check('multi-checkout project filtering creates a draft in the chosen checkout without grouping the list',async()=>{
    await page.evaluate(()=>{const f=window.inboxDemo.fixture,w=f.workspaces.getSnapshot();f.workspaces.set({...w,items:[...w.items,{workspaceId:'worktree',title:'TimeRing 工作树',path:'/example/worktree',sessionIds:[]}]});});
    await page.waitForFunction(()=>window.inboxDemo.hooks.projectCatalog.getSnapshot().projects.some(p=>p.checkouts.some(c=>c.id==='worktree')));
    await mutate({op:'assign',checkoutKey:'local-demo:worktree',destination:'directory:local-demo:TimeRing'});
    await page.waitForFunction(()=>window.inboxDemo.hooks.projectCatalog.getSnapshot().projects.find(p=>p.key==='directory:local-demo:TimeRing')?.checkouts.length===2);
    await selectProject('TimeRing');await page.getByRole('button',{name:'在 TimeRing 中新建会话',exact:true}).click();await page.getByRole('menuitem',{name:'TimeRing 工作树',exact:true}).click();await page.locator('[data-section=draft]').waitFor();
    assert.equal(await page.locator('[data-section=draft]').getAttribute('data-project-key'),'directory:local-demo:TimeRing');assert.equal(await page.evaluate(()=>window.inboxDemo.fixture.calls.some(c=>c[0]==='start'&&c[1]==='worktree')),true);
  });
  await fresh();
  await check('archived project filtering keeps working conversations visible and never creates empty project headers',async()=>{
    await page.evaluate(()=>{const f=window.inboxDemo.fixture,w=f.workspaces.getSnapshot();f.workspaces.set({...w,items:[...w.items,{workspaceId:'empty',title:'空项目',path:'/example/empty',sessionIds:[]}]});});
    await page.waitForFunction(()=>window.inboxDemo.hooks.projectCatalog.getSnapshot().projects.some(p=>p.key==='directory:local-demo:empty'));
    await mutate({op:'organize',projectKey:'directory:local-demo:empty',archived:true});await mutate({op:'organize',projectKey:'directory:local-demo:LiQun',archived:true});await row('working').waitFor();
    await page.getByRole('button',{name:'项目',exact:true}).click();assert.equal(await page.getByRole('menuitem',{name:'空项目',exact:true}).count(),0);await page.getByRole('menuitem',{name:'显示已归档项目',exact:true}).click();await selectProject('空项目');await page.getByText('暂无会话',{exact:true}).waitFor();assert.equal(await page.locator('[data-sidebar-row]').count(),0);
  });
  await fresh();
  await check('cross-project visual reordering leaves workspace membership intact and can be undone',async()=>{
    const before=await ids(),memberships=await page.evaluate(()=>window.inboxDemo.fixture.workspaces.getSnapshot().items.map(w=>[w.workspaceId,w.sessionIds]));
    await row('current').dragTo(row('answer'),{targetPosition:{x:90,y:4}});await page.getByRole('button',{name:'撤销',exact:true}).waitFor();assert.notDeepEqual(await ids(),before);
    assert.deepEqual(await page.evaluate(()=>window.inboxDemo.fixture.workspaces.getSnapshot().items.map(w=>[w.workspaceId,w.sessionIds])),memberships);
    await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await ids(),before);
  });
  await fresh('&active=95&history=22');
  await check('metadata changes and settled return preserve the visible conversation and offset',async()=>{
    await page.locator('.dsi-dsh-scroll').evaluate(async n=>{n.scrollTop=600;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});const before=await anchor();
    await mutate({op:'rename',projectKey:'directory:local-demo:TimeRing',name:'TimeRing 项目'});const after=await anchor();assert.equal(after.id,before.id);assert.ok(Math.abs(after.offset-before.offset)<=1);
    await page.getByTestId('sidebar-settled-entry').click();await row('old').waitFor();await page.getByTestId('sidebar-settled-back').click();const returned=await anchor();assert.equal(returned.id,before.id);assert.ok(Math.abs(returned.offset-before.offset)<=1);
  });
  const polishSource=await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'),'utf8'),polish=JSON.parse(polishSource.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);await page.setViewportSize({width:320,height:850});
  for(const appearance of ['light','dark']){await page.emulateMedia({colorScheme:appearance});await fresh('&history=22');await page.addStyleTag({content:polish});await page.mouse.move(319,840);
    await check('native '+appearance+' selected row has one border and keeps both text lines stable on hover',async()=>{const before=await row('current').locator('[data-row-title-line]').boundingBox();await row('current').hover();const after=await row('current').locator('[data-row-title-line]').boundingBox();assert.deepEqual(after,before);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await row('current').evaluate(n=>getComputedStyle(n).borderTopWidth),'1px');});
    await page.mouse.move(319,840);await page.screenshot({path:'outputs/thread-list-'+version+'-'+appearance+'.png'});await page.getByTestId('sidebar-settled-entry').click();await row('old').waitFor();await page.mouse.move(319,840);await page.screenshot({path:'outputs/thread-list-'+version+'-settled-'+appearance+'.png'});
  }
  await page.setViewportSize({width:280,height:640});await fresh('&lang=en');
  await check('long Unicode project labels remain single-line and preserve time and conversation actions',async()=>{
    await mutate({op:'rename',projectKey:'directory:local-demo:TimeRing',name:'项目🌿非常长的项目名称'.repeat(5)});await mutate({op:'icon',projectKey:'directory:local-demo:TimeRing',icon:{kind:'emoji',value:'🌿',color:'#22c55e'}});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await row('pin').hover();const action=await row('pin').getByRole('button',{name:'Session actions',exact:true}).boundingBox();assert.ok(action.x+action.width<=280);assert.equal(await row('pin').evaluate(n=>n.getBoundingClientRect().height),64);
  });
  assert.deepEqual(errors,[]);
}catch(error){await mkdir('temp/thread-list',{recursive:true});await page.screenshot({path:'temp/thread-list/failure.png'});throw error;
}finally{await browser.close();await writeFile('outputs/thread-list-'+version+'-checks.json',JSON.stringify({version,checksPassed:checks.length,checks,errors,scope:'Actual project-manager controller and DSH React/primitives/theme with fixture sessions/RPC in background Chrome. No native-window interaction.'},null,2)+'\n');}
