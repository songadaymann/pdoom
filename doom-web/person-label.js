// Project native bodies into the engine view; use the cursor when unlocked and
// the crosshair while aiming. Visibility comes from native wall/door sight tests.
export function nativePersonRects(world,viewHeight=41){
 if(!world)return [];
 const a=world.angle*Math.PI/180,p=world.pitch*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cp=Math.cos(p),sp=Math.sin(p);
 const out=[];
 for(const person of world.people||[]){
  if(!person.alive||person.controlled||!person.visible)continue;
  const dx=person.x-world.x,dy=person.y-world.y,hd=dx*c+dy*s,right=dx*s-dy*c;
  if(Math.hypot(dx,dy)>960)continue;
  const eye=world.z+viewHeight,points=[person.z,person.z+person.pose_height].map(z=>{
   const dz=z-eye,depth=hd*cp-dz*sp;return {depth,x:right/depth,y:(hd*sp+dz*cp)/(depth/1.6)};
  });
  if(points.some(v=>v.depth<8))continue;
  const width=(person.hit_width||24)/Math.min(...points.map(v=>v.depth));
  out.push({name:person.name,depth:hd,left:Math.min(...points.map(v=>v.x))-width/2,right:Math.max(...points.map(v=>v.x))+width/2,
   bottom:Math.min(...points.map(v=>v.y)),top:Math.max(...points.map(v=>v.y))});
 }
 return out;
}
export function createPersonLabel(stage){
 const label=document.createElement('p');label.id='person-label';label.hidden=true;stage.append(label);
 let surface=null,rects=[],enabled=false,pointer=null;
 function refresh(){
  if(!enabled||!surface||surface.hidden){label.hidden=true;return;}
  const r=surface.getBoundingClientRect(),locked=document.pointerLockElement===surface||matchMedia('(pointer:coarse)').matches;
  const at=locked?{x:r.left+r.width/2,y:r.top+r.height/2}:pointer;
  if(!at||at.x<r.left||at.x>r.right||at.y<r.top||at.y>r.bottom){label.hidden=true;return;}
  const x=(at.x-r.left)/r.width*2-1,y=1-(at.y-r.top)/r.height*2;
  const hit=rects.filter(v=>x>=v.left&&x<=v.right&&y>=v.bottom&&y<=v.top).sort((a,b)=>a.depth-b.depth)[0];
  label.hidden=!hit;if(!hit)return;
  label.textContent=hit.name;const box=stage.getBoundingClientRect();
  label.style.left=Math.max(80,Math.min(box.width-80,at.x-box.left))+'px';
  label.style.top=Math.max(8,at.y-box.top-32)+'px';
 }
 stage.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};refresh();});
 stage.addEventListener('pointerleave',()=>{pointer=null;refresh();});
 document.addEventListener('pointerlockchange',refresh);window.addEventListener('resize',refresh);
 return {update(items,canvas,active=true){rects=items;surface=canvas;enabled=active;refresh();},hide(){enabled=false;label.hidden=true;},getState:()=>({name:label.hidden?null:label.textContent})};
}
