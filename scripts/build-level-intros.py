#!/usr/bin/env python3
"""Composite the per-level intro films for p(DOOM) from real engine fly-through footage.

Each film: the episode + level title card on Doom's intermission map, a fly-through of
the level's signature spaces captured from the running GZDoom engine
(scripts/capture-level-flythrough.mjs), the guardian's name card, three rules and a
bark over its own footage, a lineup of the five prisoners (their in-game sprites and
names), and a FREE THEM. tag with the p(DOOM) logo.

Style, font, captions, melts and the p(DOOM) logo come from scripts/build-intro-cutscene.py
(imported, never modified). Overlays are drawn at Doom resolution (320x200 landscape,
270x480 vertical) in PLAYPAL with STCFN, and scaled exactly 4x over the 4x-resolution
engine footage. Everything is driven by scripts/level-intros.json.

    node scripts/capture-level-flythrough.mjs --map E1M4                     # footage (once per format)
    node scripts/capture-level-flythrough.mjs --map E1M4 --format vertical
    python3 scripts/build-level-intros.py                                      # all built levels, both formats
    python3 scripts/build-level-intros.py --map E1M7 --format vertical
    python3 scripts/build-level-intros.py --preview                            # review sheets only, no encode

Outputs (git-ignored, derived from DOOM.WAD and engine renders)
    doom-web/local/intro/levels/<map>-intro.mp4            1280x800, 35 fps, H.264 + AAC
    doom-web/local/intro/levels/<map>-intro-vertical.mp4   1080x1920, 30 fps, H.264 High@4.1 + AAC
    doom-web/local/intro/levels/<map>-intro[-vertical]-poster.png, manifest.json
    output/intro/levels/keyframes-<map>[-vertical].png, captions-<map>[-vertical].png, safezones-<map>-vertical.png,
    mp4-captions-<map>[-vertical].png (every caption grabbed back out of the encoded MP4)
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('intro_cutscene', ROOT / 'scripts' / 'build-intro-cutscene.py')
ic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ic)

LOCAL = ROOT / 'doom-web' / 'local'
OUT = LOCAL / 'intro' / 'levels'
RAW_DIRS = [OUT / 'raw-v2', OUT / 'raw']   # new captures first; the v1 footage in raw/ is only ever read
REVIEW = ROOT / 'output' / 'intro' / 'levels'
SCRATCH = Path('/tmp/pdoom-level-intros')
DATA = ROOT / 'scripts' / 'level-intros.json'
SPRITES = ROOT / 'doom-mod' / 'sprites'
UP, SR = 4, ic.SR
SENT = 250                       # overlay "empty" index: PLAYPAL 250-254 are never produced by the font tables
clamp, smooth = ic.clamp, ic.smooth

FORMATS = {
    'landscape': dict(W=320, H=200, fps=35, raw=''),
    'vertical': dict(W=ic.VW, H=ic.VH, fps=ic.VFPS, raw='-vertical'),
}


# ============================================================================ assets

class Assets:
    """The subset of the opening film's assets the level intros need (read-only)."""

    def __init__(self):
        self.wad = ic.Wad()
        self.pal = self.wad.pal
        self.font = ic.Font(self.wad)
        logo = LOCAL / 'intro' / 'title-logo.png'
        if not logo.exists():
            raise SystemExit('missing %s: run python3 scripts/build-intro-cutscene.py --preview once' % logo)
        self.logo = ic.load_png(self.pal, logo, (0, 0))
        self.snd = {}
        self._music = {}
        self._sprites = {}

    def sprite(self, name):
        if name not in self._sprites:
            self._sprites[name] = ic.load_png(self.pal, SPRITES / (name + '.png'), (0, 0))
        return self._sprites[name]

    def sound(self, name, pitch=1.0):
        key = (name, pitch)
        if key not in self.snd:
            if name.lower().endswith('.lmp'):
                self.snd[key] = ic.dmx_to_float((ROOT / 'doom-mod' / 'sounds' / 'pdoom' / name).read_bytes(), pitch)
            else:
                self.snd[key] = self.wad.sound(name, pitch)
        return self.snd[key]

    def music(self, path):
        if path not in self._music:
            self._music[path] = ic.load_music(ROOT / path)
        return self._music[path]


# ============================================================================ overlay layer + captions

class Layer:
    """Doom-resolution overlay: palette indices (SENT = transparent) and a darkening factor."""

    def __init__(self, W, H):
        self.idx = np.full((H, W), SENT, np.uint8)
        self.dim = np.ones((H, W), np.float32)

    def plate(self, x0, y0, x1, y1, factor):
        H, W = self.idx.shape
        x0, y0, x1, y1 = max(int(x0), 0), max(int(y0), 0), min(int(x1), W), min(int(y1), H)
        if x1 > x0 and y1 > y0:
            self.dim[y0:y1, x0:x1] = np.minimum(self.dim[y0:y1, x0:x1], factor)


def level_factor(level):
    """Brightness of COLORMAP row `level` (0 = full, 31 = black), for plates over true-colour footage."""
    return max(0.0, (32 - level) / 32.0) ** 1.15


def draw_caption(cap, t, font, pal, L):
    """ic.Caption.draw, but onto an overlay Layer: plates darken the footage below instead of
    remapping palette indices.  Timing, type-on, grow_plate, accent and the 5-tic fade are identical."""
    if cap.hidden or not (cap.start <= t < cap.end):
        return
    HH, WW = L.idx.shape
    sc = cap.scale
    lh = 11 * sc
    widths = [font.width(l, sc) for l in cap.lines]
    block_h = cap.block_h
    if cap.bottom is not None:
        top = cap.bottom - block_h
    elif cap.y is not None:
        top = cap.y
    elif cap.where == 'top':
        top = 7
    else:
        top = HH - 7 - block_h
    cx2 = WW if cap.cx is None else 2 * cap.cx
    left_edge = (cx2 - max(widths)) // 2
    fade = clamp((cap.end - t) * ic.FPS / 5.0, 0.0, 1.0)
    if cap.plate:
        pad_x, pad_y = (6, 4) if sc == 1 else (7, 5)
        level = int(round(4 + 20 * fade))
        px0, px1, ph = left_edge, left_edge + max(widths), block_h
        if cap.grow_plate:
            started, k = [], 0
            for li, line in enumerate(cap.lines):
                if line and cap.char_t[k] <= t:
                    started.append(li)
                k += len(line) + 1
            n_on = (started[-1] + 1) if started else 1
            ws = [widths[i] for i in range(n_on)]
            px0, px1, ph = (cx2 - max(ws)) // 2, (cx2 - max(ws)) // 2 + max(ws), lh * n_on - 3 * sc
        L.plate(px0 - pad_x, top - pad_y, px1 + pad_x, top + ph + pad_y + 1, level_factor(level))
        if cap.accent:
            ic.rect(L.idx, px0 - pad_x, top - pad_y, px0 - pad_x + 3, top + ph + pad_y + 1, pal.cmap[int(round((1 - fade) * 24))][176])

    def table_for(color):
        tb = font.trans[color]
        return pal.cmap[int(round((1 - fade) * 24))][tb] if fade < 1 else tb

    k = 0
    for li, line in enumerate(cap.lines):
        x = (cx2 - widths[li]) // 2 if getattr(cap, 'left', None) is None else cap.left
        count = 0
        for ch in line:
            if cap.char_t[k] <= t:
                count += 1
            k += 1
        k += 1
        if not cap.colors:
            font.draw(L.idx, line, x, top + li * lh, scale=sc, count=count, table=table_for(cap.color))
            continue
        k0 = k - len(line) - 1

        def colour_at(ix):
            c_ = cap.color
            for (start, col) in cap.colors:
                if ix >= start:
                    c_ = col
            return c_
        i, gx = 0, x
        while i < len(line):
            col = colour_at(k0 + i)
            j = i
            while j < len(line) and colour_at(k0 + j) == col:
                j += 1
            run = line[i:j]
            font.draw(L.idx, run, gx, top + li * lh, scale=sc, count=max(0, min(len(run), count - i)), table=table_for(col))
            gx += font.width(run, sc)
            i = j


