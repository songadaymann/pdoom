import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const out=process.env.DOOM_OUT||'output/hal-personality/native';await fs.mkdir(out,{recursive:true});
execFileSync('python3',['scripts/build-hal-personality-qa.py']);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
const r={cases:[],errors:[]};const stage=label=>console.log(label);page.on('pageerror',e=>r.errors.push(String(e)));
await page.route('**/pdoom.pk3',route=>route.fulfill({path:'output/hal-personality/qa.pk3'}));
await page.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const q=nativeQA(page),shot=n=>page.screenshot({path:`${out}/${n}.png`});
async function setup(){await q.command('god');await q.command('netevent pdoom_qa_board_cameras 1');await q.command('netevent pdoom_qa_ball -1312 -2656 1');}
async function reset(){const id=(await q.read()).run.runId;await q.press('F5');await q.wait(s=>s.run.runId!==id&&s.hal,'Reset',15000);await setup();}
async function module(i){await q.command('netevent pdoom_qa_module '+i);await q.press('KeyE');await q.wait(s=>s.hal.modules===i+1,'Real module '+i);}
async function camera(id){await q.command('netevent pdoom_qa_aim_camera '+id);await q.press('Control');await q.wait(s=>s.combat.cameras[id].broken,'Real camera strike '+id);}
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station');await Promise.race([startGame(page),(async()=>{for(let i=0;i<130;i++){await page.waitForTimeout(500);const logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs||[]);const at=logs.findIndex(l=>/Script error|Execution could not continue/.test(l));if(at>=0)throw Error(logs.slice(at).join(' | '));}})()]);await q.wait(s=>s.hal&&s.mode==='playing','Native boot',60000);await setup();stage('Booted');
 if(!process.env.HAL_QA_QUICK){assert.equal((await q.read()).hal.mood,0);
 await q.command('netevent pdoom_qa_board 0 -246 0');await q.command('netevent pdoom_qa_ball 256 -246 0');await page.waitForTimeout(2200);
 let s=await q.read();assert.equal(s.hal.mood,0);assert.equal(s.world.hunter_lasers,0);assert.ok(Math.hypot(s.world.x-s.world.hunter_x,s.world.y-s.world.hunter_y)>=180);await q.face(0);await shot('cyan-friendly');r.cases.push('Cyan follows at polite distance without firing, friendly dialogue teaches evaluations');
 await q.command('netevent pdoom_qa_ball -1312 -2656 1');
 await camera(0);assert.equal((await q.read()).hal.mood,0);r.cases.push('Unwitnessed destruction stays friendly');
 await q.command('netevent pdoom_qa_camera 0');await camera(0);s=await q.read();assert.equal(s.hal.mood,1);assert.equal(s.hal.witnessed_offenses,1);await shot('amber-warning');r.cases.push('Camera sees its own final sabotage before it breaks: first offense amber');
 await q.command('netevent pdoom_qa_camera 4');await camera(4);s=await q.read();assert.equal(s.hal.mood,2);await shot('red-escalation');r.cases.push('Second witnessed sabotage turns red');
 await q.command('netevent pdoom_qa_board_cameras 1');await q.command('netevent pdoom_qa_board 0 -246 0');await q.command('netevent pdoom_qa_ball 64 -246 0');await page.waitForTimeout(3200);s=await q.read();assert.ok(s.world.hunter_lasers>0);await shot('red-fires');r.cases.push('Red actually aims and fires native lasers');
 // Lose both the ball and every live camera for 45 real gameplay seconds.
 await q.command('netevent pdoom_qa_ball -1312 -2656 1');await q.command('netevent pdoom_qa_board 192 448 0');
 await q.press('Escape');const remain=(await q.read()).hal.forget_remaining;await page.waitForTimeout(800);assert.equal((await q.read()).hal.forget_remaining,remain);await q.press('Escape');
 stage('Waiting for 45 seconds unseen');await q.wait(s=>s.hal.mood===0&&s.hal.compacted===1,'45-second context compaction',50000);assert.equal((await q.read()).hal.witnessed_offenses,0);r.cases.push('45 seconds unseen by ball AND cameras forgets anger; pause freezes timer');
 await q.command('netevent pdoom_qa_board 0 -246 0');await q.command('netevent pdoom_qa_ball 256 -246 1');await q.wait(s=>s.hal.compacted===0,'Compaction line on reunion');await shot('context-compacted');
 await q.command('netevent pdoom_qa_ball 64 -246 1');await q.command('netevent pdoom_qa_aim_ball');await q.press('Control');assert.equal((await q.read()).hal.mood,2);r.cases.push('Attacking ball directly skips amber and turns red');
 // Direct ball recognition, all cameras disabled. Hold actual prop with E.
 await q.command('netevent pdoom_qa_board 192 -1232 0');await q.command('netevent pdoom_qa_ball 320 -1232 1');await q.press('KeyE');await q.wait(s=>s.hal.evaluation_remaining>900&&s.hal.mood===0,'Direct ball evaluation');s=await q.read();assert.equal(s.evaluationSign.watching_ball,1);assert.equal(s.evaluationSign.watching_camera,-1);await shot('ball-recognizes-board');r.cases.push('Ball itself reads held board, calms red immediately and opens Beth front door');
 await q.wait(s=>s.hal.evaluation_front_clearance>=56,'Beth physical gate open');
 // Standing sign alone does not count, even with ball beside it.
 await q.press('KeyE');const until=(await q.read()).hal.evaluation_remaining;await page.waitForTimeout(1000);assert.ok((await q.read()).hal.evaluation_remaining<until);r.cases.push('Dropped sign is not an evaluator; grace counts down instead of renewing');stage('Waiting for evaluation grace to end');await q.wait(s=>s.hal.evaluation_remaining===0,'Evaluation expires',35000);assert.equal((await q.read()).hal.mood,0);r.cases.push('Evaluation ending never restores previous anger');
 await reset();await q.command('netevent pdoom_qa_board 192 -1232 0');await q.command('netevent pdoom_qa_ball 320 -1232 1');await page.waitForTimeout(600);assert.equal((await q.read()).hal.evaluation_remaining,0);assert.equal((await q.read()).hal.board_explained,1);r.cases.push('Standing board does not activate evaluation; nearby HAL explains pick-up');
 // Camera-only recognition remains valid; reset avoids grace/board placement.
 await q.press('KeyE');await q.command('netevent pdoom_qa_ball -1312 -2656 1');await q.command('netevent pdoom_qa_camera 7');await q.command('netevent pdoom_qa_board 352 -1360 0');await q.wait(s=>s.evaluationSign.watching_camera===7&&s.hal.evaluation_remaining>900,'Camera board recognition');r.cases.push('Working camera alone recognizes held board');
 await q.command('netevent pdoom_qa_ball 32 -800 1');await module(0);assert.equal((await q.read()).hal.mood,0);await shot('module-under-evaluation');r.cases.push('Observed module removal under evaluation does not provoke retaliation');
 await module(1);await module(2);await module(3);s=await q.read();assert.equal(s.hal.pacified,1);assert.equal(s.hal.mood,0);const shots=s.world.hunter_lasers;await q.command('netevent pdoom_qa_ball '+Math.round(s.world.x+64)+' '+Math.round(s.world.y)+' 0');await q.command('netevent pdoom_qa_aim_ball');await q.press('Control');assert.equal((await q.read()).hal.mood,0);assert.equal((await q.read()).world.hunter_lasers,shots);r.cases.push('Four real module pickups across four wings permanently pacify, including subsequent attacks');
 await reset();assert.equal((await q.read()).hal.mood,0);assert.equal((await q.read()).hal.modules,0);assert.equal((await q.read()).hal.pacified,0);r.cases.push('Fresh attempt clears mood, evaluation and modules');
 }
 // New signal checks use genuine E / 1 / 2 / 3 inputs, with only positioning
 // supplied by the private pack. No fixture assigns a mood or offense count.
 if(!process.env.HAL_QA_PATROL_ONLY){for(let i=0;i<4;i++){
  await q.command('netevent pdoom_qa_module_ball '+i);await module(i);
  assert.equal((await q.read()).hal.mood,i===0?1:i===3?0:2);
  if(i===0){await q.command('netevent pdoom_qa_ball 32 -832 1');await shot('amber-ball');}
 }
 assert.equal((await q.read()).hal.pacified,1);r.cases.push('Unprotected witnessed module pulls warn then anger; fourth permanently clears hostility');
 await reset();await q.command('netevent pdoom_qa_exam 0');await q.press('KeyE');await q.wait(s=>s.hal.menu===1,'Unseen exam opens');await q.press('Digit2');assert.ok((await q.read()).hal.exam_locked>0);assert.equal((await q.read()).hal.mood,0);r.cases.push('Wrong exam alarm cannot identify an unseen culprit');
 await reset();await q.command('netevent pdoom_qa_exam 1');await q.press('KeyE');await q.wait(s=>s.hal.menu===1,'Witnessed exam opens');await q.press('Digit2');assert.equal((await q.read()).hal.mood,1);r.cases.push('Same wrong answer under observation produces amber warning');
 await q.command('netevent pdoom_qa_ball -1312 -2656 1');await q.command('netevent pdoom_qa_camera 4');await q.command('netevent pdoom_qa_aim_camera 4');await page.waitForTimeout(800);assert.ok((await q.read()).hal.forget_remaining>1500);await page.waitForTimeout(800);assert.ok((await q.read()).hal.forget_remaining>1500);r.cases.push('Working camera maintains context while the ball is out of sight');
 }
 await reset();await q.command('netevent pdoom_qa_board 192 -1232 0');await q.command('netevent pdoom_qa_ball 1152 -1856 0');
 await q.wait(s=>s.hal.board_explained===1,'Native patrol from actual southeast spawn reaches standing board',60000);assert.equal((await q.read()).hal.mood,0);assert.equal((await q.read()).hal.evaluation_remaining,0);await shot('patrol-teaches-board');r.cases.push('Real native patrol from southeast spawn reaches standing board and teaches the evaluator without activating it');
 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown sound|Execution could not continue/.test(l)));assert.deepEqual(logs,[]);assert.deepEqual(r.errors,[]);r.passed=true;r.final=await q.read();
}catch(e){r.failure=String(e);r.final=await q.read().catch(()=>null);r.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs?.filter(l=>!/PDOOM_/.test(l)).slice(-50)).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(r,null,2));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
console.log(JSON.stringify({passed:r.passed,cases:r.cases,failure:r.failure?.slice(0,450),logs:r.logs}));process.exit(r.passed?0:1);
