#!/usr/bin/env python3
"""Pack generated tea puzzle art; label text uses the existing Doom font.

Original images remain unchanged. Only alpha threshold, crop and nearest-neighbor
scaling are used for illustration pixels; labels are deterministic UI text.
"""
from pathlib import Path
from PIL import Image,ImageFont,ImageDraw
from importlib.machinery import SourceFileLoader
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/tea-redesign'
h=SourceFileLoader('tea_import',str(ROOT/'scripts/import-campaign-art.py')).load_module()
records=[]
def load(name,size):
    path=ART/(name+'-asset.png');im=Image.open(path).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0));im=im.crop(im.getbbox())
    scale=min(size[0]/im.width,size[1]/im.height)
    im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
    tile=Image.new('RGBA',size);tile.alpha_composite(im,((size[0]-im.width)//2,size[1]-im.height))
    records.append(dict(source=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),size=size))
    return tile
panel=load('panel',(192,128))
# Label plates on the reviewed generated panel: x17..40 / 54..79, y8..15.
font=ImageFont.truetype(str(ROOT/'doom-web/local/ui/doom-small.ttf'),10)
lettering=SourceFileLoader('doom_text',str(ROOT/'scripts/doom-text.py')).load_module().DoomText(ROOT/'doom-web/local/DOOM.WAD')
for frame,labels in [('A',['SERVE TEA','STOP']),('B',['STOP','SERVE TEA'])]:
    tile=panel.copy();d=ImageDraw.Draw(tile)
    for x,text in zip([56,132],labels):
        lines=text.split(' ') if ' ' in text else [text]
        for i,line in enumerate(lines):
            d.text((x-d.textlength(line,font=font)/2,13+i*7 if len(lines)==2 else 18),line,font=font,fill='#241c16')
    h.save_sprite(tile,'TDIS'+frame+'0');tile.resize((768,512),Image.Resampling.NEAREST).save(ART/('panel-'+frame+'.png'))
    # Crisp lettering on a 4x hires/ copy (2026-10-13); the plates span x32-78 and x111-157, y17-27.
    big=lettering.hires(panel,[{'lines':text.split(' '),'cx':cx,'cy':22,'room':45,'height':11,'gap':1,'colour':'#241c16','edge':None} for cx,text in zip([55,134],labels)])
    lettering.save_hires(big,ROOT/'doom-mod/hires'/('TDIS'+frame+'0.png'),(tile.width*2,tile.height*4))
for id,prefix,size in [('pile','TCPL',(64,32)),('cup','TCUP',(12,12))]:
    h.save_sprite(load(id,size),prefix+'A0')
# Native particle effect: a two-pixel amber stream, not an illustrated asset.
h.save_sprite(Image.new('RGBA',(2,4),(192,109,36,255)),'TDRPA0')
(ART/'manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print('Imported fixed tea dispenser, swapped Doom labels, discarded mound and cup.')
