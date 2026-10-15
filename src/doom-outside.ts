import {CAST_IDS} from './doom-cast-art';
import {makeHubDoors,HUB_DOORS,shade,type StripLight} from './doom-hub-doors';
import * as THREE from 'three';
import {loadTexture} from './doom-texture-load';
import {makeScreensavers} from './doom-bliss-screensavers';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import {makeMeadowGrass} from './doom-meadow-grass';
import {makeMeadowTerrain} from './doom-meadow-terrain';
import {makeMeadowSky} from './doom-meadow-sky';
import {makeMeadowVignette} from './doom-meadow-grade';
import {meadowUniforms} from './doom-meadow-shared';
import {SUN_DIR} from './bliss';
import {meadowHumanIdle} from './doom-human-idle';
import {createBlissAudio} from './doom-bliss-audio';
import {meadowCampLayout} from './doom-camp-layout';
import {makeBlissGuide,INTRO_START} from './doom-bliss-guide';
import {makeFutureHub,FUTURE_DOORS,FINAL,type FutureId} from './doom-hub-future';
import {makeDesktopIcons} from './doom-desktop-icons';

type EscapeState={saved_people:number[];saved:number;outside:number};
type Person={id:number;name:string;alive:number;controlled:number};
type World={alive:number;people:Person[]};
type LabelRect={name:string;depth:number;left:number;right:number;bottom:number;top:number};
type Options={prompt?:(text:string)=>string;labels?:(rects:LabelRect[],surface:HTMLCanvasElement,active:boolean)=>void;source:HTMLCanvasElement;stage:HTMLElement;audio:AudioContext;read:()=>{world:World;escape:EscapeState;levelId?:string};campaign?:()=>{saved:number;lost:number;worldPdoom:number;roster:{id:number;name:string;state:string}[]};enter?:(id:string,replay?:boolean)=>void;readThis?:()=>void};

/** The bunker's foundation slab: weathered poured concrete, drawn procedurally once.
 * Cast in ~3 m bays (sawn joints), speckled aggregate, soft water stains and darker
 * damp toward the edges where the grass meets it, a worn lighter path out of the door. */
