import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startGame} from './doom-qa-ui.mjs';
const out=process.env.DOOM_OUT||'output/sam-shutter/qa',selected=process.env.DOOM_CASES?.split(',');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:'Real native collision, pitch/weapon hits and standing player/NPC movement. Console warps only establish player fixtures; the cable route and west doorway are traversed with ordinary keyboard input.'};
let activeCase;
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,test,label,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(s.world&&test(s))return s;await p.waitForTimeout(80);}throw Error(label+': '+JSON.stringify(await read(p)));}
async function press(p,k){await p.keyboard.press(k,{delay:80});await p.waitForTimeout(250);}
async function command(p,text){await p.keyboard.press('Backquote');await p.waitForTimeout(400);await p.evaluate(text=>{for(const key of text){const n=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:n,which:n,charCode:n,bubbles:true,cancelable:true}});}},text);await p.keyboard.press('Enter');await p.waitForTimeout(250);await p.keyboard.press('Backquote');await p.waitForTimeout(400);}
async function face(p,angle){for(let i=0;i<16;i++){const s=await read(p),delta=((angle-s.world.angle+540)%360)-180;if(Math.abs(delta)<5)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.max(40,Math.min(600,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(150);}throw Error('Face');}
async function warp(p,x,y,angle){await command(p,`warp ${x} ${y}`);await wait(p,s=>Math.hypot(s.world.x-x,s.world.y-y)<25,'Warp');await face(p,angle);await command(p,'centerview');}
async function axis(p,axis,target){
 const begin=(await read(p)).world,goal={x:axis==='x'?target:begin.x,y:axis==='y'?target:begin.y};
 for(let i=0;i<45;i++){
  const w=(await read(p)).world,dx=goal.x-w.x,dy=goal.y-w.y,dist=Math.hypot(dx,dy);
  (activeCase.travel??=[]).push({goal,x:w.x,y:w.y,angle:w.angle,crouch:w.crouch});
  if(dist<6)return;
  await face(p,(Math.atan2(dy,dx)*180/Math.PI+360)%360);
  await p.keyboard.down('KeyW');await p.waitForTimeout(Math.max(28,Math.min(250,dist*3)));await p.keyboard.up('KeyW');await p.waitForTimeout(450);
 }
 throw Error('Standing movement '+axis+' '+target+': '+JSON.stringify(await read(p)));
}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
async function wrench(p){await face(p,90);await press(p,'KeyE');await wait(p,s=>s.world.wrench===1,'Wrench');}
async function gun(p){await warp(p,832,1528,90);await press(p,'KeyE');await wait(p,s=>s.world.gun===1&&s.world.ammo===3,'Gun');}
async function run(name,test){if(selected&&!selected.includes(name))return;const c=await browser.newContext({viewport:{width:1280,height:800}}),p=await c.newPage(),d={name,passed:false,errors:[]};try{activeCase=d;p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto('http://127.0.0.1:5198/');await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35,'Boot',55000);await test(p,d);d.final=await read(p);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);d.final=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(p,name+'-failure').catch(()=>{});}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}
try{
 await run('west-shutter-wrench-route',async(p,d)=>{
  await warp(p,1040,848,90);await wait(p,s=>s.world.refuge_known===1,'Refuge known: Sam will follow rather than lead');await warp(p,2032,1120,90);await wrench(p);await warp(p,-1040,-288,0);await shot(p,'shutter-closed');await press(p,'KeyE');await p.keyboard.down('KeyW');await p.waitForTimeout(650);await p.keyboard.up('KeyW');d.closed=await read(p);assert.equal(d.closed.sam.opened,0);assert.equal(d.closed.sam.clearance,0);assert.ok(d.closed.world.x<=-1015);assert.equal(d.closed.world.people[2].discovered,0);
  await p.keyboard.down('KeyC');await p.waitForTimeout(200);await p.keyboard.down('KeyW');await p.waitForTimeout(450);await p.keyboard.up('KeyW');await p.keyboard.up('KeyC');await p.waitForTimeout(400);assert.ok((await read(p)).world.x<=-1015,'Crouch cannot bypass shutter');
  await axis(p,'x',-1040);await axis(p,'y',-160);await shot(p,'cable-corner');for(const [a,t]of [['x',-904],['y',0],['x',-920],['y',64],['x',-936],['y',112],['x',-960],['y',192],['x',-936],['y',256],['x',-912],['y',320],['x',-896],['y',384],['y',528],['x',-904]])await axis(p,a,t);await face(p,90);await shot(p,'junction-intact');await press(p,'KeyE');assert.equal((await read(p)).sam.opened,0,'Use does not remotely destroy junction');await press(p,'Control');d.cut=await wait(p,s=>s.sam.power_cut===1&&s.sam.clearance===56,'Wrench cuts power and fully retracts shutter');assert.equal(d.cut.world.people[2].released,0,'Opening alternate entrance does not remotely rescue Sam');assert.equal(d.cut.world.gun,0);assert.equal(d.cut.world.ammo,0);assert.ok(d.cut.world.machine_sparks>0&&d.cut.world.machine_smoke>0);await shot(p,'junction-broken');
  for(const [a,t]of [['y',384],['y',320],['x',-912],['y',256],['x',-936],['y',192],['x',-960],['y',112],['x',-936],['y',64],['x',-920],['y',0],['x',-904],['y',-160],['x',-1040],['y',-288]])await axis(p,a,t);await face(p,0);await shot(p,'shutter-open');await axis(p,'x',-936);assert.ok((await read(p)).world.x>-984,'Standing player traverses new shutter');await face(p,150);await press(p,'KeyE');d.rescue=await wait(p,s=>s.world.people[2].released===1,'Inside release rescues Sam');assert.equal(d.rescue.world.people[2].route,'power-shutter');assert.equal(d.rescue.world.key,0);
  await axis(p,'x',-1056);d.escort=await wait(p,s=>s.world.people[2].x<-1015&&s.world.people[2].clear===1,'Sam physically traverses rear shutter standing',25000);assert.equal(d.escort.world.people[2].pose_height,56);assert.equal(d.escort.sam.clearance,56);await shot(p,'sam-west-escort');await p.waitForTimeout(4000);assert.equal((await read(p)).sam.clearance,56,'Shortcut stays open');
 });
 await run('junction-impact-rules',async(p,d)=>{
  await gun(p);await warp(p,-1040,-288,0);await press(p,'Control');assert.equal((await read(p)).world.people[2].released,0,'Shot cannot reach Sam lock through closed shutter');await warp(p,-904,528,90);await press(p,'Control');assert.equal((await read(p)).sam.opened,0,'Junction casing needs physical wrench strike');assert.equal((await read(p)).world.ammo,1);
  await warp(p,2032,1120,90);await wrench(p);await warp(p,-904,432,90);await press(p,'Control');assert.equal((await read(p)).sam.opened,0,'Melee range stays finite');await warp(p,-944,-256,70);await press(p,'Control');assert.equal((await read(p)).sam.opened,0,'Real walls block wrench hits');await warp(p,-904,528,90);await press(p,'Control');await wait(p,s=>s.sam.opened===1&&s.sam.clearance===56,'Actual reachable hit opens shutter');await shot(p,'impact-rules-open');
 });
 // 2026-10-10: no maintenance key exists, the front lock is permanent and Sam no longer opens the inside latch
 // after a front rescue. The junction + rear shutter above is Eliezer's only way out.
 await run('front-lock-permanent',async(p,d)=>{
  await warp(p,-1344,720,270);await press(p,'Space');await p.waitForTimeout(300);assert.equal((await read(p)).world.key,0,'No maintenance key on the map');
  await warp(p,-780,-288,180);await press(p,'Space');d.locked=await read(p);assert.equal(d.locked.world.people[2].released,0,'Use cannot open the front lock');assert.equal(d.locked.world.message,'Locked.');
  await gun(p);await warp(p,-780,-288,180);await press(p,'Control');await p.waitForTimeout(900);d.shot=await read(p);assert.equal(d.shot.world.ammo,2,'Ball bearing fired');assert.equal(d.shot.world.people[2].released,0,'Front lock cannot be shot');assert.equal(d.shot.sam.opened,0,'Nothing opens the rear shutter from inside');assert.equal(d.shot.sam.clearance,0);await shot(p,'front-lock-permanent');
 });
}finally{report.passed=report.cases.length===(selected?.length??3)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);process.exit(report.passed?0:1);}
