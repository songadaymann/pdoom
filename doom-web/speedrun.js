// The whole-game speedrun (2026-11-07, Jonathan: "Let's just make it a speed run thing: One single leaderboard
// that measures how fast people can beat the game."). It replaces the four per-level rescue-score boards.
//
// One clock runs from the moment a new campaign's first level starts to the moment the MCP goes down on the
// endgame page (prototypes/endgame/mode-boss.ts). It lives in the campaign save (campaign.js, `speedrun`), so it
// survives reloads, Load Game and the trip to the endgame page, and it never goes backwards. It counts game time:
//  - in a level, that level's own clock (PDOOM_RUN active_tics), which stops for menus, story cards and panels;
//  - in SAFE MODE, the meadow's clock (doom-outside.ts clock()), which stops while it's paused or hidden;
//  - in the endgame, the fight page's own frame time.
// Films, loading screens and menus never count. Restarts (someone lost, caught, F5) don't stop it: they're the cost.
export const SPEEDRUN=Object.freeze({levelId:'campaign',levelVersion:'campaign-v1',scoreVersion:'speedrun-v1',boardVersion:'v1'});
export const SPEEDRUN_BOARD=Object.freeze({variant:'campaign-speedrun-v1',label:'Speedrun',metric:'activeMs',metricLabel:'Time',
  direction:'asc',display:'time-ms',aggregation:'player-best'});
// The splits, in the order the results card lists them. The levels can be played in any order after the first.
export const SPLITS=Object.freeze(['five-prisons','hal-station','meg3n-factory','agentic-pods','safe-mode','endgame']);
export const SPLIT_LABELS=Object.freeze({'five-prisons':'Level 1','hal-station':'Level 2','meg3n-factory':'Level 3','agentic-pods':'Level 4','safe-mode':'SAFE MODE','endgame':'Endgame'});
export const PEOPLE_TOTAL=20;
const MAX_SPLIT=86_400_000,RUN_ID=/^[a-zA-Z0-9._-]{8,64}$/;
const count=n=>{let c=0;for(let m=n|0;m;m&=m-1)c++;return c;};

export function cleanSpeedrun(value){
  if(!value||typeof value!=='object'||typeof value.runId!=='string'||!RUN_ID.test(value.runId))return null;
  const splits=Object.fromEntries(SPLITS.map(key=>{const ms=value.splits?.[key];return [key,Number.isSafeInteger(ms)&&ms>=0?Math.min(MAX_SPLIT,ms):0];}));
  return {runId:value.runId,splits,restarts:Number.isSafeInteger(value.restarts)&&value.restarts>=0?value.restarts:0,
    practice:typeof value.practice==='string'?value.practice.slice(0,120):'',done:value.done===true,
    startedAt:Number.isFinite(value.startedAt)?value.startedAt:0};
}
export function newSpeedrun(uuid=()=>crypto.randomUUID(),now=Date.now()){return cleanSpeedrun({runId:uuid(),startedAt:now});}
export function speedrunMs(run){return SPLITS.reduce((sum,key)=>sum+(run?.splits?.[key]||0),0);}
// A campaign nobody has played yet: the only kind a speedrun can start in.
export function freshCampaign(data){return !!data&&!data.hub&&!data.endgame&&[0,1,2,3].every(i=>!data['saved'+i]);}
export function savedCount(data){return [0,1,2,3].reduce((sum,i)=>sum+count(data?.['saved'+i]),0);}

// The finished run, as the results card and the leaderboard submission see it.
export function speedrunResult(run,{saved=PEOPLE_TOTAL,ceo=null}={}){
  const activeMs=speedrunMs(run),missing=SPLITS.filter(key=>key!=='safe-mode'&&!run.splits[key]);
  const practiceReason=run.practice||(saved!==PEOPLE_TOTAL?'Not everyone came home.':'')
    ||(missing.length?`No time for ${missing.map(key=>SPLIT_LABELS[key]).join(', ')}.`:'')||(!run.done?'The run is not finished.':'');
  return Object.freeze({...SPEEDRUN,runId:run.runId,outcome:'complete',saved,total:PEOPLE_TOTAL,activeMs,
    splits:Object.freeze({...run.splits}),restarts:run.restarts,ceo:/^(altman|amodei)$/.test(ceo||'')?ceo:null,
    eligible:!practiceReason,practiceReason});
}

