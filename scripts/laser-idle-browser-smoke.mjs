import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/laser-idle/qa',url=process.env.DOOM_URL||'http://127.0.0.1:5198/?level=rescue';
await fs.mkdir(out,{recursive:true});
const selected=process.env.DOOM_CASES?.split(',');
const report={url,modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:{natural:'Real keyboard input with normal hunter, no warps.',fixtures:'Native console warps set up player positions. One unbound native QA event places the real hunter at the refuge gate; normal targeting, damage, collision and movement stay active. Companions always walk.',touch:'Chrome portrait and landscape touch emulation, not a physical-phone certification.'}};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
const world=async p=>(await read(p)).world;
async function waitWorld(p,test,label,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){const r=await read(p);assert.notEqual(r.mode,'error',r.error);if(test(r.world,r))return r.world;await p.waitForTimeout(70);}throw Error(label+': '+JSON.stringify(await read(p)));}
async function press(p,key){await p.keyboard.press(key,{delay:80});await p.waitForTimeout(230);}
async function face(p,angle){for(let i=0;i<16;i++){const w=await world(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}throw Error('Facing '+angle+' failed');}
// Traverse the crawl with native movement, stopping at bends to inspect discovery.
async function crawlAxis(p,axis,target){
 await face(p,90);
 for(let i=0;i<65;i++){
  const w=await world(p),delta=target-w[axis];
  if(Math.abs(delta)<6)return w;
  const key=axis==='x'?(delta>0?'KeyD':'KeyA'):(delta>0?'KeyW':'KeyS');
  await p.keyboard.down(key);await p.waitForTimeout(Math.min(450,Math.max(28,Math.abs(delta)*9)));
  await p.keyboard.up(key);await p.waitForTimeout(160);
 }
 throw Error('Crawl movement '+axis+' to '+target+': '+JSON.stringify(await world(p)));
}
async function lookAtPerson(p,index=0){for(let i=0;i<8;i++){const w=await world(p),h=w.people[index];await face(p,(Math.atan2(h.y-w.y,h.x-w.x)*180/Math.PI+360)%360);await p.waitForTimeout(180);if((await world(p)).order_target===index)return;}throw Error('Local order target '+index+': '+JSON.stringify(await world(p)));}
async function command(p,text){await waitWorld(p,w=>w.ticks>35,'Console input warmup');await p.keyboard.press('Backquote');await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);}
async function warp(p,x,y,d,angle){(d.warps??=[]).push({x,y});await command(p,`warp ${x} ${y}`);await waitWorld(p,w=>Math.hypot(w.x-x,w.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function run(name,options,test){if(selected&&!selected.includes(name))return;const d={name,passed:false,errors:[]},c=await browser.newContext(options);let p;try{p=await c.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(name==='refuge-idle-and-recall'?'http://127.0.0.1:5198/?dev=end':url);await p.click('#start');await p.waitForFunction(()=>['playing','error'].includes(window.__DOOM_DEBUG__?.state.mode),{},{timeout:55000});assert.equal((await read(p)).mode,'playing',JSON.stringify(await read(p)));await waitWorld(p,w=>w?.level==='first-rescue','Current checkpoint');d.initial=await read(p);assert.equal(d.initial.world.freed,name==='refuge-idle-and-recall'?5:0);assert.equal(d.initial.world.people.length,5);assert.equal(d.initial.world.alive,6);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);if(p){d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}


try {
 await run('refuge-idle-and-recall',{viewport:{width:1280,height:800}},async(p,d)=>{
  await warp(p,832,848,d,0);
  d.samples=[];
  for(let i=0;i<90;i++){d.samples.push(await world(p));await p.waitForTimeout(150);}
  for(let i=0;i<5;i++){
   const states=d.samples.map(w=>w.people[i]);
   assert.ok(states.every(h=>h.holding===1&&h.sheltered===1), 'Refuge order retained '+i);
   assert.ok(states.every(h=>Math.hypot(h.x-h.hold_x,h.y-h.hold_y)<=33), 'Bounded idle '+i);
   assert.ok(states.some(h=>h.walking===1), 'Walks while waiting '+i);
   assert.ok(states.some(h=>h.walking===0), 'Pauses while waiting '+i);
   assert.ok(states.some(h=>Math.hypot(h.x-states[0].x,h.y-states[0].y)>4), 'Actual displacement '+i);
  }
  assert.ok(d.samples.every(w=>w.group_gathered===1&&w.alive===6),'Waiting preserves ending readiness');
  await shot(p,'idle-refuge');
  const h=(await world(p)).people[0];await warp(p,h.x-60,h.y,d);await lookAtPerson(p,0);await press(p,'KeyQ');
  await waitWorld(p,w=>w.people[0].holding===0,'Recall idle person');
  await warp(p,832,848,d);d.recalled=await waitWorld(p,w=>Math.hypot(w.people[0].x-w.people[0].hold_x,w.people[0].y-w.people[0].hold_y)>40,'Recalled human resumes following');
  assert.ok(d.recalled.people.slice(1).every(h=>h.holding===1),'Other humans retain orders');
  await shot(p,'idle-recalled');
 });
 await run('red-laser-shot',{viewport:{width:1280,height:800}},async(p,d)=>{
  await warp(p,-1104,1664,d);let w=await world(p);await face(p,(Math.atan2(w.hunter_y-w.y,w.hunter_x-w.x)*180/Math.PI+360)%360);
  if(process.env.DOOM_CHASE==='1')await command(p,'chase');
  d.aim=await waitWorld(p,w=>w.hunter_aim>=65,'Normal aiming');await shot(p,'laser-aim');
  d.hit=await waitWorld(p,w=>w.health===70&&w.hunter_lasers===1,'Laser and first wound',12000);await shot(p,'red-laser');
  d.next=await waitWorld(p,w=>w.health===40&&w.hunter_lasers===2,'Second laser uses unchanged30damage',10000);
  await warp(p,1040,848,d);d.safe=await world(p);await p.waitForTimeout(5000);d.safeLater=await world(p);
  assert.equal(d.safeLater.health,d.safe.health,'Refuge protects player');assert.equal(d.safeLater.hunter_lasers,d.safe.hunter_lasers,'No laser targets refuge');
 });
} finally {
 report.passed=report.cases.length===(selected?.length??2)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({name,passed,failure})=>({name,passed,failure}))}));process.exit(report.passed?0:1);
}
