'use strict';
/* «Fenomenal» (Cabron & DJ CW) — joc pe ritm.
   Coperta se desface în 3D: cercul omului vitruvian devine o bulă care se rostogolește pe un drum de hârtie
   scris cu roșu. Virajele, salturile și FE-NO-ME-NAL cad pe ritmul piesei (79 BPM). La final, totul revine în copertă. */
(function () {
const N = window.NIVELL, P = N.P, V = N.V;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, u) => a + (b - a) * u;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const bt = (m, j = 0) => N.ph + (m * 4 + j) * P;

/* ---------------- constants ---------------- */
const R = 0.8, PW = 2.0, TH = 0.22;                 // bubble radius, path width, path top
const WC = 12, HC = WC * 1068 / 1061;               // cover size in world units
const CIRC = { cx: 529, cy: 535, r: 488 };          // circle of the drawing in cover pixels (with margin)
const MED_HALF = CIRC.r / 1061 * WC;                // medallion half size on the cover
const MED_OFF = { x: (CIRC.cx - 530.5) / 1061 * WC, z: (CIRC.cy - 534) / 1068 * HC };
const T_ROLL = N.tRoll, T_ARR = N.tArrive, T_STOP = T_ARR + 1.0;
const T_OVER = T_STOP + 1.3, T_CARD = T_STOP + 1.9;  // cover back in 2D, end card
const DIRS = [[0, -1], [1, 0], [-1, 0]];
const INK = '#141414', RED = '#c3161c', PAPER = '#e9e6df';
const WIN = 0.17, PERF = 0.065, GOOD = 0.12, WINF = 0.09;
const FX = N.fx;
const END = { x: N.end[0], z: N.end[1] };
const FOV = 50;

/* ---------------- path ---------------- */
const C = N.corners, NC = C.length;
const CS = [0];                                      // cumulative distance at each corner
for (let k = 1; k < NC; k++) CS.push(CS[k - 1] + V * (C[k][0] - C[k - 1][0]));
const TOTAL_S = CS[NC - 1] + V * (T_ARR - C[NC - 1][0]);
function cornerIdx(t) { let lo = 0, hi = NC - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (C[m][0] <= t) lo = m; else hi = m - 1; } return lo; }
function pathPos(t, o) {
  o = o || {};
  if (t <= T_ROLL) { o.x = 0; o.z = 0; o.h = 0; o.s = 0; o.k = 0; return o; }
  const k = cornerIdx(t), c = C[k], d = DIRS[c[3]];
  let s;
  if (k === NC - 1) {                                // last stretch: slow down and stop in the middle of the end cover
    const tDec = T_ARR - 1.0;
    if (t <= tDec) s = V * (t - c[0]);
    else { const u = clamp((t - tDec) / 2.0, 0, 1); s = V * (tDec - c[0]) + V * (1 - (1 - u) * (1 - u)); }
  } else s = V * (t - c[0]);
  o.x = c[1] + d[0] * s; o.z = c[2] + d[1] * s; o.h = c[3]; o.s = CS[k] + s; o.k = k; return o;
}
const _pp = {};
function pathX(t) { return pathPos(t, _pp).x; }

const PATH_S0 = HC / 2 - .05, PATH_S1 = TOTAL_S - HC / 2 + .05;     // the strip starts and ends at the edges of the two covers
function floorY(t) { const p = pathPos(t, _pp); return TH * sstep(PATH_S0 - .9, PATH_S0 + .1, p.s) * (1 - sstep(PATH_S1 - .1, PATH_S1 + .9, p.s)); }
/* ---------------- events ---------------- */
const EV = N.ev.map(e => ({ t: e[0], k: e[1], g: e[2], i: e[3], st: 0, side: 'A' }));
{ let ci = 1; for (const e of EV) if (e.k === 'G') { const prev = C[ci - 1][3], nh = C[ci][3]; e.side = prev === 0 ? (nh === 1 ? 'R' : 'L') : 'A'; e.ci = ci; ci++; } }
const NJUDGE = EV.filter(e => e.k !== 'F').length;
const JUMPS = EV.filter(e => e.k === 'S');
const HOOKS = []; for (const e of EV) if (e.k === 'F') { (HOOKS[e.g] = HOOKS[e.g] || []).push(e); }
function jumpAt(t) { for (const j of JUMPS) { if (t >= j.t - 0.02 && t <= j.t + 0.55) return j; if (j.t > t) break; } return null; }

/* ---------------- canvas drawing helpers ---------------- */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }
function strokeP(g, pts, w, rnd, o = {}) {
  const jit = o.jit == null ? 1.2 : o.jit, passes = o.passes || 2;
  g.strokeStyle = o.color || INK; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.lineWidth = w * (p ? 0.55 : 1); g.beginPath();
    pts.forEach((q, i) => { const x = q[0] + (rnd() - .5) * jit * 2, y = q[1] + (rnd() - .5) * jit * 2; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    if (o.close) g.closePath(); g.stroke();
  }
}
function polyPath(g, pts) { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); }
function fillPoly(g, pts, f) { g.fillStyle = f; polyPath(g, pts); g.fill(); }
function hatch(g, pts, ang, gap, w, rnd, color) {
  g.save(); polyPath(g, pts); g.clip();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = Math.hypot(x1 - x0, y1 - y0) / 2 + 4, ca = Math.cos(ang), sa = Math.sin(ang);
  g.strokeStyle = color || INK; g.lineWidth = w; g.lineCap = 'round';
  for (let o = -L; o <= L; o += gap * (0.8 + rnd() * 0.4)) {
    const ax = cx + ca * -L - sa * o, ay = cy + sa * -L + ca * o, bx = cx + ca * L - sa * o, by = cy + sa * L + ca * o;
    g.beginPath(); g.moveTo(ax + (rnd() - .5) * 3, ay + (rnd() - .5) * 3); g.lineTo(bx + (rnd() - .5) * 3, by + (rnd() - .5) * 3); g.stroke();
  }
  g.restore();
}
const map = (pts, x0, y0, sx, sy) => pts.map(p => [x0 + p[0] * sx, y0 + p[1] * sy]);
function blob(cx, cy, r, n, rnd, irr = .25) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - irr / 2 + rnd() * irr); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
function ellipsePts(cx, cy, rx, ry, n) { const p = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }

/* ---- paper & script textures ---- */
function texPaper(seed, base) {
  const { c, g } = cv(256, 256), rnd = mulberry(seed); g.fillStyle = base || '#ffffff'; g.fillRect(0, 0, 256, 256);
  const id = g.getImageData(0, 0, 256, 256), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - .5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.globalAlpha = .07; g.strokeStyle = '#000';
  for (let i = 0; i < 70; i++) { const x = rnd() * 256, y = rnd() * 256, a = rnd() * 6.28, l = 6 + rnd() * 26; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.lineWidth = .6 + rnd(); g.stroke(); } }
  g.globalAlpha = 1; return c;
}
function texScript(img) {                                    // the red handwriting of the cover, in rows
  const { c, g } = cv(1024, 512); g.fillStyle = '#bdbab4'; g.fillRect(0, 0, 1024, 512);
  const bands = [[0, 2, 50], [0, 1019, 48]];
  let y = 0, k = 0;
  while (y < 512) { const b = bands[k % 2], off = (k * 337) % 1061; g.drawImage(img, off, b[1], 1061 - off, b[2], 0, y, 1061 - off, b[2]); g.drawImage(img, 0, b[1], off, b[2], 1061 - off, y, off, b[2]); y += b[2] - 2; k++; }
  const id = g.getImageData(0, 0, 1024, 512), d = id.data;   // lighten the paper a bit, keep the red ink
  for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; const red = r - gg > 30; if (!red) { d[i] = Math.min(255, r * 1.12 + 10); d[i + 1] = Math.min(255, gg * 1.12 + 10); d[i + 2] = Math.min(255, b * 1.12 + 10); } }
  g.putImageData(id, 0, 0); return c;
}

