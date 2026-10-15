import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const out='output/stair-softlock/native';await fs.mkdir(out,{recursive:true});
execFileSync('python3',['scripts/build-stair-qa.py']);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};let page,q;
async function boot(pack){
 page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/pdoom.pk3',r=>r.fulfill({path:pack}));
 await page.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);q=nativeQA(page);
 await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Boot',55000);await q.command('god');
}
const place=(x,y,angle)=>q.command(`netevent pdoom_qa_stair ${x} ${y} ${angle}`);
const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
try{
 if(process.env.DOOM_STAIR_BASELINE==='1'){
  await boot('output/stair-softlock/baseline-qa.pk3');await place(160,-2224,150);const before=(await q.read()).world;
  await q.hold('KeyW',1200);const after=(await q.read()).world;
  assert.equal(after.z,8,'Raised old lift keeps the player below the stairs');
  assert.ok(after.y<-2200,'Movement slides along the lift face without escaping the recess');
  report.baseline={before,after};await shot('original-raised-lift-blocks-exit');await page.close();
 }
 await boot('output/stair-softlock/qa.pk3');
 await place(160,-2224,150);assert.equal((await q.read()).world.z,16);await shot('recess-with-low-landing');
 await q.hold('KeyW',1200);let s=await q.read();assert.ok(s.world.z>=32&&s.world.x<100&&s.world.y>-2195,'Walk back onto stairs while standing');
 report.cases.push('Standing escape from the exact screenshot recess');await shot('standing-back-on-stairs');
 for(const [name,x,y,angle]of [['middle',104,-2176,310],['east',130,-2168,290]]){
  await place(x,y,angle);assert.equal((await q.read()).world.z,32,'Landing floor');
  await q.hold('KeyW',700);s=await q.read();assert.equal(s.world.z,16,'Physically step off the stair landing into recess');await shot('natural-drop-'+name);
  await page.waitForTimeout(4500);assert.equal((await q.read()).world.z,16,'Waiting does not close or crush the recess');
  await q.face(150);await q.hold('KeyW',1400);s=await q.read();assert.ok(s.world.z>=32&&s.world.y>-2200,'Climb back out without jumping or crouching');
  report.cases.push('Natural drop, wait and standing return: '+name);
 }
 await place(104,-2176,310);await q.press('KeyE');await page.waitForTimeout(4500);assert.equal((await q.read()).world.z,32,'Use cannot start the old lift timer');
 report.cases.push('Landing stays fixed after use and elapsed lift delay');
 await q.press('F5');await q.wait(s=>s.world.ticks>35&&!s.uiBlocked,'Restart');await place(104,-2176,310);assert.equal((await q.read()).world.z,32);
 report.cases.push('Restart restores the permanent landing');
 report.engineErrors=await page.evaluate(()=>__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.engineErrors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await q?.read().catch(()=>null);report.logs=await page?.evaluate(()=>__DOOM_DEBUG__?.logs.slice(-20)).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
