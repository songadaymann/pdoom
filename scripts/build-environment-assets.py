#!/usr/bin/env python3
"""Import the generated civilian frames and author native mechanical effects."""
from pathlib import Path
from PIL import Image,ImageDraw,PngImagePlugin
import struct,math,json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'doom-mod/sprites';OUT.mkdir(exist_ok=True)
def save(im,name):
    meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2,im.height));im.save(OUT/(name+'.png'),pnginfo=meta)
source=ROOT/'art/hal-civilian/chess-sheet.png';im=Image.open(source).convert('RGBA');frames=[]
# Preserve original. Crop cells and use one common scale / floor alignment.
poses=[]
for i in range(4):
    col,row=i%2,i//2;tile=im.crop((col*im.width//2,row*im.height//2,(col+1)*im.width//2,(row+1)*im.height//2))
    tile.putalpha(tile.getchannel('A').point(lambda a:255 if a>=128 else 0));poses.append(tile.crop(tile.getbbox()))
scale=min(120/max(p.width for p in poses),124/max(p.height for p in poses))
preview=Image.new('RGBA',(512,128))
for i,p in enumerate(poses):
    p=p.resize((round(p.width*scale),round(p.height*scale)),Image.Resampling.NEAREST);tile=Image.new('RGBA',(128,128));tile.alpha_composite(p,((128-p.width)//2,128-p.height));save(tile,'PDCS'+chr(65+i)+'0');preview.alpha_composite(tile,(128*i,0))
preview.save(ROOT/'art/hal-civilian/imported.png')
# Simple hardware/effect pixels belong to the established procedural pipeline.
for frame in range(4):
    panel=Image.new('RGBA',(64,64));d=ImageDraw.Draw(panel)
    d.rectangle((1,1,62,62),fill='#191b1c');d.rectangle((3,3,60,60),fill='#656565');d.rectangle((7,7,56,49),fill='#10251c')
    for i in range(6):
        y=12+i*5;length=8+(i*11+frame*7)%34;d.rectangle((12,y,12+length,y+1),fill='#3b985c' if i!=(frame+2)%6 else '#9ad68b')
    d.rectangle((11,52,25,56),fill='#303030');d.rectangle((43,52,49,56),fill='#b3462e');d.point((5,5),fill='#aaa9a3');d.point((58,58),fill='#aaa9a3')
    save(panel,'PDTC'+chr(65+frame)+'0')
vent=Image.new('RGBA',(32,32));d=ImageDraw.Draw(vent);d.rectangle((0,0,31,31),fill='#363837');d.rectangle((2,2,29,29),fill='#181a19')
for y in range(5,28,4):d.line((4,y,27,y),fill='#797d77',width=2)
save(vent,'PDVNA0')
for frame in range(4):
    puff=Image.new('RGBA',(32,32));d=ImageDraw.Draw(puff)
    for cx,cy,r in [(14,18,8),(20,15,7),(11,10,6),(22,22,6)]:
        g=134+frame*13;d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(g,g+2,g+3,150-frame*12))
    save(puff,'PDST'+chr(65+frame)+'0')
# Faint glass with a narrow edge and sparse highlights, see-through alpha.
glass=Image.new('RGBA',(144,60),(70,105,116,36));d=ImageDraw.Draw(glass);d.rectangle((0,0,143,59),outline=(126,151,151,170),width=2);d.line((15,50,48,8),fill=(180,207,207,150),width=2);d.line((21,50,54,8),fill=(180,207,207,80))
(ROOT/'doom-mod/patches/environment').mkdir(exist_ok=True,parents=True);glass.save(ROOT/'doom-mod/patches/environment/PDGLASS.png')
(ROOT/'doom-mod/patches/environment/textures.txt').write_text('WallTexture PDGLASS, 144, 60\n{\n    Patch \"patches/environment/PDGLASS.png\", 0, 0\n}\n')
manifest=dict(tool='image_gen.imagegen (built-in)',prompt='art/hal-civilian/prompt.txt',source=str(source.relative_to(ROOT)),source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),conversion='four isolated cells; alpha threshold, common nearest-neighbor scale, floor alignment',frames=['PDCSA0','PDCSB0','PDCSC0','PDCSD0'])
(ROOT/'art/hal-civilian/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built civilian chess poses, animated terminals, vent/steam and fixed glass.')
