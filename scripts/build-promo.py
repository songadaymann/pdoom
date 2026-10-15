#!/usr/bin/env python3
"""Vertical promo for p(DOOM) (Twitter / TikTok B-roll behind a keyed-in AI presenter).

Ten modular beats, one per voiceover line, each timed from its word count (2.6 words/s plus a
0.3 s breath; override with --durations).  Everything is drawn at 270x480 Doom pixels in
PLAYPAL (fonts, flashes and fades through the WAD's own palette/COLORMAP), with the real
engine fly-through footage from the level intros downsampled into the same pixel grid, then
upscaled exactly 4x to 1080x1920, 30 fps, H.264 High.

Layouts
    presenter  all action and key text in y 30..262 (the top ~55%); below, a steady dark Doom
               stage (perspective floor, vignette, a low fire glow) for the keyed-in presenter.
    fullframe  the same beats using the whole frame.

Art, fonts, melts and the p(DOOM) logo come from scripts/build-intro-cutscene.py (imported,
never modified; the logo is composed in memory so its file is never rewritten).

    python3 scripts/build-promo.py                     # everything
    python3 scripts/build-promo.py --preview           # review sheets only
    python3 scripts/build-promo.py --layout presenter
    python3 scripts/build-promo.py --durations 3.4,8.0,4.5,10.3,10.3,5.7,3.8,2.6,3.8,6.8
    python3 scripts/build-promo.py --vo both           # full-frame films cut to the recorded voiceovers
    python3 scripts/build-promo.py --vo sam --preview  # their review sheets only
    python3 scripts/promo-vo-timing.py sam <new.wav> --take mixed   # a re-edited VO take: transcribe + split into beats
    python3 scripts/build-promo.py --vo sam --take mixed             # pdoom-promo-sam-mixed*.mp4, cut to that take
    python3 scripts/build-promo.py --vo sam --take mixed --layers    # + -textless.mp4 / -text-alpha.mov / -text-green.mp4

Outputs (git-ignored: WAD art + engine renders) in doom-web/local/promo/
    pdoom-promo-{presenter,fullframe}.mp4           music bed (~-24 LUFS) + SFX
    pdoom-promo-{presenter,fullframe}-nomusic.mp4   SFX only
    pdoom-promo-{...}-share.mp4                     the same, under 30 MB for phone sharing
    pdoom-promo-music-sfx.wav, pdoom-promo-sfx.wav  stems
    beats/beat-NN.mp4 (presenter), beats/fullframe/beat-NN.mp4, beats.json
Review sheets in output/promo/.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('intro_cutscene', ROOT / 'scripts' / 'build-intro-cutscene.py')
ic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ic)

LOCAL = ROOT / 'doom-web' / 'local'
OUT = LOCAL / 'promo'
REVIEW = ROOT / 'output' / 'promo'
SCRATCH = Path('/tmp/pdoom-promo')
RAW = LOCAL / 'intro' / 'levels' / 'raw'
SPRITES = ROOT / 'doom-mod' / 'sprites'
POSTERS = LOCAL / 'posters'

W, H, FPS, UP, SR = 270, 480, 30, 4, ic.SR
TICS = ic.FPS                     # Doom's 35 Hz: effects and animation step on tics
WPS, BREATH = 2.6, 0.3            # voiceover estimate: words per second, breath after each line
TOP_CLEAR = 30                    # top 6%: phone status bar
KEY_X1 = 243                      # right 10% stays free of key text (platform buttons)
CX = KEY_X1 // 2                  # key text centres here
TEXT_W = 236                      # widest key text line (x 3..239)
clamp, smooth, rect, remap, blit = ic.clamp, ic.smooth, ic.rect, ic.remap, ic.blit

LAYOUTS = {
    'presenter': dict(zy1=262, stage=True),      # action + key text in y 30..262; dark stage below
    'fullframe': dict(zy1=420, stage=False),     # whole frame (key text kept above the bottom UI band)
}

# ---------------------------------------------------------------------------- the script
BEATS = [
    dict(id=1, line='We made a Doom mod called pee doom.'),
    dict(id=2, line='You play as me, samwise othermale. Or me, mario scaldi. Former CEOs of the two biggest AI companies on earth.'),
    dict(id=3, line='You reached A G I. Pee doom hit ninety-nine percent. Whoops.'),
    dict(id=4, line="Now there are only twenty humans left. And awkwardly, they're the exact people who warned you. "
                    "Eliezer Yudkowsky. Jeffrey Hinton. All of them. Mostly in writing."),
    dict(id=5, line="They're locked in four facilities. You have to break them out and lead them to safety, "
                    "while being hunted by the rogue superintelligence that you built."),
    dict(id=6, line='It sees you through every camera. It hears you from anywhere. It has lasers.'),
    dict(id=7, line="There's a robot that serves tea to nobody. Forever."),
    dict(id=8, line='And you... have a wrench.', pauses={2: 0.4}),
    dict(id=9, line="You almost ended humanity. Now you're its only hope."),
    dict(id=10, line='Play pee doom free, right now, at w w w dot man dot cool slash pee doom.', extra=0.5),
]

POSTER_ORDER = ['PDP05', 'PDP04', 'PDP03', 'PDP07', 'PDP16', 'PDP17', 'PDP09', 'PDP20']   # OpenAI / Anthropic alternating
PRISONERS = [('ELIEZER YUDKOWSKY', 'ELYUA1'), ('GEOFFREY HINTON', 'HINTA1'), ('STUART RUSSELL', 'STURA1'),
             ('HOLLY ELMORE', 'HOELA1'), ('LIRON SHAPIRA', 'LRSHA1'), ('ROB MILES', 'ROBMA1'),
             ('DAN HENDRYCKS', 'DANHA1'), ('NATE SOARES', 'NATSA1'), ('ROMAN YAMPOLSKIY', 'ROMYA1'),
             ('BETH BARNES', 'BETHA1')]


def words(line):
    return re.findall(r"[A-Za-z0-9'\-]+", line)


def est_duration(spec):
    n = len(words(spec['line']))
    return n / WPS + sum(spec.get('pauses', {}).values()) + BREATH + spec.get('extra', 0.0)


# ============================================================================ assets

def gfx_rgba(pal, im, offsets=(0, 0)):
    a = np.asarray(im.convert('RGBA'))
    mask = a[..., 3] >= 128
    idx = np.zeros(mask.shape, np.uint8)
    if mask.any():
        idx[mask] = pal.near(a[..., :3][mask])
    return ic.Gfx(idx, mask, *offsets)


def compose_logo(art):
    """The D1 p(DOOM) logo exactly as scripts/build-intro-cutscene.py title_logo() builds it,
    but returned as parts (p, '(', DOOM, ')') with their positions instead of written to disk."""
    fonts = Path('/System/Library/Fonts/Supplemental')
    doom = art.patch('M_DOOM')

    def glyph(ch, font, size):
        f = ImageFont.truetype(str(fonts / font), size)
        box = f.getbbox(ch)
        im = Image.new('1', (box[2] - box[0] + 8, box[3] - box[1] + 8), 0)
        d = ImageDraw.Draw(im)
        d.fontmode = '1'
        d.text((4 - box[0], 4 - box[1]), ch, font=f, fill=1)
        return im.crop(im.getbbox())

    def ink(g, color=(236, 228, 208)):
        im = Image.new('RGBA', (g.width + 2, g.height + 2))
        px, a = im.load(), g.load()
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
    parts.append(('p', p, x, 26)); x += p.width + 2
    parts.append(('(', lp, x, 4)); x += lp.width + 6
    parts.append(('DOOM', doom, x, 12)); x += doom.width + 5
    parts.append((')', rp, x, 4)); x += rp.width
    logo = Image.new('RGBA', (x + 4, 96))
    for _, im, px_, py in parts:
        logo.alpha_composite(im, (px_, py))
    bb = logo.getbbox()
    logo = logo.crop(bb)
    parts = [(n, im, px_ - bb[0], py - bb[1]) for n, im, px_, py in parts]
    return logo, parts


class PromoAssets(ic.Assets):
    """ic.Assets without the side effect: the logo is composed in memory, not re-saved."""

    def __init__(self):
        self.wad = ic.Wad()
        self.pal = self.wad.pal
        self.font = ic.Font(self.wad)
        pal, wad = self.pal, self.wad
        self.digits = {str(d): wad.patch('STTNUM%d' % d) for d in range(10)}
        self.digits['%'] = wad.patch('STTPRCNT')
        self.cam = {k: ic.load_png(pal, SPRITES / ('CPC%s0.png' % k)) for k in ('AA', 'AB')}
        self.hunt, self.visor = {}, {}
        for fr in 'ABCDEF':
            for ang in (1, 3, 7, 8):
                path = SPRITES / ('HUNT%s%d.png' % (fr, ang))
                if path.exists():
                    self.hunt[fr + str(ang)], self.visor[fr + str(ang)] = self.red_visor(ic.load_png(pal, path), path)
        self.people = []
        oa = ROOT / 'doom-web' / 'outside-assets'
        for v in range(5):
            for ang in (0, 1, 7):
                p = oa / ('person-%d-0-%d.png' % (v, ang))
                if p.exists():
                    self.people.append(ic.load_png(pal, p))
        self.wrench = ic.load_png(pal, ROOT / 'doom-web' / 'wrench.png', (0, 0))
        art = ic.load_doom_art()
        logo, parts = compose_logo(art)
        saved = LOCAL / 'intro' / 'title-logo.png'
        if saved.exists() and not np.array_equal(np.asarray(Image.open(saved).convert('RGBA')), np.asarray(logo)):
            print('  ! in-memory logo differs from intro/title-logo.png; using the saved file')
            logo = Image.open(saved).convert('RGBA')
        self.logo = gfx_rgba(pal, logo)
        self.logo_parts = {n: (gfx_rgba(pal, im), x, y) for n, im, x, y in parts}
        bar = LOCAL / 'ui' / 'stbar' / 'PDBAR.png'
        self.stbar = ic.load_png(pal, bar, (0, 0)) if bar.exists() else wad.patch('STBAR')
        self.music = ic.load_music(LOCAL / 'intake-music.ogg')
        self.snd = {}
        self.mdoom = wad.patch('M_DOOM')
        self.skull = [wad.patch('M_SKULL1'), wad.patch('M_SKULL2')]
        self.spr = {}

    def sprite(self, name):
        if name not in self.spr:
            self.spr[name] = ic.load_png(self.pal, SPRITES / (name + '.png'), (0, 0))
        return self.spr[name]


def trimmed(g):
    ys, xs = np.nonzero(g.mask)
    return g.crop(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


class Footage:
    """Engine fly-through frames, downsampled into the 270-wide Doom pixel grid and mapped to
    PLAYPAL through a 6-bit RGB lookup.  presenter: the landscape capture cropped to the action
    zone; fullframe: the vertical capture."""

    _lut = None

    def __init__(self, pal, shot, layout, zy1, gamma=1.12):
        if Footage._lut is None:
            Footage._lut = build_lut(pal)
        self.vertical = layout == 'fullframe'
        folder = RAW / (('e1m4' if shot in ('loop', 'cellroom', 'liron', 'turret', 'inferminator') else 'e1m7')
                        + ('-vertical' if self.vertical else '')) / shot
        self.files = sorted(folder.glob('*.png'))
        lead = 0
        while lead < 20 and lead + 1 < len(self.files) and np.asarray(Image.open(self.files[lead]).convert('L')).mean() < 2.0:
            lead += 1
        self.files = self.files[lead:]
        self.rate = 30 if self.vertical else 35
        self.zy1 = zy1
        self.lut_g = (255 * (np.arange(256) / 255.0) ** (1.0 / gamma) + 0.5).astype(np.uint8)
        self.cache = {}

    def seconds(self):
        return len(self.files) / self.rate

    def frame(self, t):
        i = int(clamp(int(t * self.rate), 0, len(self.files) - 1))
        if i not in self.cache:
            if len(self.cache) > 40:
                self.cache.clear()
            im = Image.open(self.files[i]).convert('RGB')
            if self.vertical:
                im = im.resize((W, H), Image.LANCZOS)
            else:                                      # crop the 16:10 capture to the action zone's aspect
                cw = int(round(im.height * W / self.zy1))
                x0 = (im.width - cw) // 2
                im = im.crop((x0, 0, x0 + cw, im.height)).resize((W, self.zy1), Image.LANCZOS)
            a = self.lut_g[np.asarray(im)]
            idx = Footage._lut[a[..., 0] >> 2, a[..., 1] >> 2, a[..., 2] >> 2]
            fb = np.zeros((H, W), np.uint8)
            fb[:idx.shape[0]] = idx
            self.cache[i] = fb
        return self.cache[i].copy()


def build_lut(pal):
    path = SCRATCH / 'playpal-lut6.npy'
    if path.exists():
        return np.load(path)
    g = (np.arange(64) * 4 + 2).astype(np.float32)
    rgb = np.stack(np.meshgrid(g, g, g, indexing='ij'), -1)
    lut = pal.near(rgb).astype(np.uint8)
    SCRATCH.mkdir(parents=True, exist_ok=True)
    np.save(path, lut)
    return lut


def zoom_view(fb, fx, fy, k, rows):
    """Integer punch-in on rows [0, rows) of fb: point (fx, fy) stays put."""
    src = fb[:rows]
    vw, vh = -(-W // k) + 1, -(-rows // k) + 1
    x0 = int(round(fx - fx / k))
    y0 = int(round(fy - fy / k))
    x0, y0 = int(clamp(x0, 0, W - vw + 1)), int(clamp(y0, 0, rows - vh + 1))
    crop = src[y0:y0 + vh, x0:x0 + vw]
    big = np.repeat(np.repeat(crop, k, 0), k, 1)[:rows, :W]
    out = fb.copy()
    out[:big.shape[0], :big.shape[1]] = big
    return out


# ============================================================================ kinetic text

class Slam:
    """A big kinetic text slam: punches in one size bigger and white-hot for two tics, shakes
    the action zone, then settles; optional full-width broadcast plate with red rules."""

    def __init__(self, text, t0, t1, scale, y, color='white', plate=True, punch=True, beat=None, hot=True,
                 digits=None, digits_obj=None, dscale=2, yscale=None):
        self.lines = text.split('\n')
        self.text = ' '.join(self.lines) if not digits else digits + ' ' + ' '.join(self.lines)
        self.digits, self.digits_obj, self.dscale = digits, digits_obj, dscale
        self.yscale = yscale
        self.t0, self.t1, self.scale, self.y = t0, t1, scale, y
        self.color, self.plate, self.punch, self.beat, self.hot = color, plate, punch, beat, hot

    def height(self, sc=None):
        sc = sc or self.scale
        if self.yscale:
            return 8 * self.yscale * len(self.lines) + 3 * self.yscale * (len(self.lines) - 1)
        h = 11 * sc * len(self.lines) - 3 * sc
        if self.digits:
            h = max(h, 16 * self.dscale)
        return h

    def draw(self, fb, t, font, pal, zy1):
        if not (self.t0 <= t < self.t1):
            return
        age = (t - self.t0) * TICS
        sc = self.scale
        wide = max(font.width(l, sc + 1) for l in self.lines)
        if self.punch and age < 2 and wide <= W - 4:
            sc = self.scale + 1
        lh = 11 * sc
        top = self.y - (self.height(sc) - self.height()) // 2
        fade = clamp((self.t1 - t) * TICS / 3.0, 0, 1)
        if self.plate:
            p0, p1 = top - 2 * sc - 1, top + self.height(sc) + 2 * sc + 1
            remap(fb, 0, p0, W, p1, pal.cmap[int(round(6 + 18 * fade))])
            rule = pal.cmap[int(round((1 - fade) * 24))][176]
            rect(fb, 0, p0 - 2, W, p0, rule)
            rect(fb, 0, p1, W, p1 + 2, rule)
        table = font.trans[self.color]
        if self.hot and age < 2:
            table = pal.white(8)[table]
        if fade < 1:
            table = pal.cmap[int(round((1 - fade) * 24))][table]
        if self.yscale:                               # tall display letters: x scale sc, y scale yscale
            for i, line in enumerate(self.lines):
                tmp = np.full((10, font.width(line) + 2), 250, np.uint8)
                font.draw(tmp, line, 0, 1, table=table, shadow=False)
                big = np.repeat(np.repeat(tmp, self.yscale, 0), sc, 1)
                m = big != 250
                x = CX - (font.width(line) * sc) // 2
                y = top + i * 11 * self.yscale - self.yscale
                for (ox, oy, sh) in ((sc + 1, self.yscale + 1, True), (0, 0, False)):
                    y0, x0 = y + oy, x + ox
                    hh, ww = big.shape
                    a0, b0 = max(x0, 0), max(y0, 0)
                    a1, b1 = min(x0 + ww, W), min(y0 + hh, H)
                    if a1 <= a0 or b1 <= b0:
                        continue
                    sub = m[b0 - y0:b1 - y0, a0 - x0:a1 - x0]
                    dst = fb[b0:b1, a0:a1]
                    dst[sub] = 0 if sh else big[b0 - y0:b1 - y0, a0 - x0:a1 - x0][sub]
            return
        if self.digits:                               # big status-bar digits + a one-line label
            ds = self.dscale + (1 if sc > self.scale else 0)
            dw = sum(self.digits_obj[ch].w for ch in self.digits) * ds
            tw = font.width(self.lines[0], sc)
            x = CX - (dw + 6 + tw) // 2
            dy = top + (self.height(sc) - 16 * ds) // 2
            dt = self.digits_obj
            gx = x
            for ch in self.digits:
                g = dt[ch].scaled(ds)
                blit(fb, g.solid(0), gx + ds, dy + ds, offsets=False)
                blit(fb, g if not (self.hot and age < 2) else g.mapped(pal.white(8)), gx, dy, offsets=False)
                gx += g.w
            ty = top + (self.height(sc) - (11 * sc - 3 * sc)) // 2
            font.draw(fb, self.lines[0], x + dw + 6 + sc + 1, ty + sc + 1, table=np.zeros(256, np.uint8), shadow=False, scale=sc)
            font.draw(fb, self.lines[0], x + dw + 6, ty, table=table, scale=sc)
            return
        for i, line in enumerate(self.lines):
            w = font.width(line, sc)
            x = CX - w // 2
            y = top + i * lh
            # heavy drop shadow first, then the glyphs (font.draw adds its own 1-px shadow)
            font.draw(fb, line, x + sc + 1, y + sc + 1, table=np.zeros(256, np.uint8), shadow=False, scale=sc)
            font.draw(fb, line, x, y, table=table, scale=sc)


def fit_scale(font, text, max_scale=4, width=TEXT_W):
    for sc in range(max_scale, 0, -1):
        if all(font.width(l, sc) <= width for l in text.split('\n')):
            return sc
    return 1


# ============================================================================ the promo

class Beat:
    def __init__(self, spec, start, dur):
        self.id, self.line = spec['id'], spec['line']
        self.words = words(spec['line'])
        self.pauses = spec.get('pauses', {})
        self.extra = spec.get('extra', 0.0)
        self.start, self.dur, self.end = start, dur, start + dur
        est = len(self.words) / WPS + sum(self.pauses.values())
        self.k = max(0.5, (dur - BREATH - self.extra) / est)
        self.trans = 'cut'
        self.texts = []

    def at(self, i):
        """Estimated local time of the i-th spoken word (scaled when the beat is retimed)."""
        return (i / WPS + sum(p for j, p in self.pauses.items() if j <= i)) * self.k


class Promo:
    def __init__(self, A, layout, durations=None):
        self.A, self.layout = A, layout
        self.pal, self.font = A.pal, A.font
        L = LAYOUTS[layout]
        self.zy1, self.has_stage = L['zy1'], L['stage']
        self.zh = self.zy1 - TOP_CLEAR
        self.full = not self.has_stage
        self.rng = np.random.default_rng(2026)
        self.sfx, self.shakes, self.flashes, self.tints = [], [], [], []
        self.slams = []
        self._cache = {}
        self.k_white = self.pal.idx(255, 255, 255)
        # the opening film supplies the monitor wall, silhouettes, face wells, fire and wrench art
        sd, sl = ic.resolve_face_dir('samwise', None)
        md, ml = ic.resolve_face_dir('mario', None)
        self.vf = ic.VerticalFilm(A, 'samwise', sd, sl)
        self.faces = {'samwise': self.vf.faces, 'mario': ic.load_faces(A, md)}
        self.posters = {p: ic.load_png(self.pal, POSTERS / (p + '.png'), (0, 0)) for p in POSTER_ORDER}
        meta = json.loads((POSTERS / 'posters.json').read_text())
        self.poster_co = {p['id']: p['company'] for p in meta['posters']}
        self.clips = {s: Footage(self.pal, s, layout, self.zy1) for s in ('cellroom', 'liron', 'loop', 'inferminator', 'teabot', 'hal', 'turret', 'core')}
        self.prepare_stage()
        durations = durations or [est_duration(s) for s in BEATS]
        self.beats, t = [], 0.0
        for spec, d in zip(BEATS, durations):
            self.beats.append(Beat(spec, t, d))
            t += d
        self.duration = t
        self.build()

    # ------------------------------------------------------------ helpers
    def c(self, r, g, b):
        return self.pal.idx(r, g, b)

    def sound(self, t, name_or_x, gain=1.0, pan=0.0, pitch=1.0):
        x = self.A.sound(name_or_x, pitch) if isinstance(name_or_x, str) else name_or_x
        self.sfx.append((t, x, gain, pan))

    def slam(self, b, text, at, until=None, scale=None, y=None, color='white', plate=True, thud=0.45, shake=2, **kw):
        """Kinetic text in beat b at local time `at`; y is relative to the action zone top."""
        sc = scale or fit_scale(self.font, text)
        t0 = b.start + at
        t1 = b.start + (until if until is not None else b.dur) - 0.02
        s = Slam(text, t0, t1, sc, TOP_CLEAR + (y if y is not None else 8), color, plate, beat=b.id, **kw)
        self.slams.append(s)
        b.texts.append(dict(text=s.text, t_ms=int(round(t0 * 1000)), end_ms=int(round(t1 * 1000))))
        if thud:
            self.sound(t0, slam_thud(self.rng), thud)
        if shake:
            self.shakes.append((t0, 0.14, shake))
        return s

    def zone_mid(self, h):
        """y (relative to zone top) that centres something h tall in the action zone."""
        return (self.zh - h) // 2

    # ------------------------------------------------------------ stage (presenter layout)
    def prepare_stage(self):
        if not self.has_stage:
            return
        pal = self.pal
        y0 = self.zy1
        rows = H - y0
        flat = self.A.wad.flat('FLOOR4_8')
        st = np.zeros((rows, W), np.uint8)
        xs = np.arange(W) - W / 2
        for k in range(rows):
            z = 2600.0 / (k + 6)                      # receding floor from the zone's lower edge
            u = (xs * z / 140).astype(int) & 63
            v = int(z) & 63
            lvl = int(clamp(31 - k * 0.11 - 0 * z, 17, 31))
            st[k] = pal.cmap[lvl][flat[v, u]]
        yy, xx = np.mgrid[0:rows, 0:W]
        vig = np.clip(((np.abs(xx - W / 2) / (W / 2)) ** 2.2) * 9 + (1 - yy / rows) * 3, 0, 14).astype(int)
        for lvl in range(1, 15):
            sel = vig == lvl
            st[sel] = pal.cmap[lvl][st[sel]]
        self.stage_base = st

    def stage(self, tic):
        st = self.stage_base.copy()
        fire = self.vf.fire_state(tic // 3 + 100, rows=70, width=W, key='stagefire', tall=False)   # a slow smoulder
        cols = self.vf.fire_pal[fire]
        lv = np.clip(14 + (np.arange(70)[::-1, None] // 6), 0, 31)       # dim: a glow, not a blaze
        dim = self.pal.cmap[lv, cols]
        sel = fire > 4
        reg = st[-70:]
        reg[sel] = dim[sel]
        return st

    # ------------------------------------------------------------ build
    def build(self):
        B = self.beats
        self.b1(B[0]); self.b2(B[1]); self.b3(B[2]); self.b4(B[3]); self.b5(B[4])
        self.b6(B[5]); self.b7(B[6]); self.b8(B[7]); self.b9(B[8]); self.b10(B[9])
        for i, b in enumerate(B):
            b.render = getattr(self, 'r%d' % b.id)

    # 1 ---------------------------------------------------------------------------------------
    def b1(self, b):
        rng = self.rng
        self.sound(b.start, ic.boom(rng, 1.4), 0.75)
        self.sound(b.start, 'DSBAREXP', 0.5, 0.0, 0.9)
        self.shakes.append((b.start + 0.1, 0.25, 3))
        self.flashes.append((b.start + 0.1, 'white'))
        self.b1_snap = b.at(6) - 0.1                   # "pee doom": the p( ) slam in
        self.sound(b.start + self.b1_snap, whoosh_in(rng), 0.35)
        self.sound(b.start + self.b1_snap + 0.13, 'pdchrg.lmp', 0.6)
        self.sound(b.start + self.b1_snap + 0.13, 'DSPLASMA', 0.55)
        self.sound(b.start + self.b1_snap + 0.13, ic.boom(rng, 1.2), 0.5)
        self.shakes.append((b.start + self.b1_snap + 0.13, 0.22, 3))
        self.tints.append((b.start + self.b1_snap + 0.13, 0.35, (255, 30, 30), 9))
        lh = 120 if self.full else 120
        self.b1_logo_y = TOP_CLEAR + (24 if not self.full else 96)
        self.slam(b, 'A DOOM MOD', b.at(1), scale=3, y=(self.b1_logo_y - TOP_CLEAR) + (130 if self.full else 132) - (0 if self.full else 0),
                  color='gold', plate=True)

    def r1(self, b, t, tic):
        fb = np.zeros((H, W), np.uint8)
        fr = self.vf.fire_state(tic + 400, rows=110, width=W, key='b1fire', tall=True)
        fy = self.zy1 - fr.shape[0]
        fb[fy:self.zy1] = self.vf.fire_pal[fr]
        y = self.b1_logo_y
        if t < self.b1_snap + 0.13:
            g = self.A.mdoom.scaled(2)
            blit(fb, g, W // 2 - g.w // 2, y, offsets=False)
        else:
            lg = self.A.logo
            x0 = CX - lg.w // 2
            yl = y + 22
            u = clamp((t - self.b1_snap - 0.13) / 0.12, 0, 1)
            for name, (g, px, py) in self.A.logo_parts.items():
                dx = 0
                if name in ('p', '('):
                    dx = int(-200 * (1 - u))
                elif name == ')':
                    dx = int(200 * (1 - u))
                blit(fb, g, x0 + px + dx, yl + py, offsets=False)
            if t - self.b1_snap - 0.13 < 0.3:            # the laser that welds it together
                k = (t - self.b1_snap - 0.13) / 0.3
                by = yl + 66
                self.laser(fb, 0, by, W, by, 1 - k)
        return fb

    def laser(self, fb, x0, y0, x1, y1, strength):
        """A horizontal red beam with a hot white core and glow."""
        if strength <= 0:
            return
        y = int(y0)
        for dy, col in ((-3, 186), (-2, 180), (-1, 176), (0, 168), (1, 176), (2, 180), (3, 186)):
            if abs(dy) <= 1 + 2 * strength:
                rect(fb, x0, y + dy, x1, y + dy + 1, col)
        remap(fb, x0, y - 10, x1, y - 3, self.pal.toward((255, 0, 0), int(6 * strength)))
        remap(fb, x0, y + 4, x1, y + 11, self.pal.toward((255, 0, 0), int(6 * strength)))

    # 2 ---------------------------------------------------------------------------------------
    def b2(self, b):
        self.b2_sel = [(b.at(4) - 0.15, 'samwise'), (b.at(8) - 0.15, 'mario')]
        for t, _ in self.b2_sel:
            self.sound(b.start + t, 'DSPSTOP', 0.5)
            self.sound(b.start + t + 0.05, 'DSPISTOL', 0.25)
        self.b2_post = b.at(10) - 0.05                  # "Former CEOs": posters
        n = len(POSTER_ORDER)
        span = b.dur - 0.25 - self.b2_post - 0.2
        self.b2_pt = [self.b2_post + 0.2 + span * i / n for i in range(n)]
        rng = np.random.default_rng(11)
        if self.full:
            self.b2_pos = [(int(rng.integers(-4, 18)), int(rng.integers(0, 16))) for _ in range(n)]
        else:
            self.b2_pos = [(int(rng.integers(8, 132)), int(rng.integers(0, 34))) for _ in range(n)]
        for t in self.b2_pt:
            self.sound(b.start + t, shutter(self.rng), 0.5)
            self.sound(b.start + t, slam_thud(self.rng), 0.2)
        self.slam(b, 'CHOOSE YOUR CEO', 0.05, until=self.b2_post, scale=2, y=4, color='red', plate=False, thud=0.25, shake=0)
        self.slam(b, 'FORMER CEOS', self.b2_post, until=b.at(14) - 0.05, scale=3,
                  y=(self.zh - 40) if not self.full else 300, color='white')
        self.slam(b, 'THE TWO BIGGEST\nAI COMPANIES', b.at(14), scale=2,
                  y=(self.zh - 46) if not self.full else 300, color='gold', thud=0.3)

    def well(self, ceo, key):
        """The status bar's bevelled face well (43x32) with a CEO's HUD face."""
        x0, x1 = ic.VerticalFilm.WELL
        bar = self.A.stbar
        img = bar.idx[:, x0:x1].copy()
        g = self.faces[ceo][key]
        blit(img, g, 143 - x0, 0)
        return ic.Gfx(img)

    def r2(self, b, t, tic):
        fb = np.zeros((H, W), np.uint8)
        tex = self.A.wad.texture('STARTAN3').idx
        ys, xs = np.mgrid[0:H, 0:W]
        fb[:] = self.pal.cmap[24][tex[ys % tex.shape[0], xs % tex.shape[1]]]
        if t < self.b2_post:
            sel = 'samwise'
            ts = 0.0
            for t_, c in self.b2_sel:
                if t >= t_:
                    sel, ts = c, t_
            if t < self.b2_sel[0][0]:
                sel = 'samwise' if int(t * 3) % 2 == 0 else 'mario'
            age = t - ts
            looks = ['STFST01', 'STFTL00', 'STFST01', 'STFTR00']
            key = 'STFEVL0' if 0 <= age < 0.45 and t >= self.b2_sel[0][0] else looks[int(t * 3.4) % 4]
            big = 3 if not self.full else 4
            g = self.well(sel, key).scaled(big)
            gy = TOP_CLEAR + 26 if not self.full else TOP_CLEAR + 70
            blit(fb, g, CX - g.w // 2, gy, offsets=False)
            rect(fb, CX - g.w // 2 - 2, gy - 2, CX + g.w // 2 + 2, gy, 161)
            rect(fb, CX - g.w // 2 - 2, gy + g.h, CX + g.w // 2 + 2, gy + g.h + 2, 161)
            rect(fb, CX - g.w // 2 - 2, gy, CX - g.w // 2, gy + g.h, 161)
            rect(fb, CX + g.w // 2, gy, CX + g.w // 2 + 2, gy + g.h, 161)
            name = {'samwise': 'SAM\nALTMAN', 'mario': 'DARIO\nAMODEI'}[sel]
            ny = gy + g.h + 6
            for i, ln in enumerate(name.split('\n')):
                w = self.font.width(ln, 2)
                self.font.draw(fb, ln, CX - w // 2, ny + 22 * i, color='gold', scale=2)
            # thumbnails + Doom's skull cursor
            ts_ = 1 if not self.full else 2
            ty = ny + 46
            for i, ceo in enumerate(('samwise', 'mario')):
                th = self.well(ceo, 'STFST01').scaled(ts_)
                tx = CX - 6 - th.w if i == 0 else CX + 6
                blit(fb, th, tx, ty, offsets=False)
                if ceo == sel:
                    sk = self.A.skull[(tic // 8) % 2]
                    blit(fb, sk, (tx - 22) if i == 0 else (tx + th.w + 2), ty + th.h // 2 - 10, offsets=False)
        else:
            for i, pid in enumerate(POSTER_ORDER):
                tp = self.b2_pt[i]
                if t < tp:
                    break
                g = self.posters[pid]
                if self.full:
                    g = g.scaled(2)
                    px, py = 3 + self.b2_pos[i][0] - 10, TOP_CLEAR + 4 + self.b2_pos[i][1]
                else:
                    px, py = self.b2_pos[i][0], TOP_CLEAR + 2 + self.b2_pos[i][1]
                age = (t - tp) * TICS
                if age < 2:                                    # lands one size bigger and white-hot
                    gg = g.scaled(2) if not self.full else g
                    gg = gg.mapped(self.pal.white(7))
                    blit(fb, gg, px - (gg.w - g.w) // 2, py - (gg.h - g.h) // 3, offsets=False)
                else:
                    sh = ic.Gfx(np.zeros_like(g.idx), g.mask)
                    blit(fb, sh, px + 4, py + 4, offsets=False)
                    blit(fb, g, px, py, offsets=False)
        return fb

    # 3 ---------------------------------------------------------------------------------------
    def b3(self, b):
        self.b3_c0, self.b3_c1 = b.at(2), b.at(8) + 0.25
        self.b3_zoom = (self.b3_c0 + self.b3_c1) / 2
        for f in range(int(self.b3_c0 * TICS), int(self.b3_c1 * TICS) + 1):
            if f % 4 == 0:
                self.sound(b.start + f / TICS, 'DSPISTOL', 0.32)
        self.sound(b.start + self.b3_c1, 'DSBAREXP', 0.8)
        self.shakes.append((b.start + self.b3_c1, 0.3, 3))
        self.tints.append((b.start + self.b3_c1, 0.5, (255, 0, 0), 7))
        self.slam(b, 'WHOOPS.', b.at(10), scale=4, y=self.zh - 48 if not self.full else 300, color='red', thud=0.6, shake=4)
        self.sound(b.start + b.at(10), 'DSOOF', 0.6)

    def r3(self, b, t, tic):
        vf = self.vf
        world = vf.vmon.copy()
        mx0, my0, mx1, my1 = vf.vmain
        rect(world, mx0 - 3, my0 - 3, mx1 + 3, my1 + 3, 100)
        rect(world, mx0 - 2, my0 - 2, mx1 + 2, my1 + 2, 106)
        rect(world, mx0, my0, mx1, my1, 0)
        u = clamp((t - self.b3_c0) / (self.b3_c1 - self.b3_c0), 0, 1)
        val = int(12 + 87 * (u ** 1.35))
        done = t >= self.b3_c1
        lab = 'p(DOOM)'
        self.font.draw(world, lab, (mx0 + mx1) // 2 - self.font.width(lab) // 2, my0 + 6, color='gold')
        if not (done and int((t - self.b3_c1) * TICS) % 16 >= 12):
            ic.draw_num(world, self.A.digits, '%d%%' % val, (mx0 + mx1) // 2, my0 + 18, 3)
        n = len(vf.veyes)
        for i, (x0, y0, x1, y1, rad) in enumerate(vf.veyes):
            te = self.b3_zoom + (self.b3_c1 - self.b3_zoom) * (i / max(1, n - 1)) ** 0.85
            if t < te:
                continue
            rect(world, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0)
            pulse = max(0.0, 1 - (t - self.b3_c1) / 0.6) if done else 0.0
            ic.draw_eye(world, (x0 + x1) / 2, (y0 + y1) / 2, rad * clamp((t - te) * TICS / 4, 0.15, 1), pulse)
        sy = TOP_CLEAR + (self.zh // 2 if not self.full else 120)
        if t < self.b3_zoom:
            return ic.place_view(world, 192, 192, CX + 6, sy - 10, 2)
        return ic.place_view(world, 192, 192, CX + 6, sy - 40, 1)

    # 4 ---------------------------------------------------------------------------------------
    def b4(self, b):
        full = self.full
        self.b4g = dict(top=TOP_CLEAR + (4 if not full else 24), grid_h=152 if not full else 250,
                        text=166 if not full else 300, big=3 if not full else 4, line=1 if not full else 2)
        G = self.b4g
        self.b4_pop = [0.1 + 0.07 * i for i in range(20)]
        for i, tp in enumerate(self.b4_pop):
            self.sound(b.start + tp, 'DSTINK', 0.7, ((i % 5) - 2) / 3, 0.9 + 0.02 * (i % 6))
        self.b4_reveal = b.at(7)
        self.b4_eli, self.b4_hin, self.b4_all, self.b4_wri = b.at(16) - 0.1, b.at(18) - 0.1, b.at(20) - 0.1, b.at(23) - 0.1
        for i in range(10):
            self.sound(b.start + self.b4_reveal + 0.08 * i, 'DSPSTOP', 0.2, (i % 5 - 2) / 3, 1.4)
        ty = G['text']
        self.slam(b, 'HUMANS LEFT', b.at(4) - 0.1, until=self.b4_reveal, scale=2, y=ty, digits='20', digits_obj=self.A.digits, dscale=2)
        self.slam(b, 'THE PEOPLE WHO\nWARNED YOU.', b.at(11), until=self.b4_eli, scale=2, y=ty, color='gold')
        self.slam(b, 'ELIEZER\nYUDKOWSKY', self.b4_eli, until=self.b4_hin, scale=2, y=ty)
        self.slam(b, 'GEOFFREY\nHINTON', self.b4_hin, until=self.b4_all, scale=2, y=ty)
        self.slam(b, 'ALL OF THEM.', self.b4_all, until=self.b4_wri, scale=3, y=ty)
        self.slam(b, 'MOSTLY\nIN WRITING.', self.b4_wri, scale=3, y=ty - (16 if not full else 0), color='red', shake=3)
        self.sound(b.start + self.b4_eli, ic.boom(self.rng, 1.0), 0.3)
        self.sound(b.start + self.b4_hin, ic.boom(self.rng, 1.0), 0.3)

    def lineup(self, fb, G, t):
        """The ten real prisoners (in-game sprites) in two rows of five, lit as they are revealed."""
        top, gh, sc = G['top'], G['grid_h'], G['line']
        rh = gh // 2
        for i in range(10):
            r, c = divmod(i, 5)
            x = CX + (c - 2) * 47 * sc // (1 if sc == 1 else 1) if sc == 1 else 135 + (c - 2) * 52
            y = top + r * rh
            k = t - (self.b4_reveal + 0.08 * i)
            g = trimmed(self.A.sprite(PRISONERS[i][1])).scaled(sc)
            pool = 92 if k >= 0 else 106
            remap(fb, x - 22 * sc, y + 2, x + 22 * sc, y + rh - 2, self.pal.cmap[10 if k >= 0 else 22])
            rect(fb, x - 22 * sc, y + rh - 4, x + 22 * sc, y + rh - 2, self.pal.cmap[6][pool])
            if k >= 0:
                blit(fb, g if k * TICS >= 2 else g.mapped(self.pal.white(9)), x - g.w // 2, y + rh - 3 - g.h, offsets=False)
            else:
                s_ = self.vf.vsil[i]
                blit(fb, s_, x - s_.w // 2, y + rh - 3 - s_.h, offsets=False)

    def r4(self, b, t, tic):
        G = self.b4g
        fb = np.zeros((H, W), np.uint8)
        tex = self.A.wad.texture('GRAY1').idx
        ys, xs = np.mgrid[0:H, 0:W]
        fb[:] = self.pal.cmap[25][tex[ys % tex.shape[0], xs % tex.shape[1]]]
        top, gh = G['top'], G['grid_h']
        if t < self.b4_reveal:                       # twenty silhouettes pop into twenty cells
            cw, chh = 46, gh // 4
            for i in range(20):
                r, c = divmod(i, 5)
                x, y = CX - 115 + c * cw, top + r * chh
                lit = t >= self.b4_pop[i]
                rect(fb, x + 1, y + 1, x + cw - 1, y + chh - 1, 96 if lit else 108)
                if lit:
                    s_ = self.vf.vsil[i]
                    if self.full:
                        s_ = s_.scaled(1)
                    age = (t - self.b4_pop[i]) * TICS
                    blit(fb, s_.solid(4) if age < 2 else s_, x + cw // 2 - s_.w // 2, y + chh - 2 - s_.h, offsets=False)
                for bx in range(x + 5, x + cw, 9):
                    rect(fb, bx, y + 1, bx + 1, y + chh - 1, 88 if lit else 100)
                    rect(fb, bx + 1, y + 1, bx + 2, y + chh - 1, 106)
        elif t < self.b4_eli or t >= self.b4_all:
            self.lineup(fb, G, t)
        else:                                        # the two names he says: big
            pid = 0 if t < self.b4_hin else 1
            g = trimmed(self.A.sprite(PRISONERS[pid][1])).scaled(G['big'])
            y1 = top + gh + 4
            remap(fb, 135 - 80, top, 135 + 80, y1, self.pal.cmap[12])
            yy, xx = np.mgrid[top:y1, 55:215]
            d = np.hypot((xx - 135) / 70.0, (yy - top - 20) / 120.0)
            pool = np.clip(14 - (d * 10), 0, 12).astype(int)
            reg = fb[top:y1, 55:215]
            for lv in range(1, 13):
                sel = pool == lv
                reg[sel] = self.pal.white(lv // 3)[reg[sel]]
            age = (t - (self.b4_eli if pid == 0 else self.b4_hin)) * TICS
            blit(fb, g if age >= 2 else g.mapped(self.pal.white(9)), 135 - g.w // 2, y1 - g.h, offsets=False)
        return fb

    # 5 ---------------------------------------------------------------------------------------
    def b5(self, b):
        cuts = [0.0, b.at(8) - 0.15, b.at(12) - 0.15, b.at(18) - 0.25, b.at(24) - 0.3]
        self.b5_cuts = cuts
        self.b5_shots = [('loop', 0.2, None), ('cellroom', 0.0, None), ('liron', 0.0, None),
                         ('inferminator', 3.4, None), ('inferminator', 7.6, 'close')]
        for c_ in cuts[1:]:
            self.sound(b.start + c_, whoosh_in(self.rng, 0.18), 0.25)
        yb = self.zh - 40 if not self.full else 300
        self.slam(b, '4 FACILITIES', b.at(3) - 0.1, until=cuts[1], scale=3, y=yb)
        self.slam(b, 'BREAK THEM OUT', b.at(8), until=cuts[2], scale=2, y=8 if not self.full else 40)
        self.slam(b, 'LEAD THEM\nTO SAFETY', b.at(12), until=cuts[3], scale=2, y=yb - 4)
        self.slam(b, 'HUNTED.', b.at(18), until=cuts[4], scale=4, y=yb - 8, color='red')
        self.slam(b, 'YOU BUILT THIS.', b.at(24), scale=2, y=yb + 8, color='white', shake=4)
        for k in range(14):
            tt = cuts[3] + k * 0.42
            if tt < b.dur:
                self.sound(b.start + tt, 'DSHOOF', 0.25)
        self.sound(b.start + b.at(24), 'DSCYBSIT', 0.35, 0.0, 0.85)
        self.sound(b.start + b.at(24), ic.boom(self.rng, 1.2), 0.4)

    def r5(self, b, t, tic):
        i = max(k for k, c_ in enumerate(self.b5_cuts) if t >= c_)
        shot, off, mode = self.b5_shots[i]
        clip = self.clips[shot]
        lt = t - self.b5_cuts[i]
        fb = clip.frame(off + lt)
        rows = self.zy1 if not self.full else H
        if mode == 'close':                         # punch in on the Inferminator's red visor
            fx, fy = (W // 2, int(rows * (0.40 if self.full else 0.44)))
            k = 2 if lt < 0.12 else 3
            fb = zoom_view(fb, fx, fy, k, rows)
            if lt < 0.08:
                fb[:rows] = self.pal.white(10)[fb[:rows]]
        return fb

    # 6 ---------------------------------------------------------------------------------------
    def b6(self, b):
        self.b6_cuts = [0.0, b.at(6) - 0.1, b.at(11) - 0.1]
        self.b6_beam = b.at(13) + 0.05
        y = self.zh - 40 if not self.full else 300
        self.slam(b, 'IT SEES YOU', 0.1, until=self.b6_cuts[1], scale=2, y=y)
        self.slam(b, 'IT HEARS YOU', self.b6_cuts[1] + 0.05, until=self.b6_cuts[2], scale=2, y=y)
        self.slam(b, 'IT HAS LASERS', self.b6_cuts[2] + 0.05, scale=2, y=y, color='red')
        for k in range(4):
            self.sound(b.start + 0.3 + k * 0.4, ic.blip(1760, 0.07), 0.15)
        self.sound(b.start + 0.15, ic.servo(self.rng), 0.3)
        self.sound(b.start + self.b6_cuts[1] + 0.1, ic.polite_chime(), 0.25)
        self.sound(b.start + self.b6_cuts[1] + 0.6, 'DSBDCLS', 0.3)
        self.sound(b.start + self.b6_cuts[2] + 0.1, 'pdchrg.lmp', 0.6)
        self.sound(b.start + self.b6_cuts[2] + 0.3, whine(0.6), 0.25)
        self.sound(b.start + self.b6_beam, 'DSPLASMA', 0.7)
        self.sound(b.start + self.b6_beam, 'DSRXPLOD', 0.45)
        self.shakes.append((b.start + self.b6_beam, 0.3, 4))
        self.flashes.append((b.start + self.b6_beam, 'white'))
        self.tints.append((b.start + self.b6_beam + 0.06, 0.5, (255, 0, 0), 8))

    def r6(self, b, t, tic):
        i = max(k for k, c_ in enumerate(self.b6_cuts) if t >= c_)
        lt = t - self.b6_cuts[i]
        rows = self.zy1 if not self.full else H
        cy = TOP_CLEAR + (self.zh - 60) // 2 + 4 if not self.full else 190
        if i == 0:                                   # the camera: REC, targeting box closing in
            fb = self.clips['turret'].frame(1.0 + lt)
            fb[:rows] = self.pal.cmap[16][fb[:rows]]
            g = self.A.cam['AB' if (tic // 9) % 2 == 0 else 'AA'].scaled(3 if not self.full else 4)
            blit(fb, g, CX - g.w // 2, cy - g.h // 2, offsets=False)
            k = clamp(1 - lt / 0.5, 0, 1)
            bw, bh = int(g.w * 0.62 + 80 * k), int(g.h * 0.62 + 80 * k)
            col = 176
            x0, y0, x1, y1 = CX - bw // 2 - 8, cy - bh // 2 + 6, CX + bw // 2 - 8, cy + bh // 2 + 6
            for (ax, ay, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
                rect(fb, min(ax, ax + dx * 14), ay - (1 if dy < 0 else 0), max(ax, ax + dx * 14), ay + 2 - (1 if dy < 0 else 0), col)
                rect(fb, ax - (1 if dx < 0 else 0), min(ay, ay + dy * 14), ax + 2 - (1 if dx < 0 else 0), max(ay, ay + dy * 14), col)
            if (tic // 12) % 2 == 0:
                rect(fb, 10, TOP_CLEAR + 6, 18, TOP_CLEAR + 14, 176)
                self.font.draw(fb, 'REC', 22, TOP_CLEAR + 6, color='white', scale=1)
        elif i == 1:                                 # HAL3000: the eye goes from cyan to amber to red
            fb = self.clips['hal'].frame(5.5 + lt * 0.6)
            fb[:rows] = self.pal.cmap[18][fb[:rows]]
            fr = 'A' if lt < 0.35 else 'B' if lt < 0.6 else 'C'
            g = self.A.sprite('H300%s1' % fr).scaled(3 if not self.full else 4)
            blit(fb, g, CX - g.w // 2, cy - g.h // 2, offsets=False)
            if fr == 'C':
                ey = cy - g.h // 2 + (31 * g.h) // 64
                remap(fb, CX - 40, ey - 30, CX + 40, ey + 30, self.pal.toward((255, 0, 0), 3))
        else:                                        # the Inferminator winds up a laser at you
            fb = self.clips['inferminator'].frame(6.0)
            fb[:rows] = self.pal.cmap[20][fb[:rows]]
            key = 'E1' if t < self.b6_beam else 'F1'
            g = self.A.hunt[key].scaled(3 if not self.full else 4)
            gy = cy - g.h // 2 + 10
            self.vf.visor_glow(fb, key, CX - g.w // 2, gy, 3 if not self.full else 4, 7)
            blit(fb, g, CX - g.w // 2, gy, offsets=False)
            k = clamp((t - self.b6_cuts[2]) / max(0.2, self.b6_beam - self.b6_cuts[2]), 0, 1)
            if t < self.b6_beam:                     # LOCKED chevrons close in
                gap = int(110 * (1 - k)) + 26
                for side in (-1, 1):
                    for j in range(3):
                        x = CX + side * (gap + j * 9)
                        for d in range(7):
                            rect(fb, x - side * d, cy - 7 + d, x - side * d + 2, cy - 6 + d, 176)
                            rect(fb, x - side * d, cy + 7 - d, x - side * d + 2, cy + 8 - d, 176)
                if k > 0.55:
                    w = self.font.width('LOCKED', 2)
                    remap(fb, CX - w // 2 - 4, cy + 18, CX + w // 2 + 4, cy + 38, self.pal.cmap[24])
                    self.font.draw(fb, 'LOCKED', CX - w // 2, cy + 21, scale=2, color='red' if (tic // 4) % 2 else 'white')
            else:
                a = clamp(1 - (t - self.b6_beam) / 0.35, 0, 1)
                self.laser(fb, 0, cy, W, cy, a)
        return fb

    # 7 ---------------------------------------------------------------------------------------
    def b7(self, b):
        y = self.zh - 52 if not self.full else 290
        self.slam(b, 'A ROBOT SERVES\nTEA TO NOBODY.', b.at(1), until=b.at(8) - 0.05, scale=2, y=y)
        self.slam(b, 'FOREVER.', b.at(8) - 0.05, scale=3, y=y + 10, color='gold', thud=0.5)
        self.b7_forever = b.at(8) - 0.05
        for k, tt in enumerate((0.5, 1.6, 2.7)):
            if tt < b.dur:
                self.sound(b.start + tt, 'pdteac.lmp', 0.6, 0.2, 1.0 + 0.05 * k)

    def r7(self, b, t, tic):
        rows = self.zy1 if not self.full else H
        fb = self.clips['teabot'].frame(0.4 + t * 0.5)
        if t < self.b7_forever:                    # wide: the cup pile, TEABOT and the dispenser
            return fb
        u = clamp(t / max(1.0, b.dur), 0, 1)        # "FOREVER.": punch in on TEABOT
        if not self.full:
            fx, fy = 92 + 28 * u, 160
        else:
            fx, fy = 118 + 34 * u, 250
        return zoom_view(fb, int(fx), int(fy), 2, rows)

    # 8 ---------------------------------------------------------------------------------------
    def b8(self, b):
        self.b8_land = b.at(4) + 0.05
        self.b8_drop = self.b8_land - 0.35
        self.sound(b.start + self.b8_drop, ic.whoosh(self.rng, 0.35), 0.3)
        self.sound(b.start + self.b8_land, 'pdpickup.lmp', 0.8)
        self.sound(b.start + self.b8_land, 'DSMETAL', 0.55, 0.0, 1.25)
        self.sound(b.start + self.b8_land + 0.3, 'DSWPNUP', 0.8)
        self.shakes.append((b.start + self.b8_land, 0.25, 3))
        self.slam(b, 'AND YOU...', 0.05, until=self.b8_land, scale=3, y=self.zh - 36 if not self.full else 300, color='white', thud=0.3, shake=0)
        self.slam(b, '...A WRENCH.', self.b8_land, scale=3, y=self.zh - 36 if not self.full else 300, color='gold', thud=0.0, shake=0)

    def r8(self, b, t, tic):
        fb = np.zeros((H, W), np.uint8)
        sc = 3
        grin = t >= self.b8_land + 0.3
        looks = ['STFST01', 'STFTL00', 'STFST01', 'STFTR00']
        key = 'STFEVL0' if grin else looks[int(t * 3) % 4]
        wy = TOP_CLEAR + 6 if not self.full else TOP_CLEAR + 70
        for i, ceo in enumerate(('samwise', 'mario')):
            g = self.well(ceo, key).scaled(sc)
            blit(fb, g, (135 - g.w - 3) if i == 0 else (135 + 3), wy, offsets=False)
        wr = self.vf.vwrench                         # on its side, 4x, outlined
        wr = ic.Gfx(wr.idx[::4, ::4], wr.mask[::4, ::4]).scaled(3)
        land = wy + 96 + 14
        if t >= self.b8_drop:
            if t < self.b8_land:
                u = (t - self.b8_drop) / (self.b8_land - self.b8_drop)
                y = -wr.h + (land + wr.h) * u * u
            else:
                a = t - self.b8_land
                y = land - (max(0.0, 6 * (1 - ((a - 0.1) / 0.1) ** 2)) if a < 0.2 else 0)
            blit(fb, wr, 135 - wr.w // 2, int(y), offsets=False)
        return fb

    # 9 ---------------------------------------------------------------------------------------
    def b9(self, b):
        self.b9_hope = b.at(4) - 0.05
        n = 6
        self.b9_mt = [i * self.b9_hope / n for i in range(n)]
        for tt in self.b9_mt[1:]:
            self.sound(b.start + tt, whoosh_in(self.rng, 0.12), 0.2)
        self.slam(b, 'YOU ALMOST\nENDED\nHUMANITY.', 0.05, until=self.b9_hope, scale=2,
                  y=self.zh - 70 if not self.full else 270, color='white', thud=0.4)
        self.slam(b, "NOW YOU'RE ITS\nONLY HOPE.", self.b9_hope, scale=2,
                  y=8 if not self.full else 60, color='gold', thud=0.6, shake=3)
        self.sound(b.start + self.b9_hope, ic.boom(self.rng, 1.5), 0.45)

    def r9(self, b, t, tic):
        rows = self.zy1 if not self.full else H
        if t >= self.b9_hope:                        # first person, wrench up
            return self.clips['cellroom'].frame(0.05 + (t - self.b9_hope) * 0.25)
        i = max(k for k, c_ in enumerate(self.b9_mt) if t >= c_)
        vf = self.vf
        if i == 0:
            fb = vf.v_skyline(5.6, tic)
        elif i == 1:
            fb = self.clips['inferminator'].frame(8.0)
            fb = zoom_view(fb, W // 2, int(rows * 0.44), 2, rows)
        elif i == 2:
            fb = self.clips['hal'].frame(9.6)
        elif i == 3:
            fb = vf.v_corridor(2.6, tic)
        elif i == 4:
            fb = self.clips['teabot'].frame(1.0)
            fb = zoom_view(fb, *((92, 160) if not self.full else (118, 250)), 2, rows)
        else:
            fb = self.clips['core'].frame(1.0)
        if not self.full and i in (0, 3):            # vertical-film frames: lift their action into the zone
            fb = np.concatenate([fb[110:], np.zeros((110, W), np.uint8)])
        return fb

    # 10 --------------------------------------------------------------------------------------
    def b10(self, b):
        self.sound(b.start, ic.boom(self.rng, 1.8), 0.6)
        self.flashes.append((b.start, 'white'))
        self.shakes.append((b.start, 0.25, 3))
        y_logo = 4 if not self.full else 100
        self.b10_logo_y = TOP_CLEAR + y_logo
        lh = self.A.logo.h
        self.slam(b, 'PLAY FREE', b.at(0) + 0.15, scale=3, y=y_logo + lh + 10, color='gold', plate=False, thud=0.5)
        self.slam(b, 'MANN.COOL/PDOOM', min(b.at(6), 1.3), scale=2, y=y_logo + lh + 48, color='white', plate=True, thud=0.6, shake=3,
                  yscale=3, punch=False)
        self.sound(b.start + 0.2, ic.crackle(b.dur, self.rng), 0.12)

    def r10(self, b, t, tic):
        fb = np.zeros((H, W), np.uint8)
        rows = 120 if not self.full else 200
        fr = self.vf.fire_state(tic + 400, rows=rows, width=W, key='b10fire%d' % rows, tall=True)
        y1 = self.zy1 if not self.full else H
        fb[y1 - rows:y1] = self.vf.fire_pal[fr]
        lg = self.A.logo
        blit(fb, lg, CX - lg.w // 2, self.b10_logo_y, offsets=False)
        return fb

    # ------------------------------------------------------------ composition
    def beat_at(self, t):
        for b in self.beats:
            if t < b.end:
                return b
        return self.beats[-1]

    def zone_rows(self):
        return self.zy1 if self.has_stage else H

    def layer(self, f):
        if f in self._cache:
            return self._cache[f]
        t = f / FPS
        tic = int(math.floor(t * TICS + 1e-6))
        b = self.beat_at(t)
        fb = b.render(b, t - b.start, tic)
        rows = self.zone_rows()
        for (t0, dur, amp) in self.shakes:
            if t0 <= t < t0 + dur:
                r = np.random.default_rng(tic * 977 + 3)
                dx, dy = (int(v) for v in r.integers(-amp, amp + 1, 2))
                fb[:rows] = ic.shift(fb[:rows].copy(), dx, dy)
        for (t0, kind) in self.flashes:
            k = int(round((t - t0) * TICS))
            if 0 <= k < 2:
                fb[:rows] = self.k_white
            elif 2 <= k < 10:
                fb[:rows] = self.pal.white(int(13 - (k - 2) * 1.6))[fb[:rows]]
        for (t0, dur, col, strength) in self.tints:
            if t0 <= t < t0 + dur:
                lvl = int(round(strength * (1 - (t - t0) / dur)))
                if lvl > 0:
                    fb[:rows] = self.pal.toward(col, lvl)[fb[:rows]]
        for s in self.slams:
            s.draw(fb, t, self.font, self.pal, self.zy1)
        if len(self._cache) > 50:
            self._cache = {}
        self._cache[f] = fb
        return fb

    def frame(self, f):
        t = f / FPS
        tic = int(math.floor(t * TICS + 1e-6))
        b = self.beat_at(t)
        fb = self.layer(f).copy()
        rows = self.zone_rows()
        bi = self.beats.index(b)
        if b.trans == 'melt' and bi > 0:
            ticks = tic - int(math.floor(b.start * TICS + 1e-6))
            if ticks < 60:
                old = self.layer(int(round(b.start * FPS)) - 1)
                fb[:rows] = ic.melt(old[:rows], fb[:rows], ticks, seed=b.id * 31)
        if self.has_stage:
            fb[self.zy1:] = self.stage(tic)
            for k in range(14):                     # soft horizon: the zone fades into the stage
                y = self.zy1 - 14 + k
                fb[y] = self.pal.cmap[int(4 + k * 1.9)][fb[y]]
        return fb

    def rgb(self, f):
        return self.pal.pals[0][self.frame(f)]

    # ------------------------------------------------------------ audio
    def audio(self, music=True):
        n = int(math.ceil(self.duration * SR)) + 1
        sfx = np.zeros((n, 2), np.float32)
        for (t, x, gain, pan) in self.sfx:
            ic.place(sfx, t, x, gain, pan)
        out = sfx.copy()
        if music:
            mus = self.A.music
            m = mus[:n].copy()
            if len(m) < n:
                m = np.concatenate([m, mus[:n - len(m)]])
            rms = float(np.sqrt(np.mean(mus[:SR * 30] ** 2)))
            m *= 0.11 / max(rms, 1e-4)
            tt = np.arange(len(m)) / SR
            m *= np.clip((self.duration - tt) / 1.2, 0, 1)[:, None]
            env = np.abs(sfx).max(1)
            bb, aa = ic.signal.butter(1, 4.0, fs=SR)
            env = ic.signal.lfilter(bb, aa, env)
            m *= (1.0 - 0.45 * np.clip(env / 0.15, 0, 1))[:, None]
            out[:len(m)] += m
        return out


# ============================================================================ sfx

def slam_thud(rng):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    x = ic.sine_sweep(150, 42, 0.35, 9)
    x += ic.butter(ic.noise(n, rng), 'low', 1400) * np.exp(-t * 30) * 0.6
    return x.astype(np.float32)


def shutter(rng):
    n = int(0.08 * SR)
    x = ic.butter(ic.noise(n, rng), 'band', [1500, 7000]) * ic.env_exp(n, 70)
    x[int(0.035 * SR):] += ic.butter(ic.noise(n - int(0.035 * SR), rng), 'band', [2000, 8000]) * ic.env_exp(n - int(0.035 * SR), 90) * 0.7
    return x.astype(np.float32)


def whoosh_in(rng, dur=0.25):
    x = ic.whoosh(rng, dur)
    return x[::-1].copy() * 0.0 + x


def whine(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 400 + 2600 * (t / dur) ** 1.5
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.05) * 0.5).astype(np.float32)


def loudness(buf):
    """Integrated loudness (LUFS) of a stereo float buffer via ffmpeg's ebur128."""
    tmp = SCRATCH / 'lufs.wav'
    ic.write_wav(tmp, np.clip(buf, -1, 1))
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(tmp), '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
    return float(m[-1]) if m else -70.0


