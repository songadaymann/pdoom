"""First-rescue quarantine shutters on the east ring's walkable exits."""
import copy

GATES = [(602, 93, 894), (456, 89, 895), (603, 84, 897)]
GUN = [832, 1552]

def add_first_rescue(model):
    def vertex(x, y):
        point = dict(x=x, y=y)
        found = next((i for i, v in enumerate(model['vertices']) if v == point), None)
        if found is None:
            found = len(model['vertices']); model['vertices'].append(point)
        return found
    for index, room, tag in GATES:
        boundary = model['lines'][index]
        a, b = [model['vertices'][boundary[k]] for k in ('v1', 'v2')]
        assert a['x'] == b['x'] == 1408
        low, high = sorted((a['y'], b['y']))
        gate = len(model['sectors'])
        template = model['sectors'][room]
        model['sectors'].append(dict(heightfloor=template['heightfloor'],
            heightceiling=template['heightfloor'], texturefloor=template['texturefloor'],
            textureceiling='FLAT20', lightlevel=160, special=0, id=tag))
        # Put a 16-unit slab in the corridor, preserving every original vertex
        # and room height. The farther service passage shares the rescue lock.
        for key in ('sidefront', 'sideback'):
            side = model['sides'][boundary[key]]
            if side['sector'] == room: side['sector'] = gate
            side.update(texturemiddle='-', texturetop='BIGDOOR2', offsetx=0, offsety=0)
        boundary.update(special=0, dontpegtop=False)
        borders = []
        for j, line in enumerate(model['lines']):
            if j == index: continue
            p, q = [model['vertices'][line[k]] for k in ('v1', 'v2')]
            if p['y'] == q['y'] and p['y'] in (low, high) and max(p['x'],q['x']) == 1408:
                if any(line[k] >= 0 and model['sides'][line[k]]['sector'] == room for k in ('sidefront','sideback')):
                    borders.append(j)
        assert len(borders) == 2, (index, borders)
        for j in borders:
            old = copy.deepcopy(model['lines'][j])
            p, q = [model['vertices'][old[k]] for k in ('v1','v2')]
            pieces = []
            for x1, x2 in zip([p['x'],1392,q['x']], [1392,q['x']]):
                segment = copy.deepcopy(old)
                segment.update(v1=vertex(x1,p['y']),v2=vertex(x2,p['y']))
                for key in ('sidefront','sideback'):
                    if old[key] < 0: continue
                    side = copy.deepcopy(model['sides'][old[key]])
                    side['offsetx'] += abs(x1-p['x'])
                    if min(x1,x2) == 1392 and side['sector'] == room: side['sector'] = gate
                    segment[key] = len(model['sides']); model['sides'].append(side)
                pieces.append(segment)
            model['lines'][j] = pieces[0]; model['lines'].append(pieces[1])
        front = len(model['sides'])
        for sector in (gate, room):
            model['sides'].append(dict(offsetx=0,offsety=0,texturemiddle='-',
                texturetop='BIGDOOR2',texturebottom='-',sector=sector))
        face = copy.deepcopy(boundary)
        face.update(v1=vertex(1392,low),v2=vertex(1392,high),
            sidefront=front,sideback=front+1,special=0,blocking=False,twosided=True)
        model['lines'].append(face)
    for thing in model['things']:
        if thing['type'] == 15103: thing.update(x=GUN[0],y=GUN[1])
