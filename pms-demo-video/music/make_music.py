"""Original royalty-free background bed: warm pads + soft pluck arpeggio + light pulse.
Usage: python3 -I make_music.py <out.wav> [seconds]"""
import sys, numpy as np, soundfile as sf
SR = 44100
out = sys.argv[1]; total = float(sys.argv[2]) if len(sys.argv) > 2 else 200
bpm = 92; beat = 60 / bpm; bar = beat * 4
def midi(n): return 440 * 2 ** ((n - 69) / 12)
# I - vi - IV - V style progression in D major, voiced warmly
prog = [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]]
n = int(total * SR); mix = np.zeros((n, 2))
t_all = np.arange(n) / SR
def env(length, a, r):
    e = np.ones(length); ai = int(a * SR); ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
rng = np.random.default_rng(7)
chord_len = bar * 2
i = 0; t0 = 0.0
while t0 < total:
    ch = prog[i % len(prog)]; s = int(t0 * SR); L = min(int((chord_len + 1.5) * SR), n - s)
    if L <= 0: break
    t = np.arange(L) / SR
    pad = np.zeros(L)
    for note in ch:
        f = midi(note)
        for det in (-0.12, 0.0, 0.12):  # detuned saw-ish via few harmonics
            ff = f * 2 ** (det / 12)
            pad += sum(np.sin(2 * np.pi * ff * k * t + rng.uniform(0, 6)) / k ** 1.6 for k in (1, 2, 3))
    pad *= env(L, 1.4, 1.6) * 0.018
    mix[s:s + L, 0] += pad; mix[s:s + L, 1] += np.roll(pad, 300)
    # pluck arpeggio, eighth notes
    arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 12, ch[4] + 12, ch[3] + 12]
    for k in range(16):
        ts = t0 + k * beat / 2
        if ts >= total: break
        ps = int(ts * SR); pl = min(int(0.9 * SR), n - ps); tt = np.arange(pl) / SR
        f = midi(arp[k % 8])
        note = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 5.5) * 0.05
        pan = 0.5 + 0.3 * np.sin(k)
        mix[ps:ps + pl, 0] += note * (1 - pan); mix[ps:ps + pl, 1] += note * pan
    # soft sub pulse on beats + light hat
    for k in range(8):
        ts = t0 + k * beat
        if ts >= total or t0 < bar * 2: break  # pulse enters after intro
        ps = int(ts * SR); pl = min(int(0.35 * SR), n - ps); tt = np.arange(pl) / SR
        kick = np.sin(2 * np.pi * (55 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * 0.06
        mix[ps:ps + pl] += kick[:, None]
        hs = int((ts + beat / 2) * SR); hl = min(int(0.06 * SR), n - hs)
        if hl > 0:
            hat = rng.normal(0, 1, hl) * np.exp(-np.arange(hl) / SR * 70) * 0.012
            mix[hs:hs + hl] += np.diff(np.concatenate([[0], hat]))[:, None]
    t0 += chord_len; i += 1
# gentle low-pass smoothing + fades + normalise
k = 6; mix = np.apply_along_axis(lambda c: np.convolve(c, np.ones(k) / k, mode='same'), 0, mix)
fade = int(3 * SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]; mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) / 0.8
sf.write(out, mix.astype(np.float32), SR)
print('wrote', out, total, 's')
