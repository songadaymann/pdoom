import test from 'node:test';
import assert from 'node:assert/strict';
import {RankedRuns} from '../doom-web/ranked-runs.js';
import {LeaderboardSubmission} from '../doom-web/leaderboard-client.js';
import {scoreRun} from '../doom-web/run-score.js';
import {getLevel} from '../doom-web/levels.js';
import {localDevelopmentEnabled} from '../doom-web/dev-capabilities.js';

const storage=()=>{const data=new Map();return{get length(){return data.size;},key:index=>[...data.keys()][index]||null,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
const receipt=body=>({ok:true,json:async()=>({success:true,runId:body.runId,ticketId:'12345678-1234-1234-1234-123456789abc',expiresAt:Date.now()+1e9})});
const result=(id='run-fixture')=>{
  const l=getLevel();return scoreRun({level_id:l.id,level_version:l.version,score_version:l.scoreVersion,outcome:'escaped',saved:6,total:6,active_tics:21000,p_doom_cover:5,cameras_broken:9,cameras_total:9,practice:0,saved_figures:5,ceo_state:'conscious',skill:3,entry:'cold',retreat:0,routes:[]},l,{runId:id});
};
test('public hosts never enable fixtures, and loopback requires explicit development capability',async()=>{
  let reads=0;const enabled=async()=>{reads++;return {ok:true,json:async()=>({enabled:true})};};
  for(const hostname of ['mann.cool','www.mann.cool','mann-cool-pdoom.novox-robot.workers.dev'])assert.equal(await localDevelopmentEnabled({hostname,fetcher:enabled}),false);
  assert.equal(reads,0);assert.equal(await localDevelopmentEnabled({hostname:'127.0.0.1',fetcher:enabled}),true);
  assert.equal(await localDevelopmentEnabled({hostname:'localhost',fetcher:async()=>({ok:true,json:async()=>({enabled:false})})}),false);
  assert.equal(await localDevelopmentEnabled({hostname:'localhost',fetcher:async()=>{throw Error('offline');}}),false);
});
test('simultaneous ticket requests share one receipt and keep secrets out of metadata',async()=>{
  let calls=0;const ranked=new RankedRuns({endpoint:'/runs',storage:storage(),makeNonce:()=> 'a'.repeat(64),fetcher:async(_,request)=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return receipt(JSON.parse(request.body));}});
  const [a,b]=await Promise.all([ranked.ticket(result()),ranked.ticket(result())]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.token,'a'.repeat(64));
  assert.equal((await ranked.ticket(result())).id,a.id);assert.equal(calls,1);
});
test('an uncertain ticket response retries the same nonce after reloading',async()=>{
  const saved=storage(),sent=[];let fail=true;
  const fetcher=async(_,request)=>{const body=JSON.parse(request.body);sent.push(body);if(fail){fail=false;throw Error('response lost');}return receipt(body);};
  let ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});ranked.save(result(),'amodei');
  await assert.rejects(ranked.ticket(result()),/kept here/);
  ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});assert.equal(ranked.pending().length,1);await ranked.ticket(result());assert.deepEqual(sent[0],sent[1]);
});
test('partial submission and refresh retain the original name, IDs, result and accepted boards',async()=>{
  const saved=storage(),sent=[];let fail=true;
  const fetcher=async(_,request)=>{
    const body=JSON.parse(request.body);if(!body.variant)return receipt(body);
    sent.push(body);if(body.variant.includes('perfect')&&fail){fail=false;return {ok:false,json:async()=>({error:'Temporary outage'})};}
    return {ok:true,json:async()=>({success:true})};
  };
  let ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});const value=result();ranked.save(value,'amodei');
  const create=()=>new LeaderboardSubmission(value,{endpoint:'/boards',fetcher,playerId:'original-player',ceo:'amodei',ticket:()=>ranked.ticket(value),state:ranked.pending()[0],onProgress:state=>ranked.progress(value.runId,state)});
  let submission=create();await assert.rejects(submission.submit('Original'),/Temporary outage/);
  ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});submission=create();const accepted=await submission.submit('Changed after reload');
  assert.equal(accepted.complete,true);assert.equal(sent.length,4);assert.ok(sent.every(body=>body.name==='Original'));assert.equal(sent[1].submissionId,sent[2].submissionId);
  assert.equal(sent.filter(body=>body.variant.includes('rescue-v3')).length,1);assert.ok(sent.every(body=>body.runTicket.token===sent[0].runTicket.token));
  assert.ok(sent.every(body=>!JSON.stringify(body.metadata).includes(body.runTicket.token)));
  ranked.complete(value.runId);assert.equal(new RankedRuns({endpoint:'/runs',storage:saved,fetcher}).pending().length,0);
});
test('failed ticket acquisition preserves a complete result, and later submission can recover',async()=>{
  const saved=storage(),value=result();let online=false;
  const fetcher=async(_,request)=>{if(!online)throw Error('offline');const body=JSON.parse(request.body);return body.variant?{ok:true,json:async()=>({success:true})}:receipt(body);};
  let ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});ranked.save(value,'altman');
  let submission=new LeaderboardSubmission(value,{playerId:'player',fetcher,ticket:()=>ranked.ticket(value),onProgress:state=>ranked.progress(value.runId,state)});
  await assert.rejects(submission.submit('Player'),/kept here/);
  online=true;ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});const pending=ranked.pending()[0];assert.deepEqual(pending.result,value);
  submission=new LeaderboardSubmission(pending.result,{fetcher,state:pending,ticket:()=>ranked.ticket(value)});assert.equal((await submission.submit('Player')).complete,true);
});
test('storage restrictions do not interrupt a run or its current-tab submission',async()=>{
  const ranked=new RankedRuns({endpoint:'/runs',storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},fetcher:async(_,request)=>receipt(JSON.parse(request.body))});
  ranked.save(result(),'altman');assert.equal(ranked.pending().length,1);assert.ok((await ranked.ticket(result())).id);
});
test('accepting one saved run retains other unsubmitted results',()=>{
  const ranked=new RankedRuns({endpoint:'/runs',storage:storage()});ranked.save(result('first-run'),'altman');ranked.save(result('second-run'),'amodei');ranked.complete('second-run');assert.equal(ranked.pending().length,1);assert.equal(ranked.pending()[0].result.runId,'first-run');
});
test('independent game tabs retain each other\'s results and observe completed submissions',()=>{
  const saved=storage(),a=new RankedRuns({endpoint:'/runs',storage:saved}),b=new RankedRuns({endpoint:'/runs',storage:saved});
  a.save(result('tab-one-run'),'altman');b.save(result('tab-two-run'),'amodei');assert.equal(a.pending().length,2);assert.equal(b.pending().length,2);
  a.complete('tab-one-run');assert.equal(b.pending().length,1);assert.equal(b.pending()[0].result.runId,'tab-two-run');
});
