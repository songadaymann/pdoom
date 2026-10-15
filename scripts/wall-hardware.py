"""Place flat hardware on real map surfaces, with a fixed outward normal."""
import math

def mount(model,polys,sector_at,thing,width,reach=160,line_id=None,door=False,max_step=24):
    x,y=thing['x'],thing['y'];origin=sector_at(polys,x,y);candidates=[]
    for index,line in enumerate(model['lines']):
        if line_id is not None and index!=line_id:continue
        if not door and line['sideback']>=0:continue
        if door and (line['sideback']<0 or not any(model['sectors'][model['sides'][line[k]]['sector']]['id']==door for k in ['sidefront','sideback'])):continue
        a,b=[model['vertices'][line[k]] for k in ['v1','v2']]
        dx,dy=b['x']-a['x'],b['y']-a['y'];length=math.hypot(dx,dy)
        if length<width:continue
        margin=width/2/length
        t=max(margin,min(1-margin,((x-a['x'])*dx+(y-a['y'])*dy)/length**2))
        wx,wy=a['x']+t*dx,a['y']+t*dy;distance=math.hypot(x-wx,y-wy)
        if distance>reach:continue
        for sign in [1,-1]:
            nx,ny=sign*(-dy/length),sign*(dx/length)
            sector=sector_at(polys,wx+nx*2,wy+ny*2)
            if sector<0:continue
            sec=model['sectors'][sector]
            if sec['heightceiling']-sec['heightfloor']<56:continue
            # Stay on a visible, walkable approach; never move through a wall or
            # attach it to a different floor across an inaccessible step.
            if origin>=0 and abs(model['sectors'][origin]['heightfloor']-sec['heightfloor'])>max_step:continue
            if (x-wx)*nx+(y-wy)*ny<-.1:continue
            visible=True
            if origin>=0:
                for step in range(1,20):
                    at=sector_at(polys,x+(wx+nx*2-x)*step/20,y+(wy+ny*2-y)*step/20)
                    if at<0 or model['sectors'][at]['heightceiling']-model['sectors'][at]['heightfloor']<56 or abs(model['sectors'][at]['heightfloor']-model['sectors'][origin]['heightfloor'])>max_step:visible=False;break
            if not visible:continue
            angle=math.degrees(math.atan2(ny,nx))%360
            candidates.append((distance,dict(x=wx+nx*.5,y=wy+ny*.5,angle=angle,
                wall=index,wall_x=wx,wall_y=wy,sector=sector,floor=sec['heightfloor'],inset=.5,width=width)))
    if not candidates:raise ValueError(f'No wall mount for {thing} (room {origin})')
    result=min(candidates,key=lambda p:p[0])[1]
    for k in ['x','y']:thing[k]=round(result[k],4)
    thing['angle']=int(round(result['angle']))%360
    thing['arg4']=round((result['angle']-round(result['angle']))*10000)
    return dict(result,type=thing['type'],kind=thing.get('arg1',0),height=thing.get('height',0))

def cameras(model,polys,sector_at):
    """Mount every surveillance housing; its viewing cone moves separately."""
    result=[]
    for thing in model['things']:
        if thing['type']!=15101:continue
        data=mount(model,polys,sector_at,thing,36,reach=320,max_step=128)
        room=model['sectors'][data['sector']]
        # The housing is 44px at 0.7 scale. Keep it entirely below the ceiling.
        thing['height']=min(38,room['heightceiling']-room['heightfloor']-32)
        data['height']=thing['height'];data['ceiling']=room['heightceiling']
        result.append(data)
    return result
