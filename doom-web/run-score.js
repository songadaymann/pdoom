// A level's native result (PDOOM_RESULT). Since 2026-11-07 the levels have no scores or boards of their own: the
// speedrun (speedrun.js) times the whole game. This only checks that a result belongs to the level being played
// and keeps what the meadow and the exit text read from it.
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const frozen=o=>{for(const value of Object.values(o))if(value&&typeof value==='object')frozen(value);return Object.freeze(o);};
export function readLevelResult(payload,level,{runId}){
  if(!level?.scored||payload.level_id!==level.id||payload.level_version!==level.version)throw Error('This result belongs to a different level.');
  if(!int(payload.saved,0,level.peopleTotal)||payload.total!==level.peopleTotal||!int(payload.active_tics,1,Number.MAX_SAFE_INTEGER))throw Error('Incomplete native result.');
  if(!['escaped','lost'].includes(payload.outcome))throw Error('Unknown native outcome.');
  const figures=int(payload.saved_figures,0,level.peopleTotal-1)?payload.saved_figures:Math.max(0,payload.saved-1);
  return frozen({runId,levelId:level.id,levelVersion:level.version,outcome:payload.outcome,saved:payload.saved,total:level.peopleTotal,
    savedFigures:figures,entry:['cold','hub','replay'].includes(payload.entry)?payload.entry:'cold',retreat:!!payload.retreat,
    camerasDestroyed:int(payload.cameras_broken,0,level.camerasTotal)?payload.cameras_broken:0,camerasTotal:level.camerasTotal,
    activeTics:payload.active_tics,activeMs:Math.round(payload.active_tics*1000/35),
    routes:Array.isArray(payload.routes)?payload.routes.slice(0,level.peopleTotal-1):[]});
}

// Native start and completion messages define one attempt at a level. Telemetry never freezes it.
export class RunTracker{
  constructor(level,{uuid=()=>crypto.randomUUID()}={}){this.level=level;this.uuid=uuid;this.result=null;this.runId=null;this.activeTics=0;}
  begin(native){
    if(native.level_id!==this.level?.id||native.level_version!==this.level.version)return;
    this.runId=this.uuid();this.result=null;this.activeTics=0;
  }
  update(native){
    if(this.result||!this.runId)return;
    if(native.level_id!==this.level.id||native.level_version!==this.level.version)return;
    this.activeTics=native.active_tics;
  }
  finish(native){
    if(this.result)return this.result;
    if(!this.runId)throw Error('No native run start was received.');
    this.result=readLevelResult(native,this.level,{runId:this.runId});this.activeTics=native.active_tics;
    return this.result;
  }
  getState(){return {runId:this.runId,activeTics:this.activeTics,result:this.result};}
}
