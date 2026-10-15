"""The Last Stand gauntlet: set pieces cut from several original maps, joined by airlocks.

scripts/gauntlet.json lists the sections in play order. Each section is a set of
sectors from one original map. Kept sectors keep their original architecture,
heights, materials and lighting. Openings into deleted space become walls, and
adjacent closed doors stay as sealed, jammed doors.

Consecutive sections are joined by a pair of identical airlocks. The exit airlock
is a blast door plus a short room built straight out from the section's exit line.
The next section has the same room at its entrance. Once the door has shut behind
the player, the PDLastStand handler moves them (and anything that followed them in)
to the matching spot in the other airlock. Both rooms are identical and both doors
are shut, so the move is invisible. Then the door ahead opens.

The sections are laid out side by side in one UDMF map that replaces E1M2. The
rescue maps are untouched.

    python3 scripts/build_gauntlet_map.py --check [--setlist f.json] [--out dir]  # validate + render
"""
import copy
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_checkpoint_map import read_map  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WAD = ROOT / 'doom-web/local/DOOM.WAD'
SETLIST = ROOT / 'scripts/gauntlet.json'
OUT = ROOT / 'output/prologue'

# Editor numbers (MAPINFO DoomEdNums).
ROBOTS = {'trooper': 15200, 'squid': 15201, 'enforcer': 15203, 'gunship': 15204, 'assault': 15206}
SPAWN_PAD, SECTION_MARK, AIRLOCK_MARK = 15202, 15207, 15208
# Soldiers (Doom marines) in the four multiplayer colours.
SOLDIERS = [15209, 15210, 15211, 15212]
# Collision (radius, height) of each robot.
SIZE = {15200: (24, 64), 15201: (24, 64), 15206: (24, 64), 15204: (32, 64), 15203: (44, 112)}
ITEMS = {'shotgun': 2001, 'chaingun': 2002, 'rocketlauncher': 2003, 'plasmarifle': 2004, 'bfg': 2006,
         'clip': 2007, 'shells': 2008, 'rocket': 2010, 'stimpack': 2011, 'medikit': 2012,
         'soulsphere': 2013, 'bullets': 2048, 'rockets': 2046, 'shellbox': 2049, 'cell': 2047,
         'cellpack': 17, 'backpack': 8, 'berserk': 2023, 'megaarmor': 2019, 'bluearmor': 2019,
         'greenarmor': 2018, 'armorbonus': 2015, 'healthbonus': 2014}
# Original decorations worth keeping (lamps, pillars, gore, trees, barrels...).
# (38-40, the skull keys, are left out: there are no keys in the war.)
DECOR = {10, 12, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
         41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 60, 61, 62,
         63, 70, 2028, 2035}
# Doom 1 keyed doors become plain doors (no keys in the war); exits are removed.
UNKEY = {26: 1, 27: 1, 28: 1, 32: 31, 33: 31, 34: 31}
EXITS = {11, 51, 52, 124}
# Crushers have no place in a gunfight the player cannot avoid.
CRUSHERS = {6, 25, 49, 73, 77, 141}
TELEPORTS = {39, 97, 125, 126}
SCROLL = {48}
DOOR_LINE_SPECIALS = {1, 26, 27, 28, 31, 32, 33, 34, 117, 118}

# Airlock dimensions, materials and lighting. Both rooms of a pair are identical.
DOOR_DEPTH, ROOM_DEPTH, ROOM_HEIGHT = 16, 192, 128
DOOR_FACE, DOOR_TRACK = 'BIGDOOR2', 'DOORTRAK'
# Noise-like flats: the two rooms of a pair sit at different angles on the 64-unit flat grid.
ROOM_WALL, ROOM_FLOOR, ROOM_CEIL, ROOM_LIGHT = 'SUPPORT2', 'FLAT1', 'CEIL5_1', 176
GATE_BASE = 30000      # door tags: GATE_BASE + 10*pair + (0 exit door, 1 entrance door)
SKY_BASE = 31000       # extra sector tag for per-section sky transfer
LIMIT = 30000          # stay well inside GZDoom's +-32767 coordinates


def flags():
    return dict(skill1=True, skill2=True, skill3=True, skill4=True, skill5=True, single=True, coop=True, dm=True)


class Source:
    """One original map, with oriented sector outlines for geometry queries."""
    cache = {}

    def __new__(cls, name):
        if name not in cls.cache:
            self = super().__new__(cls)
            self.name = name
            self.model, _ = read_map(WAD, name)
            m = self.model
            self.edges = [[] for _ in m['sectors']]
            for i, line in enumerate(m['lines']):
                a, b = (m['vertices'][line[k]] for k in ('v1', 'v2'))
                a, b = (a['x'], a['y']), (b['x'], b['y'])
                self.edges[self.sector(line, 'sidefront')].append((a, b, i))
                if line['sideback'] >= 0:
                    self.edges[self.sector(line, 'sideback')].append((b, a, i))
            cls.cache[name] = self
        return cls.cache[name]

    def sector(self, line, key):
        return self.model['sides'][line[key]]['sector'] if line[key] >= 0 else -1

    def shared(self, s, n):
        """Lines between sector s and sector n, oriented with s on the right."""
        out = []
        for a, b, i in self.edges[s]:
            line = self.model['lines'][i]
            other = self.sector(line, 'sideback') if self.sector(line, 'sidefront') == s else self.sector(line, 'sidefront')
            if other == n:
                out.append((a, b, i))
        return out


