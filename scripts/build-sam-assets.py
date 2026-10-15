#!/usr/bin/env python3
"""Original low-resolution maintenance shutter, junction and conduit art."""
from pathlib import Path
import struct
from PIL import Image,ImageDraw,PngImagePlugin
ROOT=Path(__file__).resolve().parents[1]
SPRITES=ROOT/'doom-mod/sprites';PATCHES=ROOT/'doom-mod/patches'
def save(im,name):
    meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2,im.height))
    im.save(SPRITES/(name+'.png'),pnginfo=meta)
im=Image.new('RGBA',(128,64),'#41433c');d=ImageDraw.Draw(im)
for y in range(0,64,8):
    d.rectangle((6,y,121,y+6),fill='#6b6f67');d.line((6,y,121,y),fill='#93978a');d.line((6,y+7,121,y+7),fill='#232823')
for x in (0,122):
    d.rectangle((x,0,x+5,63),fill='#282b27')
    for y in range(0,64,12):d.polygon([(x,y),(x+5,y+5),(x+5,y+10),(x,y+5)],fill='#b5a03b')
d.rectangle((48,19,79,43),fill='#2c3029');d.rectangle((53,24,74,38),outline='#aaa16c',width=2)
d.arc((57,20,70,32),180,360,fill='#c1b783',width=2);d.rectangle((59,28,68,36),fill='#b44430')
im.save(PATCHES/'sam-shutter.png')
texture_file=ROOT/'doom-mod/TEXTURES'
base=texture_file.read_text().partition('// Sam maintenance shutter.')[0].rstrip()
texture_file.write_text(base+'\n\n// Sam maintenance shutter.\nTexture PDSHUT, 128, 64\n{\n    Patch \"patches/sam-shutter.png\", 0, 0\n}\n')
for frame,broken,led in [('A',False,'#eeb641'),('C',False,'#c24b28'),('B',True,'#3d392b')]:
    im=Image.new('RGBA',(40,32));d=ImageDraw.Draw(im)
    d.rectangle((0,0,39,31),fill='#242c28');d.rectangle((2,2,37,29),fill='#74776a')
    d.line((2,2,37,2),fill='#bac0aa');d.line((2,2,2,29),fill='#a0a690')
    for x,y in [(4,4),(35,4),(4,27),(35,27)]:d.rectangle((x,y,x+1,y+1),fill='#252c26')
    d.rectangle((8,7,31,24),fill='#343a30');d.rectangle((10,9,29,21),fill='#161e19')
    for x,c in [(13,'#b47728'),(20,'#a8462d'),(26,'#848a6f')]:d.line((x,9,x-3 if broken else x,21),fill=c,width=2)
    if not broken:
        d.line((6,5,18,13,15,19,28,27),fill='#191c17',width=2)
        d.polygon([(20,9),(15,16),(20,16),(17,23),(25,14),(20,14)],fill='#cba436')
    else:d.polygon([(9,6),(27,8),(31,19),(21,26),(8,23)],outline='#131d17')
    d.rectangle((32,10,35,13),fill=led)
    save(im,'CPSJ'+frame+'0')
# A = outside shutter plate. The inside latch (B/D blink while Eliezer is locked in, C = his
# cell door open) carries a CELL DOOR plate whose arrow points east at the front door it opens
# (2026-10-13): players came in through the shutter and could not tell what the latch did.
from importlib.machinery import SourceFileLoader
lettering=SourceFileLoader('doom_text',str(Path(__file__).with_name('doom-text.py'))).load_module().DoomText(ROOT/'doom-web/local/DOOM.WAD')
HIRES=ROOT/'doom-mod/hires';HIRES.mkdir(exist_ok=True)
for frame,inside,lamp,opened in [('A',False,None,False),('B',True,'#e8492c',False),('D',True,'#5a2a20',False),('C',True,'#8be05a',True)]:
    im=Image.new('RGBA',(60 if inside else 28,32));d=ImageDraw.Draw(im)
    d.rectangle((0,0,27,31),fill='#27302b');d.rectangle((2,2,25,29),fill='#71776b')
    d.line((2,2,25,2),fill='#bec0a3');d.rectangle((6,6,21,24),fill='#222e25')
    if inside:
        d.ellipse((7,7,20,20),outline='#b6b58d',width=2)
        d.line((13,14,19,21) if opened else (13,14,19,7),fill='#a2be74',width=4)
        d.rectangle((10,25,17,28),fill=lamp)
        d.rectangle((29,2,59,29),fill='#28241d',outline='#76684c')
        arrow='#a4dd68' if opened else '#efd397'
        d.rectangle((34,21,50,23),fill=arrow);d.polygon([(50,18),(56,22),(50,26)],fill=arrow)
    else:
        d.arc((8,7,19,18),180,360,fill='#c3b984',width=2);d.rectangle((8,13,19,23),fill='#a3422d');d.rectangle((13,16,14,20),fill='#242520')
    # The handle stays centred on the thing, so the plate reaches east along the wall.
    meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',14,im.height))
    im.save(SPRITES/('CPSL'+frame+'0.png'),pnginfo=meta)
    if inside:
        big=lettering.hires(im,[{'lines':['CELL','DOOR'],'cx':44,'cy':10.5,'room':29,'height':15,'colour':'#efd397'}])
        lettering.save_hires(big,HIRES/('CPSL'+frame+'0.png'),(14*4,im.height*4))
for frame,on in [('A',True),('B',False)]:
    im=Image.new('RGBA',(16,6));d=ImageDraw.Draw(im)
    d.rectangle((0,1,15,5),fill='#202923');d.line((0,1,15,1),fill='#8b8c70');d.line((0,3,15,3),fill='#cca337' if on else '#756842',width=2)
    d.line((0,5,15,5),fill='#3e3520')
    save(im,'CPSC'+frame+'0')
print('Built original maintenance shutter, cable, junction and cell-door latch assets.')
