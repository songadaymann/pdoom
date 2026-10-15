// Refuge lockdown closes the door even while it is still moving (2026-10-13). Jonathan walked
// into level 1's Faraday Room with the last prisoner: "Locked." on the pad, door visibly open.
// Doom ignores Door_Close on a sector whose door is still opening, so the room sealed open.
// Uses a private QA pack (never shipped) to open the door and seal in the same tic.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/refuge-seal';await fs.mkdir(out,{recursive:true});
const handler=`class PDSealQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game)return;let r=game.Refuge;
        if(e.Name=="pdoom_qa_open")r.Open();
        else if(e.Name=="pdoom_qa_seal")r.BeginEnding(game);
        else if(e.Name=="pdoom_qa_door")
        {
            Vector2 at=PDCampaignSession.Hal()?(192,360):(1168,800);let s=level.PointInSector(at);
            Console.Printf("PDOOM_SEALQA {\\"sealed\\":%d,\\"gap\\":%.1f,\\"moving\\":%d}",r.Sealed,s.ceilingplane.ZatPoint(at)-s.floorplane.ZatPoint(at),s.ceilingdata!=null);
        }
    }
}
`;
await fs.writeFile(out+'/SealQA.zs',handler);
execFileSync('python3',['-c',`
import zipfile
src,dst='doom-web/pdoom.pk3','${out}/qa.pk3'
with zipfile.ZipFile(src) as s,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as t:
    for i in s.infolist():
        d=s.read(i.filename)
        if i.filename.upper()=='ZSCRIPT':d+=b'\\n#include "actors/SealQA.zs"\\n'
        if i.filename.upper()=='MAPINFO':d=d.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDSealQA"',1)
        t.writestr(i.filename,d)
    t.write('${out}/SealQA.zs','actors/SealQA.zs')
`]);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
async function door(page,q){await q.command('netevent pdoom_qa_door');await page.waitForTimeout(150);
 return page.evaluate(()=>JSON.parse(__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_SEALQA ')).at(-1).slice(13)));}
try{
 for(const [name,url] of [['level 1','http://127.0.0.1:5198/?ceo=altman'],['level 2','http://127.0.0.1:5198/?level=hal-station&ceo=altman']]){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.route('**/pdoom.pk3',r=>r.fulfill({path:out+'/qa.pk3'}));
  await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await page.goto(url);await startGame(page);const q=nativeQA(page);
  await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,name+' boot',55000);await q.command('god');
  // The door starts opening for you and the room seals in the same moment.
  await q.command('netevent pdoom_qa_open');await q.command('netevent pdoom_qa_seal');
  await page.waitForTimeout(250);report[name+' just after']=await door(page,q);
  await page.waitForTimeout(4000);const d=await door(page,q);report[name]=d;
  assert.equal(d.sealed,1,name+': sealed');assert.ok(d.gap<1,`${name}: door still open ${d.gap} units after sealing`);
  report.cases.push(`${name}: sealing while the door is opening closes it (gap ${d.gap})`);
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
