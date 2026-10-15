// Only the game's controls reach SDL. Internal map/pause keys use send() directly.
const controls=new Set(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyG','KeyR','KeyT','KeyC',
 'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','ShiftLeft','ShiftRight',
 'ControlLeft','ControlRight','Space','Digit1','Digit2','Digit3','F5']);
export const isGameControl=code=>controls.has(code);

export function createGamePause({stage,block,restart}){
 const panel=document.createElement('section');panel.id='game-pause';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Game paused');
 const heading=document.createElement('h2');heading.textContent='PAUSED';
 const resume=document.createElement('button');resume.textContent='Resume';resume.id='pause-resume';
 const retry=document.createElement('button');retry.textContent='Restart level';retry.id='pause-restart';
 panel.append(heading,resume,retry);stage.append(panel);
 function set(open){panel.hidden=!open;stage.classList.toggle('game-paused',open);block('game-pause',open);if(open)resume.focus();}
 resume.onclick=()=>set(false);retry.onclick=()=>{set(false);setTimeout(restart,100);};
 return {toggle(){set(panel.hidden);},isOpen:()=>!panel.hidden,close(){if(!panel.hidden)set(false);}};
}
