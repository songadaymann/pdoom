import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {gauntletMeta,gauntletQA} from './gauntlet-qa.mjs';
const out='output/prologue/timed';await fs.mkdir(out,{recursive:true});const b=await chromium.launch({channel:'chrome',args:['--mute-audio']});const p=await b.newPage({viewport:{width:1280,height:800}});const report={errors:[]};p.on('pageerror',e=>report.errors.push(String(e)));await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});const q=nativeQA(p);
try{
 await p.goto('http://127.0.0.1:5198/?prologue=1');await startGame(p);await q.wait(s=>s.prologue?.clock>35&&!s.uiBlocked,'Ready',60000);await q.command('god');
 // Route: dormant squads in every set piece, no reinforcements early in a sector, the exit sealed.
 const meta=await gauntletMeta(),g=gauntletQA(p,q,meta);
 report.route=(await q.read()).prologue;assert.equal(report.route.stage,'route');assert.equal(report.route.section,1);
 assert.equal(report.route.robots.length,meta.squads.reduce((n,s)=>n+s.positions.length,0),'Every section squad is placed');
 assert.ok(!report.route.robots.some(r=>r.kind==='PDWarEnforcer'&&meta.squads.find(s=>s.id===r.squad)?.section<2),'No enforcer in the opening sections');
 await q.wait(s=>s.prologue?.clock>1400,'Quiet opening',90000);assert.equal((await q.read()).prologue.reinforcements,0);
 // Stragglers are queued for a sector we linger in (45 s), placed out of sight where pads allow.
 await q.wait(s=>s.prologue.wave>0,'Route trickle queued after 45 s',60000);report.trickle=(await q.read()).prologue;assert.ok(report.trickle.section_clock>=1575);assert.equal(report.trickle.stage,'route');
 // Through every set piece and airlock (console kill stands in for fighting through).
 await g.toFinale();await g.stepOut();await p.waitForTimeout(4000);
 report.escalation=(await q.read()).prologue;assert.ok(report.escalation.yard_spawned>=25);for(const k of ['PDWarEnforcer','PDWarGunship','PDWarSquid','PDWarTrooper'])assert.ok(report.escalation.robots.some(r=>r.kind===k),k);assert.ok(report.escalation.robots.length<=report.escalation.live_budget);await p.screenshot({path:out+'/escalation.png'});
 await q.wait(s=>s.prologue.yard_spawned>report.escalation.yard_spawned,'Waves keep coming in the finale',30000);report.endless=(await q.read()).prologue;assert.equal(report.endless.phase,'battle');assert.equal(report.endless.forced_end,0);assert.equal((await q.read()).run.runId,null);await p.screenshot({path:out+'/beyond-old-ending.png'});
 // Remove only the fixture's protection. Real robot attacks must end combat;
 // no kill command, damage injection, timer or scripted capture is used.
 await q.command('god');await q.wait(s=>s.prologue?.phase==='captured','Real robots overwhelm player',40000);report.captured=(await q.read()).prologue;assert.match(report.captured.defeated_by,/PDWar/);assert.equal(report.captured.stage,'yard');await p.waitForTimeout(1700);await p.screenshot({path:out+'/last-battle-lost.png'});
 await q.wait(s=>s.outside?.intro&&s.outside.guide&&!s.uiBlocked,'Defeat wakes in Bliss',60000);assert.equal((await q.read()).run.runId,null);await p.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(-45,-125,Math.PI,0));await q.wait(s=>s.outside.guide.speaking==='greet','Greeting',20000);await p.screenshot({path:out+'/bliss-wake.png'});await p.click('.guide-skip');await p.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(17,-3,Math.PI,0));await q.wait(s=>s.outside.nearestDoor==='five-prisons','First entrance');await q.press('e');await q.wait(s=>s.world?.map==='E1M4'&&s.world.ticks>35&&!s.uiBlocked,'First entry after defeat',60000);await p.waitForTimeout(800);report.wake=(await q.read()).world;assert.equal(report.wake.health,100);assert.equal(report.wake.gun,0);assert.equal(report.wake.freed,0);assert.equal((await q.read()).campaign.lost,0);await p.screenshot({path:out+'/wake.png'});assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=String(e).slice(0,700);report.state=await q.read().catch(()=>null);report.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs.filter(l=>!/PDOOM_ENVIRONMENT|PDOOM_PROLOGUE/.test(l)).slice(-30)).catch(()=>null);await p.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,error:report.error,yard:report.escalation?.yard_spawned,captured:report.captured?.clock}));await b.close();}
