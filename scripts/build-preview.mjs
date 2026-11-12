import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['scripts/preview.jsx'], bundle: true, write: false, format: 'iife',
  platform: 'browser', target: 'es2022', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = '<!doctype html><html lang="zh"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1"><title>DSH 会话收件箱</title><style>'
  + ':root{color-scheme:light dark;font-family:system-ui,sans-serif;'
  + '--dsw-alias-bg-base:var(--background,light-dark(#fff,#1c1d20));'
  + '--dsw-specific-sidebar-fill:var(--secondary,light-dark(#f7f7f9,#232428));'
  + '--dsw-alias-label-primary:var(--foreground,light-dark(#24252a,#f0f0f3));'
  + '--dsw-alias-label-secondary:light-dark(#64656d,#b4b5bd);'
  + '--dsw-alias-label-primary-inverted:light-dark(#fff,#151820);'
  + '--dsw-alias-interactive-bg-hover:light-dark(#e9e9ee,#303137);'
  + '--dsw-alias-button-elevated-fill:var(--card,light-dark(#fff,#32343a));'
  + '--dsw-alias-border-l3:var(--border,light-dark(#dedee5,#41434a));'
  + '--dsw-alias-state-business-primary:light-dark(#2858ca,#90b2ff);'
  + '--dsw-alias-state-warning-primary:light-dark(#9e5909,#ffc174);'
  + '--dsw-alias-state-error-primary:light-dark(#bb3444,#ff9eac);'
  + '--dsw-alias-brand-primary-new-colorprimary-new-color:var(--dsw-alias-state-business-primary);'
  + '--dsw-alias-scrollbar-bg-l2:light-dark(#c4c5cd,#50525b)}'
  + 'html,body{margin:0;padding:0;background:transparent}button{font:inherit;cursor:pointer}'
  + '#preview{max-width:340px;margin:auto}.preview-native-root{display:flex;flex-direction:column;'
  + 'height:780px;padding:8px;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);'
  + 'border-radius:10px;box-sizing:border-box}.preview-native-caption{display:flex;align-items:center;justify-content:flex-end;height:52px;flex:none}'
  + '.preview-native-caption button{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:5px;background:transparent;color:inherit}'
  + '.preview-window-controls{display:flex;gap:8px;position:absolute;left:8px;top:10px}'
  + '.preview-window-controls i{width:12px;height:12px;border-radius:50%;background:#ff6058;border:1px solid #df4d45;box-sizing:border-box}'
  + '.preview-window-controls i:nth-child(2){background:#ffbd2e;border-color:#dfa01e}.preview-window-controls i:nth-child(3){background:#28c840;border-color:#1eab34}'
  + '.preview-native-brand{display:flex;align-items:center;gap:6px;height:60px;padding:8px;flex:none}.preview-brand-identity{display:inline-flex;align-items:center;gap:8px}'
  + '.preview-new{flex:none;margin:6px 8px 14px;padding:8px;border:1px solid var(--dsw-alias-border-l3);'
  + 'border-radius:7px;background:var(--dsw-alias-button-elevated-fill);color:inherit;font-size:13px}'
  + '.preview-native-browser{display:flex;flex:1;min-height:0;margin-left:-4px;margin-right:-8px;padding-left:4px;overflow:hidden}'
  + '.preview-native-panels{display:flex;flex-direction:column;gap:2px;margin-bottom:8px}'
  + '.preview-native-panels button{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:inherit;min-height:36px;padding:7px 12px;text-align:left}'
  + '.preview-native-panels button:hover{background:var(--dsw-alias-interactive-bg-hover)}'
  + '.preview-native-foot{flex:none}.preview-native-foot [data-slot="settings.launcher"] button{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;padding:8px;font-size:13px;flex:1}'
  + '.preview-settings-trigger-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0;margin:4px 0}.preview-settings-trigger-row [data-slot="settings.launcher"] button{height:42px;min-width:0;overflow:hidden}.preview-settings-trigger-row [data-slot="settings.launcher"] button>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.preview-native-update{box-sizing:border-box;display:inline-grid;flex:none;grid-template-columns:14px max-content;align-items:center;column-gap:4px;height:28px;padding:0 8px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 20%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);color:var(--dsw-alias-state-business-primary);font:500 12px/18px system-ui,sans-serif;white-space:nowrap;cursor:pointer}'
  + '.preview-native-update-icon{display:grid;place-items:center;width:14px;height:14px}.preview-native-update-error{width:6px;height:6px;border-radius:50%;background:currentColor}.preview-native-update-badge{position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}'
  + '.preview-native-connection{flex:none;height:28px;padding:0 8px;color:var(--dsw-alias-state-warning-primary);border:0;background:transparent;font-size:12px}'
  + '.preview-avatar{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--dsw-alias-interactive-bg-hover);font-size:11px}'
  + '.preview-rail{width:56px;padding:8px 0}.preview-rail .preview-native-brand,.preview-rail .preview-new,.preview-rail .preview-native-panels,.preview-rail .preview-native-foot{display:none}'
  + '.preview-rail .preview-native-browser{margin:0;padding-left:0}'
  + '[data-preview-conversation] #preview{display:grid;grid-template-columns:300px minmax(0,1fr);max-width:none;margin:16px;height:780px}'
  + '[data-preview-conversation] .preview-native-root{border-radius:12px 0 0 12px}'
  + '.preview-conversation{display:flex;flex-direction:column;min-width:0;height:780px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:0 12px 12px 0;--dsh-composer-card-max-width:736px;--dsh-composer-side-clearance:24px}'
  + '.preview-conversation>header{padding:22px 24px;font-size:15px;border-bottom:1px solid var(--dsw-alias-border-l3)}'
  + '.preview-conversation-scroll{display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto}'
  + '.preview-conversation article{padding:24px;line-height:1.7}.preview-conversation article p{margin:0}'
  + '.preview-composer-seat{flex:none;position:sticky;bottom:0;margin-top:auto;padding-bottom:16px;background:var(--dsw-alias-bg-base)}'
  + '.preview-composer-stack{display:flex;flex-direction:column;gap:6px}'
  + '.preview-composer-bar{box-sizing:border-box;width:calc(100% - 48px);max-width:736px;margin:0 auto;border:1px solid var(--dsw-alias-border-l3);border-radius:20px;padding:16px;background:var(--dsw-alias-bg-base)}'
  + '.preview-composer-bar textarea{box-sizing:border-box;width:100%;min-height:70px;resize:none;border:0;outline:0;background:transparent;color:inherit;font:14px/22px system-ui,sans-serif}'
  + '.preview-composer-bar>div{display:flex;justify-content:space-between;gap:8px;margin-top:16px;color:var(--dsw-alias-label-secondary);font-size:12px}'
  + '@media(max-width:700px){[data-preview-conversation] #preview{grid-template-columns:minmax(0,1fr);margin:8px}[data-preview-conversation] [data-slot=sidebar]{display:none}.preview-conversation{border-radius:12px;--dsh-composer-side-clearance:12px}.preview-composer-bar{width:calc(100% - 24px);padding:12px}}'
  + '[data-preview-settings] #preview{display:grid;grid-template-columns:300px minmax(0,1fr);max-width:1000px;margin:16px;gap:0}'
  + '.preview-settings-panel{box-sizing:border-box;max-height:780px;overflow:auto;padding:32px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:0 12px 12px 0}'
  + '.fixture-native-switch{position:relative;display:inline-flex;width:36px;height:22px;padding:3px;border:0;border-radius:20px;background:var(--dsw-alias-interactive-bg-hover);flex:none;cursor:pointer}.fixture-native-switch span{width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-inverted);box-shadow:0 1px 3px #0002}.fixture-native-switch[aria-checked=true]{background:var(--dsw-alias-state-business-primary)}.fixture-native-switch[aria-checked=true] span{transform:translateX(14px)}'
  + '.fixture-native-switch:focus-visible,.fixture-native-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.fixture-native-button{font:inherit;font-size:13px;line-height:20px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 10px;cursor:pointer}'
  + '@media(max-width:620px){[data-preview-settings] #preview{grid-template-columns:minmax(0,1fr);margin:8px}[data-preview-settings] #preview>[data-slot=sidebar]{display:none}.preview-settings-panel{padding:20px;border-radius:12px}}'
  + '</style></head><body><main id="preview"></main><script>' + script + '</script></body></html>';
await mkdir('temp/design/inbox-sidebar', { recursive: true });
await writeFile('temp/design/inbox-sidebar/index.html', html);
console.log('temp/design/inbox-sidebar/index.html');
