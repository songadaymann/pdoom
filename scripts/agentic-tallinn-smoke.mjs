// Level 4 rescue 1, Jaan Tallinn: Run the hardline (doom-mod/actors/AgenticTallinn.zs), headless and muted.
//   python3 scripts/build-agentic-preview.py --resources-only --only tallinn --out output/agentic/qa-tallinn.pk3
//   node scripts/agentic-tallinn-smoke.mjs     (CASES=straight,detour,cut,sprint,ownsight,deathAtDrum)
// straight: smash C2 with the wrench, take the BOOTH 7 line, walk the straight route, plug in: the booth
//   rings, Jaan answers, the door opens, he steps out and leads. Nobody else calls out while you carry it.
// detour: the line can go straight back on the drum; then the long way round runs the drum empty: the line
//   goes taut, you are held, Jaan says so; walking back reels it in, and the drum takes it back.
// cut: C2 intact: it sees you with the line, SMITH appears, walks to the cable (not to you), takes hold
//   and cuts it at once; the drum is full again and Jaan names the camera.
// sprint: C2 intact, Shift held the whole straight route: SMITH holds you at his hands and cuts the line
//   before you reach the jack; Jaan stays in the booth.
// ownsight: C2 smashed while SMITH is already after you: carrying the line in his sight, he hunts you and
//   leaves the line alone, and the plug-in still frees Jaan.
// deathAtDrum: dead while facing the drum, SPACE still respawns (the take prompt is gone).
// Everything the player does is real input (face/hold/press); nobody is ever warped.
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/tallinn';await fs.mkdir(out,{recursive:true});
const pk3=process.env.TALLINN_PK3||'output/agentic/qa-tallinn.pk3';
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const C2=map.cameras.find(c=>c.index===1),DRUM=map.cable_start,EXIT=map.sites[0].exit,BUDGET=map.cable.budget;
// The jack hangs on the booth door's east jamb (AgenticTallinn.zs JackSpot: BoothPhone + (72,31)).
const JACK=[map.booth_phone[0]+72,map.booth_phone[1]+31];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,pk3,cases:[],errors:[]};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,800));};
const W=ms=>new Promise(r=>setTimeout(r,ms));
const here=s=>[s.world.x,s.world.y];
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
const brief=s=>({t:s.world.ticks,at:here(s).map(Math.round),hp:s.world.health,cable:s.agentic.cable,used:s.agentic.cable_used,segs:s.agentic.cable_segments,cuts:s.agentic.cable_cuts,plugged:s.agentic.cable_plugged,csmith:s.agentic.cable_smith,camera:s.agentic.cable_camera,mode:s.agentic.smith_mode,smith:smithAt(s).map(Math.round),spot:s.agentic.spot_camera,freed:s.agentic.freed,wrench:s.world.wrench,prompt:s.world.prompt,voice:s.dialogue?.voice});

