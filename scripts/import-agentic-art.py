#!/usr/bin/env python3
"""Slice the level 4 pack (ignored art/level-04-v1) into native sprites, wall patches and
the hardline HUD image, plus the optional 2026-10-23 additions (art/level-04-redo-2026-10-23:
REDO_PROPS, REDO_FILES, held-badge.png) and SMITH without his badge (ASMU, derived).

The generated sheets stay untouched; this only extracts cells, hardens alpha at 128,
registers multi-state props, scales with nearest-neighbour sampling and writes Doom's
grAb origin. Previews and the manifest go to output/agentic/art/, never the pack.
Every name here has a procedural stand-in in build-agentic-assets.py (same frames).
"""
from pathlib import Path
import hashlib, json, struct, sys
import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ART, MOD, WEB, OUT = ROOT/'art/level-04-v1', ROOT/'doom-mod', ROOT/'doom-web', ROOT/'output/agentic/art'

# Cast (rows A idle, B/C walk, ...; columns = Doom rotations 1-8), 64x64 tiles, feet at (32,64),
# shown at Scale 1. One scale per character, except SMITH's idle and walk rows, which the pack
# draws at different sizes (102 vs 114 px): each of those rows is evened to the same height.
CAST = [('tallinn', 'tallinn-atlas.png', 'ATAL', 56, 3), ('bostrom', 'bostrom-atlas.png', 'ABOS', 56, 3),
        ('kokotajlo', 'kokotajlo-atlas.png', 'AKOK', 56, 3), ('grace', 'grace-atlas.png', 'AGRC', 56, 3),
        ('bengio', 'bengio-atlas.png', 'ABEN', 56, 3), ('smith', 'smith-atlas.png', 'ASMI', 60, 5),
        ('courier', 'courier.png', 'ACOU', 30, 2)]
EVEN_ROWS = {'ASMI': (0, 1, 2)}
OPTIONAL = {'courier', 'posters'}
# SMITH's one-view poses: F earpiece, G survey, H possess (Bright), I reboot. Rotation 0,
# scaled so their median height matches the idle front frame.
POSES = ('smith-poses.png', 'ASMI', 'FGHI')
# Props, shown at Scale .5 (two texels per map unit) unless `scale` says otherwise (PDAgenticProp:
# pods and the harvest pod at 1, matching the cast; the jailer arm at .7). height = tile height in
# texels for the tallest state (a list = one per frame, each frame then stands alone). Anchors: register
# (alpha cross-correlation to the reference state), top (bbox top-left), bottom (bbox
# bottom-centre), body (drum body centre + bottom; the cable tail is ignored for x).
PROPS = [
    dict(id='payphone', file='payphone.png', grid=(3, 1), frames=['APHNA0', 'APHNB0', 'APHNC0'], height=72, anchor='register'),
    dict(id='cable-drum', file='cable-drum.png', grid=(3, 1), frames=['ADRMA0', 'ADRMB0', 'ADRMC0'], height=64, anchor='body'),
    dict(id='pods', file='pods.png', grid=(4, 1), frames=['APODA0', 'APODB0', 'APODC0', 'APODD0'], height=80, anchor='register', scale=1),
    dict(id='jack-chair', file='jack-chair.png', grid=(1, 1), frames=['ACHRA0'], height=96, anchor='bottom'),
    dict(id='harvest-pod', file='harvest-pod.png', grid=(2, 1), frames=['AHRVA0', 'AHRVB0'], height=84, anchor='register', scale=1),
    dict(id='katja-kit', file='katja-kit.png', grid=(5, 1), frames=['ASRVA0', 'ABDGA0', 'ARDRA0', 'ARDRB0', 'AVTBA0'],
         height=[16, 16, 64, 64, 72], anchor='bottom', groups=[[0], [1], [2, 3], [4]]),
    dict(id='jailer-arm', file='jailer-arm.png', grid=(4, 1), frames=['AARMA0', 'AARMB0', 'AARMC0', 'AARMD0'], height=96, anchor='register', scale=.7),
    dict(id='sockets', file='sockets.png', grid=(3, 2), frames=['ASKTA0', 'ASKTB0', 'ASKTC0', 'ASKTD0', 'ASKTE0', 'ASKTF0'],
         height=40, anchor='top', groups=[[0, 3], [1, 4], [2, 5]], scale_with='sheet'),
    dict(id='camera', file='camera.png', grid=(3, 1), frames=['ACAMA0', 'ACAMB0', 'ACAMC0'], height=48, anchor='register'),
    dict(id='pickups', file='pickups.png', grid=(2, 1), frames=['APILA0', 'ABATA0'], height=[16, 40], anchor='bottom', groups=[[0], [1]]),
]
# Opaque wall textures (TEXTURES in doom-mod/agentic-textures.txt), area-averaged to size.
TEXTURES = [('switchboard', 'switchboard.png', (2, 1), ['AXCHON', 'AXCHOFF'], (128, 128)),
            ('booth-door', 'booth-door.png', (1, 1), ['ABOOTH7'], (64, 128)),
            ('posters', 'posters.png', (2, 1), ['APOSTR1', 'APOSTR2'], (64, 128))]
