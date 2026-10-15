"""Rescue overlays, one solution per prisoner (2026-10-10): Liron crawls, Stuart sneaks to the
turret's breaker, Eliezer's junction is cut, Hinton's wall is blown, Holly's bridge is powered."""
import copy
from sam_shutter_overlay import add_sam_shutter
from holly_overlay import add_holly, LANDMARKS as HOLLY_LANDMARKS

SITES = [
    dict(name='Liron Shapira', door=876, prisoner=[1940,952], exit=[1930,1180], bounds=[1872,896,1984,1108]),
    dict(name='Stuart Russell', door=878, prisoner=[-112,2128], exit=[-112,1984], bounds=[-192,2048,-32,2192]),
    dict(name='Eliezer Yudkowsky', door=879, prisoner=[-944,-288], exit=[-752,-288], bounds=[-1000,-352,-824,-224]),
    dict(name='Geoffrey Hinton', door=880, prisoner=[-1648,1120], exit=[-1424,1120], bounds=[-1696,1040,-1472,1200]),
    dict(name='Holly Elmore', door=881, prisoner=[-1544,1888], exit=[-1376,1888], bounds=[-1600,1824,-1456,1952]),
]
LANDMARKS = dict(turret=[-112,1952,32], breaker=[-48,1984],
                 charge=[-1088,640], breach=[-1456,1120],
                 sam_shutter=[-992,-288], sam_junction=[-904,575.5], sam_inside_release=[-960,-224.5], sam_shortcut_arrow=[-904,-224.5])
LANDMARKS.update(HOLLY_LANDMARKS)
CAMERAS = [(1520,1256,270),(718,1496,90),(-457,1433,217),(-1240,1360,180),
           (-56,2000,180),(-1256,1969,0),(-784,-210,0),(-1245,856,90)]


def cut_wall(model, index, openings, texture='SHAWN2'):
    """Split an original axis-aligned wall with one or more new portals."""
    old = model['lines'][index]
    assert old['sideback'] == -1, 'Never overwrite an existing neighboring sector'
    a,b = [model['vertices'][old[k]] for k in ('v1','v2')]
    axis = 'y' if a['x']==b['x'] else 'x'
    assert a['x']==b['x'] or a['y']==b['y']
    fixed = 'x' if axis=='y' else 'y'
    low,high = sorted((a[axis],b[axis]))
    assert all(low<=lo<hi<=high for lo,hi,_ in openings)
    points = sorted({a[axis],b[axis],*(p for lo,hi,_ in openings for p in (lo,hi))},reverse=a[axis]>b[axis])
    pieces = []
    for v,w in zip(points,points[1:]):
        ids=[]
        for value in (v,w):
            pt={axis:value,fixed:a[fixed]}
            at=next((i for i,p in enumerate(model['vertices']) if p==pt),None)
            if at is None: at=len(model['vertices']);model['vertices'].append(pt)
            ids.append(at)
        line=copy.deepcopy(old);line.update(v1=ids[0],v2=ids[1],special=0)
        side=copy.deepcopy(model['sides'][old['sidefront']]);side['offsetx']+=abs(v-a[axis])
        line['sidefront']=len(model['sides']);model['sides'].append(side)
        for lo,hi,sector in openings:
            if lo<=min(v,w) and max(v,w)<=hi:
                line.update(blocking=False,twosided=True,sideback=len(model['sides']))
                side.update(texturemiddle='-',texturetop=texture,texturebottom=texture,offsetx=0)
                model['sides'].append(dict(offsetx=0,offsety=0,texturemiddle='-',texturetop=texture,texturebottom=texture,sector=sector))
        pieces.append(line)
    model['lines'][index]=pieces[0];model['lines'].extend(pieces[1:])


