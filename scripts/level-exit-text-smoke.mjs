// Levels 1-2's exit text (spec 06 section 8.3, 2026-10-20). Muted. Three playthroughs:
//  first:   no save, level 1's end fixture, out through the duct: no text screen, straight melt,
//           and the save now reaches SAFE MODE.
//  hal:     a save that already reached SAFE MODE with one HAL person still following (Dario).
//           Load, walk in at HAL3000.SYS, wait for them in the Faraday Room, crank out together:
//           THE SHORES OF HAL types over Doom's E1 flat (FLOOR4_8) with Dario's line, Space finishes,
//           Space melts into the meadow. The results card waits (unread) instead of opening, and
//           the save gains them. Then in again and out by the crank alone: nobody comes out with
//           you, so no text.
//  control: the same later exit for level 1 with Sam (KNEE-DEEP IN THE DATA).
// node scripts/level-exit-text-smoke.mjs   (CASES=first,hal,control to limit)
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {escapeHelpers} from './escape-browser-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/campaign-v2/exit-text';await fs.mkdir(out,{recursive:true});
const only=process.env.CASES?.split(',');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};
const record=text=>{report.cases.push(text);console.log(text);};
const KEY='pdoom.campaign.v1';

async function open(name,url,save){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(`${name}: ${e}`));
 await page.addInitScript(([key,save])=>{
  const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
  if(save&&!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.setItem(key,JSON.stringify(save));}
 },[KEY,save]);
 const q=nativeQA(page),shot=(_,n)=>page.screenshot({path:`${out}/${name}-${n}.png`});
 await page.goto(url);await startGame(page);
 return {page,...q,shot};
}
// Counts every time the text screen is shown, so an exit can prove it never was.
const watchText=page=>page.evaluate(()=>{
 const el=document.getElementById('exit-text');window.__exitTextShown=0;
 window.__exitTextWatch?.disconnect();
 window.__exitTextWatch=new MutationObserver(()=>{if(!el.hidden)window.__exitTextShown++;});
 window.__exitTextWatch.observe(el,{attributes:true,attributeFilter:['hidden']});
});
const stored=async page=>JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY));

// Stands at the hub crank inside the refuge, waits for the follower to shelter there too (the
// crank's exit takes whoever is in the refuge or right beside you), then holds SPACE on it.
async function crankOut(run,{hal,follower}){
 const {wait,warp,command,hold}=run;
 if(hal)await warp(256,520,90);else await warp(1100,928,0);
 await command('centerview');
 await wait(s=>/return to SAFE MODE/.test(s.world.prompt),'Facing the hub crank',8000);
 if(follower!=null)await wait(s=>{const p=s.world.people[follower],w=s.world;return p.alive&&p.released&&(w.sheltered>=1||Math.hypot(p.x-w.x,p.y-w.y)<120);},'The returning follower joins you at the crank',90000);
 await run.shot(null,'crank');
 await hold('KeyE',1850);
}

// The later exit's text screen, typed over FLOOR4_8, then on into the meadow.
async function textScreen(run,{title,ceoLine}){
 const {page,wait,read}=run;
 const typing=await wait(s=>s.exitText.phase==='typing'&&s.exitText.visible&&s.melt.phase==='idle'&&s.exitText.chars>40,'The exit text types out over the flat',20000);
 assert.ok(typing.exitText.chars<typing.exitText.total,'Typed a character at a time');
 assert.match(typing.exitText.text,title);
 assert.equal(typing.scoreView.open,false,'No results card over the text');
 assert.equal(typing.outside?.paused,true,'The meadow waits, paused, behind the text');
 // The flat is Doom's FLOOR4_8 (local/ui/textscreen-e1.png), tiled from the top left.
 const flat=await page.evaluate(async()=>{
  const screen=document.querySelector('#exit-text canvas'),image=new Image();image.src='local/ui/textscreen-e1.png';await image.decode();
  const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');g.drawImage(image,0,0);
  const at=(ctx,x,y)=>[...ctx.getImageData(x,y,1,1).data.slice(0,3)];
  const s=screen.getContext('2d');return {screen:at(s,319,199),flat:at(g,319%64,199%64)};
 });
 assert.deepEqual(flat.screen,flat.flat,"Bottom-right corner shows FLOOR4_8's pixel");
 await run.shot(null,'text-typing');
 await page.keyboard.press('Space');await wait(s=>s.exitText.chars===s.exitText.total,'Space finishes the text',3000);
 await page.waitForTimeout(500);
 const full=await read();assert.equal(full.exitText.chars,typing.exitText.total,'The finished text stays finished');
 assert.match(full.exitText.text,ceoLine);
 assert.ok(full.exitText.lines<=17,`The text fits the 320 x 200 screen (${full.exitText.lines} lines)`);
 await run.shot(null,'text-full');
 await page.keyboard.press('Space');
 return wait(s=>s.outside?.active&&!s.outside.paused&&s.melt.phase==='idle'&&!s.exitText.visible,'Space melts into the meadow',15000);
}

