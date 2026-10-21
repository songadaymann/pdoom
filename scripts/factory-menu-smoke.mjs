// MEG3N's factory from the episode menu (2026-10-20): SPAWNING CHATS starts E2M7 cold on the
// campaign page, like the other episodes, and its exit commits the clear to the campaign. Muted.
// Like levels 1-2, the first entry plays the level's intro film (E2M7, scripts/level-intros.json).
//  1. A new player (no save): levels menu -> SPAWNING CHATS -> the E2M7 film (Skip ends it) ->
//     the factory's real start (no
//     wrench, not the SAFE MODE front door, the factory HUD), nothing saved yet.
//  2. QA puts everyone at the exit (pdoom_factory_site 7, then RESTART LEVEL): the exit switch
//     commits natively (PDOOM_CAMPAIGN saved2 31), the first exit of the playthrough melts straight
//     into the meadow at MEG3N.AVI (no text), and the save reaches SAFE MODE with the five (5/20).
//  3. MEG3N.AVI's door: no film (already watched), and the native session holds the clear too
//     (all five at camp, not inside).
//  4. A SAFE MODE save walking into MEG3N.AVI for the first time: the film, the meadow paused under it,
//     then the factory's front door.
//  5. From a running SAFE MODE save, New Game -> SPAWNING CHATS reloads the campaign page
//     (start=meg3n-factory) into a cold factory and replaces the old save.
// node scripts/factory-menu-smoke.mjs   (CASES=menu,door,handoff to limit)
import {chromium} from '@playwright/test';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/menu';await fs.mkdir(out,{recursive:true});
const only=process.env.CASES?.split(',');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};const record=text=>{report.cases.push(text);console.log(text);};
const controls=await fs.readFile('doom-web/controls.cfg','utf8');
const MEG3N_DOOR={x:-150.2,z:2.5};let current=null;
async function open(name,save){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(`${name}: ${e}`));
 await page.route('**/controls.cfg',r=>r.fulfill({contentType:'text/plain',body:controls+'\nbind ` "toggleconsole"\n'}));
 await page.addInitScript(save=>{
  const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
  if(!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.removeItem('pdoom.campaign.v1');if(save)localStorage.setItem('pdoom.campaign.v1',JSON.stringify(save));}
 },save);
 const qa=nativeQA(page);
 const menu=view=>page.waitForFunction(view=>JSON.parse(window.render_game_to_text()).menu?.page===view,view,{timeout:15000});
 const saved=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')));
 const hud=()=>page.evaluate(()=>({factory:document.getElementById('stage').classList.contains('factory-prototype'),checkpoint:document.getElementById('stage').classList.contains('checkpoint'),statusbar:!document.querySelector('#hud .doom-statusbar')?.hidden}));
 const shot=n=>page.screenshot({path:`${out}/${name}-${n}.png`});
 current={page,...qa,menu,saved,hud,shot};return current;
}
// The level's intro film: E2M7's, playing (the engine waits behind it) until Skip.
async function film(t,label,{shot=null}={}){
 await t.page.waitForFunction(()=>document.querySelector('#intro-video video')?.currentTime>1,null,{timeout:30000});
 const src=await t.page.evaluate(()=>document.querySelector('#intro-video video').currentSrc);
 assert.match(src,/e2m7-intro\.mp4$/,`${label}: the E2M7 film (${src})`);
 assert.equal((await t.read()).world,null,'The engine starts behind the film');
 if(shot)await t.shot(shot);
 await t.page.click('.iv-skip');
 await t.page.waitForFunction(()=>!document.getElementById('intro-video'),null,{timeout:6000});
}
// The cold factory, wherever it was started from: E2M7's own start, not SAFE MODE's front door.
async function coldFactory(t,label){
 const s=await t.wait(s=>s.mode==='playing'&&s.levelId==='meg3n-factory'&&s.world?.level==='meg3n-factory'&&s.factory&&s.menu.page==='closed'&&s.world.ticks>35,label,90000);
 assert.equal(s.factory.hub_entry,0,'Not a walk-in from SAFE MODE');
 assert.ok(Math.hypot(s.world.x-1056,s.world.y+530)>256,`At E2M7's start, not the exit room (${s.world.x},${s.world.y})`);
 assert.equal(s.world.wrench,0,"The wrench is still on the showroom floor");
 assert.ok(s.world.people.every(p=>!p.released&&!p.camped),'All five captive');
 const h=await t.hud();assert.ok(h.factory&&h.checkpoint&&h.statusbar,`Factory HUD with the status bar: ${JSON.stringify(h)}`);
 assert.equal(s.mod,"p(DOOM): MEG3N's Toy Factory");
 return s;
}
try{
 if(!only||only.includes('menu')){
  const t=await open('menu');
  await t.page.goto('http://127.0.0.1:5198/?ceo=altman&levels=1');await t.page.waitForFunction(()=>window.render_game_to_text);
  await t.page.click('#title-enter');await t.menu('main');await t.page.click('#menu-new');await t.menu('hero');await t.page.click('#hero-next');await t.menu('levels');
  const entry=t.page.locator('#level-meg3n-factory');
  assert.equal(await entry.isDisabled(),false,'SPAWNING CHATS is enabled');assert.match(await entry.innerText(),/SPAWNING CHATS\s*INFERENCE/);
  assert.equal(await t.page.locator('[data-view="levels"] button:disabled').count(),1,'Only HUMAN CONTAINMENT AREA is still to come');
  await t.shot('1-levels');
  await entry.click();
  await film(t,'SPAWNING CHATS',{shot:'1-film'});
  let s=await coldFactory(t,'SPAWNING CHATS starts the factory');
  assert.equal(await t.saved(),null,'Nothing saved before the exit');assert.equal(s.campaign.saved,0);
  // Level 3 ranks like levels 1-2 (2026-10-21): a fresh menu start is a run that can reach its board.
  s=await t.wait(s=>s.run?.runId&&s.run.activeTics>35,'A run starts with its active clock',15000);
  assert.equal(s.run.practiceReason,'','A fresh menu start can rank');
  await t.shot('1-start');record('Episode menu: SPAWNING CHATS (INFERENCE) plays the E2M7 film, then starts E2M7 cold on the campaign page: its own start, no wrench, factory HUD, nothing saved');
  // 2. QA only: restart at the exit with all five safe (the ?puzzle=exit start).
  await t.command('pdoom_development 1');await t.command('pdoom_factory_site 7');
  await t.page.keyboard.press('Escape');await t.menu('main');await t.page.click('#menu-restart');await t.menu('confirm');await t.page.click('#menu-confirm');
  s=await t.wait(s=>s.mode==='playing'&&s.factory?.all_safe&&s.world?.prompt==='SPACE - leave the factory'&&s.world.people.every(p=>p.x>980&&p.x<1130&&p.y>-580&&p.y<-300),'Restarted at the exit with all five',60000);
  assert.equal(s.factory.hub_entry,0);
  assert.ok(s.run.practiceReason,'A QA restart at the exit is practice');
  await t.page.keyboard.press('Space',{delay:80});
  s=await t.wait(s=>s.factory?.exit_done&&s.melt.phase!=='idle','The exit switch freezes the last frame',5000);
  assert.ok(s.events.some(e=>e.type==='factory-exit'&&e.saved===31&&e.hub===0&&e.committed===1),'The exit commits natively');
  const logs=await t.page.evaluate(()=>window.__DOOM_DEBUG__.logs);
  assert.ok(logs.some(l=>l.includes('PDOOM_CAMPAIGN {"saved2":31,"lost2":0,"following2":0}')),'PDOOM_CAMPAIGN from the factory');
  s=await t.wait(s=>s.outside?.active&&s.outside.currentLevel==='meg3n-factory'&&s.melt.phase==='idle','Out of MEG3N.AVI into the meadow',30000);
  assert.equal(s.exitText.phase,'idle','The first exit of a playthrough shows no text screen');
  assert.ok(Math.hypot(s.outside.x-MEG3N_DOOR.x,s.outside.z-MEG3N_DOOR.z)<4,`At MEG3N.AVI's door (${s.outside.x},${s.outside.z})`);
  const save=await t.saved();
  assert.equal(save.hub,true,'The save reached SAFE MODE');assert.equal(save.saved2,31);assert.equal(save.ceo,'altman');
  assert.equal(save.saved0|save.saved1|save.lost2|save.following2,0,'Only the factory');
  s=await t.wait(s=>s.outside.people.filter(p=>p.id>=10&&p.arrived).length===5,'The five come out to camp',25000);
  assert.equal(s.campaign.saved,5);assert.equal(s.outside.future.meg3n.strip,'saved,saved,saved,saved,saved');
  // The result: all five plus you, her 20 screens in place of cameras, practice (the QA start).
  s=await t.wait(s=>s.scoreView?.available,'The results card',20000);
  const r=s.run.result;assert.equal(r.levelId,'meg3n-factory');assert.equal(r.saved,6);assert.equal(r.camerasTotal,20);assert.equal(r.eligible,false);
  assert.match(await t.page.evaluate(()=>document.querySelector('.score-stats').textContent),/Screens smashed0\/20/);
  await t.shot('2-meadow');record('Its exit commits the clear (PDOOM_CAMPAIGN saved2 31): no text on the first exit, SAFE MODE at MEG3N.AVI, the save holds the five (5/20)');
  // 3. The native session agrees: walking back in, everyone is at camp.
  const yaw=-65*Math.PI/180;
  await t.page.evaluate(yaw=>window.__DOOM_DEBUG__.outside.debug.setView(-150.2-Math.sin(yaw)*3,2.5-Math.cos(yaw)*3,yaw+Math.PI,0),yaw);
  await t.page.waitForFunction(()=>document.getElementById('hub-enter')?.textContent.includes('Enter MEG3N.AVI'),null,{timeout:8000});
  await t.page.keyboard.press('Space',{delay:80});
  const sawFilm=await t.page.waitForSelector('#intro-video',{timeout:3000}).then(()=>true,()=>false);
  s=await t.wait(s=>s.mode==='playing'&&s.world?.level==='meg3n-factory'&&s.factory?.hub_entry===1&&!s.outside&&s.world.ticks>35,'MEG3N.AVI walks back in',60000);
  assert.ok(s.world.people.every(p=>p.camped===1),'All five at camp, not inside');
  assert.equal(sawFilm,false,'The film plays only the first time');
  await t.shot('3-revisit');record('MEG3N.AVI afterwards: no film the second time; the native session holds the clear too (all five at camp)');
  await t.page.close();
 }
 if(!only||only.includes('door')){
  const t=await open('door',{version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0});
  await t.page.goto('http://127.0.0.1:5198/?play=1&load=1&ceo=altman');
  await t.wait(s=>s.outside?.active&&s.outside.saved_visual===10&&s.menu.page==='closed','SAFE MODE with levels 1-2 cleared',90000);
  const yaw=-65*Math.PI/180;
  await t.page.evaluate(yaw=>window.__DOOM_DEBUG__.outside.debug.setView(-150.2-Math.sin(yaw)*3,2.5-Math.cos(yaw)*3,yaw+Math.PI,0),yaw);
  await t.page.waitForFunction(()=>document.getElementById('hub-enter')?.textContent.includes('Enter MEG3N.AVI'),null,{timeout:8000});
  await t.page.keyboard.press('Space',{delay:80});
  await t.page.waitForFunction(()=>document.querySelector('#intro-video video')?.currentTime>1,null,{timeout:30000});
  let s=await t.read();
  assert.match(await t.page.evaluate(()=>document.querySelector('#intro-video video').currentSrc),/e2m7-intro\.mp4$/);
  assert.equal(s.outside?.paused,true,'The meadow waits under the film');assert.equal(s.levelId,'five-prisons','The factory has not started yet');
  await t.shot('4-door-film');
  await t.page.click('.iv-skip');
  s=await t.wait(s=>s.mode==='playing'&&s.world?.level==='meg3n-factory'&&s.factory?.hub_entry===1&&!s.outside&&s.world.ticks>35,'Then the factory front door',60000);
  assert.ok(Math.hypot(s.world.x-1056,s.world.y+530)<24,'At the front door the film ends on');
  s=await t.wait(s=>s.run?.runId,'Its run',10000);assert.match(s.run.practiceReason,/Development run/,'A walk-in from SAFE MODE is practice');
  record('First walk through MEG3N.AVI: the E2M7 film plays over the paused meadow, then the factory front door');
  await t.page.close();
 }
 if(!only||only.includes('handoff')){
  const old={version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0};
  const t=await open('handoff',old);
  await t.page.goto('http://127.0.0.1:5198/?play=1&load=1&ceo=altman&levels=1');
  await t.wait(s=>s.outside?.active&&s.outside.saved_visual===10&&s.menu.page==='closed','SAFE MODE with levels 1-2 cleared',90000);
  await t.page.keyboard.press('Escape');await t.menu('main');await t.page.click('#menu-new');await t.menu('hero');await t.page.click('#hero-next');await t.menu('levels');
  await t.page.click('#level-meg3n-factory');await t.menu('confirm');
  const [request]=await Promise.all([t.page.waitForRequest(r=>r.isNavigationRequest()&&r.frame()===t.page.mainFrame(),{timeout:15000}),t.page.waitForEvent('load',{timeout:30000}),t.page.click('#menu-confirm')]);
  const handoff=new URL(request.url());
  assert.equal(handoff.searchParams.get('start'),'meg3n-factory');assert.equal(handoff.searchParams.get('play'),'1');assert.equal(handoff.searchParams.has('level'),false,`The campaign page, not ?level=meg3n-factory (${handoff.search})`);
  await t.page.waitForFunction(()=>window.render_game_to_text,null,{timeout:15000});
  await film(t,'The reload');
  const s=await coldFactory(t,'The reload hands off to a cold factory');
  const url=new URL(t.page.url());
  assert.equal(url.searchParams.has('play'),false);assert.equal(url.searchParams.has('start'),false,'Hand-off flags are consumed');assert.notEqual(url.searchParams.get('level'),'meg3n-factory','Still the campaign page');
  assert.equal(await t.saved(),null,'New Game replaced the old save');assert.equal(s.campaign.saved,0);
  await t.shot('4-handoff');record('From a running SAFE MODE save, New Game -> SPAWNING CHATS reloads the campaign page (start=) into a cold factory and replaces the save');
  await t.page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure.slice(0,3000));await current?.shot('failure').catch(()=>{});report.final=await current?.read().catch(()=>null);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(report.passed?0:1);
