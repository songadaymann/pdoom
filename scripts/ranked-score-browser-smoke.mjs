// The whole-game speedrun (2026-11-07, doom-web/speedrun.js), against a loopback copy of the mann.cool Worker
// (mann-cool `npx wrangler dev --local --port 5202`). Headless, muted. No public score writes.
//  1. A new campaign from the episode menu (HUMAN CONTAINMENT AREA, which has no film) starts the speedrun: its
//     record in the save, a run ticket from the server, the timer on screen, and a clock that stops in the menu.
//  2. A seeded save at the endgame, started at its last part (&part=3, steered by &autosteer=1): the fight page adds
//     its split, shows the timer, and stops the clock when the MCP goes down (done). Those test switches make the run
//     practice (2026-11-09). SPACE skips the end to black (and marks the endgame done); back in the meadow the card
//     opens by itself as a practice run, with no way to submit it.
//  3. A seeded finished run, loaded into the meadow: the results card opens by itself with the time and the splits,
//     and the time submits to the one board with a link to its recording, held for review (every top-ten time is,
//     since 2026-11-09). The link can then be changed from the card (POST /api/v1/pdoom/runs/video). After that the
//     card doesn't open by itself again, and Results shows the link.
// node scripts/ranked-score-browser-smoke.mjs   (DOOM_URL, PDOOM_SCORE_API)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',api=process.env.PDOOM_SCORE_API||'http://127.0.0.1:5202';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(api).hostname))throw Error('Score fixtures require an isolated loopback API.');
const out=process.env.DOOM_OUT||'output/ranked-validation/speedrun';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const record=text=>{report.cases.push(text);console.log(text);};
async function open(seed){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
 await p.route('**/leaderboard-config.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({mode:'public',enabled:true,endpoint:api+'/api/v1/leaderboard',runEndpoint:api+'/api/v1/pdoom/runs',shellSrc:'/platform/v1/game-shell.js'})}));
 await p.route('https://mann.cool/api/v1/**',r=>r.request().method()==='POST'?r.fulfill({contentType:'application/json',body:'{"success":true}'}):r.continue());
 await p.addInitScript(seed=>{if(sessionStorage.getItem('qa-seeded'))return;sessionStorage.setItem('qa-seeded','1');localStorage.removeItem('pdoom.campaign.v1');if(seed){localStorage.setItem('pdoom.campaign.v1',seed);localStorage.setItem('pdoom.opening-complete.v1','1');}},seed??null);
 return {context,p};
}
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function wait(p,test,label,timeout=30000){const end=Date.now()+timeout;let s;while(Date.now()<end){s=await read(p).catch(()=>null);if(s&&test(s))return s;await sleep(250);}throw Error(`${label}: ${JSON.stringify(s?.speedrun??s?.mode)}`);}
const save=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('pdoom.campaign.v1')||'null'));
let active;
try{
 // 1. the menu start
 {const {context,p}=await open();active=p;
  const menu=view=>p.waitForFunction(view=>JSON.parse(window.render_game_to_text()).menu?.page===view,view,{timeout:15000});
  await p.goto(`${base}?ceo=altman&levels=1`);await p.waitForFunction(()=>window.render_game_to_text);
  await p.click('#title-enter');await menu('main');await p.click('#menu-new');await menu('hero');await p.click('#hero-next');await menu('levels');
  await p.click('#level-agentic-pods');
  let s=await wait(p,s=>s.mode==='playing'&&s.levelId==='agentic-pods'&&s.speedrun?.splits['agentic-pods']>1500,'A new campaign\'s first level starts the speedrun',90000);
  assert.equal(s.speedrun.practice,'');assert.equal(s.speedrun.restarts,0);assert.equal(s.speedrun.done,false);
  const stored=await save(p);assert.equal(stored.speedrun.runId,s.speedrun.runId,'The run is in the save at once');assert.equal(stored.hub,false);
  const ticket=await p.waitForFunction(id=>{const r=JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+id)||'null');return r?.ticketId&&r;},s.speedrun.runId,{timeout:15000}).then(h=>h.jsonValue());
  assert.equal(ticket.levelId,'campaign');assert.equal(ticket.scoreVersion,'speedrun-v1');
  const timer=await p.locator('#speedrun-timer');assert.ok(await timer.isVisible(),'The timer is on screen');assert.match(await timer.innerText(),/^\d+:\d\d$/);
  await p.screenshot({path:`${out}/1-level-timer.png`});
  // the menu stops the clock
  await p.keyboard.press('Escape');await menu('main');await sleep(500);const paused=(await read(p)).speedrun.ms;await sleep(2000);
  assert.ok((await read(p)).speedrun.ms-paused<300,'The clock stops while the menu is open');
  await p.keyboard.press('Escape');await sleep(1500);assert.ok((await read(p)).speedrun.ms>paused,'and runs again after');
  record(`Episode menu start: the speedrun starts with the level (run ${s.speedrun.runId.slice(0,8)}, in the save at once), the server issues its ticket (campaign / speedrun-v1), the timer shows, and the menu stops the clock`);
  await context.close();}

 // 2. the endgame: its split, the clock stopping, the test switches making it practice, and SPACE skipping the end
 {const runId=randomUUID(),splits={'five-prisons':300000,'hal-station':320000,'meg3n-factory':400000,'agentic-pods':420000,'safe-mode':150000,endgame:0};
  const masks={saved0:31,saved1:31,saved2:31,saved3:31,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0};
  const seed=JSON.stringify({version:1,ceo:'altman',hub:true,...masks,ending3:0,endgame:1,speedrun:{runId,splits,restarts:3,practice:'',done:false,startedAt:Date.now()-3600e3}});
  const {context,p}=await open(seed);active=p;
  await p.goto(`${base}endgame-proto/play.html?m=finale&ceo=altman&auto=1&autosteer=1&part=3`);
  const eg=()=>p.evaluate(()=>window.__eg?.ready&&window.__eg.state());
  const until=async(test,label,timeout=60000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=await test().catch(()=>null);if(v)return v;await sleep(250);}throw Error(label);};
  await until(async()=>{const e=await eg();return e?.mode_state?.phase==='trick'&&e.mode_state.marks?.length;},'part 3');
  await sleep(2600);
  assert.match(await p.locator('#speedrun-timer').innerText(),/^\d+:\d\d PRACTICE$/,'The endgame shows the timer, marked practice');
  const during=await until(async()=>{const v=await save(p);return v.speedrun.splits.endgame>1000&&v;},'The endgame split is written as it runs',10000);
  assert.equal(during.speedrun.done,false);assert.match(during.speedrun.practice,/test switch|test key/,'A test switch makes the run practice');
  const marks=(await eg()).mode_state.marks;await p.evaluate(m=>{window.__eg.lookAt(...m[0]);window.__eg.press(0);},marks);
  await until(async()=>(await eg()).phase==='down','the trick shot lands');
  const done=(await save(p)).speedrun;assert.equal(done.done,true,'The MCP going down finishes the run');
  await sleep(1500);assert.equal((await save(p)).speedrun.splits.endgame,done.splits.endgame,'and stops its clock');
  await p.screenshot({path:`${out}/2-endgame-down.png`});
  assert.equal((await eg()).mode_state.skip,'scene','The end can be skipped');
  await p.keyboard.press('Space');
  await until(async()=>{const e=(await eg()).mode_state;return e.ending==='black'&&e.endSkipped;},'SPACE skips to black',3000);
  await until(()=>p.evaluate(()=>document.querySelector('#black')?.classList.contains('title')&&/MEADOW/.test(document.querySelector('#black small')?.textContent??'')),'the way back is offered at once',3000);
  assert.equal((await save(p)).endgame,2,'Skipping the end still marks the endgame done');
  await sleep(1700);await p.mouse.click(640,400);
  await p.waitForURL(/\?play=1&load=1/,{timeout:15000}).catch(()=>{});
  const s=await wait(p,s=>s.scoreView?.open,'The results card opens by itself in the meadow',120000);
  assert.equal(s.scoreView.result.eligible,false);assert.match(s.scoreView.result.practiceReason,/test switch|test key/);
  assert.equal(await p.locator('#score-submit').isHidden(),true,'A practice run has no way to submit');
  await p.screenshot({path:`${out}/3-practice.png`});
  record(`Endgame: the fight adds its split (${done.splits.endgame} ms here) with the timer on screen and stops at the MCP going down; &part=3 and &autosteer make the run practice; SPACE skips the end to black and the endgame is still done; the meadow's card shows it as practice, with no submit`);
  await context.close();}

 // 3. a finished run: the results card and the submission
 {const runId=randomUUID(),splits={'five-prisons':300000,'hal-station':320000,'meg3n-factory':400000,'agentic-pods':420000,'safe-mode':150000,endgame:240000};
  const masks={saved0:31,saved1:31,saved2:31,saved3:31,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0};
  const seed=JSON.stringify({version:1,ceo:'altman',hub:true,...masks,ending3:0,endgame:2,speedrun:{runId,splits,restarts:3,practice:'',done:true,startedAt:Date.now()-3600e3}});
  const {context,p}=await open(seed);active=p;
  await p.goto(`${base}?play=1&load=1`);
  let s=await wait(p,s=>s.scoreView?.open,'The results card opens by itself in the meadow',120000);
  const total=Object.values(splits).reduce((a,b)=>a+b,0);
  assert.equal(s.scoreView.result.activeMs,total);assert.equal(s.scoreView.result.eligible,true);
  const card=await p.locator('#score-dialog').innerText();
  for(const label of ['Level 1','Level 2','Level 3','Level 4','SAFE MODE','Endgame','Restarts','20/20 people home'])assert.ok(card.includes(label),`The card lists ${label}`);
  assert.match(card,/TIME \d+:\d\d\.\d\d/);await p.screenshot({path:`${out}/4-results.png`});
  assert.equal(await p.locator('#score-video').isVisible(),true,'the video field is on the card');
  await p.fill('#score-name','Speedrun QA');await p.fill('#score-video','https://youtu.be/speedrun-qa');await p.click('#submit-score');
  await p.waitForFunction(()=>/checked before|held for review|Saved to the leaderboard/.test(document.querySelector('#score-status')?.textContent||''),{},{timeout:20000});
  const status=await p.locator('#score-status').innerText();assert.match(status,/Top-ten times are checked before they appear/i,'Every top-ten time is held for review');
  let ranked=await p.evaluate(id=>JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+id)),runId);assert.equal(ranked.submitted,true);assert.equal(ranked.pending,undefined);assert.equal(ranked.videoUrl,'https://youtu.be/speedrun-qa');
  await p.screenshot({path:`${out}/5-submitted.png`});
  record(`A finished run: the meadow's results card lists the six splits and ${total} ms, and the time submits to campaign-speedrun-v1 with its video link, held because it's top ten`);
  // change the link afterwards
  assert.equal(await p.locator('#score-video-form').isVisible(),true,'the card offers the link afterwards');assert.equal(await p.inputValue('#score-video-later'),'https://youtu.be/speedrun-qa');
  await p.fill('#score-video-later','https://evil.example/x');await p.click('#save-video');
  await p.waitForFunction(()=>/video site|https link/i.test(document.querySelector('#score-status')?.textContent||''),{},{timeout:10000});
  await p.fill('#score-video-later','https://vimeo.com/42');await p.click('#save-video');
  await p.waitForFunction(()=>/Video link saved/.test(document.querySelector('#score-status')?.textContent||''),{},{timeout:10000});
  ranked=await p.evaluate(id=>JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+id)),runId);assert.equal(ranked.videoUrl,'https://vimeo.com/42');
  report.runId=runId;await p.screenshot({path:`${out}/5b-video-changed.png`});
  record('The link changes from the card afterwards (a non-video site is refused by the server)');
  // a later visit: the card waits behind the Results button
  await p.goto(`${base}?play=1&load=1`);
  s=await wait(p,s=>s.outside?.active&&s.scoreView?.available,'The meadow again',120000);
  assert.equal(s.scoreView.open,false,'A submitted run does not open the card again');assert.equal(s.scoreView.unread,true);
  await p.click('#show-score');assert.match(await p.locator('#score-status').innerText(),/already submitted/);assert.equal(await p.locator('#score-submit').isHidden(),true);
  assert.equal(await p.inputValue('#score-video-later'),'https://vimeo.com/42','Results still offers the link');
  record('After the submission the card no longer opens by itself; Results shows it, already submitted, with its link to change');
  await context.close();}
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);await active?.screenshot({path:`${out}/failure.png`}).catch(()=>{});report.state=await active?.evaluate(()=>window.render_game_to_text?.()).catch(()=>null);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify({passed:!!report.passed,cases:report.cases,failure:report.failure?.slice(0,2000),errors:report.errors.slice(0,5)},null,1));process.exit(report.passed?0:1);
