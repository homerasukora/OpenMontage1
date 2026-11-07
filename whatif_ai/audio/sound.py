"""Original synthesized score + SFX for the What-If short, timed to voice/lines_timing.json, then the mix.
Brand sound code (marketing strategy 8): dark ambient, sub-bass, pulse/ticking countdown, slow build to a cut-off.
No major corporate tracks. Output: public/audio/mix.wav (48 kHz stereo, exact video length)."""
import json, numpy as np, soundfile as sf
from scipy import signal
SR = 48000
T = json.load(open("voice/lines_timing.json"))
L = T["lines"]
FPS = 30
TOTAL = round((T["duration"] + 3.4) * FPS) / FPS
N = int(TOTAL * SR)
rng = np.random.default_rng(27)
def at(i, frag=None):
    l = L[i]
    if not frag: return l["start"]
    k = l["text"].index(frag); return l["start"] + (l["end"] - l["start"]) * k / len(l["text"])
def b0(i): return (round(l_start(i) * FPS) - 3) / FPS
def l_start(i): return L[i]["start"]
t = np.arange(N) / SR
music = np.zeros((N, 2)); sfx = np.zeros((N, 2))
def put(buf, x, s, g=1.0, pan=0.0):
    i = int(s * SR)
    if i >= N: return
    x = x[: N - i]
    buf[i:i + len(x), 0] += x * g * np.sqrt(0.5 * (1 - pan)); buf[i:i + len(x), 1] += x * g * np.sqrt(0.5 * (1 + pan))
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e
def lp(x, fc, o=2): b, a = signal.butter(o, fc / (SR / 2)); return signal.lfilter(b, a, x)
def bp(x, lo, hi): b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band"); return signal.lfilter(b, a, x)
def hp(x, fc): b, a = signal.butter(2, fc / (SR / 2), "high"); return signal.lfilter(b, a, x)

# ---------------- score ----------------
END_A = b0(13)
# drone: A1 + E2 with slow beating, warm low-passed saw pad
build = np.clip(t / END_A, 0, 1)
drone = 0.5 * np.sin(2 * np.pi * 55 * t) + 0.25 * np.sin(2 * np.pi * 55.15 * t) + 0.22 * np.sin(2 * np.pi * 82.4 * t)
saw = sum(np.sin(2 * np.pi * 110 * k * t + k) / k for k in range(1, 9)) + sum(np.sin(2 * np.pi * 110.4 * k * t) / k for k in range(1, 9))
pad = lp(saw, 600) * (0.10 + 0.10 * build) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 7.5))
air = lp(hp(rng.standard_normal(N), 1500), 5000) * 0.012 * (1 + 0.5 * np.sin(2 * np.pi * t / 5))
bed = drone * (0.32 + 0.12 * build) + pad + air
for c in range(2): music[:, c] += bed * (1 if c == 0 else 0.97)
# pulse: clock tick every 0.5 s (countdown), tock accent each second; muted in the "Wait." beat and the 1930 archive
tick = bp(rng.standard_normal(int(0.03 * SR)), 2500, 6000) * env(int(0.03 * SR), 0.001, 0.025)
tock = bp(rng.standard_normal(int(0.04 * SR)), 900, 2200) * env(int(0.04 * SR), 0.001, 0.035)
mute = [(at(8) - 0.2, at(9)), (END_A - 0.5, at(13, "Every prediction"))]
s = 0.0
while s < TOTAL - 0.6:
    if not any(a <= s < b for a, b in mute):
        put(music, tock if int(s * 2) % 2 == 0 else tick, s, 0.22 if int(s * 2) % 2 == 0 else 0.15, -0.3 if int(s * 2) % 2 else 0.3)
    s += 0.5
# sub heartbeat from the payday beat on (tension rises)
kick_ = np.sin(2 * np.pi * (48 * np.exp(-np.arange(int(0.35 * SR)) / SR * 10)) * np.arange(int(0.35 * SR)) / SR) * env(int(0.35 * SR), 0.002, 0.3)
s = at(6)
while s < END_A - 0.4:
    if not any(a <= s < b for a, b in mute): put(music, kick_, s, 0.5); put(music, kick_, s + 0.28, 0.3)
    s += 1.0
# end riser + hit on "2027"
r0, r1 = at(13, "Every prediction") - 1.6, at(13, "2027")
n = int((r1 - r0) * SR); tt = np.arange(n) / SR
nz = rng.standard_normal(n); u = (tt / tt[-1]) ** 2
riser = (lp(nz, 400) * (1 - u) + lp(nz, 5400) * u) * u * 0.35
put(music, riser, r0)
hitn = int(2.8 * SR); th = np.arange(hitn) / SR
hit = (np.sin(2 * np.pi * 41 * th) * 0.9 + lp(rng.standard_normal(hitn), 900) * 0.4) * np.exp(-th * 1.6)
put(music, hit, r1, 0.9)

# ---------------- sfx ----------------
def whoosh(d=0.35, lo=300, hi=3000):
    n = int(d * SR); x = rng.standard_normal(n); e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return bp(x, lo, hi) * e
