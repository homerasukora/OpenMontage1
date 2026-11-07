// "What if AI took every job in 2027?" — VIRUS2027 What-If short, 1080x1920 @ 30 fps.
// Flat cartoon cards in an ink-outlined 3D world (three.js inside Remotion), graded to the VIRUS2027 palette.
// Post chain: InkPass (world outlines) -> bloom (emissive orange only) -> neutral tone map -> V27 grade.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "./ink";
import { GradeEffect } from "./grade";
import { SHOTS, shotAt, Ctx, ShotRT } from "./shots";
import { loadTex, PAL } from "./kit";
import { Overlay } from "./Overlay";
import { TOTAL } from "./timing";

export const WHATIF_FRAMES = TOTAL;

const FONTS: [string, string, string][] = [
  ["Barlow Condensed", "fonts/BarlowCondensed-ExtraBold.ttf", "800"],
  ["Barlow Condensed", "fonts/BarlowCondensed-SemiBold.ttf", "600"],
  ["IBM Plex Mono", "fonts/IBMPlexMono-Medium.ttf", "500"],
  ["IBM Plex Mono", "fonts/IBMPlexMono-Medium.ttf", "600"],
];

const useAssets = () => {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [handle] = useState(() => delayRender("whatif assets"));
  useEffect(() => {
    (async () => {
      await Promise.all(FONTS.map(async ([fam, url, w]) => { const ff = new FontFace(fam, `url(${staticFile(url)})`, { weight: w }); await ff.load(); document.fonts.add(ff); }));
      const [watch, present, hips, logo] = await Promise.all(["img/vira_watch.png", "img/vira_present.png", "img/vira_hips.png", "img/logo_v_paper.png"].map((u) => loadTex(staticFile(u))));
      setCtx({ vira: { watch, present, hips, logo } });
      continueRender(handle);
    })();
  }, [handle]);
  return ctx;
};

const post = () => ({ ink: true, bloom: true, grade: true, ...((getInputProps() as { post?: Record<string, boolean> }).post ?? {}) });

const Inner: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const cache = useMemo(() => new Map<number, ShotRT>(), []);
  const on = useMemo(post, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, cam, { widthNear: 4.2, widthFar: 2.6, color: "#050403", farOpacity: 0.85 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 6, radius: 0.65 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect({ sat: 0.3, contrast: 1.08, lift: 0.01 }),
  }), [scene, cam]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  gl.setClearColor(PAL.bg);
  const si = shotAt(f), shot = SHOTS[si];
  let rt = cache.get(si);
  if (!rt) { rt = shot.build(ctx, shot.a); cache.set(si, rt); }
  for (const [k, r] of cache) if (k !== si && r.root.parent) scene.remove(r.root);
  if (!rt.root.parent) scene.add(rt.root);
  scene.fog = new THREE.Fog(rt.fog[0], rt.fog[1], rt.fog[2]);
  scene.background = new THREE.Color(PAL.bg);
  rt.update(f - shot.a, cam);
  noInkFallback(rt.root);
  return (
    <EffectComposer multisampling={2}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : <></>}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : <></>}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : <></>}
    </EffectComposer>
  );
};

export const WhatIfShort: React.FC = () => {
  const ctx = useAssets();
  const f = useCurrentFrame();
  const si = shotAt(f), lf = f - SHOTS[si].a;
  const jitter = lf < 3 && si > 0 ? [10, -7, 4][lf] : 0;
  const withAudio = (getInputProps() as { audio?: boolean }).audio;
  return (
    <AbsoluteFill style={{ background: PAL.bg }}>
      {ctx && (
        <AbsoluteFill style={{ transform: `translateX(${jitter}px)` }}>
          <ThreeCanvas width={1080} height={1920} gl={{ antialias: false, stencil: false, toneMappingExposure: 1.0 }} camera={{ fov: 40, near: 0.1, far: 1500 }}>
            <Inner ctx={ctx} />
          </ThreeCanvas>
        </AbsoluteFill>
      )}
      <Overlay />
      {withAudio ? <Audio src={staticFile("audio/mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
