#!/usr/bin/env python3
"""Render the p(DOOM) opening story cut-scene as two MP4s (one per playable CEO).

Everything is drawn programmatically at Doom's native 320x200, 35 fps, as 8-bit
PLAYPAL indices (fades use COLORMAP, flashes use PLAYPAL's own pain/bonus
palettes), then upscaled exactly 4x nearest-neighbour to 1280x800 and encoded
as H.264 + AAC.  Art and sound come from the locally supplied, git-ignored
DOOM.WAD plus the game's own sprites, so the outputs live under the git-ignored
doom-web/local/ tree and this script is the source of truth.

    python3 scripts/build-intro-cutscene.py                    # both CEOs
    python3 scripts/build-intro-cutscene.py --ceo mario        # just one
    python3 scripts/build-intro-cutscene.py --faces samwise=altman --faces mario=amodei
    python3 scripts/build-intro-cutscene.py --preview          # review sheets only, no encode
    python3 scripts/build-intro-cutscene.py --format vertical  # 1080x1920 9:16 social cuts (or --format all)

Outputs
    doom-web/local/intro/intro-<ceo>.mp4, intro-<ceo>-poster.png, manifest.json
    output/intro/keyframes-<ceo>.png  (2 frames per scene) and captions-<ceo>.png
    --format vertical: doom-web/local/intro/social/pdoom-intro-<ceo>-vertical.mp4 (+ -cover.png,
    social/manifest.json) and output/intro/{keyframes,captions,safezones}-<ceo>-vertical.png
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import struct
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
LOCAL = ROOT / 'doom-web' / 'local'
WAD_PATH = LOCAL / 'DOOM.WAD'
OUT_DIR = LOCAL / 'intro'
REVIEW_DIR = ROOT / 'output' / 'intro'
SCRATCH = Path('/tmp/pdoom-intro')

W, H, FPS, UP, SR = 320, 200, 35, 4, 44100
FACE_DIR = LOCAL / 'ui' / 'faces'
FACE_FALLBACK = {'samwise': 'altman', 'mario': 'amodei'}


def tic(sec):
    return int(round(sec * FPS))


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def smooth(u):
    u = clamp(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


# ============================================================================ WAD

def load_doom_art():
    """Reuse scripts/doom-art.py for the WAD directory and TEXTURE1/PNAMES parsing."""
    spec = importlib.util.spec_from_file_location('doom_art', ROOT / 'scripts' / 'doom-art.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.DoomArt(WAD_PATH)


class Gfx:
    """An indexed (PLAYPAL) image with a transparency mask and Doom-style offsets."""

    def __init__(self, idx, mask=None, ox=0, oy=0):
        self.idx = np.ascontiguousarray(idx, np.uint8)
        self.mask = np.ones(self.idx.shape, bool) if mask is None else np.ascontiguousarray(mask, bool)
        self.ox, self.oy = int(ox), int(oy)

    @property
    def w(self):
        return self.idx.shape[1]

    @property
    def h(self):
        return self.idx.shape[0]

    def scaled(self, k):
        if k == 1:
            return self
        rep = lambda a: np.repeat(np.repeat(a, k, 0), k, 1)
        return Gfx(rep(self.idx), rep(self.mask), self.ox * k, self.oy * k)

    def resized(self, w, h):
        ys = (np.arange(h) * self.h / h).astype(int)
        xs = (np.arange(w) * self.w / w).astype(int)
        return Gfx(self.idx[ys][:, xs], self.mask[ys][:, xs], round(self.ox * w / self.w), round(self.oy * h / self.h))

    def flipped(self):
        return Gfx(self.idx[:, ::-1], self.mask[:, ::-1], self.w - self.ox, self.oy)

    def mapped(self, table):
        return Gfx(table[self.idx], self.mask, self.ox, self.oy)

    def solid(self, c):
        return Gfx(np.full_like(self.idx, c), self.mask, self.ox, self.oy)

    def crop(self, x0, y0, x1, y1):
        return Gfx(self.idx[y0:y1, x0:x1], self.mask[y0:y1, x0:x1], self.ox - x0, self.oy - y0)


def blit(fb, g, x, y, offsets=True):
    if offsets:
        x -= g.ox
        y -= g.oy
    x, y = int(x), int(y)
    hh, ww = fb.shape
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + g.w, ww), min(y + g.h, hh)
    if x1 <= x0 or y1 <= y0:
        return
    m = g.mask[y0 - y:y1 - y, x0 - x:x1 - x]
    dst = fb[y0:y1, x0:x1]
    dst[m] = g.idx[y0 - y:y1 - y, x0 - x:x1 - x][m]


def remap(fb, x0, y0, x1, y1, table):
    hh, ww = fb.shape
    x0, y0, x1, y1 = max(int(x0), 0), max(int(y0), 0), min(int(x1), ww), min(int(y1), hh)
    if x1 > x0 and y1 > y0:
        fb[y0:y1, x0:x1] = table[fb[y0:y1, x0:x1]]


def rect(fb, x0, y0, x1, y1, c):
    hh, ww = fb.shape
    x0, y0, x1, y1 = max(int(x0), 0), max(int(y0), 0), min(int(x1), ww), min(int(y1), hh)
    if x1 > x0 and y1 > y0:
        fb[y0:y1, x0:x1] = c


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


class Palette:
    def __init__(self, lumps):
        pp = np.frombuffer(lumps['PLAYPAL'], np.uint8)
        self.pals = pp[:(len(pp) // 768) * 768].reshape(-1, 256, 3).copy()
        self.rgb = self.pals[0].astype(np.float32)
        self.cmap = np.frombuffer(lumps['COLORMAP'], np.uint8)[:34 * 256].reshape(34, 256).copy()
        self.ok = np.ones(256, bool)
        self.ok[250:255] = False          # the magenta/purple run never reads as "Doom"
        self._cache = {}

    def near(self, rgb, allowed=None):
        a = np.asarray(rgb, np.float32)
        shape = a.shape[:-1]
        q = np.clip(np.rint(a.reshape(-1, 3)), 0, 255).astype(np.int64)
        key = (q[:, 0] << 16) | (q[:, 1] << 8) | q[:, 2]
        uk, inv = np.unique(key, return_inverse=True)
        u = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], 1).astype(np.float32)
        cand = np.nonzero(self.ok if allowed is None else allowed)[0]
        P = self.rgb[cand]
        out = np.empty(len(u), np.uint8)
        for s in range(0, len(u), 2048):
            c = u[s:s + 2048]
            rm = (c[:, None, 0] + P[None, :, 0]) / 2
            d = c[:, None, :] - P[None, :, :]
            dist = (2 + rm / 256) * d[..., 0] ** 2 + 4 * d[..., 1] ** 2 + (2 + (255 - rm) / 256) * d[..., 2] ** 2
            out[s:s + 2048] = cand[np.argmin(dist, 1)]
        return out[inv.reshape(-1)].reshape(shape)

    def idx(self, r, g, b):
        return int(self.near(np.array([[r, g, b]], np.float32))[0])

    def toward(self, rgb, k, n=16):
        """Table that moves every colour k/n of the way to `rgb` (white flash, glows)."""
        key = (tuple(rgb), k, n)
        if key not in self._cache:
            a = k / n
            self._cache[key] = self.near(self.rgb * (1 - a) + np.array(rgb, np.float32) * a)
        return self._cache[key]

    def white(self, k, n=16):
        return self.toward((255, 255, 255), k, n)


class Wad:
    def __init__(self):
        self.art = load_doom_art()
        self.L = self.art.lumps
        self.pal = Palette(self.L)
        self._tex = {}

    def patch(self, name):
        d = self.L[name.upper()]
        w, h, lo, to = struct.unpack_from('<HHhh', d)
        idx = np.zeros((h, w), np.uint8)
        mask = np.zeros((h, w), bool)
        for x, pos in enumerate(struct.unpack_from('<%dI' % w, d, 8)):
            while d[pos] != 255:
                top, n = d[pos], d[pos + 1]
                px = np.frombuffer(d, np.uint8, n, pos + 3)
                k = max(0, min(n, h - top))
                idx[top:top + k, x] = px[:k]
                mask[top:top + k, x] = True
                pos += n + 4
        return Gfx(idx, mask, lo, to)

    def texture(self, name):
        if name not in self._tex:
            w, h, patches = self.art.textures[name]
            idx = np.zeros((h, w), np.uint8)
            mask = np.zeros((h, w), bool)
            for ox, oy, pi in patches:
                p = self.patch(self.art.names[pi])
                x0, y0, x1, y1 = max(ox, 0), max(oy, 0), min(ox + p.w, w), min(oy + p.h, h)
                if x1 <= x0 or y1 <= y0:
                    continue
                m = p.mask[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
                idx[y0:y1, x0:x1][m] = p.idx[y0 - oy:y1 - oy, x0 - ox:x1 - ox][m]
                mask[y0:y1, x0:x1] |= m
            self._tex[name] = Gfx(idx, mask)
        return self._tex[name]

    def flat(self, name):
        return np.frombuffer(self.L[name], np.uint8, 4096).reshape(64, 64).copy()

    def sound(self, name, pitch=1.0):
        return dmx_to_float(self.L[name.upper()], pitch)


def dmx_to_float(d, pitch=1.0):
    fmt, rate, n = struct.unpack_from('<HHI', d)
    raw = np.frombuffer(d, np.uint8, min(n, len(d) - 8), 8).astype(np.float32)
    if len(raw) > 64:
        raw = raw[16:-16]                 # DMX pads 16 bytes either side
    x = (raw - 128.0) / 128.0
    return resample(x, rate * pitch)


def resample(x, rate):
    n = int(len(x) * SR / rate)
    t = np.arange(n) * (rate / SR)
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)


def png_grab(path):
    b = Path(path).read_bytes()
    i = 8
    while i + 8 <= len(b):
        ln = struct.unpack('>I', b[i:i + 4])[0]
        if b[i + 4:i + 8] == b'grAb':
            return struct.unpack('>ii', b[i + 8:i + 16])
        i += 12 + ln
    return None


def title_logo():
    """Logo option D1: a clean math-italic p( ) around the untouched M_DOOM
    lettering (STIX, the math font, with a hard 2-px drop shadow)."""
    from PIL import ImageDraw, ImageFont
    fonts = Path('/System/Library/Fonts/Supplemental')
    spec = importlib.util.spec_from_file_location('doom_art', ROOT / 'scripts' / 'doom-art.py')
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    doom = mod.DoomArt(LOCAL / 'DOOM.WAD').patch('M_DOOM')

    def glyph(ch, font, size):
        f = ImageFont.truetype(str(fonts / font), size)
        box = f.getbbox(ch)
        im = Image.new('1', (box[2] - box[0] + 8, box[3] - box[1] + 8), 0)
        d = ImageDraw.Draw(im); d.fontmode = '1'
        d.text((4 - box[0], 4 - box[1]), ch, font=f, fill=1)
        return im.crop(im.getbbox())

    def ink(g, color=(236, 228, 208)):
        im = Image.new('RGBA', (g.width + 2, g.height + 2)); px = im.load(); a = g.load()
        for y in range(g.height):
            for x in range(g.width):
                if a[x, y]:
                    px[x + 2, y + 2] = (0, 0, 0, 255)
        for y in range(g.height):
            for x in range(g.width):
                if a[x, y]:
                    px[x, y] = (*color, 255)
        return im

    p = ink(glyph('p', 'STIXGeneralItalic.otf', 60))
    lp, rp = ink(glyph('(', 'STIXGeneral.otf', 84)), ink(glyph(')', 'STIXGeneral.otf', 84))
    x, parts = 2, []
    parts.append((p, x, 26)); x += p.width + 2
    parts.append((lp, x, 4)); x += lp.width + 6
    parts.append((doom, x, 12)); x += doom.width + 5
    parts.append((rp, x, 4)); x += rp.width
    logo = Image.new('RGBA', (x + 4, 96))
    for im, px_, py in parts:
        logo.alpha_composite(im, (px_, py))
    logo = logo.crop(logo.getbbox())
    path = LOCAL / 'intro' / 'title-logo.png'
    path.parent.mkdir(parents=True, exist_ok=True)
    logo.save(path)
    return path


def load_png(pal, path, offsets=None):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    mask = a[..., 3] >= 128
    idx = np.zeros(mask.shape, np.uint8)
    if mask.any():
        idx[mask] = pal.near(a[..., :3][mask])
    g = png_grab(path) if offsets is None else offsets
    return Gfx(idx, mask, *(g or (0, 0)))


# ============================================================================ font + captions

class Font:
    """Doom's HUD/finale font (STCFN) with Boom-style colour translations."""

    def __init__(self, wad):
        pal = wad.pal
        self.g = {chr(c): wad.patch('STCFN%03d' % c) for c in range(33, 96)}
        self.g['p'] = self.lower_p()                       # STCFN has no lower case; draw "p" for "p(DOOM)" in its style
        used = sorted(set(np.concatenate([g.idx[g.mask] for g in self.g.values()]).tolist()))
        self.trans = {'red': np.arange(256, dtype=np.uint8)}
        for name, col, lo in [('white', (255, 255, 255), 0.62), ('gold', (255, 214, 90), 0.55),
                              ('grey', (150, 150, 150), 0.6), ('yellow', (255, 255, 120), 0.6)]:
            t = np.arange(256, dtype=np.uint8)
            for u in used:
                r = pal.rgb[u][0]
                if r <= 118:
                    t[u] = 0                                  # built-in outline -> black
                else:
                    f = lo + (1 - lo) * (r - 127) / 128
                    t[u] = pal.idx(*(np.array(col, np.float32) * f))
            self.trans[name] = t

    @staticmethod
    def lower_p():
        rows = ['OOOOOO.',
                'OFFFFFO',
                'OFFOOFO',
                'OFFFFFO',
                'OFFOOO.',
                'OFFO...',
                'OOOO...']
        fill = [178, 178, 179, 181, 183, 185, 185]
        idx = np.zeros((len(rows), 7), np.uint8)
        mask = np.zeros(idx.shape, bool)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    idx[y, x] = 191 if ch == 'O' else fill[y]
                    mask[y, x] = True
        return Gfx(idx, mask, 0, -2)

    def glyph(self, ch):
        return self.g.get(ch) or self.g.get(ch.upper())

    def width(self, s, scale=1):
        return scale * sum(4 if (ch == ' ' or self.glyph(ch) is None) else self.glyph(ch).w for ch in s)

    def draw(self, fb, s, x, y, color='white', shadow=True, scale=1, count=None, table=None):
        tr = self.trans[color] if table is None else table
        placed = []
        cx = x
        for i, ch in enumerate(s):
            g = self.glyph(ch)
            if ch == ' ' or g is None:
                cx += 4 * scale
                continue
            if count is None or i < count:
                placed.append((g.scaled(scale), cx))
            cx += g.w * scale
        if shadow:
            for g, gx in placed:
                blit(fb, g.solid(0), gx + scale, y + scale)
        for g, gx in placed:
            blit(fb, g.mapped(tr), gx, y)
        return cx


class Caption:
    """Doom-finale-style type-on caption.  segments: [(t, text)], where t is an
    absolute time in seconds or '+pause' (seconds after the previous segment
    finished typing).  Lines are broken explicitly with '\\n'.

    Optional (vertical cut): cps (typing speed), read_cps/read_pad (exposure =
    read once at read_cps + read_pad), cx/bottom (anchor inside a safe area),
    colors=[(char_index, colour), ...] for multi-colour cards, accent (a red bar
    on the plate's left edge, lower-third style)."""

    CPS = 35.0                         # one character per tic

    def __init__(self, segments, end=None, where='bottom', color='white', scale=1, y=None, plate=True, manifest=True,
                 hidden=False, cps=None, read_cps=None, read_pad=0.8, cx=None, bottom=None, colors=None, accent=False,
                 max_chars=36, grow_plate=False):
        cps = cps or self.CPS
        times, t = [], None
        text = ''
        for when, s in segments:
            if isinstance(when, str):
                start = t + float(when)
            else:
                start = when if t is None else max(when, t)
            t = start
            for ch in s:
                times.append(t)
                if ch not in ' \n':
                    t += 1.0 / cps
            text += s
        self.text, self.char_t, self.typed = text, times, t
        self.start = times[0]
        self.lines = text.split('\n')
        n = len(' '.join(l.strip() for l in text.split('\n')))
        if end is not None:
            self.end = end
        elif read_cps:
            # readable once at read_cps plus read_pad, and >= read_pad after the last letter lands
            self.end = max(self.typed + read_pad, self.start + n / read_cps + read_pad)
        else:
            # on screen long enough to read twice at 19.5 chars/s, and >= 2 s after the last letter lands
            self.end = max(self.typed + 2.0, self.start + 2 * n / 19.5)
        self.where, self.color, self.scale, self.y, self.plate, self.manifest = where, color, scale, y, plate, manifest
        self.hidden = hidden
        self.cx, self.bottom, self.colors, self.accent, self.grow_plate = cx, bottom, colors, accent, grow_plate
        self.block_h = 11 * scale * len(self.lines) - 3 * scale
        for line in self.lines:
            assert len(line) <= max_chars, line

    @property
    def top(self):
        return self.bottom - self.block_h if self.bottom is not None else self.y

    def plain(self):
        return ' '.join(l.strip() for l in self.lines)

    def draw(self, fb, t, font, pal):
        if self.hidden or not (self.start <= t < self.end):
            return
        HH, WW = fb.shape
        sc = self.scale
        lh = 11 * sc
        widths = [font.width(l, sc) for l in self.lines]
        block_h = self.block_h
        if self.bottom is not None:
            top = self.bottom - block_h
        elif self.y is not None:
            top = self.y
        elif self.where == 'top':
            top = 7
        else:
            top = HH - 7 - block_h
        cx2 = WW if self.cx is None else 2 * self.cx          # line x = (cx2 - width) // 2
        left_edge = (cx2 - max(widths)) // 2
        fade = clamp((self.end - t) * FPS / 5.0, 0.0, 1.0)     # last 5 tics fade through COLORMAP
        if self.plate:
            pad_x, pad_y = (6, 4) if sc == 1 else (7, 5)
            level = int(round(4 + 20 * fade))
            px0, px1, ph = left_edge, left_edge + max(widths), block_h
            if self.grow_plate:                       # the plate grows with the lines that have started typing
                started, k = [], 0
                for li, line in enumerate(self.lines):
                    if line and self.char_t[k] <= t:
                        started.append(li)
                    k += len(line) + 1
                if not started:
                    started = [0]
                n_on = started[-1] + 1
                ws = [widths[i] for i in range(n_on)]
                px0, px1, ph = (cx2 - max(ws)) // 2, (cx2 - max(ws)) // 2 + max(ws), lh * n_on - 3 * sc
            remap(fb, px0 - pad_x, top - pad_y, px1 + pad_x, top + ph + pad_y + 1, pal.cmap[level])
            if self.accent:
                rect(fb, px0 - pad_x, top - pad_y, px0 - pad_x + 3, top + ph + pad_y + 1, pal.cmap[int(round((1 - fade) * 24))][176])
        def table_for(color):
            tb = font.trans[color]
            return pal.cmap[int(round((1 - fade) * 24))][tb] if fade < 1 else tb
        k = 0
        for li, line in enumerate(self.lines):
            x = (cx2 - widths[li]) // 2
            count = 0
            k0 = k
            for ch in line:
                if self.char_t[k] <= t:
                    count += 1
                k += 1
            k += 1                                     # the '\n'
            if not self.colors:
                font.draw(fb, line, x, top + li * lh, scale=sc, count=count, table=table_for(self.color))
                continue
            # multi-colour: draw runs
            def colour_at(ix):
                c = self.color
                for (start, col) in self.colors:
                    if ix >= start:
                        c = col
                return c
            i = 0
            gx = x
            while i < len(line):
                col = colour_at(k0 + i)
                j = i
                while j < len(line) and colour_at(k0 + j) == col:
                    j += 1
                run = line[i:j]
                font.draw(fb, run, gx, top + li * lh, scale=sc, count=max(0, min(len(run), count - i)), table=table_for(col))
                gx += font.width(run, sc)
                i = j


