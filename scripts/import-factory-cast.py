#!/usr/bin/env python3
"""Slice generated, transparent factory atlases into native directional sprites.

The generated originals are kept intact. Only atlas extraction, pixel scaling
and Doom foot-origin metadata are applied; no likeness painting or recolouring.
"""
from pathlib import Path
from importlib.machinery import SourceFileLoader
from PIL import Image, ImageDraw, ImageOps
import hashlib, json
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/factory-cast-v1'
helper=SourceFileLoader('factory_cast_import',str(ROOT/'scripts/import-campaign-art.py')).load_module()
CAST=[('zvi','FZVI',56,3),('victoria','FVIC',56,3),('max','FMAX',56,3),
      ('paul','FPAU',56,3),('ajeya','FAJE',56,3),('megan','FMGN',48,6),
      ('robby','FRBY',42,3),('walle','FWAL',36,3)]
# MEG3N's poses while you watch her (2026-10-17): one front-view sheet, 4 columns
# (filming you, shelf-doll freeze, peekaboo, heart hands) x 2 rows (beat A, beat B).
# She always faces you while watched, so these are rotation-0 frames G..N.
WATCHED_SHEET,WATCHED_FRAMES='megan-watched-atlas.png','GHIJKLMN'

def clean(pose):
    """Drop specks a cell crop picks up from its neighbours; they shift the figure in its tile."""
    labels,count=ndimage.label(np.array(pose.getchannel('A'))>0)
    if count<2:return pose
    sizes=ndimage.sum(np.ones(labels.shape),labels,range(1,count+1))
    keep=np.isin(labels,[i+1 for i,s in enumerate(sizes) if s>=sizes.max()*.02])
    alpha=Image.fromarray(np.where(keep,np.array(pose.getchannel('A')),0).astype(np.uint8))
    out=pose.copy();out.putalpha(alpha)
    return out.crop(out.getbbox())

def mirror_dance(sprites):
    """Beat A and beat B, each flipped, give a four-beat front dance whose arms swap
    sides on every beat (frames O, P). She faces you while dancing, so rotation 0."""
    for source,letter in [('FMGND1','O'),('FMGNE1','P')]:
        helper.save_sprite(ImageOps.mirror(Image.open(sprites/f'{source}.png').convert('RGBA')),f'FMGN{letter}0')

