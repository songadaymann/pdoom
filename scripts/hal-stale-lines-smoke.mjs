// Release and module lines (2026-10-12): HAL's "Evaluations need an evaluator" only while Beth is
// captive; each prisoner's own freed line, then HAL's reaction; the fifth says only "That's all
// of us"; HAL pleads on each memory-module pull.
// Uses a private QA pack (never shipped): free a prisoner, park HAL's drone by the board.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/stale-lines';await fs.mkdir(out,{recursive:true});
const handler=`class PDStaleQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game)return;
        if(e.Name=="pdoom_qa_free")game.OpenCell(e.Args[0],"qa");
        else if(e.Name=="pdoom_qa_ball"&&game.Hunter){Vector2 xy=(e.Args[0],e.Args[1]);game.Hunter.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)+8),false);}
    }
}
`;
await fs.writeFile(out+'/StaleQA.zs',handler);
execFileSync('python3',['-c',`
import zipfile
src,dst='doom-web/pdoom.pk3','${out}/qa.pk3'
with zipfile.ZipFile(src) as s,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as t:
    for i in s.infolist():
        d=s.read(i.filename)
        if i.filename.upper()=='ZSCRIPT':d+=b'\\n#include "actors/StaleQA.zs"\\n'
        if i.filename.upper()=='MAPINFO':d=d.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDStaleQA"',1)
        t.writestr(i.filename,d)
    t.write('${out}/StaleQA.zs','actors/StaleQA.zs')
`]);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};let cur=null;
async function hal(){
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/pdoom.pk3',r=>r.fulfill({path:out+'/qa.pk3'}));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await startGame(page);const q=nativeQA(page);
 await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'HAL boot',55000);await q.command('god');cur=q;return q;
}
// Stand by the board, HAL's drone beside it and in sight of you.
async function besideBoard(q){await q.warp(192,-1232,0);await q.command('netevent pdoom_qa_ball 320 -1232');}
try{
 // Control: Beth captive -> HAL explains the sign.
 let q=await hal();await besideBoard(q);
 await q.wait(s=>s.hal.board_explained===1,'HAL explains the sign while Beth is captive',20000);report.cases.push('Beth captive: HAL says "Evaluations need an evaluator"');
 // Beth freed -> never.
 q=await hal();await q.command('netevent pdoom_qa_free 4');await q.wait(s=>s.world.people[4].released,'Beth freed');
 for(let i=0;i<6;i++){await besideBoard(q);await new Promise(r=>setTimeout(r,2500));}
 let s=await q.read();assert.equal(s.hal.board_explained,0,'No sign line once Beth is free');
 assert.ok(!s.voiceOver.unrecorded.includes('hal-sign')&&!s.voiceOver.played.includes('hal-sign'));report.cases.push('Beth free: no sign line in 15 s beside the board');
 // Releases one at a time, letting everyone finish talking each time: the prisoner's own line,
 // then HAL's reaction (2026-10-12); the third also gets HAL's west-wing line; the fifth only
 // "That's all of us", then HAL. Beth (freed above) was first, so she is the guide.
 const said=[];const seen=new Set();
 async function drain(ms){const end=Date.now()+ms;let quiet=0;while(Date.now()<end){const d=(await q.read()).dialogue;if(d&&d.remaining>0&&!seen.has(d.serial)){seen.add(d.serial);said.push({serial:d.serial,site:d.site,line:d.line,text:d.text});}quiet=d&&d.remaining>0?0:quiet+1;if(quiet>12)return;await new Promise(r=>setTimeout(r,150));}}
 await drain(15000);
 for(const i of [0,1,2,3]){await q.command('netevent pdoom_qa_free '+i);await drain(30000);}
 report.said=said;const has=(site,line)=>said.some(x=>x.site===site&&x.line===line);
 for(const [site,key] of [[0,'freed'],[1,'freed'],[2,'freed']])assert.ok(has(site,key),`Prisoner ${site} says their own freed line: `+JSON.stringify(said));
 assert.ok(said.find(x=>x.site===0&&x.line==='freed').text.startsWith('It pressed STOP'),'Rob in his own words');
 for(const key of ['release-rob','release-dan','release-nate','jailbreak','wing'])assert.ok(has(-2,key),'HAL says '+key+': '+JSON.stringify(said));
 assert.ok((await q.read()).voiceOver.played.includes('hal-release-beth'),'HAL reacted to Beth (during the sign check above)');
 assert.ok(has(3,'last')&&!has(3,'freed'),'The fifth (Roman) says only "That\'s all of us"');
 const order=k=>said.findIndex(x=>x.line===k);assert.ok(order('freed')<order('release-rob'),'Prisoner first, then HAL');
 report.cases.push('Each release: own freed line, then HAL reacts (rob/dan/nate/beth + jailbreak), west wing at the third, fifth says only "That\'s all of us"');
 // Memory modules: HAL pleads on each pull, then gives up.
 q=await hal();const pleas=[];
 for(const [x,y]of [[32,-736],[-1488,64],[-1184,-2320],[1248,-2048]]){await q.warp(x,y+16,270);await q.press('KeyE');await q.wait(s=>s.hal.modules===pleas.length+1,'Module pulled',5000);const d=(await q.read()).dialogue;pleas.push(d.line);}
 assert.deepEqual(pleas,['modules-1','modules-2','modules-3','pacified'],'HAL pleads on each pull: '+pleas.join(','));
 report.cases.push('Module pulls: '+pleas.join(' -> '));
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e).slice(0,300);report.final=await cur?.read().catch(()=>null);}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
