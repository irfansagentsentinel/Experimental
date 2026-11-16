"""Soundtrack for the Reef Sentinel brag video, written as one piece: music and effects
share a key (D major), a reverb and a single beat grid counted from the first frame.

90 BPM, so a beat is 2/3 s = 20 video frames. Scene cuts fall on beats 4, 8, 14, 18, 24, 28
and each one is also a chord change. Everything is synthesised here; there are no samples.

Usage: python3 soundtrack.py soundtrack.wav
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 44100
BEAT = 2 / 3
BEATS = 34
DUR = BEATS * BEAT
N = int(round(SR * DUR))
rng = np.random.default_rng(11)


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def buf():
    return np.zeros((N, 2))


def add(dst, sig, beat, gain=1.0, pan=0.0):
    """Mix a mono signal into a stereo buffer, starting on the given beat."""
    i = int(round(beat * BEAT * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dst[i : i + len(sig), 0] += sig * gain * left
    dst[i : i + len(sig), 1] += sig * gain * right


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def lowpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, 'low', fs=SR, output='sos'), x, axis=0)


def highpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, 'high', fs=SR, output='sos'), x, axis=0)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


# ---------- voices ----------
def kick():
    n = int(0.36 * SR)
    t = np.arange(n) / SR
    f = 48 + 100 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    click = lowpass(rng.standard_normal(n) * np.exp(-t / 0.003) * 0.2, 3500)
    return body + click


def hat(decay=0.03):
    n = int(0.14 * SR)
    return highpass(rng.standard_normal(n), 7000, 4) * env(n, 0.002, decay)


def clap():
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    noise = bandpass(rng.standard_normal(n), 800, 3200)
    e = sum(np.where(t >= d, np.exp(-(t - d) / 0.012), 0) for d in (0, 0.012, 0.024)) * 0.5
    e += np.where(t >= 0.032, np.exp(-(t - 0.032) / 0.1), 0)
    return noise * e


def pluck(note, length=0.7, bright=1.0, decay=0.22):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.4 * bright), (3, 0.18 * bright), (4, 0.07 * bright)):
        sig += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / (decay / h ** 0.6))
    return sig * np.minimum(1, t / 0.005)


def bell(note, length=1.4, decay=0.4):
    """Soft mallet: the effect voice. Same family as the plucks, so it sits inside the music."""
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.sin(2 * np.pi * f * t) * np.exp(-t / decay) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / (decay / 3))
    return sig * np.minimum(1, t / 0.006)


def bass(note, length=0.34):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.09)
    e = np.minimum(1, t / 0.008) * np.exp(-t / 0.26) * np.minimum(1, (length - t) / 0.03)
    return np.tanh(1.5 * sig * e)


def pad(notes, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for note in notes:
        f = hz(note)
        for det in (-0.004, 0.004):
            for h, a in ((1, 1.0), (2, 0.28), (3, 0.1)):
                sig += a * np.sin(2 * np.pi * f * (1 + det) * h * t + rng.uniform(0, 6.28))
    e = np.minimum(1, t / 0.3) * np.minimum(1, (length - t) / 0.45)
    return sig * e / len(notes)


def sweep(length, f_start, f_end):
    """Filtered noise whose band-pass centre glides from f_start to f_end."""
    n = int(length * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    zi = np.zeros(2)
    for i in range(0, n, 512):
        fc = f_start * (f_end / f_start) ** (i / n)
        b, a = butter(1, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], 'band', fs=SR)
        out[i : i + 512], zi = lfilter(b, a, noise[i : i + 512], zi=zi)
    return out, np.linspace(0, 1, n)


def impact():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(36 + 46 * np.exp(-t / 0.07)) / SR) * np.exp(-t / 0.5)
    wash = highpass(rng.standard_normal(n), 3000) * np.minimum(1, t / 0.01) * np.exp(-t / 0.6) * 0.18
    return boom, wash


# ---------- harmony: one chord per half-bar (2 beats) ----------
D, A, Bm, G = 'D', 'A', 'Bm', 'G'
CHORDS = {  # bass root, pad voicing, arpeggio
    D: (38, [57, 62, 66, 69], [62, 66, 69, 74]),
    A: (45, [57, 61, 64, 69], [61, 64, 69, 73]),
    Bm: (47, [59, 62, 66, 71], [62, 66, 71, 74]),
    G: (43, [59, 62, 67, 71], [62, 67, 71, 74]),
}
#        hook    reveal  chart           desk   support         lock    call to action
PROG = [Bm, Bm, D, D, A, A, Bm, G, D, A, Bm, G, A, A, D, D, D]

drums, music, fx, sub = buf(), buf(), buf(), buf()
K, H, C = kick(), hat(), clap()
duck = np.ones(N)


def hit_kick(beat, gain=0.8):
    add(drums, K, beat, gain)
    i = int(round(beat * BEAT * SR))
    seg = np.arange(min(int(0.32 * SR), N - i)) / SR
    duck[i : i + len(seg)] = np.minimum(duck[i : i + len(seg)], 1 - 0.5 * np.exp(-seg / 0.1))


ARP = [0, 2, 1, 2, 3, 2, 1, 2]  # sixteenths across a half-bar
for hb, name in enumerate(PROG):
    b0 = hb * 2
    root, voicing, arp = CHORDS[name]
    intro, lock, ending = b0 < 4, 24 <= b0 < 28, b0 >= 32
    groove = (4 <= b0 < 24) or (28 <= b0 < 32)

    # pad
    length = (2 * BEAT + 0.4) if not ending else 3.2
    add(music, lowpass(pad(voicing, length), 1000 if intro else 2300), b0, 0.15 if intro else 0.17)

    # arpeggio
    if intro:
        for step in range(4):  # eighths, muted
            add(music, pluck(arp[step % 4], 0.6, 0.3), b0 + step * 0.5, 0.15, pan=0.3 * (-1) ** step)
    elif not ending:
        for step in range(8):
            note = arp[ARP[step]] + (12 if step == 4 else 0)
            gain = (0.15 if step % 2 == 0 else 0.085) * (0.75 if lock else 1)
            add(music, pluck(note, 0.6), b0 + step * 0.25, gain, pan=0.5 * np.sin(step * 1.7 + hb))
    else:
        for step, note in enumerate([62, 66, 69, 74, 78]):
            add(music, pluck(note, 1.6, decay=0.4), b0 + step * 0.25, 0.15, pan=-0.4 + 0.2 * step)

    # drums and bass
    first_half = hb % 2 == 0  # beats 1-2 of the bar; second half is beats 3-4
    if groove:
        if first_half:
            hit_kick(b0)
            hit_kick(b0 + 1.5, 0.62)
            add(drums, C, b0 + 1, 0.28)
            for step in (0, 1.5):
                add(sub, bass(root), b0 + step, 0.5)
        else:
            hit_kick(b0)
            add(drums, C, b0 + 1, 0.28)
            add(sub, bass(root), b0, 0.5)
            add(sub, bass(root + 12, 0.22), b0 + 1.5, 0.3)
        for step in range(4):
            add(drums, H, b0 + step * 0.5, 0.17 if step % 2 else 0.1, pan=0.25)
        add(drums, hat(0.012), b0 + 1.75, 0.07, pan=-0.3)
    elif intro:
        if b0 == 0:
            add(sub, bass(root, 0.9), 0, 0.42)
        for step in range(4):
            add(drums, hat(0.014), b0 + step * 0.5 + 0.5, 0.08 + 0.02 * hb, pan=0.2)
    elif lock:
        if first_half:
            add(sub, bass(root, 1.2), b0, 0.36)
        for step in range(4):
            add(drums, hat(0.014), b0 + step * 0.5, 0.07 + 0.015 * step + (0.03 if b0 == 26 else 0), pan=0.2)
        if b0 == 26:
            for step, g in ((1.0, 0.1), (1.5, 0.15), (1.75, 0.2)):
                add(drums, C, b0 + step, g)
    elif ending:
        hit_kick(b0, 0.7)
        add(sub, bass(root, 1.6), b0, 0.5)

# ---------- transitions ----------
for beat in (4, 28):  # reveal and call to action land
    boom, wash = impact()
    add(sub, boom, beat, 0.62)
    add(fx, wash, beat, 0.4)
for beat, beats in ((2.5, 1.5), (26, 2)):  # risers into those two
    noise, ramp = sweep(beats * BEAT, 500, 8000)
    add(fx, noise * ramp ** 2, beat, 0.26)
for beat in (8, 14, 18, 24):  # wave wipes
    noise, ramp = sweep(0.6, 4200, 600)
    add(fx, noise * np.sin(np.pi * ramp ** 0.3), beat, 0.11)

# ---------- picture-synced effects: mallet notes from the chord of the moment ----------
SFX = [
    # hook (Bm): chips land, then tick into place
    (0.5, 71, 0.15, -0.3), (1.0, 74, 0.15, 0.0), (1.5, 78, 0.15, 0.3),
    (2.75, 83, 0.06, -0.2), (3.0, 86, 0.06, 0.0), (3.25, 90, 0.06, 0.2),
    # room chart (A, then Bm): booking arrives, fills the room, sites sell out
    (10.5, 81, 0.1, -0.2), (10.625, 88, 0.09, 0.2),
    (11.0, 76, 0.1, 0.0),
    (11.5, 81, 0.06, -0.3), (11.75, 85, 0.06, 0.0), (12.0, 90, 0.07, 0.3),
    # front desk (G, then D): tap, bill ready
    (15.5, 74, 0.11, 0.2), (17.0, 86, 0.09, 0.0), (17.125, 90, 0.08, 0.2),
    # support (A, Bm, G): message, reply, on-site band
    (19.5, 76, 0.1, 0.3), (20.5, 78, 0.1, -0.3), (20.625, 83, 0.08, -0.2), (21.25, 74, 0.08, 0.0),
    # price lock (A): lock appears, then closes
    (24.5, 69, 0.1, 0.0), (25.5, 57, 0.16, 0.0),
    # call to action (D): number lands
    (29.25, 81, 0.07, 0.0), (29.5, 86, 0.06, 0.1),
]
for beat, note, gain, pan in SFX:
    add(fx, bell(note, 1.0, 0.3 if note > 60 else 0.18), beat, gain, pan)
click = lowpass(rng.standard_normal(int(0.04 * SR)) * env(int(0.04 * SR), 0.001, 0.006), 3500)
add(fx, click, 25.5, 0.25)  # the lock's latch, under its note

# ---------- mix ----------
music *= duck[:, None]
sub *= (0.5 + 0.5 * duck)[:, None]

ir_n = int(1.5 * SR)
ir = highpass(rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / (0.4 * SR))[:, None], 350)
room_in = music + fx  # one shared room for music and effects
room = np.stack([fftconvolve(room_in[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
room /= np.max(np.abs(room)) + 1e-9

echo = buf()  # dotted-eighth echo on the plucks
d = int(round(0.75 * BEAT * SR))
echo[d:, 0] += music[:-d, 1] * 0.2
echo[2 * d :, 1] += music[: -2 * d, 0] * 0.1

mix = music + echo + drums + sub + fx + 0.22 * room
mix = highpass(mix, 30)
mix = lowpass(mix, 15000)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(2.0 * mix) / np.tanh(2.0)  # gentle glue

t = np.arange(N) / SR
fade = np.minimum(1, t / 0.01) * np.clip((DUR - t) / 1.6, 0, 1) ** 1.5
GAIN = float(sys.argv[2]) if len(sys.argv) > 2 else 0.75  # lands at about -14 LUFS
mix *= fade[:, None] * GAIN

out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print('wrote', out, f'{DUR:.3f}s', N, 'samples')
