const bios={
 'Liron Shapira':'ASKED WHAT YOUR P(DOOM) IS',
 'Stuart Russell':'WROTE THE TEXTBOOK. LITERALLY.',
 'Eliezer Yudkowsky':'HAS BEEN SAYING THIS SINCE 2001',
 'Geoffrey Hinton':'LEFT THE BUILDING. NOW LEAVE THIS ONE.',
 'Holly Elmore':'HAS PICKETED BOTH YOUR OFFICES',
 'Rob Miles':'MADE A VIDEO ABOUT THIS ROBOT IN 2017',
 'Dan Hendrycks':'WROTE THE EXAM YOUR MODELS FAIL',
 'Nate Soares':'CO-WROTE THE BOOK WITH THE TITLE',
 'Roman Yampolskiy':'WROTE THE PAPER ON AI BOXES. IS IN A BOX.',
 'Beth Barnes':'EVALUATES MODELS. THIS ONE NEEDS WORK.'
};
export function createStoryBeats(block,success=()=>{}){
 const stage=document.querySelector('#stage');const card=document.createElement('div');card.id='discovery-card';card.hidden=true;stage.append(card);
 let queue=[],timer=null;
 // Each card pauses the level for 3.5 s; SPACE, ENTER or E skips it (2026-11-09, Jonathan: replays shouldn't make
 // you sit through the exposition again). The skipping press never reaches the game.
 const SKIP=new Set(['Space','Enter','NumpadEnter','KeyE']);
 const hide=()=>{clearTimeout(timer);card.hidden=true;stage.classList.remove('discovery-active');block('discovery',false);timer=null;show();};
 const show=()=>{if(!queue.length)return;const name=queue.shift();card.replaceChildren();const title=document.createElement('strong'),bio=document.createElement('p'),skip=document.createElement('small');title.textContent=name.toUpperCase();bio.textContent=bios[name]||'ONE OF THE LAST HUMANS';skip.textContent='SPACE — SKIP';card.append(title,bio,skip);card.hidden=false;stage.classList.add('discovery-active');block('discovery',true);success();timer=setTimeout(hide,3500);};
 addEventListener('keydown',e=>{if(card.hidden||e.repeat||!SKIP.has(e.code))return;e.preventDefault();e.stopImmediatePropagation();hide();},true);
 return {discover(name){if(!bios[name])return;queue.push(name);if(!timer)show();},reset(){clearTimeout(timer);timer=null;queue=[];card.hidden=true;stage.classList.remove('discovery-active');block('discovery',false);}};
}
