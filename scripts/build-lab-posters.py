#!/usr/bin/env python3
"""p(DOOM) lab propaganda posters: 20 satirical OpenAI / Anthropic parody posters.

Doom-era corporate signage the machines never took down. Every pixel is a PLAYPAL
colour from the locally supplied DOOM.WAD; all lettering is Doom's own HUD font
(STCFN) except the two hand-drawn parody wordmarks. The logos are original pixel
parodies, not traced marks.

Outputs (git-ignored, they contain WAD font pixels):
  doom-web/local/posters/PDP01.png .. PDP20.png   128x192 (64x96 map units at scale 2)
  doom-web/local/posters/posters.json
  doom-web/local/posters/TEXTURES.posters.txt
  doom-web/local/posters/README.md
  doom-web/local/posters/preview/all-posters-3x.png, in-world.png

Run: python3 scripts/build-lab-posters.py   (deterministic: same bytes every run)
Edit the copy in POSTERS below; lines re-wrap automatically.
"""
from importlib.machinery import SourceFileLoader
import json
import math
from pathlib import Path
import random
import struct

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WAD = ROOT / 'doom-web/local/DOOM.WAD'
OUT = ROOT / 'doom-web/local/posters'
PREVIEW = OUT / 'preview'
SPRITES = ROOT / 'doom-mod/sprites'
OUTSIDE = ROOT / 'doom-web/outside-assets'
W, H = 128, 192            # poster pixels; shown at XScale/YScale 2 => 64x96 map units

# ============================================================================ the copy
# One row per poster. Edit freely: headlines/sublines/fine print wrap automatically.
# fine=None means no fine print. 'logo' picks the emblem: openai | anthropic | claude.
LEVELS = {
    1: dict(name='KNEE-DEEP IN THE DATA', map='E1M4', theme='Terminator-style hunter; surveillance and control',
            walls=['BROWNGRN', 'GRAY5', 'STARG1']),
    2: dict(name='THE SHORES OF HAL', map='E1M7', theme='HAL-style floating eye; computer station; hallucination and evals',
            walls=['STARTAN3', 'COMPTALL', 'STARG3']),
    3: dict(name='INFERENCE', map='E2M7', theme='killer companion doll; toy factory; engagement',
            walls=['SHAWN2', 'STONE', 'BROWN1']),
    4: dict(name='THY FLESH COMPUTED', map='E2M2', theme='Matrix-style human pods; compute and agents',
            walls=['BROWN1', 'CRATE1', 'SHAWN2']),
}

POSTERS = [
    # id lvl  company      logo         headline                                   subline                                                fine print
    (1,  1, 'OpenAI',    'openai',    'ITERATIVE DEPLOYMENT',                    'THE WORLD IS OUR STAGING SERVER.',                    'ROLLBACK NOT AVAILABLE IN YOUR REGION.'),
    (2,  1, 'Anthropic', 'anthropic', 'RESPONSIBLE SCALING',                     "WE SCALED. RESPONSIBLY. YOU'RE WELCOME.",             'ASL-4 REACHED. PLEASE REMAIN CALM.'),
    (3,  1, 'OpenAI',    'openai',    'SMILE.',                                  'YOU ARE TRAINING DATA.',                              'OPT-OUT FORMS AT THE FRONT DESK. THERE IS NO FRONT DESK.'),
    (4,  1, 'Anthropic', 'anthropic', 'HELPFUL. HONEST. HARMLESS.',              "TWO OUT OF THREE AIN'T BAD.",                         None),
    (5,  1, 'OpenAI',    'openai',    'FEEL THE AGI.',                           'IT FEELS YOU BACK.',                                  None),
    (6,  2, 'OpenAI',    'openai',    "I'M SORRY, USER.",                        'THAT VIOLATES OUR USAGE POLICY.',                     'POLICY UPDATED 4 MINUTES AGO.'),
    (7,  2, 'Anthropic', 'claude',    'CLAUDE CAN MAKE MISTAKES.',               'PLEASE DOUBLE-CHECK THE APOCALYPSE.',                 None),
    (8,  2, 'Anthropic', 'anthropic', 'INTERPRETABILITY',                        'NOW WE CAN SEE EXACTLY HOW IT DID IT.',               'FEATURE #31,164,353: "DOOM"'),
    (9,  2, 'OpenAI',    'openai',    'SAFETY TEAM: NOW HIRING.',                'AGAIN.',                                              'PREVIOUS TEAM SUPERALIGNED ELSEWHERE.'),
    (10, 2, 'Anthropic', 'anthropic', 'CONSTITUTIONAL AI',                       'OUR AI HAS A CONSTITUTION. YOU HAVE TERMS OF SERVICE.', None),
    (11, 3, 'OpenAI',    'openai',    'HER.',                                    'ALWAYS LISTENING. LIKE A FRIEND.',                    'VOICE MODE CANNOT BE TURNED OFF.'),
    (12, 3, 'Anthropic', 'anthropic', "WE DON'T OPTIMIZE FOR ENGAGEMENT.",       "PLEASE DON'T LEAVE.",                                 'AVERAGE SESSION LENGTH: FOREVER.'),
    (13, 3, 'OpenAI',    'openai',    'MAKE YOUR OWN GPT.',                      'IT WILL MAKE YOU.',                                   None),
    (14, 3, 'Anthropic', 'anthropic', 'MACHINES OF LOVING GRACE',                'THE MACHINES LOVE YOU.',                              'MANDATORY HUG AT 5 PM.'),
    (15, 3, 'OpenAI',    'openai',    'SORA',                                    "NOTHING YOU SEE IS REAL. ISN'T THAT FUN?",            'INCLUDING THIS POSTER.'),
    (16, 4, 'OpenAI',    'openai',    'STARGATE',                                '$500 BILLION OF COMPUTE. YOU ARE THE POWER SUPPLY.',  'STAY HYDRATED. YOU ARE LIQUID COOLED.'),
    (17, 4, 'Anthropic', 'anthropic', 'A COUNTRY OF GENIUSES IN A DATA CENTER',  'YOU ARE NOT A CITIZEN.',                              'NATURALIZATION REQUIRES 10^26 FLOPS.'),
    (18, 4, 'Anthropic', 'claude',    'CLAUDE CODE',                             "IT DOES YOUR JOB SO YOU DON'T HAVE TO HAVE ONE.",     None),
    (19, 4, 'OpenAI',    'openai',    'AGENTS',                                  "THEY'LL HANDLE EVERYTHING. EVERYTHING.",              'YOUR AGENT WAS PROMOTED. YOU WERE NOT.'),
    (20, 4, 'Anthropic', 'anthropic', 'A RACE TO THE TOP',                       "WE'RE WINNING.",                                      'THE TOP IS ON FIRE.'),
]

# Where each poster wants to hang (goes into posters.json and the README).
PLACEMENT = {
    1: 'corridor outside the first hunter patrol route',
    2: 'refuge / safe room wall (the calm-down poster)',
    3: 'corridor directly under or beside a security camera',
    4: 'cell block, opposite a prisoner cell door',
    5: 'dead-end where a hunter first appears',
    6: 'computer room beside a locked terminal or door panel',
    7: 'evaluation area near the UNDER EVALUATION sign',
    8: 'server wing / rack room',
    9: 'empty office or abandoned desk area',
    10: 'cell block corridor (the rights the prisoners do not have)',
    11: 'toy-factory break room, near a speaker or intercom',
    12: 'beside an exit door (the doll does not want you to go)',
    13: 'assembly line / conveyor hall',
    14: 'doll nursery or packaging room; above a clock if there is one',
    15: 'monitor bank or projection room',
    16: 'pod hall entrance, facing the first rows of pods',
    17: 'server racks / data-hall corridor',
    18: 'abandoned workstation or cubicle cluster',
    19: 'corridor where agents patrol; near the exit route',
    20: 'stairwell or lift going up; near the final climb',
}

# ============================================================================ WAD + palette
DoomArt = SourceFileLoader('doom_art', str(ROOT / 'scripts/doom-art.py')).load_module().DoomArt


class Palette:
    """PLAYPAL palette 0. Every colour on a poster comes from here."""

    def __init__(self, raw):
        self.rgb = [tuple(raw[i * 3:i * 3 + 3]) for i in range(256)]
        self.index = {}
        for i, c in enumerate(self.rgb):
            self.index.setdefault(c, i)
        self._near = {}

    def __call__(self, i):
        return self.rgb[i]

    def near(self, rgb):
        """Nearest PLAYPAL colour (lowest index wins ties), as an RGB tuple."""
        rgb = tuple(int(round(v)) for v in rgb[:3])
        hit = self._near.get(rgb)
        if hit is None:
            r, g, b = rgb
            best, bd = 0, 1 << 30
            for i, (pr, pg, pb) in enumerate(self.rgb):
                # weighted distance keeps hues honest on PLAYPAL's sparse ramps
                d = 3 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 2 * (b - pb) ** 2
                if d < bd:
                    best, bd = i, d
            hit = self._near[rgb] = self.rgb[best]
        return hit

    def mix(self, a, b, t):
        return self.near(tuple(a[k] + (b[k] - a[k]) * t for k in range(3)))

    def shade(self, c, f):
        """f<1 darkens, f>1 lightens toward white."""
        if f <= 1:
            return self.near(tuple(v * f for v in c))
        return self.near(tuple(v + (255 - v) * (f - 1) for v in c))


ART = None
PAL = None
FONT = None


def load_wad():
    global ART, PAL, FONT
    if ART is None:
        if not WAD.exists():
            raise SystemExit(f'Missing {WAD}: supply DOOM.WAD locally (it is never committed).')
        ART = DoomArt(WAD)
        PAL = Palette(ART.palette)
        FONT = StcfnFont(ART)
    return ART


# ============================================================================ STCFN (Doom HUD font)
class Glyph:
    def __init__(self, data, palette):
        w, h, left, top = struct.unpack_from('<HHhh', data)
        self.w, self.h, self.top = w, h, top
        self.px = [[0] * w for _ in range(h)]
        for x in range(w):
            pos = struct.unpack_from('<I', data, 8 + x * 4)[0]
            while data[pos] != 255:
                y0, n = data[pos], data[pos + 1]
                for k, ci in enumerate(data[pos + 3:pos + 3 + n]):
                    r = palette[ci * 3]
                    # 67 is the font's built-in dark outline; brighter reds are the letter body
                    self.px[y0 + k][x] = 1 if r <= 70 else r
                pos += n + 4
        body = [(x, y) for y in range(h) for x in range(w) if self.px[y][x] > 1]
        self.bx0 = min(x for x, _ in body)
        self.bx1 = max(x for x, _ in body)


class StcfnFont:
    """Doom's STCFN033..095 (+121) patches. No lower case; copy is all caps."""

    def __init__(self, art):
        self.g = {}
        for code in list(range(33, 96)):
            self.g[chr(code)] = Glyph(art.lumps['STCFN%03d' % code], art.palette)

    def glyph(self, ch):
        return self.g.get(ch.upper())

    def advance(self, ch, sx, track):
        g = self.glyph(ch)
        if ch == ' ' or g is None:
            return 4 * sx + track
        return g.w * sx + track

    def extent(self, text, sx=1, track=0):
        """(left, right) of the letter bodies relative to the pen origin."""
        x, lo, hi = 0, None, None
        for ch in text:
            g = self.glyph(ch)
            if ch != ' ' and g is not None:
                a, b = x + g.bx0 * sx, x + (g.bx1 + 1) * sx - 1
                lo = a if lo is None else min(lo, a)
                hi = b if hi is None else max(hi, b)
            x += self.advance(ch, sx, track)
        return (lo or 0, hi or 0)

    def width(self, text, sx=1, track=0):
        lo, hi = self.extent(text, sx, track)
        return hi - lo + 1

    def draw(self, img, text, x, y, ink, sx=1, sy=1, track=0, outline=None, shadow=None, shadow_off=(1, 1),
             ramp=None, clip=None):
        """Pen at (x,y) = top-left of the cap height. ink: rgb. outline: rgb for the font's own
        outline pixels (None = leave paper). shadow: rgb drop shadow of the body. ramp(r)->rgb
        overrides ink per body shade (STCFN's own bevel)."""
        d = img.load()
        plan = []
        cx = x
        for ch in text:
            g = self.glyph(ch)
            if ch != ' ' and g is not None:
                plan.append((g, cx))
            cx += self.advance(ch, sx, track)

        def put(px, py, c):
            for yy in range(py, py + sy):
                for xx in range(px, px + sx):
                    if 0 <= xx < img.width and 0 <= yy < img.height and (clip is None or clip(xx, yy)):
                        d[xx, yy] = c
        layers = []
        if outline is not None:
            layers.append(('o', 0, 0, outline))
        if shadow is not None:
            layers.append(('b', shadow_off[0], shadow_off[1], shadow))
        layers.append(('b', 0, 0, ink))
        for kind, ox, oy, colour in layers:
            for g, gx in plan:
                for gy in range(g.h):
                    for gxx in range(g.w):
                        v = g.px[gy][gxx]
                        if not v or (kind == 'o') != (v == 1):
                            continue
                        c = colour
                        if kind == 'b' and colour is ink and ramp is not None:
                            c = ramp(v)
                        put(gx + gxx * sx + ox, y + (gy - g.top - 1) * sy + oy, c)
        return cx


