// Muted visual tour of the factory: warps the player to fixed viewpoints and
// captures gameplay screenshots for art-direction review (no assertions).
// DOOM_OUT=output/factory/look/before node scripts/factory-look-tour.mjs
// VIEWS_JSON='[["name",x,y,angle],...]' captures ad-hoc viewpoints instead of the list below.
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/factory/look/latest';await fs.mkdir(out,{recursive:true});
const VIEWS=process.env.VIEWS_JSON?JSON.parse(process.env.VIEWS_JSON):[
 ['showroom',1031,1760,180],['showroom-pillars',1300,1700,0],['west-hall',576,1250,90],
 ['north-yard',200,1500,330],['playpen',300,860,315],['production',1056,960,270],
 ['vats-west',820,140,315],['nukage-room',928,-120,270],['stockroom',480,-120,0],
 ['long-hall',1376,300,90],['blue-lab',1700,300,45],['line-room',2240,780,0],
 ['octagon',2300,1700,270],['pillar-hall',3200,1500,0],['loading-yard',3300,120,90],
 ['yard-south',3300,-200,90],['guard-annex',1700,-224,0],['sill',2480,100,180],
 ['stock-drums',250,-60,225],['crates',3000,1600,315],['production-props',1056,1000,0],['garden-bollards',420,1500,180],
 // Puzzle sites: cast and prop art in context.
 ['zvi-pantry',700,1810,90],['meg3n',900,1872,180],['victoria-pen',480,760,270],['max-box',864,1000,270],
 ['robot-signer',912,980,90],['walle-signer',1248,980,90],['paul-guard',1450,-224,0],['paul-console',1500,-352,0],
 ['ajeya-dolls',3264,-150,270],['ajeya-case',3296,-230,270],['break-room',1376,1700,90],
];
const only=process.env.VIEWS?.split(',');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {wait,command,warp}=nativeQA(page);
try{
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory');await startGame(page);
 await wait(s=>s.mode==='playing'&&s.factory,'Factory native boot',60000);
 await command('god');await command('notarget');
 for(const [name,x,y,angle] of VIEWS){
  if(only&&!only.includes(name))continue;
  await warp(x,y,angle);await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/${name}.png`});console.log('captured',name);
 }
 const engine=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/error|warning|unknown texture/i.test(l)).slice(-40));
 await fs.writeFile(`${out}/engine-log.json`,JSON.stringify({errors,engine},null,1));
 console.log(JSON.stringify({errors,engine:engine.slice(-10)}));
}finally{await browser.close();}
