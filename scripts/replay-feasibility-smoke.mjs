// Local experiment only. The filesystem bridge is injected into a test response;
// no filesystem/debug commands are added to the shipped worker.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
const base=process.env.DOOM_URL||'http://127.0.0.1:5198/',out=process.env.DOOM_OUT||'output/replay-feasibility';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname))throw Error('Replay experiments require loopback.');
await fs.mkdir(out,{recursive:true});
const worker=await fs.readFile('doom-web/engine/engine.worker.js','utf8');
const bridge=`case 'qa-fs': {
  try {
    const fs=self.Module.FS;
    const walk=(dir,depth=0)=>fs.readdir(dir).filter(n=>n!=='.'&&n!=='..').flatMap(n=>{const p=dir==='/'?'/'+n:dir+'/'+n;try{return fs.isDir(fs.stat(p).mode)?depth<4?walk(p,depth+1):[]:[p];}catch{return[];}});
    const value=m.action==='list'?walk('/'):Array.from(fs.readFile(m.path));
    self.postMessage({type:'qa-fs-result',id:m.id,value});
  }catch(error){self.postMessage({type:'qa-fs-result',id:m.id,error:String(error)});}return;
}`;
const testWorker=worker.replace('switch (m.type) {','switch (m.type) {\n'+bridge);
assert.notEqual(worker,testWorker);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={
  methodology:'Native -record/-playdemo on the exact shipped WASM/PK3, with keyboard movement, interaction and a real menu pause. Compares reported native state at matching world tics. Short samples, not completed rescues or a deployed verifier.',
  wasmSha256:createHash('sha256').update(await fs.readFile('doom-web/engine/gzdoom.wasm')).digest('hex'),
  modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[]};
