# VIRUS2027 · What If shorts (Remotion + three.js)

Вертикальные анимационные What-If шорты в бренд-стиле VIRUS2027. Подход взят из
[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT): плоские 2D-персонажи
с ink-обводкой в 3D-мире, рендер three.js внутри Remotion, всё синтезируется локально. Палитра, типографика,
HUD и грейд переделаны под VIRUS2027 (near-black, warm monochrome, сигнальный #FF531F, Barlow Condensed / IBM Plex Mono, зерно).

## Эпизод 01 — «What if AI took every job in 2027?»
Сценарий и раскадровка: [`SCRIPT.md`](SCRIPT.md).

## Структура
| Путь | Что |
|---|---|
| `voice/lines.json` | текст озвучки по строкам |
| `voice/tts_lines.py` | озвучка Kokoro v1.0 (sherpa-onnx, офлайн), голос `am_michael`, speed 1.3 → `voice.wav` + `lines_timing.json` |
| `audio/sound.py` | синтезированный эмбиент + тиканье + SFX, дакинг под голос → `audio/premaster.wav` |
| `src/whatif/shots.ts` | раскадровка: 17 планов, сеты, камера, позы — всё привязано к таймингу строк |
| `src/whatif/toon.ts`, `ink.ts` | персонажи и обводка из референс-репо (MIT, см. `LICENSE_claude-animated-shorts.txt`), + галстук/очки/руки вверх/предмет в руке |
| `src/whatif/kit.ts`, `props.ts` | палитра, камера, билборды, фасады, пропсы |
| `src/whatif/grade.ts` | грейд: тёплый монохром, сохраняется только оранжевый |
| `src/whatif/Overlay.tsx` | зерно, виньетка, HUD (FILE / TRANSMISSION / главы), титр хука, финальная карточка |
| `public/img` | Вира (3 позы, фон у позы с часами вырезан), лого V, аватар |

## Сборка
```bash
npm install
M=<path>/kokoro-multi-lang-v1_0   # https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
python3 voice/tts_lines.py $M 16 1.3 voice
python3 audio/sound.py
ffmpeg -y -i audio/premaster.wav -af loudnorm=I=-14:TP=-1.5:LRA=7 -ar 48000 public/audio/mix.wav
node scripts/stills.mjs out/st/x_ 60,300,900 0.5          # проверочные кадры
npx remotion render src/index.ts WhatIfAI2027 out/video_noaudio.mp4 --codec h264 --crf 18 --gl=swangle
ffmpeg -i out/video_noaudio.mp4 -i public/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest out/whatif_ai_2027.mp4
```
Новый эпизод: поменять `voice/lines.json`, перегенерировать голос, переписать `shots.ts` (каждый `add(...)` = один бит).
