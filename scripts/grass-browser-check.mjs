import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.DOOM_OUT||'output/grass/qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[]};
try{for(const [name,options] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{viewport:{width:844,height:390},hasTouch:true,isMobile:true}]]){
 const context=await browser.newContext(options),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);});
 await p.goto('http://127.0.0.1:5198/dev/grass-preview.html');await p.click('#start');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');await p.waitForTimeout(3500);
 const performance=await p.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now(),start=last;function tick(now){times.push(now-last);last=now;if(now-start<6000)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({frames:times.length,fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95_ms:times[Math.floor(times.length*.95)]});}}requestAnimationFrame(tick);}));
 const before=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));await p.screenshot({path:`${out}/${name}-thick-grass.png`});
 await p.keyboard.down('KeyW');await p.waitForTimeout(1200);await p.keyboard.up('KeyW');const after=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));assert.ok(before.outside.z-after.outside.z>2,'Movement through grass');
 await p.keyboard.down('ArrowRight');await p.waitForTimeout(600);await p.keyboard.up('ArrowRight');await p.screenshot({path:`${out}/${name}-walk-turn.png`});
 await p.keyboard.press('Escape');const paused=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));assert.equal(paused.outside.paused,true);await p.keyboard.down('KeyW');await p.waitForTimeout(300);await p.keyboard.up('KeyW');assert.equal(JSON.parse(await p.evaluate(()=>window.render_game_to_text())).outside.z,paused.outside.z);await p.keyboard.press('Escape');assert.equal(JSON.parse(await p.evaluate(()=>window.render_game_to_text())).outside.paused,false);assert.deepEqual(errors,[]);
 let hill=null;
 if(process.env.DOOM_HILL_WALK==='1'&&name==='desktop'){
  await p.keyboard.down('ArrowLeft');await p.waitForTimeout(600);await p.keyboard.up('ArrowLeft');
  await p.keyboard.down('KeyW');await p.waitForTimeout(12000);await p.keyboard.up('KeyW');await p.waitForTimeout(500);
  hill=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));assert.ok(hill.outside.z<after.outside.z-30,'Walk toward hill through blended grass');await p.screenshot({path:`${out}/desktop-hill-approach.png`});assert.deepEqual(errors,[]);
 }
 report.cases.push({name,performance,before,after,hill,errors,passed:true});await context.close();console.log(name,performance);
}}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
