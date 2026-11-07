#!/bin/bash
# Render in chunks so progress survives interruptions; skips chunks that already exist.
cd "$(dirname "$0")/.."
mkdir -p out/chunks
TOTAL=2061; STEP=300
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=$(printf "out/chunks/c%04d.mp4" $a)
  [ -f "$f" ] && continue
  npx remotion render src/index.ts WhatIfAI2027 "$f.tmp.mp4" --frames=$a-$b --codec h264 --crf 18 --gl=swangle \
    --browser-executable=/opt/pw-browsers/chromium --concurrency=4 --timeout=240000 --log=error > out/chunk.log 2>&1 \
    && mv "$f.tmp.mp4" "$f" && echo "done $a-$b $(date +%T)"
done
