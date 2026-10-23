// Level 4 rescue 5 smoke: Yoshua Bengio, Take away its tools (doom-mod/actors/AgenticBengio.zs), headless and muted.
//   python3 scripts/build-agentic-preview.py --resources-only --only bengio --out output/agentic/qa-bengio.pk3
//   node scripts/agentic-bengio-smoke.mjs
//   (CASES=solve,called,summon,free,pit,ledge,smithpit,follow,possess,parked)
// solve: walk in, pull blue inside the dial window, red inside the alarm window, then yellow: each cut takes the
//   arm's line with it, the platforms come level with the ledge, the arm's prediction ends, then Yoshua says his
//   line and walks over by himself. called: let the call and the alarm through: SMITH comes, the arm moves on,
//   and pulling all three still frees him. summon: with SMITH far away the call materialises it at hall 41's
//   camera C4 and it walks to the rig. free: a core release (QA netevent) mid-cycle still leaves the platforms
//   level. pit: drop into the platform pit and walk out through sliver 53 into corridor 60.
// Review fixes: ledge: the south wall's 8 u band no longer walks you round to Yoshua at 80 (it opens once he is
//   free). smithpit: with C4 smashed, SMITH chases you to the pit's edge but never ends up stuck down there, and
//   isn't there after you leave by corridor 60. follow: a freed follower stops at the edge and is not left in the
//   pit. possess: with SMITH at the rig, Yoshua is not possessed before he has said his line and stepped off his
//   ledge, and he says it before he moves. parked: yellow pulled first from hall 41: the arm drops the lever
//   (never frame A again) and the platforms sink to the bottom and stop; the rest still frees him.
// Everything the player does is real input (god mode on; the player may be warped, companions never are).
// Writes output/agentic/bengio/report.json and screenshots.
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/bengio';await fs.mkdir(out,{recursive:true});
const PK3=process.env.PK3||'output/agentic/qa-bengio.pk3';
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const props=Object.fromEntries(map.things.filter(t=>t.type===15402).map(t=>[t.arg0,[t.x,t.y]]));
const ARM=props[17],BLUE=props[18],RED=props[19],YELLOW=props[20];
const EXIT=map.sites[4].exit,C4=map.cameras[3],C4SPOT=C4.spot;
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,pk3:PK3,cases:[],errors:[]};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,900));};
const here=s=>[s.world.x,s.world.y];
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
const yoshua=s=>s.world.people[4];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(get,test,label,ms){const end=Date.now()+ms;while(Date.now()<end){if(test(await get()))return;await sleep(150);}throw Error(label);}
// PDAgenticMap.InRigRoom, and "down in the pit" (below the 80 floor by more than a step).
const inRig=(x,y)=>x>1920&&x<2272&&y>368&&y<576;
const inPit=(x,y,z)=>inRig(x,y)&&z<72;

