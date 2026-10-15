import {GAME_SLUG} from './levels.js';

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
    saved:result.saved,camerasDestroyed:result.camerasDestroyed,camerasTotal:result.camerasTotal,
    activeMs:result.activeMs,activeTics:result.activeTics,pDoomAtCoverOpen:result.pDoomAtCoverOpen,
    pDoomFinal:result.pDoomFinal,breakdown:result.breakdown,routes:result.routes};
  if(/^(altman|amodei|doomguy)$/.test(ceo||''))metadata.ceo=ceo;
  return result.submissions.map(board=>({slug:GAME_SLUG,variant:board.variant,name:clean,playerId,
    submissionId:`${result.runId}:${board.variant}`,score:board.score,metadata}));
}

// Retain the identical name and IDs after a partial success or uncertain response.
export class LeaderboardSubmission{
  constructor(result,{endpoint='/api/v1/leaderboard',fetcher=(...args)=>fetch(...args),playerId,ceo}={}){
    this.result=result;this.endpoint=endpoint;this.fetcher=fetcher;this.playerId=playerId;this.ceo=ceo;
    this.bodies=null;this.accepted=new Set();this.inflight=null;
  }
  submit(name){
    if(this.inflight)return this.inflight;
    this.bodies??=submissionBodies(this.result,name,this.playerId,{ceo:this.ceo});
    this.inflight=this.send().finally(()=>{this.inflight=null;});return this.inflight;
  }
  async send(){
    for(const body of this.bodies){
      if(this.accepted.has(body.variant))continue;
      const response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let data;try{data=await response.json();}catch{throw Error('No confirmation received. Retry to check this same score.');}
      if(!response.ok||data.success!==true)throw Error(data.error||'Leaderboard unavailable. Retry this score.');
      this.accepted.add(body.variant);
    }
    return {accepted:[...this.accepted],complete:this.accepted.size===this.bodies.length};
  }
}
