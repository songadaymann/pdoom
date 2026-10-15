#!/usr/bin/env python3
"""Prepare generated camera cutouts and code-native tool sprites for Doom."""
from pathlib import Path
import struct
from PIL import Image, ImageDraw, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / 'doom-mod/sprites'
SPRITES.mkdir(exist_ok=True)


def save(im, name, centered=False):
    meta = PngImagePlugin.PngInfo()
    meta.add(b'grAb', struct.pack('>ii', im.width // 2, im.height // 2 if centered else im.height))
    im.save(SPRITES / (name + '.png'), pnginfo=meta)


for source, name in [('camera-source.png', 'CPCAA0'), ('camera-broken-source.png', 'CPCBA0')]:
    im = Image.open(ROOT / 'art/checkpoint' / source).convert('RGBA')
    mask = im.getchannel('A').point(lambda a: 255 if a > 200 else 0)
    im = im.crop(mask.getbbox())
    im.thumbnail((48, 44), Image.Resampling.LANCZOS)
    # Sprite import is deterministic cropping/downsampling, not a repaint.
    canvas = Image.new('RGBA', (48, 44)); canvas.alpha_composite(im, ((48-im.width)//2, 44-im.height))
    save(canvas, name)

im = Image.new('RGBA', (24, 36)); d = ImageDraw.Draw(im)
d.polygon([(9,12),(12,11),(18,29),(19,33),(17,35),(14,34)], fill='#494a43')
d.line([(10,13),(17,32)], fill='#c1c1aa', width=3)
d.polygon([(4,1),(7,0),(7,7),(11,10),(15,7),(14,0),(18,2),(20,8),(17,14),(11,16),(6,12),(3,7)], fill='#777b74')
d.line([(5,2),(5,7),(9,12),(15,12),(18,8)], fill='#d3d3bc', width=2)
d.line([(8,2),(8,7),(11,9),(14,6),(14,1)], fill='#2b2d29', width=1)
d.ellipse((15,30,17,32), fill='#20251d')
save(im, 'CPWRA0')
flight = Image.new('RGBA', (36,36)); flight.alpha_composite(im, (6,0)); save(flight, 'CPWFA0', True)
im.save(ROOT / 'doom-web/wrench.png')

im = Image.new('RGBA',(24,28)); d=ImageDraw.Draw(im)
d.arc((4,1,19,18),180,360,fill='#b2aca0',width=4);d.line((4,8,4,14),fill='#ded2ba',width=3);d.line((19,8,19,14),fill='#625f57',width=3)
d.rectangle((2,12,21,27),fill='#53472c');d.rectangle((3,13,20,24),fill='#b4a363');d.line((4,14,18,14),fill='#e0d293',width=2);d.ellipse((10,17,14,21),fill='#232722');d.rectangle((11,20,13,24),fill='#232722')
save(im,'CPLKA0')

im=Image.new('RGBA',(24,32));d=ImageDraw.Draw(im)
d.rectangle((2,1,21,31),fill='#292e28');d.rectangle((3,2,19,29),fill='#969990');d.line((4,3,18,3),fill='#d0d1b9',width=2)
d.rectangle((7,6,16,12),fill='#264e32');d.rectangle((9,7,14,10),fill='#8ab777');d.rectangle((9,15,13,25),fill='#363c31');d.rectangle((5,17,17,21),fill='#bb6944')
save(im,'CPRLA0')
print('Prepared camera sprites and wrench/lock/release artwork.')

# Temporary authored machinery sprites; directional barrels make the turret's
# fixed firing lane readable from both the front and the quiet rear approach.
import math
for frame in 'ABC':
    for rotation in range(1,9):
        im=Image.new('RGBA',(48,56));d=ImageDraw.Draw(im)
        angle=math.radians((rotation-1)*45);dx=math.sin(angle)*17;depth=math.cos(angle)
        end=(round(24+dx),round(22+depth*7))
        def barrel():
            d.line([(24,22),end],fill='#202622',width=8)
            d.line([(24,20),(end[0],end[1]-2)],fill='#9d9b83',width=3)
            d.rectangle((end[0]-3,end[1]-3,end[0]+3,end[1]+3),fill='#181d19')
        if depth<0:barrel()
        d.rectangle((11,48,37,54),fill='#252b24');d.line((13,48,35,48),fill='#aaa58b',width=2)
        d.rectangle((20,34,29,48),fill='#555e50');d.line((20,35,20,46),fill='#b3ae8f',width=2)
        d.polygon([(11,17),(35,17),(39,23),(37,36),(13,37),(8,29)],fill='#515c4a')
        d.line([(12,18),(33,18),(36,22)],fill='#c0b99d',width=2)
        d.rectangle((13,24,18,31),fill='#202b23');d.rectangle((14,25,17,28),fill='#6eaa81' if frame=='A' else '#efa84e' if frame=='B' else '#252a23')
        d.line((30,24,35,24),fill='#2c342d',width=2);d.line((30,28,35,28),fill='#2c342d',width=2)
        if depth>=0:barrel()
        if frame=='C':
            d.line((12,18,34,36),fill='#171e18',width=3);d.line((31,18,22,34),fill='#b58147',width=2)
        save(im,f'CPTU{frame}{rotation}')
im=Image.new('RGBA',(24,44));d=ImageDraw.Draw(im)
d.rectangle((3,2,20,43),fill='#44463b');d.rectangle((6,5,17,39),fill='#86775b');d.line((6,6,16,6),fill='#d5c598',width=2)
d.line([(15,8),(10,17),(16,24),(8,34)],fill='#252d24',width=3)
d.rectangle((7,18,17,26),fill='#735032');d.rectangle((8,19,16,22),fill='#d6ad70');save(im,'CPBRA0')
for frame,color in [('A','#8c7445'),('B','#75b178')]:
    im=Image.new('RGBA',(40,40));d=ImageDraw.Draw(im)
    d.rectangle((0,0,39,39),fill='#2b322c');d.rectangle((2,2,37,37),outline='#aaa78d',width=2)
    d.rectangle((5,5,34,34),outline=color,width=3)
    for x in [10,24]:d.rectangle((x,12,x+5,28),fill=color)
    save(im,'CPPD'+frame+'0',True)
im=Image.new('RGBA',(24,32));d=ImageDraw.Draw(im)
d.rectangle((2,1,21,31),fill='#2c352f');d.rectangle((4,3,19,29),fill='#8e9692')
d.rectangle((7,5,16,12),fill='#243e59');d.rectangle((9,6,14,10),fill='#7bb4ce')
d.rectangle((9,16,13,26),fill='#243b48');d.rectangle((5,18,18,21),fill='#bca76c');save(im,'CPERA0')
im=Image.new('RGBA',(12,12));d=ImageDraw.Draw(im)
d.polygon([(1,2),(9,1),(11,6),(8,11),(2,9)],fill='#817251');d.line((2,3,8,2),fill='#b9a383',width=2)
d.line((3,7,7,9),fill='#423e32',width=3);save(im,'CPDBA0',True)
im=Image.new('RGBA',(48,48));d=ImageDraw.Draw(im)
for x,y,r in [(18,17,14),(30,22,15),(16,30,12),(30,33,10),(25,11,9)]:
    d.ellipse((x-r,y-r,x+r,y+r),fill=(93+r,96+r,88+r,180))
for y in range(5,43,3):
    for x in range(5,43,3):
        if im.getpixel((x,y))[3] and (x+y)%4==0:d.rectangle((x,y,x+1,y+1),fill=(80,84,78,150))
save(im,'CPMSA0',True)
print('Prepared directional turret, breach marker, pressure pad, panel, debris and smoke.')
