"""Packs the painted owl-shadow masks for the game: shadow is white, one mask per channel.

shadows.webp (1024 x 1024): R the monster, G the plain stump without its owl, B the perched owl alone.
flaps.webp (512 x 512): the four flap frames in a 2 x 2 grid, in the red channel (1 2 / 3 4).
Run from the repo root: python3 tools/pack-owl-shadows.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path('assets/fx/owl-shadow')
OWL_SEED = (575, 640)
OWL_FLOOR = 693


def shade(name: str) -> np.ndarray:
    return 255 - np.asarray(Image.open(DIR / name).convert('L'), dtype=np.uint8)


def owl_alone(plain: np.ndarray) -> np.ndarray:
    """The owl is the shadow joined to the seed above the crook it perches in."""
    seen = np.zeros(plain.shape, bool)
    todo = deque([OWL_SEED[::-1]])
    while todo:
        y, x = todo.popleft()
        if y < 0 or y > OWL_FLOOR or x < 0 or x >= plain.shape[1] or seen[y, x] or plain[y, x] < 160:
            continue
        seen[y, x] = True
        todo.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    # Its soft edge is the two pixels round the solid part.
    grown = seen.copy()
    for _ in range(2):
        grown[1:] |= grown[:-1].copy(); grown[:-1] |= grown[1:].copy()
        grown[:, 1:] |= grown[:, :-1].copy(); grown[:, :-1] |= grown[:, 1:].copy()
    return np.where(grown, plain, 0).astype(np.uint8)


monster, plain = shade('monster.png'), shade('plain.png')
owl = owl_alone(plain)
bare = np.where(owl > 0, 0, plain).astype(np.uint8)
Image.fromarray(np.dstack([monster, bare, owl])).save(DIR / 'shadows.webp', lossless=True, quality=100, method=6)

atlas = np.zeros((512, 512), np.uint8)
for i in range(4):
    atlas[(i // 2) * 256:(i // 2 + 1) * 256, (i % 2) * 256:(i % 2 + 1) * 256] = shade(f'owl-flap-{i + 1}.png')
Image.fromarray(np.dstack([atlas, atlas, atlas])).save(DIR / 'flaps.webp', lossless=True, quality=100, method=6)
