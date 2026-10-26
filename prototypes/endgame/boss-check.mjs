// Plays THE BOSS headless and muted: a bot hits the six ships' shots back, hits the glowing bits, then lands
// the trick shot with ?autosteer=1; a second page throws a deliberately bad trick shot and checks
// the reset. Screenshots go to output/endgame-proto/boss/. Server up first (port 5228).
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
 // the bot: in part 1 it faces a ship and swings when a shot flashes; in part 2 it throws at the nearest glowing bit
 await p.page.evaluate(()=>{
  const eg=window.__eg,c=eg.ctx;let prev=null,prevT=performance.now();
  const lead=(core)=>{const now=performance.now(),dt=Math.max(.016,(now-prevT)/1000),v=prev?core.map((x,i)=>(x-prev[i])/dt):[0,0,0];prev=core;prevT=now;const e=c.player.eyePos(),d=Math.hypot(core[0]-e.x,core[1]-e.y,core[2]-e.z);return core.map((x,i)=>x+v[i]*d/34);};
  window.__bot=setInterval(()=>{
   const s=eg.state(),m=s.mode_state;
   if(m.phase==='ships'){const core=eg.recCore();if(core)eg.lookAt(...core);if(m.hot&&Math.random()<.5)eg.press(0);}
   if(m.phase==='shieldDown'){
    if(m.spotsAt.length){const e=c.player.eyePos();const t=m.spotsAt.slice().sort((a,b)=>Math.hypot(a[0]-e.x,a[2]-e.z)-Math.hypot(b[0]-e.x,b[2]-e.z))[0];eg.lookAt(...t);}
    if(c.held)eg.press(0);
   }
  },16);
 });
 await p.until(s=>s.mode_state.wave===2&&s.recs.length>=2,120000);await wait(2500);await p.shot('1-three-ships');
 const s1=await p.until(s=>s.mode_state.phase==='shieldDown',150000);log.ships=!!s1;
 if(!s1){log.shipsState=(await p.st()).mode_state;await p.page.evaluate(()=>window.__eg.key('Digit2'));}
 await p.until(s=>s.mode_state.spots>=2&&s.mode_state.shots>=1,20000);await wait(400);await p.shot('2-shield-down');
 const s2=await p.until(s=>s.mode_state.phase==='trick',150000);log.shieldDown=!!s2;
 if(!s2){log.shieldState=(await p.st()).mode_state;log.integrity=(await p.st()).mcp.integrity;await p.page.evaluate(()=>window.__eg.key('Digit3'));}
 await p.page.evaluate(()=>clearInterval(window.__bot));
 await p.until(s=>s.mode_state.phase==='trick',5000);await wait(2600);
 await p.page.evaluate(()=>{window.__eg.place(0,34);});await wait(200);await p.shot('3-trick-setup');
 const marks=(await p.st()).mode_state.marks;
 await p.page.evaluate((m)=>{window.__eg.lookAt(...m[0]);window.__eg.press(0);},marks);
 // catch the chase cam in bullet time near a mark, then let it finish
 const slow=await p.until(s=>s.mode_state.trick&&s.mode_state.timeScale<.45&&s.mode_state.trick.idx>=1,20000);await p.shot('4-trick-bullet-time');log.bulletTime=!!slow;
 const last=await p.until(s=>s.mode_state.trick&&s.mode_state.trick.idx>=5,30000);if(last){await wait(500);await p.shot('5-trick-window');}
 const won=await p.until(s=>s.phase==='down',30000);log.trickWin=!!won;log.trickBest=(await p.st()).mode_state.best;
 await wait(4200);await p.shot('6-end');log.errors=p.errors;await p.page.close();
}
{
 const p=await open('&part=3');
 await p.until(s=>s.mode_state.phase==='trick',8000);await wait(2500);
 await p.page.evaluate(()=>{window.__eg.look(-Math.PI/2+.6,0);window.__eg.press(0);});// well off mark 1
 const missed=await p.until(s=>s.mode_state.attempts>=1&&!s.mode_state.trick&&s.held,15000);
 log.missResets=!!missed;log.missErrors=p.errors;await p.page.close();
}
await browser.close();
console.log(JSON.stringify(log));
failed=['ships','shieldDown','bulletTime','trickWin','missResets'].filter(k=>!log[k]);
if(log.errors?.length||log.missErrors?.length)failed.push('errors');
console.log(failed.length?`FAILED: ${failed.join(', ')}`:'ALL OK');process.exitCode=failed.length?1:0;
