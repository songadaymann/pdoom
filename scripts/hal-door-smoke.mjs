import {chromium} from '@playwright/test';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.DOOM_OUT||'output/hal-doors/native';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1440,height:900}});
const r={cases:[],errors:[]};page.on('pageerror',e=>r.errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const{read,wait,command,warp,press,face}=nativeQA(page);const shot=n=>page.screenshot({path:out+'/'+n+'.png'});
const panel=s=>s.doors.panels.find(p=>p.door===1);// The original exit door (1672,-2304) is no corridor door since 2026-10-11: only HAL's reboot opens it.
const centers=[[-864,-720],[-164,-832],[672,-704],[-520,344],[392,-1600],[-712,-2144]];const paired=s=>s.doors.panels.filter(p=>p.door===1);
try{
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);await wait(s=>s.mode==='playing'&&s.doors,'Door native boot',55000);await command('god');
 let s=await read();assert.equal(s.doors.panels.length,12);assert.ok(s.doors.panels.every(p=>p.wall_sprite===1));assert.ok(s.doors.next_lock_seconds>15);r.cases.push('Twelve fixed controls: both approaches to six corridor doors; initial grace');
 // The nearest control is readable at eye level and a real melee target; the door itself opens on approach.
 assert.ok(paired(s).every(p=>p.clearance<56),'Door 1 starts closed');
 await warp(-206,-845,270);await command('centerview');s=await wait(s=>panel(s).clearance>=56,'Real door opens on approach, no key');assert.equal(s.world.prompt,'','No open-door prompt');await shot('01-normal-control');
 await wait(s=>s.doors.warning===1,'HAL warning',40000);assert.ok(paired(await read()).every(p=>p.frame===3));await shot('02-amber-warning');
 await wait(s=>s.doors.locked===1&&panel(s).clearance<56,'HAL closes ONE door',6000);await press('KeyE');s=await read();assert.ok(s.doors.lock_seconds>0);assert.match(s.world.prompt,/HAL LOCK - \ds/);assert.ok(paired(s).every(p=>p.frame===1));await shot('03-red-countdown');
 await wait(s=>s.doors.locked===-1&&panel(s).clearance>=56,'Automatic six-second reopening',9000);s=await read();assert.equal(s.doors.locks,1);assert.ok(s.doors.next_lock_seconds>=20);await shot('04-automatic-reopen');r.cases.push('Approach opens the door; two-second warning, one red six-second lock, blocked use with live countdown, automatic reopening and quiet interval');
 await warp(60,-260,270);await press('KeyE');assert.ok((await read()).world.wrench);
 await warp(-206,-845,270);await command('centerview');await wait(s=>s.doors.locked===1,'Second lock after quiet interval',40000);await press('Control');s=await wait(s=>panel(s).jammed,'Wrench breaks panel during active lock');assert.equal(s.doors.locked,-1);await wait(s=>panel(s).clearance>=56,'Immediate wrench bypass opens real door');assert.ok(paired(await read()).every(p=>p.frame===2));await shot('05-broken-control');r.cases.push('One wrench hit immediately overrides active lock; both controls show permanent damage');
 // Pacification suppresses unrelated pursuit while reviewing every mounted control.
 for(const[x,y]of [[32,-736],[-1488,64],[-1184,-2320],[1248,-2048]]){await warp(x,y+16,270);await press('KeyE');}await wait(s=>s.hal.pacified===1,'Physical memory pacification');
 const all=(await read()).doors.panels;
 for(let n=0;n<all.length;n++){
  const p=all[n],a=p.angle*Math.PI/180,ax=Math.round(p.x+Math.cos(a)*38),ay=Math.round(p.y+Math.sin(a)*38);await warp(ax,ay,(p.angle+180)%360);await command('centerview');await shot('panel-'+n);s=await read();assert.equal(s.world.prompt,'',`Control ${n}: ${s.world.prompt}`);assert.equal(s.doors.panels[n].frame,p.jammed?2:0);
  // From this side, stepping up to the doorway (64u, facing it) opens the real door.
  const[cx,cy]=centers[p.door],dx=ax-cx,dy=ay-cy,l=Math.hypot(dx,dy);await warp(Math.round(cx+dx/l*64),Math.round(cy+dy/l*64),(Math.atan2(-dy,-dx)*180/Math.PI+360)%360);await wait(s=>s.doors.panels[n].clearance>=56,`Door ${p.door} opens on approach from control ${n}`,4000);
 }
 r.cases.push('Every control reachable from its own approach with no prompt; each corridor door opens when approached from that side');
 const p=all[2],a=p.angle*Math.PI/180,x=Math.round(p.x+Math.cos(a)*72-Math.sin(a)*64),y=Math.round(p.y+Math.sin(a)*72+Math.cos(a)*64);
 await warp(x,y,(Math.atan2(p.y-y,p.x-x)*180/Math.PI+360)%360);await command('centerview');await shot('08-oblique-wall-switch');
 const before=(await read()).doors.panels.map(p=>[p.x,p.y,p.z,p.angle,p.wall_sprite]);await face(((await read()).world.angle+45)%360);await shot('09-camera-turn');assert.deepEqual((await read()).doors.panels.map(p=>[p.x,p.y,p.z,p.angle,p.wall_sprite]),before);r.cases.push('Native fixed wall-sprite flag and position/angle persist through camera turns');
 await warp(-438,-170,15);await command('centerview');await shot('06-containment-cell');assert.equal((await read()).world.people[0].released,0);
 await warp(320,-1400,0);await shot('07-evaluation-cell');r.cases.push('Prisoner doors remain puzzle interlocks with distinct containment markings');
 const id=(await read()).run.runId;await press('F5');await wait(s=>s.mode==='playing'&&s.run.runId!==id,'Door reset');s=await read();assert.equal(s.doors.locked,-1);assert.equal(s.doors.locks,0);assert.ok(s.doors.panels.every(p=>!p.jammed));assert.deepEqual(r.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Integer value expected|Execution could not continue/.test(l))),[]);r.cases.push('Fresh attempt resets all locks and broken controls');r.passed=true;r.final=s;
}catch(e){r.failure=String(e);r.final=await read().catch(()=>null);r.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs?.filter(l=>!/PDOOM_/.test(l)).slice(-30));await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(r,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:r.passed,cases:r.cases,failure:r.failure}));process.exit(r.passed?0:1);
