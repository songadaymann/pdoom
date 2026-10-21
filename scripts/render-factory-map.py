#!/usr/bin/env python3
"""Top-down PNG of the built factory map: wings, puzzles, props and ?puzzle= warp spots.

Reads the generated output/factory/E2M7-TEXTMAP.txt (run build-factory-preview.py first)
and writes output/factory/factory-map.png. Local development aid; the map derives from
the private IWAD's E2M7, so the image stays in ignored output/.
"""
import math, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_checkpoint_map import polygon_data
from factory_theme import CANDY, ZONES, zone_at

ROOT = Path(__file__).resolve().parents[1]
SCALE, PAD, LEGEND = .5, 40, 600
INK = (36, 33, 59)
# Each puzzle: prisoner site, ?puzzle= name, colour, and the start spot/facing that
# Factory.zs ApplySite uses for that flag.
PUZZLES = [
    (0, 'zvi', '#d6336c', (712, 1890), 150, 'Music lure: CD player brings MEG3N to dance; the vase falls, key drops'),
    (1, 'victoria', '#e8590c', (480, 770), 270, 'Playpen in a paint vat: the gate never opens; two slingshot hits on the fabric side (or ten wrench hits while wading) raise a walkway'),
    (2, 'max', '#1971c2', (1290, 900), 180, 'Pause letter: three signatures stop the moving shipping box'),
    (3, 'paul', '#2f9e44', (1712, -224), 180, 'Train the guard: reward stepping aside three times, then use the wall switch'),
    (4, 'ajeya', '#7048e8', (3264, -150), 270, 'Dolls carry stools while the camera watches; break it, then take the key from the one that keeps working'),
]
BREAK_ROOM = ((1152, 1535, 1600, 1920), 'breakroom', (1250, 1700), 0)
# PDFactoryProp kinds (FactoryActors.zs) -> (label, puzzle site or None)
PROPS = {1: ('CD player', 0), 2: ('vase', 0), 4: ('fabric side', 1), 5: ('gate', 1), 6: ('petition', 2),
         7: ('Robby (signs)', 2), 8: ('WALL-E (signs)', 2), 9: ('console: + rewards, - punishes', 3), 10: ('reward', 3),
         11: ('punish', 3), 13: ('camera', 4), 14: ('alarm', 4),
         19: ('wrench', None), 21: ('slingshot', 1), 22: ('gate sign (wall)', 1),
         15: ('break-room TV: broadcast MEG3N.AVI', None), 16: ('big screen: MEG3N watches herself', None)}
BARRIERS = {7100: '#0ca678', 7110: '#0ca678', 7112: '#f08c00', 7111: '#e64980', 7140: '#0ca678'}


