// Computer Station, one solution per prisoner (2026-10-11): Rob = label swap, Dan = exam,
// Nate = THAW + two valves, Roman = jailbreak prompt, Beth = evaluation board. The removed
// routes (STOP shot, balcony release, MAIM rack, power levers, bay cycle/jam, frost window,
// charge breach, Beth's timed doors) stay gone, and HAL's breaker only works at the end.
import {wallApproaches} from './wall-qa-helpers.mjs';
import {chromium} from '@playwright/test';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {terminal}=await wallApproaches();
const out=process.env.DOOM_OUT||'output/campaign-v2/hal-single-route';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={cases:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold}=nativeQA(page);
async function strike(times=3){for(let i=0;i<times;i++){await press('Control');await page.waitForTimeout(450);}}
try{
 // The built map: removed hardware is absent, the breaker and the shut exit door are present.
 const textmap=await fs.readFile('output/hal/E1M7-TEXTMAP.txt','utf8');
 const things=[...textmap.matchAll(/thing\s*\{([^}]*)\}/g)].map(m=>({type:+/type\s*=\s*(\d+)/.exec(m[1])[1],arg1:+(/arg1\s*=\s*(-?\d+)/.exec(m[1])?.[1]??0)}));
 for(const type of [15125,15126,15110,15111,15117])assert.ok(!things.some(t=>t.type===type),`No thing ${type} in the HAL map`);
 for(const kind of [23,27,30,31,32,33,34])assert.ok(!things.some(t=>t.type===15122&&t.arg1===kind),`No terminal kind ${kind}`);
 assert.equal(things.filter(t=>t.type===15122&&t.arg1===24).length,1,'One HAL main breaker');
 assert.match(textmap,/id\s*=\s*890;/,'Original exit door tagged 890');
 report.cases.push('Map: no STOP/balcony/MAIM/lever/cycle/frost/charge hardware; one breaker; exit door 890');

 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing','HAL boot',55000);
 await command('god');await warp(60,-260,270);await press('KeyE');assert.equal((await read()).world.wrench,1);
 // Rob: shooting the STOP button does nothing.
 await warp(746,-160,90);await press('KeyE');const ammo=(await read()).world.ammo;await warp(-446,-160,0);await command('centerview');await press('Control');
 await wait(s=>s.world.ammo<ammo,'Slingshot fired at STOP');await page.waitForTimeout(1500);assert.equal((await read()).world.people[0].released,0);
 report.cases.push('Rob: shooting STOP leaves him captive');
 // Dan: nothing to smash where the MAIM rack stood.
 await press('KeyT');await warp(-1700,304,90);await strike();await page.waitForTimeout(800);assert.equal((await read()).world.people[1].released,0);
 report.cases.push('Dan: no MAIM rack to smash');
 // Nate: THAW and both valves is his one route.
 await warp(...terminal(29));await press('KeyE');assert.ok((await read()).hal.manual_remaining>600);await warp(...terminal(40));await press('KeyE');assert.equal((await read()).hal.valves,1);
 await warp(...terminal(41));await press('KeyE');await wait(s=>s.world.people[2].released,'Manual override and two valve turns');assert.equal((await read()).world.people[2].route,'manual-thaw');
 assert.equal((await read()).hal.levers,31,'Station power untouched');report.cases.push('Nate: THAW + two valves');
 // Roman: the frost-marked window no longer breaks.
 await warp(1504,-2440,90);await command('centerview');await hold('PageUp',580);await strike();await page.waitForTimeout(800);assert.equal((await read()).world.people[3].released,0);
 report.cases.push('Roman: window strikes do nothing');
 // HAL's breaker does nothing before everyone is in the Faraday Room.
 // It is out of sight behind a steel shutter until then (2026-10-14).
 await warp(192,540,90);await command('centerview');await page.waitForTimeout(400);let s=await read();assert.equal(s.world.prompt,'','No breaker prompt before the lockdown');
 assert.equal(s.hal.breaker_shutter,0,'Shutter over the breaker is shut');await page.screenshot({path:out+'/breaker-shutter-shut.png'});
 if(s.world.tool!==0)await press('KeyT');assert.equal((await read()).world.tool,0,'Wrench in hand');
 await press('Space');await strike(2);await page.waitForTimeout(600);s=await read();assert.equal(s.hal.evacuating,0);assert.equal(s.hal.levers,31);assert.equal(s.hal.reboot_pulls,0);
 assert.equal(s.hal.breaker_glass,0,'The wrench cannot reach the glass through the shutter');
 report.cases.push('Breaker is hidden behind its shutter and inert until the group is locked in');
 report.final=await read();assert.deepEqual(report.errors,[]);
 assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Integer value expected|Execution could not continue/.test(l))),[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure?.slice(0,1500)}));if(!report.passed)process.exitCode=1;
