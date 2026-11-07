"""Kokoro (sherpa-onnx, offline) narration: one wav per line + voice.wav with fixed gaps + lines_timing.json."""
import sys, json, numpy as np, soundfile as sf, sherpa_onnx
mdir, sid, speed = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
here = sys.argv[4]
GAP = 0.16          # pause between lines (s); the hook gets a longer beat after it
EXTRA = {0: 0.45, 6: 0.35, 8: 0.25, 12: 0.45}
LEAD = 0.15
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
    model=f"{mdir}/model.onnx", voices=f"{mdir}/voices.bin", tokens=f"{mdir}/tokens.txt", data_dir=f"{mdir}/espeak-ng-data", lexicon=f"{mdir}/lexicon-us-en.txt", lang="en-us"), num_threads=4))
tts = sherpa_onnx.OfflineTts(cfg)
lines = json.load(open(f"{here}/lines.json"))
out, t, timing, sr = [], LEAD, [], None
for i, text in enumerate(lines):
    a = tts.generate(text.replace("2027", "twenty twenty-seven").replace("2030", "twenty thirty").replace("1930", "nineteen thirty").replace("Keynes", "Canes"), sid=sid, speed=speed)
    sr = a.sample_rate
    x = np.array(a.samples, np.float32)
    # trim leading/trailing silence
    nz = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, nz[0] - int(0.02 * sr)): nz[-1] + int(0.06 * sr)]
    if not out: out.append(np.zeros(int(LEAD * sr), np.float32))
    out.append(x); d = len(x) / sr
    timing.append({"i": i, "text": text, "start": round(t, 3), "end": round(t + d, 3)})
    g = GAP + EXTRA.get(i, 0)
    out.append(np.zeros(int(g * sr), np.float32)); t += d + g
y = np.concatenate(out)
sf.write(f"{here}/voice.wav", y, sr)
json.dump({"sr": sr, "duration": round(len(y) / sr, 3), "lines": timing}, open(f"{here}/lines_timing.json", "w"), indent=1)
words = sum(len(l.split()) for l in lines)
print("duration", len(y) / sr, "words", words, "wps", words / (len(y) / sr))
