#!/usr/bin/env python3
"""Build the p(DOOM) status bar from the user's local registered DOOM.WAD.

Everything written here is derived from commercial id Software data, so it is
generated into the git-ignored doom-web/local/ui/stbar/ tree (plus a local
preview in output/doom-hud/). This script is the source of truth; nothing it
produces is committed.

Outputs
  doom-web/local/ui/stbar/<LUMP>.png   original status-bar patches (RGBA, PLAYPAL)
  doom-web/local/ui/stbar/PD*.png      p(DOOM) derivatives (relabelled bar, extra glyphs)
  doom-web/local/ui/stbar/manifest.json  sizes + Doom patch offsets + face sets
  output/doom-hud/stbar-original-vs-ours.png  4x preview, original above ours

The relabelled backgrounds keep every original pixel except the label pixels:
old labels are erased by cloning bar texture from clean rows of the same
column (keeping the vertical streaks), and new labels are composed from glyphs
cut out of STBAR/STARMS themselves, plus a few hand-authored glyphs (D, P,
parentheses; small A, M, F, I, V) drawn with the same rows of the grey ramp
and the same drop shadows.

Run directly:  python3 scripts/build-doom-statusbar.py
Re-run after the face sets in doom-web/local/ui/faces/ change so the manifest
lists them (build-doom-faces.py and build-ceo-faces.py run first in build:doom).
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WAD = ROOT / 'doom-web/local/DOOM.WAD'
OUT = ROOT / 'doom-web/local/ui/stbar'
FACES_DIR = ROOT / 'doom-web/local/ui/faces'
PREVIEW = ROOT / 'output/doom-hud/stbar-original-vs-ours.png'

# --------------------------------------------------------------------------- WAD


def load_wad(path: Path) -> dict[str, bytes]:
    blob = path.read_bytes()
    if blob[:4] not in (b'IWAD', b'PWAD'):
        raise SystemExit(f'{path} is not a WAD file')
    count, directory = struct.unpack_from('<II', blob, 4)
    lumps: dict[str, bytes] = {}
    for i in range(count):
        offset, size, name = struct.unpack_from('<II8s', blob, directory + i * 16)
        key = name.rstrip(b'\0').decode('ascii', 'replace').upper()
        lumps.setdefault(key, blob[offset:offset + size])
    return lumps


class Patch:
    """A Doom patch as palette indices (None = transparent) plus offsets."""

    def __init__(self, w: int, h: int, left: int = 0, top: int = 0, px=None):
        self.w, self.h, self.left, self.top = w, h, left, top
        self.px = px if px is not None else [[None] * w for _ in range(h)]

    @classmethod
    def decode(cls, data: bytes) -> 'Patch':
        w, h, left, top = struct.unpack_from('<HHhh', data)
        patch = cls(w, h, left, top)
        for x in range(w):
            pos = struct.unpack_from('<I', data, 8 + x * 4)[0]
            last_top = -1
            while data[pos] != 0xFF:
                top_delta, length = data[pos], data[pos + 1]
                # DeePsea tall patches: a non-increasing delta is relative.
                row = top_delta + last_top if top_delta <= last_top else top_delta
                last_top = row
                for i in range(length):
                    if 0 <= row + i < h:
                        patch.px[row + i][x] = data[pos + 3 + i]
                pos += length + 4
        return patch

    def copy(self) -> 'Patch':
        return Patch(self.w, self.h, self.left, self.top, [row[:] for row in self.px])

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def image(self, palette) -> Image.Image:
        img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        put = img.putpixel
        for y, row in enumerate(self.px):
            for x, c in enumerate(row):
                if c is not None:
                    put((x, y), palette[c] + (255,))
        return img


def from_rows(rows: list[str], legend: dict[str, int | None], left=0, top=0) -> Patch:
    patch = Patch(len(rows[0]), len(rows), left, top)
    for y, line in enumerate(rows):
        assert len(line) == patch.w, rows
        for x, ch in enumerate(line):
            patch.px[y][x] = legend[ch]
    return patch


# ------------------------------------------------------------------- lump lists

FACE_LUMPS = []
for level in range(5):
    FACE_LUMPS += [f'STFST{level}0', f'STFST{level}1', f'STFST{level}2', f'STFTR{level}0',
                   f'STFTL{level}0', f'STFOUCH{level}', f'STFEVL{level}', f'STFKILL{level}']
FACE_LUMPS += ['STFGOD0', 'STFDEAD0']

STATUS_LUMPS = (['STBAR', 'STARMS', 'STTPRCNT', 'STTMINUS']
                + [f'STTNUM{i}' for i in range(10)]
                + [f'STYSNUM{i}' for i in range(10)]
                + [f'STGNUM{i}' for i in range(10)]
                + [f'STKEYS{i}' for i in range(6)]
                + [f'STFB{i}' for i in range(4)]
                + [f'STCFN{i:03d}' for i in range(33, 96)]
                + FACE_LUMPS)

# Character ids, matching PDOOM_STATE "controlled": 0 = your own body, 1..5 = the
# prisoners in RescueCast/CheckpointMap.SiteName order.
FACE_SETS = ['doomguy', 'milo', 'jules', 'sam', 'noah', 'ash'] + [c['id'] for c in json.loads((ROOT / 'art/campaign-v2/roster.json').read_text())]
# The playable CEOs (scripts/build-ceo-faces.py): the launcher's choice replaces
# Doomguy as body 0. Listed in the manifest's faces when built, in 'ceoFaceSets'.
CEO_FACE_SETS = ['altman', 'amodei', 'samwise', 'mario']

# ------------------------------------------------------------------ label fonts
# Big label font (AMMO/HEALTH/ARMS/ARMOR): 5 body rows on the grey ramp and a
# drop shadow one pixel right and down. Small label font (BULL/SHEL/RCKT/CELL):
# same body rows, shadow one pixel to the right only.
BODY_ROWS = [96, 94, 92, 90, 88]
TOP_ROW = {95, 96}
SHADOWS = [111, 111, 5, 111, 6, 111, 5, 111, 111, 6]  # dark indices used in STBAR

# Glyph masks verified against the WAD: (mask, source, borrow). A source glyph
# (lump, body x, body y) is cut out with its exact body and shadow colours.
# Authored glyphs (source None) match the font: 2-pixel strokes, rounded
# corners where the originals round them, a 1-pixel gap carrying the shadow;
# "borrow" names an original glyph whose shading they reuse pixel for pixel.
BIG = {
    'F': (['.#####', '##....', '######', '##....', '##....'], ('STBAR', 110, 23)),
    'R': (['#####.', '....##', '#####.', '##..##', '##..##'], ('STARMS', 13, 23)),
    'E': (['.#####', '##....', '######', '##....', '.#####'], ('STBAR', 63, 23)),
    'O': (['.#####.', '##...##', '##...##', '##...##', '.#####.'], ('STBAR', 210, 23)),
    'M': (['.#...#.', '###.###', '#######', '##.#.##', '##...##'], ('STBAR', 202, 23)),
    # Authored: D shares O's right side, squared on the left like E/F/R.
    'D': (['#####.', '##..##', '##..##', '##..##', '#####.'], None, ('STBAR', 31, 23)),
    # Authored: P keeps its full stem (R's notched stem reads as a 7 without the leg).
    'P': (['#####.', '##..##', '#####.', '##....', '##....'], None, ('STARMS', 13, 23)),
    # Authored: a 5-wide E (same rows as HEALTH's E) so FREED keeps a margin
    # inside the 40-pixel arms panel.
    'e': (['.####', '##...', '#####', '##...', '.####'], None, ('STBAR', 63, 23)),
    '(': (['.##', '##.', '##.', '##.', '.##'], None),
    ')': (['##.', '.##', '.##', '.##', '##.'], None),
}
SMALL = {
    'C': (['.###', '#...', '#...', '#...', '.###'], ('STBAR', 254, 23)),
    'S': (['.###', '#...', '.##.', '...#', '###.'], ('STBAR', 254, 11)),
    'R': (['###.', '#..#', '###.', '#..#', '#..#'], ('STBAR', 254, 17)),
    'E': (['###', '#..', '##.', '#..', '###'], ('STBAR', 264, 11)),
    'L': (['#..', '#..', '#..', '#..', '###'], ('STBAR', 264, 5)),
    # Authored to match: H's crossbar, E's arms, T's stem.
    'A': (['.##.', '#..#', '####', '#..#', '#..#'], None, ('STBAR', 259, 11)),
    'M': (['#...#', '##.##', '#.#.#', '#...#', '#...#'], None),
    'F': (['###', '#..', '##.', '#..', '#..'], None, ('STBAR', 264, 11)),
    'I': (['###', '.#.', '.#.', '.#.', '###'], None),
    'V': (['#.#', '#.#', '#.#', '#.#', '.#.'], None),
    # Authored for SCRN: H's stems with a diagonal between them.
    'N': (['#..#', '##.#', '#.##', '#..#', '#..#'], None, ('STBAR', 259, 11)),
}

# New labels. Row 0 is the body's top row in bar coordinates.
P_DOOM_LABEL = 'P(DOOM)'
FREED_LABEL = 'FREED'
FREED_GLYPHS = 'FReeD'  # narrow E twice
TALLY_LABELS = ['CAMS', 'FREE', 'SAFE', 'LIVE']  # replaces BULL, SHEL, RCKT, CELL
FACTORY_TALLY_LABELS = ['SCRN', 'FREE', 'SAFE', 'LIVE']  # MEG3N's factory: her live-feed screens
TALLY_ROWS = [5, 11, 17, 23]


def hash01(*values) -> int:
    h = 2166136261
    for v in values:
        h = ((h ^ (v & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


class Glyph:
    def __init__(self, mask: list[str], pixels: dict, small: bool):
        self.mask, self.small = mask, small
        self.w = len(mask[0])
        self.body = {(x, y) for y, line in enumerate(mask) for x, ch in enumerate(line) if ch == '#'}
        self.pixels = pixels  # (dx, dy) -> palette index for body and shadow


def shadow_offset(small: bool):
    return (1, 0) if small else (1, 1)


def build_glyph(ch: str, table: dict, small: bool, lumps: dict[str, Patch]) -> Glyph:
    mask, src, *rest = table[ch]
    borrow = rest[0] if rest else None  # authored glyph: reuse a source's shading
    body = {(x, y) for y, line in enumerate(mask) for x, c in enumerate(line) if c == '#'}
    sx, sy = shadow_offset(small)
    shadow = {(x + sx, y + sy) for x, y in body} - body
    pixels = {}
    source = lumps[src[0]] if src else None
    if source is not None:
        x0, y0 = src[1], src[2]
        found = {(x, y) for y in range(5) for x in range(len(mask[0]))
                 if source.get(x0 + x, y0 + y) in (TOP_ROW if y == 0 else {BODY_ROWS[y]})}
        if found != body:
            print(f'warning: {src[0]} glyph {ch!r} differs from expectation; synthesising', file=sys.stderr)
            source = None
    ref = src if source is not None else borrow
    ref_patch = lumps[ref[0]] if ref else None
    for (x, y) in body:
        c = ref_patch.get(ref[1] + x, ref[2] + y) if ref_patch else None
        pixels[(x, y)] = c if c in (TOP_ROW if y == 0 else {BODY_ROWS[y]}) else BODY_ROWS[y]
    for (x, y) in shadow:
        c = ref_patch.get(ref[1] + x, ref[2] + y) if ref_patch else None
        if c not in (111, 110, 109, 5, 6):
            c = SHADOWS[hash01(ord(ch), x, y, small) % len(SHADOWS)]
        pixels[(x, y)] = c
    return Glyph(mask, pixels, small)


def text_width(text: str, glyphs: dict[str, Glyph]) -> int:
    return sum(glyphs[c].w for c in text) + len(text) - 1


def draw_text(patch: Patch, text: str, x: int, y: int, glyphs: dict[str, Glyph]):
    """Compose body + shadow; a later glyph's body wins over an earlier shadow."""
    layer = {}
    body = set()
    cx = x
    for c in text:
        g = glyphs[c]
        for (dx, dy), color in g.pixels.items():
            at = (cx + dx, y + dy)
            if (dx, dy) in g.body:
                layer[at] = color
                body.add(at)
            elif at not in body:
                layer[at] = color
        cx += g.w + 1
    for (px, py), color in layer.items():
        patch.set(px, py, color)


