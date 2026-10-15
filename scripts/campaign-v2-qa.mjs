import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='output/campaign-v2/qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const read=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
const wait=async test=>{await page.waitForFunction(test,null,{timeout:55000});assert.notEqual((await read()).mode,'error',JSON.stringify(await read()));};
async function command(text){await page.keyboard.press('Backquote');await page.waitForTimeout(300);await page.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await page.keyboard.press('Enter');await page.waitForTimeout(300);await page.keyboard.press('Backquote');await page.waitForTimeout(400);}
const report={cases:[],errors};
try{
await page.goto(process.env.DOOM_URL||'http://127.0.0.1:5198/');await startGame(page);await wait(()=>['playing','error'].includes(window.__DOOM_DEBUG__.state.mode));await page.waitForTimeout(1500);
report.initial=await read();assert.equal(report.initial.world.people[0].name,process.env.DOOM_URL?.includes('hal-station')?'Rob Miles':'Liron Shapira');assert.equal(report.initial.world.cameras_total,9);report.cases.push('native boot and cast');
await page.screenshot({path:out+'/current-level.png'});
if(process.env.QA_BOOT_ONLY!=='1'){
 await command('warp -448 2016');await page.keyboard.press('KeyE');await page.waitForTimeout(300);assert.equal((await read()).world.book,1);report.cases.push('textbook pickup');
}
report.final=await read();report.engineErrors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
assert.deepEqual(errors,[]);assert.deepEqual(report.engineErrors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,failure:report.failure,cases:report.cases}));if(!report.passed)process.exitCode=1;
