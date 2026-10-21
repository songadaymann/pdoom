#!/usr/bin/env python3
"""Build Intake's authored architecture, navigation table and Doom resources."""

from collections import deque
import json
import math
from pathlib import Path
import random
import struct
import tempfile
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'doom-mod'
OUTPUT = ROOT / 'doom-web' / 'pdoom.pk3'
KINDS = {'H': 3, 'S': 1, 'M': 1, 'A': 1, 'D': 4, 'B': 5, 'G': 6,
         'K': 8, 'R': 1, 'r': 2, '.': 2, 'P': 7}
OUTDOOR = {'.', 'P', 'r', 'C', 'roof'}
CLOSED = {'D': 'door', 'B': 'breach', 'G': 'rescue', 'K': 'cart'}
DIRECTIONS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def udmf_block(kind, **fields):
    def value(v):
        if isinstance(v, bool):
            return 'true' if v else 'false'
        return json.dumps(v) if isinstance(v, str) else str(v)
    return kind + '\n{\n' + ''.join(
        f'    {key} = {value(val)};\n' for key, val in fields.items()) + '}\n'


def grid(spec):
    rows = list(reversed(spec['rows_north_to_south']))
    assert rows and all(len(row) == len(rows[0]) for row in rows), 'Unequal map rows'
    return rows


def hill_height(y, size):
    return 32 + max(0, y * size - 19 * size) / 10


def materials(kind, x, y, spec):
    size = spec['cell_size']
    fields = dict(heightfloor=0, heightceiling=160, texturefloor='FLOOR0_1',
                  textureceiling='CEIL3_5', lightlevel=168, id=0)
    wall = 'GRAY1'
    if kind == 'H':
        fields.update(texturefloor='FLOOR4_8', lightlevel=192, lightcolor=0xffead0)
    elif kind == 'S':
        fields.update(texturefloor='FLAT5_4', textureceiling='CEIL5_2',
                      lightlevel=192, lightcolor=0xffb0a2)
        wall = 'REDWALL1'
    elif kind == 'M':
        fields.update(texturefloor='FLOOR4_6', lightlevel=176, lightcolor=0xcbdde5)
        wall = 'PIPE2'
    elif kind == 'A':
        fields.update(texturefloor='FLOOR4_8', lightlevel=216, lightcolor=0xffe5ad)
        wall = 'COMPTALL'
    elif kind in OUTDOOR:
        fields.update(heightfloor=32, heightceiling=768, texturefloor='PDGRASS',
                      textureceiling='F_SKY1', lightlevel=240, lightcolor=0xfff7dd)
        wall = 'STONE2'
        if y >= 19:
            fields.update(heightfloor=int(hill_height(y + .5, size)),
                          floorplane_a=0.0, floorplane_b=-0.1,
                          floorplane_c=1.0, floorplane_d=19 * size / 10 - 32)
        if kind == 'P' and y == 23:
            fields['texturefloor'] = 'PDSAFE'
        if kind == 'C':
            fields.update(heightfloor=int(hill_height(y + .5, size)) + 112,
                          texturefloor='FLAT5_4')
            for name in ('floorplane_a', 'floorplane_b', 'floorplane_c', 'floorplane_d'):
                fields.pop(name, None)
        elif kind == 'roof':
            fields.update(heightfloor=176, texturefloor='FLAT5_4')
            for name in ('floorplane_a', 'floorplane_b', 'floorplane_c', 'floorplane_d'):
                fields.pop(name, None)
    elif kind == 'c':
        fields.update(heightfloor=96, texturefloor='FLOOR4_6', lightlevel=184)
        wall = 'CRATE1'
    elif kind == 'W':
        fields.update(heightfloor=32, heightceiling=112, lightlevel=224,
                      texturefloor='FLOOR4_8')
        wall = 'SUPPORT2'
    if kind == 'R':
        # 384-wide ramp rises 32 units smoothly over three 128-unit cells.
        fields.update(heightfloor=round((y - 13 + .5) * 32 / 3),
                      floorplane_a=0.0, floorplane_b=-1 / 12,
                      floorplane_c=1.0, floorplane_d=13 * size / 12,
                      heightceiling=208, texturefloor='FLOOR4_8', lightlevel=208)
        wall = 'SHAWN2'
    elif kind == 'r':
        fields.update(heightfloor=(y - 8) * 16 + 8,
                      floorplane_a=0.0, floorplane_b=-.125,
                      floorplane_c=1.0, floorplane_d=8 * size / 8)
        if x == 6:
            fields['texturefloor'] = 'PDCABLE'
    if kind in CLOSED:
        fields.update(heightfloor=0, heightceiling=0,
                      id=spec['tags'][CLOSED[kind]], lightlevel=192)
        wall = {'D': 'PDDOOR', 'B': 'PDCRACK', 'G': 'PDGATE', 'K': 'CRATE1'}[kind]
    return fields, wall


