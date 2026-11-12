import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const profile=process.env.DSH_PROFILE_DIR||desktopProfilePath('');
const native=await readFile(profile+'/node_modules/dsh-polish/client.js','utf8');
const nativePackage=JSON.parse(await readFile(profile+'/node_modules/dsh-polish/package.json','utf8'));
const match=native.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/);
assert.ok(match,'Read the installed DSH tooltip style, rather than a second handwritten fixture');
const stylesheet=JSON.parse(match[1]);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[],surfaces=[];
const properties=['boxSizing','padding','borderTopWidth','borderTopStyle','borderTopColor','borderRadius','backgroundColor','color','boxShadow','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','whiteSpace','overflowWrap','textShadow'];
const popupSelector='[data-slot=tooltip-popup]';
const url=pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href;
const check=async(name,action)=>{await action();checks.push(name);console.log('PASS '+name);};
try {
 for(const theme of ['light','dark']) {
  const p=await browser.newPage({viewport:{width:1000,height:850},colorScheme:theme,reducedMotion:'reduce'});
  p.setDefaultTimeout(5000);p.on('pageerror',error=>errors.push(error.message));
  await p.goto(url);await p.locator('[data-sidebar-row=current]').waitFor();await p.addStyleTag({content:stylesheet});
  await check('Installed DSH tooltip surface parity in '+theme,async()=>{
   await p.locator('[data-sidebar-row=current]').hover({position:{x:90,y:43}});await p.locator(popupSelector).waitFor();
   await p.evaluate(()=>{
    const popup=document.querySelector('[data-slot=tooltip-popup]'),rect=popup.getBoundingClientRect();
    const reference=document.createElement('div');reference.id='native-tooltip-reference';reference.setAttribute('role','tooltip');
    reference.innerHTML='<div>dsh-plugins · 实现会话收件箱</div><div style="margin-top:4px;color:var(--dsw-alias-label-secondary)">'+popup.querySelector('[data-slot=tooltip-viewport]').lastElementChild.textContent+'</div>';
    reference.style.cssText=`position:fixed;pointer-events:none;left:${rect.left}px;top:${rect.bottom+20}px;z-index:10000`;
    document.body.append(reference);
   });
   const result=await p.evaluate(({properties,popupSelector})=>{
    const popup=document.querySelector(popupSelector),native=document.querySelector('#native-tooltip-reference');
    const read=node=>Object.fromEntries(properties.map(name=>[name,getComputedStyle(node)[name]]));
    return {plugin:read(popup),native:read(native),innerPadding:getComputedStyle(popup.querySelector('[data-slot=tooltip-viewport]')).padding,
      rim:getComputedStyle(popup,'::before').content,bounds:popup.getBoundingClientRect().toJSON()};
   },{properties,popupSelector});
   assert.deepEqual(result.plugin,result.native);assert.equal(result.innerPadding,'0px');assert.equal(result.rim,'none');
   surfaces.push({theme,...result});
   const bounds=await p.locator(popupSelector).boundingBox(),reference=await p.locator('#native-tooltip-reference').boundingBox();
   await p.screenshot({path:'outputs/tooltip-native-'+theme+'.png',clip:{x:bounds.x-12,y:bounds.y-12,width:Math.max(bounds.width,reference.width)+24,height:reference.y+reference.height-bounds.y+24}});
   await p.locator('#native-tooltip-reference').evaluate(n=>n.remove());
  });
  await check('Long tooltip wraps within the window in '+theme,async()=>{
   await p.mouse.move(990,10);await p.locator(popupSelector).waitFor({state:'hidden'});
   await p.evaluate(()=>{
    const f=window.inboxDemo.fixture,s=f.sessions.getSnapshot();f.sessions.set({...s,byId:{...s.byId,current:{...s.byId.current,displayTitle:'会话名称很长 '+ 'LongUnbrokenSessionTitle'.repeat(30)+' 中文和 emoji 🌙'}}});
   });
   await p.locator('[data-sidebar-row=current]').hover({position:{x:90,y:43}});await p.locator(popupSelector).waitFor();
   const box=await p.locator(popupSelector).boundingBox();assert.ok(box.width<=320&&box.x>=0&&box.x+box.width<=1000);
   assert.equal(await p.locator(popupSelector).evaluate(n=>n.scrollWidth<=n.clientWidth),true);
  });
  await check('Keyboard tooltip and forced colors retain readable surfaces in '+theme,async()=>{
   await p.mouse.move(990,10);await p.locator(popupSelector).waitFor({state:'hidden'});
   await p.getByRole('button',{name:'新建会话',exact:true}).focus();await p.locator(popupSelector).waitFor();
   assert.equal(await p.locator(popupSelector).innerText(),'新建会话');
   await p.emulateMedia({forcedColors:'active'});
   assert.equal(await p.locator(popupSelector).evaluate(n=>getComputedStyle(n).boxShadow),'none');
  });
  await p.close();
 }
 assert.deepEqual(errors,[]);
}finally{
 const {version}=JSON.parse(await readFile('package.json','utf8'));
 await writeFile('outputs/tooltip-native-checks.json',JSON.stringify({version,reference:{package:nativePackage.name,version:nativePackage.version,clientSha256:createHash('sha256').update(native).digest('hex')},checks,errors,surfaces,scope:'Isolated headless Chrome, built sidebar and installed DSH tooltip CSS; native window acceptance remains with the user'},null,2)+'\n');
 await browser.close();
}