async function open(level,hero,mode,bytes){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();
  await p.route('**/engine/engine.worker.js',r=>r.fulfill({contentType:'text/javascript',body:testWorker}));
  await p.addInitScript(({mode,bytes})=>{
    window.__QA_TRACE__=[];window.__QA_RAW_LOGS__=[];window.__QA_FS_PENDING__={};let request=0;
    window.__QA_FS__=(action,path)=>new Promise((resolve,reject)=>{const id=++request;window.__QA_FS_PENDING__[id]={resolve,reject};window.__QA_WORKER__.postMessage({type:'qa-fs',id,action,path});setTimeout(()=>{if(window.__QA_FS_PENDING__[id]){delete window.__QA_FS_PENDING__[id];reject(Error('Filesystem response timed out'));}},15000);});
    const W=Worker;window.Worker=class extends W{
      constructor(...args){super(...args);window.__QA_WORKER__=this;this.addEventListener('message',e=>{
        const m=e.data;if(m.type==='qa-fs-result'){const pending=window.__QA_FS_PENDING__[m.id];if(pending){delete window.__QA_FS_PENDING__[m.id];m.error?pending.reject(Error(m.error)):pending.resolve(m.value);}return;}
        if(m.type==='log'&&typeof m.msg==='string'){
          window.__QA_RAW_LOGS__.push(m.msg);
          for(const prefix of ['PDOOM_STATE ','PDOOM_RUN ','PDOOM_COMBAT ','PDOOM_RESULT ']){const i=m.msg.indexOf(prefix);if(i>=0)try{window.__QA_TRACE__.push({kind:prefix.trim(),data:JSON.parse(m.msg.slice(i+prefix.length))});}catch{}}
        }
      });}
      postMessage(m,transfer){if(m.type==='boot'){
        m.args=[...m.args,...(mode==='record'?['-record','pdoom-proof.lmp']:['-playdemo','pdoom-proof.lmp'])];
        if(mode==='replay')m.files['pdoom-proof.lmp']=new Uint8Array(bytes);
        window.__QA_BOOT_ARGS__=m.args;
      }return super.postMessage(m,transfer);}
    };
  },{mode,bytes:bytes?Array.from(bytes):null});
  await p.goto(base+`?level=${level}&ceo=${hero}`);await p.waitForFunction(()=>window.render_game_to_text);
  return{context,p,q:nativeQA(p)};
}
const selected=process.env.REPLAY_CASES?.split(',');
try{
  for(const level of ['five-prisons','hal-station'])for(const hero of ['altman','amodei']){
    const name=level+'-'+hero;if(selected&&!selected.includes(name))continue;
    const entry={name,level,hero};report.cases.push(entry);let recording,replay;
    try{
      recording=await open(level,hero,'record');await startGame(recording.p);await recording.q.wait(s=>s.world?.ticks>35,'Recording warmup',60000);
      await recording.q.hold('w',450);await recording.q.hold('a',250);await recording.q.hold('ArrowLeft',200);await recording.q.press('e');
      await recording.p.keyboard.press('Escape');await recording.p.waitForTimeout(350);const paused=(await recording.q.read()).run.activeTics;await recording.p.waitForTimeout(700);const afterPause=(await recording.q.read()).run.activeTics;entry.menuPause={before:paused,after:afterPause,honored:afterPause===paused};await recording.p.keyboard.press('Escape');
      await recording.q.wait(s=>s.run.activeTics>paused+50,'Resume after menu');await recording.q.hold('d',350);await recording.p.waitForTimeout(600);
      const trace=await recording.p.evaluate(()=>window.__QA_TRACE__);entry.recordedSnapshots=trace.filter(t=>t.kind==='PDOOM_STATE').length;
      await recording.p.screenshot({path:`${out}/${name}-record.png`});await recording.q.command('stop');await recording.p.waitForTimeout(250);
      const files=await recording.p.evaluate(()=>window.__QA_FS__('list'));entry.demoFiles=files.filter(p=>/\.lmp$/i.test(p));
      assert.ok(entry.demoFiles.length,'Native recording did not produce an LMP file');
      const demo=Buffer.from(await recording.p.evaluate(path=>window.__QA_FS__('read',path),entry.demoFiles[0]));entry.demoBytes=demo.length;assert.ok(demo.length>32);await fs.writeFile(`${out}/${name}.lmp`,demo);await fs.writeFile(`${out}/${name}-record.json`,JSON.stringify(trace,null,2));
      entry.recordLogs=await recording.p.evaluate(()=>window.__QA_RAW_LOGS__.filter(l=>/demo|record/i.test(l)).slice(-12));await recording.context.close();recording=null;
      replay=await open(level,hero,'replay',demo);await startGame(replay.p);
      const states=trace.filter(t=>t.kind==='PDOOM_STATE'&&t.data.ticks>=35),last=states.at(-1)?.data.ticks;assert.ok(states.length>5);
      await replay.p.waitForFunction(last=>window.__QA_TRACE__.some(t=>t.kind==='PDOOM_STATE'&&t.data.ticks>=last),last,{timeout:30000});
      const played=await replay.p.evaluate(()=>window.__QA_TRACE__);await fs.writeFile(`${out}/${name}-replay.json`,JSON.stringify(played,null,2));
      const playbackStates=new Map(played.filter(t=>t.kind==='PDOOM_STATE').map(t=>[t.data.ticks,t.data]));entry.compared=0;entry.differences=[];
      for(const state of states){const actual=playbackStates.get(state.data.ticks);if(!actual)continue;entry.compared++;const changed=Object.keys(state.data).filter(key=>JSON.stringify(state.data[key])!==JSON.stringify(actual[key]));if(changed.length)entry.differences.push({tick:state.data.ticks,changed:changed.map(key=>({key,recorded:state.data[key],replayed:actual[key]}))});}
      entry.replayLogs=await replay.p.evaluate(()=>window.__QA_RAW_LOGS__.filter(l=>/demo|record|different version|error/i.test(l)).slice(-12));await replay.p.screenshot({path:`${out}/${name}-replay.png`});
      assert.ok(entry.compared>=states.length*.9,'Insufficient matching native tick samples');assert.deepEqual(entry.differences,[]);entry.matched=true;
    }catch(error){entry.failure=String(error.stack||error);const current=replay||recording;if(current){entry.lastState=await current.q.read().catch(()=>null);entry.lastLogs=await current.p.evaluate(()=>window.__QA_RAW_LOGS__.slice(-25)).catch(()=>[]);await current.p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}}
    finally{await recording?.context.close();await replay?.context.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
    console.log(JSON.stringify({name,matched:entry.matched,compared:entry.compared,demoBytes:entry.demoBytes,menuPauseHonored:entry.menuPause?.honored,failure:entry.failure?.split('\n')[0]}));
  }
}finally{await browser.close();}
report.allMatched=report.cases.length>0&&report.cases.every(c=>c.matched);report.allMenuPausesHonored=report.cases.every(c=>c.menuPause?.honored);report.completedRescuesTested=0;report.rankedVerificationEnabled=false;await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));if(!report.allMatched)process.exitCode=1;
