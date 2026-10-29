"""Read-only checks for alpha, occupied cells, and cell-edge clipping in generated atlases."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'art/endgame-2026-10-26'
plan = json.loads((ROOT / 'sprite-plan.json').read_text())
face_quality = json.loads((ROOT / 'face-quality.json').read_text()) if (ROOT / 'face-quality.json').exists() else {}
report = []
for job in plan['jobs']:
    path = ROOT / job['file']
    if not path.exists():
        continue
    image = Image.open(path)
    cols, rows = job['grid']
    cells = []
    if job['transparent']:
        alpha = image.getchannel('A') if image.mode == 'RGBA' else None
        for row in range(rows):
            for col in range(cols):
                box = (round(col * image.width / cols), round(row * image.height / rows),
                       round((col + 1) * image.width / cols), round((row + 1) * image.height / rows))
                cell = alpha.crop(box).point(lambda value: 255 if value > 128 else 0) if alpha else None
                bounds = cell.getbbox() if cell else None
                margins = [bounds[0], bounds[1], cell.width - bounds[2], cell.height - bounds[3]] if bounds else []
                # Weapon sleeves intentionally enter from below.
                if margins and job['file'] == 'floppy-hands.png':
                    # First-person forearms enter from the lower frame corners;
                    # the hand and fingers above that sleeve region must be complete.
                    upper = cell.crop((0, 0, cell.width, round(cell.height * .8)))
                    upper_bounds = upper.getbbox()
                    tested = [upper_bounds[0], upper_bounds[1], upper.width - upper_bounds[2]] if upper_bounds else []
                else:
                    tested = margins
                cells.append(dict(cell=row * cols + col + 1, occupied=bool(bounds), margins=margins,
                                  clear_edges=bool(tested) and min(tested) >= 3))
    report.append(dict(file=job['file'], dimensions=list(image.size), mode=image.mode,
                       alpha_ok=(not job['transparent'] or image.mode == 'RGBA'), cells=cells,
                       cell_edges_ok=all(cell['clear_edges'] for cell in cells),
                       visual_review_required=True,
                       strict_face_palette_check=face_quality.get(path.stem, {}).get('strict_palette_pass')
                       if job['file'].startswith('mcp-') else None))
(ROOT / 'cell-quality.json').write_text(json.dumps(report, indent=2) + '\n')
for item in report:
    bad = [str(cell['cell']) for cell in item['cells'] if not cell['clear_edges']]
    print(item['file'], 'CHECK CELL EDGES ' + ','.join(bad) if bad else 'cell edges clear')
