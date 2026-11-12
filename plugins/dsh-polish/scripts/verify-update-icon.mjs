import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('outputs/dsh-polish-'+version);await mkdir(out,{recursive:true});
const old=await readFile(out+'/before/plugins/dsh-polish/client.js','utf8');
const oldCSS=JSON.parse(old.match(/const stylesheet = ("(?:[^"\\]|\\.)*");/)[1]);
const report={scope:'Actual installed DSH DesktopUpdateIndicator, DesktopUpdateBadge, Tooltip, native theme and built Polish client in background Chrome. Footer context and update state are isolated. onOpen is a counter; no real update, download or restart API called.',checks:[],errors:[],phases:[]};
const pass=name=>report.checks.push(name);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(4000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('file://'+resolve('temp/design/polish-composer-native/index.html?titlebar'));
 await page.evaluate(()=>{
  const M=__DSH_NATIVE_MODULES__,R=M.react,C=__DSH_NATIVE_COMPONENTS__['settings-general'],P=M['@deepseek-ai/dsh-client-ui-primitives'];
  const listeners=new Set();let value={presentation:{phase:'available',version:'0.2.3-demo'},failed:false,opening:false,wide:true,hidden:false,locale:'zh'};
  const store={subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),get:()=>value,set:patch=>{value={...value,...patch};listeners.forEach(fn=>fn());}};
  window.updateIconFixture={store,opens:0};
  const target=document.querySelector('.kB3qhq_settingsArea');target.dataset.slot='sidebar.settings';
  function Fixture(){const view=R.useSyncExternalStore(store.subscribe,store.get);const t=(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),C[view.locale][key]??key);
   return R.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',height:42,minWidth:0}},
    R.createElement('button',{'aria-label':'底栏尺寸对照',style:{width:36,height:36,padding:0,border:0,background:'transparent',display:'grid',placeItems:'center',color:'var(--dsw-alias-label-primary)'}},R.createElement(P.IconSettingsOutlineMedium,{size:16})),
    R.createElement(C.DesktopUpdateIndicator,{wide:view.wide,hidden:view.hidden,view,t,onOpen:()=>updateIconFixture.opens++}),
    !view.wide&&!view.hidden?R.createElement(C.DesktopUpdateBadge,{useDesktopUpdate:select=>select(view),useConnectionState:select=>select('connected'),t}):null);}
  M['react-dom/client'].createRoot(target).render(R.createElement(Fixture));
 });
 const button=page.locator('.G-tjAW_indicator');await button.waitFor();
 const stylesheet=page.locator('style[data-dsh-polish="icons"]'),css=await stylesheet.textContent();
 async function metrics(){return button.evaluate(n=>{const s=getComputedStyle(n),icon=n.querySelector('.G-tjAW_icon'),svg=icon.querySelector('svg');return{rect:n.getBoundingClientRect().toJSON(),icon:icon.getBoundingClientRect().toJSON(),svg:svg?.getBoundingClientRect().toJSON(),color:s.color,border:s.borderTopWidth,background:s.backgroundColor,label:n.getAttribute('aria-label'),busy:n.getAttribute('aria-disabled'),textVisible:getComputedStyle(n.lastElementChild).display!=='none'};});}
 async function set(phase,extra={}){await page.evaluate(({phase,extra})=>updateIconFixture.store.set({presentation:{phase,version:'0.2.3-demo',percent:37},failed:false,opening:false,wide:true,hidden:false,...extra}),{phase,extra});await page.waitForTimeout(30);}
 await stylesheet.evaluate((n,css)=>n.textContent=css,oldCSS);await page.waitForTimeout(30);const before=await metrics();await page.screenshot({path:out+'/update-before.png'});
 await page.evaluate(()=>window.updateOriginalNode=document.querySelector('.G-tjAW_indicator'));
 await stylesheet.evaluate((n,css)=>n.textContent=css,css);await page.waitForTimeout(30);const after=await metrics();report.comparison={before,after};
 assert.equal(after.rect.width,36);assert.equal(after.rect.height,36);assert.equal(after.svg.width,16);assert.equal(after.svg.height,16);assert.equal(after.color,before.color);assert.equal(after.textVisible,false);assert.equal(after.border,'0px');assert.equal(after.background,'rgba(0, 0, 0, 0)');assert.equal(after.label,before.label);assert.equal(await page.evaluate(()=>updateOriginalNode===document.querySelector('.G-tjAW_indicator')),true);
 const peer=await page.getByRole('button',{name:'底栏尺寸对照',exact:true}).boundingBox();assert.equal(peer.width,after.rect.width);assert.equal(peer.height,after.rect.height);assert.ok(Math.abs(peer.y+peer.height/2-after.rect.y-after.rect.height/2)<.1);pass('真实更新按钮收成36px点击区／16px图标，与底栏对照控件居中一致；去掉文字边框底色且原蓝色不变');
 await button.hover();await page.getByRole('tooltip').waitFor();assert.match(await page.getByRole('tooltip').innerText(),/0\.2\.3-demo/);await page.mouse.move(800,500);await page.keyboard.press('Escape');await button.click();await button.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>updateIconFixture.opens),2);await button.evaluate(n=>n.blur());await page.mouse.move(800,500);await page.screenshot({path:out+'/update-light.png'});pass('原生悬停提示含目标版本，鼠标和Enter均打开原生onOpen入口一次');
 for(const phase of ['checking','available','downloading','verifying','installing','ready','error']){
  await set(phase);const active=await metrics();assert.equal(active.rect.width,36);assert.equal(active.rect.height,36);assert.equal(active.textVisible,false);const count=await page.evaluate(()=>updateIconFixture.opens);await button.evaluate(n=>n.click());const busy=['checking','downloading','verifying','installing'].includes(phase);assert.equal(await page.evaluate(()=>updateIconFixture.opens),count+Number(!busy));
  await stylesheet.evaluate((n,css)=>n.textContent=css,oldCSS);await page.waitForTimeout(20);const original=await metrics();assert.equal(active.label,original.label);assert.equal(active.busy,original.busy);assert.equal(active.color,original.color);await stylesheet.evaluate((n,css)=>n.textContent=css,css);report.phases.push({phase,...active});
 }
 pass('检查／下载／校验／安装／就绪／错误各状态尺寸稳定，提示标签、状态图形颜色和忙碌时点击保护保持原生');
 await set('downloading');await button.hover();await page.getByRole('tooltip').waitFor();assert.match(await page.getByRole('tooltip').innerText(),/37/);await page.mouse.move(800,500);await page.keyboard.press('Escape');
 await set('available',{opening:true});const count=await page.evaluate(()=>updateIconFixture.opens);await button.evaluate(n=>n.click());assert.equal(await page.evaluate(()=>updateIconFixture.opens),count);pass('下载百分比仍在原生提示中，打开更新窗口期间继续阻止重复打开');
 await set('available');await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(30);const dark=await metrics();await stylesheet.evaluate((n,css)=>n.textContent=css,oldCSS);await page.waitForTimeout(20);assert.equal(dark.color,(await metrics()).color);await stylesheet.evaluate((n,css)=>n.textContent=css,css);await page.screenshot({path:out+'/update-dark.png'});pass('深色同样保留宿主的品牌蓝色和原生对比');
 await page.emulateMedia({colorScheme:'light'});await set('ready',{locale:'en'});await button.hover();await page.getByRole('tooltip').waitFor();assert.match(await page.getByRole('tooltip').innerText(),/0\.2\.3-demo/);assert.equal((await metrics()).textVisible,false);await page.mouse.move(800,500);await page.keyboard.press('Escape');pass('英文长标签仍保留在无障碍名称和原生提示中，不撑开底栏');
 await set('idle');assert.equal(await button.count(),0);await set('available',{hidden:true});assert.equal(await button.count(),0);await set('ready',{wide:false});assert.equal(await button.count(),0);assert.equal(await page.locator('.G-tjAW_badge').count(),1);pass('空闲与隐藏不留占位，收起侧栏仍使用原生更新徽标');
 await set('available');await page.setViewportSize({width:390,height:900});await page.waitForTimeout(40);await titlebarOpen();const small=await metrics();assert.equal(small.rect.width,36);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);pass('窄窗口抽屉打开时尺寸保持36px且没有页面横向溢出');
 await page.setViewportSize({width:1200,height:900});await page.evaluate(()=>composerFixture.disable());await page.waitForTimeout(60);const restored=await metrics();assert.equal(restored.textVisible,true);assert.equal(restored.rect.height,before.rect.height);assert.equal(restored.color,before.color);pass('停用恢复原生文字按钮与蓝色，未替换原按钮或更新逻辑');
 assert.deepEqual(report.errors,[]);report.passed=true;
 async function titlebarOpen(){await page.evaluate(()=>{const f=titlebarFixture;const s=f.layout.getSnapshot().layoutInfo;if(!s.narrowExpanded)f.frameActions.toggleSidebar();});await page.waitForTimeout(180);}
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await writeFile(out+'/update-icon-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,failure:report.failure,errors:report.errors},null,2));}
