import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {wallApproaches} from './wall-qa-helpers.mjs';
const {map,approach}=await wallApproaches('checkpoint');
const out='output/rescue-redesign';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],methodology:'Native player fixtures use console warps and god mode; actual use, traversal, floor motion, and escort exits use normal gameplay. No public score writes.'};
const selected=process.env.DOOM_CASES?.split(',');
async function run(name,level,test){
 if(selected&&!selected.includes(name))return;
 const c=await browser.newContext({viewport:{width:1280,height:800}}),p=await c.newPage(),d={name,passed:false,errors:[]};
 const qa=nativeQA(p),shot=label=>p.screenshot({path:`${out}/${name}-${label}.png`});
 try{
  p.on('pageerror',e=>d.errors.push(String(e)));
  await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await p.goto('http://127.0.0.1:5198/?level='+level);await startGame(p);await qa.wait(s=>s.world?.ticks>35,'Boot',55000);await qa.command('god');
  await test(p,qa,d,shot);
  d.final=await qa.read();d.engineErrors=await p.evaluate(()=>__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown identifier/.test(l)));
  assert.deepEqual(d.engineErrors,[]);assert.deepEqual(d.errors,[]);d.passed=true;
 }catch(e){d.failure=String(e);d.final=await qa.read().catch(()=>null);d.logs=await p.evaluate(()=>__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
 finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure.slice(0,450)));}
}
async function axis(p,qa,axis,target){
 await qa.face(90);
 for(let i=0;i<90;i++){
  const s=await qa.read(),delta=target-s.world[axis];if(Math.abs(delta)<6)return;
  const key=axis==='x'?(delta>0?'KeyD':'KeyA'):(delta>0?'KeyW':'KeyS');
  await qa.hold(key,Math.max(28,Math.min(250,Math.abs(delta)*6)));
 }
 throw Error('Traversal '+axis+' '+target);
}
try{
 await run('holly-powered-bridge','five-prisons',async(p,q,d,shot)=>{
  // Liron is always freed first in play (the start bulkheads stay shut until he is); a guide freed before him
  // has no path to the refuge. Free him by his only route: the inside release.
  await q.warp(...approach(map.wall_mounts.find(m=>m.type===15105),48));await q.press('Space');await q.wait(s=>s.world.people[0].released===1,'Liron inside release');
  await q.warp(-976,1904,90);await q.press('KeyE');assert.equal((await q.read()).holly.powered,0);assert.equal((await q.read()).world.people[4].released,0);await shot('no-power');
  await q.warp(-1088,1496,90);await q.press('KeyE');await q.wait(s=>s.holly.powered===1,'Feed powers control');
  assert.equal((await q.read()).holly.bridge_up,0);assert.equal((await q.read()).world.people[1].released,0);assert.equal((await q.read()).world.people[4].released,0);await shot('power-feed');
  await q.warp(-704,1888,180);await axis(p,q,'x',-976);await q.face(90);await q.press('KeyE');
  await q.wait(s=>s.holly.bridge_height===192&&s.world.people[4].released===1,'Bridge and gate',12000);
  assert.equal((await q.read()).world.people[4].route,'powered-bridge');assert.equal((await q.read()).world.people[1].released,0);await shot('bridge-raised');
  // Camera 6 watches the bridge control and calls the INFERMINATOR onto the bridge, where Holly (correctly)
  // keeps fleeing from it. Park it at the far refuge gate so this case checks the walk-out itself.
  await q.command('netevent pdoom_test_hunter_at_gate');
  await axis(p,q,'x',-1376);await q.wait(s=>s.world.people[4].clear===1&&s.world.people[4].x>-1432,'Holly leaves cell',20000);
  for(const x of [-1216,-1072,-976]){await axis(p,q,'x',x);await q.wait(s=>s.world.people[4].x>x-180,'Holly follows across bridge',15000);}
  d.crossing=await q.read();await shot('escort');
 });
 await run('holly-crawl-closed','five-prisons',async(p,q,d,shot)=>{
  // Single-route redesign: the stair crawl and the inside gate/bridge controls are gone.
  assert.ok(!map.wall_mounts.some(m=>[15152,15153].includes(m.type)),'No inside gate/bridge controls');
  await q.warp(-1408,1504,180);await q.hold('KeyW',1400);assert.ok((await q.read()).world.x>-1440,'Walking finds no crawl');
  await p.keyboard.down('KeyC');await q.hold('KeyW',1400);await p.keyboard.up('KeyC');
  const s=await q.read();assert.ok(s.world.x>-1440,'Crouching finds no crawl (x='+s.world.x+')');assert.equal(s.world.people[4].released,0);await shot('no-crawl');
 });
 await run('cave-power-feed','five-prisons',async(p,q,d,shot)=>{
  await q.warp(2032,1120,90);await q.press('KeyE');await q.wait(s=>s.world.wrench===1,'Wrench');
  await q.warp(-920,-160,0);await shot('extended-cable');
  // Traverse the curved cave with keyboard movement. The distant box cannot
  // be activated from the old junction's position.
  await q.press('KeyE');assert.equal((await q.read()).sam.opened,0);
  for(const [a,t] of [['x',-904],['y',0],['x',-920],['y',64],['x',-936],['y',112],['x',-960],['y',192],['x',-936],['y',256],['x',-912],['y',320],['x',-896],['y',384],['y',528],['x',-904]])await axis(p,q,a,t);
  await q.face(90);await shot('deep-junction');await q.press('KeyE');assert.equal((await q.read()).sam.opened,0);
  await q.press('Control');await q.wait(s=>s.sam.power_cut===1&&s.sam.clearance===56,'Junction hit');assert.equal((await q.read()).world.people[2].released,0);await shot('junction-broken');
 });
 for(const level of ['five-prisons','hal-station'])await run('breach-plate-'+level,level,async(p,q,d,shot)=>{
  const hal=level==='hal-station';await q.warp(hal?1000:-1088,hal?-1940:688,hal?90:270);await q.press('KeyE');await q.wait(s=>s.world.charge===1,'Charge');
  await q.warp(hal?1504:-1408,hal?-2440:1120,hal?90:180);await q.press('KeyE');await q.wait(s=>s.world.fuse>0,'Fuse');
  await q.warp(hal?1504:-1344,hal?-2600:1264,hal?90:270);await q.wait(s=>s.world.people[3].released===1,'Breach');
  assert.equal((await q.read()).breach.markers,0,'No surviving placement plates');await shot('opening');
 });
}finally{await browser.close();report.passed=report.cases.length>0&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
