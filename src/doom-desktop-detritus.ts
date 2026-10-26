/* Digital detritus (Jonathan, 2026-10-23: "the world just gets more and more full of digital detritus...
 * nostalgia and digital overload of just things to kick around"). More kickable desktop junk lands with each
 * level cleared: old computers and disks after 2, games and gadgets after 3, error pop-ups and copies of copies
 * after 4. Every drawing is our own 32 x 32 pixel art of a generic object: no company's logo, name or icon. */

type Draw=(g:CanvasRenderingContext2D)=>void;
const px=(g:CanvasRenderingContext2D,c:string,x:number,y:number,w=1,h=1)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
const disc=(g:CanvasRenderingContext2D,c:string,x:number,y:number,r:number)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
const text=(g:CanvasRenderingContext2D,c:string,t:string,x:number,y:number,size=8)=>{g.fillStyle=c;g.font=`bold ${size}px monospace`;g.textAlign='center';g.textBaseline='middle';g.fillText(t,x,y);};
/** A little Win95 dialog: grey body, navy title, framed. */
const dialog=(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number)=>{px(g,'#000',x,y,w,h);px(g,'#c0c0c0',x+1,y+1,w-2,h-2);px(g,'#000080',x+1,y+1,w-2,5);px(g,'#fff',x+w-6,y+2,4,3);};

