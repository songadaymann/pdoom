// Deterministic import only: isolate generated poses, align feet, nearest resize.
// Original image-generation outputs are archived unchanged in art/cast-v1.
import fs from 'node:fs/promises';
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
const sourceDir='art/cast-v1',spriteDir='doom-mod/sprites',outsideDir='doom-web/outside-assets';
await fs.mkdir(outsideDir,{recursive:true});
const manifest={tool:'image_gen.imagegen',views:['front','front-left','left','rear-left','back','rear-right','right','front-right'],characters:[]};
const read=async path=>PNG.sync.read(await fs.readFile(path));
function rowRanges(png){
 const ranges=[];let start=-1,last=-1;
 for(let y=0;y<png.height;y++){
  let count=0;for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>=128)count++;
  if(count>=12){if(start<0)start=y;last=y;}
  else if(start>=0&&y-last>=3){if(last-start>=25)ranges.push([start,last+1]);start=-1;}
 }
 if(start>=0&&last-start>=25)ranges.push([start,last+1]);
 return ranges;
}
function bounds(png,x0,y0,x1,y1){
 let ax=x1,ay=y1,bx=x0,by=y0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(png.data[(y*png.width+x)*4+3]>=128){ax=Math.min(ax,x);ay=Math.min(ay,y);bx=Math.max(bx,x+1);by=Math.max(by,y+1);}
 if(bx<=ax||by<=ay)throw Error('Empty generated pose');return [ax,ay,bx,by];
}
function importPose(png,range,col,target){
 const [x0,y0,x1,y1]=bounds(png,Math.round(col*png.width/8),range[0],Math.round((col+1)*png.width/8),range[1]);
 const out=new PNG({width:64,height:64});out.data.fill(0);
 const scale=Math.min(target/(y1-y0),60/(x1-x0));const w=Math.round((x1-x0)*scale),h=Math.round((y1-y0)*scale),left=Math.round((64-w)/2),top=64-h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const src=((Math.min(y1-1,y0+Math.floor(y/scale)))*png.width+Math.min(x1-1,x0+Math.floor(x/scale)))*4,dst=((top+y)*64+left+x)*4;
  png.data.copy(out.data,dst,src,src+4);out.data[dst+3]=png.data[src+3]>=128?255:0;
 }
 return {png:out,bounds:[x0,y0,x1,y1]};
}
function grab(bytes,x,y){
 const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8,0);chunk.write('grAb',4);chunk.writeInt32BE(x,8);chunk.writeInt32BE(y,12);
 let crc=0xffffffff;for(const byte of chunk.subarray(4,16)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}chunk.writeUInt32BE((crc^0xffffffff)>>>0,16);
 return Buffer.concat([bytes.subarray(0,33),chunk,bytes.subarray(33)]);
}
async function writeSprite(pose,name){await fs.writeFile(`${spriteDir}/${name}.png`,grab(PNG.sync.write(pose),32,64));}
async function writeSheet(frames,path){const sheet=new PNG({width:512,height:256});sheet.data.fill(0);frames.forEach((p,i)=>PNG.bitblt(p,sheet,0,0,64,64,(i%8)*64,Math.floor(i/8)*64));await fs.writeFile(path,PNG.sync.write(sheet));}
for(const [id,prefix,crouch,index]of [['milo','SURV','MCRH',0],['jules','JULS','JCRH',1],['sam','SAMS','SCRH',2],['noah','NOAH','NCRH',3],['ash','ASHS','ACRH',4]]){
 const standingPath=id==='milo'?'doom-mod/patches/intake-survivor-sheet.png':`${sourceDir}/${id}-atlas.png`;
 const stand=await read(standingPath),low=id==='milo'?await read(`${sourceDir}/milo-crouch-atlas.png`):stand;
 const ranges=rowRanges(stand),lowRanges=rowRanges(low);const split=id==='milo'?ranges.length:id==='sam'?4:Math.floor(ranges.length/2);
 const upright=ranges.slice(0,split),crouched=id==='milo'?lowRanges:lowRanges.slice(split);
 if(upright.length<2||crouched.length<2)throw Error(`${id}: insufficient pose rows ${JSON.stringify(ranges)}`);
 const record={id,index,standingPrefix:prefix,crouchPrefix:crouch,source:standingPath,sourceSha256:createHash('sha256').update(await fs.readFile(standingPath)).digest('hex'),detectedRows:ranges,standingRows:upright,crouchRows:crouched,frames:[]};
 for(const [stance,png,rows,sp,target]of [['standing',stand,upright,prefix,56],['crouch',low,crouched,crouch,32]]){
  const phases=rows.length>=4?[0,1,2,3]:[0,1,2,1].map(i=>Math.min(i,rows.length-1));const frames=[];
  for(let f=0;f<4;f++)for(let a=0;a<8;a++){
   const pose=importPose(png,rows[phases[f]],a,target);frames.push(pose.png);
   if(id!=='milo'||stance==='crouch')await writeSprite(pose.png,`${sp}${'ABCD'[f]}${a+1}`);
   if(stance==='standing')await fs.writeFile(`${outsideDir}/person-${index}-${f}-${a}.png`,PNG.sync.write(pose.png));
   record.frames.push({stance,phase:f,angle:a,sourceBounds:pose.bounds});
  }
  await writeSheet(frames,`${sourceDir}/${id}-${stance}.png`);
 }
 manifest.characters.push(record);
}
const robot=await read(`${sourceDir}/hunter-atlas.png`),robotRows=rowRanges(robot);
if(robotRows.length<6)throw Error('Robot requires walking, aiming and stun rows: '+JSON.stringify(robotRows));
for(let f=0;f<7;f++)for(let a=0;a<8;a++){const row=[0,1,2,3,4,4,5][f];await writeSprite(importPose(robot,robotRows[row],a,64).png,`HUNT${'ABCDEFG'[f]}${a+1}`);}
manifest.robot={prefix:'HUNT',source:`${sourceDir}/hunter-atlas.png`,rows:robotRows};
await fs.writeFile(`${sourceDir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log('Imported five human standing/crouch sets and directional robot sprites.');
