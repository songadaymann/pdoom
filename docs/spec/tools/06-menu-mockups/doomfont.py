import struct, zipfile
from PIL import Image
from pathlib import Path
ROOT=str(Path(__file__).resolve().parents[4])
WAD=open(ROOT+"/doom-web/local/DOOM.WAD","rb").read()
ident,num,off=struct.unpack('<4sii',WAD[:12])
LUMPS={}
for i in range(num):
    o,s,n=struct.unpack('<ii8s',WAD[off+16*i:off+16*i+16])
    LUMPS[n.rstrip(b'\0').decode()]=(o,s)
def lump(name):
    o,s=LUMPS[name]; return WAD[o:o+s]
pal=lump('PLAYPAL')[:768]
PAL=[tuple(pal[i*3:i*3+3]) for i in range(256)]
def patch(data):
    w,h,lo,to=struct.unpack('<hhhh',data[:8])
    img=Image.new('RGBA',(w,h),(0,0,0,0)); px=img.load()
    cols=struct.unpack('<%dI'%w,data[8:8+4*w])
    for x,c in enumerate(cols):
        p=c; top=-1
        while True:
            td=data[p]
            if td==255: break
            ln=data[p+1]
            # tall patch support
            top = td if td>top else top+td
            for j in range(ln):
                y=top+j
                if 0<=y<h: px[x,y]=PAL[data[p+3+j]]+(255,)
            p+=ln+4
    return img,lo,to
Z=zipfile.ZipFile(ROOT+"/doom-web/engine/game_support.pk3")
BIG={}
for n in Z.namelist():
    if n.startswith('filter/doom.id/fonts/bigfont/') and n.endswith('.lmp'):
        code=int(n.split('/')[-1].split('.')[0],16)
        BIG[chr(code)]=patch(Z.read(n))
SMALL={}
for k in LUMPS:
    if k.startswith('STCFN'):
        try: SMALL[chr(int(k[5:]))]=patch(lump(k))
        except: pass
def text_width(s,font=BIG,kern=-1):
    s=s.upper(); w=0
    space=(font['N'][0].width+1)//2 if font is BIG else 4
    for i,ch in enumerate(s):
        if ch==' ': w+=space
        elif ch in font: w+=font[ch][0].width
        else: w+=space
        if i<len(s)-1: w+=kern
    return w
def draw_text(img,x,y,s,font=BIG,kern=-1,tint=None):
    s=s.upper(); space=(font['N'][0].width+1)//2 if font is BIG else 4
    for ch in s:
        if ch==' ' or ch not in font: x+=space+kern; continue
        g,lo,to=font[ch]
        if tint:
            g=g.copy(); p=g.load()
            for i in range(g.width):
                for j in range(g.height):
                    r,gg,b,a=p[i,j]
                    if a: 
                        l=(r+gg+b)/3/255
                        p[i,j]=(int(tint[0]*l*1.3) if tint[0]*l*1.3<255 else 255,int(min(255,tint[1]*l*1.3)),int(min(255,tint[2]*l*1.3)),a)
        img.alpha_composite(g,(x-lo,y-to))
        x+=g.width+kern
    return x
def graphic(name):
    return patch(lump(name))
