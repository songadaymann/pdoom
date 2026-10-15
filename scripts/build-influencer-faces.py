#!/usr/bin/env python3
"""Build the two playable "AI-influencer" mugshot sets for p(DOOM)'s status bar.

The player picks SAM ALTMAN or DARIO AMODEI (internal ids samwise / mario; see
art/characters/*.webp); that character's face replaces Doomguy's in the original Doom
status-bar face slot. Like scripts/build-ceo-faces.py (whose decoding, classification,
eye and glasses code this script copies), every frame is derived from Doomguy's own
matching STF* mugshot in the user's local DOOM.WAD, so each eye direction, head turn,
expression (ouch / evil grin / rampage / god / dead) and all five pain levels (blood,
bruising) come from the original frame. Unlike the CEO sets, these heads are bigger
than Doomguy's: every lump fills the whole dark face box of STBAR (x 144..176,
y 2..31 of the 320x32 bar) and nothing is ever drawn outside it.

Per frame the script:
  1. classifies Doomguy's pixels (hair, skin, eyes/teeth, blood) with hand-measured
     anchors (eyes, hairline, nose, mouth), drops his hair, and places the rest of the
     face in the 33x30 box (Samwise: four columns removed and a chin row doubled -> a
     long narrow face; Mario: preserve the forehead and upper lip beneath his bald crown);
  2. narrows/softens the jaw and recolours the skin through a PLAYPAL ramp (Mario
     pale, Samwise fair and airbrushed);
  3. paints the character's hair around and behind the face, filling the box edge to
     edge (Mario: a bald crown with two spiky side tufts; Samwise: a
     centre-parted mane of feathered Bezier locks, lit crown to shadowed curtains,
     falling to the shoulders), plus hair in front of the face (Mario: sparse side tufts; Samwise: feathered curtain bangs) and
     Samwise's big ears;
  4. stamps the character's eyes on every frame, acted the way Doomguy acts that frame
     (Mario: worried brows and dark rounded glasses; Samwise: smug half-lidded
     blue-grey eyes), then the mouth (Mario: uncovered upper lip; Samwise: a smug half smile and a thin chin-strip goatee),
     and the clothes at the bottom edge (Mario: yellow suit and open white shirt; Samwise: brown tweed, cream collar, burgundy tie);
  5. puts Doomguy's own blood back on top (never over the eyes/glasses) so pain
     escalates exactly on Doomguy's schedule and no further.

Outputs (git-ignored, derived from the commercial IWAD):
  doom-web/local/ui/faces/samwise/<LUMP>.png   42 RGBA PNGs, 33x30, offsets (-1, -2)
  doom-web/local/ui/faces/mario/<LUMP>.png
  doom-web/local/ui/faces/<id>/manifest.json   per-set offsets (read first by
                                               scripts/build-doom-statusbar.py)
  doom-web/local/ui/faces/influencer-manifest.json
Review sheets (--preview, default on), in output/doom-hud/influencers/:
  faces-preview.png    every frame of both characters (and Doomguy) at 4x in the face box
  statusbar-mock.png   STFST01 of each in the real bar at 1x and 4x; all frames at 1x/2x
  hero.png             look left / centre / right, ouch, evil grin at 6x
  refs-vs-faces.png    each reference image beside its face at 6x

Every opaque output pixel is an exact PLAYPAL colour and alpha is 0 or 255; the build
is deterministic (hash noise only, no timestamps), so deleting the outputs and
re-running gives identical bytes.

Usage: python3 scripts/build-influencer-faces.py [--wad PATH] [--no-preview]
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
STBAR_DIR = ROOT / 'doom-web/local/ui/stbar'
PREVIEW_DIR = ROOT / 'output/doom-hud/influencers'
REFS = {'samwise': ROOT / 'art/characters/samwise-othermale.webp',
        'mario': ROOT / 'art/characters/references/new-mario.png'}

# st_stuff.c order: per pain level the three straight faces (look right / centre / left),
# turn right, turn left, ouch, evil grin, rampage; then god mode and dead.
LUMPS = [
    name
    for p in range(5)
    for name in (f'STFST{p}0', f'STFST{p}1', f'STFST{p}2', f'STFTR{p}0', f'STFTL{p}0',
                 f'STFOUCH{p}', f'STFEVL{p}', f'STFKILL{p}')
] + ['STFGOD0', 'STFDEAD0']

PEOPLE = {
    'samwise': 'Sam Altman',
    'mario': 'Dario Amodei',
}

FACE_SLOT = (143, 168)          # where st_stuff.c draws the face patch (minus offsets)
# The dark face box of STBAR: a 1px border (x 143 and 177, y 1) around an interior of
# x 144..176, y 2..31 (bar-local). Every lump is exactly that interior.
BOX_X, BOX_Y = 144, 2
W, H = 33, 30
LEFTOFFSET, TOPOFFSET = 143 - BOX_X, 0 - BOX_Y      # (-1, -2)


# --------------------------------------------------------------------------------------
# WAD decoding (from build-ceo-faces.py)
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


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


# --------------------------------------------------------------------------------------
# Per-frame anchors, measured from the original lumps (lump-local coordinates).
#   eyes   : eye boxes (x0, x1, y0, y1), screen-left eye first
#   far    : index of the foreshortened eye in a head turn (None when facing out)
#   hc     : first forehead row below the hairline
#   nose   : nostril row; the mustache starts below it
#   lip    : top row of the mouth (closed: the lip line; open: the first open row)
#   mbot   : last row of the mouth (lower lip / jaw of an open mouth)
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
                 hc=(8, 8, 10, 11, 11)[p],
                 nose=(19, 19, 20, 21, 21)[p], lip=(23, 23, 24, 25, 25)[p], mbot=(24, 24, 25, 27, 27)[p])
    elif name.startswith('STFOUCH'):
        p = int(name[7])
        m.update(kind='ouch', pain=p, eyes=[(5, 9, 14, 16), (14, 18, 14, 16)], hc=8,
                 nose=19, lip=24, mbot=28)
    elif name.startswith('STFEVL') or name.startswith('STFKILL'):
        p = int(name[-1])
        evl = 'EVL' in name
        m.update(kind='evl' if evl else 'kill', pain=p,
                 eyes=[(5, 9, 16, 16), (14, 18, 16, 16)], hc=10,
                 nose=19 if evl else 20, lip=22 if evl else 23, mbot=24)
    elif name == 'STFGOD0':
        m.update(kind='god', pain=0, eyes=[(5, 9, 14, 14), (14, 18, 14, 14)], hc=8,
                 nose=19, lip=23, mbot=24)
    elif name == 'STFDEAD0':
        m.update(kind='dead', pain=4, eyes=[(5, 9, 13, 13), (14, 18, 13, 13)], hc=9,
                 nose=20, lip=24, mbot=26)
    elif name.startswith('STFTL'):
        p = int(name[5])
        eyes = {0: [(2, 3, 14, 14), (10, 12, 15, 15)], 1: [(2, 3, 14, 14), (10, 12, 15, 15)],
                2: [(3, 5, 16, 16), (9, 12, 16, 16)], 3: [(5, 7, 17, 17), (10, 14, 17, 17)],
                4: [(5, 7, 17, 17), (10, 14, 17, 17)]}[p]
        m.update(kind='tl', pain=p, eyes=eyes, far=0, gaze=-1, hc=(9, 9, 10, 11, 11)[p],
                 nose=(19, 19, 20, 21, 21)[p], lip=(23, 23, 23, 24, 24)[p], mbot=(25, 25, 25, 26, 26)[p])
    elif name.startswith('STFTR'):
        p = int(name[5])
        eyes = {0: [(13, 15, 15, 15), (22, 23, 14, 14)], 1: [(13, 15, 15, 15), (22, 23, 14, 14)],
                2: [(14, 17, 16, 16), (21, 23, 16, 16)], 3: [(14, 18, 16, 16), (21, 23, 16, 16)],
                4: [(14, 18, 16, 16), (21, 23, 16, 16)]}[p]
        m.update(kind='tr', pain=p, eyes=eyes, far=1, gaze=1, hc=(9, 9, 10, 10, 10)[p],
                 nose=(19, 19, 20, 20, 20)[p], lip=(23, 23, 23, 23, 23)[p], mbot=(25, 25, 25, 25, 25)[p])
    else:
        raise KeyError(name)
    return m


# --------------------------------------------------------------------------------------
# Doomguy's frame, classified (from build-ceo-faces.py)
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

    def face_cols(self):
        """Columns that belong to the face (forehead) rather than temple/back of head."""
        (lx0, _, _, _), (rx0, rx1, _, _) = self.eyes[0], self.eyes[1]
        if self.kind == 'tl':
            return range(0, self.eyes[1][1] + 2)
        if self.kind == 'tr':
            return range(self.eyes[0][0] - 1, self.w)
        return range(lx0 - 1, rx1 + 2)

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
                        ear = self.meta['ear'] if not self.turn else self.hc
                        zone1 = y < ear
                        jaw = self.eye_bot + 6
                        zone2 = y < jaw and i in DARK_HAIR and (self.turn or y < brow + 1)
                    if zone1 or zone2:
                        c = 'hair'
                cls[y][x] = c
        self.cls = cls


# --------------------------------------------------------------------------------------
# Doomguy's frame placed in the face box (canvas coordinates, 33x30)
# --------------------------------------------------------------------------------------

def grid(w, h, v=None):
    return [[v] * w for _ in range(h)]


class CFrame:
    """Doomguy's frame moved into the face box for one character: optional columns
    dropped (Samwise's narrow head), rows dropped (Mario: a shorter face under a
    taller afro) or doubled (Samwise: a longer chin), a vertical shift, and every
    anchor converted to canvas coordinates. Mirrors Frame's interface so the eye /
    glasses code works on it unchanged."""

    def __init__(self, f: Frame, drop=(), droprows=(), duprows=(), dy: int = 0):
        self.name, self.kind, self.pal = f.name, f.kind, f.pal
        self.turn = f.turn
        self.w, self.h = W, H
        keep = [x for x in range(f.w) if x not in drop]
        # reference column keeps its own canvas position: midway between the eyes
        (lx0, _, _, _), (_, rx1, _, _) = f.eyes
        ref = (lx0 + rx1) // 2
        ox = (-f.left - 1 + ref) - sum(1 for x in keep if x < ref)
        oy = -f.top - 2 + dy
        self.ox, self.oy = ox, oy

        def X(lx):
            return ox + sum(1 for k in keep if k < lx)

        def Y(ly):
            return oy + ly - sum(1 for r in droprows if r < ly) + sum(1 for r in duprows if r < ly)
        self.X, self.Y = X, Y
        self.src, self.cls = grid(W, H), grid(W, H)
        for ly in range(f.h):
            if ly in droprows:
                continue
            for cy in (Y(ly), Y(ly) + 1) if ly in duprows else (Y(ly),):
                if not 0 <= cy < H:
                    continue
                for i, lx in enumerate(keep):
                    cx = ox + i
                    if 0 <= cx < W:
                        self.src[cy][cx] = f.src[ly][lx]
                        self.cls[cy][cx] = f.cls[ly][lx]
        m = dict(f.meta)
        m['eyes'] = [(X(x0), X(x1), Y(y0), Y(y1)) for x0, x1, y0, y1 in f.meta['eyes']]
        for k in ('hc', 'ear', 'nose', 'lip', 'mbot'):
            m[k] = Y(f.meta[k])
        # EYE_BAND_COLS is indexed by lump column: canvas x - band = lump x - shift
        m['band'] = m.get('shift', 0) + ox
        self.meta = m
        self.eyes = m['eyes']
        self.hc = m['hc']
        self.eye_top = min(e[2] for e in self.eyes)
        self.eye_bot = max(e[3] for e in self.eyes)
        # face centre (between the eyes) and the head's centre (its widest rows)
        self.cx = (self.eyes[0][0] + self.eyes[1][1]) / 2
        xs = [x for y in range(max(0, self.hc - 4), min(H, self.hc + 3)) for x in range(W)
              if self.src[y][x] is not None]
        self.hx = (min(xs) + max(xs)) / 2 if xs else self.cx
        rows = [y for y in range(H) if self.src[y][int(round(self.cx))] is not None]
        self.chin = max(rows) if rows else H - 1

    def face_cols(self):
        (lx0, _, _, _), (rx0, rx1, _, _) = self.eyes[0], self.eyes[1]
        if self.kind == 'tl':
            return range(0, self.eyes[1][1] + 2)
        if self.kind == 'tr':
            return range(self.eyes[0][0] - 1, self.w)
        return range(lx0 - 1, rx1 + 2)

    def in_eye_box(self, x, y, pad=0) -> bool:
        return any(x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad
                   for x0, x1, y0, y1 in self.eyes)


# --------------------------------------------------------------------------------------
# Styles
# --------------------------------------------------------------------------------------

class Ramp:
    """Tone 0 (light) .. 1 (dark) -> one of a hand-picked run of PLAYPAL indices."""

    def __init__(self, indices):
        self.table = list(indices)
        self.steps = len(self.table)

    def __call__(self, t: float) -> int:
        return self.table[max(0, min(self.steps - 1, int(round(t * (self.steps - 1)))))]


SKIN_POOL = sorted(set(R(0x30, 0x50)) | set(R(0x10, 0x18)))


class Style:
    def __init__(self, pal: Palette, cfg: dict):
        self.pal = pal
        self.cfg = cfg
        self.hair = Ramp(cfg['hair'])
        self.skin: dict[int, int] = {}
        lift, (tr, tg, tb) = cfg['skin_lift'], cfg['skin_tint']
        for i in sorted(FLESH | WARM):
            r, g, b = pal.rgb[i]
            r, g, b = r + (255 - r) * lift, g + (255 - g) * lift, b + (255 - b) * lift
            rgb = (min(255, r * tr), min(255, g * tg), min(255, b * tb))
            # Doomguy's orange cheek / lip pixels become plain skin too
            self.skin[i] = pal.nearest(rgb, SKIN_POOL if i in FLESH else sorted(FLESH))
        self.ramps = {k: Ramp(v) for k, v in cfg.get('ramps', {}).items()}

    def __getattr__(self, key):
        try:
            return self.cfg[key]
        except KeyError:
            raise AttributeError(key)


STYLE_CFG = {
    'mario': {
        # pale skin, a giant dark-brown curly afro, dark rounded glasses, a huge
        # curled handlebar mustache; charcoal suit, white collar, dark green bow tie
        'skin_lift': 0.30, 'skin_tint': (1.0, 0.97, 0.97),
        'hair': [0x88, 0x8A, 0x8B, 0x8C, 0x8D, 0x0D, 0x0E, 0x0F, 0xED, 0xEE, 0xEF, 0x01, 0x02],
        'ramps': {
            'stache': [0x90, 0x91, 0x93, 0x94, 0x95, 0x96, 0x97, 0xEE, 0xEF, 0x01, 0x02],
            'suit': [0xF9, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7],
            'bow': [0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F],
        },
        'collar': 0x51, 'collar_lo': 0x58,
        'brow': 0x01, 'brow_soft': 0x4D, 'frame': 0x00, 'frame_hi': 0x6B,
        'lip': 0x47, 'lip_corner': 0x45, 'lip_lo': 0x3A,
        'white': 0x55, 'white_lo': 0x59, 'iris': 0x96, 'pupil': 0x00,
        'red_white': 0x17, 'red_rim': 0x1F,
        'slim': 0.16, 'soften': 0.35, 'dy': 0, 'drop': {}, 'droprows': False,
    },
    'samwise': {
        # fair, slightly ruddy skin; huge feathered dirty-blond hair; long narrow face,
        # big ears, chin-strip goatee, blue-grey eyes; brown tweed, cream collar,
        # burgundy tie
        'skin_lift': 0.14, 'skin_tint': (1.0, 0.95, 0.95),
        'hair': [0x80, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0xEE],
        'ramps': {
            'tweed': [0x8A, 0x8C, 0x8D, 0x8E, 0x8F, 0x96, 0x97, 0xEE, 0xEF],
            'tie': [0x22, 0x24, 0x26, 0x28, 0x2A, 0x2C, 0x2E],
            'goatee': [0x95, 0x96, 0x97, 0xEE, 0x01],
        },
        'collar': 0xD1, 'collar_lo': 0x82,
        'brow': 0x95, 'brow_soft': 0x92, 'lash': 0x4E, 'white': 0x53, 'white_lo': 0x57,
        'iris': 0xC3, 'pupil': 0x00, 'red_white': 0x17, 'red_rim': 0x1F,
        'lip': 0x47, 'lip_corner': 0x45, 'lip_lo': 0x3A,
        'slim': 0.46, 'soften': 0.5, 'dy': -3, 'duprows': True, 'philtrum': 4,
        # lump columns removed per frame kind: Doomguy's ears and cheek edges (front
        # views); the back of the head (turned views, it is hair anyway)
        'drop': {'front': (0, 1, 22, 23), 'tr': (1, 3, 5)},
    },
}


def make_styles(pal: Palette) -> dict[str, Style]:
    return {k: Style(pal, v) for k, v in STYLE_CFG.items()}


def drop_rows(f: Frame, st: Style):
    """Mario: one forehead row (under the afro's low hairline) and one upper-lip row
    (under the mustache) go, so the afro gets more of the box above the face."""
    if not st.cfg.get('droprows'):
        return ()
    m = f.meta
    return (m['hc'] + 1, m['nose'] + 2)


def dup_rows(f: Frame, st: Style):
    """Samwise: a smooth chin row under the mouth is doubled - a longer face and chin."""
    if not st.cfg.get('duprows'):
        return ()
    return (min(f.h - 1, f.meta['mbot'] + 2),)


def drop_cols(f: Frame, st: Style):
    d = st.drop
    if not d:
        return ()
    if f.kind == 'tr':
        return d['tr']
    if f.kind == 'tl':
        return tuple(f.w - 1 - x for x in d['tr'])
    return d['front']


# --------------------------------------------------------------------------------------
# Face reshaping (from build-ceo-faces.py)
# --------------------------------------------------------------------------------------

def slim_rows(frame, src, cls, amount: float):
    """Narrow the lower face: compress each row's outer pixels toward the row centre,
    more strongly toward the chin. Rows above the cheekbones are untouched."""
    w, h = frame.w, frame.h
    y0 = frame.eye_bot + 2
    if frame.turn:
        amount *= 0.6
    s2, c2 = [r[:] for r in src], [r[:] for r in cls]
    for y in range(y0, h):
        # the face's own extent (not Doomguy's hair, which the character's hair replaces)
        xs = [x for x in range(w) if src[y][x] is not None and cls[y][x] != 'hair']
        if len(xs) < 6:
            continue
        lx, rx = xs[0], xs[-1]
        c = (lx + rx) / 2
        t = (y - y0) / max(1, frame.chin - y0)
        s = 1 - amount * (0.35 + 0.65 * min(1.0, t))
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


def soften(frame, src, cls, amount: float):
    """Pull the lower face's flesh tones toward their local average (a smoother face)."""
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


# --------------------------------------------------------------------------------------
# Expressions (from build-ceo-faces.py)
# --------------------------------------------------------------------------------------

def expression(frame) -> str:
    k, p = frame.kind, frame.meta['pain']
    if k in ('st', 'tl', 'tr'):
        return 'calm' if p <= 1 else 'worried'
    return {'ouch': 'shock', 'evl': 'grin', 'kill': 'fierce', 'god': 'god', 'dead': 'dead'}[k]


def bloodshot(frame) -> int:
    p = frame.meta['pain']
    return 0 if p <= 1 else 1 if p == 2 else 2


def put(out, x, y, v, protect=None):
    if 0 <= y < len(out) and 0 <= x < len(out[0]) and out[y][x] is not None:
        out[y][x] = v
        if protect is not None:
            protect[y][x] = True


def force(out, x, y, v, protect=None):
    """Like put, but also paints transparent pixels (features that stick out)."""
    if 0 <= y < len(out) and 0 <= x < len(out[0]):
        out[y][x] = v
        if protect is not None:
            protect[y][x] = True


def shift_gaze(line: str, gaze: int, lo: int, hi: int) -> str:
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


EYE_BAND_COLS = [0x4c, 0x4a, 0x47, 0x43, 0x3f, 0x3b, 0x38, 0x37, 0x39, 0x3b, 0x3d, 0x3d,
                 0x3d, 0x3d, 0x3b, 0x3a, 0x38, 0x38, 0x3a, 0x3d, 0x41, 0x46, 0x4a, 0x4c]
EYE_BAND_ROWS = {-4: 0, -3: 0, -2: -1, -1: 0, 0: 0, 1: 1, 2: 2}


def band_skin(st, x: int, dy: int, shift: int = 0, extra: int = 0) -> int:
    xi = max(0, min(len(EYE_BAND_COLS) - 1, x - shift))
    return st.skin[max(0x30, min(0x4F, EYE_BAND_COLS[xi] + EYE_BAND_ROWS.get(dy, 1) + extra))]


def local_skin(frame, src, x: int, y0: int) -> int:
    for y in list(range(y0 - 4, y0 - 7, -1)) + list(range(y0 + 2, y0 + 5)):
        if 0 <= y < frame.h and 0 <= x < frame.w:
            i = src[y][x]
            if i is not None and i in FLESH and frame.cls[y][x] == 'skin':
                return min(i, 0x45)
    return 0x3C


def repaint_band(frame, out, keep, protect, cols, dy_range, y0, skin_at):
    """Paint the eye band (Doomguy's brows, lids, squint) as plain skin, except pixels
    in `keep` (hair hanging over the brow). At pain 0-1 the cleared band is protected
    so Doomguy's pink under-eye flush isn't put back as 'blood'."""
    p = frame.meta['pain']
    for dy in dy_range:
        y = y0 + dy
        for x in cols:
            if not (0 <= x < frame.w and 0 <= y < frame.h) or out[y][x] is None:
                continue
            if keep[y][x]:
                continue
            out[y][x] = skin_at(x, dy)
            if p <= 1:
                protect[y][x] = True


def cocked_brow(frame, k: int) -> int:
    g = frame.meta['gaze']
    return int(frame.kind == 'st' and g != 0 and k == (1 if g > 0 else 0))


def feature_colour(st, ch: str, skin: int) -> int:
    key = {'B': 'brow', 'b': 'brow_soft', 'L': 'lash', 'W': 'white', 'w': 'white_lo', 'I': 'iris',
           'P': 'pupil', 'r': 'red_white', 'R': 'red_rim'}.get(ch)
    if key:
        return st.cfg[key]
    return {'g': 0xA3, 'G': 0xE1, 'y': 0xA4}.get(ch, skin)


# --------------------------------------------------------------------------------------
# Samwise's eyes: smug, half-lidded, blue-grey
# --------------------------------------------------------------------------------------

# screen-left eye, 6 columns x 7 rows (eye row - 4 .. eye row + 2); mirrored for the right
#   B/b brow dark/soft  L upper lid  W/w white lit/shaded  I iris  P pupil  k lid crease
SAMWISE_EYES = {
    'calm':    ['......', '.bBBb.', '......', '.LLLL.', '.wIPw.', '......', '......'],
    'worried': ['...bB.', '.BB...', '......', '.LLLL.', '.WIPW.', '......', '......'],
    'shock':   ['..BBb.', '.B....', '......', '.LLLL.', '.WWWW.', '.WIPW.', '......'],
    'grin':    ['......', '.bBBB.', '......', '......', '.LLLL.', '.kIPk.', '......'],
    'fierce':  ['......', '.Bb...', '...BB.', '.LLLL.', '.WIPW.', '......', '......'],
    'god':     ['......', '.bBBB.', '......', '.LLLL.', '.gGGg.', '.yggy.', '......'],
}


def samwise_eyes(cf: CFrame, src, out, st: Style, protect, keep):
    mode = expression(cf)
    if mode == 'dead':
        return
    if cf.turn:
        samwise_turn(cf, src, out, st, protect, keep, mode)
        return
    gaze, band, y0 = cf.meta['gaze'], cf.meta['band'], cf.eye_top
    stamp = SAMWISE_EYES[mode]
    if mode != 'god':
        stamp = redden(stamp, bloodshot(cf), 1, 4)
    for k, (x0, x1, _, _) in enumerate(cf.eyes):
        e0 = x0 + 1 if k == 0 else x0
        rows = [shift_gaze(r if k == 0 else r[::-1], gaze, 1, 4) for r in stamp]
        cols = range(min(x0 - 1, e0 - 1), max(x1 + 1, e0 + 4) + 1)
        repaint_band(cf, out, keep, protect, cols, range(-4, 3), y0,
                     lambda x, dy: band_skin(st, x, dy, band))
        # smug: the screen-right brow sits a pixel higher on the calm faces
        cock = cocked_brow(cf, k) or int(mode == 'calm' and k == 1 and cf.meta['gaze'] == 0)
        for r, line in enumerate(rows):
            dy = r - 4
            for c, ch in enumerate(line):
                x, y = e0 - 1 + c, y0 + dy
                if ch == '.' or not (0 <= x < cf.w):
                    continue
                if ch in 'Bb':
                    y -= cock
                    if keep[y][x]:
                        continue
                put(out, x, y, feature_colour(st, ch, band_skin(st, x, dy, band, 2)), protect)


def samwise_turn(cf: CFrame, src, out, st: Style, protect, keep, mode):
    level = bloodshot(cf)
    gaze = cf.meta['gaze']
    for k, (x0, x1, y0, _) in enumerate(cf.eyes):
        far = cf.meta['far'] == k
        n = min(x1 - x0 + 1, 2 if far else 4)
        if gaze > 0:
            x0 = x1 - n + 1
        ex = list(range(x0, x0 + n))
        repaint_band(cf, out, keep, protect, range(ex[0] - 1, ex[-1] + 2), range(-3, 2), y0,
                     lambda x, dy: st.skin[max(0x30, min(0x4F, local_skin(cf, src, x, y0)
                                                     + EYE_BAND_ROWS.get(dy, 1)))])
        top = (['P', 'I'] + ['w'] * (n - 2)) if n > 2 else ['I', 'w']
        if gaze > 0:
            top = top[::-1]
        outer = 0 if k == 0 else n - 1
        if level >= 2 and top[outer] == 'w':
            top[outer] = 'r'
        for i, x in enumerate(ex):
            put(out, x, y0 - 1, st.lash, protect)
            put(out, x, y0, feature_colour(st, top[i], 0), protect)
            if level and i == outer:
                put(out, x, y0 + 1, st.red_rim if level >= 2 else st.red_white, protect)
        bx = list(range(ex[0] - (1 if (k == 0 and not far) else 0), ex[-1] + 1 + (1 if (k == 1 and not far) else 0)))
        inner = bx[len(bx) // 2:] if k == 0 else bx[:len(bx) - len(bx) // 2]
        for x in bx:
            dy = -3
            if mode == 'worried' and x in inner:
                dy = -4
            if 0 <= y0 + dy < cf.h and 0 <= x < cf.w and not keep[y0 + dy][x]:
                put(out, x, y0 + dy, st.brow if x in inner or mode == 'worried' else st.brow_soft, protect)


# --------------------------------------------------------------------------------------
# Mario's glasses and brows (Dario's glasses from build-ceo-faces.py, heavier)
# --------------------------------------------------------------------------------------

MARIO_BROWS = {
    # rows frame-top - 3 .. - 1 over each lens (screen-left eye; 5 lens columns)
    'calm':    ['...BB', 'BBB..', '.....'],
    'worried': ['..BBB', 'BB...', '.....'],
    'shock':   ['.BBBB', 'B....', '.....'],
    'grin':    ['.....', 'BBBBB', '.....'],
    'fierce':  ['.....', 'BBB..', '...BB'],
    'god':     ['.....', 'BBBBb', '.....'],
    'dead':    ['.....', '.....', '.....'],
}
MARIO_LENS = {
    'calm':    ['.WPW.', '.....'],
    'worried': ['.WPW.', '.....'],
    'shock':   ['.WWW.', '.WPW.', '.....'],
    'grin':    ['.WPW.', '.kkk.'],
    'fierce':  ['.WPW.', '.....'],
}


def fit(line: str, n: int, k: int) -> str:
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


def mario_glasses(cf: CFrame, src, out, st: Style, protect, keep):
    w, h = cf.w, cf.h
    mode = expression(cf)
    gaze, band = cf.meta['gaze'], cf.meta['band']
    level = bloodshot(cf) if mode not in ('god', 'dead') else 0
    boxes = []
    for x0, x1, y0, _ in cf.eyes:
        boxes.append([x0 - 1, x1 + 1, y0 - 1, y0 + (3 if mode == 'shock' else 2)])
    if mode == 'dead':
        boxes[1][2] += 1
        boxes[1][3] += 1
    if cf.turn:
        a, b = boxes
        if b[0] - a[1] < 2:
            if cf.meta['far'] == 0:
                a[1] = b[0] - 2
            else:
                b[0] = a[1] + 2
    for k, (fx0, fx1, fy0, fy1) in enumerate(boxes):
        y0 = fy0 + 1
        ix = list(range(fx0 + 1, fx1))
        n = len(ix)
        if cf.turn:
            def skin_at(x, dy, y0=y0):
                return st.skin[max(0x30, min(0x4F, local_skin(cf, src, x, y0) + EYE_BAND_ROWS.get(dy, 1) - 1))]
        else:
            def skin_at(x, dy):
                return band_skin(st, x, dy, band, -1)
        if mode in ('god', 'dead'):
            for y in range(fy0 + 1, fy1):
                for x in ix:
                    if 0 <= x < w and 0 <= y < h and out[y][x] is not None and mode == 'god':
                        protect[y][x] = True
        else:
            repaint_band(cf, out, keep, protect, range(fx0, fx1 + 1), range(-4, fy1 - y0 + 1), y0, skin_at)
            rows = []
            for line in MARIO_LENS[mode]:
                line = line if k == 0 else line[::-1]
                row = fit(line, n, k)
                if n <= 2 and 'P' in line and 'P' not in row:
                    row = ('PW' if gaze < 0 else 'WP')[:n]
                rows.append(shift_gaze(row, gaze, 0, len(row) - 1))
            eye_cols = sorted({i for r in rows for i, c in enumerate(r) if c in 'WP'})
            if level and eye_cols:
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
        for y in range(fy0, fy1 + 1):
            for x in range(fx0, fx1 + 1):
                if y in (fy0, fy1) or x in (fx0, fx1):
                    force(out, x, y, st.frame, protect)
        put(out, fx0 + 1, fy0, st.frame_hi, protect)
        for r, line in enumerate(MARIO_BROWS[mode]):
            y = fy0 - 3 + r - cocked_brow(cf, k)
            row = fit(line if k == 0 else line[::-1], n, k)
            for i, ch in enumerate(row):
                x = ix[i]
                if ch in 'Bb' and 0 <= y < h and 0 <= x < w:
                    put(out, x, y, st.brow if ch == 'B' else st.brow_soft, protect)
    (a0, a1, ay0, ay1), (b0, b1, by0, by1) = boxes
    yb = max(ay0, by0) + 1
    for x in range(a1 + 1, b0):
        force(out, x, yb, st.frame, protect)
    # the worried furrow between the brows
    if mode in ('calm', 'worried', 'shock') and not cf.turn:
        fx = (a1 + b0) // 2
        put(out, fx, min(ay0, by0) - 2, st.skin[0x46], protect)
    if cf.kind == 'tl':
        for x in range(b1 + 1, b1 + 4):
            put(out, x, by0 + 1, st.frame, protect)
    elif cf.kind == 'tr':
        for x in range(a0 - 3, a0):
            put(out, x, ay0 + 1, st.frame, protect)
    else:
        put(out, a0 - 1, ay0 + 1, st.frame, protect)
        put(out, b1 + 1, by0 + 1, st.frame, protect)
    return boxes


# --------------------------------------------------------------------------------------
# Hair
# --------------------------------------------------------------------------------------

def lerp1(keys, t):
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return keys[-1][1]


def near_face(face, x, y, d=1):
    return any(0 <= x + dx < W and 0 <= y + dy < H and face[y + dy][x + dx] is not None
               for dx in range(-d, d + 1) for dy in range(-d, d + 1))


def rim(mask, x, y):
    """+1 on the shadowed (right/bottom) silhouette edge, -1 on the lit edge, else 0."""
    def inside(a, b):
        return 0 <= a < W and 0 <= b < H and mask[b][a]
    if not inside(x + 1, y) and x + 1 < W or not inside(x, y + 1) and y + 1 < H:
        return 1
    if not inside(x - 1, y) and x > 0 or not inside(x, y - 1) and y > 0:
        return -1
    return 0


# ---- Mario: the afro as a cloud of lit curl clumps --------------------------------

AFRO_ROWS = ((2.4, 6.5), (6.3, 13.0), (10.2, 16.5), (14.1, 16.0), (17.6, 14.5))


def mario_clumps(cf: CFrame):
    """(x, y, r, front) curl clumps. Back clumps make a round cloud that fills the box
    edge to edge behind the face; front clumps are a low curly hairline over the
    forehead and curls over the temples and ears."""
    hx = cf.hx + {'tr': -1.0, 'tl': 1.0}.get(cf.kind, 0.0)   # more hair behind a turned head
    clumps = []
    bottom = cf.meta['nose'] + 2
    for j, (y, reach) in enumerate(AFRO_ROWS):
        if y > bottom:
            break
        for i in range(-4, 5):
            x = hx + i * 5.0 + (2.5 if j % 2 else 0.0)
            if abs(x - hx) > reach:
                continue
            x += (noise(i, j, 41) - 0.5) * 1.0
            yy = y + (noise(i, j, 43) - 0.5) * 0.8
            clumps.append((x, yy, 3.1 + noise(i, j, 47) * 0.5, False))
    # front: the hairline, curls dipping onto the forehead
    (lx0, _, _, _), (_, rx1, _, _) = cf.eyes
    hl = cf.hc - 1.4
    k, x = 0, lx0 - 1.5
    while x <= rx1 + 1.6:
        clumps.append((x, hl + (0.7 if k % 2 else 0.0), 2.0 + 0.4 * noise(k, 1, 51), True))
        x += 3.0
        k += 1
    # front: curls over the temples and ears, down to the cheekbones
    row = min(H - 1, cf.eye_top)
    xs = [x for x in range(W) if cf.src[row][x] is not None and cf.cls[row][x] != 'hair']
    if xs:
        for side, ex in ((-1, xs[0]), (1, xs[-1])):
            if cf.kind == 'tr' and side > 0 or cf.kind == 'tl' and side < 0:
                continue                                  # the face side of a turned head
            for j, dy in enumerate((1.2, 4.0, 6.8)):
                y = hl + dy
                if y > cf.meta['nose'] - 1:
                    break
                clumps.append((ex + side * 0.3, y, 2.3 + 0.3 * noise(j, side, 53), True))
    return clumps


def paint_clumps(clumps, mask, tone, cut=None):
    """Rasterise clumps bottom-up (upper clumps overlap lower ones): each has a lit
    crown up-left, a specular tip and a dark rim down-right, so the cloud reads as
    separate curls."""
    order = sorted(range(len(clumps)), key=lambda i: (-clumps[i][1], clumps[i][0]))
    for idx in order:
        bx, by, r, _ = clumps[idx]
        for y in range(int(math.floor(by - r)), int(math.ceil(by + r)) + 1):
            for x in range(int(math.floor(bx - r)), int(math.ceil(bx + r)) + 1):
                if not (0 <= x < W and 0 <= y < H) or (cut is not None and cut[y][x]):
                    continue
                dx, dy = (x - bx) / r, (y - by) / r
                d2 = dx * dx + dy * dy
                if d2 > 1.0:
                    continue
                lit = (dx * 0.6 + dy * 0.8)              # -1 lit .. +1 shadowed
                t = 0.30 * lit
                if d2 > 0.55:
                    t += 0.10 + 0.22 * max(0.0, lit)     # dark rim on the shadow side
                if d2 < 0.35 and -0.75 < lit < -0.1:
                    t -= 0.18                             # the shine on the curl
                t += (noise(x, y, 59 + idx) - 0.5) * 0.08
                mask[y][x] = True
                tone[y][x] = t


def mario_hair(cf: CFrame, face):
    """New Mario: bare dome and two wiry side tufts, not a curly afro."""
    back, btone = grid(W, H, False), grid(W, H, 0.0)
    front, ftone = grid(W, H, False), grid(W, H, 0.0)
    cx=cf.cx
    eye=min(e[2] for e in cf.eyes)
    top=max(3,eye-10)
    # A rounded scalp, attached to the original moving/turned face anchors.
    for y in range(top,eye):
        u=(y-top)/max(1,eye-top)
        half=5+5*math.sqrt(max(0,1-(1-u)**2))
        for x in range(W):
            if abs(x-cx)<=half and face[y][x] is None:
                face[y][x]=0x33+min(12,max(0,int((x-cx+half)*.45+(y-top)*.18)))
    # Tuft silhouettes intentionally leave the shiny middle crown completely bare.
    for side in (-1,1):
        base=cx+side*9
        for strand in range(5):
            tip=base+side*(strand*.8+1)
            high=max(0,top-2-(strand%3))
            for y in range(high,top+5):
                u=(y-high)/max(1,top+4-high)
                x=round(tip*(1-u)+base*u)
                for xx in (x,x+side):
                    if 0<=xx<W:
                        back[y][xx]=True;btone[y][xx]=.58+(strand%2)*.12
    return back,btone,front,ftone


# ---- Samwise: a centre-parted, feathered, wind-swept mane ----------------------------

# half-widths of the underlayer per row (canvas rows; the box is 16.5 either side)
MANE_LEFT = ((0, 7.5), (1, 11.0), (2, 13.5), (3, 15.0), (5, 17.0), (18, 17.0), (21, 16.0),
             (24, 14.5), (26, 12.0), (27, 10.0))
MANE_RIGHT = ((0, 8.5), (1, 12.5), (2, 15.0), (3, 16.5), (5, 17.5), (18, 17.0), (21, 16.0),
              (24, 15.0), (26, 12.5), (27, 10.5))
NECK = 5.5          # half-width kept clear of hair under the jaw

# Feathered locks for the screen-left side, mirrored for the right: quadratic Beziers
# (root, control, tip) relative to (head centre, hairline row), a width, and whether
# the lock lies in front of the face. Listed back to front.
SAM_LOCKS = (
    # curtains falling behind the ears to the shoulders
    ((-5.0, 6.0), (-10.5, 12.0), (-8.5, 21.0), 4.4, False),
    ((-6.0, 4.0), (-15.0, 8.0), (-12.5, 21.0), 5.0, False),
    ((-8.0, 1.0), (-18.0, 6.0), (-16.5, 18.0), 4.5, False),
    # wings swept out to the box edge
    ((-4.0, -1.0), (-13.0, -1.0), (-18.5, 10.0), 4.6, False),
    ((-3.0, -3.0), (-11.0, -6.0), (-18.5, 3.0), 4.2, False),
    # the crown, brushed back from the part
    ((-0.5, -5.5), (-6.0, -8.0), (-14.0, -4.5), 3.8, False),
    ((-1.0, -3.5), (-8.0, -6.0), (-16.0, -1.0), 3.4, False),
    # curtain bangs over the forehead corner and the temple
    ((-0.6, -2.0), (-4.5, -1.5), (-7.5, 5.0), 2.8, True),
)
WIND = 1.0          # the right side flares a pixel higher (wind-swept)


def samwise_mask(cf: CFrame, hx: float):
    lip = cf.meta['lip']
    mask = grid(W, H, False)
    last = max(k for k, _ in MANE_LEFT)
    for y in range(min(H, last + 1)):
        lo = hx - lerp1(MANE_LEFT, y)
        hi = hx + lerp1(MANE_RIGHT, y)
        for x in range(W):
            if lo <= x + 0.5 <= hi + 1:
                if y > lip - 1 and abs(x + 0.5 - (cf.cx + 0.5)) < NECK + 0.5 * (y - lip):
                    continue                              # no hair under the jaw
                mask[y][x] = True
    return mask


def bezier(p0, p1, p2, n=48):
    pts = []
    for i in range(n + 1):
        u = i / n
        a, b, c = (1 - u) ** 2, 2 * (1 - u) * u, u * u
        pts.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], u))
    return pts


