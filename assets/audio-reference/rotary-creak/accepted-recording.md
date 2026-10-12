# Accepted recorded rotary creaks — comparison only

Derived from **Clothesline metallic squeak** by **AlexLane**, Freesound 530036, **CC0**.
[Original recording and licence](https://freesound.org/people/AlexLane/sounds/530036/).
Downloaded and inspected 2026-10-12; full provenance and the preserved input excerpt are in
[the reference study](README.md).

Two excerpts from the public HQ MP3 preview: **12.11–12.73 s** and **12.91–13.53 s**, each 0.62 s.
Processing: mono 24 kHz / 16-bit PCM, 6 ms onset and 40 ms ending fades, each peak normalized to −12 dBFS.
No pitch shift, time stretch or equalization. Jeremy liked this timbre but requested procedural generation
instead of recorded playback. These clips now exist only for development comparisons.

`accepted-clips.json` stores the PCM as base64. It is not imported by runtime code or included in the
production build. `tools/rotary-friction-study.mjs` compares it with the generated sound at matching peak level.

Rebuild with `python3 tools/prepare-rotary-creaks.py`, using only the checked-in reference WAV and Python's
standard library. The original reference files and study figures are not imported by the game.
