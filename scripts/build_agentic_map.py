"""Private E2M2 (south half) geometry plus AGENTIC SMITH's pod-farm hardware (level 4).

The contract (names, numbers, PDAgenticMap's methods) is docs/LEVEL-04.md plus the level-4
build contract; this file only places things and emits data, Agentic*.zs owns behaviour.
"""
import collections, copy, json, math
from pathlib import Path
from importlib.machinery import SourceFileLoader
from build_checkpoint_map import read_map, polygon_data, sector_at, navigation

GRID = (32, -416, -608, 100, 106)
# Sites in roster order (native index). door = the tag that frees them, bounds = their cell.
SITES = [
    dict(name='Jaan Tallinn', door=7420, prisoner=[36, 680], exit=[32, 496], bounds=[-48, 584, 120, 752]),
    dict(name='Nick Bostrom', door=0, prisoner=[416, 1216], exit=[288, 1152], bounds=[384, 1152, 448, 1280]),
    dict(name='Daniel Kokotajlo', door=7430, prisoner=[852, -212], exit=[880, -160], bounds=[820, -240, 884, -184]),
    dict(name='Katja Grace', door=7460, prisoner=[1760, 1504], exit=[1800, 1104], bounds=[1728, 1472, 1792, 1536]),
    dict(name='Yoshua Bengio', door=7450, prisoner=[2240, 448], exit=[1952, 472], bounds=[2176, 368, 2272, 576]),
]
START = (-272, -330, 0)                        # ward 5, facing the alcove, the window and C1
HUB = (128, -400, 90)                          # room 3 just north of red door 6, facing north
SMITH = (1376, 2017, 270)                      # cross hall 84, his lobby
CABLE_START, BOOTH_PHONE = (1056, 1040), (32, 536)   # drum at the switchboard wall; jack outside the jammed booth door
BOOTH_JACK = (104, 567, 270)                   # the BOOTH 7 jack on the east jamb of the booth door (line 628), facing south
REFUGE_SLOTS = [(-336, -136), (-336, -56), (-288, -136), (-288, -56), (-256, -96)]
REFUGE_PHONE = (-382, -96, 0)                  # the old SW1EXIT niche, facing east into room 9
# ?puzzle= sites 1..7 (pdoom_agentic_site): x, y, facing.
# 3 stands a step back from crusher 2 so the first frame shows the alcove and crusher 21 working.
SITE_SPOTS = {1: (1000, 1040, 0), 2: (176, 1184, 180), 3: (208, -352, 0), 4: (1776, 848, 90),   # hall 41, facing her waiting-room door
              5: (1880, 472, 0), 6: (-296, -96, 0), 7: (-320, -96, 180)}
PATROL = [(1376, 1920), (1376, 1520), (1376, 1040), (1700, 700), (1300, 300), (1000, 800), (480, 840)]
CONSTRUCT = (0, -1600, 512, -1088)
BOX = (256, -1216)                             # Bostrom's box centre, 128 u from the north wall
CONSTRUCT_SPAWN, CONSTRUCT_CHAIR, MIND_EXIT = (256, -1480, 90), (256, -1552), (256, -1352)
CHAIR_RETURN = (112, 1240, 0)
STONE_SHORE = (1744, 1104)
# Route cells native code closes at load and opens on release (CollectNav corners).
ZONES = dict(Booth=((-48, 576), (112, 608)), Bay=((840, -128), (944, -96)), Crusher=((316, -480), (1660, -240)),
             Stone=((1696, 1152), (1936, 1472)), Rig=((1984, 376), (2176, 568)), Bridge=((-128, -192), (0, 0)))
# Cameras (index, wall to hang on: x, y, wall facing; camera angle, height, arg1 flags, explicit spot).
CAMERAS = [
    (0, (212, -100, 180), 147, 38, 0, (120, -150)),  # C1 room 3 across the nukage, level with the bridge: it watches the
    # bridge and nook 7 but never the ward through window 13, nor the hardline detour up room 3. SMITH's spot sits
    # below it, in view of the pod through the window (the cold-start beat).
    (1, (860, 912, 180), 190, 38, 0, None),          # C2 east end of the room-16 band, looking down the straight hardline
    (2, (160, 1276, 270), 270, 38, 0, (240, 1104)),  # C3 pod farm crosswalk 124 (the chair); SMITH appears at the far
    # corner of the crosswalk, not on top of the chair and ChairReturn
    (3, (1888, 864, 225), 255, 38, 0, None),         # C4 hall 41, sees the rig doorway
    (4, (1248, 1668, 90), 75, 38, 0, None),          # C5 cross hall 84
    (5, (1664, 1468, 270), 270, 38, 1, (1664, 1104)),  # C6 pool north wall behind glass: SMITH appears on the shore
    (6, (1316, 0, 0), 340, 38, 0, None),             # C7 hall 34's south-east lobe toward room 40, off the hardline detour
    (7, (1952, -196, 270), 240, 38, 0, None),        # C8 corridor 49, toward crusher 48's exit
    (8, (2308, 304, 0), 340, 38, 0, None),           # C9 east hall 57
    (9, (-236, -48, 180), 180, 16, 2, (-144, -96)),  # door camera beside refuge door 11 (dormant); SMITH waits in nook 7
]
# Level-1 camera rule (RescueCombat.zs): range 480, scan = angle +-20, cos(diff) > .85, sight.
SEE_RANGE, SCAN, HALF = 480, 20, math.degrees(math.acos(.85))
CRUSHERS, STONES, PLATFORMS = [2, 21, 23, 46, 48], [79, 72, 73, 75, 76], {51: 7451, 54: 7452, 55: 7453, 56: 7454}
STAIRS = [93, 94, 95, 96, 97, 98]              # built by W1 638 in Doom: 8..48 up to hall 44 at 64
CLEAR = {1297: 11, 728: 73, 1606: 73, 1607: 73, 1608: 73, 1609: 73, 482: 77, 1564: 77, 687: 74, 1307: 74, 1518: 74,
         1515: 87, 1537: 87, 1538: 87, 1511: 89, 1514: 89, 1549: 89, 907: 89, 1132: 89,
         722: 59, 717: 59, 716: 59, 713: 59, 1563: 59, 638: 8, 24: 2, 29: 103}
