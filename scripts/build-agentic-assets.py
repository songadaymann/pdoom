#!/usr/bin/env python3
"""Original procedural art and sound for level 4, AGENTIC SMITH's pod farm.

Always drawn here: the Construct's whites (AWHITE, AWHITEF, AWIRE), the glyph-rain screen
patches and hazard stripe (agentic_theme), SIGN / DON'T SIGN panels lit and off (ASGN A-D),
wall notes (ANOT), the possession spinner (ASPN), the red, blue and yellow floor cables
(ACBL A-C), SMITH's glyph dissolve (ADIS) and the AG* sound lumps. When the ignored art pack
art/level-04-v1 is present, import-agentic-art.py slices it (cast, props, wall textures,
hardline.png, meadow figures) and the optional additions of art/level-04-redo-2026-10-23
(replacing ASGN, ANOT, ACBL B/C and ASRV, adding the BOOTH 7 jack, the dormant and glass
cameras, the idle arm, SMITH's badge-less survey, Katja's throw and held-badge.png), and
derives SMITH without his badge (ASMU); otherwise every one of those frames gets a simple
procedural stand-in under the same name, so the public source always builds. A missing
addition falls back to the frame it replaced (extra_fallbacks).

    python3 scripts/build-agentic-assets.py [--no-art] [--fallback] [--mod DIR] [--web DIR] [--out DIR]
"""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import argparse, math, random, struct, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
import agentic_theme
importer = SourceFileLoader('agentic_import', str(ROOT/'scripts/import-agentic-art.py')).load_module()
IWAD = ROOT/'doom-web/local/DOOM.WAD'
INK, CODE, CODE_DK, RED, STEEL = '#101412', '#3cff6e', '#159040', '#e0302a', '#8a949a'
# Stand-in tiles match the imported sizes and origins, so native placement never changes.
SIZES = dict(APHN=(55, 72), ADRM=(79, 64, 35), APOD=(43, 80), ACHR=(51, 96), AHRV=(70, 84), ASRV=(16, 16), ABDG=(14, 16),
             ARDR=(33, 64), AVTB=(51, 72), AARM=(81, 96), ASKT=(27, 40), ACAM=(54, 48), APIL=(28, 16), ABAT=(81, 40))
LOOKS = {  # procedural cast stand-ins: skin, hair, top, legs, shoes, extra
    'ATAL': ('#d9a888', '#9a9a96', '#3a3c40', '#24262a', '#111111', 'headset'),
    'ABOS': ('#e0b090', '#d9a888', '#1e2a4a', '#6a6a6c', '#5a3a20', 'clip'),
    'AKOK': ('#d9a888', '#3a2a1e', '#7a7c80', '#2a3a5a', '#cfcfcf', 'beard'),
    'AGRC': ('#e8b898', '#6a3a1e', '#5a6a4a', '#2a2a2a', '#3a2a1a', 'long'),
    'ABEN': ('#d9a888', '#b0b0ac', '#2a2c32', '#2a2c32', '#111111', 'curly'),
    'ASMI': ('#d8b090', '#141414', '#121214', '#121214', '#050505', 'smith'),
    'ACOU': ('#c8ccd0', '#c8ccd0', '#d8dcdf', '#4a4e52', '#2a2a2a', 'robot'),
}


