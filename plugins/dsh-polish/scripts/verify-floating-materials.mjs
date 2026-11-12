import assert from 'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve}from'node:path';
import{chromium}from'playwright-core';
const{version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('outputs/dsh-polish-'+version);await mkdir(out,{recursive:true});
const baseline=await readFile(out+'/before/plugins/dsh-polish/client.js','utf8');
const beforeCSS=JSON.parse(baseline.match(/const stylesheet = ("(?:[^"\\]|\\.)*");/)[1]);
const scenes=['usage','stats','tokens','context','team','actions','apps','plugins'];
const report={scope:'Installed DSH statistics, context and team components; real Menu primitives with isolated menu data/callbacks. All backdrop samples are normal-flow article content INSIDE the actual conversation scroller. Headless Chrome, not native-window acceptance.',checks:[],results:[],errors:[]};
const pass=name=>report.checks.push(name),near=(a,b)=>assert.ok(Math.abs(a-b)<.2,JSON.stringify({a,b}));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(4000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('file://'+resolve('temp/design/polish-composer-native/index.html?titlebar&surfaces'));await page.waitForFunction(()=>window.floatingMaterialFixture?.setScene);
 const stylesheet=page.locator('style[data-dsh-polish="icons"]'),afterCSS=await stylesheet.textContent();
 const surface=page.locator('[role=dialog]:visible,[data-menu-material]:visible');
 async function paint(css){await stylesheet.evaluate((e,s)=>e.textContent=s,css);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 async function open(scene){await page.mouse.click(10,10);await page.keyboard.press('Escape');await page.evaluate(s=>floatingMaterialFixture.setScene(s),scene);await page.waitForTimeout(40);await page.locator('[data-material-fixture] button').first().click();await surface.waitFor();await page.waitForTimeout(60);await page.mouse.move(10,10);return surface;}
 async function background(kind,rect){await page.evaluate(({kind,rect})=>{const a=document.getElementById('floating-native-chat');a.querySelectorAll(':scope > p').forEach(p=>p.hidden=kind!=='text');const split=rect.x+rect.width/2-a.getBoundingClientRect().x;a.style.background=kind==='colors'?`linear-gradient(90deg,rgb(50,100,220) 0 ${split}px,rgb(240,90,125) ${split}px 100%)`:kind==='stripes'?'repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)':'var(--dsw-alias-bg-base)';},{kind,rect});await page.waitForTimeout(30);}
 async function pixels(rect){const png=await page.screenshot({clip:rect,omitBackground:true});return page.evaluate(async url=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;const pixel=x=>[...d.slice((7*c.width+Math.floor(x))*4,(7*c.width+Math.floor(x))*4+4)];const left=pixel(c.width*.25),right=pixel(c.width*.75),line=Array.from({length:c.width-48},(_,x)=>pixel(x+24).slice(0,3).reduce((a,b)=>a+b)/3),mean=line.reduce((a,b)=>a+b)/line.length;return{colorDistance:Math.hypot(...left.slice(0,3).map((v,k)=>v-right[k])),deviation:Math.sqrt(line.reduce((a,b)=>a+(b-mean)**2,0)/line.length),minAlpha:Math.min(left[3],right[3],...Array.from({length:c.width-48},(_,x)=>pixel(x+24)[3]))};},'data:image/png;base64,'+png.toString('base64'));}
 async function material(){return surface.evaluate(e=>{const n=e.matches('[data-menu-material]')?e.querySelector(':scope > [class*="_material_"]'):null,s=getComputedStyle(n??e,n?null:'::before');return{filter:s.backdropFilter,fill:s.backgroundColor,shadow:getComputedStyle(e).boxShadow,radius:getComputedStyle(e).borderRadius,colorScheme:getComputedStyle(e).colorScheme,count:e.querySelectorAll(':scope > [class*="_material_"]').length,panelFilter:getComputedStyle(e).backdropFilter};});}

 async function contrast(){return surface.evaluate(e=>{
  const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');
  const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return[...ctx.getImageData(0,0,1,1).data];};
  const probe=document.createElement('span');probe.style.color='var(--dsp-glass-fill)';e.append(probe);const bg=rgba(getComputedStyle(probe).color);probe.remove();
  const lum=color=>color.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const samples=[e,e.querySelector('dl dt, .XdyUwa_emptyNotice, [role=menuitem]')].filter(Boolean);
  return Math.min(...samples.flatMap(n=>{const fg=rgba(getComputedStyle(n).color);return[0,255].map(base=>{const b=bg.slice(0,3).map(v=>v*bg[3]/255+base*(1-bg[3]/255)),f=fg.slice(0,3).map((v,i)=>v*fg[3]/255+b[i]*(1-fg[3]/255));const x=lum(f),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);});}));
 });}
 for(const theme of['light','dark']){
  await page.emulateMedia({colorScheme:theme});await page.evaluate(t=>document.body.toggleAttribute('data-ds-dark-theme',t==='dark'),theme);await page.waitForTimeout(80);
  let family,transmission;
  for(const scene of scenes){
   await open(scene);const rect=await surface.boundingBox(),content=await surface.textContent();const article=await page.locator('#floating-native-chat').boundingBox();assert.ok(rect.y>=article.y&&rect.y+12<article.y+article.height);const current=await material();assert.match(current.filter,/blur\(8px\) saturate\(1.6\)/);assert.equal(current.panelFilter,'none');assert.equal(current.radius,'12px');if(!family)family=current;for(const key of['filter','fill','shadow','colorScheme'])assert.equal(current[key],family[key],scene+' '+key);
   await background('colors',rect);await paint(beforeCSS);const oldRect=await surface.boundingBox(),before=await pixels(rect);assert.equal(await surface.textContent(),content);await paint(afterCSS);const after=await pixels(rect),newRect=await surface.boundingBox();near(newRect.x,oldRect.x);near(newRect.y,oldRect.y);near(newRect.width,oldRect.width);near(newRect.height,oldRect.height);assert.equal(after.minAlpha,255);if(transmission===undefined)transmission=after.colorDistance;assert.ok(Math.abs(after.colorDistance-transmission)<5,JSON.stringify({theme,scene,transmission,after}));const minContrast=await contrast();assert.ok(minContrast>=4.5,JSON.stringify({theme,scene,minContrast}));
   if(!['actions','apps','plugins'].includes(scene))assert.ok(after.colorDistance>before.colorDistance*1.1,JSON.stringify({theme,scene,before,after}));else assert.ok(Math.abs(after.colorDistance-before.colorDistance)<2);
   await background('stripes',rect);const blurred=await pixels(rect);const off=await page.addStyleTag({content:'[role=dialog]::before,[data-menu-material]>[class*="_material_"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});await page.waitForTimeout(30);const sharp=await pixels(rect);await off.evaluate(e=>e.remove());assert.ok(sharp.deviation>10);assert.ok(blurred.deviation<sharp.deviation*.35,JSON.stringify({theme,scene,blurred,sharp}));
   await background('text',rect);if(theme==='light'){await paint(beforeCSS);await page.screenshot({path:out+'/'+scene+'-frost-before.png'});await paint(afterCSS);await page.screenshot({path:out+'/'+scene+'-frost-after.png'});}else if(['usage','team','context'].includes(scene))await page.screenshot({path:out+'/'+scene+'-frost-dark.png'});
   assert.equal(await surface.textContent(),content);report.results.push({theme,scene,material:current,minContrast,before,after,blurRatio:blurred.deviation/sharp.deviation});
  }
  pass(theme+'：八类浮层共用底色、8px模糊、饱和度、边线及阴影；背景透光、模糊像素及4.5:1文字对比度通过，文字／数值与几何保持');
 }
 await page.emulateMedia({colorScheme:'light'});await page.evaluate(()=>document.body.removeAttribute('data-ds-dark-theme'));
 await open('team');assert.equal(await surface.getByRole('button',{name:/lead/}).isDisabled(),true);const tile=await surface.locator('.XdyUwa_member').evaluate(e=>getComputedStyle(e).backgroundColor);assert.match(tile,/0\.03\)/);await page.keyboard.press('Escape');await surface.waitFor({state:'hidden'});assert.equal(await page.locator('[data-team-action] > button').evaluate(e=>document.activeElement===e),true);pass('成员卡片去掉实色遮挡，当前成员仍禁用，Escape关闭并归还焦点');
 for(const scene of['actions','apps','plugins']){await open(scene);if(scene==='apps')assert.equal(await surface.locator('img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)),true);await surface.getByRole('menuitem').first().click();await surface.waitFor({state:'hidden'});}assert.deepEqual(await page.evaluate(()=>floatingMaterialFixture.calls),[{scene:'actions',value:'copy'},{scene:'apps',value:'app-0'},{scene:'plugins',value:'browse'}]);pass('三个菜单保留真实Menu选择回调和应用原彩图标，未打开外部应用或执行复制下载');
 for(const width of[720,390]){await page.setViewportSize({width,height:900});for(const scene of scenes){await open(scene);const r=await surface.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width&&r.y>=0&&r.y+r.height<=900,JSON.stringify({width,scene,r}));assert.equal(await surface.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.keyboard.press('Escape');}pass(width+'px：八类弹层均在视口内，无横向溢出');}
 await page.setViewportSize({width:1200,height:900});
 for(const setting of['contrast','transparency','forced']){
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:setting==='contrast'?'prefers-contrast':setting==='transparency'?'prefers-reduced-transparency':'forced-colors',value:setting==='contrast'?'more':setting==='transparency'?'reduce':'active'}]});
  for(const scene of scenes){await open(scene);assert.equal((await material()).filter,'none');}
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();pass(setting+'：八类面板统一回退实色，不留下背景滤镜');
 }
 await open('usage');await page.evaluate(()=>composerFixture.disable());await page.waitForTimeout(60);assert.notEqual((await material()).filter,'blur(8px) saturate(1.6)');assert.match(await surface.textContent(),/17,554 tok/);pass('停用归还原生材质与布局，保留实际面板节点和原文数据');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await writeFile(out+'/floating-material-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,results:report.results.map(({theme,scene,before,after,blurRatio})=>({theme,scene,beforeDistance:before.colorDistance,afterDistance:after.colorDistance,blurRatio})),failure:report.failure,errors:report.errors},null,2));}
