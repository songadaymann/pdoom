"""Computer Station: original topology, authored rescue hardware and safe exits."""
import copy,json,hashlib
from pathlib import Path
from build_checkpoint_map import read_map,polygon_data,sector_at,navigation
from campaign_overlay import cut_wall
from importlib.machinery import SourceFileLoader
door_layout=SourceFileLoader('hal_door_layout',str(Path(__file__).with_name('hal-door-layout.py'))).load_module()
wall_hardware=SourceFileLoader('wall_hardware',str(Path(__file__).with_name('wall-hardware.py'))).load_module()
sign_assets=SourceFileLoader('evaluation_sign_assets',str(Path(__file__).with_name('build-evaluation-sign.py'))).load_module()
environment=SourceFileLoader('hal_level_environment',str(Path(__file__).with_name('level-environment.py'))).load_module()
door_assets=SourceFileLoader('hal_door_assets',str(Path(__file__).with_name('build-hal-door-assets.py'))).load_module()
SITES=[
 dict(name='Rob Miles',door=876,prisoner=[-144,-64],exit=[-384,-64],bounds=[-240,-128,-64,64]),
 dict(name='Dan Hendrycks',door=878,prisoner=[-1552,144],exit=[-1376,-144],bounds=[-1792,0,-1280,448]),
 dict(name='Nate Soares',door=879,prisoner=[-1312,-2656],exit=[-1216,-2400],bounds=[-1376,-2720,-1248,-2592]),
 dict(name='Roman Yampolskiy',door=880,prisoner=[1504,-2304],exit=[1216,-2016],bounds=[1144,-2368,1664,-2112]),
 dict(name='Beth Barnes',door=881,prisoner=[672,-1408],exit=[352,-1408],bounds=[416,-1472,928,-1344])]
CAMERAS=[(-304,-160,90),(-1408,16,90),(-1024,304,180),(352,-640,270),(1264,-448,180),(-1216,-2480,0),(1408,-2480,45),(320,-1360,0),(1056,-1632,180)]

