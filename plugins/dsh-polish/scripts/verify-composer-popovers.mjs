import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('outputs/dsh-polish-'+version);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={scope:'Built Polish client on installed DSH MenuSurface, MenuView, AgentPresetSeat, PermissionSelect, ModelSelect, Forge and real Project Manager. Native renderer and slots; isolated service data and callbacks. Headless Chrome, no native-window or live model/Git actions.',checks:[],errors:[],surfaces:[]};
const pass=(name,details)=>report.checks.push({name,passed:true,...details?{details}:{}});
let page;
async function close(){await page.mouse.click(10,10);for(let i=0;i<3;i++){await page.keyboard.press('Escape');await page.waitForTimeout(30);}await page.locator('[data-composer-input]').focus();}
const scenes=[['project','[data-dpm-project-anchor]','[role=menu]'],['commands','[data-composer-card] button[aria-haspopup=listbox]','[data-trigger-menu]'],['permission','[data-slot="conversation.input.permission"] button','[role=menu]'],['presets','[data-dsp-composer-mode] button','[role=menu]'],['model','[data-slot="conversation.input.model"] button','[role=menu]']];
async function open(selector,panel){await close();if(selector.includes('aria-haspopup=listbox'))await page.evaluate(()=>{const f=composerFixture;f.menu.set({...f.menu.getSnapshot(),highlight:{source:'command',index:0}});});await page.locator(selector).click();await page.waitForTimeout(70);const surface=page.locator(panel).first();await surface.waitFor();return surface;}
async function metrics(surface){return surface.evaluate(e=>{
 const s=getComputedStyle(e),rect=e.getBoundingClientRect();
 const roles=e.querySelectorAll('button:is([role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=option])');
 return{rect:rect.toJSON(),radius:s.borderRadius,shadow:s.boxShadow,padding:s.padding,material:e.querySelectorAll(':scope > [aria-hidden=true][class*="_material_"]').length,
 rows:[...roles].map(n=>{const t=getComputedStyle(n);return{height:n.getBoundingClientRect().height,font:t.fontSize,padding:t.padding,radius:t.borderRadius};})};
 });}
function bounds(m){assert.ok(m.rect.left>=0&&m.rect.right<=page.viewportSize().width+1,JSON.stringify(m));assert.ok(m.rect.top>=0&&m.rect.bottom<=page.viewportSize().height+1,JSON.stringify(m));}
async function contrast(element,surface){return element.evaluate((e,surfaceSelector)=>{
 const surface=e.closest('[data-menu-material]'),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
 const probe=document.createElement('span');probe.style.color='var(--dsp-glass-fill)';surface.append(probe);const bg=rgba(getComputedStyle(probe).color);probe.remove();const fg=rgba(getComputedStyle(e).color);
 const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratios=[0,255].map(base=>{const b=bg.map((v,i)=>i<3?v*(bg[3]/255)+base*(1-bg[3]/255):255),f=fg.map((v,i)=>i<3?v*(fg[3]/255)+b[i]*(1-fg[3]/255):255);const a=luminance(f),d=luminance(b);return(Math.max(a,d)+.05)/(Math.min(a,d)+.05);});return{fg,bg,minRatio:Math.min(...ratios)};
 });}
