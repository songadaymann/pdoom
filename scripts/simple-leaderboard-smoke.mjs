// The shared shell's leaderboard from SAFE MODE: one tab per level board, rank/name/score rows,
// no scoring explanation, keyboard/mouse/touch tab switching, a panel that fits, and gameplay that
// resumes on close. It never submits a score.
// Runs against the local game server (node scripts/serve-doom.mjs, launch config p-doom-mod), which
// serves the dev shell and the loopback review API (scripts/local-leaderboards.mjs):
//   npm run test:doom:leaderboard-simple                         sample rows (fixtures are the default on loopback)
//   LEADERBOARD_FIXTURES=0 npm run test:doom:leaderboard-simple  rows from the local review store
//   DOOM_URL=https://mann.cool/pdoom/ npm run test:doom:leaderboard-simple   read-only check of the live boards
// Screenshots and report.json go to output/leaderboard-simple/ui/ (DOOM_OUT to change).
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',out=process.env.DOOM_OUT||'output/leaderboard-simple/ui';
const loopback=['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),fixtures=(process.env.LEADERBOARD_FIXTURES??(loopback?'1':'0'))==='1';
// One board per scored level (doom-web/levels.js boardsForLevel), in campaign order.
const BOARDS=[
 {variant:'five-prisons-rescue-v3',label:'Level 1',rows:[[1,'Alex',55200],[2,'Casey',54100],[3,'A player with a long name',48900]],cameras:9},
 {variant:'hal-station-rescue-v3',label:'Level 2',rows:[[1,'Morgan',55900],[2,'Riley',52350]],cameras:9},
 {variant:'meg3n-factory-rescue-v1',label:'Level 3',rows:[[1,'Jordan',61850],[2,'Sam',60400],[3,'Taylor',59020],[4,'Quinn',41000]],cameras:20}
];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={url:base,fixtureReads:fixtures,boards:BOARDS.map(b=>b.variant),cases:[],errors:[],scoreWrites:[]};let current;
try{
 for(const [name,width,height,touch]of [['desktop',1280,800,false],['phone',390,844,true],['tablet',820,1180,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),p=await context.newPage();current=p;
  p.on('pageerror',error=>report.errors.push(String(error)));
  p.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.includes('leaderboard'))report.scoreWrites.push(r.url());});
  // Only sample reads are mocked; this test never creates public scores.
  if(fixtures)await p.route('**/api/v1/leaderboard?*',async route=>{
   const request=route.request(),variant=new URL(request.url()).searchParams.get('variant'),board=BOARDS.find(b=>b.variant===variant);
   if(request.method()!=='GET'||!board){report.errors.push(`Unexpected leaderboard ${request.method()} for ${variant}`);await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Unknown game or leaderboard variant.'})});return;}
   const entries=board.rows.map(([rank,name,score])=>({rank,name,score,metadata:{activeMs:600000,saved:6,camerasDestroyed:board.cameras}}));
   await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,entries})});
  });
  await context.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'amodei',hub:true,saved0:3,saved1:0,lost0:0,lost1:0,following0:0,following1:0})));
  await p.goto(base);await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-load');
  await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.outside?.active&&!s.uiBlocked&&document.querySelector('#stage').classList.contains('has-game-shell');},{},{timeout:90000});
  const shell=p.locator('mann-cool-game-shell');await shell.locator('.menu-button').click();await shell.locator('[data-open="leaderboard"]').click();
  const tabs=shell.locator('[data-leaderboard-board]');assert.deepEqual(await tabs.allTextContents(),BOARDS.map(b=>b.label));
  assert.deepEqual(await tabs.evaluateAll(t=>t.map(e=>e.dataset.leaderboardBoard)),BOARDS.map(b=>b.variant),'One tab per level board');
  assert.equal(await shell.locator('.leaderboard-metric').isVisible(),false);assert.equal(await shell.locator('[data-modal="leaderboard"] .kicker').isVisible(),false);
  for(let i=0;i<BOARDS.length;i++){
   // Desktop switches by keyboard, then by mouse; phone and tablet by touch.
   const tab=tabs.nth(i),board=BOARDS[i];if(i){if(touch)await tab.tap();else if(i===1){await tab.focus();await p.keyboard.press('Enter');}else await tab.click();}
   await p.waitForFunction(()=>!document.querySelector('mann-cool-game-shell').shadowRoot.querySelector('.scores').textContent.includes('Loading'));
   for(let j=0;j<BOARDS.length;j++)assert.equal(await tabs.nth(j).getAttribute('aria-selected'),String(i===j),`${board.label} is the only selected tab`);
   assert.equal(await tab.evaluate(e=>getComputedStyle(e).color),'rgb(16, 12, 9)');
   const rows=shell.locator('.score');
   if(fixtures){
    assert.equal(await rows.count(),board.rows.length,board.label+' rows');
    for(const row of await rows.all())assert.equal(await row.locator(':scope > *').count(),3);
    const [rank,player,score]=board.rows[0];assert.deepEqual(await rows.first().locator(':scope > *').allTextContents(),[String(rank),player,score.toLocaleString('en-US')]);
   }else{
    const response=await p.request.get(new URL('/api/v1/leaderboard?slug=pdoom&variant='+board.variant+'&limit=25',base).href);assert.equal(response.status(),200,board.variant);
    const data=await response.json();assert.equal(data.success,true);assert.equal(data.variant,board.variant);assert.equal(data.board.variant,board.variant);assert.equal(data.direction,'desc');
    // The mann.cool catalog names its boards by level; the loopback and playtest APIs keep levels.js's own label.
    assert.equal(data.board.label,data.local||data.playtest?'Total score':board.label);
    assert.equal(await rows.count(),data.entries.length);for(const row of await rows.all())assert.equal(await row.locator(':scope > *').count(),3);
   }
   const panel=await shell.locator('[data-modal="leaderboard"] .panel').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width+1&&panel.y>=0&&panel.y+panel.height<=height+1,'Panel fits the viewport');
   assert.equal(await shell.locator('[data-modal="leaderboard"] .panel').evaluate(e=>e.scrollWidth>e.clientWidth),false);
   // Every level's tab on one row, left to right, all the same size (doom-web/platform.js layout bridge).
   const boxes=[];for(let j=0;j<BOARDS.length;j++)boxes.push(await tabs.nth(j).boundingBox());
   for(const [j,b] of boxes.entries()){
    assert.equal(b.y,boxes[0].y,'Tabs share one row');assert.ok(Math.abs(b.width-boxes[0].width)<2&&Math.abs(b.height-boxes[0].height)<2,'Tabs the same size');assert.ok(b.height>=44,'Tab touch target');
    assert.ok(b.x>=panel.x&&b.x+b.width<=panel.x+panel.width+1,'Tab inside the panel');if(j)assert.ok(b.x>=boxes[j-1].x+boxes[j-1].width-1,'Tabs in level order');
    assert.equal(await tabs.nth(j).evaluate(e=>e.scrollWidth<=e.clientWidth),true,'Tab label fits its tab');
   }
   await p.screenshot({path:`${out}/${name}-level-${i+1}.png`});
  }
  await shell.locator('[data-modal="leaderboard"] .close').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.paused===false);
  report.cases.push(`${name}: ${BOARDS.length} level tabs, total score, rank/name/score rows, no scoring explanation, ${touch?'touch':'keyboard/mouse'} switch, panel fits and gameplay resumes`);await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.scoreWrites,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);await current?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify(report,null,2));process.exit(report.passed?0:1);
