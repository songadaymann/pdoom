import math
from terrain import HILLS, sm
# ---- proposed additions (design only; not yet in src/bliss.ts) ----
NEW_HILLS=[(-75,105,7,2600,2000),(85,150,6,3200,2400),(-205,25,10,2000,2500)]
ALL=HILLS+NEW_HILLS
def dist_apron(x,z,x0=-4,x1=38,z0=0,z1=34):
    # distance from the bunker's flat apron rectangle (0 inside it)
    return math.hypot(max(x0-x,0,x-x1),max(z0-z,0,z-z1))
def raw(x,z,hills=ALL):
    # PROPOSED continuous fade (GAME-SPEC rev 2, 04 §2.7). The current bliss.ts fade,
    # h*sm(0,14,-z) for z<0 and h*sm(34,60,z+max(0,|x-17|-21)*1.5) for z>=0, jumps at z=0
    # wherever |x-17| > ~61 (0.3-0.8 m today; 7.9 m at x -205 with the factory knoll).
    # This one is identical to today inside the first-arrival frame and continuous everywhere.
    d=dist_apron(x,z)
    if d<=0: return 0.0
    h=sum(a*math.exp(-((x-cx)**2/sx+(z-cz)**2/sz)) for cx,cz,a,sx,sz in hills)
    return h*sm(0,14,d)
# circular flat pads: cx,cz,r,blend  (pad height = raw height at centre)
PADS={'hal':(8,-206,28,24),'toy':(-160,6,30,14),'matrix':(148,95,24,12),'camp':(-14,-20,16,10),'crest':(-45,-94,12,8)}
PADY={k:raw(c[0],c[1]) for k,c in PADS.items()}
def gy(x,z):
    h=raw(x,z)
    for k,(cx,cz,r,b) in PADS.items():
        d=math.hypot(x-cx,z-cz); w=1-sm(r,r+b,d)
        h=h*(1-w)+PADY[k]*w
    return h
def az(dx,dz): # degrees clockwise from north (-z)
    return (math.degrees(math.atan2(dx,-dz))+360)%360
def dirv(a): r=math.radians(a); return (math.sin(r),-math.cos(r))
STRUCT={
 'L1':dict(name='CONTROL.EXE',episode='KNEE-DEEP IN THE DATA',guardian='THE INFERMINATOR',map='E1M4',c=(17,8),w=18,d=16,face=0,door=(17,0),spawn=(17,-3)),
 'L2':dict(name='HAL3000.SYS',episode='THE SHORES OF HAL',guardian='HAL3000',map='E1M7 Computer Station',c=(10,-208),w=36,d=22,face=223),
 'L3':dict(name='MEG3N.AVI',episode='INFERENCE',guardian='MEG3N',map='E2M7 Spawning Vats',c=(-162,8),w=40,d=26,face=65),
 'L4':dict(name='AGENTIC.BAT',episode='THY FLESH COMPUTED',guardian='AGENTIC SMITH',map='E2M2 Containment Area (south half)',c=(150,98),w=26,d=26,face=330),
}
for k,s in STRUCT.items():
    if 'door' not in s:
        dx,dz=dirv(s['face']);cx,cz=s['c'];s['door']=(round(cx+dx*s['d']/2,1),round(cz+dz*s['d']/2,1))
        s['spawn']=(round(s['door'][0]+dx*3,1),round(s['door'][1]+dz*3,1))
CAMP=(-14,-20); CREST=(-45,-92); JUNCTION=(-5,-95)
SUMMIT_SPUR=[JUNCTION,(-25,-94),CREST]
SKI=[(-12,-101),(-22,-115),(-14,-130),(-32,-144),(-24,-158),(-42,-170),(-38,-184)]
EYE=dict(x=10,z=-208,alt=70)
ROUTES={
 'R1 Taskbar Road (west)':[STRUCT['L3']['door'],(-128,-2),(-90,-6),(-50,-12),CAMP],
 'R2 Camp to bunker':[CAMP,(0,-12),(17,-3)],
 'R3 Taskbar Road (east)':[(17,-3),(45,-6),(75,8),(105,35),(128,62),STRUCT['L4']['door']],
 'R4 Crest Trail':[CAMP,(8,-30),(38,-48),(52,-72),(30,-90),(-5,-95),(5,-112),(25,-128),(28,-155),(15,-180),STRUCT['L2']['door']],
 'R5 Shoulder Pass':[(17,-3),(40,-30),(52,-72),(68,-100),(58,-135),(35,-170),STRUCT['L2']['door']],
 'R6 West Back Road':[STRUCT['L3']['door'],(-170,-40),(-178,-90),(-160,-140),(-115,-175),(-60,-195),STRUCT['L2']['door']],
 'R7 Server Trail':[STRUCT['L4']['door'],(172,50),(186,-20),(172,-95),(128,-150),(70,-182),STRUCT['L2']['door']],
}
def plen(pts,step=1.0):
    L=0;climb=0;top=-1e9
    for (x0,z0),(x1,z1) in zip(pts,pts[1:]):
        n=max(1,int(math.hypot(x1-x0,z1-z0)/step))
        for i in range(n):
            ax,az_=x0+(x1-x0)*i/n,z0+(z1-z0)*i/n;bx,bz=x0+(x1-x0)*(i+1)/n,z0+(z1-z0)*(i+1)/n
            ya,yb=gy(ax,az_),gy(bx,bz);L+=math.sqrt((bx-ax)**2+(bz-az_)**2+(yb-ya)**2);climb+=max(0,yb-ya);top=max(top,yb)
    return L,climb,top