def build_map(spec):
    rows = grid(spec)
    size, width, height = spec['cell_size'], len(rows[0]), len(rows)
    cells = {(x, y): kind for y, row in enumerate(rows)
             for x, kind in enumerate(row) if kind != '#'}
    # Low facility roofs make the outside read as a building surrounded by a
    # field. Boundary horizons extend the sky/ground beyond the playable map.
    for (x, y), kind in list(cells.items()):
        if kind not in OUTDOOR:
            continue
        for dx, dy in DIRECTIONS:
            p = (x + dx, y + dy)
            if 1 <= p[0] < width - 1 and 1 <= p[1] < height - 1 and p not in cells:
                cells[p] = 'roof'
    vertices, sectors, sides, lines = [], [], [], []
    vertex_ids, edge_records, moving_sectors = {}, {}, {}
    signs = {(tuple(s['cell']), s['edge']): s['texture'] for s in spec['wall_signs']}

    def vertex(point):
        if point not in vertex_ids:
            vertex_ids[point] = len(vertices)
            vertices.append(udmf_block('vertex', x=point[0], y=point[1]))
        return vertex_ids[point]

    for cell, kind in sorted(cells.items(), key=lambda item: (item[0][1], item[0][0])):
        fields, wall = materials(kind, *cell, spec)
        # A broad door must be one sector: independent neighboring closed
        # sectors would find each other's zero ceiling as their opening limit.
        if kind in CLOSED and kind in moving_sectors:
            sector_id = moving_sectors[kind]
        else:
            sector_id = len(sectors)
            sectors.append(udmf_block('sector', **fields))
            if kind in CLOSED:
                moving_sectors[kind] = sector_id
        x, y = cell[0] * size, cell[1] * size
        corners = [(x, y), (x, y + size), (x + size, y + size), (x + size, y)]
        for face, a, b in zip(('west', 'north', 'east', 'south'), corners, corners[1:] + corners[:1]):
            edge_key = tuple(sorted((a, b)))
            rec = (sector_id, cell, kind, signs.get((cell, face), wall))
            if edge_key in edge_records:
                edge_records[edge_key]['back'] = rec
            else:
                edge_records[edge_key] = dict(start=a, end=b, front=rec, back=None)

    for edge in edge_records.values():
        front, back = edge['front'], edge['back']
        if back and front[0] == back[0]:
            continue
        closed = next((side for side in (front, back) if side and side[2] in CLOSED), None)
        window = front[2] == 'W' or (back and back[2] == 'W')
        fields = dict(v1=vertex(edge['start']), v2=vertex(edge['end']), sidefront=len(sides))
        for index, side in enumerate((front, back)):
            if side is None:
                continue
            if index:
                fields.update(sideback=len(sides), twosided=True)
            sides.append(udmf_block('sidedef', sector=side[0],
                texturemiddle='MIDGRATE' if window and back else '-' if back else side[3],
                texturetop=closed[3] if closed else side[3],
                texturebottom=side[3]))
        if not back or window:
            fields['blocking'] = True
        if window:
            fields.update(dontpegbottom=True, blockhitscan=True)
        if not back and front[2] in OUTDOOR:
            # Line_Horizon is a rendering special, never a use/exit action.
            fields['special'] = 9
        lines.append(udmf_block('linedef', **fields))

    common = dict(skill1=True, skill2=True, skill3=True, skill4=True, skill5=True,
                  single=True, coop=True, dm=True)
    p = spec['player']
    things = [udmf_block('thing', type=1, **p, **common)]
    for index, (x, y) in enumerate(spec['companions']):
        things.append(udmf_block('thing', type=15000, id=101 + index,
                                x=x, y=y, angle=90, **common))
    things.append(udmf_block('thing', type=15001, id=201, **spec['hunter'], **common))
    for obj in spec['objects']:
        things.append(udmf_block('thing', **{k: v for k, v in obj.items() if k != 'name'}, **common))
    return ('namespace = "ZDoom";\n' + '\n'.join(vertices + sectors + sides + lines + things)).encode(), len(sectors)


