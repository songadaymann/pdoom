import * as THREE from 'three';

/* The boss-fight art batch (the doc "p(DOOM) Boss Fight: Lines and Sprites", generated 2026-10-26),
 * which scripts/import-endgame-assets.mjs copies into ignored doom-web/local/endgame/sprites/. Sheets
 * are sliced here by equal cells, as the doc promises the importer will. Each cell is trimmed to what's
 * drawn and shrunk to the meadow sprites' density (64 px for 1.8 m), so it reads as the same chunky
 * pixels. Anything missing returns null and the code-drawn placeholder stays. */
const BASE='/local/endgame/sprites/';
export const DENSITY=64/1.8;// px per metre, the meadow figures'

type Box={x:number;y:number;w:number;h:number};
export type Cut={img:HTMLCanvasElement;box:Box;cw:number;ch:number};// a cell, and where its drawing sits in it
export type Pic={tex:THREE.CanvasTexture;flip:THREE.CanvasTexture;w:number;h:number};// metres

const sheets=new Map<string,Promise<HTMLCanvasElement|null>>();
function sheet(file:string){
 let p=sheets.get(file);
 if(!p){p=new Promise(done=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d')!.drawImage(im,0,0);done(c);};im.onerror=()=>done(null);im.src=BASE+file;});sheets.set(file,p);}
 return p;
}
// where alpha is drawn, inside a region
function bbox(d:Uint8ClampedArray,stride:number,r:Box):Box|null{
 let x0=1e9,y0=1e9,x1=-1,y1=-1;
 for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(d[(y*stride+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return x1<0?null:{x:x0-r.x,y:y0-r.y,w:x1-x0+1,h:y1-y0+1};
}
// equal cells, left to right, top to bottom, each trimmed to its drawing
export async function cut(file:string,cols:number,rows:number):Promise<Cut[]|null>{
 const s=await sheet(file);if(!s)return null;
 const d=s.getContext('2d')!.getImageData(0,0,s.width,s.height).data,out:Cut[]=[];
 for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
  const x=Math.round(k*s.width/cols),y=Math.round(r*s.height/rows),cw=Math.round((k+1)*s.width/cols)-x,ch=Math.round((r+1)*s.height/rows)-y;
  const box=bbox(d,s.width,{x,y,w:cw,h:ch})??{x:0,y:0,w:1,h:1},img=document.createElement('canvas');img.width=box.w;img.height=box.h;
  img.getContext('2d')!.drawImage(s,x+box.x,y+box.y,box.w,box.h,0,0,box.w,box.h);out.push({img,box,cw,ch});
 }
 return out;
}
// opaque cells as raw pixels (the face sheets: 48 x 56, seven colours, black is an unlit tile)
export async function pixels(file:string,cols:number,rows:number):Promise<ImageData[]|null>{
 const s=await sheet(file);if(!s)return null;const g=s.getContext('2d')!,w=s.width/cols,h=s.height/rows,out:ImageData[]=[];
 for(let r=0;r<rows;r++)for(let k=0;k<cols;k++)out.push(g.getImageData(k*w,r*h,w,h));
 return out;
}
// shrink by halving first, so every source pixel counts
export function shrink(src:HTMLCanvasElement,w:number,h:number,flip=false){
 let cur=src;
 while(cur.width/2>=w*1.5&&cur.height/2>=h*1.5){const n=document.createElement('canvas');n.width=Math.ceil(cur.width/2);n.height=Math.ceil(cur.height/2);n.getContext('2d')!.drawImage(cur,0,0,n.width,n.height);cur=n;}
 const out=document.createElement('canvas');out.width=Math.max(1,w);out.height=Math.max(1,h);const g=out.getContext('2d')!;
 if(flip){g.translate(out.width,0);g.scale(-1,1);}g.drawImage(cur,0,0,out.width,out.height);return out;
}
function texture(c:HTMLCanvasElement){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;}
// a cell as a billboard picture, `mpp` metres for each source pixel
export function pic(c:Cut,mpp:number):Pic{
 const w=Math.round(c.box.w*mpp*DENSITY),h=Math.round(c.box.h*mpp*DENSITY);
 return {tex:texture(shrink(c.img,w,h)),flip:texture(shrink(c.img,w,h,true)),w:w/DENSITY,h:h/DENSITY};
}
// how tall a meadow figure stands, in its own pixels (the front idle frame)
export function standingPx(t:THREE.Texture|null){
 const im=t?.image as HTMLImageElement|undefined;if(!im?.width)return 54;
 const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d')!;g.drawImage(im,0,0);
 return bbox(g.getImageData(0,0,c.width,c.height).data,c.width,{x:0,y:0,w:c.width,h:c.height})?.h??54;
}

// Fight poses for one person, at their meadow figure's size: 0 swat, 1 throw, 2 flat on their back,
// 3 carried, 4 cheering (the swat, a crouch, is scaled to stand a little under their full height); and
// from its own sheet, 5 the ending's deadpan stare into the camera, at their full height.
export const POSE={swat:0,throw:1,flat:2,carried:3,cheer:4,stare:5} as const;
export async function poses(id:string,stand:THREE.Texture|null):Promise<Pic[]|null>{
 const [cells,stare]=await Promise.all([cut(id+'-fight.png',5,1),cut(id+'-stare.png',1,1)]);if(!cells)return null;
 const px=standingPx(stand)/DENSITY,out=cells.map(c=>pic(c,px*.93/cells[0].box.h));
 if(stare)out.push(pic(stare[0],px/stare[0].box.h));
 return out;
}
// The wasteland's props: 0 a dead tree, 1 a smoking stump, 2 a half-buried monitor, 3 a melted
// wastebasket, 4 a smoking crater, each at its own height in metres. Made once.
let propPics:Promise<Pic[]|null>|null=null;
export function props(){
 return propPics??=cut('wasteland-props.png',5,1).then(cells=>cells&&cells.map((c,i)=>pic(c,[6.5,2.6,1.15,1,2.4][i]/c.box.h)));
}
// the doges, 1.35 m nose to tail: 0-3 the run, 4 the tackle, 5 trotting off with a disc, 6 running at
// you, 7 bonked, 8 riding a rocket, 9 sitting. They face right; `flip` faces left.
export async function doges():Promise<Pic[]|null>{
 const cells=await cut('doge.png',5,2);if(!cells)return null;
 const mpp=1.35/cells[0].box.w;return cells.map(c=>pic(c,mpp));
}
// the falling sink (0) and the landed, cracked one (1), 2.2 m across
export async function sinks():Promise<Pic[]|null>{
 const cells=await cut('sink.png',2,1);if(!cells)return null;
 const mpp=2.2/cells[1].box.w;return cells.map(c=>pic(c,mpp));
}
// Grok's avatar: neutral, smug, guilty
export async function grokFaces():Promise<string[]|null>{
 const cells=await cut('grok-avatar.png',3,1);return cells?cells.map(c=>shrink(c.img,64,Math.round(64*c.box.h/c.box.w)).toDataURL()):null;
}
// The first-person hands: 0 holding a disc, 1 wound back, 2 letting go, 3 swatting, 4 open for the
// catch, and from its own frame, 5 batting a ball back with the disc still in hand, like a racket. The
// sleeves come up through the bottom edge; `root` is where, as a fraction of the cell's width, so the
// arm can stay put on screen while the hand changes.
export type Hand={url:string;w:number;h:number;root:number};
// a hand drawn into a w x h frame, and where its sleeve crosses the bottom edge
function arm(w:number,h:number,draw:(g:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d')!;draw(g);
 const d=g.getImageData(0,h-1,w,1).data;let x0=-1,x1=-1;for(let x=0;x<w;x++)if(d[x*4+3]>40){if(x0<0)x0=x;x1=x;}
 return {canvas,x0,x1};
}
export async function hands():Promise<Hand[]|null>{
 const [cells,bat]=await Promise.all([cut('floppy-hands.png',5,1),cut('floppy-hand-bat.png',1,1)]);if(!cells)return null;
 const top=Math.min(...cells.map(c=>c.box.y)),h=cells[0].ch-top,arms=cells.map(c=>arm(c.cw,h,g=>g.drawImage(c.img,c.box.x,c.box.y-top)));
 if(bat){
  // its frame is drawn bigger than the sheet's cells: scale it so its sleeve is as wide as the letting-go arm's
  const b=bat[0],own=arm(b.box.w,b.box.h,g=>g.drawImage(b.img,0,0)),s=(arms[2].x1-arms[2].x0)/(own.x1-own.x0),bw=Math.round(b.box.w*s),bh=Math.round(b.box.h*s);
  arms.push(arm(Math.round(b.cw*s),h,g=>g.drawImage(shrink(b.img,bw,bh),Math.round(b.box.x*s),h-bh)));
 }
 return arms.map(({canvas:c,x0,x1})=>({url:shrink(c,Math.round(c.width/2),Math.round(c.height/2)).toDataURL(),w:c.width,h:c.height,root:x0<0?.5:(x0+x1)/2/c.width}));
}