export const DETRITUS_ART:Record<string,Draw>={
 // ---- after 2: old computers and disks ----
 allinone:g=>{px(g,'#3d3a30',6,1,20,27);px(g,'#e3dcc4',7,2,18,25);px(g,'#f6f1df',7,2,18,1);px(g,'#a49d86',24,2,1,25);px(g,'#3a3a3a',9,4,14,11);px(g,'#9fb0a8',10,5,12,9);
  for(let x=0;x<12;x++)px(g,'#2c4a3a',10+x,9+Math.round(Math.sin(x*.8)*2));px(g,'#3d3a30',13,19,8,1);px(g,'#bdb59c',9,23,6,1);px(g,'#3d3a30',4,28,24,3);px(g,'#cfc8b0',5,28,22,2);},
 trash:g=>{px(g,'#3f4449',8,4,16,3);px(g,'#3f4449',13,2,6,2);px(g,'#9aa1a8',9,5,14,1);px(g,'#3f4449',7,7,18,23);px(g,'#b9c0c6',8,8,16,21);for(let x=10;x<23;x+=3)px(g,'#7f878e',x,9,1,19);px(g,'#dde2e6',8,8,2,21);},
 bomb:g=>{disc(g,'#111',15,19,10);disc(g,'#3a3a3a',12,16,3);px(g,'#555',19,7,4,4);px(g,'#8a6a3a',22,4,2,4);px(g,'#ffd23a',24,1,3,3);px(g,'#ff6a1a',25,2,1,1);px(g,'#fff7b0',27,1,1,1);},
 cube:g=>{g.fillStyle='#16171a';g.beginPath();g.moveTo(16,2);g.lineTo(30,9);g.lineTo(30,24);g.lineTo(16,31);g.lineTo(2,24);g.lineTo(2,9);g.closePath();g.fill();
  g.fillStyle='#2a2c31';g.beginPath();g.moveTo(16,3);g.lineTo(29,9);g.lineTo(16,15);g.lineTo(3,9);g.closePath();g.fill();g.fillStyle='#202226';g.beginPath();g.moveTo(16,15);g.lineTo(29,9);g.lineTo(29,24);g.lineTo(16,30);g.closePath();g.fill();},
 pinwheel:g=>{const c=['#e23b3b','#f39a1d','#f2d22b','#3cb44b','#3b7be2','#8e44c4'];for(let i=0;i<6;i++){g.fillStyle=c[i];g.beginPath();g.moveTo(16,16);g.arc(16,16,13,i*Math.PI/3,(i+1)*Math.PI/3);g.fill();}disc(g,'#fff',13,12,2);g.strokeStyle='#222';g.lineWidth=1;g.beginPath();g.arc(16,16,13,0,7);g.stroke();},
 folder:g=>{px(g,'#7a5a14',3,6,11,4);px(g,'#e7c25a',4,7,9,3);px(g,'#7a5a14',3,9,27,19);px(g,'#f3d27a',4,10,25,17);px(g,'#fbe6a6',4,10,25,2);px(g,'#d1ad4c',4,25,25,2);},
 floppy525:g=>{px(g,'#0d0d0d',2,2,28,28);px(g,'#1d1d1f',3,3,26,26);disc(g,'#5a4a3a',16,16,5);disc(g,'#0d0d0d',16,16,2);px(g,'#5a4a3a',14,22,4,7);px(g,'#f4f4ef',5,4,13,6);for(let x=6;x<17;x+=2)px(g,'#3060c0',x,6,1,2);px(g,'#0d0d0d',26,9,2,3);},
 modem:g=>{px(g,'#2b2b2b',2,11,28,13);px(g,'#d9d4c2',3,12,26,10);px(g,'#bdb7a2',3,20,26,2);for(let i=0;i<7;i++)px(g,i%3===1?'#e63a2a':'#3ae66a',6+i*3,15,2,2);px(g,'#555',5,23,3,3);px(g,'#555',24,23,3,3);text(g,'#444','56K',16,8,7);},
 mouse:g=>{g.fillStyle='#2a2a2a';g.beginPath();g.ellipse(18,20,9,11,0,0,Math.PI*2);g.fill();g.fillStyle='#e6e1d0';g.beginPath();g.ellipse(18,20,8,10,0,0,Math.PI*2);g.fill();px(g,'#2a2a2a',10,15,16,1);px(g,'#2a2a2a',18,10,1,6);
  g.strokeStyle='#2a2a2a';g.lineWidth=1.4;g.beginPath();g.moveTo(18,10);g.bezierCurveTo(18,2,6,8,4,2);g.stroke();},
 cdrom:g=>{const r=g.createConicGradient?g.createConicGradient(0,16,16):null;if(r){['#c9d6e8','#e8c9e6','#c9e8d6','#e8e2c9','#c9d6e8'].forEach((c,i)=>r.addColorStop(i/4,c));g.fillStyle=r;}else g.fillStyle='#d6dde8';
  g.beginPath();g.arc(16,16,14,0,7);g.fill();disc(g,'#9aa3b0',16,16,5);disc(g,'rgba(0,0,0,0)',16,16,2);g.clearRect(14,14,4,4);text(g,'#c81d25','FREE',16,9,7);},
 // ---- after 3: games and gadgets ----
 handheld:g=>{px(g,'#4a4a4a',6,1,20,30);px(g,'#cfccc4',7,2,18,28);px(g,'#6f6d7a',9,4,14,11);px(g,'#9bbc0f',10,5,12,9);px(g,'#306230',12,8,3,3);px(g,'#306230',17,10,2,2);
  px(g,'#2a2a2a',9,20,6,2);px(g,'#2a2a2a',11,18,2,6);disc(g,'#8b1d4a',21,22,1.6);disc(g,'#8b1d4a',24,19,1.6);px(g,'#8f8c84',20,27,2,1);px(g,'#8f8c84',23,27,2,1);},
 cartridge:g=>{px(g,'#4a4a4a',5,2,22,28);px(g,'#a9a6a0',6,3,20,26);px(g,'#8c8984',6,3,20,3);px(g,'#f2f2f2',9,9,14,13);px(g,'#3b7be2',10,10,12,6);px(g,'#f2d22b',12,12,3,2);px(g,'#2a2a2a',8,26,16,3);for(let x=9;x<24;x+=2)px(g,'#c9a33a',x,27,1,2);},
 pad:g=>{px(g,'#222',1,8,30,16);px(g,'#bdbab3',2,9,28,14);px(g,'#3a3a3a',4,11,24,10);px(g,'#bdbab3',5,12,8,8);px(g,'#222',6,15,6,2);px(g,'#222',8,13,2,6);px(g,'#555',14,16,2,1);px(g,'#555',17,16,2,1);disc(g,'#c81d25',22,17,1.8);disc(g,'#c81d25',26,17,1.8);},
 joystick:g=>{px(g,'#1a1a1a',5,22,22,8);px(g,'#3a3a3a',6,23,20,5);px(g,'#555',15,9,2,14);disc(g,'#d8262b',16,8,5);disc(g,'#ff8a8a',14,6,1.5);disc(g,'#d8262b',23,26,1.5);},
 crt:g=>{px(g,'#555',9,0,1,6);px(g,'#555',22,0,1,6);px(g,'#555',10,5,12,1);px(g,'#3a2a1c',2,6,28,22);px(g,'#6a4a2c',3,7,26,20);px(g,'#222',5,9,18,16);
  for(let y=10;y<24;y++)for(let x=6;x<22;x++)px(g,((x*7+y*13)%5)>2?'#c8c8c8':'#5a5a5a',x,y);disc(g,'#b9b2a0',26,12,1.5);disc(g,'#b9b2a0',26,17,1.5);px(g,'#222',6,28,4,3);px(g,'#222',22,28,4,3);},
 cassette:g=>{px(g,'#1a1a1a',2,7,28,18);px(g,'#3d3d3d',3,8,26,16);px(g,'#f2ead2',5,9,22,8);px(g,'#e23b3b',5,9,22,2);px(g,'#222',8,13,16,4);disc(g,'#ddd',11,15,1.6);disc(g,'#ddd',21,15,1.6);px(g,'#5a5a5a',9,20,14,4);},
 pet:g=>{g.fillStyle='#2a2a2a';g.beginPath();g.ellipse(16,17,12,14,0,0,Math.PI*2);g.fill();g.fillStyle='#ff8ac2';g.beginPath();g.ellipse(16,17,11,13,0,0,Math.PI*2);g.fill();
  px(g,'#3a3a3a',9,9,14,11);px(g,'#b8c99a',10,10,12,9);px(g,'#3a3a3a',14,12,4,4);px(g,'#3a3a3a',13,16,1,1);px(g,'#3a3a3a',18,16,1,1);disc(g,'#fff6a0',11,24,1.6);disc(g,'#fff6a0',16,26,1.6);disc(g,'#fff6a0',21,24,1.6);},
 flipphone:g=>{px(g,'#1d1d1f',9,1,14,14);px(g,'#7c8693',10,2,12,12);px(g,'#9fd0ff',11,4,10,8);text(g,'#1d1d1f','37',16,8,7);px(g,'#1d1d1f',9,15,14,16);px(g,'#9aa3ad',10,16,12,14);for(let y=19;y<29;y+=3)for(let x=11;x<21;x+=4)px(g,'#5d6670',x,y,3,2);},
 pager:g=>{px(g,'#1a1a1a',3,8,26,16);px(g,'#2d2d2d',4,9,24,14);px(g,'#7f9f6f',6,11,16,7);text(g,'#1d2a14','911',14,15,7);px(g,'#555',24,11,3,3);px(g,'#555',24,17,3,3);},
 token:g=>{disc(g,'#6a4f12',16,16,14);disc(g,'#d9a821',16,16,13);disc(g,'#f2cf5a',16,16,10);disc(g,'#d9a821',16,16,6);px(g,'#f7e39a',9,9,3,3);text(g,'#6a4f12','25',16,16,8);},
 // ---- after 4: overload ----
 error:g=>{dialog(g,1,5,30,22);disc(g,'#d8262b',8,17,5);px(g,'#fff',6,15,4,1);px(g,'#fff',7,14,2,1);g.strokeStyle='#fff';g.lineWidth=1.6;g.beginPath();g.moveTo(5.5,14.5);g.lineTo(10.5,19.5);g.moveTo(10.5,14.5);g.lineTo(5.5,19.5);g.stroke();
  for(let y=14;y<21;y+=3)px(g,'#555',15,y,13,1);px(g,'#000',20,23,9,3);px(g,'#dcdcdc',21,24,7,1);},
 popup:g=>{dialog(g,1,3,30,26);px(g,'#f2d22b',3,10,26,16);text(g,'#c81d25','YOU',16,14,8);text(g,'#c81d25','WON!',16,21,8);for(let i=0;i<6;i++)px(g,['#e23b3b','#3b7be2','#3cb44b'][i%3],4+i*4,26,2,2);},
 progress:g=>{dialog(g,1,8,30,16);px(g,'#808080',3,16,26,5);px(g,'#fff',4,17,24,3);for(let x=4;x<27;x+=3)px(g,'#000080',x,17,2,3);px(g,'#fff',27,17,1,3);text(g,'#000','99%',16,23,6);},
 hourglass:g=>{px(g,'#000',8,2,16,3);px(g,'#000',8,27,16,3);g.fillStyle='#000';g.beginPath();g.moveTo(9,5);g.lineTo(23,5);g.lineTo(17,16);g.lineTo(23,27);g.lineTo(9,27);g.lineTo(15,16);g.closePath();g.fill();
  g.fillStyle='#fff';g.beginPath();g.moveTo(11,6);g.lineTo(21,6);g.lineTo(16.5,15.5);g.lineTo(21,26);g.lineTo(11,26);g.lineTo(15.5,15.5);g.closePath();g.fill();px(g,'#d9b34a',12,7,8,3);px(g,'#d9b34a',15,13,2,10);px(g,'#d9b34a',12,22,8,4);},
 page404:g=>{px(g,'#222',4,2,24,28);px(g,'#fff',5,3,22,26);px(g,'#ccc',5,3,22,4);disc(g,'#e23b3b',8,5,1);disc(g,'#f2d22b',11,5,1);text(g,'#222','404',16,15,9);for(let y=21;y<27;y+=2)px(g,'#bbb',8,y,16,1);},
 sticky:g=>{px(g,'#c9a800',4,4,25,25);px(g,'#ffe95a',4,4,24,24);px(g,'#f3d93a',4,4,24,3);text(g,'#2a2a8a','TODO',16,13,8);for(let y=18;y<26;y+=3)px(g,'#3a3aa0',8,y,14,1);},
 smiley:g=>{disc(g,'#1a1a1a',16,16,14);disc(g,'#ffd21f',16,16,13);px(g,'#1a1a1a',11,10,3,5);px(g,'#1a1a1a',18,10,3,5);g.strokeStyle='#1a1a1a';g.lineWidth=2;g.beginPath();g.arc(16,16,8,Math.PI*.15,Math.PI*.85);g.stroke();},
 heart:g=>{const rows=['..XXX....XXX..','.XRRRX..XRRRX.','XRRWRRXXRRRRRX','XRWRRRRRRRRRRX','XRRRRRRRRRRRRX','.XRRRRRRRRRRX.','..XRRRRRRRRX..','...XRRRRRRX...','....XRRRRX....','.....XRRX.....','......XX......'];
  rows.forEach((r,y)=>{for(let x=0;x<r.length;x++){const k=r[x];if(k==='.')continue;px(g,k==='X'?'#3a0a10':k==='W'?'#ffd0d8':'#e8243f',2+x*2,5+y*2,2,2);}});},
 bell:g=>{g.fillStyle='#c99a0c';g.beginPath();g.moveTo(16,4);g.bezierCurveTo(7,4,8,14,7,22);g.lineTo(25,22);g.bezierCurveTo(24,14,25,4,16,4);g.fill();g.fillStyle='#f5c518';g.beginPath();g.moveTo(16,5);g.bezierCurveTo(9,5,10,14,9,21);g.lineTo(23,21);g.bezierCurveTo(22,14,23,5,16,5);g.fill();
  px(g,'#c99a0c',5,22,22,3);disc(g,'#c99a0c',16,27,2.5);disc(g,'#e3302a',24,8,6);text(g,'#fff','99',24,8,7);},
};

