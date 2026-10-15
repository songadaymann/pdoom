// The Doom status bar in the real game: WAD pixels, layout, values and the
// mugshot reacting to native events. Needs Chrome and the server on 5198.
//   npm run test:doom:statusbar         (unit test + this suite)
//   DOOM_CASES=desktop-events,meadow node scripts/statusbar-browser-smoke.mjs
// Screenshots (full page + 1:1 bar crop) and report.json go to output/doom-hud/qa/.
// Every case loads ?ceo=doomguy, so your own body wears Doomguy's WAD face and the
// pixel checks compare against the WAD; scripts/ceo-pick-browser-smoke.mjs covers the CEO faces.
import {startGame} from './doom-qa-ui.mjs';
import {escapeHelpers} from './escape-browser-helpers.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/doom-hud/qa',selected=process.env.DOOM_CASES?.split(',');await fs.mkdir(out,{recursive:true});
const CASES=['desktop-events','desktop-hunter-aim-and-hit','desktop-transfer-and-loss','desktop-face-fallback','desktop-patches-missing','touch-portrait','touch-landscape','meadow'];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={suite:'statusbar-browser-smoke',modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],
 methodology:'Real Chrome, real GZDoom WebAssembly game. Inputs are real keyboard/touch; setup uses the native console warp/kill commands and the local ?dev=end fixture, as the other p(DOOM) suites do. The face is sampled every 20 ms inside the page so short faces are not missed.'};
