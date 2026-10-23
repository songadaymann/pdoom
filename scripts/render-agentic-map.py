#!/usr/bin/env python3
"""Top-down PNG of the built level-4 map: wings, rescues, props, cameras and their cones,
the hardline's two routes, SMITH's patrol, the refuge and the Construct.

Reads output/agentic/E2M2-TEXTMAP.txt and output/agentic/map-debug.json (run
build-agentic-preview.py first) and writes output/agentic/agentic-map.png. Local development
aid; the map derives from the private IWAD's E2M2, so the image stays in ignored output/.
"""
import json, math, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_checkpoint_map import polygon_data

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output/agentic'
INK = (28, 32, 36)
WINGS = dict(refuge='#e8a35c', ward='#e8a3b8', farm='#7d9cc9', harvester='#c0765f', office='#a9bc98', pool='#d9be7c',
             lobby='#d5e6da', east='#6fa3a8', rigs='#e6e2d6', skip='#ffffff')
SITE_COLOURS = ['#d6336c', '#7048e8', '#e8590c', '#2f9e44', '#1971c2']
SITE_NAMES = ['Jaan Tallinn', 'Nick Bostrom', 'Daniel Kokotajlo', 'Katja Grace', 'Yoshua Bengio']
PUZZLES = {1: 'tallinn', 2: 'bostrom', 3: 'kokotajlo', 4: 'grace', 5: 'bengio', 6: 'refuge', 7: 'exit'}
LABELS = {1: 'bridge 1', 5: 'ward 5', 9: 'refuge 9', 12: 'alcove 12', 16: 'band 16', 19: 'booth 19', 3: 'room 3', 25: 'hall 25',
          26: 'dark room 26', 29: 'bay 29', 31: 'hall 31', 32: 'room 32', 34: 'hall 34', 41: 'hall 41', 44: 'hall 44', 49: 'corridor 49',
          52: 'rig 52', 57: 'hall 57', 71: 'red pool 71', 77: 'waiting 77', 81: 'island 81', 84: 'cross hall 84', 99: 'corridor 99',
          119: 'trough 119', 122: 'trough 122', 133: 'trough 133', 124: 'crosswalk 124', 136: 'crosswalk 136', 60: 'secret 60'}