# Exits, crushers, perpetual platforms, stones, stairs, teleports and timed lockouts anywhere else.
DEAD = {11, 51, 52, 124, 197, 198, 6, 16, 25, 39, 44, 49, 53, 54, 57, 73, 74, 76, 77, 87, 89, 59, 8, 7, 100, 127, 97, 125, 126, 141}
# Boom generalized floor (0x6000): S1, normal speed, up, to the highest neighbouring floor (64),
# copy the switch room's flat and zero the special. Doom type 20 would stop at the raised pits (40).
BRIDGE_SWITCH = 0x6000 | 2 | 1 << 3 | 1 << 6 | 0 << 7 | 1 << 10
PROP_NAMES = {1: 'wrench', 2: 'slingshot', 3: 'red-team pill', 4: 'drained pod', 5: 'cable drum', 6: 'booth payphone',
              7: 'jack-in chair', 8: 'Construct chair', 9: "Bostrom's pod", 10: 'harvest pod', 11: 'SIGN', 12: "DON'T SIGN",
              13: 'badge reader', 16: 'vase table', 17: 'jailer arm', 18: 'blue socket', 19: 'red socket',
              20: 'yellow socket', 21: 'refuge payphone', 22: 'empty pod', 23: 'battery cell', 24: 'note', 25: 'AGENTS ONLY'}