/* ---- props (paper cut-outs drawn in ink) ---- */
function drawTree(seed) {
  const { c, g } = cv(256, 512), rnd = mulberry(seed);
  g.fillStyle = '#5a4f45'; g.fillRect(118, 400, 20, 100); strokeP(g, [[118, 400], [118, 500], [138, 500], [138, 400]], 3, rnd);
  const tiers = 3 + (rnd() * 2 | 0);
  for (let i = 0; i < tiers; i++) {
    const y0 = 60 + i * (330 / tiers), y1 = y0 + 330 / tiers + 70, w = 60 + i * 30 + rnd() * 20;
    const pts = [[128 + (rnd() - .5) * 8, y0], [128 + w, y1], [128 - w, y1]];
    fillPoly(g, pts, PAPER); hatch(g, [[128, y0], [128 + w, y1], [128 + 10, y1]], 1.0, 7, 1.6, rnd); strokeP(g, pts, 3.4, rnd, { close: true });
  }
  return c;
}
function drawRock(seed) {
  const { c, g } = cv(256, 192), rnd = mulberry(seed);
  const pts = blob(128, 120, 90, 11, rnd, .35).map(p => [p[0], Math.min(186, p[1])]);
  fillPoly(g, pts, '#d6d2ca'); hatch(g, pts, -.8, 8, 1.6, rnd); strokeP(g, pts, 4, rnd, { close: true });
  strokeP(g, [[90, 110], [120, 90], [150, 100]], 2, rnd); return c;
}
const WOLF = [[.20, .98], [.10, .93], [.08, .86], [.20, .87], [.27, .72], [.34, .55], [.42, .40], [.44, .28], [.46, .19], [.49, .08], [.53, .18], [.58, .15], [.68, .03], [.71, .06], [.65, .13], [.61, .21], [.57, .30], [.57, .44], [.61, .62], [.63, .80], [.66, .98], [.55, .98], [.53, .80], [.47, .86], [.43, .98]];
function drawWolf(seed, red) {
  const { c, g } = cv(256, 320), rnd = mulberry(seed);
  const pts = map(WOLF, 10, 8, 236, 304);
  g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 0;
  fillPoly(g, pts, red ? RED : '#2a2a2c');
  g.strokeStyle = 'rgba(236,233,227,.55)'; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { const y = 120 + rnd() * 160, x = 100 + rnd() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + rnd() * 10, y + 10 + rnd() * 8); g.stroke(); }
  strokeP(g, pts, 4, rnd, { close: true }); return c;
}
function drawMoon() {
  const { c, g } = cv(512, 512), rnd = mulberry(7);
  const gr = g.createRadialGradient(256, 256, 120, 256, 256, 250); gr.addColorStop(0, 'rgba(236,233,227,.45)'); gr.addColorStop(1, 'rgba(236,233,227,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const pts = ellipsePts(256, 256, 150, 150, 60); fillPoly(g, pts, '#ece9e1');
  hatch(g, ellipsePts(310, 256, 120, 150, 40).filter(p => p[0] > 250).concat([[256, 120], [256, 400]]), .9, 9, 1.4, rnd, 'rgba(20,20,20,.55)');
  for (let i = 0; i < 6; i++) { const x = 190 + rnd() * 120, y = 180 + rnd() * 150, r = 10 + rnd() * 18; strokeP(g, ellipsePts(x, y, r, r * .8, 14), 2, rnd, { close: true, color: 'rgba(20,20,20,.6)' }); }
  strokeP(g, pts, 4, rnd, { close: true }); return c;
}
function drawSun() {
  const { c, g } = cv(512, 512), rnd = mulberry(3);
  const gr = g.createRadialGradient(256, 256, 90, 256, 256, 250); gr.addColorStop(0, 'rgba(240,190,120,.5)'); gr.addColorStop(1, 'rgba(240,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; strokeP(g, [[256 + Math.cos(a) * 130, 256 + Math.sin(a) * 130], [256 + Math.cos(a) * (190 + (i % 2) * 40), 256 + Math.sin(a) * (190 + (i % 2) * 40)]], 4, rnd, { color: RED }); }
  const pts = ellipsePts(256, 256, 110, 110, 50); fillPoly(g, pts, '#f1d08a'); hatch(g, pts, .6, 10, 1.5, rnd, 'rgba(195,22,28,.5)'); strokeP(g, pts, 4.5, rnd, { close: true, color: RED }); return c;
}
function drawFacade(seed, night) {
  const { c, g } = cv(256, 512), rnd = mulberry(seed);
  g.fillStyle = '#dedad2'; g.fillRect(0, 0, 256, 512);
  const cols = 3 + (rnd() * 2 | 0), rows = 7 + (rnd() * 4 | 0), mw = 30, mh = 30, ww = (256 - mw * 2) / cols, wh = (512 - mh * 2) / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = mw + k * ww + ww * .2, y = mh + r * wh + wh * .2, w = ww * .6, h = wh * .6, lit = night && rnd() < .35;
    g.fillStyle = lit ? '#f2d27a' : '#57534d'; g.fillRect(x, y, w, h); strokeP(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 2.2, rnd, { close: true, passes: 1 });
  }
  hatch(g, [[0, 0], [60, 0], [60, 512], [0, 512]], 1.2, 9, 1.2, rnd, 'rgba(20,20,20,.5)');
  strokeP(g, [[3, 3], [253, 3], [253, 509], [3, 509]], 6, rnd, { close: true }); return c;
}
function drawLamp() {
  const { c, g } = cv(128, 512), rnd = mulberry(11);
  const gr = g.createRadialGradient(64, 70, 4, 64, 70, 62); gr.addColorStop(0, 'rgba(242,210,122,.9)'); gr.addColorStop(1, 'rgba(242,210,122,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 150);
  strokeP(g, [[64, 100], [64, 505]], 6, rnd); strokeP(g, [[48, 505], [80, 505]], 6, rnd);
  const l = [[46, 50], [82, 50], [76, 100], [52, 100]]; fillPoly(g, l, '#f2d27a'); strokeP(g, l, 4, rnd, { close: true });
  strokeP(g, [[40, 50], [88, 50], [64, 30], [40, 50]], 4, rnd); return c;
}
function drawFigure(g, cx, top, h, rnd, o = {}) {                // Vitruvian pose stick-and-volume figure
  const s = h / 100, X = x => cx + x * s, Y = y => top + y * s;
  const body = [[-9, 18], [9, 18], [11, 52], [5, 56], [-5, 56], [-11, 52]].map(p => [X(p[0]), Y(p[1])]);
  const fill = o.fill || '#d4d0c8', w = o.w || 3;
  const limbs = [[[-9, 22], [-44, 26]], [[9, 22], [44, 26]], [[-5, 55], [-18, 98]], [[5, 55], [18, 98]]];
  if (o.armsUp) { limbs[0] = [[-9, 22], [-36, 4]]; limbs[1] = [[9, 22], [36, 4]]; }
  for (const L of limbs) { g.strokeStyle = fill; g.lineWidth = 9 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(L[0][0]), Y(L[0][1])); g.lineTo(X(L[1][0]), Y(L[1][1])); g.stroke(); strokeP(g, [[X(L[0][0]), Y(L[0][1])], [X(L[1][0]), Y(L[1][1])]], w * .8, rnd, { passes: 1 }); }
  fillPoly(g, body, fill); hatch(g, body, 1.1, 7, 1.2, rnd); strokeP(g, body, w, rnd, { close: true });
  const head = ellipsePts(X(0), Y(9), 8 * s, 9 * s, 18); fillPoly(g, head, fill); strokeP(g, head, w, rnd, { close: true });
  return { X, Y, s };
}
function drawStatue() {
  const { c, g } = cv(256, 512), rnd = mulberry(21);
  const ped = [[58, 330], [198, 330], [206, 505], [50, 505]]; fillPoly(g, ped, '#c8c4bc'); hatch(g, ped, .7, 9, 1.5, rnd); strokeP(g, ped, 4, rnd, { close: true });
  strokeP(g, [[50, 360], [206, 360]], 3, rnd);
  g.fillStyle = INK; g.font = 'bold 26px "Bebas Neue", Impact, sans-serif'; g.textAlign = 'center'; g.fillText('FENOMENAL', 128, 420);
  drawFigure(g, 128, 40, 290, rnd, { fill: '#cfcbc3', w: 3.5 });
  return c;
}
function drawAngel() {
  const { c, g } = cv(256, 512), rnd = mulberry(31);
  for (const sd of [-1, 1]) {                                    // wings
    const w = [[128 + sd * 20, 150], [128 + sd * 120, 70], [128 + sd * 118, 180], [128 + sd * 90, 270], [128 + sd * 30, 230]];
    fillPoly(g, w, '#f3f1ec'); strokeP(g, w, 3.5, rnd, { close: true });
    for (let i = 0; i < 6; i++) strokeP(g, [[128 + sd * (40 + i * 12), 120 + i * 4], [128 + sd * (35 + i * 13), 200 + i * 9]], 1.8, rnd, { passes: 1 });
  }
  const robe = [[108, 140], [148, 140], [190, 480], [66, 480]]; fillPoly(g, robe, '#f3f1ec'); hatch(g, [[150, 140], [190, 480], [160, 480]], 1.3, 8, 1.3, rnd); strokeP(g, robe, 3.5, rnd, { close: true });
  const head = ellipsePts(128, 108, 26, 30, 20); fillPoly(g, head, '#f3f1ec'); strokeP(g, head, 3.5, rnd, { close: true });
  strokeP(g, ellipsePts(128, 64, 34, 10, 24), 4, rnd, { color: '#d9a640' });
  return c;
}
function drawDevil() {
  const { c, g } = cv(256, 512), rnd = mulberry(41);
  strokeP(g, [[200, 60], [200, 490]], 5, rnd); strokeP(g, [[176, 60], [176, 30], [200, 60], [200, 20], [224, 60], [224, 30]], 5, rnd);   // trident
  strokeP(g, [[90, 420], [40, 450], [30, 400], [10, 380]], 5, rnd, { color: RED }); fillPoly(g, [[10, 380], [30, 372], [24, 396]], RED);
  const body = [[100, 150], [156, 150], [176, 480], [80, 480]]; fillPoly(g, body, '#7d1015'); hatch(g, body, -1, 7, 1.4, rnd, 'rgba(0,0,0,.6)'); strokeP(g, body, 3.5, rnd, { close: true });
  const head = ellipsePts(128, 112, 27, 32, 20); fillPoly(g, head, '#9a1418'); strokeP(g, head, 3.5, rnd, { close: true });
  for (const sd of [-1, 1]) { const h = [[128 + sd * 14, 86], [128 + sd * 40, 40], [128 + sd * 26, 88]]; fillPoly(g, h, INK); }
  strokeP(g, [[156, 190], [200, 230]], 9, rnd, { color: '#7d1015' });
  return c;
}
function drawFamily() {
  const { c, g } = cv(512, 320), rnd = mulberry(51);
  const ppl = [[90, 40, 260], [200, 120, 180], [300, 110, 190], [410, 30, 270]];
  strokeP(g, [[120, 160], [440, 160]], 4, rnd);
  for (const p of ppl) drawFigure(g, p[0], p[1], p[2], rnd, { fill: '#cfcbc3', armsUp: false });
  return c;
}
function drawRing(red) {                                        // Vitruvian square + circle, the cover's geometry
  const { c, g } = cv(512, 512), rnd = mulberry(red ? 61 : 62);
  strokeP(g, [[60, 92], [452, 92], [452, 484], [60, 484]], 7, rnd, { close: true, color: red ? RED : INK, jit: 2 });
  strokeP(g, ellipsePts(256, 256, 226, 226, 80), 7, rnd, { close: true, color: red ? INK : RED, jit: 2 });
  return c;
}
function drawPuddle(seed) {
  const { c, g } = cv(256, 256), rnd = mulberry(seed); const pts = blob(128, 128, 104, 14, rnd, .45);
  fillPoly(g, pts, 'rgba(58,48,40,.92)'); strokeP(g, pts, 4, rnd, { close: true });
  for (let i = 0; i < 3; i++) strokeP(g, ellipsePts(110 + rnd() * 40, 110 + rnd() * 40, 20 + i * 14, 12 + i * 8, 20), 1.6, rnd, { color: 'rgba(236,233,227,.5)', passes: 1 });
  return c;
}
function drawCrack(seed) {
  const { c, g } = cv(512, 128), rnd = mulberry(seed); const pts = []; let y = 64;
  for (let x = 6; x < 506; x += 22 + rnd() * 18) { y = clamp(y + (rnd() - .5) * 46, 20, 108); pts.push([x, y]); }
  strokeP(g, pts, 7, rnd, { jit: .5 });
  for (let i = 1; i < pts.length - 1; i += 2) { const p = pts[i]; strokeP(g, [p, [p[0] + (rnd() - .5) * 50, p[1] + (rnd() - .5) * 70]], 3, rnd, { passes: 1 }); }
  return c;
}
function drawVeins(seed) {
  const { c, g } = cv(256, 256), rnd = mulberry(seed);
  function br(x, y, a, l, w, d) { if (d > 4 || l < 8) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; strokeP(g, [[x, y], [(x + x2) / 2 + (rnd() - .5) * 10, (y + y2) / 2 + (rnd() - .5) * 10], [x2, y2]], w, rnd, { color: RED, passes: 1 }); br(x2, y2, a - .5 + rnd() * .3, l * .7, w * .75, d + 1); br(x2, y2, a + .3 + rnd() * .3, l * .65, w * .7, d + 1); }
  br(128, 250, -Math.PI / 2, 70, 6, 0); return c;
}
function drawHole() {
  const { c, g } = cv(256, 256), rnd = mulberry(71); const pts = blob(128, 128, 112, 16, rnd, .2);
  fillPoly(g, pts, 'rgba(18,16,15,.9)'); strokeP(g, pts, 5, rnd, { close: true, color: RED }); return c;
}
function drawArrow() {
  const { c, g } = cv(128, 128), rnd = mulberry(81);
  const pts = [[64, 14], [110, 66], [82, 66], [82, 112], [46, 112], [46, 66], [18, 66]];
  fillPoly(g, pts, 'rgba(195,22,28,.85)'); strokeP(g, pts, 4, rnd, { close: true }); return c;
}
function drawSyll(txt, red) {
  const { c, g } = cv(256, 160), rnd = mulberry(txt.length * 13 + (red ? 1 : 0));
  g.fillStyle = red ? 'rgba(195,22,28,.95)' : 'rgba(236,233,227,.92)'; const b = [[10, 18], [246, 10], [240, 150], [16, 144]]; fillPoly(g, b, g.fillStyle); strokeP(g, b, 5, rnd, { close: true });
  g.fillStyle = red ? '#fff' : INK; g.font = '120px "Bebas Neue", Impact, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 88);
  return c;
}
function drawSplat(red, seed) {
  const { c, g } = cv(128, 128), rnd = mulberry(seed); const pts = blob(64, 64, 34, 18, rnd, .7);
  fillPoly(g, pts, red ? RED : INK); for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = 40 + rnd() * 18; fillPoly(g, ellipsePts(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 4 + rnd() * 5, 4 + rnd() * 5, 10), red ? RED : INK); }
  return c;
}
function drawHowl() {
  const { c, g } = cv(512, 160); g.fillStyle = RED; g.font = '700 120px Caveat, "Segoe Print", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Auuu!', 256, 84); return c;
}
function drawShadow() {
  const { c, g } = cv(128, 128); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}

