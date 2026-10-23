"""AGENTIC SMITH's pod farm: E2M2's own Doom materials, recoloured per wing.

Two worlds by recolour (docs/LEVEL-04.md "Look"): the machine world is cold blue
steel and pink pod gel, the places SMITH runs are a green-graded 1999 office, and
the refuge is the only warm room. Every IWAD texture and flat keeps its Doom detail
and is redrawn through a TEXTURES palette translation; only names and numbers
leave the private IWAD. Computer screens run our own falling green glyphs
(procedural patches, animated by ANIMDEFS), FIRELAVA stays animated, the crusher
faces get hazard stripes, nukage is code green and the glowing flats light the walls.

Generated lumps (all names prefixed AQ, never the factory's FQ):
doom-mod/agentic-theme-{textures,animdefs,gldefs,trnslate}.txt
"""
import math
import random
from pathlib import Path
from PIL import Image, ImageColor, ImageDraw
from build_checkpoint_map import sector_at
from factory_theme import ACCENT_RUNS, Iwad, fmt, mix, ramp, rgb

WHITE, PREFIX = (1, 1, 1), 'AQ'

# Wing -> (shadow, colour per material role). Shadows are hue-shifted, never black.
WINGS = {
    'refuge': ('#2a0d05', dict(wall='#b5562b', alt='#c9773e', trim='#b5562b', floor='#8a4a2a', ceiling='#d79a5a',
                               light='#ffb347', door='#c8643a', panel='#e8b27a', tech='#9a4a26', crate='#c98a4a')),
    'ward': ('#22091a', dict(wall='#9a5a72', alt='#c77a93', trim='#7a4a64', floor='#6a4a5a', ceiling='#a8788e',
                             light='#ff9ec0', door='#8a6a7e', panel='#d8b0c0', tech='#6a3a54', crate='#9a6a7e')),
    'farm': ('#0a1020', dict(wall='#2f4f7a', alt='#3d6290', trim='#4a6a96', floor='#34465e', ceiling='#2a3a58',
                             light='#ff4d6d', door='#5a7aa0', panel='#9ab4d4', tech='#22406a', crate='#3d5a80')),
    'harvester': ('#140404', dict(wall='#8a3324', alt='#5a2a22', trim='#ff9a1f', floor='#4a2a20', ceiling='#3a1a14',
                                  light='#ff9a1f', door='#7a4a30', panel='#c08060', tech='#6a2418', crate='#7a3a24')),
    'office': ('#0b1a10', dict(wall='#9cb08a', alt='#7f9a76', trim='#6e8a64', floor='#6e7d68', ceiling='#c8d8b8',
                               light='#e9f5d0', door='#a8bc9a', panel='#d8e4c8', tech='#5a7050', crate='#8a9a74')),
    'pool': ('#2a1a06', dict(wall='#c9a046', alt='#a87a3a', trim='#8a6430', floor='#9a7a48', ceiling='#d8b878',
                             light='#ffe0a0', door='#b89050', panel='#e8d0a0', tech='#8a6a2a', crate='#b08a4a')),
    'lobby': ('#16281e', dict(wall='#e9efe9', alt='#c8d8cc', trim='#9ab0a2', floor='#b8c8bc', ceiling='#e0f0e4',
                              light='#d8ffe8', door='#c8dccc', panel='#f0f8f0', tech='#8aa496', crate='#c0d0c4')),
    # Dark server teal, but readable: under E2M2's 112-128 lights the first pass (#04161a shadow, #1f5f66
    # walls) went nearly black, so the ramp is lifted and those rooms get a light floor (MIN_LIGHT).
    'east': ('#0a2a30', dict(wall='#2f8088', alt='#3a6c74', trim='#45929a', floor='#2c5c64', ceiling='#285860',
                             light='#8fffe8', door='#4c9aa0', panel='#9ad8d8', tech='#246a72', crate='#3a7a82')),
    'rigs': ('#3a4048', dict(wall='#e8eef0', alt='#d0d8dc', trim='#ff7a1a', floor='#c0c8cc', ceiling='#dfe6ea',
                             light='#ffffff', door='#ff7a1a', panel='#f4f8fa', tech='#a8b4bc', crate='#d8dee2')),
    'construct': ('#b8bcc0', dict(wall='#ffffff', alt='#ffffff', trim='#f0f0f0', floor='#ffffff', ceiling='#ffffff',
                                  light='#ffffff', door='#ffffff', panel='#ffffff', tech='#ffffff', crate='#ffffff')),
}
# Lowest sector light per wing (the east wing's own lights run 112-128).
MIN_LIGHT = {'east': 144}
# Role -> (dark, light) mixing of the wing colour toward its shadow and white.
SHAPE = dict(wall=(.5, .45), alt=(.5, .45), tech=(.62, .4), floor=(.55, .35), ceiling=(.45, .55),
             door=(.55, .5), panel=(.6, .6), crate=(.5, .45))
