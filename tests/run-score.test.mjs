import test from 'node:test';
import assert from 'node:assert/strict';
import {readLevelResult,RunTracker} from '../doom-web/run-score.js';
import {getLevel,LEVELS,SPEEDRUN_BOARD} from '../doom-web/levels.js';
import {SpeedrunClock,SPEEDRUN,SPLITS,speedrunResult,speedrunMs,freshCampaign,savedCount,cleanSpeedrun,formatRunTime} from '../doom-web/speedrun.js';
import {submissionBodies} from '../doom-web/leaderboard-client.js';
import {Campaign,CAMPAIGN_KEY} from '../doom-web/campaign.js';

const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const native=(level,o={})=>({level_id:level.id,level_version:level.version,outcome:'escaped',saved:6,total:6,saved_figures:5,entry:'cold',retreat:0,active_tics:21000,cameras_broken:9,cameras_total:level.camerasTotal,routes:['a','b','c','d','e','extra'],...o});

test('a level result belongs to its level and keeps what the meadow reads, with no score',()=>{
  for(const level of LEVELS.filter(l=>l.scored)){
    const result=readLevelResult(native(level),level,{runId:'attempt-1'});
    assert.equal(result.levelId,level.id);assert.equal(result.savedFigures,5);assert.equal(result.activeMs,600000);assert.equal(result.routes.length,5);
    assert.equal('totalScore' in result||'submissions' in result||'eligible' in result,false);
  }
  const level=getLevel();
  assert.throws(()=>readLevelResult(native(level,{level_version:'old'}),level,{runId:'x'}),/different level/);
  assert.throws(()=>readLevelResult(native(level,{saved:7}),level,{runId:'x'}),/Incomplete/);
  assert.throws(()=>readLevelResult(native(level,{outcome:'won'}),level,{runId:'x'}),/Unknown/);
  const tracker=new RunTracker(level,{uuid:()=>'attempt-2'});assert.throws(()=>tracker.finish(native(level)),/No native run start/);
  tracker.begin({level_id:level.id,level_version:level.version});tracker.update({level_id:level.id,level_version:level.version,active_tics:40});
  assert.equal(tracker.getState().activeTics,40);assert.equal(tracker.finish(native(level)).runId,'attempt-2');
});

test('one speedrun board: the whole game, fastest first, in milliseconds',()=>{
  assert.deepEqual({...SPEEDRUN_BOARD},{variant:'campaign-speedrun-v1',label:'Speedrun',metric:'activeMs',metricLabel:'Time',direction:'asc',display:'time-ms',aggregation:'player-best'});
  assert.deepEqual({...SPEEDRUN},{levelId:'campaign',levelVersion:'campaign-v1',scoreVersion:'speedrun-v1',boardVersion:'v1'});
  assert.deepEqual(SPLITS.slice(0,4),LEVELS.filter(l=>l.scored).map(l=>l.id),'one split per campaign level');
  assert.equal(formatRunTime(0),'0:00.00');assert.equal(formatRunTime(61_234),'1:01.23');assert.equal(formatRunTime(3_723_450),'1:02:03.45');
});

test('only a fresh campaign starts a run; its levels, restarts and the meadow add up',()=>{
  const storage=memory(),campaign=new Campaign(storage,'altman');let t=0,ids=0;
  const clock=new SpeedrunClock(campaign,{uuid:()=>`run-${++ids}-fixture`,now:()=>t});
  assert.equal(freshCampaign(campaign.data),true);
  clock.begin('five-prisons');assert.equal(clock.run.runId,'run-1-fixture');assert.ok(storage.data.has(CAMPAIGN_KEY),'written at once');
  clock.level('five-prisons',35);clock.level('five-prisons',70);
  // someone was lost: the level restarts and its own clock starts again from zero
  clock.begin('five-prisons');clock.level('five-prisons',35);
  assert.equal(clock.run.restarts,1);assert.equal(clock.run.splits['five-prisons'],3000);
  // reports for another level, or before that level's start, don't count
  clock.level('hal-station',350);assert.equal(clock.run.splits['hal-station'],0);
  clock.leaveLevel();
  clock.meadow(10);clock.meadow(10.5);clock.meadow(null);clock.meadow(50);clock.meadow(50.25);clock.meadow(99);// a jump counts at most one second
  assert.equal(clock.run.splits['safe-mode'],500+250+1000);
  clock.begin('hal-station');clock.level('hal-station',35);assert.equal(clock.run.restarts,1,'a new visit is not a restart');
  assert.equal(speedrunMs(clock.run),3000+1750+1000);
  t=10_000;clock.flush();
  const reloaded=new Campaign(storage,'altman');assert.deepEqual(reloaded.data.speedrun,clock.run,'the save carries it across pages');
  // an older save, already in SAFE MODE without a run, never starts one
  const old=memory();old.setItem(CAMPAIGN_KEY,JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31}));
  const later=new SpeedrunClock(new Campaign(old,'altman'));later.begin('hal-station');assert.equal(later.run,null);
});

