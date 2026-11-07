// Shared building blocks for "What if AI took every job in 2027?" (VIRUS2027 brand look):
// palette, easing, camera glides, billboard cards (Canvas2D -> texture), boxes, facade/window textures.
import * as THREE from "three";
import { NOINK } from "./ink";

export const FPS = 30;

// ---- VIRUS2027 palette (web style guide 4 + lore manual 11) ----
export const PAL = {
  bg: "#090806", bgUp: "#11100e", surface: "#171512", surface2: "#1d1a17",
  text: "#e8e3db", soft: "#b8b2aa", muted: "#77726b",
  signal: "#ff531f", signalHi: "#ff6a3c", signalDeep: "#bd3512",
  // world albedos: warm charcoal / dark brown / dirty ivory
  asphalt: "#26221d", walk: "#3a342d", wall: "#3b352f", wallB: "#4a423a", wallC: "#2f2a25", ivory: "#d9cfbd", paper: "#e3dac8",
  wood: "#5a4636", metal: "#55504a",
};

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ss = (t: number) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); }; // smootherstep
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => clamp(t) ** 3;
export const ramp = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
export const rnd = (seed: number, k = 0) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
export type V3 = [number, number, number];
export const v3lerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---- camera ----
export type CamKey = { f: number; pos: V3; look: V3; fov?: number; roll?: number };
export type CamState = { pos: V3; look: V3; fov: number; roll: number };
/** smootherstep glide through keys (local frames); every hold keeps creeping toward the look point (push-in). */
export const glide = (keys: CamKey[], f: number, creep = 0.0022): CamState => {
  let i = 0;
  while (i < keys.length - 1 && f >= keys[i + 1].f) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const t = b === a ? 0 : ss((f - a.f) / Math.max(1, b.f - a.f));
  let pos = v3lerp(a.pos, b.pos, t), look = v3lerp(a.look, b.look, t);
  // creep: push toward the look point a little every frame (no frozen holds)
  const k = clamp(creep * f, 0, 0.25);
  pos = v3lerp(pos, look, k * 0.35);
  return { pos, look, fov: lerp(a.fov ?? 40, b.fov ?? a.fov ?? 40, t), roll: lerp(a.roll ?? 0, b.roll ?? a.roll ?? 0, t) };
};

/** impact shake that flips sign every frame and decays over 7 frames */
export const kick = (f: number, at: number, amp = 0.06) => {
  const d = f - at;
  if (d < 0 || d > 7) return 0;
  return amp * (d % 2 ? -1 : 1) * (1 - d / 7);
};

// ---- materials ----
const lam = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const MATS = new Map<string, THREE.Material>();
export const matC = (color: string) => { if (!MATS.has(color)) MATS.set(color, lam(color)); return MATS.get(color)!; };
export const glow = (color: string, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: true });

export const box = (w: number, h: number, d: number, mat: THREE.Material | string, pos: V3, parent?: THREE.Object3D, rotY = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === "string" ? matC(mat) : mat);
  m.position.set(pos[0], pos[1] + h / 2, pos[2]);
  m.rotation.y = rotY;
  m.castShadow = false; m.receiveShadow = false;
  parent?.add(m);
  return m;
};
export const cyl = (r: number, h: number, mat: THREE.Material | string, pos: V3, parent?: THREE.Object3D, seg = 24) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof mat === "string" ? matC(mat) : mat);
  m.position.set(pos[0], pos[1] + h / 2, pos[2]);
  parent?.add(m);
  return m;
};

