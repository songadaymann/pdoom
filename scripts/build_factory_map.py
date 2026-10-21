"""Private E2M7 geometry plus original toy-factory puzzle hardware."""
import collections, copy, json, math, re
from pathlib import Path
from build_checkpoint_map import read_map, polygon_data, sector_at, navigation
from campaign_overlay import cut_wall
from factory_theme import apply as apply_theme, dress as dress_factory
from importlib.machinery import SourceFileLoader

SITES = [
    dict(name='Zvi Mowshowitz',door=0,prisoner=[680,1960],exit=[688,1904],bounds=[640,1940,724,1978]),
    dict(name='Victoria Krakovna',door=0,prisoner=[480,608],exit=[480,704],bounds=[432,560,528,656]),
    dict(name='Max Tegmark',door=0,prisoner=[864,800],exit=[864,800],bounds=[832,768,1280,1040]),
    dict(name='Paul Christiano',door=7077,prisoner=[1760,-224],exit=[1696,-224],bounds=[1728,-256,1792,-192]),
    dict(name='Ajeya Cotra',door=0,prisoner=[3296,-384],exit=[3296,-288],bounds=[3264,-416,3328,-352]),
]
# MEG3N's live feeds (x, y, the way the screen faces), west to east.
SCREENS = [
    (950,1680,0),       # showroom: left of the door ahead of the start (the sign has the wall right of it)
    (405,1917,180),     # garden: the secret pocket
    (-48,944,45),       # garden: the far corner
    (880,368,45),       # production: the north room's corner
    (1174,227,180),     # stockroom: a notch off the hall
    (1584,992,0),       # lab: closet west of the long corridor
    (1936,1088,180),    # lab: closet east of it
    (1620,200,0),       # lab: the dead-end room's west wall
    (1504,2016,270),    # showroom: the closet behind the break room
    (1744,2032,0),      # octagon: the north room's west end
    (1792,1696,0),      # octagon: the round room's west lobe
    (2064,1296,45),     # octagon: the big room's far corner
    (2240,-352,90),     # annex: the little room's back wall
    (2656,-416,90),     # yard: the back alcove
    (2864,896,0),       # yard: the low closet
    (3420,932,180),     # yard: the secret strip's dead end
    (3824,1424,180),    # warehouse: a recess in the east wall, behind the crates
    (3824,2096,225),    # warehouse: the far corner
    (3810,700,180),     # yard: the north-east room
    (3744,-352,90),     # yard: the closet past Ajeya's case
]


