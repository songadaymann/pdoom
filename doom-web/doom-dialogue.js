const el=id=>document.getElementById(id);
export function updateDoomDialogue(world,dialogue,ended){
 const box=el('message');
 let status=el('status-line');if(!status){status=document.createElement('p');status.id='status-line';document.querySelector('#game-text').append(status);}
 status.textContent=ended?'':world.message||'';status.hidden=!status.textContent;
 if(ended){box.hidden=true;return;}
 if(dialogue?.remaining>0&&dialogue.text){
  const speaker=document.createElement('span'),line=document.createElement('span');
  speaker.className='dialogue-speaker';speaker.textContent=dialogue.speaker;
  line.className='dialogue-line';line.textContent=dialogue.text;
  box.replaceChildren(speaker,line);box.classList.add('spoken');box.hidden=false;
 }else{
  box.classList.remove('spoken');box.textContent='';box.hidden=true;
 }
}
