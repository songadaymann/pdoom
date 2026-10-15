// Visual fixture: the real camp renderer, using committed native completion reports.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='output/campaign-art/camp';await fs.mkdir(out,{recursive:true});
const control=JSON.parse(await fs.readFile('output/campaign-art/roundtrip/report.json'));
const hal=JSON.parse(await fs.readFile('output/campaign-art/hal-exit/report.json'));
assert.equal(control.passed,true);assert.equal(hal.passed,true);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),errors=[],states=[];
try{
for(const [level,x,z,pitch] of [['five-prisons',17,-3,-.12],['hal-station',2.5,-203,-.15]]){
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5198/?ceo=altman');
 await page.evaluate(async ({state,roster,level})=>{
  const {createOutside}=await import('./outside/outside.js');
  document.getElementById('launcher').hidden=true;
  const campaign={saved:5,lost:0,worldPdoom:79,roster:roster.filter(p=>p.levelId===level).map(p=>({...p,state:'camp'}))};
  window.__ART_CAMP__=await createOutside({source:document.getElementById('canvas'),stage:document.getElementById('stage'),audio:new AudioContext(),read:()=>state,campaign:()=>campaign});
  window.__ART_CAMP__.showWin(6);window.__ART_CAMP__.setActive(true,level);
 },{state:hal.final,roster:hal.final.campaign.roster,level});
 await page.waitForFunction(()=>window.__ART_CAMP__?.getState().settled===5,{},{timeout:15000});
 const state=await page.evaluate(()=>window.__ART_CAMP__.getState());
 states.push(state);
  await page.evaluate(({x,z,pitch})=>window.__ART_CAMP__.debug.setView(x,z,0,pitch),{x,z,pitch});await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/${level}-cast.png`});await page.close();
}
 assert.deepEqual(states.flatMap(s=>s.people.map(p=>p.character)),['liron','stuart','eliezer','hinton','holly','rob','dan','nate','roman','beth']);
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify({passed:true,methodology:'Real renderer visual fixtures from passed native exit/round-trip reports, each committed camp reviewed separately.',states,errors},null,2));
}catch(e){await fs.writeFile(out+'/report.json',JSON.stringify({failure:String(e),states,errors},null,2));throw e;}finally{await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
console.log('Both named camp casts rendered.');
