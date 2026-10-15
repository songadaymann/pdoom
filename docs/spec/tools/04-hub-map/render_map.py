import sys, math, io, base64
import os; HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from hub import STRUCT, ROUTES, CAMP, CREST, EYE, gy, plen, dirv, SKI, SUMMIT_SPUR, JUNCTION
from hubnp import gy_np

XMIN,XMAX,ZMIN,ZMAX=-262,252,-292,232
S=1.85
OX,OY=22,86            # map viewport origin inside the window
MW,MH=round((XMAX-XMIN)*S),round((ZMAX-ZMIN)*S)
PANEL_X=OX+MW+18; PANEL_W=470
W=PANEL_X+PANEL_W+16; H=OY+MH+44
def P(x,z): return (OX+(x-XMIN)*S, OY+(z-ZMIN)*S)
def f(v): return f"{v:.1f}"
PLAY=(-240,230,-262,200); CUR=(-180,200,-220,180)

# ---------------- terrain raster ----------------
xs=XMIN+(np.arange(MW)+.5)/S; zs=ZMIN+(np.arange(MH)+.5)/S
X,Z=np.meshgrid(xs,zs); Hh=gy_np(X,Z)
gz,gx=np.gradient(Hh,1/S,1/S)
nx,ny,nz=-gx,np.ones_like(Hh),-gz; nl=np.sqrt(nx**2+ny**2+nz**2); nx/=nl;ny/=nl;nz/=nl
L=np.array([-.55,.70,-.45]);L/=np.linalg.norm(L)        # light from the north-west (map convention)
shade=np.clip(nx*L[0]+ny*L[1]+nz*L[2],0,1)
t=np.clip(Hh/30,0,1)[...,None]
low=np.array([58,138,30]);mid=np.array([104,184,44]);high=np.array([176,226,96])
col=np.where(t<.5,low+(mid-low)*(t/.5),mid+(high-mid)*((t-.5)/.5))
# broad meadow patches like the game's patchAt()
rng=np.random.default_rng(7)
noise=np.zeros_like(Hh)
for k,amp in [(9,0.5),(23,0.3),(51,0.2)]:
    g=rng.random((k,k));im=Image.fromarray((g*255).astype(np.uint8)).resize((MW,MH),Image.BICUBIC)
    noise+=amp*np.asarray(im,float)/255
col=col*(0.93+0.12*noise[...,None])
col=col*(0.62+0.52*shade[...,None])
# outside proposed play area: hazy, like distance on the wallpaper
inside=(X>=PLAY[0])&(X<=PLAY[1])&(Z>=PLAY[2])&(Z<=PLAY[3])
haze=np.array([196,214,232])
col=np.where(inside[...,None],col,col*.45+haze*.55)
img=Image.fromarray(np.clip(col,0,255).astype(np.uint8))
buf=io.BytesIO();img.save(buf,'JPEG',quality=90);b64=base64.b64encode(buf.getvalue()).decode()

# ---------------- contours ----------------
fig=plt.figure();cs=plt.contour(xs,zs,Hh,levels=np.arange(2.5,31,2.5));plt.close(fig)
contours=[]
for lev,segs in zip(cs.levels,cs.allsegs):
    for seg in segs:
        if len(seg)<4: continue
        d='M'+' L'.join(f"{f(P(x,z)[0])},{f(P(x,z)[1])}" for x,z in seg[::2])
        major=abs(lev%10)<1e-6
        contours.append(f'<path d="{d}" class="{"cmaj" if major else "cmin"}"/>')