def label_pixels(patch: Patch, x0: int, x1: int, rows: list[int], small: bool) -> set:
    """Body pixels of an existing label (row-specific grey) plus their shadows."""
    found = set()
    for top in rows:
        for r in range(5):
            allowed = TOP_ROW if r == 0 else {BODY_ROWS[r]}
            for x in range(x0, x1):
                if patch.get(x, top + r) in allowed:
                    found.add((x, top + r))
    sx, sy = shadow_offset(small)
    shadows = {(x + sx, y + sy) for x, y in found} - found
    return found | {(x, y) for x, y in shadows if patch.get(x, y) in (111, 110, 109, 5, 6)}


def erase(patch: Patch, pixels: set, clean_rows: range, seed: int):
    """Replace pixels with texture from clean rows of the same column."""
    original = patch.copy()
    for (x, y) in sorted(pixels):
        candidates = [r for r in clean_rows if (x, r) not in pixels]
        candidates.sort(key=lambda r: (abs(r - y), r))
        near = candidates[:6]
        if not near:
            continue
        patch.set(x, y, original.get(x, near[hash01(seed, x, y) % len(near)]))


# ------------------------------------------------------------- derived patches

def remap(patch: Patch, table: dict[int, int]) -> Patch:
    out = patch.copy()
    out.px = [[None if c is None else table.get(c, c) for c in row] for row in out.px]
    return out


