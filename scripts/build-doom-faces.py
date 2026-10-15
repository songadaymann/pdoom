#!/usr/bin/env python3
"""Build p(DOOM) status-bar mugshots from the user's local DOOM.WAD.

Reads PLAYPAL and the 42 STF* face patches from doom-web/local/DOOM.WAD and writes

  doom-web/local/ui/faces/doomguy/<LUMP>.png   the original faces, exact pixels (RGBA)
  doom-web/local/ui/faces/<id>/<LUMP>.png      milo, jules, sam, noah, ash
  doom-web/local/ui/faces/manifest.json        size/offsets per lump + character list

Every derived face keeps the original lump's width, height and offsets, so it drops into
the same status-bar slot (draw at x - leftoffset, y - topoffset). Every opaque pixel is a
PLAYPAL colour. The derived sets are made by re-colouring Doomguy's own digitised frames
(skin and hair ramps) and pixel-editing hair silhouettes, beards and brows per person, so
each expression, eye direction, head turn and pain level (blood, bruising) is inherited
from the matching original frame.

Commercial-WAD-derived pixels are only written into the git-ignored doom-web/local/ tree.
`--preview` also writes review sheets to output/doom-hud/ (faces-preview.png and
faces-vs-cast.png) for local art review.

Usage: python3 scripts/build-doom-faces.py [--preview] [--wad PATH] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WAD = ROOT / 'doom-web/local/DOOM.WAD'
DEFAULT_OUT = ROOT / 'doom-web/local/ui/faces'
PREVIEW_DIR = ROOT / 'output/doom-hud'
CAST_DIR = ROOT / 'art/cast-v1'

# Canonical order: per pain level (0 = healthy .. 4 = near death) the three straight
# faces (look right/centre/left), turn right, turn left, ouch, evil grin, rampage; then
# god mode and dead. This is the order st_stuff.c indexes faces in.
FACE_LUMPS = [
    name
    for level in range(5)
    for name in (f'STFST{level}0', f'STFST{level}1', f'STFST{level}2', f'STFTR{level}0',
                 f'STFTL{level}0', f'STFOUCH{level}', f'STFEVL{level}', f'STFKILL{level}')
] + ['STFGOD0', 'STFDEAD0']

# Site order used by the Five Prisons map (CheckpointMap.zs: site 0 = Milo ... 4 = Ash).
PEOPLE = ['milo', 'jules', 'sam', 'noah', 'ash']


# --------------------------------------------------------------------------------------
# WAD + patch decoding
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
    """Return (width, height, leftoffset, topoffset, rows) with rows[y][x] = index|None."""
    width, height, left, top = struct.unpack_from('<HHhh', data)
    rows: list[list[int | None]] = [[None] * width for _ in range(height)]
    for x in range(width):
        pos = struct.unpack_from('<I', data, 8 + x * 4)[0]
        while data[pos] != 0xFF:
            start, length = data[pos], data[pos + 1]
            for i, colour in enumerate(data[pos + 3:pos + 3 + length]):
                if start + i < height:
                    rows[start + i][x] = colour
            pos += length + 4
    return width, height, left, top, rows


# --------------------------------------------------------------------------------------
# Palette helpers
# --------------------------------------------------------------------------------------

class Palette:
    def __init__(self, playpal: bytes):
        self.rgb = [tuple(playpal[i * 3:i * 3 + 3]) for i in range(256)]
        self.l48 = self.luma(48)
        self.l79 = self.luma(79)

    def luma(self, index: int) -> float:
        r, g, b = self.rgb[index]
        return 0.299 * r + 0.587 * g + 0.114 * b

    def tone(self, index: int) -> float:
        """Darkness on Doom's flesh ramp: 0 = index 48 (lightest) .. 1 = index 79."""
        return (self.l48 - self.luma(index)) / (self.l48 - self.l79)

    @staticmethod
    def distance(a, b) -> float:
        rmean = (a[0] + b[0]) / 2
        dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
        return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db

    def nearest(self, rgb, candidates) -> int:
        return min(candidates, key=lambda i: self.distance(self.rgb[i], rgb))