def route_cells(nav,start,goal):
 """Navigation cells along the shortest human path from start to goal, in walking order."""
 import heapq
 width,step,(x0,y0),links=nav['width'],nav['step'],nav['origin'],nav['human_links']
 node=lambda x,y:int((y-y0)//step)*width+int((x-x0)//step)
 a,b=node(*start),node(*goal);dist={a:0};prev={};queue=[(0,a)]
 while queue:
  cost,u=heapq.heappop(queue)
  if u==b:break
  if cost>dist[u]:continue
  for k,(dx,dy) in enumerate([(1,0),(-1,0),(0,1),(0,-1)]):
   v=u+dy*width+dx
   if links[u]>>k&1 and cost+1<dist.get(v,1e9):dist[v]=cost+1;prev[v]=u;heapq.heappush(queue,(cost+1,v))
 assert b in dist,'No human route from the Faraday Room to the exit'
 cells=[b]
 while cells[-1]!=a:cells.append(prev[cells[-1]])
 return cells[::-1]

def exit_route(m,nav,cells):
 """Sector indices the walking path crosses."""
 width,step,(x0,y0)=nav['width'],nav['step'],nav['origin']
 polys=polygon_data(m);sectors=set()
 for u in cells:
  s=sector_at(polys,x0+(u%width+.5)*step,y0+(u//width+.5)*step)
  if s>=0:sectors.add(s)
 return sorted(sectors)

def exit_lights(nav,cells,spacing=64):
 """(x, y, heading) every `spacing` units along the walking path, pulled straight wherever
 a direct line stays on walkable, linked cells, so the floor lights run like a path."""
 import math
 width,step,(x0,y0),links=nav['width'],nav['step'],nav['origin'],nav['human_links']
 centre=lambda u:(x0+(u%width+.5)*step,y0+(u//width+.5)*step)
 cell=lambda x,y:int((y-y0)//step)*width+int((x-x0)//step)
 def linked(u,v):
  return any(u+dy*width+dx==v and links[u]>>k&1 for k,(dx,dy) in enumerate([(1,0),(-1,0),(0,1),(0,-1)]))
 def clear(a,b):
  (ax,ay),(bx,by)=centre(a),centre(b);n=max(1,int(math.hypot(bx-ax,by-ay)/4));u=a
  for i in range(1,n+1):
   v=cell(ax+(bx-ax)*i/n,ay+(by-ay)*i/n)
   if v==u:continue
   if not linked(u,v):
    # A diagonal step counts only if both corners around it are walkable.
    dx,dy=v%width-u%width,v//width-u//width
    if abs(dx)!=1 or abs(dy)!=1:return False
    h,w=u+dx,u+dy*width
    if not(linked(u,h) and linked(h,v) and linked(u,w) and linked(w,v)):return False
   u=v
  return True
 corners=[0];i=0
 while i<len(cells)-1:
  j=i+1
  while j+1<len(cells) and clear(cells[i],cells[j+1]):j+=1
  corners.append(j);i=j
 path=[centre(cells[k]) for k in corners];out=[];carry=spacing/2
 for (ax,ay),(bx,by) in zip(path,path[1:]):
  length=math.hypot(bx-ax,by-ay);d=carry;heading=math.degrees(math.atan2(by-ay,bx-ax))%360
  while d<length:out.append((round(ax+(bx-ax)*d/length,1),round(ay+(by-ay)*d/length,1),round(heading,1)));d+=spacing
  carry=d-length
 return out

def build_hal(root,block,make_wad):
 original,raw=read_map(root/'doom-web/local/DOOM.WAD','E1M7');m=copy.deepcopy(original)
 # Keep lamps, barrels and environmental decoration; replace every combat item.
 m['things']=[t for t in m['things'] if t['type'] in [2028,2035,54,55,56,57,48]]
 for sec in m['sectors']:
  if sec['special']==9:sec['special']=0
 for l in m['lines']:
  if l['special'] in [11,51,52,124]:l['special']=0
  l['special']={26:1,27:1,28:1,32:31,33:31,34:31}.get(l['special'],l['special'])
 def actor(x,y,typ,site=0,height=0,angle=0,arg1=0):
  m['things'].append(dict(x=x,y=y,type=typ,arg0=site,arg1=arg1,height=height,angle=int(round(angle))%360,arg4=round((angle-round(angle))*10000),skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True))
 def sector(f,c,tag=0,flat='FLAT5_4',light=144):
  n=len(m['sectors']);m['sectors'].append(dict(heightfloor=f,heightceiling=c,texturefloor=flat,textureceiling='CEIL3_5',lightlevel=light,special=0,id=tag));return n
 def edge(a,b,f,bk=-1,texture='SHAWN2'):
  ids=[]
  for x,y in [a,b]:
   v=dict(x=x,y=y);i=next((i for i,p in enumerate(m['vertices']) if p==v),None)
   if i is None:i=len(m['vertices']);m['vertices'].append(v)
   ids.append(i)
  l=copy.deepcopy(m['lines'][0]);l.update(v1=ids[0],v2=ids[1],sidefront=len(m['sides']),sideback=-1,blocking=bk<0,twosided=bk>=0,special=0,id=0,arg0=0)
  m['sides'].append(dict(offsetx=0,offsety=0,texturemiddle='-' if bk>=0 else texture,texturetop=texture,texturebottom=texture,sector=f))
  if bk>=0:l['sideback']=len(m['sides']);m['sides'].append(dict(offsetx=0,offsety=0,texturemiddle='-',texturetop=texture,texturebottom=texture,sector=bk))
  m['lines'].append(l)
 # HAL's main breaker sits in a shallow niche behind a steel shutter (883) at the back
 # of the Faraday Room's north alcove (2026-10-14; the bolted cover and duct are gone).
 # The shutter opens only once HAL has locked everyone in (PDHalReboot.Reveal).
 gate=sector(0,0,883,light=255);niche=sector(0,72,light=255)
 cut_wall(m,336,[(160,224,gate)],'DOOR3')
 for line in m['lines']:
  if line['sideback']>=0 and {m['sides'][line[k]]['sector'] for k in ['sidefront','sideback']}=={61,gate}:
   line['dontpegtop']=False # the door face rides up with the shutter
   for k in ['sidefront','sideback']:m['sides'][line[k]]['offsety']=0
 edge((160,608),(160,624),gate,texture='DOORTRAK');edge((160,624),(224,624),gate,niche);edge((224,624),(224,608),gate,texture='DOORTRAK')
 # 16 deep, so the breaker's box stays clear of the shutter: a moving door re-seats
 # anything overlapping it, and dropped the breaker to the floor below the wrench's swing.
 edge((160,624),(160,640),niche);edge((160,640),(224,640),niche);edge((224,640),(224,624),niche)
 # One civilian lounge off the north wall of the eastern approach corridor.
 # Raised sill and blocking glass isolate it from every player/escort route.
 window=sector(8,68,flat='FLAT5_4',light=176)
 lounge=sector(0,128,flat='FLOOR4_8',light=192)
 cut_wall(m,51,[(448,592,window)],'STARG3')
 edge((448,288),(448,296),window,texture='STARG3')
 edge((448,296),(592,296),window,lounge,'STARG3')
 edge((592,296),(592,288),window,texture='STARG3')
 edge((448,296),(448,464),lounge,texture='STARG3')
 edge((448,464),(672,464),lounge,texture='STARG3')
 edge((672,464),(672,296),lounge,texture='STARG3')
 edge((672,296),(592,296),lounge,texture='STARG3')
 for line in m['lines']:
  if line['sideback']>=0 and {m['sides'][line[k]]['sector'] for k in ['sidefront','sideback']}=={13,window}:
   line.update(blocking=True,blockmonsters=True,blockhitscan=True,dontpegbottom=True)
   m['sides'][line['sidefront']]['texturemiddle']='PDGLASS'
   m['sides'][line['sideback']]['texturemiddle']='PDGLASS'
 actor(560,368,15145,angle=270)
 # Tag existing rescue doors, cell lights and refuge. Disable their old switches.
 for sec,tag in [(65,876),(104,880),(95,881),(96,889),(62,882),(140,879),(101,887)]:m['sectors'][sec]['id']=tag
 for i,sec in enumerate([64,73,140,100,94]):m['sectors'][sec]['id']=900+i if i!=2 else 879
 for l in m['lines']:
  if l['sideback']>=0:
   secs={m['sides'][l[k]]['sector'] for k in ['sidefront','sideback']}
   if secs.intersection([65,104,95,96,62]):l['special']=0
 # The door from the evaluation board's hall into Beth's vestibule (sector 164, where a
 # camera must see you with the board) was an original one-way secret door in the same
 # STARG3 as the wall, so it never read as a door. It is now an open doorway
 # (2026-10-14). Until 2026-10-13 it also shared Rob's cell tag 876 and stranded anyone
 # freed before Rob; its old walk trigger (line 286) stays removed.
 m['sectors'][164].update(heightceiling=72,textureceiling='CEIL3_5',id=0)
 for i in [720,723]:m['sides'][m['lines'][i]['sidefront']]['texturemiddle']='STARG3'
 for i in [718,724,286]:m['lines'][i]['special']=0;m['lines'][i]['id']=0;m['lines'][i]['arg0']=0
 # Give Beth's front interlock a visible metal door rather than an apparent
 # continuation of the corridor wall. Its controller starts shut on approach.
 for i in [937,938]:m['sides'][m['lines'][i]['sidefront']]['texturetop']='BIGDOOR2'
 # The raised server lift remains functional. Its stable stop and stairs avoid
 # relying on a timed lift for escort navigation in this port.
 # Lower the western server wing by 120u, preserving its relative lift/room step.
 for sec in [70,73]:m['sectors'][sec]['heightfloor']=32
 for sec in [75]:m['sectors'][sec]['heightfloor']=56;m['sectors'][sec]['heightceiling']=184
 # The curved stairs' former secret lift could close above its recessed side
 # pocket. Make this ordinary circulation a permanent landing instead: 16u
 # from the pocket, level with the neighbouring stair, with standing headroom.
 m['sectors'][134]['heightfloor']=16
 m['sectors'][134]['heightceiling']=112
 m['sectors'][135]['heightfloor']=32
 m['sectors'][135]['id']=0
 for i in [535,758]:m['lines'][i]['special']=0;m['lines'][i]['id']=0;m['lines'][i]['arg0']=0
 # A 24-unit low step out of the lagoon occupies an unused strip of its edge.
 # Sector74 remains damaging; the original walkway is still 32u above it.
 # Split its west walkway boundary with two shallow stair sectors.
 # Two genuine 16u treads climb from -24 nukage to the32u walkway.
 step1=sector(-8,248,flat='STEP1');step2=sector(16,248,flat='STEP1')
 old=copy.deepcopy(m['lines'][884]);va,vb=[m['vertices'][old[k]] for k in ['v1','v2']]
 values=sorted([va['y'],224,320,vb['y']],reverse=va['y']>vb['y']);pieces=[]
 for a,b in zip(values,values[1:]):
  ids=[]
  for y in [a,b]:
   v=dict(x=-1040,y=y);n=next((n for n,p in enumerate(m['vertices']) if p==v),None)
   if n is None:n=len(m['vertices']);m['vertices'].append(v)
   ids.append(n)
  l=copy.deepcopy(old);l.update(v1=ids[0],v2=ids[1])
  for side in ['sidefront','sideback']:
   sd=copy.deepcopy(m['sides'][old[side]])
   if min(a,b)==224 and max(a,b)==320 and sd['sector']==74:sd['sector']=step2
   l[side]=len(m['sides']);m['sides'].append(sd)
  pieces.append(l)
 m['lines'][884]=pieces[0];m['lines'].extend(pieces[1:])
 edge((-1104,224),(-1104,320),step1,74,'STEP1');edge((-1104,320),(-1072,320),step1,74,'STEP1')
 edge((-1072,320),(-1072,224),step1,step2,'STEP1');edge((-1072,224),(-1104,224),step1,74,'STEP1')
 edge((-1072,320),(-1040,320),step2,74,'STEP1');edge((-1040,224),(-1072,224),step2,74,'STEP1')
 # A physical rubble staircase at the marked south window, raised by the charge.
 rubble1=sector(0,248,8881,flat='RROCK20');rubble2=sector(0,248,8882,flat='RROCK20')
 old=copy.deepcopy(m['lines'][792]);pieces=[]
 for a,b in zip([1408,1488,1520],[1488,1520,1600]):
  ids=[]
  for x in [a,b]:
   v=dict(x=x,y=-2384);n=next((n for n,p in enumerate(m['vertices'])if p==v),None)
   if n is None:n=len(m['vertices']);m['vertices'].append(v)
   ids.append(n)
  l=copy.deepcopy(old);l.update(v1=ids[0],v2=ids[1])
  for side in ['sidefront','sideback']:
   sd=copy.deepcopy(m['sides'][old[side]])
   if a==1488 and sd['sector']==98:sd['sector']=rubble2
   l[side]=len(m['sides']);m['sides'].append(sd)
  pieces.append(l)
 m['lines'][792]=pieces[0];m['lines'].extend(pieces[1:])
 edge((1488,-2448),(1488,-2416),rubble1,98,'RROCK20');edge((1488,-2416),(1520,-2416),rubble1,rubble2,'RROCK20')
 edge((1520,-2416),(1520,-2448),rubble1,98,'RROCK20');edge((1520,-2448),(1488,-2448),rubble1,98,'RROCK20')
 edge((1488,-2416),(1488,-2384),rubble2,98,'RROCK20');edge((1520,-2384),(1520,-2416),rubble2,98,'RROCK20')
 polys=polygon_data(m)
 # Pedestal starts at240; lowering it to112 makes the surrounding floor its landing.
 m['sectors'][140]['heightfloor']=240
 m['sectors'][141]['heightfloor']=112
 m['sectors'][142]['heightfloor']=112
 # Repeatable original pod-bay switch becomes our timed alternative.
 m['lines'][762]['special']=0
 actor(0,-246,1,angle=90);actor(60,-300,15102);actor(224,448,15102)
 actor(1152,-1856,15106,angle=180)
 for i,s in enumerate(SITES):
  actor(*s['prisoner'],15100,i,angle=270);actor(*s['prisoner'],15123,i)
 for x,y,a in CAMERAS:actor(x,y,15101,height=38,angle=a)
 actor(746,-120,15103)
 # One way out of each cell (2026-10-11): no charge, breach plate, MAIM rack,
 # frost window, pod-bay cycle switch, power-lever bank or Rob balcony release.
 # The Faraday Room's way out is HAL's main breaker, in its niche behind the shutter.
 actor(192,639.5,15122,-1,20,angle=270,arg1=24);actor(192,340,15116,height=16,angle=90)
 actor(272,432,15116,height=16,angle=180) # Inside override, as in E1M4.
 actor(-32,-246,15131,height=16,angle=0) # Hub return at the actual entrance.
 # Two physical buttons share a fixed dispenser beside Rob's door. The harmless
 # bot takes filled cups north to a static discarded mound, then returns.
 actor(-369,-156,15127,0,8,angle=165);actor(-464,-16,15128)
 actor(-448,-256,15124,angle=90)
 # Examination terminal in the NW server wing.
 actor(-1488,128,15122,1,12,arg1=22)
 actor(-1440,-2560,15122,2,16,arg1=29)
 for i,(x,y) in enumerate([(-1424,-2528),(-944,-2528)]):actor(x,y,15122,2,16,arg1=40+i)
 # Jailbreak console.
 actor(1216,-2080,15122,3,16,arg1=26)
 # Portable evaluation board in the approach hall, outside the surveillance room.
 actor(352,-1232,15130,4,0,angle=180,arg1=28)
 # Fixed evaluation protocol plaque beside the portable board, on the actual
 # north wall. Native wall sprite faces south, with half-unit depth clearance.
 actor(272,-1152.5,15156,4,16,angle=270)
 # Memory modules are a second, optional way to pacify the guardian.
 for i,(x,y) in enumerate([(32,-736),(-1488,64),(-1184,-2320),(1248,-2048)]):actor(x,y,15122,0,16,arg1=50+i)
 for x,y in [(256,-80),(-1200,-64),(-944,272),(1184,-512),(1024,-1824),(-672,-2464)]:actor(x,y,2011)
 for x,y in [(64,448),(128,448),(320,448)]:actor(x,y,2012)
 # Pickups and prisoners must be in real sectors, never in the original void.
 # Wall-mounted hardware intentionally lives on boundaries and is checked in play.
 for t in m['things']:
  if t['type'] in [15100,15102,15103,15110,15124,15128,2011,2012]:
   assert sector_at(polys,t['x'],t['y'])>=0, f"HAL actor {t['type']} is outside the map at {(t['x'],t['y'])}"
 # Each open room gets a lighting tag; powered doors retain their own tags.
 for i,sec in enumerate(m['sectors']):
  if not sec['id'] and sec['heightceiling']>sec['heightfloor']:sec['id']=2000+i
 # The original exit door (sector 114, EXITDOOR texture) beyond Roman's pod bay
 # is no corridor door: no panels, no use special. Only HAL's reboot opens it.
 m['sectors'][114]['id']=890
 for i in [817,818]:m['lines'][i]['special']=0;m['lines'][i]['id']=0;m['lines'][i]['arg0']=0
 # Ordinary doors get explicit navigation tags; native collision is authoritative.
 doors={}
 for i,sec in enumerate(m['sectors']):
  if sec['heightceiling']<=sec['heightfloor'] and i not in [140]:
   if not sec['id']:sec['id']=1100+i
   doors[i]=sec['id']
 # Door panels replace inherited DR switches so HAL's lock is a real rule.
 ordinary=[];panel_layout=[];wall_mounts=[]
 camera_mounts=wall_hardware.cameras(m,polys,sector_at)
 for t in m['things']:
  k=t.get('arg1',0)
  if t['type'] in [15116,15131] or t['type']==15122 and (k in [22,23,26,27,29,40,41] or 30<=k<=34):
   width=16 if 30<=k<=34 else 24 if k==23 else 48 if k in [40,41] else 32 if t['type']==15116 else 32 if k in [26,29] else 64
   wall_mounts.append(wall_hardware.mount(m,polys,sector_at,t,width,reach=160,line_id=684 if 30<=k<=34 else 364 if k==23 else None))
 for index,tag in doors.items():
  if tag<1100 or tag>=2000:continue
  pts=[m['vertices'][l[k]] for l in m['lines'] for k in ['v1','v2'] if any(l[z]>=0 and m['sides'][l[z]]['sector']==index for z in ['sidefront','sideback'])]
  if not pts:continue
  x=sum(v['x'] for v in pts)/len(pts);y=sum(v['y'] for v in pts)/len(pts)
  panels=door_layout.controls(m,polys,index,(x,y))
  ordinary.append((tag,x,y));door_id=len(ordinary)-1
  for p in panels:
   actor(p['x'],p['y'],15129,-1,24,angle=p['angle'],arg1=door_id)
   p['door']=door_id;p['tag']=tag;panel_layout.append(p)
  for l in m['lines']:
   if any(l[z]>=0 and m['sides'][l[z]]['sector']==index for z in ['sidefront','sideback']):l['special']=0
 dressing=environment.dress(m,polys,sector_at,hal=True)
 dressing['civilian']=dict(name='Chess against itself',x=560,y=368,angle=270,sector=lounge,window_sector=window,view=[560,216,90])
 # Paint only prisoner interlock faces with a red containment UI badge.
 cell_textures={}
 for line in m['lines']:
  if line['sideback']<0:continue
  pair=[m['sides'][line[k]] for k in ['sidefront','sideback']]
  for side,opposite in [(pair[0],pair[1]),(pair[1],pair[0])]:
   if m['sectors'][opposite['sector']]['id'] not in [876,880,881,889]:continue
   texture=side['texturetop']
   if texture=='-':continue
   if texture not in cell_textures:cell_textures[texture]='PDCL'+str(len(cell_textures))
   side['texturetop']=cell_textures[texture]
 door_assets.build(root,cell_textures);sign_assets.build(root)
 # Keep the server-wing and Nate approach lifts; the curved stair landing is fixed.
 lift_ids=[]
 for i in [70,125]:
  old_tag=m['sectors'][i]['id'];m['sectors'][i]['id']=1000+i;doors[i]=1000+i;lift_ids.extend([i,1000+i])
  for l in m['lines']:
   if old_tag and l['arg0']==old_tag and l['special']:l['arg0']=1000+i;l['id']=1000+i
 # Compact orphan sidedefs left by boundary splits; the port builds its side table from used edges.
 used=sorted({l[k] for l in m['lines'] for k in ['sidefront','sideback'] if l[k]>=0})
 remap={old:new for new,old in enumerate(used)}
 m['sides']=[m['sides'][i] for i in used]
 for l in m['lines']:
  for k in ['sidefront','sideback']:
   if l[k]>=0:l[k]=remap[l[k]]
 nav=navigation(m,doors,root/'doom-mod',class_name='PDHalMap',sites=SITES,grid=(32,-1824,-2880,130,116),refuge=(60,61,62,gate,niche),lifts=lift_ids)
 code=(root/'doom-mod/actors/PDHalMap.zs').read_text()
 methods='    static int DoorCount(){return '+str(len(ordinary))+';}\n    static int OrdinaryDoor(int i){\n'
 for i,(tag,x,y) in enumerate(ordinary):methods+=f'        if(i=={i})return {tag};\n'
 methods+='        return 0;\n    }\n    static Vector2 DoorPosition(int i){\n'
 for i,(tag,x,y) in enumerate(ordinary):methods+=f'        if(i=={i})return ({x},{y});\n'
 methods+='        return (0,0);\n    }\n'
 # HAL's reboot lights only the walk from the Faraday Room to the original exit:
 # the human navigation path, as the sectors it crosses.
 cells=route_cells(nav,(192,528),(1808,-2304));route=exit_route(m,nav,cells)
 methods+='    static bool ExitRoute(int sector){\n        switch(sector){'+''.join(f'case {s}:' for s in route)+'return true;}\n        return false;\n    }\n'
 # ...and floor chevrons along the same walk, which pulse in sequence toward the exit.
 lights=exit_lights(nav,cells)
 methods+=f'    static int ExitLights(){{return {len(lights)};}}\n    static Vector3 ExitLight(int i){{\n        switch(i){{'+''.join(f'case {i}:return ({x},{y},{a});' for i,(x,y,a) in enumerate(lights))+'}\n        return (0,0,0);\n    }\n'
 # The original E1M7 exit switch ends the level once everyone is in the exit room (PDHalReboot).
 button=[i for i,l in enumerate(m['lines']) if m['sides'][l['sidefront']]['texturemiddle']=='SW1COMP' and {m['vertices'][l[k]]['x'] for k in ['v1','v2']}=={1952}]
 assert len(button)==1,'The E1M7 exit switch is missing'
 methods+=f'    static int ExitButton(){{return {button[0]};}}\n'
 (root/'doom-mod/actors/PDHalMap.zs').write_text(code.rsplit('}',1)[0]+methods+'}\n')
 text='namespace = "ZDoomTranslated";\n'+'\n'.join(block(k,**v) for k,vs in [('vertex',m['vertices']),('sector',m['sectors']),('sidedef',m['sides']),('linedef',m['lines']),('thing',m['things'])] for v in vs)
 out=root/'output/hal';out.mkdir(exist_ok=True,parents=True)
 (out/'map-debug.json').write_text(json.dumps(dict(map='E1M7',environment=dressing,door_panels=panel_layout,wall_mounts=wall_mounts,camera_mounts=camera_mounts,cell_textures=cell_textures,sites=SITES,cameras=CAMERAS,sectors=m['sectors'],navigation=nav,spawn=[0,-246],refuge=[192,448],landmarks=dict(teabot=[-369,-156],tea_pile=[-464,-16],exam=[-1488,128],levers=[-872,-2100],thaw_override=[-1440,-2560],jailbreak=[1216,-2080],evaluation=[352,-1232],breaker=[192,640]),original_vertex_count=len(original['vertices']),original_vertices_preserved=m['vertices'][:len(original['vertices'])]==original['vertices']),indent=2)+'\n')
 (out/'E1M7-TEXTMAP.txt').write_text(text)
 return make_wad([('E1M7',b''),('TEXTMAP',text.encode()),('ENDMAP',b'')])
