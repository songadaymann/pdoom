"""Original E1M4 -> lossless UDMF baseline plus five rescue overlays.

The IWAD stays private. Only generated, local PK3s contain its derived map.
Original specials use ZDoomTranslated; heights, materials and offsets are copied.
"""
import copy
import hashlib
import json
from pathlib import Path
import struct
from campaign_overlay import add_campaign, site_code, SITES, LANDMARKS


def read_map(path, name='E1M4'):
    blob = path.read_bytes()
    _, count, offset = struct.unpack_from('<4sii', blob)
    lumps = []
    for i in range(count):
        pos, length, raw = struct.unpack_from('<ii8s', blob, offset + 16 * i)
        lumps.append((raw.rstrip(b'\0').decode(), blob[pos:pos + length]))
    start = next(i for i, (label, _) in enumerate(lumps) if label == name)
    data = dict(lumps[start + 1:start + 11])
    string = lambda b: b.rstrip(b'\0').decode('ascii')
    vertices = [dict(x=x, y=y) for x, y in struct.iter_unpack('<hh', data['VERTEXES'])]
    sectors = [dict(heightfloor=f, heightceiling=c, texturefloor=string(ft),
                    textureceiling=string(ct), lightlevel=light, special=special,
                    id=tag, dropactors=bool(tag))
               for f, c, ft, ct, light, special, tag in struct.iter_unpack('<hh8s8shhh', data['SECTORS'])]
    sides = [dict(offsetx=x, offsety=y, texturetop=string(up), texturebottom=string(lo),
                  texturemiddle=string(mid), sector=sector)
             for x, y, up, lo, mid, sector in struct.iter_unpack('<hh8s8s8sH', data['SIDEDEFS'])]
    flag_names = ['blocking', 'blockmonsters', 'twosided', 'dontpegtop',
                  'dontpegbottom', 'secret', 'blocksound', 'dontdraw', 'mapped']
    lines = []
    for a, b, flags, special, tag, front, back in struct.iter_unpack('<7H', data['LINEDEFS']):
        line = dict(v1=a, v2=b, special=special, id=tag, arg0=tag,
                    sidefront=front, sideback=-1 if back == 65535 else back)
        line.update({name: bool(flags & (1 << i)) for i, name in enumerate(flag_names)})
        lines.append(line)
    things = []
    for x, y, angle, kind, flags in struct.iter_unpack('<hhHHH', data['THINGS']):
        things.append(dict(x=x, y=y, angle=angle, type=kind,
                           skill1=bool(flags & 1), skill2=bool(flags & 1),
                           skill3=bool(flags & 2), skill4=bool(flags & 4), skill5=bool(flags & 4),
                           ambush=bool(flags & 8), single=not bool(flags & 16), coop=True, dm=True))
    return dict(vertices=vertices, sectors=sectors, sides=sides, lines=lines, things=things), data


def split_wall(model, index, low, high, tunnel_sector):
    """Split one existing vertical wall; its opening becomes two-sided."""
    line = model['lines'][index]
    a, b = (model['vertices'][line[k]] for k in ['v1', 'v2'])
    assert a['x'] == b['x']
    points = [(a['x'], a['y']), (a['x'], low), (a['x'], high), (b['x'], b['y'])]
    points.sort(key=lambda p: p[1], reverse=a['y'] > b['y'])
    indices = []
    for x, y in points:
        index_v = next((i for i, v in enumerate(model['vertices']) if v == dict(x=x, y=y)), None)
        if index_v is None:
            index_v = len(model['vertices']); model['vertices'].append(dict(x=x, y=y))
        indices.append(index_v)
    old_side = copy.deepcopy(model['sides'][line['sidefront']])
    segments = []
    for i in range(3):
        segment = copy.deepcopy(line)
        segment.update(v1=indices[i], v2=indices[i + 1])
        side = copy.deepcopy(old_side)
        # Preserve texture registration on the remaining solid pieces.
        side['offsetx'] += abs(points[i][1] - a['y'])
        segment['sidefront'] = len(model['sides']); model['sides'].append(side)
        if i == 1:
            segment.update(blocking=False, twosided=True, special=0)
            side.update(texturemiddle='-', texturetop='SHAWN2', texturebottom='SHAWN2', offsetx=0)
            segment['sideback'] = len(model['sides'])
            model['sides'].append(dict(offsetx=0, offsety=0, texturemiddle='-',
                                       texturetop='SHAWN2', texturebottom='SHAWN2', sector=tunnel_sector))
        segments.append(segment)
    model['lines'][index] = segments[0]
    model['lines'].extend(segments[1:])


