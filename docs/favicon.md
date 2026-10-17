# Favicon

## Jeremy's brief

> I think we need a new favicon for the game i.e. the paper plane thats in the updraft splash image.

> just create a nice looking white paper aeroplane fav icon that looks like it's got some energy to it

## Approved artwork

Jeremy approved the white paper aeroplane ("wow, finally something passable. ok use this"). All shipped icon files
use it.

Its source is `assets/art-direction/favicon/white-paper-plane.png`: a white paper dart banking upward left, with two
matching triangular wings seen in perspective and a visible central underside fold. Neutral grey shading describes
the folded paper. "Silhouette" means a recognizable paper aeroplane, not removal of its keel or reduction to two flat
triangles. Preserve coherent physical folds; do not copy malformed appendages from the splash
(`assets/promo/updraft-header-master-v6.png`, `docs/images/updraft-header.jpg`) or turn the paper blue. The plane in
the game is `src/glider/glider.ts`: folded, warm off-white notebook paper with faint ruling and a red margin.

The tab icons use the game's `#294958` ground for contrast on both light and dark browser chrome: PNGs at 16/32/48
pixels and a matching ICO (`public/`). Home-screen icons use the same artwork at 68% of its canvas, on a full opaque
ground for maskable use. The HTML and manifest use a version query so a changed icon is not served from cache.
Check the actual small icon as well as the large artwork: dimensions and a successful build alone do not establish
that the design fits the game.
