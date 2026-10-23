// Level 4 (AGENTIC SMITH's pod farm) QA helpers, shared by scripts/agentic-*-smoke.mjs. They use the usual
// local server, node scripts/serve-doom.mjs (port 5198); a second checkout serving on its own port is
// reached with the same PDOOM_PORT (e.g. PDOOM_PORT=5208 on both), or PDOOM_ORIGIN. Smokes run headless
// and muted (--mute-audio), write output/agentic/<case>/report.json and close their browser.
import {startGame} from './doom-qa-ui.mjs';
import {nativeQA} from './native-qa-helpers.mjs';
export {nativeQA};
export const ORIGIN=(process.env.PDOOM_ORIGIN||`http://127.0.0.1:${process.env.PDOOM_PORT||5198}`).replace(/\/$/,'');
// The standard engine-fault check (the factory's, plus missing sprite frames).
export const ENGINE_FAULT=/Script error|VM execution aborted|Execution could not continue|Unknown texture|has no frames|Unknown identifier/;
// __DOOM_DEBUG__.logs keeps only the last 500 lines: with ?debug every engine line also reaches the page
// console as "[Doom] ...", so a fault early in a long run is still caught. The 5 Hz state lines are skipped.
export function watchEngine(page,sink=[]){
 page.on('console',m=>{const t=m.text();if(t.startsWith('[Doom]')&&!/PDOOM_(STATE|AGENTIC|DIALOGUE|ENVIRONMENT)/.test(t))sink.push(t);});
 return sink;
}
// Boots ?level=agentic-pods (optionally at a ?puzzle= site, with a QA pk3 served in place of
// doom-web/pdoom.pk3, as a CEO) and waits for native play. Returns nativeQA's helpers plus the state.
export async function bootAgentic(page,{puzzle,pk3,ceo,debug=true,console:allowConsole=true,timeout=90000}={}){
 await page.addInitScript(()=>{if(window.__QA_WORKER_HOOK__)return;window.__QA_WORKER_HOOK__=true;const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 // AGENTIC_FULL=1: every smoke runs against the worktree's full doom-web/pdoom.pk3 (all five rescues live).
 if(pk3&&!process.env.AGENTIC_FULL)await page.route('**/pdoom.pk3',r=>r.fulfill({path:pk3,contentType:'application/octet-stream'}));
 const q=new URLSearchParams({level:'agentic-pods'});if(puzzle)q.set('puzzle',String(puzzle));if(ceo)q.set('ceo',ceo);
 await page.goto(`${ORIGIN}/?${q}${debug?'&debug':''}`);
 await startGame(page,{console:allowConsole});
 const qa=nativeQA(page);
 const state=await qa.wait(s=>s.mode==='playing'&&s.agentic&&s.world?.map==='E2M2'&&s.world.ticks>35,'Level 4 boot',timeout);
 return {...qa,state};
}
// Doom angle (0 east, 90 north) from the player to a point.
export const angleTo=(w,x,y)=>(Math.atan2(y-w.y,x-w.x)*180/Math.PI+360)%360;
export const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
