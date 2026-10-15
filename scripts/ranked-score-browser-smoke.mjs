import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {startGame} from './doom-qa-ui.mjs';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',api=process.env.PDOOM_SCORE_API||'http://127.0.0.1:5202';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(api).hostname))throw Error('Score fixtures require an isolated loopback API.');
const out=process.env.DOOM_OUT||'output/ranked-validation/browser';await fs.mkdir(out,{recursive:true});
const source=await fs.readFile('doom-web/main.js','utf8');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[],method:'Real Worker/D1 emulator; controlled completed-result fixtures and separate native-start/pause check. No public score writes.'};
let active;
async function open(options={viewport:{width:1280,height:800}}){
  const context=await browser.newContext(options),p=await context.newPage();active=p;p.on('pageerror',e=>report.errors.push(String(e)));
  await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...args){super(...args);window.__QA_WORKER__=this;}};});
  await p.route('**/main.js',r=>r.fulfill({contentType:'text/javascript',body:source+'\nwindow.__QA_SCORE_VIEW__=scoreView;'}));
  await p.route('**/leaderboard-config.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({mode:'public',enabled:true,endpoint:api+'/api/v1/leaderboard',runEndpoint:api+'/api/v1/pdoom/runs',shellSrc:'/platform/v1/game-shell.js'})}));
  await p.route('https://mann.cool/api/v1/**',r=>r.request().method()==='POST'?r.fulfill({contentType:'application/json',body:'{"success":true}'}):r.continue());
  await p.goto(base);await ready(p);return{context,p};
}
async function ready(p){await p.waitForFunction(()=>window.render_game_to_text&&window.__QA_SCORE_VIEW__);}
async function show(p,id,levelId='five-prisons'){
  await p.evaluate(async({id,levelId})=>{const {getLevel}=await import('./levels.js'),{scoreRun}=await import('./run-score.js'),l=getLevel(levelId);
    const result=scoreRun({level_id:l.id,level_version:l.version,score_version:l.scoreVersion,outcome:'escaped',saved:6,total:6,active_tics:21000,p_doom_cover:5,cameras_broken:9,cameras_total:9,practice:0,saved_figures:5,ceo_state:'conscious',skill:3,entry:'cold',retreat:0,routes:[]},l,{runId:id});window.__QA_SCORE_VIEW__.show(result);
  },{id,levelId});
}
async function restore(p){await p.reload();await ready(p);await p.click('#title-enter');assert.equal(await p.locator('#menu-saved-results').isVisible(),true);await p.click('#menu-saved-results');await p.locator('#score-dialog').waitFor({state:'visible'});}
async function retry(p){await p.click('#submit-score');await p.waitForFunction(()=>document.querySelector('#submit-score').textContent==='Retry submission');}
try{
  const {p,context}=await open(),id=randomUUID(),sent=[];let loseTicket=true,loseScore=true,unavailable=true;
  await p.route(api+'/api/v1/**',async r=>{
    const request=r.request();if(request.method()!=='POST'){await r.continue();return;}
    const body=request.postDataJSON();sent.push(body);
    if(!body.variant&&loseTicket){loseTicket=false;await r.fetch();await r.abort('failed');return;}
    if(body.variant?.includes('rescue-v3')&&loseScore){loseScore=false;await r.fetch();await r.abort('failed');return;}
    if(body.variant&&unavailable){unavailable=false;await r.fulfill({status:503,contentType:'application/json',body:'{"error":"Temporary outage. Retry this result."}'});return;}
    await r.continue();
  });
  await show(p,id);await p.fill('#score-name','Original fixture');await retry(p);
  assert.match(await p.locator('#score-status').innerText(),/kept here/);await restore(p);assert.equal(await p.locator('#score-name').inputValue(),'Original fixture');assert.equal(await p.locator('#score-name').isDisabled(),true);
  await retry(p);await restore(p);await retry(p);await restore(p);
  await p.keyboard.press('Escape');assert.equal(await p.locator('#score-dialog').isVisible(),false);assert.equal((await p.evaluate(()=>JSON.parse(window.render_game_to_text()))).menu.page,'main');await p.click('#menu-saved-results');
  await p.click('#submit-score');await p.waitForFunction(()=>document.querySelector('#submit-score').textContent==='Submitted');assert.match(await p.locator('#score-status').innerText(),/Saved to the leaderboard/);
  const bodies=sent.filter(body=>body.variant);assert.equal(bodies.filter(body=>body.variant.includes('rescue-v3')).length,3,'Unavailable request and uncertain accepted response retry the same total score');
  assert.ok(bodies.every(body=>body.name==='Original fixture'));assert.ok(bodies.every(body=>body.submissionId.startsWith(id+':')));
  const starts=sent.filter(body=>!body.variant);assert.equal(starts.length,2);assert.equal(starts[0].nonce,starts[1].nonce);
  for(const kind of ['rescue']){const response=await p.request.get(api+`/api/v1/leaderboard?slug=pdoom&variant=five-prisons-${kind}-v3&limit=100`),data=await response.json();const rows=data.entries.filter(row=>row.submissionId.startsWith(id+':'));assert.equal(rows.length,1);assert.equal(rows[0].score,kind==='rescue'?55200:600000);}
  await p.screenshot({path:out+'/recovered-result.png'});await p.click('.score-close');assert.equal(await p.locator('#menu-saved-results').isVisible(),false);
  report.cases.push('Lost ticket response, lost accepted-score response, partial outage, three refreshes, original name/IDs and Escape-safe Saved Results recovery; exactly one total-score row');await context.close();
  const phone=await open({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await show(phone.p,randomUUID(),'hal-station');await phone.p.click('.score-close');await phone.p.click('#title-enter');const saved=phone.p.locator('#menu-saved-results');await saved.scrollIntoViewIfNeeded();const savedBox=await saved.boundingBox();assert.ok(savedBox.x>=0&&savedBox.x+savedBox.width<=390&&savedBox.y>=0&&savedBox.y+savedBox.height<=844);await phone.p.screenshot({path:out+'/phone-saved-menu.png'});await saved.click();await phone.p.fill('#score-name','Phone fixture');await phone.p.click('#submit-score');await phone.p.waitForFunction(()=>document.querySelector('#submit-score').textContent==='Submitted');
  assert.equal(await phone.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.p.screenshot({path:out+'/phone-result.png'});await phone.context.close();report.cases.push('Level 2 total score submits once from phone-sized UI');
  const racing=await open(),oldId=randomUUID(),newId=randomUUID();let release,holding;
  const held=new Promise(resolve=>{holding=resolve;});
  await racing.p.route(api+'/api/v1/leaderboard',async route=>{const body=route.request().postDataJSON();if(body?.submissionId===oldId+':five-prisons-rescue-v3'){holding();await new Promise(resolve=>{release=resolve;});}await route.continue();});
  await show(racing.p,oldId);await racing.p.fill('#score-name','Earlier result');await racing.p.click('#submit-score');await held;
  await racing.p.evaluate(()=>window.__QA_SCORE_VIEW__.reset());await show(racing.p,newId);release();
  await racing.p.waitForFunction(({oldId,newId})=>{const old=JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+oldId)),current=JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+newId));return !old?.pending&&current?.pending?.result.runId===newId;},{oldId,newId});
  assert.equal(await racing.p.locator('#submit-score').innerText(),'Submit score');assert.equal(await racing.p.evaluate(()=>window.__QA_SCORE_VIEW__.savedCount()),1);await racing.context.close();report.cases.push('An earlier submission finishing after the displayed run changes cannot clear or relabel the newer saved result');
  const native=await open();await startGame(native.p,{console:false});await native.p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).run?.activeTics>35,{},{timeout:60000});
  await native.p.waitForFunction(()=>{const id=JSON.parse(window.render_game_to_text()).run.runId;return JSON.parse(localStorage.getItem('pdoom.ranked-run.v1:'+id)||'null')?.ticketId;},{},{timeout:15000});
  await native.p.keyboard.press('Escape');await native.p.waitForTimeout(350);const paused=await native.p.evaluate(()=>JSON.parse(window.render_game_to_text()).run.activeTics);await native.p.waitForTimeout(600);assert.equal(await native.p.evaluate(()=>JSON.parse(window.render_game_to_text()).run.activeTics),paused);
  await native.p.keyboard.press('Escape');await native.p.waitForFunction(t=>JSON.parse(window.render_game_to_text()).run.activeTics>t,paused);await native.p.screenshot({path:out+'/native-ticket.png'});await native.context.close();report.cases.push('A real fresh native run obtains its ticket automatically; menu pauses retain the active clock and gameplay resumes');
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);report.state=await active?.evaluate(()=>JSON.parse(window.render_game_to_text?.()||'{}')).catch(()=>null);await active?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,5000))]);}
console.log(JSON.stringify(report,null,2));process.exit(report.passed?0:1);
