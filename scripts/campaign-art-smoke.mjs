import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {LEVEL_CAST} from '../doom-web/cast-art.js';
const out='output/campaign-art/native';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
try{
 for(const level of ['five-prisons','hal-station']){
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  const {read,wait,command,warp}=nativeQA(page);
  await page.goto(`http://127.0.0.1:5198/?level=${level}&dev=end&ceo=${level==='hal-station'?'amodei':'altman'}`);
  await startGame(page);await wait(s=>s.mode==='playing'&&s.world?.group_gathered,'Native end fixture',55000);
  await command('god');
  for(const person of (await read()).world.people){
   await warp(person.x,person.y-96,90);await page.waitForTimeout(500);
   await page.screenshot({path:`${out}/${LEVEL_CAST[level][person.id-1]}-native.png`});
  }
  await command('god');await command('kill');
  const seen=new Set();let previous=0;
  for(let step=0;step<5;step++){
   const transferred=await wait(s=>s.world.controlled>0&&s.world.controlled!==previous,'Transfer to nearest surviving prisoner');
   const body=transferred.world.controlled;previous=body;
   const expected=LEVEL_CAST[level][body-1];seen.add(expected);
   await wait(s=>s.statusBar?.drawnFace?.set===expected,'Named HUD face after death hold',12000);
   const state=await read();assert.equal(state.statusBar.faceSet,expected);
   await page.screenshot({path:`${out}/${expected}-takeover.png`});
   report.cases.push({level,body,expected,face:state.statusBar.drawnFace});
   if(step<4)await command('kill');
  }
  assert.deepEqual([...seen].sort(),[...LEVEL_CAST[level]].sort());
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,failure:report.failure}));if(!report.passed)process.exitCode=1;