try{
 if(!only||only.includes('first')){
  const run=await open('first','http://127.0.0.1:5198/?dev=end&ceo=altman',null);
  const escape=escapeHelpers({read:()=>run.read(),command:(_,t)=>run.command(t),face:(_,a)=>run.face(a),warp:(_,x,y,d,a)=>run.warp(x,y,a),crawlAxis:async(_,axis,target)=>{await run.face(90);for(let i=0;i<65;i++){const w=(await run.read()).world,d=target-w[axis];if(Math.abs(d)<6)return;const k=axis==='x'?(d>0?'KeyD':'KeyA'):(d>0?'KeyW':'KeyS');await run.hold(k,Math.min(450,Math.max(28,Math.abs(d)*9)));}throw Error('Crawl '+axis+target);},shot:run.shot});
  await run.wait(s=>s.mode==='playing'&&s.world?.group_gathered,'First level fixture',55000);
  await watchText(run.page);
  await escape.bolts(run.page,{});await escape.toMeadow(run.page,{});
  await run.wait(s=>s.campaign.saved0===31,'First camp committed');
  assert.equal(await run.page.evaluate(()=>window.__exitTextShown),0,'No text screen on the first exit');
  assert.equal((await stored(run.page)).hub,true,'The save now reaches SAFE MODE');
  record('First exit (no save): the duct melts straight into the meadow, no text screen; the save reaches SAFE MODE');
  await run.page.close();
 }
 if(!only||only.includes('hal')){
  const save={version:1,ceo:'amodei',hub:true,saved0:31,saved1:30,lost0:0,lost1:0,following0:0,following1:1};
  const run=await open('hal','http://127.0.0.1:5198/?level=hal-station&ceo=amodei',save);
  await run.wait(s=>s.mode==='playing'&&s.levelId==='hal-station'&&s.world.entry_hub===1,'Walked into HAL from SAFE MODE',30000);
  await crankOut(run,{hal:true,follower:0});
  let s=await textScreen(run,{title:/^HAL3000 watched every step/,ceoLine:/promising early result\.$/});
  assert.equal(s.outside.currentLevel,'hal-station');
  s=await run.wait(s=>s.scoreView.available,'Results ready once the camp settles',30000);
  assert.equal(s.scoreView.open,false,'The results card did not open by itself');assert.equal(s.scoreView.unread,true,'Results wait behind the unread button');
  assert.equal((await stored(run.page)).saved1,31,'The save gains the follower');
  await run.shot(null,'meadow');
  record("Later exit (HAL, SAFE MODE save, crank with the returning follower): THE SHORES OF HAL types over FLOOR4_8 with Dario's line; Space finishes, Space melts into the meadow; results wait unread; save 10/10");
  // Back in (everyone camped now), and out alone: an exit that brings nobody out shows no text.
  await run.page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(1,-202,0,0));
  await run.wait(s=>s.outside.nearestDoor==='hal-station','At HAL3000.SYS',5000);await run.press('KeyE');
  await run.wait(s=>s.mode==='playing'&&s.levelId==='hal-station'&&s.world.entry_hub===1,'Back into HAL',30000);
  await watchText(run.page);
  await crankOut(run,{hal:true});
  s=await run.wait(s=>s.outside?.active&&!s.outside.paused&&s.melt.phase==='idle'&&s.run.result,'Retreat alone into the meadow',30000);
  assert.equal(s.run.result.savedFigures,0,'Nobody came out this time');
  assert.equal(await run.page.evaluate(()=>window.__exitTextShown),0,'No text screen when nobody came out');
  assert.equal(s.scoreView.open,false,'No card over the meadow');
  await run.shot(null,'retreat');
  record('Crank retreat alone after everyone is camped: straight into the meadow, no text screen');
  await run.page.close();
 }
 if(!only||only.includes('control')){
  const save={version:1,ceo:'altman',hub:true,saved0:30,saved1:31,lost0:0,lost1:0,following0:1,following1:0};
  const run=await open('control','http://127.0.0.1:5198/?ceo=altman',save);
  await run.wait(s=>s.mode==='playing'&&s.levelId==='five-prisons'&&s.world.entry_hub===1,'Walked into the bunker from SAFE MODE',30000);
  await crankOut(run,{hal:false,follower:0});
  const s=await textScreen(run,{title:/^Five people\. Nine cameras\./,ceoLine:/resist the urge to announce it\.$/});
  assert.equal(s.outside.currentLevel,'five-prisons');
  assert.equal((await stored(run.page)).saved0,31,'The save gains the follower');
  record("Later exit (level 1, Sam): KNEE-DEEP IN THE DATA types over FLOOR4_8 with Sam's line, then the meadow; save 10/10");
  await run.page.close();
 }
 assert.deepEqual(report.errors,[]);
 report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure);
 for(const page of browser.contexts().flatMap(c=>c.pages()))await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(report.passed?0:1);