def lerp_keys(keys, t):
    """Piecewise-linear colour from [(t, (r,g,b)), ...] sorted by t."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, c0), (t1, c1) in zip(keys, keys[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return tuple(c0[i] + (c1[i] - c0[i]) * k for i in range(3))
    return keys[-1][1]


class Ramp:
    """Tone -> palette index, sampled from colour keys and snapped to allowed PLAYPAL entries."""

    def __init__(self, palette: Palette, keys, candidates, steps: int = 64):
        self.t0, self.t1 = keys[0][0], keys[-1][0]
        self.steps = steps
        self.table = [palette.nearest(lerp_keys(keys, self.t0 + (self.t1 - self.t0) * i / (steps - 1)),
                                      candidates) for i in range(steps)]

    def __call__(self, t: float) -> int:
        k = (t - self.t0) / (self.t1 - self.t0)
        return self.table[max(0, min(self.steps - 1, round(k * (self.steps - 1))))]


# Palette index groups in the original faces.
FLESH = set(range(48, 80)) | {1, 2, 13, 14, 15} | set(range(144, 152)) | set(range(236, 240))
HIGHLIGHT = set(range(208, 216))           # orange highlights on nose and lower lip
LIPLINE = {165}                            # closed-mouth line
BLOODS = list(range(16, 48)) + list(range(176, 192)) + [13, 14, 15]
GREYS = list(range(80, 112)) + [3, 5, 6, 7, 8, 0]
DARKS = [0, 1, 2, 5, 6, 7, 8, 13, 14, 15, 236, 237, 238, 239] + list(range(70, 80)) + list(range(100, 112))
BLONDS = list(range(160, 168)) + list(range(48, 72)) + list(range(128, 152)) + [224, 225, 226]


def noise(x: int, y: int, seed: int) -> float:
    """Deterministic 0..1 hash noise, stable across frames (screen coordinates)."""
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


# --------------------------------------------------------------------------------------
# Face analysis (screen space: the 35x33 area the face patch is drawn into)
# --------------------------------------------------------------------------------------

SW, SH = 36, 34

# Screen row of the eyes (brows sit on the two rows above) per expression and pain level,
# and the nose line (x) of the turned heads per pain level; measured on the original
# patches (pain levels 2-4 have bloodshot eyes a colour classifier cannot find).
TURN_CX = {'TR': [22, 22, 24, 23.5, 23.5], 'TL': [12, 12, 11, 10, 9.5]}


def eye_row(kind: str, level: int) -> int:
    if kind == 'st':
        return 16 if level < 2 else 18
    if kind == 'turn':
        return 16 if level < 2 else 17 if level == 2 else 18
    if kind == 'ouch':
        return 15
    if kind in ('evl', 'kill', 'dead'):
        return 18
    return 16   # god


SLOT_W, SLOT_H = 35, 33     # preview tile: the face area of the status bar


class Face:
    def __init__(self, name: str, data: bytes, palette: Palette):
        self.name = name
        self.pal = palette
        self.w, self.h, self.left, self.top, rows = decode_patch(data)
        self.ox, self.oy = -self.left, -self.top
        self.src = [[None] * SW for _ in range(SH)]
        for y in range(self.h):
            for x in range(self.w):
                self.src[y + self.oy][x + self.ox] = rows[y][x]
        if name.startswith('STFTR'):
            self.family, self.facing = 'turn', 1      # face points to viewer's right
        elif name.startswith('STFTL'):
            self.family, self.facing = 'turn', -1
        else:
            self.family, self.facing = 'front', 0
        self.kind = ('st' if name.startswith('STFST') else 'turn' if self.family == 'turn' else
                     'ouch' if 'OUCH' in name else 'evl' if 'EVL' in name else
                     'kill' if 'KILL' in name else 'god' if 'GOD' in name else 'dead')
        digits = [c for c in name if c.isdigit()]
        self.level = 4 if self.kind == 'dead' else 0 if self.kind == 'god' else int(digits[0])
        self._analyse()

    # geometry --------------------------------------------------------------------------
    def inrect(self, x: int, y: int) -> bool:
        return self.ox <= x < self.ox + self.w and self.oy <= y < self.oy + self.h

    def opaque(self, x: int, y: int) -> bool:
        return 0 <= x < SW and 0 <= y < SH and self.src[y][x] is not None

    def row_span(self, y: int):
        xs = [x for x in range(SW) if self.src[y][x] is not None]
        return (xs[0], xs[-1]) if xs else None

    def col_span(self, x: int):
        ys = [y for y in range(SH) if self.src[y][x] is not None]
        return (ys[0], ys[-1]) if ys else None

    def _analyse(self):
        src = self.src
        self.eye_top = eye_row(self.kind, self.level)
        self.head_top = min(y for y in range(SH) if self.row_span(y))
        span = self.row_span(self.eye_top - 4)
        self.head_cx = (span[0] + span[1]) / 2
        if self.family == 'front':
            self.cx = self.head_cx
        else:
            self.cx = TURN_CX['TR' if self.facing > 0 else 'TL'][self.level]
        e = self.eye_top
        mouth = [(x, y) for y in range(e + 3, min(SH, e + 15)) for x in range(SW)
                 if abs(x - self.cx) <= 6 and src[y][x] is not None
                 and (src[y][x] in LIPLINE or 80 <= src[y][x] <= 111 or src[y][x] == 0
                      or 172 <= src[y][x] <= 191 or (src[y][x] in HIGHLIGHT and y >= e + 7))]
        if mouth:
            self.mouth = (min(x for x, _ in mouth), min(y for _, y in mouth),
                          max(x for x, _ in mouth), max(y for _, y in mouth))
        else:
            self.mouth = (round(self.cx) - 3, e + 9, round(self.cx) + 3, e + 10)
        self.hairline = self._hair_dp()

    def tone(self, x: int, y: int) -> float:
        return self.pal.tone(self.src[y][x])

    def _hair_dp(self, thr_h=0.50, thr_s=0.62, lam=0.6):
        """Per-column hairline (first non-hair row) by dynamic programming: hair above is
        dark flesh, skin below (down to the brows) is light, with a smoothness penalty."""
        src = self.src
        limit_row = self.eye_top - 1
        cols = [x for x in range(SW) if self.col_span(x)]
        options = {}
        for x in cols:
            top, bottom = self.col_span(x)
            lim = min(limit_row, bottom + 1)
            costs = {}
            for h in range(top, max(top, lim) + 1):
                c = 0.0
                for y in range(top, h):
                    p = src[y][x]
                    c += max(0.0, thr_h - self.pal.tone(p)) if p in FLESH else 1.0
                for y in range(h, lim):
                    p = src[y][x]
                    if p in FLESH:
                        c += max(0.0, self.pal.tone(p) - thr_s)
                costs[h] = c
            options[x] = costs
        acc = {}
        prev = None
        for x in cols:
            acc[x] = {}
            for h, c in options[x].items():
                if prev is None:
                    acc[x][h] = (c, None)
                else:
                    best = min((acc[prev][hp][0] + lam * abs(h - hp), hp) for hp in acc[prev])
                    acc[x][h] = (c + best[0], best[1])
            prev = x
        h = min(acc[prev], key=lambda k: acc[prev][k][0])
        line = {}
        for x in reversed(cols):
            line[x] = h
            h = acc[x][h][1]
        return line

    def is_dg_hair(self, x: int, y: int) -> bool:
        return (self.src[y][x] in FLESH or self.src[y][x] in HIGHLIGHT) and x in self.hairline and y < self.hairline[x]


# --------------------------------------------------------------------------------------
# Character recipes
# --------------------------------------------------------------------------------------

def dist_to_edge(region, x: int, y: int, limit: int = 4) -> int:
    """Chebyshev distance from (x, y) to the nearest pixel outside `region`."""
    for r in range(1, limit + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) == r and (x + dx, y + dy) not in region:
                    return r
    return limit + 1


def head_mask(f: Face):
    return {(x, y) for y in range(SH) for x in range(SW) if f.src[y][x] is not None}


def interp(points, v: float) -> float:
    """Piecewise-linear lookup in [(v, value), ...] sorted by v."""
    if v <= points[0][0]:
        return points[0][1]
    for (v0, a), (v1, b) in zip(points, points[1:]):
        if v <= v1:
            return a + (b - a) * (v - v0) / (v1 - v0)
    return points[-1][1]


FLESHY = FLESH | HIGHLIGHT


class Character:
    """A person's face set: Doomguy's frames with new skin/hair ramps and a new haircut.

    Hair geometry is described relative to each frame's own landmarks (eye line `e`,
    face centre `cx`, head silhouette), so one recipe follows all 42 expressions."""
    id = 'base'
    label = ''
    seed = 1
    skin_keys = [(0.10, (255, 199, 167)), (1.0, (43, 35, 15)), (1.2, (0, 0, 0))]
    skin_candidates = list(range(48, 80)) + [1, 2, 13, 14, 15, 236, 237, 238, 239, 7, 0]
    hair_keys = [(0.3, (120, 80, 40)), (1.2, (0, 0, 0))]
    hair_candidates = DARKS
    # hairline: [(|dx| from face centre, rows relative to eye line), ...]
    hairline_points = [(0, -6), (12, -6)]
    asymmetric = False            # hairline_points use signed dx (viewer's left negative)
    dome = None                   # (rx, ry, centre row vs eye line, superellipse power, lowest row vs eye line)
    soft = 1.0                    # < 1 softens Doomguy's creases (tone contrast around the mid-tones)
    jaw_trim = None               # rows below the eye line from which the jaw is narrowed by a pixel
    full_lips = None              # (lower lip colour) for closed-mouth frames
    face_back = 5                 # turned heads: the face extends this far behind the nose line
    back_slope = 0.9              # ... then the hairline drops this much per pixel
    back_drop = 2                 # ... but never lower than this many rows below the eye line
    iris = None                   # replaces Doomguy's blue irises (grin/rampage frames)
    eye_pink = 1.0                # darken pale pinks (tear ducts, thin blood) for deeper skin
    lip_line = None               # colour for the closed-mouth line
    lip_highlight = None          # colour for lower-lip highlights
    brow_colour = None
    thin_brows = False

    def __init__(self, palette: Palette):
        self.pal = palette
        self.skin = Ramp(palette, self.skin_keys, self.skin_candidates)
        self.hair = Ramp(palette, self.hair_keys, self.hair_candidates)
        if self.brow_colour is not None:
            # brows: from the brow colour (lit) down to near-black, by Doomguy's own shading
            dark = tuple(c * 0.45 for c in self.brow_colour)
            self.brow = Ramp(palette, [(0.66, self.brow_colour), (1.2, dark)], self.hair_candidates + self.skin_candidates)

    # geometry ------------------------------------------------------------------------
    def hl_front(self, dx: float, f: Face) -> float:
        v = dx if self.asymmetric else abs(dx)
        return f.eye_top + interp(self.hairline_points, v)

    def hairline_at(self, f: Face, x: int) -> float:
        if f.family == 'front':
            return self.hl_front(x - f.cx, f)
        u = (x - f.cx) * f.facing          # > 0 toward the face, < 0 toward the back of the head
        if u >= -self.face_back:
            return self.hl_front(u * f.facing if self.asymmetric else abs(u), f)
        row = self.hl_front(self.face_back, f) + self.back_slope * (-u - self.face_back)
        dp = f.hairline.get(x)
        if dp is not None:
            row = max(row, dp)
        return min(row, f.eye_top + self.back_drop)

    def hair_role(self, f: Face, x: int, y: int) -> str:
        return 'hair'

    def silhouette_add(self, f: Face) -> set:
        if not self.dome:
            return set()
        rx, ry, cy, n, ylim = self.dome
        ccx = f.head_cx - f.facing * 1.5
        if f.family == 'turn':
            rx += 0.6
        return {(x, y) for y in range(SH) for x in range(SW)
                if y <= f.eye_top + ylim
                and abs((x - ccx) / rx) ** n + abs((y - f.eye_top - cy) / ry) ** n <= 1.0}

    def hair_region(self, f: Face) -> dict:
        """{(x, y): role}; roles: 'hair', 'skin' (bare forehead), 'scalp' (clipped short)."""
        roles = {}
        head = head_mask(f)
        e = f.eye_top
        for (x, y) in head:
            if f.src[y][x] not in FLESHY:
                continue
            dg = f.is_dg_hair(x, y)
            if y < self.hairline_at(f, x):
                roles[(x, y)] = self.hair_role(f, x, y)
            elif dg:
                # Doomguy's pain 3-4 frames drop locks over the brow: keep them as hair
                lock = f.level >= 3 and y < e - 1 and abs(x - f.cx) < 8 and f.tone(x, y) >= 0.55
                roles[(x, y)] = self.hair_role(f, x, y) if lock else 'skin'
        for (x, y) in self.silhouette_add(f):
            if f.inrect(x, y) and (x, y) not in head:
                roles[(x, y)] = self.hair_role(f, x, y)
        self.adjust(f, roles, head)
        return roles

    def adjust(self, f: Face, roles: dict, head: set):
        """Per-character additions (partings, ponytails)."""

    # tone ------------------------------------------------------------------------------
    def lighting(self, f: Face, x: int, y: int, region) -> float:
        ccx = f.head_cx - f.facing * 1.0
        r = math.sqrt(((x - ccx) / 11.0) ** 2 + ((y - (f.head_top + 2)) / 9.0) ** 2)
        t = 0.45 + 0.35 * min(1.0, r)
        d = dist_to_edge(region, x, y, 2)
        return t + (0.2 if d == 1 else 0.08 if d == 2 else 0.0)

    def texture(self, f: Face, x: int, y: int) -> float:
        return 0.0

    def hair_tone(self, f: Face, x: int, y: int, region) -> float:
        light = self.lighting(f, x, y, region)
        p = f.src[y][x]
        base = 0.5 * f.tone(x, y) + 0.5 * light if (p in FLESHY and f.is_dg_hair(x, y)) else light + 0.05
        return base + self.texture(f, x, y)

    def forehead_tone(self, f: Face, x: int, y: int) -> float:
        """Bare skin replacing Doomguy's hair: light pixels (often forehead the hair
        detector over-claimed) keep their shading; dark ones copy the skin just below."""
        own = f.tone(x, y)
        if own < 0.5:
            return own
        for yy in range(y + 1, min(SH, f.eye_top - 1)):
            vals = sorted(f.pal.tone(f.src[yy][xx]) for xx in range(x - 2, x + 3)
                          if 0 <= xx < SW and f.src[yy][xx] in FLESH and not f.is_dg_hair(xx, yy)
                          and f.pal.tone(f.src[yy][xx]) < 0.75)
            if len(vals) >= 2:
                t = vals[len(vals) // 2]
                return t + 0.02 * (yy - y) + 0.06 * (noise(x, y, self.seed + 17) - 0.5)
        return 0.5

    def scalp_index(self, f: Face, x: int, y: int, region) -> int:
        return self.skin(self.lighting(f, x, y, region))

    # render ------------------------------------------------------------------------------
    def render(self, f: Face):
        src = f.src
        out = [row[:] for row in src]
        roles = self.hair_region(f)
        region = head_mask(f) | {k for k in roles if f.inrect(*k)}
        e = f.eye_top
        for y in range(SH):
            for x in range(SW):
                p = src[y][x]
                role = roles.get((x, y))
                if role is None:
                    if p is None:
                        continue
                    if p in FLESH:
                        t = f.pal.tone(p)
                        if self.soft != 1.0 and 0.1 < t < 0.9:
                            t = 0.45 + (t - 0.45) * self.soft
                        out[y][x] = self.skin(t)
                    elif p in HIGHLIGHT:
                        if y >= e + 7 and self.lip_highlight is not None:
                            out[y][x] = self.pal.nearest(self.lip_highlight, self.skin_candidates + list(range(16, 32)))
                        else:
                            out[y][x] = self.skin(f.pal.tone(p))
                    elif p in LIPLINE and self.lip_line is not None:
                        out[y][x] = self.pal.nearest(self.lip_line, self.skin_candidates)
                    elif 192 <= p <= 207 and self.iris is not None:
                        out[y][x] = self.pal.nearest(self.iris, DARKS)
                    elif 16 <= p <= 31 and self.eye_pink != 1.0:
                        # pale pinks (tear ducts, thin blood) read as paint on deeper skin
                        r, g, b = f.pal.rgb[p]
                        k = self.eye_pink
                        out[y][x] = self.pal.nearest((r * k, g * k * 0.92, b * k * 0.88), BLOODS)
                    continue
                if not f.inrect(x, y):
                    continue
                if role == 'hair':
                    if p is not None and p not in FLESHY:
                        continue          # blood or eyes inside the hair area stay
                    out[y][x] = self.hair(self.hair_tone(f, x, y, region))
                elif role == 'skin':
                    out[y][x] = self.skin(self.forehead_tone(f, x, y))
                elif role == 'scalp':
                    if p is not None and p not in FLESHY:
                        continue
                    out[y][x] = self.scalp_index(f, x, y, region)
                elif role == 'part':
                    out[y][x] = self.skin(0.92)
        self.brows(f, out, roles)
        if self.jaw_trim is not None:
            self.trim_jaw(f, out, roles)
        if self.full_lips is not None:
            self.lips(f, out)
        self.extra(f, out, roles, region)
        return out

    def trim_jaw(self, f: Face, out, roles):
        """Narrow Doomguy's square jaw by a pixel per side, moving the dark rim inward."""
        if f.family != 'front':
            return
        for y in range(f.eye_top + self.jaw_trim, SH):
            xs = [x for x in range(SW) if out[y][x] is not None]
            if len(xs) < 7:
                continue
            for edge, inner in ((xs[0], xs[0] + 1), (xs[-1], xs[-1] - 1)):
                if roles.get((edge, y)) in ('hair', 'scalp') or roles.get((inner, y)) in ('hair', 'scalp'):
                    continue
                if f.src[y][inner] in FLESH and f.src[y][edge] in FLESH:
                    out[y][inner] = self.skin(max(f.tone(edge, y), f.tone(inner, y) + 0.12))
                out[y][edge] = None

    def lips(self, f: Face, out):
        """A defined lower lip under Doomguy's closed-mouth line."""
        if f.kind not in ('st', 'god'):
            return
        line = [(x, y) for y in range(SH) for x in range(SW) if f.src[y][x] in LIPLINE]
        if not line:
            return
        y = max(yy for _, yy in line) + 1
        xs = [x for x, yy in line if yy == y - 1]
        lip = self.pal.nearest(self.full_lips, self.skin_candidates + list(range(16, 48)))
        for x in range(min(xs) + 1, max(xs)):
            if f.src[y][x] in FLESH:
                out[y][x] = lip

    def brows(self, f: Face, out, roles):
        """Doomguy's heavy brow ridge, recoloured with this person's hair (thinned for some)."""
        if self.brow_colour is None:
            return
        e = f.eye_top
        for y in (e - 3, e - 2, e - 1):
            for x in range(SW):
                p = f.src[y][x]
                if (x, y) in roles or not (p in FLESH and y > e - 3 or p == 0):
                    continue
                u = (x - f.cx) * (f.facing or 1)
                if f.family == 'front' and not 1.0 <= abs(x - f.cx) <= 8.5:
                    continue
                if f.family == 'turn' and not -7 <= u <= 10:
                    continue
                t = f.pal.tone(p) if p else 1.1
                if t < 0.66:
                    continue
                if self.thin_brows and y < e - 1:
                    out[y][x] = self.skin(0.55 if p == 0 else t - 0.3)
                else:
                    out[y][x] = self.brow(t)

    def extra(self, f: Face, out, roles, region):
        """Final per-character pixel edits (beards, wrinkles)."""


