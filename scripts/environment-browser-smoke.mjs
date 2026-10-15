import {chromium} from 'playwright';
import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='output/inhabited-levels/native';await fs.mkdir(out,{recursive:true});
const report={cases:[],errors:[],pack:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex')};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});let page;
try{
 for(const [level,mapDir]of [['five-prisons','checkpoint'],['hal-station','hal']]){
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(()=>{const W=Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await page.route('**/pdoom.pk3',r=>r.fulfill({path:'output/inhabited-levels/qa.pk3',contentType:'application/zip'}));
  await page.goto(`http://127.0.0.1:5198/?level=${level}&ceo=altman`);await startGame(page);const q=nativeQA(page);
  await q.wait(s=>s.mode==='playing'&&s.environment,'Native dressing boot',60000);await q.command('god');
  const at=async(x,y,a)=>{await q.command(`netevent pdoom_qa_environment ${Math.round(x)} ${Math.round(y)} ${Math.round(a)}`);await q.wait(s=>Math.hypot(s.world.x-x,s.world.y-y)<8,'Floor-correct camera');};
  const d=JSON.parse(await fs.readFile(`output/${mapDir}/map-debug.json`,'utf8')),env=d.environment;
  assert.equal((await q.read()).environment.posters,5);assert.equal((await q.read()).environment.civilian_robots,level==='hal-station'?1:0);
  for(const p of env.posters){const a=p.angle*Math.PI/180;const range=140;await at(p.x+Math.cos(a)*range,p.y+Math.sin(a)*range,(p.angle+180)%360);await page.waitForTimeout(350);await page.screenshot({path:`${out}/${level}-poster-${p.number}.png`});}
  report.cases.push(`${level}: five native posters, fixed wall mounting, civilian count correct`);
  const steam=env.steam[0];await at(steam.x-90,steam.y,0);
  const samples=[];for(let i=0;i<18;i++){await page.waitForTimeout(350);samples.push((await q.read()).environment);}
  assert.ok(samples.some(s=>s.steam_puffs>0),'Native steam particles');assert.ok(samples.some(s=>s.steam_rise>12),'Steam physically rises from vent');assert.ok(new Set(samples.map(s=>s.lights.join(','))).size>1,'Native light variation');
  await at(steam.x-140,steam.y,0);await q.wait(s=>s.environment.steam_puffs>=4&&!(s.dialogue?.remaining>0),'Visible vent burst',18000);await page.screenshot({path:`${out}/${level}-steam.png`});report[level]={samples};report.cases.push(`${level}: steam and restrained native flicker animate`);
  if(level==='hal-station'){
   await at(560,216,90);const poses=new Set();for(let i=0;i<36;i++){const s=await q.read();poses.add(s.environment.chess_pose);if([0,1,2,3].includes(s.environment.chess_pose))await page.screenshot({path:`${out}/chess-${s.environment.chess_pose}.png`});await page.waitForTimeout(350);}
   assert.equal(poses.size,4);assert.ok((await q.read()).environment.chess_wins>0);
   const near=(await q.read()).sound.recent.filter(s=>s.frames===2678&&s.spatial?.panner&&Math.abs(s.spatial.panner.positionX-560)<2);
   assert.ok(near.some(s=>s.spatial.audibleGain>0),'Piece tap audible nearby');report.chessNear=near;
   await q.hold('KeyW',1600);assert.ok((await q.read()).world.y<280,'Glass blocks real movement');await page.screenshot({path:out+'/chess-glass.png'});
   await at(64,-256,0);const before=(await q.read()).sound.recent.filter(s=>s.frames===2678).length;await page.waitForTimeout(11500);const far=(await q.read()).sound.recent.filter(s=>s.frames===2678&&s.spatial?.panner&&Math.abs(s.spatial.panner.positionX-560)<2);
   assert.ok(far.every(s=>Math.abs(s.spatial.listener.positionX-64)>200||s.spatial.audibleGain===0),'No distant civilian sound');
   report.cases.push('HAL: four native chess poses loop, glass blocks passage, nearby-only piece taps');
  }
  const errors=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown identifier/.test(l)));assert.deepEqual(errors,[]);
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);if(page){report.final=await page.evaluate(()=>window.render_game_to_text?.()).catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs?.slice(-35)).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