def paint_lock(p0, p1, p2, width, mask, tone, light=(-0.6, -0.8), cut=None, seed=0):
    """One feathered lock: wide at the root, pointed at the tip, lit along its upper
    edge, a dark parting line along it, darker at the root and sun-bleached at the tip."""
    pts = bezier(p0, p1, p2)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys) - width)), min(H, int(max(ys) + width) + 1)):
        for x in range(max(0, int(min(xs) - width)), min(W, int(max(xs) + width) + 1)):
            if cut is not None and cut[y][x]:
                continue
            cx, cy = x + 0.5, y + 0.5
            best, bi = 1e9, 0
            for i, (qx, qy, _) in enumerate(pts):
                d = (qx - cx) ** 2 + (qy - cy) ** 2
                if d < best:
                    best, bi = d, i
            qx, qy, u = pts[bi]
            a = pts[max(0, bi - 1)]
            b = pts[min(len(pts) - 1, bi + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            tl = math.hypot(tx, ty) or 1.0
            nx, ny = -ty / tl, tx / tl
            if nx * light[0] + ny * light[1] < 0:
                nx, ny = -nx, -ny                        # n points toward the light
            half = width / 2 * min(1.0, 0.55 + 2.0 * u) * (1.0 - 0.85 * u ** 2.2)
            dist = math.sqrt(best)
            if dist > half + 0.15 or half < 0.35:
                continue
            if bi in (0, len(pts) - 1) and dist > 0.75:
                continue                                 # nothing beyond the ends
            dn = ((cx - qx) * nx + (cy - qy) * ny) / max(0.5, half)   # +1 lit edge .. -1
            t = 0.34 - 0.20 * dn
            t += 0.16 * (1 - min(1.0, u * 2.5)) ** 2     # root in shadow
            t -= 0.12 * max(0.0, u - 0.55) / 0.45        # bleached tip
            if abs(dn + 0.2) < 0.2 and 0.15 < u < 0.85:
                t += 0.10                                # the line between two strands
            if 0.35 < dn < 0.85 and 0.2 < u < 0.7:
                t -= 0.10                                # shine
            t += (noise(x, y, seed) - 0.5) * 0.06
            mask[y][x] = True
            tone[y][x] = t


def samwise_hair(cf: CFrame, face):
    hx = cf.hx + {'tr': -1.0, 'tl': 1.0}.get(cf.kind, 0.0)
    hl = cf.hc
    under = samwise_mask(cf, hx)
    back, btone = grid(W, H, False), grid(W, H, 0.0)
    front, ftone = grid(W, H, False), grid(W, H, 0.0)
    for y in range(H):
        for x in range(W):
            if under[y][x]:
                back[y][x] = True
                btone[y][x] = 0.50 + 0.005 * y + (noise(x, y, 63) - 0.5) * 0.1
    cut = grid(W, H, False)                               # bangs stay off the eyes/brows
    for x0, x1, y0, y1 in cf.eyes:
        for y in range(y0 - 3, y1 + 3):
            for x in range(x0 - 1, x1 + 2):
                if 0 <= x < W and 0 <= y < H:
                    cut[y][x] = True
    for k, (p0, p1, p2, width, is_front) in enumerate(SAM_LOCKS):
        for side in (-1, 1):
            if is_front and cf.turn and side == (1 if cf.kind == 'tr' else -1):
                continue                                  # no bang over the turned-away side
            lift = -WIND if side > 0 else 0.0
            pts = [(hx + side * px, hl + py + (lift * max(0.0, -px) / 18.0 if side > 0 else 0.0))
                   for px, py in (p0, p1, p2)]
            if is_front:
                paint_lock(*pts, width, front, ftone, cut=cut, seed=70 + k * 2 + (side > 0))
                continue
            # a slimmer lock layered just under each one fills the mane
            ox, oy = side * (noise(k, side, 75) - 0.5) * 2.0, 1.4
            under_pts = [(pts[0][0], pts[0][1] + oy * 0.5), (pts[1][0] + ox, pts[1][1] + oy),
                         (pts[2][0] + ox, pts[2][1] + oy)]
            paint_lock(*under_pts, width - 0.6, back, btone, seed=90 + k * 2 + (side > 0))
            paint_lock(*pts, width, back, btone, seed=70 + k * 2 + (side > 0))
    for y in range(H):
        for x in range(W):
            g = 0.022 * (y - hl) + 0.008 * (x - hx)      # lit crown, curtains in shadow
            if back[y][x]:
                btone[y][x] += g + (0.06 if near_face(face, x, y) else 0.0)
            if front[y][x]:
                ftone[y][x] += g - 0.04
                if face[y][x] is None:
                    front[y][x] = False                   # bangs only over the face
    return back, btone, front, ftone


# --------------------------------------------------------------------------------------
# Mouth, mustache, goatee, ears
# --------------------------------------------------------------------------------------

# The handlebar: screen-left half, 16 columns (0 = outer tip, 15 = beside the centre),
# rows relative to the first row under the nostrils. H highlight, M body, D underside.
STACHE = {
    -5: '.HHM............',
    -4: 'HooDM...........',
    -3: 'HoM.............',
    -2: 'MHHH............',
    -1: 'DMMMMHHHHHH.....',
    0:  '.DDDMMMMMMMHHHHH',
    1:  '....DDDDDMMMMMMM',
    2:  '.........DDMMMMM',
    3:  '...........DDDDD',
}
# dead: the curls have come undone and the arms droop
STACHE_DEAD = {
    0:  '........HHHHHHHH',
    1:  '....HHHHMMMMMMMM',
    2:  '..HMMMMMMMMMMMMM',
    3:  '.MDDDDDDDDDMMMMM',
    4:  'MD.........DDDDD',
    5:  'M...............',
    6:  'D...............',
}


def mario_stache(cf: CFrame, out, st: Style, protect, skin=None):
    """An enormous curled handlebar mustache under the nose, wider than the face; on a
    turned head the far arm is foreshortened; undone and drooping when dead."""
    ramp = st.ramps['stache']
    m0 = cf.meta['nose'] + 1
    tpl = STACHE_DEAD if cf.kind == 'dead' else STACHE
    lowest = cf.meta['lip'] - 1 - m0 if cf.kind in ('ouch', 'evl', 'kill') else 99
    far = {'tr': 1, 'tl': -1}.get(cf.kind, 0)
    left = math.floor(cf.cx + 0.5) - 1          # rightmost column of the left half
    drawn, holes = set(), set()
    for side in (-1, 1):
        cols = [c for c in range(16) if c != 7]           # 15 wide: the curls clear the box edge
        if far == side:
            cols = [c for c in cols if c not in (5, 6, 8, 9, 10, 11)]      # foreshortened arm
        n = len(cols)
        for row, line in tpl.items():
            if row > lowest and row > 1:
                continue
            for j, c in enumerate(cols):
                ch = line[c]
                if ch == '.':
                    continue
                off = n - 1 - j                   # 0 beside the centre .. n-1 the tip
                x = left - off if side < 0 else left + 1 + off
                y = m0 + row
                if ch == 'o':                     # the hole in the middle of a curl
                    force(out, x, y, ramp.table[-2], protect)
                    holes.add((x, y))
                    continue
                t = {'H': 0.05, 'M': 0.42, 'D': 0.80}[ch]
                t += (noise(x, y, 71) - 0.5) * 0.10 + (0.08 if side > 0 else 0.0)
                force(out, x, y, ramp(clamp(t)), protect)
                drawn.add((x, y))
    # a dark outline where the mustache crosses hair or the empty box, so the curls
    # read against the afro
    for x, y in sorted(drawn):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ax, ay = x + dx, y + dy
            if (ax, ay) in drawn or (ax, ay) in holes or not (0 <= ax < W and 0 <= ay < H):
                continue
            if skin is not None and skin[ay][ax]:
                continue
            force(out, ax, ay, 0x00 if out[ay][ax] is None else ramp.table[-1])


def clear_mouth(cf: CFrame, src, out, st: Style):
    """Doomguy's orange calm lips become plain skin (rows lip and lip + 1)."""
    m = cf.meta['lip']
    for y in (m, m + 1):
        for x in range(W):
            if 0 <= y < H and src[y][x] is not None and src[y][x] in WARM and cf.cls[y][x] == 'warm':
                if abs(x - cf.cx) < 6:
                    out[y][x] = st.skin[0x3D if y == m else 0x3A]


def mario_mouth(cf: CFrame, src, out, st: Style, protect):
    """Calm faces: a small worried frown under the mustache."""
    if not (cf.kind in ('st', 'god') and cf.meta['pain'] <= 1):
        return
    clear_mouth(cf, src, out, st)
    m = cf.meta['lip'] + 1
    cx = cf.cx
    a, b = int(math.floor(cx - 0.5)), int(math.ceil(cx + 0.5))
    for x in range(a, b + 1):
        put(out, x, m, st.lip, protect)
    put(out, a - 1, m + 1, st.lip_corner, protect)
    put(out, b + 1, m + 1, st.lip_corner, protect)


def samwise_mouth(cf: CFrame, src, out, st: Style, protect):
    """Calm faces: a thin closed smug half smile - a flat lip line whose screen-right
    end climbs into a dimpled corner."""
    if cf.meta['pain'] > 1 or cf.kind not in ('st', 'god', 'tl', 'tr'):
        return
    clear_mouth(cf, src, out, st)
    if cf.turn:
        return
    m = cf.meta['lip']
    c = int(math.floor(cf.cx + 0.5))
    a, b = c - 3, c + 1
    for x in range(a, b + 1):
        put(out, x, m, st.lip, protect)
    put(out, b + 1, m - 1, st.lip, protect)              # the corner climbs ...
    put(out, b + 2, m - 1, st.lip_corner, protect)       # ... into a smug dimple
    put(out, b + 1, m, st.skin[0x40], protect)
    put(out, a - 1, m, st.skin[0x40], protect)           # the other corner stays flat
    for x in range(a, b):
        put(out, x, m + 1, st.lip_lo, protect)           # lit lower lip


def mouth_x(cf: CFrame, src, cls) -> float:
    """Centre column of the mouth as drawn (teeth, lips, open mouth), else the face
    centre; on a turned head the mouth sits off the eye midline."""
    xs = [x for y in range(cf.meta['lip'], cf.meta['mbot'] + 1) if 0 <= y < H
          for x in range(W) if src[y][x] is not None and abs(x - cf.cx) < 7
          and (cls[y][x] in ('eye', 'warm') or src[y][x] in (0x00, 0x22, 0x25, 0x2A))]
    return (min(xs) + max(xs)) / 2 if xs else cf.cx


def samwise_goatee(cf: CFrame, out, st: Style, protect, mx: float):
    """A thin chin strip from under the lower lip to past the chin, pointed."""
    ramp = st.ramps['goatee']
    x0 = int(math.floor(mx + 0.5))
    top = cf.meta['mbot'] + 1
    bot = min(H - 1, cf.chin + 2)
    for y in range(top, bot + 1):
        t = 0.25 + 0.6 * (y - top) / max(1, bot - top)
        force(out, x0, y, ramp(clamp(t)), protect)
        if y < top + 2:
            force(out, x0 - 1, y, ramp(clamp(t + 0.2)), protect)


def samwise_ears(cf: CFrame, out, st: Style, protect, face, back):
    """Big ears standing out of the hair (front views), brow to nose: a lit rim, a
    darker bowl and a shadowed crease where they meet the head."""
    if cf.turn or cf.kind == 'dead':
        return
    y0 = cf.eye_top - 2
    row = cf.eye_top + 2
    xs = [x for x in range(W) if face[row][x] is not None]
    if not xs:
        return
    shape = ['.E.', 'Eek', 'Eek', 'Eek', '.Ek', '.E.']           # screen-left ear
    tones = {-1: {'E': 0x37, 'e': 0x40, 'k': 0x47}, 1: {'E': 0x3D, 'e': 0x44, 'k': 0x49}}
    for side, edge in ((-1, xs[0]), (1, xs[-1])):
        for r, line in enumerate(shape):
            for c, ch in enumerate(line):
                if ch == '.':
                    continue
                x = edge - 3 + c if side < 0 else edge + 3 - c
                force(out, x, y0 + r, st.skin[tones[side][ch]], protect)
        for r in range(1, 6):                            # their shadow on the hair
            x = edge - 4 if side < 0 else edge + 4
            y = y0 + r + 1
            if 0 <= x < W and 0 <= y < H and back[y][x] and face[y][x] is None:
                out[y][x] = st.hair(0.95)


# --------------------------------------------------------------------------------------
# Clothes along the bottom edge
# --------------------------------------------------------------------------------------

def clothes(cf: CFrame, who: str, st: Style):
    """Shoulders, collar and tie / bow tie in the bottom rows: a layer of (index | None)."""
    layer = grid(W, H)
    cx = cf.hx
    if who == 'samwise':
        # a neck in the shadow of the jaw, between the curtains of hair
        lip = cf.meta['lip']
        for y in range(lip - 1, H):
            for x in range(W):
                d = x + 0.5 - (cf.cx + 0.5)
                if abs(d) < NECK + 0.5 * (y - lip):
                    layer[y][x] = st.skin[0x44 if d < 0 else 0x47]
    for y in range(H):
        for x in range(W):
            dx = abs(x + 0.5 - (cx + 0.5))
            if y < 23.0 + max(0.0, 12.0 - dx) * 0.5:
                continue
            t = 0.25 + 0.06 * (y - 24) + (0.30 if x + 0.5 > cx + 0.5 else 0.0)
            if who == 'mario':
                t += (noise(x, y, 81) - 0.5) * 0.15
                layer[y][x] = st.ramps['suit'](clamp(t))
            else:
                hb = (x + (y if (x // 2) % 2 else -y)) % 3 == 0       # herringbone
                t += (0.22 if hb else 0.0) + (noise(x, y, 83) - 0.5) * 0.08
                layer[y][x] = st.ramps['tweed'](clamp(t))
    c = int(math.floor(cf.cx + 0.5))                    # the column right of the centre line
    if who == 'mario':
        shirt = {26: '..WWWW..', 27: '.WWWWWW.', 28: '.WWWWWW.', 29: 'WWWWWWWW'}
        bow = {} # Open white shirt, no bow tie in the revised reference.
        for y, line in shirt.items():
            for i, ch in enumerate(line):
                if ch == 'W':
                    layer[y][c - 4 + i] = st.collar if i < 4 else st.collar_lo
        for y, line in bow.items():
            for i, ch in enumerate(line):
                if ch == '.':
                    continue
                t = 0.55 if ch == 'K' else 0.10 + 0.12 * (y - 27) + (0.25 if i > 3 else 0.0) + 0.06 * abs(i - 3.5)
                layer[y][c - 4 + i] = st.ramps['bow'](clamp(t))
    else:
        shirt = {25: '...CC...', 26: '..CCCC..', 27: '.CC..CC.', 28: '.C....C.', 29: 'C......C'}
        tie = {26: '...KK...', 27: '...KK...', 28: '..TTTT..', 29: '..TTTT..'}
        for y, line in shirt.items():
            for i, ch in enumerate(line):
                if ch == 'C':
                    layer[y][c - 4 + i] = st.collar if i < 4 else st.collar_lo
        for y, line in tie.items():
            for i, ch in enumerate(line):
                if ch == '.':
                    continue
                t = (0.15 if ch == 'K' else 0.35) + (0.3 if i > 3 else 0.0) + 0.08 * (y - 26)
                layer[y][c - 4 + i] = st.ramps['tie'](clamp(t))
    return layer


# --------------------------------------------------------------------------------------
# Building a frame
# --------------------------------------------------------------------------------------

def build(f: Frame, who: str, st: Style) -> list[list[int | None]]:
    cf = CFrame(f, drop=drop_cols(f, st), droprows=drop_rows(f, st), duprows=dup_rows(f, st), dy=st.dy)
    src, cls = slim_rows(cf, cf.src, cf.cls, st.slim)
    src = soften(cf, src, cls, st.soften)
    cf.cls = cls
    if st.cfg.get('philtrum') and not cf.turn:
        # a too-perfect face: Doomguy's heavy shadow under the nose fades, so the smirk
        # below it is the only line there
        y = cf.meta['nose'] + 1
        for x in range(W):
            i = src[y][x] if 0 <= y < H else None
            if i is not None and i in FLESH and cls[y][x] == 'skin' and abs(x - cf.cx) <= 3.5:
                src[y][x] = max(0x30, i - st.philtrum)
    # the face layer: Doomguy minus his hair, recoloured
    face = grid(W, H)
    for y in range(H):
        for x in range(W):
            i = src[y][x]
            if i is None or cls[y][x] == 'hair':
                continue
            if cls[y][x] in ('skin', 'warm'):
                i = st.skin.get(i, i)
            elif cls[y][x] == 'blood' and cf.meta['pain'] <= 1 and i < 0x1C:
                i = st.skin[0x3B]                         # healthy: the pink flush is skin
            face[y][x] = i

    if who == 'mario':
        back, btone, front, ftone = mario_hair(cf, face)
    else:
        back, btone, front, ftone = samwise_hair(cf, face)

    # compose: clothes, back hair, face, front hair
    out = clothes(cf, who, st)
    for y in range(H):
        for x in range(W):
            if back[y][x]:
                out[y][x] = st.hair(clamp(btone[y][x]))
            if face[y][x] is not None:
                out[y][x] = face[y][x]
            if front[y][x]:
                out[y][x] = st.hair(clamp(ftone[y][x]))
    keep = [[front[y][x] for x in range(W)] for y in range(H)]

    protect = grid(W, H, False)
    if who == 'mario':
        mario_glasses(cf, src, out, st, protect, keep)
        mario_mouth(cf, src, out, st, protect)
        # Revised Mario is clean-shaven; retain the expressive Doom mouth.
    else:
        samwise_ears(cf, out, st, protect, face, back)
        samwise_eyes(cf, src, out, st, protect, keep)
        samwise_mouth(cf, src, out, st, protect)
        samwise_goatee(cf, out, st, protect, mouth_x(cf, src, cls))

    # Doomguy's own blood back on top, so the pain escalation matches the original
    # (on the healthy faces his light-pink under-eye flush is just skin)
    healthy = cf.meta['pain'] <= 1
    for y in range(H):
        for x in range(W):
            if cls[y][x] == 'blood' and not protect[y][x]:
                if healthy and src[y][x] < 0x1C:
                    continue
                out[y][x] = src[y][x]
    return out


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


def verify(built, pal: Palette):
    """Output contract: the face-box size, binary alpha, every opaque pixel PLAYPAL."""
    allowed = set(pal.rgb)
    for who in PEOPLE:
        for n in LUMPS:
            im = built[who][n]
            if im.size != (W, H):
                raise SystemExit(f'{who}/{n}: size {im.size} != {(W, H)}')
            for r, g, b, a in im.getdata():
                if a not in (0, 255):
                    raise SystemExit(f'{who}/{n}: partial alpha {a}')
                if a and (r, g, b) not in allowed:
                    raise SystemExit(f'{who}/{n}: non-PLAYPAL colour {(r, g, b)}')


def lump_table():
    return {n: {'width': W, 'height': H, 'leftoffset': LEFTOFFSET, 'topoffset': TOPOFFSET} for n in LUMPS}


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

    built: dict[str, dict[str, Image.Image]] = {}
    for who in PEOPLE:
        built[who] = {n: to_image(build(f, who, styles[who]), pal) for n, f in frames.items()}
    verify(built, pal)

    table = lump_table()
    for who, name in PEOPLE.items():
        for n in LUMPS:
            save_png(built[who][n], FACES_DIR / who / f'{n}.png')
        per_set = {
            'id': who, 'name': name, 'generator': 'scripts/build-influencer-faces.py',
            'lumps': {n: {'w': W, 'h': H, 'x': LEFTOFFSET, 'y': TOPOFFSET, **table[n]} for n in LUMPS},
        }
        (FACES_DIR / who / 'manifest.json').write_text(json.dumps(per_set, indent=2) + '\n')
    manifest = {
        'version': 1,
        'generator': 'scripts/build-influencer-faces.py',
        'source': 'user-supplied DOOM.WAD (PLAYPAL + STF* patches); each frame is Doomguy\'s matching frame '
                  'reshaped, recoloured and pixel-edited (hair filling the face box, eyes/glasses, '
                  'mustache/goatee, collar), blood kept',
        'draw': 'draw each PNG at (slotX - leftoffset, slotY - topoffset); the Doom face slot is (143, 168), '
                'so every lump covers exactly the face box interior x 144..176, y 170..199',
        'ids': list(PEOPLE),
        'names': PEOPLE,
        'path': 'ui/faces/<id>/<LUMP>.png',
        'order': LUMPS,
        'lumps': table,
    }
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    (FACES_DIR / 'influencer-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'wrote {len(PEOPLE) * len(LUMPS)} faces + influencer-manifest.json to {FACES_DIR.relative_to(ROOT)}')

    if not args.no_preview:
        write_previews(lumps, pal, frames, built)
        print(f'wrote previews to {PREVIEW_DIR.relative_to(ROOT)}')


# --------------------------------------------------------------------------------------
# Previews (local review only)
# --------------------------------------------------------------------------------------

COLUMNS = ('look right', 'centre', 'look left', 'turn right', 'turn left', 'ouch', 'evil grin', 'rampage')


def load_bar(lumps, pal):
    """The bar the game draws (PDBAR + PDARMS) if built, else the WAD's STBAR + STARMS."""
    bar_png, arms_png = STBAR_DIR / 'PDBAR.png', STBAR_DIR / 'PDARMS.png'
    if bar_png.is_file():
        bar = Image.open(bar_png).convert('RGBA')
        if arms_png.is_file():
            bar.alpha_composite(Image.open(arms_png).convert('RGBA'), (104, 0))
        return bar
    bar = to_image(decode_patch(lumps['STBAR'])[4], pal)
    if 'STARMS' in lumps:
        bar.alpha_composite(to_image(decode_patch(lumps['STARMS'])[4], pal), (104, 0))
    return bar


def box_tile(bar: Image.Image, im: Image.Image | None, f: Frame | None = None) -> Image.Image:
    """The status-bar face box with its border (bar x 143..177, y 1..31) and a face in it."""
    tile = bar.crop((143, 1, 178, 32)).copy()
    if im is not None:
        if f is None:
            tile.alpha_composite(im, (BOX_X - 143, BOX_Y - 1))
        else:
            tile.alpha_composite(im, (FACE_SLOT[0] - f.left - 143, -f.top - 1))
    return tile


def font(size):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def write_previews(lumps, pal, frames, built):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    bar = load_bar(lumps, pal)
    doomguy = {n: to_image(f.src, pal) for n, f in frames.items()}
    ink, dim, sheet_bg = (240, 240, 240, 255), (200, 200, 120, 255), (24, 24, 30, 255)
    small = font(13)

    # faces-preview.png: every frame at 4x; per pain level Doomguy / Samwise / Mario
    S, gap, label_w, head = 4, 4, 170, 24
    tw, th = 35 * S, 31 * S
    who_rows = (('doomguy', 'Doomguy (original)'),) + tuple(PEOPLE.items())
    rows = []
    for p in range(5):
        names = [n for n in LUMPS if n not in ('STFGOD0', 'STFDEAD0') and
                 (n[5] == str(p) if n[:5] in ('STFST', 'STFTL', 'STFTR') else n[-1] == str(p))]
        rows += [(f'{label}\npain {p}', who, names) for who, label in who_rows]
    rows += [(f'{label}\ngod / dead', who, ['STFGOD0', 'STFDEAD0']) for who, label in who_rows]
    sheet = Image.new('RGBA', (label_w + 8 * (tw + gap), head + len(rows) * (th + gap)), sheet_bg)
    d = ImageDraw.Draw(sheet)
    for k, c in enumerate(COLUMNS):
        d.text((label_w + k * (tw + gap) + 4, 5), c, fill=dim, font=small)
    for r, (label, who, names) in enumerate(rows):
        y = head + r * (th + gap)
        if r % 3 == 0 and r:
            d.line([(0, y - gap // 2 - 1), (sheet.width, y - gap // 2 - 1)], fill=(70, 70, 80, 255))
        d.multiline_text((8, y + th // 2 - 14), label, fill=ink, spacing=4, font=small)
        for k, n in enumerate(names):
            im = doomguy[n] if who == 'doomguy' else built[who][n]
            tile = box_tile(bar, im, frames[n] if who == 'doomguy' else None).resize((tw, th), Image.NEAREST)
            sheet.alpha_composite(tile, (label_w + k * (tw + gap), y))
            if n in ('STFGOD0', 'STFDEAD0'):
                d.text((label_w + k * (tw + gap) + 4, y + th - 16), 'god' if n == 'STFGOD0' else 'dead',
                       fill=dim, font=small)
    sheet.convert('RGB').save(PREVIEW_DIR / 'faces-preview.png', compress_level=9)

    # statusbar-mock.png: the real bar with STFST01 at 1x and 4x, plus every frame at 1x / 2x
    margin, label_h, half = 10, 18, (len(LUMPS) + 1) // 2
    strip_w = len(LUMPS) * 36
    width = max(margin * 2 + 320 + 16 + 320 * 4, margin * 2 + strip_w)
    block = label_h + 32 * 4 + 10 + 31 + 6 + 2 * (62 + 4) + 16
    mock = Image.new('RGBA', (width, margin + len(PEOPLE) * block), sheet_bg)
    d = ImageDraw.Draw(mock)
    for k, (who, label) in enumerate(PEOPLE.items()):
        y = margin + k * block
        d.text((margin, y), f'{label}  -  STFST01 in the status bar at 1x (left) and 4x; '
                            f'below, all 42 frames at 1x and 2x', fill=ink, font=small)
        y += label_h
        b = bar.copy()
        b.alpha_composite(built[who]['STFST01'], (BOX_X, BOX_Y))
        mock.alpha_composite(b, (margin, y))
        mock.alpha_composite(b.resize((320 * 4, 32 * 4), Image.NEAREST), (margin + 320 + 16, y))
        y += 32 * 4 + 10
        for i, n in enumerate(LUMPS):
            tile = box_tile(bar, built[who][n])
            mock.alpha_composite(tile, (margin + i * 36, y))
            j = i % half
            mock.alpha_composite(tile.resize((70, 62), Image.NEAREST),
                                 (margin + j * 72, y + 31 + 6 + (i // half) * 66))
    mock.convert('RGB').save(PREVIEW_DIR / 'statusbar-mock.png', compress_level=9)

    write_hero(built, bar)
    write_refs(built, bar)


HERO = (('STFST02', 'look left'), ('STFST01', 'centre'), ('STFST00', 'look right'),
        ('STFOUCH0', 'ouch'), ('STFEVL0', 'evil grin'))


def write_hero(built, bar):
    """hero.png: both characters side by side; look left / centre / right, ouch and evil
    grin at 6x in the face box, with the same frames and the real bar at 1x."""
    S, gap, pad = 6, 10, 24
    tw, th = 35 * S, 31 * S
    big, small = font(26), font(15)
    ink, dim, sheet_bg = (240, 240, 240, 255), (200, 200, 120, 255), (24, 24, 30, 255)
    col_w = len(HERO) * tw + (len(HERO) - 1) * gap
    width = pad * 3 + 2 * col_w
    height = pad + 40 + 24 + th + 16 + 32 + pad
    hero = Image.new('RGBA', (width, height), sheet_bg)
    d = ImageDraw.Draw(hero)
    for c, (who, name) in enumerate(PEOPLE.items()):
        x0 = pad + c * (col_w + pad)
        d.text((x0, pad), name, fill=ink, font=big)
        y = pad + 40
        for k, (n, label) in enumerate(HERO):
            d.text((x0 + k * (tw + gap) + 4, y), label, fill=dim, font=small)
            tile = box_tile(bar, built[who][n]).resize((tw, th), Image.NEAREST)
            hero.alpha_composite(tile, (x0 + k * (tw + gap), y + 24))
        y += 24 + th + 16
        for k, (n, _) in enumerate(HERO):
            hero.alpha_composite(box_tile(bar, built[who][n]), (x0 + k * 40, y))
        b = bar.copy()
        b.alpha_composite(built[who]['STFST01'], (BOX_X, BOX_Y))
        hero.alpha_composite(b, (x0 + len(HERO) * 40 + 16, y))
        d.text((x0 + len(HERO) * 40 + 16 + 326, y + 8), '1x', fill=dim, font=small)
    hero.convert('RGB').save(PREVIEW_DIR / 'hero.png', compress_level=9)


# head-and-shoulders crop of each reference image (fractions of width / height)
REF_CROP = {'samwise': (0.16, 0.0, 0.84, 0.34), 'mario': (0.12, 0.0, 0.88, 0.34)}
REF_FRAMES = (('STFST01', 'centre'), ('STFEVL0', 'evil grin'), ('STFOUCH0', 'ouch'))


def write_refs(built, bar):
    """refs-vs-faces.png: per character, the reference image and a head crop of it,
    downscaled to the height of a 6x face tile, beside the face at 6x (centre, grin,
    ouch) and at 1x."""
    S, pad, gap = 6, 24, 10
    tw, th = 35 * S, 31 * S
    small, big = font(15), font(22)
    ink, dim, sheet_bg = (240, 240, 240, 255), (200, 200, 120, 255), (24, 24, 30, 255)
    rows = []
    for who, name in PEOPLE.items():
        tiles = []
        if REFS[who].is_file():
            try:
                ref = Image.open(REFS[who]).convert('RGBA')
                full = ref.resize((int(round(ref.width * th / ref.height)), th), Image.LANCZOS)
                l, t, r, b = REF_CROP[who]
                crop = ref.crop((int(l * ref.width), int(t * ref.height), int(r * ref.width), int(b * ref.height)))
                crop = crop.resize((int(round(crop.width * th / crop.height)), th), Image.LANCZOS)
                tiles += [(full, 'reference'), (crop, 'reference, head')]
            except OSError:
                pass
        for n, label in REF_FRAMES:
            tiles.append((box_tile(bar, built[who][n]).resize((tw, th), Image.NEAREST), f'{n} 6x ({label})'))
        rows.append((name, tiles, [built[who][n] for n, _ in REF_FRAMES]))
    width = pad * 2 + max(sum(t.width for t, _ in tiles) + gap * (len(tiles) - 1) + gap + 3 * 40 for _, tiles, _ in rows)
    row_h = 34 + th + 26
    sheet = Image.new('RGBA', (width, pad + len(rows) * row_h + pad), sheet_bg)
    d = ImageDraw.Draw(sheet)
    y = pad
    for name, tiles, ims in rows:
        d.text((pad, y), name, fill=ink, font=big)
        x = pad
        for im, label in tiles:
            sheet.alpha_composite(im, (x, y + 34))
            d.text((x, y + 34 + th + 4), label, fill=dim, font=small)
            x += im.width + gap
        for k, im in enumerate(ims):                       # true size
            sheet.alpha_composite(box_tile(bar, im), (x + k * 40, y + 34 + th - 31))
        d.text((x, y + 34 + th + 4), '1x', fill=dim, font=small)
        y += row_h
    sheet.convert('RGB').save(PREVIEW_DIR / 'refs-vs-faces.png', compress_level=9)


if __name__ == '__main__':
    main()
