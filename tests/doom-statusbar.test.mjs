// Mugshot logic of the Doom status bar (ST_updateFaceWidget) used by p(DOOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import {FaceWidget,FACE_LUMPS,TICRATE,angleDiff,FACE_SETS,CEO_FACE_SETS,bodyFaceSets} from '../doom-web/doom-statusbar.js';

const idle={health:100,god:false,attackdown:false,attackerDiff:null,aimDiff:null};
function run(face,tics,input={}){const seen=[];for(let i=0;i<tics;i++){face.tick({...idle,...input});seen.push(face.lump);}return seen;}

test('face lumps follow Doom order: 5 pain levels x 8 faces, then god and dead',()=>{
  assert.equal(FACE_LUMPS.length,42);
  assert.deepEqual(FACE_LUMPS.slice(0,8),['STFST00','STFST01','STFST02','STFTR00','STFTL00','STFOUCH0','STFEVL0','STFKILL0']);
  assert.equal(FACE_LUMPS[40],'STFGOD0');assert.equal(FACE_LUMPS[41],'STFDEAD0');
});

test('idle face looks left, centre and right, changing every TICRATE/2 tics',()=>{
  const face=new FaceWidget(7),seen=run(face,17*30);
  assert.ok(seen.every(l=>/^STFST0[012]$/.test(l)));
  assert.equal(new Set(seen).size,3);
  for(let i=0;i<seen.length;i++)if(i%17)assert.equal(seen[i],seen[i-1],'holds for 17 tics');
});

test('pain level is floor((100 - health) * 5 / 101)',()=>{
  const face=new FaceWidget(1);
  for(const [health,level] of [[100,0],[80,0],[79,1],[70,1],[60,1],[59,2],[40,2],[39,3],[20,3],[19,4],[1,4]]){
    face.reset(health);assert.equal(face.painOffset(health)/8,level,`health ${health}`);
  }
  const hurt=new FaceWidget(3);run(hurt,1,{health:30});assert.match(hurt.lump,/^STFST3[012]$/);
});

test('big hit (> 20) shows ouch for a full second, even with an attacker',()=>{
  const face=new FaceWidget(2);run(face,5);
  face.hit(30,true);const seen=run(face,TICRATE+1,{health:70,attackerDiff:120});
  assert.ok(seen.slice(0,TICRATE).every(l=>l==='STFOUCH1'),seen.join());
  assert.match(seen[TICRATE],/^STFST1[012]$/);
});

test('small hit turns toward the attacker, or rampages when it is ahead',()=>{
  for(const [diff,lump] of [[90,'STFTL00'],[-90,'STFTR00'],[10,'STFKILL0'],[-30,'STFKILL0']]){
    const face=new FaceWidget(4);run(face,3);face.hit(10,true);
    const seen=run(face,TICRATE,{health:90,attackerDiff:diff});
    assert.ok(seen.every(l=>l===lump),`${diff}: ${seen.join()}`);
  }
});

test('damage without an attacker: ouch above 20, otherwise rampage',()=>{
  const a=new FaceWidget(5);run(a,2);a.hit(25,false);assert.equal(run(a,1,{health:75})[0],'STFOUCH1');
  const b=new FaceWidget(5);run(b,2);b.hit(5,false);assert.equal(run(b,1,{health:95})[0],'STFKILL0');
});

test('evil grin for two seconds after a rescue or pickup; dead face wins',()=>{
  const face=new FaceWidget(6);run(face,4);face.grin();
  const seen=run(face,2*TICRATE+1);
  assert.ok(seen.slice(0,2*TICRATE).every(l=>l==='STFEVL0'));assert.match(seen.at(-1),/^STFST0/);
  face.grin();run(face,3);assert.equal(run(face,1,{health:0})[0],'STFDEAD0');
});

test('rampage face after holding attack for 2 seconds, gone when released',()=>{
  const face=new FaceWidget(8),seen=run(face,2*TICRATE+3,{attackdown:true});
  assert.ok(seen.slice(0,2*TICRATE-1).every(l=>/^STFST0/.test(l)));
  assert.ok(seen.slice(2*TICRATE).every(l=>l==='STFKILL0'),seen.slice(2*TICRATE).join());
  assert.match(run(face,1)[0],/^STFST0/);
});

test('camera destroyed: brief rampage; a side aim turns the face toward the hunter',()=>{
  const face=new FaceWidget(9);run(face,2);face.camera();
  const seen=run(face,TICRATE+1);assert.ok(seen.slice(0,TICRATE).every(l=>l==='STFKILL0'));
  const aim=new FaceWidget(9);assert.ok(run(aim,40,{aimDiff:-100}).every(l=>l==='STFTR00'));
  const queued=new FaceWidget(9);run(queued,2);queued.grin();run(queued,2*TICRATE-20);queued.camera();
  const after=run(queued,40);assert.ok(after.slice(0,19).every(l=>l==='STFEVL0'));assert.ok(after.slice(21,40).every(l=>l==='STFKILL0'),'Camera rampage waits out a short grin (one idle tic between, as in Doom)');
  const ahead=new FaceWidget(9);assert.ok(run(ahead,40,{aimDiff:20}).every(l=>/^STFST0/.test(l)),'aim from ahead stays idle');
});

test('a lost body holds its dead face, then the new body starts fresh',()=>{
  const face=new FaceWidget(10);face.reset(60);face.die(50);
  const seen=run(face,52,{health:60});
  assert.ok(seen.slice(0,50).every(l=>l==='STFDEAD0'));assert.match(seen.at(-1),/^STFST1[012]$/);
});

test('angle difference is signed toward the left (counter-clockwise)',()=>{
  assert.equal(angleDiff(90,0),90);assert.equal(angleDiff(-90,0),-90);assert.equal(angleDiff(350,10),-20);assert.equal(angleDiff(10,350),20);assert.equal(Math.abs(angleDiff(180+720,0)),180);
});

test('your own body (controlled 0) wears the chosen CEO; companions keep their own sets',()=>{
  assert.deepEqual(CEO_FACE_SETS,['altman','amodei']);
  assert.deepEqual(bodyFaceSets('altman'),['samwise','liron','stuart','eliezer','hinton','holly']);
  assert.deepEqual(bodyFaceSets('amodei'),['mario','liron','stuart','eliezer','hinton','holly']);
  assert.deepEqual(bodyFaceSets('doomguy'),FACE_SETS,'?ceo=doomguy: the original mapping');
  assert.deepEqual(bodyFaceSets(undefined),FACE_SETS);assert.deepEqual(bodyFaceSets('sam'),FACE_SETS,'A companion is never body 0');
  assert.deepEqual(bodyFaceSets('altman','hal-station'),['samwise','rob','dan','nate','roman','beth']);
  const sets=bodyFaceSets('amodei');sets[0]='altman';assert.equal(bodyFaceSets('amodei')[0],'mario','Each call returns a fresh list');
});