/* ---------------- three.js setup ---------------- */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const BG = new THREE.Color('#cfccc5');
scene.background = BG; scene.fog = new THREE.Fog(BG, 26, 60);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300); scene.add(camera);
const UP = new THREE.Vector3(0, 1, 0);
function texOf(c, rep) { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
const IMG = {};
function loadImg(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }

let TX = {}, MAT = {}, OBJ = {};
let PROPS = [];
let bubble, glassU, medU, shadow, coverA, coverB;

function standup(tex, w, h) {                                    // paper cut-out standing on the ground, turns to the camera
  const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: false, alphaTest: .5, side: THREE.DoubleSide }));
  m.userData.stand = true; return m;
}
function decal(tex, w, h, opts = {}) {
  const geo = new THREE.PlaneGeometry(w, h); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: opts.opacity == null ? 1 : opts.opacity, fog: opts.fog !== false }));
  m.renderOrder = opts.order || 1; return m;
}
function addProp(obj, x, z, kind, extra) { obj.position.set(x, obj.position.y || 0, z); obj.userData.kind = kind; Object.assign(obj.userData, extra || {}); scene.add(obj); PROPS.push(obj); return obj; }

/* ---- path geometry: paper strips with the red handwriting ---- */
function buildPath() {
  const gaps = JUMPS.map(j => [pathPos(j.t + 0.08).s, pathPos(j.t + 0.42).s]);
  const pos = [], uv = [], idxT = [], idxS = [], edges = [];
  let vi = 0;
  function box(ax, az, bx, bz, sa) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.02) return;
    const ux = dx / L, uz = dz / L, nx = -uz * PW / 2, nz = ux * PW / 2;
    const P4 = [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]];
    // top
    const b0 = vi, v0 = ((sa * 7.31) % 1 + 1) % 1 * .75; for (const [k, p] of P4.entries()) { pos.push(p[0], TH, p[1]); const along = (k === 0 || k === 3) ? sa : sa + L; uv.push(along / 14, v0 + ((k === 0 || k === 1) ? .25 : 0)); vi++; }
    idxT.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    // sides
    for (let k = 0; k < 4; k++) {
      const p = P4[k], q = P4[(k + 1) % 4], s0 = vi;
      pos.push(p[0], TH, p[1], q[0], TH, q[1], q[0], -0.05, q[1], p[0], -0.05, p[1]); uv.push(0, 1, 1, 1, 1, 0, 0, 0); vi += 4;
      idxS.push(s0, s0 + 2, s0 + 1, s0, s0 + 3, s0 + 2);
      edges.push(p[0], TH, p[1], q[0], TH, q[1], p[0], TH, p[1], p[0], 0, p[1]);
    }
  }
  for (let k = 0; k < NC; k++) {
    const c = C[k], d = DIRS[c[3]];
    const segL = k < NC - 1 ? CS[k + 1] - CS[k] : TOTAL_S - CS[k];
    const ext = k < NC - 1 ? PW / 2 : 0;
    let pieces = [[Math.max(CS[k], PATH_S0), Math.min(CS[k] + segL + ext, PATH_S1)]].filter(pc => pc[1] > pc[0] + .01);
    for (const gp of gaps) { const np = []; for (const pc of pieces) { if (gp[1] <= pc[0] || gp[0] >= pc[1]) np.push(pc); else { if (gp[0] > pc[0]) np.push([pc[0], gp[0]]); if (gp[1] < pc[1]) np.push([gp[1], pc[1]]); } } pieces = np; }
    for (const pc of pieces) { const a = pc[0] - CS[k], b = pc[1] - CS[k]; box(c[1] + d[0] * a, c[2] + d[1] * a, c[1] + d[0] * b, c[2] + d[1] * b, pc[0]); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idxT.concat(idxS)); geo.addGroup(0, idxT.length, 0); geo.addGroup(idxT.length, idxS.length, 1);
  MAT.pathTop = new THREE.MeshBasicMaterial({ map: TX.script });
  MAT.pathSide = new THREE.MeshBasicMaterial({ map: TX.paper, color: new THREE.Color('#8f8a82'), side: THREE.DoubleSide });
  OBJ.path = new THREE.Mesh(geo, [MAT.pathTop, MAT.pathSide]); scene.add(OBJ.path);
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
  MAT.ink = new THREE.LineBasicMaterial({ color: 0x141414 });
  OBJ.edges = new THREE.LineSegments(eg, MAT.ink); scene.add(OBJ.edges);
  // corner arrows (one mesh)
  const ap = [], au = [], ai = []; let n = 0;
  for (const e of EV) if (e.k === 'G' && e.side !== 'A') {
    const c = C[e.ci], d = DIRS[c[3]], s = 0.55, x = c[1], z = c[2];
    const fx = d[0], fz = d[1], rx = -fz, rz = fx;             // forward, right
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];            // (right, forward)
    const qu = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 4; i++) { ap.push(x + (rx * q[i][0] + fx * q[i][1]) * s, TH + 0.012, z + (rz * q[i][0] + fz * q[i][1]) * s); au.push(qu[i][0], qu[i][1]); }
    ai.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
  }
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3)); ag.setAttribute('uv', new THREE.Float32BufferAttribute(au, 2)); ag.setIndex(ai);
  OBJ.arrows = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ map: TX.arrow, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide })); OBJ.arrows.renderOrder = 2; scene.add(OBJ.arrows);
  // holes under the gaps
  for (const j of JUMPS) { const a = pathPos(j.t + 0.25), h = decal(TX.hole, PW * .95, PW * .95); h.position.set(a.x, 0.015, a.z); scene.add(h); j.hole = h; }
  // FE-NO-ME-NAL on the path
  const SY = ['FE', 'NO', 'ME', 'NAL'];
  for (const e of EV) if (e.k === 'F') {
    const p = pathPos(e.t), m = decal(TX.syl[e.i], 1.25, 0.8, { order: 3 }); m.position.set(p.x, TH + 0.02, p.z);
    if (p.h !== 0) m.rotation.y = p.h === 1 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(m); e.dec = m; e.txt = SY[e.i];
  }
}

/* ---- ground and the two covers ---- */
function buildGround() {
  TX.paper.repeat.set(1, 1);
  const gt = TX.paperG; gt.repeat.set(70, 140);
  MAT.ground = new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color('#cfccc5') });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 520), MAT.ground); g.rotation.x = -Math.PI / 2; g.position.set(0, 0, -230); scene.add(g); OBJ.ground = g;
  function cover(x, z) {
    const grp = new THREE.Group();
    const geo = new THREE.PlaneGeometry(WC, HC); geo.rotateX(-Math.PI / 2);
    const a = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: TX.ghost, fog: false })); a.position.y = 0.006; a.renderOrder = 0;
    const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: TX.cover, fog: false, transparent: true, opacity: 1, depthWrite: false })); b.position.y = 0.009; b.renderOrder = 1;
    // a thin ink frame so the cover reads as a sheet on the floor
    const fr = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-WC / 2, .012, -HC / 2), new THREE.Vector3(WC / 2, .012, -HC / 2), new THREE.Vector3(WC / 2, .012, HC / 2), new THREE.Vector3(-WC / 2, .012, HC / 2)]), MAT.ink);
    grp.add(a, b, fr); grp.position.set(x, 0, z); scene.add(grp); return { grp, full: b };
  }
  coverA = cover(0, 0); coverB = cover(END.x, END.z);
}

