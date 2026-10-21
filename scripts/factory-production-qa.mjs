// Production-room geometry for the factory smokes (Max's shipping box): the room and its
// paint channel (goop sector 279), from the built E2M7.
const ROOM=[768,1344,760,1120],PAINT=[832,1280,832,960];
// True when a footprint of radius r touches the paint.
export const overPaint=(x,y,r=0)=>x+r>PAINT[0]&&x-r<PAINT[1]&&y+r>PAINT[2]&&y-r<PAINT[3];
const open=(x,y)=>x>ROOM[0]+20&&x<ROOM[1]-20&&y>ROOM[2]+20&&y<ROOM[3]-20&&!overPaint(x,y,16)
  // Two pillars notch the north wall beside the stairs.
  &&!(y>1040&&(x>940&&x<1076||x>1132&&x<1204));
// A dry spot 72 units beside the stopped box, facing it.
export function besideBox(bx,by){
  for(const [dx,dy] of [[0,-72],[72,0],[-72,0],[0,72]]){
    const x=bx+dx,y=by+dy;
    if(open(x,y))return {x,y,angle:Math.atan2(-dy,-dx)*180/Math.PI};
  }
  throw new Error(`No dry spot beside the box at ${bx},${by}`);
}