RAMPS = {}
for wing, (shadow, roles) in WINGS.items():
    for role, code in roles.items():
        m, s = rgb(code), rgb(shadow)
        if role == 'trim': RAMPS[f'{wing}-trim'] = (mix(m, s, .8), mix(m, WHITE, .15))
        elif role == 'light': RAMPS[f'{wing}-light'] = (mix(m, s, .35), mix(m, WHITE, .7))
        else: RAMPS[f'{wing}-{role}'] = (mix(m, s, SHAPE[role][0]), mix(m, WHITE, SHAPE[role][1]))
RAMPS.update({
    'code': (rgb('#03300f'), rgb('#a8ffc0')),      # nukage: bright code green
    'blood': (rgb('#2a0306'), rgb('#ff5a50')),     # the red pool stays red (it hurts)
    'molten': (rgb('#3a0800'), rgb('#ffd070')),    # FIRELAVA, sodium-hot, still animated
    'screen': (rgb('#000802'), rgb('#0e4020')),    # dark phosphor under the glyph rain
})
# Screens, LEDs and switch lights keep their hue (dark -> bright per PLAYPAL run).
ACCENTS = {k: (rgb(a), rgb(b)) for k, (a, b) in dict(
    red=('#6a0a08', '#ff6a5a'), green=('#0a5a22', '#b8ffd0'), blue=('#103060', '#8ab8ff'), warm=('#7a4a10', '#ffd070')).items()}
ACCENT_ROLES = {'panel', 'door', 'tech'}
WING_ACCENTS = {'refuge': dict(blue=ACCENTS['warm'], green=ACCENTS['warm'])}  # nothing cold in the refuge

# Wings: explicit E2M2 sector ids first (LEVEL-04.md rooms), then rectangles in original
# E2M2 units matched on each sector's bounding-box centre (first match wins).
SECTOR_ZONES = {'refuge': {9, 10, 11}, 'ward': {5, 6, 12}, 'harvester': {23, 26, 27, 29, 30},
                'office': {3, 16, 19, 25, 31, 32, 34}, 'pool': {71, 72, 73, 75, 76, 77, 79, 81, 82},
                'lobby': {84}, 'rigs': {51, 52, 53, 54, 55, 56}, 'farm': {119, 120, 121, 124, 125, 127, 138}}
ZONE_OF = {i: z for z, ids in SECTOR_ZONES.items() for i in ids}
ZONES = [('refuge', (-400, -200, -150, 0)), ('ward', (-400, -600, 260, -80)), ('harvester', (200, -600, 1700, -240)),
         ('rigs', (1900, -300, 2300, 620)), ('pool', (1580, 940, 1940, 1660)), ('lobby', (-340, 1900, 2000, 2800)),
         ('lobby', (1000, 1600, 1940, 1900)), ('lobby', (1260, 1200, 1510, 1600)), ('farm', (-340, 940, 1120, 1900)),
         ('east', (1940, -470, 2900, 2400)), ('office', (-340, -260, 1940, 1210))]
CRUSHERS = {2, 21, 23, 46, 48}  # harvester crushers: their faces get hazard stripes

