import {chromium} from 'playwright';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';import {wallApproaches} from './wall-qa-helpers.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out=process.env.DOOM_OUT||'output/refuge-flow';await fs.mkdir(out,{recursive:true});
const report={cases:[],errors:[],pack:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex')};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});let page;
try{
 const visits=process.env.REFUGE_MIXED_ONLY?[['hal-station','mixed']]:[['five-prisons',false],['hal-station',false],['hal-station',true],['hal-station','mixed']];
 for(const [level,completed]of visits){
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(({level,completed})=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};
   localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:level==='hal-station'?31:0,saved1:completed==='mixed'?15:completed?31:0,lost0:0,lost1:completed==='mixed'?16:0,following0:0,following1:0}));},{level,completed});
  await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/refuge-flow/qa.pk3'}));await page.goto(`http://127.0.0.1:5198/?level=${level}&ceo=altman`);await startGame(page);
  const q=nativeQA(page);await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'Hub boot',60000);
  const at=async(x,y,a=0)=>{await q.command(`netevent pdoom_qa_refuge_at ${Math.round(x)} ${Math.round(y)} ${Math.round(a)}`);};
  const probe=async()=>{await q.command('netevent pdoom_qa_refuge_report');return page.evaluate(()=>JSON.parse(window.__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_REFUGE_QA ')).at(-1).slice(16)));};
  let s=await q.read();assert.equal(s.world.entry_hub,1);assert.equal(s.world.in_refuge,0);assert.equal(s.world.refuge_known,0);assert.equal(s.world.group_gathered,0);
  const hal=level==='hal-station',start=hal?[0,-246,90]:[2032,1120,180];assert.ok(Math.hypot(s.world.x-start[0],s.world.y-start[1])<2);await page.screenshot({path:`${out}/${level}-${completed?'completed':'new'}-entry.png`});report.cases.push(`${level}: ${completed?'completed':'new'} hub visit starts outside unknown refuge`);
  await q.command('god');await q.command('netevent pdoom_qa_refuge_quiet');
  const {map,approach}=await wallApproaches(hal?'hal':'checkpoint');
  // Test the real E controls from both sides, including reopening during closure.
  const inside=hal?[192,480]:[1040,832];await at(...inside);await page.waitForTimeout(900);assert.equal((await probe()).sealed,0);assert.equal((await q.read()).world.group_gathered,0);
  const panels=map.wall_mounts.filter(p=>p.type===15116);assert.equal(panels.length,2);
  for(const p of panels){
   await at(...approach(p));await q.press('KeyE');await page.waitForTimeout(1200);let d=await probe();assert.ok(d.height>=56,JSON.stringify(d));await page.screenshot({path:`${out}/${level}-override-${Math.round(p.x)}-${Math.round(p.y)}.png`});
   const fromInside=hal?p.sector===60:p.sector===87;
   await at(...(hal?[192,fromInside?416:304,fromInside?270:90]:[fromInside?1120:1232,800,fromInside?0:180]));
   await q.press('KeyE');await q.hold('KeyW',900);assert.equal((await q.read()).world.in_refuge,fromInside?0:1,'Walk through the actual opened bulkhead');
   await at(...start);await page.waitForTimeout(1800);
  }
  // Reopen after closure has started but before its mover has finished.
  await at(...approach(panels[0]));await q.press('KeyE');await at(...start);await page.waitForTimeout(3100);await at(...approach(panels[0]));await q.press('KeyE');await page.waitForTimeout(1100);assert.ok((await probe()).height>=56);
  report.cases.push(`${level}: both wall controls open native refuge door, including closing reversal`);
  if(completed){await q.press('F5');await q.wait(s=>s.world?.ticks>35&&s.mode==='playing','Completed retry',30000);assert.equal((await q.read()).world.in_refuge,0);await at(...inside);await page.waitForTimeout(1500);assert.equal((await probe()).sealed,0);assert.equal((await q.read()).campaign.saved,completed==='mixed'?9:10);assert.equal((await q.read()).campaign.lost1,completed==='mixed'?16:0);report.cases.push('Completed HAL retry keeps camp/loss and never seals empty refuge');}
  else{
   // Finding the refuge alone must not suppress the first rescue introduction.
   await at(...start);await q.command('netevent pdoom_qa_refuge_release 0');await q.wait(s=>s.world.guide===1,'First freed person becomes guide');
   await q.wait(s=>!s.uiBlocked,'Rescue card finishes',12000);const trace=[];
   for(let i=0;i<65;i++){
    s=await q.read();trace.push({player:[s.world.x,s.world.y],person:s.world.people[0]});
    if(s.world.sheltered===1&&s.world.in_refuge)break;
    const p=s.world.people[0];await at(p.x,p.y);await page.waitForTimeout(650);
   }
   s=await q.read();assert.equal(s.world.people[0].sheltered,1);assert.equal(s.world.in_refuge,1);assert.equal((await probe()).introduced,1);
   assert.ok(trace.length>=4,'Guide walks a real route');assert.ok(Math.hypot(trace[0].person.x-s.world.people[0].x,trace[0].person.y-s.world.people[0].y)>300);
   await page.screenshot({path:`${out}/${level}-guided-arrival.png`});report.cases.push(`${level}: first rescue physically leads to refuge after early solo exploration`);report[level]={trace};
  }
  // Native retreat still works at the new entrance, preserving prior camp.
  const crank=map.wall_mounts.find(p=>p.type===15131);await at(...approach(crank));await q.hold('KeyE',1850);await q.wait(s=>s.outside?.active,'Entrance retreat',30000);
  assert.equal((await q.read()).campaign.saved0,hal?31:1);assert.equal((await q.read()).campaign.saved1,completed==='mixed'?15:completed?31:hal?1:0);assert.equal((await q.read()).campaign.lost1,completed==='mixed'?16:0);report.cases.push(`${level}: entrance retreat preserves committed camp and rescued people`);
  assert.deepEqual(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown identifier/.test(l))),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);if(page){report.final=await page.evaluate(()=>window.render_game_to_text?.()).catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs?.slice(-40)).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
