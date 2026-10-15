import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out=process.env.DOOM_OUT||'output/first-rescue-intro/native',url=process.env.DOOM_URL||'http://127.0.0.1:5198/';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']}),p=await b.newPage({viewport:{width:1280,height:800}}),report={url,cases:[],errors:[],method:'Real native Space/E use, Ctrl attack, movement; private console positions for gate checks and following guide. No gameplay unlock fixtures.'};p.on('pageerror',e=>report.errors.push(String(e)));await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}}});const q=nativeQA(p);const shot=n=>p.screenshot({path:out+'/'+n+'.png'});
try{
 await p.goto(url);await startGame(p);await q.wait(s=>s.intro,'Intro native boot');let s=await q.read();assert.deepEqual(s.intro,{opened:0,north:0,south:0,service:0});assert.equal(s.world.gun,0);report.cases.push('Fresh visit: all exit shutters closed; no starting gun');
 await q.face(90);await q.press('e');await q.wait(s=>s.world.wrench===1,'Wrench available');
 for(const[y,k]of[[1152,'north'],[800,'south'],[448,'service']]){
  await q.warp(1440,y,180);await q.hold('w',650);s=await q.read();assert.ok(s.world.x>=1423);assert.match(s.world.prompt,/Bulkhead sealed/);await q.press('Space');await q.press('Control');await q.wait(s=>s.intro[k]===0,'Use (Space) and attack (Ctrl) cannot open interlock');assert.equal((await q.read()).world.released,0);await shot(k+'-sealed');
 }
 // Camera noise must not let the hunter operate quarantine shutters.
 await q.warp(1948,1144,90);await q.press('Control');await q.wait(s=>s.world.camera_broken===1,'Starter camera melee');await p.waitForTimeout(2000);s=await q.read();assert.equal(s.intro.opened,0);assert.equal(s.world.gun,0);assert.equal(s.world.ammo,0);await shot('camera-broken-before-rescue');report.cases.push('Wrench/camera works while quarantine remains physically sealed');
 // Operate the same inside release reached by the separately verified full crawl.
 await q.warp(1940,968,90);const map=JSON.parse(await fs.readFile('output/checkpoint/map-debug.json','utf8'));const panel=map.wall_mounts.find(p=>p.type===15105&&p.site===0)||map.wall_mounts.find(p=>p.type===15105);
 await q.face(Math.atan2(panel.y-968,panel.x-1940)*180/Math.PI);await q.press('e');await q.wait(s=>s.world.people[0].released,'Real inside release');await q.wait(s=>/ Follow me\.$/.test(s.dialogue?.text||''),'Released guide quip ends with Follow me.',12000);await q.wait(s=>s.intro.opened&&s.intro.north>=56&&s.intro.south>=56&&s.intro.service>=56,'All rescue-linked bulkheads open');await q.wait(s=>!s.uiBlocked,'Rescue card ends',12000);assert.equal((await q.read()).world.gun,0);assert.equal((await q.read()).world.guide,1);assert.equal((await q.read()).world.people[0].route,'service','Inside release is the only route');await shot('rescue-opens-corridors');report.cases.push('Inside E release opens both main doors and service bypass; Liron is guide without bullets; his quip ends Follow me.');
 await q.warp(1440,1152,180);await q.hold('w',900);assert.ok((await q.read()).world.x<1392,'Player traverses newly released northern bulkhead');
 // Stay close to the guide while he walks the actual graph/doors to the refuge.
 const trace=[];for(let i=0;i<60;i++){
  s=await q.read();const person=s.world.people[0];trace.push({x:person.x,y:person.y,sheltered:person.sheltered});if(person.sheltered)break;
  await q.warp(Math.round(person.x),Math.round(person.y));await p.waitForTimeout(500);
 }
 s=await q.read();report.guideTrace=trace;assert.equal(s.world.people[0].sheltered,1,'Guide reaches refuge across new bulkheads');
 await q.warp(Math.round(s.world.people[0].x),Math.round(s.world.people[0].y));await q.wait(s=>s.world.refuge_known===1,'Player follows guide into refuge');await shot('guided-refuge');report.cases.push('Guide crosses opened interlocks and automatically stays in refuge');
 await q.warp(832,1528,90);await q.press('e');await q.wait(s=>s.world.gun===1&&s.world.ammo===3,'Gun in later gallery');await shot('gun-after-first-rescue');report.cases.push('Gun remains available later; pickup explains limited stun rounds');
 report.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));assert.deepEqual(report.engineErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=String(e);report.state=await q.read().catch(()=>null);report.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}console.log(JSON.stringify({passed:report.passed,cases:report.cases,error:report.error}));