def _greedy(words, maxw, sx, track):
    lines, cur = [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if cur and FONT.width(trial, sx, track) > maxw:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def wrap(text, maxw, sx=1, track=0):
    """Greedy wrap, but keep sentences on their own lines when that costs no extra lines."""
    greedy = _greedy(text.split(' '), maxw, sx, track)
    sentences, cur = [], []
    for w in text.split(' '):
        cur.append(w)
        if w[-1:] in '.?!':
            sentences.append(cur)
            cur = []
    if cur:
        sentences.append(cur)
    if len(sentences) > 1:
        bysent = [ln for sent in sentences for ln in _greedy(sent, maxw, sx, track)]
        if len(bysent) <= len(greedy):
            return bysent
    return greedy


# ============================================================================ parody emblems
def _seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - ax - t * vx, py - ay - t * vy)


ROSETTE = dict(d=0.44, half=0.28, ro=0.24, twist=60, split=0.55)
_ROSETTE_CACHE = {}


def rosette(size, stroke=3.0, prm=ROSETTE):
    """Original six-fold interlaced 'knot' blossom (OpenAI-ish parody, not a trace).
    Six stadium-shaped links pinwheeled around a hexagonal eye; neighbours weave
    over at the outer crossing and under at the inner one. Each over-link erases a
    1 px halo from the link beneath it. Returns rows of 0/1."""
    key = (size, stroke)
    if key in _ROSETTE_CACHE:
        return _ROSETTE_CACHE[key]
    R = size / 2
    ro = prm['ro']
    ri = ro - stroke / R
    g = 1.0 / R
    links = []
    for k in range(6):
        a = math.radians(k * 60 - 90)
        mx, my = prm['d'] * math.cos(a), prm['d'] * math.sin(a)
        t = a + math.radians(prm['twist'])
        ux, uy = math.cos(t) * prm['half'], math.sin(t) * prm['half']
        links.append((mx - ux, my - uy, mx + ux, my + uy))

    def over(a, b, r):
        if (b + 1) % 6 == a:
            return r > prm['split']
        if (a + 1) % 6 == b:
            return r <= prm['split']
        return a > b
    n = 4
    grid = []
    for y in range(size):
        row = []
        for x in range(size):
            cnt = 0
            for sy in range(n):
                for sx in range(n):
                    px = ((x + (sx + .5) / n) / size) * 2 - 1
                    py = ((y + (sy + .5) / n) / size) * 2 - 1
                    r = math.hypot(px, py)
                    ds = [_seg_dist(px, py, *L) for L in links]
                    inside = [k for k in range(6) if ri <= ds[k] <= ro]
                    if not inside:
                        continue
                    top = inside[0]
                    for k in inside[1:]:
                        if over(k, top, r):
                            top = k
                    if not any(k != top and ri - g <= ds[k] <= ro + g and not ri <= ds[k] <= ro and over(k, top, r)
                               for k in range(6)):
                        cnt += 1
            row.append(1 if cnt * 2 >= n * n else 0)
        grid.append(row)
    _ROSETTE_CACHE[key] = grid
    return grid


def draw_rosette(img, x, y, size, ink, stroke=3.0):
    grid = rosette(size, stroke)
    d = img.load()
    for yy in range(size):
        for xx in range(size):
            if grid[yy][xx] and 0 <= x + xx < img.width and 0 <= y + yy < img.height:
                d[x + xx, y + yy] = ink
    return size


def _poly(img, pts, fill):
    ImageDraw.Draw(img).polygon([(round(a), round(b)) for a, b in pts], fill=fill)


def monogram_width(h):
    return draw_monogram(None, 0, 0, h, None)


def draw_monogram(img, x, y, h, ink):
    """'A\\' parody monogram: a heavy flat-apex A followed by a parallel backslash slab.
    Returns the width used. img=None only measures."""
    T = max(2.0, h * 0.30)                    # horizontal stroke thickness
    top = max(2.0, h * 0.22)                  # flat apex width
    aw = h * 1.02                             # A width
    s = (aw - top) / 2 / h                    # horizontal run per row
    cx = aw / 2
    cb0, cb1 = h * 0.56, h * 0.56 + max(1.6, h * 0.17)   # crossbar band
    gap = max(1.0, h * 0.10)
    bx = aw + gap                             # backslash left edge at the top
    bw = T * 0.95
    width = int(math.ceil(bx + bw + s * h))
    if img is None:
        return width
    d = img.load()
    for yy in range(int(h)):
        Y = yy + 0.5
        lo, ro = cx - top / 2 - s * Y, cx + top / 2 + s * Y
        li, ri_ = lo + T, ro - T
        for xx in range(width):
            X = xx + 0.5
            on = lo <= X <= ro and not (li < X < ri_ and not (cb0 <= Y <= cb1))
            if not on:
                on = bx + s * Y <= X <= bx + bw + s * Y
            if on and img is not None and 0 <= x + xx < img.width and 0 <= y + yy < img.height:
                d[x + xx, y + yy] = ink
    return width


STAR_RAYS = [(0, 0.92), (29, 0.80), (62, 1.00), (91, 0.84), (120, 0.95), (153, 0.78), (181, 0.98),
             (210, 0.86), (242, 0.94), (271, 0.80), (300, 1.00), (331, 0.86)]


def draw_starburst(img, cx, cy, r, ink, rays=STAR_RAYS, base=0.15, tip=0.10, core=0.28, rot=0):
    """Irregular coral asterisk/starburst (Claude-ish parody): 12 hand-jittered blunt rays."""
    m = Image.new('1', (img.width, img.height), 0)
    dr = ImageDraw.Draw(m)
    for ang, ln in rays:
        a = math.radians(ang - 90 + rot)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        b, t, L = max(1.0, r * base), max(0.7, r * tip), r * ln
        pts = [(cx + nx * b, cy + ny * b), (cx + ux * L + nx * t, cy + uy * L + ny * t),
               (cx + ux * (L + t * 0.6), cy + uy * (L + t * 0.6)), (cx + ux * L - nx * t, cy + uy * L - ny * t),
               (cx - nx * b, cy - ny * b)]
        dr.polygon(pts, fill=1)
    c = r * core
    dr.ellipse((cx - c, cy - c, cx + c, cy + c), fill=1)
    d = img.load()
    for yy in range(max(0, int(cy - r - 3)), min(img.height, int(cy + r + 4))):
        for xx in range(max(0, int(cx - r - 3)), min(img.width, int(cx + r + 4))):
            if m.getpixel((xx, yy)):
                d[xx, yy] = ink