def font(size, bold=True):
    for name in (['Arial Bold.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['Arial.ttf', 'DejaVuSans.ttf']):
        for folder in ['/System/Library/Fonts/Supplemental', '/usr/share/fonts/truetype/dejavu', '/Library/Fonts']:
            path = Path(folder) / name
            if path.exists(): return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def read_textmap(path):
    model = dict(vertices=[], lines=[], sides=[], sectors=[], things=[])
    kinds = dict(vertex='vertices', linedef='lines', sidedef='sides', sector='sectors', thing='things')
    for kind, body in re.findall(r'(\w+)\s*\{([^}]*)\}', path.read_text()):
        if kind not in kinds: continue
        fields = {}
        for key, value in re.findall(r'(\w+)\s*=\s*([^;]+);', body):
            value = value.strip()
            fields[key] = value.strip('"') if value.startswith('"') else value == 'true' if value in ('true', 'false') else float(value) if '.' in value else int(value)
        if kind == 'linedef': fields.setdefault('sideback', -1)
        model[kinds[kind]].append(fields)
    return model


class View:
    """One rendered window onto the map, drawn into its own image (so it clips)."""
    def __init__(self, m, polys, box, scale, background=(250, 247, 240)):
        self.m, self.polys, self.box, self.scale = m, polys, box, scale
        bx0, by0, bx1, by1 = box
        self.size = (int((bx1 - bx0) * scale), int((by1 - by0) * scale))
        self.image = Image.new('RGB', self.size, background)
        self.placed = []

    def P(self, x, y):
        bx0, by0, bx1, by1 = self.box
        return ((x - bx0) * self.scale, (by1 - y) * self.scale)

    def fill(self):
        """Sector fills by wing colour (even-odd test per sector, at pixel resolution)."""
        m, (vw, vh) = self.m, self.size
        bx0, by0, bx1, by1 = self.box
        img = np.array(self.image)
        rgb = lambda code: tuple(int(code.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
        tint = lambda c, t: tuple(round(a + (255 - a) * t) for a in c)
        zone_colour = {name: rgb(CANDY[z['wall']]) for name, _, z in ZONES}
        for i, (edges, (sx0, sy0, sx1, sy1)) in enumerate(self.polys):
            if sx1 < bx0 or sx0 > bx1 or sy1 < by0 or sy0 > by1: continue
            sec = m['sectors'][i]
            c0, c1 = max(0, int((sx0 - bx0) * self.scale)), min(vw, int((sx1 - bx0) * self.scale) + 1)
            r0, r1 = max(0, int((by1 - sy1) * self.scale)), min(vh, int((by1 - sy0) * self.scale) + 1)
            if c0 >= c1 or r0 >= r1: continue
            gx, gy = np.meshgrid(np.arange(c0, c1) + .5, np.arange(r0, r1) + .5)
            mx, my = gx / self.scale + bx0, by1 - gy / self.scale
            inside = np.zeros(mx.shape, bool)
            for ax, ay, ex, ey in edges:
                if ay == ey: continue
                inside ^= ((ay > my) != (ey > my)) & (mx < (ex - ax) * (my - ay) / (ey - ay) + ax)
            if sec['heightceiling'] <= sec['heightfloor']: colour = (120, 112, 140)  # door
            elif sec['heightfloor'] < 0: colour = (247, 131, 172)  # paint vats
            else:
                colour = tint(zone_colour[zone_at((sx0 + sx1) / 2, (sy0 + sy1) / 2)], .62 - min(.18, max(-.1, sec['heightfloor'] / 900)))
                if sec.get('textureceiling') == 'F_SKY1': colour = tint(colour, .35)
            img[r0:r1, c0:c1][inside] = colour
        self.image = Image.fromarray(img)

    def lines(self, d, width=2):
        verts, m = self.m['vertices'], self.m
        for line in m['lines']:
            a, b = verts[line['v1']], verts[line['v2']]
            pa, pb = self.P(a['x'], a['y']), self.P(b['x'], b['y'])
            if line.get('id') in BARRIERS: d.line([pa, pb], fill=BARRIERS[line['id']], width=width + 3); continue
            if line['sideback'] < 0: d.line([pa, pb], fill=INK, width=width); continue
            f, k = (m['sectors'][m['sides'][line[s]]['sector']] for s in ('sidefront', 'sideback'))
            if abs(f['heightfloor'] - k['heightfloor']) > 24: d.line([pa, pb], fill=(150, 140, 165), width=1)

    def tag(self, d, xy, text, colour, f, avoid=True):
        """Outlined label beside a point, nudged around labels already placed."""
        x, y = xy
        for dx, dy in [(9, -8), (9, 6), (-9, -8), (-9, 6), (9, -22), (9, 18), (-9, -22), (-9, 18), (9, 32), (9, -36)]:
            anchor = 'la' if dx > 0 else 'ra'
            box = d.textbbox((x + dx, y + dy), text, font=f, anchor=anchor, stroke_width=3)
            if not avoid or not any(box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1] for b in self.placed): break
        self.placed.append(box)
        d.text((x + dx, y + dy), text, fill=colour, font=f, anchor=anchor, stroke_width=3, stroke_fill=(255, 255, 255))


def draw_markers(view, d, f, detail):
    things = view.m['things']
    inbox = lambda x, y: view.box[0] <= x <= view.box[2] and view.box[1] <= y <= view.box[3]
    people = {t['arg0']: (t['x'], t['y']) for t in things if t['type'] == 15300}
    labels = []
    for t in things:
        x, y, kind = t['x'], t['y'], t['type']
        if not inbox(x, y): continue
        px, py = view.P(x, y)
        if kind == 1:
            d.polygon([(px + 10, py), (px - 7, py - 7), (px - 7, py + 7)], fill=INK); labels.append((px, py, 'player start', INK))
        elif kind == 15301:
            d.ellipse([px - 7, py - 7, px + 7, py + 7], fill='#c92a2a'); labels.append((px, py, 'MEG3N', '#c92a2a'))
        elif kind == 15303:
            d.rectangle([px - 6, py - 6, px + 6, py + 6], fill=PUZZLES[3][2])
            if detail: labels.append((px, py, 'guard (blocks passage)', PUZZLES[3][2]))
        elif kind == 15306:
            # MEG3N's live-feed screens (smash them; SCRN on the status bar), facing their room.
            a = math.radians(t.get('angle', 0))
            d.line([(px, py), (px + 12 * math.cos(a), py - 12 * math.sin(a))], fill='#e64980', width=2)
            d.rectangle([px - 5, py - 4, px + 5, py + 4], fill='#f783ac', outline=INK)
            if detail: labels.append((px, py, 'MEG3N screen', '#c2255c'))
        elif kind == 15305:
            d.rectangle([px - 9, py - 9, px + 9, py + 9], outline=PUZZLES[2][2], width=3)
            if detail: labels.append((px + 6, py, 'shipping box (Max inside, loops until paused)', PUZZLES[2][2]))
        elif kind == 15304:
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=PUZZLES[4][2])
            if detail and t.get('arg0') == 0: labels.append((px, py, 'dolls x3', PUZZLES[4][2]))
        elif kind == 15302 and t.get('arg0') in PROPS:
            text, site = PROPS[t['arg0']]; colour = PUZZLES[site][2] if site is not None else INK
            r = 5 if detail else 3
            d.rectangle([px - r, py - r, px + r, py + r], fill=colour, outline='white')
            if detail or site is None or t['arg0'] in (7, 8): labels.append((px, py, text, colour))
        elif 15320 <= kind <= 15324:
            d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(170, 160, 180))
    # Paul's platform switch is E2M7's own wall switch (south wall of the switch room).
    if detail and inbox(1440, -384):
        px, py = view.P(1440, -384); d.line([view.P(1408, -384), view.P(1472, -384)], fill=PUZZLES[3][2], width=6)
        labels.append((px, py, 'wall switch (works once trained)', PUZZLES[3][2]))
    if detail and inbox(696, 1904):
        px, py = view.P(696, 1904); d.line([(px - 6, py - 6), (px + 6, py + 6)], fill='#c92a2a', width=3); d.line([(px - 6, py + 6), (px + 6, py - 6)], fill='#c92a2a', width=3)
        labels.append((px, py, 'dance mark (key drops)', '#c92a2a'))
    for n, (site, name, colour, spot, angle, _) in enumerate(PUZZLES, 1):
        if inbox(*spot):
            sx, sy = view.P(*spot); a = math.radians(angle)
            d.line([(sx, sy), (sx + 26 * math.cos(a), sy - 26 * math.sin(a))], fill=colour, width=4)
            d.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], outline=colour, width=3)
            if detail: labels.append((sx, sy, f'start: ?puzzle={name}', colour))
        if inbox(*people[site]):
            px, py = view.P(*people[site]); r = 15 if detail else 13
            d.ellipse([px - r, py - r, px + r, py + r], fill=colour, outline='white', width=3)
            d.text((px, py), str(n), fill='white', font=font(18), anchor='mm')
    for px, py, text, colour in labels: view.tag(d, (px, py), text, colour, f)
    return people