export type DetritusSpec={id:string;art:string;label:string;x:number;z:number;mass:number;stage:number;scale?:number;labelRange?:number};
// stage = how many levels must be cleared before it lands. Spots keep 6 m off every door, out of the hilltop
// zones where the rescued wander, and inside the toys' fences.
export const DETRITUS:DetritusSpec[]=[
 // after 2: old computers and disks, near the bunker, the camp and HAL's valley
 {id:'allinone',art:'allinone',label:'Hard Disk',x:9,z:-30,mass:2.4,stage:2,scale:1.4},
 {id:'trash',art:'trash',label:'Trash',x:34,z:-20,mass:1.6,stage:2},
 {id:'bomb',art:'bomb',label:'System Error',x:-24,z:-30,mass:1.1,stage:2},
 {id:'cube',art:'cube',label:'Workstation',x:44,z:-40,mass:2.6,stage:2,scale:1.35},
 {id:'pinwheel',art:'pinwheel',label:'Not Responding',x:-2,z:-46,mass:.8,stage:2},
 {id:'folder',art:'folder',label:'New Folder (17)',x:22,z:-50,mass:.6,stage:2},
 {id:'floppy525',art:'floppy525',label:'DISK 2 OF 14',x:-20,z:-170,mass:.6,stage:2},
 {id:'modem',art:'modem',label:'56K',x:18,z:-165,mass:1.2,stage:2},
 {id:'mouse',art:'mouse',label:'Mouse',x:-28,z:-150,mass:.8,stage:2},
 {id:'cdrom',art:'cdrom',label:'FREE HOURS!',x:56,z:-24,mass:.5,stage:2},
 // after 3: games and gadgets, west along the road to MEG3N and round the camp
 {id:'handheld',art:'handheld',label:'Low Battery',x:-120,z:-14,mass:1.4,stage:3,scale:1.3},
 {id:'cartridge',art:'cartridge',label:'BLOW ON IT',x:-110,z:12,mass:.7,stage:3},
 {id:'pad',art:'pad',label:'Player 2',x:-96,z:-6,mass:.8,stage:3},
 {id:'joystick',art:'joystick',label:'Joystick',x:-80,z:18,mass:1,stage:3},
 {id:'crt',art:'crt',label:'Channel 3',x:-60,z:-16,mass:3,stage:3,scale:1.6},
 {id:'cassette',art:'cassette',label:'Mixtape',x:-44,z:22,mass:.6,stage:3},
 {id:'pet',art:'pet',label:'Pet (hungry)',x:-30,z:4,mass:.5,stage:3},
 {id:'flipphone',art:'flipphone',label:'37 Missed Calls',x:-6,z:-60,mass:.6,stage:3},
 {id:'pager',art:'pager',label:'911 911',x:30,z:-62,mass:.5,stage:3},
 {id:'token',art:'token',label:'INSERT COIN',x:-138,z:30,mass:.5,stage:3},
 // after 4: overload, round AGENTIC.BAT, the south meadow toward the gate, and copies of copies everywhere
 {id:'error',art:'error',label:'Error',x:116,z:62,mass:.9,stage:4},
 {id:'popup',art:'popup',label:'Congratulations.exe',x:100,z:44,mass:.9,stage:4},
 {id:'progress',art:'progress',label:'99%',x:126,z:40,mass:.8,stage:4},
 {id:'hourglass',art:'hourglass',label:'Please wait',x:80,z:96,mass:.9,stage:4},
 {id:'page404',art:'page404',label:'404',x:62,z:120,mass:.6,stage:4},
 {id:'sticky',art:'sticky',label:'TODO.txt',x:96,z:140,mass:.4,stage:4},
 {id:'smiley',art:'smiley',label:':)',x:40,z:80,mass:.7,stage:4},
 {id:'heart',art:'heart',label:'Like',x:20,z:60,mass:.6,stage:4},
 {id:'bell',art:'bell',label:'Notifications (99+)',x:-10,z:46,mass:.8,stage:4},
 {id:'crt-2',art:'crt',label:'Channel 3 (2)',x:70,z:20,mass:5,stage:4,scale:2.2},
 {id:'handheld-2',art:'handheld',label:'Low Battery (2)',x:140,z:120,mass:4,stage:4,scale:2},
 {id:'folder-2',art:'folder',label:'New Folder (18)',x:52,z:-8,mass:.6,stage:4},
 {id:'folder-3',art:'folder',label:'New Folder (19)',x:-36,z:-44,mass:.6,stage:4},
 {id:'sticky-2',art:'sticky',label:'Copy of TODO.txt',x:-90,z:30,mass:.4,stage:4},
 {id:'cdrom-2',art:'cdrom',label:'FREE HOURS! (2)',x:24,z:100,mass:.5,stage:4},
 {id:'error-2',art:'error',label:'Error (2)',x:-60,z:40,mass:.9,stage:4},
 {id:'popup-2',art:'popup',label:'You Won Again.exe',x:10,z:-150,mass:.9,stage:4},
 {id:'floppy525-2',art:'floppy525',label:'DISK 3 OF 14',x:-130,z:-30,mass:.6,stage:4},
 {id:'pinwheel-2',art:'pinwheel',label:'Still Not Responding',x:120,z:150,mass:.8,stage:4},
 {id:'bomb-2',art:'bomb',label:'System Error (2)',x:150,z:30,mass:1.1,stage:4},
];

