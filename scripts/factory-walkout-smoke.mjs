// Level 3's walk out (2026-10-20), muted, from the ?puzzle=walkout loopback start: all five safe
// in the break room, you at the TV. Space broadcasts MEG3N.AVI; then the player hops along the
// arrows' route (the builder's output/factory/route-debug.json) to the exit switch.
//  - Every big screen on the route goes live and stays live; there are at least 12 of them.
//  - The broadcast never ends: MEG3N stays at the LINE room's big screen dancing, her song keeps
//    playing (the six-second clip, about every six seconds) and the level's own track waits.
//  - The five follow in single file: nobody stands inside anybody.
// node scripts/factory-walkout-smoke.mjs
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/walkout';await fs.mkdir(out,{recursive:true});
const {route}=JSON.parse(await fs.readFile('output/factory/route-debug.json','utf8'));
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[],samples:[]};const record=text=>{report.cases.push(text);console.log(text);};
page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,warp,command}=nativeQA(page);
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
// The radio clip (art/factory-radio, 5.94 s at 22050 Hz) as the engine hands it to the page.
const songPlays=s=>s.sound.recent.filter(r=>r.frames>120000&&r.frames<140000).map(r=>r.sourceId);
try{
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory&puzzle=walkout');await startGame(page,{console:true});
 let s=await wait(s=>s.mode==='playing'&&s.factory?.all_safe&&s.world.sheltered===5&&s.world.ticks>40,'All five safe in the break room',60000);
 await command('god');
 assert.ok(s.factory.route_screens>=12,`Big screens along the route: ${s.factory.route_screens}`);
 await wait(s=>s.world.prompt==='SPACE - broadcast MEG3N.AVI','TV prompt',10000);await shot('0-tv');
 await page.keyboard.press('Space',{delay:80});
 s=await wait(s=>s.factory.on_air&&s.factory.evacuating,'Broadcast goes live',5000);const liveAt=s.world.ticks;
 record(`MEG3N.AVI goes live from the TV; ${s.factory.route_screens} big screens line the route`);
 // Hop along the route: a few cells at a time, each time letting the five catch up on foot.
 const hops=[];for(let k=6;k<route.length-2;k+=7)hops.push(k);
 let overlaps=0,samples=0,songs=new Set();
 for(const [n,k] of hops.entries()){
  const [x,y]=route[k],[nx,ny]=route[Math.min(route.length-1,k+3)];
  await warp(x,y,Math.round(Math.atan2(ny-y,nx-x)*180/Math.PI+360)%360);
  await page.waitForTimeout(2600);s=await read();
  const near=s.world.people.filter(p=>Math.hypot(p.x-s.world.x,p.y-s.world.y)<400);
  let min=Infinity;for(let a=0;a<near.length;a++)for(let b=a+1;b<near.length;b++)min=Math.min(min,Math.hypot(near[a].x-near[b].x,near[a].y-near[b].y));
  if(near.length>1){samples++;if(min<20)overlaps++;}
  report.samples.push({hop:n,x,y,near:near.length,min:Math.round(min),meg:[Math.round(s.factory.guardian_x),Math.round(s.factory.guardian_y),s.factory.guardian_mode],music:s.musicPlaying});
  for(const id of songPlays(s))songs.add(id);
  assert.equal(s.factory.on_air,1,'Still on air');assert.equal(s.musicPlaying,false,"The level's own track waits while her song plays");
  if(n%4===0)await shot(`walk-${String(n).padStart(2,'0')}`);
 }
 console.log(JSON.stringify(report.samples.map(t=>[t.hop,t.near,t.min])));
 assert.ok(samples>=10,`Enough samples with company (${samples})`);
 assert.ok(overlaps<=Math.floor(samples*.1),`Nobody stands inside anybody (${overlaps} of ${samples} samples had two people closer than 20 units)`);
 record(`Single file: ${samples-overlaps} of ${samples} samples with nobody inside anybody`);
 s=await read();
 assert.ok(s.world.ticks-liveAt>2100,`Past the old 60 s limit (${s.world.ticks-liveAt} tics)`);
 assert.equal(s.factory.guardian_mode,6,'MEG3N still dancing at her screen');assert.ok(Math.hypot(s.factory.guardian_x-2240,s.factory.guardian_y-772)<40);
 assert.ok(songs.size>=Math.floor((s.world.ticks-liveAt)/210/2),`Her song keeps playing (${songs.size} plays heard over ${s.world.ticks-liveAt} tics)`);
 for(const key of ['megan-viral','megan-views'])assert.ok(s.voiceOver?.played?.includes(key),`Take ${key} played (${s.voiceOver?.played})`);
 record(`The broadcast outlasts the old 60 s (${Math.round((s.world.ticks-liveAt)/35)} s): MEG3N keeps dancing at the big screen, her song plays throughout (${songs.size} loops), the level track waits`);
 // Out: everyone to the exit, the switch.
 await warp(1056,-530,270);
 await wait(s=>s.world.people.every(p=>p.x>980&&p.x<1130&&p.y>-580&&p.y<-200),'Everyone reaches the exit',60000);await shot('exit-room');
 await wait(s=>s.world.prompt==='SPACE - leave the factory','Exit prompt',5000);
 await page.keyboard.press('Space',{delay:80});await wait(s=>s.factory.exit_done,'Exit switch',5000);
 record('Everyone reaches the exit switch and leaves together');
 assert.deepEqual(report.errors,[]);
 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs);
 assert.deepEqual(logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown texture/.test(l)),[]);
 report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure.slice(0,2500));await shot('failure').catch(()=>{});}
finally{report.final=await read().catch(()=>null);await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(report.passed?0:1);
