#!/usr/bin/env python3
"""Build the two playable-CEO mugshot sets for p(DOOM)'s status bar.

The player picks Sam Altman or Dario Amodei; that CEO's face replaces Doomguy's in the
original Doom status-bar face slot. Each set is derived frame-by-frame from Doomguy's own
42 STF* mugshots in the user's local DOOM.WAD, so every eye direction, head turn,
expression (ouch / evil grin / rampage / god / dead) and all five pain levels (blood,
bruising) are inherited from the matching original frame. Per frame the script:

  1. classifies Doomguy's pixels (hair, skin, eyes/teeth, blood) using a small table of
     hand-measured anchors (eye boxes, forehead hairline, ear line) for that frame;
  2. narrows and softens the lower face (Sam: slim jaw, smooth young face), then
     recolours skin through a per-CEO PLAYPAL ramp (light still from the upper left);
  3. repaints hair with the CEO's ramp, texture and silhouette (Dario: big dark curls
     that spill into the lump's empty corners; Sam: short back and sides with bare ears,
     a higher hairline and a short textured fringe);
  4. repaints the eye band and stamps the CEO's own eyes on EVERY frame, acted the way
     Doomguy acts that frame (calm / worried + bloodshot with pain / shock / grin /
     rampage / god glow; the brow on the glance side cocks like Doomguy's): Sam's big
     open hazel eyes and thin raised brows; Dario's boxy glasses with small eyes behind
     them (knocked askew when dead); plus a collar in the empty bottom corners (Sam:
     grey-green crewneck; Dario: dark sweater);
  5. puts the original blood back on top (never over the drawn eyes/glasses) so pain
     escalates on Doomguy's schedule and no further.

Outputs (git-ignored, derived from the commercial IWAD):
  doom-web/local/ui/faces/altman/<LUMP>.png   42 RGBA PNGs, same size/offsets as the lump
  doom-web/local/ui/faces/amodei/<LUMP>.png
  doom-web/local/ui/faces/ceo-manifest.json
Review sheets (--preview, default on):
  output/doom-hud/ceo/faces-preview.png      Doomguy / Altman / Amodei, every frame, 4x
  output/doom-hud/ceo/statusbar-mock.png     STFST01 of each in the real STBAR, 1x and 4x
  output/doom-hud/ceo/hero.png               both CEOs: look left/centre/right, ouch, grin, 6x

Every opaque output pixel is an exact PLAYPAL colour; the build is deterministic (no
randomness, no timestamps), so deleting the outputs and re-running gives identical bytes.

Usage: python3 scripts/build-ceo-faces.py [--wad PATH] [--no-preview]
"""
from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WAD = ROOT / 'doom-web/local/DOOM.WAD'
FACES_DIR = ROOT / 'doom-web/local/ui/faces'
PREVIEW_DIR = ROOT / 'output/doom-hud/ceo'

# st_stuff.c order: per pain level the three straight faces (look right / centre / left),
# turn right, turn left, ouch, evil grin, rampage; then god mode and dead.
LUMPS = [
    name
    for p in range(5)
    for name in (f'STFST{p}0', f'STFST{p}1', f'STFST{p}2', f'STFTR{p}0', f'STFTL{p}0',
                 f'STFOUCH{p}', f'STFEVL{p}', f'STFKILL{p}')
] + ['STFGOD0', 'STFDEAD0']

CEOS = {
    'altman': 'Sam Altman',
    'amodei': 'Dario Amodei',
}

FACE_SLOT = (143, 168)          # where st_stuff.c draws the face patch (minus offsets)


# --------------------------------------------------------------------------------------
# WAD decoding
# --------------------------------------------------------------------------------------

def read_wad(path: Path) -> dict[str, bytes]:
    blob = path.read_bytes()
    if blob[:4] not in (b'IWAD', b'PWAD'):
        raise SystemExit(f'{path} is not a WAD file')
    count, directory = struct.unpack_from('<II', blob, 4)
    lumps: dict[str, bytes] = {}
    for i in range(count):
        offset, size, name = struct.unpack_from('<II8s', blob, directory + i * 16)
        lumps.setdefault(name.rstrip(b'\0').decode('ascii', 'replace'), blob[offset:offset + size])
    return lumps


def decode_patch(data: bytes):
    """(width, height, leftoffset, topoffset, rows) with rows[y][x] = palette index | None."""
    w, h, left, top = struct.unpack_from('<HHhh', data)
    rows: list[list[int | None]] = [[None] * w for _ in range(h)]
    for x in range(w):
        pos = struct.unpack_from('<I', data, 8 + x * 4)[0]
        while data[pos] != 0xFF:
            start, length = data[pos], data[pos + 1]
            for i, colour in enumerate(data[pos + 3:pos + 3 + length]):
                if start + i < h:
                    rows[start + i][x] = colour
            pos += length + 4
    return w, h, left, top, rows


# --------------------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------------------

class Palette:
    def __init__(self, playpal: bytes):
        self.rgb = [tuple(playpal[i * 3:i * 3 + 3]) for i in range(256)]

    def luma(self, i: int) -> float:
        r, g, b = self.rgb[i]
        return 0.299 * r + 0.587 * g + 0.114 * b

    @staticmethod
    def dist(a, b) -> float:
        rm = (a[0] + b[0]) / 2
        dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
        return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db

    def nearest(self, rgb, candidates) -> int:
        return min(candidates, key=lambda i: (self.dist(self.rgb[i], rgb), i))


R = range
FLESH = set(R(0x30, 0x50))                      # Doomguy's skin + hair ramp
REDS = set(R(0x10, 0x30)) | set(R(0xA8, 0xC0))  # flush, bruises and blood
GREYS = set(R(0x50, 0x70)) | {0}                # eye whites, pupils, teeth
WARM = set(R(0xD0, 0xE0)) | set(R(0xA0, 0xA8)) | set(R(0x90, 0x98)) | {0x0D, 0x0E, 0x0F}
DARK_HAIR = set(R(0x47, 0x50)) | {0x0D, 0x0E, 0x0F}


def noise(x: int, y: int, seed: int) -> float:
    """Deterministic 0..1 hash noise."""
    h = (x * 374761393 + y * 668265263 + seed * 362437) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


# --------------------------------------------------------------------------------------
# Per-frame anchors, measured from the original lumps (lump-local coordinates).
#   eyes   : eye boxes (x0, x1, y0, y1), screen-left eye first
#   far    : index of the foreshortened eye in a head turn (None when facing out)
#   hc     : first forehead row below the hairline
#   kind   : st | tl | tr | ouch | evl | kill | god | dead
#   gaze   : -1 looking to screen-left, 0 ahead, +1 to screen-right
# --------------------------------------------------------------------------------------

