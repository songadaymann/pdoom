// Loopback-only review API. Nothing here writes to mann.cool.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GAME_SLUG,LEVELS,ARCHIVED_LEVELS,boardsForLevel} from '../doom-web/levels.js';

export function createLocalLeaderboards({store=fileURLToPath(new URL('../output/local-leaderboards/scores.json',import.meta.url))}={}){
  const boards=[...LEVELS,...ARCHIVED_LEVELS].flatMap(boardsForLevel);
  let queue=Promise.resolve();
  const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  const load=async()=>{try{return JSON.parse(await readFile(store,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}};
  const save=async records=>{await mkdir(path.dirname(store),{recursive:true});await writeFile(store+'.tmp',JSON.stringify(records));await rename(store+'.tmp',store);};
  return async function handle(req,res,url){
    if(url.pathname==='/leaderboard-config.json'){json(res,200,{mode:'local',enabled:true,endpoint:'/api/v1/leaderboard',shellSrc:'/platform/v1/game-shell.js?v=20260809-tip-attribution1'});return true;}
    if(url.pathname==='/platform/config.json'){json(res,200,{patreonUrl:'https://songaday.studio'});return true;}
    if(url.pathname==='/platform/v1/game-shell.js'){
      const source=await readFile(new URL('../.mann-cool/dev/game-shell.v1.js',import.meta.url),'utf8');
      // The upstream shell has one absolute play tracker; send local launches to
      // a local sink instead of manufacturing public play traffic.
      const local=source.replace('https://mann.cool/api/v1/plays','/api/v1/plays');
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(local);return true;
    }
    if(url.pathname==='/api/v1/plays'){json(res,200,{success:true,local:true});return true;}
    if(url.pathname==='/api/v1/guestbook'){json(res,200,{success:true,entries:[],local:true});return true;}
    if(url.pathname!=='/api/v1/leaderboard')return false;
    try{
      let body=null;
      if(req.method==='POST'){
        let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>6144)throw Error('Submission too large.');}
        try{body=JSON.parse(text);}catch{throw Error('Invalid JSON.');}
      }else if(req.method!=='GET') {json(res,405,{error:'Method not allowed'});return true;}
      const slug=body?.slug||url.searchParams.get('slug'),variant=body?.variant||url.searchParams.get('variant');
      const board=boards.find(b=>b.variant===variant);
      if(slug!==GAME_SLUG||!board)throw Error('Unknown game or leaderboard variant.');
      if(body){
        if(typeof body.name!=='string'||!body.name.trim()||body.name.length>32||!Number.isFinite(body.score)||body.score<0
          ||typeof body.submissionId!=='string'||body.submissionId.length>200||!body.submissionId
          ||typeof body.playerId!=='string'||!body.playerId||!body.metadata||JSON.stringify(body.metadata).length>2048)throw Error('Invalid submission.');
        const mutate=async()=>{
          const records=await load(),existing=records.find(r=>r.submissionId===body.submissionId);
          if(existing){if(existing.slug!==slug||existing.variant!==variant||existing.score!==body.score||existing.playerId!==body.playerId)throw Error('Submission ID already belongs to another score.');return existing;}
          const entry={...body,name:body.name.trim(),timestamp:new Date().toISOString()};records.push(entry);await save(records);return entry;
        };
        const task=queue.then(mutate);queue=task.catch(()=>{});
        json(res,200,{success:true,local:true,entry:await task});
      }else{
        await queue;const records=await load(),sign=board.direction==='asc'?1:-1;
        const entries=records.filter(r=>r.slug===slug&&r.variant===variant).sort((a,b)=>sign*(a.score-b.score)||a.timestamp.localeCompare(b.timestamp))
          .slice(0,Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||25))).map((r,i)=>({...r,rank:i+1}));
        json(res,200,{success:true,local:true,slug,variant,direction:board.direction,board,entries});
      }
    }catch(error){json(res,400,{error:error.message});}
    return true;
  };
}