def bell(f0=1760, d=1.2):
    n = int(d * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(2 * np.pi * f0 * 2.76 * tt) + 0.25 * np.sin(2 * np.pi * f0 * 5.4 * tt)) * np.exp(-tt * 4)
def thump(d=0.5, f=60):
    n = int(d * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt * np.exp(-tt * 3)) + lp(rng.standard_normal(n), 400) * 0.6) * np.exp(-tt * 9)
def clank(d=0.6):
    n = int(d * SR); tt = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 200, 2500) * np.exp(-tt * 12) + sum(np.sin(2 * np.pi * f * tt) for f in (340, 517, 790)) * 0.25 * np.exp(-tt * 7))
def glitch(d=0.13):
    n = int(d * SR); x = np.sign(np.sin(2 * np.pi * 1200 * np.arange(n) / SR)) * (rng.random(n) > 0.4)
    return hp(x * env(n, 0.002, 0.05), 800) * 0.4
def cheer(d=3.5):
    n = int(d * SR); tt = np.arange(n) / SR
    crowd = bp(rng.standard_normal(n), 400, 3000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 1.7 * tt)))
    claps = np.zeros(n)
    for k in range(60):
        i = int(rng.random() * (n - 3000)); claps[i:i + 1500] += bp(rng.standard_normal(1500), 1000, 5000) * np.exp(-np.arange(1500) / 200)
    return (crowd * 0.35 + claps * 0.5) * env(n, 0.3, 1.2)
def flutter(d=1.2):
    n = int(d * SR); tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 800, 4000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * tt)) * env(n, 0.05, 0.4)
def printer(d=1.8):
    n = int(d * SR); tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 1500, 4500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * tt))) * env(n, 0.02, 0.2)
def beeps(n=3):
    tt = np.arange(int(0.08 * SR)) / SR; b = np.sin(2 * np.pi * 1320 * tt) * env(len(tt), 0.003, 0.03)
    out = np.zeros(int(0.15 * SR * n)); 
    for k in range(n): out[int(k * 0.15 * SR): int(k * 0.15 * SR) + len(b)] += b
    return out

cuts = [b0(i) for i in range(1, 14)] + [at(2, "burgers flip") - 0.07, at(2, "and the call") - 0.07, at(9, "Like arcade") - 0.07, at(10, "and worried") - 0.07]
for c in cuts: put(sfx, glitch(), c, 0.35); put(sfx, whoosh(0.3), c - 0.15, 0.25)
put(sfx, beeps(3), at(1, "has already"), 0.25, 0.2)
put(sfx, bell(1568, 1.0), at(1, "whole year"), 0.3, 0.2)
put(sfx, whoosh(1.2, 120, 900), at(2) - 0.2, 0.6, -0.4)                     # truck passing
put(sfx, whoosh(0.45, 500, 2500), at(2, "flip themselves") - 0.1, 0.35)      # burger toss
put(sfx, beeps(2), at(2, "one polite"), 0.2)
put(sfx, cheer(4.0), at(3) - 0.1, 0.45)
put(sfx, bell(2093, 0.6), at(3, "No alarm"), 0.2, -0.3)
put(sfx, whoosh(0.5, 900, 3500), at(3, "no meetings"), 0.25, 0.4)
put(sfx, clank(0.3), at(4, "then his neighbor"), 0.25)
put(sfx, thump(0.6, 50), at(6, "there's no pay"), 0.8)
put(sfx, flutter(1.4), at(6, "there's no pay") + 0.1, 0.3, 0.3)
put(sfx, flutter(2.5), at(7) + 0.1, 0.25, -0.3)
put(sfx, printer(1.8), at(9), 0.2)
put(sfx, clank(0.6), at(9, "counter is open") + 0.3, 0.6)
put(sfx, thump(0.4, 70), at(9, "counter is open") + 0.3, 0.6)
put(sfx, whoosh(0.8, 200, 1500), at(10, "and worried"), 0.3)

# ---------------- mix ----------------
v, vsr = sf.read("voice/voice.wav")
if vsr != SR: v = signal.resample_poly(v, SR, vsr)
voice = np.zeros(N); voice[: min(N, len(v))] = v[:N]
# duck music/sfx under the voice (envelope follower)
ve = np.abs(voice); ve = lp(ve, 8, 1); duck = 1 - 0.45 * np.clip(ve / (ve.max() * 0.25), 0, 1)
mus = music * duck[:, None]; fx = sfx * (0.6 + 0.4 * duck)[:, None]
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
vr = rms(voice[voice != 0])
mus *= (vr * 10 ** (-13 / 20)) / rms(mus.mean(1)); fx *= (vr * 10 ** (-12 / 20)) / max(rms(fx.mean(1)), 1e-9)
mix = np.stack([voice, voice], 1) + mus + fx
mix *= 0.89 / np.abs(mix).max()
fade = int(0.3 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
sf.write("audio/premaster.wav", mix, SR)
print("len", len(mix) / SR, "total", TOTAL)
