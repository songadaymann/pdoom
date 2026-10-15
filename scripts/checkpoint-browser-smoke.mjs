import {wallApproaches} from './wall-qa-helpers.mjs';
const {map:wallMap}=await wallApproaches('checkpoint');
import {startGame} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/checkpoint/qa',url=process.env.DOOM_URL||'http://127.0.0.1:5198/?level=rescue';
await fs.mkdir(out,{recursive:true});
const selected=process.env.DOOM_CASES?.split(',');
const report={url,modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:{natural:'Real keyboard input with normal hunter, no warps.',fixtures:'Native console warp positions player only; all actions and movement then use keyboard or CDP touch. Hunter remains active.',touch:'Chrome portrait and landscape touch emulation, not a physical-phone certification.'}};
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
async function lookAtPerson(p){const w=await world(p);await face(p,(Math.atan2(w.companion_y-w.y,w.companion_x-w.x)*180/Math.PI+360)%360);}
async function command(p,text){await waitWorld(p,w=>w.ticks>35,'Console input warmup');await p.keyboard.press('Backquote');await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);}
async function warp(p,x,y,d,angle){(d.warps??=[]).push({x,y});await command(p,`warp ${x} ${y}`);await waitWorld(p,w=>Math.hypot(w.x-x,w.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function run(name,options,test){if(selected&&!selected.includes(name))return;const d={name,passed:false,errors:[]},c=await browser.newContext(options);let p;try{p=await c.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await startGame(p);await p.waitForFunction(()=>['playing','error'].includes(window.__DOOM_DEBUG__?.state.mode),{},{timeout:55000});assert.equal((await read(p)).mode,'playing',JSON.stringify(await read(p)));await waitWorld(p,w=>w?.level==='first-rescue','Current checkpoint');d.initial=await read(p);assert.equal(d.initial.world.released,0);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);if(p){d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}
try{
await run('natural-wrench-camera',{viewport:{width:1280,height:800}},async(p,d)=>{
 await shot(p,'original-map-start');await face(p,90);
 const audioBefore=Math.max(0,...(await read(p)).sound.recent.map(m=>m.sourceId));
 await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Pick up wrench by keyboard');
 const pickupAudio=(await read(p)).sound.recent.filter(m=>m.sourceId>audioBefore);
 assert.ok(pickupAudio.some(m=>m.frames===7529&&m.spatial?.audibleGain>.1),'Wrench pickup sound is audible');
 assert.ok(!pickupAudio.some(m=>m.frames===3910),'Disappearing pickup must not fall through to failed-use grunt');
 d.pickupAudio=pickupAudio;
 await face(p,134);await shot(p,'camera-intact-held-wrench');
 await crawlAxis(p,'x',1948);await crawlAxis(p,'y',1144);
 // Aim at the current wall mount, not the camera's old floating position.
 const aimed=await world(p),cam=aimed.cameras[0];
 await face(p,Math.atan2(cam.y-aimed.y,cam.x-aimed.x)*180/Math.PI);await press(p,'Control');
 d.hit=await waitWorld(p,w=>w.camera_broken===1&&w.impacts>=1,'Native melee breaks camera',4000);await shot(p,'camera-broken');assert.equal(d.hit.wrench,1);assert.equal(d.hit.flight,0);const reports=d.hit.cameras[0].reports;await p.waitForTimeout(700);assert.equal((await world(p)).cameras[0].reports,reports,'Broken camera stops reporting');assert.equal(d.hit.released,0);
});
// 2026-10-10: Liron's padlock is unbreakable (bearings and Space do nothing); the crawlspace's inside release is his only route.
await run('padlock-unbreakable',{viewport:{width:1280,height:800}},async(p,d)=>{
 await warp(p,1040,848,d,90); // Refuge already known for legacy follow/order checks.
 await warp(p,832,1528,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.gun===1&&w.ammo===3,'Collect gun');await warp(p,1930,1160,d,270);await shot(p,'locked-cell');await press(p,'KeyE');assert.equal((await world(p)).released,0,'Use does not bypass padlock');await press(p,'Space');d.locked=await world(p);assert.equal(d.locked.released,0,'Space (use) does not bypass padlock');assert.equal(d.locked.message,'Locked.');
 await press(p,'Control');d.shotLock=await waitWorld(p,w=>w.ammo===2,'Ball bearing fired at the padlock');await p.waitForTimeout(900);assert.equal((await world(p)).released,0,'Padlock is unbreakable');
 // Quick fixture for the real route: warp to the inside release (mount 15105, 48 units out); the companion still leaves by the front door.
 await warp(p,1936,944,d,270);await press(p,'Space');d.release=await waitWorld(p,w=>w.released===1&&w.route==='service','Inside release');await warp(p,1930,1160,d,270);
 await p.waitForTimeout(1500);d.complete=await waitWorld(p,w=>w.completed===1&&w.companion_y>1108,'Companion exits through actual door',15000); // Release card + 4 s quip before leading.
 await shot(p,'rescued-prisoner');await press(p,'KeyQ');assert.equal((await world(p)).hold,0,'Removed order does not park companion');await command(p,'kill');d.transfer=await waitWorld(p,w=>w.controlled===1,'Released person can inherit control');assert.equal((await read(p)).mode,'playing');assert.equal(d.transfer.hold,0);assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);
});
await run('automatic-refuge-stay',{viewport:{width:1280,height:800}},async(p,d)=>{
 await warp(p,1040,848,d,90);await warp(p,1936,944,d,270);await press(p,'Space');await waitWorld(p,w=>w.released===1&&w.route==='service','Rescue via inside release');
 await warp(p,1040,848,d,90);d.parked=await waitWorld(p,w=>w.sheltered===1,'Automatic shelter',30000);await shot(p,'automatic-stay');
 await warp(p,1232,800,d,180);await p.waitForTimeout(2000);d.away=await world(p);assert.equal(d.away.people[0].sheltered,1);assert.ok(Math.hypot(d.away.people[0].x-d.away.people[0].hold_x,d.away.people[0].y-d.away.people[0].hold_y)<=33,'Refuge idle remains bounded');
 await press(p,'KeyQ');assert.equal((await world(p)).people[0].holding,1,'Disabled Q cannot recall refuge companion');assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);
});
await run('crouch-service-route',{viewport:{width:1280,height:800}},async(p,d)=>{
 await warp(p,1744,960,d,0);
 assert.equal((await world(p)).crouch,1,'Standing before the low duct');
 await p.keyboard.down('KeyW');await p.waitForTimeout(800);await p.keyboard.up('KeyW');await p.waitForTimeout(300);d.walkIn=await world(p);assert.ok(d.walkIn.x>1792,'Walking (no C) enters the low duct');assert.ok(d.walkIn.crouch<.75,'Auto-crouched in the duct');
 await p.keyboard.down('KeyC');await p.waitForTimeout(350);
 d.crawl=[];const begun=(await world(p)).ticks;
 for(const [axis,target,label] of [['x',1832,'entry'],['y',832,'first-bend'],['x',1840,'shaft'],['y',480,'long-south-leg'],['x',2160,'bottom-bend'],['y',960,'last-bend']]){
  const state=await crawlAxis(p,axis,target);d.crawl.push({label,state});
  assert.equal(state.discovered,0,'No prisoner discovery at '+label);assert.equal(state.released,0);
  if(label!=='shaft'){if(['entry','first-bend','long-south-leg'].includes(label))await face(p,270);await shot(p,'crawl-'+label);assert.equal((await world(p)).discovered,0,'Still hidden while looking down '+label);}
 }
 await face(p,180);await p.waitForTimeout(200);await crawlAxis(p,'x',1978);await face(p,180);
 d.entered=await world(p);assert.ok(d.entered.x<1984,'Full native crawl reaches cell from east');assert.equal(d.entered.discovered,1,'Person discovered only at final approach');assert.equal(d.entered.released,0);
 d.crawlSeconds=(d.entered.ticks-begun)/35;await p.keyboard.up('KeyC');await p.waitForTimeout(350);await shot(p,'inside-cell-via-duct');const panel=wallMap.wall_mounts.find(p=>p.type===15105),at=await world(p);await face(p,(Math.atan2(panel.y-at.y,panel.x-at.x)*180/Math.PI+360)%360);await press(p,'KeyE');
 d.release=await waitWorld(p,w=>w.released===1&&w.route==='service','Inside manual release');assert.equal(d.release.gun,0);assert.equal(d.release.camera_broken,0);
 await crawlAxis(p,'y',1072);await crawlAxis(p,'y',1128);
 d.complete=await waitWorld(p,w=>w.completed===1&&w.companion_y>1108,'Player and companion use front door rather than duct');await shot(p,'service-rescue-complete');
});
await run('miss-keeps-wrench',{viewport:{width:1280,height:800}},async(p,d)=>{
 await face(p,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Collect wrench');await face(p,0);await press(p,'Control');d.miss=await waitWorld(p,w=>w.wrench_swings>=1,'Native swing');assert.equal(d.miss.camera_broken,0);assert.equal(d.miss.wrench,1);assert.equal(d.miss.flight,0);await shot(p,'miss-retained');
});
for(const[name,viewport]of[['touch-portrait',{width:390,height:844}],['touch-landscape',{width:844,height:390}]])await run(name,{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1},async(p,d,c)=>{
 const cdp=await c.newCDPSession(p);async function touch(code,ms=100){const box=await p.locator(`[data-code="${code}"]`).boundingBox();assert.ok(box,code+' visible');assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,code+' fits');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await p.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);}
 await waitWorld(p,w=>w.ticks>35,'Input warmup');const initial=await world(p);await touch('KeyW',650);d.movement=await world(p);assert.ok(Math.hypot(d.movement.x-initial.x,d.movement.y-initial.y)>15,'Touch movement');await warp(p,2032,1120,d,90);await touch('Space');await waitWorld(p,w=>w.wrench===1,'Touch Use pickup');await warp(p,1948,1144,d,90);await touch('ControlLeft',230);d.hit=await waitWorld(p,w=>w.camera_broken===1&&w.impacts>0,'Touch Swing strike');assert.equal(await p.locator('#crouch-button').isVisible(),false,'Crouch button hidden (ducts auto-crouch)');await shot(p,name);const audio=await read(p);assert.equal(audio.audioState,'running');assert.ok(audio.musicPlaying||audio.audioBuffers>0);
 await warp(p,1040,848,d,90);await warp(p,832,1528,d,90);await touch('Space');await waitWorld(p,w=>w.gun===1,'Touch gun pickup');await warp(p,1930,1160,d,270);await touch('ControlLeft');await waitWorld(p,w=>w.ammo===2,'Touch Sling shot');assert.equal((await world(p)).released,0,'Padlock ignores the shot');await warp(p,1936,944,d,270);await touch('Space');await waitWorld(p,w=>w.released===1,'Touch Use inside release');await warp(p,1930,1160,d,270);await waitWorld(p,w=>w.completed===1,'Touch rescue',15000);await lookAtPerson(p);
 assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);assert.equal((await world(p)).hold,0);await touch('KeyT');assert.equal((await world(p)).tool,0);assert.equal(await p.locator('#attack-button').textContent(),'Swing');await touch('KeyT');assert.equal((await world(p)).tool,1);assert.equal(await p.locator('#attack-button').textContent(),'Sling');await shot(p,name+'-tools');
});
}finally{report.passed=report.cases.length===(selected?.length??7)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({name,passed,failure})=>({name,passed,failure}))}));process.exit(report.passed?0:1);}