# ============================================================================ output

def encode_video(promo, path):
    nframes = int(round(promo.duration * FPS))
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-vf', 'scale=%d:%d:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p' % (W * UP, H * UP),
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-profile:v', 'high', '-level:v', '4.1',
           '-g', str(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-an', str(path)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(nframes):
        p.stdin.write(promo.rgb(f).tobytes())
        if f % 300 == 0:
            print('    frame %d/%d' % (f, nframes), flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit('ffmpeg failed')


def mux(video, wav, out, extra=()):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(video), '-i', str(wav), '-map', '0:v', '-map', '1:a',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), *extra, '-movflags', '+faststart', '-shortest', str(out)],
                   check=True)


def share_copy(src, dst, limit_mb=27.0, copy_audio=False):
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)],
                               capture_output=True, text=True).stdout)
    if src.stat().st_size < limit_mb * 1e6:
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-c', 'copy', '-movflags', '+faststart', str(dst)], check=True)
        return
    kbps = int((limit_mb * 8e3 / dur) - 200)
    common = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '%dk' % kbps, '-maxrate', '%dk' % int(kbps * 1.5), '-bufsize', '%dk' % (kbps * 2),
              '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p', '-tune', 'animation']
    log = str(SCRATCH / 'x264pass')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), *common, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', '/dev/null'], check=True)
    audio = ['-c:a', 'copy'] if copy_audio else ['-c:a', 'aac', '-b:a', '160k']
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), *common, '-pass', '2', '-passlogfile', log,
                    *audio, '-movflags', '+faststart', str(dst)], check=True)


