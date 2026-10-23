// Level 4 rescue smoke: Katja Grace, Hand the agent a survey (doom-mod/actors/AgenticGrace.zs).
// node scripts/agentic-grace-smoke.mjs
//   CASES=survey,reader,stun,retry,qa-free,death-smith,death-reader,late-swipe,follower,carry,earshot,guide
// Builds on: python3 scripts/build-agentic-preview.py --resources-only --only grace --out output/agentic/qa-grace.pk3
// Headless and muted; real input for everything the player does (the player may be warped, god mode is on);
// companions are never moved by the test (the core's QA release with argument 0 puts Jaan in his refuge slot).
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/grace';await fs.mkdir(out,{recursive:true});
const pk3=process.env.GRACE_PK3||'output/agentic/qa-grace.pk3';
const only=process.env.CASES?.split(',');
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const SPOT=map.site_spots['4'],ROOM=[1760,1072],SHORE=map.stone_shore,ISLAND=map.sites[3].prisoner,EXIT=map.sites[3].exit;
const READER=[1700,1136];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,pk3,cases:[],errors:[]};
const record=(name,passed,detail)=>{report.cases.push({name,passed,...detail});console.log(passed?'PASS':'FAIL',name,passed?'':String(detail.failure).slice(0,800));};
const wait_ms=ms=>new Promise(r=>setTimeout(r,ms));
const here=s=>[s.world.x,s.world.y];
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
const katja=s=>s.world.people[3];
const katjaAt=s=>[katja(s).x,katja(s).y];
// A clipboard on her shore: StoneShore, or the nearest dry spot of room 77 clear of SMITH.
const clipAt=s=>[s.agentic.clipboard_x,s.agentic.clipboard_y];
const onShore=s=>{const [x,y]=clipAt(s);return x>1600&&x<1920&&y>1000&&y<1150&&dist([x,y],SHORE)<=160;};