def frame_meta(name: str) -> dict:
    m: dict = {'name': name, 'far': None, 'gaze': 0, 'ear': 12}
    if name.startswith('STFST'):
        p, d = int(name[5]), int(name[6])
        ey = (14, 14, 16, 17, 17)[p]
        shift = {(1, 0): -1, (1, 2): 1, (2, 0): -1, (2, 2): 1,
                 (3, 0): 1, (3, 2): -1, (4, 0): 1, (4, 2): -1}.get((p, d), 0)
        m.update(kind='st', pain=p, gaze=(1, 0, -1)[d], shift=shift,
                 eyes=[(5 + shift, 9 + shift, ey, ey), (14 + shift, 18 + shift, ey, ey)],
                 hc=(8, 8, 10, 11, 11)[p])
    elif name.startswith('STFOUCH'):
        p = int(name[7])
        m.update(kind='ouch', pain=p, eyes=[(5, 9, 14, 16), (14, 18, 14, 16)], hc=8)
    elif name.startswith('STFEVL') or name.startswith('STFKILL'):
        p = int(name[-1])
        m.update(kind='evl' if 'EVL' in name else 'kill', pain=p,
                 eyes=[(5, 9, 16, 16), (14, 18, 16, 16)], hc=10)
    elif name == 'STFGOD0':
        m.update(kind='god', pain=0, eyes=[(5, 9, 14, 14), (14, 18, 14, 14)], hc=8)
    elif name == 'STFDEAD0':
        m.update(kind='dead', pain=4, eyes=[(5, 9, 13, 13), (14, 18, 13, 13)], hc=9)
    elif name.startswith('STFTL'):
        p = int(name[5])
        eyes = {0: [(2, 3, 14, 14), (10, 12, 15, 15)], 1: [(2, 3, 14, 14), (10, 12, 15, 15)],
                2: [(3, 5, 16, 16), (9, 12, 16, 16)], 3: [(5, 7, 17, 17), (10, 14, 17, 17)],
                4: [(5, 7, 17, 17), (10, 14, 17, 17)]}[p]
        m.update(kind='tl', pain=p, eyes=eyes, far=0, gaze=-1, hc=(9, 9, 10, 11, 11)[p])
    elif name.startswith('STFTR'):
        p = int(name[5])
        eyes = {0: [(13, 15, 15, 15), (22, 23, 14, 14)], 1: [(13, 15, 15, 15), (22, 23, 14, 14)],
                2: [(14, 17, 16, 16), (21, 23, 16, 16)], 3: [(14, 18, 16, 16), (21, 23, 16, 16)],
                4: [(14, 18, 16, 16), (21, 23, 16, 16)]}[p]
        m.update(kind='tr', pain=p, eyes=eyes, far=1, gaze=1, hc=(9, 9, 10, 10, 10)[p])
    else:
        raise KeyError(name)
    return m


# --------------------------------------------------------------------------------------
# Frame model
# --------------------------------------------------------------------------------------

class Frame:
    def __init__(self, name: str, data: bytes, pal: Palette):
        self.name = name
        self.pal = pal
        self.w, self.h, self.left, self.top, self.src = decode_patch(data)
        self.meta = frame_meta(name)
        self.kind = self.meta['kind']
        self.eyes = self.meta['eyes']
        self.hc = self.meta['hc']
        self.eye_top = min(e[2] for e in self.eyes)
        self.eye_bot = max(e[3] for e in self.eyes)
        self.turn = self.kind in ('tl', 'tr')
        self._classify()

    # helpers ------------------------------------------------------------------------
    def tone(self, i: int) -> float:
        """0 = lightest flesh (0x30) .. 1 = darkest (0x4F)."""
        l0, l1 = self.pal.luma(0x30), self.pal.luma(0x4F)
        return max(0.0, min(1.0, (l0 - self.pal.luma(i)) / (l0 - l1)))

    def face_cols(self):
        """Columns that belong to the face (forehead) rather than temple/back of head."""
        (lx0, _, _, _), (rx0, rx1, _, _) = self.eyes[0], self.eyes[1]
        if self.kind == 'tl':
            near = self.eyes[1]
            return range(0, near[1] + 2)
        if self.kind == 'tr':
            near = self.eyes[0]
            return range(near[0] - 1, self.w)
        return range(lx0 - 1, rx1 + 2)

    def in_eye_box(self, x, y, pad=0) -> bool:
        return any(x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad
                   for x0, x1, y0, y1 in self.eyes)

    # classification -------------------------------------------------------------------
    def _classify(self):
        """cls[y][x]: None, 'hair', 'skin', 'eye', 'blood', 'warm'."""
        w, h = self.w, self.h
        face = set(self.face_cols())
        cls = [[None] * w for _ in range(h)]
        brow = self.eye_top - 1
        for y in range(h):
            for x in range(w):
                i = self.src[y][x]
                if i is None:
                    continue
                if i in REDS:
                    c = 'blood'
                elif i in GREYS or i in R(0xC0, 0xD0) or i in R(0xE0, 0xE8):
                    c = 'eye'
                elif i in WARM:
                    c = 'warm'
                else:
                    c = 'skin'
                if c == 'skin' or (c == 'warm' and i in (0x0D, 0x0E, 0x0F)):
                    if x in face:
                        zone1 = y < self.hc
                        zone2 = self.hc <= y < brow - 1 and i in DARK_HAIR
                    else:
                        # temples / back of the head: hair down to the ear line, and on a
                        # turned head every dark pixel above the jaw is hair.
                        ear = self.meta['ear'] if not self.turn else self.hc
                        zone1 = y < ear
                        jaw = self.eye_bot + 6
                        zone2 = y < jaw and i in DARK_HAIR and (self.turn or y < brow + 1)
                    if zone1 or zone2:
                        c = 'hair'
                cls[y][x] = c
        self.cls = cls


# --------------------------------------------------------------------------------------
# CEO styles
# --------------------------------------------------------------------------------------

