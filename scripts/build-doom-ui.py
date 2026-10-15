"""Build private UI fonts/title patches from the user's local IWAD.

Outputs remain in ignored local/. No downloaded fonts or public redistribution.
"""
from pathlib import Path
import struct
from PIL import Image, ImageDraw
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parents[1]
blob = (ROOT / 'doom-web/local/DOOM.WAD').read_bytes()
count, directory = struct.unpack_from('<II', blob, 4)
lumps = {}
for i in range(count):
    offset, size, name = struct.unpack_from('<II8s', blob, directory + i * 16)
    lumps[name.rstrip(b'\0').decode()] = blob[offset:offset + size]
palette = lumps['PLAYPAL'][:768]
out = ROOT / 'doom-web/local/ui'
out.mkdir(parents=True, exist_ok=True)

def patch(name):
    data = lumps[name]
    w, h, _, _ = struct.unpack_from('<HHhh', data)
    image = Image.new('RGBA', (w, h))
    for x in range(w):
        pos = struct.unpack_from('<I', data, 8 + x * 4)[0]
        while data[pos] != 255:
            top, length = data[pos:pos + 2]
            for y, color in enumerate(data[pos + 3:pos + 3 + length]):
                if top + y < h:
                    image.putpixel((x, top + y), (*palette[color * 3:color * 3 + 3], 255))
            pos += length + 4
    return image

def ink(image):
    image = image.copy()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x, y))
            if max(r, g, b) < 100: image.putpixel((x, y), (r, g, b, 0))
    return image

def make_font(name, images, pixel):
    fb = FontBuilder(1000, isTTF=True)
    order = ['.notdef', 'space'] + [f'g{code}' for code in images]
    glyphs, metrics = {}, {'.notdef': (500, 0), 'space': (400, 0)}
    for empty in ['.notdef', 'space']:
        glyphs[empty] = TTGlyphPen(None).glyph()
    for code, image in images.items():
        pen = TTGlyphPen(None)
        # Contiguous pixel runs retain the exact bitmap outline at integer scale.
        for y in range(image.height):
            x = 0
            while x < image.width:
                if image.getpixel((x, y))[3] == 0:
                    x += 1
                    continue
                end = x + 1
                while end < image.width and image.getpixel((end, y))[3]: end += 1
                left, right = x * pixel, end * pixel
                bottom, top = (image.height - y - 1) * pixel, (image.height - y) * pixel
                pen.moveTo((left, bottom)); pen.lineTo((left, top))
                pen.lineTo((right, top)); pen.lineTo((right, bottom)); pen.closePath()
                x = end
        glyphs[f'g{code}'] = pen.glyph()
        metrics[f'g{code}'] = ((image.width + 1) * pixel, 0)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({32: 'space', **{code: f'g{code}' for code in images}})
    fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-100)
    fb.setupNameTable({'familyName': name, 'styleName': 'Regular', 'uniqueFontIdentifier': name,
                      'fullName': name, 'psName': name.replace(' ', ''),
                      'copyright': 'Private local font derived from user-supplied Doom IWAD.'})
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-100, usWinAscent=1000, usWinDescent=100)
    fb.setupPost(); fb.setupMaxp(); fb.save(out / (name.replace(' ', '-').lower() + '.ttf'))

small = {}
for code in range(33, 127):
    upper = ord(chr(code).upper())
    key = f'STCFN{upper:03}'
    if key in lumps: small[code] = ink(patch(key))
def symbol(rows):
    image = Image.new('RGBA', (len(rows[0]), len(rows)))
    for y, row in enumerate(rows):
        for x, v in enumerate(row):
            if v == '1': image.putpixel((x, y), (255, 255, 255, 255))
    return image
small[0x2248] = symbol(['000000','011001','100110','000000','011001','100110','000000'])
small[0x00b7] = symbol(['000','000','000','010','000','000','000'])
small[0x2713] = symbol(['000000','000001','000010','100100','011000','000000','000000'])
small[0x00d7] = symbol(['00000','10001','01010','00100','01010','10001','00000'])
small[0x2022] = symbol(['00000','00000','01110','01110','01110','00000','00000'])
for code in [0x2014, 0x2013]: small[code] = symbol(['000000','000000','000000','111111','000000','000000','000000'])
for code in [0x2018, 0x2019]: small[code] = small[39]
make_font('Doom Small', small, 100)
numbers = {48 + i: ink(patch(f'STTNUM{i}')) for i in range(10)}
numbers[37] = ink(patch('STTPRCNT'))
numbers[0x2248] = small[0x2248].resize((14, 16), Image.Resampling.NEAREST)
make_font('Doom Numbers', numbers, 50)
patch('SHTGA0').save(out / 'shotgun.png')

# Claude's selected D1 logo is shared with the intro films. Keep the exact
# transparent asset so rebuilding UI never restores the earlier metal surround.
logo_source = ROOT / 'doom-web/local/intro/title-logo.png'
logo = Image.open(logo_source).convert('RGBA')
(out / 'pdoom-logo.png').write_bytes(logo_source.read_bytes())
flat = lumps['FLOOR4_8']
tile = Image.new('RGBA', (64, 64))
for y in range(64):
    for x in range(64):
        color = flat[y * 64 + x]
        tile.putpixel((x, y), (*palette[color * 3:color * 3 + 3], 255))
backdrop = Image.new('RGBA', (320, 200))
for y in range(0, 200, 64):
    for x in range(0, 320, 64): backdrop.paste(tile, (x, y))
backdrop.save(out / 'interpic.png')
title = backdrop.copy(); title.alpha_composite(Image.new('RGBA', title.size, (0, 0, 0, 140)))
title.alpha_composite(logo, ((title.width - logo.width) // 2, 28))
def words(image, text, y, color):
    glyphs = [small.get(ord(ch)) if ch != ' ' else None for ch in text]
    width = sum(g.width + 1 if g else 4 for g in glyphs)
    x = (image.width - width) // 2
    for glyph in glyphs:
        if glyph:
            colored = Image.new('RGBA', glyph.size, color)
            colored.putalpha(glyph.getchannel('A')); image.alpha_composite(colored, (x, y)); x += glyph.width + 1
        else: x += 4
words(title, 'FIVE PRISONS', 124, (190, 44, 30, 255))
words(title, 'THE LAST HUMAN EXPERIMENT', 143, (181, 151, 100, 255))
title.save(out / 'titlepic.png')
print('Built private Doom bitmap fonts, p(DOOM) logo and title screen in local/ui.')

# Authored onboarding art is delivered at a consistent low pixel density.
patch('M_SKULL1').save(out / 'menu-skull.png')
hero_master = ROOT / 'art/onboarding/title-heroes-original.png'
if hero_master.exists():
    Image.open(hero_master).convert('RGB').resize((640, 400), Image.Resampling.NEAREST).save(out / 'title-heroes.webp', lossless=True)
