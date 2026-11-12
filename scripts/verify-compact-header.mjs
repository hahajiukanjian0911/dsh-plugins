import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport:{width:360,height:850}, colorScheme:'light', reducedMotion:'reduce' });
page.setDefaultTimeout(5000);
const checks=[], errors=[], geometry=[];
page.on('pageerror', error=>errors.push(error.message));
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const newButton=()=>page.getByRole('button',{name:'新建会话',exact:true});
const projectsButton=()=>page.getByRole('button',{name:'项目',exact:true});
const brandRow=()=>page.locator('[data-window-drag]:has([data-slot="sidebar.brand.name"])');
async function dragExclusion(){
  const result=await page.locator('[data-sidebar-toggle]').evaluate(toggle=>{
    const r=toggle.getBoundingClientRect();
    return {toggle:r.toJSON(),appRegion:getComputedStyle(toggle).getPropertyValue('-webkit-app-region'),regions:[...document.querySelectorAll('[data-window-drag]')].filter(n=>!n.contains(toggle)).map(n=>{
      const box=n.getBoundingClientRect();
      return {box:box.toJSON(),appRegion:getComputedStyle(n).getPropertyValue('-webkit-app-region'),overlapsToggle:r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top};
    })};
  });
  assert.equal(result.appRegion,'no-drag');
  assert.ok(result.regions.every(region=>region.appRegion!=='drag'||!region.overlapsToggle),JSON.stringify(result));
  return result;
}
async function compactGeometry(){
  const action=await newButton().boundingBox(),projects=await projectsButton().boundingBox(),search=await page.getByRole('combobox',{name:'搜索会话'}).boundingBox();
  const toggle=await page.locator('[data-sidebar-toggle]').boundingBox();
  for(const control of [action,projects,toggle])assert.deepEqual([control.width,control.height],[28,28]);
  assert.ok(Math.abs(action.y-projects.y)<1&&Math.abs(action.y-search.y)<1);
  assert.deepEqual([toggle.x,toggle.y],[88,11]);assert.ok(projects.x+projects.width<=action.x-8);
  assert.ok(search.x+search.width<=projects.x-4&&search.width>100&&search.y<50);
  assert.equal(await brandRow().isVisible(),true);
  const logo=await page.locator('[data-slot="sidebar.brand.name"] svg').boundingBox();
  assert.ok(logo.width>90&&logo.height<=18&&logo.x>toggle.x+toggle.width);
  assert.ok(logo.x+logo.width<=Math.min(320,page.viewportSize().width)-8);
  assert.ok(Math.abs(logo.y+logo.height/2-toggle.y-toggle.height/2)<1);
  assert.ok(await page.locator('[data-sidebar-toggle]').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  await dragExclusion();
  assert.equal(await newButton().innerText(),'');return{action,projects,search,toggle,logo};
}
try{
  await page.goto(pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href);await page.locator('.dsi-root').waitFor();
  await check('The header has a window row and one aligned Search, Projects and New Session row',async()=>{
    geometry.push(await compactGeometry());assert.equal(await newButton().getAttribute('title'),'新建会话');
    assert.equal(await page.locator('[data-window-drag]:not(:has([data-slot="sidebar.brand.name"]))').evaluate(n=>n.offsetHeight),40);
    assert.equal(await page.getByRole('button',{name:'添加项目',exact:true}).count(),0);
  });
  await check('No separate Electron window-drag rectangle covers the sidebar toggle',async()=>{
    geometry.push({dragExclusion:await dragExclusion()});
  });
  await check('Click and Enter keep the native new-session operation and existing session data',async()=>{
    const ids=await page.evaluate(()=>window.inboxDemo.fixture.sessions.getSnapshot().ids);
    await newButton().click();await page.locator('[data-sidebar-row][data-section=draft]').waitFor();
    await newButton().focus();await newButton().press('Enter');
    assert.equal(await page.evaluate(()=>window.inboxDemo.fixture.calls.filter(call=>call[0]==='start').length),2);
    assert.ok(await page.evaluate(ids=>ids.every(id=>window.inboxDemo.fixture.sessions.getSnapshot().byId[id]),ids));
  });
  await check('Keyboard metadata, icon masking and the window-drag exclusion remain correct',async()=>{
    assert.equal(await newButton().getAttribute('aria-keyshortcuts'),'Meta+N');
    await newButton().hover();assert.equal(await newButton().locator(':scope > span').first().evaluate(n=>getComputedStyle(n).maskImage),'none');
    assert.ok(await newButton().evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    assert.match(await readFile('src/native/compact-header.css','utf8'),/-webkit-app-region:no-drag/);
  });
  await check('Projects combines filtering and Add project while retaining permission checks',async()=>{
    await projectsButton().click();await page.getByRole('menuitem',{name:'LiQun',exact:true}).click();
    assert.equal(await projectsButton().getAttribute('data-active'),'true');
    assert.ok(await page.locator('[data-sidebar-row]:not([data-section=draft])').evaluateAll(nodes=>nodes.every(n=>['answer','working'].includes(n.dataset.sidebarRow))));
    await page.evaluate(()=>{window.inboxDemo.pickerCalls=0;window.inboxDemo.fixture.ctx.uiWorkspace.pickDirectory=async()=>{window.inboxDemo.pickerCalls++;return null;};});
    await projectsButton().click();await page.getByRole('menuitem',{name:'添加项目',exact:true}).click();
    await page.waitForFunction(()=>window.inboxDemo.pickerCalls===1&&!window.inboxDemo.hooks.inbox.getSnapshot().busy.has('workspace'));
    await page.evaluate(()=>{const d=window.inboxDemo;d.denied.add('global:workspace/create');d.fixture.sessions.set({...d.fixture.sessions.getSnapshot()});});
    await projectsButton().click();assert.equal(await page.getByRole('menuitem',{name:'添加项目',exact:true}).isDisabled(),true);
    await page.getByRole('menuitem',{name:'所有项目',exact:true}).click();
    await page.evaluate(()=>{const d=window.inboxDemo;d.denied.delete('global:workspace/create');d.fixture.sessions.set({...d.fixture.sessions.getSnapshot()});});
  });
  await check('Light and dark appearances remain compact with the installed DSH Polish styles',async()=>{
    const source=await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'),'utf8');
    await page.addStyleTag({content:JSON.parse(source.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1])});
    for(const appearance of ['light','dark']){
      await page.emulateMedia({colorScheme:appearance});await page.waitForFunction(dark=>document.body.hasAttribute('data-ds-dark-theme')===dark,appearance==='dark');
      geometry.push({appearance,...await compactGeometry()});await page.mouse.move(350,600);
      await page.screenshot({path:'outputs/compact-header-'+version+'-'+appearance+'.png',clip:{x:0,y:0,width:320,height:76}});
    }
  });
  await check('A narrow sidebar keeps the two-row layout usable without overlap',async()=>{
    await page.setViewportSize({width:260,height:640});await page.reload();await page.locator('.dsi-root').waitFor();await compactGeometry();
    assert.equal(await page.locator('html').evaluate(n=>n.scrollWidth>innerWidth),false);
  });
  await check('The native rail, footer icons and direct Settings entry are preserved',async()=>{
    await page.evaluate(()=>window.inboxDemo.setWide(false));await page.locator('.dsi-rail').waitFor();
    assert.equal(await newButton().isVisible(),false);
    await projectsButton().click();await page.locator('.dsi-dsh:not(.dsi-rail)').waitFor();
    await page.getByRole('menuitem',{name:'添加项目',exact:true}).waitFor();await page.keyboard.press('Escape');await compactGeometry();
    const nav=page.locator('[data-slot=sidebar] > div > nav');assert.equal(await nav.getByRole('button').count(),2);
    await page.locator('[data-slot="settings.launcher"] button[aria-haspopup=dialog]').click();await page.getByRole('dialog',{name:'设置',exact:true}).waitFor();
    assert.equal(await page.getByRole('menu').count(),0);
  });
  await check('The actual macOS frame keeps the toggle in place and omits New Session when closed',async()=>{
    await page.setViewportSize({width:1200,height:850});
    await page.goto(pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href+'?frame');
    await page.locator('.dsi-dsh:not(.dsi-rail)').waitFor();
    const source=await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'),'utf8');
    await page.addStyleTag({content:JSON.parse(source.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1])});
    for(const fullscreen of [false,true]){
      await page.evaluate(value=>document.documentElement.toggleAttribute('data-fullscreen',value),fullscreen);
      for(const appearance of ['light','dark']){
        await page.emulateMedia({colorScheme:appearance,reducedMotion:'no-preference'});
        await page.waitForFunction(dark=>document.body.hasAttribute('data-ds-dark-theme')===dark,appearance==='dark');
        const expanded=await page.locator('[data-sidebar-toggle]').boundingBox();
        assert.deepEqual(expanded,{x:fullscreen?12:88,y:11,width:28,height:28});
        await dragExclusion();
        for(let cycle=0;cycle<2;cycle++){
          await page.locator('[data-sidebar-toggle]').click();
          const opener=page.locator('[data-sidebar-opener]');await opener.waitFor();
          assert.deepEqual(await opener.boundingBox(),expanded);
          assert.equal(await page.locator('[data-shell-leading]').getByRole('button').count(),1);
          assert.equal(await newButton().isVisible(),false);
          await opener.focus();await opener.press('Tab');
          assert.notEqual(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'新建会话');
          if(cycle===0&&!fullscreen)await page.screenshot({path:'outputs/sidebar-toggle-'+version+'-closed-'+appearance+'.png',clip:{x:0,y:0,width:320,height:76}});
          await opener.click();
          await page.locator('[data-shell-leading]').waitFor({state:'detached'});
          await newButton().waitFor();
          assert.deepEqual(await page.locator('[data-sidebar-toggle]').boundingBox(),expanded);
        }
        geometry.push({frame:true,fullscreen,appearance,toggle:expanded});
        if(!fullscreen)await page.screenshot({path:'outputs/sidebar-toggle-'+version+'-expanded-'+appearance+'.png',clip:{x:0,y:0,width:320,height:76}});
      }
    }
  });
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();await writeFile('outputs/compact-header-checks.json',JSON.stringify({version,checks,errors,geometry,
    scope:'Actual installed DSH AppFrame, HeaderLeadingControls, SidebarRoot, primitives and Polish CSS with fixture sessions and directory picker in headless Chrome. Toggle geometry checked across eight close/open cycles including fullscreen and both appearances. Native traffic lights and Cmd+N dispatch are not foreground-verified.'},null,2)+'\n');
}
