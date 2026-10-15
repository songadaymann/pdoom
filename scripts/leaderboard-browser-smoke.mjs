import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {createLocalLeaderboards} from './local-leaderboards.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/leaderboards/browser',url=process.env.DOOM_URL||'http://127.0.0.1:5198/';
await fs.mkdir(out,{recursive:true});
const store=out+'/fixture-scores.json';await fs.rm(store,{force:true});
const handler=createLocalLeaderboards({store});
const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const api=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],methodology:'Native clock/menu/god tests use the actual engine. Score submission fixtures exercise the real scorecard and shared shell against an isolated loopback API store; they are not claimed as real completed gameplay or public scores. Touch uses Chrome emulation.'};
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
const selected=process.env.DOOM_CASES?.split(',');
async function run(name,options,test){
 if(selected&&!selected.includes(name))return;
 const context=await browser.newContext(options),d={name,passed:false,errors:[],publicWrites:[]};let p;
 try{
  p=await context.newPage();p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});
  p.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith('https://mann.cool/'))d.publicWrites.push(r.url());});
  await p.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...args){super(...args);window.__QA_WORKER__=this;}};});
  await test(p,d);assert.deepEqual(d.publicWrites,[]);assert.deepEqual(d.errors,[]);d.passed=true;
 }catch(error){d.failure=String(error);if(p){d.state=await read(p).catch(()=>null);d.logs=await p.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}}
 finally{report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await context.close();console.log(name+': '+(d.passed?'PASS':d.failure));}
}
async function workerKey(p,code,key,kc){await p.evaluate(({code,key,kc})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode:kc,which:kc,bubbles:true,cancelable:true}});},{code,key,kc});}
async function nativeCommand(p,text){
 await workerKey(p,'Backquote','`',192);await p.waitForTimeout(400);
 await p.evaluate(text=>{for(const key of text){const kc=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:kc,which:kc,charCode:kc,bubbles:true,cancelable:true}});}},text);
 await workerKey(p,'Enter','Enter',13);await p.waitForTimeout(200);await workerKey(p,'Backquote','`',192);await p.waitForTimeout(400);
}
const desktop={viewport:{width:1280,height:800}};
try{
 await run('native-clock-menu-and-cheat-eligibility',desktop,async(p,d)=>{
  await p.goto(url);await startGame(p);await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='error'||s.run?.activeTics>35;},{},{timeout:55000});assert.equal((await read(p)).mode,'playing');
  const initial=await read(p);assert.equal(initial.run.practiceReason,'');assert.ok(initial.run.runId);d.initial=initial;
  const menu=p.locator('mann-cool-game-shell .menu-button');await menu.click();await p.waitForTimeout(500);
  const paused=await read(p);await p.keyboard.press('w');await p.waitForTimeout(800);
  assert.equal((await read(p)).run.activeTics,paused.run.activeTics);assert.equal((await read(p)).world.x,paused.world.x);assert.equal((await read(p)).world.y,paused.world.y);assert.equal((await read(p)).uiBlocked,true);
  d.shellPaused=paused;await p.screenshot({path:`${out}/native-shell-menu.png`});await menu.click();
  await p.waitForFunction(t=>JSON.parse(window.render_game_to_text()).run.activeTics>t,paused.run.activeTics,{timeout:3000});
  await p.keyboard.press('Escape');await p.waitForTimeout(500);const nativePaused=await read(p);await p.waitForTimeout(600);assert.equal((await read(p)).run.activeTics,nativePaused.run.activeTics);
  await menu.click();await p.waitForTimeout(300);await menu.click();await p.waitForTimeout(500);assert.equal((await read(p)).run.activeTics,nativePaused.run.activeTics,'Closing shell keeps already-open native menu paused');
  await p.keyboard.press('Escape');await p.waitForFunction(t=>JSON.parse(window.render_game_to_text()).run.activeTics>t,nativePaused.run.activeTics,{timeout:3000});
  const beforeMove=(await read(p)).world;await p.keyboard.down('w');await p.waitForTimeout(250);await p.keyboard.up('w');await p.waitForTimeout(200);d.resumedMove=(await read(p)).world;assert.ok(Math.hypot(d.resumedMove.x-beforeMove.x,d.resumedMove.y-beforeMove.y)>4,'Normal movement resumes after panels');
  // Bypass only the page console eligibility bridge to prove native cheat detection.
  await nativeCommand(p,'god');await p.waitForFunction(()=>/cheat/.test(JSON.parse(window.render_game_to_text()).run.practiceReason),{},{timeout:3000});
  await nativeCommand(p,'god');assert.match((await read(p)).run.practiceReason,/cheat/);
  d.nativePracticeLogs=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_RUN ')).slice(-3));assert.ok(d.nativePracticeLogs.every(l=>JSON.parse(l.slice(10)).practice===1&&JSON.parse(l.slice(10)).level_version==='five-prisons-v3'));
  await p.locator('#restart').click();await p.waitForFunction(id=>{const s=JSON.parse(window.render_game_to_text());return s.run?.runId!==id&&s.world?.ticks>35;},initial.run.runId,{timeout:55000});
  const restarted=await read(p);assert.equal(restarted.run.practiceReason,'');assert.notEqual(restarted.run.runId,initial.run.runId);assert.equal(restarted.run.result,null);d.restarted=restarted;
 });
 for(const [label,options]of [['desktop',desktop],['portrait',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['landscape',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]){
  await run('score-submit-and-boards-'+label,options,async(p,d)=>{
   let fail=label==='desktop',bodies=[];
   await p.route('**/api/v1/leaderboard*',async route=>{
    const request=route.request();
    if(request.method()==='POST'){
     const body=request.postDataJSON();bodies.push(body);
     if(fail&&body.variant.includes('rescue-v3')){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary outage. Retry this score.'})});return;}
    }
    const upstream=await fetch(api+new URL(request.url()).pathname+new URL(request.url()).search,{method:request.method(),...(request.method()==='POST'?{body:request.postData()}: {})});
    await route.fulfill({status:upstream.status,contentType:'application/json',body:await upstream.text()});
   });
   await p.route('**/dev/score-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="/"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="doom-theme.css"><link rel="stylesheet" href="score.css"><main id="stage"></main>'}));
   await p.goto(new URL('dev/score-fixture.html',url).href);
   await p.evaluate(async label=>{
    const {getLevel}=await import('/levels.js'),{scoreRun}=await import('/run-score.js'),{createScoreView}=await import('/score-view.js'),{connectPlatform}=await import('/platform.js');
    const level=getLevel(),platform=await connectPlatform(level,{block:()=>{}});await platform.shellReady;
    const view=createScoreView({level,config:platform.config,block:()=>{},openBoards:platform.openBoards});
    const result=scoreRun({level_id:level.id,level_version:level.version,score_version:level.scoreVersion,outcome:'escaped',saved:6,total:6,active_tics:21000,p_doom_cover:5,cameras_broken:9,cameras_total:9,practice:0,saved_figures:5,ceo_state:'conscious',skill:3,entry:'cold',retreat:0,routes:['service','breaker','power-shutter','breach','powered-bridge']},level,{runId:`ui-fixture-${label}`});
    view.show(result);window.__QA_SCORE__={view,result};
   },label);
   assert.equal(await p.locator('.score-total').innerText(),'TOTAL 55,200');assert.equal(await p.locator('#next-level').isVisible(),false);
   await p.locator('#score-name').fill('QA '+label);await p.locator('#submit-score').click();
   if(label==='desktop'){
    await p.waitForFunction(()=>document.querySelector('#submit-score').textContent==='Retry submission');assert.equal(await p.locator('#score-name').isDisabled(),true);await p.locator('#submit-score').click();
   }
   await p.waitForFunction(()=>document.querySelector('#submit-score').textContent==='Submitted');
   assert.equal(await p.locator('#submit-score').isDisabled(),true);d.bodies=bodies;
   assert.equal(bodies.filter(b=>b.variant.includes('rescue-v3')).length,label==='desktop'?2:1);
   if(label==='desktop')assert.equal(bodies[0].submissionId,bodies[1].submissionId);
   assert.ok(bodies.every(b=>b.metadata.levelId==='five-prisons'&&b.metadata.levelVersion==='five-prisons-v3'&&b.metadata.boardVersion==='v3'&&/-v3$/.test(b.variant)));
   await p.screenshot({path:`${out}/score-${label}.png`});await p.locator('#view-boards').click();
   const shell=p.locator('mann-cool-game-shell');await shell.locator('.score').first().waitFor();
   d.boards=[];
   for(const variant of ['five-prisons-rescue-v3']){
    await shell.locator(`[data-leaderboard-board="${variant}"]`).click();await p.waitForTimeout(200);await shell.locator('.score').first().waitFor();
    const text=await shell.locator('.scores').innerText();assert.match(text,/QA/);assert.match(text,variant.includes('rescue')?/55,200/:/10:00\.00/);d.boards.push({variant,text});
    await p.screenshot({path:`${out}/board-${label}-${variant}.png`});
   }
   await shell.locator('[data-modal="leaderboard"] .close').click();assert.equal(await shell.locator('[data-modal="leaderboard"]').isVisible(),false);
   // A retryable 503 intentionally produces a console resource error on desktop.
   if(label==='desktop')d.errors=d.errors.filter(e=>/503/.test(e)===false);
  });
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
report.passed=report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