def build_agentic(root, block, make_wad):
    root = Path(root)
    assets = Path(__file__).with_name('build-agentic-assets.py')
    if assets.exists():
        try: SourceFileLoader('agentic_assets', str(assets)).load_module().build()
        except Exception as error: print(f'WARNING agentic assets skipped: {error!r}')
    else: print('WARNING scripts/build-agentic-assets.py missing: no level-4 sprites or project textures')
    project = root/'doom-mod/agentic-textures.txt'
    project = project.read_text() if project.exists() else ''
    original, _ = read_map(root/'doom-web/local/DOOM.WAD', 'E2M2')
    m = copy.deepcopy(original); m['things'] = []
    S, L, SD, V = m['sectors'], m['lines'], m['sides'], m['vertices']
    for i, want in CLEAR.items(): assert L[i]['special'] == want, (i, L[i]['special'], want)
    assert L[1336]['special'] == 20 and L[1363]['special'] == 2 and L[1363]['arg0'] == 3
    # Sector specials: no damage (Agentic.zs hurts goop) and no secrets, keep the lights.
    for s in S: s['special'] = {4: 2, 5: 0, 7: 0, 9: 0, 11: 0, 16: 0}.get(s['special'], s['special'])
    for i, l in enumerate(L):
        l['special'] = {26: 1, 27: 1, 28: 1, 32: 31, 33: 31, 34: 31}.get(l['special'], l['special'])  # red door 6 opens by push
        if i in CLEAR or l['special'] in DEAD: l.update(special=0, id=0, arg0=0)
    L[1336].update(special=BRIDGE_SWITCH, id=7402, arg0=7402)
    L[1363].update(id=7430, arg0=7430)
    side_sectors = lambda l: [SD[l[k]]['sector'] for k in ('sidefront', 'sideback') if l[k] >= 0]
    # Door 103 loses its walk/switch triggers and becomes an ordinary push door into SMITH's lobby.
    for l in L:
        if l['sideback'] >= 0 and 103 in side_sectors(l) and len(set(side_sectors(l))) == 2: l.update(special=1, id=0, arg0=0)
    # The nukage pits either side of the bridge come up to 40 (a fall is one step from room 3);
    # the moat stays out of reach. The bridge itself stays sunk until the switch or a release,
    # at 16 rather than Doom's -16: still 48 short of nook 7, but a fall onto it is two steps out.
    for i in (0, 14): S[i]['heightfloor'] = 40
    L[1307]['blocking'] = True
    S[1].update(id=7402, heightfloor=16)
    assert S[1]['heightfloor'] + 24 >= S[0]['heightfloor'] and S[0]['heightfloor'] + 24 >= S[3]['heightfloor'] and S[7]['heightfloor'] - S[1]['heightfloor'] > 24
    # Booth 20: a jammed door (Door_Open(7420)), never an escort door.
    booth_door = 'ABOOTH7' if '"ABOOTH7"' in project else 'BIGDOOR2'
    S[20].update(heightceiling=72, id=7420)
    for l in L:
        if l['sideback'] >= 0 and 20 in side_sectors(l):
            l['dontpegtop'] = False
            for k in ('sidefront', 'sideback'): SD[l[k]]['texturetop'] = booth_door
    S[30]['id'] = 7430; S[38]['id'] = 0
    for i in CRUSHERS: S[i]['id'] = 7416
    for i, tag in PLATFORMS.items(): S[i].update(id=7450, moreids=str(tag))
    others = [i for i, s in enumerate(original['sectors']) if s['id'] == 23 and i not in PLATFORMS]
    for i in others: S[i].update(id=0, heightfloor=80)   # the decoy rigs' platforms freeze level with their rooms
    for i in STONES: S[i].update(id=7460, heightfloor=40)
    for k, i in enumerate(STAIRS): S[i]['heightfloor'] = 8 * (k + 1)  # 93 (beside 92, floor 0) is the bottom step
    # Seal the north warehouse at doorways 243 and 221.
    for i in (243, 221):
        S[i].update(heightceiling=S[i]['heightfloor'], id=0)
        for l in L:
            if l['sideback'] >= 0 and i in side_sectors(l):
                l.update(blocking=True, special=0, id=0, arg0=0)
                for k in ('sidefront', 'sideback'): SD[l[k]].update(texturetop=SD[l[k]]['texturetop'] if SD[l[k]]['texturetop'] != '-' else 'METAL', texturemiddle='-')
    adjacent = collections.defaultdict(set)
    for l in L:
        a = side_sectors(l)
        if len(a) == 2: adjacent[a[0]].add(a[1]); adjacent[a[1]].add(a[0])
    south, queue = {5}, collections.deque([5])
    while queue:
        for n in adjacent[queue.popleft()]:
            if n not in south and n not in (243, 221): south.add(n); queue.append(n)
    north = [i for i in range(len(S)) if i not in south]
    assert 84 in south and 9 in south and 81 in south and 146 not in south, 'North seal leaked'

    def vertex(x, y):
        v = dict(x=x, y=y); n = next((i for i, p in enumerate(V) if p == v), None)
        if n is None: n = len(V); V.append(v)
        return n

    def sector(floor, ceiling, flat, light, tag=0):
        S.append(dict(heightfloor=floor, heightceiling=ceiling, texturefloor=flat, textureceiling=flat,
                      lightlevel=light, special=0, id=tag, dropactors=False)); return len(S) - 1

    def ring(points, inside, outside=-1, texture='AWHITE', line_id=0):
        """Clockwise polygon (y up), so every line's front faces in: one-sided walls, or a blocking two-sided box."""
        area = sum(ax*by - bx*ay for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]))
        assert area < 0, ('ring must run clockwise', points)
        for a, b in zip(points, points[1:] + points[:1]):
            l = dict(v1=vertex(*a), v2=vertex(*b), sidefront=len(SD), sideback=-1 if outside < 0 else len(SD) + 1, special=0,
                     id=line_id, arg0=0, blocking=True, twosided=outside >= 0, dontdraw=True, dontpegbottom=outside >= 0)
            if outside >= 0: l['wrapmidtex'] = True
            for s in [inside] + ([outside] if outside >= 0 else []):
                SD.append(dict(offsetx=0, offsety=0, texturetop='-' if outside >= 0 else texture,
                               texturebottom='-' if outside >= 0 else texture, texturemiddle=texture, sector=s))
            L.append(l)

    # The Construct: a sealed white room in the void south of the ward, outside the nav grid,
    # hidden from the automap. Bostrom's mind stands in a doorless 96x96 box that only exists while seen.
    x0, y0, x1, y1 = CONSTRUCT
    construct = sector(0, 160, 'AWHITEF', 255)
    ring([(x0, y1), (x1, y1), (x1, y0), (x0, y0)], construct)
    box = sector(0, 160, 'AWHITEF', 255)
    bx, by = BOX
    ring([(bx - 48, by - 48), (bx - 48, by + 48), (bx + 48, by + 48), (bx + 48, by - 48)], box, construct, 'AWHITE', 7400)

    def actor(x, y, kind, role=0, height=0, angle=0, flags=0):
        t = dict(x=x, y=y, type=kind, arg0=role, height=height, angle=angle,
                 skill1=True, skill2=True, skill3=True, skill4=True, skill5=True, single=True, coop=True, dm=True)
        if flags: t['arg1'] = flags
        m['things'].append(t); return t

    def mount(x, y, facing, off=2, reach=96):
        """The nearest one-sided wall facing that way: a spot `off` units in front of it, held clear of its ends."""
        best = None
        for l in L:
            if l['sideback'] >= 0: continue
            a, b = V[l['v1']], V[l['v2']]
            dx, dy = b['x'] - a['x'], b['y'] - a['y']; length = math.hypot(dx, dy)
            if length < 16: continue
            nx, ny = dy / length, -dx / length  # a one-sided wall's front (room) side is on its right
            if math.cos(math.radians(facing) - math.atan2(ny, nx)) < .7 or (x - a['x'])*nx + (y - a['y'])*ny < 0: continue
            margin = min(16, length / 2) / length
            u = max(margin, min(1 - margin, ((x - a['x'])*dx + (y - a['y'])*dy) / (length*length)))
            px, py = a['x'] + u*dx, a['y'] + u*dy; d = math.hypot(x - px, y - py)
            if best is None or d < best[0]: best = (d, px, py, nx, ny)
        assert best and best[0] < reach, f'No wall facing {facing} near {(x, y)}'
        _, px, py, nx, ny = best
        return round(px + nx*off), round(py + ny*off), round(math.degrees(math.atan2(ny, nx))) % 360

    actor(*START[:2], 1, angle=START[2])
    for i, s in enumerate(SITES): actor(*s['prisoner'], 15400, i, angle=[270, 180, 90, 270, 180][i])
    actor(*SMITH[:2], 15401, angle=SMITH[2])
    props = [(60, -540, 1, 0, 0), (-200, -330, 2, 0, 0), (-172, -412, 3, 0, 0), (-272, -272, 4, 0, 0),
             (CABLE_START[0], CABLE_START[1], 5, 0, 180), (112, 1184, 7, 0, 0), (CONSTRUCT_CHAIR[0], CONSTRUCT_CHAIR[1], 8, 0, 90),
             (352, 1184, 9, 0, 180), (852, -220, 10, 0, 90), (800, -224, 11, 0, 90), (908, -224, 12, 0, 90),
             (1700, 1136, 13, 0, 270), (1888, 992, 16, 0, 225), (2224, 512, 17, 0, 180), (1700, 1138, 25, 56, 270)]
    # Wall sprites: (near x, near y, wall facing, kind, height).
    walls = [(36, 748, 270, 6, 40), (1960, 572, 270, 18, 32), (1960, 372, 90, 19, 32), (1732, 448, 0, 20, 32),
             (-380, -96, 0, 21, 40), (-148, -430, 180, 24, 48)]
    for x, y, facing, kind, z in walls:
        wx, wy, angle = mount(x, y, facing); props.append((wx, wy, kind, z, angle))
    assert (props[-2][0], props[-2][1]) == REFUGE_PHONE[:2], ('refuge payphone moved', props[-2])
    # Drained, empty pods along all three troughs, clear of the crosswalks and of Bostrom's pod.
    props += [(x, y, 22, 0, 90) for x in (-32, 352, 736) for y in (1008, 1376, 1504, 1632)]
    for x, y, kind, z, angle in props: actor(x, y, 15402, kind, z, angle)
    cameras = []
    for index, (wx, wy, facing), angle, z, flags, spot in CAMERAS:
        x, y, _ = mount(wx, wy, facing, 8); actor(x, y, 15403, index, z, angle, flags)
        cameras.append(dict(index=index, x=x, y=y, angle=angle, height=z, flags=flags, spot=spot))
    # Stimpacks. Room 37's (1180, 0) sat behind door 38, which never opens: it waits by the lit pad in room 26.
    for x, y in [(-128, 600), (980, 1200), (1040, 72), (1560, 760), (1400, 1100), (2400, 200)]: actor(x, y, 2011)
    for x, y in [(-348, -148), (-348, -44), (-300, -152)]: actor(x, y, 2012)  # medikits in the refuge
    mine = len(m['things'])
    # Ordinary doors: unique tags for escort nav. Booth 20, bays 30/38 and the seals stay out.
    doors = {}
    for i, s in enumerate(S):
        if s['heightceiling'] <= s['heightfloor'] and i not in (20, 30, 38, 243, 221) and i not in north:
            old = s['id']; new = 8000 + i; s['id'] = new; doors[i] = new
            if old:
                assert not any(t['id'] == old for t in S), f'Door tag {old} is shared'
                for l in L:
                    if l['arg0'] == old and l['special']: l['id'] = new; l['arg0'] = new
    assert 11 in doors and 6 in doors and 103 in doors
    used = sorted({l[k] for l in L for k in ['sidefront', 'sideback'] if l[k] >= 0})
    remap = {old: new for new, old in enumerate(used)}; m['sides'] = SD = [SD[i] for i in used]
    for l in L:
        for k in ['sidefront', 'sideback']:
            if l[k] >= 0: l[k] = remap[l[k]]
    polys = polygon_data(m)
    # Goop from the original flats, before the theme renames them.
    goop = {i: (5 if s['texturefloor'].upper().startswith('NUKAGE') else 10) for i, s in enumerate(S)
            if s['texturefloor'].upper().startswith(('NUKAGE', 'BLOOD')) and i not in north}
    goop_floor = {i: S[i]['heightfloor'] for i in goop}
    flats = dict(stone=S[77]['texturefloor'], bridge=S[12]['texturefloor'])
    extra_zones = {construct: 'skip', box: 'skip'}
    theme_report = None
    try:
        import agentic_theme
        spots = [(t['x'], t['y']) for t in m['things']] + [p[:2] for p in SITE_SPOTS.values()] + PATROL
        if hasattr(agentic_theme, 'dress'):
            for t in agentic_theme.dress(m, polys, spots, extra_zones):
                if sector_at(polys, t['x'], t['y']) not in north + [-1]: m['things'].append(t)  # never the sealed warehouse
        themed = copy.deepcopy(m)
        theme_report = agentic_theme.apply(themed, polys, root/'doom-web/local/DOOM.WAD', root/'doom-mod', extra_zones=extra_zones)
        m['sides'], m['sectors'] = themed['sides'], themed['sectors']; S, SD = m['sectors'], m['sides']
        flats.update({k: v for k, v in theme_report.get('extra', {}).items() if k in flats})
    except Exception as error:
        print(f'WARNING agentic theme skipped (plain IWAD materials): {error!r}')
    floor_at = lambda x, y: S[sector_at(polys, x, y)]['heightfloor']
    for n, t in enumerate(m['things']):
        s = sector_at(polys, t['x'], t['y'])
        assert s >= 0, f'Agentic actor outside the map: {t}'
        assert n >= mine or s not in goop or t['type'] == 15403 and t.get('arg1', 0) & 1, f'Agentic actor in goop: {t}'
    # Plan every route in its released state; Agentic.zs closes the zones until each release.
    nav_model = copy.deepcopy(m); N = nav_model['sectors']
    N[1]['heightfloor'] = 64
    for i in STONES: N[i]['heightfloor'] = 64
    for i in PLATFORMS: N[i]['heightfloor'] = 80
    N[20]['heightceiling'] = original['sectors'][20]['heightceiling']
    N[30]['heightceiling'] = 156
    for i in goop:
        if i != 1 and i not in STONES: N[i]['heightceiling'] = N[i]['heightfloor']  # never walk goop
    for i in north + others: N[i]['heightceiling'] = N[i]['heightfloor']
    for l in nav_model['lines']:
        if l['id'] == 7400: l['blocking'] = False
    # refuge=(9,10,11): the machine graph stops at nook 7, as SMITH does.
    nav = navigation(nav_model, doors, root/'doom-mod', class_name='PDAgenticMap', sites=SITES, grid=GRID, refuge=(9, 10, 11))

    step, ox, oy, W, H = GRID
    humans, machine = nav['human_links'], nav['links']
    centre = lambda n: (ox + (n % W + .5)*step, oy + (n // W + .5)*step)
    cell = lambda x, y: int((y - oy)//step)*W + int((x - ox)//step)
    moves = [1, -1, W, -W]
    in_refuge = lambda x, y: -400 < x < -168 and -160 < y < -32
    in_construct = lambda x, y: x0 < x < x1 and y0 < y < y1

    def node(p, links=humans):
        gx, gy = int((p[0] - ox)//step), int((p[1] - oy)//step); best = (-1, 1e9)
        for yy in range(max(0, gy - 3), min(H, gy + 4)):
            for xx in range(max(0, gx - 3), min(W, gx + 4)):
                n = yy*W + xx
                if links[n]: d = math.dist(centre(n), p); best = min(best, (n, d), key=lambda b: b[1])
        return best

    def bfs(start, links=humans, avoid=lambda n: False):
        prev = {start: None}; queue = collections.deque([start])
        while queue:
            at = queue.popleft()
            for d, move in enumerate(moves):
                if links[at] >> d & 1 and at + move not in prev and not avoid(at + move): prev[at + move] = at; queue.append(at + move)
        return prev

    def path(a, b, avoid=lambda n: False):
        prev = bfs(node(a)[0], avoid=avoid); at = node(b)[0]
        assert at in prev, f'No walking route {a} -> {b}'
        cells = []
        while at is not None: cells.append(at); at = prev[at]
        return cells[::-1]

    def walkable(p, q, avoid=lambda n: False):
        """Straight segment over linked cells only (diagonal corners need a linked L either way)."""
        steps = max(1, int(math.dist(p, q) / 4)); last = cell(*p)
        for k in range(1, steps + 1):
            c = cell(p[0] + (q[0] - p[0])*k/steps, p[1] + (q[1] - p[1])*k/steps)
            if c == last: continue
            link = lambda u, v: not avoid(v) and any(u + mv == v and humans[u] >> d & 1 for d, mv in enumerate(moves))
            if not (link(last, c) or any(link(last, last + a) and link(last + a, c) for a in moves)): return False
            last = c
        return True

    def pulled(a, b, avoid=lambda n: False):
        points = [a] + [centre(n) for n in path(a, b, avoid)] + [b]; out = [points[0]]; i = 0
        while i < len(points) - 1:
            j = len(points) - 1
            while j > i + 1 and not walkable(points[i], points[j], avoid): j -= 1
            out.append(points[j]); i = j
        return out, sum(math.dist(p, q) for p, q in zip(out, out[1:]))

    # Every floor spot the runtime walks to must sit on the escorts' grid (Node() looks 3 cells out).
    spots = {'HubSpawn': HUB[:2], 'CableStart': CABLE_START, 'BoothPhone': BOOTH_PHONE, 'SmithHome': SMITH[:2],
             'StoneShore': STONE_SHORE, 'ChairReturn': CHAIR_RETURN[:2], 'PlayerStart': START[:2]}
    spots.update({f'SiteSpot{k}': v[:2] for k, v in SITE_SPOTS.items()})
    spots.update({f'SiteExit{i}': tuple(s['exit']) for i, s in enumerate(SITES)})
    spots.update({f'RefugeSlot{i}': p for i, p in enumerate(REFUGE_SLOTS)})
    spots.update({f'PatrolPoint{i}': p for i, p in enumerate(PATROL)})
    for c in cameras:
        if c['spot'] is None:
            a = math.radians(c['angle']); want = (c['x'] + 64*math.cos(a), c['y'] + 64*math.sin(a))
            n, d = node(want); assert n >= 0, f"Camera {c['index']} has no floor in front of it"
            c['spot'] = tuple(round(v) for v in centre(n))
        spots[f"CameraSpot{c['index']}"] = c['spot']
    for name, p in spots.items():
        s = sector_at(polys, *p)
        assert s >= 0 and s not in goop, f'{name} {p} is outside the map or in goop'
        n, d = node(p); assert n >= 0 and d <= 96, f'{name} {p} has no linked human node within 96 u ({d})'
    reach = bfs(node(START[:2])[0])
    for name, p in spots.items():
        assert node(p)[0] in reach, f'{name} {p} unreachable from the player start (released state)'
    for name, p in [('ConstructSpawn', CONSTRUCT_SPAWN[:2]), ('ConstructChair', CONSTRUCT_CHAIR), ('MindExit', MIND_EXIT), ('MindSpot', BOX)]:
        assert sector_at(polys, *p) in (construct, box) and in_construct(*p), name
    assert not (abs(MIND_EXIT[0] - bx) < 64 and abs(MIND_EXIT[1] - by) < 64), 'Mind exit inside the box'
    for n, links in enumerate(machine):
        if links: assert not in_refuge(*centre(n)), f'Machine graph enters the refuge at {centre(n)}'
        for d, move in enumerate(moves):
            if links >> d & 1: assert not in_refuge(*centre(n + move)), f'Machine graph links into the refuge at {centre(n + move)}'
    assert all(not in_construct(*centre(n)) for n in range(W*H)), 'Construct overlaps the nav grid'
    # Agentic.zs closes these zones at load (CollectNav + OpenNav false: the cells keep incoming
    # links but lose their own, so each zone becomes a dead end). Closed, every captive is cut
    # off; each zone opened alone frees its own captive's walk out.
    gates = dict(Booth=[0], Bay=[2], Crusher=[2], Stone=[3], Rig=[4], Bridge=[])
    def closed(names):
        links = list(humans)
        for name in names:
            (ax, ay), (bx2, by2) = ZONES[name]
            for n in range(W*H):
                cx, cy = centre(n)
                if links[n] and ax <= cx <= bx2 and ay <= cy <= by2: links[n] = 0
        return links
    def free(links, site):
        prev = bfs(node(SITES[site]['prisoner'], links)[0], links)
        return node(START[:2], links)[0] in prev and node(REFUGE_SLOTS[0], links)[0] in prev
    shut = closed([z for z in ZONES if z != 'Bridge'])
    for site in range(5):
        if site != 1: assert not free(shut, site), f'{SITES[site]["name"]} can walk out with every zone closed'
        assert free(closed([z for z, s in gates.items() if site not in s and z != 'Bridge']), site), f'{SITES[site]["name"]} stays cut off when released'
    shut = closed(ZONES)
    assert node(REFUGE_SLOTS[0], shut)[0] not in bfs(node(START[:2], shut)[0], shut), 'The refuge is reachable with the bridge down'

    # The hardline: budget = the straight human route x1.08; the detour around the band runs longer.
    straight, straight_len = pulled(CABLE_START, BOOTH_PHONE)
    band = lambda n: 272 < centre(n)[0] < 900 and 720 < centre(n)[1] < 944
    detour, detour_len = pulled(CABLE_START, BOOTH_PHONE, band)
    budget = round(straight_len * 1.08)
    assert detour_len > budget * 1.25, f'Detour {detour_len:.0f} is too close to the cable budget {budget}'
    lines = []
    for l in L:
        a, b = V[l['v1']], V[l['v2']]
        sides = [S[SD[l[k]]['sector']] for k in ('sidefront', 'sideback') if l[k] >= 0]
        lines.append((a['x'], a['y'], b['x'], b['y'], None if len(sides) < 2 else
                      (max(s['heightfloor'] for s in sides), min(s['heightceiling'] for s in sides))))

    def sight(p, pz, q, qz):
        for ax, ay, bx2, by2, gap in lines:
            d = (q[0] - p[0])*(by2 - ay) - (q[1] - p[1])*(bx2 - ax)
            if abs(d) < 1e-9: continue
            t = ((ax - p[0])*(by2 - ay) - (ay - p[1])*(bx2 - ax)) / d
            u = ((ax - p[0])*(q[1] - p[1]) - (ay - p[1])*(q[0] - p[0])) / d
            if not (0 < t < 1 and 0 <= u <= 1): continue
            if gap is None: return False
            z = pz + (qz - pz)*t
            if not gap[0] < z < gap[1]: return False
        return True

    def sees(c, p, cone):
        if math.dist((c['x'], c['y']), p) >= SEE_RANGE: return False
        diff = abs((math.degrees(math.atan2(p[1] - c['y'], p[0] - c['x'])) - c['angle'] + 180) % 360 - 180)
        if diff > cone: return False
        eye = floor_at(c['x'], c['y']) + c['height'] + 42
        return any(sight((c['x'], c['y']), eye, p, floor_at(*p) + z) for z in (4, 28, 52))

    def samples(points, spacing=8):
        for p, q in zip(points, points[1:]):
            k = max(1, int(math.dist(p, q) / spacing))
            for i in range(k): yield (p[0] + (q[0] - p[0])*i/k, p[1] + (q[1] - p[1])*i/k), math.dist(p, q)/k
    # The cold-start beat: SMITH at C1's spot is in plain sight from the pod through window 13.
    spot = cameras[0]['spot']
    assert any(sight(START[:2], floor_at(*START[:2]) + 41, spot, floor_at(*spot) + z) for z in (28, 52)), 'Cold-start beat out of sight'
    # The ward is safe: no camera sees into it (or the alcove) through window 13 or door 6.
    ward = [(x, y) for x in range(-312, 256, 16) for y in range(-568, -192, 16) if sector_at(polys, x, y) in (5, 12)]
    for c in cameras:
        seen = [p for p in ward if sees(c, p, SCAN + HALF)]
        assert not seen, f"Camera {c['index']} sees into the ward at {seen[:3]}"
    c2 = cameras[1]
    watched = sum(w for p, w in samples(straight) if sees(c2, p, SCAN + HALF))
    always = sum(w for p, w in samples(straight) if sees(c2, p, HALF - SCAN))
    assert watched >= 256 and always >= 96, f'C2 watches only {watched:.0f} u ({always:.0f} u always) of the straight hardline'
    for c in cameras:
        seen = [p for p, _ in samples(detour) if sees(c, p, SCAN + HALF)]
        assert not seen, f"Camera {c['index']} sees the hardline detour at {seen[:3]}"

    # PDAgenticMap: the appended data the native level reads.
    path_zs = root/'doom-mod/actors/PDAgenticMap.zs'
    v2 = lambda p: f'({p[0]},{p[1]})'
    v3 = lambda p: f'({p[0]},{p[1]},{p[2]})'
    cases = lambda name, kind, items, fallback: (f'    static {kind} {name}{{\n        switch(i){{' +
        ''.join(f'case {k}:return {v};' for k, v in items) + f'}}\n        return {fallback};\n    }}\n')
    code = '    static int BarrierLine(int id,int index){\n'
    for line_id in [7400, 7402, 7430]:
        for n, index in enumerate(i for i, l in enumerate(L) if l['id'] == line_id):
            code += f'        if(id=={line_id}&&index=={n})return {index};\n'
    code += '        return -1;\n    }\n'
    # An original 8-unit door can lie entirely between navigation samples.
    code += '    static int NearbyDoor(Vector2 p){\n        int tag=0;double best=96;double distance;\n'
    for sec, tag in doors.items():
        dx0, dy0, dx1, dy1 = polys[sec][1]
        code += f'        distance=(p-({(dx0 + dx1)/2},{(dy0 + dy1)/2})).Length();if(distance<best){{best=distance;tag={tag};}}\n'
    code += '        return tag;\n    }\n'
    code += f'    static int RefugeDoor(){{return {doors[11]};}}\n'
    code += '    static int GoopDamage(int sector){\n        switch(sector){' + ''.join(
        f'case {i}:' for i in goop if goop[i] == 5) + 'return 5;' + ''.join(f'case {i}:' for i in goop if goop[i] == 10) + 'return 10;}\n        return 0;\n    }\n'
    code += '    static double GoopFloor(int sector){\n        switch(sector){' + ''.join(
        f'case {i}:return {f};' for i, f in goop_floor.items()) + '}\n        return -32768;\n    }\n'
    code += '    static bool InRefuge(Vector2 p){return p.X>-400&&p.X<-168&&p.Y>-160&&p.Y<-32;}\n'
    code += cases('RefugeSlot(int i)', 'Vector2', [(i, v2(p)) for i, p in enumerate(REFUGE_SLOTS)], '(-296,-96)')
    code += f'    static Vector3 RefugePhone(){{return {v3(REFUGE_PHONE)};}}\n'
    code += f'    static Vector3 HubSpawn(){{return {v3(HUB)};}}\n'
    code += cases('SiteSpot(int i)', 'Vector3', [(k, v3(v)) for k, v in SITE_SPOTS.items()], '(0,0,0)')
    code += f'    static int CameraCount(){{return {len(cameras)};}}\n'
    code += cases('CameraSpot(int i)', 'Vector2', [(c['index'], v2(c['spot'])) for c in cameras], '(0,0)')
    code += f'    static int PatrolCount(){{return {len(PATROL)};}}\n'
    code += cases('PatrolPoint(int i)', 'Vector2', [(i, v2(p)) for i, p in enumerate(PATROL)], v2(SMITH))
    code += f'    static Vector3 ConstructSpawn(){{return {v3(CONSTRUCT_SPAWN)};}}\n'
    code += f'    static Vector2 ConstructChair(){{return {v2(CONSTRUCT_CHAIR)};}}\n'
    code += f'    static Vector2 ConstructBox(){{return {v2(BOX)};}}\n'
    code += f'    static Vector2 MindSpot(){{return {v2(BOX)};}}\n'
    code += f'    static Vector2 MindExit(){{return {v2(MIND_EXIT)};}}\n'
    code += f'    static bool InConstruct(Vector2 p){{return p.X>{x0}&&p.X<{x1}&&p.Y>{y0}&&p.Y<{y1};}}\n'
    code += f'    static Vector3 ChairReturn(){{return {v3(CHAIR_RETURN)};}}\n'
    code += f'    static Vector2 CableStart(){{return {v2(CABLE_START)};}}\n'
    code += f'    static Vector2 BoothPhone(){{return {v2(BOOTH_PHONE)};}}\n'
    code += f'    static Vector3 BoothJack(){{return {v3(BOOTH_JACK)};}}\n'
    code += f'    static int CableBudget(){{return {budget};}}\n'
    code += '    static int Crusher(int sector){\n        switch(sector){' + ''.join(f'case {i}:' for i in CRUSHERS) + 'return 1;}\n        return 0;\n    }\n'
    code += f'    static Vector2 StoneShore(){{return {v2(STONE_SHORE)};}}\n'
    code += f'    static String StoneFlat(){{return "{flats["stone"]}";}}\n'
    code += f'    static String BridgeFlat(){{return "{flats["bridge"]}";}}\n'
    code += '    static bool InRigRoom(Vector2 p){return p.X>1920&&p.X<2272&&p.Y>368&&p.Y<576;}\n'
    code += f'    static Vector2 SmithHome(){{return {v2(SMITH)};}}\n'
    for name, (a, b) in ZONES.items():
        code += f'    static Vector2 {name}Zone0(){{return {v2(a)};}}\n    static Vector2 {name}Zone1(){{return {v2(b)};}}\n'
    code += '    static int BridgeSwitch(){return 1336;}\n    static int BayPad(){return 1363;}\n'
    code += '    static int BridgeSector(){return 1;}\n    static double BridgeUpFloor(){return 64;}\n    static double StoneUpFloor(){return 64;}\n'
    code += '    static double RigUpFloor(){return 80;}\n'
    path_zs.write_text(path_zs.read_text().rsplit('}', 1)[0] + code + '}\n')

    text = 'namespace = "ZDoomTranslated";\n' + '\n'.join(block(k, **v) for k, vs in [
        ('vertex', m['vertices']), ('sector', m['sectors']), ('sidedef', m['sides']), ('linedef', m['lines']), ('thing', m['things'])] for v in vs)
    out = root/'output/agentic'; out.mkdir(parents=True, exist_ok=True)
    seen_len = {c['index']: round(sum(w for p, w in samples(straight) if sees(c, p, SCAN + HALF))) for c in cameras}
    debug = dict(map='E2M2', grid=GRID, sites=SITES, start=START, hub=HUB, smith=SMITH, cable_start=CABLE_START,
                 booth_phone=BOOTH_PHONE, refuge_slots=REFUGE_SLOTS, refuge_phone=REFUGE_PHONE, site_spots=SITE_SPOTS,
                 patrol=PATROL, construct=dict(rect=CONSTRUCT, box=BOX, spawn=CONSTRUCT_SPAWN, chair=CONSTRUCT_CHAIR,
                 mind_exit=MIND_EXIT, sectors=[construct, box]), chair_return=CHAIR_RETURN, stone_shore=STONE_SHORE,
                 cameras=cameras, camera_rule=dict(range=SEE_RANGE, scan=SCAN, half_cone=round(HALF, 2)),
                 cable=dict(straight=straight, straight_length=round(straight_len), budget=budget, detour=detour,
                            detour_length=round(detour_len), c2_watched=round(watched), c2_always=round(always), seen_by_camera=seen_len),
                 zones=ZONES, spots=spots, props={k: v for k, v in PROP_NAMES.items()},
                 things=[t for t in m['things']], doors=doors, goop=goop, goop_floor=goop_floor, north=north,
                 flats=flats, theme=None if theme_report is None else {k: v for k, v in theme_report.items() if k != 'materials'},
                 navigation=dict(width=W, height=H, human_links=humans, links=machine, reachable=len(reach)),
                 sectors=m['sectors'], original_vertices_preserved=m['vertices'][:len(original['vertices'])] == original['vertices'])
    (out/'map-debug.json').write_text(json.dumps(debug, indent=1))
    (out/'E2M2-TEXTMAP.txt').write_text(text)
    print(f'E2M2 agentic: cable {straight_len:.0f} u (budget {budget}), detour {detour_len:.0f} u, C2 watches {watched:.0f} u'
          f' ({always:.0f} always), {len(m["things"])} things, {len(doors)} doors, reach {len(reach)} nodes')
    return make_wad([('E2M2', b''), ('TEXTMAP', text.encode()), ('ENDMAP', b'')])


if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    build = SourceFileLoader('doom_builder', str(Path(__file__).with_name('build-doom-mod.py'))).load_module()
    build_agentic(Path(__file__).resolve().parents[1], build.udmf_block, build.make_wad)
