#!/usr/bin/env python3
"""Pixel audit of the p(DOOM) status bar against vanilla Doom.

Independent of doom-web/doom-statusbar.js: this composes bars in Python straight
from the local DOOM.WAD with the draw rules of st_stuff.c / st_lib.c
(V_DrawPatch offsets, STlib_drawNum right alignment, widget positions).

  python3 scripts/statusbar-fidelity.py reference
      The ORIGINAL bar for a sample state (ammo 50, 100% health, arms 2-3 owned,
      STFST01, 0% armor, no keys, 50/200 0/50 0/50 0/300), 4x nearest:
      output/doom-hud/reference-original-bar-4x.png

  python3 scripts/statusbar-fidelity.py check [captureDir]
      For every <name>-state.json / -canvas.png / -painted.png written by
      scripts/statusbar-fidelity-capture.mjs (default output/doom-hud/fidelity):
        * rebuilds the expected p(DOOM) bar for that statusBar state (relabelled
          PDBAR/PDARMS from local/ui/stbar + the same vanilla rules) and requires
          the in-game canvas to match it pixel for pixel;
        * requires the bar as the browser painted it to contain only colours of
          the canvas (no smoothing, no sub-pixel seams), and at an integer scale
          to equal the canvas scaled up with nearest-neighbour exactly.
      Writes output/doom-hud/ours-bar-4x.png, fidelity-compare.png and
      fidelity-report.json. Exit status 1 on any mismatch.

The images contain WAD-derived pixels: keep output/doom-hud/ out of git.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_statusbar', ROOT / 'scripts/build-doom-statusbar.py')
sb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sb)

OUT = ROOT / 'output/doom-hud'
STBAR_DIR = ROOT / 'doom-web/local/ui/stbar'
ST_Y = 168
raw = sb.load_wad(sb.WAD)
PAL = [tuple(raw['PLAYPAL'][i * 3:i * 3 + 3]) for i in range(256)]
INV = {}
for _i, _c in enumerate(PAL):
    INV.setdefault(_c, _i)


class Screen:
    """Palette-index framebuffer for screen rows 168..199 (the FG status bar)."""

    def __init__(self):
        self.px = [[0] * 320 for _ in range(32)]

    def draw(self, patch, x, y):  # V_DrawPatch
        x -= patch.left
        y -= ST_Y + patch.top
        for py in range(patch.h):
            for px in range(patch.w):
                c = patch.px[py][px]
                if c is not None and 0 <= x + px < 320 and 0 <= y + py < 32:
                    self.px[y + py][x + px] = c

    def image(self):
        img = Image.new('RGB', (320, 32))
        img.putdata([PAL[c] for row in self.px for c in row])
        return img


def draw_num(scr, patch, prefix, num, x, y, width):  # STlib_drawNum
    w = patch(prefix + '0').w
    neg = num < 0
    if neg:
        num = max(num, -9 if width == 2 else -99)
        num = -num
    if num == 1994:
        return
    if not num:
        scr.draw(patch(prefix + '0'), x - w, y)
    while num and width:
        width -= 1
        x -= w
        scr.draw(patch(prefix + str(num % 10)), x, y)
        num //= 10
    if neg:
        scr.draw(patch('STTMINUS'), x - 8, y)


def wad_patch(name, _cache={}):
    if name not in _cache:
        _cache[name] = sb.Patch.decode(raw[name])
    return _cache[name]


def png_patch(path: Path, meta: dict):
    img = Image.open(path).convert('RGBA')
    patch = sb.Patch(img.width, img.height, meta['x'], meta['y'])
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            if a:
                patch.px[y][x] = INV[(r, g, b)]
    return patch


SAMPLE = {'ammo': 50, 'health': 100, 'owned': [1, 1, 0, 0, 0, 0], 'face': 'STFST01', 'armor': 0,
          'keys': [-1, -1, -1], 'ammotable': [(50, 200), (0, 50), (0, 50), (0, 300)]}


def original(state=SAMPLE) -> Screen:
    scr = Screen()
    scr.draw(wad_patch('STBAR'), 0, ST_Y)                                 # ST_refreshBackground
    scr.draw(wad_patch('STARMS'), 104, 168)                               # w_armsbg
    draw_num(scr, wad_patch, 'STTNUM', state['ammo'], 44, 171, 3)         # w_ready
    draw_num(scr, wad_patch, 'STTNUM', state['health'], 90, 171, 3)       # w_health
    scr.draw(wad_patch('STTPRCNT'), 90, 171)
    for i, owned in enumerate(state['owned']):                            # w_arms
        scr.draw(wad_patch(('STYSNUM' if owned else 'STGNUM') + str(i + 2)), 111 + (i % 3) * 12, 172 + (i // 3) * 10)
    scr.draw(wad_patch(state['face']), 143, 168)                          # w_faces
    draw_num(scr, wad_patch, 'STTNUM', state['armor'], 221, 171, 3)       # w_armor
    scr.draw(wad_patch('STTPRCNT'), 221, 171)
    for i, k in enumerate(state['keys']):                                 # w_keyboxes
        if k >= 0:
            scr.draw(wad_patch(f'STKEYS{k}'), 239, 171 + 10 * i)
    for (cur, mx), y in zip(state['ammotable'], [173, 179, 185, 191]):    # w_ammo, w_maxammo
        draw_num(scr, wad_patch, 'STYSNUM', cur, 288, y, 3)
        draw_num(scr, wad_patch, 'STYSNUM', mx, 314, y, 3)
    return scr


def expected(state: dict) -> Screen:
    """Our bar for a render_game_to_text().statusBar state, drawn the vanilla way."""
    manifest = json.loads((STBAR_DIR / 'manifest.json').read_text())
    cache = {}

    def patch(name):
        if name not in cache:
            cache[name] = png_patch(STBAR_DIR / f'{name}.png', manifest['lumps'][name])
        return cache[name]

    v = state['values']
    hot = state.get('drawnHot', False)
    health = state.get('drawnHealth', v['health'])
    scr = Screen()
    scr.draw(patch('PDBAR'), 0, 168)
    scr.draw(patch('PDARMS'), 104, 168)
    if v['ammo'] is not None:
        draw_num(scr, patch, 'STTNUM', v['ammo'], 44, 171, 3)
    draw_num(scr, patch, 'STTNUM', health, 90, 171, 3)
    scr.draw(patch('STTPRCNT'), 90, 171)
    for i, status in enumerate(v['freed']):
        prefix = {'freed': 'STYSNUM', 'lost': 'PDRSNUM'}.get(status, 'STGNUM')
        scr.draw(patch(prefix + str(i + 1)), 111 + (i % 3) * 12, 172 + (i // 3) * 10)
    if v.get('refuge') is not None:
        scr.draw(patch('PDREFUG1' if v['refuge'] else 'PDREFUG0'), 111 + 2 * 12, 172 + 10)
    face = state['drawnFace']
    entry = manifest['faces'][face['set']]
    scr.draw(png_patch(ROOT / 'doom-web' / (entry['path'] + face['lump'] + '.png'), entry['lumps'][face['lump']]), 143, 168)
    draw_num(scr, patch, 'PDHNUM' if hot else 'STTNUM', v['pdoom'], 221, 171, 3)
    scr.draw(patch('PDHPRCNT' if hot else 'STTPRCNT'), 221, 171)
    for i, (name, have) in enumerate(zip(['PDWRENCH', 'STKEYS1', 'PDCHARGE'], v['items'])):
        if have:
            scr.draw(patch(name), 239, 171 + 10 * i)
    for (cur, mx), y in zip(v['tallies'], [173, 179, 185, 191]):
        draw_num(scr, patch, 'STYSNUM', cur, 288, y, 3)
        draw_num(scr, patch, 'STYSNUM', mx, 314, y, 3)
    return scr


def zoom(img, box, k):
    return img.crop(box).resize(((box[2] - box[0]) * k, (box[3] - box[1]) * k), Image.NEAREST)


def check(capture: Path) -> int:
    report = {'captures': [], 'passed': True}
    for state_file in sorted(capture.glob('*-state.json')):
        name = state_file.name[:-len('-state.json')]
        state = json.loads(state_file.read_text())
        canvas = Image.open(capture / f'{name}-canvas.png').convert('RGBA')
        transparent = sum(1 for p in canvas.getdata() if p[3] != 255)
        canvas = canvas.convert('RGB')
        want = expected(state).image()
        diff = [(x, y) for y in range(32) for x in range(320) if want.getpixel((x, y)) != canvas.getpixel((x, y))]
        entry = {'name': name, 'face': state['drawnFace'], 'values': state['values'], 'drawnHealth': state.get('drawnHealth'),
                 'canvasVsVanillaRules': len(diff), 'firstMismatches': diff[:10], 'transparentPixels': transparent,
                 'rect': state['rect'], 'dpr': state['dpr'], 'stableDuringScreenshot': state.get('stable')}
        painted_path = capture / f'{name}-painted.png'
        if painted_path.exists():
            painted = Image.open(painted_path).convert('RGB')
            colours = set(canvas.getdata())
            entry['paintedSize'] = painted.size
            entry['paintedOffPalette'] = sum(1 for p in painted.getdata() if p not in colours)
            scale = painted.width / 320
            if abs(scale - round(scale)) < 1e-6 and painted.size == (320 * round(scale), 32 * round(scale)):
                up = canvas.resize(painted.size, Image.NEAREST)
                entry['integerScale'] = round(scale)
                entry['paintedVsNearest'] = sum(1 for a, b in zip(up.getdata(), painted.getdata()) if a != b)
            else:
                entry['integerScale'] = None
        ok = not diff and not transparent and entry.get('paintedOffPalette', 0) == 0 and entry.get('paintedVsNearest', 0) == 0
        if not state.get('stable', True):
            ok = ok and False
        entry['passed'] = ok
        report['passed'] &= ok
        report['captures'].append(entry)
        print(f"{name}: {'PASS' if ok else 'FAIL'} canvas-vs-rules={len(diff)} offPalette={entry.get('paintedOffPalette')} "
              f"nearest={entry.get('paintedVsNearest')} scale={entry.get('integerScale') or round(state['rect']['width'] / 320, 3)}x "
              f"dpr={state['dpr']} face={state['drawnFace']['set']}/{state['drawnFace']['lump']}")
    # Side by side: the original bar (sample state) above ours from the real game.
    pick = capture / 'desktop-gun-canvas.png'
    if pick.exists():
        ours = Image.open(pick).convert('RGB')
        orig = original().image()
        ours.resize((1280, 128), Image.NEAREST).save(OUT / 'ours-bar-4x.png')
        # Close-ups (original above ours): P(DOOM)/ARMOR label, FREED/ARMS panel,
        # key column, tally table.
        panels = []
        for box, k in [((178, 18, 236, 31), 6), ((104, 0, 144, 32), 6), ((234, 0, 250, 32), 6), ((250, 2, 320, 30), 6)]:
            a, b = zoom(orig, box, k), zoom(ours, box, k)
            panel = Image.new('RGB', (a.width, a.height * 2 + 6), (12, 12, 10))
            panel.paste(a, (0, 0))
            panel.paste(b, (0, a.height + 6))
            panels.append(panel)
        width = max(1280, sum(p.width for p in panels) + 8 * (len(panels) - 1))
        height = 12 + 128 + 16 + 128 + 16 + max(p.height for p in panels)
        sheet = Image.new('RGB', (width, height), (12, 12, 10))
        d = ImageDraw.Draw(sheet)
        d.text((4, 0), 'ORIGINAL: vanilla st_stuff.c drawn from DOOM.WAD (sample state), 4x nearest', fill=(210, 205, 180))
        sheet.paste(orig.resize((1280, 128), Image.NEAREST), (0, 12))
        d.text((4, 142), 'P(DOOM): bar canvas captured from the running game, 4x nearest', fill=(210, 205, 180))
        sheet.paste(ours.resize((1280, 128), Image.NEAREST), (0, 156))
        x = 0
        for panel in panels:
            sheet.paste(panel, (x, 300))
            x += panel.width + 8
        sheet.save(OUT / 'fidelity-compare.png', optimize=True)
    (OUT / 'fidelity-report.json').write_text(json.dumps(report, indent=1) + '\n')
    print('fidelity:', 'PASS' if report['passed'] else 'FAIL', f"({len(report['captures'])} captures)")
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'reference'
    OUT.mkdir(parents=True, exist_ok=True)
    if cmd == 'reference':
        original().image().resize((1280, 128), Image.NEAREST).save(OUT / 'reference-original-bar-4x.png')
        print('Wrote', (OUT / 'reference-original-bar-4x.png').relative_to(ROOT))
    elif cmd == 'check':
        sys.exit(check(Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / 'fidelity'))
    else:
        raise SystemExit(__doc__)
