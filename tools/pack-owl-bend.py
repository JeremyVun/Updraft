"""Packs the painted textures for the owl at the bend from their full-size sources (kept out of the repo).

rock.webp (512 x 512): the seamless gritstone, albedo in RGB and its bump height in alpha.
leaves.webp (512 x 512): sixteen fallen leaves in a 4 x 4 grid, stems down, colour bled under the clear gutters.
wing.webp (256 x 512): the owl's wing card, its top side above its underside, stacked where the card is clear; in
each half the shoulder is at (2, 128) and the tip at (250, 103).
Run from the repo root: python3 tools/pack-owl-bend.py <source dir>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(sys.argv[1])
DIR = Path('assets/fx/owl-bend')
DIR.mkdir(parents=True, exist_ok=True)


def box(a: np.ndarray, r: int, axis: int) -> np.ndarray:
    pad = [(0, 0), (0, 0)]
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
    n = a.shape[axis]
    return (np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, range(0, n), axis=axis)) / (2 * r + 1)


def bleed(im: Image.Image) -> Image.Image:
    """Spreads each edge colour out under the clear pixels, so filtering and mips never pull in black."""
    rgba = np.asarray(im.convert('RGBA'), dtype=np.float32)
    rgb, alpha = rgba[..., :3], rgba[..., 3:] / 255
    weight = alpha.copy()
    acc = rgb * weight
    out = rgb.copy()
    for radius in (1, 2, 4, 8, 16, 32):
        blur = lambda a: box(box(a, radius, 0), radius, 1)
        w = blur(weight[..., 0])[..., None]
        c = np.dstack([blur(acc[..., i]) for i in range(3)])
        fill = (alpha[..., 0] < 0.5) & (w[..., 0] > 1e-3)
        out[fill] = (c / np.maximum(w, 1e-6))[fill]
        alpha = np.maximum(alpha, (w > 1e-3).astype(np.float32))
    return Image.fromarray(np.dstack([out, rgba[..., 3]]).clip(0, 255).astype(np.uint8), 'RGBA')


albedo = Image.open(SRC / 'rock-albedo.png').convert('RGB').resize((512, 512), Image.LANCZOS)
height = Image.open(SRC / 'rock-height.png').convert('L').resize((512, 512), Image.LANCZOS)
Image.merge('RGBA', (*albedo.split(), height)).save(DIR / 'rock.webp', quality=88, alpha_quality=70, method=6, exact=True)

leaves = bleed(Image.open(SRC / 'leaves.png')).resize((512, 512), Image.LANCZOS)
leaves.save(DIR / 'leaves.webp', quality=92, alpha_quality=100, method=6, exact=True)

wing = Image.new('RGBA', (256, 512))
for i, name in enumerate(('owl-wing.png', 'owl-wing-under.png')):
    wing.paste(bleed(Image.open(SRC / name)).resize((256, 256), Image.LANCZOS), (0, i * 256))
wing.save(DIR / 'wing.webp', quality=92, alpha_quality=100, method=6, exact=True)
