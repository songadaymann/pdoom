"""Small native Doom-palette panels with distinct feed, gate and bridge icons."""
from pathlib import Path
import struct
from PIL import Image, ImageDraw, PngImagePlugin


def build_assets(root):
    out=root/'doom-mod/sprites'
    def save(im,name,flat=False):
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2,im.height//2 if flat else im.height))
        im.save(out/(name+'.png'),pnginfo=meta)
    for name,icon in [('PHFP','feed'),('PHCT','control'),('PHGT','gate'),('PHBG','bridge')]:
        for frame,on in [('A',False),('B',True)]:
            im=Image.new('RGBA',(32,40));d=ImageDraw.Draw(im)
            d.rectangle((0,0,31,39),fill='#232823');d.rectangle((2,2,29,37),fill='#6c7066')
            d.line((2,2,29,2),fill='#b8b59b');d.line((2,2,2,37),fill='#9b9d89')
            for x,y in [(4,4),(26,4),(4,33),(26,33)]:d.rectangle((x,y,x+1,y+1),fill='#212922')
            d.rectangle((7,8,24,27),fill='#20271f');c='#a3ba6c' if on else '#958459'
            if icon=='feed':d.polygon([(18,10),(11,18),(16,18),(13,25),(22,16),(17,16)],fill=c)
            elif icon=='gate':
                d.rectangle((10,11,21,24),outline=c,width=2)
                for x in (13,17):d.line((x,12,x,23),fill=c)
            else:
                d.line((9,22,22,22),fill=c,width=2);d.line((10,22,10,25),fill=c);d.line((21,22,21,25),fill=c)
                d.polygon([(12,16),(16,11),(20,16)],fill=c);d.line((16,12,16,20),fill=c,width=2)
            d.rectangle((10,30,21,32),fill='#72ac42' if on else '#ac392a')
            save(im,name+frame+'0')
    for frame,on in [('A',False),('B',True)]:
        im=Image.new('RGBA',(16,8));d=ImageDraw.Draw(im)
        d.rectangle((0,1,15,6),fill='#252920');d.line((0,1,15,1),fill='#939075')
        d.line((0,3,15,3),fill='#cfad45' if on else '#826c38',width=2);d.line((0,6,15,6),fill='#181d18')
        save(im,'PHCB'+frame+'0',True)


if __name__=='__main__':build_assets(Path(__file__).resolve().parents[1])
