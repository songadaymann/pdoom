import * as THREE from 'three';

// Old screensavers drift across the Bliss sky, so the wallpaper reads as a Windows
// desktop: a field of waving four-pane flags streaming out of the distance (after
// Windows 3.1's Flying Windows) and a flock of winged toasters with slices of toast
// (after After Dark). Every sprite is drawn here, pixel by pixel; no art is copied
// from either original. Motion is relative to the camera, like a screensaver: the
// sky is always full, wherever you walk.

type Frames=THREE.Texture[];
// Sprites ignore negative scale, so a mirrored flyer uses mirrored copies of its frames.
const mirrored=(frames:Frames)=>frames.map(t=>{const m=t.clone();m.wrapS=THREE.RepeatWrapping;m.repeat.x=-1;m.offset.x=1;m.needsUpdate=true;return m;});
function art(w:number,h:number,frames:number,paint:(px:(x:number,y:number,c:string)=>void,frame:number)=>void):Frames{
 return Array.from({length:frames},(_,f)=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;
  paint((x,y,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),1,1);},f);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
 });
}

// A four-pane flag rippling in the wind, with three speed dashes trailing behind it.
function flagArt():Frames{
 const panes=[['#e8412c','#b5271a'],['#3fae49','#2a7f33'],['#2f6fd6','#1f4ea1'],['#f5c518','#c99a0c']];
 return art(22,18,4,(px,f)=>{
  for(let x=0;x<16;x++){
   const wave=Math.sin(x*.45+f*Math.PI/2)*1.4,col=x<8?0:1;
   for(let y=0;y<14;y++){
    if(x===7||y===6)continue;                      // the dark cross between panes
    const [lit,shade]=panes[(y<6?0:2)+col];
    px(6+x,2+y+wave,(x+y)%5===0?shade:lit);
   }
  }
  for(const [y,len] of [[4,4],[9,5],[14,3]])for(let i=0;i<len;i++)if(i%2===0)px(i,y+Math.sin(f*Math.PI/2)*.8,'#111');
 });
}

// A chrome toaster on white feathered wings, facing left. Four flap frames: each wing
// is a fan of thick feathers from a root on the toaster's back, raised, level, lowered.
function toasterArt():Frames{
 const lift=[62,24,-14,24];
 return art(34,30,4,(px,f)=>{
  const wing=(rx:number,ry:number,base:number,lit:string,shade:string)=>{
   [17,15,12,9].forEach((len,k)=>{
    const a=(base-k*14)*Math.PI/180,dx=Math.cos(a),dy=-Math.sin(a);
    for(let t=0;t<=len;t+=.5){const x=rx+dx*t,y=ry+dy*t,w=t<len-2?2:1;
     for(let u=0;u<w;u++)for(let v=0;v<2;v++)px(x+u,y+v,v===1||k===3?shade:lit);}
   });
  };
  wing(16,15,lift[f]+10,'#d6dbe3','#aab2bf');                 // far wing, behind the body
  for(let x=4;x<23;x++)for(let y=14;y<26;y++){                // body
   const edge=x===4||x===22||y===25||y===14&&(x===5||x===21),corner=y===14&&(x===4||x===22);
   if(corner)continue;
   px(x,y,edge?'#4a505c':y===15?'#eef2f7':x<8?'#f6f8fb':x>18?'#88919f':'#c4cbd6');
  }
  for(const sx of [8,14])for(let x=sx;x<sx+4;x++){px(x,14,'#1f2228');px(x,13,'#7c8594');}   // slots
  for(let y=17;y<21;y++)px(3,y,'#353a43');px(2,17,'#353a43');px(1,17,'#353a43');            // lever
  for(let x=6;x<22;x+=3){px(x,26,'#353a43');px(x+1,26,'#353a43');}                        // feet
  wing(17,16,lift[f],'#ffffff','#dfe3ea');                     // near wing
 });
}

function toastArt():Frames{
 return art(14,14,1,px=>{
  for(let x=1;x<13;x++)for(let y=2;y<13;y++){
   const crust=x===1||x===12||y===12||y===2&&x>2&&x<11,top=y<4&&(x<3||x>10);
   if(top&&(x===1||x===12))continue;
   px(x,y,crust?'#7a4416':(x+y)%7===0?'#c98a3d':'#e2a85a');
  }
  for(const x of [3,4,9,10])px(x,1,'#7a4416');
 });
}