def lerp_keys(keys, t):
    """Piecewise-linear colour from [(t, (r, g, b)), ...] sorted by t."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, c0), (t1, c1) in zip(keys, keys[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return tuple(c0[i] + (c1[i] - c0[i]) * k for i in range(3))
    return keys[-1][1]


class Ramp:
    """Tone 0 (light) .. 1 (dark) -> PLAYPAL index, snapped to an allowed candidate set."""

    def __init__(self, pal: Palette, keys, candidates, steps: int = 48):
        self.steps = steps
        self.table = [pal.nearest(lerp_keys(keys, i / (steps - 1)), candidates) for i in range(steps)]

    def __call__(self, t: float) -> int:
        return self.table[max(0, min(self.steps - 1, int(round(t * (self.steps - 1)))))]


BROWNS = sorted(set(R(0x40, 0x50)) | set(R(0x80, 0x90)) | set(R(0x90, 0x98)) | {1, 2, 0x0D, 0x0E, 0x0F}
                | set(R(0xEC, 0xF0)))
SKIN_POOL = sorted(set(R(0x30, 0x50)) | set(R(0x10, 0x18)))
OLIVE_POOL = sorted(set(R(0x98, 0xA0)) | set(R(0x58, 0x70)) | set(R(0x80, 0x90)))


class Style:
    def __init__(self, pal: Palette, cfg: dict):
        self.pal = pal
        self.cfg = cfg
        self.hair = Ramp(pal, cfg['hair'], BROWNS)
        self.shirt = Ramp(pal, cfg['shirt'], OLIVE_POOL)
        self.skin: dict[int, int] = {}
        lift, (tr, tg, tb) = cfg['skin_lift'], cfg['skin_tint']
        for i in sorted(FLESH | WARM):
            r, g, b = pal.rgb[i]
            r, g, b = r + (255 - r) * lift, g + (255 - g) * lift, b + (255 - b) * lift
            rgb = (min(255, r * tr), min(255, g * tg), min(255, b * tb))
            pool = SKIN_POOL if i in FLESH else sorted(set(SKIN_POOL) | WARM)
            self.skin[i] = pal.nearest(rgb, pool)
        for k, v in cfg.get('skin_override', {}).items():
            self.skin[k] = v

    def __getattr__(self, key):
        try:
            return self.cfg[key]
        except KeyError:
            raise AttributeError(key)


STYLE_CFG = {
    'altman': {
        # fair, slightly pink skin; neat short brown hair; grey-green crewneck
        'skin_lift': 0.20, 'skin_tint': (1.0, 0.96, 0.96),
        'hair': [(0.0, (132, 96, 62)), (0.35, (100, 72, 46)), (0.7, (70, 52, 32)), (1.0, (40, 30, 16))],
        'hair_src_weight': 0.5, 'hair_span': (0.05, 0.82), 'quiff': 0.25, 'streak': 0.30,
        'shirt': [(0.0, (128, 132, 104)), (0.5, (98, 104, 78)), (1.0, (58, 64, 42))],
        'rib': 0x98,
        'brow': 0x96, 'brow_soft': 0x94, 'lash': 0x4E, 'white': 0x50, 'white_lo': 0x54,
        'iris': 0x9B, 'pupil': 0x00, 'red_white': 0x17, 'red_rim': 0x1F,
        'lip': 0x48, 'lip_corner': 0x46, 'lip_lo': 0x38,
        'slim': 0.40, 'soften': 0.55, 'trim': True, 'curls': False,
    },
    'amodei': {
        # fair skin, big dark-brown curly hair, boxy dark-rimmed glasses, dark sweater
        'skin_lift': 0.10, 'skin_tint': (1.0, 0.98, 0.98),
        'hair': [(0.0, (118, 84, 50)), (0.3, (84, 60, 36)), (0.65, (54, 40, 22)), (1.0, (28, 22, 10))],
        'hair_src_weight': 0.45, 'hair_span': (0.1, 0.95),
        'shirt': [(0.0, (84, 84, 84)), (0.5, (60, 60, 60)), (1.0, (36, 36, 36))],
        'rib': 0x66,
        'brow': 0x4E, 'frame': 0x6E, 'frame_hi': 0x63,
        'lip': 0x49, 'lip_corner': 0x46, 'lip_lo': 0x39,
        'brow_soft': 0x4C, 'white': 0x58, 'white_lo': 0x5C, 'iris': 0x4C, 'pupil': 0x00,
        'red_white': 0x17, 'red_rim': 0x1F,
        'slim': 0.14, 'soften': 0.35, 'trim': False, 'curls': True,
    },
}


def make_styles(pal: Palette) -> dict[str, Style]:
    return {k: Style(pal, v) for k, v in STYLE_CFG.items()}


# --------------------------------------------------------------------------------------
# Builders
# --------------------------------------------------------------------------------------

def grid(w, h, v=None):
    return [[v] * w for _ in range(h)]


def slim_rows(frame: Frame, src, cls, amount: float):
    """Narrow the lower face: compress each row's outer pixels toward the row centre,
    more strongly toward the chin. Rows above the cheekbones are untouched."""
    w, h = frame.w, frame.h
    y0 = frame.eye_bot + 2
    if frame.turn:
        amount *= 0.6
    s2, c2 = [r[:] for r in src], [r[:] for r in cls]
    for y in range(y0, h):
        xs = [x for x in range(w) if src[y][x] is not None]
        if len(xs) < 6:
            continue
        lx, rx = xs[0], xs[-1]
        c = (lx + rx) / 2
        t = (y - y0) / max(1, h - 1 - y0)
        s = 1 - amount * (0.35 + 0.65 * t)
        core = 3.0
        for x in range(w):
            dx = x - c
            a = abs(dx)
            if a <= core:
                ox = x
            else:
                oa = core + (a - core) / s
                ox = math.floor(c + oa + 0.5) if dx > 0 else math.ceil(c - oa - 0.5)
            if lx <= ox <= rx:
                s2[y][x], c2[y][x] = src[y][ox], cls[y][ox]
            else:
                s2[y][x], c2[y][x] = None, None
    return s2, c2


def soften(frame: Frame, src, cls, amount: float):
    """Pull the lower face's flesh tones toward their local average: Doomguy's hard
    cheek hollows and jaw muscles become a smoother, younger face. Blood, eyes, teeth
    and lips are untouched."""
    if amount <= 0:
        return src
    w, h = frame.w, frame.h
    out = [r[:] for r in src]
    for y in range(frame.eye_bot + 2, h):
        for x in range(w):
            i = src[y][x]
            if i is None or i not in FLESH or cls[y][x] != 'skin':
                continue
            nb = [src[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                  if 0 <= y + dy < h and 0 <= x + dx < w and src[y + dy][x + dx] is not None
                  and src[y + dy][x + dx] in FLESH and cls[y + dy][x + dx] == 'skin']
            avg = sum(nb) / len(nb)
            out[y][x] = int(round(avg + (1 - amount) * (i - avg)))
    return out


def hair_mass_shade(mask, x, y, w, h) -> float:
    """Volumetric shade (0 light .. 1 dark) for a hair pixel lit from the upper left."""
    def inside(a, b):
        return 0 <= a < w and 0 <= b < h and mask[b][a]
    up = sum(1 for k in range(1, 4) if inside(x - k, y - k))
    down = sum(1 for k in range(1, 4) if inside(x + k, y + k))
    s = 0.50 - 0.07 * (3 - up) + 0.09 * (3 - down)
    if not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
        s += 0.22
    return s


def grow_curls(frame: Frame, src, hair):
    """Dario: a rounder, fuller, bumpy curl mass that spills into the lump's empty upper
    corners and over the tops of the ears; a scalloped fringe on the forehead."""
    w, h = frame.w, frame.h
    limit = frame.meta['ear'] + 2 if not frame.turn else frame.hc + 2
    for y in range(0, limit):
        xs = [x for x in range(w) if src[y][x] is not None]
        if not xs:
            continue
        lx, rx = xs[0], xs[-1]
        bump = 1 if (y // 2) % 2 == 0 else 0
        grow = (2 if y < 3 else 1) + bump
        if y >= frame.meta['ear'] and not frame.turn:
            grow = 0       # ears: just cover their tops with the existing side hair
        for x in range(max(0, lx - grow), lx):
            hair[y][x] = True
        for x in range(rx + 1, min(w, rx + 1 + grow)):
            hair[y][x] = True
    # round the crown: knock corner pixels off the top rows so the mass reads as a
    # cloud of curls rather than a box
    for y, cut in ((0, 2), (1, 1)):
        xs = [x for x in range(w) if hair[y][x]]
        if len(xs) > 2 * cut + 6:
            for x in xs[:cut] + xs[-cut:]:
                hair[y][x] = False
    # side curls over the top of the ears (front views)
    if not frame.turn:
        e = frame.meta['ear']
        for x in (0, 1, w - 2, w - 1):
            if src[e][x] is not None or hair[e - 1][x]:
                hair[e][x] = True
    # bumpy outline: every other pair of rows / columns steps in a pixel at the edge of
    # the mass, so the silhouette reads as a cloud of curls
    ear = frame.meta['ear'] if not frame.turn else frame.hc
    for x in range(w):
        ys = [y for y in range(h) if hair[y][x]]
        e = min(x, w - 1 - x) if not frame.turn else x
        if ys and (e // 2) % 2 == 0 and len(ys) > 3 and ys[0] < 3:
            hair[ys[0]][x] = False
    for y in range(2, ear + 1):
        xs = [x for x in range(w) if hair[y][x]]
        if len(xs) > 3 and (y // 2) % 2 == 1:
            if src[y][xs[0]] is None or xs[0] == 0:
                hair[y][xs[0]] = False
            if src[y][xs[-1]] is None or xs[-1] == w - 1:
                hair[y][xs[-1]] = False
    # no lone curl pixels floating off the crown
    for y in range(0, 4):
        for x in range(w):
            if hair[y][x] and src[y][x] is None:
                if not any(0 <= x + dx < w and (hair[y][x + dx] or src[y][x + dx] is not None)
                           for dx in (-1, 1)):
                    hair[y][x] = False
    # scalloped fringe: curls dip one row onto the forehead every other pair of columns
    for x in frame.face_cols():
        if (x // 2) % 2 == 0 and 0 <= x < w:
            y = frame.hc
            if src[y][x] is not None and not frame.in_eye_box(x, y, 2):
                hair[y][x] = True


def trim_hair(frame: Frame, src, hair, removed, temple):
    """Sam: short back and sides. The crown loses a pixel each side, the hair at the
    temples stops at the hairline so the sides of the face and both ears show (front
    views), and a short, textured fringe breaks the hairline."""
    w, h = frame.w, frame.h
    for y in range(0, frame.meta['ear'] - 1):
        xs = [x for x in range(w) if src[y][x] is not None]
        if not xs:
            continue
        for x in (xs[0], xs[-1]):
            if hair[y][x] and (y >= 2 or len(xs) > 12):
                removed[y][x] = True
                hair[y][x] = False
    if frame.turn or frame.kind == 'dead':
        return
    face = set(frame.face_cols())
    side_end = frame.hc + 1
    for y in range(side_end, h):
        for x in range(w):
            i = src[y][x]
            if hair[y][x] and x not in face and not removed[y][x] and i is not None:
                # Doomguy's dark side-hair becomes the shaded side of a short-haired head
                hair[y][x] = False
                lit = x < w / 2
                temple[y][x] = max(0x41 if lit else 0x44, min(0x46 if lit else 0x49, i - 4))
    # Doomguy's black ear-canal pixels sat inside his dark side-hair; on Sam's bare ears
    # they become a shadowed fold instead of a hole
    for y in range(h):
        for x in range(w):
            if src[y][x] == 0 and x not in face and not frame.in_eye_box(x, y, 1):
                temple[y][x] = 0x47
    # a neater, higher hairline: the last hair row over the forehead becomes skin, in
    # the shadow of the fringe (not on pain 3-4, where Doomguy's strands hang down)
    hl = sam_hairline(frame)
    if hl < frame.hc:
        for x in face:
            if hair[hl][x] and src[frame.hc][x] is not None and src[frame.hc][x] in FLESH:
                hair[hl][x] = False
                temple[hl][x] = min(0x4F, src[frame.hc][x] + 2)
    # fringe: short tips brushed forward over the hairline (asymmetric, lit side longer)
    (lx0, _, _, _), (_, rx1, _, _) = frame.eyes
    cx = (lx0 + rx1) / 2
    for dx, depth in ((-5.5, 1), (-3.5, 2), (-2.5, 1), (0.5, 1), (2.5, 2), (5.5, 1)):
        x = int(round(cx + dx))
        for d in range(depth):
            y = hl + d
            if 0 <= x < w and src[y][x] is not None and not frame.in_eye_box(x, y, 3):
                hair[y][x] = True
                temple[y][x] = None


def sam_hairline(frame: Frame) -> int:
    """First forehead row under Sam's fringe (front views)."""
    if frame.kind == 'st' and frame.meta['pain'] >= 3:
        return frame.hc
    return frame.hc - 1


