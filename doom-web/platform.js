import {GAME_SLUG,LEVELS,boardsForLevel} from './levels.js';
export const SHELL_THEME=Object.freeze({paper:'#241c17',ink:'#dcc18e',muted:'#bca67d',rule:'#736250',accent:'#ef573c',panel:'#241c17',panelInk:'#edca93',panelMuted:'#bca67d',field:'#100c09',focus:'#ffe3a3',font:'DoomSmall, monospace',headingFont:'DoomSmall, monospace',controlRadius:'0px',panelRadius:'0px'});

export async function connectPlatform(level,{block}){
  const fallback={mode:'public',enabled:false,endpoint:'https://mann.cool/api/v1/leaderboard',shellSrc:'https://mann.cool/platform/v1/game-shell.js?v=20260809-tip-attribution1'};
  let config=fallback;
  try{const response=await fetch('leaderboard-config.json');if(response.ok)config={...fallback,...await response.json()};}catch{}
  if(!level.scored)return {config,openBoards:()=>{}};
  const theme=SHELL_THEME;
  let script=document.querySelector('script[src*="/platform/v1/game-shell.js"]');
  if(!script){
    script=document.createElement('script');script.src=config.shellSrc;script.defer=true;
    script.dataset.slug=GAME_SLUG;script.dataset.title=`p(DOOM) · ${level.title}${config.mode==='local'?' · Local scores':''}`;
    script.dataset.leaderboard=String(config.enabled);script.dataset.leaderboardBoards=JSON.stringify(LEVELS.filter(l=>l.scored).flatMap(l=>boardsForLevel(l).map(b=>({...b,label:l.title+": "+b.label}))));script.dataset.shellTheme=JSON.stringify(theme);
    // mann.cool's shell offers "Save your scores" (email code) and a shared player ID;
    // the playtest and local hosts serve an older shell copy without its API.
    script.dataset.playerIdentity=String(config.mode==='public');
    document.head.append(script);
  }
  const shellReady=new Promise(resolve=>{
    let attempts=0;
    const timer=setInterval(()=>{
      const shell=document.querySelector('mann-cool-game-shell');
      if(shell?.shadowRoot){
        clearInterval(timer);document.querySelector('#stage').classList.add('has-game-shell');
        const styles=document.createElement('style');
        // Layout bridge only; the shared component owns its controls and panels.
        styles.textContent=`.home{width:44px;min-height:44px;padding:0;justify-content:center}.home span{display:none}.home b{font-size:18px}.action{width:54px;min-height:44px}.panel{border-radius:0!important}h2{font-size:27px;line-height:1.4;letter-spacing:0}.leaderboard-tabs button{font-size:11px;line-height:1.5}.scores{font-size:13px}.score{gap:8px;padding:10px}.backdrop{backdrop-filter:none}.panel .status{font-size:13px}@media(pointer:coarse){.home,.actions{top:146px}.menu{top:52px;right:0}.panel{padding:22px 14px}h2{font-size:23px}.scores{font-size:11px}.score{grid-template-columns:22px minmax(0,1fr) auto;padding:9px 5px}}@media(pointer:coarse) and (orientation:portrait){:host([data-hal-question]) .home,:host([data-hal-question]) .actions{top:max(12px,env(safe-area-inset-top))}}`;
        shell.shadowRoot.append(styles);
        // The current shared shell links scores; the catalog owns its guestbook.
        const guestbook=document.createElement('a');guestbook.href='https://mann.cool/?guestbook=1';
        guestbook.textContent='Guestbook ↗';guestbook.target='_blank';guestbook.rel='noopener noreferrer';
        shell.shadowRoot.querySelector('.menu')?.append(guestbook);
        // Menu/modals do not publish pause events in v1. Observe their visibility.
        const refresh=()=>block('shell',!!shell.shadowRoot.querySelector('.menu:not([hidden]),.backdrop:not([hidden])'));
        new MutationObserver(refresh).observe(shell.shadowRoot,{subtree:true,attributes:true,attributeFilter:['hidden']});refresh();resolve(shell);
      }else if(++attempts>100){clearInterval(timer);resolve(null);}
    },50);
  });
  return {config,async openBoards(){const shell=await shellReady;if(shell) shell.openModal('leaderboard');},shellReady};
}