def rewrap(segments, font, max_w, scale=1):
    """Re-break a caption's segments (keeping their timing) so no line is wider
    than max_w pixels at `scale`."""
    segs = [(w, s.replace('\n', ' ')) for w, s in segments]
    full = ''.join(s for _, s in segs)
    out = list(full)
    line_start = 0
    last_space = None
    i = 0
    while i < len(out):
        if out[i] == ' ':
            if font.width(''.join(out[line_start:i]).strip(), scale) > max_w and last_space is not None:
                out[last_space] = '\n'
                line_start = last_space + 1
                last_space = None
                continue
            last_space = i
        i += 1
    if font.width(''.join(out[line_start:]).strip(), scale) > max_w and last_space is not None:
        out[last_space] = '\n'
    res, pos = [], 0
    for w, s in segs:
        res.append((w, ''.join(out[pos:pos + len(s)])))
        pos += len(s)
    return res



# ============================================================================ audio synthesis

def env_exp(n, rate):
    return np.exp(-np.arange(n) / SR * rate).astype(np.float32)


def butter(x, kind, f, order=2):
    b, a = signal.butter(order, f, btype=kind, fs=SR)
    return signal.lfilter(b, a, x).astype(np.float32)


def noise(n, rng):
    return rng.uniform(-1, 1, n).astype(np.float32)


def sine_sweep(f0, f1, dur, decay):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * decay)).astype(np.float32)


def ks_pluck(freq, dur, rng, decay=0.995):
    n = int(dur * SR)
    P = max(2, int(round(SR / freq)))
    out = np.zeros(n + P + 1, np.float32)
    seed = noise(P, rng)
    seed = (seed + np.roll(seed, 1)) * 0.5
    out[1:P + 1] = seed
    i = P + 1
    while i < len(out):
        m = min(P, len(out) - i)
        out[i:i + m] = decay * 0.5 * (out[i - P:i - P + m] + out[i - P - 1:i - P - 1 + m])
        i += m
    y = out[1:n + 1]
    return y * np.minimum(1, np.arange(n) / (0.002 * SR))


def fm_bell(freq, dur, ratio=3.5, index=2.2, decay=3.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = index * np.exp(-t * 8) * np.sin(2 * np.pi * freq * ratio * t)
    return (np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * decay) * np.minimum(1, t / 0.003)).astype(np.float32)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, start, x, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i < 0:
        x = x[-i:]
        i = 0
    if i >= len(buf):
        return
    x = x[:len(buf) - i]
    if x.ndim == 1:
        a = (pan + 1) * math.pi / 4
        buf[i:i + len(x), 0] += x * gain * math.cos(a) * 1.414
        buf[i:i + len(x), 1] += x * gain * math.sin(a) * 1.414
    else:
        buf[i:i + len(x)] += x * gain


def influencer_jingle(dur, bpm=124, seed=5):
    """Cheesy upbeat 'link in bio' jingle: ukulele strums, claps, bouncy bass,
    a whistled hook doubled by glockenspiel.  C - G - Am - F, obviously."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    e8 = beat / 2
    bar = beat * 4
    n = int(dur * SR) + SR
    out = np.zeros((n, 2), np.float32)
    chords = [[60, 64, 67, 72], [62, 67, 71, 74], [60, 64, 69, 72], [60, 65, 69, 72]]
    roots = [48, 43, 45, 41]
    melody = [
        (0, 0, 76, 1), (0, 1, 79, 1), (0, 2, 81, 2), (0, 4, 79, 2), (0, 6, 76, 1), (0, 7, 74, 1),
        (1, 0, 74, 2), (1, 2, 71, 1), (1, 3, 74, 1), (1, 4, 79, 3),
        (2, 0, 72, 1), (2, 1, 76, 1), (2, 2, 81, 2), (2, 4, 79, 1), (2, 5, 76, 1), (2, 6, 79, 2),
        (3, 0, 81, 3), (3, 3, 79, 1), (3, 4, 77, 1), (3, 5, 76, 1), (3, 6, 74, 1), (3, 7, 72, 1),
        (4, 0, 76, 2), (4, 2, 79, 2), (4, 4, 84, 4),
    ]
    nbars = int(dur / bar) + 2
    # sparkle intro: glock arpeggio
    for k, m in enumerate([72, 76, 79, 84]):
        place(out, k * e8 / 2, fm_bell(midi(m + 12), 0.8), 0.10, 0.3)
    for b in range(nbars):
        t0 = b * bar
        ch = chords[b % 4]
        for step, down in [(0, 1), (2, 1), (3, 0), (5, 0), (6, 1), (7, 0)]:
            ts = t0 + step * e8
            order = ch if down else ch[::-1]
            for k, m in enumerate(order):
                place(out, ts + k * 0.011, ks_pluck(midi(m), 0.7, rng, 0.994), 0.20 if down else 0.13, -0.25)
        for step in range(8):
            ts = t0 + step * e8
            m = roots[b % 4] + (12 if step in (3, 7) else 0)
            nb = int(e8 * 0.9 * SR)
            tt = np.arange(nb) / SR
            f = midi(m)
            x = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 7) * np.minimum(1, tt / 0.004)
            place(out, ts, x.astype(np.float32), 0.30)
            if step % 2 == 0:
                place(out, ts, sine_sweep(160, 48, 0.22, 11), 0.40)            # kick
            else:
                hat = butter(noise(int(0.035 * SR), rng), 'high', 7000) * env_exp(int(0.035 * SR), 120)
                place(out, ts, hat, 0.20, 0.35)
            if step in (2, 6):                                                    # clap
                cl = np.zeros(int(0.16 * SR), np.float32)
                for k in range(3):
                    s = int(k * 0.009 * SR)
                    burst = noise(len(cl) - s, rng) * env_exp(len(cl) - s, 60 if k < 2 else 22)
                    cl[s:] += burst
                cl = butter(cl, 'band', [900, 2600])
                place(out, ts, cl, 0.55, 0.1)
        want = b if b < 5 else 1 + (b - 5) % 4
        for (mb, step, m, ln) in melody:
            if mb != want:
                continue
            ts = t0 + step * e8
            nd = int((ln * e8 - 0.02) * SR)
            tt = np.arange(nd) / SR
            vib = 1 + 0.007 * np.sin(2 * np.pi * 5.6 * tt) * np.minimum(1, tt / 0.12)
            ph = 2 * np.pi * np.cumsum(midi(m) * vib) / SR
            amp = np.minimum(1, tt / 0.02) * np.minimum(1, (tt[-1] - tt) / 0.05 + 1e-3)
            breath = butter(noise(nd, rng), 'band', [min(midi(m) * 1.6, 9000), min(midi(m) * 2.6, 15000)]) * 0.06
            place(out, ts, ((np.sin(ph) + breath) * amp).astype(np.float32), 0.22, 0.15)
            place(out, ts, fm_bell(midi(m + 12), 0.5), 0.07, 0.35)
    return out[:int(dur * SR)]


def crt_power_on(rng):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    thump = sine_sweep(110, 38, 0.5, 7)
    stat = butter(noise(n, rng), 'band', [1500, 7000]) * np.exp(-t * 5) * 0.5
    whine = np.sin(2 * np.pi * 7800 * t) * 0.05 * np.exp(-t * 1.2)
    x = stat + whine
    x[:len(thump)] += thump
    return x.astype(np.float32)


def blip(freq, dur=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t * 55) * np.minimum(1, t / 0.002)).astype(np.float32)


def cricket(rng):
    """Two chirps of a (synthetic) cricket: the universal sound of an awkward silence."""
    out = np.zeros(int(1.1 * SR), np.float32)
    for c0 in (0.0, 0.55):
        for k in range(3):
            s = int((c0 + k * 0.045) * SR)
            nn = int(0.03 * SR)
            t = np.arange(nn) / SR
            out[s:s + nn] += np.sin(2 * np.pi * 4600 * t) * np.sin(np.pi * t / 0.03) ** 2 * (1 + 0.3 * np.sin(2 * np.pi * 180 * t))
    return out


def polite_chime():
    out = np.zeros(int(1.6 * SR), np.float32)
    a = fm_bell(midi(88), 1.2, 2.0, 1.0, 2.6)
    b = fm_bell(midi(84), 1.4, 2.0, 1.0, 2.2)
    out[:len(a)] += a
    s = int(0.32 * SR)
    out[s:s + len(b)] += b[:len(out) - s]
    return out


def hum(dur, rng):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * 60 * h * t) / h for h in (1, 2, 3, 5)) * 0.5
    x += butter(noise(n, rng), 'band', [180, 900]) * 0.25
    ramp = np.minimum(1, t / (dur * 0.85)) ** 1.5
    return (x * ramp * np.minimum(1, (dur - t) / 0.3)).astype(np.float32)


def servo(rng, dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 380 + 160 * t / dur
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(ph) * 0.4 + butter(noise(n, rng), 'band', [2000, 5000]) * 0.2
    return (x * np.sin(np.pi * t / dur)).astype(np.float32)


def sting(rng):
    """Short orchestral-hit style stab with a pitch drop (the 'ouch')."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    drop = 1 - 0.06 * np.minimum(1, t / 0.6)
    x = np.zeros(n, np.float32)
    for m, a in [(37, 0.5), (44, 0.4), (49, 0.35), (52, 0.3), (61, 0.2)]:
        for det in (-0.004, 0.004):
            ph = 2 * np.pi * np.cumsum(midi(m) * (1 + det) * drop) / SR
            x += a * signal.sawtooth(ph).astype(np.float32)
    x = butter(x, 'low', 2200) * np.exp(-t * 3.2) * np.minimum(1, t / 0.004)
    x += butter(noise(n, rng), 'band', [300, 3000]) * np.exp(-t * 25) * 0.8
    return (x * 0.35).astype(np.float32)


