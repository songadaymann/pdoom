import * as THREE from 'three';
import {PAL,rand,resolve} from './kit';

/* Everyone you saved, using the meadow's own figure sprites (doom-web/outside-assets: 4 walk
 * frames x 8 directions), lightly tinted as if digitised, plus the guide (the founder you didn't
 * pick), who keeps to your right shoulder and can't be hurt for long. */
export const CAST=[['liron','Liron Shapira'],['stuart','Stuart Russell'],['eliezer','Eliezer Yudkowsky'],['hinton','Geoffrey Hinton'],['holly','Holly Elmore'],
 ['rob','Rob Miles'],['dan','Dan Hendrycks'],['nate','Nate Soares'],['roman','Roman Yampolskiy'],['beth','Beth Barnes'],
 ['zvi','Zvi Mowshowitz'],['victoria','Victoria Krakovna'],['max','Max Tegmark'],['paul','Paul Christiano'],['ajeya','Ajeya Cotra'],
 ['tallinn','Jaan Tallinn'],['bostrom','Nick Bostrom'],['kokotajlo','Daniel Kokotajlo'],['grace','Katja Grace'],['bengio','Yoshua Bengio']] as const;

const loader=new THREE.TextureLoader();
async function tex(url:string){try{const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;}catch{return null;}}
export async function loadCast(guide:'mario'|'samwise'){
 const [people,walk,idle]=await Promise.all([
  Promise.all(CAST.map(([id])=>Promise.all(Array.from({length:32},(_,n)=>tex(`/outside-assets/figure-${id}-${Math.floor(n/8)}-${n%8}.png`))))),
  Promise.all(Array.from({length:16},(_,n)=>tex(`/outside-assets/guide-${guide}-${Math.floor(n/8)}-${n%8}.png`))),
  Promise.all(Array.from({length:8},(_,n)=>tex(`/outside-assets/guide-${guide}-idle-${n}.png`))),
 ]);
 return {people,walk,idle};
}

export class Person{
 sprite:THREE.Sprite;ring:THREE.Mesh;pos=new THREE.Vector3();target=new THREE.Vector3();dodge=new THREE.Vector3();dodgeUntil=0;dodgeAt=-1;pendingDodge=new THREE.Vector3();
 facing=Math.PI;moving=false;down=0;hasDisc=true;nextThrow=rand(3,9);reaction=rand(.3,.9);hop=0;isPlayer=false;
 override:THREE.Vector3|null=null;overrideUntil=0;// somewhere to be instead of the formation (cover from the update)
 constructor(scene:THREE.Scene,public index:number,public id:string,public name:string,private frames:(THREE.Texture|null)[],public guide=false,private idle:(THREE.Texture|null)[]=[]){
  this.sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:frames[0],color:guide?0xd8e4e8:0xa9cbd4,transparent:true,alphaTest:.5}));
  this.sprite.center.set(.5,0);this.sprite.scale.set(1.8,1.8,1);scene.add(this.sprite);
  this.ring=new THREE.Mesh(new THREE.RingGeometry(.34,.5,28).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:guide?PAL.core:PAL.line,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(this.ring);
 }
 hand(out:THREE.Vector3){return out.set(this.pos.x+Math.sin(this.facing)*.45,1.25,this.pos.z+Math.cos(this.facing)*.45);}
 caught(){this.hasDisc=true;}
 knock(from:THREE.Vector3){
  if(this.down>0)return false;this.down=this.guide?1.2:2.2;
  const away=new THREE.Vector3(this.pos.x-from.x,0,this.pos.z-from.z);if(away.lengthSq()<1e-4)away.set(1,0,0);this.pos.addScaledVector(away.normalize(),1.6);resolve(this.pos,.4);return true;
 }
 // Step out of a telegraphed circle after this person's reaction time.
 avoid(center:THREE.Vector3,radius:number,now:number){
  const d=new THREE.Vector3(this.pos.x-center.x,0,this.pos.z-center.z),dist=d.length();if(dist>radius+.8)return;
  if(dist<.05)d.set(Math.random()-.5,0,Math.random()-.5);
  this.pendingDodge.copy(d.normalize().multiplyScalar(radius+1.4-dist));this.dodgeAt=now+this.reaction;
 }
 update(dt:number,cam:THREE.Vector3,t:number,look:THREE.Vector3){
  if(this.dodgeAt>=0&&t>=this.dodgeAt){this.dodge.copy(this.pendingDodge);this.dodgeUntil=t+2.6;this.dodgeAt=-1;}
  if(t>this.dodgeUntil)this.dodge.multiplyScalar(Math.exp(-dt*2));
  this.down=Math.max(0,this.down-dt);this.hop=Math.max(0,this.hop-dt);
  const goal=this.override&&t<this.overrideUntil?this.override.clone():this.target.clone().add(this.dodge),to=goal.sub(this.pos);to.y=0;const dist=to.length();
  this.moving=false;
  if(this.down<=0&&dist>.25){const speed=(this.guide?8.5:5.5)*(dist>6?1.4:1);this.pos.addScaledVector(to.normalize(),Math.min(dist,speed*dt));this.facing=Math.atan2(to.x,to.z);this.moving=true;}
  else if(this.down<=0)this.facing=Math.atan2(look.x-this.pos.x,look.z-this.pos.z);
  resolve(this.pos,.4);
  const m=this.sprite.material,angle=((Math.atan2(cam.x-this.pos.x,cam.z-this.pos.z)-this.facing)*180/Math.PI+720)%360,rot=Math.round(angle/45)%8;
  const frame=this.guide?(this.moving?this.frames[(Math.floor(t*5)%2)*8+rot]:this.idle[rot]||this.frames[rot]):this.frames[(this.moving?Math.floor(t*6+this.index)%4:0)*8+rot];
  if(frame)m.map=frame;
  if(this.down>0){m.rotation=Math.PI/2;this.sprite.center.set(.5,.5);this.sprite.position.set(this.pos.x,.5,this.pos.z);}
  else{m.rotation=0;this.sprite.center.set(.5,0);this.sprite.position.set(this.pos.x,Math.sin(Math.min(1,this.hop/.3)*Math.PI)*.25,this.pos.z);}
  this.ring.position.set(this.pos.x,.03,this.pos.z);(this.ring.material as THREE.MeshBasicMaterial).opacity=this.down>0?.25:.8;
 }
}
