# Rotary clothesline creaks

Derived from **Clothesline metallic squeak** by **AlexLane**, Freesound 530036, **CC0**.
[Original recording and licence](https://freesound.org/people/AlexLane/sounds/530036/).
Downloaded and inspected 2026-10-12; full provenance and the preserved input excerpt are in
[the reference study](../../audio-reference/rotary-creak/README.md).

Two excerpts from the public HQ MP3 preview: **12.11–12.73 s** and **12.91–13.53 s**, each 0.62 s.
Processing: mono 24 kHz / 16-bit PCM, 6 ms onset and 40 ms ending fades, each peak normalized to −12 dBFS.
No pitch shift, time stretch or equalization. The player's mix applies `tuning.rotaryWashing.creakLevel` and
the existing spatial/material gain. Successive audible creaks alternate takes.

`clips.json` embeds the PCM as base64 so a first turn never waits for download/decode, and missed events
cannot replay after asynchronous loading. The two buffers are cached for each audio context. The pair
uses about 79 kB of source text, with 119 kB of decoded float samples per context.

Rebuild with `python3 tools/prepare-rotary-creaks.py`, using only the checked-in reference WAV and Python's
standard library. The original reference files and study figures are not imported by the game.