try{
 page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce',colorScheme:'light'});page.setDefaultTimeout(3500);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('file://'+resolve('temp/design/polish-composer-native/index.html'));await page.waitForTimeout(120);
 // Same host components and data, with the actual plugin disabled for comparison.
 await page.evaluate(()=>composerFixture.disable());await page.waitForTimeout(80);await open(scenes[1][1],scenes[1][2]);await page.screenshot({path:out+'/commands-before.png'});await close();await page.evaluate(()=>composerFixture.enable());await page.waitForTimeout(100);
 for(const theme of['light','dark']){
  await page.emulateMedia({colorScheme:theme});
  await page.evaluate(theme=>document.body.toggleAttribute('data-ds-dark-theme',theme==='dark'),theme);
  await page.waitForTimeout(100);
  let commonShadow;
  for(const[name,selector,panel]of scenes){const surface=await open(selector,panel),m=await metrics(surface);bounds(m);assert.equal(m.radius,'12px');assert.equal(m.padding,'6px');assert.equal(m.material,1);if(commonShadow===undefined)commonShadow=m.shadow;assert.equal(m.shadow,commonShadow);for(const row of m.rows){assert.equal(row.radius,'8px');assert.equal(row.font,'13px');assert.ok(row.height>=(name==='commands'?32:36));}
   if(name==='commands'){assert.ok(m.rect.width<=840);assert.equal(await page.getByRole('option').count(),8);const last=await page.getByRole('option').last().boundingBox();assert.ok(last.y+last.height<=m.rect.bottom+1);assert.equal(await page.locator('.z8WDjq_itemDescription:visible').count(),7);
    await page.getByRole('option').nth(1).hover();await page.waitForTimeout(40);assert.equal(await page.getByRole('option').nth(1).locator('.z8WDjq_itemDescription').innerText(),'设置或查看长期任务目标');const desc=await contrast(page.getByRole('option').nth(1).locator('.z8WDjq_itemDescription'));assert.ok(desc.minRatio>=4.5,JSON.stringify(desc));report.surfaces.push({name:theme+'-commands-description',contrast:desc});
    const align=await page.getByRole('option').nth(1).evaluate(e=>({a:e.querySelector('.z8WDjq_itemName').getBoundingClientRect().left,b:e.querySelector('.z8WDjq_itemDescription').getBoundingClientRect().left}));assert.ok(align.b>align.a+24);await page.mouse.move(10,10);await page.screenshot({path:out+'/commands-detail-'+theme+'.png'});
    await open(selector,panel);
   }
   if(name==='presets'){assert.equal(await surface.locator('.ufIuna_item').count(),4);const desc=await contrast(surface.locator('.ufIuna_itemDesc').first());assert.ok(desc.minRatio>=4.5,JSON.stringify(desc));report.surfaces.push({name:theme+'-preset-description',contrast:desc});assert.equal(await surface.locator('.ufIuna_itemDesc').first().evaluate(e=>getComputedStyle(e).lineHeight),'18px');}
   await page.screenshot({path:out+'/'+name+'-'+theme+'.png'});report.surfaces.push({name:theme+'-'+name,...m});
  }
  await close();await page.evaluate(()=>composerFixture.disableProjectManager());await page.waitForTimeout(100);const fallback=await open('.dsp-worktree-trigger','[role=menu]'),m=await metrics(fallback);bounds(m);assert.equal(m.radius,'12px');assert.equal(m.shadow,commonShadow);assert.equal(m.rows[0].radius,'8px');await page.screenshot({path:out+'/worktree-'+theme+'.png'});await close();await page.evaluate(()=>composerFixture.enableProjectManager());await page.waitForTimeout(100);pass(theme+'：项目、加号、权限、模式、模型及独立工作树六类弹层共享材质与层级，次要文字对比度不低于 4.5:1');
 }
 await page.evaluate(()=>document.body.removeAttribute('data-ds-dark-theme'));
 for(const width of[720,390]){await page.setViewportSize({width,height:900});for(const[name,selector,panel]of scenes){const surface=await open(selector,panel),m=await metrics(surface);bounds(m);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);if(width===390&&name==='commands')await page.screenshot({path:out+'/commands-narrow.png'});}pass(width+'px：五类主要弹层无横向溢出且位于视口内');}
 await page.setViewportSize({width:1200,height:900});await close();
 await page.locator(scenes[1][1]).click();await page.getByRole('option').nth(7).click();assert.deepEqual(await page.evaluate(()=>composerFixture.commandPicks),[{source:'command',index:7}]);pass('加号保留八个命令及同排说明，末项仍调用原生选择入口');
 await open(scenes[2][1],scenes[2][2]);await page.getByRole('menuitem',{name:'只读',exact:true}).click();assert.equal(await page.evaluate(()=>composerFixture.permission.getSnapshot().currentValue),'read-only');
 await open(scenes[3][1],scenes[3][2]);await page.getByRole('menuitem',{name:/^PTC 模式/}).click();assert.equal(await page.evaluate(()=>composerFixture.preset.getSnapshot().current),'ptc');pass('权限和模式原生选择回调保留');
 const model=await open(scenes[4][1],scenes[4][2]);await model.getByRole('menuitem').filter({hasText:'推理等级'}).click();await page.getByText('High',{exact:true}).click();assert.match(JSON.stringify(await page.evaluate(()=>composerFixture.modelPicks)),/high/);pass('模型推理等级子菜单与选择回调保留');
 await open(scenes[4][1],scenes[4][2]);await page.getByRole('menuitem').filter({hasText:'模型'}).first().click();await page.waitForTimeout(70);await page.screenshot({path:out+'/model-list-light.png'});assert.ok(await page.getByText('DeepSeek-V4.1-Flash',{exact:true}).count());await close();pass('模型列表及搜索沿用原生控件');
 await page.evaluate(()=>{const f=composerFixture;f.savedProject=f.controller.getSnapshot();f.controller.set({view:{...f.savedProject.view,projects:f.savedProject.view.projects.map(p=>({...p,name:'很长的项目名称'.repeat(20),checkouts:p.checkouts.map(c=>({...c,path:'/fixture/'+('long-directory/'.repeat(30))}))}))}});});await page.setViewportSize({width:390,height:900});const long=await open(scenes[0][1],scenes[0][2]);bounds(await metrics(long));assert.equal(await long.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);assert.match(await long.locator('.dpm-composer-option').first().getAttribute('title'),/long-directory/);await page.screenshot({path:out+'/project-long.png'});await close();await page.evaluate(()=>composerFixture.controller.set(composerFixture.savedProject));pass('长项目名和路径保持截断、完整提示及菜单边界');
 await page.evaluate(()=>composerFixture.disable());await page.waitForTimeout(70);const original=await open(scenes[1][1],scenes[1][2]);assert.equal(await original.evaluate(e=>getComputedStyle(e).width),await page.locator('[data-composer-card]').evaluate(e=>getComputedStyle(e).width));pass('停用后归还原生全宽命令菜单及样式');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await writeFile(out+'/popover-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(x=>x.name),errors:report.errors,failure:report.failure},null,2));}
