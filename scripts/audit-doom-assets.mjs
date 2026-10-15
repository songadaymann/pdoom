// Read-only runtime inventory. Never publishes or copies the private IWAD/media.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {createHash} from 'node:crypto';
import {AssetLoader} from '../doom-web/asset-loader.js';
const root='doom-web',out='output/onboarding/assets';await fs.mkdir(out,{recursive:true});
const files=new Set();
async function add(name){await fs.stat(path.join(root,name));files.add(name);}
async function directory(name,filter=()=>true){for(const e of await fs.readdir(path.join(root,name),{withFileTypes:true})){const n=path.posix.join(name,e.name);if(e.isDirectory())await directory(n,filter);else if(filter(n))await add(n);}}
for(const e of await fs.readdir(root,{withFileTypes:true}))if(e.isFile()&&/\.(js|css|html|cfg|json|png|pk3)$/.test(e.name))await add(e.name);
for(const n of ['engine/engine.worker.js','engine/gzdoom.js','engine/gzdoom.wasm','engine/gzdoom.pk3','engine/game_support.pk3','engine/game_widescreen_gfx.pk3','engine/brightmaps.pk3','engine/lights.pk3','engine/LICENSE','engine/provenance.json','local/DOOM.WAD','local/rescue-music.ogg','local/ui/doom-small.ttf','local/ui/doom-numbers.ttf','local/ui/pdoom-logo.png','local/ui/title-heroes.webp','local/ui/interpic.png','local/ui/menu-skull.png','local/ui/shotgun.png','local/ui/doom-success.wav','local/outside/doom-wall.png','outside/outside.js','music/bliss.mp3'])await add(n);
await directory('local/ui/stbar',n=>/\.(png|json)$/.test(n));
// SAFE MODE hub exteriors from the local IWAD (scripts/build-hub-assets.py): HAL's station walls,
// torch flipbooks and each doorway's still; ship the folder whole so a new one cannot be left behind.
await directory('local/outside',n=>/\.png$/.test(n));
await add('local/prologue-music.ogg');
await add('local/station-music.ogg');
// The prologue's yard reuses the intake track; the Bliss guide's recorded lines are fetched by name.
await add('local/intake-music.ogg');
await directory('outside-assets/voice',n=>/\.(mp3|json)$/.test(n));
// In-game voice lines (scripts/import-voice-lines.py) and their manifest.
await directory('voice',n=>/\.(mp3|json)$/.test(n));
// Status-bar manifests describe all playable faces and their fallback.
const st=JSON.parse(await fs.readFile(root+'/local/ui/stbar/manifest.json','utf8'));
for(const face of Object.values(st.faces)){for(const lump of Object.keys(face.lumps))await add(face.path+lump+'.png');}
// Read the actually shipped cast module to avoid depending on source schema.
const {CAST_IDS}=await import('../doom-web/cast-art.js');
for(const id of CAST_IDS)for(let f=0;f<4;f++)for(let a=0;a<8;a++)await add(`outside-assets/figure-${id}-${f}-${a}.png`);
// survival-estimate.js shows the controlled person's portrait (index 0-4).
for(let i=0;i<5;i++)await add(`outside-assets/person-${i}-0-0.png`);
// Everything the meadow loads by name lives here (guide walk/idle/handoff frames, cast
// figures, portraits, voice); ship the folder whole so new frames cannot be left behind.
await directory('outside-assets',n=>/\.(png|json|mp3)$/.test(n));
const intro=JSON.parse(await fs.readFile(root+'/local/intro/manifest.json','utf8')),levels=JSON.parse(await fs.readFile(root+'/local/intro/levels/manifest.json','utf8'));
await add('local/intro/manifest.json');await add('local/intro/levels/manifest.json');
for(const entry of [...Object.values(intro),...Object.values(levels).map(v=>v.landscape)])for(const n of [entry.file,entry.poster].filter(Boolean))await add('local/'+n);
function atoms(bytes){let at=0,result=[];while(at+8<=bytes.length){let size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(size===1)size=Number(bytes.readBigUInt64BE(at+8));if(size===0)size=bytes.length-at;if(size<8||at+size>bytes.length)break;result.push(type);at+=size;}return result;}
const rows=[];for(const file of [...files].sort()){const bytes=await fs.readFile(path.join(root,file)),row={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};if(/\.(js|css|html|json|cfg|ttf|wasm|wad)$/i.test(file)){row.gzip=gzipSync(bytes,{level:9}).length;row.brotli=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}).length;}if(file.endsWith('.mp4')){const a=atoms(bytes);row.fastStart=a.includes('moov')&&a.indexOf('moov')<a.indexOf('mdat');}rows.push(row);}
const shared=new AssetLoader().urls,selected=rows.filter(r=>shared.includes(r.file));
const report={generated:new Date().toISOString(),status:'LOCAL PRIVATE INVENTORY ONLY; NOT A PUBLIC RELEASE PACKAGE',files:rows.length,runtimeBytes:rows.reduce((s,r)=>s+r.bytes,0),sharedStartup:{bytes:selected.reduce((s,r)=>s+r.bytes,0),gzipEstimate:selected.reduce((s,r)=>s+(r.gzip??r.bytes),0),brotliEstimate:selected.reduce((s,r)=>s+(r.brotli??r.bytes),0)},largest:rows.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,12),movies:rows.filter(r=>r.file.endsWith('.mp4')),excluded:['dev/','local/promo/','local/extracted/','output/','source maps','vertical social films','old Mario reference/master art','private QA packs'],notes:['Compression sizes are estimates; the local server deliberately serves uncompressed no-store assets.','Public release still requires its approved asset source, cache policy and live-domain checks.','SAFE MODE module, figures and Bliss music load on first outside entry, not at title startup.'],rows};
await fs.writeFile(out+'/runtime-inventory.json',JSON.stringify(report,null,2));await fs.writeFile(out+'/runtime-paths.txt',[...files].sort().join('\n')+'\n');console.log(JSON.stringify({files:report.files,sharedStartup:report.sharedStartup,movies:report.movies.map(({file,bytes,fastStart})=>({file,bytes,fastStart})),report:out+'/runtime-inventory.json'},null,2));