def overlay(original):
    model = copy.deepcopy(original)
    # Retain original decorative things, replacing combat, supplies and keys.
    decorations = {10, 12, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
                   29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
                   43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
                   57, 59, 60, 61, 62, 63, 70, 2028, 2035}
    model['things'] = [t for t in model['things'] if t['type'] == 1 or t['type'] in decorations]
    # The former secret closet becomes a cell. Original door geometry remains.
    model['sectors'][76]['id'] = 876
    for index in (448, 449):
        model['lines'][index]['special'] = 0
    # Tag ordinary zero-height doors for audible hunter/follower operation.
    door_tags = {}
    for i, sector in enumerate(model['sectors']):
        if sector['heightceiling'] == sector['heightfloor']:
            if sector['id'] == 0:
                sector['id'] = 1000 + i
            door_tags[i] = sector['id']
    # Remove only native exit triggers; no original route advertises escape.
    for line in model['lines']:
        if line['special'] in (11, 51, 52, 124):
            line['special'] = 0
    tunnel = len(model['sectors'])
    model['sectors'].append(dict(heightfloor=0, heightceiling=40, texturefloor='FLAT5',
                                 textureceiling='CEIL5_2', lightlevel=112, special=0, id=877))
    # A winding crawl in unused map space, entering the cell from the far side.
    # The original west cell wall stays closed; the first bend reveals no person.
    split_wall(model, 9, 928, 992, tunnel)
    split_wall(model, 445, 928, 992, tunnel)
    outline = [(1792, 992), (1856, 992), (1856, 864), (1872, 864),
               (1872, 512), (2128, 512), (2128, 928), (1984, 928),
               (1984, 992), (2192, 992), (2192, 448), (1808, 448),
               (1808, 928), (1792, 928)]
    openings = {frozenset(((1792, 928), (1792, 992))),
                frozenset(((1984, 928), (1984, 992)))}
    for a, b in zip(outline, outline[1:] + outline[:1]):
        if frozenset((a, b)) in openings: continue
        ids = []
        for x, y in (a, b):
            vertex = dict(x=x, y=y)
            at = next((i for i, v in enumerate(model['vertices']) if v == vertex), None)
            if at is None:
                at = len(model['vertices']); model['vertices'].append(vertex)
            ids.append(at)
        side = len(model['sides'])
        model['sides'].append(dict(offsetx=0, offsety=0, texturetop='-', texturebottom='-',
                                   texturemiddle='SHAWN2', sector=tunnel))
        wall = copy.deepcopy(original['lines'][0])
        wall.update(v1=ids[0], v2=ids[1], sidefront=side, sideback=-1,
                    blocking=True, twosided=False, special=0, id=0, arg0=0)
        model['lines'].append(wall)
    actors = [
        dict(x=1940, y=952, type=15100, angle=90),  # prisoner
        dict(x=1948, y=1206, height=38, type=15101, angle=255),  # wall-mounted camera
        dict(x=2052, y=1180, type=15102, angle=0),  # wrench
        dict(x=1736, y=1192, type=15103, angle=0),  # optional gun
        dict(x=1930, y=1090, height=34, type=15104, angle=90),  # shootable lock on door
        dict(x=1936, y=928, height=12, type=15105, angle=90),  # inside manual release
        dict(x=-1104, y=1808, type=15106, angle=0),  # hunter, far northwest command room
    ]
    for actor in actors:
        actor.update(skill1=True, skill2=True, skill3=True, skill4=True, skill5=True,
                     single=True, coop=True, dm=True)
    model['things'].extend(actors)
    add_campaign(model, original)
    from importlib.machinery import SourceFileLoader
    first_rescue = SourceFileLoader('first_rescue_overlay', str(Path(__file__).with_name('first-rescue-overlay.py'))).load_module()
    first_rescue.add_first_rescue(model)
    actors = [thing for thing in model['things'] if thing['type'] >= 15100]
    door_tags = {i: s['id'] for i, s in enumerate(model['sectors']) if s['heightfloor'] == s['heightceiling'] or s['id'] == 882}
    # GZDoom 4.11's UDMF loader bounds-checks side indices against the number
    # of side references. Remove the two orphan sides left by splitting walls.
    used = sorted({line[key] for line in model['lines'] for key in ['sidefront', 'sideback']
                   if line.get(key, -1) >= 0})
    remap = {old: new for new, old in enumerate(used)}
    model['sides'] = [model['sides'][i] for i in used]
    for line in model['lines']:
        for key in ['sidefront', 'sideback']:
            if line.get(key, -1) >= 0: line[key] = remap[line[key]]
    return model, door_tags, actors


