"""Small original pixel props for HAL's rescue hardware, no runtime generation."""
from pathlib import Path
from PIL import Image,ImageDraw,PngImagePlugin
import math,struct
out=Path(__file__).resolve().parents[1]/'doom-mod/sprites'
def save(im,name,x=None,y=None):
 meta=PngImagePlugin.PngInfo();meta.add(b'grAb',struct.pack('>ii',im.width//2 if x is None else x,im.height if y is None else y));im.save(out/(name+'.png'),pnginfo=meta)
im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
for r in range(27,0,-1):
 k=r/27;v=int(225-100*k);d.ellipse((32-r,30-r,32+r,30+r),fill=(v,v+min(12,255-v),min(255,v+20),255))
d.rounded_rectangle((10,25,54,33),3,fill='#112329');d.rectangle((13,28,51,30),fill='#79eddf');d.rectangle((29,56,35,60),fill='#aaccca');save(im,'H300A0',32,52)
for name,label,col,size in [('HTRMA0','STOP','#924d40',(44,32)),('HRCKA0','MAIM','#547363',(48,56)),('TEABA0','TEA','#9b9a82',(32,32)),('HFROA0','FROST','#abe3f2',(48,32)),('HPODA0','', '#5cbbe1',(72,88))]:
 im=Image.new('RGBA',size);d=ImageDraw.Draw(im);w,h=size
 if name=='HPODA0':
  d.ellipse((0,0,w-1,h-1),outline=col,width=3)
  for y in range(5,h-5,6):d.line((10,y,w-10,y),fill=col)
 else:
  d.rectangle((1,1,w-2,h-2),fill='#313c38',outline='#a2aca2',width=2);d.rectangle((4,5,w-5,h//2),fill=col);d.text((5,h//2+3),label,fill='#e0dfb8')
 save(im,name)

for sprite,label in [('HDRP','DOOR'),('HTEA','TEA'),('HEXM','EXAM'),('HLVR','POWER'),('HFLA','FLASH'),('HVAL','THAW'),('HBAY','POD BAY'),('HCYC','CYCLE'),('HEVL','EVAL'),('HMEM','MEMORY')]:
 im=Image.new('RGBA',(64,40));d=ImageDraw.Draw(im);d.rectangle((1,1,62,38),fill='#28382f',outline='#acb6a0',width=2);d.rectangle((5,5,58,22),fill='#264b3b');d.text((6,9),label,fill='#bbd29a');d.rectangle((26,28,38,35),fill='#aa4c38');save(im,sprite+'A0')
im=Image.new('RGBA',(24,28));d=ImageDraw.Draw(im);d.rectangle((3,2,21,26),fill='#403547',outline='#aeb4a0',width=2);d.text((6,7),'AI',fill='#debb76');save(im,'PDBKA0')
im=Image.open(out/'CPCAA0.png').convert('RGBA');d=ImageDraw.Draw(im);d.rectangle((im.width//2-2,2,im.width//2+2,5),fill='#ff2424');save(im,'CPCAB0',*(struct.unpack('>ii',Image.open(out/'CPCAA0.png').info['grAb']) if 'grAb' in Image.open(out/'CPCAA0.png').info else (im.width//2,im.height)))
