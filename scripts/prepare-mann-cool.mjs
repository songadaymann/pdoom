// Reuse the reviewed runtime allowlist; never stage the authoring workspace.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-doom-outside.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/prepare-playtest.mjs'],{stdio:'inherit'});
const stage='output/mann-cool-runtime';await fs.rm(stage,{recursive:true,force:true});
await fs.cp('output/playtest/assets',stage,{recursive:true});await fs.rm(stage+'/platform',{recursive:true,force:true});
await fs.writeFile(stage+'/leaderboard-config.json',await fs.readFile('doom-web/leaderboard-config.json'));
await fs.writeFile(stage+'/dev-config.json',JSON.stringify({enabled:false}));
await fs.writeFile(stage+'/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  Cache-Control: public, max-age=0, must-revalidate\n');
await fs.writeFile(stage+'/SOURCE.txt','p(DOOM) source: https://github.com/songadaymann/pdoom\nGPL-3.0-only source; runtime media retains separate terms.\n');
console.log('Canonical p(DOOM) runtime staged. Public platform integration; developer fixtures excluded.');

// Refresh the deployment assets without regenerating the reviewed Worker wrapper.
await fs.rm('.mann-cool-assets',{recursive:true,force:true});
await fs.cp(stage,'.mann-cool-assets',{recursive:true});
const inventory=JSON.parse(await fs.readFile('output/playtest/package.json','utf8'));
await fs.writeFile('runtime-manifest.json',JSON.stringify({files:inventory.files},null,2));
