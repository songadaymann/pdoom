#!/usr/bin/env python3
"""Package generated character art; source PNGs remain unchanged.

Eight columns are Doom rotations 1-8. Transparent row gaps delimit poses, so
native image output size and uneven row spacing do not affect import. Three
walking poses loop as left / passing / right / passing. Feet share one origin.
"""
from pathlib import Path
from PIL import Image, PngImagePlugin, ImageDraw
import json, struct, hashlib
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/campaign-v2'
SPRITES=ROOT/'doom-mod/sprites'
OUTSIDE=ROOT/'doom-web/outside-assets'
CAST=json.loads((ART/'roster.json').read_text())

def rows(im):
    a=im.getchannel('A'); hits=[]
    for y in range(im.height):
        count=sum(v>=128 for v in a.crop((0,y,im.width,y+1)).getdata())
        if count>=12:hits.append(y)
    result=[]
    for y in hits:
        if not result or y-result[-1][1]>3:result.append([y,y+1])
        else:result[-1][1]=y+1
    return [r for r in result if r[1]-r[0]>20]

def crop(im,row,col,columns=8):
    cell=im.crop((round(col*im.width/columns),row[0],round((col+1)*im.width/columns),row[1]))
    cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=128 else 0))
    box=cell.getbbox()
    if not box:raise ValueError('Missing pose')
    return cell.crop(box)

def sprite(pose,height,scale):
    w=max(1,round(pose.width*scale));h=max(1,round(pose.height*scale))
    if w>62 or h>height:raise ValueError('Pose exceeds import tile')
    tile=Image.new('RGBA',(64,64));tile.alpha_composite(pose.resize((w,h),Image.Resampling.NEAREST),((64-w)//2,64-h))
    return tile

def save_sprite(im,name,offset=None):
    meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',*(offset or (im.width//2,im.height))))
    im.save(SPRITES/(name+'.png'),pnginfo=meta)

def sheet(frames):
    out=Image.new('RGBA',(512,256))
    for i,im in enumerate(frames):out.alpha_composite(im,((i%8)*64,(i//8)*64))
    return out

def import_cast():
    OUTSIDE.mkdir(exist_ok=True)
    manifest={'tool':'image_gen.imagegen','views':['front','front-left','left','rear-left','back','rear-right','right','front-right'],'characters':[]}
    preview=Image.new('RGB',(960,CAST.__len__()*150),(24,20,16));d=ImageDraw.Draw(preview)
    for index,c in enumerate(CAST):
        path=ART/(c['id']+'-atlas.png');im=Image.open(path).convert('RGBA');ranges=rows(im)
        if len(ranges) not in (5,6,8):raise ValueError(f"{c['id']}: expected 5, 6 or 8 pose rows, got {ranges}")
        half={'eliezer':3,'rob':2,'dan':2}.get(c['id'],len(ranges)//2)
        rec={**c,'index':index,'source':str(path.relative_to(ROOT)),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':ranges,'frames':[]}
        for stance,rr,prefix,height in [('standing',ranges[:half],c['standing'],56),('crouch',ranges[half:],c['crouch'],32)]:
            poses=[[crop(im,r,col) for col in range(8)] for r in rr]
            scale=min(height/max(p.height for r in poses for p in r),62/max(p.width for r in poses for p in r))
            phases={2:[0,1,0,1],3:[0,1,2,1],4:[0,1,2,3]}[len(poses)]
            frames=[]
            for phase,source_row in enumerate(phases):
                for angle in range(8):
                    tile=sprite(poses[source_row][angle],height,scale)
                    save_sprite(tile,f"{prefix}{'ABCD'[phase]}{angle+1}")
                    if stance=='standing':tile.save(OUTSIDE/f"figure-{c['id']}-{phase}-{angle}.png")
                    rec['frames'].append({'stance':stance,'phase':phase,'angle':angle,'source_row':source_row,'opaque_height':tile.getbbox()[3]-tile.getbbox()[1]})
                    frames.append(tile)
            sheet(frames).save(ART/f"{c['id']}-{stance}.png")
            if stance=='standing':
                d.text((8,index*150+8),c['name'],fill=(238,211,168))
                for j,angle in enumerate([0,1,2,4]):
                    big=frames[angle].resize((128,128),Image.Resampling.NEAREST);preview.paste(big,(180+j*128,index*150+15),big)
            else:
                for j,angle in enumerate([0,2]):
                    big=frames[angle].resize((128,128),Image.Resampling.NEAREST);preview.paste(big,(700+j*128,index*150+15),big)
        manifest['characters'].append(rec)
    preview.save(ART/'cast-preview.png')
    (ART/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    # One registry generates every runtime identity mapping.
    identities=[c['id'] for c in CAST]
    levels={l:[c['id'] for c in CAST if c['level']==l] for l in ['five-prisons','hal-station']}
    (ROOT/'doom-web/cast-art.js').write_text('// Generated from art/campaign-v2/roster.json by import-campaign-art.py.\nexport const CAST_IDS='+json.dumps(identities)+';\nexport const LEVEL_CAST='+json.dumps(levels)+';\nexport function castForLevel(level){return LEVEL_CAST[level]||LEVEL_CAST["five-prisons"];}\n')
    (ROOT/'src/doom-cast-art.ts').write_text('// Generated from art/campaign-v2/roster.json.\nexport const CAST_IDS='+json.dumps(identities)+' as const;\n')
    native=['// Generated from art/campaign-v2/roster.json.','class PDNamedCast : Object play','{','    static Name Art(int site,bool crouch)','    {']
    for l in ['hal-station','five-prisons']:
        if l=='hal-station':native+=['        if(level.MapName=="E1M7")','        {']
        for c in [c for c in CAST if c['level']==l]:native.append(f"            if(site=={c['site']})return crouch?'{c['crouch']}':'{c['standing']}';")
        if l=='hal-station':native+=['        }']
    native+=["        return 'LRSH';",'    }','}','class PDNamedCastArtBank : Actor','{','    States','    {']
    for c in CAST:native += [f"    {c['id']}Art:",f"        {c['standing']} ABCD -1;",f"        {c['crouch']} ABCD -1;",'        Stop;']
    native+=['    }','}']
    (ROOT/'doom-mod/actors/NamedCast.zs').write_text('\n'.join(native)+'\n')
    print('Imported',len(CAST),'named walk/crouch/8-angle identities into native and camp.')

if __name__=='__main__':import_cast()
