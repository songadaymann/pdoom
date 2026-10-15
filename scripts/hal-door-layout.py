"""Mount door controls on real adjacent walls on every walkable approach side."""
import math
from build_checkpoint_map import sector_at

def controls(model,polys,door_index,center):
    faces=[]
    for line in model['lines']:
        if line['sideback']<0:continue
        secs=[model['sides'][line[k]]['sector'] for k in ['sidefront','sideback']]
        if door_index not in secs:continue
        other=secs[1] if secs[0]==door_index else secs[0]
        sec=model['sectors'][other]
        if sec['heightceiling']-sec['heightfloor']<56:continue
        a,b=[model['vertices'][line[k]] for k in ['v1','v2']]
        length=math.hypot(b['x']-a['x'],b['y']-a['y'])
        if length<32:continue
        mid=((a['x']+b['x'])/2,(a['y']+b['y'])/2)
        if other not in [f[0] for f in faces]:faces.append((other,mid))
    result=[]
    for other,mid in faces:
        candidates=[]
        # Thin door vestibules often have only 16u jambs. Their controls belong
        # on the adjacent hall wall, not hidden on those tiny jambs.
        for wall,line in enumerate(model['lines']):
            if line['sideback']>=0:continue
            wall_sector=model['sides'][line['sidefront']]['sector']
            wall_sec=model['sectors'][wall_sector]
            if wall_sec['heightceiling']-wall_sec['heightfloor']<56:continue
            a,b=[model['vertices'][line[k]] for k in ['v1','v2']]
            dx,dy=b['x']-a['x'],b['y']-a['y'];length=math.hypot(dx,dy)
            if length<32:continue
            t=max(16/length,min(1-16/length,((mid[0]-a['x'])*dx+(mid[1]-a['y'])*dy)/length**2))
            x,y=a['x']+t*dx,a['y']+t*dy
            for sign in [1,-1]:
                nx,ny=sign*(-dy/length),sign*(dx/length)
                if sector_at(polys,x+nx*4,y+ny*4)!=wall_sector:continue
                ox,oy=mid[0]-center[0],mid[1]-center[1];ol=math.hypot(ox,oy)
                if not ol or (x-mid[0])*ox+(y-mid[1])*oy<0:continue
                distance=math.hypot(x-mid[0],y-mid[1])
                if distance>112:continue
                start=(mid[0]+ox/ol*4,mid[1]+oy/ol*4)
                visible=True
                for step in range(1,21):
                    sx=start[0]+(x+nx*4-start[0])*step/20;sy=start[1]+(y+ny*4-start[1])*step/20
                    at=sector_at(polys,sx,sy)
                    if at<0 or model['sectors'][at]['heightceiling']-model['sectors'][at]['heightfloor']<56 or abs(model['sectors'][at]['heightfloor']-model['sectors'][other]['heightfloor'])>24:visible=False;break
                if not visible:continue
                candidates.append((distance,dict(x=round(x+nx*.5,4),y=round(y+ny*.5,4),angle=round(math.degrees(math.atan2(ny,nx))%360,4),wall=wall,wall_x=x,wall_y=y,inset=.5,width=32,sector=wall_sector,floor=wall_sec['heightfloor'])))
        if not candidates:raise ValueError(f'No visible control wall for door {door_index} approach {other}')
        result.append(min(candidates,key=lambda p:p[0])[1])
    assert len(result)>=2,(door_index,result)
    return result