def build_factory(root, block, make_wad):
    SourceFileLoader('factory_assets',str(Path(__file__).with_name('build-factory-assets.py'))).load_module().build()
    original,_=read_map(root/'doom-web/local/DOOM.WAD','E2M7')
    m=copy.deepcopy(original);m['things']=[]
    for i,s in enumerate(m['sectors']):
        # No inherited damage, secrets or hidden timed traps in this first pass.
        s['special']=0
        # Keep E2M7's light contrast, lifted into a bright toy-factory range.
        s['lightlevel']=max(216 if s['textureceiling']=='F_SKY1' else 168,min(255,round(184+(s['lightlevel']-128)*.5)))
    m['sectors'][77].update(heightfloor=112,id=7077)
    # The way out (2026-10-19): E2M7's hidden walkway across the paint pool (sector 31, a
    # 64-wide strip from the north shore to the exit corridor) is a permanent plank bridge.
    m['sectors'][31].update(heightfloor=72,texturefloor='FBRIDGE',special=0,id=0)
    for l in m['lines']:
        # E2M7's own exit switch (S1, SW1EXIT) ends the level; Factory.zs only lets it once
        # all five are with you (id 7150). The secret exits stay off.
        if l['special']==11:l.update(id=7150)
        if l['special'] in [51,52,124]:l['special']=0
        # Remove key requirements, preserve ordinary native door/lift circulation.
        l['special']={26:1,27:1,28:1,32:31,33:31,34:31}.get(l['special'],l['special'])
        # E2M7's own wall switch (S1, tag 1) lowers Paul's platform again (2026-10-18),
        # as Doom type 23 on its new tag; Factory.zs refuses it until the guard is trained.
        if l['arg0']==1:l.update(special=23,id=7077,arg0=7077)
        # Disable all original crushers, stockroom lockouts and teleports.
        if l['special'] in [6,16,25,39,44,49,54,57,73,74,76,97,125,126]:l['special']=0

    def actor(x,y,kind,role=0,height=0,angle=0):
        m['things'].append(dict(x=x,y=y,type=kind,arg0=role,height=height,angle=angle,
            skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True))

    def vertex(x,y):
        v=dict(x=x,y=y)
        n=next((i for i,p in enumerate(m['vertices']) if p==v),None)
        if n is None:n=len(m['vertices']);m['vertices'].append(v)
        return n

    def edge(a,b,inside,outside,texture='-',blocking=False,line_id=0):
        ids=[vertex(*a),vertex(*b)]
        l=dict(v1=ids[0],v2=ids[1],sidefront=len(m['sides']),sideback=len(m['sides'])+1,
            blocking=blocking,twosided=True,special=0,id=line_id,arg0=line_id,dontpegbottom=True)
        for s in [inside,outside]:m['sides'].append(dict(offsetx=0,offsety=0,texturemiddle=texture,texturetop='FWTEAL',texturebottom='FWTEAL',sector=s))
        m['lines'].append(l)
        return len(m['lines'])-1

    def island(points,outer,floor,texture='FWHITE',walls=None):
        n=len(m['sectors']);s=copy.deepcopy(m['sectors'][outer]);s.update(heightfloor=floor,texturefloor=texture,id=0);m['sectors'].append(s)
        for i,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
            wall=(walls or {}).get(i,('-',False,0));edge(a,b,n,outer,*wall)
        return n

    # The original loading yard has only drop-in approaches for humans. Turn
    # its high northern sill into a real return stair, not an escort teleport.
    m['sectors'][138]['heightfloor']=16
    treads=[]
    for floor in [32,48,64]:
        treads.append(len(m['sectors']))
        sec=copy.deepcopy(m['sectors'][137]);sec.update(heightfloor=floor,id=0);m['sectors'].append(sec)
    old=copy.deepcopy(m['lines'][1305]);pieces=[]
    for a,b in [(2688,2624),(2624,2560),(2560,2496)]:
        ids=[]
        for x in [a,b]:
            point=dict(x=x,y=-96);n=next((i for i,p in enumerate(m['vertices']) if p==point),None)
            if n is None:n=len(m['vertices']);m['vertices'].append(point)
            ids.append(n)
        line=copy.deepcopy(old);line.update(v1=ids[0],v2=ids[1],special=0,blocking=False)
        for key in ['sidefront','sideback']:
            side=copy.deepcopy(m['sides'][old[key]])
            if a==2624 and side['sector']==137:side['sector']=treads[0]
            line[key]=len(m['sides']);m['sides'].append(side)
        pieces.append(line)
    m['lines'][1305]=pieces[0];m['lines'].extend(pieces[1:])
    for i,step in enumerate(treads):
        lo=-96+i*32;hi=lo+32
        edge((2560,lo),(2560,hi),step,137)
        edge((2624,hi),(2624,lo),step,137)
        edge((2560,hi),(2624,hi),step,treads[i+1] if i<2 else 137)
    # A 16-unit solid strip originally separates the sill from the yard's
    # back room. Open both walls and bridge it at the room's floor height.
    connector=len(m['sectors']);sec=copy.deepcopy(m['sectors'][134]);sec.update(id=0);m['sectors'].append(sec)
    for outer,y in [(134,-128),(138,-112)]:
        candidates=[i for i,l in enumerate(m['lines']) if l['sideback']<0 and m['sides'][l['sidefront']]['sector']==outer
            and all(m['vertices'][l[k]]['y']==y for k in ['v1','v2'])
            and min(m['vertices'][l[k]]['x'] for k in ['v1','v2'])<=2560
            and max(m['vertices'][l[k]]['x'] for k in ['v1','v2'])>=2624]
        assert len(candidates)==1,(outer,y,candidates)
        cut_wall(m,candidates[0],[(2560,2624,connector)],'FWCREAM')
    for a,b in [((2560,-128),(2560,-112)),((2624,-112),(2624,-128))]:
        line_index=edge(a,b,connector,connector,'FWCREAM',True)
        line=m['lines'][line_index];line['sideback']=-1;line['twosided']=False

    # Pantry is a small physical enclosure at the back of the original loft.
    island([(640,1940),(640,1978),(724,1978),(724,1940)],296,112,
        walls={i:('FBARS',True,7100) for i in range(4)})
    # Victoria's playpen (2026-10-18 rework): an island in the paint vat (sector 0).
    # South: a plank walkway from the room floor to an apron at the obvious gate, which
    # never opens (the rule). North: the fabric wall faces open paint, so a wrench means
    # wading; the slingshot reaches it from the floor. Destroying it raises a second
    # walkway (tag 7113) from the paint for Victoria to walk out on.
    def sector_like(floor,texture,tag=0):
        n=len(m['sectors']);s=copy.deepcopy(m['sectors'][0]);s.update(heightfloor=floor,texturefloor=texture,id=tag)
        m['sectors'].append(s);return n

    def ring(points,inside,sides):
        """Clockwise polygon: each edge is (outside, texture, blocking, id), or None if it already exists."""
        area=sum(ax*by-bx*ay for (ax,ay),(bx,by) in zip(points,points[1:]+points[:1]))
        assert area<0,('ring must run clockwise',points)
        for (a,b),side in zip(zip(points,points[1:]+points[:1]),sides):
            if side:edge(a,b,inside,*side)

    def split_vat_edge(y,x0,x1,sector):
        """Hand the middle of the vat's straight edge at y over to a walkway sector."""
        idx=next(i for i,l in enumerate(m['lines']) if l['sideback']>=0
            and {m['vertices'][l[k]]['y'] for k in ['v1','v2']}=={y}
            and {m['sides'][l[s]]['sector'] for s in ['sidefront','sideback']}=={0,1})
        old=m['lines'][idx];a,b=(m['vertices'][old[k]]['x'] for k in ['v1','v2'])
        xs=[a,x0,x1,b] if a<b else [a,x1,x0,b];xs=[x for i,x in enumerate(xs) if i==0 or x!=xs[i-1]];pieces=[]
        for p,q in zip(xs,xs[1:]):
            line=copy.deepcopy(old);line.update(v1=vertex(p,y),v2=vertex(q,y))
            for key in ['sidefront','sideback']:
                side=copy.deepcopy(m['sides'][old[key]])
                if min(p,q)==x0 and side['sector']==0:side['sector']=sector
                line[key]=len(m['sides']);m['sides'].append(side)
            pieces.append(line)
        m['lines'][idx]=pieces[0];m['lines'].extend(pieces[1:])

    gate_walk=sector_like(72,'FBRIDGE');rising=sector_like(48,'BLOOD3',7113);pen=sector_like(72,'FPLAYMAT')
    # Walkways take the vat's whole 64-unit straight edges: wide enough for escorts' clearance.
    split_vat_edge(448,448,512,gate_walk);split_vat_edge(768,448,512,rising)
    vat=('-',False,0);bars=('FBARS',True,7110);fabric=('FFABRIC',True,7111)
    ring([(448,448),(448,528),(432,528),(432,560),(528,560),(528,528),(512,528),(512,448)],gate_walk,
        [(0,*vat),(0,*vat),(0,*vat),None,(0,*vat),(0,*vat),(0,*vat),None])
    ring([(432,560),(432,656),(448,656),(512,656),(528,656),(528,560),(512,560),(448,560)],pen,
        [(0,*bars),(0,*fabric),(rising,*fabric),(0,*fabric),(0,*bars),(gate_walk,*bars),(gate_walk,'FGATE',True,7112),(gate_walk,*bars)])
    ring([(448,656),(448,768),(512,768),(512,656)],rising,[(0,*vat),None,(0,*vat),None])
    # Ajeya's existing alcove gets physical bars across its actual entrance.
    alcove=[]
    for idx,l in enumerate(m['lines']):
        if l['sideback']<0:continue
        pair={m['sides'][l[k]]['sector'] for k in ['sidefront','sideback']}
        if pair=={147,148}:
            l.update(blocking=True,id=7140,arg0=7140,dontpegbottom=True)
            for k in ['sidefront','sideback']:m['sides'][l[k]]['texturemiddle']='FBARS'
            alcove.append(idx)
    assert alcove,'Missing loading-yard display-case entrance'
    actor(1031,1760,1,angle=180)
    for i,s in enumerate(SITES):actor(*s['prisoner'],15300,i)
    actor(800,1872,15301)
    # Generic fixtures: role identifies a physical action, not an off-screen UI.
    # The vase (in the loft's far corner, clear of Zvi's cage) and the yard camera
    # stand on recoloured Doom plinths (PDToyBollard, 35 units tall); the camera
    # sits beside Ajeya's case so it never hides her.
    # Gate signs hang above eye level so the fabric panel and gate stay visible.
    # Max's two signers (Robby, WALL-E) work the production line itself, either side of
    # the stairs you come down, facing the line (2026-10-18; they were off the route).
    # The pause letter stands at the head of the line on the west strip, clear of the
    # box's loop (its old spot sat on the loop's corner, inside a stopped box).
    # Paul's guard is rated on one console (its + and - buttons) where the two button
    # stands were (2026-10-19).
    # Ajeya's alarm stands in the alcove beside her case and the camera, apart from the dolls'
    # stool loop, so the schemer's walk to it reads as leaving the work (2026-10-18).
    fixtures=[(700,1874,1,0),(652,1878,2,35),(687,1938,3,0),
        (480,672,4,24),(480,548,5,0),(800,896,6,0),
        (912,1072,7,0,270),(1248,1072,8,0,270),
        (1650,-262,9,0),
        (3232,-336,13,35),(3168,-392,14,0),
        (1031,1700,19,0),(576,836,21,35)]
    for x,y,kind,z,*angle in fixtures:actor(x,y,15302,kind,z,*angle)
    # The slingshot stands just north of the paint vat, where you first face the fabric wall.
    for x,y,colourway in [(652,1878,1),(3232,-336,0),(576,836,1)]:actor(x,y,15324,colourway)
    # Signs hang flat on the nearest wall (wall sprites) instead of turning to face you:
    # Victoria's gate status on the room's east wall, the dance demo in the showroom.
    wall_signs=[]
    # The break-room TV (kind 15) and the LINE room's big screen (kind 16, on its central
    # block, which MEG3N can reach without crossing the break room) hang on walls too.
    for x,y,kind,z in [(690,600,22,40),(1031,1840,20,28),(1290,1905,15,44),(2240,858,16,40)]:
        best=None
        for l in m['lines']:
            if l['sideback']>=0:continue
            a,b=(m['vertices'][l[k]] for k in ['v1','v2'])
            dx,dy=b['x']-a['x'],b['y']-a['y'];length=(dx*dx+dy*dy)**.5
            if length<80:continue
            u=max(40/length,min(1-40/length,((x-a['x'])*dx+(y-a['y'])*dy)/(length*length)))
            px,py=a['x']+u*dx,a['y']+u*dy;distance=((x-px)**2+(y-py)**2)**.5
            if best is None or distance<best[0]:best=(distance,px,py,dx/length,dy/length)
        _,px,py,ux,uy=best
        nx,ny=uy,-ux  # a one-sided wall's front (room) side is on its right
        wall_signs.append((round(px+nx*2),round(py+ny*2),kind,z,round(math.degrees(math.atan2(ny,nx)))%360))
    for x,y,kind,z,angle in wall_signs:actor(x,y,15302,kind,z,angle)
    # MEG3N's live feeds (2026-10-20, PDFactoryScreen): 20 wall screens to find and smash,
    # one where you first look and the rest in E2M7's nooks (closets, dead-end rooms, the
    # secret strips, behind a pillar), all on the escorts' walkable grid. Each is (x, y, facing):
    # it hangs on the nearest wall that faces that way, held clear of the wall's ends.
    for x,y,facing in SCREENS:
        best=None
        for l in m['lines']:
            if l['sideback']>=0:continue
            a,b=(m['vertices'][l[k]] for k in ['v1','v2'])
            dx,dy=b['x']-a['x'],b['y']-a['y'];length=(dx*dx+dy*dy)**.5
            if length<32:continue
            nx,ny=dy/length,-dx/length
            if math.cos(math.radians(facing)-math.atan2(ny,nx))<.7 or (x-a['x'])*nx+(y-a['y'])*ny<0:continue
            margin=min(16,length/2)/length
            u=max(margin,min(1-margin,((x-a['x'])*dx+(y-a['y'])*dy)/(length*length)))
            px,py=a['x']+u*dx,a['y']+u*dy;distance=((x-px)**2+(y-py)**2)**.5
            if best is None or distance<best[0]:best=(distance,px,py,nx,ny)
        assert best and best[0]<96,f'No wall for the screen at {(x,y)}'
        _,px,py,nx,ny=best
        actor(round(px+nx*2),round(py+ny*2),15306,0,36,round(math.degrees(math.atan2(ny,nx)))%360)
    actor(1550,-224,15303)
    for i,x in enumerate([3200,3296,3392]):actor(x,-304,15304,i)
    actor(864,800,15305)
    # Routeable original doors get unique tags, also used by the local escort nav.
    doors={}
    for i,s in enumerate(m['sectors']):
        if s['heightceiling']<=s['heightfloor']:
            old=s['id'];new=8000+i;s['id']=new;doors[i]=new
            if old:
                for l in m['lines']:
                    if l['arg0']==old and l['special']:l['id']=new;l['arg0']=new
    used=sorted({l[k] for l in m['lines'] for k in ['sidefront','sideback'] if l[k]>=0})
    remap={old:new for new,old in enumerate(used)};m['sides']=[m['sides'][i] for i in used]
    for l in m['lines']:
        for k in ['sidefront','sideback']:
            if l[k]>=0:l[k]=remap[l[k]]
    polys=polygon_data(m)
    goop=[i for i,s in enumerate(m['sectors']) if s['texturefloor'].upper().startswith(('NUKAGE','BLOOD'))]
    # Original Doom decorations as toy props, then recoloured materials per wing (factory_theme.py).
    keep_clear=[(t['x'],t['y']) for t in m['things']]+[(x,y) for x,y,*_ in fixtures+wall_signs]
    m['things'].extend(dress_factory(m,polys,original['things'],keep_clear))
    theme_report=apply_theme(m,polys,root/'doom-web/local/DOOM.WAD',root/'doom-mod')
    for t in m['things']:
        assert sector_at(polys,t['x'],t['y'])>=0,f"Factory actor outside map: {t}"
    # A screen hangs at eye height over the floor it was meant for, not on a ledge's back wall.
    for (x,y,_),t in zip(SCREENS,[t for t in m['things'] if t['type']==15306]):
        floor=lambda px,py:m['sectors'][sector_at(polys,px,py)]['heightfloor']
        assert abs(floor(x,y)-floor(t['x'],t['y']))<=24,f"Screen for {(x,y)} hangs over another floor: {t}"
    # Plan through cage openings in their released state. Native collision blocks
    # unreleased bodies; they never route before their own release.
    nav_model=copy.deepcopy(m)
    nav_model['sectors'][77]['heightfloor']=48
    nav_model['sectors'][rising].update(heightfloor=72)
    for i in goop:
        if i!=rising:nav_model['sectors'][i]['heightceiling']=nav_model['sectors'][i]['heightfloor']  # never walk paint
    for l in nav_model['lines']:
        if l['id'] in [7100,7111,7112,7140]:l['blocking']=False
    nav=navigation(nav_model,doors,root/'doom-mod',class_name='PDFactoryMap',sites=SITES,
        grid=(32,-128,-768,128,94),refuge=())
    path=root/'doom-mod/actors/PDFactoryMap.zs'
    barriers='    static int BarrierLine(int id,int index){\n'
    for line_id in [7100,7110,7111,7112,7140]:
        for n,line_index in enumerate(i for i,l in enumerate(m['lines']) if l['id']==line_id):
            barriers+=f'        if(id=={line_id}&&index=={n})return {line_index};\n'
    barriers+='        return -1;\n    }\n'
    # An original 8-unit door can lie entirely between navigation samples.
    # Runtime escorts also need the actual door centres, independent of grid tags.
    barriers+='    static int NearbyDoor(Vector2 p){\n        int tag=0;double best=96;double distance;\n'
    for sector,tag in doors.items():
        x1,y1,x2,y2=polys[sector][1]
        barriers+=f'        distance=(p-({(x1+x2)/2},{(y1+y2)/2})).Length();if(distance<best){{best=distance;tag={tag};}}\n'
    barriers+='        return tag;\n    }\n'
    # Paint vats (original NUKAGE/BLOOD floors). Factory.zs hurts a player standing in
    # them; escorts and MEG3N never route through them. Victoria's walkway leaves the list once raised.
    barriers+='    static bool Goop(int sector){\n        switch(sector){'+''.join(f'case {i}:' for i in goop)+'return true;}\n        return false;\n    }\n'
    barriers+=f'    static int RisingWalkway(){{return {rising};}}\n'
    paul_switch=[i for i,l in enumerate(m['lines']) if l['special']==23 and l['arg0']==7077]
    assert len(paul_switch)==1,'Missing Paul\'s wall switch'
    barriers+=f'    static int PaulSwitch(){{return {paul_switch[0]};}}\n'
    # The exit switch and the texture it flips to (its ANIMDEFS switch partner).
    exit_switch=[i for i,l in enumerate(m['lines']) if l['id']==7150]
    assert len(exit_switch)==1,'Missing the exit switch'
    off=m['sides'][m['lines'][exit_switch[0]]['sidefront']]['texturemiddle']
    on=re.search(rf'switch {off} on pic (\S+)',(root/'doom-mod/factory-theme-animdefs.txt').read_text()).group(1)
    barriers+=f'    static int ExitSwitch(){{return {exit_switch[0]};}}\n    static String ExitSwitchOn(){{return "{on}";}}\n'
    # The walk out (Factory.zs ExitLights): a floor chevron every third cell of the
    # escorts' own route from the break room to the exit switch, pointing onward.
    humans={int(a):int(b) for a,b in re.findall(r'humans\[(\d+)\] = (\d+);',path.read_text())}
    W,ST,OX,OY=128,32,-128,-768
    cell=lambda x,y:int((y-OY)//ST)*W+int((x-OX)//ST)
    centre=lambda i:(OX+(i%W+.5)*ST,OY+(i//W+.5)*ST)
    start,goal=cell(1300,1700),cell(1056,-530)
    prev={start:None};queue=collections.deque([start])
    while queue:
        at=queue.popleft()
        for d,step in enumerate([1,-1,W,-W]):
            if humans.get(at,0)&(1<<d) and at+step not in prev:prev[at+step]=at;queue.append(at+step)
    assert goal in prev,'No walking route from the break room to the exit'
    route=[];at=goal
    while at is not None:route.append(centre(at));at=prev[at]
    route.reverse()
    lights=[(x,y,round(math.degrees(math.atan2(ny-y,nx-x)))%360) for (x,y),(nx,ny) in
            ((route[k],route[k+1]) for k in range(2,len(route)-1,3))]
    # The walk out's big screens (2026-10-20, Jonathan: "there should be a ton of them on our
    # route to the exit"): about every 320 units of that same route, MEG3N.AVI's big screen
    # (PDFactoryRouteScreen, up to 96 x 60 at height 32, smaller on a short wall) hangs on a wall beside it, facing the route,
    # in plain sight of it, on the route's own floor and under its ceiling, held clear of the
    # wall's ends and of the other screens and props.
    one_sided=[];walls=[]  # walls also counts closed doors, which hide what is behind them
    for l in m['lines']:
        a,b=(m['vertices'][l[k]] for k in ['v1','v2'])
        dx,dy=b['x']-a['x'],b['y']-a['y'];length=(dx*dx+dy*dy)**.5
        if length<1:continue
        w=(a['x'],a['y'],b['x'],b['y'],dx,dy,length)
        if l['sideback']<0:one_sided.append(w);walls.append(w)
        elif any(m['sectors'][m['sides'][l[k]]['sector']]['heightceiling']<=m['sectors'][m['sides'][l[k]]['sector']]['heightfloor'] for k in ['sidefront','sideback']):walls.append(w)
    def blocked(x0,y0,x1,y1,skip):
        for w in walls:
            if w is skip:continue
            ax,ay,bx,by=w[:4];d=(x1-x0)*(by-ay)-(y1-y0)*(bx-ax)
            if abs(d)<1e-9:continue
            t=((ax-x0)*(by-ay)-(ay-y0)*(bx-ax))/d;u=((ax-x0)*(y1-y0)-(ay-y0)*(x1-x0))/d
            if 0<t<1 and 0<u<1:return True
        return False
    sector=lambda x,y:m['sectors'][sector_at(polys,x,y)]
    # Screens keep 160 units apart (the live feeds, the TV, the big screen); props only 48.
    taken=[(t['x'],t['y']) for t in m['things'] if t['type']==15306 or t['type']==15302 and t['arg0'] in (15,16)]
    props=[(t['x'],t['y']) for t in m['things'] if t['type']==15302]
    route_screens=[];walked=0
    for k in range(1,len(route)-3):
        (x0,y0),(x,y)=route[k-1],route[k];walked+=math.hypot(x-x0,y-y0)
        if walked<320:continue
        rx,ry=(x-x0)/math.hypot(x-x0,y-y0),(y-y0)/math.hypot(x-x0,y-y0)
        best=None
        for w in one_sided:
            ax,ay,bx,by,dx,dy,length=w
            if length<72:continue
            nx,ny=dy/length,-dx/length  # a one-sided wall's front (room) side is on its right
            if (x-ax)*nx+(y-ay)*ny<=0:continue
            size=min(.75,(length-12)/128);margin=(64*size+4)/length;u=max(margin,min(1-margin,((x-ax)*dx+(y-ay)*dy)/(length*length)))
            px,py=ax+u*dx,ay+u*dy;distance=math.hypot(x-px,y-py)
            if distance>384 or sector_at(polys,px+nx*2,py+ny*2)<0:continue
            here,there=sector(x,y),sector(px+nx*2,py+ny*2)
            if abs(there['heightfloor']-here['heightfloor'])>24 or there['heightceiling']-there['heightfloor']<96:continue
            if any(math.hypot(px-tx,py-ty)<160 for tx,ty in taken) or any(math.hypot(px-tx,py-ty)<48 for tx,ty in props) or blocked(x,y,px+nx*4,py+ny*4,w):continue
            score=distance-64*abs((dx*rx+dy*ry)/length)  # walls alongside the route first
            if best is None or score<best[0]:best=(score,px+nx*2,py+ny*2,nx,ny,size)
        if best:
            _,sx,sy,nx,ny,size=best;taken.append((sx,sy));walked=0
            route_screens.append((round(sx),round(sy),round(math.degrees(math.atan2(ny,nx)))%360,round(size,2)))
    assert len(route_screens)>=12,f'Too few big screens along the way out: {route_screens}'
    for x,y,angle,size in route_screens:actor(x,y,15307,0,32,angle);m['things'][-1].update(scalex=size,scaley=size)
    (root/'output/factory').mkdir(parents=True,exist_ok=True)
    (root/'output/factory/route-debug.json').write_text(json.dumps(dict(route=route,screens=[s[:3] for s in route_screens])))
    barriers+=f'    static int ExitLights(){{return {len(lights)};}}\n    static Vector3 ExitLight(int i){{\n        switch(i){{'
    barriers+=''.join(f'case {i}:return ({x},{y},{a});' for i,(x,y,a) in enumerate(lights))+'}\n        return (0,0,0);\n    }\n'
    path.write_text(path.read_text().rsplit('}',1)[0]+barriers+'}\n')
    text='namespace = "ZDoomTranslated";\n'+'\n'.join(block(k,**v) for k,vs in [
        ('vertex',m['vertices']),('sector',m['sectors']),('sidedef',m['sides']),('linedef',m['lines']),('thing',m['things'])] for v in vs)
    out=root/'output/factory';out.mkdir(parents=True,exist_ok=True)
    (out/'map-debug.json').write_text(json.dumps(dict(map='E2M7',sites=SITES,fixtures=fixtures,
        navigation=nav,theme=theme_report,sectors=m['sectors'],original_vertices_preserved=m['vertices'][:len(original['vertices'])]==original['vertices']),indent=2))
    (out/'E2M7-TEXTMAP.txt').write_text(text)
    return make_wad([('E2M7',b''),('TEXTMAP',text.encode()),('ENDMAP',b'')])
