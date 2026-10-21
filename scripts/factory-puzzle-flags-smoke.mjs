// Boots the factory once per ?puzzle= flag (loopback development only) and checks the
// player starts beside that puzzle with the wrench and slingshot and can walk; captures the arrival.
// node scripts/factory-puzzle-flags-smoke.mjs   (PUZZLES=zvi,paul to limit)
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/puzzle-flags';await fs.mkdir(out,{recursive:true});
const SPOTS={zvi:[712,1890],victoria:[480,770],max:[1290,900],paul:[1712,-224],ajeya:[3264,-150],breakroom:[1250,1700]};
const only=process.env.PUZZLES?.split(',');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};
try{
 for(const [name,[x,y]] of Object.entries(SPOTS)){
  if(only&&!only.includes(name))continue;
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>report.errors.push(`${name}: ${e}`));
  await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  const {read,wait,hold}=nativeQA(page);
  await page.goto(`http://127.0.0.1:5198/?level=meg3n-factory&puzzle=${name}`);await startGame(page,{console:false});
  const s=await wait(s=>s.mode==='playing'&&s.factory&&s.world&&Math.hypot(s.world.x-x,s.world.y-y)<24,`${name} start spot`,60000);
  assert.equal(s.world.wrench,1,`${name} starts with the wrench`);assert.equal(s.world.gun,1,`${name} starts with the slingshot`);
  await page.waitForTimeout(2600);
  const now=await read();
  // Real input: the start spot must leave room to walk (a spot inside a wall's radius pins you).
  const step=async key=>{const from=await read();await hold(key,600);const to=await read();return Math.hypot(to.world.x-from.world.x,to.world.y-from.world.y);};
  const forward=await step('KeyW'),back=await step('KeyS');
  assert.ok(forward>8||back>8,`${name}: player can move from the start spot (forward ${forward.toFixed(1)}, back ${back.toFixed(1)})`);
  await page.screenshot({path:`${out}/${name}.png`});
  report.cases.push({name,x:now.world.x,y:now.world.y,dialogue:now.dialogue?.remaining>0?`${now.dialogue.speaker}: ${now.dialogue.text}`:null,prompt:now.world.prompt||null,message:now.world.message||null});
  console.log(name,JSON.stringify(report.cases.at(-1)));
  await page.close();
 }
 report.passed=report.errors.length===0;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await browser.close();}
process.exit(report.passed?0:1);
