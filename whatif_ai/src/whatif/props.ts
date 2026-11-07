// Flat 2D props in the same ink style as the cast (Pen = toon.ts drawing API), plus canvas textures for 3D screens.
// Colours stay inside the VIRUS2027 palette: charcoal, warm greys, dirty ivory, one signal orange.
import { Pen, INK } from "./toon";
import { PAL } from "./kit";

type P2 = [number, number];
const MONO = "IBM Plex Mono, monospace";
const DISPLAY = "Barlow Condensed, Arial Narrow, sans-serif";

const rect = (x: number, y: number, w: number, h: number): P2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const rrect = (x: number, y: number, w: number, h: number, r: number): P2[] => {
  const pts: P2[] = [];
  const c = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 6; i++) { const a = ((a0 + (90 * i) / 6) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  c(x + w - r, y + r, -90); c(x + w - r, y + h - r, 0); c(x + r, y + h - r, 90); c(x + r, y + r, 180);
  return pts;
};
const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, font = MONO, weight = "600", align: CanvasTextAlign = "center") => {
  g.font = `${weight} ${size}px ${font}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y);
};

// ---------- held props (drawn into the character canvas at the hand, u = head width / 100) ----------
export const holdSock = (letter: string) => (p: Pen, hx: number, hy: number, u: number) => {
  const pts: P2[] = [[hx - 8 * u, hy - 4 * u], [hx + 8 * u, hy - 4 * u], [hx + 9 * u, hy + 40 * u], [hx + 30 * u, hy + 48 * u], [hx + 30 * u, hy + 60 * u], [hx - 6 * u, hy + 58 * u], [hx - 9 * u, hy + 46 * u]];
  p.poly(pts, "#cfc5b3", 3 * u);
  p.stroke([[hx - 8 * u, hy + 6 * u], [hx + 8 * u, hy + 6 * u]], 3 * u, "#8a7f70");
  text(p.g, letter, hx + 1 * u, hy + 26 * u, 20 * u, INK, DISPLAY, "800");
};
export const holdCash = (n: number, spread = 1) => (p: Pen, hx: number, hy: number, u: number) => {
  for (let i = 0; i < n; i++) {
    const a = ((-30 + (60 * i) / Math.max(1, n - 1)) * spread * Math.PI) / 180;
    p.rot = [a, hx, hy];
    p.poly(rect(hx - 9 * u, hy - 42 * u, 18 * u, 40 * u), "#b9b29f", 2.4 * u);
    p.poly(rect(hx - 5 * u, hy - 36 * u, 10 * u, 28 * u), null, 1.4 * u);
    p.rot = null;
  }
};
export const holdWallet = (p: Pen, hx: number, hy: number, u: number) => {
  p.poly(rect(hx - 22 * u, hy - 18 * u, 44 * u, 26 * u), "#4a3a2e", 2.8 * u);
  p.poly(rect(hx - 18 * u, hy - 14 * u, 36 * u, 6 * u), "#2b211a", 1.6 * u);
  // a moth leaving the empty wallet
  p.ell(hx + 10 * u, hy - 34 * u, 6 * u, 4 * u, "#9c9384", 1.8 * u, 0, 360, -20);
  p.ell(hx + 20 * u, hy - 36 * u, 6 * u, 4 * u, "#9c9384", 1.8 * u, 0, 360, 20);
};
export const holdWatch = (p: Pen, hx: number, hy: number, u: number) => {
  p.ell(hx, hy - 9 * u, 9 * u, 9 * u, PAL.paper, 2.6 * u);
  p.stroke([[hx, hy - 9 * u], [hx, hy - 15 * u]], 2 * u); p.stroke([[hx, hy - 9 * u], [hx + 4 * u, hy - 7 * u]], 2 * u);
};
export const holdBrush = (p: Pen, hx: number, hy: number, u: number) => {
  p.line([[hx, hy + 8 * u], [hx + 10 * u, hy - 40 * u]], "#6b5442", 4 * u);
  p.ell(hx + 11 * u, hy - 46 * u, 4 * u, 8 * u, PAL.signal, 1.8 * u, 0, 360, 12);
};
export const holdGuitar = (p: Pen, hx: number, hy: number, u: number) => {
  p.line([[hx - 30 * u, hy + 4 * u], [hx + 60 * u, hy - 40 * u]], "#3b2e24", 6 * u);
  p.ell(hx - 30 * u, hy + 10 * u, 30 * u, 24 * u, "#8a5a36", 3 * u, 0, 360, -25);
  p.ell(hx - 10 * u, hy + 4 * u, 22 * u, 18 * u, "#8a5a36", 3 * u, 0, 360, -25);
  p.ell(hx - 22 * u, hy + 4 * u, 7 * u, 7 * u, INK, 0);
};
export const holdCamera = (p: Pen, hx: number, hy: number, u: number) => {
  p.poly(rrect(hx - 22 * u, hy - 30 * u, 44 * u, 28 * u, 4 * u), "#2a2622", 2.6 * u);
  p.ell(hx, hy - 16 * u, 10 * u, 10 * u, "#55504a", 2.4 * u);
  p.ell(hx, hy - 16 * u, 5 * u, 5 * u, "#0d0c0b", 0);
  p.dot(hx + 15 * u, hy - 26 * u, 2.5 * u, PAL.signal);
};

// ---------- standalone prop cards (draw into a Card canvas; design space given per prop) ----------
/** 400x300: burger (flip angle handled by the card rotation) */
export const drawBurger = (g: CanvasRenderingContext2D) => {
  const p = new Pen(g); p.ol = 7;
  p.ell(200, 120, 150, 70, "#b5823f", undefined, 180, 360);
  p.poly([[50, 120], [350, 120], [350, 130], [50, 130]], "#b5823f");
  p.poly(rrect(45, 132, 310, 40, 18), "#4a2e22");
  p.poly([[55, 175], [345, 175], [330, 196], [70, 196]], "#c9b48a");
  p.ell(200, 210, 150, 34, "#b5823f", undefined, 0, 180);
  for (let i = 0; i < 6; i++) p.dot(120 + i * 32, 82 + (i % 2) * 14, 5, "#efe2c6");
};

/** 600x300 speech bubble */
export const drawBubble = (g: CanvasRenderingContext2D, s: string, sub = "") => {
  const p = new Pen(g); p.ol = 7;
  p.poly([...rrect(20, 20, 560, 190, 40)], PAL.paper);
  p.poly([[150, 205], [210, 205], [120, 285]], PAL.paper);
  g.fillStyle = PAL.paper; g.fillRect(140, 190, 80, 20);
  text(g, s, 300, sub ? 92 : 115, 46, INK, MONO, "600");
  if (sub) text(g, sub, 300, 158, 30, "#77726b", MONO, "600");
};

/** 300x300 alarm clock */
export const drawAlarm = (g: CanvasRenderingContext2D) => {
  const p = new Pen(g); p.ol = 8;
  p.ell(85, 70, 38, 30, "#8a8175", undefined, 0, 360, -30); p.ell(215, 70, 38, 30, "#8a8175", undefined, 0, 360, 30);
  p.stroke([[90, 250], [70, 285]], 14); p.stroke([[210, 250], [230, 285]], 14);
  p.ell(150, 165, 110, 110, "#b9b09f");
  p.ell(150, 165, 86, 86, PAL.paper, 6);
  p.stroke([[150, 165], [150, 105]], 10); p.stroke([[150, 165], [195, 185]], 8);
  p.dot(150, 165, 10);
};

/** 300x200 paper plane ("meeting that could have been an email") */
export const drawPlane = (g: CanvasRenderingContext2D) => {
  const p = new Pen(g); p.ol = 6;
  p.poly([[20, 110], [280, 40], [150, 160]], PAL.paper);
  p.poly([[150, 160], [280, 40], [140, 120]], "#b9b09f");
  p.poly([[140, 120], [150, 180], [170, 145]], "#9c9384");
};

/** 200x260 spice jar with a letter label */
export const drawJar = (g: CanvasRenderingContext2D, name: string, fill: string) => {
  const p = new Pen(g); p.ol = 7;
  p.poly(rrect(30, 60, 140, 190, 22), "#3a3631");
  p.poly(rrect(36, 120, 128, 124, 16), fill, 0);
  p.poly(rrect(25, 22, 150, 44, 8), "#1f1c19");
  p.poly(rect(40, 135, 120, 60), PAL.paper, 4);
  text(g, name, 100, 166, 30, INK, DISPLAY, "800");
};

/** 220x320 sock on a peg (alphabetised washing line) */
export const drawSock = (g: CanvasRenderingContext2D, letter: string, col: string) => {
  const p = new Pen(g); p.ol = 7;
  p.poly([[70, 40], [150, 40], [152, 210], [205, 240], [200, 300], [90, 296], [68, 250]], col);
  p.stroke([[72, 80], [150, 80]], 8, "#00000055");
  p.poly(rect(95, 4, 30, 60), "#6b5442", 5);
  text(g, letter, 110, 160, 72, INK, DISPLAY, "800");
};

/** 400x260 moth */
export const drawMoth = (g: CanvasRenderingContext2D, flap: number) => {
  const p = new Pen(g); p.ol = 6;
  const k = 0.35 + 0.65 * Math.abs(flap);
  p.ell(140, 120, 110 * k, 80, "#9c9384", undefined, 0, 360, -15);
  p.ell(260, 120, 110 * k, 80, "#9c9384", undefined, 0, 360, 15);
  p.ell(200, 135, 26, 70, "#5a524a");
  p.stroke([[190, 70], [160, 20]], 6); p.stroke([[210, 70], [240, 20]], 6);
};

/** 240x120 banknote (generic, no real currency) */
export const drawNote = (g: CanvasRenderingContext2D) => {
  const p = new Pen(g); p.ol = 6;
  p.poly(rect(8, 8, 224, 104), "#b9b29f");
  p.poly(rect(24, 22, 192, 76), null, 3);
  p.ell(120, 60, 26, 26, "#9c9584", 3);
  text(g, "100", 58, 60, 28, "#4a463e", DISPLAY, "800");
  text(g, "100", 184, 60, 28, "#4a463e", DISPLAY, "800");
};

/** 360x900 till receipt for "somebody's time" */
export const drawReceipt = (g: CanvasRenderingContext2D, shown: number) => {
  const h = 60 + 820 * shown;
  g.save();
  g.beginPath(); g.rect(0, 0, 360, h + 20); g.clip();
  const p = new Pen(g); p.ol = 6;
  const zig: [number, number][] = [[20, 20], [340, 20]];
  for (let x = 340; x >= 20; x -= 20) zig.push([x, h + ((x / 20) % 2 ? 12 : 0)]);
  p.poly(zig, PAL.paper);
  const L = (s: string, y: number, sz = 26, col = INK, al: CanvasTextAlign = "left", x = 44) => text(g, s, x, y, sz, col, MONO, "600", al);
  L("RECEIPT", 70, 34, INK, "center", 180);
  L("- - - - - - - - - - -", 105, 22, "#77726b", "center", 180);
  L("1 HR  SOMEONE'S", 160); L("      TIME", 192);
  L("1 HR  SOMEONE'S", 250); L("      EFFORT", 282);
  L("- - - - - - - - - - -", 330, 22, "#77726b", "center", 180);
  L("TOTAL", 390, 30); L("= MONEY", 390, 30, PAL.signalDeep, "right", 316);
  L("THANK YOU", 470, 24, "#77726b", "center", 180);
  g.restore();
};

/** 1000x300 arcade ticket strip */
export const drawTickets = (g: CanvasRenderingContext2D, n = 5) => {
  const p = new Pen(g); p.ol = 6;
  for (let i = 0; i < n; i++) {
    const x = 10 + i * 196;
    p.poly(rect(x, 60, 190, 180), "#c9bea9");
    p.ell(x, 150, 14, 14, "#090806", 0); p.ell(x + 190, 150, 14, 14, "#090806", 0);
    text(g, "TICKET", x + 95, 120, 34, INK, DISPLAY, "800");
    text(g, "1 HR", x + 95, 178, 30, PAL.signalDeep, MONO, "600");
  }
};

/** 600x700 teddy bear prize */
export const drawTeddy = (g: CanvasRenderingContext2D) => {
  const p = new Pen(g); p.ol = 10;
  const c = "#8a6a4e";
  p.ell(300, 470, 170, 190, c); p.ell(300, 500, 100, 120, "#b39478", 0);
  p.ell(140, 600, 70, 60, c); p.ell(460, 600, 70, 60, c);
  p.ell(170, 120, 60, 60, c); p.ell(430, 120, 60, 60, c);
  p.ell(300, 220, 150, 135, c);
  p.ell(300, 270, 60, 45, "#b39478");
  p.ell(300, 250, 18, 13, INK, 0);
  p.dot(240, 200, 13); p.dot(360, 200, 13);
};

/** 1024x1024 1930 -> 2030 timeline plate (graphic, clearly not a document) */
export const drawTimeline = (g: CanvasRenderingContext2D, t: number) => {
  g.fillStyle = "#e3dac8"; g.fillRect(0, 0, 1024, 1024);
  // paper grain
  for (let i = 0; i < 2600; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453) % 1, y = (Math.sin(i * 78.233) * 12345.678) % 1; g.fillStyle = `rgba(60,45,30,${0.05 + 0.05 * ((i * 7) % 3)})`; g.fillRect(Math.abs(x) * 1024, Math.abs(y) * 1024, 2, 2); }
  g.strokeStyle = "#1a1714"; g.lineWidth = 6; g.strokeRect(40, 40, 944, 944);
  text(g, "ARCHIVE  /  1930", 512, 110, 40, "#4a443d", MONO, "600");
  text(g, "1930", 270, 300, 190, "#1a1714", DISPLAY, "800");
  text(g, "2030", 760, 300, 190, "#1a1714", DISPLAY, "800");
  // the line draws from 1930 to 2030
  g.strokeStyle = PAL.signal; g.lineWidth = 12;
  g.beginPath(); g.moveTo(170, 440); g.lineTo(170 + 690 * Math.min(1, t * 1.4), 440); g.stroke();
  g.fillStyle = PAL.signal; g.beginPath(); g.arc(170, 440, 18, 0, 7); g.fill();
  if (t > 0.7) { g.beginPath(); g.arc(860, 440, 18, 0, 7); g.fill(); }
  const k = Math.max(0, Math.min(1, (t - 0.35) * 3));
  g.globalAlpha = k;
  text(g, "15", 512, 640, 260, "#1a1714", DISPLAY, "800");
  text(g, "HOURS  /  WEEK", 512, 790, 56, "#1a1714", MONO, "600");
  g.globalAlpha = 1;
  text(g, "J. M. KEYNES, “ECONOMIC POSSIBILITIES", 512, 880, 30, "#4a443d", MONO, "500");
  text(g, "FOR OUR GRANDCHILDREN”, 1930", 512, 920, 30, "#4a443d", MONO, "500");
};

// ---------- textures for 3D screens ----------
/** laptop screen: progress bar to 100 % then "FY 2027 — DONE" */
export const drawLaptop = (g: CanvasRenderingContext2D, w: number, h: number, prog: number) => {
  g.fillStyle = "#120d0a"; g.fillRect(0, 0, w, h);
  const done = prog >= 1;
  text(g, "ANNUAL ACCOUNTS / FY 2027", w / 2, h * 0.2, h * 0.075, "#e8c9b8", MONO, "600");
  g.strokeStyle = "#ff531f"; g.lineWidth = 3; g.strokeRect(w * 0.12, h * 0.4, w * 0.76, h * 0.12);
  g.fillStyle = "#ff531f"; g.fillRect(w * 0.12 + 6, h * 0.4 + 6, (w * 0.76 - 12) * Math.min(1, prog), h * 0.12 - 12);
  text(g, `${Math.round(Math.min(1, prog) * 100)}%`, w / 2, h * 0.64, h * 0.08, "#e8c9b8", MONO, "600");
  if (done) text(g, "ALL 12 MONTHS: DONE", w / 2, h * 0.8, h * 0.1, "#ff6a3c", DISPLAY, "800");
};
/** ATM: no payroll */
export const drawATM = (g: CanvasRenderingContext2D, w: number, h: number, blink: boolean) => {
  g.fillStyle = "#140c08"; g.fillRect(0, 0, w, h);
  text(g, "PAYROLL DEPOSIT", w / 2, h * 0.22, h * 0.1, "#e8c9b8", MONO, "600");
  text(g, "0.00", w / 2, h * 0.52, h * 0.28, "#ff531f", DISPLAY, "800");
  if (blink) text(g, "NO EMPLOYER FOUND", w / 2, h * 0.82, h * 0.085, "#e8c9b8", MONO, "600");
};
/** server LEDs (animated by redraw) */
export const drawLEDs = (g: CanvasRenderingContext2D, w: number, h: number, f: number, seed: number) => {
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 18; r++) for (let c = 0; c < 6; c++) {
    const on = Math.sin(f * 0.6 + seed * 13 + r * 3.1 + c * 7.7) > 0.1;
    if (!on) continue;
    g.fillStyle = (r + c) % 5 === 0 ? "#ffd2b8" : "#ff531f";
    g.fillRect(w * (0.12 + c * 0.14), h * (0.04 + r * 0.053), w * 0.05, h * 0.012);
  }
};
/** TV glow (grey static) */
export const drawTV = (g: CanvasRenderingContext2D, w: number, h: number, f: number) => {
  for (let y = 0; y < h; y += 4) { const v = 70 + 60 * Math.abs(Math.sin(y * 0.37 + f * 1.7)) + 40 * Math.sin(f * 0.9 + y * 0.05); g.fillStyle = `rgb(${v},${v * 0.97},${v * 0.93})`; g.fillRect(0, y, w, 4); }
};
/** painting that glows: orange abstract */
export const drawPainting = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  g.fillStyle = "#e3dac8"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#ff531f"; g.lineCap = "round";
  for (let i = 0; i < 7; i++) { if (t * 7 < i) break; g.lineWidth = 14 + i * 3; g.beginPath(); g.arc(w * 0.5, h * 0.55, 30 + i * 22, Math.PI * (0.1 + i * 0.3), Math.PI * (1.2 + i * 0.3)); g.stroke(); }
  g.fillStyle = "#1a1714"; g.beginPath(); g.arc(w * 0.5, h * 0.55, 18, 0, 7); g.fill();
};
export const drawClosed = (g: CanvasRenderingContext2D, w: number, h: number, s = "CLOSED") => {
  g.fillStyle = "#e3dac8"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#1a1714"; g.lineWidth = h * 0.06; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h * 0.9);
  text(g, s, w / 2, h * 0.54, h * 0.55, "#1a1714", DISPLAY, "800");
};
export const drawClockFace = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = "#e3dac8"; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
  g.strokeStyle = "#1a1714"; g.lineWidth = w * 0.03; g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineWidth = i % 3 ? w * 0.012 : w * 0.025; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * w * 0.4, h / 2 - Math.cos(a) * w * 0.4); g.lineTo(w / 2 + Math.sin(a) * w * 0.45, h / 2 - Math.cos(a) * w * 0.45); g.stroke(); }
};
