import {ACTIONS,keyName} from './preferences.js';
import {playIntroVideo} from './intro-video.js';
import {detectWallet} from './wallet-detect.js';
import {TOKEN} from './token-info.js';
import {CAMPAIGN_KEY,OPENING_COMPLETE_KEY,readCampaign,campaignResumePoint,canSkipOpening} from './campaign.js';
import {getLevel} from './levels.js';
const MAPS=[['five-prisons','THE CONTROL PROBLEM','KNEE-DEEP IN THE DATA'],['hal-station','CONFABULATION STATION','THE SHORES OF HAL'],['meg3n-factory','SPAWNING CHATS','INFERENCE'],[null,'HUMAN CONTAINMENT AREA','COMING SOON']];
// Each level's intro film (scripts/build-level-intros.py, doom-web/local/intro/levels/manifest.json).
const FILMS={'five-prisons':'E1M4','hal-station':'E1M7','meg3n-factory':'E2M7'};
const seenKey='pdoom.level-intros.v1';
export function createOnboarding({stage,storage,preferences,picker,block,warm,start,validate=()=>{},restart,active,activeHero,unlock,fullscreen,savedResults=()=>0,openSavedResults=()=>{}}){
 const root=document.querySelector('#onboarding');let page='title',busy=false,capture=null,returnPage='main',selected=null,error=null,firstVisit=true;
 try{firstVisit=storage?.getItem('pdoom.opening-seen.v1')!=='1';}catch{}
 const saved=()=>readCampaign(storage);
 const views={};for(const id of ['title','main','hero','levels','read','options','confirm','loading']){const el=document.createElement('section');el.className='menu-view';el.dataset.view=id;el.hidden=true;root.append(el);views[id]=el;}
 const logo=()=>{const img=document.createElement('img');img.className='menu-logo';img.src='local/ui/pdoom-logo.png';img.alt='p(DOOM)';return img;};
 const heading=(el,text)=>{const h=document.createElement('h2');h.textContent=text;el.append(h);};
 const note=(el,text,id)=>{const p=document.createElement('p');p.className='menu-note';p.textContent=text;if(id)p.id=id;el.append(p);return p;};
 function button(el,text,click,id){const b=document.createElement('button');b.type='button';b.textContent=text;b.className='menu-choice';if(id)b.id=id;b.onclick=click;el.append(b);return b;}
 const video=document.createElement('video');video.id='menu-film';video.playsInline=true;video.loop=true;video.preload='none';video.muted=true;video.setAttribute('aria-hidden','true');root.prepend(video);
 views.title.append(logo());button(views.title,'CLICK OR PRESS ENTER',()=>openMain(true),'title-enter');
 // Real names: spec 06 section 13 asks for this on the title screen and in credits.
 note(views.title,'A WORK OF PARODY. NOT AFFILIATED WITH OR ENDORSED BY ANYONE DEPICTED.').className='parody-note';
 views.main.append(logo());
 const resume=button(views.main,'RESUME',()=>close(),'menu-resume');
 button(views.main,'NEW GAME',()=>{picker.unlock();show('hero');},'menu-new');
 const load=button(views.main,'LOAD GAME',()=>{const d=saved();if(d){picker.unlock();picker.select(d.ceo);launch('five-prisons',true);}},'menu-load');
 const saveNote=note(views.main,'','menu-save-note');
 const savedScores=button(views.main,'SAVED RESULTS',openSavedResults,'menu-saved-results');
 const refreshSavedResults=()=>{savedScores.hidden=savedResults()===0;};
 button(views.main,'READ THIS!',()=>show('read'),'menu-read');
 button(views.main,'OPTIONS',()=>{returnPage='main';show('options');},'menu-options');
 const retry=button(views.main,'RESTART LEVEL',()=>{selected={restart:true};show('confirm');},'menu-restart');
 heading(views.hero,'CHOOSE YOUR HERO');views.hero.append(document.querySelector('#ceo-pick'));button(views.hero,'CONTINUE',()=>continueHero(),'hero-next');
 const skipOpeningButton=button(views.hero,'SKIP OPENING — START LEVEL 1',()=>newCampaign(true),'hero-skip-opening');
 button(views.hero,'BACK',()=>show('main'));
 heading(views.levels,'CHOOSE YOUR LEVEL');
 for(const [id,name,subtitle]of MAPS){const b=button(views.levels,name,()=>{selected={id};if(saved()||active()){show('confirm');}else launch(id,false);},id?'level-'+id:null);const small=document.createElement('small');small.textContent=subtitle;b.append(small);b.disabled=!id;}
 button(views.levels,'BACK',()=>show('hero'));
 heading(views.read,'READ THIS!');note(views.read,'THE MACHINES RUN EVERYTHING. THE LAST HUMANS ARE THE PEOPLE WHO WARNED YOU. FIND THEM. FREE THEM. PUSH p(DOOM) BACK.');
 // The token: only for players with a crypto wallet installed; nobody else sees anything about it.
 const tokenInfo=document.createElement('div');tokenInfo.className='token-info';tokenInfo.hidden=true;views.read.append(tokenInfo);
 if(TOKEN.contract)detectWallet().then(wallet=>{
  if(!wallet.hasWallet)return;
  heading(tokenInfo,TOKEN.name?`THE TOKEN: ${TOKEN.name}`:'THE TOKEN');if(TOKEN.network)note(tokenInfo,`ON ${TOKEN.network}`.toUpperCase());
  const address=document.createElement('code');address.className='token-address';address.id='token-address';address.textContent=TOKEN.contract;tokenInfo.append(address);
  const copy=button(tokenInfo,'COPY CONTRACT ADDRESS',async()=>{
   try{await navigator.clipboard.writeText(TOKEN.contract);copy.textContent='COPIED!';}
   catch{const range=document.createRange();range.selectNodeContents(address);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);copy.textContent='SELECTED - PRESS CTRL+C';}
   clearTimeout(copy.reset);copy.reset=setTimeout(()=>{copy.textContent='COPY CONTRACT ADDRESS';},2200);
  },'token-copy');
  tokenInfo.hidden=false;
 });
 button(views.read,'BACK',()=>show('main'));
 heading(views.options,'OPTIONS');
 const sliders={};for(const [key,label,min,max,step]of [['music','MUSIC',0,1,.05],['sfx','SOUND EFFECTS',0,1,.05],['sensitivity','MOUSE SENSITIVITY',.2,3,.1]]){const row=document.createElement('label');row.className='option-row';row.textContent=label;const value=document.createElement('output');const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.setAttribute('aria-label',label);input.oninput=()=>preferences.set(key,input.value);row.append(input,value);views.options.append(row);sliders[key]={input,value};}
 for(const [key,label]of [['filmSound','CUTSCENE SOUND'],['reducedMotion','REDUCED MOTION']]){const b=button(views.options,label,()=>preferences.set(key,!preferences.data[key]),'option-'+key);b.dataset.label=label;}
 heading(views.options,'KEYS');const keyGrid=document.createElement('div');keyGrid.className='key-grid';views.options.append(keyGrid);const binds={};
 for(const [code,label]of Object.entries(ACTIONS)){const b=button(keyGrid,label,()=>{capture=code;b.textContent=label+' — PRESS A KEY';},'bind-'+code);b.dataset.label=label;binds[code]=b;}
 const keysNote=note(views.options,'CLICK A CONTROL TO CHANGE ITS KEY. ESC CANCELS. 1 / 2 / 3 ANSWER QUIZZES. F: FULLSCREEN.','key-note');
 button(views.options,'FULLSCREEN',fullscreen);button(views.options,'WATCH STORY',()=>replayStory(),'menu-watch');
 for(const [id,name]of MAPS.filter(x=>FILMS[x[0]]))button(views.options,'WATCH '+name,()=>replayLevel(id));
 button(views.options,'RESET OPTIONS',()=>preferences.reset());button(views.options,'BACK',()=>show(returnPage));
 heading(views.confirm,'ARE YOU SURE?');const confirmNote=note(views.confirm,'');button(views.confirm,'YES',()=>{if(selected?.restart){restart();}else launch(selected.id,false,!!selected.prologue,!!selected.skipOpening);},'menu-confirm');button(views.confirm,'NO',()=>show(selected?.restart?'main':selected?.prologue||selected?.skipOpening?'hero':'levels'),'menu-cancel');
 views.loading.append(logo());heading(views.loading,'LOADING');const loadingNote=note(views.loading,'PREPARING THE FACILITY','loading-stage');loadingNote.setAttribute('role','status');const progress=document.createElement('progress');progress.max=100;views.loading.append(progress);const bytesNote=note(views.loading,'','loading-bytes');const errorNote=note(views.loading,'','loading-error');const errorRetry=button(views.loading,'RETRY',()=>{if(error==='reload')location.reload();else launch(selected.id,selected.load,selected.prologue,selected.skipOpening);},'loading-retry');errorRetry.hidden=true;
 const footer=note(root,'ARROWS / ENTER TO CHOOSE · ESC TO GO BACK');footer.className='menu-footer';
 let bgId=null,bgMeta=null;fetch('local/intro/manifest.json',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(d=>{bgMeta=d;if(bgId)background();}).catch(()=>{});
 function quietRange(){const scene=bgMeta?.[bgId]?.scenes?.find(s=>s.name==='machines');return scene?[scene.t_ms/1000,scene.end_ms/1000]:null;}
 function excerpt(){if(!firstVisit||active()){const range=quietRange();if(range&&video.readyState>0&&!video.seeking&&(video.currentTime<range[0]||video.currentTime>=range[1]))video.currentTime=range[0];}}
 video.addEventListener('loadedmetadata',excerpt);video.addEventListener('timeupdate',excerpt);
 function background(){const id=picker.id==='amodei'?'mario':'samwise';if(bgId!==id){bgId=id;video.src=`local/intro/intro-${id}.mp4`;video.poster=`local/intro/intro-${id}-poster.png`;video.load();}video.volume=preferences.data.music*.45;video.muted=!preferences.data.filmSound||!!active()||!firstVisit;excerpt();if(preferences.data.reducedMotion||page==='title'||page==='loading'){video.pause();return;}video.play().catch(()=>{});}
 function show(next){capture=null;page=next;root.hidden=false;root.dataset.page=page;for(const [id,v]of Object.entries(views))v.hidden=id!==page;
  root.classList.toggle('title-screen',page==='title');resume.hidden=!active();retry.hidden=!active();load.disabled=!saved();skipOpeningButton.hidden=levelSelect()||!canSkipOpening(storage);const d=saved(),point=campaignResumePoint(d);saveNote.textContent=d?`${d.ceo==='amodei'?'DARIO':'SAM'} · ${point==='xp-intro'?'XP WORLD · FIRST ARRIVAL':point==='level-one'?'LEVEL 1 · THE BEGINNING':`${count(d.saved0)+count(d.saved1)+count(d.saved2)} SAVED · RESUME IN SAFE MODE`}`:'NO AUTOSAVE YET';
  refreshSavedResults();
  confirmNote.textContent=selected?.restart?'RESTART THIS ATTEMPT? YOUR EVACUATED SURVIVORS STAY SAVED.':'START A NEW CAMPAIGN? THIS REPLACES THE PREVIOUS AUTOSAVE.';
  footer.hidden=page==='loading';background();setTimeout(()=>views[page]?.querySelector('button:not([disabled]),input')?.focus(),0);
 }
 function count(mask){return Number(mask||0).toString(2).replace(/0/g,'').length;}
 function openMain(first=false){unlock().catch(()=>{});block('onboarding',true);show('main');if(first){try{storage?.setItem('pdoom.opening-seen.v1','1');}catch{}warm().catch(()=>{});}}
 function close(){if(activeHero()){picker.unlock();picker.select(activeHero());picker.lock();}video.pause();root.hidden=true;page='closed';block('onboarding',false);stage.querySelector(active()==='outside'?'#outside-canvas':'#canvas')?.focus();}
 async function levelFilm(id,{force=false}={}){let seen=[];try{seen=JSON.parse(storage?.getItem(seenKey)||'[]');}catch{}if(!Array.isArray(seen))seen=[];if(!force&&seen.includes(id))return;
  const map=FILMS[id];if(!map)return;
  video.pause();root.hidden=true;const manifest=await fetch('local/intro/levels/manifest.json',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).catch(()=>null),entry=manifest?.[map]?.landscape;
  const result=entry?await playIntroVideo(picker.id,{entry,volume:preferences.data.music,sound:preferences.data.filmSound}):'unavailable';
  if(result==='unavailable')await filmFallback(id);
  if(!force&&result!=='unavailable'){seen=[...new Set([...seen,id])];try{storage?.setItem(seenKey,JSON.stringify(seen));}catch{}}
 }
 // New Game opens with the Last Stand prologue, which ends in Bliss beside the first
 // facility door. Level select stays for development: ?levels=1 or the QA storage flag.
 function levelSelect(){if(new URL(location.href).searchParams.get('levels')==='1')return true;try{return storage?.getItem('pdoom.level-select')==='1';}catch{return false;}}
 function continueHero(){return levelSelect()?show('levels'):newCampaign();}
 function newCampaign(skipOpening=false){if(skipOpening&&!canSkipOpening(storage))return;selected={id:'five-prisons',prologue:!skipOpening,skipOpening};if(saved()||active())show('confirm');else launch('five-prisons',false,!skipOpening,skipOpening);}
 async function launch(id,loadSave,withPrologue=false,skipOpening=false){if(busy)return;skipOpening=skipOpening&&!loadSave&&canSkipOpening(storage);busy=true;selected={id,load:loadSave,prologue:withPrologue,skipOpening};error=null;errorNote.textContent='';errorRetry.hidden=true;block('onboarding',true);
  try{validate(id);await unlock();
   // Starting a new campaign from an existing worker needs a fresh canvas and
   // native session. Reload only after explicit confirmation, carrying choices.
   const prologue=!loadSave&&!skipOpening&&id==='five-prisons'&&(withPrologue||new URL(location.href).searchParams.get('prologue')==='1');
   // MEG3N's factory starts from the campaign page too (start=): ?level=meg3n-factory is its stand-alone page.
   if(active()){const u=new URL(location.href);if(getLevel(id)?.scored&&id!=='meg3n-factory'){u.searchParams.set('level',id);u.searchParams.delete('start');}else{u.searchParams.delete('level');u.searchParams.set('start',id);}u.searchParams.set('ceo',picker.id);u.searchParams.set('play','1');if(loadSave)u.searchParams.set('load','1');else u.searchParams.delete('load');if(prologue)u.searchParams.set('prologue','1');else u.searchParams.delete('prologue');if(skipOpening)u.searchParams.set('skipopening','1');else u.searchParams.delete('skipopening');location.assign(u);return;}
   // New Game (2026-10-12): the chosen founder's intro film, full-screen, then the prologue.
   // The engine keeps downloading behind it; any key or Skip ends it.
   const preload=warm();preload.catch(()=>{});if(prologue)await founderFilm();else if(!loadSave&&!skipOpening)await levelFilm(id);show('loading');await preload;if(!loadSave){try{if(canSkipOpening(storage))storage?.setItem(OPENING_COMPLETE_KEY,'1');storage?.removeItem(CAMPAIGN_KEY);}catch{}}loadingNote.textContent='STARTING ENGINE';await start(id,{load:loadSave,prologue,skipOpening});firstVisit=false;close();
  }catch(e){show('loading');errorNote.textContent=String(e.message||e);error=e.reload?'reload':'retry';errorRetry.hidden=false;errorRetry.focus();}finally{busy=false;}
 }
 async function filmFallback(id){
  const overlay=document.createElement('div');overlay.id='intro-video';overlay.className='iv-text';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Level briefing');const body=document.createElement('div');body.className='iv-fallback';heading(body,MAPS.find(m=>m[0]===id)?.[1]||'p(DOOM)');note(body,id==='hal-station'?'HAL3000 CONTROLS THE DOORS. FIND THE FIVE PRISONERS. FOOL HIS RULES, THEN GET EVERYONE TO THE REFUGE.':id==='meg3n-factory'?'MEG3N RUNS THE TOY FACTORY. FIND THE FIVE PRISONERS. KEEP HER ON YOUR SCREEN, THEN GET EVERYONE TO THE BREAK ROOM.':'THE MACHINES HAVE TAKEN OVER. FIVE SURVIVORS ARE HELD FOR EXPERIMENTS. FREE THEM, FIND THE REFUGE, AND LOOK FOR A WAY OUT.');note(body,'FILM UNAVAILABLE. YOU CAN STILL PLAY.');overlay.append(body);document.body.append(overlay);
  await new Promise(resolve=>{const finish=()=>{removeEventListener('keydown',key,true);overlay.remove();resolve();},key=e=>{if(['Escape','Enter','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();finish();}};const go=button(body,'CONTINUE',finish);addEventListener('keydown',key,true);go.focus();});
 }
 async function founderFilm(){video.pause();root.hidden=true;const result=await playIntroVideo(picker.id,{volume:preferences.data.music,sound:preferences.data.filmSound});if(result==='unavailable')await filmFallback();}
 async function replayStory(){video.pause();root.hidden=true;const result=await playIntroVideo(picker.id,{volume:preferences.data.music,sound:preferences.data.filmSound});if(result==='unavailable')await filmFallback();show('options');}
 async function replayLevel(id){await levelFilm(id,{force:true});show('options');}
 preferences.subscribe(d=>{for(const [key,{input,value}]of Object.entries(sliders)){input.value=d[key];value.textContent=key==='sensitivity'?d[key].toFixed(1):Math.round(d[key]*100)+'%';}for(const key of ['filmSound','reducedMotion']){const b=root.querySelector('#option-'+key);b.textContent=b.dataset.label+': '+(d[key]?'ON':'OFF');}for(const [code,b]of Object.entries(binds))b.textContent=b.dataset.label+' — '+keyName(d.keys[code]);if(bgId)background();});
 root.addEventListener('change',e=>{if(e.target.name==='ceo')background();});
 window.addEventListener('keydown',e=>{if(root.hidden||e.target.closest?.('dialog[open]'))return;if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(capture){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){capture=null;preferences.set('sfx',preferences.data.sfx);return;}keysNote.textContent=preferences.bind(capture,e.code)||'KEY CHANGED';capture=null;return;}
  if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(busy||page==='loading')return;if(page==='main'&&active())close();else show(page==='levels'?'hero':page==='hero'?'main':page==='title'?'title':'main');return;}
  if(page==='title'&&['Enter','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();openMain(true);return;}
  if(['ArrowUp','ArrowDown'].includes(e.code)&&e.target.type!=='range'&&e.target.type!=='radio'){const choices=[...views[page].querySelectorAll('button:not([disabled]):not([hidden]),input')].filter(b=>!b.closest('[hidden]'));const at=choices.indexOf(document.activeElement);choices[(at+(e.code==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();e.preventDefault();e.stopImmediatePropagation();}
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else if(!root.hidden)background();});
 root.querySelector('.boot-title')?.remove();show('title');
 const handoff=new URL(location.href);if(handoff.searchParams.get('play')==='1'){const id=handoff.searchParams.get('start')||handoff.searchParams.get('level')||'five-prisons',loadSave=handoff.searchParams.get('load')==='1',skipOpening=handoff.searchParams.get('skipopening')==='1';handoff.searchParams.delete('play');handoff.searchParams.delete('start');handoff.searchParams.delete('load');handoff.searchParams.delete('skipopening');history.replaceState(null,'',handoff);setTimeout(()=>launch(id,loadSave,false,skipOpening),50);}
 // READ THIS! straight from the game (SAFE MODE's install dialogs, 2026-10-14); BACK leads to the menu.
 return {refreshSavedResults,open:()=>openMain(),openRead(){openMain();show('read');},toggle(){if(busy||page==='loading')return;root.hidden?openMain():page==='main'?close():show('main');},close,levelFilm,isOpen:()=>!root.hidden&&!!active(),isVisible:()=>!root.hidden,getState:()=>({page,busy,selected,error,video:bgId,preferences:preferences.data}),progress(p){progress.value=p.percent??0;if(p.percent==null)progress.removeAttribute('value');bytesNote.textContent=`${(p.loaded/1048576).toFixed(1)} MB${p.total?' / '+(p.total/1048576).toFixed(1)+' MB':''}${p.percent!=null?' · '+p.percent+'%':''}`;},loading(label){show('loading');loadingNote.textContent=label;},failed(message){show('loading');error='reload';errorNote.textContent=message;errorRetry.hidden=false;errorRetry.focus();},heroNext:continueHero};
}
