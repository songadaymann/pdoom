// Plays each endgame prototype headless and muted with a simple in-page bot, checks that the
// practice and the fight work (Recognizers die, the MCP loses integrity, it falls), and saves
// screenshots to output/endgame-proto/. Run after scripts/build-endgame-protos.mjs, with the
// server up: PDOOM_PORT=5228 node scripts/serve-doom.mjs, then
//   PDOOM_PORT=5228 node prototypes/endgame/shots.mjs [ricochet|tennis|volley ...]
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const port=Number(process.env.PDOOM_PORT)||5228,out='output/endgame-proto';
const modes=process.argv.slice(2).length?process.argv.slice(2):['ricochet','tennis','volley'];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const results={};
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
for(const mode of modes){
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${port}/endgame-proto/play.html?m=${mode}&auto=1&mute=1`);
 await page.waitForFunction(()=>window.__eg?.ready,null,{timeout:60000});
 const state=()=>page.evaluate(()=>window.__eg.state());
 const shot=async(name)=>{await page.screenshot({path:`${out}/${mode}-${name}.png`});};
 // the bot: aims at the nearest Recognizer core, then at the face; throws (or swings) on cue
 await page.evaluate((mode)=>{
  const eg=window.__eg,c=eg.ctx,wrap=a=>{a=(a+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI;};
  window.__bot={on:true,throws:0,swings:0};let prev=null,prevT=performance.now();
  // aim ahead of a moving Recognizer by the disc's flight time
  const lead=(core)=>{const now=performance.now(),dt=Math.max(.016,(now-prevT)/1000),v=prev?core.map((x,i)=>(x-prev[i])/dt):[0,0,0];prev=core;prevT=now;const e=c.player.eyePos(),d=Math.hypot(core[0]-e.x,core[1]-e.y,core[2]-e.z),t=d/34;return core.map((x,i)=>x+v[i]*t);};
  setInterval(()=>{
   if(!window.__bot.on)return;const st=eg.state();
   if(mode==='tennis'){
    const core=eg.recCore();if(st.phase.startsWith('practice')&&core)eg.lookAt(...core);
    else if(st.phase==='fight')eg.lookAt(c.mcp.facePos.x,c.mcp.facePos.y,c.mcp.facePos.z);
    if(st.mode_state?.bolts.some(b=>b.enemy&&b.hot)&&Math.random()<.5){eg.press(0);window.__bot.swings++;}
    return;
   }
   if(st.phase.startsWith('practice')){const core=eg.recCore();if(core){eg.lookAt(...lead(core));if(c.held){eg.press(0);window.__bot.throws++;}}return;}
   if(st.phase!=='fight')return;
   const f=c.mcp.facePos;eg.lookAt(f.x,f.y,f.z);
   const pb=Math.atan2(c.player.pos.z,c.player.pos.x),travel=(Math.hypot(c.player.pos.x,c.player.pos.z)-10)/34;
   if(c.held&&c.mcp.gapCenters().some(g=>Math.abs(wrap(g+c.mcp.spin*travel-pb))<9*Math.PI/180)){eg.press(0);window.__bot.throws++;}
  },16);
 },mode);
 const log={};
 // practice 1: one Recognizer
 await wait(3500);await shot('1-practice');
 for(let i=0;i<40&&(await state()).phase==='practice1';i++)await wait(500);
 log.practice1=(await state()).phase!=='practice1';
 if(!log.practice1)await page.evaluate(()=>window.__eg.skip());
 else{
  // practice 2: two at once; catch one mid-slam or mid-shot for a screenshot
  for(let i=0;i<20;i++){const s=await state();if(s.recs.some(r=>r.state==='telegraph'||r.state==='charge'))break;await wait(250);}
  await shot('2-practice2');
  for(let i=0;i<60&&(await state()).phase==='practice2';i++)await wait(500);
  log.practice2=(await state()).phase!=='practice2';
  if(!log.practice2)await page.evaluate(()=>window.__eg.skip());
 }
 // the wake: the face downloads and speaks
 await page.evaluate(()=>{window.__bot.on=false;window.__eg.place(0,34);window.__eg.lookAt(0,13,0);});
 await wait(2300);await shot('3-wake');
 for(let i=0;i<30&&(await state()).phase!=='fight';i++)await wait(250);
 await page.evaluate(()=>{window.__bot.on=true;});
 const before=(await state()).mcp.integrity;
 // the fight: 25 s of bot play, with a mid-fight shot when something is in the air
 let midShot=false;
 for(let i=0;i<50;i++){
  await wait(500);const s=await state();
  if(!midShot&&i>6&&(s.discs>3||s.mode_state?.bolts?.some(b=>b.enemy&&b.d<22&&b.d>12))){midShot=true;await shot('4-fight');}
  if(s.phase!=='fight')break;
 }
 if(!midShot)await shot('4-fight');
 const after=await state();log.integrity=[before,after.mcp.integrity];log.bot=await page.evaluate(()=>window.__bot);
 log.fightWorks=after.mcp.integrity<before;
 // the end: knock it down to 1 and let the bot finish it
 await page.evaluate(()=>window.__eg.integrity(30));
 for(let i=0;i<40&&(await state()).phase==='fight';i++)await wait(500);
 log.down=(await state()).phase==='down';
 await wait(1200);await shot('5-down');await wait(3000);await shot('6-dialog');
 log.errors=errors;log.final=await state();delete log.final.recs;
 results[mode]=log;
 console.log(mode,JSON.stringify({practice1:log.practice1,practice2:log.practice2,integrity:log.integrity,fightWorks:log.fightWorks,down:log.down,bot:log.bot,errors:errors.slice(0,5)}));
 await page.close();
}
await browser.close();
const failed=Object.entries(results).filter(([,l])=>!l.practice1||!l.fightWorks||!l.down||l.errors.length);
console.log(failed.length?`FAILED: ${failed.map(([m])=>m).join(', ')}`:'ALL OK');
process.exitCode=failed.length?1:0;
