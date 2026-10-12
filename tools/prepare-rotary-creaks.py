"""Preserve the accepted CC0 clothesline excerpts for comparison with procedural synthesis."""
import base64
import json
import math
import struct
import wave
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / "assets/audio-reference/rotary-creak/clothesline-excerpt.wav"
target = root / "assets/audio-reference/rotary-creak/accepted-clips.json"
with wave.open(str(source)) as audio:
    assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
    rate = audio.getframerate()
    samples = struct.unpack(f"<{audio.getnframes()}h", audio.readframes(audio.getnframes()))

clips = []
for start, end in [(.11, .73), (.91, 1.53)]:
    clip = list(samples[round(start * rate):round(end * rate)])
    for i in range(len(clip)):
        fade = min(1, i / (.006 * rate), (len(clip) - 1 - i) / (.04 * rate))
        clip[i] *= math.sin(max(0, fade) * math.pi / 2) ** 2
    gain = (32767 * 10 ** (-12 / 20)) / max(abs(x) for x in clip)
    pcm = struct.pack(f"<{len(clip)}h", *(round(x * gain) for x in clip))
    clips.append(base64.b64encode(pcm).decode("ascii"))

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({"sampleRate": rate, "clips": clips}, separators=(",", ":")) + "\n")
print(f"Prepared {len(clips)} clips, {target.stat().st_size} bytes")
