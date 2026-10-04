# Optional secrets

Status: seed. The design session has not started; everything below "Open" is for Jeremy to rule on.

## Jeremy's words (verbatim)

2026-10-04:

> I think i'm looking for more puzzles and challenges so to speak. I like that the game is meditative and very
> cinematic, but i get the feeling people are going to complain about not having "enough to do".

Offered "one secret in every room, found by a clever use of the wind, never counted during play, shown only in the
chapter select after finishing", he answered:

> add a backlog items for optional secrets, but this session im looking for things to do on the active path.

## What and why

One hidden thing per room, off the main path, that a curious player can reach with a less obvious use of the wind.
It gives players who want more to do a reason to explore and to replay rooms from the chapter select, without
touching the path a first-time player follows or its pacing.

## Constraints it inherits

From `docs/journey.md` and `docs/chapters.md`:

- Wordless during play: no counter, meter, list or text while playing.
- Nothing is required, timed or failable; missing every secret changes nothing about the journey.
- Cursor movement is the only verb; no press-and-hold.
- The camera never turns, halts or pans to show a secret (`no stop-the-world for scenery`); a find may get at most a
  glance along the path.
- The drawing stays plain white paper until it unfolds at home, so secrets cannot be pieces of the drawing.
- The child and the cygnet stay legible and in frame; a secret never leads them out of shot.
- Scripted beats mute the player's wind, so a secret cannot sit inside one.
- Finds must persist in the save (`docs/contracts/progress.md`) and survive Continue and the chapter select.

## A first shape to react to

The cygnet's feathers, lost in the fall on the still island: one waiting in each room, tucked somewhere the wind
has to work for (lifted out of a hollow by circles, blown out from under a sheet, shaken from a high fork). The
cygnet notices when one comes loose and it drifts to the child. The chapter select shows a small feather on the
still of each room where it was found.

## Open

- What the secret is: feathers, or something else of home.
- Where finds show: the chapter select only, or also somewhere in the world (the satchel, the ending).
- Whether finding them all changes anything, and if so what (it must not alter the drawing reveal).
- Which rooms get one; crossings and the sea, which is held to 100 s, may be excluded.
- How a find is marked in the moment without a chime that competes with the reward phrase
  (`completeObjective()` is reserved for major conclusions).
