import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {wallApproaches} from './wall-qa-helpers.mjs';
import {execFileSync} from 'node:child_process';

const out='output/thaw-override/native';await fs.mkdir(out,{recursive:true});
execFileSync('python3',['scripts/build-thaw-qa.py']);
const {map,approach,terminal}=await wallApproaches();
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[],walk:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/thaw-override/qa.pk3'}));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...args){super(...args);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,face,press,hold}=nativeQA(page);
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function aimPrecisely(angle){
 for(let i=0;i<30;i++){
  const s=await read(),d=((angle-s.world.angle)%360+540)%360-180;if(Math.abs(d)<2)return;
  const key=d>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(key);await page.waitForTimeout(Math.min(500,Math.max(20,Math.abs(d)*8)));await page.keyboard.up(key);await page.waitForTimeout(60);
 }
 throw Error('Precise heading '+angle);
}
// Walk through native collision. No teleports between override and release.
async function walkTo(x,y){
 let s=await read();await aimPrecisely((Math.atan2(y-s.world.y,x-s.world.x)*180/Math.PI+360)%360);
 await page.keyboard.down('KeyW');
 try{for(let i=0;i<45;i++){await page.waitForTimeout(100);s=await read();if(Math.hypot(s.world.x-x,s.world.y-y)<24){report.walk.push({x:s.world.x,y:s.world.y,remaining:s.hal.manual_remaining});return;}}throw Error('Walk blocked at '+JSON.stringify(s.world));}
 finally{await page.keyboard.up('KeyW');await page.waitForTimeout(150);}
}
let s;
const interactionSounds=async action=>{
 const before=Math.max(0,...(await read()).sound.recent.map(m=>m.sourceId));
 await action();return (await read()).sound.recent.filter(m=>m.sourceId>before);
};
function confirmSound(sounds,frames,label){
 const cue=sounds.find(m=>m.frames===frames);
 assert.ok(cue,label+' is emitted by the native mixer: '+JSON.stringify(sounds));
 assert.ok(cue.spatial?.panner,label+' is positioned in the room');
 assert.ok(cue.spatial.audibleGain>.1,label+' is audible nearby');
 assert.ok(!sounds.some(m=>m.frames===3910),'Successful interaction must not also play DSNOWAY');
 report[label]=sounds;
}
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing','Native boot',55000);await command('god');
 await warp(60,-260,270);await press('KeyE');assert.equal((await read()).world.wrench,1);
 if(!process.env.THAW_WALK_ONLY){
 await warp(...terminal(40));await press('KeyE');assert.equal((await read()).hal.valves,0);assert.equal((await read()).hal.manual_remaining,0);
 assert.match((await read()).world.prompt,/locked.*THAW/i);report.cases.push('Valves locked before local override');await shot('locked-valve');
 const camera=map.camera_mounts.find(p=>p.wall===672);await warp(...approach(camera));await press('Control');await wait(s=>s.world.cameras_broken===1,'Actual local surveillance camera destroyed');
 assert.equal((await read()).hal.manual_remaining,0);await warp(...terminal(40));await press('KeyE');assert.equal((await read()).hal.valves,0);report.cases.push('Destroying surveillance camera does not unlock valves');
 await warp(...terminal(29));await press('KeyE');s=await read();assert.ok(s.hal.manual_remaining>650&&s.hal.manual_remaining<=700);assert.equal(s.hal.levers,31);assert.equal(s.hal.pacified,0);await shot('override-active');
 assert.match(await page.locator('#hal-thaw').innerText(),/20s.*0\/2/);
 await press('Escape');const paused=(await read()).hal.manual_remaining;await page.waitForTimeout(700);assert.equal((await read()).hal.manual_remaining,paused);await press('Escape');report.cases.push('20-second native countdown pauses with gameplay');
 await warp(...terminal(40));await press('KeyE');assert.equal((await read()).hal.valves,1);await shot('first-valve');
 await wait(s=>s.hal.manual_remaining===0,'Override expires',23000);assert.equal((await read()).hal.valves,0);assert.equal((await read()).world.people[2].released,0);await press('KeyE');assert.equal((await read()).hal.valves,0);assert.equal(await page.locator('#hal-thaw').isVisible(),false);report.cases.push('Timeout resets partial valves, locks them and permits retry');
 }
 // Console warp leaves an ONFLOOR sentinel in this port; this test-only event
 // positions the player on the actual112u floor without telefragging them.
 await command('netevent pdoom_qa_thaw_start');assert.equal((await read()).world.z,112);const switchSounds=await interactionSounds(()=>press('KeyE'));confirmSound(switchSounds,6255,'thaw-button');report.retry=await read();await shot('retry');
 await aimPrecisely(90);const valveSounds=await interactionSounds(()=>press('KeyE'));confirmSound(valveSounds,18113,'valve-ratchet');assert.equal((await read()).hal.valves,1);report.cases.push('Successful button and valve emit audible spatial cues without the failed-use grunt');
 // The original barrel at(-1232,-2528) occupies the northern shortcut.
 // Pass south of it, with room above the raised pod, using native movement.
 await walkTo(-1264,-2568);await walkTo(-1104,-2560);await walkTo(-944,-2576);await aimPrecisely(270);await press('KeyE');
 await wait(s=>s.world.people[2].released,'Actual timed two-valve walking route');s=await read();assert.equal(s.world.people[2].route,'manual-thaw');assert.equal(s.hal.manual_remaining,0);assert.equal(s.hal.valves,3);assert.equal(s.hal.levers,31);report.cases.push('Real walking between both valves completes within 20 seconds');await shot('nate-released');
 assert.deepEqual(report.errors,[]);report.engineErrors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown sound|Execution could not continue/.test(l)));assert.deepEqual(report.engineErrors,[]);report.passed=true;report.final=s;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,walk:report.walk,failure:report.failure}));process.exit(report.passed?0:1);
