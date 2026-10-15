import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Materials, makeHuman, makeHunter, animateFigure, makeObject, makeRifle, instanceBoxes, sphere, hash, type Figure } from './art';
import { groundY, makeSky, makeTerrain, makeGrass, SUN_DIR } from './bliss';

/** Classic-Doom presentation: the scene renders into a tiny (~320x240-pixel)
 * target which is blown up with nearest-neighbour filtering and posterized, so
 * everything reads as chunky 1993 pixels. Dungeon surfaces are unlit; sector
 * brightness is baked per cell and fades to black with distance (Doom's
 * "light diminishing"). Original procedural art; no id Software assets.
 */
export type ViewOptions={pixelated:boolean;renderPixels:number;posterizeLevels:number;grassNear:number;grassFar:number;outsideMaxDpr:number};
const BLACK=new THREE.Color(0x000000),DAY=new THREE.Color(0xc7dbea);
export class WorldView {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  private scene=new THREE.Scene();
  private m=new Materials();
  private dungeon=new THREE.Group();
  private humans=new Map<number,Figure>();
  private props=new Map<string,THREE.Group>();
  private contacts=new Map<number,THREE.Mesh>();
  private hunter:Figure;
  // assigned in buildExterior()

  private hunterContact:THREE.Mesh;
  private worldBuilt=false;
  private lastMap='';
  private options:ViewOptions;
  private target:THREE.WebGLRenderTarget;
  private blitScene=new THREE.Scene();
  private blitCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private blit:THREE.ShaderMaterial;
  private flicker:{mesh:THREE.InstancedMesh;index:number;base:number;seed:number}[]=[];
  private lastFlicker=-1;
  private lastShots=0;
  private shotFlash=0;
  private punchAt=-9;
  private bobPhase=0;
  private moveSpeed=0;
  private lastCam={x:NaN,z:NaN,id:-1};
  private sun:THREE.DirectionalLight;
  private hemi:THREE.HemisphereLight;
  private fog=new THREE.Fog(0x000000,2,24);
  private flash:THREE.Mesh;
  private hands:THREE.Group;
  private handMeshes:THREE.Mesh[]=[];
  private heldGun:THREE.Group;
  private aimLine:THREE.Line;
  private muzzle:THREE.Mesh;
  private outdoor:THREE.Mesh[]=[];
  private grass:THREE.Mesh[]=[];
  private hiRes=false;
  private lastRenderTime=0;
  private frameMs=0;
  private canvas:HTMLCanvasElement;
  constructor(canvas:HTMLCanvasElement,options:ViewOptions) {
    this.canvas=canvas;this.options=options;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.setPixelRatio(1);this.renderer.info.autoReset=false;
    this.renderer.shadowMap.enabled=false;
    this.target=new THREE.WebGLRenderTarget(320,240,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
    this.blit=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tDiffuse:{value:this.target.texture},uLevels:{value:options.posterizeLevels}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'uniform sampler2D tDiffuse;uniform float uLevels;varying vec2 vUv;void main(){vec4 c=linearToOutputTexel(texture2D(tDiffuse,vUv));if(uLevels>0.)c.rgb=floor(c.rgb*uLevels+.5)/uLevels;gl_FragColor=vec4(c.rgb,1.);}'});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blit);quad.frustumCulled=false;this.blitScene.add(quad);
    this.camera=new THREE.PerspectiveCamera(74,1,.055,3000);this.camera.rotation.order='YXZ';
    this.scene.add(this.camera,this.dungeon);
    this.scene.fog=this.fog;
    const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();
    this.scene.environment=pmrem.fromScene(room,.04).texture;pmrem.dispose();room.dispose();
    this.scene.environmentIntensity=.55;
    this.hemi=new THREE.HemisphereLight(0xd8e4f0,0x6b6040,1.6);this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0xa4b1b6,.35));
    this.sun=new THREE.DirectionalLight(0xfff6dc,1.6);this.sun.position.copy(SUN_DIR).multiplyScalar(60).add(new THREE.Vector3(16,0,-8));this.sun.target.position.set(16,0,-8);this.scene.add(this.sun,this.sun.target);
    this.buildExterior();
    this.hunter=makeHunter(this.m);this.scene.add(this.hunter.root);this.hunterContact=this.contactShadow(.72);this.scene.add(this.hunterContact);
    this.hands=new THREE.Group();this.hands.name='first-person-hands';
    // Doom-style first-person fists: low in frame, right one punches.
    const skin=new THREE.MeshLambertMaterial({color:0xd8a37e,flatShading:true,depthTest:false});
    for(const s of [-1,1]) {
      const fist=new THREE.Group();fist.name=s<0?'left-fist':'right-fist';
      const arm=sphere(skin,0,-.13,.1,.075,.16,.08);arm.rotation.x=.9;
      const knuckles=sphere(skin,0,0,0,.085,.075,.07),thumb=sphere(skin,-s*.06,-.02,-.02,.03,.045,.03);
      for(const part of [arm,knuckles,thumb]){part.renderOrder=10;part.castShadow=false;fist.add(part);this.handMeshes.push(part);}
      fist.position.set(s*.2,-.3,-.5);fist.userData.home=fist.position.clone();this.hands.add(fist);
    }
    this.camera.add(this.hands);
    this.heldGun=makeRifle(this.m);this.heldGun.position.set(.0,-.25,-.5);this.heldGun.userData.home=this.heldGun.position.clone();this.heldGun.scale.setScalar(.75);this.heldGun.traverse(o=>{const mm=o as THREE.Mesh;if(mm.isMesh){mm.renderOrder=10;const mat=(mm.material as THREE.Material).clone();mat.depthTest=false;mm.material=mat;}});this.camera.add(this.heldGun);this.heldGun.visible=false;
    const aimGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    this.aimLine=new THREE.Line(aimGeometry,new THREE.LineBasicMaterial({color:0xff3926,toneMapped:false}));this.aimLine.frustumCulled=false;this.aimLine.visible=false;this.scene.add(this.aimLine);
    this.muzzle=sphere(new THREE.MeshBasicMaterial({color:0xff5732,toneMapped:false}),0,0,0,.06,.06,.06);this.muzzle.visible=false;this.scene.add(this.muzzle);
    this.flash=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0xffd389,transparent:true,opacity:.6,depthWrite:false,wireframe:true}));this.flash.visible=false;this.scene.add(this.flash);
    this.resize();
  }
  private contactShadow(size:number):THREE.Mesh {
    const a=new THREE.Mesh(new THREE.PlaneGeometry(size*2,size*2),this.m.shadow);a.rotation.x=-Math.PI/2;a.position.y=.015;return a;
  }
  private buildExterior():void {
    const sky=makeSky(),land=makeTerrain();
    // Dense long blades near the player; a coarser field of bigger blades out to the crest.
    this.grass=[makeGrass(this.options.grassNear,30,{hole:0,height:[.32,.72],width:.045}),makeGrass(this.options.grassFar,230,{hole:12,height:[.55,1.0],width:.13})];
    this.outdoor.push(sky,land,...this.grass);this.scene.add(sky,land,...this.grass);
    // The door emerges from an otherwise anonymous low concrete bunker.
    const bunker=instanceBoxes([{x:6,y:.18,z:1,sx:16,sy:.36,sz:4},{x:26,y:.18,z:1,sx:16,sy:.36,sz:4}],this.m.stone);this.scene.add(bunker);
    // Physical perimeter matches the simulation's fence; central door is a stateful prop.
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;ctx.strokeStyle='#505d58';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(32,0);ctx.lineTo(64,32);ctx.lineTo(32,64);ctx.closePath();ctx.stroke();const wire=new THREE.CanvasTexture(c);wire.colorSpace=THREE.SRGBColorSpace;wire.wrapS=wire.wrapT=THREE.RepeatWrapping;
    const fenceMat=new THREE.MeshStandardMaterial({map:wire,transparent:true,alphaTest:.35,side:THREE.DoubleSide,roughness:.8});
    const posts:{x:number;y:number;z:number;sx:number;sy:number;sz:number}[]=[],railPoints:THREE.Vector3[]=[];
    for(const span of [[-80,15.15],[18.85,110]]) {
      const positions:number[]=[],uv:number[]=[],indices:number[]=[];const pieces=Math.ceil((span[1]-span[0])/3);
      for(let i=0;i<=pieces;i++){const x=span[0]+(span[1]-span[0])*i/pieces,y=groundY(x,-32);positions.push(x,y,-32,x,y+2.65,-32);uv.push(x*1.2,0,x*1.2,3.18);posts.push({x,y:y+1.4,z:-32,sx:.07,sy:2.8,sz:.07});if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);const px=span[0]+(span[1]-span[0])*(i-1)/pieces;railPoints.push(new THREE.Vector3(px,groundY(px,-32)+2.67,-32),new THREE.Vector3(x,y+2.67,-32));}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();this.scene.add(new THREE.Mesh(g,fenceMat));
    }
    this.scene.add(instanceBoxes(posts,this.m.trim),new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(railPoints),new THREE.LineBasicMaterial({color:0x465850})));
    const cablePoints=[new THREE.Vector3(22,.08,-10),new THREE.Vector3(23,.08,-14),new THREE.Vector3(23,.08,-28),new THREE.Vector3(18.6,.08,-32)];const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),24,.025,5,false),this.m.dark);this.scene.add(cable);
  }
  private buildDungeon(map:string[]):void {
    this.dungeon.clear();
    this.flicker=[];
    type Box={x:number;y:number;z:number;sx:number;sy:number;sz:number;light:number;flicker:boolean};
    const techWalls:Box[]=[],brickWalls:Box[]=[],floors:Box[]=[],ceilings:Box[]=[],lamps:Box[]=[];
    const lampCells:[number,number][]=[];
    for(let z=0;z<map.length;z++)for(let x=0;x<map[z].length;x++)if(map[z][x]!=='#'&&(x+z*3)%8===0)lampCells.push([x,z]);
    // Doom sectors: light comes in hard steps, bright pools under lamps, dim elsewhere.
    const sector=(x:number,z:number)=>{let best=0;for(const [lx,lz] of lampCells)best=Math.max(best,1-Math.max(Math.abs(x-lx),Math.abs(z-lz))/3);return .38+Math.round(best*4)/4*.62;};
    const flickers=(x:number,z:number)=>hash(Math.floor(x/4)*31+Math.floor(z/3)*17)>.82;
    for(let z=0;z<map.length;z++)for(let x=0;x<map[z].length;x++) {
      const wx=x*2+1,wz=z*2+1,light=sector(x,z),flicker=flickers(x,z);
      if(map[z][x]==='#')(z>=8?brickWalls:techWalls).push({x:wx,y:1.6,z:wz,sx:2,sy:3.2,sz:2,light,flicker});
      else {
        floors.push({x:wx,y:-.085,z:wz,sx:2,sy:.15,sz:2,light,flicker});ceilings.push({x:wx,y:3.3,z:wz,sx:2,sy:.2,sz:2,light,flicker});
        if((x+z*3)%8===0)lamps.push({x:wx,y:3.19,z:wz,sx:.9,sy:.02,sz:.9,light:1,flicker});
      }
    }
    const color=new THREE.Color();
    const lit=(boxes:Box[],mat:THREE.Material)=>{const mesh=instanceBoxes(boxes,mat);boxes.forEach((b,i)=>{mesh.setColorAt(i,color.setScalar(b.light));if(b.flicker)this.flicker.push({mesh,index:i,base:b.light,seed:b.x*7+b.z*13});});if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;return mesh;};
    this.dungeon.add(lit(techWalls,this.m.tech),lit(brickWalls,this.m.stone),lit(floors,this.m.floor),lit(ceilings,this.m.metal),lit(lamps,this.m.lamp));
    const exitTexture=(text:string)=>{const c=document.createElement('canvas');c.width=64;c.height=20;const ctx=c.getContext('2d')!;ctx.fillStyle='#1a0e08';ctx.fillRect(0,0,64,20);ctx.fillStyle='#ff2a10';ctx.font='bold 15px Impact, "Arial Black", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,32,11);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;};
    const exitMat=new THREE.MeshBasicMaterial({map:exitTexture('EXIT'),fog:false});
    for(const loc of [[7,2.82,18.03],[17,2.75,2.03]]) {const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.45),exitMat);sign.position.set(loc[0],loc[1],loc[2]);this.dungeon.add(sign);}
    this.worldBuilt=true;
  }
  private mountCamera(obj:any,map:string[]):number {
    const x=Math.floor(obj.x/2),z=Math.floor(obj.z/2);
    if(map[z]?.[x+1]==='#')return Math.PI/2;
    if(map[z]?.[x-1]==='#')return -Math.PI/2;
    if(map[z-1]?.[x]==='#')return Math.PI;
    return 0;
  }
  /** First-person attack animation (fist jab or rifle kick). */
  punch():void { this.punchAt=performance.now()/1000; }
  update(state:any,_alpha=1):void {
    const now=performance.now();const frameDt=this.lastRenderTime?Math.min(.1,(now-this.lastRenderTime)/1000):0;if(this.lastRenderTime)this.frameMs=this.frameMs*.94+(now-this.lastRenderTime)*.06;this.lastRenderTime=now;
    const map=state.map as string[]|undefined;
    if(map){const key=map.join('');if(!this.worldBuilt||key!==this.lastMap){this.buildDungeon(map);this.lastMap=key;}}
    const time=Number(state.time)||0;
    for(const h of state.humans||[]) {
      let figure=this.humans.get(h.id);if(!figure){figure=makeHuman(Number(h.id)||0,this.m);this.humans.set(h.id,figure);this.scene.add(figure.root);const contact=this.contactShadow(.53);this.contacts.set(h.id,contact);this.scene.add(contact);}
      animateFigure(figure,h,time);figure.root.position.y+=groundY(h.x,h.z);
      const viewer=(state.humans||[]).find((a:any)=>a.id===state.controlled);
      figure.root.visible=h.id!==state.controlled&&(!viewer||Math.hypot(h.x-viewer.x,h.z-viewer.z)>.85);
      const shadow=this.contacts.get(h.id)!;shadow.position.set(h.x,groundY(h.x,h.z)+.022,h.z);shadow.visible=figure.root.visible;
    }
    if(state.hunter){animateFigure(this.hunter,state.hunter,time,true);this.hunter.root.position.y+=groundY(state.hunter.x,state.hunter.z);this.hunterContact.position.set(state.hunter.x,groundY(state.hunter.x,state.hunter.z)+.024,state.hunter.z);this.hunter.eye!.visible=!(state.hunter.stun>0)||Math.floor(time*5)%2===0;}
    for(const obj of state.objects||[]) {
      const key=String(obj.id);let prop=this.props.get(key);
      if(!prop){prop=makeObject(obj.kind,this.m);this.props.set(key,prop);this.scene.add(prop);if(obj.kind==='camera')prop.rotation.y=this.mountCamera(obj,map||[]);}
      prop.position.set(obj.x,groundY(obj.x,obj.z),obj.z);
      if(obj.kind==='wall'||obj.kind==='weapon'||obj.kind==='bomb'||obj.kind==='crate')prop.visible=obj.active!==false;
      if(obj.kind==='hatch'||obj.kind==='gate'){const leaf=prop.getObjectByName('leaf');if(leaf)leaf.visible=!obj.open;}
      if(obj.kind==='camera'){prop.rotation.z=obj.active===false?.38:0;const signal=prop.getObjectByName('signal') as THREE.Mesh;if(signal)signal.material=obj.active===false?this.m.dark:this.m.red;}
      if(obj.kind==='relay'){const signal=prop.getObjectByName('signal') as THREE.Mesh;if(signal)signal.material=obj.open?this.m.green:this.m.red;}
      if(obj.kind==='weapon'&&obj.active!==false){prop.rotation.y=Math.sin(time*.7)*.3;prop.position.y=.05+Math.sin(time*1.8)*.025;}
    }
    const controlled=(state.humans||[]).find((h:any)=>h.id===state.controlled)||(state.humans||[])[0];
    // Gunfire briefly lights the whole room, like Doom's muzzle-flash sector boost.
    const shots=Number(state.shots)||0;if(shots>this.lastShots)this.shotFlash=1;this.lastShots=shots;this.shotFlash=Math.max(0,this.shotFlash-frameDt*6);
    if(this.flicker.length){const tick=Math.floor(time*9);if(tick!==this.lastFlicker){this.lastFlicker=tick;const c=new THREE.Color();const touched=new Set<THREE.InstancedMesh>();for(const f of this.flicker){const on=hash(f.seed+Math.floor(tick/2)*1.7)>.22;f.mesh.setColorAt(f.index,c.setScalar(on?f.base:f.base*.45));touched.add(f.mesh);}touched.forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});}}
    if(controlled){
      if(this.lastCam.id===controlled.id&&frameDt>0){const v=Math.hypot(controlled.x-this.lastCam.x,controlled.z-this.lastCam.z)/frameDt;this.moveSpeed+=(Math.min(4,v)-this.moveSpeed)*Math.min(1,frameDt*10);}else this.moveSpeed=0;
      this.lastCam={x:controlled.x,z:controlled.z,id:controlled.id};this.bobPhase+=frameDt*this.moveSpeed*2.6;
      const bob=Math.min(1,this.moveSpeed/2.7);
      this.camera.position.set(controlled.x,groundY(controlled.x,controlled.z)+(controlled.alive===false?.5:1.6+Math.abs(Math.sin(this.bobPhase))*.07*bob),controlled.z);
      this.camera.rotation.set(state.pitch||0,state.yaw||0,0,'YXZ');
      const daylight=THREE.MathUtils.smoothstep(-controlled.z,-1.8,2.5);
      this.fog.color.copy(BLACK).lerp(DAY,daylight);this.fog.near=2+this.shotFlash*6+daylight*80;this.fog.far=24+this.shotFlash*14+daylight*270;
      // Inside: chunky low-res Doom. Through the hatch: full-resolution daylight.
      this.hiRes=daylight>.45;
      for(const g of this.grass)g.visible=this.camera.position.z<4;
      for(const o of this.outdoor){const u=(o.material as THREE.ShaderMaterial).uniforms;u.uTime.value=time;if(u.uCam)u.uCam.value.copy(this.camera.position);}
      this.sun.intensity=.4+daylight*1.6;this.hemi.intensity=1.0+daylight*.4;this.scene.environmentIntensity=.4;
      this.hands.visible=controlled.alive!==false&&!controlled.armed;this.heldGun.visible=controlled.alive!==false&&!!controlled.armed;
      const mat=this.humans.get(controlled.id)?.skin;for(const hand of this.handMeshes)if(mat){(hand.material as THREE.MeshLambertMaterial).color.copy((mat as THREE.MeshLambertMaterial).color);}
      // Doom weapon bob: sideways swing plus a dip on every step.
      const bx=Math.cos(this.bobPhase)*.045*bob,by=-Math.abs(Math.sin(this.bobPhase))*.035*bob;
      const p=Math.max(0,1-(now/1000-this.punchAt)/.28),jab=Math.sin(p*Math.PI);
      for(const fist of this.hands.children){const home=fist.userData.home as THREE.Vector3;const right=fist.name==='right-fist';fist.position.set(home.x+bx-(right?jab*.14:0),home.y+by+(right?jab*.12:0),home.z-(right?jab*.2:0));}
      const gh=this.heldGun.userData.home as THREE.Vector3;this.heldGun.position.set(gh.x+bx,gh.y+by+p*.03,gh.z+p*.07);this.heldGun.rotation.x=p*.25;
    }
    const prey=(state.humans||[]).find((h:any)=>h.id===state.hunter?.target);
    const aiming=!!prey&&prey.alive&&state.hunter.aim>0&&state.hunter.stun<=0;
    this.aimLine.visible=aiming;this.muzzle.visible=aiming;
    if(aiming){const hunter=state.hunter;const p=this.aimLine.geometry.attributes.position;p.setXYZ(0,hunter.x-Math.sin(hunter.heading)*.85,groundY(hunter.x,hunter.z)+1.48,hunter.z-Math.cos(hunter.heading)*.85);p.setXYZ(1,prey.x,groundY(prey.x,prey.z)+1.3,prey.z);p.needsUpdate=true;this.muzzle.position.set(p.getX(0),p.getY(0),p.getZ(0));this.muzzle.scale.setScalar(.055+Math.min(1,hunter.aim)*.10);}
    if(state.blast) {
      const age=Math.max(0,time-(state.blast.t||0));this.flash.visible=age<.6;this.flash.position.set(state.blast.x,1,state.blast.z);this.flash.scale.setScalar(.3+age*7);(this.flash.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.6);
    } else this.flash.visible=false;
    this.renderer.info.reset();
    if(this.options.pixelated&&!this.hiRes){this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);this.renderer.render(this.blitScene,this.blitCamera);}
    else this.renderer.render(this.scene,this.camera);
  }
  resize():void {
    // The canvas always stays at native resolution (resizing its buffer mid-game
    // makes some browsers show a stale frame). Inside, the scene draws into a tiny
    // target that the blit pass scales up with nearest-neighbour sampling.
    const width=this.canvas.clientWidth||window.innerWidth,height=this.canvas.clientHeight||window.innerHeight,aspect=width/height;
    this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.options.outsideMaxDpr));this.renderer.setSize(width,height,false);
    // Same pixel budget on every screen shape: wide desktop ≈ 380x200, phone portrait ≈ 190x410.
    const w=Math.max(80,Math.round(Math.sqrt(this.options.renderPixels*aspect))),h=Math.max(80,Math.round(Math.sqrt(this.options.renderPixels/aspect)));
    this.target.setSize(w,h);
  }
  diagnostics():Record<string,unknown> {
    const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();let meshes=0,instancedMeshes=0;
    this.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){meshes++;geometries.add(m.geometry);if(Array.isArray(m.material))m.material.forEach(a=>materials.add(a));else materials.add(m.material);if((o as THREE.InstancedMesh).isInstancedMesh)instancedMeshes++;}});
    return{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,materials:materials.size,sceneMeshes:meshes,instancedMeshes,uniqueGeometries:geometries.size,dpr:this.renderer.getPixelRatio(),postPasses:this.options.pixelated?1:0,renderSize:this.hiRes?`${this.canvas.width}x${this.canvas.height}`:`${this.target.width}x${this.target.height}`,shadowLights:0,frameMs:Math.round(this.frameMs*10)/10,art:'original procedural placeholders; no Doom/Microsoft/film assets'};
  }
}
