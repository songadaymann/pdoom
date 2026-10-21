#!/usr/bin/env python3
"""Extract the optional generated puzzle atlases into foot-aligned Doom sprites.

Source images remain untouched. This import only extracts cells, quantizes alpha,
scales with nearest-neighbour sampling, and adds the engine's PNG origin chunk.
"""
from pathlib import Path
import hashlib, json, struct
from PIL import Image, ImageDraw, PngImagePlugin

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/factory-props-v1'
SPRITES=ROOT/'doom-mod/sprites'

def body_bounds(cell):
    """Locate one pose without a neighbouring atlas cell's stray edge pixels."""
    mask=cell.getchannel('A');small=mask.copy();small.thumbnail((128,128),Image.Resampling.NEAREST)
    w,h=small.size;pixels=bytearray(small.tobytes());largest=[]
    for start,value in enumerate(pixels):
        if not value:continue
        todo=[start];pixels[start]=0;component=[]
        while todo:
            at=todo.pop();component.append(at);x,y=at%w,at//w
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<w and 0<=ny<h and pixels[ny*w+nx]:
                        pixels[ny*w+nx]=0;todo.append(ny*w+nx)
        if len(component)>len(largest):largest=component
    xs=[p%w for p in largest];ys=[p//w for p in largest]
    return (max(0,round((min(xs)-2)*cell.width/w)),max(0,round((min(ys)-2)*cell.height/h)),
            min(cell.width,round((max(xs)+3)*cell.width/w)),min(cell.height,round((max(ys)+3)*cell.height/h)))

def main():
    config=ART/'prompts.json'
    if not config.exists():
        print('No optional factory prop pack; using original procedural props.')
        return
    specs=json.loads(config.read_text())
    missing=[s['id'] for s in specs if not (ART/(s['id']+'-atlas.png')).exists()]
    if missing:raise FileNotFoundError('Incomplete local prop pack: '+', '.join(missing))
    manifest=[]
    preview=Image.new('RGB',(1024,len(specs)*150),(32,29,35))
    labels=ImageDraw.Draw(preview)
    for i,s in enumerate(specs):
        source=ART/(s['id']+'-atlas.png')
        im=Image.open(source).convert('RGBA')
        # Native masked sprites need hard alpha edges, matching the cast import.
        im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0))
        cells=[]
        for row in range(s['rows']):
            for col in range(s['cols']):
                cell=im.crop((round(col*im.width/s['cols']),round(row*im.height/s['rows']),
                              round((col+1)*im.width/s['cols']),round((row+1)*im.height/s['rows'])))
                if s['id'] in ('guard','doll') or s['id']=='vase' and col==0:
                    cell=cell.crop(body_bounds(cell))
                bounds=cell.getbbox()
                if not bounds:raise ValueError(f"Empty {s['id']} cell {row},{col}")
                cells.append(cell if s.get('type')=='texture' else cell.crop(bounds))
        scale=min(s['height']/max(c.height for c in cells),s['width']/max(c.width for c in cells))
        frames=[]
        labels.text((12,i*150+10),s['id'].upper(),fill=(255,241,205))
        for j,(name,cell) in enumerate(zip(s['frames'],cells)):
            if s.get('type')=='texture':
                tile=cell.resize((s['width'],s['height']),Image.Resampling.NEAREST)
                dest=ROOT/'doom-mod/patches/factory'/(name+'.png');tile.save(dest)
                frames.append({'name':name,'path':str(dest.relative_to(ROOT/'doom-mod')),
                    'bounds':tile.getbbox(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
                shot=tile.resize((128,128),Image.Resampling.NEAREST)
                preview.paste(shot,(200+j*200,i*150),shot)
                continue
            cell=cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.NEAREST)
            tile=Image.new('RGBA',(128,96));tile.alpha_composite(cell,((128-cell.width)//2,96-cell.height))
            meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',64,96))
            names=[name]
            # All three dolls share every visual and pose. Their randomized roles
            # never affect their appearance; only their actions reveal intent.
            if s['id']=='doll':names=[name.replace('FDL0',f'FDL{n}') for n in range(3)]
            for native in names:
                tile.save(SPRITES/(native+'.png'),pnginfo=meta)
                frames.append({'name':native,'path':f'sprites/{native}.png','bounds':tile.getbbox(),'sha256':hashlib.sha256((SPRITES/(native+'.png')).read_bytes()).hexdigest()})
            shot=tile.resize((192,144),Image.Resampling.NEAREST)
            preview.paste(shot,(200+j*200,i*150),shot)
        manifest.append({'id':s['id'],'source':str(source.relative_to(ROOT)),
            'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scale':scale,'frames':frames})
    preview.save(ART/'props-preview.png')
    (ART/'import-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Imported',len(manifest),'factory prop atlases,',sum(len(m['frames']) for m in manifest),'native frames.')

if __name__=='__main__':main()
