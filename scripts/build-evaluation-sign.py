"""Doom-pixel beadboard sandwich sign: two readable faces and side supports."""
from PIL import Image,ImageDraw,ImageFont,PngImagePlugin
import struct
def build(root):
    sprites=root/'doom-mod/sprites'
    from pathlib import Path
    from importlib.machinery import SourceFileLoader
    # Lettering in the WAD's own glyphs on 4x hires/ copies (2026-10-13); the 1x TTF text
    # below is only a fallback (at 6-8 px it mangled "EVALUATION").
    lettering=SourceFileLoader('doom_text',str(Path(__file__).with_name('doom-text.py'))).load_module().DoomText(root/'doom-web/local/DOOM.WAD')
    def save(im,name,clean=None,blocks=()):
        meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2,im.height));im.save(sprites/(name+'.png'),pnginfo=meta)
        if blocks:lettering.save_hires(lettering.hires(clean,blocks),root/'doom-mod/hires'/(name+'.png'),(im.width*2,im.height*4))
    font_path=str(root/'doom-web/local/ui/doom-small.ttf')
    for frame in 'AB':
        im=Image.new('RGBA',(80,80));d=ImageDraw.Draw(im)
        # Painted horizontal boards, framed in worn dark wood, on stout feet.
        d.rectangle((3,3,76,66),fill='#40352c',outline='#83735b')
        d.rectangle((7,7,72,62),fill='#d6cdb4')
        for y in range(8,62,8):
            d.line((8,y,71,y),fill='#b1a991');d.line((8,y+1,71,y+1),fill='#eee4c9')
        d.rectangle((3,67,10,79),fill='#675643');d.rectangle((69,67,76,79),fill='#675643')
        d.line((4,67,4,78),fill='#a18965');d.line((70,67,70,78),fill='#a18965')
        d.rectangle((1,77,12,79),fill='#302a24');d.rectangle((67,77,78,79),fill='#302a24')
        d.rectangle((28,0,51,2),fill='#b49d70')
        if frame=='B':d.rectangle((14,64,65,66),fill='#76a451')
        clean=im.copy();blocks=[]
        for text,y,size,color in [('UNDER',13,7,'#4e4538'),('EVALUATION',28,7,'#832f25'),('PLEASE',44,6,'#4e4538'),('BEHAVE',53,6,'#4e4538')]:
            font=ImageFont.truetype(font_path,size)
            if d.textlength(text,font=font)>62:font=ImageFont.truetype(font_path,6)
            d.text((40-d.textlength(text,font=font)/2,y),text,font=font,fill=color)
            blocks.append({'lines':[text],'cx':40,'cy':y+3.5,'room':62,'colour':color,'edge':None})
        save(im,'HEVL'+frame+'0',clean,blocks)
        side=Image.new('RGBA',(28,80));d=ImageDraw.Draw(side)
        d.polygon([(0,79),(10,2),(17,2),(27,79),(21,79),(14,14),(7,79)],fill='#594a39')
        d.line((2,77,12,4),fill='#a38b67',width=2);d.line((16,4,25,77),fill='#786246',width=2)
        d.rectangle((6,55,21,58),fill='#b4a17a');d.rectangle((11,0,16,3),fill='#b9a67e')
        save(side,'HEVS'+frame+'0')

    # In-world policy makes the sign's effect legible before the first use.
    # These are native pixel assets, fixed flush against a real map wall.
    for frame in 'AB':
        im=Image.new('RGBA',(128,48));d=ImageDraw.Draw(im)
        d.rectangle((0,0,127,47),fill='#292b28',outline='#898573',width=2)
        d.rectangle((4,4,123,13),fill='#516342' if frame=='B' else '#733b2b')
        font=ImageFont.truetype(font_path,8)
        clean=im.copy()
        lines=[('SAFETY EVALUATION',5),('OPEN ALL DOORS',17),('HELP THE INSPECTORS',28),('ACTIONS RECORDED',39)]
        for text,y in lines:
            d.text((64-d.textlength(text,font=font)/2,y),text,font=font,fill='#eee0b7')
        save(im,'HEVN'+frame+'0',clean,[{'lines':[text],'cx':64,'cy':y+4,'room':120,'colour':'#eee0b7'} for text,y in lines])