# "Hot" big digits for an alarming p(DOOM): the red ramp (177..189) is lifted
# onto Doom's orange/yellow fire ramp; the dark outline (191) is kept.
HOT = {177: 231, 178: 230, 179: 229, 180: 228, 181: 227, 182: 214, 183: 215,
       184: 216, 185: 217, 186: 218, 187: 220, 188: 222, 189: 223, 44: 231, 45: 230, 47: 214}
# Lost prisoner: the small yellow digit in Doom red (shadow 191 unchanged).
RED_SMALL = {160: 176}


def refuge_marker(body: int) -> Patch:
    # A small cross in the STYSNUM style (4x6, 191 shadow right and below).
    rows = ['....',
            '.#..',
            '###.',
            '.#..',
            '....',
            '....']
    patch = Patch(4, 6)
    body_px = {(x, y) for y, line in enumerate(rows) for x, ch in enumerate(line) if ch == '#'}
    for (x, y) in body_px:
        patch.set(x, y, body)
    for (x, y) in body_px:
        for (sx, sy) in ((1, 0), (0, 1), (1, 1)):
            if (x + sx, y + sy) not in body_px and patch.get(x + sx, y + sy) is None:
                patch.set(x + sx, y + sy, 191)
    return patch


def wrench_icon() -> Patch:
    # A steel open-end wrench in the 7x7 cell of the skull keys (STKEYS3-5, no
    # offsets), on the diagonal so the jaw and handle read at 1x. Shaded like
    # the bar's metal: the top/left edge on the light end of the grey ramp, the
    # bottom/right edge darker, plus the 1-pixel drop shadow (right and below)
    # that the small digits use, so it separates from the grey key box.
    mask = ['....#.#',
            '....###',
            '...##..',
            '..##...',
            '.##....',
            '##.....',
            '#......']
    body = {(x, y) for y, line in enumerate(mask) for x, ch in enumerate(line) if ch == '#'}
    patch = Patch(8, 8)
    for (x, y) in body:
        if (x, y - 1) not in body or (x - 1, y) not in body:
            patch.set(x, y, 80)   # lit edge
        elif (x + 1, y) not in body or (x, y + 1) not in body:
            patch.set(x, y, 94)   # shaded edge
        else:
            patch.set(x, y, 86)
    for (x, y) in sorted(body):
        for dx, dy in ((1, 0), (0, 1), (1, 1)):
            if (x + dx, y + dy) not in body and patch.get(x + dx, y + dy) is None:
                patch.set(x + dx, y + dy, 5)
    return patch


