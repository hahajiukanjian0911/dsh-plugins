import assert from 'node:assert/strict';
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function inspectTypography(app='/Applications/DeepSeek Harness.app') {
  const file=await open(app+'/Contents/Resources/app.asar','r');
  try {
    const prefix=Buffer.alloc(16);await file.read(prefix,0,16,0);
    const header=Buffer.alloc(prefix.readUInt32LE(12));await file.read(header,0,header.length,16);
    const tree=JSON.parse(header).files,base=8+prefix.readUInt32LE(4);
    async function read(path){let node={files:tree};for(const part of path.split('/'))node=node.files?.[part];assert.ok(node?.offset!==undefined,path);const bytes=Buffer.alloc(node.size);await file.read(bytes,0,bytes.length,base+Number(node.offset));return bytes.toString();}
    const root='dsh/node_modules/@deepseek-ai/';
    const assets=tree.dsh.files.node_modules.files['@deepseek-ai'].files['dsh-web-frontend'].files.dist.files.assets.files;
    const frontend=await read(root+'dsh-web-frontend/dist/assets/'+Object.keys(assets).find(name=>/^index-.*\.css$/.test(name)));
    const sources={theme:await read(root+'dsh-client-ui-theme/lib/client.js'),chat:await read(root+'dsh-client-ui-chat/lib/client.js'),conversation:await read(root+'dsh-client-ui-conversation/lib/client.js'),settings:await read(root+'dsh-client-ui-settings-general/lib/client.js')};
    const moduleCSS=source=>[...source.matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)].map(m=>JSON.parse(m[1])).join('\n');
    const themeNames=['base_css_default','corner_shape_css_default','design_platform_css_default','focus_css_default','onboarding_css_default','scrollbar_css_default','gradient_shadow_text_css_default','shiki_css_default'];
    const literals=new Map([...sources.theme.matchAll(/(?:var|const) (\w+) = ("(?:[^"\\]|\\.)*");/g)].map(m=>[m[1],JSON.parse(m[2])]));
    const theme=themeNames.map(name=>{assert.ok(literals.has(name),name);return literals.get(name);}).join('\n');
    const chat=moduleCSS(sources.chat),conversation=moduleCSS(sources.conversation),settings=moduleCSS(sources.settings);
    const classes={markdown:frontend.match(/\.([\w-]*_markdown_[\w-]+)\{[^}]*font:var\(--dsw-font-markdown-base\)/)?.[1],code:frontend.match(/\.([\w-]+)\{[^}]*font:var\(--dsw-font-markdown-code-block\)/)?.[1],input:conversation.match(/\.([\w-]+_input)\{[^}]*font-family:var\(--dsw-font-family\)/)?.[1],timeStart:chat.match(/\.([\w-]+_timeStart)\{/)?.[1],timeEnd:chat.match(/\.([\w-]+_timeEnd)\{/)?.[1],endInfo:chat.match(/\.([\w-]+_endInfo)\{/)?.[1],panel:JSON.parse(sources.settings.match(/var SettingsRoot_module_css_default = (\{[\s\S]*?\n\t\t\});/)[1]).panel};
    for(const[name,value]of Object.entries(classes))assert.ok(value,'宿主类名变化：'+name);
    for(const marker of ['data-conversation-content','data-composer-input'])assert.ok(sources.conversation.includes('"'+marker+'"'));
    assert.ok(sources.chat.includes('"data-message-bubble"'));
    assert.ok(frontend.includes('font-size:.875em!important'),'宿主行内代码字号约束变化，需要重新核对');
    return {app,version:JSON.parse(await read('dsh/package.json')).version,classes,css:theme+'\n'+frontend+'\n'+chat+'\n'+conversation+'\n'+settings,hashes:Object.fromEntries(Object.entries({...sources,frontend}).map(([name,value])=>[name,createHash('sha256').update(value).digest('hex')]))};
  } finally {await file.close();}
}