def build_navigation(spec):
    rows = grid(spec)
    width, height, size = len(rows[0]), len(rows), spec['cell_size']
    lines = ['// Generated from map.json by scripts/build-doom-mod.py. Do not edit.',
             'class PDMap : Object', '{',
             f'    static int Width() {{ return {width}; }}',
             f'    static int Height() {{ return {height}; }}',
             f'    static int CellSize() {{ return {size}; }}',
             '    static int Kind(int gx, int gy)', '    {',
             f'        if (gx < 0 || gx >= {width} || gy < 0 || gy >= {height}) return 0;',
             '        switch (gy)', '        {']
    for y, row in enumerate(rows):
        kinds = [KINDS.get(ch, 0) for ch in row]
        if not any(kinds):
            continue
        lines.append(f'        case {y}:')
        x = 0
        while x < width:
            end = x
            while end + 1 < width and kinds[end + 1] == kinds[x]:
                end += 1
            if kinds[x]:
                condition = f'gx == {x}' if x == end else f'gx >= {x} && gx <= {end}'
                lines.append(f'            if ({condition}) return {kinds[x]};')
            x = end + 1
        lines.append('            return 0;')
    parking = spec['cart_parking']
    lines += ['        }', '        return 0;', '    }',
              '    static Vector2 CellCenter(int index)', '    {',
              f'        int gx = index % {width};', f'        int gy = index / {width};',
              f'        return ((gx + 0.5) * {size}, (gy + 0.5) * {size});', '    }',
              f'    static Vector2 CartParking() {{ return ({parking["x"]}.0, {parking["y"]}.0); }}', '}']
    output = SOURCE / 'actors' / 'MapData.zs'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text('\n'.join(lines) + '\n')


def png(width, height, pixels):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(pixels[y * width * 3:(y + 1) * width * 3]) for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


