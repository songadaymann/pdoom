import test from 'node:test';
import assert from 'node:assert/strict';
import {RankedRuns} from '../doom-web/ranked-runs.js';
import {LeaderboardSubmission} from '../doom-web/leaderboard-client.js';
import {speedrunResult,cleanSpeedrun} from '../doom-web/speedrun.js';
import {localDevelopmentEnabled} from '../doom-web/dev-capabilities.js';

const storage=()=>{const data=new Map();return{get length(){return data.size;},key:index=>[...data.keys()][index]||null,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
const receipt=body=>({ok:true,json:async()=>({success:true,runId:body.runId,ticketId:'12345678-1234-1234-1234-123456789abc',expiresAt:Date.now()+1e9})});
const result=(id='run-fixture')=>speedrunResult(cleanSpeedrun({runId:id,splits:{'five-prisons':200000,'hal-station':250000,'meg3n-factory':300000,'agentic-pods':310000,'safe-mode':90000,endgame:500000},restarts:2,done:true}),{saved:20,ceo:'altman'});
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
test('failed submission and refresh retain the original name, IDs and result',async()=>{
  const saved=storage(),sent=[];let fail=true;
  const fetcher=async(_,request)=>{
    const body=JSON.parse(request.body);if(!body.variant)return receipt(body);
    sent.push(body);if(fail){fail=false;return {ok:false,json:async()=>({error:'Temporary outage'})};}
    return {ok:true,json:async()=>({success:true})};
  };
  let ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});const value=result();ranked.save(value,'amodei');
  const create=()=>new LeaderboardSubmission(value,{endpoint:'/boards',fetcher,playerId:'original-player',ceo:'amodei',ticket:()=>ranked.ticket(value),state:ranked.pending()[0],onProgress:state=>ranked.progress(value.runId,state)});
  let submission=create();await assert.rejects(submission.submit('Original'),/Temporary outage/);
  ranked=new RankedRuns({endpoint:'/runs',storage:saved,fetcher});submission=create();const accepted=await submission.submit('Changed after reload');
  assert.equal(accepted.complete,true);assert.equal(sent.length,2);assert.ok(sent.every(body=>body.name==='Original'));assert.equal(sent[0].submissionId,sent[1].submissionId);
  assert.ok(sent.every(body=>body.variant==='campaign-speedrun-v1'));assert.ok(sent.every(body=>body.runTicket.token===sent[0].runTicket.token));
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
test('results saved for the retired per-level boards are never resent; a submitted run is not queued again',async()=>{
  const value=result('fresh-run'),old={slug:'pdoom',variant:'five-prisons-rescue-v3',name:'Old',playerId:'p',submissionId:'fresh-run:five-prisons-rescue-v3',score:55200,metadata:{}};
  const sent=[];const restored=new LeaderboardSubmission(value,{playerId:'player',state:{bodies:[old],accepted:['five-prisons-rescue-v3']},fetcher:async(_,request)=>{sent.push(JSON.parse(request.body));return{ok:true,json:async()=>({success:true})};}});
  assert.equal(restored.bodies,null);assert.equal(restored.accepted.size,0);
  assert.equal((await restored.submit('New name')).complete,true);assert.equal(sent.length,1);assert.equal(sent[0].variant,'campaign-speedrun-v1');
  const ranked=new RankedRuns({endpoint:'/runs',storage:storage()});ranked.save(value,'altman');ranked.complete(value.runId);
  assert.equal(ranked.submitted(value.runId),true);assert.equal(ranked.save(value,'altman'),null);assert.equal(ranked.pending().length,0);
});
test('a run the server holds for review completes without retrying and reports the hold',async()=>{
  const value=result('held-run'),sent=[];
  const submission=new LeaderboardSubmission(value,{playerId:'player',fetcher:async(_,request)=>{sent.push(JSON.parse(request.body));return {ok:true,json:async()=>({success:true,held:true,rank:null})};}});
  const outcome=await submission.submit('Fast player');assert.equal(outcome.complete,true);assert.deepEqual(outcome.held,['campaign-speedrun-v1']);
  assert.deepEqual(await submission.submit('Fast player'),{accepted:['campaign-speedrun-v1'],held:['campaign-speedrun-v1'],complete:true});assert.equal(sent.length,1);
});
test('a run carries an optional video link, and the browser that played it can add or change one later (2026-11-09)',async()=>{
  const saved=storage(),calls=[];
  const fetcher=async(url,request)=>{const body=JSON.parse(request.body);calls.push({url,body});
    if(url==='/runs')return receipt(body);
    if(url==='/runs/video')return {ok:true,json:async()=>({success:true,videoUrl:body.videoUrl||null,held:true})};
    return {ok:true,json:async()=>({success:true,held:true,entry:{metadata:{review:['top-ten']}}})};};
  const ranked=new RankedRuns({endpoint:'/runs',storage:saved,makeNonce:()=>'b'.repeat(64),fetcher});
  const run=result('run-video');ranked.save(run,'altman');
  await assert.rejects(ranked.attachVideo('run-video','https://youtu.be/x'),/submitted run/,'not before the time is in');
  const submission=new LeaderboardSubmission(run,{endpoint:'/board',fetcher,playerId:'p',ticket:()=>ranked.ticket(run)});
  assert.throws(()=>new LeaderboardSubmission(run,{fetcher}).submit('P',{videoUrl:'ftp://nope'}),/https link/);
  const outcome=await submission.submit('Speedy',{videoUrl:' https://youtu.be/abc '});
  assert.deepEqual(outcome.held,['campaign-speedrun-v1']);assert.deepEqual(outcome.review,['top-ten']);
  const sent=calls.find(c=>c.url==='/board').body;assert.equal(sent.videoUrl,'https://youtu.be/abc');assert.equal('videoUrl' in sent.metadata,false,'not part of the time');
  ranked.complete('run-video',{videoUrl:sent.videoUrl});assert.equal(ranked.video('run-video'),'https://youtu.be/abc');
  const later=await ranked.attachVideo('run-video','https://vimeo.com/7');
  const call=calls.at(-1);assert.equal(call.url,'/runs/video');assert.deepEqual(call.body,{runTicket:{id:'12345678-1234-1234-1234-123456789abc',token:'b'.repeat(64)},videoUrl:'https://vimeo.com/7'});
  assert.equal(later.held,true);assert.equal(new RankedRuns({endpoint:'/runs',storage:saved}).video('run-video'),'https://vimeo.com/7','kept after a reload');
  await ranked.attachVideo('run-video','');assert.equal(ranked.video('run-video'),'','cleared');
  const none=new LeaderboardSubmission(result('run-plain'),{fetcher});assert.equal('videoUrl' in (await none.submit('P'),none.bodies[0]),false,'no link: no field');
});
test('the player credential goes with the time, but is never kept with the saved submission (2026-11-09)',async()=>{
  const sent=[],kept=[],secret='s'.repeat(43);
  const fetcher=async(url,request)=>{sent.push(JSON.parse(request.body));return {ok:true,json:async()=>({success:true,rank:1})};};
  const signedIn=new LeaderboardSubmission(result('run-credential'),{fetcher,playerId:'p',credential:async()=>secret,onProgress:state=>kept.push(JSON.stringify(state))});
  await signedIn.submit('Speedy');
  assert.equal(sent[0].playerSecret,secret);assert.ok(kept.every(state=>!state.includes(secret)),'not in the saved bodies');assert.equal(signedIn.bodies[0].playerSecret,undefined);
  const anonymous=new LeaderboardSubmission(result('run-no-shell'),{fetcher,credential:async()=>{throw Error('no shell');}});
  await anonymous.submit('P');assert.equal('playerSecret' in sent[1],false,'no shell: anonymous');
});
