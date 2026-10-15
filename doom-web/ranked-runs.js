const PREFIX='pdoom.ranked-run.v1:';
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const descriptor=result=>Object.fromEntries(['runId','levelId','levelVersion','scoreVersion','boardVersion'].map(key=>[key,result[key]]));

// Ticket secrets and unfinished submissions stay in this browser, never public
// score metadata. Failure to obtain a ticket does not interrupt gameplay.
export class RankedRuns{
  constructor({endpoint,storage,fetcher=(...args)=>fetch(...args),makeNonce=nonce}={}){
    this.endpoint=endpoint;this.storage=storage;this.fetcher=fetcher;this.makeNonce=makeNonce;
    this.records=new Map();this.inflight=new Map();
    this.load();
  }
  get enabled(){return !!this.endpoint;}
  load(){
    try{for(let i=0;i<(this.storage?.length||0);i++){
      const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;
      const stored=JSON.parse(this.storage.getItem(key)),current=this.records.get(stored?.runId);
      if(typeof stored?.runId!=='string'||!/^[a-f0-9]{64}$/.test(stored.nonce))continue;
      if(!current||(stored.updatedAt||0)>(current.updatedAt||0)
        ||stored.updatedAt===current.updatedAt&&!stored.pending&&current.pending)this.records.set(stored.runId,stored);
    }}catch{}
  }
  record(result){
    let record=this.records.get(result.runId);
    if(!record){record={...descriptor(result),nonce:this.makeNonce(),createdAt:Date.now()};this.records.set(result.runId,record);this.persist(record);}
    return record;
  }
  persist(record){
    // Separate keys prevent two game tabs from overwriting one another's runs.
    record.updatedAt=Math.max(Date.now(),record.updatedAt||0)+1;
    try{this.storage?.setItem(PREFIX+record.runId,JSON.stringify(record));}catch{}
  }
  async ticket(result){
    if(!this.enabled)return null;
    const record=this.record(result);
    if(record.ticketId)return {id:record.ticketId,token:record.nonce};
    if(this.inflight.has(record.runId))return this.inflight.get(record.runId);
    const task=(async()=>{
      let response,data;
      try{
        response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({...descriptor(record),nonce:record.nonce}),signal:AbortSignal.timeout(10000)});
        data=await response.json();
      }catch{throw Error('Score service unavailable. Your result is kept here; retry when connected.');}
      if(!response.ok||data.success!==true)throw Error(data.error||'Could not register this run. Your result is kept here; retry.');
      if(data.runId!==record.runId||typeof data.ticketId!=='string')throw Error('No valid run receipt received. Retry this result.');
      record.ticketId=data.ticketId;record.expiresAt=data.expiresAt;this.persist(record);
      return {id:record.ticketId,token:record.nonce};
    })();
    this.inflight.set(record.runId,task);
    try{return await task;}finally{this.inflight.delete(record.runId);}
  }
  save(result,ceo){
    if(!this.enabled||!result.eligible)return null;
    const record=this.record(result);
    record.pending??={result,ceo,bodies:null,accepted:[]};this.persist(record);return record.pending;
  }
  progress(runId,state){const record=this.records.get(runId);if(record?.pending){Object.assign(record.pending,state);this.persist(record);}}
  complete(runId){const record=this.records.get(runId);if(record){delete record.pending;this.persist(record);}}
  pending(){this.load();return [...this.records.values()].filter(r=>r.pending).sort((a,b)=>b.createdAt-a.createdAt).map(r=>r.pending);}
}
