"""Pixel-exact Doom lettering for in-world labels (2026-10-13).

Labels used to be drawn with doom-small.ttf at 5-8 px, below the font's native size,
which mangled the letters in game (THAW read as "TXAW", EXAM as "EIAM"). This draws the
WAD's own STCFN glyph patches instead: 7 px capitals with Doom's own spacing, one
flat colour, at whole-number scales only, so they stay crisp under nearest filtering.

    text = DoomText(root / 'doom-web/local/DOOM.WAD')
    text.draw(image, 'THAW', centre_x, top_y, '#efd397')         # 1 glyph pixel = 1 sprite pixel
    text.width('POD BAY'), text.HEIGHT
"""
import struct
from pathlib import Path
from importlib.machinery import SourceFileLoader
from PIL import Image, ImageColor

DoomArt = SourceFileLoader('doom_art', str(Path(__file__).with_name('doom-art.py'))).load_module().DoomArt


class DoomText:
    HEIGHT = 7   # capitals; '.' and ',' hang below via their own offsets
    SPACE = 4    # Doom's HU font space

    def __init__(self, wad):
        art = DoomArt(Path(wad))
        self.glyphs = {}
        for name, data in art.lumps.items():
            if not name.startswith('STCFN'):
                continue
            left, top = struct.unpack_from('<hh', data, 4)
            patch = art.patch(name)
            # Each glyph is bright red strokes inside a dark (palette 0x43) outline:
            # split them so the strokes take the label colour and the outline a dark edge.
            red, alpha = patch.getchannel('R'), patch.getchannel('A')
            stroke = Image.eval(red, lambda r: 255 if r >= 0x60 else 0)
            stroke = Image.composite(stroke, Image.new('L', patch.size, 0), alpha)
            self.glyphs[chr(int(name[5:]))] = (stroke, alpha, left, top)

    def width(self, text, scale=1):
        return sum(self.SPACE if c == ' ' else self.glyphs[c][0].width for c in text.upper()) * scale

    def render(self, text, colour, scale=1, edge='#140d09'):
        """The text alone, as a transparent RGBA image `scale` pixels per glyph pixel.
        `edge` colours Doom's own dark outline around the strokes (None leaves it out)."""
        rgb = ImageColor.getrgb(colour)[:3]
        image = Image.new('RGBA', (max(1, self.width(text)), self.HEIGHT + 2))
        x = 0
        for c in text.upper():
            if c == ' ':
                x += self.SPACE
                continue
            stroke, outline, left, top = self.glyphs[c]
            if edge:
                image.paste(Image.new('RGBA', outline.size, ImageColor.getrgb(edge)[:3] + (255,)), (x - left, -top), outline)
            image.paste(Image.new('RGBA', stroke.size, rgb + (255,)), (x - left, -top), stroke)
            x += stroke.width
        if scale != 1:
            image = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
        return image

    def draw(self, image, text, centre_x, top, colour, scale=1, edge='#140d09'):
        """Centre `text` on centre_x with its capitals' top at `top` (whole pixels)."""
        glyphs = self.render(text, colour, scale, edge)
        image.alpha_composite(glyphs, (int(round(centre_x - glyphs.width / 2)), int(top)))
        return glyphs.width

    def hires(self, image, blocks, factor=4, uniform=True):
        """A `factor`x copy of a 1x sprite with each text block lettered crisply, for GZDoom's
        hires/ folder (shown at the 1x sprite's size). Each block is a dict in 1x pixels:
        lines (list), cx, cy (centre of the block), room (width it may use), colour, and
        optionally edge (None for dark text on a light plate), max (largest scale), height
        (rows it may use) and gap (big pixels between lines).
        With uniform, every block on the sprite uses the same, largest fitting, scale."""
        big = image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)
        def gap(b, s):  # space between lines in big pixels: one glyph pixel unless the block sets it
            return b['gap'] if 'gap' in b else s
        def tall(b, s):
            return len(b['lines']) * self.HEIGHT * s + (len(b['lines']) - 1) * gap(b, s)
        def fit(b):
            widest = max(self.width(line) for line in b['lines'])
            for s in range(b.get('max', factor), 0, -1):
                if widest * s <= b['room'] * factor - 4 and tall(b, s) <= b.get('height', 99) * factor:
                    return s
            return 1
        scales = [fit(b) for b in blocks]
        for b, s in zip(blocks, scales):
            s = min(scales) if uniform else s
            top = int(round(b['cy'] * factor - tall(b, s) / 2))
            for i, line in enumerate(b['lines']):
                self.draw(big, line, b['cx'] * factor, top + i * (self.HEIGHT * s + gap(b, s)), b['colour'], s, b.get('edge', '#140d09'))
        return big

    @staticmethod
    def save_hires(big, path, offset):
        """Write a hires PNG with the 1x sprite's grAb offset scaled to its size."""
        from PIL import PngImagePlugin
        meta = PngImagePlugin.PngInfo()
        meta.add(b'grAb', struct.pack('>ii', *offset))
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        big.save(path, pnginfo=meta)
