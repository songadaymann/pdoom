"""Historical E1M2 war zone: thin opening, stocked robot rooms, endless wave pads.

The rescue maps are untouched. Original architecture stays, with brighter warm
alert lighting, closed-door squad reveals and a broad clearance-checked spawn grid.
"""
import copy
import json
from build_checkpoint_map import read_map, polygon_data, sector_at

MONSTERS = {9, 3001, 3002, 3003, 3004, 3005, 3006, 7, 16, 58}
# Room squads, dormant until one sees the player. Editor numbers (MAPINFO):
# 15200 Centurion trooper, 15201 Sentinel squid, 15203 ED-404 enforcer, 15204 Hunter-Killer gunship.
TROOPER, SQUID, ENFORCER, GUNSHIP = 15200, 15201, 15203, 15204
# Small squads along the way, dormant until one sees the player: a slow,
# manageable push through the plant. Enforcers are saved for the yard.
PACKS = [
    dict(id=1, name='assembly hall', sector=24, center=(-400,624), mix=[TROOPER]*3),
    dict(id=2, name='west offices', sector=84, center=(-1312,152), mix=[TROOPER]*2+[SQUID]),
    dict(id=3, name='west corridor', sector=83, center=(-992,-96), mix=[TROOPER]*2),
    dict(id=4, name='northern machine bay', sector=120, center=(-1536,1920), mix=[TROOPER]*3+[SQUID]*2),
    dict(id=5, name='southern reactor', sector=87, center=(64,-896), mix=[TROOPER]*3+[GUNSHIP]),
    dict(id=6, name='west yard', sector=170, center=(-2256,1096), mix=[TROOPER]*2+[SQUID]*2),
    dict(id=7, name='gun battery', sector=62, center=(1440,352), mix=[TROOPER]*4+[GUNSHIP]),
]
# The two doors from the main hall to the east wing stay jammed (scripted, tag
# 9001) until the player has fought through enough of the plant. Beyond them,
# the open-sky yard (sectors 2, 3 and the north stair landing) is the finale.
GATES, GATE_TAG = (26, 78), 9001
YARD = (2, 3, 17, 18)
# Collision of each type: (radius, height). The enforcer is a 100-unit machine.
SIZE = {TROOPER: (24, 64), SQUID: (24, 64), GUNSHIP: (32, 64), ENFORCER: (44, 112)}

