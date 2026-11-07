// Shot plan: one entry per beat of the narration. Each shot builds its own little set once, then is posed per frame.
// Coordinates in metres, y up. Characters are camera-facing Canvas2D cards (toon.ts), the world is ink-outlined 3D.
import * as THREE from "three";
import { bodyFront, Outfit, Expr, FrontOpts, Pen, SKINS, bodySide } from "./toon";
import {
  PAL, Card, box, cyl, building, skyDome, gridFloor, contactShadow, imageCard, canvasTex, glow, matC,
  glide, CamKey, CamState, kick, ss, clamp, lerp, ramp, rnd, easeOut, V3, FPS,
} from "./kit";
import * as P from "./props";
import { cue, fr, at, TOTAL, LINES } from "./timing";

export type Ctx = { vira: { watch: THREE.Texture; present: THREE.Texture; hips: THREE.Texture; logo: THREE.Texture } };
export type ShotRT = { root: THREE.Group; fog: [string, number, number]; update: (f: number, cam: THREE.PerspectiveCamera) => void };
export type ShotDef = { id: string; a: number; b: number; label?: string; build: (ctx: Ctx, a: number) => ShotRT };

// ---------------------------------------------------------------- helpers
const applyCam = (cam: THREE.PerspectiveCamera, s: CamState, shake = 0) => {
  cam.position.set(s.pos[0] + shake, s.pos[1] + shake * 0.6, s.pos[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(s.look[0], s.look[1], s.look[2]);
  cam.rotateZ((s.roll * Math.PI) / 180);
  if (cam.fov !== s.fov) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
  cam.near = 0.1; cam.far = 1500;
  cam.updateProjectionMatrix();
};

export const blinkAt = (f: number, seed: number) => {
  const L = 15 + Math.floor(rnd(seed, 3) * 54);
  const k = (f + Math.floor(rnd(seed, 9) * 40)) % L;
  return k === 0 || k === 3 ? 0.5 : k === 1 || k === 2 ? 1 : 0;
};

type Pose = FrontOpts & { holdKey?: string };
class Person {
  card: Card; root = new THREE.Group(); shadow: THREE.Mesh;
  constructor(public o: Outfit, public seed: number, public s = 1, res = 0.7) {
    this.card = new Card(1.35 * s, 2.25 * s, 600, 1000, res);
    this.shadow = contactShadow(0.42 * s, 0.6);
    this.root.add(this.card.mesh, this.shadow);
  }
  at(x: number, y: number, z: number) { this.root.position.set(x, y, z); return this; }
  pose(p: Pose) {
    const { hold, ...rest } = p;
    const key = JSON.stringify(rest);
    this.card.draw(key, (g) => bodyFront(new Pen(g), this.o, { seed: this.seed, ...rest, hold }));
  }
}
class PropCard {
  card: Card;
  constructor(w: number, h: number, dw: number, dh: number, res = 1, billboard = true) { this.card = new Card(w, h, dw, dh, res, billboard); }
  get mesh() { return this.card.mesh; }
  draw(key: string, fn: (g: CanvasRenderingContext2D) => void) { this.card.draw(key, fn); }
}

/** dynamic canvas texture for 3D screens */
class Screen {
  tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; key = "";
  constructor(public w: number, public h: number) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    this.g = c.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
  }
  draw(key: string, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.key) return; this.key = key; fn(this.g, this.w, this.h); this.tex.needsUpdate = true;
  }
  mesh(wM: number, hM: number, k = 1.5) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(k, k, k) }));
    return m;
  }
}

const lights = (root: THREE.Object3D, o: { amb?: number; hemi?: [string, string, number]; key?: [string, number, V3]; pts?: [string, number, V3, number][] }) => {
  root.add(new THREE.AmbientLight("#ffffff", o.amb ?? 0.25));
  if (o.hemi) root.add(new THREE.HemisphereLight(o.hemi[0], o.hemi[1], o.hemi[2]));
  if (o.key) { const d = new THREE.DirectionalLight(o.key[0], o.key[1]); d.position.set(...o.key[2]); root.add(d); }
  for (const [c, i, p, dist] of o.pts ?? []) { const l = new THREE.PointLight(c, i, dist, 1.6); l.position.set(...p); root.add(l); }
};

// ---- cast ----
const DAVE: Outfit = { jacket: "#d4cbbb", pants: "#3a3631", boots: "#1d1a17", hat: "hair", hair: "#4a3426", tie: "#7c3a24", glasses: true, skin: SKINS[1] };
const NEIGHBOR: Outfit = { jacket: "#6b5442", pants: "#2c2925", boots: "#1d1a17", hat: "hair", hair: "#9a9284", moustache: "#8a8275", build: "stout", skin: SKINS[2] };
const JACKETS = ["#5b544b", "#7a6f62", "#3f3a34", "#9c9384", "#6b5442", "#4a443d", "#857a6c", "#2f2b27"];
const HAIRS = ["#2a201a", "#5a3b2a", "#8a7f70", "#1a1512", "#6b4a32"];
export const extra = (v: number): Outfit => {
  const o: Outfit = { jacket: JACKETS[v % 8], pants: ["#2c2925", "#3a3631", "#4a443d"][v % 3], boots: "#1d1a17", skin: SKINS[v % 4], hat: v % 5 === 2 ? "cap" : "hair", hair: HAIRS[v % 5], cap: "#3a3631" };
  if (v % 4 === 1) o.dress = ["#6b5f52", "#8a7f70", "#5a4636"][v % 3];
  if (v % 6 === 3) o.glasses = true;
  return o;
};

// ---- sets ----
/** night avenue: buildings both sides along -z, street lamps, sky. */
const city = (root: THREE.Group, o: { litP?: number; far?: number; seed?: number } = {}) => {
  const litP = o.litP ?? 0.62, seed = o.seed ?? 1;
  skyDome(root);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), matC(PAL.asphalt)); ground.rotation.x = -Math.PI / 2; root.add(ground);
  for (const s of [-1, 1]) box(4, 0.18, 400, PAL.walk, [s * 8, 0, -150], root);
  // lane marks
  for (let z = 30; z > -260; z -= 9) box(0.18, 0.02, 3.2, "#6b645a", [0, 0, z], root);
  let i = 0;
  for (const s of [-1, 1]) {
    let z = 30;
    while (z > -(o.far ?? 260)) {
      const w = 9 + 7 * rnd(seed, i), d = 9 + 6 * rnd(seed, i + 50), h = 14 + 34 * rnd(seed, i + 100) ** 1.4;
      building(root, s * (10.5 + w / 2), z - d / 2, w, d, h, seed * 31 + i, litP);
      z -= d + 0.6; i++;
    }
    // second row, taller
    z = 10;
    while (z > -300) {
      const w = 14 + 10 * rnd(seed, i), d = 14, h = 30 + 60 * rnd(seed, i + 100) ** 1.6;
      building(root, s * (36 + w / 2 + 10 * rnd(seed, i + 7)), z - d / 2, w, d, h, seed * 31 + i, litP * 0.9);
      z -= d + 4; i++;
    }
  }
  // street lamps (warm sodium heads, glow only)
  for (let z = 26; z > -200; z -= 16) for (const s of [-1, 1]) {
    box(0.16, 6.2, 0.16, "#1d1a17", [s * 6.6, 0, z], root);
    box(1.4, 0.12, 0.16, "#1d1a17", [s * 6.0, 6.1, z], root);
    box(0.6, 0.12, 0.35, glow("#ffb070", 2.2), [s * 5.5, 6.0, z], root);
  }
};

const flatCard = (tex: THREE.Texture, w: number, h: number, k = 1) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), transparent: true }));
  return m;
};

