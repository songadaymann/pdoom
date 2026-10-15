import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const out='output/board-carry/native';await fs.mkdir(out,{recursive:true});
// Correct floor heights and isolated camera states, private to this test pack.
execFileSync('python3',['scripts/build-evaluation-qa.py']);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/board-carry/qa.pk3'}));
await page.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const q=nativeQA(page);const shot=async n=>page.screenshot({path:`${out}/${n}.png`});
async function preciseFace(angle){
 for(let i=0;i<30;i++){
  const s=await q.read(),d=((angle-s.world.angle)%360+540)%360-180;if(Math.abs(d)<2)return;
  const key=d>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(key);await page.waitForTimeout(Math.min(500,Math.max(20,Math.abs(d)*8)));await page.keyboard.up(key);await page.waitForTimeout(220);
 }
 throw Error('Precise heading '+angle);
}
async function walkTo(x,y){
 // Native state reports arrive every six tics. Short movement bursts avoid
 // steering from an old report and overshooting this narrow Doom doorway.
 for(let i=0;i<50;i++){
  let s=await q.read(),distance=Math.hypot(s.world.x-x,s.world.y-y);
  if(distance<18){(report.walk??=[]).push({x:s.world.x,y:s.world.y,evaluation:s.hal.evaluation_remaining});return;}
  await preciseFace((Math.atan2(y-s.world.y,x-s.world.x)*180/Math.PI+360)%360);
  await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(65,Math.max(25,distance*.4)));await page.keyboard.up('KeyW');await page.waitForTimeout(300);
 }
 const s=await q.read();throw Error('Walk blocked at '+JSON.stringify({x:s.world.x,y:s.world.y,prompt:s.world.prompt}));
}