/* Piles: the overload. Seeded heaps of copies near where you walk (the bunker exit, the camp, the roads, HAL's
 * valley, the south meadow toward the gate), more each stage. Their labels only show up close. Phones (coarse
 * pointers) get the named pieces above and none of the piles. */
const BASE_LABEL:Record<string,string>={allinone:'Hard Disk',trash:'Trash',bomb:'System Error',cube:'Workstation',pinwheel:'Not Responding',folder:'New Folder',floppy525:'DISK',modem:'56K',mouse:'Mouse',cdrom:'FREE HOURS!',
 handheld:'Low Battery',cartridge:'BLOW ON IT',pad:'Player',joystick:'Joystick',crt:'Channel',cassette:'Mixtape',pet:'Pet (hungry)',flipphone:'Missed Calls',pager:'911',token:'INSERT COIN',
 error:'Error',popup:'You Won!',progress:'99%',hourglass:'Please wait',page404:'404',sticky:'TODO',smiley:':)',heart:'Like',bell:'Notifications'};
const WAVE=[['allinone','trash','bomb','cube','pinwheel','folder','floppy525','modem','mouse','cdrom'],['handheld','cartridge','pad','joystick','crt','cassette','pet','flipphone','pager','token'],
 ['error','popup','progress','hourglass','page404','sticky','smiley','heart','bell','folder','cdrom','floppy525','pinwheel']];
