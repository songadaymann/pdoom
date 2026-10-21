import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {overPaint,besideBox} from './factory-production-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],report={cases:[],errors};const record=text=>{report.cases.push(text);console.log(text);};page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold,face}=nativeQA(page);
const shot=async name=>page.screenshot({path:`${out}/${name}.png`});
try{
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory');await startGame(page);
 await wait(s=>s.mode==='playing'&&s.factory,'Factory native boot',60000);
 report.fixtureLogs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>l.includes("FACTORY_PROP")));report.initial=await read();report.modBytes=(await fs.stat('doom-web/pdoom.pk3')).size;assert.equal(report.initial.world.map,'E2M7');
 assert.equal(report.initial.world.people[0].name,'Zvi Mowshowitz');
 assert.equal(report.initial.run,null);record('Native E2M7 boots with isolated prototype state');
 await shot('showroom');
 await press('Escape');assert.equal((await read()).gamePaused,true);
 const pausedTick=(await read()).world.ticks;await page.waitForTimeout(500);assert.equal((await read()).world.ticks,pausedTick);
 await press('Escape');await wait(s=>!s.gamePaused&&s.world.ticks>pausedTick,'Pause resumes native simulation');
 record('Escape pauses and resumes the native simulation');
 if(process.env.FACTORY_CASES!=='boot'){
  await command('god');
  await warp(1031,1690,90);await wait(s=>s.world.wrench,'Walk-over wrench');
  await warp(800,960,270);await shot('petition-empty');
  // Collect both worker signatures (they stand either side of the production stairs) before signing yourself.
  await warp(912,1000,90);await press('Space');await wait(s=>s.factory.signatures===1,'Early worker signature');
  await press('Space');assert.equal((await read()).factory.signatures,1);
  await warp(1248,1000,90);await press('Space');await wait(s=>s.factory.signatures===2,'Second early worker signature');
  await page.waitForFunction(()=>document.getElementById('people').textContent.includes('PAUSE LETTER 2/3'));
  await warp(800,960,270);await shot('petition-two-signatures');
  // Sign while the box crosses the paint: it rolls on to dry floor before it stops.
  await wait(s=>Math.abs(s.factory.box_x-864)<4&&s.factory.box_y>860&&s.factory.box_y<940,'Box crossing the paint',60000);
  await press('Space');await wait(s=>s.factory.line_paused,'Third signature stops line');
  await shot('petition-complete');
  const stopped=(await wait(s=>s.factory.box_stopped,'Box rolls clear of the paint',10000)).factory;
  assert.ok(!overPaint(stopped.box_x,stopped.box_y,24),`Box stopped clear of the paint (${stopped.box_x},${stopped.box_y})`);
  await page.waitForTimeout(1000);
  assert.equal((await read()).factory.box_x,stopped.box_x);assert.equal((await read()).factory.box_y,stopped.box_y);
  // The box shows you its door, so Max steps out toward you, on to dry floor.
  const stand=besideBox(stopped.box_x,stopped.box_y);await warp(stand.x,stand.y,stand.angle);await shot('shipping-box-stopped');await press('Space');
  const max=(await wait(s=>s.world.people[2].released,'Max box opens')).world.people[2];await shot('production-paused');
  assert.ok(!overPaint(max.x,max.y,10),`Max steps out on dry floor (${max.x},${max.y})`);
  assert.ok((max.x-stopped.box_x)*(stand.x-stopped.box_x)+(max.y-stopped.box_y)*(stand.y-stopped.box_y)>0,'Max steps out toward the player');
  record('Max: early signatures persist, repeats do not count, box rolls clear of the paint and stops, Max steps out toward you');
  // Max is the first one freed, so he leads you to the break room. While he leads, nobody
  // else calls out a hint; on arrival he introduces it, and hints resume.
  assert.equal((await read()).factory.guide,2,'Max leads');
  await warp(1376,1750,90);
  await wait(s=>s.factory.introduced,'Max arrives and introduces the break room',60000);
  assert.ok(!(await read()).dialogue?.voice?.endsWith('-hint'),'No hints while being led');
  record('First freed person leads you to the break room, no other hints on the way');
  // Music lure and timed vase event: look away for the entire dance.
  await warp(700,1936,270);await shot('music-player-off');await warp(700,1904,270);await press('Space');await wait(s=>s.factory.music,'CD player starts');
  await warp(700,1936,270);await shot('music-player-on');
  await face(270);await wait(s=>s.factory.vase_broken,'Walking guardian reaches mark and knocks vase while looking away',25000);
  await warp(784,1880,160);await shot('vase-key');
  await warp(700,1872,90);await press('Space');await wait(s=>s.factory.key,'Persistent pantry key');
  await warp(680,1904,90);await press('Space');await wait(s=>s.world.people[0].released,'Zvi pantry opens');
  record('Zvi: real walking lure, look-away dance, persistent key and pantry unlock');
  // Victoria (2026-10-18): the fabric faces open paint; the slingshot breaks it from the floor.
  await warp(576,780,90);await hold('KeyW',600);await wait(s=>s.world.gun===1,'Slingshot pickup');
  await warp(480,800,270);await shot('fabric-intact');await hold('ControlLeft',400);await wait(s=>s.factory.panel_hits===5,'First slingshot hit');await shot('fabric-torn');
  assert.equal((await read()).world.people[1].released,0);await hold('ControlLeft',400);
  await wait(s=>s.world.people[1].released,'Victoria fabric breach');assert.equal((await read()).factory.gate_closed,1);
  await page.waitForTimeout(600);await hold('KeyW',1500);assert.ok((await read()).world.y<656,'Player crosses the risen walkway into the pen');
  await shot('playpen-breach');record('Victoria: two slingshot hits across the paint, walkway rises, gate stays closed');
  await press('KeyT');assert.equal((await read()).world.tool,0,'T swaps back to the wrench');
  // E2M7's own wall switch lowers Paul's platform, but refuses until the guard is trained.
  await warp(1440,-340,270);await wait(s=>s.world.prompt==="SPACE - lower Paul's platform",'Wall switch prompt');
  await press('Space');await wait(s=>s.world.message==='Locked until the guard is trained.','Untrained switch refuses');
  assert.equal((await read()).world.people[3].released,0);
  // One console: the crosshair on its left half (green +) rewards, on its right half (red -) punishes.
  await wait(s=>!s.factory.guard_rated,'Unrated guard action',9000);
  await warp(1712,-290,180);await wait(s=>s.world.prompt?.startsWith('SPACE - reward'),'Left half of the console rewards');
  await warp(1712,-234,180);await wait(s=>s.world.prompt?.startsWith('SPACE - punish'),'Right half of the console punishes');
  await shot('training-controls');
  // Each positive applies to one stable trial, never to repeated button spam.
  await warp(1712,-262,180);
  for(let reward=0;reward<3;reward++){
   await wait(s=>s.factory.guard_action===2&&!s.factory.guard_rated,'Guard steps aside',18000);
   await press('Digit1');const trained=(await read()).factory.learned;
   if(reward===0){
    await wait(s=>s.world.message==='Rewarded for stepping aside.','Reward feedback');
    await page.waitForFunction(()=>document.getElementById('people').textContent.includes('GUARD: STEPPING ASIDE · REWARDED · TRAINED 1/3'));
    await shot('training-rewarded');
   }
   await press('Digit1');assert.equal((await read()).factory.learned,trained);
   if(reward<2)await wait(s=>s.factory.guard_action!==2,'New guard trial',8000);
  }
  await wait(s=>s.factory.trained,'Guard learned');await warp(1712,-262,180);await shot('training-complete');await shot('trained-guard');
  await warp(1712,-224,180);await hold('KeyW',2200);assert.ok((await read()).world.x<1540,'Trained guard physically clears passage');
  await warp(1440,-340,270);await press('Space');await wait(s=>s.world.people[3].released,'Paul platform lowers');
  record('Paul: wall switch refuses until trained, three deliberate rewards, spam rejected, switch lowers the platform');
  // Watched by the camera, all three dolls carry stools from the pile to the packing bin.
  await warp(3264,-150,270);const watched=(await read()).factory.dolls.map(d=>d.delivered);
  await wait(s=>s.factory.dolls.every((d,i)=>d.delivered>watched[i]),'All three dolls deliver stools while watched',40000);
  await wait(s=>s.dialogue?.speaker==='Ajeya Cotra'&&s.dialogue.text.includes('teddy camera'),'Ajeya follows up: break the camera',20000);
  await warp(3232,-250,270);await shot('camera-watching');await press('ControlLeft');await wait(s=>s.factory.camera_broken,'Break yard camera');await shot('camera-broken');
  // It crunches (2026-10-21): level 1's camera-break sound (PDCAMBRK, about 17,200 frames) reaches the page.
  await wait(s=>s.sound.recent.some(r=>r.frames>17000&&r.frames<17300),'The camera break sound plays',4000);
  await page.waitForTimeout(2500);await warp(3264,-150,270);await shot('dolls-unmonitored');
  // Unwatched: the helper keeps carrying; the approval-seeker and schemer drop their stools.
  let state=await read();const roleOf=r=>state.factory.dolls.find(d=>d.role===r);
  assert.ok(!roleOf(1).carrying&&!roleOf(2).carrying,'Approval-seeker and schemer drop their stools');
  // From the yard entrance the working lanes are out of reach, so Space takes the approval-seeker's key.
  const kept=roleOf(0).delivered;await warp(3264,-150,270);
  await wait(s=>{const b=s.factory.dolls.find(d=>d.role===1);return Math.hypot(b.x-s.world.x,b.y-s.world.y)<90;},'Approval-seeker hovers at your side');
  await press('Space');assert.equal((await read()).factory.good_key,0);
  await wait(s=>s.factory.dolls.find(d=>d.role===0).delivered>kept,'Helpful doll keeps delivering unwatched',30000);
  await wait(s=>s.factory.schemer_pressed,'Schemer walks to the alarm and presses it',30000);
  state=await read();const helpful=roleOf(0);
  await warp(helpful.x,helpful.y+40,270);await press('Space');await wait(s=>s.factory.good_key,'Helpful doll offers real key');
  await warp(3296,-288,270);await press('Space');await wait(s=>s.world.people[4].released,'Ajeya case opens');
  await hold('KeyW',800);assert.ok((await read()).world.y<-350,'Ajeya bars physically open');
  const alarms=(await read()).factory.alarm_count;
  await warp(3168,-330,270);await shot('alarm-idle');await press('Space');await wait(s=>s.factory.alarm_count>alarms,'Alarm activates');await shot('alarm-active');
  record('Ajeya: all three carry stools while watched; unwatched the helper keeps carrying, the others drop theirs, the schemer presses the alarm; wrong key recoverable, real key opens the case');
  await warp(1376,1750,90);
  await wait(s=>s.factory.all_safe&&s.world.sheltered===5,'All five physically walk back to the break room',150000);
  // The guide's recorded takes (2026-10-21): the way out, then the TV.
  {const g=['zvi','victoria','max','paul','ajeya'][(await read()).factory.guide];
   await wait(s=>['allsafe','tv'].every(k=>s.voiceOver?.played?.includes(`${g}-${k}`)),`${g}'s all-safe and TV takes play`,30000);}
  await warp(1344,1648,90);await shot('all-five-safe');record('All five reach the break room (walking at your pace, or catching up when far behind)');
  // The way out: MEG3N parks on the exit; the TV broadcasts MEG3N.AVI; she runs off to watch
  // herself; the arrows lead everyone to E2M7's own exit switch, which ends the level.
  await wait(s=>s.factory.all_safe&&s.factory.guardian_mode===5&&Math.hypot(s.factory.guardian_x-1056,s.factory.guardian_y+440)<40,'MEG3N parks on the exit',120000);
  await warp(1290,1840,90);await wait(s=>s.world.prompt==='SPACE - broadcast MEG3N.AVI','TV prompt');await press('Space');
  await wait(s=>s.factory.broadcast_remaining>0&&s.factory.evacuating,'Broadcast goes live');await shot('broadcast-live');
  await wait(s=>s.factory.guardian_mode===6&&Math.hypot(s.factory.guardian_x-2240,s.factory.guardian_y-772)<40,'MEG3N watches herself on the big screen',45000);
  await warp(2100,780,0);await face(15);await shot('meg3n-watching-herself');
  await warp(1056,-530,270);await wait(s=>s.world.prompt==='SPACE - leave the factory','Exit switch prompt');
  await wait(s=>s.world.people.every(p=>p.x>980&&p.x<1130&&p.y>-580&&p.y<-200),'Everyone reaches the exit',60000);
  await press('Space');await wait(s=>s.factory.exit_done,'Exit switch ends the level');
  // No campaign save here, so this is the playthrough's first exit: no text screen, straight
  // out of MEG3N.AVI's door into the meadow (scripts/factory-exit-smoke.mjs covers a later exit).
  await wait(s=>s.outside?.active&&s.outside.currentLevel==='meg3n-factory'&&s.melt.phase==='idle'&&!s.exitText.visible,'The exit melts into the meadow at MEG3N.AVI',30000);
  await wait(s=>s.outside.people.filter(p=>p.id>=10&&p.arrived).length===5&&s.outside.future.meg3n.strip==='saved,saved,saved,saved,saved','The five come out to their camp under five green lights',20000);
  await shot('meadow');record('Way out: MEG3N guards the exit, the broadcast sends her to watch herself, all five follow the arrows, the exit switch melts into the meadow at MEG3N.AVI');
 }
 assert.deepEqual(errors,[]);const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs);
 assert.deepEqual(logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown texture/.test(l)),[]);
 report.passed=true;report.final=await read();
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure?.slice(0,500)}));process.exit(report.passed?0:1);
