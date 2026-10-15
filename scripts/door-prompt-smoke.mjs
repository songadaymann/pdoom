import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const url=process.env.DOOM_URL||'http://127.0.0.1:5198/';
const out=process.env.DOOM_OUT||'output/door-prompt/local';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],report={url,method:'Fresh public New Game, real keyboard movement only (W + arrows); no use key, no console or warps.'};
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(url);await startGame(page,{console:false});const qa=nativeQA(page);
 await qa.wait(s=>s.world?.ticks>35,'Native ready');report.start=(await qa.read()).world;
 assert.equal(report.start.map,'E1M4');assert.equal(report.start.x,2032);
 // Walk straight into the closed starting door holding only W: the bump opens it, no prompt ever shows.
 await qa.face(180);await qa.wait(s=>!s.uiBlocked,'Cinematic finished');
 const trace=[];await page.keyboard.down('KeyW');const t0=Date.now();
 while(Date.now()-t0<3500){const w=(await qa.read()).world;trace.push({t:Date.now()-t0,x:w.x,prompt:w.prompt,shown:await page.locator('#prompt').isVisible()});if(w.x<1800)break;await page.waitForTimeout(80);}
 await page.keyboard.up('KeyW');report.trace=trace;
 report.contact=trace.find(p=>p.x<1900);assert.ok(report.contact,'Reached the starting door');
 report.held=trace.filter(p=>p.x>=1856&&p.x<1880).length;assert.ok(report.held>0,'Closed door stopped the player at x~1856-1880 before opening');
 assert.deepEqual([...new Set(trace.map(p=>p.prompt))],[''],'No door prompt at any point');
 assert.ok(trace.every(p=>!p.shown),'Prompt element never shown');
 await page.screenshot({path:out+'/door-contact.png'});
 await qa.hold('w',800);report.exited=(await qa.read()).world;
 assert.ok(report.exited.x<1840,'Walking into the door opens it and the player walks through both sides of the starting doorway');
 assert.equal(report.exited.prompt,'','No stale prompt after leaving');
 await page.screenshot({path:out+'/through-door.png'});
 report.engineErrors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
 assert.deepEqual(report.engineErrors,[]);assert.deepEqual(errors,[]);report.passed=true;
 console.log('Starting-room door opens on walk-in, no key, no prompt: PASS');
}catch(e){report.passed=false;report.error=String(e);report.state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()).catch(()=>null));report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.error);process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2)+'\n');await browser.close();}
