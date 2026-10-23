// Level 4, Daniel Kokotajlo's rescue (AgenticKokotajlo.zs), headless and muted.
// python3 scripts/build-agentic-preview.py --resources-only --only kokotajlo --out output/agentic/qa-kokotajlo.pk3
// node scripts/agentic-kokotajlo-smoke.mjs
//   CASES=cold,bite,autocrouch,slowdown,siege,siege3,camera,race,signlate,qa,exit,smith,crushed
// cold: a cold start (no ?puzzle=): the crushers run from load (each with its engine mover in stasis), the
//   room-37 stimpack waits by the pad, SMITH's intro is the core's, no faults.
// bite: a crusher stops on you and bites 10 at a time, and you can walk out from under it.
// autocrouch: walking (and crouch-walking) into a crusher that is coming down stops you at its edge, standing,
//   unbitten; you go through once it has risen past your head (review: the auto-crouch pulled you under).
// slowdown: walk the crusher corridor with real input timed against the crushers (no damage), step on the
//   lit pad (bay door opens), refuse three times ($1M, $10M, $100M, chimes, alarms; the first brings SMITH
//   out of C8), hold the bay for the 30 s countdown (stunning SMITH when he gets there), the pod opens
//   (ending slowdown, SMITH x0.8), the crushers stop fully raised, and Daniel leads you back out.
// siege: the countdown pauses while you're out of the bay (SLOWDOWN PAUSED) and resumes when you're back;
//   SMITH, brought out of C8, reaches the bay before it ends (the hold is contested); then he gives up
//   (dissolves back to his cross hall).
// siege3: the same with three others freed first (SMITH at 0.9^3): reports how much is still contested.
// camera: while this rescue walks SMITH to the NDA (outside the harvester: the core does, pointed at its
//   mouth; inside: this rescue does), a camera that sees you still brings him.
// race: sign at once (ending race, SMITH x1.2), crushers raised, Daniel steps out of the bay, his list closes.
// signlate: refuse twice (the first chime brings SMITH), then sign: SMITH's list says the race, not GET SIGNATURE.
// qa: a QA release in the middle of the countdown stops everything (crushers up, countdown off).
// exit: ?puzzle=exit frees everyone at load; the crushers go up and stay.
// smith: a camera brings SMITH to the corridor's east end; he follows you through the running crushers,
//   waiting for each one and never standing under a low one, into the bay; he talks and grabs as usual.
// crushed: dying under a crusher is reported as the crusher's (PDOOM_AGENTIC killed_by).
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/kokotajlo';await fs.mkdir(out,{recursive:true});
const PK3=process.env.PK3||'output/agentic/qa-kokotajlo.pk3';
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
// Crusher sectors 2, 21, 23, 46, 48 (west to east): x0,x1,y0,y1 (23 stops at passage 28), map tops; floors 64.
const CRUSH=[[320,384,-464,-240],[608,736,-464,-240],[960,1088,-464,-256],[1248,1376,-464,-240],[1600,1664,-464,-240]],TOPS=[136,160,160,160,192],FIT=64+56;
const POD=[852,-220],SIGN=[800,-224],REFUSE=[908,-224],IN_BAY=[856,-160];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,pk3:PK3,cases:[],errors:[]};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,900));};
const wait_=ms=>new Promise(r=>setTimeout(r,ms));

