#!/usr/bin/env python3
"""Bliss hub (SAFE MODE) exteriors: walls, torches and doorway stills from the local DOOM.WAD.

Everything here is read from the privately supplied IWAD (doom-web/local/DOOM.WAD) and
written under the ignored doom-web/local/outside/, like build-escape-assets.py's
doom-wall.png. Nothing is repainted: walls and torch frames are the WAD's own pixels.

  hal-startan3.png / hal-comptall.png / hal-tekwall1.png
      E1M7 station walls for the HAL3000.SYS hall (docs/spec/04-bliss-hub-world.md 2.3).
  meg-shawn2.png / meg-graytall.png / meg-compohso.png / agentic-crate1.png / door-bigdoor2.png
      E2M7 and E2M2 walls for the locked MEG3N.AVI factory and AGENTIC.BAT tower (levels 3
      and 4, not built yet; src/doom-hub-future.ts), and the closed metal door both show.
  torch-<colour>.png
      A torch's 4-frame flicker as one sheet: 28 x 97 px cells (1 px clear border), every
      frame aligned on the sprite's own origin, so cell n is frame n. TORCHES lists the
      colours to build; a later facility's trail adds 'green': 'TGRN' or 'red': 'TRED'.
  hal-doorway.png / control-doorway.png
      160 x 200 stills of each level's own corridor, ray-cast from the WAD's walls and
      flats with Doom's light diminishing. A doorway shows its level's live engine view only
      while that level is the one loaded; otherwise it shows this still, so HAL's doorway
      never shows level 1's interior (and vice versa).
"""
from pathlib import Path
import importlib.util,math,sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'doom-web/local/outside'
spec=importlib.util.spec_from_file_location('doom_art',ROOT/'scripts/doom-art.py');doom_art=importlib.util.module_from_spec(spec);spec.loader.exec_module(doom_art)
art=doom_art.DoomArt(ROOT/'doom-web/local/DOOM.WAD')
TORCHES={'blue':'TBLU'}

def texture(name):
    """A composed wall texture (PNAMES entries are case-insensitive; patches may hang off the edge)."""
    w,h,patches=art.textures[name];image=Image.new('RGBA',(w,h))
    for x,y,index in patches:
        layer=Image.new('RGBA',(w,h));layer.paste(art.patch(art.names[index].upper()),(x,y));image.alpha_composite(layer)
    return image

def torch_sheet(prefix):
    frames=[]
    for f in 'ABCD':
        data=art.lumps[f'{prefix}{f}0'];w,h,left,top=[int.from_bytes(data[i:i+2],'little',signed=True) for i in (0,2,4,6)]
        frames.append((art.patch(f'{prefix}{f}0'),left,top))
    ox=max(l for _,l,_ in frames);oy=max(t for _,_,t in frames)
    cw=max(ox+im.width-l for im,l,_ in frames)+2;ch=max(oy+im.height-t for im,_,t in frames)
    sheet=Image.new('RGBA',(cw*4,ch))
    for n,(im,left,top) in enumerate(frames):sheet.alpha_composite(im,(n*cw+1+ox-left,oy-top))
    return sheet,(1+ox,oy)  # origin within each cell (x from the left, y from the top)

# --- doorway stills: a tiny Doom-style ray caster over a 64-unit grid ---------------------
palette=[tuple(art.palette[i*3:i*3+3]) for i in range(256)]
index_of={}
for i,c in enumerate(palette):index_of.setdefault(c,i)
colormap=art.lumps['COLORMAP']
def indexed(image):
    px=image.load();return [[index_of.get(px[x,y][:3],0) for y in range(image.height)] for x in range(image.width)]
def flat(name):
    data=art.lumps[name];return [[data[y*64+x] for y in range(64)] for x in range(64)]