const signalRings = (root: THREE.Object3D, n = 3) => {
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.signal).multiplyScalar(1.4), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.02; root.add(r); rings.push(r);
  }
  return (f: number, speed = 0.012) => rings.forEach((r, i) => {
    const t = (f * speed + i / n) % 1;
    r.scale.setScalar(0.6 + 4.2 * t);
    (r.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - t);
  });
};

const voidStage = (root: THREE.Group) => {
  gridFloor(root, 120, true);
  skyDome(root, 0);
  lights(root, { amb: 0.6, hemi: ["#d9cfbd", "#0b0a09", 0.4], key: ["#fff1e2", 1.0, [3, 8, 6]] });
};

// =================================================================================================== SHOTS
const S = (i: number) => LINES[i].start;
const b0 = (i: number) => fr(S(i)) - 3; // shot boundary 3 frames before a line starts

const shotsRaw: Omit<ShotDef, "b">[] = [];
const add = (id: string, a: number, build: ShotDef["build"], label?: string) => shotsRaw.push({ id, a, build, label });

// ---------------------------------------------------------------- 0 HOOK: the city where every window is working
add("hook", 0, (ctx, A) => {
  const root = new THREE.Group();
  city(root, { litP: 0.8, seed: 3 });
  lights(root, { amb: 0.35, hemi: ["#5a4a3c", "#090806", 0.6], key: ["#ffd9b8", 0.5, [-20, 40, 30]] });
  // our rooftop: camera stands on the right-hand building's roof
  box(12, 30, 12, "#2a2521", [16, 0, 20], root);
  box(12.3, 0.5, 12.3, "#24201c", [16, 30, 20], root);
  box(0.3, 1.1, 12, "#2b2622", [10.15, 30, 20], root); // parapet
  box(12, 1.1, 0.3, "#2b2622", [16, 30, 14.15], root);
  box(1.2, 1.6, 1.2, "#3a342d", [19, 30.5, 22], root); // roof hatch
  const vira = imageCard(ctx.vira.watch, 2.1); vira.position.set(12.3, 30.5, 19.8); root.add(vira);
  const sh = contactShadow(0.7, 0.7); sh.position.set(12.3, 30.52, 19.8); root.add(sh);
  // autonomous traffic: glowing boxes gliding along the avenue
  const cars: THREE.Mesh[] = [];
  for (let k = 0; k < 14; k++) { const c = box(1.8, 1.3, 4.2, k % 3 ? "#1a1714" : "#2a2521", [k % 2 ? -2.2 : 2.2, 0, -10 - k * 17], root); cars.push(c); box(1.5, 0.15, 0.1, glow(k % 2 ? "#ff3a10" : "#ffd2a8", 2.5), [0, 0.55, k % 2 ? 2.15 : -2.15], c); }
  const keys: CamKey[] = [
    { f: 0, pos: [13.6, 33.4, 27.5], look: [-1, 21, -70], fov: 42 },
    { f: 170, pos: [13.0, 32.6, 25.2], look: [-1.5, 17.5, -70], fov: 40 },
  ];
  return {
    root, fog: [PAL.bg, 40, 330],
    update(f, cam) {
      applyCam(cam, glide(keys, f, 0));
      cars.forEach((c, k) => { c.position.z = (k % 2 ? 1 : -1) * ((f * 0.5 + k * 17) % 240) + (k % 2 ? -230 : 10); });
      vira.lookAt(cam.position.x, vira.position.y, cam.position.z);
      vira.scale.set(1, 1 + 0.012 * Math.sin(f * 0.18), 1);
    },
  };
});

// ---------------------------------------------------------------- 1 OFFICE: the laptop finished his whole year
add("office", b0(1), (ctx, A) => {
  const root = new THREE.Group();
  skyDome(root);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), matC("#2e2924")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  // back wall with three tall windows onto the city
  box(30, 0.9, 0.3, "#3b352f", [0, 0, -5], root); box(30, 0.9, 0.3, "#3b352f", [0, 2.7, -5], root);
  for (const x of [-7.5, -3.6, 0.3, 4.2, 8.1, 12]) box(0.6, 1.8, 0.3, "#3b352f", [x, 0.9, -5], root);
  box(0.3, 3.6, 14, "#35302a", [-6, 0, 2], root); // side wall
  for (let k = 0; k < 7; k++) building(root, -14 + k * 6.5, -24 - 6 * rnd(7, k), 5.6, 6, 20 + 20 * rnd(7, k + 9), 70 + k, 0.75);
  lights(root, { amb: 0.45, hemi: ["#d9cfbd", "#2a2521", 0.5], key: ["#ffe7d0", 0.7, [-4, 6, 6]], pts: [["#ff6a3c", 6, [0.3, 1.4, 0.6], 4]] });
  // ceiling light strips
  for (const z of [-2.5, 0.5, 3.5]) box(3.2, 0.06, 0.25, glow("#f3e6d5", 1.6), [0, 3.4, z], root);
  // rows of desks, every monitor already busy (orange)
  const deskAt = (x: number, z: number, mine = false) => {
    box(1.7, 0.06, 0.85, "#5a4636", [x, 0.74, z], root);
    for (const sx of [-0.78, 0.78]) box(0.06, 0.74, 0.8, "#2a2521", [x + sx, 0, z], root);
    if (!mine) {
      box(0.06, 0.38, 0.06, "#1d1a17", [x, 0.8, z - 0.2], root);
      const mon = box(0.62, 0.38, 0.04, "#1a1714", [x, 1.05, z - 0.2], root);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), glow("#ff531f", 0.9)); scr.position.set(0, 0, 0.025); mon.add(scr);
      box(0.5, 0.45, 0.5, "#2a2521", [x, 0, z + 0.65], root); // empty chair
    }
  };
  for (const z of [-2.8]) for (const x of [-4.2, -2.2, 1.8, 3.8]) deskAt(x, z);
  for (const x of [-4.4, 4.4]) deskAt(x, 0.2);
  deskAt(0.3, 0.2, true);
  // my desk: laptop + the finished year
  const screen = new Screen(512, 330);
  const lap = new THREE.Group(); lap.position.set(0.42, 0.8, 0.3); root.add(lap);
  box(0.46, 0.025, 0.32, "#3a3631", [0, 0, 0], lap);
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.15); lap.add(lid);
  box(0.46, 0.3, 0.02, "#3a3631", [0, 0, 0], lid);
  const scr = screen.mesh(0.42, 0.27, 1.25); scr.position.set(0, 0.15, 0.012); lid.add(scr);
  lid.rotation.x = -0.25;
  lap.rotation.y = -0.45;
  const stacks: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) stacks.push(box(0.3, 0.1, 0.4, PAL.paper, [0.95 + (k % 2) * 0.04, 0.77, -0.05 + k * 0.02], root));
  const dave = new Person(DAVE, 11, 1, 0.75); root.add(dave.root);
  const tDone = cue(1, "has already") - A, tFin = cue(1, "whole year") - A;
  const keys: CamKey[] = [
    { f: 0, pos: [-1.0, 1.5, 5.0], look: [-1.0, 1.1, 0.4], fov: 44 },
    { f: 62, pos: [-0.05, 1.5, 4.5], look: [-0.05, 1.1, 0.4], fov: 44 },
    { f: 140, pos: [0.05, 1.4, 4.0], look: [0.05, 1.05, 0.4], fov: 44 },
  ];
  return {
    root, fog: [PAL.bg, 18, 60],
    update(f, cam) {
      const sh = kick(f, tFin + 6, 0.025);
      applyCam(cam, glide(keys, f), sh);
      const walk = clamp(f / 62);
      const x = lerp(-2.6, -0.4, ss(walk)), moving = walk < 1;
      dave.at(x, 0, 0.75);
      const prog = clamp((f - tDone + 10) / 26);
      screen.draw(prog.toFixed(2), (g, w, h) => P.drawLaptop(g, w, h, prog));
      // paper stack grows into "the whole year"
      stacks.forEach((s, k) => { const t = ss(clamp((f - tDone - k * 5) / 16)); s.scale.y = 0.2 + 5.5 * t; s.position.y = 0.77 + 0.05 * s.scale.y; });
      const shocked = f >= tFin;
      dave.pose({ mode: moving ? "stroll" : "stand", phase: f / 30, expr: shocked ? "shock" : f > 40 ? "neutral" : "smile", look: shocked ? 1 : 0, blink: blinkAt(f, 11), facing: moving ? 1 : 0, lift: 60 });
      dave.card.face(cam); dave.card.tint([0.95, 0.92, 0.88]);
    },
  };
}, "DAY 001 / 08:59");