def inside(edges, x, y):
    hit = False
    for (x1, y1), (x2, y2), _ in edges:
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def sector_of(polys, x, y):
    for i, (edges, box) in polys.items():
        if box[0] <= x <= box[2] and box[1] <= y <= box[3] and inside(edges, x, y):
            return i
    return -1


def box(edges):
    xs = [p[0] for a, b, _ in edges for p in (a, b)]
    ys = [p[1] for a, b, _ in edges for p in (a, b)]
    return (min(xs), min(ys), max(xs), max(ys))


def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def segments_cross(p1, p2, q1, q2):
    """Proper crossing or overlap of two segments, ignoring shared endpoints."""
    if {p1, p2} & {q1, q2}:
        return False
    d1, d2 = cross(q1, q2, p1), cross(q1, q2, p2)
    d3, d4 = cross(p1, p2, q1), cross(p1, p2, q2)
    if ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0)) and d1 and d2 and d3 and d4:
        return True
    # Collinear overlap (more than a point).
    if d1 == d2 == 0:
        ax = 0 if p1[0] != p2[0] else 1
        lo1, hi1 = sorted((p1[ax], p2[ax]))
        lo2, hi2 = sorted((q1[ax], q2[ax]))
        return min(hi1, hi2) - max(lo1, lo2) > 0.5
    return False


class Section:
    def __init__(self, spec, index):
        self.spec, self.index = spec, index
        self.src = Source(spec['map'])
        m = self.src.model
        self.keep = set(spec['sectors'])
        missing = [s for s in self.keep if not 0 <= s < len(m['sectors'])]
        assert not missing, f"{spec['id']}: no such sectors {missing}"
        # Closed doors leading out of the set stay, sealed: they read as jammed doors.
        self.sealed = set(spec.get('seal', []))
        for s in list(self.keep):
            for a, b, i in self.src.edges[s]:
                line = m['lines'][i]
                for key in ('sidefront', 'sideback'):
                    n = self.src.sector(line, key)
                    if n >= 0 and n not in self.keep:
                        sec = m['sectors'][n]
                        if sec['heightceiling'] <= sec['heightfloor'] and n not in self.ends():
                            self.sealed.add(n)
        self.keep |= self.sealed
        self.warnings = []

    def ends(self):
        return {e['outside'] for e in (self.spec.get('entrance'), self.spec.get('exit')) if e}

    def survey(self):
        """Approximate walk from the entrance (or start) to the exit, plus cut warnings."""
        m, src = self.src.model, self.src
        S = m['sectors']
        lifts = {s for s in self.keep for _, _, i in src.edges[s] if m['lines'][i]['special'] in (10, 21, 62, 88, 120, 121, 122, 123)}
        doors = set()
        for s in self.keep:
            for _, _, i in src.edges[s]:
                line = m['lines'][i]
                if UNKEY.get(line['special'], line['special']) in DOOR_LINE_SPECIALS and line['sideback'] >= 0:
                    doors.add(src.sector(line, 'sideback'))
        doors -= self.sealed

        def passable(s, t, line):
            if t in self.sealed or t not in self.keep:
                return False
            if line['blocking']:
                return False
            if t in doors or s in doors or t in lifts or s in lifts:
                return True
            fs, ft = S[s]['heightfloor'], S[t]['heightfloor']
            gap = min(S[s]['heightceiling'], S[t]['heightceiling']) - max(fs, ft)
            return ft - fs <= 24 and gap >= 56

        if self.spec.get('entrance'):
            origin = self.spec['entrance']['inside']
        else:
            sx, sy, _ = self.spec['start']
            origin = next((s for s in self.spec['sectors'] if inside(src.edges[s], sx, sy)), None)
            if origin is None:
                self.warnings.append('start point is not inside a kept sector')
                return
        seen, stack = {origin}, [origin]
        while stack:
            s = stack.pop()
            for _, _, i in src.edges[s]:
                line = m['lines'][i]
                if line['sideback'] < 0:
                    continue
                t = src.sector(line, 'sideback') if src.sector(line, 'sidefront') == s else src.sector(line, 'sidefront')
                if t not in seen and passable(s, t, line):
                    seen.add(t)
                    stack.append(t)
        self.reachable = seen
        unreached = sorted(set(self.spec['sectors']) - seen)
        if self.spec.get('exit') and self.spec['exit']['inside'] not in seen:
            self.warnings.append(f"exit sector {self.spec['exit']['inside']} looks unreachable from {origin} (approximate walk)")
        if unreached:
            self.warnings.append(f'not reachable on foot (ledges, windows or scenery?): {unreached}')
        hurt = sorted(s for s in self.spec['sectors'] if S[s]['special'] in (4, 5, 7, 11, 16))
        if hurt:
            self.warnings.append(f'damaging floors kept: {hurt}')
        cut_sky = sorted({n for s in self.spec['sectors'] if S[s]['textureceiling'] == 'F_SKY1'
                          for _, _, i in src.edges[s]
                          for n in [src.sector(m['lines'][i], k) for k in ('sidefront', 'sideback')]
                          if n >= 0 and n not in self.keep and n not in self.ends() and S[n]['textureceiling'] == 'F_SKY1'})
        if cut_sky:
            self.warnings.append(f'outdoor area cut against deleted outdoor sectors {cut_sky} (those edges become walls)')

    def attach_edge(self, end):
        """Collinear chain of lines from inside to outside: endpoints, direction, lines."""
        e = self.spec[end]
        s, n = e['inside'], e['outside']
        assert s in self.spec['sectors'], f"{self.spec['id']} {end}: inside sector {s} not in section"
        assert n not in self.keep, f"{self.spec['id']} {end}: outside sector {n} is kept"
        chain = self.src.shared(s, n)
        assert chain, f"{self.spec['id']} {end}: sectors {s} and {n} do not touch"
        (ax, ay), (bx, by), _ = chain[0]
        L = math.hypot(bx - ax, by - ay)
        d = ((bx - ax) / L, (by - ay) / L)
        for a, b, i in chain:
            dd = (b[0] - a[0], b[1] - a[1])
            l = math.hypot(*dd)
            assert abs(dd[0] / l - d[0]) < 1e-6 and abs(dd[1] / l - d[1]) < 1e-6, \
                f"{self.spec['id']} {end}: boundary {s}/{n} is not straight"
            assert abs(cross((ax, ay), (bx, by), a)) < 1e-6, f"{self.spec['id']} {end}: boundary not collinear"
        proj = lambda p: (p[0] - ax) * d[0] + (p[1] - ay) * d[1]
        pts = sorted({p for a, b, _ in chain for p in (a, b)}, key=proj)
        P, Q = pts[0], pts[-1]
        length = proj(Q) - proj(P)
        assert abs(length - sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b, _ in chain)) < 1e-6, \
            f"{self.spec['id']} {end}: boundary {s}/{n} has gaps"
        sec = self.src.model['sectors'][s]
        if sec['heightceiling'] - sec['heightfloor'] < 72:
            self.warnings.append(f'{end}: inside sector {s} is only {sec["heightceiling"] - sec["heightfloor"]} high')
        return dict(P=P, Q=Q, d=d, n=(-d[1], d[0]), length=length, lines=[i for _, _, i in chain],
                    inside=s, floor=sec['heightfloor'], light=sec['lightlevel'], flat=sec['texturefloor'])