def import_watched(sprites):
    path=ART/WATCHED_SHEET
    if not path.exists():
        # Until the art exists, her front idle frame stands in for every pose.
        import shutil
        for letter in WATCHED_FRAMES:shutil.copyfile(sprites/'FMGNA1.png',sprites/f'FMGN{letter}0.png')
        return None
    im=Image.open(path).convert('RGBA');ranges=helper.rows(im)
    if len(ranges)!=2:raise ValueError(f'{WATCHED_SHEET}: expected 2 rows, found {ranges}')
    poses=[[clean(helper.crop(im,row,col,columns=4)) for col in range(4)] for row in ranges]
    # One scale for the sheet: her typical standing height matches the idle frame.
    idle=Image.open(sprites/'FMGNA1.png').getbbox()
    heights=sorted(p.height for row in poses for p in row)
    scale=min((idle[3]-idle[1])/heights[len(heights)//2],62/max(p.width for row in poses for p in row),63/heights[-1])
    frames=[]
    for col in range(4):
        for beat in range(2):
            name='FMGN'+WATCHED_FRAMES[col*2+beat]+'0'
            tile=helper.sprite(poses[beat][col],64,scale);helper.save_sprite(tile,name)
            frames.append({'name':name,'bounds':tile.getbbox()})
    return {'id':'megan-watched','prefix':'FMGN','source':str(path.relative_to(ROOT)),
            'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':ranges,'frames':frames}

# The five people freed in the factory walk out into the meadow (doom-outside.ts) as the
# campaign's people do: figure-<id>-<phase>-<angle>.png, phases idle/walk/walk/walk
# (rows A, B, C, B like import-campaign-art.py), angles = Doom rotations 1-8.
MEADOW=[('zvi','FZVI'),('victoria','FVIC'),('max','FMAX'),('paul','FPAU'),('ajeya','FAJE')]
def export_meadow_figures(sprites=ROOT/'doom-mod/sprites',out=ROOT/'doom-web/outside-assets'):
    out.mkdir(exist_ok=True);written=0
    for id,prefix in MEADOW:
        for phase,row in enumerate('ABCB'):
            for angle in range(8):
                source=sprites/f'{prefix}{row}{angle+1}.png'
                if not source.exists():continue
                # Plain RGBA tiles: the meadow has no use for Doom's grAb origin.
                Image.open(source).convert('RGBA').save(out/f'figure-{id}-{phase}-{angle}.png');written+=1
    return written

def main():
    manifest=[]
    preview=Image.new('RGB',(1024,len(CAST)*160),(32,29,35));draw=ImageDraw.Draw(preview)
    lineup=Image.new('RGB',(1024,180),(32,29,35));labels=ImageDraw.Draw(lineup)
    for index,(id,prefix,height,count) in enumerate(CAST):
        path=ART/f'{id}-atlas.png'
        if not path.exists():raise FileNotFoundError(path)
        im=Image.open(path).convert('RGBA');ranges=helper.rows(im)
        if len(ranges)!=count:raise ValueError(f'{id}: expected {count} rows, found {ranges}')
        poses=[[clean(helper.crop(im,row,col)) for col in range(8)] for row in ranges]
        for r in range(count):  # Rotation 0 must not coexist with these directional frames.
            (ROOT/'doom-mod/sprites'/f'{prefix}{chr(65+r)}0.png').unlink(missing_ok=True)
        scale=min(height/max(p.height for row in poses for p in row),62/max(p.width for row in poses for p in row))
        imported=Image.new('RGBA',(512,count*64));frames=[]
        for r,row in enumerate(poses):
            for a,pose in enumerate(row):
                tile=helper.sprite(pose,height,scale);name=f'{prefix}{chr(65+r)}{a+1}'
                helper.save_sprite(tile,name);imported.alpha_composite(tile,(a*64,r*64))
                frames.append({'name':name,'bounds':tile.getbbox()})
        imported.save(ART/f'{id}-imported.png')
        draw.text((12,index*160+10),id,fill=(255,241,205))
        # Front, three-quarter, profile, back, and two action poses.
        labels.text((index*128+24,156),{'megan':'MEG3N','walle':'WALL-E'}.get(id,id.title()),fill=(255,241,205))
        front=imported.crop((0,0,64,64)).resize((128,128),Image.Resampling.NEAREST)
        lineup.paste(front,(index*128,16),front)
        for j,(r,a) in enumerate([(0,0),(0,1),(0,2),(0,4),(3 if id=='megan' else 1,0),(4 if id=='megan' else count-1,0)]):
            tile=imported.crop((a*64,r*64,(a+1)*64,(r+1)*64)).resize((128,128),Image.Resampling.NEAREST)
            preview.paste(tile,(150+j*140,index*160+20),tile)
        manifest.append({'id':id,'prefix':prefix,'source':str(path.relative_to(ROOT)),
            'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'height':height,'rows':ranges,'frames':frames})
    mirror_dance(ROOT/'doom-mod/sprites')
    export_meadow_figures()
    watched=import_watched(ROOT/'doom-mod/sprites')
    if watched:manifest.append(watched)
    preview.save(ART/'cast-preview.png')
    lineup.save(ART/'cast-lineup.png')
    (ART/'import-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Imported eight factory identities:',sum(len(c['frames']) for c in manifest if c['id']!='megan-watched'),'directional frames',
          '+ 8 MEG3N watched poses' if watched else '(watched poses: placeholders)')

if __name__=='__main__':main()
