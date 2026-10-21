// MEG3N's factory in the campaign (2026-10-20): walked into from SAFE MODE through MEG3N.AVI's door
// and back out through E2M7's exit switch. Muted. A save with levels 1-2 cleared; QA frees people
// through a development-only netevent (Factory.zs pdoom_factory_qa_out), never by warping escorts home.
//  1. Enter: the front door (exit room), wrench in hand, the factory's own HUD.
//  2. Retreat with Zvi and Victoria while Paul is freed but still on his platform: two come out, Paul waits (following).
//  3. Re-enter: Zvi and Victoria are gone, Paul waits in the break room; bring out the other three:
//     the factory is finished, so the exit text types first; FREED 15/20.
//  4. An empty revisit: straight back out, no text.
//  5. CONTROL.EXE still loads level 1 with its own HUD.
// node scripts/factory-hub-smoke.mjs
import {chromium} from '@playwright/test';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/hub';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};const record=text=>{report.cases.push(text);console.log(text);};
page.on('pageerror',e=>report.errors.push(String(e)));
const controls=await fs.readFile('doom-web/controls.cfg','utf8');
await page.route('**/controls.cfg',r=>r.fulfill({contentType:'text/plain',body:controls+'\nbind ` "toggleconsole"\n'}));
await page.addInitScript(()=>{
 const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
 if(!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.setItem('pdoom.level-intros.v1',JSON.stringify(['five-prisons','hal-station','meg3n-factory']));localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0}));}
});
const {read,wait,command,face}=nativeQA(page);
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
const save=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')));
const hud=()=>page.evaluate(()=>({factory:document.getElementById('stage').classList.contains('factory-prototype'),checkpoint:document.getElementById('stage').classList.contains('checkpoint'),statusbar:!document.querySelector('#hud .doom-statusbar')?.hidden,line:document.getElementById('people').textContent}));
async function enterFactory(label){
 const yaw=-65*Math.PI/180;
 await page.evaluate(yaw=>window.__DOOM_DEBUG__.outside.debug.setView(-150.2-Math.sin(yaw)*3,2.5-Math.cos(yaw)*3,yaw+Math.PI,0),yaw);
 await page.waitForFunction(()=>document.getElementById('hub-enter')?.textContent.includes('Enter MEG3N.AVI'),null,{timeout:8000});
 await page.keyboard.press('Space',{delay:80});
 // Live ticks: the entrance is applied on the factory's first tick after the loading hold.
 const s=await wait(s=>s.mode==='playing'&&s.world?.level==='meg3n-factory'&&s.factory?.hub_entry===1&&!s.outside&&s.world.ticks>35,label,60000);
 await page.waitForTimeout(1500);return s;
}
async function free(i,{here=true}={}){await command(`netevent pdoom_factory_qa_out ${i} ${here?0:1}`);await wait(s=>s.world.people[i].released===1,`Free person ${i}`,5000);}
async function leave(prompt){
 await face(270);await wait(s=>s.world.prompt===prompt,`Exit switch: ${prompt}`,8000);
 await page.keyboard.press('Space',{delay:80});
 return wait(s=>s.factory.exit_done&&s.melt.phase!=='idle','The exit switch freezes the last frame',5000);
}
const meadow=label=>wait(s=>s.outside?.active&&s.outside.currentLevel==='meg3n-factory'&&s.melt.phase==='idle'&&!s.exitText.visible,label,30000);
try{
 await page.goto('http://127.0.0.1:5198/?play=1&load=1&ceo=altman');
 await wait(s=>s.outside?.active&&s.outside.saved_visual===10,'SAFE MODE with levels 1-2 cleared',90000);
 // 1. Through MEG3N.AVI's door.
 let s=await enterFactory('MEG3N.AVI walks into the factory');
 assert.ok(Math.hypot(s.world.x-1056,s.world.y+530)<24&&Math.abs(s.world.angle-90)<10,`At the front door looking in (${s.world.x},${s.world.y},${s.world.angle})`);
 assert.equal(s.world.wrench,1,'Wrench in hand');assert.equal(s.world.gun,0,'The slingshot stays in its level');
 assert.ok(s.world.people.every(p=>!p.released&&!p.camped),'All five still captive');
 let h=await hud();assert.ok(h.factory&&h.checkpoint&&h.statusbar,`Factory HUD with the status bar: ${JSON.stringify(h)}`);assert.match(h.line,/^(FIND THE FIVE|GUARD: )/,'Objective line (the guard is within earshot of the door)');
 assert.equal(s.campaign.saved,10);await shot('1-entrance');
 record('MEG3N.AVI opens from SAFE MODE: E2M7 front door, wrench in hand, factory HUD');
 // 2. A retreat with two; Max is freed but somewhere else.
 await command('pdoom_development 1');
 await free(0);await free(1);await free(3,{here:false});
 s=await leave('SPACE - retreat to the meadow');
 assert.ok(s.events.some(e=>e.type==='factory-exit'&&e.saved===3&&e.hub===1),'Exit event names the two who came out');
 s=await meadow('Back out into the meadow at MEG3N.AVI');
 assert.equal(s.exitText.phase,'idle','No text screen for a retreat');
 s=await wait(s=>s.outside.people.filter(p=>p.id>=10&&p.arrived).length===2,'Zvi and Victoria come out to camp',20000);
 assert.equal(s.outside.future.meg3n.strip,'saved,saved,inside,inside,inside');assert.equal(s.outside.future.meg3n.readme,'warning');
 let saved=await save();assert.equal(saved.saved2,3);assert.equal(saved.following2,8);assert.equal(s.campaign.saved,12);
 h=await hud();assert.ok(h.checkpoint&&!h.factory,'The meadow is back on the campaign HUD');
 assert.equal(await page.evaluate(()=>document.getElementById('held-wrench').hidden),true,'The wrench is put away in the meadow');
 await shot('2-retreat');record('Retreat: the exit switch takes out whoever is with you (2); Paul, freed elsewhere, is saved as following; no text; FREED 12/20');
 // 3. Back in: the two at camp are gone, Max waits in the break room.
 s=await enterFactory('Re-enter the factory');
 assert.deepEqual(s.world.people.map(p=>p.camped),[1,1,0,0,0],'Zvi and Victoria are at camp, not here');
 assert.equal(s.world.people[3].released,1);assert.equal(s.world.people[3].sheltered,1,'Paul waits in the break room');
 h=await hud();assert.match(h.line,/^(Freed 1\/3|GUARD: )/);await shot('3-reentry');
 await free(2);await free(3);await free(4);
 s=await leave('SPACE - retreat to the meadow');
 assert.ok(s.events.some(e=>e.type==='factory-exit'&&e.saved===28),'Max, Paul and Ajeya come out');
 const typing=await wait(s=>s.exitText.phase==='typing'&&s.exitText.visible&&s.melt.phase==='idle','Finishing the factory types the exit text',20000);
 assert.match(typing.exitText.text,/inspiring/,"Sam's line closes it");await shot('3-exit-text');
 await page.keyboard.press('Space',{delay:80});await wait(s=>s.exitText.chars===s.exitText.total,'Space finishes the text',3000);
 await page.keyboard.press('Space',{delay:80});
 s=await meadow('Into the meadow after the text');
 s=await wait(s=>s.outside.people.filter(p=>p.id>=10&&p.arrived).length===5,'All five at camp outside MEG3N.AVI',20000);
 assert.equal(s.outside.future.meg3n.strip,'saved,saved,saved,saved,saved');assert.equal(s.outside.future.meg3n.readme,'beaten');
 saved=await save();assert.equal(saved.saved2,31);assert.equal(saved.following2,0);assert.equal(s.campaign.saved,15);
 await shot('3-finished');record('Re-entry: people at camp stay gone, Paul waits in the break room; bringing out the rest finishes the factory: exit text, FREED 15/20');
 // 4. Nobody left: straight back out.
 s=await enterFactory('An empty revisit');
 assert.ok(s.world.people.every(p=>p.camped===1),'Everyone is at camp');
 assert.notEqual(s.factory.guardian_mode,5,'MEG3N does not guard an empty factory');
 s=await leave('SPACE - retreat to the meadow');assert.ok(s.events.some(e=>e.type==='factory-exit'&&e.saved===0));
 s=await meadow('Back out again');assert.equal(s.exitText.phase,'idle');assert.equal((await save()).saved2,31);
 record('An empty revisit: the exit switch lets you straight back out, no text, nothing re-locked');
 // 5. Level 1 still loads from here, with its own HUD.
 await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(17,-3,0,0));
 await wait(s=>s.outside.nearestDoor==='five-prisons','At CONTROL.EXE',5000);
 await page.keyboard.press('Space',{delay:80});
 s=await wait(s=>s.mode==='playing'&&!s.outside&&s.levelId==='five-prisons'&&s.world?.map==='E1M4'&&s.world.ticks>0&&!s.factory,'CONTROL.EXE loads level 1',90000);
 await page.waitForTimeout(1500);h=await hud();assert.ok(h.checkpoint&&!h.factory&&h.statusbar,`Level 1 HUD: ${JSON.stringify(h)}`);
 await shot('5-level-one');record('After the factory, CONTROL.EXE loads level 1 with its status bar and HUD');
 assert.deepEqual(report.errors,[]);
 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs);
 assert.deepEqual(logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown texture/.test(l)),[]);
 report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure.slice(0,3000));await shot('failure').catch(()=>{});}
finally{report.final=await read().catch(()=>null);await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(report.passed?0:1);
