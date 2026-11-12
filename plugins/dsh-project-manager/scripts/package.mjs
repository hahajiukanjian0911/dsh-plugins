import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const result=await promisify(execFile)('npm',['pack','--pack-destination',resolve(root,'../../releases')],{cwd:root});
process.stdout.write(result.stdout);process.stderr.write(result.stderr);
