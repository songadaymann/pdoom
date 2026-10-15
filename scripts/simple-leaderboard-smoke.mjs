import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.DOOM_URL||'http://127.0.0.1:5203/',out=process.env.DOOM_OUT||'output/leaderboard-simple/ui',fixtures=process.env.LEADERBOARD_FIXTURES==='1';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={url:base,fixtureReads:fixtures,cases:[],errors:[],scoreWrites:[]};let current;
try{
 for(const [name,width,height,touch]of [['desktop',1280,800,false],['phone',390,844,true],['tablet',820,1180,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),p=await context.newPage();current=p;
  p.on('pageerror',error=>report.errors.push(String(error)));
  p.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.includes('leaderboard'))report.scoreWrites.push(r.url());});
  // Only sample reads are mocked; this test never creates public scores.
  if(fixtures)await p.route('**/api/v1/leaderboard?*',async route=>{
   assert.equal(route.request().method(),'GET');const variant=new URL(route.request().url()).searchParams.get('variant'),first=variant==='five-prisons-rescue-v3';
   const entries=(first?[[1,'Alex',55200],[2,'Casey',54100],[3,'A player with a long name',48900]]:[[1,'Morgan',55900],[2,'Riley',52350]]).map(([rank,name,score])=>({rank,name,score,metadata:{activeMs:600000,saved:6,camerasDestroyed:9}}));
   await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,entries})});
  });
  await context.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'amodei',hub:true,saved0:3,saved1:0,lost0:0,lost1:0,following0:0,following1:0})));
  await p.goto(base);await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-load');
  await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.outside?.active&&!s.uiBlocked&&document.querySelector('#stage').classList.contains('has-game-shell');},{},{timeout:90000});
  const shell=p.locator('mann-cool-game-shell');await shell.locator('.menu-button').click();await shell.locator('[data-open="leaderboard"]').click();
  const tabs=shell.locator('[data-leaderboard-board]');assert.deepEqual(await tabs.allTextContents(),['Level 1','Level 2']);
  assert.equal(await shell.locator('.leaderboard-metric').isVisible(),false);assert.equal(await shell.locator('[data-modal="leaderboard"] .kicker').isVisible(),false);
  for(let i=0;i<2;i++){
   const tab=tabs.nth(i);if(i){if(!touch){await tab.focus();await p.keyboard.press('Enter');}else await tab.click();}
   await p.waitForFunction(()=>!document.querySelector('mann-cool-game-shell').shadowRoot.querySelector('.scores').textContent.includes('Loading'));
   assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');assert.equal(await tabs.nth(i).evaluate(e=>getComputedStyle(e).color),'rgb(16, 12, 9)');assert.equal(await tabs.nth(1-i).getAttribute('aria-selected'),'false');
   if(fixtures){
    const rows=shell.locator('.score');assert.equal(await rows.count(),i?2:3);
    for(const row of await rows.all())assert.equal(await row.locator(':scope > *').count(),3);
    assert.deepEqual(await rows.first().locator(':scope > *').allTextContents(),i?['1','Morgan','55,900']:['1','Alex','55,200']);
   }
   if(!fixtures){
    const variant=await tab.getAttribute('data-leaderboard-board'),response=await p.request.get(new URL('/api/v1/leaderboard?slug=pdoom&variant='+variant+'&limit=25',base).href);assert.equal(response.status(),200);
    const data=await response.json();assert.equal(data.success,true);assert.equal(data.board.label,'Level '+(i+1));assert.equal(data.direction,'desc');assert.equal(await shell.locator('.score').count(),data.entries.length);
    for(const row of await shell.locator('.score').all())assert.equal(await row.locator(':scope > *').count(),3);
   }
   const panel=await shell.locator('[data-modal="leaderboard"] .panel').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width+1&&panel.y>=0&&panel.y+panel.height<=height+1);
   assert.equal(await shell.locator('[data-modal="leaderboard"] .panel').evaluate(e=>e.scrollWidth>e.clientWidth),false);
   const a=await tabs.nth(0).boundingBox(),b=await tabs.nth(1).boundingBox();assert.equal(a.y,b.y);assert.ok(Math.abs(a.width-b.width)<2);assert.ok(a.height>=44);
   await p.screenshot({path:`${out}/${name}-level-${i+1}.png`});
  }
  await shell.locator('[data-modal="leaderboard"] .close').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.paused===false);
  report.cases.push(`${name}: two level tabs, total score, rank/name/score rows, no scoring explanation, keyboard/touch switch, panel fits and gameplay resumes`);await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.scoreWrites,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);await current?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify(report,null,2));process.exit(report.passed?0:1);