// ---- canvas textures ----
export const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/** facade: dark wall with a window grid; lit windows go to the emissive map (warm "machines at work" glow) */
export const facade = (seed: number, cols: number, rows: number, litP: number, wallCol: string, glowCol = "#ff7a3d") => {
  const W = 256, H = 512;
  const cell = { w: W / cols, h: H / rows };
  const lit: boolean[] = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rnd(seed, i) < litP);
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = wallCol; g.fillRect(0, 0, W, H);
    // grime streaks
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + 0.08 * rnd(seed, 900 + i)})`; g.fillRect(rnd(seed, 500 + i) * W, 0, 2 + 6 * rnd(seed, 700 + i), H); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cell.w + cell.w * 0.18, y = r * cell.h + cell.h * 0.2, w = cell.w * 0.64, h = cell.h * 0.58;
      g.fillStyle = "#0b0a09"; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = lit[r * cols + c] ? "#3a2416" : "#141210"; g.fillRect(x, y, w, h);
    }
  });
  const emi = canvasTex(W, H, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!lit[r * cols + c]) continue;
      const x = c * cell.w + cell.w * 0.18, y = r * cell.h + cell.h * 0.2, w = cell.w * 0.64, h = cell.h * 0.58;
      const k = 0.55 + 0.45 * rnd(seed, 3000 + r * cols + c);
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, glowCol); gr.addColorStop(1, "#7a2a10");
      g.globalAlpha = k; g.fillStyle = gr; g.fillRect(x, y, w, h); g.globalAlpha = 1;
      // a little machine silhouette in some windows (server rack / arm)
      if (rnd(seed, 5000 + r * cols + c) < 0.35) { g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.65); }
    }
  });
  return { map, emi };
};

export const building = (parent: THREE.Object3D, x: number, z: number, w: number, d: number, h: number, seed: number, litP = 0.6, wallCol?: string) => {
  const cols = Math.max(2, Math.round(w / 2.6)), rows = Math.max(3, Math.round(h / 3.4));
  const col = wallCol ?? [PAL.wall, PAL.wallB, PAL.wallC][seed % 3];
  const { map, emi } = facade(seed, cols, rows, litP, col);
  const side = facade(seed + 77, Math.max(2, Math.round(d / 2.6)), rows, litP * 0.7, col);
  const mk = (t: { map: THREE.Texture; emi: THREE.Texture }) => new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.emi, emissive: new THREE.Color(1.15, 1.15, 1.15) });
  const top = matC("#1a1714");
  const mats = [mk(side), mk(side), top, top, mk({ map, emi }), mk({ map, emi })];
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.set(x, h / 2, z);
  parent.add(m);
  // roof parapet + a water tank / antenna for silhouette variety
  box(w + 0.3, 0.5, d + 0.3, "#24201c", [x, h, z], parent);
  if (seed % 3 === 0) { cyl(1.1, 2.2, "#2a2521", [x + w * 0.2, h + 0.5, z], parent, 10); }
  if (seed % 4 === 1) { box(0.15, 5, 0.15, "#2a2521", [x - w * 0.25, h + 0.5, z], parent); }
  return m;
};

// ---- billboard cards (characters, props, effects) ----
/** Canvas2D card standing on the ground (bottom-centre origin), always turned to the camera around Y. */
export class Card {
  mesh: THREE.Mesh;
  tex: THREE.CanvasTexture;
  g: CanvasRenderingContext2D;
  key = "";
  W: number; H: number; // design units
  constructor(public widthM: number, public heightM: number, designW: number, designH: number, scale = 0.8, public billboard = true) {
    const c = document.createElement("canvas");
    c.width = Math.round(designW * scale); c.height = Math.round(designH * scale);
    this.g = c.getContext("2d")!;
    this.W = designW; this.H = designH;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(widthM, heightM);
    geo.translate(0, heightM / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.layers.set(NOINK);
    this.mesh.renderOrder = 2;
  }
  /** redraw only when the pose key changes */
  draw(key: string, fn: (g: CanvasRenderingContext2D) => void) {
    if (key === this.key) return;
    this.key = key;
    const g = this.g, c = g.canvas;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(c.width / this.W, 0, 0, c.height / this.H, 0, 0);
    fn(g);
    this.tex.needsUpdate = true;
  }
  tint(k: number | [number, number, number]) {
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    if (typeof k === "number") m.color.setRGB(k, k, k); else m.color.setRGB(k[0], k[1], k[2]);
  }
  face(cam: THREE.Camera) {
    if (!this.billboard) return;
    this.mesh.updateWorldMatrix(true, false);
    const p = new THREE.Vector3().setFromMatrixPosition(this.mesh.matrixWorld), c = cam.position;
    this.mesh.rotation.set(0, Math.atan2(c.x - p.x, c.z - p.z), 0);
  }
}

/** image card from /public (Vira renders, logo) */
export const imageCard = (tex: THREE.Texture, heightM: number, aspect = 1) => {
  const geo = new THREE.PlaneGeometry(heightM * aspect, heightM);
  geo.translate(0, heightM / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide }));
  m.layers.set(NOINK);
  m.renderOrder = 3;
  return m;
};

/** soft contact shadow under a card */
let SHADOW_TEX: THREE.Texture | null = null;
export const contactShadow = (r: number, opacity = 0.55) => {
  SHADOW_TEX ??= canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.5, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 0.9), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.layers.set(NOINK);
  return m;
};

/** dark sky dome: near-black top, warm grey-brown horizon, faint orange city glow low */
export const skyDome = (parent: THREE.Object3D, glowK = 1) => {
  const tex = canvasTex(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#060505"); gr.addColorStop(0.42, "#0f0d0b"); gr.addColorStop(0.5, glowK > 0 ? "#2b1c14" : "#16130f"); gr.addColorStop(0.53, "#14110e"); gr.addColorStop(1, "#090806");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.layers.set(NOINK);
  m.renderOrder = -1;
  parent.add(m);
  return m;
};

/** dark floor with a faint survey grid (dossier stage) */
export const gridFloor = (parent: THREE.Object3D, size = 80, signal = false) => {
  const tex = canvasTex(512, 512, (g) => {
    g.fillStyle = "#14120f"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(232,227,219,0.07)"; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    if (signal) { g.strokeStyle = "rgba(255,83,31,0.25)"; g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(size / 8, size / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  parent.add(m);
  return m;
};

export const loadTex = (url: string) => new Promise<THREE.Texture>((res, rej) => {
  new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej);
});