def build_prologue(root, block, make_wad):
    original, _ = read_map(root / 'doom-web/local/DOOM.WAD', 'E1M2')
    model = copy.deepcopy(original)
    polys=polygon_data(model)
    things = []
    flags = dict(skill1=True, skill2=True, skill3=True, skill4=True, skill5=True,
                 single=True, coop=True, dm=True)
    for t in model['things']:
        # Only two active machines in the opening; later rooms own their squads.
        if t['type'] in MONSTERS or t['type'] in (2,3,4,10,11,12,15,18,19,20,21,22,23,24,2005):
            continue
        things.append(t)

    def clear(x,y,sector=None,r=24,h=64):
        d=round(r*.71)
        indices=[sector_at(polys,x+dx,y+dy) for dx,dy in [(0,0),(r,0),(-r,0),(0,r),(0,-r),(d,d),(-d,-d),(d,-d),(-d,d)]]
        if -1 in indices:return False
        if sector is not None and indices[0]!=sector:return False
        floors=[model['sectors'][s]['heightfloor'] for s in indices]
        return max(floors)-min(floors)<=8 and all(model['sectors'][s]['heightceiling']-model['sectors'][s]['heightfloor']>=h for s in indices)

    # Grid pads also cover the starting room and narrow approaches: the spawner
    # can surround a camper, rather than repeatedly choosing 41 distant closets.
    pads=[]
    for y in range(-1104,2496,96):
        for x in range(-2160,1872,96):
            if clear(x,y):
                pads.append((x,y))
                things.append(dict(x=x,y=y,angle=0,type=15202,**flags))

    squads=[]
    occupied=[]
    for pack in PACKS:
        bounds=polys[pack['sector']][1]
        placed=[]
        # Biggest machines first, nearest the room's centre; everyone 56+ units apart.
        for kind in sorted(pack['mix'],key=lambda k:-SIZE[k][0]):
            r,h=SIZE[kind]
            candidates=[(x,y) for y in range(bounds[1]+40,bounds[3]-32,32) for x in range(bounds[0]+40,bounds[2]-32,32) if clear(x,y,pack['sector'],r,h)]
            candidates.sort(key=lambda p:(p[0]-pack['center'][0])**2+(p[1]-pack['center'][1])**2)
            spot=next(((x,y) for x,y in candidates if all((x-a)**2+(y-b)**2>=(r+ra+16)**2 for a,b,ra in occupied)),None)
            if spot is None:raise ValueError(f"Insufficient space for {kind} in {pack['name']}")
            x,y=spot
            things.append(dict(x=x,y=y,angle=270,type=kind,ambush=True,arg0=pack['id'],**flags))
            placed.append([x,y,kind]);occupied.append((x,y,r))
        squads.append({**pack,'count':len(placed),'positions':placed})
        # Let a cleared room feel like a win and give ammunition to keep fighting.
        x,y,_=placed[-1]
        things.append(dict(x=x,y=y,angle=0,type=2049 if pack['id']%2 else 2048,**flags))

    things.extend([dict(x=-32,y=176,angle=0,type=2002,**flags),
                   dict(x=-64,y=176,angle=0,type=2049,**flags),
                   # The opening pair face away and are deaf (ambush): the player
                   # gets their bearings and the first shot.
                   dict(x=-160,y=64,angle=90,type=TROOPER,ambush=True,**flags),
                   dict(x=128,y=32,angle=90,type=TROOPER,ambush=True,**flags)])
    model['things'] = things
    # War lighting is deliberately warmer and more exposed than the rescue map.
    # Existing moving doors and sector machinery remain original native geometry.
    for sec in model['sectors']:
        if sec['heightceiling']-sec['heightfloor']>=64:
            sec['lightlevel']=max(176,sec['lightlevel'])
            sec['lightcolor']=0xffd4bc
    for pack in PACKS:
        sec=model['sectors'][pack['sector']]
        sec['lightlevel']=208;sec['lightcolor']=0xffa080
    for line in model['lines']:
        if line['special'] in (11, 51, 52, 124):line['special'] = 0
    for sec in GATES:
        assert not model['sectors'][sec].get('id'), sec
        model['sectors'][sec]['id']=GATE_TAG
    for line in model['lines']:
        if line.get('sideback',-1)>=0 and {model['sides'][line[k]]['sector'] for k in ('sidefront','sideback')}&set(GATES):
            line['special']=0
    # One marker inside each yard sector; the script learns the yard from them.
    for sec in YARD:
        b=polys[sec][1]
        spot=next(((x,y) for y in range(b[1]+8,b[3]-7,8) for x in range(b[0]+8,b[2]-7,8) if sector_at(polys,x,y)==sec),None)
        assert spot, sec
        things.append(dict(x=spot[0],y=spot[1],angle=0,type=15205,**flags))
    parts = ['namespace = "ZDoomTranslated";\n']
    for kind, entries in [('vertex',model['vertices']),('sector',model['sectors']),
                          ('sidedef',model['sides']),('linedef',model['lines']),('thing',things)]:
        parts.extend(block(kind, **entry) for entry in entries)
    out = root / 'output/prologue'
    out.mkdir(parents=True,exist_ok=True)
    (out/'map.json').write_text(json.dumps(dict(map='E1M2',source='E1M2',spawn=[-32,-240,90],
        weapon=[-32,176],pads=pads,squads=squads,initialRobots=2,gates=list(GATES),gate_tag=GATE_TAG,yard=list(YARD),
        roomRobots=sum(len(s['positions']) for s in squads)),indent=2))
    return make_wad([('E1M2',b''),('TEXTMAP','\n'.join(parts).encode()),('ENDMAP',b'')])