/* ---- the bubble: the medallion of the cover inside a glass ball ---- */
const MED_VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const MED_FS = 'uniform sampler2D map; uniform float uOp; uniform float uRed; varying vec2 vUv;' +
  'void main(){ vec2 d=vUv-0.5; float r=length(d)*2.0; if(r>1.0) discard; vec3 c=texture2D(map,vUv).rgb;' +
  ' c=mix(c, vec3(0.86,0.12,0.13)*(0.35+0.9*c.r), uRed); float a=smoothstep(1.0,0.985,r)*uOp;' +
  /* where the cover has its title, the medallion is clear glass: the title stays printed on the floor */
  ' float tb=smoothstep(0.32,0.345,vUv.x)*(1.0-smoothstep(0.665,0.69,vUv.x))*smoothstep(0.815,0.835,vUv.y); a*=1.0-tb;' +
  ' gl_FragColor=vec4(c,a); }';
const GL_VS = 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }';
const GL_FS = 'uniform sampler2D map; uniform float uOp; uniform float uRed; varying vec3 vN; varying vec3 vV; varying vec2 vUv;' +
  'void main(){ float f=1.0-abs(dot(vN,vV)); float rim=pow(f,2.4); vec4 tx=texture2D(map,vUv*vec2(3.0,1.5)); float red=clamp((tx.r-tx.g)*2.6,0.0,1.0);' +
  ' float spec=pow(max(dot(vN,normalize(vec3(-0.45,0.6,0.66))),0.0),46.0); float spec2=pow(max(dot(vN,normalize(vec3(0.5,-0.35,0.8))),0.0),18.0)*0.25;' +
  ' vec3 col=mix(vec3(0.95,0.95,0.93), vec3(0.76,0.07,0.09), red*0.9); col=mix(col, vec3(0.8,0.05,0.07), uRed*0.6);' +
  ' float a=(0.05+rim*0.55+red*0.30*(1.0-f*0.5))*uOp + spec*0.85*uOp + spec2*uOp; col=mix(col,vec3(1.0),clamp(spec*1.5+spec2,0.0,1.0)); gl_FragColor=vec4(col,clamp(a,0.0,0.95)); }';
function buildBubble() {
  bubble = { grp: new THREE.Group(), q: new THREE.Quaternion(), pulse: 0, red: 0 };
  medU = { map: { value: TX.med }, uOp: { value: 1 }, uRed: { value: 0 } };
  bubble.med = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: medU, vertexShader: MED_VS, fragmentShader: MED_FS, transparent: true, depthWrite: false }));
  bubble.med.renderOrder = 5; scene.add(bubble.med);
  glassU = { map: { value: TX.script }, uOp: { value: 0 }, uRed: { value: 0 } };
  bubble.glass = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.ShaderMaterial({ uniforms: glassU, vertexShader: GL_VS, fragmentShader: GL_FS, transparent: true, depthWrite: false }));
  bubble.glass.renderOrder = 6; scene.add(bubble.glass);
  shadow = decal(TX.shadow, R * 2.6, R * 2.6, { order: 2 }); scene.add(shadow);
}

/* ---- scenery along the path, by section ---- */
const SEGS = []; for (let k = 0; k < NC; k++) { const c = C[k], d = DIRS[c[3]], L = (k < NC - 1 ? CS[k + 1] - CS[k] : TOTAL_S - CS[k]) + PW / 2; SEGS.push([c[1], c[2], c[1] + d[0] * L, c[2] + d[1] * L]); }
function distSeg(px, pz, s) { const ax = s[0], az = s[1], bx = s[2], bz = s[3], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let u = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; u = clamp(u, 0, 1); return Math.hypot(px - ax - dx * u, pz - az - dz * u); }
function clearOf(px, pz, minD) {
  for (const s of SEGS) { if (Math.min(s[1], s[3]) - minD > pz || Math.max(s[1], s[3]) + minD < pz) continue; if (distSeg(px, pz, s) < minD) return false; }
  if (Math.hypot(px, pz) < WC * .75 || Math.hypot(px - END.x, pz - END.z) < WC * .75) return false;      // keep the covers clean
  for (const p of PROPS) if (p.userData.r && Math.hypot(p.position.x - px, p.position.z - pz) < p.userData.r + minD * .45) return false;
  return true;
}
function scatter(ta, tb, step, fn, rnd, dmin = 3.2, dmax = 7.5, clear = 2.4) {
  for (let t = ta; t < tb; t += step) {
    const p = pathPos(t), d = DIRS[p.h];
    for (const side of [-1, 1]) {
      if (rnd() < .25) continue;
      const off = dmin + rnd() * (dmax - dmin), along = (rnd() - .5) * 2;
      const x = p.x + (-d[1]) * side * off + d[0] * along, z = p.z + d[0] * side * off + d[1] * along;
      if (clearOf(x, z, clear)) fn(x, z, rnd, t);
    }
  }
}
function buildScenery() {
  const rnd = mulberry(1979);
  const trees = [1, 2, 3, 4].map(s => texOf(drawTree(s))), rocks = [1, 2, 3].map(s => texOf(drawRock(s * 7)));
  const wolfT = texOf(drawWolf(5)), facN = [1, 2, 3, 4].map(s => texOf(drawFacade(s, true)));
  const lampT = texOf(drawLamp()), puddle = [1, 2].map(s => texOf(drawPuddle(s * 9))), cracks = [1, 2, 3].map(s => texOf(drawCrack(s * 5)));
  const veins = [1, 2, 3].map(s => texOf(drawVeins(s * 3))), ringK = texOf(drawRing(false)), ringR = texOf(drawRing(true));
  const roofM = new THREE.MeshBasicMaterial({ color: 0x2a2a2c });
  function spot(t, pref, clear) {                               // a free place near the path, in view (ahead, not too far to the side)
    const p = pathPos(t);
    for (const rr of [2.4, 3.0, 3.6, 4.4, 5.4, 6.5]) for (let k = 0; k < 16; k++) {
      const a = (pref < 0 ? Math.PI : 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8 * (pref ? 1 : 1), x = p.x + Math.cos(a) * rr, z = p.z - Math.abs(Math.sin(a)) * rr * .9 - .6;
      if (pref === 0 && k === 0) continue;
      if (Math.abs(x - p.x) <= 3.4 && clearOf(x, z, clear)) return [x, z];
    }
    return null;
  }
  { const q = spot(FX.statuie + 1.0, 1, 1.9); if (q) addProp(standup(texOf(drawStatue()), 2.2, 4.4), q[0], q[1], 'statue', { r: 1.4 }); }
  { const q1 = spot(FX.inger + 1.4, -1, 1.8) || spot(FX.inger + .4, -1, 1.6) || spot(FX.inger + 2.4, 0, 1.6); if (q1) addProp(standup(texOf(drawAngel()), 2.2, 4.4), q1[0], q1[1], 'figure', { r: 1.3 });
    const q2 = spot(FX.inger + 1.4, 1, 1.8) || spot(FX.inger + 2.4, 1, 1.6) || spot(FX.inger + .4, 1, 1.6) || spot(FX.inger + 3.2, 0, 1.5); if (q2) addProp(standup(texOf(drawDevil()), 2.2, 4.4), q2[0], q2[1], 'figure', { r: 1.3 }); }
  { const q = spot(FX.familie + 1.2, 1, 2.0); if (q) addProp(standup(texOf(drawFamily()), 3.6, 2.25), q[0], q[1], 'family', { r: 1.8 }); }
  OBJ.wolves = [];
  JUMPS.filter(j => j.t < bt(12)).forEach((j, n) => {
    const q = spot(j.t + 0.7, n % 2 ? -1 : 1, 1.7); if (!q) return;
    addProp(standup(rocks[n % 3], 2.0, 1.0), q[0], q[1], 'rock', { r: 1.1 });
    const w = standup(wolfT, 1.4, 1.75); w.position.y = .8; addProp(w, q[0], q[1] + .05, 'wolf', { r: 0, jt: j.t }); OBJ.wolves.push(w);
  });
  // intro & wolves (night)
  scatter(T_ROLL + 1, bt(12), .55, (x, z, r) => { const t = r() < .6 ? trees[r() * 4 | 0] : rocks[r() * 3 | 0]; const s = .8 + r() * .7; const m = t.image.height > 300 ? standup(t, 1.5 * s, 3.0 * s) : standup(t, 2.0 * s, 1.5 * s); addProp(m, x, z, 'tree', { r: 1.0 }); }, rnd, 2.2, 5.5, 1.9);
  // verse 1: a night city that turns into dawn
  scatter(bt(12), bt(28), .7, (x, z, r) => {
    if (r() < .62) { const w = 2.2 + r() * 1.8, h = 4 + r() * 7, dd = 2 + r() * 1.5; const geo = new THREE.BoxGeometry(w, h, dd); geo.translate(0, h / 2, 0); const fm = new THREE.MeshBasicMaterial({ map: facN[r() * 4 | 0] }); const b = new THREE.Mesh(geo, [fm, fm, roofM, roofM, fm, fm]); const eg = new THREE.LineSegments(new THREE.EdgesGeometry(geo), MAT.ink); b.add(eg); addProp(b, x, z, 'bld', { r: Math.max(w, dd) * .75 }); }
    else { const m = standup(lampT, .7, 3.6); addProp(m, x, z, 'lamp', { r: .5 }); }
  }, rnd, 2.6, 6.5, 2.2);
  scatter(FX.noroi - 2.2, FX.noroi + 2.5, .35, (x, z, r) => { const m = decal(puddle[r() * 2 | 0], 1.6 + r() * 1.6, 1.4 + r() * 1.2); m.position.y = .02; m.rotation.y = r() * 6; addProp(m, x, z, 'puddle', { r: .2 }); }, rnd, 1.6, 4.5, 1.4);
  // choruses: the Vitruvian square + circle all around
  for (const [a, b] of [[bt(28), bt(36)], [bt(52), bt(60)]]) scatter(a, b, .6, (x, z, r, t) => { const red = r() < .45; const s = 2.0 + r() * 1.4; const m = standup(red ? ringR : ringK, s, s); addProp(m, x, z, 'ring', { r: 1.1, s }); }, rnd, 2.4, 5.5, 2.0);
  // verse 2: stony field, red veins, the quake, angel & devil, family
  scatter(bt(36), bt(52), .6, (x, z, r) => { if (r() < .55) { const s = .9 + r() * .9; addProp(standup(rocks[r() * 3 | 0], 2.0 * s, 1.5 * s), x, z, 'rock', { r: 1.0 * s }); } else { const m = decal(veins[r() * 3 | 0], 2.2, 2.2, { opacity: .8 }); m.position.y = .02; m.rotation.y = r() * 6; addProp(m, x, z, 'vein', { r: .2 }); } }, rnd, 2.2, 6, 1.9);
  OBJ.cracks = [];
  scatter(FX.cutremur - .5, FX.crapatura + 1.5, .3, (x, z, r) => { const m = decal(cracks[r() * 3 | 0], 4 + r() * 3, 1.0); m.position.y = .02; m.rotation.y = r() * 6; m.material.opacity = 0; addProp(m, x, z, 'crack', { r: .2 }); OBJ.cracks.push(m); }, rnd, 1.4, 5.5, 1.3);
  // outro: back to paper — trees and the geometry, thinning out towards the cover
  scatter(bt(60), T_ARR - 4, .7, (x, z, r) => { if (r() < .5) { const s = .8 + r() * .6; addProp(standup(trees[r() * 4 | 0], 1.5 * s, 3.0 * s), x, z, 'tree', { r: 1.0 }); } else { const s = 2.0 + r(); addProp(standup(r() < .5 ? ringR : ringK, s, s), x, z, 'ring', { r: 1.1, s }); } }, rnd, 2.4, 6, 2.0);
  PROPS.sort((a, b) => b.position.z - a.position.z);
  // sky objects follow the camera
  OBJ.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(drawMoon()), fog: false, depthTest: false, transparent: true }));
  OBJ.moon.scale.set(7, 7, 1); OBJ.moon.renderOrder = -1; camera.add(OBJ.moon); OBJ.moon.position.set(4.2, 13.5, -40);
  OBJ.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(drawSun()), fog: false, depthTest: false, transparent: true, opacity: 0 }));
  OBJ.sun.scale.set(8, 8, 1); OBJ.sun.renderOrder = -1; camera.add(OBJ.sun); OBJ.sun.position.set(-4.2, 13.5, -40);
  OBJ.howl = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(drawHowl()), transparent: true, depthWrite: false, opacity: 0 })); OBJ.howl.scale.set(2.6, .8, 1); OBJ.howl.renderOrder = 8; scene.add(OBJ.howl);
}