def airlock_shape(edge, width, near, far):
    """Door + room outline in world coordinates for one airlock (see module docstring).

    Local frame: x along the edge (P -> Q), y outward. The door spans y 0..DOOR_DEPTH, the
    room DOOR_DEPTH..DOOR_DEPTH+ROOM_DEPTH, `near` = real door width, `far` = fake door width.
    """
    O = ((edge['P'][0] + edge['Q'][0]) / 2, (edge['P'][1] + edge['Q'][1]) / 2)
    u, n = edge['d'], edge['n']
    W = lambda x, y: (round(O[0] + x * u[0] + y * n[0], 3), round(O[1] + x * u[1] + y * n[1], 3))
    a, w, y0, y1 = near / 2, width / 2, DOOR_DEPTH, DOOR_DEPTH + ROOM_DEPTH
    return dict(
        W=W, door=[W(-a, 0), W(-a, y0), W(a, y0), W(a, 0)],
        room=[W(-w, y0), W(-w, y1), W(-far / 2, y1), W(far / 2, y1), W(w, y1), W(w, y0), W(a, y0), W(-a, y0)],
        center=W(0, y0 + ROOM_DEPTH / 2), forward=math.degrees(math.atan2(n[1], n[0])))


class Builder:
    """Accumulates the combined UDMF model."""

    def __init__(self):
        self.vertices, self.sectors, self.sides, self.lines, self.things = [], [], [], [], []
        self.vindex = {}

    def vertex(self, p):
        key = (round(p[0], 3), round(p[1], 3))
        if key not in self.vindex:
            self.vindex[key] = len(self.vertices)
            x, y = key
            self.vertices.append(dict(x=int(x) if x == int(x) else x, y=int(y) if y == int(y) else y))
        return self.vindex[key]

    def side(self, sector, top='-', mid='-', bottom='-', offsetx=0, **extra):
        self.sides.append(dict(offsetx=offsetx, offsety=0, texturetop=top, texturebottom=bottom,
                               texturemiddle=mid, sector=sector, **extra))
        return len(self.sides) - 1

    def line(self, a, b, front, back=-1, **extra):
        self.lines.append({**dict(v1=self.vertex(a), v2=self.vertex(b), sidefront=front, sideback=back,
                                  special=0, id=0, arg0=0, blocking=back < 0, twosided=back >= 0), **extra})
        return len(self.lines) - 1


