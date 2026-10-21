"""Toy-factory restyle of E2M7's own Doom materials.

Every original wall texture and flat keeps its Doom detail (panels, rivets,
screens, lights, crates) but is redrawn at load time through a TEXTURES
palette translation. Nothing but names and numbers leaves the private IWAD:
the generated definitions reference its textures by name. Each wing of the
factory gets its own candy colour so rooms read apart.
"""
import math
import struct
from pathlib import Path
from build_checkpoint_map import sector_at

# Palette index runs by hue (Doom PLAYPAL). Everything not listed is neutral:
# grays, browns and tans, which carry most wall detail.
ACCENT_RUNS = {
    'red': [(16, 47), (168, 191), (250, 254)],
    'green': [(112, 127)],
    'blue': [(192, 207), (240, 247)],
    'warm': [(160, 167), (208, 239), (248, 249)],
}

def rgb(code):
    code = code.lstrip('#')
    return tuple(int(code[i:i + 2], 16) / 255 for i in (0, 2, 4))

INK, WHITE = rgb('#2a2347'), (1, 1, 1)

def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))

# Cartoon shading: each colour darkens toward a hue-shifted shadow, not black,
# so yellow goes orange instead of olive and pink goes plum instead of gray.
SHADOWS = dict(cream='#9a6a5a', white='#7d79a8', pink='#7a1f5c', mint='#1f6f78', teal='#1d4f7a',
               yellow='#b0461c', lilac='#3d2f8a', sky='#2a3f9a', coral='#8a2f45')

def tone(mid, dark=.42, light=.5, shadow=None):
    """Ramp around a signature colour (hex or rgb): a deep shade up to a pale tint."""
    m = rgb(mid) if isinstance(mid, str) else mid
    return mix(m, rgb(shadow) if shadow else INK, dark), mix(m, WHITE, light)

def stripe(mid):
    """Structural trim: mostly ink in the seams, the colour on its faces."""
    m = rgb(mid)
    return mix(m, INK, .82), mix(m, WHITE, .12)

CANDY = dict(cream='#f2dca8', white='#e9e5f3', pink='#f06a9b', mint='#5fd1a6',
             teal='#22aba0', yellow='#f9c22e', lilac='#9a84ea',
             sky='#58a6f0', coral='#f47c61')
# Dark -> bright ramps. Each material's own luminance range is stretched across one.
RAMPS = {name: tone(code, .5, .5, SHADOWS[name]) for name, code in CANDY.items()}
RAMPS.update({'trim-' + name: stripe(code) for name, code in CANDY.items()})
RAMPS.update({'ceiling-' + name: tone(mix(rgb(code), WHITE, .55), .3, .75) for name, code in CANDY.items()})
RAMPS.update({
    'white': tone('#ece9f6', .32, .8, SHADOWS['white']),
    'floor-white': tone('#c9c3de', .45, .5), 'crate': tone('#e6b25e', .5, .45),
    'panel': tone('#e4e0f0', .6, .75), 'light': (rgb('#ffd98f'), WHITE),
    'door': (mix(INK, rgb('#f6c640'), .1), rgb('#ffd84f')), 'paint': tone('#ff4f97', .4, .45),
})
CANDY_ACCENTS = {key: (mix(rgb(code), INK, .3), mix(rgb(code), WHITE, .4)) for key, code in
                 dict(red='#ff5c9a', green='#3fe0b0', blue='#4ab0ff', warm='#ffd23f').items()}
# Computers keep separate screen/LED hues; big tech walls take the wing's stripe colour.
ACCENT_ROLES = {'panel': 'candy', 'door': 'candy', 'techwall': 'zone'}