/* ---- ink particles ---- */
const PARTS = [];
function buildParticles() {
  const tk = [texOf(drawSplat(false, 1)), texOf(drawSplat(true, 2))];
  for (let i = 0; i < 36; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tk[i % 2], transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 7; scene.add(s); PARTS.push({ s, life: 0, v: new THREE.Vector3() }); }
}
let partI = 0;
function burst(x, y, z, n, red, spd = 3) {
  for (let i = 0; i < n; i++) { const p = PARTS[(partI++) % PARTS.length]; if (red != null && (PARTS.indexOf(p) % 2 === 0) === red) { } p.s.visible = true; p.s.position.set(x, y, z); p.life = 1; const a = Math.random() * 6.28, e = Math.random() * 1.2; p.v.set(Math.cos(a) * spd * (0.4 + Math.random()), 1.5 + e * spd, Math.sin(a) * spd * (0.4 + Math.random())); p.sc = .25 + Math.random() * .3; }
}
function stepParticles(dt) { for (const p of PARTS) { if (p.life <= 0) continue; p.life -= dt * 1.6; p.v.y -= 9 * dt; p.s.position.addScaledVector(p.v, dt); const s = p.sc * (0.6 + p.life * .6); p.s.scale.set(s, s, 1); p.s.material.opacity = clamp(p.life * 1.5, 0, 1); if (p.life <= 0) p.s.visible = false; } }

/* ---------------- themes (sky/ground colours by section) ---------------- */
const TH_KEYS = [
  [0, '#cfccc5', '#cfccc5', '#ffffff'], [bt(2.5), '#cfccc5', '#cfccc5', '#ffffff'],
  [bt(3.5), '#2f333c', '#666a73', '#9fa2aa'], [bt(12), '#363941', '#6d6f75', '#a7a8ad'],
  [FX.zori - .5, '#363941', '#6d6f75', '#a7a8ad'], [FX.zori + 3, '#dcc6ad', '#cbbba7', '#fff4e8'],
  [bt(28) - .2, '#dcc6ad', '#cbbba7', '#fff4e8'], [bt(28) + 1, '#e7e2d9', '#ddd8ce', '#ffffff'],
  [bt(36) - .3, '#e7e2d9', '#ddd8ce', '#ffffff'], [bt(36) + 1.5, '#8b857e', '#9b958d', '#e4e0da'],
  [bt(52) - .3, '#8b857e', '#9b958d', '#e4e0da'], [bt(52) + 1, '#e7e2d9', '#ddd8ce', '#ffffff'],
  [bt(60) - .3, '#e7e2d9', '#ddd8ce', '#ffffff'], [bt(60) + 2, '#d4cec3', '#d0cabf', '#ffffff'], [999, '#d4cec3', '#d0cabf', '#ffffff']
].map(k => [k[0], new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3])]);
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();
function themeAt(t) {
  let i = 0; while (i < TH_KEYS.length - 2 && TH_KEYS[i + 1][0] <= t) i++;
  const a = TH_KEYS[i], b = TH_KEYS[i + 1], u = clamp((t - a[0]) / Math.max(1e-3, b[0] - a[0]), 0, 1);
  _c1.copy(a[1]).lerp(b[1], u); _c2.copy(a[2]).lerp(b[2], u); _c3.copy(a[3]).lerp(b[3], u);
}

/* ---------------- game state ---------------- */
const G = { state: 'boot', auto: false, cap: true, lives: 5, score: 0, combo: 0, maxCombo: 0, perf: 0, judged: 0, controlFrom: 0, pausedT: 0, fail: null, tries: 0, dbgT: null, endShown: false, lastT: 0, snap: true };
const SNAP = [];                                                  // score snapshots at checkpoints
function snapshot(t) { return { t, score: G.score, combo: G.combo, maxCombo: G.maxCombo, perf: G.perf, judged: G.judged }; }

/* ---------------- audio ---------------- */
let actx = null, abuf = null, src = null, gain = null, startAt = 0, syncMs = 0;
try { syncMs = parseInt(localStorage.getItem('fen.sync') || '0', 10) || 0; } catch (e) { }
function ensureCtx() { if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); gain = actx.createGain(); gain.connect(actx.destination); } if (actx.state === 'suspended') actx.resume(); }
function outLat() { return clamp((actx && (actx.outputLatency || actx.baseLatency)) || 0, 0, .35); }
function playAudio(from) { stopAudio(0); src = actx.createBufferSource(); src.buffer = abuf; src.connect(gain); const now = actx.currentTime; gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(1, now); src.start(now + .06, Math.max(0, from)); startAt = now + .06 - from; }
function stopAudio(f) { if (!src) return; const now = actx.currentTime; try { gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(0, now + Math.max(.01, f)); src.stop(now + Math.max(.01, f) + .02); } catch (e) { } src = null; }
function songTime() { if (G.dbgT != null) return G.dbgT; if (!actx) return 0; return actx.currentTime - startAt - outLat() + syncMs / 1000; }
async function loadAudio() {
  const btn = $('btnPlay');
  try {
    ensureCtx(); const res = await fetch('fenomenal.mp3'); if (!res.ok) throw new Error('http'); const total = +res.headers.get('content-length') || 9953583; let ab;
    if (res.body && res.body.getReader) { const rd = res.body.getReader(), parts = []; let got = 0; for (; ;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; btn.textContent = 'Se încarcă piesa… ' + Math.min(99, Math.round(got / total * 100)) + '%'; } const u = new Uint8Array(got); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; } ab = u.buffer; }
    else ab = await res.arrayBuffer();
    btn.textContent = 'Pregătesc…';
    abuf = await new Promise((ok, ko) => { const r = actx.decodeAudioData(ab, ok, ko); if (r && r.then) r.then(ok, ko); });
    G.audioOk = true; readyCheck();
  } catch (e) { btn.textContent = 'Piesa nu s-a putut încărca'; }
}

