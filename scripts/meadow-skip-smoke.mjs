// The meadow's two guided walks can be skipped (2026-11-09). Jonathan: "we need a skip at the beginning, post
// prolouge, when we first enter the windows xp land ... and ... when we come out of the 4th level and are met again
// by the other founder". Both always could be, with SPACE, but the button sat off the top of the window.
// Headless and muted, on the loopback server:
// 1. New Game -> founder film (skip) -> prologue (skip) -> the XP intro: SPACE — SKIP WALK sits on screen at the
//    bottom right from the start, and SPACE lands you both at CONTROL.EXE's door.
// 2. After level 4 (?safemode=1&after=4, dev-config on): SPACE — SKIP shows for the other founder's meeting at the
//    door, and a click on it skips him: the floppy is yours, everyone follows, the south edge is open.
// 3. The same on a touch phone: TAP — SKIP, and a tap skips him.
// node scripts/meadow-skip-smoke.mjs   (DOOM_URL; CASES=intro,door,phone to limit. Only intro runs on mann.cool,
// where the ?safemode fixture is off)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',out=process.env.DOOM_OUT||'output/meadow-skip';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--autoplay-policy=no-user-gesture-required']}),report={cases:[],errors:[]};
const only=process.env.CASES?.split(',');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const record=text=>{report.cases.push(text);console.log(text);};
let active;
async function open(options={viewport:{width:1280,height:800}}){
 const context=await browser.newContext(options),p=await context.newPage();active=p;
 p.on('pageerror',e=>report.errors.push(String(e)));
 await p.addInitScript(()=>{if(sessionStorage.getItem('qa-seeded'))return;sessionStorage.setItem('qa-seeded','1');localStorage.clear();});
 const read=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const wait=async(test,label,timeout=60000)=>{const end=Date.now()+timeout;let s;while(Date.now()<end){s=await read().catch(()=>null);if(s&&test(s))return s;await sleep(200);}throw Error(`${label}: ${JSON.stringify(s?.outside?.guide??s?.mode)}`);};
 // the button: on screen, inside the window
 const button=async()=>p.evaluate(()=>{const b=document.getElementById('guide-skip');if(!b||b.hidden)return null;const r=b.getBoundingClientRect();return {text:b.textContent,x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});
 const onScreen=b=>b&&b.w>0&&b.x>=0&&b.y>=0&&b.x+b.w<=b.vw&&b.y+b.h<=b.vh;
 return {context,p,read,wait,button,onScreen};
}
try{
 // 1. the XP intro
 if(!only||only.includes('intro')){const {context,p,wait,button,onScreen}=await open();
  await p.goto(`${base}?ceo=altman`);await p.waitForFunction(()=>window.render_game_to_text);
  await p.click('#title-enter');await p.click('#menu-new');await p.click('#hero-next');
  await p.waitForSelector('#intro-video video');await p.waitForFunction(()=>document.querySelector('#intro-video video')?.currentTime>.3);await p.click('.iv-skip');
  await wait(s=>s.prologue?.phase==='battle','the prologue');await p.click('.war-skip');
  let s=await wait(s=>s.outside?.intro&&s.outside.guide&&!s.uiBlocked,'the XP intro');
  const b=await button();assert.ok(onScreen(b),`SPACE — SKIP WALK is on screen: ${JSON.stringify(b)}`);assert.equal(b.text,'SPACE — SKIP WALK');
  assert.ok(b.x+b.w>b.vw*.7&&b.y>b.vh*.7,'at the bottom right');
  await p.screenshot({path:`${out}/1-intro.png`});
  const walked=s.outside.guide.walked;await sleep(600);
  await p.keyboard.press('Space');
  s=await wait(s=>s.outside.guide?.ready&&s.outside.guide.phase==='arrived','SPACE skips the walk',5000);
  assert.equal(await button(),null,'the button goes once the walk is skipped');
  assert.ok(Math.hypot(s.outside.x-17,s.outside.z+12)<1.5,`in front of CONTROL.EXE (${s.outside.x}, ${s.outside.z})`);
  await p.screenshot({path:`${out}/1-intro-skipped.png`});
  record(`XP intro: SPACE — SKIP WALK on screen at the bottom right from the start (guide ${walked} m along); SPACE lands you both in front of CONTROL.EXE`);
  await context.close();}

 // 2. the meeting at the door after level 4
 if(!only||only.includes('door')){const {context,p,wait,button,onScreen}=await open();
  await p.goto(`${base}?safemode=1&after=4`);
  let s=await wait(s=>s.outside?.endgame?.state==='door'&&s.outside.guide?.scene==='endgame','the other founder meets you',120000);
  const b=await button();assert.ok(onScreen(b),`SPACE — SKIP is on screen: ${JSON.stringify(b)}`);assert.equal(b.text,'SPACE — SKIP');
  await p.screenshot({path:`${out}/2-door.png`});
  await p.click('#guide-skip');
  s=await wait(s=>s.outside.guide?.ready&&s.outside.endgame.gateOpen&&s.outside.endgame.following,'a click skips him',5000);
  assert.equal(await button(),null);
  await p.screenshot({path:`${out}/2-door-skipped.png`});
  record('After level 4: SPACE — SKIP on screen for the meeting at the door; a click skips it (floppy handed over, everyone following, the gate open)');
  await context.close();}

 // 3. a touch phone
 if(!only||only.includes('phone')){const {context,p,wait,button,onScreen}=await open({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  await p.goto(`${base}?safemode=1&after=4`);
  await wait(s=>s.outside?.endgame?.state==='door'&&s.outside.guide?.scene==='endgame','the other founder meets you',120000);
  // clear of the touch controls, in landscape and in portrait
  const clear=()=>p.evaluate(()=>{const s=document.getElementById('guide-skip').getBoundingClientRect();return [...document.querySelectorAll('#touch button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).every(r=>r.right<=s.left||r.left>=s.right||r.bottom<=s.top||r.top>=s.bottom);});
  let b=await button();assert.ok(onScreen(b),`on screen: ${JSON.stringify(b)}`);assert.equal(b.text,'TAP — SKIP');assert.ok(await clear(),'clear of the touch controls (landscape)');
  await p.screenshot({path:`${out}/3-phone.png`});
  await p.setViewportSize({width:390,height:844});await sleep(500);
  b=await button();assert.ok(onScreen(b),`on screen in portrait: ${JSON.stringify(b)}`);assert.ok(await clear(),'clear of the touch controls (portrait)');
  await p.screenshot({path:`${out}/3-phone-portrait.png`});
  await p.tap('#guide-skip');
  await wait(s=>s.outside.guide?.ready&&s.outside.endgame.gateOpen,'a tap skips him',5000);
  record('Touch phone: TAP — SKIP on screen and clear of the touch controls in landscape and portrait, and a tap skips the meeting');
  await context.close();}
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error);await active?.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}
console.log(JSON.stringify({passed:!!report.passed,cases:report.cases,failure:report.failure?.slice(0,1500),errors:report.errors.slice(0,5)},null,1));process.exit(report.passed?0:1);
