import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
test('retained T3 sources preserve their historical identity and are no longer the active sidebar',async()=>{
 const base=new URL('../src/vendor/t3-web/',import.meta.url),source=JSON.parse(await readFile(new URL('SOURCE.json',base),'utf8'));
 assert.equal(source.commit,'5d5ab80a685774f3911c32d842b02a512e60d8ce');
 for(const entry of source.files){
   const bytes=await readFile(new URL(entry.path,base));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path+' changed outside the recorded port');
   if(entry.mode==='verbatim')assert.equal(entry.sha256,entry.originalSha256,entry.path);
 }
 assert.equal(source.files.find(f=>f.path==='components/Sidebar.motion.ts').mode,'verbatim');
 const contract=JSON.parse(await readFile(new URL('../outputs/build-contract.json',import.meta.url),'utf8'));
 assert.deepEqual(contract.bundledLegacy,[]);
});
