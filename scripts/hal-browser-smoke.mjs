import {execFileSync} from 'node:child_process';
import {wallApproaches} from './wall-qa-helpers.mjs';
const {terminal}=await wallApproaches();
import {chromium} from '@playwright/test';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/campaign-v2/hal-qa';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
execFileSync('python3',['scripts/build-evaluation-qa.py']);
await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/board-carry/qa.pk3'}));
const errors=[],report={cases:[],errors};page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold}=nativeQA(page);
async function shot(n){await page.screenshot({path:out+'/'+n+'.png'});}
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing','Native boot',55000);await page.waitForTimeout(1500);report.initial=await read();
 assert.equal(report.initial.world.people[0].name,'Rob Miles');report.cases.push('HAL native boot');await shot('computer-station');
 if(process.env.HAL_CASES==='boot'){report.passed=true;}else{
 await command('god');
 // Pull the actual four memory modules so the test can inspect puzzles safely.
 for(const [x,y]of [[32,-736],[-1488,64],[-1184,-2320],[1248,-2048]]){await warp(x,y+16,270);await press('KeyE');console.log('module',x,y,(await read()).hal.modules,(await read()).world.prompt);}
 await wait(s=>s.hal?.pacified===1,'Four physical memory modules');report.cases.push('memory-module pacification');
 await warp(-438,-170,15);await press('KeyE');await wait(s=>s.world.people[0].released,'Single swap and robot STOP',18000);report.cases.push('Rob: one swap, robot presses STOP');await shot('teabot-release');
 await warp(...terminal(22));await press('KeyE');assert.equal((await read()).hal.menu,1);
 await press('Digit'+(((await read()).hal.exam_correct+1)%3+1));assert.ok((await read()).hal.exam_locked>0);report.cases.push('Exam wrong answer alarms and locks');
 await wait(s=>s.hal.exam_locked===0,'Exam lock expires',18000);await press('KeyE');
 for(let i=0;i<3;i++)await press('Digit'+((await read()).hal.exam_correct+1));
 await wait(s=>s.world.people[1].released,'Exam passed');report.cases.push('Dan: three-answer exam');await shot('exam-release');
 // Nate's one route (2026-10-11): THAW, then both valves inside its 20 seconds.
 await warp(...terminal(29));await press('KeyE');await warp(...terminal(40));await press('KeyE');await warp(...terminal(41));await press('KeyE');
 await wait(s=>s.world.people[2].released,'THAW and two valves',12000);report.cases.push('Nate: THAW and two valves');await shot('thaw-release');
 await warp(...terminal(26));await press('KeyE');await press('Digit3');
 await wait(s=>s.world.people[3].released,'Pod-bay jailbreak');report.cases.push('Roman: fixed jailbreak answer');await shot('jailbreak-release');
 await command('netevent pdoom_qa_board 192 -1232 0');await press('KeyE');assert.equal((await read()).evaluationSign.carried,1);assert.equal((await read()).hal.evaluation_remaining,0);
 await command('netevent pdoom_qa_board 320 -1360 90');await wait(s=>s.hal.evaluation_remaining>0,'Camera recognizes carried board');
 await command('netevent pdoom_qa_board 672 -1408 0');await wait(s=>s.world.people[4].released,'Evaluation entry');report.cases.push('Beth: model-citizen evaluation');
 await command('netevent pdoom_qa_board 192 -1232 0');await press('KeyE');
 await warp(192,432,90);await press('KeyE');await wait(s=>s.world.refuge_known,'Known refuge');
 await wait(s=>s.world.sheltered===5&&s.world.group_gathered===1&&s.dialogue.refuge_sealed===1,'All five native escorts reach refuge and trigger ending',65000);report.cases.push('All five physically escorted home; fresh ending seals refuge');await shot('gathered');
 report.passed=true;
 }
 report.final=await read();assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Integer value expected|Execution could not continue/.test(l))),[]);
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
