// Level 1 after the 2026-10-10 redesign: each prisoner has exactly one way out.
// Liron crawls, Stuart's turret is switched off from behind, Eliezer's junction is
// cut, Hinton's wall is blown, Holly's bridge is powered. Removed routes stay shut.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {wallApproaches} from './wall-qa-helpers.mjs';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/';
const out=process.env.DOOM_OUT||'output/single-route/local';
await fs.mkdir(out,{recursive:true});
const {map,approach}=await wallApproaches('checkpoint');
const mount=type=>map.wall_mounts.find(m=>m.type===type);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};
let page,qa;
async function fresh(){
 await page?.close();
 page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto(base);await startGame(page);qa=nativeQA(page);
 await qa.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Native ready',60000);
 await qa.command('god');
}
const world=async()=>(await qa.read()).world;
async function wrench(){await qa.warp(2032,1120,90);await qa.press('Space');await qa.wait(s=>s.world.wrench===1,'Wrench');}
async function slingshot(){await qa.warp(832,1552);await qa.wait(s=>s.world.gun===1,'Slingshot on contact');}
async function shoot(){await page.keyboard.down('Control');await page.waitForTimeout(300);await page.keyboard.up('Control');await page.waitForTimeout(500);}
// Walk along one axis with real movement keys, facing north as the old crawl tests do.
async function axis(name,target){
 await qa.face(90);
 for(let i=0;i<65;i++){
  const w=await world(),delta=target-w[name];if(Math.abs(delta)<6)return w;
  const key=name==='x'?(delta>0?'KeyD':'KeyA'):(delta>0?'KeyW':'KeyS');
  await page.keyboard.down(key);await page.waitForTimeout(Math.min(450,Math.max(28,Math.abs(delta)*9)));await page.keyboard.up(key);await page.waitForTimeout(160);
 }
 throw Error(`Move ${name} to ${target}: ${JSON.stringify(await world())}`);
}
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
try{
 // Liron: padlock no longer breaks; the long crawl (no crouch key) reaches the inside release.
 await fresh();await wrench();await slingshot();
 await qa.warp(1930,1160,270);await shoot();await qa.press('Space');
 assert.equal((await world()).people[0].released,0,'Padlock ignores ball bearings and Space');
 await qa.warp(1744,960,0);
 for(const [a,t] of [['x',1832],['y',832],['x',1840],['y',480],['x',2160],['y',960]])await axis(a,t);
 await qa.face(180);await axis('x',1978);
 const release=mount(15105),at=await world();await qa.face((Math.atan2(release.y-at.y,release.x-at.x)*180/Math.PI+360)%360);
 await shot('liron-inside-release');await qa.press('Space');
 const liron=await qa.wait(s=>s.world.people[0].released===1,'Inside release frees Liron');
 assert.equal(liron.world.people[0].route,'service');
 report.cases.push('Liron: padlock unbreakable; crawlspace + inside release (route service)');

 // Stuart: walking into the gallery the turret is already firing; hits only clang; the breaker works.
 await fresh();await wrench();
 await qa.warp(-272,1440,90);await shot('gallery-entry');
 await qa.wait(s=>s.world.turret_shots>0,'Turret fires down the open gallery at the entrance',6000);
 await shot('gallery-turret-firing');
 await qa.warp(-112,1880,90);for(let i=0;i<3;i++)await shoot();
 let s=await world();assert.equal(s.turret_broken,0,'Wrench hits do not break the turret');assert.equal(s.people[1].released,0);
 await qa.warp(-1350,1180,0);await slingshot();await qa.warp(-272,1600,90);for(let i=0;i<3;i++)await shoot();
 assert.equal((await world()).turret_broken,0,'Ball bearings do not break the turret');
 const breaker=mount(15108);await qa.warp(...approach(breaker,40));const before=(await world()).turret_shots;await page.waitForTimeout(800);
 assert.equal((await world()).turret_shots,before,'Breaker approach is outside the firing lane');
 await shot('turret-breaker');await qa.press('Space');
 const stuart=await qa.wait(s=>s.world.people[1].released===1&&s.world.turret_broken===1,'Breaker shuts the turret off');
 assert.equal(stuart.world.people[1].route,'breaker');
 report.cases.push('Stuart: turret visible and firing from the gallery entrance; armour ignores wrench/slingshot; rear breaker (route breaker)');

 // Eliezer: front lock is permanent (no key); the junction strike opens the rear shutter.
 await fresh();await wrench();
 await qa.warp(-780,-288,180);await qa.press('Space');assert.equal((await world()).people[2].released,0,'Front lock stays shut');
 await qa.warp(-904,528,90);await shoot();await qa.wait(s=>s.sam.opened===1&&s.sam.clearance===56,'Wrench on the junction lifts the shutter');
 await qa.warp(-1040,-288,0);await axis('x',-936);await qa.face(150);await shot('eliezer-inside');await qa.press('Space');
 const eliezer=await qa.wait(s=>s.world.people[2].released===1,'Inside latch frees Eliezer');
 assert.equal(eliezer.world.people[2].route,'power-shutter');assert.equal(eliezer.world.key,0);
 report.cases.push('Eliezer: front lock permanent, no key; junction + inside latch (route power-shutter)');

 // Hinton: the bent crawl is gone; the charge blows the cracked wall.
 await fresh();
 await qa.warp(-1424,1312,180);await qa.hold('w',1400);s=await world();
 assert.ok(s.x>-1472,'No crawl duct into the machinery cell (x='+s.x+')');assert.equal(s.crouch,1,'Nothing low to duck into');
 await qa.warp(-1088,688,270);await qa.press('Space');await qa.wait(s=>s.world.charge===1,'Charge pickup');
 await qa.warp(-1408,1120,180);await qa.press('Space');await qa.wait(s=>s.world.fuse>0,'Charge planted');
 await page.keyboard.down('KeyD');await page.waitForTimeout(1700);await page.keyboard.up('KeyD');
 const hinton=await qa.wait(s=>s.world.breaches===1&&s.world.people[3].released===1,'Blast opens the wall');
 assert.equal(hinton.world.people[3].route,'breach');await shot('hinton-breach');
 report.cases.push('Hinton: no crawl; demolition charge (route breach)');

 // Holly: the stair crawl is gone; feed power, then the bridge control.
 await qa.warp(-1408,1504,180);await qa.hold('w',1400);s=await world();
 assert.ok(s.x>-1440,'No service crawl beside the bridge (x='+s.x+')');
 await qa.warp(-976,1904,90);await qa.press('Space');assert.equal((await world()).people[4].released,0,'Control needs power first');
 await qa.warp(-1088,1496,90);await qa.press('Space');await qa.wait(s=>s.holly.powered===1,'Power restored');
 await qa.warp(-976,1904,90);await qa.press('Space');
 const holly=await qa.wait(s=>s.world.people[4].released===1&&s.holly.bridge_height===192,'Powered bridge frees Holly');
 assert.equal(holly.world.people[4].route,'powered-bridge');await shot('holly-bridge');
 report.cases.push('Holly: no crawl; power feed then bridge control (route powered-bridge)');

 const logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
 assert.deepEqual(logs,[]);assert.deepEqual(report.errors,[]);report.passed=true;
 console.log('Single-route smoke: PASS\n - '+report.cases.join('\n - '));
}catch(e){
 report.passed=false;report.error=String(e.stack||e);
 report.state=await page?.evaluate(()=>window.render_game_to_text()).catch(()=>null);
 await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.error);process.exitCode=1;
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
