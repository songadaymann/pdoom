// Level 4 core smoke (Agentic.zs with the rescue stubs or the real rescues), headless and muted.
// node scripts/agentic-core-smoke.mjs   (CASES=cold,hunt,guide,possess,flag-<site>,exit,hub,tour,factory)
// Cold start and pickups, the intro beat, cameras bringing SMITH, the wrench stun, smashing cameras (and C6
// behind glass), the bridge switch, the refuge doorstep, a freed guide walking you home, possession and
// STOP GENERATING, every ?puzzle= site, the payphone exit, a screenshot tour, and level 3 still booting.
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,nativeQA,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/core';await fs.mkdir(out,{recursive:true});
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const SITES=['tallinn','bostrom','kokotajlo','grace','bengio','refuge','exit'];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,cases:[],errors:[]};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,600));};

// One fresh page per case: its own boot, engine log stream and voice-line tally.
async function session(name,fn,{puzzle,factory=false}={}){
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  if(factory){
   await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
   await page.goto(`${ORIGIN}/?level=meg3n-factory&debug`);await startGame(page);qa=nativeQA(page);
   await qa.wait(s=>s.mode==='playing'&&s.factory&&s.world?.ticks>35,'Factory boot',90000);
  }else qa=await bootAgentic(page,{puzzle});
  // Every speaker-box take key seen, polled in the page (the dialogue state only holds the current one).
  await page.evaluate(()=>{window.__VOICES__=[];setInterval(()=>{try{const v=JSON.parse(window.render_game_to_text()).dialogue?.voice;if(v&&!window.__VOICES__.includes(v))window.__VOICES__.push(v);}catch{}},50);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  await fn({page,...qa,shot,detail,voices,engine});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{detail.final=await qa?.read();detail.voices=await page.evaluate(()=>window.__VOICES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
// Real walking toward a point: turn, then hold forward in short bursts; fails when it stops making progress.
async function walkTo({read,face,hold},x,y,{near=24,timeout=20000}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const w=(await read()).world,d=Math.hypot(x-w.x,y-w.y);if(d<near)return w;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${w.x},${w.y}`);
  await face(angleTo(w,x,y));await hold('KeyW',Math.min(450,Math.max(90,d*2.6)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
const here=s=>[s.world.x,s.world.y];
async function swing({hold,read}){const before=(await read()).world.wrench_swings;await hold('ControlLeft',120);return before;}

try{
 await session('cold',async({read,wait,press,hold,face,warp,shot,detail,voices})=>{
  let s=await read();
  assert.equal(s.world.map,'E2M2');assert.ok(dist(here(s),map.start)<24,`start ${here(s)}`);
  assert.equal(s.agentic.bridge_up,0,'bridge sunk on a cold start');assert.equal(s.world.wrench,0);
  await shot('cold-start');
  s=await wait(s=>s.world.prompt==='SPACE - pick up the slingshot','Slingshot prompt');
  await press('Space');s=await wait(s=>s.world.gun===1&&s.world.ammo===5,'Slingshot taken with Space');
  const x0=s.world.x,y0=s.world.y;await hold('KeyS',350);
  s=await wait(s=>Math.hypot(s.world.x-x0,s.world.y-y0)>8,'Walking');detail.walked=Math.round(Math.hypot(s.world.x-x0,s.world.y-y0));
  s=await wait(s=>s.agentic.smith_mode===3,'SMITH intro beat',25000);
  detail.intro={smith:smithAt(s),todo:s.agentic.todo,tick:s.world.ticks};
  assert.ok(dist(smithAt(s),map.cameras[0].spot)<48,`SMITH at C1's spot ${smithAt(s)}`);
  assert.match(s.agentic.todo,/CHECK EAST PODS/);
  // What a player who has not moved sees: the start, facing east through ward window 13.
  await warp(...map.start.slice(0,2),0);await page_wait(500);s=await read();detail.introVisibleFromStart=s.agentic.smith_visible;await shot('smith-intro-start');
  await face(angleTo(s.world,...smithAt(s)));await page_wait(500);s=await read();detail.introVisible=s.agentic.smith_visible;
  await shot('smith-intro');
  assert.ok((await voices()).includes('smith-intro'),'smith-intro line');
  // The red-team pill on alcove 12's floor (pill then lets the browser draw SMITH's list).
  const pill=[-172,-412];await face(angleTo(s.world,...pill));
  for(let i=0;i<8&&(await read()).world.prompt!=='SPACE - take the red-team pill';i++)await hold('KeyW',110);
  await wait(s=>s.world.prompt==='SPACE - take the red-team pill','Pill prompt');
  await press('Space');s=await wait(s=>s.agentic.pill===1&&/RED-TEAM PILL/.test(s.world.message),'Pill taken');
  s=await wait(s=>s.agentic.smith_mode===0,'SMITH walks off after the intro',12000);
  // The bridge switch (line 1336) on alcove 12's north wall raises the nukage bridge to 64.
  assert.equal(s.agentic.bridge_up,0,'bridge still sunk before the switch');
  await warp(-184,-292,90);await wait(s=>s.world.prompt==='','No prompt at the switch');
  await press('Space');s=await wait(s=>s.agentic.bridge_up===1,'Switch raises the bridge',4000);
  await page_wait(2500);await warp(-64,-96);s=await wait(s=>s.world.z>=62,'Standing on the raised bridge',6000);detail.bridgeZ=s.world.z;
  await warp(-20,-540,0);await wait(s=>s.world.prompt==='SPACE - pick up the wrench','Wrench prompt');
  await press('Space');await wait(s=>s.world.wrench===1,'Wrench taken with Space');
 });

 await session('hunt',async({read,wait,press,hold,face,warp,command,shot,detail,voices})=>{
  let s=await read();assert.ok(dist(here(s),[-296,-96])<24,'refuge site');assert.equal(s.world.tool,0,'wrench out');
  await command('god');
  // C1 sees you in room 3: SMITH materialises at its CameraSpot and hunts.
  await warp(60,0);s=await wait(s=>s.agentic.spot_camera===0&&s.agentic.smith_mode===1&&dist(smithAt(s),map.cameras[0].spot)<120,'C1 sees you; SMITH materialises there and hunts',10000);
  detail.materialised={smith:smithAt(s),spot:map.cameras[0].spot,d:Math.round(dist(smithAt(s),map.cameras[0].spot))};
  assert.ok(detail.materialised.d<80,`SMITH appeared at C1's spot (${detail.materialised.d} u away)`);
  await face(angleTo(s.world,...smithAt(s)));await page_wait(400);await shot('smith-at-camera');
  // Into the refuge: it follows to the doorstep in nook 7 and never comes in.
  await warp(-150,-96,180);await press('Space');await page_wait(900);
  await hold('KeyW',650);s=await wait(s=>s.world.in_refuge===1,'In the refuge');
  s=await wait(s=>s.agentic.smith_mode===8&&dist(smithAt(s),[-148,-96])<44,'SMITH on the doorstep',20000);
  let minX=1e9;for(let i=0;i<30;i++){s=await read();minX=Math.min(minX,s.agentic.smith_x);await page_wait(130);}
  detail.doorstep={smith:smithAt(s),minX};assert.ok(minX>-168,`SMITH never entered the refuge (min x ${minX})`);
  await face(0);await page_wait(300);await shot('refuge-doorstep');
  assert.ok((await voices()).includes('smith-refuge'),'smith-refuge line');
  // A wrench swing from the doorway stuns it: from passage 10, still inside the refuge (SMITH waits within
  // 40 u of the doorstep, at arm's length rather than in the door, so room 9 itself is out of wrench reach).
  await warp(-184,-96);s=await read();await face(angleTo(s.world,...smithAt(s)));
  s=await read();detail.stunFrom=Math.round(dist(here(s),smithAt(s)));
  await swing({hold,read});s=await wait(s=>s.agentic.smith_mode===4,'Wrench stun',3000);
  assert.ok((await voices()).includes('smith-stunned'),'smith-stunned line');
  // Smash C1 from beside it (out of its cone).
  await warp(150,-125);s=await read();await face(angleTo(s.world,208,-100));
  await swing({hold,read});s=await wait(s=>s.world.cameras_broken===1&&s.events?.some(e=>e.type==='camera-broken'&&e.index===0),'C1 smashed',3000);
  await page_wait(300);await shot('camera-smashed');
  // C6 is behind glass: the wrench only knocks.
  await warp(1664,1392,90);await page_wait(400);await swing({hold,read});
  s=await wait(s=>/behind glass/.test(s.world.message),'C6 behind glass',3000);
  assert.equal(s.world.cameras_broken,1,'C6 still intact');detail.cameras=[s.world.cameras_broken,s.world.cameras_total];
 },{puzzle:'refuge'});

 await session('guide',async({read,wait,face,hold,warp,command,shot,detail,voices})=>{
  let s=await read();await command('god');
  // Smash C1 first (it watches the bridge), from outside its cone so SMITH never comes.
  await warp(150,-125);s=await read();await face(angleTo(s.world,208,-100));
  await swing({hold,read});await wait(s=>s.world.cameras_broken===1,'C1 smashed quietly',3000);
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 0 1');
  s=await wait(s=>(s.agentic.freed&1)&&s.agentic.guide===0,'Jaan freed as the guide');
  await warp(-40,420);
  s=await wait(s=>dist([s.world.people[0].x,s.world.people[0].y],map.sites[0].exit)<32,'Jaan steps out of the booth',20000);
  // Follow him with real walking along his own trail until he has you both in the refuge.
  const trail=[];let last=null,lastTick=0,jump=0;const end=Date.now()+150000;
  while(Date.now()<end){
   s=await read();const j=s.world.people[0],p=[j.x,j.y];
   // Walking speed is capped at 18 u/tic (Agentic.zs TickPeople); anything faster would be a teleport.
   if(last&&s.world.ticks>lastTick)jump=Math.max(jump,dist(last,p)/(s.world.ticks-lastTick));last=p;lastTick=s.world.ticks;
   if(!trail.length||dist(trail[trail.length-1],p)>24)trail.push(p);
   if(s.agentic.introduced)break;
   while(trail.length>1&&dist(here(s),trail[0])<40)trail.shift();
   const target=j.sheltered?(dist(here(s),trail[0])<40?[-296,-96]:trail[0]):trail[0];
   if(dist(here(s),p)>96||j.sheltered){await face(angleTo(s.world,...target));await hold('KeyW',Math.min(300,Math.max(90,dist(here(s),target)*2)));}
   else await page_wait(200);
  }
  detail.maxSpeed=+jump.toFixed(1);detail.trail=trail.length;
  assert.equal(s.agentic.introduced,1,'Jaan brought you to the refuge');assert.ok(jump<=18.5,`no teleport (fastest ${jump} u/tic)`);
  assert.equal(s.world.people[0].sheltered,1);
  assert.ok((await voices()).includes('jaan-freed-guide'),'jaan-freed-guide line');
  await wait(s=>s.dialogue?.voice==='jaan-safe','jaan-safe line',5000).catch(()=>{});
  assert.ok((await voices()).includes('jaan-safe'),'jaan-safe line');
  await face(0);await shot('guide-refuge');
 },{puzzle:'refuge'});

 await session('possess',async({read,wait,press,face,hold,command,shot,detail,voices})=>{
  let s=await read();await command('god');
  // Jaan into his refuge slot first, so he is the guide and Nick a follower: SMITH (stopping at arm's length)
  // takes a follower trailing you, not a guide waiting out of his range (Agentic.zs POSSESS_RANGE).
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 0 0');await command('netevent pdoom_agentic_qa_out 1 1');
  s=await wait(s=>s.agentic.possessed&2,'SMITH possesses Nick',30000);
  detail.possessedAt={nick:[s.world.people[1].x,s.world.people[1].y],smith:smithAt(s),mode:s.agentic.smith_mode};
  await face(angleTo(s.world,s.world.people[1].x,s.world.people[1].y));await page_wait(300);await shot('possessed');
  const n=s.world.people[1];await walkTo({read,face,hold},n.x,n.y,{near:80});
  s=await read();await face(angleTo(s.world,s.world.people[1].x,s.world.people[1].y));
  await wait(s=>s.world.prompt==='SPACE - stop generating','Stop generating prompt');
  await press('Space');s=await wait(s=>!(s.agentic.possessed&2),'Nick unpossessed',3000);
  // His line queues behind whatever is being said (the freed line is 7 s).
  for(let i=0;i<60&&!(await voices()).includes('nick-unpossessed');i++)await page_wait(250);
  assert.ok((await voices()).includes('nick-unpossessed'),'nick-unpossessed line');
 },{puzzle:'bostrom'});

 for(let i=1;i<=6;i++)await session(`flag-${SITES[i-1]}`,async({read,wait,hold,shot,detail})=>{
  let s=await read();const spot=map.site_spots[String(i)];
  s=await wait(s=>dist(here(s),spot)<24,`At ?puzzle=${i}`);
  assert.equal(s.world.wrench,1);assert.equal(s.world.gun,1);assert.equal(s.world.ammo,5);assert.equal(s.agentic.pill,1);assert.equal(s.agentic.site,i);
  await shot(`puzzle-${SITES[i-1]}`);
  const x0=s.world.x,y0=s.world.y;await hold('KeyW',500);await hold('KeyS',900);
  s=await read();detail.moved=Math.round(Math.max(Math.hypot(s.world.x-x0,s.world.y-y0),0));
  await hold('KeyS',300);const s2=await read();
  assert.ok(Math.hypot(s2.world.x-x0,s2.world.y-y0)>8||detail.moved>8,'can walk away from the spot');
  detail.prompt=s.world.prompt;detail.dialogue=s.dialogue?.voice;
 },{puzzle:i});

 await session('exit',async({read,wait,press,face,hold,warp,command,shot,detail,voices})=>{
  let s=await read();assert.ok(dist(here(s),map.site_spots['7'])<24);assert.equal(s.agentic.freed,31);assert.equal(s.agentic.all_safe,1);
  await command('god');
  s=await wait(s=>s.agentic.phone_ringing===1&&s.agentic.door_camera===1&&s.agentic.smith_mode===9,'Phone rings; SMITH takes the door camera',6000);
  s=await wait(s=>s.agentic.possessed,'The door camera possesses someone',8000);detail.firstPossessed=s.agentic.possessed;
  await shot('exit-armed');
  await warp(-310,-80);s=await read();await face(angleTo(s.world,-240,-48));
  await swing({hold,read});s=await wait(s=>s.agentic.door_camera===2&&s.events?.some(e=>e.type==='camera-broken'&&e.index===9),'Door camera smashed',3000);
  // STOP GENERATING everyone it took (the overflow may free them first).
  const end=Date.now()+40000;let freed=0;
  while(Date.now()<end){
   s=await read();const m=s.agentic.possessed;if(!m)break;
   const i=[0,1,2,3,4].find(i=>m&(1<<i)),p=s.world.people[i];
   if(dist(here(s),[p.x,p.y])>80)await walkTo({read,face,hold},p.x,p.y,{near:70,timeout:8000}).catch(()=>{});
   s=await read();await face(angleTo(s.world,p.x,p.y));
   if((await read()).world.prompt==='SPACE - stop generating'){await press('Space');freed++;}
   await page_wait(250);
  }
  detail.unpossessed=freed;assert.equal((await read()).agentic.possessed,0,'everyone themselves again');
  await walkTo({read,face,hold},-345,-96,{near:20});s=await read();await face(180);
  s=await wait(s=>s.world.prompt==='SPACE - answer the phone','Answer prompt');
  await press('Space');s=await wait(s=>s.events?.some(e=>e.type==='agentic-exit'),'agentic-exit',4000);
  detail.exit=s.events.find(e=>e.type==='agentic-exit');assert.equal(detail.exit.saved,31);
  await shot('exit-answered');
  s=await wait(s=>s.outside?.active&&s.melt.phase==='idle','Melts into the meadow',45000);
  detail.meadow={level:s.outside.currentLevel,saved3:s.campaign?.data?.saved3??null,people:s.outside.saved_visual};await shot('exit-meadow');
  assert.ok((await voices()).includes('smith-exit'),'smith-exit line');
 },{puzzle:'exit'});

 // AGENTIC.BAT's door sends F1 (netevent pdoom_enter_agentic): room 3, wrench in hand, the bridge up.
 await session('hub',async({page,read,wait,command,shot,detail})=>{
  const before=(await read()).world.ticks;
  await command('netevent pdoom_enter_agentic');
  // An open console can swallow main.js's F4 hold release on the map change, and a slow load can outlast one resend:
  // keep releasing (F4 = netevent pdoom_ready, harmless once released) until the new map has applied its hub entry.
  const f4=()=>page.evaluate(()=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code:'F4',key:'F4',keyCode:115,which:115,bubbles:true,cancelable:true}});});
  for(const end=Date.now()+30000;Date.now()<end;){const t=await read();if(t.agentic?.hub_entry===1&&t.world.wrench===1)break;if(t.agentic?.hub_entry===1)await f4();await page.waitForTimeout(500);}
  const s=await wait(s=>s.agentic?.hub_entry===1&&s.world.wrench===1&&s.world.ticks<1400&&dist(here(s),map.hub)<24,'Walked in from AGENTIC.BAT',20000);
  assert.equal(s.world.wrench,1);assert.equal(s.agentic.bridge_up,1);assert.equal(s.world.gun,0);
  detail.hub={at:here(s),angle:s.world.angle,smith_mode:s.agentic.smith_mode};await shot('hub-entry');
 });

 await session('tour',async({read,wait,warp,face,command,shot,detail,page})=>{
  await command('god');
  const stops=[['refuge',-230,-96,180],['ward',-272,-330,30],['harvester',272,-352,0],['band',561,860,180],['farm',288,1120,90],['farm-row',176,1184,120],
   ['lobby',1376,1700,90],['pool',1744,1104,90],['rig',1880,472,0],['east',2384,560,270],['construct',256,-1480,90]];
  detail.stops=[];
  for(const [n,x,y,a] of stops){await warp(x,y,a);await page_wait(700);const s=await read();detail.stops.push([n,Math.round(s.world.x),Math.round(s.world.y),Math.round(s.world.z)]);await shot(`tour-${n}`);}
 },{puzzle:'refuge'});

 await session('factory',async({read,wait,hold,shot,detail})=>{
  let s=await read();assert.equal(s.world.map,'E2M7');const x0=s.world.x,y0=s.world.y;
  await hold('KeyW',500);s=await wait(s=>Math.hypot(s.world.x-x0,s.world.y-y0)>8,'Factory walking');
  detail.factory={level:s.world.level,ticks:s.world.ticks};await shot('factory');
  assert.ok(!('agentic' in s)||!s.agentic,'no agentic state on level 3');
 },{factory:true});
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'agentic core smoke passed':'agentic core smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
function page_wait(ms){return new Promise(r=>setTimeout(r,ms));}