export function makeScreensavers(scene:THREE.Scene,cheap=false){
 const group=new THREE.Group();group.name='screensavers';scene.add(group);
 const flag=flagArt(),toaster=toasterArt(),toast=toastArt(),toasterR=mirrored(toaster),toastR=mirrored(toast);
 const material=(map:THREE.Texture)=>new THREE.SpriteMaterial({map,transparent:true,alphaTest:.5,fog:false,depthWrite:true});
 type Flyer={sprite:THREE.Sprite;vel:THREE.Vector3;frames:Frames;flipped:Frames;phase:number;size:number;kind:'flag'|'toaster'|'toast'};
 const flyers:Flyer[]=[],tmp=new THREE.Vector3(),rnd=(a:number,b:number)=>a+Math.random()*(b-a);
 // Flying windows: born near a far vanishing point in the sky ahead of where you wake
 // (south and up, -Z), they rush outwards and past overhead, then are born again.
 const SOURCE=new THREE.Vector3(0,.42,-1).normalize();
 function launchFlag(f:Flyer,cam:THREE.Vector3,anywhere=false){
  const spread=new THREE.Vector3(rnd(-.35,.35),rnd(-.1,.3),rnd(-.35,.35));
  const from=SOURCE.clone().add(spread).normalize().multiplyScalar(anywhere?rnd(60,250):rnd(220,260));
  f.sprite.position.copy(cam).add(from);f.sprite.position.y=Math.max(cam.y+14,f.sprite.position.y);
  // Towards a point just overhead and to one side, so none flies through your head.
  const aim=new THREE.Vector3(rnd(-30,30),rnd(14,30),rnd(-30,30)).add(cam);
  f.vel.copy(aim).sub(f.sprite.position).normalize().multiplyScalar(rnd(24,34));
 }
 // Toasters and toast: a slow diagonal flock, gently descending, filling a box of sky
 // around you and wrapping at its edges.
 const FLOCK=new THREE.Vector3(-1,-.18,.35).normalize(),BOX=130;
 function placeFlock(f:Flyer,cam:THREE.Vector3,edge=false){
  f.sprite.position.set(cam.x+rnd(-BOX,BOX),cam.y+rnd(22,60),cam.z+rnd(-BOX,BOX));
  if(edge)f.sprite.position.addScaledVector(FLOCK,-BOX*1.1);
  f.vel.copy(FLOCK).multiplyScalar(f.kind==='toast'?rnd(5.5,7):rnd(6,8));
 }
 const counts=cheap?{flag:10,toaster:6,toast:3}:{flag:18,toaster:9,toast:5};
 for(const kind of ['flag','toaster','toast'] as const)for(let i=0;i<counts[kind];i++){
  const frames=kind==='flag'?flag:kind==='toaster'?toaster:toast,size=kind==='flag'?rnd(6,8):kind==='toaster'?rnd(8,10):rnd(4,5);
  const sprite=new THREE.Sprite(material(frames[0]));sprite.scale.set(size*frames[0].image.width/frames[0].image.height,size,1);
  group.add(sprite);flyers.push({sprite,vel:new THREE.Vector3(),frames,flipped:kind==='flag'?frames:kind==='toaster'?toasterR:toastR,phase:Math.random()*4,size,kind});
 }
 let placed=false,flapped=0;
 return {
  group,
  update(dt:number,cam:THREE.Vector3,camera:THREE.Camera){
   if(!placed){placed=true;for(const f of flyers)f.kind==='flag'?launchFlag(f,cam,true):placeFlock(f,cam);}
   flapped+=dt;const right=tmp.set(1,0,0).applyQuaternion(camera.quaternion).clone();
   for(const f of flyers){
    f.sprite.position.addScaledVector(f.vel,dt);
    const rel=f.sprite.position.clone().sub(cam);
    if(f.kind==='flag'){
     // Past us (behind, or too close overhead): born again far away.
     if(rel.dot(SOURCE)<-60||rel.length()<14)launchFlag(f,cam);
    }else{
     if(Math.abs(rel.x)>BOX*1.2||Math.abs(rel.z)>BOX*1.2||rel.y<14)placeFlock(f,cam,true);
    }
    // The art faces left; mirror it while it crosses the screen to the right.
    const frame=Math.floor((flapped*(f.kind==='flag'?6:8)+f.phase)%f.frames.length),set=f.vel.dot(right)>0?f.flipped:f.frames;
    const mat=f.sprite.material as THREE.SpriteMaterial;if(mat.map!==set[frame]){mat.map=set[frame];mat.needsUpdate=true;}
   }
  },
  getState:()=>({flags:counts.flag,toasters:counts.toaster,toast:counts.toast,visible:group.visible})
 };
}