async function session(name,fn){
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  qa=await bootAgentic(page,{puzzle:'tallinn',pk3});
  await page.evaluate(()=>{window.__VOICES__=[];setInterval(()=>{try{const v=JSON.parse(window.render_game_to_text()).dialogue?.voice;if(v&&!window.__VOICES__.includes(v))window.__VOICES__.push(v);}catch{}},50);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  await fn({page,...qa,shot,detail,voices,engine});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{const s=await qa?.read();detail.final=s&&brief(s);detail.voices=await page.evaluate(()=>window.__VOICES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
// Real walking toward a point: turn, then hold forward in short bursts. Throws when it stops making
// progress; onStep sees every state read on the way (for the cable checks).
async function walkTo({read,face,hold},x,y,{near=24,timeout=25000,onStep,until}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const s=await read();onStep?.(s);const w=s.world,d=Math.hypot(x-w.x,y-w.y);if(d<near||until?.(s))return s;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${Math.round(w.x)},${Math.round(w.y)}`);
  await face(angleTo(w,x,y));await hold('KeyW',Math.min(450,Math.max(90,d*2.6)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
async function walkRoute(qa,points,opts){let s;for(const [x,y] of points)s=await walkTo(qa,x,y,opts);return s;}
// Running flat out: Shift+W held the whole way, steering with the arrow keys between state reads (a
// player running with the mouse). Shift turning: about 6 slow tics at 1.76 degrees, then 7 a tic.
const turnMs=d=>(d<=10.5?d/1.76:6+(d-10.5)/7.03)*28.57;
async function sprint(page,read,points,{onStep,advance=80,last=20,timeout=20000,stop}={}){
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 let i=0,s,lastT=-1,settle=0;const end=Date.now()+timeout;
 try{
  while(i<points.length&&Date.now()<end){
   s=await read();if(stop&&await stop(s))break;if(s.world.ticks===lastT||s.world.ticks<settle){await W(8);continue;}lastT=s.world.ticks;onStep?.(s);
   const [x,y]=points[i],dd=Math.hypot(x-s.world.x,y-s.world.y);
   if(dd<(i===points.length-1?last:advance)){i++;continue;}
   const d=((angleTo(s.world,x,y)-s.world.angle+540)%360)-180;
   if(Math.abs(d)>8){const k=d>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(k);await W(turnMs(Math.abs(d)));await page.keyboard.up(k);settle=lastT+Math.ceil(turnMs(Math.abs(d))/28.57)+8;}
  }
 }finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
 return read();
}
async function takeLine({read,wait,face,press}){
 let s=await read();await face(angleTo(s.world,...DRUM));
 s=await wait(s=>s.world.prompt==='SPACE - take the BOOTH 7 line','Take-the-line prompt at the drum');
 await press('Space');
 return wait(s=>s.agentic.cable===1&&s.world.cable===1&&s.world.wrench===0,'Carrying the BOOTH 7 line (hardline hands, wrench stowed)',3000);
}
// Smash C2 with the wrench from just below it, out of its cone (it looks west along the band).
async function smashC2({read,wait,face,hold}){
 await walkTo({read,face,hold},920,850,{near:16});
 await walkTo({read,face,hold},848,848,{near:12});
 await face(angleTo((await read()).world,C2.x,C2.y));
 await hold('ControlLeft',120);
 return wait(s=>s.world.cameras_broken===1&&s.events?.some(e=>e.type==='camera-broken'&&e.index===1),'C2 smashed with the wrench',3000);
}
// The straight route: out of hall 31 through the opening at x 896, west along the band (under C2),
// down the west strip and east along the lobby to the booth door.
const STRAIGHT=[[920,832],[600,830],[-112,828],[-112,548],[36,528]];
const SPRINT=[[900,845],[-80,815],[-85,610],[15,545],[60,540]];

try{
 await session('straight',async({page,read,wait,press,hold,face,command,shot,detail,voices})=>{
  let s=await read();await command('god');
  assert.ok(dist(here(s),map.site_spots['1'])<24,'at ?puzzle=tallinn');
  assert.equal(s.world.prompt,'SPACE - take the BOOTH 7 line','the drum is the first thing in view');
  assert.equal(s.agentic.cable_budget,BUDGET);assert.equal(s.agentic.cable_drum,0,'drum full');
  await shot('straight-1-drum');
  s=await smashC2({read,wait,face,hold});
  detail.c2={smith_mode:s.agentic.smith_mode,spot_camera:s.agentic.spot_camera};
  await W(300);await shot('straight-2-c2-smashed');
  // Back to the drum and take the line.
  await walkTo({read,face,hold},1000,1040,{near:20});
  s=await takeLine({read,wait,face,press});
  detail.taken={used:s.agentic.cable_used,drum:s.agentic.cable_drum};
  // The straight route with the line out. Nick's pod (through the band's north wall) keeps quiet.
  let maxUsed=0,taut=0,cuts=0,muted=0;const onStep=s=>{maxUsed=Math.max(maxUsed,s.agentic.cable_used);taut|=s.agentic.cable_taut;cuts+=s.agentic.cable_cuts;muted|=s.agentic.cable_muted;assert.equal(s.agentic.cable,1,'still carrying');};
  await walkTo({read,face,hold},...STRAIGHT[0],{onStep});
  await walkTo({read,face,hold},...STRAIGHT[1],{onStep});
  s=await read();await face(0);await W(300);await shot('straight-3-line-along-band');
  detail.band={used:s.agentic.cable_used,segments:s.agentic.cable_segments,drum:s.agentic.cable_drum};
  assert.ok(s.agentic.cable_segments>=Math.floor(s.agentic.cable_used/24)-1,'segments lie along the line');
  for(const p of STRAIGHT.slice(2))await walkTo({read,face,hold},...p,{onStep});
  s=await read();await face(angleTo(s.world,...JACK));
  s=await wait(s=>s.world.prompt==='SPACE - plug in the line','Plug-in prompt at the jack',4000);
  detail.atJack={used:s.agentic.cable_used,budget:s.agentic.cable_budget,maxUsed,taut,drum:s.agentic.cable_drum,at:here(s).map(Math.round),muted};
  assert.equal(taut,0,'never taut on the straight route');assert.equal(cuts,0,'SMITH never cut it');
  assert.ok(muted&2,'Nick\'s pod hint held back while carrying');
  assert.ok(s.agentic.cable_used<=BUDGET*.93,`the straight route leaves slack (${s.agentic.cable_used} of ${BUDGET})`);
  await shot('straight-4-at-jack');
  await press('Space');
  s=await wait(s=>s.agentic.cable_plugged===1&&s.world.cable===0&&s.world.wrench===1,'Plugged in: hands free, wrench back',3000);
  await W(400);await shot('straight-5-plugged');
  // Step back out of the doorway so he can come out (he walks to his SiteExit in front of the door).
  await walkTo({read,face,hold},-60,440,{near:20});
  s=await read();await face(angleTo(s.world,36,640));
  s=await wait(s=>s.agentic.freed&1,'The booth rings and Jaan answers: freed',8000);
  detail.freed={tick:s.world.ticks,guide:s.agentic.guide};assert.equal(s.agentic.guide,0,'Jaan is the guide');
  s=await wait(s=>s.world.people[0].visible===1,'Booth door open: Jaan in view',4000);
  await W(600);await shot('straight-6-door-open');
  s=await wait(s=>dist([s.world.people[0].x,s.world.people[0].y],EXIT)<32,'Jaan steps out of the booth',15000);
  detail.out={jaan:[s.world.people[0].x,s.world.people[0].y].map(Math.round)};
  // He leads: follow his trail (staying within his 224 u leash) and watch him head for the refuge.
  const trail=[];let lead=0;const end=Date.now()+60000;
  while(Date.now()<end){
   s=await read();const j=s.world.people[0],p=[j.x,j.y];lead=Math.max(lead,dist(p,EXIT));
   if(!trail.length||dist(trail[trail.length-1],p)>24)trail.push(p);
   if(lead>360)break;
   while(trail.length>1&&dist(here(s),trail[0])<40)trail.shift();
   if(dist(here(s),p)>96){await face(angleTo(s.world,...trail[0]));await hold('KeyW',Math.min(300,Math.max(90,dist(here(s),trail[0])*2)));}
   else await W(200);
  }
  detail.lead=Math.round(lead);assert.ok(lead>360,`Jaan leads off toward the refuge (${Math.round(lead)} u from his exit)`);
  s=await read();await face(angleTo(s.world,s.world.people[0].x,s.world.people[0].y));await W(300);await shot('straight-7-jaan-leads');
  const v=await voices();detail.lines=v;detail.mutedAfter=s.agentic.cable_muted;
  assert.ok(v.includes('jaan-freed-guide'),'jaan-freed-guide line');
  assert.ok(!v.includes('jaan-taut')&&!v.includes('jaan-cut')&&!v.includes('smith-cut'),'no taut or cut lines');
  assert.ok(!v.includes('nick-pod'),'no nick-pod during the hardline run');
  assert.equal(s.agentic.cable_plugged,1);assert.equal(s.agentic.cable_cuts,0);
 });

 await session('detour',async({page,read,wait,press,hold,face,command,shot,detail,voices})=>{
  let s=await read();await command('god');
  // Changed your mind: the line goes straight back on the drum, no walk needed.
  s=await takeLine({read,wait,face,press});
  s=await wait(s=>s.world.prompt==='SPACE - put the line back','Put-back prompt right at the drum',3000);
  detail.putBackAt={used:s.agentic.cable_used};
  await press('Space');
  s=await wait(s=>s.agentic.cable===0&&s.world.cable===0&&s.world.wrench===1&&s.agentic.cable_drum===0,'Put straight back: wrench in hand',3000);
  s=await wait(s=>s.world.prompt==='SPACE - take the BOOTH 7 line','Take prompt again',3000);
  s=await takeLine({read,wait,face,press});
  // The long way round (map-debug.json cable.detour): south through hall 31, east and down, then west
  // along the south corridor toward nook 17. The drum runs empty well before the band. (900,256) steers
  // under the railing box at x 832-864, y 288-320 that a straight walk from (1200,304) can catch on, and
  // (470,234) keeps clear of the wall corner at (432..448,256..272) that a walk along y 250 grazes.
  const route=[...map.cable.detour.slice(1,5),[900,256],[470,234],map.cable.detour[5]];
  // The way you came, every 64 u, to walk back along the line.
  let taut=null;const reached=[],trail=[here(s)];
  const onStep=s=>{if(s.agentic.cable_taut&&!taut)taut=s;if(dist(trail[trail.length-1],here(s))>64)trail.push(here(s));assert.equal(s.agentic.cable_cuts,0,'SMITH cut the line during the detour');};
  for(const p of route){
   try{await walkTo({read,face,hold},...p,{onStep,timeout:30000});}catch(e){if(!taut)throw e;}
   if(taut)break;reached.push(p);
  }
  assert.ok(taut,'the line went taut on the long way round');
  s=await wait(s=>s.agentic.cable_taut===1||s.agentic.cable_used>=BUDGET-2,'At the limit',3000);
  detail.taut={at:here(s).map(Math.round),used:s.agentic.cable_used,drum:s.agentic.cable_drum,message:s.world.message};
  assert.equal(s.agentic.cable_drum,2,'drum empty');assert.match(s.world.message,/THE CABLE WON'T REACH/);
  // Push on: held at the limit (no progress along the route, no extra cable).
  const goal=route[reached.length],before=dist(here(s),goal);
  await face(angleTo(s.world,...goal));
  await page.keyboard.down('KeyW');await W(1500);s=await read();await page.keyboard.up('KeyW');
  detail.held={before:Math.round(before),after:Math.round(dist(here(s),goal)),used:s.agentic.cable_used,taut:s.agentic.cable_taut};
  assert.ok(dist(here(s),goal)>=before-6,`held at the limit (${Math.round(before)} -> ${Math.round(dist(here(s),goal))})`);
  assert.ok(s.agentic.cable_used<=BUDGET,'never past the budget');assert.equal(s.agentic.cable_taut,1,'taut while pushing on');
  await shot('detour-1-taut');
  // Look back along the taut line to the last corner it wraps.
  const corners=s.agentic.cable_corners.split('|').filter(Boolean).map(c=>c.split(' ').map(Number));detail.corners=corners;
  assert.ok(corners.length>=4,'the line wraps the corners of the long way round');
  await face(angleTo(s.world,...corners[corners.length-1]));await W(300);await shot('detour-1b-line-behind');
  for(let i=0;i<40&&!(await voices()).includes('jaan-taut');i++)await W(150);
  assert.ok((await voices()).includes('jaan-taut'),'jaan-taut line');
  // Reel in: walk back the way you came; the line shortens and its pieces come up.
  detail.route={reached,goal};
  const usedAt=s.agentic.cable_used,segsAt=s.agentic.cable_segments;
  s=await walkRoute({read,face,hold},trail.slice(0,-1).reverse().filter((p,i,a)=>i%2===0||i===a.length-1),{near:32});
  detail.reeled={from:usedAt,to:s.agentic.cable_used,segmentsFrom:segsAt,segmentsTo:s.agentic.cable_segments,drum:s.agentic.cable_drum};
  assert.ok(s.agentic.cable_used<usedAt-300,'walking back reels it in');assert.ok(s.agentic.cable_segments<segsAt-10,'pieces come up');
  assert.equal(s.agentic.cable_taut,0);
  await face(angleTo(s.world,...DRUM));await W(300);await shot('detour-2-reeled');
  // Back at the drum: put it back.
  await walkTo({read,face,hold},1000,1000,{near:24});s=await read();await face(angleTo(s.world,...DRUM));
  s=await wait(s=>s.world.prompt==='SPACE - put the line back','Put-back prompt',4000);
  await press('Space');
  s=await wait(s=>s.agentic.cable===0&&s.agentic.cable_segments===0&&s.world.wrench===1&&s.agentic.cable_drum===0,'Line back on the drum, wrench in hand',3000);
  await W(200);await shot('detour-3-put-back');
  assert.ok(!(await voices()).includes('smith-cut'),'SMITH stayed out of it');
 });

 await session('cut',async({page,read,wait,press,hold,face,command,shot,detail,voices})=>{
  let s=await read();await command('god');
  s=await takeLine({read,wait,face,press});
  // Out onto the band with C2 intact, then back west along it facing C2, so SMITH's arrival is in view.
  let seen=null,busy=null;
  const onStep=s=>{if(!seen&&s.agentic.spot_camera===1)seen=s;if(!busy&&s.agentic.smith_busy)busy=s;};
  const until=s=>s.agentic.smith_busy===1;
  s=await walkTo({read,face,hold},...STRAIGHT[0],{onStep,until});
  if(!busy){
   s=await walkTo({read,face,hold},860,830,{onStep,until,near:16});
   if(!busy){await face(0);const end=Date.now()+15000;while(!busy&&Date.now()<end&&s.world.x>480){await hold('KeyS',250);s=await read();onStep(s);}}
  }
  s=busy&&busy.agentic.smith_mode===7?busy:await wait(s=>s.agentic.smith_mode===7&&s.agentic.smith_busy===1,'C2 sees you with the line: SMITH comes for the cable (mode 7)',10000);
  detail.summoned={spot:s.agentic.spot_camera,camera:s.agentic.cable_camera,smith:smithAt(s).map(Math.round),you:here(s).map(Math.round),todo:s.agentic.todo};
  assert.equal(s.agentic.spot_camera,1,'C2 saw you');assert.equal(s.agentic.cable_camera,1,'C2 sent SMITH for the line');
  assert.ok(dist(smithAt(s),map.cameras[1].spot)<160,'SMITH materialised at C2');
  // He goes for the cable, not for you: never within reach of you before the cut, no damage.
  let minToYou=1e9,held=false;const hp=s.world.health;
  s=await wait(s=>{minToYou=Math.min(minToYou,dist(smithAt(s),here(s)));return s.agentic.cable_smith===2||s.agentic.cable_cuts>0;},'SMITH takes hold of the line',8000);
  if(s.agentic.cable_smith===2&&!s.agentic.cable_cuts){held=true;await shot('cut-1-smith-holds-line');}
  detail.grab={smith:smithAt(s).map(Math.round),you:here(s).map(Math.round),shot:held};
  s=await wait(s=>s.agentic.cable_cuts===1,'SMITH cuts the line',3000);
  await shot('cut-2-snap');
  detail.grabToCut=s.agentic.cable_cut_tic-s.agentic.cable_grab_tic;detail.minSmithToYou=Math.round(minToYou);
  assert.ok(s.agentic.cable_grab_tic>0&&detail.grabToCut>=15&&detail.grabToCut<=25,`the cut comes straight after the grab (${detail.grabToCut} tics)`);
  s=await wait(s=>s.agentic.cable===0&&s.agentic.cable_used===0&&s.agentic.cable_segments===0&&s.agentic.cable_drum===0,'Whipped back: drum full again',3000);
  assert.equal(s.world.cable,0);assert.equal(s.world.wrench,1,'wrench back in hand');
  s=await wait(s=>s.agentic.smith_busy===0&&s.agentic.smith_mode!==7,'SMITH back to normal',3000);
  detail.after={mode:s.agentic.smith_mode,health:s.world.health,hpBefore:hp};
  for(let i=0;i<60&&!(await voices()).includes('jaan-cut');i++)await W(200);
  const v=await voices();detail.lines=v;
  assert.ok(v.includes('smith-cut'),'smith-cut line');assert.ok(v.includes('jaan-cut'),'jaan-cut line');
  assert.ok(v.indexOf('smith-cut')<v.indexOf('jaan-cut'),'Jaan speaks after SMITH');
  await walkRoute({read,face,hold},[[880,836],[990,990]],{near:32}).catch(()=>{});s=await read();await face(angleTo(s.world,...DRUM));await W(300);await shot('cut-3-drum-full');
 });

 // Review finding 1: with C2 intact, running flat out never beats the cut. SMITH grabs the line on the band,
 // you can pay out no further than his hands, and it snaps at once; the jack never takes a plug.
 await session('sprint',async({page,read,wait,press,hold,face,command,shot,detail,voices})=>{
  await command('god');
  let s=await read();await face(300);
  s=await wait(s=>s.world.prompt==='SPACE - take the BOOTH 7 line','Take prompt');await page.keyboard.press('Space',{delay:40});
  s=await wait(s=>s.agentic.cable===1,'Carrying',3000);
  const ev={},grabbed=[],carryVoices=new Set();let plugPrompt=null,pressed=0;detail.ev=ev;
  const onStep=s=>{const b=brief(s);if(b.cable===1&&b.voice)carryVoices.add(b.voice);if(b.spot===1&&!ev.seen)ev.seen=b;if(b.mode===7&&!ev.busy)ev.busy=b;if(b.csmith===2){if(!ev.grab)ev.grab=b;grabbed.push(b);}if(b.cuts&&!ev.cut)ev.cut=b;if(b.prompt==='SPACE - plug in the line'&&!plugPrompt)plugPrompt=b;};
  // Flat out until the jack offers the plug (pressed at once) or the line is cut.
  const stop=async s=>{if(s.world.prompt==='SPACE - plug in the line'){plugPrompt=plugPrompt||brief(s);await page.keyboard.press('Space',{delay:30});pressed++;return true;}return s.agentic.cable_cuts>0;};
  s=await sprint(page,read,SPRINT,{onStep,stop});
  detail.sprintEnd={...brief(s),plugPrompt,pressed};
  // Cut on the band: carry on to the jack anyway. Space there does nothing with a dead line.
  if(!s.agentic.cable_plugged)for(const p of STRAIGHT.slice(2))s=await walkTo({read,face,hold},...p,{onStep});
  detail.end=brief(s);
  await face(angleTo(s.world,...JACK));await W(300);onStep(await read());await press('Space');
  for(let i=0;i<12;i++){s=await read();onStep(s);await W(250);}
  detail.after=brief(s);
  await shot('sprint-1-at-jack-line-cut');
  assert.ok(ev.seen,'C2 saw the sprinting player');assert.ok(ev.grab,'SMITH took hold of the line');
  assert.equal(s.agentic.cable_cuts,1,'the line was cut');assert.equal(s.agentic.cable_plugged,0,'never plugged in');
  assert.equal(s.agentic.freed&1,0,'Jaan still in the booth');assert.equal(plugPrompt,null,'no plug-in prompt with the line cut');
  assert.equal(s.agentic.cable,0);assert.equal(s.world.wrench,1,'hands free again');
  // Held at SMITH's hands: no more line paid out while he had it.
  detail.held={first:grabbed[0]?.used,max:Math.max(...grabbed.map(b=>b.used)),reads:grabbed.length};
  assert.ok(detail.held.max-detail.held.first<=12,`no line paid out past his hands (${detail.held.first} -> ${detail.held.max})`);
  detail.grabToCut=s.agentic.cable_cut_tic-s.agentic.cable_grab_tic;assert.ok(detail.grabToCut>=15&&detail.grabToCut<=25,`cut straight after the grab (${detail.grabToCut} tics)`);
  for(let i=0;i<30&&!(await voices()).includes('jaan-cut');i++)await W(200);
  const v=await voices();detail.lines=v;
  assert.ok(v.includes('smith-cut')&&v.includes('jaan-cut'),'smith-cut then jaan-cut');
  detail.carryVoices=[...carryVoices];
  assert.ok(!carryVoices.has('nick-pod'),'no nick-pod while carrying the line');
 });

 // Review findings 2 and 6: the cut is the cameras' business. C2 is smashed while SMITH is already after
 // you (he came from C2 before it broke); taking the line with him in sight, he hunts you and leaves the
 // line alone, and plugging in still works.
 await session('ownsight',async({page,read,wait,press,hold,face,command,shot,detail,voices})=>{
  await command('god');
  // Let C2 see you without the line: SMITH comes out of it and hunts you.
  await walkTo({read,face,hold},920,850,{near:16});
  let s=await walkTo({read,face,hold},720,832,{near:16});
  s=await wait(s=>s.agentic.spot_camera===1&&s.agentic.smith_mode===1,'C2 sees you: SMITH hunts',8000);
  detail.hunted={smith:smithAt(s).map(Math.round),you:here(s).map(Math.round)};
  s=await smashC2({read,wait,face,hold});
  detail.smashed={mode:s.agentic.smith_mode,smith:smithAt(s).map(Math.round)};
  await walkTo({read,face,hold},1000,1040,{near:20});
  s=await read();detail.beforeTake={mode:s.agentic.smith_mode,smithToYou:Math.round(dist(smithAt(s),here(s)))};
  s=await takeLine({read,wait,face,press});
  let huntedCarrying=0,mode7=0,cuts=0,minToYou=1e9;
  const onStep=s=>{if(s.agentic.cable===1&&s.agentic.smith_mode===1)huntedCarrying++;if(s.agentic.smith_mode===7||s.agentic.smith_busy)mode7++;cuts=Math.max(cuts,s.agentic.cable_cuts);if(s.agentic.cable===1)minToYou=Math.min(minToYou,dist(smithAt(s),here(s)));};
  await W(400);onStep(await read());await shot('ownsight-1-smith-hunts-carrier');
  for(const p of STRAIGHT)s=await walkTo({read,face,hold},...p,{onStep});
  s=await read();await face(angleTo(s.world,...JACK));
  s=await wait(s=>{onStep(s);return s.world.prompt==='SPACE - plug in the line';},'Plug-in prompt with SMITH hunting',4000);
  detail.atJack={...brief(s),huntedCarrying,mode7,minToYou:Math.round(minToYou)};
  await press('Space');
  s=await wait(s=>s.agentic.cable_plugged===1,'Plugged in',3000);
  s=await wait(s=>{onStep(s);return s.agentic.freed&1;},'Jaan freed',8000);
  await W(300);s=await read();await face(angleTo(s.world,...smithAt(s)));await shot('ownsight-2-freed');
  detail.end=brief(s);
  assert.ok(huntedCarrying>0,'SMITH hunted you (his own eyes) while you carried the line');
  assert.equal(mode7,0,'SMITH never went for the line');assert.equal(cuts,0,'no cut without a camera');
  const v=await voices();detail.lines=v;
  assert.ok(!v.includes('smith-cut')&&!v.includes('jaan-cut'),'no cut lines');
 });

 // Review finding 3: dead while facing the drum, SPACE respawns.
 await session('deathAtDrum',async({page,read,wait,face,command,shot,detail})=>{
  let s=await read();await face(angleTo(s.world,...DRUM));
  s=await wait(s=>s.world.prompt==='SPACE - take the BOOTH 7 line','Take prompt');
  await command('kill');
  s=await wait(s=>s.world.health<=0,'Dead',4000);await W(800);s=await read();
  detail.dead={...brief(s)};const t=s.world.ticks;
  assert.equal(s.world.prompt,'','no prompt while dead');
  await shot('deathAtDrum-1-dead');
  await page.keyboard.press('Space',{delay:60});
  s=await wait(s=>s.world.health>0&&s.world.ticks<t,'SPACE respawns',8000);
  detail.respawned=brief(s);
  s=await wait(s=>s.world.ticks>70&&s.world.health>0,'Playing again',8000);detail.playing=brief(s);
  await shot('deathAtDrum-2-respawned');
 });
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'agentic tallinn smoke passed':'agentic tallinn smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
