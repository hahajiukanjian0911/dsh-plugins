import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {withInstalledHost} from '../../../scripts/installed-host.mjs';

const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('outputs/dsh-polish-'+version);await mkdir(out,{recursive:true});
const host=await withInstalledHost(async h=>{
 const modules={};let css='';
 for(const name of ['trajectory','settings-general','schedule']){
  const source=await h.read('dsh/node_modules/@deepseek-ai/dsh-client-ui-'+name+'/lib/client.js');
  const styles=[...source.matchAll(/(?:const|var) css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)].map(m=>JSON.parse(m[1])).join('\n');
  assert.ok(styles,name+' native CSS');css+='\n'+styles;
  modules[name]={sha256:createHash('sha256').update(source).digest('hex'),cssBytes:styles.length};
 }
 assert.ok(css.includes('.rh_gBW_detailBody'));assert.ok(css.includes('.CDG4uW_pageScroll'));
 return{css,modules};
});
const report={checks:[],errors:[],states:[],host:host.modules,scope:'Built Polish client, installed DSH ConversationContent/InputBar/SessionInputShell, actual sidebar plugin and theme in background Chrome. Trajectory/settings/schedule styles are extracted from the installed host; long lists and nested scrollers use isolated content. Tests ordinary DOM scrollbars in the app document, not separate webviews or native OS windows. No macOS preference changes.'};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(4500);page.on('pageerror',e=>report.errors.push(e.message));
const pass=name=>report.checks.push(name);
const scroll=page.locator('[data-conversation-scroll]');
async function state(selector){return page.locator(selector).first().evaluate(n=>{const s=getComputedStyle(n);return{selector:n.id||n.className,width:getComputedStyle(n,'::-webkit-scrollbar').width,height:getComputedStyle(n,'::-webkit-scrollbar').height,standardWidth:s.scrollbarWidth,color:s.scrollbarColor,gutter:s.scrollbarGutter,scheme:s.colorScheme,top:n.scrollTop,left:n.scrollLeft,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,measured:n.style.getPropertyValue('--dsp-native-scrollbar-width'),hostWidth:s.getPropertyValue('--dsh-scrollbar-width'),actualGutter:n.offsetWidth-n.clientWidth-(parseFloat(s.borderLeftWidth)||0)-(parseFloat(s.borderRightWidth)||0)};});}
function native(s){assert.equal(s.width,'auto',JSON.stringify(s));assert.equal(s.height,'auto');assert.equal(s.standardWidth,'auto');assert.equal(s.color,'auto');assert.equal(s.gutter,'auto');}
try{
 await page.goto('file://'+resolve('temp/design/polish-composer-native/index.html?titlebar'));await scroll.waitFor();await page.evaluate(()=>composerFixture.hero.set(false));
 const editor=page.locator('[data-composer-card] [contenteditable=true]');await editor.fill('全局原生滚动条保留草稿');
 await page.addStyleTag({content:host.css});
 await page.evaluate(()=>{
  window.scrollbarEditor=document.querySelector('[data-composer-card] [contenteditable=true]');
  const a=document.createElement('article');a.id='scrollbar-fixture';a.style.cssText='flex:none;min-height:1800px;padding:24px;box-sizing:border-box';
  a.innerHTML='<p>应用滚动区域隔离核对</p><div style="display:grid;grid-template-columns:repeat(2,280px);gap:16px">'+[
   ['trace-scroll','rh_gBW_detailBody','轨迹页'],['settings-scroll','_77Pn0W_options','设置内容'],['schedule-scroll','CDG4uW_pageScroll','日程页'],['nested-scrollbar','code-native-probe','代码／嵌套滚动区域']
  ].map(([id,cls,title])=>`<section><p>${title}</p><div id="${id}" class="${cls}" style="height:90px;width:280px;overflow:auto;border:1px solid var(--dsw-alias-border-l3);box-sizing:border-box"><div style="height:400px;width:650px;padding:8px">${Array.from({length:16},(_,i)=>'<div>隔离内容 '+(i+1)+' · 保留横向与纵向滚动</div>').join('')}</div></div></section>`).join('')+'</div>';
  document.querySelector('[data-conversation-scroll]').prepend(a);
  const sidebar=document.querySelector('.dsi-dsh-scroll');if(!sidebar)throw Error('Actual sidebar scroller missing');const long=document.createElement('div');long.id='sidebar-scroll-probe';long.style.height='1600px';sidebar.append(long);
  document.querySelector('[data-conversation-scroll]').scrollTop=0;
 });
 const selectors=['html','body','[data-conversation-scroll]','.dsi-dsh-scroll','#trace-scroll','#settings-scroll','#schedule-scroll','#nested-scrollbar'];
 for(const appearance of ['light','dark']){
  await page.emulateMedia({colorScheme:appearance});await page.waitForTimeout(40);
  for(const selector of selectors){const s=await state(selector);native(s);assert.equal(s.scheme,appearance,JSON.stringify(s));report.states.push({appearance,...s});}
  const s=await state('[data-conversation-scroll]');assert.equal(s.measured,s.actualGutter+'px');assert.equal(s.hostWidth,'5px');
 }
 pass('深浅色下，页面、真实侧栏、对话和轨迹／设置／日程／代码容器全部回到原生宽度、颜色与留槽');
 const all=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>/auto|scroll/.test(getComputedStyle(n).overflow)).map(n=>{const s=getComputedStyle(n);return{tag:n.tagName,cls:n.className,width:getComputedStyle(n,'::-webkit-scrollbar').width,standard:s.scrollbarWidth,color:s.scrollbarColor,gutter:s.scrollbarGutter};}));
 assert.ok(all.length>=8);assert.ok(all.every(s=>s.width==='auto'&&s.standard==='auto'&&s.color==='auto'&&s.gutter==='auto'),JSON.stringify(all));report.allScrollports=all;pass('枚举当前文档全部可滚动元素，未遗留局部细滚动条或隐藏滚动条规则');
 for(const selector of ['.dsi-dsh-scroll','#trace-scroll','#settings-scroll','#schedule-scroll','#nested-scrollbar']){
  const moved=await page.locator(selector).evaluate(n=>{n.scrollTop=70;n.scrollLeft=45;return{top:n.scrollTop,left:n.scrollLeft};});assert.ok(moved.top>0,selector);if(selector!=='.dsi-dsh-scroll')assert.ok(moved.left>0,selector);
 }
 const box=await scroll.boundingBox();await page.mouse.move(box.x+box.width-40,box.y+120);await page.mouse.wheel(0,250);await page.waitForFunction(()=>document.querySelector('[data-conversation-scroll]').scrollTop>0);
 assert.equal(await editor.innerText(),'全局原生滚动条保留草稿');assert.equal(await page.evaluate(()=>scrollbarEditor===document.querySelector('[data-composer-card] [contenteditable=true]')),true);await page.screenshot({path:out+'/native-scrollbars-dark.png'});pass('主区域滚轮、各页及代码双向滚动均有效，编辑器节点和草稿保留');
 await page.evaluate(()=>{
  const style=document.createElement('style');style.id='late-page-style';style.textContent='@media(min-width:1px){#trace-scroll::-webkit-scrollbar,#nested-scrollbar::-webkit-scrollbar{width:23px;height:21px}#trace-scroll::-webkit-scrollbar-thumb{background:red}#settings-scroll{scrollbar-width:thin;scrollbar-color:red blue;scrollbar-gutter:stable}}[data-note="::-webkit-scrollbar"]{--unrelated-rule:kept}';document.querySelector('#scrollbar-fixture').append(style);document.querySelector('#settings-scroll').setAttribute('data-note','::-webkit-scrollbar');
 });await page.waitForTimeout(30);
 for(const selector of ['#trace-scroll','#nested-scrollbar','#settings-scroll'])native(await state(selector));
 assert.equal(await page.locator('#settings-scroll').evaluate(n=>getComputedStyle(n).getPropertyValue('--unrelated-rule')),'kept');pass('页面内后挂载的分组样式同样恢复原生，选择器字符串中的同名文本不被误改');
 await page.evaluate(async()=>{
  const link=document.createElement('link');link.id='late-page-link';link.rel='stylesheet';window.nativeScrollLinkURL=URL.createObjectURL(new Blob(['#schedule-scroll::-webkit-scrollbar{width:25px;height:25px}'],{type:'text/css'}));const ready=new Promise((yes,no)=>{link.onload=yes;link.onerror=no;});link.href=nativeScrollLinkURL;document.head.append(link);await ready;
 });await page.waitForTimeout(30);native(await state('#schedule-scroll'));pass('异步链接样式加载完成后也交给原生绘制');
 await page.evaluate(()=>{
  const style=document.createElement('style');style.id='detached-scroll-style';style.textContent='#trace-scroll::-webkit-scrollbar{width:19px}';document.head.append(style);window.detachedScrollbarStyle=style;
 });await page.waitForTimeout(20);assert.match(await page.evaluate(()=>detachedScrollbarStyle.sheet.cssRules[0].selectorText),/:not\(\*\)/);
 await page.evaluate(()=>{window.detachedScrollbarRule=detachedScrollbarStyle.sheet.cssRules[0];detachedScrollbarStyle.remove();});await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>detachedScrollbarRule.selectorText),'#trace-scroll::-webkit-scrollbar');pass('卸下的页面样式立即归还，供其他页面稍后复用');
 await page.evaluate(()=>{const style=document.createElement('style');style.id='scrollbar-external-change';style.textContent='.external-before::-webkit-scrollbar{width:7px}';document.head.append(style);});await page.waitForTimeout(20);
 await page.evaluate(()=>document.querySelector('#scrollbar-external-change').sheet.cssRules[0].selectorText='.external-after::-webkit-scrollbar');
 const oldOffset=await scroll.evaluate(n=>n.scrollTop);await page.evaluate(()=>composerFixture.disable());await page.waitForTimeout(60);
 assert.equal((await state('[data-conversation-scroll]')).width,'5px');assert.equal((await state('[data-conversation-scroll]')).measured,'');assert.equal((await state('.dsi-dsh-scroll')).standardWidth,'none');assert.equal((await state('#trace-scroll')).width,'23px');assert.equal((await state('#settings-scroll')).standardWidth,'thin');assert.equal((await state('#schedule-scroll')).width,'25px');
 assert.equal(await page.evaluate(()=>document.querySelector('#scrollbar-external-change').sheet.cssRules[0].selectorText),'.external-after::-webkit-scrollbar');assert.equal(await editor.innerText(),'全局原生滚动条保留草稿');report.beforeDisableOffset=oldOffset;pass('停用归还全局／侧栏／页面原样式与变量，不覆盖外部随后写入的选择器');
 await page.evaluate(()=>composerFixture.enable());await page.waitForTimeout(60);for(const selector of selectors)native(await state(selector));await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(30);await scroll.evaluate(n=>n.scrollTop=0);await page.screenshot({path:out+'/native-scrollbars-light.png'});pass('重新启用统一恢复所有原生滚动条，无需逐页切换');
 await page.evaluate(()=>{document.querySelector('#scrollbar-fixture').remove();document.querySelector('#sidebar-scroll-probe').remove();URL.revokeObjectURL(nativeScrollLinkURL);});await page.waitForTimeout(30);const short=await state('[data-conversation-scroll]');assert.ok(short.scrollHeight<=short.clientHeight);assert.equal(short.measured,short.actualGutter+'px');pass('短内容不强制显示滚动条；输入区仅按实测系统留槽避让');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}finally{await browser.close();await writeFile(out+'/native-scrollbar-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,failure:report.failure,errors:report.errors},null,2));}