async function session(name,fn,{puzzle='bengio'}={}){
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  qa=await bootAgentic(page,{puzzle,pk3:PK3});
  // In-page sampler (every 50 ms of wall time): voices heard, and a trail of who is where. Reading the state
  // between multi-second player actions misses moments (the old watchYoshua flake).
  await page.evaluate(()=>{window.__VOICES__=[];window.__T__=[];setInterval(()=>{try{const s=JSON.parse(window.render_game_to_text());const d=s.dialogue,v=d?.voice;if(v&&!window.__VOICES__.includes(v))window.__VOICES__.push(v);const w=s.world,a=s.agentic;if(!w||!a)return;const p=w.people||[],r=n=>Math.round(n*10)/10;const t=window.__T__;if(t.length&&t[t.length-1].t===w.ticks)return;t.push({t:w.ticks,me:[r(w.x),r(w.y),r(w.z)],yo:p[4]?[r(p[4].x),r(p[4].y),r(p[4].z)]:null,ka:p[3]?[r(p[3].x),r(p[3].y),r(p[3].z)]:null,sm:[r(a.smith_x),r(a.smith_y),r(a.smith_z)],mode:a.smith_mode,freed:a.freed,poss:a.possessed,voice:d&&d.remaining>0?v:'',tool:a.arm_tool,frame:a.arm_frame,sockets:a.sockets,top:a.rig_top,bottom:a.rig_bottom});if(t.length>6000)t.splice(0,1000);}catch{}},50);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  // A beat first, so the 50 ms sampler has recorded the state the caller just read (it acts on read()).
  const trail=async()=>{await new Promise(r=>setTimeout(r,150));return page.evaluate(()=>window.__T__);};
  await fn({page,...qa,shot,detail,voices,trail,engine});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.engineNotes=engine.filter(l=>/warn|unknown|not found|missing|bengio/i.test(l)&&!/OAL|alIsExtension/.test(l)).slice(-20);
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{detail.final=(await qa?.read())?.agentic;detail.voices=await page.evaluate(()=>window.__VOICES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
// Real walking toward a point: turn, then hold forward in short bursts. Patient mode waits out a
// platform that is too high to step onto yet instead of failing.
async function walkTo({page,read,face,hold},x,y,{near=20,timeout=20000,patient=false,run=false}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const w=(await read()).world,d=Math.hypot(x-w.x,y-w.y);if(d<near)return w;
  if(d<best-3){best=d;stuck=0;}else if(++stuck>6){if(!patient)throw Error(`walkTo ${x},${y} stuck at ${w.x},${w.y},${w.z}`);await sleep(350);best=1e9;stuck=0;}
  await face(angleTo(w,x,y));
  // Running (Shift) covers a short hop in one burst.
  if(run&&d>40){await page.keyboard.down('ShiftLeft');await hold('KeyW',Math.min(500,Math.max(60,d*1.6)));await page.keyboard.up('ShiftLeft');}
  else await hold('KeyW',Math.min(400,Math.max(70,d*2.4)));
 }
 const w=(await read()).world;throw Error(`walkTo ${x},${y} timed out at ${w.x},${w.y},${w.z}`);
}
// Stand in front of a socket and face it until its prompt shows; then Space pulls it.
async function aim(qa,socket,from,colour){
 await walkTo(qa,...from,{near:8,run:true});const s=await qa.read();await qa.face(angleTo(s.world,...socket));
 return qa.wait(s=>s.world.prompt===`SPACE - pull the ${colour} cable`,`${colour} prompt`,3000);
}
async function yank(qa,colour){
 const bit={blue:1,red:2,yellow:4}[colour];
 await qa.press('Space');return qa.wait(s=>(s.agentic.sockets&bit)!==0,`${colour} pulled`,2000);
}
async function pull(qa,socket,from,colour){await aim(qa,socket,from,colour);return yank(qa,colour);}
// The middle of the west strip is within reach of both wall sockets: turn, don't walk.
const MID=[1944,472],BLUE_FROM=MID,RED_FROM=MID,YELLOW_FROM=[1792,450];
// The cut tool's line leaves the speaker box at once (no new text).
async function lineCut(qa,voice){
 const s=await qa.wait(s=>!(s.dialogue?.voice===voice&&s.dialogue.remaining>0),`${voice} line cleared`,600);
 return {voice:s.dialogue?.voice||'',remaining:s.dialogue?.remaining??0};
}
// The player's part while Yoshua walks over: keep SMITH stunned with the wrench and, if it possesses Yoshua
// anyway (once he is out), go over and stop generating him. Done once he is across on the west strip.
async function watchYoshua(qa,timeout=40000){
 const {read,face,hold,press}=qa;
 const end=Date.now()+timeout;let stuns=0,unpossessed=0;
 while(Date.now()<end){
  let s=await read();const y=yoshua(s);
  if(y.x<1990)return {stuns,unpossessed};
  if(s.agentic.smith_mode!==4&&dist(here(s),smithAt(s))<90){await face(angleTo(s.world,...smithAt(s)));await hold('ControlLeft',120);stuns++;continue;}
  if(s.agentic.possessed&16){
   if(dist(here(s),[y.x,y.y])>80)await walkTo(qa,y.x,y.y,{near:70,timeout:6000}).catch(()=>{});
   s=await read();await face(angleTo(s.world,yoshua(s).x,yoshua(s).y));
   if((await read()).world.prompt==='SPACE - stop generating'){await press('Space');unpossessed++;}
   continue;
  }
  await sleep(100);
 }
 throw Error('Yoshua never reached the strip: '+JSON.stringify({stuns,unpossessed}));
}
// From the sampler's trail: Yoshua's walk from his release. He walks (never faster than the escort's 2.5 u/tic
// plus slack), stays at 80 over the platforms, says his freed line before he moves, and is not possessed
// before he has stepped off the ledge to his SiteExit (x within 24 of 1952).
function yoshuaWalk(t){
 const from=t.findIndex(e=>e.freed&16);assert.ok(from>=0,'Yoshua freed in the trail');
 const run=t.slice(from),start=run[0].yo;
 const moved=run.find(e=>dist(e.yo,start)>4),said=run.find(e=>e.voice.startsWith('yoshua-freed'));
 const crossed=run.find(e=>e.yo[0]>1920&&e.yo[0]<1990);
 // His own walk out to his SiteExit (2.5 u/tic); after that the guide keeps pace with you.
 const walk=crossed?run.filter(e=>e.t<=crossed.t):run;
 let fastest=0;for(let i=1;i<walk.length;i++){const dt=walk[i].t-walk[i-1].t;if(dt>0)fastest=Math.max(fastest,dist(walk[i].yo,walk[i-1].yo)/dt);}
 const over=run.filter(e=>e.yo[0]>1984&&e.yo[0]<2176);
 const early=run.find(e=>(e.poss&16)&&e.yo[0]>1976);
 const firstPossessed=run.find(e=>e.poss&16);
 return {freedAt:run[0].t,start,movedAt:moved?.t,saidAt:said?.t,saidVoice:said?.voice,crossedAt:crossed?.t,fastest:+fastest.toFixed(2),
  lowestOver:over.length?Math.min(...over.map(e=>e.yo[2])):null,overSamples:over.length,possessedOnLedge:early?{t:early.t,at:early.yo}:null,
  firstPossessed:firstPossessed?{t:firstPossessed.t,at:firstPossessed.yo}:null};
}
function assertWalk(w){
 assert.ok(w.movedAt&&w.crossedAt,`Yoshua walked over (${JSON.stringify(w)})`);
 assert.ok(w.saidAt!==undefined&&w.saidAt<=w.movedAt,`freed line before he moves (said ${w.saidAt}, moved ${w.movedAt})`);
 assert.ok(w.fastest<=3.2,`Yoshua walked (fastest ${w.fastest} u/tic)`);
 assert.ok(w.overSamples>5&&w.lowestOver>79,`Yoshua crossed at 80 (lowest ${w.lowestOver} over ${w.overSamples} samples)`);
 assert.equal(w.possessedOnLedge,null,`not possessed before he stepped off his ledge (${JSON.stringify(w.possessedOnLedge)})`);
}
// The platforms stay out of reach (never within 24 of the ledge's 80) while the arm works.
async function rigSample(read,ms){let top=-999,bottom=999;const end=Date.now()+ms;while(Date.now()<end){const a=(await read()).agentic;top=Math.max(top,a.rig_top);bottom=Math.min(bottom,a.rig_bottom);await sleep(120);}return {top,bottom};}
// Runs of samples with an actor down in the pit: the longest, in tics.
function pitRuns(t,pick){
 let runs=[],from=null,last=null;
 for(const e of t){const p=pick(e);const down=p&&inPit(...p);if(down&&from===null)from=e.t;if(!down&&from!==null){runs.push(last-from);from=null;}if(down)last=e.t;}
 if(from!==null)runs.push(last-from);return runs;
}
// Off the west strip into the pit (platform 54), then out: across to 51 and north through sliver 53 to corridor 60.
async function dropIn(qa){await walkTo(qa,1956,472,{near:10});await qa.face(0);await qa.hold('KeyW',450);return qa.wait(s=>s.world.x>1990&&s.world.z<60,'Dropped into the pit',4000);}
async function climbOut(qa,to=[2016,1100]){
 await walkTo(qa,2080,548,{near:14,timeout:40000,patient:true});
 await walkTo(qa,2080,600,{near:14,timeout:40000,patient:true});
 await walkTo(qa,2080,690,{near:16,timeout:15000});await walkTo(qa,2016,740,{near:16});
 return walkTo(qa,...to,{near:20,timeout:40000});
}
// Wait for a freed follower to reach you, doing the player's part meanwhile: stun SMITH when it is on top of
// you and stop generating the follower if it gets possessed on the way.
async function escort(qa,index,timeout=90000){
 const bit=1<<index,end=Date.now()+timeout;let stuns=0,unpossessed=0;
 while(Date.now()<end){
  let s=await qa.read();const p=s.world.people[index],d=dist(here(s),[p.x,p.y]);
  if(d<160&&!(s.agentic.possessed&bit))return {stuns,unpossessed};
  if(s.agentic.smith_mode!==4&&dist(here(s),smithAt(s))<90){await qa.face(angleTo(s.world,...smithAt(s)));await qa.hold('ControlLeft',120);stuns++;continue;}
  if((s.agentic.possessed&bit)&&d<700){
   await walkTo(qa,p.x,p.y,{near:70,timeout:8000}).catch(()=>{});
   s=await qa.read();await qa.face(angleTo(s.world,s.world.people[index].x,s.world.people[index].y));
   if((await qa.read()).world.prompt==='SPACE - stop generating'){await qa.press('Space');unpossessed++;}
   continue;
  }
  await sleep(200);
 }
 throw Error('follower never caught up: '+JSON.stringify({stuns,unpossessed}));
}
// Smash hall 41's camera C4 with the wrench from below it.
async function smashC4(qa){
 await walkTo(qa,C4.x,C4.y-68,{near:10});let s=await qa.read();await qa.face(angleTo(s.world,C4.x,C4.y));
 for(let i=0;i<4&&!(await qa.read()).agentic.cameras_broken;i++){await qa.hold('ControlLeft',120);await sleep(300);}
 s=await qa.read();assert.ok(s.agentic.cameras_broken>=1,'C4 smashed');return s;
}

try{
 await session('solve',async qa=>{
  const {read,wait,face,command,shot,detail,voices,trail}=qa;
  let s=await read();await command('god');
  assert.ok(dist(here(s),map.site_spots['5'])<24,`?puzzle=bengio at the rig doorway ${here(s)}`);
  assert.equal(s.agentic.arm_tool,0);assert.equal(s.agentic.sockets,0);assert.equal(s.agentic.freed,0);
  assert.equal(s.agentic.arm_frame,0,'idle arm works the lever (frame A)');assert.ok(s.agentic.band_shut>=3,`south band shut (${s.agentic.band_shut} lines)`);
  detail.before=await rigSample(read,2500);
  assert.ok(detail.before.top<56,`platforms out of reach before you walk in (top ${detail.before.top})`);
  assert.ok(detail.before.top-detail.before.bottom>16,'platforms move');
  await face(0);await shot('solve-doorway');
  // Walk in: Yoshua's hint, then the arm picks up the blue phone and dials. Be at the blue socket by then.
  await walkTo(qa,1956,500);
  // The core speaks it on entering (queued behind any line already showing, e.g. SMITH's greeting).
  await until(voices,v=>v.includes('yoshua-hint'),'yoshua-hint on entering the rig room',12000);
  await aim(qa,BLUE,BLUE_FROM,'blue');
  s=await wait(s=>s.agentic.arm_tool===1,'Arm dials',15000);
  assert.equal(s.agentic.arm_frame,1,'dialling: frame B');
  const dialAt=s.world.ticks,alarms0=s.agentic.alarm_count;detail.dialAt=dialAt;
  s=await yank(qa,'blue');detail.blueAfter=s.world.ticks-dialAt;
  detail.blueLine=await lineCut(qa,'arm-dial');
  await shot('solve-blue-pulled');
  s=await wait(s=>s.agentic.arm_tool!==1,'Dialling stops',2000);
  assert.equal(s.agentic.arm_calls,0,'the call was cancelled');
  await aim(qa,RED,RED_FROM,'red');
  s=await wait(s=>s.agentic.arm_tool===2,'Arm reaches for the alarm',6000);
  const alarmAt=s.world.ticks;
  s=await yank(qa,'red');detail.redAfter=s.world.ticks-alarmAt;
  detail.redLine=await lineCut(qa,'arm-alarm');
  s=await wait(s=>s.agentic.arm_tool===3,'Arm grabs the lever',6000);
  assert.equal(s.agentic.arm_calls,0,'the call never went through');
  assert.equal(s.agentic.arm_alarms,0,'the alarm was cancelled');assert.equal(s.agentic.alarm_count,alarms0,'no alarm raised');
  assert.equal(s.agentic.rig_fast,1,'lever: platforms faster');
  detail.lever=await rigSample(read,2000);assert.ok(detail.lever.top<56,`still out of reach on the lever (top ${detail.lever.top})`);
  s=await read();await face(angleTo(s.world,...ARM));await shot('solve-lever');
  s=await pull(qa,YELLOW,YELLOW_FROM,'yellow');
  s=await wait(s=>s.agentic.arm_tool===4&&s.agentic.sockets===7,'Arm harmless',2000);
  await walkTo(qa,1900,472,{near:16});s=await read();await face(angleTo(s.world,...ARM));
  await until(voices,v=>v.includes('arm-predict'),'arm-predict',4000);await shot('solve-predict');
  s=await wait(s=>s.agentic.rig_bottom>=79.5&&(s.agentic.freed&16),'Platforms level with the ledge; Yoshua freed',14000);
  detail.level={top:s.agentic.rig_top,bottom:s.agentic.rig_bottom,band:s.agentic.band_shut};await shot('solve-level');
  assert.equal(s.agentic.band_shut,0,'south band open once he is free');
  detail.player=await watchYoshua(qa);
  const t=await trail();detail.walk=yoshuaWalk(t);assertWalk(detail.walk);
  // The arm's prediction is over before he is freed.
  const predictEnd=t.filter(e=>e.voice==='arm-predict').pop()?.t;detail.predictEnd=predictEnd;
  assert.ok(predictEnd!==undefined&&predictEnd<=detail.walk.freedAt+1,`arm-predict finished before the release (${predictEnd} vs ${detail.walk.freedAt})`);
  s=await read();await face(angleTo(s.world,yoshua(s).x,yoshua(s).y));await shot('solve-yoshua-over');
  const v=await voices();
  for(const key of ['yoshua-hint','arm-dial','arm-alarm','arm-lever','arm-predict'])assert.ok(v.includes(key),key);
  assert.ok(v.some(k=>k.startsWith('yoshua-freed')),'yoshua-freed line');
  assert.ok(!v.includes('arm-called'),'no arm-called when the call was cancelled');
 });

 await session('called',async qa=>{
  const {read,wait,face,command,shot,detail,voices,trail}=qa;
  let s=await read();await command('god');
  await walkTo(qa,1956,500);
  s=await wait(s=>s.agentic.arm_tool===1,'Arm dials',20000);
  const alarms0=s.agentic.alarm_count;detail.smithBefore=smithAt(s).map(Math.round);
  await face(angleTo(s.world,...ARM));await shot('called-dialling');
  // Let the call go through: SMITH is summoned (through hall 41's camera while it is far away).
  s=await wait(s=>s.agentic.arm_calls===1,'Call goes through',7000);
  assert.equal(s.agentic.alarm_count,alarms0+1,'the call raises an alarm at the rig');
  await sleep(300);s=await read();
  detail.smithCalled={at:smithAt(s).map(Math.round),mode:s.agentic.smith_mode,fromC4:Math.round(dist(smithAt(s),C4SPOT))};
  assert.ok([1,2].includes(s.agentic.smith_mode),`SMITH comes (mode ${s.agentic.smith_mode})`);
  assert.ok(dist(smithAt(s),C4SPOT)<160||dist(detail.smithBefore,EXIT)<640,`SMITH summoned to hall 41 (${detail.smithCalled.fromC4} u from C4's spot)`);
  await face(angleTo(s.world,...smithAt(s)));await shot('called-smith');
  // The arm moves on: the alarm, also let through.
  s=await wait(s=>s.agentic.arm_tool===2,'Arm moves on to the alarm',8000);
  s=await wait(s=>s.agentic.arm_alarms===1,'Alarm goes off',6000);
  assert.ok(s.agentic.alarm_count>=alarms0+2,'the alarm raises another alarm');
  s=await wait(s=>s.agentic.arm_tool===3,'Arm moves on to the lever',8000);
  detail.smithAlarm={at:smithAt(s).map(Math.round),mode:s.agentic.smith_mode};
  await shot('called-lever');
  // Still solvable: pull the lever's cable, then the two used ones.
  s=await pull(qa,YELLOW,YELLOW_FROM,'yellow');
  s=await wait(s=>s.agentic.arm_tool!==3,'lever dropped',1000);detail.afterYellow={tool:s.agentic.arm_tool,frame:s.agentic.arm_frame,parked:s.agentic.rig_parked};
  assert.notEqual(s.agentic.arm_frame,0,'no lever frame once its cable is pulled');
  s=await pull(qa,BLUE,BLUE_FROM,'blue');detail.armAfterBlue=s.agentic.arm_tool;
  s=await pull(qa,RED,RED_FROM,'red');
  s=await wait(s=>s.agentic.sockets===7&&s.agentic.arm_tool===4,'All three pulled',2000);
  s=await wait(s=>s.agentic.rig_bottom>=79.5&&(s.agentic.freed&16),'Platforms level; Yoshua freed',14000);
  detail.calls=s.agentic.arm_calls;detail.alarms=s.agentic.arm_alarms;
  detail.player=await watchYoshua(qa);
  detail.walk=yoshuaWalk(await trail());assertWalk(detail.walk);
  s=await read();await face(angleTo(s.world,yoshua(s).x,yoshua(s).y));await shot('called-freed');
  const v=await voices();for(const key of ['arm-dial','arm-called','arm-alarm','arm-lever','arm-predict'])assert.ok(v.includes(key),key);
 });

 // SMITH far away (patrolling from the cross hall, nobody seen): the call brings it through hall 41's camera C4.
 await session('summon',async qa=>{
  const {read,wait,face,warp,command,shot,detail,voices}=qa;
  let s=await read();await command('god');
  // Straight into the rig room (C4 cannot see in there), so SMITH stays on its patrol.
  await warp(1956,472,0);
  s=await wait(s=>s.agentic.arm_tool===1,'Arm dials',20000);
  detail.smithBefore={at:smithAt(s).map(Math.round),mode:s.agentic.smith_mode,fromExit:Math.round(dist(smithAt(s),EXIT))};
  assert.ok(detail.smithBefore.fromExit>640,`SMITH far from the rig before the call (${detail.smithBefore.fromExit} u)`);
  await face(angleTo(s.world,...ARM));await shot('summon-dialling');
  s=await wait(s=>s.agentic.arm_calls===1,'Call goes through',7000);
  detail.smithCalled={at:smithAt(s).map(Math.round),mode:s.agentic.smith_mode,fromC4:Math.round(dist(smithAt(s),C4SPOT))};
  assert.ok(detail.smithCalled.fromC4<64,`SMITH materialised at C4's spot (${detail.smithCalled.fromC4} u away)`);
  assert.equal(s.agentic.smith_mode,2,'SMITH answers the alarm');
  await until(voices,v=>v.includes('arm-called'),'arm-called',4000);
  await face(180);await shot('summon-smith');
  s=await wait(s=>dist(smithAt(s),EXIT)<160,'SMITH walks to the rig doorway',15000);
  detail.smithArrived={at:smithAt(s).map(Math.round),mode:s.agentic.smith_mode};
  s=await read();await face(angleTo(s.world,...smithAt(s)));await shot('summon-arrived');
 },{puzzle:'refuge'});

 // Freed by the core (QA netevent, like the hub walk-in and ?puzzle=exit) while the platforms are mid-cycle.
 await session('free',async qa=>{
  const {read,wait,face,command,shot,detail}=qa;
  let s=await read();await command('god');
  s=await wait(s=>s.agentic.rig_top-s.agentic.rig_bottom>8,'Platforms cycling',4000);detail.atFree=[s.agentic.rig_top,s.agentic.rig_bottom];
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 4 1');
  s=await wait(s=>(s.agentic.freed&16)&&s.agentic.arm_tool===4,'Freed by the core: arm harmless',3000);
  assert.equal(s.agentic.band_shut,0,'south band open');
  s=await wait(s=>s.agentic.rig_bottom>=79.5,'Platforms level after a core release',8000);detail.levelAt=s.world.ticks;
  await sleep(1500);s=await read();
  assert.ok(s.agentic.rig_bottom>=79.5&&s.agentic.rig_top<=80.5,`platforms stay level (${s.agentic.rig_top}/${s.agentic.rig_bottom})`);
  await face(0);await shot('free-level');
 });

 await session('pit',async qa=>{
  const {read,wait,face,hold,warp,command,shot,detail}=qa;
  let s=await read();await command('god');
  // (The strip's edge is straight only at y 440-504; elsewhere the octagon's bevels hold you at 80.)
  await warp(1956,472,0);await hold('KeyW',500);
  s=await wait(s=>s.world.x>1990&&s.world.z<60,'Dropped into the pit',4000);detail.landed=[Math.round(s.world.x),Math.round(s.world.y),Math.round(s.world.z)];
  await shot('pit-in');
  // Nothing to climb: 48 at most, 32 below the strip.
  await walkTo(qa,2080,548,{near:14,timeout:40000,patient:true});
  await walkTo(qa,2080,600,{near:14,timeout:40000,patient:true});
  s=await read();detail.sliver=[Math.round(s.world.x),Math.round(s.world.y),Math.round(s.world.z)];
  await walkTo(qa,2080,690,{near:16,timeout:15000});await walkTo(qa,2016,740,{near:16});
  await walkTo(qa,2016,1100,{near:20,timeout:30000});
  s=await read();detail.corridor=[Math.round(s.world.x),Math.round(s.world.y),Math.round(s.world.z)];
  assert.ok(s.world.y>1000&&Math.abs(s.world.z+16)<2,`walked out into corridor 60 (${detail.corridor})`);
  await face(90);await shot('pit-corridor');
 });

 // Review major 3: hugging the south wall from the red socket used to walk you round the pit to Yoshua's ledge
 // at 80. Now you stop at the band's edge; once he is free (QA release) the same walk goes straight over.
 await session('ledge',async qa=>{
  const {read,wait,face,hold,command,shot,detail}=qa;
  let s=await read();await command('god');
  await walkTo(qa,1950,500);await walkTo(qa,1956,388,{near:10});
  s=await read();detail.start=[s.world.x,s.world.y,s.world.z].map(Math.round);
  await face(0);
  const blocked=[];
  for(let i=0;i<14;i++){await hold('KeyW',250);s=await read();blocked.push([s.world.x,s.world.y,s.world.z].map(Math.round));if(Math.abs(((s.world.angle+180)%360)-180)>3)await face(0);}
  detail.blocked=blocked;const furthest=Math.max(...blocked.map(p=>p[0]));detail.furthest=furthest;
  await shot('ledge-blocked');
  // The band's bevel reaches x 2048; the walk used to carry on to the ledge (x 2176+).
  assert.ok(furthest<2048&&blocked.slice(-6).every(p=>p[0]===blocked[blocked.length-1][0]),`stopped at the band's edge (got to x ${furthest})`);
  assert.ok(blocked.every(p=>p[2]>=79),'still on the strip at 80');
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 4 1');
  s=await wait(s=>(s.agentic.freed&16)&&s.agentic.band_shut===0&&s.agentic.rig_bottom>=79.5,'Freed: band open, platforms level',8000);
  await walkTo(qa,1956,392,{near:10});await face(0);
  const open=[];
  for(let i=0;i<24;i++){await hold('KeyW',250);s=await read();open.push([s.world.x,s.world.y,s.world.z].map(Math.round));if(s.world.x>2180)break;if(Math.abs(((s.world.angle+180)%360)-180)>3)await face(0);}
  detail.open=open;
  assert.ok(s.world.x>2180,`after the release the walk crosses over (x ${s.world.x})`);
 });

 // Review major 1 (SMITH): C4 smashed, so no camera can fetch it back. SMITH hunts you to the pit's edge and
 // stops there; it is never down in the pit for longer than a second or so, and is not there after you leave
 // by sliver 53 and corridor 60.
 await session('smithpit',async qa=>{
  const {read,wait,face,command,shot,detail,trail}=qa;
  await command('god');
  await smashC4(qa);
  let s=await wait(s=>s.agentic.smith_mode===1&&dist(here(s),smithAt(s))<480,'SMITH hunting near',20000);
  detail.smithStart=[...smithAt(s).map(Math.round),s.agentic.smith_mode];
  s=await dropIn(qa);detail.pitAt=here(s).map(Math.round);
  await sleep(10000);
  s=await read();detail.smithWhileIn=[s.agentic.smith_x,s.agentic.smith_y,s.agentic.smith_z,s.agentic.smith_mode].map(Math.round);
  await face(angleTo(s.world,...smithAt(s)));await shot('smithpit-edge');
  await climbOut(qa);s=await read();detail.playerOut=[s.world.x,s.world.y,s.world.z].map(Math.round);
  await sleep(12000);
  const t=await trail();
  const runs=pitRuns(t,e=>e.sm);detail.smithPitRuns=runs;
  const inRoom=t.filter(e=>inRig(e.sm[0],e.sm[1]));
  detail.smithInRoom=inRoom.length;detail.smithLowestInRoom=inRoom.length?Math.min(...inRoom.map(e=>e.sm[2])):null;
  detail.smithEdge=inRoom.length?Math.max(...inRoom.filter(e=>e.sm[2]>=79).map(e=>e.sm[0])):null;
  assert.ok(inRoom.length>0,'SMITH came into the rig room after you');
  assert.ok(runs.every(r=>r<=60),`SMITH never stuck in the pit (runs ${runs})`);
  const last=t[t.length-1];detail.smithEnd=[...last.sm,last.mode];
  assert.ok(!inPit(...last.sm),`SMITH not in the pit after you left (${last.sm})`);
 });

 // Review major 1 (followers): a freed follower (Katja, released where she stands) catches up on the strip,
 // stops at the edge when you drop in, and is not left in the pit when you walk out by corridor 60.
 await session('follow',async qa=>{
  const {read,wait,face,command,warp,shot,detail,trail}=qa;
  await command('god');await command('pdoom_development 1');
  await command('netevent pdoom_agentic_qa_out 0 0');await sleep(1500);
  await command('netevent pdoom_agentic_qa_out 3 1');
  const kat=s=>s.world.people[3];
  let s=await read();
  // In the rig room (C4 can't see in): cut the phone and the alarm as the arm reaches for them, so nothing
  // calls SMITH over while she comes (the lever keeps the platforms running).
  await warp(1956,472,0);
  await aim(qa,BLUE,BLUE_FROM,'blue');await wait(s=>s.agentic.arm_tool===1,'Arm dials',20000);await yank(qa,'blue');
  await aim(qa,RED,RED_FROM,'red');await wait(s=>s.agentic.arm_tool===2,'Arm reaches for the alarm',12000);await yank(qa,'red');
  detail.escort=await escort(qa,3);s=await read();
  detail.katBefore=[kat(s).x,kat(s).y,kat(s).z].map(Math.round);
  s=await dropIn(qa);
  await sleep(8000);s=await read();detail.katWhileIn=[kat(s).x,kat(s).y,kat(s).z].map(Math.round);
  await face(angleTo(s.world,kat(s).x,kat(s).y));await shot('follow-edge');
  await climbOut(qa,[2016,1500]);
  await sleep(20000);
  const t=await trail();const runs=pitRuns(t,e=>e.ka);detail.katPitRuns=runs;
  const last=t[t.length-1];detail.katEnd=last.ka;detail.me=last.me;
  assert.ok(runs.length===0,`Katja never stepped into the pit (runs ${runs})`);
  assert.ok(!inPit(...last.ka),`Katja not in the pit at the end (${last.ka})`);
 },{puzzle:'refuge'});

 // Review major 2: with SMITH at the rig (C4 sees the doorway), pull red and blue from the strip and yellow from
 // hall 41, then watch the ledge. Yoshua says his line before he moves and nobody possesses him on the ledge.
 await session('possess',async qa=>{
  const {read,wait,face,press,command,shot,detail,trail,voices}=qa;
  await command('god');
  await walkTo(qa,1944,472,{near:8});let s=await read();
  await face(angleTo(s.world,...RED));s=await wait(s=>s.world.prompt==='SPACE - pull the red cable','red prompt',3000);await press('Space');
  s=await read();await face(angleTo(s.world,...BLUE));s=await wait(s=>s.world.prompt==='SPACE - pull the blue cable','blue prompt',3000);await press('Space');
  s=await pull(qa,YELLOW,YELLOW_FROM,'yellow');
  await walkTo(qa,1900,472,{near:16});s=await read();await face(angleTo(s.world,2240,448));
  s=await wait(s=>s.agentic.freed&16,'Yoshua freed',14000);
  detail.smithAtRelease={d:Math.round(dist(smithAt(s),[yoshua(s).x,yoshua(s).y])),mode:s.agentic.smith_mode};
  // Watch without stunning SMITH until Yoshua is off his ledge: the hold is the rescue's, not the player's.
  let shotTaken=false;const end=Date.now()+15000;
  while(Date.now()<end){s=await read();if(!shotTaken&&yoshua(s).x<2120){await shot('possess-walk');shotTaken=true;}if(yoshua(s).x<1990)break;if(s.agentic.possessed&16)break;await sleep(150);}
  detail.player=await watchYoshua(qa,30000);
  detail.walk=yoshuaWalk(await trail());assertWalk(detail.walk);
  s=await read();await face(angleTo(s.world,yoshua(s).x,yoshua(s).y));await shot('possess-over');
  assert.ok((await voices()).some(v=>v.startsWith('yoshua-freed')),'freed line');
 });

 // Review minor (yellow): pulled first, from hall 41, before you ever walk in. The arm lets go of the lever
 // (frame E, empty-handed until it reaches for the phone) and the platforms sink to the bottom and stop. Walking in, the arm
 // still dials and raises the alarm; pulling those frees him.
 await session('parked',async qa=>{
  const {read,wait,face,command,shot,detail,trail}=qa;
  let s=await read();await command('god');
  s=await pull(qa,YELLOW,YELLOW_FROM,'yellow');
  detail.afterYellow={tool:s.agentic.arm_tool,frame:s.agentic.arm_frame,parked:s.agentic.rig_parked};
  assert.equal(s.agentic.rig_parked,1,'lever dead: platforms parked');
  s=await wait(s=>s.agentic.arm_frame!==0,'arm lets go of the lever',600);
  s=await wait(s=>s.agentic.rig_top<=-15.5,'platforms sink to the bottom',9000);
  detail.parked=await rigSample(read,2000);
  assert.ok(detail.parked.top<=-15.5&&detail.parked.bottom>=-16.5,`platforms stopped at the bottom (${JSON.stringify(detail.parked)})`);
  await walkTo(qa,1900,472,{near:16});s=await read();await face(0);await shot('parked-rig');
  await walkTo(qa,1956,500);
  s=await wait(s=>s.agentic.arm_tool===1,'Arm dials',15000);
  await aim(qa,BLUE,BLUE_FROM,'blue');s=await yank(qa,'blue');
  await aim(qa,RED,RED_FROM,'red');
  s=await wait(s=>s.agentic.arm_tool===2||s.agentic.sockets===7,'Arm reaches for the alarm',12000);
  s=await yank(qa,'red');
  s=await wait(s=>s.agentic.sockets===7&&s.agentic.arm_tool===4,'All three pulled',2000);
  s=await wait(s=>s.agentic.rig_bottom>=79.5&&(s.agentic.freed&16),'Platforms level; Yoshua freed',14000);
  const t=await trail();const yellowAt=t.findIndex(e=>e.sockets&4);
  const leverAfter=t.slice(yellowAt).filter(e=>e.frame===0&&e.tool!==4);detail.leverFramesAfterYellow=leverAfter.length;
  assert.equal(leverAfter.length,0,'never frame A after the lever is dead');
  detail.framesAfterYellow=[...new Set(t.slice(yellowAt).map(e=>e.frame))];
 });
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'agentic bengio smoke passed':'agentic bengio smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
