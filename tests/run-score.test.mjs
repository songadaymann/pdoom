import test from 'node:test';
import assert from 'node:assert/strict';
import {getLevel,boardsForLevel,nextLevel} from '../doom-web/levels.js';
import {scoreRun,RunTracker} from '../doom-web/run-score.js';
import {LeaderboardSubmission,submissionBodies,stablePlayer} from '../doom-web/leaderboard-client.js';
import {createLocalLeaderboards} from '../scripts/local-leaderboards.mjs';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const level=getLevel(),payload=(overrides={})=>({level_id:level.id,level_version:level.version,score_version:level.scoreVersion,outcome:'escaped',saved:6,total:6,active_tics:21000,p_doom_cover:5,cameras_broken:9,cameras_total:9,practice:0,routes:['vent','turret','key','breach','pad'],saved_figures:overrides.outcome==='lost'?0:Math.max(0,(overrides.saved??6)-1),ceo_state:overrides.outcome==='lost'?'downed':'conscious',skill:3,entry:'cold',retreat:0,...overrides});
const result=(overrides={},options={})=>scoreRun(payload(overrides),level,{runId:'run-test',...options});
test('approved formula, rescue dominance and gentle speed',()=>{
  assert.equal(result().totalScore,55200);assert.equal(result().submissions.length,3);
  assert.equal(result({saved:5}).submissions.length,1);
  assert.ok(result({saved:5,active_tics:1,p_doom_cover:1}).totalScore<result({cameras_broken:0,active_tics:210000000,p_doom_cover:99}).totalScore);
  assert.ok(result({active_tics:42000}).breakdown.speed>0);
});
test('native completion freezes once, restart isolates run and clock, no lowest-ever outlook',()=>{
  let n=0;const run=new RunTracker(level,{uuid:()=>`run-${++n}`});
  run.begin(payload());run.update(payload({active_tics:100,p_doom_cover:8}));run.update(payload({active_tics:1000,p_doom_cover:15}));
  const first=run.finish(payload({p_doom_cover:15}));assert.equal(first.breakdown.outlook,850);
  run.update(payload({active_tics:999999}));assert.equal(run.finish(payload({saved:1})),first);assert.equal(run.activeTics,21000);
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.breakdown)&&Object.isFrozen(first.submissions));
  run.begin(payload());assert.equal(run.runId,'run-2');assert.equal(run.result,null);assert.equal(run.activeTics,0);assert.equal(run.coverDoom,null);
});
test('practice persists when cheats are later disabled; loss never submits',()=>{
  const run=new RunTracker(level,{uuid:()=> 'practice'});run.begin(payload());run.update(payload({practice:1}));run.update(payload({practice:0}));
  assert.equal(run.finish(payload()).eligible,false);assert.equal(result({}, {practiceReason:'Console used'}).submissions.length,0);
  assert.equal(result({outcome:'lost',saved:0,p_doom_cover:-1}).totalScore,0);
  assert.equal(result({outcome:'lost',saved:0,p_doom_cover:-1}).eligible,false);
});
test('exact map totals, IDs, version and complete cover snapshot required',()=>{
  for(const override of [{level_id:'future'},{level_version:'old'},{score_version:'old'},{cameras_total:8},{saved:7},{active_tics:0},{active_tics:1.2},{p_doom_cover:-1},{cameras_broken:10}])assert.throws(()=>result(override));
  assert.throws(()=>new RunTracker(level).finish(payload()));
});
test('future levels have isolated board keys, configurable targets and no invented next level',()=>{
  const future={...level,id:'level-two',version:'level-two-v1',title:'Second Level',peopleTotal:4,camerasTotal:3};
  assert.equal(new Set([...boardsForLevel(level),...boardsForLevel(future)].map(b=>b.variant)).size,6);
  const second=scoreRun({...payload(),level_id:future.id,level_version:future.version,total:4,saved:4,saved_figures:3,cameras_total:3,cameras_broken:3},future,{runId:'second'});
  assert.equal(second.submissions.length,3);assert.ok(second.submissions.every(b=>b.variant.startsWith('level-two-')));
  // The next board version after the current one (level 1 is already on v3).
  const next=`v${Number(level.boardVersion.slice(1))+1}`,revised={...level,version:`five-prisons-${next}`,boardVersion:next};
  assert.equal(new Set([...boardsForLevel(level),...boardsForLevel(revised)].map(b=>b.variant)).size,6);
  assert.equal(nextLevel(level),null);assert.equal(getLevel('rescue'),level);assert.equal(getLevel('absent'),null);assert.equal(boardsForLevel(getLevel('intake')).length,0);
});
test('stable browser ID, small frozen metadata and same per-board IDs on retry',async()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  assert.equal(stablePlayer(storage,()=> 'id-one'),stablePlayer(storage,()=> 'id-two'));
  const bodies=submissionBodies(result(),'  Player  ','id-one');assert.equal(bodies[0].name,'Player');assert.ok(JSON.stringify(bodies[0].metadata).length<2048);
  assert.throws(()=>submissionBodies(result({practice:1}),'Player','id'));assert.throws(()=>submissionBodies(result(),' ','id'));
  const sent=[];let fail=true;
  const service=new LeaderboardSubmission(result(),{playerId:'id-one',fetcher:async(_,request)=>{
    const body=JSON.parse(request.body);sent.push(body);
    if(body.variant.includes('perfect')&&fail){fail=false;throw Error('Uncertain network response');}
    return {ok:true,json:async()=>({success:true})};
  }});
  await assert.rejects(service.submit('Original'));const retried=await service.submit('Changed');assert.equal(retried.complete,true);
  assert.equal(sent.filter(b=>b.variant===bodies[0].variant).length,1);
  assert.equal(sent[1].submissionId,sent[2].submissionId);assert.ok(sent.every(b=>b.name==='Original'));
  await service.submit('Original');assert.equal(sent.length,4);
});
test('loopback API persists, sorts each board, rejects unknown levels and deduplicates retries',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'pdoom-boards-')),store=path.join(temp,'scores.json');
  const handler=createLocalLeaderboards({store});const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost')))res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const post=async body=>{const response=await fetch(origin+'/api/v1/leaderboard',{method:'POST',body:JSON.stringify(body)});return {status:response.status,...await response.json()};};
  try{
    const bodies=submissionBodies(result(),'Fixture','fixture');for(const body of bodies)assert.equal((await post(body)).success,true);
    assert.equal((await post(bodies[0])).success,true);
    assert.equal((await post({...bodies[0],score:1})).status,400);
    assert.equal((await post({...bodies[0],variant:'other-level'})).status,400);
    const again=createLocalLeaderboards({store});assert.equal(typeof again,'function');
    const data=await(await fetch(origin+`/api/v1/leaderboard?slug=pdoom&variant=${bodies[0].variant}`)).json();assert.equal(data.entries.length,1);assert.equal(data.entries[0].score,55200);
    await post({...bodies[1],submissionId:'faster',score:500000});
    const times=await(await fetch(origin+`/api/v1/leaderboard?slug=pdoom&variant=${bodies[1].variant}`)).json();assert.equal(times.entries[0].score,500000);assert.equal(times.entries[1].score,600000);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});}
});
