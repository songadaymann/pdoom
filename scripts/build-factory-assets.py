#!/usr/bin/env python3
"""Original, deliberately simple pixel props for the local factory prototype."""
from pathlib import Path
import json, math, random, struct, wave
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
INK = '#24213b'
CREAM = '#fff1cd'
PINK = '#ee588e'
TEAL = '#18a79f'
YELLOW = '#ffd452'


def build():
    sprites = ROOT/'doom-mod/sprites'
    textures = ROOT/'doom-mod/patches/factory'
    flats = ROOT/'doom-mod/flats/factory'
    for folder in [sprites, textures, flats]: folder.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()

    def sprite(name, draw, size=(96, 64), offset=None):
        im = Image.new('RGBA', size)
        draw(ImageDraw.Draw(im))
        meta = PngImagePlugin.PngInfo()
        meta.add(b'grAb', struct.pack('>ii', *(offset or (size[0]//2, size[1]))))
        im.save(sprites/(name+'.png'), pnginfo=meta)

    def doll(d, color=YELLOW, label='M', lean=0):
        x=48+lean
        d.ellipse((x-23,1,x+23,44),outline=CREAM,width=3)
        d.line((x+18,38,x+25,48),fill=INK,width=3)
        d.rectangle((x-11,9,x+11,30),fill=INK)
        d.rectangle((x-7,14,x-4,17),fill=TEAL)
        d.rectangle((x+4,14,x+7,17),fill=TEAL)
        d.line((x-5,23,x+5,23),fill=PINK,width=2)
        d.line((x-13,17,x-18,31),fill=PINK,width=3)
        d.line((x+13,17,x+18,31),fill=PINK,width=3)
        d.polygon([(x-9,32),(x+9,32),(x+14,53),(x-14,53)],fill=color,outline=INK)
        d.text((x-3,36),label,font=font,fill=INK)
        d.line((x-15,35,x-27,43+lean),fill=color,width=5)
        d.line((x+15,35,x+27,38-lean),fill=color,width=5)
        d.rectangle((x-10,54,x-4,62),fill=INK)
        d.rectangle((x+4,54,x+10,62),fill=INK)
    for phase,lean in zip('ABC',[0,-5,5]): sprite('FMEG'+phase+'0',lambda d,l=lean:doll(d,lean=l))
    for i in range(3): sprite(f'FDL{i}A0',lambda d,n=i:doll(d,CREAM,str(n+1)))

    def board(d, lines, color=CREAM):
        # Candy packaging frame to match the generated puzzle art.
        d.rounded_rectangle((0,0,127,63),radius=8,fill=PINK,outline=INK,width=2)
        d.rounded_rectangle((5,5,122,58),radius=5,fill=color,outline=TEAL,width=2)
        for x,y in [(2,2),(121,2),(2,57),(121,57)]:d.rectangle((x,y,x+4,y+4),fill=YELLOW,outline=INK)
        for i,line in enumerate(lines):
            box=d.textbbox((0,0),line,font=font)
            d.text(((128-(box[2]-box[0]))//2,9+i*14),line,font=font,fill=INK)

    signs={'FPTN':['PAUSE PRODUCTION','3 SIGNATURES','REQUIRED'],
           'FTRN':['TRAIN THE GUARD','RATE LAST ACTION','+ YES    - NO'],
           'FGAT':['SAFETY REQUIREMENT','KEEP GATE CLOSED','[ OK ]'],
           'FGOP':['GATE OPEN [X]','SAFETY VIOLATION','ALARM'],
           'FOKY':['GATE CLOSED [OK]','CONTAINMENT','SUCCESSFUL'],
           'FALM':['ALARM','DO NOT PRESS'],
           'FCDS':['DANCE DEMO','PLAY MUSIC']}
    def sign(d,lines,name):
        board(d,lines)
        if name in ['FGAT','FOKY','FGOP']:
            d.ellipse((108,45,118,55),fill='#dd243f' if name=='FGOP' else '#15a34a',outline=INK)
    for name,lines in signs.items(): sprite(name+'A0',lambda d,ll=lines,code=name:sign(d,ll,code),(128,64))

    def cd(d):
        d.rectangle((17,32,79,58),fill=PINK,outline=INK,width=2)
        for x in [28,68]: d.ellipse((x-7,37,x+7,51),fill=INK,outline=CREAM,width=2)
        d.ellipse((40,35,56,51),fill=CREAM,outline=INK,width=2)
        d.polygon([(45,40),(45,47),(51,44)],fill=TEAL)
        d.line((25,30,29,23,67,23,71,30),fill=INK,width=3)
    sprite('FCDPA0',cd)
    def vase(d):
        d.rectangle((40,19,56,25),fill=TEAL,outline=INK)
        d.polygon([(42,25),(54,25),(61,48),(58,57),(38,57),(35,48)],fill=PINK,outline=INK)
        d.line((40,38,56,38),fill=YELLOW,width=3)
    sprite('FVSEA0',vase)
    def key(d):
        d.ellipse((34,32,48,46),outline=YELLOW,width=4)
        d.line((46,42,62,54),fill=YELLOW,width=4)
        d.line((56,47,52,53),fill=YELLOW,width=4)
    sprite('FKEYA0',key)
    def worker(d):
        d.rectangle((32,16,64,34),fill=TEAL,outline=INK,width=2)
        d.rectangle((37,21,59,27),fill=INK)
        d.rectangle((28,37,68,56),fill=YELLOW,outline=INK,width=2)
        d.line((26,39,18,49),fill=TEAL,width=6)
        d.line((70,39,78,49),fill=TEAL,width=6)
        for x in [36,60]:d.ellipse((x-6,52,x+6,63),fill=INK)
    sprite('FWRKA0',worker)
    def button(d, yes):
        d.rectangle((27,31,69,59),fill=INK)
        d.rectangle((30,34,66,56),fill=TEAL if yes else PINK)
        d.text((39,39),'YES' if yes else 'NO',font=font,fill=CREAM)
    sprite('FUPBA0',lambda d:button(d,True))
    sprite('FDNBA0',lambda d:button(d,False))
    def box(d):
        d.rectangle((9,4,86,63),fill=YELLOW,outline=INK,width=3)
        d.rectangle((19,12,76,52),fill=TEAL,outline=INK,width=2)
        d.rectangle((44,18,53,26),fill=CREAM)
        d.rectangle((38,29,60,46),fill=PINK)
        d.text((26,52),'FRIEND',font=font,fill=INK)
    sprite('FBOXA0',box)
    def camera(d):
        d.ellipse((22,12,43,33),fill=YELLOW,outline=INK,width=2)
        d.ellipse((53,12,74,33),fill=YELLOW,outline=INK,width=2)
        d.rectangle((28,22,68,53),fill=YELLOW,outline=INK,width=2)
        d.ellipse((38,27,58,47),fill=INK,outline=CREAM,width=2)
        d.rectangle((44,32,52,40),fill=PINK)
    sprite('FCAMA0',camera)
    def step(d):
        d.rectangle((27,42,69,50),fill=TEAL,outline=INK,width=2)
        d.rectangle((30,50,36,62),fill=YELLOW,outline=INK)
        d.rectangle((60,50,66,62),fill=YELLOW,outline=INK)
    sprite('FSTPA0',step)
    # Ajeya's packing bin: an open cardboard box with stools poking out (2026-10-18).
    def packing_bin(d):
        for x in (20,34):d.rectangle((x,10,x+10,18),fill=TEAL,outline=INK)
        d.polygon([(10,18),(2,7),(20,11),(24,18)],fill='#e9b56e',outline=INK)
        d.polygon([(54,18),(62,7),(44,11),(40,18)],fill='#e9b56e',outline=INK)
        d.rectangle((10,18,54,46),fill='#d79a52',outline=INK,width=2)
        d.rectangle((12,29,52,34),fill=PINK)
        d.rectangle((25,37,39,43),fill=CREAM,outline=INK)
    sprite('FPKBA0',packing_bin,(64,48))
    # Break-room doorway tape (2026-10-19): yellow and ink hazard stripes, NO TOYS. The
    # engine shows this flat sprite flipped top to bottom from both sides, so the label is
    # stored flipped and reads the right way up.
    def tape(d):
        d.rectangle((0,0,127,15),fill=YELLOW)
        for x in range(-16,128,12):d.polygon([(x,15),(x+6,15),(x+14,0),(x+8,0)],fill=INK)
        label=Image.new('RGBA',(46,12),YELLOW);ImageDraw.Draw(label).rectangle((0,0,45,11),outline=INK)
        ImageDraw.Draw(label).text((3,0),'NO TOYS',font=font,fill=INK)
        d._image.paste(label.transpose(Image.Transpose.FLIP_TOP_BOTTOM),(41,2))
        d.rectangle((0,0,127,15),outline=PINK)
    sprite('FTAPA0',tape,(128,16),(64,8))
    for name,color in [('FWCREAM',CREAM),('FWPINK',PINK),('FWTEAL',TEAL),('FWYELLOW',YELLOW)]:
        im=Image.new('RGB',(64,128),color);d=ImageDraw.Draw(im)
        d.rectangle((0,0,63,7),fill=INK);d.rectangle((0,112,63,127),fill=TEAL if name=='FWCREAM' else INK)
        d.line((0,63,63,63),fill=INK,width=2);im.save(textures/(name+'.png'))
    # Playpen bars: rounded teal bars with a highlight between pink rails and finials.
    im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
    for x in range(5,64,16):
        d.rounded_rectangle((x,4,x+5,61),radius=2,fill=TEAL,outline=INK)
        d.line((x+1,8,x+1,57),fill='#7fe0d6')
        d.ellipse((x-1,0,x+6,7),fill=YELLOW,outline=INK)
    for y in [8,56]:d.rounded_rectangle((0,y,63,y+5),radius=2,fill=PINK,outline=INK)
    im.save(textures/'FBARS.png')
    # The playpen gate: a pink arch over a two-leaf toy gate with hinges and a big latch,
    # so it reads as the one side that opens (2026-10-18).
    im=Image.new('RGBA',(64,80));d=ImageDraw.Draw(im)
    for x in [0,58]:d.rounded_rectangle((x,8,x+5,79),radius=2,fill=TEAL,outline=INK)
    d.rounded_rectangle((0,0,63,15),radius=6,fill=PINK,outline=INK,width=2)
    box=d.textbbox((0,0),'GATE',font=font);d.text(((64-box[2]+box[0])//2,1),'GATE',font=font,fill=CREAM)
    for left in [6,32]:
        d.rectangle((left,22,left+25,74),outline=CREAM,width=3)
        for x in range(left+6,left+24,6):d.line((x,24,x,72),fill=CREAM,width=2)
        d.line((left,48,left+25,48),fill=PINK,width=3)
    d.line((6,22,57,22),fill=INK);d.line((6,74,57,74),fill=INK)
    for y in [28,66]:d.rectangle((3,y,9,y+5),fill=INK)  # hinges
    d.rounded_rectangle((26,40,37,56),radius=3,fill=YELLOW,outline=INK,width=2)  # latch
    d.rectangle((30,44,33,52),fill=INK)
    im.save(textures/'FGATE.png')
    im=Image.new('RGB',(64,128),TEAL);d=ImageDraw.Draw(im)
    d.rectangle((2,2,61,125),outline=INK,width=3)
    d.rectangle((7,7,56,120),outline=CREAM,width=2)
    d.rectangle((12,42,51,76),fill=YELLOW,outline=INK,width=2)
    d.text((18,52),'TOYS',font=font,fill=INK)
    d.rectangle((49,88,54,101),fill=PINK)
    im.save(textures/'FDOOR.png')
    im=Image.new('RGB',(64,64),CREAM);d=ImageDraw.Draw(im)
    for x in range(0,64,16):d.line((x,0,x,63),fill=PINK,width=3)
    d.line((0,8,63,55),fill=TEAL,width=3);im.save(textures/'FFABRIC.png')
    d.line((17,15,23,28,34,33,40,49),fill=INK,width=5);im.save(textures/'FFRAY.png')
    # Cotton-candy sky for the yards: blue overhead, pink at the horizon, with
    # puffy clouds in the lower half that GZDoom's eye-level view samples.
    sky=Image.new('RGB',(1024,256));px=sky.load()
    top,middle,horizon=(110,182,255),(186,170,255),(255,200,222)
    for y in range(256):
        t=y/255;a,b,u=(top,middle,t/.6) if t<.6 else (middle,horizon,(t-.6)/.4)
        row=tuple(round(p+(q-p)*u) for p,q in zip(a,b))
        for x in range(1024):px[x,y]=row
    rng=random.Random(7)
    for cx in [70,240,430,560,760,905]:
        base=rng.randint(176,206);w=rng.randint(70,130)
        puffs=[(cx+round(w*(i/4-.5)),rng.randint(9,15)+(12 if i in (1,2,3) else 0)) for i in range(5)]
        cloud=Image.new('L',(1024,256));d=ImageDraw.Draw(cloud)
        for x,r in puffs:
            for wrap in (-1024,0,1024):d.ellipse((x+wrap-r,base-2*r,x+wrap+r,base),fill=255)
        d.rectangle((0,base-4,1024,256),fill=0)
        shade=Image.new('L',(1024,256));ImageDraw.Draw(shade).rectangle((0,base-11,1024,256),fill=255)
        sky.paste((255,250,253),mask=cloud)
        sky.paste((248,212,234),mask=ImageChops.darker(cloud,shade))
    sky.save(textures/'FTOYSKY.png')
    # Toy-brand sticker pasted over the UAC stamp on recoloured Doom crates.
    label=ImageDraw.Draw(Image.new('L',(1,1))).textbbox((0,0),'TOYS',font=font)
    im=Image.new('RGBA',(label[2]+20,22));d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,im.width-1,21),radius=6,fill=PINK,outline=CREAM,width=2)
    d.polygon([(7,4),(8,8),(12,8),(9,11),(10,15),(7,12),(4,15),(5,11),(2,8),(6,8)],fill=YELLOW)
    d.text((15,11-label[3]//2-label[1]//2),'TOYS',font=font,fill=CREAM)
    im.save(textures/'FSTICKER.png')
    (ROOT/'doom-mod/factory-textures.txt').write_text('\n'.join(
        f'Texture "{name}", {Image.open(textures/(name+".png")).width}, {Image.open(textures/(name+".png")).height}\n{{ Patch "patches/factory/{name}.png", 0, 0 }}'
        for name in ['FWCREAM','FWPINK','FWTEAL','FWYELLOW','FBARS','FGATE','FFABRIC','FFRAY','FDOOR','FTOYSKY']))
    for name,c1,c2 in [('FCHECK',CREAM,TEAL),('FWHITE',CREAM,'#efdbc0'),('FPAINT',PINK,'#d23469'),('FBELT',INK,'#525166')]:
        im=Image.new('RGB',(64,64),c1);d=ImageDraw.Draw(im)
        for x in range(0,64,16):
            for y in range(0,64,16):
                if (x+y)//16%2:d.rectangle((x,y,x+15,y+15),fill=c2)
        im.save(flats/(name+'.png'))
    # Foam puzzle-mat floor inside the playpen: four colours with jigsaw tabs.
    im=Image.new('RGB',(64,64));d=ImageDraw.Draw(im)
    tiles=[PINK,TEAL,YELLOW,'#9a84ea']
    for i,(x,y) in enumerate([(0,0),(32,0),(0,32),(32,32)]):
        d.rectangle((x,y,x+31,y+31),fill=tiles[i]);d.rectangle((x,y,x+31,y+31),outline='#2a2347')
    for i,(x,y) in enumerate([(0,0),(32,0),(0,32),(32,32)]):
        d.ellipse((x+28,y+11,x+37,y+20),fill=tiles[i])
        d.ellipse((x+11,y+28,x+20,y+37),fill=tiles[i])
    im.save(flats/'FPLAYMAT.png')
    # Toy-plank walkway: warm planks with ink seams and teal edge stripes.
    im=Image.new('RGB',(64,64),'#f2b54a');d=ImageDraw.Draw(im)
    for y in range(0,64,16):
        d.line((0,y,63,y),fill='#2a2347');d.line((0,y+1,63,y+1),fill='#ffd98a')
        for x in ([10,42] if y%32 else [26,58]):d.ellipse((x,y+6,x+3,y+9),fill='#8a4a1c')
    for x in [0,60]:d.rectangle((x,0,x+3,63),fill=TEAL)
    im.save(flats/'FBRIDGE.png')
    sounds=ROOT/'doom-mod/sounds';sounds.mkdir(parents=True,exist_ok=True)
    with wave.open(str(sounds/'FDANCE.wav'),'wb') as w:
        rate=22050;w.setparams((1,2,rate,0,'NONE','not compressed'))
        notes=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46]
        frames=bytearray()
        for i in range(rate*6):
            t=i/rate;beat=t%.25;freq=notes[int(t/.25)%len(notes)]
            env=min(1,beat/.01)*max(0,1-beat/.25)
            value=.15*env*(math.sin(2*math.pi*freq*t)+.35*math.sin(4*math.pi*freq*t))
            frames.extend(struct.pack('<h',int(32767*value)))
        w.writeframes(frames)
    # The compact browser engine omits general WAV decoding for effects.
    # Package the same tune as Doom's native unsigned 8-bit sound format.
    def dmx(name,pcm,rate=22050):
        payload=bytes([128])*16+bytes(max(0,min(255,round(v/256)+128)) for v in pcm)+bytes([128])*16
        (sounds/name).write_bytes(struct.pack('<HHI',3,rate,len(payload))+payload)
    pcm=struct.unpack('<'+'h'*(len(frames)//2),frames)
    # The radio plays one of Jonathan's songs when a clip is set up in ignored
    # art/factory-radio/ (README there); otherwise the generated tune above.
    radio=ROOT/'art/factory-radio'
    clip=json.loads((radio/'clip.json').read_text()) if (radio/'clip.json').exists() else {}
    song=radio/clip['file'] if clip.get('file') else None
    if song and song.exists():
        import subprocess
        start,length=float(clip.get('start',0)),float(clip.get('seconds',6))
        raw=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-t',str(length),'-i',str(song),'-ac','1','-ar',str(rate),
            '-af',f'afade=t=in:d=0.05,afade=t=out:st={length-0.25}:d=0.25,loudnorm=I=-14:TP=-1','-f','s16le','-'],capture_output=True,check=True).stdout
        pcm=struct.unpack('<'+'h'*(len(raw)//2),raw)
        print('Radio: using',song.name,f'{start:g}s +{length:g}s')
    dmx('fdmusic.lmp',pcm,rate)
    # Sound effects (2026-10-19), as plain sample lists at 22050 Hz.
    rng=random.Random(7)
    def tone(freq,seconds,volume=.5,shape='sine',drop=0.):
        out=[]
        for i in range(int(rate*seconds)):
            t=i/rate;f=freq*(1-drop*t/seconds);phase=(f*t)%1
            wave_=math.sin(2*math.pi*phase) if shape=='sine' else (1 if phase<.5 else -1)
            env=min(1,t/.005)*max(0,1-t/seconds)**1.5
            out.append(volume*env*wave_)
        return out
    def mix(*parts):
        length=max(len(part) for offset,part in parts)+max(offset for offset,part in parts)
        out=[0.]*length
        for offset,part in parts:
            for i,v in enumerate(part):out[offset+i]+=v
        return [int(32767*max(-1,min(1,v))) for v in out]
    # Vase: a bright crash of noise, then glass tinkles scattering.
    crash=[]
    low=0.
    for i in range(int(rate*.35)):
        t=i/rate;white=rng.uniform(-1,1);low+=(white-low)*.35
        crash.append((white-low)*.9*max(0,1-t/.35)**3)
    tinkles=[(int(rate*rng.uniform(.03,.5)),tone(rng.uniform(2600,5200),rng.uniform(.05,.14),rng.uniform(.12,.28))) for _ in range(14)]
    dmx('fdvase.lmp',mix((0,crash),*tinkles))
    # Reward: a rising two-note chime. Punish: a low falling buzz.
    dmx('fdgood.lmp',mix((0,tone(880,.16,.45)),(int(rate*.09),tone(1318.5,.24,.45))))
    dmx('fdbad.lmp',mix((0,tone(150,.4,.32,'square',.25)),(0,tone(156,.4,.2,'square',.25))))
    # Register every feedback state even without the optional generated pack.
    # These remain deliberately simple public-source fallback graphics.
    import shutil
    extra={'FCDP':'B','FVSE':'B','FPTN':'BCD','FTRN':'BCD','FUPB':'B',
           'FDNB':'B','FBOX':'BC','FCAM':'B','FALM':'B','FWRK':'BCD',
           'FDL0':'BCD','FDL1':'BCD','FDL2':'BCD'}
    for prefix,phases in extra.items():
        for phase in phases:shutil.copyfile(sprites/(prefix+'A0.png'),sprites/(prefix+phase+'0.png'))
    print('Built original factory prototype props, materials and music.')
    # Generated cast art is optional local media. Keep the procedural prop
    # source independent, and re-import installed atlases after rebuilding.
    cast_art=ROOT/'art/factory-cast-v1'
    if all((cast_art/(name+'-atlas.png')).exists() for name in ['zvi','victoria','max','paul','ajeya','megan','robby','walle']):
        from importlib.machinery import SourceFileLoader
        cast=SourceFileLoader('factory_cast',str(ROOT/'scripts/import-factory-cast.py')).load_module()
        cast.main()
    else:
        # The public source has no character media. Reuse the existing generic
        # survivor and original procedural robots when the local pack is absent.
        import shutil
        for prefix in ['FZVI','FVIC','FMAX','FPAU','FAJE']:
            if (sprites/(prefix+'A1.png')).exists():continue
            for phase,source in zip('ABC','ABC'):
                for angle in range(1,9):
                    original=sprites/f'ROBM{source}{angle}.png'
                    if original.exists():shutil.copyfile(original,sprites/f'{prefix}{phase}{angle}.png')
        for prefix,sources in [('FMGN',['FMEGA0','FMEGB0','FMEGC0','FMEGB0','FMEGC0','FMEGA0']+['FMEGA0']*8+['FMEGC0','FMEGB0']),('FRBY',['FWRKA0']*3),('FWAL',['FWRKA0']*3)]:
            if (sprites/(prefix+'A1.png')).exists():continue
            for phase,source in zip('ABCDEFGHIJKLMNOP',sources):shutil.copyfile(sprites/(source+'.png'),sprites/(prefix+phase+'0.png'))
        # The meadow figures of the five, from whichever survivor frames stand in.
        from importlib.machinery import SourceFileLoader
        SourceFileLoader('factory_cast',str(ROOT/'scripts/import-factory-cast.py')).load_module().export_meadow_figures(sprites)
    # Generated puzzle media is optional, like the cast, and wins over fallback
    # sprites on every rebuild. Originals and prompts stay in the local art pack.
    prop_config=ROOT/'art/factory-props-v1/prompts.json'
    if prop_config.exists() and all((prop_config.parent/(s['id']+'-atlas.png')).exists() for s in json.loads(prop_config.read_text())):
        from importlib.machinery import SourceFileLoader
        props=SourceFileLoader('factory_props',str(ROOT/'scripts/import-factory-props.py')).load_module()
        props.main()
    # Ajeya's dolls: the optional v2 animation pack, else the v1 side view (2026-10-18).
    from importlib.machinery import SourceFileLoader
    SourceFileLoader('factory_dolls',str(ROOT/'scripts/import-factory-dolls.py')).load_module().main()
    # The way out (2026-10-19): the break-room TV (FTVS) and the octagon's big screen (FTVB).
    # A: standing by with MEG3N.AVI; B and C: live, two beats of her dance (her imported
    # dance frames when the cast pack is present, else a simple doll silhouette).
    def dancer(letter,height):
        frame=sprites/f'FMGN{letter}1.png'
        if frame.exists():
            im=Image.open(frame).convert('RGBA');im=im.crop(im.getbbox())
            return im.resize((max(1,round(im.width*height/im.height)),height),Image.Resampling.NEAREST)
        im=Image.new('RGBA',(height//2,height));d=ImageDraw.Draw(im);w=height//2
        d.ellipse((w*.2,0,w*.8,height*.3),fill='#f2c879');d.polygon([(w*.1,height),(w*.9,height),(w*.6,height*.3),(w*.4,height*.3)],fill='#d9b38c')
        return im if letter=='D' else ImageOps.mirror(im)
    def screen(name,size,box,live,label,views):
        im=Image.new('RGBA',size);d=ImageDraw.Draw(im);w,h=size
        d.rounded_rectangle((0,0,w-1,h-1),radius=6,fill=PINK,outline=INK,width=2)
        d.rectangle(box,fill='#1b1530' if not live else '#f7a1c4',outline=INK,width=2)
        x0,y0,x1,y1=box
        if live:
            fig=dancer('D' if live==1 else 'E',y1-y0-6);im.alpha_composite(fig,((x0+x1-fig.width)//2,y1-2-fig.height))
            d.ellipse((x0+3,y0+3,x0+8,y0+8),fill='#e03131');d.text((x0+10,y0+1),'LIVE',font=font,fill=INK)
            if views:d.text((x1-50,y1-12),views,font=font,fill=INK)
        else:
            d.polygon([((x0+x1)//2-6,(y0+y1)//2-7),((x0+x1)//2-6,(y0+y1)//2+7),((x0+x1)//2+7,(y0+y1)//2)],fill=CREAM)
            d.text((x0+3,y1-12),label,font=font,fill=CREAM)
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',w//2,h))
        im.save(sprites/f'{name}.png',pnginfo=meta)
    for frame,live in zip('ABC',[0,1,2]):
        screen(f'FTVS{frame}0',(64,48),(6,6,57,41),live,'MEG3N.AVI','')
        screen(f'FTVB{frame}0',(128,80),(8,8,119,71),live,'MEG3N.AVI  dance.avi','1.2M VIEWS' if live==1 else '9.8M VIEWS')
    # MEG3N's live feeds (2026-10-20, PDFactoryScreen): small wall screens showing her front
    # view as she is right now. FSCR A-P follow her own frames (PDFactoryGuardian.Frame: idle,
    # walk, dance, stunned, the watched poses, the flipped dance beats); Q is smashed.
    def her(letter,height):
        for rotation in '10':
            path=sprites/f'FMGN{letter}{rotation}.png'
            if path.exists():
                im=Image.open(path).convert('RGBA');im=im.crop(im.getbbox())
                return im.resize((max(1,round(im.width*height/im.height)),height),Image.Resampling.NEAREST)
        return dancer('D',height)
    def feed(name,letter):
        w,h=44,36;x0,y0,x1,y1=3,3,40,30
        im=Image.new('RGBA',(w,h));d=ImageDraw.Draw(im)
        d.rounded_rectangle((0,0,w-1,h-4),radius=4,fill=PINK,outline=INK)
        d.rectangle((18,h-4,25,h-1),fill=INK)  # wall bracket
        d.rectangle((x0,y0,x1,y1),fill='#f7a1c4')
        for y in range(y0+1,y1,2):d.line((x0,y,x1,y),fill='#f08cb6')  # scanlines
        if letter:
            fig=her(letter,y1-y0-3);fig=fig.crop((max(0,(fig.width-(x1-x0-1))//2),0,max(0,(fig.width-(x1-x0-1))//2)+min(fig.width,x1-x0-1),fig.height))
            im.alpha_composite(fig,((x0+x1+1-fig.width)//2,y1-fig.height))
            d.ellipse((x0+2,y0+2,x0+5,y0+5),fill='#e03131')  # recording
        else:
            # Smashed: the picture dies to black, a star of cracks from where it was hit.
            d.rectangle((x0,y0,x1,y1),fill='#140f22')
            cx,cy=24,14;rng=random.Random(7)
            for k in range(9):
                a=k*2*math.pi/9+rng.uniform(-.25,.25);r=rng.uniform(12,24)
                d.line((cx,cy,cx+math.cos(a)*r,cy+math.sin(a)*r),fill='#cfc8e6')
            d.polygon([(cx-3,cy-2),(cx+3,cy-3),(cx+4,cy+2),(cx-2,cy+4)],fill='#000000')
            d.rectangle((x0,y0,x1,y1),outline=INK)
        d.rectangle((x0-1,y0-1,x1+1,y1+1),outline=INK)
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',w//2,h))
        im.save(sprites/f'{name}.png',pnginfo=meta)
    for i,letter in enumerate('ABCDEFGHIJKLMNOP'):feed(f'FSCR{letter}0',letter)
    feed('FSCRQ0',None)

if __name__=='__main__':build()
