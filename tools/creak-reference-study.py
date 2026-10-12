"""uv run --with numpy --with scipy --with matplotlib python tools/creak-reference-study.py <study-directory>"""
import json
import subprocess
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

root = Path(sys.argv[1])
rate, window, hop = 24000, 1024, 128
clips = [
    ("rejected-synth.wav", "Rejected synth", "Current 0.72 s rotary sound"),
    ("clothesline-excerpt.wav", "Recorded clothesline", "AlexLane · source 12–14 s · CC0"),
    ("gate-0304.mp3", "Recorded metal gate", "DenisChardonnet · complete clip · CC0"),
]
plt.rcParams.update({"font.size": 11, "axes.titleweight": "bold", "font.family": "DejaVu Sans"})
fig = plt.figure(figsize=(15, 7.6), layout="constrained")
grid = fig.add_gridspec(2, 3, height_ratios=[1, 3.4])
spectra, measurements = [], []

for col, (file, title, detail) in enumerate(clips):
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(root / file),
        "-f", "f32le", "-ar", str(rate), "-ac", "1", "pipe:1",
    ])
    original = np.frombuffer(raw, dtype="<f4").copy()
    peak = float(np.max(np.abs(original)))
    x = original / peak
    f, t, z = stft(x, fs=rate, window="hann", nperseg=window, noverlap=window-hop, boundary="zeros")
    db = 20 * np.log10(np.maximum(np.abs(z), 1e-8))
    power = np.sum(np.abs(z) ** 2, axis=1)
    power[0] = 0
    cumulative = np.cumsum(power) / np.sum(power)
    measurements.append({
        "file": file, "duration_seconds": len(x) / rate,
        "source_peak_dbfs": 20 * np.log10(peak),
        "energy_above_2khz_percent": 100 * float(np.sum(power[f >= 2000]) / np.sum(power)),
        "spectral_centroid_hz": float(np.sum(f * power) / np.sum(power)),
        "energy_95_percent_below_hz": float(f[np.searchsorted(cumulative, .95)]),
    })
    # Equal peak level makes timbre comparison independent of recording gain; it is not equal loudness.
    audition = np.concatenate([np.zeros(round(.25 * rate)), x * 10 ** (-18 / 20), np.zeros(round(.35 * rate))])
    wavfile.write(root / f"{Path(file).stem}-audition.wav", rate, np.int16(np.clip(audition, -1, 1) * 32767))

    ax = fig.add_subplot(grid[0, col])
    ax.plot(np.arange(len(x)) / rate, x, color="#326d75", linewidth=.55)
    ax.set(xlim=(0, 2), ylim=(-1.05, 1.05), yticks=[-1, 0, 1])
    ax.set_title(f"{title}\n{detail}", loc="left", fontsize=12, pad=12)
    ax.tick_params(axis="x", labelbottom=False)
    if col == 0:
        ax.set_ylabel("Waveform")
    ax.spines[["top", "right"]].set_visible(False)
    ax = fig.add_subplot(grid[1, col])
    plot = ax.pcolormesh(t, f / 1000, db, shading="auto", cmap="magma", vmin=-65, vmax=0, rasterized=True)
    ax.set(xlim=(0, 2), ylim=(0, 12), xlabel="Time in excerpt (seconds)", yticks=[0, 2, 4, 6, 8, 10, 12])
    if col == 0:
        ax.set_ylabel("Frequency (kHz)")
    if len(x) / rate < 2:
        duration = len(x) / rate
        ax.axvspan(duration, 2, color="#edf0f2")
        ax.text((duration + 2) / 2, 6, f"Clip ends\nat {duration:.2f} s", ha="center", color="#59636c")
    spectra.append(ax)

fig.colorbar(plot, ax=spectra, label="STFT magnitude (dB; waveform peaks normalized to 1)", shrink=.93, pad=.025)
fig.suptitle("Why the synthetic creak differs from recorded metal friction", fontsize=17, fontweight="bold")
fig.supxlabel("Same time / frequency / colour scales · No pitch or time changes · 24 kHz mono · Hann 42.7 ms window, 5.3 ms hop\n"
               "Peak normalization exposes structure, not in-game volume. References are compressed previews; listening remains decisive.",
               fontsize=10, color="#46525a")
fig.savefig(root / "spectrogram-comparison.png", dpi=150)
fig.savefig(root / "spectrogram-comparison.pdf")
(root / "measurements.json").write_text(json.dumps({
    "sample_rate": rate, "window_samples": window, "hop_samples": hop,
    "display_db": [-65, 0], "measurements": measurements,
}, indent=2) + "\n")
print(json.dumps(measurements, indent=2))