/* ---------------- lyrics (versuri.txt) ---------------- */
const Vers = (function () {
  const sil = s => { const m = String(s).toLowerCase().match(/[aeiouăâîy]+/g); return m ? m.length : 0; };
  function dec(buf) { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { try { return new TextDecoder('windows-1250').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } } }
  function lines(txt) { const o = []; for (const raw of String(txt || '').replace(/^﻿/, '').split(/\r?\n/)) { const s = raw.trim(); if (!s || /^\[[^\]]*\]$/.test(s) || /^\([^)]*\)$/.test(s)) continue; o.push(s); } return o; }
  function matchesTable(L) {                      // same song text? line count + where «lup» and «fenomenal» appear
    const T = N.vers; if (L.length !== T.n) return false;
    const low = L.map(s => s.toLowerCase());
    const fen = low.map((s, i) => s.includes('fenomenal') ? i : -1).filter(i => i >= 0), lup = low.map((s, i) => s.includes('lup') ? i : -1).filter(i => i >= 0);
    return JSON.stringify(fen) === JSON.stringify(T.fen) && JSON.stringify(lup) === JSON.stringify(T.lup);
  }
  function casa(L, FR) {                          // fallback: syllables against detected vocal phrases (dynamic programming)
    const n = L.length, m = FR.length, INF = 1e9, GMAX = 7, pre = [0]; for (const x of FR) pre.push(pre[pre.length - 1] + x[2]);
    const Cc = [], B = []; for (let i = 0; i <= n; i++) { Cc.push(new Float64Array(m + 1).fill(INF)); B.push(new Int8Array(m + 1)); }
    Cc[0][0] = 0; const up = (i, j, v, op) => { if (v < Cc[i][j]) { Cc[i][j] = v; B[i][j] = op; } };
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) { const c = Cc[i][j]; if (c >= INF) continue; if (j < m) up(i, j + 1, c + 1.5 + .25 * FR[j][2], 1); if (i < n) { for (let g = 1; g <= GMAX && j + g <= m; g++) up(i + 1, j + g, c + Math.abs(pre[j + g] - pre[j] - L[i].f) + (g - 1) * .5, 2); up(i + 1, j, c + 8 + .3 * L[i].f, 3); } }
    const res = new Array(n).fill(null); let i = n, j = m;
    while (i > 0 || j > 0) { const op = B[i][j]; if (op === 1) j--; else if (op === 2) { let g = 1; for (; g <= GMAX; g++) { const jj = j - g; if (jj >= 0 && Cc[i - 1][jj] < INF && Math.abs(Cc[i - 1][jj] + Math.abs(pre[j] - pre[jj] - L[i - 1].f) + (g - 1) * .5 - Cc[i][j]) < 1e-9) break; } res[i - 1] = { a: FR[j - g][0], b: FR[j - 1][1] }; i--; j -= g; } else if (op === 3) i--; else break; }
    return res;
  }
  function parse(txt) {
    const L = lines(txt); if (!L.length) return [];
    if (matchesTable(L)) return L.map((s, i) => ({ text: s, t: N.vers.t[i], te: N.vers.e[i] }));
    const LL = L.map(s => ({ text: s, f: Math.max(1, sil(s)) })), pos = casa(LL, N.frases);
    const out = LL.map((l, i) => ({ text: l.text, t: pos[i] ? pos[i].a - .15 : null, te: pos[i] ? pos[i].b + .6 : null }));
    for (let i = 0; i < out.length; i++) if (out[i].t == null) { let p = i - 1; while (p >= 0 && out[p].t == null) p--; let q = i + 1; while (q < out.length && out[q].t == null) q++; const ta = p >= 0 ? out[p].te : 0, tb = q < out.length ? out[q].t : ta + 3 * (q - p); out[i].t = ta + (tb - ta) * (i - p) / (q - p); out[i].te = out[i].t + 2.5; }
    for (let i = 0; i < out.length - 1; i++) out[i].te = Math.min(out[i].te, Math.max(out[i].t + 1, out[i + 1].t - .05));
    return out;
  }
  const load = url => fetch(url, { cache: 'no-cache' }).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? parse(dec(b)) : []).catch(() => []);
  function at(arr, T) { let l = -1; for (let i = 0; i < arr.length; i++) { if (arr[i].t <= T + .02) l = i; else break; } return l >= 0 && T < arr[l].te ? l : -1; }
  return { load, parse, at };
})();
let LYR = [];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function capHtml(s) { return esc(s).replace(/(fenomenal)/gi, '<em>$1</em>'); }

/* ---------------- camera ---------------- */
const CAM = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const _m = new THREE.Matrix4(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const TOPQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
function topHeight() { const a = camera.aspect, th = Math.tan(FOV * Math.PI / 360); return a < WC / HC ? WC / (2 * th * a) : HC / (2 * th); }
function rig() { const a = camera.aspect; return a < .8 ? { D: 15.5, el: 0.86, ahead: 3.2 } : { D: 13.5, el: 0.78, ahead: 2.2 }; }
function chasePose(t, op, oq) {
  const P_ = rig(); let sx = 0; const n = 9; for (let i = 0; i < n; i++) sx += pathX(t - .6 + i * (2.2 / (n - 1)));
  const bx = sx / n, p = pathPos(t, _pp);
  _v1.set(bx * .85 + p.x * .15, TH, p.z - P_.ahead);
  op.set(_v1.x, _v1.y + Math.sin(P_.el) * P_.D, _v1.z + Math.cos(P_.el) * P_.D);
  if (t > FX.cutremur && t < FX.crapatura + 1.2) { const k = (1 - sstep(FX.crapatura + .2, FX.crapatura + 1.2, t)) * sstep(FX.cutremur, FX.cutremur + .3, t); op.x += Math.sin(t * 61) * .22 * k; op.y += Math.sin(t * 47 + 1) * .18 * k; }
  _m.lookAt(op, _v1, UP); oq.setFromRotationMatrix(_m);
}
let COVER_SHIFT = 0;                                             // px the cover sits above the screen centre (portrait)
function topPose(cx, cz, op, oq) { const H = topHeight(), wh = 2 * H * Math.tan(FOV * Math.PI / 360); op.set(cx, H, cz + COVER_SHIFT * wh / innerHeight); oq.copy(TOPQ); }
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function updateCamera(t) {
  if (G.state === 'title' || G.state === 'boot') { topPose(0, 0, camera.position, camera.quaternion); return; }
  if (G.state === 'end' || t >= T_OVER) { topPose(END.x, END.z, camera.position, camera.quaternion); return; }
  chasePose(t, _pb, _qb);
  let u = 1;
  if (t < 7.2 && !G.skipIntro) { u = sstep(2.0, 7.0, t); topPose(0, 0, _pa, _qa); camera.position.lerpVectors(_pa, _pb, u); camera.position.y += Math.sin(u * Math.PI) * 2.5; camera.quaternion.slerpQuaternions(_qa, _qb, u); }
  else if (t > T_ARR - 1.6) { u = sstep(T_ARR - 1.6, T_OVER - .15, t); topPose(END.x, END.z, _pa, _qa); camera.position.lerpVectors(_pb, _pa, u); camera.position.y += Math.sin(u * Math.PI) * 2.0; camera.quaternion.slerpQuaternions(_qb, _qa, u); }
  else { camera.position.copy(_pb); camera.quaternion.copy(_qb); }
}

/* ---------------- per-frame world ---------------- */
const _bp = {}, _ax = new THREE.Vector3(), _qr = new THREE.Quaternion(), FLATQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
let lastBubT = null;
function bubbleY(t) {
  const j = jumpAt(t); if (!j) return 0;
  const u = clamp((t - j.t) / 0.5, 0, 1);
  if (j.st === 2) return -Math.sin(Math.PI * u) * 0.9;            // missed: falls into the gap and pops back
  return 4 * 1.25 * u * (1 - u);
}
function updateBubble(t, dt) {
  const fy = floorY(t), p = pathPos(t, _bp), y = fy + R + bubbleY(t);
  // rolling
  if (lastBubT != null && t > T_ROLL) { const q = pathPos(lastBubT, {}); const dx = p.x - q.x, dz = p.z - q.z, ds = Math.hypot(dx, dz); if (ds > 1e-4 && ds < 3) { _ax.set(dz / ds, 0, -dx / ds); _qr.setFromAxisAngle(_ax, ds / R); bubble.q.premultiply(_qr); } }
  lastBubT = t;
  bubble.pulse = Math.max(0, bubble.pulse - dt * 4); bubble.red = Math.max(0, bubble.red - dt * 2.2);
  const beatPh = ((t - N.ph) / P) % 1, bob = t > T_ROLL && t < T_ARR ? Math.pow(1 - beatPh, 3) * .06 : 0;
  const sc = 1 + bubble.pulse * .12;
  // intro (cover -> bubble) and ending (bubble -> cover)
  let mu = 1, gop = 1, cx = 0, cz = 0;
  if (t < 7.0 && !G.skipIntro) { mu = sstep(2.0, 6.2, t); gop = sstep(5.0, 6.6, t); cx = 0; cz = 0; }
  if (t > T_STOP - .4) { mu = 1 - sstep(T_STOP - .3, T_OVER - .3, t); gop = 1 - sstep(T_STOP - .5, T_STOP + .4, t); cx = END.x; cz = END.z; }
  const flatPos = _v1.set(cx + MED_OFF.x, 0.02, cz + MED_OFF.z), ballPos = _v2.set(p.x, y + bob, p.z);
  bubble.med.position.lerpVectors(flatPos, ballPos, mu);
  const half = lerp(MED_HALF, R * .985, mu) * sc; bubble.med.scale.set(half * 2, half * 2, 1);
  bubble.med.quaternion.slerpQuaternions(FLATQ, camera.quaternion, mu); bubble.med.visible = mu > .002;
  bubble.glass.position.set(p.x, y, p.z); bubble.glass.quaternion.copy(bubble.q); bubble.glass.scale.setScalar(sc * (0.6 + 0.4 * gop));
  glassU.uOp.value = gop * (G.state === 'failing' ? Math.max(0, 1 - (clock - G.fail.start) * 2.5) : 1);
  medU.uOp.value = G.state === 'failing' ? Math.max(0, 1 - (clock - G.fail.start) * 1.2) : 1;
  medU.uRed.value = glassU.uRed.value = bubble.red;
  bubble.glass.visible = gop > 0.01;
  const onGap = bubbleY(t) !== 0;
  shadow.position.set(p.x, onGap ? 0.02 : fy + 0.014, p.z); const ss = clamp(1 - bubbleY(t) * .35, .4, 1.1) * gop; shadow.scale.set(ss, 1, ss); shadow.visible = gop > .02;
  // covers fade between the original drawing and the ghost left behind
  coverA.full.material.opacity = t < 7.0 && !G.skipIntro ? 1 - sstep(2.0, 4.4, t) : 0;
  coverB.full.material.opacity = sstep(T_STOP + .2, T_OVER - .2, t);
}
const _cam = new THREE.Vector3();
function updateWorld(t, dt) {
  const unf = G.state === 'title' || G.state === 'boot' ? 0 : (G.skipIntro ? 1 : sstep(2.6, 6.0, t));
  OBJ.path.scale.y = OBJ.edges.scale.y = Math.max(.001, unf); OBJ.path.visible = OBJ.edges.visible = unf > .01; OBJ.arrows.visible = unf > .9; for (const j of JUMPS) j.hole.visible = unf > .5;
  themeAt(t); BG.copy(_c1); scene.fog.color.copy(_c1); MAT.ground.color.copy(_c2); MAT.pathTop.color.copy(_c3);
  const top = camera.position.y > 30; scene.fog.near = top ? 200 : 26; scene.fog.far = top ? 400 : 60;
  // night sky objects
  const night = sstep(bt(2.5), bt(3.5), t) * (1 - sstep(FX.zori - .5, FX.zori + 2.5, t));
  OBJ.moon.material.opacity = night; OBJ.moon.visible = night > .01;
  const sun = sstep(FX.zori, FX.zori + 3, t) * (1 - sstep(bt(28) + .5, bt(30), t)); OBJ.sun.material.opacity = sun; OBJ.sun.visible = sun > .01;
  OBJ.sun.position.y = lerp(6, 13.5, sstep(FX.zori, FX.zori + 4, t));
  // props: visible near the camera, cut-outs turn to face it
  _cam.copy(camera.position); const zc = pathPos(t, _pp).z;
  const beat = ((t - N.ph) / P), bp = Math.pow(1 - (beat % 1), 4);
  for (const m of PROPS) {
    const dz = m.position.z - zc, vis = dz < 14 && dz > -40 && t > 2.4; m.visible = vis; if (!vis) continue;
    if (m.userData.stand) { m.rotation.y = Math.atan2(_cam.x - m.position.x, _cam.z - m.position.z); const u = sstep(-38, -28, dz) * sstep(2.4, 5.5, t), o = u < 1 ? Math.sin(u * Math.PI) * .15 : 0; m.scale.y = Math.max(.001, u + o); }
    const k = m.userData.kind;
    if (k === 'ring') { const s = 1 + bp * .08; m.scale.x = s; m.scale.y *= s; }
    else if (k === 'wolf') { const jt = m.userData.jt, w = clamp(1 - Math.abs(t - jt - .25) / .6, 0, 1); m.scale.y *= 1 + w * .12; m.position.y = .8 + w * .15; }
    else if (k === 'crack') m.material.opacity = sstep(FX.cutremur, FX.cutremur + 1.2, t);
    else if (k === 'lamp' || k === 'bld') { }
  }
  // the wolves howl with the chant
  let hw = 0, wolf = null; for (const w of (OBJ.wolves || [])) { const a = clamp(1 - Math.abs(t - w.userData.jt - .45) / .7, 0, 1); if (a > hw) { hw = a; wolf = w; } }
  OBJ.howl.material.opacity = hw; OBJ.howl.visible = hw > .02; if (wolf) OBJ.howl.position.set(wolf.position.x, 3.0 + hw * .4, wolf.position.z);
  // FE-NO-ME-NAL letters pop up when hit
  for (const e of EV) if (e.k === 'F' && e.dec) { const dz = e.dec.position.z - zc; if (dz > 14 || dz < -48) { e.dec.visible = false; continue; } e.dec.visible = true; if (e.st === 1) { const a = clamp((t - e.ht) / .5, 0, 1); e.dec.position.y = TH + .02 + Math.sin(a * Math.PI) * .5; } }
  stepParticles(dt);
}

/* ---------------- judging ---------------- */
function grade(dt) { const a = Math.abs(dt); return a <= PERF ? 'perfect' : a <= GOOD ? 'good' : 'ok'; }
const GTXT = { perfect: 'PERFECT', good: 'BINE', ok: 'OK' };
function screenOf(x, y, z) { _v1.set(x, y, z).project(camera); return [(_v1.x * .5 + .5) * innerWidth, (-_v1.y * .5 + .5) * innerHeight]; }
function judgeText(txt, cls, x, y, z) { const [sx, sy] = screenOf(x, y, z); const d = document.createElement('div'); d.className = 'judge ' + cls; d.textContent = txt; d.style.left = sx + 'px'; d.style.top = sy + 'px'; $('judgeLayer').appendChild(d); setTimeout(() => d.remove(), 800); }
function hit(e, t, dt, auto) {
  e.st = 1; e.ht = t;
  const p = pathPos(e.t);
  if (e.k === 'F') {
    if (e.dec) e.dec.material.map = TX.sylR[e.i];
    G.score += 40 * mult(); G.combo++;
    bubble.pulse = .6; burst(p.x, TH + .4, p.z, 3, true, 2);
    const grp = HOOKS[e.g]; if (e.i === 3 && grp.every(x => x.st === 1)) { G.score += 250; if (!auto) judgeText('FENOMENAL!', 'big', p.x, TH + 2.6, p.z); burst(p.x, TH + 1, p.z, 10, true, 4); }
  } else {
    const gr = auto ? 'perfect' : grade(dt);
    G.judged++; if (gr === 'perfect') G.perf++;
    G.score += { perfect: 100, good: 60, ok: 30 }[gr] * mult(); G.combo++;
    bubble.pulse = gr === 'perfect' ? 1 : .6;
    if (!auto) judgeText(GTXT[gr], gr, p.x, TH + 2.2, p.z);
    if (gr === 'perfect') burst(p.x, TH + .3, p.z, 4, null, 2.5);
    if (!G.auto && G.combo > 0 && G.combo % 30 === 0 && G.lives < 5) { G.lives++; judgeText('+1 VIAȚĂ', 'life', p.x, TH + 3.2, p.z); }
  }
  G.maxCombo = Math.max(G.maxCombo, G.combo);
}
function mult() { return 1 + Math.min(4, Math.floor(G.combo / 10)) * .25; }
function miss(e, t, why) {
  e.st = 2; const p = pathPos(e.t);
  if (e.k === 'F') { G.combo = 0; if (e.dec) e.dec.material.opacity = .45; return; }
  G.judged++; G.combo = 0; G.lives--; bubble.red = 1;
  judgeText(why === 'wrong' ? 'GREȘIT' : 'RATAT', 'miss', p.x, TH + 2.2, p.z);
  const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60);
  if (navigator.vibrate) try { navigator.vibrate(40); } catch (er) { }
  if (G.lives <= 0) startFail(t);
}
function tap(side) {
  if (G.state !== 'playing') return; const t = songTime();
  if (G.auto || t < G.controlFrom || t < T_ROLL) return;
  let best = null, bd = 1e9;
  for (const e of EV) { if (e.t > t + WIN + .05) break; if (e.st) continue; const w = e.k === 'F' ? WINF : WIN, d = Math.abs(t - e.t); if (d <= w && d < bd) { bd = d; best = e; } }
  if (!best) return;
  if (best.k === 'G' && best.side !== 'A' && side !== best.side) { miss(best, t, 'wrong'); return; }
  hit(best, t, t - best.t, false);
}
function startFail(t) { G.state = 'failing'; G.fail = { t, start: clock }; stopAudio(.5); const p = pathPos(t); burst(p.x, TH + R, p.z, 16, true, 5); burst(p.x, TH + R, p.z, 10, false, 4); }