def main():
    source = ROOT / 'output/factory/E2M7-TEXTMAP.txt'
    if not source.exists(): raise SystemExit('Run python3 scripts/build-factory-preview.py first.')
    m = read_textmap(source)
    polys = polygon_data(m)
    xs = [v['x'] for v in m['vertices']]; ys = [v['y'] for v in m['vertices']]
    whole = (min(xs) - 40, min(ys) - 40, max(xs) + 40, max(ys) + 40)
    small, label, big, title = font(13, False), font(15), font(20), font(30)
    # Overview.
    over = View(m, polys, whole, SCALE); over.fill(); d = ImageDraw.Draw(over.image); over.lines(d)
    for name, (zx0, zy0, zx1, zy1), _ in ZONES:
        cx, cy = (max(zx0, whole[0]) + min(zx1, whole[2])) / 2, (max(zy0, whole[1]) + min(zy1, whole[3])) / 2
        d.text(over.P(cx, cy), name.upper(), fill=(120, 110, 140), font=label, anchor='mm', stroke_width=3, stroke_fill=(255, 255, 255))
    (rx0, ry0, rx1, ry1), *_ = BREAK_ROOM
    d.rectangle([over.P(rx0, ry1), over.P(rx1, ry0)], outline='#f59f00', width=4)
    over.tag(d, over.P(rx1, ry1), 'STAFF BREAK ROOM (refuge)', '#e67700', label)
    d.rectangle([over.P(864, 1008), over.P(1248, 800)], outline=PUZZLES[2][2], width=2)
    # The way out (2026-10-19): the floor chevrons from the break room to E2M7's exit switch.
    exit_route = [(float(x), float(y)) for x, y in re.findall(r'case \d+:return \((-?[\d.]+),(-?[\d.]+),-?[\d.]+\);', (ROOT / 'doom-mod/actors/PDFactoryMap.zs').read_text().split('static Vector3 ExitLight')[-1])]
    if exit_route:
        d.line([over.P(*p) for p in exit_route], fill='#2b8a3e', width=4, joint='curve')
        over.tag(d, over.P(1056, -560), 'EXIT switch (way out)', '#2b8a3e', label)
    # MEG3N's patrol loop (Factory.zs PatrolPoint).
    patrol = [(800, 1872), (1040, 1640), (1100, 1300), (850, 1250), (576, 1400), (576, 1750)]
    d.line([over.P(*p) for p in patrol + patrol[:1]], fill='#c92a2a', width=2, joint='curve')
    over.tag(d, over.P(576, 1400), 'MEG3N patrol', '#c92a2a', small)
    people = draw_markers(over, d, small, False)
    for n, (site, name, colour, *_rest) in enumerate(PUZZLES, 1):
        px, py = over.P(*people[site])
        over.tag(d, (px + 10, py), f'{n} {SITE_NAMES[site]}  ?puzzle={name}', colour, label)
    sx, sy = over.P(*BREAK_ROOM[2]); d.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], outline='#e67700', width=3)
    # Puzzle insets along the bottom.
    IW, IH, GAP = 500, 380, 24
    insets = [(0, (600, 1760, 1060, 2040)), (1, (300, 440, 660, 860)), (2, (760, 660, 1360, 1110)),
              (3, (1380, -420, 1880, -80)), (4, (3080, -470, 3620, -110))]
    top = 70 + over.size[1] + 30
    W = max(PAD + over.size[0] + LEGEND, PAD + len(insets) * (IW + GAP))
    canvas = Image.new('RGB', (W, top + 40 + IH + 50), (250, 247, 240))
    canvas.paste(over.image, (PAD, 70))
    d = ImageDraw.Draw(canvas)
    d.text((PAD, 22), "MEG3N'S TOY FACTORY  ·  E2M7 layout", fill=INK, font=title)
    for i, (site, box) in enumerate(insets):
        bw, bh = box[2] - box[0], box[3] - box[1]; s = min(IW / bw, IH / bh)
        view = View(m, polys, box, s, (240, 236, 228)); view.fill()
        vd = ImageDraw.Draw(view.image); view.lines(vd, 3)
        if site == 2: vd.rectangle([view.P(864, 1008), view.P(1248, 800)], outline=PUZZLES[2][2], width=2)
        draw_markers(view, vd, small, True)
        x = PAD + i * (IW + GAP)
        canvas.paste(view.image, (int(x + (IW - view.size[0]) / 2), top + 40))
        d.rectangle([x - 1, top + 39, x + IW + 1, top + 41 + IH], outline=(200, 192, 182))
        _, name, colour, *_r = PUZZLES[site]
        d.text((x, top + 10), f'{site + 1}  {SITE_NAMES[site]}  ·  ?puzzle={name}', fill=colour, font=big)
        if site == 2: d.text((x, top + 48 + IH), 'Signers: Robby and WALL-E, either side of the stairs on the line', fill=INK, font=small)
    draw_legend(d, PAD + over.size[0] + 20, small, label, big)
    out = ROOT / 'output/factory/factory-map.png'; out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out); print(out, canvas.size)