test('cheats or QA shortcuts make the run practice; it never goes backwards or past done',()=>{
  const campaign=new Campaign(memory(),'amodei'),clock=new SpeedrunClock(campaign,{uuid:()=>'run-practice-1'});
  clock.begin('agentic-pods');clock.level('agentic-pods',350,{assisted:true});assert.match(clock.run.practice,/Cheats/);
  clock.level('agentic-pods',100);assert.equal(clock.run.splits['agentic-pods'],10000+Math.floor(100000/35),'a lower count is a new attempt, never a rewind');
  clock.run.done=true;clock.level('agentic-pods',1000);clock.meadow(1);clock.meadow(2);
  assert.equal(clock.run.splits['agentic-pods'],10000+2857);assert.equal(clock.run.splits['safe-mode'],0);
});

test('the finished run is rankable only with everyone home and every part timed',()=>{
  const run=cleanSpeedrun({runId:'run-finished-1',splits:{'five-prisons':200000,'hal-station':250000,'meg3n-factory':300000,'agentic-pods':310000,'safe-mode':90000,endgame:500000},restarts:3,done:true});
  const result=speedrunResult(run,{saved:20,ceo:'amodei'});
  assert.equal(result.eligible,true);assert.equal(result.activeMs,1650000);assert.equal(result.restarts,3);assert.equal(result.ceo,'amodei');
  assert.match(speedrunResult(run,{saved:19}).practiceReason,/everyone/);
  assert.match(speedrunResult({...run,done:false},{saved:20}).practiceReason,/not finished/);
  assert.match(speedrunResult({...run,splits:{...run.splits,endgame:0}},{saved:20}).practiceReason,/Endgame/);
  assert.match(speedrunResult({...run,practice:'Development ending selected.'},{saved:20}).practiceReason,/Development/);
  const [body]=submissionBodies(result,' Speedy ','player-1');
  assert.equal(body.variant,'campaign-speedrun-v1');assert.equal(body.submissionId,'run-finished-1:campaign-speedrun-v1');assert.equal(body.score,1650000);assert.equal(body.name,'Speedy');
  assert.deepEqual(body.metadata,{...SPEEDRUN,outcome:'complete',practice:false,saved:20,total:20,activeMs:1650000,splits:{...run.splits},restarts:3,ceo:'amodei'});
  assert.equal('ceo' in submissionBodies(speedrunResult(run,{saved:20}),'P','id')[0].metadata,false,'no hero: left out, never null');
  assert.throws(()=>submissionBodies(speedrunResult(run,{saved:19}),'P','id'),/everyone/);
  assert.throws(()=>submissionBodies({...result,scoreVersion:'rescue-v2'},'P','id'),/current leaderboard/);
});

test('nobody stays lost: lost masks are dropped from saves and commits',()=>{
  const storage=memory();storage.setItem(CAMPAIGN_KEY,JSON.stringify({version:1,ceo:'altman',hub:true,saved0:3,lost0:4,following0:24}));
  const campaign=new Campaign(storage,'altman');assert.equal(campaign.data.lost0,0);assert.equal(campaign.getState().lost,0);
  assert.equal(campaign.roster()[2].state,'imprisoned','an old save\'s lost person is back in their cell');
  campaign.commit({saved0:3,lost0:4,following0:8,saved1:1,lost1:2,following1:0});
  assert.equal(campaign.data.lost0,0);assert.equal(campaign.data.lost1,0);assert.equal(campaign.data.following0,8);assert.equal(savedCount(campaign.data),3);
  assert.match(campaign.bootArgs().join(' '),/pdoom_lost0 0 .*pdoom_lost1 0/);
});
