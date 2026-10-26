// SAFE MODE after each level (docs/SAFE-MODE-PROGRESSION.md): boots the meadow through the loopback-only
// ?safemode=1&after=N fixture for N = 1..4, muted and headless, and checks where the rescued stand (the newest
// group near its exit and clear of the door, every earlier group in its hilltop zone, and that they wander), the
// stage's corruption, toys and cleared buildings, the hub HUD after a load, and that the page throws nothing.
// Screenshots in output/safe-mode-stages/. PDOOM_ORIGIN (e.g. http://127.0.0.1:5218) points it at another server.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin=(process.env.PDOOM_ORIGIN||'http://127.0.0.1:5198').replace(/\/?$/,'/'),out=process.env.DOOM_OUT||'output/safe-mode-stages';
await fs.mkdir(out,{recursive:true});
const deg=d=>d*Math.PI/180;
// (doom-hub-doors.ts, doom-hub-future.ts, doom-camp-layout.ts)
const DOORS=[{x:17,z:.1,yaw:0},{x:2.6,z:-200.1,yaw:deg(-223)},{x:-150.2,z:2.5,yaw:deg(-65)},{x:143.5,z:86.7,yaw:deg(-330)}];
const ZONES=[{x:-30,z:-72},{x:-58,z:-66},{x:-74,z:-82},{x:-28,z:-118}],RADIUS=9;
const TOYS={1:9,2:45,3:80,4:142}; // desktop: the nine icons, the named detritus and its piles (doom-desktop-detritus.ts)
const VIEWS=[['bunker-exit',17,-3,0,0],['look-back',17,-20,Math.PI,.04],['hill',-20,-50,deg(40),.12],['aerial',-46,-40,0,-.62,48]];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const doorClearance=(p,d)=>{const dx=p.x-d.x,dz=p.z-d.z;return {distance:Math.hypot(dx,dz),front:-Math.sin(d.yaw)*dx-Math.cos(d.yaw)*dz};};
try{
 for(const n of [1,2,3,4]){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  await page.goto(`${origin}?safemode=1&after=${n}`);
  await page.waitForFunction(k=>JSON.parse(window.render_game_to_text?.()||'{}').outside?.saved_visual===k,n*5,{timeout:120000});
  let s=await read();
  assert.equal(s.campaign.saved,n*5);assert.equal(s.outside.future.wait,20-n*5,'Wait box');
  assert.equal(s.outside.corruption.corrupt,n-1,'Corruption stage set at once on a load');
  assert.equal(s.outside.icons.icons.length,TOYS[n],'Toys landed by this stage');
  assert.equal(s.outside.dressing.control,'not responding');
  assert.equal(s.outside.dressing.hal,n>=2?'eye=off':'eye=always_on');assert.equal(s.outside.hal.eye==='mouse ball',n>=2,'HAL eye is a mouse ball once cleared');
  assert.equal(s.outside.dressing.meg3n.startsWith('paused'),n>=3);assert.equal(s.outside.dressing.agentic_agents===0,n>=4);
  assert.equal(s.outside.future.mcp_glow>.5,n>=4,'The column burns after 4');
  assert.doesNotMatch(await page.locator('#group').textContent(),/Waiting for the others/,'No stale escape line after a load');
  await page.waitForTimeout(6000);
  const before=(await read()).outside.people;await page.waitForTimeout(6000);s=await read();
  const newest=n-1;let moved=0;
  for(const p of s.outside.people){
   const group=Math.floor(p.id/5),then=before.find(b=>b.id===p.id);
   if(Math.hypot(p.x-then.x,p.z-then.z)>.5)moved++;
   for(const [k,d] of DOORS.entries()){const c=doorClearance(p,d);if(c.distance<RADIUS+8)assert.ok(c.distance>4.4||c.front<-2,`${p.character} is in ${['CONTROL','HAL','MEG3N','AGENTIC'][k]}'s doorway`);}
   if(group===newest){assert.equal(p.home,'door',`${p.character} (newest) stays at the door`);const c=doorClearance(p,DOORS[group]);assert.ok(c.front>4.4&&c.distance<14,`${p.character} near but clear of the door: ${JSON.stringify(c)}`);}
   else{assert.equal(p.home,'hill',`${p.character} is up the hill`);assert.ok(Math.hypot(p.x-ZONES[group].x,p.z-ZONES[group].z)<RADIUS+1,`${p.character} in the group's hilltop zone`);}
  }
  assert.ok(moved>=Math.min(3,n*2),`People wander (${moved} moved in 6 s)`);
  for(const [name,x,z,yaw,pitch,eye] of VIEWS){
   await page.evaluate(([x,z,yaw,pitch,eye])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,pitch,eye),[x,z,yaw,pitch,eye??1.72]);
   await page.waitForTimeout(500);await page.screenshot({path:`${out}/after-${n}-${name}.png`});
  }
  assert.deepEqual(errors,[]);
  report.cases.push(`after ${n}: ${n*5} out (${n>2?`L1-${n-1} on the hilltop, `:n>1?'L1 on the hilltop, ':''}L${n} at its exit, ${moved} wandering), corruption ${n-1}, ${TOYS[n]} toys, cleared buildings right, no page errors`);
  await page.close();
 }
 report.passed=true;
}catch(e){report.failure=String(e?.stack||e);}
finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
