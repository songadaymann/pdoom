// Level 2 hints wait until you have seen what they are about (2026-10-13): Rob's tea hint came
// as soon as you were near his cell, before you had met the tea robot. Stand by Rob's cell
// with the robot behind you: no hint. Turn to face it: Rob's hint follows.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/hal-hint-sight';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
const said=s=>s.dialogue?.voice==='rob-hint'||s.voiceOver?.played?.includes('rob-hint')||s.voiceOver?.unrecorded?.includes('rob-hint');
try{
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);const q=nativeQA(page);
 await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'HAL boot',55000);await q.command('god');
 // Within earshot of Rob (under 400 units), facing north: the tea robot works behind you.
 await q.warp(-384,120,90);await q.command('centerview');
 await q.wait(s=>s.world.ticks>420,'Past the 10 s hint delay',30000);await page.waitForTimeout(5000);
 let s=await q.read();assert.ok(!said(s),'No tea hint before you have seen the tea robot');
 await page.screenshot({path:out+'/facing-away.png'});report.cases.push('Near Rob, tea robot unseen: no hint after 15 s');
 await q.face(270);await q.command('centerview');
 s=await q.wait(said,'Rob hints once you look at the tea robot',8000);await page.screenshot({path:out+'/facing-robot.png'});
 report.cases.push('Turn to face the tea robot: Rob\'s tea hint follows');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
