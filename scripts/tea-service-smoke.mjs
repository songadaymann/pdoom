import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.DOOM_OUT||'output/tea-redesign/native';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1440,height:900}});
const report={cases:[],errors:[],stages:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold}=nativeQA(page);
const shot=async name=>page.screenshot({path:`${out}/${name}.png`});
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing'&&s.hal?.tea_phase!==undefined,'Tea native boot',55000);await command('god');
 for(const[x,y]of [[32,-736],[-1488,64],[-1184,-2320],[1248,-2048]]){await warp(x,y+16,270);await press('KeyE');}
 await wait(s=>s.hal.pacified===1,'Actual memory modules');
 await warp(-476,-212,40);await command('centerview');
 for(const[phase,name]of [[1,'01-press-green'],[2,'02-filling-cup'],[3,'03-carry-cup'],[4,'04-discard-pile']]){
  const s=await wait(s=>s.hal.tea_phase===phase,`Tea phase ${phase}`,18000);report.stages.push({phase,tea:s.hal});await shot(name);
  assert.equal(s.world.people[0].released,0);assert.equal(s.hal.labels,0);
 }
 const count=(await read()).hal.cups_served;await wait(s=>s.hal.cups_served>count,'Repeat service loop',18000);
 report.cases.push('Harmless bot presses green, fills cup, carries to pile, drops and repeats without releasing cell');
 await warp(-438,-170,15);assert.equal((await read()).world.prompt,'SPACE - swap labels');
 await wait(s=>s.hal.tea_phase===3,'Swap during cup delivery',18000);await press('KeyE');
 let s=await read();assert.equal(s.hal.labels,3);assert.equal(s.world.people[0].released,0);assert.equal(s.world.prompt,'','No prompt once labels are swapped');await shot('05-labels-swapped');
 // Holding E must not toggle back or require a second individual label action.
 await hold('KeyE',1100);assert.equal((await read()).hal.labels,3);
 s=await wait(s=>s.hal.tea_stopped===1&&s.world.people[0].released,'Robot presses red STOP',18000);
 assert.equal(s.hal.tea_pressed_button,2);assert.equal(s.world.people[0].route,'teabot');assert.equal(s.hal.tea_carrying,0);await shot('06-stopped-cell-open');
 report.cases.push('One use swaps visible labels, prompt clears; door remains shut until bot returns and physically presses red STOP');
 const pos=[s.hal.tea_bot_x,s.hal.tea_bot_y],served=s.hal.cups_served;await page.waitForTimeout(4500);s=await read();
 assert.deepEqual([s.hal.tea_bot_x,s.hal.tea_bot_y],pos);assert.equal(s.hal.cups_served,served);await press('KeyE');assert.equal((await read()).hal.labels,3);
 report.cases.push('Stopped bot stays stopped; repeated use is idempotent');
 await warp(-390,-72,0);await hold('KeyW',1800);assert.ok((await read()).world.x>-240,'Open door admits real player');
 report.cases.push('Robot-operated door is physically passable');
 const id=(await read()).run.runId;await press('F5');await wait(s=>s.mode==='playing'&&s.run.runId!==id,'Fresh attempt resets tea');s=await read();assert.equal(s.hal.labels,0);assert.equal(s.hal.tea_stopped,0);
 // One route per cell (2026-10-11): only the robot pressing STOP frees Rob.
 await warp(746,-160,90);await press('KeyE');const ammo=(await read()).world.ammo;await warp(-446,-160,0);await command('centerview');await press('Control');
 await wait(s=>s.world.ammo<ammo,'Slingshot fired at STOP');await page.waitForTimeout(1500);s=await read();assert.equal(s.world.people[0].released,0,'Shooting STOP does not release Rob');assert.equal(s.hal.tea_stopped,0);
 report.cases.push('Restart resets routine; shooting STOP does nothing (the label swap is the one route)');
 report.final=await read();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs?.filter(l=>!/PDOOM_(STATE|HAL|COMBAT|CAST|RUN|POLISH|LIVES|ESCAPE|SAM|DIALOGUE)/.test(l)).slice(-30)).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));
// Native Chrome teardown can leave Playwright pipe handles after its child exits.
// The isolated browser has closed and the complete report is already on disk.
process.exit(report.passed?0:1);
