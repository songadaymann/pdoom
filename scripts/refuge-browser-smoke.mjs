import {startGame} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/checkpoint/refuge/qa',url=process.env.DOOM_URL||'http://127.0.0.1:5198/?level=rescue';
await fs.mkdir(out,{recursive:true});
const selected=process.env.DOOM_CASES?.split(',');
const report={url,modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:{natural:'Real keyboard input with normal hunter, no warps.',fixtures:'Native console warps set up player positions. One unbound native QA event places the real hunter at the refuge gate; normal targeting, damage, collision and movement stay active. Companions always walk.',touch:'Chrome portrait and landscape touch emulation, not a physical-phone certification.'}};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
const world=async p=>(await read(p)).world;
async function waitWorld(p,test,label,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){const r=await read(p);assert.notEqual(r.mode,'error',r.error);if(test(r.world,r))return r.world;await p.waitForTimeout(70);}throw Error(label+': '+JSON.stringify(await read(p)));}
async function press(p,key){await p.keyboard.press(key,{delay:80});await p.waitForTimeout(230);}
async function face(p,angle){for(let i=0;i<16;i++){if((await read(p)).uiBlocked)await settled(p);const w=await world(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}throw Error('Facing '+angle+' failed');}
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
async function lookAtPerson(p,index=0){for(let i=0;i<8;i++){const w=await world(p),h=w.people[index];await face(p,(Math.atan2(h.y-w.y,h.x-w.x)*180/Math.PI+360)%360);await p.waitForTimeout(180);return;}throw Error('Local order target '+index+': '+JSON.stringify(await world(p)));}
// Console keys go straight to the worker (as in native-qa-helpers) so a death closing the console cannot desync the page-side toggle.
async function rawKey(p,code,key,keyCode){await p.evaluate(({code,key,keyCode})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode,which:keyCode,bubbles:true,cancelable:true}});},{code,key,keyCode});}
// A discovery card pauses the engine (uiBlocked); a console toggle sent the instant it closes can be dropped, so let the UI settle first.
async function settled(p){for(let i=0;i<30;i++){await waitWorld(p,(w,r)=>w.ticks>35&&!r.uiBlocked,'Console input warmup',15000);await p.waitForTimeout(400);if(!(await read(p)).uiBlocked)return;}throw Error('UI never settled');}
async function command(p,text){await settled(p);await rawKey(p,'Backquote','`',192);await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await rawKey(p,'Enter','Enter',13);await p.waitForTimeout(300);if(text!=='kill'){await settled(p);await rawKey(p,'Backquote','`',192);}await p.waitForTimeout(500);}
async function warp(p,x,y,d,angle){(d.warps??=[]).push({x,y});await command(p,`warp ${x} ${y}`);await waitWorld(p,w=>Math.hypot(w.x-x,w.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function run(name,options,test){if(selected&&!selected.includes(name))return;const d={name,passed:false,errors:[]},c=await browser.newContext(options);let p;try{p=await c.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await startGame(p);await p.waitForFunction(()=>['playing','error'].includes(window.__DOOM_DEBUG__?.state.mode),{},{timeout:55000});assert.equal((await read(p)).mode,'playing',JSON.stringify(await read(p)));await waitWorld(p,w=>w?.level==='first-rescue','Current checkpoint');d.initial=await read(p);assert.equal(d.initial.world.freed,0);assert.equal(d.initial.world.people.length,5);assert.equal(d.initial.world.alive,6);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);if(p){d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}

async function gun(p,d){await warp(p,832,1528,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.gun===1&&w.ammo>=3,'Gun fixture');}
// 2026-10-10: each prisoner has one route. Quick fixtures warp to that route's real control and use it.
async function wrench(p,d){await warp(p,2032,1120,d,90);await press(p,'Space');await waitWorld(p,w=>w.wrench===1,'Wrench');}
async function freeLiron(p,d){await warp(p,1936,944,d,270);await press(p,'Space');await waitWorld(p,w=>w.people[0].released===1&&w.people[0].route==='service','Liron inside release');}
async function freeEliezer(p,d){await warp(p,-904,528,d,90);await press(p,'Control');await waitWorld(p,(w,r)=>r.sam.opened===1&&r.sam.clearance===56,'Junction strike lifts rear shutter');await warp(p,-1040,-288,d,0);await crawlAxis(p,'x',-936);await face(p,150);await press(p,'Space');await waitWorld(p,w=>w.people[2].released===1,'Eliezer inside latch');}
async function freeHinton(p,d){await warp(p,-1088,688,d,270);await press(p,'Space');await waitWorld(p,w=>w.charge===1,'Charge pickup');await warp(p,-1408,1120,d,180);await press(p,'Space');await waitWorld(p,w=>w.fuse>0,'Charge planted');await p.keyboard.down('KeyD');await p.waitForTimeout(1700);await p.keyboard.up('KeyD');await waitWorld(p,w=>w.breaches===1&&w.people[3].released===1,'Blast frees Hinton',8000);}
async function freeStuart(p,d){await warp(p,-48,2020,d,270);await press(p,'Space');await waitWorld(p,w=>w.people[1].released===1,'Stuart rear breaker');}
async function freeHolly(p,d){await warp(p,-1088,1496,d,90);await press(p,'Space');await waitWorld(p,(w,r)=>r.holly.powered===1,'Bridge power');await warp(p,-976,1904,d,90);await press(p,'Space');await waitWorld(p,w=>w.people[4].released===1,'Holly over the powered bridge');}
const desktop={viewport:{width:1280,height:800}};
try {
 await run('health-healing-and-supply',{viewport:{width:1280,height:800}},async(p,d)=>{
  await warp(p,-1104,1664,d,90);
  d.firstHit=await waitWorld(p,w=>w.health===70,'First shot wounds',15000);
  await shot(p,'first-hit');
  d.secondHit=await waitWorld(p,w=>w.health===40,'Second shot wounds',10000);
  await warp(p,1760,1104,d,90);await p.keyboard.down('KeyW');await p.waitForTimeout(100);await p.keyboard.up('KeyW');d.stim=await waitWorld(p,w=>w.health===50,'Native stimpack heals10');
  await warp(p,1056,928,d,90);await p.keyboard.down('KeyW');await p.waitForTimeout(80);await p.keyboard.up('KeyW');d.med=await waitWorld(p,w=>w.health===75&&w.in_refuge===1,'Native medikit heals25 in refuge');
  await p.waitForTimeout(3500);d.safe=await world(p);await shot(p,'refuge-medical');
  assert.equal(d.safe.health,75);assert.equal(d.safe.refuge_known,1);assert.equal(d.stim.medical_left,8);assert.equal(d.med.medical_left,7);await warp(p,1008,928,d,90);await p.keyboard.down('KeyW');await p.waitForTimeout(80);await p.keyboard.up('KeyW');await waitWorld(p,w=>w.health===100,'Medikit caps health at100');const remaining=(await world(p)).medical_left;await warp(p,1104,928,d,90);await p.keyboard.down('KeyW');await p.waitForTimeout(100);await p.keyboard.up('KeyW');d.full=await world(p);assert.equal(d.full.medical_left,remaining,'Full health leaves supplies available');await warp(p,1760,1104,d,90);await p.keyboard.down('KeyW');await p.waitForTimeout(100);await p.keyboard.up('KeyW');assert.equal((await world(p)).medical_left,remaining,'Used supplies do not respawn');
 });
 await run('first-guide-and-wait',{viewport:{width:1280,height:800}},async(p,d)=>{
  await freeLiron(p,d);d.release=await world(p);assert.equal(d.release.guide,1);
  // The player stays at the inside release; Liron leads out of the front door until he is too far ahead.
  d.wait1=await waitWorld(p,w=>Math.hypot(w.companion_x-w.x,w.companion_y-w.y)>224,'Guide reaches its waiting distance',10000);await p.waitForTimeout(2000);d.wait2=await world(p);
  assert.ok(Math.hypot(d.wait2.companion_x-d.wait1.companion_x,d.wait2.companion_y-d.wait1.companion_y)<1,'Guide waits for player');d.trace=[];
  for(let i=0;i<35;i++){
   const w=await world(p);d.trace.push(w);
   if(w.sheltered>=1&&w.in_refuge===1)break;
   const person=w.people[0];
   await warp(p,person.x,person.y,d);
   await p.waitForTimeout(1100);
  }
  d.arrival=await world(p);await shot(p,'guide-refuge');
  assert.equal(d.arrival.sheltered,1);assert.equal(d.arrival.refuge_known,1);assert.ok(d.trace.length>=4,'Guide walks through authored map');assert.ok(d.trace[0].people[0].x-d.arrival.people[0].x>700,'Guide travels physically');
 });

await run('four-hits-and-death',desktop,async(p,d)=>{
 await warp(p,-1104,1664,d,90);d.hits=[];
 for(const health of [70,40,10]){const w=await waitWorld(p,w=>w.health===health,'Survives shot at '+health,15000);d.hits.push(w);assert.equal((await read(p)).mode,'playing');}
 await waitWorld(p,(w,r)=>r.mode==='lost'&&w.health===0,'Fourth hit kills and fatal state arrives',15000);d.lost=await world(p);assert.equal(d.lost.health,0);await shot(p,'fourth-hit-loss');
});
// Liron's release is the only way out of quarantine (its gates also wall the refuge
// off from the west), so he is always the first guide. Sam guides when he takes over.
await run('sam-takes-over-guide',desktop,async(p,d)=>{
 await freeLiron(p,d);d.first=await world(p);assert.equal(d.first.guide,1);
 await wrench(p,d);await freeEliezer(p,d);d.release=await world(p);assert.equal(d.release.guide,1);
 const liron=(await world(p)).people[0];await warp(p,liron.x,liron.y,d);await command(p,'kill');d.transfer=await waitWorld(p,w=>w.controlled===1,'Player inherits the guide');d.handover=await waitWorld(p,w=>w.guide===3,'Sam takes over guiding');
 d.trace=[];
 for(let i=0;i<40;i++){const w=await world(p);d.trace.push(w);if(w.people[2].sheltered===1&&w.in_refuge)break;const h=w.people[2];await warp(p,h.x,h.y,d);await p.waitForTimeout(1000);}
 // The sheltered count includes the player's inherited (taken) body while it stands in the refuge: Sam + Liron = 2.
 d.arrival=await world(p);assert.equal(d.arrival.people[2].sheltered,1);assert.equal(d.arrival.in_refuge,1);assert.equal(d.arrival.sheltered,2);await shot(p,'sam-guide-refuge');
});
await run('wounded-body-transfer',desktop,async(p,d)=>{
 await gun(p,d);await freeLiron(p,d);await warp(p,1936,1000,d,270);await lookAtPerson(p,0);await press(p,'Control');d.wounded=await waitWorld(p,w=>w.people[0].health===75,'Native shot wounds prisoner');assert.equal(d.wounded.people[0].alive,1);
 await command(p,'kill');d.transfer=await waitWorld(p,w=>w.controlled===1,'Wounded body inherits');assert.equal(d.transfer.health,75);await waitWorld(p,w=>w.guide===0,'No self-guiding dead NPC');assert.equal(d.transfer.alive,5);await p.keyboard.down('KeyW');await p.waitForTimeout(180);await p.keyboard.up('KeyW');await p.waitForTimeout(180);assert.equal((await read(p)).mode,'playing');await shot(p,'wounded-inheritance');
});
await run('five-survivors-refuge',desktop,async(p,d)=>{
 // Only player setup uses warps; every companion traverses original geometry. Liron opens quarantine first. Holly goes
 // next, while the hunter is still near its start by the bridge: she typically takes one hit and gets clear. Freed last,
 // she was pinned on the bridge by the hunter waiting in the corridor east of it and killed (gameplay, not a fixture).
 await warp(p,1056,848,d,90);await waitWorld(p,w=>w.refuge_known===1,'Know refuge');
 d.steps=[];const step=async name=>{const w=await world(p);d.steps.push({name,ticks:w.ticks,hunter:[Math.round(w.hunter_x),Math.round(w.hunter_y),w.hunter_state],health:w.people.map(h=>h.health),discovered:w.people.map(h=>h.discovered)});};
 for(const [name,free] of [['liron',freeLiron],['holly',freeHolly],['hinton',freeHinton],['stuart',freeStuart],['wrench',wrench],['eliezer',freeEliezer]]){await free(p,d);await step(name);}
 await warp(p,1040,848,d,90);d.trace=[];let sampled=0;
 d.gathered=await waitWorld(p,w=>{if(w.ticks-sampled>=70){sampled=w.ticks;d.trace.push(w);}return w.group_gathered===1;},'All surviving bodies reach refuge',110000);
 assert.equal(d.gathered.alive,6);assert.equal(d.gathered.sheltered,5);assert.ok(d.gathered.people.every(h=>h.holding&&h.sheltered&&h.health>0));assert.equal(d.gathered.cover_changed,1);await shot(p,'five-at-refuge');
 // Once everyone is gathered the actual bulkhead locks permanently.
 await warp(p,1088,864,d,0);await press(p,'KeyE');await p.waitForTimeout(1200);assert.equal((await read(p)).dialogue.refuge_sealed,1);assert.equal((await world(p)).refuge_open,0);assert.ok((await world(p)).people.filter(h=>h.alive&&!h.controlled).every(h=>h.sheltered));
 await face(p,(Math.atan2(800-864,1168-1088)*180/Math.PI+360)%360);await p.keyboard.down('KeyW');await p.waitForTimeout(600);await p.keyboard.up('KeyW');await p.waitForTimeout(400);d.sealedWalk=await world(p);assert.equal(d.sealedWalk.refuge_open,0,'Walking up to the sealed bulkhead does not open it');await shot(p,'sealed-refuge');
});
await run('bulkhead-and-hunter-protection',desktop,async(p,d)=>{
 await gun(p,d);await freeLiron(p,d);
 await warp(p,1320,800,d,180);d.closed=await world(p);assert.equal(d.closed.refuge_open,0,'Bulkhead starts closed');assert.equal(d.closed.prompt,'','No refuge bulkhead prompt');await shot(p,'bulkhead-closed');
 // Like any facility door it opens as you walk up to it; no use key.
 await p.keyboard.down('KeyW');d.opened=await waitWorld(p,w=>w.refuge_open===1,'Bulkhead opens on approach');assert.ok(d.opened.x>1190,'Opened before the player reached the door');await p.waitForTimeout(1300);await p.keyboard.up('KeyW');d.entered=await waitWorld(p,w=>w.in_refuge===1,'Player physically enters');
 await waitWorld(p,w=>w.sheltered===1,'Prisoner enters and settles',30000);await waitWorld(p,w=>w.refuge_open===0,'Door closes after passage',7000);await command(p,'netevent pdoom_test_hunter_at_gate'); // Native fixture positions the real hunter; all normal rules remain active.
 d.near=await waitWorld(p,w=>Math.hypot(w.hunter_x-1232,w.hunter_y-800)<180,'Real hunter placed immediately outside bulkhead',6000);const health=d.near.health,prisonerHealth=d.near.people[0].health;
 await warp(p,1088,832,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.refuge_open===1,'Inside override opens with hunter nearby');await p.waitForTimeout(6000);d.safe=await world(p);assert.equal(d.safe.health,health);assert.equal(d.safe.people[0].health,prisonerHealth);assert.equal(d.safe.people[0].alive,1);assert.equal(d.safe.hunter_aim,0);assert.ok(d.safe.hunter_x>=1200,'Hunter stays outside open gate');await shot(p,'hunter-held-outside');
});
for(const[name,viewport]of[['refuge-touch-portrait',{width:390,height:844}],['refuge-touch-landscape',{width:844,height:390}]])await run(name,{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1},async(p,d,c)=>{
 const cdp=await c.newCDPSession(p);async function touch(code,ms=100){const b=await p.locator(`[data-code="${code}"]`).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await p.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);}
 await warp(p,1936,944,d,270);await touch('Space');await waitWorld(p,w=>w.people[0].released===1,'Touch Use inside release');await warp(p,1040,848,d,90);await waitWorld(p,w=>w.sheltered===1,'Native staging',30000);assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);await shot(p,name);assert.match(await p.locator('#health').textContent(),/100%/);const audio=await read(p);assert.equal(audio.audioState,'running');
});

} finally {
report.passed=report.cases.length===(selected?.length??9)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);console.log(JSON.stringify(report.cases.map(({name,passed,failure})=>({name,passed,failure}))));process.exit(report.passed?0:1);
}