# Wing -> ramps per material role. Rectangles use original E2M7 coordinates.
ZONES = [
    ('showroom', (704, 1150, 1650, 2300), dict(wall='cream', alt='pink', trim='trim-teal', floor='FCHECK', ceiling='ceiling-pink')),
    ('garden', (-200, 960, 704, 2300), dict(wall='mint', alt='teal', trim='trim-pink', floor='teal', ceiling='ceiling-mint')),
    ('playpen', (-200, 200, 768, 960), dict(wall='pink', alt='lilac', trim='trim-mint', floor='lilac', ceiling='ceiling-pink')),
    ('production', (768, 300, 1350, 1150), dict(wall='white', alt='cream', trim='trim-teal', floor='floor-white', ceiling='ceiling-white')),
    ('stockroom', (-200, -800, 1350, 300), dict(wall='yellow', alt='coral', trim='trim-lilac', floor='crate', ceiling='ceiling-yellow')),
    ('line', (1940, 360, 2624, 1216), dict(wall='mint', alt='teal', trim='trim-pink', floor='lilac', ceiling='ceiling-mint')),
    ('annex', (1350, -800, 2624, -40), dict(wall='sky', alt='lilac', trim='trim-yellow', floor='lilac', ceiling='ceiling-sky')),
    ('lab', (1350, -800, 2624, 1216), dict(wall='lilac', alt='sky', trim='trim-pink', floor='sky', ceiling='ceiling-lilac')),
    ('octagon', (1650, 1216, 2624, 2300), dict(wall='teal', alt='mint', trim='trim-pink', floor='yellow', ceiling='ceiling-teal')),
    ('warehouse', (2624, 960, 4000, 2300), dict(wall='sky', alt='lilac', trim='trim-coral', floor='yellow', ceiling='ceiling-sky')),
    ('yard', (2624, -800, 4000, 960), dict(wall='coral', alt='yellow', trim='trim-teal', floor='mint', ceiling='ceiling-coral')),
]

# Hellish originals swap to a neighbouring ordinary Doom material first.
SWAPS = {'SLADSKUL': 'SLADWALL', 'SW1GARG': 'SW1GRAY', 'SW2SATYR': 'SW2GRAY',
         'MARBFAC3': 'MARBLE1', 'GRAYPOIS': 'GRAY1', 'AASTINKY': 'BROWN1',
         'BIGDOOR5': 'BIGDOOR2', 'BIGDOOR6': 'BIGDOOR2', 'BIGDOOR7': 'BIGDOOR2',
         'FWCREAM': 'SHAWN2', 'FWTEAL': 'STEP1'}
CUSTOM = {'FBARS', 'FGATE', 'FFABRIC', 'FFRAY', 'FDOOR', 'FWPINK', 'FWYELLOW', 'FCHECK', 'FWHITE', 'FPAINT', 'FBELT',
          'FPLAYMAT', 'FBRIDGE', 'F_SKY1', '-'}
ANIMATED = {'NUKAGE': 3, 'BLOOD': 3}
# A toy-brand sticker over each UAC stamp on the crates (64-unit crate faces).
STICKER = 'patches/factory/FSTICKER.png'
STICKERS = {'CRATE1': [(7, 7), (7, 71)], 'CRATE2': [(7, 7), (7, 71)], 'CRATWIDE': [(7, 7), (7, 71)],
            'CRATELIT': [(7, 71)]}

def wall_role(name):
    if name.startswith(('SW1', 'SW2')): return 'panel'
    if name in ('COMPOHSO', 'COMPSPAN', 'COMPTILE'): return 'techwall'
    if name.startswith(('COMP', 'PLANET', 'SPACEW')): return 'panel'
    if name.startswith(('LITE', 'EXITSIGN')): return 'light'
    if name.startswith('CRAT'): return 'crate'
    if name.startswith(('DOOR', 'BIGDOOR', 'EXITDOOR')) and name not in ('DOORSTOP', 'DOORTRAK'): return 'door'
    if name.startswith(('STEP', 'SUPPORT', 'DOORSTOP', 'DOORTRAK', 'METAL', 'PIPE', 'NUKEDGE')): return 'trim'
    if name.startswith(('SP_HOT', 'FIREWAL', 'REDWALL', 'NUKE24')): return 'paint'
    if name.startswith(('ROCK', 'SP_ROCK', 'GRAYTALL', 'SLAD', 'MARBLE')): return 'alt'
    return 'wall'

def flat_role(name, ceiling):
    if name.startswith(('NUKAGE', 'BLOOD')): return 'paint'
    if name.startswith('TLITE') or name in ('CEIL1_2', 'CEIL1_3', 'FLAT2', 'FLAT17', 'FLAT22', 'GATE1', 'GATE2'): return 'light'
    if name.startswith(('CONS', 'COMP')): return 'panel'
    if name.startswith('CRATOP'): return 'crate'
    if name.startswith('STEP'): return 'trim'
    return 'ceiling' if ceiling else 'floor'