class Milo(Character):
    id, label, seed = 'milo', 'Milo', 11
    skin_keys = [(0.10, (243, 183, 143)), (0.45, (195, 127, 83)), (0.75, (135, 87, 51)),
                 (1.0, (55, 39, 19)), (1.2, (11, 11, 11))]
    hair_keys = [(0.35, (103, 71, 39)), (0.6, (71, 51, 35)), (0.85, (39, 27, 11)), (1.15, (7, 7, 7))]
    beard_keys = [(0.2, (115, 79, 43)), (0.5, (75, 55, 31)), (0.8, (43, 27, 11)), (1.1, (7, 7, 7))]
    hairline_points = [(0, -6), (4, -6), (7, -5), (9, -3), (9.6, 4), (20, 4)]
    dome = (12.4, 9.2, -7.5, 2.2, -3)
    iris = (47, 27, 11)
    eye_pink = 0.85
    lip_line = (75, 39, 31)
    lip_highlight = (151, 91, 71)
    brow_colour = (31, 23, 11)

    def __init__(self, palette):
        super().__init__(palette)
        self.beard = Ramp(palette, self.beard_keys, DARKS + list(range(64, 76)))

    def texture(self, f, x, y):
        clump = noise((x + (y // 2) % 2) // 2, y // 2, self.seed) - 0.5
        return 0.22 * clump + 0.12 * (noise(x, y, self.seed + 1) - 0.5)

    def beard_region(self, f: Face, roles):
        e = f.eye_top
        mx0, my0, mx1, my1 = f.mouth
        region = set()
        for (x, y) in head_mask(f):
            p = f.src[y][x]
            if p not in FLESHY and p not in LIPLINE and not 16 <= p <= 47 or (x, y) in roles:
                continue
            if mx0 - 1 <= x <= mx1 + 1:
                top = max(my0 - 2, e + 6)
            else:
                d = (mx0 - 1 - x) if x < mx0 - 1 else (x - mx1 - 1)
                top = max(e + 4, my0 - 2 - round(d * 0.5))
                u = (x - f.cx) * f.facing
                if f.family == 'turn' and u < -6:
                    # behind the cheek the beard line drops along the jaw, below the ear
                    top = max(top, e + 4 + round(0.45 * (-u - 6)))
            if y >= top:
                region.add((x, y))
        return region

    def extra(self, f, out, roles, region):
        beard = self.beard_region(f, roles)
        my0 = f.mouth[1]
        for (x, y) in beard:
            p = f.src[y][x]
            if p in LIPLINE:
                out[y][x] = self.pal.nearest((63, 35, 27), self.skin_candidates)
                continue
            if p in HIGHLIGHT and y >= my0:
                out[y][x] = self.pal.nearest((135, 79, 59), self.skin_candidates)
                continue
            if 16 <= p <= 47:
                # blood soaked into the beard: keep it red, but dark
                r, g, b = f.pal.rgb[p]
                out[y][x] = self.pal.nearest((r * 0.62 + 20, g * 0.45 + 12, b * 0.45 + 8), BLOODS)
                continue
            t = 0.55 * f.tone(x, y) + 0.3
            t += 0.22 * (noise(x // 2, y, self.seed + 5) - 0.5) + 0.12 * (noise(x, y, self.seed + 6) - 0.5)
            if dist_to_edge(region, x, y, 1) <= 1:
                t += 0.15
            if (x, y - 1) not in beard and f.src[y - 1][x] in FLESH and (x, y - 1) not in roles:
                # ragged upper edge: the beard thins into the cheek
                if noise(x, y, self.seed + 8) < 0.4:
                    continue
                t -= 0.12
            out[y][x] = self.beard(t)


class Jules(Character):
    id, label, seed = 'jules', 'Jules', 23
    skin_keys = [(0.10, (187, 123, 79)), (0.4, (143, 95, 55)), (0.7, (99, 67, 35)),
                 (1.0, (43, 31, 15)), (1.2, (7, 7, 7))]
    hair_keys = [(0.35, (71, 51, 35)), (0.6, (39, 27, 15)), (0.85, (19, 15, 7)), (1.1, (0, 0, 0))]
    hairline_points = [(0, -6), (3, -5.5), (5, -4.5), (7, -3), (8.3, -1), (9.2, 4), (10.2, 6), (20, 6)]
    dome = (12.5, 10.5, -5.0, 2.0, 5)
    back_drop = 5                 # the round mass reaches the nape on turned heads
    soft = 0.88
    jaw_trim = 8
    full_lips = (87, 47, 35)
    iris = (31, 23, 11)
    eye_pink = 0.6
    lip_line = (47, 27, 19)
    lip_highlight = (135, 83, 63)
    brow_colour = (23, 15, 7)
    thin_brows = True

    def texture(self, f, x, y):
        # tight coils: lit arcs (a bright pixel with a half-lit neighbour) on a dark mass
        n = noise(x, y, self.seed)
        m = noise(x - 1, y + 1, self.seed)
        coil = -0.38 if n > 0.76 else (-0.16 if m > 0.76 else 0.06)
        return 0.12 + coil + 0.1 * (noise(x // 2, y // 2, self.seed + 3) - 0.5)


class Sam(Character):
    id, label, seed = 'sam', 'Sam', 37
    skin_keys = [(0.10, (255, 215, 183)), (0.45, (219, 163, 119)), (0.75, (159, 111, 71)),
                 (1.0, (67, 51, 27)), (1.2, (11, 11, 11))]
    skin_candidates = Character.skin_candidates + list(range(128, 152))
    hair_keys = [(0.3, (203, 203, 203)), (0.55, (147, 147, 147)), (0.8, (91, 91, 91)), (1.15, (27, 27, 27))]
    hair_candidates = GREYS
    hairline_points = [(0, -6), (3, -6), (4.5, -7.5), (7, -7.5), (8.2, -4), (10, -1), (20, -1)]
    dome = (12.2, 8.6, -8, 2.0, -6)
    iris = (47, 27, 11)
    lip_line = (131, 79, 55)
    lip_highlight = (203, 139, 103)
    brow_colour = (79, 79, 79)

    def texture(self, f, x, y):
        n = noise(x, y, self.seed)
        return -0.16 if n > 0.8 else 0.2 if n < 0.3 else 0.06

    def extra(self, f, out, roles, region):
        if f.family != 'front':
            return
        # age: a broken crease across the forehead
        y = f.eye_top - 4
        for x in range(round(f.cx) - 4, round(f.cx) + 4):
            if roles.get((x, y), 'skin') == 'skin' and f.src[y][x] in FLESH and noise(x, y, self.seed + 9) > 0.25:
                out[y][x] = self.skin(self.forehead_tone(f, x, y) + 0.22)


class Noah(Character):
    id, label, seed = 'noah', 'Noah', 41
    skin_keys = [(0.10, (223, 159, 111)), (0.45, (171, 111, 67)), (0.75, (115, 75, 43)),
                 (1.0, (47, 31, 15)), (1.2, (7, 7, 7))]
    hair_keys = [(0.3, (83, 75, 71)), (0.55, (43, 39, 35)), (0.8, (19, 19, 19)), (1.1, (0, 0, 0))]
    hairline_points = [(0, -6.5), (3, -6), (5, -5), (7, -3.5), (8.5, -1), (9.2, 10), (20, 10)]
    back_drop = 3
    soft = 0.88
    jaw_trim = 8
    full_lips = (119, 63, 51)
    iris = (31, 23, 11)
    eye_pink = 0.7
    lip_line = (83, 43, 35)
    lip_highlight = (163, 99, 79)
    brow_colour = (19, 19, 19)
    thin_brows = True

    def texture(self, f, x, y):
        ang = math.atan2(y - (f.head_top - 8), x - f.head_cx)
        strand = noise(int(ang * 24), 0, self.seed) - 0.5
        sheen = -0.18 if f.head_top + 2 <= y <= f.head_top + 4 else 0.0
        return 0.25 * strand + sheen + 0.1

    def adjust(self, f, roles, head):
        e = f.eye_top
        self._tie = None
        if f.family == 'front':
            px = round(f.head_cx - 0.5)
            hl = self.hl_front(px - f.cx, f)
            for y in range(math.ceil(hl) - 3, math.ceil(hl)):
                if roles.get((px, y)) == 'hair':
                    roles[(px, y)] = 'part'
            return
        # ponytail: gathered at the nape, hanging into the free corner behind the jaw
        back = -f.facing
        top = e + 3
        xs = [x for (x, y) in head if y == top]
        nape = min(xs) if back < 0 else max(xs)
        root = nape - back * 1          # a pixel inside the back of the head
        for k in range(0, 12):
            y = top + k
            xc = root + back * (0.6 if k < 2 else 1.0 if k < 8 else 0.6)
            half = 0.7 if k < 2 else 1.2 if k < 9 else 0.7
            for x in range(SW):
                if abs(x - xc) <= half + 1e-6 and f.inrect(x, y):
                    if (x, y) not in head or k < 3 or dist_to_edge(head, x, y, 1) <= 1:
                        roles[(x, y)] = 'hair'
        self._tie = (round(root + back * 0.6), top + 1)

    def extra(self, f, out, roles, region):
        if self._tie:
            x, y = self._tie
            for xx in (x - 1, x, x + 1):
                if f.inrect(xx, y) and roles.get((xx, y)) == 'hair':
                    out[y][xx] = self.pal.nearest((235, 183, 59), BLONDS)


class Ash(Character):
    id, label, seed = 'ash', 'Ash', 53
    skin_keys = [(0.10, (255, 227, 211)), (0.45, (243, 179, 143)), (0.75, (195, 119, 95)),
                 (1.0, (95, 59, 39)), (1.2, (31, 23, 11))]
    skin_candidates = Character.skin_candidates + list(range(16, 32))
    hair_keys = [(0.25, (240, 225, 150)), (0.45, (210, 182, 100)), (0.7, (175, 135, 70)),
                 (0.9, (130, 100, 65)), (1.15, (79, 55, 31))]
    hair_candidates = list(range(160, 168)) + list(range(128, 152)) + [224, 225, 226, 13, 14, 15, 236, 237, 238, 75, 76, 77]
    stubble_keys = [(0.3, (175, 135, 99)), (0.7, (131, 99, 67)), (1.1, (83, 63, 39))]
    # swept fringe over the viewer's left brow (signed dx: left negative)
    hairline_points = [(-12, -1), (-8.5, -1), (-7.5, -4), (-6, -3), (-2, -3), (0, -4.5), (3, -6.5), (7, -7), (7.5, -1), (12, -1)]
    asymmetric = True
    dome = (11.8, 8.8, -8, 2.2, -9)
    soft = 0.92
    jaw_trim = 9
    lip_line = (171, 99, 87)
    lip_highlight = (235, 155, 135)
    brow_colour = (151, 107, 63)
    thin_brows = True

    def __init__(self, palette):
        super().__init__(palette)
        self.stubble = Ramp(palette, self.stubble_keys, self.skin_candidates + list(range(128, 152)) + BLONDS)

    def hair_role(self, f, x, y):
        if f.family == 'front':
            # undercut: clipped on both sides, highest on the side away from the fringe
            dx = x - f.head_cx
            side = (dx >= 6.0 and y >= f.head_top + 3) or (dx <= -8.5 and y >= f.head_top + 4)
        else:
            u = (x - f.cx) * f.facing
            side = u < -2 and y >= f.head_top + 5
        return 'scalp' if side else 'hair'

    def texture(self, f, x, y):
        streak = noise((x + y) // 2, (x - y) // 6, self.seed) - 0.5
        return 0.3 * streak + 0.1 * (noise(x, y, self.seed + 1) - 0.5) - 0.05

    def scalp_index(self, f, x, y, region):
        """Clipped undercut: skin showing through, flecked with short blond-brown stubble."""
        p = f.src[y][x]
        t = f.tone(x, y) if p in FLESHY else 0.85
        t = 0.5 * t + 0.3 + (0.18 if dist_to_edge(region, x, y, 1) <= 1 else 0.0)
        if noise(x, y, self.seed + 7) < 0.4:
            return self.stubble(t + 0.05)
        return self.skin(t)


CHARACTERS = [Milo, Jules, Sam, Noah, Ash]


# --------------------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------------------

def to_image(face: Face, grid, palette: Palette) -> Image.Image:
    img = Image.new('RGBA', (face.w, face.h), (0, 0, 0, 0))
    px = img.load()
    for y in range(face.h):
        for x in range(face.w):
            p = grid[y + face.oy][x + face.ox]
            if p is not None:
                px[x, y] = (*palette.rgb[p], 255)
    return img


def build(wad: Path, out_dir: Path):
    lumps = read_wad(wad)
    missing = [n for n in FACE_LUMPS + ['PLAYPAL'] if n not in lumps]
    if missing:
        raise SystemExit(f'{wad} lacks {", ".join(missing)}')
    palette = Palette(lumps['PLAYPAL'][:768])
    faces = {name: Face(name, lumps[name], palette) for name in FACE_LUMPS}
    characters = [cls(palette) for cls in CHARACTERS]
    images: dict[str, dict[str, Image.Image]] = {'doomguy': {}}
    for name, face in faces.items():
        images['doomguy'][name] = to_image(face, face.src, palette)
    for ch in characters:
        images[ch.id] = {name: to_image(face, ch.render(face), palette) for name, face in faces.items()}
    for cid, frames in images.items():
        d = out_dir / cid
        d.mkdir(parents=True, exist_ok=True)
        for name, img in frames.items():
            img.save(d / f'{name}.png')
    manifest = {
        'version': 1,
        'generator': 'scripts/build-doom-faces.py',
        'source': 'user-supplied DOOM.WAD (PLAYPAL + STF* patches); derived sets are recoloured/pixel-edited',
        'draw': 'draw each PNG at (slotX - leftoffset, slotY - topoffset); the Doom face slot is (143, 168)',
        'characters': ['doomguy'] + [c.id for c in characters],
        'labels': {'doomguy': 'Original body', **{c.id: c.label for c in characters}},
        'people': PEOPLE,
        'order': FACE_LUMPS,
        'lumps': {name: {'width': f.w, 'height': f.h, 'leftoffset': f.left, 'topoffset': f.top}
                  for name, f in faces.items()},
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return faces, images, palette


# --------------------------------------------------------------------------------------
# Previews
# --------------------------------------------------------------------------------------

def draw_on_slot(img: Image.Image, face: Face, scale: int, bg):
    """Render one face in its 32x32 slot (as drawn on the status bar) at `scale`."""
    tile = Image.new('RGBA', (SLOT_W, SLOT_H), bg)
    tile.paste(img, (face.ox, face.oy), img)
    return tile.resize((SLOT_W * scale, SLOT_H * scale), Image.NEAREST)


def preview(faces, images, palette):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    scale = 4
    bg = (44, 44, 44, 255)
    label_w = 120
    cols = len(FACE_LUMPS)
    cell = SLOT_H * scale
    cellw = SLOT_W * scale
    rows = list(images.keys())
    sheet = Image.new('RGBA', (label_w + cols * (cellw + 4), 30 + len(rows) * (cell + 8)), (16, 16, 20, 255))
    d = ImageDraw.Draw(sheet)
    for c, name in enumerate(FACE_LUMPS):
        d.text((label_w + c * (cellw + 4) + 4, 6 + (c % 2) * 9), name, fill=(200, 200, 120))
    for r, cid in enumerate(rows):
        y = 30 + r * (cell + 8)
        d.text((8, y + cell // 2 - 6), cid.upper(), fill=(255, 255, 255))
        for c, name in enumerate(FACE_LUMPS):
            sheet.paste(draw_on_slot(images[cid][name], faces[name], scale, bg), (label_w + c * (cellw + 4), y))
    sheet.save(PREVIEW_DIR / 'faces-preview.png')

    # faces-vs-cast: each person's cast art (front and profile heads) beside key faces,
    # plus the straight face at 1x/2x/3x to judge readability at status-bar size
    keys = ['STFST01', 'STFST00', 'STFST02', 'STFTR00', 'STFTL00', 'STFEVL0', 'STFOUCH0', 'STFKILL0',
            'STFST21', 'STFST31', 'STFST41', 'STFDEAD0']
    small_w = SLOT_W * (1 + 2 + 3) + 16
    left = 8 + 2 * (cell + 6) + 8
    sheet2 = Image.new('RGBA', (left + len(keys) * (cellw + 4) + small_w + 8, 30 + len(rows) * (cell + 22)),
                       (16, 16, 20, 255))
    d2 = ImageDraw.Draw(sheet2)
    d2.text((8, 8), 'cast-v1 front / profile', fill=(200, 200, 120))
    for c, name in enumerate(keys):
        d2.text((left + c * (cellw + 4) + 4, 8 + (c % 2) * 9), name, fill=(200, 200, 120))
    d2.text((left + len(keys) * (cellw + 4) + 4, 8), '1x  2x  3x', fill=(200, 200, 120))
    for r, cid in enumerate(rows):
        y = 30 + r * (cell + 22)
        d2.text((8, y + cell + 4), cid.upper(), fill=(255, 255, 255))
        for i, column in enumerate((0, 2)):
            head = cast_head(cid, column)
            if head is not None:
                head = head.resize((cell, cell), Image.NEAREST)
                tile = Image.new('RGBA', (cell, cell), bg)
                tile.alpha_composite(head)
                sheet2.paste(tile, (8 + i * (cell + 6), y))
        for c, name in enumerate(keys):
            sheet2.paste(draw_on_slot(images[cid][name], faces[name], scale, bg), (left + c * (cellw + 4), y))
        x = left + len(keys) * (cellw + 4) + 4
        for k in (1, 2, 3):
            sheet2.paste(draw_on_slot(images[cid]['STFST01'], faces['STFST01'], k, bg), (x, y + cell - SLOT_H * k))
            x += SLOT_W * k + 4
    sheet2.save(PREVIEW_DIR / 'faces-vs-cast.png')


def cast_head(cid: str, column: int = 0):
    """Square head crop from a cast atlas view (art/cast-v1); column 0 = front, 2 = profile."""
    if cid == 'doomguy':
        return None
    if cid == 'milo':
        path, rows = CAST_DIR / 'milo-crouch-atlas.png', 4
    else:
        path, rows = CAST_DIR / f'{cid}-atlas.png', 6
    if not path.exists():
        return None
    atlas = Image.open(path).convert('RGBA')
    cw = atlas.size[0] // 8
    ch = atlas.size[1] // rows
    cell = atlas.crop((column * cw, 0, (column + 1) * cw, ch))
    bb = cell.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    if not bb:
        return None
    top = bb[1]
    head_h = max(12, int((bb[3] - bb[1]) * 0.2))
    xs = [x for y in range(top, min(ch, top + head_h)) for x in range(cw) if cell.getpixel((x, y))[3] > 128]
    cx = (min(xs) + max(xs)) // 2
    size = int(max(max(xs) - min(xs), head_h) * 1.45)
    return cell.crop((cx - size // 2, top - 2, cx - size // 2 + size, top - 2 + size))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--wad', type=Path, default=DEFAULT_WAD)
    ap.add_argument('--out', type=Path, default=DEFAULT_OUT)
    ap.add_argument('--preview', action='store_true', help='also write output/doom-hud review sheets')
    args = ap.parse_args(argv)
    if not args.wad.exists():
        print(f'build-doom-faces: {args.wad} not found; skipping (supply DOOM.WAD in doom-web/local/)', file=sys.stderr)
        return 1
    faces, images, palette = build(args.wad, args.out)
    print(f'wrote {len(images)} face sets x {len(FACE_LUMPS)} lumps to {args.out}')
    if args.preview:
        preview(faces, images, palette)
        print(f'previews in {PREVIEW_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
