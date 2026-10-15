#!/usr/bin/env python3
"""Package generated prop cutouts at the original native dimensions.

Terminal labels are ordinary UI text rendered with the local Doom font.
Generated source art is archived unchanged; no illustrated pixels are repainted.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from importlib.machinery import SourceFileLoader
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/campaign-v2'
h=SourceFileLoader('campaign_import',str(ROOT/'scripts/import-campaign-art.py')).load_module()
font=ImageFont.truetype(str(ROOT/'doom-web/local/ui/doom-small.ttf'),7)
records=[];tiles=[]
# Screen labels are lettered in the WAD's own glyphs on 4x hires/ copies (2026-10-13); the
# 1x TTF text is only a fallback. The terminal's green screen spans x20-40, y18-32.
lettering=SourceFileLoader('doom_text',str(ROOT/'scripts/doom-text.py')).load_module().DoomText(ROOT/'doom-web/local/DOOM.WAD')
def load(id,size):
    path=ART/(id+'-asset.png');im=Image.open(path).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0));im=im.crop(im.getbbox())
    scale=min((size[0]-2)/im.width,(size[1]-2)/im.height)
    im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
    tile=Image.new('RGBA',size);tile.alpha_composite(im,((size[0]-im.width)//2,size[1]-im.height))
    records.append({'source':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':size})
    return tile
def save(tile,prefix,label=None):
    clean=tile.copy()
    if label:
        draw=ImageDraw.Draw(tile)
        lines=label.split(' ') if prefix in ('HTEA','HBAY') else [label]
        for i,line in enumerate(lines):
            face=font
            if prefix!='HEVL' and draw.textlength(line,font=face)>27:face=ImageFont.truetype(str(ROOT/'doom-web/local/ui/doom-small.ttf'),5)
            w=draw.textlength(line,font=face)
            draw.text(((tile.width-w)/2,17+i*6 if prefix!='HEVL' else 10),line,font=face,fill='#251d16' if prefix=='HEVL' else '#f5d79e',stroke_width=0)
    h.save_sprite(tile,prefix+'A0');tiles.append((prefix,tile))
    # HEVL (evaluation board) and HLVR (lever) are redrawn later by build-evaluation-sign.py and
    # build-hal-door-assets.py, so they must not get a hires copy here.
    if label and prefix not in ('HEVL','HLVR'):
        big=lettering.hires(clean,[{'lines':lines,'cx':30.5,'cy':25,'room':21,'height':15,'colour':'#f5d79e'}])
        lettering.save_hires(big,ROOT/'doom-mod/hires'/(prefix+'A0.png'),(tile.width*2,tile.height*4))
base=load('terminal',(64,40))
for prefix,label in [('HTRM','STOP'),('HTEA','SERVE TEA'),('HEXM','EXAM'),('HLVR','POWER'),('HBAY','POD BAY'),('HCYC','CYCLE'),('HDRP','DOOR')]:save(base.copy(),prefix,label)
for id,prefix,size in [('rack','HRCK',(48,56)),('pod','HPOD',(72,88)),('frost','HFRO',(48,32)),('flash','HFLA',(40,32)),('valve','HVAL',(48,40)),('memory','HMEM',(32,40)),('book','PDBK',(24,28)),('evaluation','HEVL',(64,40)),('altmanbody','SAMB',(48,28)),('amodeibody','DARB',(48,28))]:
    save(load(id,size),prefix,'EVALUATION' if id=='evaluation' else None)
preview=Image.new('RGB',(600,((len(tiles)+5)//6)*140),(24,20,16));draw=ImageDraw.Draw(preview)
for i,(name,tile) in enumerate(tiles):
    draw.text(((i%6)*100+4,(i//6)*140+4),name,fill='#ecd3a4');scale=min(96/tile.width,118/tile.height)
    big=tile.resize((round(tile.width*scale),round(tile.height*scale)),Image.Resampling.NEAREST);preview.paste(big,((i%6)*100+(100-big.width)//2,(i//6)*140+140-big.height),big)
preview.save(ART/'props-preview.png');(ART/'props-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print('Imported generated rescue hardware and seated CEO bodies.')
