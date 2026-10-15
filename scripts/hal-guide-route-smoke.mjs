// Whoever you free first in the Computer Station can lead you to the Faraday Room (2026-10-13).
// Beth freed first stood still outside her wing: the corridor door west of it shared Rob's cell
// tag (876), so her route search counted it as Rob's locked cell and found no way. For each
// prisoner freed first: the guide has a route (not stranded); Beth then walks it to the refuge.
// Private QA pack (never shipped). Muted Chrome.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/hal-guide-route';await fs.mkdir(out,{recursive:true});
const handler=`class PDGuideQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game)return;
        if(e.Name=="pdoom_qa_free")game.OpenCell(e.Args[0],"qa");
        else if(e.Name=="pdoom_qa_probe")
        {
            let p=game.Cast.People[e.Args[0]];let b=p.Body;if(!b)return;int node=game.NodeAt(b.Pos.XY,true);
            // A fresh human route search from where they stand to their Faraday Room slot,
            // under the game's own door rules (locked cells of those still captive).
            let route=new('PDCheckpointNav');route.Human=true;route.Build(game,PDRescueRefuge.Slot(e.Args[0]),node);
            Console.Printf("PDOOM_GUIDEQA {\\"x\\":%.1f,\\"y\\":%.1f,\\"stranded\\":%d,\\"cost\\":%d,\\"guide\\":%d,\\"walking\\":%d}",b.Pos.X,b.Pos.Y,route.Stranded,route.CostAt(node),game.Refuge.Guiding(e.Args[0]),p.Walking);
        }
    }
}
`;
await fs.writeFile(out+'/GuideQA.zs',handler);
execFileSync('python3',['-c',`
import zipfile
src,dst='doom-web/pdoom.pk3','${out}/qa.pk3'
with zipfile.ZipFile(src) as s,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as t:
    for i in s.infolist():
        d=s.read(i.filename)
        if i.filename.upper()=='ZSCRIPT':d+=b'\\n#include "actors/GuideQA.zs"\\n'
        if i.filename.upper()=='MAPINFO':d=d.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDGuideQA"',1)
        t.writestr(i.filename,d)
    t.write('${out}/GuideQA.zs','actors/GuideQA.zs')
`]);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
// Stand just outside each cell, so the guide leads instead of waiting for you.
const only=process.env.SITES?process.env.SITES.split(',').map(Number):[0,1,2,3,4];
const outside=[[-384,-64],[-1392,-112],[-1216,-2400],[1216,-2016],[352,-1380]],names=['Rob','Dan','Nate','Roman','Beth'];
try{
 for(const site of only){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.route('**/pdoom.pk3',r=>r.fulfill({path:out+'/qa.pk3'}));
  await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);const q=nativeQA(page);
  await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'HAL boot',55000);await q.command('god');await q.command('notarget');
  const probe=async()=>{await q.command('netevent pdoom_qa_probe '+site);await page.waitForTimeout(150);return page.evaluate(()=>JSON.parse(__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_GUIDEQA ')).at(-1).slice(14)));};
  await q.warp(...outside[site]);await q.command('netevent pdoom_qa_free '+site);await page.waitForTimeout(7000);
  const g=await probe();report[names[site]]=g;
  assert.equal(g.guide,1,names[site]+' guides');assert.equal(g.stranded,0,names[site]+' has no route to the Faraday Room');assert.ok(g.cost>=0,names[site]+' route reaches them');
  report.cases.push(`${names[site]} freed first: route to the Faraday Room (${g.cost} cells)`);
  if(names[site]==='Beth'){
   // Follow her like a player, a little behind where she was.
   const trail=[];let arrived=false;report.bethTrail=trail;
   for(let t=0;t<75&&!arrived;t++){
    await page.waitForTimeout(800);const b=await probe(),s=await q.read();trail.push([b.x,b.y,s.world.x,s.world.y,b.walking]);
    // She waits whenever you are over 224 units away; keep up, stepping onto her own path.
    if(Math.hypot(b.x-s.world.x,b.y-s.world.y)>150){const back=[...trail].reverse().find(([x,y])=>Math.hypot(x-b.x,y-b.y)>=60&&Math.hypot(x-b.x,y-b.y)<=140);
     if(back)await q.command(`warp ${back[0]} ${back[1]}`);else{const d=Math.hypot(s.world.x-b.x,s.world.y-b.y);await q.command(`warp ${Math.round(b.x+(s.world.x-b.x)/d*90)} ${Math.round(b.y+(s.world.y-b.y)/d*90)}`);}}
    arrived=Math.hypot(b.x-192,b.y-528)<200;
   }
   assert.ok(arrived,'Beth leads all the way to the Faraday Room');report.cases.push('Beth leads you all the way to the Faraday Room');
   await page.screenshot({path:out+'/beth-arrives.png'});
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