/* ---------------- UI ---------------- */
const ui = { cover: $('cover2d') };
function hideAll() { for (const id of ['title', 'pause', 'fail', 'end', 'fsHelp']) $(id).hidden = true; }
function showHud(on) { $('hud').hidden = !on; }
function livesHtml() { let s = ''; for (let i = 0; i < 5; i++) s += '<i class="' + (i < G.lives ? 'on' : '') + '"></i>'; return s; }
let lastLives = -1, lastCap = -2, secShown = '', hintOn = '';
const SECNAME = { lup: 'Intro', strofa1: 'Strofa 1', refren1: 'Refren', strofa2: 'Strofa 2', refren2: 'Refren', final: 'Final' };
function updateHud(t) {
  $('progFill').style.width = (clamp((t - T_ROLL) / (T_ARR - T_ROLL), 0, 1) * 100).toFixed(1) + '%';
  $('score').textContent = Math.round(G.score).toLocaleString('ro-RO');
  const cc = $('comboChip'); cc.hidden = G.combo < 5; if (!cc.hidden) $('combo').textContent = G.combo;
  if (G.lives !== lastLives) { $('lives').innerHTML = livesHtml(); lastLives = G.lives; }
  $('lives').style.visibility = G.auto ? 'hidden' : 'visible';
  // lyrics
  const li = G.cap ? Vers.at(LYR, t) : -1; if (li !== lastCap) { lastCap = li; const c = $('caption'); if (li < 0) c.hidden = true; else { c.hidden = false; c.firstElementChild.innerHTML = capHtml(LYR[li].text); } }
  // section names
  let sec = ''; for (const s of N.sec) if (t >= s[0]) sec = s[1];
  const sl = $('section'); const showSec = sec !== 'intro' && N.sec.some(s => s[1] === sec && t - s[0] < 2.2 && t - s[0] >= 0);
  if (showSec && secShown !== sec) { sl.textContent = SECNAME[sec] || ''; secShown = sec; }
  sl.classList.toggle('on', showSec);
  // first-time hints
  let h = '';
  if (!G.auto && G.controlFrom < 8) { if (t > 6.6 && t < 9.4) h = 'Atinge oriunde ca să sară!'; else if (t > 9.4 && t < 12.6) h = 'Stânga / dreapta: încotro virează'; }
  if (!G.auto && t > bt(27) && t < bt(28) + .2) h = 'FE-NO-ME-NAL: bate pe fiecare silabă!';
  if (h !== hintOn) { hintOn = h; const el = $('hint'); if (h) el.textContent = h; el.classList.toggle('on', !!h); }
}
function gcEvent(name) { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'fenomenal/' + name, title: name, event: true }); } catch (e) { } }

