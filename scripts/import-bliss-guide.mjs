// Deterministic atlas packaging: retain generated alpha, align feet, nearest resize.
import fs from 'node:fs/promises';
import {PNG} from 'pngjs';
const art='art/bliss-guide-v2',out='doom-web/outside-assets';
const characters=[['mario','dario'],['samwise','sam']];
await fs.mkdir(out,{recursive:true});

function bounds(im,x0,x1,y0,y1,label){
 let left=x1,right=x0,top=y1,bottom=y0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(im.data[(y*im.width+x)*4+3]>=128){
  left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
 }
 if(right-left<10||bottom-top<50)throw Error(`${label}: empty pose`);
 return{left,right,top,bottom};
}
function scaleFor(poses){return Math.min(58/Math.max(...poses.map(p=>p.bottom-p.top)),62/Math.max(...poses.map(p=>p.right-p.left)));}
function poseRows(im){
 const bands=[];
 for(let y=0;y<im.height;y++){
  let hit=false;for(let x=0;x<im.width;x++)if(im.data[(y*im.width+x)*4+3]>=128){hit=true;break;}
  if(!hit)continue;
  const last=bands.at(-1);if(last&&y-last[1]<=4)last[1]=y+1;else bands.push([y,y+1]);
 }
 const rows=bands.filter(([top,bottom])=>bottom-top>=50);
 if(rows.length!==3)throw Error(`Expected standing and two walking rows; found ${rows.length}`);
 return rows;
}
function tileFor(im,p,scale){
 const tile=new PNG({width:64,height:64}),w=Math.round((p.right-p.left)*scale),h=Math.round((p.bottom-p.top)*scale),left=Math.round((64-w)/2);tile.data.fill(0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=(Math.min(p.bottom-1,p.top+Math.floor(y/scale))*im.width+Math.min(p.right-1,p.left+Math.floor(x/scale)))*4,b=((64-h+y)*64+left+x)*4;
  im.data.copy(tile.data,b,a,a+4);tile.data[b+3]=tile.data[b+3]>=128?255:0;
 }
 // Nearest sampling can miss a lowest shoe pixel; align the visible feet after sampling.
 let bottom=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(tile.data[(y*64+x)*4+3])bottom=y+1;
 if(bottom<64){const shift=(64-bottom)*64*4;tile.data.copyWithin(shift,0,tile.data.length-shift);tile.data.fill(0,0,shift);}
 return tile;
}
const manifest={tool:'image_gen.imagegen',prompts:`${art}/prompts.json`,characters:[]};
const preview=new PNG({width:7*64*3,height:2*64*3});
for(let y=0;y<preview.height;y++)for(let x=0;x<preview.width;x++){
 const i=(y*preview.width+x)*4,c=(Math.floor(x/24)+Math.floor(y/24))%2?68:52;
 preview.data[i]=c;preview.data[i+1]=c;preview.data[i+2]=c;preview.data[i+3]=255;
}
function previewTile(tile,column,row){
 for(let y=0;y<64*3;y++)for(let x=0;x<64*3;x++){
  const a=(Math.floor(y/3)*64+Math.floor(x/3))*4;
  if(tile.data[a+3])tile.data.copy(preview.data,((row*64*3+y)*preview.width+column*64*3+x)*4,a,a+4);
 }
}
for(const [characterIndex,[who,id]] of characters.entries()){
 const source=`${art}/${id}-atlas.png`,im=PNG.sync.read(await fs.readFile(source)),rows=poseRows(im),poses=[];
 for(let row=0;row<3;row++)for(let col=0;col<8;col++){
  poses.push({row,col,...bounds(im,Math.round(col*im.width/8),Math.round((col+1)*im.width/8),rows[row][0],rows[row][1],`${id} ${row}/${col}`)});
 }
 const scale=scaleFor(poses),record={character:who,source,reference:`art/bliss-guide-v1/handoff-${id}.png`,scale,poses,handoff:null};
 for(const p of poses){
  const file=p.row===0?`guide-${who}-idle-${p.col}.png`:`guide-${who}-${p.row-1}-${p.col}.png`,tile=tileFor(im,p,scale);
  await fs.writeFile(`${out}/${file}`,PNG.sync.write(tile));if(p.col===0)previewTile(tile,p.row,characterIndex);
 }
 console.log(`Packaged ${id}: 8 standing views and 16 walking views.`);
 const handoff=`art/bliss-guide-v1/handoff-${id}.png`;
 let strip;try{strip=PNG.sync.read(await fs.readFile(handoff));}catch(e){if(e.code==='ENOENT'){console.log(`No handoff for ${id}.`);manifest.characters.push(record);continue;}throw e;}
 const cells=Array.from({length:4},(_,col)=>bounds(strip,Math.round(col*strip.width/4),Math.round((col+1)*strip.width/4),0,strip.height,`${id} handoff ${col}`));
 // Standing, walking and handoff share a 58px body height and 64px feet baseline.
 const handoffScale=scaleFor(cells);
 for(const [i,p] of cells.entries()){
  const tile=tileFor(strip,p,handoffScale);await fs.writeFile(`${out}/guide-${who}-handoff-${i}.png`,PNG.sync.write(tile));previewTile(tile,3+i,characterIndex);
 }
 record.handoff={source:handoff,scale:handoffScale,cells};manifest.characters.push(record);console.log(`Packaged ${id}: 4 handoff frames.`);
}
await fs.writeFile(`${art}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(`${art}/imported-preview.png`,PNG.sync.write(preview));
