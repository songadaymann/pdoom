// CHOOSE YOUR CEO: how the launcher decides which CEO is preselected, and how the
// choice survives a reload or Restart (doom-web/ceo-pick.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {CEOS,CEO_STORAGE_KEY,parseCeo,readCeo,rememberCeo,resolveCeo,restartUrl} from '../doom-web/ceo-pick.js';
import {getLevel} from '../doom-web/levels.js';
import {scoreRun} from '../doom-web/run-score.js';
import {submissionBodies,LeaderboardSubmission} from '../doom-web/leaderboard-client.js';

function memory(){const data=new Map();return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),data};}
const throwing={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');}};

test('both CEOs are offered, alphabetically; the QA face only by URL',()=>{
  assert.deepEqual(CEOS,['altman','amodei']);
  assert.equal(parseCeo('Altman'),'altman');assert.equal(parseCeo(' amodei '),'amodei');
  assert.equal(parseCeo('doomguy'),null);assert.equal(parseCeo('doomguy',{qa:true}),'doomguy');
  for(const bad of ['', 'sam', 'musk', null, undefined, 'altman;'])assert.equal(parseCeo(bad,{qa:true}),null,String(bad));
});

test('?ceo= overrides the remembered choice; ?ceo=doomguy is accepted for QA',()=>{
  const storage=memory();rememberCeo(storage,'altman');
  assert.deepEqual(resolveCeo({search:'?ceo=amodei',storage}),{id:'amodei',source:'url'});
  assert.deepEqual(resolveCeo({search:'?level=rescue&ceo=doomguy',storage}),{id:'doomguy',source:'url'});
  assert.deepEqual(resolveCeo({search:'?ceo=nobody',storage}),{id:'altman',source:'stored'},'An unknown value falls through');
});

test('the remembered choice is preselected; otherwise one at random per boot',()=>{
  const storage=memory();
  assert.deepEqual(resolveCeo({storage,random:()=>0.1}),{id:'altman',source:'random'});
  assert.deepEqual(resolveCeo({storage,random:()=>0.9}),{id:'amodei',source:'random'});
  assert.equal(resolveCeo({storage,random:()=>0.999999}).id,'amodei');
  assert.equal(resolveCeo({storage,random:()=>1}).id,'amodei','Out-of-range random stays in range');
  assert.equal(resolveCeo({storage,random:()=>NaN}).id,'altman');
  const seen=new Set();for(let i=0;i<64;i++)seen.add(resolveCeo({storage}).id);
  assert.deepEqual([...seen].sort(),CEOS,'Math.random reaches both');
  assert.equal(rememberCeo(storage,'amodei'),true);assert.equal(storage.data.get(CEO_STORAGE_KEY),'amodei');
  assert.deepEqual(resolveCeo({storage,random:()=>0}),{id:'amodei',source:'stored'});
});

test('storage that throws or is missing never breaks the choice',()=>{
  for(const storage of [throwing,null,undefined,{}]){
    assert.equal(readCeo(storage),null);assert.equal(rememberCeo(storage,'altman'),false);
    assert.equal(resolveCeo({storage,random:()=>0.7}).id,'amodei');
  }
  const corrupt=memory();corrupt.setItem(CEO_STORAGE_KEY,'<script>');assert.equal(readCeo(corrupt),null);
  assert.equal(rememberCeo(memory(),'doomguy'),false,'The QA face is never remembered');
});

test('Restart keeps the CEO: a plain reload when remembered, else the choice rides in the URL',()=>{
  const storage=memory();rememberCeo(storage,'amodei');
  assert.equal(restartUrl('http://127.0.0.1:5198/?dev=end','amodei',storage),null);
  assert.equal(restartUrl('http://127.0.0.1:5198/?ceo=altman','altman',throwing),null);
  assert.equal(restartUrl('http://127.0.0.1:5198/?dev=end','altman',throwing),'http://127.0.0.1:5198/?dev=end&ceo=altman');
  assert.equal(restartUrl('http://127.0.0.1:5198/?ceo=amodei','altman',throwing),'http://127.0.0.1:5198/?ceo=altman');
  assert.equal(restartUrl('http://127.0.0.1:5198/?ceo=doomguy','doomguy',storage),null);
});

test('the CEO is free-form run metadata only: never in the score, board or submission identity',async()=>{
  const level=getLevel(),result=scoreRun({level_id:level.id,level_version:level.version,score_version:level.scoreVersion,outcome:'escaped',saved:6,total:6,
    saved_figures:5,ceo_state:'conscious',skill:3,entry:'cold',retreat:0,active_tics:21000,p_doom_cover:5,cameras_broken:9,cameras_total:9,practice:0,routes:['vent']},level,{runId:'run-ceo'});
  const plain=submissionBodies(result,'Player','id-1'),tagged=submissionBodies(result,'Player','id-1',{ceo:'amodei'});
  assert.equal(plain[0].metadata.ceo,undefined,'No CEO given: payload unchanged');
  assert.deepEqual(tagged.map(({metadata,...body})=>body),plain.map(({metadata,...body})=>body),'Same slug, variant, score and submission ids');
  assert.deepEqual(tagged.map(b=>{const {ceo,...rest}=b.metadata;return rest;}),plain.map(b=>b.metadata));
  assert.ok(tagged.every(b=>b.metadata.ceo==='amodei'));
  assert.equal(submissionBodies(result,'Player','id-1',{ceo:'<b>'})[0].metadata.ceo,undefined,'Only known ids are recorded');
  const sent=[];const submission=new LeaderboardSubmission(result,{playerId:'id-2',ceo:'altman',fetcher:async(url,init)=>{sent.push(JSON.parse(init.body));return {ok:true,json:async()=>({success:true})};}});
  await submission.submit('Player');assert.ok(sent.length===3&&sent.every(b=>b.metadata.ceo==='altman'));
});
