import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {gauntletMeta,gauntletQA} from './gauntlet-qa.mjs';
const out='output/prologue/native';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']});const p=await b.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};p.on('pageerror',e=>report.errors.push(String(e)));
await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const q=nativeQA(p);const shot=async name=>{await p.screenshot({path:`${out}/${name}.png`});await fs.writeFile(`${out}/${name}.json`,JSON.stringify(await q.read(),null,2));};
try{
 await p.goto('http://127.0.0.1:5198/?prologue=1');await startGame(p);
 await q.wait(s=>s.prologue?.clock>35&&!s.uiBlocked,'Combat starts',60000);
 let s=await q.read();assert.equal(s.world.map,'E1M2');assert.equal(s.world.weapon,'Shotgun');assert.equal(s.run.runId,null);assert.equal(s.campaign.saved,0);assert.equal(s.scoreView.available,false);await shot('battle');
 report.cases.push('Fresh New Game opts into historical fight, real shotgun inventory; no rescue run/score starts');
 await q.press('Escape');await p.waitForTimeout(400);const frozen=(await q.read()).prologue.clock;await p.waitForTimeout(1000);assert.equal((await q.read()).prologue.clock,frozen);await q.press('Escape');await q.wait(s=>s.prologue.clock>frozen,'Combat resumes');report.cases.push('Escape menu pauses battle clock and resumes');
 await q.press('2');await q.wait(s=>s.prologue.weapon==='Pistol','Native pistol selection');await q.press('t');await q.wait(s=>s.prologue.weapon==='Shotgun','T returns to shotgun');

 const ammo=(await q.read()).prologue.shells;await q.hold('Control',1600);assert.ok((await q.read()).prologue.shells<ammo-1,'Holding attack fires repeatedly');report.cases.push('Weapon switching and held native gun attack consume actual ammunition');
 // Use the first section's actual robots; positioning is private QA only, attacks
 // and hit/death behavior are native, without fixture damage or kill shortcuts.
 const meta=await gauntletMeta(),g=gauntletQA(p,q,meta);
 await q.command('god');await q.warp(meta.spawn[0],meta.spawn[1],meta.spawn[2]);
 for(let i=0;i<10&&(await q.read()).prologue.kills===0;i++){
  s=await q.read();const target=s.prologue.robots.filter(r=>meta.squads.find(sq=>sq.id===r.squad)?.section===0).sort((a,b)=>Math.hypot(a.x-s.world.x,a.y-s.world.y)-Math.hypot(b.x-s.world.x,b.y-s.world.y))[0];if(!target)break;
  await q.face(Math.atan2(target.y-s.world.y,target.x-s.world.x)*180/Math.PI);await q.hold('Control',1300);
 }
 assert.ok((await q.read()).prologue.kills>0,'Real shots kill a machine');await shot('robot-destroyed');report.cases.push('Native pellets reduce robot health and real death increments machine tally');
 await q.wait(s=>(s.prologue.rooms_revealed&1)!==0,'First squad notices player');await shot('first-squad');report.cases.push('The fight wakes the first section squad');
 {const r=(await q.read()).prologue;assert.equal(r.stage,'route');assert.equal(r.section,1);assert.equal(r.reinforcements,0,'No reinforcements early in the route');}
 await g.faceExit(0);await p.waitForTimeout(600);assert.match((await q.read()).prologue.prompt,/SEALED/,'Exit sealed while the squad stands');await shot('sealed-exit');
 report.cases.push('Route stage: no early reinforcements; the first exit is sealed while its squad stands');
 const gun=meta.items.find(i=>i.type==='chaingun');
 if(gun){
  if(gun.section>0){for(let k=0;k<gun.section;k++){await g.clearSection(k);await g.cross(k);}await p.waitForTimeout(1200);}
  // Warping onto a pickup does not touch it; a small step back and forth does.
  await q.warp(gun.x,gun.y);await q.hold('s',150);await q.hold('w',300);await q.press('4');await q.wait(s=>s.prologue.weapon==='Chaingun','Collect and select next weapon');await shot('second-weapon');report.cases.push(`Route pickup in section ${gun.section+1} equips native chaingun`);
 }
 // Kill respects prologue damage interception; it must advance the narrative,
 // with no game-over event or rescued/lost prisoner changes.
 await q.command('god');await q.command('kill');await q.wait(s=>s.prologue?.phase==='captured','Lethal damage captures');await p.waitForTimeout(1500);await shot('capture');assert.equal((await q.read()).scoreView.available,false);
 await q.wait(s=>s.outside?.intro&&s.outside.guide&&!s.uiBlocked,'Wake in Bliss',30000);
 s=await q.read();assert.equal(s.outside.guide.character,s.ceo==='amodei'?'samwise':'mario');assert.equal(s.run.runId,null);assert.equal(s.campaign.saved,0);assert.equal(s.campaign.lost,0);assert.equal(s.outside.saved_visual,0);assert.equal(s.prologue.phase,'bliss');await p.waitForTimeout(3000);await shot('bliss-wake');
 const warClock=s.prologue.clock;await q.press('Escape');await p.waitForTimeout(400);const walkClock=(await q.read()).outside.guide.clock;await p.waitForTimeout(1000);assert.equal((await q.read()).outside.guide.clock,walkClock);await q.press('Escape');
 // The founder waits up the slope; walking over starts the talk, then we follow him over the crest.
 await p.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(-45,-126,Math.PI,0));await q.wait(s=>s.outside.guide.speaking==='greet','Greeting on approach',20000);
 const lines=new Set(['greet']);const until=Date.now()+150000;
 const voiced=new Set();while(Date.now()<until){const g=(await q.read()).outside.guide;if(g.speaking){lines.add(g.speaking);if(g.voiced)voiced.add(g.speaking);}if(g.ready)break;
  await p.evaluate(({x,z})=>{const o=window.__DOOM_DEBUG__.outside,st=o.getState();const dx=x-st.x,dz=z-st.z,d=Math.hypot(dx,dz);if(d>4){const k=(d-3.5)/d;o.debug.setView(st.x+dx*k,st.z+dz*k,Math.atan2(-dx,-dz),0);}},{x:g.x,z:g.z});await p.waitForTimeout(400);}
 // Every beat this founder has. The shouts (call, call2, call3) only play while we have not walked over.
 const guideKeys=JSON.parse(await fs.readFile('src/doom-bliss-guide-lines.json','utf8'))[s.outside.guide.character].lines.map(l=>l.key).filter(k=>!/^call\d*$/.test(k));
 assert.deepEqual(guideKeys.filter(k=>!lines.has(k)),[],'Every line plays on the walk');
 // Lines with an imported recording must play it; the rest run on subtitles.
 const recorded=JSON.parse(await fs.readFile('doom-web/outside-assets/voice/guide-voices.json','utf8'))[s.outside.guide.character]||{};
 assert.deepEqual(guideKeys.filter(k=>recorded[k]&&k!=='greet'&&!voiced.has(k)),[],'Every recorded line is voiced from its recording');
 await q.wait(s=>s.outside.guide.ready,'Walk and exposition complete',30000);s=await q.read();assert.equal(s.prologue.clock,warClock);assert.equal(s.run.runId,null);await p.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(17,-3,Math.PI,0));await q.wait(s=>s.outside.nearestDoor==='five-prisons','Approach entrance');await shot('guide-at-door');
 report.cases.push('Wake in Bliss with opposite hero; guide walks, waits, subtitles and pause work; no rescue run or save starts');
 await q.press('e');await q.wait(s=>s.world?.map==='E1M4'&&s.world.ticks>35&&s.mode==='playing'&&!s.uiBlocked,'Enter first facility',20000);
 await p.waitForTimeout(800);s=await q.read();assert.equal(s.world.health,100);assert.equal(s.world.wrench,1,'The guide handed us his wrench');assert.equal(s.world.gun,0);assert.equal(s.world.ammo,0);assert.equal(s.world.freed,0);assert.equal(s.world.x,2032);assert.equal(s.intro.opened,0);assert.equal(s.campaign.saved,0);assert.equal(s.campaign.lost,0);assert.equal(s.prologue,null);assert.ok(s.run.runId);assert.equal(s.run.practiceReason,'');assert.ok(s.run.activeTics<140);assert.equal(s.outside,null);await shot('wake');
 report.cases.push('E at first portal starts clean scored first rescue holding the guide\'s wrench, no gun, no extra film');
 await q.face(180);await p.keyboard.down('KeyW');await p.waitForTimeout(700);assert.equal((await q.read()).world.prompt,'','No door prompt');await p.waitForTimeout(1800);await p.keyboard.up('KeyW');s=await q.read();assert.ok(s.world.x<1840,'Walked through the starting door at x='+s.world.x);await shot('through-start-door');report.cases.push('Starting door opens on walk-in after handoff, no prompt');
 report.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));assert.deepEqual(report.engineErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.error=String(e);report.state=await q.read().catch(()=>null);report.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs.slice(-15)).catch(()=>null);await shot('failure').catch(()=>{});console.error(String(e).slice(0,500));process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify({passed:report.passed,cases:report.cases,error:report.error}));}
