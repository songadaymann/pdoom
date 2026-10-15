import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {wallApproaches} from './wall-qa-helpers.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='output/spatial-audio';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const attenuation=s=>{const p=s.panner,l=s.listener,d=Math.hypot(p.positionX-l.positionX,p.positionY-l.positionY,p.positionZ-l.positionZ);return s.gain*p.refDistance/(p.refDistance+p.rolloffFactor*(Math.max(d,p.refDistance)-p.refDistance));};
async function boot(level,hub=false){
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(hub=>{
  if(hub)localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true}));
  const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;this.addEventListener('message',({data:m})=>{
   if(m.audio==='play'&&m.spatial?.panner){const p=m.spatial.panner;window.__QA_SOUNDS__.push({time:performance.now(),frames:m.ch0.length,spatial:m.spatial});}
   if(m.audio==='spatial-update')window.__QA_UPDATES__.push(...m.updates.filter(u=>u.panner));
  });}};
  window.__QA_SOUNDS__=[];window.__QA_UPDATES__=[];window.__QA_CARDS__=[];
  window.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const card=document.querySelector('#discovery-card');if(!card||card.hidden||window.__QA_CARD_OPEN__)return;
   window.__QA_CARD_OPEN__=true;const start=performance.now(),s=JSON.parse(window.render_game_to_text());let stable;
   setTimeout(()=>{stable=JSON.parse(window.render_game_to_text());},2800);
   const observer=new MutationObserver(()=>{if(!card.hidden)return;observer.disconnect();window.__QA_CARD_OPEN__=false;window.__QA_CARDS__.push({name:card.querySelector('strong').textContent,duration:performance.now()-start,start:s,stable});});observer.observe(card,{attributes:true,attributeFilter:['hidden']});
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']}));
 },hub);
 await page.goto('http://127.0.0.1:5198/?level='+level+'&ceo=altman');await startGame(page);const q=nativeQA(page);await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Boot '+level,60000);return {page,q};
}
try{
 // Real browser rendering of mono signals tests the actual playback graph.
 const a=await browser.newPage();await a.goto('http://127.0.0.1:5198/');report.renderedAudio=await a.evaluate(async()=>{
  const {DoomAudio}=await import('/audio.js');
  async function signal(x,gain=1,spatial=true){const audio=new DoomAudio(),ctx=audio.context=new OfflineAudioContext(2,22050,22050),pcm=new Float32Array(22050).fill(.25),bus=ctx.createGain();bus.connect(ctx.destination);ctx.pdoomBuses={music:bus,sfx:bus};
   const state={sourceId:1,gain,playbackRate:1,panner:spatial?{positionX:x,positionY:0,positionZ:-4,orientationX:0,orientationY:0,orientationZ:0,panningModel:'equalpower',distanceModel:'inverse',refDistance:10,maxDistance:3.4028234663852886e38,rolloffFactor:1,coneInnerAngle:360,coneOuterAngle:360,coneOuterGain:0}:null,listener:spatial?{positionX:0,positionY:0,positionZ:0,forwardX:0,forwardY:0,forwardZ:-1,upX:0,upY:1,upZ:0}:null};
   audio.accept({audio:'play',sourceId:1,ch0:pcm,sampleRate:22050,channels:1,spatial:state});
   if(gain===.1)audio.accept({audio:'spatial-update',updates:[{...state,gain:.1}]});
   const b=await ctx.startRendering();return [...Array(2)].map((_,i)=>{const s=b.getChannelData(i);return Math.sqrt(s.slice(4096).reduce((n,v)=>n+v*v,0)/(s.length-4096));});}
  return {left:await signal(-10),right:await signal(10),far:await signal(1000),quiet:await signal(10,.1),local:await signal(0,1,false)};
 });assert.ok(report.renderedAudio.right[1]>report.renderedAudio.right[0]*2);assert.ok(report.renderedAudio.left[0]>report.renderedAudio.left[1]*2);assert.ok(report.renderedAudio.far[1]<report.renderedAudio.right[1]*.02);assert.ok(report.renderedAudio.quiet[1]<report.renderedAudio.right[1]*.11);assert.ok(report.renderedAudio.local.every(n=>n>.15));report.cases.push('Real Web Audio renders directional near/far sources, volume updates and unattenuated local cues');await a.close();
 const {page,q}=await boot('hal-station');await page.waitForTimeout(12000);
 // Beth's evaluation doors only pulse while the player is near them (since 2026-10-08), so the entrance hears no cycle.
 const s=await q.read(),doors=s.sound.recent.filter(m=>[13816,13882].includes(m.frames));assert.ok(doors.every(d=>attenuation(d.spatial)<.02));report.startupDoors=doors.map(d=>({frames:d.frames,attenuation:attenuation(d.spatial),spatial:d.spatial}));assert.ok(s.sound.spatialUpdates>0);report.cases.push('Evaluation hydraulic doors are silent (below 2% volume) at the HAL entrance');
 await q.command('god');await q.warp(352,-1408,0);await page.waitForTimeout(17000);const near=(await q.read()).sound.recent.filter(m=>[13816,13882].includes(m.frames)&&m.spatial?.listener?.positionZ>1300);assert.ok(near.some(d=>attenuation(d.spatial)>.15));report.nearDoors=near.map(d=>({frames:d.frames,attenuation:attenuation(d.spatial)}));
 const updates=await page.evaluate(()=>window.__QA_UPDATES__);assert.ok(updates.some(u=>u.listener.positionZ>1300));report.cases.push('Native listener follows player; the same door machinery is audible nearby');
 // Tea's actual swap still opens Rob's cell. Discovery is then observed, not faked.
 await q.warp(-438,-170,15);await q.press('KeyE');await q.wait(s=>s.world.people[0].released,'Tea robot STOP',18000);
 await q.warp(-220,-64,0);await page.waitForFunction(()=>window.__QA_CARDS__.some(c=>c.name==='ROB MILES'),{timeout:15000});
 const card=await page.evaluate(()=>window.__QA_CARDS__.find(c=>c.name==='ROB MILES'));assert.ok(card.duration>=3400&&card.duration<4200);assert.ok(card.stable.uiBlocked);assert.equal(card.stable.world.x,card.start.world.x);assert.equal(card.stable.world.y,card.start.world.y);assert.ok(card.stable.run.activeTics<=card.start.run.activeTics+7);assert.equal(card.stable.sound.cuesPlayed,card.start.sound.cuesPlayed);assert.ok(card.start.sound.cuesPlayed>=1);report.discovery={duration:card.duration,cues:card.start.sound.cuesPlayed,clockStart:card.start.run.activeTics,clockDuring:card.stable.run.activeTics};report.cases.push('Rob discovery stays 3.5s, pauses the native clock and plays exactly one Doom power-up cue');
 assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue/.test(l))),[]);await page.screenshot({path:out+'/rob-after-card.png'});await page.close();
 for(const level of ['hal-station','five-prisons']){
  const{page,q}=await boot(level,true);assert.equal((await q.read()).world.entry_hub,1);const hal=level==='hal-station';await q.warp(...(hal?[256,520,90]:[1096,928,0]));await q.command('centerview');assert.equal((await q.read()).world.prompt,'Hold SPACE - return to SAFE MODE');await page.screenshot({path:out+'/'+level+'-crank-front.png'});
  await q.warp(...(hal?[224,520,60]:[1096,896,30]));await q.command('centerview');await page.screenshot({path:out+'/'+level+'-crank-oblique.png'});
  // Audit authored wall hardware, including door controls and refuge overrides.
  const {map,approach}=await wallApproaches(hal?'hal':'checkpoint');for(const[m,p]of map.wall_mounts.entries()){
   await q.warp(...approach(p,48));await q.command('centerview');await page.screenshot({path:out+'/'+level+'-wall-'+m+'.png'});
  }
  if(hal)assert.ok((await q.read()).doors.panels.every(p=>p.wall_sprite===1));
  await q.warp(...(hal?[256,520,90]:[1096,928,0]));await q.hold('KeyE',1850);await q.wait(s=>s.outside?.active,'Wall crank actually retreats',25000);report.cases.push(level+': refuge crank and '+map.wall_mounts.length+' authored mounts reviewed; wall crank still returns to SAFE MODE');
  assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue/.test(l))),[]);await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);for(const p of browser.contexts().flatMap(c=>c.pages())){report.final=await p.evaluate(()=>window.render_game_to_text?.()).catch(()=>null);report.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs?.slice(-25)).catch(()=>null);await p.screenshot({path:out+'/failure.png'}).catch(()=>{});}}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure,discovery:report.discovery}));process.exit(report.passed?0:1);