// ---------------------------------------------------------------- 2a TRUCK: drives itself
add("truck", b0(2), (ctx, A) => {
  const root = new THREE.Group();
  city(root, { litP: 0.55, seed: 5 });
  lights(root, { amb: 0.4, hemi: ["#7a6a5a", "#0f0d0b", 0.7], key: ["#ffe1c4", 0.8, [10, 12, 8]] });
  const truck = new THREE.Group(); root.add(truck);
  const body = "#8a8175", dark = "#1d1a17";
  box(2.4, 3.0, 5.6, "#b9b09f", [0, 0.9, -3.3], truck); // cargo box
  box(2.3, 0.5, 8.4, dark, [0, 0.45, -1.9], truck); // chassis
  // cab (open window on the camera side, so we see nobody in it)
  box(2.3, 1.0, 2.0, body, [0, 0.9, 1.0], truck); // lower cab
  box(2.3, 0.25, 2.0, body, [0, 2.75, 1.0], truck); // roof
  box(2.3, 0.9, 0.18, body, [0, 1.9, 1.95], truck); // windscreen frame (front)
  box(0.18, 0.9, 0.18, body, [1.06, 1.9, 0.06], truck); box(0.18, 0.9, 0.18, body, [1.06, 1.9, 1.9], truck);
  box(0.18, 0.9, 0.18, body, [-1.06, 1.9, 0.06], truck); box(2.3, 0.9, 0.12, body, [0, 1.9, 0.0], truck);
  box(0.12, 0.9, 1.9, "#4a443d", [-1.08, 1.9, 1.0], truck); // far side door glass (dark)
  box(0.7, 0.55, 0.6, "#3a2c22", [0.35, 1.9, 0.5], truck); box(0.7, 0.9, 0.15, "#3a2c22", [0.35, 1.9, 0.22], truck); // empty seat
  box(1.6, 0.25, 0.4, "#2a2521", [0, 1.9, 1.7], truck); // dash
  box(0.35, 0.12, 0.02, glow("#ff531f", 2.4), [0.35, 2.12, 1.49], truck); // nav glow
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 28), matC(dark)); wheel.position.set(0.35, 2.2, 1.45); wheel.rotation.x = -0.6; truck.add(wheel);
  const spoke = box(0.42, 0.04, 0.04, dark, [0, -0.02, 0], wheel); spoke.rotation.z = 0;
  for (const z of [1.2, -2.0, -4.6]) for (const s of [-1, 1]) {
    const w = cyl(0.5, 0.35, dark, [0, 0, 0], truck); w.rotation.z = Math.PI / 2; w.position.set(s * 1.1, 0.5, z);
    const hub = cyl(0.2, 0.37, "#55504a", [0, 0, 0], w); hub.position.y = 0;
  }
  box(0.5, 0.18, 0.05, glow("#ffe2c0", 2.5), [0.7, 1.15, 2.01], truck); box(0.5, 0.18, 0.05, glow("#ffe2c0", 2.5), [-0.7, 1.15, 2.01], truck);
  const v = 7.5 / FPS;
  return {
    root, fog: [PAL.bg, 30, 260],
    update(f, cam) {
      const z = -6 + f * v; truck.position.set(-2.0, 0, z);
      wheel.rotation.z = 0.5 * Math.sin(f * 0.25);
      applyCam(cam, { pos: [8.0, 2.2, z + 1.2 - f * 0.01], look: [-2.0, 1.9, z + 0.9], fov: 42, roll: -3 });
    },
  };
});

// ---------------------------------------------------------------- 2b BURGER: flips itself
add("burger", fr(at(2, "burgers flip")) - 2, (ctx, A) => {
  const root = new THREE.Group();
  skyDome(root);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matC("#2a2521")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  box(8, 3.4, 0.3, "#3b352f", [0, 0, -1.4], root);
  box(4, 1.0, 1.2, "#4a423a", [0, 0, -0.4], root); // counter
  box(1.6, 0.08, 0.9, "#1d1a17", [-0.2, 1.0, -0.4], root); // grill plate
  for (let k = 0; k < 6; k++) box(1.5, 0.012, 0.03, glow("#ff531f", 1.4 - k * 0.12), [-0.2, 1.085, -0.75 + k * 0.14], root);
  // hood + sign
  box(2.4, 0.5, 0.9, "#55504a", [-0.2, 2.6, -0.8], root);
  const sign = flatCard(canvasTex(512, 160, (g, w, h) => P.drawClosed(g, w, h, "STAFF: 0")), 1.2, 0.375); sign.position.set(1.4, 2.0, -1.22); root.add(sign);
  // robot arm (base, two links, spatula)
  const base = cyl(0.22, 0.25, "#2a2521", [1.25, 1.0, -0.5], root);
  const j0 = new THREE.Group(); j0.position.set(1.25, 1.25, -0.5); root.add(j0);
  const L1 = box(0.16, 0.85, 0.16, "#9c9384", [0, 0, 0], j0);
  const ring0 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), glow("#ff531f", 1.8)); j0.add(ring0);
  const j1 = new THREE.Group(); j1.position.set(0, 0.85, 0); j0.add(j1);
  box(0.13, 0.7, 0.13, "#b9b09f", [0, 0, 0], j1);
  const ring1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glow("#ff531f", 1.8)); j1.add(ring1);
  const j2 = new THREE.Group(); j2.position.set(0, 0.7, 0); j1.add(j2);
  box(0.04, 0.25, 0.04, "#55504a", [0, 0, 0], j2);
  box(0.26, 0.015, 0.2, "#c9ccd2", [0, 0.25, 0], j2);
  void base; void L1;
  // the burger
  const burger = new THREE.Group(); root.add(burger);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), matC("#b5823f")); top.position.y = 0.06; top.scale.y = 0.7; burger.add(top);
  cyl(0.15, 0.05, "#4a2e22", [0, 0.0, 0], burger);
  cyl(0.14, 0.04, "#b5823f", [0, -0.04, 0], burger);
  lights(root, { amb: 0.45, hemi: ["#d9cfbd", "#2a2521", 0.4], key: ["#ffe7d0", 0.9, [2, 5, 4]], pts: [["#ff6a3c", 5, [-0.2, 1.4, -0.2], 3]] });
  const N = fr(at(2, "and the call")) - fr(at(2, "burgers flip"));
  return {
    root, fog: [PAL.bg, 8, 40],
    update(f, cam) {
      const t = clamp(f / Math.max(10, N - 2));
      // arm swings over the grill, scoops, tosses
      const swing = ss(clamp(t * 2.2)), toss = clamp((t - 0.35) / 0.4);
      j0.rotation.z = lerp(-0.2, 0.75, swing) - 0.35 * Math.sin(Math.PI * clamp(toss * 1.3));
      j1.rotation.z = lerp(0.3, 1.1, swing);
      j2.rotation.z = lerp(-0.4, 0.3, swing);
      const air = Math.sin(Math.PI * toss);
      burger.position.set(-0.15, 1.13 + 0.55 * air, -0.45);
      burger.rotation.x = toss > 0 && toss < 1 ? Math.PI * 2 * ss(toss) : 0;
      applyCam(cam, glide([{ f: 0, pos: [0.9, 1.75, 1.9], look: [-0.1, 1.25, -0.5], fov: 40, roll: 4 }, { f: 45, pos: [0.65, 1.7, 1.6], look: [-0.15, 1.3, -0.5], fov: 40, roll: 4 }], f));
    },
  };
});

