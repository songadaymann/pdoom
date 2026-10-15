// Walks the whole Last Stand gauntlet natively: each section's arrival (with a look
// around, for checking the cuts), its seal, the airlock crossing (the screenshots just
// before and just after the silent move must match) and the finale's swarm.
//   node scripts/gauntlet-walk.mjs [outDir]
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {gauntletMeta,gauntletQA} from './gauntlet-qa.mjs';
const out=process.argv[2]||'output/prologue/gauntlet-walk';await fs.mkdir(out,{recursive:true});
const meta=await gauntletMeta();
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']});const p=await b.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[],sections:[]};p.on('pageerror',e=>report.errors.push(String(e)));
await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const q=nativeQA(p),g=gauntletQA(p,q,meta);
const n=k=>String(k+1).padStart(2,'0');
const shot=async name=>{await p.screenshot({path:`${out}/${name}.png`});};
const engineErrors=()=>p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue|Tried to/.test(l)));
async function lookAround(name){const a=(await q.read()).world.angle;for(const turn of [0,90,180,270]){await q.face((a+turn)%360);await p.waitForTimeout(150);await shot(`${name}-look${turn}`);}await q.face(a);}
try{
 await p.goto('http://127.0.0.1:5198/?prologue=1');await startGame(p);
 await q.wait(s=>s.prologue?.clock>35&&!s.uiBlocked,'Combat starts',90000);
 let s=await q.read();assert.equal(s.prologue.section,1);assert.equal(s.prologue.sections,meta.sections.length);
 assert.ok(Math.hypot(s.world.x-meta.spawn[0],s.world.y-meta.spawn[1])<40,'Starts at the first section spawn');
 await shot('01-start');report.cases.push(`Starts in section 1 of ${meta.sections.length}: ${s.prologue.section_name}`);
 // The opening room is for getting your bearings: nothing wakes or fires on its own.
 await p.waitForTimeout(4000);s=await q.read();assert.equal(s.prologue.rooms_revealed,0,'Opening squads stay dormant');assert.equal(s.world.health,100,'No damage while getting bearings');
 report.cases.push(`Opening room stays quiet for the first seconds (${meta.sections[0].robots} dormant machines)`);
 await q.command('god');await lookAround('01-start');
 // Armor in the opening room fills the status bar's armor gauge (key boxes).
 const armor=meta.items.find(i=>i.section===0&&i.type==='greenarmor');
 if(armor){
  await q.warp(armor.x,armor.y);await q.hold('s',150);await q.hold('w',300);
  await q.wait(s=>s.prologue.armor>=100,'Green armor picked up',5000);await p.waitForTimeout(300);
  const bar=await p.evaluate(()=>window.__DOOM_DEBUG__?.statusBar?.getState?.()??null).catch(()=>null);
  s=await q.read();report.armor={armor:s.prologue.armor,save:s.prologue.armor_save,pips:s.statusBar?.values?.armorPips??bar?.values?.armorPips??null};
  await shot('01-armor');report.cases.push(`Green armor: ${s.prologue.armor}% (save ${s.prologue.armor_save}%)`);
 }
 for(let k=0;k<meta.sections.length-1;k++){
  s=await q.read();assert.equal(s.prologue.section,k+1);
  const entry={section:k+1,name:s.prologue.section_name,robots:meta.sections[k].robots,live:s.prologue.robots.length};
  // In mid-battle rooms the soldiers may have won the room already.
  if(meta.sections[k].robots>0&&s.prologue.secured===1)entry.securedBySoldiers=true;
  else if(meta.sections[k].robots>0){
   assert.equal(s.prologue.secured,0,'Sealed while the squad stands');
   await g.faceExit(k);await p.waitForTimeout(400);entry.sealedPrompt=(await q.read()).prologue.prompt;await shot(`${n(k)}-sealed`);
   assert.match(entry.sealedPrompt,/SEALED/,'Sealed exit explains itself');
  }
  await g.clearSection(k);entry.secured=true;
  if(k===0){
   // Step into the exit airlock, then back out while its door shuts: it must open again.
   await q.wait(s=>s.prologue.exit_gap>=56,'Exit door opens',8000);
   const x=g.exitLock(0);await g.faceExit(0);await q.warp(x.center[0],x.center[1]);
   await q.wait(s=>s.prologue.transit===1||s.prologue.section===2,'Door starts shutting',4000);
   if((await q.read()).prologue.section===1){await g.faceExit(0);await q.wait(s=>s.prologue.transit===0&&s.prologue.exit_gap>=56,'Backing out reopens the exit door',8000);report.cases.push('Backing out of the exit airlock reopens its door');}
  }
  await g.cross(k,{before:()=>shot(`${n(k)}-airlock-before`),after:()=>shot(`${n(k+1)}-airlock-after`)});
  // The door ahead opens; walk out and look around the new section.
  await q.wait(s=>s.prologue.transit===2,'Arrived',3000);await p.waitForTimeout(1000);
  await q.hold('w',700);s=await q.read();entry.arrival={x:s.world.x,y:s.world.y,here:s.prologue.here,stage:s.prologue.stage};
  if(k===0){
   // Retreat into the entrance airlock once out: the door behind must not seal us in.
   const y=g.entranceLock(0);await q.wait(s=>s.prologue.arrive>=2,'Clear of the entrance airlock',4000);
   await q.warp(y.center[0],y.center[1]);await q.wait(s=>s.prologue.arrive===1&&s.prologue.behind_gap>=56,'Retreating reopens the door behind',8000);
   const rad=y.facing*Math.PI/180;await q.warp(Math.round(y.center[0]+Math.cos(rad)*260),Math.round(y.center[1]+Math.sin(rad)*260));
   await q.wait(s=>s.prologue.arrive===3&&s.prologue.behind_gap===0,'Door shuts behind once clear',8000);
   report.cases.push('Retreating into the entrance airlock reopens it; it shuts again once clear');
  }
  await shot(`${n(k+1)}-arrival`);if(k+1<meta.sections.length-1)await lookAround(`${n(k+1)}-arrival`);
  if(k===0){
   // From the second room, soldiers run up from behind and join the fight.
   s=await q.wait(s=>s.prologue.allies_sent>0,'A soldier joins us in room 2',25000);
   const y=g.entranceLock(0);
   // ...and runs out of the entrance airlock to us (its door opens for them).
   s=await q.wait(s=>s.prologue.ally_list.some(a=>Math.hypot(a.x-y.center[0],a.y-y.center[1])>200),'Soldier leaves the airlock',15000);
   const soldier=s.prologue.ally_list[0];report.allies={sent:s.prologue.allies_sent,alive:s.prologue.allies,soldier};
   await q.face(Math.atan2(soldier.y-s.world.y,soldier.x-s.world.x)*180/Math.PI);await shot('02-soldier');
   report.cases.push('Room 2: a soldier runs up from behind and joins the fight');
  }
  report.sections.push(entry);report.cases.push(`Section ${k+1} sealed, secured, airlock crossing to ${k+2} (${s.prologue.section_name})`);
 }
 // The founder we did not pick crosses into the last room with us.
 {const f=await q.read();assert.equal(f.prologue.founder,f.ceo==='amodei'?'PDWarFounderSam':'PDWarFounderDario','The other founder fights beside us');
  await shot('07-founder');report.cases.push(`Finale: ${f.prologue.founder} crosses with us`);}
 if((await q.read()).prologue.stage!=='yard')await g.stepOut();
 await p.waitForTimeout(5000);s=await q.read();
 report.finale={yard_spawned:s.prologue.yard_spawned,live:s.prologue.robots.length,kinds:[...new Set(s.prologue.robots.map(r=>r.kind))],pdoom:s.prologue.pdoom};
 assert.ok(s.prologue.yard_spawned>=20,'Finale barrage lands');await lookAround('99-finale');
 report.cases.push(`Finale: ${s.prologue.yard_spawned} machines in 5 s`);
 // Soldiers keep joining, and in this war they die; the founder does not.
 s=await q.wait(s=>s.prologue.ally_deaths>0,'Soldiers fall in the finale',40000);
 report.finale.allies={sent:s.prologue.allies_sent,dead:s.prologue.ally_deaths,alive:s.prologue.allies,founder:s.prologue.founder};
 assert.ok(s.prologue.founder,'Founder still standing');await shot('99-soldiers');
 {const f=(await q.read()).prologue.ally_list.find(a=>a.kind.startsWith('PDWarFounder'));if(f){await q.face(Math.atan2(f.y-s.world.y,f.x-s.world.x)*180/Math.PI);await shot('99-founder-fighting');}}
 report.cases.push(`Finale soldiers: ${s.prologue.allies_sent} joined, ${s.prologue.ally_deaths} killed; the founder stands`);
 report.engineErrors=await engineErrors();assert.deepEqual(report.engineErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.error=String(e).slice(0,900);report.state=await q.read().then(s=>({...s.prologue,robots:s.prologue?.robots?.length})).catch(()=>null);report.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs.filter(l=>!/PDOOM_ENVIRONMENT|PDOOM_PROLOGUE/.test(l)).slice(-40)).catch(()=>null);await shot('failure').catch(()=>{});console.error(String(e).slice(0,600));process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify({passed:report.passed,cases:report.cases,error:report.error}));}