def build_ceo(frame: Frame, ceo: str, st: Style) -> list[list[int | None]]:
    w, h = frame.w, frame.h
    src, cls = slim_rows(frame, frame.src, frame.cls, st.slim)
    src = soften(frame, src, cls, st.cfg.get('soften', 0.0))
    out = [row[:] for row in src]

    # hair mask, then CEO silhouette changes
    hair = [[cls[y][x] == 'hair' for x in range(w)] for y in range(h)]
    removed = grid(w, h, False)
    temple = grid(w, h, None)            # Doomguy flesh index for hair that became skin
    if st.curls:
        grow_curls(frame, src, hair)
        for y in range(h):
            for x in range(w):
                if cls[y][x] == 'hair' and not hair[y][x] and y < frame.hc:
                    removed[y][x] = True      # stepped-in curl outline
    if st.trim:
        trim_hair(frame, src, hair, removed, temple)

    # skin recolour
    for y in range(h):
        for x in range(w):
            i = src[y][x]
            if i is not None and cls[y][x] in ('skin', 'warm', 'hair'):
                out[y][x] = st.skin.get(i, i)
            if temple[y][x] is not None and i is not None:
                out[y][x] = st.skin[temple[y][x]]

    # hair paint: Doomguy's own hair texture where it exists + volumetric lighting
    wsrc = st.hair_src_weight
    for y in range(h):
        for x in range(w):
            if not hair[y][x]:
                continue
            i = src[y][x]
            mass = hair_mass_shade(hair, x, y, w, h)
            if i is not None and i in FLESH:
                lo, hi = st.cfg.get('hair_span', (0.0, 1.0))
                base = lo + (hi - lo) * max(0.0, min(1.0, (frame.tone(i) - 0.40) / 0.60))
                # strands hanging over the forehead (pain 3-4) keep Doomguy's light/dark
                # strand pattern so they read as loose hair rather than a solid fringe
                ws = max(wsrc, 0.85) if y >= frame.hc and x in frame.face_cols() else wsrc
                u = ws * base + (1 - ws) * mass
            else:
                u = mass
            u += hair_texture(st, x, y, frame)
            out[y][x] = st.hair(max(0.0, min(1.0, u)))
    for y in range(h):
        for x in range(w):
            if removed[y][x]:
                out[y][x] = None

    # features: protect[y][x] marks drawn feature pixels (eyes, brows, glasses, mouth)
    # that Doomguy's blood must not cover; cleared skin around them is not protected
    # once he is bleeding (pain 2+), so his blood still runs through the eye area.
    protect = grid(w, h, False)
    if ceo == 'amodei':
        dario_features(frame, src, cls, out, st, protect, hair)
    else:
        sam_features(frame, src, cls, out, st, protect, hair)
    calm_mouth(frame, src, out, st, protect)

    add_shirt(frame, out, st)

    # Doomguy's own blood back on top wherever hair or skin was repainted over it, so
    # the pain escalation matches the original (eyes / glasses stay on top)
    for y in range(h):
        for x in range(w):
            if cls[y][x] == 'blood' and out[y][x] is not None and not protect[y][x]:
                out[y][x] = src[y][x]
    return out


CURLS = (
    # 3x3 curl stamps, light from the upper left: highlight arc, dark core, shadowed tail
    ((-0.34, -0.24, 0.06), (-0.24, 0.20, 0.24), (0.06, 0.24, 0.30)),
    ((0.04, -0.32, -0.22), (-0.30, 0.22, 0.08), (-0.08, 0.14, 0.30)),
    ((-0.26, -0.30, 0.10), (-0.06, 0.26, -0.16), (0.22, 0.08, 0.26)),
)


