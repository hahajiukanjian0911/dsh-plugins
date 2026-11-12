import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import postcss from 'postcss';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const css='@import \"tailwindcss\" source(none);\n'+await readFile('src/vendor/t3-web/theme.css','utf8');
const compiler=await compile(css,{base:resolve('.'),onDependency:()=>{}});
const scanner=new Scanner({sources:[{base:resolve('src/vendor/t3-web'),pattern:'**/*.{tsx,ts}',negated:false},{base:resolve('src/t3'),pattern:'**/*.{tsx,ts,jsx,js}',negated:false}]});
const output=postcss.parse(compiler.build(scanner.scan()));
output.walkRules(rule=>{
  let parent=rule.parent;
  while(parent&&parent.type!=='root') {
    if(parent.type==='rule'||parent.type==='atrule'&&/keyframes$/.test(parent.name)) return;
    parent=parent.parent;
  }
  rule.selector=postcss.list.comma(rule.selector).map(selector=>{
    if(selector.trim()==='*') return ':where(.dsi-t3), :where(.dsi-t3) *';
    if(/^(?::root|:host|html|body)(?:$|,)/.test(selector.trim())) return ':where(.dsi-t3)';
    if(selector.includes('.dsi-t3')) return selector;
    return ':where(.dsi-t3) '+selector;
  }).join(',');
});
// @property and keyframe names are global even when selectors are scoped.
// Keep Tailwind's internal registrations separate from the host's utilities.
output.walkAtRules('keyframes',rule=>{if(rule.params==='spin')rule.params='dsi-t3-spin';});
output.walkDecls(decl=>{if(decl.prop==='animation'||decl.prop==='animation-name'||decl.prop==='--animate-spin')decl.value=decl.value.replace(/\bspin\b/g,'dsi-t3-spin');});
await writeFile('src/t3/generated.css',output.toString().replaceAll('--tw-','--dsi-tw-'));
console.log('T3 styles compiled and isolated to .dsi-t3');
