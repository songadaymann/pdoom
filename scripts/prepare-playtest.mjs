// Explicit runtime allowlist: never upload the entire authoring workspace.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['scripts/audit-doom-assets.mjs'],{stdio:'inherit'});
const inventory=JSON.parse(await fs.readFile('output/onboarding/assets/runtime-inventory.json','utf8'));
const stage='output/playtest/assets';
await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
for(const {file,bytes,sha256} of inventory.rows){
  if(bytes>25*1024*1024)throw Error(`Runtime file exceeds static asset limit: ${file}`);
  if(/(^|\/)(dev|promo|v1|share|extracted)(\/|$)|\.map$|(^|\/)\./.test(file))throw Error(`Non-runtime file in allowlist: ${file}`);
  const source=await fs.readFile(path.join('doom-web',file));
  if(createHash('sha256').update(source).digest('hex')!==sha256)throw Error(`Asset changed during packaging: ${file}`);
  const target=path.join(stage,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,source);
}
// Preserve existing score/menu UI, but every endpoint belongs to this test host.
let shell=await fs.readFile('.mann-cool/dev/game-shell.v1.js','utf8');
shell=shell.replaceAll('https://mann.cool/api/v1/plays','/api/v1/plays')
  .replace('href="https://mann.cool/" aria-label="Back to mann.cool"','href="/" aria-label="Back to p(DOOM) menu"')
  .replace('<span>Back to mann.cool</span>','<span>Back to p(DOOM)</span>');
await fs.mkdir(stage+'/platform/v1',{recursive:true});await fs.writeFile(stage+'/platform/v1/game-shell.js',shell);
await fs.writeFile(stage+'/leaderboard-config.json',JSON.stringify({mode:'playtest',enabled:true,endpoint:'/api/v1/leaderboard',shellSrc:'/platform/v1/game-shell.js'},null,2));
await fs.writeFile(stage+'/_headers',`/*
  X-Content-Type-Options: nosniff
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: same-origin
  Cache-Control: public, max-age=0, must-revalidate
`);
await fs.writeFile(stage+'/THIRD_PARTY_NOTICES.txt',`p(DOOM) playtest\n\nGZDoom browser engine: see /engine/LICENSE and /engine/provenance.json.\nEngine source and local patch provenance: https://github.com/mungus43/tomb-engine/tree/6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c\nOriginal Doom map, texture and sound data supplied by the project owner; copyright id Software.\n\n`+(await fs.readFile('THIRD_PARTY_NOTICES.md','utf8')).split('\n\nRuntime artwork')[0]+'\n\nRapier 3D, copyright Dimforge and contributors, Apache-2.0. Source: https://github.com/dimforge/rapier\n\n'+await fs.readFile('docs/licenses/rapier-apache-2.0.txt','utf8'));
await fs.writeFile('output/playtest/package.json',JSON.stringify({builtAt:new Date().toISOString(),runtimeBytes:inventory.runtimeBytes,files:inventory.rows,excludes:inventory.excluded},null,2));
await fs.writeFile('deploy/playtest/media-manifest.json',JSON.stringify(inventory.rows.filter(r=>/\.(mp4|mp3)$/.test(r.file)),null,2));
console.log(`Playtest stage: ${inventory.files} runtime files, ${(inventory.runtimeBytes/1048576).toFixed(1)} MiB. No catalog or domain routes.`);
