// SPACE skips in the endgame (2026-11-09, prototypes/endgame/mode-boss.ts). Jonathan: "for people who are replaying,
// i don't want to force them to listen to the exposition again". Headless and muted:
// 1. The walk in (the SAFE MODE fixture's finale): SPACE — SKIP LINE shows while a line plays, and SPACE cuts it.
// 2. His opening (the walk ended with N, a test key that the fixture allows): SPACE — SKIP shows, and SPACE goes
//    straight on to the ships.
// 3. The end (from the fixture's last part, &part=3 steered by &autosteer=1): once the MCP is down, SPACE goes
//    straight to black and the way back to the meadow; nothing from the skipped end turns up behind it.
// 4. A real run (this browser's save, not the fixture): a test key (2) makes the speedrun practice.
// node scripts/endgame-skip-smoke.mjs   (PDOOM_ORIGIN; needs doom-web/endgame-proto/, node scripts/build-endgame-protos.mjs)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const origin=(process.env.PDOOM_ORIGIN||'http://127.0.0.1:5198').replace(/\/?$/,'/'),out=process.env.DOOM_OUT||'output/endgame-skip';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--autoplay-policy=no-user-gesture-required']}),report={cases:[],errors:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const record=text=>{report.cases.push(text);console.log(text);};
async function until(f,label,ms=30000){const end=Date.now()+ms;let last;while(Date.now()<end){try{last=await f();if(last)return last;}catch{}await sleep(100);}throw new Error(`Timed out: ${label}`);}
const FIXTURE=`${origin}endgame-proto/play.html?m=finale&ceo=altman&safemode=1&saved=31,31,31,31&auto=1`;
let active;
async function open(url,seed){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();active=p;
 p.on('pageerror',e=>report.errors.push(String(e)));
 if(seed)await p.addInitScript(seed=>{if(sessionStorage.getItem('qa-seeded'))return;sessionStorage.setItem('qa-seeded','1');localStorage.setItem('pdoom.campaign.v1',seed);},seed);
 await p.goto(url);
 const eg=()=>p.evaluate(()=>window.__eg?.ready&&window.__eg.state());
 const label=()=>p.evaluate(()=>{const e=document.getElementById('skip');return e&&!e.hidden?e.textContent:'';});
 return {context,p,eg,label};
}
try{
 // 1. a line on the walk
 {const {context,p,eg,label}=await open(FIXTURE);
  const s=await until(async()=>{const e=await eg();return e?.mode_state?.phase==='walk'&&e.mode_state.skip==='line'&&e;},'a line on the walk');
  assert.equal(await label(),'SPACE — SKIP LINE');
  const said=await p.evaluate(()=>[document.getElementById('caption'),document.getElementById('toast')].filter(e=>!e.hidden).map(e=>e.textContent).join(' | '));
  assert.ok(said,'a line is on screen');await p.screenshot({path:`${out}/1-walk-line.png`});
  await p.keyboard.press('Space');await sleep(250);
  const after=await p.evaluate(()=>[document.getElementById('caption'),document.getElementById('toast')].filter(e=>!e.hidden).map(e=>e.textContent).join(' | '));
  assert.notEqual(after,said,`SPACE cut "${said}"`);assert.equal((await eg()).mode_state.phase,'walk','still walking: the walk itself stays');
  record(`Walk: SPACE — SKIP LINE while a line plays ("${said.slice(0,50)}"); SPACE cuts it and the walk goes on (pt ${s.mode_state.pt})`);
  // 2. his opening
  await p.keyboard.press('KeyN');
  await until(async()=>{const e=(await eg()).mode_state;return e.phase==='intro'&&e.skip==='scene';},'his opening');
  await until(async()=>(await p.evaluate(()=>!document.getElementById('caption').hidden)),'his first line',8000);
  assert.equal(await label(),'SPACE — SKIP');await p.screenshot({path:`${out}/2-intro.png`});
  const pt=(await eg()).mode_state.pt;await p.keyboard.press('Space');
  await until(async()=>(await eg()).mode_state.phase==='ships','SPACE goes on to the ships',1500);
  await until(async()=>(await label())==='','no skip in the fight',1000);
  record(`Opening: SPACE — SKIP shows during his lines; SPACE goes straight to the ships (at ${pt.toFixed(1)} s instead of about 9)`);
  await context.close();}

 // 3. the end
 {const {context,p,eg,label}=await open(FIXTURE+'&autosteer=1&part=3');
  await until(async()=>{const e=await eg();return e?.mode_state?.phase==='trick'&&e.mode_state.marks?.length;},'part 3',60000);await sleep(2600);
  const marks=(await eg()).mode_state.marks;await p.evaluate(m=>{window.__eg.lookAt(...m[0]);window.__eg.press(0);},marks);
  await until(async()=>(await eg()).phase==='down','the trick shot lands',60000);await sleep(800);
  assert.equal((await eg()).mode_state.skip,'scene');assert.equal(await label(),'SPACE — SKIP');await p.screenshot({path:`${out}/3-down.png`});
  await p.keyboard.press('Space');
  await until(()=>p.evaluate(()=>document.querySelector('#black')?.classList.contains('title')&&/MEADOW/.test(document.querySelector('#black small')?.textContent??'')),'black and the way back',2000);
  await sleep(6000);
  const e=(await eg()).mode_state;assert.equal(e.ending,'black');assert.equal(e.endSkipped,true);
  assert.deepEqual(await p.evaluate(()=>['dialog','caption','toast','grok'].filter(id=>!document.getElementById(id).hidden)),[],'nothing from the skipped end shows up');
  assert.equal(await label(),'');await p.screenshot({path:`${out}/3-black.png`});
  await p.mouse.click(640,400);await p.waitForURL(/safemode=1&after=5/,{timeout:15000});
  record('End: once the MCP is down SPACE goes straight to black and CLICK TO GO BACK TO THE MEADOW; the dialog and the wasteland never come; a click goes back');
  await context.close();}

 // 4. a real run: a test key makes it practice
 {const runId=randomUUID(),masks={saved0:31,saved1:31,saved2:31,saved3:31,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0};
  const seed=JSON.stringify({version:1,ceo:'altman',hub:true,...masks,ending3:0,endgame:1,speedrun:{runId,splits:{'five-prisons':1,'hal-station':1,'meg3n-factory':1,'agentic-pods':1,'safe-mode':0,endgame:0},restarts:0,practice:'',done:false,startedAt:Date.now()}});
  const {context,p,eg}=await open(`${origin}endgame-proto/play.html?m=finale&ceo=altman&auto=1`,seed);
  await until(async()=>(await eg())?.mode_state?.phase==='walk','the walk');await sleep(1200);
  const saved=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('pdoom.campaign.v1')).speedrun);
  assert.equal((await saved()).practice,'','a clean run so far');assert.equal((await eg()).mode_state.practice,'');
  await p.keyboard.press('Space');assert.equal((await saved()).practice,'','SPACE is not a shortcut');
  await p.keyboard.press('Digit2');
  await until(async()=>/test key/.test((await saved()).practice),'the test key makes the run practice',3000);
  await until(async()=>/PRACTICE$/.test(await p.locator('#speedrun-timer').innerText()),'the timer says so',3000);
  record('A real run: SPACE keeps it clean; a test key (2) makes it practice, in the save and on the timer');
  await context.close();}
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);await active?.screenshot({path:`${out}/failure.png`}).catch(()=>{});report.state=await active?.evaluate(()=>window.__eg?.state?.()).catch(()=>null);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify({passed:!!report.passed,cases:report.cases,failure:report.failure?.slice(0,1500),errors:report.errors.slice(0,5)},null,1));process.exit(report.passed?0:1);
