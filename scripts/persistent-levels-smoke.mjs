// Levels stay as you left them (2026-11-09, doom-web/campaign.js BROKEN, CampaignSession.zs). Jonathan: "if we enter
// back in a level after clearing it, the level should not reset ... all cameras, tvs and stuff that we destroyed
// should remain so - and if people want to go back and destroy the rest of the things they missed, they can."
// Muted, on the loopback server, from a save with things already broken in every level (seeded, so the boot CVars
// carry them), walking in through each door from SAFE MODE:
//  1. CONTROL.EXE: cameras 0, 4 and 8 broken, the shutter open with its junction cut, the turret off, the bridge up;
//     no blast, alarm or event for any of it. Break camera 1 too and crank out: the save now has it as well.
//  2. Straight back in, in the same tab: cameras 0, 1, 4 and 8 broken (the engine's own copy).
//  3. HAL3000.SYS: cameras 1 and 7, door 2's panels jammed, all four memory modules out (HAL pacified), the
//     breaker glass smashed.
//  4. MEG3N.AVI: screens 0, 5 and 19 dark, the rest still there to break; out by the exit switch, the save unchanged.
//  5. AGENTIC.BAT: two cameras broken.
// node scripts/persistent-levels-smoke.mjs   (DOOM_URL)
import {chromium} from '@playwright/test';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',out=process.env.DOOM_OUT||'output/persistent-levels';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};const record=text=>{report.cases.push(text);console.log(text);};
const controls=await fs.readFile('doom-web/controls.cfg','utf8');
const bit=(...n)=>n.reduce((m,i)=>m|1<<i,0);
const SEED={version:1,ceo:'altman',hub:true,saved0:31,saved1:31,saved2:31,saved3:0,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0,ending3:0,endgame:0,
 broken0:bit(0,4,8,9,10,11,12),broken1:bit(1,7,11,15,16,17,18)|2<<19,broken2:bit(0,5,19,20),broken3:bit(0,3)};
