# Favicon

## Jeremy's brief

2026-10-04:

> I think we need a new favicon for the game i.e. the paper plane thats in the updraft splash image.

The first implementation was rejected:

> All of them are terrible. I need you to gain an understanding of the game first, then create a nice paper plane fav icon

The second artwork was also rejected:

> it's the weirdest looking paper plane sillouhette i've seen (see attached). what on earth is that blue fold come on, this shouldn't be so difficult. and stop using a sub agent, just do it inline here.

Further direction:

> i think we can do better to match the same energy and perspective as the splash image. what do you think

After authorizing that change, Jeremy rejected the generated underside:

> you've copied over an error from the splash art again. The plane has some weird wing at the bottom on the left of it. I need it to be a paper plane sillouhette

The flat vector interpretation was rejected; the latest brief is:

> where is the underside fold??? The wings aren'te ven the same shape. holy shit, why is this so difficult are you stupid?! just create a nice looking white paper aeroplane fav icon that looks like it's got some energy to it

## Approved artwork

Jeremy approved the white paper aeroplane on 2026-10-04:

> wow, finally something passable. ok use this

Read `journey.md` and `styles.md` before making the icon. Study the splash in
`assets/promo/updraft-header-master-v6.png`, `docs/images/updraft-header.jpg`,
the room paintings and actual game imagery. The plane's geometry and material
are in `src/glider/glider.ts`: folded, warm off-white notebook paper with faint
ruling and a red margin. It guides the child, is lost in the storm and recovered,
then unfolds into her drawing of home.

The current replacement was generated inline, without a subagent, at Jeremy's request.
Its source is `assets/art-direction/favicon/white-paper-plane.png`: a white paper
dart banking upward left, with two matching triangular wings seen in perspective
and a visible central underside fold. Neutral grey shading describes the folded
paper. "Silhouette" means a recognizable paper aeroplane, not removal of its keel
or reduction to two flat triangles. Preserve coherent physical folds; do not copy
malformed appendages from the splash or turn the paper blue.

The tab icons use the game's `#294958` ground for contrast on both light and dark
browser chrome. PNGs at 16/32/48 pixels and a matching ICO replace the rejected SVG.
Home-screen icons use the same artwork at 68% of its canvas, on a full opaque ground
for maskable use. The HTML and manifest use a version query to avoid the previous
favicon remaining cached. This is the approved design used by all shipped icon files.

Preview: `/private/tmp/updraft-white-plane-w25y0g/preview.png`. No deployment is part
of this request. Check the actual small icon as well as the large artwork: dimensions
and a successful build alone do not establish that the design fits the game.