def add_campaign(model, original):
    def sector(floor, ceiling, light, tag, flat='FLAT5', top='CEIL5_2'):
        at=len(model['sectors'])
        model['sectors'].append(dict(heightfloor=floor,heightceiling=ceiling,texturefloor=flat,
                                     textureceiling=top,lightlevel=light,special=0,id=tag))
        return at
    def edge(a,b,front,texture,back=-1):
        ids=[]
        for x,y in (a,b):
            point=dict(x=x,y=y);at=next((i for i,v in enumerate(model['vertices']) if v==point),None)
            if at is None:at=len(model['vertices']);model['vertices'].append(point)
            ids.append(at)
        line=copy.deepcopy(original['lines'][0])
        line.update(v1=ids[0],v2=ids[1],sidefront=len(model['sides']),sideback=-1,
                    blocking=back<0,twosided=back>=0,special=0,id=0,arg0=0)
        model['sides'].append(dict(offsetx=0,offsety=0,texturemiddle=texture if back<0 else '-',
                                  texturetop=texture,texturebottom=texture,sector=front))
        if back>=0:
            line['sideback']=len(model['sides'])
            model['sides'].append(dict(offsetx=0,offsety=0,texturemiddle='-',texturetop=texture,texturebottom=texture,sector=back))
        model['lines'].append(line)
    def polygon(points,front,texture,interfaces=None,skip=None):
        interfaces=interfaces or {};skip=skip or set()
        for a,b in zip(points,points[1:]+points[:1]):
            key=frozenset((a,b))
            if key not in skip:edge(a,b,front,texture,interfaces.get(key,-1))

    # Ordinary original colored doors are facility doors; prison-specific gates
    # use our explicit lock/key/interlock, not discarded original Doom key items.
    for line in model['lines']:
        line['special']={26:1,27:1,28:1,32:31,33:31,34:31}.get(line['special'],line['special'])
    for sec,tag,lines in [(27,879,(570,571)),(58,881,(547,548))]:
        model['sectors'][sec]['id']=tag
        for at in lines:model['lines'][at]['special']=0

    model['sectors'][75]['special']=0
    model['sectors'][6]['id']=896
    for i,sec in [(0,75),(2,29),(4,57)]:model['sectors'][sec]['id']=900+i
    add_sam_shutter(model)

    # Northern turret cell, beyond the original gallery's solid north wall.
    cell=sector(136,264,128,901,'FLOOR4_8')
    door=sector(136,136,160,878,top='FLAT20')
    cut_wall(model,117,[(-144,-80,door)],'DOOR3')
    gate=frozenset(((-80,2064),(-144,2064)))
    polygon([(-192,2064),(-192,2192),(-32,2192),(-32,2064),(-80,2064),(-144,2064)],cell,'BROWN1',{gate:door})
    polygon([(-144,2048),(-144,2064),(-80,2064),(-80,2048)],door,'DOOR3',skip={gate,frozenset(((-144,2048),(-80,2048)))})

    # West machinery cell: a cracked bulkhead that only a demolition charge opens.
    cell=sector(96,208,128,903,'FLOOR4_6')
    door=sector(96,96,144,880,top='FLAT20')
    cut_wall(model,163,[(1072,1168,door)],'PDCRACK')
    gate=frozenset(((-1488,1168),(-1488,1072)))
    polygon([(-1696,1040),(-1696,1200),(-1552,1200),(-1488,1200),(-1488,1168),(-1488,1072),(-1488,1040)],cell,'BROWN1',{gate:door})
    polygon([(-1488,1072),(-1488,1168),(-1472,1168),(-1472,1072)],door,'PDCRACK',skip={gate,frozenset(((-1472,1072),(-1472,1168)))})

    def actor(x,y,kind,site=0,height=0,angle=0):
        item=dict(x=x,y=y,type=kind,arg0=site,height=height,angle=angle,
                  skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True)
        model['things'].append(item);return item
    # The original prisoner remains first; all site IDs are explicit.
    for x,y,angle in CAMERAS: actor(x,y,15101,height=38,angle=angle)
    for site,data in enumerate(SITES[1:],1):actor(*data['prisoner'],15100,site,angle=90)
    actor(-112,1952,15107,1,32,270) # native physical turret
    actor(-48,1984,15108,1,12)      # rear power breaker
    actor(-804,-288,15104,2,34,180)
    # The shortcut latch also releases this cell; do not stack a second panel.
    actor(-1088,640,15110)          # demolition charge
    actor(-1456,1120,15111,3,8)
    add_holly(model, sector, polygon, cut_wall, actor)
    actor(-1328,1360,15114)         # limited spare rounds
    actor(-1008,1744,15114)
    # Secure the original side room without moving its walls or changing its
    # materials/heights. Sector90 is the existing short entrance throat.
    model['sectors'][90]['id'] = 882
    for line in model['lines']:
        if line['sideback'] >= 0:
            sectors = {model['sides'][line[k]]['sector'] for k in ['sidefront','sideback']}
            if 90 in sectors:
                for k in ['sidefront','sideback']:
                    model['sides'][line[k]]['texturetop'] = 'BIGDOOR2'
                line['special'] = 0
    # The secondary lift entrance becomes a visible fixed grate. Keep the
    # original loop traversable; this only removes a shortcut into the refuge.
    model['lines'][739].update(blocking=True, special=0)
    for k in ['sidefront','sideback']:
        model['sides'][model['lines'][739][k]]['texturemiddle'] = 'MIDGRATE'
    actor(1232,800,15116,height=16,angle=180)
    actor(1088,864,15116,height=16,angle=0)
    # A low service cover on the north wall of the refuge's raised recess.
    # The bent duct occupies verified unused space; no original vertex moves.
    gate = sector(24,24,144,883)
    duct = sector(24,64,104,884)
    landing = sector(24,152,144,885)
    cut_wall(model,588,[(800,864,gate)],'SHAWN2')
    join=frozenset(((800,976),(864,976)))
    end=frozenset(((688,1152),(752,1152)))
    polygon([(800,960),(800,976),(864,976),(864,960)],gate,'SHAWN2',
            {join:duct},skip={frozenset(((800,960),(864,960)))})
    polygon([(800,976),(800,992),(688,992),(688,1152),(752,1152),(752,1056),(864,1056),(864,976)],
            duct,'SHAWN2',{end:landing},skip={join})
    polygon([(688,1152),(688,1216),(752,1216),(752,1152)],landing,'BROWN1',skip={end})
    actor(832,959.5,15117,height=0,angle=270)
    # Native Doom health pickups: walk over them, capped at100, never respawn.
    for x,y in [(1760,1104),(-448,1360),(-1344,704),(-1232,1248),(-496,-160),(640,1664)]:
        actor(x,y,2011)
    for x,y in [(1008,928),(1056,928),(1104,928)]:actor(x,y,2012)
    return SITES


def site_code(sites=None):
    sites=sites or SITES
    code=''
    for method,typ,key in [('SiteDoor','int','door'),('SiteName','String','name'),('SiteExit','Vector2','exit')]:
        code+=f'    static {typ} {method}(int site) {{\n'
        for i,data in enumerate(sites):
            value=data[key]
            value=f'"{value}"' if typ=='String' else f'({value[0]}, {value[1]})' if typ=='Vector2' else str(value)
            code+=f'        if (site == {i}) return {value};\n'
        fallback = '0' if typ == 'int' else '""' if typ == 'String' else '(0, 0)'
        code+=f'        return {fallback};\n    }}\n'
    code+='    static bool SiteInside(int site, Vector2 p) {\n'
    for i,data in enumerate(sites):
        x0,y0,x1,y1=data['bounds']
        code+=f'        if (site == {i}) return p.X > {x0} && p.X < {x1} && p.Y > {y0} && p.Y < {y1};\n'
    return code+'        return false;\n    }\n'
