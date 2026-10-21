#!/usr/bin/env python3
"""Slice the v2 helper-doll sheets (art/factory-dolls-v2) into the native FDOL sprite.

One sprite serves Ajeya's three dolls (their roles stay hidden until the camera breaks):
  A1-A8 idle, B1-B8 / C1-C8 walk (left / right foot), D1-D8 / E1-E8 carry walk,
  F0 / G0 clap (hands apart / together), H0 offer key, I0 stunned,
  J0 / K0 press the alarm (back view), L0 / M0 sneaky glance (left / right).
The 8-column sheets use the cast column order (front, front-left, left, rear-left,
back, rear-right, right, front-right), imported as rotations 1-8 like the cast.

Without the local sheets (the public source has no generated media), the old
single side view (FDL0: A arms forward, B walk, C clap, D stunned) stands in as
rotation-0 frames, and PDFactoryDoll mirrors it to face the way it heads.
"""
from pathlib import Path
from importlib.machinery import SourceFileLoader
from PIL import Image
import hashlib, json, shutil
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/factory-dolls-v2'
SPRITES=ROOT/'doom-mod/sprites'
helper=SourceFileLoader('factory_doll_helper',str(ROOT/'scripts/import-campaign-art.py')).load_module()
cast=SourceFileLoader('factory_doll_cast',str(ROOT/'scripts/import-factory-cast.py')).load_module()
HEIGHT=36  # standing height in pixels; PDFactoryDoll draws it at scale 1 (one pixel per unit, like the cast)
# sheet, columns, rows, frame letters per row (8 columns: rotations 1-8; otherwise one rotation-0 frame per cell)
SHEETS=[('doll-walk-atlas.png',8,3,'ABC'),('doll-carry-atlas.png',8,2,'DE'),('doll-actions-atlas.png',4,2,'FGHIJKLM')]
FALLBACK={'A':'B','B':'B','C':'B','D':'A','E':'A','F':'C','G':'B','H':'A','I':'D','J':'A','K':'A','L':'B','M':'B'}

def clear():
    for f in SPRITES.glob('FDOL*.png'):f.unlink()

def fallback():
    clear()
    for letter,source in FALLBACK.items():shutil.copyfile(SPRITES/f'FDL0{source}0.png',SPRITES/f'FDOL{letter}0.png')

def cells(path,columns,count):
    im=Image.open(path).convert('RGBA')
    # The sheets are exact equal grids (quality-report.json); crop each cell to its figure.
    return [[cast.clean(helper.crop(im,(round(r*im.height/count),round((r+1)*im.height/count)),c,columns=columns))
             for c in range(columns)] for r in range(count)]

def main():
    if not all((ART/name).exists() for name,*_ in SHEETS):
        fallback();print('Doll v2 sheets absent: FDOL uses the v1 side view');return None
    clear();manifest=[];preview=Image.new('RGBA',(8*64,9*64))
    row_index=0
    for name,columns,count,letters in SHEETS:
        poses=cells(ART/name,columns,count)
        # One scale per sheet, from its standing poses (the stunned slump is shorter).
        standing=[p.height for r in poses for i,p in enumerate(r) if not (columns==4 and r is poses[0] and i==3)]
        scale=HEIGHT/sorted(standing)[len(standing)//2]
        frames=[]
        for r,row in enumerate(poses):
            for c,pose in enumerate(row):
                tile=helper.sprite(pose,64,scale)
                frame=f'FDOL{letters[r]}{c+1}' if columns==8 else f'FDOL{letters[r*columns+c]}0'
                helper.save_sprite(tile,frame);frames.append({'name':frame,'bounds':tile.getbbox()})
                preview.alpha_composite(tile,((c if columns==8 else (r*columns+c))*64,(row_index+(r if columns==8 else 0))*64))
        row_index+=count if columns==8 else 1
        path=ART/name
        manifest.append({'source':str(path.relative_to(ROOT)),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                         'columns':columns,'rows':count,'scale':round(scale,4),'frames':frames})
    preview.save(ART/'doll-imported.png')
    (ART/'import-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Imported helper-doll v2:',sum(len(m['frames']) for m in manifest),'native frames')
    return manifest

if __name__=='__main__':main()
