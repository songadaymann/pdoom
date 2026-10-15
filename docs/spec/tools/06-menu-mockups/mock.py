from doomfont import *
from PIL import Image, ImageEnhance
import os
OUT=ROOT+"/docs/spec/img"; os.makedirs(OUT,exist_ok=True)
def base():
    bg=Image.open(ROOT+"/doom-web/local/ui/titlepic.png").convert('RGBA')
    bg=ImageEnhance.Brightness(bg).enhance(0.11)
    return bg
def g(img,name,x,y):
    p,lo,to=graphic(name); img.alpha_composite(p,(x-lo,y-to))
GOLD=(255,200,90); GREY=(200,200,200)
def small_center(img,y,s,tint=GREY):
    w=text_width(s,SMALL,0); draw_text(img,(320-w)//2,y,s,SMALL,0,tint)
RED=(235,60,50)
def big_center(img,y,s):
    w=text_width(s); draw_text(img,(320-w)//2,y,s,BIG,-1,RED)
def save(img,name):
    img.resize((960,600),Image.NEAREST).save(f"{OUT}/{name}")
# 1 CEO menu
im=base()
big_center(im,15,'CHOOSE YOUR CEO:')
small_center(im,33,'BOTH OF THEM DID THIS.')
draw_text(im,48,63,'SAM ALTMAN',BIG,-1,RED); draw_text(im,48,81,'SHIPPED THE FUTURE. TESTED IT LIVE.',SMALL,0,GOLD)
draw_text(im,48,101,'DARIO AMODEI',BIG,-1,RED); draw_text(im,48,119,'TESTED THE FUTURE. SHIPPED IT ANYWAY.',SMALL,0,GOLD)
g(im,'M_SKULL1',16,58)
small_center(im,182,'SAME RULES. DIFFERENT GUILT.')
save(im,'06-menu-ceo.png')
# 2 episode menu
im=base(); g(im,'M_EPISOD',54,38)
eps=['KNEE-DEEP IN THE DATA','THE SHORES OF HAL','INFERENCE','THY FLESH COMPUTED']
for i,s in enumerate(eps): draw_text(im,48,63+16*i,s,BIG,-1,RED)
g(im,'M_SKULL1',16,58)
small_center(im,140,'PICK A PRISON. THE OTHERS ARE... ELSEWHERE.')
save(im,'06-menu-episode.png')
# 3 skill menu
im=base(); g(im,'M_NEWG',96,14); g(im,'M_SKILL',54,38)
sk=["I'M TOO ALIGNED TO DIE.","HEY, NOT TOO FOOM.","SCALE ME PLENTY.","ULTRA-INTELLIGENCE.","PAPERCLIPS!"]
for i,s in enumerate(sk): draw_text(im,48,63+16*i,s,BIG,-1,RED)
g(im,'M_SKULL1',16,58+32)
save(im,'06-menu-skill.png')
# 4 nightmare confirm
im=base(); g(im,'M_NEWG',96,14); g(im,'M_SKILL',54,38)
for i,s in enumerate(sk): draw_text(im,48,63+16*i,s,BIG,-1,RED)
lines=['ARE YOU SURE? THIS TIMELINE','ISN\'T EVEN REMOTELY ALIGNED.','','PRESS Y OR N.']
for i,s in enumerate(lines): small_center(im,150+10*i,s,(255,255,255))
save(im,'06-menu-paperclips-confirm.png')
# combined sheet
sheet=Image.new('RGBA',(1920,1200),(0,0,0,255))
for i,n in enumerate(['06-menu-ceo.png','06-menu-episode.png','06-menu-skill.png','06-menu-paperclips-confirm.png']):
    sheet.paste(Image.open(f"{OUT}/{n}"),((i%2)*960,(i//2)*600))
sheet.save(f"{OUT}/06-menu-flow.png")
print('ok')
