// Level 4 rescue smoke: Nick Bostrom, Unrendered (AgenticBostrom.zs), headless and muted.
//   python3 scripts/build-agentic-preview.py --resources-only --only bostrom --out output/agentic/qa-bostrom.pk3
//   node scripts/agentic-bostrom-smoke.mjs
//   (CASES=rescue,turnaround,pitch,edge,early,hint,c3,c3fast,alarm,qa)
// rescue: sit in the leather chair, the Construct; stare at the box for 11 s (the nudge, and he stays in);
//   turn your back: the box stops rendering and his mind walks out, but he is not out until you see it;
//   turn back: wireframe, then solid, him outside, "Shall we?"; jack out at the white chair: you face his
//   pod, it drains, Nick appears on the catwalk, steps out and guides.
// turnaround: turn straight to the white chair (it is behind you) and stay facing it while he walks out:
//   jacking out frees nobody and he is back in his box; next visit, look back at him and he is freed.
// pitch: look down at the floor instead of turning: that is looking away too; look up again for the redraw.
// edge: the box near the edge of the screen is still there; turned well away it is not.
// early: jack out at once (nobody freed, he waits in his box), sit again and finish the rescue.
// hint: Jaan's hint cut short by sitting down comes again on the next approach to his booth.
// c3: camera C3 intact: no SEEN inside, SMITH walks off instead of waiting at the chair, and the freed Nick
//   is not possessed while he says his line.
// alarm: a possessed follower raises no alarm while you are in the Construct (SMITH keeps moving), and
//   goes back to calling SMITH once you are out.
// qa: a QA release while you are inside.
// Everything the player does is real input; god mode and player warps only. Writes output/agentic/bostrom/.
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/bostrom';await fs.mkdir(out,{recursive:true});
const pk3=process.env.PK3||'output/agentic/qa-bostrom.pk3';
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const C=map.construct,BOX=C.box,EXIT=C.mind_exit,CHAIR=C.chair,SPAWN=C.spawn,POD=[352,1184],SITE_EXIT=map.sites[1].exit,HIDDEN=map.sites[1].prisoner;
const BOOTH=[36,680],BAND=[176,1000];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,pk3,cases:[],passed:false};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,800));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const here=s=>[s.world.x,s.world.y];
const mind=s=>[s.agentic.mind_x,s.agentic.mind_y];
const nick=s=>s.world.people[1];
const brief=s=>({t:s.world.ticks,at:here(s).map(Math.round),ang:Math.round(s.world.angle),pitch:Math.round(s.world.pitch),box:s.agentic.box,seen:s.agentic.box_seen,clear:s.agentic.mind_clear,out:s.agentic.mind_out,mind:mind(s).map(Math.round),inside:s.agentic.in_construct,smith:[s.agentic.smith_x,s.agentic.smith_y].map(Math.round),smode:s.agentic.smith_mode,seenLeft:s.world.seen_remaining,possessed:s.agentic.possessed,freed:s.agentic.freed,alarms:s.agentic.alarm_count,msg:s.world.message,voice:s.dialogue?.voice,hp:s.world.health});
// The box inside sector 246 (96 u square): the mind is fully inside / fully out with its 10 u radius.
const inBox=(p,m)=>Math.abs(p[0]-BOX[0])<48+m&&Math.abs(p[1]-BOX[1])<48+m;

