import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function writeNotices(metafile){
 const packages=new Set(Object.keys(metafile.inputs).flatMap(file=>{const match=file.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);return match?[match[1]]:[];}));
 const sections=['# Third-party notices\n\nThe current sidebar uses React and UI primitives supplied by DSH. No T3 components, styles or motion code are included in the current plugin bundle. Previously extracted T3 Code sources remain in this repository for historical reference, with their original license below.\n', '## Retained T3 Code sources (not bundled)\n\n'+await readFile('src/vendor/t3-web/LICENSE','utf8')];
 const records=[];
 for(const name of [...packages].sort()){
   const base=resolve('node_modules',name),pkg=JSON.parse(await readFile(base+'/package.json','utf8'));
   const files=(await readdir(base)).filter(n=>/^(license|licence|copying)(\.|$|-)/i.test(n));
   if(!files.length)throw new Error('Missing bundled license for '+name);
   const notices=await Promise.all(files.map(f=>readFile(base+'/'+f,'utf8')));
   sections.push(`## ${name} ${pkg.version}\n\n`+notices.join('\n\n'));
   records.push({name,version:pkg.version,license:pkg.license,files});
 }
 await writeFile('THIRD_PARTY_NOTICES.md',sections.join('\n\n')+'\n');
 await writeFile('outputs/bundled-third-parties.json',JSON.stringify(records,null,2)+'\n');
}
