import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';

const {version} = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const output = resolve('outputs/dsh-polish-' + version);
await mkdir(output, {recursive:true});
const baseline = await readFile(output + '/before/plugins/dsh-polish/client.js', 'utf8');
const oldStyles = JSON.parse(baseline.match(/const stylesheet = ("(?:[^"\\]|\\.)*");/)[1]);
const report = {
  scope:'Actual installed DSH composer and MenuSurface components. Background samples live in normal flow INSIDE the native conversation scroller, never on a body-level plate. Compare the captured 0.1.32 stylesheet with this build. Native material child, backing, portals and composer stacking remain intact. Isolated data in headless Chrome; transparent Electron window acceptance is separate.',
  results:[], checks:[], errors:[]
};
const scenes = [
  ['commands', '[data-composer-card] button[aria-haspopup=listbox]', '[data-trigger-menu]'],
  ['permission', '[data-slot="conversation.input.permission"] button', '[role=menu]'],
  ['presets', '[data-dsp-composer-mode] button', '[role=menu]'],
  ['model', '[data-slot="conversation.input.model"] button', '[role=menu]'],
  ['project', '[data-dpm-project-anchor]', '[role=menu]']
];
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage({viewport:{width:1200,height:900}, reducedMotion:'reduce'});
  page.setDefaultTimeout(4500);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('file://' + resolve('temp/design/polish-composer-native/index.html?titlebar'));
  await page.evaluate(() => {
    composerFixture.hero.set(false);
    const article = document.createElement('article');
    article.id = 'frost-native-chat-sample';
    article.style.cssText = 'flex:none;min-height:1600px;padding:24px 60px;font-size:18px;line-height:2;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)';
    document.querySelector('[data-conversation-scroll]').prepend(article);
    document.querySelector('[data-conversation-scroll]').scrollTop = 0;
  });
  const stylesheet = page.locator('style[data-dsh-polish="icons"]');
  const newStyles = await stylesheet.textContent();
  async function paint(css) {
    await stylesheet.evaluate((e,value) => e.textContent=value, css);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  async function pixels(png) {
    return page.evaluate(async url => {
      const img = new Image(); img.src=url; await img.decode();
      const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;
      const pixel=(x,y)=>[...d.slice((y*c.width+x)*4,(y*c.width+x)*4+3)];
      const average=x=>[0,1,2].map(k=>Array.from({length:7},(_,i)=>pixel(Math.floor(x)+i-3,4)[k]).reduce((s,v)=>s+v,0)/7);
      const left=average(c.width*.25),right=average(c.width*.75);
      const line=Array.from({length:c.width-48},(_,i)=>pixel(i+24,4).reduce((s,v)=>s+v,0)/3);
      const mean=line.reduce((s,v)=>s+v,0)/line.length;
      return {left,right,colorDistance:Math.hypot(...left.map((v,i)=>v-right[i])),deviation:Math.sqrt(line.reduce((s,v)=>s+(v-mean)**2,0)/line.length)};
    }, 'data:image/png;base64,' + png.toString('base64'));
  }
  async function background(kind, rect) {
    await page.evaluate(({kind,rect}) => {
      const a=document.getElementById('frost-native-chat-sample');
      const split=rect.x+rect.width/2-a.getBoundingClientRect().x;
      a.innerHTML=kind==='text' ? Array.from({length:35},(_,i)=>`<p style="margin:0 0 20px">${i+1}. 当前在 TimeRing 项目里。检查代码、查看文档、构建和测试。 <span style="background:#d5e8ff;color:#111114;border-radius:5px;padding:3px">待处理</span></p>`).join('') : '';
      a.style.background=kind==='colors' ? `linear-gradient(90deg,rgb(50,100,220) 0 ${split}px,rgb(240,90,125) ${split}px 100%)` : kind==='stripes' ? 'repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)' : 'var(--dsw-alias-bg-base)';
    }, {kind,rect});
    await page.waitForTimeout(40);
  }
  async function close() {
    await page.mouse.click(10,10);
    for(let i=0;i<3;i++){await page.keyboard.press('Escape');await page.waitForTimeout(20);}
    await page.locator('[data-composer-input]').focus();
  }
  for (const theme of ['light','dark']) {
    await page.emulateMedia({colorScheme:theme});
    await page.evaluate(theme=>document.body.toggleAttribute('data-ds-dark-theme',theme==='dark'),theme);
    for (const [name,trigger,selector] of scenes) {
      await close();
      // The project chip belongs to the native empty-conversation identity row.
      await page.evaluate(hero=>composerFixture.hero.set(hero),['project','presets'].includes(name));
      if(name==='commands')await page.evaluate(()=>composerFixture.menu.set({...composerFixture.menu.getSnapshot(),highlight:{source:'command',index:0}}));
      await page.locator(trigger).click();
      const surface=page.locator(selector).first();await surface.waitFor();await page.waitForTimeout(80);await page.mouse.move(10,10);
      const rect=await surface.boundingBox();
      const material=await surface.evaluate(e=>({children:e.querySelectorAll(':scope > [class*="_material_"]').length,parent:e.parentElement.tagName,filter:getComputedStyle(e.firstElementChild).backdropFilter,fill:getComputedStyle(e.firstElementChild).backgroundColor}));
      assert.equal(material.children,1);
      const article=await page.locator('#frost-native-chat-sample').boundingBox();
      assert.ok(rect.y>=article.y && rect.y+8<article.y+article.height,JSON.stringify({name,rect,article}));
      await background('colors',rect);
      await paint(oldStyles);const before=await pixels(await page.screenshot({clip:rect}));
      await paint(newStyles);const after=await pixels(await page.screenshot({clip:rect}));
      assert.ok(after.colorDistance>before.colorDistance*1.10,JSON.stringify({theme,name,before,after}));
      await background('stripes',rect);
      const blurred=await pixels(await page.screenshot({clip:rect}));
      const noBlur=await page.addStyleTag({content:'[data-menu-material] > [class*="_material_"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
      await page.waitForTimeout(40);const sharp=await pixels(await page.screenshot({clip:rect}));await noBlur.evaluate(e=>e.remove());
      assert.ok(sharp.deviation>10,JSON.stringify({theme,name,sharp}));
      assert.ok(blurred.deviation<sharp.deviation*.35,JSON.stringify({theme,name,blurred,sharp}));
      // Keep readable, same-scene before/after evidence for the reported menus.
      if(theme==='light' && ['commands','permission','model'].includes(name)) {
        await background('text',rect);
        await paint(oldStyles);await page.screenshot({path:output+'/'+name+'-frost-before.png'});
        await paint(newStyles);await page.screenshot({path:output+'/'+name+'-frost-after.png'});
      }
      const result={theme,name,material,before,after,transmissionGain:after.colorDistance/before.colorDistance,blurDeviationRatio:blurred.deviation/sharp.deviation};
      report.results.push(result);
      report.checks.push(theme+' '+name+': real chat backdrop color transmission improves >10%; high-frequency content is blurred >65%; native layer count retained');
    }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e) {
  report.passed=false;report.failure=e.stack;process.exitCode=1;
} finally {
  await browser.close();
  await writeFile(output+'/frost-pixels.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks,results:report.results.map(({theme,name,transmissionGain,blurDeviationRatio})=>({theme,name,transmissionGain,blurDeviationRatio})),failure:report.failure,errors:report.errors},null,2));
}
