import {GAME_SLUG} from './levels.js';
import {SPEEDRUN,SPEEDRUN_BOARD,SPLITS} from './speedrun.js';

// One board since 2026-11-07: the whole-game speedrun. Older saved results (the per-level rescue boards) have
// no current board and are never resent.
const currentVariants=()=>new Set([SPEEDRUN_BOARD.variant]);

export function stablePlayer(storage,uuid=()=>crypto.randomUUID()){
  try{let id=storage.getItem('pdoom-player-v1');if(!id){id=uuid();storage.setItem('pdoom-player-v1',id);}return id;}
  catch{return uuid();}
}
// ceo: free-form run metadata only (GAME-SPEC §5.4, TEAM SAM vs TEAM DARIO); it is not part of the time, the
// board or the submission identity. Left out, never null, when unknown (the server rejects null).
// videoUrl (2026-11-09): an optional link to the run's recording (Jonathan's challenge is judged on screen
// recordings). The server takes https links to the usual video sites; it isn't part of the time.
export function cleanVideoLink(value){
  const text=String(value??'').trim();if(!text)return '';
  let url;try{url=new URL(text);}catch{throw Error('That doesn\'t look like a link.');}
  if(url.protocol!=='https:'||text.length>300)throw Error('Use an https link to your recording (YouTube, Twitch, Vimeo, Google Drive…).');
  return url.toString();
}
export function submissionBodies(result,name,playerId,{ceo,videoUrl}={}){
  const clean=name.trim();
  if(!clean||clean.length>32)throw Error('Enter a name of 1–32 characters.');
  if(result?.scoreVersion!==SPEEDRUN.scoreVersion||result.levelId!==SPEEDRUN.levelId)throw Error('This result does not have a current leaderboard.');
  if(!result.eligible)throw Error(result.practiceReason||'Only a finished speedrun can be submitted.');
  const metadata={...SPEEDRUN,outcome:'complete',practice:false,saved:result.saved,total:result.total,activeMs:result.activeMs,
    splits:Object.fromEntries(SPLITS.map(key=>[key,result.splits[key]])),restarts:result.restarts};
  const hero=ceo??result.ceo;if(/^(altman|amodei)$/.test(hero||''))metadata.ceo=hero;
  const video=cleanVideoLink(videoUrl);
  return [{slug:GAME_SLUG,variant:SPEEDRUN_BOARD.variant,name:clean,playerId,
    submissionId:`${result.runId}:${SPEEDRUN_BOARD.variant}`,score:result.activeMs,metadata,...(video?{videoUrl:video}:{})}];
}

// Retain the identical name and IDs after a partial success or uncertain response.
export class LeaderboardSubmission{
  // credential: the browser's mann.cool player secret (the shell's mannCool.player.credential), sent with the time so the
  // server knows the player without trusting a claimed ID (2026-11-09: one row per player; signed in counts for the challenge).
  constructor(result,{endpoint='/api/v1/leaderboard',fetcher=(...args)=>fetch(...args),playerId,ceo,ticket=async()=>null,credential=async()=>null,state,onProgress=()=>{}}={}){
    this.result=result;this.endpoint=endpoint;this.fetcher=fetcher;this.playerId=playerId;this.ceo=ceo;
    // Keep the frozen body, name and receipt; bodies for retired boards are dropped, never retried.
    const variants=currentVariants(),bodies=state?.bodies?.filter(body=>variants.has(body.variant));
    this.bodies=bodies?.length?bodies:null;this.accepted=new Set((state?.accepted||[]).filter(variant=>variants.has(variant)));this.held=new Set();this.review=[];this.inflight=null;this.ticket=ticket;this.credential=credential;this.onProgress=onProgress;
  }
  submit(name,{videoUrl}={}){
    if(this.inflight)return this.inflight;
    this.bodies??=submissionBodies(this.result,name,this.playerId,{ceo:this.ceo,videoUrl});
    this.onProgress({bodies:this.bodies,accepted:[...this.accepted]});
    this.inflight=this.send().finally(()=>{this.inflight=null;});return this.inflight;
  }
  async send(){
    if(this.bodies.every(body=>this.accepted.has(body.variant)))return {accepted:[...this.accepted],held:[...this.held],complete:true};
    const runTicket=await this.ticket();
    let playerSecret=null;try{playerSecret=await this.credential();}catch{}
    for(const body of this.bodies){
      if(this.accepted.has(body.variant))continue;
      const response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,...(runTicket?{runTicket}:{}),...(typeof playerSecret==='string'&&playerSecret?{playerSecret}:{})})});
      let data;try{data=await response.json();}catch{throw Error('No confirmation received. Retry to check this same score.');}
      if(!response.ok||data.success!==true)throw Error(data.error||'Leaderboard unavailable. Retry this score.');
      // A held run is stored for review: submitted, but not ranked until approved.
      this.accepted.add(body.variant);if(data.held)this.held.add(body.variant);
      if(Array.isArray(data.entry?.metadata?.review))this.review=data.entry.metadata.review;
      this.onProgress({bodies:this.bodies,accepted:[...this.accepted]});
    }
    return {accepted:[...this.accepted],held:[...this.held],review:this.review,complete:this.accepted.size===this.bodies.length};
  }
}
