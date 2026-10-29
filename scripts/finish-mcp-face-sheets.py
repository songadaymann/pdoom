"""Finish the approved MCP drafts with a fixed palette and pixel-locked feature layers.

Jonathan explicitly requested deterministic pixel processing in this chat.
Original generated PNGs remain byte-for-byte intact in originals/.
Run --check to independently inspect the saved PNGs without modifying assets.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'art/endgame-2026-10-26'
CELL = (48, 56)
GRIDS = {'mcp-face': (4, 2), 'mcp-mouths': (4, 2), 'mcp-eyes': (3, 2)}
COLORS = ['#000000', '#2a0500', '#7a1405', '#d8340e', '#ff6a2a', '#ffa86a', '#ffe2c0']
PALETTE = np.array([tuple(bytes.fromhex(color[1:])) for color in COLORS], dtype=np.int32)
# Keep the nose, brows, jaw, and hair on the common base. Rectangles are half-open.
MOUTH = [(12, 40, 35, 49)]
EYES = [(11, 28, 23, 34), (25, 28, 37, 34)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cells(image, grid):
    cols, rows = grid
    return [image.crop((round(c * image.width / cols), round(r * image.height / rows),
                        round((c + 1) * image.width / cols), round((r + 1) * image.height / rows)))
            for r in range(rows) for c in range(cols)]


def reduce_cell(image):
    rgb = np.array(image.convert('RGB').resize(CELL, Image.Resampling.NEAREST), dtype=np.int32)
    distance = ((rgb[:, :, None, :] - PALETTE[None, None, :, :]) ** 2).sum(axis=-1)
    return distance.argmin(axis=-1).astype(np.uint8)


def mask(boxes):
    result = np.zeros((CELL[1], CELL[0]), dtype=bool)
    for left, top, right, bottom in boxes:
        result[top:bottom, left:right] = True
    return result


def write_sheet(path, frames, grid):
    cols, rows = grid
    pixels = np.zeros((rows * CELL[1], cols * CELL[0]), dtype=np.uint8)
    for index, frame in enumerate(frames):
        left, top = index % cols * CELL[0], index // cols * CELL[1]
        pixels[top:top + CELL[1], left:left + CELL[0]] = frame
    image = Image.fromarray(pixels).convert('P')
    image.putpalette(PALETTE.astype(np.uint8).flatten().tolist() + [0] * (768 - 21))
    image.save(path, bits=4)


def check(root):
    report = {}
    base = np.array(cells(Image.open(root / 'mcp-face.png').convert('RGB'), (4, 2))[0])
    for name, grid in GRIDS.items():
        path = root / (name + '.png')
        image = Image.open(path)
        assert image.size == (grid[0] * CELL[0], grid[1] * CELL[1]), (name, image.size)
        assert 'transparency' not in image.info, name
        rgb = np.array(image.convert('RGB'), dtype=np.int32)
        exact = np.any(np.all(rgb[:, :, None, :] == PALETTE, axis=-1), axis=-1)
        assert exact.all(), name + ': off-palette pixels'
        item = dict(dimensions=list(image.size), cell_size=list(CELL), grid=list(grid),
                    mode=image.mode, color_count=len(image.getcolors(100000)),
                    palette=COLORS, strict_palette_pass=True, opaque_black_background=True,
                    sha256=digest(path))
        if name != 'mcp-face':
            feature = mask(MOUTH if name == 'mcp-mouths' else EYES)
            frames = [np.array(frame) for frame in cells(image.convert('RGB'), grid)]
            differences = [int(np.any(frame != base, axis=-1)[~feature].sum()) for frame in frames]
            assert not any(differences), (name, differences)
            assert np.array_equal(frames[0], base), name + ': neutral frame changed'
            # Every animation frame should contribute a distinct feature pose.
            feature_hashes = [hashlib.sha256(frame[feature].tobytes()).hexdigest() for frame in frames]
            assert len(set(feature_hashes)) == len(frames), name + ': duplicate feature states'
            item.update(feature_rectangles=MOUTH if name == 'mcp-mouths' else EYES,
                        outside_feature_changed_pixels=differences,
                        strict_overlay_invariance_pass=True, neutral_matches_base=True,
                        distinct_feature_states=len(set(feature_hashes)))
        report[name] = item
    original_info = json.loads((root / 'face-processing.json').read_text())
    for item in original_info['originals']:
        assert digest(root / item['file']) == item['sha256'], 'Original changed: ' + item['file']
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = args.root
    if not args.check:
        original_dir = root / 'originals'
        original_dir.mkdir(exist_ok=True)
        originals = []
        for name in GRIDS:
            filename = name + '.png'
            original = original_dir / filename
            if not original.exists():
                shutil.copy2(root / filename, original)
            image = Image.open(original)
            originals.append(dict(file=str(original.relative_to(root)), sha256=digest(original),
                                  dimensions=list(image.size)))
        before = root / 'face-quality-before-processing.json'
        if not before.exists():
            shutil.copy2(root / 'face-quality.json', before)
        source = {name: [reduce_cell(frame) for frame in cells(Image.open(original_dir / (name + '.png')), grid)]
                  for name, grid in GRIDS.items()}
        base = source['mcp-face'][0]
        output = {'mcp-face': source['mcp-face']}
        for name, boxes in [('mcp-mouths', MOUTH), ('mcp-eyes', EYES)]:
            feature = mask(boxes)
            output[name] = [base.copy()]
            for candidate in source[name][1:]:
                frame = base.copy()
                frame[feature] = candidate[feature]
                output[name].append(frame)
        for name, frames in output.items():
            write_sheet(root / (name + '.png'), frames, GRIDS[name])
        processing = dict(authorized='User explicitly requested deterministic pixel processing',
                          method='Nearest-neighbor 48x56 source sampling; nearest RGB palette without dithering; feature-only compositing over the common smug face',
                          originals=originals, cell_size=list(CELL), palette=COLORS,
                          mouth_rectangles=MOUTH, eye_rectangles=EYES,
                          generator_grids_preserved=True)
        (root / 'face-processing.json').write_text(json.dumps(processing, indent=2) + '\n')
    report = check(root)
    if not args.check:
        (root / 'face-quality.json').write_text(json.dumps(report, indent=2) + '\n')
    for name, item in report.items():
        print(name, item['dimensions'], str(item['color_count']) + ' colors',
              'palette PASS', 'pixel lock PASS' if 'strict_overlay_invariance_pass' in item else '')


if __name__ == '__main__':
    main()
