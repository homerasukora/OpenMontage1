// 2D layer over the 3D picture: grain, vignette, archive HUD (file / timecode / chapter), hook title and end card.
// VIRUS2027 web style guide: condensed uppercase display (Barlow Condensed), mono technical labels (IBM Plex Mono),
// orange on one word / number only, labels are atmosphere and never carry the story alone.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { SHOTS, shotAt } from "./shots";
import { at, fr, LINES, TOTAL } from "./timing";
import { PAL, FPS, clamp } from "./kit";

const MONO = "IBM Plex Mono, monospace";
const DISPLAY = "Barlow Condensed, Arial Narrow, sans-serif";

const reveal = (f: number, a: number, dur = 12) => clamp((f - a) / dur);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** heading line revealed through a vertical mask */
const MaskLine: React.FC<{ f: number; a: number; children: React.ReactNode; size: number; out?: number }> = ({ f, a, children, size, out }) => {
  const t = ease(reveal(f, a, 10));
  const o = out !== undefined ? 1 - clamp((f - out) / 6) : 1;
  return (
    <div style={{ overflow: "hidden", height: size * 0.98, opacity: o }}>
      <div style={{ transform: `translateY(${(1 - t) * 100}%)`, fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase", color: PAL.text, whiteSpace: "nowrap", textShadow: "0 4px 30px rgba(0,0,0,0.6)" }}>{children}</div>
    </div>
  );
};
const O: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: PAL.signal }}>{children}</span>;

const Grain: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.11, mixBlendMode: "overlay" }}>
    <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
      <filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 6} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#g${f % 6})`} />
    </svg>
  </AbsoluteFill>
);

const Corners: React.FC = () => {
  const c = (s: React.CSSProperties) => <div style={{ position: "absolute", width: 34, height: 34, borderColor: "rgba(232,227,219,0.38)", borderStyle: "solid", borderWidth: 0, ...s }} />;
  return (<>
    {c({ left: 36, top: 36, borderLeftWidth: 2, borderTopWidth: 2 })}{c({ right: 36, top: 36, borderRightWidth: 2, borderTopWidth: 2 })}
    {c({ left: 36, bottom: 36, borderLeftWidth: 2, borderBottomWidth: 2 })}{c({ right: 36, bottom: 36, borderRightWidth: 2, borderBottomWidth: 2 })}
  </>);
};

const tc = (f: number) => {
  const s = Math.floor(f / FPS), ff = f % FPS;
  return `00:00:${String(s).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
};

const label: React.CSSProperties = { fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color: PAL.soft };

export const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  const si = shotAt(f), shot = SHOTS[si], lf = f - shot.a;
  const hookEnd = SHOTS[1].a;
  const endA = SHOTS[SHOTS.length - 1].a;
  // end card cues
  const qA = fr(at(13)) - 2, qB = fr(at(13, "prediction, or")) - 2, qC = fr(at(13, "or warning")) - 2, eA = fr(at(13, "Every prediction")) - 2;
  const outro = fr(LINES[13].end) + 6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(5,4,3,0.72) 100%)" }} />
      <Grain f={f} />
      <Corners />
      {/* HUD */}
      <div style={{ position: "absolute", left: 92, top: 78, ...label }}>VIRUS2027 <span style={{ color: PAL.signal }}>///</span> WHAT IF</div>
      <div style={{ position: "absolute", right: 92, top: 78, ...label }}>FILE 2027-AI</div>
      <div style={{ position: "absolute", left: 92, bottom: 80, ...label, fontSize: 20, color: PAL.muted }}>TRANSMISSION {tc(f)}</div>
      <div style={{ position: "absolute", right: 92, bottom: 80, ...label, fontSize: 20, color: PAL.muted }}><span style={{ color: PAL.signal }}>{String(si + 1).padStart(2, "0")}</span> / {String(SHOTS.length).padStart(2, "0")}</div>
      {/* chapter label */}
      {shot.label && lf < 75 && (
        <div style={{ position: "absolute", left: 92, top: 132, display: "flex", alignItems: "center", gap: 16, opacity: 1 - clamp((lf - 60) / 15) }}>
          <div style={{ width: interpolate(lf, [0, 10], [0, 46], { extrapolateRight: "clamp" }), height: 3, background: PAL.signal }} />
          <div style={{ ...label, fontSize: 26, color: PAL.text, clipPath: `inset(0 ${100 - 100 * ease(reveal(lf, 4, 10))}% 0 0)` }}>{shot.label}</div>
        </div>
      )}
      {/* hook title */}
      {f < hookEnd + 6 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", opacity: 1 - clamp((f - hookEnd + 4) / 8) }}>
          <div style={{ ...label, fontSize: 24, color: PAL.signal, marginBottom: 22, opacity: reveal(f, 2, 8) }}>— SCENARIO 01 —</div>
          <MaskLine f={f} a={4} size={128}>WHAT IF AI TOOK</MaskLine>
          <MaskLine f={f} a={12} size={128}>EVERY JOB IN <O>2027?</O></MaskLine>
        </div>
      )}
      {/* end card */}
      {f >= endA && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {f < eA ? (<>
              <MaskLine f={f} a={qA} size={112}>COINCIDENCE?</MaskLine>
              <MaskLine f={f} a={qB} size={112}>PREDICTION?</MaskLine>
              <MaskLine f={f} a={qC} size={112}><O>WARNING?</O></MaskLine>
            </>) : (<>
              <MaskLine f={f} a={eA} size={124}>EVERY PREDICTION</MaskLine>
              <MaskLine f={f} a={eA + 8} size={124}>LEADS TO <O>2027</O></MaskLine>
            </>)}
          </div>
          {f >= outro && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 1330, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: ease(reveal(f, outro, 12)) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
                <Img src={staticFile("img/avatar_orange.jpg")} style={{ width: 92, height: 92 }} />
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: PAL.text, letterSpacing: "-0.01em" }}>WHAT DO <O>YOU</O> PREDICT?</div>
              </div>
              <div style={{ ...label, fontSize: 26, color: PAL.text }}>FOLLOW THE SIGNAL <span style={{ color: PAL.signal }}>///</span> $VIRUS2027</div>
            </div>
          )}
        </>
      )}
      {/* glitch burst on every cut (one short burst, then still) */}
      {lf < 4 && si > 0 && (
        <AbsoluteFill>
          {[0, 1, 2].map((k) => {
            const y = (Math.sin((si * 7 + k * 3 + lf) * 12.9898) * 43758.5453 % 1 + 1) % 1;
            return <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${y * 100}%`, height: 3 + k * 5, background: k === 1 ? PAL.signal : "rgba(232,227,219,0.55)", opacity: 0.8 - lf * 0.2, transform: `translateX(${(k - 1) * 30}px)` }} />;
          })}
        </AbsoluteFill>
      )}
      {f > TOTAL - 10 && <AbsoluteFill style={{ background: PAL.bg, opacity: clamp((f - (TOTAL - 10)) / 9) }} />}
    </AbsoluteFill>
  );
};
