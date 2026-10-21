// MEG3N's live feeds (2026-10-20), muted: the factory has levels 1-2's Doom status bar with
// SCRN (her 20 screens) in place of CAMS; the first screen you look at says what it is;
// the wrench and the slingshot each smash one (SCRN counts up, the feed goes dark, she comes
// to look); then a capture in front of every screen for placement review.
// node scripts/factory-screens-smoke.mjs   (TOUR=0 skips the per-screen captures)
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/screens';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={cases:[],errors:[],screens:[]};const record=text=>{report.cases.push(text);console.log(text);};
async function open(url){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto(url);await startGame(page);
 return {page,...nativeQA(page)};
}
// Stand `back` units in front of a screen, facing it.
const before=([x,y,angle],back)=>[Math.round(x+Math.cos(angle*Math.PI/180)*back),Math.round(y+Math.sin(angle*Math.PI/180)*back),(angle+180)%360];
try{
 // 1. A cold start: the bar, SCRN 0/20, and the first screen in view names itself.
 let t=await open('http://127.0.0.1:5198/?level=meg3n-factory');
 let s=await t.wait(s=>s.mode==='playing'&&s.factory&&s.world?.screens_total>0,'Factory boot',90000);
 assert.equal(s.world.screens_total,20,'Twenty screens');assert.equal(s.world.screens,0);
 assert.equal(s.factory.screens.length,20,'Every screen reported');
 s=await t.wait(s=>s.statusBar?.ready&&s.statusBar.bar==='PDFBAR','Status bar ready',20000);
 assert.deepEqual(s.statusBar.values.tallies[0],[0,20],'SCRN 0/20');
 const visible=await t.page.evaluate(()=>{const c=document.querySelector('#hud .doom-statusbar canvas');const r=c?.getBoundingClientRect();return !!c&&!c.closest('[hidden]')&&r.width>600&&r.height>40;});
 assert.ok(visible,'The status bar is drawn across the view');
 await t.page.screenshot({path:`${out}/1-start.png`});
 // It hangs left of the door ahead, at the edge of the opening view: turn toward it.
 await t.face(205);
 s=await t.wait(s=>/live feed/i.test(s.world.message||''),'The first screen names itself',15000);
 await t.page.screenshot({path:`${out}/1-start-notice.png`});
 record(`Cold start: status bar ${s.statusBar.bar}, SCRN 0/20, "${s.world.message}"`);
 await t.page.close();

 // 2. With both tools (?puzzle=zvi): the wrench smashes the start screen, the slingshot another.
 t=await open('http://127.0.0.1:5198/?level=meg3n-factory&puzzle=zvi');
 s=await t.wait(s=>s.mode==='playing'&&s.factory&&s.world?.wrench&&s.world.gun,'Tools',90000);
 await t.command('god');
 const feeds=s.factory.screens;
 const first=feeds.findIndex(([x,y])=>Math.hypot(x-938,y-1680)<40);assert.ok(first>=0,'The start screen');
 let [x,y,a]=before(feeds[first],56);await t.warp(x,y,a);
 if((await t.read()).world.tool!==0)await t.press('KeyT');
 await t.wait(s=>s.world.tool===0,'Wrench in hand');
 await t.hold('ControlLeft',120);
 s=await t.wait(s=>s.world.screens===1&&s.factory.screens[first][3]===1,'The wrench smashes the start screen',6000);
 await t.page.waitForTimeout(400);await t.page.screenshot({path:`${out}/2-wrench.png`});
 assert.deepEqual(s.statusBar.values.tallies[0],[1,20],'SCRN 1/20');
 s=await t.wait(s=>s.dialogue?.speaker==='MEG3N'&&/watching that/.test(s.dialogue.text),'MEG3N notices',8000);
 // Her recorded take (2026-10-21), not just the subtitle.
 s=await t.wait(s=>s.voiceOver?.played?.includes('megan-screen-first'),'Her take plays',8000);
 record(`Wrench: start screen smashed, SCRN 1/20, MEG3N: "${s.dialogue.text}" (take megan-screen-first)`);
 // The slingshot, from across the room.
 const second=feeds.findIndex(([x,y])=>Math.hypot(x-1730,y-2032)<40);assert.ok(second>=0,'The north room screen');
 [x,y,a]=before(feeds[second],160);await t.warp(x,y,a);
 await t.press('KeyT');await t.wait(s=>s.world.tool===1,'Slingshot in hand');
 await t.hold('ControlLeft',700);
 s=await t.wait(s=>s.world.screens===2&&s.factory.screens[second][3]===1,'The slingshot smashes a screen',6000);
 await t.page.waitForTimeout(400);await t.page.screenshot({path:`${out}/3-sling.png`});
 record(`Slingshot: north-room screen smashed from 160 units, SCRN ${s.world.screens}/20, MEG3N mode ${s.factory.guardian_mode}`);

 // 3. One capture in front of each screen (placement review).
 if(process.env.TOUR!=='0'){
  await t.command('notarget');
  for(const [i,feed] of feeds.entries()){
   const [x,y,a]=before(feed,72);
   try{await t.warp(x,y,a);await t.page.waitForTimeout(450);await t.page.screenshot({path:`${out}/screen-${String(i).padStart(2,'0')}.png`});report.screens.push({i,at:feed,view:[x,y,a]});}
   catch(e){report.screens.push({i,at:feed,view:[x,y,a],failed:String(e.message).slice(0,160)});console.warn('screen',i,'capture failed');}
  }
  record(`Toured ${report.screens.filter(s=>!s.failed).length}/20 screens`);
 }
 await t.page.close();
 report.passed=report.errors.length===0;
}catch(error){report.passed=false;report.failure=String(error.stack||error);console.error(report.failure);}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));await browser.close();}
process.exit(report.passed?0:1);
