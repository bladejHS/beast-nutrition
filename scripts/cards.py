# Cuts the 12 Fuel cards out of the user's sheet, doubles them for sharp phone screens and rounds the corners.
# python scripts/cards.py [sheet.png]
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SHEET = sys.argv[1] if len(sys.argv) > 1 else r'C:/Users/Andrei PC/Desktop/Tablou de bord fitness neon futurist.png'
OUT = Path('public/cards')
XS = [(20, 308), (328, 617), (637, 926), (946, 1234)]
YS = [(17, 420), (443, 811), (836, 1199)]
NAMES = [
    ['nutrition', 'carbs', 'meals', 'food'],
    ['water', 'supp', 'body', 'analytics'],
    ['engine', 'advanced', 'recovery', 'settings'],
]
SCALE = 2
RADIUS = 25 * SCALE
EDGE = 4  # supersampling of the corner mask

def rounded(size):
    big = Image.new('L', (size[0] * EDGE, size[1] * EDGE), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, big.width - 1, big.height - 1), RADIUS * EDGE, fill=255)
    return big.resize(size, Image.LANCZOS)

sheet = Image.open(SHEET).convert('RGB')
OUT.mkdir(parents=True, exist_ok=True)
for row, (y0, y1) in enumerate(YS):
    for col, (x0, x1) in enumerate(XS):
        card = sheet.crop((x0, y0, x1 + 1, y1 + 1))
        card = card.resize((card.width * SCALE, card.height * SCALE), Image.LANCZOS)
        card = card.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2)).convert('RGBA')
        card.putalpha(rounded(card.size))
        path = OUT / f'{NAMES[row][col]}.webp'
        card.save(path, 'WEBP', quality=80, alpha_quality=90, method=6)
        print(path, card.size, path.stat().st_size // 1024, 'KB')