out=[]
A=out.append
A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Tahoma, Verdana, sans-serif">')
A('''<defs>
<linearGradient id="title" x1="0" x2="1"><stop offset="0" stop-color="#000080"/><stop offset="1" stop-color="#1084d0"/></linearGradient>
<radialGradient id="eyeglow"><stop offset="0" stop-color="#ff3b2f" stop-opacity=".95"/><stop offset=".35" stop-color="#ff2010" stop-opacity=".55"/><stop offset="1" stop-color="#ff0000" stop-opacity="0"/></radialGradient>
<radialGradient id="mon"><stop offset="0" stop-color="#3a6bd8"/><stop offset="1" stop-color="#0b1f63"/></radialGradient>
<pattern id="doom" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#6b5a45"/><path d="M0 3h6M3 0v3M0 0v0" stroke="#4a3d2f" stroke-width="1"/></pattern>
<pattern id="mines" width="5.55" height="5.55" patternUnits="userSpaceOnUse"><rect width="5.55" height="5.55" fill="#c0c0c0"/><path d="M0 0h5.55v.9H.9v4.65H0z" fill="#fff"/><path d="M5.55 0v5.55H0v-.9h4.65V0z" fill="#808080"/></pattern>
<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="1.5" stdDeviation="1.2" flood-opacity=".45"/></filter>
</defs>
<style>
.cmin{fill:none;stroke:#1d4d0e;stroke-opacity:.22;stroke-width:.8}
.cmaj{fill:none;stroke:#1d4d0e;stroke-opacity:.45;stroke-width:1.2}
.road{fill:none;stroke:#e9dca5;stroke-width:8;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.95}
.roadc{fill:none;stroke:#a88f4a;stroke-width:1.4;stroke-dasharray:7 5;stroke-linecap:round}
.trail{fill:none;stroke:#efe3b4;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.9}
.scenic{fill:none;stroke:#fff6d0;stroke-width:3;stroke-dasharray:2 6;stroke-linecap:round;stroke-opacity:.95}
.lab{font-size:12px;fill:#fff}
.small{font-size:10.5px}
.tip{fill:#ffffe1;stroke:#000;stroke-width:1}
.dist{font-size:10.5px;fill:#2b2b2b}
.ptext{font-size:12px;fill:#000}
.hd{font-size:12px;font-weight:bold;fill:#000}
</style>''')
# window chrome
A(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#c0c0c0"/>')
A(f'<path d="M0.5 {H-0.5}V0.5H{W-0.5}" fill="none" stroke="#fff" stroke-width="1"/><path d="M{W-0.5} 0.5V{H-0.5}H0.5" fill="none" stroke="#000" stroke-width="1"/>')
A(f'<path d="M1.5 {H-1.5}V1.5H{W-1.5}" fill="none" stroke="#dfdfdf"/><path d="M{W-1.5} 1.5V{H-1.5}H1.5" fill="none" stroke="#808080"/>')
A(f'<rect x="4" y="4" width="{W-8}" height="26" fill="url(#title)"/>')
# title icon: tiny monitor
A('<rect x="10" y="9" width="16" height="12" fill="#c0c0c0" stroke="#000"/><rect x="12" y="11" width="12" height="8" fill="#3a8a2a"/><path d="M12 19 Q18 12 24 17 V19Z" fill="#7cc84a"/>')
A(f'<text x="32" y="22" font-size="14" font-weight="bold" fill="#fff">HUB.MAP - SAFE MODE  (the p(DOOM) hub: proposed layout, top-down, north up)</text>')
for i,g in enumerate(['_','□','×']):
    bx=W-8-3*20+i*20
    A(f'<rect x="{bx}" y="8" width="18" height="17" fill="#c0c0c0"/><path d="M{bx+.5} {25-.5}V8.5H{bx+17.5}" fill="none" stroke="#fff"/><path d="M{bx+17.5} 8.5V{24.5}H{bx+.5}" fill="none" stroke="#000"/>')
    A(f'<text x="{bx+9}" y="{21 if g!="_" else 19}" font-size="{13 if g!="_" else 13}" font-weight="bold" text-anchor="middle" fill="#000">{g}</text>')
A('<text x="12" y="50" class="ptext"><tspan text-decoration="underline">F</tspan>ile   <tspan text-decoration="underline">E</tspan>dit   <tspan text-decoration="underline">V</tspan>iew   <tspan text-decoration="underline">G</tspan>o   <tspan text-decoration="underline">H</tspan>elp</text>')
A(f'<text x="{OX}" y="{OY-12}" class="ptext">Bliss meadow hub · metres · x east, z south · contours every 2.5 m (bold = 10 m) · bunker footprint x 8..26, z 0..16 is fixed</text>')
# map well (sunken)
A(f'<rect x="{OX-2}" y="{OY-2}" width="{MW+4}" height="{MH+4}" fill="#fff"/><path d="M{OX-2} {OY+MH+2}V{OY-2}H{OX+MW+2}" fill="none" stroke="#808080" stroke-width="2"/>')
A(f'<svg x="{OX}" y="{OY}" width="{MW}" height="{MH}" viewBox="{OX} {OY} {MW} {MH}" overflow="hidden">')
A(f'<image x="{OX}" y="{OY}" width="{MW}" height="{MH}" preserveAspectRatio="none" href="data:image/jpeg;base64,{b64}"/>')
A('<g>'+''.join(contours)+'</g>')
# grid every 50 m (faint)
for gx in range(-250,251,50):
    x,_=P(gx,0);A(f'<line x1="{f(x)}" y1="{OY}" x2="{f(x)}" y2="{OY+MH}" stroke="#ffffff" stroke-opacity=".10"/>')
for gz in range(-250,231,50):
    _,y=P(0,gz);A(f'<line x1="{OX}" y1="{f(y)}" x2="{OX+MW}" y2="{f(y)}" stroke="#ffffff" stroke-opacity=".10"/>')
# play areas
def rect(b,**kw):
    x0,y0=P(b[0],b[2]);x1,y1=P(b[1],b[3]);return x0,y0,x1-x0,y1-y0
x,y,w,h=rect(CUR);A(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 4"/>')
A(f'<text x="{f(x+4)}" y="{f(y+12)}" class="small" fill="#fff" fill-opacity=".85">current clamp</text>')
x,y,w,h=rect(PLAY)
A(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="4 3"/>')
A(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="none" stroke="#fff" stroke-width="1.3" stroke-dasharray="4 3" stroke-dashoffset="4"/>')
A(f'<text x="{f(x+96)}" y="{f(y+h-7)}" class="small" fill="#000">proposed play area: marching-ants selection rectangle boundary</text>')

# terrain names
def tlabel(x,z,txt,size=12,op=.9,anchor='middle',color='#0f3a06',italic=True,ls=0):
    px,py=P(x,z);it='font-style="italic"' if italic else '';A(f'<text x="{f(px)}" y="{f(py)}" font-size="{size}" text-anchor="{anchor}" fill="{color}" fill-opacity="{op}" letter-spacing="{ls}" {it}>{txt}</text>')
tlabel(-112,-104,'THE HILL',15,.75,ls=5)
tlabel(-112,-90,'30 m crest · Bliss dome',10.5,.75)
tlabel(150,-214,'second hill · 26 m',11,.75)
tlabel(-128,-224,'HIDDEN VALLEY',12,.7,ls=4)
tlabel(-30,190,'SOUTH MEADOW',13,.6,ls=5)
tlabel(-75,128,'Picnic Knoll (new, 7 m)',10.5,.75)
tlabel(85,176,'SE swell (new, 6 m)',10.5,.75)
tlabel(-215,58,'factory knoll (new)',10.5,.75)

# routes
names=list(ROUTES)
def pathd(pts): return 'M'+' L'.join(f"{f(P(x,z)[0])},{f(P(x,z)[1])}" for x,z in pts)
for n in names:
    pts=ROUTES[n]
    if n.startswith('R6') or n.startswith('R7'): A(f'<path d="{pathd(pts)}" class="scenic"/>')
for n in names:
    pts=ROUTES[n]
    if n.startswith(('R1','R2','R3')): A(f'<path d="{pathd(pts)}" class="road"/>')
    elif n.startswith(('R4','R5')): A(f'<path d="{pathd(pts)}" class="trail"/>')
for n in names:
    if n.startswith(('R1','R2','R3')): A(f'<path d="{pathd(ROUTES[n])}" class="roadc"/>')
A(f'<path d="{pathd(SUMMIT_SPUR)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="5 4"/>')
# SkiFree run (north face)
ski=SKI
A(f'<path d="{pathd(ski)}" fill="none" stroke="#3a6fd8" stroke-width="2" stroke-dasharray="5 3"/>')
for i,(sx,sz) in enumerate(ski[1:-1]):
    px,py=P(sx,sz);c='#d00' if i%2==0 else '#1f4fd0'
    A(f'<path d="M{f(px)} {f(py)} v-9 l6 2.5 -6 2.5" fill="{c}" stroke="#222" stroke-width=".6"/>')
# leg distance tags
def tag(x,z,txt,anchor='middle'):
    px,py=P(x,z);w=len(txt)*5.6+8
    A(f'<rect x="{f(px-w/2)}" y="{f(py-8)}" width="{f(w)}" height="14" class="tip" filter="url(#ds)"/><text x="{f(px)}" y="{f(py+3)}" text-anchor="middle" class="dist">{txt}</text>')
legs={}
for n in names:
    Ln,c,top=plen(ROUTES[n]);legs[n]=(Ln,c,top)
tag(-95,-17,f"{legs['R1 Taskbar Road (west)'][0]:.0f} m · {legs['R1 Taskbar Road (west)'][0]/3.6:.0f} s")
tag(97,10,f"{legs['R3 Taskbar Road (east)'][0]:.0f} m · {legs['R3 Taskbar Road (east)'][0]/3.6:.0f} s")
tag(52,-150,f"{legs['R4 Crest Trail'][0]:.0f} m · {legs['R4 Crest Trail'][0]/3.6:.0f} s")
tag(100,-118,f"{legs['R5 Shoulder Pass'][0]:.0f} m · {legs['R5 Shoulder Pass'][0]/3.6:.0f} s")
tag(-210,-128,f"{legs['R6 West Back Road'][0]:.0f} m · {legs['R6 West Back Road'][0]/3.6:.0f} s")
tag(207,-40,f"{legs['R7 Server Trail'][0]:.0f} m · {legs['R7 Server Trail'][0]/3.6:.0f} s")
tag(2,-1+30-30+0, '')if False else None

# first-arrival view cones (102 deg horizontal FOV at 16:9, 70 deg vertical)
for k,s in STRUCT.items():
    sx,sz=s['spawn'];a=s['face'];R=105
    pts=[(sx,sz)]
    for d in np.linspace(a-51,a+51,24):
        dx,dz=dirv(d);pts.append((sx+dx*R,sz+dz*R))
    A(f'<path d="{pathd(pts)} Z" fill="#ffffff" fill-opacity=".13" stroke="#ffffff" stroke-opacity=".6" stroke-width="1" stroke-dasharray="3 3"/>')
    dx,dz=dirv(a);px,py=P(sx+dx*R*.82,sz+dz*R*.82)

# minesweeper field
mx,mz=70,38;px,py=P(mx,mz);A(f'<rect x="{f(px)}" y="{f(py)}" width="{f(27*S)}" height="{f(27*S)}" fill="url(#mines)" stroke="#000" stroke-width="1"/>')
A(f'<text x="{f(px+27*S/2)}" y="{f(py+27*S/2+5)}" text-anchor="middle" font-size="14">🙂</text>' if False else f'<circle cx="{f(px+27*S/2)}" cy="{f(py+27*S/2)}" r="6" fill="#ff0" stroke="#000"/><circle cx="{f(px+27*S/2-2)}" cy="{f(py+27*S/2-1.5)}" r=".9"/><circle cx="{f(px+27*S/2+2)}" cy="{f(py+27*S/2-1.5)}" r=".9"/><path d="M{f(px+27*S/2-3)} {f(py+27*S/2+1.5)} q3 3 6 0" fill="none" stroke="#000" stroke-width=".9"/>')
# hover arena + pipes + defrag + press
def box(x0,z0,x1,z1,fill,op=.35,stroke='#000',dash='3 2'):
    a,b=P(x0,z0);c,d=P(x1,z1);A(f'<rect x="{f(a)}" y="{f(b)}" width="{f(c-a)}" height="{f(d-b)}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-dasharray="{dash}"/>')
box(-15,100,75,160,'#3050c0',.18)
# 3D pipes glyph
px,py=P(-95,45)
A(f'<g stroke-linecap="round" fill="none"><path d="M{f(px-14)} {f(py+8)} h10 v-14 h12 v8" stroke="#d02020" stroke-width="3.2"/><path d="M{f(px-8)} {f(py-10)} v12 h18" stroke="#2040d0" stroke-width="3.2"/><path d="M{f(px+4)} {f(py+12)} v-8 h-10" stroke="#e0c000" stroke-width="3.2"/></g>')
# (press pen removed: M7 merged into the M2 radio show, GAME-SPEC rev 2)
#box(34,40,54,52,'#ffffff',.35)
# defrag yard
px,py=P(48,-184)
for i in range(4):
    for j in range(5):
        c=['#0000a8','#a80000','#00a8a8','#ffffff'][(i*5+j*3)%4]
        A(f'<rect x="{f(px+j*5)}" y="{f(py+i*5)}" width="4.4" height="4.4" fill="{c}" stroke="#000" stroke-width=".4"/>')

# --- structures ---
def rot_rect(cx,cz,w,d,face,fill,stroke='#000'):
    fx,fz=dirv(face);rx,rz=dirv(face+90)
    cs=[(cx+fx*d/2+rx*w/2,cz+fz*d/2+rz*w/2),(cx+fx*d/2-rx*w/2,cz+fz*d/2-rz*w/2),(cx-fx*d/2-rx*w/2,cz-fz*d/2-rz*w/2),(cx-fx*d/2+rx*w/2,cz-fz*d/2+rz*w/2)]
    A(f'<path d="{pathd(cs)} Z" fill="{fill}" stroke="{stroke}" stroke-width="1.2" filter="url(#ds)"/>')
# L1 bunker (axis aligned)
a,b=P(8,0);c,d=P(26,16);A(f'<rect x="{f(a)}" y="{f(b)}" width="{f(c-a)}" height="{f(d-b)}" fill="url(#doom)" stroke="#000" stroke-width="1.2" filter="url(#ds)"/>')
px,py=P(23,3);A(f'<line x1="{f(px)}" y1="{f(py)}" x2="{f(px)}" y2="{f(py-12)}" stroke="#222" stroke-width="1.5"/><circle cx="{f(px)}" cy="{f(py-13)}" r="3" fill="#ff2a1a" stroke="#000" stroke-width=".7"/>')
rot_rect(10,-208,36,22,223,'url(#doom)')
rot_rect(-162,8,40,26,65,'#ffe066')
# candy stripes on toy factory roof
for i in range(-3,4):
    fx,fz=dirv(65);rx,rz=dirv(155)
    p0=(-162+rx*i*5-fx*11,8+rz*i*5-fz*11);p1=(-162+rx*i*5+fx*11,8+rz*i*5+fz*11)
    A(f'<path d="{pathd([p0,p1])}" stroke="{["#ff8fc8","#8fe9ff"][i%2]}" stroke-width="3.5"/>')
rot_rect(150,98,26,26,330,'#0b120b')
# wingdings rain glyphs on matrix roof
for i,(gx,gz) in enumerate([(-8,-6),(0,-8),(7,-3),(-5,3),(3,4),(9,7),(-9,8),(1,-1)]):
    px,py=P(150+gx,98+gz);A(f'<text x="{f(px)}" y="{f(py)}" font-size="9" fill="#39ff6a" text-anchor="middle" font-family="Courier New, monospace">{"☺✈☎✌✉☼♫✂"[i]}</text>')
# MEG3N ring-light tower: phone-screen face inside a ring light, cable pigtails
px,py=P(-180,24);A(f'<circle cx="{f(px)}" cy="{f(py)}" r="10" fill="none" stroke="#fffbe0" stroke-width="3.2"/><circle cx="{f(px)}" cy="{f(py)}" r="10" fill="none" stroke="#000" stroke-width=".6"/><rect x="{f(px-4.5)}" y="{f(py-6.5)}" width="9" height="13" rx="1.6" fill="#111" stroke="#000"/><circle cx="{f(px-1.7)}" cy="{f(py-1.5)}" r=".9" fill="#ffd400"/><circle cx="{f(px+1.7)}" cy="{f(py-1.5)}" r=".9" fill="#ffd400"/><path d="M{f(px-2)} {f(py+1.5)} q2 2 4 0" stroke="#ffd400" fill="none" stroke-width=".9"/><path d="M{f(px-10)} {f(py)} q-4 6 -1 11 M{f(px+10)} {f(py)} q4 6 1 11" stroke="#333" fill="none" stroke-width="1.2"/><circle cx="{f(px+7)}" cy="{f(py-8)}" r="3" fill="#e22" stroke="#fff" stroke-width=".7"/>')
# AGENTIC spinner on top of the tower
tx_,ty_=P(150,98)
for k_ in range(8):
    import math as _m2
    a_=k_*_m2.pi/4;A(f'<circle cx="{f(tx_+9*_m2.cos(a_))}" cy="{f(ty_+9*_m2.sin(a_))}" r="{f(.6+k_*.28)}" fill="#e8e4d4" fill-opacity="{.35+k_*.08:.2f}"/>')
# phone booth
px,py=P(137,79);A(f'<rect x="{f(px-3.5)}" y="{f(py-5)}" width="7" height="10" fill="#d42020" stroke="#000"/><path d="M{f(px-6)} {f(py-9)} q-3 -3 0 -6 M{f(px+6)} {f(py-9)} q3 -3 0 -6" stroke="#39ff6a" fill="none" stroke-width="1.2"/>')
# HAL eye (floating, 70 m up) with glow: pearl-white sphere, LED ring, iris red when locked on
ex,ey=P(EYE['x'],EYE['z']);A(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="34" fill="url(#eyeglow)"/><circle cx="{f(ex)}" cy="{f(ey)}" r="9.5" fill="#f4f1ea" stroke="#777" stroke-width="1"/>')
import math as _mm
for k_ in range(12):
    a_=k_*_mm.pi/6;A(f'<circle cx="{f(ex+6.6*_mm.cos(a_))}" cy="{f(ey+6.6*_mm.sin(a_))}" r=".9" fill="#38d9ff"/>')
A(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="4.4" fill="#ff2a1a" stroke="#400" stroke-width=".6"/><circle cx="{f(ex)}" cy="{f(ey)}" r="1.6" fill="#200"/>')
A(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="{f(15*S)}" fill="none" stroke="#ff4a3a" stroke-opacity=".7" stroke-dasharray="2 4"/>')
# doors
for k,s in STRUCT.items():
    dx,dz=s['door'];px,py=P(dx,dz);A(f'<circle cx="{f(px)}" cy="{f(py)}" r="3.4" fill="#fff" stroke="#000" stroke-width="1.2"/>')
# camp
cx,cz=CAMP;px,py=P(cx,cz)
A(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(16*S)}" fill="#f4e9c0" fill-opacity=".55" stroke="#7a6a30" stroke-dasharray="3 2"/>')
# recycle bin glyph
A(f'<path d="M{f(px-7)} {f(py-8)} h14 l-2 17 h-10z" fill="#e8e8e8" stroke="#000" stroke-width="1"/><path d="M{f(px-4)} {f(py-6)} l1 13 M{f(px)} {f(py-6)} v13 M{f(px+4)} {f(py-6)} l-1 13" stroke="#555" stroke-width=".8"/><rect x="{f(px-8.5)}" y="{f(py-10.5)}" width="17" height="3" fill="#cfcfcf" stroke="#000" stroke-width=".8"/><path d="M{f(px-5)} {f(py-10)} l3 -5 l4 4z" fill="#fff" stroke="#000" stroke-width=".6"/>')
# start monolith
px2,py2=P(-14,-44);A(f'<rect x="{f(px2-9)}" y="{f(py2-4)}" width="18" height="8" fill="#c0c0c0" stroke="#000"/><path d="M{f(px2-9)} {f(py2+4)}V{f(py2-4)}H{f(px2+9)}" stroke="#fff" fill="none"/><text x="{f(px2+1)}" y="{f(py2+3)}" font-size="6.5" font-weight="bold" text-anchor="middle">Start</text>')
# final door (GAME-SPEC): giant Display Properties dialog on the summit (Wait: n prisons) beside the SSMAZE.SCR hatch; CRT rises at 20/20; hourglass cursor above
px,py=P(-45,-92)
A(f'<g filter="url(#ds)"><rect x="{f(px-15)}" y="{f(py-11)}" width="30" height="21" fill="#c0c0c0" stroke="#000" stroke-width="1"/><path d="M{f(px-15)} {f(py+10)}V{f(py-11)}H{f(px+15)}" stroke="#fff" fill="none"/><rect x="{f(px-14)}" y="{f(py-10)}" width="28" height="4.5" fill="#000080"/></g>')
for k_ in range(10):
    A(f'<rect x="{f(px-12+k_*2.4)}" y="{f(py+3)}" width="2" height="3" fill="{"#000080" if k_<3 else "#fff"}" stroke="#808080" stroke-width=".3"/>')
A(f'<rect x="{f(px-11)}" y="{f(py-3.5)}" width="6" height="4.5" fill="#808080"/><rect x="{f(px-3)}" y="{f(py-3)}" width="13" height="1.2" fill="#555"/><rect x="{f(px-3)}" y="{f(py-.8)}" width="10" height="1.2" fill="#555"/>')
hx,hy=px,py-24
A(f'<g transform="translate({f(hx)},{f(hy)})" filter="url(#ds)"><path d="M-5 -8 H5 L0.8 0 L5 8 H-5 L-0.8 0Z" fill="#fff" stroke="#000" stroke-width="1"/><path d="M-3 6.5 H3 L0 2.5Z" fill="#c8a040"/></g>')
# giant cursor (sky)
gcx,gcy=P(-150,-62)
A(f'<g transform="translate({f(gcx)},{f(gcy)}) scale(1.6)" filter="url(#ds)"><path d="M0 0 V17 L4 13 L7 20 L10 19 L7 12 H12 Z" fill="#fff" stroke="#000" stroke-width="1"/></g>')
tfx,tfy=P(-160,0);A(f'<path d="M{f(gcx+4)} {f(gcy+32)} L{f(tfx)} {f(tfy-14)}" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="2 3"/>')

# vista markers
def vista(x,z,n):
    px,py=P(x,z);A(f'<g transform="translate({f(px)},{f(py)})"><path d="M-8 0 Q0 -7 8 0 Q0 7 -8 0Z" fill="#fff" stroke="#000" stroke-width=".9"/><circle r="2.6" fill="#1f4fd0"/><text x="9" y="-5" font-size="9.5" font-weight="bold" fill="#000" stroke="#fff" stroke-width="2.4" paint-order="stroke">{n}</text></g>')
vista(-66,-97,'V1');vista(66,-96,'V2');vista(161,108,'V3');vista(-186,30,'V4');vista(24,-10,'V5')

# minigame markers (tooltip-yellow squares)
MG=[('M1',83,51),('M2',-44,-10),('M3',38,-48),('M4',-48,-128),('M5',14,-28),('M6',-105,-150),('M8',212,-150),
    ('M9',-95,58),('M10',-42,-36),('M11',128,74),('M12',-6,-50),('M14',-76,-100),('M15',30,130),
    ('M16',-75,92),('M17',60,-192),('M19',152,74),('M22',16,-44)]
for n,x,z in MG:
    px,py=P(x,z);w=len(n)*6.4+6
    A(f'<rect x="{f(px-w/2)}" y="{f(py-7.5)}" width="{f(w)}" height="14" class="tip"/><text x="{f(px)}" y="{f(py+3.5)}" text-anchor="middle" font-size="10" font-weight="bold">{n}</text>')

# structure labels (desktop-icon style: white text on navy highlight)
def iconlabel(x,z,lines,dy=0):
    px,py=P(x,z);py+=dy
    for i,l in enumerate(lines):
        w=len(l)*6.5+8;y=py+i*15
        bg='#000080' if i==0 else '#0b2a8a'
        A(f'<rect x="{f(px-w/2)}" y="{f(y-11)}" width="{f(w)}" height="14" fill="{bg}" stroke="#fff" stroke-width=".6" stroke-dasharray="1 1"/><text x="{f(px)}" y="{f(y)}" text-anchor="middle" class="lab" font-size="{11.5 if i==0 else 10}">{l}</text>')
iconlabel(17,27,['CONTROL.EXE','Knee-Deep in the Data · E1M4'])
iconlabel(16,-236,['HAL3000.SYS','The Shores of HAL · E1M7'])
iconlabel(-160,42,['MEG3N.AVI','Inference · E2M7'])
iconlabel(150,124,['AGENTIC.BAT','Thy Flesh Computed · E2M2'])
iconlabel(-50,2,['Camp Recycle Bin (M13)'],dy=0)
lx,ly=P(-6,-82);cx2,cy2=P(-31,-88);A(f'<line x1="{f(lx)}" y1="{f(ly)}" x2="{f(cx2)}" y2="{f(cy2)}" stroke="#fff" stroke-width="1.2"/>')
iconlabel(30,-79,['SSMAZE.SCR (final door)','Display Properties · Wait: n prisons'],dy=0)
px,py=P(-150,-62);A(f'<text x="{f(px+22)}" y="{f(py+12)}" font-size="10.5" fill="#fff" stroke="#00000066" stroke-width="2" paint-order="stroke">giant cursor (sky, ~45 m)</text><text x="{f(px+22)}" y="{f(py+25)}" font-size="10.5" fill="#fff" stroke="#00000066" stroke-width="2" paint-order="stroke">home: hourglass over the door</text><text x="{f(px+22)}" y="{f(py+38)}" font-size="10.5" fill="#fff" stroke="#00000066" stroke-width="2" paint-order="stroke">flies out to hover over your next goal</text>')
tlabel(83,76,'Minesweeper Meadow',10,.95,'middle','#000',False)
tlabel(-15,96,'Hover! arena',10,.9,'start','#0a1a50',False)
tlabel(-82,72,'3D Pipes',10,.95,'start','#000',False)
tlabel(-95,-186,'SkiFree run',10,.95,'start','#0a2a80',False)
tlabel(40,-196,'Defrag yard',10,.95,'start','#000',False)

# off-map arrows
def offarrow(x,z,up,lines):
    px,py=P(x,z)
    if up: A(f'<path d="M{f(px)} {OY+6} l9 15 h-5 v12 h-8 v-12 h-5z" fill="#fff" stroke="#000"/>');ty=OY+12
    else: A(f'<path d="M{f(px)} {OY+MH-6} l9 -15 h-5 v-12 h-8 v12 h-5z" fill="#fff" stroke="#000"/>');ty=OY+MH-38
    w=max(len(l) for l in lines)*5.9+12
    A(f'<rect x="{f(px+14)}" y="{f(ty)}" width="{f(w)}" height="{13*len(lines)+8}" class="tip" filter="url(#ds)"/>')
    for i,l in enumerate(lines):
        A(f'<text x="{f(px+20)}" y="{f(ty+14+i*13)}" font-size="10.5" fill="#000">{l}</text>')
offarrow(-40,-292,True,['Both labs\' data centres on the north horizon','yours (~470 m) is the one that wakes'])
offarrow(60,232,False,['Musk Control Program (MCP) column, ~900 m south','its face loads like a progressive JPEG per level cleared'])
for (cx_,cy_,anc) in [(OX+8,OY+16,'start'),(OX+MW-8,OY+16,'end'),(OX+8,OY+MH-70,'start'),(OX+MW-8,OY+MH-46,'end')]:
    if (cx_,anc)==(OX+MW-8,'end') and cy_==OY+16: cy_=OY+16; cx_=OX+MW-60
    A(f'<text x="{cx_}" y="{cy_}" font-size="12" font-family="Courier New, monospace" text-anchor="{anc}" fill="#000">Safe mode</text>')
A('</svg>')

# scale bar + north cursor inside map (drawn after clip so always visible)
sx0,sy0=OX+14,OY+MH-30
A(f'<rect x="{sx0-6}" y="{sy0-20}" width="{100*S+80}" height="40" fill="#c0c0c0" stroke="#000"/>')
for i in range(4):
    A(f'<rect x="{f(sx0+i*25*S)}" y="{sy0}" width="{f(25*S)}" height="6" fill="{["#000","#fff"][i%2]}" stroke="#000" stroke-width=".8"/>')
for v in [0,50,100]:
    A(f'<text x="{f(sx0+v*S)}" y="{sy0-4}" font-size="10" text-anchor="middle">{v}</text>')
A(f'<text x="{f(sx0+100*S+6)}" y="{sy0+6}" font-size="10">m</text>')
A(f'<text x="{f(sx0)}" y="{sy0+16}" font-size="9.5">100 m ≈ 28 s walk · 17 s run</text>')
nx_,ny_=OX+MW-40,OY+20
A(f'<g transform="translate({nx_},{ny_}) scale(1.5)"><path d="M0 0 V17 L4 13 L7 20 L10 19 L7 12 H12 Z" fill="#fff" stroke="#000"/></g><text x="{nx_+6}" y="{ny_+46}" font-size="13" font-weight="bold" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">N</text>')

# ---------------- right panel ----------------
def group(x,y,w,h,title):
    A(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#808080"/><rect x="{x+1}" y="{y+1}" width="{w}" height="{h}" fill="none" stroke="#fff"/>')
    tw=len(title)*6.6+10;A(f'<rect x="{x+8}" y="{y-7}" width="{tw}" height="14" fill="#c0c0c0"/><text x="{x+13}" y="{y+4}" class="hd">{title}</text>')
px=PANEL_X;py=OY+6
group(px,py,PANEL_W-8,236,'Legend')
yy=py+24
def leg(sym,txt):
    global yy
    A(f'<g transform="translate({px+14},{yy-4})">{sym}</g><text x="{px+56}" y="{yy}" class="ptext" font-size="11.5">{txt}</text>');yy+=19
leg('<path d="M0 0 H32" stroke="#e9dca5" stroke-width="8" stroke-linecap="round"/><path d="M0 0 H32" stroke="#a88f4a" stroke-width="1.4" stroke-dasharray="7 5"/>','Taskbar Road: main worn path, bevelled grey kerbs')
leg('<path d="M0 0 H32" stroke="#efe3b4" stroke-width="5" stroke-linecap="round"/>','Trail over or around the hill')
leg('<rect x="-2" y="-6" width="36" height="12" fill="#5a9a32"/><path d="M0 0 H32" stroke="#fff6d0" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>','Scenic loop (optional, longer)')
leg('<rect x="0" y="-7" width="32" height="14" class="tip"/><text x="16" y="4" font-size="9" text-anchor="middle">M1</text>','Walking minigame site (see list)')
leg('<path d="M4 0 Q16 -7 28 0 Q16 7 4 0Z" fill="#fff" stroke="#000"/><circle cx="16" r="2.6" fill="#1f4fd0"/>','Vista point (V1 crest: whole hub)')
leg('<path d="M16 0 L-2 -9 A20 20 0 0 1 -2 9Z" transform="translate(4,0) rotate(180 16 0)" fill="#fff" fill-opacity=".5" stroke="#555" stroke-dasharray="2 2"/>','First-arrival view (102° FOV) from each exit')
leg('<circle cx="16" r="4" fill="#fff" stroke="#000" stroke-width="1.2"/>','Structure door (portal shows live Doom view)')
leg('<rect x="2" y="-6" width="28" height="12" fill="#000080"/><text x="16" y="3.5" font-size="7" fill="#fff" text-anchor="middle">.EXE</text>','Level structure label (icon-style)')
leg('<rect x="0" y="-6" width="32" height="12" fill="none" stroke="#000" stroke-dasharray="4 3"/>','Proposed boundary  (thin dashed = current)')
leg('<rect x="4" y="-7" width="24" height="15" fill="#c0c0c0" stroke="#000"/><rect x="5" y="-6" width="22" height="3.5" fill="#000080"/><rect x="7" y="3" width="18" height="2.5" fill="#fff" stroke="#808080" stroke-width=".4"/><rect x="7" y="3" width="6" height="2.5" fill="#000080"/>','Final door: Display Properties + hatch, CRT rises at 20/20')

py2=py+252
rows=[(n,)+legs[n] for n in names]
group(px,py2,PANEL_W-8,40+19*len(rows),'Legs  (walk 3.6 m/s · run 6 m/s)')
A(f'<text x="{px+14}" y="{py2+24}" class="ptext" font-size="11" font-weight="bold">Route</text><text x="{px+272}" y="{py2+24}" font-size="11" font-weight="bold" text-anchor="end">length</text><text x="{px+330}" y="{py2+24}" font-size="11" font-weight="bold" text-anchor="end">climb</text><text x="{px+392}" y="{py2+24}" font-size="11" font-weight="bold" text-anchor="end">walk</text><text x="{px+448}" y="{py2+24}" font-size="11" font-weight="bold" text-anchor="end">run</text>')
pretty={'R1 Taskbar Road (west)':'R1 Toy Factory ⇄ Camp (Taskbar Rd)','R2 Camp to bunker':'R2 Camp ⇄ Bunker','R3 Taskbar Road (east)':'R3 Bunker ⇄ Matrix (Taskbar Rd)','R4 Crest Trail':'R4 Camp ⇄ HAL via crest','R5 Shoulder Pass':'R5 Bunker ⇄ HAL via shoulder','R6 West Back Road':'R6 Toy Factory ⇄ HAL (scenic)','R7 Server Trail':'R7 Matrix ⇄ HAL (scenic)'}
for i,(n,Ln,c,top) in enumerate(rows):
    y=py2+43+i*19
    if i%2==0: A(f'<rect x="{px+8}" y="{y-13}" width="{PANEL_W-24}" height="18" fill="#d4d0c8"/>')
    A(f'<text x="{px+14}" y="{y}" font-size="11">{pretty[n]}</text><text x="{px+272}" y="{y}" font-size="11" text-anchor="end">{Ln:.0f} m</text><text x="{px+330}" y="{y}" font-size="11" text-anchor="end">{c:.0f} m</text><text x="{px+392}" y="{y}" font-size="11" text-anchor="end">{Ln/3.6:.0f} s</text><text x="{px+448}" y="{y}" font-size="11" text-anchor="end">{Ln/6:.0f} s</text>')

py3=py2+40+19*len(rows)+18
MGN=['M1 Minesweeper Meadow','M2 Doom Debates (radio)','M3 The Helper (your product)','M4 SkiFree (snoggoth)','M5 Solitaire win cascade','M6 Paperclips (anti-collect)','(M7 merged into M2)','M8 BSOD storm front','M9 3D Pipes climbing frame','M10 Paint wall',
     'M11 Ringing phone / dial-up','M12 Start monolith + travel','M13 Recycle Bin memorial','M14 Group photo (PrtScn)','M15 Hover!-style flag arena','M16 Pinball knoll','M17 Defrag yard','M18 Screensaver idle','M19 Pause picket perk','M22 My Briefcase locker']
group(px,py3,PANEL_W-8,30+15*10+4,'Walking minigames  (bold = recommended v1)')
for i,t in enumerate(MGN):
    y=py3+22+(i%10)*15; x=px+14 if i<10 else px+14+226
    bw='font-weight="bold"' if i<5 else ''
    A(f'<text x="{x}" y="{y}" font-size="10.8" {bw}>{t}</text>')

# ---- first-arrival bearings + crest trail profile ----
import math as _m
from hub import az
py4=py3+30+15*10+4+22
group(px,py4,PANEL_W-8,124,'First-arrival view from each exit (0° = straight ahead)')
T=[('crest',(-45,-92)),('HAL eye',(10,-208)),('toy tower',(-178,22)),('bunker',(17,8)),('Matrix',(150,98))]
rowsF=[]
for k,s_ in STRUCT.items():
    sx,sz=s_['spawn'];items=[]
    for tn,(tx,tz) in T:
        if (k,tn) in [('L1','bunker'),('L2','HAL eye'),('L3','toy tower'),('L4','Matrix')]: continue
        rel=(az(tx-sx,tz-sz)-s_['face']+540)%360-180
        hidden=(k=='L2' and tn in('bunker','toy tower'))
        side='L' if rel<0 else 'R'
        items.append(f"{tn} {abs(rel):.0f}°{side}"+(' (hidden)' if hidden else ''))
    rowsF.append((k,s_['name'],items))
for i,(k,n,items) in enumerate(rowsF):
    y=py4+24+i*24
    A(f'<text x="{px+14}" y="{y}" font-size="10.8" font-weight="bold">{k} exit, facing {STRUCT[k]["face"]}°</text>')
    A(f'<text x="{px+14}" y="{y+12}" font-size="10">{" · ".join(items)}</text>')
py5=py4+124+22
gh=H-30-py5-14
group(px,py5,PANEL_W-8,gh,'Crest Trail profile: camp → summit junction → HAL door')
pts=ROUTES['R4 Crest Trail'];dist=[0];ys=[gy(*pts[0])];samp=[]
acc=0
for (x0,z0),(x1,z1) in zip(pts,pts[1:]):
    n=int(_m.hypot(x1-x0,z1-z0))
    for i in range(1,n+1):
        x=x0+(x1-x0)*i/n;z=z0+(z1-z0)*i/n;acc+=_m.hypot(x1-x0,z1-z0)/n;dist.append(acc);ys.append(gy(x,z))
gx0,gy0,gw,gh2=px+40,py5+20,PANEL_W-72,gh-46
maxd=dist[-1]
A(f'<rect x="{gx0}" y="{gy0}" width="{gw}" height="{gh2}" fill="#fff" stroke="#808080"/>')
poly=' '.join(f"{gx0+d/maxd*gw:.1f},{gy0+gh2-(y/35)*gh2:.1f}" for d,y in zip(dist,ys))
A(f'<polygon points="{gx0},{gy0+gh2} {poly} {gx0+gw},{gy0+gh2}" fill="#7cc84a" stroke="#2f6b12" stroke-width="1.2"/>')
for v in (0,10,20,30):
    yv=gy0+gh2-(v/35)*gh2;A(f'<line x1="{gx0}" y1="{yv:.1f}" x2="{gx0+gw}" y2="{yv:.1f}" stroke="#000" stroke-opacity=".12"/><text x="{gx0-4}" y="{yv+3:.1f}" font-size="9" text-anchor="end">{v} m</text>')
for v in range(0,int(maxd)+1,50):
    xv=gx0+v/maxd*gw;A(f'<text x="{xv:.1f}" y="{gy0+gh2+11}" font-size="9" text-anchor="middle">{v}</text>')
ci=max(range(len(ys)),key=lambda i:ys[i]);cxp=gx0+dist[ci]/maxd*gw;cyp=gy0+gh2-(ys[ci]/35)*gh2

A(f'<text x="{gx0+4}" y="{gy0+12}" font-size="9.5">camp 4 m</text><text x="{gx0+gw-4}" y="{gy0+12}" font-size="9.5" text-anchor="end">HAL door 4 m</text><text x="{cxp+10:.1f}" y="{cyp-2:.1f}" font-size="9.5">junction 27 m (door 40 m west)</text>')

# status bar
sb=H-30
A(f'<rect x="6" y="{sb}" width="{W-12}" height="22" fill="#c0c0c0"/><path d="M6.5 {sb+21.5}V{sb+.5}H{W-6.5}" fill="none" stroke="#808080"/><path d="M{W-6.5} {sb+.5}V{sb+21.5}H6.5" fill="none" stroke="#fff"/>')
A(f'<text x="14" y="{sb+15}" font-size="11">Proposed play area x −240…230, z −262…200 m (current −180…200, −220…180) · structures sit on new flat pads · heights from src/bliss.ts HILLS + 3 proposed hills · docs/spec/04-bliss-hub-world.md</text>')
A('</svg>')
open(os.path.join(HERE,'..','..','hub-map.svg'),'w').write('\n'.join(out))
print(W,H,MW,MH)
