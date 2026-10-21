// Paul's hint waits for his room (2026-10-21), muted: the other captives call out through walls
// within 384 units, but Paul's "Reward it when it does something useful..." only plays once you
// are in his room (Factory.zs InPaulRoom), not from the corridor north of it.
// node scripts/factory-hints-smoke.mjs
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/hints';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};const record=text=>{report.cases.push(text);console.log(text);};
page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,warp,command}=nativeQA(page);
const paulSpoke=s=>s.dialogue?.voice==='paul-hint'||s.voiceOver?.played?.includes('paul-hint');
try{
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory');await startGame(page);
 await wait(s=>s.mode==='playing'&&s.factory&&s.world?.ticks>70,'Factory boot',90000);
 await command('god');await command('notarget');
 // North of his room, 250 units from Paul, through the wall: no hint.
 await warp(1712,16,270);
 for(let i=0;i<16;i++){assert.ok(!paulSpoke(await read()),'Paul stays quiet outside his room');await page.waitForTimeout(250);}
 await page.screenshot({path:`${out}/1-outside.png`});
 record('Outside Paul\'s room, within earshot through the wall: no hint for 4 s');
 // In the room: the hint.
 await warp(1900,-224,180);
 const s=await wait(s=>s.dialogue?.voice==='paul-hint','Paul\'s hint in his room',20000);
 await page.screenshot({path:`${out}/2-inside.png`});
 record(`In his room: "${s.dialogue.text}"`);
 report.passed=report.errors.length===0;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await browser.close();}
process.exit(report.passed?0:1);
