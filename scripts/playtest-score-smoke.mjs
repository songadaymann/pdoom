// Mutating API tests run only against the local playtest Worker, never live.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5199';
const prefix='qa-'+crypto.randomUUID();
const body={slug:'pdoom',variant:'hal-station-rescue-v3',name:'Local QA',playerId:prefix,submissionId:prefix+':one',score:100,metadata:{localQA:true}};
const post=async data=>{const r=await fetch(base+'/api/v1/leaderboard',{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
assert.equal((await post(body)).status,200);
assert.equal((await post(body)).status,200);
assert.equal((await post({...body,score:101})).status,409);
assert.equal((await post({...body,submissionId:prefix+':two',score:150})).status,200);
const result=await (await fetch(base+'/api/v1/leaderboard?slug=pdoom&variant=hal-station-rescue-v3&limit=100')).json();
assert.equal(result.entries.filter(e=>e.name==='Local QA'&&e.metadata.localQA&&e.score===150).length,1);
assert.equal(result.entries.some(e=>e.score===100&&e.name==='Local QA'),false);
assert.equal((await post({...body,score:-1})).status,400);
assert.equal((await post({...body,name:' '})).status,400);
assert.equal((await post({...body,variant:'not-a-board'})).status,400);
assert.equal((await post({...body,metadata:{huge:'a'.repeat(7000)}})).status,413);
const blocked=await fetch(base+'/api/v1/leaderboard',{method:'POST',headers:{Origin:'https://elsewhere.example'},body:JSON.stringify(body)});assert.equal(blocked.status,403);
console.log('Local playtest score API PASS: persistence, idempotency, conflicts, best-run aggregation, validation, request bound, same-origin guard.');