def polygon_data(model):
    edges = [[] for _ in model['sectors']]
    for line in model['lines']:
        a, b = [model['vertices'][line[k]] for k in ['v1', 'v2']]
        segment = (a['x'], a['y'], b['x'], b['y'])
        for key in ['sidefront', 'sideback']:
            side = line.get(key, -1)
            if side >= 0: edges[model['sides'][side]['sector']].append(segment)
    return [(segments, (min(min(e[0], e[2]) for e in segments), min(min(e[1], e[3]) for e in segments),
                       max(max(e[0], e[2]) for e in segments), max(max(e[1], e[3]) for e in segments))) for segments in edges]


def sector_at(polygons, x, y):
    for i, (edges, bounds) in enumerate(polygons):
        if not bounds[0] <= x <= bounds[2] or not bounds[1] <= y <= bounds[3]: continue
        inside = False
        for ax, ay, bx, by in edges:
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                inside = not inside
        if inside: return i
    return -1


def navigation(model, door_tags, source, *, class_name="PDControlMap", sites=None, grid=None, refuge=(87,88,90,91,92), lifts=()):
    polygons = polygon_data(model)
    # Polygon samples alone miss zero-thickness walls between valid rooms.
    # Match native collision against blocking linedefs, including at each
    # navigation edge midpoint; bucket them to keep generation inexpensive.
    wall_buckets = {}
    for line in model['lines']:
        if line['sideback'] >= 0 and not line.get('blocking'): continue
        a, b = [model['vertices'][line[k]] for k in ['v1', 'v2']]
        segment = (a['x'], a['y'], b['x'], b['y'])
        for by in range(min(a['y'], b['y']) // 64, max(a['y'], b['y']) // 64 + 1):
            for bx in range(min(a['x'], b['x']) // 64, max(a['x'], b['x']) // 64 + 1):
                wall_buckets.setdefault((bx, by), []).append(segment)

    def touches_wall(px, py, radius):
        radius -= .05
        candidates = set()
        for by in range(int((py-radius)//64), int((py+radius)//64)+1):
            for bx in range(int((px-radius)//64), int((px+radius)//64)+1):
                candidates.update(wall_buckets.get((bx, by), []))
        for ax, ay, bx, by in candidates:
            lo, hi = 0.0, 1.0
            for start, delta, center in [(ax, bx-ax, px), (ay, by-ay, py)]:
                if delta == 0:
                    if not center-radius <= start <= center+radius: lo, hi = 1, 0; break
                else:
                    first, last = sorted(((center-radius-start)/delta, (center+radius-start)/delta))
                    lo, hi = max(lo, first), min(hi, last)
            if lo <= hi: return True
        return False
    # Original barrels remain physical obstacles. Give a 19-unit hunter room
    # around their native 10-unit radius rather than routing through them.
    barrels = [(thing['x'], thing['y']) for thing in model['things'] if thing['type'] == 2035 or class_name=='PDHalMap' and thing['type']==2028]
    step,x0,y0,width,height=grid or (32,-1728,-640,123,89)
    samples = [(0, 0), (-20, -20), (20, -20), (-20, 20), (20, 20),
               (-20, 0), (20, 0), (0, -20), (0, 20)]

    def nav_floor(i):
        # Holly controls raise sector 52 to its surrounding 192-unit floor.
        # Plan across that authored raised state; native movement operates it.
        return 112 if class_name=="PDHalMap" and i in (140,141,142) else 192 if class_name=="PDControlMap" and i == 52 else model['sectors'][i]['heightfloor']

    def clear_at(px, py, human=False):
        if touches_wall(px, py, 14 if human else 20): return False, -1, 0
        sectors = [sector_at(polygons, px + dx * (0.7 if human else 1), py + dy * (0.7 if human else 1)) for dx, dy in samples]
        center = sectors[0]
        if center < 0 or any(i < 0 for i in sectors): return False, center, 0
        if not human and any(i in refuge for i in sectors): return False, center, 0
        base = nav_floor(center)
        valid = all((abs(nav_floor(i) - base) <= 24 or i in lifts or center in lifts) and
                    (i in door_tags or model['sectors'][i]['heightceiling'] - model['sectors'][i]['heightfloor'] >= (56 if human else 64))
                    for i in sectors)
        valid = valid and all(abs(px - bx) >= (24 if human else 32) or abs(py - by) >= (24 if human else 32) for bx, by in barrels)
        return valid, center, next((door_tags[i] for i in sectors if i in door_tags), 0)
    # Native collision remains authoritative. This sampled graph is built from
    # original sector polygons, with clearance and floor/step constraints.
    def graph(human):
        mask = []; floors = []; tags = []
        for y in range(height):
            for x in range(width):
                px, py = x0 + (x + .5) * step, y0 + (y + .5) * step
                valid, center, touching_door = clear_at(px, py, human)
                mask.append(1 if valid else 0)
                floors.append(nav_floor(center) if center >= 0 else -9999)
                tags.append(touching_door)
        adjacency = []
        directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        for at, ok in enumerate(mask):
            edge_mask = 0
            if ok:
                gx, gy = at % width, at // width
                for d, (dx, dy) in enumerate(directions):
                    nx, ny = gx + dx, gy + dy
                    if not (0 <= nx < width and 0 <= ny < height): continue
                    neighbor = ny * width + nx
                    if mask[neighbor] and (abs(floors[at] - floors[neighbor]) <= 24 or tags[at] in lifts or tags[neighbor] in lifts):
                        px = x0 + (gx + .5 + dx * .5) * step
                        py = y0 + (gy + .5 + dy * .5) * step
                        if clear_at(px, py, human)[0]: edge_mask |= 1 << d
            adjacency.append(edge_mask)
        return mask, adjacency, tags
    mask, adjacency, tags = graph(False)
    human_mask, human_adjacency, human_tags = graph(True)
    tags = [a or b for a, b in zip(tags, human_tags)]
    code = f'class {class_name} : Object play\n{{\n'
    for name, value in [('Width', width), ('Height', height), ('Step', step), ('OriginX', x0), ('OriginY', y0)]:
        code += f'    static int {name}() {{ return {value}; }}\n'
    code += site_code(sites)
    code += '    static Vector2 DoorPoint(int tag, Vector2 near) { Vector2 best = near; double distance = 999999; Vector2 at;\n'
    for i, tag in door_tags.items():
        bounds = polygons[i][1]; x = (bounds[0] + bounds[2]) / 2; y = (bounds[1] + bounds[3]) / 2
        code += f'        if (tag == {tag}) {{ at = ({x}, {y}); if ((at-near).Length() < distance) {{ best=at; distance=(at-near).Length(); }} }}\n'
    code += '        return best; }\n'

    # Keep the integer row explicit when building a floating-point position.
    code += '    static Vector2 Center(int node) { int row = node / Width(); return (OriginX() + (node % Width() + 0.5) * Step(), OriginY() + (row + 0.5) * Step()); }\n'
    code += '    static void Load(out Array<int> links, out Array<int> humans, out Array<int> doors)\n    {\n'
    code += f'        links.Resize({len(mask)}); humans.Resize({len(mask)}); doors.Resize({len(mask)});\n'
    assignments = [(i, value, human, door) for i, (value, human, door) in enumerate(zip(adjacency, human_adjacency, tags)) if value or human or door]
    batches = [assignments[i:i+64] for i in range(0, len(assignments), 64)]
    # The VM has a finite constant-register budget per function. A single
    # function with thousands of distinct node indices cannot compile.
    for n in range(len(batches)):
        code += f'        Load{n}(links, humans, doors);\n'
    code += '    }\n'
    for n, batch in enumerate(batches):
        code += f'    static void Load{n}(out Array<int> links, out Array<int> humans, out Array<int> doors)\n    {{\n'
        for i, value, human, door in batch:
            if value: code += f'        links[{i}] = {value};\n'
            if human: code += f'        humans[{i}] = {human};\n'
            if door: code += f'        doors[{i}] = {door};\n'
        code += '    }\n'
    code += '}\n'
    (source / 'actors' / (class_name+'.zs')).write_text(code)
    return dict(width=width, height=height, step=step, origin=[x0, y0],
                reachable_nodes=sum(bool(v) for v in adjacency), mask=mask, links=adjacency, human_mask=human_mask, human_links=human_adjacency, door_tags=tags)


def build_checkpoint(root, block, make_wad):
    from build_holly_assets import build_assets
    build_assets(root)
    original, raw = read_map(root / 'doom-web/local/DOOM.WAD')
    model, doors, actors = overlay(original)
    # Hard fidelity assertions: appended geometry never moves original vertices,
    # and all original sector heights/materials/light levels are unchanged.
    assert model['vertices'][:len(original['vertices'])] == original['vertices']
    visual_fields = ['heightfloor', 'heightceiling', 'texturefloor', 'textureceiling', 'lightlevel']
    assert all(all(a[k] == b[k] for k in visual_fields)
               for a, b in zip(original['sectors'], model['sectors']))
    from importlib.machinery import SourceFileLoader
    hardware=SourceFileLoader('wall_hardware',str(Path(__file__).with_name('wall-hardware.py'))).load_module()
    polys=polygon_data(model);mounts=[]
    model['things'].append(dict(x=2080,y=1120,type=15131,height=16,angle=0,skill1=True,skill2=True,skill3=True,skill4=True,skill5=True,single=True,coop=True,dm=True))
    camera_mounts=hardware.cameras(model,polys,sector_at)
    for t in model['things']:
        if t['type'] in [15104,15105,15108,15111,15113,15116,15131,15150,15151,15152,15153]:
            door_tag=SITES[t.get('arg0',0)]['door'] if t['type'] in [15104,15111] else False
            mounts.append(hardware.mount(model,polys,sector_at,t,20 if t['type']==15104 else 32,door=door_tag))
    environment=SourceFileLoader('level_environment',str(Path(__file__).with_name('level-environment.py'))).load_module()
    dressing=environment.dress(model,polys,sector_at)
    nav = navigation(model, doors, root / 'doom-mod')
    parts = ['namespace = "ZDoomTranslated";\n']
    for name, entries in [('vertex', model['vertices']), ('sector', model['sectors']),
                          ('sidedef', model['sides']), ('linedef', model['lines']), ('thing', model['things'])]:
        parts.extend(block(name, **entry) for entry in entries)
    text = '\n'.join(parts).encode()
    fixture = dict(map='E1M4', name='Five Prisons', original_sectors=len(original['sectors']),
                   sectors=len(model['sectors']), original_vertices=len(original['vertices']),
                   original_lines=len(original['lines']), original_visual_fields_preserved=True,
                   source_lump_sha256={k: hashlib.sha256(v).hexdigest() for k, v in raw.items()},
                   actors=actors, environment=dressing, wall_mounts=mounts, camera_mounts=camera_mounts, landmarks=dict(spawn=[2032,1120], wrench=[2052,1180],
                       camera=[1948,1206,38], lock=[1930,1090,34], prisoner=[1940,952],
                       release=[1936,928], service_entry=[1752,960], duct_middle=[2160,480],
                       crawl_route=[[1744,960],[1832,960],[1832,832],[1840,832],
                                    [1840,480],[2160,480],[2160,960],[1940,960]],
                       cell_exit=[1930,1128], gun=[832,1552], hunter=[-1104,1808],
                       intro_bulkheads=[[1400,1152,894],[1400,800,895],[1400,448,897]]),
                   cell_door_tag=876, duct_clearance=40, navigation=nav, sites=SITES, campaign_landmarks=LANDMARKS)
    output = root / 'output/checkpoint'; output.mkdir(parents=True, exist_ok=True)
    (output / 'map-debug.json').write_text(json.dumps(fixture, indent=2) + '\n')
    (output / 'E1M4-TEXTMAP.txt').write_bytes(text)
    return make_wad([('E1M4', b''), ('TEXTMAP', text), ('ENDMAP', b'')])
