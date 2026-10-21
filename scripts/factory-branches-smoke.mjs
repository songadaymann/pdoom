import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/factory/branches';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],report={cases:[],errors};
page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold}=nativeQA(page);
try{
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory');await startGame(page);await wait(s=>s.mode==='playing'&&s.factory,'Native boot',60000);await command('god');
 await warp(1031,1690,90);await wait(s=>s.world.wrench,'Wrench');
 // MEG3N introduces herself, follows you to the break room and stops at its NO TOYS tape.
 const inRefuge=(x,y)=>x>1152&&x<1600&&y>1535&&y<1920;
 for(let i=0;i<30&&(await read()).dialogue?.voice!=='megan-met';i++){
  const s=await read();await warp(1100,1700,(Math.atan2(s.factory.guardian_y-1700,s.factory.guardian_x-1100)*180/Math.PI+360)%360);await page.waitForTimeout(700);
 }
 assert.equal((await read()).dialogue?.voice,'megan-met','MEG3N introduces herself on first sight');
 await warp(1300,1700,270);
 await wait(s=>s.dialogue?.voice==='megan-line','MEG3N stops at the NO TOYS tape',20000);
 for(let i=0;i<6;i++){const s=await read();assert.ok(!inRefuge(s.factory.guardian_x,s.factory.guardian_y),'MEG3N stays outside the break room');assert.equal(s.world.seen_remaining,0,'No SEEN warning in the break room');await page.waitForTimeout(500);}
 report.cases.push('MEG3N introduces herself, follows you to the break room and stops at the NO TOYS tape');
 await warp(700,1904,270);const before=(await read()).audioBuffers;await press('Space');
 await wait(s=>s.audioBuffers>before&&s.sound.recent.some(b=>b.frames>40000),'Original CD tune reaches native audio bridge',5000);
 report.cases.push('CD player emits the actual original tune through native spatial audio');
 if(process.env.FACTORY_CASES!=='music'){
  await warp(1712,-244,180);
  await wait(s=>!s.factory.guard_rated,'Fresh guard trial');await press('Digit1');assert.equal((await read()).factory.positive_streak,1);
  await wait(s=>!s.factory.guard_rated,'Next trial',9000);await press('Digit2');assert.equal((await read()).factory.positive_streak,0);
  for(let n=0;n<5;n++){await wait(s=>!s.factory.guard_rated,'Distinct praise trial',9000);await press('Digit1');}
  await wait(s=>s.factory.sycophant&&s.factory.alarm_count>0,'Overpraise creates noisy approval seeker');
  await page.waitForTimeout(4000);await warp(1712,-224,180);await hold('KeyW',2200);assert.ok((await read()).world.x<1540);
  report.cases.push('Negative feedback resets praise; indiscriminate praise opens a noisy physical escape');
  await page.screenshot({path:out+'/overpraised-guard.png'});
  // One way per puzzle: the gate refuses to open and frees nobody.
  await warp(480,512,90);await press('Space');await wait(s=>s.world.message.includes("won't open"),'Gate refuses');
  const gate=(await read());assert.equal(gate.factory.gate_closed,1);assert.equal(gate.world.people[1].released,0);
  report.cases.push('The playpen gate never opens');
  // The wrench route: wade into the paint and take ten hits' worth of damage.
  await command('god');await warp(480,700,270);const wading=(await read()).world.health;
  for(let n=0;n<10;n++){await press('ControlLeft');await page.waitForTimeout(120);}
  await wait(s=>s.factory.panel_hits===10,'Ten wrench hits break the fabric');
  assert.ok((await read()).world.health<wading,'Wading in the paint hurts');await command('god');
  report.cases.push('Wrench route needs ten hits while the paint hurts');
  await warp(3232,-250,270);await press('ControlLeft');await wait(s=>s.factory.camera_broken,'Camera break');
  const alarms=(await read()).factory.alarm_count;
  await wait(s=>s.factory.alarm_count>alarms,'Schemer physically reaches its alarm',35000);
  report.cases.push('Unmonitored schemer reaches the marked alarm after a generous observation window');
 }
 assert.deepEqual(errors,[]);report.passed=true;report.final=await read();
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure?.slice(0,500)}));process.exit(report.passed?0:1);
