"""Makes the pictures of the guide's falling example, from code alone: python3 falling_assets.py <folder>.

Kai standing, Kai lying on the ground, and between them `kai-falling.webp`, an animated WebP that plays
once: Kai tips over backwards, pivoting on the feet, and stays on the ground on the last frame.
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Wide enough for Kai lying down, to the right of the feet, which stay in the middle; the ground high
# enough on the picture for Kai to lie above the text box and its buttons, characters standing on the
# bottom of the stage.
WIDTH, HEIGHT = 1400, 1500
FEET = (700, 830)
BODY = (46, 125, 160, 255)
SKIN = (240, 200, 160, 255)


def figure():
    """Kai upright, feet at the bottom middle, on a transparent picture."""
    picture = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(picture)
    draw.ellipse((650, 200, 750, 300), fill=SKIN)
    draw.rounded_rectangle((635, 310, 765, 590), radius=40, fill=BODY)
    draw.rounded_rectangle((645, 580, 690, 830), radius=20, fill=BODY)
    draw.rounded_rectangle((710, 580, 755, 830), radius=20, fill=BODY)
    return picture


def tipped(angle):
    """Kai turned by `angle` degrees about the feet, backwards to the right; 90 is lying down."""
    return figure().rotate(-angle, center=FEET, resample=Image.BICUBIC)


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    tipped(0).save(folder / 'kai-standing.webp', lossless=True)
    tipped(90).save(folder / 'kai-lying.webp', lossless=True)
    # Faster and faster, as a fall goes: Kai wobbles a moment on the first frame, and stays on the last.
    angles = [0] + [90 * math.sin(step / 8 * math.pi / 2) ** 2 for step in range(1, 9)]
    frames = [tipped(angle) for angle in angles]
    durations = [500] + [60] * 7 + [1000]
    frames[0].save(folder / 'kai-falling.webp', save_all=True, append_images=frames[1:], duration=durations, loop=1, lossless=True)


main()
