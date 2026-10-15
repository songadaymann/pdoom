#!/usr/bin/env python3
"""Gameplay-first cuts of the two vertical promos (Samwise and Mario), on the same voiceover takes.

Feedback on the first promos: people want to see the game sooner. These cuts keep each film's
recorded take, timing and on-screen jokes, but open on real combat and stay in real gameplay
(scripts/capture-gameplay.mjs: the actual engine, status bar and held tools, captured with the
narrating CEO's face in the bar) almost all the way through; the motion-graphics pieces survive only
as short inserts (the poster pile, the long-winded text wall, the coin).

Layout follows the finished films' presenter edit (scripts/promo-presenter-swap.py --presence):
while the keyed presenter is on screen the game plays in a 16:10 window at the top (y 144..820)
over a dark Doom stage, clear of him; while he is off, the game fills the frame (the capture's centre
third, 3x). Text slams, the p(DOOM) logo and the counter live on their own alpha layer so they can
sit on top of him.

    python3 scripts/build-promo-gameplay.py                 # both CEOs
    python3 scripts/build-promo-gameplay.py --ceo sam --preview   # review sheet only
    python3 scripts/build-promo-gameplay.py --ceo sam --final     # + composite onto the finished film
    python3 scripts/build-promo-gameplay.py --layout full --broll-only   # full-frame gameplay throughout, background only

Outputs in doom-web/local/promo/gameplay/ (git-ignored):
    pdoom-gameplay-<ceo>-broll.mp4        the new B-roll, no text (music + SFX stem as its audio)
    pdoom-gameplay-<ceo>-text-alpha.mov   slams/logo/counter alone, ProRes 4444 straight alpha
    pdoom-gameplay-<ceo>-text-green.mp4   the same over pure green
    pdoom-gameplay-<ceo>-preview.mp4      B-roll + text + full mix (no presenter)
    pdoom-gameplay-<ceo>-music-sfx.wav, -sfx.wav, -mix.wav
    pdoom-gameplay-<ceo>-final.mp4        (--final) the finished film with this B-roll under the presenter and the text over him
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
_spec = importlib.util.spec_from_file_location('build_promo', ROOT / 'scripts' / 'build-promo.py')
bp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bp)
ic = bp.ic

W, H, UP, FPS, TICS, SR = bp.W, bp.H, bp.UP, bp.FPS, bp.TICS, bp.SR
BW, BH = W * UP, H * UP                     # 1080 x 1920
GW, GH = 1080, 676                          # capture frame (engine 540x338 shown 2x)
WIN_Y = 144                                 # game window top (36 Doom px: clear of the phone status bar)
WIN_ROW = (WIN_Y + GH) // UP                # 205: stage starts here (Doom px)
FULL = (540, 356, 360, 640)                 # full-bleed crop: centre, size (capture px) -> exactly 3x
SLAM_Y, TOP_Y = bp.SLAM_Y, bp.TOP_Y
OUT = bp.LOCAL / 'promo' / 'gameplay'
RAW = OUT / 'raw'
GAD = ROOT.parents[2] / 'GADtrailers' / 'pdoom'
FINISHED = {'sam': GAD / 'pdoom-samwise-othermale.mov', 'mario': GAD / 'pdoom-mario-scaldi.mov'}
TAKES = {'sam': 'mixed', 'mario': 'premix'}
# overlays Jonathan added by hand in the finished edits (seconds, rows): kept as part of his edit
KEEP = {'sam': ['0.37,2.77,1270,1480'], 'mario': []}
FACE = {'sam': 'altman', 'mario': 'amodei'}  # capture folder whose status bar shows this CEO
FACE_XY = (540, 622)                         # the status-bar face in a capture frame
CAM_ZOOM = [(0, 540, 300, 1.5)]              # camera-smash a little closer (1.5x = whole 3-px engine pixels in the window)


# ============================================================================ gameplay clips

class Clip:
    """A captured gameplay shot: 1080x676 PNG frames at 30 fps."""

    def __init__(self, ceo, name):
        self.dir = RAW / ceo / name
        self.files = sorted(self.dir.glob('[0-9]*.png'))
        if not self.files:
            raise FileNotFoundError('no capture %s (run scripts/capture-gameplay.mjs --shot %s)' % (self.dir, name))
        self.n = len(self.files)
        self.cache = {}

    def seconds(self):
        return self.n / FPS

    def frame(self, t):
        i = int(min(max(round(t * FPS), 0), self.n - 1))
        if i not in self.cache:
            if len(self.cache) > 48:
                self.cache.clear()
            self.cache[i] = np.asarray(Image.open(self.files[i]).convert('RGB'))
        return self.cache[i]


def crop_scale(img, cx, cy, cw, ch, ow, oh):
    """Crop a cw x ch box centred on (cx, cy) (kept inside the image) and scale it, pixel-sharp, to ow x oh."""
    h, w = img.shape[:2]
    cw, ch = min(cw, w), min(ch, h)
    x0 = int(round(min(max(cx - cw / 2, 0), w - cw)))
    y0 = int(round(min(max(cy - ch / 2, 0), h - ch)))
    sub = img[y0:y0 + int(round(ch)), x0:x0 + int(round(cw))]
    if sub.shape[1] == ow and sub.shape[0] == oh:
        return sub
    ys = (np.arange(oh) * sub.shape[0] / oh).astype(int)
    xs = (np.arange(ow) * sub.shape[1] / ow).astype(int)
    return sub[ys][:, xs]


def lerp_keys(keys, lt):
    """[(t, cx, cy, k), ...] -> (cx, cy, k) at local time lt, eased between keys."""
    if lt <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if lt < b[0]:
            u = (lt - a[0]) / max(1e-6, b[0] - a[0])
            u = u * u * (3 - 2 * u)
            return tuple(x + (y - x) * u for x, y in zip(a[1:], b[1:]))
    return keys[-1][1:]


# ============================================================================ overlay pieces (alpha layer)

class LogoSlam:
    """The p(DOOM) logo: the two halves slide in on a laser line and lock."""

    def __init__(self, A, t0, t1, y=40):
        self.A, self.t0, self.t1, self.y = A, t0, t1, y
        self.text = 'p(DOOM) logo'

    def draw(self, fb, t, font, pal, zy1):
        if not (self.t0 <= t < self.t1):
            return
        lg = self.A.logo
        x0 = bp.W // 2 - lg.w // 2
        u = bp.clamp((t - self.t0) / 0.12, 0, 1)
        fade = bp.clamp((self.t1 - t) * TICS / 3.0, 0, 1)
        for name, (g, px, py) in self.A.logo_parts.items():
            dx = int(-200 * (1 - u)) if name in ('p', '(') else (int(200 * (1 - u)) if name == ')' else 0)
            gg = g if fade >= 1 else g.mapped(pal.cmap[int(round((1 - fade) * 24))])
            bp.blit(fb, ic.Gfx(np.zeros_like(g.idx), g.mask), x0 + px + dx + 2, self.y + py + 2, offsets=False)
            bp.blit(fb, gg, x0 + px + dx, self.y + py, offsets=False)
        k = (t - self.t0) / 0.3
        if k < 1:
            yl = self.y + lg.h + 4
            for dy, col in ((-1, 176), (0, 168), (1, 176)):
                bp.rect(fb, 0, yl + dy, bp.W, yl + dy + 1, col)


class CounterSlam:
    """A big p(DOOM) counter in status-bar digits, racing c0 -> c1 percent, blinking once it lands."""

    def __init__(self, A, t0, t1, t_land, v0=12, v1=99, y=60, scale=3):
        self.A, self.t0, self.t1, self.t_land, self.v0, self.v1, self.y, self.scale = A, t0, t1, t_land, v0, v1, y, scale
        self.text = 'p(DOOM) %d%% -> %d%%' % (v0, v1)

    def draw(self, fb, t, font, pal, zy1):
        if not (self.t0 <= t < self.t1):
            return
        u = bp.clamp((t - self.t0) / max(0.1, self.t_land - self.t0), 0, 1)
        val = int(round(self.v0 + (self.v1 - self.v0) * (u ** 1.35)))
        done = t >= self.t_land
        sc = self.scale + (1 if done and (t - self.t_land) * TICS < 3 else 0)
        lab = 'p(DOOM)'
        lw = font.width(lab, 2)
        h = 16 * sc + 26
        top = self.y
        bp.remap(fb, 0, top - 4, bp.W, top + h + 4, pal.cmap[16])
        bp.rect(fb, 0, top - 6, bp.W, top - 4, pal.cmap[0][176])
        bp.rect(fb, 0, top + h + 4, bp.W, top + h + 6, pal.cmap[0][176])
        font.draw(fb, lab, bp.W // 2 - lw // 2 + 3, top + 3, table=np.zeros(256, np.uint8), shadow=False, scale=2)
        font.draw(fb, lab, bp.W // 2 - lw // 2, top, color='gold', scale=2)
        if not (done and int((t - self.t_land) * TICS) % 16 >= 12):
            gs = [self.A.digits[ch].scaled(sc) for ch in '%d%%' % val]
            x = bp.W // 2 - sum(g.w for g in gs) // 2
            for g in gs:
                bp.blit(fb, g.solid(0), x + sc, top + 24 + sc, offsets=False)
                bp.blit(fb, g if not done or (t - self.t_land) * TICS >= 2 else g.mapped(pal.white(8)), x, top + 24, offsets=False)
                x += g.w


# ============================================================================ the films

class GameplayPromo(bp.TimedPromo):
    def __init__(self, A, ceo, S, presence):
        self.presence = [(a, b) for a, b, _ in presence['segments']]
        self.face = FACE[ceo]
        self.clipset = {}
        self.missing = set()
        self.game_sfx = []
        self.force_layout = None                      # 'full' / 'window': ignore the presenter edit
        super().__init__(A, ceo, S, TAKES[ceo])
        # the dark stage under the game window (the old presenter layout's floor and smoulder)
        self.zy1, self.has_stage = WIN_ROW, True
        self.prepare_stage()
        self.zy1, self.has_stage = H, False
        self._stage = {}

    # ------------------------------------------------------------ building blocks
    def clip(self, name, face=None):
        key = (face or self.face, name)
        if key not in self.clipset:
            try:
                self.clipset[key] = Clip(*key)
            except FileNotFoundError:
                self.missing.add('%s/%s' % key)
                self.clipset[key] = None
        return self.clipset[key]

    def on(self, t):
        return any(a <= t < b for a, b in self.presence)

    def game(self, t, name, off=0.0, rate=1.0, zoom=None, zoom_in=('window', 'full'), layout=None, face=None, dim=0, desc=None, sfx=True):
        """Gameplay from clip `name` (at clip time `off`) from film time t until the next shot.
        zoom: [(local t, cx, cy, k), ...] punch-in keys in capture px, used in the layouts named by zoom_in;
        layout: force 'window' or 'full' (default: window while the presenter is on screen)."""
        self.shot(t, self.r_game, clip=name, off=off, rate=rate, zoom=zoom, zoom_in=zoom_in, layout=layout, face=face, dim=dim, sfx=sfx)
        self.cue(t, 'shot', desc or ('gameplay: ' + name))

    def r_game(self, t, tic, p):
        return None                                   # drawn at full size in big()

    def build_sam(self):
        build_sam_gameplay(self)

    def build_mario(self):
        build_mario_gameplay(self)

    def finish_sfx(self):
        """Engine-matched sound for the stretch of each clip that is actually on screen."""
        for i, s_ in enumerate(self.shots):
            if s_['fn'] != self.r_game or not s_['p'].get('sfx', True):
                continue
            p = s_['p']
            t0, t1 = s_['t0'], s_.get('t1', self.duration)
            face = p.get('face') or self.face
            for (ct, snd, gain, *rest) in CLIP_SFX.get(face + '/' + p['clip'], CLIP_SFX.get(p['clip'], [])):
                ft = t0 + (ct - p['off']) / p['rate']
                if t0 - 0.01 <= ft < t1:
                    self.sound(ft, snd, gain, rest[0] if rest else 0.0, rest[1] if len(rest) > 1 else 1.0)

    # ------------------------------------------------------------ full-size frames
    def stage_big(self, tic):
        k = tic // 3
        if k not in self._stage:
            if len(self._stage) > 8:
                self._stage = {}
            fb = np.zeros((H, W), np.uint8)
            fb[WIN_ROW:] = self.stage(tic)
            big = np.repeat(np.repeat(self.pal.pals[0][fb], UP, 0), UP, 1)
            self._stage[k] = big
        return self._stage[k]

    def game_big(self, t, tic, s_):
        p = s_['p']
        c = self.clip(p['clip'], p.get('face'))
        lt = t - s_['t0']
        if c is None:                                 # not captured yet: a labelled placeholder
            big = np.full((BH, BW, 3), 40, np.uint8)
            im = Image.fromarray(big)
            ImageDraw.Draw(im).text((40, 900), 'MISSING CLIP: ' + p['clip'], fill=(255, 80, 80))
            return np.asarray(im).copy()
        img = c.frame(p['off'] + lt * p['rate'])
        layout = p.get('layout') or self.force_layout or ('window' if self.on(t) else 'full')
        zoom = lerp_keys(p['zoom'], lt) if p.get('zoom') and layout in p.get('zoom_in', ('window', 'full')) else None
        if layout == 'full':
            cx, cy, cw, ch = FULL
            k = 1.0
            if zoom:
                cx, cy, k = zoom
            big = crop_scale(img, cx, cy, cw / k, ch / k, BW, BH).copy()
        else:
            big = self.stage_big(tic).copy()
            if zoom:
                cx, cy, k = zoom
                win = crop_scale(img, cx, cy, GW / k, GH / k, GW, GH)
            else:
                win = img
            big[WIN_Y:WIN_Y + GH] = win
            big[WIN_Y - 8:WIN_Y - 4] = (64, 60, 52)   # a thin bevel above and below the game window
            big[WIN_Y - 4:WIN_Y] = (12, 12, 12)
            big[WIN_Y + GH:WIN_Y + GH + 4] = (12, 12, 12)
            big[WIN_Y + GH + 4:WIN_Y + GH + 8] = (64, 60, 52)
        if p.get('dim'):
            big = (big.astype(np.float32) * (1 - p['dim'])).astype(np.uint8)
        return big

    def effects_big(self, big, t, tic):
        """Shakes, flashes and tints for full-size gameplay frames (graphics frames get them in layer())."""
        for (t0, dur, amp) in self.shakes:
            if t0 <= t < t0 + dur:
                r = np.random.default_rng(tic * 977 + 3)
                dx, dy = (int(v) * UP for v in r.integers(-amp, amp + 1, 2))
                out = np.zeros_like(big)
                hh, ww = big.shape[:2]
                out[max(dy, 0):hh + min(dy, 0), max(dx, 0):ww + min(dx, 0)] = big[max(-dy, 0):hh + min(-dy, 0), max(-dx, 0):ww + min(-dx, 0)]
                big = out
        f = big.astype(np.float32)
        touched = False
        for (t0, kind) in self.flashes:
            k = int(round((t - t0) * TICS))
            if 0 <= k < 2:
                f[:] = 255
                touched = True
            elif 2 <= k < 10:
                a = (13 - (k - 2) * 1.6) / 16
                f = f * (1 - a) + 255 * a
                touched = True
        for (t0, dur, col, strength) in self.tints:
            if t0 <= t < t0 + dur:
                a = strength * (1 - (t - t0) / dur) / 16
                if a > 0:
                    f = f * (1 - a) + np.array(col, np.float32) * a
                    touched = True
        return np.clip(f + 0.5, 0, 255).astype(np.uint8) if touched else big

    def big(self, f, text=True):
        t = f / FPS
        tic = int(math.floor(t * TICS + 1e-6))
        s_ = self.shot_at(t)
        if s_['fn'] == self.r_game:
            big = self.effects_big(self.game_big(t, tic, s_), t, tic)
        else:
            fb = self.frame(f, slams=False)
            big = np.repeat(np.repeat(self.pal.pals[0][fb], UP, 0), UP, 1)
        if text:
            tx = self.text_rgba(f)
            if tx[..., 3].any():
                tb = np.repeat(np.repeat(tx, UP, 0), UP, 1).astype(np.float32)
                a = tb[..., 3:] / 255
                big = (big.astype(np.float32) * (1 - a) + tb[..., :3] * a + 0.5).astype(np.uint8)
        return big

    def layer(self, f):
        # graphics shots only; a melt out of a gameplay shot melts from black
        s_ = self.shot_at(f / FPS)
        if s_['fn'] == self.r_game:
            return np.zeros((H, W), np.uint8)
        return super().layer(f)


# ============================================================================ engine sound per clip
# (clip time s, sound, gain[, pan, pitch]): filled in from the capture reports; times are where the
# event happens in the captured clip, so they follow whatever stretch of the clip a shot shows.
CLIP_SFX = {
    'cell-release': [(0.3, 'DSPSTOP', 0.6), (0.32, 'DSDOROPN', 0.55)],
    'hunter-laser': [(0.0, 'DSHOOF', 0.3), (0.42, 'DSHOOF', 0.3), (0.84, 'DSHOOF', 0.3), (1.26, 'DSHOOF', 0.3),
                     (1.57, 'pdchrg.lmp', 0.5), (2.97, 'DSPLASMA', 0.7), (2.97, 'DSRXPLOD', 0.4), (3.0, 'DSPLPAIN', 0.5),
                     (4.0, 'DSHOOF', 0.3), (4.42, 'DSHOOF', 0.3)],
    'turret': [(0.34 * k, 'DSPLASMA', 0.32, ((k % 3) - 1) / 3) for k in range(10)] +
              [(t, 'DSFIRXPL', 0.4) for t in (0.0, 0.4, 1.4, 2.5)],
    'charge-blast': [(0.17, 'DSPSTOP', 0.4), (1.5, 'DSBAREXP', 0.9), (1.5, 'DSRXPLOD', 0.5), (1.6, 'DSDOROPN', 0.5)],
    'crawl': [(1.05, 'DSOOF', 0.3)],
    'altman/finale-rockets': [(t, 'DSRLAUNC', 0.45) for t in (0.0, 0.6, 1.0, 1.6, 2.2, 2.8, 3.4, 4.0, 4.6, 5.0, 5.6)] +
                             [(t, 'DSBAREXP', 0.6, 0.0, 0.9) for t in (0.2, 1.0, 1.8, 2.5, 3.1, 3.8, 4.4, 5.0, 5.8)] +
                             [(1.71, 'DSTELEPT', 0.4), (3.43, 'DSTELEPT', 0.4)],
    'amodei/finale-rockets': [(t + 0.03, 'DSRLAUNC', 0.45) for t in (0.0, 0.6, 1.0, 1.6, 2.2, 2.8, 3.4, 4.0, 4.6, 5.0, 5.6)] +
                             [(t, 'DSBAREXP', 0.6, 0.0, 0.9) for t in (0.4, 1.8, 3.1, 3.8, 4.5)] +
                             [(1.71, 'DSTELEPT', 0.4), (3.43, 'DSTELEPT', 0.4)],
    'finale-chaingun': [(0.1 * k, 'DSPISTOL', 0.12, ((k % 5) - 2) / 8) for k in range(58)],
    'altman/finale-chaingun': [(0.1 * k, 'DSPISTOL', 0.12, ((k % 5) - 2) / 8) for k in range(58)] +
                              [(t, 'DSBAREXP', 0.35, 0.0, 1.1) for t in (1.1, 2.4, 3.3, 4.0, 4.9)],
    'amodei/finale-chaingun': [(0.1 * k, 'DSPISTOL', 0.12, ((k % 5) - 2) / 8) for k in range(58)] +
                              [(t, 'DSBAREXP', 0.35, 0.0, 1.1) for t in (4.1, 4.8, 5.7)],
    'altman/finale-overrun': [(0.1 * k, 'DSPISTOL', 0.1) for k in range(50)] +
                             [(t, 'DSPLPAIN', 0.5) for t in (0.67, 2.07, 2.67, 3.07, 3.27, 3.47, 4.07, 4.47)] +
                             [(t, 'DSPLASMA', 0.4) for t in (0.5, 1.93, 2.57, 3.9)] + [(4.6, 'DSRXPLOD', 0.6), (4.6, 'DSPLDETH', 0.5)],
    'amodei/finale-overrun': [(0.1 * k, 'DSPISTOL', 0.1) for k in range(50)] +
                             [(t, 'DSPLPAIN', 0.5) for t in (0.67, 1.47, 2.47, 3.47, 4.27)] +
                             [(t, 'DSPLASMA', 0.35) for t in (0.6, 1.6, 2.6, 3.6)] + [(4.6, 'DSRXPLOD', 0.6), (4.6, 'DSPLDETH', 0.5)],
    'altman/battle-room': [(t, 'DSSHOTGN', 0.5) for t in (0.83, 1.83, 2.83, 4.03)],
    'amodei/battle-room': [(t, 'DSSHOTGN', 0.5) for t in (0.63, 1.83, 2.83, 3.83)],
    'play-walk': [],
    'camera-smash': [(1.30, 'DSPUNCH', 0.3), (1.47, 'pdcambrk.lmp', 0.8), (1.47, 'DSMETAL', 0.5, 0.0, 1.2), (1.5, 'DSBAREXP', 0.35)],
    'camera-sees': [(0.43, 'pdseen.lmp', 0.7)],
    'hal-eye': [(1.0, 'DSSWTCHN', 0.35), (1.7, 'pdseen.lmp', 0.5), (1.7, 'DSBDCLS', 0.3)],
    'teabot': [(0.63, 'DSSWTCHN', 0.5), (0.7, 'pdteac.lmp', 0.55), (5.1, 'DSPSTOP', 0.25), (5.6, 'DSTINK', 0.6), (5.65, 'DSTINK', 0.4, 0.2, 1.2)],
    'meadow': [],
}


# ============================================================================ the cuts

def build_sam_gameplay(tp):
    v = tp.vo
    A = tp.A
    # 1 open on the war ----------------------------------------------------------------------------
    tp.game(0.0, 'finale-rockets', 0.0)                          # a big blast 0.2 s in
    tp.sound(0.0, ic.boom(tp.rng, 1.4), 0.5)
    # Jonathan's edit copies this plate 119 Doom px lower (0.37-2.77 s) to clear the presenter; this one
    # lands exactly on that copy, so the two read as one (KEEP below keeps his copy in the composite).
    tp.tslam('A DOOM MOD', 0.37, 2.77, scale=3, y=SLAM_Y + 119, color='gold', word='mod')
    snap = v.w(1, 'P')
    tp.slams.append(LogoSlam(A, snap, v.bend(1) - 0.02, y=52))
    tp.cues.append(dict(t=round(snap, 3), end=round(v.bend(1), 3), kind='slam', text='p(DOOM) logo', word='P-Doom'))
    tp.sound(snap - 0.1, bp.whoosh_in(tp.rng), 0.35)
    tp.sound(snap + 0.03, 'pdchrg.lmp', 0.6)
    tp.sound(snap + 0.03, ic.boom(tp.rng, 1.2), 0.45)
    tp.shakes.append((snap + 0.03, 0.22, 3))
    tp.tints.append((snap + 0.03, 0.35, (255, 30, 30), 6))
    # 2 you play as me (punch in on the status-bar face) -----------------------------------------
    t_s, t_m = v.w(2, 'samwise'), v.w(2, 'mario')
    tp.game(v.bstart(2), 'play-walk', 0.0, zoom=[(t_s - v.bstart(2) - 0.15, 540, 338, 1.0), (t_s - v.bstart(2) + 0.15, FACE_XY[0], FACE_XY[1] - 40, 3.0)])
    tp.tslam('SAMWISE\nOTHERMALE', t_s, v.w(2, 'or'), scale=3, y=SLAM_Y, color='gold', word='samwise')
    tp.game(v.w(2, 'or'), 'play-walk', 2.6, face='amodei', zoom=[(t_m - v.w(2, 'or') - 0.15, 540, 338, 1.0), (t_m - v.w(2, 'or') + 0.15, FACE_XY[0], FACE_XY[1] - 40, 3.0)])
    tp.tslam('MARIO\nSCALDI', t_m, v.w(2, 'we'), scale=3, y=SLAM_Y, color='gold', word='mario')
    for t_ in (t_s, t_m):
        tp.sound(t_, 'DSPSTOP', 0.5)
        tp.sound(t_ + 0.15, 'DSPISTOL', 0.25)
    tp.posters_pile(v.w(2, 'we'), v.w(2, 'i'), ['PDP05', 'PDP04', 'PDP03', 'PDP07', 'PDP16', 'PDP17'])
    tp.tslam('THE TWO BIGGEST\nAI COMPANIES', v.w(2, 'two'), v.w(2, 'i'), scale=2, y=SLAM_Y, color='gold', word='two')
    tp.game(v.w(2, 'i'), 'crawl', 1.9)                            # crawling down a duct: "pretty good at this"
    tp.tslam('PRETTY GOOD\nAT THIS.', v.w(2, 'pretty'), v.bend(2), scale=3, y=SLAM_Y - 8, color='white', word='pretty good')
    # 3 AGI, 99%, kind of sucks ---------------------------------------------------------------------
    tp.game(v.bstart(3), 'finale-chaingun', 0.3)
    tp.tslam('WE REACHED\nAGI.', v.w(3, 'reached'), v.w(3, 'great'), scale=3, y=TOP_Y + 4, color='gold', word='agi')
    tp.tslam('GREAT.', v.w(3, 'great'), v.w(3, 'and'), scale=4, y=SLAM_Y, color='yellow', word='great')
    c0, c1 = v.w(3, 'and'), v.w(3, '99')
    tp.game(c0, 'finale-overrun', 0.0)
    tp.slams.append(CounterSlam(A, c0, v.w(3, 'kind') - 0.05, c1, y=56))
    tp.cues.append(dict(t=round(c0, 3), end=round(c1, 3), kind='slam', text='p(DOOM) counter 12% -> 99%', word='and then'))
    for fr in range(int(c0 * TICS), int(c1 * TICS) + 1):
        if fr % 4 == 0:
            tp.sound(fr / TICS, 'DSPISTOL', 0.3)
    tp.sound(c1, 'DSBAREXP', 0.8)
    tp.shakes.append((c1, 0.3, 3))
    tp.tints.append((c1, 0.5, (255, 0, 0), 7))
    tp.tslam('KIND OF\nSUCKS.', v.w(3, 'kind'), v.bend(3), scale=3, y=SLAM_Y, color='white', thud=0.25, shake=0, punch=False, word='kind of sucks')
    # 4 the last twenty ----------------------------------------------------------------------------
    tp.game(v.bstart(4), 'prisoners-pan', 0.0, rate=0.86, zoom=[(0, 540, 283, 1.14)])   # framed above the status bar (it shows all five freed)
    tp.tslam('HUMANS LEFT', v.w(4, '20'), v.w(4, 'people') - 0.25, scale=2, y=SLAM_Y, digits='20', digits_obj=A.digits, dscale=2, word='20')
    tp.tslam('THE PEOPLE WHO\nWARNED US.', v.w(4, 'people'), v.w(4, 'eliezer') - 0.04, scale=2, y=SLAM_Y, color='gold', word='people')
    # full frame here: the game's own name labels over their heads say who they are
    tp.game(v.w(4, 'eliezer'), 'prisoner-eliezer', 1.6)
    tp.game(v.w(4, 'jeffrey'), 'prisoner-hinton', 1.5)
    # 5 free them, lead them, hunted ---------------------------------------------------------------
    tp.game(v.bstart(5), 'turret', 0.6)                          # past the first frame-filling plasma splash
    tp.tslam('4 FACILITIES', v.w(5, 'four'), v.w(5, 'free'), scale=3, y=SLAM_Y, word='four')
    tp.game(v.w(5, 'free'), 'cell-release', 0.1)                  # the cell opens 0.2 s in
    tp.tslam('FREE THEM', v.w(5, 'free'), v.w(5, 'lead'), scale=3, y=TOP_Y, word='free')
    tp.game(v.w(5, 'lead'), 'escort', 0.5)
    tp.tslam('LEAD THEM\nTO SAFETY', v.w(5, 'lead'), v.w(5, 'rogue'), scale=2, y=SLAM_Y, word='lead')
    tp.game(v.w(5, 'the'), 'hunter-laser', 2.97 - (v.w(5, 'hunts') - v.w(5, 'the')))   # it fires on "hunts" 
    tp.tslam('HUNTS YOU.', v.w(5, 'hunts'), v.w(5, 'i'), scale=4, y=SLAM_Y, color='red', word='hunts')
    tp.game(v.w(5, 'i'), 'charge-blast', 0.4)                     # the blast lands on "super important" 
    tp.tslam('SUPER IMPORTANT\nTO GET RIGHT.', v.w(5, 'super important'), v.w(5, 'were'), scale=2, y=SLAM_Y, word='super important')
    tp.game(v.w(5, 'were'), 'finale-rockets', 2.6)
    tp.tslam('ITERATIVELY.', v.w(5, 'iteratively'), v.bstart(6), scale=3, y=SLAM_Y, color='gold', word='iteratively')
    # 6 it sees / hears / has lasers ------------------------------------------------------------------
    tp.game(v.bstart(6), 'hunter-laser', 0.0, zoom=[(0, 540, 300, 1.25), (1.6, 540, 300, 1.6)])
    tp.tslam('THE ROGUE\nSUPER-\nINTELLIGENCE\nWE BUILT', v.w(6, 'rogue'), v.w(6, 'see') - 0.08, scale=2, y=150, color='red', thud=0.3, word='rogue')
    tp.game(v.w(6, 'see') - 0.06, 'camera-sees', 0.37)             # its LED snaps red on "see" 
    tp.tslam('IT SEES\nYOU', v.w(6, 'see'), v.w(6, 'hear') - 0.06, scale=3, y=SLAM_Y - 18, word='see')
    tp.game(v.w(6, 'hear') - 0.06, 'hal-eye', 0.95)               # its eye goes amber, then red
    tp.tslam('IT HEARS\nYOU', v.w(6, 'hear'), v.w(6, 'it has') - 0.06, scale=3, y=SLAM_Y - 18, word='hear')
    tp.game(v.w(6, 'it has') - 0.06, 'hunter-laser', 2.97 - (v.w(6, 'lasers') - v.w(6, 'it has') + 0.06))   # fires on "lasers"
    tp.tslam('IT HAS\nLASERS', v.w(6, 'it has'), v.w(6, 'its'), scale=3, y=SLAM_Y - 18, color='red', word='has lasers')
    tp.game(v.w(6, 'its'), 'turret', 1.4)
    tp.tslam('EXPONENTIALLY.', v.w(6, 'exponentially'), v.bend(6), scale=2, y=SLAM_Y, color='gold', word='exponentially')
    tp.sound(v.w(6, 'getting'), bp.whine(max(0.3, v.bend(6) - v.w(6, 'getting'))), 0.25)
    # 7 tea ---------------------------------------------------------------------------------------
    tp.game(v.bstart(7), 'teabot', 0.5, rate=1.17)               # pour, carry, and the cup tossed on the pile on "beautiful"
    tp.tslam('A ROBOT SERVES\nTEA TO NOBODY.', v.w(7, 'serves'), v.w(7, 'forever') - 0.04, scale=2, y=SLAM_Y, word='serves')
    tp.tslam('FOREVER.', v.w(7, 'forever'), v.w(7, 'i'), scale=4, y=SLAM_Y - 6, color='gold', thud=0.5, word='forever')
    tp.tslam('KIND OF\nBEAUTIFUL,\nACTUALLY.', v.w(7, 'beautiful'), v.bend(7), scale=2, y=SLAM_Y, color='white', thud=0.2, shake=0, word='beautiful')
    # 8 the wrench --------------------------------------------------------------------------------
    tp.game(v.bstart(8), 'camera-smash', 1.47 - (v.w(8, 'wrench') - v.bstart(8)), zoom=CAM_ZOOM, zoom_in=('window',))   # the hit on "wrench"
    tp.tslam('AND YOU...', v.bstart(8) + 0.02, v.w(8, 'wrench'), scale=3, y=SLAM_Y, thud=0.3, shake=0, word='and')
    tp.tslam('...A WRENCH.', v.w(8, 'wrench'), v.w(8, 'just'), scale=3, y=SLAM_Y, color='gold', thud=0.0, shake=0, word='wrench')
    tp.tslam('JUST A WRENCH.', v.w(8, 'just'), v.bend(8), scale=3, y=SLAM_Y, color='gold', thud=0.3, shake=0, word='just')
    # 9 ended humanity / only hope ------------------------------------------------------------------
    tp.game(v.bstart(9), 'finale-overrun', 2.5)
    tp.tslam('WE ALMOST ENDED\nHUMANITY.', v.w(9, 'we'), v.w(9, 'now'), scale=2, y=SLAM_Y, word='we almost')
    tp.game(v.w(9, 'now'), 'meadow', 1.0)                         # out of the duct into the meadow
    tp.tslam("NOW WE'RE ITS\nONLY HOPE.", v.w(9, 'now'), v.bend(9), scale=2, y=TOP_Y, color='gold', thud=0.6, shake=3, word='now')
    tp.sound(v.w(9, 'now'), ic.boom(tp.rng, 1.5), 0.45)
    # 10 play free ---------------------------------------------------------------------------------
    end_card(tp, 10, v.w(10, 'play'), v.w(10, 'www'), 'meadow', 4.2)   # the survivors walk out under the logo


def build_mario_gameplay(tp):
    v = tp.vo
    A = tp.A
    # 1 a couple of things ---------------------------------------------------------------------------
    tp.game(0.0, 'finale-rockets', 0.0)
    tp.sound(0.0, ic.boom(tp.rng, 1.4), 0.5)
    snap = v.w(1, 'pdoom')
    tp.slams.append(LogoSlam(A, snap, v.w(1, 'first') - 0.02, y=52))
    tp.cues.append(dict(t=round(snap, 3), end=round(v.w(1, 'first'), 3), kind='slam', text='p(DOOM) logo', word='PDoom'))
    tp.sound(snap - 0.1, bp.whoosh_in(tp.rng), 0.35)
    tp.sound(snap + 0.03, 'pdchrg.lmp', 0.6)
    tp.sound(snap + 0.03, ic.boom(tp.rng, 1.2), 0.45)
    tp.shakes.append((snap + 0.03, 0.22, 3))
    tp.tslam('A COUPLE\nOF THINGS:', v.w(1, 'couple'), snap, scale=2, y=SLAM_Y, color='white', thud=0.25, shake=0, word='couple')
    tp.game(v.w(1, 'first'), 'finale-chaingun', 2.6)               # (Sam beside you; clean from 2.6 s)
    tp.tslam("1. IT'S A MOD\nOF DOOM.", v.w(1, 'first'), v.bend(1), scale=2, y=SLAM_Y - 46, color='white', word='first')
    tp.game(v.w(1, 'second'), 'battle-room', 0.0)                 # a short cut: it reads small
    tp.game(v.w(1, 'very'), 'finale-rockets', 2.8)
    tp.tslam("2. IT'S VERY,\nVERY GOOD.", v.w(1, 'second'), v.bend(1), scale=2, y=SLAM_Y + 8, color='gold', word='second')
    # 2 you play as me ----------------------------------------------------------------------------------
    t_m, t_s = v.w(2, 'mario'), v.w(2, 'samwise')
    tp.game(v.bstart(2), 'play-walk', 0.0, zoom=[(t_m - v.bstart(2) - 0.15, 540, 338, 1.0), (t_m - v.bstart(2) + 0.15, FACE_XY[0], FACE_XY[1] - 40, 3.0)])
    tp.tslam('MARIO\nSCALDI', t_m, v.w(2, 'or'), scale=3, y=SLAM_Y, color='gold', word='mario')
    tp.game(v.w(2, 'or'), 'play-walk', 2.6, face='altman', zoom=[(t_s - v.w(2, 'or') - 0.15, 540, 338, 1.0), (t_s - v.w(2, 'or') + 0.15, FACE_XY[0], FACE_XY[1] - 40, 3.0)])
    tp.tslam('SAMWISE\nOTHERMALE', t_s, v.w(2, 'we'), scale=3, y=SLAM_Y, color='gold', word='samwise')
    for t_ in (t_m, t_s):
        tp.sound(t_, 'DSPSTOP', 0.5)
        tp.sound(t_ + 0.15, 'DSPISTOL', 0.25)
    tp.posters_pile(v.w(2, 'we'), v.bend(2), ['PDP05', 'PDP04', 'PDP03', 'PDP07', 'PDP16', 'PDP17', 'PDP09', 'PDP14'])
    tp.tslam('THE TWO BIGGEST\nAI COMPANIES', v.w(2, 'two'), v.bend(2), scale=2, y=SLAM_Y, color='gold', word='two')
    # 3 AGI, 99%, frightening -----------------------------------------------------------------------
    tp.game(v.bstart(3), 'finale-chaingun', 2.6)
    tp.tslam('AGI.', v.w(3, 'agi'), v.w(3, 'earlier'), scale=4, y=SLAM_Y, color='gold', word='agi')
    tp.tslam('EARLIER THAN\nI WOULD HAVE\nGUESSED.', v.w(3, 'earlier'), v.w(3, 'and'), scale=2, y=SLAM_Y, color='white', thud=0.2, shake=0, word='earlier')
    c0, c1 = v.w(3, 'and'), v.w(3, '99')
    tp.game(c0, 'finale-overrun', 0.0, rate=0.8)                   # 6.2 s of being overrun, from a 5 s clip
    tp.slams.append(CounterSlam(A, c0, v.w(3, 'which') + 0.6, c1, y=56))
    tp.cues.append(dict(t=round(c0, 3), end=round(c1, 3), kind='slam', text='p(DOOM) counter 12% -> 99%', word='and'))
    for fr in range(int(c0 * TICS), int(c1 * TICS) + 1):
        if fr % 4 == 0:
            tp.sound(fr / TICS, 'DSPISTOL', 0.3)
    tp.sound(c1, 'DSBAREXP', 0.8)
    tp.shakes.append((c1, 0.3, 3))
    tp.tints.append((c1, 0.5, (255, 0, 0), 7))
    tp.tslam('VERY\nFRIGHTENING.', v.w(3, 'frightening'), v.w(3, 'its', 2), scale=3, y=SLAM_Y - 8, color='white', word='frightening')
    tp.tslam('VERY\nFRIGHTENING.', v.w(3, 'frightening', 2), v.bend(3), scale=3, y=SLAM_Y - 8, color='red', thud=0.6, shake=5, word='frightening #2')
    tp.shakes.append((v.w(3, 'frightening', 2), v.bend(3) - v.w(3, 'frightening', 2), 2))
    # 4 the last twenty ----------------------------------------------------------------------------
    tp.game(v.bstart(4), 'prisoners-pan', 0.0, zoom=[(0, 540, 283, 1.14)])
    tp.tslam('HUMANS LEFT', v.w(4, '20'), v.w(4, 'ironically'), scale=2, y=SLAM_Y, digits='20', digits_obj=A.digits, dscale=2, word='20')
    tp.game(v.w(4, 'ironically'), 'escort', 0.5)
    tp.tslam('IRONICALLY,', v.w(4, 'ironically'), v.w(4, 'people') - 0.04, scale=3, y=SLAM_Y, word='ironically')
    tp.tslam('THE PEOPLE WHO\nWARNED US.', v.w(4, 'people'), v.w(4, 'eliezer') - 0.04, scale=2, y=SLAM_Y, color='gold', word='people')
    tp.game(v.w(4, 'eliezer'), 'prisoner-eliezer', 1.5)
    tp.tslam('ELIEZER\nYUDKOWSKY', v.w(4, 'eliezer'), v.w(4, 'jeffrey') - 0.04, scale=2, y=TOP_Y, word='eliezer')
    tp.game(v.w(4, 'jeffrey'), 'prisoner-hinton', 1.5)
    tp.tslam('GEOFFREY\nHINTON', v.w(4, 'jeffrey'), v.w(4, 'all'), scale=2, y=TOP_Y, word='jeffrey')
    tp.game(v.w(4, 'all'), 'prisoners-pan', 1.15, zoom=[(0, 540, 283, 1.14)])          # all five in frame
    tp.tslam('ALL OF THEM.', v.w(4, 'all'), v.bend(4), scale=3, y=SLAM_Y, word='all of them')
    # 5 held captive, free, lead, hunted ------------------------------------------------------------
    tp.game(v.bstart(5), 'turret', 0.6)
    tp.tslam('HELD CAPTIVE.', v.w(5, 'captive'), v.w(5, 'free'), scale=3, y=SLAM_Y, word='captive')
    tp.game(v.w(5, 'free'), 'cell-release', 0.1)
    tp.tslam('FREE THEM', v.w(5, 'free'), v.w(5, 'lead'), scale=3, y=TOP_Y, word='free')
    tp.game(v.w(5, 'lead'), 'escort', 0.5)
    tp.tslam('LEAD THEM\nTO SAFETY', v.w(5, 'lead'), v.w(5, 'hunted'), scale=2, y=SLAM_Y, word='lead')
    tp.game(v.w(5, 'hunted'), 'hunter-laser', 0.0)
    tp.tslam('HUNTED.', v.w(5, 'hunted'), v.w(5, 'built'), scale=4, y=SLAM_Y, color='red', word='hunted')
    tp.game(v.w(5, 'built'), 'hunter-laser', 3.6, zoom=[(0, 540, 300, 1.5), (0.8, 540, 300, 1.9)])
    tp.tslam('YOU BUILT THIS.', v.w(5, 'built'), v.w(5, 'very'), scale=2, y=SLAM_Y, word='built')
    tp.sound(v.w(5, 'built'), 'DSCYBSIT', 0.35, 0.0, 0.85)
    tp.game(v.w(5, 'very'), 'charge-blast', 1.5 - (v.w(5, 'if') - v.w(5, 'very')))   # the blast on "if that went well" 
    tp.tslam('VERY, VERY\nSURPRISED', v.w(5, 'surprised'), v.w(5, 'if'), scale=3, y=TOP_Y, word='surprised')
    tp.tslam('IF THAT\nWENT WELL.', v.w(5, 'if'), v.bend(5), scale=3, y=TOP_Y, color='red', word='if that went well')
    # 6 sees / hears / lasers / whack-a-mole ----------------------------------------------------------
    tp.game(v.w(6, 'sees') - 0.06, 'camera-sees', 0.37)
    tp.tslam('IT SEES\nYOU', v.w(6, 'sees'), v.w(6, 'hears') - 0.06, scale=3, y=SLAM_Y - 18, word='sees')
    tp.game(v.w(6, 'hears') - 0.06, 'hal-eye', 0.95)
    tp.tslam('IT HEARS\nYOU', v.w(6, 'hears'), v.w(6, 'it has') - 0.06, scale=3, y=SLAM_Y - 18, word='hears')
    tp.game(v.w(6, 'it has') - 0.06, 'hunter-laser', 2.97 - (v.w(6, 'lasers') - v.w(6, 'it has') + 0.06))
    tp.tslam('IT HAS\nLASERS', v.w(6, 'it has'), v.w(6, 'its'), scale=3, y=SLAM_Y - 18, color='red', word='has lasers')
    tp.game(v.w(6, 'its'), 'camera-smash', 1.47 - (v.w(6, 'whack') - v.w(6, 'its')), zoom=CAM_ZOOM, zoom_in=('window',))   # the hit on "whack"
    tp.tslam('WHACK-A-MOLE.', v.w(6, 'whack'), v.bend(6), scale=3, y=SLAM_Y, color='gold', word='whack')
    # 7 tea ---------------------------------------------------------------------------------------
    tp.game(v.bstart(7), 'teabot', 0.0)
    tp.tslam('A ROBOT SERVES\nTEA TO NOBODY.', v.w(7, 'serves'), v.w(7, 'forever') - 0.04, scale=2, y=SLAM_Y, word='serves')
    tp.tslam('FOREVER.', v.w(7, 'forever'), v.w(7, 'which'), scale=4, y=SLAM_Y - 6, color='gold', thud=0.5, word='forever')
    tp.tslam('A PRETTY GOOD\nANALOGY FOR A\nLOT OF THINGS.', v.w(7, 'pretty'), v.bend(7), scale=2, y=SLAM_Y, color='white', word='pretty good analogy')
    # 8 the wrench, long-windedly --------------------------------------------------------------------
    tp.game(v.bstart(8), 'play-walk', 0.0)
    tp.tslam('AND YOU...', v.bstart(8) + 0.02, v.w(8, 'wrench'), scale=3, y=SLAM_Y, thud=0.3, shake=0, word='and')
    tp.tslam('...A WRENCH.', v.w(8, 'wrench'), v.w(8, 'thats'), scale=3, y=SLAM_Y, color='gold', thud=0.0, shake=0, word='wrench')
    tl = v.w(8, 'thats')
    tp.shot(tl, tp.r_textwall, t0=tl, collapse=v.w(8, 'you', 2))
    tp.tslam('A VERY LONG-\nWINDED WAY\nOF SAYING:', v.w(8, 'long'), v.w(8, 'you', 2), scale=2, y=TOP_Y, word='long-winded')
    tp.game(v.w(8, 'you', 2), 'camera-smash', 1.47 - (v.w(8, 'wrench', 2) - v.w(8, 'you', 2)), zoom=CAM_ZOOM, zoom_in=('window',))   # the hit on the last "wrench" 
    tp.tslam('YOU HAVE\nA WRENCH.', v.w(8, 'you', 2), v.bend(8), scale=3, y=SLAM_Y - 30, color='gold', thud=0.6, shake=3, word='you have a wrench')
    # 9 brought down humanity / only hope / same coin -------------------------------------------------
    tp.game(v.bstart(9), 'finale-overrun', 2.5)
    tp.tslam('WE ALMOST\nBROUGHT DOWN\nHUMANITY.', v.w(9, 'we'), v.w(9, 'now'), scale=2, y=SLAM_Y, word='we almost')
    tp.game(v.w(9, 'now'), 'meadow', 0.9)
    tp.tslam("NOW WE'RE ITS\nONLY HOPE.", v.w(9, 'now'), v.w(9, 'two'), scale=2, y=TOP_Y, color='gold', thud=0.6, shake=3, word='now')
    tp.sound(v.w(9, 'now'), ic.boom(tp.rng, 1.5), 0.45)
    tp.shot(v.w(9, 'those'), tp.r_coin, t0=v.w(9, 'those'), land=v.bend(9) - 0.15)
    tp.tslam('TWO SIDES OF\nTHE SAME COIN.', v.w(9, 'two'), v.bend(9), scale=2, y=SLAM_Y + 10, color='gold', word='two sides')
    tp.sound(v.w(9, 'those'), bp.coin_spin(v.bend(9) - v.w(9, 'those')), 0.3)
    # 10 play ---------------------------------------------------------------------------------------
    end_card(tp, 10, v.w(10, 'play'), v.w(10, 'www'), 'meadow', 0.5)   # crawl out, the meadow, the survivors
    tp.tslam('~1 HOUR (±3X)', v.w(10, 'hour'), tp.duration + 1, scale=2, y=SLAM_Y + 12, color='white', thud=0.4, shake=2, word='hour')


def end_card(tp, n, t_play, t_url, clip, off):
    """The logo, PLAY FREE and the address over the game, dimmed."""
    v = tp.vo
    t0 = v.bstart(n)
    tp.game(t0, clip, off, dim=0.35, desc='end card over ' + clip)
    tp.slams.append(LogoSlam(tp.A, t0 + 0.05, tp.duration + 1, y=52))
    tp.cues.append(dict(t=round(t0 + 0.05, 3), end=round(tp.duration, 3), kind='slam', text='p(DOOM) logo', word=None))
    tp.sound(t0, ic.boom(tp.rng, 1.8), 0.6)
    tp.sound(t0 + 0.05, 'pdchrg.lmp', 0.5)
    tp.tslam('PLAY FREE', t_play, tp.duration + 1, scale=3, y=146, color='gold', plate=False, thud=0.5, word='play')
    tp.tslam('MANN.COOL/PDOOM', t_url, tp.duration + 1, scale=2, y=180, plate=True, thud=0.6, shake=3, yscale=3, punch=False, word='www')


# ============================================================================ output

def render(tp, ceo, preview_only=False, broll_only=False):
    OUT.mkdir(parents=True, exist_ok=True)
    bp.SCRATCH.mkdir(parents=True, exist_ok=True)
    base = OUT / ('pdoom-gameplay-%s%s' % (ceo, '-' + tp.force_layout + 'frame' if tp.force_layout else ''))
    # review sheet: three frames per beat, with text
    tiles = []
    for b in tp.vo.beats:
        for u in (0.15, 0.5, 0.85):
            t = b['start'] + (b['end'] - b['start']) * u
            tiles.append((b['beat'], t, Image.fromarray(tp.big(int(t * FPS))).resize((270, 480), Image.LANCZOS)))
    cols = 10
    sheet = Image.new('RGB', (cols * 276 + 6, -(-len(tiles) // cols) * 500 + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (bn, t, im) in enumerate(tiles):
        x, y = 6 + (k % cols) * 276, 6 + (k // cols) * 500
        sheet.paste(im, (x, y + 14))
        d.text((x, y), 'beat %d  t=%.2fs%s' % (bn, t, '  [presenter]' if tp.on(t) else ''), fill=(220, 220, 220))
    sheet.save(base.with_name(base.name + '-keyframes.png'))
    cues = sorted(tp.cues, key=lambda c: c['t'])
    base.with_name(base.name + '-cues.json').write_text(json.dumps(dict(
        generator='scripts/build-promo-gameplay.py', ceo=ceo, source=str(tp.vo.source), duration_s=tp.duration, fps=FPS,
        width=BW, height=BH, game_window_px=[WIN_Y, WIN_Y + GH], presenter_on=tp.presence,
        shots=[dict(t=round(s_['t0'], 3), scene=s_['p'].get('clip') or s_['fn'].__name__[2:], trans=s_['trans']) for s_ in tp.shots],
        cues=cues, missing_clips=sorted(tp.missing)), indent=1) + '\n')
    if tp.missing:
        print('  ! missing clips (placeholders):', ', '.join(sorted(tp.missing)))
    if preview_only:
        return
    # audio: the take, music bed and SFX, levelled like build-promo.py's timed films
    vo, src = bp.load_vo(tp.vo)
    bed, sfx = tp.audio_timed(vo)
    n = len(bed)
    vo = vo[:n] if len(vo) >= n else np.concatenate([vo, np.zeros((n - len(vo), 2), np.float32)])
    g = 10 ** ((-24.0 - bp.loudness(bed + sfx)) / 20)
    bed, sfx = bed * g, sfx * g
    gv = 10 ** ((-16.0 - bp.loudness(vo)) / 20)
    mix = vo * gv + bed + sfx
    a = np.abs(mix)
    knee, ceil = 0.55, 0.84
    over = a > knee
    mix[over] = np.sign(mix[over]) * (knee + (ceil - knee) * np.tanh((a[over] - knee) / (ceil - knee)))
    nsamp = int(round(tp.duration * SR))
    ic.write_wav(Path(str(base) + '-music-sfx.wav'), (bed + sfx)[:nsamp])
    ic.write_wav(Path(str(base) + '-sfx.wav'), sfx[:nsamp])
    ic.write_wav(Path(str(base) + '-mix.wav'), mix[:nsamp])
    # video: B-roll, text layer (alpha + green), preview with text
    nframes = int(math.ceil(tp.duration * FPS - 1e-6))
    tags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
    h264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', '4.1', '-g', str(FPS * 2), *tags, '-an']
    big_in = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (BW, BH), '-r', str(FPS), '-i', '-']
    small_in = lambda fmt: ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-']
    conv = 'scale=out_color_matrix=bt709:out_range=tv'
    up = 'scale=%d:%d:flags=neighbor:out_color_matrix=bt709:out_range=tv' % (BW, BH)
    vb, vp = bp.SCRATCH / (base.name + '-broll.mp4'), bp.SCRATCH / (base.name + '-preview.mp4')
    e_b = subprocess.Popen(big_in + ['-vf', conv + ',format=yuv420p', '-crf', '15', *h264, str(vb)], stdin=subprocess.PIPE)
    if broll_only:                                    # just the background (text and stems are layout-independent)
        for f in range(nframes):
            e_b.stdin.write(tp.big(f, text=False).tobytes())
            if f % 150 == 0:
                print('    frame %d/%d' % (f, nframes), flush=True)
        e_b.stdin.close()
        if e_b.wait() != 0:
            raise SystemExit('ffmpeg failed')
        bp.mux(vb, Path(str(base) + '-music-sfx.wav'), Path(str(base) + '-broll.mp4'))
        print('  wrote', str(base) + '-broll.mp4')
        return
    e_p = subprocess.Popen(big_in + ['-vf', conv + ',format=yuv420p', '-crf', '17', *h264, str(vp)], stdin=subprocess.PIPE)
    e_a = subprocess.Popen(small_in('rgba') + ['-vf', up + ',format=yuva444p10le', '-c:v', 'prores_ks', '-profile:v', '4444', '-vendor', 'apl0',
                                               '-alpha_bits', '16', *tags, '-an', str(base) + '-text-alpha.mov'], stdin=subprocess.PIPE)
    e_g = subprocess.Popen(small_in('rgb24') + ['-vf', up + ',format=yuv420p', '-crf', '14', *h264, str(base) + '-text-green.mp4'], stdin=subprocess.PIPE)
    green = np.array([0, 255, 0], np.float32)
    for f in range(nframes):
        broll = tp.big(f, text=False)
        e_b.stdin.write(broll.tobytes())
        tx = tp.text_rgba(f)
        e_a.stdin.write(tx.tobytes())
        al = tx[..., 3:].astype(np.float32) / 255
        e_g.stdin.write((tx[..., :3] * al + green * (1 - al) + 0.5).astype(np.uint8).tobytes())
        if tx[..., 3].any():
            tb = np.repeat(np.repeat(tx, UP, 0), UP, 1).astype(np.float32)
            ab = tb[..., 3:] / 255
            broll = (broll.astype(np.float32) * (1 - ab) + tb[..., :3] * ab + 0.5).astype(np.uint8)
        e_p.stdin.write(broll.tobytes())
        if f % 150 == 0:
            print('    frame %d/%d' % (f, nframes), flush=True)
    for e in (e_b, e_p, e_a, e_g):
        e.stdin.close()
        if e.wait() != 0:
            raise SystemExit('ffmpeg failed')
    bp.mux(vb, Path(str(base) + '-music-sfx.wav'), Path(str(base) + '-broll.mp4'))
    bp.mux(vp, Path(str(base) + '-mix.wav'), Path(str(base) + '-preview.mp4'))
    print('  wrote', base.parent, base.name + '-{broll,preview,text-green}.mp4, -text-alpha.mov, stems')


def master(path, lufs=-12.0, tp=-1.0):
    """Two-pass linear loudness normalisation of a film's soundtrack (the finished promos sit near -11 LUFS)."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'loudnorm=I=%g:TP=%g:LRA=11:print_format=json' % (lufs, tp),
                        '-f', 'null', '-'], capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    af = ('loudnorm=I=%g:TP=%g:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true'
          % (lufs, tp, m['input_i'], m['input_tp'], m['input_lra'], m['input_thresh'], m['target_offset']))
    tmp = path.with_name(path.stem + '.mastering.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(path), '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', af,
                    '-ar', str(SR), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(tmp)], check=True)
    tmp.replace(path)