// ---------------------------------------------------------------- 2c SERVER: the call centre
add("server", fr(at(2, "and the call")) - 2, (ctx, A) => {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matC("#24201c")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  box(12, 3.2, 0.3, "#2f2a25", [0, 0, -1.6], root);
  box(0.3, 3.2, 8, "#2a2521", [-3.2, 0, 1], root);
  box(12, 0.2, 8, "#1d1a17", [0, 3.2, 1], root);
  for (const x of [-2.6, -1.6]) box(0.12, 0.12, 6, "#3a342d", [x, 2.9, 1], root); // pipes
  const leds = new Screen(256, 512);
  const rack = box(0.75, 2.0, 0.9, "#1a1714", [0, 0, -0.6], root);
  const front = leds.mesh(0.62, 1.84, 2.0); front.position.set(0, 0, 0.452); rack.add(front);
  for (const x of [-1.5, 1.5]) { const r = box(0.75, 2.0, 0.9, "#141210", [x, 0, -1.0], root); const fr2 = leds.mesh(0.62, 1.84, 0.8); fr2.position.set(0, 0, 0.452); r.add(fr2); }
  // a tiny headset on top of the rack
  const hs = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24, Math.PI), matC("#2a2521")); hs.position.set(0, 2.08, -0.6); root.add(hs);
  for (const s of [-1, 1]) { const cup = cyl(0.06, 0.05, "#2a2521", [0, 0, 0], root); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.17, 2.08, -0.6); }
  const mic = box(0.18, 0.02, 0.02, "#2a2521", [0.12, 2.0, -0.48], root); mic.rotation.y = -0.6;
  const bubble = new PropCard(1.5, 0.7, 600, 300, 1); bubble.mesh.position.set(0.12, 1.9, -0.2); bubble.mesh.scale.setScalar(0.85); root.add(bubble.mesh);
  bubble.draw("b", (g) => P.drawBubble(g, "HOW MAY I HELP?", "CALLS WAITING: 0"));
  lights(root, { amb: 0.25, hemi: ["#8a7f70", "#0b0a09", 0.35], pts: [["#ff531f", 9, [0, 1.2, 0.6], 4], ["#ffe1c4", 2, [1.5, 2.8, 2], 6]] });
  const pop = fr(at(2, "one polite")) - fr(at(2, "and the call"));
  return {
    root, fog: ["#060505", 4, 16],
    update(f, cam) {
      leds.draw(String(Math.floor(f / 2)), (g, w, h) => P.drawLEDs(g, w, h, Math.floor(f / 2), 1));
      const s = easeOut(clamp((f - pop) / 6)); bubble.mesh.scale.setScalar(Math.max(0.001, s * (1 + 0.08 * Math.sin(Math.PI * clamp((f - pop) / 6)))));
      applyCam(cam, glide([{ f: 0, pos: [0.7, 1.4, 3.6], look: [0.1, 1.5, -0.6], fov: 40 }, { f: 70, pos: [0.3, 1.6, 2.9], look: [0.15, 1.6, -0.6], fov: 42 }], f));
      bubble.card.face(cam);
    },
  };
});

// ---------------------------------------------------------------- 3 CELEBRATE
add("party", b0(3), (ctx, A) => {
  const root = new THREE.Group();
  city(root, { litP: 0.6, seed: 9 });
  lights(root, { amb: 0.5, hemi: ["#8a7a6a", "#0f0d0b", 0.7], key: ["#ffe1c4", 0.8, [-6, 12, 10]] });
  const crowd: { p: Person; x: number; z: number; ph: number }[] = [];
  const spots: [number, number][] = [[-2.2, -1.5], [0, -1.0], [2.1, -1.6], [-3.6, -3.6], [-1.2, -3.2], [1.1, -3.4], [3.4, -3.9], [-2.4, -5.8], [0.2, -5.6], [2.6, -6.0], [4.6, -6.6], [-4.6, -6.8]];
  spots.forEach(([x, z], k) => { const p = new Person(k === 1 ? DAVE : extra(k + 3), 40 + k, 1, k < 3 ? 0.7 : 0.5); p.at(x, 0, z); root.add(p.root); crowd.push({ p, x, z, ph: rnd(k, 4) }); });
  // confetti: paper squares, a few orange
  const conf: { m: THREE.Mesh; x: number; z: number; y0: number; sp: number; r: number }[] = [];
  const cg = new THREE.PlaneGeometry(0.09, 0.06);
  for (let k = 0; k < 140; k++) {
    const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: k % 9 === 0 ? PAL.signal : k % 2 ? PAL.paper : "#b9b09f", side: THREE.DoubleSide }));
    m.layers.set(3); root.add(m);
    conf.push({ m, x: (rnd(k, 1) - 0.5) * 9, z: -rnd(k, 2) * 7 + 1, y0: 3 + rnd(k, 3) * 5, sp: 0.6 + rnd(k, 5) * 0.6, r: rnd(k, 6) * 6 });
  }
  const alarm = new PropCard(0.6, 0.6, 300, 300, 1); root.add(alarm.mesh); alarm.draw("a", P.drawAlarm);
  const planes: PropCard[] = []; for (let k = 0; k < 4; k++) { const pl = new PropCard(0.6, 0.4, 300, 200, 1); pl.draw("p", P.drawPlane); root.add(pl.mesh); planes.push(pl); }
  const tAlarm = cue(3, "No alarm") - A, tMail = cue(3, "no meetings") - A;
  return {
    root, fog: [PAL.bg, 25, 220],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [0.4, 0.9, 6.2], look: [0, 2.0, -3], fov: 42, roll: -4 }, { f: 150, pos: [-0.3, 1.0, 4.8], look: [0, 2.0, -3], fov: 42, roll: 4 }], f));
      crowd.forEach(({ p, x, z, ph }, k) => {
        const hop = Math.abs(Math.sin((f / FPS) * 6 + ph * 6)) * 0.22;
        p.at(x, hop, z);
        p.shadow.position.y = 0.015 - hop;
        const ch = 0.75 + 0.25 * Math.sin((f / FPS) * 6 + ph * 6);
        p.pose({ mode: "stand", cheer: Number(ch.toFixed(2)), expr: k % 3 === 0 ? "laugh" : k % 3 === 1 ? "grin" : "relief_open", blink: blinkAt(f, 40 + k), facing: 0 });
        p.card.face(cam); p.card.tint(0.92);
      });
      conf.forEach((c, k) => {
        const y = c.y0 - ((f / FPS) * c.sp * 1.2) % 8;
        c.m.position.set(c.x + 0.3 * Math.sin(f * 0.05 + k), y < 0 ? y + 8 : y, c.z);
        c.m.rotation.set(f * 0.1 + c.r, f * 0.13 + c.r * 2, 0);
      });
      // alarm clock thrown up and spinning away
      const ta = clamp((f - tAlarm) / 28);
      alarm.mesh.visible = f >= tAlarm;
      alarm.mesh.position.set(-1.2 + 2.4 * ta, 1.6 + 3.2 * Math.sin(Math.PI * ta * 0.8), -1.2);
      alarm.card.face(cam); alarm.mesh.rotateZ(ta * 9);
      planes.forEach((pl, k) => {
        const tp = clamp((f - tMail - k * 5) / 40);
        pl.mesh.visible = f >= tMail + k * 5;
        pl.mesh.position.set(-4 + 8 * tp, 2.4 + k * 0.45 + 0.3 * Math.sin(tp * 6 + k), -1.8 - k * 0.6);
        pl.card.face(cam); pl.mesh.rotateZ(0.15 * Math.sin(tp * 8 + k));
      });
    },
  };
}, "DAY 001 / 12:00");