def font(size, bold=True):
    for name in (['Arial Bold.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['Arial.ttf', 'DejaVuSans.ttf']):
        for folder in ['/System/Library/Fonts/Supplemental', '/usr/share/fonts/truetype/dejavu', '/Library/Fonts']:
            path = Path(folder)/name
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


rgb = lambda code: tuple(int(code.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
tint = lambda c, t: tuple(round(a + (255 - a)*t) for a in c)


class View:
    """One window onto the map, drawn into its own image (so it clips)."""
    def __init__(self, m, polys, debug, box, scale):
        self.m, self.polys, self.debug, self.box, self.scale = m, polys, debug, box, scale
        self.size = (int((box[2] - box[0])*scale), int((box[3] - box[1])*scale))
        self.image = Image.new('RGB', self.size, (246, 244, 238)); self.placed = []

    def P(self, x, y):
        return ((x - self.box[0])*self.scale, (self.box[3] - y)*self.scale)

    def colour(self, i):
        d, sec = self.debug, self.m['sectors'][i]
        if i in d['north']: return (226, 224, 220)
        if str(i) in d['goop']: return (90, 220, 120) if d['goop'][str(i)] == 5 else (214, 70, 70)
        if i in (20, 30, 38): return (240, 140, 40)
        if sec['heightceiling'] <= sec['heightfloor']: return (110, 100, 130)
        if i in (2, 21, 23, 46, 48): return (245, 170, 60)
        if i in (51, 54, 55, 56): return (250, 210, 150)
        if i in (119, 122, 133): return (240, 150, 190)
        zones = (d.get('theme') or {}).get('sector_zones')
        return tint(rgb(WINGS.get(zones[i], '#cccccc') if zones and i < len(zones) else '#cccccc'), .35)

    def fill(self):
        bx0, by0, bx1, by1 = self.box; vw, vh = self.size
        img = np.array(self.image)
        for i, (edges, (sx0, sy0, sx1, sy1)) in enumerate(self.polys):
            if not edges or sx1 < bx0 or sx0 > bx1 or sy1 < by0 or sy0 > by1: continue
            c0, c1 = max(0, int((sx0 - bx0)*self.scale)), min(vw, int((sx1 - bx0)*self.scale) + 1)
            r0, r1 = max(0, int((by1 - sy1)*self.scale)), min(vh, int((by1 - sy0)*self.scale) + 1)
            if c0 >= c1 or r0 >= r1: continue
            gx, gy = np.meshgrid(np.arange(c0, c1) + .5, np.arange(r0, r1) + .5)
            mx, my = gx/self.scale + bx0, by1 - gy/self.scale
            inside = np.zeros(mx.shape, bool)
            for ax, ay, ex, ey in edges:
                if ay == ey: continue
                inside ^= ((ay > my) != (ey > my)) & (mx < (ex - ax)*(my - ay)/(ey - ay) + ax)
            img[r0:r1, c0:c1][inside] = self.colour(i)
        self.image = Image.fromarray(img)

    def lines(self, d, width=2):
        m, verts = self.m, self.m['vertices']
        for line in m['lines']:
            a, b = verts[line['v1']], verts[line['v2']]
            pa, pb = self.P(a['x'], a['y']), self.P(b['x'], b['y'])
            if line.get('id') == 7400: d.line([pa, pb], fill='#7048e8', width=width + 2); continue
            if line['sideback'] < 0: d.line([pa, pb], fill=INK, width=width); continue
            if line.get('blocking'): d.line([pa, pb], fill=(90, 90, 110), width=width); continue
            f, k = (m['sectors'][m['sides'][line[s]]['sector']] for s in ('sidefront', 'sideback'))
            if abs(f['heightfloor'] - k['heightfloor']) > 24: d.line([pa, pb], fill=(150, 150, 160), width=1)

    def tag(self, d, xy, text, colour, f):
        x, y = xy
        for dx, dy in [(9, -8), (9, 6), (-9, -8), (-9, 6), (9, -22), (9, 18), (-9, -22), (-9, 18), (9, 32), (9, -36), (14, 46), (-14, -48)]:
            anchor = 'la' if dx > 0 else 'ra'
            box = d.textbbox((x + dx, y + dy), text, font=f, anchor=anchor, stroke_width=3)
            if not any(box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1] for b in self.placed): break
        self.placed.append(box)
        d.text((x + dx, y + dy), text, fill=colour, font=f, anchor=anchor, stroke_width=3, stroke_fill=(255, 255, 255))

    def draw(self, f, small, detail):
        dbg, m = self.debug, self.m
        over = Image.new('RGBA', self.size, (0, 0, 0, 0)); o = ImageDraw.Draw(over)
        rule = dbg['camera_rule']; wide, narrow = rule['scan'] + rule['half_cone'], rule['half_cone'] - rule['scan']
        for c in dbg['cameras']:
            cx, cy = self.P(c['x'], c['y']); r = rule['range']*self.scale
            for half, alpha in [(wide, 38), (narrow, 70)]:
                o.pieslice([cx - r, cy - r, cx + r, cy + r], -c['angle'] - half, -c['angle'] + half,
                           fill=(201, 42, 42, alpha) if c['flags'] != 2 else (120, 120, 120, alpha))
        for (a, b) in dbg['zones'].values():
            o.rectangle([self.P(a[0], b[1]), self.P(b[0], a[1])], outline=(112, 72, 232, 200), width=2)
        self.image = Image.alpha_composite(self.image.convert('RGBA'), over).convert('RGB')
        d = ImageDraw.Draw(self.image); self.lines(d, 2 if detail else 1)
        labels = []
        cable = dbg['cable']
        d.line([self.P(*p) for p in cable['detour']], fill='#f08c00', width=3)
        d.line([self.P(*p) for p in cable['straight']], fill='#c92a2a', width=4)
        d.line([self.P(*p) for p in dbg['patrol'] + dbg['patrol'][:1]], fill='#2b8a3e', width=2)
        for i, p in enumerate(dbg['patrol']):
            px, py = self.P(*p); d.ellipse([px - 4, py - 4, px + 4, py + 4], outline='#2b8a3e', width=2)
        for i, (sec, text) in enumerate(LABELS.items()):
            if sec < len(self.polys) and self.polys[sec][0]:
                x0, y0, x1, y1 = self.polys[sec][1]; px, py = self.P((x0 + x1)/2, (y0 + y1)/2)
                if 0 <= px < self.size[0] and 0 <= py < self.size[1]:
                    d.text((px, py), text, fill=(90, 90, 100), font=small, anchor='mm', stroke_width=2, stroke_fill=(255, 255, 255))
        for c in dbg['cameras']:
            px, py = self.P(c['x'], c['y']); sx, sy = self.P(*c['spot'])
            d.rectangle([px - 6, py - 6, px + 6, py + 6], fill='#c92a2a' if c['flags'] != 2 else '#666', outline='white')
            d.line([(sx - 5, sy - 5), (sx + 5, sy + 5)], fill='#2b8a3e', width=3); d.line([(sx - 5, sy + 5), (sx + 5, sy - 5)], fill='#2b8a3e', width=3)
            name = 'DOOR CAM' if c['index'] == 9 else f"C{c['index'] + 1}" + (' (glass)' if c['flags'] & 1 else '')
            labels.append((px, py, name, '#c92a2a'))
        props = {int(k): v for k, v in dbg['props'].items()}
        for t in m['things']:
            px, py = self.P(t['x'], t['y']); kind = t['type']
            if not (0 <= px < self.size[0] and 0 <= py < self.size[1]): continue
            if kind == 1:
                a = math.radians(t.get('angle', 0))
                d.polygon([(px + 11*math.cos(a), py - 11*math.sin(a)), (px - 7*math.cos(a + 1.2), py + 7*math.sin(a + 1.2)),
                           (px - 7*math.cos(a - 1.2), py + 7*math.sin(a - 1.2))], fill=INK); labels.append((px, py, 'player start', INK))
            elif kind == 15400:
                r = 12 if detail else 9; s = t['arg0']
                d.ellipse([px - r, py - r, px + r, py + r], fill=SITE_COLOURS[s], outline='white', width=2)
                d.text((px, py), str(s + 1), fill='white', font=small, anchor='mm')
                labels.append((px + 6, py, SITE_NAMES[s], SITE_COLOURS[s]))
            elif kind == 15401:
                d.regular_polygon((px, py, 11), 5, fill='#087f5b', outline='white'); labels.append((px, py, 'SMITH', '#087f5b'))
            elif kind == 15402:
                k = t['arg0']; r = 4 if detail else 3
                d.rectangle([px - r, py - r, px + r, py + r], fill='#495057' if k in (22, 23) else '#1971c2', outline='white')
                if detail and k not in (22, 23) or k in (5, 6, 7, 21): labels.append((px, py, props.get(k, f'prop {k}'), '#1864ab'))
            elif kind in (2011, 2012):
                d.line([(px - 4, py), (px + 4, py)], fill='#e03131', width=3); d.line([(px, py - 4), (px, py + 4)], fill='#e03131', width=3)
                if detail: labels.append((px, py, 'medikit' if kind == 2012 else 'stimpack', '#e03131'))
        for k, (x, y, a) in dbg['site_spots'].items():
            px, py = self.P(x, y); ar = math.radians(a)
            if not (0 <= px < self.size[0] and 0 <= py < self.size[1]): continue
            d.ellipse([px - 6, py - 6, px + 6, py + 6], outline='#f59f00', width=3)
            d.line([(px, py), (px + 18*math.cos(ar), py - 18*math.sin(ar))], fill='#f59f00', width=3)
            labels.append((px, py, f'?puzzle={PUZZLES[int(k)]}', '#e67700'))
        for i, p in enumerate(dbg['refuge_slots']):
            px, py = self.P(*p); d.ellipse([px - 3, py - 3, px + 3, py + 3], fill='#e8590c')
        for s in dbg['sites']:
            px, py = self.P(*s['exit']); d.ellipse([px - 3, py - 3, px + 3, py + 3], outline=INK, width=1)
        hx, hy, ha = dbg['hub']; px, py = self.P(hx, hy); d.ellipse([px - 6, py - 6, px + 6, py + 6], outline='#0b7285', width=3)
        labels.append((px, py, 'hub walk-in', '#0b7285'))
        for name, p, colour in [('cable drum', dbg['cable_start'], '#c92a2a'), ('booth jack', dbg['booth_phone'], '#c92a2a'),
                                ('clipboard lands', dbg['stone_shore'], '#2f9e44')]:
            px, py = self.P(*p); d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=colour, outline='white')
            if detail or name != 'clipboard lands': labels.append((px, py, name, colour))
        con = dbg['construct']
        if self.box[1] < con['rect'][3]:
            for name, p in [('arrive (face the box)', con['spawn'][:2]), ('white chair: jack out', con['chair']),
                            ("mind exits", con['mind_exit']), ("Bostrom's mind (box)", con['box'])]:
                px, py = self.P(*p); d.ellipse([px - 6, py - 6, px + 6, py + 6], fill='#7048e8', outline='white')
                labels.append((px, py, name, '#5f3dc4'))
        for px, py, text, colour in labels: self.tag(d, (px, py), text, colour, f)


def main():
    source, debug = OUT/'E2M2-TEXTMAP.txt', OUT/'map-debug.json'
    if not source.exists() or not debug.exists(): raise SystemExit('Run python3 scripts/build-agentic-preview.py first.')
    m, dbg = read_textmap(source), json.loads(debug.read_text())
    polys = polygon_data(m)
    small, label, big, title = font(12, False), font(14), font(20), font(30)
    whole = (-440, -620, 2800, 2420)
    over = View(m, polys, dbg, whole, .42); over.fill(); over.draw(small, small, False)
    insets = [('Refuge, ward and bridge (cold start)', (-400, -600, 260, 40)), ('Booth, band and the hardline', (-200, 340, 1120, 1300)),
              ('Pod farm (Bostrom)', (-80, 940, 860, 1760)), ('Harvester (Kokotajlo)', (280, -480, 1700, 140)),
              ('Pool and island (Grace)', (1560, 880, 1960, 1580)), ('Rig 52 (Bengio)', (1600, 300, 2420, 940)),
              ('The Construct (void, outside the nav grid)', (-40, -1640, 552, -1048))]
    IW, IH, GAP, PAD = 560, 430, 24, 40
    views = []
    for name, box in insets:
        s = min(IW/(box[2] - box[0]), IH/(box[3] - box[1]))
        v = View(m, polys, dbg, box, s); v.fill(); v.draw(small, small, True); views.append((name, v))
    cols = 3; rows = math.ceil(len(views)/cols)
    LEG = 560
    W = max(PAD + over.size[0] + 20 + LEG, PAD + cols*(IW + GAP))
    top = 80 + over.size[1] + 30
    canvas = Image.new('RGB', (W, top + rows*(IH + 70) + 40), (250, 248, 243)); d = ImageDraw.Draw(canvas)
    d.text((PAD, 24), "AGENTIC SMITH'S POD FARM  ·  E2M2 south half (level 4 build)", fill=INK, font=title)
    canvas.paste(over.image, (PAD, 80))
    for n, (name, v) in enumerate(views):
        x = PAD + (n % cols)*(IW + GAP); y = top + (n//cols)*(IH + 70)
        d.text((x, y), name, fill=INK, font=big)
        canvas.paste(v.image, (int(x + (IW - v.size[0])/2), y + 32))
        d.rectangle([x - 1, y + 31, x + IW + 1, y + 33 + IH], outline=(200, 192, 182))
    lx, y = PAD + over.size[0] + 20, 90
    cable = dbg['cable']
    rows_text = [('HARDLINE', big, INK),
                 (f"straight route {cable['straight_length']} u, budget {cable['budget']} u (x1.08)", label, '#c92a2a'),
                 (f"detour (no camera) {cable['detour_length']} u: the drum runs out", label, '#f08c00'),
                 (f"C2 watches {cable['c2_watched']} u of the straight route ({cable['c2_always']} u at every sweep)", small, INK),
                 ('', small, INK), ('CAMERAS', big, INK),
                 (f"level-1 rule: range {dbg['camera_rule']['range']}, scan +-{dbg['camera_rule']['scan']}, cos>.85 (+-{dbg['camera_rule']['half_cone']})", small, INK),
                 ('pale cone: seen at some sweep; dark: at every sweep', small, INK),
                 ('green X: where SMITH materialises (CameraSpot)', small, '#2b8a3e'), ('', small, INK), ('KEY', big, INK)]
    for text, f, colour in rows_text: d.text((lx, y), text, fill=colour, font=f); y += 26 if f is big else 20
    for colour, text in [((90, 220, 120), 'nukage (goop 5)'), ((214, 70, 70), 'red pool and stones (goop 10)'),
                         ((240, 150, 190), 'troughs (walkable gel)'), ((245, 170, 60), 'crushers (tag 7416)'),
                         ((250, 210, 150), 'rig platforms (7450, 7451-7454)'), ((240, 140, 40), 'booth door 20 / bay doors 30, 38'),
                         ((110, 100, 130), 'ordinary doors (8000+i)'), ((226, 224, 220), 'sealed north warehouse'),
                         ('#7048e8', "Bostrom's box (line id 7400) / route zones")]:
        d.rectangle([lx, y + 2, lx + 22, y + 16], fill=colour); d.text((lx + 32, y), text, fill=INK, font=small); y += 21
    for colour, text in [('#c92a2a', 'straight hardline (watched by C2)'), ('#f08c00', 'detour around the band (too long)'),
                         ('#2b8a3e', "SMITH's patrol loop"), ('#f59f00', '?puzzle= start spots and facing'),
                         ('#e8590c', 'refuge slots (orange dots); hollow dots: site exits')]:
        d.line([(lx, y + 9), (lx + 22, y + 9)], fill=colour, width=4); d.text((lx + 32, y), text, fill=INK, font=small); y += 21
    y += 10
    for n, name in enumerate(SITE_NAMES):
        d.ellipse([lx, y, lx + 20, y + 20], fill=SITE_COLOURS[n]); d.text((lx + 10, y + 10), str(n + 1), fill='white', font=small, anchor='mm')
        d.text((lx + 30, y + 2), f'{name}  ?puzzle={PUZZLES[n + 1]}', fill=SITE_COLOURS[n], font=label); y += 26
    out = OUT/'agentic-map.png'; canvas.save(out); print(out, canvas.size)


if __name__ == '__main__': main()
