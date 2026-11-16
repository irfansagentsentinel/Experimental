"""Synthesised soundtrack for the Reef Sentinel launch reel (no samples, no licences).

120 BPM, 2-second bars, cut to the same grid as reel.html:
  0-4 hook · 4 brand reveal · 8 numbers · 12 room chart · 18 front desk
  22 support · 26 coming soon · 30 price lock (breakdown) · 32 call to action

Usage: python3 music.py out/soundtrack.wav
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 44100
DUR = 36.5
N = int(SR * DUR)
rng = np.random.default_rng(7)


def hz(note):
    """MIDI note number -> frequency."""
    return 440.0 * 2 ** ((note - 69) / 12)


def buf():
    return np.zeros((N, 2))


def add(dst, sig, t, gain=1.0, pan=0.0):
    """Mix a mono signal into a stereo buffer at time t (seconds)."""
    i = int(t * SR)
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
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    click = rng.standard_normal(n) * np.exp(-t / 0.003) * 0.25
    return body + lowpass(click, 4000)


def hat(decay=0.03):
    n = int(0.12 * SR)
    return highpass(rng.standard_normal(n), 7500, 4) * env(n, 0.001, decay)


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = bandpass(rng.standard_normal(n), 900, 3800)
    e = sum(np.where(t >= d, np.exp(-(t - d) / 0.012), 0) for d in (0, 0.011, 0.022)) * 0.5
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.09), 0)
    return noise * e


def pluck(note, length=0.5, bright=1.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.42 * bright), (3, 0.2 * bright), (4, 0.08 * bright)):
        sig += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / (0.2 / h ** 0.6))
    return sig * np.minimum(1, t / 0.004)


def bass(note, length=0.24):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08)
    e = np.minimum(1, t / 0.006) * np.exp(-t / 0.2) * np.minimum(1, (length - t) / 0.02)
    return np.tanh(1.6 * sig * e)


def pad(notes, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for note in notes:
        f = hz(note)
        for det in (-0.004, 0.004):
            for h, a in ((1, 1.0), (2, 0.3), (3, 0.12)):
                sig += a * np.sin(2 * np.pi * f * (1 + det) * h * t + rng.uniform(0, 6.28))
    e = np.minimum(1, t / 0.35) * np.minimum(1, (length - t) / 0.5)
    return sig * e / len(notes)


def bell(note, length=1.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.12)
    return sig * np.minimum(1, t / 0.003)


def blip(f0, f1, length=0.09):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = np.linspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.03)


def sweep(length, f_start, f_end, shape=2.0):
    """Filtered-noise riser or whoosh: band-pass centre glides f_start -> f_end."""
    n = int(length * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 512
    zi = np.zeros(2)
    for i in range(0, n, block):
        p = i / n
        fc = f_start * (f_end / f_start) ** p
        b, a = butter(1, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], 'band', fs=SR)
        out[i : i + block], zi = lfilter(b, a, noise[i : i + block], zi=zi)
    t = np.linspace(0, 1, n)
    return out, t ** shape


def impact():
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(34 + 50 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.45)
    crash = highpass(rng.standard_normal(n), 3500) * np.exp(-t / 0.55) * 0.22
    return boom, crash


# ---------- arrangement ----------
BEAT = 0.5
BAR = 2.0
D, A, Bm, G = 'D', 'A', 'Bm', 'G'
CHORDS = {  # root (bass), pad voicing, arp notes
    D: (38, [57, 62, 66, 69], [62, 66, 69, 74, 69, 66]),
    A: (45, [57, 61, 64, 69], [61, 64, 69, 73, 69, 64]),
    Bm: (47, [59, 62, 66, 69], [62, 66, 71, 74, 71, 66]),
    G: (43, [59, 62, 67, 71], [62, 67, 71, 74, 71, 67]),
}
#        0  1  2  3  4   5  6  7  8   9  10 11 12  13 14 15 16 17 18
PROG = [G, A, D, A, Bm, G, D, A, Bm, G, D, A, Bm, G, D, A, D, D, D]

drums, music, fx, sub = buf(), buf(), buf(), buf()
K, H, C = kick(), hat(), clap()
duck = np.ones(N)  # side-chain curve driven by the kick

for bar in range(18):
    t0 = bar * BAR
    root, voicing, arp = CHORDS[PROG[bar]]
    intro, groove, breakdown, outro = bar < 2, 2 <= bar < 15, bar == 15, bar >= 16

    # pad
    if not intro:
        length = BAR + 0.4 if bar < 16 else 5.0
        if bar <= 16:
            add(music, lowpass(pad(voicing, length), 2400), t0, 0.16 if not outro else 0.2)
    else:
        add(music, lowpass(pad(voicing, BAR + 0.4), 1100), t0, 0.16)

    # arpeggio, eighth notes
    if bar < 16:
        for step in range(8):
            t = t0 + step * BEAT / 2
            note = arp[step % len(arp)] + (12 if step in (3, 6) else 0)
            bright = 0.25 + 0.75 * min(1, (bar * 8 + step) / 16) if intro else 1.0
            gain = (0.17 if intro else 0.17) * (0.8 if breakdown else 1) * (1.0 if step % 2 == 0 else 0.72)
            add(music, pluck(note, 0.6, bright), t, gain, pan=0.5 * np.sin(step * 1.9))
    elif bar == 16:
        for step, note in enumerate([62, 66, 69, 74, 78, 81]):
            add(music, pluck(note, 1.4), t0 + step * 0.125, 0.16, pan=-0.5 + step * 0.2)

    # drums + bass
    if groove:
        for beat in range(4):
            t = t0 + beat * BEAT
            add(drums, K, t, 0.8)
            i = int(t * SR)
            seg = np.arange(min(int(0.3 * SR), N - i)) / SR
            duck[i : i + len(seg)] = np.minimum(duck[i : i + len(seg)], 1 - 0.55 * np.exp(-seg / 0.09))
            add(drums, H, t + BEAT / 2, 0.2, pan=0.25)
            if bar >= 6:
                add(drums, hat(0.012), t + BEAT / 4, 0.07, pan=-0.3)
                add(drums, hat(0.012), t + 3 * BEAT / 4, 0.07, pan=-0.3)
            if bar >= 4 and beat in (1, 3):
                add(drums, C, t, 0.3)
        for step in (0, 1.5, 2, 3, 3.5):
            add(sub, bass(root + 12 if step == 3.5 else root), t0 + step * BEAT, 0.5)
    elif intro:
        for beat in range(4):
            add(drums, hat(0.015), t0 + beat * BEAT + BEAT / 2, 0.14, pan=0.2)
        add(sub, bass(root, 0.5), t0, 0.42)
    elif breakdown:
        add(sub, bass(root, 1.2), t0, 0.35)
        for step in range(8):
            add(drums, hat(0.015), t0 + step * BEAT / 2, 0.05 + 0.02 * step)
        for step in (5, 6, 7, 7.5):
            add(drums, C, t0 + step * BEAT / 2, 0.12 + 0.03 * step)
    elif bar == 16:
        add(sub, bass(root, 1.6), t0, 0.5)

# transitions and accents
for t_hit in (4.0, 32.0):
    boom, crash = impact()
    add(sub, boom, t_hit, 0.75)
    add(fx, crash, t_hit, 0.5)
for t_start, length in ((2.4, 1.6), (30.0, 2.0)):
    noise, ramp = sweep(length, 400, 9000)
    add(fx, noise * ramp, t_start, 0.34)
for t_cut in (8.0, 12.0, 18.0, 22.0, 26.0):  # scene wipes
    noise, ramp = sweep(0.7, 5000, 500)
    add(fx, noise * np.sin(np.pi * ramp ** 0.25) * 0.5, t_cut - 0.05, 0.3, pan=0.0)

# picture-synced sounds
for i, t in enumerate((0.5, 1.0, 1.5, 2.0)):  # chips land
    add(fx, blip(620 + 90 * i, 900 + 120 * i), t, 0.22, pan=-0.4 + 0.27 * i)
for i, t in enumerate((3.05, 3.15, 3.25, 3.35)):  # ticks as they line up
    add(fx, blip(1500 + 120 * i, 1900 + 120 * i, 0.05), t, 0.1)
for t in (14.0, 15.75):  # new booking
    add(fx, bell(86), t, 0.12, pan=-0.2)
    add(fx, bell(93), t + 0.09, 0.1, pan=0.2)
for t, note in ((8.5, 81), (9.5, 85), (10.5, 88)):  # numbers
    add(fx, bell(note, 0.9), t, 0.07)
add(fx, blip(900, 1400, 0.07), 19.2, 0.16)  # check-in tap
for t in (23.05, 23.7, 24.4):  # chat messages
    add(fx, blip(1100, 1500, 0.06), t, 0.12, pan=0.2)
click = lowpass(rng.standard_normal(int(0.05 * SR)) * env(int(0.05 * SR), 0.0005, 0.006), 5000)
add(fx, click, 30.55, 0.5)  # lock closes
add(sub, bass(38, 0.3), 30.55, 0.4)

# ---------- mix ----------
music *= duck[:, None]
sub *= (0.45 + 0.55 * duck)[:, None]

# intro filter opens over the first 4 seconds
intro_n = int(4 * SR)
music[:intro_n] = lowpass(music[:intro_n], 2200)

ir_n = int(1.6 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / (0.42 * SR))[:, None]
ir = highpass(ir, 300)
wet_src = music + 0.6 * fx
wet = np.stack([fftconvolve(wet_src[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
wet /= np.max(np.abs(wet)) + 1e-9

delay = buf()  # dotted-eighth ping-pong on the plucks
d = int(0.375 * SR)
delay[d:, 0] += music[:-d, 1] * 0.22
delay[2 * d :, 1] += music[: -2 * d, 0] * 0.12

mix = music + delay + drums + sub + fx + 0.2 * wet
mix = highpass(mix, 28)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(1.5 * mix) / np.tanh(1.5)

t = np.arange(N) / SR
fade = np.minimum(1, t / 0.02) * np.clip((DUR - t) / 2.2, 0, 1) ** 1.5
mix *= fade[:, None] * 0.77  # lands at about -14 LUFS, -2 dBTP

out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out, f'{DUR}s')