// ---------------------------------------------------------------- 4 WEEK TWO: alphabetised everything
add("socks", b0(4), (ctx, A) => {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matC("#3a2f26")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  box(14, 3.2, 0.3, "#4a4037", [0, 0, -3.2], root);
  box(0.3, 3.2, 10, "#433a32", [-5, 0, 1], root);
  // door (neighbour) in the back wall, right
  box(1.2, 2.3, 0.1, "#1a1512", [3.4, 0, -3.02], root);
  box(0.12, 2.4, 0.2, "#6b5442", [2.74, 0, -3.0], root); box(0.12, 2.4, 0.2, "#6b5442", [4.06, 0, -3.0], root); box(1.44, 0.12, 0.2, "#6b5442", [3.4, 2.3, -3.0], root);
  // spice shelf (left)
  box(3.0, 0.06, 0.35, "#6b5442", [-2.6, 1.45, -2.9], root);
  box(3.0, 0.06, 0.35, "#6b5442", [-2.6, 1.95, -2.9], root);
  const jars = [["ANISE", "#7a5a3a"], ["BASIL", "#5a5a3a"], ["CUMIN", "#8a5a2a"], ["DILL", "#6a6a4a"], ["FENNEL", "#7a6a4a"], ["GINGER", "#9a6a3a"]];
  jars.forEach(([n, c], k) => {
    const j = new PropCard(0.3, 0.39, 200, 260, 1, false); j.draw("j", (g) => P.drawJar(g, n, c));
    j.mesh.position.set(-3.85 + (k % 6) * 0.5, k < 6 ? 1.51 : 2.01, -2.75); root.add(j.mesh);
  });
  for (let k = 0; k < 5; k++) { const j = new PropCard(0.3, 0.39, 200, 260, 1, false); const n = ["HONEY", "JUNIPER", "LIME", "MINT", "NUTMEG"][k]; j.draw("j", (g) => P.drawJar(g, n, "#6b5442")); j.mesh.position.set(-3.85 + k * 0.6, 2.01, -2.75); root.add(j.mesh); }
  // washing line with socks A..H
  const lineM = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 6.4, 6), matC("#d9cfbd")); lineM.rotation.z = Math.PI / 2; lineM.position.set(0.3, 2.25, -1.8); root.add(lineM);
  const socks: PropCard[] = [];
  "ABCDEFGH".split("").forEach((l, k) => {
    const s = new PropCard(0.38, 0.55, 220, 320, 1, false); s.draw("s", (g) => P.drawSock(g, l, k % 2 ? "#b9b09f" : "#8a8175"));
    s.mesh.position.set(-2.5 + k * 0.72, 1.72, -1.78); root.add(s.mesh); socks.push(s);
  });
  const dave = new Person(DAVE, 11, 1, 0.75); dave.at(1.2, 0, 0.2); root.add(dave.root);
  const nb = new Person(NEIGHBOR, 23, 1, 0.6); nb.at(3.4, 0, -2.75); root.add(nb.root);
  lights(root, { amb: 0.5, hemi: ["#ffe7d0", "#2a2521", 0.4], key: ["#ffe7d0", 0.6, [2, 6, 5]], pts: [["#ffb070", 4, [0, 2.9, 0], 7]] });
  const tSock = cue(4, "then his socks") - A, tNb = cue(4, "then his neighbor") - A;
  return {
    root, fog: [PAL.bg, 10, 40],
    update(f, cam) {
      applyCam(cam, glide([
        { f: 0, pos: [-2.4, 1.75, 0.2], look: [-2.6, 1.7, -3], fov: 40 },
        { f: tSock, pos: [-0.9, 1.9, 1.6], look: [-0.4, 1.7, -2], fov: 40 },
        { f: tNb + 4, pos: [1.6, 1.6, 4.6], look: [2.2, 1.25, -1.2], fov: 40 },
      ], f));
      const nbIn = ss(clamp((f - tNb) / 10));
      nb.at(3.4 - 0.0, 0, -2.75); nb.root.visible = f >= tNb - 2;
      nb.card.mesh.position.x = lerp(0.7, 0, nbIn);
      dave.pose({ mode: "stand", hold: P.holdSock("I"), holdKey: "I", holdUp: 0.7, expr: f >= tNb + 6 ? "nervous" : "smile_closed", blink: blinkAt(f, 11) });
      nb.pose({ mode: "stand", expr: "stern", blink: blinkAt(f, 23), look: -1, facing: -1 });
      dave.card.face(cam); nb.card.face(cam); dave.card.tint(0.95); nb.card.tint(0.9);
      socks.forEach((s, k) => { s.mesh.rotation.z = 0.04 * Math.sin(f * 0.08 + k); });
    },
  };
}, "WEEK 02");

// ---------------------------------------------------------------- 5 MONTH THREE: queue to feel late
add("queue", b0(5), (ctx, A) => {
  const root = new THREE.Group();
  city(root, { litP: 0.55, seed: 13 });
  // the dark office: entrance on the right sidewalk
  box(14, 30, 10, "#1f1b18", [17.5, 0, -1], root);
  box(2.4, 2.6, 0.2, "#0d0c0b", [10.45, 0, -1], root, Math.PI / 2);
  const sign = flatCard(canvasTex(512, 200, (g, w, h) => P.drawClosed(g, w, h, "CLOSED")), 1.1, 0.43); sign.position.set(10.38, 1.6, -1); sign.rotation.y = -Math.PI / 2; root.add(sign);
  box(0.2, 0.25, 3.2, "#3a342d", [10.5, 2.7, -1], root);
  lights(root, { amb: 0.45, hemi: ["#8a7a6a", "#0f0d0b", 0.6], key: ["#ffe1c4", 0.6, [-6, 10, 12]], pts: [["#ffb070", 6, [8.5, 5.8, 3], 12]] });
  const q: Person[] = [];
  for (let k = 0; k < 9; k++) { const p = new Person(k === 0 ? extra(1) : extra(k + 10), 60 + k, 1, k < 3 ? 0.7 : 0.5); p.at(9.0 - 0.05 * (k % 2), 0, 0.6 + k * 1.15); root.add(p.root); q.push(p); }
  const tLate = cue(5, "just to feel") - A;
  return {
    root, fog: [PAL.bg, 20, 200],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [6.4, 1.6, 10.5], look: [9.0, 1.3, 5.5], fov: 42, roll: -3 }, { f: 100, pos: [6.9, 1.55, 3.9], look: [9.1, 1.35, 0.4], fov: 42, roll: 2 }], f));
      q.forEach((p, k) => {
        const check = k === 0 && f >= tLate;
        p.pose({ mode: "stand", expr: check ? "nervous" : k % 3 === 0 ? "neutral" : k % 3 === 1 ? "dazed" : "stern", blink: blinkAt(f, 60 + k), look: -1, facing: -1,
          ...(check ? { hold: P.holdWatch, holdKey: "w", holdUp: 1 } : {}), headTilt: k % 2 ? -4 : 3 });
        p.card.face(cam); p.card.tint(1.0);
      });
    },
  };
}, "MONTH 03");

