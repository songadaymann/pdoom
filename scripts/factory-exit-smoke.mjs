// Level 3's way out into the meadow (2026-10-19), from the ?puzzle=exit loopback start: all five
// beside you at E2M7's exit switch. Muted. Two playthroughs:
//  first: no campaign save, so no exit text screen; the meadow at MEG3N.AVI's door, the five
//         coming out 1.2 s apart to their own camp spot, lights green, README gloating, nothing saved.
//  later: a save that already reached SAFE MODE (levels 1-2 cleared), so the exit text types out
//         over Doom's flat first; then the meadow, and the save gains the factory's five (15/20).
// node scripts/factory-exit-smoke.mjs   (CASES=first or CASES=later to limit)
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/exit';await fs.mkdir(out,{recursive:true});
const only=process.env.CASES?.split(',');
const MEG3N_DOOR={x:-150.2,z:2.5};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[]};
const record=text=>{report.cases.push(text);console.log(text);};
async function playthrough(name,save){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(`${name}: ${e}`));
 await page.addInitScript(save=>{
  const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
  if(save&&!sessionStorage.getItem('qa-seeded')){sessionStorage.setItem('qa-seeded','1');localStorage.setItem('pdoom.campaign.v1',JSON.stringify(save));}
 },save);
 const {read,wait}=nativeQA(page);const shot=n=>page.screenshot({path:`${out}/${name}-${n}.png`});
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory&puzzle=exit');await startGame(page,{console:false});
 await wait(s=>s.mode==='playing'&&s.factory?.all_safe&&s.world.prompt==='SPACE - leave the factory','At the exit switch',60000);
 await wait(s=>s.world.people.every(p=>p.x>980&&p.x<1130&&p.y>-580&&p.y<-200),'All five beside you at the exit',20000);
 await shot('switch');
 await page.keyboard.press('Space',{delay:80});
 await wait(s=>s.factory.exit_done&&s.melt.phase!=='idle','The exit switch freezes the last frame',5000);
 return {page,read,wait,shot};
}
async function meadow({page,read,wait,shot},name){
 const s=await wait(s=>s.outside?.active&&s.outside.currentLevel==='meg3n-factory'&&s.melt.phase==='idle'&&!s.exitText.visible,'Out of MEG3N.AVI into the meadow',30000);
 assert.ok(Math.hypot(s.outside.x-MEG3N_DOOR.x,s.outside.z-MEG3N_DOOR.z)<4,`Player stands at MEG3N.AVI's door (${s.outside.x},${s.outside.z})`);
 assert.equal(s.outside.future.meg3n.live,true,"MEG3N.AVI's doorway shows the live factory view");
 await shot('arrival');
 // They come out one at a time, then walk to their own spot outside the door.
 const early=s.outside.people.filter(p=>p.id>=10);assert.equal(early.length,5);
 assert.ok(early.some(p=>!p.out),'Not everyone is out of the door at once');
 const settled=await wait(s=>s.outside.people.filter(p=>p.id>=10&&p.arrived).length===5,'The five settle outside MEG3N.AVI',20000);
 for(const p of settled.outside.people.filter(p=>p.id>=10)){
  const d=Math.hypot(p.x-MEG3N_DOOR.x,p.z-MEG3N_DOOR.z);assert.ok(d>5&&d<12,`${p.character} gathers outside MEG3N.AVI's door (${d.toFixed(1)} m)`);
 }
 assert.deepEqual(settled.outside.people.filter(p=>p.id>=10).map(p=>p.character),['zvi','victoria','max','paul','ajeya']);
 assert.equal(settled.outside.future.meg3n.strip,'saved,saved,saved,saved,saved','All five lights green');
 assert.equal(settled.outside.future.meg3n.readme,'beaten',"README.TXT carries the exit text's cut");
 await shot('camp');
 // Look back at the door: five green lights, the live factory doorway, README.TXT.
 await page.evaluate(()=>{const yaw=-65*Math.PI/180,o=window.__DOOM_DEBUG__.outside;o.debug.setView(-150.2-Math.sin(yaw)*9+Math.cos(yaw)*-2.5,2.5-Math.cos(yaw)*9-Math.sin(yaw)*-2.5,yaw+Math.PI,.08);});
 await page.waitForTimeout(400);await shot('door');
 return settled;
}
try{
 if(!only||only.includes('first')){
  const run=await playthrough('first',null);
  // The first exit of a playthrough: straight into the meadow, no text screen.
  const seen=new Set();
  for(let i=0;i<40;i++){const s=await run.read();seen.add(s.exitText.phase);if(s.outside?.active&&s.melt.phase==='idle')break;await run.page.waitForTimeout(150);}
  assert.ok(!seen.has('typing'),'No exit text on the first exit');
  const s=await meadow(run,'first');
  assert.equal(s.campaign.saved,5,'This tab counts the five');
  assert.equal(await run.page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')),null,'A first visit by link writes no campaign save');
  record('First exit: the switch melts straight into the meadow at MEG3N.AVI; the five come out one by one to their own camp; lights green; README gloats; no save written');
  await run.page.close();
 }
 if(!only||only.includes('later')){
  const save={version:1,ceo:'amodei',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0};
  const run=await playthrough('later',save);
  const typing=await run.wait(s=>s.exitText.phase==='typing'&&s.exitText.visible&&s.melt.phase==='idle'&&s.exitText.chars>40,'The exit text types out over the flat',15000);
  assert.ok(typing.exitText.chars<typing.exitText.total,'Typed a character at a time');
  await run.shot('text-typing');
  await run.page.keyboard.press('Space');await run.wait(s=>s.exitText.chars===s.exitText.total,'Space finishes the text',3000);
  await run.page.waitForTimeout(500);assert.equal((await run.read()).exitText.chars,typing.exitText.total,'The finished text stays finished');
  await run.shot('text-full');
  assert.match((await run.read()).exitText.text,/read your whole essay/,"Dario's line closes the text");
  const text=await run.page.evaluate(()=>window.__DOOM_DEBUG__.state.mode);assert.equal(text,'outside');
  await run.page.keyboard.press('Space');
  const s=await meadow(run,'later');
  assert.equal(s.campaign.saved,15);assert.equal(s.campaign.worldPdoom,99-4*15);
  const stored=JSON.parse(await run.page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')));
  assert.equal(stored.saved2,31,'The save gains the factory five');assert.equal(stored.saved0,31);assert.equal(stored.ceo,'amodei');
  record("Later exit: the exit text types over Doom's E2 flat (Dario's line), Space finishes it, Space melts into the meadow; save now FREED 15/20");
  // Walk up to CONTROL.EXE: the campaign page takes over and resumes this save in SAFE MODE there.
  await run.page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setView(17,-3,0,0));
  await run.wait(s=>s.outside.nearestDoor==='five-prisons','At CONTROL.EXE',5000);
  await Promise.all([run.page.waitForURL(/level=five-prisons/,{timeout:15000}),run.page.keyboard.press('Space')]);
  assert.match(run.page.url(),/ceo=amodei/);
  const camp=await run.wait(s=>s.outside?.active&&s.outside.currentLevel==='five-prisons'&&s.outside.saved_visual===15,'The campaign resumes in SAFE MODE with all fifteen',90000);
  await run.wait(s=>s.outside.future.meg3n.strip==='saved,saved,saved,saved,saved'&&!s.outside.future.meg3n.live,"MEG3N.AVI's lights are green in the campaign's meadow",5000);
  // In the campaign MEG3N.AVI is a real door: Space walks into the factory (scripts/factory-hub-smoke.mjs).
  await run.page.evaluate(()=>{const yaw=-65*Math.PI/180;window.__DOOM_DEBUG__.outside.debug.setView(-150.2-Math.sin(yaw)*3,2.5-Math.cos(yaw)*3,yaw+Math.PI,0);});
  await run.page.waitForFunction(()=>document.getElementById('hub-enter')?.textContent.includes('Enter MEG3N.AVI'),null,{timeout:5000});
  await run.shot('campaign-door');
  await run.page.keyboard.press('Space',{delay:80});
  const back=await run.wait(s=>s.mode==='playing'&&s.world?.level==='meg3n-factory'&&s.factory?.hub_entry===1&&s.world.ticks>35,'MEG3N.AVI walks back into the factory',60000);
  assert.ok(back.world.people.every(p=>p.camped===1),'All five are at camp, not inside');
  record('From the factory meadow, CONTROL.EXE hands over to the campaign page in SAFE MODE (15 at camp); there MEG3N.AVI walks back into the factory, empty');
  await run.page.close();
 }
 assert.deepEqual(report.errors,[]);
 report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
process.exit(report.passed?0:1);