HUD = ('hardline-hands.png', 'hardline.png', (96, 80))  # like slingshot.png: hands rise from the bottom edge
MEADOW = [('tallinn', 'ATAL'), ('bostrom', 'ABOS'), ('kokotajlo', 'AKOK'), ('grace', 'AGRC'), ('bengio', 'ABEN')]

# The optional additions of 2026-10-23 (ignored art/level-04-redo-2026-10-23: its README.md maps the
# frames, quality-report.json has the cells). Each file stands on its own: one that is missing keeps its
# stand-in (build-agentic-assets.py extra_fallbacks, which draws every EXTRA_FRAMES name). They replace
# procedural frames (ASGN, ANOT), the 16 u clipboard (ASRV A) or a reused one (the BOOTH 7 jack was
# ASKT E/B, the dormant door camera ACAM A, the idle arm AARM B), or add a new state.
REDO = ROOT/'art/level-04-redo-2026-10-23'
REDO_PROPS = [
    # BOOTH 7's jack on the booth door's east jamb (AgenticTallinn.zs PDTallinnJack): A empty, B plugged.
    # Plates aligned top-left as the sockets are; the empty jack's dangling lead makes it the taller.
    dict(id='booth-jack', file='booth-jack.png', grid=(2, 1), frames=['AJCKA0', 'AJCKB0'], height=44, anchor='top', scale_with='sheet'),
    # The NDA's push-button panels standing in bay 29: A SIGN, B DON'T SIGN, C/D the same switched off.
    dict(id='sign-panels', file='sign-panels.png', grid=(2, 2), frames=['ASGNA0', 'ASGNB0', 'ASGNC0', 'ASGND0'], height=64, anchor='register'),
    # A THERE IS NO SPOON. (alcove 12's wall), B the AGENTS ONLY plate hung over the badge reader.
    dict(id='wall-notes', file='wall-notes.png', grid=(2, 1), frames=['ANOTA0', 'ANOTB0'], height=[52, 26], anchor='bottom', groups=[[0], [1]]),
    # Katja's survey, at Scale 1 (PDGraceClipboard): 26 u tall, so it reads from about 200 u.
    dict(id='survey-clipboard', file='survey-clipboard.png', grid=(1, 1), frames=['ASRVA0'], height=26, anchor='bottom'),
]
REDO_FILES = dict(unbadged='smith-survey-unbadged.png', dormant='camera-dormant.png', glass='camera-glass.png',
                  idle_arm='jailer-idle.png', rig_cables='rig-cables.png', throw='grace-throw.png', badge='held-badge.png')
EXTRA_FRAMES = ['ASMIJ0', 'AJCKA0', 'AJCKB0', 'ACAMD0', 'ACAME0', 'ASGNC0', 'ASGND0', 'AARME0', 'ACBLB0', 'ACBLC0', 'AGRCD0']
BADGE = ('held-badge.png', 48)  # doom-web/held-badge.png, its width in texels (the hand rises from the bottom edge)
GLASS_BACK = (22, 34, 42)        # what C6's glass case shows behind its tinted pane (its alpha is partial)


def frames():
    """Every native sprite frame this pack provides: {family: [frame names]}."""
    out = {}
    for _, _, prefix, _, count in CAST:
        out.setdefault(prefix, []).extend(f'{prefix}{chr(65 + r)}{a}' for r in range(count) for a in range(1, 9))
    out['ASMI'] += [f'ASMI{l}0' for l in POSES[2]]
    for p in PROPS:
        for name in p['frames']: out.setdefault(name[:4], []).append(name)
    out['ACHR'].append('ACHRB0')  # the Construct's white chair, baked
    return out