const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();
page.on('pageerror',e=>report.errors.push(String(e)));
await page.route('**/controls.cfg',r=>r.fulfill({contentType:'text/plain',body:controls+'\nbind ` "toggleconsole"\n'}));
await page.addInitScript(seed=>{
 const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
 if(!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.setItem('pdoom.level-intros.v1',JSON.stringify(['five-prisons','hal-station','meg3n-factory','agentic-pods']));localStorage.setItem('pdoom.campaign.v1',JSON.stringify(seed));}
},SEED);
const {read,wait,command,face,warp,hold}=nativeQA(page);
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
const save=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')));
const broken=s=>(s.combat?.cameras??[]).filter(c=>c.broken).map(c=>c.id).sort((a,b)=>a-b);
const eventsSince=async n=>(await read()).events.slice(n).filter(e=>/broken|blast|alert/.test(e.type));
async function meadow(label){return wait(s=>s.outside?.active&&!s.outside.paused&&s.melt?.phase==='idle',label,60000);}
async function enterDoor(x,z,yaw,label,test){
 await page.evaluate(([x,z,yaw])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,0),[x,z,yaw]);
 await page.waitForFunction(()=>!document.getElementById('hub-enter')?.hidden,null,{timeout:8000});
 const n=(await read()).events.length;
 await page.keyboard.press('Space',{delay:80});
 const s=await wait(s=>s.mode==='playing'&&!s.outside&&s.world?.ticks>70&&test(s),label,90000);
 await page.waitForTimeout(1200);return {s:await read(),n};
}
// out by the crank in the refuge (levels 1-2), as level-exit-smoke does
async function crankOut(hal){
 if(hal)await warp(256,520,90);else await warp(1100,928,0);
 await command('centerview');await wait(s=>/return to SAFE MODE/.test(s.world.prompt),'Facing the crank',8000);
 await hold('KeyE',1850);
}
try{
 await page.goto(`${base}?play=1&load=1&ceo=altman`);
 await meadow('SAFE MODE');
 // 1. level 1
 let {s,n}=await enterDoor(17,-3,0,'CONTROL.EXE',s=>s.levelId==='five-prisons'&&s.world.entry_hub===1&&s.combat);
 assert.deepEqual(broken(s),[0,4,8],'cameras 0, 4 and 8 are broken again');
 assert.equal(s.sam.opened,1,'the shutter is open');assert.equal(s.sam.power_cut,1,'its junction is cut');
 assert.equal(s.world.turret_broken,1,'the turret is off');assert.equal(s.holly.bridge_up,1,'the bridge is up');
 assert.deepEqual(await eventsSince(n),[],'no break, blast or alarm events for any of it');
 await shot('1-control');
 // break camera 1 (1520, 1279.5) with the wrench, from below it
 await warp(1520,1212);const at=await read();await face(Math.atan2(1279.5-at.world.y,1520-at.world.x)*180/Math.PI);
 await page.keyboard.press('Control',{delay:80});
 s=await wait(s=>broken(s).includes(1),'the wrench breaks camera 1',6000);
 await crankOut(false);await meadow('out by the crank');
 assert.equal((await save()).broken0,SEED.broken0|bit(1),'the save keeps camera 1 too');
 record(`CONTROL.EXE: cameras 0, 4, 8 broken again, the shutter open, its junction cut, the turret off, the bridge up, quietly; camera 1 broken and cranked out: broken0 ${(await save()).broken0}`);
 // 2. back in, same tab
 ({s}=await enterDoor(17,-3,0,'CONTROL.EXE again',s=>s.levelId==='five-prisons'&&s.world.entry_hub===1&&s.combat));
 assert.deepEqual(broken(s),[0,1,4,8],'all four broken cameras, without a reload');
 await crankOut(false);await meadow('out again');
 record('Straight back into CONTROL.EXE in the same tab: cameras 0, 1, 4 and 8 broken');
 // 3. level 2
 ({s,n}=await enterDoor(1,-202,0,'HAL3000.SYS',s=>s.levelId==='hal-station'&&s.world.entry_hub===1&&s.combat&&s.doors&&s.hal));
 assert.deepEqual(broken(s),[1,7],'cameras 1 and 7 are broken again');
 const jammed=s.doors.panels.filter(p=>p.jammed).map(p=>p.door);assert.deepEqual([...new Set(jammed)],[2],`door 2's panels are jammed (${JSON.stringify(jammed)})`);
 assert.equal(s.hal.modules,4,'all four memory modules are out');assert.equal(s.hal.pacified,1,'HAL stays pacified');
 if('breaker_glass' in s.hal)assert.equal(s.hal.breaker_glass,2,'the breaker glass is smashed');
 assert.deepEqual(await eventsSince(n),[],'no events for any of it');
 await shot('3-hal');
 await crankOut(true);await meadow('out of HAL');
 assert.equal((await save()).broken1,SEED.broken1,'the save is unchanged');
 record(`HAL3000.SYS: cameras 1 and 7, door 2's panels jammed, four modules out (HAL pacified)${'breaker_glass' in s.hal?', the breaker glass smashed':''}, quietly; out, the save unchanged`);
 // 4. level 3
 {const yaw=-65*Math.PI/180;({s,n}=await enterDoor(-150.2-Math.sin(yaw)*3,2.5-Math.cos(yaw)*3,yaw+Math.PI,'MEG3N.AVI',s=>s.world?.level==='meg3n-factory'&&s.factory?.hub_entry===1));}
 const dark=s.factory.screens.map((v,i)=>v[3]?i:-1).filter(i=>i>=0);assert.deepEqual(dark,[0,5,19],'screens 0, 5 and 19 are dark again; the other 17 are still there to break');
 assert.equal(s.world.screens??3,3,'the HUD counts them');
 assert.deepEqual(await eventsSince(n),[],'no screen events, no MEG3N');
 await shot('4-factory');
 await face(270);await wait(s=>s.world.prompt==='SPACE - leave the factory','the exit switch',8000);await page.keyboard.press('Space',{delay:80});
 await meadow('out of MEG3N.AVI');
 assert.equal((await save()).broken2,SEED.broken2,'the save is unchanged');
 record('MEG3N.AVI: screens 0, 5 and 19 dark again (17 left), quietly; out by the exit switch, the save unchanged');
 // 5. level 4
 {const yaw=-330*Math.PI/180;({s,n}=await enterDoor(143.5-Math.sin(yaw)*3,86.7-Math.cos(yaw)*3,yaw+Math.PI,'AGENTIC.BAT',s=>s.levelId==='agentic-pods'&&s.agentic?.hub_entry===1));}
 assert.equal(s.agentic.cameras_broken,2,'two cameras are broken again');
 assert.deepEqual(await eventsSince(n),[],'no camera events, no SMITH');
 await shot('5-agentic');
 record('AGENTIC.BAT: two cameras broken again, quietly');
 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs);
 assert.deepEqual(logs.filter(l=>/Script error|VM execution aborted|Execution could not continue/.test(l)),[]);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure.slice(0,2500));await shot('failure').catch(()=>{});}
finally{report.final=await read().catch(()=>null);await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:!!report.passed,cases:report.cases,errors:report.errors.slice(0,5)},null,1));process.exit(report.passed?0:1);
