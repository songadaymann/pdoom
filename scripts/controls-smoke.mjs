// Controls after the 2026-10-10 simplification: doors open when you walk into
// them, Space uses things, click/Ctrl swings, low ducts crouch you, and the
// first seconds of a level stay quiet. Real keyboard input; warps only place us.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/';
const out=process.env.DOOM_OUT||'output/controls/local';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};
async function level(url,consoleKeys=true){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto(url);await startGame(page,{console:consoleKeys});
 const qa=nativeQA(page);await qa.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Native ready',60000);
 return {page,qa};
}
const engineErrors=page=>page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
let page;
try{
 // Fresh level 1, no console: record every line shown in the first 15 seconds.
 ({page}=await level(base,false));let qa=nativeQA(page);
 const shown=new Set();const start=Date.now();
 while(Date.now()-start<15000){const s=await qa.read();if(s.world.message)shown.add('status:'+s.world.message);if(s.dialogue?.remaining>0)shown.add(s.dialogue.speaker+':'+s.dialogue.text);await page.waitForTimeout(150);}
 report.openingLines=[...shown];
 assert.ok(report.openingLines.length<=1,'At most one line in the first 15 s: '+report.openingLines.join(' | '));
 assert.ok(!report.openingLines.some(l=>/CAMERA REPORT|FIND THE FIVE|Heavy footsteps/.test(l)),'No camera bark or duplicated objective');
 report.cases.push('Opening 15 s: '+(report.openingLines.join(' | ')||'no lines'));
 // Space picks up the shelf wrench, like Doom's use key.
 await qa.face(90);await qa.press('Space');await qa.wait(s=>s.world.wrench===1,'Space picks up the wrench');
 report.cases.push('Space uses/picks up');
 // The starting door opens by walking into it; no prompt is shown there.
 await qa.face(180);await page.keyboard.down('KeyW');await page.waitForTimeout(700);
 const atDoor=await qa.read();assert.equal(atDoor.world.prompt,'','No door prompt');
 await page.waitForTimeout(1800);await page.keyboard.up('KeyW');
 const through=await qa.read();assert.ok(through.world.x<1840,'Walked through the starting door at x='+through.world.x);
 await page.screenshot({path:out+'/through-start-door.png'});report.cases.push('Starting door opens on contact, no E and no prompt');
 assert.deepEqual(await engineErrors(page),[]);await page.close();

 // Level 1 with QA console placement.
 ({page,qa}=await level(base));
 await qa.command('god');
 await qa.face(90);await qa.press('Space');await qa.wait(s=>s.world.wrench===1,'Wrench');
 await qa.warp(1948,1144,90);await qa.press('Control');await qa.wait(s=>s.world.cameras_broken===1,'Ctrl swings the wrench at the start camera');
 assert.doesNotMatch((await qa.read()).world.message,/camera/i,'Camera destruction needs no caption');
 report.cases.push('Ctrl (Doom fire key) swings the wrench; no camera caption');
 // Low ducts: plain walking ducks into them, and you stand again outside.
 // Liron's is the one crawlspace left in level 1 (single-route-smoke checks the others are gone).
 for(const [x,y,angle,pass,label] of [[1744,960,0,s=>s.world.x>1800,'Liron service duct']]){
  await qa.warp(x,y,angle);const before=await qa.read();assert.equal(before.world.crouch,1,'Standing before '+label);
  await qa.hold('w',1400);const inside=await qa.read();
  assert.ok(pass(inside),`${label}: entered by walking (x=${inside.world.x}, y=${inside.world.y})`);assert.ok(inside.world.crouch<.75,label+': crouched automatically');
  await page.screenshot({path:out+'/duct-'+label.split(' ')[0].toLowerCase()+'.png'});
  report.cases.push(label+': walked in, auto-crouched to '+inside.world.crouch);
 }
 await qa.warp(1500,800,180);await qa.wait(s=>s.world.crouch===1,'Standing again in open space');
 report.cases.push('Stands back up in open space');
 // Space uses a switch: Holly's bridge power feed.
 await qa.warp(-1088,1496,90);await qa.press('Space');await qa.wait(s=>s.holly.powered===1,'Space throws the power switch');
 report.cases.push('Space throws switches');
 // The refuge bulkhead opens as you walk up to it.
 await qa.warp(1320,800,180);assert.equal((await qa.read()).world.refuge_open,0);
 await qa.hold('w',1600);const refuge=await qa.read();assert.equal(refuge.world.in_refuge,1,'Walked into the refuge at x='+refuge.world.x);
 report.cases.push('Refuge bulkhead opens on approach');
 assert.deepEqual(await engineErrors(page),[]);await page.close();

 // Level 2: HAL's corridor doors open on approach unless HAL holds them.
 ({page,qa}=await level(base+'?level=hal-station&ceo=altman'));
 await qa.wait(s=>s.doors,'Door report');await qa.command('god');
 const door=s=>s.doors.panels.filter(p=>p.door===1);
 await qa.warp(-300,-832,0);assert.ok(door(await qa.read()).every(p=>p.clearance<56),'HAL door 1 starts closed');
 await qa.hold('w',1200);await qa.wait(s=>door(s).every(p=>p.clearance>=56),'HAL door opens on approach');
 assert.equal((await qa.read()).world.prompt,'','No open-door prompt');
 await page.screenshot({path:out+'/hal-door-open.png'});report.cases.push('HAL corridor door opens on approach, no prompt');
 assert.deepEqual(await engineErrors(page),[]);
 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log('Controls smoke: PASS\n - '+report.cases.join('\n - '));
}catch(e){
 report.passed=false;report.error=String(e.stack||e);
 report.state=await page?.evaluate(()=>window.render_game_to_text()).catch(()=>null);
 await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.error);process.exitCode=1;
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
