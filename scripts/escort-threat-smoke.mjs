import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const out='output/escort-threat';await fs.mkdir(out,{recursive:true});
execFileSync('python3',['scripts/build-escort-qa.py',out+'/qa.pk3']);
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']}),p=await b.newPage({viewport:{width:1280,height:800}}),q=nativeQA(p);
const report={cases:[],errors:[],methodology:'Private native encounter setup; actual escort navigation, speed, collisions and regrouping run under normal AI ticks. No public score writes.'};
p.on('pageerror',e=>report.errors.push(String(e)));
const shot=name=>p.screenshot({path:out+'/'+name+'.png'});
const probe=()=>p.evaluate(()=>JSON.parse(__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_THREAT ')).at(-1).slice(13)));
async function sample(ms){const trace=[],end=Date.now()+ms;while(Date.now()<end){trace.push((await q.read()).world);await p.waitForTimeout(100);}return trace;}
try{
 await p.route('**/pdoom.pk3',r=>r.fulfill({path:out+'/qa.pk3'}));
 await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await p.goto('http://127.0.0.1:5198/');
 await Promise.race([startGame(p),p.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='error',{},{timeout:65000}).then(()=>{throw Error('Native boot failed');})]);
 await q.wait(s=>s.world?.ticks>35,'Boot',60000);await q.command('god');
 await q.command('netevent pdoom_qa_shortcut');assert.deepEqual(await probe(),{panels:1});
 await q.warp(-904,-288,90);await q.command('centerview');await shot('cell-door-latch');
 await q.warp(-944,-280,90);assert.equal((await q.read()).world.prompt,'SPACE - open cell door');await q.press('KeyE');
 await q.wait(s=>s.world.people[2].released===1&&s.sam.clearance===56,'Single latch releases person and shortcut');assert.equal((await q.read()).world.prompt,'Cell door open');await shot('cell-shortcut-open');
 report.cases.push({name:'One cell panel, CELL DOOR latch (prompt + confirmation), full-height shortcut',passed:true});
 let runId=(await q.read()).run.runId;await q.press('F5');await q.wait(s=>s.run.runId!==runId&&s.world?.ticks>35,'Fresh threat fixture',45000);await q.command('god');
 await q.command('netevent pdoom_qa_flee');await q.wait(s=>[0,2].every(i=>s.world.people[i].fleeing===1),'Both escorts evade');
 const flee=await sample(1800);report.flee=flee;
 for(const [i,x0]of [[0,1960],[2,2016]]){
  const poses=flee.map(w=>({t:w.ticks,h:w.people[i],hunter:[w.hunter_x,w.hunter_y]}));
  assert.ok(poses.some(({h})=>h.x>x0+35),'Retreat away from player/Terminator '+i);
  assert.ok(poses.every(({h})=>h.alive&&h.health===100),'No body loss '+i);
  const speeds=poses.slice(1).map((v,j)=>Math.hypot(v.h.x-poses[j].h.x,v.h.y-poses[j].h.y)/Math.max(1,v.t-poses[j].t));
  assert.ok(Math.max(...speeds)>5.5,'Actual sprint is faster than 4.2 walking '+i);
  assert.ok(speeds.every(v=>v<=7.2),'Native movement remains bounded '+i);
 }
 await q.face(0);await shot('prisoners-sprinting');report.cases.push({name:'Multiple escorts break follow direction and sprint away without collisions or teleporting',passed:true});
 await q.command('netevent pdoom_qa_flee_clear');await q.wait(s=>[0,2].every(i=>s.world.people[i].fleeing===0),'Regroup after danger');
 let before=(await q.read()).world;await p.waitForTimeout(1600);let after=(await q.read()).world;
 for(const i of [0,2])assert.ok(Math.hypot(after.people[i].x-after.x,after.people[i].y-after.y)<Math.hypot(before.people[i].x-before.x,before.people[i].y-before.y)-30,'Returns to player '+i);
 report.cases.push({name:'Escorts resume following once danger clears',passed:true});
 await q.command('netevent pdoom_qa_flee_refuge');await p.waitForTimeout(900);let safe=(await q.read()).world.people[3];
 assert.equal(safe.fleeing,0);assert.equal(safe.sheltered,1);assert.equal(safe.holding,1);assert.ok(Math.hypot(safe.x-1072,safe.y-880)<25);
 report.cases.push({name:'Safe refuge residents keep bounded idle movement',passed:true});
 await q.command('netevent pdoom_qa_flee_wall');assert.equal((await probe()).visible,0);const wall=await sample(1300);report.wall=wall;
 assert.ok(wall.every(w=>w.people[0].fleeing===0&&w.people[2].fleeing===0),'No panic through sealed walls or for captives');
 await shot('wall-separated-encounter');report.cases.push({name:'Sealed walls and captive protection prevent spurious panic',passed:true});
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(await p.evaluate(()=>__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown identifier/.test(l))),[]);
 report.passed=true;
}catch(e){report.failure=String(e);report.final=await q.read().catch(()=>null);report.logs=await p.evaluate(()=>__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