class Iwad:
    def __init__(self, path):
        blob = Path(path).read_bytes()
        _, count, offset = struct.unpack_from('<4sii', blob)
        self.lumps, order = {}, []
        for i in range(count):
            pos, length, raw = struct.unpack_from('<ii8s', blob, offset + 16 * i)
            name = raw.rstrip(b'\0').decode().upper(); order.append(name)
            self.lumps.setdefault(name, blob[pos:pos + length])
        pal = self.lumps['PLAYPAL'][:768]
        self.palette = [tuple(pal[3 * i:3 * i + 3]) for i in range(256)]
        # GZDoom's desaturation intensity for '%' translations, scaled 0..1.
        self.intensity = [(r * 77 + g * 143 + b * 37) / 256 / 255 for r, g, b in self.palette]
        a, b = order.index('F_START'), order.index('F_END')
        self.flats = {n for n in order[a + 1:b] if not n.endswith(('_START', '_END'))}
        pn = self.lumps['PNAMES']
        pnames = [pn[4 + 8 * i:12 + 8 * i].rstrip(b'\0').decode().upper() for i in range(struct.unpack_from('<i', pn)[0])]
        self.textures = {}
        for lump in ('TEXTURE1', 'TEXTURE2'):
            data = self.lumps.get(lump)
            if not data: continue
            for off in struct.unpack_from(f'<{struct.unpack_from("<i", data)[0]}i', data, 4):
                name = data[off:off + 8].rstrip(b'\0').decode().upper()
                width, height = struct.unpack_from('<hh', data, off + 12)
                patches = [struct.unpack_from('<hhh', data, off + 22 + 10 * i)
                           for i in range(struct.unpack_from('<h', data, off + 20)[0])]
                self.textures[name] = (width, height, [(x, y, pnames[p]) for x, y, p in patches])

    def _patch(self, name):
        data = self.lumps[name]
        width, height = struct.unpack_from('<hh', data)
        for x in range(width):
            pos = struct.unpack_from('<i', data, 8 + 4 * x)[0]
            while data[pos] != 255:
                top, length = data[pos], data[pos + 1]
                for y in range(length): yield x, top + y, data[pos + 3 + y]
                pos += length + 4

    def pixels(self, name):
        if name in self.flats: return list(self.lumps[name][:4096])
        width, height, patches = self.textures[name]
        canvas = {}
        for px, py, patch in patches:
            for x, y, i in self._patch(patch):
                if 0 <= px + x < width and 0 <= py + y < height: canvas[px + x, py + y] = i
        return list(canvas.values())

    def sprite_pixels(self, name):
        return [i for _, _, i in self._patch(name)]

    def size(self, name):
        return (64, 64) if name in self.flats else self.textures[name][:2]


def ramp(dark, bright, lo, hi, kmax=2.4):
    """Endpoints mapping intensity lo->dark and hi->bright within GZDoom's 0..2 range.

    Narrow-range materials get less contrast rather than clamped (hue-shifted) ends.
    """
    lo, hi = min(lo, hi - .02), max(hi, lo + .02)
    mid = (lo + hi) / 2
    start, end = [], []
    for dc, bc in zip(dark, bright):
        centre = (dc + bc) / 2
        k = min((bc - dc) / (hi - lo), kmax, centre / mid, (2 - centre) / (1 - mid))
        start.append(centre - k * mid); end.append(centre + k * (1 - mid))
    return start, end


def fmt(start, end):
    # GZDoom's translation parser rejects signs, including a rounded '-0.000'.
    value = lambda c: f'{min(2, max(0, c)):.3f}'.replace('-', '')
    return '%[' + ','.join(map(value, start)) + ']:[' + ','.join(map(value, end)) + ']'