async function session(name,fn,{puzzle='grace'}={}){
 if(only&&!only.includes(name))return;
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=[],errors=[];watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 const detail={};let qa;
 try{
  qa=await bootAgentic(page,{puzzle,pk3});
  // Every voice key, status message and prompt seen, and each change of the possessed mask, polled in
  // the page (the state only holds the current one).
  await page.evaluate(()=>{window.__VOICES__=[];window.__MESSAGES__=[];window.__PROMPTS__=[];window.__POSS__=[];window.__MODES__=[];setInterval(()=>{try{const s=JSON.parse(window.render_game_to_text()),v=s.dialogue?.voice,m=s.world?.message,p=s.world?.prompt,po=s.agentic?.possessed;if(v&&window.__VOICES__.at(-1)!==v)window.__VOICES__.push(v);if(m&&window.__MESSAGES__.at(-1)!==m)window.__MESSAGES__.push(m);if(p&&window.__PROMPTS__.at(-1)!==p)window.__PROMPTS__.push(p);if(po!==undefined&&window.__POSS__.at(-1)?.[1]!==po)window.__POSS__.push([s.world.ticks,po]);const mo=s.agentic?.smith_mode;if(mo!==undefined&&window.__MODES__.at(-1)?.[1]!==mo)window.__MODES__.push([s.world.ticks,mo]);}catch{}},50);});
  const voices=()=>page.evaluate(()=>window.__VOICES__);
  const messages=()=>page.evaluate(()=>window.__MESSAGES__);
  const prompts=()=>page.evaluate(()=>window.__PROMPTS__);
  const poss=()=>page.evaluate(()=>window.__POSS__);
  // The tick SMITH's survey (mode 5) that started at or after `from` ended, from the polled mode changes.
  // (Both ends from the in-page record: under load the harness's own polls can lag the game by seconds.)
  const surveySpan=async near=>{const m=await page.evaluate(()=>window.__MODES__);let i=-1;m.forEach(([t,mo],k)=>{if(mo===5&&t<=near+35)i=k;});const e=i<0?null:m.slice(i+1).find(([,mo])=>mo!==5);return i<0||!e?null:{start:m[i][0],end:e[0],tics:e[0]-m[i][0]};};
  const surveyEnd=async from=>(await surveySpan(from))?.end??null;
  await fn({page,...qa,shot,detail,voices,messages,prompts,poss,surveyEnd,surveySpan});
  assert.deepEqual(errors,[],'page errors');
  assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
  detail.voices=await voices();record(name,true,detail);
 }catch(e){
  detail.failure=String(e.stack||e).slice(0,4000);detail.errors=errors;detail.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
  try{detail.final=await qa?.read();detail.voices=await page.evaluate(()=>window.__VOICES__);}catch{}
  await shot(`${name}-failure`).catch(()=>{});record(name,false,detail);
 }finally{await page.close().catch(()=>{});}
}
// Real walking: turn, then hold forward in short bursts; fails when it stops making progress.
async function walkTo({read,face,hold},x,y,{near=24,timeout=20000}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const w=(await read()).world,d=Math.hypot(x-w.x,y-w.y);if(d<near)return w;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${w.x},${w.y}`);
  await face(angleTo(w,x,y));await hold('KeyW',Math.min(450,Math.max(60,(d-near/2)*2.2)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
// Through her waiting-room door from hall 41 (SiteSpot 4) with real steps: she throws the moment you
// walk in (Jonathan, 2026-10-23), then watch the clipboard land in front of you.
async function hearKatja(qa,shot,{line=true}={}){
 const {read,wait,face}=qa;let s=await read();
 assert.equal(s.agentic.tossed,0,'no toss in hall 41');assert.equal(s.agentic.clipboard,0,'no clipboard yet');
 await face(90);
 for(let i=0;i<14&&!(s=await read()).agentic.tossed;i++)await qa.hold('KeyW',120);
 s=await wait(s=>s.agentic.tossed===1,'Katja tosses the clipboard',6000);
 assert.equal(katja(s).visible,1,'she is in view when she throws it');
 assert.equal(s.agentic.katja_hint,line?1:0,line?'her line comes with the toss':'no line while the guide leads');
 const flying=s.agentic.clipboard===1;if(flying&&shot){await shot('toss-start');await wait_ms(450);await shot('toss-mid');}
 s=await wait(s=>s.agentic.clipboard===2,'Clipboard lands',4000);
 assert.ok(onShore(s),`clipboard on her shore ${s.agentic.clipboard_x},${s.agentic.clipboard_y}`);
 if(shot){s=await read();await face(angleTo(s.world,s.agentic.clipboard_x,s.agentic.clipboard_y));await qa.hold('PageDown',260);await wait_ms(100);await shot('clipboard-landed');await qa.hold('PageUp',260);}
 return {s,flying};
}
async function takeSurvey(qa){
 const {read,wait,face,press}=qa;let s=await read();const at=[s.agentic.clipboard_x,s.agentic.clipboard_y];
 await walkTo(qa,at[0],at[1]-40,{near:14});s=await read();await face(angleTo(s.world,...at));
 await wait(s=>s.world.prompt==='SPACE - take the survey','Take-the-survey prompt',3000);
 await press('Space');return wait(s=>s.agentic.survey===1&&s.agentic.clipboard===0,'Survey taken',3000);
}
// Stand still on the shore in C6's view until SMITH is beside you.
async function awaitSmith({wait},near=100,timeout=30000){
 return wait(s=>s.agentic.smith_mode===1&&dist(here(s),smithAt(s))<near,`SMITH within ${near} u`,timeout);
}
// Keep turning to SMITH (it moves) until the wanted prompt shows, then press Space.
async function promptAtSmith({read,face,press},prompt,timeout=10000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  let s=await read();if(s.world.prompt===prompt){await press('Space');return true;}
  if(dist(here(s),smithAt(s))>4)await face(angleTo(s.world,...smithAt(s)));
  await wait_ms(80);
 }
 throw Error(`No "${prompt}" prompt facing SMITH: `+JSON.stringify((await read()).world.prompt));
}
async function surveyAndBadge(qa,shot){
 const {wait}=qa;
 await hearKatja(qa,shot);await takeSurvey(qa);await awaitSmith(qa);
 await promptAtSmith(qa,'SPACE - hand it the survey');
 let s=await wait(s=>s.agentic.smith_mode===5,'Survey starts',3000);const t0=s.world.ticks;
 await promptAtSmith(qa,'SPACE - take its badge');
 await wait(s=>s.agentic.badge===1,'Badge taken',3000);
 return t0;
}
async function swipe(qa){
 const {wait,face,press}=qa;
 await walkTo(qa,READER[0],READER[1]-46,{near:10});await face(90);
 await wait(s=>s.world.prompt==='SPACE - swipe the badge','Swipe prompt',3000);
 await press('Space');
 return wait(s=>s.agentic.swiped===1&&(s.agentic.freed&8),'Swipe releases Katja',3000);
}
// Watch her walk from the island to her SiteExit (never moved by the test): returns the trail facts,
// including whether SMITH possessed her anywhere on the way.
async function watchCrossing(qa,{shot,timeout=40000}={}){
 const {read}=qa;let last=null,lastTick=0,jump=0,minZ=1e9,shots=0,possessedOnWay=null,s;const trail=[];const end=Date.now()+timeout;
 while(Date.now()<end){
  s=await read();const k=katja(s),p=[k.x,k.y];
  if(last&&s.world.ticks>lastTick)jump=Math.max(jump,dist(last,p)/(s.world.ticks-lastTick));last=p;lastTick=s.world.ticks;
  if(!trail.length||dist(trail[trail.length-1],p)>16)trail.push(p.map(Math.round));
  if(k.y>1160&&k.y<1470)minZ=Math.min(minZ,k.z);
  if(s.agentic.possessed&8&&!possessedOnWay)possessedOnWay={at:p.map(Math.round),tick:s.world.ticks};
  if(shot&&!shots&&k.y<1420&&k.y>1240){shots++;await shot('katja-on-stones');}
  if(dist(p,EXIT)<32)break;
  await wait_ms(100);
 }
 return {s,trail,maxSpeed:+jump.toFixed(2),minZOverPool:minZ,possessedOnWay,reached:dist(last,EXIT)<32,arrivedTick:lastTick};
}
// Dead: the HUD hides the prompt, but nothing may own SPACE (Doom's respawn). One press respawns.
async function respawnWithSpace({read,page,shot},name){
 let s=await read();assert.ok(s.world.health<=0,'dead');
 await wait_ms(1500);s=await read();
 const deadPrompt=s.world.prompt;if(shot)await shot(name);
 assert.equal(deadPrompt,'','no rescue prompt while dead');
 let presses=0;
 for(;presses<3;presses++){s=await read();if(s.world.health>0)break;await page.keyboard.press('Space',{delay:80});await wait_ms(1200);}
 s=await read();for(let i=0;i<20&&!(s.world?.health>0);i++){await wait_ms(500);s=await read();}
 assert.ok(s.world.health>0,`SPACE respawns (after ${presses} presses)`);
 return {deadPrompt,presses,ticksAfter:s.world.ticks,surveyAfter:s.agentic?.survey,badgeAfter:s.agentic?.badge};
}

try{
 await session('survey',async(qa)=>{
  const {read,wait,press,hold,face,command,shot,detail,voices,poss,surveySpan}=qa;
  let s=await read();
  assert.ok(dist(here(s),SPOT)<24,`?puzzle=grace starts in hall 41 by her door ${here(s)}`);
  assert.equal(s.agentic.stones_up,0,'stones sunk');assert.equal(s.agentic.freed&8,0);
  assert.ok(dist(katjaAt(s),ISLAND)<8,'Katja on her island');
  await command('god');await face(90);await shot('start');
  // 1. Her hint and the clipboard.
  const heard=await hearKatja(qa,shot);s=heard.s;detail.flyingSeen=heard.flying;
  detail.clipboard=[s.agentic.clipboard_x,s.agentic.clipboard_y];
  for(let i=0;i<40&&!(await voices()).includes('katja-hint');i++)await wait_ms(150);
  assert.ok((await voices()).includes('katja-hint'),'katja-hint line');
  s=await takeSurvey(qa);
  // 2. C6 (behind glass, watching the shore) brings SMITH; hand him the survey.
  s=await awaitSmith(qa);detail.summoned={camera:s.agentic.spot_camera,smith:smithAt(s)};
  assert.equal(s.agentic.spot_camera,5,'C6 saw you');
  await promptAtSmith(qa,'SPACE - hand it the survey');
  s=await wait(s=>s.agentic.smith_mode===5&&s.agentic.smith_busy===1&&s.agentic.surveying===1,'SMITH starts the survey',3000);
  detail.handedAt=s.world.ticks;assert.equal(s.agentic.survey,0,'survey handed over');
  assert.match(s.agentic.todo,/^1\. COMPLETE SURVEY \(Q[\d,]+ OF 2,778\)$/);detail.todo1=s.agentic.todo;
  await face(angleTo(s.world,...smithAt(s)));await hold('KeyS',650);s=await read();await face(angleTo(s.world,...smithAt(s)));await wait_ms(300);await shot('smith-survey');
  // 3. Take its badge while it writes: it flies off its lanyard to you.
  await walkTo(qa,...smithAt(s),{near:64});
  // (Space by hand here, to catch the badge in flight.)
  for(let i=0;i<120&&(s=await read()).world.prompt!=='SPACE - take its badge';i++){if(dist(here(s),smithAt(s))>4)await face(angleTo(s.world,...smithAt(s)));await wait_ms(80);}
  await qa.page.keyboard.down('Space');await wait_ms(70);await qa.page.keyboard.up('Space');await wait_ms(170);await shot('badge-flying');
  s=await wait(s=>s.agentic.badge===1,'Badge taken',3000);
  assert.equal(s.agentic.smith_mode,5,'still surveying');
  const pos0=smithAt(s);
  // 4. Swipe it at the reader (the sign hangs small under the ceiling over it).
  await walkTo(qa,READER[0],READER[1]-110,{near:10});await face(90);await wait_ms(200);await shot('reader-red');
  await walkTo(qa,READER[0],READER[1]-46,{near:10});await face(90);
  await wait(s=>s.world.prompt==='SPACE - swipe the badge','Swipe prompt',3000);
  await shot('reader-close');
  await press('Space');
  s=await wait(s=>s.agentic.swiped===1&&(s.agentic.freed&8),'Swipe releases Katja',3000);
  s=await wait(s=>s.agentic.stones_up===1,'Stones rise',4000);
  detail.smithStill=dist(pos0,smithAt(s));assert.ok(detail.smithStill<2,'SMITH never moved during the survey');
  await hold('KeyS',300);await face(90);await wait_ms(250);await shot('reader-green');
  // 5. She walks over the stones (never moved by the test): no teleports, dry feet, nobody takes her over.
  await face(80);
  const cross=await watchCrossing(qa,{shot});s=cross.s;
  Object.assign(detail,{trail:cross.trail,maxSpeed:cross.maxSpeed,minZOverPool:cross.minZOverPool,possessedOnWay:cross.possessedOnWay});
  assert.ok(cross.reached,`Katja reached the shore ${katjaAt(s)}`);
  assert.ok(cross.maxSpeed<=6,`Katja walked (fastest ${cross.maxSpeed} u/tic)`);
  assert.ok(cross.minZOverPool>=60,`over the pool only on raised stones (min z ${cross.minZOverPool})`);
  assert.ok(cross.trail.some(p=>p[1]>1300),'she crossed from the island');
  assert.equal(cross.possessedOnWay,null,'not possessed on the stones');
  for(let i=0;i<60&&!(await voices()).some(v=>/^katja-freed/.test(v));i++)await wait_ms(200);
  detail.freedVoice=(await voices()).find(v=>/^katja-freed/.test(v));
  assert.ok(detail.freedVoice,'katja-freed line on arrival');
  s=await read();await face(angleTo(s.world,...katjaAt(s)));await wait_ms(200);await shot('katja-on-shore');
  // 6. The survey ends after its 20 s: SMITH notices, the hunt resumes; one badge line, not two.
  s=await wait(s=>s.agentic.smith_mode!==5,'Survey ends',30000);
  const span=await surveySpan(detail.handedAt);assert.ok(span,'survey start and end recorded');detail.surveyTics=span.tics;
  assert.ok(detail.surveyTics>=686&&detail.surveyTics<=714,`survey lasted ${detail.surveyTics} tics`);
  assert.equal(s.agentic.smith_busy,0);assert.equal(s.agentic.surveying,0);
  assert.equal(s.agentic.todo,'1. COMPLETE SURVEY ✓|2. FIND BADGE');
  for(let i=0;i<60&&!(await voices()).includes('smith-survey-done');i++)await wait_ms(200);
  await wait_ms(8000);
  const v=await voices();detail.poss=await poss();
  for(const key of ['katja-hint','smith-survey','katja-badge','smith-survey-done'])assert.ok(v.includes(key),`${key} line`);
  assert.ok(!v.includes('smith-release-katja'),'no second badge line after survey-done');
 });

 await session('reader',async(qa)=>{
  const {read,wait,press,face,command,shot,detail,messages}=qa;
  await command('god');
  // Walk up to the reader without the badge (out of her earshot): it answers on its own...
  await walkTo(qa,READER[0],READER[1]-46,{near:10});await face(90);
  for(let i=0;i<30&&!(await messages()).includes('AGENTS ONLY');i++)await wait_ms(100);
  detail.messages=await messages();assert.ok(detail.messages.includes('AGENTS ONLY'),'Reader says AGENTS ONLY on approach');
  let s=await read();assert.equal(s.world.prompt,'','no SPACE prompt without the badge');
  await shot('reader-agents-only');
  // ...and to SPACE.
  s=await wait(s=>s.world.message!=='AGENTS ONLY','Status clears',6000);
  await press('Space');s=await wait(s=>s.world.message==='AGENTS ONLY','Reader says AGENTS ONLY to SPACE',2000);
  await wait_ms(1500);s=await read();
  assert.equal(s.agentic.stones_up,0);assert.equal(s.agentic.freed&8,0);assert.equal(s.agentic.badge,0);assert.equal(s.agentic.swiped,0);
 });

 await session('stun',async(qa)=>{
  const {read,wait,press,hold,face,command,shot,detail}=qa;
  await command('god');
  await hearKatja(qa);await takeSurvey(qa);
  let s=await awaitSmith(qa,80);
  // A wrench stun (real swing) gives no badge and no survey hand-over.
  s=await read();await face(angleTo(s.world,...smithAt(s)));await hold('ControlLeft',120);
  s=await wait(s=>s.agentic.smith_mode===4,'Wrench stun',3000);detail.stunAt=s.world.ticks;
  const prompts=new Set();
  for(let i=0;i<14;i++){
   s=await read();if(s.agentic.smith_mode!==4)break;prompts.add(s.world.prompt);
   if(dist(here(s),smithAt(s))>4)await face(angleTo(s.world,...smithAt(s)));
   if(i===4){await shot('stunned');await press('Space');}
   await wait_ms(120);
  }
  detail.prompts=[...prompts];
  assert.ok(!prompts.has('SPACE - take its badge'),'no badge prompt on a stunned SMITH');
  assert.ok(!prompts.has('SPACE - hand it the survey'),'no hand-over while stunned');
  s=await read();assert.equal(s.agentic.badge,0,'stun gives no badge');assert.equal(s.agentic.survey,1,'still holding the survey');
  assert.notEqual(s.agentic.smith_mode,5);
  // Once it recovers, the survey still works.
  await wait(s=>s.agentic.smith_mode!==4,'Stun wears off',8000);
  await promptAtSmith(qa,'SPACE - hand it the survey',15000);
  await wait(s=>s.agentic.smith_mode===5,'Survey after the stun',3000);
 });

 // No badge taken: when the survey ends Katja tosses another clipboard onto the shore (never into the
 // pool, never under SMITH's feet), and it can be handed over again.
 await session('retry',async(qa)=>{
  const {read,wait,face,command,shot,detail,voices}=qa;
  await command('god');
  await hearKatja(qa);await takeSurvey(qa);await awaitSmith(qa);
  await promptAtSmith(qa,'SPACE - hand it the survey');
  let s=await wait(s=>s.agentic.smith_mode===5,'Survey starts',3000);const t0=s.world.ticks;
  // Watch the count climb, then let it finish without taking the badge.
  const qs=[];
  while(true){s=await read();if(s.agentic.smith_mode!==5)break;qs.push(s.agentic.survey_q);await wait_ms(1000);}
  detail.questions=qs;detail.tics=s.world.ticks-t0;
  assert.ok(qs.length>5&&qs.every((q,i)=>!i||q>=qs[i-1])&&qs[qs.length-1]>2000,'Q counts up toward 2,778');
  assert.equal(s.agentic.todo,'1. COMPLETE SURVEY ✓|2. CATCH USER');
  s=await wait(s=>s.agentic.tosses===2,'Katja tosses another',2000);
  s=await wait(s=>s.agentic.clipboard===2,'Second clipboard lands',4000);
  detail.dropped=clipAt(s);detail.smithThen=smithAt(s);detail.clearOfSmith=Math.round(dist(detail.dropped,smithAt(s)));
  assert.ok(onShore(s),`second clipboard on her shore ${detail.dropped}`);assert.ok(detail.clearOfSmith>=60,`not under SMITH (${detail.clearOfSmith} u)`);
  assert.equal(s.agentic.badge,0);assert.ok(!(await voices()).includes('smith-survey-done'),'no badge line without the badge taken');
  await walkTo(qa,detail.dropped[0],detail.dropped[1]-56,{near:14});s=await read();await face(angleTo(s.world,...detail.dropped));
  await qa.hold('PageDown',200);await wait_ms(100);await shot('retry-retossed');await qa.hold('PageUp',200);
  await takeSurvey(qa);
  await promptAtSmith(qa,'SPACE - hand it the survey',20000);
  await wait(s=>s.agentic.smith_mode===5,'Second survey',3000);
 });
 // Freed some other way (QA here; the hub walk-in and ?puzzle=exit use the same Free): no toss, no reader
 // prompt, the reader goes green, the stones rise and she still walks over by herself, untouched by SMITH.
 await session('qa-free',async(qa)=>{
  const {read,wait,press,face,command,detail}=qa;
  await command('god');await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 3 1');
  let s=await wait(s=>(s.agentic.freed&8)&&s.agentic.reader_green===1,'Freed by QA',3000);
  s=await wait(s=>s.agentic.stones_up===1,'Stones rise',4000);
  // Watch her crossing first: she reaches her SiteExit about 7 s after the release, and on the full pk3
  // SMITH (out of C6) stands between you and the reader, so the walk below can outlast her crossing.
  const cross=await watchCrossing(qa);detail.possessedOnWay=cross.possessedOnWay;detail.trail=cross.trail;
  assert.ok(cross.reached,'she walks out over the raised stones');
  assert.ok(cross.minZOverPool>=60,`dry feet (min z ${cross.minZOverPool})`);
  assert.equal(cross.possessedOnWay,null,'not possessed on the stones');
  await walkTo(qa,1760,1132,{near:10});await face(90);await wait_ms(1500);s=await read();
  assert.equal(s.agentic.tosses,0,'no toss once she is free');assert.equal(s.agentic.clipboard,0);assert.equal(s.agentic.katja_hint,1,'(her hint is spent)');
  await walkTo(qa,READER[0],READER[1]-46,{near:10});await face(90);await wait_ms(400);s=await read();
  assert.equal(s.world.prompt,'');assert.notEqual(s.world.message,'AGENTS ONLY');
  await press('Space');s=await read();assert.notEqual(s.world.message,'AGENTS ONLY');assert.equal(s.agentic.swiped,0);
 });

 // Killed by SMITH while holding the survey: the dead view turns to SMITH, but the hidden hand-over
 // prompt must not swallow SPACE (Doom's respawn).
 await session('death-smith',async(qa)=>{
  const {read,wait,face,command,shot,detail,prompts,page}=qa;
  await command('god');
  await hearKatja(qa);await takeSurvey(qa);await awaitSmith(qa);
  await command('god');
  let s;const t=Date.now();
  while(Date.now()-t<40000){s=await read();if(s.world.health<=0)break;if(dist(here(s),smithAt(s))>4)await face(angleTo(s.world,...smithAt(s)));await wait_ms(150);}
  detail.promptsAlive=await prompts();
  assert.ok(detail.promptsAlive.includes('SPACE - hand it the survey'),'the hand-over prompt was live before dying');
  Object.assign(detail,await respawnWithSpace({read,page,shot},'death-smith-dead'));
  assert.equal(detail.surveyAfter,0,'a fresh attempt');
 });
 // Killed at the reader with the badge in hand, facing it (swipe prompt live).
 await session('death-reader',async(qa)=>{
  const {read,wait,face,command,shot,detail,page}=qa;
  await command('god');
  await surveyAndBadge(qa);
  await walkTo(qa,READER[0],READER[1]-46,{near:10});await face(90);
  await wait(s=>s.world.prompt==='SPACE - swipe the badge','Swipe prompt',3000);
  await command('god');await command('kill');
  await wait(s=>s.world.health<=0,'dead',5000);
  Object.assign(detail,await respawnWithSpace({read,page,shot},'death-reader-dead'));
  assert.equal(detail.badgeAfter,0,'a fresh attempt');
 });

 // Badge taken, swiped only after the survey ran out: SMITH hunts you at the reader while she crosses.
 // Nobody takes her over on the stones; later, STOP GENERATING on her is not undone the same tic.
 await session('late-swipe',async(qa)=>{
  const {read,wait,face,command,shot,detail,poss,press}=qa;
  await command('god');
  await surveyAndBadge(qa);
  let s=await wait(s=>s.agentic.smith_mode!==5,'Survey ends',30000);
  detail.todo=s.agentic.todo;assert.equal(s.agentic.todo,'1. COMPLETE SURVEY ✓|2. FIND BADGE');
  await swipe(qa);s=await read();detail.smithAtSwipe=Math.round(dist(here(s),smithAt(s)));
  await face(80);
  const cross=await watchCrossing(qa,{shot:n=>shot('late-swipe-on-stones')});
  Object.assign(detail,{trail:cross.trail,possessedOnWay:cross.possessedOnWay});
  assert.ok(cross.reached,'she reached the shore');
  assert.equal(cross.possessedOnWay,null,'not possessed on the stones');
  detail.poss=await poss();
 });

 // Katja as a follower (Jaan freed and introduced first): she reaches you while SMITH writes, and the
 // survey's end does not turn her release into a possession. When SMITH does take her later, STOP
 // GENERATING frees her and she stays free.
 await session('follower',async(qa)=>{
  const {read,wait,face,command,shot,detail,poss,press,warp,surveySpan}=qa;
  await command('god');await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 0 0');
  let s=await wait(s=>s.agentic.introduced===1,'Jaan introduced in the refuge',8000);
  await warp(SPOT[0],SPOT[1],90);await wait_ms(500);
  const t0=await surveyAndBadge(qa);await swipe(qa);
  s=await wait(s=>s.agentic.stones_up===1,'Stones rise',4000);
  const cross=await watchCrossing(qa);detail.possessedOnWay=cross.possessedOnWay;
  assert.ok(cross.reached,'she reached the shore');assert.equal(cross.possessedOnWay,null,'not possessed on the stones');
  // Stay by the reader like a player waiting for her (she comes to you).
  s=await wait(s=>s.agentic.smith_mode!==5,'Survey ends',30000);const span=await surveySpan(t0),tEnd=span?.end??s.world.ticks;
  detail.surveyTics=span?.tics;detail.katjaAtEnd=katjaAt(s).map(Math.round);detail.youAtEnd=here(s).map(Math.round);detail.smithAtEnd=smithAt(s).map(Math.round);
  detail.katjaToYou=Math.round(dist(katjaAt(s),here(s)));
  let first=null;
  for(let i=0;i<100;i++){s=await read();if(s.agentic.possessed&8){first=s.world.ticks-tEnd;break;}if(s.world.ticks-tEnd>520)break;await wait_ms(100);}
  detail.possessedAfterTics=first;
  assert.ok(first===null||first>=270,`no possession for 8 s after the survey (${first} tics)`);
  if(first===null){s=await wait(s=>s.agentic.possessed&8,'SMITH takes her over in the end (near you)',20000);detail.possessedAfterTics=s.world.ticks-tEnd;}
  s=await read();await face(angleTo(s.world,...katjaAt(s)));await wait_ms(200);await shot('follower-possessed');
  // STOP GENERATING (real Space facing her); she must stay free, not be re-possessed the same tic.
  await walkTo(qa,...katjaAt(s),{near:60,timeout:15000});
  const end=Date.now()+8000;let stopped=false;
  while(Date.now()<end){s=await read();if(s.world.prompt==='SPACE - stop generating'){await press('Space');stopped=true;break;}await face(angleTo(s.world,...katjaAt(s)));await wait_ms(80);}
  assert.ok(stopped,'STOP GENERATING prompt on her');
  s=await wait(s=>!(s.agentic.possessed&8),'Unpossessed',2000);const tFree=s.world.ticks;
  for(let i=0;i<25;i++){s=await read();assert.equal(s.agentic.possessed&8,0,`re-possessed ${s.world.ticks-tFree} tics after STOP GENERATING`);await wait_ms(200);}
  detail.freeFor=s.world.ticks-tFree;detail.poss=await poss();
 },{puzzle:'refuge'});

 // The survey is no 20 s SMITH pause to carry round the level: no hand-over outside her rooms (here on
 // Tallinn's straight route under C2), and walking out of her rooms makes SMITH submit at once.
 await session('carry',async(qa)=>{
  const {read,wait,face,command,shot,detail,press,warp,prompts}=qa;
  await command('god');
  await hearKatja(qa);await takeSurvey(qa);
  await warp(650,890,6);
  let s=await wait(s=>s.agentic.smith_mode===1&&dist(here(s),smithAt(s))<110,'SMITH comes via C2',30000);
  detail.summoned={camera:s.agentic.spot_camera,smith:smithAt(s).map(Math.round)};
  assert.equal(s.agentic.in_waiting_room,0);
  const seen=new Set();const end=Date.now()+5000;
  while(Date.now()<end){s=await read();seen.add(s.world.prompt);if(dist(here(s),smithAt(s))>4)await face(angleTo(s.world,...smithAt(s)));await wait_ms(100);}
  detail.promptsAway=[...seen];await shot('carry-no-handover');
  assert.ok(!seen.has('SPACE - hand it the survey'),'no hand-over prompt away from her rooms');
  await press('Space');s=await read();assert.equal(s.agentic.survey,1,'still holding it');assert.notEqual(s.agentic.smith_mode,5,'no survey here');
  // Back in her room it works; walking out (real steps south through step 78) ends it.
  await warp(ROOM[0],ROOM[1],90);
  s=await awaitSmith(qa,100,40000);
  await promptAtSmith(qa,'SPACE - hand it the survey');
  s=await wait(s=>s.agentic.smith_mode===5,'Survey in her room',3000);const t0=s.world.ticks;
  await walkTo(qa,1720,990,{near:16});await walkTo(qa,1720,930,{near:16});
  s=await read();assert.equal(s.agentic.smith_mode,5,'still writing while you are on her step');
  await walkTo(qa,1720,860,{near:16});
  s=await wait(s=>s.agentic.in_waiting_room===0,'Out of her rooms',3000);const tOut=s.world.ticks;
  s=await wait(s=>s.agentic.smith_mode!==5,'SMITH submits as you leave',2000);
  detail.endedAfterLeaving=s.world.ticks-tOut;detail.surveyTics=s.world.ticks-t0;
  assert.ok(detail.endedAfterLeaving<=14,`ended ${detail.endedAfterLeaving} tics after leaving`);
  s=await wait(s=>s.agentic.tosses===2&&s.agentic.clipboard===2,'She tosses another onto the shore',5000);
  detail.retossed=clipAt(s);
  assert.ok(onShore(s),'the new clipboard is on her shore, not by SMITH');
 });

 // Hint and toss need her in sight from her own rooms: not from SMITH's cross hall or the east stairs
 // behind the pool's walls, though both are inside her 384 u earshot.
 await session('earshot',async(qa)=>{
  const {read,wait,face,command,shot,detail,warp}=qa;
  await command('god');
  await warp(1376,1712,0);let s=await read();
  for(let x=1420;x<=1680;x+=40){
   await walkTo(qa,x,1712,{near:16});s=await read();
   assert.equal(s.agentic.tossed,0,`no toss in the cross hall at ${here(s).map(Math.round)} (${Math.round(dist(here(s),ISLAND))} u)`);
  }
  detail.crossHallClosest=Math.round(dist(here(s),ISLAND));
  await warp(1904,1720,270);
  for(let y=1690;y>=1540;y-=30){
   await walkTo(qa,1888,y,{near:16});s=await read();
   assert.equal(s.agentic.tossed,0,`no toss on the east stairs at ${here(s).map(Math.round)} (${Math.round(dist(here(s),ISLAND))} u)`);
  }
  detail.stairsClosest=Math.round(dist(here(s),ISLAND));
  await wait_ms(1500);s=await read();assert.equal(s.agentic.tossed,0);assert.equal(s.agentic.katja_hint,0);
  // In her room, in view: she throws it.
  await warp(SPOT[0],SPOT[1],90);
  const heard=await hearKatja(qa,null);detail.tossAt=here(heard.s).map(Math.round);
 });

 // While the guide is leading, the clipboard still comes (it is the only way in), but her line waits
 // until the guide is introduced and she sees you again.
 await session('guide',async(qa)=>{
  const {read,wait,face,command,shot,detail,warp,voices}=qa;
  await command('god');await command('pdoom_development 1');await command('netevent pdoom_agentic_qa_out 0 1');
  let s=await wait(s=>s.agentic.guide===0&&s.agentic.introduced===0,'Jaan freed in his booth, leading',3000);
  await hearKatja(qa,null,{line:false});
  await wait_ms(2500);assert.ok(!(await voices()).includes('katja-hint'),'no hint while the guide leads');
  await takeSurvey(qa);
  // The guide is introduced: Jaan to his refuge slot by the core's QA fixture (C6 has brought SMITH, who
  // may have possessed him here), and the player into the refuge.
  await command('netevent pdoom_agentic_qa_out 0 0');
  await warp(-296,-96,0);
  s=await wait(s=>s.agentic.introduced===1,'Jaan introduced in the refuge',10000);
  await wait_ms(1000);
  await warp(1760,1140,90);
  s=await wait(s=>s.agentic.katja_hint===1,'Her line now',6000);
  for(let i=0;i<40&&!(await voices()).includes('katja-hint');i++)await wait_ms(150);
  assert.ok((await voices()).includes('katja-hint'),'katja-hint once the guide is introduced');
  assert.equal(s.agentic.tosses,1,'no second toss');
 });
 report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);
}catch(e){report.passed=false;report.failure=String(e.stack||e);console.error(report.failure);}
finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
console.log(report.passed?'agentic grace smoke passed':'agentic grace smoke FAILED',`${report.cases.filter(c=>c.passed).length}/${report.cases.length}`);
process.exit(report.passed?0:1);