# Hellish originals swap to a neighbouring ordinary Doom material first.
# AASTINKY is the IWAD's null texture 0: GZDoom can't use it as a patch, so it swaps like the factory's.
SWAPS = {'SLADSKUL': 'SLADWALL', 'SW1GARG': 'SW1GRAY', 'SW2GARG': 'SW2GRAY', 'SW2SATYR': 'SW2GRAY',
         'MARBFAC3': 'MARBLE1', 'GRAYPOIS': 'GRAY1', 'AASTINKY': 'BROWN1', 'BIGDOOR5': 'BIGDOOR2',
         'BIGDOOR6': 'BIGDOOR2', 'BIGDOOR7': 'BIGDOOR2', 'SKINSYMB': 'MARBLE3', 'SW1SATYR': 'SW1GRAY',
         'SW2LION': 'SW2GRAY', 'SW1LION': 'SW1GRAY', 'SW1GSTON': 'SW1STON1', 'SW2GSTON': 'SW2STON1',
         # Skull-panelled wood (room 3's face over crusher 2, the first thing ?puzzle=kokotajlo shows).
         'WOOD4': 'WOOD1', 'WOODSKUL': 'WOOD1'}
# Skull friezes on Doom's marble (SMITH's lobby pillars) are covered by plain MARBLE1 bands,
# recoloured with the same translation: (y, height) per texture.
DEFACE = {'MARBLE2': [(0, 16), (116, 12)], 'MARBLE3': [(0, 16)]}
PLAIN = ('MARBLE1', 40)  # source texture and the row its plain band starts at
FLATS_ANIMATED = {'NUKAGE': 3, 'BLOOD': 3}
WALLS_ANIMATED = {'FIRELAVA': ['FIRELAVA', 'FIRELAV2', 'FIRELAV3']}
# Our own falling glyphs over each screen rectangle (x, y, w, h). COMPBLUE is the trough
# walls; the others are in the sealed warehouse but follow the same rule.
GLYPH_SCREENS = {'COMPBLUE': [(0, 0, 64, 128)], 'COMPTALL': [(204, 8, 40, 24)],
                 'COMP2': [(141, 8, 40, 24), (13, 71, 40, 26)]}
GLYPH_FRAMES, GLYPH_TICS = 16, 4
HAZARD = 'patches/agentic/AHAZARD.png'
# Runtime-only materials the map script needs by name (StoneFlat, BridgeFlat): the stones
# rise to room 77's floor, the bridge takes the switch room's floor in refuge amber.
EXTRA = {'stone': ('FLOOR5_4', 'pool', 'floor'), 'bridge': ('FLOOR3_3', 'refuge', 'floor')}


def wall_role(name):
    if name == 'COMPBLUE': return 'screen'  # the whole texture is a screen
    if name.startswith(('SW1', 'SW2', 'EXITSIGN')): return 'panel'
    if name.startswith(('TEKWALL', 'COMPSPAN', 'COMPTILE', 'COMPOHSO')): return 'tech'
    if name.startswith(('COMP', 'PLANET', 'SPACEW')): return 'panel'
    if name.startswith('FIRELAV'): return 'molten'
    if name.startswith(('LITE', 'TLITE')): return 'light'
    if name.startswith('CRAT'): return 'crate'
    if name.startswith(('DOOR', 'BIGDOOR', 'EXITDOOR')) and name not in ('DOORSTOP', 'DOORTRAK'): return 'door'
    if name.startswith(('STEP', 'SUPPORT', 'DOORSTOP', 'DOORTRAK', 'METAL', 'PIPE', 'NUKEDGE', 'PLAT')): return 'trim'
    if name.startswith(('NUKE24', 'NUKESLAD')): return 'code'
    if name.startswith(('SP_HOT', 'FIREWAL', 'REDWALL', 'BLODGR', 'BLODRIP')): return 'blood'
    if name.startswith(('ROCK', 'SP_ROCK', 'GRAYTALL', 'SLAD', 'MARBLE', 'GSTONE', 'STONE')): return 'alt'
    return 'wall'