// ---------------------------------------------------------------- 6 PAYDAY: no pay
add("atm", b0(6), (ctx, A) => {
  const root = new THREE.Group();
  skyDome(root);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matC(PAL.walk)); floor.rotation.x = -Math.PI / 2; root.add(floor);
  box(10, 4, 0.4, "#3b352f", [0, 0, -1.2], root);
  const atm = box(0.9, 1.6, 0.4, "#55504a", [-0.3, 0.4, -0.95], root);
  const scr = new Screen(400, 300); const sm = scr.mesh(0.6, 0.45, 1.4); sm.position.set(0, 0.35, 0.205); atm.add(sm);
  box(0.4, 0.04, 0.05, "#0d0c0b", [-0.3, 1.25, -0.73], root); // card slot
  box(1.2, 0.08, 0.6, "#2a2521", [-0.3, 2.0, -0.8], root);
  const moth = new PropCard(0.32, 0.21, 400, 260, 1); root.add(moth.mesh);
  const dave = new Person(DAVE, 11, 1, 0.8); dave.at(0.25, 0, -0.1); root.add(dave.root);
  lights(root, { amb: 0.4, hemi: ["#8a7a6a", "#0f0d0b", 0.5], pts: [["#ff531f", 5, [-0.5, 1.4, 0.2], 3], ["#ffe1c4", 3, [1.5, 3, 2], 8]] });
  const tNo = cue(6, "there's no pay") - A;
  return {
    root, fog: [PAL.bg, 6, 30],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [0.05, 1.55, 3.2], look: [-0.05, 1.3, -0.6], fov: 42 }, { f: 60, pos: [0.0, 1.5, 2.7], look: [-0.05, 1.3, -0.6], fov: 42 }], f), kick(f, tNo, 0.02));
      scr.draw(String(f >= tNo ? Math.floor(f / 8) % 2 : 9), (g, w, h) => P.drawATM(g, w, h, f >= tNo && Math.floor(f / 8) % 2 === 0));
      const tm = clamp((f - tNo) / 40);
      moth.mesh.visible = f >= tNo;
      moth.mesh.position.set(-0.3 + 0.7 * tm, 1.3 + 0.7 * tm + 0.06 * Math.sin(f * 0.9), -0.6 + 1.0 * tm);
      moth.draw(String(Math.floor(f / 2) % 4), (g) => P.drawMoth(g, Math.sin((Math.floor(f / 2) % 4) * 1.57)));
      moth.card.face(cam);
      dave.pose({ mode: "stand", expr: f >= tNo ? "shock" : "neutral", look: -1, facing: -1, blink: blinkAt(f, 11) });
      dave.card.face(cam); dave.card.tint([0.95, 0.88, 0.82]);
    },
  };
}, "PAYDAY");

// ---------------------------------------------------------------- 7 CASH: worth as much as the wallet
add("cash", b0(7), (ctx, A) => {
  const root = new THREE.Group();
  city(root, { litP: 0.7, seed: 17 });
  // shuttered shops on the right sidewalk
  const shutterTex = canvasTex(256, 256, (g) => { g.fillStyle = "#6b645a"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 16) { g.fillStyle = "#4a443d"; g.fillRect(0, y, 256, 4); } });
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), new THREE.MeshLambertMaterial({ map: shutterTex })); m.position.set(10.38, 1.4, 6 - k * 4.2); m.rotation.y = -Math.PI / 2; root.add(m); }
  lights(root, { amb: 0.45, hemi: ["#8a7a6a", "#0f0d0b", 0.6], key: ["#ffe1c4", 0.6, [-6, 10, 12]] });
  const dave = new Person(DAVE, 11, 1, 0.8); dave.at(6.6, 0, 1.0); root.add(dave.root);
  const notes: { c: PropCard; k: number }[] = [];
  for (let k = 0; k < 7; k++) { const c = new PropCard(0.3, 0.15, 240, 120, 1); c.draw("n", P.drawNote); root.add(c.mesh); notes.push({ c, k }); }
  const t0 = 4, tWallet = cue(7, "is worth") - A;
  return {
    root, fog: [PAL.bg, 20, 220],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [6.1, 1.55, 4.4], look: [6.55, 1.25, 0.9], fov: 42, roll: 3 }, { f: 120, pos: [6.3, 1.5, 3.4], look: [6.6, 1.25, 0.9], fov: 42, roll: -2 }], f));
      const gone = notes.filter((n) => f > t0 + n.k * 9).length;
      const wallet = f >= tWallet;
      dave.pose({ mode: "stand", ...(wallet ? { hold: P.holdWallet, holdKey: "wal", holdUp: 0.4 } : { hold: P.holdCash(Math.max(1, 7 - gone)), holdKey: "c" + (7 - gone), holdUp: 0.5 }),
        expr: wallet ? "dazed" : gone > 3 ? "nervous" : "neutral", look: wallet ? 0 : 1, blink: blinkAt(f, 11) });
      dave.card.face(cam); dave.card.tint(0.92);
      notes.forEach(({ c, k }) => {
        const tn = (f - (t0 + k * 9)) / 45;
        c.mesh.visible = tn > 0 && tn < 1.4;
        c.mesh.position.set(6.9 - 1.6 * tn, 1.35 + 2.2 * tn + 0.15 * Math.sin(tn * 9 + k), 1.0 + 0.6 * tn);
        c.card.face(cam); c.mesh.rotateZ(Math.sin(tn * 7 + k) * 0.9); c.mesh.rotateX(tn * 6);
      });
    },
  };
});

// ---------------------------------------------------------------- 8 VIRA: wait...
add("vira", b0(8), (ctx, A) => {
  const root = new THREE.Group();
  voidStage(root);
  const vira = imageCard(ctx.vira.present, 2.4); vira.position.set(0, 0, 0); root.add(vira);
  const sh = contactShadow(0.8, 0.7); root.add(sh);
  const thread = box(0.012, 30, 0.012, glow(PAL.signal, 2.2), [0.05, 2.25, 0], root);
  const rings = signalRings(root, 3);
  lights(root, { pts: [["#ff531f", 6, [0, 1.2, 1.5], 6]] });
  return {
    root, fog: [PAL.bg, 6, 40],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [0, 1.4, 5.2], look: [0, 1.25, 0], fov: 40 }, { f: 100, pos: [0, 1.3, 3.6], look: [0, 1.2, 0], fov: 40 }], f));
      vira.lookAt(cam.position.x, vira.position.y, cam.position.z);
      vira.scale.set(1, 1 + 0.015 * Math.sin(f * 0.2), 1);
      thread.scale.y = ss(clamp(f / 12));
      rings(f);
    },
  };
}, "SIGNAL DETECTED");

