import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startGame} from './doom-qa-ui.mjs';
const out=process.env.DOOM_OUT||'output/redesign/qa',selected=process.env.DOOM_CASES?.split(',');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],methodology:'Real native actions, player-only console positioning, unchanged hunter/collision. Hint delays use actual native ticks; touch is Chrome emulation.'};
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,predicate,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(predicate(s))return s;await p.waitForTimeout(80);}throw Error(label+': '+JSON.stringify(await read(p)));}
async function press(p,key){await p.keyboard.press(key,{delay:80});await p.waitForTimeout(250);}
async function command(p,text){await p.keyboard.press('Backquote');await p.waitForTimeout(500);await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);}
async function face(p,angle){for(let i=0;i<16;i++){const {world:w}=await read(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}throw Error('Facing failed');}
async function warp(p,x,y,angle){await command(p,`warp ${x} ${y}`);await wait(p,s=>Math.hypot(s.world.x-x,s.world.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);await command(p,'centerview');}
async function capture(p,d,label){(d.samples??={})[label]=await read(p);await p.screenshot({path:`${out}/${d.name}-${label}.png`});return d.samples[label];}
async function boot(p){await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35,'Boot',55000);}
async function wrench(p){await face(p,90);await press(p,'KeyE');await wait(p,s=>s.world.wrench===1,'Wrench');}
async function run(name,url,options,test){
 if(selected&&!selected.includes(name))return;
 const d={name,passed:false,errors:[]},c=await browser.newContext(options),p=await c.newPage();
 try{p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await test(p,d,c);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}
 catch(e){d.failure=String(e);d.final=await read(p).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));
}
const base='http://127.0.0.1:5198/',desktop={viewport:{width:1280,height:800}};
try{
 await run('opening',base,desktop,async(p,d)=>{
  await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.fonts.check('16px DoomSmall')));await capture(p,d,'launcher');
  // The launcher's text story panels gave way to the title menu and level films (scripts/onboarding-smoke.mjs).
  const help=await p.locator('#controls').textContent();assert.ok(!help.includes('throw'));assert.ok(!help.includes('Crouch'),'No Crouch row');assert.match(help,/Space\s*Use switches and levers/);assert.match(help,/Click\s*Swing wrench/);
  await boot(p);await capture(p,d,'game');assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);
  await press(p,'Escape');await capture(p,d,'native-menu');await press(p,'Escape');
 });
 await run('retained-melee-and-cameras',base,desktop,async(p,d)=>{
  await boot(p);await wrench(p);assert.equal((await read(p)).world.cameras_total,9);
  await warp(p,1948,1000,90);await press(p,'Control');const far=await wait(p,s=>s.world.wrench_swings>=1,'Miss swing');assert.equal(far.world.cameras_broken,0);assert.equal(far.world.wrench,1);assert.equal(far.world.flight,0);
  await warp(p,1948,1144,90);await wait(p,s=>s.world.cameras[0].reports>0,'Camera sees player');await press(p,'Control');const hit=await wait(p,s=>s.world.cameras[0].broken===1,'Melee destroys camera');assert.ok(hit.world.machine_explosions>0&&hit.world.machine_debris>0&&hit.world.machine_smoke>0&&hit.world.machine_sparks>0);await capture(p,d,'camera-explosion');assert.equal(hit.world.wrench,1);
  const reports=hit.world.cameras[0].reports;await p.waitForTimeout(800);assert.equal((await read(p)).world.cameras[0].reports,reports);
  await warp(p,1520,1192,90);await press(p,'Control');await wait(p,s=>s.world.cameras[1].broken===1,'Second independent camera');await capture(p,d,'second-camera');
  await warp(p,832,1528,90);await press(p,'KeyE');await wait(p,s=>s.world.gun===1&&s.world.ammo===3,'Gun');assert.equal(await p.locator('#held-gun').isVisible(),true);await press(p,'KeyT');assert.equal((await read(p)).world.tool,0);assert.equal((await read(p)).world.wrench,1);await press(p,'KeyT');assert.equal((await read(p)).world.tool,1);
  await warp(p,718,1560,270);await press(p,'Control');await wait(p,s=>s.world.cameras[2].broken===1&&s.world.ammo===2,'Shot destroys third camera');await capture(p,d,'gun-camera');
 });
 // Single-route redesign: the turret is armoured (hits only clang); its rear breaker is Stuart's one route.
 await run('armoured-turret',base,desktop,async(p,d)=>{
  await boot(p);await wrench(p);await warp(p,-112,2016,270);
  for(let i=1;i<=3;i++){await press(p,'Control');const s=await wait(p,s=>s.world.turret_hits===i,'Turret hit '+i);assert.equal(s.world.turret_broken,0);assert.equal(s.world.people[1].released,0);await capture(p,d,'hit-'+i);await p.waitForTimeout(350);}
  let s=await read(p);assert.equal(s.world.people[1].released,0);assert.equal(s.world.wrench,1);assert.equal(s.world.flight,0);assert.equal(s.world.gun,0);
  await warp(p,-48,2020,270);await press(p,'Space');s=await wait(p,s=>s.world.people[1].released===1&&s.world.turret_broken===1,'Rear breaker');assert.equal(s.world.people[1].route,'breaker');await capture(p,d,'breaker');
 });
 await run('sealed-refuge-and-delayed-hints',base+'?dev=end',desktop,async(p,d)=>{
  await boot(p);const initial=await capture(p,d,'start');assert.equal(initial.dialogue.hint_stage,0);assert.equal(initial.dialogue.refuge_sealed,1);assert.ok(!/cover|draft|bolt|wrench/.test(initial.dialogue.text));
  await warp(p,1088,864,0);await press(p,'KeyE');assert.equal((await read(p)).world.refuge_open,0);await warp(p,1088,800,0);await p.keyboard.down('KeyW');await p.waitForTimeout(1300);await p.keyboard.up('KeyW');assert.ok((await read(p)).world.x<1200,'Native locked bulkhead blocks departure');assert.equal((await read(p)).world.refuge_open,0,'Sealed bulkhead does not open on approach');await warp(p,832,880,90);
  await wait(p,s=>s.dialogue.gathered_tics>=1050,'Thirty seconds with no hint',35000);assert.equal((await read(p)).dialogue.hint_stage,0);await press(p,'Escape');const before=await read(p);await p.waitForTimeout(1800);assert.equal((await read(p)).world.ticks,before.world.ticks,'Native pause freezes hint clock');await press(p,'Escape');
  const first=await wait(p,s=>s.dialogue.hint_stage===1,'Forty-second hint',20000);assert.ok(first.dialogue.gathered_tics>=1400&&first.dialogue.gathered_tics<1450);
  // The dev=end fixture's five release quips queue ahead of it, so the line itself may show a few seconds later.
  d.firstHintShown=(await wait(p,s=>/another way out/.test(s.dialogue.text),'First hint line shown',15000)).dialogue.gathered_tics;await capture(p,d,'hint-40s');
  // The 65-second "draft" hint was cut on 2026-10-11: one nudge only.
  await wait(p,s=>s.dialogue.gathered_tics>=2400,'Past the old second-hint time',40000);assert.equal((await read(p)).dialogue.hint_stage,1,'No second hint');assert.ok(!/draft/.test((await read(p)).dialogue.text));await capture(p,d,'no-second-hint');
 });
 for(const [name,viewport]of [['opening-touch-portrait',{width:390,height:844}],['opening-touch-landscape',{width:844,height:390}]])await run(name,base,{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1},async(p,d)=>{
  await capture(p,d,'title');await boot(p);await capture(p,d,'game');
  assert.equal(await p.locator('[data-code="KeyQ"]').isVisible(),false);assert.equal(await p.locator('#crouch-button').isVisible(),false,'Crouch button hidden (ducts auto-crouch)');
  for(const [code,label]of [['Space','Use'],['ControlLeft','Swing']]){const b=p.locator(`#touch [data-code="${code}"]`);assert.equal(await b.isVisible(),true,label+' visible');assert.equal((await b.textContent()).trim(),label);const r=await b.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height,label+' inside the viewport');}
 });
}finally{report.passed=report.cases.length===(selected?.length??6)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);process.exit(report.passed?0:1);}