def flat_role(name, ceiling):
    if name.startswith('NUKAGE'): return 'code'
    if name.startswith('BLOOD'): return 'blood'
    if name.startswith('TLITE') or name in ('CEIL1_2', 'CEIL1_3', 'FLAT2', 'FLAT17', 'FLAT22', 'GATE1', 'GATE2', 'FLOOR1_1'): return 'light'
    if name.startswith(('CONS', 'COMP')): return 'panel'
    if name.startswith('CRATOP'): return 'crate'
    if name.startswith('STEP'): return 'trim'
    return 'ceiling' if ceiling else 'floor'


def ramp_name(zone, role):
    return role if role in ('code', 'blood', 'molten', 'screen') else f'{zone}-{role}'


def zone_at(x, y):
    for name, (x0, y0, x1, y1) in ZONES:
        if x0 <= x < x1 and y0 <= y < y1: return name
    return 'office'


def zone_of(i, polys, extra_zones=None):
    """Wing of sector i: the map script's extra zones (new sectors), the room table, then rectangles."""
    if extra_zones and i in extra_zones: return extra_zones[i]
    if i in ZONE_OF: return ZONE_OF[i]
    x0, y0, x1, y1 = polys[i][1]
    return zone_at((x0 + x1) / 2, (y0 + y1) / 2)


def glyph_sizes():
    return sorted({(w, h) for rects in GLYPH_SCREENS.values() for _, _, w, h in rects})


def glyph_patch(w, h, frame):
    return f'patches/agentic/AGLY{chr(65 + glyph_sizes().index((w, h)))}{frame:X}.png'


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

    def translation(self, source, ramp_key, accents):
        lo, hi = self.spread(source, accents)
        parts = ['0:255=' + fmt(*ramp(*RAMPS[ramp_key], lo, hi))]
        for key, runs in (ACCENT_RUNS.items() if accents else ()):
            a_lo, a_hi = self.class_range[key]
            for a, b in runs: parts.append(f'{a}:{b}=' + fmt(*ramp(*accents[key], a_lo, a_hi, kmax=4)))
        return ', '.join(f'"{p}"' for p in parts)

    def define(self, source, ramp_key, flat=False, accents=None, accent_key=None, overlay=()):
        """One recoloured copy of an IWAD material; overlay = extra (patch, x, y) on top. A patch
        named AQPLN<h> is a band of plain IWAD marble and takes the same translation."""
        key = (source, ramp_key, accent_key, tuple(overlay))
        if key in self.names: return self.names[key]
        name = PREFIX + format(len(self.names), '03X')
        self.names[key] = name; self.log[name] = dict(source=source, ramp=ramp_key, accents=accent_key, overlay=len(overlay))
        width, height = self.iwad.size(source)
        tr = self.translation(source, ramp_key, accents)
        extra = ''.join(f'\n    Patch "{p}", {x}, {y}' + (f' {{ Translation {tr} }}' if p.startswith('AQPLN') else '') for p, x, y in overlay)
        self.defs.append(f'{"Flat" if flat else "WallTexture"} "{name}", {width}, {height}\n{{\n'
                         f'    Patch "{source}", 0, 0 {{ Translation {tr} }}{extra}\n}}')
        return name


def ensure_patches(out_dir, force=False):
    """Draw the theme's own procedural patches (glyph rain frames, hazard stripe) if missing."""
    folder = Path(out_dir) / 'patches/agentic'; folder.mkdir(parents=True, exist_ok=True)
    if force or not (Path(out_dir) / HAZARD).exists():
        im = Image.new('RGBA', (64, 16), '#ffb000'); d = ImageDraw.Draw(im)
        for x in range(-16, 80, 16): d.polygon([(x, 15), (x + 8, 15), (x + 23, 0), (x + 15, 0)], fill='#16110c')
        d.line((0, 0, 63, 0), fill='#3a2a10'); d.line((0, 15, 63, 15), fill='#3a2a10')
        im.save(Path(out_dir) / HAZARD)
    for w, h in glyph_sizes():
        if not force and all((Path(out_dir) / glyph_patch(w, h, f)).exists() for f in range(GLYPH_FRAMES)): continue
        for f, im in enumerate(glyph_rain(w, h)): im.save(Path(out_dir) / glyph_patch(w, h, f))