// ---------------------------------------------------------------- 9a RECEIPT for somebody's time
add("receipt", b0(9), (ctx, A) => {
  const root = new THREE.Group();
  voidStage(root);
  const rc = new PropCard(1.5, 3.75, 360, 900, 1.4, false); rc.mesh.position.set(0, 0.35, 0); root.add(rc.mesh);
  box(1.8, 0.35, 0.5, "#2a2521", [0, 4.1, -0.1], root); // printer head
  box(1.2, 0.03, 0.05, glow(PAL.signal, 2), [0, 4.1, 0.16], root);
  lights(root, { pts: [["#ffe1c4", 4, [1, 3, 3], 8]] });
  return {
    root, fog: [PAL.bg, 6, 40],
    update(f, cam) {
      const shown = ss(clamp(f / 55));
      rc.draw(shown.toFixed(2), (g) => P.drawReceipt(g, shown));
      applyCam(cam, glide([{ f: 0, pos: [0, 3.6, 3.8], look: [0, 3.5, 0], fov: 40 }, { f: 60, pos: [0, 2.6, 3.4], look: [0, 2.4, 0], fov: 40 }], f));
    },
  };
});

// ---------------------------------------------------------------- 9b ARCADE prize counter (closing)
add("arcade", fr(at(9, "Like arcade")) - 2, (ctx, A) => {
  const root = new THREE.Group();
  voidStage(root);
  box(4.2, 1.05, 0.9, "#4a423a", [0, 0, 0], root);
  box(4.4, 0.08, 1.0, "#6b5442", [0, 1.05, 0], root);
  box(4.6, 3.4, 0.2, "#2f2a25", [0, 0, -1.6], root);
  for (const y of [1.3, 2.2]) box(4.0, 0.06, 0.5, "#5a4636", [0, y, -1.35], root);
  const prizeSign = flatCard(canvasTex(512, 128, (g, w, h) => P.drawClosed(g, w, h, "PRIZES")), 1.6, 0.4); prizeSign.position.set(0, 3.0, -1.45); root.add(prizeSign);
  for (const x of [-1.3, 0, 1.3]) { const t = new PropCard(0.7, 0.82, 600, 700, 0.6, false); t.draw("t", P.drawTeddy); t.mesh.position.set(x, 1.33, -1.3); root.add(t.mesh); }
  for (const x of [-1.5, -0.6, 0.4, 1.4]) box(0.5, 0.4, 0.35, x > 0 ? "#8a8175" : "#6b5f52", [x, 2.23, -1.35], root);
  const tk = new PropCard(1.6, 0.48, 1000, 300, 1, false); tk.draw("k", (g) => P.drawTickets(g, 5)); tk.mesh.rotation.x = -Math.PI / 2; tk.mesh.position.set(0.2, 1.1, 0.05); root.add(tk.mesh);
  // the shutter that comes down on "open"
  const shTex = canvasTex(256, 256, (g) => { g.fillStyle = "#8a8175"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 20) { g.fillStyle = "#55504a"; g.fillRect(0, y, 256, 5); } });
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), new THREE.MeshLambertMaterial({ map: shTex })); shutter.position.set(0, 2.3, 0.5); root.add(shutter);
  const close = cue(9, "counter is open") - A;
  lights(root, { pts: [["#ffe1c4", 4, [0, 3, 2.5], 8], ["#ff6a3c", 2.5, [-1.5, 1.6, 1], 4]] });
  return {
    root, fog: [PAL.bg, 6, 40],
    update(f, cam) {
      const d = clamp((f - close) / 9);
      shutter.position.y = lerp(4.6, 2.25, d * d);
      applyCam(cam, glide([{ f: 0, pos: [0.6, 1.9, 4.6], look: [0, 1.5, -0.6], fov: 40 }, { f: 80, pos: [0.3, 1.8, 3.9], look: [0, 1.45, -0.6], fov: 40 }], f), kick(f, close + 9, 0.03));
    },
  };
});

// ---------------------------------------------------------------- 10 1930: Keynes predicted 15 hours a week
add("keynes", b0(10), (ctx, A) => {
  const root = new THREE.Group();
  voidStage(root);
  const plate = new PropCard(2.0, 2.0, 1024, 1024, 0.9, false); plate.mesh.position.set(0, 0.6, 0); root.add(plate.mesh);
  // the breakdown corner: deck chair + a clock spinning too fast (to the right)
  const X = 14;
  box(1.2, 0.12, 0.7, "#6b5442", [X, 0.4, 0], root);
  const back = box(1.2, 0.1, 0.9, "#6b5442", [X, 0.75, -0.45], root); back.rotation.x = 1.0;
  for (const s of [-1, 1]) box(0.06, 0.4, 0.06, "#3a2c22", [X + s * 0.55, 0, 0.2], root);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.MeshLambertMaterial({ map: canvasTex(512, 512, (g, w, h) => P.drawClockFace(g, w, h)) }));
  face.position.set(X, 2.75, -1.4); face.scale.setScalar(0.62); root.add(face);
  const rim = cyl(0.66, 0.08, "#2a2521", [0, 0, 0], root); rim.position.set(X, 2.75, -1.46); rim.rotation.x = Math.PI / 2;
  const hand1 = box(0.06, 0.75, 0.02, "#1a1714", [0, 0, 0], face); hand1.geometry.translate(0, 0, 0); hand1.position.set(0, 0, 0.03);
  const hand2 = box(0.08, 0.5, 0.02, "#1a1714", [0, 0, 0], face); hand2.position.set(0, 0, 0.04);
  const guy = new Person(extra(6), 77, 1, 0.75); guy.at(X, 0.42, 0.25); root.add(guy.root);
  const tBreak = cue(10, "and worried") - A;
  lights(root, { pts: [["#ffe1c4", 4, [0, 3, 3], 9], ["#ffe1c4", 4, [X, 3, 3], 9]] });
  return {
    root, fog: [PAL.bg, 6, 40],
    update(f, cam) {
      const t = clamp(f / (tBreak - 10));
      plate.draw(t.toFixed(2), (g) => P.drawTimeline(g, t));
      if (f < tBreak) applyCam(cam, glide([{ f: 0, pos: [0, 1.6, 5.4], look: [0, 1.6, 0], fov: 40 }, { f: tBreak, pos: [0, 1.6, 4.6], look: [0, 1.6, 0], fov: 40 }], f));
      else applyCam(cam, glide([{ f: tBreak, pos: [X, 1.3, 4.6], look: [X, 1.55, -0.4], fov: 44, roll: 4 }, { f: tBreak + 80, pos: [X, 1.25, 3.9], look: [X, 1.5, -0.4], fov: 44, roll: -4 }], f));
      const sp = f >= tBreak ? (f - tBreak) * 0.6 : 0;
      hand1.rotation.z = -sp; hand2.rotation.z = -sp / 6;
      hand1.position.set(0.37 * Math.sin(sp), 0.37 * Math.cos(sp), 0.03); hand1.rotation.z = -sp;
      hand2.position.set(0.25 * Math.sin(sp / 6), 0.25 * Math.cos(sp / 6), 0.04); hand2.rotation.z = -sp / 6;
      guy.pose({ mode: "sit", expr: "dazed", blink: 0, headTilt: 6 * Math.sin(f * 0.12) });
      guy.card.face(cam); guy.card.tint(0.92);
    },
  };
}, "ARCHIVE / 1930");

