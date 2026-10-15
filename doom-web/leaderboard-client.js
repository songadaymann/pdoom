import {GAME_SLUG,getLevel,boardsForLevel} from './levels.js';

const currentVariants=result=>new Set(boardsForLevel(getLevel(result.levelId)).map(board=>board.variant));

export function stablePlayer(storage,uuid=()=>crypto.randomUUID()){
  try{let id=storage.getItem('pdoom-player-v1');if(!id){id=uuid();storage.setItem('pdoom-player-v1',id);}return id;}
  catch{return uuid();}
}
// ceo: free-form run metadata only (GAME-SPEC §5.4, TEAM SAM vs TEAM DARIO); it
// is not part of the score, the board or the submission identity.
export function submissionBodies(result,name,playerId,{ceo}={}){
  const clean=name.trim();
  if(!clean||clean.length>32)throw Error('Enter a name of 1–32 characters.');
  if(!result.eligible)throw Error(result.practiceReason||'Only completed escapes can be submitted.');
  const metadata={levelId:result.levelId,levelVersion:result.levelVersion,scoreVersion:result.scoreVersion,boardVersion:result.boardVersion,
    savedFigures:result.savedFigures,ceoState:result.ceoState,skill:result.skill,entry:result.entry,retreat:result.retreat,
    outcome:result.outcome,practice:!result.eligible,saved:result.saved,total:result.total,camerasDestroyed:result.camerasDestroyed,camerasTotal:result.camerasTotal,
    activeMs:result.activeMs,activeTics:result.activeTics,pDoomAtCoverOpen:result.pDoomAtCoverOpen,
    pDoomFinal:result.pDoomFinal,breakdown:result.breakdown,routes:result.routes};
  if(/^(altman|amodei|doomguy)$/.test(ceo||''))metadata.ceo=ceo;
  const variants=currentVariants(result),boards=result.submissions.filter(board=>variants.has(board.variant));
  if(!boards.length)throw Error('This result does not have a current leaderboard.');
  return boards.map(board=>({slug:GAME_SLUG,variant:board.variant,name:clean,playerId,
    submissionId:`${result.runId}:${board.variant}`,score:board.score,metadata}));
}

// Retain the identical name and IDs after a partial success or uncertain response.
export class LeaderboardSubmission{
  constructor(result,{endpoint='/api/v1/leaderboard',fetcher=(...args)=>fetch(...args),playerId,ceo,ticket=async()=>null,state,onProgress=()=>{}}={}){
    this.result=result;this.endpoint=endpoint;this.fetcher=fetcher;this.playerId=playerId;this.ceo=ceo;
    // Old saved results may still include retired time boards. Keep the frozen
    // total-score body, name and receipt without retrying removed categories.
    const variants=currentVariants(result),bodies=state?.bodies?.filter(body=>variants.has(body.variant));
    this.bodies=bodies?.length?bodies:null;this.accepted=new Set((state?.accepted||[]).filter(variant=>variants.has(variant)));this.inflight=null;this.ticket=ticket;this.onProgress=onProgress;
  }
  submit(name){
    if(this.inflight)return this.inflight;
    this.bodies??=submissionBodies(this.result,name,this.playerId,{ceo:this.ceo});
    this.onProgress({bodies:this.bodies,accepted:[...this.accepted]});
    this.inflight=this.send().finally(()=>{this.inflight=null;});return this.inflight;
  }
  async send(){
    if(this.bodies.every(body=>this.accepted.has(body.variant)))return {accepted:[...this.accepted],complete:true};
    const runTicket=await this.ticket();
    for(const body of this.bodies){
      if(this.accepted.has(body.variant))continue;
      const response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...(runTicket?{runTicket}:{})})});
      let data;try{data=await response.json();}catch{throw Error('No confirmation received. Retry to check this same score.');}
      if(!response.ok||data.success!==true)throw Error(data.error||'Leaderboard unavailable. Retry this score.');
      this.accepted.add(body.variant);
      this.onProgress({bodies:this.bodies,accepted:[...this.accepted]});
    }
    return {accepted:[...this.accepted],complete:this.accepted.size===this.bodies.length};
  }
}
