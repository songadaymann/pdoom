import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {isGameControl} from '../doom-web/game-controls.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/control-cleanup/native';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};let page,q;
async function boot(level,dev=false,allowConsole=true){
 page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{window.__QA_INPUTS__=[];const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}postMessage(m,...a){if(m.type==='input')window.__QA_INPUTS__.push({type:m.evType,code:m.init?.code});return super.postMessage(m,...a);}};});
 await page.goto('http://127.0.0.1:5198/?level='+level+'&ceo=altman'+(dev?'&dev=end':''));await startGame(page,{console:allowConsole});q=nativeQA(page);
 await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Native boot',55000);
}
const shot=async n=>page.screenshot({path:out+'/'+n+'.png'});
const engineErrors=()=>page.evaluate(()=>__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown key|Unknown identifier|Execution could not continue/.test(l)));
async function hoverVisible(){
 const hit=await page.evaluate(async()=>{
  const {nativePersonRects}=await import('/person-label.js'),s=JSON.parse(render_game_to_text()),r=document.querySelector('#canvas').getBoundingClientRect();
  const v=nativePersonRects(s.world,s.escape?.view_height).find(v=>Math.abs((v.left+v.right)/2)<.9&&Math.abs((v.bottom+v.top)/2)<.8);
  if(!v)return null;return {name:v.name,x:r.left+(1+(v.left+v.right)/2)*r.width/2,y:r.top+(1-(v.bottom+v.top)/2)*r.height/2};
 });assert.ok(hit,'Visible person inside the view');await page.mouse.move(hit.x,hit.y);
 await q.wait(s=>s.personLabel.name===hit.name,'Cursor name '+hit.name);return hit;
}
try{
 await boot('hal-station',false,false);const before=await q.read(),booted=await page.evaluate(()=>__QA_INPUTS__.length);
 for(const key of ['Backquote','Shift+Backquote','F1','F2','F3','F4','F6','F7','F8','F9','F10','F11','F12','Tab','Pause'])await page.keyboard.press(key);
 await page.keyboard.type('idclev21');await page.waitForTimeout(350);
 let s=await q.read();assert.equal(s.world.map,'E1M7');assert.equal(s.mode,'playing');assert.equal(s.uiBlocked,false);assert.equal(s.run.practiceReason,'');assert.ok(s.world.ticks>before.world.ticks);
 // Boot's only blocked key is main.js releasing the native loading gate with one F4 tap.
 // Everything the player typed afterwards must be a game control (isGameControl).
 const [startup,typed]=await page.evaluate(n=>[__QA_INPUTS__.slice(0,n),__QA_INPUTS__.slice(n)],booted),blocked=e=>e.code==='Backquote'||e.code==='Tab'||/^F(?:[1-4]|[6-9]|1[0-2])$/.test(e.code);
 assert.deepEqual(startup.filter(blocked),[{type:'keydown',code:'F4'},{type:'keyup',code:'F4'}]);
 assert.deepEqual(typed.filter(e=>e.code&&!isGameControl(e.code)),[]);assert.ok(typed.some(e=>e.code==='KeyD'),'Typed game keys reached the engine');
 report.cases.push('Playable controls block console, Doom menus, automap, level keys and cheats');await shot('clean-game-controls');
 await page.keyboard.press('Escape');await q.wait(s=>s.gamePaused&&s.uiBlocked,'Our pause menu');await page.waitForTimeout(300);const paused=(await q.read()).world.ticks;await page.waitForTimeout(700);assert.equal((await q.read()).world.ticks,paused);await shot('our-pause-menu');
 await page.keyboard.press('Escape');await q.wait(s=>!s.uiBlocked&&s.world.ticks>paused,'Escape resumes');
 await page.keyboard.press('Escape');await page.click('#menu-restart');await page.click('#menu-confirm');await q.wait(s=>s.run.runId!==before.run.runId&&!s.uiBlocked,'Restart from our menu');assert.equal((await q.read()).world.map,'E1M7');report.cases.push('Escape pauses native time, resumes and restarts the current game level');assert.deepEqual(await engineErrors(),[]);await page.close();
 await boot('hal-station');await q.command('god');
 await q.warp(-384,-64,0);await page.mouse.move(640,400);assert.equal((await q.read()).world.people[0].visible,0);assert.equal((await q.read()).personLabel.name,null);report.cases.push('Names do not reveal Rob through his closed cell wall');
 for(const [x,y] of [[32,-736],[-1488,64],[-1184,-2320],[1248,-2048]]){await q.warp(x,y+16,270);await q.press('KeyE');}
 await q.warp(192,-1232,0);await q.command('centerview');await shot('evaluation-front');
 const sign=(await q.read()).evaluationSign;assert.equal(sign.z,sign.floor);assert.equal(sign.height,80);assert.equal(sign.fixed,1);assert.equal(sign.faces,4);
 await q.warp(400,-1216,190);await shot('evaluation-oblique');await q.face(170);s=await q.read();assert.equal(s.evaluationSign.angle,sign.angle);assert.equal(s.evaluationSign.x,sign.x);assert.equal(s.evaluationSign.y,sign.y);
 report.cases.push('Portable board rests on the floor with four fixed faces before pickup');assert.deepEqual(await engineErrors(),[]);await page.close();
 for(const level of ['five-prisons','hal-station']){
  await boot(level,true);await q.command('god');
  await q.warp(level==='hal-station'?160:1008,level==='hal-station'?400:736,90);await q.command('centerview');await hoverVisible();await shot(level+'-cursor-name');
  await page.mouse.move(12,100);assert.equal((await q.read()).personLabel.name,null);
  // Centre the aim on one actual person, then use the locked crosshair.
  s=await q.read();const person=s.world.people[level==='hal-station'?1:0];await q.face(Math.atan2(person.y-s.world.y,person.x-s.world.x)*180/Math.PI);await q.command('centerview');
  await page.click('#canvas');await q.wait(s=>!!s.personLabel.name,'Crosshair name');await shot(level+'-crosshair-name');
  await page.keyboard.press('Escape');assert.equal((await q.read()).personLabel.name,null);await page.keyboard.press('Escape');
  report.cases.push(level+': cursor and locked crosshair show names; moving away and pausing hide them');assert.deepEqual(await engineErrors(),[]);await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await q?.read().catch(()=>null);report.logs=await page?.evaluate(()=>__DOOM_DEBUG__.logs.slice(-25)).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