GLYPHS = None
def glyph_set():
    """Our own 24 runes on a 4x6 grid: angular strokes, never the film's katakana."""
    global GLYPHS
    if GLYPHS: return GLYPHS
    rng, GLYPHS = random.Random(1999), []
    while len(GLYPHS) < 24:
        g = [[0] * 4 for _ in range(6)]
        x, y = rng.randrange(4), 0
        for _ in range(rng.randint(7, 10)):  # a pen that walks down and sideways
            g[y][x] = 1
            dx, dy = rng.choice([(1, 0), (-1, 0), (0, 1), (0, 1), (1, 1), (-1, 1)])
            x, y = min(3, max(0, x + dx)), min(5, y + dy)
        g[rng.randrange(6)][rng.randrange(4)] = 1
        lit = sum(map(sum, g))
        if 7 <= lit <= 12 and g[0] != [0] * 4 and g[5] != [0] * 4 and g not in GLYPHS: GLYPHS.append(g)
    return GLYPHS


def glyph_rain(w, h, frames=GLYPH_FRAMES, seed=None):
    """Transparent frames of falling glyph columns; the loop is seamless over `frames`.
    Each column's stream repeats every `frames` cells and moves one cell per frame."""
    rng = random.Random(seed if seed is not None else w * 1000 + h)
    glyphs, cw, ch = glyph_set(), 6, 8
    cols, rows = max(1, (w + 1) // cw), max(1, (h + 1) // ch)
    shades = ['#e6fff0', '#7dff9e', '#3cff6e', '#22c050', '#159040', '#0d6a2e', '#08481e']
    streams = []
    for c in range(cols):
        heads = rng.sample(range(frames), 1 if rows < 6 else rng.choice([1, 2, 2]))
        streams.append(dict(heads=heads, tail=rng.randint(4, 9), chars=[rng.randrange(len(glyphs)) for _ in range(frames)],
                            flips={(rng.randrange(frames), rng.randrange(frames)) for _ in range(3)}))
    out = []
    for f in range(frames):
        im = Image.new('RGBA', (w, h)); px = im.load()
        for c, s in enumerate(streams):
            for r in range(rows):
                cell = r % frames
                dist = min((((head + f) - cell) % frames) for head in s['heads'])
                if dist > s['tail']: continue
                k = s['chars'][cell] if (f, cell) not in s['flips'] else (s['chars'][cell] + 7) % len(glyphs)
                colour = ImageColor.getrgb(shades[min(dist, len(shades) - 1)]) + (255,)
                for gy, line in enumerate(glyphs[k]):
                    for gx, on in enumerate(line):
                        x, y = c * cw + gx + (w - cols * cw + 2) // 2, r * ch + gy + 1
                        if on and 0 <= x < w and 0 <= y < h: px[x, y] = colour
        out.append(im)
    return out


def apply(model, polys, iwad_path, out_dir, extra_zones=None, extra=None):
    """Rewrite every original material in place and write the generated lumps to out_dir.

    extra_zones maps new sector indices to a wing, or to 'skip' (keep its textures, e.g.
    the Construct's project whites). extra maps a key to (IWAD source, wing, role) for a
    material only the runtime uses; report['extra'][key] is its generated name."""
    theme = Theme(Iwad(iwad_path))
    ensure_patches(out_dir)
    zones = [zone_of(i, polys, extra_zones) for i in range(len(model['sectors']))]
    switches, flat_anims, wall_anims = set(), set(), []
    hazards = 0

    def accents_for(zone, role, blink=False):
        if role not in ACCENT_ROLES: return None, None
        if blink:  # the LEDs off: every accent run drops to the wall's own dark end
            dark = RAMPS[ramp_name(zone, role)][0]
            return {k: (dark, mix(dark, WHITE, .08)) for k in ACCENT_RUNS}, 'off'
        if zone in WING_ACCENTS: return {**ACCENTS, **WING_ACCENTS[zone]}, zone
        return ACCENTS, 'on'
    bands = sorted({h for rows in DEFACE.values() for _, h in rows})
    for h in bands:  # untranslated helper bands; the themed texture translates them
        width = theme.iwad.size(PLAIN[0])[0]
        theme.defs.append(f'WallTexture "AQPLN{h}", {width}, {h}\n{{\n    Patch "{PLAIN[0]}", 0, -{PLAIN[1]}\n}}')

    def wall(tex, zone, hazard=False):
        tex = SWAPS.get(tex.upper(), tex.upper())
        if tex not in theme.iwad.textures: return tex  # project textures (AWHITE, ABOOTH7, ...) and '-'
        role = wall_role(tex)
        key = ramp_name(zone, role)
        accents, accent_key = accents_for(zone, role)
        width, height = theme.iwad.size(tex)
        overlay = tuple((HAZARD, x, height - 16) for x in range(0, width, 64)) if hazard else ()
        overlay = tuple((f'AQPLN{h}', x, y) for y, h in DEFACE.get(tex, ()) for x in range(0, width, 128)) + overlay
        if tex in WALLS_ANIMATED:
            frames = [theme.define(f, key, overlay=overlay) for f in WALLS_ANIMATED[tex]]
            if frames not in [a for a, _ in wall_anims]: wall_anims.append((frames, 8))
            return frames[0]
        if tex in GLYPH_SCREENS:
            frames = [theme.define(tex, key, accents=accents, accent_key=accent_key, overlay=overlay + tuple(
                (glyph_patch(w, h, f), x, y) for x, y, w, h in GLYPH_SCREENS[tex])) for f in range(GLYPH_FRAMES)]
            if frames not in [a for a, _ in wall_anims]: wall_anims.append((frames, GLYPH_TICS))
            return frames[0]
        name = theme.define(tex, key, accents=accents, accent_key=accent_key, overlay=overlay)
        if role == 'tech' and zone == 'east':  # dark server teal with blinking LEDs
            off = theme.define(tex, key, accents=accents_for(zone, role, True)[0], accent_key='off', overlay=overlay)
            frames = [name, off]
            if frames not in [a for a, _ in wall_anims]: wall_anims.append((frames, 0))
        if tex[:3] in ('SW1', 'SW2'):
            other = ('SW2' if tex[:3] == 'SW1' else 'SW1') + tex[3:]
            if other in theme.iwad.textures:
                switches.add((name, theme.define(other, key, accents=accents, accent_key=accent_key, overlay=overlay)))
        return name

    def flat(tex, zone, ceiling, role=None):
        tex = tex.upper()
        if tex not in theme.iwad.flats: return tex  # F_SKY1, project flats
        role = role or flat_role(tex, ceiling)
        key = ramp_name(zone, role)
        base = tex.rstrip('0123456789')
        if base in FLATS_ANIMATED:
            frames = [theme.define(f'{base}{i}', key, flat=True) for i in range(1, FLATS_ANIMATED[base] + 1)]
            flat_anims.add(tuple(frames))
            return frames[0]  # ANIMDEFS animates surfaces that use the first frame
        accents, accent_key = accents_for(zone, role)
        return theme.define(tex, key, flat=True, accents=accents, accent_key=accent_key)

    crusher_lines = set()
    for line in model['lines']:
        sectors = {model['sides'][line[k]]['sector'] for k in ('sidefront', 'sideback') if line[k] >= 0}
        if len(sectors) == 2 and sectors & CRUSHERS:
            crusher_lines.update(line[k] for k in ('sidefront', 'sideback'))
    for index, side in enumerate(model['sides']):
        zone = zones[side['sector']]
        if zone == 'skip': continue
        for key in ('texturemiddle', 'texturetop', 'texturebottom'):
            if side[key] != '-':
                hazard = key == 'texturetop' and index in crusher_lines
                side[key] = wall(side[key], zone, hazard); hazards += hazard
    for i, sector in enumerate(model['sectors']):
        if zones[i] == 'skip': continue
        if zones[i] in MIN_LIGHT and 'lightlevel' in sector: sector['lightlevel'] = max(sector['lightlevel'], MIN_LIGHT[zones[i]])
        sector['texturefloor'] = flat(sector['texturefloor'], zones[i], False)
        sector['textureceiling'] = flat(sector['textureceiling'], zones[i], True)
    named = {key: flat(source, zone, False, role) if source in theme.iwad.flats else wall(source, zone)
             for key, (source, zone, role) in (extra or EXTRA).items()}

    header = '// Generated by scripts/agentic_theme.py'
    textures = header + ' from the private IWAD; references only.\n' + '\n'.join(theme.defs) + '\n'
    animdefs = header + '.\n'
    for frames in sorted(flat_anims):
        animdefs += f'flat {frames[0]}\n' + ''.join(f'    pic {f} tics 8\n' for f in frames)
    for frames, tics in wall_anims:
        if tics: animdefs += f'texture {frames[0]}\n' + ''.join(f'    pic {f} tics {tics}\n' for f in frames)
        else: animdefs += f'texture {frames[0]}\n    pic {frames[0]} rand 30 90\n    pic {frames[1]} rand 3 9\n'
    for a, b in sorted(switches):
        animdefs += f'switch {a} on pic {b} tics 0\n'
    # Recoloured lights, code-green nukage, the red pool and the pink troughs glow onto nearby walls.
    glows = sorted(n for n, info in theme.log.items() if info['source'] in theme.iwad.flats and (
        info['ramp'] in ('code', 'blood') or info['ramp'].endswith('-light')))
    gldefs = header + '.\nGlow\n{\n    Flats\n    {\n' + ''.join(f'        {n}\n' for n in glows) + '    }\n}\n'
    out_dir = Path(out_dir)
    (out_dir / 'agentic-theme-textures.txt').write_text(textures)
    (out_dir / 'agentic-theme-animdefs.txt').write_text(animdefs)
    (out_dir / 'agentic-theme-gldefs.txt').write_text(gldefs)
    (out_dir / 'agentic-theme-trnslate.txt').write_text(translations(theme))
    return dict(textures=len(theme.defs), switches=len(switches), animations=len(flat_anims) + len(wall_anims),
                glyph_screens=sum(len(f) == GLYPH_FRAMES for f, _ in wall_anims), hazard_faces=hazards,
                glows=len(glows), extra=named, materials=theme.log, sector_zones=zones,
                zones={z: zones.count(z) for z in list(WINGS) + ['skip'] if zones.count(z)})


# PDAgenticDecor<n> colourways (15404 set dressing: battery cell ABAT, Doom's ELEC column as a
# server rack, COLU lamp; DOOM.WAD has no TLP2): code green, server teal, gel pink, sodium, steel blue, lab white, amber, sage.
DECOR_COLOURWAYS = [('#0a3a1a', '#b8ffd0'), ('#06262a', '#8af0e8'), ('#3a0a18', '#ffb0c0'), ('#3a1a04', '#ffd090'),
                    ('#0a1430', '#a8c8ff'), ('#5a6066', '#ffffff'), ('#3a1a06', '#ffe0a0'), ('#1a2a16', '#e0f0d0')]


def translations(theme):
    """TRNSLATE: the Construct's white chair, SMITH's possessed green and the decor colourways."""
    out = ['// Generated by scripts/agentic_theme.py.',
           'PDConstructWhite = "0:255=%[0.62,0.64,0.66]:[2.00,2.00,2.00]"',
           'PDPossessed = "0:255=%[0.00,0.08,0.02]:[0.70,1.90,0.95]"']
    pixels = theme.iwad.sprite_pixels('ELECA0') + theme.iwad.sprite_pixels('COLUA0')
    values = sorted(theme.iwad.intensity[i] for i in pixels if i not in theme.accent_index) or [0, 1]
    lo, hi = values[len(values) * 4 // 100], values[len(values) * 96 // 100]
    for n, (dark, bright) in enumerate(DECOR_COLOURWAYS):
        parts = ['0:255=' + fmt(*ramp(rgb(dark), rgb(bright), lo, hi))]
        for key, runs in ACCENT_RUNS.items():
            a_lo, a_hi = theme.class_range[key]
            for a, b in runs: parts.append(f'{a}:{b}=' + fmt(*ramp(*ACCENTS[key], a_lo, a_hi, kmax=4)))
        out.append(f'PDAgenticDecor{n} = ' + ', '.join(f'"{p}"' for p in parts))
    return '\n'.join(out) + '\n'


# Set dressing (optional, for the map script): Doom's tech column recoloured as a server rack
# (PDAgenticDecor 15404, arg1 1) in square room corners of the machine and office wings, clear of
# doorways and keep-clear spots. Jonathan, 2026-10-23: the glowing battery cells (PDAgenticProp kind
# 23) scattered on the floors read as pickups, so the corners hold racks instead.
BATTERY_WINGS = {'farm', 'ward', 'harvester', 'office', 'east'}
RACK_COLOURWAY = {'farm': 4, 'ward': 2, 'harvester': 3, 'office': 7, 'east': 1}   # DECOR_COLOURWAYS index


def dress(model, polys, keep_clear=(), extra_zones=None, prop=15404, per_room=2):
    verts = model['vertices']
    openings = {l[k] for l in model['lines'] if l['sideback'] >= 0 for k in ('v1', 'v2')}
    walls = {}
    for line in model['lines']:
        if line['sideback'] >= 0: continue
        s = model['sides'][line['sidefront']]['sector']
        for a, b in [(line['v1'], line['v2']), (line['v2'], line['v1'])]: walls.setdefault((s, a), []).append(b)
    placed, things = [], []
    def usable(s, x, y):
        sec = model['sectors'][s]
        return (sector_at(polys, x, y) == s and sec['heightceiling'] - sec['heightfloor'] >= 104 and not
                any(math.hypot(x - px, y - py) < 112 for px, py in keep_clear) and not
                any(math.hypot(x - verts[v]['x'], y - verts[v]['y']) < 64 for v in openings) and not
                any(math.hypot(x - px, y - py) < 176 for px, py in placed))
    order = sorted(range(len(polys)), key=lambda i: -(polys[i][1][2] - polys[i][1][0]) * (polys[i][1][3] - polys[i][1][1]))
    for s in order:
        x0, y0, x1, y1 = polys[s][1]
        wing = zone_of(s, polys, extra_zones)
        if min(x1 - x0, y1 - y0) < 160 or wing not in BATTERY_WINGS: continue
        count = 0
        for (sector, v), ends in sorted(walls.items()):
            if sector != s or len(ends) != 2 or count >= per_room: continue
            vx, vy = verts[v]['x'], verts[v]['y']
            dirs = []
            for e in ends:
                dx, dy = verts[e]['x'] - vx, verts[e]['y'] - vy; n = math.hypot(dx, dy) or 1
                dirs.append((dx / n, dy / n))
            if abs(dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1]) > .35: continue
            bx, by = dirs[0][0] + dirs[1][0], dirs[0][1] + dirs[1][1]; n = math.hypot(bx, by)
            x, y = vx + bx / n * 36, vy + by / n * 36
            if not usable(s, x, y): continue
            things.append(dict(x=round(x), y=round(y), type=prop, arg0=RACK_COLOURWAY[wing], arg1=1, angle=round(math.degrees(math.atan2(-by, -bx))) % 360,
                               skill1=True, skill2=True, skill3=True, skill4=True, skill5=True, single=True, coop=True, dm=True))
            placed.append((x, y)); count += 1
    return things