/* ---------------- run control ---------------- */
function resetRun() {
  for (const e of EV) { e.st = 0; e.ht = 0; if (e.dec) { e.dec.material.map = TX.syl[e.i]; e.dec.material.opacity = 1; e.dec.position.y = TH + .02; } }
  Object.assign(G, { lives: 5, score: 0, combo: 0, maxCombo: 0, perf: 0, judged: 0, endShown: false });
  SNAP.length = 0; bubble.q.identity(); lastBubT = null; lastLives = -1; lastCap = -2;
}
function playFrom(t0, controlFrom) {
  ensureCtx(); hideAll(); showHud(true); $('autoBadge').hidden = !G.auto;
  G.controlFrom = controlFrom == null ? t0 : controlFrom; G.skipIntro = t0 > 2;
  for (const e of EV) if (e.t < G.controlFrom && !e.st) { e.st = 1; e.ht = e.t; }
  lastBubT = null; G.state = 'playing'; playAudio(t0); coverTo(0);
}
function startFromZero() { G.tries++; resetRun(); playFrom(0, 0); gcEvent(G.auto ? 'plimbare' : 'partida'); }
function lastCheckpoint(t) { let c = N.cp[0]; for (const x of N.cp) if (x <= t - .5) c = x; return c; }
function retryCp() {
  const cp = lastCheckpoint(G.fail ? G.fail.t : 0);
  let sn = null; for (const s of SNAP) if (s.t <= cp + .01) sn = s;
  for (const e of EV) if (e.t >= cp - .05) { e.st = 0; if (e.dec) { e.dec.material.map = TX.syl[e.i]; e.dec.material.opacity = 1; e.dec.position.y = TH + .02; } }
  if (sn) Object.assign(G, { score: sn.score, combo: 0, maxCombo: sn.maxCombo, perf: sn.perf, judged: sn.judged }); else Object.assign(G, { score: 0, combo: 0, maxCombo: 0, perf: 0, judged: 0 });
  G.lives = 5; lastLives = -1; G.tries++;
  playFrom(Math.max(0, cp - 2.4), cp);
}
function pause() {
  if (G.state !== 'playing') return; G.pausedT = songTime(); stopAudio(.08); G.state = 'paused';
  $('optAuto2').checked = G.auto; $('optCap2').checked = G.cap; syncOpts(); $('pause').hidden = false;
}
function resume() {
  $('pause').hidden = true; const t0 = G.pausedT; G.state = 'counting'; const el = $('count'); let n = 3; el.hidden = false; el.textContent = n;
  const iv = setInterval(() => { n--; if (n <= 0) { clearInterval(iv); el.hidden = true; G.state = 'playing'; $('autoBadge').hidden = !G.auto; playAudio(Math.max(0, t0 - .8)); } else el.textContent = n; }, 520);
}
function showFail() {
  G.state = 'fail'; showHud(false);
  $('failPct').textContent = 'Ai ajuns la ' + Math.round(clamp((G.fail.t - T_ROLL) / (T_ARR - T_ROLL), 0, 1) * 100) + ' %';
  $('fail').hidden = false;
}
function finishGame() {
  G.state = 'end'; showHud(false); coverTo(1);
  $('stScore').textContent = Math.round(G.score).toLocaleString('ro-RO');
  $('stPerf').textContent = (G.judged ? Math.round(G.perf / G.judged * 100) : 0) + '%';
  $('stCombo').textContent = G.maxCombo;
  $('endLede').textContent = G.auto ? 'Ai văzut tot drumul în modul plimbare.' : 'Ai terminat drumul pe ritmul piesei.';
  $('end').hidden = false; gcEvent('final');
}
function syncOpts() { $('syncVal').textContent = (syncMs > 0 ? '+' : '') + syncMs + ' ms'; }
function setSync(v) { syncMs = clamp(v, -300, 300); try { localStorage.setItem('fen.sync', syncMs); } catch (e) { } syncOpts(); }

/* ---- the 2D cover overlay ---- */
const COV = { from: 1, to: 1, t0: 0, v: -1 };
function coverVal(now) { const u = clamp((now - COV.t0) / 700, 0, 1), e = u * u * (3 - 2 * u); return COV.from + (COV.to - COV.from) * e; }
function coverTo(v) { const now = performance.now(); COV.from = coverVal(now); COV.to = v; COV.t0 = now; }
function stepCover(now) { const v = coverVal(now); if (Math.abs(v - COV.v) < .002) return; COV.v = v; ui.cover.style.opacity = v.toFixed(3); ui.cover.style.visibility = v < .004 ? 'hidden' : 'visible'; }

/* ---------------- main loop ---------------- */
let clock = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); stepCover(performance.now());
  const dt = clamp((now - last) / 1000, 0, .05); last = now; clock += dt;
  let t = 0;
  if (G.state === 'playing') t = songTime(); else if (G.state === 'failing' || G.state === 'fail') t = G.fail.t; else if (G.state === 'paused' || G.state === 'counting') t = G.pausedT; else if (G.state === 'end') t = T_CARD + 1; else t = 0;
  if (G.dbgT != null && G.state !== 'title' && G.state !== 'boot') t = G.dbgT;
  if (G.state === 'playing') {
    for (const e of EV) {
      if (e.t > t) break; if (e.st) continue;
      if (G.auto || e.t < G.controlFrom) { if (e.t >= t - .5 || G.auto) hit(e, e.t, 0, true); else e.st = 1; }
      else if (t > e.t + (e.k === 'F' ? WINF : WIN)) { miss(e, t, 'late'); if (G.state !== 'playing') break; }
    }
    for (const c of N.cp) if (t >= c && !SNAP.some(s => Math.abs(s.t - c) < .01)) SNAP.push(snapshot(c));
    if (G.state === 'playing') { updateHud(t); if (t >= T_OVER && COV.to !== 1) coverTo(1); if (t >= T_CARD) finishGame(); }
  }
  if (G.state === 'failing' && clock - G.fail.start > 1.3) showFail();
  if (G.state !== 'boot') { updateCamera(t); updateBubble(t, dt); updateWorld(t, dt); }
  G.lastT = t; renderer.render(scene, camera);
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const a = w / h, ca = 1061 / 1068; let cw, ch; if (a < ca) { cw = w; ch = w / ca; } else { ch = h; cw = h * ca; }
  const topPx = a < .8 ? Math.max(0, Math.min((h - ch) / 2, 54)) : (h - ch) / 2; COVER_SHIFT = (h - ch) / 2 - topPx;
  Object.assign(ui.cover.style, { width: cw + 'px', height: ch + 'px', left: (w - cw) / 2 + 'px', top: topPx + 'px' });
  $('app').classList.toggle('wide', a > 1.15);
  const phone = Math.min(w, h) < 520 && ('ontouchstart' in window);
  $('rotate').hidden = !(phone && w > h);
  if (phone && w > h && G.state === 'playing') pause();
}
addEventListener('resize', resize);

/* ---------------- input ---------------- */
const app = $('app');
app.addEventListener('pointerdown', e => {
  if (e.target.closest('button,a,label,input,.card')) return;
  if (G.state !== 'playing') return; e.preventDefault();
  tap(e.clientX < innerWidth / 2 ? 'L' : 'R');
}, { passive: false });
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key;
  if (k === 'Escape' || k === 'p' || k === 'P') { if (G.state === 'playing') pause(); else if (G.state === 'paused') resume(); return; }
  if (G.state !== 'playing') return;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { tap('L'); e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { tap('R'); e.preventDefault(); }
  else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') { tap('A'); e.preventDefault(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') pause(); });

/* ---------------- buttons ---------------- */
$('btnPlay').addEventListener('click', () => { G.auto = $('optAuto').checked; G.cap = $('optCap').checked; startFromZero(); });
$('btnPause').addEventListener('click', e => { e.stopPropagation(); pause(); });
$('btnResume').addEventListener('click', () => { G.auto = $('optAuto2').checked; G.cap = $('optCap2').checked; lastCap = -2; resume(); });
$('btnRestartP').addEventListener('click', () => { G.auto = $('optAuto2').checked; G.cap = $('optCap2').checked; startFromZero(); });
$('btnRetryCp').addEventListener('click', retryCp);
$('btnRetry0').addEventListener('click', startFromZero);
$('btnAgain').addEventListener('click', () => { G.auto = false; startFromZero(); });
$('btnWatch').addEventListener('click', () => { G.auto = true; startFromZero(); });
$('syncMinus').addEventListener('click', () => setSync(syncMs - 10));
$('syncPlus').addEventListener('click', () => setSync(syncMs + 10));
$('btnSpotify').addEventListener('click', () => gcEvent('spotify'));
$('btnYoutube').addEventListener('click', () => gcEvent('youtube'));
{ const a = document.querySelector('#emsCredit a'); a.addEventListener('pointerdown', e => e.stopPropagation()); a.addEventListener('click', () => gcEvent('ems')); }
const isIOS = /iP(hone|od|ad)/.test(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
const standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches);
if (standalone) $('btnFs').hidden = true;
$('btnFs').addEventListener('click', () => {
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq && !isIOS) { try { const r = rq.call(el); if (r && r.then) r.then(() => { try { screen.orientation.lock('portrait').catch(() => { }); } catch (e) { } }).catch(() => { $('fsHelp').hidden = false; $('title').hidden = true; }); } catch (e) { } }
  else { $('title').hidden = true; $('fsHelp').hidden = false; }
});
$('btnFsOk').addEventListener('click', () => { $('fsHelp').hidden = true; $('title').hidden = false; });

/* ---------------- boot ---------------- */
function readyCheck() {
  if (!G.audioOk || !G.sceneOk) return;
  const b = $('btnPlay'); b.disabled = false; b.textContent = 'Intră în copertă';
}
async function boot() {
  resize();
  try { await Promise.race([Promise.all([document.fonts.load('80px "Bebas Neue"'), document.fonts.load('700 60px Caveat')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  const [cimg, mimg] = await Promise.all([loadImg('coperta.jpg'), loadImg('medalio.jpg')]);
  IMG.cover = cimg;
  TX.cover = new THREE.Texture(cimg); TX.cover.needsUpdate = true; TX.cover.anisotropy = 8;
  { const { c, g } = cv(1061, 1068); g.drawImage(cimg, 0, 0); const gr = g.createRadialGradient(CIRC.cx, CIRC.cy, 300, CIRC.cx, CIRC.cy, 482); gr.addColorStop(0, 'rgba(200,197,190,.72)'); gr.addColorStop(.9, 'rgba(200,197,190,.6)'); gr.addColorStop(1, 'rgba(200,197,190,0)'); g.fillStyle = gr; g.beginPath(); g.arc(CIRC.cx, CIRC.cy, 482, 0, 7); g.fill(); TX.ghost = texOf(c); }
  TX.med = new THREE.Texture(mimg); TX.med.needsUpdate = true;
  TX.paper = texOf(texPaper(5, '#ffffff'), true); TX.paperG = texOf(texPaper(9, '#ffffff'), true);
  TX.script = texOf(texScript(cimg), true);
  TX.arrow = texOf(drawArrow()); TX.hole = texOf(drawHole()); TX.shadow = texOf(drawShadow());
  TX.syl = ['FE', 'NO', 'ME', 'NAL'].map(s => texOf(drawSyll(s, false))); TX.sylR = ['FE', 'NO', 'ME', 'NAL'].map(s => texOf(drawSyll(s, true)));
  buildGround(); buildPath(); buildBubble(); buildScenery(); buildParticles();
  G.state = 'title'; G.sceneOk = true; readyCheck();
  const nl = (LYR = await Vers.load('versuri.txt')).length;
  $('status').textContent = nl ? '' : 'Fără versuri (lipsește versuri.txt)';
}
syncOpts();
requestAnimationFrame(frame);
loadAudio();
boot().catch(e => { console.error(e); $('btnPlay').textContent = 'Eroare la încărcare'; });

/* hooks for automated tests */
window.__fen = { G, N, EV, pathPos, songTime, tap, startFromZero, retryCp, pause, resume, finishGame, get LYR() { return LYR; }, setLyrics(t) { LYR = Vers.parse(t); lastCap = -2; return LYR; }, camera, scene, renderer, PROPS };
})();
