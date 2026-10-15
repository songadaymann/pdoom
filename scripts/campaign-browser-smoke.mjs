import {startGame} from './doom-qa-ui.mjs';
import {escapeHelpers} from './escape-browser-helpers.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/checkpoint/five-prisons/qa',url=process.env.DOOM_URL||'http://127.0.0.1:5198/?level=rescue';
await fs.mkdir(out,{recursive:true});
const selected=process.env.DOOM_CASES?.split(',');
const report={url,modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:{natural:'Real keyboard input with normal hunter, no warps.',fixtures:'Native console warp positions player only; all actions and movement then use keyboard or CDP touch. Hunter remains active.',touch:'Chrome portrait and landscape touch emulation, not a physical-phone certification.'}};
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
async function lookAtPerson(p,index=0){for(let i=0;i<8;i++){const w=await world(p),h=w.people[index];await face(p,(Math.atan2(h.y-w.y,h.x-w.x)*180/Math.PI+360)%360);await p.waitForTimeout(180);if((await world(p)).order_target===index)return;}throw Error('Local order target '+index+': '+JSON.stringify(await world(p)));}
// Console keys go straight to the worker (as in native-qa-helpers) so a death closing the console cannot desync the page-side toggle.
async function rawKey(p,code,key,keyCode){await p.evaluate(({code,key,keyCode})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode,which:keyCode,bubbles:true,cancelable:true}});},{code,key,keyCode});}
// A bio card (first close look at a freed prisoner) pauses the engine; console toggles sent as it closes can be dropped.
async function settled(p){for(let i=0;i<30;i++){await waitWorld(p,(w,r)=>w.ticks>35&&!r.uiBlocked,'Console input warmup',15000);await p.waitForTimeout(400);if(!(await read(p)).uiBlocked)return;}throw Error('UI never settled');}
async function command(p,text){await settled(p);await rawKey(p,'Backquote','`',192);await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await rawKey(p,'Enter','Enter',13);await p.waitForTimeout(300);if(text!=='kill'){await settled(p);await rawKey(p,'Backquote','`',192);}await p.waitForTimeout(500);}
async function warp(p,x,y,d,angle){(d.warps??=[]).push({x,y});await command(p,`warp ${x} ${y}`);await waitWorld(p,w=>Math.hypot(w.x-x,w.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function run(name,options,test){if(selected&&!selected.includes(name))return;const d={name,passed:false,errors:[]},c=await browser.newContext(options);let p;try{p=await c.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await startGame(p);await p.waitForFunction(()=>['playing','error'].includes(window.__DOOM_DEBUG__?.state.mode),{},{timeout:55000});assert.equal((await read(p)).mode,'playing',JSON.stringify(await read(p)));await waitWorld(p,w=>w?.level==='first-rescue','Current checkpoint');d.initial=await read(p);assert.equal(d.initial.world.freed,0);assert.equal(d.initial.world.people.length,5);assert.equal(d.initial.world.alive,6);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);if(p){d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}

async function gun(p,d){await warp(p,832,1528,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.gun===1&&w.ammo>=3,'Gun fixture');}
// Each prisoner's single remaining route, as quick warped fixtures that use the real controls.
async function wrench(p,d){await warp(p,2032,1120,d,90);await press(p,'Space');await waitWorld(p,w=>w.wrench===1,'Wrench');}
async function freeLiron(p,d){await warp(p,1936,944,d,270);await press(p,'Space');await waitWorld(p,w=>w.people[0].released===1,'Liron inside release');}
async function freeEliezer(p,d){await warp(p,-904,528,d,90);await press(p,'Control');await waitWorld(p,(w,r)=>r.sam.opened===1&&r.sam.clearance===56,'Junction strike lifts rear shutter');await warp(p,-1040,-288,d,0);await crawlAxis(p,'x',-936);await face(p,150);await press(p,'Space');await waitWorld(p,w=>w.people[2].released===1,'Eliezer inside latch');}
async function freeHinton(p,d){await warp(p,-1088,688,d,270);await press(p,'Space');await waitWorld(p,w=>w.charge===1,'Charge pickup');await warp(p,-1408,1120,d,180);await press(p,'Space');await waitWorld(p,w=>w.fuse>0,'Charge planted');await p.keyboard.down('KeyD');await p.waitForTimeout(1700);await p.keyboard.up('KeyD');await waitWorld(p,w=>w.breaches===1&&w.people[3].released===1,'Blast frees Hinton',8000);}
async function freeStuart(p,d){await warp(p,-48,2020,d,270);await press(p,'Space');await waitWorld(p,w=>w.people[1].released===1,'Stuart rear breaker');}
async function freeHolly(p,d){await warp(p,-1088,1496,d,90);await press(p,'Space');await waitWorld(p,(w,r)=>r.holly.powered===1,'Bridge power');await warp(p,-976,1904,d,90);await press(p,'Space');await waitWorld(p,w=>w.people[4].released===1,'Holly powered bridge');}
const {bolts:escapeBolts,toMeadow}=escapeHelpers({read,warp,command,face,crawlAxis,shot});
const desktop={viewport:{width:1280,height:800}};
try{
// 2026-10-10: one route per prisoner. Stuart's turret is armoured (breaker only), Eliezer has no key and a permanent
// front lock (junction + inside latch only), Hinton's crawl and Holly's stair crawl are gone. Closed routes stay asserted.
await run('turret-armour-and-fire',desktop,async(p,d)=>{
 await gun(p,d);await warp(p,-80,1832,d,105);d.active=await waitWorld(p,w=>w.turret_shots>=2&&w.health<100,'Native turret bolts damage player');await shot(p,'turret-firing');const hits=d.active.turret_hits;await press(p,'Control');d.clang=await waitWorld(p,w=>w.turret_hits>hits&&w.ammo<d.active.ammo,'Ball bearing clangs off the armoured housing');await p.waitForTimeout(600);d.after=await world(p);assert.equal(d.after.turret_broken,0,'Armour ignores the slingshot');assert.equal(d.after.people[1].released,0,'Shot no longer releases Stuart');await shot(p,'turret-armour-shot');
});
await run('turret-wrench-clangs',desktop,async(p,d)=>{
 await face(p,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Collect melee wrench');await warp(p,-112,2016,d,270);
 for(let i=0;i<3;i++){await press(p,'Control');await p.waitForTimeout(400);}d.clang=await waitWorld(p,w=>w.turret_hits>=3,'Three native wrench hits clang off the armour');await p.waitForTimeout(600);d.after=await world(p);assert.equal(d.after.turret_broken,0,'Armour ignores the wrench');assert.equal(d.after.people[1].released,0);assert.equal(d.after.gun,0);await shot(p,'turret-wrench-clang');
});
await run('turret-breaker',desktop,async(p,d)=>{
 await warp(p,-48,2020,d,270);await p.waitForTimeout(800);assert.equal((await world(p)).turret_shots,0,'Rear approach is outside firing lane');await shot(p,'turret-rear-breaker');await press(p,'KeyE');d.release=await waitWorld(p,w=>w.turret_broken===1&&w.people[1].released===1,'Rear power disconnect');assert.equal(d.release.people[1].route,'breaker');assert.equal(d.release.gun,0);await waitWorld(p,w=>w.people[1].clear===1,'Rear rescue door traversal',20000);await shot(p,'turret-breaker-rescue');
});
await run('maintenance-rear-wall',desktop,async(p,d)=>{
 await warp(p,-1056,-288,d,0);await shot(p,'maintenance-rear-sealed');
 await p.keyboard.down('KeyW');await p.waitForTimeout(900);await p.keyboard.up('KeyW');await press(p,'KeyE');
 d.wall=await world(p);assert.ok(d.wall.x<=-1015,'Western partition blocks standing entry');assert.equal(d.wall.people[2].discovered,0,'Opaque partition hides Sam');assert.equal(d.wall.people[2].released,0,'Rear release cannot be used through wall');
 await p.keyboard.down('KeyC');await p.waitForTimeout(300);await p.keyboard.down('KeyW');await p.waitForTimeout(600);await p.keyboard.up('KeyW');await p.keyboard.up('KeyC');await p.waitForTimeout(300);
 assert.ok((await world(p)).x<=-1015,'Western partition blocks crouching entry');
 await gun(p,d);await warp(p,-1056,-288,d,0);await press(p,'Control');assert.equal((await world(p)).people[2].released,0,'Shooting the rear wall cannot bypass the lock');
 await warp(p,-780,-288,d,180);await p.keyboard.down('KeyW');await p.waitForTimeout(600);await p.keyboard.up('KeyW');await press(p,'KeyE');
 d.locked=await world(p);assert.ok(d.locked.x>=-809,'Eastern locked door blocks entry');assert.equal(d.locked.people[2].released,0,'Keyless use does not open cell');assert.equal(d.locked.message,'Locked.');
 await press(p,'Control');await p.waitForTimeout(900);d.shotLock=await world(p);assert.ok(d.shotLock.ammo<d.locked.ammo,'Ball bearing fired');assert.equal(d.shotLock.people[2].released,0,'Front lock is permanent: shooting it does nothing');assert.equal((await read(p)).sam.opened,0);await shot(p,'maintenance-front-permanent');
});
await run('maintenance-power-shutter',desktop,async(p,d)=>{
 await warp(p,-1344,720,d,270);await press(p,'Space');await p.waitForTimeout(400);assert.equal((await world(p)).key,0,'No maintenance key on the map');
 await wrench(p,d);await freeEliezer(p,d);d.release=await world(p);assert.equal(d.release.people[2].route,'power-shutter');assert.equal(d.release.key,0);assert.equal(d.release.gun,0);await shot(p,'maintenance-inside-latch');
 await crawlAxis(p,'x',-1056);await waitWorld(p,w=>w.people[2].clear===1,'Maintenance prisoner traverses the rear shutter',20000);await shot(p,'maintenance-rescued');
});
await run('breach-charge',desktop,async(p,d)=>{
 await warp(p,-1088,688,d,270);await press(p,'KeyE');await waitWorld(p,w=>w.charge===1,'Charge pickup');await warp(p,-1408,1120,d,180);await shot(p,'breach-intact');await press(p,'KeyE');d.fuse=await waitWorld(p,w=>w.fuse>0,'Physical charge fuse');await p.keyboard.down('KeyD');await p.waitForTimeout(1700);await p.keyboard.up('KeyD');await face(p,255);d.blast=await waitWorld(p,w=>w.breaches===1,'Real breach explosion');await shot(p,'breach-explosion');assert.equal(d.blast.people[3].released,1);assert.equal(d.blast.people[3].route,'breach');assert.equal(d.blast.debris,20);assert.equal(d.blast.smoke,10);assert.equal(d.blast.alive,6,'Retreat protects player and prisoner');
 await warp(p,-1424,1120,d,180);await waitWorld(p,w=>w.people[3].clear===1,'Breach prisoner exits',20000);await p.keyboard.down('KeyW');await p.waitForTimeout(1500);await p.keyboard.up('KeyW');await p.waitForTimeout(200);d.crossing=await world(p);assert.ok(d.crossing.x<-1488,'Player traverses destroyed physical partition');await shot(p,'breach-open');
});
await run('breach-crawl-closed',desktop,async(p,d)=>{
 await warp(p,-1424,1312,d,180);assert.equal((await world(p)).crouch,1,'Standing where the old crawl began');await p.keyboard.down('KeyW');await p.waitForTimeout(1400);await p.keyboard.up('KeyW');await p.waitForTimeout(200);d.walkIn=await world(p);assert.ok(d.walkIn.x>-1472,'No crawl duct into the machinery cell');assert.equal(d.walkIn.crouch,1,'Nothing low to duck into');
 await p.keyboard.down('KeyC');await p.waitForTimeout(300);await p.keyboard.down('KeyW');await p.waitForTimeout(1000);await p.keyboard.up('KeyW');await p.keyboard.up('KeyC');await p.waitForTimeout(300);d.crouched=await world(p);assert.ok(d.crouched.x>-1472,'Crouching finds no way in either');assert.equal(d.crouched.people[3].released,0);assert.equal(d.crouched.breaches,0);await shot(p,'breach-crawl-closed');
});
await run('security-powered-bridge',desktop,async(p,d)=>{
 await command(p,'god');await warp(p,-976,1904,d,90);await press(p,'KeyE');assert.equal((await world(p)).people[4].released,0);assert.equal((await read(p)).holly.powered,0);
 await warp(p,-1088,1496,d,90);await press(p,'KeyE');await waitWorld(p,(w,s)=>s.holly.powered===1,'Restore bridge feed');assert.equal((await world(p)).people[4].released,0);assert.equal((await world(p)).people[1].released,0);
 await warp(p,-976,1904,d,90);await press(p,'KeyE');await waitWorld(p,(w,s)=>w.people[4].released===1&&s.holly.bridge_height===192,'Powered bridge opens cell');assert.equal((await world(p)).people[4].route,'powered-bridge');await shot(p,'security-powered-bridge');
});
await run('security-crawl-closed',desktop,async(p,d)=>{
 await command(p,'god');await warp(p,-1408,1504,d,180);await p.keyboard.down('KeyW');await p.waitForTimeout(1400);await p.keyboard.up('KeyW');await p.waitForTimeout(200);d.walkIn=await world(p);assert.ok(d.walkIn.x>-1440,'No service crawl beside the bridge');
 await p.keyboard.down('KeyC');await p.waitForTimeout(300);await p.keyboard.down('KeyW');await p.waitForTimeout(1000);await p.keyboard.up('KeyW');await p.keyboard.up('KeyC');await p.waitForTimeout(300);d.crouched=await world(p);assert.ok(d.crouched.x>-1440,'Crouching finds no crawl either');assert.equal(d.crouched.people[4].released,0);assert.equal((await read(p)).holly.powered,0);await shot(p,'security-crawl-closed');
});
await run('five-prisons-gather',desktop,async(p,d)=>{
 await warp(p,1040,848,d,90);await freeLiron(p,d);await wrench(p,d);await freeEliezer(p,d);await freeHinton(p,d);await freeStuart(p,d);await freeHolly(p,d);
 await warp(p,1040,848,d,90);d.gathered=await waitWorld(p,w=>w.group_gathered===1&&w.people.filter(h=>h.alive&&!h.controlled).every(h=>h.sheltered&&h.holding),'Automatic gathering',110000);assert.equal(d.gathered.freed,5);assert.ok(d.gathered.people.filter(h=>h.alive&&!h.controlled).every(h=>h.sheltered&&h.holding));await shot(p,'all-at-refuge');
 await warp(p,864,856,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Refuge spare wrench');await warp(p,832,880,d,90);await command(p,'centerview');await escapeBolts(p,d);await toMeadow(p,d);assert.equal(d.won.escape.saved,d.won.world.alive);assert.equal(d.won.developmentEnd,false);
});
await run('automatic-escort-and-loss',desktop,async(p,d)=>{
 await warp(p,1040,848,d,90);await freeHinton(p,d);await warp(p,-1408,1120,d,180);await waitWorld(p,w=>w.people[3].clear===1,'Hinton exits',20000);await press(p,'KeyQ');assert.equal((await world(p)).people[3].holding,0,'Manual order is inert');
 await command(p,'kill');d.transfer=await waitWorld(p,w=>w.controlled===4,'Released body inherits');assert.equal(d.transfer.alive,5);assert.equal(d.transfer.health,100);await p.keyboard.down('KeyW');await p.waitForTimeout(350);await p.keyboard.up('KeyW');await p.waitForTimeout(200);const moved=await world(p);assert.ok(Math.hypot(moved.x-d.transfer.x,moved.y-d.transfer.y)>10);await command(p,'kill');await waitWorld(p,(w,r)=>r.mode==='lost','Captives cannot inherit');d.lost=await read(p);assert.equal(d.lost.world.alive,4);await shot(p,'no-captive-transfer');
});
}finally{report.passed=report.cases.length===(selected?.length??11)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({name,passed,failure})=>({name,passed,failure}))}));process.exit(report.passed?0:1);}
