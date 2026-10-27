// Plays THE BOSS (the 2026-10-26 redesign) headless and muted. A bot hits back the balls aimed at it
// through the serve and the swarm, then in part 2 swats what's on it and throws at the glowing bits
// through Elon's attacks. In part 3 it stands in three places to check the bank route follows it, then
// lands the trick shot with ?autosteer=1. A second page throws a bad trick shot and checks the reset,
// then runs the countdown out and checks the launch is only delayed. Screenshots go to
// output/endgame-proto/boss/. Server up first (port 5228).
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const port=Number(process.env.PDOOM_PORT)||5228,out='output/endgame-proto/boss';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const log={};let failed=[];
async function open(q){
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${port}/endgame-proto/play.html?m=boss&auto=1&mute=1${q}`);
 await page.waitForFunction(()=>window.__eg?.ready,null,{timeout:60000});
 const st=()=>page.evaluate(()=>window.__eg.state());
 const until=async(f,ms)=>{const end=Date.now()+ms;while(Date.now()<end){const s=await st();if(f(s))return s;await wait(100);}return null;};
 return {page,errors,st,until,shot:(n)=>page.screenshot({path:`${out}/${n}.png`})};
}
{
 const p=await open('&autosteer=1');
 // the bot: a ball on it gets looked at and hit back when it flashes; otherwise it watches a ship (part 1)
 // or throws at the nearest glowing bit (part 2)
 await p.page.evaluate(()=>{
  const eg=window.__eg,c=eg.ctx;
  window.__bot=setInterval(()=>{
   const s=eg.state(),m=s.mode_state;
   if(m.phase!=='ships'&&m.phase!=='shieldDown')return;
   if(m.incoming){eg.lookAt(...m.incoming);if(m.hot&&Math.random()<.6)eg.press(0);return;}
   if(m.phase==='ships'){const core=eg.recCore();if(core)eg.lookAt(...core);return;}
   if(m.spotsAt.length){const e=c.player.eyePos();const t=m.spotsAt.slice().sort((a,b)=>Math.hypot(a[0]-e.x,a[2]-e.z)-Math.hypot(b[0]-e.x,b[2]-e.z))[0];eg.lookAt(...t);}
   if(c.held)eg.press(0);
  },16);
 });
 const swarm=await p.until(s=>s.mode_state.fleet==='swarm'&&s.recs.length>=7,120000);log.swarm=!!swarm;
 if(swarm){await wait(2500);await p.shot('1-swarm');}
 const s1=await p.until(s=>s.mode_state.phase==='shieldDown',240000);log.ships=!!s1;
 const after1=(await p.st()).mode_state;log.shipsDown=after1.shipsDown;log.crowdReturns=after1.crowdReturns;
 if(!s1){log.shipsState=after1;await p.page.evaluate(()=>window.__eg.key('Digit2'));}
 // part 2: a screenshot of each attack the first time it's live
 const shotAt={update:2200,starlink:2600,doge:2200},taken=new Set();let s2=null;const end=Date.now()+300000;
 while(Date.now()<end){
  const m=(await p.st()).mode_state;if(m.phase==='trick'){s2=m;break;}
  for(const k of m.attacks)if(shotAt[k]&&!taken.has(k)){taken.add(k);await wait(shotAt[k]);await p.shot(`2-${k}`);}
  await wait(120);
 }
 log.shieldDown=!!s2;const st2=(await p.st()).mode_state;log.attacksSeen=st2.started;log.grokWarnings=st2.warnings;
 if(!s2){log.shieldState=st2;log.integrity=(await p.st()).mcp.integrity;await p.page.evaluate(()=>window.__eg.key('Digit3'));}
 await p.page.evaluate(()=>clearInterval(window.__bot));
 await p.until(s=>s.mode_state.phase==='trick',5000);await wait(2600);
 // the route follows you: three places, three fits
 log.paths=[];
 for(const [x,z] of [[0,34],[-30,20],[25,-30]]){
  await p.page.evaluate(([x,z])=>window.__eg.place(x,z),[x,z]);await wait(1300);
  const m=(await p.st()).mode_state;log.paths.push({at:[x,z],key:m.pathKey,marks:m.marks.length});
 }
 await p.shot('3-trick-from-anywhere');
 const marks=(await p.st()).mode_state.marks;
 await p.page.evaluate((m)=>{window.__eg.lookAt(...m[0]);window.__eg.press(0);},marks);
 // catch the chase cam in bullet time near a mark, then let it finish
 const slow=await p.until(s=>s.mode_state.trick&&s.mode_state.timeScale<.45&&s.mode_state.trick.idx>=1,20000);await p.shot('4-trick-bullet-time');log.bulletTime=!!slow;
 const last=await p.until(s=>s.mode_state.trick&&s.mode_state.trick.idx>=marks.length,30000);if(last){await wait(500);await p.shot('5-trick-window');}
 const won=await p.until(s=>s.phase==='down',30000);log.trickWin=!!won;log.trickBest=(await p.st()).mode_state.best;
 await wait(5000);await p.shot('6-end');log.errors=p.errors;await p.page.close();
}
{
 const p=await open('&part=3');
 await p.until(s=>s.mode_state.phase==='trick',8000);await wait(2500);
 await p.page.evaluate(()=>{window.__eg.look(-Math.PI/2+.6,0);window.__eg.press(0);});// well off mark 1
 const missed=await p.until(s=>s.mode_state.attempts>=1&&!s.mode_state.trick&&s.held,15000);log.missResets=!!missed;
 await p.page.evaluate(()=>window.__boss.countdown(1.5));
 const delayed=await p.until(s=>s.mode_state.delays>=1,6000);log.launchDelayed=!!delayed&&delayed.mode_state.launchT>25;
 log.missErrors=p.errors;await p.page.close();
}
await browser.close();
console.log(JSON.stringify(log));
const fits=log.paths.filter(q=>q.key&&q.marks>=3);
log.pathFollows=fits.length===3&&new Set(fits.map(q=>q.key)).size>=2;
failed=['swarm','ships','shieldDown','pathFollows','bulletTime','trickWin','missResets','launchDelayed'].filter(k=>!log[k]);
if(!(log.crowdReturns>0))failed.push('crowdReturns');
if(['update','starlink','doge'].some(k=>!log.attacksSeen?.[k]))failed.push('attacks');
if(!(log.grokWarnings>0))failed.push('grok');
if(log.errors?.length||log.missErrors?.length)failed.push('errors');
console.log(failed.length?`FAILED: ${failed.join(', ')}`:'ALL OK');process.exitCode=failed.length?1:0;
