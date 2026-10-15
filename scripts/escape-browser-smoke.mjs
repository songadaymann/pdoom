import {startGame} from './doom-qa-ui.mjs';
import {escapeHelpers} from './escape-browser-helpers.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/checkpoint/escape/qa';
let url=process.env.DOOM_URL||'http://127.0.0.1:5198/?dev=end';
await fs.mkdir(out,{recursive:true});
const selected=process.env.DOOM_CASES?.split(',');
const report={url,modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:{natural:'Real keyboard input with normal hunter, no warps.',fixtures:'Local dev=end first reconstructs the gathered refuge state, including companion positions and wrench. Subsequent setup warps move only the player; companions physically crawl through the duct. Inputs use real keyboard/CDP touch. Ordinary and disabled-capability cases do not apply that fixture.',touch:'Chrome portrait and landscape touch emulation, not a physical-phone certification.'}};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
const world=async p=>(await read(p)).world;
async function waitWorld(p,test,label,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){const r=await read(p);assert.notEqual(r.mode,'error',r.error);if(r.world&&test(r.world,r))return r.world;await p.waitForTimeout(70);}throw Error(label+': '+JSON.stringify(await read(p)));}
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
// Console keys go straight to the engine (Enter is not a page game control, and kill closes the console natively).
const raw=(p,code,key,keyCode)=>p.evaluate(({code,key,keyCode})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode,which:keyCode,bubbles:true,cancelable:true}});},{code,key,keyCode});
async function command(p,text){await waitWorld(p,w=>w.ticks>35,'Console input warmup');await raw(p,'Backquote','`',192);await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await raw(p,'Enter','Enter',13);await p.waitForTimeout(300);if(text!=='kill')await raw(p,'Backquote','`',192);await p.waitForTimeout(500);}
async function warp(p,x,y,d,angle){(d.warps??=[]).push({x,y});await command(p,`warp ${x} ${y}`);await waitWorld(p,w=>Math.hypot(w.x-x,w.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function run(name,options,test){if(selected&&!selected.includes(name))return;const d={name,passed:false,errors:[]},c=await browser.newContext(options);let p;try{p=await c.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{window.__QA_COMPLETIONS__=0;window.addEventListener('pdoom:level-complete',e=>{window.__QA_COMPLETIONS__++;window.__QA_LAST_COMPLETION__=e.detail;});const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await startGame(p);await p.waitForFunction(()=>['playing','error'].includes(window.__DOOM_DEBUG__?.state.mode),{},{timeout:55000});assert.equal((await read(p)).mode,'playing',JSON.stringify(await read(p)));await waitWorld(p,w=>w?.level==='first-rescue','Current checkpoint');await waitWorld(p,w=>w.ticks>35,'Rendered engine warmup');d.initial=await read(p);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);if(p){d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}
const {aim,bolts,toMeadow}=escapeHelpers({read,warp,command,face,crawlAxis,shot});
const desktop={viewport:{width:1280,height:800}};
try{
 await run('dev-end-full-escape',desktop,async(p,d)=>{
  if(process.env.DOOM_BLISS_AUDIO==='1')await p.evaluate(()=>{
   window.__QA_BLISS_PCM=[];const original=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){
    if(this.buffer?.duration>80){const samples=this.buffer.getChannelData(0);let sum=0,peak=0,n=0;
     for(let i=0;i<samples.length;i+=100){sum+=samples[i]*samples[i];peak=Math.max(peak,Math.abs(samples[i]));n++;}
     window.__QA_BLISS_PCM.push({duration:this.buffer.duration,channels:this.buffer.numberOfChannels,rate:this.buffer.sampleRate,loop:this.loop,rms:Math.sqrt(sum/n),peak,offset:args[1]||0});
    }
    return original.apply(this,args);
   };
  });
  const s=await read(p);assert.equal(s.developmentEnd,true);assert.equal(s.escape.dev,1);assert.equal(s.world.freed,5);assert.equal(s.world.group_gathered,1);assert.equal(s.world.alive,6);assert.equal(await p.locator('#dev-badge').isVisible(),true);await shot(p,'dev-end-start');
  if(process.env.DOOM_COVER_VIEWS==='1'){
   d.coverViews=[];
   for(const [label,x,y]of [['left',768,880],['right',896,880]]){
    await warp(p,x,y,d);await face(p,Math.atan2(958-y,832-x)*180/Math.PI);await command(p,'centerview');
    d.coverViews.push(await read(p));await shot(p,'cover-view-'+label);
   }
   await warp(p,832,880,d,90);await command(p,'centerview');await shot(p,'cover-view-front');
  }
  await aim(p,0);await p.keyboard.down('KeyE');await p.waitForTimeout(330);await p.keyboard.up('KeyE');await p.waitForTimeout(250);d.partial=await read(p);assert.equal(d.partial.escape.bolts,0);assert.equal(d.partial.escape.work_tics,0);
  await bolts(p,d);await toMeadow(p,d);assert.equal(d.won.escape.saved,6);
  if(process.env.DOOM_PERSON_NAMES==='1'){
   const person=d.won.outside.people[0],name=d.won.world.people[person.id].name;
   await p.evaluate(({x,z})=>__DOOM_DEBUG__.outside.debug.setView(x,z+3,0,0),person);
   await p.locator('#outside-canvas').click();
   await p.waitForFunction(name=>JSON.parse(render_game_to_text()).personLabel.name===name,name,{timeout:5000});
   d.meadowName=await read(p);await shot(p,'meadow-person-name');
   await p.keyboard.press('Escape');await p.waitForTimeout(200);
   assert.equal((await read(p)).personLabel.name,null);assert.equal((await read(p)).outside.paused,true);
   await p.keyboard.press('Escape');await p.waitForTimeout(200);
   assert.equal((await read(p)).outside.paused,false);
   // This targeted pass owns escape, name display and pause; the regular pass
   // below separately exercises movement, fullscreen and launcher restart.
   return;
  }
  if(process.env.DOOM_BLISS_AUDIO==='1'){
   await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.audio.loaded,{},{timeout:15000});
   await p.waitForTimeout(1800);d.blissPlaying=(await read(p)).outside.audio;
   assert.equal(d.blissPlaying.track,'music/bliss.mp3');assert.equal(d.blissPlaying.playing,true);
   assert.equal(d.blissPlaying.context,'running');assert.equal(d.blissPlaying.loop,true);assert.equal(d.blissPlaying.error,null);
   assert.ok(d.blissPlaying.duration>88&&d.blissPlaying.duration<90);assert.ok(d.blissPlaying.volume>.2);
   assert.equal((await read(p)).musicPlaying,false,'Facility track stays stopped outdoors');
   await p.locator('#show-score').click();const stopped=(await read(p)).outside.audio;
   assert.equal(stopped.playing,false);assert.equal(stopped.windVolume,0);await p.waitForTimeout(600);
   assert.equal((await read(p)).outside.audio.position,stopped.position,'Scorecard freezes song position');
   await p.locator('#back-meadow').click();await p.waitForTimeout(400);const resumed=(await read(p)).outside.audio;
   assert.equal(resumed.playing,true);assert.ok(resumed.position>stopped.position,'Song resumes from held position');
   await p.keyboard.press('Escape');const manual=(await read(p)).outside.audio;
   assert.equal(manual.playing,false);await p.waitForTimeout(400);assert.equal((await read(p)).outside.audio.position,manual.position);
   await p.keyboard.press('Escape');await p.waitForTimeout(300);
   const starts=(await read(p)).outside.audio.starts;
   if(process.env.DOOM_BLISS_LOOP==='1'){
    await p.waitForFunction(()=>{const a=JSON.parse(window.render_game_to_text()).outside?.audio;return a.playing&&a.position>a.duration-1;},{},{timeout:100000});
    await p.waitForFunction(()=>{const a=JSON.parse(window.render_game_to_text()).outside?.audio;return a.playing&&a.position<2;},{},{timeout:4000});
    d.blissLooped=(await read(p)).outside.audio;assert.equal(d.blissLooped.starts,starts,'Automatic loop keeps one music source');
   }
   d.blissResumed=(await read(p)).outside.audio;await shot(p,'bliss-song-playing');
   d.blissPcm=await p.evaluate(()=>window.__QA_BLISS_PCM);
   assert.ok(d.blissPcm.length>0,'Song reaches actual Web Audio playback');
   assert.ok(d.blissPcm.every(a=>a.channels===2&&a.loop&&a.rms>.01&&a.peak>.1));
   if(process.env.DOOM_BLISS_SOURCE)assert.deepEqual(await fs.readFile('doom-web/music/bliss.mp3'),await fs.readFile(process.env.DOOM_BLISS_SOURCE),'Song exactly matches provided MP3');
  }
  if(process.env.DOOM_SCORE_CHECKS==='1'){
   const score=d.won.run.result;
   assert.equal(score.saved,6);assert.equal(score.levelId,'five-prisons');assert.equal(score.pDoomAtCoverOpen,1);
   assert.equal(score.pDoomFinal,0);assert.equal(score.eligible,false);assert.equal(score.submissions.length,0);
   assert.ok(score.activeTics>0);assert.equal(score.activeMs,Math.round(score.activeTics*1000/35));
   assert.equal(score.breakdown.rescue,50000);assert.equal(score.breakdown.ceo,1000);assert.equal(score.breakdown.outlook,990);
   assert.equal(score.totalScore,Object.values(score.breakdown).reduce((a,b)=>a+b,0));
   await p.locator('#show-score').click();assert.equal(await p.locator('#score-submit').isVisible(),false);
   assert.match(await p.locator('#score-status').innerText(),/Practice run/);
   assert.equal(await p.locator('#next-level').isVisible(),false);
   await shot(p,'practice-score-card');await p.waitForTimeout(600);
   assert.deepEqual((await read(p)).run.result,score,'Result stays frozen after meadow/dialog time');
   assert.equal((await read(p)).outside.paused,true);await p.locator('#back-meadow').click();
   assert.equal((await read(p)).outside.paused,false);
   d.completionHook=await p.evaluate(()=>{const result=window.__QA_LAST_COMPLETION__;return {levelId:result?.levelId,nextLevelId:result?.nextLevelId,frozen:Object.isFrozen(result?.result)};});
   assert.deepEqual(d.completionHook,{levelId:'five-prisons',nextLevelId:null,frozen:true});
   const nativeResult=d.won.events.find(e=>e.outcome==='escaped');
   await p.evaluate(payload=>window.__QA_WORKER__.onmessage({data:{type:'log',msg:'PDOOM_RESULT '+JSON.stringify(payload)}}),nativeResult);
   assert.equal((await read(p)).scoreView.open,false,'Replayed native result does not reopen/reset scorecard');
   assert.equal(await p.evaluate(()=>window.__QA_COMPLETIONS__),1,'Completion hook emits once');
  }
  if(process.env.DOOM_CAMERA_HUD==='1'){
   assert.equal(await p.locator('#camera-tally').isVisible(),true,'Camera total persists in the meadow');
   assert.equal(await p.locator('#camera-tally').innerText(),`CAMERAS ${d.won.world.cameras_broken}/${d.won.world.cameras_total}`);
   d.meadowCameraTally=await p.locator('#camera-tally').innerText();
   await shot(p,'meadow-camera-tally');
  }
  if(process.env.DOOM_IDLE_CHECKS==='1'){
   d.idleTrace=[];for(let n=0;n<15;n++){d.idleTrace.push((await read(p)).outside);if(n===0||n===14)await shot(p,'meadow-idle-'+n);await p.waitForTimeout(200);}
   assert.ok(d.idleTrace.every(s=>s.settled===5),'Idle pacing keeps completed gathering');
   for(let id=0;id<5;id++){const poses=d.idleTrace.map(s=>s.people.find(h=>h.id===id)),first=poses[0];assert.ok(poses.some(h=>Math.hypot(h.x-first.x,h.z-first.z)>.15),'Meadow human actually paces '+id);assert.ok(Math.max(...poses.map(h=>h.height))-Math.min(...poses.map(h=>h.height))>.02,'Meadow breathing '+id);assert.ok(poses.every(h=>Math.hypot(h.x-(17+(id-2)*1.4),h.z-(-7-(id%2)*1.4))<.46),'Bounded meadow gathering '+id);}
  }

  if(process.env.DOOM_HUD_CHECKS==='1'){
   assert.equal(d.won.survivalEstimate.survival,100);assert.equal(d.won.survivalEstimate.doom,0);
   assert.equal(await p.locator('.doom-statusbar').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
   assert.ok((await p.locator('#group').textContent()).includes('100% survival'));
   const hud=await p.locator('#hud').boundingBox(),badge=await p.locator('#dev-badge').boundingBox();
   assert.ok(hud.y+hud.height<=badge.y||badge.y+badge.height<=hud.y,'Dev badge does not cover meadow HUD');
  }
  if(process.env.DOOM_GRASS_METRICS==='1')d.meadowPerformance=await p.evaluate(()=>new Promise(resolve=>{let start=performance.now(),last=start;const samples=[];function tick(now){samples.push(now-last);last=now;if(now-start<6000)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);resolve({fps:samples.length*1000/(now-start),p95_ms:samples[Math.floor(samples.length*.95)]});}}requestAnimationFrame(tick);}));
  const before=(await read(p)).outside;await p.keyboard.down('KeyW');await p.waitForTimeout(1000);await p.keyboard.up('KeyW');await p.waitForTimeout(300);const after=(await read(p)).outside;assert.ok(before.z-after.z>2,'Outside movement');
  await p.keyboard.down('ArrowRight');await p.waitForTimeout(1750);await p.keyboard.up('ArrowRight');await p.waitForTimeout(350);d.lookBack=await read(p);assert.ok(d.lookBack.outside.portal_frames>5,'Live native passage texture rendered while looking back');await shot(p,'meadow-look-back');
  await press(p,'Escape');assert.equal((await read(p)).outside.paused,true);const held=(await read(p)).outside;await p.keyboard.down('KeyW');await p.waitForTimeout(450);await p.keyboard.up('KeyW');assert.equal((await read(p)).outside.z,held.z);if(process.env.DOOM_IDLE_CHECKS==='1')assert.deepEqual((await read(p)).outside.people,held.people,'Meadow pause freezes NPC pacing and breathing');await press(p,'Escape');assert.equal((await read(p)).outside.paused,false);
  await press(p,'KeyF');assert.equal(await p.evaluate(()=>document.fullscreenElement?.id),'stage');await press(p,'KeyF');assert.equal(await p.evaluate(()=>document.fullscreenElement),null);
  await p.click('#restart');await waitWorld(p,w=>w.freed===5,'Developer restart fixture',45000);assert.equal((await read(p)).escape.opened,0);assert.equal((await read(p)).escape.bolts,0);
 });
 await run('losses-keep-escape',desktop,async(p,d)=>{
  await command(p,'kill');await waitWorld(p,w=>w.controlled>0&&w.alive===5,'Permanent loss and inheritance');await warp(p,832,880,d,90);await command(p,'centerview');await warp(p,864,856,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Recover spare after lost tool');await warp(p,832,880,d,90);await bolts(p,d);await toMeadow(p,d);assert.equal(d.won.escape.saved,5);
 });
 await run('solo-survivor-escape',desktop,async(p,d)=>{
  for(let remaining=5;remaining>=1;remaining--){await command(p,'kill');await waitWorld(p,w=>w.alive===remaining,'Remaining survivors '+remaining);}
  await warp(p,864,856,d,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Solo survivor recovers spare');await warp(p,832,880,d,90);await command(p,'centerview');await bolts(p,d);await toMeadow(p,d);assert.equal(d.won.escape.saved,1);assert.equal(d.won.outside.saved_visual,1,'The lone survivor waits in camp');
 });
 url='http://127.0.0.1:5198/';
 await run('ordinary-start-and-sealed-cover',desktop,async(p,d)=>{
  const s=await read(p);assert.equal(s.developmentEnd,false);assert.equal(s.escape.dev,0);assert.equal(s.world.freed,0);assert.equal(s.escape.opened,0);assert.equal(await p.locator('#dev-badge').isVisible(),false);
  await face(p,90);await press(p,'KeyE');await waitWorld(p,w=>w.wrench===1,'Ordinary wrench');await warp(p,832,880,d,90);await aim(p,0);await p.keyboard.down('KeyE');await p.waitForTimeout(1600);await p.keyboard.up('KeyE');d.closed=await read(p);assert.equal(d.closed.escape.bolts,0);assert.equal(d.closed.escape.opened,0);await shot(p,'normal-sealed-cover');
 });
 url='http://127.0.0.1:5198/?dev=end';
 await run('development-disabled',desktop,async(p,d,c)=>{
  // New load with the server capability denied. Both URL and native flag stay inert.
  await c.route('**/dev-config.json',route=>route.fulfill({json:{enabled:false}}));await p.reload();await startGame(p);await waitWorld(p,w=>w.ticks>35,'Disabled launch',45000);const s=await read(p);assert.equal(s.developmentEnd,false);assert.equal(s.escape.dev,0);assert.equal(s.world.freed,0);assert.equal(await p.locator('#dev-badge').isVisible(),false);d.disabled=s;
 });
 for(const[name,viewport]of[['ending-touch-portrait',{width:390,height:844}],['ending-touch-landscape',{width:844,height:390}]])await run(name,{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1},async(p,d,c)=>{
  const cdp=await c.newCDPSession(p);const box=await p.locator('[data-code="Space"]').boundingBox();assert.ok(box);await aim(p,0);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await p.waitForTimeout(1400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);assert.equal((await read(p)).escape.bolts,1,'Touch hold loosens aimed bolt');
  for(let i=1;i<4;i++){await aim(p,i);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await p.waitForTimeout(1400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);}
  await toMeadow(p,d);await shot(p,name+'-outside');const start=(await read(p)).outside,m=await p.locator('[data-code="KeyW"]').boundingBox();assert.ok(m);d.touchTarget=await p.evaluate(({x,y})=>{window.__touchEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>window.__touchEvents.push({type,target:e.target.id||e.target.dataset.code}));return document.elementsFromPoint(x,y).map(e=>({tag:e.tagName,id:e.id,code:e.dataset.code}));},{x:m.x+m.width/2,y:m.y+m.height/2});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:m.x+m.width/2,y:m.y+m.height/2}]});await p.waitForTimeout(800);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);d.touchEvents=await p.evaluate(()=>window.__touchEvents);assert.ok(start.z-(await read(p)).outside.z>1,'Outside touch movement');
  const rect=await p.locator('#outside-canvas').boundingBox();assert.ok(rect);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.width*.8,y:rect.height*.45}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.width*.25,y:rect.height*.45}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);assert.notEqual((await read(p)).outside.yaw,start.yaw,'Outside drag look');
 });
}finally{report.passed=report.cases.length===(selected?.length??7)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);console.log(JSON.stringify(report.cases.map(({name,passed,failure})=>({name,passed,failure}))));process.exit(report.passed?0:1);}
