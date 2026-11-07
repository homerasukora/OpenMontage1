// Narration timing (voice/lines_timing.json, made by voice/tts_lines.py). Everything is timed to it.
import T from "../../voice/lines_timing.json";
import { FPS } from "./kit";

export const LINES = T.lines as { i: number; text: string; start: number; end: number }[];
export const VO_DURATION = T.duration as number;
export const END_HOLD = 3.4; // end card after the last word (s)
export const TOTAL = Math.round((VO_DURATION + END_HOLD) * FPS);

/** seconds when `frag` starts inside line i (character-proportional estimate inside the measured line) */
export const at = (i: number, frag?: string) => {
  const L = LINES[i];
  if (!frag) return L.start;
  const k = L.text.indexOf(frag);
  if (k < 0) throw new Error(`fragment "${frag}" not in line ${i}`);
  return L.start + (L.end - L.start) * (k / L.text.length);
};
export const fr = (s: number) => Math.round(s * FPS);
/** a visual reaction lands 0-3 frames before its word */
export const cue = (i: number, frag?: string) => fr(at(i, frag)) - 2;
