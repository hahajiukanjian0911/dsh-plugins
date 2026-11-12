import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';

const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('outputs/dsh-polish-'+version);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1200,height:860},reducedMotion:'reduce'});
page.setDefaultTimeout(5000);
const report={checks:[],errors:[],states:[],scope:'Built plugin in actual installed DSH AppFrame, SidebarRoot, HeaderLeadingControls, ConversationHeader, ExpandButton, PanelChrome and SlotRegistry. Isolated stores, sessions and action targets; headless Chrome. Native traffic lights, vibrancy compositing, window drag and OS fullscreen require user acceptance.'};
page.on('pageerror',e=>report.errors.push(e.message));
const pass=name=>{report.checks.push(name);console.log('PASS '+name);};
const url='file://'+resolve('temp/design/polish-composer-native/index.html')+'?titlebar';
async function geometry(selector){return page.locator(selector).boundingBox();}
async function hit(selector){return page.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return{hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),region:s.getPropertyValue('-webkit-app-region'),box:r.toJSON()};});}
async function safeDrag(){
  const result=await page.evaluate(()=>{
    const controls=[...document.querySelectorAll('[data-sidebar-toggle],[data-sidebar-opener],[data-sidebar-right-expand],[data-sidebar-right-toggle],[data-sidebar-right-mode]')].map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.right>0);
    return [...document.querySelectorAll('[data-window-drag]')].filter(n=>getComputedStyle(n).getPropertyValue('-webkit-app-region')==='drag').map(n=>{const r=n.getBoundingClientRect();return{className:n.className,box:r.toJSON(),overlaps:controls.some(c=>r.width&&r.height&&c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top&&!n.contains(document.elementFromPoint(c.x+c.width/2,c.y+c.height/2)))};});
  });
  assert.ok(result.every(r=>!r.overlaps),JSON.stringify(result));
  return result;
}
try {
  await page.goto(url);await page.locator('[data-dsp-titlebar]').waitFor();
  for(const appearance of ['light','dark'])for(const fullscreen of [false,true]) {
    await page.emulateMedia({colorScheme:appearance});
    await page.evaluate(value=>document.documentElement.toggleAttribute('data-fullscreen',value),fullscreen);
    const expected={x:fullscreen?16:92,y:6,width:20,height:20};
    assert.deepEqual(await geometry('[data-sidebar-toggle]'),expected);
    assert.equal((await hit('[data-sidebar-toggle]')).hit,true);
    assert.equal((await hit('[data-sidebar-toggle]')).region,'no-drag');
    assert.equal(await page.locator('[data-dsp-titlebar]').count(),1);
    assert.equal(await page.locator('.kB3qhq_logoRow').isVisible(),false);
    assert.equal(await page.locator('.PIRFFq_centerCol').evaluate(n=>n.getBoundingClientRect().top),32);
    assert.equal(await page.locator('[data-dsp-titlebar]').evaluate(n=>n.offsetHeight),32);
    const brand=await geometry('[data-dsp-titlebar-brand]');
    assert.ok(brand.y>=0&&brand.y+brand.height<=32);
    assert.equal(brand.height,14);
    const bar=await geometry('[data-dsp-titlebar]');
    assert.equal(brand.y+brand.height/2,bar.y+bar.height/2);
    const controls=await page.locator('[data-sidebar-toggle]:visible,[data-sidebar-opener]:visible,[data-sidebar-right-expand]:visible,[data-sidebar-right-toggle]:visible,[data-sidebar-right-mode]:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
    assert.ok(controls.every(r=>r.y+r.height/2===bar.y+bar.height/2));
    const pane=await page.locator('.PIRFFq_centerCol').evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),radius:getComputedStyle(n).borderTopLeftRadius,border:getComputedStyle(n).borderTopWidth}));
    assert.equal(pane.radius,'12px');assert.equal(pane.border,'1px');
    assert.equal(pane.rect.right,page.viewportSize().width-4);assert.equal(pane.rect.bottom,page.viewportSize().height-4);
    const material=await page.locator('.PIRFFq_sidebarCol').evaluate(n=>({color:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage}));
    assert.deepEqual(material,{color:'rgba(0, 0, 0, 0)',image:'none'});
    const handles=await page.locator('.PIRFFq_handle').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
    assert.ok(handles.every(r=>r.top===32&&r.bottom===page.viewportSize().height-4));
    const drag=await safeDrag();
    for(let cycle=0;cycle<2;cycle++) {
      await page.locator('[data-sidebar-toggle]').click();await page.locator('[data-sidebar-opener]').waitFor();
      await page.waitForTimeout(220);
      assert.deepEqual(await geometry('[data-sidebar-opener]'),expected);
      assert.equal(await page.locator('[data-sidebar-toggle]').isVisible(),false);
      assert.equal(await page.locator('[data-sidebar-opener] svg:visible').count(),1);
      assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-sidebar-opener')),true);
      assert.equal((await hit('[data-sidebar-opener]')).hit,true);
      assert.equal((await geometry('.PIRFFq_centerCol')).x,4);
      assert.equal(await page.locator('[data-shell-leading] button:visible').count(),1);
      await safeDrag();
      await page.locator('[data-sidebar-opener]').click();await page.locator('[data-shell-leading]').waitFor({state:'detached'});
      assert.deepEqual(await geometry('[data-sidebar-toggle]'),expected);
      assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-sidebar-toggle')),true);
    }
    report.states.push({appearance,fullscreen,toggle:expected,drag});
    if(!fullscreen)await page.screenshot({path:out+'/titlebar-'+appearance+'.png'});
  }
  pass('深浅色与全屏状态下，8次侧栏开合保持原生开关位置、点击命中和拖动排除');
  await page.evaluate(()=>document.documentElement.removeAttribute('data-fullscreen'));
  await page.locator('[data-sidebar-right-expand]').click();await page.locator('[data-sidebar-right-toggle]').waitFor();
  assert.equal(await page.evaluate(()=>titlebarFixture.right.getSnapshot().bySession['composer-fixture'].layout.expanded),true);
  assert.equal((await hit('[data-sidebar-right-toggle]')).hit,true);
  for(const selector of ['[data-sidebar-right-toggle]','[data-sidebar-right-mode]']) {const r=await geometry(selector);assert.equal(r.y+r.height/2,16);}
  await safeDrag();
  const panelBox=await geometry('.Dv5QdW_panel');
  assert.equal(panelBox.x+panelBox.width,page.viewportSize().width-4);
  assert.equal(panelBox.y+panelBox.height,page.viewportSize().height-4);
  await page.evaluate(()=>{const f=titlebarFixture;f.layout.set({layoutInfo:{...f.layout.getSnapshot().layoutInfo,rightbarTrack:false}});});
  assert.equal((await hit('[data-sidebar-right-toggle]')).hit,true);
  assert.ok((await geometry('.Dv5QdW_panel')).width>0);
  await page.screenshot({path:out+'/frame-right-overlay.png'});
  await page.locator('[data-sidebar-right-mode]').click();assert.equal(await page.evaluate(()=>titlebarFixture.modeCalls),1);
  await page.locator('[data-sidebar-right-toggle]').click();await page.locator('[data-sidebar-right-expand]').waitFor();
  pass('原生右侧面板控件回调保留；同款面板结构的右／下细边及悬浮模式不被零宽轨道裁掉');
  pass('主区域12px圆角、1px细线、右／下4px留边；侧栏与外框共用单一材质，收起后左侧留边恢复');
  await page.emulateMedia({reducedMotion:'no-preference',colorScheme:'light'});
  await page.locator('[data-sidebar-toggle]').focus();
  await page.locator('[data-sidebar-toggle]').press('Enter');
  for(const delay of [0,120,300]) {
    if(delay)await page.waitForTimeout(delay);
    assert.equal(await page.locator('[data-sidebar-toggle]:visible,[data-sidebar-opener]:visible').count(),1);
    assert.equal(await page.locator('[data-sidebar-opener] svg:visible').count(),1);
  }
  await page.locator('[data-sidebar-opener]').evaluate(n=>n.blur());
  await page.locator('[data-sidebar-opener]').hover();
  await page.screenshot({path:out+'/overlap-after-hover.png',clip:{x:76,y:0,width:190,height:40}});
  await page.mouse.move(600,700);
  await page.waitForTimeout(200);
  await page.screenshot({path:out+'/overlap-after.png',clip:{x:76,y:0,width:190,height:40}});
  await page.locator('[data-sidebar-opener]').press('Enter');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-sidebar-toggle]:visible,[data-sidebar-opener]:visible').count(),1);
  await page.emulateMedia({reducedMotion:'reduce'});
  pass('正常动效的收起初期、中段与稳定态仅有一个入口；悬停及键盘Enter不会露出旧鲸鱼');
  const editor=page.locator('[data-composer-card] [contenteditable=true]');
  await editor.fill('标题栏调整保留草稿');
  for(let i=0;i<2;i++) {
    await page.evaluate(()=>titlebarFixture.frameActions.toggleSidebar());
    await page.waitForTimeout(220);
    assert.equal(await editor.evaluate(n=>document.activeElement===n),true);
  }
  pass('通过共享布局回调开合侧栏时保留编辑器焦点，不把正在输入的用户移到顶栏');
  await page.evaluate(()=>{composerFixture.savedEditor=document.querySelector('[data-composer-card] [contenteditable=true]');composerFixture.hero.set(false);});
  await page.locator('.kiGsTW_headerBlank').waitFor({state:'detached'});
  assert.ok((await page.locator('.kiGsTW_header').boundingBox()).y>=32);
  assert.equal(await editor.innerText(),'标题栏调整保留草稿');
  await page.evaluate(()=>composerFixture.hero.set(true));
  pass('空态与对话标题栏均位于通栏下方，编辑器节点与草稿保留');
  await page.emulateMedia({colorScheme:'light'});
  for(const width of [900,390]) {
    await page.setViewportSize({width,height:860});
    await page.locator('[data-sidebar-opener]').waitFor();
    await page.locator('[data-sidebar-opener]').click();await page.waitForTimeout(60);
    assert.deepEqual(await geometry('[data-sidebar-toggle]'),{x:92,y:6,width:20,height:20});
    assert.equal((await hit('[data-sidebar-toggle]')).hit,true);
    if(width===390){assert.equal(await page.locator('.PIRFFq_sidebarCol').evaluate(n=>n.getBoundingClientRect().top),0);assert.ok((await page.getByRole('combobox',{name:'搜索会话'}).boundingBox()).y>=32);await page.screenshot({path:out+'/titlebar-narrow.png'});}
    await page.locator('[data-sidebar-toggle]').click();await page.waitForTimeout(60);
    assert.equal((await hit('[data-sidebar-opener]')).hit,true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    report.states.push({width,drawer:width<768,toggle:{x:92,y:6,width:20,height:20}});
  }
  pass('900px和390px原生自动收栏／抽屉保留，开关不随抽屉向下偏移，无横向溢出');
  await page.setViewportSize({width:1200,height:860});
  await page.evaluate(()=>{composerFixture.disable();});await page.locator('[data-dsp-titlebar]').waitFor({state:'detached'});
  assert.equal(await page.locator('.PIRFFq_centerCol').evaluate(n=>n.getBoundingClientRect().top),0);
  assert.equal(await page.locator('.PIRFFq_centerCol').evaluate(n=>getComputedStyle(n).borderTopLeftRadius),'0px');
  assert.equal(await editor.innerText(),'标题栏调整保留草稿');
  assert.equal(await page.evaluate(()=>composerFixture.savedEditor===document.querySelector('[data-composer-card] [contenteditable=true]')),true);
  await page.evaluate(()=>composerFixture.enable());await page.locator('[data-dsp-titlebar]').waitFor();
  assert.equal(await page.locator('[data-dsp-titlebar]').count(),1);
  assert.equal(await page.locator('.PIRFFq_centerCol').evaluate(n=>n.getBoundingClientRect().top),32);
  pass('停用恢复宿主布局；再次启用无重复标题栏，不替换编辑器或丢草稿');
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  assert.equal(await page.locator('[data-dsp-titlebar]').evaluate(n=>n.offsetHeight),32);
  await page.evaluate(()=>document.documentElement.dataset.platform='linux');
  // The component is platform-gated at mount, as host platform never changes in place.
  await page.evaluate(()=>{composerFixture.disable();composerFixture.enable();});
  assert.equal(await page.locator('[data-dsp-titlebar]').count(),0);
  assert.equal(await page.locator('.PIRFFq_centerCol').evaluate(n=>n.getBoundingClientRect().top),0);
  pass('减少动态效果保持静态；非macOS不创建标题栏或改动框架');
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.passed=false;report.failure=error.stack;throw error;}
finally {await browser.close();await writeFile(out+'/titlebar-check.json',JSON.stringify(report,null,2)+'\n');}