def check_overlap(section, shape, label, own=()):
    """The airlock must sit in deleted space: no kept wall may cross or sit inside it."""
    src, keep = section.src, section.keep
    outline = shape['door'] + []
    polys = [shape['door'], shape['room']]
    walls = set()
    for s in keep:
        for a, b, i in src.edges[s]:
            if i not in own:             # the attach edge itself is the door's outer face
                walls.add((a, b))
    for poly in polys:
        for k in range(len(poly)):
            p1, p2 = poly[k], poly[(k + 1) % len(poly)]
            for a, b in walls:
                if segments_cross((round(p1[0], 3), round(p1[1], 3)), (round(p2[0], 3), round(p2[1], 3)), a, b):
                    raise ValueError(f"{section.spec['id']} {label}: airlock wall {p1}->{p2} crosses kept wall {a}->{b}")
    # A kept vertex strictly inside the room means a kept sector reaches into it.
    room_edges = [(shape['room'][k], shape['room'][(k + 1) % len(shape['room'])], 0) for k in range(len(shape['room']))]
    for a, b in walls:
        for p in (a, b):
            if p in shape['room'] or p in shape['door']:
                continue
            if inside(room_edges, p[0] + 1e-3, p[1] + 1e-3) and inside(room_edges, p[0] - 1e-3, p[1] - 1e-3):
                raise ValueError(f"{section.spec['id']} {label}: kept vertex {p} lies inside the airlock")
    # And no kept sector may contain the room (airlock poking into a kept area).
    cx, cy = shape['center']
    for s in keep:
        if inside(src.edges[s], cx, cy):
            raise ValueError(f"{section.spec['id']} {label}: airlock room lies inside kept sector {s}")


