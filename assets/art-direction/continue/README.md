# The room paintings

The veil and chapter tiles use the same twelve rooms, each with a separately composed landscape and portrait.
Keep only the latest selected painting in each orientation. Experimental generations belong in temporary storage.

## Final files

- `remade/masters/<room>-land.png` and `<room>-port.png`: the 24 native, lossless PNG masters.
- `remade/masters/prompts/`: their exact final generation prompts.
- `remade/masters/manifest.json`: dimensions, checksums, generation provenance and installed WebP paths.
- `remade/review.html`: the selected masters with a toggleable veil overlay.
- `src/paintings/`: native-size WebP derivatives, quality 94 with `-m 6 -sharp_yuv`.
- `src/chapter-select/stills/`: matching 400x250 landscape tiles, quality 90.

Landscape masters are 1672x941; portraits vary slightly around 852x1846. These are native generator outputs.
Jeremy handles any later upscale; preserve these original PNGs. The manifest's `file` and `prompt` paths are
relative to `masters/`; WebP and tile paths are relative to the repository. Generation input paths and source
revision names are historical provenance, not additional files to retain.

## Refreshing a painting

Use the built-in imagegen tool with the final prompt and an authoritative game capture. The original shared
brief (`common.txt`), room descriptions (`rooms/`) and knitted-sail reference (`sail-closeup.jpg`) remain as source
material; the final prompts and current rules below supersede their older composition advice. `paint.sh` is the
original capture/generation helper, not the workflow that produced the current masters.

Start camera corrections from the original prompt and scene references: repeated image edits introduced visible
artifacts. Make small changes to viewpoint while retaining the close subject scale. Keep the scene's objects,
proportions, light and painterly finish, with clear focal edges and varied marks that follow the forms. No people,
animals, text, UI or invented props.

The foreground should soften subtly and continuously into natural shade, with recognisable grass, water or clouds.
Avoid an empty blurred lower third, bright foreground rims, a horizontal blur boundary or repeated texture.
Landscape and portrait need their own compositions. Preserve the showcase subject through wide-screen cropping;
move the overlay before shrinking the subject to make space.

Check the PNG at full size and behind the real veil on wide, 16:10 and phone screens. Begin/Continue sits around
82% down in landscape, 86% for landscape Stairs, and 74% in portrait, with minimum bottom space for secondary
actions. Finished saves reserve more space. Check `start over` and the corner controls too; the 400x250 tile must
still read clearly as the room. These are release paintings, refreshed when a room's look changes for good.