def complete(art=ART):
    """True when every required sheet of the pack is present (courier and posters are optional)."""
    files = [(i, f) for i, f, *_ in CAST + TEXTURES] + [(p['id'], p['file']) for p in PROPS] + [('hud', HUD[0]), ('poses', POSES[0])]
    return all((art/f).exists() for i, f in files if i not in OPTIONAL)


# Helpers copied from import-campaign-art.py (which reads its roster when loaded).
def rows(im):
    a = np.array(im.getchannel('A')) >= 128
    hits = np.nonzero(a.sum(1) >= 12)[0]; result = []
    for y in hits:
        if not result or y - result[-1][1] > 3: result.append([int(y), int(y) + 1])
        else: result[-1][1] = int(y) + 1
    return [r for r in result if r[1] - r[0] > 20]


def harden(im):
    im = im.convert('RGBA'); im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)); return im


def crop(im, row, col, columns=8):
    cell = harden(im.crop((round(col * im.width / columns), row[0], round((col + 1) * im.width / columns), row[1])))
    box = cell.getbbox()
    if not box: raise ValueError('Missing pose')
    return cell.crop(box)


def clean(pose):
    """Drop specks under 2% of the largest component (stray pixels from a neighbouring cell)."""
    labels, count = ndimage.label(np.array(pose.getchannel('A')) > 0)
    if count < 2: return pose
    sizes = ndimage.sum(np.ones(labels.shape), labels, range(1, count + 1))
    keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * .02])
    out = pose.copy(); out.putalpha(Image.fromarray(np.where(keep, np.array(pose.getchannel('A')), 0).astype(np.uint8)))
    return out.crop(out.getbbox())


