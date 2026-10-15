import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalLeaderboards} from './local-leaderboards.mjs';

const root=fileURLToPath(new URL('../doom-web/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav'};
const localBoards=createLocalLeaderboards();
http.createServer(async(req,res)=>{
  try{
    const requestUrl=new URL(req.url,'http://127.0.0.1');
    if(await localBoards(req,res,requestUrl))return;
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const requested=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(requested==='/dev-config.json'){
      const body=JSON.stringify({enabled:process.env.PDOOM_DEV!=='0'});
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:body);return;
    }
    const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
    let start=0,end=info.size-1,code=200;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(match&&(match[1]||match[2])){
        start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));
        end=match[1]&&match[2]?Math.min(Number(match[2]),info.size-1):info.size-1;
      }else start=info.size;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      code=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;headers['Content-Length']=end-start+1;
    }
    res.writeHead(code,headers);
    if(req.method==='HEAD'||info.size===0){res.end();return;}
    const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
}).listen(5198,'127.0.0.1',()=>console.log('p(DOOM) Doom mod: http://127.0.0.1:5198/'));
