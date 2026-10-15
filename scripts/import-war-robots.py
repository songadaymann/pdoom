#!/usr/bin/env python3
"""Deterministic import of the Last Stand war-robot atlases into Doom sprites.

Source atlases (art/war-robots-v1/<id>-atlas.png) follow the campaign-v2
format: transparent PNG, 8 equal columns = Doom rotations 1-8 (front,
front-left, left, rear-left, back, rear-right, right, front-right), one row per
pose separated by transparent gaps. Rows become frame letters A, B, C... in
order. A row whose columns 2-8 are empty is a single view and imports as
rotation 0.

Conventions shared with import-campaign-machines.py: alpha is thresholded at
128, scaling is NEAREST with ONE scale per robot (row A's tallest view maps to
the robot's native height), and the grAb origin sits at the bottom centre of
every tile. Unlike the 64x64 helper tile, each robot gets its own tile size,
the union of all its frames, so the 110-unit Enforcer and wide wrecks fit.

Anchoring: the atlas centres every view on its column centre at the view's
anchor (walkers: centroid of the legs; flyers and wrecks: whole-silhouette
centroid), so the column centre is the sprite origin x. Walker and wreck rows
stand on the origin (feet / wreck on the floor). Flyer rows are top-aligned in
the atlas; the importer places their top at row A's height above the origin so
the body stays put between hover, attack and pain frames.
"""
from pathlib import Path
from importlib.machinery import SourceFileLoader
from PIL import Image, ImageDraw
import hashlib, json, math, sys

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/war-robots-v1'
SPRITES = ROOT / 'doom-mod/sprites'
MANIFEST = ART / 'import-manifest.json'
h = SourceFileLoader('campaign_import', str(ROOT / 'scripts/import-campaign-art.py')).load_module()

ROBOTS = [
    # id, prefix, native height (Doom units = sprite px), [(pose, kind)], suggested collision
    ('trooper', 'WTRP', 64, [('walk A', 'stand'), ('walk B', 'stand'), ('aim', 'stand'), ('fire', 'stand'),
                             ('pain', 'stand'), ('death/wreck', 'ground')], {'radius': 20, 'height': 60}),
    ('squid', 'WSQD', 56, [('hover A', 'fly'), ('hover B', 'fly'), ('lunge/attack', 'fly'), ('pain', 'fly'),
                           ('death/wreck', 'ground')], {'radius': 18, 'height': 48}),
    ('enforcer', 'WENF', 110, [('walk A', 'stand'), ('walk B', 'stand'), ('fire', 'stand'), ('pain', 'stand'),
                               ('death/wreck', 'ground')], {'radius': 44, 'height': 104}),
    ('gunship', 'WGSH', 44, [('hover A', 'fly'), ('hover B', 'fly'), ('fire', 'fly'), ('pain', 'fly'),
                             ('death/wreck', 'ground')], {'radius': 30, 'height': 40}),
]
LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def bands(im, min_gap=4, min_h=20):
    """Row bands = runs of lines containing any opaque pixel (robust to sparse tentacle tips)."""
    a = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    w = im.width
    lines = [a.crop((0, y, w, y + 1)).getbbox() is not None for y in range(im.height)]
    out = []
    for y, hit in enumerate(lines):
        if not hit:
            continue
        if out and y - out[-1][1] <= min_gap:
            out[-1][1] = y + 1
        else:
            out.append([y, y + 1])
    return [b for b in out if b[1] - b[0] > min_h]


def binarize(im):
    im = im.copy()
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
    return im


