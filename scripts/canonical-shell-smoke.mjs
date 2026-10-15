import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',args:['--mute-audio']}),out='output/playtest/canonical-shell',report={cases:[],errors:[]};await fs.mkdir(out,{recursive:true});
try{
 for(const [name,width,height,touch] of [['desktop',1280,800,false],['phone',390,844,true],['tablet',820,1180,true]]){
 const ctx=await b.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),p=await ctx.newPage();let plays=0;
 p.on('pageerror',e=>report.errors.push(String(e)));p.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/v1/plays'))plays++;});
 await ctx.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'amodei',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0})));
 await p.goto('https://mann.cool/pdoom/');await p.waitForFunction(()=>window.render_game_to_text);await p.click('#title-enter');await p.click('#menu-load');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.saved_visual===10,{},{timeout:90000});
 await p.waitForFunction(()=>document.querySelector('#stage').classList.contains('has-game-shell'));
 const shell=p.locator('mann-cool-game-shell');assert.equal(await shell.count(),1);assert.equal(await shell.locator('.home').getAttribute('href'),'https://mann.cool/');
 await shell.locator('[data-tip]').waitFor({state:'visible'});assert.equal(await shell.locator('[data-tip]').getAttribute('href'),'https://mann.cool/tip?from=pdoom');
 const restart=await p.locator('#restart').boundingBox(),tip=await shell.locator('[data-tip]').boundingBox();assert.ok(restart.x+restart.width<=tip.x||restart.y>=tip.y+tip.height||restart.y+restart.height<=tip.y,'restart clear of tip');
 await p.screenshot({path:`${out}/${name}-meadow.png`});
 await shell.locator('.menu-button').click();assert.equal(await shell.locator('[data-patreon]').getAttribute('href'),'http://songaday.studio');
 assert.equal(await shell.getByText('Guestbook ↗',{exact:true}).getAttribute('href'),'https://mann.cool/?guestbook=1');
 await shell.locator('[data-open="leaderboard"]').click();const tabs=shell.locator('[data-leaderboard-board]');assert.equal(await tabs.count(),2);
 for(let i=0;i<2;i++){
 const tab=tabs.nth(i),variant=await tab.getAttribute('data-leaderboard-board');
 if(i)await tab.click();await p.waitForFunction(()=>{const r=document.querySelector('mann-cool-game-shell').shadowRoot;return !r.querySelector('.scores').textContent.includes('Loading');});
 assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');
 const result=await p.request.get(`https://mann.cool/api/v1/leaderboard?slug=pdoom&variant=${variant}`);assert.equal(result.status(),200,variant);assert.equal((await result.json()).success,true,variant);
 }
 await p.screenshot({path:`${out}/${name}-boards.png`});
 const panel=await shell.locator('[data-modal="leaderboard"] .panel').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width+1&&panel.y>=0&&panel.y+panel.height<=height+1);
 const bg=await shell.locator('[data-modal="leaderboard"] .panel').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(bg,'rgb(36, 28, 23)');
 await shell.locator('[data-modal="leaderboard"] .close').click();await shell.locator('.menu-button').click();await shell.locator('[data-open="player"]').click();await shell.locator('[data-player-step="email"] input').waitFor({state:'visible'});
 await shell.locator('[data-modal="player"] .close').click();
 if(!touch){await p.keyboard.press('f');await p.waitForFunction(()=>!!document.fullscreenElement);await p.keyboard.press('f');await p.waitForFunction(()=>!document.fullscreenElement);await p.keyboard.press('Tab');}
 assert.equal(plays,1,'one automatic play');report.cases.push(`${name}: themed shell, HUD clearance, Tip, Patreon, guestbook link, 2 total-score level tabs, player panel, single play`);await ctx.close();
 }
 const ctx=await b.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage();
 await p.goto('https://mann.cool/?guestbook=1');await p.getByRole('dialog',{name:'Guestbook'}).waitFor();await p.waitForFunction(()=>!document.querySelector('.guestbook-entries')?.textContent.includes('Loading'));
 assert.ok(!(await p.locator('.guestbook-error').count())||!(await p.locator('.guestbook-error').isVisible()));await p.getByRole('button',{name:'Close guestbook'}).click();
 const card=p.locator('.latest-spotlight');assert.equal(await card.locator('.latest-spotlight-copy-link').getAttribute('href'),'/pdoom/');
 await card.locator('.latest-spotlight-art').hover();await p.waitForFunction(()=>document.querySelector('.latest-spotlight-art img')?.getAttribute('src')==='/game-gifs/pdoom.gif');await p.mouse.move(0,0);
 await p.emulateMedia({reducedMotion:'reduce'});await card.locator('.latest-spotlight-art').hover();assert.equal(await card.locator('img').getAttribute('src'),'/covers/pdoom.png');
 await p.screenshot({path:out+'/catalog.png'});assert.ok(await p.locator('a[href="https://github.com/songadaymann/pdoom"]').count());report.cases.push('catalog cartridge, source link, trailer hover, reduced motion, live guestbook reads');await ctx.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);process.exit(report.passed?0:1);