def doorway(rows,walls,floor,ceiling,lights,light,camera,size=(160,200)):
    """rows[0] is the nearest row (y=0); '.' is open floor, other letters index `walls`;
    `lights` maps open cells (x,y) to a ceiling light flat (lit fullbright, like a light sector)."""
    W,H=size;f=160.0;eye=41.0;ceil_h=128.0
    grid={(x,y):c for y,row in enumerate(rows) for x,c in enumerate(row)}
    tex={k:indexed(texture(v)) for k,v in walls.items()}
    floor_px=flat(floor);ceil_px=flat(ceiling);light_px={k:flat(v) for k,v in lights.items()}
    startmap=(15-(light>>4))*4
    def shade(index,level):return colormap[max(0,min(31,int(level)))*256+index]
    img=Image.new('RGB',(W,H));out=img.load()
    cx,cy=camera
    for c in range(W):
        xc=(c+.5-W/2)/f;dx,dy=xc,1.0            # looking along +y; camera plane along x
        mx,my=int(cx//64),int(cy//64)
        ddx=abs(1/dx) if dx else 1e30;ddy=abs(1/dy)
        sx=1 if dx>0 else -1;sy=1
        side_x=((mx+1)*64-cx)/64*ddx if dx>0 else (cx-mx*64)/64*ddx;side_y=((my+1)*64-cy)/64*ddy
        while True:
            if side_x<side_y:side_x+=ddx;mx+=sx;side=0
            else:side_y+=ddy;my+=sy;side=1
            if grid.get((mx,my),'#')!='.':break
        d=((side_x-ddx) if side==0 else (side_y-ddy))*64     # perpendicular distance (map units)
        hit=cy+d*dy if side==0 else cx+d*dx
        t=tex[grid.get((mx,my),'#') if grid.get((mx,my),'#') in tex else next(iter(tex))]
        tw,th=len(t),len(t[0]);u=int(hit)%tw
        top=H/2-(ceil_h-eye)*f/d;bottom=H/2+eye*f/d
        # wall light: Doom's scalelight (fake contrast: walls facing along x one level brighter)
        level=startmap+(-4 if side==1 else 4)-min(2560/d,47)/2
        for r in range(H):
            if top<=r+.5<bottom:
                world_y=eye-(r+.5-H/2)*d/f;v=int(ceil_h-world_y)%th
                out[c,r]=palette[shade(t[u][v],level)]
            else:
                below=r+.5>H/2;height=eye if below else ceil_h-eye
                dist=height*f/abs(r+.5-H/2)                   # perpendicular distance to that floor/ceiling point
                wx=cx+dx*dist;wy=cy+dy*dist
                cell=(int(wx//64),int(wy//64))
                if not below and cell in light_px:src=light_px[cell];lv=0
                else:src=floor_px if below else ceil_px;lv=startmap-1280/(dist+16)
                out[c,r]=palette[shade(src[int(wx)%64][int(wy)%64],lv)]
    return img

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for name,file in [('STARTAN3','hal-startan3'),('COMPTALL','hal-comptall'),('TEKWALL1','hal-tekwall1'),
                      ('SHAWN2','meg-shawn2'),('GRAYTALL','meg-graytall'),('COMPOHSO','meg-compohso'),('CRATE1','agentic-crate1'),('BIGDOOR2','door-bigdoor2')]:
        texture(name).save(OUT/f'{file}.png')
    for colour,prefix in TORCHES.items():
        sheet,origin=torch_sheet(prefix);sheet.save(OUT/f'torch-{colour}.png')
        print(f'torch-{colour}.png {sheet.width}x{sheet.height}, origin {origin} in each {sheet.width//4} px cell')
    # E1M7 "Confabulation Station": a STARTAN3 corridor into a room of COMPTALL banks.
    hal=['SSS..SSS']*5+['STT..TTS','S......S','S......S','S......S','CCCCCCCC']
    doorway(hal,{'S':'STARTAN3','T':'TEKWALL1','C':'COMPTALL'},'FLOOR4_8','CEIL3_5',
            {(3,2):'TLITE6_5',(4,2):'TLITE6_5',(3,7):'TLITE6_5',(4,7):'TLITE6_5'},192,(256,20)).save(OUT/'hal-doorway.png')
    # E1M4 "Command Control": grey stone into a brown-and-green computer wall.
    control=['GGG..GGG']*6+['G......G','G......G','BBBBBBBB']
    doorway(control,{'G':'GRAY5','B':'BROWNGRN'},'FLOOR4_8','CEIL5_1',
            {(3,1):'TLITE6_4',(4,1):'TLITE6_4',(3,4):'TLITE6_4',(4,4):'TLITE6_4'},176,(256,20)).save(OUT/'control-doorway.png')
    print('Built SAFE MODE hub walls, torches and doorway stills in',OUT.relative_to(ROOT))

if __name__=='__main__':main()