async function session(name,fn,{puzzle='kokotajlo'}={}){
 if(puzzle==='none')puzzle=undefined;
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  qa=await bootAgentic(page,{puzzle,pk3:PK3});
  await page.evaluate(()=>{window.__VOICES__=[];setInterval(()=>{try{const v=JSON.parse(window.render_game_to_text()).dialogue?.voice;if(v&&!window.__VOICES__.includes(v))window.__VOICES__.push(v);}catch{}},50);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  await fn({page,...qa,shot,detail,voices,engine});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{const s=await qa?.read();detail.final={world:s?.world&&{x:s.world.x,y:s.world.y,health:s.world.health,prompt:s.world.prompt,message:s.world.message},agentic:s?.agentic};detail.voices=await page.evaluate(()=>window.__VOICES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
const here=s=>[s.world.x,s.world.y];
// Real walking toward a point: turn, then hold forward in short bursts; fails when it stops making progress.
async function walkTo({read,face,hold},x,y,{near=20,timeout=20000}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const w=(await read()).world,d=Math.hypot(x-w.x,y-w.y);if(d<near)return w;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${w.x},${w.y}`);
  await face(angleTo(w,x,y));await hold('KeyW',Math.min(450,Math.max(90,d*2.6)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
// Glides: Doom's friction carries you on ~30 u after a short burst, so the waits stand well clear.
// Cross crusher k with real input: face the way through, wait until it is on its way up, then hold forward
// (the player can't step under it until it clears a head, and then has its whole open window).
async function cross({page,read,face},k,to,detail){
 let s=await read();await face(angleTo(s.world,...to));s=await read();let last=s.agentic.crusher_ceil[k],tries=0;
 // Waiting with your shoulder in its doorway would hold it down on you: wait clear of it.
 assert.ok(s.world.x+16<=CRUSH[k][0]||s.world.x-16>=CRUSH[k][1],`waiting clear of crusher ${k} (at ${here(s)})`);
 const end=Date.now()+15000;
 for(;;){
  if(Date.now()>end)throw Error(`crusher ${k} never opened`);
  await wait_(60);s=await read();const c=s.agentic.crusher_ceil[k],d=s.agentic.crusher_dir[k];
  if(d===1&&c<TOPS[k]-6)break;last=c;tries++;
 }
 const health=s.world.health,start=s.agentic.crusher_ceil[k];
 await page.keyboard.down('KeyW');
 let minHead=1e9,under=0;const t0=Date.now();
 try{
  while(Date.now()-t0<6000){
   s=await read();
   const x=s.world.x,y=s.world.y;
   // Properly under it (2 u in: a player stopped at its edge while it is low only touches the line).
   if(x+16>CRUSH[k][0]+2&&x-16<CRUSH[k][1]-2&&y-16<CRUSH[k][3]-2){under++;minHead=Math.min(minHead,s.agentic.crusher_ceil[k]);}
   if(Math.hypot(x-to[0],y-to[1])<20)break;
   const want=angleTo(s.world,...to),off=((want-s.world.angle+540)%360)-180;
   if(Math.abs(off)>12&&Math.hypot(x-to[0],y-to[1])>48){await page.keyboard.up('KeyW');await face(want);await page.keyboard.down('KeyW');}
   await wait_(40);
  }
 }finally{await page.keyboard.up('KeyW');}
 await wait_(150);s=await read();
 assert.ok(Math.hypot(s.world.x-to[0],s.world.y-to[1])<64,`crossed crusher ${k} (at ${here(s)})`);
 (detail.crossings??=[]).push({crusher:k,startCeil:start,lowestCeilWhileUnder:minHead===1e9?null:minHead,polls:under,health:[health,s.world.health]});
 return s;
}
const SITE=[208,-352],C8_SPOT=[1936,-240],C3_SPOT=[144,1200];
const smithOf=s=>[s.agentic.smith_x,s.agentic.smith_y];
// Bay 29 or its doorway 30 (where the countdown runs).
const inBay=([x,y])=>x>768&&x<936&&y>-240&&y<-112;
// The harvester: the crusher corridor (x 320..1664), passage 28, room 26 and the bay.
const inHarvester=([x,y])=>x>320&&x<1664&&y>-464&&y<112;
// Refuse at the DON'T SIGN panel (real input) until n refusals in all.
async function refuse({read,wait,face,press},n){
 let s=await read();await face(angleTo(s.world,...REFUSE));
 while(s.agentic.nda_refusals<n){
  const k=s.agentic.nda_refusals+1;
  await wait(s=>s.world.prompt==='SPACE - refuse to sign','Refuse prompt',4000);
  await press('Space');s=await wait(s=>s.agentic.nda_refusals>=k,`Refusal ${k}`,3000);
  if(k<n)await wait_(400);
 }
 return s;
}
// One wrench swing at SMITH when he's within reach and not already stunned (real input).
async function stunIfNear({read,face,hold},detail){
 let s=await read();const sm=smithOf(s);
 if(dist(sm,here(s))>=90||s.agentic.smith_mode===4)return false;
 await face(angleTo(s.world,...sm));await hold('ControlLeft',120);
 s=await read();if(s.agentic.smith_mode===4)detail.stuns=(detail.stuns||0)+1;
 return true;
}
// Into the bay the way a player does: across the pad's W1 line (door 30 opens), through the doorway.
async function padIn(qa){
 const {read,wait,warp,face,hold}=qa;
 await warp(880,48,0);await walkTo(qa,944,16,{near:14});
 await wait(s=>s.agentic.bay_door===1,'Pad opens the bay door',5000);
 await walkTo(qa,892,-60);await walkTo(qa,892,-140);await walkTo(qa,...IN_BAY,{near:12});
 return read();
}

try{
 await session('cold',async({read,wait,detail,engine})=>{
  let s=await read();assert.equal(s.agentic.site,0);assert.equal(s.agentic.crushers,1);
  assert.equal(s.agentic.crusher_movers,5,'each crusher holds an engine mover (in stasis)');
  assert.equal(s.agentic.stim_moved,1,'the room-37 stimpack waits by the pad');
  const a=s.agentic.crusher_ceil.slice();
  s=await wait(s=>s.agentic.smith_mode===3,'SMITH intro beat',25000);
  assert.ok(s.agentic.crusher_ceil.some((c,i)=>c!==a[i]),'crushers running from load');assert.equal(s.agentic.smith_driven,0);
  s=await wait(s=>s.agentic.smith_mode===0,'SMITH walks off after the intro',15000);assert.equal(s.agentic.smith_driven,0);
  assert.equal(s.agentic.crusher_movers,5,'the movers stay (stasis, not removed)');
  detail.cold={ceil:s.agentic.crusher_ceil,movers:s.agentic.crusher_movers,soundWarnings:engine.filter(l=>/(unknown|missing|not found|could not).*sound|sound.*(unknown|not found|missing)/i.test(l)).slice(0,5)};
  assert.equal(detail.cold.soundWarnings.length,0,'no missing sounds');
 },{puzzle:'none'});

 // A crusher stops on whoever is under it and bites 10 at a time; walking out ends it.
 await session('bite',async({page,read,wait,warp,face,hold,shot,detail})=>{
  let s=await read();assert.ok(dist(here(s),SITE)<24,`corridor west end (${here(s)})`);
  assert.equal(s.agentic.crushers,1,'crushers running');assert.deepEqual(s.agentic.crusher_ceil.length,5);
  const a=s.agentic.crusher_ceil.slice();await wait_(1200);s=await read();
  assert.ok(s.agentic.crusher_ceil.some((c,i)=>c!==a[i]),'crushers moving');
  // Under crusher 21 (sector 21) while it is high and about to come down.
  s=await wait(s=>s.agentic.crusher_dir[1]===-1&&s.agentic.crusher_ceil[1]>=150,'Crusher 21 starting down',15000);
  await warp(672,-352,0);s=await read();const h0=s.world.health;
  const seen=[];const t0=Date.now();
  while(Date.now()-t0<4500){s=await read();seen.push([s.world.ticks,s.world.health,s.agentic.crusher_ceil[1],s.agentic.crouch]);if(s.world.health<=h0-30)break;await wait_(60);}
  await shot('bite-pinned');
  assert.ok(seen.some(([,h])=>h<h0),'the crusher bit');
  const lowest=Math.min(...seen.map(r=>r[2]));
  assert.ok(lowest>=FIT-1,`it stopped on the player's head (lowest ${lowest})`);
  assert.ok(seen.every(r=>r[3]>=.99),'standing: the auto-crouch never ducked you lower under it');
  const drops=[...new Set(seen.map(r=>r[1]))].sort((x,y)=>y-x);
  assert.ok(drops.every((h,i)=>i===0||(drops[i-1]-h)===10),`bites of 10 (${drops})`);
  detail.bite={start:h0,healths:drops,lowestCeil:lowest};
  // Walk out east; it carries on down behind you.
  await hold('KeyW',900);s=await read();const after=s.world.health;detail.bite.walkedOutTo=here(s);
  assert.ok(s.world.x>736+16,`walked out from under it (${here(s)})`);
  s=await wait(s=>s.agentic.crusher_ceil[1]<FIT-10,'It goes on down once you are out',6000);
  await wait_(600);s=await read();assert.equal(s.world.health,after,'no more bites once out');
  detail.bite.end=s.world.health;
 });

 // Review (major): Actors.zs's auto-crouch ducked a player walking into a crusher on its way down under it,
 // and it bit them to 30. Now a crusher lower than your head is a wall to you, and you stay standing.
 await session('autocrouch',async({page,read,wait,warp,face,hold,shot,detail})=>{
  const LEFT=CRUSH[1][0],RIGHT=CRUSH[1][1];
  const walkInto=async(label,{dirWant,want,keys=['KeyW'],ms=5000})=>{
   // Warp clear of it and let any glide from the last run die out (a box left over its edge would be bitten).
   await warp(520,-352,0);await wait_(700);let s=await read();
   assert.ok(s.world.x+16<=LEFT-24,`standing clear of crusher 21 (${here(s)})`);
   s=await wait(s=>s.agentic.crusher_dir[1]===dirWant&&Math.abs(s.agentic.crusher_ceil[1]-want)<=3,`${label}: crusher 21 at ${want}`,25000);
   const h0=s.world.health,rows=[];let shotTaken=false;
   for(const k of keys)await page.keyboard.down(k);
   const t0=Date.now();
   try{
    while(Date.now()-t0<ms){
     s=await read();const x=s.world.x,c=s.agentic.crusher_ceil[1];
     rows.push([s.world.ticks,Math.round(x),c,s.agentic.crusher_dir[1],s.world.health,s.agentic.crouch]);
     if(!shotTaken&&label==='down'&&x>=585&&c<100){shotTaken=true;await shot('autocrouch-blocked');}
     if(x>RIGHT+40)break;await wait_(50);
    }
   }finally{for(const k of keys)await page.keyboard.up(k);}
   const underLow=rows.filter(r=>r[1]+16>LEFT+1&&r[1]-16<RIGHT-1&&r[2]<FIT-2);
   const atEdge=rows.filter(r=>r[1]+16<=LEFT+1&&r[2]<FIT);
   const out={start:want,dir:dirWant,underLow:underLow.length,healthLost:h0-rows[rows.length-1][4],lowestCrouchAtEdge:Math.min(1,...atEdge.map(r=>r[5])),blockedPolls:atEdge.length,end:rows[rows.length-1],rows:rows.filter((r,i)=>i%3===0)};
   (detail.autocrouch??={})[label]=out;
   assert.equal(out.underLow,0,`${label}: never under crusher 21 while it is lower than a head`);
   assert.equal(out.healthLost,0,`${label}: no bites`);
   return out;
  };
  // Walking at it while it comes down (the review's repro): stopped at its edge, standing, then through.
  let r=await walkInto('down',{dirWant:-1,want:108});
  assert.ok(r.blockedPolls>3,'held at the edge while it was low');
  assert.ok(r.lowestCrouchAtEdge>=.99,`not ducked at the edge (crouch ${r.lowestCrouchAtEdge})`);
  assert.ok(r.end[1]>RIGHT,'went through once it rose past your head');
  // Walking at it while it rises from low: the same.
  r=await walkInto('up',{dirWant:1,want:96});
  assert.ok(r.end[1]>RIGHT,'went through once it rose past your head');
  // Holding the crouch key yourself doesn't creep you under it either.
  r=await walkInto('crouch-key',{dirWant:-1,want:110,keys:['KeyC','KeyW'],ms:2500});
  assert.ok(r.blockedPolls>3,'crouch-walking: held at the edge too');
 });

 // The corridor with real input, the pad, three refusals, the hold, and Daniel leading you out.
 await session('slowdown',async(qa)=>{
  const {page,read,wait,warp,face,hold,press,command,shot,detail,voices}=qa;
  let s=await read();assert.ok(dist(here(s),SITE)<24,`corridor west end (${here(s)})`);assert.ok(Math.abs(((s.world.angle+540)%360)-180)<6,'facing east');
  await shot('corridor-start');
  // West to east: crusher 2, corridor 22, crusher 21, corridor 24, crusher 23 and north into passage 28.
  await walkTo(qa,272,-352,{near:12});
  s=await cross(qa,0,[416,-352],detail);
  await walkTo(qa,548,-352,{near:12});
  s=await read();await face(0);await wait_(200);await shot('corridor-crusher21');
  s=await cross(qa,1,[764,-352],detail);
  await walkTo(qa,900,-340,{near:12});
  s=await cross(qa,2,[1060,-210],detail);
  s=await read();detail.healthAfterCorridor=s.world.health;
  assert.equal(s.world.health,100,'timed the crushers: no bites');
  // Passage 28 into dark room 26; the lit pad.
  await walkTo(qa,1024,-160);await walkTo(qa,1184,-160);await walkTo(qa,1184,-80);
  s=await read();assert.equal(s.agentic.bay_door,0,'bay shut before the pad');
  await face(angleTo(s.world,928,32));await wait_(300);await shot('dark-room');
  await walkTo(qa,912,40,{near:14});
  s=await wait(s=>s.agentic.bay_door===1,'Pad opens the bay door',5000);
  await face(angleTo(s.world,1040,72));await wait_(300);await shot('pad-room-lit');
  await face(270);await wait_(400);await shot('bay-door-open');
  await walkTo(qa,892,-60);await walkTo(qa,892,-140);await walkTo(qa,...IN_BAY,{near:12});
  s=await read();await face(270);await wait_(300);await shot('bay-pod');
  // SIGN is beside the pod too: looking at DON'T SIGN gives only its own prompt.
  await face(angleTo(s.world,...REFUSE));
  s=await wait(s=>s.world.prompt==='SPACE - refuse to sign','Refuse prompt');
  const alarms0=s.agentic.alarm_count;let thirdAt=0;
  const offers=['EQUITY OFFERED: $1M','EQUITY OFFERED: $10M','EQUITY OFFERED: $100M'];
  for(let i=0;i<3;i++){
   await wait(s=>s.world.prompt==='SPACE - refuse to sign','Refuse prompt again',3000);
   await press('Space');
   s=await wait(s=>s.agentic.nda_refusals===i+1&&s.world.message===offers[i],`Refusal ${i+1}: ${offers[i]}`,3000);
   assert.equal(s.agentic.alarm_count,alarms0+i+1,'an alarm at the bay each time');thirdAt=s.world.ticks;
   if(i===0){assert.equal(s.agentic.summoned,8,'the first chime brings SMITH out of C8');assert.ok(dist(smithOf(s),C8_SPOT)<64,`SMITH at C8's spot (${smithOf(s)})`);await shot('refuse-1');}
   if(i<2)await wait_(700);
  }
  // The first chime brought SMITH out of C8 (corridor 49), the camera nearest the harvester.
  assert.equal(s.agentic.summoned,8,'SMITH summoned at C8');
  await wait_(300);await shot('refuse-3');
  // Both panels are inert now.
  s=await read();assert.equal(s.world.prompt,'','no prompt at DON\'T SIGN after the third');
  await face(angleTo(s.world,...SIGN));await wait_(300);s=await read();
  assert.equal(s.world.prompt,'','no prompt at SIGN after the third');
  s=await wait(s=>s.agentic.countdown>=25,'Countdown running',3000);detail.countdownStart=s.agentic.countdown;
  assert.ok(s.agentic.countdown<=30);
  // Hold the bay (god from here: SMITH is coming), stunning him whenever he reaches you.
  await command('god');
  const seen=new Set();const t0=Date.now();let arrived=null;
  while(Date.now()-t0<60000){
   s=await read();const m=/^SLOWDOWN IN (\d+)$/.exec(s.world.message||'');if(m)seen.add(+m[1]);
   if(s.agentic.freed&4)break;
   if(arrived===null&&(inBay(smithOf(s))||dist(smithOf(s),here(s))<128))arrived={tick:s.world.ticks-thirdAt,countdown:s.agentic.countdown};
   if(seen.size===6)await shot('countdown');
   if(!(await stunIfNear(qa,detail)))await wait_(150);
  }
  detail.countdownSeen=[...seen].sort((a,b)=>b-a);detail.countdownTicks=s.world.ticks-thirdAt;detail.smithArrived=arrived;
  assert.ok(s.agentic.freed&4,'Daniel freed by the countdown');
  assert.ok(seen.size>=20,`status counted down (${detail.countdownSeen})`);
  assert.ok(detail.countdownTicks>=1040&&detail.countdownTicks<=1090,`about 30 s held (${detail.countdownTicks} tics)`);
  assert.equal(s.agentic.ending,'slowdown');assert.equal(s.agentic.pod_open,1);
  assert.ok(Math.abs(s.agentic.smith_pace-0.72)<.005,`SMITH x0.8 (pace ${s.agentic.smith_pace} with one freed)`);
  await face(270);await wait_(500);await shot('pod-open-slowdown');
  assert.equal(s.agentic.todo,'1. GET SIGNATURE (DECLINED)|2. SLOW DOWN','SMITH\'s list closes on the slowdown');
  // Crushers stop for good, fully raised to the map's own tops.
  s=await wait(s=>s.agentic.crushers===0&&s.agentic.crusher_ceil.every((c,i)=>c===TOPS[i]),'Crushers stopped fully raised',4000);
  await wait_(2500);s=await read();assert.deepEqual(s.agentic.crusher_ceil,TOPS,'and they stay up');
  for(let i=0;i<40&&!(await voices()).includes('smith-slowdown');i++)await wait_(250);
  const v=await voices();
  for(const key of ['daniel-hold','smith-spot-3','daniel-slowdown-guide','smith-slowdown'])assert.ok(v.includes(key),`${key} line`);
  // Daniel leads you out: through the bay door, room 26, passage 28, the whole crusher corridor, room 3,
  // the bridge and into the refuge. You follow a little behind him along that way (real walking), stunning
  // SMITH and stopping a possession if he gets to you.
  const way=[[880,-160],[892,-60],[1184,-80],[1184,-160],[1024,-160],[1024,-300],[848,-352],[300,-352],[48,-336],[48,-144],[-16,-112],[-150,-100],[-250,-100]];
  const line=[];for(let i=1;i<way.length;i++){const [a,b]=[way[i-1],way[i]],n=Math.ceil(dist(a,b)/16);for(let j=0;j<n;j++)line.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  line.push(way[way.length-1]);
  const along=p=>{let best=0,d=1e9;for(let i=0;i<line.length;i++){const e=dist(p,line[i]);if(e<d){d=e;best=i;}}return best;};
  let last=null,lastTick=0,jump=0,minX=1e9,shotCorridor=false,danielMax=0;detail.unpossessed=0;const end=Date.now()+200000;
  while(Date.now()<end){
   s=await read();const d=s.world.people[2],p=[d.x,d.y];
   if(last&&s.world.ticks>lastTick)jump=Math.max(jump,dist(last,p)/(s.world.ticks-lastTick));last=p;lastTick=s.world.ticks;
   if(d.y<-256)minX=Math.min(minX,d.x);
   if(!shotCorridor&&d.y<-256&&d.x<700){shotCorridor=true;await face(angleTo(s.world,...p));await wait_(150);await shot('escort-corridor');}
   if(s.agentic.introduced)break;
   if(await stunIfNear(qa,detail))continue;
   if(s.agentic.possessed&4){
    (detail.possessions??=[]).push({tick:s.world.ticks,you:here(s).map(Math.round),daniel:p.map(Math.round),smith:smithOf(s).map(Math.round),mode:s.agentic.smith_mode,camera:s.agentic.spot_camera});
    await walkTo(qa,d.x,d.y,{near:56,timeout:8000}).catch(()=>{});s=await read();await face(angleTo(s.world,s.world.people[2].x,s.world.people[2].y));
    if(await wait(s=>s.world.prompt==='SPACE - stop generating','Stop generating prompt',3000).catch(()=>null)){await press('Space');detail.unpossessed++;}
    continue;
   }
   const me=along(here(s)),him=along(p);danielMax=Math.max(danielMax,him);
   if(him-me>4||d.sheltered){const t=line[Math.min(line.length-1,me+3)];await face(angleTo(s.world,...t));await hold('KeyW',160);}
   else await wait_(200);
  }
  detail.escort={possessions:(detail.possessions||[]).slice(0,12),maxSpeed:+jump.toFixed(1),westmostInCorridor:minX,danielProgress:`${danielMax}/${line.length}`,crushersDuring:s.agentic.crusher_ceil,daniel:[s.world.people[2].x,s.world.people[2].y],you:here(s),unpossessed:detail.unpossessed};
  assert.ok(minX<330,`Daniel walked the corridor out to room 3 (westmost ${minX})`);
  assert.equal(s.agentic.introduced,1,'Daniel brought you to the refuge');assert.ok(jump<=18.5,`no teleport (fastest ${jump} u/tic)`);
  await face(0);await shot('escort-refuge');
 });

 // Review (major): the hold was never contested and leaving the bay cost nothing.
 await session('siege',async(qa)=>{
  const {page,read,wait,warp,face,hold,press,command,shot,detail,voices}=qa;
  await command('god');
  let s=await padIn(qa);
  await wait_(3000);   // SMITH out on his patrol first
  s=await refuse(qa,1);assert.equal(s.agentic.summoned,8,'SMITH summoned at C8');
  assert.ok(dist(smithOf(s),C8_SPOT)<64,`SMITH at C8's spot (${smithOf(s)})`);
  s=await refuse(qa,3);const third=s.world.ticks;
  // Countdown runs while you stand in the bay; step out and it waits.
  s=await wait(s=>s.agentic.countdown>0&&s.agentic.countdown<=27&&/^SLOWDOWN IN/.test(s.world.message),'Countdown under way',6000);
  await walkTo(qa,896,-72,{near:14});
  s=await wait(s=>s.agentic.countdown_held===0&&s.world.message==='SLOWDOWN PAUSED','SLOWDOWN PAUSED once out of the bay',3000);
  const frozen=s.agentic.countdown;await face(270);await wait_(2000);s=await read();
  assert.equal(s.agentic.countdown,frozen,'the countdown waits while you are out');
  assert.equal(s.world.message,'SLOWDOWN PAUSED','the paused line stays up');
  await shot('countdown-paused');
  detail.pause={frozenAt:frozen,pausedTics:s.agentic.countdown_paused};
  await walkTo(qa,...IN_BAY,{near:12});
  s=await wait(s=>s.agentic.countdown_held===1&&/^SLOWDOWN IN \d+$/.test(s.world.message),'Counting again back in the bay',3000);
  await wait_(1500);const back=await read();assert.ok(back.agentic.countdown<frozen,`resumed (${frozen} -> ${back.agentic.countdown})`);
  // Hold: SMITH comes through crushers 48, 46 and 23 and reaches the bay before it ends.
  const track=[];let arrived=null,entered=null;const t0=Date.now();
  while(Date.now()-t0<60000){
   s=await read();const sm=smithOf(s);
   track.push([s.world.ticks-third,Math.round(sm[0]),Math.round(sm[1]),s.agentic.smith_mode,s.agentic.smith_driven,s.agentic.countdown]);
   if(entered===null&&inHarvester(sm))entered={tick:s.world.ticks-third,countdown:s.agentic.countdown};
   if(arrived===null&&(inBay(sm)||dist(sm,here(s))<128)){arrived={tick:s.world.ticks-third,countdown:s.agentic.countdown};await face(angleTo(s.world,...sm));await shot('siege-smith-in-bay');}
   if(s.agentic.freed&4)break;
   if(!(await stunIfNear(qa,detail)))await wait_(150);
  }
  detail.siege={entered,arrived,stuns:detail.stuns||0,track:track.filter((r,i)=>i%6===0)};
  assert.ok(s.agentic.freed&4,'released by the countdown');assert.equal(s.agentic.ending,'slowdown');
  assert.ok(arrived&&arrived.countdown>0,`SMITH reached the bay while it was still to be held (${JSON.stringify(arrived)})`);
  // It gives up: it dissolves out of the harvester back to its cross hall, and doesn't hunt you.
  assert.equal(s.agentic.gave_up,1,'SMITH gives up');
  const rel=s.world.ticks;const after=[];
  for(let i=0;i<16;i++){s=await read();after.push([s.world.ticks-rel,s.agentic.smith_mode,s.agentic.smith_driven,Math.round(dist(smithOf(s),here(s)))]);await wait_(250);}
  detail.siege.afterRelease=after.filter((r,i)=>i%3===0);
  assert.ok(after.every(r=>r[1]!==1&&r[2]===0&&r[3]>1500),'SMITH is gone from the harvester and not hunting you');
 });
 // The same hold late in a run: three others already freed (QA, into the refuge), so SMITH is at 0.9^3.
 // Reported, not asserted: how much of the 30 s is still contested when he is that slow.
 await session('siege3',async(qa)=>{
  const {read,wait,command,detail}=qa;
  await command('god');await command('pdoom_development 1');
  for(const i of [0,1,3])await command(`netevent pdoom_agentic_qa_out ${i} 0`);
  let s=await wait(s=>(s.agentic.freed&11)===11,'Three freed first',5000);detail.pace=s.agentic.smith_pace;
  s=await padIn(qa);await wait_(3000);
  s=await refuse(qa,3);const third=s.world.ticks;
  let arrived=null,entered=null;const t0=Date.now();
  while(Date.now()-t0<60000){
   s=await read();const sm=smithOf(s);
   if(entered===null&&inHarvester(sm))entered={tick:s.world.ticks-third,countdown:s.agentic.countdown};
   if(arrived===null&&(inBay(sm)||dist(sm,here(s))<128))arrived={tick:s.world.ticks-third,countdown:s.agentic.countdown};
   if(s.agentic.freed&4)break;
   if(!(await stunIfNear(qa,detail)))await wait_(150);
  }
  detail.siege3={summoned:s.agentic.summoned,entered,arrived,ending:s.agentic.ending};
  assert.ok(s.agentic.freed&4,'released by the countdown');assert.ok(entered,'SMITH came into the harvester during the hold');
 });

 // Review (major): cameras stopped bringing SMITH while this rescue walked him to the NDA alarm.
 await session('camera',async(qa)=>{
  const {page,read,wait,warp,face,hold,press,command,shot,detail}=qa;
  await command('god');
  await warp(...IN_BAY,270);
  let s=await refuse(qa,3);
  assert.equal(s.agentic.summoned,8,'SMITH summoned at C8');
  // Outside the harvester the core walks him (to its east mouth): not this rescue's, so not Busy.
  await wait_(600);s=await read();
  detail.outside={smith:smithOf(s),driven:s.agentic.smith_driven,steered:s.agentic.smith_steered,busy:s.agentic.smith_busy};
  assert.equal(s.agentic.smith_driven,0,'outside: the core walks him');assert.equal(s.agentic.smith_steered,1,'pointed at the harvester mouth');
  assert.equal(s.agentic.smith_busy,0,'not Busy while outside');
  // At the mouth and inside, this rescue walks him...
  s=await wait(s=>s.agentic.smith_driven===1,'This rescue takes him at the mouth',20000);
  detail.inside={smith:smithOf(s),mode:s.agentic.smith_mode};
  // ...and a camera that sees you still brings him (C3, crosswalk 124).
  await warp(176,1100,90);
  s=await wait(s=>s.agentic.spot_camera===2,'C3 sees you',8000);
  s=await wait(s=>dist(smithOf(s),here(s))<160&&s.agentic.smith_mode===1,'SMITH materialises at C3 and hunts you',4000);
  detail.camera={smith:smithOf(s),you:here(s),mode:s.agentic.smith_mode,driven:s.agentic.smith_driven,toSpot:Math.round(dist(smithOf(s),C3_SPOT))};
  assert.equal(s.agentic.smith_driven,0);
  await face(angleTo(s.world,...smithOf(s)));await wait_(300);await shot('camera-during-nda');
  // Far from the harvester the paused countdown isn't repeated on the status line.
  await wait_(2500);s=await read();assert.notEqual(s.world.message,'SLOWDOWN PAUSED','no paused line across the map');
  assert.ok(s.agentic.countdown>0,'still waiting for you in the bay');
 });

 // Sign at once: the race ending.
 await session('race',async({page,read,wait,warp,face,hold,press,command,shot,detail,voices})=>{
  await command('god');
  await warp(...IN_BAY,270);let s=await read();
  await face(angleTo(s.world,...SIGN));
  s=await wait(s=>s.world.prompt==='SPACE - sign the NDA','Sign prompt');
  await press('Space');
  s=await wait(s=>s.agentic.freed&4,'Signed: Daniel freed',3000);
  assert.equal(s.agentic.ending,'race');assert.equal(s.agentic.nda_refusals,0);assert.equal(s.agentic.pod_open,1);
  assert.ok(Math.abs(s.agentic.smith_pace-1.08)<.005,`SMITH x1.2 (pace ${s.agentic.smith_pace} with one freed)`);
  assert.equal(s.agentic.todo,'1. GET SIGNATURE ✓|2. ACCELERATE','SMITH\'s list closes on the race');
  await face(270);await wait_(500);await shot('pod-open-race');
  s=await wait(s=>s.agentic.crushers===0&&s.agentic.crusher_ceil.every((c,i)=>c===TOPS[i]),'Crushers stopped fully raised',4000);
  assert.equal(s.world.prompt,'','panels inert after signing');
  await face(angleTo(s.world,854,-224));await wait_(300);await shot('panels-off');
  for(let i=0;i<40&&!(await voices()).includes('smith-race');i++)await wait_(250);
  const v=await voices();for(const key of ['daniel-signed-guide','smith-race'])assert.ok(v.includes(key),`${key} line`);
  s=await wait(s=>s.world.people[2].y>-100,'Daniel steps out of the bay',12000);
  detail.race={pace:s.agentic.smith_pace,ending:s.agentic.ending,daniel:[s.world.people[2].x,s.world.people[2].y]};
 });

 // Review (minor): after one or two refusals, signing left GET SIGNATURE on SMITH's list for 10 s.
 await session('signlate',async(qa)=>{
  const {read,wait,warp,face,press,command,detail,voices}=qa;
  await command('god');await warp(...IN_BAY,270);
  let s=await refuse(qa,2);assert.equal(s.agentic.todo,'1. GET SIGNATURE|2. RAISE OFFER');
  await face(angleTo(s.world,...SIGN));
  s=await wait(s=>s.world.prompt==='SPACE - sign the NDA','Sign prompt',4000);
  await press('Space');s=await wait(s=>s.agentic.freed&4,'Signed',3000);
  detail.signlate={ending:s.agentic.ending,pace:s.agentic.smith_pace,todo:s.agentic.todo,summoned:s.agentic.summoned};
  assert.equal(s.agentic.ending,'race');assert.equal(s.agentic.todo,'1. GET SIGNATURE ✓|2. ACCELERATE');
  assert.equal(s.agentic.summoned,8,'the first chime brought SMITH out of C8');
 });

 // A release from elsewhere (QA, the hub walk-in) in the middle of the countdown: Released() stops it all.
 await session('qa',async(qa)=>{
  const {read,wait,warp,face,press,command,detail}=qa;
  await command('god');await warp(...IN_BAY,270);
  let s=await refuse(qa,3);
  s=await wait(s=>s.agentic.countdown>0&&s.agentic.countdown<=30,'Countdown running');
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 2 1');
  s=await wait(s=>s.agentic.freed&4,'QA release',4000);
  s=await wait(s=>s.agentic.countdown===0&&s.agentic.crushers===0&&s.agentic.crusher_ceil.every((c,i)=>c===TOPS[i])&&s.agentic.pod_open===1,'Countdown off, crushers up, pod open',4000);
  await wait_(1500);s=await read();assert.equal(s.agentic.countdown,0);assert.deepEqual(s.agentic.crusher_ceil,TOPS);
  assert.ok(!/^SLOWDOWN/.test(s.world.message),'no countdown status after the release');
  assert.equal(s.agentic.smith_driven,0);assert.equal(s.agentic.smith_steered,0,'nothing left pointed at a mouth');
  detail.qa={ending:s.agentic.ending,message:s.world.message,todo:s.agentic.todo};
 });
 await session('exit',async({read,wait,detail})=>{
  let s=await wait(s=>s.agentic.freed===31,'All five freed at ?puzzle=exit');
  s=await wait(s=>s.agentic.crushers===0&&s.agentic.crusher_ceil.every((c,i)=>c===TOPS[i]),'Crushers stopped fully raised',4000);
  await wait_(1500);s=await read();assert.deepEqual(s.agentic.crusher_ceil,TOPS);assert.equal(s.agentic.smith_driven,0);
  detail.exit={ceil:s.agentic.crusher_ceil,pod:s.agentic.pod_open};
 },{puzzle:'exit'});

 // SMITH follows you through the running crushers (this rescue walks him: he times them too).
 await session('smith',async(qa)=>{
  const {page,read,wait,warp,face,hold,press,command,shot,detail,voices}=qa;
  await command('god');
  // C8 (index 7) watches the south side of corridor 49, east of crusher 48.
  const c8=map.cameras.find(c=>c.index===7);
  await warp(1960,-400,90);let s=await read();await face(angleTo(s.world,c8.x,c8.y));
  s=await wait(s=>s.agentic.spot_camera===7&&s.agentic.smith_mode===1,'C8 brings SMITH',15000);
  detail.materialised=smithOf(s);
  await page.evaluate(crush=>{window.__SMITH__={under:[],driven:0,frames:[]};setInterval(()=>{try{const a=JSON.parse(window.render_game_to_text()).agentic;if(!a)return;const x=a.smith_x,y=a.smith_y;if(a.smith_driven){window.__SMITH__.driven++;if(!window.__SMITH__.frames.includes(a.smith_frame))window.__SMITH__.frames.push(a.smith_frame);}
   const k=crush.findIndex(([l,r,b,t])=>x+12>l&&x-12<r&&y-12<t&&y+12>b);if(k>=0)window.__SMITH__.under.push([k,Math.round(x),Math.round(y),a.crusher_ceil[k]]);}catch{}},30);},CRUSH);
  // Lead him west through crusher 48, corridor 50 and crusher 46.
  await walkTo(qa,1716,-352,{near:12});
  s=await cross(qa,4,[1580,-352],detail);
  await walkTo(qa,1430,-352,{near:12});
  s=await cross(qa,3,[1180,-352],detail);
  const samples=async()=>page.evaluate(()=>window.__SMITH__);
  const watch=async(label,done,timeout)=>{
   const t0=Date.now();
   while(Date.now()-t0<timeout){s=await read();if(done(s))return s;await wait_(80);}
   throw Error(label+' '+JSON.stringify({smith:smithOf(s),mode:s.agentic.smith_mode,driven:s.agentic.smith_driven}));
  };
  s=await read();await face(0);
  s=await watch('SMITH in corridor 50',s=>s.agentic.smith_x<1560&&s.agentic.smith_y<-256,60000);await shot('smith-times-crusher');
  // Clear of crusher 46's west edge (he then waits at arm's length from you, Agentic.zs SMITH_STANDOFF).
  s=await watch('SMITH through crushers 48 and 46',s=>s.agentic.smith_x<=CRUSH[3][0]-12&&s.agentic.smith_y<-256,60000);
  assert.ok((await samples()).driven>0,'the rescue walked SMITH (smith_driven)');
  await face(angleTo(s.world,...smithOf(s)));await wait_(200);await shot('smith-in-corridor');
  // He reaches you (arm's length, Agentic.zs SMITH_STANDOFF; grab reach 72) and grabs (pose D, frame 3), as
  // anywhere else; a wrench stun still works on him here.
  s=await wait(s=>dist(smithOf(s),here(s))<72,'SMITH reaches you',15000);
  await wait_(400);await face(angleTo(s.world,...smithOf(s)));await hold('ControlLeft',120);
  s=await wait(s=>s.agentic.smith_mode===4,'Wrench stun',3000);
  // Into passage 28 past crusher 23, through room 26, the pad and the bay door; refuse once there.
  await walkTo(qa,1140,-352,{near:12});
  s=await cross(qa,2,[1000,-210],detail);
  await walkTo(qa,1024,-160);await walkTo(qa,1184,-160);await walkTo(qa,1184,-80);
  await walkTo(qa,912,40,{near:14});await wait(s=>s.agentic.bay_door===1,'Bay door',5000);
  await walkTo(qa,892,-60);await walkTo(qa,892,-140);await walkTo(qa,...IN_BAY,{near:12});
  s=await refuse(qa,1);
  await face(90);
  // He answers the chime (or keeps hunting you): through crusher 23 and room 26 into the bay, or into its
  // doorway (door 30, y -120..-112) when that is already arm's length from you.
  const inBay=s=>s.agentic.smith_y>-240&&s.agentic.smith_y<-112&&s.agentic.smith_x<940&&s.agentic.smith_x>760;
  s=await watch('SMITH comes into the bay',s=>inBay(s)||s.agentic.smith_y<-96&&s.agentic.smith_x<940&&s.agentic.smith_x>760&&dist(smithOf(s),here(s))<=72,60000);
  await face(angleTo(s.world,...smithOf(s)));await wait_(200);await shot('smith-in-bay');
  const all=await samples(),seen=all.under;
  detail.smith={samples:seen.length,lowest:seen.length?Math.min(...seen.map(r=>r[3])):null,crushers:[...new Set(seen.map(r=>r[0]))].sort(),bay:smithOf(s),mode:s.agentic.smith_mode,framesWhileDriven:all.frames,
   low:seen.filter(r=>r[3]<FIT).slice(0,6),perCrusher:Object.fromEntries([...new Set(seen.map(r=>r[0]))].map(k=>[k,{n:seen.filter(r=>r[0]===k).length,lowest:Math.min(...seen.filter(r=>r[0]===k).map(r=>r[3]))}]))};
  for(const k of [2,3,4])assert.ok(detail.smith.crushers.includes(k),`SMITH crossed crusher ${k} (${detail.smith.crushers})`);
  assert.ok(detail.smith.lowest>=FIT,`never under a low crusher (lowest ${detail.smith.lowest})`);
  assert.ok(all.frames.includes(3),`grab pose while this rescue walks him (frames ${all.frames})`);
  const v=await voices();assert.ok(v.some(k=>/^smith-met-/.test(k)),`his first-meeting line (${v})`);
 });

 // Review (minor): a crusher death read CAUGHT BY AGENTIC SMITH. The native side now says whose it was.
 await session('crushed',async({page,read,wait,warp,shot,detail})=>{
  let s=await wait(s=>s.agentic.crusher_dir[1]===-1&&s.agentic.crusher_ceil[1]>=150,'Crusher 21 starting down',15000);
  await warp(672,-352,0);
  s=await wait(s=>s.world.health<=0,'Crushed to death',15000);
  await wait_(800);s=await read();
  detail.crushed={health:s.world.health,killed_by:s.agentic.killed_by,objective:await page.evaluate(()=>document.querySelector('#people')?.textContent)};
  assert.equal(s.agentic.killed_by,'crusher');
  await shot('crushed-dead');
 });
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'kokotajlo smoke passed':'kokotajlo smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
