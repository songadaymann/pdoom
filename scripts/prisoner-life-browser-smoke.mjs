import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startGame} from './doom-qa-ui.mjs';
const out='output/prisoner-life/native',browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
await fs.mkdir(out,{recursive:true});
const report={modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:'Actual native clocks, actors and input. Console positioning moves only the player; no prisoner unlocks, path or collision cheats.'};
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,test,label,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(s.world&&test(s))return s;await p.waitForTimeout(100);}throw Error(label);}
async function command(p,text){await p.keyboard.press('Backquote');await p.waitForTimeout(400);await p.evaluate(text=>{for(const key of text){const n=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:n,which:n,charCode:n,bubbles:true,cancelable:true}});}},text);await p.keyboard.press('Enter');await p.waitForTimeout(250);await p.keyboard.press('Backquote');await p.waitForTimeout(400);}
async function face(p,angle){for(let i=0;i<15;i++){const s=await read(p),delta=((angle-s.world.angle+540)%360)-180;if(Math.abs(delta)<5)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.max(40,Math.min(600,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(150);}throw Error('Face');}
async function samples(p,name){const result=[];for(let n=0;n<25;n++){result.push(await read(p));if(n===0||n===24)await p.screenshot({path:`${out}/${name}-${n}.png`});await p.waitForTimeout(200);}return result;}
function breathing(trace){for(let i=0;i<5;i++){const scales=trace.map(s=>s.world.people[i].breath_scale);assert.ok(Math.max(...scales)-Math.min(...scales)>.015,`Human ${i+1} visibly breathes throughout wait`);}}
async function run(name,url,test){const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage(),d={name,passed:false,errors:[]};try{p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});await p.goto(url);await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35,'Boot',55000);await test(p,d);d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Unknown command|Execution could not continue/.test(l)));assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;}catch(e){d.failure=String(e);d.state=await read(p).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`});}finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await context.close();console.log(name+': '+(d.passed?'PASS':d.failure));}}
try{
 await run('captive-pacing','http://127.0.0.1:5198/',async(p,d)=>{
  await command(p,'warp 1940 1016');await face(p,270);await command(p,'centerview');d.trace=await samples(p,'captive');breathing(d.trace);
  const bounds=[[1872,896,1984,1108],[-192,2048,-32,2192],[-1000,-352,-824,-224],[-1696,1040,-1472,1200],[-1600,1824,-1456,1952]];
  for(let i=0;i<5;i++){const people=d.trace.map(s=>s.world.people[i]),a=people[0];assert.ok(people.some(h=>Math.hypot(h.x-a.x,h.y-a.y)>4),'Captive actually paces '+i);for(const h of people){const [x1,y1,x2,y2]=bounds[i];assert.ok(h.x>x1&&h.x<x2&&h.y>y1&&h.y<y2,'Captive cannot leave locked cell');assert.equal(h.released,0);assert.equal(h.health,100);assert.ok(Math.hypot(h.x-h.hold_x,h.y-h.hold_y)<20);}}
  assert.ok(d.trace.every(s=>s.world.freed===0));
 });
 await run('refuge-life-and-pause','http://127.0.0.1:5198/?dev=end',async(p,d)=>{
  await command(p,'warp 880 832');await face(p,0);await command(p,'centerview');d.trace=await samples(p,'refuge');breathing(d.trace);
  for(let i=0;i<5;i++){const people=d.trace.map(s=>s.world.people[i]),a=people[0];assert.ok(people.some(h=>Math.hypot(h.x-a.x,h.y-a.y)>4),'Sheltered human actually paces '+i);assert.ok(people.every(h=>h.holding===1&&h.sheltered===1&&Math.hypot(h.x-h.hold_x,h.y-h.hold_y)<33));}
  assert.ok(d.trace.every(s=>s.world.group_gathered===1));await p.keyboard.press('Escape');await p.waitForTimeout(400);const paused=(await read(p)).world;await p.waitForTimeout(1100);assert.deepEqual((await read(p)).world.people,paused.people,'Native pause freezes positions and breathing');await p.keyboard.press('Escape');await p.waitForTimeout(450);assert.notEqual((await read(p)).world.people[0].breath_scale,paused.people[0].breath_scale);
 });
}finally{report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);process.exit(report.passed?0:1);}