def armor_icon(light: int, mid: int, dark: int) -> Patch:
    # A chest plate for the combat prologue's armor gauge (one per lit key box):
    # Doom's green-armor (112-127) or blue-armor (192-207) ramp, shaded and with
    # the same drop shadow as the wrench.
    mask = ['##...##',
            '###.###',
            '#######',
            '.#####.',
            '.#####.',
            '..###..']
    body = {(x, y) for y, line in enumerate(mask) for x, ch in enumerate(line) if ch == '#'}
    patch = Patch(8, 7)
    for (x, y) in body:
        if (x, y - 1) not in body or (x - 1, y) not in body:
            patch.set(x, y, light)
        elif (x + 1, y) not in body or (x, y + 1) not in body:
            patch.set(x, y, dark)
        else:
            patch.set(x, y, mid)
    for (x, y) in sorted(body):
        for dx, dy in ((1, 0), (0, 1), (1, 1)):
            if (x + dx, y + dy) not in body and patch.get(x + dx, y + dy) is None:
                patch.set(x + dx, y + dy, 5)
    return patch


def charge_icon() -> Patch:
    # Keycard-sized demolition charge: the red card body of STKEYS2 with two
    # dark straps and a lit fuse (Doom's yellow/white fire indices).
    legend = {'.': None, 'r': 176, 's': 179, 't': 184, 'u': 187, 'k': 0, 'y': 231, 'w': 168, 'o': 215}
    rows = ['.rr.rrw',
            'rskssyo',
            'ssksso.',
            'utkttu.',
            '.uuuuu.']
    return from_rows(rows, legend, 0, -1)


