import * as THREE from 'three';
import type {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {PILLARS,TAU,rand,glow,glowSprite,edged,type Stage} from './kit';
import type {Person} from './crowd';

/* The ending (docs/ENDGAME.md E9, 2026-10-26). Close the MCP.EXE dialog and everyone is standing in an
 * apocalyptic wasteland: ash falling, dead trees, the Windows hill burnt brown on the horizon, and the
 * MCP's stump still smoking behind them. The founder you didn't pick delivers the line to you; everyone
 * turns and looks into the camera; cut to black. Drawn in code; a scene of its own, swapped into the
 * renderer. Everyone stands near (0, 0, 33) so the arena's walking rules leave them where they're put. */
export const CAM_FROM=new THREE.Vector3(0,1.75,47),CAM_TO=new THREE.Vector3(0,1.62,40.5),CAM_LOOK=new THREE.Vector3(0,1.5,31);

export class Wasteland{
 scene=new THREE.Scene();ash:THREE.Points;ashV:Float32Array;smoke:{s:THREE.Sprite;from:THREE.Vector3;t:number;life:number}[]=[];cast:Person[]=[];
 constructor(){
  const s=this.scene;s.background=new THREE.Color('#2a1a14');s.fog=new THREE.FogExp2('#6e3a24',.0105);
  // the sky: ash overhead, a burnt-orange haze at the horizon, a dim sun through the smoke
  s.add(new THREE.Mesh(new THREE.SphereGeometry(480,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
   uniforms:{top:{value:new THREE.Color('#120d0c')},mid:{value:new THREE.Color('#4f2618')},low:{value:new THREE.Color('#b8582a')}},
   vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'uniform vec3 top,mid,low;varying vec3 vP;void main(){float h=vP.y;vec3 c=h>.1?mix(mid,top,smoothstep(.1,.55,h)):mix(low,mid,smoothstep(-.03,.1,h));gl_FragColor=vec4(c,1.);}'})));
  const sun=glowSprite('#ff7a3a',110,.5);sun.position.set(-150,46,-400);s.add(sun);
  s.add(new THREE.HemisphereLight('#d98a52','#1a100c',1.15));const key=new THREE.DirectionalLight('#ffa060',1.5);key.position.set(-70,26,-120);s.add(key);
  // the ground: ash and dirt in low dunes, flat where everyone stands
  const g=new THREE.PlaneGeometry(760,760,150,150).rotateX(-Math.PI/2),p=g.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),far=Math.min(1,Math.hypot(x,z-36)/34);p.setY(i,(Math.sin(x*.05)*Math.cos(z*.043)*2.4+Math.sin(x*.13+z*.09)*.7+Math.sin(z*.021)*3)*far*far);}
  g.computeVertexNormals();s.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#3a2a20',roughness:1,flatShading:true})));
  // the Windows hill, dead: a long brown swell on the horizon
  const hill=new THREE.Mesh(new THREE.SphereGeometry(1,56,24,0,TAU,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#5b4126',roughness:1,flatShading:true}));
  hill.scale.set(280,52,130);hill.position.set(90,-8,-300);s.add(hill);
  // dead trees, kept out of the shot's middle
  const bark=new THREE.MeshStandardMaterial({color:'#130c09',roughness:1});
  for(let n=0;n<46;n++){
   const a=rand(0,TAU),r=rand(22,170),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<9&&z>14)continue;
   const tree=new THREE.Group(),h=rand(3,7.5);tree.add(new THREE.Mesh(new THREE.CylinderGeometry(.1,.26,h,6).translate(0,h/2,0),bark));
   for(let b=0;b<4;b++){const len=rand(1,2.6),br=new THREE.Mesh(new THREE.CylinderGeometry(.04,.09,len,5).translate(0,len/2,0),bark);br.position.y=h*rand(.45,.9);br.rotation.set(rand(-1.1,1.1),rand(0,TAU),rand(-1.1,1.1));tree.add(br);}
   tree.position.set(x,0,z);tree.rotation.set(rand(-.15,.15),rand(0,TAU),rand(-.15,.15));s.add(tree);
  }
  // what's left of the Grid: the MCP's stump, a few broken pillars with dead cyan edges, fallen shield panels
  const stump=edged(new THREE.CylinderGeometry(4.6,5.6,8,8).translate(0,4,0),0x26272a,'#ff3b1f',.45);s.add(stump);
  PILLARS.forEach((q,i)=>{if(i%3===1)return;const h=rand(1.5,5),pl=edged(new THREE.BoxGeometry(2.2,h,2.2).translate(0,h/2,0),0x0b1014,'#1d6a72',.6);pl.position.set(q.x,0,q.z);pl.rotation.set(rand(-.25,.25),rand(0,TAU),rand(-.25,.25));s.add(pl);});
  for(let i=0;i<9;i++){const pn=edged(new THREE.BoxGeometry(2.5,.35,9),0x1a2228,'#5a2a1c',.6),a=rand(0,TAU),r=rand(7,22);pn.position.set(Math.cos(a)*r,.2,Math.sin(a)*r);pn.rotation.set(rand(-.3,.3),rand(0,TAU),rand(-.2,.2));s.add(pn);}
  // smoke: the stump, and fires far off
  for(const from of [new THREE.Vector3(0,7,0),new THREE.Vector3(-80,0,-120),new THREE.Vector3(110,0,-160),new THREE.Vector3(-30,0,-230)])
   for(let i=0;i<16;i++)this.smoke.push({s:this.puff(),from,t:rand(0,14),life:14});
  // ash falling round the camera
  const n=1400,ap=new Float32Array(n*3);this.ashV=new Float32Array(n);
  for(let i=0;i<n;i++){ap[i*3]=rand(-26,26);ap[i*3+1]=rand(0,16);ap[i*3+2]=rand(10,43);this.ashV[i]=rand(.4,1.1);}
  const ag=new THREE.BufferGeometry();ag.setAttribute('position',new THREE.BufferAttribute(ap,3));
  this.ash=new THREE.Points(ag,new THREE.PointsMaterial({color:'#cfc6bd',size:.045,transparent:true,opacity:.75,depthWrite:false}));this.ash.frustumCulled=false;s.add(this.ash);
 }
 private puff(){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow(),color:'#2b2421',transparent:true,opacity:0,depthWrite:false}));this.scene.add(s);return s;}
 // everyone in a loose crowd, the two founders in front facing each other; the twenty look round at the ruin.
 // (Kept more than 1.1 m apart, or main.ts's crowd spacing nudges them and they walk on the spot.)
 stand(people:Person[],guide:Person,you:Person){
  this.cast=[...people,guide,you];
  for(const p of this.cast){this.scene.add(p.sprite);p.sprite.visible=true;p.ring.visible=false;p.sprite.material.color.set(p===guide||p===you?'#d9c8b8':'#b9a898');p.down=0;p.dodge.set(0,0,0);}
  const put=(p:Person,x:number,z:number)=>{p.pos.set(x,0,z);p.target.copy(p.pos);p.override=p.pos.clone();p.overrideUntil=Infinity;};
  put(guide,-1.05,35.2);put(you,1.05,35.2);guide.faceTo=you.pos.clone();you.faceTo=guide.pos.clone();
  people.forEach((p,i)=>{const row=i<7?0:i<14?1:2,col=row===0?i:row===1?i-7:i-14,inRow=row===2?6:7;put(p,(col-(inRow-1)/2)*1.75+(row%2)*.85+rand(-.1,.1),33.3-row*1.65+rand(-.1,.1));p.faceTo=new THREE.Vector3(rand(-70,70),1.5,rand(-90,10));});
 }
 // and then, one by one, everyone looks into the camera
 stare(cam:THREE.Vector3,later:(sec:number,f:()=>void)=>void){this.cast.forEach((p,i)=>later(i>=this.cast.length-2?0:.15+Math.random()*.7,()=>{p.faceTo=cam.clone();}));}
 show(stage:Stage){(stage.composer.passes[0] as RenderPass).scene=this.scene;this.scene.add(stage.camera);}
 update(dt:number){
  const ap=this.ash.geometry.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<ap.count;i++){let y=ap.getY(i)-this.ashV[i]*dt;if(y<0)y=16;ap.setXYZ(i,ap.getX(i)+Math.sin(y*.7+i)*.004+dt*.25,y,ap.getZ(i));if(ap.getX(i)>26)ap.setX(i,-26);}
  ap.needsUpdate=true;
  for(const m of this.smoke){m.t+=dt;if(m.t>m.life)m.t-=m.life;const k=m.t/m.life;m.s.position.set(m.from.x+k*14,m.from.y+k*40,m.from.z+Math.sin(m.t)*1.5);m.s.scale.setScalar(5+k*26);m.s.material.opacity=.55*Math.sin(k*Math.PI);}
 }
}