async function session(name,fn){
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  qa=await bootAgentic(page,{puzzle:'bostrom',pk3});
  // Every line that takes the speaker box, in order (serial), and the set of voices heard.
  await page.evaluate(()=>{window.__VOICES__=[];window.__LINES__=[];let serial=-1;setInterval(()=>{try{const s=JSON.parse(window.render_game_to_text()),d=s.dialogue;if(d&&d.serial!==serial){serial=d.serial;window.__LINES__.push({t:s.world.ticks,voice:d.voice,remaining:d.remaining});}const v=d?.voice;if(v&&!window.__VOICES__.includes(v))window.__VOICES__.push(v);}catch{}},40);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  const lines=()=>page.evaluate(()=>window.__LINES__);
  await fn({page,...qa,shot,detail,voices,lines});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{detail.final=brief(await qa?.read());detail.voices=await page.evaluate(()=>window.__VOICES__);detail.lines=await page.evaluate(()=>window.__LINES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
// Turn with the arrow keys until within tol degrees of angle: held while far, then short taps, polling
// fast (the wireframe lasts one second, and the view's edge is a few degrees wide).
const diff=(a,b)=>((a-b+540)%360)-180;
async function turnTo({page,read},angle,tol=12){
 let s=await read();
 for(let i=0;i<40;i++){
  let d=diff(angle,s.world.angle);if(Math.abs(d)<=tol)return s;
  const k=d>0?'ArrowLeft':'ArrowRight';
  if(Math.abs(d)>40){
   await page.keyboard.down(k);const end=Date.now()+3000;
   while(Date.now()<end){s=await read();d=diff(angle,s.world.angle);if(Math.abs(d)<=28||(k==='ArrowLeft')!==(d>0))break;await sleep(10);}
   await page.keyboard.up(k);
  }else{await page.keyboard.down(k);await sleep(Math.max(25,Math.abs(d)*2.5));await page.keyboard.up(k);}
  await sleep(110);s=await read();
 }
 return s;
}
// Hold a key until test(state) or the time runs out (pitch with PageUp/PageDown, a slow turn).
async function holdUntil({page,read},key,test,ms=4000){
 await page.keyboard.down(key);let s;const end=Date.now()+ms;
 try{while(Date.now()<end){s=await read();if(test(s))break;await sleep(10);}}finally{await page.keyboard.up(key);}
 await sleep(60);return read();
}
// Sit in the leather chair from where ?puzzle=bostrom starts (facing it).
async function sit({read,wait,press,face,hold,shot},detail){
 let s=await read();
 for(let i=0;i<8&&s.world.prompt!=='SPACE - sit in the chair';i++){
  await face(angleTo(s.world,112,1184));s=await read();if(s.world.prompt==='SPACE - sit in the chair')break;
  await hold('KeyW',150);s=await read();
 }
 s=await wait(s=>s.world.prompt==='SPACE - sit in the chair','Sit prompt at the leather chair',4000);
 detail.sitFrom=here(s).map(Math.round);
 await press('Space');if(shot)await shot('construct-flash');
 s=await wait(s=>s.agentic.in_construct===1&&s.world.in_construct===1,'In the Construct',3000);
 assert.ok(dist(here(s),SPAWN)<8,`at ConstructSpawn ${here(s)}`);
 assert.equal(s.agentic.box,1,'box solid on arrival');assert.equal(s.agentic.mind_out,0);assert.equal(s.agentic.mind_clear,0);
 assert.ok(dist(mind(s),BOX)<2,`his mind in the box ${mind(s)}`);
 return s;
}
// Turn your back (face the white chair, south) until his mind has walked clear of the box and reached
// his spot. He is not out yet: nobody has seen it.
async function turnAway(ctx,detail,key='away'){
 const {page,read,wait}=ctx;const t0=(await read()).world.ticks;
 let s=await turnTo({page,read},270,6);
 s=await wait(s=>s.agentic.box===0,'Box unrendered once out of view',3000);detail[key+'Unrendered']=s.world.ticks-t0;
 assert.equal(s.agentic.box_seen,0,'nothing of the box on screen');
 s=await wait(s=>s.agentic.mind_clear===1,'His mind walks clear of the box',5000);
 assert.ok(!inBox(mind(s),10),`clear of the box ${mind(s)}`);
 s=await wait(s=>dist(mind(s),EXIT)<2,'He reaches his spot',5000);detail[key+'AtExit']=s.world.ticks-t0;
 assert.equal(s.agentic.box,0,'box still unrendered while nobody looks');
 assert.equal(s.agentic.mind_out,0,'not out until you have seen him outside');
 return s;
}
// Turn back (the short way, right) until the box redraws: the wireframe, then solid, him outside, "Shall we?".
async function lookBack(ctx,detail,shots=false){
 const {page,read,wait,voices,shot}=ctx;
 let s=await holdUntil(ctx,'ArrowRight',s=>s.agentic.box===2,4000);
 assert.equal(s.agentic.box,2,'wireframe on looking back');detail.wireAt=Math.round(s.world.angle);
 assert.equal(s.agentic.mind_out,1,'out the moment you see him outside');
 s=await turnTo({page,read},90,8);
 if(shots&&s.agentic.box===2){await shot('construct-wireframe');detail.wireShot=s.world.ticks;}
 s=await wait(s=>s.agentic.box===1,'Solid again after the wireframe',3000);
 assert.ok(dist(mind(s),EXIT)<2,'he stays outside');
 await wait(s=>s.dialogue?.voice==='nick-out',"nick-out (Shall we?)",4000);
 if(shots){await sleep(300);await shot('construct-solid-outside');}
 return s;
}
async function jackOut({read,wait,press,face},freed){
 let s=await read();await face(angleTo(s.world,...CHAIR));
 s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt at the white chair',4000);
 await press('Space');
 s=await wait(s=>s.agentic.in_construct===0,'Back in the farm',3000);
 assert.ok(dist(here(s),map.chair_return)<8,`at ChairReturn ${here(s)}`);
 assert.ok(Math.abs(diff(s.world.angle,angleTo(s.world,...POD)))<4,`facing his pod (${s.world.angle})`);
 if(freed)s=await wait(s=>s.agentic.freed&2,'Nick freed',2000);
 return s;
}

const CAM3=[map.cameras[2].x,map.cameras[2].y],CAM_FROM=[168,1212],LEATHER=[112,1184];
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
async function swing({hold,read}){const before=(await read()).world.wrench_swings;await hold('ControlLeft',120);return before;}
// A wrench stun on SMITH if he is in reach (he passes through you, so step back first when he is on top of you).
async function stunSmith({read,wait,face,hold}){
 let s=await read();
 for(let i=0;i<4&&s.agentic.smith_mode!==4;i++){
  const d=dist(here(s),smithAt(s));
  if(d<20){await face(angleTo(s.world,...smithAt(s)));await hold('KeyS',250);s=await read();}
  await face(angleTo(s.world,...smithAt(s)));await swing({hold,read});await sleep(200);s=await read();
 }
 return s.agentic.smith_mode;
}
async function smashC3(ctx){
 const {warp,read,face,wait}=ctx;
 await warp(...CAM_FROM);let s=await read();await face(angleTo(s.world,...CAM3));
 await swing(ctx);await wait(s=>s.world.cameras_broken===1,'C3 smashed',3000);
 await stunSmith(ctx);s=await read();await face(angleTo(s.world,...LEATHER));
}
async function unpossess({read,wait,face,hold,press},s){
 for(let i=0;i<20;i++){
  s=await read();if(!(s.agentic.possessed&2))return;
  const p=[nick(s).x,nick(s).y];await face(angleTo(s.world,...p));
  if(s.world.prompt==='SPACE - stop generating'){await press('Space');continue;}
  if(dist(here(s),p)>70)await hold('KeyW',Math.min(400,dist(here(s),p)*2));else await sleep(150);
 }
}
async function sample(read,ms,step,into){const end=Date.now()+ms;while(Date.now()<end){into.push(brief(await read()));await sleep(step);}return into;}

try{
 await session('rescue',async ctx=>{
  const {page,read,wait,press,face,hold,warp,command,shot,detail,voices}=ctx;
  let s=await read();await command('god');
  assert.equal(s.agentic.box,1);assert.equal(s.agentic.freed&2,0);
  assert.equal(nick(s).visible,0,'Nick hidden before');
  await face(angleTo(s.world,...POD));await sleep(600);await shot('farm-pod');
  // C3 watches the chair and has already brought SMITH: smash it, stun him, then sit.
  await smashC3(ctx);
  s=await sit(ctx,detail);const t0=s.world.ticks;
  await sleep(1800);await shot('construct-arrive');
  assert.ok((await voices()).includes('nick-hint'),'nick-hint on arrival');
  // Looking at the box the whole time: it stays solid, he stays in, and after ~10 s he nudges.
  s=await wait(s=>s.dialogue?.voice==='nick-nudge','nick-nudge after staring',16000);
  detail.nudgeAfter=s.world.ticks-t0;
  for(let i=0;i<10;i++){s=await read();assert.equal(s.agentic.box,1,'still solid while looked at');assert.equal(s.agentic.mind_clear,0);assert.ok(dist(mind(s),BOX)<2,'he never moved');await sleep(200);}
  assert.ok(detail.nudgeAfter>=330&&detail.nudgeAfter<=420,`nudge at ${detail.nudgeAfter} tics`);
  // Turn your back: unrendered after 35 tics, then he walks out (behind you, unseen: not out yet).
  s=await turnAway(ctx,detail);await shot('construct-away');
  assert.ok(!(await voices()).includes('nick-out'),'no Shall we? before you have seen him outside');
  // Half round: the box is just off the left edge of the screen, so it is still not there.
  s=await turnTo({page,read},163,3);await sleep(250);s=await read();
  detail.edge=brief(s);assert.equal(s.agentic.box,0,'off screen: still unrendered');assert.equal(s.agentic.box_seen,0);
  await shot('construct-unrendered-edge');
  // Turn back: the wireframe redraw, then solid, with him outside: now he is out.
  s=await lookBack(ctx,detail,true);
  // Back to the white chair (behind you) and jack out.
  s=await face(angleTo((await read()).world,...CHAIR));
  s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt at the white chair',4000);
  await shot('construct-chair');
  s=await jackOut(ctx,true);const freedAt=s.world.ticks;
  assert.equal(s.agentic.guide,1,'Nick leads (first freed)');
  const n0=[nick(s).x,nick(s).y];detail.nickAppears=n0;assert.ok(dist(n0,HIDDEN)<4,'he appears on his catwalk');
  await sleep(500);await shot('farm-drained');
  // He steps to his SiteExit, then leads you toward the refuge (you stay near). If SMITH turns up and
  // possesses him, STOP GENERATING and a wrench stun, like a player would.
  s=await wait(s=>dist([nick(s).x,nick(s).y],SITE_EXIT)<32,'Nick steps out to his SiteExit',15000);
  await face(angleTo(s.world,nick(s).x,nick(s).y));await sleep(200);await shot('farm-nick-out');
  // Follow him along his own trail (the core's guide check) until he has led you out of the farm and down
  // to the band (y < 960). The rest of the walk is the core's guide (agentic-core-smoke guide case).
  detail.interference=[];const trail=[];let last=null,lastTick=0,jump=0,leadShot=false,walked=0;const until=Date.now()+90000;
  while(Date.now()<until){
   s=await read();const j=nick(s),p=[j.x,j.y];
   if(last&&s.world.ticks>lastTick)jump=Math.max(jump,dist(last,p)/(s.world.ticks-lastTick));last=p;lastTick=s.world.ticks;
   if(!trail.length||dist(trail[trail.length-1],p)>24){if(trail.length)walked+=dist(trail[trail.length-1],p);trail.push(p);}
   if(s.agentic.introduced||p[1]<960&&walked>300)break;
   if(s.agentic.possessed&2){detail.interference.push(['possessed',s.world.ticks-freedAt]);assert.ok(s.world.ticks-freedAt>=280,'not possessed during his freed line');await unpossess(ctx,s);last=null;continue;}
   if(s.agentic.smith_mode===1&&dist(here(s),smithAt(s))<90){detail.interference.push('smith');await stunSmith(ctx).catch(()=>{});last=null;continue;}
   if(!leadShot&&dist(p,SITE_EXIT)>96){leadShot=true;detail.leadsFrom=p.map(Math.round);await face(angleTo(s.world,...p));await shot('farm-nick-leads');}
   while(trail.length>1&&dist(here(s),trail[0])<40)trail.shift();
   const target=j.sheltered?(dist(here(s),trail[0])<40?[-296,-96]:trail[0]):trail[0];
   if(dist(here(s),p)>96||j.sheltered){await face(angleTo(s.world,...target));await hold('KeyW',Math.min(300,Math.max(90,dist(here(s),target)*2)));}
   else await sleep(200);
  }
  detail.maxSpeed=+jump.toFixed(1);detail.walked=Math.round(walked);detail.ledTo=[nick(s).x,nick(s).y].map(Math.round);
  assert.ok(s.agentic.introduced||nick(s).y<960&&walked>300,`Nick led you out of the farm (he is at ${[nick(s).x,nick(s).y]}, walked ${walked})`);
  assert.ok(jump<=18.5,`no teleport (fastest ${jump} u/tic)`);assert.equal(s.agentic.guide,1);
  await sleep(300);s=await read();await face(angleTo(s.world,nick(s).x,nick(s).y));await sleep(200);await shot('band-nick-guides');
  const v=await voices();
  assert.ok(v.includes('nick-freed-guide'),'nick-freed-guide line');
  assert.equal(v.filter(k=>k==='nick-pod').length,1,'his pod hint once');assert.ok(v.indexOf('nick-pod')<v.indexOf('nick-hint'),'no pod hint after sitting');
  detail.smith={mode:s.agentic.smith_mode,possessed:s.agentic.possessed};
 });

 // Review finding 1: the white chair is right behind you. Turning to it and leaving while he walks out
 // behind you frees nobody: you never saw anything happen. He is back in his box next time.
 await session('turnaround',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail,voices}=ctx;
  await command('god');
  let s=await sit(ctx,detail);
  s=await turnTo({page,read},270,6);
  s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt on turning round',3000);detail.promptAfter=brief(s);
  s=await turnAway(ctx,detail,'turned');
  assert.ok(Math.abs(diff(s.world.angle,270))<8,'still facing the chair');
  assert.equal(s.world.prompt,'SPACE - jack out');
  await sleep(1500);s=await read();assert.equal(s.agentic.mind_out,0,'still not out');assert.ok(!(await voices()).includes('nick-out'));
  await shot('turnaround-chair');
  await press('Space');s=await wait(s=>s.agentic.in_construct===0,'Jacked out',3000);
  await sleep(500);s=await read();detail.afterLeaving=brief(s);
  assert.equal(s.agentic.freed&2,0,'nobody freed');assert.equal(nick(s).visible,0,'Nick still hidden');
  assert.ok(dist(mind(s),BOX)<2,`he is back in his box ${mind(s)}`);assert.equal(s.agentic.box,1);assert.equal(s.agentic.mind_clear,0);
  // Next visit: turn away, then look back at him outside the box: now jacking out frees him.
  await face(angleTo(s.world,...LEATHER));
  s=await sit(ctx,detail);
  s=await turnAway(ctx,detail,'again');
  s=await lookBack(ctx,detail);
  s=await jackOut(ctx,true);detail.freed=brief(s);
 });

 // Review finding 2: looking down at the floor is looking away too.
 await session('pitch',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail,voices}=ctx;
  await command('god');
  let s=await sit(ctx,detail);await sleep(600);
  // A little down: the box is still in the top of the frame.
  s=await holdUntil(ctx,'PageDown',s=>s.world.pitch>=18,3000);await sleep(200);s=await read();
  detail.slightlyDown=brief(s);assert.equal(s.agentic.box_seen,1,`box on screen at pitch ${s.world.pitch}`);
  s=await holdUntil(ctx,'PageDown',s=>s.world.pitch>=70,4000);detail.lookingDown=brief(s);
  s=await wait(s=>s.agentic.box===0,'Box unrendered while you look at the floor',3000);
  assert.ok(Math.abs(diff(s.world.angle,90))<3,'still turned toward the box');
  s=await wait(s=>s.agentic.mind_clear===1&&dist(mind(s),EXIT)<2,'He walks out while you look at the floor',6000);
  assert.equal(s.agentic.mind_out,0,'not out until seen');
  await shot('pitch-looking-down');
  // Look up again: the redraw, with him outside.
  s=await holdUntil(ctx,'PageUp',s=>s.agentic.box===2||s.world.pitch<=-10,4000);detail.lookUp=brief(s);
  assert.equal(s.agentic.box,2,'wireframe as the box comes back into view');assert.equal(s.agentic.mind_out,1);
  await shot('pitch-wireframe');
  await holdUntil(ctx,'PageUp',s=>s.world.pitch<=8,2000);
  await wait(s=>s.dialogue?.voice==='nick-out','nick-out',4000);
  s=await wait(s=>s.agentic.box===1,'solid',3000);await sleep(200);await shot('pitch-solid-outside');
  s=await jackOut(ctx,true);
 });

 // Review finding 6: the box at the edge of the screen is still there; turned well away it is gone.
 await session('edge',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail}=ctx;
  await command('god');
  let s=await sit(ctx,detail);
  s=await turnTo({page,read},44,3);await sleep(2600);s=await read();detail.at44=brief(s);
  assert.equal(s.agentic.box_seen,1,'box at the left of the screen is seen');assert.equal(s.agentic.box,1);assert.ok(dist(mind(s),BOX)<2,'he stays in');
  await shot('edge-left-of-screen');
  s=await turnTo({page,read},12,3);detail.at12=brief(s);
  s=await wait(s=>s.agentic.box===0,'Unrendered once all of it is off screen',3000);
  assert.equal(s.agentic.box_seen,0);await sleep(200);await shot('edge-off-screen');
 });

 await session('early',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail,voices}=ctx;
  let s=await read();await command('god');
  s=await sit(ctx,detail);
  await sleep(1200);
  // Turn just far enough to face the white chair and jack out before he can get out.
  s=await turnTo({page,read},235,10);
  s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt',2000);
  detail.beforeEarly=brief(s);
  assert.equal(s.agentic.mind_out,0,'not out yet');
  await press('Space');
  s=await wait(s=>s.agentic.in_construct===0,'Jacked out early',3000);
  await sleep(500);s=await read();
  assert.equal(s.agentic.freed&2,0,'nobody freed');assert.equal(nick(s).visible,0,'Nick still hidden');
  assert.ok(dist(mind(s),BOX)<2,`he waits in the box ${mind(s)}`);assert.equal(s.agentic.box,1);
  // The leather chair still works: back in, and this time turn away and look back.
  await face(angleTo(s.world,...LEATHER));
  s=await sit(ctx,detail);
  await sleep(1200);await shot('early-again');
  s=await turnAway(ctx,detail);s=await lookBack(ctx,detail);
  s=await jackOut(ctx,true);
  detail.voicesAt=await voices();
 });

 // Review finding 3: sitting down while Jaan's hint is playing stops it, and he calls it again next time.
 await session('hint',async ctx=>{
  const {page,read,wait,press,face,hold,warp,command,shot,detail,voices,lines}=ctx;
  await command('god');await smashC3(ctx);
  await warp(...BAND);
  let s=await wait(s=>s.dialogue?.voice==='jaan-hint','jaan-hint in earshot of the booth',12000);detail.jaanStart=brief(s);
  await warp(176,1184);s=await read();await face(angleTo(s.world,...LEATHER));
  s=await sit(ctx,detail);detail.sat=brief(s);
  assert.ok(detail.jaanStart.t+205>detail.sat.t,'sat down while Jaan was still talking');
  s=await wait(s=>s.dialogue?.voice==='nick-hint','nick-hint on arrival',1500);
  detail.hintGap=s.world.ticks-detail.sat.t;
  // Leave early and walk back into Jaan's earshot: he calls his hint again.
  s=await turnTo({page,read},270,8);s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt',2000);
  await press('Space');s=await wait(s=>s.agentic.in_construct===0,'Back in the farm',3000);
  s=await wait(s=>s.dialogue?.voice!=='nick-hint'||s.dialogue?.remaining===0,'nick-hint done',8000);
  await warp(...BAND);
  s=await wait(s=>s.dialogue?.voice==='jaan-hint','jaan-hint again on the next approach',12000);detail.jaanAgain=brief(s);
  await sleep(400);const heard=(await lines()).filter(l=>l.voice==='jaan-hint');detail.jaanLines=heard;
  assert.equal(heard.length,2,'Jaan called his hint twice: cut short, then whole');
 });

 // Review findings 4 and 7: with C3 intact SMITH is hunting you at the chair when you sit. Inside, no SEEN
 // and SMITH walks off; after the rescue Nick is not taken while he says his line. God mode (the ambush is
 // the camera rule: C3 still sees the chair, see the report).
 await session('c3',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail,voices,lines}=ctx;
  await command('god');
  let s=await wait(s=>s.agentic.smith_mode===1,'C3 brings SMITH',8000);detail.spotted=brief(s);
  // (?puzzle= sites wake SMITH's patrol at tick 175: sit once it would walk.)
  s=await wait(s=>s.world.ticks>=230&&s.agentic.smith_mode===1,'SMITH hunting you at the chair',8000);detail.hunting=brief(s);
  s=await sit(ctx,detail);
  const inside=await sample(read,3000,150,[]);detail.inside=inside;
  assert.ok(inside.every(r=>r.seenLeft===0),`no SEEN in the Construct (${inside.map(r=>r.seenLeft)})`);
  assert.ok(inside.slice(2).every(r=>r.smode!==1&&r.smode!==2),'SMITH no longer hunts or answers an alarm');
  const moved=dist(inside[0].smith,inside[inside.length-1].smith);detail.smithMoved=Math.round(moved);
  assert.ok(moved>40,`SMITH walks off (${moved} u)`);
  await shot('c3-inside');
  s=await turnAway(ctx,detail);s=await lookBack(ctx,detail);
  s=await jackOut(ctx,true);const freedAt=s.world.ticks;
  const after=[];const end=Date.now()+9000;let shotDone=false;
  while(Date.now()<end){
   s=await read();const r=brief(s);r.smithBearing=Math.round(diff(angleTo(s.world,...smithAt(s)),s.world.angle));r.smithDist=Math.round(dist(here(s),smithAt(s)));after.push(r);
   if(!shotDone&&r.smithDist<120){shotDone=true;await shot('c3-jack-out-smith');}
   await sleep(150);
  }
  if(!shotDone)await shot('c3-jack-out-smith');
  detail.after=after;
  const early=after.filter(r=>r.t<freedAt+270);
  assert.ok(early.every(r=>!(r.possessed&2)),`Nick not possessed during his freed line (${early.map(r=>r.possessed)})`);
  const lineAt=(await lines()).find(l=>l.voice==='nick-freed-guide');assert.ok(lineAt,'nick-freed-guide');
  detail.freedLine=lineAt;detail.firstPossessed=after.find(r=>r.possessed&2)?.t-freedAt;
  // SMITH, when it comes back through C3, appears on screen (you face the pod and the camera spot is in view).
  const close=after.filter(r=>r.smithDist<64);detail.closeBearings=close.map(r=>r.smithBearing);
 });

 // The review's c3-fast run: C3 intact, a quick solve (a few seconds inside), then stand still where you
 // land. SMITH was parked by the chair and took Nick 70 tics after his release; now it has walked off.
 await session('c3fast',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail,lines}=ctx;
  await command('god');
  let s=await wait(s=>s.world.ticks>=230&&s.agentic.smith_mode===1,'SMITH hunting you at the chair',10000);
  s=await sit(ctx,detail);const sat=s.world.ticks;
  s=await turnAway(ctx,detail);s=await lookBack(ctx,detail);
  s=await jackOut(ctx,true);const freedAt=s.world.ticks;detail.inside=freedAt-sat;
  detail.smithAtJackOut=Math.round(dist(here(s),smithAt(s)));
  const after=[];const end=Date.now()+8000;
  while(Date.now()<end){s=await read();const r=brief(s);r.smithDist=Math.round(dist(here(s),smithAt(s)));r.smithBearing=Math.round(diff(angleTo(s.world,...smithAt(s)),s.world.angle));after.push(r);await sleep(200);}
  await shot('c3fast-after');
  detail.after=after.map(r=>[r.t-freedAt,r.smode,r.smithDist,r.smithBearing,r.possessed,r.voice]);
  detail.closest=Math.min(...after.map(r=>r.smithDist));
  assert.ok(after.filter(r=>r.t<freedAt+270).every(r=>!(r.possessed&2)),'Nick not possessed during his freed line');
 });

 // Review finding 5: Yoshua, possessed, would call SMITH to your spot in the Construct every 6 s.
 await session('alarm',async ctx=>{
  const {page,read,wait,press,face,hold,command,shot,detail}=ctx;
  await command('god');await command('pdoom_development 1');
  await command('netevent pdoom_agentic_qa_out 0 0');await command('netevent pdoom_agentic_qa_out 4 1');
  let s=await wait(s=>s.agentic.possessed&16,'SMITH possesses Yoshua at the chair',40000);detail.possessed=brief(s);
  s=await read();await face(angleTo(s.world,...LEATHER));
  s=await sit(ctx,detail);
  const inside=await sample(read,12000,300,[]);detail.inside=inside;
  assert.ok(inside.every(r=>r.possessed&16),'Yoshua stays possessed');
  assert.ok(inside.every(r=>r.alarms===inside[0].alarms),`no alarms while inside (${inside.map(r=>r.alarms)})`);
  assert.ok(inside.every(r=>!/calling SMITH/.test(r.msg)),'no calling-SMITH status in the white room');
  let path=0;for(let i=1;i<inside.length;i++)path+=dist(inside[i-1].smith,inside[i].smith);detail.smithPath=Math.round(path);
  assert.ok(path>150,`SMITH keeps moving (${path} u)`);
  await shot('alarm-inside');
  // Out again (without him): Yoshua goes back to calling SMITH.
  s=await turnTo({page,read},270,8);s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt',2000);
  await press('Space');s=await wait(s=>s.agentic.in_construct===0,'Back in the farm',3000);const alarms=s.agentic.alarm_count;
  s=await wait(s=>s.agentic.alarm_count>alarms||!(s.agentic.possessed&16),'Yoshua acts again once you are out',12000);detail.afterOut=brief(s);
 });

 // A QA release (as the hub walk-in and ?puzzle=exit free people) while you are in the Construct: his mind
 // goes, the white chair still takes you back, and the leather chair has nothing more to offer.
 await session('qa',async ctx=>{
  const {page,read,wait,press,face,hold,command,detail}=ctx;
  let s=await read();await command('god');
  s=await sit(ctx,detail);
  await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 1 1');
  s=await wait(s=>s.agentic.freed&2,'QA release',4000);
  assert.equal(s.agentic.in_construct,1,'still in the Construct');assert.equal(s.agentic.mind_x,0,'his mind is gone');
  s=await face(angleTo((await read()).world,...CHAIR));
  s=await wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt after a QA release',3000);
  await press('Space');s=await wait(s=>s.agentic.in_construct===0,'Back in the farm',3000);
  await face(angleTo(s.world,...LEATHER));await sleep(300);s=await read();
  detail.after={prompt:s.world.prompt,at:here(s).map(Math.round)};
  assert.equal(s.world.prompt,'','no sit prompt once he is free');
 });
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'agentic bostrom smoke passed':'agentic bostrom smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