def tile(pose, scale, size=64):
    w, h = max(1, round(pose.width * scale)), max(1, round(pose.height * scale))
    if w > size - 2 or h > size: raise ValueError(f'Pose {w}x{h} exceeds the {size}px tile')
    t = Image.new('RGBA', (size, size)); t.alpha_composite(pose.resize((w, h), Image.Resampling.NEAREST), ((size - w) // 2, size - h))
    return t


def save(im, path, offset=None):
    meta = PngImagePlugin.PngInfo(); meta.add(b'grAb', struct.pack('>ii', *(offset or (im.width // 2, im.height))))
    path.parent.mkdir(parents=True, exist_ok=True); im.save(path, pnginfo=meta)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_cast(art, sprites, manifest):
    for id, file, prefix, height, count in CAST:
        path = art/file
        if not path.exists():
            if id in OPTIONAL: continue
            raise FileNotFoundError(path)
        im = Image.open(path).convert('RGBA'); ranges = rows(im)
        if len(ranges) != count: raise ValueError(f'{id}: expected {count} rows, found {ranges}')
        poses = [[clean(crop(im, r, c)) for c in range(8)] for r in ranges]
        widest = max(p.width for row in poses for p in row)
        shared = min(height / max(p.height for row in poses for p in row), 62 / widest)
        scales = [shared] * count
        if prefix in EVEN_ROWS:
            even = [min(height / float(np.median([p.height for p in poses[r]])), 64 / max(p.height for p in poses[r]),
                        62 / max(p.width for p in poses[r])) for r in EVEN_ROWS[prefix]]
            scales = [even[EVEN_ROWS[prefix].index(r)] if r in EVEN_ROWS[prefix] else even[0] for r in range(count)]
            scales = [min(s, 64 / max(p.height for p in poses[r]), 62 / max(p.width for p in poses[r])) for r, s in enumerate(scales)]
        frames = []
        for r, row in enumerate(poses):
            (sprites/f'{prefix}{chr(65 + r)}0.png').unlink(missing_ok=True)  # rotation 0 can't mix with 1-8
            for a, pose in enumerate(row):
                t = tile(pose, scales[r]); name = f'{prefix}{chr(65 + r)}{a + 1}'
                save(t, sprites/f'{name}.png', (32, 64)); frames.append(dict(name=name, height=64 - t.getbbox()[1], width=t.getbbox()[2] - t.getbbox()[0]))
        manifest.append(dict(id=id, family=prefix, source=file, source_sha256=sha(path), kind='cast', scale_in_game=1,
                             tile=[64, 64], origin=[32, 64], rows=ranges, texel_scales=[round(s, 4) for s in scales], frames=frames))
    path = art/POSES[0]
    im = Image.open(path).convert('RGBA'); ranges = rows(im)
    if len(ranges) != 1: raise ValueError(f'smith-poses: expected 1 row, found {ranges}')
    poses = [clean(crop(im, ranges[0], c, columns=4)) for c in range(4)]
    idle = Image.open(sprites/'ASMIA1.png').getbbox(); idle_h = idle[3] - idle[1]
    heights = sorted(p.height for p in poses)
    scale = min(idle_h / heights[len(heights) // 2], 62 / max(p.width for p in poses), 64 / heights[-1])
    frames = []
    for letter, pose in zip(POSES[2], poses):
        for a in range(1, 9): (sprites/f'ASMI{letter}{a}.png').unlink(missing_ok=True)
        t = tile(pose, scale); save(t, sprites/f'ASMI{letter}0.png', (32, 64))
        frames.append(dict(name=f'ASMI{letter}0', height=64 - t.getbbox()[1], width=t.getbbox()[2] - t.getbbox()[0]))
    manifest.append(dict(id='smith-poses', family='ASMI', source=POSES[0], source_sha256=sha(path), kind='cast-poses', scale_in_game=1,
                         tile=[64, 64], origin=[32, 64], texel_scale=round(scale, 4), frames=frames))


def shift(ref, mov):
    """(dx, dy) that moves alpha mask `mov` onto `ref` (FFT cross-correlation)."""
    h, w = max(ref.shape[0], mov.shape[0]), max(ref.shape[1], mov.shape[1])
    A = np.zeros((h, w), np.float32); B = np.zeros((h, w), np.float32)
    A[:ref.shape[0], :ref.shape[1]] = ref; B[:mov.shape[0], :mov.shape[1]] = mov
    corr = np.fft.ifft2(np.fft.fft2(A) * np.conj(np.fft.fft2(B))).real
    dy, dx = np.unravel_index(np.argmax(corr), corr.shape)
    return int(dx - w if dx > w // 2 else dx), int(dy - h if dy > h // 2 else dy)


def body_x(mask):
    cols = mask.sum(0); xs = np.nonzero(cols >= cols.max() * .35)[0]
    return (xs.min() + xs.max() + 1) / 2


def import_props(art, sprites, manifest, specs=PROPS):
    for spec in specs:
        path = art/spec['file']
        if specs is not PROPS and not path.exists(): continue  # an optional addition
        im = harden(Image.open(path)); cols, rws = spec['grid']
        cells = []
        for r in range(rws):
            for c in range(cols):
                cell = im.crop((round(c * im.width / cols), round(r * im.height / rws), round((c + 1) * im.width / cols), round((r + 1) * im.height / rws)))
                if not cell.getbbox(): raise ValueError(f"Empty {spec['id']} cell {r},{c}")
                cells.append(clean(cell.crop(cell.getbbox())) if spec['anchor'] != 'top' else cell)
        groups = spec.get('groups') or [list(range(len(cells)))]
        heights = spec['height'] if isinstance(spec['height'], list) else [spec['height']] * len(cells)
        placed = {}
        for group in groups:  # register each state onto the group's first state, then crop the union
            ref = cells[group[0]]; offsets = {}
            for i in group:
                cell = cells[i]
                if spec['anchor'] == 'register':
                    offsets[i] = shift(np.array(ref.getchannel('A')) > 0, np.array(cell.getchannel('A')) > 0)
                elif spec['anchor'] == 'top':  # cells are uncropped: align bbox top-left
                    rb, cb = ref.getbbox(), cell.getbbox(); offsets[i] = (rb[0] - cb[0], rb[1] - cb[1])
                elif spec['anchor'] == 'body':
                    offsets[i] = (round(body_x(np.array(ref.getchannel('A')) > 0) - body_x(np.array(cell.getchannel('A')) > 0)), ref.height - cell.height)
                else:
                    offsets[i] = ((ref.width - cell.width) // 2, ref.height - cell.height)
            boxes = {}
            for i in group:
                b = cells[i].getbbox(); dx, dy = offsets[i]; boxes[i] = (b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy)
            u = (min(b[0] for b in boxes.values()), min(b[1] for b in boxes.values()), max(b[2] for b in boxes.values()), max(b[3] for b in boxes.values()))
            for i in group:
                canvas = Image.new('RGBA', (u[2] - u[0], u[3] - u[1])); dx, dy = offsets[i]
                canvas.alpha_composite(cells[i], (dx - u[0], dy - u[1])); placed[i] = (canvas, group)
            if spec['anchor'] == 'body':
                for i in group: placed[i] = placed[i] + (body_x(np.array(cells[group[0]].getchannel('A')) > 0) - u[0],)
        sheet_scale = None
        if spec.get('scale_with') == 'sheet':
            sheet_scale = min(heights[0] / max(p[0].height for p in placed.values()), 1)
        frames = []
        for i, name in enumerate(spec['frames']):
            canvas, group = placed[i][:2]
            scale = sheet_scale or min(heights[group[0]] / canvas.height, 1)
            w, h = max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale))
            t = canvas.resize((w, h), Image.Resampling.NEAREST)
            ox = round(placed[i][2] * scale) if len(placed[i]) > 2 else w // 2
            save(t, sprites/f'{name}.png', (ox, h))
            frames.append(dict(name=name, size=[w, h], origin=[ox, h], bounds=t.getbbox()))
            if name == 'ACHRA0':
                save(whiten(t), sprites/'ACHRB0.png', (ox, h)); frames.append(dict(name='ACHRB0', size=[w, h], origin=[ox, h], bounds=t.getbbox(), note='white Construct chair'))
        manifest.append(dict(id=spec['id'], source=spec['file'], source_sha256=sha(path), kind='prop', scale_in_game=spec.get('scale', .5),
                             anchor=spec['anchor'], frames=frames))


def whiten(im):
    """The Construct's chair: the leather chair redrawn white, its shading kept."""
    a = np.array(im.convert('RGBA')).astype(np.float32)
    lum = (a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114) / 255
    v = 168 + 87 * np.clip(lum * 1.6, 0, 1) ** .8
    out = np.stack([v, v, np.minimum(255, v * 1.02), a[..., 3]], -1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def import_textures(art, patches, manifest):
    for id, file, (cols, rws), names, size in TEXTURES:
        path = art/file
        if not path.exists():
            if id in OPTIONAL: continue
            raise FileNotFoundError(path)
        im = Image.open(path).convert('RGB'); frames = []
        for i, name in enumerate(names):
            c, r = i % cols, i // cols
            cell = im.crop((round(c * im.width / cols), round(r * im.height / rws), round((c + 1) * im.width / cols), round((r + 1) * im.height / rws)))
            # Area-averaged, not nearest: a 7-14x reduction of an opaque painting (poster text).
            t = cell.resize(size, Image.Resampling.BOX); patches.mkdir(parents=True, exist_ok=True); t.save(patches/f'{name}.png')
            frames.append(dict(name=name, size=list(size)))
        manifest.append(dict(id=id, source=file, source_sha256=sha(path), kind='texture', frames=frames))


def import_hud(art, web, manifest):
    path = art/HUD[0]; im = harden(Image.open(path)); im = im.crop(im.getbbox())
    w, h = HUD[2]; scale = min(w / im.width, h / im.height)
    pic = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.NEAREST)
    out = Image.new('RGBA', (w, h)); out.alpha_composite(pic, ((w - pic.width) // 2, h - pic.height))
    web.mkdir(parents=True, exist_ok=True); out.save(web/HUD[1])
    manifest.append(dict(id='hardline-hands', source=HUD[0], source_sha256=sha(path), kind='hud', output=f'doom-web/{HUD[1]}', size=[w, h], bounds=out.getbbox()))


def grab(path):
    data = Path(path).read_bytes(); i = data.find(b'grAb')
    return struct.unpack('>ii', data[i + 4:i + 12]) if i > 0 else None


def sheet_cells(path, cols, rws):
    """A sheet's equal cells (hardened), each cropped to its figure."""
    im = harden(Image.open(path)); out = []
    for r in range(rws):
        for c in range(cols):
            cell = im.crop((round(c * im.width / cols), round(r * im.height / rws), round((c + 1) * im.width / cols), round((r + 1) * im.height / rws)))
            if not cell.getbbox(): raise ValueError(f'Empty cell {r},{c} in {path.name}')
            out.append(clean(cell.crop(cell.getbbox())))
    return out


def base_rows(mask, share=.2):
    """The mask's lowest rows (its base or feet): `share` of its height up from its bottom."""
    ys = np.nonzero(mask.any(1))[0]; top = ys.max() + 1 - max(2, round((ys.max() + 1 - ys.min()) * share))
    out = mask.copy(); out[:top] = False; return out


def fit_to(ref_path, im, mode):
    """`im` (cropped) scaled to an existing frame and registered onto it by alpha cross-correlation, so
    switching between the two states never jumps: 'bbox' fits it in the reference's box (the same object
    redrawn), 'base' matches the width of their bases and registers only those (an arm that moves above
    a fixed base). Returns the image and its grAb in the reference's frame."""
    ref = Image.open(ref_path).convert('RGBA'); rx, ry = grab(ref_path) or (ref.width // 2, ref.height)
    rm = np.array(ref.getchannel('A')) > 0; b = ref.getbbox()
    if mode == 'bbox':
        s = min((b[2] - b[0]) / im.width, (b[3] - b[1]) / im.height)
    else:
        widest = lambda m: max(int(np.ptp(np.nonzero(row)[0])) + 1 for row in base_rows(m, .12) if row.any())
        s = widest(rm) / widest(np.array(im.getchannel('A')) > 0)
    t = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.Resampling.NEAREST)
    tm = np.array(t.getchannel('A')) > 0
    dx, dy = shift(rm, tm) if mode == 'bbox' else shift(base_rows(rm), base_rows(tm))
    if mode == 'base': dy = b[3] - t.getbbox()[3]  # standing on the same floor, never a texel above it
    return t, (rx - dx, ry - dy), round(s, 4)


def glass_case(path, height):
    """C6's camera in its glass case. The pane is partly transparent, which Doom's sprites (alpha hardened
    at 128) can't keep: the case is made solid, its pane tinted over a dark backing."""
    im = Image.open(path).convert('RGBA'); a = np.array(im)
    ys, xs = np.nonzero(a[..., 3] >= 128); box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    case = im.crop(box); back = Image.new('RGBA', case.size, GLASS_BACK + (255,)); back.alpha_composite(case)
    solid = ndimage.binary_fill_holes(np.array(case.getchannel('A')) >= 8)
    back.putalpha(Image.fromarray((solid * 255).astype(np.uint8)))
    s = height / back.height
    return back.resize((max(1, round(back.width * s)), height), Image.Resampling.NEAREST), round(s, 4)


def import_extras(redo, sprites, web, manifest):
    """The 2026-10-23 additions present in `redo` (REDO_PROPS, REDO_FILES)."""
    if not redo.exists(): return
    import_props(redo, sprites, manifest, REDO_PROPS)
    f = {k: redo/v for k, v in REDO_FILES.items()}
    def note(id, file, frames, **kw):
        manifest.append(dict(id=id, source=file.name, source_sha256=sha(file), kind='extra', frames=frames, **kw))
    def one(file):  # a 1x1 sheet's figure
        return sheet_cells(file, 1, 1)[0]
    # ASMI J: the survey after Katja's badge is gone (Agentic.zs shows it in place of G once you hold it),
    # the same pose without lanyard or badge, as tall as G.
    if f['unbadged'].exists() and (sprites/'ASMIG0.png').exists():
        pose = one(f['unbadged']); g = Image.open(sprites/'ASMIG0.png').getbbox()
        t = tile(pose, (g[3] - g[1]) / pose.height); save(t, sprites/'ASMIJ0.png', (32, 64))
        note('smith-survey-unbadged', f['unbadged'], [dict(name='ASMIJ0', height=64 - t.getbbox()[1], width=t.getbbox()[2] - t.getbbox()[0])], scale_in_game=1)
    # ACAM D: the refuge door camera, dark until the exit arms it; fitted onto the watching frame A.
    if f['dormant'].exists() and (sprites/'ACAMA0.png').exists():
        t, origin, s = fit_to(sprites/'ACAMA0.png', one(f['dormant']), 'bbox'); save(t, sprites/'ACAMD0.png', origin)
        note('camera-dormant', f['dormant'], [dict(name='ACAMD0', size=list(t.size), origin=list(origin), texel_scale=s)], scale_in_game=.5)
    # ACAM E: C6 behind glass (unbreakable). The camera inside is a little smaller than A; its case's
    # bottom hangs where A's does.
    if f['glass'].exists():
        t, s = glass_case(f['glass'], 56); save(t, sprites/'ACAME0.png', (t.width // 2, t.height))
        note('camera-glass', f['glass'], [dict(name='ACAME0', size=list(t.size), origin=[t.width // 2, t.height], texel_scale=s)], scale_in_game=.5)
    # AARM E: the jailer arm idle, empty-handed; its base registered onto frame A's (the arm's Scale .7).
    if f['idle_arm'].exists() and (sprites/'AARMA0.png').exists():
        t, origin, s = fit_to(sprites/'AARMA0.png', one(f['idle_arm']), 'base'); save(t, sprites/'AARME0.png', origin)
        note('jailer-idle', f['idle_arm'], [dict(name='AARME0', size=list(t.size), origin=list(origin), texel_scale=s)], scale_in_game=.7)
    # ACBL B blue, C yellow: the rig's tool cables in their own colours, 52 texels long like the red A
    # (flat sprites; AgenticBengio.zs stretches each to its segment). Area-averaged: the painted twist is
    # finer than a texel at this size.
    if f['rig_cables'].exists():
        frames = []
        for name, cell in zip(['ACBLB0', 'ACBLC0'], sheet_cells(f['rig_cables'], 1, 2)):
            h = max(2, round(52 * cell.height / cell.width)); c = cell.resize((52, h), Image.Resampling.BOX)
            out = Image.new('RGBA', (52, 8)); out.alpha_composite(harden(c), (0, (8 - h) // 2)); save(out, sprites/f'{name}.png', (26, 4))
            frames.append(dict(name=name, size=[52, 8], origin=[26, 4]))
        note('rig-cables', f['rig_cables'], frames, scale_in_game='per segment')
    # AGRC D: Katja's throw (rotation 0, seen the same from every side), as tall as her idle front frame.
    if f['throw'].exists() and (sprites/'AGRCA1.png').exists():
        pose = one(f['throw']); a = Image.open(sprites/'AGRCA1.png').getbbox(); s = (a[3] - a[1]) / pose.height
        s = min(s, 62 / pose.width); t = tile(pose, s); save(t, sprites/'AGRCD0.png', (32, 64))
        note('grace-throw', f['throw'], [dict(name='AGRCD0', height=64 - t.getbbox()[1], width=t.getbbox()[2] - t.getbbox()[0], texel_scale=round(s, 4))], scale_in_game=1)
    # The browser's held badge: the off hand, so it is mirrored to rise from the bottom-left (the wrench
    # is on the right), BADGE[1] texels wide; agentic-hud.js scales it by whole device pixels.
    if f['badge'].exists():
        im = one(f['badge']).transpose(Image.Transpose.FLIP_LEFT_RIGHT); w = BADGE[1]
        pic = im.resize((w, round(im.height * w / im.width)), Image.Resampling.NEAREST)
        web.mkdir(parents=True, exist_ok=True); pic.save(web/BADGE[0])
        manifest.append(dict(id='held-badge', source=f['badge'].name, source_sha256=sha(f['badge']), kind='hud', output=f'doom-web/{BADGE[0]}', size=list(pic.size), mirrored=True))


# SMITH after Katja's rescue has taken his badge (ASMU, same frames as ASMI): the atlas and poses all
# wear it, so it is painted out here. The badge is the one small near-white patch on the lower torso
# that the shirt above doesn't join; it and its edge become the surrounding jacket. Back views have
# none and are copied. The survey (G) is smith-survey-unbadged.png's J.
UNBADGED = [f'{l}{r}' for l in 'ABCDE' for r in range(1, 9)] + ['F0', 'H0', 'I0']


def unbadge(im):
    """(image without the badge, pixels painted), or (None, 0) when no badge shows."""
    a = np.array(im.convert('RGBA')).astype(np.int16); rgb, alpha = a[..., :3], a[..., 3] > 0
    ys = np.nonzero(alpha.any(1))[0]; top, h = ys.min(), ys.max() + 1 - ys.min()
    mean, spread = rgb.mean(-1), rgb.max(-1) - rgb.min(-1)
    white = alpha & (mean >= 150) & (spread < 70)
    zone = np.zeros_like(alpha); zone[top + int(h * .3):top + int(h * .78)] = True
    labels, count = ndimage.label(white & zone); best = None
    for i in range(1, count + 1):
        m = labels == i; yy, xx = np.nonzero(m)
        if not 5 <= m.sum() <= 60 or np.ptp(yy) + 1 > 11 or np.ptp(xx) + 1 > 9: continue
        if white[yy.min() - 1, max(0, xx.min() - 1):xx.max() + 2].sum() > 1: continue  # the shirt runs into it
        if best is None or yy.mean() > best[0]: best = (yy.mean(), m)
    if best is None: return None, 0
    patch = ndimage.binary_dilation(best[1]) & alpha & (mean >= 95); jacket = alpha & (mean < 70) & ~patch
    out = a.copy()
    for y, x in zip(*np.nonzero(patch)):
        ring = (slice(max(0, y - 3), y + 4), slice(max(0, x - 4), x + 5)); near = rgb[ring][jacket[ring]]
        out[y, x, :3] = np.median(near, 0) if len(near) else (20, 20, 22)
    return Image.fromarray(out.astype(np.uint8), 'RGBA'), int(patch.sum())


def import_unbadged(sprites, manifest):
    if not (sprites/'ASMIA1.png').exists(): return
    frames = []
    for n in UNBADGED:
        source = sprites/f'ASMI{n}.png'; im = Image.open(source).convert('RGBA'); clean_, painted = unbadge(im)
        save(clean_ or im, sprites/f'ASMU{n}.png', grab(source)); frames.append(dict(name=f'ASMU{n}', painted=painted))
    survey = sprites/('ASMIJ0.png' if (sprites/'ASMIJ0.png').exists() else 'ASMIG0.png')
    for n in ('G0', 'J0'): save(Image.open(survey).convert('RGBA'), sprites/f'ASMU{n}.png', grab(survey)); frames.append(dict(name=f'ASMU{n}', copy=survey.stem))
    manifest.append(dict(id='smith-unbadged', family='ASMU', source='ASMI frames (derived)', kind='derived', scale_in_game=1, frames=frames))


def export_meadow_figures(sprites=MOD/'sprites', out=WEB/'outside-assets'):
    """The five walk out into the meadow (doom-outside.ts): rows A, B, C, B x Doom rotations 1-8."""
    out.mkdir(parents=True, exist_ok=True); written = 0
    for id, prefix in MEADOW:
        for phase, row in enumerate('ABCB'):
            for angle in range(8):
                source = sprites/f'{prefix}{row}{angle + 1}.png'
                if not source.exists(): continue
                Image.open(source).convert('RGBA').save(out/f'figure-{id}-{phase}-{angle}.png'); written += 1
    return written


def preview(manifest, sprites, out):
    """Cast front/side/back plus action rows, and every prop state, at 2x."""
    cast = [m for m in manifest if m['kind'] == 'cast']
    im = Image.new('RGB', (1100, 150 * len(cast) + 20), (30, 30, 34)); d = ImageDraw.Draw(im)
    for i, m in enumerate(cast):
        d.text((8, i * 150 + 8), m['family'], fill=(230, 230, 200))
        picks = [f"{m['family']}A{a}" for a in (1, 2, 3, 5)] + [f"{m['family']}{chr(65 + r)}1" for r in range(1, len(m['rows']))]
        for j, name in enumerate(picks):
            t = Image.open(sprites/f'{name}.png').resize((128, 128), Image.Resampling.NEAREST); im.paste(t, (60 + j * 130, i * 150 + 12), t)
    out.mkdir(parents=True, exist_ok=True); im.save(out/'cast-preview.png')


def main(art=ART, mod=MOD, web=WEB, out=OUT, redo=REDO):
    if not complete(art): raise FileNotFoundError(f'Incomplete level 4 pack in {art}')
    sprites = mod/'sprites'; sprites.mkdir(parents=True, exist_ok=True); manifest = []
    import_cast(art, sprites, manifest)
    import_props(art, sprites, manifest)
    import_textures(art, mod/'patches/agentic', manifest)
    import_hud(art, web, manifest)
    import_extras(Path(redo), sprites, web, manifest)
    import_unbadged(sprites, manifest)
    figures = export_meadow_figures(sprites, web/'outside-assets')
    out.mkdir(parents=True, exist_ok=True)
    (out/'import-manifest.json').write_text(json.dumps(manifest, indent=1, default=lambda o: list(o) if isinstance(o, tuple) else str(o)) + '\n')
    preview(manifest, sprites, out)
    count = sum(len(m.get('frames', [])) for m in manifest)
    print(f'Imported level 4 pack: {count} frames/images from {len(manifest)} sheets, {figures} meadow figures.')
    return manifest


if __name__ == '__main__':
    main(*(Path(a) for a in sys.argv[1:]))
