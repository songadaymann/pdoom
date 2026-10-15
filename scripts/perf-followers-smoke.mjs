// Companion-count performance probe (2026-10-13). Private QA packs only, never shipped.
// Builds output/perf/qa-<variant>.pk3 from a snapshot of doom-web/pdoom.pk3 plus a QA handler
// (free / gather / calm / patrol) and per-subsystem MSTimeF timing; "after" also swaps in the
// candidate fix from output/perf/fix/*.zs. Measures engine fps and ZScript tic cost with
// 0/1/3/5 freed companions, standing still and while the player patrols a nav-graph route.
// Usage: node scripts/perf-followers-smoke.mjs [before|after|both] [five-prisons|hal-station|both]
import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const out='output/perf';await fs.mkdir(out,{recursive:true});
const variants=(process.argv[2]||'both')==='both'?['before','after']:process.argv[2].split(',');
const levels=(process.argv[3]||'both')==='both'?['five-prisons','hal-station']:[process.argv[3]];
const GATHER=process.env.GATHER||'path';
const base=out+'/base.pk3';if(!existsSync(base))await fs.copyFile('doom-web/pdoom.pk3',base);
const handler=`class PDPerfQA : EventHandler
{
    double TTick, TPre, TCast, THunter, TReport, MaxTick, MaxCast;
    int Ticks, Reports, Builds, Nodes;
    bool Patrol; double Speed; Vector2 PA, PB; Array<int> Path; int PathAt, PathDir;
    static PDPerfQA Get() { return PDPerfQA(EventHandler.Find('PDPerfQA')); }
    static void Built(int nodes) { let q = Get(); if (q) { q.Builds++; q.Nodes += nodes; } }
    static void Times(double pre, double cast, double hunter, double report, double total)
    {
        let q = Get(); if (!q) return;
        q.Ticks++; q.TPre += pre; q.TCast += cast; q.THunter += hunter; q.TTick += total;
        if (report > 0) { q.TReport += report; q.Reports++; }
        if (total > q.MaxTick) q.MaxTick = total; if (cast > q.MaxCast) q.MaxCast = cast;
    }
    void BuildPath(PDCheckpoint game)
    {
        Path.Clear();
        int s = game.NodeAt(PA, true), t = game.NodeAt(PB, true), count = game.HumanLinks.Size(), w = PDCheckpointMap.Width();
        if (s < 0 || t < 0) return;
        Array<int> prev; prev.Resize(count); for (int i = 0; i < count; i++) prev[i] = -2;
        Array<int> q; q.Push(s); prev[s] = -1; int head = 0;
        while (head < q.Size())
        {
            int a = q[head++]; if (a == t) break;
            for (int d = 0; d < 4; d++)
            {
                if (!(game.HumanLinks[a] & (1 << d))) continue;
                int b = a + (d == 0 ? 1 : d == 1 ? -1 : d == 2 ? w : -w);
                if (b < 0 || b >= count || prev[b] != -2 || game.Doors[b] > 0) continue;
                prev[b] = a; q.Push(b);
            }
        }
        if (prev[t] == -2) return;
        Array<int> rev; for (int n = t; n != -1; n = prev[n]) rev.Push(n);
        for (int i = rev.Size() - 1; i >= 0; i--) Path.Push(rev[i]);
    }
    override void NetworkProcess(ConsoleEvent e)
    {
        let game = PDCheckpoint.Get(); if (!game) return;
        if (e.Name == "pdoom_qa_free") game.OpenCell(e.Args[0], "development");
        else if (e.Name == "pdoom_qa_calm")
        {
            // Park the hunter (no flee/aim) and skip the first-rescue guide so every freed person follows.
            if (game.Hunter) game.Hunter.StunUntil = level.time + 10000000;
            game.Refuge.Introduced = true; game.Refuge.Guide = -1;
        }
        else if (e.Name == "pdoom_qa_gather")
        {
            // Args[0] == 1: stand them on the patrol route (always reachable);
            // otherwise a ring around the player, which can land in a sealed nav pocket.
            let pawn = players[0].mo; bool onPath = e.Args[0] == 1; int k = 0;
            if (onPath) BuildPath(game);
            for (int i = 0; i < game.Cast.People.Size(); i++)
            {
                let p = game.Cast.People[i];
                if (!p.Released || !p.Alive || p.Taken || !p.Body) continue;
                double angle = i * 72 + 36;
                int node = onPath && Path.Size() > 0 ? Path[min(3 + 3 * k++, Path.Size() - 1)] : game.NodeAt(pawn.Pos.XY + (cos(angle), sin(angle)) * 96, true);
                if (node < 0) node = game.NodeAt(pawn.Pos.XY, true);
                if (node < 0) continue;
                Vector2 at = PDCheckpointMap.Center(node);
                p.Body.SetOrigin((at, level.PointInSector(at).floorplane.ZatPoint(at)), false);
                p.Complete = true; p.Nav.Ready = false; p.Nav.HasWaypoint = false; p.Idling = false;
            }
        }
        else if (e.Name == "pdoom_qa_reach")
        {
            // Debug: which companions can the goal-side flood (from the player's cell) reach?
            let pawn = players[0].mo; int count = game.HumanLinks.Size(), w = PDCheckpointMap.Width();
            Array<int> cost; cost.Resize(count); for (int i = 0; i < count; i++) cost[i] = -1;
            Array<int> q; int g = game.NodeAt(pawn.Pos.XY, true); if (g < 0) return;
            cost[g] = 0; q.Push(g); int head = 0;
            while (head < q.Size())
            {
                int a = q[head++];
                for (int d = 0; d < 4; d++)
                {
                    if (!(game.HumanLinks[a] & (1 << d))) continue;
                    int b = a + (d == 0 ? 1 : d == 1 ? -1 : d == 2 ? w : -w);
                    if (b < 0 || b >= count || cost[b] >= 0 || game.Cast.People[0].Nav.MaintenanceBlocked(game, b)) continue;
                    cost[b] = cost[a] + 1; q.Push(b);
                }
            }
            String s = "";
            for (int i = 0; i < game.Cast.People.Size(); i++)
            {
                let p = game.Cast.People[i]; if (!p.Body || !p.Released) continue;
                int n = game.NodeAt(p.Body.Pos.XY, true);
                s = s .. String.Format("{\\"id\\":%d,\\"x\\":%.0f,\\"y\\":%.0f,\\"node\\":%d,\\"cost\\":%d,\\"dist\\":%.0f},", i, p.Body.Pos.X, p.Body.Pos.Y, n, n >= 0 ? cost[n] : -9, p.Body.Distance2D(pawn));
            }
            Console.Printf("PDOOM_PERFREACH {\\"flooded\\":%d,\\"people\\":[%s{}]}", q.Size(), s);
        }
        else if (e.Name == "pdoom_qa_a") PA = (e.Args[0], e.Args[1]);
        else if (e.Name == "pdoom_qa_b") PB = (e.Args[0], e.Args[1]);
        else if (e.Name == "pdoom_qa_patrol")
        {
            Speed = e.Args[0]; Patrol = false;
            if (Speed <= 0) return;
            BuildPath(game); PathAt = 0; PathDir = 1; Patrol = Path.Size() > 1;
            Console.Printf("PDOOM_PERFPATH {\\"nodes\\":%d}", Path.Size());
        }
    }
    override void WorldTick()
    {
        let pawn = players[0].mo;
        if (Patrol && pawn)
        {
            Vector2 at = PDCheckpointMap.Center(Path[PathAt]), d = at - pawn.Pos.XY; double len = d.Length();
            Vector2 next = at;
            if (len <= Speed)
            {
                PathAt += PathDir;
                if (PathAt >= Path.Size()) { PathAt = Path.Size() - 2; PathDir = -1; }
                if (PathAt < 0) { PathAt = 1; PathDir = 1; }
            }
            else { next = pawn.Pos.XY + d / len * Speed; pawn.Angle = atan2(d.Y, d.X); }
            pawn.SetOrigin((next, level.PointInSector(next).floorplane.ZatPoint(next)), true); pawn.Vel = (0, 0, 0);
        }
        if (level.time % 35 == 0 && Ticks > 0)
        {
            let game = PDCheckpoint.Get(); int following = 0, released = 0, walking = 0; double spread = 0;
            if (game && game.Cast) for (int i = 0; i < game.Cast.People.Size(); i++)
            {
                let p = game.Cast.People[i]; if (!p.Released || !p.Alive || !p.Body) continue;
                released++; if (!p.Holding) following++; if (p.Walking) walking++;
                if (pawn) spread = max(spread, p.Body.Distance2D(pawn));
            }
            Console.Printf("PDOOM_PERF {\\"t\\":%d,\\"ticks\\":%d,\\"tick_ms\\":%.3f,\\"max_tick_ms\\":%.3f,\\"pre_ms\\":%.3f,\\"cast_ms\\":%.3f,\\"max_cast_ms\\":%.3f,\\"hunter_ms\\":%.3f,\\"report_ms\\":%.3f,\\"builds\\":%d,\\"nodes\\":%d,\\"released\\":%d,\\"following\\":%d,\\"walking\\":%d,\\"spread\\":%.0f,\\"patrol\\":%d}",
                level.time, Ticks, TTick / Ticks, MaxTick, TPre / Ticks, TCast / Ticks, MaxCast, THunter / Ticks, Reports ? TReport / Reports : 0., Builds, Nodes, released, following, walking, spread, Patrol);
            Ticks = 0; Reports = 0; TTick = 0; TPre = 0; TCast = 0; THunter = 0; TReport = 0; MaxTick = 0; MaxCast = 0; Builds = 0; Nodes = 0;
        }
    }
}
`;
// Timing hooks, applied identically to both variants.
function instrument(name,text){
 const swap=(a,b)=>{if(!text.includes(a))throw Error(`${name}: hook not found: ${a.slice(0,60)}`);text=text.replace(a,b);};
 if(name==='Checkpoint.zs'){
  swap('    override void WorldTick()\n    {\n        if (!Initialized || !players[0].mo) return;',
   '    double QAPre, QACast, QAHunter, QAReport;\n    override void WorldTick()\n    {\n        QAPre=0;QACast=0;QAHunter=0;QAReport=0;double qaStart=MSTimeF();\n        WorldTickQA();\n        PDPerfQA.Times(QAPre,QACast,QAHunter,QAReport,MSTimeF()-qaStart);\n    }\n    void WorldTickQA()\n    {\n        if (!Initialized || !players[0].mo) return;');
  swap('            Intro.Tick(self); Polish.Tick(self); Combat.Tick(self); Encounters.Tick(self); Refuge.Tick(self); Escape.Tick(self); if(!PDCampaignSession.Hal())Sam.Tick(self); Cast.Tick(self); TickHunter();',
   '            double qa0=MSTimeF();if(PDCampaignSession.Hal())Hal.Tick(self);Intro.Tick(self); Polish.Tick(self); Combat.Tick(self); Encounters.Tick(self); Refuge.Tick(self); Escape.Tick(self); if(!PDCampaignSession.Hal())Sam.Tick(self); double qa1=MSTimeF(); Cast.Tick(self); double qa2=MSTimeF(); TickHunter(); double qa3=MSTimeF(); QAPre=qa1-qa0; QACast=qa2-qa1; QAHunter=qa3-qa2;');
  swap('            if(PDCampaignSession.Hal())Hal.Tick(self);\n','\n');
  const tail='        if (level.time % 7 == 0) Report();\n    }\n}';
  if(!text.trimEnd().endsWith(tail))throw Error('Checkpoint.zs: WorldTick tail changed');
  text=text.trimEnd().slice(0,-tail.length)+'        if (level.time % 7 == 0) { double qr=MSTimeF(); Report(); QAReport=MSTimeF()-qr; }\n    }\n}\n';
 }
 if(name==='CheckpointNav.zs'){
  // Count every flood fill and the cells it enqueued (tail) at the end of Build().
  const at=text.indexOf('    Vector2 Next(');const end=text.lastIndexOf('\n    }\n',at)+1;
  if(at<0||end<1)throw Error('CheckpointNav.zs: Build end not found');
  text=text.slice(0,end)+`        PDPerfQA.Built(${text.includes('int expanded')?'expanded':'tail'});\n`+text.slice(end);
 }
 return text;
}
async function buildPack(variant){
 const dir=`${out}/${variant}`;await fs.mkdir(dir+'/actors',{recursive:true});
 await fs.writeFile(dir+'/actors/PerfQA.zs',handler);
 const list=execFileSync('python3',['-c',`import zipfile;print('\\n'.join(zipfile.ZipFile('${base}').namelist()))`]).toString().split('\n');
 const read=n=>execFileSync('python3',['-c',`import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile('${base}').read('${n}'))`]).toString();
 for(const name of ['Checkpoint.zs','CheckpointNav.zs','RescueCast.zs','RescueAvoid.zs']){
  if(!list.includes('actors/'+name))throw Error('missing '+name);
  const fixDir=variant==='after'?`${out}/fix`:`${out}/fix-${variant}`;
  let text=variant!=='before'&&existsSync(`${fixDir}/${name}`)?await fs.readFile(`${fixDir}/${name}`,'utf8'):read('actors/'+name);
  await fs.writeFile(`${dir}/actors/${name}`,instrument(name,text));
 }
 execFileSync('python3',['-c',`
import zipfile,os
src,dst,d='${base}','${out}/qa-${variant}.pk3','${dir}'
over={'actors/'+f:open(os.path.join(d,'actors',f),'rb').read() for f in os.listdir(os.path.join(d,'actors'))}
with zipfile.ZipFile(src) as s,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as t:
    for i in s.infolist():
        data=over.pop(i.filename,None) or s.read(i.filename)
        if i.filename.upper()=='ZSCRIPT':data+=b'\\n#include "actors/PerfQA.zs"\\n'
        if i.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDPerfQA"',1)
        t.writestr(i.filename,data)
    for k,v in over.items():t.writestr(k,v)
`]);
 return `${out}/qa-${variant}.pk3`;
}
const ROUTES={'five-prisons':{a:[816,1520],b:[1616,1680]},'hal-station':{a:[-432,-176],b:[400,-240]}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={when:new Date().toISOString(),viewport:'1280x800',gather:GATHER,runs:[],errors:[]};
async function perfLines(page){return page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>l.includes('PDOOM_PERF ')).map(l=>JSON.parse(l.slice(l.indexOf('PDOOM_PERF ')+11))));}
async function measure(page,q,label,ms){
 const seen=new Map();const fps=[];const s0=await q.read();const t0=Date.now(),f0=s0.frames,tick0=s0.world.ticks;
 while(Date.now()-t0<ms){await sleep(500);const s=await q.read();fps.push(s.fps);for(const p of await perfLines(page))seen.set(p.t,p);}
 const s1=await q.read();const f1=s1.frames,tick1=s1.world.ticks,elapsed=(Date.now()-t0)/1000;
 const perf=[...seen.values()].filter(p=>p.t>tick0+35&&p.t<=tick1+7&&p.ticks>0).sort((a,b)=>a.t-b.t);
 const avg=k=>perf.length?+(perf.reduce((a,p)=>a+p[k],0)/perf.length).toFixed(3):null;
 const max=k=>perf.length?Math.max(...perf.map(p=>p[k])):null;
 const r={label,frames_per_s:+((f1-f0)/elapsed).toFixed(1),fps_mean:+(fps.reduce((a,b)=>a+b,0)/fps.length).toFixed(1),fps_min:Math.min(...fps),
  tics_per_s:+((tick1-tick0)/elapsed).toFixed(1),
  tick_ms:avg('tick_ms'),max_tick_ms:max('max_tick_ms'),cast_ms:avg('cast_ms'),max_cast_ms:max('max_cast_ms'),pre_ms:avg('pre_ms'),hunter_ms:avg('hunter_ms'),report_ms:avg('report_ms'),
  builds_per_s:avg('builds'),nodes_per_s:avg('nodes'),following:perf.at(-1)?.following,walking:avg('walking'),spread:max('spread'),samples:perf.length};
 console.log(JSON.stringify(r));return r;
}
try{
 for(const variant of variants){
  const pack=await buildPack(variant);
  for(const level of levels){
   const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
   await page.route('**/pdoom.pk3',r=>r.fulfill({path:pack}));
   await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
   await page.goto(`http://127.0.0.1:5198/?level=${level}&ceo=altman`);await startGame(page);const q=nativeQA(page);
   await q.wait(s=>s.mode==='playing'&&s.world?.ticks>35,'boot',60000);
   const loaded=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.some(l=>l.includes('PDOOM_MOD_LOADED')));
   if(!loaded)throw Error('mod not loaded: '+(await page.evaluate(()=>window.__DOOM_DEBUG__.logs.slice(-30).join('\n'))));
   await q.command('god');const R=ROUTES[level];await q.warp(R.a[0],R.a[1]);
   await q.command('netevent pdoom_qa_calm');await q.command(`netevent pdoom_qa_a ${R.a[0]} ${R.a[1]}`);await q.command(`netevent pdoom_qa_b ${R.b[0]} ${R.b[1]}`);
   const run={variant,level,rows:[]};report.runs.push(run);
   const free=[[],[0],[1,3],[2,4]];let total=0;
   for(const batch of free){
    for(const i of batch)await q.command('netevent pdoom_qa_free '+i);total+=batch.length;
    await q.warp(R.a[0],R.a[1]);await q.command('netevent pdoom_qa_gather '+(GATHER==='path'?1:0));await sleep(2500);
    run.rows.push({companions:total,...await measure(page,q,`${level} ${variant} ${total} standing`,6000)});
    await q.command('netevent pdoom_qa_patrol 10');await sleep(1500);
    run.rows.push({companions:total,...await measure(page,q,`${level} ${variant} ${total} patrolling`,9000)});
    await q.command('netevent pdoom_qa_reach');await sleep(300);run.rows.at(-1).reach=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>l.includes('PDOOM_PERFREACH')).slice(-1)[0]);console.log(run.rows.at(-1).reach);
    await q.command('netevent pdoom_qa_patrol 0');
   }
   run.path=await page.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>l.includes('PDOOM_PERFPATH')).slice(-1)[0]);
   await page.close();
  }
 }
}catch(e){report.failure=String(e.stack||e).slice(0,1500);console.error(report.failure);}
finally{await fs.writeFile(`${out}/report-${GATHER}-${variants.join('-')}-${levels.join('-')}.json`,JSON.stringify(report,null,2));await browser.close();}
if(report.failure)process.exitCode=1;