def build(setlist, block=None, make_wad=None, check_only=False, out=OUT):
    sections = [Section(spec, i) for i, spec in enumerate(setlist['sections'])]
    assert sections[-1].spec.get('finale'), 'Last section must be the finale'
    # Pair airlocks: exit of k with entrance of k+1; widths must match across the pair.
    edges = {}
    for k, sec in enumerate(sections):
        for end in ('entrance', 'exit'):
            if sec.spec.get(end):
                edges[(k, end)] = sec.attach_edge(end)
    for k in range(len(sections) - 1):
        assert (k, 'exit') in edges, f"{sections[k].spec['id']} needs an exit"
        assert (k + 1, 'entrance') in edges, f"{sections[k + 1].spec['id']} needs an entrance"
    assert (0, 'entrance') not in edges, 'The first section starts the fight; it has no entrance'
    shapes = {}
    for k in range(len(sections) - 1):
        ex, en = edges[(k, 'exit')], edges[(k + 1, 'entrance')]
        width = max(ex['length'], en['length'], 96)
        shapes[(k, 'exit')] = airlock_shape(ex, width, ex['length'], en['length'])
        shapes[(k + 1, 'entrance')] = airlock_shape(en, width, en['length'], ex['length'])
    problems = []
    for (k, end), shape in shapes.items():
        try:
            check_overlap(sections[k], shape, end, set(edges[(k, end)]['lines']))
        except ValueError as error:
            problems.append(str(error))
    for sec in sections:
        sec.survey()
        S = sec.src.model['sectors']
        size = box([e for s in sec.keep for e in sec.src.edges[s]])
        print(f"{sec.index + 1}. {sec.spec['id']} ({sec.spec['map']}): {len(sec.spec['sectors'])} sectors "
              f"+ {len(sec.sealed)} sealed doors, {size[2] - size[0]}x{size[3] - size[1]} units, "
              f"robots {sum(len(q['mix']) for q in sec.spec.get('squads', []))}")
        for w in sec.warnings:
            print(f"   warning: {w}")
    if problems:
        raise SystemExit('Airlock problems:\n  ' + '\n  '.join(problems))

    # Layout: each section (with its airlocks) in its own slot, left to right in rows.
    boxes = []
    for k, sec in enumerate(sections):
        pts = [p for s in sec.keep for a, b, _ in sec.src.edges[s] for p in (a, b)]
        for end in ('entrance', 'exit'):
            if (k, end) in shapes:
                pts += shapes[(k, end)]['room']
        boxes.append((min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)))
    offsets, x, y, row_h = [], -LIMIT, -LIMIT, 0
    for b in boxes:
        w, h = b[2] - b[0], b[3] - b[1]
        if x + w > LIMIT:
            x, y, row_h = -LIMIT, y + row_h + 1024, 0
        dx, dy = math.floor((x - b[0]) / 64) * 64 + 64, math.floor((y - b[1]) / 64) * 64 + 64
        offsets.append((dx, dy))
        x, row_h = b[0] + dx + w + 1024, max(row_h, h + 64)
    assert y + row_h < LIMIT, 'Sections do not fit in one map'

    B = Builder()
    meta = dict(map='E1M2', sections=[], airlocks=[], pads=[], squads=[], items=[], soldiers=[])
    squad_id = 0
    for k, sec in enumerate(sections):
        spec, src, m = sec.spec, sec.src, sec.src.model
        dx, dy = offsets[k]
        T = lambda p: (p[0] + dx, p[1] + dy)
        first_sector = len(B.sectors)
        base = 1000 * (k + 1)
        smap = {}
        for s in sorted(sec.keep):
            sd = copy.deepcopy(m['sectors'][s])
            if sd['special'] in (9, 11):
                sd['special'] = 0                  # no secrets, no E1M8 exit floor
            if sd.get('id'):
                sd['id'] = base + sd['id']
            if s in sec.sealed:
                sd['id'] = 0               # nothing may open a sealed door
            sd['dropactors'] = bool(sd.get('id'))
            if spec.get('light_floor'):
                sd['lightlevel'] = max(spec['light_floor'], sd['lightlevel'])
            # Open sky looks the same at any height: lift it for headroom (robots, flyers).
            if spec.get('raise_sky') and sd['textureceiling'] == 'F_SKY1':
                sd['heightceiling'] += spec['raise_sky']
            if spec.get('sky') and sd['textureceiling'] == 'F_SKY1':
                sd['moreids'] = str(SKY_BASE + k)
            smap[s] = len(B.sectors)
            B.sectors.append(sd)
        teleport_dest_tags = set()
        for t in m['things']:
            if t['type'] == 14:
                s = next((s for s in sec.keep if inside(src.edges[s], t['x'], t['y'])), None)
                if s is not None and m['sectors'][s]['id']:
                    teleport_dest_tags.add(m['sectors'][s]['id'])
        attach_lines = {}
        for end in ('entrance', 'exit'):
            if (k, end) in edges:
                for i in edges[(k, end)]['lines']:
                    attach_lines[i] = end
        line_new = {}
        for i, line in enumerate(m['lines']):
            fs, bs = src.sector(line, 'sidefront'), src.sector(line, 'sideback')
            fk, bk = fs in sec.keep, bs in sec.keep
            if not fk and not bk:
                continue
            ln = copy.deepcopy(line)
            v1, v2 = m['vertices'][line['v1']], m['vertices'][line['v2']]
            a, b = T((v1['x'], v1['y'])), T((v2['x'], v2['y']))
            front, back = line['sidefront'], line['sideback']
            if not fk:                              # kept sector on the back: flip the line
                a, b, front, back = b, a, back, front
            boundary = not (fk and bk)
            sides_new = []
            for sd_index, keep_side in ((front, True), (back, not boundary)):
                if sd_index < 0 or not keep_side:
                    sides_new.append(-1)
                    continue
                sd = copy.deepcopy(m['sides'][sd_index])
                sd['sector'] = smap[sd['sector']]
                sides_new.append(len(B.sides))
                B.sides.append(sd)
            ln['v1'], ln['v2'] = B.vertex(a), B.vertex(b)
            ln['sidefront'], ln['sideback'] = sides_new
            special = ln['special']
            special = UNKEY.get(special, special)
            if special in EXITS or special in CRUSHERS or i in set(spec.get('strip', [])):
                special = 0
            if special in TELEPORTS and line['id'] not in teleport_dest_tags:
                special = 0
            touches_sealed = fs in sec.sealed or bs in sec.sealed
            if boundary or touches_sealed:
                # Openings into deleted space are walls now; sealed doors stay shut.
                if special not in SCROLL:
                    special = 0
            if boundary:
                fside = B.sides[ln['sidefront']]
                if fside['texturemiddle'] in ('-', ''):
                    fside['texturemiddle'] = next((t for t in (fside['texturetop'], fside['texturebottom'])
                                                   if t not in ('-', '')), spec.get('wall', 'STARTAN3'))
                ln.update(twosided=False, blocking=True)
            ln['special'] = special
            if ln.get('id'):
                ln['id'] = base + ln['id']
                ln['arg0'] = ln['id'] if special else 0
            line_new[i] = len(B.lines)
            B.lines.append(ln)
        # Original decorations (and teleport destinations still in use).
        for t in m['things']:
            if t['type'] not in DECOR and t['type'] != 14:
                continue
            s = next((s for s in sec.keep if inside(src.edges[s], t['x'], t['y'])), None)
            if s is None:
                continue
            if t['type'] == 14 and m['sectors'][s]['id'] not in teleport_dest_tags:
                continue
            nt = copy.deepcopy(t)
            nt['x'], nt['y'] = T((t['x'], t['y']))
            B.things.append(nt)

        # Airlocks.
        for end in ('entrance', 'exit'):
            if (k, end) not in shapes:
                continue
            edge, shape = edges[(k, end)], shapes[(k, end)]
            pair = k if end == 'exit' else k - 1
            tag = GATE_BASE + 10 * pair + (0 if end == 'exit' else 1)
            floor = edge['floor']
            door_sec = len(B.sectors)
            B.sectors.append(dict(heightfloor=floor, heightceiling=floor, texturefloor=edge['flat'],
                                  textureceiling='FLAT20', lightlevel=edge['light'], special=0, id=tag))
            room_sec = len(B.sectors)
            B.sectors.append(dict(heightfloor=floor, heightceiling=floor + ROOM_HEIGHT, texturefloor=ROOM_FLOOR,
                                  textureceiling=ROOM_CEIL, lightlevel=ROOM_LIGHT, special=0, id=0))
            # The section's boundary lines become the door's outer face.
            along = 0
            for i in edge['lines']:
                ln = B.lines[line_new[i]]
                fside = B.sides[ln['sidefront']]
                start = B.vertices[ln['v1']]
                along = (start['x'] - (edge['P'][0] + dx)) * edge['d'][0] + (start['y'] - (edge['P'][1] + dy)) * edge['d'][1]
                fside.update(texturetop=DOOR_FACE, texturemiddle='-', texturebottom='-',
                             offsetx=round(along + (128 - edge['length']) / 2) % 128, offsety=0)
                ln['sideback'] = B.side(door_sec, top=DOOR_FACE, offsetx=0)
                ln.update(twosided=True, blocking=False, special=0, dontpegtop=False, dontpegbottom=False)
            Wt = lambda p: T(p)
            door, room = [Wt(p) for p in shape['door']], [Wt(p) for p in shape['room']]
            plain = dict(nofakecontrast=True)
            # Door jambs and the inner face (door sector on the right of each line).
            B.line(door[0], door[1], B.side(door_sec, mid=DOOR_TRACK, **plain), dontpegbottom=True)
            near = edge['length']
            inner = B.side(door_sec, top=DOOR_FACE)
            B.line(door[1], door[2], inner, B.side(room_sec, top=DOOR_FACE, offsetx=round((128 - near) / 2) % 128, **plain))
            B.line(door[2], door[3], B.side(door_sec, mid=DOOR_TRACK, **plain), dontpegbottom=True)
            # Room walls (clockwise: room on the right). Skip the shared door line (room[6] -> room[7]).
            far = math.dist(room[2], room[3])
            for j in range(len(room)):
                a, b = room[j], room[(j + 1) % len(room)]
                if j == 6 or math.dist(a, b) < 0.5:
                    continue
                if j == 2:   # the far, fake door: identical to the real door seen from inside
                    B.line(a, b, B.side(room_sec, mid=DOOR_FACE, offsetx=round((128 - far) / 2) % 128, **plain),
                           dontpegbottom=True)
                else:
                    B.line(a, b, B.side(room_sec, mid=ROOM_WALL, **plain))
            c = Wt(shape['center'])
            # Players face out of the exit airlock, and into the section from its entrance airlock.
            facing = shape['forward'] if end == 'exit' else (shape['forward'] + 180) % 360
            B.things.append(dict(x=round(c[0], 2), y=round(c[1], 2), angle=round(facing) % 360, type=AIRLOCK_MARK,
                                 arg0=pair + 1, arg1=0 if end == 'exit' else 1, arg2=tag, arg3=room_sec, arg4=door_sec,
                                 **flags()))
            meta['airlocks'].append(dict(pair=pair, role=end, tag=tag, room=room_sec, door=door_sec,
                                         center=[round(c[0], 1), round(c[1], 1)], facing=round(facing) % 360,
                                         floor=floor, width=math.dist(room[0], room[5])))

        # Model of this section in world coordinates, for placement queries.
        polys = {}
        for s, ns in smap.items():
            e = [(T(a), T(b), i) for a, b, i in src.edges[s]]
            polys[ns] = (e, box(e))
        S = B.sectors

        def clear(x, y, sector=None, r=24, h=64, flat=8):
            dd = round(r * .71)
            idx = [sector_of(polys, x + ax, y + ay) for ax, ay in
                   [(0, 0), (r, 0), (-r, 0), (0, r), (0, -r), (dd, dd), (-dd, -dd), (dd, -dd), (-dd, dd)]]
            if -1 in idx:
                return False
            if sector is not None and idx[0] != sector:
                return False
            if any(i in sealed_new or S[i]['special'] in (4, 5, 7, 11, 16) for i in idx):
                return False
            floors = [S[i]['heightfloor'] for i in idx]
            return max(floors) - min(floors) <= flat and \
                all(S[i]['heightceiling'] - S[i]['heightfloor'] >= h for i in idx)

        sealed_new = {smap[s] for s in sec.sealed}
        reachable_new = {smap[s] for s in getattr(sec, 'reachable', sec.keep)}
        # Spawn pads for reinforcements, on a grid over the section's open floor.
        b = box([e for s in sec.keep for e in [(T(a), T(bb), i) for a, bb, i in src.edges[s]]])
        step = spec.get('pad_step', 96 if not spec.get('finale') else 128)
        pads = []
        for py in range(int(b[1] // step) * step + step, int(b[3]), step):
            for px in range(int(b[0] // step) * step + step, int(b[2]), step):
                if clear(px, py, h=72) and sector_of(polys, px, py) in reachable_new:
                    pads.append((px, py))
        cap = spec.get('pad_cap', 160 if not spec.get('finale') else 400)
        if len(pads) > cap:
            pads = pads[::math.ceil(len(pads) / cap)]
        for px, py in pads:
            B.things.append(dict(x=px, y=py, angle=0, type=SPAWN_PAD, arg0=k + 1, **flags()))
        # Squads, dormant until one of them sees the player.
        occupied = []
        squads = []
        for sq in spec.get('squads', []):
            squad_id += 1
            assert squad_id <= 30, 'Room bitmask holds 30 squads'
            sector = smap[sq['sector']]
            e, bb = polys[sector]
            cx, cy = T(sq['near']) if sq.get('near') else ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
            placed = []
            kinds = [ROBOTS[name] for name in sq['mix']]
            for kind in sorted(kinds, key=lambda kd: -SIZE[kd][0]):
                r, h = SIZE[kind]
                cand = [(x, y) for y in range(int(bb[1]) + 40, int(bb[3]) - 31, 32)
                        for x in range(int(bb[0]) + 40, int(bb[2]) - 31, 32) if clear(x, y, sector, r, h)]
                cand.sort(key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
                spot = next(((x, y) for x, y in cand
                             if all((x - a) ** 2 + (y - c) ** 2 >= (r + ra + 16) ** 2 for a, c, ra in occupied)), None)
                if spot is None:
                    raise SystemExit(f"{spec['id']}: no room for {kind} in sector {sq['sector']}")
                x, y = spot
                facing = sq.get('facing', 270)
                B.things.append(dict(x=x, y=y, angle=facing, type=kind, ambush=True, arg0=squad_id, **flags()))
                placed.append([x, y, kind])
                occupied.append((x, y, r))
            squads.append(dict(id=squad_id, section=k, sector=sector, name=sq.get('name', ''), positions=placed))
        # Soldiers already in the fight when we arrive (mid-battle rooms): just inside the
        # entrance by default, clear of its doorway, facing into the room.
        sol = spec.get('soldiers')
        if sol:
            door = None
            if sol.get('at', 'entrance') == 'entrance':
                e = edges[(k, 'entrance')]
                mx, my = (e['P'][0] + e['Q'][0]) / 2, (e['P'][1] + e['Q'][1]) / 2
                depth = sol.get('depth', 224)
                tx, ty = T((mx - e['n'][0] * depth, my - e['n'][1] * depth))
                door = T((mx, my))
                facing = round(math.degrees(math.atan2(-e['n'][1], -e['n'][0]))) % 360
            else:
                tx, ty = T(sol['at'])
                facing = sol.get('facing', 90)
            cand = [(x, y) for y in range(int(ty) - 640, int(ty) + 641, 24) for x in range(int(tx) - 640, int(tx) + 641, 24)
                    if (door is None or math.hypot(x - door[0], y - door[1]) > 140)
                    and sector_of(polys, x, y) in reachable_new and clear(x, y, None, 16, 56)]
            cand.sort(key=lambda p: (p[0] - tx) ** 2 + (p[1] - ty) ** 2)
            for n in range(sol['count']):
                spot = next(((x, y) for x, y in cand
                             if all((x - a) ** 2 + (y - c) ** 2 >= (16 + ra + 24) ** 2 for a, c, ra in occupied)), None)
                if spot is None:
                    raise SystemExit(f"{spec['id']}: no room for soldier {n + 1}")
                x, y = spot
                B.things.append(dict(x=x, y=y, angle=facing, type=SOLDIERS[n % len(SOLDIERS)], **flags()))
                occupied.append((x, y, 16))
                meta['soldiers'].append([x, y, k])
        # Pickups: explicit positions (source coordinates) or the middle of a sector.
        for it in spec.get('items', []):
            kind = ITEMS[it['type']] if isinstance(it['type'], str) else it['type']
            if it.get('at'):
                x, y = T(it['at'])
                where = sector_of(polys, x, y)
                if where not in reachable_new:
                    print(f"   warning: {spec['id']}: {it['type']} at {it['at']} is not on reachable floor")
            else:
                e, bb = polys[smap[it['sector']]]
                cand = [(x, y) for y in range(int(bb[1]) + 24, int(bb[3]) - 23, 16)
                        for x in range(int(bb[0]) + 24, int(bb[2]) - 23, 16) if clear(x, y, smap[it['sector']], 16, 16)]
                cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
                x, y = min(cand, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
            for n in range(it.get('count', 1)):
                B.things.append(dict(x=x + 20 * n, y=y, angle=0, type=kind, **flags()))
            meta['items'].append(dict(section=k, type=it['type'], x=x, y=y, count=it.get('count', 1)))
        if k == 0:
            sx, sy, sa = spec['start']
            x, y = T((sx, sy))
            B.things.append(dict(x=x, y=y, angle=sa, type=1, **flags()))
            meta['spawn'] = [x, y, sa]
        # Per-section sky: a transfer line in a sealed 32-unit cell beside the section.
        if spec.get('sky'):
            cell = len(B.sectors)
            B.sectors.append(dict(heightfloor=0, heightceiling=0, texturefloor='FLAT20', textureceiling='FLAT20',
                                  lightlevel=0, special=0, id=0))
            ox, oy = b[0] - 256, b[1] - 256
            pts = [(ox, oy), (ox, oy + 32), (ox + 32, oy + 32), (ox + 32, oy)]
            for j in range(4):
                if j == 0:
                    B.line(pts[0], pts[1], B.side(cell, top=spec['sky'], mid='STARTAN3'),
                           special=271, id=SKY_BASE + k, arg0=SKY_BASE + k)
                else:
                    B.line(pts[j], pts[(j + 1) % 4], B.side(cell, mid='STARTAN3'))
        last_sector = len(B.sectors)
        B.things.append(dict(x=round(B.things[-1]['x']), y=round(B.things[-1]['y']), angle=0, type=SECTION_MARK,
                             arg0=k + 1, arg1=first_sector, arg2=last_sector - first_sector,
                             arg3=1 if spec.get('finale') else 0, arg4=sum(len(s['positions']) for s in squads),
                             **flags()))
        meta['sections'].append(dict(index=k, id=spec['id'], name=spec['name'], map=spec['map'],
                                     offset=[dx, dy], first_sector=first_sector, sector_count=last_sector - first_sector,
                                     finale=bool(spec.get('finale')), pads=len(pads),
                                     robots=sum(len(s['positions']) for s in squads),
                                     bbox=[b[0], b[1], b[2], b[3]], sky=spec.get('sky')))
        meta['squads'] += squads
        meta['pads'] += [[px, py, k] for px, py in pads]

    print(f"Gauntlet: {len(sections)} sections, {len(B.sectors)} sectors, {len(B.lines)} lines, "
          f"{len(B.things)} things, {len(meta['pads'])} pads, {sum(len(s['positions']) for s in meta['squads'])} robots")
    out.mkdir(parents=True, exist_ok=True)
    (out / 'map.json').write_text(json.dumps(meta, indent=1))
    render(B, meta, out / 'gauntlet.png')
    if check_only:
        return None
    parts = ['namespace = "ZDoomTranslated";\n']
    for kind, entries in [('vertex', B.vertices), ('sector', B.sectors), ('sidedef', B.sides),
                          ('linedef', B.lines), ('thing', B.things)]:
        parts.extend(block(kind, **entry) for entry in entries)
    return make_wad([('E1M2', b''), ('TEXTMAP', '\n'.join(parts).encode()), ('ENDMAP', b'')])


def render(B, meta, path):
    """Top-down sheet of the stitched map: sections, airlocks, squads, pads."""
    from PIL import Image, ImageDraw, ImageFont
    xs = [v['x'] for v in B.vertices]
    ys = [v['y'] for v in B.vertices]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    size, pad = 3200, 40
    s = (size - 2 * pad) / max(x1 - x0, y1 - y0)
    W, H = int((x1 - x0) * s) + 2 * pad, int((y1 - y0) * s) + 2 * pad
    P = lambda x, y: (pad + (x - x0) * s, H - pad - (y - y0) * s)
    img = Image.new('RGB', (W, H), (12, 12, 16))
    d = ImageDraw.Draw(img)
    for ln in B.lines:
        a, b = B.vertices[ln['v1']], B.vertices[ln['v2']]
        col = (230, 230, 230) if ln['sideback'] < 0 else (90, 90, 110)
        if ln['special']:
            col = (255, 80, 200)
        d.line([P(a['x'], a['y']), P(b['x'], b['y'])], fill=col, width=2 if ln['sideback'] < 0 else 1)
    for px, py, _ in meta['pads']:
        x, y = P(px, py)
        d.point((x, y), fill=(80, 140, 255))
    for t in B.things:
        x, y = P(t['x'], t['y'])
        if t['type'] in SIZE:
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(255, 60, 60))
        elif t['type'] in SOLDIERS:
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(80, 230, 90))
        elif t['type'] == AIRLOCK_MARK:
            d.rectangle((x - 5, y - 5, x + 5, y + 5), outline=(255, 220, 0), width=2)
        elif t['type'] == 1:
            d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(60, 255, 60))
        elif t['type'] in ITEMS.values():
            d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 255, 255))
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    except OSError:
        font = ImageFont.load_default()
    for sec in meta['sections']:
        bx0, by0, bx1, by1 = sec['bbox']
        x, y = P(bx0, by1)
        d.text((x, y - 34), f"{sec['index'] + 1}. {sec['name']} ({sec['map']})", fill=(255, 210, 120), font=font)
    img.save(path)


def build_prologue(root, block, make_wad):
    """Entry point for build-doom-mod.py: the E1M2 map plus the section names for ZScript."""
    setlist = json.loads(SETLIST.read_text())
    sections = setlist['sections']
    names = ', '.join(json.dumps(s['name']) for s in sections)
    # Soldiers who join the fight: one every N seconds (tics in ZScript), at most M alive.
    every = ', '.join(str(round(s.get('allies', {}).get('every', 0) * 35)) for s in sections)
    most = ', '.join(str(s.get('allies', {}).get('max', 0)) for s in sections)
    # Mid-battle rooms: a machine joins every N seconds from the moment we arrive.
    stream = ', '.join(str(round(s.get('robots', {}).get('every', 0) * 35)) for s in sections)
    battle = ', '.join('1' if s.get('soldiers') else '0' for s in sections)
    def table(kind, fn, values):
        empty = '""' if kind == 'String' else '0'
        return (f'    static {kind} {fn}(int k)\n    {{\n'
                f'        static const {kind} Values[]={{{values}}};\n'
                f'        return k>=0&&k<COUNT?Values[k]:{empty};\n    }}\n')
    (ROOT / 'doom-mod/actors/GauntletData.zs').write_text(
        '// Generated by scripts/build_gauntlet_map.py from scripts/gauntlet.json. Do not edit.\n'
        'class PDGauntletData\n{\n'
        f"    const COUNT={len(sections)};\n"
        + table('String', 'Name', names) + table('int', 'AllyEvery', every) + table('int', 'AllyMax', most)
        + table('int', 'RobotEvery', stream) + table('int', 'Battle', battle) + '}\n')
    return build(setlist, block, make_wad)


if __name__ == '__main__':
    import argparse
    cli = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    cli.add_argument('--check', action='store_true', help='validate and render only (no WAD)')
    cli.add_argument('--setlist', type=Path, default=SETLIST, help='setlist JSON (default scripts/gauntlet.json)')
    # Not output/prologue: QA reads that map.json, which must match the built PK3.
    cli.add_argument('--out', type=Path, default=ROOT / 'output/gauntlet/check',
                     help='where map.json and gauntlet.png go (default output/gauntlet/check)')
    args = cli.parse_args()
    build(json.loads(args.setlist.read_text()), check_only=True, out=args.out)
