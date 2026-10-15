// CHOOSE YOUR CEO (docs/GAME-SPEC.md §2.1, §5.4): the launcher's two-entry menu.
// The CEO you pick is the face in the status bar for your own body (controlled 0).
// The mechanics are identical, so nothing else depends on the choice.
//   ?ceo=altman|amodei   overrides the remembered choice (tests, links)
//   ?ceo=doomguy         hidden QA/fidelity setting: Doomguy's own face, not offered in the menu
// With no parameter and nothing remembered, one is preselected at random each boot.
export const CEOS=Object.freeze(['altman','amodei']);// alphabetical, as the menu lists them
export const QA_FACE='doomguy';
export const CEO_STORAGE_KEY='pdoom-ceo-v1';
const FACE_ROOT='local/ui/faces/';
// Keep saved campaigns and existing links while using Claude's new characters.
export function ceoFaceId(id){return {altman:'samwise',amodei:'mario'}[id]||id;}

export function parseCeo(value,{qa=false}={}){
  const id=String(value??'').trim().toLowerCase();
  return CEOS.includes(id)||qa&&id===QA_FACE?id:null;
}
// Storage may be missing or throw (private mode, blocked site data); never fatal.
export function browserStorage(){try{return window.localStorage;}catch{return null;}}
export function readCeo(storage){try{return parseCeo(storage?.getItem(CEO_STORAGE_KEY));}catch{return null;}}
export function rememberCeo(storage,id){
  if(!parseCeo(id))return false;// the QA face is never remembered
  try{storage.setItem(CEO_STORAGE_KEY,id);return storage.getItem(CEO_STORAGE_KEY)===id;}catch{return false;}
}
export function resolveCeo({search='',storage=null,random=Math.random}={}){
  const fromUrl=parseCeo(new URLSearchParams(search).get('ceo'),{qa:true});
  if(fromUrl)return {id:fromUrl,source:'url'};
  const stored=readCeo(storage);
  if(stored)return {id:stored,source:'stored'};
  const i=Math.min(CEOS.length-1,Math.max(0,Math.floor(Number(random())*CEOS.length)||0));
  return {id:CEOS[i],source:'random'};
}
// Restart reloads the page. When the choice could not be remembered (storage throws)
// it rides along in the URL instead, so the same CEO comes back.
export function restartUrl(href,id,storage){
  const url=new URL(href);
  if(url.searchParams.get('ceo')===id||readCeo(storage)===id)return null;// a plain reload keeps it
  url.searchParams.set('ceo',id);return url.href;
}

export function mountCeoPicker(root,{choice,storage=null,onChange=()=>{},onEnter=()=>{}}={}){
  let id=choice?.id||CEOS[0],source=choice?.source||'random',locked=false,grinTimer=0;
  const radios=[...root.querySelectorAll('input[name="ceo"]')];
  const launcher=root.closest('#launcher')||root;
  const reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Each entry shows its CEO's own STFST01. If that set is missing, Doomguy's
  // (the bar's own patch), and failing that the name alone.
  const faceSrc=(ceo,lump)=>`${FACE_ROOT}${ceoFaceId(ceo)}/${lump}.png`;
  for(const img of root.querySelectorAll('.ceo-face img')){
    img.addEventListener('error',()=>{
      const lump=img.dataset.lump||'STFST01',fallback=`local/ui/stbar/${lump}.png`;
      if(!img.getAttribute('src').endsWith(fallback)){img.dataset.fallback='doomguy';img.src=fallback;}
      else img.hidden=true;
    });
  }
  function setFace(option,lump){
    const img=option.querySelector('.ceo-face img');if(!img)return;
    img.hidden=false;delete img.dataset.fallback;img.dataset.lump=lump;img.src=faceSrc(option.dataset.ceo,lump);
  }
  function sync(){
    for(const radio of radios){
      radio.checked=radio.value===id;
      radio.closest('.ceo-option').classList.toggle('selected',radio.checked);
    }
    root.dataset.ceo=id;
  }
  // Keep a ?ceo= link in step with the menu, so a reload shows what was picked.
  function syncUrl(){
    try{const url=new URL(location.href);if(url.searchParams.has('ceo')&&url.searchParams.get('ceo')!==id){url.searchParams.set('ceo',id);history.replaceState(history.state,'',url.href);}}catch{}
  }
  // Doom's evil grin, the face it makes on picking up a weapon, for 2 s on the new pick.
  function grin(option){
    clearTimeout(grinTimer);
    for(const other of root.querySelectorAll('.ceo-option'))setFace(other,'STFST01');
    if(reduceMotion||!option)return;
    setFace(option,'STFEVL0');
    grinTimer=setTimeout(()=>setFace(option,'STFST01'),2000);
  }
  function select(next,how='picked'){
    next=parseCeo(next);if(!next||locked)return;
    const changed=next!==id;id=next;source=how;
    rememberCeo(storage,id);sync();syncUrl();
    if(changed){grin(root.querySelector(`.ceo-option[data-ceo="${id}"]`));onChange(id);}
  }
  for(const radio of radios){
    // 'click' also fires on the entry that is already checked (for example the random
    // preselection): picking it is still a choice, so it is remembered too.
    for(const type of ['click','change'])radio.addEventListener(type,()=>{if(radio.checked)select(radio.value);});
    // Enter picks the entry under the cursor and starts, as in Doom's menus. The
    // event stops here so the opening crawl does not also take it as "continue".
    radio.addEventListener('keydown',e=>{
      if(e.key!=='Enter'||locked)return;
      e.preventDefault();e.stopPropagation();select(radio.value);onEnter();
    });
  }
  // Doom-menu cursor: arrow keys move the choice from anywhere on the launcher.
  window.addEventListener('keydown',e=>{
    if(locked||launcher.hidden||root.hidden||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey)return;
    const step={ArrowUp:-1,ArrowLeft:-1,ArrowDown:1,ArrowRight:1}[e.key];
    const target=e.target,onLauncher=target===document.body||target===document.documentElement||launcher.contains(target);
    if(!step||!onLauncher||radios.includes(target)||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName))return;// not inside the platform shell's panels
    e.preventDefault();
    const at=CEOS.indexOf(id),next=at<0?(step>0?0:CEOS.length-1):(at+step+CEOS.length)%CEOS.length;
    select(CEOS[next]);radios.find(r=>r.value===CEOS[next])?.focus();
  });
  sync();
  return {
    get id(){return id;},
    select,
    unlock(){locked=false;root.classList.remove('locked');for(const radio of radios)radio.disabled=false;},
    // Called when the run starts: the choice is fixed and remembered for next time.
    lock(){
      locked=true;clearTimeout(grinTimer);
      for(const option of root.querySelectorAll('.ceo-option'))setFace(option,'STFST01');
      for(const radio of radios)radio.disabled=true;
      root.classList.add('locked');rememberCeo(storage,id);
    },
    restart(){const url=restartUrl(location.href,id,storage);if(url)location.replace(url);else location.reload();},
    getState(){
      return {id,source,locked,remembered:readCeo(storage)===id,offered:[...CEOS],
        selected:radios.filter(r=>r.checked).map(r=>r.value),
        faces:[...root.querySelectorAll('.ceo-option')].map(o=>{const img=o.querySelector('.ceo-face img');return {ceo:o.dataset.ceo,src:img?.getAttribute('src')||null,fallback:img?.dataset.fallback||null,visible:!!img&&!img.hidden};})};
    }
  };
}
