import {boardsForLevel} from './levels.js';

const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const frozen=o=>{for(const value of Object.values(o))if(value&&typeof value==='object')frozen(value);return Object.freeze(o);};
export function scoreRun(payload,level,{runId,practiceReason=''}){
  if(!level?.scored||payload.level_id!==level.id||payload.level_version!==level.version
    ||payload.score_version!==level.scoreVersion)throw Error('This result belongs to a different level or score version.');
  if(!int(payload.saved,0,level.peopleTotal)||payload.total!==level.peopleTotal
    ||!int(payload.active_tics,1,Number.MAX_SAFE_INTEGER)||payload.cameras_total!==level.camerasTotal
    ||!int(payload.cameras_broken,0,level.camerasTotal))throw Error('Incomplete native result.');
  const escaped=payload.outcome==='escaped'&&payload.saved>0;
  if(escaped&&!int(payload.p_doom_cover,1,99))throw Error('The escape outlook snapshot is missing.');
  if(!escaped&&payload.outcome!=='lost')throw Error('Unknown native outcome.');
  const v2=level.scoreVersion==='rescue-v2';
  const ceoConscious=v2?payload.ceo_state==='conscious':true;
  const figures=v2?payload.saved_figures:Math.max(0,payload.saved-1);
  if(v2&&(!int(figures,0,level.peopleTotal-1)||payload.saved!==figures+(ceoConscious&&escaped?1:0)
    ||!['conscious','carried','downed'].includes(payload.ceo_state)||payload.skill!==3
    ||!['cold','hub','replay'].includes(payload.entry)))throw Error('Incomplete v2 campaign result.');
  const activeMs=Math.round(payload.active_tics*1000/35);
  const bonus=escaped?{
    rescue:v2?figures*10000:payload.saved*10000,
    ...(v2?{ceo:ceoConscious?1000:0}:{}),cameras:payload.cameras_broken*250,
    speed:Math.round(2000*600/(600+payload.active_tics/35)),
    outlook:10*(100-payload.p_doom_cover)
  }:{rescue:0,cameras:0,speed:0,outlook:0};
  const reason=practiceReason||(v2&&(payload.entry!=='cold'||payload.retreat)?'Campaign return, replay or retreat.':payload.practice?'Development or cheat-assisted run.':'');
  const boards=boardsForLevel(level);
  const submissions=escaped&&!reason?[{variant:boards[0].variant,score:Object.values(bonus).reduce((a,b)=>a+b,0)}]:[];
  return frozen({runId,levelId:level.id,levelVersion:level.version,scoreVersion:level.scoreVersion,boardVersion:level.boardVersion,
    outcome:payload.outcome,saved:payload.saved,total:level.peopleTotal,lost:level.peopleTotal-payload.saved,
    savedFigures:figures,ceoState:v2?payload.ceo_state:'conscious',skill:v2?payload.skill:3,entry:v2?payload.entry:'cold',retreat:!!payload.retreat,
    camerasDestroyed:payload.cameras_broken,camerasTotal:level.camerasTotal,
    activeTics:payload.active_tics,activeMs,pDoomAtCoverOpen:escaped?payload.p_doom_cover:null,pDoomFinal:escaped?0:100,
    routes:Array.isArray(payload.routes)?payload.routes.slice(0,level.peopleTotal-1):[],
    breakdown:bonus,totalScore:Object.values(bonus).reduce((a,b)=>a+b,0),
    eligible:escaped&&!reason,practiceReason:reason,submissions});
}

// Native start and completion messages define a run. Telemetry never freezes it.
export class RunTracker{
  constructor(level,{uuid=()=>crypto.randomUUID()}={}){this.level=level;this.uuid=uuid;this.result=null;this.runId=null;this.practiceReason='';this.activeTics=0;this.coverDoom=null;}
  begin(native){
    if(native.level_id!==this.level?.id||native.level_version!==this.level.version)return;
    this.runId=this.uuid();this.result=null;this.practiceReason=native.practice?'Development run.':'';this.activeTics=0;this.coverDoom=null;
  }
  markPractice(reason){if(!this.result)this.practiceReason||=reason;}
  update(native){
    if(this.result||!this.runId)return;
    if(native.level_id!==this.level.id||native.level_version!==this.level.version)return;
    this.activeTics=native.active_tics;this.coverDoom=native.p_doom_cover>=0?native.p_doom_cover:null;
    if(native.practice)this.markPractice('Development or cheat-assisted run.');
  }
  finish(native){
    if(this.result)return this.result;
    if(!this.runId)throw Error('No native run start was received.');
    this.result=scoreRun(native,this.level,{runId:this.runId,practiceReason:this.practiceReason});
    this.activeTics=native.active_tics;this.coverDoom=this.result.pDoomAtCoverOpen;
    return this.result;
  }
  getState(){return {runId:this.runId,activeTics:this.activeTics,coverDoom:this.coverDoom,practiceReason:this.practiceReason,result:this.result};}
}

export function formatTime(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}.${String(Math.floor(ms%1000/10)).padStart(2,'0')}`;}
