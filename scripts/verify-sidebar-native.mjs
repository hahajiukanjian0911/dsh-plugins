import { desktopProfilePath } from './desktop-profile.mjs';
import assert from 'node:assert/strict';
import { open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
const app='/Applications/DeepSeek Harness.app';
const file=await open(app+'/Contents/Resources/app.asar');
const header=Buffer.alloc(16);await file.read(header,0,16,0);
const bytes=Buffer.alloc(header.readUInt32LE(12));await file.read(bytes,0,bytes.length,16);
let entry={files:JSON.parse(bytes.toString()).files};
for(const part of 'dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'.split('/'))entry=entry.files[part];
const contents=Buffer.alloc(entry.size);await file.read(contents,0,contents.length,8+header.readUInt32LE(4)+Number(entry.offset));await file.close();
const theme=JSON.parse([...contents.toString().matchAll(/"(?:[^"\\]|\\.)*"/g)].find(m=>m[0].length>10000&&m[0].includes('--dsw-specific-sidebar-fill'))[0]);
const polishClient=await readFile(desktopProfilePath('node_modules/dsh-polish/client.js'),'utf8');
const polishPackage=JSON.parse(await readFile(desktopProfilePath('node_modules/dsh-polish/package.json'),'utf8'));
const polishCSS=JSON.parse(polishClient.match(/const stylesheet =\s*(?:\/\*.*?\*\/\s*)?("(?:[^"\\]|\\.)*");/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[],surfaces=[];
const check=async(name,action)=>{await action();checks.push(name);console.log('PASS '+name);};
try{
 for(const appearance of ['light','dark']){
  const p=await browser.newPage({viewport:{width:360,height:850},colorScheme:appearance,reducedMotion:'reduce'});p.setDefaultTimeout(6000);
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(resolve('temp/design/inbox-sidebar/index.html')).href);await p.locator('[data-sidebar-row=current]').waitFor();
  await p.addStyleTag({content:theme});
  await p.addStyleTag({content:polishCSS});
  await p.evaluate(dark=>document.body.toggleAttribute('data-ds-dark-theme',dark),appearance==='dark');
  await check('DSH theme owns the surface, selection, typography and folder icons in '+appearance,async()=>{
   const values=await p.evaluate(()=>{
    const root=document.querySelector('.dsi-root'),shell=root.closest('[data-slot=sidebar]').firstElementChild;
    const row=root.querySelector('[data-sidebar-row=current]'),title=row.querySelector('[data-row-title]');
    const readColor=(name)=>{const n=document.createElement('i');n.style.color='var('+name+')';document.body.append(n);const color=getComputedStyle(n).color;n.remove();return color;};
    const style=getComputedStyle(row),top=getComputedStyle(shell,'::before'),bottom=getComputedStyle(shell,'::after');
    return{surface:getComputedStyle(shell).backgroundColor,nativeSurface:readColor('--dsw-specific-sidebar-fill'),
      text:getComputedStyle(root).color,nativeText:readColor('--dsw-alias-label-primary'),
      selection:style.backgroundColor,nativeSelection:readColor('--dsw-alias-interactive-bg-hover'),
      border:style.borderTopWidth,shadow:style.boxShadow,font:getComputedStyle(title).fontWeight,
      rowHeight:row.getBoundingClientRect().height,topFill:top.backgroundColor,bottomFill:bottom.backgroundColor,
      folder:row.querySelector('svg[data-icon^="dsw-icon-folder-close-"]')!==null};
   });
   assert.equal(values.surface,values.nativeSurface);assert.equal(values.text,values.nativeText);assert.equal(values.selection,values.nativeSelection);
   assert.equal(values.border,'0px');assert.equal(values.shadow,'none');assert.equal(values.font,'400');assert.equal(values.rowHeight,58);assert.equal(values.topFill,values.bottomFill);assert.equal(values.folder,true);
   surfaces.push({appearance,...values});
  });
  await p.getByTestId('sidebar-settled-shelf-toggle').click();await p.locator('[data-sidebar-row=old]').waitFor();
  await check('Settled single-line rows and left chevron follow the accepted native layout in '+appearance,async()=>{
   assert.equal((await p.locator('[data-sidebar-row=old]').boundingBox()).height,30);
   const heading=p.getByTestId('sidebar-settled-shelf-toggle'),label=await heading.locator(':scope>span').first().boundingBox(),icon=await heading.locator(':scope>svg').boundingBox();assert.ok(icon.x<label.x);
   assert.equal(await p.getByRole('button',{name:'工作中',exact:true}).count(),0);
   assert.equal(await p.locator('[data-slot=scroll-area-viewport]').evaluate(n=>getComputedStyle(n).scrollbarWidth),'none');
  });
  await check('Inline rename and menu geometry use DSH values in '+appearance,async()=>{
   await p.locator('[data-sidebar-row=current]').dblclick();
   const editor=p.getByRole('textbox',{name:'重命名'});await editor.waitFor();
   assert.equal(await editor.evaluate(n=>getComputedStyle(n).fontWeight),'400');await editor.press('Escape');
   await p.getByRole('button',{name:'按项目筛选'}).click();const menu=p.locator('[data-slot=menu-popup][data-open]');await menu.waitFor();
   const item=p.getByRole('menuitemradio',{name:'TimeRing',exact:true});
   assert.deepEqual(await item.evaluate(n=>[getComputedStyle(n).fontSize,getComputedStyle(n).lineHeight,getComputedStyle(n).minHeight]),['13px','20px','30px']);
   await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  });
  await p.getByRole('button',{name:'新建会话',exact:true}).click();
  await p.locator('[data-sidebar-row][data-section=draft]').waitFor();
  await check('Unsent draft has its own place without an amber surface or separators in '+appearance,async()=>{
   const draft=p.locator('[data-sidebar-row][data-section=draft]');
   // A newly opened DSH draft is current, so it shares native selection paint.
   assert.equal(await draft.evaluate(n=>getComputedStyle(n).backgroundColor),surfaces.at(-1).nativeSelection);
   assert.equal(await draft.evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
   assert.equal(await draft.locator('svg[data-icon=dsw-icon-new-chat-outline-regular]').count(),1);
  });
  await p.mouse.move(359,840);await p.waitForFunction(()=>!document.querySelector('[data-slot=tooltip-popup]'));
  await p.screenshot({path:'outputs/sidebar-native-'+appearance+'.png',fullPage:true});
  await check('Custom native palette and host font propagate without changing OS theme in '+appearance,async()=>{
   await p.evaluate(()=>{document.body.style.setProperty('--dsw-specific-sidebar-fill','rgb(226, 235, 228)');document.body.style.setProperty('--dsw-alias-label-primary','rgb(25, 44, 32)');document.body.style.setProperty('--dsw-font-family','Georgia, serif');});
   const result=await p.locator('.dsi-root').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).fontFamily,getComputedStyle(n.closest('[data-slot=sidebar]').firstElementChild).backgroundColor]);
   assert.deepEqual(result,['rgb(25, 44, 32)','Georgia, serif','rgb(226, 235, 228)']);
  });
  await p.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();const{version}=JSON.parse(await readFile('package.json','utf8'));await writeFile('outputs/sidebar-native-checks.json',JSON.stringify({version,checks,errors,surfaces,polish:{version:polishPackage.version,clientSha256:createHash('sha256').update(polishClient).digest('hex')},scope:'Built sidebar in an isolated slot/store fixture, with installed native DSH theme, installed DSH Polish CSS and icon contract fixtures. Real DSH window acceptance remains with the user.'},null,2)+'\n');}