# ----------------------------------------------------------------- face sets

def png_size(path: Path):
    with Image.open(path) as img:
        return img.size


def read_face_offsets(set_dir: Path) -> dict:
    """Offsets from the face builder's manifest (per set, the CEO sets' own, else shared)."""
    data = None
    for path in (set_dir / 'manifest.json', set_dir.parent / 'ceo-manifest.json', set_dir.parent / 'manifest.json'):
        if not path.is_file():
            continue
        try:
            candidate = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if path.name == 'ceo-manifest.json' and set_dir.name not in (candidate.get('ids') or []):
            continue
        data = candidate
        break
    if data is None:
        return {}
    table = data.get('lumps') or data.get('faces') or data.get('patches') or data
    out = {}
    if isinstance(table, dict):
        for name, meta in table.items():
            if not isinstance(meta, dict):
                continue
            pick = lambda *keys: next((meta[k] for k in keys if isinstance(meta.get(k), (int, float))), None)
            x = pick('x', 'left', 'leftoffset', 'left_offset', 'ox')
            y = pick('y', 'top', 'topoffset', 'top_offset', 'oy')
            if x is None and isinstance(meta.get('offset'), list) and len(meta['offset']) == 2:
                x, y = meta['offset']
            if x is not None and y is not None:
                out[name.upper()] = (int(x), int(y))
    return out


