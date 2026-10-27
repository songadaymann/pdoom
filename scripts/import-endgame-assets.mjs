// Brings a boss-fight asset batch (sprite sheets and voice takes, made from the doc
// "p(DOOM) Boss Fight: Lines and Sprites") into the endgame prototype.
//
//   node scripts/import-endgame-assets.mjs [art/endgame-2026-10-26] [--force]
//
// Sheets are copied unchanged to doom-web/local/endgame/sprites/ (the prototype slices them by
// equal cells, as the doc promises), with sprites.json giving each sheet's grid. Each take is
// trimmed, levelled to -16 LUFS like the game's own (scripts/import-voice-lines.py) and saved as
// doom-web/local/endgame/voice/<key>.mp3; voice/manifest.json carries the words actually said
// and each take's length, and for Elon's takes how loud (`loud`) and how hissy (`hiss`, the
// zero-crossing rate: s, f, t) each 40 ms is, a digit each, for his mouth. Everything lands in
// ignored doom-web/local/. A line with no take stays a subtitle. A take that runs on after its last word
// is cut there, if scripts/find-endgame-take-tails.py has listed it (take-tails.json, by the WAV's sha256).
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const run=promisify(execFile);
const root=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2),force=args.includes('--force');
const src=path.resolve(root,args.find(a=>!a.startsWith('--'))??'art/endgame-2026-10-26');
const out=path.join(root,'doom-web/local/endgame');
await mkdir(path.join(out,'sprites'),{recursive:true});await mkdir(path.join(out,'voice'),{recursive:true});

// sprites
const plan=JSON.parse(await readFile(path.join(src,'sprite-plan.json'),'utf8')),grids={};
for(const job of plan.jobs){await copyFile(path.join(src,job.file),path.join(out,'sprites',job.file));grids[job.file]=job.grid;}
await writeFile(path.join(out,'sprites/sprites.json'),JSON.stringify({source:path.relative(root,src),grids},null,1)+'\n');
console.log(`${plan.jobs.length} sheets`);

// voices
const takes=JSON.parse(await readFile(path.join(src,'voices/manifest.json'),'utf8')).lines;
const tmp=await mkdtemp(path.join(os.tmpdir(),'endgame-voice-'));
const trim='silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse';
const lines={};let made=0,kept=0,cut=0;
const tails=await readFile(path.join(out,'take-tails.json'),'utf8').then(JSON.parse,()=>({}));
const seconds=async(file)=>+(await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file])).stdout;
async function one(take){
 const from=path.join(src,'voices',take.file),to=path.join(out,'voice',take.key+'.mp3');
 // where to cut a take that runs on, if this is the same WAV the tails were found in
 const tail=tails[take.key],end=tail&&createHash('sha256').update(await readFile(from)).digest('hex')===tail.sha256?tail.end+.35:null;
 let fresh=!force&&await stat(to).then(t=>stat(from).then(f=>t.mtimeMs>=f.mtimeMs),()=>false);
 if(fresh&&end&&await seconds(to)>end+.4)fresh=false;
 if(end)cut++;
 if(!fresh){
  // two passes, as in import-voice-lines.py (ffmpeg 7.1 can abort when areverse feeds loudnorm)
  const mid=path.join(tmp,take.key+'.wav');
  await run('ffmpeg',['-v','error','-y','-i',from,'-af',(end?`atrim=end=${end},`:'')+trim,'-c:a','pcm_f32le',mid]);
  await run('ffmpeg',['-v','error','-y','-i',mid,'-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ac','1','-ar','44100','-codec:a','libmp3lame','-b:a','96k',to]);
  made++;
 }else kept++;
 const sec=await seconds(to);
 // a quote the batch's text lost its closing mark on (mcp-update-3)
 const text=(take.text.match(/"/g)??[]).length%2?take.text+'"':take.text;
 lines[take.key]={text,sec:+sec.toFixed(2),...(take.key.startsWith('mcp-')?await mouth(to):{})};
}
// loudness against the take's own loud parts, and hiss, every 40 ms (25 a second, voice.ts MOUTH_FPS)
async function mouth(file){
 const {stdout:pcm}=await run('ffmpeg',['-v','error','-i',file,'-f','s16le','-ac','1','-ar','16000','-'],{encoding:'buffer',maxBuffer:1<<26});
 const n=640,frames=[];
 for(let o=0;o+n*2<=pcm.length;o+=n*2){let e=0,z=0,prev=0;for(let i=0;i<n;i++){const v=pcm.readInt16LE(o+i*2)/32768;e+=v*v;if(i&&(v>=0)!==(prev>=0))z++;prev=v;}frames.push({rms:Math.sqrt(e/n),zcr:z/n});}
 const top=frames.map(f=>f.rms).sort((a,b)=>a-b)[Math.floor(frames.length*.95)]||1;
 const digit=(v)=>String(Math.round(Math.max(0,Math.min(1,v))*9));
 return {loud:frames.map(f=>digit(f.rms/top)).join(''),hiss:frames.map(f=>digit(f.rms/top<.08?0:(f.zcr-.06)/.3)).join('')};
}
const queue=[...takes];
await Promise.all(Array.from({length:8},async()=>{while(queue.length)await one(queue.shift());}));
await rm(tmp,{recursive:true,force:true});
const sorted=Object.fromEntries(Object.keys(lines).sort().map(k=>[k,lines[k]]));
await writeFile(path.join(out,'voice/manifest.json'),JSON.stringify({source:path.relative(root,src),lines:sorted},null,1)+'\n');
console.log(`${takes.length} takes (${made} encoded, ${kept} already there, ${cut} cut after their last word) -> ${path.relative(root,out)}`);
