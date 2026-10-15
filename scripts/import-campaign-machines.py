#!/usr/bin/env python3
"""Deterministic import of generated machine art at each native actor's height."""
from pathlib import Path
from PIL import Image
from importlib.machinery import SourceFileLoader
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/campaign-v2';SPRITES=ROOT/'doom-mod/sprites'
h=SourceFileLoader('campaign_import',str(ROOT/'scripts/import-campaign-art.py')).load_module()
manifest=[]
for id,prefix,count,height,mapping in [('hal','H300',3,52,[0,1,2]),('teabot','TEAB',3,42,[0,1,2]),('inferminator','HUNT',6,64,[0,1,2,3,4,4,5])]:
    source=ROOT/'art/tea-redesign/bot-atlas.png' if id=='teabot' else ART/(id+'-atlas.png')
    im=Image.open(source).convert('RGBA');rr=h.rows(im)
    if len(rr)!=count:raise ValueError(f'{id}: {rr}')
    poses=[[h.crop(im,r,a) for a in range(8)] for r in rr]
    scale=min(height/max(p.height for r in poses for p in r),62/max(p.width for r in poses for p in r))
    frames=[]
    for f,row in enumerate(mapping):
        for a in range(8):
            tile=h.sprite(poses[row][a],height,scale)
            h.save_sprite(tile,f"{prefix}{'ABCDEFG'[f]}{a+1}");frames.append(tile)
    # Rotation 0 cannot coexist with a directional sprite family.
    for f in range(len(mapping)):
        legacy=SPRITES/f"{prefix}{'ABCDEFG'[f]}0.png"
        if legacy.exists():
            backup=ART/'original-machine-sprites';backup.mkdir(exist_ok=True)
            if not (backup/legacy.name).exists():shutil.copy2(legacy,backup/legacy.name)
            legacy.unlink()
    preview=Image.new('RGBA',(512,64*len(mapping)))
    for n,tile in enumerate(frames):preview.alpha_composite(tile,((n%8)*64,(n//8)*64))
    preview.save(ART/(id+'-imported.png'))
    if id=='teabot':preview.save(ROOT/'art/tea-redesign/bot-imported.png')
    manifest.append({'id':id,'prefix':prefix,'rows':rr,'frames':len(frames),'height':height,
        'source':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'collision':{'radius':10,'height':42,'solid':False,'harmless':True} if id=='teabot' else 'unchanged'})
(ART/'machines-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Imported HAL, TEABOT and Inferminator directional art.')