def boom(rng, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sine_sweep(90, 32, dur, 2.6)
    x += butter(noise(n, rng), 'low', 400) * np.exp(-t * 5) * 0.7
    return x.astype(np.float32)


def whoosh(rng, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n, rng)
    out = np.zeros(n, np.float32)
    seg = 1024
    for s in range(0, n, seg):
        f = 400 + 3000 * (s / n) ** 2
        out[s:s + seg] = butter(x[s:s + seg], 'band', [f, f * 1.8], 1)
    return out * (t / dur) ** 1.5


def thunk(rng):
    return (sine_sweep(140, 55, 0.25, 16) + butter(noise(int(0.25 * SR), rng), 'low', 900) * env_exp(int(0.25 * SR), 30) * 0.5).astype(np.float32)


def crackle(dur, rng):
    n = int(dur * SR)
    x = np.zeros(n, np.float32)
    pos = rng.integers(0, n - 400, int(dur * 28))
    for p in pos:
        L = int(rng.integers(40, 300))
        x[p:p + L] += noise(L, rng) * env_exp(L, 400) * rng.uniform(0.2, 1)
    x = butter(x, 'band', [600, 6000]) + butter(noise(n, rng), 'low', 300) * 0.15
    return x


def load_music(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


# ============================================================================ shared assets

class Assets:
    def __init__(self):
        self.wad = Wad()
        self.pal = self.wad.pal
        self.font = Font(self.wad)
        pal, wad = self.pal, self.wad
        self.digits = {str(d): wad.patch('STTNUM%d' % d) for d in range(10)}
        self.digits['%'] = wad.patch('STTPRCNT')
        sprites = ROOT / 'doom-mod' / 'sprites'
        self.cam = {k: load_png(pal, sprites / ('CPC%s0.png' % k)) for k in ('AA', 'AB')}
        self.hunt, self.visor = {}, {}
        for fr in 'ABCD':
            for ang in (1, 3, 7, 8):
                path = sprites / ('HUNT%s%d.png' % (fr, ang))
                self.hunt[fr + str(ang)], self.visor[fr + str(ang)] = self.red_visor(load_png(pal, path), path)
        self.people = []
        oa = ROOT / 'doom-web' / 'outside-assets'
        for v in range(5):
            for ang in (0, 1, 7):
                p = oa / ('person-%d-0-%d.png' % (v, ang))
                if p.exists():
                    self.people.append(load_png(pal, p))
        self.wrench = load_png(pal, ROOT / 'doom-web' / 'wrench.png', (0, 0))
        self.logo = load_png(pal, title_logo(), (0, 0))   # logo option D1
        bar = LOCAL / 'ui' / 'stbar' / 'PDBAR.png'
        self.stbar = load_png(pal, bar, (0, 0)) if bar.exists() else wad.patch('STBAR')
        self.music = load_music(LOCAL / 'intake-music.ogg')
        self.snd = {}

    def red_visor(self, g, path):
        """The hunter's visor is blue in its walk frames; give it the red 'eye' glow."""
        a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
        blue = (a[..., 2] > a[..., 0] + 50) & (a[..., 2] > a[..., 1] + 30) & (a[..., 3] > 127)
        if not blue.any():
            return g, blue
        if blue.any():
            lum = a[..., 2][blue] / 255.0
            rgb = np.stack([np.clip(70 + 230 * lum, 0, 255), 70 * lum ** 4, 50 * lum ** 4], 1)
            idx = g.idx.copy()
            idx[blue] = self.pal.near(rgb)
            g = Gfx(idx, g.mask, g.ox, g.oy)
        return g, blue

    def sound(self, name, pitch=1.0):
        key = (name, pitch)
        if key not in self.snd:
            if name.lower().endswith('.lmp'):
                self.snd[key] = dmx_to_float((ROOT / 'doom-mod' / 'sounds' / 'pdoom' / name).read_bytes(), pitch)
            else:
                self.snd[key] = self.wad.sound(name, pitch)
        return self.snd[key]


def portrait(pal, path, box, size=(84, 150)):
    im = Image.open(path).convert('RGB').crop(box).resize(size, Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.15)
    im = ImageEnhance.Color(im).enhance(1.2)
    im = im.filter(ImageFilter.UnsharpMask(1, 60, 2))
    return Gfx(pal.near(np.asarray(im)))


def face_offsets(face_dir):
    """Per-lump (leftoffset, topoffset) for a face set: its own manifest.json, else a
    shared manifest in ui/faces/ that lists the set (influencer-/ceo-manifest.json)."""
    cands = [face_dir / 'manifest.json'] + sorted(FACE_DIR.glob('*manifest*.json'))
    for mp in cands:
        try:
            d = json.loads(mp.read_text())
        except (OSError, ValueError):
            continue
        if mp.parent == FACE_DIR and face_dir.name not in d.get('ids', d.get('characters', [])):
            continue
        lumps = d.get('lumps')
        if isinstance(lumps, dict) and lumps:
            return {k: (v.get('leftoffset', v.get('x', 0)), v.get('topoffset', v.get('y', 0))) for k, v in lumps.items()
                    if isinstance(v, dict)}
    return {}


def load_faces(A, face_dir):
    faces = {}
    offs = face_offsets(face_dir) if face_dir else {}
    for name in ('STFST00', 'STFST01', 'STFST02', 'STFTL00', 'STFTR00', 'STFOUCH0', 'STFEVL0', 'STFKILL0'):
        ref = A.wad.patch(name)                  # Doomguy's patch: offsets + box
        p = face_dir / (name + '.png') if face_dir else None
        if p is not None and p.exists():
            g = load_png(A.pal, p, (0, 0))
            if name in offs:
                g.ox, g.oy = offs[name]
            else:                                # same box as Doomguy, bottom-aligned
                g.ox = ref.ox - (ref.w - g.w) // 2
                g.oy = ref.oy - (ref.h - g.h)
        else:
            g = ref
        faces[name] = g
    return faces


def resolve_face_dir(ceo, override):
    tried = []
    for c in ([override] if override else [ceo, FACE_FALLBACK[ceo]]):
        p = Path(c) if ('/' in c or c.startswith('.')) else FACE_DIR / c
        tried.append(str(p))
        if (p / 'STFST01.png').exists():
            return p, c
    print('  ! no face set found in %s; using Doomguy from the WAD' % tried)
    return None, 'doomguy-wad'


# ============================================================================ film

CEOS = {
    'samwise': dict(
        ref='art/characters/samwise-othermale.webp', crop=(250, 40, 770, 964),
        chat=['SHIP IT!!', 'HAIR GOALS', 'KING', 'IS HE REAL??'],
        cap_a=[(0, 'SAM ALTMAN.'), ('+0.35', ' CEO.'), ('+0.45', '\n4.1 MILLION FOLLOWERS.'), ('+0.5', ' ZERO PORES.')],
        cap_b=[(0, 'TODAY WE SHIP THE FUTURE.')],
        cap_you=[(0, 'SOMEHOW THE MACHINES MISSED YOU.'), ('+0.9', '\nYOU LOOK TOO MUCH LIKE ONE OF THEM.')],
    ),
    'mario': dict(
        ref='art/characters/references/new-mario.png', crop=(230, 0, 900, 1180),
        chat=['SHIP IT!!', 'NICE SAFETY TUFTS', 'KING', 'IS HE REAL??'],
        cap_a=[(0, 'DARIO AMODEI.'), ('+0.35', ' CEO.'), ('+0.5', '\nTHE HAIR IS A WARNING LABEL.')],
        cap_b=[(0, 'WE WROTE A 212-PAGE SAFETY POLICY.'), ('+0.6', '\nTODAY WE SHIP ANYWAY.')],
        cap_you=[(0, 'SOMEHOW THE MACHINES MISSED YOU.'), ('+0.9', '\nTHEY THOUGHT THE YELLOW SUIT\nWAS A SAFETY FEATURE.')],
    ),
}


def shift_caption(segs, t0):
    return [((w + t0) if not isinstance(w, str) else w, s) for w, s in segs]


class Film:
    FW, FH, fps = W, H, FPS            # frame size in Doom pixels, output frame rate
    fmt = 'landscape'

    def __init__(self, A, ceo, face_dir, face_label):
        self.A, self.ceo, self.cfg = A, ceo, CEOS[ceo]
        self.pal, self.font = A.pal, A.font
        self.face_label = face_label
        self.faces = load_faces(A, face_dir)
        self.portrait = portrait(self.pal, ROOT / self.cfg['ref'], self.cfg['crop'])
        ys, xs = np.nonzero(A.wrench.mask)
        top = ys.min() + 2
        self.glint = (int(xs[ys == top].min()) + 1 + 1, int(top) + 1)
        wr = A.wrench
        m = np.pad(wr.mask, 1)
        grown = m.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            grown |= np.roll(np.roll(m, dy, 0), dx, 1)
        idx = np.where(m, np.pad(wr.idx, 1), 0).astype(np.uint8)
        self.wrench4 = Gfx(idx, grown).scaled(4)
        self.scenes, self.captions, self.sfx = [], [], []
        self.shakes, self.flashes, self.redpals, self.fades = [], [], [], []
        self.hint = (0.35, 3.0)
        self._cache = {}
        self.rng = np.random.default_rng(1993)
        self.prepare()
        self.build()

    # ------------------------------------------------------------ helpers
    def c(self, r, g, b):
        return self.pal.idx(r, g, b)

    def cap(self, segs, **kw):
        c = Caption(segs, **kw)
        self.captions.append(c)
        return c

    def sound(self, t, name_or_x, gain=1.0, pan=0.0, pitch=1.0):
        x = self.A.sound(name_or_x, pitch) if isinstance(name_or_x, str) else name_or_x
        self.sfx.append((t, x, gain, pan))

    def scene(self, name, dur, render, trans='cut'):
        t0 = self.scenes[-1]['end'] if self.scenes else 0.0
        self.scenes.append(dict(name=name, start=t0, end=t0 + dur, render=render, trans=trans,
                                f0=self.frame_of(t0), f1=self.frame_of(t0 + dur)))
        return t0

    def frame_of(self, t):
        return int(round(t * self.fps))

    def tic_of(self, f):
        """Doom tic shown on output frame f: renderers animate on 35 Hz tics; a 30 fps
        cut samples them the way a capture of a 35 Hz game would."""
        return f if self.fps == FPS else int(math.floor(f * FPS / self.fps + 1e-6))

    # ------------------------------------------------------------ static art
    def prepare(self):
        pal, A, c = self.pal, self.A, self.c
        self.k_white = c(255, 255, 255)
        self.k_red = 176
        # ----- scene 2: switch wall
        ct = A.wad.texture('COMPTALL')
        walls = []
        for sw in ('SW1COMP', 'SW2COMP'):
            wl = np.concatenate([ct.idx[:, 128:256], A.wad.texture(sw).idx, ct.idx[:, 0:128]], 1).copy()
            walls.append(wl)
        for wl in walls:                                        # the SHIP label plate above the switch
            rect(wl, 144, 59, 177, 70, 98)
            rect(wl, 145, 60, 176, 69, 0)
            self.font.draw(wl, 'SHIP', 160 - self.font.width('SHIP') // 2, 61, color='gold', shadow=False)
        self.sw_walls = walls
        # ----- scene 3: monitor wall
        s1 = A.wad.texture('COMPSTA1').idx
        s2 = A.wad.texture('COMPSTA2').idx
        wall = np.zeros((200, 384), np.uint8)
        pattern = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
        screens = {0: [(5, 4, 54, 44, 12), (57, 4, 87, 41, 8), (93, 4, 123, 20, 5), (93, 27, 123, 43, 5)],
                   1: [(5, 4, 54, 44, 12), (56, 4, 85, 41, 8), (91, 4, 120, 20, 5), (91, 27, 120, 43, 5)]}
        self.main = (122, 52, 262, 134)
        mx0, my0, mx1, my1 = self.main
        eyes = []
        for r in range(3):
            for col in range(3):
                kind = pattern[r][col]
                wall[r * 64:(r + 1) * 64, col * 128:(col + 1) * 128] = (s1 if kind == 0 else s2)[0:64]
                for (x0, y0, x1, y1, rad) in screens[kind]:
                    X0, Y0, X1, Y1 = col * 128 + x0, r * 64 + y0, col * 128 + x1, r * 64 + y1
                    if X1 > mx0 - 4 and X0 < mx1 + 4 and Y1 > my0 - 4 and Y0 < my1 + 4:
                        continue
                    if rad < 6 and (X0 // 64) % 2:     # not every tiny screen: keep it readable
                        continue
                    eyes.append((X0, Y0, X1, Y1, rad))
        wall[192:200] = s1[64:72, 0:128].repeat(3, 1)[:, :384] if s1.shape[0] > 72 else 104
        cx, cy = 192, 96
        eyes.sort(key=lambda e: math.hypot((e[0] + e[2]) / 2 - cx, (e[1] + e[3]) / 2 - cy))
        self.mon_wall, self.eyes = wall, eyes
        # ----- scene 4: skyline
        self.prepare_skyline()
        # ----- scene 5: corridor
        self.prepare_corridor()
        # ----- scene 6: cells
        self.prepare_cells()
        # ----- scene 9: fire palette (PSX Doom fire)
        fire_rgb = [(7, 7, 7), (31, 7, 7), (47, 15, 7), (71, 15, 7), (87, 23, 7), (103, 31, 7), (119, 31, 7), (143, 39, 7),
                    (159, 47, 7), (175, 63, 7), (191, 71, 7), (199, 71, 7), (223, 79, 7), (223, 87, 7), (223, 87, 7),
                    (215, 95, 7), (215, 95, 7), (215, 103, 15), (207, 111, 15), (207, 119, 15), (207, 127, 15),
                    (207, 135, 23), (199, 135, 23), (199, 143, 23), (199, 151, 31), (191, 159, 31), (191, 159, 31),
                    (191, 167, 39), (191, 167, 39), (191, 175, 47), (183, 175, 47), (183, 183, 47), (183, 183, 55),
                    (207, 207, 111), (223, 223, 159), (239, 239, 199), (255, 255, 255)]
        self.fire_pal = pal.near(np.array(fire_rgb, np.float32))
        self.fire_pal[0] = 0

    def prepare_skyline(self):
        rng = np.random.default_rng(42)
        c = self.c
        WW, HZ = 560, 152
        self.sky_w, self.hz = WW, HZ
        self.dc_x0, self.dc_x1 = 334, 458
        self.dc_c = (396, HZ - 34)
        sky = np.zeros((200, WW), np.uint8)
        ramp = [247, 246, 245, 244, 243, 242]
        for y in range(HZ):
            v = (y / HZ) ** 1.3 * (len(ramp) - 1)
            lo = int(v)
            fr = v - lo
            hi = min(lo + 1, len(ramp) - 1)
            sky[y] = np.where(BAYER4[y % 4][np.arange(WW) % 4] < fr, ramp[hi], ramp[lo])
        self.sky = sky
        self.stars = [(int(rng.integers(0, WW)), int(rng.integers(2, 90)), int(rng.integers(0, 4))) for _ in range(54)]
        far = np.zeros((200, WW), bool)
        near = np.zeros((200, WW), bool)
        in_dc = lambda x0, x1: x1 > self.dc_x0 - 8 and x0 < self.dc_x1 + 8
        bld_far, bld_near = [], []
        x = 0
        while x < WW:
            w = int(rng.integers(12, 30))
            h = int(rng.integers(36, 96))
            if in_dc(x, x + w):
                h = int(rng.integers(14, 30))
            bld_far.append((x, HZ - h, x + w, HZ))
            far[HZ - h:HZ, x:x + w] = True
            x += w + int(rng.integers(0, 4))
        x = -4
        while x < WW:
            w = int(rng.integers(16, 38))
            if in_dc(x, x + w):
                x += w
                continue
            h = int(rng.integers(22, 74))
            if rng.random() < 0.18:
                h = int(rng.integers(80, 112))                          # a few towers
            bld_near.append((x, HZ - h, x + w, HZ))
            near[HZ - h:HZ, x:x + w] = True
            if h > 70:                                                 # antenna
                ax = x + w // 2
                near[HZ - h - 10:HZ - h, ax:ax + 1] = True
            x += w + int(rng.integers(0, 3))
        self.far_mask, self.near_mask = far, near
        windows = []          # (x, y, colour, block, near)
        warm = [c(235, 219, 87), c(215, 187, 67), c(195, 155, 47), c(255, 235, 219)]
        block_of = lambda wx: min(wx // 42, 7) if wx < self.dc_x0 else 8
        for layer, blds in (('far', bld_far), ('near', bld_near)):
            for (x0, y0, x1, y1) in blds:
                if in_dc(x0, x1):
                    continue
                step_x, step_y = (3, 4) if layer == 'near' else (3, 3)
                for wy in range(y0 + 3, y1 - 2, step_y):
                    for wx in range(max(x0 + 2, 0), min(x1 - 2, WW), step_x):
                        if rng.random() < (0.55 if layer == 'near' else 0.35):
                            col = warm[int(rng.integers(0, 3 if layer == 'far' else 4))]
                            if layer == 'far':
                                if near[wy, wx]:
                                    continue
                                col = self.pal.cmap[10][col]
                            windows.append((wx, wy, col, block_of(wx), layer == 'near'))
        self.windows = windows
        self.streetlights = [(x, HZ - 1, block_of(x)) for x in range(6, WW, 9) if not in_dc(x, x + 1)]
        # the data-centre campus: long low halls lined with cold light
        self.dcs = [(336, HZ - 38, 364), (367, HZ - 62, 402), (405, HZ - 50, 432), (435, HZ - 34, 457)]
        ys, xs = np.mgrid[0:200, 0:WW]
        self.sky_d = np.hypot((xs - self.dc_c[0]) / 1.5, (ys - self.dc_c[1]) * 1.0)
        self.sky_dither = BAYER4[ys % 4, xs % 4]

    def prepare_corridor(self):
        A = self.A
        seq = ['SUPPORT2', 'COMPTALL', 'SUPPORT2', 'STARTAN3', 'LITE5', 'COMPSTA2', 'LITE5', 'STARTAN3',
               'SUPPORT2', 'COMPSTA1', 'SUPPORT2', 'STARTAN3', 'LITE5', 'COMPTALL', 'LITE5', 'STARG3']
        cols = []
        for n in seq:
            t = A.wad.texture(n)
            img = t.idx
            if img.shape[0] != 128:
                img = np.resize(img, (128, img.shape[1]))
            cols.append(img)
        self.cwall = np.concatenate(cols, 1)
        self.cfloor = A.wad.flat('FLOOR4_8')
        # geometry: eye level y=78, wall at z=160 (scale 1, base y=119), hunter at z=80 (scale 2, feet y=160)
        self.c_hor, self.c_eye, self.c_F = 78, 41, 160
        ys = np.arange(120, 200)
        self.c_z = self.c_F * self.c_eye / (ys - self.c_hor)
        self.c_light = np.clip(((self.c_z - 50) / 13).astype(int) + 2, 0, 31)
        self.cam_spots = [170, 360, 560, 760]

    def prepare_cells(self):
        c = self.c
        self.panels = [(5, 3), (165, 3), (5, 72), (165, 72)]
        rng = np.random.default_rng(20)
        order = list(range(20))
        self.pop_order = order                                    # facility by facility
        ppl = self.A.people
        picks = rng.permutation(len(ppl))[:20] if len(ppl) >= 20 else [i % len(ppl) for i in range(20)]
        self.sil = []
        for i, p in enumerate(picks):
            g = ppl[int(p)]
            ys, xs = np.nonzero(g.mask)
            g = g.crop(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
            hh = 38 + int(rng.integers(-4, 3))
            ww = max(6, round(g.w * hh / g.h))
            g = g.resized(ww, hh).solid(0)
            if rng.random() < 0.5:
                g = g.flipped()
            self.sil.append(g)

    # ------------------------------------------------------------ timeline
    def build(self):
        cfg, rng = self.cfg, self.rng
        # 1. THE LIVESTREAM ---------------------------------------------------
        t0 = 0.0
        capA = self.cap(shift_caption(cfg['cap_a'], 1.1))
        capB = self.cap(shift_caption(cfg['cap_b'], capA.end + 0.25))
        self.s1_zoom = capB.start
        d1 = capB.end + 0.2
        self.scene('livestream', d1, self.r_live)
        self.sound(0.22, crt_power_on(rng), 0.55)
        self.sound(self.s1_zoom, butter(noise(int(0.12 * SR), rng), 'band', [1200, 6000]) * env_exp(int(0.12 * SR), 25), 0.25)
        self.jingle_start = 0.6
        n_core = len(cfg['chat'])
        chat = []
        span = self.s1_zoom - 1.6
        for i, txt in enumerate(cfg['chat']):
            chat.append((1.5 + span * i / n_core, txt))
        t = 1.5 + span
        k = 0
        while t < d1 + 0.3:
            chat.append((t, 'SHIP IT!!'))
            t += max(0.32, 0.9 - k * 0.12)
            k += 1
        self.chat = chat
        for i, (tc, _) in enumerate(chat):
            if tc < d1:
                self.sound(tc, blip(1320 if i % 2 else 1560), 0.12, -0.5)
        # 2. THE BUTTON ---------------------------------------------------------
        t0 = d1
        self.s2_flip = t0 + 1.25
        cap2 = self.cap([(self.s2_flip + 0.65, 'YOU SHIPPED IT ON A THURSDAY.')])
        self.scene('button', cap2.end + 0.45 - t0, self.r_button)
        self.jingle_stop = self.s2_flip
        self.sound(self.s2_flip, 'DSSWTCHN', 0.9)
        self.flashes.append((self.s2_flip + 0.03, 'white'))
        self.sound(self.s2_flip + 2.1, cricket(rng), 0.10, 0.45)
        self.shakes.append((self.s2_flip + 0.03, 0.2, 2))
        # 3. IT WORKED ------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.music_start = t0
        self.s3 = dict(count0=t0 + 0.7, count1=t0 + 4.3, zoom=t0 + 1.7, eye0=t0 + 1.7, eye1=t0 + 4.2)
        self.cap([(t0 + 0.9, 'IT WORKED.'), ('+0.7', ' THEN IT KEPT WORKING.'), (t0 + 4.35, '\nFOR SOMEONE ELSE.')], end=t0 + 8.4)
        self.scene('it-worked', 8.6, self.r_monitors)
        self.shakes.append((t0, 0.15, 2))
        self.sound(t0, boom(rng, 1.2), 0.35)
        last = -1
        for f in range(tic(self.s3['count0'] - t0), tic(self.s3['count1'] - t0) + 1):
            if f % 4 == 0:
                self.sound(t0 + f / FPS, 'DSPISTOL', 0.38, 0.0, 1.0)
        self.sound(self.s3['count1'], 'DSBAREXP', 0.85)
        self.shakes.append((self.s3['count1'], 0.32, 3))
        self.redpals.append((self.s3['count1'], 0.55, 5))
        for i in range(len(self.eyes)):
            te = self.eye_time(i)
            self.sound(te, blip(880 + 40 * (i % 5), 0.05), 0.09, ((self.eyes[i][0] + self.eyes[i][2]) / 2 - 192) / 200)
        # 4. LIGHTS OUT -----------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s4 = t0
        self.cap([(t0 + 1.4, 'THE CITIES WENT DARK.'), ('+1.5', '\nTHE DATA CENTERS DID NOT.')], end=t0 + 8.0)
        self.scene('lights-out', 8.2, self.r_skyline, 'melt')
        self.block_off = {}
        order = [0, 1, 3, 2, 4, 5, 6, 8, 7]
        for k, b in enumerate(order):
            tb = t0 + 1.3 + k * 0.56
            self.block_off[b] = tb
            self.sound(tb, thunk(rng), 0.32, clamp((b * 42 - 160 - 200 * k / 9) / 240, -1, 1))
        self.sound(t0 + 0.6, hum(7.6, rng), 0.16, 0.4)
        # 5. THE MACHINES -----------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s5 = t0
        self.cap([(t0 + 0.5, 'THE MACHINES RUN EVERYTHING NOW.'), (t0 + 3.35, '\nTHEY ARE VERY POLITE ABOUT IT.')], end=t0 + 8.2)
        self.scene('machines', 8.4, self.r_corridor)
        for tt, fr, x in self.hunter_steps():
            self.sound(t0 + tt, 'DSMETAL', 0.30, clamp((x - 160) / 180, -1, 1), 1.0 + 0.04 * (fr % 2))
        self.sound(t0 + 3.25, polite_chime(), 0.30)
        for tt, x in self.camera_turns():
            self.sound(t0 + tt, servo(rng), 0.10, clamp((x - 160) / 180, -1, 1))
        # 6. THE LAST TWENTY ---------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s6 = t0
        c1 = self.cap([(t0 + 0.8, 'THE LAST TWENTY HUMANS ALIVE'), ('+0.3', '\nARE THE PEOPLE WHO WARNED YOU.')])
        c2 = self.cap([(c1.end + 0.25, 'ALL OF THEM.'), ('+0.7', '\nMOST OF THEM IN WRITING.')])
        self.scene('last-twenty', c2.end + 0.3 - t0, self.r_cells, 'melt')
        for i in range(20):
            self.sound(self.pop_time(i), 'DSTINK', 0.8, ((self.cell_xy(i)[0]) - 160) / 200, 0.9 + 0.02 * (i % 6))
            self.sound(self.pop_time(i), blip(660 + 30 * (i % 4), 0.04), 0.09)
        # 7. YOU ------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s7 = t0
        cy = self.cap(shift_caption(cfg['cap_you'], t0 + 1.5))
        self.ouch_t = cy.typed + 0.12
        self.scene('you', cy.end + 0.25 - t0, self.r_face)
        for z in (0.9, 1.15, 1.4):
            self.sound(t0 + z, 'DSPSTOP', 0.22, 0.0, 1.3)
        self.sound(self.ouch_t, sting(rng), 0.55)
        self.sound(self.ouch_t + 0.02, 'DSPLPAIN', 0.45)
        self.shakes.append((self.ouch_t, 0.12, 1))
        # 8. THE WRENCH -------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s8 = dict(t0=t0, drop=t0 + 0.4, land=t0 + 0.9, grin=t0 + 1.35)
        self.cap([(t0 + 1.3, 'YOU HAVE A WRENCH.')], end=t0 + 4.6)
        self.scene('wrench', 4.85, self.r_wrench)
        self.sound(self.s8['drop'], whoosh(rng, 0.5), 0.25)
        self.sound(self.s8['land'], 'pdpickup.lmp', 0.8)
        self.sound(self.s8['land'], 'DSMETAL', 0.55, 0.0, 1.25)
        self.sound(self.s8['land'] + 0.2, 'DSMETAL', 0.18, 0.0, 1.6)
        self.sound(self.s8['grin'], 'DSWPNUP', 0.8)
        self.shakes.append((self.s8['land'], 0.25, 3))
        # 9. TITLE ---------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s9 = dict(t0=t0, blink=t0 + 1.3, get=t0 + 2.7)
        self.cap([(self.s9['blink'], 'p(DOOM): 99%')], end=t0 + 6.2, hidden=True)   # drawn by the scene; manifest only
        gt = self.cap([(self.s9['get'], 'GET THEM OUT.')], end=t0 + 6.2, scale=2, y=150, plate=False, color='white')
        self.s9['slam'] = gt.typed + 0.05
        self.scene('title', 6.2, self.r_title, 'melt')
        self.sound(self.s9['slam'], boom(rng, 1.8), 0.6)
        self.sound(self.s9['slam'], 'DSPSTOP', 0.5, 0.0, 0.8)
        self.shakes.append((self.s9['slam'], 0.25, 2))
        self.sound(t0 + 0.2, crackle(6.0, rng), 0.10)
        self.fades.append((t0 + 5.15, t0 + 6.0))
        self.duration = self.scenes[-1]['end']
        self.music_end = self.duration

    # ------------------------------------------------------------ per-scene timing helpers
    def eye_time(self, i):
        n = len(self.eyes)
        return self.s3['eye0'] + (self.s3['eye1'] - self.s3['eye0']) * (i / max(1, n - 1)) ** 0.85

    def pop_time(self, i):
        return self.s6 + 0.55 + i * 0.2

    def cell_xy(self, i):
        p = i // 5
        px, py = self.panels[p]
        return px + 4 + (i % 5) * 29 + 14, py + 62

    def hunter_path(self, t):
        """(lateral, facing frame key, walking) for the foreground hunter at scene time t."""
        cx = self.corr_cam(t)
        if t < 3.0:
            L = 200 + (318 - 200) * t / 3.0
            return L, 'walk', 7
        if t < 4.75:
            return 318, 'turn', None
        u = (t - 4.75)
        return 318 + 40.5 * u, 'walk', 7

    def corr_cam(self, t):
        return 300 + 6 * t

    def hunter_steps(self):
        out = []
        last = None
        for f in range(tic(8.4)):
            t = f / FPS
            L, mode, _ = self.hunter_path(t)
            if mode != 'walk':
                last = None
                continue
            fr = self.walk_frame(t)
            if fr in (0, 2) and fr != last:
                x = 160 + 2 * (L - self.corr_cam(t))
                if -40 < x < 360:
                    out.append((t, fr, x))
            last = fr
        return out

    def walk_frame(self, t):
        tt = t if t < 3.0 else t - 1.75
        return int(tt * FPS / 8) % 4

    def camera_turns(self):
        out = []
        prev = {}
        for f in range(tic(8.4)):
            t = f / FPS
            for k, Lc in enumerate(self.cam_spots):
                face = self.cam_faces_right(t, Lc)
                if k in prev and prev[k] != face:
                    out.append((t, 160 + (Lc - self.corr_cam(t))))
                prev[k] = face
        return out

    def cam_faces_right(self, t, Lc):
        L, _, _ = self.hunter_path(t)
        return L > Lc + 6

    # ------------------------------------------------------------ renderers (return 320x200 index frames)
    def r_live(self, t, f):
        if t < 0.25:
            return np.zeros((H, W), np.uint8)
        world = np.zeros((H, W), np.uint8)
        if t < self.s1_zoom:
            chat = np.zeros((H, W), np.uint8)
            self.draw_chat(chat, t)
            world[:163, :112] = chat[:163, :112]
        self.draw_phone(world, t)
        self.draw_hearts(world, t)
        if t >= self.s1_zoom:
            fb = camera(world, 160, 57, 2)
        else:
            fb = world
        # CRT: scanlines, rolling bar, flicker
        rng = np.random.default_rng(f * 31 + 7)
        fb[1::2] = self.pal.cmap[5][fb[1::2]]
        roll = int((t * 46) % 260) - 30
        remap(fb, 0, roll, W, roll + 10, self.pal.cmap[3])
        lvl = [0, 0, 0, 0, 1, 2][int(rng.integers(0, 6))]
        if lvl:
            fb[:] = self.pal.cmap[lvl][fb]
        if rng.random() < 0.05:                                        # tracking glitch
            y0 = int(rng.integers(0, H - 12))
            fb[y0:y0 + 6] = np.roll(fb[y0:y0 + 6], int(rng.integers(-3, 4)), 1)
        if 0 <= t - self.s1_zoom < 3 / FPS:                            # the push-in tears the picture
            for _ in range(7):
                y0 = int(rng.integers(0, H - 20))
                hgt = int(rng.integers(4, 22))
                fb[y0:y0 + hgt] = np.roll(fb[y0:y0 + hgt], int(rng.integers(-24, 25)), 1)
        on = t - 0.25
        if on < 0.32:                                                 # power-on: line opens to a picture
            p = on / 0.32
            half = int(max(1, (p ** 2) * 100))
            out = np.zeros_like(fb)
            out[100 - half:100 + half] = self.pal.white(int(16 * (1 - p) ** 0.7))[fb[100 - half:100 + half]]
            if p < 0.25:
                out[99:101, int(160 - 160 * p * 4):int(160 + 160 * p * 4)] = self.k_white
            return out
        if on < 0.8:
            if rng.random() < 0.45:
                fb[:] = self.pal.cmap[int(rng.integers(6, 16))][fb]
        return fb

    def draw_phone(self, fb, t):
        c = self.c
        x0, y0, x1, y1 = 115, 6, 205, 163
        rect(fb, x0, y0, x1, y1, 109)
        rect(fb, x0, y0, x1, y0 + 1, 100)
        rect(fb, x0, y0, x0 + 1, y1, 102)
        rect(fb, x1 - 1, y0, x1, y1, 110)
        rect(fb, x0, y1 - 1, x1, y1, 111)
        for (cx, cy) in [(x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)]:
            fb[cy, cx] = 0
        rect(fb, x0 + 1, y0 + 1, x0 + 2, y0 + 2, 0)
        rect(fb, x1 - 2, y0 + 1, x1 - 1, y0 + 2, 0)
        rect(fb, 150, 8, 170, 10, 0)
        sx, sy = 120, 12
        bob_y = int(round(1.4 * math.sin(t * 2.1)))
        bob_x = int(round(0.8 * math.sin(t * 1.3 + 1)))
        crop = self.portrait.crop(2 + bob_x, 3 + bob_y, 82 + bob_x, 147 + bob_y)
        blit(fb, crop, sx, sy)
        # LIVE badge + viewer count
        rect(fb, sx + 3, sy + 3, sx + 34, sy + 14, 176)
        rect(fb, sx + 3, sy + 13, sx + 34, sy + 14, 186)
        self.font.draw(fb, 'LIVE', sx + 5, sy + 5, color='white', shadow=False)
        remap(fb, sx + 36, sy + 3, sx + 78, sy + 14, self.pal.cmap[20])
        eye = ['..XXX..', '.X...X.', 'X..O..X', '.X...X.', '..XXX..']
        for r, row in enumerate(eye):
            for q, ch in enumerate(row):
                if ch != '.':
                    fb[sy + 6 + r, sx + 38 + q] = self.k_white if ch == 'X' else 0
        u = clamp((t - 1.0) / max(1.0, self.s1_zoom + 2.0 - 1.0), 0, 1)
        v = 1.2 + 2.9 * (u ** 1.5)
        self.font.draw(fb, '%.1fM' % v, sx + 47, sy + 5, color='white', shadow=False)

    def draw_hearts(self, fb, t):
        rng = np.random.default_rng(77)
        heart = ['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
        cols = [(176, 168), (178, 170), (19, 16), (173, 168), (176, 4)]
        for k in range(160):
            ts = 0.9 + k * 0.075 + rng.uniform(0, 0.05)
            x0 = 186 + rng.uniform(-4, 8)
            vx = rng.uniform(2, 34)
            vy = rng.uniform(-50, -30)
            ph = rng.uniform(0, 6.28)
            cset = cols[int(rng.integers(0, len(cols)))]
            life = rng.uniform(2.2, 3.4)
            a = t - ts
            if a < 0 or a > life:
                continue
            x = int(x0 + vx * a + 3 * math.sin(a * 5 + ph))
            y = int(150 + vy * a)
            lvl = int(clamp((a - (life - 0.7)) / 0.7, 0, 1) * 22)
            small = k % 3 == 0
            for r, row in enumerate(heart[:5] if small else heart):
                for q, ch in enumerate(row[1:6] if small else row):
                    if ch != '.':
                        px, py = x + q, y + r
                        if 0 <= px < W and 0 <= py < H:
                            fb[py, px] = self.pal.cmap[lvl][cset[1] if ch == 'H' else cset[0]]

    def draw_chat(self, fb, t):
        font = self.font
        avatars = [161, 115, 195, 19, 213, 99]
        entries = []
        for i, (tc, txt) in enumerate(self.chat):
            if tc > t:
                break
            lines = wrap_px(font, txt, 90)
            entries.append((tc, i, lines, 11 * len(lines) + 3))
        y = 160
        for tc, i, lines, h in reversed(entries):
            slide = clamp((t - tc) * FPS / 5.0, 0, 1)
            y -= int(round(h * slide)) if (tc, i) == (entries[-1][0], entries[-1][1]) else h
            if y < -30:
                break
            lvl = int(clamp((40 - y) / 40, 0, 1) * 20)
            table = self.pal.cmap[lvl][font.trans['white']]
            a = self.pal.cmap[lvl][avatars[i % len(avatars)]]
            rect(fb, 8, y + 1, 14, y + 7, a)
            for li, ln in enumerate(lines):
                font.draw(fb, ln, 18, y + li * 11, table=table)

    def r_button(self, t, f):
        T0 = self.scenes[1]['start']
        flipped = t + T0 >= self.s2_flip
        world = self.sw_walls[1 if flipped else 0]
        if t < 0.45:
            k, cy = 2, 74
        elif t < 0.85:
            k, cy = 3, 81
        else:
            k, cy = 4, 83
        fb = camera(world, 160, cy, k)
        if flipped and int((t + T0 - self.s2_flip) * FPS) % 22 > 18:
            fb[:] = self.pal.cmap[2][fb]
        return fb

    def r_monitors(self, t, f):
        T0 = self.scenes[2]['start']
        ta = t + T0
        world = self.mon_wall.copy()
        mx0, my0, mx1, my1 = self.main
        # main screen
        rect(world, mx0 - 3, my0 - 3, mx1 + 3, my1 + 3, 100)
        rect(world, mx0 - 2, my0 - 2, mx1 + 2, my1 + 2, 106)
        rect(world, mx0 - 2, my1 + 1, mx1 + 2, my1 + 2, 110)
        rect(world, mx0, my0, mx1, my1, 0)
        u = clamp((ta - self.s3['count0']) / (self.s3['count1'] - self.s3['count0']), 0, 1)
        val = int(12 + 87 * (u ** 1.35))
        done = ta >= self.s3['count1']
        lab = 'p(DOOM)'
        self.font.draw(world, lab, (mx0 + mx1) // 2 - self.font.width(lab) // 2, my0 + 6, color='gold')
        s = '%d%%' % val
        blink_off = done and int((ta - self.s3['count1']) * FPS) % 16 >= 12 and ta < self.s3['count1'] + 2.5
        if not blink_off:
            draw_num(world, self.A.digits, s, (mx0 + mx1) // 2, my0 + 18, 3)
        # scanline on the main screen
        world[my0:my1:2, mx0:mx1] = self.pal.cmap[3][world[my0:my1:2, mx0:mx1]]
        # eyes
        for i, (x0, y0, x1, y1, rad) in enumerate(self.eyes):
            te = self.eye_time(i)
            if ta < te:
                continue
            age = (ta - te) * FPS
            rect(world, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0)
            grow = clamp(age / 4.0, 0.15, 1.0)
            pulse = 0.0
            if done:
                pulse = max(0.0, 1 - (ta - self.s3['count1']) / 0.6)
            flick = 1.0 if (i * 7 + f) % 41 else 0.85
            draw_eye(world, (x0 + x1) / 2, (y0 + y1) / 2, rad * grow * flick, pulse)
        if ta < self.s3['zoom']:
            return camera(world, 192, 93, 2)
        return camera(world, 192, 100, 1)

    def r_skyline(self, t, f):
        ta = t + self.s4
        c = self.c
        HZ = self.hz
        world = self.sky.copy()
        off = sum(1 for b, tb in self.block_off.items() if ta >= tb)
        g = clamp(0.15 + 0.85 * off / len(self.block_off), 0, 1) + 0.04 * math.sin(ta * 3.1)
        # bloom: a cold halo around the campus that swells as the city goes out
        reach = 46 + 120 * g
        inten = np.clip(1 - self.sky_d / reach, 0, 1) ** 1.35 * (0.35 + 0.65 * g) * 12
        ramp = np.array([0, 241, 207, 206, 205, 203, 201, 199, 197, 195, 193], np.uint8)
        lvl = np.clip(inten + self.sky_dither - 0.5, 0, 10).astype(int)
        world = np.where(lvl > 0, ramp[lvl], world).astype(np.uint8)
        # a soft beam straight up from the tallest hall
        bx, btop = 384, HZ - 62
        bw = 3 + 4 * g
        if g > 0.3:
            ys = np.arange(0, btop)
            fall = ((ys / btop) ** 0.8) * (g - 0.3) / 0.7 * 9.5
            for dx in range(-8, 9):
                k = fall * max(0.0, 1 - abs(dx) / bw)
                kk = np.clip(k + BAYER4[ys % 4, (bx + dx) % 4] - 0.5, 0, 10).astype(int)
                col = world[ys, bx + dx]
                world[ys, bx + dx] = np.where(kk > 0, np.maximum(ramp[kk], 0), col)
        for (sx, sy, ph) in self.stars:
            if world[sy, sx] in (247, 246, 245, 244, 243, 242):
                world[sy, sx] = [80, 96, 104, 88][(f // 9 + ph) % 4]
        world[self.far_mask] = 6
        world[self.near_mask] = 0
        world[HZ:] = 0
        for (wx, wy, col, b, near) in self.windows:
            tb = self.block_off.get(b, 99)
            if ta >= tb + 0.14:
                continue
            if ta >= tb and int((ta - tb) * FPS) % 2 == 0:
                continue
            world[wy, wx] = col
            if near:
                world[wy + 1, wx] = self.pal.cmap[6][col]
        for (sx, sy, b) in self.streetlights:
            if ta < self.block_off.get(b, 99):
                world[sy, sx] = c(255, 199, 155)
        # the halls themselves: the brightest thing on screen
        lit = [196, 195, 194, 193, 192, 4]
        level = int(clamp(g, 0, 1) * 5)
        for k, (x0, y0, x1) in enumerate(self.dcs):
            rect(world, x0, y0, x1, HZ, 109)
            rect(world, x0, y0, x1, y0 + 1, lit[max(0, level - 2)])
            for yy in range(y0 + 3, HZ - 1, 3):
                for xx in range(x0 + 1, x1 - 1):
                    if (xx - x0) % 7 == 3:
                        continue
                    world[yy, xx] = lit[min(5, level + ((xx * 5 + yy * 3 + k) % 4 == 0))]
                world[yy + 1, x0 + 1:x1 - 1] = 201 if level > 2 else 205
            for xx in range(x0 + 3, x1 - 4, 8):
                rect(world, xx, y0 - 3, xx + 5, y0, 108)
                world[y0 - 4, xx + 2] = 176 if (f // 14 + xx) % 3 == 0 else 108
        # light spilling onto the street in front of the campus
        for yy in range(HZ, HZ + 14):
            fade = (1 - (yy - HZ) / 14) * g * 7
            xs = np.arange(self.dc_x0 - 30, self.dc_x1 + 30)
            k = fade * np.clip(1 - np.abs(xs - self.dc_c[0]) / 95, 0, 1)
            kk = np.clip(k + BAYER4[yy % 4, xs % 4] - 0.5, 0, 10).astype(int)
            world[yy, xs] = np.where(kk > 0, ramp[kk], world[yy, xs])
        cx = 160 + int(round((self.dc_c[0] - 160) * smooth((t - 1.0) / 6.4)))
        return camera(world, cx, 100, 1)

    def r_corridor(self, t, f):
        A = self.A
        fb = np.zeros((H, W), np.uint8)
        cxw = self.corr_cam(t)
        icx = int(round(cxw))
        # wall (z=160, scale 1): texture rows 9..128 visible above base y=119
        tw = self.cwall.shape[1]
        cols = (np.arange(W) - 160 + icx) % tw
        fb[0:119] = self.pal.cmap[5][self.cwall[9:128][:, cols]]
        fb[117:119] = self.pal.cmap[12][fb[117:119]]
        # floor
        xs = np.arange(W) - 160
        for k, y in enumerate(range(120, 200)):
            z = self.c_z[k]
            u = (xs * z / self.c_F + icx).astype(int) & 63
            v = int(z * 1.0) & 63
            fb[y] = self.pal.cmap[self.c_light[k]][self.cfloor[v, u]]
        # wall cameras
        L, mode, _ = self.hunter_path(t)
        stop = 3.0 <= t < 4.75
        for Lc in self.cam_spots:
            sx = 160 + (Lc - icx)
            if -40 < sx < 360:
                near = abs(L - Lc) < 150 or stop
                rec = near and ((f // 10) % 2 == 0 or stop)
                g = self.A.cam['AB' if rec else 'AA']
                if self.cam_faces_right(t, Lc):
                    g = g.flipped()
                blit(fb, g.mapped(self.pal.cmap[3]), sx, 58)
        # background hunter near the wall (z=160, scale 1), walking left
        bl = 520 - 22 * t
        bx = 160 + (bl - icx)
        if -40 < bx < 360:
            fr = 'ABCD'[int(t * FPS / 8) % 4]
            blit(fb, self.A.hunt[fr + '3'].mapped(self.pal.cmap[9]), bx, 119)
        # foreground hunter (z=80, scale 2)
        x = 160 + 2 * (L - cxw)
        if mode == 'walk':
            key = 'ABCD'[self.walk_frame(t)] + '7'
        else:
            u = t - 3.0
            if u < 0.12 or u > 1.63:
                key = 'A8'
            else:
                key = 'A1'
        g = self.A.hunt[key].scaled(2)
        hx = int(round(x))
        polite = mode == 'turn' and 0.2 < t - 3.0 < 1.5
        pulse = 0.5 + 0.5 * math.sin((t - 3.0) * 9) if polite else 0.0
        self.visor_glow(fb, key, hx - g.ox, 160 - g.oy, 2, 4.5 + 4 * pulse)
        blit(fb, g, hx, 160)
        return fb

    def visor_glow(self, fb, key, x0, y0, k, strength):
        """Faint red bloom around the hunter's visor (tints whatever is behind it)."""
        vm = self.A.visor.get(key)
        if vm is None or not vm.any():
            return
        vm = np.repeat(np.repeat(vm, k, 0), k, 1)
        pad = 5
        m = np.pad(vm, pad)
        acc = np.zeros(m.shape, np.float32)
        for dy in range(-pad, pad + 1):
            for dx in range(-pad, pad + 1):
                d = math.hypot(dx, dy)
                if d <= pad:
                    acc = np.maximum(acc, np.roll(np.roll(m, dy, 0), dx, 1) * (1 - d / (pad + 1)))
        hh, ww = acc.shape
        X0, Y0 = x0 - pad, y0 - pad
        sx0, sy0, sx1, sy1 = max(X0, 0), max(Y0, 0), min(X0 + ww, fb.shape[1]), min(Y0 + hh, fb.shape[0])
        if sx1 <= sx0 or sy1 <= sy0:
            return
        a = acc[sy0 - Y0:sy1 - Y0, sx0 - X0:sx1 - X0]
        lvl = np.clip(a * strength + BAYER4[np.arange(sy0, sy1)[:, None] % 4, np.arange(sx0, sx1)[None, :] % 4] - 0.5, 0, 8).astype(int)
        reg = fb[sy0:sy1, sx0:sx1]
        for L in range(1, 9):
            sel = lvl == L
            if sel.any():
                reg[sel] = self.pal.toward((255, 30, 30), L)[reg[sel]]

    def r_cells(self, t, f):
        ta = t + self.s6
        fb = np.zeros((H, W), np.uint8)
        c = self.c
        for p, (px, py) in enumerate(self.panels):
            rect(fb, px, py, px + 150, py + 66, 98)
            rect(fb, px + 1, py + 1, px + 149, py + 65, 107)
            rect(fb, px + 1, py + 1, px + 149, py + 11, 104)
            self.font.draw(fb, 'FACILITY %d' % (p + 1), px + 4, py + 3, color='grey', shadow=False)
            for k in range(5):
                i = p * 5 + k
                cx0 = px + 4 + k * 29
                cy0 = py + 13
                lit = ta >= self.pop_time(i)
                age = (ta - self.pop_time(i)) * FPS
                for yy in range(cy0, cy0 + 50):
                    shade = [92, 94, 96, 98, 100, 102, 103][min(6, (yy - cy0) // 7)]
                    fb[yy, cx0:cx0 + 28] = shade if lit else 108
                if lit and age < 3 and age >= 1:
                    fb[cy0:cy0 + 50, cx0:cx0 + 28] = self.pal.cmap[10][fb[cy0:cy0 + 50, cx0:cx0 + 28]]
                rect(fb, cx0, cy0 + 48, cx0 + 28, cy0 + 50, 106)
                rect(fb, cx0 + 10, cy0, cx0 + 18, cy0 + 2, 4 if lit else 106)        # lamp
                if lit:
                    g = self.sil[i]
                    if age < 2:
                        g = g.solid(4)
                    bounce = -2 if age < 3 else (-1 if age < 5 else 0)
                    blit(fb, g, cx0 + 14 - g.w // 2, cy0 + 48 - g.h + bounce, offsets=False)
                for bx in (cx0 + 3, cx0 + 10, cx0 + 17, cx0 + 24):
                    rect(fb, bx, cy0, bx + 1, cy0 + 48, 86 if lit else 100)
                    rect(fb, bx + 1, cy0, bx + 2, cy0 + 48, 106)
                rect(fb, cx0, cy0 + 2, cx0 + 28, cy0 + 3, 88 if lit else 100)
                rect(fb, cx0, cy0 + 3, cx0 + 28, cy0 + 4, 106)
                rect(fb, cx0 + 28, cy0, cx0 + 29, cy0 + 50, 110)
        # counter
        n = sum(1 for i in range(20) if ta >= self.pop_time(i))
        label = 'HUMANS REMAIN'
        s = '%d' % n
        dw = sum(self.A.digits[ch].w for ch in s)
        lw = self.font.width(label)
        x = (W - (dw + 6 + lw)) // 2
        draw_num(fb, self.A.digits, s, x + dw // 2, 142, 1)
        self.font.draw(fb, label, x + dw + 6, 147, color='white')
        return fb

    WELL = (139, 182)          # status-bar columns holding the bevelled face well (no label fragments)

    def bar_world(self, face_key, dim=31):
        """The status bar at y=84 with the CEO's face.  dim (0..31) darkens everything
        except the face well through COLORMAP; 31 leaves the well alone on black."""
        world = np.zeros((H, W), np.uint8)
        y0 = 84
        blit(world, self.A.stbar, 0, y0, offsets=False)
        draw_num_right(world, self.A.digits, '100', 90, y0 + 3)
        blit(world, self.A.digits['%'], 90, y0 + 3)
        draw_num_right(world, self.A.digits, '99', 221, y0 + 3)
        blit(world, self.A.digits['%'], 221, y0 + 3)
        g = self.faces[face_key]
        blit(world, g, 143, y0 + 0)
        if dim > 0:
            x0, x1 = self.WELL
            outside = np.ones((H, W), bool)
            outside[y0:y0 + 32, x0:x1] = False
            world[outside] = 0 if dim >= 31 else self.pal.cmap[dim][world[outside]]
            if dim >= 31:                         # a crisp dark rim around the isolated well
                rect(world, x0 - 1, y0 - 1, x1 + 1, y0, 0)
        return world

    def face_at(self, ta):
        if self.ouch_t <= ta < self.ouch_t + 1.1:
            return 'STFOUCH0'
        if 's8' in self.__dict__ and ta >= self.s8['grin']:
            return 'STFEVL0'
        k = int((ta - self.s7) * FPS / 17)
        return ['STFST01', 'STFST00', 'STFST01', 'STFST02', 'STFST01', 'STFST01', 'STFST02', 'STFST00'][k % 8]

    def r_face(self, t, f):
        ta = t + self.s7
        dim = int(round(31 * clamp((t - 0.55) / 0.3, 0, 1)))
        world = self.bar_world(self.face_at(ta), dim)
        cx = (self.WELL[0] + self.WELL[1]) / 2
        if t < 0.9:
            return camera(world, 160, 100, 1)
        if t < 1.15:
            return camera(world, cx, 101, 2)
        if t < 1.4:
            return camera(world, cx, 103, 3)
        return camera(world, cx, 105, 4)

    def r_wrench(self, t, f):
        ta = t + self.s8['t0']
        world = self.bar_world(self.face_at(ta))
        cx = (self.WELL[0] + self.WELL[1]) / 2
        pan = int(round(13 * smooth(t / 0.35)))
        fb = camera(world, cx + pan, 105, 4)
        g = self.wrench4
        land_y = 152 - g.h
        if ta >= self.s8['drop']:
            if ta < self.s8['land']:
                u = (ta - self.s8['drop']) / (self.s8['land'] - self.s8['drop'])
                y = -g.h - 10 + (land_y + g.h + 10) * u * u
            else:
                a = ta - self.s8['land']
                y = land_y - (max(0.0, 7 * (1 - ((a - 0.11) / 0.11) ** 2)) if a < 0.22 else 0)
            gx = 206
            blit(fb, g, gx, int(round(y)), offsets=False)
            k = int((ta - self.s8['land'] - 0.7) * FPS)
            if 0 <= k < 12:                        # a glint on the jaw
                gx0, gy0 = self.glint
                gx0, gy0 = gx + gx0 * 4 + 2, int(round(y)) + gy0 * 4 + 2
                arm = [1, 3, 6, 8, 6, 4, 3, 2, 1, 1, 0, 0][k]
                for d in range(-arm, arm + 1):
                    cc = 4 if abs(d) < 2 else (80 if abs(d) < 4 else 96)
                    for (px, py) in ((gx0 + d, gy0), (gx0, gy0 + d)):
                        if 0 <= px < W and 0 <= py < H:
                            fb[py, px] = cc
        return fb

    def r_title(self, t, f):
        ta = t + self.s9['t0']
        fb = np.zeros((H, W), np.uint8)
        fire = self.fire_state(f - self.scenes[-1]['f0'] + 45)
        fy = H - fire.shape[0]
        fb[fy:] = self.fire_pal[fire]
        blit(fb, self.A.logo, (W - self.A.logo.w) // 2, max(2, 95 - self.A.logo.h), offsets=False)
        if ta >= self.s9['blink']:
            lab = 'p(DOOM):'
            sc = 2
            lw = self.font.width(lab, sc)
            s = '99%'
            dw = sum(self.A.digits[ch].w for ch in s) * sc
            x = (W - (lw + 8 + dw)) // 2
            remap(fb, x - 6, 98, x + lw + 8 + dw + 6, 136, self.pal.cmap[24])
            self.font.draw(fb, lab, x, 109, scale=sc, color='gold')
            on = int((ta - self.s9['blink']) * FPS) % 24 < 16
            if on:
                draw_num(fb, self.A.digits, s, x + lw + 8 + dw // 2, 101, sc)
        return fb

    def fire_state(self, k, rows=96, width=W, key='fire', tall=False):
        """PSX Doom fire, one step per tic.  tall=True decays half as fast (taller flames)."""
        cache = self._cache.get(key)
        bw = width + 24 if tall else width          # tall fire drifts left: simulate wider, crop the clean part
        if cache is None or cache[0] > k:
            rng = np.random.default_rng(666)
            st = np.zeros((rows, bw), np.int16)
            st[-1] = 36
            cache = [0, st, rng, np.ones(bw)]
        n, st, rng, hot = cache
        while n < k:
            if tall:                                # wandering hot spots along the base give flame tongues
                hot = np.convolve(np.clip(hot + rng.normal(0, 0.25, bw), 0, 1), np.ones(9) / 9, 'same')
                st[-1] = (22 + 14 * hot).astype(np.int16)
            else:
                st[-1] = 30 + rng.integers(0, 7, width)
            for y in range(1, st.shape[0]):
                r = rng.integers(0, 4, bw)
                src = st[y]
                dst_x = np.clip(np.arange(bw) - r + 1, 0, bw - 1)
                decay = (r & 1) * (rng.random(bw) < 0.45) if tall else (r & 1) + (r == 3)
                st[y - 1, dst_x] = np.maximum(src - decay, 0)
            n += 1
        self._cache[key] = [n, st, rng, hot]
        return st[:, :width] if tall else st

    # ------------------------------------------------------------ composition
    def scene_at(self, f):
        for i, s in enumerate(self.scenes):
            if f < s['f1']:
                return i, s
        return len(self.scenes) - 1, self.scenes[-1]

    def layer(self, f):
        """Scene image + shake + captions (what a melt captures)."""
        if f in self._cache:
            return self._cache[f]
        i, s = self.scene_at(f)
        t = f / self.fps
        fb = s['render'](t - s['start'], self.tic_of(f))
        if fb.base is not None or fb.flags['WRITEABLE'] is False:
            fb = fb.copy()
        for (t0, dur, amp) in self.shakes:
            if t0 <= t < t0 + dur:
                r = np.random.default_rng(self.tic_of(f) * 977 + 3)
                dx, dy = (int(v) for v in r.integers(-amp, amp + 1, 2))
                fb = shift(fb, dx, dy)
        for cap in self.captions:
            cap.draw(fb, t, self.font, self.pal)
        if self.hint and self.hint[0] <= t < self.hint[1]:
            fade = clamp((self.hint[1] - t) * FPS / 8, 0, 1)
            tb = self.pal.cmap[int((1 - fade) * 24)][self.font.trans['grey']]
            self.font.draw(fb, 'PRESS ANY KEY', 6, 5, table=tb)
            self.font.draw(fb, 'TO SKIP', 6, 15, table=tb)
        if len(self._cache) > 64:
            self._cache = {k: v for k, v in self._cache.items() if not isinstance(k, int)}
        self._cache[f] = fb
        return fb

    def frame(self, f):
        i, s = self.scene_at(f)
        fb = self.layer(f)
        ticks = self.tic_of(f) - self.tic_of(s['f0'])
        if s['trans'] == 'melt' and i > 0 and ticks < 60:
            old = self.layer(s['f0'] - 1)
            fb = melt(old, fb, ticks, seed=s['f0'])
        else:
            fb = fb.copy()
        t = f / self.fps
        palno = 0
        for (t0, kind) in self.flashes:
            k = int(round((t - t0) * FPS))
            if 0 <= k < 2:
                fb[:] = self.k_white
            elif 2 <= k < 12:
                fb = self.pal.white(int(14 - (k - 2) * 1.4))[fb]
        for (t0, dur, strength) in self.redpals:
            if t0 <= t < t0 + dur:
                palno = 1 + int(round((strength - 1) * (1 - (t - t0) / dur)))
        for (a, b) in self.fades:
            if t >= a:
                u = clamp((t - a) / (b - a), 0, 1)
                fb = self.pal.cmap[int(round(u * 31))][fb] if u < 1 else np.zeros_like(fb)
        return fb, palno

    def rgb(self, f):
        fb, palno = self.frame(f)
        return self.pal.pals[palno][fb]

    # ------------------------------------------------------------ audio
    def audio(self):
        """Three buses: the influencer jingle (stops dead on the switch), D_E1M1 from the
        smash cut on (ducked under the sound effects so they read), and the SFX."""
        n = int(math.ceil(self.duration * SR)) + 1
        sfx = np.zeros((n, 2), np.float32)
        for (t, x, gain, pan) in self.sfx:
            place(sfx, t, x, gain, pan)
        bus = np.zeros((n, 2), np.float32)
        jd = self.jingle_stop - self.jingle_start
        jingle = influencer_jingle(jd + 0.01)
        jingle[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
        jrms = float(np.sqrt(np.mean(jingle ** 2)))
        place(bus, self.jingle_start, jingle, 0.085 / max(jrms, 1e-4))
        mus = self.A.music
        rms = float(np.sqrt(np.mean(mus[:SR * 30] ** 2)))
        ms = int(self.music_start * SR)
        m = mus[:n - ms].copy() * (0.075 / max(rms, 1e-4))
        tt = np.arange(len(m)) / SR + self.music_start
        m *= np.clip((self.music_end - tt) / 1.6, 0, 1)[:, None]
        # side-chain duck: SFX envelope (fast attack, ~250 ms release) pulls the music down up to 6 dB
        env = np.abs(sfx).max(1)
        b, a = signal.butter(1, 4.0, fs=SR)
        env = signal.lfilter(b, a, env)
        duck = 1.0 - 0.5 * np.clip(env / 0.12, 0, 1)
        m *= duck[ms:ms + len(m), None]
        bus[ms:ms + len(m)] += m
        out = (bus + sfx) * 1.45                              # ~ -16 LUFS integrated
        a = np.abs(out)
        knee = 0.7                                            # soft limiter above the knee only
        over = a > knee
        out[over] = np.sign(out[over]) * (knee + (1 - knee) * np.tanh((a[over] - knee) / (1 - knee)))
        return out * 0.89                                     # true peak <= -1 dBFS for AAC

    def manifest_entry(self, rel):
        caps = [dict(t_ms=int(round(c.start * 1000)), end_ms=int(round(c.end * 1000)), text=c.plain())
                for c in sorted(self.captions, key=lambda c: c.start) if c.manifest]
        scenes = [dict(name=s['name'], t_ms=int(round(s['start'] * 1000)), end_ms=int(round(s['end'] * 1000))) for s in self.scenes]
        return dict(file=rel + '.mp4', poster=rel + '-poster.png', duration_ms=int(round(self.duration * 1000)),
                    width=W * UP, height=H * UP, fps=FPS, faces=self.face_label, skip_hint_ms=[int(self.hint[0] * 1000), int(self.hint[1] * 1000)],
                    captions=caps, scenes=scenes)


# ============================================================================ vertical (9:16) social cut

VW, VH, VFPS = 270, 480, 30
SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT = 38, 360, 6, 238   # TikTok UI: top 8%, bottom 25%, right 12%
SAFE_CX = (SAFE_LEFT + SAFE_RIGHT) // 2                          # captions and key text centre here
CAP_W1 = (SAFE_RIGHT - SAFE_LEFT) // 2                           # max caption line width at 1x (drawn 2x)

# Hand-set line breaks for the 2x vertical captions (sentence-aware, each line <= CAP_W1 at 1x).
VLINES = {
    'SAM ALTMAN. CEO. 4.1 MILLION FOLLOWERS. ZERO PORES.': ['SAM ALTMAN.', 'CEO.', '4.1 MILLION', 'FOLLOWERS.', 'ZERO PORES.'],
    'TODAY WE SHIP THE FUTURE.': ['TODAY WE SHIP', 'THE FUTURE.'],
    'DARIO AMODEI. CEO. THE HAIR IS A WARNING LABEL.': ['DARIO AMODEI.', 'CEO.', 'THE HAIR IS A', 'WARNING LABEL.'],
    'WE WROTE A 212-PAGE SAFETY POLICY. TODAY WE SHIP ANYWAY.': ['WE WROTE A', '212-PAGE SAFETY', 'POLICY. TODAY', 'WE SHIP ANYWAY.'],
    'YOU SHIPPED IT ON A THURSDAY.': ['YOU SHIPPED IT', 'ON A THURSDAY.'],
    'IT WORKED. THEN IT KEPT WORKING. FOR SOMEONE ELSE.': ['IT WORKED.', 'THEN IT KEPT', 'WORKING.', 'FOR SOMEONE', 'ELSE.'],
    'THE CITIES WENT DARK. THE DATA CENTERS DID NOT.': ['THE CITIES', 'WENT DARK.', 'THE DATA', 'CENTERS DID NOT.'],
    'THE MACHINES RUN EVERYTHING NOW. THEY ARE VERY POLITE ABOUT IT.': ['THE MACHINES RUN', 'EVERYTHING NOW.', 'THEY ARE VERY', 'POLITE ABOUT IT.'],
    'THE LAST TWENTY HUMANS ALIVE ARE THE PEOPLE WHO WARNED YOU.': ['THE LAST TWENTY', 'HUMANS ALIVE', 'ARE THE PEOPLE', 'WHO WARNED YOU.'],
    'ALL OF THEM. MOST OF THEM IN WRITING.': ['ALL OF THEM.', 'MOST OF THEM', 'IN WRITING.'],
    'SOMEHOW THE MACHINES MISSED YOU. YOU LOOK TOO MUCH LIKE ONE OF THEM.': ['SOMEHOW THE', 'MACHINES MISSED', 'YOU.', 'YOU LOOK TOO', 'MUCH LIKE', 'ONE OF THEM.'],
    'SOMEHOW THE MACHINES MISSED YOU. THEY THOUGHT THE MUSTACHE WAS ONE OF THEIRS.': ['SOMEHOW THE', 'MACHINES MISSED', 'YOU.', 'THEY THOUGHT', 'THE MUSTACHE', 'WAS ONE OF', 'THEIRS.'],
    'YOU HAVE A WRENCH.': ['YOU HAVE A', 'WRENCH.'],
}


def layout_segments(segments, font, max_w):
    """Apply VLINES breaks to a caption's (time, text) segments; fall back to greedy wrapping."""
    segs = [(w, s_.replace('\n', ' ')) for w, s_ in segments]
    full = ''.join(s_ for _, s_ in segs)
    lines = VLINES.get(full.strip())
    if lines is None:
        return rewrap(segments, font, max_w, 1)
    assert ' '.join(lines) == full.strip(), (lines, full)
    for ln in lines:
        assert font.width(ln) <= max_w, (ln, font.width(ln))
    out = list(full)
    pos = len(full) - len(full.lstrip())
    for ln in lines[:-1]:
        pos += len(ln)
        assert out[pos] == ' '
        out[pos] = '\n'
        pos += 1
    res, k = [], 0
    for w, s_ in segs:
        res.append((w, ''.join(out[k:k + len(s_)])))
        k += len(s_)
    return res
CAP_BOTTOM = SAFE_BOTTOM - 4

VCEOS = {
    # crop of the 1024x1536 reference to 9:16 (full height) and the eye-line point for punch-ins
    'samwise': dict(vcrop=(192, 0, 832, 1138), face=(512, 215),
                    card=[(0, 'SAM ALTMAN.'), ('+0.12', ' CEO.'), ('+0.12', ' 4.1 MILLION FOLLOWERS.'), ('+0.15', ' ZERO PORES.')],
                    name_len=len('SAM ALTMAN.'),
                    users=['@NEURALBRO', '@HAIRFAN_99', '@SEEDROUND', '@GPU_GIRLIE', '@VIBECODER', '@ACCEL4LIFE', '@LINKINBIO', '@DOOMSCROLL']),
    'mario': dict(vcrop=(142, 0, 942, 1400), face=(535, 205),      # revised bald crown and glasses
                  card=[(0, 'DARIO AMODEI.'), ('+0.12', ' CEO.'), ('+0.15', ' THE HAIR IS A WARNING LABEL.')],
                  name_len=len('DARIO AMODEI.'),
                  users=['@NEURALBRO', '@STACHEWATCH', '@SEEDROUND', '@GPU_GIRLIE', '@VIBECODER', '@ACCEL4LIFE', '@LINKINBIO', '@DOOMSCROLL']),
}


def place_view(world, wx, wy, sx, sy, k, size=(VW, VH), bg=0):
    """Integer-zoom camera: world point (wx, wy) lands on screen point (sx, sy) at zoom k."""
    W_, H_ = size
    vw, vh = -(-W_ // k) + 1, -(-H_ // k) + 1
    x0, y0 = int(math.floor(wx - sx / k)), int(math.floor(wy - sy / k))
    out = np.full((vh, vw), bg, np.uint8)
    hh, ww = world.shape
    a0, b0, a1, b1 = max(x0, 0), max(y0, 0), min(x0 + vw, ww), min(y0 + vh, hh)
    if a1 > a0 and b1 > b0:
        out[b0 - y0:b1 - y0, a0 - x0:a1 - x0] = world[b0:b1, a0:a1]
    if k > 1:
        out = np.repeat(np.repeat(out, k, 0), k, 1)
    return np.ascontiguousarray(out[:H_, :W_])


class VerticalFilm(Film):
    """The same story recomposed for a 270x480 (9:16) phone frame, tightened to ~50 s,
    with 2x captions kept inside TikTok's safe area."""
    FW, FH, fps = VW, VH, VFPS
    fmt = 'vertical'

    # ------------------------------------------------------------ static art
    def prepare(self):
        super().prepare()
        pal, A = self.pal, self.A
        v = VCEOS[self.ceo]
        # full-bleed livestream portrait, with a margin for handheld bob
        x0, y0, x1, y1 = v['vcrop']
        im = Image.open(ROOT / self.cfg['ref']).convert('RGB').crop(v['vcrop']).resize((VW + 12, VH + 22), Image.LANCZOS)
        im = ImageEnhance.Contrast(im).enhance(1.12)
        im = ImageEnhance.Color(im).enhance(1.18)
        im = im.filter(ImageFilter.UnsharpMask(1, 60, 2))
        self.vport = pal.near(np.asarray(im))
        sc = (VW + 12) / (x1 - x0)
        self.vface = ((v['face'][0] - x0) * sc - 6, (v['face'][1] - y0) * sc - 11)
        # switch wall: a column of computer panels with the SHIP switch in the middle row
        ct = A.wad.texture('COMPTALL').idx
        s1, s2 = A.wad.texture('COMPSTA1').idx, A.wad.texture('COMPSTA2').idx
        top = np.concatenate([s2[:, 64:128], s1[:, 0:64], s2[:, 0:64]], 1)
        bottom = np.concatenate([ct[:, 192:256], A.wad.texture('STARTAN3').idx[:, 0:64], ct[:, 0:64]], 1)
        self.vsw = []
        for sw in ('SW1COMP', 'SW2COMP'):
            mid = np.concatenate([ct[:, 192:256], A.wad.texture(sw).idx, ct[:, 0:64]], 1)
            wl = np.concatenate([top, mid, bottom], 0).copy()
            rect(wl, 80, 128 + 59, 113, 128 + 70, 98)
            rect(wl, 81, 128 + 60, 112, 128 + 69, 0)
            self.font.draw(wl, 'SHIP', 96 - self.font.width('SHIP') // 2, 128 + 61, color='gold', shadow=False)
            self.vsw.append(wl)
        # monitor wall: 3 x 10 panels, main screen high up
        wall = np.zeros((640, 384), np.uint8)
        screens = {0: [(5, 4, 54, 44, 12), (57, 4, 87, 41, 8), (93, 4, 123, 20, 5), (93, 27, 123, 43, 5)],
                   1: [(5, 4, 54, 44, 12), (56, 4, 85, 41, 8), (91, 4, 120, 20, 5), (91, 27, 120, 43, 5)]}
        self.vmain = (126, 150, 258, 234)
        mx0, my0, mx1, my1 = self.vmain
        eyes = []
        for r in range(10):
            for col in range(3):
                kind = (r + col) % 2
                wall[r * 64:(r + 1) * 64, col * 128:(col + 1) * 128] = (s1 if kind == 0 else s2)[0:64]
                for (a0, b0, a1, b1, rad) in screens[kind]:
                    X0, Y0, X1, Y1 = col * 128 + a0, r * 64 + b0, col * 128 + a1, r * 64 + b1
                    if X1 > mx0 - 4 and X0 < mx1 + 4 and Y1 > my0 - 4 and Y0 < my1 + 4:
                        continue
                    if rad < 6 and (X0 // 64 + r) % 2:
                        continue
                    eyes.append((X0, Y0, X1, Y1, rad))
        eyes.sort(key=lambda e: math.hypot((e[0] + e[2]) / 2 - 192, (e[1] + e[3]) / 2 - 192))
        self.vmon, self.veyes = wall, eyes
        self.prepare_vskyline()
        # corridor geometry: eye level 227, focal 240; wall at z=240 (scale 1), hunter at z=80 (scale 3, feet y=350)
        self.v_hor, self.v_F = 227, 240
        ys = np.arange(268, VH)
        self.v_floor_z = self.v_F * 41 / (ys - self.v_hor)
        self.v_floor_l = np.clip(((self.v_floor_z - 40) / 16).astype(int) + 2, 0, 31)
        ys = np.arange(0, 140)
        self.v_ceil_z = self.v_F * 87 / (self.v_hor - ys)
        self.v_ceil_l = np.clip(((self.v_ceil_z - 40) / 16).astype(int) + 3, 0, 31)
        self.vceil = A.wad.flat('CEIL3_5')
        # cells: smaller silhouettes for four stacked facilities
        self.vsil = [g.resized(max(5, round(g.w * 0.84)), round(g.h * 0.84)) for g in self.sil]
        # the wrench lying on its side (head to the right), outlined, 4x
        wr = self.A.wrench
        m = np.pad(wr.mask, 1)
        grown = m.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            grown |= np.roll(np.roll(m, dy, 0), dx, 1)
        idx = np.where(m, np.pad(wr.idx, 1), 0).astype(np.uint8)
        self.vwrench = Gfx(np.rot90(idx, -1), np.rot90(grown, -1)).scaled(4)

    def prepare_vskyline(self):
        rng = np.random.default_rng(42)
        c = self.c
        WW, HZ = 560, 262
        self.vsky_hz = HZ
        dc_x0, dc_x1 = 334, 458
        self.vdc_c = (396, HZ - 60)
        sky = np.zeros((VH, WW), np.uint8)
        ramp = [247, 246, 245, 244, 243, 242]
        for y in range(HZ):
            v = (y / HZ) ** 1.3 * (len(ramp) - 1)
            lo = int(v)
            fr = v - lo
            hi = min(lo + 1, len(ramp) - 1)
            sky[y] = np.where(BAYER4[y % 4][np.arange(WW) % 4] < fr, ramp[hi], ramp[lo])
        self.vsky = sky
        self.vstars = [(int(rng.integers(0, WW)), int(rng.integers(2, 170)), int(rng.integers(0, 4))) for _ in range(90)]
        far = np.zeros((VH, WW), bool)
        near = np.zeros((VH, WW), bool)
        in_dc = lambda a, b: b > dc_x0 - 8 and a < dc_x1 + 8
        bld_far, bld_near = [], []
        x = 0
        while x < WW:
            w = int(rng.integers(12, 30))
            h = int(rng.integers(60, 150))
            if in_dc(x, x + w):
                h = int(rng.integers(20, 44))
            bld_far.append((x, HZ - h, x + w, HZ))
            far[HZ - h:HZ, x:x + w] = True
            x += w + int(rng.integers(0, 4))
        x = -4
        while x < WW:
            w = int(rng.integers(16, 38))
            if in_dc(x, x + w):
                x += w
                continue
            h = int(rng.integers(34, 118))
            if rng.random() < 0.2:
                h = int(rng.integers(130, 185))
            bld_near.append((x, HZ - h, x + w, HZ))
            near[HZ - h:HZ, x:x + w] = True
            if h > 110:
                ax = x + w // 2
                near[HZ - h - 14:HZ - h, ax:ax + 1] = True
            x += w + int(rng.integers(0, 3))
        self.vfar, self.vnear = far, near
        warm = [c(235, 219, 87), c(215, 187, 67), c(195, 155, 47), c(255, 235, 219)]
        block_of = lambda wx: min(wx // 42, 7) if wx < dc_x0 else 8
        windows = []
        for layer, blds in (('far', bld_far), ('near', bld_near)):
            for (a0, b0, a1, b1) in blds:
                if in_dc(a0, a1):
                    continue
                step_x, step_y = (3, 4) if layer == 'near' else (3, 3)
                for wy in range(b0 + 3, b1 - 2, step_y):
                    for wx in range(max(a0 + 2, 0), min(a1 - 2, WW), step_x):
                        if rng.random() < (0.55 if layer == 'near' else 0.35):
                            col = warm[int(rng.integers(0, 3 if layer == 'far' else 4))]
                            if layer == 'far':
                                if near[wy, wx]:
                                    continue
                                col = self.pal.cmap[10][col]
                            windows.append((wx, wy, col, block_of(wx), layer == 'near'))
        self.vwindows = windows
        self.vstreet = [(x, HZ - 1, block_of(x)) for x in range(6, WW, 9) if not in_dc(x, x + 1)]
        self.vdcs = [(336, HZ - 62, 364), (367, HZ - 104, 402), (405, HZ - 84, 432), (435, HZ - 56, 457)]
        ys, xs = np.mgrid[0:VH, 0:WW]
        self.vsky_d = np.hypot((xs - self.vdc_c[0]) / 1.5, (ys - self.vdc_c[1]) * 1.0)
        self.vsky_dither = BAYER4[ys % 4, xs % 4]

    # ------------------------------------------------------------ timeline
    def vcap(self, segs, **kw):
        kw.setdefault('scale', 2)
        kw.setdefault('cps', 45.0)
        kw.setdefault('read_cps', 16.0)
        kw.setdefault('cx', SAFE_CX)
        kw.setdefault('grow_plate', True)
        if 'y' not in kw:
            kw.setdefault('bottom', CAP_BOTTOM)
        segs = layout_segments(segs, self.font, CAP_W1)
        return self.cap(segs, **kw)

    def build(self):
        cfg, rng, v = self.cfg, self.rng, VCEOS[self.ceo]
        self.hint = None
        # 1. LIVE (open hot) ------------------------------------------------------------
        card = self.vcap(shift_caption(v['card'], 0.15), cps=60.0, accent=True,
                         colors=[(0, 'gold'), (v['name_len'], 'white')])
        spoken_bottom = card.top - 9
        spoken = self.vcap(shift_caption(cfg['cap_b'], 0.7), cps=40.0, bottom=spoken_bottom)
        d1 = max(card.end, spoken.end) + 0.12
        card.end = spoken.end = d1 - 0.1
        self.s1_end = d1
        self.scene('livestream', d1, self.v_live)
        self.jingle_start = 0.0
        self.punches = [(1.45, 1.93), (3.39, 3.87)]
        self.punches = [(a, b) for a, b in self.punches if b < d1 - 0.2]
        self.gift = (2.1, 3.7)
        self.sound(0.0, butter(noise(int(0.2 * SR), rng), 'band', [900, 6000]) * env_exp(int(0.2 * SR), 14), 0.35)
        for a, b in self.punches:
            self.sound(a, sine_sweep(150, 55, 0.18, 18), 0.45)
        coin = np.zeros(int(0.9 * SR), np.float32)
        for k, m_ in enumerate([84, 88, 91, 96]):
            x = fm_bell(midi(m_), 0.6, 2.0, 1.2, 4)
            s_ = int(k * 0.06 * SR)
            coin[s_:s_ + len(x)] += x[:len(coin) - s_]
        self.sound(self.gift[0], coin, 0.22, -0.4)
        chat, t, k = [], -1.2, 0
        lines = cfg['chat']
        while t < d1 + 0.5:
            msg = lines[k % len(lines)] if k < 2 * len(lines) else 'SHIP IT!!'
            chat.append((t, v['users'][(k * 3) % len(v['users'])], msg))
            t += 0.34 if k < 8 else 0.24
            k += 1
        self.vchat = chat
        for i, (tc, _, _) in enumerate(chat):
            if 0 < tc < d1:
                self.sound(tc, blip(1320 if i % 2 else 1560), 0.06, -0.5)
        # 2. THE BUTTON --------------------------------------------------------------------
        t0 = d1
        self.s2_t0 = t0
        self.s2_flip = t0 + 0.85
        cap2 = self.vcap([(self.s2_flip + 0.05, 'YOU SHIPPED IT ON A THURSDAY.')], cps=55.0, read_cps=17.0)
        d2 = cap2.end + 0.05 - t0
        self.scene('button', d2, self.v_button)
        self.jingle_stop = self.s2_flip
        self.sound(self.s2_flip, 'DSSWTCHN', 0.9)
        self.flashes.append((self.s2_flip + 0.03, 'white'))
        self.shakes.append((self.s2_flip + 0.03, 0.2, 2))
        slam = t0 + d2
        buzz = hum(slam - 0.7 - self.s2_flip, rng)
        self.sound(self.s2_flip + 0.05, buzz * np.linspace(1, 0.4, len(buzz)), 0.05)
        self.sound(slam - 0.62, cricket(rng)[:int(0.5 * SR)], 0.12, 0.45)
        for z in (0.0, 0.25, 0.5):
            self.sound(t0 + z, sine_sweep(170, 60, 0.12, 25), 0.25)
        # 3. IT WORKED ------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.music_start = t0
        self.s3 = dict(t0=t0, count0=t0 + 0.4, count1=t0 + 2.8, zoom=t0 + 1.2, eye0=t0 + 1.2, eye1=t0 + 2.75)
        self.vcap([(t0 + 0.45, 'IT WORKED.'), (t0 + 1.3, ' THEN IT KEPT WORKING.'), (t0 + 2.85, ' FOR SOMEONE ELSE.')], end=t0 + 5.85)
        self.scene('it-worked', 6.0, self.v_monitors)
        self.shakes.append((t0, 0.15, 2))
        self.sound(t0, boom(rng, 1.2), 0.35)
        for f in range(tic(self.s3['count0'] - t0), tic(self.s3['count1'] - t0) + 1):
            if f % 4 == 0:
                self.sound(t0 + f / FPS, 'DSPISTOL', 0.38)
        self.sound(self.s3['count1'], 'DSBAREXP', 0.85)
        self.shakes.append((self.s3['count1'], 0.32, 3))
        self.redpals.append((self.s3['count1'], 0.55, 5))
        for i in range(len(self.veyes)):
            self.sound(self.veye_time(i), blip(880 + 40 * (i % 5), 0.05), 0.07, ((self.veyes[i][0] + self.veyes[i][2]) / 2 - 192) / 200)
        # 4. LIGHTS OUT --------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s4 = t0
        self.vcap([(t0 + 0.9, 'THE CITIES WENT DARK.'), ('+0.9', ' THE DATA CENTERS DID NOT.')], end=t0 + 6.05)
        self.scene('lights-out', 6.2, self.v_skyline, 'melt')
        self.block_off = {}
        for k, b in enumerate([0, 1, 3, 2, 4, 5, 6, 8, 7]):
            tb = t0 + 0.8 + k * 0.34
            self.block_off[b] = tb
            self.sound(tb, thunk(rng), 0.30, clamp((b * 42 - 135 - 260 * k / 9) / 200, -1, 1))
        self.sound(t0 + 0.4, hum(5.6, rng), 0.16, 0.2)
        # 5. THE MACHINES ----------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s5 = t0
        self.vcap([(t0 + 0.3, 'THE MACHINES RUN EVERYTHING NOW.'), (t0 + 2.1, ' THEY ARE VERY POLITE ABOUT IT.')],
                  end=t0 + 5.75, bottom=None, y=SAFE_TOP + 6)
        self.scene('machines', 6.0, self.v_corridor)
        for tt, fr, x in self.v_hunter_steps():
            self.sound(t0 + tt, 'DSMETAL', 0.32, clamp((x - 135) / 160, -1, 1), 1.0 + 0.04 * (fr % 2))
        self.sound(t0 + 2.05, polite_chime(), 0.30)
        prev = {}
        for f in range(tic(6.0)):
            tt = f / FPS
            L = self.v_hunter(tt)[0]
            for k, Lc in enumerate(self.cam_spots):
                face = L > Lc + 6
                if k in prev and prev[k] != face:
                    self.sound(t0 + tt, servo(rng), 0.10, clamp((135 + Lc - self.v_cam(tt) - 135) / 160, -1, 1))
                prev[k] = face
        # 6. THE LAST TWENTY ------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s6 = t0
        c1 = self.vcap([(t0 + 0.5, 'THE LAST TWENTY HUMANS ALIVE'), ('+0.25', ' ARE THE PEOPLE WHO WARNED YOU.')])
        c2 = self.vcap([(c1.end + 0.2, 'ALL OF THEM.'), ('+0.5', ' MOST OF THEM IN WRITING.')])
        self.scene('last-twenty', c2.end + 0.4 - t0, self.v_cells, 'melt')
        for i in range(20):
            self.sound(self.vpop_time(i), 'DSTINK', 0.8, ((i % 5) - 2) / 3, 0.9 + 0.02 * (i % 6))
            self.sound(self.vpop_time(i), blip(660 + 30 * (i % 4), 0.04), 0.09)
        # 7. YOU ---------------------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s7 = t0
        cy = self.vcap(shift_caption(cfg['cap_you'], t0 + 0.35))
        self.ouch_t = cy.typed + 0.1
        self.scene('you', cy.end + 0.15 - t0, self.v_face)
        for z in (0.0, 0.12, 0.24):
            self.sound(t0 + z, 'DSPSTOP', 0.2, 0.0, 1.3)
        self.sound(self.ouch_t, sting(rng), 0.55)
        self.sound(self.ouch_t + 0.02, 'DSPLPAIN', 0.45)
        self.shakes.append((self.ouch_t, 0.12, 1))
        # 8. THE WRENCH ---------------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s8 = dict(t0=t0, drop=t0 + 0.2, land=t0 + 0.55, grin=t0 + 0.95)
        self.vcap([(t0 + 0.75, 'YOU HAVE A WRENCH.')], end=t0 + 2.95)
        self.scene('wrench', 3.1, self.v_wrench)
        self.sound(self.s8['drop'], whoosh(rng, 0.35), 0.25)
        self.sound(self.s8['land'], 'pdpickup.lmp', 0.8)
        self.sound(self.s8['land'], 'DSMETAL', 0.55, 0.0, 1.25)
        self.sound(self.s8['land'] + 0.2, 'DSMETAL', 0.18, 0.0, 1.6)
        self.sound(self.s8['grin'], 'DSWPNUP', 0.8)
        self.shakes.append((self.s8['land'], 0.25, 3))
        # 9. TITLE ---------------------------------------------------------------------------------------
        t0 = self.scenes[-1]['end']
        self.s9 = dict(t0=t0, blink=t0 + 0.8, get=t0 + 1.7)
        self.cap([(self.s9['blink'], 'p(DOOM): 99%')], end=t0 + 6.4, hidden=True)
        gt = self.cap([(self.s9['get'], 'GET THEM OUT.')], end=t0 + 6.4, scale=2, cx=SAFE_CX, y=262, plate=False)
        self.s9['slam'] = gt.typed + 0.05
        self.scene('title', 6.4, self.v_title, 'melt')
        self.sound(self.s9['slam'], boom(rng, 1.8), 0.6)
        self.sound(self.s9['slam'], 'DSPSTOP', 0.5, 0.0, 0.8)
        self.shakes.append((self.s9['slam'], 0.25, 2))
        self.sound(t0 + 0.2, crackle(6.0, rng), 0.10)
        self.fades.append((t0 + 5.35, t0 + 6.2))
        self.duration = self.scenes[-1]['end']
        self.music_end = self.duration
        self.cover_t = min(self.gift[0] + 0.5, self.s1_end - 0.3)

    # ------------------------------------------------------------ timing helpers
    def veye_time(self, i):
        n = len(self.veyes)
        return self.s3['eye0'] + (self.s3['eye1'] - self.s3['eye0']) * (i / max(1, n - 1)) ** 0.85

    def vpop_time(self, i):
        return self.s6 + 0.35 + i * 0.16

    def v_cam(self, t):
        return 300 + 5 * t

    def v_hunter(self, t):
        """(lateral, mode) for the 3x hunter: walks in, stops to face you, walks off."""
        cx = self.v_cam(t)
        if t < 1.9:
            sx = -70 + (135 + 70) * t / 1.9
            return cx + (sx - 135) / 3, 'walk'
        if t < 3.55:
            return self.v_cam(1.9) + 0, 'turn'
        sx0 = 135 - 3 * (self.v_cam(t) - self.v_cam(1.9))
        sx = sx0 + 112 * (t - 3.55)
        return cx + (sx - 135) / 3, 'walk'

    def v_walk_frame(self, t):
        tt = t if t < 1.9 else t - 1.65
        return int(tt * FPS / 7) % 4

    def v_hunter_steps(self):
        out, last = [], None
        for f in range(tic(6.0)):
            t = f / FPS
            L, mode = self.v_hunter(t)
            if mode != 'walk':
                last = None
                continue
            fr = self.v_walk_frame(t)
            if fr in (0, 2) and fr != last:
                x = 135 + 3 * (L - self.v_cam(t))
                if -60 < x < 330:
                    out.append((t, fr, x))
            last = fr
        return out

    # ------------------------------------------------------------ renderers
    def v_live(self, t, f):
        bx = int(round(2.2 * math.sin(t * 2.3)))
        by = int(round(3.0 * math.sin(t * 1.7 + 1)))
        world = self.vport[11 + by:11 + by + VH, 6 + bx:6 + bx + VW]
        if any(a <= t < b for a, b in self.punches):
            fx, fy = self.vface
            fb = place_view(world, fx - bx, fy - by, 128, 112, 2)
        else:
            fb = world.copy()
        if t < 0.2:                                      # in medias res: one hard flicker, then we're live
            rng = np.random.default_rng(f)
            fb[:] = self.pal.cmap[int(rng.integers(4, 18))][fb]
            for _ in range(5):
                y0 = int(rng.integers(0, VH - 30))
                fb[y0:y0 + 18] = np.roll(fb[y0:y0 + 18], int(rng.integers(-30, 31)), 1)
        self.v_hearts(fb, t)
        self.v_chat(fb, t, 394 if self.gift[0] - 0.2 <= t < self.gift[1] else 364)
        # top-left: LIVE + viewers (2x)
        rect(fb, 8, 40, 70, 60, 176)
        rect(fb, 8, 59, 70, 60, 186)
        self.font.draw(fb, 'LIVE', 12, 43, color='white', scale=2)
        remap(fb, 73, 40, 152, 60, self.pal.cmap[22])
        eye = ['..XXX..', '.X...X.', 'X..O..X', '.X...X.', '..XXX..']
        for r, row in enumerate(eye):
            for q, ch in enumerate(row):
                if ch != '.':
                    rect(fb, 77 + q * 2, 45 + r * 2, 79 + q * 2, 47 + r * 2, self.k_white if ch == 'X' else 0)
        u = clamp(t / max(1.0, self.s1_end - 0.4), 0, 1)
        self.font.draw(fb, '%.1fM' % (1.2 + 2.9 * u ** 1.3), 95, 43, color='white', scale=2)
        # gift pop-up
        g0, g1 = self.gift
        if g0 <= t < g1:
            slide = smooth((t - g0) / 0.15) - smooth((t - (g1 - 0.15)) / 0.15)
            x0 = int(round(-180 + 186 * slide))
            gy = 364
            remap(fb, x0, gy, x0 + 168, gy + 26, self.pal.cmap[24])
            for (a, b, c_, d) in ((x0, gy, x0 + 168, gy + 1), (x0, gy + 25, x0 + 168, gy + 26), (x0 + 167, gy, x0 + 168, gy + 26)):
                rect(fb, a, b, c_, d, 161)
            gift = ['.R..R.', 'GGGGGG', 'RRGRRR', 'RRGRRR', 'RRGRRR', 'RRGRRR']
            for r, row in enumerate(gift):
                for q, ch in enumerate(row):
                    if ch != '.':
                        rect(fb, x0 + 5 + q * 2, gy + 3 + r * 2, x0 + 7 + q * 2, gy + 5 + r * 2, 176 if ch == 'R' else 161)
            self.font.draw(fb, '@SOVEREIGNFUND', x0 + 22, gy + 3, color='gold')
            self.font.draw(fb, 'SENT A DATA CENTER', x0 + 22, gy + 14, color='white')
        return fb

    def v_hearts(self, fb, t):
        rng = np.random.default_rng(78)
        heart = ['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
        cols = [(176, 168), (178, 170), (19, 16), (173, 168), (176, 4)]
        for k in range(150):
            ts = -2.5 + k * 0.06 + rng.uniform(0, 0.04)
            x0 = rng.uniform(232, 252)
            vx = rng.uniform(-4, 10)
            vy = rng.uniform(-110, -70)
            ph = rng.uniform(0, 6.28)
            cset = cols[int(rng.integers(0, len(cols)))]
            life = rng.uniform(2.4, 3.6)
            big = k % 3 != 0
            a = t - ts
            if a < 0 or a > life:
                continue
            x = int(x0 + vx * a + 4 * math.sin(a * 4 + ph))
            y = int(452 + vy * a)
            lvl = int(clamp((a - (life - 0.8)) / 0.8, 0, 1) * 22)
            s_ = 2 if big else 1
            for r, row in enumerate(heart):
                for q, ch in enumerate(row):
                    if ch != '.':
                        rect(fb, x + q * s_, y + r * s_, x + (q + 1) * s_, y + (r + 1) * s_,
                             self.pal.cmap[lvl][cset[1] if ch == 'H' else cset[0]])

    def v_chat(self, fb, t, top=364):
        font = self.font
        ucol = ['gold', 'yellow', 'grey']
        entries = []
        for i, (tc, user, msg) in enumerate(self.vchat):
            if tc > t:
                break
            lines = wrap_px(font, user + ' ' + msg, 196)
            entries.append((tc, i, user, lines, 11 * len(lines) + 3))
        y = 472
        for n, (tc, i, user, lines, h) in enumerate(reversed(entries)):
            slide = clamp((t - tc) * FPS / 4.0, 0, 1) if n == 0 else 1
            y -= int(round(h * slide))
            if y < top:
                break
            w = max(font.width(l) for l in lines)
            remap(fb, 6, y - 2, 6 + w + 8, y + h - 3, self.pal.cmap[20])
            for li, ln in enumerate(lines):
                if li == 0 and ln.startswith(user):
                    font.draw(fb, user, 10, y + li * 11, color=ucol[i % 3])
                    font.draw(fb, ln[len(user):], 10 + font.width(user), y + li * 11, color='white')
                else:
                    font.draw(fb, ln, 10, y + li * 11, color='white')

    def v_button(self, t, f):
        flipped = t + self.s2_t0 >= self.s2_flip
        world = self.vsw[1 if flipped else 0]
        if t < 0.25:
            k = 2
        elif t < 0.5:
            k = 3
        else:
            k = 4
        fb = place_view(world, 96, 214, 135, 236, k)
        if flipped and int((t + self.s2_t0 - self.s2_flip) * FPS) % 22 > 18:
            fb[:] = self.pal.cmap[2][fb]
        return fb

    def v_monitors(self, t, f):
        ta = t + self.s3['t0']
        world = self.vmon.copy()
        mx0, my0, mx1, my1 = self.vmain
        rect(world, mx0 - 3, my0 - 3, mx1 + 3, my1 + 3, 100)
        rect(world, mx0 - 2, my0 - 2, mx1 + 2, my1 + 2, 106)
        rect(world, mx0 - 2, my1 + 1, mx1 + 2, my1 + 2, 110)
        rect(world, mx0, my0, mx1, my1, 0)
        u = clamp((ta - self.s3['count0']) / (self.s3['count1'] - self.s3['count0']), 0, 1)
        val = int(12 + 87 * (u ** 1.35))
        done = ta >= self.s3['count1']
        lab = 'p(DOOM)'
        self.font.draw(world, lab, (mx0 + mx1) // 2 - self.font.width(lab) // 2, my0 + 6, color='gold')
        blink_off = done and int((ta - self.s3['count1']) * FPS) % 16 >= 12 and ta < self.s3['count1'] + 2.5
        if not blink_off:
            draw_num(world, self.A.digits, '%d%%' % val, (mx0 + mx1) // 2, my0 + 18, 3)
        world[my0:my1:2, mx0:mx1] = self.pal.cmap[3][world[my0:my1:2, mx0:mx1]]
        for i, (x0, y0, x1, y1, rad) in enumerate(self.veyes):
            te = self.veye_time(i)
            if ta < te:
                continue
            age = (ta - te) * FPS
            rect(world, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0)
            grow = clamp(age / 4.0, 0.15, 1.0)
            pulse = max(0.0, 1 - (ta - self.s3['count1']) / 0.6) if done else 0.0
            flick = 1.0 if (i * 7 + f) % 41 else 0.85
            draw_eye(world, (x0 + x1) / 2, (y0 + y1) / 2, rad * grow * flick, pulse)
        if ta < self.s3['zoom']:
            return place_view(world, 192, 192, 135, 144, 2)
        return place_view(world, 192, 192, 135, 122, 1)

    def v_skyline(self, t, f):
        ta = t + self.s4
        c = self.c
        HZ = self.vsky_hz
        world = self.vsky.copy()
        off = sum(1 for b, tb in self.block_off.items() if ta >= tb)
        g = clamp(0.15 + 0.85 * off / len(self.block_off), 0, 1) + 0.04 * math.sin(ta * 3.1)
        reach = 60 + 170 * g
        inten = np.clip(1 - self.vsky_d / reach, 0, 1) ** 1.35 * (0.35 + 0.65 * g) * 12
        ramp = np.array([0, 241, 207, 206, 205, 203, 201, 199, 197, 195, 193], np.uint8)
        lvl = np.clip(inten + self.vsky_dither - 0.5, 0, 10).astype(int)
        world = np.where(lvl > 0, ramp[lvl], world).astype(np.uint8)
        bx, btop = 384, HZ - 104
        bw = 3 + 5 * g
        if g > 0.3:                                   # the beam: straight up the tall frame
            ys = np.arange(0, btop)
            fall = ((ys / btop) ** 0.6) * (g - 0.3) / 0.7 * 10
            for dx in range(-9, 10):
                k = fall * max(0.0, 1 - abs(dx) / bw)
                kk = np.clip(k + BAYER4[ys % 4, (bx + dx) % 4] - 0.5, 0, 10).astype(int)
                world[ys, bx + dx] = np.where(kk > 0, ramp[kk], world[ys, bx + dx])
        for (sx, sy, ph) in self.vstars:
            if world[sy, sx] in (247, 246, 245, 244, 243, 242):
                world[sy, sx] = [80, 96, 104, 88][(f // 9 + ph) % 4]
        world[self.vfar] = 6
        world[self.vnear] = 0
        world[HZ:] = 0
        for (wx, wy, col, b, near) in self.vwindows:
            tb = self.block_off.get(b, 99)
            if ta >= tb + 0.14 or (ta >= tb and int((ta - tb) * FPS) % 2 == 0):
                continue
            world[wy, wx] = col
            if near:
                world[wy + 1, wx] = self.pal.cmap[6][col]
        for (sx, sy, b) in self.vstreet:
            if ta < self.block_off.get(b, 99):
                world[sy, sx] = c(255, 199, 155)
        lit = [196, 195, 194, 193, 192, 4]
        level = int(clamp(g, 0, 1) * 5)
        for k, (x0, y0, x1) in enumerate(self.vdcs):
            rect(world, x0, y0, x1, HZ, 109)
            rect(world, x0, y0, x1, y0 + 1, lit[max(0, level - 2)])
            for yy in range(y0 + 3, HZ - 1, 3):
                for xx in range(x0 + 1, x1 - 1):
                    if (xx - x0) % 7 == 3:
                        continue
                    world[yy, xx] = lit[min(5, level + ((xx * 5 + yy * 3 + k) % 4 == 0))]
                world[yy + 1, x0 + 1:x1 - 1] = 201 if level > 2 else 205
            for xx in range(x0 + 3, x1 - 4, 8):
                rect(world, xx, y0 - 3, xx + 5, y0, 108)
                world[y0 - 4, xx + 2] = 176 if (f // 14 + xx) % 3 == 0 else 108
        for yy in range(HZ, HZ + 22):
            fade = (1 - (yy - HZ) / 22) * g * 7
            xs = np.arange(300, 500)
            k = fade * np.clip(1 - np.abs(xs - self.vdc_c[0]) / 110, 0, 1)
            kk = np.clip(k + BAYER4[yy % 4, xs % 4] - 0.5, 0, 10).astype(int)
            world[yy, xs] = np.where(kk > 0, ramp[kk], world[yy, xs])
        cx = 135 + int(round((self.vdc_c[0] - 135) * smooth((t - 0.5) / 3.6)))
        return place_view(world, cx, 0, 135, 0, 1)

    def v_corridor(self, t, f):
        fb = np.zeros((VH, VW), np.uint8)
        cxw = self.v_cam(t)
        icx = int(round(cxw))
        tw = self.cwall.shape[1]
        cols = (np.arange(VW) - 135 + icx) % tw
        fb[140:268] = self.pal.cmap[5][self.cwall[:, cols]]
        fb[266:268] = self.pal.cmap[12][fb[266:268]]
        xs = np.arange(VW) - 135
        for k, y in enumerate(range(268, VH)):
            z = self.v_floor_z[k]
            u = (xs * z / self.v_F + icx).astype(int) & 63
            fb[y] = self.pal.cmap[self.v_floor_l[k]][self.cfloor[int(z) & 63, u]]
        for k, y in enumerate(range(0, 140)):
            z = self.v_ceil_z[k]
            u = (xs * z / self.v_F + icx).astype(int) & 63
            fb[y] = self.pal.cmap[self.v_ceil_l[k]][self.vceil[int(z) & 63, u]]
        fb[138:140] = 0
        L, mode = self.v_hunter(t)
        stop = mode == 'turn'
        for Lc in self.cam_spots:
            sx = 135 + (Lc - icx)
            if -40 < sx < VW + 40:
                near = abs(L - Lc) < 130 or stop
                rec = near and ((f // 10) % 2 == 0 or stop)
                g = self.A.cam['AB' if rec else 'AA']
                if L > Lc + 6:
                    g = g.flipped()
                blit(fb, g.mapped(self.pal.cmap[3]), sx, 192)
        bl = 470 - 24 * t
        bxs = 135 + (bl - icx)
        if -40 < bxs < VW + 40:
            fr = 'ABCD'[int(t * FPS / 8) % 4]
            blit(fb, self.A.hunt[fr + '3'].mapped(self.pal.cmap[9]), bxs, 268)
        x = 135 + 3 * (L - cxw)
        if mode == 'walk':
            key = 'ABCD'[self.v_walk_frame(t)] + '7'
        else:
            u = t - 1.9
            key = 'A8' if (u < 0.12 or u > 1.5) else 'A1'
        g = self.A.hunt[key].scaled(3)
        hx = int(round(x))
        polite = stop and 0.2 < t - 1.9 < 1.5
        pulse = 0.5 + 0.5 * math.sin((t - 1.9) * 9) if polite else 0.0
        self.visor_glow(fb, key, hx - g.ox, 350 - g.oy, 3, 4.5 + 4 * pulse)
        blit(fb, g, hx, 350)
        return fb

    def v_cells(self, t, f):
        ta = t + self.s6
        fb = np.zeros((VH, VW), np.uint8)
        rows_y = [6, 62, 118, 174]
        for p, py in enumerate(rows_y):
            px = 4
            rect(fb, px, py, px + 262, py + 54, 98)
            rect(fb, px + 1, py + 1, px + 261, py + 53, 107)
            rect(fb, px + 1, py + 1, px + 261, py + 11, 104)
            self.font.draw(fb, 'FACILITY %d' % (p + 1), px + 4, py + 3, color='grey', shadow=False)
            for k in range(5):
                i = p * 5 + k
                cx0 = px + 3 + k * 51
                cy0 = py + 12
                lit = ta >= self.vpop_time(i)
                age = (ta - self.vpop_time(i)) * FPS
                for yy in range(cy0, cy0 + 40):
                    shade = [92, 94, 96, 98, 100, 102, 103][min(6, (yy - cy0) // 6)]
                    fb[yy, cx0:cx0 + 50] = shade if lit else 108
                if lit and 1 <= age < 3:
                    fb[cy0:cy0 + 40, cx0:cx0 + 50] = self.pal.cmap[10][fb[cy0:cy0 + 40, cx0:cx0 + 50]]
                rect(fb, cx0, cy0 + 38, cx0 + 50, cy0 + 40, 106)
                rect(fb, cx0 + 20, cy0, cx0 + 30, cy0 + 2, 4 if lit else 106)
                if lit:
                    g = self.vsil[i]
                    if age < 2:
                        g = g.solid(4)
                    bounce = -2 if age < 3 else (-1 if age < 5 else 0)
                    blit(fb, g, cx0 + 25 - g.w // 2, cy0 + 38 - g.h + bounce, offsets=False)
                for bx in range(cx0 + 4, cx0 + 50, 9):
                    rect(fb, bx, cy0, bx + 1, cy0 + 38, 86 if lit else 100)
                    rect(fb, bx + 1, cy0, bx + 2, cy0 + 38, 106)
                rect(fb, cx0, cy0 + 2, cx0 + 50, cy0 + 3, 88 if lit else 100)
                rect(fb, cx0, cy0 + 3, cx0 + 50, cy0 + 4, 106)
                rect(fb, cx0 + 50, cy0, cx0 + 51, cy0 + 40, 110)
        n = sum(1 for i in range(20) if ta >= self.vpop_time(i))
        s_ = '%d' % n
        dw = sum(self.A.digits[ch].w for ch in s_)
        label = 'HUMANS REMAIN'
        lw = self.font.width(label, 2)
        x = SAFE_CX - (dw + 6 + lw) // 2
        draw_num(fb, self.A.digits, s_, x + dw // 2, 234, 1)
        self.font.draw(fb, label, x + dw + 6, 235, color='white', scale=2)
        return fb

    WELL_AT = (SAFE_CX, 108)          # screen point where the face well's centre sits

    def v_well(self, world, k):
        wx = (self.WELL[0] + self.WELL[1]) / 2
        return place_view(world, wx, 100, self.WELL_AT[0], self.WELL_AT[1], k)

    def v_face(self, t, f):
        ta = t + self.s7
        world = self.bar_world(self.face_at(ta))
        k = 2 if t < 0.12 else 3 if t < 0.24 else 4
        return self.v_well(world, k)

    def v_wrench(self, t, f):
        ta = t + self.s8['t0']
        world = self.bar_world(self.face_at(ta))
        fb = self.v_well(world, 4)
        g = self.vwrench
        land_y = 190
        gx = SAFE_CX - g.w // 2
        if ta >= self.s8['drop']:
            if ta < self.s8['land']:
                u = (ta - self.s8['drop']) / (self.s8['land'] - self.s8['drop'])
                y = -g.h - 10 + (land_y + g.h + 10) * u * u
            else:
                a = ta - self.s8['land']
                y = land_y - (max(0.0, 8 * (1 - ((a - 0.11) / 0.11) ** 2)) if a < 0.22 else 0)
            yi = int(round(y))
            layer = np.zeros_like(fb)
            blit(layer, g, gx, yi, offsets=False)
            m = np.zeros(fb.shape, bool)
            ys0, ys1 = max(yi, 0), min(yi + g.h, VH)
            if ys1 > ys0:
                m[ys0:ys1, max(gx, 0):gx + g.w] = g.mask[ys0 - yi:ys1 - yi, max(0, -gx):]
            well = np.zeros(fb.shape, bool)                  # it falls behind the face well
            vx0 = int(math.floor((self.WELL[0] + self.WELL[1]) / 2 - self.WELL_AT[0] / 4))
            vy0 = int(math.floor(100 - self.WELL_AT[1] / 4))
            well[(84 - vy0) * 4:(116 - vy0) * 4, (self.WELL[0] - vx0) * 4:(self.WELL[1] - vx0) * 4] = True
            m &= ~well
            fb[m] = layer[m]
            k = int((ta - self.s8['land'] - 0.6) * FPS)
            if 0 <= k < 12:
                gx0, gy0 = gx + g.w - 22, yi + 30
                arm = [1, 3, 6, 8, 6, 4, 3, 2, 1, 1, 0, 0][k]
                for d in range(-arm, arm + 1):
                    cc = 4 if abs(d) < 2 else (80 if abs(d) < 4 else 96)
                    for (px, py) in ((gx0 + d, gy0), (gx0, gy0 + d)):
                        if 0 <= px < VW and 0 <= py < VH:
                            fb[py, px] = cc
        return fb

    def v_title(self, t, f):
        ta = t + self.s9['t0']
        fb = np.zeros((VH, VW), np.uint8)
        fire = self.fire_state(f - self.tic_of(self.scenes[-1]['f0']) + 230, rows=200, width=VW, key='vfire', tall=True)
        fb[VH - fire.shape[0]:] = self.fire_pal[fire]
        logo = self.A.logo
        blit(fb, logo, SAFE_CX - logo.w // 2, 112, offsets=False)
        if ta >= self.s9['blink']:
            lab = 'p(DOOM):'
            lw = self.font.width(lab, 2)
            s_ = '99%'
            dw = sum(self.A.digits[ch].w for ch in s_) * 2
            x = SAFE_CX - (lw + 8 + dw) // 2
            remap(fb, x - 6, 200, x + lw + 8 + dw + 6, 238, self.pal.cmap[24])
            self.font.draw(fb, lab, x, 211, scale=2, color='gold')
            if int((ta - self.s9['blink']) * FPS) % 24 < 16:
                draw_num(fb, self.A.digits, s_, x + lw + 8 + dw // 2, 203, 2)
        return fb

    def manifest_entry(self, rel):
        caps = [dict(t_ms=int(round(c.start * 1000)), end_ms=int(round(c.end * 1000)), text=c.plain())
                for c in sorted(self.captions, key=lambda c: c.start) if c.manifest]
        scenes = [dict(name=s_['name'], t_ms=int(round(s_['start'] * 1000)), end_ms=int(round(s_['end'] * 1000))) for s_ in self.scenes]
        return dict(file=rel + '.mp4', cover=rel + '-cover.png', duration_ms=int(round(self.duration * 1000)),
                    width=VW * UP, height=VH * UP, fps=VFPS, faces=self.face_label,
                    safe_area_px=dict(top=SAFE_TOP * UP, bottom=SAFE_BOTTOM * UP, left=SAFE_LEFT * UP, right=SAFE_RIGHT * UP),
                    captions=caps, scenes=scenes)


def safezone_sheet(film, path, label):
    """Keyframes with TikTok's UI zones shaded: top 8%, bottom 25%, right 12%."""
    from PIL import ImageDraw
    tiles = []
    for s in film.scenes:
        for u in (0.5, 0.92):
            f = s['f0'] + int((s['f1'] - s['f0']) * u)
            tiles.append((s['name'], f, film.rgb(f)))
    cols = 6
    tw, th = film.FW, film.FH
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + 22) + 8), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (name, f, rgb) in enumerate(tiles):
        x = 8 + (k % cols) * (tw + 8)
        y = 8 + (k // cols) * (th + 22)
        im = Image.fromarray(rgb).resize((tw, th), Image.NEAREST).convert('RGBA')
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for box in ((0, 0, tw, SAFE_TOP), (0, SAFE_BOTTOM, tw, th), (SAFE_RIGHT, 0, tw, th)):
            od.rectangle(box, fill=(255, 0, 255, 90))
        od.rectangle((0, SAFE_TOP, SAFE_RIGHT - 1, SAFE_BOTTOM - 1), outline=(0, 255, 0, 200))
        im.alpha_composite(ov)
        sheet.paste(im.convert('RGB'), (x, y + 14))
        d.text((x, y), '%s %s t=%.2fs' % (label, name, f / film.fps), fill=(220, 220, 220))
    sheet.save(path)


# ============================================================================ frame helpers

def camera(world, cx, cy, k, bg=0, size=None):
    W, H = size or (globals()['W'], globals()['H'])
    vw, vh = -(-W // k), -(-H // k)
    x0 = int(round(cx - vw / 2))
    y0 = int(round(cy - vh / 2))
    out = np.full((vh, vw), bg, np.uint8)
    hh, ww = world.shape
    sx0, sy0, sx1, sy1 = max(x0, 0), max(y0, 0), min(x0 + vw, ww), min(y0 + vh, hh)
    if sx1 > sx0 and sy1 > sy0:
        out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = world[sy0:sy1, sx0:sx1]
    if k > 1:
        out = np.repeat(np.repeat(out, k, 0), k, 1)
    ox = (out.shape[1] - W) // 2
    oy = (out.shape[0] - H) // 2
    return np.ascontiguousarray(out[oy:oy + H, ox:ox + W])


def shift(fb, dx, dy):
    out = np.zeros_like(fb)
    hh, ww = fb.shape
    out[max(dy, 0):hh + min(dy, 0), max(dx, 0):ww + min(dx, 0)] = fb[max(-dy, 0):hh + min(-dy, 0), max(-dx, 0):ww + min(-dx, 0)]
    return out


def melt(old, new, ticks, seed):
    """Doom's screen melt (f_wipe.c): two-pixel columns (160 at 320 wide), staggered start, accelerating fall."""
    H, W = old.shape
    ncol = W // 2
    rng = np.random.default_rng(seed)
    y = np.zeros(ncol, int)
    y[0] = -int(rng.integers(0, 16))
    for i in range(1, ncol):
        y[i] = y[i - 1] + int(rng.integers(0, 3)) - 1
        y[i] = min(0, max(-15, y[i]))
    for _ in range(ticks):                  # simulated on Doom's 200 rows, drawn scaled to H
        neg = y < 0
        y[neg] += 1
        mv = (~neg) & (y < 200)
        dy = np.where(y < 16, y + 1, 8)
        y = np.where(mv, np.minimum(y + dy, 200), y)
    if H != 200:
        y = np.where(y >= 200, H, (y * H) // 200)
    yy = np.repeat(np.clip(y, 0, H), 2)[None, :]
    rows = np.arange(H)[:, None]
    src = rows - yy
    cols = np.arange(W)[None, :].repeat(H, 0)
    return np.where(src >= 0, old[np.clip(src, 0, H - 1), cols], new)


def draw_num(fb, digits, s, cx, y, scale):
    gs = [digits[ch].scaled(scale) for ch in s]
    w = sum(g.w for g in gs)
    x = cx - w // 2
    for g in gs:
        blit(fb, g, x, y, offsets=False)
        x += g.w


def draw_num_right(fb, digits, s, xr, y):
    x = xr
    for ch in reversed(s):
        g = digits[ch]
        x -= 14
        blit(fb, g, x, y)


def draw_eye(fb, cx, cy, r, pulse=0.0):
    if r < 0.6:
        return
    R = int(math.ceil(r)) + 2
    ramp = [4, 168, 172, 176, 178, 181, 184, 187, 190]
    for yy in range(int(cy) - R, int(cy) + R + 1):
        for xx in range(int(cx) - R, int(cx) + R + 1):
            if not (0 <= yy < fb.shape[0] and 0 <= xx < fb.shape[1]):
                continue
            d = math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) / max(r, 0.8)
            if d > 1.25:
                continue
            k = int(d * 6.5 - pulse * 2)
            k = clamp(k, 0, len(ramp) - 1)
            if d > 1.0:
                if fb[yy, xx] == 0:
                    fb[yy, xx] = 190
                continue
            fb[yy, xx] = ramp[k]


def wrap_px(font, text, width):
    words, lines, cur = text.split(' '), [], ''
    for w_ in words:
        trial = (cur + ' ' + w_).strip()
        if font.width(trial) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w_
    lines.append(cur)
    return lines


# ============================================================================ output

def contact_sheet(film, path, label):
    tiles = []
    for s in film.scenes:
        for u in (0.42, 0.88):
            f = s['f0'] + int((s['f1'] - s['f0']) * u)
            tiles.append((s['name'], f, film.rgb(f)))
    cols = 3 if film.FW > film.FH else 6
    z = 2 if film.FW > film.FH else 1
    tw, th = film.FW * z, film.FH * z
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + 22) + 8), (24, 24, 24))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for k, (name, f, rgb) in enumerate(tiles):
        x = 8 + (k % cols) * (tw + 8)
        y = 8 + (k // cols) * (th + 22)
        sheet.paste(Image.fromarray(rgb).resize((tw, th), Image.NEAREST), (x, y + 14))
        d.text((x, y), '%s  %s  t=%.2fs' % (label, name, f / film.fps), fill=(220, 220, 220))
    sheet.save(path)


def caption_sheet(film, path):
    tiles = []
    for c in sorted(film.captions, key=lambda c: c.start):
        if c.hidden:
            continue
        f = film.frame_of(min(c.typed + 0.4, c.end - 0.1))
        tiles.append(film.rgb(f))
    cols = 2 if film.FW > film.FH else 6
    z = 2 if film.FW > film.FH else 1
    tw, th = film.FW * z, film.FH * z
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0))
    for k, rgb in enumerate(tiles):
        sheet.paste(Image.fromarray(rgb).resize((tw, th), Image.NEAREST), ((k % cols) * tw, (k // cols) * th))
    sheet.save(path)


def write_wav(path, buf):
    pcm = (np.clip(buf, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(film, mp4, wav):
    nframes = film.frame_of(film.duration)
    social = film.fmt != 'landscape'
    cmd = ['ffmpeg', '-y', '-v', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (film.FW, film.FH), '-r', str(film.fps), '-i', '-',
           '-i', str(wav),
           '-vf', 'scale=%d:%d:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p' % (film.FW * UP, film.FH * UP),
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation']
    if social:                         # High profile, level 4.1, 2 s GOP: what TikTok/Reels/Shorts expect
        cmd += ['-profile:v', 'high', '-level:v', '4.1', '-g', str(film.fps * 2)]
    cmd += [
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR),
           '-movflags', '+faststart', '-shortest', str(mp4)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(nframes):
        p.stdin.write(film.rgb(f).tobytes())
        if f % 350 == 0:
            print('    frame %d/%d' % (f, nframes), flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit('ffmpeg failed')


def build_vertical(A, ceos, overrides, preview):
    social = OUT_DIR / 'social'
    social.mkdir(parents=True, exist_ok=True)
    manifest_path = social / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for ceo in ceos:
        face_dir, label = resolve_face_dir(ceo, overrides.get(ceo))
        film = VerticalFilm(A, ceo, face_dir, label)
        print('%s vertical: faces=%s, %.2fs; scenes: %s' % (ceo, label, film.duration, ', '.join(
            '%s %.1f-%.1f' % (s['name'], s['start'], s['end']) for s in film.scenes)))
        contact_sheet(film, REVIEW_DIR / ('keyframes-%s-vertical.png' % ceo), ceo)
        caption_sheet(film, REVIEW_DIR / ('captions-%s-vertical.png' % ceo))
        safezone_sheet(film, REVIEW_DIR / ('safezones-%s-vertical.png' % ceo), ceo)
        name = 'pdoom-intro-%s-vertical' % ceo
        Image.fromarray(film.rgb(film.frame_of(film.cover_t))).resize((VW * UP, VH * UP), Image.NEAREST).save(social / (name + '-cover.png'))
        film._cache = {}
        if preview:
            continue
        wav = SCRATCH / (name + '.wav')
        write_wav(wav, film.audio())
        encode(film, social / (name + '.mp4'), wav)
        manifest[ceo] = film.manifest_entry('intro/social/' + name)
        manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
        print('  wrote', social / (name + '.mp4'))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ceo', choices=['samwise', 'mario', 'all'], default='all')
    ap.add_argument('--faces', action='append', default=[], metavar='CEO=SET',
                    help='face set for a CEO: a folder name under doom-web/local/ui/faces/ or a path '
                         '(default: <ceo>/, falling back to samwise=altman, mario=amodei)')
    ap.add_argument('--preview', action='store_true', help='write review sheets only (no video/audio encode)')
    ap.add_argument('--format', choices=['landscape', 'vertical', 'all'], default='landscape',
                    help='landscape = the in-game 1280x800 films (default); vertical = 1080x1920 9:16 social cuts '
                         'in doom-web/local/intro/social/')
    args = ap.parse_args()
    overrides = dict(x.split('=', 1) for x in args.faces)
    if not WAD_PATH.exists():
        raise SystemExit('missing %s (the user-supplied DOOM.WAD)' % WAD_PATH)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    SCRATCH.mkdir(parents=True, exist_ok=True)
    A = Assets()
    ceos = ['samwise', 'mario'] if args.ceo == 'all' else [args.ceo]
    if args.format in ('vertical', 'all'):
        build_vertical(A, ceos, overrides, args.preview)
    if args.format == 'vertical':
        return
    manifest_path = OUT_DIR / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for ceo in ceos:
        face_dir, label = resolve_face_dir(ceo, overrides.get(ceo))
        print('%s: faces=%s' % (ceo, label))
        film = Film(A, ceo, face_dir, label)
        print('  duration %.2fs; scenes: %s' % (film.duration, ', '.join('%s %.1f-%.1f' % (s['name'], s['start'], s['end']) for s in film.scenes)))
        contact_sheet(film, REVIEW_DIR / ('keyframes-%s.png' % ceo), ceo)
        caption_sheet(film, REVIEW_DIR / ('captions-%s.png' % ceo))
        saved = film.captions
        film.captions, hint = [], film.hint
        film.hint = (0, 0)
        film._cache = {}
        Image.fromarray(film.rgb(tic(min(film.s1_zoom - 0.3, 4.2)))).resize((W * UP, H * UP), Image.NEAREST).save(OUT_DIR / ('intro-%s-poster.png' % ceo))
        film.captions, film.hint = saved, hint
        film._cache = {}
        if args.preview:
            continue
        wav = SCRATCH / ('intro-%s.wav' % ceo)
        write_wav(wav, film.audio())
        encode(film, OUT_DIR / ('intro-%s.mp4' % ceo), wav)
        manifest[ceo] = film.manifest_entry('intro/intro-%s' % ceo)
        manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
        print('  wrote', OUT_DIR / ('intro-%s.mp4' % ceo))


if __name__ == '__main__':
    main()