def import_robot(rid, prefix, height, poses, collision):
    src = ART / f'{rid}-atlas.png'
    im = binarize(Image.open(src).convert('RGBA'))
    rr = bands(im)
    if len(rr) != len(poses):
        raise ValueError(f'{rid}: expected {len(poses)} pose rows, found {rr}')
    legacy = h.rows(im)
    if len(legacy) != len(rr):
        print(f'  note: {rid}: campaign rows() helper sees {len(legacy)} rows (sparse lines); using gap bands')
    cols = [(round(c * im.width / 8), round((c + 1) * im.width / 8)) for c in range(8)]
    ref_h = rr[0][1] - rr[0][0]
    scale = height / ref_h
    frames = []  # (name, letter, rot, scaled cell, anchor)
    for f, ((y0, y1), (pose, kind)) in enumerate(zip(rr, poses)):
        cells = [im.crop((x0, y0, x1, y1)) for x0, x1 in cols]
        present = [c.getbbox() is not None for c in cells]
        single = present[0] and not any(present[1:])
        if not single and not all(present):
            raise ValueError(f'{rid} row {f}: missing rotations {present}')
        for r, cell in enumerate(cells[:1] if single else cells):
            bb = cell.getbbox()
            ax = cell.width / 2
            ay = ref_h if kind == 'fly' else bb[3]
            sw, sh = max(1, round(cell.width * scale)), max(1, round(cell.height * scale))
            sc = cell.resize((sw, sh), Image.Resampling.NEAREST)
            frames.append((f'{prefix}{LETTERS[f]}{0 if single else r + 1}', LETTERS[f], 0 if single else r + 1,
                           sc, (ax * sw / cell.width, ay * sh / cell.height), pose))
    # One tile size per robot: union of all frames around the origin.
    left = right = up = down = 0
    for _, _, _, sc, (ax, ay), _ in frames:
        bb = sc.getbbox()
        left = max(left, ax - bb[0]); right = max(right, bb[2] - ax)
        up = max(up, ay - bb[1]); down = max(down, bb[3] - ay)
    W = 2 * math.ceil(max(left, right)) + 2
    up = math.ceil(up); down = math.ceil(down)
    Ht = up + down
    out = []
    for name, letter, rot, sc, (ax, ay), pose in frames:
        tile = Image.new('RGBA', (W, Ht), (0, 0, 0, 0))
        tile.alpha_composite(sc, (W // 2 - round(ax), up - round(ay)))
        bb = tile.getbbox()
        out.append({'name': name, 'letter': letter, 'rotation': rot, 'pose': pose, 'tile': tile,
                    'opaque_height': up - bb[1], 'opaque_width': bb[2] - bb[0]})
    return {'id': rid, 'prefix': prefix, 'height': height, 'scale': scale, 'tile_size': [W, Ht],
            'grab': [W // 2, up], 'rows': rr, 'collision_suggestion': collision,
            'source': str(src.relative_to(ROOT)), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
            'frames': out}


def preview(results, path):
    pad, lab = 6, 150
    blocks = []
    for r in results:
        W, H = r['tile_size']
        letters = sorted({f['letter'] for f in r['frames']})
        blk = Image.new('RGBA', (lab + 8 * (2 * W + pad) + pad, 22 + len(letters) * (2 * H + pad) + pad), (34, 30, 38, 255))
        d = ImageDraw.Draw(blk)
        d.text((6, 4), f"{r['id']}  {r['prefix']}  {r['height']}u  tile {W}x{H}  grAb {r['grab']}", fill=(255, 220, 120, 255))
        for i, L in enumerate(letters):
            y = 22 + i * (2 * H + pad)
            fr = [f for f in r['frames'] if f['letter'] == L]
            d.text((6, y + H - 6), f"{L}: {fr[0]['pose']}", fill=(220, 220, 220, 255))
            for f in fr:
                c = max(f['rotation'] - 1, 0)
                x = lab + pad + c * (2 * W + pad)
                cell = Image.new('RGBA', (W, H), (70, 64, 78, 255))
                for yy in range(0, H, 8):  # light checker shows any fringe
                    for xx in range(0, W, 8):
                        if (xx // 8 + yy // 8) % 2:
                            cell.paste((84, 78, 92, 255), (xx, yy, min(xx + 8, W), min(yy + 8, H)))
                cell.alpha_composite(f['tile'])
                ImageDraw.Draw(cell).line([(W // 2 - 3, H - 1), (W // 2 + 3, H - 1)], fill=(255, 0, 0, 255))
                blk.paste(cell.resize((2 * W, 2 * H), Image.Resampling.NEAREST), (x, y))
                d.text((x + 2, y + 2), f['name'], fill=(160, 200, 255, 255))
        blocks.append(blk)
    sheet = Image.new('RGBA', (max(b.width for b in blocks), sum(b.height for b in blocks)), (20, 18, 24, 255))
    y = 0
    for b in blocks:
        sheet.alpha_composite(b, (0, y)); y += b.height
    sheet.save(path)


def main():
    previous = set()
    if MANIFEST.exists():
        for r in json.loads(MANIFEST.read_text()).get('robots', []):
            previous |= {f['name'] for f in r['frames']}
    results = [import_robot(*spec) for spec in ROBOTS]
    new = {f['name'] for r in results for f in r['frames']}
    # Never overwrite sprites this importer did not create.
    for r in results:
        for p in SPRITES.glob(r['prefix'] + '*.png'):
            if p.stem not in previous:
                sys.exit(f'refusing to overwrite foreign sprite {p.name}')
    for name in previous - new:
        stale = SPRITES / f'{name}.png'
        if stale.exists():
            stale.unlink()
    for r in results:
        for f in r['frames']:
            h.save_sprite(f['tile'], f['name'], tuple(r['grab']))
    preview(results, ART / 'imported-preview.png')
    for r in results:
        for f in r['frames']:
            del f['tile']
    MANIFEST.write_text(json.dumps({'tool': 'scripts/import-war-robots.py', 'robots': results}, indent=2) + '\n')
    for r in results:
        letters = sorted({f['letter'] for f in r['frames']})
        print(f"{r['id']:9s} {r['prefix']} frames {''.join(letters)} ({len(r['frames'])} sprites) tile {r['tile_size']} grAb {r['grab']}")


if __name__ == '__main__':
    main()
