#!/usr/bin/env python3
"""Extract generated expressions into Doom's 42 mugshot names without repainting."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
from importlib.machinery import SourceFileLoader
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/campaign-v2'
helper=SourceFileLoader('campaign_import',str(ROOT/'scripts/import-campaign-art.py')).load_module()
CAST=json.loads((ART/'roster.json').read_text())
LUMPS=[n for p in range(5) for n in (f'STFST{p}0',f'STFST{p}1',f'STFST{p}2',f'STFTR{p}0',f'STFTL{p}0',f'STFOUCH{p}',f'STFEVL{p}',f'STFKILL{p}')]+['STFGOD0','STFDEAD0']
manifest={'tool':'image_gen.imagegen','characters':[]}
preview=Image.new('RGB',(1070,len(CAST)*94),(24,20,16));draw=ImageDraw.Draw(preview)
for i,c in enumerate(CAST):
    path=ART/(c['id']+'-faces-atlas.png');src=Image.open(path).convert('RGBA');rr=helper.rows(src)
    # Eliezer's hat pixels join the last two rows; the reviewed boundary is
    # y=1055 in the unchanged 1295x1214 source atlas.
    if c['id']=='eliezer' and len(rr)==5:rr=rr[:4]+[[848,1055],[1055,1205]]
    expected=5 if c['id']=='liron' else 6
    if len(rr)!=expected:raise ValueError(f"{c['id']}: expected {expected} expression rows, got {rr}")
    # Curated source layout: Liron delivered four pain rows plus god/dead.
    # Every atlas also put glowing eyes in the first final pain cell; keep
    # that special expression exclusive to STFGOD0, using the adjacent
    # non-glowing straight face for ordinary low-health glances.
    poses=[]
    for k in range(40):
        row=min(k//8,len(rr)-2);col=k%8
        if row==len(rr)-2 and col in (0,1):col=2
        poses.append(helper.crop(src,rr[row],col))
    poses += [helper.crop(src,rr[-1],a) for a in range(2)]
    scale=min(28/max(p.width for p in poses),31/max(p.height for p in poses))
    out=ROOT/'doom-web/local/ui/faces'/c['id'];out.mkdir(parents=True,exist_ok=True)
    meta={'id':c['id'],'name':c['name'],'source':str(path.relative_to(ROOT)),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':rr,'lumps':{}}
    draw.text((8,i*94+35),c['name'],fill=(240,210,163))
    for k,(name,pose) in enumerate(zip(LUMPS,poses)):
        w,h=max(1,round(pose.width*scale)),max(1,round(pose.height*scale))
        tile=Image.new('RGBA',(28,31));tile.alpha_composite(pose.resize((w,h),Image.Resampling.NEAREST),((28-w)//2,31-h))
        tile.save(out/(name+'.png'));meta['lumps'][name]={'w':28,'h':31,'x':-3,'y':0}
        if k<8 or k>=40:
            n=k if k<8 else k-32
            big=tile.resize((84,93),Image.Resampling.NEAREST);preview.paste(big,(210+n*85,i*94),big)
    (out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    manifest['characters'].append(meta)
preview.save(ART/'faces-preview.png');(ART/'faces-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Imported ten named 42-frame HUD face sets.')