const PILES:[stage:number,x:number,z:number,count:number][]=[
 [2,6,-26,7],[2,52,-14,5],[2,-12,-60,5],[2,-14,-165,5],[2,32,44,4],
 [3,-100,6,7],[3,-60,24,5],[3,-38,-24,5],[3,-92,-58,4],[3,26,-158,4],
 [4,108,58,7],[4,70,110,9],[4,58,160,7],[4,32,-32,6],[4,-42,-50,4],[4,-120,-40,4],[4,0,30,5],
];
// keep clear of buildings, doors, the final dialog and the hilltop zones (centre, radius)
const KEEP_OUT:[number,number,number][]=[[17,8,13],[17,0,6],[10,-208,24],[2.6,-200,7],[-162,8,26],[-150,2.5,7],[150,98,20],[143.5,86.7,7],[137,79,3],[-45,-92,11],
 [-30,-72,10],[-58,-66,10],[-74,-82,10],[-28,-118,10],[30,-185,8],[-178,22,2]];
export function detritusPiles(coarse:boolean):DetritusSpec[]{
 if(coarse)return [];
 const mass=Object.fromEntries(DETRITUS.map(d=>[d.art,d.mass])),count:Record<string,number>={};let seed=20261023;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 return PILES.flatMap(([stage,cx,cz,n],p)=>{
  const out:DetritusSpec[]=[],wave=WAVE[stage-2];
  for(let k=0,tries=0;k<n&&tries<n*12;tries++){
   const a=rnd()*Math.PI*2,r=1.5+Math.sqrt(rnd())*7,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
   if(KEEP_OUT.some(([ox,oz,or])=>Math.hypot(x-ox,z-oz)<or)||out.some(o=>Math.hypot(o.x-x,o.z-z)<2.4))continue;
   const art=wave[Math.floor(rnd()*wave.length)];count[art]=(count[art]??1)+1;
   out.push({id:`${art}-pile${p}-${k}`,art,label:`${BASE_LABEL[art]} (${count[art]+1})`,x,z,mass:mass[art]??.8,stage,scale:rnd()<.12?1.6:1,labelRange:14});k++;
  }
  return out;
 });
}
