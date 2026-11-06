// SMITH's pod farm from the episode menu (2026-11-06): HUMAN CONTAINMENT AREA starts E2M2 cold on the
// campaign page, like the other episodes, as a run that can rank on agentic-pods-rescue-v1. Headless, muted.
//  1. A new player: levels menu (all four enabled) -> HUMAN CONTAINMENT AREA (no film: E2M2 has none) ->
//     the pod farm's own cold start (not AGENTIC.BAT's walk-in), its HUD, a run with its active clock that
//     is not practice, nothing saved yet.
//  2. QA puts everyone in the refuge (pdoom_agentic_site 7, then RESTART LEVEL), which makes the run
//     practice; the exit set piece (smash the door camera, STOP GENERATING, answer the phone) commits the
//     clear and prints the run's PDOOM_RESULT: all five plus you, SMITH's nine cameras, the Level 4 board.
// node scripts/agentic-menu-smoke.mjs   (PDOOM_PORT / PDOOM_ORIGIN as the other agentic smokes)
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,nativeQA,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/menu';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={origin:ORIGIN,cases:[],errors:[]};const record=text=>{report.cases.push(text);console.log(text);};
const controls=await fs.readFile('doom-web/controls.cfg','utf8');
const here=s=>[s.world.x,s.world.y];
async function walkTo({read,face,hold},x,y,{near=24,timeout=20000}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const w=(await read()).world,d=Math.hypot(x-w.x,y-w.y);if(d<near)return w;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${w.x},${w.y}`);
  await face(angleTo(w,x,y));await hold('KeyW',Math.min(450,Math.max(90,d*2.6)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
let page;
try{
 page=await browser.newPage({viewport:{width:1280,height:800}});
 const engine=watchEngine(page);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/controls.cfg',r=>r.fulfill({contentType:'text/plain',body:controls+'\nbind ` "toggleconsole"\n'}));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};if(!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.removeItem('pdoom.campaign.v1');}});
 const qa=nativeQA(page),{read,wait,face,command,warp,press,hold}=qa;
 const menu=view=>page.waitForFunction(view=>JSON.parse(window.render_game_to_text()).menu?.page===view,view,{timeout:15000});
 const shot=n=>page.screenshot({path:`${out}/${n}.png`});
 // 1. the menu, and the cold start
 await page.goto(`${ORIGIN}/?ceo=altman&levels=1&debug`);await page.waitForFunction(()=>window.render_game_to_text);
 await page.click('#title-enter');await menu('main');await page.click('#menu-new');await menu('hero');await page.click('#hero-next');await menu('levels');
 const entry=page.locator('#level-agentic-pods');
 assert.equal(await entry.isDisabled(),false,'HUMAN CONTAINMENT AREA is enabled');assert.match(await entry.innerText(),/HUMAN CONTAINMENT AREA\s*THY FLESH COMPUTED/);
 assert.equal(await page.locator('[data-view="levels"] button:disabled').count(),0,'Nothing on the episode menu is still to come');
 await shot('1-levels');await entry.click();
 let s=await wait(s=>s.mode==='playing'&&s.levelId==='agentic-pods'&&s.world?.map==='E2M2'&&s.agentic&&s.menu.page==='closed'&&s.world.ticks>35,'HUMAN CONTAINMENT AREA starts the pod farm',90000);
 assert.equal(s.agentic.hub_entry,0,'Not a walk-in from AGENTIC.BAT');assert.equal(s.agentic.freed,0,'All five captive');
 assert.equal(s.mod,"p(DOOM): AGENTIC SMITH's Pod Farm");
 const hud=await page.evaluate(()=>({agentic:document.getElementById('stage').classList.contains('agentic-prototype'),checkpoint:document.getElementById('stage').classList.contains('checkpoint'),statusbar:!document.querySelector('#hud .doom-statusbar')?.hidden}));
 assert.ok(hud.agentic&&hud.checkpoint&&hud.statusbar,`The pod farm's HUD with the status bar: ${JSON.stringify(hud)}`);
 s=await wait(s=>s.run?.runId&&s.run.activeTics>35,'A run starts with its active clock',15000);
 assert.equal(s.run.practiceReason,'','A fresh menu start can rank');assert.equal(s.run.levelId??s.levelId,'agentic-pods');
 assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1'))),null,'Nothing saved before the exit');
 await shot('1-start');record('Episode menu: HUMAN CONTAINMENT AREA (THY FLESH COMPUTED) starts E2M2 cold on the campaign page: its own start, the pod farm HUD, a run that can rank, nothing saved');
 // 2. QA only: restart in the refuge with all five safe (the ?puzzle=exit start), then the exit set piece
 await command('pdoom_development 1');await command('pdoom_agentic_site 7');
 await page.keyboard.press('Escape');await menu('main');await page.click('#menu-restart');await menu('confirm');await page.click('#menu-confirm');
 s=await wait(s=>s.mode==='playing'&&s.agentic?.all_safe===1&&s.agentic.freed===31&&s.world.ticks>35,'Restarted in the refuge with all five',60000);
 assert.ok(s.run.practiceReason,'A QA restart in the refuge is practice');
 await command('god');
 s=await wait(s=>s.agentic.phone_ringing===1&&s.agentic.door_camera===1&&s.agentic.smith_mode===9,'Phone rings; SMITH takes the door camera',8000);
 await warp(-310,-80);s=await read();await face(angleTo(s.world,-240,-48));
 await hold('ControlLeft',120);s=await wait(s=>s.agentic.door_camera===2,'Door camera smashed',4000);
 for(const end=Date.now()+40000;Date.now()<end;){
  s=await read();const m=s.agentic.possessed;if(!m)break;
  const i=[0,1,2,3,4].find(i=>m&(1<<i)),p=s.world.people[i];
  if(dist(here(s),[p.x,p.y])>80)await walkTo(qa,p.x,p.y,{near:70,timeout:8000}).catch(()=>{});
  s=await read();await face(angleTo(s.world,p.x,p.y));
  if((await read()).world.prompt==='SPACE - stop generating')await press('Space');
  await page.waitForTimeout(250);
 }
 assert.equal((await read()).agentic.possessed,0,'Everyone themselves again');
 await walkTo(qa,-345,-96,{near:20});await face(180);
 await wait(s=>s.world.prompt==='SPACE - answer the phone','Answer prompt');
 await press('Space');s=await wait(s=>s.events?.some(e=>e.type==='agentic-exit'),'agentic-exit',5000);
 assert.ok(s.events.some(e=>e.type==='agentic-exit'&&e.saved===31&&e.hub===0&&e.committed===1),'The payphone commits natively');
 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs);
 const line=logs.find(l=>l.includes('PDOOM_RESULT {'));assert.ok(line,'The pod farm prints its PDOOM_RESULT');
 const native=JSON.parse(line.slice(line.indexOf('{')));
 assert.equal(native.level_id,'agentic-pods');assert.equal(native.level_version,'agentic-pods-v1');assert.equal(native.saved,6);assert.equal(native.saved_figures,5);
 assert.equal(native.cameras_total,9);assert.ok(native.cameras_broken>=1,'The door camera counts');assert.equal(native.practice,1);assert.equal(native.entry,'cold');assert.equal(native.retreat,0);
 assert.equal(native.routes.length,5);assert.ok(native.p_doom_cover>=1&&native.p_doom_cover<=99,`p(DOOM) at the phone: ${native.p_doom_cover}`);
 await shot('2-exit');
 s=await wait(s=>s.scoreView?.available,'The results card',30000);
 const r=s.run.result;assert.equal(r.levelId,'agentic-pods');assert.equal(r.saved,6);assert.equal(r.camerasTotal,9);assert.equal(r.eligible,false,'Practice: nothing to submit');
 assert.match(await page.evaluate(()=>document.querySelector('.score-stats').textContent),/Cameras destroyed\d\/9/);
 await shot('2-result');
 s=await wait(s=>s.outside?.active&&s.outside.currentLevel==='agentic-pods','Out of AGENTIC.BAT into the meadow',45000);
 const save=JSON.parse(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')));assert.equal(save.saved3,31,'The save holds the five');
 record(`A QA exit (practice) prints the run's result: 6/6 saved, ${native.cameras_broken}/9 cameras, routes ${native.routes.join(',')}, p(DOOM) ${native.p_doom_cover}; the results card shows level 4, nothing to submit; the save holds the five`);
 assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);report.state=await page?.evaluate(()=>JSON.parse(window.render_game_to_text?.()||'{}')).catch(()=>null);await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify({passed:!!report.passed,cases:report.cases,failure:report.failure?.slice(0,1500)},null,1));process.exit(report.passed?0:1);