function concreteTexture():THREE.CanvasTexture {
 const W=1024,H=922,c=document.createElement('canvas');c.width=W;c.height=H; // 20 x 18 m
 const g=c.getContext('2d')!;let s=424242;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
 g.fillStyle='#7c7b72';g.fillRect(0,0,W,H);
 const px=W/20; // pixels per metre
 // broad soft stains (lighter and darker clouds)
 for(let i=0;i<70;i++){const x=rnd()*W,y=rnd()*H,r=(1+rnd()*3.5)*px,dark=rnd()<.6;const gr=g.createRadialGradient(x,y,0,x,y,r);
  gr.addColorStop(0,dark?'rgba(52,54,46,.16)':'rgba(170,166,150,.12)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
 // damp, mossy margin: darker and a touch green toward every edge
 const m=1.1*px;
 for(const [x0,y0,x1,y1] of [[0,0,m,0],[W,0,W-m,0],[0,0,0,m],[0,H,0,H-m]] as const){
  const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,'rgba(40,58,30,.55)');gr.addColorStop(1,'rgba(40,58,30,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);}
 // a worn, slightly lighter path from the doorway (north face, x=17 m -> u=.5) outward
 {const x=W*.5,gr=g.createLinearGradient(0,0,0,2.2*px);gr.addColorStop(0,'rgba(178,172,156,.20)');gr.addColorStop(1,'rgba(178,172,156,0)');g.fillStyle=gr;g.fillRect(x-1.4*px,0,2.8*px,2.2*px);}
 // aggregate speckle
 const img=g.getImageData(0,0,W,H),d=img.data;
 for(let i=0;i<d.length;i+=4){const n=(rnd()-.5)*22+(rnd()<.03?(rnd()-.4)*60:0);d[i]+=n;d[i+1]+=n;d[i+2]+=n*.9;}
 g.putImageData(img,0,0);
 // sawn joints every ~3 m, with a few hairline cracks
 g.strokeStyle='rgba(30,30,26,.55)';g.lineWidth=2;
 for(let x=3;x<20;x+=3.3){g.beginPath();g.moveTo(x*px,0);g.lineTo(x*px,H);g.stroke();}
 for(let y=3;y<18;y+=3.3){g.beginPath();g.moveTo(0,y*px);g.lineTo(W,y*px);g.stroke();}
 g.strokeStyle='rgba(30,30,26,.35)';g.lineWidth=1;
 for(let i=0;i<14;i++){let x=rnd()*W,y=rnd()*H;g.beginPath();g.moveTo(x,y);for(let k=0;k<8;k++){x+=(rnd()-.5)*28;y+=(rnd()-.5)*28;g.lineTo(x,y);}g.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

// A separate renderer keeps the meadow clean while the actual engine keeps
// drawing the low-resolution passage in the entrance behind the player.
export async function createOutside(options:Options){
 const coarse=matchMedia('(pointer:coarse)').matches;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.id='outside-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','p(DOOM) meadow');options.stage.prepend(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,2500);
 // The Windows-wallpaper meadow: world-anchored blades thinning into a velvet sward,
 // a sky drawn last (only uncovered pixels pay for it) and a gentle lens vignette.
 const grass=makeMeadowGrass(coarse),meadow=meadowUniforms(),sky=makeMeadowSky(coarse),terrain=makeMeadowTerrain();
 terrain.renderOrder=3; // after the blades (early depth rejects the hidden sward), before the sky
 scene.add(sky,terrain,grass.group,makeMeadowVignette());
 // Flying windows and flying toasters in the sky: it is a Windows desktop.
 const screensavers=makeScreensavers(scene,coarse);
 const loader=new THREE.TextureLoader();
 const wall=await loadTexture(loader,'local/outside/doom-wall.png');wall.colorSpace=THREE.SRGBColorSpace;wall.magFilter=THREE.NearestFilter;wall.minFilter=THREE.NearestFilter;wall.wrapS=wall.wrapT=THREE.RepeatWrapping;wall.repeat.set(3,2);
 // The bunker sits in the meadow's light: each face is shaded by the sun (baked per
 // vertex, so it stays an unlit, cheap material), and the foot of every wall darkens
 // over its lowest half metre where it meets the slab and the grass.
 const wallMat=new THREE.MeshBasicMaterial({map:wall,color:0x9a9a9a,vertexColors:true});
 const labelOccluders:THREE.Object3D[]=[];
 function box(w:number,h:number,d:number,x:number,y:number,z:number){const mesh=new THREE.Mesh(shade(new THREE.BoxGeometry(w,h,d,1,Math.round(h/.4),1),y,y-h/2<.01),wallMat);mesh.position.set(x,y,z);scene.add(mesh);labelOccluders.push(mesh);}
 // two wings either side of a human-sized doorway (1.8 m wide, 2.3 m tall) and the lintel above it
 box(8.1,7,16,12.05,3.5,8.1);box(8.1,7,16,21.95,3.5,8.1);box(1.8,4.7,16,17,4.65,8.1);
 // the foundation slab: weathered concrete (procedural), sun-shaded like the walls
 const foundation=new THREE.Mesh(shade(new THREE.BoxGeometry(20,.12,18),-.03,false),new THREE.MeshBasicMaterial({map:concreteTexture(),color:0xc4c2b8,vertexColors:true}));foundation.position.set(17,-.03,8);scene.add(foundation);
 const portalCanvas=document.createElement('canvas');portalCanvas.width=320;portalCanvas.height=200;
 const portalContext=portalCanvas.getContext('2d')!;portalContext.imageSmoothingEnabled=false;
 const portalTexture=new THREE.CanvasTexture(portalCanvas);portalTexture.colorSpace=THREE.SRGBColorSpace;portalTexture.magFilter=portalTexture.minFilter=THREE.NearestFilter;
 // the doorway is taller than the 320x200 view is wide, so it shows the view's central slice
 portalTexture.repeat.set(.49,1);portalTexture.offset.set(.255,0);
 // Each doorway shows the live engine view only while its own level is the one loaded;
 // otherwise a still of that level's corridor (scripts/build-hub-assets.py), so neither
 // door ever shows the other level's interior.
 const controlStill=await loadTexture(loader,'local/outside/control-doorway.png');controlStill.colorSpace=THREE.SRGBColorSpace;controlStill.magFilter=controlStill.minFilter=THREE.NearestFilter;controlStill.generateMipmaps=false;
 const portalMaterial=new THREE.MeshBasicMaterial({map:portalTexture});
 const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.3),portalMaterial);portal.position.set(17,1.15,.095);portal.rotation.y=Math.PI;scene.add(portal);
 const hubDoors=await makeHubDoors(scene,portalTexture,loader);
 labelOccluders.push(...hubDoors.occluders);
 // Levels 3 and 4 and the endgame as promises you can walk to, and desktop icons to kick about (2026-10-14).
 const future=await makeFutureHub(scene,loader,options.audio);labelOccluders.push(...future.occluders);
 const icons=await makeDesktopIcons(scene,options.audio,[
  {x:17,y:3.5,z:12.5,hx:9.4,hy:3.5,hz:12.5},...hubDoors.physicsBoxes(),...future.physicsBoxes(),
 ]);
 const textures=await Promise.all(CAST_IDS.map((id)=>Promise.all(Array.from({length:32},async(_,n)=>{const f=Math.floor(n/8),a=n%8,t=await loadTexture(loader,`outside-assets/figure-${id}-${f}-${a}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;return t;}))));
 const people=new Map<number,{sprite:THREE.Sprite;shadow:THREE.Mesh;target:THREE.Vector3;moving:boolean;arrived:boolean;arrivedAt:number}>();
 // Soft contact shadows under the rescued people (drawn after the sward; blades in front still cover them)
 const blobCanvas=document.createElement('canvas');blobCanvas.width=blobCanvas.height=64;
 {const g=blobCanvas.getContext('2d')!,r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(.55,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);}
 const blobMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(blobCanvas),color:0x000000,transparent:true,opacity:.38,depthWrite:false});
 const blobGeo=new THREE.PlaneGeometry(.95,.5).rotateX(-Math.PI/2).rotateY(Math.atan2(-SUN_DIR.z,SUN_DIR.x));
 const sunAway=new THREE.Vector2(-SUN_DIR.x,-SUN_DIR.z).normalize();
 let active=true,currentLevel='five-prisons';
 const hubUi=document.createElement('div');hubUi.id='hub-ui';options.stage.append(hubUi);
 hubUi.innerHTML='<p class="hub-heading">SAFE MODE</p><p id="hub-count"></p><button id="hub-enter" hidden></button><button id="hub-replay" hidden>Replay lost survivors</button>';
 const enterButton=hubUi.querySelector<HTMLButtonElement>('#hub-enter')!,replayButton=hubUi.querySelector<HTMLButtonElement>('#hub-replay')!;
 /* A locked structure's install dialog, or the final door's Display Properties: a Win95 window drawn
  * in HTML (no OS artwork). Space presses its default button, R its READ THIS!; walking away, pausing
  * or the close box shut it. "Cancel" never cancels anything. */
 const dialog=document.createElement('div');dialog.id='hub-dialog';dialog.className='win95';dialog.hidden=true;dialog.setAttribute('role','dialog');
 dialog.innerHTML='<div class="win95-title"><span></span><button type="button" class="win95-close" aria-label="Close">×</button></div><div class="win95-body"><p class="win95-text"></p><div class="win95-progress"><span></span></div><p class="win95-status" aria-live="polite"></p></div><div class="win95-buttons"><button type="button" class="win95-a"></button><button type="button" class="win95-b"></button></div>';
 options.stage.append(dialog);
 const q=(sel:string)=>dialog.querySelector<HTMLElement>(sel)!,dialogParts={title:q('.win95-title span'),text:q('.win95-text'),bar:q('.win95-progress span'),status:q('.win95-status'),a:q('.win95-a'),b:q('.win95-b')};
 let dialogFor:FutureId|null=null,dialogAt=0,refusedUntil=0,nearestFuture:FutureId|null=null;
 let guide:Awaited<ReturnType<typeof makeBlissGuide>>|null=null;
 let intro=false;
 let nearestDoor:typeof HUB_DOORS[number]|null=null;
 enterButton.onclick=()=>{if(nearestDoor)options.enter?.(nearestDoor.id);else if(nearestFuture)openDialog(nearestFuture);};replayButton.onclick=()=>{if(nearestDoor)options.enter?.(nearestDoor.id,true);};
 let yaw=0,pitch=0,last=performance.now(),time=0,paused=false,won=0,portalFrames=0,visiblePortal=false;
 const pos=new THREE.Vector3(17,1.72,-3),velocity=new THREE.Vector3(),keys=new Set<string>();let eye=1.72;
 // buildings (not people): the player and kicked icons both collide with these
 const solid=(x:number,z:number)=>hubDoors.blocked(x,z)||future.blocked(x,z)||x>7.6&&x<26.4&&z>-.4&&z<25;
 const blissAudio=createBlissAudio(options.audio);
 const syncAudio=()=>{const audible=active&&!paused&&!document.hidden&&document.hasFocus();blissAudio.setActive(audible);future.setAudioActive(audible);};
 syncAudio();
 const el=(id:string)=>document.getElementById(id)!;
 el('hud').hidden=false;el('health').hidden=true;el('equipment').textContent='';el('held-wrench').hidden=true;document.getElementById('held-gun')?.setAttribute('hidden','');el('reticle').hidden=true;el('prompt').hidden=true;el('message').hidden=true;el('message').classList.remove('spoken');el('result').hidden=true;
 for(const button of document.querySelectorAll<HTMLButtonElement>('.action-pad button'))button.hidden=!['ShiftLeft'].includes(button.dataset.code||'')&&button.id!=='touch-menu'&&button.dataset.code!=='Space';
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();window.addEventListener('resize',resize);
 function openDialog(id:FutureId){dialogFor=id;dialogAt=time;refusedUntil=0;dialog.hidden=false;if(document.pointerLockElement)document.exitPointerLock();renderDialog();}
 function closeDialog(){if(!dialogFor)return;dialogFor=null;dialog.hidden=true;canvas.focus();}
 function dialogAction(button:'a'|'b'){
  if(!dialogFor)return;
  if(dialogFor==='final'){if(button==='a')refusedUntil=time+3.5;else closeDialog();}
  else if(button==='a'){closeDialog();options.readThis?.();}else refusedUntil=time+3.5;
  renderDialog();
 }
 dialogParts.a.onclick=()=>dialogAction('a');dialogParts.b.onclick=()=>dialogAction('b');q('.win95-close').onclick=()=>closeDialog();
 const shown=new Map<HTMLElement,string>(),put=(el:HTMLElement,text:string)=>{if(shown.get(el)!==text){shown.set(el,text);el.textContent=text;}};
 function renderDialog(){
  if(!dialogFor)return;
  const camp=options.campaign?.(),unresolved=Math.max(0,20-(camp?.saved??0)-(camp?.lost??0)),people=(n:number)=>`${n} ${n===1?'person':'people'}`;
  if(dialogFor==='final'){
   put(dialogParts.title,FINAL.label);put(dialogParts.text,`Screen saver: 3D Maze. Wait: ${people(unresolved)}.`);dialogParts.bar.style.width=`${Math.round(100*(20-unresolved)/20)}%`;
   put(dialogParts.status,time<refusedUntil?`Preview is not available. ${people(unresolved)} still out there.`:'Free everyone to preview the screen saver.');put(dialogParts.a,'Preview');put(dialogParts.b,'OK');
   return;
  }
  const door=FUTURE_DOORS.find(d=>d.id===dialogFor)!,t=time-dialogAt;
  put(dialogParts.title,`Installing ${door.label}`);put(dialogParts.text,`${door.episode}: five people are still inside.`);
  // the bar creeps, wavers and slips back; the estimate never settles
  dialogParts.bar.style.width=`${Math.max(1,Math.round((door.id==='meg3n'?7:3)+Math.sin(t*.7)*1.6-(t%9<1?2:0)))}%`;
  const eta=['Time remaining: calculating...','About 4 minutes remaining','About 6 years remaining','About 3 minutes remaining','Time remaining: calculating...','About 900 years remaining'][Math.floor(t/2.6)%6];
  put(dialogParts.status,time<refusedUntil?'Cancel is not available. The installation will continue.':`Copying ${door.files[Math.floor(t/.9)%door.files.length]}... ${eta}`);
  put(dialogParts.a,'READ THIS!');put(dialogParts.b,'Cancel');
 }
 function key(code:string,down:boolean){if(!active)return;
  if(dialogFor&&down&&(code==='Space'||code==='KeyE')){dialogAction('b');return;}
  if(dialogFor&&down&&code==='KeyR'&&dialogFor!=='final'){dialogAction('a');return;}
  if((code==='Space'||code==='KeyE')&&down&&nearestDoor){options.enter?.(nearestDoor.id);return;}
  if((code==='Space'||code==='KeyE')&&down&&nearestFuture&&!paused){openDialog(nearestFuture);return;}if(intro&&code==='Space'&&down&&!paused){guide?.skip();return;}if(down)keys.add(code);else keys.delete(code);if(code==='Escape'&&down){paused=!paused;keys.clear();syncAudio();el('message').textContent=paused?'Paused. Press Esc or Menu to continue.':'';el('message').hidden=!paused;}}
 function release(){keys.clear();}
 function look(dx:number,dy:number){if(!active||paused)return;yaw-=dx*.0025;pitch=THREE.MathUtils.clamp(pitch-dy*.0025,-1.1,1.1);}
 let drag:{id:number;x:number;y:number}|null=null;
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('click',()=>{if(!coarse)canvas.requestPointerLock().catch(()=>{});});
 canvas.addEventListener('pointerdown',e=>{if(document.pointerLockElement===canvas)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);else if(drag?.id===e.pointerId){look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
 const visibility=()=>{release();syncAudio();};document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',()=>{release();blissAudio.setActive(false);future.setAudioActive(false);});window.addEventListener('focus',()=>{syncAudio();options.audio.resume();});
 function showWin(saved:number){won=saved;}
 function setActive(value:boolean,id='five-prisons'){
  active=value;canvas.hidden=!value;hubUi.hidden=!value;keys.clear();paused=false;currentLevel=id;
  portalMaterial.map=id!==HUB_DOORS[0].id&&HUB_DOORS.some(d=>d.id===id)?controlStill:portalTexture;hubDoors.setLevel(id);
  if(!value){intro=false;meadow.uGuidePath.value=0;guide?.stop();hubDoors.setHalVisible(true);future.setVisible(true);icons.setVisible(true);closeDialog();options.stage.classList.remove('bliss-intro');}
  // Coming back out of a level: its last subtitle and prompt would stay frozen on screen
  // (Liron's crawl line in the meadow, 2026-10-13), since the level HUD stops updating here.
  if(value){el('prompt').hidden=true;el('message').hidden=true;el('message').classList.remove('spoken');el('message').textContent='';}
  if(value){hubDoors.setHalVisible(!intro);future.setVisible(!intro);icons.setVisible(!intro);const door=HUB_DOORS.find(d=>d.id===id)||HUB_DOORS[0];yaw=door.yaw;pitch=0;pos.set(door.x-Math.sin(yaw)*3,1.72+groundY(door.x,door.z),door.z-Math.cos(yaw)*3);canvas.focus();}
  syncAudio();
 }

 async function startIntro(ceo:string){
  guide??=await makeBlissGuide(scene,options.stage,options.audio);intro=true;guide.start(ceo);
  // Wake low behind the big dome, facing away: no bunker in sight, the other founder up
  // the slope behind you. No mown path; the HAL station waits until after the first level.
  hubDoors.setHalVisible(false);future.setVisible(false);icons.setVisible(false);
  guide.onSkip=()=>{yaw=Math.PI;pitch=0;pos.set(17,groundY(17,-12)+eye,-12);};
  yaw=INTRO_START.yaw;pitch=0;pos.set(INTRO_START.x,groundY(INTRO_START.x,INTRO_START.z)+eye,INTRO_START.z);nearestDoor=null;won=0;
  options.stage.classList.add('bliss-intro');
  portalContext.fillStyle='#111';portalContext.fillRect(0,0,320,200);portalTexture.needsUpdate=true;
 }
 // The long-distance pace unlocks only after both facilities are resolved,
 // including losses. The wake-up walk and the first return keep their pacing.
 function travel(){
  const camp=options.campaign?.(),levels=[0,1].filter(k=>{
   const group=camp?.roster.filter(p=>p.id>=k*5&&p.id<k*5+5)||[];
   return group.length===5&&group.every(p=>p.state==='camp'||p.state==='lost');
  }).length,boosted=!intro&&levels===2;
  return {camp,levels,boosted,walk:boosted?6:3.6,run:boosted?10:6};
 }
 function getState(){const {walk,run,boosted}=travel();return {movement:{walk,run,boosted},intro,guide:guide?.getState()||null,scene:'meadow',active,currentLevel,nearestDoor:nearestDoor?.id||null,coordinate_system:'metres; x east, z south, y up',x:+pos.x.toFixed(2),y:+pos.y.toFixed(2),z:+pos.z.toFixed(2),yaw:+yaw.toFixed(3),pitch:+pitch.toFixed(3),paused,won,saved_visual:people.size,settled:[...people.values()].filter(p=>p.arrived).length,people:[...people.entries()].map(([id,p])=>({id,character:CAST_IDS[id],x:+p.sprite.position.x.toFixed(3),z:+p.sprite.position.z.toFixed(3),height:+p.sprite.scale.y.toFixed(4),arrived:p.arrived})),portal_frames:portalFrames,hal:hubDoors.getState(),screensavers:screensavers.getState(),future:future.getState(),icons:icons.getState(),nearest_future:nearestFuture,dialog:dialogFor?{id:dialogFor,title:dialogParts.title.textContent,status:dialogParts.status.textContent,bar:dialogParts.bar.style.width}:null,portal_visible:visiblePortal,render_width:canvas.width,render_height:canvas.height,audio:blissAudio.getState()};}
 let frameId=0;
 function frame(now:number){frameId=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden||!active)return;
  const state=options.read();if(!state.world||(!state.escape&&!intro))return;
  const escape=state.escape||{saved_people:[],saved:0,outside:0};
  const {camp,levels,walk,run}=travel();
  if(paused)velocity.set(0,0,0);
  if(!paused){
   time+=dt;
   yaw+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*dt*1.8;
   const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),speed=keys.has('ShiftLeft')?run:walk,norm=Math.max(1,Math.hypot(forward,side));
   const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt/norm,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt/norm;
   // the bunker, and the rescued people (you can't walk through them; a move that
   // takes you further from someone you are overlapping is always allowed)
   const crowd=(x:number,z:number)=>{for(const p of people.values()){const px=p.sprite.position.x,pz=p.sprite.position.z,r=.5,dn=Math.hypot(x-px,z-pz);if(dn<r&&dn<Math.hypot(pos.x-px,pos.z-pz))return true;}return false;};
   const blocked=(x:number,z:number)=>solid(x,z)||crowd(x,z);
   const fromX=pos.x,fromZ=pos.z;
   if(!blocked(pos.x+dx,pos.z))pos.x+=dx;if(!blocked(pos.x,pos.z+dz))pos.z+=dz;
   velocity.set((pos.x-fromX)/Math.max(dt,1e-4),0,(pos.z-fromZ)/Math.max(dt,1e-4));
   pos.x=THREE.MathUtils.clamp(pos.x,-180,200);pos.z=THREE.MathUtils.clamp(pos.z,-220,180);pos.y=groundY(pos.x,pos.z)+eye;
  }
  camera.position.copy(pos);camera.rotation.set(pitch,yaw,0,'YXZ');
  meadow.uTime.value=time;meadow.uCam.value.copy(pos);sky.position.copy(pos);if(!paused)screensavers.update(dt,pos,camera);
  guide?.tick(dt,pos,paused,yaw);
  const natives=state.world.people||[];
  const offset=currentLevel==='hal-station'?5:0;
  const arrivals=new Set(camp?.roster.filter(p=>p.state==='camp').map(p=>p.id)||[]);
  for(let i=0;i<5;i++)if(escape.saved_people[i]&&natives[i]?.alive)arrivals.add(offset+i);
  for(const i of arrivals){
   const art=i;
   if(!people.has(i)){
    const layout=meadowCampLayout(i),localArrival=i>=offset&&i<offset+5&&!!escape.saved_people[i-offset];
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures[art][0],color:0xdddddd,transparent:true,alphaTest:.5}));sprite.scale.set(1.8,1.8,1);sprite.center.set(.5,0);
    const start=localArrival?layout.origin:layout.target;sprite.position.set(start.x,groundY(start.x,start.z),start.z);scene.add(sprite);
    const shadow=new THREE.Mesh(blobGeo,blobMat);shadow.renderOrder=5;scene.add(shadow);
    people.set(i,{sprite,shadow,target:new THREE.Vector3(layout.target.x,0,layout.target.z),moving:localArrival,arrived:!localArrival,arrivedAt:time});
   }
  }
  for(const [i,p]of people){
   const before=p.sprite.position.clone(),delta=p.target.clone().sub(before);delta.y=0;
   if(!p.arrived&&!paused){
    if(delta.length()>.08)p.sprite.position.addScaledVector(delta.normalize(),Math.min(dt*1.8,delta.length()));
    else {p.arrived=true;p.arrivedAt=time;}
   }
   const idle=meadowHumanIdle(i,time,time-p.arrivedAt);
   if(p.arrived){p.sprite.position.x=p.target.x+idle.x;p.sprite.position.z=p.target.z+idle.z;}
   p.sprite.scale.set(idle.width,idle.height,1);
   p.moving=before.distanceTo(p.sprite.position)>.0001;p.sprite.position.y=groundY(p.sprite.position.x,p.sprite.position.z);
   {const sx=p.sprite.position.x+sunAway.x*.18,sz=p.sprite.position.z+sunAway.y*.18;p.shadow.position.set(sx,groundY(sx,sz)+.02,sz);}
   const toCamera=Math.atan2(pos.x-p.sprite.position.x,pos.z-p.sprite.position.z),facing=p.arrived?Math.atan2(Math.cos((time-p.arrivedAt)*.8+i*1.37)*.36,-Math.sin((time-p.arrivedAt)*.8+i*1.37)*.26):Math.atan2(p.target.x-p.sprite.position.x,p.target.z-p.sprite.position.z),angle=((toCamera-facing)*180/Math.PI+360)%360,rotation=Math.round(angle/45)%8,phase=p.arrived?idle.frame:Math.floor(time*6)%4;(p.sprite.material as THREE.SpriteMaterial).map=textures[i][phase*8+rotation];
  }
  // Only the loaded level's doorway is live (CONTROL's for anything outside the hub);
  // the other shows its still, so it needs no updates.
  const liveDoor=HUB_DOORS.find(door=>door.id===currentLevel)||HUB_DOORS[0];
  {const dx=liveDoor.x-pos.x,dz=liveDoor.z-pos.z,distance=Math.hypot(dx,dz);visiblePortal=distance<40&&(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)>distance*.35;}
  if(visiblePortal&&!intro){portalContext.drawImage(options.source,0,0,320,200);portalTexture.needsUpdate=true;portalFrames++;}
  nearestDoor=null;
  if(!paused)for(const door of HUB_DOORS)if((!intro||door.id==='five-prisons'&&guide?.ready)&&Math.hypot(pos.x-door.x,pos.z-door.z)<4.5){nearestDoor=door;break;}
  nearestFuture=!paused&&!nearestDoor&&!intro?future.nearest(pos.x,pos.z):null;
  const futureLabel=nearestFuture==='final'?'SPACE — Display Properties':nearestFuture?`SPACE — Open ${FUTURE_DOORS.find(d=>d.id===nearestFuture)!.label}`:'';
  const promptText=nearestDoor?`SPACE — Enter ${nearestDoor.label}`:dialogFor?'':futureLabel;
  enterButton.hidden=!promptText;enterButton.textContent=promptText?(options.prompt?.(promptText)??promptText):'';
  if(dialogFor&&(paused||future.distanceTo(dialogFor,pos.x,pos.z)>(dialogFor==='final'?13:7)))closeDialog();
  renderDialog();
  {const unresolved=Math.max(0,20-(camp?.saved??0)-(camp?.lost??0));
   const reduced=options.stage.classList.contains('reduced-motion');
   future.update(paused?0:dt,time,pos,yaw,reduced,paused,{unresolved,levels},pitch);
   icons.update(paused?0:dt,time,pos,velocity,paused);}
  const matching=camp?.roster.filter(p=>p.id>=((nearestDoor?.id==='hal-station')?5:0)&&p.id<((nearestDoor?.id==='hal-station')?10:5))||[];
  replayButton.hidden=!nearestDoor||!matching.some(p=>p.state==='lost');
  hubUi.querySelector('#hub-count')!.textContent=camp?`FREED ${camp.saved}/20 · LOST ${camp.lost} · WORLD p(DOOM) ${camp.worldPdoom}%`:'';
  el('people').textContent=won?'You made it out':'Fresh air';el('group').textContent=won?`100% survival · ${won} ${won===1?'person':'people'} safe · Take a look back`:`${escape.saved}/${state.world.alive} outside · Waiting for the others`;
  // HAL's status strip: green per person saved, dark per person still inside, grey per person lost
  const strip:StripLight[]=Array.from({length:5},(_,i)=>{const state=camp?.roster.find(p=>p.id===5+i)?.state;return state==='camp'||currentLevel==='hal-station'&&escape.saved_people[i]&&natives[i]?.alive?'saved':state==='lost'?'lost':'inside';});
  hubDoors.update(paused?0:dt,time,pos,options.stage.classList.contains('reduced-motion'),strip);
  grass.update(camera);
  renderer.render(scene,camera);
  if(options.labels){
   const rects:LabelRect[]=[],right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),ray=new THREE.Raycaster();
   for(const [id,person] of people){
    const body=person.sprite,depth=body.position.distanceTo(pos);if(depth>40)continue;
    const mid=body.position.clone().add(new THREE.Vector3(0,body.scale.y*.5,0));
    ray.set(pos,mid.clone().sub(pos).normalize());ray.far=pos.distanceTo(mid);
    if(ray.intersectObjects(labelOccluders,false).length)continue;
    const local=mid.clone().applyMatrix4(camera.matrixWorldInverse);if(local.z>=0)continue;
    const points=[body.position.clone().addScaledVector(right,-body.scale.x/2),body.position.clone().addScaledVector(right,body.scale.x/2),body.position.clone().add(new THREE.Vector3(0,body.scale.y,0))].map(v=>v.project(camera));
    rects.push({name:camp?.roster.find(p=>p.id===id)?.name||natives[id-offset]?.name||'Survivor',depth,left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))});
   }
   options.labels(rects,canvas,!paused);
  }
 }
 frameId=requestAnimationFrame(frame);canvas.focus();
 // Camera hook for the grass lab and QA captures (identical fixed views); harmless in play.
 const debug={setView(x:number,z:number,yawValue:number,pitchValue:number,eyeHeight=1.72){pos.set(x,groundY(x,z)+eyeHeight,z);eye=eyeHeight;yaw=yawValue;pitch=pitchValue;},getTime:()=>time,
  setFuture(value:boolean){future.setVisible(value);icons.setVisible(value);},icons:icons.debug};
 return {key,release,showWin,setActive,startIntro,getState,debug,
  dispose(){active=false;cancelAnimationFrame(frameId);icons.dispose();future.dispose();renderer.dispose();canvas.remove();hubUi.remove();dialog.remove();window.removeEventListener('resize',resize);}
 };
}
