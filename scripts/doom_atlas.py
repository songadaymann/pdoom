"""Atlas of the original Doom maps, for choosing Last Stand gauntlet sections.

For every map in the private IWAD: a top-down render with sector numbers and a
JSON sheet of sectors (area, heights, flats, sky, neighbours, vanilla monsters),
lines (length, sides, specials) and connected outdoor (sky) regions.

    python3 scripts/doom_atlas.py            # all maps -> output/gauntlet/atlas/
    python3 scripts/doom_atlas.py E3M6 E2M8  # just these
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_checkpoint_map import read_map  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WAD = ROOT / 'doom-web/local/DOOM.WAD'
OUT = ROOT / 'output/gauntlet/atlas'

MONSTER_NAMES = {3004: 'zombieman', 9: 'shotgunguy', 3001: 'imp', 3002: 'demon', 58: 'spectre',
                 3006: 'lostsoul', 3005: 'cacodemon', 3003: 'baron', 16: 'cyberdemon', 7: 'spider'}
DOOR_SPECIALS = {1, 26, 27, 28, 31, 32, 33, 34, 117, 118, 2, 3, 4, 16, 29, 42, 46, 50, 61, 63, 75, 76,
                 86, 90, 103, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 133, 134, 135,
                 136, 137, 99}
LIFT_SPECIALS = {10, 21, 62, 88, 120, 121, 122, 123}
DAMAGE = {4: 20, 5: 10, 7: 5, 11: 20, 16: 20}


def map_names():
    import struct
    blob = WAD.read_bytes()
    _, count, offset = struct.unpack_from('<4sii', blob)
    names = [struct.unpack_from('<8s', blob, offset + 16 * i + 8)[0].rstrip(b'\0').decode() for i in range(count)]
    return [n for n in names if len(n) == 4 and n[0] == 'E' and n[2] == 'M']


def oriented_edges(model):
    """Per-sector edges oriented with the sector on the right (Doom convention)."""
    edges = [[] for _ in model['sectors']]
    V = model['vertices']
    for i, line in enumerate(model['lines']):
        a, b = V[line['v1']], V[line['v2']]
        front = model['sides'][line['sidefront']]['sector']
        edges[front].append(((a['x'], a['y']), (b['x'], b['y']), i))
        if line['sideback'] >= 0:
            back = model['sides'][line['sideback']]['sector']
            edges[back].append(((b['x'], b['y']), (a['x'], a['y']), i))
    return edges


def area(edge_list):
    return -0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b, _ in edge_list)


def loops(edge_list):
    """Chain oriented edges into closed loops (best effort for malformed sectors)."""
    remaining = list(edge_list)
    result = []
    while remaining:
        a, b, _ = remaining.pop()
        loop = [a, b]
        while loop[-1] != loop[0]:
            nxt = next((k for k, e in enumerate(remaining) if e[0] == loop[-1]), None)
            if nxt is None:
                break
            loop.append(remaining.pop(nxt)[1])
        result.append(loop)
    return result


def inside(edge_list, x, y):
    hit = False
    for (x1, y1), (x2, y2), _ in edge_list:
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def label_point(edge_list, bbox):
    """An interior point well away from the walls."""
    x0, y0, x1, y1 = bbox
    best, best_d = None, -1
    steps = 12
    for i in range(1, steps):
        for j in range(1, steps):
            x = x0 + (x1 - x0) * i / steps
            y = y0 + (y1 - y0) * j / steps
            if not inside(edge_list, x, y):
                continue
            d = min(seg_dist(x, y, a, b) for a, b, _ in edge_list)
            if d > best_d:
                best, best_d = (x, y), d
    if best is None:
        a, b, _ = edge_list[0]
        best = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    return best, best_d


def seg_dist(x, y, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L))
    return math.hypot(x - (ax + t * dx), y - (ay + t * dy))


def analyse(name):
    model, _ = read_map(WAD, name)
    S, L, V, sides = model['sectors'], model['lines'], model['vertices'], model['sides']
    edges = oriented_edges(model)
    sectors = []
    for i, sec in enumerate(S):
        el = edges[i]
        if not el:
            sectors.append(None)
            continue
        xs = [p[0] for a, b, _ in el for p in (a, b)]
        ys = [p[1] for a, b, _ in el for p in (a, b)]
        bbox = (min(xs), min(ys), max(xs), max(ys))
        neighbours = {}
        for a, b, li in el:
            line = L[li]
            if line['sideback'] < 0:
                continue
            fs, bs = sides[line['sidefront']]['sector'], sides[line['sideback']]['sector']
            other = bs if fs == i else fs
            if other == i:
                continue
            neighbours.setdefault(other, []).append(li)
        is_door = any(L[li]['special'] in DOOR_SPECIALS and L[li]['sideback'] >= 0 and
                      sides[L[li]['sideback']]['sector'] == i for _, _, li in el) or \
            (sec['heightceiling'] == sec['heightfloor'])
        is_lift = any(L[li]['special'] in LIFT_SPECIALS for _, _, li in el)
        sectors.append(dict(
            id=i, area=round(area(el)), bbox=bbox, floor=sec['heightfloor'], ceil=sec['heightceiling'],
            floorflat=sec['texturefloor'], ceilflat=sec['textureceiling'], light=sec['lightlevel'],
            special=sec['special'], tag=sec['id'], sky=sec['textureceiling'] == 'F_SKY1',
            damage=DAMAGE.get(sec['special'], 0), door=is_door, lift=is_lift,
            neighbours={str(k): v for k, v in sorted(neighbours.items())},
            walls=sorted({t for _, _, li in el for t in wall_textures(model, li)}),
        ))
    # Vanilla things, by sector (where the original designers put fights).
    for t in model['things']:
        for s in sectors:
            if s and s['bbox'][0] <= t['x'] <= s['bbox'][2] and s['bbox'][1] <= t['y'] <= s['bbox'][3] \
                    and inside(edges[s['id']], t['x'], t['y']):
                kind = MONSTER_NAMES.get(t['type'])
                if kind:
                    s.setdefault('vanilla_monsters', {})
                    s['vanilla_monsters'][kind] = s['vanilla_monsters'].get(kind, 0) + 1
                if t['type'] == 1:
                    s['player_start'] = True
                break
    lines = []
    for i, line in enumerate(L):
        a, b = V[line['v1']], V[line['v2']]
        fs = sides[line['sidefront']]['sector']
        bs = sides[line['sideback']]['sector'] if line['sideback'] >= 0 else -1
        lines.append(dict(id=i, a=(a['x'], a['y']), b=(b['x'], b['y']),
                          length=round(math.hypot(b['x'] - a['x'], b['y'] - a['y']), 1),
                          front=fs, back=bs, special=line['special'], tag=line['id'],
                          textures=wall_textures(model, i)))
    # Outdoor regions: sky sectors connected through walkable (<=24 step) openings.
    regions = []
    seen = set()
    for s in sectors:
        if not s or not s['sky'] or s['id'] in seen:
            continue
        stack, region = [s['id']], []
        seen.add(s['id'])
        while stack:
            k = stack.pop()
            region.append(k)
            for other in sectors[k]['neighbours']:
                o = sectors[int(other)]
                if o and o['sky'] and o['id'] not in seen and abs(o['floor'] - sectors[k]['floor']) <= 24:
                    seen.add(o['id'])
                    stack.append(o['id'])
        tot = sum(max(0, sectors[k]['area']) for k in region)
        xs = [c for k in region for c in (sectors[k]['bbox'][0], sectors[k]['bbox'][2])]
        ys = [c for k in region for c in (sectors[k]['bbox'][1], sectors[k]['bbox'][3])]
        regions.append(dict(sectors=sorted(region), area=tot,
                            bbox=(min(xs), min(ys), max(xs), max(ys))))
    regions.sort(key=lambda r: -r['area'])
    return model, edges, sectors, lines, regions


def wall_textures(model, li):
    line = model['lines'][li]
    out = []
    for k in ('sidefront', 'sideback'):
        if line[k] >= 0:
            sd = model['sides'][line[k]]
            out += [t for t in (sd['texturetop'], sd['texturemiddle'], sd['texturebottom']) if t and t != '-']
    return sorted(set(out))


def render(name, model, edges, sectors, lines, regions, size=2600):
    V = model['vertices']
    xs = [v['x'] for v in V]
    ys = [v['y'] for v in V]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    pad = 60
    scale = (size - 2 * pad) / max(x1 - x0, y1 - y0)
    W, H = int((x1 - x0) * scale) + 2 * pad, int((y1 - y0) * scale) + 2 * pad + 40
    P = lambda x, y: (pad + (x - x0) * scale, H - 40 - pad - (y - y0) * scale)
    img = Image.new('RGB', (W, H), (14, 14, 18))
    d = ImageDraw.Draw(img)
    floors = [s['floor'] for s in sectors if s]
    fmin, fmax = min(floors), max(floors)
    order = sorted((s for s in sectors if s), key=lambda s: -abs(s['area']))
    for s in order:
        t = (s['floor'] - fmin) / max(1, fmax - fmin)
        base = int(60 + 120 * t)
        if s['sky']:
            col = (base + 70, base // 2, base // 3)
        elif s['door']:
            col = (200, 170, 40)
        elif s['damage']:
            col = (40, base + 40, 40)
        elif s['lift']:
            col = (60, 110, 200)
        else:
            col = (base, base, base + 10)
        for loop in loops(edges[s['id']]):
            if len(loop) >= 3:
                d.polygon([P(*p) for p in loop], fill=col)
    for ln in lines:
        one = ln['back'] < 0
        colr = (235, 235, 235) if one else (90, 90, 100)
        if ln['special']:
            colr = (255, 90, 200)
        d.line([P(*ln['a']), P(*ln['b'])], fill=colr, width=3 if one else 1)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15)
        big = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 26)
    except OSError:
        font = big = ImageFont.load_default()
    for s in sectors:
        if not s:
            continue
        (lx, ly), clearance = label_point(edges[s['id']], s['bbox'])
        px, py = P(lx, ly)
        txt = str(s['id'])
        d.text((px - 8, py - 8), txt, fill=(0, 0, 0), font=font, stroke_width=3, stroke_fill=(255, 255, 255))
    # Grid every 512 units for scale.
    for gx in range(int(x0 // 512) * 512, int(x1) + 1, 512):
        a, _ = P(gx, y0)
        d.text((a, H - 38), str(gx), fill=(160, 160, 160), font=font)
    for gy in range(int(y0 // 512) * 512, int(y1) + 1, 512):
        _, b = P(x0, gy)
        d.text((4, b), str(gy), fill=(160, 160, 160), font=font)
    d.text((pad, 8), f'{name}  {x1 - x0}x{y1 - y0} units   red=sky  yellow=door  blue=lift  green=damaging  '
                     f'pink line=special  white=solid wall', fill=(255, 255, 255), font=big)
    img.save(OUT / f'{name}.png')


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    summary = {}
    for name in names:
        model, edges, sectors, lines, regions = analyse(name)
        render(name, model, edges, sectors, lines, regions)
        (OUT / f'{name}.json').write_text(json.dumps(dict(
            map=name, sectors=[s for s in sectors if s], lines=lines, outdoor_regions=regions[:8]), indent=1))
        V = model['vertices']
        summary[name] = dict(
            size=(max(v['x'] for v in V) - min(v['x'] for v in V), max(v['y'] for v in V) - min(v['y'] for v in V)),
            sectors=len(sectors), lines=len(lines),
            biggest_outdoor=[dict(area=r['area'], bbox=r['bbox'], sectors=len(r['sectors'])) for r in regions[:3]],
            textures=sorted({t for ln in lines for t in ln['textures']}))
        print(name, summary[name]['size'], 'outdoor:', [r['area'] for r in regions[:3]])
    (OUT / 'summary.json').write_text(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main(sys.argv[1:] or map_names())
