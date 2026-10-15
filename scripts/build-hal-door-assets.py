"""Code-native Doom control UI and cell markings over original door textures."""
from pathlib import Path
import struct
from PIL import Image,ImageDraw,ImageFont,PngImagePlugin

def build(root,cell_textures):
    font=ImageFont.truetype(str(root/'doom-web/local/ui/doom-small.ttf'),6)
    from importlib.machinery import SourceFileLoader
    art=SourceFileLoader('doom_art',str(Path(__file__).with_name('doom-art.py'))).load_module().DoomArt(root/'doom-web/local/DOOM.WAD')
    lettering=SourceFileLoader('doom_text',str(Path(__file__).with_name('doom-text.py'))).load_module().DoomText(root/'doom-web/local/DOOM.WAD')
    sprites=root/'doom-mod/sprites';hires=root/'doom-mod/hires';hires.mkdir(exist_ok=True)
    # Labels are lettered in the WAD's own glyphs on a 4x copy in hires/, which GZDoom shows
    # at the sprite's normal size (2026-10-13); 6px TTF text mangled them (THAW read "TXAW").
    # The 1x sprite keeps the small TTF text only as a fallback.
    H=4;pending=[]
    def label(d,text,x,y,color,room=None):pending.append((text,x,y,color,room))
    def save(im,name):
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2,im.height))
        if pending:
            big=im.resize((im.width*H,im.height*H),Image.Resampling.NEAREST)
            d=ImageDraw.Draw(im)
            s=max(1,min([H]+[((room or im.width)*H-6)//lettering.width(text) for text,x,y,color,room in pending]))
            for text,x,y,color,room in pending:
                lettering.draw(big,text,x*H,y*H+(9*H-7*s)//2,color,s)
                d.text((x-d.textlength(text,font=font)/2,y),text,font=font,fill=color)
            meta_big=PngImagePlugin.PngInfo();meta_big.add(b'grAb',struct.pack('>ii',big.width//2,big.height));big.save(hires/(name+'.png'),pnginfo=meta_big)
            pending.clear()
        im.save(sprites/(name+'.png'),pnginfo=meta)
    # Native metal toggle, at native pixel scale. Only the status lamp and
    # damage overlay are custom UI; the IWAD switch art stays untouched.
    for frame in 'ABCD':
        im=art.patch('SW1S0' if frame=='B' else 'SW1S1')
        d=ImageDraw.Draw(im)
        if frame=='D':
            d.rectangle((6,8,13,14),fill='#f7ab3b');d.line((6,8,12,8),fill='#ffdc79')
            d.rectangle((6,21,13,27),fill='#493d21')
        if frame=='C':
            d.line((4,1,12,12,9,19,22,30),fill='#211d19',width=2)
            d.rectangle((6,21,13,27),fill='#44382b');d.rectangle((24,24,27,28),fill='#c9a04b')
        save(im,'HDCN'+frame+'0')
    save(art.patch('SW1S1'),'CPRLA0')
    save(art.patch('SW2S1'),'CPERA0')
    # Compact mechanical levers fit their 19-unit spacing without overlap.
    save(art.patch('SW3S0').crop((8,0,24,32)),'HLVRA0')
    save(art.patch('SW3S1').crop((8,0,24,32)),'HLVRB0')
    # Timed local thaw controls: fixed Doom metal switch and status plaques.
    for frame in 'AB':
        switch=art.patch('SW1S0' if frame=='A' else 'SW1S1')
        im=Image.new('RGBA',(switch.width,switch.height+10));im.alpha_composite(switch,(0,10))
        d=ImageDraw.Draw(im);d.rectangle((0,0,im.width-1,9),fill='#28241d',outline='#76684c')
        label(d,'THAW',im.width//2,0,'#efd397');save(im,'HTOV'+frame+'0')
    source=Image.open(root/'art/campaign-v2/valve-asset.png').convert('RGBA')
    # Named emergency cell release; separate art from generic corridor controls.
    for frame in 'AB':
        switch=art.patch('SW1S0' if frame=='A' else 'SW1S1')
        im=Image.new('RGBA',(48,64));im.alpha_composite(switch,((48-switch.width)//2,64-switch.height))
        d=ImageDraw.Draw(im);d.rectangle((0,0,47,27),fill='#28241d',outline='#76684c')
        for y,text in [(1,'EMERGENCY'),(10,'RELEASE'),(19,'ROB CELL')]:label(d,text,24,y,'#efd397')
        save(im,'HROB'+frame+'0')
    # HAL's main breaker in the Faraday Room sits in a BREAK GLASS case you smash with the
    # wrench (2026-10-13): A = powered behind whole glass, C = cracked, D = glass gone, B = pulled.
    for frame in 'ACDB':
        switch=art.patch('SW3S0' if frame=='B' else 'SW3S1')
        im=Image.new('RGBA',(48,64));im.alpha_composite(switch,((48-switch.width)//2,64-switch.height))
        d=ImageDraw.Draw(im);d.rectangle((0,0,47,27),fill='#28241d',outline='#76684c')
        for y,text in [(1,'HAL'),(10,'MAIN'),(19,'BREAKER')]:label(d,text,24,y,'#efd397')
        if frame in 'AC':
            im.alpha_composite(Image.new('RGBA',(36,31),(170,215,226,96)),(6,31))
            d.line((9,35,16,42),fill=(238,250,255,190));d.line((9,42,13,46),fill=(238,250,255,150))
            for y,text in [(33,'BREAK'),(42,'GLASS')]:label(d,text,24,y,'#ff5a3c',34)
            if frame=='C':
                for end in [(7,52),(16,61),(38,59),(41,44),(31,33),(22,48)]:d.line((29,52)+end,fill=(245,252,255,230))
                d.line((12,57,9,60),fill=(245,252,255,200));d.line((36,47,40,50),fill=(245,252,255,200))
        else:
            # Only jagged teeth of glass are left in the frame.
            for poly in [[(6,31),(14,31),(6,38)],[(41,31),(33,31),(41,40)],[(6,61),(6,53),(12,61)],[(41,61),(41,55),(35,61)],[(20,31),(26,31),(23,35)]]:
                d.polygon(poly,fill=(185,225,235,170))
        d.rectangle((4,29,43,63),outline='#b8301f',width=2)
        save(im,'HBRK'+frame+'0')
    # Emergency floor chevrons for the reboot run (2026-10-13), pointing along +x of the image:
    # A = dim, B = the bright pulse, C = its fading tail. Flat on the floor, exit-sign green so
    # they stand out from the red emergency lighting.
    for frame,core,rim in [('A','#2f8a46','#123f1f'),('B','#ffffff','#63ff86'),('C','#8dffa5','#2fb84f')]:
        im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im)
        d.line((5,3,23,16,5,29),fill=rim,width=9,joint='curve');d.line((7,6,22,16,7,26),fill=core,width=4,joint='curve')
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',16,16));im.save(sprites/('HXLT'+frame+'0.png'),pnginfo=meta)
    lumps=art.lumps
    dims={}
    for table in ['TEXTURE1','TEXTURE2']:
        data=lumps.get(table)
        if not data:continue
        for n in range(struct.unpack_from('<I',data)[0]):
            off=struct.unpack_from('<I',data,4+n*4)[0];name=data[off:off+8].rstrip(b'\0').decode();dims[name]=struct.unpack_from('<HH',data,off+12)
    definitions=[]
    for base,name in cell_textures.items():
        w,h=dims[base];im=Image.new('RGBA',(w,h));d=ImageDraw.Draw(im)
        # Small red bands and a locked-cell plaque; original metal stays visible.
        y=min(h-34,28)
        d.rectangle((0,y-8,w-1,y-3),fill='#813427')
        for x in range(-8,w,16):d.polygon([(x,y-8),(x+5,y-8),(x+10,y-3),(x+5,y-3)],fill='#d59043')
        cx=w//2;d.rectangle((cx-27,y,cx+27,y+27),fill='#241a17',outline='#a9503a')
        d.arc((cx-5,y+2,cx+5,y+12),180,360,fill='#dcb675',width=2);d.rectangle((cx-6,y+8,cx+6,y+15),fill='#c35b39')
        clean=im.copy()
        d.text((cx-d.textlength('CELL',font=font)/2,y+16),'CELL',font=font,fill='#edc895')
        path='patches/hal-cell-'+name+'.png';im.save(root/'doom-mod'/path)
        # The whole door texture again at 4x with crisp lettering, for hires/ (2026-10-13).
        door=art.texture(base);door.alpha_composite(clean)
        big=lettering.hires(door,[{'lines':['CELL'],'cx':cx,'cy':y+20,'room':50,'height':10,'colour':'#edc895'}])
        big.save(hires/(name+'.png'))
        definitions.append(f'Texture {name}, {w}, {h}\n{{\n    Patch {base}, 0, 0\n    Patch "{path}", 0, 0\n}}')
    p=root/'doom-mod/TEXTURES';base=p.read_text().partition('// HAL cell markings.')[0].rstrip();p.write_text(base+'\n\n// HAL cell markings.\n'+'\n\n'.join(definitions)+'\n')
    print('Built native Doom metal switches and original-texture containment markings.')
