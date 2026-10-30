// Levels 1 and 2 followers keep up (2026-10-30; the 2026-10-19 level 3 rule, now in PDRescueCast).
// Keep-up: on the map's longest straight, wide human lane, a follower 128 u behind keeps up while you
// really run (ShiftLeft+KeyW; main.js starts with cl_run 0) and never moves over 18.5 u/tic at close range.
// Catch-up: a follower placed on a linked node 1500+ u away and out of sight warps to just behind you, in
// one jump, and only once the guards allow it: not beside an awake hunter, not while HAL holds a door shut
// (hal-station), never a holder. Positions are chosen at runtime from the human graph, not hard-coded.
// Private QA pack (never shipped). Muted Chrome. Usage: node scripts/escort-keepup-smoke.mjs [five-prisons|hal-station|both]
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/escort-keepup';await fs.mkdir(out,{recursive:true});
const levels=(process.argv[2]||'both')==='both'?['five-prisons','hal-station']:[process.argv[2]];
const handler=`class PDKeepUpQA : EventHandler
{
    Vector3 HunterHome;bool Homed;
    void Place(PDCheckpoint game,int site,Vector2 at)
    {
        let p=game.Cast.People[site];let sector=level.PointInSector(at);
        p.Avoid.Calm(p);p.Body.SetOrigin((at,sector.floorplane.ZatPoint(at)),false);p.Body.ClearInterpolation();
        p.Body.health=100;p.Released=true;p.Discovered=true;p.Complete=true;p.Carded=true;p.ReleasedAt=level.time-200;
        p.Holding=false;p.Sheltered=false;p.RefugeArrival=false;p.RefugeRecall=false;p.PadDuty=false;
        p.Idling=false;p.Nav.Ready=false;p.Nav.HasWaypoint=false;p.Body.SetStateLabel('Spawn');p.Walking=false;
    }
    // Hunter parked and asleep, nobody guiding, HAL's corridor doors quiet for the test.
    void Calm(PDCheckpoint game)
    {
        game.Refuge.Known=true;game.Refuge.Introduced=true;game.Refuge.Guide=-1;
        if(game.Hunter){if(!Homed){HunterHome=game.Hunter.Pos;Homed=true;}game.Hunter.SetOrigin(HunterHome,false);game.Hunter.StunUntil=level.time+10000000;}
        game.Awake=false;
        if(PDCampaignSession.Hal()){let d=game.Hal.Doors;d.NextLock=level.time+10000000;d.WarningIndex=-1;d.LockExpires=min(d.LockExpires,level.time);}
    }
    bool Open(PDCheckpoint game,PDCheckpointNav nav,int n)
    {
        if(n<0||n>=game.HumanLinks.Size()||!game.HumanLinks[n]||game.Doors[n]!=0||nav.MaintenanceBlocked(game,n))return false;
        Vector2 c=PDCheckpointMap.Center(n);if(PDRescueRefuge.Inside(c)||PDRescueRefuge.NearEntrance(c))return false; // Near the door they would turn into refuge arrivals.
        for(int s=0;s<5;s++)if(PDCheckpointMap.SiteInside(s,c))return false;
        let sec=level.PointInSector(c);return sec.ceilingplane.ZatPoint(c)-sec.floorplane.ZatPoint(c)>=64;
    }
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game||!game.Initialized)return;
        let pawn=players[0].mo;let nav=new('PDCheckpointNav');nav.Human=true;
        int w=PDCheckpointMap.Width(),count=game.HumanLinks.Size();
        if(e.Name=="pdoom_qa_lane")
        {
            // Longest straight run east (+X) or north (+Y) of open, flat, three-wide human cells.
            int best=-1,bestLen=0,bestDir=0;
            for(int dir=0;dir<2;dir++)
            {
                int step=dir==0?1:w,side=dir==0?w:1,bit=dir==0?1:4;
                for(int n=0;n<count;n++)
                {
                    if(!Open(game,nav,n)||Open(game,nav,n-step)&&(game.HumanLinks[n-step]&bit))continue;
                    int len=1,at=n;
                    while(len<40&&(game.HumanLinks[at]&bit)&&Open(game,nav,at+step)&&Open(game,nav,at+step+side)&&Open(game,nav,at+step-side))
                    {
                        Vector2 a=PDCheckpointMap.Center(at),b=PDCheckpointMap.Center(at+step);
                        if(abs(level.PointInSector(a).floorplane.ZatPoint(a)-level.PointInSector(b).floorplane.ZatPoint(b))>1)break;
                        at+=step;len++;
                    }
                    if(len>bestLen){bestLen=len;best=n;bestDir=dir;}
                }
            }
            if(best<0||bestLen<24){Console.Printf("PDOOM_KEEPUP {\\"setup\\":\\"lane\\",\\"len\\":%d}",bestLen);return;}
            Calm(game);int along=bestDir==0?1:w;
            Vector2 you=PDCheckpointMap.Center(best+along*5),them=PDCheckpointMap.Center(best+along),end=PDCheckpointMap.Center(best+along*(bestLen-1));
            pawn.SetOrigin((you,level.PointInSector(you).floorplane.ZatPoint(you)),false);pawn.Vel=(0,0,0);pawn.Angle=bestDir==0?0:90;
            Place(game,0,them);
            Console.Printf("PDOOM_KEEPUP {\\"setup\\":\\"lane\\",\\"len\\":%d,\\"x\\":%.1f,\\"y\\":%.1f,\\"end_x\\":%.1f,\\"end_y\\":%.1f,\\"angle\\":%.0f}",bestLen,you.X,you.Y,end.X,end.Y,pawn.Angle);
        }
        else if(e.Name=="pdoom_qa_catchup")
        {
            // Walk the human graph out from your cell under the game's own door rules; take the first two
            // open cells Args[0] to Args[0]+1500 u away that you cannot see. Person 0 follows, person 1 holds.
            // The guards go on in the same tic, so no catch-up can slip in first: an awake (stunned, so
            // harmless) hunter on you, and on HAL a door lock as well.
            Calm(game);double near=e.Args[0];int start=game.NodeAt(pawn.Pos.XY,true);if(start<0)return;
            Array<int> seen;seen.Resize(count);for(int n=0;n<count;n++)seen[n]=0;
            Array<int> queue;queue.Push(start);seen[start]=1;int head=0,found=0;Vector2 first;
            let probe=game.Cast.People[1].Body;
            while(head<queue.Size()&&found<2)
            {
                int at=queue[head++];Vector2 c=PDCheckpointMap.Center(at);double d=(c-pawn.Pos.XY).Length();
                if(d>=near&&d<=near+1500&&Open(game,nav,at)&&(found==0||(c-first).Length()>=160))
                {
                    probe.SetOrigin((c,level.PointInSector(c).floorplane.ZatPoint(c)),false);
                    if(!pawn.CheckSight(probe)){if(found==0)first=c;else Place(game,1,c);found++;}
                }
                for(int dir=0;dir<4;dir++)
                {
                    if(!(game.HumanLinks[at]&(1<<dir)))continue;
                    int next=at+(dir==0?1:dir==1?-1:dir==2?w:-w);
                    if(next<0||next>=count||seen[next]||nav.MaintenanceBlocked(game,next))continue;
                    seen[next]=1;queue.Push(next);
                }
            }
            if(found<2){Console.Printf("PDOOM_KEEPUP {\\"setup\\":\\"catchup\\",\\"found\\":%d}",found);return;}
            Place(game,0,first);
            let h=game.Cast.People[1];h.Holding=true;h.HoldGoal=h.Body.Pos.XY;
            if(game.Hunter){game.Hunter.SetOrigin(pawn.Pos,false);game.Awake=true;game.WakeAt=level.time-175;}
            // A fresh route search from them to you, as hal-guide-route-smoke does, before the lock can cut it.
            let route=new('PDCheckpointNav');route.Human=true;int node=game.NodeAt(first,true);route.Build(game,pawn.Pos.XY,node);
            // A real lock (LockIndex set) on HAL's first corridor door; it only holds while HAL is enabled (Levers 31 at start).
            if(PDCampaignSession.Hal()){game.Hal.Doors.LockIndex=0;game.Hal.Doors.LockExpires=level.time+10000000;}
            Console.Printf("PDOOM_KEEPUP {\\"setup\\":\\"catchup\\",\\"found\\":2,\\"tic\\":%d,\\"x\\":%.1f,\\"y\\":%.1f,\\"hold_x\\":%.1f,\\"hold_y\\":%.1f,\\"stranded\\":%d,\\"cost\\":%d}",level.time,first.X,first.Y,h.Body.Pos.X,h.Body.Pos.Y,route.Stranded,route.CostAt(node));
        }
        else if(e.Name=="pdoom_qa_hunter_off"&&game.Hunter){game.Hunter.SetOrigin(HunterHome,false);game.Awake=false;}
        else if(e.Name=="pdoom_qa_clear")Calm(game);
    }
}
`;
await fs.writeFile(out+'/KeepUpQA.zs',handler);
execFileSync('python3',['-c',`
import zipfile
src,dst='doom-web/pdoom.pk3','${out}/qa.pk3'
with zipfile.ZipFile(src) as s,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as t:
    for i in s.infolist():
        d=s.read(i.filename)
        if i.filename.upper()=='ZSCRIPT':d+=b'\\n#include "actors/KeepUpQA.zs"\\n'
        if i.filename.upper()=='MAPINFO':d=d.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDKeepUpQA"',1)
        t.writestr(i.filename,d)
    t.write('${out}/KeepUpQA.zs','actors/KeepUpQA.zs')
`]);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
try{
 for(const level of levels){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(level+': '+e));
  await page.route('**/pdoom.pk3',r=>r.fulfill({path:out+'/qa.pk3'}));
  await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  await page.goto('http://127.0.0.1:5198/?level='+level+'&ceo=altman');await startGame(page);const q=nativeQA(page),r=report[level]={};
  await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,level+' boot',55000);await q.command('god');await q.command('notarget');
  const setup=async(event,kind)=>{await q.command('netevent '+event);await page.waitForTimeout(150);return page.evaluate(k=>{const l=__DOOM_DEBUG__.logs.filter(l=>l.startsWith('PDOOM_KEEPUP ')).map(l=>JSON.parse(l.slice(13))).filter(j=>j.setup===k);return l.at(-1);},kind);};
  const sample=async(ms,trace=[])=>{const end=Date.now()+ms;while(Date.now()<end){trace.push((await q.read()).world);await page.waitForTimeout(60);}return trace;};
  const rate=(trace,i)=>trace.slice(1).map((w,j)=>gap(w.people[i],trace[j].people[i])/Math.max(1,w.ticks-trace[j].ticks));

  // 1. Keep-up while really running.
  const lane=await setup('pdoom_qa_lane','lane');r.lane=lane;assert.ok(lane&&lane.len>=24,level+': a straight 24-cell human lane ('+JSON.stringify(lane)+')');
  await q.wait(s=>gap(s.world,lane)<20,level+': on the lane');await page.waitForTimeout(500);
  const runTics=Math.min(48,(lane.len-9)*32/13.5),run=[];
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
  try{await sample(runTics*28.57,run);}finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
  await sample(4000,run);r.run=run.map(w=>({t:w.ticks,you:[w.x,w.y],them:[w.people[0].x,w.people[0].y]}));
  const yours=run.slice(1).map((w,j)=>gap(w,run[j])/Math.max(1,w.ticks-run[j].ticks)),theirs=rate(run,0);
  r.yourTop=Math.max(...yours);r.theirTop=Math.max(...theirs);
  assert.ok(r.yourTop>9,level+': the player really ran ('+r.yourTop.toFixed(1)+' u/tic)');
  assert.ok(r.theirTop>6,level+': the follower moved faster than the old 4.2 walk ('+r.theirTop.toFixed(1)+')');
  assert.ok(theirs.every(v=>v<=18.5),level+': no follower step over 18.5 u/tic at close range');
  assert.ok(gap(run.at(-1).people[0],run.at(-1))<200,level+': the follower ends beside you');
  report.cases.push(`${level}: follower keeps up while you run (you ${r.yourTop.toFixed(1)}, them ${r.theirTop.toFixed(1)} u/tic)`);

  // 2. Catch-up, held back by an awake hunter beside you (and on HAL a door lock), then allowed.
  // Far enough that the follower, walking at 4.2 while held back, is still over 1024 u away when released.
  let far;for(const near of [2000,1600]){far=await setup('pdoom_qa_catchup '+near,'catchup');if(far?.found===2)break;}
  r.catchup=far;assert.equal(far?.found,2,level+': two hidden linked cells 1600+ u away');
  assert.equal(far.stranded,0,level+': the far follower has a route to you');assert.ok(far.cost>=0,level+': that route reaches them');
  // They walk back toward you from the tic they are placed, so allow for that walk.
  let s=await q.read();assert.ok(gap(s.world.people[0],far)<=Math.max(0,s.world.ticks-far.tic)*4.3+48,level+': follower placed ('+JSON.stringify({them:[s.world.people[0].x,s.world.people[0].y],far,ticks:s.world.ticks})+')');
  assert.ok(gap(s.world.people[0],s.world)>1500,level+': placed far from you');assert.equal(s.world.people[0].visible,0,level+': placed out of sight');
  const hold=level==='hal-station'?1000:1500,held=[s.world];await sample(hold,held); // Short: they walk toward you at 4.2 meanwhile.
  if(level==='hal-station'){await q.command('netevent pdoom_qa_hunter_off');await sample(hold,held);} // The lock alone still holds.
  r.held=held.map(w=>({t:w.ticks,them:[w.people[0].x,w.people[0].y],hold:[w.people[1].x,w.people[1].y]}));
  assert.ok(rate(held,0).every(v=>v<=18.5),level+': no catch-up while a guard holds it back');
  assert.ok(held.every(w=>gap(w.people[0],w)>1024),level+': still far behind while held back');assert.equal(held.at(-1).people[0].visible,0,level+': still out of sight when released');
  await q.command('netevent pdoom_qa_clear');
  const free=[held.at(-1)];await q.wait(w=>{free.push(w.world);return gap(w.world.people[0],w.world)<220&&w.world.people[0].visible===1;},level+': follower catches up',6000);
  const jumps=rate(free,0);r.jump=Math.max(...jumps);
  assert.ok(free.slice(1).some((w,j)=>gap(w.people[0],free[j].people[0])>400),level+': arrived in one jump, not a walk');
  const after=free.at(-1);assert.ok(Math.abs(after.people[0].z-after.z)<=24,level+': landed on your floor');
  report.cases.push(`${level}: a far, hidden follower catches up only once the hunter${level==='hal-station'?' and HAL door lock':''} guard clears`);
  // 3. A holder never warps.
  const all=[...held,...free];r.holdDrift=Math.max(...all.map(w=>Math.hypot(w.people[1].x-far.hold_x,w.people[1].y-far.hold_y)));
  assert.ok(r.holdDrift<100,level+': the holder stays where it holds ('+r.holdDrift.toFixed(0)+' u)');
  report.cases.push(`${level}: a holding person stays put`);
  await page.screenshot({path:out+'/'+level+'-caught-up.png'});
  assert.deepEqual(await page.evaluate(()=>__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Execution could not continue|Unknown identifier/.test(l))),[]);
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
