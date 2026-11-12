import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { root } from './build.mjs';
await import('./build-glass-preview.mjs');
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const workspace = new URL('../../', root), output = new URL(`outputs/dsh-polish-${version}/`, workspace);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(6000);
const checks = [], errors = [], surfaces = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (name, run) => { await run(); checks.push(name); };
const menu = () => page.locator('[data-menu-material][role="menu"]').first();
async function view(name) {
  await page.evaluate(name => window.glassDemo.setView(name), name);
  if (name === 'tooltip') { await page.locator('[data-glass-trigger="tooltip"]').click(); await page.getByRole('tooltip').waitFor(); }
  if (['hover','preview'].includes(name)) { await page.locator(`[data-glass-trigger="${name}"]`).waitFor(); await page.keyboard.press('Tab'); await page.locator(`[data-glass-trigger="${name}"]`).focus(); await page.locator('._card_bgejw_9').waitFor(); }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function style(locator) {
  return locator.evaluate(node => {
    const s = getComputedStyle(node), material = node.matches('[data-menu-material]') ? node.firstElementChild : node;
    const m = node.matches('[role="dialog"]:not([data-menu-material]), ._card_bgejw_9') ? getComputedStyle(node,'::before') : getComputedStyle(material);
    const rgba = color => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data]; };
    const luminance = channels => channels.slice(0,3).map(x=>{ x/=255; return x<=.04045?x/12.92:((x+.055)/1.055)**2.4; }).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
    const composite = (fg,bg) => fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));
    const contrast = (fg,bg) => { const a=luminance(composite(fg,bg)), b=luminance(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); };
    const fill=rgba(m.backgroundColor), primary=rgba(s.color), secondary=rgba(s.getPropertyValue('--dsp-glass-secondary'));
    const extremes=[[0,0,0],[255,255,255]].map(bg=>composite(fill,bg));
    return { radius:s.borderRadius, fill:m.backgroundColor, alpha:fill[3]/255, backdrop:m.backdropFilter,
      foregroundFilter:s.filter, text:s.color, outline:s.outlineStyle, boxShadow:s.boxShadow,
      primaryContrast:Math.min(...extremes.map(bg=>contrast(primary,bg))), secondaryContrast:Math.min(...extremes.map(bg=>contrast(secondary,bg))) };
  });
}
try {
  await page.goto(new URL('temp/design/polish-glass/index.html', workspace).href);
  await menu().waitFor();
  for (const appearance of ['light','dark']) {
    await page.emulateMedia({ colorScheme: appearance });
    await page.evaluate(appearance=>window.glassDemo.setAppearance(appearance),appearance);
    await check(`${appearance}: native menu and submenu share one glass material and retain their backing`, async () => {
      await view('menu');
      const root = await style(menu());
      assert.equal(root.radius,'12px'); assert.match(root.backdrop,/blur\(8px\)/); assert.ok(Math.abs(root.alpha-(appearance==='light'?.52:.71))<.01);
      assert.equal(root.foregroundFilter,'none'); assert.equal(root.outline,'solid');
      const backing = await page.locator('[data-menu-backing]').first().evaluate(n=>({bg:getComputedStyle(n).backgroundColor,filter:getComputedStyle(n).backdropFilter}));
      assert.notEqual(backing.bg,'rgba(0, 0, 0, 0)'); assert.equal(backing.filter,'none');
      await page.getByRole('menuitem',{name:'项目范围',exact:true}).hover();
      await page.getByRole('menuitem',{name:'当前项目',exact:true}).waitFor();
      const materials = await page.locator('[data-menu-material]').evaluateAll(ns=>ns.map(n=>getComputedStyle(n.firstElementChild).backdropFilter));
      assert.ok(materials.length>=2&&materials.every(v=>v===root.backdrop));
      await page.mouse.move(950,650); await page.screenshot({path:new URL(`glass-menu-${appearance}.png`,output).pathname});
      surfaces.push({appearance,type:'menu',...root});
    });
    await check(`${appearance}: tooltip and shortcut text use themed glass without blurring glyphs`, async () => {
      await view('tooltip');const tooltip=page.getByRole('tooltip');const s=await style(tooltip);
      assert.equal(s.radius,'8px');assert.match(s.backdrop,/blur\(28px\)/);assert.equal(s.foregroundFilter,'none');
      assert.match(await tooltip.innerText(),/插件/);
      await page.screenshot({path:new URL(`glass-tooltip-${appearance}.png`,output).pathname});
      surfaces.push({appearance,type:'tooltip',...s});
      await page.keyboard.press('Escape');await tooltip.waitFor({state:'hidden'});
    });
    await check(`${appearance}: native HoverCard and its legacy white text remain readable`, async () => {
      await view('hover');const card=page.locator('._card_bgejw_9');const s=await style(card);
      assert.equal(s.radius,'12px');assert.match(s.backdrop,/blur\(8px\)/);
      assert.equal(await card.locator('.JoiKIa_hoverTitle').evaluate(n=>getComputedStyle(n).color),s.text);
      surfaces.push({appearance,type:'hover',...s});
    });
    await check(`${appearance}: modal and feedback toast use the same fill, stroke and backdrop`, async () => {
      await view('modal');const dialog=page.getByRole('dialog',{name:'项目名称'});await dialog.waitFor();const s=await style(dialog);
      assert.equal(s.radius,'20px');assert.match(s.backdrop,/blur\(28px\)/);assert.equal(s.foregroundFilter,'none');
      const trigger=dialog.locator('[data-glass-trigger="modal-tip"]');await trigger.click();const tip=page.getByRole('tooltip');await tip.waitFor();
      const a=await trigger.boundingBox(),b=await tip.boundingBox();s.inlineTooltipOffset=b.x-a.x-a.width;assert.ok(s.inlineTooltipOffset>=4&&s.inlineTooltipOffset<=16,JSON.stringify({a,b}));
      assert.ok(b.x+b.width<=1000,JSON.stringify({a,b}));await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});
      await dialog.getByRole('textbox',{name:'项目名称',exact:true}).fill('磨砂项目');
      await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      await view('toast');const toast=page.getByRole('alert');await toast.waitFor();const toastStyle=await style(toast);
      assert.equal(toastStyle.fill,s.fill);assert.equal(toastStyle.backdrop,s.backdrop);assert.equal(toastStyle.radius,'12px');
      surfaces.push({appearance,type:'modal',...s},{appearance,type:'toast',...toastStyle});
    });
  }
  await check('native preview closing keeps its backdrop root stable and releases the original card', async () => {
    await page.emulateMedia({reducedMotion:'no-preference'});await view('preview');
    const frames=await page.evaluate(async()=>{
      const node=document.querySelector('._card_bgejw_9');document.querySelector('[data-glass-trigger="preview"]').blur();
      const values=[];const start=performance.now();
      while(node.isConnected&&performance.now()-start<800){await new Promise(r=>requestAnimationFrame(r));if(node.isConnected)values.push({root:Number(getComputedStyle(node).opacity),material:Number(getComputedStyle(node,'::before').opacity)});}
      return {values,released:!node.isConnected};
    });
    assert.equal(frames.released,true);assert.ok(frames.values.every(v=>v.root===1));
    for(let i=1;i<frames.values.length;i++)assert.ok(frames.values[i].material<=frames.values[i-1].material+.02,JSON.stringify(frames));
    await page.emulateMedia({reducedMotion:'reduce'});
  });
  await check('primary and secondary floating text exceed 4.5:1 over black and white backdrop bounds', async () => {
    for(const surface of surfaces){assert.ok(surface.primaryContrast>=4.5,JSON.stringify(surface));assert.ok(surface.secondaryContrast>=4.5,JSON.stringify(surface));}
  });
  await check('single-select keeps its closed geometry and native change event with a glass picker', async () => {
    await view('select');const select=page.getByRole('combobox',{name:'项目范围',exact:true});
    await page.evaluate(()=>window.glassDemo.setPolish(false));const before=await select.boundingBox();
    await page.evaluate(()=>window.glassDemo.setPolish(true));const after=await select.boundingBox();
    assert.ok(Math.abs(before.height-after.height)<1&&Math.abs(before.width-after.width)<1,JSON.stringify({before,after}));
    const picker=await select.evaluate(n=>({appearance:getComputedStyle(n).appearance,backdrop:getComputedStyle(n,'::picker(select)').backdropFilter,icon:getComputedStyle(n,'::picker-icon').display}));
    assert.equal(picker.appearance,'base-select');assert.match(picker.backdrop,/blur\(28px\)/);
    assert.notEqual(picker.icon,'none');
    const nativeArrow=await select.evaluate(n=>{const copy=n.cloneNode(true);copy.className='JZLxKW_select';n.parentElement.append(copy);const s=getComputedStyle(copy);const result={background:s.backgroundImage,picker:getComputedStyle(copy,'::picker-icon').display};copy.remove();return result;});
    assert.notEqual(nativeArrow.background,'none');assert.equal(nativeArrow.picker,'none');
    await select.click();await page.getByRole('option',{name:'当前项目',exact:true}).click();assert.equal(await select.inputValue(),'local');
  });
  await check('disabled choices and danger colors retain native semantics after material changes', async () => {
    await view('menu');const danger=page.getByRole('menuitem',{name:'移除插件',exact:true}), disabled=page.getByRole('menuitem',{name:'安装本地插件',exact:true});
    const after=await danger.evaluate(n=>getComputedStyle(n).color);assert.equal(await disabled.isDisabled(),true);
    await page.evaluate(()=>window.glassDemo.setPolish(false));assert.equal(await danger.evaluate(n=>getComputedStyle(n).color),after);
    await page.evaluate(()=>window.glassDemo.setPolish(true));
  });
  await check('reduced transparency and increased contrast use an opaque fallback', async () => {
    const cdp=await page.context().newCDPSession(page);
    for(const name of ['prefers-reduced-transparency','prefers-contrast']){
      await cdp.send('Emulation.setEmulatedMedia',{features:[{name,value:name==='prefers-contrast'?'more':'reduce'}]});
      const s=await style(menu());assert.equal(s.backdrop,'none');assert.equal(s.alpha,1);
    }
    await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();
  });
  await check('forced colors keep system colors and a visible outline without translucency', async () => {
    await page.emulateMedia({forcedColors:'active'});const s=await style(menu());assert.equal(s.backdrop,'none');assert.equal(s.alpha,1);assert.equal(s.outline,'solid');
    await page.emulateMedia({forcedColors:'none'});
  });
  await check('narrow menus, tooltips and hover cards stay inside the viewport', async () => {
    await page.setViewportSize({width:360,height:740});
    for(const type of ['menu','tooltip','hover']){
      await view(type);const n=type==='menu'?menu():type==='tooltip'?page.getByRole('tooltip'):page.locator('._card_bgejw_9');
      const b=await n.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=361,JSON.stringify({type,b}));
    }
  });
  await check('legacy delegated tooltip is single-layer and unloading restores title and host material', async () => {
    await view('menu');await page.keyboard.press('Escape');
    await page.evaluate(()=>{const root=document.createElement('div');root.id='glass-legacy';root.className='dsi-root';root.style.cssText='position:fixed;left:30px;bottom:40px';root.innerHTML='<button class="dsi-icon-button" title="插件">插件入口</button>';document.body.append(root);});
    const trigger=page.locator('#glass-legacy button');await trigger.hover();const tip=page.locator('[data-dsh-polish-tooltip]');await tip.waitFor();
    assert.equal(await page.getByRole('tooltip').count(),1);assert.equal(await trigger.getAttribute('title'),null);assert.match((await style(tip)).backdrop,/blur\(28px\)/);
    await page.evaluate(()=>window.glassDemo.setPolish(false));assert.equal(await trigger.getAttribute('title'),'插件');assert.equal(await tip.count(),0);
    assert.equal(await page.locator('[data-dsh-polish]').count(),0);assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).getPropertyValue('--dsp-glass-filter')),'');
    await page.locator('#glass-legacy').evaluate(n=>n.remove());
  });
  assert.deepEqual(errors,[]);
} catch(error){errors.push(error.stack||error.message);throw error;}
finally{
  await writeFile(new URL('glass-checks.json',output),JSON.stringify({version,checksPassed:checks.length,checks,surfaces,errors,
    scope:'Built DSH Polish client factory with actual installed DSH Tooltip, Menu, MenuSurface, HoverCard, Modal, Toast and HTML select in background Chrome. Theme, icon symbols and native material/backing layers are actual host code; content and service data are fixtures. Native OS windows, transparent Electron compositing and interaction performance remain unverified.'},null,2)+'\n');
  await browser.close();
}
console.log('Glass material: '+checks.length+' passed.');
