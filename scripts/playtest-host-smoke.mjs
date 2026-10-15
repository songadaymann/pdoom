import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.argv[2]||'http://127.0.0.1:5199/';
const out=process.env.DOOM_OUT||'output/playtest/verification';await fs.mkdir(out,{recursive:true});
const report={url:base,cases:[],errors:[],networkErrors:[],externalWrites:[]};
const inventory=JSON.parse(await fs.readFile('output/playtest/package.json','utf8'));
const fileMap=new Map(inventory.files.map(r=>[r.file,r]));
async function get(file,options){const r=await fetch(new URL(file,base),{signal:AbortSignal.timeout(45000),...options});return r;}
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
function observe(p){p.on('pageerror',e=>report.errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});});p.on('request',r=>{if(!['GET','HEAD'].includes(r.method())&&new URL(r.url()).origin!==new URL(base).origin)report.externalWrites.push(r.url());});}
async function playing(p){await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='playing'&&s.menu.page==='closed'&&s.world?.ticks>10;},{},{timeout:90000});}
try{
 const root=await get('');assert.equal(root.status,200);assert.match(root.headers.get('x-robots-tag'),/noindex/);assert.match(await root.text(),/p\(DOOM\)/);
 const checked=['main.js','asset-loader.js','outside/outside.js','pdoom.pk3','engine/engine.worker.js','engine/gzdoom.js','engine/gzdoom.wasm','local/DOOM.WAD','local/ui/pdoom-logo.png','local/ui/title-heroes.webp','local/ui/faces/mario/STFST01.png','music/bliss.mp3','local/rescue-music.ogg'];
 await Promise.all(checked.map(async file=>{const r=await get(file);assert.equal(r.status,200,file);const b=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(b).digest('hex'),fileMap.get(file).sha256,file);if(file.endsWith('.wasm'))assert.match(r.headers.get('content-type'),/application\/wasm/);}));
 report.cases.push('Remote root and 13 key engine/mod/UI/meadow/music assets match staged hashes');
 for(const file of ['local/intro/intro-mario.mp4','local/intro/intro-samwise.mp4','local/intro/levels/e1m4-intro.mp4','local/intro/levels/e1m7-intro.mp4','music/bliss.mp3']){
  const r=await get(file,{headers:{Range:'bytes=32-159'}});
  assert.equal(r.status,206,file);assert.equal(r.headers.get('content-range'),`bytes 32-159/${fileMap.get(file).bytes}`);assert.equal((await r.arrayBuffer()).byteLength,128);
 }
 report.cases.push('Both hero films, both level films and Bliss music support byte-range playback');
 const dev=await get('dev-config.json');assert.equal((await dev.json()).enabled,false);
 for(const file of ['dev/ending-qa.pk3','local/promo/pdoom-promo-fullframe.mp4','outside/outside.js.map','.env'])assert.equal((await get(file)).status,404,file);
 const config=await (await get('leaderboard-config.json')).json();assert.equal(config.mode,'playtest');assert.equal(config.endpoint,'/api/v1/leaderboard');
 const scores=await (await get('api/v1/leaderboard?slug=pdoom&variant=hal-station-rescue-v3')).json();assert.equal(scores.success,true);assert.equal(scores.playtest,true);
 report.cases.push('Dev shortcuts off; source/QA/promo excluded; scoreboards read from isolated playtest D1');
 // Public New Game: title -> menu -> hero -> the Last Stand prologue, no level select.
 {const ctx=await browser.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage();observe(p);
  await p.goto(base);await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-new');await p.click('#hero-next');
  // The chosen founder's film plays first (2026-10-12).
  await p.waitForSelector('#intro-video video');await p.waitForFunction(()=>document.querySelector('#intro-video video')?.currentTime>.3);await p.click('.iv-skip');
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).prologue?.phase==='battle',{},{timeout:60000});assert.equal(await p.locator('[data-view="levels"]').isVisible(),false);
  await p.screenshot({path:`${out}/new-game-prologue.png`});
  // Skip into the Bliss intro: the guide's walk/idle frames and voice must all be on the host.
  await p.click('.war-skip');await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.outside?.intro&&s.outside.guide;},{},{timeout:60000});
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside.guide.speaking==='call',{},{timeout:15000});await p.screenshot({path:`${out}/new-game-bliss.png`});
  report.cases.push('New Game -> hero -> founder film (skip) -> prologue battle (no level select) -> Skip -> Bliss intro with the founder calling');await ctx.close();}
 // Each level directly, through the developer level select (?levels=1).
 for(const [id,hero] of [['five-prisons','altman'],['hal-station','amodei']]){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage();observe(p);
  await p.goto(new URL(`?ceo=${hero}&levels=1`,base).href);await p.waitForFunction(()=>window.render_game_to_text);assert.equal((await read(p)).menu.page,'title');
  await p.screenshot({path:`${out}/${id}-title.png`});await p.click('#title-enter');
  await p.waitForFunction(()=>document.querySelector('#menu-film')?.currentTime>.3);await p.screenshot({path:`${out}/${id}-main.png`});
  assert.equal(await p.locator('#menu-load').isDisabled(),true);await p.click('#menu-new');await p.click('#hero-next');await p.click('#level-'+id);
  await p.waitForSelector('#intro-video video');await p.waitForFunction(()=>document.querySelector('#intro-video video')?.currentTime>.3);await p.screenshot({path:`${out}/${id}-film.png`});await p.click('.iv-skip');
  await playing(p);let s=await read(p);assert.equal(s.levelId,id);assert.equal(s.ceo,hero);assert.equal(s.statusBar.error,null);assert.equal(s.scoreView.scope,'playtest');
  assert.equal(s.musicPlaying,true);assert.equal(s.audioState,'running');
  const before=s.world;await p.keyboard.down('w');await p.waitForTimeout(350);await p.keyboard.up('w');
  await p.waitForFunction(before=>{const w=JSON.parse(window.render_game_to_text()).world;return Math.hypot(w.x-before.x,w.y-before.y)>8;},before,{timeout:5000});
  await p.screenshot({path:`${out}/${id}-gameplay.png`});report[id]=await read(p);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).menu.page==='main');await p.waitForTimeout(300);const ticks=(await read(p)).run.activeTics;await p.waitForTimeout(500);assert.equal((await read(p)).run.activeTics,ticks);await p.keyboard.press('Escape');await playing(p);
  await p.reload();await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-new');await p.click('#hero-next');await p.click('#level-'+id);await playing(p);assert.equal(await p.locator('#intro-video').count(),0);
  report.cases.push(`${id}: real title/menu film/level film/native movement/audio/Esc pause/return visit skip`);await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 await ctx.addInitScript(()=>{localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'amodei',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0}));});
 const p=await ctx.newPage();observe(p);await p.goto(base);await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-load');
 await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.outside?.active&&s.menu.page==='closed'&&s.campaign.saved===10;},{},{timeout:90000});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.audio?.loaded,{},{timeout:45000});
 await p.waitForTimeout(1500);
 await p.screenshot({path:out+'/safe-mode-loaded.png'});report.outside=await read(p);assert.equal(report.outside.scoreView.open,false);
 // HAL now faces diagonally. Stand outside its real doorway and look back;
 // the former (1,-202) fixture points into the side of the dome.
 await p.evaluate(()=>{const yaw=-223*Math.PI/180;window.__DOOM_DEBUG__.outside.debug.setView(2.6-Math.sin(yaw)*6,-200.1-Math.cos(yaw)*6,yaw+Math.PI,0);});await p.waitForTimeout(500);await p.screenshot({path:out+'/hal-safe-mode-door.png'});
 const music=(await get('music/bliss.mp3'));assert.match(music.headers.get('content-type'),/audio\/mpeg/);await ctx.close();
 report.cases.push('Real Load Game restores ten camped survivors into hosted SAFE MODE; meadow assets/music/visible HAL entrance, no automatic score overlay');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),m=await mobile.newPage();observe(m);await m.goto(base+'?levels=1');await m.waitForFunction(()=>window.render_game_to_text);await m.tap('#title-enter');await m.tap('#menu-new');await m.tap('#hero-next');const box=await m.locator('#level-hal-station').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await m.screenshot({path:out+'/mobile-menu.png'});await mobile.close();report.cases.push('Phone-sized menu fits and supports touch navigation (native mobile compatibility not claimed)');
 assert.deepEqual(report.externalWrites,[]);assert.deepEqual(report.networkErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error);report.passed=false;}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure,errors:report.errors},null,2));if(!report.passed)process.exitCode=1;