class Theme:
    def __init__(self, iwad):
        self.iwad, self.defs, self.names, self.log, self.stats = iwad, [], {}, {}, {}
        self.class_range = {}
        for key, runs in ACCENT_RUNS.items():
            values = [iwad.intensity[i] for a, b in runs for i in range(a, b + 1)]
            self.class_range[key] = (min(values), max(values))
        self.accent_index = {i for runs in ACCENT_RUNS.values() for a, b in runs for i in range(a, b + 1)}

    def spread(self, source, accents):
        key = (source, bool(accents))
        if key not in self.stats:
            pixels = self.iwad.pixels(source)
            values = sorted(self.iwad.intensity[i] for i in pixels if not accents or i not in self.accent_index)
            values = values or sorted(self.iwad.intensity[i] for i in pixels)
            self.stats[key] = (values[len(values) * 4 // 100], values[len(values) * 96 // 100])
        return self.stats[key]

    def translation(self, source, ramp_name, accents):
        """accents: None (pure duotone), or a dict of hue class -> ramp."""
        lo, hi = self.spread(source, accents)
        parts = ['0:255=' + fmt(*ramp(*RAMPS[ramp_name], lo, hi))]
        for key, runs in (ACCENT_RUNS.items() if accents else ()):
            a_lo, a_hi = self.class_range[key]
            for a, b in runs: parts.append(f'{a}:{b}=' + fmt(*ramp(*accents[key], a_lo, a_hi, kmax=4)))
        return ', '.join(f'"{p}"' for p in parts)

    def define(self, source, ramp_name, flat=False, accents=None, accent_key=None):
        key = (source, ramp_name, accent_key)
        if key in self.names: return self.names[key]
        name = 'FQ' + format(len(self.names), '03X')
        self.names[key] = name; self.log[name] = dict(source=source, ramp=ramp_name, accents=accent_key)
        width, height = self.iwad.size(source)
        kind = 'Flat' if flat else 'WallTexture'
        tr = self.translation(source, ramp_name, accents)
        stickers = ''.join(f'\n    Patch "{STICKER}", {x}, {y}' for x, y in STICKERS.get(source, ()))
        self.defs.append(f'{kind} "{name}", {width}, {height}\n{{\n    Patch "{source}", 0, 0 {{ Translation {tr} }}{stickers}\n}}')
        return name

    def accents_for(self, zone, role):
        kind = ACCENT_ROLES.get(role)
        if kind == 'candy': return CANDY_ACCENTS, 'candy'
        if kind == 'zone':
            stripe_colour = rgb(CANDY[ZONES_BY_NAME[zone]['trim'].split('-', 1)[1]])
            ramp_pair = (mix(stripe_colour, WHITE, .05), mix(stripe_colour, WHITE, .55))
            return {k: ramp_pair for k in ACCENT_RUNS}, ZONES_BY_NAME[zone]['trim']
        return None, None

    def ramp_for(self, zone, role):
        z = ZONES_BY_NAME[zone]
        if role == 'techwall': return z['wall']
        return z.get(role, role)


ZONES_BY_NAME = {name: z for name, _, z in ZONES}


def zone_at(x, y):
    for name, (x0, y0, x1, y1), _ in ZONES:
        if x0 <= x < x1 and y0 <= y < y1: return name
    return 'production'


def apply(model, polys, iwad_path, out_dir):
    """Rewrite every original material in place and write the generated lumps to out_dir."""
    theme = Theme(Iwad(iwad_path))
    zones = []
    for segs, (x0, y0, x1, y1) in polys:
        zones.append(zone_at((x0 + x1) / 2, (y0 + y1) / 2))
    switches, anims = set(), set()

    def wall(tex, zone):
        tex = SWAPS.get(tex.upper(), tex.upper())
        if tex in CUSTOM: return tex
        if tex not in theme.iwad.textures: return tex
        role = wall_role(tex)
        ramp_name = theme.ramp_for(zone, role)
        accents, accent_key = theme.accents_for(zone, role)
        name = theme.define(tex, ramp_name, accents=accents, accent_key=accent_key)
        if tex[:3] in ('SW1', 'SW2'):
            other = ('SW2' if tex[:3] == 'SW1' else 'SW1') + tex[3:]
            if other in theme.iwad.textures: switches.add((name, theme.define(other, ramp_name, accents=accents, accent_key=accent_key)))
        return name

    def flat(tex, zone, ceiling):
        tex = tex.upper()
        if tex in CUSTOM: return tex
        if tex not in theme.iwad.flats: return tex
        role = flat_role(tex, ceiling)
        ramp_name = theme.ramp_for(zone, role)
        if ramp_name in CUSTOM: return ramp_name  # e.g. the showroom keeps its checker floor
        base = tex.rstrip('0123456789')
        if base in ANIMATED:
            frames = [theme.define(f'{base}{i}', ramp_name, flat=True) for i in range(1, ANIMATED[base] + 1)]
            anims.add(tuple(frames))
            # ANIMDEFS animates surfaces that use the first frame.
            return frames[0]
        accents, accent_key = theme.accents_for(zone, role)
        return theme.define(tex, ramp_name, flat=True, accents=accents, accent_key=accent_key)

    for side in model['sides']:
        zone = zones[side['sector']]
        for key in ('texturemiddle', 'texturetop', 'texturebottom'):
            if side[key] != '-': side[key] = wall(side[key], zone)
    for i, sector in enumerate(model['sectors']):
        sector['texturefloor'] = flat(sector['texturefloor'], zones[i], False)
        sector['textureceiling'] = flat(sector['textureceiling'], zones[i], True)

    textures = '// Generated by scripts/factory_theme.py from the private IWAD; references only.\n' + '\n'.join(theme.defs) + '\n'
    animdefs = '// Generated by scripts/factory_theme.py.\n'
    for frames in sorted(anims):
        animdefs += f'flat {frames[0]}\n' + ''.join(f'    pic {f} tics 8\n' for f in frames)
    for a, b in sorted(switches):
        animdefs += f'switch {a} on pic {b} tics 0\n'
    # Recoloured ceiling lights still glow onto nearby walls.
    glows = sorted(n for n, info in theme.log.items() if info['ramp'] == 'light' and info['source'] in theme.iwad.flats)
    gldefs = '// Generated by scripts/factory_theme.py.\nGlow\n{\n    Flats\n    {\n' + ''.join(f'        {n}\n' for n in glows) + '    }\n}\n'
    out_dir = Path(out_dir)
    (out_dir / 'factory-theme-gldefs.txt').write_text(gldefs)
    (out_dir / 'factory-theme-trnslate.txt').write_text(translations(iwad_path))
    (out_dir / 'factory-theme-textures.txt').write_text(textures)
    (out_dir / 'factory-theme-animdefs.txt').write_text(animdefs)
    return dict(textures=len(theme.defs), switches=len(switches), animations=len(anims), materials=theme.log,
                zones={z: zones.count(z) for z in ZONES_BY_NAME})


# Set dressing: Doom's own decorations (args[0] = colourway index) in room corners.
COLOURWAYS = ['pink', 'teal', 'yellow', 'mint', 'lilac', 'sky', 'coral', 'cream']
DECOR = {'drum': (15320, 'BAR1A0', 'PDToyDrum'), 'lamp': (15321, 'COLUA0', 'PDToyLamp'),
         'pylon': (15322, 'ELECA0', 'PDToyPylon'), 'column': (15323, 'COL1A0', 'PDToyColumn'),
         'bollard': (15324, 'COL2A0', 'PDToyBollard')}
DRESSING = {
    'showroom': [('lamp', 'pink'), ('column', 'teal'), ('lamp', 'teal'), ('column', 'pink')],
    'garden': [('bollard', 'pink'), ('lamp', 'yellow'), ('bollard', 'yellow')],
    'playpen': [('drum', 'yellow'), ('drum', 'teal'), ('lamp', 'mint')],
    'production': [('pylon', 'teal'), ('drum', 'pink'), ('pylon', 'pink')],
    'stockroom': [('drum', 'coral'), ('drum', 'teal'), ('drum', 'pink'), ('lamp', 'lilac')],
    'line': [('pylon', 'pink'), ('drum', 'yellow')],
    'annex': [('lamp', 'yellow'), ('pylon', 'lilac')],
    'lab': [('pylon', 'sky'), ('lamp', 'pink'), ('pylon', 'mint')],
    'octagon': [('pylon', 'yellow'), ('lamp', 'pink')],
    'warehouse': [('drum', 'yellow'), ('drum', 'pink'), ('drum', 'teal'), ('column', 'coral')],
    'yard': [('drum', 'teal'), ('drum', 'yellow'), ('bollard', 'mint')],
}
# E2M7's own lamps, torches and barrel become toy props in the same spots; its gore
# sits mid-route, so it is dropped rather than replaced.
ORIGINAL_DECOR = {2028: 'lamp', 2035: 'drum', 55: 'lamp', 56: 'lamp', 57: 'lamp'}


def dress(model, polys, original_things, keep_clear):
    """Return decoration things for convex room corners, plus restyled original decor spots."""
    verts = model['vertices']
    openings = {l[k] for l in model['lines'] if l['sideback'] >= 0 for k in ('v1', 'v2')}
    walls = {}
    for line in model['lines']:
        if line['sideback'] >= 0: continue
        s = model['sides'][line['sidefront']]['sector']
        for a, b in [(line['v1'], line['v2']), (line['v2'], line['v1'])]:
            walls.setdefault((s, a), []).append(b)
    placed, things = [], []
    taken = lambda x, y, gap: any(math.hypot(x - px, y - py) < gap for px, py in placed)
    blocked = lambda x, y: any(math.hypot(x - px, y - py) < 112 for px, py in keep_clear) or any(
        math.hypot(x - verts[v]['x'], y - verts[v]['y']) < 64 for v in openings)

    def usable(s, x, y):
        sec = model['sectors'][s]
        return (sector_at(polys, x, y) == s and sec['heightceiling'] - sec['heightfloor'] >= 72
                and not sec['texturefloor'].upper().startswith(('NUKAGE', 'BLOOD', 'F_SKY')))

    def add(kind, colour, x, y, angle=0):
        number = DECOR[kind][0]
        things.append(dict(x=round(x), y=round(y), type=number, arg0=COLOURWAYS.index(colour), angle=angle,
                           skill1=True, skill2=True, skill3=True, skill4=True, skill5=True, single=True, coop=True, dm=True))
        placed.append((x, y))

    for t in original_things:
        kind = ORIGINAL_DECOR.get(t['type'])
        s = sector_at(polys, t['x'], t['y'])
        if not kind or s < 0 or not usable(s, t['x'], t['y']) or blocked(t['x'], t['y']) or taken(t['x'], t['y'], 96): continue
        b = polys[s][1]
        options = DRESSING[zone_at((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)]
        add(kind, next((c for k, c in options if k == kind), options[0][1]), t['x'], t['y'])
    order = sorted(range(len(polys)), key=lambda i: -(polys[i][1][2] - polys[i][1][0]) * (polys[i][1][3] - polys[i][1][1]))
    for s in order:
        x0, y0, x1, y1 = polys[s][1]
        if min(x1 - x0, y1 - y0) < 160: continue
        options = DRESSING[zone_at((x0 + x1) / 2, (y0 + y1) / 2)]
        count = 0
        for (sector, v), ends in sorted(walls.items()):
            if sector != s or len(ends) != 2 or count >= 6: continue
            vx, vy = verts[v]['x'], verts[v]['y']
            dirs = []
            for e in ends:
                dx, dy = verts[e]['x'] - vx, verts[e]['y'] - vy; n = math.hypot(dx, dy) or 1
                dirs.append((dx / n, dy / n))
            if abs(dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1]) > .35: continue  # roughly square corners
            bx, by = dirs[0][0] + dirs[1][0], dirs[0][1] + dirs[1][1]; n = math.hypot(bx, by)
            x, y = vx + bx / n * 36, vy + by / n * 36
            if not usable(s, x, y):  # outside corner of a pillar: stand just off it
                x, y = vx - bx / n * 30, vy - by / n * 30
            if not usable(s, x, y) or blocked(x, y) or taken(x, y, 176): continue
            kind, colour = options[(count + s) % len(options)]
            add(kind, colour, x, y); count += 1
    return things


def translations(iwad_path):
    """TRNSLATE colourways for the decoration sprites."""
    theme = Theme(Iwad(iwad_path))
    out = ['// Generated by scripts/factory_theme.py.']
    for kind, (_, sprite, prefix) in DECOR.items():
        pixels = theme.iwad.sprite_pixels(sprite)
        values = sorted(theme.iwad.intensity[i] for i in pixels if i not in theme.accent_index) or [0, 1]
        lo, hi = values[len(values) * 4 // 100], values[len(values) * 96 // 100]
        for n, colour in enumerate(COLOURWAYS):
            dark, bright = RAMPS[colour]
            if kind == 'lamp': bright = WHITE
            parts = ['0:255=' + fmt(*ramp(dark, bright, lo, hi))]
            paint = RAMPS['teal' if colour == 'pink' else 'paint']
            for key, runs in ACCENT_RUNS.items():
                a_lo, a_hi = theme.class_range[key]
                pair = paint if kind == 'drum' else CANDY_ACCENTS[key]
                for a, b in runs: parts.append(f'{a}:{b}=' + fmt(*ramp(*pair, a_lo, a_hi, kmax=4)))
            out.append(f'{prefix}{n} = ' + ', '.join(f'"{p}"' for p in parts))
    return '\n'.join(out) + '\n'
