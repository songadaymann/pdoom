# Composes the CEO hero images from scripts/ceo-pick-browser-smoke.mjs's screenshots in
# output/doom-hud/ceo-pick/ (run from the project root after the suite):
#   python3 scripts/ceo-pick-heroes.py
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
D = Path('output/doom-hud/ceo-pick')
BG = (12, 10, 8)
font = ImageFont.truetype('doom-web/local/ui/doom-small.ttf', 32)

def label(draw, text, x, y, w):
    tw = draw.textlength(text, font=font)
    draw.text((x + (w - tw) / 2 + 2, y + 3), text, font=font, fill=(43, 8, 0))
    draw.text((x + (w - tw) / 2, y), text, font=font, fill=(228, 67, 42))

# The two in-game bars side by side, 1:1 crops (4x the 320x32 bar), each named.
a, b = (Image.open(D / f'ingame-{c}-bar.png').convert('RGB') for c in ('altman', 'amodei'))
gap, top = 24, 56
sheet = Image.new('RGB', (a.width + gap + b.width, top + max(a.height, b.height)), BG)
d = ImageDraw.Draw(sheet)
label(d, 'SAM ALTMAN', 0, 10, a.width); label(d, 'DARIO AMODEI', a.width + gap, 10, b.width)
sheet.paste(a, (0, top)); sheet.paste(b, (a.width + gap, top))
sheet.save(D / 'hero-hud-both.png', optimize=True)
# The same two bars stacked (Altman above Amodei), 16 px apart.
stack = Image.new('RGB', (max(a.width, b.width), a.height + 16 + b.height), BG)
stack.paste(a, (0, 0)); stack.paste(b, (0, a.height + 16))
stack.save(D / 'ingame-bars-both.png', optimize=True)

# The launcher at 1280x800 with each CEO selected, side by side (same layout, same treatment).
a, b = (Image.open(D / f'launcher-desktop-{c}.png').convert('RGB') for c in ('altman', 'amodei'))
gap = 16
sheet = Image.new('RGB', (a.width + gap + b.width, a.height), BG)
sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + gap, 0))
sheet.save(D / 'hero-launcher.png', optimize=True)
print('wrote', D / 'hero-hud-both.png', D / 'ingame-bars-both.png', D / 'hero-launcher.png')