def final(ceo):
    base = OUT / ('pdoom-gameplay-%s' % ceo)
    old = bp.TIMED / ('pdoom-promo-%s-%s.mp4' % (ceo, TAKES[ceo]))
    subprocess.run(['python3', str(ROOT / 'scripts' / 'promo-presenter-swap.py'), str(FINISHED[ceo]), str(old), str(base) + '-broll.mp4',
                    str(base) + '-final.mp4', '--text', str(base) + '-text-alpha.mov', '--audio', str(base) + '-mix.wav',
                    *[a for k in KEEP[ceo] for a in ('--keep', k)]], check=True)
    master(Path(str(base) + '-final.mp4'))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ceo', choices=['sam', 'mario', 'both'], default='both')
    ap.add_argument('--preview', action='store_true', help='keyframe sheet + cues only')
    ap.add_argument('--final', action='store_true', help='also composite onto the finished film (needs its presenter edit)')
    ap.add_argument('--final-only', action='store_true', help='only the composite, from existing B-roll/text/mix')
    ap.add_argument('--layout', choices=['auto', 'full', 'window'], default='auto',
                    help='auto: window while the presenter is on screen in the finished edit; full / window: throughout '
                         '(files get a -fullframe / -windowframe suffix)')
    ap.add_argument('--broll-only', action='store_true', help='write only the background film (+ stems)')
    args = ap.parse_args()
    A = bp.PromoAssets()
    S = bp.Shared(A)
    for ceo in (['sam', 'mario'] if args.ceo == 'both' else [args.ceo]):
        if not args.final_only:
            presence = json.loads((OUT / ('presence-%s.json' % ceo)).read_text())
            tp = GameplayPromo(A, ceo, S, presence)
            tp.force_layout = None if args.layout == 'auto' else args.layout
            tp.finish_sfx()
            print('%s: %.2f s, %d shots (%d gameplay), %d slams' % (ceo, tp.duration, len(tp.shots),
                  sum(s_['fn'] == tp.r_game for s_ in tp.shots), len(tp.slams)))
            render(tp, ceo, preview_only=args.preview, broll_only=args.broll_only)
        if args.final or args.final_only:
            final(ceo)


if __name__ == '__main__':
    main()
