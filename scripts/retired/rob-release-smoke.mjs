import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {wallApproaches} from './wall-qa-helpers.mjs';
const out='output/rob-emergency/native';await fs.mkdir(out,{recursive:true});
execFileSync('python3',['scripts/build-rob-release-qa.py']);
const {map,approach,terminal}=await wallApproaches();
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/rob-emergency/qa.pk3'}));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...args){super(...args);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,face,press,hold}=nativeQA(page);
const shot=async n=>page.screenshot({path:out+'/'+n+'.png'});
async function restart(){const id=(await read()).run.runId;await press('F5');await wait(s=>s.run?.runId!==id&&s.world?.ticks>35,'Native restart');await command('god');}
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing','Boot',55000);await command('god');
 await warp(60,-260,270);await press('KeyE');assert.equal((await read()).world.wrench,1);
 const panel=map.door_panels.find(p=>p.tag===1179&&p.sector===13);
 await warp(...approach(panel));await press('Control');await press('Control');await press('Control');assert.ok((await read()).doors.panels.some(p=>p.door===3&&p.jammed),'Ctrl swings break the panel');
 assert.equal((await read()).world.people[0].released,0);report.cases.push('Breaking balcony corridor panel does not rescue Rob');
 await command('netevent pdoom_qa_rob_walk');await hold('KeyW',750);
 let s=await read();assert.ok(s.world.x < -600);assert.equal(s.world.people[0].released,0);assert.equal(s.hal.rob_release_pending,0);
 report.cases.push('Walking across the former invisible trigger does nothing');await shot('balcony-no-release');
 const mount=map.wall_mounts.find(p=>p.kind===23);await warp(...approach(mount,64,-32));await shot('release-oblique');await warp(...terminal(23));await shot('marked-release');assert.equal((await read()).world.prompt,"SPACE - release Rob's cell");
 await press('KeyE');await wait(s=>s.hal.rob_release_pending===1,'Remote unlock');await page.waitForTimeout(1500);s=await read();
 assert.equal(s.world.people[0].released,0);assert.ok(s.world.people[0].x>=-240&&s.world.people[0].x<=-64);
 assert.equal(s.world.prompt,'','No prompt once the cell is unlocked');await shot('release-used');
 await press('KeyE');assert.equal((await read()).world.people[0].released,0);report.cases.push('Marked switch unlocks cell; Rob stays captive there until collected');
 await warp(-304,-64,180);assert.equal((await read()).world.people[0].released,0);
 const card=wait(s=>s.uiBlocked,'Rob discovery card').then(()=>shot('meet-rob'));await Promise.all([face(0),card]);await wait(s=>s.world.people[0].released,'Meet Rob');s=await read();assert.equal(s.world.people[0].route,'emergency-release');assert.equal(s.hal.rob_release_pending,0);
 report.cases.push('Returning and seeing Rob starts his rescue and discovery card');
 await restart();s=await read();assert.equal(s.world.people[0].released,0);assert.equal(s.hal.rob_release_pending,0);report.cases.push('Restart resets switch and rescue');
 await warp(746,-160,90);await press('KeyE');await warp(-446,-160,0);await command('centerview');await press('Control');
 await wait(s=>s.world.people[0].released,'Shoot STOP');assert.equal((await read()).world.people[0].route,'stop-button');report.cases.push('Shoot STOP alternative still works');
 assert.deepEqual(report.errors,[]);report.engineErrors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));assert.deepEqual(report.engineErrors,[]);report.passed=true;report.final=await read();
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
