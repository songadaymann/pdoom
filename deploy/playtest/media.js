// Cloudflare Static Assets does not supply byte ranges in this deployment.
// Stream slices without buffering entire films in the Worker.
export async function serveMedia(request, env, ctx, meta) {
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const etag='"'+meta.sha256+'"';
  const headers=new Headers({'Content-Type':meta.file.endsWith('.mp4')?'video/mp4':'audio/mpeg',
    'ETag':etag,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=0, must-revalidate',
    'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
  let start=0,end=meta.bytes-1,status=200;
  let range=request.headers.get('Range');
  if(request.headers.has('If-Range')&&request.headers.get('If-Range')!==etag)range=null;
  if(range){
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!m||(!m[1]&&!m[2]))start=meta.bytes;
    else if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end);}
    else start=Math.max(0,meta.bytes-Number(m[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=meta.bytes){headers.set('Content-Range',`bytes */${meta.bytes}`);return new Response(null,{status:416,headers});}
    status=206;headers.set('Content-Range',`bytes ${start}-${end}/${meta.bytes}`);
  }
  const length=end-start+1;headers.set('Content-Length',String(length));
  if(request.method==='HEAD')return new Response(null,{status,headers});
  const source=new Request(request.url,{headers:{'Accept-Encoding':'identity'}});
  const asset=await env.ASSETS.fetch(source);
  if(!asset.ok)return asset;
  const output=new FixedLengthStream(length),reader=asset.body.getReader(),writer=output.writable.getWriter();
  const pump=(async()=>{
    let offset=0,written=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;
        const lo=Math.max(0,start-offset),hi=Math.min(value.length,end+1-offset);
        if(hi>lo){await writer.write(value.subarray(lo,hi));written+=hi-lo;}
        offset+=value.length;if(offset>end)break;
      }
      if(written!==length)throw Error('Incomplete media asset');
      await writer.close();
    }catch(error){await writer.abort(error).catch(()=>{});}finally{await reader.cancel().catch(()=>{});}
  })();
  // Keep the stream pump alive until its response has been consumed.
  ctx.waitUntil(pump);
  return new Response(output.readable,{status,headers});
}
