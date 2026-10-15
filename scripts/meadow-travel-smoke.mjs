// Real input checks for the late-game travel unlock, including loss/partial saves.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.DOOM_URL||'http://127.0.0.1:5198/',out=process.env.DOOM_OUT||'output/icon-physics/travel';
await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[],measured:[]};
const snapshot=p=>p.evaluate(()=>{const o=window.__DOOM_DEBUG__.outside;return {state:o.getState(),time:o.debug.getTime()};});
const view=(p,x=80,z=-30,yaw=0)=>p.evaluate(a=>window.__DOOM_DEBUG__.outside.debug.setView(...a),[x,z,yaw,0]);
async function measure(p,keys){
 await view(p);await p.waitForTimeout(80);const before=await snapshot(p);
 for(const key of keys)await p.keyboard.down(key);await p.waitForTimeout(900);for(const key of keys)await p.keyboard.up(key);
 const after=await snapshot(p),distance=Math.hypot(after.state.x-before.state.x,after.state.z-before.state.z);
 return distance/(after.time-before.time);
}
async function load(save){
 const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(String(e)));
 await p.addInitScript(s=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify(s)),{version:1,ceo:'altman',hub:true,lost0:0,lost1:0,following0:0,following1:0,...save});
 await p.goto(url+'?play=1&load=1&ceo=altman');
 await p.waitForFunction(()=>window.__DOOM_DEBUG__?.outside?.getState().active,{},{timeout:90000});return p;
}
try{
 for(const [name,save,walk,run] of [
  ['First facility complete',{saved0:31,saved1:0},3.6,6],
  ['Second facility incomplete',{saved0:31,saved1:15},3.6,6],
  ['Both facilities complete',{saved0:31,saved1:31},6,10],
  ['Both resolved with some losses',{saved0:23,lost0:8,saved1:19,lost1:12},6,10],
 ]){
  const p=await load(save),s=(await snapshot(p)).state;
  assert.deepEqual(s.movement,{walk,run,boosted:walk===6});
  const actualWalk=await measure(p,['KeyW']),actualRun=await measure(p,['Shift','KeyW']);
  assert.ok(Math.abs(actualWalk-walk)<.35,name+' walk '+actualWalk);assert.ok(Math.abs(actualRun-run)<.5,name+' run '+actualRun);
  report.measured.push({name,walk:actualWalk,run:actualRun});report.cases.push(name+': actual walk/run match the correct pace');
  if(walk===6&&save.saved1===31){
   const diagonal=await measure(p,['Shift','KeyW','KeyD']);assert.ok(Math.abs(diagonal-run)<.5,'Diagonal speed stays normalized');
   await view(p,17,-3,Math.PI);await p.keyboard.down('Shift');await p.keyboard.down('KeyW');await p.waitForTimeout(850);
   await p.keyboard.up('KeyW');await p.keyboard.up('Shift');assert.ok((await snapshot(p)).state.z<-.35,'Fast movement cannot cross the bunker wall');
   report.cases.push('Fast diagonal travel is normalized and sprinting still stops at building walls');
   await view(p,3,-6.5,0);await p.screenshot({path:out+'/late-game-meadow.png'});
   await p.evaluate(()=>window.__DOOM_DEBUG__.outside.startIntro('altman'));await p.waitForTimeout(100);
   const intro=(await snapshot(p)).state;assert.equal(intro.intro,true);assert.deepEqual(intro.movement,{walk:3.6,run:6,boosted:false});
   assert.ok(Math.abs(await measure(p,['KeyW'])-3.6)<.35);report.cases.push('The opening walk retains its original pace even with a completed campaign');
  }
  await p.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify(report));process.exit(report.passed?0:1);
