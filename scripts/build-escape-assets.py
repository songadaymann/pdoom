#!/usr/bin/env python3
"""Code-authored hatch and deterministic local Doom/survivor texture import."""
from pathlib import Path
import struct
from PIL import Image,ImageDraw,PngImagePlugin
ROOT=Path(__file__).resolve().parents[1]
SPRITES=ROOT/'doom-mod/sprites'
OUT=ROOT/'doom-web/outside-assets';OUT.mkdir(exist_ok=True)
def save_sprite(im,name,offset):
    meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',*offset))
    im.save(SPRITES/(name+'.png'),pnginfo=meta)
im=Image.new('RGBA',(64,40));d=ImageDraw.Draw(im)
d.rectangle((0,0,63,39),fill='#272e2c');d.rectangle((2,2,61,37),fill='#727e77')
d.line((2,2,61,2),fill='#b5bbae');d.line((2,2,2,37),fill='#b5bbae')
for y in range(5,36,3):d.line((11,y,52,y),fill='#454f4a')
d.rectangle((20,15,44,25),fill='#242c28');d.line((23,20,41,20),fill='#888f80',width=2)
save_sprite(im,'CPVTA0',(32,40))
im=Image.new('RGBA',(8,8));d=ImageDraw.Draw(im)
d.polygon([(0,2),(5,0),(7,3),(3,7),(1,5)],fill='#777f80')
d.line((0,2,5,0,7,3),fill='#c5c9bd');d.line((1,5,3,7,7,3),fill='#343b3a')
save_sprite(im,'CPMDA0',(4,4))
for frame,color in [('A','#e1dec8'),('B','#426149')]:
    im=Image.new('RGBA',(8,8));d=ImageDraw.Draw(im)
    d.polygon([(2,0),(5,0),(7,2),(7,5),(5,7),(2,7),(0,5),(0,2)],fill='#232c29')
    d.rectangle((2,2,5,5),fill=color);d.line((2,3,5,3),fill='#49514b')
    save_sprite(im,'CPVB'+frame+'0',(4,4))
# Export each already-authored sprite frame/angle without repainting the sheet.
sheet=Image.open(ROOT/'doom-mod/patches/intake-survivor-sheet.png')
bounds=[0,222,444,665,887,1109,1331,1552,1774]
for f in range(4):
 for a in range(8):
  sheet.crop((bounds[a],bounds[f],bounds[a+1],bounds[f+1])).save(OUT/f'person-{f}-{a}.png')
# Stock Doom wall from the supplied private IWAD, kept under ignored local/.
blob=(ROOT/'doom-web/local/DOOM.WAD').read_bytes();_,n,offset=struct.unpack_from('<4sii',blob)
lumps={}
for i in range(n):
 p,size,name=struct.unpack_from('<ii8s',blob,offset+16*i);lumps[name.rstrip(b'\0').decode()]=blob[p:p+size]
palette=lumps['PLAYPAL'][:768];pn=lumps['PNAMES'];names=[pn[4+i*8:12+i*8].rstrip(b'\0').decode() for i in range(struct.unpack_from('<i',pn)[0])]
textures=lumps['TEXTURE1'];count=struct.unpack_from('<i',textures)[0]
for i in range(count):
 at=struct.unpack_from('<i',textures,4+i*4)[0]
 if textures[at:at+8].rstrip(b'\0')!=b'BROWN1':continue
 w,h=struct.unpack_from('<hh',textures,at+12);im=Image.new('RGBA',(w,h),(38,32,25,255))
 for j in range(struct.unpack_from('<h',textures,at+20)[0]):
  ox,oy,pid,_,_=struct.unpack_from('<hhhhh',textures,at+22+j*10);patch=lumps[names[pid]];pw,ph,_,_=struct.unpack_from('<hhhh',patch)
  for x in range(pw):
   pos=struct.unpack_from('<i',patch,8+x*4)[0]
   while patch[pos]!=255:
    top,length=patch[pos:pos+2]
    for y,index in enumerate(patch[pos+3:pos+3+length]):
     if 0<=x+ox<w and 0<=top+y+oy<h:im.putpixel((x+ox,top+y+oy),tuple(palette[index*3:index*3+3])+(255,))
    pos+=length+4
 local=ROOT/'doom-web/local/outside';local.mkdir(exist_ok=True);im.save(local/'doom-wall.png');break
print('Built escape hatch and local outside texture imports.')
