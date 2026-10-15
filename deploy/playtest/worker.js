import {GAME_SLUG, LEVELS, boardsForLevel} from '../../doom-web/levels.js';
import {serveMedia} from './media.js';
import media from './media-manifest.json';

const boards = LEVELS.flatMap(boardsForLevel);
const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const entry = row => ({name:row.name, score:row.score, metadata:JSON.parse(row.metadata), timestamp:row.timestamp});

async function leaderboard(request, env, url) {
  if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed'},405);
  let body;
  if (request.method==='POST') {
    if (request.headers.get('Origin') && request.headers.get('Origin')!==url.origin) return json({error:'Use the playtest site to submit.'},403);
    const reader=request.body?.getReader();
    if(!reader)return json({error:'Missing submission.'},400);
    let size=0;const chunks=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6144){await reader.cancel();return json({error:'Submission too large.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
    try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Invalid JSON.'},400);}
    if(!body || typeof body!=='object')return json({error:'Invalid submission.'},400);
  }
  const slug=body?.slug??url.searchParams.get('slug'),variant=body?.variant??url.searchParams.get('variant');
  const board=boards.find(b=>b.variant===variant);
  if(slug!==GAME_SLUG||!board)return json({error:'Unknown game or leaderboard.'},400);
  if(body){
    const string=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
    if(!string(body.name,32)||!string(body.submissionId,200)||!string(body.playerId,200)||!Number.isFinite(body.score)||body.score<0||!body.metadata||typeof body.metadata!=='object'||JSON.stringify(body.metadata).length>2048)return json({error:'Invalid submission.'},400);
    await env.SCORES.prepare('INSERT INTO scores (submission_id,slug,variant,player_id,name,score,metadata,timestamp) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO NOTHING')
      .bind(body.submissionId,slug,variant,body.playerId,body.name.trim(),body.score,JSON.stringify(body.metadata),new Date().toISOString()).run();
    const saved=await env.SCORES.prepare('SELECT * FROM scores WHERE submission_id=?').bind(body.submissionId).first();
    if(saved.slug!==slug||saved.variant!==variant||saved.player_id!==body.playerId||saved.score!==body.score)return json({error:'Submission ID already belongs to another score.'},409);
    return json({success:true,playtest:true,entry:entry(saved)});
  }
  const order=board.direction==='asc'?'ASC':'DESC';
  const limit=Math.max(1,Math.min(100,Math.trunc(Number(url.searchParams.get('limit'))||25)));
  // Each friend has one best run per board; repeat submissions remain idempotent.
  const rows=await env.SCORES.prepare(`SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score ${order},timestamp ASC) AS best FROM scores WHERE slug=? AND variant=?) WHERE best=1 ORDER BY score ${order},timestamp ASC LIMIT ?`).bind(slug,variant,limit).all();
  return json({success:true,playtest:true,slug,variant,direction:board.direction,board,entries:rows.results.map((r,i)=>({...entry(r),rank:i+1}))});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const film=media.find(m=>'/'+m.file===url.pathname);
    if(film)return serveMedia(request,env,ctx,film);
    if(url.pathname==='/dev-config.json')return json({enabled:false});
    if(url.pathname==='/platform/config.json')return json({});
    if(url.pathname==='/api/v1/plays')return json({success:true,playtest:true});
    if(url.pathname==='/api/v1/guestbook')return json({success:true,entries:[],playtest:true});
    if(url.pathname==='/api/v1/leaderboard'){
      try{return await leaderboard(request,env,url);}catch(error){console.error('Playtest scoreboard unavailable',error);return json({error:'Scoreboard unavailable. Please retry.'},503);}
    }
    return env.ASSETS.fetch(request);
  }
};
