"""Restrained map dressing. No new roaming robots in the hunter facility."""
import math
from importlib.machinery import SourceFileLoader
from pathlib import Path
hardware=SourceFileLoader('env_wall_hardware',str(Path(__file__).with_name('wall-hardware.py'))).load_module()

def thing(model,x,y,typ,arg0=0,height=0,angle=0,arg1=0):
    t=dict(x=x,y=y,type=typ,arg0=arg0,arg1=arg1,height=height,angle=int(round(angle))%360,arg4=round((angle-round(angle))*10000),skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True)
    model['things'].append(t);return t

def dress(model,polys,sector_at,hal=False):
    # Origins are on the intended side of a real wall. Wall mounting is shared
    # with the rescue hardware, including fractional surface normals.
    positions=[(1,1696,896),(2,1040,830),(3,1600,1200),(4,-1300,1830),(5,-1260,900)] if not hal else [(6,640,-240),(7,800,-1150),(8,-1740,128),(9,-1500,250),(10,1240,-2020)]
    record=dict(posters=[],terminals=[],lights=[],steam=[])
    occupied=[t for t in model['things'] if t['type'] in [15101,15104,15105,15108,15111,15113,15116,15117,15122,15127,15129,15131,48,54,55,56,57,2028]]
    for number,x,y in positions:
        t=thing(model,x,y,15140,number,height=16)
        # Look for a full-height, unoccupied stretch rather than gluing a
        # poster over a puzzle switch, low door frame or camera.
        candidates=[]
        for dx,dy in [(0,0),(-72,0),(72,0),(0,-72),(0,72),(-144,0),(144,0),(0,-144),(0,144)]:
            candidate=dict(t,x=x+dx,y=y+dy)
            if sector_at(polys,candidate['x'],candidate['y'])<0:continue
            try:r=hardware.mount(model,polys,sector_at,candidate,64,reach=224,max_step=128)
            except ValueError:continue
            if model['sectors'][r['sector']]['heightceiling']-r['floor']<112:continue
            if any(math.hypot(candidate['x']-q['x'],candidate['y']-q['y'])<65 for q in occupied):continue
            candidates.append((math.hypot(candidate['x']-x,candidate['y']-y),candidate,r))
        if not candidates:raise ValueError(f'No clear poster surface {number}')
        _,candidate,r=min(candidates,key=lambda c:c[0]);t.update(candidate);occupied.append(t)
        record['posters'].append(dict(r,number=number,x=t['x'],y=t['y'],height=16,angle=r['angle']))
    monitor_points=[(1736,1160),(-1190,1510)] if not hal else [(746,-120),(-1600,272)]
    for x,y in monitor_points:
        t=thing(model,x,y,15141,height=24)
        r=hardware.mount(model,polys,sector_at,t,32,reach=200,max_step=128)
        record['terminals'].append(r)
    # Non-rescue rooms only: never interfere with cell lights, refuge markers,
    # puzzle brownouts, lift sectors or special damaging/secret sectors.
    light_points=[(1760,1170),(-1260,900)] if not hal else [(746,-120),(-448,-640)]
    for x,y in light_points:
        sec=sector_at(polys,x,y);s=model['sectors'][sec]
        assert sec>=0 and s['heightceiling']-s['heightfloor']>=56
        tag=s['id'];assert tag not in range(876,910) and s['special']==0
        if not tag:tag=5000+sec;s['id']=tag
        t=thing(model,x,y,15144,arg1=tag)
        record['lights'].append(dict(x=x,y=y,sector=sec,tag=tag,baseline=s['lightlevel']))
    steam_points=[(1680,1184),(-1224,928)] if not hal else [(800,-160),(-448,-672)]
    for x,y in steam_points:
        sec=sector_at(polys,x,y);assert sec>=0
        thing(model,x,y,15142);thing(model,x,y,15143,height=1)
        record['steam'].append(dict(x=x,y=y,sector=sec,floor=model['sectors'][sec]['heightfloor']))
    return record
