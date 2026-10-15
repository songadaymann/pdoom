import {startGame} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out=process.env.DOOM_OUT||'output/survival-hud/browser',selected=process.env.DOOM_CASES?.split(',');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[]};
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,predicate,label,timeout=15000){
 const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(predicate(s))return s;await p.waitForTimeout(100);}throw Error(label+': '+JSON.stringify(await read(p)));
}
async function command(p,text){
 await p.keyboard.press('Backquote');await p.waitForTimeout(500);
 await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);
 await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);
}
async function face(p,angle){for(let i=0;i<16;i++){const {world:w}=await read(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}throw Error('Facing failed');}
async function warp(p,x,y,angle){await command(p,`warp ${x} ${y}`);await wait(p,s=>Math.hypot(s.world.x-x,s.world.y-y)<30,'Warp');if(angle!==undefined)await face(p,angle);}
async function press(p,key){await p.keyboard.press(key,{delay:80});await p.waitForTimeout(250);}
async function capture(p,d,label){
 const s=await read(p);(d.samples??={})[label]={world:s.world,estimate:s.survivalEstimate};
 assert.equal(await p.locator('#survival').textContent(),`${s.survivalEstimate.survival===100?'':'≈'}${s.survivalEstimate.survival}%`);
 assert.equal(await p.locator('#health').textContent(),`${Math.max(0,s.world.health)}%`);
 await p.screenshot({path:`${out}/${d.name}-${label}.png`});return s;
}
async function run(name,url,options,test){
 if(selected&&!selected.includes(name))return;
 const d={name,passed:false,errors:[]},c=await browser.newContext(options),p=await c.newPage();
 try{
  p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});
  await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await p.goto(url);await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35,'Boot',55000);
  await test(p,d,c);assert.deepEqual(d.errors,[]);d.passed=true;
 }catch(e){d.failure=String(e);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure));
}
const desktop={viewport:{width:1280,height:800}},base='http://127.0.0.1:5198/';
try{
 await run('rescue-and-shelter',base,desktop,async(p,d)=>{
  const start=await capture(p,d,'start');assert.equal(start.survivalEstimate.survival,12);
  assert.equal(await p.locator('.rescue-slot.unknown').count(),5);
  assert.ok((await p.locator('#rescue-slots').innerText()).indexOf('Milo')===-1);
  await warp(p,1936,1000,270);await press(p,'KeyE');await wait(p,s=>s.world.freed===1,'Rescue Milo');
  const freed=await capture(p,d,'freed');assert.ok(freed.survivalEstimate.survival>start.survivalEstimate.survival);
  for(let i=0;i<35;i++){const s=await read(p);if(s.world.sheltered>=1&&s.world.in_refuge)break;const person=s.world.people[0];await warp(p,person.x,person.y);await p.waitForTimeout(1100);}
  await wait(p,s=>s.world.sheltered===1,'Guide shelter');const sheltered=await capture(p,d,'sheltered');
  assert.ok(sheltered.survivalEstimate.survival>freed.survivalEstimate.survival);assert.equal(await p.locator('.rescue-slot.sheltered').count(),1);
 });
 await run('injury-and-healing',base,desktop,async(p,d)=>{
  const start=await capture(p,d,'start');await warp(p,-1104,1664,90);await wait(p,s=>s.world.health===70,'Native hunter hit');const hit=await capture(p,d,'hit');assert.ok(hit.survivalEstimate.survival<start.survivalEstimate.survival);
  await warp(p,1760,1104,90);await p.keyboard.down('KeyW');await p.waitForTimeout(100);await p.keyboard.up('KeyW');await wait(p,s=>s.world.health===80,'Stimpack');const healed=await capture(p,d,'healed');assert.ok(healed.survivalEstimate.survival>hit.survivalEstimate.survival);
 });
 await run('gathered-and-body-transfer',base+'?dev=end',desktop,async(p,d)=>{
  const gathered=await capture(p,d,'gathered');assert.ok(gathered.survivalEstimate.survival>=90&&gathered.survivalEstimate.survival<100);assert.equal(await p.locator('.rescue-slot.sheltered').count(),5);
  await command(p,'kill');await wait(p,s=>s.world.alive===5&&s.world.controlled>0,'Body transfer');const loss=await capture(p,d,'loss');assert.ok(loss.survivalEstimate.survival<gathered.survivalEstimate.survival);
  assert.equal(await p.locator('#hud-portrait').getAttribute('src'),`outside-assets/person-${loss.world.controlled-1}-0-0.png`);
 });
 for(const [name,viewport]of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]])await run(name,base+'?dev=end',{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1},async(p,d,c)=>{
  await capture(p,d,'hud');const bar=await p.locator('.doom-statusbar').boundingBox(),health=await p.locator('#health').boundingBox(),survival=await p.locator('#survival').boundingBox();
  assert.ok(bar.x>=0&&bar.x+bar.width<=viewport.width);for(const r of[health,survival])assert.ok(r.x>=0&&r.x+r.width<=viewport.width);
  const button=await p.locator('[data-code="KeyW"]').boundingBox();assert.ok(button);assert.ok(button.y>=bar.y+bar.height);
  const before=await read(p),cdp=await c.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2}]});await p.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);const after=await read(p);assert.ok(Math.hypot(after.world.x-before.world.x,after.world.y-before.world.y)>1,'Touch movement retained');
 });
}finally{report.passed=report.cases.length===(selected?.length??5)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);process.exit(report.passed?0:1);}