def hair_texture(st: Style, x: int, y: int, frame: Frame) -> float:
    if st.curls:
        # staggered rows of curls; each curl picks one of three stamps so the mass
        # doesn't read as a tiled pattern
        band = y // 3
        sx = x + (band % 2) * 2 + int(noise(band, 0, 5) * 3)
        stamp = CURLS[int(noise(sx // 3, band, 11) * 2.999)] if st.cfg.get('curl_mix', True) else CURLS[0]
        return stamp[y % 3][sx % 3] + (noise(x, y, 7) - 0.5) * 0.14
    t = (noise(x, y, 3) - 0.5) * 0.10
    # combed texture: short vertical streaks, each column broken at its own rows
    k = st.cfg.get('streak', 0.0)
    if k:
        t += k * (noise(x, (y + int(noise(x, 0, 9) * 3)) // 3, 21) - 0.5)
    q = st.cfg.get('quiff', 0.0)
    if q and x in frame.face_cols():
        # the front of the hair is brushed up and forward: it catches the light
        d = (sam_hairline(frame) if st.trim and not frame.turn else frame.hc) - y
        if 2 <= d <= 4:
            t -= q * (1.0 if d == 3 else 0.6)
        elif d == 1:
            t += q * 0.5                 # shadow under the brushed-forward front
    return t


# --------------------------------------------------------------------------------------
# Expressions: every frame gets the CEO's own eyes, acted the way Doomguy acts that frame
# --------------------------------------------------------------------------------------

def expression(frame: Frame) -> str:
    """Eye/brow acting for a frame, keyed off Doomguy's frame type and pain level."""
    k, p = frame.kind, frame.meta['pain']
    if k in ('st', 'tl', 'tr'):
        return 'calm' if p <= 1 else 'worried'
    return {'ouch': 'shock', 'evl': 'grin', 'kill': 'fierce', 'god': 'god', 'dead': 'dead'}[k]


def bloodshot(frame: Frame) -> int:
    """0 clean, 1 red lower lid (pain 2), 2 red-rimmed (pain 3-4): Doomguy's own eyes
    redden on the same schedule."""
    p = frame.meta['pain']
    return 0 if p <= 1 else 1 if p == 2 else 2


def put(out, x, y, v, protect=None):
    if 0 <= y < len(out) and 0 <= x < len(out[0]) and out[y][x] is not None:
        out[y][x] = v
        if protect is not None:
            protect[y][x] = True


def shift_gaze(line: str, gaze: int, lo: int, hi: int) -> str:
    """Slide the iris/pupil run of one stamp row by `gaze` px inside columns lo..hi."""
    seg = list(line[lo:hi + 1])
    idx = [i for i, c in enumerate(seg) if c in 'IP']
    if not gaze or not idx or min(idx) + gaze < 0 or max(idx) + gaze >= len(seg):
        return line
    if gaze > 0:
        a, b = min(idx), max(idx) + 1
        seg[a:b + 1] = seg[b:b + 1] + seg[a:b]
    else:
        a, b = min(idx) - 1, max(idx)
        seg[a:b + 1] = seg[a + 1:b + 1] + seg[a:a + 1]
    return line[:lo] + ''.join(seg) + line[hi + 1:]


def redden(rows, level: int, lo: int, hi: int):
    """Bloodshot eyes for a screen-left-eye stamp whose outer corner is column lo."""
    rows = list(rows)
    eye = [r for r, line in enumerate(rows) if any(c in 'WwIPk' for c in line[lo:hi + 1])]
    if not level or not eye:
        return rows
    last, first = eye[-1], eye[0]
    line = list(rows[last])
    if level == 1:
        if line[lo] in 'Ww':
            line[lo] = 'r'
    else:
        line = [('R' if c in 'Wwk' and lo <= i <= hi else c) for i, c in enumerate(line)]
        top = list(rows[first])
        if top[lo] in 'Ww':
            top[lo] = 'r'
        rows[first] = ''.join(top)
    rows[last] = ''.join(line)
    return rows


# Skin used to repaint the eye band before the CEO's eyes go on (front views): the tone
# of a smooth brow per column, lit from the upper left, plus a per-row offset (lid a
# shade lighter, under-eye a shade darker). Indices are Doomguy flesh, then mapped
# through the CEO's skin ramp.
EYE_BAND_COLS = [0x4c, 0x4a, 0x47, 0x43, 0x3f, 0x3b, 0x38, 0x37, 0x39, 0x3b, 0x3d, 0x3d,
                 0x3d, 0x3d, 0x3b, 0x3a, 0x38, 0x38, 0x3a, 0x3d, 0x41, 0x46, 0x4a, 0x4c]
EYE_BAND_ROWS = {-4: 0, -3: 0, -2: -1, -1: 0, 0: 0, 1: 1, 2: 2}


def band_skin(st, x: int, dy: int, shift: int = 0, extra: int = 0) -> int:
    xi = max(0, min(len(EYE_BAND_COLS) - 1, x - shift))
    return st.skin[max(0x30, min(0x4F, EYE_BAND_COLS[xi] + EYE_BAND_ROWS.get(dy, 1) + extra))]


def local_skin(frame: Frame, src, hair, x: int, y0: int) -> int:
    """Doomguy's skin tone for column x just above (else below) the eye band of a turned
    head - the turned faces have their own side lighting."""
    for y in list(range(y0 - 4, y0 - 7, -1)) + list(range(y0 + 2, y0 + 5)):
        if 0 <= y < frame.h and 0 <= x < frame.w:
            i = src[y][x]
            if i is not None and i in FLESH and not hair[y][x] and frame.cls[y][x] == 'skin':
                return min(i, 0x45)
    return 0x3C


def repaint_band(frame, out, hair, protect, cols, dy_range, y0, skin_at):
    """Paint the eye band (Doomguy's brows, lids, squint) as plain skin. Hair that hangs
    over the brow (a fringe, pain 3-4 strands) stays. At pain 0-1 the cleared band is
    protected so Doomguy's pink under-eye flush isn't put back as 'blood'."""
    p = frame.meta['pain']
    for dy in dy_range:
        y = y0 + dy
        for x in cols:
            if not (0 <= x < frame.w and 0 <= y < frame.h) or out[y][x] is None:
                continue
            if hair[y][x] and dy < -1 and p >= 3:
                continue                            # pain 3-4: strands hang over the brow
            out[y][x] = skin_at(x, dy)
            if p <= 1:
                protect[y][x] = True


# Sam's eyes: screen-left eye, 6 columns (one either side of a 4-wide eye) x 7 rows
# (eye row - 4 .. eye row + 2); the screen-right eye is the mirror image.
#   B/b brow dark/soft   L upper lid   W/w eye white lit/shaded   I iris   P pupil
#   k lid crease (skin)  r/R bloodshot (see redden)   g/G/y god-mode glow
#   .  repainted skin
SAM_EYES = {
    'calm':    ['......', '.bBBb.', '......', '.LLLL.', '.WIPW.', '.wIIw.', '......'],
    'worried': ['...bB.', '.BB...', '......', '.LLLL.', '.WPPW.', '.wIIw.', '......'],
    'shock':   ['..BBb.', '.B....', '......', '.LLLL.', '.WWWW.', '.WPPW.', '......'],
    'grin':    ['......', '.bBBB.', '......', '.LLLL.', '.WPPW.', '.kIIk.', '......'],
    'fierce':  ['......', '.Bb...', '...BB.', '.LLLL.', '.WPPW.', '.wIIw.', '......'],
    'god':     ['......', '.bBBB.', '......', '.LLLL.', '.gGGg.', '.yggy.', '......'],
}


def cocked_brow(frame: Frame, k: int) -> int:
    """Doomguy raises the brow on the side he glances toward (STFST?0 / ?2); 1 for
    that eye, else 0."""
    g = frame.meta['gaze']
    return int(frame.kind == 'st' and g != 0 and k == (1 if g > 0 else 0))


def feature_colour(st, ch: str, skin: int) -> int:
    key = {'B': 'brow', 'b': 'brow_soft', 'L': 'lash', 'W': 'white', 'w': 'white_lo', 'I': 'iris',
           'P': 'pupil', 'r': 'red_white', 'R': 'red_rim'}.get(ch)
    if key:
        return st.cfg[key]
    return {'g': 0xA3, 'G': 0xE1, 'y': 0xA4}.get(ch, skin)


def sam_features(frame: Frame, src, cls, out, st: Style, protect, hair):
    """Sam's big, open, earnest eyes under thin raised brows, on every frame: calm when
    healthy, worried (brows up in the middle) and bloodshot as he gets hurt, wide with
    shock (ouch), beaming (evil grin), brows down (rampage), glowing (god)."""
    mode = expression(frame)
    if mode == 'dead':
        return
    if frame.turn:
        sam_turn(frame, src, out, st, protect, hair, mode)
        return
    gaze, shift, y0 = frame.meta['gaze'], frame.meta.get('shift', 0), frame.eye_top
    stamp = SAM_EYES[mode] if mode == 'god' else redden(SAM_EYES[mode], bloodshot(frame), 1, 4)
    for k, (x0, x1, _, _) in enumerate(frame.eyes):
        e0 = x0 + 1 if k == 0 else x0                  # 4-wide eye, Doomguy's outer column dropped
        rows = [shift_gaze(r if k == 0 else r[::-1], gaze, 1, 4) for r in stamp]
        cols = range(min(x0 - 1, e0 - 1), max(x1 + 1, e0 + 4) + 1)
        repaint_band(frame, out, hair, protect, cols, range(-4, 3), y0,
                     lambda x, dy: band_skin(st, x, dy, shift))
        cock = cocked_brow(frame, k)
        for r, line in enumerate(rows):
            dy = r - 4
            for c, ch in enumerate(line):
                x, y = e0 - 1 + c, y0 + dy
                if ch == '.' or not (0 <= x < frame.w):
                    continue
                if ch in 'Bb':
                    y -= cock
                    if hair[y][x] and frame.meta['pain'] >= 3:
                        continue                        # brows hidden by the strands
                put(out, x, y, feature_colour(st, ch, band_skin(st, x, dy, shift, 2)), protect)


def sam_turn(frame: Frame, src, out, st: Style, protect, hair, mode):
    """Turned head: the near eye big (whites + iris looking where he turns), the far eye
    foreshortened to a sliver; brows act as in the front views."""
    level = bloodshot(frame)
    gaze = frame.meta['gaze']
    for k, (x0, x1, y0, _) in enumerate(frame.eyes):
        far = frame.meta['far'] == k
        n = min(x1 - x0 + 1, 2 if far else 4)
        if gaze > 0:
            x0 = x1 - n + 1
        ex = list(range(x0, x0 + n))
        repaint_band(frame, out, hair, protect, range(ex[0] - 1, ex[-1] + 2), range(-3, 2), y0,
                     lambda x, dy: st.skin[max(0x30, min(0x4F, local_skin(frame, src, hair, x, y0)
                                                     + EYE_BAND_ROWS.get(dy, 1)))])
        # eye: pupils on the side he looks toward
        top = (['P', 'P'] + ['W'] * (n - 2)) if n > 2 else ['P', 'W']
        low = (['I', 'I'] + ['w'] * (n - 2)) if n > 2 else []
        if gaze > 0:
            top, low = top[::-1], low[::-1]
        outer = 0 if k == 0 else n - 1                   # outer corner index (screen space)
        if level and low and low[outer] == 'w':
            low[outer] = 'r'
        if level >= 2:
            low = ['R' if c == 'w' else c for c in low]
            if top[outer] == 'W':
                top[outer] = 'r'
        for i, x in enumerate(ex):
            put(out, x, y0 - 1, st.lash, protect)
            put(out, x, y0, feature_colour(st, top[i], 0), protect)
            if i < len(low):
                put(out, x, y0 + 1, feature_colour(st, low[i], 0), protect)
        # brows: inner end is toward the other eye (right for eye 0, left for eye 1)
        bx = list(range(ex[0] - (1 if (k == 0 and not far) else 0), ex[-1] + 1 + (1 if (k == 1 and not far) else 0)))
        inner = bx[len(bx) // 2:] if k == 0 else bx[:len(bx) - len(bx) // 2]
        for x in bx:
            dy = -3
            if mode == 'worried' and x in inner:
                dy = -4
            if 0 <= y0 + dy < frame.h and 0 <= x < frame.w and not hair[y0 + dy][x]:
                put(out, x, y0 + dy, st.brow if x in inner or mode == 'worried' else st.brow_soft, protect)


def calm_mouth(frame: Frame, src, out, st: Style, protect):
    """A smaller, closed, faintly smiling mouth on the calm straight faces."""
    if not (frame.kind in ('st', 'god') and frame.meta['pain'] <= 1):
        return
    (lx0, _, _, _), (_, rx1, _, _) = frame.eyes
    cx = (lx0 + rx1) / 2
    m = frame.meta.get('mouth', 23)
    a, b = int(math.floor(cx - 1.5)), int(math.ceil(cx + 1.5))      # 4 px wide
    for x in range(a - 3, b + 4):
        if src[m][x] is not None and (src[m][x] in WARM or src[m][x] in REDS):
            if src[m][x] not in REDS:
                out[m][x] = st.skin[0x3D]
        if m + 1 < frame.h and src[m + 1][x] is not None and src[m + 1][x] in WARM:
            out[m + 1][x] = st.skin[0x3A]
    for x in range(a, b + 1):
        put(out, x, m, st.lip, protect)
    put(out, a - 1, m - 1, st.lip_corner, protect)
    put(out, b + 1, m - 1, st.lip_corner, protect)
    for x in range(a + 1, b):
        put(out, x, m + 1, st.lip_lo, protect)


# Dario: brows over each lens (screen-left eye; 5 lens columns, rows frame-top - 3 .. - 1)
DARIO_BROWS = {
    'calm':    ['.....', 'BBBBb', '.....'],
    'worried': ['...bB', 'BBB..', '.....'],
    'shock':   ['.BBBb', 'B....', '.....'],
    'grin':    ['.....', 'BBBBb', '.....'],
    'fierce':  ['.....', 'BBb..', '...BB'],
    'god':     ['.....', 'BBBBb', '.....'],
    'dead':    ['.....', '.....', '.....'],
}
# Dario: what shows through each lens (5 columns, rows eye row .. ); '.' = lens skin
DARIO_LENS = {
    'calm':    ['.WPW.', '.....'],
    'worried': ['.WPW.', '.....'],
    'shock':   ['.WWW.', '.WPW.', '.....'],
    'grin':    ['.WPW.', '.kkk.'],
    'fierce':  ['.WPW.', '.....'],
}


def fit(line: str, n: int, k: int) -> str:
    """Fit a 5-column screen-left-eye row (already mirrored for eye 1) to n lens columns,
    dropping the outer columns first."""
    if n >= 5:
        pad = n - 5
        return '.' * (pad // 2) + line + '.' * (pad - pad // 2)
    if n == 4:
        return line[1:] if k == 0 else line[:4]
    if n == 3:
        return line[1:4]
    if n == 2:
        return line[1:3] if k == 0 else line[2:4]
    return line[2:3]


def dario_features(frame: Frame, src, cls, out, st: Style, protect, hair):
    """Boxy dark-rimmed glasses on every frame (two lenses, bridge, arms back to the
    ears on a turned head) with Dario's small friendly eyes behind them, acted per
    frame like Sam's."""
    w, h = frame.w, frame.h
    mode = expression(frame)
    gaze, shift = frame.meta['gaze'], frame.meta.get('shift', 0)
    level = bloodshot(frame) if mode not in ('god', 'dead') else 0
    boxes = []
    for x0, x1, y0, _ in frame.eyes:
        boxes.append([x0 - 1, x1 + 1, y0 - 1, y0 + (3 if mode == 'shock' else 2)])
    if mode == 'dead':
        boxes[1][2] += 1                          # knocked askew
        boxes[1][3] += 1
    if frame.turn:
        # the far lens is foreshortened: keep a pixel of bridge between the two lenses
        a, b = boxes
        if b[0] - a[1] < 2:
            if frame.meta['far'] == 0:
                a[1] = b[0] - 2
            else:
                b[0] = a[1] + 2
    for k, (fx0, fx1, fy0, fy1) in enumerate(boxes):
        y0 = fy0 + 1
        ix = list(range(fx0 + 1, fx1))           # lens interior columns
        n = len(ix)
        if frame.turn:
            def skin_at(x, dy, y0=y0):
                return st.skin[max(0x30, min(0x4F, local_skin(frame, src, hair, x, y0)
                                             + EYE_BAND_ROWS.get(dy, 1) - 1))]
        else:
            def skin_at(x, dy):
                return band_skin(st, x, dy, shift, -1)
        if mode in ('god', 'dead'):
            for y in range(fy0 + 1, fy1):
                for x in ix:
                    if 0 <= x < w and 0 <= y < h and out[y][x] is not None and mode == 'god':
                        protect[y][x] = True       # Doomguy's god-mode glow behind the glass
        else:
            repaint_band(frame, out, hair, protect, range(fx0, fx1 + 1),
                         range(-4, fy1 - y0 + 1), y0, skin_at)
            rows = []
            for line in DARIO_LENS[mode]:
                line = line if k == 0 else line[::-1]
                row = fit(line, n, k)
                if n <= 2 and 'P' in line and 'P' not in row:
                    row = ('PW' if gaze < 0 else 'WP')[:n]     # far lens: just the glance
                rows.append(shift_gaze(row, gaze, 0, len(row) - 1))
            eye_cols = sorted({i for r in rows for i, c in enumerate(r) if c in 'WP'})
            if level and eye_cols:
                # red lower lid: under the outer corner (pain 2), the outer two (pain 3-4)
                ordered = eye_cols if k == 0 else eye_cols[::-1]
                outer = ordered[0]
                last = list(rows[-1])
                for i in ordered[:2 if level >= 2 else 1]:
                    last[i] = 'R'
                rows[-1] = ''.join(last)
                if level >= 2:
                    for r, row in enumerate(rows[:-1]):
                        if 'P' in row and row[outer] == 'W':
                            rows[r] = row[:outer] + 'r' + row[outer + 1:]
            for r, row in enumerate(rows):
                y = y0 + r
                if y >= fy1:
                    break
                for i, ch in enumerate(row):
                    if ch != '.':
                        put(out, ix[i], y, feature_colour(st, ch, skin_at(ix[i], r + 2)), protect)
        # frame
        for y in range(fy0, fy1 + 1):
            for x in range(fx0, fx1 + 1):
                if y in (fy0, fy1) or x in (fx0, fx1):
                    put(out, x, y, st.frame, protect)
        put(out, fx0 + 1, fy0, st.frame_hi, protect)      # light from the upper left
        # brows over the frame (one skin row between, more when surprised)
        for r, line in enumerate(DARIO_BROWS[mode]):
            y = fy0 - 3 + r - cocked_brow(frame, k)
            row = fit(line if k == 0 else line[::-1], n, k)
            for i, ch in enumerate(row):
                x = ix[i]
                if ch in 'Bb' and 0 <= y < h and 0 <= x < w and not hair[y][x]:
                    put(out, x, y, st.brow if ch == 'B' else st.brow_soft, protect)
    (a0, a1, ay0, ay1), (b0, b1, by0, by1) = boxes
    yb = max(ay0, by0) + 1
    for x in range(a1 + 1, b0):
        put(out, x, yb, st.frame, protect)
    # arms running back toward the ears
    if frame.kind == 'tl':
        for x in range(b1 + 1, b1 + 4):
            put(out, x, by0 + 1, st.frame, protect)
    elif frame.kind == 'tr':
        for x in range(a0 - 3, a0):
            put(out, x, ay0 + 1, st.frame, protect)
    else:
        put(out, a0 - 1, ay0 + 1, st.frame, protect)
        put(out, b1 + 1, by0 + 1, st.frame, protect)


def add_shirt(frame: Frame, out, st: Style):
    """Shoulders and a crew collar in the empty bottom corners of the lump."""
    w, h = frame.w, frame.h
    xs = [x for x in range(w) if out[h - 1][x] is not None]
    cx = (xs[0] + xs[-1]) / 2 if xs else (w - 1) / 2
    face = [[out[y][x] is not None for x in range(w)] for y in range(h)]
    for y in range(h - 5, h):
        for x in range(w):
            if face[y][x]:
                continue
            d = abs(x - cx)
            top = h - 5 + max(0, int((d - 5) // 3))
            if y < top:
                continue
            # lit from the upper left: left shoulder lighter, darker toward the bottom
            t = 0.25 + 0.10 * (y - (h - 5)) + (0.28 if x > cx else 0.0) + 0.04 * (d / 4)
            out[y][x] = st.shirt(min(1.0, t))
    for y in range(h - 5, h):
        for x in range(w):
            if face[y][x] or out[y][x] is None:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and face[y + dy][x + dx]
                   for dx, dy in ((1, 0), (-1, 0), (0, -1))):
                out[y][x] = st.rib


# --------------------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------------------

def to_image(rows, pal: Palette) -> Image.Image:
    h, w = len(rows), len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            i = rows[y][x]
            if i is not None:
                px[x, y] = (*pal.rgb[i], 255)
    return im


def save_png(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format='PNG', optimize=False, compress_level=9)


def verify(frames, built, pal: Palette):
    """Output contract: same size as the lump, binary alpha, every opaque pixel PLAYPAL."""
    allowed = set(pal.rgb)
    for ceo in CEOS:
        for n, f in frames.items():
            im = built[ceo][n]
            if im.size != (f.w, f.h):
                raise SystemExit(f'{ceo}/{n}: size {im.size} != lump {(f.w, f.h)}')
            for r, g, b, a in im.getdata():
                if a not in (0, 255):
                    raise SystemExit(f'{ceo}/{n}: partial alpha {a}')
                if a and (r, g, b) not in allowed:
                    raise SystemExit(f'{ceo}/{n}: non-PLAYPAL colour {(r, g, b)}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--wad', type=Path, default=DEFAULT_WAD)
    ap.add_argument('--no-preview', action='store_true')
    args = ap.parse_args()

    lumps = read_wad(args.wad)
    missing = [n for n in LUMPS + ['PLAYPAL', 'STBAR'] if n not in lumps]
    if missing:
        raise SystemExit(f'{args.wad} is missing lumps: {", ".join(missing)}')
    pal = Palette(lumps['PLAYPAL'][:768])
    styles = make_styles(pal)
    frames = {n: Frame(n, lumps[n], pal) for n in LUMPS}

    built: dict[str, dict[str, Image.Image]] = {'doomguy': {n: to_image(f.src, pal) for n, f in frames.items()}}
    for ceo in CEOS:
        built[ceo] = {n: to_image(build_ceo(f, ceo, styles[ceo]), pal) for n, f in frames.items()}
    verify(frames, built, pal)

    for ceo in CEOS:
        for n in LUMPS:
            save_png(built[ceo][n], FACES_DIR / ceo / f'{n}.png')
    manifest = {
        'version': 1,
        'generator': 'scripts/build-ceo-faces.py',
        'source': 'user-supplied DOOM.WAD (PLAYPAL + STF* patches); each CEO frame is Doomguy\'s matching '
                  'frame recoloured and pixel-edited (hair, eyes/glasses, jaw, collar), blood kept',
        'draw': 'draw each PNG at (slotX - leftoffset, slotY - topoffset); the Doom face slot is (143, 168)',
        'ids': list(CEOS),
        'names': CEOS,
        'path': 'ui/faces/<id>/<LUMP>.png',
        'order': LUMPS,
        'lumps': {n: {'width': f.w, 'height': f.h, 'leftoffset': f.left, 'topoffset': f.top}
                  for n, f in frames.items()},
    }
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    (FACES_DIR / 'ceo-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'wrote {len(CEOS) * len(LUMPS)} faces + ceo-manifest.json to {FACES_DIR.relative_to(ROOT)}')

    if not args.no_preview:
        write_previews(lumps, pal, frames, built)
        print(f'wrote previews to {PREVIEW_DIR.relative_to(ROOT)}')


# --------------------------------------------------------------------------------------
# Previews (local review only)
# --------------------------------------------------------------------------------------

WHO = (('doomguy', 'Doomguy (original)'), ('altman', 'Sam Altman'), ('amodei', 'Dario Amodei'))
COLUMNS = ('look right', 'centre', 'look left', 'turn right', 'turn left', 'ouch', 'evil grin', 'rampage')


def slot_tile(im: Image.Image, f: Frame, bg) -> Image.Image:
    """The status-bar face box (x 143..177, y 168..200) with the patch at its real offset."""
    tile = Image.new('RGBA', (35, 33), bg)
    tile.alpha_composite(im, (FACE_SLOT[0] - f.left - 143, FACE_SLOT[1] - f.top - 168))
    return tile


def write_previews(lumps, pal, frames, built):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    bg = (*pal.rgb[0x05], 255)                 # the STBAR face box is filled with index 5
    ink, dim, sheet_bg = (240, 240, 240, 255), (200, 200, 120, 255), (24, 24, 30, 255)

    # faces-preview.png: every frame at 4x, per pain level Doomguy / Altman / Amodei
    S, gap, label_w, head = 4, 4, 168, 22
    tw, th = 35 * S, 33 * S
    rows = []
    for p in range(5):
        names = [n for n in LUMPS if n not in ('STFGOD0', 'STFDEAD0') and
                 (n[5] == str(p) if n[:5] in ('STFST', 'STFTL', 'STFTR') else n[-1] == str(p))]
        rows += [(f'{label}\npain {p}', who, names) for who, label in WHO]
    rows += [(f'{label}\ngod / dead', who, ['STFGOD0', 'STFDEAD0']) for who, label in WHO]
    sheet = Image.new('RGBA', (label_w + 8 * (tw + gap), head + len(rows) * (th + gap)), sheet_bg)
    d = ImageDraw.Draw(sheet)
    for k, c in enumerate(COLUMNS):
        d.text((label_w + k * (tw + gap) + 4, 5), c, fill=dim)
    for r, (label, who, names) in enumerate(rows):
        y = head + r * (th + gap)
        if r % 3 == 0 and r:
            d.line([(0, y - gap // 2 - 1), (sheet.width, y - gap // 2 - 1)], fill=(70, 70, 80, 255))
        d.multiline_text((8, y + th // 2 - 12), label, fill=ink, spacing=4)
        for k, n in enumerate(names):
            tile = slot_tile(built[who][n], frames[n], bg).resize((tw, th), Image.NEAREST)
            sheet.alpha_composite(tile, (label_w + k * (tw + gap), y))
            if n in ('STFGOD0', 'STFDEAD0'):
                d.text((label_w + k * (tw + gap) + 4, y + th - 14), 'god' if n == 'STFGOD0' else 'dead', fill=dim)
    sheet.convert('RGB').save(PREVIEW_DIR / 'faces-preview.png', compress_level=9)

    # statusbar-mock.png: the real STBAR with STFST01 in the face slot at 1x and 4x, plus
    # every frame at true size (1x) and 2x in its slot for a size check
    w, h, _, _, bar_rows = decode_patch(lumps['STBAR'])
    stbar = to_image(bar_rows, pal)
    f01 = frames['STFST01']
    margin, label_h, half = 10, 16, (len(LUMPS) + 1) // 2
    strip_w = len(LUMPS) * 36
    width = max(margin * 2 + 320 + 16 + 320 * 4, margin * 2 + strip_w)
    block = label_h + 32 * 4 + 10 + 33 + 6 + 2 * (66 + 4) + 16
    mock = Image.new('RGBA', (width, margin + len(WHO) * block), sheet_bg)
    d = ImageDraw.Draw(mock)
    for k, (who, label) in enumerate(WHO):
        y = margin + k * block
        d.text((margin, y), f'{label}  -  STFST01 in the status bar at 1x (left) and 4x; '
                            f'below, all 42 frames at 1x and 2x', fill=ink)
        y += label_h
        bar = stbar.copy()
        bar.alpha_composite(built[who]['STFST01'], (FACE_SLOT[0] - f01.left, FACE_SLOT[1] - f01.top - 168))
        mock.alpha_composite(bar, (margin, y))
        mock.alpha_composite(bar.resize((320 * 4, 32 * 4), Image.NEAREST), (margin + 320 + 16, y))
        y += 32 * 4 + 10
        for i, n in enumerate(LUMPS):
            tile = slot_tile(built[who][n], frames[n], bg)
            mock.alpha_composite(tile, (margin + i * 36, y))
            j = i % half
            mock.alpha_composite(tile.resize((70, 66), Image.NEAREST),
                                 (margin + j * 72, y + 33 + 6 + (i // half) * 70))
    mock.convert('RGB').save(PREVIEW_DIR / 'statusbar-mock.png', compress_level=9)

    write_hero(pal, frames, built, stbar, bg)


HERO = (('STFST02', 'look left'), ('STFST01', 'centre'), ('STFST00', 'look right'),
        ('STFOUCH0', 'ouch'), ('STFEVL0', 'evil grin'))


def write_hero(pal, frames, built, stbar, bg):
    """hero.png: each CEO's idle look left / centre / right, ouch and evil grin at 6x in
    the status-bar face box, with the same five frames and the real STBAR at 1x."""
    from PIL import ImageFont
    S, gap, pad = 6, 12, 28
    tw, th = 35 * S, 33 * S
    try:
        big, small = ImageFont.load_default(size=26), ImageFont.load_default(size=15)
    except TypeError:                                  # Pillow < 10.1: bitmap font only
        big = small = ImageFont.load_default()
    ink, dim, sheet_bg = (240, 240, 240, 255), (200, 200, 120, 255), (24, 24, 30, 255)
    row_h = 40 + th + 14 + 33 + 10
    width = pad * 2 + len(HERO) * tw + (len(HERO) - 1) * gap
    hero = Image.new('RGBA', (width, pad + 26 + len(CEOS) * (row_h + pad)), sheet_bg)
    d = ImageDraw.Draw(hero)
    for k, (_, label) in enumerate(HERO):
        d.text((pad + k * (tw + gap) + 4, pad), label, fill=dim, font=small)
    y = pad + 26
    for who, name in CEOS.items():
        d.text((pad, y), name, fill=ink, font=big)
        y += 40
        for k, (n, _) in enumerate(HERO):
            tile = slot_tile(built[who][n], frames[n], bg).resize((tw, th), Image.NEAREST)
            hero.alpha_composite(tile, (pad + k * (tw + gap), y))
        y += th + 14
        # true size: the five frames, then STFST01 in the real status bar
        for k, (n, _) in enumerate(HERO):
            hero.alpha_composite(slot_tile(built[who][n], frames[n], bg), (pad + k * 40, y))
        f = frames['STFST01']
        bar = stbar.copy()
        bar.alpha_composite(built[who]['STFST01'], (FACE_SLOT[0] - f.left, FACE_SLOT[1] - f.top - 168))
        hero.alpha_composite(bar, (pad + len(HERO) * 40 + 20, y))
        d.text((pad + len(HERO) * 40 + 20 + 330, y + 9), 'actual size (1x)', fill=dim, font=small)
        y += 33 + 10 + pad
    hero.convert('RGB').save(PREVIEW_DIR / 'hero.png', compress_level=9)


if __name__ == '__main__':
    main()
