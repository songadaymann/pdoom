// Runtime media is distributed separately from the GPL source tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('runtime-manifest.json',root),'utf8'));
const origin=process.env.PDOOM_RUNTIME_ORIGIN||'https://mann.cool/pdoom/';
let cursor=0,downloaded=0;
const hash=b=>createHash('sha256').update(b).digest('hex');
await Promise.all(Array.from({length:8},async()=>{
 for(;;){const row=manifest.files[cursor++];if(!row)return;
  if(row.file.includes('..')||path.isAbsolute(row.file))throw Error('Unsafe runtime path');
  const target=new URL('doom-web/'+row.file,root);
  try{if(hash(await fs.readFile(target))===row.sha256)continue;}catch{}
  const response=await fetch(new URL(row.file,origin),{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Could not download ${row.file}: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==row.sha256)throw Error(`Checksum mismatch: ${row.file}`);
  await fs.mkdir(new URL('./',target),{recursive:true});await fs.writeFile(target,bytes);downloaded++;
 }
}));
console.log(`Runtime ready (${downloaded} files downloaded). Media keeps the separate terms in ASSETS.md.`);