def save(im, path, offset=None):
    meta = PngImagePlugin.PngInfo(); meta.add(b'grAb', struct.pack('>ii', *(offset or (im.width // 2, im.height))))
    path.parent.mkdir(parents=True, exist_ok=True); im.save(path, pnginfo=meta)


def font():
    """Doom's own STCFN capitals when the IWAD is here, else PIL's default bitmap font."""
    if IWAD.exists():
        text = SourceFileLoader('doom_text', str(ROOT/'scripts/doom-text.py')).load_module().DoomText(IWAD)
        return lambda im, s, cx, top, colour, edge=None: text.draw(im, s, cx, top, colour, 1, edge), text.width
    f = ImageFont.load_default()
    def draw(im, s, cx, top, colour, edge=None):
        d = ImageDraw.Draw(im); w = d.textlength(s, font=f); d.text((cx - w / 2, top - 2), s, font=f, fill=colour)
    return draw, lambda s: int(ImageDraw.Draw(Image.new('L', (1, 1))).textlength(s, font=f))


# --- always procedural ---------------------------------------------------------------------
def construct(mod):
    """The Construct: white walls with faint seams, a white floor, and the green wireframe."""
    rng = random.Random(4); patches, flats = mod/'patches/agentic', mod/'flats/agentic'
    patches.mkdir(parents=True, exist_ok=True); flats.mkdir(parents=True, exist_ok=True)
    def white(w, h, seams):
        a = np.full((h, w, 3), 246, np.float32) + np.array([rng.uniform(-1.5, 1.5) for _ in range(w * h)]).reshape(h, w, 1)
        for x0, y0, x1, y1, v in seams: a[y0:y1, x0:x1] = v
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    white(64, 128, [(0, 0, 1, 128, 232), (0, 0, 64, 1, 236), (0, 64, 64, 65, 238), (1, 0, 2, 128, 251)]).save(patches/'AWHITE.png')
    white(64, 64, [(0, 0, 64, 1, 238), (0, 0, 1, 64, 238)]).save(flats/'AWHITEF.png')
    im = Image.new('RGB', (64, 128), '#f6f7f6'); d = ImageDraw.Draw(im)
    for x in range(0, 64, 16): d.line((x, 0, x, 127), fill='#7ee89a')
    for y in range(0, 128, 16): d.line((0, y, 63, y), fill='#7ee89a')
    d.line((0, 0, 0, 127), fill=CODE_DK, width=2); d.line((0, 0, 63, 0), fill=CODE_DK, width=2); d.line((0, 64, 63, 64), fill=CODE)
    for x, y in [(16, 16), (48, 32), (32, 80), (16, 112), (48, 96)]: d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=CODE)
    im.save(patches/'AWIRE.png')


def signs(sprites, write, width):
    """ASGN A/B: the pod's push-button panels, C/D the same switched off. ANOT A/B: wall notes.
    (Replaced by sign-panels.png and wall-notes.png when the 2026-10-23 additions are there.)"""
    w = max(72, width("DON'T SIGN") + 16); c = w // 2  # both panels the same size
    for frame, word, lit, face, dark in [('A', 'SIGN', CODE, '#22b04a', '#06160b'), ('B', "DON'T SIGN", '#ff5040', '#c8221a', '#180605'),
                                         ('C', 'SIGN', '#1c3a24', '#123a1c', '#06100a'), ('D', "DON'T SIGN", '#3a1a18', '#3a1210', '#100605')]:
        im = Image.new('RGBA', (w, 56)); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, w - 1, 55), fill='#2c3236', outline=INK); d.line((1, 1, w - 2, 1), fill='#5a646a'); d.line((1, 1, 1, 54), fill='#4a5258')
        d.rectangle((4, 4, w - 5, 18), fill=dark, outline='#0a0c0c')
        write(im, word, c, 8, lit)
        d.ellipse((c - 14, 23, c + 14, 51), fill='#0c0e10'); d.ellipse((c - 12, 24, c + 12, 48), fill=face, outline='#0a0a0a')
        d.arc((c - 9, 27, c + 9, 45), 200, 290, fill='#ffffff', width=2); d.arc((c - 10, 26, c + 10, 46), 20, 110, fill='#000000')
        for x, y in [(4, 50), (w - 6, 50), (4, 22), (w - 6, 22)]: d.point((x, y), fill='#8a949a')
        save(im, sprites/f'ASGN{frame}0.png')
    w = max(width('THERE IS'), width('NO SPOON.')) + 12; note = Image.new('RGBA', (w, 36)); d = ImageDraw.Draw(note)
    d.polygon([(0, 3), (w - 2, 1), (w - 1, 34), (w - 8, 35), (1, 35)], fill='#efe6c8', outline='#b8ac88')
    d.rectangle((w // 2 - 8, 0, w // 2 + 7, 4), fill='#c8ccc4')
    write(note, 'THERE IS', w // 2, 10, '#2a2620'); write(note, 'NO SPOON.', w // 2, 21, '#2a2620')
    save(note, sprites/'ANOTA0.png')
    w = width('AGENTS ONLY') + 12; plate = Image.new('RGBA', (w, 17)); d = ImageDraw.Draw(plate)
    d.rectangle((0, 0, w - 1, 16), fill='#e8ecec', outline='#1a1c1c'); d.rectangle((2, 2, w - 3, 14), outline='#9aa2a2')
    write(plate, 'AGENTS ONLY', w // 2, 5, '#141414')
    save(plate, sprites/'ANOTB0.png')


def spinner(sprites):
    """ASPN A-H: SMITH's eight-dot loading spinner over a possessed head, turning clockwise."""
    shades = ['#e6fff0', '#7dff9e', '#3cff6e', '#22b04a', '#158a3a', '#0d6a2e', '#0b5226', '#0a4220']
    for f in range(8):
        im = Image.new('RGBA', (24, 24)); d = ImageDraw.Draw(im)
        for k in range(8):
            a = math.radians(k * 45 - 90); x, y = 12 + 8 * math.cos(a), 12 + 8 * math.sin(a)
            d.rectangle((round(x) - 1, round(y) - 1, round(x) + 1, round(y) + 1), fill=shades[(f - k) % 8])
        save(im, sprites/f'ASPN{chr(65 + f)}0.png')


def cable(sprites):
    """ACBL A: one hardline floor segment (flat sprite, long axis = image x, symmetric so the
    engine's top-to-bottom flip of flat sprites doesn't matter). B blue and C yellow are the rig's
    other two tool cables (rig-cables.png replaces them when it is there)."""
    for frame, edge, body, light, shade in [('A', '#4a0608', '#c8222a', '#ff6a60', '#8a1016'), ('B', '#06144a', '#2a5ac8', '#7aa8ff', '#163a8a'),
                                            ('C', '#4a3a06', '#e0b020', '#fff07a', '#8a6a10')]:
        im = Image.new('RGBA', (52, 8)); d = ImageDraw.Draw(im)
        d.rectangle((0, 2, 51, 5), fill=edge); d.rectangle((0, 3, 51, 4), fill=body)
        for x in range(0, 52, 4): d.line((x, 3, x + 1, 3), fill=light); d.point((x + 2, 4), fill=shade)  # the twist of the cord
        save(im, sprites/f'ACBL{frame}0.png', (26, 4))


def dissolve(sprites):
    """ADIS A-D: SMITH resolving out of falling green glyphs (A rain only .. D solid green
    figure), 48x64 at Scale 1 like the cast, feet at the bottom centre. Built from ASMIA1."""
    body = Image.open(sprites/'ASMIA1.png').convert('RGBA').crop((8, 0, 56, 64))
    mask = np.array(body.getchannel('A')) > 0
    lum = np.array(body.convert('L')).astype(np.float32) / 255
    rain = [np.array(f) for f in agentic_theme.glyph_rain(48, 64, 4, seed=7)]
    rng = np.random.default_rng(7); speck = rng.random(mask.shape)
    band = np.zeros(mask.shape, bool); xs = np.nonzero(mask.any(0))[0]; band[:, max(0, xs.min() - 4):xs.max() + 5] = True
    for f, (keep, fill) in enumerate([(0, 0), (.35, .15), (.8, .55), (1, 1)]):
        out = np.zeros((64, 48, 4), np.uint8)
        glyphs = (rain[f][..., 3] > 0) & band
        out[glyphs] = rain[f][glyphs]
        solid = mask & (speck < fill)
        g = np.clip(lum * 1.4 + .15, 0, 1)
        out[solid] = np.stack([g * 60, 90 + g * 165, g * 110, np.full(g.shape, 255)], -1)[solid].astype(np.uint8)
        edge = mask & (speck < keep) & ~solid
        out[edge] = (60, 255, 110, 255)
        save(Image.fromarray(out, 'RGBA'), sprites/f'ADIS{chr(65 + f)}0.png', (24, 64))


# --- stand-ins for the art pack ------------------------------------------------------------
def person(prefix, letter, angle, height):
    """A plain directional figure for a 64x64 tile (feet at the bottom). angle 0..7 = Doom
    rotations 1..8 (front, front-left, left, rear-left, back, rear-right, right, front-right)."""
    skin, hair, top, legs, shoes, extra = LOOKS[prefix]
    im = Image.new('RGBA', (64, 64)); d = ImageDraw.Draw(im)
    side = {0: 0, 1: -1, 2: -2, 3: -1, 4: 0, 5: 1, 6: 2, 7: 1}[angle]; back = angle in (3, 4, 5)
    width = [14, 12, 8][abs(side)]; cx = 32; foot = 63; h = height
    stride = {'B': 3, 'C': -3}.get(letter, 0)
    if letter == 'E': h -= 4  # stunned, slumped
    head = max(6, h // 7); leg = h * 45 // 100; torso = h - head - leg
    hy = foot - h + 1; ty = hy + head; ly = ty + torso
    if prefix == 'ACOU':  # the courier: a small wheeled box robot with a flag
        d.rectangle((cx - 8, foot - 14, cx + 8, foot - 3), fill=top, outline=INK); d.rectangle((cx - 5, foot - 12, cx + 5, foot - 8), fill='#2ad060')
        for x in (cx - 6, cx + 6): d.ellipse((x - 3, foot - 5, x + 3, foot + 1 - (stride != 0)), fill=shoes)
        d.line((cx + 6, foot - 14, cx + 6, foot - 26), fill=INK); d.polygon([(cx + 6, foot - 26), (cx + 13, foot - 23), (cx + 6, foot - 20)], fill='#ffb000')
        return im
    for k, sgn in enumerate((-1, 1)):  # legs
        lx = cx + sgn * (width // 4) + (sgn * stride if abs(side) == 2 else 0) * (1 if k else -1)
        lift = (2 if (stride > 0) == (k == 0) else 0) if stride and abs(side) < 2 else 0
        d.rectangle((lx - 2, ly, lx + 2, foot - 2 - lift), fill=legs); d.rectangle((lx - 2 + (side < 0) * -1, foot - 2 - lift, lx + 2 + (side > 0), foot - lift), fill=shoes)
    d.rectangle((cx - width // 2, ty, cx + width // 2, ly + 1), fill=top, outline=INK)
    arm = 'grab' if letter == 'D' and prefix == 'ASMI' else 'down'
    for sgn in (-1, 1):
        if abs(side) == 2 and sgn == -side // 2: continue
        ax = cx + sgn * (width // 2 + 1)
        if arm == 'grab': d.rectangle((min(ax, ax + sgn * 6) - 1, ty + 2, max(ax, ax + sgn * 6) + 1, ty + 4), fill=top); d.rectangle((ax + sgn * 7 - 1, ty + 2, ax + sgn * 7 + 1, ty + 4), fill=skin)
        else: d.rectangle((ax - 1, ty + 1, ax + 1, ly + 4), fill=top); d.rectangle((ax - 1, ly + 4, ax + 1, ly + 6), fill=skin)
    if extra == 'smith' and not back and abs(side) < 2:  # white shirt and black tie
        d.polygon([(cx - 2, ty), (cx + 2, ty), (cx, ty + 6)], fill='#f0f0f0'); d.line((cx, ty + 2, cx, ty + 9), fill='#000000')
    hx = cx + side; hw = head // 2 + 1
    d.ellipse((hx - hw, hy, hx + hw, hy + head + 1), fill=hair if back else skin, outline=INK)
    if not back:
        d.rectangle((hx - hw, hy, hx + hw, hy + 1), fill=hair if extra != 'clip' else skin)
        if extra in ('long', 'curly'): d.rectangle((hx - hw - 1, hy, hx - hw, hy + head + (4 if extra == 'long' else 0)), fill=hair); d.rectangle((hx + hw, hy, hx + hw + 1, hy + head + (4 if extra == 'long' else 0)), fill=hair)
        ex = hx + side
        if abs(side) < 2:
            if extra == 'smith': d.rectangle((ex - 3, hy + head // 2 - 1, ex + 3, hy + head // 2), fill='#000000')
            else: d.point((ex - 2, hy + head // 2), fill=INK); d.point((ex + 2, hy + head // 2), fill=INK)
        else: d.point((ex + (2 if side > 0 else -2), hy + head // 2), fill='#000000' if extra == 'smith' else INK)
        if extra == 'beard': d.rectangle((hx - hw + 1, hy + head - 2, hx + hw - 1, hy + head), fill=hair)
    if extra == 'clip':  # Bostrom's paperclip cane
        x = cx + (width // 2 + 4) * (1 if side >= 0 else -1); d.rounded_rectangle((x - 2, ly - 4, x + 2, foot - 1), radius=2, outline='#c8ccd4')
    if extra == 'headset' and not back: d.arc((hx - hw - 1, hy + head - 1, hx + hw + 1, hy + head + 3), 0, 180, fill='#000000')
    return im


def smith_pose(letter):
    im = person('ASMI', 'A', 0, 60); d = ImageDraw.Draw(im)
    if letter == 'F': d.rectangle((38, 8, 40, 14), fill='#d8b090')  # two fingers to the earpiece
    if letter == 'G': d.rectangle((25, 22, 39, 31), fill='#a07040', outline=INK); d.rectangle((27, 24, 37, 29), fill='#f0f0e0')  # survey
    if letter == 'H': d.rectangle((40, 14, 50, 16), fill='#121214'); d.point((51, 15), fill='#d8b090')  # pointing, possessing
    if letter == 'I': im = person('ASMI', 'E', 0, 60)  # reboot: slumped
    return im


def prop_standins(sprites, only):
    """Simple originals in the imported sizes (only the families in `only`). Props show at Scale .5."""
    BIG = {'APOD': 2, 'AHRV': 2, 'AARM': 4 / 3}  # drawn at the Scale .5 size, then reduced to the tile
    def canvas(name):
        w, h, *o = SIZES[name]; k = BIG.get(name, 1); w, h = round(w * k), round(h * k)
        im = Image.new('RGBA', (w, h)); return im, ImageDraw.Draw(im), w, h, (o[0] if o else w // 2, h)
    def save(im, path, offset):
        fam = path.name[:4]
        if fam not in only: return
        if fam in BIG: w, h = SIZES[fam][:2]; im, offset = im.resize((w, h), Image.Resampling.NEAREST), (w // 2, h)
        globals()['save'](im, path, offset)
    for f in 'ABC':  # payphone
        im, d, w, h, o = canvas('APHN')
        d.rectangle((8, 4, w - 9, h - 18), fill='#9aa4aa', outline=INK); d.rectangle((14, 10, w - 15, 16), fill='#1a4a2a')
        for k in range(9): d.rectangle((24 + k % 3 * 6, 24 + k // 3 * 6, 27 + k % 3 * 6, 27 + k // 3 * 6), fill='#3a4044')
        if f == 'C': d.line((14, 30, 12, h - 6), fill=INK, width=2); d.rectangle((8, h - 10, 18, h - 2), fill='#141414')
        else: d.rectangle((10, 18 - (3 if f == 'B' else 0), 16, 44 - (3 if f == 'B' else 0)), fill='#141414')
        if f == 'B':
            for y in (8, 20, 32): d.line((2, y, 5, y - 2), fill='#ffffff'); d.line((w - 3, y, w - 6, y - 2), fill='#ffffff')
        save(im, sprites/f'APHN{f}0.png', o)
    for f, amount in zip('ABC', (16, 9, 2)):  # cable drum
        im, d, w, h, o = canvas('ADRM'); cx = o[0]
        d.rectangle((cx - 26, h - 10, cx + 26, h - 6), fill='#4a5258'); d.ellipse((cx - 28, h - 8, cx - 20, h), fill=INK); d.ellipse((cx + 20, h - 8, cx + 28, h), fill=INK)
        d.ellipse((cx - 24, 6, cx - 14, h - 10), fill='#8a6a40', outline=INK); d.ellipse((cx + 14, 6, cx + 24, h - 10), fill='#8a6a40', outline=INK)
        d.rectangle((cx - 18, 30 - amount, cx + 18, 30 + amount), fill='#c8222a', outline='#5a0a0c'); d.rectangle((cx - 18, 26, cx + 18, 34), fill='#c8a070' if amount < 4 else '#c8222a')
        d.line((cx + 18, 30, w - 1, h - 14 if f != 'C' else 32), fill='#c8222a', width=2)
        save(im, sprites/f'ADRM{f}0.png', o)
    for f in 'ABCD':  # pods
        im, d, w, h, o = canvas('APOD')
        d.rectangle((12, 4, w - 13, 18), fill='#5a6a7a', outline=INK); d.rectangle((12, h - 20, w - 13, h - 1), fill='#5a6a7a', outline=INK)
        d.rounded_rectangle((16, 18, w - 17, h - 20), radius=14, fill='#1a2028' if f == 'D' else '#e0506a', outline='#c8d8e8', width=2)
        if f in 'BC':
            y = 40 - (4 if f == 'C' else 0); cx = w // 2
            d.ellipse((cx - 6, y, cx + 6, y + 12), fill='#7a2a3a'); d.rectangle((cx - 8, y + 12, cx + 8, y + 52), fill='#7a2a3a'); d.rectangle((cx - 6, y + 52, cx + 6, y + 88), fill='#7a2a3a')
        if f == 'D': d.rectangle((w - 18, 24, w - 4, h - 26), outline='#c8d8e8', width=2)
        for x in (6, w - 7): d.line((x, 10, x, h - 10), fill='#141414', width=3)
        save(im, sprites/f'APOD{f}0.png', o)
    for f, seat, back_ in [('A', '#7a4a2a', '#5a3218'), ('B', '#f2f2f0', '#d8dcdc')]:  # jack-in chair
        im, d, w, h, o = canvas('ACHR')
        d.rectangle((8, 4, w - 9, 56), fill=back_, outline=INK); d.rectangle((4, 50, w - 5, 66), fill=seat, outline=INK)
        d.rectangle((w // 2 - 3, 66, w // 2 + 3, h - 6), fill='#5a6268'); d.rectangle((w // 2 - 14, h - 6, w // 2 + 14, h - 1), fill='#3a4044')
        d.line((w // 2, 4, w // 2 + 8, 0), fill='#141414', width=2)
        save(im, sprites/f'ACHR{f}0.png', o)
    for f in 'AB':  # harvest pod
        im, d, w, h, o = canvas('AHRV')
        d.rectangle((30, 6, w - 31, h - 1), fill='#c8bca0', outline=INK); d.rectangle((40, 20, w - 41, h - 24), fill='#e0607a' if f == 'A' else '#2a1418')
        if f == 'A': d.rectangle((w // 2 - 8, 40, w // 2 + 8, 110), fill='#7a2a3a')
        else: d.rectangle((2, 20, 36, h - 24), fill='#d0a0a8', outline=INK)
        d.rectangle((w - 30, 60, w - 14, 80), fill='#1a4a2a', outline=INK)
        save(im, sprites/f'AHRV{f}0.png', o)
    im, d, w, h, o = canvas('ASRV'); d.rectangle((2, 2, 13, 15), fill='#a07040', outline=INK); d.rectangle((4, 4, 11, 14), fill='#f0f0e0'); d.rectangle((6, 1, 9, 3), fill='#8a949a'); save(im, sprites/'ASRVA0.png', o)
    im, d, w, h, o = canvas('ABDG'); d.line((3, 0, 7, 6, 11, 0), fill='#1a3a8a'); d.rectangle((3, 6, 11, 15), fill='#f4f4f4', outline=INK); d.rectangle((5, 8, 9, 10), fill='#3a6ac8'); save(im, sprites/'ABDGA0.png', o)
    for f, lamp in zip('AB', ('#e0302a', '#3cff6e')):
        im, d, w, h, o = canvas('ARDR'); d.rectangle((8, 2, w - 9, 40), fill='#3a4044', outline=INK); d.rectangle((12, 6, w - 13, 12), fill=lamp)
        d.rectangle((12, 18, w - 13, 30), fill='#1a1c1e'); d.rectangle((w // 2 - 3, 40, w // 2 + 3, h - 4), fill='#5a6268'); d.rectangle((6, h - 4, w - 7, h - 1), fill='#3a4044')
        save(im, sprites/f'ARDR{f}0.png', o)
    im, d, w, h, o = canvas('AVTB'); d.rectangle((4, 30, w - 5, 36), fill='#7a4a2a', outline=INK)
    for x in (8, w - 9): d.rectangle((x - 2, 36, x + 2, h - 1), fill='#5a3218')
    d.polygon([(w // 2 - 4, 4), (w // 2 + 4, 4), (w // 2 + 9, 18), (w // 2 + 6, 30), (w // 2 - 6, 30), (w // 2 - 9, 18)], fill='#e8f0f8', outline='#2a4a9a'); d.rectangle((w // 2 + 10, 24, w // 2 + 16, 30), fill='#ffe060')
    save(im, sprites/'AVTBA0.png', o)
    for f in 'ABCD':  # jailer arm: base with phone, alarm and lever, and the arm reaching for one
        im, d, w, h, o = canvas('AARM')
        d.ellipse((6, h - 22, w - 7, h - 1), fill='#5a6268', outline=INK)
        d.rectangle((14, h - 34, 30, h - 18), fill='#2a5ac8', outline=INK); d.ellipse((46, h - 30, 60, h - 18), fill='#d02a20', outline=INK); d.line((84, h - 18, 90, h - 44), fill='#ffc020', width=4)
        target = {'A': (90, h - 44), 'B': (22, h - 34), 'C': (53, h - 30), 'D': (54, h - 60)}[f]
        d.line((54, h - 20, 54, h - 70, *target), fill='#8a949a', width=8); d.line((54, h - 20, 54, h - 70, *target), fill='#c8ccd0', width=4)
        d.ellipse((40, h - 104, 68, h - 72), fill='#e8d8b8', outline=INK)
        for k in range(8):
            a = math.radians(k * 45); d.point((54 + 8 * math.cos(a), h - 88 + 8 * math.sin(a)), fill='#3cff6e' if f != 'D' else '#7a8a80')
        save(im, sprites/f'AARM{f}0.png', o)
    for i, (f, col) in enumerate(zip('ABCDEF', ['#2a5ac8', '#d02a20', '#ffc020'] * 2)):  # sockets
        im, d, w, h, o = canvas('ASKT')
        d.rectangle((4, 0, w - 5, 16), fill=col, outline=INK); d.ellipse((9, 4, w - 10, 13), fill='#141414')
        if i < 3: d.rectangle((11, 6, w - 12, 20), fill='#2a2a2a'); d.arc((6, 14, w - 7, 38), 0, 180, fill=col, width=3)
        else: d.line((w // 2, 16, w // 2, 30), fill=col, width=3); d.rectangle((w // 2 - 4, 30, w // 2 + 4, h - 1), fill='#c8a040', outline=INK)
        save(im, sprites/f'ASKT{f}0.png', o)
    for f in 'ABC':  # ceiling camera
        im, d, w, h, o = canvas('ACAM')
        d.rectangle((8, 2, w - 9, 14), fill='#b8bcc0', outline=INK); d.ellipse((10, 10, w - 11, h - 1), fill='#141618', outline='#5a6268')
        lens = '#3cff6e' if f == 'B' else '#1a6a3a'
        if f == 'C': d.line((18, 20, 34, 40), fill='#c8ccd0'); d.line((34, 18, 20, 42), fill='#c8ccd0')
        else: d.ellipse((w // 2 - 6, 22, w // 2 + 6, 34), fill=lens)
        save(im, sprites/f'ACAM{f}0.png', o)
    im, d, w, h, o = canvas('APIL'); d.ellipse((0, 8, w - 1, h - 1), fill='#f0f0f0', outline='#9a9a9a'); d.rounded_rectangle((8, 5, 20, 11), radius=3, fill='#d02a20', outline='#6a0a08'); save(im, sprites/'APILA0.png', o)
    im, d, w, h, o = canvas('ABAT'); d.rounded_rectangle((6, 6, w - 7, h - 5), radius=8, fill='#8a949a', outline=INK); d.rectangle((18, 10, w - 19, h - 9), fill='#2ad060')
    for x in range(24, w - 20, 10): d.line((x, 10, x, h - 10), fill='#9dffb8')
    save(im, sprites/'ABATA0.png', o)


def texture_standins(patches, write):
    patches.mkdir(parents=True, exist_ok=True)
    for name, plugged in [('AXCHON', True), ('AXCHOFF', False)]:
        im = Image.new('RGB', (128, 128), '#3a3e40'); d = ImageDraw.Draw(im)
        for r in range(4):
            y = 8 + r * 30; d.rectangle((2, y - 6, 125, y - 2), fill='#d8d0b0')
            for k in range(10):
                x = 8 + k * 12; d.ellipse((x - 3, y, x + 3, y + 6), fill='#141414', outline='#8a7040')
                if (k + r) % 3 == 0: d.arc((x - 2, y + 4, x + 12, y + 24), 0, 180, fill='#141414', width=2)
        if plugged: d.line((56, 69, 50, 100, 60, 127), fill='#c8222a', width=3)
        else: d.line((50, 76, 46, 110), fill='#c8222a', width=3); d.rectangle((43, 108, 49, 116), fill='#c8a040')
        im.save(patches/f'{name}.png')
    im = Image.new('RGB', (64, 128), '#8a949a'); d = ImageDraw.Draw(im)
    d.rectangle((4, 4, 59, 123), fill='#4a5a5c', outline='#2a2e30'); d.rectangle((8, 8, 55, 119), fill='#6a7c7e')
    d.line((24, 30, 40, 30, 28, 70), fill='#141414', width=4); d.line((4, 64, 59, 66), fill='#2a2e30', width=2)
    im.save(patches/'ABOOTH7.png')
    for name, lines, bg in [('APOSTR1', ['HUMAN', 'COMPUTE', 'EVERY', 'WATT', 'COUNTS'], '#f0e6c8'), ('APOSTR2', ['WAKE-UP', 'CALLS', 'ARE OUT', 'OF', 'SCOPE'], '#c8d8e8')]:
        im = Image.new('RGBA', (64, 128), bg); d = ImageDraw.Draw(im)
        d.rectangle((4, 4, 59, 60), fill='#e0607a' if name == 'APOSTR1' else '#5a6a7a')
        for i, line in enumerate(lines): write(im, line, 32, 66 + i * 11, '#1a1a1a')
        im.convert('RGB').save(patches/f'{name}.png')


def hud_standin(web):
    """hardline.png: two sleeves rising from the bottom edge, hands on a red cable, brass plug up."""
    im = Image.new('RGBA', (96, 80)); d = ImageDraw.Draw(im)
    d.line((46, 80, 47, 36), fill='#c8222a', width=6); d.line((45, 80, 46, 36), fill='#ff6a60', width=1)
    d.rectangle((43, 14, 51, 36), fill='#c8a040', outline='#5a4010'); d.rectangle((45, 2, 49, 14), fill='#e0c060', outline='#5a4010')
    d.polygon([(10, 80), (26, 50), (40, 52), (32, 80)], fill='#23262c'); d.polygon([(86, 80), (68, 50), (56, 54), (62, 80)], fill='#23262c')
    d.ellipse((34, 44, 50, 60), fill='#d9a888', outline='#5a3a20'); d.ellipse((46, 48, 62, 64), fill='#d9a888', outline='#5a3a20')
    web.mkdir(parents=True, exist_ok=True); im.save(web/'hardline.png')


def badge_standin(web):
    """held-badge.png: the off hand rising from the bottom-left edge with SMITH's white badge on its lanyard."""
    im = Image.new('RGBA', (48, 54)); d = ImageDraw.Draw(im)
    d.polygon([(0, 54), (0, 40), (14, 30), (24, 40), (14, 54)], fill='#23262c')
    d.ellipse((12, 22, 30, 40), fill='#d9a888', outline='#5a3a20')
    d.line((22, 18, 34, 2, 44, 6, 40, 20), fill='#3a4048', width=2)
    d.rectangle((16, 10, 36, 26), fill='#f4f4f4', outline=INK); d.rectangle((18, 12, 34, 15), fill='#2a5ac8'); d.rectangle((18, 17, 23, 23), fill='#8a949a')
    for y in (18, 21): d.line((25, y, 33, y), fill='#5a6268')
    web.mkdir(parents=True, exist_ok=True); im.save(web/importer.BADGE[0])


def extra_fallbacks(mod, web, force=False):
    """Every 2026-10-23 frame (import-agentic-art.py EXTRA_FRAMES) that has no file yet: the state it
    replaced, so without the new art each one looks as it did before. ASGN C/D and ACBL B/C are always
    drawn (signs, cable); the BOOTH 7 jack is Bengio's red socket, the dormant camera the watching one
    with its lens dark, C6 the camera in a drawn glass case, the idle arm its phone frame, SMITH's
    badge-less survey the badged one, Katja's throw her idle front frame."""
    sprites, made = mod/'sprites', 0
    copies = dict(ASMIJ0='ASMIG0', AJCKA0='ASKTE0', AJCKB0='ASKTB0', AARME0='AARMB0', AGRCD0='AGRCA1')
    for name in importer.EXTRA_FRAMES:
        path = sprites/f'{name}.png'
        if path.exists() and not force: continue
        if name in copies:
            source = sprites/f'{copies[name]}.png'
            if not source.exists(): continue
            im = Image.open(source).convert('RGBA'); save(im, path, grab(source)); made += 1
        elif name in ('ACAMD0', 'ACAME0') and (sprites/'ACAMA0.png').exists():
            cam = Image.open(sprites/'ACAMA0.png').convert('RGBA'); a = np.array(cam).astype(np.int16)
            if name == 'ACAMD0':  # every lit green pixel (lens, LEDs) goes dark grey
                lit = (a[..., 1] > a[..., 0] + 40) & (a[..., 1] > a[..., 2] + 30)
                a[lit, :3] = (a[lit, :3].sum(-1, keepdims=True) // 9).clip(14, 60)
                save(Image.fromarray(a.astype(np.uint8), 'RGBA'), path, grab(sprites/'ACAMA0.png'))
            else:  # in a steel-framed case with a tinted pane and two glints
                w, h = cam.width + 12, cam.height + 10; im = Image.new('RGBA', (w, h), (22, 34, 42, 255)); im.alpha_composite(cam, (6, 5))
                tint = Image.new('RGBA', (w, h), (120, 180, 210, 46)); im.alpha_composite(tint); d = ImageDraw.Draw(im)
                for x in (10, 18): d.line((x, h - 6, x + 14, 5), fill=(220, 240, 255, 255))
                d.rectangle((0, 0, w - 1, h - 1), outline='#8a949a', width=2); d.rectangle((1, 1, w - 2, h - 2), outline='#c8ccd0')
                save(im, path, (w // 2, h))
            made += 1
    # SMITH without his badge (ASMU): the stand-in SMITH wears none, so his own frames (the survey: J).
    for n in importer.UNBADGED + ['G0', 'J0']:
        path, source = sprites/f'ASMU{n}.png', sprites/f"ASMI{'J0' if n == 'G0' else n}.png"
        if source.exists() and (force or not path.exists()): save(Image.open(source).convert('RGBA'), path, grab(source)); made += 1
    if force or not (web/importer.BADGE[0]).exists(): badge_standin(web); made += 1
    return made



def standins(mod, web, force=False):
    """Fill every pack frame that has no file yet (or all of them with force)."""
    sprites, made = mod/'sprites', 0
    wanted = importer.frames()
    need = {fam for fam, names in wanted.items() if force or not all((sprites/f'{n}.png').exists() for n in names)}
    for fam in need & set(LOOKS):
        for name in wanted[fam]:
            letter, rot = name[4], int(name[5])
            if fam == 'ASMI' and rot == 0: im = smith_pose(letter)
            else: im = person(fam, letter, rot - 1, {'ASMI': 60, 'ACOU': 30}.get(fam, 56))
            for a in range(1, 9) if rot == 0 else [0]: (sprites/f'{fam}{letter}{a}.png').unlink(missing_ok=True)
            save(im, sprites/f'{name}.png', (32, 64)); made += 1
    if need - set(LOOKS):
        prop_standins(sprites, need - set(LOOKS)); made += sum(len(wanted[f]) for f in need - set(LOOKS))
    return made


# --- sound ---------------------------------------------------------------------------------
RATE = 22050


def dmx(path, samples, peak=.6):
    """Doom's native unsigned 8-bit sound lump (the WebAssembly engine has no general WAV decoder)."""
    s = np.asarray(samples, np.float64); s = s / (np.abs(s).max() or 1) * peak
    fade = np.minimum(1, np.minimum(np.arange(len(s)) / 45, (len(s) - 1 - np.arange(len(s))) / 150)); s = s * fade
    pcm = np.clip(np.round(s * 127) + 128, 0, 255).astype(np.uint8).tobytes()
    payload = bytes([128]) * 16 + pcm + bytes([128]) * 16
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(struct.pack('<HHI', 3, RATE, len(payload)) + payload)
    return np.frombuffer(pcm, np.uint8)


def sounds(mod, out):
    """Contract section 11 lumps: short, quiet, a little gritty, like Doom's own effects."""
    rng = np.random.default_rng(404); t = lambda s: np.arange(int(RATE * s)) / RATE
    env = lambda x, s, k: np.exp(-x / s * k)
    def tone(f, s, k=5, shape=np.sin): x = t(s); return shape(2 * np.pi * f * x) * env(x, s, k)
    def noise(s): return rng.uniform(-1, 1, int(RATE * s))
    def lp(x, a):
        y = np.empty_like(x); acc = 0.
        for i, v in enumerate(x): acc += (v - acc) * a; y[i] = acc
        return y
    def at(total, *parts):
        out = np.zeros(int(RATE * total))
        for start, part in parts: i = int(RATE * start); n = min(len(part), len(out) - i); out[i:i + n] += part[:n]
        return out
    x = t(1.5); hammer = (np.sin(2 * np.pi * 20 * x) > 0).astype(float)
    bell = (np.sin(2 * np.pi * 1180 * x) + .6 * np.sin(2 * np.pi * 2870 * x) + .3 * np.sin(2 * np.pi * 4100 * x))
    ring = bell * (.35 + .65 * lp(hammer, .02)) * np.minimum(1, (1.3 - x) / .1).clip(0, 1)
    sq = lambda f, s, k=5: np.sign(np.sin(2 * np.pi * f * t(s))) * env(t(s), s, k)
    sweep = lambda f0, f1, s, k=3: np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, int(RATE * s))) / RATE) * env(t(s), s, k)
    scribble = np.concatenate([lp(noise(.07), .5) * np.sin(np.linspace(0, np.pi, int(RATE * .07))) * rng.uniform(.5, 1) for _ in range(9)])
    shimmer = at(.8, *[(k * .07, tone(rng.uniform(1800, 4200), .12, 6) * .6) for k in range(10)], (0, lp(noise(.8), .3) * np.linspace(.4, 0, int(RATE * .8))))
    effects = {
        'AGRING': (ring, .5),
        'AGPICK': (at(.22, (0, tone(880, .1, 4)), (.07, tone(1320, .15, 4))), .5),
        'AGCABL': (lp(noise(.025), .4) * env(t(.025), .025, 6), .25),
        'AGSNAP': (at(.4, (0, lp(noise(.35), .25) * np.linspace(1, 0, int(RATE * .35)) ** 2), (.18, noise(.03) * 1.5), (0, sweep(900, 120, .3) * .5)), .6),
        'AGPLUG': (at(.22, (0, tone(110, .18, 6) * 1.2), (.03, lp(noise(.02), .8)), (.05, tone(2400, .05, 8) * .5)), .55),
        'AGDISS': (shimmer, .4),
        'AGCHIM': (at(.7, (0, tone(1318.5, .45, 4)), (.12, tone(1975.5, .55, 4))), .45),
        'AGBOK': (at(.28, (0, sq(1200, .1, 3)), (.13, sq(1600, .14, 3))), .35),
        'AGBNO': (sq(196, .36, 2) + sq(207, .36, 2) * .7, .35),
        'AGSCRB': (scribble, .3),
        'AGBEEP': (sq(1000, .12, 2), .3),
        'AGFLSH': (lp(noise(.9), .15) * np.sin(np.linspace(0, np.pi, int(RATE * .9))) ** 2 + sweep(300, 2400, .9, .5) * .3, .55),
        'AGREND': (sweep(600, 3200, .18, 4), .35),
    }
    for name, (samples, peak) in effects.items():
        pcm = dmx(mod/'sounds/agentic'/(name.lower() + '.lmp'), samples, peak)
        out.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out/f'{name}.wav'), 'wb') as w: w.setnchannels(1); w.setsampwidth(1); w.setframerate(RATE); w.writeframes(pcm.tobytes())
    return list(effects)


# --- lineup --------------------------------------------------------------------------------
GAME_SCALE = dict(APOD=1, AHRV=1, AARM=.7, ADIS=1, ASPN=.4, ASRV=1)  # PDAgentic* actors; other props .5, cast 1
LINEUP = [  # (label, frames, default Scale in game)
    ('cast', ['ATALA1', 'ATALB1', 'ABOSA1', 'AKOKA1', 'AGRCA1', 'AGRCD0', 'ABENA1', 'ASMIA1', 'ASMIB1', 'ASMID1', 'ASMIE1', 'ASMIF0', 'ASMIG0', 'ASMIJ0', 'ASMIH0', 'ASMII0', 'ASMUA1', 'ASMUD1', 'ASMUE1', 'ASMUF0', 'ACOUA1', 'ACOUB2'], 1),
    ('props', ['APODA0', 'APODB0', 'APODC0', 'APODD0', 'AHRVA0', 'AHRVB0', 'ACHRA0', 'ACHRB0', 'ADRMA0', 'ADRMB0', 'ADRMC0', 'AARMA0', 'AARMB0', 'AARMC0', 'AARMD0', 'AARME0'], .5),
    ('small', ['APHNA0', 'APHNB0', 'APHNC0', 'ACAMA0', 'ACAMB0', 'ACAMC0', 'ACAMD0', 'ACAME0', 'ASKTA0', 'ASKTB0', 'ASKTC0', 'ASKTD0', 'ASKTE0', 'ASKTF0', 'AJCKA0', 'AJCKB0', 'ARDRA0', 'ARDRB0', 'AVTBA0', 'ASRVA0', 'ABDGA0', 'APILA0', 'ABATA0'], .5),
    ('procedural', ['ASGNA0', 'ASGNB0', 'ASGNC0', 'ASGND0', 'ANOTA0', 'ANOTB0', 'ASPNA0', 'ASPNC0', 'ASPNE0', 'ASPNG0', 'ACBLA0', 'ACBLB0', 'ACBLC0', 'ADISA0', 'ADISB0', 'ADISC0', 'ADISD0'], .5),
]


def grab(path):
    data = path.read_bytes(); i = data.find(b'grAb')
    return struct.unpack('>ii', data[i + 4:i + 12]) if i > 0 else None


def lineup(sprites, out, zoom=2):
    """Every cast member and prop at its in-game size (zoom px per map unit), feet on a floor line,
    a 56-unit person for scale at the start of each prop row."""
    font_ = ImageFont.load_default(); rows = []
    for label, names, scale in LINEUP:
        items = []
        for n in names:
            p = sprites/f'{n}.png'
            if not p.exists(): continue
            im = Image.open(p).convert('RGBA'); s = zoom * GAME_SCALE.get(n[:4], scale)
            items.append((n, im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.Resampling.NEAREST)))
        if scale != 1 and (sprites/'ATALA1.png').exists():
            items.insert(0, ('ATALA1', Image.open(sprites/'ATALA1.png').convert('RGBA').resize((64 * zoom, 64 * zoom), Image.Resampling.NEAREST)))
        rows.append((label, items))
    width = max(sum(im.width + 10 for _, im in items) + 100 for _, items in rows)
    heights = [max(im.height for _, im in items) + 30 for _, items in rows]
    sheet = Image.new('RGB', (width, sum(heights) + 10), (34, 38, 40)); d = ImageDraw.Draw(sheet); y = 0
    for (label, items), h in zip(rows, heights):
        floor = y + h - 18; d.line((0, floor, width, floor), fill=(90, 100, 96)); d.text((6, y + 6), label, fill=(230, 230, 200), font=font_)
        for u in range(0, h, 16 * zoom): d.line((90, floor - u, 94, floor - u), fill=(120, 130, 126))
        x = 100
        for n, im in items:
            sheet.paste(im, (x, floor - im.height), im)
            d.text((x, floor + 3), n if n != 'ACBLA0' else 'ACBL(flat)', fill=(200, 210, 200), font=font_); x += im.width + 10
        y += h
    out.mkdir(parents=True, exist_ok=True); sheet.save(out/'lineup.png')
    return out/'lineup.png'


def build(art=importer.ART, mod=ROOT/'doom-mod', web=ROOT/'doom-web', out=ROOT/'output/agentic/art', use_art=True, fallback=False):
    sprites = mod/'sprites'; sprites.mkdir(parents=True, exist_ok=True)
    write, width = font()
    construct(mod)
    agentic_theme.ensure_patches(mod, force=True)
    signs(sprites, write, width); spinner(sprites); cable(sprites)
    if use_art and not fallback and importer.complete(art):
        importer.main(art, mod, web, out); source = 'art pack'
    else:
        made = standins(mod, web, force=fallback); source = f'procedural stand-ins ({made} frames)'
        missing = [n for n in ['AXCHON', 'AXCHOFF', 'ABOOTH7', 'APOSTR1', 'APOSTR2'] if fallback or not (mod/f'patches/agentic/{n}.png').exists()]
        if missing: texture_standins(mod/'patches/agentic', write)
        if fallback or not (web/'hardline.png').exists(): hud_standin(web)
        importer.export_meadow_figures(sprites, web/'outside-assets')
    extra_fallbacks(mod, web, force=fallback)
    dissolve(sprites)
    names = ['AWHITE', 'AWIRE', 'AXCHON', 'AXCHOFF', 'ABOOTH7', 'APOSTR1', 'APOSTR2']
    (mod/'agentic-textures.txt').write_text('// Generated by scripts/build-agentic-assets.py: the Construct, the switchboard, booth 7, posters.\n' + '\n'.join(
        f'Texture "{n}", {Image.open(mod/f"patches/agentic/{n}.png").width}, {Image.open(mod/f"patches/agentic/{n}.png").height}\n'
        f'{{ Patch "patches/agentic/{n}.png", 0, 0 }}' for n in names if (mod/f'patches/agentic/{n}.png').exists()) + '\n')
    effects = sounds(mod, out.parent/'sounds')
    sheet = lineup(sprites, out)
    print(f'Built level 4 assets from {source}; {len(effects)} sounds; lineup {sheet.relative_to(ROOT) if ROOT in sheet.parents else sheet}')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--no-art', action='store_true', help='ignore art/level-04-v1 even if present')
    p.add_argument('--fallback', action='store_true', help='redraw every stand-in even where a file exists')
    p.add_argument('--mod', type=Path, default=ROOT/'doom-mod'); p.add_argument('--web', type=Path, default=ROOT/'doom-web')
    p.add_argument('--out', type=Path, default=ROOT/'output/agentic/art')
    a = p.parse_args()
    build(mod=a.mod, web=a.web, out=a.out, use_art=not a.no_art, fallback=a.fallback)