SITE_NAMES = ['Zvi Mowshowitz', 'Victoria Krakovna', 'Max Tegmark', 'Paul Christiano', 'Ajeya Cotra']


def draw_legend(d, lx, small, label, big):
    y = 40
    d.text((lx, y), 'WARP FLAGS (local dev server)', fill=INK, font=big); y += 34
    for line in ['http://127.0.0.1:5198/?level=meg3n-factory', '  &puzzle=<name>  (or 1-6). Starts there,', '  facing the puzzle, with wrench + slingshot.']:
        d.text((lx, y), line, fill=INK, font=small); y += 18
    y += 12
    for n, (site, name, colour, _, _, summary) in enumerate(PUZZLES, 1):
        d.ellipse([lx, y, lx + 26, y + 26], fill=colour); d.text((lx + 13, y + 13), str(n), fill='white', font=label, anchor='mm')
        d.text((lx + 36, y + 1), f'&puzzle={name}', fill=colour, font=label); y += 24
        row = ''
        for word in summary.split():
            if d.textlength(row + ' ' + word, font=small) > LEGEND - 80: d.text((lx + 36, y), row.strip(), fill=INK, font=small); y += 17; row = ''
            row += ' ' + word
        d.text((lx + 36, y), row.strip(), fill=INK, font=small); y += 30
    d.ellipse([lx + 4, y + 4, lx + 22, y + 22], outline='#e67700', width=3)
    d.text((lx + 36, y + 1), '&puzzle=breakroom', fill='#e67700', font=label); y += 24
    d.text((lx + 36, y), 'Inside the refuge, where freed people shelter.', fill=INK, font=small); y += 44
    d.text((lx, y), 'KEY', fill=INK, font=big); y += 30
    for colour, text in [((247, 131, 172), 'paint vat (pink)'), ((120, 112, 140), 'door'), ('#0ca678', 'cage bars'),
                         ('#e64980', 'fabric panel (breakable)'), ('#f08c00', 'playpen gate')]:
        d.rectangle([lx, y + 2, lx + 22, y + 16], fill=colour); d.text((lx + 32, y), text, fill=INK, font=small); y += 22
    d.ellipse([lx + 4, y + 4, lx + 18, y + 18], outline=INK, width=3); d.line([(lx + 11, y + 11), (lx + 26, y + 11)], fill=INK, width=3)
    d.text((lx + 32, y + 2), 'warp start spot and facing', fill=INK, font=small); y += 22
    d.line([(lx, y + 11), (lx + 26, y + 11)], fill='#c92a2a', width=2); d.text((lx + 32, y + 2), 'MEG3N patrol loop (dances while watched)', fill=INK, font=small); y += 22
    d.text((lx, y + 6), 'Room tint = wing colour. Gray dots = toy props.', fill=INK, font=small)
    d.text((lx, y + 26), 'Insets below zoom into each puzzle.', fill=INK, font=small)


if __name__ == '__main__': main()
