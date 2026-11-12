import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { withInstalledHost } from './installed-host.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const native = await withInstalledHost(host => {
  const base='dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/';
  return host.read(base+host.list(base).find(name=>/^index-.*\.css$/.test(name)));
});
assert.ok(native.includes('background:var(--dsw-specific-menu)'));
const polish = await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'), 'utf8');
const polishCSS = JSON.parse(polish.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport:{width:1000,height:850}, colorScheme:'light', reducedMotion:'reduce' });
page.setDefaultTimeout(5000);
const checks=[], errors=[], surfaces=[];
page.on('pageerror', error=>errors.push(error.message));
const details=()=>page.locator('.dsi-dsh-details');
const url=pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+0.05)/(values[1]+0.05);};
async function inspect(){
  const result=await details().evaluate(node=>{
    const card=node.parentElement,probe=document.createElement('span');
    probe.style.cssText='position:fixed;visibility:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu)';document.body.append(probe);
    const reference={title:getComputedStyle(probe).color,background:getComputedStyle(probe).backgroundColor};
    probe.style.background='var(--dsw-alias-bg-base)';reference.canvas=getComputedStyle(probe).backgroundColor;
    probe.style.color='var(--dsw-alias-label-secondary)';reference.body=getComputedStyle(probe).color;probe.remove();
    return{title:getComputedStyle(node.querySelector('strong')).color,body:getComputedStyle(node).color,
      spans:[...node.querySelectorAll('.dsi-dsh-detail-line>span:last-child')].map(n=>getComputedStyle(n).color),background:getComputedStyle(card).backgroundColor,
      reference,titleWeight:getComputedStyle(node.querySelector('strong')).fontWeight,radius:getComputedStyle(card).borderRadius,shadow:getComputedStyle(card).boxShadow,
      portal:!node.closest('.dsi-dsh'),box:card.getBoundingClientRect().toJSON(),text:node.innerText,lines:node.children.length};
  });
  const rgba=result.background.match(/[\d.]+/g).map(Number),canvas=result.reference.canvas.match(/[\d.]+/g).map(Number),alpha=rgba[3]??1;
  result.effectiveBackground='rgb('+rgba.slice(0,3).map((n,i)=>Math.round(n*alpha+canvas[i]*(1-alpha))).join(', ')+')';
  result.titleContrast=contrast(result.title,result.effectiveBackground);result.bodyContrast=contrast(result.body,result.effectiveBackground);
  assert.equal(result.title,result.reference.title);assert.equal(result.body,result.reference.body);assert.equal(result.background,result.reference.background);
  assert.ok(result.spans.every(color=>color===result.body));assert.equal(result.portal,true);
  assert.equal(result.titleWeight,'600');assert.equal(result.lines,3);
  assert.equal(result.radius,'12px');assert.notEqual(result.shadow,'none');
  assert.ok(result.titleContrast>=4.5&&result.bodyContrast>=4.5);return result;
}
try{
  for(const withPolish of [false,true])for(const appearance of ['light','dark']){
    await check('Compact details follow the '+appearance+' DSH menu palette'+(withPolish?' with Polish':''),async()=>{
      await page.emulateMedia({colorScheme:appearance});await page.goto(url);await page.locator('[data-sidebar-row=current]').waitFor();
      if(withPolish)await page.addStyleTag({content:polishCSS});
      await page.locator('[data-sidebar-row=current]').hover();await details().waitFor({state:'visible'});
      const surface=await inspect();surfaces.push({appearance,withPolish,...surface});
      assert.ok(surface.box.height<=100&&surface.box.width<=244);
      assert.ok((appearance==='light'?luminance(surface.background)>0.7:luminance(surface.background)<0.15));
      assert.equal(await details().locator('.dsi-dsh-detail-line').first().getAttribute('title'),'/example/dsh-plugins');
      assert.equal(surface.text.includes('/example/'),false);assert.match(surface.text,/分钟前/);
      if(withPolish){const r=surface.box;await page.screenshot({path:'outputs/session-details-'+version+'-'+appearance+'.png',clip:{x:r.x-12,y:r.y-12,width:r.width+24,height:r.height+24}});}
    });
  }
  await check('An open card follows a theme change without navigating the session',async()=>{
    const before=await page.evaluate(()=>window.inboxDemo.fixture.calls.filter(call=>call[0]==='open').length);
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.body.hasAttribute('data-ds-dark-theme'));
    const light=await inspect();await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.body.hasAttribute('data-ds-dark-theme'));
    const dark=await inspect();assert.notEqual(light.background,dark.background);
    assert.equal(await page.evaluate(()=>window.inboxDemo.fixture.calls.filter(call=>call[0]==='open').length),before);
  });
  await check('Long content stays compact and the host keeps the card within a narrow window',async()=>{
    await page.mouse.move(900,700);
    await page.evaluate(()=>{const source=window.inboxDemo.fixture.sessions,s=source.getSnapshot();source.set({...s,byId:{...s.byId,current:{...s.byId.current,displayTitle:'很长的会话标题'.repeat(12),cwd:'/example/'+'long-directory/'.repeat(15)}}});});
    await page.setViewportSize({width:360,height:850});await page.locator('[data-sidebar-row=current]').hover();await details().waitFor({state:'visible'});
    const surface=await inspect();
    assert.equal(await details().evaluate(n=>n.scrollWidth>n.clientWidth),false);
    assert.ok(surface.box.left>=0&&surface.box.right<=360&&surface.box.bottom<=850);
    assert.ok(await details().locator('strong').evaluate(n=>n.clientHeight<=40));
    assert.equal(await details().locator('.dsi-dsh-detail-line').first().getAttribute('title'),'/example/'+'long-directory/'.repeat(15));
    surfaces.push({narrow:true,...surface});
    await page.mouse.move(350,800);await page.setViewportSize({width:1000,height:850});
    await page.locator('[data-sidebar-row=current]').hover();await details().waitFor({state:'visible'});
    assert.ok((await details().evaluate(n=>n.parentElement.getBoundingClientRect().left))>=320);
  });
  await check('The metadata line prioritizes running, reply and unread-result states',async()=>{
    for(const [id,status] of [['working','工作中'],['answer','待回复'],['result','未读结果']]){
      await page.locator('[data-sidebar-row='+id+']').hover();
      await page.waitForFunction(expected=>document.querySelector('.dsi-dsh-details .dsi-dsh-detail-line:last-child')?.textContent===expected,status);
      assert.equal(await details().locator('.dsi-dsh-detail-line').count(),2);
    }
  });
  await check('Disabling session details keeps the hover card closed',async()=>{
    await page.mouse.move(900,800);await details().waitFor({state:'hidden'});
    await page.evaluate(()=>window.inboxDemo.hooks.sidebarPreferences.set('sessionTooltips',false));
    await page.locator('[data-sidebar-row=current]').hover();await page.waitForTimeout(1000);
    assert.equal(await details().isVisible(),false);
  });
  await check('English details retain the same compact structure and a single activity time',async()=>{
    await page.goto(url+'?lang=en');await page.locator('[data-sidebar-row=current]').waitFor();
    await page.evaluate(()=>window.inboxDemo.hooks.sidebarPreferences.set('sessionTooltips',true));
    await page.locator('[data-sidebar-row=current]').hover();await details().waitFor({state:'visible'});
    const surface=await inspect();assert.match(surface.text,/m ago/);assert.equal(surface.text.includes('/example/'),false);surfaces.push({lang:'en',...surface});
  });
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();await writeFile('outputs/session-details-'+version+'-checks.json',JSON.stringify({version,checks,errors,surfaces,
    nativeReference:{surface:'--dsw-specific-menu',title:'--dsw-alias-label-primary',body:'--dsw-alias-label-secondary',frontendCssSha256:createHash('sha256').update(native).digest('hex')},
    scope:'Actual installed DSH HoverCard with native inline placement on narrow windows, DSH menu palette, built sidebar, fixture sessions and installed Polish CSS in headless Chrome. Native-window acceptance remains with the user.'},null,2)+'\n');
}