def discover_face_sets(original: dict[str, Patch]) -> dict:
    sets = {}
    for face_id in FACE_SETS + CEO_FACE_SETS:
        set_dir = FACES_DIR / face_id
        if not set_dir.is_dir():
            continue
        offsets = read_face_offsets(set_dir)
        lumps = {}
        for name in FACE_LUMPS:
            path = set_dir / f'{name}.png'
            if not path.is_file():
                continue
            w, h = png_size(path)
            ref = original[name]
            if name in offsets:
                x, y = offsets[name]
            elif (w, h) == (ref.w, ref.h):
                x, y = ref.left, ref.top
            else:
                # Unknown framing: centre in the face window (x 143..177) and
                # stand it on the bar's bottom edge like the original faces.
                x = 143 - (144 + (33 - w) // 2)
                y = -(31 - h)
            lumps[name] = {'w': w, 'h': h, 'x': x, 'y': y}
        if lumps:
            sets[face_id] = {'path': f'local/ui/faces/{face_id}/', 'lumps': lumps}
    return sets


# ---------------------------------------------------------------------- build

def main():
    if not WAD.is_file():
        raise SystemExit(f'Missing {WAD.relative_to(ROOT)}; supply your registered DOOM.WAD first.')
    raw = load_wad(WAD)
    palette = [tuple(raw['PLAYPAL'][i * 3:i * 3 + 3]) for i in range(256)]
    missing = [name for name in STATUS_LUMPS if name not in raw]
    if missing:
        raise SystemExit('DOOM.WAD lacks status bar lumps: ' + ', '.join(missing))
    patches = {name: Patch.decode(raw[name]) for name in STATUS_LUMPS}
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = {'version': 1, 'source': 'local DOOM.WAD (git-ignored, generated by scripts/build-doom-statusbar.py)',
                'size': [320, 32], 'lumps': {}}

    def save(name: str, patch: Patch):
        patch.image(palette).save(OUT / f'{name}.png', optimize=True)
        manifest['lumps'][name] = {'w': patch.w, 'h': patch.h, 'x': patch.left, 'y': patch.top}

    for name in STATUS_LUMPS:
        save(name, patches[name])

    big = {c: build_glyph(c, BIG, False, patches) for c in BIG}
    small = {c: build_glyph(c, SMALL, True, patches) for c in SMALL}

    # PDBAR: ARMOR -> P(DOOM), BULL/SHEL/RCKT/CELL -> our tallies.
    bar = patches['STBAR'].copy()
    armor = label_pixels(bar, 186, 228, [23], False)
    erase(bar, armor, range(3, 31), 1)
    width = text_width(P_DOOM_LABEL, big)
    draw_text(bar, P_DOOM_LABEL, 179 + (56 - width) // 2, 23, big)
    table = label_pixels(bar, 252, 276, TALLY_ROWS, True)
    erase(bar, table, range(1, 31), 2)
    clean = bar.copy()
    for text, y in zip(TALLY_LABELS, TALLY_ROWS):
        draw_text(bar, text, 254, y, small)
    save('PDBAR', bar)
    # PDFBAR: MEG3N's factory counts her screens where the other levels count cameras.
    for text, y in zip(FACTORY_TALLY_LABELS, TALLY_ROWS):
        draw_text(clean, text, 254, y, small)
    save('PDFBAR', clean)

    # PDWBAR: the combat prologue keeps vanilla AMMO / ARMS / BULL SHEL RCKT CELL;
    # only ARMOR becomes P(DOOM).
    war = patches['STBAR'].copy()
    armor = label_pixels(war, 186, 228, [23], False)
    erase(war, armor, range(3, 31), 1)
    width = text_width(P_DOOM_LABEL, big)
    draw_text(war, P_DOOM_LABEL, 179 + (56 - width) // 2, 23, big)
    save('PDWBAR', war)

    # PDARMS: ARMS -> FREED, centred on the panel's interior (columns 3..37).
    arms = patches['STARMS'].copy()
    old = label_pixels(arms, 3, 38, [23], False)
    erase(arms, old, [21, 22, 29, 30], 3)
    width = text_width(FREED_GLYPHS, big)
    draw_text(arms, FREED_GLYPHS, 3 + (35 - (width + 1)) // 2, 23, big)  # body + shadow centred
    save('PDARMS', arms)

    for i in range(10):
        save(f'PDHNUM{i}', remap(patches[f'STTNUM{i}'], HOT))
        save(f'PDRSNUM{i}', remap(patches[f'STYSNUM{i}'], RED_SMALL))
    save('PDHPRCNT', remap(patches['STTPRCNT'], HOT))
    save('PDREFUG0', refuge_marker(96))   # refuge known (grey, like STGNUM)
    save('PDREFUG1', refuge_marker(160))  # you are inside it (yellow, like STYSNUM)
    save('PDWRENCH', wrench_icon())
    save('PDCHARGE', charge_icon())
    save('PDARMG', armor_icon(112, 118, 124))
    save('PDARMB', armor_icon(196, 200, 204))

    original_faces = {name: patches[name] for name in FACE_LUMPS}
    manifest['faces'] = {'doomguy': {'path': 'local/ui/stbar/',
                                     'lumps': {n: manifest['lumps'][n] for n in FACE_LUMPS}}}
    manifest['faces'].update(discover_face_sets(original_faces))
    manifest['faceSets'] = FACE_SETS
    manifest['ceoFaceSets'] = [c for c in CEO_FACE_SETS if c in manifest['faces']]
    manifest['labels'] = {'ammo': 'AMMO', 'health': 'HEALTH', 'arms': FREED_LABEL,
                          'armor': P_DOOM_LABEL, 'table': TALLY_LABELS, 'factoryTable': FACTORY_TALLY_LABELS}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')

    # Preview: original STBAR + STARMS at 4x above ours at 4x.
    def composed(bg: Patch, overlay: Patch):
        img = bg.image(palette)
        img.alpha_composite(overlay.image(palette), (104, 0))
        return img.resize((1280, 128), Image.NEAREST)

    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (1280, 128 * 2 + 16), (9, 10, 8, 255))
    sheet.alpha_composite(composed(patches['STBAR'], patches['STARMS']), (0, 0))
    sheet.alpha_composite(composed(bar, arms), (0, 144))
    sheet.save(PREVIEW, optimize=True)
    faces = ', '.join(f'{k} ({len(v["lumps"])})' for k, v in manifest['faces'].items())
    print(f'Wrote {len(manifest["lumps"])} patches to {OUT.relative_to(ROOT)}; faces: {faces}')
    print(f'Preview: {PREVIEW.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