def cut(src, t0, t1, dst):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.3f' % t0, '-i', str(src), '-t', '%.3f' % (t1 - t0),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(dst)], check=True)


def keyframe_sheet(promo, path, shade=False):
    tiles = []
    for b in promo.beats:
        for u in (0.2, 0.55, 0.9):
            f = int((b.start + b.dur * u) * FPS)
            tiles.append(('%d' % b.id, f, promo.rgb(f)))
    cols = 10
    sheet = Image.new('RGB', (cols * (W + 6) + 6, -(-len(tiles) // cols) * (H + 20) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (name, f, rgb) in enumerate(tiles):
        x = 6 + (k % cols) * (W + 6)
        y = 6 + (k // cols) * (H + 20)
        im = Image.fromarray(rgb).convert('RGBA')
        if shade:
            ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            od.rectangle((0, promo.zy1, W, H), fill=(0, 140, 255, 90))         # presenter
            od.rectangle((0, 0, W, TOP_CLEAR), fill=(255, 0, 255, 90))           # status bar
            od.rectangle((KEY_X1, 0, W, H), fill=(255, 0, 255, 60))              # platform buttons
            od.rectangle((0, TOP_CLEAR, KEY_X1 - 1, promo.zy1 - 1), outline=(0, 255, 0, 220))
            im.alpha_composite(ov)
        sheet.paste(im.convert('RGB'), (x, y + 14))
        d.text((x, y), 'beat %s  t=%.2fs' % (name, f / FPS), fill=(220, 220, 220))
    sheet.save(path)


def mp4_slam_sheet(promo, mp4, path):
    """Every kinetic slam grabbed back out of the encoded MP4 (0.35 s after it lands), at phone
    preview size (270x480 tiles = a quarter of 1080x1920)."""
    tiles = []
    for s_ in sorted(promo.slams, key=lambda s_: s_.t0):
        t = min(s_.t0 + 0.35, s_.t1 - 0.05)
        out = SCRATCH / 'slam.png'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.3f' % t, '-i', str(mp4), '-frames:v', '1', str(out)], check=True)
        tiles.append((s_.text, t, Image.open(out).convert('RGB').resize((W, H), Image.LANCZOS)))
    cols = 9
    sheet = Image.new('RGB', (cols * (W + 6) + 6, -(-len(tiles) // cols) * (H + 20) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (text, t, im) in enumerate(tiles):
        x, y = 6 + (k % cols) * (W + 6), 6 + (k // cols) * (H + 20)
        sheet.paste(im, (x, y + 14))
        d.text((x, y), '%.2fs %s' % (t, text[:30]), fill=(220, 220, 220))
    sheet.save(path)


# ============================================================================ timed promos (real voiceover)
#
# One full-frame film per character, cut to the owner's recorded performance.  Every cut, slam
# and sound is placed on a named word from the whisper timing in doom-web/local/promo/vo/.

VO_DIR = OUT / 'vo'
TIMED = OUT / 'timed'
REVIEW_T = REVIEW / 'timed'
PERF_DIR = ROOT.parents[2] / 'GADtrailers' / 'pdoom'
SLAM_Y = 214                       # default slam band (abs Doom px): above the presenter, below the subject
TOP_Y = 36                         # top slam band
TEXTWALL = ('SO THE THING ABOUT A WRENCH IS THAT, AND I THINK THIS IS IMPORTANT, IT IS IN SOME SENSE A TOOL. '
            'AND TOOLS ARE, YOU KNOW, PLUS OR MINUS A FACTOR OF THREE, THE THING THAT LETS YOU DO THE OTHER THING. '
            'THERE ARE A COUPLE OF THINGS TO SAY HERE. THE FIRST IS THAT IT IS METAL. THE SECOND IS THAT IT IS '
            'VERY, VERY METAL. AND I THINK IF YOU LOOK AT THE SCALING LAWS FOR WRENCHES, WHICH NOBODY HAS DONE, '
            'YOU SEE A KIND OF RACE TO THE TOP. I WROTE SOME OF IT. ')


def norm(w):
    return re.sub(r'[^a-z0-9]', '', w.lower())


class VO:
    """The whisper word timing for one performance: beats 1-10, every word with its start time.
    `take` picks vo/<ceo>-<take>-timing.json (made by scripts/promo-vo-timing.py) over the original."""

    def __init__(self, ceo, take=None):
        d = json.loads((VO_DIR / ('%s%s-timing.json' % (ceo, '-' + take if take else ''))).read_text())
        self.ceo, self.dur, self.beats = ceo, float(d['duration']), d['beats']
        self.source = ROOT.parents[2] / d['source']

    def has(self, n, phrase, k=1):
        """True if the take still says `phrase` (k times) in beat n; lines cut from a take drop their cues."""
        try:
            self.w(n, phrase, k)
            return True
        except KeyError:
            return False

    def bstart(self, n):
        return float(self.beats[n - 1]['start'])

    def bend(self, n):
        return float(self.beats[n - 1]['end'])

    def w(self, n, phrase, k=1, end=False):
        """Start (or end) time of the k-th occurrence of `phrase` (one or more words) in beat n."""
        toks = [norm(x) for x in phrase.split()]
        ws = self.beats[n - 1]['words']
        hit = 0
        for i in range(len(ws) - len(toks) + 1):
            if all(norm(ws[i + j]['word']) == toks[j] for j in range(len(toks))):
                hit += 1
                if hit == k:
                    return float(ws[i + len(toks) - 1]['end'] if end else ws[i]['t'])
        raise KeyError('beat %d has no "%s" #%d (%s)' % (n, phrase, k, ' '.join(x['word'] for x in ws)))


def add_glyphs(font):
    """STCFN has no '~' or '±'; draw them in its style (outline 191, top-lit fill)."""
    if '~' in font.g:
        return
    shapes = {
        '±': (['..OOO..', 'OOOFOOO', 'OFFFFFO', 'OOOFOOO', '..OOO..', 'OOOOOOO', 'OFFFFFO', 'OOOOOOO'], 0),
        '~': (['.OOO....', 'OFFFOOOO', 'OOOFFFFO', '....OOO.'], -2),
    }
    fill = [178, 178, 179, 181, 183, 185, 185, 186]
    for ch, (rows, oy) in shapes.items():
        idx = np.zeros((len(rows), len(rows[0])), np.uint8)
        mask = np.zeros(idx.shape, bool)
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c != '.':
                    idx[y, x] = 191 if c == 'O' else fill[y]
                    mask[y, x] = True
        font.g[ch] = ic.Gfx(idx, mask, 0, oy)


def heart(fb, pal, x, y, s, col=(176, 168), lvl=0):
    rows = ['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
    for r, row in enumerate(rows):
        for q, ch in enumerate(row):
            if ch != '.':
                rect(fb, x + q * s, y + r * s, x + (q + 1) * s, y + (r + 1) * s, pal.cmap[lvl][col[1] if ch == 'H' else col[0]])


class Shared:
    """Assets both timed films share (the opening film's art, posters, footage)."""

    def __init__(self, A):
        self.A = A
        sd, sl = ic.resolve_face_dir('samwise', None)
        md, _ = ic.resolve_face_dir('mario', None)
        self.vf = ic.VerticalFilm(A, 'samwise', sd, sl)
        self.faces = {'samwise': self.vf.faces, 'mario': ic.load_faces(A, md)}
        ids = ['PDP%02d' % i for i in range(1, 21)]
        self.posters = {p: ic.load_png(A.pal, POSTERS / (p + '.png'), (0, 0)) for p in ids}
        self.clips = {s: Footage(A.pal, s, 'fullframe', H) for s in
                      ('cellroom', 'liron', 'loop', 'inferminator', 'teabot', 'hal', 'turret', 'core')}
        add_glyphs(A.font)


class TimedPromo(Promo):
    """A full-frame promo cut to a real voiceover.  Shots and slams are placed on word times."""

    def __init__(self, A, ceo, S, take=None):
        self.A, self.ceo, self.S, self.take = A, ceo, S, take
        self.pal, self.font = A.pal, A.font
        self.layout, self.zy1, self.has_stage, self.full = 'timed', H, False, True
        self.zh = H - TOP_CLEAR
        self.rng = np.random.default_rng(7 if ceo == 'sam' else 9)
        self.sfx, self.shakes, self.flashes, self.tints, self.slams = [], [], [], [], []
        self._cache = {}
        self.k_white = self.pal.idx(255, 255, 255)
        self.vf, self.faces, self.posters, self.clips = S.vf, S.faces, S.posters, S.clips
        self.vo = VO(ceo, take)
        self.duration = self.vo.dur
        # The recorded takes still say the founders' parody names (they were renamed in the game on
        # 2026-10-09), so the CEO pick under them must too.
        self.ceo_labels = {'samwise': 'SAMWISE\nOTHERMALE', 'mario': 'MARIO\nSCALDI'}
        self.shots, self.cues = [], []
        (self.build_sam if ceo == 'sam' else self.build_mario)()
        self.shots.sort(key=lambda s_: s_['t0'])
        for a, b in zip(self.shots, self.shots[1:]):
            a['t1'] = b['t0']
        self.shots[-1]['t1'] = self.duration + 1

    # ------------------------------------------------------------ cue helpers
    def shot(self, at, fn, trans='cut', **p):
        self.shots.append(dict(t0=at, fn=fn, trans=trans, p=p))

    def tslam(self, text, t0, t1, scale=None, y=SLAM_Y, color='white', plate=True, thud=0.45, shake=2, word=None, **kw):
        sc = min(scale or 4, fit_scale(self.font, text, max_scale=scale or 4))
        s_ = Slam(text, t0, t1 - 0.02, sc, y, color, plate, **kw)
        self.slams.append(s_)
        self.cues.append(dict(t=round(t0, 3), end=round(t1, 3), kind='slam', text=s_.text, word=word))
        if thud:
            self.sound(t0, slam_thud(self.rng), thud)
        if shake:
            self.shakes.append((t0, 0.14, shake))
        return s_

    def cue(self, t, kind, desc, word=None):
        self.cues.append(dict(t=round(t, 3), kind=kind, text=desc, word=word))

    # ------------------------------------------------------------ the two cuts
    def common_open(self, n_snap_word, snap_beat=1):
        v = self.vo
        snap = v.w(snap_beat, n_snap_word)
        self.shot(0.0, self.r_logo, snap=snap)
        self.cue(0.0, 'shot', 'DOOM logo over fire')
        self.sound(0.0, ic.boom(self.rng, 1.4), 0.7)
        self.sound(0.0, 'DSBAREXP', 0.45, 0.0, 0.9)
        self.shakes.append((0.1, 0.25, 3))
        self.flashes.append((0.1, 'white'))
        self.sound(snap - 0.1, whoosh_in(self.rng), 0.35)
        self.sound(snap + 0.03, 'pdchrg.lmp', 0.6)
        self.sound(snap + 0.03, 'DSPLASMA', 0.55)
        self.sound(snap + 0.03, ic.boom(self.rng, 1.2), 0.45)
        self.shakes.append((snap + 0.03, 0.22, 3))
        self.tints.append((snap + 0.03, 0.35, (255, 30, 30), 9))
        self.cue(snap, 'shot', 'p( ) slam in: p(DOOM) logo + laser', n_snap_word)

    def ceo_pick(self, n, first, second, t_first, t_second, t_end_menu):
        self.shot(self.vo.bstart(n), self.r_ceo, first=first, sels=[(t_first, first), (t_second, second)])
        self.tslam('CHOOSE YOUR CEO', self.vo.bstart(n) + 0.05, t_end_menu, scale=2, y=TOP_Y, color='red', plate=False, thud=0.25, shake=0)
        for t, c in ((t_first, first), (t_second, second)):
            self.sound(t - 0.05, 'DSPSTOP', 0.5)
            self.sound(t, 'DSPISTOL', 0.25)
            self.cue(t, 'select', c.upper())

    def posters_pile(self, t0, t1, ids):
        rng = np.random.default_rng(int(t0 * 100))
        n = len(ids)
        items = []
        for i, pid in enumerate(ids):
            tt = t0 + (t1 - t0) * i / n
            items.append((tt, pid, int(rng.integers(-14, 15)), int(rng.integers(-10, 12))))
            self.sound(tt, shutter(self.rng), 0.5)
            self.sound(tt, slam_thud(self.rng), 0.18)
        self.shot(t0, self.r_posters, items=items)
        self.cue(t0, 'shot', 'poster pile: ' + ' '.join(ids))

    def poster_flash(self, t, pid, fire=False):
        self.shot(t, self.r_posters, items=[(t, pid, 0, 0)], fire=fire, single=True)
        self.sound(t, shutter(self.rng), 0.55)
        self.sound(t, slam_thud(self.rng), 0.3)
        self.flashes.append((t, 'white'))
        self.cue(t, 'shot', 'poster ' + pid)

    def counter(self, n, c0, c1, zoom):
        self.shot(self.vo.bstart(n), self.r_monitors, trans='melt', c0=c0, c1=c1, zoom=zoom)
        for f in range(int(c0 * TICS), int(c1 * TICS) + 1):
            if f % 4 == 0:
                self.sound(f / TICS, 'DSPISTOL', 0.3)
        self.sound(c1, 'DSBAREXP', 0.8)
        self.shakes.append((c1, 0.3, 3))
        self.tints.append((c1, 0.5, (255, 0, 0), 7))
        self.cue(c1, 'hit', 'p(DOOM) 99% + barrel explosion')

    def twenty(self, n, t20, t_people):
        v = self.vo
        pops = [v.bstart(n) + 0.08 + 0.06 * i for i in range(20)]
        self.shot(v.bstart(n), self.r_cells, trans='melt', pops=pops, reveal=t_people)
        for i, tp in enumerate(pops):
            self.sound(tp, 'DSTINK', 0.7, ((i % 5) - 2) / 3, 0.9 + 0.02 * (i % 6))
        for i in range(10):
            self.sound(t_people + 0.06 * i, 'DSPSTOP', 0.18, (i % 5 - 2) / 3, 1.4)
        return pops

    def big_person(self, t, pid, t_next):
        self.shot(t, self.r_big, pid=pid)
        name = PRISONERS[pid][0]
        self.tslam(name.replace(' ', '\n'), t, t_next, scale=2, y=TOP_Y, color='white', word=name.split()[0])
        self.sound(t, ic.boom(self.rng, 1.0), 0.3)

    def footage(self, t, shot, off, rate=1.0, zoom=None, desc=None):
        self.shot(t, self.r_footage, clip=shot, off=off, rate=rate, zoom=zoom)
        self.sound(t, whoosh_in(self.rng, 0.18), 0.22)
        self.cue(t, 'shot', desc or ('footage: ' + shot))

    def sees_hears_lasers(self, n, t_see, t_hear, t_has, t_lasers):
        self.shot(t_see - 0.06, self.r_camera)
        self.shot(t_hear - 0.06, self.r_hal, t0=t_hear - 0.06)
        self.shot(t_has - 0.06, self.r_laser, t0=t_has - 0.06, beam=t_lasers)
        self.tslam('IT SEES\nYOU', t_see, t_hear - 0.06, scale=3, y=SLAM_Y - 18, word='see')
        self.tslam('IT HEARS\nYOU', t_hear, t_has - 0.06, scale=3, y=SLAM_Y - 18, word='hear')
        for k in range(3):
            self.sound(t_see + 0.2 + k * 0.35, ic.blip(1760, 0.07), 0.15)
        self.sound(t_see, ic.servo(self.rng), 0.3)
        self.sound(t_hear, ic.polite_chime(), 0.25)
        self.sound(t_hear + 0.4, 'DSBDCLS', 0.3)
        self.sound(t_has, 'pdchrg.lmp', 0.6)
        self.sound(t_has + 0.05, whine(max(0.2, t_lasers - t_has)), 0.25)
        self.sound(t_lasers, 'DSPLASMA', 0.7)
        self.sound(t_lasers, 'DSRXPLOD', 0.45)
        self.shakes.append((t_lasers, 0.3, 4))
        self.flashes.append((t_lasers, 'white'))
        self.tints.append((t_lasers + 0.06, 0.5, (255, 0, 0), 8))
        self.cue(t_lasers, 'hit', 'laser beam flash', 'lasers')

    def teabot(self, t0, t_serves, t_forever, extra=None, t_extra=None, wide_again=None):
        self.shot(t0, self.r_teabot, trans='melt', forever=t_forever, extra=extra, t_extra=t_extra, wide_again=wide_again)
        self.tslam('A ROBOT SERVES\nTEA TO NOBODY.', t_serves, t_forever - 0.04, scale=2, y=SLAM_Y, word='serves')
        self.tslam('FOREVER.', t_forever, (t_extra or t_forever + 1.2), scale=4, y=SLAM_Y - 6, color='gold', thud=0.5, word='forever')
        for tt in np.arange(t0 + 0.4, (t_extra or t_forever + 1.0), 1.1):
            self.sound(tt, 'pdteac.lmp', 0.55, 0.2)

    def wrench(self, n, t_land, end_slam):
        v = self.vo
        drop = t_land - 0.35
        self.shot(v.bstart(n), self.r_wrench, trans='melt', drop=drop, land=t_land, grin=t_land + 0.3)
        self.sound(drop, ic.whoosh(self.rng, 0.35), 0.3)
        self.sound(t_land, 'pdpickup.lmp', 0.8)
        self.sound(t_land, 'DSMETAL', 0.55, 0.0, 1.25)
        self.sound(t_land + 0.3, 'DSWPNUP', 0.8)
        self.shakes.append((t_land, 0.25, 3))
        self.tslam('AND YOU...', v.bstart(n) + 0.02, t_land, scale=3, y=SLAM_Y, thud=0.3, shake=0, word='and')
        self.tslam('...A WRENCH.', t_land, end_slam, scale=3, y=SLAM_Y, color='gold', thud=0.0, shake=0, word='wrench')

    def montage(self, t0, t1, n=5):
        vf = self.vf
        cl = self.clips
        frames = [lambda tic: vf.v_skyline(5.6, tic),
                  lambda tic: zoom_view(cl['inferminator'].frame(8.0), W // 2, int(H * 0.40), 2, H),
                  lambda tic: cl['hal'].frame(9.6),
                  lambda tic: vf.v_corridor(2.6, tic),
                  lambda tic: zoom_view(cl['teabot'].frame(1.0), 118, 250, 2, H),
                  lambda tic: cl['core'].frame(1.0)]
        items = [(t0 + (t1 - t0) * i / n, frames[i % len(frames)]) for i in range(n)]
        self.shot(t0, self.r_montage, items=items)
        for tt, _ in items[1:]:
            self.sound(tt, whoosh_in(self.rng, 0.12), 0.2)

    def end_card(self, n, t_play, t_url):
        v = self.vo
        t0 = v.bstart(n)
        self.shot(t0, self.r_end, trans='melt')
        self.sound(t0, ic.boom(self.rng, 1.8), 0.6)
        self.sound(t0 + 0.2, ic.crackle(self.duration - t0, self.rng), 0.12)
        self.tslam('PLAY FREE', t_play, self.duration + 1, scale=3, y=146, color='gold', plate=False, thud=0.5, word='play')
        self.tslam('MANN.COOL/PDOOM', t_url, self.duration + 1, scale=2, y=180, plate=True, thud=0.6, shake=3, yscale=3, punch=False, word='www')

    # ------------------------------------------------------------ SAM
    def build_sam(self):
        v = self.vo
        # 1 ------------------------------------------------------------------------------------------
        self.common_open('P')
        if v.has(1, 'super'):                                # "Hey, so I think this is super cool." (cut from later takes)
            self.tslam('SUPER\nCOOL.', v.w(1, 'super'), v.w(1, 'we'), scale=3, y=SLAM_Y, color='yellow', thud=0.3, word='super cool')
            for k in range(10):                              # cheerful sparkle on "super cool"
                self.sound(v.w(1, 'super') + 0.03 * k, ic.blip(1500 + 120 * k, 0.05), 0.05)
        self.tslam('A DOOM MOD', v.w(1, 'mod'), v.bend(1), scale=3, y=SLAM_Y, color='gold', word='mod')
        # 2 ------------------------------------------------------------------------------------------
        self.ceo_pick(2, 'samwise', 'mario', v.w(2, 'samwise'), v.w(2, 'mario'), v.w(2, 'we'))
        self.posters_pile(v.w(2, 'we'), v.w(2, 'i'), ['PDP05', 'PDP04', 'PDP03', 'PDP07', 'PDP16', 'PDP17', 'PDP09', 'PDP20'])
        self.tslam('THE TWO BIGGEST\nAI COMPANIES', v.w(2, 'two'), v.w(2, 'i'), scale=2, y=SLAM_Y, color='gold', word='two')
        self.tslam('PRETTY GOOD\nAT THIS.', v.w(2, 'pretty'), v.bend(2), scale=3, y=SLAM_Y - 8, color='white', word='pretty good')
        # 3 ------------------------------------------------------------------------------------------
        c0, c1 = v.w(3, 'agi'), v.w(3, '99')
        self.counter(3, c0, c1, zoom=(c0 + c1) / 2)
        self.tslam('GREAT.', v.w(3, 'great'), v.w(3, 'and'), scale=4, y=SLAM_Y, color='yellow', word='great')
        self.tslam('KIND OF\nSUCKS.', v.w(3, 'kind'), v.bend(3), scale=3, y=SLAM_Y, color='white', thud=0.25, shake=0, punch=False, word='kind of sucks')
        # 4 ------------------------------------------------------------------------------------------
        self.twenty(4, v.w(4, '20'), v.w(4, 'people'))
        self.tslam('HUMANS LEFT', v.w(4, '20'), v.w(4, 'and') if v.has(4, 'and') else v.w(4, 'people') - 0.25,
                   scale=2, y=SLAM_Y, digits='20', digits_obj=self.A.digits, dscale=2, word='20')
        if v.has(4, 'little'):
            self.tslam('A LITTLE BIT\nAWKWARD.', v.w(4, 'little'), v.w(4, 'exact') - 0.25, scale=2, y=SLAM_Y, word='little bit awkward')
        self.tslam('THE PEOPLE WHO\nWARNED US.', v.w(4, 'people'), v.w(4, 'eliezer') - 0.04, scale=2, y=SLAM_Y, color='gold', word='people')
        self.big_person(v.w(4, 'eliezer'), 0, v.w(4, 'jeffrey') - 0.04)
        self.big_person(v.w(4, 'jeffrey'), 1, v.w(4, 'i') if v.has(4, 'i') else v.bend(4))
        if v.has(4, 'i'):                                    # "I really respected them. I don't know..." (cut from later takes)
            self.shot(v.w(4, 'i'), self.r_cells, pops=[0] * 20, reveal=0.0)
        if v.has(4, 'really') and v.has(4, 'i', 2):
            self.tslam('I REALLY\nRESPECTED THEM.', v.w(4, 'really'), v.w(4, 'i', 2), scale=2, y=SLAM_Y, word='really respected')
        if v.has(4, 'dont') and v.has(4, 'honest'):
            self.tslam("I DON'T KNOW.", v.w(4, 'dont'), v.w(4, 'honest'), scale=3, y=SLAM_Y, word="don't know")
        if v.has(4, 'honest'):
            self.tslam("THAT'S THE\nHONEST ANSWER.", v.w(4, 'honest'), v.bend(4), scale=2, y=SLAM_Y, color='gold', word='honest')
        # 5 ------------------------------------------------------------------------------------------
        self.footage(v.bstart(5), 'loop', 0.2)
        self.tslam('4 FACILITIES', v.w(5, 'four'), v.w(5, 'free'), scale=3, y=SLAM_Y, word='four')
        self.footage(v.w(5, 'free'), 'cellroom', 0.0)
        self.tslam('FREE THEM', v.w(5, 'free'), v.w(5, 'lead'), scale=3, y=TOP_Y, word='free')
        self.footage(v.w(5, 'lead'), 'liron', 0.0)
        self.tslam('LEAD THEM\nTO SAFETY', v.w(5, 'lead'), v.w(5, 'rogue'), scale=2, y=SLAM_Y, word='lead')
        self.footage(v.w(5, 'rogue'), 'inferminator', 3.6)
        self.tslam('HUNTS YOU.', v.w(5, 'hunts'), v.w(5, 'i'), scale=4, y=SLAM_Y, color='red', word='hunts')
        for k in range(8):
            self.sound(v.w(5, 'rogue') + k * 0.42, 'DSHOOF', 0.25)
        self.footage(v.w(5, 'i'), 'inferminator', 7.6, zoom=(3, W // 2, int(H * 0.40)), desc='Inferminator red-visor close-up')
        self.sound(v.w(5, 'i'), 'DSCYBSIT', 0.35, 0.0, 0.85)
        self.tslam('SUPER IMPORTANT\nTO GET RIGHT.', v.w(5, 'super important'), v.w(5, 'were'), scale=2, y=TOP_Y, word='super important')
        self.poster_flash(v.w(5, 'were'), 'PDP01')
        t_it = v.w(5, 'iteratively')
        self.shot(t_it, self.r_hunters, t0=t_it)
        self.tslam('ITERATIVELY.', t_it, v.bstart(6), scale=3, y=TOP_Y, color='gold', word='iteratively')
        for k in range(3):
            self.sound(t_it + 0.12 * k, 'DSMETAL', 0.45, (k - 1) / 2, 1.1 - 0.1 * k)
        self.cue(t_it, 'shot', 'hunters V1 / V2 / V3')
        # 6 ------------------------------------------------------------------------------------------
        self.footage(v.bstart(6), 'hal', 9.0, rate=0.5, desc='HAL3000 corridor')
        self.tslam('THE ROGUE\nSUPER-\nINTELLIGENCE\nWE BUILT', v.w(6, 'rogue'), v.w(6, 'see') - 0.08, scale=2, y=150, color='red', thud=0.3, word='rogue')
        self.sees_hears_lasers(6, v.w(6, 'see'), v.w(6, 'hear'), v.w(6, 'it has'), v.w(6, 'lasers'))
        self.tslam('IT HAS\nLASERS', v.w(6, 'it has'), v.w(6, 'its'), scale=3, y=SLAM_Y - 18, color='red', word='has lasers')
        self.shot(v.w(6, 'its'), self.r_expo, t0=v.w(6, 'its'), shoot=v.w(6, 'exponentially'))
        self.tslam('EXPONENTIALLY.', v.w(6, 'exponentially'), v.bend(6), scale=2, y=TOP_Y, color='gold', word='exponentially')
        self.sound(v.w(6, 'getting'), whine(max(0.3, v.bend(6) - v.w(6, 'getting'))), 0.25)
        self.sound(v.w(6, 'exponentially'), ic.boom(self.rng, 1.2), 0.4)
        # 7 ------------------------------------------------------------------------------------------
        self.teabot(v.bstart(7), v.w(7, 'serves'), v.w(7, 'forever'), extra='hearts', t_extra=v.w(7, 'i'))
        self.tslam('KIND OF\nBEAUTIFUL,\nACTUALLY.', v.w(7, 'beautiful'), v.bend(7), scale=2, y=SLAM_Y, color='white', thud=0.2, shake=0, word='beautiful')
        for k in range(5):
            self.sound(v.w(7, 'i') + 0.25 * k, ic.fm_bell(ic.midi(84 + 4 * (k % 3)), 0.6), 0.06)
        # 8 ------------------------------------------------------------------------------------------
        self.wrench(8, v.w(8, 'wrench'), v.w(8, 'just'))
        self.tslam('JUST A WRENCH.', v.w(8, 'just'), v.bend(8), scale=3, y=SLAM_Y, color='gold', thud=0.3, shake=0, word='just')
        # 9 ------------------------------------------------------------------------------------------
        self.montage(v.bstart(9), v.w(9, 'now'))
        self.tslam('WE ALMOST ENDED\nHUMANITY.', v.w(9, 'we'), v.w(9, 'now'), scale=2, y=SLAM_Y, word='we almost')
        self.footage(v.w(9, 'now'), 'cellroom', 0.05, rate=0.25, desc='first-person wrench')
        self.tslam("NOW WE'RE ITS\nONLY HOPE.", v.w(9, 'now'), v.w(9, 'i') if v.has(9, 'i') else v.bend(9),
                   scale=2, y=TOP_Y, color='gold', thud=0.6, shake=3, word='now')
        self.sound(v.w(9, 'now'), ic.boom(self.rng, 1.5), 0.45)
        if v.has(9, 'mission'):
            self.tslam("THAT'S THE\nMISSION.", v.w(9, 'mission'), v.bend(9), scale=3, y=TOP_Y, color='white', word='mission')
        # 10 -----------------------------------------------------------------------------------------
        self.end_card(10, v.w(10, 'play'), v.w(10, 'www'))
        if v.has(10, 'youll'):
            self.tslam("YOU'LL REALLY\nLIKE IT.", v.w(10, 'youll'), self.duration + 1, scale=2, y=SLAM_Y + 6, color='white', thud=0.3, shake=0, word="you'll")

    # ------------------------------------------------------------ MARIO
    def build_mario(self):
        v = self.vo
        # 1 ------------------------------------------------------------------------------------------
        self.common_open('pdoom')
        self.tslam('A COUPLE\nOF THINGS:', v.w(1, 'couple'), v.w(1, 'pdoom'), scale=2, y=SLAM_Y, color='white', thud=0.25, shake=0, word='couple')
        self.tslam("1. IT'S A MOD\nOF DOOM.", v.w(1, 'first'), v.bend(1), scale=2, y=SLAM_Y - 46, color='white', word='first')
        self.tslam("2. IT'S VERY,\nVERY GOOD.", v.w(1, 'second'), v.bend(1), scale=2, y=SLAM_Y + 8, color='gold', word='second')
        # 2 ------------------------------------------------------------------------------------------
        self.ceo_pick(2, 'mario', 'samwise', v.w(2, 'mario'), v.w(2, 'samwise'), v.w(2, 'we'))
        race = v.w(2, 'race') if v.has(2, 'race') else v.bend(2)   # "...kind of a race to the top." (cut from later takes)
        self.posters_pile(v.w(2, 'we'), race, ['PDP05', 'PDP04', 'PDP03', 'PDP07', 'PDP16', 'PDP17', 'PDP09', 'PDP14'])
        self.tslam('THE TWO BIGGEST\nAI COMPANIES', v.w(2, 'two'), race, scale=2, y=SLAM_Y, color='gold', word='two')
        if v.has(2, 'race'):
            self.poster_flash(v.w(2, 'race'), 'PDP20')
            self.tslam('A RACE TO\nTHE TOP.', v.w(2, 'race'), v.bend(2), scale=3, y=SLAM_Y + 10, color='white', word='race')
        # 3 ------------------------------------------------------------------------------------------
        self.shot(v.bstart(3), self.r_monitors, trans='melt', c0=99, c1=100, zoom=99)
        self.tslam('AGI.', v.w(3, 'agi'), v.w(3, 'plus') if v.has(3, 'plus') else v.w(3, 'and'), scale=4, y=SLAM_Y, color='gold', word='agi')
        if v.has(3, 'plus'):                                 # "plus or minus a factor of three" here (later takes move it to the end)
            self.shot(v.w(3, 'plus'), self.r_errbars, t0=v.w(3, 'plus'), t1=v.w(3, 'three'))
            self.tslam('± A FACTOR\nOF THREE', v.w(3, 'plus'), v.w(3, 'and'), scale=3, y=TOP_Y, color='white', word='plus or minus')
            self.sound(v.w(3, 'plus'), whine(max(0.3, v.w(3, 'three') - v.w(3, 'plus'))), 0.2)
        c0, c1 = v.w(3, 'and'), v.w(3, '99')
        self.shot(c0, self.r_monitors, c0=c0, c1=c1, zoom=c0 + 0.01)
        for f in range(int(c0 * TICS), int(c1 * TICS) + 1):
            if f % 4 == 0:
                self.sound(f / TICS, 'DSPISTOL', 0.3)
        self.sound(c1, 'DSBAREXP', 0.8)
        self.shakes.append((c1, 0.3, 3))
        self.tints.append((c1, 0.5, (255, 0, 0), 7))
        self.cue(c1, 'hit', 'p(DOOM) 99% + barrel explosion', '99')
        self.tslam('VERY\nFRIGHTENING.', v.w(3, 'frightening'), v.w(3, 'its', 2), scale=3, y=SLAM_Y - 8, color='white', word='frightening')
        self.tslam('VERY\nFRIGHTENING.', v.w(3, 'frightening', 2), v.bend(3), scale=3, y=SLAM_Y - 8, color='red', thud=0.6, shake=5, word='frightening #2')
        self.shakes.append((v.w(3, 'frightening', 2), v.bend(3) - v.w(3, 'frightening', 2), 2))
        # 4 ------------------------------------------------------------------------------------------
        self.twenty(4, v.w(4, '20'), v.w(4, 'people'))
        self.tslam('HUMANS LEFT', v.w(4, '20'), v.w(4, 'ironically'), scale=2, y=SLAM_Y, digits='20', digits_obj=self.A.digits, dscale=2, word='20')
        self.tslam('IRONICALLY,', v.w(4, 'ironically'), v.w(4, 'people') - 0.04, scale=3, y=SLAM_Y, word='ironically')
        self.tslam('THE PEOPLE WHO\nWARNED US.', v.w(4, 'people'), v.w(4, 'eliezer') - 0.04, scale=2, y=SLAM_Y, color='gold', word='people')
        self.big_person(v.w(4, 'eliezer'), 0, v.w(4, 'jeffrey') - 0.04)
        self.big_person(v.w(4, 'jeffrey'), 1, v.w(4, 'all'))
        self.shot(v.w(4, 'all'), self.r_cells, pops=[0] * 20, reveal=0.0)
        self.tslam('ALL OF THEM.', v.w(4, 'all'), v.w(4, 'mostly') if v.has(4, 'mostly') else v.bend(4), scale=3, y=SLAM_Y, word='all of them')
        if v.has(4, 'mostly'):                               # "Mostly in writing. I've read most of it..." (cut from later takes)
            self.tslam('MOSTLY\nIN WRITING.', v.w(4, 'mostly'), v.w(4, 'ive'), scale=3, y=SLAM_Y - 8, color='red', shake=3, word='mostly')
        if v.has(4, 'ive') and v.has(4, 'wrote'):
            self.shot(v.w(4, 'ive'), self.r_papers, t0=v.w(4, 'ive'), pull=v.w(4, 'wrote'))
            self.tslam("I'VE READ\nMOST OF IT.", v.w(4, 'read'), v.w(4, 'wrote'), scale=2, y=TOP_Y, word='read most')
            self.tslam('I WROTE\nSOME OF IT.', v.w(4, 'wrote'), v.bend(4), scale=2, y=SLAM_Y + 4, color='gold', word='wrote')
            for k in range(6):
                self.sound(v.w(4, 'ive') + 0.18 * k, shutter(self.rng), 0.12)
            self.sound(v.w(4, 'wrote'), whoosh_in(self.rng, 0.2), 0.3)
        # 5 ------------------------------------------------------------------------------------------
        self.footage(v.bstart(5), 'loop', 0.2)
        self.tslam('HELD CAPTIVE.', v.w(5, 'captive'), v.w(5, 'free'), scale=3, y=SLAM_Y, word='captive')
        self.footage(v.w(5, 'free'), 'cellroom', 0.0)
        self.tslam('FREE THEM', v.w(5, 'free'), v.w(5, 'lead'), scale=3, y=TOP_Y, word='free')
        self.footage(v.w(5, 'lead'), 'liron', 0.0)
        self.tslam('LEAD THEM\nTO SAFETY', v.w(5, 'lead'), v.w(5, 'hunted'), scale=2, y=SLAM_Y, word='lead')
        self.footage(v.w(5, 'hunted'), 'inferminator', 2.4, rate=0.95)
        self.tslam('HUNTED.', v.w(5, 'hunted'), v.w(5, 'built'), scale=4, y=SLAM_Y, color='red', word='hunted')
        for k in range(10):
            self.sound(v.w(5, 'hunted') + k * 0.42, 'DSHOOF', 0.25)
        self.footage(v.w(5, 'built'), 'inferminator', 7.6, zoom=(3, W // 2, int(H * 0.40)), desc='Inferminator red-visor close-up')
        self.tslam('YOU BUILT THIS.', v.w(5, 'built'), v.w(5, 'very'), scale=2, y=SLAM_Y, word='built')
        self.sound(v.w(5, 'built'), 'DSCYBSIT', 0.35, 0.0, 0.85)
        self.sound(v.w(5, 'built'), ic.boom(self.rng, 1.2), 0.4)
        self.tslam('VERY, VERY\nSURPRISED', v.w(5, 'surprised'), v.w(5, 'if'), scale=3, y=TOP_Y, word='surprised')
        self.tslam('IF THAT\nWENT WELL.', v.w(5, 'if'), v.w(5, 'but') if v.has(5, 'but') else v.bend(5),
                   scale=3, y=TOP_Y, color='red', word='if that went well')
        if v.has(5, 'optimist'):                             # "But look, I'm an optimist." (cut from later takes)
            self.poster_flash(v.w(5, 'im'), 'PDP14', fire=True)
            self.tslam("I'M AN OPTIMIST.", v.w(5, 'optimist'), v.bend(5), scale=2, y=SLAM_Y + 14, color='gold', word='optimist')
        # 6 ------------------------------------------------------------------------------------------
        self.sees_hears_lasers(6, v.w(6, 'sees'), v.w(6, 'hears'), v.w(6, 'it has'), v.w(6, 'lasers'))
        self.tslam('IT HAS\nLASERS', v.w(6, 'it has'), v.w(6, 'its'), scale=3, y=SLAM_Y - 18, color='red', word='has lasers')
        tw = v.w(6, 'its')
        self.shot(tw, self.r_whack, t0=tw, t1=v.bend(6))
        self.tslam('WHACK-A-MOLE.', v.w(6, 'whack'), v.bend(6), scale=3, y=TOP_Y, color='gold', word='whack')
        self.whack_times = [v.w(6, 'whack') + 0.05, v.w(6, 'mole') + 0.05, v.w(6, 'situation') + 0.1, v.w(6, 'situation') + 0.42]
        for tt in self.whack_times:
            self.sound(tt, 'DSPUNCH', 0.7)
            self.sound(tt, 'DSMETAL', 0.3, 0.0, 1.6)
        # 7 ------------------------------------------------------------------------------------------
        self.teabot(v.bstart(7), v.w(7, 'serves'), v.w(7, 'forever'), extra='cups', t_extra=v.w(7, 'which'), wide_again=v.w(7, 'which'))
        self.tslam('A PRETTY GOOD\nANALOGY FOR A\nLOT OF THINGS.', v.w(7, 'pretty'), v.bend(7), scale=2, y=TOP_Y, color='white', word='pretty good analogy')
        # 8 ------------------------------------------------------------------------------------------
        self.wrench(8, v.w(8, 'wrench'), v.w(8, 'thats'))
        tl = v.w(8, 'thats')
        self.shot(tl, self.r_textwall, t0=tl, collapse=v.w(8, 'you', 2))
        self.tslam('A VERY LONG-\nWINDED WAY\nOF SAYING:', v.w(8, 'long'), v.w(8, 'you', 2), scale=2, y=TOP_Y, word='long-winded')
        self.tslam('YOU HAVE\nA WRENCH.', v.w(8, 'you', 2), v.bend(8), scale=3, y=SLAM_Y - 30, color='gold', thud=0.6, shake=3, word='you have a wrench')
        # 9 ------------------------------------------------------------------------------------------
        self.montage(v.bstart(9), v.w(9, 'now'))
        self.tslam('WE ALMOST\nBROUGHT DOWN\nHUMANITY.', v.w(9, 'we'), v.w(9, 'now'), scale=2, y=SLAM_Y, word='we almost')
        self.footage(v.w(9, 'now'), 'cellroom', 0.05, rate=0.25, desc='first-person wrench')
        self.tslam("NOW WE'RE ITS\nONLY HOPE.", v.w(9, 'now'), v.w(9, 'two'), scale=2, y=TOP_Y, color='gold', thud=0.6, shake=3, word='now')
        self.sound(v.w(9, 'now'), ic.boom(self.rng, 1.5), 0.45)
        self.shot(v.w(9, 'those'), self.r_coin, t0=v.w(9, 'those'), land=v.bend(9) - 0.15)
        self.tslam('TWO SIDES OF\nTHE SAME COIN.', v.w(9, 'two'), v.bend(9), scale=2, y=SLAM_Y + 10, color='gold', word='two sides')
        self.sound(v.w(9, 'those'), coin_spin(v.bend(9) - v.w(9, 'those')), 0.3)
        # 10 -----------------------------------------------------------------------------------------
        self.end_card(10, v.w(10, 'play'), v.w(10, 'www'))
        self.tslam('~1 HOUR (±3X)', v.w(10, 'hour'), self.duration + 1, scale=2, y=SLAM_Y + 12, color='white', thud=0.4, shake=2, word='hour')

    # ------------------------------------------------------------ renderers (full frame, absolute times)
    def bg_texture(self, name, level):
        tex = self.A.wad.texture(name).idx
        ys, xs = np.mgrid[0:H, 0:W]
        return self.pal.cmap[level][tex[ys % tex.shape[0], xs % tex.shape[1]]]

    def fire_bottom(self, fb, tic, rows, key, dim=0, y1=H):
        fr = self.vf.fire_state(tic + 400, rows=rows, width=W, key=key, tall=True)
        cols = self.vf.fire_pal[fr]
        if dim:
            cols = self.pal.cmap[dim][cols]
        sel = fr > 2
        reg = fb[y1 - rows:y1]
        reg[sel] = cols[sel]

    def r_logo(self, t, tic, p):
        fb = np.zeros((H, W), np.uint8)
        self.fire_bottom(fb, tic, 250, 'tlogofire')
        y = 64
        if t < p['snap'] + 0.03:
            g = self.A.mdoom.scaled(2)
            blit(fb, g, W // 2 - g.w // 2, y, offsets=False)
        else:
            lg = self.A.logo
            x0, yl = W // 2 - lg.w // 2, y + 22
            u = clamp((t - p['snap'] - 0.03) / 0.12, 0, 1)
            for name, (g, px, py) in self.A.logo_parts.items():
                dx = int(-200 * (1 - u)) if name in ('p', '(') else (int(200 * (1 - u)) if name == ')' else 0)
                blit(fb, g, x0 + px + dx, yl + py, offsets=False)
            k = (t - p['snap'] - 0.03) / 0.3
            if k < 1:
                self.laser(fb, 0, yl + 66, W, yl + 66, 1 - k)
        return fb

    def r_ceo(self, t, tic, p):
        fb = self.bg_texture('STARTAN3', 24)
        self.fire_bottom(fb, tic, 170, 'tceofire', dim=10)
        sel, ts = p['first'], -9.0
        for t_, c in p['sels']:
            if t >= t_:
                sel, ts = c, t_
        age = t - ts
        looks = ['STFST01', 'STFTL00', 'STFST01', 'STFTR00']
        key = 'STFEVL0' if 0 <= age < 0.5 else looks[int(t * 3.4) % 4]
        g = self.well(sel, key).scaled(4)
        gy = 62
        gx = W // 2 - g.w // 2
        blit(fb, g, gx, gy, offsets=False)
        for (a, b_, c_, d) in ((gx - 2, gy - 2, gx + g.w + 2, gy), (gx - 2, gy + g.h, gx + g.w + 2, gy + g.h + 2),
                               (gx - 2, gy, gx, gy + g.h), (gx + g.w, gy, gx + g.w + 2, gy + g.h)):
            rect(fb, a, b_, c_, d, 161)
        name = getattr(self, 'ceo_labels', {'samwise': 'SAM\nALTMAN', 'mario': 'DARIO\nAMODEI'})[sel]
        for i, ln in enumerate(name.split('\n')):
            w = self.font.width(ln, 2)
            self.font.draw(fb, ln, CX - w // 2, gy + g.h + 8 + 22 * i, color='gold', scale=2)
        ty = gy + g.h + 58
        for i, ceo in enumerate(('samwise', 'mario') if p['first'] == 'samwise' else ('mario', 'samwise')):
            th = self.well(ceo, 'STFST01').scaled(2)
            tx = W // 2 - 6 - th.w if i == 0 else W // 2 + 6
            blit(fb, th, tx, ty, offsets=False)
            if ceo == sel:
                sk = self.A.skull[(tic // 8) % 2]
                blit(fb, sk, (tx - 22) if i == 0 else (tx + th.w + 2), ty + th.h // 2 - 10, offsets=False)
        return fb

    def r_posters(self, t, tic, p):
        fb = self.bg_texture('BROWN1' if not p.get('fire') else 'STARTAN3', 24)
        if p.get('fire'):                            # sunny but on fire
            self.fire_bottom(fb, tic, 260, 'tposterfire')
        for (tp, pid, dx, dy) in p['items']:
            if t < tp:
                break
            g = self.posters[pid].scaled(2)
            px, py = W // 2 - g.w // 2 + dx, 24 + dy
            age = (t - tp) * TICS
            if age < 2:
                gg = g.mapped(self.pal.white(7))
                blit(fb, gg, px, py, offsets=False)
            else:
                blit(fb, ic.Gfx(np.zeros_like(g.idx), g.mask), px + 5, py + 5, offsets=False)
                blit(fb, g, px, py, offsets=False)
        return fb

    def r_monitors(self, t, tic, p):
        vf = self.vf
        world = vf.vmon.copy()
        mx0, my0, mx1, my1 = vf.vmain
        rect(world, mx0 - 3, my0 - 3, mx1 + 3, my1 + 3, 100)
        rect(world, mx0 - 2, my0 - 2, mx1 + 2, my1 + 2, 106)
        rect(world, mx0, my0, mx1, my1, 0)
        c0, c1 = p['c0'], p['c1']
        u = clamp((t - c0) / max(0.1, c1 - c0), 0, 1)
        val = int(12 + 87 * (u ** 1.35))
        done = t >= c1
        lab = 'p(DOOM)'
        self.font.draw(world, lab, (mx0 + mx1) // 2 - self.font.width(lab) // 2, my0 + 6, color='gold')
        if not (done and int((t - c1) * TICS) % 16 >= 12):
            ic.draw_num(world, self.A.digits, '%d%%' % val, (mx0 + mx1) // 2, my0 + 18, 3)
        n = len(vf.veyes)
        zoom = p['zoom']
        for i, (x0, y0, x1, y1, rad) in enumerate(vf.veyes):
            te = zoom + (c1 - zoom) * (i / max(1, n - 1)) ** 0.85
            if t < te:
                continue
            rect(world, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0)
            pulse = max(0.0, 1 - (t - c1) / 0.6) if done else 0.0
            ic.draw_eye(world, (x0 + x1) / 2, (y0 + y1) / 2, rad * clamp((t - te) * TICS / 4, 0.15, 1), pulse)
        if t < zoom:
            return ic.place_view(world, 192, 192, 135, 140, 2)
        return ic.place_view(world, 192, 192, 135, 118, 1)

    def grid_bg(self, tic, col=(0, 80, 40)):
        fb = np.zeros((H, W), np.uint8)
        c1, c2 = self.c(*col), self.c(col[0] // 2, col[1] // 2, col[2] // 2)
        off = (tic // 2) % 12
        for y in range(off, H, 12):
            fb[y, :] = c2
        for x in range(0, W, 12):
            fb[:, x] = c2
        for y in range(off, H, 48):
            fb[y, :] = c1
        return fb

    def r_errbars(self, t, tic, p):
        """'plus or minus a factor of three': a confident dot with error bars that leave the building."""
        fb = self.grid_bg(tic)
        ax, ay0, ay1, bx1 = 26, 132, 400, 246
        rect(fb, ax, ay0, ax + 2, ay1, 92)
        rect(fb, ax, ay1, bx1, ay1 + 2, 92)
        self.font.draw(fb, 'WHEN AGI?', ax + 8, ay0 - 2, color='grey')
        self.font.draw(fb, 'YEAR', bx1 - 34, ay1 + 6, color='grey')
        for k in range(5):                             # tick marks
            x = ax + 30 + k * 44
            rect(fb, x, ay1 - 3, x + 1, ay1 + 5, 92)
        cx, cy = 150, 250
        u = smooth((t - p['t0']) / max(0.3, p['t1'] - p['t0']))
        half_w = int(12 + 420 * u ** 1.6)
        half_h = int(8 + 300 * u ** 1.6)
        red, hot = 176, 168
        rect(fb, cx - half_w, cy - 1, cx + half_w, cy + 2, red)
        rect(fb, cx - 1, cy - half_h, cx + 2, cy + half_h, red)
        for s in (-1, 1):
            rect(fb, cx + s * half_w - 1, cy - 8, cx + s * half_w + 2, cy + 9, red)
            rect(fb, cx - 8, cy + s * half_h - 1, cx + 9, cy + s * half_h + 2, red)
        rect(fb, cx - 3, cy - 3, cx + 4, cy + 4, hot)
        rect(fb, cx - 2, cy - 2, cx + 3, cy + 3, 4)
        return fb

    def cell_layout(self):
        return [(10 + c * 50, 34 + r * 106, 50, 104) for r in range(4) for c in range(5)]

    def r_cells(self, t, tic, p):
        fb = self.bg_texture('GRAY1', 25)
        for i, (x, y, cw, ch) in enumerate(self.cell_layout()):
            lit = t >= p['pops'][i]
            rect(fb, x + 1, y + 1, x + cw - 1, y + ch - 1, 96 if lit else 108)
            rect(fb, x + 1, y + ch - 6, x + cw - 1, y + ch - 1, 104)
            real = i < 10 and t >= p['reveal'] + 0.06 * i
            if real:
                remap(fb, x + 1, y + 1, x + cw - 1, y + ch - 1, self.pal.white(3))
                g = trimmed(self.A.sprite(PRISONERS[i][1])).scaled(2 if i < 10 else 1)
                k = (t - p['reveal'] - 0.06 * i) * TICS
                blit(fb, g if k >= 2 else g.mapped(self.pal.white(9)), x + cw // 2 - g.w // 2, y + ch - 5 - g.h, offsets=False)
            elif lit:
                s_ = self.vf.vsil[i].scaled(2)
                age = (t - p['pops'][i]) * TICS
                blit(fb, s_.solid(4) if age < 2 else s_, x + cw // 2 - s_.w // 2, y + ch - 5 - s_.h, offsets=False)
            for bx in range(x + 6, x + cw, 10):
                rect(fb, bx, y + 1, bx + 1, y + ch - 1, 88 if lit else 100)
                rect(fb, bx + 1, y + 1, bx + 2, y + ch - 1, 106)
        return fb

    def r_big(self, t, tic, p):
        fb = self.r_cells(t, tic, dict(pops=[0] * 20, reveal=-9))
        fb[:] = self.pal.cmap[18][fb]
        g = trimmed(self.A.sprite(PRISONERS[p['pid']][1])).scaled(4)
        y1 = 290
        yy, xx = np.mgrid[60:y1, 40:230]
        d = np.hypot((xx - 135) / 80.0, (yy - 80) / 190.0)
        pool = np.clip(13 - (d * 11), 0, 12).astype(int)
        reg = fb[60:y1, 40:230]
        for lv in range(1, 13):
            sel = pool == lv
            reg[sel] = self.pal.white(lv // 3)[reg[sel]]
        blit(fb, g, 135 - g.w // 2, y1 - g.h, offsets=False)
        return fb

    def r_papers(self, t, tic, p):
        """'I've read most of it' (a teetering stack) / 'I wrote some of it' (one paper pulled out)."""
        fb = self.r_cells(t, tic, dict(pops=[0] * 20, reveal=-9))
        fb[:] = self.pal.cmap[20][fb]
        paper, ink, edge = self.c(232, 228, 210), self.c(90, 90, 90), self.c(150, 140, 120)
        pulled = t >= p['pull']
        n = 22
        base, top = 300, 70
        sway = math.sin((t - p['t0']) * 5.0) * (5 if not pulled else 2)
        for i in range(n):
            frac = i / (n - 1)
            y = int(base - frac * (base - top))
            dx = int(sway * frac ** 1.5 + 3 * math.sin(i * 1.7))
            if pulled and i == 9:
                dx += int(220 * clamp((t - p['pull']) / 0.2, 0, 1))
            x0 = 135 - 52 + dx
            rect(fb, x0, y - 9, x0 + 104, y, paper)
            rect(fb, x0, y - 1, x0 + 104, y, edge)
            for k in range(3):
                rect(fb, x0 + 8, y - 7 + 2 * k, x0 + 96 - 9 * ((i + k) % 4), y - 6 + 2 * k, ink)
        if pulled and t - p['pull'] > 0.22:          # the paper he wrote, front and centre
            k = clamp((t - p['pull'] - 0.22) * TICS / 3, 0, 1)
            pw, ph = 214, 150
            x0, y0 = 135 - pw // 2, 52
            rect(fb, x0 + 5, y0 + 5, x0 + pw + 5, y0 + ph + 5, 0)
            rect(fb, x0, y0, x0 + pw, y0 + ph, paper)
            rect(fb, x0, y0, x0 + pw, y0 + 2, edge)
            inkt = self.ink_table(paper, self.c(30, 30, 30))
            for i, ln in enumerate(['CONCRETE', 'PROBLEMS IN', 'AI SAFETY', '(2016)']):
                sc = 2
                w = self.font.width(ln, sc)
                self.font.draw(fb, ln, 135 - w // 2, y0 + 14 + 26 * i, table=inkt, shadow=False, scale=sc)
            if k < 1:
                fb[y0:y0 + ph, x0:x0 + pw] = self.pal.white(int(8 * (1 - k)))[fb[y0:y0 + ph, x0:x0 + pw]]
        return fb

    def ink_table(self, paper, ink):
        """STCFN as printed text: the glyph outline becomes paper, the letter body ink."""
        t = np.arange(256, dtype=np.uint8)
        for g in self.font.g.values():
            for u in set(g.idx[g.mask].tolist()):
                t[u] = paper if self.pal.rgb[u][0] <= 118 else ink
        return t

    def r_footage(self, t, tic, p):
        clip = self.clips[p['clip']]
        lt = t - p['t0']
        fb = clip.frame(p['off'] + lt * p['rate'])
        if p.get('zoom'):
            k, fx, fy = p['zoom']
            kk = 2 if lt < 0.12 else k
            fb = zoom_view(fb, fx, fy, kk, H)
            if lt < 0.08:
                fb[:] = self.pal.white(10)[fb]
        return fb

    def r_hunters(self, t, tic, p):
        """'We're doing it iteratively': V1, V2, V3."""
        fb = self.clips['core'].frame(1.2 + (t - p['t0']) * 0.4)
        fb[:] = self.pal.cmap[16][fb]
        floor = 330
        specs = [(1, 42), (2, 106), (3, 196)]
        for i, (sc, cx) in enumerate(specs):
            if t < p['t0'] + 0.12 * i:
                continue
            g = trimmed(self.A.hunt['A1']).scaled(sc)
            blit(fb, g, cx - g.w // 2, floor - g.h, offsets=False)
            lab = 'V%d' % (i + 1)
            w = self.font.width(lab, 2)
            self.font.draw(fb, lab, cx - w // 2, floor + 6, color='gold', scale=2)
        return fb

    def r_camera(self, t, tic, p):
        fb = self.clips['turret'].frame(1.0 + t * 0.2)
        fb[:] = self.pal.cmap[16][fb]
        cy = 130
        lt = t - p['t0']
        g = self.A.cam['AB' if (tic // 9) % 2 == 0 else 'AA'].scaled(4)
        blit(fb, g, CX - g.w // 2, cy - g.h // 2, offsets=False)
        k = clamp(1 - lt / 0.5, 0, 1)
        bw, bh = int(g.w * 0.62 + 80 * k), int(g.h * 0.62 + 80 * k)
        x0, y0, x1, y1 = CX - bw // 2 - 10, cy - bh // 2 + 8, CX + bw // 2 - 10, cy + bh // 2 + 8
        for (ax, ay, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            rect(fb, min(ax, ax + dx * 16), ay - (1 if dy < 0 else 0), max(ax, ax + dx * 16), ay + 2 - (1 if dy < 0 else 0), 176)
            rect(fb, ax - (1 if dx < 0 else 0), min(ay, ay + dy * 16), ax + 2 - (1 if dx < 0 else 0), max(ay, ay + dy * 16), 176)
        if (tic // 12) % 2 == 0:
            rect(fb, 10, TOP_CLEAR + 8, 20, TOP_CLEAR + 18, 176)
            self.font.draw(fb, 'REC', 24, TOP_CLEAR + 8, color='white', scale=2)
        return fb

    def r_hal(self, t, tic, p):
        lt = t - p['t0']
        fb = self.clips['hal'].frame(5.5 + lt * 0.6)
        fb[:] = self.pal.cmap[18][fb]
        fr = 'A' if lt < 0.3 else 'B' if lt < 0.55 else 'C'
        g = self.A.sprite('H300%s1' % fr).scaled(4)
        cy = 130
        blit(fb, g, CX - g.w // 2, cy - g.h // 2, offsets=False)
        if fr == 'C':
            ey = cy - g.h // 2 + (31 * g.h) // 64
            remap(fb, CX - 50, ey - 40, CX + 50, ey + 40, self.pal.toward((255, 0, 0), 3))
        return fb

    def r_laser(self, t, tic, p):
        fb = self.clips['inferminator'].frame(6.0)
        fb[:] = self.pal.cmap[20][fb]
        cy = 128
        key = 'E1' if t < p['beam'] else 'F1'
        g = self.A.hunt[key].scaled(4)
        gy = cy - g.h // 2 + 14
        self.vf.visor_glow(fb, key, CX - g.w // 2, gy, 4, 7)
        blit(fb, g, CX - g.w // 2, gy, offsets=False)
        if t < p['beam']:
            k = clamp((t - p['t0']) / max(0.15, p['beam'] - p['t0']), 0, 1)
            gap = int(110 * (1 - k)) + 26
            for side in (-1, 1):
                for j in range(3):
                    x = CX + side * (gap + j * 9)
                    for d in range(7):
                        rect(fb, x - side * d, cy - 7 + d, x - side * d + 2, cy - 6 + d, 176)
                        rect(fb, x - side * d, cy + 7 - d, x - side * d + 2, cy + 8 - d, 176)
            w = self.font.width('LOCKED', 2)
            remap(fb, CX - w // 2 - 4, cy + 18, CX + w // 2 + 4, cy + 38, self.pal.cmap[24])
            self.font.draw(fb, 'LOCKED', CX - w // 2, cy + 21, scale=2, color='red' if (tic // 4) % 2 else 'white')
        else:
            self.laser(fb, 0, cy, W, cy, clamp(1 - (t - p['beam']) / 0.35, 0, 1))
        return fb

    def r_expo(self, t, tic, p):
        """'It's getting better exponentially': the curve leaves the chart, the Inferminator riding it."""
        fb = self.grid_bg(tic, (90, 20, 20))
        ax, ay0, ay1, bx1 = 22, 80, 400, 250
        rect(fb, ax, ay0, ax + 2, ay1, 92)
        rect(fb, ax, ay1, bx1, ay1 + 2, 92)
        self.font.draw(fb, 'CAPABILITY', ax + 6, ay0 - 12, color='grey')
        self.font.draw(fb, 'TIME', bx1 - 32, ay1 + 6, color='grey')
        t0, ts = p['t0'], p['shoot']
        prog = clamp((t - t0) / max(0.3, ts - t0), 0, 1)
        xs = np.arange(ax + 2, bx1)
        u = (xs - ax) / (bx1 - ax)
        ys = ay1 - 6 - (np.exp(u * 5.2) - 1) / (math.exp(5.2) - 1) * (ay1 - ay0) * 1.0
        head = int(len(xs) * (0.25 + 0.75 * prog))
        lift = 0
        if t > ts:
            lift = int(900 * (t - ts) ** 1.6)
        pts = []
        for i in range(head):
            y = int(ys[i]) - (lift if i > head - 40 else 0) * max(0, i - (head - 40)) // 40
            if -10 < y < H:
                rect(fb, xs[i], y - 1, xs[i] + 1, y + 2, 176)
                rect(fb, xs[i], y - 3, xs[i] + 1, y - 1, self.pal.cmap[8][176])
            pts.append((int(xs[i]), y))
        # the Inferminator surfs the curve: it rides up to y~150, then gets flung off the top
        ride = [q for q in pts if q[1] >= 190]
        rx, ry = ride[-1] if ride else pts[0]
        if t > ts:
            ry -= int(700 * (t - ts) ** 1.5)
        g = self.A.hunt['B7'].scaled(2)
        blit(fb, g, rx - g.w // 2, ry - g.h + 4, offsets=False)
        return fb

    def r_whack(self, t, tic, p):
        """'A whack-a-mole situation': cameras pop out of holes, the wrench bonks them."""
        flat = self.A.wad.flat('FLOOR4_8')
        ys, xs = np.mgrid[0:H, 0:W]
        fb = self.pal.cmap[14][flat[ys % 64, xs % 64]]
        holes = [(50, 150), (135, 150), (220, 150), (92, 250), (178, 250), (50, 350), (135, 350), (220, 350), (92, 440), (178, 440)]
        rng = np.random.default_rng(tic // 7)
        for (hx, hy) in holes:
            yy, xx = np.mgrid[hy - 8:hy + 9, hx - 28:hx + 29]
            m = ((xx - hx) / 28.0) ** 2 + ((yy - hy) / 8.0) ** 2 <= 1
            reg = fb[hy - 8:hy + 9, hx - 28:hx + 29]
            reg[m] = 0
        bonks = getattr(self, 'whack_times', [])
        targets = [1, 4, 0, 2]
        for j, (hx, hy) in enumerate(holes):
            up = (math.sin(t * 7 + j * 1.9) > 0.2)
            bonked = None
            for k, tb in enumerate(bonks):
                if targets[k % len(targets)] == j and tb <= t < tb + 0.5:
                    bonked, up = t - tb, True
            if not up:
                continue
            g = self.A.sprite('CPCBA0' if bonked is not None else 'CPCAA0').scaled(2)
            rise = 1.0 if bonked is None else 1 - clamp((bonked - 0.2) / 0.3, 0, 1)
            gh = int(g.h * rise)
            if gh <= 0:
                continue
            sub = ic.Gfx(g.idx[:gh], g.mask[:gh])
            blit(fb, sub, hx - g.w // 2, hy - gh + 2, offsets=False)
            if bonked is not None and bonked < 0.25:
                for (sx, sy) in ((-20, -40), (18, -46), (0, -60)):
                    rect(fb, hx + sx - 1, hy + sy - 4, hx + sx + 2, hy + sy + 5, 231)
                    rect(fb, hx + sx - 4, hy + sy - 1, hx + sx + 5, hy + sy + 2, 231)
        wr = self.A.wrench.scaled(3)                     # the wrench swings down on the current target
        k = len([tb for tb in bonks if tb <= t]) - 1
        if 0 <= k:
            hx, hy = holes[targets[k % len(targets)]]
            a = t - bonks[k]
            wy = hy - 110 + int(40 * clamp(a / 0.08, 0, 1)) - int(30 * clamp((a - 0.15) / 0.3, 0, 1))
            blit(fb, wr, hx + 4, wy, offsets=False)
        return fb

    def r_teabot(self, t, tic, p):
        lt = t - p['t0']
        fb = self.clips['teabot'].frame(0.4 + lt * 0.5)
        wide = t < p['forever'] or (p.get('wide_again') and t >= p['wide_again'])
        if not wide:
            u = clamp((t - p['forever']) / 2.0, 0, 1)
            fb = zoom_view(fb, int(118 + 30 * u), 250, 2, H)
        if p.get('extra') == 'hearts' and t >= p['t_extra']:
            rng = np.random.default_rng(55)
            cols = [(176, 168), (178, 170), (19, 16), (173, 168)]
            for k in range(26):
                ts = p['t_extra'] + k * 0.07 + rng.uniform(0, 0.05)
                a = t - ts
                if a < 0 or a > 2.4:
                    continue
                x = int(rng.uniform(70, 200) + 6 * math.sin(a * 4 + k))
                y = int(rng.uniform(250, 330) - rng.uniform(40, 80) * a)
                heart(fb, self.pal, x, y, 2 if k % 3 else 3, cols[k % 4], int(clamp((a - 1.6) / 0.8, 0, 1) * 22))
        if p.get('extra') == 'cups' and t >= p['t_extra']:
            a = t - p['t_extra']
            pile = self.A.sprite('TCPLA0')
            sc = 2 + min(2, int(a / 1.1))
            g = pile.scaled(sc)
            blit(fb, g, 70 - g.w // 2, 300 - g.h, offsets=False)
            cup = self.A.sprite('TCUPA0').scaled(2)
            rng = np.random.default_rng(3)
            for k in range(40):
                tk = k * 0.09 + rng.uniform(0, 0.05)
                if a < tk:
                    break
                fy = int(-20 + 520 * (a - tk) ** 2)
                if fy < 300 - g.h + 10:
                    blit(fb, cup, int(70 + rng.uniform(-60, 60)), fy, offsets=False)
        return fb

    def r_wrench(self, t, tic, p):
        fb = np.zeros((H, W), np.uint8)
        flat = self.A.wad.flat('FLOOR4_8')
        for k in range(200):                           # a lit floor receding below them, fire beyond
            y = 280 + k
            if y >= H:
                break
            z = 2400.0 / (k + 8)
            u = ((np.arange(W) - W / 2) * z / 140).astype(int) & 63
            fb[y] = self.pal.cmap[int(clamp(26 - k * 0.09, 12, 26))][flat[int(z) & 63, u]]
        self.fire_bottom(fb, tic, 60, 'twrenchfire', dim=6)
        grin = t >= p['grin']
        looks = ['STFST01', 'STFTL00', 'STFST01', 'STFTR00']
        key = 'STFEVL0' if grin else looks[int(t * 3) % 4]
        wy = 40
        for i, ceo in enumerate(('samwise', 'mario') if self.ceo == 'sam' else ('mario', 'samwise')):
            g = self.well(ceo, key).scaled(3)
            blit(fb, g, (135 - g.w - 3) if i == 0 else (135 + 3), wy, offsets=False)
        wr = self.vf.vwrench
        wr = ic.Gfx(wr.idx[::4, ::4], wr.mask[::4, ::4]).scaled(3)
        land = wy + 96 + 14
        if t >= p['drop']:
            if t < p['land']:
                u = (t - p['drop']) / (p['land'] - p['drop'])
                y = -wr.h + (land + wr.h) * u * u
            else:
                a = t - p['land']
                y = land - (max(0.0, 6 * (1 - ((a - 0.1) / 0.1) ** 2)) if a < 0.2 else 0)
            blit(fb, wr, 135 - wr.w // 2, int(y), offsets=False)
        return fb

    def r_textwall(self, t, tic, p):
        """'A very long-winded way of saying': a wall of tiny text that collapses."""
        fb = np.zeros((H, W), np.uint8)
        lines = ic.wrap_px(self.font, TEXTWALL * 3, W - 12)
        scroll = (t - p['t0']) * 140
        u = clamp((t - p['collapse'] + 0.25) / 0.25, 0, 1)
        grey = self.font.trans['grey']
        for i, ln in enumerate(lines):
            y = 8 + i * 10 - scroll % (10 * len(lines) // 3)
            y = H / 2 + (y - H / 2) * (1 - u)
            if -10 < y < H:
                self.font.draw(fb, ln, 6, int(y), table=grey if u == 0 else self.pal.cmap[int(u * 20)][grey], shadow=False)
        if t >= p['collapse']:
            fb[:] = 0
            wr = self.A.wrench.scaled(4)
            blit(fb, wr, 135 - wr.w // 2, 60, offsets=False)
            self.fire_bottom(fb, tic, 180, 'ttextfire', dim=4)
        return fb

    def r_montage(self, t, tic, p):
        fn = p['items'][0][1]
        for tt, f_ in p['items']:
            if t >= tt:
                fn = f_
        return fn(tic)

    def r_coin(self, t, tic, p):
        """'Two sides of the same coin': Samwise heads, Mario tails."""
        fb = np.zeros((H, W), np.uint8)
        self.fire_bottom(fb, tic, 200, 'tcoinfire', dim=8)
        rng = np.random.default_rng(4)
        for k in range(60):
            fb[int(rng.integers(0, 300)), int(rng.integers(0, W))] = [80, 96, 104][k % 3]
        lt = t - p['t0']
        spin = 9.0 * lt - 2.4 * lt * lt if lt < 1.8 else 9.0 * 1.8 - 2.4 * 1.8 * 1.8 + 0.4 * (lt - 1.8)
        c = math.cos(spin * math.pi)
        cx, cy, R = 135, 140, 72
        wscale = max(0.06, abs(c))
        side = 'samwise' if c >= 0 else 'mario'
        ys, xs = np.mgrid[cy - R:cy + R + 1, cx - R:cx + R + 1]
        dx = (xs - cx) / (R * wscale)
        dy = (ys - cy) / R
        d = dx ** 2 + dy ** 2
        gold, rim, dark = self.c(215, 187, 67), self.c(175, 123, 31), self.c(115, 43, 0)
        reg = fb[cy - R:cy + R + 1, cx - R:cx + R + 1]
        reg[d <= 1] = rim
        reg[d <= 0.86] = gold
        face = self.faces[side]['STFEVL0' if lt > 1.6 else 'STFST01']
        fw = max(2, int(face.w * 4 * wscale))
        g = ic.Gfx(face.idx, face.mask).scaled(4).resized(fw, face.h * 4)
        fx0, fy0 = cx - fw // 2, cy - g.h // 2
        sub = (((np.arange(g.h)[:, None] + fy0 - cy) / (R * 0.8)) ** 2 + ((np.arange(fw)[None, :] + fx0 - cx) / (R * 0.8 * wscale)) ** 2) <= 1
        gg = ic.Gfx(g.idx, g.mask & sub)
        blit(fb, gg, fx0, fy0, offsets=False)
        edge = (d > 0.86) & (d <= 1)
        reg[edge & (dx > 0)] = dark
        return fb

    def r_end(self, t, tic, p):
        fb = np.zeros((H, W), np.uint8)
        self.fire_bottom(fb, tic, 250, 'tendfire')
        lg = self.A.logo
        blit(fb, lg, CX - lg.w // 2, 64, offsets=False)
        return fb

    # ------------------------------------------------------------ composition
    def shot_at(self, t):
        cur = self.shots[0]
        for s_ in self.shots:
            if t >= s_['t0']:
                cur = s_
        return cur

    def layer(self, f):
        if f in self._cache:
            return self._cache[f]
        t = f / FPS
        tic = int(math.floor(t * TICS + 1e-6))
        s_ = self.shot_at(t)
        fb = s_['fn'](t, tic, dict(s_['p'], t0=s_['p'].get('t0', s_['t0'])))
        if fb.base is not None:
            fb = fb.copy()
        for (t0, dur, amp) in self.shakes:
            if t0 <= t < t0 + dur:
                r = np.random.default_rng(tic * 977 + 3)
                dx, dy = (int(v) for v in r.integers(-amp, amp + 1, 2))
                fb = ic.shift(fb, dx, dy)
        for (t0, kind) in self.flashes:
            k = int(round((t - t0) * TICS))
            if 0 <= k < 2:
                fb[:] = self.k_white
            elif 2 <= k < 10:
                fb[:] = self.pal.white(int(13 - (k - 2) * 1.6))[fb]
        for (t0, dur, col, strength) in self.tints:
            if t0 <= t < t0 + dur:
                lvl = int(round(strength * (1 - (t - t0) / dur)))
                if lvl > 0:
                    fb[:] = self.pal.toward(col, lvl)[fb]
        if len(self._cache) > 50:
            self._cache = {}
        self._cache[f] = fb
        return fb

    def frame(self, f, slams=True):
        t = f / FPS
        tic = int(math.floor(t * TICS + 1e-6))
        s_ = self.shot_at(t)
        fb = self.layer(f).copy()
        if s_['trans'] == 'melt':
            ticks = tic - int(math.floor(s_['t0'] * TICS + 1e-6))
            f0 = int(math.ceil(s_['t0'] * FPS - 1e-6))
            if 0 <= ticks < 60 and f0 > 0:
                old = self.layer(f0 - 1)
                fb = ic.melt(old, fb, ticks, seed=int(s_['t0'] * 100))
        if slams:
            for sl in self.slams:                      # slams sit on top of melts, so they read from frame one
                sl.draw(fb, t, self.font, self.pal, H)
        return fb

    def rgb(self, f, slams=True):
        return self.pal.pals[0][self.frame(f, slams)]

    def text_rgba(self, f):
        """The slams alone as straight RGBA (Doom-pixel size).  Drawn twice, over black and over white:
        glyphs, shadows and rules come out the same on both (opaque); a plate darkens through COLORMAP,
        which is black at the alpha the white copy reveals; anything untouched is transparent."""
        t = f / FPS
        live = [sl for sl in self.slams if sl.t0 <= t < sl.t1]
        out = np.zeros((H, W, 4), np.uint8)
        if not live:
            return out
        k = []
        for bg in (0, self.k_white):
            fb = np.full((H, W), bg, np.uint8)
            for sl in live:
                sl.draw(fb, t, self.font, self.pal, H)
            k.append(self.pal.pals[0][fb].astype(np.float32))
        lo, hi = k
        white = self.pal.pals[0][self.k_white].astype(np.float32)
        a = 1.0 - np.clip((hi - lo).mean(2) / white.mean(), 0, 1)
        a[a < 0.02] = 0
        col = np.where(a[..., None] > 0, lo / np.maximum(a, 1e-3)[..., None], 0)
        out[..., :3] = np.clip(col + 0.5, 0, 255).astype(np.uint8)
        out[..., 3] = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
        return out

    # ------------------------------------------------------------ audio
    def audio_timed(self, vo):
        """Music bed (At Doom's Gate) ducked under the real voice and the SFX; returns (bed, sfx)."""
        n = int(math.ceil(self.duration * SR)) + 1
        sfx = np.zeros((n, 2), np.float32)
        for (t, x, gain, pan) in self.sfx:
            ic.place(sfx, t, x, gain, pan)
        mus = self.A.music
        m = mus[:n].copy()
        while len(m) < n:
            m = np.concatenate([m, mus[:n - len(m)]])
        rms = float(np.sqrt(np.mean(mus[:SR * 30] ** 2)))
        m *= 0.11 / max(rms, 1e-4)
        tt = np.arange(n) / SR
        m *= np.clip((self.duration - tt) / 1.2, 0, 1)[:, None]
        vo = vo[:n] if len(vo) >= n else np.concatenate([vo, np.zeros((n - len(vo), 2), np.float32)])
        bb, aa = ic.signal.butter(1, 3.0, fs=SR)
        venv = ic.signal.lfilter(bb, aa, np.abs(vo.mean(1)))
        senv = ic.signal.lfilter(bb, aa, np.abs(sfx).max(1))
        duck = (1.0 - 0.5 * np.clip(venv / 0.04, 0, 1)) * (1.0 - 0.35 * np.clip(senv / 0.15, 0, 1))
        m *= duck[:, None]
        return m, sfx


def coin_spin(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 18 * np.exp(-t * 1.2) + 2
    ph = np.cumsum(rate) / SR
    ring = np.sin(2 * np.pi * 3200 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * ph))) * np.exp(-t * 0.8) * 0.3
    return ring.astype(np.float32)


def load_vo(vo):
    src = vo.source
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy(), src


def has_video(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0',
                          str(path)], capture_output=True, text=True).stdout
    return 'video' in out


class Keyer:
    """Chroma-keys the green-screen performance (green-dominance alpha, despill, garbage matte) and
    places him in roughly the bottom 45% of the 1080x1920 frame, centred."""

    CROP = (0, 116, 1080, 1704)        # drop the screen's top bar and the desk edge
    SCALE_W, SCALE_H = 853, 1346

    def __init__(self, src):
        x, y, w, h = self.CROP
        self.proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(src), '-an', '-vf',
                                      'crop=%d:%d:%d:%d,scale=%d:%d' % (w, h, x, y, self.SCALE_W, self.SCALE_H),
                                      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        m = Image.new('L', (self.SCALE_W, self.SCALE_H), 255)
        d = ImageDraw.Draw(m)
        Wm, Hm = self.SCALE_W, self.SCALE_H
        d.rectangle((0, 0, Wm, int(Hm * 0.16)), fill=0)                        # above his head: the screen's top bar
        d.polygon([(0, Hm * 0.66), (int(Wm * 0.22), Hm * 0.78), (int(Wm * 0.22), Hm), (0, Hm)], fill=0)
        d.polygon([(Wm, Hm * 0.66), (int(Wm * 0.78), Hm * 0.78), (int(Wm * 0.78), Hm), (Wm, Hm)], fill=0)
        self.mask = np.asarray(m.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
        self.last = None
        self.x0 = (W * UP - self.SCALE_W) // 2
        self.y0 = H * UP - self.SCALE_H

    def next(self):
        n = self.SCALE_W * self.SCALE_H * 3
        buf = self.proc.stdout.read(n)
        if len(buf) == n:
            a = np.frombuffer(buf, np.uint8).reshape(self.SCALE_H, self.SCALE_W, 3).astype(np.float32)
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            mx = np.maximum(r, b)
            alpha = (1 - np.clip((g - mx - 10) / 24.0, 0, 1)) * self.mask
            a[..., 1] = np.minimum(g, mx + 4)
            self.last = (a, alpha[..., None])
        return self.last

    def over(self, big):
        k = self.next()
        if k is None:
            return big
        rgb, al = k
        reg = big[self.y0:, self.x0:self.x0 + self.SCALE_W].astype(np.float32)
        big[self.y0:, self.x0:self.x0 + self.SCALE_W] = (reg * (1 - al) + rgb * al + 0.5).astype(np.uint8)
        return big


def render_timed(tp, broll_video, preview_video, src):
    nframes = int(math.ceil(tp.duration * FPS - 1e-6))
    common = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-profile:v', 'high', '-level:v', '4.1',
              '-g', str(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an']
    e1 = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                           '-vf', 'scale=%d:%d:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p' % (W * UP, H * UP),
                           '-crf', '16', *common, str(broll_video)], stdin=subprocess.PIPE)
    e2 = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W * UP, H * UP), '-r', str(FPS), '-i', '-',
                           '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-crf', '18', *common, str(preview_video)],
                          stdin=subprocess.PIPE)
    key = Keyer(src) if has_video(src) else None     # an audio-only take has no performance to key in
    for f in range(nframes):
        rgb = tp.rgb(f)
        e1.stdin.write(rgb.tobytes())
        big = np.repeat(np.repeat(rgb, UP, 0), UP, 1)
        e2.stdin.write((key.over(big) if key else big).tobytes())
        if f % 300 == 0:
            print('    frame %d/%d' % (f, nframes), flush=True)
    for e in (e1, e2):
        e.stdin.close()
        if e.wait() != 0:
            raise SystemExit('ffmpeg failed')
    if key:
        key.proc.stdout.close()
        key.proc.wait()


def render_layers(tp, base, audio=None):
    """The film split for compositing over the keyed presenter: <base>-textless.mp4 (the B-roll with no
    slams, same timing; carries `audio` if given), <base>-text-alpha.mov (the slams alone, ProRes 4444
    with straight alpha) and <base>-text-green.mp4 (the slams over pure green, for keyers)."""
    nframes = int(math.ceil(tp.duration * FPS - 1e-6))
    big = 'scale=%d:%d:flags=neighbor:out_color_matrix=bt709:out_range=tv' % (W * UP, H * UP)
    tags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
    h264 = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-profile:v', 'high', '-level:v', '4.1', '-g', str(FPS * 2), *tags, '-an']
    raw = lambda fmt: ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-']
    textless = SCRATCH / (base.name + '-textless-video.mp4')
    e_plain = subprocess.Popen(raw('rgb24') + ['-vf', big + ',format=yuv420p', '-crf', '16', *h264, str(textless)], stdin=subprocess.PIPE)
    e_alpha = subprocess.Popen(raw('rgba') + ['-vf', big + ',format=yuva444p10le', '-c:v', 'prores_ks', '-profile:v', '4444', '-vendor', 'apl0',
                                             '-alpha_bits', '16', *tags, '-an', str(base) + '-text-alpha.mov'], stdin=subprocess.PIPE)
    e_green = subprocess.Popen(raw('rgb24') + ['-vf', big + ',format=yuv420p', '-crf', '14', *h264, str(base) + '-text-green.mp4'], stdin=subprocess.PIPE)
    green = np.array([0, 255, 0], np.float32)
    for f in range(nframes):
        e_plain.stdin.write(tp.rgb(f, slams=False).tobytes())
        t = tp.text_rgba(f)
        e_alpha.stdin.write(t.tobytes())
        a = t[..., 3:].astype(np.float32) / 255
        e_green.stdin.write((t[..., :3] * a + green * (1 - a) + 0.5).astype(np.uint8).tobytes())
        if f % 300 == 0:
            print('    layers frame %d/%d' % (f, nframes), flush=True)
    for e in (e_plain, e_alpha, e_green):
        e.stdin.close()
        if e.wait() != 0:
            raise SystemExit('ffmpeg failed')
    out = Path(str(base) + '-textless.mp4')
    if audio:
        mux(textless, audio, out)
    else:
        textless.replace(out)
    print('  wrote', out, str(base) + '-text-alpha.mov', str(base) + '-text-green.mp4')


def word_check_sheet(tp, mp4, path):
    """Frames grabbed from the final preview at slam words: each tile shows the word it should match."""
    tiles = []
    for c in tp.cues:
        if c['kind'] != 'slam':
            continue
        t = c['t'] + 0.2
        out = SCRATCH / 'wc.png'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.3f' % t, '-i', str(mp4), '-frames:v', '1', str(out)], check=True)
        tiles.append((c, Image.open(out).convert('RGB').resize((W, H), Image.LANCZOS)))
    cols = 10
    sheet = Image.new('RGB', (cols * (W + 6) + 6, -(-len(tiles) // cols) * (H + 32) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (c, im) in enumerate(tiles):
        x, y = 6 + (k % cols) * (W + 6), 6 + (k // cols) * (H + 32)
        sheet.paste(im, (x, y + 26))
        d.text((x, y), '%.2fs "%s"' % (c['t'], (c.get('word') or '')[:24]), fill=(255, 220, 80))
        d.text((x, y + 12), c['text'][:34], fill=(200, 200, 200))
    sheet.save(path)


def timed_keyframes(tp, path):
    tiles = []
    for b in tp.vo.beats:
        for u in (0.15, 0.5, 0.85):
            t = b['start'] + (b['end'] - b['start']) * u
            tiles.append((b['beat'], t, tp.rgb(int(t * FPS))))
    cols = 10
    sheet = Image.new('RGB', (cols * (W + 6) + 6, -(-len(tiles) // cols) * (H + 20) + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (bn, t, rgb) in enumerate(tiles):
        x, y = 6 + (k % cols) * (W + 6), 6 + (k // cols) * (H + 20)
        sheet.paste(Image.fromarray(rgb), (x, y + 14))
        d.text((x, y), 'beat %d  t=%.2fs' % (bn, t), fill=(220, 220, 220))
    sheet.save(path)


def build_timed(A, ceos, preview_only=False, take=None, layers=False):
    for d in (TIMED, REVIEW_T, SCRATCH):
        d.mkdir(parents=True, exist_ok=True)
    S = Shared(A)
    for ceo in ceos:
        tp = TimedPromo(A, ceo, S, take)
        tag = ceo + ('-' + take if take else '')        # file names: the original take keeps its old names
        print('%s: %.3fs, %d shots, %d slams' % (tag, tp.duration, len(tp.shots), len(tp.slams)))
        timed_keyframes(tp, REVIEW_T / ('keyframes-%s.png' % tag))
        cues = sorted(tp.cues, key=lambda c: c['t'])
        (TIMED / ('pdoom-promo-%s-cues.json' % tag)).write_text(json.dumps(dict(
            generator='scripts/build-promo.py --vo' + (' --take ' + take if take else ''), ceo=ceo, source=str(tp.vo.source),
            duration_s=tp.duration, fps=FPS, width=W * UP, height=H * UP,
            key_text_band_px=[TOP_CLEAR * UP, 262 * UP],
            beats=[dict(beat=b['beat'], start=b['start'], end=b['end'], text=b['text']) for b in tp.vo.beats],
            shots=[dict(t=round(s_['t0'], 3), scene=s_['fn'].__name__[2:], trans=s_['trans']) for s_ in tp.shots],
            cues=cues), indent=1) + '\n')
        if preview_only:
            continue
        if layers:                                     # just the compositing layers, next to the existing films
            wav = TIMED / ('pdoom-promo-%s-music-sfx.wav' % tag)
            render_layers(tp, TIMED / ('pdoom-promo-%s' % tag), wav if wav.exists() else None)
            continue
        vo, src = load_vo(tp.vo)
        bed, sfx = tp.audio_timed(vo)
        n = len(bed)
        vo = vo[:n] if len(vo) >= n else np.concatenate([vo, np.zeros((n - len(vo), 2), np.float32)])
        g = 10 ** ((-24.0 - loudness(bed + sfx)) / 20)
        bed, sfx = bed * g, sfx * g
        gv = 10 ** ((-16.0 - loudness(vo)) / 20)
        prev = vo * gv + bed + sfx
        a = np.abs(prev)
        knee, ceil = 0.55, 0.84                        # AAC overshoots: keep true peaks under -1 dBFS
        over = a > knee
        prev[over] = np.sign(prev[over]) * (knee + (ceil - knee) * np.tanh((a[over] - knee) / (ceil - knee)))
        nsamp = int(round(tp.duration * SR))
        stem_b, stem_s, stem_p = [(x[:nsamp]).copy() for x in (bed + sfx, sfx, prev)]
        name = 'pdoom-promo-%s' % tag
        ic.write_wav(TIMED / (name + '-music-sfx.wav'), stem_b)
        ic.write_wav(TIMED / (name + '-sfx.wav'), stem_s)
        wp = SCRATCH / (name + '-preview.wav')
        ic.write_wav(wp, stem_p)
        vb, vp = SCRATCH / (name + '-broll-video.mp4'), SCRATCH / (name + '-preview-video.mp4')
        render_timed(tp, vb, vp, src)
        broll, preview = TIMED / (name + '.mp4'), TIMED / (name + '-preview.mp4')
        mux(vb, TIMED / (name + '-music-sfx.wav'), broll)
        mux(vp, wp, preview)
        for src_ in (broll, preview):
            share_copy(src_, src_.with_name(src_.stem + '-share.mp4'), limit_mb=26.0, copy_audio=True)
        mp4_slam_sheet(tp, broll, REVIEW_T / ('slams-%s.png' % tag))
        word_check_sheet(tp, preview, REVIEW_T / ('wordcheck-%s.png' % tag))
        print('  wrote', broll, preview)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--layout', choices=['presenter', 'fullframe', 'all'], default='all')
    ap.add_argument('--durations', help='ten comma-separated beat lengths in seconds (default: from word counts)')
    ap.add_argument('--preview', action='store_true', help='review sheets only, no encode')
    ap.add_argument('--vo', choices=['sam', 'mario', 'both'],
                    help='build the full-frame films timed to the recorded voiceovers (doom-web/local/promo/vo/) into promo/timed/')
    ap.add_argument('--take', help='with --vo: use vo/<ceo>-<take>-timing.json (scripts/promo-vo-timing.py) and its audio')
    ap.add_argument('--layers', action='store_true',
                    help='with --vo: write only <film>-textless.mp4, <film>-text-alpha.mov (ProRes 4444) and <film>-text-green.mp4, '
                         'so the slams can sit on top of the keyed presenter')
    args = ap.parse_args()
    if args.vo:
        A = PromoAssets()
        build_timed(A, ['sam', 'mario'] if args.vo == 'both' else [args.vo], preview_only=args.preview, take=args.take, layers=args.layers)
        return
    durations = [float(x) for x in args.durations.split(',')] if args.durations else None
    if durations and len(durations) != len(BEATS):
        raise SystemExit('--durations needs %d values' % len(BEATS))
    for d in (OUT, OUT / 'beats', OUT / 'beats' / 'fullframe', REVIEW, SCRATCH):
        d.mkdir(parents=True, exist_ok=True)
    A = PromoAssets()
    layouts = ['presenter', 'fullframe'] if args.layout == 'all' else [args.layout]
    info = {}
    gain = None
    for lay in layouts:
        promo = Promo(A, lay, durations)
        print('%s: %.2fs; beats %s' % (lay, promo.duration, ' '.join('%d:%.1f' % (b.id, b.dur) for b in promo.beats)))
        keyframe_sheet(promo, REVIEW / ('keyframes-%s.png' % lay))
        if lay == 'presenter':
            keyframe_sheet(promo, REVIEW / 'layout-check-presenter.png', shade=True)
        info[lay] = promo
        if args.preview:
            continue
        mix = promo.audio(music=True)
        if gain is None:                            # one gain for every file so the stems line up: ~-24 LUFS with music
            gain = 10 ** ((-24.0 - loudness(mix)) / 20)
        mix, dry = mix * gain, promo.audio(music=False) * gain
        peak = max(float(np.max(np.abs(mix))), float(np.max(np.abs(dry))), 1e-6)
        if peak > 0.89:
            mix, dry = mix * 0.89 / peak, dry * 0.89 / peak
        wm, wd = SCRATCH / ('%s-music.wav' % lay), SCRATCH / ('%s-sfx.wav' % lay)
        ic.write_wav(wm, mix)
        ic.write_wav(wd, dry)
        if lay == 'presenter':
            ic.write_wav(OUT / 'pdoom-promo-music-sfx.wav', mix)
            ic.write_wav(OUT / 'pdoom-promo-sfx.wav', dry)
        video = SCRATCH / ('%s-video.mp4' % lay)
        encode_video(promo, video)
        main_mp4 = OUT / ('pdoom-promo-%s.mp4' % lay)
        dry_mp4 = OUT / ('pdoom-promo-%s-nomusic.mp4' % lay)
        mux(video, wm, main_mp4)
        mux(video, wd, dry_mp4)
        for src in (main_mp4, dry_mp4):
            share_copy(src, src.with_name(src.stem + '-share.mp4'))
        bdir = OUT / 'beats' if lay == 'presenter' else OUT / 'beats' / 'fullframe'
        for b in promo.beats:
            cut(main_mp4, b.start, b.end, bdir / ('beat-%02d.mp4' % b.id))
        mp4_slam_sheet(promo, main_mp4, REVIEW / ('slams-%s.png' % lay))
        print('  wrote', main_mp4)
    if 'presenter' in info:
        p = info['presenter']
        beats = []
        for b in p.beats:
            beats.append(dict(beat=b.id, line=b.line, words=len(b.words), start_ms=int(round(b.start * 1000)),
                              end_ms=int(round(b.end * 1000)), duration_ms=int(round(b.dur * 1000)),
                              on_screen=b.texts, clip='beats/beat-%02d.mp4' % b.id,
                              fullframe_clip='beats/fullframe/beat-%02d.mp4' % b.id))
        (OUT / 'beats.json').write_text(json.dumps(dict(
            generator='scripts/build-promo.py', fps=FPS, width=W * UP, height=H * UP,
            voiceover_estimate='%.1f words/s + %.1f s breath per line' % (WPS, BREATH),
            presenter_layout=dict(action_and_key_text_px=[TOP_CLEAR * UP, p.zy1 * UP], presenter_stage_px=[p.zy1 * UP, H * UP],
                                  keep_clear=dict(top_px=TOP_CLEAR * UP, right_px=(W - KEY_X1) * UP)),
            duration_ms=int(round(p.duration * 1000)), beats=beats), indent=1) + '\n')


if __name__ == '__main__':
    main()
