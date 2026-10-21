// Verify the installed sprite families and capture them in the actual factory.
import {chromium} from '@playwright/test';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
import {overPaint,besideBox} from './factory-production-qa.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const out=process.env.DOOM_OUT||'output/factory/cast';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const report={cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
const {read,wait,command,warp,press,hold,face}=nativeQA(page);
const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});report.cases.push(name);};
try{
 const manifest=JSON.parse(await fs.readFile('art/factory-cast-v1/import-manifest.json','utf8'));
 const cast=manifest.filter(c=>c.id!=='megan-watched'),watched=manifest.find(c=>c.id==='megan-watched');
 assert.equal(cast.length,8);assert.equal(cast.reduce((n,c)=>n+c.frames.length,0),216);if(watched)assert.equal(watched.frames.length,8);// MEG3N's front-view watched poses
 for(const c of manifest)for(const f of c.frames){assert.ok((await fs.stat(`doom-mod/sprites/${f.name}.png`)).size>100);}
 report.pack=manifest.map(c=>({id:c.id,frames:c.frames.length,sourceSha256:c.source_sha256}));
 await page.goto('http://127.0.0.1:5198/?level=meg3n-factory');await startGame(page);
 await wait(s=>s.mode==='playing'&&s.factory,'Factory cast boot',60000);
 await command('god');await command('notarget');
 await warp(1031,1690,90);await wait(s=>s.world.wrench,'Wrench');
 for(const [name,x,y,angle] of [['zvi',680,1880,90],['paul',1856,-224,180],['ajeya',3296,-408,90]]){
  await warp(x,y,angle);await shot(name);
 }
 await warp(576,780,90);await hold('KeyW',600);await wait(s=>s.world.gun===1,'Slingshot');
 await warp(480,800,270);await hold('ControlLeft',400);await hold('ControlLeft',400);await wait(s=>s.world.people[1].released,'Victoria released');await press('KeyT');await wait(s=>s.world.people[1].y>720,'Victoria walks through fabric opening');await shot('victoria');
 await warp(912,1000,90);await shot('robby-idle');await press('Space');
 await wait(s=>s.factory.signatures===1,'Robby signature');await shot('robby-signs');
 await warp(1248,1000,90);await shot('walle-idle');await press('Space');
 await wait(s=>s.factory.signatures===2,'WALL-E signature');await shot('walle-signs');
 await warp(800,960,270);await press('Space');await wait(s=>s.factory.line_paused,'Pause shipping line');
 const box=(await wait(s=>s.factory.box_stopped,'Shipping box stops',10000)).factory;const stand=besideBox(box.box_x,box.box_y);await warp(stand.x,stand.y,stand.angle);await press('Space');
 await wait(s=>s.world.people[2].released,'Max released');const max=(await read()).world.people[2];assert.ok(!overPaint(max.x,max.y,10),'Max steps out on dry floor');await warp(max.x,max.y-112,90);await shot('max');
 await warp(700,1904,270);await press('Space');await wait(s=>s.factory.dance_ticks>0,'MEG3N dances',25000);
 await warp(800,1936,200);await shot('megan-dance');await page.waitForTimeout(180);await shot('megan-dance-beat');
 await wait(s=>!s.factory.music,'Dance finishes',10000);
 await warp(784,1904,180);await press('ControlLeft');await shot('megan-stunned');
 await warp(700,1872,90);await press('Space');await wait(s=>s.factory.key,'Pantry key');
 await warp(680,1904,90);await press('Space');await wait(s=>s.world.people[0].released,'Zvi released');
 await warp(1376,1750,90);await wait(s=>s.world.sheltered>=3,'Released cast reaches break room',100000);await warp(1344,1648,90);await shot('prisoners-walking');
 assert.deepEqual(report.errors,[]);
 report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown texture|has no frames/.test(l)));
 assert.deepEqual(report.logs,[]);report.passed=true;report.final=await read();
 report.pk3Sha256=crypto.createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex');
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot('failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