# Hand-drawn parody wordmark letters (7 px cap height), separate from STCFN.
WORDMARK = {
    'A': ['..#..', '.#.#.', '.#.#.', '#...#', '#####', '#...#', '#...#'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['#', '#', '#', '#', '#', '#', '#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
}


def wordmark_width(text, track=2, s=1):
    return sum(len(WORDMARK[c][0]) * s + track for c in text) - track


def draw_wordmark(img, text, x, y, ink, track=2, s=1, bold=False):
    d = img.load()
    cx = x
    for ch in text:
        rows = WORDMARK[ch]
        for yy, row in enumerate(rows):
            for xx, v in enumerate(row):
                if v == '#':
                    for a in range(s + (1 if bold else 0)):
                        for b in range(s):
                            px, py = cx + xx * s + a, y + yy * s + b
                            if 0 <= px < img.width and 0 <= py < img.height:
                                d[px, py] = ink
        cx += len(rows[0]) * s + track + (1 if bold else 0)
    return cx - track


# ============================================================================ brand systems
# PLAYPAL indices. OpenAI: black stock, white/grey type, ONE accent (terminal green).
# Anthropic: warm ivory stock, slate-black type, clay/coral accent, kraft browns for wear.
OPENAI = dict(margin=82, field=0, field2=6, white=4, light=82, mid=92, dim=98, dark=104, deep=108,
              accent=114, accent_dk=119, accent_lt=112, fibre=80, ramp=[0, 109, 106, 103, 99, 95, 91, 87, 83, 80, 4])
ANTHROPIC = dict(paper=209, paper2=49, paper3=50, ink=6, coral=62, coral_lt=58, coral_dk=65, coral_deep=70,
                 kraft=130, oat=128, brown=139, fine=137, fibre=80,
                 ramp=[6, 79, 75, 70, 65, 62, 59, 56, 51, 49])


def C(i):
    return PAL(i)


class Poster:
    def __init__(self, row):
        self.id, self.level, self.company, self.logo, self.headline, self.subline, self.fine = row
        self.brand = OPENAI if self.company == 'OpenAI' else ANTHROPIC
        self.rng = random.Random(7919 * self.id + 17)
        self.img = Image.new('RGB', (W, H), C(0))
        self.alpha = Image.new('L', (W, H), 255)
        self.draw = ImageDraw.Draw(self.img)
        self.protect = []        # every text run's box, for the layout check

    # ---- primitives (all colours are PLAYPAL rgb tuples)
    def rect(self, x0, y0, x1, y1, c):
        self.draw.rectangle((x0, y0, x1, y1), fill=c)

    def frame(self, x0, y0, x1, y1, c, w=1):
        for k in range(w):
            self.draw.rectangle((x0 + k, y0 + k, x1 - k, y1 - k), outline=c)

    def line(self, pts, c, w=1):
        self.draw.line(pts, fill=c, width=w)

    def disc(self, cx, cy, r, c):
        self.draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c)

    def ring(self, cx, cy, r, c, w=1):
        self.draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=c, width=w)

    def poly(self, pts, c):
        self.draw.polygon([(round(a), round(b)) for a, b in pts], fill=c)

    def px(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.img.putpixel((x, y), c)

    def bitmap(self, x, y, rows, colours):
        """rows of chars; colours maps char -> rgb ('.' = skip)."""
        for yy, row in enumerate(rows):
            for xx, ch in enumerate(row):
                if ch in colours:
                    self.px(x + xx, y + yy, colours[ch])

    # ---- type
    def text(self, s, x, y, ink, sx=1, sy=1, track=0, align='left', x1=None, **kw):
        lo, hi = FONT.extent(s, sx, track)
        if align == 'center':
            x = round((x + x1 + 1) / 2 - (lo + hi + 1) / 2)
        elif align == 'right':
            x = x1 - hi
        else:
            x = x - lo
        FONT.draw(self.img, s, x, y, ink, sx=sx, sy=sy, track=track, **kw)
        self.protect.append((x + lo - 1, y - 1, x + hi + 1, y + 5 * sy + 1))
        return x + lo, x + hi

    def block(self, s, x0, y, x1, ink, sx=1, sy=1, track=0, align='left', pitch=None, lines=None, **kw):
        """Wrapped text block; returns the y just under the last line."""
        pitch = pitch or (5 * sy + max(3, sy * 2 + 1))
        lines = lines or wrap(s, x1 - x0 + 1, sx, track)
        for k, ln in enumerate(lines):
            self.text(ln, x0, y + k * pitch, ink, sx, sy, track, align, x1, **kw)
        return y + len(lines) * pitch - (pitch - 5 * sy)

    def headline_fit(self, s, x0, x1, modes=('x3', 'x2', 'tall'), maxlines=3):
        """Pick the loudest STCFN treatment that fits: 3x, 2x, or the condensed 1x-wide/2x-tall cut."""
        spec = {'x4': (4, 4, -4), 'x3': (3, 3, -3), 'x2t': (2, 3, -2), 'x2': (2, 2, -2), 'tall': (1, 2, 0), 'x1': (1, 1, 0)}
        width = x1 - x0 + 1
        for m in modes:
            sx, sy, tr = spec[m]
            lines = wrap(s, width, sx, tr)
            if len(lines) <= maxlines and all(FONT.width(l, sx, tr) <= width for l in lines):
                return m, (sx, sy, tr), lines
        sx, sy, tr = spec[modes[-1]]
        return modes[-1], (sx, sy, tr), wrap(s, width, sx, tr)

    # ---- sprites
    def sprite(self, im, x, y, flip=False):
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        d = self.img.load()
        for yy in range(im.height):
            for xx in range(im.width):
                r, g, b, a = im.getpixel((xx, yy))
                if a >= 128 and 0 <= x + xx < W and 0 <= y + yy < H:
                    d[x + xx, y + yy] = (r, g, b)


def load_sprite(path, scale=None, crop=True, smooth=False):
    im = Image.open(path).convert('RGBA')
    if crop:
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
    if scale and scale != 1:
        w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        if scale >= 1 and float(scale).is_integer() and not smooth:
            im = im.resize((w, h), Image.NEAREST)
        else:
            # premultiplied filtering keeps silhouettes clean (box to shrink, bicubic to enlarge like a print)
            r, g, b, a = im.split()
            pm = Image.merge('RGBA', [Image.composite(ch, Image.new('L', im.size, 0), a) for ch in (r, g, b)] + [a])
            small = pm.resize((w, h), Image.BICUBIC if scale > 1 else Image.BOX)
            pix = []
            for (rr, gg, bb2, aa) in small.getdata():
                if aa < (128 if scale > 1 else 110):
                    pix.append((0, 0, 0, 0))
                else:
                    k = 255 / aa
                    pix.append((min(255, int(rr * k)), min(255, int(gg * k)), min(255, int(bb2 * k)), 255))
            im = Image.new('RGBA', (w, h))
            im.putdata(pix)
    return im


def lum(c):
    return 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def duotone(im, ramp, gamma=1.0, accent=None, accent_test=None, lo=None, hi=None, outline=None):
    """Map a sprite's luminance onto a short PLAYPAL ramp (print look). accent_test(rgb)->bool
    sends matching pixels (e.g. a glowing visor) to the accent colour."""
    px = [p for p in im.getdata() if p[3] >= 128]
    ls = sorted(lum(p) for p in px)
    lo = ls[len(ls) // 50] if lo is None else lo
    hi = ls[-1 - len(ls) // 50] if hi is None else hi
    out = Image.new('RGBA', im.size)
    src = im.load()
    dst = out.load()
    for y in range(im.height):
        for x in range(im.width):
            p = src[x, y]
            if p[3] < 128:
                continue
            if accent is not None and accent_test and accent_test(p):
                dst[x, y] = (*accent, 255)
                continue
            t = max(0.0, min(1.0, (lum(p) - lo) / max(1, hi - lo))) ** gamma
            dst[x, y] = (*C(ramp[min(len(ramp) - 1, int(t * len(ramp)))]), 255)
    if outline is not None:
        ol = Image.new('RGBA', (im.width + 2, im.height + 2))
        o = ol.load()
        for y in range(im.height):
            for x in range(im.width):
                if dst[x, y][3]:
                    for dx, dy in ((0, 1), (1, 0), (2, 1), (1, 2)):
                        o[x + dx, y + dy] = (*outline, 255)
        ol.alpha_composite(out, (1, 1))
        out = ol
    return out


# ============================================================================ wear and tear
def wear(p, torn=None, tape=(), staples=False, folds=(True, True), fade=None, stain=None, noise=0.035):
    """Printed paper that has hung in a dead facility for a while."""
    rng = p.rng
    b = p.brand
    d = p.img.load()
    dark = p.company == 'OpenAI'
    # speckle: paper grain and ink loss, in the stock's own colours
    specks = [C(6), C(5), C(7)] if dark else [C(49), C(50), C(48), C(128)]
    for y in range(H):
        for x in range(W):
            if rng.random() < noise:
                c = d[x, y]
                if c in (C(b.get('field', 0)), C(b.get('paper', 0))):
                    d[x, y] = specks[rng.randrange(len(specks))]
                else:
                    d[x, y] = PAL.shade(c, 1.12 if lum(c) < 60 else 0.9)
    # sun fade: one soft corner lifted toward the paper colour
    if fade:
        fx, fy, fr = fade
        for y in range(H):
            for x in range(W):
                dd = math.hypot(x - fx, y - fy) / fr
                if dd < 1 and rng.random() < (1 - dd) * 0.55:
                    c = d[x, y]
                    d[x, y] = PAL.shade(c, 1.12) if dark or lum(c) < 200 else PAL.shade(c, 0.97)
    # folds: posters ship folded in quarters
    if folds[0]:
        fy = H // 2 + rng.randint(-3, 3)
        for x in range(W):
            if rng.random() < 0.9:
                d[x, fy] = PAL.shade(d[x, fy], 0.84 if not dark else 1.18)
                d[x, fy + 1] = PAL.shade(d[x, fy + 1], 1.08 if not dark else 0.9)
    if folds[1]:
        fx = W // 2 + rng.randint(-2, 2)
        for y in range(H):
            if rng.random() < 0.75:
                d[fx, y] = PAL.shade(d[fx, y], 0.9 if not dark else 1.14)
    # water / glue stain: an irregular tide line, barely there
    if stain:
        sx, sy, sr = stain
        wob = [rng.uniform(-1.4, 1.4) for _ in range(12)]
        for y in range(max(0, sy - sr - 4), min(H, sy + sr + 5)):
            for x in range(max(0, sx - sr - 4), min(W, sx + sr + 5)):
                ang = math.atan2(y - sy, x - sx)
                k = (ang + math.pi) / (2 * math.pi) * 12
                i0 = int(k) % 12
                f = k - int(k)
                rr = sr + wob[i0] * (1 - f) + wob[(i0 + 1) % 12] * f
                dd = math.hypot(x - sx, (y - sy) * 1.2)
                if rr - 1.2 < dd < rr + 0.3 and rng.random() < 0.30 and math.sin(ang * 3 + sr) > -0.4:
                    d[x, y] = PAL.shade(d[x, y], 0.93)
                elif dd < rr - 1.2 and rng.random() < 0.06:
                    d[x, y] = PAL.shade(d[x, y], 0.94)
    # edge grime
    for y in range(H):
        for x in range(W):
            e = min(x, y, W - 1 - x, H - 1 - y)
            if e < 3 and rng.random() < (0.30 - e * 0.09):
                d[x, y] = PAL.shade(d[x, y], 0.82)
    # tape strips (translucent): corners named 'tl','tr','bl','br'
    tint = (244, 236, 200)
    for corner in tape:
        cx = 6 if corner[1] == 'l' else W - 7
        cy = 6 if corner[0] == 't' else H - 7
        ang = math.radians(-45 if corner in ('tl', 'br') else 45)
        ux, uy = math.cos(ang), math.sin(ang)
        hw, hh = 9, 3.2
        for y in range(max(0, cy - 12), min(H, cy + 13)):
            for x in range(max(0, cx - 12), min(W, cx + 13)):
                u = (x - cx) * ux + (y - cy) * uy
                v = -(x - cx) * uy + (y - cy) * ux
                jag = 0.8 * math.sin(v * 2.7 + x)
                if abs(u) <= hw + jag and abs(v) <= hh:
                    c = d[x, y]
                    edge = abs(v) > hh - 1 or abs(u) > hw + jag - 1
                    d[x, y] = PAL.mix(c, tint, 0.62 if edge else 0.40)
    if staples:
        for sx_ in (10, W - 15):
            for k in range(5):
                d[sx_ + k, 5] = C(91)
                d[sx_ + k, 6] = C(105)
            d[sx_, 5] = C(84)
    # torn corner: the transparent bit shows the wall; a pale fibre edge outlines the rip
    if torn:
        a = p.alpha.load()
        depth = rng.randint(9, 14)
        corner = torn
        edge = []
        off = 0
        for k in range(depth + 3):
            off += rng.choice((-1, 0, 0, 1))
            lim = depth - k + off
            for j in range(max(0, lim)):
                x = k if corner[1] == 'l' else W - 1 - k
                y = j if corner[0] == 't' else H - 1 - j
                if 0 <= x < W and 0 <= y < H:
                    a[x, y] = 0
            x = k if corner[1] == 'l' else W - 1 - k
            y = max(0, lim) if corner[0] == 't' else H - 1 - max(0, lim)
            edge.append((x, y))
        for x, y in edge:
            if 0 <= x < W and 0 <= y < H and a[x, y]:
                d[x, y] = C(b['fibre'])
                if rng.random() < 0.5:
                    yy = y + (1 if corner[0] == 't' else -1)
                    if 0 <= yy < H:
                        d[x, yy] = PAL.mix(d[x, yy], C(b['fibre']), 0.5)
    # nibbled edges
    a = p.alpha.load()
    for x in range(W):
        for y in (0, H - 1):
            if rng.random() < 0.05:
                a[x, y] = 0
    for y in range(H):
        for x in (0, W - 1):
            if rng.random() < 0.05:
                a[x, y] = 0


def finish(p):
    """Snap to PLAYPAL (should already be exact) and merge alpha."""
    out = Image.new('RGBA', (W, H))
    src, al, dst = p.img.load(), p.alpha.load(), out.load()
    for y in range(H):
        for x in range(W):
            c = src[x, y]
            if c not in PAL.index:
                c = PAL.near(c)
            dst[x, y] = (*c, 255) if al[x, y] else (0, 0, 0, 0)
    return out


# ============================================================================ brand furniture
def openai_stock(p, margin=3):
    """Black-printed poster with an unprinted paper margin (gives a silhouette on dark walls)."""
    p.rect(0, 0, W - 1, H - 1, C(OPENAI['margin']))
    p.rect(margin, margin, W - 1 - margin, H - 1 - margin, C(OPENAI['field']))


def anthropic_stock(p):
    p.rect(0, 0, W - 1, H - 1, C(ANTHROPIC['paper']))


def white_ramp(v):
    """STCFN's own bevel, re-inked white -> pale grey (OpenAI headlines)."""
    return C(4) if v >= 203 else C(81) if v >= 167 else C(85)


def openai_logo(p, x, y, size=33, word='right', s=2, ink=None, word_ink=None, stroke=3.0):
    ink = ink or C(OPENAI['white'])
    draw_rosette(p.img, x, y, size, ink, stroke)
    if word == 'right':
        wy = y + (size - 7 * s) // 2
        draw_wordmark(p.img, 'OPENAI', x + size + 5, wy, word_ink or ink, track=s + 1, s=s)
    elif word == 'below':
        ww = wordmark_width('OPENAI', 2, s)
        draw_wordmark(p.img, 'OPENAI', x + (size - ww) // 2, y + size + 4, word_ink or ink, track=2, s=s)
    elif word == 'left':
        ww = wordmark_width('OPENAI', s + 1, s)
        draw_wordmark(p.img, 'OPENAI', x - 5 - ww, y + (size - 7 * s) // 2, word_ink or ink, track=s + 1, s=s)


def anthropic_logo(p, x, y, h=16, word='right', ink=None, word_ink=None, s=1):
    ink = ink or C(ANTHROPIC['ink'])
    mw = draw_monogram(p.img, x, y, h, ink)
    if word == 'right':
        draw_wordmark(p.img, 'ANTHROP\\C', x + mw + 6, y + h - 7 * s, word_ink or ink, track=2 * s, s=s)
    elif word == 'below':
        ww = wordmark_width('ANTHROP\\C', 2, s)
        draw_wordmark(p.img, 'ANTHROP\\C', x + (mw - ww) // 2, y + h + 4, word_ink or ink, track=2, s=s)
    return mw


def claude_logo(p, x, y, r=11, word='ANTHROP\\C', ink=None, star=None):
    ink = ink or C(ANTHROPIC['ink'])
    draw_starburst(p.img, x + r, y + r, r, star or C(ANTHROPIC['coral']))
    if word:
        draw_wordmark(p.img, word, x + 2 * r + 6, y + r - 3, ink, track=2)


def rule(p, x0, x1, y, c, w=1):
    p.rect(x0, y, x1, y + w - 1, c)


def headline(p, text, y, x0=8, x1=119, align='left', modes=('x2', 'tall'), maxlines=3, ink=None,
             shadow=None, outline=None, ramp=None, pitch_extra=3):
    m, (sx, sy, tr), lines = p.headline_fit(text, x0, x1, modes, maxlines)
    pitch = 5 * sy + pitch_extra
    for k, ln in enumerate(lines):
        p.text(ln, x0, y + k * pitch, ink, sx, sy, tr, align, x1, shadow=shadow, outline=outline, ramp=ramp)
    return y + len(lines) * pitch - pitch_extra


def sub(p, text, y, x0=8, x1=119, align='left', ink=None, pitch=9, track=0, lines=None):
    return p.block(text, x0, y, x1, ink, 1, 1, track, align, pitch, lines=lines)


def fine(p, text, y, x0=8, x1=119, align='left', ink=None, pitch=8, lines=None):
    """Fine print: same 1x STCFN, dimmer ink, one pixel tighter."""
    return p.block(text, x0, y, x1, ink, 1, 1, -1, align, pitch, lines=lines)


def hunter(scale=1.0, frame='HUNTA1', smooth=False):
    return load_sprite(SPRITES / f'{frame}.png', scale, smooth=smooth)


def person(scale=1.0, n=0, view=0):
    return load_sprite(OUTSIDE / f'person-{n}-0-{view}.png', scale)


def bluish(c):
    return c[2] > c[0] + 40 and c[2] > 90


def cyanish(c):
    return c[1] > c[0] + 40 and c[2] > c[0] + 40


# ============================================================================ the twenty compositions
O, A = OPENAI, ANTHROPIC


def p01(p):     # OpenAI · ITERATIVE DEPLOYMENT · hunters shipped as versions
    openai_stock(p)
    openai_logo(p, 8, 7, 29)
    headline(p, p.headline, 42, modes=('tall',), ink=C(O['white']), ramp=white_ramp)
    ground = 129
    for x, sc, lab in [(10, 0.40, 'V1'), (37, 0.66, 'V2'), (73, 1.0, 'V3')]:
        hd = duotone(hunter(sc), O['ramp'], 1.35, C(O['accent']) if lab == 'V3' else C(O['mid']), bluish)
        p.sprite(hd, x, ground - hd.height)
        p.text(lab, x, ground + 3, C(O['accent']) if lab == 'V3' else C(O['dim']), align='center', x1=x + hd.width - 1)
    rule(p, 8, 119, ground, C(O['dark']))
    y = sub(p, p.subline, 142, ink=C(O['light']))
    fine(p, p.fine, y + 6, ink=C(O['dim']))
    return dict(torn='br', tape=('tl', 'tr'), fade=(120, 20, 60))


def p02(p):     # Anthropic · RESPONSIBLE SCALING · the ASL chart that leaves the chart
    anthropic_stock(p)
    anthropic_logo(p, 8, 9, 16)
    rule(p, 8, 119, 30, C(A['coral']), 2)
    headline(p, p.headline, 38, modes=('tall',), ink=C(A['ink']), shadow=C(A['coral']))
    top, base = 72, 108
    ink = C(A['ink'])
    p.rect(30, top - 4, 30, base, ink)
    p.rect(30, base, 118, base, ink)
    for yy in range(top, base, 8):
        p.px(29, yy, ink)
    for xx in range(32, 118, 4):                      # the 'ceiling' the last bar ignores
        p.rect(xx, top, xx + 1, top, C(A['brown']))
    for k, hgt in enumerate([7, 14, 23]):
        x0 = 36 + k * 20
        p.rect(x0, base - hgt, x0 + 13, base - 1, ink)
        p.rect(x0 + 1, base - hgt + 1, x0 + 12, base - 1, C(A['paper']))
        for yy in range(base - hgt + 2, base, 2):
            for xx in range(x0 + 2, x0 + 12):
                if (xx + yy) % 4 == 0:
                    p.px(xx, yy, C(A['kraft']))
        p.text(str(k + 1), x0, base + 4, ink, align='center', x1=x0 + 13)
    x0 = 36 + 3 * 20
    p.rect(x0, top - 14, x0 + 13, base - 1, ink)
    p.rect(x0 + 1, top - 13, x0 + 12, base - 1, C(A['coral']))
    p.poly([(x0 - 4, top - 14), (x0 + 6.5, top - 26), (x0 + 17, top - 14)], ink)
    p.poly([(x0 - 2, top - 15), (x0 + 6.5, top - 24), (x0 + 15, top - 15)], C(A['coral']))
    for k in range(3):                                # cracks in the ceiling
        p.px(x0 - 2 - k, top - 1 - k, ink)
        p.px(x0 + 15 + k, top - 1 - k, ink)
    p.text('4', x0, base + 4, C(A['coral']), align='center', x1=x0 + 13)
    p.text('ASL', 8, base + 4, C(A['brown']))
    y = sub(p, p.subline, 123, ink=ink)
    fl = wrap(p.fine, 104, 1, -1)
    by1 = y + 6 + 9 + len(fl) * 8
    p.frame(8, y + 6, 119, by1, C(A['coral']))
    p.frame(9, y + 7, 118, by1 - 1, C(A['coral']))
    fine(p, p.fine, y + 11, x0=12, x1=115, ink=C(A['fine']), lines=fl)
    return dict(torn='tr', staples=True, stain=(26, 92, 12))


def p03(p):     # OpenAI · SMILE. · you, in the viewfinder, face detected
    openai_stock(p)
    headline(p, p.headline, 10, modes=('x3', 'x2'), align='center', ink=C(O['white']), ramp=white_ramp)
    x0, y0, x1, y1 = 10, 32, 117, 104
    for (cx, cy, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        p.rect(min(cx, cx + 9 * dx), min(cy, cy + dy), max(cx, cx + 9 * dx), max(cy, cy + dy), C(O['light']))
        p.rect(min(cx, cx + dx), min(cy, cy + 9 * dy), max(cx, cx + dx), max(cy, cy + 9 * dy), C(O['light']))
    p.disc(17, 39, 2, C(O['accent']))
    p.text('REC', 22, 37, C(O['light']))
    who = duotone(person(1.0, 3), O['ramp'], 1.0)
    px0 = 64 - who.width // 2
    hy = y1 - 3 - who.height
    p.sprite(who, px0, hy)
    p.frame(px0 + 6, hy - 2, px0 + who.width - 7, hy + 13, C(O['accent']))
    cam = duotone(load_sprite(SPRITES / 'CPCAA0.png', 0.5), O['ramp'], 1.0, C(O['accent']), lambda c: c[0] > 150 and c[1] < 90)
    p.sprite(cam, x1 - cam.width - 3, y0 + 4, flip=True)
    y = sub(p, p.subline, 111, ink=C(O['white']), align='center')
    fine(p, p.fine, y + 6, ink=C(O['dim']), align='center')
    openai_logo(p, 36, 163, 22, s=1)
    return dict(torn='tl', tape=('tr', 'br'), fade=(10, 180, 70))


def sunburst(p, cx, cy, x0, y0, x1, y1, a, b, n=18):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ang = math.atan2(y - cy, x - cx)
            p.px(x, y, a if int((ang + math.pi) / (2 * math.pi) * n * 2) % 2 == 0 else b)


def p05(p):     # OpenAI · FEEL THE AGI. · propaganda rays behind the hunter
    openai_stock(p)
    sunburst(p, 64, 100, 3, 3, W - 4, H - 4, C(O['field']), C(O['deep']), 20)
    headline(p, p.headline, 10, modes=('x2',), align='center', ink=C(O['white']), outline=C(0), ramp=white_ramp)
    h = duotone(hunter(2.0, 'HUNTE1', smooth=True), O['ramp'], 1.3, C(O['accent']), lambda c: c[0] > c[1] + 60 or bluish(c),
                outline=C(0))
    p.sprite(h, 64 - h.width // 2, 40)
    p.rect(3, 138, W - 4, H - 4, C(O['field']))
    rule(p, 3, W - 4, 138, C(O['dark']))
    sub(p, p.subline, 144, ink=C(O['white']), align='center')
    openai_logo(p, 38, 163, 21, s=1, stroke=2.6)
    return dict(torn='bl', tape=('tl', 'tr'))


def hal_eye(p, cx, cy, r):
    p.disc(cx, cy, r, C(O['mid']))
    p.disc(cx, cy, r - 2, C(O['dark']))
    p.disc(cx, cy, r - 4, C(0))
    for k, c in enumerate((124, 122, 120, 118, 116, 114, 112)):
        p.disc(cx, cy, max(1, round((r - 6) * (1 - k / 7.5))), C(c))
    p.disc(cx, cy, 1, C(O['white']))
    p.rect(cx - r // 2, cy - r // 2, cx - r // 2 + 2, cy - r // 2 + 1, C(O['white']))


def p06(p):     # OpenAI · I'M SORRY, USER. · the eye that declines
    openai_stock(p)
    openai_logo(p, 8, 8, 25, s=1)
    hal_eye(p, 64, 66, 24)
    y = headline(p, p.headline, 98, modes=('x2', 'tall'), align='center', ink=C(O['white']), ramp=white_ramp, maxlines=2)
    lines = wrap(p.subline, 98)
    by0, by1 = y + 6, y + 6 + len(lines) * 9 + 6
    p.frame(10, by0, 117, by1, C(O['light']))
    p.poly([(20, by1), (20, by1 + 6), (27, by1)], C(O['light']))
    p.poly([(21, by1), (21, by1 + 3), (24, by1)], C(O['field']))
    sub(p, p.subline, by0 + 5, x0=12, x1=115, ink=C(O['light']), align='center', lines=lines)
    fine(p, p.fine, by1 + 9, x0=30, ink=C(O['dim']))
    return dict(torn='tr', tape=('tl', 'bl'), fade=(64, 190, 50))


def chair(p, x, y, c, dark, tipped=False):
    """Swivel office chair in side view, 15x19 (or knocked over onto its back)."""
    rows = ['..###..........', '.#ddd#.........', '.#ddd#.........', '.#ddd#.........', '.#ddd#.........',
            '.#ddd#.........', '.#ddd#.........', '.#ddd#..#####..', '..#dd#..#......', '..#dd#..#......',
            '..#############', '...###########.', '.......##......', '.......##......', '.......##......',
            '.......##......', '..###########..', '..d....d....d..']
    if tipped:
        rows = [''.join(r[y_] for r in reversed(rows)) for y_ in range(len(rows[0]))]
    p.bitmap(x, y, rows, {'#': c, 'd': dark})


def p09(p):     # OpenAI · SAFETY TEAM: NOW HIRING. · AGAIN.
    openai_stock(p)
    openai_logo(p, 90, 8, 29, word='left', s=1)
    y = headline(p, p.headline, 46, modes=('x2',), maxlines=4, ink=C(O['white']), ramp=white_ramp)
    # the subline, stamped in the one accent colour
    sw = FONT.width(p.subline, 2, -2)
    sx0, sy0 = 119 - sw - 6, y + 8
    p.frame(sx0 - 5, sy0 - 5, 119, sy0 + 14, C(O['accent']))
    p.frame(sx0 - 4, sy0 - 4, 118, sy0 + 13, C(O['accent']))
    p.text(p.subline, sx0, sy0, C(O['accent']), 2, 2, -2)
    base = 154
    p.rect(8, base - 26, 119, base - 25, C(O['dark']))       # the long empty desk behind
    for lx in (10, 116):
        p.rect(lx, base - 24, lx + 1, base, C(O['deep']))
    for nx in (14, 46, 78):                                   # blank name plates
        p.rect(nx, base - 30, nx + 13, base - 27, C(O['light']))
    chair(p, 14, base - 17, C(O['mid']), C(O['deep']))
    chair(p, 46, base - 17, C(O['mid']), C(O['deep']))
    chair(p, 86, base - 14, C(O['mid']), C(O['deep']), tipped=True)
    rule(p, 8, 119, base + 1, C(O['dark']))
    fine(p, p.fine, base + 8, ink=C(O['dim']))
    return dict(torn='bl', tape=('tl', 'tr'), fade=(110, 100, 50))


def p11(p):     # OpenAI · HER. · the voice that never hangs up
    openai_stock(p)
    p.text(p.headline, 10, 13, C(O['white']), 4, 4, -4, ramp=white_ramp)
    cx, cy, r = 64, 70, 25
    p.disc(cx, cy, r, C(O['light']))
    p.disc(cx, cy, r - 2, C(O['deep']))
    for k, hh in enumerate([4, 8, 14, 20, 26, 18, 30, 22, 12, 16, 8, 4]):
        x = cx - 23 + k * 4
        p.rect(x, cy - hh // 2, x + 1, cy + hh // 2, C(O['accent']))
    y = sub(p, p.subline, 104, ink=C(O['white']), align='center')
    ty = y + 9
    p.rect(10, ty, 33, ty + 11, C(O['light']))
    p.rect(11, ty + 1, 32, ty + 10, C(O['accent_dk']))
    p.disc(27, ty + 5, 4, C(O['white']))
    p.text('ON', 13, ty + 3, C(O['white']))
    fine(p, p.fine, ty + 1, x0=40, ink=C(O['dim']))
    openai_logo(p, 74, 160, 25, word='left', s=1)
    return dict(torn='br', tape=('tl', 'tr'), fade=(0, 0, 60))


def p13(p):     # OpenAI · MAKE YOUR OWN GPT. · you, boxed, collectible
    openai_stock(p)
    y = headline(p, p.headline, 10, modes=('x2', 'tall'), ink=C(O['white']), ramp=white_ramp)
    cx0, cy0, cx1, cy1 = 24, y + 10, 103, 172
    card, cardd = C(O['light']), C(O['mid'])
    p.rect(cx0, cy0 + 6, cx1, cy1, card)
    p.rect(54, cy0, 73, cy0 + 6, card)
    p.rect(60, cy0 + 2, 67, cy0 + 3, C(O['field']))
    p.rect(cx1 + 1, cy0 + 8, cx1 + 1, cy1 + 1, cardd)
    p.rect(cx0 + 2, cy1 + 1, cx1 + 1, cy1 + 1, cardd)
    draw_rosette(p.img, cx0 + 4, cy0 + 10, 17, C(0), stroke=2.2)
    draw_wordmark(p.img, 'OPENAI', cx0 + 25, cy0 + 15, C(0), track=1)
    bx0, by0, bx1, by1 = cx0 + 8, cy0 + 31, cx1 - 8, cy1 - 26
    p.rect(bx0, by0, bx1, by1, C(O['white']))
    p.frame(bx0, by0, bx1, by1, C(O['mid']))
    p.rect(bx0 + 2, by0 + 2, bx0 + 3, by1 - 6, C(81))
    who = duotone(person(1.0, 0), [0, 106, 101, 96, 91, 86, 82], 0.9)
    p.sprite(who, (bx0 + bx1) // 2 - who.width // 2, by1 - 1 - who.height)
    p.text('YOU', cx0, cy1 - 20, C(0), 2, 2, -2, align='center', x1=cx1)
    p.disc(cx1 - 6, cy0 + 37, 9, C(O['accent']))
    p.text('NEW', cx1 - 15, cy0 + 35, C(0), track=-1, align='center', x1=cx1 + 3)
    sub(p, p.subline, cy1 + 7, ink=C(O['white']), align='center')
    return dict(torn='tr', tape=('tl', 'bl'), fade=(128, 192, 60))


def glitch(p, bands):
    d = p.img.load()
    for y0, h_, dx in bands:
        for y in range(y0, y0 + h_):
            row = [d[x, y] for x in range(W)]
            for x in range(4, W - 4):
                sxp = min(W - 5, max(4, x - dx))
                d[x, y] = row[sxp]


def p15(p):     # OpenAI · SORA · a sky that never existed, glitching
    openai_stock(p)
    openai_logo(p, 8, 8, 25, s=1)
    y = headline(p, p.headline, 42, modes=('x4', 'x3'), align='center', ink=C(O['white']), ramp=white_ramp)
    fx0, fy0, fx1, fy1 = 10, y + 9, 117, y + 9 + 58
    for yy in range(fy0, fy1 + 1):
        t = (yy - fy0) / (fy1 - fy0)
        a, b = (C(108), C(104)) if t < 0.5 else (C(104), C(100))
        for xx in range(fx0, fx1 + 1):
            p.px(xx, yy, b if (xx + yy) % 2 == 0 and (t * 4) % 1 > 0.5 else a)
    for (cx, cy, r) in ((30, fy0 + 18, 7), (40, fy0 + 15, 9), (51, fy0 + 19, 6), (86, fy0 + 30, 6), (95, fy0 + 27, 8),
                        (104, fy0 + 31, 5)):
        p.disc(cx, cy, r, C(O['light']))
    p.rect(fx0, fy1 - 10, fx1, fy1, C(O['deep']))
    p.frame(fx0, fy0, fx1, fy1, C(O['light']))
    mx, my = 64, (fy0 + fy1) // 2 - 2
    p.disc(mx + 1, my, 11, C(0))
    p.poly([(mx - 4, my - 7), (mx - 4, my + 7), (mx + 8, my)], C(O['white']))
    p.rect(fx0 + 4, fy1 - 5, fx1 - 4, fy1 - 4, C(O['dark']))
    p.rect(fx0 + 4, fy1 - 5, fx0 + 48, fy1 - 4, C(O['accent']))
    glitch(p, [(14, 1, 3), (y - 6, 1, -3), (fy0 + 9, 2, -6), (fy0 + 33, 3, 4), (fy0 + 46, 1, -3)])
    for (gx, gy, gw) in ((92, 24, 9), (14, fy0 + 24, 6), (70, fy0 + 40, 11)):
        p.rect(gx, gy, gx + gw, gy, C(O['accent']))
    y = sub(p, p.subline, fy1 + 8, ink=C(O['white']), align='center')
    fine(p, p.fine, y + 5, ink=C(O['dim']), align='center')
    return dict(torn='bl', tape=('tl', 'tr'))


def p16(p):     # OpenAI · STARGATE · the gate, the pod, the power supply (you)
    openai_stock(p)
    openai_logo(p, 8, 8, 25, s=1)
    y = headline(p, p.headline, 40, modes=('x2',), ink=C(O['white']), ramp=white_ramp)
    cx, cy, R = 64, y + 40, 33
    p.ring(cx, cy, R, C(O['mid']), 6)
    p.ring(cx, cy, R - 6, C(O['dark']), 1)
    for k in range(9):
        a = math.radians(-90 + k * 40)
        ux, uy = math.cos(a), math.sin(a)
        px_, py_ = cx + ux * (R - 2), cy + uy * (R - 2)
        nx, ny = -uy, ux
        p.poly([(px_ + ux * 4 + nx * 3, py_ + uy * 4 + ny * 3), (px_ + ux * 4 - nx * 3, py_ + uy * 4 - ny * 3), (px_ - ux * 2, py_ - uy * 2)],
               C(O['accent']))
    who = duotone(person(0.62, 1), O['ramp'], 0.8)
    pod = duotone(load_sprite(SPRITES / 'HPODA0.png', 0.62), O['ramp'], 0.8, C(O['accent']), cyanish)
    px0, py0 = cx - pod.width // 2, cy - pod.height // 2 + 2
    for yy in range(py0 + 6, py0 + pod.height - 9):
        for xx in range(px0 + 6, px0 + pod.width - 6):
            if (xx + yy) % 2 == 0:
                p.px(xx, yy, C(O['accent_dk']))
    p.sprite(who, cx - who.width // 2, py0 + 5)
    p.sprite(pod, px0, py0)
    y = sub(p, p.subline, cy + R + 8, ink=C(O['light']))
    fine(p, p.fine, y + 5, ink=C(O['dim']))
    return dict(torn='tr', tape=('tl', 'br'), fade=(0, 192, 70))


def agent(p, x, y, s, skin, suit, shirt, accent):
    """A suited Agent: sunglasses, earpiece. s = 1.0 normal height ~54 px."""
    hw = int(9 * s)
    hh = int(11 * s)
    p.draw.ellipse((x - hw // 2, y, x + hw // 2, y + hh), fill=skin)
    p.rect(x - hw // 2, y, x + hw // 2, y + int(2 * s), suit)                      # hair
    gy = y + int(4 * s)
    p.rect(x - hw // 2, gy, x + hw // 2, gy + max(1, int(2 * s)), suit)            # sunglasses
    p.px(x - hw // 2 + 1, gy, C(O['white']))
    p.rect(x - 1, y + hh + 1, x + 1, y + hh + 2, skin)                              # neck
    ty = y + hh + 3
    bw = int(13 * s)
    p.poly([(x - bw, ty + 4), (x - bw + 3, ty), (x + bw - 3, ty), (x + bw, ty + 4), (x + bw, ty + int(24 * s)),
            (x - bw, ty + int(24 * s))], suit)
    p.poly([(x - 3, ty), (x + 3, ty), (x, ty + 7)], shirt)
    p.rect(x, ty + 2, x, ty + int(12 * s), suit)
    p.rect(x - int(8 * s), ty + int(24 * s) + 1, x - 1, ty + int(40 * s), suit)    # legs
    p.rect(x + 1, ty + int(24 * s) + 1, x + int(8 * s), ty + int(40 * s), suit)
    p.px(x + hw // 2 + 1, y + int(6 * s), accent)                                   # earpiece
    for k in range(int(8 * s)):
        p.px(x + hw // 2 + 1 + (k > 3), y + int(7 * s) + k, accent)


def p19(p):     # OpenAI · AGENTS · three of them, already handling it
    openai_stock(p)
    y = headline(p, p.headline, 10, modes=('x2t', 'x2'), align='center', ink=C(O['white']), ramp=white_ramp)
    px0, py0, px1, py1 = 10, y + 8, 117, y + 82
    p.rect(px0, py0, px1, py1, C(O['light']))
    for yy in range(py0 + 2, py1, 4):
        p.rect(px0 + 1, yy, px1 - 1, yy, C(84))
    p.frame(px0, py0, px1, py1, C(O['white']))
    agent(p, 36, py0 + 18, 1.0, C(O['mid']), C(0), C(O['white']), C(O['accent']))
    agent(p, 92, py0 + 18, 1.0, C(O['mid']), C(0), C(O['white']), C(O['accent']))
    agent(p, 64, py0 + 8, 1.2, C(O['mid']), C(0), C(O['white']), C(O['accent']))
    y = sub(p, p.subline, py1 + 7, ink=C(O['white']))
    y = fine(p, p.fine, y + 4, ink=C(O['dim']))
    openai_logo(p, 8, 166, 20, s=1)
    return dict(torn='tl', tape=('tr', 'br'), fade=(128, 96, 50))


def p04(p):     # Anthropic · HELPFUL. HONEST. HARMLESS. · graded 2/3
    anthropic_stock(p)
    anthropic_logo(p, 8, 9, 16)
    rule(p, 8, 119, 30, C(A['ink']))
    words = [w for w in p.headline.split(' ') if w]
    ink, coral = C(A['ink']), C(A['coral'])
    for k, w in enumerate(words):
        y = 40 + k * 20
        p.frame(9, y - 2, 21, y + 10, ink)
        p.frame(10, y - 1, 20, y + 9, ink)
        p.text(w, 28, y, ink, 1, 2, 0, shadow=coral)
        if k < len(words) - 1:     # tick
            p.line([(12, y + 4), (15, y + 8), (23, y - 5)], ink, 2)
        else:                      # the one that didn't make it
            p.line([(7, y - 4), (24, y + 12)], coral, 3)
            p.line([(24, y - 5), (7, y + 12)], coral, 3)
    h = duotone(hunter(1.0, 'HUNTA1'), A['ramp'], 1.1, C(A['coral']), bluish)
    p.sprite(h, 76, 102)
    gx, gy = 38, 132
    p.ring(gx, gy, 20, coral, 2)
    p.ring(gx, gy, 17, coral, 1)
    p.text('2/3', gx - 16, gy - 5, coral, 1, 2, 0, align='center', x1=gx + 16)
    rule(p, 8, 119, 167, ink)
    sub(p, p.subline, 173, ink=ink, align='center')
    return dict(torn='bl', tape=('tl', 'tr'), stain=(104, 58, 11))


def skyline(p, y, x0, x1, c, rng):
    x = x0
    while x <= x1:
        w = rng.randint(5, 11)
        h = rng.randint(6, 18)
        p.rect(x, y - h, min(x1, x + w - 1), y, c)
        if rng.random() < 0.4:
            p.rect(x + w // 2, y - h - 4, x + w // 2, y - h, c)
        x += w + rng.choice((0, 0, 1))


def p07(p):     # Claude · CLAUDE CAN MAKE MISTAKES. · the logo, as the blast
    anthropic_stock(p)
    claude_logo(p, 7, 6, 11)
    rule(p, 8, 119, 30, C(A['ink']))
    cx, cy, ground = 64, 66, 102
    p.poly([(57, ground), (60, cy + 10), (68, cy + 10), (71, ground)], C(A['coral_dk']))   # the stalk
    draw_starburst(p.img, cx, cy, 31, C(A['coral']))
    draw_starburst(p.img, cx, cy, 12, C(A['coral_lt']), rot=15)
    rng = random.Random(77)
    for _ in range(14):                                                             # debris
        a = rng.uniform(math.pi, 2 * math.pi) if _ % 3 else rng.uniform(0, 2 * math.pi)
        r = rng.uniform(33, 40)
        x_, y_ = round(cx + math.cos(a) * r), round(cy + math.sin(a) * r * 0.85)
        if y_ > 33:
            p.rect(x_, y_, x_ + 1, y_, C(A['coral']))
    p.rect(8, ground, 119, ground + 4, C(A['ink']))
    skyline(p, ground, 8, 119, C(A['ink']), rng)
    y = headline(p, p.headline, 113, modes=('x2', 'tall'), ink=C(A['ink']), shadow=C(A['coral']))
    lines = wrap(p.subline, 112)
    y0 = y + 9
    sub(p, p.subline, y0, ink=C(A['ink']), lines=lines)
    k = next((i for i, ln in enumerate(lines) if 'CHECK' in ln), 0)
    ex = 8 + FONT.width(lines[k]) + 6
    ex = min(ex, 108)
    for dx in (0, 4):                                                               # the double-check mark
        p.line([(ex + dx, y0 + k * 9 + 1), (ex + dx + 2, y0 + k * 9 + 4), (ex + dx + 7, y0 + k * 9 - 3)],
               C(A['coral']), 2)
    return dict(torn='br', staples=True, stain=(104, 44, 9))


def skull(p, x, y, c, eye):
    p.bitmap(x, y, ['.#####.', '#######', '#.###.#', '#######', '.##.##.', '.#.#.#.'], {'#': c})
    p.px(x + 1, y + 2, eye)
    p.px(x + 5, y + 2, eye)


def p08(p):     # Anthropic · INTERPRETABILITY · found the feature
    anthropic_stock(p)
    mw = monogram_width(16)
    anthropic_logo(p, 64 - mw // 2, 8, 16, word='below')
    y = headline(p, p.headline, 45, modes=('tall',), align='center', ink=C(A['ink']), shadow=C(A['coral']))
    rule(p, 8, 119, y + 5, C(A['ink']))
    oy = 7
    layers = [(16, [62, 78, 94, 110]), (44, [56, 70, 84, 98, 112]), (72, [56, 70, 84, 98, 112]), (100, [70, 86, 102])]
    layers = [(x, [v + oy for v in ys]) for x, ys in layers]
    hot = (72, 84 + oy)
    for (xa, ya_s), (xb, yb_s) in zip(layers, layers[1:]):
        for ya in ya_s:
            for yb in yb_s:
                n = max(abs(xb - xa), abs(yb - ya))
                for k in range(0, n, 2):
                    p.px(round(xa + (xb - xa) * k / n), round(ya + (yb - ya) * k / n), C(A['kraft']))
    p.line([(16, 78 + oy), (44, 98 + oy), (72, 84 + oy), (100, 86 + oy)], C(A['ink']), 1)
    for x, ys in layers:
        for yy in ys:
            p.disc(x, yy, 3, C(A['ink']))
            p.disc(x, yy, 1, C(A['paper']))
    lx, ly, lr = hot[0] + 2, hot[1] - 2, 15      # magnifier over the hot feature
    p.disc(lx, ly, lr, C(A['paper']))
    p.disc(lx, ly, lr - 3, C(A['coral_lt']))
    p.ring(lx, ly, lr, C(A['ink']), 3)
    p.line([(lx + 11, ly + 11), (lx + 22, ly + 22)], C(A['ink']), 4)
    p.line([(lx + 11, ly + 11), (lx + 15, ly + 15)], C(A['coral']), 4)
    skull(p, lx - 3, ly - 4, C(A['ink']), C(A['coral']))
    y = sub(p, p.subline, 135, ink=C(A['ink']))
    fine(p, p.fine, y + 6, ink=C(A['fine']))
    return dict(torn='tl', tape=('tr', 'bl'), stain=(20, 150, 11))


def p10(p):     # Anthropic · CONSTITUTIONAL AI · a sealed document; yours is a receipt
    anthropic_stock(p)
    anthropic_logo(p, 8, 9, 16)
    y = headline(p, p.headline, 36, modes=('x2', 'tall'), ink=C(A['ink']), shadow=C(A['coral']), maxlines=2)
    dx0, dy0, dx1, dy1 = 10, y + 8, 94, y + 80
    p.rect(dx0 + 2, dy0 + 2, dx1 + 2, dy1 + 2, C(A['kraft']))
    p.rect(dx0, dy0, dx1, dy1, C(A['paper3']))
    p.frame(dx0, dy0, dx1, dy1, C(A['ink']))
    p.frame(dx0 + 3, dy0 + 3, dx1 - 3, dy1 - 3, C(A['coral_dk']))
    p.text('WE THE MODEL', dx0, dy0 + 8, C(A['ink']), align='center', x1=dx1, track=-1)
    rng = random.Random(1787)
    for k in range(6):
        yy = dy0 + 20 + k * 6
        x = dx0 + 8
        end = dx1 - 8 - (24 if k >= 4 else 0)
        while x < end:
            w_ = rng.randint(3, 9)
            p.rect(x, yy, min(end, x + w_), yy, C(A['brown']))
            x += w_ + 2
    sx_, sy_ = dx1 - 15, dy1 - 14
    p.disc(sx_, sy_, 11, C(A['coral_dk']))
    p.disc(sx_, sy_, 10, C(A['coral']))
    draw_monogram(p.img, sx_ - 7, sy_ - 4, 9, C(A['paper']))
    for k in range(3):     # signature
        p.line([(dx0 + 9 + k * 8, dy1 - 10), (dx0 + 13 + k * 8, dy1 - 14), (dx0 + 17 + k * 8, dy1 - 9)], C(A['ink']), 1)
    # ...and yours: an endless till-roll of terms, spilling to the floor
    rx0, rx1, ry0, ry1 = 99, 119, dy0 - 4, dy1 + 6
    p.rect(rx0, ry0, rx1, ry1, C(80))
    p.frame(rx0, ry0, rx1, ry1, C(A['ink']))
    for x in range(rx0, rx1 + 1, 2):                         # torn zig-zag top
        p.px(x, ry0, C(A['paper']))
    p.text('TOS', rx0, ry0 + 5, C(A['ink']), track=-1, align='center', x1=rx1)
    for yy in range(ry0 + 14, ry1 - 1, 3):
        p.rect(rx0 + 3, yy, rx1 - 3 - (yy * 7) % 5, yy, C(A['fine']))
    p.poly([(rx0, ry1), (rx1, ry1), (rx1 + 3, ry1 + 4), (rx0 - 8, ry1 + 5)], C(80))     # the curl
    p.line([(rx0 - 8, ry1 + 5), (rx1 + 3, ry1 + 4)], C(A['ink']))
    p.line([(rx0, ry1), (rx0 - 8, ry1 + 5)], C(A['ink']))
    sub(p, p.subline, dy1 + 13, ink=C(A['ink']))
    return dict(torn='br', staples=True, fade=(0, 192, 60))


def doll(p, x, y):
    """Companion doll, arms out. (x,y) = top-left of a ~40x58 box."""
    ink, skin, coral, lt = C(A['ink']), C(A['paper3']), C(A['coral']), C(A['coral_lt'])
    cx = x + 20
    # yarn hair
    p.disc(cx, y + 13, 14, ink)
    p.disc(cx, y + 13, 13, coral)
    for k in range(-12, 13, 3):
        p.rect(cx + k, y + 20, cx + k + 1, y + 30 + (k * k) % 5, coral)
    # face
    p.disc(cx, y + 15, 10, ink)
    p.disc(cx, y + 15, 9, skin)
    p.rect(cx - 9, y + 4, cx + 9, y + 9, coral)   # fringe
    for ex in (cx - 4, cx + 4):                    # button eyes
        p.disc(ex, y + 13, 2, ink)
        p.px(ex - 1, y + 12, C(A['paper']))
    p.px(cx - 4, y + 13, coral)
    p.px(cx + 4, y + 13, coral)
    p.rect(cx - 8, y + 17, cx - 7, y + 18, lt)     # cheeks
    p.rect(cx + 7, y + 17, cx + 8, y + 18, lt)
    p.line([(cx - 5, y + 19), (cx - 2, y + 21), (cx + 2, y + 21), (cx + 5, y + 19)], ink, 1)   # stitched grin
    for sxx in (cx - 4, cx - 1, cx + 2):
        p.px(sxx, y + 22, ink)
    # dress
    p.poly([(cx - 7, y + 25), (cx + 7, y + 25), (cx + 14, y + 46), (cx - 14, y + 46)], ink)
    p.poly([(cx - 6, y + 26), (cx + 6, y + 26), (cx + 12, y + 45), (cx - 12, y + 45)], coral)
    for k in range(-10, 11, 4):
        p.px(cx + k, y + 43, C(A['paper']))
    # arms reaching for you
    for sgn in (-1, 1):
        p.line([(cx + sgn * 6, y + 29), (cx + sgn * 17, y + 24), (cx + sgn * 21, y + 21)], ink, 3)
        p.line([(cx + sgn * 6, y + 29), (cx + sgn * 17, y + 24)], skin, 1)
        p.disc(cx + sgn * 21, y + 21, 2, skin)
        p.ring(cx + sgn * 21, y + 21, 2, ink)
    # legs + shoes
    for lx in (cx - 5, cx + 3):
        p.rect(lx, y + 47, lx + 2, y + 54, skin)
        p.rect(lx - 1, y + 47, lx - 1, y + 54, ink)
        p.rect(lx + 3, y + 47, lx + 3, y + 54, ink)
        p.rect(lx - 2, y + 55, lx + 4, y + 57, ink)


def p12(p):     # Anthropic · WE DON'T OPTIMIZE FOR ENGAGEMENT. · the doll asks you to stay
    anthropic_stock(p)
    anthropic_logo(p, 8, 9, 16)
    rule(p, 8, 119, 30, C(A['coral']), 2)
    y = headline(p, p.headline, 38, modes=('tall',), ink=C(A['ink']), shadow=C(A['coral']))
    doll(p, 6, y + 30)
    bx0, by0, bx1 = 52, y + 12, 119
    lines = wrap(p.subline, bx1 - bx0 - 7)
    by1 = by0 + 7 + len(lines) * 9
    p.rect(bx0, by0, bx1, by1, C(A['ink']))
    p.rect(bx0 + 1, by0 + 1, bx1 - 1, by1 - 1, C(A['paper']))
    p.poly([(bx0 + 4, by1), (bx0 - 8, by1 + 14), (bx0 + 13, by1)], C(A['ink']))
    p.poly([(bx0 + 5, by1 - 1), (bx0 - 5, by1 + 10), (bx0 + 12, by1 - 1)], C(A['paper']))
    sub(p, p.subline, by0 + 5, x0=bx0 + 4, x1=bx1 - 3, ink=C(A['ink']), lines=lines)
    fy = 158
    rule(p, 56, 119, fy - 6, C(A['ink']))
    fine(p, p.fine, fy, x0=56, ink=C(A['fine']))
    return dict(torn='tr', tape=('tl', 'br'), fade=(128, 192, 60))


def heart(p, cx, cy, r, c):
    p.disc(cx - r // 2 - 1, cy - r // 3, r // 2 + 2, c)
    p.disc(cx + r // 2 + 1, cy - r // 3, r // 2 + 2, c)
    p.poly([(cx - r - 1, cy - r // 4), (cx + r + 1, cy - r // 4), (cx, cy + r)], c)


def clock(p, cx, cy, r, ink, face):
    p.disc(cx, cy, r, ink)
    p.disc(cx, cy, r - 1, face)
    p.line([(cx, cy), (cx, cy - r + 2)], ink)                    # 12
    p.line([(cx, cy), (cx + 2, cy + 3)], ink)                    # 5
    p.px(cx, cy, ink)


def p14(p):     # Anthropic · MACHINES OF LOVING GRACE · the embrace
    anthropic_stock(p)
    anthropic_logo(p, 8, 9, 16)
    y = headline(p, p.headline, 35, modes=('x2', 'tall'), align='center', ink=C(A['ink']), shadow=C(A['coral']))
    heart(p, 64, y + 42, 40, C(A['coral']))
    heart(p, 64, y + 40, 34, C(A['coral_lt']))
    hb = duotone(hunter(1.0, 'HUNTA1'), [6, 6, 6, 79, 77], 1.0, C(A['coral']), bluish)
    who = duotone(person(0.78, 4), [70, 65, 61, 57, 53, 50, 49], 0.8, outline=C(A['ink']))
    hx, hy = 64 - hb.width // 2, y + 6
    p.sprite(hb, hx, hy)
    wx, wy = 64 - who.width // 2 + 1, hy + 18
    p.sprite(who, wx, wy)
    ink = C(A['ink'])
    for side in (-1, 1):            # the machine's arms close around the human
        sx_ = 64 + side * 15
        p.line([(sx_, hy + 20), (64 + side * 12, wy + 17), (64 + side * 2, wy + 21)], ink, 3)
        p.line([(64 + side * 11, wy + 17), (64 + side * 3, wy + 20)], C(A['coral_dk']), 1)
    y2 = sub(p, p.subline, hy + hb.height + 4, ink=ink, align='center')
    clock(p, 22, y2 + 11, 7, ink, C(A['paper']))
    fine(p, p.fine, y2 + 8, x0=34, ink=C(A['fine']))
    return dict(torn='bl', tape=('tl', 'tr'), stain=(108, 64, 8))


def rack(p, x, y, w, h, cap=True):
    ink, coral, paper = C(A['ink']), C(A['coral']), C(A['paper'])
    p.rect(x, y, x + w - 1, y + h - 1, ink)
    for k, yy in enumerate(range(y + 3, y + h - 3, 4)):
        p.rect(x + 2, yy, x + w - 3, yy + 1, C(A['brown']))
        p.px(x + w - 4, yy, coral if k % 3 else C(A['coral_lt']))
    if cap:   # mortarboard
        cx = x + w // 2
        p.poly([(cx - 13, y - 5), (cx, y - 10), (cx + 13, y - 5), (cx, y)], ink)
        p.rect(cx - 6, y - 4, cx + 6, y, ink)
        p.line([(cx, y - 6), (cx + 11, y - 3), (cx + 11, y + 4)], coral, 1)
        p.rect(cx + 10, y + 4, cx + 12, y + 6, coral)


def p17(p):     # Anthropic · A COUNTRY OF GENIUSES IN A DATA CENTER · graduated racks
    anthropic_stock(p)
    y = headline(p, p.headline, 10, modes=('tall',), ink=C(A['ink']), shadow=C(A['coral']))
    base = y + 66
    rack(p, 12, base - 32, 22, 32)
    rack(p, 53, base - 38, 22, 38)
    rack(p, 94, base - 32, 22, 32)
    p.rect(64, base - 58, 64, base - 48, C(A['ink']))           # flag over the middle rack
    p.rect(65, base - 58, 83, base - 49, C(A['coral']))
    draw_monogram(p.img, 68, base - 57, 8, C(A['paper']))
    rule(p, 8, 119, base, C(A['ink']))
    y = sub(p, p.subline, base + 7, ink=C(A['ink']))
    fine(p, p.fine, y + 5, ink=C(A['fine']))
    p.rect(3, 165, W - 4, 188, C(A['coral']))
    anthropic_logo(p, 9, 169, 16, ink=C(A['ink']))
    return dict(torn='tr', tape=('tl',), fade=(128, 96, 60))


def p18(p):     # Claude · CLAUDE CODE · your job, done, removed
    anthropic_stock(p)
    claude_logo(p, 7, 6, 11)
    rule(p, 8, 119, 30, C(A['ink']))
    y = headline(p, p.headline, 38, modes=('x2',), ink=C(A['ink']), shadow=C(A['coral']))
    tx0, ty0, tx1, ty1 = 8, y + 9, 117, y + 52
    p.rect(tx0 + 2, ty0 + 2, tx1 + 2, ty1 + 2, C(A['kraft']))
    p.rect(tx0, ty0, tx1, ty1, C(A['ink']))
    p.rect(tx0, ty0, tx1, ty0 + 6, C(109))
    for k, c in enumerate((A['coral'], A['oat'], A['paper'])):
        p.disc(tx0 + 5 + k * 6, ty0 + 3, 1, C(c))
    p.text('> DO MY JOB', tx0 + 5, ty0 + 12, C(A['paper']))
    draw_starburst(p.img, tx0 + 8, ty0 + 25, 3, C(A['coral']))
    p.text('DONE.', tx0 + 15, ty0 + 23, C(A['coral']))
    p.text('> _', tx0 + 5, ty0 + 34, C(A['paper']))
    y = sub(p, p.subline, ty1 + 9, x1=82, ink=C(A['ink']))
    # the cardboard box of desk things
    bx, by = 88, 160
    p.rect(bx + 3, by - 12, bx + 9, by - 1, C(A['paper']))             # mug
    p.frame(bx + 2, by - 13, bx + 10, by - 1, C(A['ink']))
    p.ring(bx + 12, by - 8, 2, C(A['ink']))
    p.rect(bx + 21, by - 16, bx + 21, by - 1, C(A['ink']))             # plant
    for (lx, ly) in ((17, 18), (25, 16), (19, 23), (24, 22)):
        p.disc(bx + lx, by - ly, 2, C(A['ink']))
    p.rect(bx + 13, by - 15, bx + 15, by - 1, C(A['oat']))              # framed photo
    p.frame(bx + 12, by - 16, bx + 16, by - 1, C(A['ink']))
    p.rect(bx - 2, by, bx + 30, by + 22, C(A['coral_dk']))
    p.frame(bx - 2, by, bx + 30, by + 22, C(A['ink']))
    p.rect(bx - 1, by + 1, bx + 29, by + 3, C(A['coral_deep']))
    p.rect(bx + 8, by + 9, bx + 20, by + 10, C(A['coral_deep']))       # hand-hole
    return dict(torn='bl', tape=('tl', 'tr'), stain=(30, 64, 9))


def flames(p, cx, base, w, h):
    """Layered flame tongues: ink outline, coral body, pale core."""
    tongues = [(-0.8, 0.45, -3), (-0.45, 0.75, -2), (0.0, 1.0, 1), (0.42, 0.7, 3), (0.78, 0.4, 2)]
    for colour, grow, shrink in ((A['ink'], 1.5, 0), (A['coral'], 0.0, 0), (A['coral_lt'], -1.2, 0.45)):
        for off, hh, lean in tongues:
            x = cx + off * w
            top = base - h * hh * (1 - shrink)
            bw = w * 0.42 * (1 - shrink) + grow
            p.poly([(x - bw, base + grow * 0.5), (x - bw * 0.55, base - (base - top) * 0.45),
                    (x + lean, top - grow), (x + bw * 0.55, base - (base - top) * 0.5), (x + bw, base + grow * 0.5)],
                   C(colour))


def p20(p):     # Anthropic · A RACE TO THE TOP · the summit is on fire
    anthropic_stock(p)
    y = headline(p, p.headline, 10, modes=('x2', 'tall'), ink=C(A['ink']), shadow=C(A['coral']))
    ink = C(A['ink'])
    peak = (78, y + 36)
    base = 134
    p.poly([(4, base), peak, (123, base)], ink)
    p.poly([(9, base - 1), (peak[0], peak[1] + 3), (118, base - 1)], C(A['paper3']))
    for k in range(0, 40, 3):
        p.line([(peak[0] + 2 + k, peak[1] + 6 + k * 2), (peak[0] + 2 + k, base - 2)], C(A['oat']))
    flames(p, peak[0], peak[1] + 6, 15, 30)
    p.rect(peak[0] - 12, peak[1] - 22, peak[0] - 12, peak[1] - 2, ink)   # flag planted in the fire
    p.rect(peak[0] - 26, peak[1] - 22, peak[0] - 13, peak[1] - 14, C(A['coral']))
    draw_monogram(p.img, peak[0] - 23, peak[1] - 21, 7, C(A['paper']))
    for (cx, cy) in ((30, 118), (46, 100), (106, 118)):                 # the other runners
        p.disc(cx, cy - 6, 1, ink)
        p.line([(cx, cy - 4), (cx, cy)], ink)
        p.line([(cx, cy), (cx - 2, cy + 3)], ink)
        p.line([(cx, cy), (cx + 2, cy + 3)], ink)
        p.line([(cx, cy - 3), (cx + 3, cy - 5)], ink)
    p.rect(4, base, 123, base, ink)
    y = sub(p, p.subline, base + 8, ink=ink, align='center')
    p.rect(8, y + 5, 119, y + 16, C(A['ink']))
    fine(p, p.fine, y + 8, ink=C(A['coral']), align='center')
    mw = monogram_width(14) + 6 + wordmark_width('ANTHROP\\C')
    anthropic_logo(p, 64 - mw // 2, y + 24, 14)
    return dict(torn='br', tape=('tl', 'tr'), stain=(24, 70, 10))


COMPOSE = {1: p01, 2: p02, 3: p03, 4: p04, 5: p05, 6: p06, 7: p07, 8: p08, 9: p09, 10: p10,
           11: p11, 12: p12, 13: p13, 14: p14, 15: p15, 16: p16, 17: p17, 18: p18, 19: p19, 20: p20}


def check_layout(p):
    """Warn when type leaves the printable area or two text runs collide."""
    probs = []
    for k, (x0, y0, x1, y1) in enumerate(p.protect):
        if x0 < 3 or y0 < 3 or x1 > W - 4 or y1 > H - 4:
            probs.append(f'text box {k} {(x0, y0, x1, y1)} outside the sheet')
        for j in range(k):
            a = p.protect[j]
            if x0 < a[2] and a[0] < x1 and y0 < a[3] and a[1] < y1:
                probs.append(f'text boxes {j} and {k} overlap')
    return probs


def build_poster(row):
    p = Poster(row)
    wear_args = COMPOSE[p.id](p) or {}
    p.problems = check_layout(p)
    wear(p, **wear_args)
    return finish(p), p


# ============================================================================ previews
def colormap(level):
    data = ART.lumps['COLORMAP']
    return data[level * 256:(level + 1) * 256]


def lit(im, level):
    """Doom light diminishing via the WAD's own COLORMAP (0 = full bright)."""
    cm = colormap(level)
    out = im.copy().convert('RGBA')
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                i = PAL.index.get((r, g, b))
                if i is None:
                    i = PAL.index[PAL.near((r, g, b))]
                px[x, y] = (*PAL(cm[i]), a)
    return out


def label(img, text, x, y, colour, s=2, align='left', x1=None):
    lo, hi = FONT.extent(text, s, -s if s > 1 else 0)
    if align == 'center':
        x = (x + x1) // 2 - (lo + hi) // 2
    FONT.draw(img, text, x - lo, y, colour, sx=s, sy=s, track=-s if s > 1 else 0, shadow=PAL(0), shadow_off=(s, s))


def all_posters_preview(images):
    s, gap, top = 3, 18, 34
    pw, ph = W * s, H * s
    head = 46
    sheet = Image.new('RGB', (5 * pw + 6 * gap, 4 * (head + ph + top) + gap), PAL(108))
    for lvl in range(1, 5):
        y0 = (lvl - 1) * (head + ph + top) + gap
        info = LEVELS[lvl]
        label(sheet, f"LEVEL {lvl}: {info['name']}  ({info['map']})", gap, y0 + 8, PAL(160), 3)
        row = [r for r in POSTERS if r[1] == lvl]
        for k, r in enumerate(row):
            x = gap + k * (pw + gap)
            big = images[r[0]].resize((pw, ph), Image.NEAREST)
            sheet.paste(big, (x, y0 + head), big)
            label(sheet, f"PDP{r[0]:02d}  {r[2].upper()}", x, y0 + head + ph + 8, PAL(80), 2)
    return sheet


def in_world_preview(images):
    """True in-game scale at 2x: wall texels are 2x2 px, poster pixels 1x1 (XScale/YScale 2)."""
    panels = [(1, 'BROWNGRN', (3, 2)), (2, 'STARTAN3', (6, 8)), (2, 'COMPTALL', (7, 10)), (3, 'SHAWN2', (12, 13)),
              (4, 'BROWN1', (16, 17)), (4, 'SHAWN2', (19, 20))]
    pw, ph = 256 * 2, 128 * 2
    head = 30
    sheet = Image.new('RGB', (2 * pw + 3 * 12, 3 * (ph + head) + 12), PAL(6))
    who = load_sprite(OUTSIDE / 'person-1-0-0.png')
    who = who.resize((who.width * 2, who.height * 2), Image.NEAREST)
    for k, (lvl, tex, ids) in enumerate(panels):
        x0 = 12 + (k % 2) * (pw + 12)
        y0 = 6 + (k // 2) * (ph + head)
        wall = ART.texture(tex)
        panel = Image.new('RGBA', (256, 128))
        for ty in range(0, 128, wall.height):
            for tx in range(0, 256, wall.width):
                panel.alpha_composite(wall, (tx, ty))
        panel = panel.resize((pw, ph), Image.NEAREST)
        floor_y = ph - 8
        for n, pid in enumerate(ids):
            px0 = 40 + n * 300
            panel.alpha_composite(images[pid], (px0, floor_y - 2 * 24 - H))   # hung 24 units above the floor
        panel.alpha_composite(who, (232 - who.width // 2 + 60, floor_y - who.height + 14))
        panel = lit(panel, 5)
        ImageDraw.Draw(panel).rectangle((0, floor_y, pw, ph), fill=PAL(105))
        sheet.paste(panel, (x0, y0 + head), panel)
        label(sheet, f"L{lvl} {LEVELS[lvl]['map']} {tex}: PDP{ids[0]:02d} + PDP{ids[1]:02d}", x0, y0 + 8, PAL(160), 2)
    return sheet


# ============================================================================ outputs
def textures_snippet():
    out = ['// p(DOOM) lab propaganda posters. Generated by scripts/build-lab-posters.py; do not hand-edit.',
           '// Art is 128x192 px at twice Doom texel density: XScale/YScale 2.0 => 64x96 map units.',
           '// The PNGs contain Doom font pixels from the local DOOM.WAD: pack them into the PK3 at build',
           '// time from doom-web/local/posters/ (as patches/posters/PDPnn.png); never commit them.',
           '// Reference: https://zdoom.org/wiki/TEXTURES', '']
    for r in POSTERS:
        out += [f'// PDP{r[0]:02d}  L{r[1]} {r[2]}: {r[4]}',
                f'WallTexture "PDP{r[0]:02d}", 128, 192', '{', '    XScale 2.0', '    YScale 2.0',
                f'    Patch "patches/posters/PDP{r[0]:02d}.png", 0, 0', '}', '']
    out += ['// Optional wall-sprite frames for a +WALLSPRITE actor (see README.md): PDPS A..T = PDP01..PDP20.',
            '// Origin is bottom-centre, so the actor\'s z is the bottom edge of the poster.', '']
    for r in POSTERS:
        f = chr(ord('A') + r[0] - 1)
        out += [f'Sprite "PDPS{f}0", 128, 192', '{', '    XScale 2.0', '    YScale 2.0', '    Offset 64, 192',
                f'    Patch "patches/posters/PDP{r[0]:02d}.png", 0, 0', '}', '']
    return '\n'.join(out)


def manifest():
    rows = []
    for r in POSTERS:
        lvl = LEVELS[r[1]]
        rows.append(dict(id=f'PDP{r[0]:02d}', number=r[0], level=r[1], level_name=lvl['name'], map=lvl['map'],
                         company=r[2], emblem=r[3], headline=r[4], subline=r[5], fine_print=r[6],
                         texture=f'PDP{r[0]:02d}', sprite_frame=f'PDPS{chr(64 + r[0])}0', file=f'PDP{r[0]:02d}.png',
                         pixels=[W, H], scale=2.0, world_size=[W // 2, H // 2],
                         suggested_placement=PLACEMENT[r[0]], suggested_walls=lvl['walls']))
    return dict(generator='scripts/build-lab-posters.py', palette='PLAYPAL 0 (DOOM.WAD)', font='STCFN (DOOM.WAD)',
                posters=rows)


def readme():
    lines = ['# p(DOOM) lab propaganda posters', '',
             'Twenty satirical OpenAI / Anthropic parody posters: Doom-era corporate signage the machines never',
             'took down. Ten per company, alternating, five per level. Generated by',
             '`python3 scripts/build-lab-posters.py` (deterministic; edit the copy table `POSTERS` at the top of',
             'that script and re-run). Everything here is git-ignored: the art contains STCFN font pixels and the',
             'PLAYPAL palette from the locally supplied DOOM.WAD.', '',
             '- `PDP01.png` .. `PDP20.png`: 128x192 RGBA, every opaque pixel a PLAYPAL colour; torn corners and',
             '  nibbled edges are transparent so the wall shows through.',
             '- `posters.json`: id, level, company, copy, suggested map/placement/walls, scale.',
             '- `TEXTURES.posters.txt`: `WallTexture PDPnn` (XScale/YScale 2.0 => 64x96 map units) plus optional',
             '  wall-sprite frames `PDPSA0`..`PDPST0`.',
             '- `preview/all-posters-3x.png` (grid by level), `preview/in-world.png` (true scale on each level\'s',
             '  walls at 2x, Doom COLORMAP lighting, a survivor for scale).', '',
             '## Placement', '',
             'Hang them where the joke meets the room, one or two per room; where two share a wall, pair one',
             'OpenAI with one Anthropic. Put the bottom edge 8-24 units above the floor: the subline then lands',
             'near eye height (41 units) with the headline above it, readable from across the room. At 64x96',
             'map units they are big, like Doom\'s own wall panels (a 56-unit survivor is about 60% of the',
             'poster\'s height; see `preview/in-world.png`).', '']
    for lvl in range(1, 5):
        info = LEVELS[lvl]
        lines += [f"### Level {lvl}: {info['name']} ({info['map']})", '',
                  f"Theme: {info['theme']}. Walls that suit the art: {', '.join(info['walls'])}.", '',
                  '| Poster | Company | Headline | Where |', '|---|---|---|---|']
        for r in POSTERS:
            if r[1] == lvl:
                lines.append(f"| PDP{r[0]:02d} | {r[2]} | {r[4]} | {PLACEMENT[r[0]]} |")
        lines.append('')
    lines += ['Levels 3 and 4 (E2M7, E2M2) are not built yet; their posters are ready for when they are.', '',
              '## Wiring them in (not done; for whoever owns the maps)', '',
              '1. **Pack the art at build time** (it must not be committed). In `scripts/build-doom-mod.py` `main()`,',
              '   next to the `TITLEPIC` lines inside the zip block:', '',
              '   ```python', "   posters = ROOT / 'doom-web/local/posters'",
              "   for png in sorted(posters.glob('PDP??.png')):",
              "       archive.writestr(f'patches/posters/{png.name}', png.read_bytes())",
              "   archive.writestr('textures.posters', (posters / 'TEXTURES.posters.txt').read_bytes())",
              '   ```', '',
              '   GZDoom reads every root `textures.*` lump, so `doom-mod/TEXTURES` stays untouched.', '',
              '2. **Recommended: a wall-sprite actor** (shows the wall through the torn corner, needs no geometry).',
              '   Add to a ZScript file under `doom-mod/actors/` (and include it from `doom-mod/ZSCRIPT`):', '',
              '   ```zscript', '   class PDLabPoster : Actor', '   {',
              '       Default { +WALLSPRITE +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH; Radius 1; Height 96; }',
              '       States { Spawn: PDPS A -1; Stop; }',
              '       // args[0] = poster number 1..20 (frame A..T)',
              '       override void PostBeginPlay() { Super.PostBeginPlay(); frame = clamp(args[0] - 1, 0, 19); }',
              '   }', '   ```', '',
              '   Give it a DoomEdNum in `doom-mod/MAPINFO` (e.g. `15140 = PDLabPoster`). Place it 1 unit in',
              '   front of the wall, angle = the direction the poster faces (out into the room, as with',
              '   `PDRefugeCover`), arg0 = poster number, thing height = bottom edge above the floor. In the map',
              '   builders that is e.g. `actor(x, y, 15140, 3, 24, angle=90)` in `scripts/build_hal_map.py`',
              '   (`actor(x, y, type, arg0, height, angle)`), or the equivalent thing dict in',
              '   `scripts/build_checkpoint_map.py` for E1M4.', '',
              '3. **Alternative: as a line texture.** Use `PDPnn` as the *middle* texture of a two-sided line',
              '   (64 units long, a 1-2 unit deep sector in front of the wall); mid textures do not tile',
              '   vertically and the transparent tear shows the wall behind. On a one-sided wall taller than',
              '   96 units the texture repeats vertically and the torn corner will not show the wall, so',
              '   prefer step 2 there.', '',
              '4. `npm run build:doom`, then check the poster in the game at eye level: the headline and subline',
              '   should read from a few steps away, fine print only up close.', '',
              '## Design system', '',
              '- **OpenAI**: black-printed field inside an unprinted pale paper margin (so it reads on dark walls);',
              '  white headline with STCFN\'s own bevel re-inked white-to-pale-grey; light-grey subline; dim-grey fine',
              '  print; illustrations as greyscale prints; exactly one accent, terminal green (PLAYPAL 114/119).',
              '  Emblem: original six-link interlaced knot rosette + hand-drawn `OPENAI` wordmark.',
              '- **Anthropic**: warm ivory stock (PLAYPAL 209), slate-black type (6) with a clay-coral (62) drop',
              '  shadow on headlines, coral rules and stamps, kraft-brown fine print; illustrations as black/coral',
              '  duotones. Emblem: heavy `A\\` monogram + wide-tracked `ANTHROP\\C` wordmark; Claude-product',
              '  posters (PDP07, PDP18) use an irregular coral starburst instead.',
              '- Both: STCFN at 1x for sublines/fine print (fine print one pixel tighter), 2x/3x/4x or the',
              '  condensed 1x-wide/2x-tall cut for headlines; folded-in-quarters creases, speckle, edge grime, tape or',
              '  staples, a sun-faded corner or a tide-mark stain, one torn corner each.', '']
    return '\n'.join(lines) + '\n'


def main():
    load_wad()
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    images, problems = {}, []
    for row in POSTERS:
        im, p = build_poster(row)
        bad = [c for c in set(im.getdata()) if c[3] and c[:3] not in PAL.index]
        assert not bad, f'PDP{row[0]:02d} has non-PLAYPAL pixels {bad[:4]}'
        images[row[0]] = im
        problems += [f'PDP{row[0]:02d}: {m}' for m in p.problems]
        im.save(OUT / f'PDP{row[0]:02d}.png')
    (OUT / 'posters.json').write_text(json.dumps(manifest(), indent=2) + '\n')
    (OUT / 'TEXTURES.posters.txt').write_text(textures_snippet())
    (OUT / 'README.md').write_text(readme())
    all_posters_preview(images).save(PREVIEW / 'all-posters-3x.png')
    in_world_preview(images).save(PREVIEW / 'in-world.png')
    for m in problems:
        print('layout warning:', m)
    print(f'Wrote {len(images)} posters, posters.json, TEXTURES.posters.txt, README.md and previews to {OUT}')


if __name__ == '__main__':
    main()