// ---------------------------------------------------------------- 11 COUCHES and the few who make things
add("couch", b0(11), (ctx, A) => {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), matC("#2f2822")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  box(30, 3.2, 0.3, "#3b322b", [2, 0, -2.2], root);
  const couch = (x: number) => { box(2.0, 0.42, 0.85, "#4a3f36", [x, 0, -0.9], root); box(2.0, 0.85, 0.25, "#4a3f36", [x, 0, -1.35], root); for (const s of [-1, 1]) box(0.22, 0.62, 0.85, "#3f352d", [x + s * 0.95, 0, -0.9], root); };
  const sitters: Person[] = [];
  [-4.6, -1.6].forEach((x, k) => { couch(x); for (const dx of [-0.45, 0.45]) { const p = new Person(extra(20 + k * 2 + (dx > 0 ? 1 : 0)), 90 + k * 2 + (dx > 0 ? 1 : 0), 1, 0.55); p.at(x + dx, 0.0, -0.75); root.add(p.root); sitters.push(p); } });
  // makers' corner: easel with a glowing orange canvas, guitar, camera
  const X = 3.2;
  for (const s of [-1, 1]) { const l = box(0.06, 2.0, 0.06, "#6b5442", [X + s * 0.45, 0, -0.6], root); l.rotation.z = -s * 0.12; }
  const paint = new Screen(320, 400); const pm = paint.mesh(0.9, 1.1, 1.25); pm.position.set(X, 1.45, -0.5); root.add(pm);
  const painter = new Person(extra(33), 101, 1, 0.7); painter.at(X + 0.75, 0, 0.1); root.add(painter.root);
  const guitar = new Person(extra(35), 103, 1, 0.6); guitar.at(X + 1.25, 0, -1.2); root.add(guitar.root);
  const camP = new Person(extra(38), 105, 1, 0.6); camP.at(X - 0.6, 0, -1.4); root.add(camP.root);
  const tv = glow("#d9cfbd", 1.0);
  lights(root, { amb: 0.4, hemi: ["#8a7f70", "#0b0a09", 0.5], pts: [["#d9d2c6", 6, [-1.6, 1.2, 2.5], 8], ["#ff6a3c", 4, [X, 1.6, 0.8], 4]] });
  void tv;
  const tFew = cue(11, "A few") - A, tMake = cue(11, "and make things") - A;
  return {
    root, fog: [PAL.bg, 8, 40],
    update(f, cam) {
      applyCam(cam, glide([
        { f: 0, pos: [-1.6, 1.3, 3.4], look: [-1.6, 0.85, -0.8], fov: 44 },
        { f: tFew - 6, pos: [-1.3, 1.3, 3.1], look: [-1.4, 0.85, -0.8], fov: 44 },
        { f: tFew + 24, pos: [3.5, 1.45, 3.5], look: [3.5, 1.2, -0.6], fov: 44 },
      ], f));
      const flick = 0.72 + 0.1 * Math.sin(f * 0.9) + 0.06 * Math.sin(f * 2.3);
      sitters.forEach((p, k) => { p.pose({ mode: "sit", expr: k % 2 ? "dazed" : "neutral", blink: blinkAt(f, 90 + k), headTilt: k % 2 ? 9 : -7, tilt: k % 2 ? 4 : -3 }); p.card.face(cam); p.card.tint([flick, flick, flick * 0.98]); });
      const tp = clamp((f - tFew) / Math.max(10, tMake - tFew + 30));
      paint.draw(tp.toFixed(2), (g, w, h) => P.drawPainting(g, w, h, tp));
      painter.pose({ mode: "stand", hold: P.holdBrush, holdKey: "b", holdUp: 0.6 + 0.3 * Math.sin(f * 0.3), expr: "smile", blink: blinkAt(f, 101), look: -1, facing: -1 });
      guitar.pose({ mode: "stand", hold: P.holdGuitar, holdKey: "g", holdUp: 0.2, expr: f >= tMake ? "grin" : "smile_closed", blink: blinkAt(f, 103) });
      camP.pose({ mode: "stand", hold: P.holdCamera, holdKey: "c", holdUp: 1, expr: "smile", blink: blinkAt(f, 105), look: -1, facing: -1 });
      for (const p of [painter, guitar, camP]) { p.card.face(cam); p.card.tint([1.0, 0.9, 0.84]); }
    },
  };
}, "MONTH 06");

// ---------------------------------------------------------------- 12 the hardest job
add("dave_couch", b0(12), (ctx, A) => {
  const root = new THREE.Group();
  skyDome(root);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matC("#2f2822")); floor.rotation.x = -Math.PI / 2; root.add(floor);
  // back wall with a big window onto the working city
  box(3.0, 0.9, 0.3, "#3b322b", [0, 0, -2.2], root); box(12, 1.0, 0.3, "#3b322b", [0, 2.6, -2.2], root);
  for (const x of [-4.5, 4.5]) box(6.0, 3.6, 0.3, "#3b322b", [x, 0, -2.2], root);
  for (const x of [-1.5, 1.5]) box(0.12, 1.8, 0.3, "#2a2521", [x, 0.9, -2.2], root);
  box(0.1, 1.8, 0.3, "#2a2521", [0, 0.9, -2.2], root);
  for (let k = 0; k < 6; k++) building(root, -12 + k * 5, -18 - 5 * rnd(3, k), 4.5, 5, 14 + 18 * rnd(9, k), 200 + k, 0.85);
  box(2.2, 0.42, 0.9, "#4a3f36", [0, 0, -0.9], root); box(2.2, 0.85, 0.25, "#4a3f36", [0, 0, -1.4], root);
  for (const s of [-1, 1]) box(0.22, 0.62, 0.9, "#3f352d", [s * 1.05, 0, -0.9], root);
  const dave = new Person(DAVE, 11, 1, 0.85); dave.at(0, 0.0, -0.78); root.add(dave.root);
  lights(root, { amb: 0.22, hemi: ["#6b6157", "#0b0a09", 0.35], pts: [["#d9d2c6", 4.5, [0.4, 1.2, 2.2], 7]] });
  const tNothing = cue(12, "nothing to do") - A;
  return {
    root, fog: [PAL.bg, 10, 60],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [0.15, 1.1, 1.6], look: [0, 1.0, -0.8], fov: 40 }, { f: 110, pos: [0.0, 1.45, 5.6], look: [0, 1.4, -2.0], fov: 40 }], f, 0));
      const flick = 0.74 + 0.08 * Math.sin(f * 0.8);
      dave.pose({ mode: "sit", expr: f >= tNothing ? "dazed" : "neutral", blink: blinkAt(f, 11), headTilt: 5 + 3 * Math.sin(f * 0.05), tilt: -2 });
      dave.card.face(cam); dave.card.tint([flick, flick, flick * 0.97]);
    },
  };
}, "2027");

// ---------------------------------------------------------------- 13 END: every prediction leads to 2027
add("end", b0(13), (ctx, A) => {
  const root = new THREE.Group();
  voidStage(root);
  const vira = imageCard(ctx.vira.watch, 2.3); root.add(vira);
  const sh = contactShadow(0.8, 0.7); root.add(sh);
  const rings = signalRings(root, 4);
  lights(root, { pts: [["#ff531f", 6, [0, 1.2, 1.5], 6]] });
  return {
    root, fog: [PAL.bg, 6, 40],
    update(f, cam) {
      applyCam(cam, glide([{ f: 0, pos: [0, 1.15, 6.2], look: [0, 1.55, 0], fov: 40 }, { f: 160, pos: [0, 1.15, 5.4], look: [0, 1.6, 0], fov: 40 }], f, 0));
      vira.lookAt(cam.position.x, vira.position.y, cam.position.z);
      vira.scale.set(1, 1 + 0.012 * Math.sin(f * 0.18), 1);
      rings(f, 0.01);
    },
  };
});

// boundaries: each shot ends where the next begins
shotsRaw.sort((x, y) => x.a - y.a);
export const SHOTS: ShotDef[] = shotsRaw.map((s, i) => ({ ...s, b: i + 1 < shotsRaw.length ? shotsRaw[i + 1].a : TOTAL }));
export const shotAt = (f: number) => { let i = 0; while (i < SHOTS.length - 1 && f >= SHOTS[i + 1].a) i++; return i; };
void bodySide; void glow; void lerp; void at;
export type { Expr };