const FACE_SETS=['doomguy','liron','stuart','eliezer','hinton','holly'];
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,predicate,label,timeout=15000){
 const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(predicate(s))return s;await p.waitForTimeout(100);}throw Error(label+': '+JSON.stringify((await read(p)).statusBar));
}
// Console keys go straight to the engine (Enter is not a page game control, and kill closes the console natively).
const raw=(p,code,key,keyCode)=>p.evaluate(({code,key,keyCode})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode,which:keyCode,bubbles:true,cancelable:true}});},{code,key,keyCode});
async function command(p,text){
 await raw(p,'Backquote','`',192);await p.waitForTimeout(500);
 await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);
 await raw(p,'Enter','Enter',13);await p.waitForTimeout(300);if(text!=='kill')await raw(p,'Backquote','`',192);await p.waitForTimeout(500);
}
async function face(p,angle){for(let i=0;i<16;i++){const {world:w}=await read(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}throw Error('Facing failed');}
async function warp(p,x,y,angle){await command(p,`warp ${x} ${y}`);await wait(p,s=>Math.hypot(s.world.x-x,s.world.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function press(p,key){await p.keyboard.press(key,{delay:80});await p.waitForTimeout(250);}
// Same native crawl movement as escape-browser-smoke.mjs (for the shared escape helpers).
async function crawlAxis(p,axis,target){
 await face(p,90);
 for(let i=0;i<65;i++){
  const {world:w}=await read(p),delta=target-w[axis];
  if(Math.abs(delta)<6)return w;
  const key=axis==='x'?(delta>0?'KeyD':'KeyA'):(delta>0?'KeyW':'KeyS');
  await p.keyboard.down(key);await p.waitForTimeout(Math.min(450,Math.max(28,Math.abs(delta)*9)));
  await p.keyboard.up(key);await p.waitForTimeout(160);
 }
 throw Error('Crawl movement '+axis+' to '+target);
}
// Samples the bar every 20 ms in the page, so short faces are not missed.
async function record(p){await p.evaluate(()=>{window.__sb=[];clearInterval(window.__sbTimer);window.__sbTimer=setInterval(()=>{const s=JSON.parse(window.render_game_to_text()),b=s.statusBar;if(b)window.__sb.push({t:Math.round(performance.now()),face:b.face,set:b.faceSet,drawn:b.drawnFace?.set,tic:b.tic,priority:b.priority,health:s.world?.health,controlled:s.world?.controlled,aim:s.world?.hunter_aim,aimDiff:b.aimDiff,held:b.attackHeld,drawnLump:b.drawnFace?.lump,drawnHealth:b.drawnHealth});},20);});}
const trace=p=>p.evaluate(()=>window.__sb);
async function seen(p,test,label,timeout=3000){const end=Date.now()+timeout;while(Date.now()<end){const log=await trace(p),hit=log.find(test);if(hit)return hit;await p.waitForTimeout(60);}throw Error(label+': '+JSON.stringify((await trace(p)).slice(-40).map(e=>e.face)));}
async function shot(p,d,label){
 const s=await read(p);(d.samples??={})[label]={statusBar:{...s.statusBar,values:s.statusBar?.values},world:{health:s.world?.health,controlled:s.world?.controlled,freed:s.world?.freed,alive:s.world?.alive,sheltered:s.world?.sheltered,cameras_broken:s.world?.cameras_broken,tool:s.world?.tool,ammo:s.world?.ammo}};
 const file=`${out}/${d.name}-${label}.png`;await p.screenshot({path:file});(d.screenshots??=[]).push(file);
 if(await p.locator('.doom-statusbar canvas').isVisible()){const bar=`${out}/${d.name}-${label}-bar.png`;await p.locator('.doom-statusbar').screenshot({path:bar});d.screenshots.push(bar);}
 return s;
}
// The face pixels on the bar canvas equal the face PNG it claims to draw (and, for
// Doomguy, the WAD's own STF* patch): proves the per-character set is really used.
async function facePixels(p,reference){
 for(let attempt=0;attempt<6;attempt++){
  const r=await p.evaluate(async reference=>{
   const s=JSON.parse(window.render_game_to_text()).statusBar,f=s.drawnFace;if(!f)return {ok:false,reason:'nothing drawn'};
   // The canvas redraws every other frame: until it shows the state's current face
   // (its own set, or the Doomguy fallback) it still holds the previous body's.
   if(f.lump!==s.face||f.set!==s.faceSet&&f.set!=='doomguy')return {ok:false,reason:'canvas not redrawn yet',drawn:f,stateFace:s.face,stateSet:s.faceSet};
   const bar=document.querySelector('.doom-statusbar canvas.statusbar').getContext('2d').getImageData(0,0,320,32).data;
   const src=reference==='wad'?`local/ui/stbar/${f.lump}.png`:f.src,img=new Image();img.src=src;await img.decode();
   const g=new OffscreenCanvas(img.width,img.height).getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,img.width,img.height).data;
   let opaque=0,mismatch=0;
   for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
    const i=(y*img.width+x)*4,bx=f.x+x,by=f.y+y;if(!d[i+3]||bx<0||by<0||bx>=320||by>=32)continue;opaque++;
    const j=(by*320+bx)*4;if(bar[j]!==d[i]||bar[j+1]!==d[i+1]||bar[j+2]!==d[i+2])mismatch++;
   }
   return {ok:opaque>300&&mismatch===0,opaque,mismatch,set:f.set,lump:f.lump,src,stateFace:s.face,stateSet:s.faceSet};
  },reference);
  if(r.ok)return r;await p.waitForTimeout(120);
  if(attempt===5)throw Error('Face pixels: '+JSON.stringify(r));
 }
}
function checkValues(s){
 const b=s.statusBar,w=s.world;
 assert.equal(b.ready,true);assert.equal(b.error,null);
 assert.equal(b.values.health,s.mode==='lost'?0:Math.max(0,w.health));assert.equal(b.values.pdoom,s.survivalEstimate.doom);assert.equal(b.values.pdoom,100-s.survivalEstimate.survival);
 assert.deepEqual(b.values.tallies,[[w.cameras_broken,w.cameras_total],[w.freed,5],[w.sheltered,5],[w.alive,6]]);
 assert.deepEqual(b.values.items,[!!w.wrench,!!w.key,!!w.charge]);
 assert.equal(b.values.ammo,w.tool===1&&w.gun?w.ammo:null);
 assert.deepEqual(b.values.freed,w.people.map(h=>!h.alive?'lost':h.released?'freed':'captive'));
 assert.equal(b.values.refuge,w.refuge_known?(w.in_refuge&&s.mode!=='lost'?1:0):null,'Refuge cell yellow only while a living body is inside');
}
async function legacyText(p,s){
 assert.equal(await p.locator('#health').textContent(),`${Math.max(0,s.world.health)}%`);
 assert.equal(await p.locator('#survival').textContent(),`${s.survivalEstimate.survival===100?'':'≈'}${s.survivalEstimate.survival}%`);
 assert.equal(await p.locator('#doom-chance').textContent(),`p(DOOM) ${s.survivalEstimate.doom===0?'':'≈'}${s.survivalEstimate.doom}%`);
 assert.equal(await p.locator('#camera-tally').innerText(),`CAMERAS ${s.world.cameras_broken}/${s.world.cameras_total}`);
 assert.equal(await p.locator('#camera-tally').getAttribute('aria-label'),`${s.world.cameras_broken} of ${s.world.cameras_total} cameras destroyed`);
}
async function geometry(p,viewport){
 assert.equal(await p.locator('.doom-statusbar canvas').isVisible(),true,'Bar canvas visible');
 const bar=await p.locator('.doom-statusbar').boundingBox(),view=await p.locator('#canvas').boundingBox(),art=await p.locator('.doom-statusbar canvas').boundingBox();
 assert.ok(Math.abs(bar.width-view.width)<1.5,'Bar spans the game view');assert.ok(Math.abs(bar.x-view.x)<1.5);
 assert.ok(Math.abs(bar.height-view.height*32/200)<1.5,'Bar is 32/200 of the view');
 assert.deepEqual([art.width,art.height].map(Math.round),[bar.width,bar.height].map(Math.round));
 assert.ok(bar.x>=0&&bar.y>=0&&bar.x+bar.width<=viewport.width+1&&bar.y+bar.height<=viewport.height+1,'Bar inside viewport');
 assert.equal(await p.locator('.doom-statusbar canvas').evaluate(c=>getComputedStyle(c).imageRendering),'pixelated');
 // Each text element sits over the panel that draws it (screen readers, tests).
 for(const [id,x0,x1] of [['#health',49,104],['#rescue-slots',104,144],['#hud-face',143,178],['#survival',178,236],['#doom-chance',178,236],['#equipment',236,250],['#camera-tally',250,320],['#group',250,320]]){
  const r=await p.locator(id).boundingBox();assert.ok(r,id+' has a box');
  assert.ok(r.x>=bar.x+bar.width*x0/320-1&&r.x+r.width<=bar.x+bar.width*x1/320+1&&r.y>=bar.y-1&&r.y+r.height<=bar.y+bar.height+1,id+' over its panel');
 }
 return {bar,view};
}
async function run(name,url,options,test,{allowErrors=[],requireReady=true}={}){
 if(selected&&!selected.includes(name))return;
 const d={name,url,passed:false,errors:[]},c=await browser.newContext(options),p=await c.newPage();const started=Date.now();
 try{
  p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!allowErrors.some(r=>r.test(m.text())))d.errors.push(m.text());});
  await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  if(options.route)await c.route(options.route.pattern,options.route.handler);
  await p.goto(url);await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35&&(s.statusBar?.ready||!requireReady&&s.statusBar),'Boot',55000);
  await p.waitForTimeout(600);await test(p,d,c);
  d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
  assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;
 }catch(e){d.failure=String(e);d.final=await read(p).then(s=>({mode:s.mode,statusBar:s.statusBar,world:s.world&&{health:s.world.health,controlled:s.world.controlled,alive:s.world.alive}})).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 d.seconds=Math.round((Date.now()-started)/1000);
 report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure)+` (${d.seconds}s)`);
}
const desktop={viewport:{width:1280,height:800}},base='http://127.0.0.1:5198/';
const touch=viewport=>({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
try{
 await run('desktop-events',base+'?ceo=doomguy',desktop,async(p,d)=>{
  const start=await read(p);checkValues(start);await legacyText(p,start);d.geometry=await geometry(p,desktop.viewport);
  assert.equal(start.statusBar.faceSet,'doomguy');assert.equal(start.statusBar.painLevel,0);assert.equal(start.statusBar.values.ammo,null,'Empty hands blank AMMO like the fist');
  assert.deepEqual(start.statusBar.values.freed,['captive','captive','captive','captive','captive']);assert.equal(start.statusBar.values.refuge,null);
  assert.equal(start.statusBar.values.pdoom,88,'Opening p(DOOM) is 100 - 12');
  d.faceSetsLoaded=(await wait(p,s=>s.statusBar.faceSetsLoaded.length===6,'All six face sets load',10000)).statusBar.faceSetsLoaded;
  d.startFace=await facePixels(p,'wad');assert.equal(d.startFace.set,'doomguy');
  // Idle: Doom's straight faces, a new random look every TICRATE/2.
  await record(p);await p.waitForTimeout(3200);
  const idle=await trace(p),faces=new Set(idle.map(e=>e.face));
  assert.ok([...faces].every(f=>/^STFST0[012]$/.test(f)),[...faces].join());assert.ok(faces.size>=2,'Face looks back and forth');
  const changes=idle.filter((e,i)=>i&&e.tic!==idle[i-1].tic&&e.face!==idle[i-1].face).map(e=>e.tic);
  d.idleChangeTics=changes;assert.ok(changes.slice(1).every((t,i)=>t-changes[i]>=15),'Idle face holds each look for TICRATE/2');
  for(const lump of ['STFST00','STFST01','STFST02'])await seen(p,e=>e.face===lump,'Idle face '+lump,10000);
  d.idleFaces=[...new Set((await trace(p)).map(e=>e.face))];await shot(p,d,'idle');
  // Doom's menu pauses the game; the face clock freezes with it.
  await press(p,'Escape');await p.waitForTimeout(700);const pausedAt=(await read(p)).statusBar;await p.waitForTimeout(1500);const still=(await read(p)).statusBar;
  assert.equal(still.tic,pausedAt.tic,'Face clock frozen while paused');assert.equal(still.face,pausedAt.face);d.pause={tic:still.tic,face:still.face};
  await press(p,'Escape');await p.waitForTimeout(800);assert.ok((await read(p)).statusBar.tic>still.tic,'Face clock resumes');
  // Hidden tab: the bar's own pause (also used by platform panels).
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const hiddenAt=(await read(p)).statusBar;assert.equal(hiddenAt.paused,true);await p.waitForTimeout(900);assert.equal((await read(p)).statusBar.tic,hiddenAt.tic,'Face clock frozen while the tab is hidden');
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(500);assert.equal((await read(p)).statusBar.paused,false);
  await record(p);await face(p,90);await press(p,'KeyE');const armed=await wait(p,s=>s.world.wrench===1,'Wrench pickup');
  await seen(p,e=>e.face==='STFEVL0','Evil grin on pickup');await shot(p,d,'grin-wrench');
  checkValues(await read(p));assert.deepEqual((await read(p)).statusBar.values.items,[true,false,false],'Wrench in the first key slot');assert.equal(armed.statusBar.values.ammo,null,'Wrench blanks AMMO');
  // Holding the fire input for 2 s: Doom's rampage face, gone soon after release.
  await wait(p,s=>s.statusBar.priority===0,'Grin over');await record(p);
  await p.keyboard.down('Control');const held=await seen(p,e=>e.face==='STFKILL0'&&e.priority===5,'Rampage face while holding attack',4500);
  const heldFrom=(await trace(p)).find(e=>e.held);d.heldRampage={afterMs:held.t-heldFrom.t};assert.ok(held.t-heldFrom.t>=1700,'Rampage needs ~2 s of attack');
  await shot(p,d,'held-rampage');await p.keyboard.up('Control');
  await wait(p,s=>/^STFST0/.test(s.statusBar.face),'Straight face after release',3000);
  // Swinging again and again also counts as attacking.
  await wait(p,s=>s.statusBar.priority===0,'Calm');await record(p);
  for(let i=0;i<12;i++){await p.keyboard.press('Control',{delay:60});await p.waitForTimeout(190);}
  d.swingRampage=await seen(p,e=>e.face==='STFKILL0'&&e.priority===5,'Rampage face while swinging');await shot(p,d,'swing-rampage');
  await warp(p,1948,1144,90);await wait(p,s=>s.statusBar.priority===0,'Calm');await record(p);await press(p,'Control');await wait(p,s=>s.world.cameras_broken===1,'Camera destroyed');
  await seen(p,e=>e.face==='STFKILL0'&&e.priority===6,'Rampage after a camera');await shot(p,d,'camera-rampage');
  const camera=await read(p);checkValues(camera);await legacyText(p,camera);assert.deepEqual(camera.statusBar.values.tallies[0],[1,9]);
  await warp(p,1936,1000,270);await wait(p,s=>s.statusBar.priority<8,'Face free for a grin');await record(p);await press(p,'KeyE');await wait(p,s=>s.world.freed===1,'Rescue Milo');
  await seen(p,e=>e.face==='STFEVL0','Evil grin on rescue');const rescued=await shot(p,d,'rescue-grin');
  checkValues(rescued);assert.deepEqual(rescued.statusBar.values.freed,['freed','captive','captive','captive','captive']);assert.deepEqual(rescued.statusBar.values.tallies[1],[1,5]);
  assert.ok(rescued.statusBar.values.pdoom<camera.statusBar.values.pdoom,'A rescue lowers p(DOOM)');
  // The warp lands on the slingshot, which is picked up on contact: record from before the warp.
  await wait(p,s=>s.statusBar.priority<8,'Grin over');await record(p);await warp(p,832,1528,90);await press(p,'KeyE');await wait(p,s=>s.world.gun===1,'Gun pickup');
  await seen(p,e=>e.face==='STFEVL0','Evil grin on the gun');
  const gun=await wait(p,s=>s.world.tool===1,'Gun in hand');checkValues(gun);assert.equal(gun.statusBar.values.ammo,gun.world.ammo);assert.ok(gun.world.ammo>0);await shot(p,d,'gun-ammo');
  await press(p,'Control');const fired=await wait(p,s=>s.world.ammo===gun.world.ammo-1,'Shot spends a round');checkValues(fired);assert.equal(fired.statusBar.values.ammo,gun.world.ammo-1);
  await press(p,'KeyT');const wrench=await wait(p,s=>s.world.tool===0,'Wrench in hand');assert.equal(wrench.statusBar.values.ammo,null,'AMMO blank again with the wrench');
 });
 await run('desktop-hunter-aim-and-hit',base+'?ceo=doomguy',desktop,async(p,d)=>{
  // Stand where the hunter finds you, side-on to it: its aim turns the face toward
  // it; the 30-point shot is a big hit, so Doom's ouch face; then pain level 1.
  await warp(p,-1104,1664);const w=(await read(p)).world;const toHunter=(Math.atan2(w.hunter_y-w.y,w.hunter_x-w.x)*180/Math.PI+360)%360;
  await face(p,(toHunter+270)%360);await record(p);d.toHunter=toHunter;
  const turn=await seen(p,e=>/^STFT[LR]00$/.test(e.face)&&e.aim>0&&e.priority===6.5,'Face turns toward a hunter aiming from the side',25000);d.turn=turn;await shot(p,d,'aim-turn');
  assert.equal(turn.face,turn.aimDiff>0?'STFTL00':'STFTR00','Turns toward the side the hunter is on');assert.ok(Math.abs(turn.aimDiff)>=45);
  await wait(p,s=>s.world.health===70,'Native hunter hit',30000);
  const ouch=await seen(p,e=>e.face==='STFOUCH1','Ouch face on a 30-point hunter shot');d.ouch=ouch;await shot(p,d,'ouch');
  await wait(p,s=>s.statusBar.face!=='STFOUCH1','Ouch ends',4000);
  const log=await trace(p);d.faceTrace=[...new Set(log.map(e=>e.face))];
  const ouchTics=log.filter(e=>e.face==='STFOUCH1');d.ouchTics=ouchTics.at(-1).tic-ouchTics[0].tic+1;assert.ok(d.ouchTics>=30,'Ouch holds for about TICRATE');
  const after=await read(p);checkValues(after);await legacyText(p,after);assert.equal(after.statusBar.painLevel,1);
  await p.waitForTimeout(1500);assert.match((await read(p)).statusBar.face,/^STF(ST1[012]|T[LR]10|KILL1|OUCH1)$/,'Pain level 1 faces after the hit');
  const later=await shot(p,d,'pain1');d.pain1Face=later.statusBar.face;
 });
 await run('desktop-transfer-and-loss',base+'?ceo=doomguy&dev=end',desktop,async(p,d)=>{
  const gathered=await read(p);checkValues(gathered);await legacyText(p,gathered);
  assert.deepEqual(gathered.statusBar.values.freed,['freed','freed','freed','freed','freed']);assert.notEqual(gathered.statusBar.values.refuge,null,'Refuge marker once known');
  assert.deepEqual(gathered.statusBar.values.tallies.slice(1),[[5,5],[gathered.world.sheltered,5],[6,6]]);
  await wait(p,s=>s.statusBar.faceSetsLoaded.length===6,'All six face sets load',10000);
  await shot(p,d,'gathered');
  await record(p);await command(p,'kill');const moved=await wait(p,s=>s.world.alive===5&&s.world.controlled>0,'Body transfer');
  const dead=await seen(p,e=>e.face==='STFDEAD0'&&e.set==='doomguy','Lost body shows its dead face');d.deadFace=dead;
  await shot(p,d,'dead-doomguy');
  const id=FACE_SETS[moved.world.controlled];d.companion=id;
  const now=await wait(p,s=>s.statusBar.faceSet===id&&s.statusBar.face!=='STFDEAD0','Companion face set',5000);
  checkValues(now);assert.equal(await p.locator('#hud-portrait').getAttribute('src'),`outside-assets/person-${moved.world.controlled-1}-0-0.png`);
  assert.deepEqual(now.statusBar.values.freed.filter(x=>x==='lost'),[],'Your own body is not a prisoner slot');assert.deepEqual(now.statusBar.values.tallies[3],[5,6]);
  const log=await trace(p),deadTics=log.filter(e=>e.face==='STFDEAD0');assert.ok(deadTics.at(-1).t-deadTics[0].t>=700,'Dead face held before the companion takes over');
  const drawnDead=log.filter(e=>e.drawnLump==='STFDEAD0');assert.ok(drawnDead.length>0&&drawnDead.every(e=>e.drawnHealth===0),'HEALTH reads 0% while the lost body\'s dead face is drawn');
  d.companionFace=await facePixels(p);assert.equal(d.companionFace.set,id,'Companion face drawn from its own set');assert.match(d.companionFace.src,new RegExp(`local/ui/faces/${id}/STF`));
  await shot(p,d,'companion-'+id);
  // Second transfer: the face set follows whoever you are now.
  await record(p);await command(p,'kill');const second=await wait(p,s=>s.world.alive===4&&s.world.controlled>0&&s.world.controlled!==moved.world.controlled,'Second transfer');
  await seen(p,e=>e.face==='STFDEAD0'&&e.set===id,'Companion dead face before the next body');
  const id2=FACE_SETS[second.world.controlled];d.companion2=id2;await wait(p,s=>s.statusBar.faceSet===id2&&s.statusBar.face!=='STFDEAD0','Second companion face set',5000);
  d.companion2Face=await facePixels(p);assert.equal(d.companion2Face.set,id2);await shot(p,d,'companion-'+id2);
  const lostSlot=(await read(p)).statusBar.values.freed;assert.equal(lostSlot[moved.world.controlled-1],'lost','A lost prisoner turns red in FREED');
  // The remaining three transfers: every companion's own face set is drawn in turn.
  d.companionsDrawn=[id,id2];
  for(let remaining=3;remaining>=0;remaining--){
   await command(p,'kill');const s=await wait(p,s=>s.world.alive===remaining||s.mode==='lost','Loss '+remaining,8000);
   if(s.mode==='lost'||!(s.world.controlled>0))continue;
   const next=FACE_SETS[s.world.controlled];await wait(p,s=>s.statusBar.faceSet===next&&s.statusBar.face!=='STFDEAD0','Face set '+next,5000);
   const pixels=await facePixels(p);assert.equal(pixels.set,next,next+' drawn from its own set');d.companionsDrawn.push(next);
  }
  assert.deepEqual([...d.companionsDrawn].sort(),FACE_SETS.slice(1).sort(),'All five companions drawn with their own faces');
  const lost=await wait(p,s=>s.mode==='lost'&&s.statusBar.face==='STFDEAD0','Last body lost',10000);
  checkValues(lost);assert.equal(lost.statusBar.values.health,0);assert.equal(lost.statusBar.values.pdoom,100);assert.equal(lost.statusBar.alarm,true,'p(DOOM) alarm at 100%');
  assert.equal(await p.locator('.doom-statusbar canvas').isVisible(),true,'Bar stays up with the dead face');
  await shot(p,d,'lost');
 });
 await run('desktop-face-fallback',base+'?ceo=doomguy&dev=end',{...desktop,route:{pattern:/\/local\/ui\/faces\/(liron|stuart|eliezer|hinton|holly)\//,handler:route=>route.fulfill({status:404,body:''})}},async(p,d)=>{
  // Without a companion's face set the bar still draws: Doomguy's face, never a hole.
  const start=await read(p);assert.deepEqual(start.statusBar.faceSetsLoaded,['doomguy']);
  await command(p,'kill');const moved=await wait(p,s=>s.world.alive===5&&s.world.controlled>0,'Body transfer');
  const id=FACE_SETS[moved.world.controlled];await wait(p,s=>s.statusBar.faceSet===id&&s.statusBar.face!=='STFDEAD0','Companion face set selected',5000);
  d.fallback=await facePixels(p);assert.equal(d.fallback.set,'doomguy','Falls back to Doomguy');checkValues(await read(p));await shot(p,d,'fallback-'+id);
 },{allowErrors:[/Failed to load resource.*404/]});
 await run('desktop-patches-missing',base+'?ceo=doomguy',{...desktop,route:{pattern:/\/local\/ui\/stbar\/manifest\.json/,handler:route=>route.fulfill({status:404,body:''})}},async(p,d)=>{
  // Without the WAD-derived patches (build not run) the same values show as plain text.
  const s=await wait(p,s=>s.statusBar.error,'Status bar reports the missing patches',10000);d.error=s.statusBar.error;
  assert.equal(s.statusBar.ready,false);assert.equal(await p.locator('.doom-statusbar.statusbar-unavailable').count(),1);
  assert.equal(await p.locator('.doom-statusbar canvas').isVisible(),false);
  for(const id of ['#health','#survival','#camera-tally'])assert.equal(await p.locator(id).evaluate(e=>getComputedStyle(e).opacity),'1',id+' readable');
  await legacyText(p,s);await shot(p,d,'text-fallback');
 },{allowErrors:[/Failed to load resource.*404/],requireReady:false});
 for(const [name,viewport]of [['touch-portrait',{width:390,height:844}],['touch-landscape',{width:844,height:390}]])await run(name,base+'?ceo=doomguy&dev=end',touch(viewport),async(p,d)=>{
  const s=await read(p);checkValues(s);await legacyText(p,s);const {bar}=await geometry(p,viewport);
  const overlap=await p.evaluate(()=>{const a=document.querySelector('.doom-statusbar').getBoundingClientRect();return [...document.querySelectorAll('#touch button,#restart,#show-score,#people,#message')].filter(b=>{const st=getComputedStyle(b),r=b.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0&&a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;}).map(b=>b.id||b.textContent);});
  assert.deepEqual(overlap,[],'Bar overlaps no controls or text');
  const tally=await p.locator('#camera-tally').boundingBox();assert.ok(tally.x>=bar.x&&tally.x+tally.width<=bar.x+bar.width+1&&tally.y>=bar.y&&tally.y+tally.height<=bar.y+bar.height+1,'Tally text sits on the CAMS row');
  // Touch Swing button held for 2 s: the rampage face (touch fire counts as held).
  await record(p);const swing=await p.locator('#attack-button').boundingBox(),cdp=await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:swing.x+swing.width/2,y:swing.y+swing.height/2}]});
  d.touchRampage=await seen(p,e=>/^STFKILL/.test(e.face)&&e.priority===5,'Rampage while the touch Swing button is held',5000);
  await shot(p,d,'hud-rampage');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait(p,s=>!s.statusBar.attackHeld,'Touch release clears the held attack',2000);
 });
 await run('meadow',base+'?ceo=doomguy&dev=end',desktop,async(p,d)=>{
  const shotName=async(p,name)=>{if(['meadow-reveal','meadow-gathered'].includes(name))await shot(p,d,name);};
  const {bolts,toMeadow}=escapeHelpers({read,warp:(p,x,y,d,angle)=>warp(p,x,y,angle),command,face,crawlAxis,shot:shotName});
  assert.equal(await p.locator('.doom-statusbar canvas').isVisible(),true);
  const escape={};await bolts(p,escape);await toMeadow(p,escape);d.saved=escape.won.escape.saved;
  const s=await read(p);assert.ok(s.outside,'In the meadow');
  assert.equal(await p.locator('.doom-statusbar canvas').isVisible(),false,'The heavy bar drops away in the meadow');
  const tic=s.statusBar.tic;await p.waitForTimeout(800);assert.equal((await read(p)).statusBar.tic,tic,'Face loop stopped in the meadow');
  assert.equal(await p.locator('#camera-tally').isVisible(),true,'Compact camera tally stays');
  assert.equal(await p.locator('#camera-tally').innerText(),`CAMERAS ${s.world.cameras_broken}/${s.world.cameras_total}`);
  const box=await p.locator('#camera-tally').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1280&&box.y+box.height<=800,'Tally inside the viewport');
  assert.ok((await p.locator('#group').textContent()).length>0,'Survivor line stays');
  await shot(p,d,'meadow-hud');
 });
}finally{report.passed=report.cases.length===(selected?.length??CASES.length)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);console.log(JSON.stringify(report.cases.map(({name,passed,failure,seconds})=>({name,passed,failure,seconds}))));process.exit(report.passed?0:1);}
