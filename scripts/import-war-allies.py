#!/usr/bin/env python3
"""Doom sprites for the founder who fights beside you in the Last Stand finale.

Whichever founder the player did not pick (Sam Altman WSAM, Dario Amodei WDAR)
fights in the last room. Final art goes in art/war-allies-v1/<id>-atlas.png,
in the war-robot atlas format (see art/war-allies-v1/README.md): a transparent
PNG of 8 equal columns (Doom rotations front, front-left, left, rear-left,
back, rear-right, right, front-right) and 5 pose rows separated by transparent
gaps: walk A, walk B, aim, fire, pain. Frames become A-E.

Until that art exists, a placeholder atlas is assembled from the Bliss guide's
walking atlas (art/bliss-guide-v1/atlas.png): walk A, walk B, then walk A again
for aim and fire and walk B for pain. The manifest records which is in use.
The soldiers who die beside you are Doom's own marines (PLAY) and need no import.
"""
from importlib.machinery import SourceFileLoader
from pathlib import Path
import json
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/war-allies-v1'
GUIDE = ROOT / 'art/bliss-guide-v1'
SPRITES = ROOT / 'doom-mod/sprites'
MANIFEST = ART / 'import-manifest.json'
robots = SourceFileLoader('war_robots', str(ROOT / 'scripts/import-war-robots.py')).load_module()

POSES = [('walk A', 'stand'), ('walk B', 'stand'), ('aim', 'stand'), ('fire', 'stand'), ('pain', 'stand')]
# id, sprite prefix, guide atlas rows (walk A, walk B). Internal guide ids: mario = Dario, samwise = Sam.
FOUNDERS = [('dario', 'WDAR', (0, 1)), ('sam', 'WSAM', (2, 3))]
HEIGHT = 56   # Doom units, the player's own height


def placeholder(rows):
    """walk A, walk B, aim (A), fire (A), pain (B) from the guide's 8x4 walking atlas."""
    guide = Image.open(GUIDE / 'atlas.png').convert('RGBA')
    band = guide.height // 4
    cells = [guide.crop((0, r * band, guide.width, (r + 1) * band)) for r in range(4)]
    order = [rows[0], rows[1], rows[0], rows[0], rows[1]]
    gap = band // 6
    out = Image.new('RGBA', (guide.width, len(order) * (band + gap)), (0, 0, 0, 0))
    for i, r in enumerate(order):
        out.alpha_composite(cells[r], (0, i * (band + gap)))
    return out


def main():
    (ART / 'work').mkdir(parents=True, exist_ok=True)
    previous = set()
    if MANIFEST.exists():
        for r in json.loads(MANIFEST.read_text()).get('founders', []):
            previous |= {f['name'] for f in r['frames']}
    results = []
    for fid, prefix, rows in FOUNDERS:
        final = ART / f'{fid}-atlas.png'
        if final.exists():
            source, kind = final, 'final'
        else:
            source, kind = ART / 'work' / f'{fid}-placeholder-atlas.png', 'placeholder (Bliss guide walk, no gun)'
            placeholder(rows).save(source)
        # import_robot reads ART/<id>-atlas.png; point it at whichever atlas we use.
        robots.ART = source.parent
        name = source.name[:-len('-atlas.png')]
        result = robots.import_robot(name, prefix, HEIGHT, POSES, {'radius': 16, 'height': 56})
        result.update(id=fid, art=kind)
        results.append(result)
    new = {f['name'] for r in results for f in r['frames']}
    for r in results:
        for p in SPRITES.glob(r['prefix'] + '*.png'):
            if p.stem not in previous and p.stem not in new:
                sys.exit(f'refusing to overwrite foreign sprite {p.name}')
    for name in previous - new:
        (SPRITES / f'{name}.png').unlink(missing_ok=True)
    for r in results:
        for f in r['frames']:
            robots.h.save_sprite(f['tile'], f['name'], tuple(r['grab']))
    robots.preview(results, ART / 'imported-preview.png')
    for r in results:
        for f in r['frames']:
            del f['tile']
    MANIFEST.write_text(json.dumps({'tool': 'scripts/import-war-allies.py', 'founders': results}, indent=2) + '\n')
    for r in results:
        print(f"{r['id']:6s} {r['prefix']} {len(r['frames'])} sprites, tile {r['tile_size']}, art: {r['art']}")


if __name__ == '__main__':
    main()