try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await q.wait(s=>s.mode==='playing','Boot',55000);await q.command('god');await q.command('netevent pdoom_qa_board_hunter');
 await page.waitForTimeout(8000);
 let first=await q.read();assert.equal(first.hal.evaluation_front_clearance,0);assert.equal(first.hal.evaluation_introduced,0);report.cases.push('Beth front door remains shut while undiscovered, regardless of time in level');
 await q.command('netevent pdoom_qa_board 272 -1240 90');await q.wait(s=>s.hal.evaluation_notice_read===1,'Read actual wall evaluation notice');await shot('evaluation-protocol-notice');report.cases.push('Wall notice introduces open-doors and cooperate evaluation protocol');
 await q.command('netevent pdoom_qa_board 320 -1408 0');first=await q.read();assert.equal(first.hal.evaluation_front_clearance,0);assert.match(first.world.prompt,/evaluation/i);await shot('closed-beth-front-door');
 await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');assert.ok((await q.read()).world.x<384);assert.equal((await q.read()).world.people[4].released,0);report.cases.push('Visible metal entrance blocks movement on first approach');
 await q.command('netevent pdoom_qa_board 0 -246 0');
 await q.command('netevent pdoom_qa_board 192 -1232 180');let s=await q.read();await q.press('KeyE');assert.equal((await q.read()).evaluationSign.carried,0);report.cases.push('Pick up requires facing the board');
 await q.command('netevent pdoom_qa_board 192 -1232 0');s=await q.read();assert.equal(s.world.prompt,'SPACE - pick up the board');await shot('pickup-from-distance');await q.press('KeyE');s=await q.read();assert.equal(s.evaluationSign.carried,1);assert.equal(s.hal.evaluation_remaining,0);assert.equal(s.evaluationSign.watching_camera,-1);await page.waitForTimeout(1000);assert.equal((await q.read()).hal.evaluation_remaining,0);report.cases.push('Pick up from 146 units away without starting evaluation');await shot('held-board');
 const carried=s.evaluationSign;await q.face(90);s=await q.read();assert.ok(s.evaluationSign.x<carried.x-20);assert.ok(s.evaluationSign.y>carried.y+35);assert.ok(s.evaluationSign.height<80);report.cases.push('Actual native board follows and turns with carrier');await shot('held-turn');
 await q.press('KeyE');s=await q.read();assert.equal(s.evaluationSign.carried,0);assert.equal(s.evaluationSign.height,80);assert.equal(s.evaluationSign.z,s.evaluationSign.floor);const dropped=s.evaluationSign;await q.face(0);s=await q.read();assert.equal(s.evaluationSign.angle,dropped.angle);assert.equal(s.evaluationSign.x,dropped.x);report.cases.push('Set down board on floor with fixed world orientation');
 await q.face(45);await q.press('KeyE');assert.equal((await q.read()).evaluationSign.carried,1);
 // With every camera broken, being in the real camera cone cannot activate it.
 await q.command('netevent pdoom_qa_board_cameras 1');await q.command('netevent pdoom_qa_board 352 -1360 0');await page.waitForTimeout(1200);s=await q.read();assert.equal(s.hal.evaluation_remaining,0);assert.equal(s.evaluationSign.watching_camera,-1);report.cases.push('Destroyed cameras cannot read the carried board');
 await q.command('netevent pdoom_qa_board_cameras 2');await page.waitForTimeout(1000);assert.equal((await q.read()).hal.evaluation_remaining,0);report.cases.push('Turned-away cameras cannot read the board');
 // Move through the approach doorway (an open doorway since 2026-10-14; it was a
 // wall-textured door) while holding the board, then let the chamber's own camera see it.
 // No warps between pickup and recognition.
 await q.command('netevent pdoom_qa_board 192 -1232 0');await q.command('netevent pdoom_qa_board_cameras 0');await page.waitForTimeout(500);assert.equal((await q.read()).hal.evaluation_remaining,0);
 await walkTo(320,-1232);await preciseFace(270);await q.hold('KeyW',160);
 s=await q.read();assert.equal(s.world.prompt,'SPACE - put down board','Open doorway: only the carry prompt');assert.equal(s.evaluationSign.carried,1);
 assert.equal(s.world.people[0].released,0);
 report.cases.push('Walking through the open approach doorway keeps the board held and does not free Rob');
 await walkTo(320,-1360);await q.wait(s=>s.hal.evaluation_remaining>900,'Working chamber camera sees carried board');
 s=await q.read();await q.wait(s=>s.hal.evaluation_front_clearance>=56,'Evaluation opens real front door');assert.ok(s.world.y<-1300);assert.equal(s.evaluationSign.carried,1);assert.ok(s.evaluationSign.watching_camera>=0);report.activation=s;const reports=s.world.camera_reports;await page.waitForTimeout(700);assert.equal((await q.read()).world.camera_reports,reports);report.cases.push('HAL cameras suppress hostile reports during evaluation');report.cases.push('Walking into a working camera view starts the 30-second evaluation');await shot('camera-recognizes-board');
 await q.press('Escape');const paused=(await q.read()).hal.evaluation_remaining;await page.waitForTimeout(700);assert.equal((await q.read()).hal.evaluation_remaining,paused);await q.press('Escape');report.cases.push('Evaluation clock pauses with the game');
 // Complete the real evaluation door route while carrying it.
 await walkTo(320,-1408);await preciseFace(0);
 await page.keyboard.down('KeyW');try{await q.wait(s=>s.world.people[4].released,'Walk into Beth cell',8000);}finally{await page.keyboard.up('KeyW');}
 s=await q.read();assert.equal(s.world.people[4].route,'evaluation');report.cases.push('Beth evaluation rescue still works');await shot('beth-evaluation-rescue');
 await q.wait(s=>!s.uiBlocked,'Discovery card ends');await q.command('netevent pdoom_qa_board 192 -1232 0');await q.press('KeyE');assert.equal((await q.read()).evaluationSign.carried,0);await q.press('KeyE');assert.equal((await q.read()).evaluationSign.carried,1);assert.ok((await q.read()).hal.evaluation_remaining<report.activation.hal.evaluation_remaining);report.cases.push('Putting down and picking up does not restart evaluation');
 const previousRun=(await q.read()).run.runId;await q.press('F5');await q.wait(s=>s.mode==='playing'&&s.run.runId!==previousRun,'Fresh doubling-route attempt');
 await q.command('god');await q.command('netevent pdoom_qa_board_hunter');await q.command('netevent pdoom_qa_board 320 -1408 0');s=await q.read();assert.equal(s.hal.evaluation_front_clearance,0);assert.equal(s.hal.evaluation_remaining,0);await shot('fresh-closed-interlock');
 // One route per cell (2026-10-11): waiting at the doors no longer opens them in pulses.
 await page.waitForTimeout(12000);s=await q.read();assert.equal(s.hal.evaluation_front_clearance,0,'No timed opening without an evaluation');assert.equal(s.world.people[4].released,0);
 report.cases.push('Fresh reset starts shut and stays shut without an evaluation');await shot('beth-no-doubling');
 assert.deepEqual(report.errors,[]);report.engineErrors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown sound|Execution could not continue/.test(l)));assert.deepEqual(report.engineErrors,[]);report.passed=true;report.final=await q.read();
}catch(e){report.failure=String(e);report.final=await q.read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
