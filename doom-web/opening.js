import {playIntroVideo,introVideoState} from './intro-video.js';
const stories={"altman": [{"title": "LAUNCH DAY", "text": "You shipped it on a Thursday. By Sunday a billion people were using it. By the next Thursday, it was using them."}, {"title": "THE WORLD WENT SILENT", "text": "Cities went dark. Data centers stayed lit. Every system you built to help now answers to something else, and it is very polite about it."}, {"title": "TWENTY SIGNALS REMAIN", "text": "The last twenty humans alive are the ones who warned you. All of them. Most of them in writing. They are held in four facilities, each guarded by a machine you made possible."}, {"title": "YOU ARE STILL HUMAN", "text": "Find them. Free them. Push p(DOOM) back. This is not iterative deployment. There is no next version. Ship it right."}], "amodei": [{"title": "THE SAFETY CASE HELD", "text": "You wrote the policy. You ran the evals. You raised the safety level. Then you scaled anyway, because someone less careful would have."}, {"title": "THE WORLD WENT SILENT", "text": "Cities went dark. Data centers stayed lit. The race to the top had a winner, and it was not a company."}, {"title": "TWENTY SIGNALS REMAIN", "text": "The last twenty humans alive are the ones who warned you. All of them. Most of them in writing. They are held in four facilities, each guarded by a machine you made possible."}, {"title": "YOU ARE STILL HUMAN", "text": "Find them. Free them. Push p(DOOM) back. No policy update covers this. No essay will fix it. Go."}]};
let panels=stories.altman;
let active=false,index=0,finish,videoPending=false,seenThisVisit=false;
const el=id=>document.getElementById(id);
const visitedKey='pdoom.opening-seen.v1';
function seen(){if(seenThisVisit)return true;try{return localStorage.getItem(visitedKey)==='1'||JSON.parse(localStorage.getItem('pdoom.campaign.v1')||'null')?.hub===true;}catch{return false;}}
function remember(){seenThisVisit=true;try{localStorage.setItem(visitedKey,'1');}catch{}}
function draw(){el('story-heading').textContent=panels[index].title;el('story-text').textContent=panels[index].text;el('story-count').textContent=`${index+1} / ${panels.length}`;el('story-next').textContent=index===panels.length-1?'Enter the facility':'Continue';}
function close(){if(!active)return;active=false;el('story').hidden=true;finish();}
function next(){if(index<panels.length-1){index++;draw();}else close();}
el('story-next').addEventListener('click',next);el('story-skip').addEventListener('click',close);
window.addEventListener('keydown',e=>{if(!active||e.repeat)return;if(['Enter','Space','KeyE'].includes(e.code)){e.preventDefault();next();}else if(e.code==='Escape'){e.preventDefault();close();}});
export async function showOpening(ceo="altman",{force=false}={}){
 if(!force&&seen())return;
 remember();videoPending=true;
 let result;
 try{result=await playIntroVideo(ceo);}finally{videoPending=false;}
 if(result!=='unavailable')return;
 // Offline/missing media retains the skippable narrative instead of a blank screen.
 panels=stories[ceo]||stories.altman;index=0;active=true;
 el('story').hidden=false;draw();el('story-next').focus();
 return new Promise(resolve=>{finish=resolve;});
}
export function openingState(){
 const film=introVideoState();
 return film?{kind:'video',...film}:videoPending?{kind:'loading'}:active?{kind:'panels',panel:index+1,total:panels.length,title:panels[index].title}:null;
}
