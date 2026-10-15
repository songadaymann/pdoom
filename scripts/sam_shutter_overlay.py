"""A thin native shutter inside Sam's existing western doorway."""
import copy
import math

def add_sam_shutter(model):
    gate = len(model['sectors'])
    model['sectors'].append(dict(heightfloor=128,heightceiling=128,texturefloor='FLAT5_5',
        textureceiling='FLAT20',lightlevel=144,special=0,id=886))
    def vertex(x,y):
        point=dict(x=x,y=y)
        at=next((i for i,v in enumerate(model['vertices']) if v==point),None)
        if at is None:at=len(model['vertices']);model['vertices'].append(point)
        return at
    # Retain the original rear boundary, replacing the room side with the
    # shutter sector. Original wall end points and sector visuals stay intact.
    rear=model['lines'][572]
    assert {model['sides'][rear[k]]['sector'] for k in ('sidefront','sideback')}=={19,29}
    rear.update(blocking=False,blockeverything=False,blocksight=False,blockhitscan=False,special=0)
    for key in ('sidefront','sideback'):
        side=model['sides'][rear[key]]
        if side['sector']==29:side['sector']=gate
        side.update(texturemiddle='-',texturetop='PDSHUT',offsetx=0,offsety=0)
    # Split the two short bordering walls at x=-984, isolating a16unit slab.
    for index in (802,803):
        old=copy.deepcopy(model['lines'][index])
        a,b=[model['vertices'][old[k]] for k in ('v1','v2')]
        assert a['y']==b['y'] and sorted((a['x'],b['x']))==[-1000,-976]
        points=[a['x'],-984,b['x']]
        pieces=[]
        for x1,x2 in zip(points,points[1:]):
            line=copy.deepcopy(old);line.update(v1=vertex(x1,a['y']),v2=vertex(x2,a['y']))
            side=copy.deepcopy(model['sides'][old['sidefront']])
            side['offsetx']+=abs(x1-a['x'])
            if min(x1,x2)==-1000:side['sector']=gate
            line['sidefront']=len(model['sides']);model['sides'].append(side);pieces.append(line)
        model['lines'][index]=pieces[0];model['lines'].append(pieces[1])
    # New eastern face: the original cell remains on its east side.
    front=len(model['sides'])
    for sector in (gate,29):model['sides'].append(dict(offsetx=0,offsety=0,
        texturemiddle='-',texturetop='PDSHUT',texturebottom='-',sector=sector))
    line=copy.deepcopy(model['lines'][572]);line.update(v1=vertex(-984,-224),v2=vertex(-984,-352),
        sidefront=front,sideback=front+1,blocking=False,twosided=True,special=0)
    model['lines'].append(line)
    def actor(x,y,kind,height,angle):
        model['things'].append(dict(x=x,y=y,type=kind,height=height,angle=angle,
            skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True))
    # Follow the real cave wall to a deep junction, extending the old feed
    # beyond the blind corner without putting conduits across open space.
    actor(-904,575.5,15118,16,270)
    actor(-1002,-208,15119,14,180)
    actor(-960,-224.5,15120,16,270)
    for y in (-216,-200):actor(-1002,y,15121,34,180)
    for x in (-992,-976,-960):actor(x,-191.5,15121,34,90)
    path=[(-944,-192),(-840,-192),(-840,0),(-896,192),
          (-832,384),(-800,512),(-832,576),(-904,576)]
    for a,b in zip(path,path[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        angle=math.degrees(math.atan2(ny,nx))%360
        count=math.ceil(length/14)
        for i in range(count):
            f=(i+.5)/count
            actor(a[0]+dx*f+nx*.5,a[1]+dy*f+ny*.5,15121,34,round(angle)%360)
            model['things'][-1]['arg4']=round((angle-round(angle))*10000)