// The campaign page's side of the clock: levels and SAFE MODE. The endgame page adds its own split.
export class SpeedrunClock{
  constructor(campaign,{uuid=()=>crypto.randomUUID(),now=()=>Date.now()}={}){
    this.campaign=campaign;this.uuid=uuid;this.now=now;
    this.levelId=null;this.lastTics=0;this.visit=null;this.meadowAt=null;this.carry={};this.savedAt=0;this.dirty=false;
  }
  get run(){return this.campaign?.data?.speedrun||null;}
  get running(){const run=this.run;return !!run&&!run.done;}
  setCampaign(campaign){this.flush();this.campaign=campaign;this.levelId=null;this.lastTics=0;this.visit=null;this.meadowAt=null;this.carry={};}
  // A level's PDOOM_RUN_START. A new campaign's first level starts the run; the same level starting again
  // in one visit is a restart.
  begin(levelId,{assisted=false,practice=''}={}){
    if(!SPLITS.includes(levelId))return;
    if(!this.run&&freshCampaign(this.campaign?.data)){this.campaign.data.speedrun=newSpeedrun(this.uuid,this.now());this.dirty=true;}
    const run=this.run;this.levelId=levelId;this.lastTics=0;
    if(!run||run.done)return;
    if(this.visit===levelId){run.restarts++;this.dirty=true;}
    this.visit=levelId;this.mark({assisted,practice});this.flush(true);
  }
  // PDOOM_RUN / PDOOM_RESULT: the level's clock, in tics since this attempt began.
  level(levelId,tics,{assisted=false}={}){
    if(levelId!==this.levelId||!Number.isSafeInteger(tics)||tics<0)return;
    const delta=tics>=this.lastTics?tics-this.lastTics:tics;this.lastTics=tics;
    this.mark({assisted});this.add(levelId,delta*1000/35);
  }
  // Out of the level and into SAFE MODE: the next visit to any level is a new visit.
  leaveLevel(){this.levelId=null;this.lastTics=0;this.visit=null;this.flush(true);}
  // Each frame, the meadow's own clock in seconds (it stops while paused or hidden). null: no meadow now.
  meadow(seconds){
    if(seconds==null||!Number.isFinite(seconds)){this.meadowAt=null;return;}
    if(this.meadowAt!=null&&seconds>this.meadowAt)this.add('safe-mode',Math.min(1,seconds-this.meadowAt)*1000);
    this.meadowAt=seconds;
  }
  mark({assisted=false,practice=''}={}){
    const run=this.run;if(!run||run.done||run.practice)return;
    const reason=practice||(assisted?'Cheats or a QA shortcut were used.':'');
    if(reason){run.practice=reason;this.dirty=true;}
  }
  add(key,ms){
    const run=this.run;if(!run||run.done||!(ms>0))return;
    const total=(this.carry[key]||0)+ms,whole=Math.floor(total);this.carry[key]=total-whole;
    if(whole){run.splits[key]=Math.min(MAX_SPLIT,run.splits[key]+whole);this.dirty=true;}
    this.flush();
  }
  // Written every couple of seconds, and right away at the moments that matter.
  flush(force=false){
    if(!this.dirty||!this.campaign)return;
    const t=this.now();if(!force&&t-this.savedAt<2000)return;
    this.savedAt=t;this.dirty=false;this.campaign.persist();
  }
  getState(){const run=this.run;return run?{runId:run.runId,ms:speedrunMs(run),splits:{...run.splits},restarts:run.restarts,practice:run.practice,done:run.done,level:this.levelId}:null;}
}

export function formatRunTime(ms){
  const total=Math.max(0,Math.floor(ms)),h=Math.floor(total/3_600_000),m=Math.floor(total/60_000)%60,s=Math.floor(total/1000)%60,cs=Math.floor(total%1000/10);
  const two=n=>String(n).padStart(2,'0');
  return `${h?h+':'+two(m):m}:${two(s)}.${two(cs)}`;
}
