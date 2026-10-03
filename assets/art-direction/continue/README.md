# The room paintings

The title veil shows a painting of the room the player will start in, and chapter select's tiles are cut from the
same paintings (`docs/backlog/chapter-select-in-place/design.md`, "Phase 3"). Each painting is Astra's repaint of a
real capture of the room, at a higher finish, composed to sit behind the start screen's words.

They are release art: refreshed when a room's look changes for good, not on every tweak.

## How a painting is made

1. A capture of the empty room: `tools/chapter-stills.mjs <room>` writes a 1600x1000 PNG to `OUT`.
2. Astra (`gpt-6-astra`, Codex image generation) repaints it from `common.txt` (the shared art direction and the
   composition rules) plus `rooms/<room>.txt`, with the capture attached first. When a painting already exists, the
   current landscape and portrait are attached too, so a refresh keeps what was approved, and the change wanted is
   named in words. Boat rooms also attach `sail-closeup.jpg`, the knitted sail as the game draws it.
3. Look at both results beside the capture, at full size, and reroll with the fault named until they are right
   (see "Checking a painting").
4. Encode with `cwebp -q 78 -sharp_yuv`: `<room>-land.webp` and `<room>-port.webp` at native size, and the 400x250
   tile `<room>.webp` from the landscape.

`paint.sh <room> ["<what to change>"]` does steps 1, 2 and 4 for one room against a dev server (`BASE`, default
`http://127.0.0.1:5230/`), writing to `WORK` (default `/tmp/updraft-paintings`) and reading the current paintings from
`CURRENT` (default `src/paintings/`). Run it in the foreground; a roll takes about five minutes. The browser lock
(`/tmp/updraft-chromium.lock`) applies to the capture.

## Composition rules

- **Landscape and portrait.** A landscape (Astra returns about 1586x992) for desktop and a portrait (about 853x1844)
  recomposed for a phone held upright, never a crop of the landscape. A visit loads the portrait under 3:4.
- **No characters.** No child, cygnet, birds, animals or figures, and nothing the room does not have.
- **In focus.** The whole frame is in focus, as the game renders it; no depth-of-field wall.
- **A quiet lower band.** The lower quarter (the portrait's lower 30%) holds the words: Continue's centre sits 72%
  down. It is quiet because of what is there, calm ground, water or cloud in shade in the room's own colours, not
  because it is blurred or tinted blue. Light falls off smoothly into it, with no dark band, stripe or seam. Its value
  is about a third of full brightness, so ivory Continue reads at about 4.5:1 or better under the veil's gradient.
- **An empty bottom-right corner** (the last 15% of the width, 12% of the height) for the three round buttons.
- **The subject in the middle third**, between 15% and 62% of the height (portrait: central 60% of the width,
  20% to 55% of the height), so screens wider or narrower than 16:10 crop nothing that matters.

## Checking a painting

Beside the capture: the same objects with the same shapes and colours (the sail is knitted wool from the birches on;
the Dark wood is as dark as the game, lit by the ember; the Still island's boat lies beached and heeled over). At
1:1 in the lower half: no banding, no smear, no change of texture along a line. At the layout: Continue and
`start over` placed at 72% and 78% down read on it, and the corner is empty. At 400x250: the tile still reads as the
room.