def wrap_segments(segments, font, max_w, scale=1, lines=None):
    """Hand-set breaks (`lines`, joined by spaces = the text) or greedy re-wrapping, keeping segment timing."""
    segs = [(w, s.replace('\n', ' ')) for w, s in segments]
    full = ''.join(s for _, s in segs)
    if not lines:
        return ic.rewrap(segments, font, max_w, scale)
    assert ' '.join(lines) == full.strip(), (lines, full)
    for ln in lines:
        assert font.width(ln) <= max_w, 'line too wide for the safe area: %r (%d > %d)' % (ln, font.width(ln), max_w)
    out = list(full)
    pos = len(full) - len(full.lstrip())
    for ln in lines[:-1]:
        pos += len(ln)
        assert out[pos] == ' ', (ln, full)
        out[pos] = '\n'
        pos += 1
    res, k = [], 0
    for w, s in segs:
        res.append((w, ''.join(out[k:k + len(s)])))
        k += len(s)
    return res


# ============================================================================ frame helpers

def to_rgb(pal, fb, palno=0):
    rgb = pal.pals[palno][fb]
    return np.repeat(np.repeat(rgb, UP, 0), UP, 1)


def melt_offsets(ticks, seed, H):
    """Doom's f_wipe.c column offsets (160 columns of 2 px on 200 rows), scaled to H rows."""
    rng = np.random.default_rng(seed)
    y = np.zeros(160, int)
    y[0] = -int(rng.integers(0, 16))
    for i in range(1, 160):
        y[i] = min(0, max(-15, y[i - 1] + int(rng.integers(0, 3)) - 1))
    for _ in range(ticks):
        neg = y < 0
        y[neg] += 1
        mv = (~neg) & (y < 200)
        dy = np.where(y < 16, y + 1, 8)
        y = np.where(mv, np.minimum(y + dy, 200), y)
    return np.clip(np.where(y >= 200, H, (y * H) // 200), 0, H)


def melt_rgb(old, new, ticks, seed):
    H, W = old.shape[:2]
    cols = melt_offsets(ticks, seed, H)
    ncol = len(cols)
    colw = W / ncol
    xs = np.minimum((np.arange(W) / colw).astype(int), ncol - 1)
    off = cols[xs]                                   # per output column
    rows = np.arange(H)[:, None]
    src = rows - off[None, :]
    take_old = src >= 0
    out = new.copy()
    ys = np.clip(src, 0, H - 1)
    xg = np.broadcast_to(np.arange(W)[None, :], (H, W))
    out[take_old] = old[ys[take_old], xg[take_old]]
    return out


def shake(img, dx, dy):
    out = np.zeros_like(img)
    H, W = img.shape[:2]
    out[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = img[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return out


class Footage:
    """A captured shot: PNG frames at the film's frame rate, loaded lazily (a small cache)."""

    def __init__(self, folder, trim=(0, 0), gamma=1.0, span=None, fps=35):
        self.lut = (255 * (np.arange(256) / 255.0) ** (1.0 / gamma) + 0.5).astype(np.uint8) if gamma != 1.0 else None
        self.files = sorted(folder.glob('*.png'))
        if not self.files:
            raise SystemExit('no footage in %s: run scripts/capture-level-flythrough.mjs first' % folder)
        # drop leading frames the engine rendered black while the camera crossed into a new sector
        lead = 0
        while lead < 20 and lead + 1 < len(self.files) and np.asarray(Image.open(self.files[lead]).convert('L')).mean() < 2.0:
            lead += 1
        a, b = trim
        self.files = self.files[lead + a:len(self.files) - b if b else None]
        self.lead = lead
        if span:                                       # [start, end] in seconds of the captured shot
            i0 = int(round(span[0] * fps))
            i1 = int(round(span[1] * fps)) if span[1] else len(self.files)
            self.files = self.files[i0:i1]
        self._cache = {}

    def __len__(self):
        return len(self.files)

    def frame(self, i):
        i = int(clamp(i, 0, len(self.files) - 1))
        if i not in self._cache:
            if len(self._cache) > 6:
                self._cache.clear()
            img = np.asarray(Image.open(self.files[i]).convert('RGB'))
            self._cache[i] = self.lut[img] if self.lut is not None else img
        return self._cache[i]


# ============================================================================ the film

class LevelFilm:
    def __init__(self, A, key, cfg, fmt):
        self.A, self.key, self.cfg, self.fmt = A, key, cfg, fmt
        f = FORMATS[fmt]
        self.W, self.H, self.fps = f['W'], f['H'], f['fps']
        self.vertical = fmt == 'vertical'
        self.film = cfg['film']
        self.pal, self.font = A.pal, A.font
        self.raws = [d / (key.lower() + f['raw']) for d in RAW_DIRS]
        self.plans, self.player = {}, None
        for d in reversed(self.raws):                  # raw-v2 entries win
            cj = d / 'capture.json'
            if cj.exists():
                c = json.loads(cj.read_text())
                self.plans.update({p_['name']: p_ for p_ in c.get('plan', [])})
                self.player = c.get('player') or self.player
        self.scenes, self.captions, self.sfx = [], [], []
        self.shakes, self.flashes, self.fades = [], [], []
        self.rng = np.random.default_rng(int.from_bytes(key.encode(), 'little') % 99991)
        self._cache = {}
        self.build()

    # ------------------------------------------------------------ helpers
    def frame_of(self, t):
        return int(round(t * self.fps))

    def tic_of(self, f):
        return f if self.fps == ic.FPS else int(math.floor(f * ic.FPS / self.fps + 1e-6))

    def cap(self, segs, lines=None, **kw):
        """A caption in the opening film's style: 1x bottom-centred in landscape; 2x inside
        TikTok's safe area in the vertical cut (read once at 16 chars/s + 0.8 s)."""
        kw.setdefault('read_cps', 16.0)
        kw['max_chars'] = 40
        sc = kw.get('scale', 1)
        if self.vertical:
            kw.setdefault('scale', 2)
            sc = kw['scale']
            kw.setdefault('cps', 45.0)
            kw.setdefault('cx', ic.SAFE_CX)
            kw.setdefault('grow_plate', True)
            if 'y' not in kw:
                kw.setdefault('bottom', ic.CAP_BOTTOM)
            segs = wrap_segments(segs, self.font, ic.CAP_W1 * 2 // sc, 1, lines)
        elif '\n' not in ''.join(s_ for _, s_ in segs):
            segs = wrap_segments(segs, self.font, kw.pop('wrap', 306) // sc, 1, lines)
        kw.pop('wrap', None)
        c = ic.Caption(segs, **kw)
        self.captions.append(c)
        return c

    def sound(self, t, name_or_x, gain=1.0, pan=0.0, pitch=1.0):
        x = self.A.sound(name_or_x, pitch) if isinstance(name_or_x, str) else name_or_x
        self.sfx.append((t, x, gain, pan))

    def scene(self, name, dur, render, trans='cut', **extra):
        t0 = self.scenes[-1]['end'] if self.scenes else 0.0
        s = dict(name=name, start=t0, end=t0 + dur, render=render, trans=trans,
                 f0=self.frame_of(t0), f1=self.frame_of(t0 + dur), **extra)
        self.scenes.append(s)
        return s

    def seg(self, item, t0):
        """JSON caption -> segments.  "text" may contain " | " for a pause-and-new-line beat."""
        parts = item['text'].split(' | ')
        segs = [(t0 + item.get('at', 0.3), parts[0])]
        for p in parts[1:]:
            segs.append(('+%.2f' % item.get('pause', 0.5), '\n' + p))
        return segs

    # ------------------------------------------------------------ build the timeline
    def build(self):
        """v2: title -> overview (no captions) -> the rogue AI -> objective -> GO on the player's start view."""
        F = self.film
        self.build_title()
        for i, sh in enumerate(F['overview']):
            self.build_shot(sh, first=(i == 0))
        self.build_guardian()
        self.build_objective()
        self.build_go()
        self.duration = self.scenes[-1]['end']

    # ---- title
    def build_title(self):
        """Doom's intermission map: EPISODE n, the episode name, ENTERING, the map and the title card,
        typed in a fast cascade; every line stays up long enough to be read once."""
        F, A = self.film, self.A
        self.bg_map = A.wad.patch(F.get('titleMap', 'WIMAP0'))
        self.enter = A.wad.patch('WIENTER')
        self.urh = [A.wad.patch('WIURH0'), A.wad.patch('WIURH1')]
        ep = 'EPISODE %d:' % F['episode']
        V = self.vertical
        cA = self.cap([(0.05, ep)], y=44 if V else 6, scale=2 if V else 1, color='gold', plate=True, grow_plate=False, cps=70.0)
        cB = self.cap([(0.12, F['episodeName'])], lines=F.get('vEpisodeLines') if V else None, y=(66 if V else 17), scale=2,
                      plate=True, cps=60.0)
        t_enter = 0.24
        self.t_enter = t_enter
        if V:
            self.enter_y = 66 + 22 * len(cB.lines) + 6
            cC = self.cap([(t_enter + 0.04, F['map'])], y=self.enter_y + 17, scale=1, color='grey', plate=True, grow_plate=False, cps=70.0)
            cD = self.cap([(t_enter + 0.08, F['title'])], lines=F.get('vTitleLines'), y=self.enter_y + 29, scale=2, plate=True, cps=60.0)
            self.map_y = self.enter_y + 29 + 22 * len(cD.lines) + 4
        else:
            self.enter_y = 146
            cC = self.cap([(t_enter + 0.04, F['map'])], y=162, scale=1, color='grey', plate=True, cps=70.0)
            cD = self.cap([(t_enter + 0.08, F['title'])], y=172, scale=2, plate=True, cps=60.0, wrap=318)
        end = max(c.start + len(c.plain()) / 16.0 + 0.8 for c in (cA, cB, cD))
        for c in (cA, cB, cC, cD):
            c.end = end
        self.t_here = cD.typed + 0.05
        self.scene('title', end + 0.08, self.r_title)
        self.fades.append(('in', 0.0, 0.2))
        self.sound(0.05, 'DSPISTOL', 0.4)
        self.sound(t_enter, 'DSPISTOL', 0.5)
        self.sound(t_enter + 0.08, 'DSPISTOL', 0.35, 0.0, 0.9)
        self.sound(self.t_here, 'DSSWTCHN', 0.3)
        self.music_start = 0.05

    # ---- footage
    def footage(self, name, trim=(0, 0), gamma=None, span=None):
        for d in self.raws:
            if (d / name).exists():
                return Footage(d / name, tuple(trim), gamma if gamma is not None else self.film.get('footageGamma', 1.0), span, self.fps)
        raise SystemExit('no footage %s in %s: run node scripts/capture-level-flythrough.mjs --map %s%s' % (
            name, ', '.join(str(d) for d in self.raws), self.key, ' --format vertical' if self.vertical else ''))

    def build_shot(self, sh, first=False):
        """A stretch of engine footage. No captions: the dungeon speaks for itself."""
        span = sh.get('span')
        fo = self.footage(sh['shot'], sh.get('trim', (0, 0)), sh.get('gamma'), span)
        dur = sh.get('seconds') or len(fo) / self.fps
        trans = 'smash' if first else sh.get('trans', 'cut')
        s = self.scene(sh.get('name', sh['shot']), dur, self.r_footage, trans='melt' if trans == 'melt' else 'cut', footage=fo)
        t0 = s['start']
        if trans == 'smash':
            self.sound(t0, ic.boom(self.rng, 1.3), 0.45)
            self.shakes.append((t0, 0.15, 2))
        for fx in sh.get('sfx', []):
            self.add_sfx(t0, fx)
        self.footsteps(sh['shot'], t0, span[0] if span else 0.0, dur)
        return s

    def add_sfx(self, t0, fx):
        name = fx['snd']
        rng = self.rng
        synth = {'boom': lambda: ic.boom(rng, 1.4), 'sting': lambda: ic.sting(rng), 'chime': ic.polite_chime,
                 'servo': lambda: ic.servo(rng), 'thunk': lambda: ic.thunk(rng), 'whoosh': lambda: ic.whoosh(rng, 0.5),
                 'hum': lambda: ic.hum(fx.get('dur', 4.0), rng), 'blip': lambda: ic.blip(fx.get('freq', 880)),
                 'cricket': lambda: ic.cricket(rng), 'crackle': lambda: ic.crackle(fx.get('dur', 3.0), rng),
                 'whine': lambda: whine(fx.get('dur', 1.2))}
        x = synth[name]() if name in synth else name
        self.sound(t0 + fx.get('t', 0.0), x, fx.get('gain', 0.5), fx.get('pan', 0.0), fx.get('pitch', 1.0))

    def footsteps(self, shot, t0, skip=0.0, dur=1e9):
        """The Inferminator's heavy steps (the game's cyber/hoof every 48 units walked), from the captured path."""
        plan = self.plans.get(shot)
        if not plan or not plan.get('guardian') or self.film['guardian'].get('steps') is None:
            return
        g, cam = plan['guardian'], plan['poses']
        dist, nxt = 0.0, 24.0
        for f in range(1, len(g)):
            if g[f][5] != 1:
                continue
            dist += math.hypot(g[f][1] - g[f - 1][1], g[f][2] - g[f - 1][2])
            if dist >= nxt:
                nxt += 48.0
                ts = f / 35.0 - skip
                if not (0.0 <= ts < dur):
                    continue
                d = math.hypot(g[f][1] - cam[f][0], g[f][2] - cam[f][1])
                yaw = math.radians(cam[f][3])
                ang = math.atan2(g[f][2] - cam[f][1], g[f][1] - cam[f][0]) - yaw
                pan = clamp(-math.sin(ang), -1, 1) * 0.6
                vol = clamp(1.0 - d / 900.0, 0.08, 1.0)
                self.sound(t0 + ts, self.film['guardian']['steps'], 0.55 * vol, pan, 0.95 + 0.05 * (f % 3))

    # ---- the rogue AI
    def build_guardian(self):
        """Its name card (mugshot in a status-bar well), one line on how it fails, then its own bark
        as it turns red.  The line and the bark stack in one caption: white, then red."""
        G = self.film['guardian']
        fo_len = None
        s = self.build_shot(dict(shot=G['shot'], span=G.get('span'), trans='cut', sfx=G.get('sfx', []), gamma=G.get('gamma')))
        s['guardian'] = True
        t0 = s['start']
        self.mug = self.mugshot(G)
        t_card = t0 + G.get('cardAt', 0.12)
        self.g_card_t = t_card
        g = self.mug
        if self.vertical:
            ny = ic.SAFE_TOP + 6 + g.h + 6 + 6
            name = self.cap([(t_card + 0.1, G['name'])], lines=G.get('vNameLines'), y=ny, scale=2, plate=False, color='gold',
                            read_cps=None, grow_plate=False, cps=60.0)
            sub = self.cap([(name.typed + 0.08, G['sub'])], y=ny + 22 * len(name.lines), scale=1, plate=False, color='grey',
                           read_cps=None, grow_plate=False, cps=70.0)
            self.card_bottom = ny + 22 * len(name.lines) + 12
        else:
            name = self.cap([(t_card + 0.1, G['name'])], y=13, scale=2, plate=False, color='gold', read_cps=None, cps=60.0)
            sub = self.cap([(name.typed + 0.08, G['sub'])], y=33, scale=1, plate=False, color='grey', read_cps=None, cps=70.0)
            name.left = sub.left = 8 + g.w + 6 + 8
        self.g_name, self.g_sub = name, sub
        bark_at = t0 + G['barkAt']                    # when the captured guardian turns red
        line_at = t0 + G.get('lineAt', 0.35)
        segs = [(line_at, G['line']), (bark_at, '\n' + G['bark'])]
        lines = (G['vLineLines'] + G['vBarkLines']) if self.vertical else None
        cap = self.cap(segs, lines=lines, grow_plate=True, colors=[(0, 'white'), (len(G['line']) + 1, 'red')])
        # readable once as a whole, and the bark readable once from the moment it starts
        cap.end = max(cap.end, bark_at + len(G['bark']) / 16.0 + 0.8, cap.typed + 0.8)
        self.g_line = cap
        g_end = cap.end + 0.12
        card_end = (bark_at - 0.05) if self.vertical else (g_end - 0.05)
        for c in (name, sub):
            c.end = card_end
        self.g_card_end = card_end
        s['end'] = g_end
        s['f1'] = self.frame_of(g_end)
        self.sound(t_card, 'DSPSTOP', 0.35, 0.0, 0.9)
        for fx in G.get('barkSfx', []):
            self.add_sfx(bark_at, fx)
        self.bark_at = bark_at

    def mugshot(self, G):
        m = G['mug']
        spr = self.A.sprite(m['sprite'])
        x0, y0, x1, y1 = m['box']
        return spr.crop(x0, y0, x1, y1)

    # ---- the objective
    def build_objective(self):
        """One line and a quick lineup of the five prisoners, then FREE THEM. slams in."""
        O = self.film['objective']
        P = self.film['prisoners']
        t0 = self.scenes[-1]['end']
        V = self.vertical
        if V:
            # the block (line, cells, FREE THEM.) sits centred in TikTok's safe area
            nl = len(O.get('vLines') or [O['text']])
            block = 22 * nl - 6 + 10 + 100 + 16 + 24
            top = ic.SAFE_TOP + (ic.SAFE_BOTTOM - ic.SAFE_TOP - block) // 2
            head = self.cap([(t0 + 0.1, O['text'])], lines=O.get('vLines'), y=top, scale=2, plate=True, cps=50.0)
            self.obj_cells_y = top + 22 * len(head.lines) - 6 + 10
            cta_y = self.obj_cells_y + 100 + 16
            cta = self.cap([(t0 + O.get('ctaAt', 1.35), O['cta'])], y=cta_y, scale=3, plate=False, read_cps=None, grow_plate=False, cps=40.0)
            assert cta_y + 24 <= ic.SAFE_BOTTOM, 'objective leaves the safe area'
        else:
            head = self.cap([(t0 + 0.1, O['text'])], y=7, scale=1, plate=True, cps=50.0)
            cta = self.cap([(t0 + O.get('ctaAt', 1.35), O['cta'])], y=158, scale=2, plate=False, read_cps=None, cps=40.0)
        self.obj_pop = [t0 + 0.2 + 0.11 * i for i in range(len(P))]
        end = max(head.start + (len(head.plain()) + 1 + len(O['cta'])) / 16.0 + 0.8,
                  cta.start + len(O['cta']) / 16.0 + 0.8)
        if not V:
            end = max([end] + [self.obj_pop[i] + len(p['name']) / 16.0 + 0.8 for i, p in enumerate(P)])
        head.end = cta.end = end
        self.obj_slam = cta.typed + 0.03
        for i, p in enumerate(P):
            self.sound(self.obj_pop[i], 'DSTINK', 0.75, (i - 2) / 3.0, 0.92 + 0.03 * i)
            self.sound(self.obj_pop[i], ic.thunk(self.rng), 0.2, (i - 2) / 3.0)
        self.sound(t0, ic.boom(self.rng, 0.9), 0.3)
        self.sound(self.obj_slam, ic.boom(self.rng, 1.4), 0.5)
        self.sound(self.obj_slam, 'DSPSTOP', 0.4, 0.0, 0.85)
        self.shakes.append((self.obj_slam, 0.2, 2))
        self.scene('objective', end + 0.1 - t0, self.r_objective, 'cut')

    # ---- GO
    def build_go(self):
        """Doom's own level-start melt into the exact view the player spawns with, GO. slams in, and the
        last frames are left clean so the cut into gameplay is continuous."""
        Gd = self.film['go']
        fo = self.footage(Gd.get('shot', 'start'), gamma=Gd.get('gamma', 1.0))   # untouched: it must match gameplay
        dur = Gd.get('seconds', 2.2)
        s = self.scene('go', dur, self.r_footage, 'melt', footage=fo)
        t0 = s['start']
        slam_at = t0 + Gd.get('goAt', 0.95)
        if self.vertical:
            go = self.cap([(slam_at - 0.06, Gd['text'])], y=ic.SAFE_TOP + 112, scale=5, plate=False, read_cps=None, grow_plate=False, cps=50.0)
        else:
            go = self.cap([(slam_at - 0.06, Gd['text'])], y=78, scale=5, plate=False, read_cps=None, cps=50.0)
        go.end = t0 + dur - Gd.get('cleanTail', 0.2)       # fades out over 5 tics; the tail is the bare start view
        assert go.end - go.start >= len(Gd['text']) / 16.0 + 0.8
        self.go_slam = slam_at
        self.sound(slam_at, ic.boom(self.rng, 1.6), 0.55)
        self.shakes.append((slam_at, 0.18, 2))
        for fx in Gd.get('sfx', []):
            self.add_sfx(slam_at, fx)
        self.music_cut = slam_at                           # the music stops dead on GO; the level's own sound takes over

    # ------------------------------------------------------------ renderers (return RGB at full res, or Doom-res index fb)
    def r_footage(self, s, t, f):
        fo = s['footage']
        i = f - s['f0']
        return fo.frame(min(i, len(fo) - 1))

    def r_title(self, s, t, f):
        W, H, pal = self.W, self.H, self.pal
        fb = np.zeros((H, W), np.uint8)
        m = self.bg_map
        F = self.film
        node = F.get('mapNode', [160, 100])
        mx = my = 0
        if self.vertical:
            # the map as a 270-wide window centred on YOU ARE HERE, below the episode line
            mx = int(clamp(node[0] - W // 2, 0, m.w - W))
            my = self.map_y
            ic.blit(fb, m.crop(mx, 0, mx + W, m.h), 0, my, offsets=False)
            ic.remap(fb, 0, my, W, my + m.h, pal.cmap[6])
            hx, hy = node[0] - mx, node[1] + my
        else:
            ic.blit(fb, m, 0, 0, offsets=False)
            ic.remap(fb, 0, 0, W, H, pal.cmap[6])
            hx, hy = node
        ey = self.enter_y
        if t >= self.t_enter:
            g = self.enter
            ic.remap(fb, (W - g.w) // 2 - 6, ey - 4, (W + g.w) // 2 + 6, ey + g.h + 3, pal.cmap[22])
            ic.blit(fb, g, (W - g.w) // 2, ey, offsets=False)
        if t >= self.t_here:
            if int((t - self.t_here) * ic.FPS) % 16 < 11:          # Doom blinks YOU ARE HERE
                g = self.urh[0] if hx + 2 + self.urh[0].w <= W else self.urh[1]
                ic.blit(fb, g, hx, hy)
            ws = self.A.wad.patch('WISPLAT')
            for nx, ny in F.get('mapSplats', []):
                ic.blit(fb, ws, nx - mx, ny + my)
        return fb

    def r_objective(self, s, t, f):
        W, H, A = self.W, self.H, self.A
        F = self.film
        P = F['prisoners']
        ta = t + s['start']
        fb = np.zeros((H, W), np.uint8)
        wall = A.wad.texture(F.get('fiveWall', 'SUPPORT3'))
        floor = A.wad.flat(F.get('fiveFloor', 'FLOOR4_8'))
        n = len(P)
        if self.vertical:
            cw, ch, gap = 44, 100, 3
            x = ic.SAFE_CX - (n * cw + (n - 1) * gap) // 2
            for i, p in enumerate(P):
                self.draw_cell(fb, wall, floor, x + i * (cw + gap), self.obj_cells_y, cw, ch, ta - self.obj_pop[i], p)
        else:
            ch, y = 92, 28
            pitch = (W - 8) / n
            cxs = [4 + pitch * (i + 0.5) for i in range(n)]
            # names stay small; long ones are nudged apart so they never touch
            bw = [max(self.font.width(n_) for n_ in p['name'].split(' ', 1)) for p in P]
            nx = list(cxs)
            for _ in range(60):
                for i in range(n - 1):
                    over = (nx[i] + bw[i] / 2 + 8) - (nx[i + 1] - bw[i + 1] / 2)
                    if over > 0:
                        nx[i] -= over / 2
                        nx[i + 1] += over / 2
                nx = [clamp(x_, 3 + bw[i] / 2, W - 3 - bw[i] / 2) for i, x_ in enumerate(nx)]
            cw = 54
            for i, p in enumerate(P):
                cx = int(round(cxs[i]))
                x0 = int(clamp(cx - cw // 2, 3, W - 3 - cw))
                self.draw_cell(fb, wall, floor, x0, y, cw, ch, ta - self.obj_pop[i], p)
                if ta >= self.obj_pop[i]:
                    first, last = p['name'].split(' ', 1)
                    n_on = int((ta - self.obj_pop[i]) * 70)
                    tx = int(round(nx[i]))
                    self.font.draw(fb, first, tx - self.font.width(first) // 2, y + ch + 5, count=max(0, n_on), color='grey')
                    self.font.draw(fb, last, tx - self.font.width(last) // 2, y + ch + 15, count=max(0, n_on - len(first)), color='grey')
        return fb

    def draw_cell(self, fb, wall, floor, x0, y0, cw, ch, age, p):
        """One lit cell: a wall texture, a floor strip, the prisoner's in-game sprite, a lamp that
        flicks on when they appear."""
        pal = self.pal
        cell = np.zeros((ch, cw), np.uint8)
        tw = wall.idx
        cell[:, :] = tw[np.arange(ch)[:, None] % tw.shape[0], (np.arange(cw)[None, :] + 17 * hash(p['name']) % 64) % tw.shape[1]]
        fy = ch - 12
        cell[fy:, :] = floor[np.arange(ch - fy)[:, None] % 64, np.arange(cw)[None, :] % 64]
        if age < 0:
            level = 26
        else:
            flick = [0, 1, 0, 1, 1]
            k = int(age * ic.FPS)
            level = 4 if (k >= len(flick) or flick[k]) else 20
        yy, xx = np.mgrid[0:ch, 0:cw]
        d = np.sqrt(((xx - cw / 2) / (cw * 0.62)) ** 2 + ((yy - ch * 0.35) / (ch * 0.9)) ** 2)
        lv = np.clip(level + (d * 10).astype(int), 0, 31)
        cell = pal.cmap[lv, cell]
        if age >= 0:
            spr = self.A.sprite(p['sprite'])
            ic.blit(cell, spr, (cw - spr.w) // 2, fy - spr.h + 6, offsets=False)
        fb[y0:y0 + ch, x0:x0 + cw] = cell
        ic.rect(fb, x0 - 1, y0 - 1, x0 + cw + 1, y0, 100)
        ic.rect(fb, x0 - 1, y0 + ch, x0 + cw + 1, y0 + ch + 1, 104)
        ic.rect(fb, x0 - 1, y0, x0, y0 + ch, 100)
        ic.rect(fb, x0 + cw, y0, x0 + cw + 1, y0 + ch, 104)

    # ------------------------------------------------------------ overlays drawn over every scene
    def overlay(self, s, t, L):
        if s.get('guardian'):
            self.draw_card(t, L)
        for c in self.captions:
            draw_caption(c, t, self.font, self.pal, L)

    def draw_card(self, t, L):
        """Guardian name card: the mugshot in a bevelled status-bar well, name and subtitle beside it."""
        if not (self.g_card_t <= t < self.g_card_end):
            return
        pal = self.pal
        fade = clamp((self.g_card_end - t) * ic.FPS / 5.0, 0, 1)
        grow = clamp((t - self.g_card_t) * ic.FPS / 6.0, 0, 1)
        g = self.mug
        if self.vertical:
            bx, by = ic.SAFE_CX - (g.w + 6) // 2, ic.SAFE_TOP + 6
            plate = (ic.SAFE_LEFT + 2, by - 4, ic.SAFE_RIGHT - 2, self.card_bottom + 4)
        else:
            bx, by = 8, 8
            nw = max(self.font.width(self.film['guardian']['name'], 2), self.font.width(self.film['guardian']['sub']))
            plate = (bx - 4, by - 4, bx + g.w + 6 + 8 + nw + 8, by + g.h + 6 + 4)
        L.plate(*plate, level_factor(int(round(4 + 20 * fade))))
        if not self.vertical:
            ic.rect(L.idx, plate[0], plate[1], plate[0] + 3, plate[3], pal.cmap[int(round((1 - fade) * 24))][176])
        # bevelled well (status bar colours) that opens, then the mugshot
        h = int(round((g.h + 6) * grow))
        if h <= 2:
            return
        cy = by + (g.h + 6) // 2
        y0, y1 = cy - h // 2, cy - h // 2 + h
        ic.rect(L.idx, bx, y0, bx + g.w + 6, y1, 0)
        ic.rect(L.idx, bx, y0, bx + g.w + 6, y0 + 1, 103)
        ic.rect(L.idx, bx, y0, bx + 1, y1, 103)
        ic.rect(L.idx, bx, y1 - 1, bx + g.w + 6, y1, 109)
        ic.rect(L.idx, bx + g.w + 5, y0, bx + g.w + 6, y1, 109)
        if grow >= 1:
            gg = g.mapped(pal.cmap[int(round((1 - fade) * 24))]) if fade < 1 else g
            ic.blit(L.idx, gg, bx + 3, by + 3, offsets=False)

    # ------------------------------------------------------------ composition
    def scene_at(self, f):
        for i, s in enumerate(self.scenes):
            if f < s['f1']:
                return i, s
        return len(self.scenes) - 1, self.scenes[-1]

    def layer(self, f):
        """Scene + overlays + shake at full resolution (what a melt captures)."""
        if f in self._cache:
            return self._cache[f]
        i, s = self.scene_at(f)
        t = f / self.fps
        base = s['render'](s, t - s['start'], f)
        if base.ndim == 2:
            base = to_rgb(self.pal, base)
        L = Layer(self.W, self.H)
        self.overlay(s, t, L)
        img = base.astype(np.float32)
        if (L.dim < 1).any():
            dim = np.repeat(np.repeat(L.dim, UP, 0), UP, 1)
            img *= dim[..., None]
        img = img.astype(np.uint8)
        m = L.idx != SENT
        if m.any():
            ov = self.pal.pals[0][L.idx]
            mm = np.repeat(np.repeat(m, UP, 0), UP, 1)
            ovf = np.repeat(np.repeat(ov, UP, 0), UP, 1)
            img[mm] = ovf[mm]
        for (t0, dur, amp) in self.shakes:
            if t0 <= t < t0 + dur:
                r = np.random.default_rng(self.tic_of(f) * 977 + 3)
                dx, dy = (int(v) * UP for v in r.integers(-amp, amp + 1, 2))
                img = shake(img, dx, dy)
        if len(self._cache) > 8:
            self._cache = {}
        self._cache[f] = img
        return img

    def rgb(self, f):
        i, s = self.scene_at(f)
        img = self.layer(f)
        ticks = self.tic_of(f) - self.tic_of(s['f0'])
        if s['trans'] == 'melt' and i > 0 and ticks < 60:
            img = melt_rgb(self.layer(s['f0'] - 1), img, ticks, seed=s['f0'])
        t = f / self.fps
        for kind, a, b in self.fades:
            u = clamp((t - a) / max(b - a, 1e-3), 0, 1)
            k = (1 - u) if kind == 'in' else u
            if kind == 'in' and t < b or kind == 'out' and t >= a:
                img = (img.astype(np.float32) * (1 - k)).astype(np.uint8)
        return img

    # ------------------------------------------------------------ audio
    def audio(self):
        n = int(math.ceil(self.duration * SR)) + 1
        sfx = np.zeros((n, 2), np.float32)
        for (t, x, gain, pan) in self.sfx:
            ic.place(sfx, t, x, gain, pan)
        bus = np.zeros((n, 2), np.float32)
        mus = self.A.music(self.film['music'])
        off = self.film.get('musicOffset', 0.0)
        sync = self.film.get('musicSync')       # {"at": seconds into the track} lands on the smash cut into the footage
        if sync:
            first_shot = next(s_ for s_ in self.scenes if 'footage' in s_)
            off = max(0.0, sync['at'] - (first_shot['start'] - self.music_start))
        lead = int(off * SR)
        mus = mus[lead:]
        rms = float(np.sqrt(np.mean(mus[:SR * 20] ** 2)))
        ms = int(self.music_start * SR)
        m = mus[:n - ms].copy() * (self.film.get('musicLevel', 0.075) / max(rms, 1e-4))
        tt = np.arange(len(m)) / SR + self.music_start
        m *= np.clip((getattr(self, 'music_cut', self.duration) - tt) / 0.03, 0, 1)[:, None]
        m *= np.clip((tt - self.music_start) / 0.25, 0, 1)[:, None]
        env = np.abs(sfx).max(1)
        b, a = ic.signal.butter(1, 4.0, fs=SR)
        env = ic.signal.lfilter(b, a, env)
        duck = 1.0 - 0.5 * np.clip(env / 0.12, 0, 1)
        m *= duck[ms:ms + len(m), None]
        bus[ms:ms + len(m)] += m
        out = (bus + sfx) * 1.45
        aa = np.abs(out)
        knee = 0.7
        over = aa > knee
        out[over] = np.sign(out[over]) * (knee + (1 - knee) * np.tanh((aa[over] - knee) / (1 - knee)))
        return out * 0.80                                    # AAC true peak stays under 0 dBFS

    # ------------------------------------------------------------ manifest
    def manifest_entry(self, rel):
        caps = []
        for c in sorted(self.captions, key=lambda c: c.start):
            if not (c.manifest and c.plain().strip()):
                continue
            if c is getattr(self, 'g_line', None):         # the AI's line and its bark are separate subtitles
                G = self.film['guardian']
                caps.append(dict(t_ms=int(round(c.start * 1000)), end_ms=int(round(c.end * 1000)), text=G['line']))
                caps.append(dict(t_ms=int(round(self.bark_at * 1000)), end_ms=int(round(c.end * 1000)), text=G['bark'], speaker=G['name']))
                continue
            caps.append(dict(t_ms=int(round(c.start * 1000)), end_ms=int(round(c.end * 1000)), text=c.plain()))
        caps.sort(key=lambda e: e['t_ms'])
        scenes = [dict(name=s['name'], t_ms=int(round(s['start'] * 1000)), end_ms=int(round(s['end'] * 1000))) for s in self.scenes]
        e = dict(file=rel + '.mp4', poster=rel + '-poster.png', duration_ms=int(round(self.duration * 1000)),
                 width=self.W * UP, height=self.H * UP, fps=self.fps, captions=caps, scenes=scenes,
                 footage=dict(source='GZDoom WebAssembly engine, captured by scripts/capture-level-flythrough.mjs',
                              shots=[s['name'] for s in self.scenes if 'footage' in s]))
        e['version'] = 2
        if self.player:
            e['ends_on_player_start'] = dict(x=self.player['x'], y=self.player['y'], view_z=self.player['viewz'],
                                             angle=self.player['angle'], pitch=self.player['pitch'], fov=self.player['fov'],
                                             clean_tail_ms=int(round(self.film['go'].get('cleanTail', 0.2) * 1000)))
        if self.vertical:
            e['safe_area_px'] = dict(top=ic.SAFE_TOP * UP, bottom=ic.SAFE_BOTTOM * UP, left=ic.SAFE_LEFT * UP, right=ic.SAFE_RIGHT * UP)
        return e


def whine(dur):
    """Rising charge whine (the Inferminator's laser wind-up)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 300 + 2200 * (t / dur) ** 1.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.minimum(1, t / 0.05) * (0.3 + 0.7 * t / dur)
    return (x * 0.5).astype(np.float32)


# ============================================================================ review sheets

def keyframe_sheet(film, path, label):
    tiles = []
    for s in film.scenes:
        for u in (0.3, 0.85):
            f = s['f0'] + int((s['f1'] - s['f0']) * u)
            tiles.append((s['name'], f, film.rgb(f)))
    land = not film.vertical
    cols = 4 if land else 6
    tw, th = (480, 300) if land else (270, 480)
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 20) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (name, f, rgb) in enumerate(tiles):
        x, y = 6 + (k % cols) * (tw + 6), 6 + (k // cols) * (th + 20)
        sheet.paste(Image.fromarray(rgb).resize((tw, th), Image.BILINEAR), (x, y + 14))
        d.text((x, y), '%s %s t=%.2fs' % (label, name, f / film.fps), fill=(230, 230, 230))
    sheet.save(path)


def caption_sheet(film, path):
    tiles = []
    for c in sorted(film.captions, key=lambda c: c.start):
        if c.hidden or not c.plain().strip():
            continue
        f = film.frame_of(min(c.typed + 0.4, c.end - 0.1))
        tiles.append(film.rgb(f))
    land = not film.vertical
    cols = 3 if land else 6
    tw, th = (640, 400) if land else (270, 480)
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0))
    for k, rgb in enumerate(tiles):
        sheet.paste(Image.fromarray(rgb).resize((tw, th), Image.BILINEAR), ((k % cols) * tw, (k // cols) * th))
    sheet.save(path)


def safezone_sheet(film, path, label):
    tiles = []
    for s in film.scenes:
        f = s['f0'] + int((s['f1'] - s['f0']) * 0.8)
        tiles.append((s['name'], f, film.rgb(f)))
    tw, th = 270, 480
    cols = 6
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 20) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (name, f, rgb) in enumerate(tiles):
        x, y = 6 + (k % cols) * (tw + 6), 6 + (k // cols) * (th + 20)
        im = Image.fromarray(rgb).resize((tw, th), Image.BILINEAR).convert('RGBA')
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for box in ((0, 0, tw, ic.SAFE_TOP), (0, ic.SAFE_BOTTOM, tw, th), (ic.SAFE_RIGHT, 0, tw, th)):
            od.rectangle(box, fill=(255, 0, 255, 80))
        od.rectangle((0, ic.SAFE_TOP, ic.SAFE_RIGHT - 1, ic.SAFE_BOTTOM - 1), outline=(0, 255, 0, 200))
        im.alpha_composite(ov)
        sheet.paste(im.convert('RGB'), (x, y + 14))
        d.text((x, y), '%s %s t=%.2fs' % (label, name, f / film.fps), fill=(230, 230, 230))
    sheet.save(path)


# ============================================================================ encode

def encode(film, mp4, wav):
    nframes = film.frame_of(film.duration)
    W, H = film.W * UP, film.H * UP
    cmd = ['ffmpeg', '-y', '-v', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(film.fps), '-i', '-',
           '-i', str(wav),
           '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17']
    if film.vertical:
        cmd += ['-profile:v', 'high', '-level:v', '4.1', '-g', str(film.fps * 2)]
    cmd += ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
            '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-movflags', '+faststart', '-shortest', str(mp4)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(nframes):
        p.stdin.write(np.ascontiguousarray(film.rgb(f)).tobytes())
        if f % 175 == 0:
            print('    frame %d/%d' % (f, nframes), flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit('ffmpeg failed')


def mp4_caption_sheet(entry, path):
    """Every caption, grabbed from the *encoded* MP4 just after it finishes typing: the legibility check."""
    mp4 = LOCAL / entry['file']
    W, H = entry['width'], entry['height']
    tiles = []
    for c in entry['captions']:
        t = min(c['t_ms'] / 1000 + len(c['text']) / 35.0 + 0.35, c['end_ms'] / 1000 - 0.1)
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % t, '-i', str(mp4), '-frames:v', '1', '-f', 'rawvideo',
                              '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        tiles.append((c['text'], t, np.frombuffer(raw, np.uint8)[:W * H * 3].reshape(H, W, 3)))
    land = W > H
    tw, th = (640, 400) if land else (270, 480)
    cols = 3 if land else 6
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * tw, rows * (th + 16)), (16, 16, 16))
    d = ImageDraw.Draw(sheet)
    for k, (txt, t, im) in enumerate(tiles):
        x, y = (k % cols) * tw, (k // cols) * (th + 16)
        sheet.paste(Image.fromarray(im).resize((tw, th), Image.LANCZOS), (x, y + 16))
        d.text((x + 3, y + 2), 't=%.2f %s' % (t, txt[:48]), fill=(255, 255, 0))
    sheet.save(path)


def share_copy(src, dst, limit_mb=30):
    """A bitrate-capped copy of a vertical cut for sharing (TikTok / Reels / Shorts), always under limit_mb."""
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)],
                               capture_output=True, text=True, check=True).stdout)
    vkbps = int(min(10000, (limit_mb * 8e3 * 0.9) / dur - 160))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-c:v', 'libx264', '-preset', 'slow', '-b:v', '%dk' % vkbps,
                    '-maxrate', '%dk' % int(vkbps * 1.15), '-bufsize', '%dk' % (vkbps * 2), '-profile:v', 'high', '-level:v', '4.1',
                    '-g', '60', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-color_range', 'tv', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(dst)], check=True)
    mb = dst.stat().st_size / 1e6
    assert mb < limit_mb, '%s is %.1f MB' % (dst, mb)
    return mb


def handoff_sheet(film, entry, path):
    """The film's last frame beside the engine's own view at the player's spawn: the cut into gameplay."""
    mp4 = LOCAL / entry['file']
    W, H = entry['width'], entry['height']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-sseof', '-0.5', '-i', str(mp4), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    n = len(raw) // (W * H * 3)
    last = np.frombuffer(raw, np.uint8)[(n - 1) * W * H * 3:n * W * H * 3].reshape(H, W, 3)
    spawn = film.footage(film.film['go'].get('shot', 'start'), gamma=1.0).frame(0)
    diff = float(np.abs(last.astype(np.int16) - spawn.astype(np.int16)).mean())
    tw, th = (640, 400) if W > H else (270, 480)
    sheet = Image.new('RGB', (tw * 2 + 6, th + 20), (16, 16, 16))
    d = ImageDraw.Draw(sheet)
    sheet.paste(Image.fromarray(last).resize((tw, th), Image.LANCZOS), (0, 20))
    sheet.paste(Image.fromarray(spawn).resize((tw, th), Image.LANCZOS), (tw + 6, 20))
    d.text((3, 3), 'film: last frame (decoded MP4)', fill=(255, 255, 0))
    d.text((tw + 9, 3), 'engine: spawn view, mean |diff| %.2f / 255' % diff, fill=(255, 255, 0))
    sheet.save(path)
    return diff


def poster_frame(film):
    """The guardian at its most menacing (red eye, as it barks) under its name card, no other captions."""
    # the brightest moment just after it turns red (E1M7's lights flicker)
    t = max((film.bark_at + 0.1 * k for k in range(1, 13)),
            key=lambda t_: float(film.footage(film.film['guardian']['shot'], span=film.film['guardian'].get('span'))
                                 .frame(film.frame_of(t_ - film.scenes[[s_['name'] for s_ in film.scenes].index(film.film['guardian']['shot'])]['start'])).mean()))
    saved = film.captions, film.g_card_end, film.g_name.end, film.g_sub.end
    film.captions = [film.g_name, film.g_sub]
    film.g_card_end = film.g_name.end = film.g_sub.end = t + 1.0
    film._cache = {}
    try:
        img = film.rgb(film.frame_of(t))
    finally:
        film.captions, film.g_card_end, film.g_name.end, film.g_sub.end = saved
        film._cache = {}
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--map', default='all', help='E1M4, E1M7, ... or all (the levels in level-intros.json that have a film)')
    ap.add_argument('--format', choices=['landscape', 'vertical', 'all'], default='all')
    ap.add_argument('--preview', action='store_true', help='review sheets and posters only, no encode')
    args = ap.parse_args()
    data = json.loads(DATA.read_text())
    keys = [k for k, v in data['levels'].items() if v.get('film')] if args.map == 'all' else [args.map.upper()]
    fmts = ['landscape', 'vertical'] if args.format == 'all' else [args.format]
    for d in (OUT, REVIEW, SCRATCH):
        d.mkdir(parents=True, exist_ok=True)
    A = Assets()
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for key in keys:
        cfg = data['levels'][key]
        for fmt in fmts:
            film = LevelFilm(A, key, cfg, fmt)
            sfx = '' if fmt == 'landscape' else '-vertical'
            name = '%s-intro%s' % (key.lower(), sfx)
            print('%s %s: %.2fs; %s' % (key, fmt, film.duration, ', '.join('%s %.1f-%.1f' % (s['name'], s['start'], s['end']) for s in film.scenes)))
            keyframe_sheet(film, REVIEW / ('keyframes-%s%s.png' % (key.lower(), sfx)), key + sfx)
            caption_sheet(film, REVIEW / ('captions-%s%s.png' % (key.lower(), sfx)))
            if film.vertical:
                safezone_sheet(film, REVIEW / ('safezones-%s-vertical.png' % key.lower()), key)
            Image.fromarray(poster_frame(film)).save(OUT / (name + '-poster.png'))
            if args.preview:
                continue
            wav = SCRATCH / (name + '.wav')
            ic.write_wav(wav, film.audio())
            film._cache = {}
            encode(film, OUT / (name + '.mp4'), wav)
            manifest.setdefault(key, {})[fmt] = film.manifest_entry('intro/levels/' + name)
            manifest[key]['level_id'] = cfg.get('levelId')
            manifest[key]['title'] = cfg['film']['title']
            manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
            mp4_caption_sheet(manifest[key][fmt], REVIEW / ('mp4-captions-%s%s.png' % (key.lower(), sfx)))
            dh = handoff_sheet(film, manifest[key][fmt], REVIEW / ('handoff-%s%s.png' % (key.lower(), sfx)))
            manifest[key][fmt]['ends_on_player_start']['last_frame_mean_abs_diff'] = round(dh, 2)
            if film.vertical:
                (OUT / 'share').mkdir(exist_ok=True)
                mb = share_copy(OUT / (name + '.mp4'), OUT / 'share' / (name + '-share.mp4'))
                manifest[key][fmt]['share'] = 'intro/levels/share/%s-share.mp4' % name
                print('  share copy %.1f MB' % mb)
            manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
            print('  wrote', OUT / (name + '.mp4'))


if __name__ == '__main__':
    main()
