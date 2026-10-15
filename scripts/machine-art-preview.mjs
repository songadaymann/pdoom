import {chromium} from '@playwright/test';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.DOOM_OUT||'output/campaign-art/machines';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
try{
for(const level of process.env.ART_SCENES==='frost'?['hal-station']:['hal-station','five-prisons']){
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 const {read,wait,command,warp,hold}=nativeQA(page);await page.goto(`http://127.0.0.1:5198/?level=${level}&ceo=altman`);await startGame(page);await wait(s=>s.mode==='playing','Native boot',55000);await command('god');
 if(process.env.ART_SCENES==='frost'){
  await warp(1504,-2440,90);await command('centerview');await hold('PageUp',580);await page.screenshot({path:out+'/frost-window.png'});report.cases.push('Frost window rendered in native bay');await page.close();continue;
 }
 if(level==='hal-station')for(const [name,x,y,angle] of [['teabot-stop',-432,-164,90],['rack',-1700,240,90],['exam',-1488,24,90],['flash',1278,-600,90],['valve',-1424,-2624,90],['memory',32,-804,90]]){
  await warp(x,y,angle);await command('centerview');await page.screenshot({path:`${out}/${name}.png`});report.cases.push(name);
 }
 const w=(await read()).world;await warp(w.hunter_x,w.hunter_y-100,90);await command('centerview');await page.waitForTimeout(400);await page.screenshot({path:`${out}/${level}-hunter.png`});report.cases.push(level+' hunter');await page.close();
}
assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