FONT = {
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'D':['11110','10001','10001','10001','10001','10001','11110'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'G':['01111','10000','10000','10111','10001','10001','01111'],
 'H':['10001','10001','10001','11111','10001','10001','10001'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'K':['10001','10010','10100','11000','10100','10010','10001'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 'R':['11110','10001','10001','11110','10100','10010','10001'],
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 'V':['10001','10001','10001','10001','10001','01010','00100'],
 'W':['10001','10001','10001','10101','10101','10101','01010'],
 'X':['10001','10001','01010','00100','01010','10001','10001'],
 'Y':['10001','10001','01010','00100','00100','00100','00100'],
 ' ':['00000']*7,
}


def sign(words, color=(210, 208, 173), danger=False):
    pixels = []
    for y in range(128):
        for x in range(128):
            v = 29 + ((x // 16 + y // 16) % 2) * 3
            rgb = (v, v + 3, v + 2)
            if y < 10 or y >= 118:
                rgb = (209, 149, 56) if ((x + y) // 12) % 2 else (34, 31, 26)
            if danger and x in range(61, 65):
                rgb = (98, 36, 30)
            pixels.extend(rgb)
    scale = 2
    total_h = len(words) * 20
    for row, word in enumerate(words):
        left = (128 - (len(word) * 6 - 1) * scale) // 2
        top = (128 - total_h) // 2 + row * 20
        for i, char in enumerate(word):
            for fy, bits in enumerate(FONT[char]):
                for fx, bit in enumerate(bits):
                    if bit == '1':
                        for yy in range(scale):
                            for xx in range(scale):
                                p = ((top + fy * scale + yy) * 128 + left + i * 12 + fx * 2 + xx) * 3
                                pixels[p:p + 3] = color
    return png(128, 128, pixels)


def artwork():
    assets = {}
    rng = random.Random(1104)
    grass = []
    for y in range(64):
        for x in range(64):
            speck = rng.randint(-8, 8)
            wave = 5 * math.sin(x * .18) * math.cos(y * .15)
            grass.extend((int(83 + speck + wave), int(132 + speck + wave), int(47 + speck / 2)))
    assets['flats/PDGRASS.png'] = png(64, 64, grass)
    stripe, cable = grass.copy(), grass.copy()
    for y in range(64):
        for x in range(64):
            i = (y * 64 + x) * 3
            if y < 12 or y >= 52:
                stripe[i:i + 3] = (237, 237, 196)
            if 27 <= x <= 36:
                cable[i:i + 3] = (31, 42, 34) if x in (27, 28, 35, 36) else (226, 177, 68)
    assets['flats/PDSAFE.png'] = png(64, 64, stripe)
    assets['flats/PDCABLE.png'] = png(64, 64, cable)
    # Original pixel sky: broad cloud banks over a clear blue horizon. GZDoom's
    # eye-level sky view samples the lower half of this 256-high texture, so
    # these banks sit in that range and appear in the north-facing field reveal.
    sky = []
    clouds = [(120, 164, 90, 14), (162, 151, 35, 23), (99, 151, 28, 18),
              (398, 142, 74, 14), (416, 133, 29, 22),
              (654, 175, 94, 16), (684, 161, 35, 25),
              (918, 152, 84, 15), (896, 140, 33, 22)]
    for y in range(256):
        for x in range(1024):
            t = y / 255
            rgb = [int(49 + t * 122), int(122 + t * 79), int(201 + t * 24)]
            cloud_parts = [(cy, ry) for cx, cy, rx, ry in clouds
                           if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1]
            if cloud_parts:
                underside = all(y > cy + ry * .5 for cy, ry in cloud_parts)
                rgb = [220, 233, 230] if underside else [245, 247, 235]
            sky.extend(rgb)
    assets['textures/PDINTSKY.png'] = png(1024, 256, sky)
    labels = {'PDGATE': ['RESCUE', 'GATE'], 'PDMAINT': ['SERVICE', 'PASSAGE'],
              'PDWATCH': ['SURVEIL', 'LANCE'], 'PDARMORY': ['ARMORY'],
              'PDEXIT': ['OUTSIDE', 'EXIT'], 'PDRELAY': ['RESCUE', 'RELAY'],
              'PDDOOR': ['SECURITY', 'DOOR'], 'PDCRACK': ['CRACKED', 'PARTITION']}
    for name, words in labels.items():
        assets[f'textures/{name}.png'] = sign(words, danger=name in ('PDDOOR', 'PDCRACK'))
    # The breakable partition has actual branching fractures, with a small
    # caution band; ordinary structural walls retain stock industrial textures.
    cracked = []
    for y in range(128):
        for x in range(128):
            grain = rng.randint(-7, 7)
            fractured = abs(x - (64 + 11 * math.sin(y * .09) + 4 * math.sin(y * .37))) < 2
            branch = y > 38 and y < 82 and abs(x - (66 + (y - 38) * .9)) < 1.7
            branch |= y > 68 and y < 113 and abs(x - (61 - (y - 68) * .8)) < 1.7
            color = (148 + grain, 149 + grain, 137 + grain)
            if fractured or branch:
                color = (30, 32, 30)
            if y >= 115:
                color = (207, 157, 65) if ((x + y) // 12) % 2 else (40, 39, 34)
            cracked.extend(color)
    assets['textures/PDCRACK.png'] = png(128, 128, cracked)
    return assets


def make_wad(lumps):
    data = bytearray(b'PWAD' + struct.pack('<II', len(lumps), 0))
    directory = []
    for name, payload in lumps:
        directory.append((len(data), len(payload), name.encode('ascii').ljust(8, b'\0')))
        data.extend(payload)
    directory_offset = len(data)
    for offset, length, name in directory:
        data.extend(struct.pack('<II8s', offset, length, name))
    struct.pack_into('<I', data, 8, directory_offset)
    return bytes(data)


def route(rows, start, target, allowed):
    queue = deque([start])
    came = {start: None}
    while queue:
        p = queue.popleft()
        if p == target:
            result = []
            while p is not None:
                result.append(p)
                p = came[p]
            return list(reversed(result))
        for dx, dy in DIRECTIONS:
            q = p[0] + dx, p[1] + dy
            if 0 <= q[1] < len(rows) and 0 <= q[0] < len(rows[0]) and q not in came and rows[q[1]][q[0]] in allowed:
                came[q] = p
                queue.append(q)
    return []


def debug_fixture(spec, sectors):
    rows, size = grid(spec), spec['cell_size']
    def cell(point):
        return int(point[0] // size), int(point[1] // size)
    def centers(path):
        return [[(x + .5) * size, (y + .5) * size] for x, y in path]
    landmarks = spec['debug_landmarks']
    baseline = route(rows, cell(landmarks['holding']), cell(landmarks['permanent_safety']), set('HSMADRr.P'))
    assert baseline, 'Unarmed, unbreached route to safety must exist with ordinary door open'
    start_cell = cell(landmarks['holding'])
    assert KINDS.get(rows[start_cell[1]][start_cell[0]]) == 3
    routes = {}
    legs = [('holding', 'cart_use'), ('after_cart', 'charge'), ('charge', 'breach_use'),
            ('breach_use', 'armory'), ('armory', 'door_use'), ('door_use', 'ramp_base'),
            ('ramp_base', 'field_reveal'), ('field_reveal', 'relay_use'),
            ('relay_use', 'permanent_safety')]
    for a, b in legs:
        p = route(rows, cell(landmarks[a]), cell(landmarks[b]), set('HSMADBGKRr.P'))
        routes[f'{a}_to_{b}'] = centers(p)
    data = dict(name=spec['name'], width=len(rows[0]), height=len(rows), cell_size=size,
                coordinate_system='Doom units; x east, y north; map rows are north to south',
                player=spec['player'], companions=spec['companions'], hunter=spec['hunter'],
                objects=spec['objects'], landmarks=landmarks, tags=spec['tags'],
                cart_parking=spec['cart_parking'], sectors=sectors,
                baseline_route=centers(baseline), baseline_route_units=(len(baseline) - 1) * size,
                routes=routes, rows_north_to_south=spec['rows_north_to_south'])
    path = ROOT / 'output' / 'doom-browser' / 'map-debug.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n')
    return path, data


def resource_files():
    definitions = {'ZSCRIPT', 'MAPINFO', 'TEXTURES', 'SNDINFO', 'SNDSEQ', 'DECORATE',
                   'GLDEFS', 'ANIMDEFS', 'MODELDEF', 'LANGUAGE', 'TERRAIN', 'KEYCONF',
                   'CVARINFO', 'MENUDEF', 'SBARINFO'}
    directories = {'zscript', 'actors', 'sprites', 'patches', 'sounds', 'textures', 'flats', 'graphics', 'music', 'hires'}
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or any(part.startswith('.') for part in path.relative_to(SOURCE).parts):
            continue
        relative = path.relative_to(SOURCE)
        if relative.as_posix() in definitions or relative.parts[0].lower() in directories:
            yield relative.as_posix(), path.read_bytes()


def main():
    from build_checkpoint_map import build_checkpoint
    from build_hal_map import build_hal
    from build_factory_map import build_factory
    from build_gauntlet_map import build_prologue
    spec = json.loads((SOURCE / 'map.json').read_text())
    build_navigation(spec)
    textmap, sectors = build_map(spec)
    fixture, info = debug_fixture(spec, sectors)
    wad = make_wad([('E1M1', b''), ('TEXTMAP', textmap), ('ENDMAP', b'')])
    checkpoint_wad = build_checkpoint(ROOT, udmf_block, make_wad)
    hal_wad=build_hal(ROOT,udmf_block,make_wad)
    factory_wad=build_factory(ROOT,udmf_block,make_wad)
    prologue_wad=build_prologue(ROOT,udmf_block,make_wad)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix='.pdoom-', suffix='.pk3.tmp', dir=OUTPUT.parent, delete=False) as pending:
        temporary = Path(pending.name)
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in resource_files():
                archive.writestr(name, data)
            for name, data in artwork().items():
                archive.writestr(name, data)
            ui = ROOT / 'doom-web/local/ui'
            archive.writestr('graphics/TITLEPIC.png', (ui / 'titlepic.png').read_bytes())
            archive.writestr('graphics/M_DOOM.png', (ui / 'pdoom-logo.png').read_bytes())
            archive.writestr('textures.environment', (SOURCE / 'patches/environment/textures.txt').read_bytes())
            archive.writestr('textures.factory', (SOURCE / 'factory-textures.txt').read_bytes())
            archive.writestr('textures.factorytheme', (SOURCE / 'factory-theme-textures.txt').read_bytes())
            archive.writestr('animdefs.factory', (SOURCE / 'factory-theme-animdefs.txt').read_bytes())
            archive.writestr('gldefs.factory', (SOURCE / 'factory-theme-gldefs.txt').read_bytes())
            archive.writestr('trnslate.factory', (SOURCE / 'factory-theme-trnslate.txt').read_bytes())
            posters = ROOT / 'doom-web/local/posters'
            for asset in sorted(posters.glob('PDP??.png')):
                archive.writestr(f'patches/posters/{asset.name}', asset.read_bytes())
            archive.writestr('textures.posters', (posters / 'TEXTURES.posters.txt').read_bytes())
            archive.writestr('maps/E1M1.wad', wad)
            archive.writestr('maps/E1M4.wad', checkpoint_wad)
            archive.writestr('maps/E1M7.wad',hal_wad)
            archive.writestr('maps/E2M7.wad',factory_wad)
            archive.writestr('maps/E1M2.wad',prologue_wad)
        temporary.replace(OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Built {OUTPUT} ({OUTPUT.stat().st_size} bytes, {sectors} sectors)')
    print(f'Unarmed route: {info["baseline_route_units"]} units; debug fixture: {fixture}')


if __name__ == '__main__':
    main()
