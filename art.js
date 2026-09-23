// ============================================================================
// art.js — hand-tuned procedural pixel art: terrain tiles with autotiling
// (shorelines, road edges, wall faces), decorations, FE-style path arrow,
// cursor, range overlays, type-flavoured battle effects and small icons.
//
// Everything is drawn once into offscreen canvases and cached, so the per
// frame cost is a drawImage per tile.
// ============================================================================
'use strict';
const TILESET = {}; // key ch+variant+frame → canvas (base tiles)
const VARIANTS = 4, WATER_FRAMES = 4;
// Tiles with animation frames (water, cave pools, the bridge's water, lava, swaying flowers).
function tileFrames(ch) { return ch === '~' || ch === 'w' || ch === '=' || ch === 'L' || ch === ',' ? WATER_FRAMES : 1; }
function tileCanvas(w = TILE, h = TILE) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// Mini drawing API bound to an offscreen context.
function painter(g) {
  const P = {
    g,
    R: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
    P: (x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
    H: (x, y, w, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, 1); },
    V: (x, y, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, h | 0); },
    C: (cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    E: (cx, cy, rx, ry, c) => { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    TRI: (x0, y0, w, h, c) => { g.fillStyle = c; for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); g.fillRect(x0 + Math.round((w - ww) / 2), y0 + j, ww, 1); } },
    // Stamp a pixel map (array of strings) with a char→color palette; '.' is transparent.
    S: (x, y, rows, pal) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue; const c = pal[ch]; if (!c) continue; g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } },
    // Outline the opaque pixels of the canvas (1px, only where transparent neighbours exist).
    CLEAR: (x, y, w, h) => g.clearRect(x, y, w, h),
  };
  return P;
}
// ---------------------------------------------------------------- palette (hue-shifted ramps)
const PAL = {
  grass: { dd: '#347436', d: '#4a9a40', dm: '#5aae47', m: '#63b84c', l: '#7ecf5e', ll: '#a3e07c' },
  tall: { dd: '#2b6a32', d: '#3f8a3c', m: '#54a646', l: '#74c45c', ll: '#9ad878' },
  trunk: { d: '#4a2c16', m: '#7a4f2c', l: '#a0703e' },
  rock: { dd: '#463c46', d: '#665858', m: '#8a7c74', l: '#ada090', ll: '#cfc4b2', out: '#2e2630' },
  snow: { d: '#b9c9de', m: '#e2eaf4', l: '#f8fafd' },
  cliff: { dd: '#3a333c', d: '#55494e', m: '#6f625f', l: '#8b7d74', ll: '#a89a8c' },
  water: { dd: '#1e4b96', d: '#2a66c0', m: '#3b87e0', l: '#62acf0', ll: '#a2d8ff', foam: '#edf9ff' },
  cwater: { dd: '#122448', d: '#1b396a', m: '#264d88', l: '#3a6ba8', ll: '#6c9bd4', foam: '#b8d6f4' },
  road: { d: '#b08f5a', m: '#ccae78', l: '#dec792', ll: '#ecdcaa', earth: '#8a6638', earthD: '#5c4224' },
  sand: { d: '#cfb266', m: '#e6cf86', l: '#f2e2a4', ll: '#fbf0c6' },
  cave: { dd: '#382e40', d: '#4a3f54', dm: '#54485e', m: '#5c5066', l: '#6e6278', ll: '#867a90' },
  cwall: { top: '#26202e', topL: '#332b3c', face: '#3a3044', faceL: '#52465c', faceLL: '#6a5e74', faceD: '#221b28', out: '#120e16' },
  floor: { d: '#7a7286', m: '#8f889a', l: '#a29bad', ll: '#b8b2c0', grout: '#5e566a', plate: '#6f6880' },
  bwall: { top: '#34334a', topL: '#43425c', face: '#4c4a64', faceL: '#5e5c78', faceLL: '#72708c', mortar: '#2e2d42', out: '#1a1a28' },
  lava: { dd: '#4e1206', d: '#96260c', m: '#e04e1a', l: '#ff8a2c', ll: '#ffd25a', w: '#fff5c0' },
  ice: { d: '#8cc2e2', m: '#bde4f8', l: '#dcf2ff', ll: '#ffffff' },
  plank: { d: '#845430', m: '#b47f48', l: '#d2a266', ll: '#e8c088', nail: '#4e3220' },
  metal: { d: '#4a4a58', m: '#7a7a8a', l: '#a8a8b8', ll: '#d8d8e4' },
  out: '#1a2418', outW: '#2a1a10',
};
// Which terrain ids count as "grassy land" for edge blending.
const GRASSY = new Set(['plain', 'flower', 'tall', 'forest', 'mountain', 'center', 'hq', 'gym', 'house']);
const OPEN = new Set(['plain', 'flower', 'tall', 'road', 'sand', 'cave', 'floor', 'snow', 'ice', 'bridge', 'rubble', 'crate', 'forest', 'mountain', 'center', 'hq', 'gym', 'water', 'lava']);
const LIQUID = new Set(['water', 'lava']);

// Complete terrain tiles drawn by ImageGen, cropped from its four-state sheet.
// Rendering state only: never changes terrain rules, unit positions, saves or RNG.
const TALL_ART = { ready: false, started: false, base: null, front: null, sheets: null, cache: new Map(), map: null, time: 0, occupied: new Set(), states: new Map(), enabled: new URLSearchParams(location.search).get('terrain') !== 'classic', imagegen: new URLSearchParams(location.search).get('terrain') === 'imagegen' };
// Tall grass is drawn here as a sheet per variant with the same layout as the ImageGen sheet (columns: four frames;
// rows: idle, rustle, occupied, recover) plus a foreground layer holding the front row of blades that a Pokémon stands
// behind. `?terrain=imagegen` loads the earlier ImageGen sheet instead; `?terrain=classic` keeps the static tile.
const TALL_T = { dd: '#1a4424', d: '#2a6630', g: '#347a36', m: '#3d8a3c', l: '#58a84a', ll: '#7cc45e', hi: '#a6dc7c' };
function tallClump(p, cx, by, sc, sway, push) {
  const T = TALL_T, buf = new Map(), put = (x, y, c) => buf.set(x + ',' + y, c);
  const blades = [[-4, 6, -2.4], [-2, 9, -1.1], [0, 11, .3], [2, 9, 1.4], [4, 6, 2.6]];
  for (const [dx, h0, lean0] of blades) {
    const h = Math.max(2, Math.round(h0 * sc)), lean = lean0 * (sc < .7 ? 1.7 : 1) + sway + (dx ? Math.sign(dx) : 0) * push;
    for (let j = 0; j < h; j++) { const t = j / Math.max(1, h - 1), x = cx + dx + Math.round(lean * t * t), y = by - j; put(x, y, j >= h - 1 ? T.hi : j >= h - 3 ? T.ll : j < 2 ? T.m : T.l); if (j < h - 2) put(x + 1, y, j < 2 ? T.d : T.m); }
  }
  for (const k of buf.keys()) { const [x, y] = k.split(',').map(Number); for (const [ax, ay] of [[1, 0], [-1, 0], [0, -1]]) if (!buf.has((x + ax) + ',' + (y + ay)) && y + ay <= by) p.P(x + ax, y + ay, T.dd); }
  for (const [k, c] of buf) { const [x, y] = k.split(',').map(Number); p.P(x, y, c); }
  p.H(cx - 4, by + 1, 10, T.d);
}
function drawTallGrass(p, v, state, frame, front) {
  const T = TALL_T, R = mulberry32(v * 7919 + 17), jit = () => Math.round((R() - .5) * 2.4);
  if (!front) { p.R(0, 0, 32, 32, T.g); for (let i = 0; i < 7; i++) { const x = Math.floor(R() * 30), y = Math.floor(R() * 30); p.H(x, y, 2, T.d); } }
  const clumps = [[5 + jit(), 12 + jit(), .78, 0], [16 + jit(), 11, .9, 0], [27 + jit(), 12 + jit(), .78, 0], [10 + jit(), 28, 1, 1], [22 + jit(), 28, 1, 1]];
  const sway = state === 1 ? [2.2, -2, 1.4, -1][frame] : state === 3 ? [-1.2, .9, -.5, .2][frame] : [0, .8, 0, -.8][(frame + v) % 4];
  for (const [cx, by, sc, row] of clumps) {
    if (front && !row) continue; const center = Math.abs(cx - 16) <= 7; let hk = 1, push = 0;
    if (center && state === 2) { hk = .5; push = 1.6; } else if (center && state === 3) hk = [.6, .72, .85, .95][frame]; else if (center && state === 1) hk = [.82, .9, .86, .94][frame];
    tallClump(p, cx, by, sc * hk, center && state === 2 ? sway * .4 : sway, push);
  }
  if (front) p.CLEAR(0, 0, 32, 25);
}
function buildTallGrassSheets() {
  TALL_ART.sheets = [];
  for (let v = 0; v < VARIANTS; v++) {
    const base = tileCanvas(128, 128), front = tileCanvas(128, 128);
    for (const [cv, fg] of [[base, false], [front, true]]) { const g = cv.getContext('2d'); for (let st = 0; st < 4; st++) for (let f = 0; f < 4; f++) { g.save(); g.translate(f * 32, st * 32); drawTallGrass(painter(g), v, st, f, fg); g.restore(); } }
    TALL_ART.sheets.push({ base, front });
  }
  TALL_ART.ready = true;
}
function loadTallTerrainSprites() {
  if (TALL_ART.started || !TALL_ART.enabled) return; TALL_ART.started = true;
  if (!TALL_ART.imagegen) { buildTallGrassSheets(); return; }
  let loaded = 0;
  for (const [part, name] of [['base', 'imagegen-tall-grass-v2.png'], ['front', 'imagegen-tall-grass-front-v2.png']]) {
    const img = new Image();
    img.onload = () => { if (img.naturalWidth !== 128 || img.naturalHeight !== 128) return; TALL_ART[part] = img; if (++loaded === 2) TALL_ART.ready = true; };
    // The existing procedural tile remains available while loading or if an asset is missing.
    img.src = 'assets/terrain/' + name;
  }
}
function tallTerrainImg(variant, state, frame, foreground = false) {
  if (!TALL_ART.ready || !TALL_ART.enabled) return null;
  const f = frame % 4, sh = TALL_ART.sheets ? TALL_ART.sheets[(variant || 0) % TALL_ART.sheets.length] : TALL_ART, key = [TALL_ART.sheets ? variant % TALL_ART.sheets.length : 0, state, f, foreground ? 1 : 0].join(':');
  let c = TALL_ART.cache.get(key); if (c) return c;
  c = tileCanvas(); const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(foreground ? sh.front : sh.base, f * 32, state * 32, 32, 32, 0, 0, 32, 32);
  TALL_ART.cache.set(key, c); return c;
}
function tallUnitCell(u, m) {
  if (!u || u.hp <= 0 || (u.fx && u.fx.alpha <= 0)) return null;
  const x = Math.floor(u.x + (u.fx ? u.fx.dx : 0) / TILE + .5), y = Math.floor(u.y + (u.fx ? u.fx.dy : 0) / TILE + .5);
  return x >= 0 && y >= 0 && x < m.w && y < m.h && m.tiles[y][x].id === 'tall' ? { x, y } : null;
}
function updateTallTerrain(battle, time) {
  if (!TALL_ART.ready || !TALL_ART.enabled) return;
  const m = battle.map, initial = TALL_ART.map !== m || time < TALL_ART.time;
  if (initial) { TALL_ART.map = m; TALL_ART.occupied.clear(); TALL_ART.states.clear(); }
  TALL_ART.time = time;
  const current = new Set();
  for (const u of battle.units) {
    if (fogHides(u, HT())) continue; // Hidden units must not reveal themselves through the grass.
    const cell = tallUnitCell(u, m); if (cell) current.add(key(cell.x, cell.y));
  }
  for (const k of current) if (!TALL_ART.occupied.has(k)) TALL_ART.states.set(k, { state: initial || REDUCED ? 2 : 1, since: time });
  for (const k of TALL_ART.occupied) if (!current.has(k)) {
    if (REDUCED) TALL_ART.states.delete(k); else TALL_ART.states.set(k, { state: 3, since: time });
  }
  for (const [k, s] of TALL_ART.states) {
    if (s.state === 1 && time - s.since >= .44) TALL_ART.states.set(k, { state: 2, since: time });
    else if (s.state === 3 && time - s.since >= .56) TALL_ART.states.delete(k);
  }
  TALL_ART.occupied = current;
}
function tallTerrainPose(x, y, variant, time) {
  const s = TALL_ART.states.get(key(x, y)), state = s ? s.state : 0;
  const frame = REDUCED ? 0 : state === 1 || state === 3 ? Math.min(3, Math.floor((time - s.since) / (state === 1 ? .11 : .14))) : (Math.floor(time / .24) + variant) % 4;
  return { state, frame: Math.max(0, frame) };
}
function drawTallTerrainForeground(g, m, x, y, X, Y, time) {
  if (!TALL_ART.ready || !TALL_ART.enabled) return;
  const v = m.variants[y][x], pose = tallTerrainPose(x, y, v, time), img = tallTerrainImg(v, pose.state, pose.frame, true);
  g.save(); g.globalAlpha = 1; g.drawImage(img, X, Y); g.restore();
}

// ---------------------------------------------------------------- shared stamps
const ST = {
  crownGold: ['O.O.O', 'OYOYO', 'OYYYO', 'OOOOO'],
  skull: ['.OOO.', 'OWWWO', 'OWOWO', 'OWWWO', '.OWO.', '.OOO.'],
  hand: ['..OO....', '.OWWO...', '.OWWOOO.', 'OOWWWWWO', 'OWWWWWWO', 'OWWWWWWO', '.OWWWWO.', '..OOOO..'],
  heart: ['.P.P.', 'PLPPP', 'PPPPP', '.PPP.', '..P..'],
};

// ---------------------------------------------------------------- tile painting helpers
// Ordered dithering (4×4 Bayer) for soft transitions between two tones of a ramp.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dith(x, y) { return (BAYER4[(y & 3) * 4 + (x & 3)] + .5) / 16; }
// Pick a ramp colour for a light value in 0..1: flat bands with a narrow dithered seam between neighbours.
function rampAt(ramp, v, x, y, seam = .26) { const n = ramp.length, f = clamp(v, 0, .999) * n, i = Math.floor(f), fr = f - i; let k = i; if (fr > 1 - seam / 2 && dith(x, y) < (fr - (1 - seam / 2)) / seam) k++; else if (fr < seam / 2 && dith(x, y) < (seam / 2 - fr) / seam) k--; return ramp[clamp(k, 0, n - 1)]; }
// A union of ellipses shaded as soft volumes lit from the upper left (ramp: darkest → lightest), outlined with `out`.
// Later blobs sit in front of earlier ones; the seam where a front blob turns away from the light separates them.
function shadeBlobs(p, blobs, ramp, out, opt = {}) {
  const lx = -.52, ly = -.68, lz = .52, bias = opt.bias || 0, gain = opt.gain || 1;
  let x0 = 1e3, y0 = 1e3, x1 = -1e3, y1 = -1e3; for (const b of blobs) { x0 = Math.min(x0, Math.floor(b.x - b.rx) - 1); y0 = Math.min(y0, Math.floor(b.y - b.ry) - 1); x1 = Math.max(x1, Math.ceil(b.x + b.rx) + 1); y1 = Math.max(y1, Math.ceil(b.y + b.ry) + 1); }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, mask = new Int16Array(W * H).fill(-1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let i = blobs.length - 1; i >= 0; i--) { const b = blobs[i], dx = (x + .5 - b.x) / b.rx, dy = (y + .5 - b.y) / b.ry; if (dx * dx + dy * dy <= 1) { mask[(y - y0) * W + x - x0] = i; break; } }
  const at = (x, y) => x >= x0 && y >= y0 && x <= x1 && y <= y1 ? mask[(y - y0) * W + x - x0] : -1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = at(x, y);
    if (i < 0) { if (out && (at(x - 1, y) >= 0 || at(x + 1, y) >= 0 || at(x, y - 1) >= 0 || at(x, y + 1) >= 0)) p.P(x, y, out); continue; }
    const b = blobs[i], nx = (x + .5 - b.x) / b.rx, ny = (y + .5 - b.y) / b.ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = (nx * lx + ny * ly + nz * lz) * gain + bias; p.P(x, y, rampAt(ramp, (l + 1) / 2, x, y));
  }
  return at;
}
// A soft dithered ground shadow (drawn on the tile under an object), darker in the middle.
function groundShadow(p, cx, cy, rx, ry, col, dens = .55) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d > 1) continue; if (d < .45 || dith(cx + x, cy + y) < dens * (1 - d) * 1.6) p.P(cx + x, cy + y, col); } }
// Hand-tuned ramps (dark → light), hue shifted: shadows lean blue, lights lean yellow.
const RAMP = {
  leaf: ['#123822', '#1c4e2e', '#276638', '#367f41', '#4d9a48', '#6db656', '#94d06a'],
  leafOut: '#0c2a1a',
  pine: ['#0f3326', '#17463a', '#215a40', '#2e7148', '#428a52', '#62a660'],
  rock: ['#3a3040', '#524654', '#6d6068', '#8a7c7c', '#a89a8e', '#c8bca8', '#e4dac4'],
  rockOut: '#241c28',
  snow: ['#8e9cc0', '#aab8d6', '#c8d4ea', '#e4ecf8', '#ffffff'],
  crock: ['#221c28', '#342c3c', '#483e52', '#5e5268', '#76687e', '#908298', '#b0a4b6'], crockOut: '#15111a',
  wallTop: ['#16121a', '#1c1722', '#231d2a', '#2b2433', '#342c3d'],
  steel: ['#262632', '#3c3c4a', '#565666', '#747486', '#9496a8', '#babccc', '#e2e4ee'],
  crust: ['#140404', '#240806', '#3a0e08', '#58180c', '#7a2a12'],
};
// ---------------------------------------------------------------- building kit
// Buildings in the board's three-quarter view, shared by the map tiles and the battle-screen towns: a hip roof of
// shingle rows over walls shaded under the eaves, framed windows, panelled doors, flags and chimneys, in a warm outline.
const BOUT = '#23150f';
function bldRoof(p, x0, w, top, eave, R, hip = 4) {
  for (let y = top; y <= eave; y++) { const t = (y - top) / Math.max(1, eave - top), inset = Math.round((1 - t) * hip), xs = x0 - 2 + inset, xe = x0 + w + 1 - inset, band = (y - top) % 3, row = Math.floor((y - top) / 3);
    for (let x = xs; x <= xe; x++) { let c = band === 0 ? R[4] : band === 1 ? R[3] : R[2]; if (band === 1 && (x + row * 2) % 4 === 0) c = R[2]; if (x <= xs + 1 && band !== 2) c = R[5]; if (x >= xe - 1) c = band === 0 ? R[3] : R[1]; p.P(x, y, c); }
    p.P(xs - 1, y, R[0]); p.P(xe + 1, y, R[0]); }
  p.H(x0 - 2 + hip, top - 1, w + 4 - 2 * hip, R[0]); p.H(x0 - 1 + hip, top, w + 2 - 2 * hip, R[5]);
  p.H(x0 - 3, eave + 1, w + 6, R[0]); p.H(x0 - 2, eave, w + 4, R[1]); p.P(x0 - 2, eave, R[0]); p.P(x0 + w + 1, eave, R[0]);
}
function bldWalls(p, x0, w, y0, y1, W, planks = true) {
  p.R(x0 - 1, y0, w + 2, y1 - y0 + 1, BOUT); p.R(x0, y0, w, y1 - y0, W[2]);
  if (planks) for (let y = y0 + 3; y < y1 - 1; y += 3) p.H(x0, y, w, W[0]);
  p.V(x0, y0, y1 - y0, W[3]); p.V(x0 + w - 1, y0, y1 - y0, W[1]); p.H(x0, y0, w, W[1]); p.H(x0, y0 + 1, w, mix(W[2], W[1], .5));
  p.H(x0, y1 - 2, w, '#8a8290'); p.H(x0, y1 - 1, w, '#5e5866'); p.H(x0, y1 - 2, 1, '#aaa2ae');
}
// 6×6 framed window with a cross, a sky reflection and an optional flower box
function bldWin(p, x, y, lit, box) { const G = PAL.grass;
  p.R(x - 1, y - 1, 8, 8, BOUT); p.R(x, y, 6, 6, '#f4ecd8'); p.R(x + 1, y + 1, 4, 4, lit ? '#ffe28a' : '#7cc0f0'); p.P(x + 1, y + 1, '#ffffff'); p.P(x + 2, y + 1, lit ? '#fff4c0' : '#c8ecff'); p.R(x + 3, y + 3, 2, 2, lit ? '#f0b040' : '#4a8ed0'); p.V(x + 3, y + 1, 4, '#d8ccb0'); p.H(x + 1, y + 3, 4, '#d8ccb0');
  if (box) { p.R(x - 1, y + 6, 8, 3, BOUT); p.R(x, y + 7, 6, 1, '#8a5a30'); p.P(x, y + 6, '#e04848'); p.P(x + 2, y + 6, '#ffd24a'); p.P(x + 4, y + 6, '#ff8ac0'); p.P(x + 1, y + 6, G.l); p.P(x + 3, y + 6, G.l); p.P(x + 5, y + 6, G.l); }
}
// Panelled door in a frame, a brass knob, a stone step
function bldDoor(p, x, y, w, h, col, step = true) {
  p.R(x - 1, y - 1, w + 2, h + 1, BOUT); p.R(x, y, w, h, col); p.V(x, y, h, shade(col, .22)); p.H(x, y, w, shade(col, .3)); p.V(x + w - 1, y, h, shade(col, -.3));
  p.R(x + 1, y + 2, w - 3, 2, shade(col, -.18)); if (h > 6) p.R(x + 1, y + 5, w - 3, 2, shade(col, -.18)); p.P(x + w - 2, y + Math.floor(h / 2) + 1, '#ffd24a');
  if (step) { p.R(x - 2, y + h, w + 4, 2, '#b8b0a4'); p.H(x - 2, y + h, w + 4, '#dcd4c8'); p.H(x - 2, y + h + 2, w + 4, '#5e5866'); }
}
function bldGlassDoor(p, x, y, w, h) { p.R(x - 1, y - 1, w + 2, h + 1, BOUT); p.R(x, y, w, h, '#5a8ec8'); p.R(x + 1, y + 1, w - 2, h - 1, '#8ccaf4'); p.V(x + (w >> 1), y, h, '#3a5a80'); for (let i = 0; i < 3; i++) p.P(x + 2 + i, y + 2 + i, '#e8f8ff'); p.P(x + (w >> 1) + 2, y + 2, '#e8f8ff'); p.R(x - 2, y + h, w + 4, 2, '#d84040'); p.H(x - 2, y + h, w + 4, '#ff7a6a'); p.H(x - 2, y + h + 2, w + 4, '#5e5866'); }
function bldFlag(p, x, y, col) { p.V(x, y, 9, '#e8e0d0'); p.V(x + 1, y + 1, 8, '#8a8290'); p.P(x, y - 1, '#ffd24a'); p.R(x + 1, y, 6, 4, col); p.H(x + 1, y, 6, shade(col, .35)); p.H(x + 1, y + 3, 6, shade(col, -.35)); p.P(x + 7, y + 1, col); p.P(x + 7, y + 2, shade(col, -.2)); }
function bldChimney(p, x, y) { p.R(x - 1, y - 1, 6, 8, BOUT); p.R(x, y, 4, 7, '#a0584a'); p.V(x, y, 7, '#c07262'); p.V(x + 3, y, 7, '#6a3a30'); p.H(x, y + 3, 4, '#6a3a30'); p.R(x - 1, y - 2, 6, 2, '#5e5866'); p.H(x - 1, y - 2, 6, '#8a8290'); }
// ---------------------------------------------------------------- terrain bases
// Roof colours of a capturable building by owner (Territory): neutral grey, the player's blue, the enemy's red; a plain
// Poké Center keeps its classic red roof. [roof, roofD, roofL, flag]
const ROOFS = { none: ['#e04848', '#a82c2c', '#ff6a60', null], n: ['#a8a8b4', '#70707c', '#cfcfd8', '#d8d8e0'], 0: ['#3f6fd6', '#2a4a9a', '#5f8ff0', '#3d7dff'], 1: ['#e04848', '#a82c2c', '#ff6a60', '#ff4b4b'] };
// Roof ramps for the buildings (outline, darkest … highlight), by owner and by house style.
const ROOF_RAMP = {
  red: ['#3a0e12', '#7a1c20', '#a82c2c', '#d23e3a', '#ee5e4e', '#ff9a80'], grey: ['#22222a', '#4a4a56', '#62626e', '#7c7c8a', '#9c9caa', '#c8c8d4'],
  blue: ['#121a34', '#24325e', '#324680', '#445ea2', '#5c7ec4', '#8aaae4'], brown: ['#2a160c', '#5a3420', '#7a4a2c', '#9a6038', '#b87a48', '#dca474'],
  green: ['#10261a', '#22462c', '#2e5e38', '#3c7844', '#56965a', '#84bc7c'], plum: ['#34121e', '#642840', '#843854', '#a44a68', '#c46a86', '#e89cb0'],
  slate: ['#0e1828', '#203250', '#2c446c', '#3a5888', '#5074a6', '#7c9cca'],
};
function ownerRoof(owner) { return owner == null ? ROOF_RAMP.red : owner < 0 ? ROOF_RAMP.grey : owner === 0 ? ROOF_RAMP.blue : ROOF_RAMP.red; }
function drawTile(ch, variant, frame, g, owner = null) {
  const RF = ROOFS[owner == null ? 'none' : owner < 0 ? 'n' : owner], RR = ownerRoof(owner);
  const p = painter(g), r = mulberry32(ch.charCodeAt(0) * 977 + variant * 131 + 7); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const G = PAL.grass;
  // Grass: flat base, one soft darker patch, a few light tufts on a jittered grid, a rare darker tuft.
  // Kept sparse and low-contrast so a field of it reads as one calm surface under the Pokémon.
  // A soft patch with a dithered rim, kept inside the tile so a neighbour never cuts it.
  const patch = (cx, cy, rx, ry, c, soft = 1.8) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d > 1) continue; if (d < .5 || dith(cx + x, cy + y) < (1 - d) * soft) p.P(cx + x, cy + y, c); } };
  const pebble = (x, y) => { const R = PAL.rock; p.P(x, y + 2, G.d); p.H(x + 1, y + 2, 3, G.dm); p.R(x, y, 3, 2, R.l); p.P(x, y, R.ll); p.P(x + 1, y, R.ll); p.P(x + 2, y + 1, R.d); p.P(x + 3, y + 1, G.d); };
  const clover = (x, y) => { p.P(x, y, '#ffffff'); p.P(x + 1, y, '#e4ecf4'); p.P(x, y + 1, '#dce4ee'); p.P(x + 1, y + 1, G.d); };
  // Grass: flat base, a darker and a lighter patch, blade tufts on a jittered grid (dark roots, light tips), a rare pebble or
  // clover. Kept low-contrast so a field of it reads as one calm surface under the Pokémon.
  const grassBase = (tone = 0) => {
    p.R(0, 0, 32, 32, G.m);
    patch(rr(9, 22), rr(8, 23), rr(6, 8), rr(3, 4), G.dm);
    if (r() < .7) patch(rr(8, 24), rr(7, 24), rr(3, 5), 2, mix(G.m, G.l, .4), 1.4);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const k = r(); if (k < .4) continue; const x = i * 8 + rr(0, 4), y = j * 8 + rr(1, 5);
      if (k < .72) { p.P(x, y, G.l); p.P(x + 2, y, G.l); p.P(x + 1, y + 1, G.d); p.P(x, y + 1, G.dm); p.P(x + 2, y + 1, G.dm); }
      else if (k < .9) { p.P(x + 1, y - 1, G.ll); p.P(x + 1, y, G.l); p.P(x, y + 1, G.dm); p.P(x + 1, y + 1, G.d); }
      else { p.P(x, y, G.dm); p.P(x + 1, y + 1, G.d); p.P(x + 2, y, G.dm); } }
    if (tone === 0 && variant === 3 && r() < .6) pebble(rr(3, 25), rr(4, 25));
    if (tone === 0 && variant === 1 && r() < .5) clover(rr(3, 27), rr(3, 27));
  };
  // Cave floor: packed rock with a darker and a lighter patch, hairline cracks lit on their lower lip, shaded pebbles,
  // grit, and in one variant a small cluster of glowing crystals.
  const caveBase = () => {
    const C = PAL.cave; p.R(0, 0, 32, 32, C.m);
    patch(rr(9, 22), rr(8, 23), rr(5, 8), rr(3, 4), C.dm); if (r() < .6) patch(rr(8, 24), rr(8, 24), rr(3, 5), 2, mix(C.m, C.l, .5), 1.3);
    for (let i = 0; i < 1 + (variant & 1); i++) { let x = rr(2, 22), y = rr(3, 27); const len = rr(5, 9); for (let k = 0; k < len && x < 31; k++) { p.P(x, y, C.dd); p.P(x, y + 1, C.l); x++; if (r() < .35) y += r() < .5 ? -1 : 1; } }
    for (let i = 0; i < 3; i++) { const x = rr(1, 28), y = rr(1, 28); p.P(x, y, C.ll); p.P(x + 1, y, C.l); p.P(x, y + 1, C.l); p.P(x + 1, y + 1, C.dd); p.P(x + 2, y + 1, C.d); }
    for (let i = 0; i < 6; i++) p.P(rr(0, 31), rr(0, 31), r() < .5 ? C.l : C.d);
    if (variant === 3 && r() < .4) { const x = rr(4, 22), y = rr(4, 20); p.E(x + 3, y + 6, 4, 1, C.dd); p.S(x, y, ['...h..', '..hl..', '.hlld.', 'hllddh', '.lldd.', '..dd..'], { h: '#e8fbff', l: '#8ad4f4', d: '#3a78b4' }); }
  };
  // Tiled floor: a 2×2 checker of near-identical tones with a thin grout that sits close to the tile
  // colour, so the grid is a texture rather than a lattice competing with the range overlays and units.
  // Tiled floor: four bevelled tiles in two near-identical tones (lit top-left edge, shaded bottom-right), a soft sheen
  // across the lighter tiles, a scuff now and then; one variant has a vent grille, one a drain.
  const floorBase = () => {
    const F = PAL.floor; const grout = mix(F.m, F.grout, .55); p.R(0, 0, 32, 32, grout);
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      const alt = ((x + y) / 16) % 2; const base = alt ? F.m : mix(F.m, F.l, .45);
      p.R(x + 1, y + 1, 14, 14, base); p.H(x + 1, y + 1, 14, mix(base, F.ll, .5)); p.V(x + 1, y + 1, 14, mix(base, F.ll, .3)); p.H(x + 1, y + 14, 14, mix(base, F.d, .45)); p.V(x + 14, y + 1, 14, mix(base, F.d, .35));
      if (!alt) for (let k = 0; k < 4; k++) { p.P(x + 9 + k, y + 3 + k, mix(base, F.ll, .45)); p.P(x + 10 + k, y + 3 + k, mix(base, F.ll, .25)); }
      if (r() < .25) { const sx = x + rr(3, 10), sy = y + rr(4, 11); p.H(sx, sy, rr(2, 3), mix(base, F.d, .3)); }
    }
    if (variant === 2 && r() < .45) { const P = F.plate; p.R(3, 3, 10, 10, grout); p.R(4, 4, 8, 8, mix(P, F.m, .3)); p.H(4, 4, 8, F.ll); p.V(4, 4, 8, F.l); for (let j = 0; j < 3; j++) { p.H(6, 6 + j * 2, 4, '#3a3444'); p.H(6, 7 + j * 2, 4, F.l); } }
    if (variant === 3 && r() < .3) { p.R(20, 20, 6, 6, '#3a3444'); for (let k = 0; k < 3; k++) p.H(21, 21 + k * 2, 4, F.d); p.H(20, 20, 6, grout); p.H(20, 26, 6, F.ll); }
  };
  // Water: a faint lattice of deeper swells (periodic in 32 px so neighbours join), ripples that bob in place
  // (a light crest over a darker trough) and a sparkle that moves from frame to frame.
  const waterBase = (f, W) => {
    p.R(0, 0, 32, 32, W.m); const w = mulberry32(variant * 5 + 1), ph = f * Math.PI / 2;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 16) * 1.3 + ph * .5); if (v > .82 && dith(x, y) < (v - .82) * 2.2) p.P(x, y, W.d); }
    const bob = [0, 1, 2, 1][f];
    for (let i = 0; i < 4; i++) { const len = 3 + Math.floor(w() * 3), x = 2 + Math.floor(w() * (26 - len)) + (i & 1 ? -bob : bob), y = 2 + i * 8 + Math.floor(w() * 3); p.H(x, y + 1, len, W.d); p.H(x + 1, y, len - 1, W.ll); p.P(x, y, W.l); p.P(x + len, y + 1, W.l); if ((f + i) % 4 === 0) p.P(x + 1, y, W.foam); }
    const sx = Math.floor(w() * 28) + 2, sy = Math.floor(w() * 28) + 2; if (f === 1 || f === 2) { p.P(sx + f, sy, W.foam); if (f === 2) { p.P(sx + f - 1, sy, W.ll); p.P(sx + f + 1, sy, W.ll); p.P(sx + f, sy - 1, W.ll); p.P(sx + f, sy + 1, W.ll); } }
  };
  // Foliage texture over a shaded canopy: bright leaf arcs on the lit side, dark notches on the shadow side.
  const leaves = (at, lobes) => { const L = RAMP.leaf; for (const b of lobes) { const n = Math.max(2, Math.round(b.rx * .7));
    for (let i = 0; i < n; i++) { const a = -2.5 + r() * 1.6, d = .35 + r() * .45, x = Math.round(b.x + Math.cos(a) * b.rx * d), y = Math.round(b.y + Math.sin(a) * b.ry * d); if (at(x, y) >= 0 && at(x + 3, y + 1) >= 0) { p.P(x, y + 1, L[5]); p.H(x + 1, y, 2, L[6]); p.P(x + 3, y + 1, L[5]); } }
    for (let i = 0; i < n; i++) { const a = .2 + r() * 1.5, d = .3 + r() * .5, x = Math.round(b.x + Math.cos(a) * b.rx * d), y = Math.round(b.y + Math.sin(a) * b.ry * d); if (at(x, y) >= 0 && at(x + 2, y + 1) >= 0) { p.P(x, y, L[1]); p.H(x + 1, y + 1, 2, L[1]); } } } };
  // Round tree: shaded canopy lobes with a dark outline and foliage texture, a trunk with a lit side, a soft shadow cast south-east.
  const tree = (cx, cy, rad, fruit = false) => {
    const K = PAL.trunk; const base = cy + Math.round(rad * .8);
    groundShadow(p, cx + 2, base + 3, rad, 3, G.d);
    p.R(cx - 3, base - 2, 6, 6, '#2e1c10'); p.R(cx - 2, base - 2, 4, 5, K.m); p.V(cx - 2, base - 2, 5, K.l); p.V(cx + 1, base - 2, 5, K.d); p.P(cx - 3, base + 3, '#2e1c10'); p.P(cx + 3, base + 3, '#2e1c10');
    const lobes = [{ x: cx, y: cy - rad * .22, rx: rad * .8, ry: rad * .72 }, { x: cx - rad * .46, y: cy + rad * .16, rx: rad * .6, ry: rad * .54 }, { x: cx + rad * .47, y: cy + rad * .14, rx: rad * .58, ry: rad * .52 }, { x: cx + rad * .02, y: cy + rad * .4, rx: rad * .7, ry: rad * .46 }];
    const at = shadeBlobs(p, lobes, RAMP.leaf, RAMP.leafOut, { bias: -.22, gain: 1.15 }); leaves(at, lobes);
    if (fruit) for (const [fx, fy] of [[-.55, .05], [.15, -.45], [.5, .35], [-.1, .5]]) { const x = Math.round(cx + fx * rad), y = Math.round(cy + fy * rad); if (at(x, y) >= 0 && at(x + 1, y + 2) >= 0) { p.P(x, y, '#ff8a70'); p.P(x + 1, y, '#e04848'); p.P(x, y + 1, '#e04848'); p.P(x + 1, y + 1, '#a82c3c'); p.P(x + 1, y - 1, '#5a3a1a'); } }
  };
  const bush = (cx, cy, rad) => { groundShadow(p, cx + 1, cy + rad, rad + 1, 2, G.d); const lobes = [{ x: cx - rad * .3, y: cy, rx: rad * .8, ry: rad * .75 }, { x: cx + rad * .35, y: cy + rad * .1, rx: rad * .72, ry: rad * .68 }]; const at = shadeBlobs(p, lobes, RAMP.leaf.slice(1), RAMP.leafOut, { bias: -.15, gain: 1.1 }); if (rad > 3) leaves(at, lobes); };
  // Pine: stacked needle tiers, lit on the left, with a jagged hem, a dark outline and a short trunk.
  const pine = (cx, by, h) => {
    const K = PAL.trunk, P = RAMP.pine; groundShadow(p, cx + 2, by + 1, Math.round(h * .32), 2, G.d);
    p.R(cx - 2, by - 4, 4, 5, '#2e1c10'); p.R(cx - 1, by - 4, 2, 4, K.m);
    const tiers = [[by - 3, Math.round(h * .5), Math.round(h * .62)], [by - 3 - Math.round(h * .3), Math.round(h * .42), Math.round(h * .5)], [by - 3 - Math.round(h * .56), Math.round(h * .36), Math.round(h * .36)]];
    const cells = new Map(); const put = (x, y, c) => cells.set(x + ',' + y, c);
    for (const [bot, th, w] of tiers) for (let j = 0; j < th; j++) { const y = bot - th + 1 + j, hw = Math.max(0, Math.round((w / 2) * (j + 1) / th)); for (let x = cx - hw; x <= cx + hw; x++) { const rel = (x - cx) / Math.max(1, hw); let v = .78 - rel * .32 - (j / th) * .28; if (j === th - 1 && (x & 1)) v -= .18; put(x, y, rampAt(P, v, x, y)); } if (j === th - 1) for (let x = cx - hw; x <= cx + hw; x += 2) put(x, y + 1, P[1]); }
    for (const [k, c] of cells) { const [x, y] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has((x + dx) + ',' + (y + dy))) p.P(x + dx, y + dy, RAMP.leafOut); }
    for (const [k, c] of cells) { const [x, y] = k.split(',').map(Number); p.P(x, y, c); }
    p.P(cx, tiers[2][0] - tiers[2][1], P[5]);
  };
  // ---- buildings (see the building kit above drawTile); castShadow stays local to the 32 px tile
  const castShadow = (x0, y0, w, h, dens = .7) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < 32 && y < 32 && dith(x, y) < dens) p.P(x, y, G.d); };
  const roof = (...a) => bldRoof(p, ...a), walls = (...a) => bldWalls(p, ...a), win = (...a) => bldWin(p, ...a), door = (...a) => bldDoor(p, ...a);
  const glassDoor = (...a) => bldGlassDoor(p, ...a), flag = (...a) => bldFlag(p, ...a), chimney = (...a) => bldChimney(p, ...a);
  // Crate in three-quarter view: a lit top face, a front of planks with a cross brace, iron corners, a shadow to the east.
  const crate = (x, y, s) => { const K = PAL.plank, top = Math.max(3, Math.round(s * .3)); for (let j = 2; j < s + 2; j++) for (let i = s; i < s + 3; i++) if (dith(x + i, y + j) < .6) p.P(x + i, y + j, mix(PAL.floor.m, PAL.floor.grout, .8));
    p.R(x - 1, y - 1, s + 2, s + 2, PAL.outW); p.R(x, y, s, top, K.l); p.H(x, y, s, K.ll); p.H(x, y + top - 1, s, K.m);
    p.R(x, y + top, s, s - top, K.m); for (let k = y + top + 2; k < y + s - 1; k += 3) p.H(x, k, s, mix(K.m, K.d, .5)); p.V(x, y + top, s - top, K.l); p.V(x + s - 1, y + top, s - top, K.d); p.H(x, y + s - 1, s, K.d);
    const fh = s - top - 2; for (let k = 0; k < fh; k++) { const t = k / Math.max(1, fh - 1); p.P(x + 1 + Math.round(t * (s - 3)), y + top + 1 + k, K.d); p.P(x + s - 2 - Math.round(t * (s - 3)), y + top + 1 + k, K.d); }
    for (const [nx, ny] of [[0, top], [s - 2, top], [0, s - 2], [s - 2, s - 2]]) { p.R(x + nx, y + ny, 2, 2, PAL.metal.m); p.P(x + nx, y + ny, PAL.metal.ll); } };

  switch (ch) {
    case '.': grassBase(); break;
    case ',': { grassBase(1); const fam = [['#f05a5a', '#ffb0a0', '#a82c3c'], ['#ffffff', '#ffffff', '#b8c4dc'], ['#ffd83a', '#fff0a0', '#c88a1a'], ['#ff8ac0', '#ffd0e4', '#b04a80']][variant];
      // a small cluster: four-petal flowers with a warm centre, a shaded lower petal and a leaf, never cut by the tile edge
      const spots = [[6, 6], [19, 5], [25, 15], [11, 17], [22, 25], [6, 25]]; for (let i = 0; i < spots.length; i++) { if (r() < .4) continue; const x = spots[i][0] + rr(-2, 2), y = spots[i][1] + rr(-2, 2);
        const bloom = (x, y) => { const sw = [0, 1, 0, 0][(frame + i + variant) % 4]; p.P(x - 1, y + 3, G.l); p.P(x + 2, y + 3, G.l); p.H(x, y + 3, 2, G.d); p.P(x + 1, y + 4, G.dd); p.S(x - 2 + sw, y - 2, ['..H..', '.HHP.', 'HHYPP', '.PPD.', '..D..'], { H: fam[1], P: fam[0], D: fam[2], Y: '#ffd24a' }); };
        bloom(x, y); if (r() < .45) bloom(x + 4 + rr(0, 1), y + 3 + rr(0, 1)); }
      break; }
    case 't': { const T = PAL.tall; p.R(0, 0, 32, 32, T.m); for (let i = 0; i < 2; i++) { const x = rr(-4, 26), y = rr(-2, 26); p.E(x + 6, y + 3, 6, 3, T.d); }
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 8 + (j & 1) * 4 + rr(-1, 1), y = j * 8 + rr(0, 1);
        // a tuft: three blades, dark roots, a slightly lighter tip. Dense enough to read as tall grass
        // (an evasion tile), light on contrast so a big field stays calm behind the units.
        p.S(x, y, ['..H..', 'L.L.L', '.LDL.', '.D.D.'], { H: T.l, L: mix(T.m, T.l, .55), D: mix(T.m, T.dd, .7) }); } break; }
    case 'T': grassBase(1); if (variant === 0) { tree(15, 12, 12); bush(27, 27, 4); } else if (variant === 1) { tree(10, 10, 10); tree(23, 17, 10); } else if (variant === 2) { tree(16, 13, 13, r() < .45); } else { pine(20, 29, 28); bush(7, 25, 5); } break;
    // Mountain: a shaded peak (lit west face, shadowed east face split by the ridge), crevices, a snow cap with a
    // jagged hem, an outline, boulders and tufts at the foot; odd variants have a smaller peak behind.
    case 'M': grassBase(1); { const R = RAMP.rock, SN = RAMP.snow;
      const peak = (px, py, bw, by) => {
        const cells = new Map(), snowAt = x => 5 + ((x * 7 + px) % 3) + (x % 4 === 0 ? 1 : 0);
        for (let y = py; y <= by; y++) { const t = (y - py) / Math.max(1, by - py), hw = Math.max(0, Math.round(bw / 2 * Math.pow(t, .8) + (t > .3 ? Math.sin(t * 8 + px) * .9 : 0))), ridge = px + Math.round((y - py) * .2);
          for (let x = px - hw; x <= px + hw; x++) { const lit = x <= ridge, d = lit ? (ridge - x) / Math.max(1, hw) : (x - ridge) / Math.max(1, hw); let v = lit ? .8 - t * .32 - d * .12 : .4 - t * .2 - d * .1;
            if (y < py + snowAt(x)) { cells.set(x + ',' + y, lit ? (d > .6 && y > py + 3 ? SN[3] : SN[4]) : (d > .5 ? SN[1] : SN[2])); continue; }
            if (y === py + snowAt(x)) v -= .12; cells.set(x + ',' + y, rampAt(R, v, x, y)); } }
        for (const k of cells.keys()) { const [x, y] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) if (!cells.has((x + dx) + ',' + (y + dy))) p.P(x + dx, y + dy, RAMP.rockOut); }
        for (const [k, c] of cells) { const [x, y] = k.split(',').map(Number); p.P(x, y, c); }
        // crevices running down each face
        for (let i = 0; i < 3; i++) { const sy = py + 9 + i * 5, sx = px + Math.round((sy - py) * .2); for (let j = 0; j < 4; j++) { const x = sx - 2 - j - i, y = sy + j; if (cells.has(x + ',' + y)) { p.P(x, y, R[2]); if (cells.has(x + ',' + (y - 1))) p.P(x, y - 1, R[5]); } const x2 = sx + 3 + j, y2 = sy + 1 + j; if (cells.has(x2 + ',' + y2)) p.P(x2, y2, R[0]); } }
      };
      groundShadow(p, 18, 29, 14, 2, G.d);
      if (variant & 1) peak(variant === 1 ? 8 : 24, 9, 16, 28);
      peak(variant === 3 ? 13 : 17, 2 + (variant >> 1), 28, 29);
      const rock = (x, y, w, h) => shadeBlobs(p, [{ x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2 }], R, RAMP.rockOut, { bias: -.05 });
      rock(1, 25, 6, 4); rock(25, 24, 6, 5); p.S(8, 27, ['L.L', '.D.'], { L: G.l, D: G.d }); p.S(21, 28, ['L.L', '.D.'], { L: G.l, D: G.d }); } break;
    // Cliff top: stone slabs with a lit bevel and a shaded lip, dark cracks between them, moss and pebbles in the joints.
    case '^': { const C = PAL.cliff; p.R(0, 0, 32, 32, C.d); for (let i = 0; i < 6; i++) { const x = rr(-3, 22), y = rr(-3, 22), w = rr(8, 13), h = rr(6, 10); p.R(x, y, w, h, C.dd); p.R(x, y, w - 1, h - 1, i % 2 ? C.m : C.l); p.H(x, y, w - 1, C.ll); p.V(x, y, h - 1, mix(C.l, C.ll, .5)); p.H(x + 1, y + h - 2, w - 2, C.d); p.V(x + w - 2, y + 1, h - 2, C.d); if (r() < .5) { p.P(x + 2 + rr(0, w - 5), y + 2 + rr(0, h - 5), C.d); } }
      for (let i = 0; i < 3; i++) { const x = rr(0, 26), y = rr(0, 30); p.H(x, y, rr(2, 5), '#2c262e'); }
      for (let i = 0; i < 1 + (variant & 1); i++) { const x = rr(2, 26), y = rr(2, 28); p.H(x, y, 4, PAL.grass.d); p.H(x + 1, y - 1, 2, PAL.grass.l); p.P(x + 4, y, PAL.grass.dd); } break; }
    case '~': waterBase(frame, PAL.water); break;
    case 'w': waterBase(frame, PAL.cwater); break;
    // Bridge: planks with a lit edge, grain and nails over the water, a shadow on the water below, railings on posts.
    case '=': { waterBase(frame, PAL.water); const K = PAL.plank; p.H(0, 29, 32, PAL.water.dd); p.H(0, 30, 32, PAL.water.d);
      p.R(0, 4, 32, 24, '#3a2414');
      for (let x = 0; x < 32; x += 4) { const g = mulberry32(x * 13 + variant); p.R(x, 5, 3, 22, K.m); p.V(x, 5, 22, K.l); p.V(x + 2, 5, 22, K.d); p.P(x + 1, 6, K.ll); if (g() < .5) { const y = 9 + Math.floor(g() * 14); p.P(x + 1, y, K.d); p.P(x + 1, y + 1, mix(K.m, K.d, .5)); } p.P(x + 1, 7, K.nail); p.P(x + 1, 24, K.nail); }
      p.H(0, 4, 32, K.ll); p.H(0, 27, 32, K.d); p.H(0, 28, 32, PAL.outW); p.H(0, 3, 32, PAL.outW);
      for (const ry of [0, 26]) { p.H(0, ry + 1, 32, K.ll); p.H(0, ry + 2, 32, K.m); p.H(0, ry + 3, 32, K.d); for (let x = 3; x < 32; x += 8) { p.R(x - 1, ry, 4, 6, PAL.outW); p.R(x, ry, 2, 5, K.l); p.P(x, ry, K.ll); p.V(x + 1, ry + 1, 4, K.d); } } break; }
    // Dirt road: packed earth with lighter worn patches, darker grit and a few shaded stones.
    case '#': { const R = PAL.road; p.R(0, 0, 32, 32, R.m); patch(rr(8, 23), rr(7, 24), rr(5, 8), rr(2, 3), R.l, 1.5); if (r() < .6) patch(rr(7, 24), rr(7, 24), rr(3, 5), 2, mix(R.m, R.d, .35), 1.3);
      for (let i = 0; i < 7; i++) { const x = rr(1, 30), y = rr(1, 30); p.P(x, y, r() < .5 ? mix(R.m, R.d, .6) : R.ll); }
      const stone = (x, y) => { p.H(x, y + 2, 3, mix(R.m, R.d, .55)); p.P(x, y, R.ll); p.P(x + 1, y, '#fff4d0'); p.P(x, y + 1, R.l); p.P(x + 1, y + 1, R.d); p.P(x + 2, y + 1, mix(R.d, '#5c4224', .5)); };
      for (let i = 0; i < 1 + (variant & 1) + (variant >> 1); i++) stone(rr(2, 27), rr(2, 26)); break; }
    // Sand: wind ripples (a lit crest over a shaded trough), grains, now and then a shell or a pebble.
    case 's': { const S = PAL.sand; p.R(0, 0, 32, 32, S.m); patch(rr(9, 22), rr(8, 23), rr(5, 7), 2, S.l, 1.4);
      for (let i = 0; i < 4; i++) { const y0 = 3 + i * 8 + rr(0, 2), x0 = rr(0, 8), len = rr(10, 18), ph = r() * 6; for (let k = 0; k < len; k++) { const x = x0 + k, y = y0 + Math.round(Math.sin(k * .45 + ph) * 1.2); if (x > 31) break; p.P(x, y, mix(S.m, S.d, .55)); p.P(x, y - 1, S.l); } }
      for (let i = 0; i < 6; i++) p.P(rr(0, 31), rr(0, 31), r() < .5 ? S.ll : mix(S.m, S.d, .7));
      if (variant === 2) { const x = rr(4, 24), y = rr(4, 24); p.S(x, y, ['.hh.', 'hphp', '.pp.'], { h: '#fff0f0', p: '#f0a8b0' }); p.H(x + 1, y + 3, 2, S.d); }
      if (variant === 3) { const x = rr(4, 24), y = rr(4, 24); p.R(x, y, 3, 2, PAL.rock.l); p.P(x, y, PAL.rock.ll); p.P(x + 2, y + 1, PAL.rock.d); p.H(x, y + 2, 4, S.d); } break; }
    // Poké Center: the owner's roof with the Poké Ball crest, white walls with a red band, the PC sign over glass doors.
    case 'C': grassBase(1); castShadow(29, 12, 3, 17); castShadow(4, 29, 27, 2, .55);
      walls(3, 26, 13, 29, ['#e2dccc', '#c8c0b0', '#f6f2e8', '#ffffff'], false); p.R(3, 24, 26, 2, '#d84040'); p.H(3, 24, 26, '#f06a5a'); p.H(3, 26, 26, '#8a2424');
      roof(3, 26, 3, 12, RR, 5);
      p.S(12, 2, ['..OOOO..', '.ORRRRO.', 'ORHRRRRO', 'OOOWWOOO', 'OWWOOWWO', '.OWWWWO.', '..OOOO..'], { O: BOUT, R: '#e83c3c', H: '#ff9a88', W: '#ffffff' });
      if (RF[3]) flag(26, 0, RF[3]);
      p.R(11, 13, 10, 8, BOUT); p.R(12, 14, 8, 6, '#fff8e8'); p.H(12, 19, 8, '#e0d4c0'); p.S(13, 14, ['RRR.RRR', 'R.R.R..', 'RRR.R..', 'R...R..', 'R...RRR'], { R: '#d83838' });
      win(4, 15, false, false); win(22, 15, false, false); glassDoor(12, 22, 8, 5); break;
    // HQ: a stone keep under the owner's roof, arrow-slit windows, an iron-bound gate, the owner's banner on the ridge.
    case 'Q': grassBase(1); castShadow(30, 12, 2, 17); castShadow(3, 29, 28, 2, .55);
      walls(2, 28, 12, 29, ['#6a6a78', '#5a5a68', '#9a9aa8', '#bcbcc8'], false);
      for (let y = 15; y < 26; y += 3) for (let x = 2 + ((y / 3) & 1) * 3; x < 29; x += 6) { p.H(x, y, 5, '#aaaab6'); p.P(x + 5, y, '#6a6a78'); p.H(x, y + 2, 6, '#7a7a88'); }
      roof(2, 28, 4, 11, RR, 3); p.H(1, 13, 30, BOUT); for (let x = 2; x < 30; x += 4) { p.R(x, 11, 2, 2, '#9a9aa8'); p.P(x, 11, '#c8c8d4'); }
      p.R(5, 15, 3, 6, BOUT); p.V(6, 16, 4, '#1a1a24'); p.R(24, 15, 3, 6, BOUT); p.V(25, 16, 4, '#1a1a24');
      p.R(11, 17, 10, 11, BOUT); p.R(12, 18, 8, 10, '#5a3a24'); for (let x = 12; x < 20; x += 2) p.V(x, 18, 10, '#6a4a30'); p.H(12, 18, 8, '#8a6a48'); p.H(12, 21, 8, '#3a3a44'); p.H(12, 25, 8, '#3a3a44'); p.P(13, 21, '#c8c8d4'); p.P(18, 21, '#c8c8d4'); p.P(13, 25, '#c8c8d4'); p.P(18, 25, '#c8c8d4'); p.V(16, 18, 10, '#2a1a10');
      p.R(10, 28, 12, 2, '#9a9aa8'); p.H(10, 28, 12, '#c8c8d4');
      flag(16, 0, RF[3] || '#d8d8e0'); break;
    // Field Center: a healing machine bolted to a floor plate, so it sits in caves, bases and volcanoes alike
    case 'K': { const M = PAL.metal; p.R(0, 0, 32, 32, M.d); p.R(1, 1, 30, 30, mix(M.m, M.d, .35)); p.H(1, 1, 30, M.m); p.V(1, 1, 30, M.m); p.H(1, 30, 30, shade(M.d, -.3)); p.V(30, 1, 30, shade(M.d, -.3));
      for (let i = 0; i < 30; i++) { const c = ((i >> 1) & 1) ? '#2a2a30' : '#e8c040'; if (i < 7 || i > 23) { p.P(1 + i, 2, c); p.P(1 + i, 29, c); } }
      for (const [rx, ry] of [[3, 4], [28, 4], [3, 27], [28, 27]]) { p.P(rx, ry, M.ll); p.P(rx + 1, ry + 1, M.d); }
      for (let y = 26; y < 29; y++) for (let x = 7; x < 28; x++) if (dith(x, y) < .6) p.P(x, y, shade(M.d, -.35));
      // the machine: a rounded console with six Poké Ball slots, a green screen with a cross and a status light
      p.R(6, 7, 20, 20, BOUT); p.R(7, 8, 18, 18, '#e8e2d4'); p.R(7, 8, 18, 2, '#ffffff'); p.V(7, 8, 18, '#ffffff'); p.V(24, 8, 18, '#b8b0a0'); p.H(7, 25, 18, '#a8a090'); p.P(6, 7, M.d); p.P(25, 7, M.d); p.P(6, 26, M.d); p.P(25, 26, M.d);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const bx = 9 + i * 5, by = 10 + j * 5; p.R(bx, by, 4, 4, '#4a4450'); p.S(bx, by, ['.RR.', 'RHRR', 'OWOO', '.WW.'], { R: '#e83c3c', H: '#ff9a88', O: '#2a2430', W: '#ffffff' }); }
      p.R(11, 20, 10, 5, BOUT); p.R(12, 21, 8, 3, '#1c3a24'); p.R(15, 21, 2, 3, '#7cf0a0'); p.R(14, 22, 4, 1, '#7cf0a0'); p.P(12, 21, '#3a6a44');
      p.R(22, 20, 2, 2, '#ff4a4a'); p.P(22, 20, '#ffb0a0'); break; }
    // Gym: a slate roof with a gold trim, marble columns, the gold GYM plaque, double doors on two steps, a pennant.
    case 'G': grassBase(1); castShadow(30, 12, 2, 17); castShadow(3, 30, 28, 2, .55);
      walls(1, 30, 12, 28, ['#b8bccc', '#a0a4b8', '#dde0ea', '#f4f6fa'], false);
      roof(1, 30, 3, 11, ROOF_RAMP.slate, 5); p.H(-1, 11, 34, '#e0a020'); p.H(0, 12, 32, '#8a5a10');
      for (const cx of [3, 26]) { p.R(cx - 1, 13, 5, 14, BOUT); p.R(cx, 13, 3, 14, '#f4f6fa'); p.V(cx, 13, 14, '#ffffff'); p.V(cx + 2, 13, 14, '#a8adbf'); p.R(cx - 1, 13, 5, 2, '#dde0ea'); p.R(cx - 1, 25, 5, 2, '#dde0ea'); }
      p.R(9, 13, 14, 7, BOUT); p.R(10, 14, 12, 5, '#ffd24a'); p.H(10, 14, 12, '#fff0a0'); p.H(10, 18, 12, '#c88a1a');
      p.S(11, 14, ['.OO.O.O.O.O', 'O...O.O.OOO', 'O.O..O..O.O', '.OO..O..O.O'], { O: '#3a2000' });
      p.R(11, 20, 10, 8, BOUT); p.R(12, 21, 8, 7, '#6a4a30'); p.V(16, 21, 7, '#2a1a10'); p.H(12, 21, 8, '#8a6a48'); p.P(15, 24, '#ffd24a'); p.P(17, 24, '#ffd24a');
      p.R(9, 28, 14, 2, '#c8c8d4'); p.H(9, 28, 14, '#f0f0f8'); p.R(7, 30, 18, 1, '#9a9aa8');
      flag(28, 0, '#ffd24a'); break;
    // House: a cottage with a shingled hip roof in one of four colours, a chimney, plank walls, a framed window with a
    // flower box and a panelled door on a stone step; the door and window swap sides between variants.
    case 'H': grassBase(1); { const R = [ROOF_RAMP.brown, ROOF_RAMP.blue, ROOF_RAMP.green, ROOF_RAMP.plum][variant], left = variant % 2 === 1;
      castShadow(28, 14, 3, 15); castShadow(5, 29, 25, 2, .55);
      walls(4, 24, 14, 29, ['#d8caa8', '#b8a88a', '#ece2c8', '#fbf4e2']);
      roof(4, 24, 4, 13, R, 4); chimney(left ? 8 : 20, 3);
      door(left ? 7 : 19, 19, 6, 8, ['#8a5430', '#5a6a8a', '#6a4a30', '#7a3a48'][variant]); win(left ? 18 : 8, 17, variant >= 2, true);
      if (variant === 2) { p.R(28, 24, 3, 5, BOUT); p.R(29, 25, 1, 4, '#9a9aa8'); p.R(28, 23, 3, 2, '#5a6a8a'); } } break;
    case 'c': caveBase(); break;
    // Rubble: a heap of shaded boulders, each with its shadow, a crack and a lit rim; pebbles around the foot.
    case 'r': caveBase(); { const rocks = [[10, 9, 7, 5], [23, 12, 5, 4], [14, 21, 6, 5], [25, 24, 4, 3], [5, 20, 3, 3]]; for (const [x, y, w, h] of rocks) groundShadow(p, x + 2, y + h, w, 2, PAL.cave.dd);
      for (const [x, y, w, h] of rocks) { shadeBlobs(p, [{ x, y, rx: w, ry: h }, { x: x + w * .3, y: y + h * .25, rx: w * .7, ry: h * .7 }], RAMP.crock, RAMP.crockOut, { bias: -.08 }); if (w > 4) { p.P(x - 1, y, RAMP.crock[1]); p.P(x, y + 1, RAMP.crock[1]); p.P(x + 1, y + 1, RAMP.crock[2]); } }
      for (let i = 0; i < 4; i++) { const x = rr(1, 29), y = rr(24, 30); p.P(x, y, RAMP.crock[5]); p.P(x + 1, y, RAMP.crock[1]); } } break;
    // Cave wall seen from above: a dark mass of packed rocks, each faintly lit on its upper left, with deep joints.
    case 'W': { const C = PAL.cwall; p.R(0, 0, 32, 32, C.out);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 8 + 4 + rr(-1, 1) + (j & 1) * 3, y = j * 8 + 4 + rr(-1, 1); shadeBlobs(p, [{ x, y, rx: rr(4, 5), ry: rr(3, 4) }], RAMP.wallTop, null, { bias: -.1 }); }
      for (let i = 0; i < 2; i++) { const x = rr(2, 26), y = rr(2, 28); p.P(x, y, C.faceL); } break; }
    case 'f': floorBase(); break;
    case 'b': { const B = PAL.bwall; p.R(0, 0, 32, 32, B.top); for (let y = 0; y < 32; y += 8) for (let x = ((y / 8) & 1) * 8 - 8; x < 32; x += 16) { p.R(x + 1, y + 1, 14, 6, mix(B.top, B.topL, .7)); p.H(x + 1, y + 1, 14, B.topL); } break; }
    // Lava: molten rock in slow swirls (bright yellow crests, deep red troughs, both periodic in 32 px so tiles join),
    // a cooled dark vein or two, and a bubble that swells and pops.
    case 'L': { const L = PAL.lava; p.R(0, 0, 32, 32, L.m); const w = mulberry32(variant * 9 + 3), ph = frame * Math.PI / 2, sp = w() * 6;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const a = Math.sin(x * Math.PI / 16 + Math.sin(y * Math.PI / 8 + sp) * 1.6 + ph * .5), b = Math.sin(y * Math.PI / 16 * 2 + Math.sin(x * Math.PI / 16) * 2 - ph * .5); const v = a + b * .6;
        if (v > 1.25) p.P(x, y, v > 1.5 ? L.w : L.ll); else if (v > .8) p.P(x, y, L.l); else if (v < -1.2) p.P(x, y, L.dd); else if (v < -.75) p.P(x, y, L.d); }
      const bx = 4 + Math.floor(w() * 24), by = 4 + Math.floor(w() * 24); if (frame === 0) p.P(bx, by, L.w); else if (frame === 1) { p.R(bx - 1, by - 1, 3, 3, L.ll); p.P(bx, by, L.w); } else if (frame === 2) { p.H(bx - 1, by - 2, 3, L.w); p.H(bx - 1, by + 2, 3, L.w); p.V(bx - 2, by - 1, 3, L.w); p.V(bx + 2, by - 1, 3, L.w); } break; }
    // Pillar: a fluted steel column shaded as a cylinder (highlight a third of the way in), a capital and a plinth,
    // its shadow falling to the east across the tiles.
    case 'p': floorBase(); { const M = RAMP.steel, F = PAL.floor; for (let y = 6; y < 31; y++) for (let x = 22; x < 29; x++) if (dith(x, y) < .55) p.P(x, y, mix(F.m, F.grout, .8));
      p.R(9, 3, 14, 26, '#16161e'); for (let x = 10; x < 22; x++) { const rel = (x - 10) / 11, v = rel < .32 ? .72 + rel * .7 : .95 - (rel - .32) * 1.25; for (let y = 4; y < 28; y++) p.P(x, y, rampAt(M, v, x, y)); if (x === 12 || x === 15 || x === 18) for (let y = 7; y < 25; y++) p.P(x, y, rampAt(M, v - .16, x, y)); }
      for (const [y0, h] of [[0, 4], [26, 5]]) { p.R(7, y0, 18, h, '#16161e'); for (let x = 8; x < 24; x++) { const rel = (x - 8) / 15, v = rel < .3 ? .78 + rel * .5 : .93 - (rel - .3) * 1.1; for (let y = y0 + 1; y < y0 + h - 1; y++) p.P(x, y, rampAt(M, v, x, y)); } p.H(8, y0 + 1, 16, M[6]); } } break;
    case 'x': floorBase(); crate(3, 14, 13); crate(17, 16, 12); crate(9, 3, 12); break;
    // Ice: pale sheet with two diagonal reflections, a crack with a bright edge and a sparkle.
    case 'i': { const I = PAL.ice; p.R(0, 0, 32, 32, I.m); patch(rr(10, 22), rr(10, 22), rr(5, 7), rr(3, 4), mix(I.m, I.d, .35), 1.4);
      for (let k = 0; k < 2; k++) { const off = rr(0, 31), wd = 2 + k; for (let i = 0; i < 32; i++) for (let q = 0; q < wd; q++) { const x = (i + off + q + k * 11) % 32; p.P(x, 31 - i, q === 0 ? I.ll : I.l); } }
      { let x = rr(3, 16), y = rr(6, 26); for (let k = 0; k < rr(6, 10); k++) { p.P(x, y, I.d); p.P(x, y - 1, '#ffffff'); x++; if (r() < .45) y += r() < .5 ? 1 : -1; if (x > 30) break; } }
      { const x = rr(4, 27), y = rr(4, 27); p.P(x, y, '#ffffff'); p.P(x - 1, y, I.ll); p.P(x + 1, y, I.ll); p.P(x, y - 1, I.ll); p.P(x, y + 1, I.ll); } break; }
    // Snow: soft drifts (a lit mound with a blue shadow under it), glints, and a twig or a stone poking through.
    case 'S': { const S = PAL.snow; p.R(0, 0, 32, 32, S.m); for (let i = 0; i < 2; i++) { const cx = rr(8, 23), cy = rr(7, 22), rx = rr(5, 7); patch(cx, cy + 2, rx, 2, S.d, 1.2); patch(cx, cy, rx, 2, S.l, 1.6); p.H(cx - 2, cy - 1, 4, '#ffffff'); }
      for (let i = 0; i < 4; i++) p.P(rr(1, 30), rr(1, 30), r() < .5 ? '#ffffff' : S.d);
      if (variant === 2) { const x = rr(5, 24), y = rr(5, 24); p.P(x, y, '#6a4a30'); p.P(x + 1, y + 1, '#6a4a30'); p.P(x + 2, y + 1, '#8a6a48'); p.P(x + 3, y, '#6a4a30'); }
      if (variant === 3) { const x = rr(5, 24), y = rr(5, 24); p.R(x, y, 3, 2, PAL.rock.m); p.P(x, y, PAL.rock.l); p.H(x, y - 1, 3, '#ffffff'); p.H(x, y + 2, 4, S.d); } break; }
    default: p.R(0, 0, 32, 32, '#ff00ff');
  }
}
function buildTileset() {
  for (const ch in TERRAIN) for (let v = 0; v < VARIANTS; v++) {
    const frames = tileFrames(ch);
    for (let f = 0; f < frames; f++) { const c = tileCanvas(); drawTile(ch, v, f, c.getContext('2d')); TILESET[ch + v + f] = c; }
  }
  loadTallTerrainSprites();
}
function tileImg(ch, v, f, owner = null) {
  if (ch === 't' && TALL_ART.ready && TALL_ART.enabled) return tallTerrainImg(v, 0, f);
  const frames = tileFrames(ch); const key = ch + (v % VARIANTS) + (f % frames);
  if (owner == null || !(ch === 'C' || ch === 'Q')) return TILESET[key] || TILESET['.00'];
  const ok = key + 'o' + owner; if (!TILESET[ok]) { const c = tileCanvas(); drawTile(ch, v % VARIANTS, f % frames, c.getContext('2d'), owner); TILESET[ok] = c; } return TILESET[ok];
}

// ---------------------------------------------------------------- autotile overlays
const EDGES = new Map();
function edgeCanvas(key, fn) { let c = EDGES.get(key); if (c) return c; c = tileCanvas(); fn(painter(c.getContext('2d')), c.getContext('2d')); EDGES.set(key, c); return c; }
// Land colours used for the bank of a liquid tile bordering it.
function bankOf(t) {
  if (!t) return null; const id = t.id;
  if (GRASSY.has(id)) return { lip: PAL.grass.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
  if (id === 'sand') return { lip: PAL.sand.d, earth: '#c8a860', earthD: '#9a7a40' };
  if (id === 'road') return { lip: PAL.road.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
  if (id === 'cave' || id === 'rubble' || id === 'wall') return { lip: PAL.cave.l, earth: PAL.cave.dd, earthD: '#241c2a' };
  if (id === 'floor' || id === 'bwall' || id === 'pillar' || id === 'crate') return { lip: PAL.floor.d, earth: '#4e4858', earthD: '#332e3c' };
  if (id === 'snow' || id === 'ice') return { lip: PAL.snow.d, earth: '#8ea2bc', earthD: '#63768f' };
  if (id === 'rock') return { lip: PAL.cliff.l, earth: PAL.cliff.d, earthD: PAL.cliff.dd };
  return { lip: PAL.grass.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
}
// Neighbour helper over a parsed map (tiles[y][x]); outside the map counts as the same tile (no edge).
function nb(m, x, y, dx, dy) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= m.w || Y >= m.h) return null; return m.tiles[Y][X]; }
// Draws base tile + context-aware overlays for tile (x,y) at screen (X,Y).
function drawTerrain(g, m, x, y, X, Y, frame, time = 0) {
  const t = m.tiles[y][x]; const v = m.variants[y][x]; const id = t.id;
  const owner = (id === 'center' || id === 'hq') && m.ownerAt ? m.ownerAt(x, y) : null; // capturable buildings wear their owner's roof
  const grassPose = id === 'tall' && TALL_ART.ready && TALL_ART.enabled ? tallTerrainPose(x, y, v, time) : null;
  g.drawImage(grassPose ? tallTerrainImg(v, grassPose.state, grassPose.frame) : tileImg(t.ch, v, frame, owner), X, Y);
  const N = nb(m, x, y, 0, -1), S = nb(m, x, y, 0, 1), W = nb(m, x, y, -1, 0), E = nb(m, x, y, 1, 0);
  if (id === 'water' || id === 'lava') {
    const isLand = n => n && !LIQUID.has(n.id) && n.id !== 'bridge';
    const sides = [isLand(N), isLand(E), isLand(S), isLand(W)]; const diag = [nb(m, x, y, 1, -1), nb(m, x, y, 1, 1), nb(m, x, y, -1, 1), nb(m, x, y, -1, -1)].map(isLand);
    const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0) | diag.reduce((a, b, i) => a | (b ? 16 << i : 0), 0);
    if (mask) {
      const lava = id === 'lava'; const banks = [N, E, S, W].map(n => bankOf(n)); const bk = banks.map(b => b ? b.lip : '-').join('');
      const key = 'sh' + t.ch + mask + frame + bk + (lava ? 'L' : '');
      g.drawImage(edgeCanvas(key, p => drawShoreOverlay(p, sides, diag, banks, frame, lava, t.ch === 'w')), X, Y);
    }
  } else if (id === 'road' || id === 'sand') {
    const isG = n => n && GRASSY.has(n.id); const sides = [isG(N), isG(E), isG(S), isG(W)];
    const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('rd' + t.ch + mask + v, p => drawGrassLip(p, sides, v, t.ch)), X, Y);
  } else if (id === 'wall' || id === 'bwall' || id === 'rock') {
    const open = n => n && n.id !== id && OPEN.has(n.id) || (n && n.id !== id && (n.id === 'house' || n.id === 'pillar'));
    const sides = [open(N), open(E), open(S), open(W)]; const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('wl' + t.ch + mask + v, p => drawWallFace(p, sides, v, id)), X, Y);
  } else if (id === 'tall') {
    const isT = n => !n || n.id === 'tall' || n.id === 'forest'; const sides = [!isT(N), !isT(E), !isT(S), !isT(W)]; const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('tg' + mask + v, p => drawTallEdge(p, sides, v)), X, Y);
  }
  // soft ground shadow cast south by tall things
  if ((id === 'forest' || id === 'mountain' || id === 'house' || id === 'center' || id === 'hq' || id === 'gym' || id === 'wall' || id === 'bwall' || id === 'rock' || id === 'pillar') && S && OPEN.has(S.id) && S.id !== 'water' && S.id !== 'lava' && S.id !== id) {
    g.globalAlpha = .22; g.fillStyle = '#000000'; g.fillRect(X, Y + TILE, TILE, 3); g.globalAlpha = .1; g.fillRect(X, Y + TILE + 3, TILE, 2); g.globalAlpha = 1;
  }
}
// Shoreline drawn on the liquid tile, in the board's three-quarter view: the land to the north shows its earth face
// dropping into the water, the sides a thinner bank, the south only its lip. Then a deeper line where the bank
// meets the water, foam that swells and thins from frame to frame, and a wet dither.
function drawShoreOverlay(p, sides, diag, banks, frame, lava, cave) {
  const W = lava ? PAL.lava : cave ? PAL.cwater : PAL.water;
  const foam = lava ? PAL.lava.ll : W.foam, wet = lava ? PAL.lava.l : W.ll, deep = lava ? PAL.lava.dd : W.dd;
  const bank = (i, fn) => { const b = banks[i] || banks.find(Boolean) || bankOf({ id: 'plain' }); fn(lava ? { lip: '#2a1a14', earth: '#1a100c', earthD: '#0a0604' } : b); };
  const face = [3, 1, 0, 1];
  const edge = (i, at) => bank(i, b => { const fd = face[i]; for (let k = 0; k < 32; k++) {
    at(k, 0, b.lip); for (let q = 1; q <= fd; q++) at(k, q, q === fd && fd > 1 ? b.earthD : b.earth);
    const sw = Math.sin((k + frame * 2) * .55 + i * 1.7) + Math.sin(k * 1.3 + i * 2.1), th = sw > .5 ? 2 : 1, f0 = fd + 1;
    at(k, f0, fd ? deep : foam); for (let q = 0; q < th; q++) at(k, f0 + 1 + q, foam);
    if ((k + frame) % 2 === 0) at(k, f0 + 1 + th, wet); if ((k * 3 + frame) % 7 === 0) at(k, f0 + 2 + th, wet); } });
  if (sides[0]) edge(0, (k, q, c) => p.P(k, q, c));
  if (sides[2]) edge(2, (k, q, c) => p.P(k, 31 - q, c));
  if (sides[3]) edge(3, (k, q, c) => p.P(q, k, c));
  if (sides[1]) edge(1, (k, q, c) => p.P(31 - q, k, c));
  // outer corners rounded where two banks meet, inner corner nubs where only the diagonal is land
  const corner = (cx, cy, dx, dy, i) => bank(i, b => { p.P(cx, cy, b.lip); p.P(cx + dx, cy, b.lip); p.P(cx, cy + dy, b.lip); p.P(cx + dx, cy + dy, b.earth); p.P(cx + 2 * dx, cy, b.earth); p.P(cx, cy + 2 * dy, b.earth); p.P(cx + 2 * dx, cy + dy, foam); p.P(cx + dx, cy + 2 * dy, foam); p.P(cx + 2 * dx, cy + 2 * dy, foam); p.P(cx + 3 * dx, cy + dy, foam); p.P(cx + dx, cy + 3 * dy, foam); });
  if (!sides[0] && !sides[1] && diag[0]) corner(31, 0, -1, 1, 1);
  if (!sides[1] && !sides[2] && diag[1]) corner(31, 31, -1, -1, 1);
  if (!sides[2] && !sides[3] && diag[2]) corner(0, 31, 1, -1, 3);
  if (!sides[3] && !sides[0] && diag[3]) corner(0, 0, 1, 1, 3);
  const round = (x, y, c) => p.P(x, y, c);
  if (sides[0] && sides[3]) bank(0, b => { round(1, 4, b.earth); round(2, 5, foam); round(1, 5, b.lip); }); if (sides[0] && sides[1]) bank(0, b => { round(30, 4, b.earth); round(29, 5, foam); round(30, 5, b.lip); });
  if (sides[2] && sides[3]) bank(2, b => { round(1, 30, b.lip); round(2, 29, foam); }); if (sides[2] && sides[1]) bank(2, b => { round(30, 30, b.lip); round(29, 29, foam); });
  if (lava) { const gl = PAL.lava.w; for (let k = 0; k < 32; k += 3) { if (sides[0]) p.P(k + (frame % 3), 5, gl); if (sides[2]) p.P(k + (frame % 3), 29, gl); } }
}
// Scalloped grass overhang on the edge of a road/sand tile: the turf laps over the edge with a dark rim; on the north
// and west sides it casts a thin shadow onto the path, on the south and east its lit edge faces the viewer.
function drawGrassLip(p, sides, v, ch) {
  const G = PAL.grass, sh = ch === 's' ? mix(PAL.sand.m, PAL.sand.d, .7) : mix(PAL.road.m, PAL.road.d, .75); const r = mulberry32(v * 61 + ch.charCodeAt(0)); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const lip = (at, shadow) => { let k = 0; while (k < 32) { const w = rr(3, 6), d = rr(1, 3); for (let i = 0; i < w && k + i < 32; i++) { const dd = i === 0 || i === w - 1 ? Math.max(1, d - 1) : d; for (let q = 0; q < dd; q++) at(k + i, q, q === dd - 1 && !shadow ? G.l : G.m); at(k + i, dd, G.dd); if (shadow) at(k + i, dd + 1, sh); } k += w; if (r() < .3) { at(k, 0, G.dd); if (shadow) at(k, 1, sh); k++; } } };
  if (sides[0]) lip((k, q, c) => p.P(k, q, c), true);
  if (sides[2]) lip((k, q, c) => p.P(k, 31 - q, c), false);
  if (sides[3]) lip((k, q, c) => p.P(q, k, c), true);
  if (sides[1]) lip((k, q, c) => p.P(31 - q, k, c), false);
  const cornerFill = (cx, cy, dx, dy) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4 - j; i++) p.P(cx + i * dx, cy + j * dy, i + j === 3 ? G.dd : G.m); };
  if (sides[0] && sides[3]) cornerFill(0, 0, 1, 1); if (sides[0] && sides[1]) cornerFill(31, 0, -1, 1); if (sides[2] && sides[3]) cornerFill(0, 31, 1, -1); if (sides[2] && sides[1]) cornerFill(31, 31, -1, -1);
}
// Tall grass fades into plain grass with a ragged blade edge.
function drawTallEdge(p, sides, v) {
  const G = PAL.grass, r = mulberry32(v * 17 + 3); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const lip = at => { let k = 0; while (k < 32) { const w = rr(3, 6), d = rr(1, 2); for (let i = 0; i < w && k + i < 32; i++) { const dd = i === 0 || i === w - 1 ? d - 1 : d; for (let q = 0; q <= dd; q++) at(k + i, q, q === dd ? TALL_T.dd : q === 0 ? G.m : G.m); } k += w; } };
  if (sides[0]) lip((k, q, c) => p.P(k, q, c)); if (sides[2]) lip((k, q, c) => p.P(k, 31 - q, c)); if (sides[3]) lip((k, q, c) => p.P(q, k, c)); if (sides[1]) lip((k, q, c) => p.P(31 - q, k, c));
}
// Walls: a lit rim on open sides, and a full front face when the tile south is open.
function drawWallFace(p, sides, v, id) {
  const r = mulberry32(v * 29 + 11); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  if (id === 'wall') { const C = PAL.cwall;
    if (sides[2]) { // rocky face: rounded boulders packed in rows, lit from above, darker toward the floor
      p.R(0, 12, 32, 20, C.face); p.H(0, 12, 32, C.faceLL); p.H(0, 13, 32, C.faceL);
      for (let j = 0; j < 3; j++) { const y = 15 + j * 5 + rr(0, 1); let x = rr(-4, 0); while (x < 32) { const w = rr(5, 10), h = rr(3, 4); p.E(x + w / 2, y + h / 2, w / 2, h / 2, C.faceD); p.E(x + w / 2, y + h / 2 - 1, w / 2 - 1, h / 2, C.faceL); p.H(x + 2, y, Math.max(1, w - 4), C.faceLL); x += w + rr(0, 2); } }
      p.R(0, 27, 32, 3, C.faceD); for (let x = rr(0, 3); x < 32; x += rr(4, 7)) p.P(x, 28, C.face);
      p.H(0, 30, 32, C.out); p.H(0, 31, 32, C.out); p.H(0, 11, 32, C.out);
      if (!sides[3]) p.V(0, 12, 20, C.faceD); if (!sides[1]) p.V(31, 12, 20, C.faceD);
    }
    if (sides[0]) { p.H(0, 0, 32, C.out); p.H(0, 1, 32, C.faceLL); p.H(0, 2, 32, C.faceL); }
    if (sides[3]) { p.V(0, 0, 32, C.out); p.V(1, 0, sides[2] ? 12 : 32, C.faceL); }
    if (sides[1]) { p.V(31, 0, 32, C.out); p.V(30, 0, sides[2] ? 12 : 32, C.topL); }
  } else if (id === 'bwall') { const B = PAL.bwall;
    if (sides[2]) { // brick face in running bond with mortar
      p.R(0, 10, 32, 22, B.mortar); for (let y = 10; y < 32; y += 6) { const off = ((y - 10) / 6 & 1) * 8; for (let x = off - 16; x < 32; x += 16) { p.R(x + 1, y + 1, 14, 4, B.face); p.H(x + 1, y + 1, 14, B.faceL); p.P(x + 1, y + 1, B.faceLL); p.H(x + 1, y + 4, 14, shade(B.face, -.25)); } }
      p.H(0, 9, 32, B.out); p.H(0, 10, 32, B.faceLL); p.H(0, 31, 32, B.out); p.H(0, 30, 32, shade(B.mortar, -.3));
      if (!sides[3]) p.V(0, 10, 22, shade(B.mortar, -.3)); if (!sides[1]) p.V(31, 10, 22, shade(B.mortar, -.3));
    }
    if (sides[0]) { p.H(0, 0, 32, B.out); p.H(0, 1, 32, B.faceLL); }
    if (sides[3]) { p.V(0, 0, 32, B.out); p.V(1, 0, sides[2] ? 10 : 32, B.faceL); }
    if (sides[1]) { p.V(31, 0, 32, B.out); p.V(30, 0, sides[2] ? 10 : 32, B.top); }
  } else { const C = PAL.cliff; // cliff
    if (sides[2]) { p.R(0, 14, 32, 18, C.d); p.H(0, 14, 32, C.ll); p.H(0, 15, 32, C.l); for (let j = 0; j < 3; j++) { const y = 18 + j * 4 + rr(0, 1); let x = rr(-3, 0); while (x < 32) { const w = rr(5, 10); p.H(x, y, w, C.m); p.H(x, y + 1, w, C.dd); x += w + rr(1, 2); } } p.H(0, 30, 32, C.dd); p.H(0, 31, 32, '#241e26'); p.H(0, 13, 32, '#241e26'); }
    if (sides[0]) { p.H(0, 0, 32, '#241e26'); p.H(0, 1, 32, C.ll); } if (sides[3]) { p.V(0, 0, 32, '#241e26'); p.V(1, 0, sides[2] ? 14 : 32, C.l); } if (sides[1]) { p.V(31, 0, 32, '#241e26'); p.V(30, 0, sides[2] ? 14 : 32, C.dd); }
  }
}

// ---------------------------------------------------------------- range / cursor / arrow overlays
function rangeOverlay(cells, inSet, sx, sy, col, edgeCol, phase, a = 1) {
  const A = ctx.globalAlpha * a; ctx.globalAlpha = .34 * A;
  for (const c of cells) rect(sx + c.x * TILE, sy + c.y * TILE, TILE, TILE, col);
  // slow diagonal shimmer (very quiet)
  ctx.globalAlpha = .06 * A; ctx.fillStyle = '#ffffff';
  for (const c of cells) { const X = sx + c.x * TILE, Y = sy + c.y * TILE; for (let j = 0; j < TILE; j++) { const i0 = (j + phase * 2) % 16; for (let i = i0; i < TILE; i += 16) ctx.fillRect(X + i, Y + j, 3, 1); } }
  ctx.globalAlpha = A;
  // crisp outer edge (light) with a darker inner line
  const dark = shade(col, -.35);
  for (const c of cells) {
    const X = sx + c.x * TILE, Y = sy + c.y * TILE;
    if (!inSet(c.x, c.y - 1)) { rect(X, Y, TILE, 1, edgeCol); ctx.globalAlpha = .5 * A; rect(X, Y + 1, TILE, 1, dark); ctx.globalAlpha = A; }
    if (!inSet(c.x, c.y + 1)) { rect(X, Y + TILE - 1, TILE, 1, edgeCol); ctx.globalAlpha = .5 * A; rect(X, Y + TILE - 2, TILE, 1, dark); ctx.globalAlpha = A; }
    if (!inSet(c.x - 1, c.y)) { rect(X, Y, 1, TILE, edgeCol); ctx.globalAlpha = .5 * A; rect(X + 1, Y, 1, TILE, dark); ctx.globalAlpha = A; }
    if (!inSet(c.x + 1, c.y)) { rect(X + TILE - 1, Y, 1, TILE, edgeCol); ctx.globalAlpha = .5 * A; rect(X + TILE - 2, Y, 1, TILE, dark); ctx.globalAlpha = A; }
  }
  ctx.globalAlpha = A / a;
}
// Pixel ellipse ring (outer radius rx/ry, `th` pixels thick) — used for unit bases and selection pulses.
function ellipseRing(cx, cy, rx, ry, th, c) {
  ctx.fillStyle = c; cx |= 0; cy |= 0;
  for (let y = -ry; y <= ry; y++) {
    const wo = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + .5);
    const ry2 = ry - th, rx2 = rx - th; const wi = (ry2 > 0 && Math.abs(y) <= ry2) ? Math.floor(rx2 * Math.sqrt(Math.max(0, 1 - (y * y) / (ry2 * ry2))) + .5) : -1;
    if (wi < 0) ctx.fillRect(cx - wo, cy + y, 2 * wo + 1, 1); else { ctx.fillRect(cx - wo, cy + y, wo - wi, 1); ctx.fillRect(cx + wi + 1, cy + y, wo - wi, 1); }
  }
}
// Bracket cursor: four L-shaped corners that snap in from wide when the cursor lands on a new tile, then breathe.
const CUR = { x: null, y: null, t0: 0 };
function drawCursorGlow(x, y, t) {
  const k = .5 + .5 * Math.sin(t / 220); ctx.globalAlpha = .08 + .07 * k; rect(x, y, TILE, TILE, '#ffffff');
  ctx.globalAlpha = .18 + .12 * k; outline(x, y, TILE, TILE, '#ffffff'); ctx.globalAlpha = 1;
}
function drawCursor(x, y, t, col = '#ffffff', col2 = '#ffd24a') {
  if (CUR.x !== x || CUR.y !== y) { CUR.x = x; CUR.y = y; CUR.t0 = t; }
  const snap = REDUCED ? 0 : Math.max(0, 1 - (t - CUR.t0) / 130); // 1 → just landed
  const o = 2 + Math.round(Math.sin(t / 180) * 1.5 + snap * snap * 7); const L = 9, T2 = 3;
  const corners = [[x - o, y - o, 1, 1], [x + TILE + o, y - o, -1, 1], [x - o, y + TILE + o, 1, -1], [x + TILE + o, y + TILE + o, -1, -1]];
  const Lshape = (cx, cy, dx, dy, len, th, c, inset) => {
    const x0 = dx > 0 ? cx + inset : cx - inset - len + 1, y0 = dy > 0 ? cy + inset : cy - inset - th + 1; rect(x0, y0, len, th, c);
    const x1 = dx > 0 ? cx + inset : cx - inset - th + 1, y1 = dy > 0 ? cy + inset : cy - inset - len + 1; rect(x1, y1, th, len, c);
  };
  const dark = shade(col2, -.6);
  for (const [cx, cy, dx, dy] of corners) {
    ctx.globalAlpha = .45; Lshape(cx + 1, cy + 2, dx, dy, L + 1, T2 + 2, '#000000', -1); ctx.globalAlpha = 1; // soft drop shadow
    Lshape(cx, cy, dx, dy, L + 1, T2 + 2, UI.shadow, -1); // outline
    Lshape(cx, cy, dx, dy, L, T2, col, 0); // body
    Lshape(cx, cy, dx, dy, L - 1, 1, col2, T2 - 1); // inner accent
    Lshape(cx, cy, dx, dy, L - 2, 1, dark, T2 - 1); ctx.globalAlpha = .35; Lshape(cx, cy, dx, dy, L - 2, 1, col2, T2 - 1); ctx.globalAlpha = 1; // accent shading
    px(cx, cy, col2); // rounded outer corner: coloured tip pixel
    px(cx + dx * (L - 1), cy, col2); px(cx, cy + dy * (L - 1), col2); // bright tips on the bracket ends
  }
  if (snap > .5 && !REDUCED) { ctx.globalAlpha = (snap - .5) * 2 * .6; outline(x - 1, y - 1, TILE + 2, TILE + 2, col); ctx.globalAlpha = 1; }
}
// FE-style path arrow. Each cell is one piece (tail, straight, corner, head), built once from a silhouette mask and
// shaded per pixel (light from the top-left) so the shaft reads as a bevelled tube with a crisp dark outline.
const ARROW = {};
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ARROW_PAL = { OUT: '#4a1e00', DK: '#d0601a', MID: '#ff9f2e', LT: '#ffd45a', LT2: '#ffbf42', GL: '#fff2b0' };
function arrowMask(din, dout) {
  const C = 16, hw = 4, inD = din !== '-' ? opp(din) : null; const dirs = []; if (inD) dirs.push(inD); if (dout !== '-') dirs.push(dout);
  const m = new Uint8Array(32 * 32); const set = (x, y) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) m[y * 32 + x] = 1; };
  const inBar = (d, x, y) => { const [dx, dy] = DIRS[d]; const ax = x - C, ay = y - C; if (dx) return Math.sign(ax) === dx || ax === 0 ? Math.abs(ay) <= hw : false; return Math.sign(ay) === dy || ay === 0 ? Math.abs(ax) <= hw : false; };
  const isHead = dout === '-' && din !== '-';
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let on = false;
    if (isHead) { // shaft from the entering edge to the head base, then a chevron
      const d = din, [dx, dy] = DIRS[d]; const s = dx ? (x - C) * dx : (y - C) * dy, w = dx ? Math.abs(y - C) : Math.abs(x - C);
      const base = -3, tip = 9, HW = 9; if (s <= base && w <= hw) on = true; if (s >= base && s <= tip) { const ww = Math.round(HW * (1 - (s - base) / (tip - base))); if (w <= ww) on = true; }
    } else {
      for (const d of dirs) if (inBar(d, x, y)) on = true;
      if (din === '-') { const dd = (x - C) * (x - C) + (y - C) * (y - C); if (dd <= (hw + 1.5) * (hw + 1.5)) on = true; } // tail knob
      if (dirs.length === 2 && inD !== dout) { // round the outer elbow of a corner
        const [ax, ay] = DIRS[inD], [bx, by] = DIRS[dout]; const ex = -(ax + bx), ey = -(ay + by);
        if (Math.sign(x - C) === ex && Math.sign(y - C) === ey) { const dd = (x - C) * (x - C) + (y - C) * (y - C); if (dd > (hw + .5) * (hw + .5)) on = false; }
      }
    }
    if (on) set(x, y);
  }
  return m;
}
function arrowPiece(din, dout, variant = '') {
  const key = din + dout + variant; if (ARROW[key]) return ARROW[key];
  const c = tileCanvas(); const g = c.getContext('2d'); const m = arrowMask(din, dout); const P = ARROW_PAL;
  const ex = new Set(); if (din !== '-') ex.add(opp(din)); if (dout !== '-') ex.add(dout); // sides where the shaft leaves the cell
  const at = (x, y) => x >= 0 && y >= 0 && x < 32 && y < 32 ? m[y * 32 + x] : ((x < 0 && ex.has('W') || x >= 32 && ex.has('E')) && Math.abs(y - 16) <= 4 || (y < 0 && ex.has('N') || y >= 32 && ex.has('S')) && Math.abs(x - 16) <= 4 ? 1 : 0);
  const isOut = (x, y) => !at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1));
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (variant === 'shadow') { if (at(x, y) || isOut(x, y)) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 1, 1); } continue; }
    if (variant === 'shine') { if (at(x, y)) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); } continue; }
    if (!at(x, y)) { if (isOut(x, y)) { g.fillStyle = P.OUT; g.fillRect(x, y, 1, 1); } continue; }
    let col = P.MID;
    if (!at(x, y - 1)) col = P.LT; else if (!at(x, y - 2)) col = P.LT2; else if (!at(x - 1, y)) col = P.LT; else if (!at(x - 2, y)) col = P.LT2;
    else if (!at(x, y + 1)) col = P.DK; else if (!at(x + 1, y)) col = P.DK;
    if (!at(x, y - 1) && !at(x - 1, y)) col = P.GL; // top-left corner glint
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  if (variant === '' && din === '-') { const p = painter(g); p.C(16, 16, 2, P.OUT); p.P(16, 16, P.GL); p.P(15, 15, P.GL); } // tail knob ring
  ARROW[key] = c; return c;
}
function opp(d) { return d === 'N' ? 'S' : d === 'S' ? 'N' : d === 'E' ? 'W' : 'E'; }
function dirOf(a, b) { return b.x > a.x ? 'E' : b.x < a.x ? 'W' : b.y > a.y ? 'S' : 'N'; }
const ARROW_ST = { sig: '', t0: 0 };
function drawArrow(path, sx, sy, t = performance.now()) {
  if (path.length < 2) return;
  const n = path.length; const last = path[n - 1]; const sig = n + ':' + last.x + ',' + last.y; if (sig !== ARROW_ST.sig) { ARROW_ST.sig = sig; ARROW_ST.t0 = t; }
  const pop = REDUCED ? 0 : Math.max(0, 1 - (t - ARROW_ST.t0) / 110);
  const kinds = []; for (let i = 0; i < n; i++) kinds.push([i > 0 ? dirOf(path[i - 1], path[i]) : '-', i < n - 1 ? dirOf(path[i], path[i + 1]) : '-']);
  for (let i = 0; i < n; i++) ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1], 'shadow'), sx + path[i].x * TILE + 1, sy + path[i].y * TILE + 2);
  for (let i = 0; i < n; i++) {
    const X = sx + path[i].x * TILE, Y = sy + path[i].y * TILE;
    if (i === n - 1 && pop > 0) { const sc = 1 + pop * .35; ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1]), Math.round(X - (sc - 1) * 16), Math.round(Y - (sc - 1) * 16), Math.round(32 * sc), Math.round(32 * sc)); }
    else ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1]), X, Y);
  }
  if (!REDUCED) { // a soft light pulse runs from the tail to the head
    const pos = ((t / 1000) * 7) % (n + 4) - 1;
    for (let i = 0; i < n; i++) { const a = Math.max(0, 1 - Math.abs(i - pos) / 1.5) * .45; if (a <= 0) continue; ctx.globalAlpha = a; ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1], 'shine'), sx + path[i].x * TILE, sy + path[i].y * TILE); }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- particles, sprites & floaters
const FX = { parts: [], texts: [], sprites: [], shake: 0, shakeX: 0, shakeY: 0, flash: 0, flashCol: '#ffffff', zoom: 0, hitstop: 0, slow: 0 };
function spawnParts(x, y, n, col, opt = {}) {
  if (REDUCED) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) { const a = vrnd() * Math.PI * 2, sp = (opt.speed || 60) * (0.4 + vrnd()); FX.parts.push({ x, y, vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp * (opt.flat ? .4 : 1) + (opt.vy || 0), life: (opt.life || .5) * (0.6 + vrnd() * .6), t: -(opt.delay || 0), col: Array.isArray(col) ? vpick(col) : col, size: opt.size || 2, grav: opt.grav == null ? 120 : opt.grav, shape: opt.shape || 'sq' }); }
}
// Shaped effect sprite. kinds: burst flash slash flame drop bolt leaf bubble shard rock wisp psy poof spark heart wind star
function spawnSprite(kind, x, y, o = {}) {
  if (REDUCED && FX.sprites.length > 12) return null;
  const s = { floor: o.floor == null ? null : o.floor, kind, x, y, vx: o.vx || 0, vy: o.vy || 0, t: -(o.delay || 0), life: o.life || .5, col: o.col || '#ffffff', col2: o.col2 || '#ffffff', size: o.size || 6, grav: o.grav || 0, rot: o.rot || 0, spin: o.spin || 0, seed: Math.floor(vrnd() * 1e6), arc: o.arc || 0, x0: x, y0: y, tx: o.tx, ty: o.ty, trail: o.trail || null, len: o.len || 0, orbit: o.orbit || null, dir: o.dir || 1 };
  FX.sprites.push(s); return s;
}
// Hurry the texts on screen off within `t` seconds (a KO stamp should not land on top of the damage numbers).
function fadeFloatTexts(t) { for (const f of FX.texts) f.life = f.delay > 0 ? 0 : Math.min(f.life, f.t + t); }
function floatText(x, y, s, col = '#ffffff', opt = {}) { FX.texts.push({ x, y, s, col, t: 0, life: opt.life || 1, big: !!opt.big || !!opt.huge, huge: opt.huge || 0, outline: opt.outline || UI.shadow, vy: opt.vy == null ? -26 : opt.vy, delay: opt.delay || 0, pop: opt.pop !== false }); }
function updateFX(dt) {
  for (const p of FX.parts) { p.t += dt; if (p.t < 0) continue; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  FX.parts = FX.parts.filter(p => p.t < p.life);
  for (const s of FX.sprites) { s.t += dt; if (s.t < 0) continue; if (s.orbit) { const o = s.orbit, k = Math.min(1, s.t / s.life), a = o.a0 + s.t * o.speed, r = o.r * (o.shrink ? 1 - k * .8 : 1); s.x = s.x0 + Math.cos(a) * r; s.y = s.y0 + Math.sin(a) * r * (o.squash || .45); } else if (s.tx != null) { const k = Math.min(1, s.t / s.life); s.x = lerp(s.x0, s.tx, k); s.y = lerp(s.y0, s.ty, k) - Math.sin(k * Math.PI) * s.arc; } else { s.vy += s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.floor != null && s.y > s.floor) { s.y = s.floor; if (s.vy > 40) { s.vy *= -.42; s.vx *= .6; s.spin *= .5; } else { s.vy = 0; s.vx *= .82; s.spin = 0; } } } s.rot += s.spin * dt; if (s.trail && vrnd() < .6) spawnParts(s.x, s.y, 1, s.trail, { speed: 12, life: .25, grav: 0, size: 2 }); }
  FX.sprites = FX.sprites.filter(s => s.t < s.life);
  for (const f of FX.texts) { if (f.delay > 0) { f.delay -= dt; continue; } f.t += dt; f.y += f.vy * dt * (f.t < .25 ? 1 : .25); }
  FX.texts = FX.texts.filter(f => f.t < f.life);
  if (FX.shake > 0) { FX.shake = Math.max(0, FX.shake - dt * 30); const m = REDUCED ? 0 : FX.shake; FX.shakeX = Math.round((vrnd() * 2 - 1) * m); FX.shakeY = Math.round((vrnd() * 2 - 1) * m); } else { FX.shakeX = FX.shakeY = 0; }
  if (FX.flash > 0) FX.flash = Math.max(0, FX.flash - dt * 4);
  if (FX.zoom > 0) FX.zoom = Math.max(0, FX.zoom - dt * 3);
}
// pixel line (Bresenham) for effect strokes
function pline(x0, y0, x1, y1, c, w = 1) { ctx.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (let n = 0; n < 400; n++) { ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }
function drawSprite(s, ox, oy) {
  const k = Math.max(0, s.t / s.life), x = Math.round(s.x + ox), y = Math.round(s.y + oy); const fade = k > .6 ? 1 - (k - .6) / .4 : 1; const R = mulberry32(s.seed);
  ctx.globalAlpha = fade;
  switch (s.kind) {
    case 'burst': { const L = Math.round(s.size * easeOut(k)); for (let d = 0; d < 8; d++) { const a = d * Math.PI / 4; const dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a)); const l0 = Math.round(L * .35 * k); for (let i = l0; i < L; i++) { ctx.fillStyle = i < l0 + 2 ? '#ffffff' : s.col; ctx.fillRect(x + dx * i, y + dy * i, 1, 1); } } break; }
    case 'flash': { const L = Math.round(s.size * (1 - k * .6)); ctx.fillStyle = s.col; ctx.fillRect(x - L, y - 1, 2 * L + 1, 3); ctx.fillRect(x - 1, y - L, 3, 2 * L + 1); const D = Math.round(L * .55); for (let i = -D; i <= D; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + i, y - i, 1, 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 5, 5); break; }
    case 'star': { const L = Math.max(1, Math.round(s.size * (1 - k))); ctx.fillStyle = s.col; ctx.fillRect(x - L, y, 2 * L + 1, 1); ctx.fillRect(x, y - L, 1, 2 * L + 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); break; }
    case 'slash': { const L = s.size; const off = Math.round((k - .5) * 8); for (let n = 0; n < 3; n++) { const o = (n - 1) * 3; pline(x - L + off + o, y + L - off, x + L + off + o, y - L - off, n === 1 ? '#ffffff' : s.col, n === 1 ? 2 : 1); } break; }
    case 'flame': { const r = Math.max(1, Math.round(s.size * (1 - k * .7))); const fl = (Math.floor(s.t * 30) + s.seed) % 2; circle(x, y, r, s.col2); circle(x - (fl ? 1 : 0), y - 1, Math.max(1, r - 1), s.col); circle(x, y - 2, Math.max(0, r - 2), '#ffef9a'); ctx.fillStyle = s.col; ctx.fillRect(x - 1 + fl, y - r - 2, 2, 3); ctx.fillRect(x + (fl ? -2 : 1), y - r - 1, 1, 2); break; }
    case 'drop': { ctx.fillStyle = s.col; ctx.fillRect(x, y - 3, 1, 1); ctx.fillRect(x - 1, y - 2, 3, 3); ctx.fillRect(x, y + 1, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1); break; }
    case 'bolt': { if ((Math.floor(s.t * 40) + s.seed) % 3 === 2) break; let px0 = x, py0 = y - s.size; const segs = 5; for (let i = 0; i < segs; i++) { const nx = x + Math.round((R() - .5) * 10), ny = y - s.size + Math.round((i + 1) * s.size * 2 / segs); pline(px0, py0, nx, ny, s.col, 3); pline(px0, py0, nx, ny, '#ffffff', 1); px0 = nx; py0 = ny; } break; }
    case 'spark': { if ((Math.floor(s.t * 30) + s.seed) % 2) break; ctx.fillStyle = s.col; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); break; }
    case 'leaf': { const f = Math.floor(s.rot) & 3; ctx.fillStyle = s.col; if (f === 0) { ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillStyle = s.col2; ctx.fillRect(x - 2, y, 4, 1); } else if (f === 1) { ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(x - 2, y - 2, 2, 2); ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillStyle = s.col2; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); } else if (f === 2) { ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillStyle = s.col2; ctx.fillRect(x, y - 2, 1, 4); } else { ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(x + 1, y - 2, 2, 2); ctx.fillRect(x - 2, y + 1, 2, 2); ctx.fillStyle = s.col2; ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); } break; }
    case 'bubble': { const r = Math.max(1, Math.round(s.size * Math.min(1, k * 3 + .3))); ctx.fillStyle = s.col; for (let a = 0; a < 16; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 8) * r), y + Math.round(Math.sin(a * Math.PI / 8) * r), 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - Math.round(r * .5), y - Math.round(r * .5), 1, 1); if (k > .85) { ctx.fillStyle = s.col2; ctx.fillRect(x - r - 1, y, 1, 1); ctx.fillRect(x + r + 1, y, 1, 1); ctx.fillRect(x, y - r - 1, 1, 1); ctx.fillRect(x, y + r + 1, 1, 1); } break; }
    case 'shard': { const f = Math.floor(s.rot) & 1; ctx.fillStyle = s.col; if (f) { ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 1, y - 1, 3, 3); } else { ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x - 1, y - 1, 3, 3); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); break; }
    case 'rock': { const sz = s.size; ctx.fillStyle = s.col2; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz); ctx.fillStyle = s.col; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz - 1, sz - 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), 1, 1); break; }
    case 'wisp': { const r = Math.max(1, Math.round(s.size * (1 - k * .5))); const wob = Math.round(Math.sin(s.t * 14 + s.seed) * 2); circle(x + wob, y, r, s.col); circle(x + wob - 1, y - 1, Math.max(0, r - 2), s.col2); circle(x + wob - Math.sign(s.vx || 1) * (r + 1), y + 2, Math.max(0, r - 2), s.col); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + wob - 1, y - 1, 1, 1); break; }
    case 'psy': { const r = Math.max(1, Math.round(s.size * easeOut(k))); ctx.fillStyle = s.col; for (let a = 0; a < 48; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 24) * r), y + Math.round(Math.sin(a * Math.PI / 24) * r * .7), 1, 1); if (r > 4) { ctx.fillStyle = s.col2; for (let a = 0; a < 32; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 16) * (r - 3)), y + Math.round(Math.sin(a * Math.PI / 16) * (r - 3) * .7), 1, 1); } break; }
    // An Advance Wars explosion: a white-hot core swelling through yellow, orange and red into smoke, lumpy and
    // rising as it burns out. `col` 'dust' draws the grey dust cloud of a fainting Pokémon instead.
    case 'boom': { ctx.globalAlpha = 1; const dust = s.col === 'dust', e = Math.min(1, k * 1.7), r = Math.max(1, Math.round(s.size * (.35 + .65 * easeOut(e)))), rise = Math.round(k * s.size * .5);
      const pal = dust ? (k < .2 ? ['#ffffff', '#e8e4ee'] : k < .55 ? ['#d8d2e0', '#a8a0b4'] : ['#9a92a4', '#6a6274']) : k < .12 ? ['#ffffff', '#fff6c8'] : k < .3 ? ['#fff4b0', '#ffc848'] : k < .5 ? ['#ffc040', '#f06a1e'] : k < .72 ? ['#e0561c', '#8a2a14'] : ['#6a5a5a', '#3e3434'];
      if (k > .72) ctx.globalAlpha = Math.max(0, 1 - (k - .72) / .28);
      const lumps = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + s.rot + R() * .6, d = r * (.45 + R() * .25); lumps.push([x + Math.round(Math.cos(a) * d), y - rise + Math.round(Math.sin(a) * d * .8), Math.max(1, Math.round(r * (.42 + R() * .2)))]); }
      for (const [lx, ly, lr] of lumps) circle(lx, ly + 1, lr + 1, dust ? '#4a4452' : '#2a1410');
      for (const [lx, ly, lr] of lumps) circle(lx, ly, lr, pal[1]);
      circle(x, y - rise, Math.max(1, Math.round(r * .62)), pal[1]); circle(x - Math.round(r * .15), y - rise - Math.round(r * .15), Math.max(1, Math.round(r * .42)), pal[0]);
      if (k < .2 && !dust) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r - 3, y - rise, 2 * r + 7, 1); ctx.fillRect(x, y - rise - r - 3, 1, 2 * r + 7); }
      break; }
    case 'smoke': { const r = Math.max(1, Math.round(s.size * (.5 + k))); ctx.globalAlpha = fade * .55; circle(x, y, r, s.col); circle(x - Math.round(r * .5), y + 1, Math.max(1, r - 2), s.col); circle(x + Math.round(r * .5), y, Math.max(1, r - 1), s.col); ctx.globalAlpha = fade * .35; circle(x - 1, y - 1, Math.max(1, r - 2), s.col2); break; }
    case 'debris': { const f = Math.floor(s.rot * 2) & 3; ctx.fillStyle = s.col; if (s.size > 2) { if (f & 1) ctx.fillRect(x - 1, y - 1, 3, 2); else ctx.fillRect(x - 1, y - 1, 2, 3); } else ctx.fillRect(x, y, 2, 2); ctx.fillStyle = s.col2; ctx.fillRect(x - (f === 2 ? 0 : 1), y - 1, 1, 1); break; }
    case 'poof': { const r = Math.max(1, Math.round(s.size * (0.5 + k * .8))); ctx.globalAlpha = fade * .85; circle(x, y, r, s.col); circle(x - r, y + 1, Math.max(1, r - 2), s.col); circle(x + r, y + 1, Math.max(1, r - 2), s.col); circle(x - 1, y - 1, Math.max(0, r - 2), s.col2); break; }
    case 'heart': { const sc = k < .2 ? 1 : 1; ctx.fillStyle = s.col; const rows = ST.heart; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') { ctx.fillStyle = rows[j][i] === 'L' ? '#ffffff' : s.col; ctx.fillRect(x - 2 + i, y - 2 + j, 1, 1); } break; }
    case 'wind': { const L = s.size; ctx.fillStyle = s.col; for (let n = 0; n < 3; n++) { const o = (n - 1) * 3, len = L - n * 2; ctx.fillRect(x - len + Math.round(k * 6), y + o, len, 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y, 3, 1); break; }
    // ---- scene-sized effects for the lateral battle
    // fireball: a layered ball (dark rim, orange, yellow, white core) with a flickering tail behind its heading
    case 'fireball': { const r = s.size, fl = (Math.floor(s.t * 24) + s.seed) % 2, d = -s.dir; circle(x, y, r + 1, '#7a1a08'); circle(x, y, r, s.col2); circle(x + d * -1, y - 1, Math.max(1, r - 2), s.col); circle(x + d * -1, y - 1, Math.max(0, r - 4), '#fff3a0'); for (let i = 1; i <= 3; i++) { const tr = Math.max(1, r - i - (fl ? 1 : 0)); circle(x + d * (r + i * 4), y + (i % 2 ? -1 : 1) * fl, tr, i === 1 ? s.col2 : '#c83a10'); if (i === 1) circle(x + d * (r + 4), y, Math.max(0, tr - 2), s.col); } break; }
    // blast: a bright ball that bursts into a ring of flame tongues, then thins away
    case 'blast': { const r = Math.round(s.size * easeOut(Math.min(1, k * 1.4))); if (k < .3) { circle(x, y, r, s.col2); circle(x, y, Math.max(0, r - 3), '#ffffff'); } else { for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6 + s.seed, rr = r + ((n + Math.floor(s.t * 20)) % 3) * 2; const bx = x + Math.round(Math.cos(a) * rr), by2 = y + Math.round(Math.sin(a) * rr * .8); circle(bx, by2, Math.max(1, Math.round(s.size * .22 * (1 - k))), n % 2 ? s.col : s.col2); } ctx.globalAlpha = fade * .5; circle(x, y, Math.max(0, r - 4), s.col); ctx.globalAlpha = fade; } break; }
    // ring: an expanding shock ellipse
    case 'ring': { const r = Math.max(1, Math.round(s.size * easeOut(k))); ctx.fillStyle = s.col; for (let a = 0; a < 72; a++) { const px2 = x + Math.round(Math.cos(a * Math.PI / 36) * r), py2 = y + Math.round(Math.sin(a * Math.PI / 36) * r * .55); ctx.fillRect(px2 - 1, py2 - 1, 3, 2); } break; }
    // impact: a twelve-point starburst that pops out then shrinks
    case 'impact': { const R0 = s.size * (k < .25 ? easeOut(k / .25) : 1 - (k - .25) / .75 * .6), pts = []; for (let n = 0; n < 24; n++) { const a = n * Math.PI / 12 + s.rot; const rr = n % 2 ? R0 : R0 * .42; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } ctx.fillStyle = s.col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1]))); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); pts.forEach((p, i) => { const qx = x + (p[0] - x) * .6, qy = y + (p[1] - y) * .6; i ? ctx.lineTo(Math.round(qx), Math.round(qy)) : ctx.moveTo(Math.round(qx), Math.round(qy)); }); ctx.closePath(); ctx.fill(); break; }
    // lightning: a thick bolt striking down from `size` pixels above (x,y), with a branch, flickering
    case 'lightning': { if ((Math.floor(s.t * 30) + s.seed) % 4 === 3) break; let px0 = x + Math.round((R() - .5) * 16), py0 = y - s.size; const segs = 7; for (let i = 0; i < segs; i++) { const last = i === segs - 1; const nx = last ? x : x + Math.round((R() - .5) * 22), ny = y - s.size + Math.round((i + 1) * s.size / segs); pline(px0, py0, nx, ny, shade(s.col, -.3), 5); pline(px0, py0, nx, ny, s.col, 3); pline(px0, py0, nx, ny, '#ffffff', 1); if (i === 2 || i === 4) { const bx = nx + Math.round((R() - .5) * 40), by2 = ny + 10 + Math.round(R() * 14); pline(nx, ny, bx, by2, s.col, 2); pline(nx, ny, bx, by2, '#ffffff', 1); } px0 = nx; py0 = ny; } circle(x, y, 6, '#ffffff'); break; }
    // wave: a crest of water sweeping in `dir`, growing then breaking into foam
    case 'wave': { const r = Math.max(2, Math.round(s.size * Math.min(1, k * 1.6))); const foam = k > .55; for (let i = -r; i <= r; i++) { const h = Math.round(Math.sqrt(Math.max(0, r * r - i * i)) * .9); const cx2 = x + i * -s.dir; ctx.fillStyle = s.col; ctx.fillRect(cx2, y - h, 1, Math.max(1, h)); if (h > 2) { ctx.fillStyle = s.col2; ctx.fillRect(cx2, y - h, 1, 2); } } if (foam) { ctx.fillStyle = '#ffffff'; for (let n = 0; n < 6; n++) ctx.fillRect(x + s.dir * (r - n * 3) + Math.round((R() - .5) * 4), y - r + Math.round(R() * 6), 2, 2); } break; }
    // speed lines: streaks trailing behind a lunge
    case 'speed': { ctx.fillStyle = s.col; for (let n = 0; n < 5; n++) { const len = Math.round((s.size - n * 3) * (1 - k * .5)); const oy2 = (n - 2) * 6 + Math.round((R() - .5) * 3); ctx.fillRect(s.dir > 0 ? x - len : x, y + oy2, len, 1); } break; }
    // crystal: an ice shard that grows out of the ground and shatters
    case 'crystal': { const h = Math.round(s.size * (k < .4 ? easeOut(k / .4) : 1)); if (k > .75 && (Math.floor(s.t * 30) + s.seed) % 2) break; for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * s.size * .4)); ctx.fillStyle = s.col; ctx.fillRect(x - (w >> 1), y - j, w, 1); ctx.fillStyle = s.col2; ctx.fillRect(x - (w >> 1), y - j, Math.max(1, w >> 2), 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - h + 1, 1, 2); break; }
    // horizontal beam of signed length `len` from (x,y): grows out fast, holds, then thins away
    case 'beam': { const len = Math.round(s.len * Math.min(1, k * 2.5)); const th = Math.max(1, Math.round(s.size * (k < .25 ? k / .25 : k > .7 ? (1 - k) / .3 : 1))); const x0 = Math.min(x, x + len), w = Math.abs(len); const fl = (Math.floor(s.t * 40) + s.seed) % 2; ctx.fillStyle = s.col; ctx.fillRect(x0, y - th - fl, w, 2 * th + 1 + fl); ctx.fillStyle = s.col2; ctx.fillRect(x0, y - (th >> 1), w, (th >> 1) * 2 + 1); break; }
  }
  ctx.globalAlpha = 1;
}
// Particles and effect sprites in world space (offset by ox, oy). Floating texts are drawn separately by
// drawFXTexts so the board can draw them unscaled when it is zoomed out.
function drawFX(ox, oy, texts = true) {
  for (const p of FX.parts) { if (p.t < 0) continue; const k = 1 - p.t / p.life; const s = Math.max(1, Math.round(p.size * (k < .4 ? k / .4 : 1))); ctx.fillStyle = p.col; if (p.shape === 'ring') { const r = Math.round(p.size * (1 - k) * 3) + 2; ctx.globalAlpha = k; outline(p.x + ox - r, p.y + oy - r, 2 * r, 2 * r, p.col); ctx.globalAlpha = 1; } else ctx.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s); }
  for (const s of FX.sprites) if (s.t >= 0) drawSprite(s, ox, oy);
  if (texts) drawFXTexts(ox, oy);
}
// Floating texts: world position (x + ox, y + oy) times `sc` gives the screen position; the text itself keeps its pixel size.
function drawFXTexts(ox, oy, sc = 1) {
  // every text is nudged sideways to stay whole on the canvas, whatever camera transform it is drawn under
  const m = ctx.getTransform && ctx.getTransform(), cw = ctx.canvas && ctx.canvas.width;
  const keep = (x, w) => { if (!m || !(m.a > 0) || !cw) return x; const pad = 2 * m.a, a0 = m.a * (x - w / 2) + m.e, a1 = m.a * (x + w / 2) + m.e; return a0 < pad ? x + (pad - a0) / m.a : a1 > cw - pad ? x - (a1 - cw + pad) / m.a : x; };
  for (const f of FX.texts) { if (f.delay > 0) continue; const k = f.t / f.life; ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; const pop = f.pop && f.t < .15 ? 1 + (1 - f.t / .15) * .5 : 1; let x = (f.x + ox) * sc; const y = (f.y + oy) * sc - (pop - 1) * 6;
    // huge numbers (the duel's damage): drawn at a whole-pixel scale, one step bigger as they land, with a short wobble
    if (f.huge) { const s2 = f.huge + (f.t < .09 && !REDUCED ? 1 : 0), wob = REDUCED ? 0 : Math.round(Math.sin(f.t * 55) * 3 * Math.max(0, 1 - f.t / .25)); x = keep(x, (textWidth(String(f.s).toUpperCase(), BIG) + 2) * s2); ctx.save(); ctx.translate(Math.round(x) + wob, Math.round(y)); ctx.scale(s2, s2); bigC(f.s, 0, -4.5, f.t < .05 ? '#ffffff' : f.col, { outline: f.outline }); ctx.restore(); ctx.globalAlpha = 1; continue; }
    // big numbers land: two frames at double size, then their own size (whole-pixel scales keep the glyphs crisp)
    if (f.big && f.pop && f.t < .1 && !REDUCED) { x = keep(x, (textWidth(String(f.s).toUpperCase(), BIG) + 2) * 2); ctx.save(); ctx.translate(Math.round(x), Math.round(y + 4)); ctx.scale(2, 2); bigC(f.s, 0, -4.5, '#ffffff', { outline: f.outline }); ctx.restore(); }
    else if (f.big) bigC(f.s, keep(x, textWidth(String(f.s).toUpperCase(), BIG) + 2), y, f.col, { outline: f.outline }); else textC(f.s, keep(x, textWidth(f.s) + 2), y, f.col, { outline: f.outline }); ctx.globalAlpha = 1; }
}
function shake(n) { FX.shake = Math.max(FX.shake, n); }
function flashScreen(col = '#ffffff', a = 1) { FX.flash = a; FX.flashCol = col; }

// ---------------------------------------------------------------- weather
// The weather over a view of w×h (screen or field space): slanted rain with splashes, harsh sun in warm beams, a
// sandstorm's blowing streaks and haze, drifting snow. Stateless (positions come from the index and the clock).
function drawWeather(kind, w, h, t) {
  if (!kind || REDUCED) return; const hash = i => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
  if (kind === 'rain') { ctx.globalAlpha = .12; rect(0, 0, w, h, '#1a2a50'); const n = Math.round(w * h / 1400); ctx.globalAlpha = .62;
    for (let i = 0; i < n; i++) { const sp = 240 + hash(i + 3) * 120, y = ((hash(i) * (h + 30) + t * sp) % (h + 30)) - 15, x = ((hash(i + 7) * (w + 40) - t * sp * .3) % (w + 40) + w + 40) % (w + 40) - 20; pline(Math.round(x), Math.round(y), Math.round(x - 2), Math.round(y + 7), '#b8d4ff', 1); }
    ctx.globalAlpha = .45; for (let i = 0; i < n / 8; i++) { const k = (t * 1.5 + hash(i + 11)) % 1; if (k < .3) { const x = Math.round(hash(i + 13) * w), y = Math.round(hash(i + 17) * h); ellipseRing(x, y, 2 + Math.round(k * 10), 1 + Math.round(k * 3), 1, '#d8e8ff'); } } ctx.globalAlpha = 1; }
  else if (kind === 'sun') { ctx.globalAlpha = .07; rect(0, 0, w, h, '#ffc860'); for (let i = 0; i < 3; i++) { const x0 = Math.round(w * (.1 + i * .3) + Math.sin(t * .4 + i) * 20); ctx.globalAlpha = .05 + .02 * Math.sin(t * .8 + i); ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 40, 0); ctx.lineTo(x0 + 40 - h * .5, h); ctx.lineTo(x0 - h * .5, h); ctx.closePath(); ctx.fillStyle = '#fff4c0'; ctx.fill(); }
    ctx.globalAlpha = .6; for (let i = 0; i < 12; i++) { const k = (t * .3 + hash(i)) % 1, x = Math.round(hash(i + 5) * w + Math.sin(t + i) * 6), y = Math.round(h - k * h); if (Math.sin(t * 3 + i) > 0) rect(x, y, 1, 1, '#fff4c0'); } ctx.globalAlpha = 1; }
  else if (kind === 'sand') { ctx.globalAlpha = .18; rect(0, 0, w, h, '#c8a060'); const n = Math.round(w * h / 1200); ctx.globalAlpha = .55;
    for (let i = 0; i < n; i++) { const sp = 300 + hash(i + 2) * 200, x = ((hash(i) * (w + 60) + t * sp) % (w + 60)) - 30, y = Math.round(hash(i + 9) * h + Math.sin(t * 2 + i) * 3), len = 3 + Math.round(hash(i + 4) * 8); rect(Math.round(x), y, len, 1, i % 3 ? '#e8d0a0' : '#b88a50'); } ctx.globalAlpha = 1; }
  else if (kind === 'snow') { ctx.globalAlpha = .08; rect(0, 0, w, h, '#dce8ff'); const n = Math.round(w * h / 1300); ctx.globalAlpha = .85;
    for (let i = 0; i < n; i++) { const sp = 18 + hash(i + 1) * 26, y = ((hash(i) * (h + 10) + t * sp) % (h + 10)) - 5, x = ((hash(i + 3) * w + Math.sin(t * 1.3 + i) * 8 + t * 6) % w + w) % w, big = hash(i + 8) > .75; rect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1, '#ffffff'); } ctx.globalAlpha = 1; }
}
// A tiny weather icon (7×7): a drop, a sun, a swirl of sand, a flake.
function weatherIcon(kind, x, y) {
  const rows = { rain: ['...B...', '..BBB..', '.BBBBB.', 'BBBWBBB', 'BBBBBBB', '.BBBBB.', '..BBB..'], sun: ['Y..Y..Y', '.YYYYY.', '.YWWYY.', 'YYWYYYY', '.YYYYY.', '.YYYYY.', 'Y..Y..Y'], sand: ['.SSSS..', 'S....S.', '..SSS.S', '.S...S.', '.S.SS..', '..S....', '...SSS.'], snow: ['...W...', '.W.W.W.', '..WWW..', 'WWW.WWW', '..WWW..', '.W.W.W.', '...W...'] }[kind];
  if (rows) stampAt(x, y, rows, { B: '#5aa8f0', W: '#ffffff', Y: '#ffd24a', S: '#d8b070' });
}
// ---------------------------------------------------------------- type-flavoured battle effects
const TYPE_FX = {
  Normal: { proj: 'star', parts: ['#ffffff', '#ffe9a0'] }, Fighting: { proj: null, parts: ['#ffb07a', '#ffffff'] },
  Fire: { proj: 'flame', parts: ['#ff8a2c', '#ffd25a', '#ff4a20'] }, Water: { proj: 'drop', parts: ['#62acf0', '#edf9ff'] },
  Electric: { proj: 'spark', parts: ['#ffe94a', '#ffffff'] }, Grass: { proj: 'leaf', parts: ['#7ecf5e', '#a3e07c'] },
  Ice: { proj: 'shard', parts: ['#bde4f8', '#ffffff'] }, Poison: { proj: 'bubble', parts: ['#b060d0', '#e0a0ff'] },
  Ground: { proj: 'rock', parts: ['#c0a060', '#8a6a3a'] }, Rock: { proj: 'rock', parts: ['#ada090', '#665858'] },
  Flying: { proj: 'wind', parts: ['#ffffff', '#c8e0ff'] }, Psychic: { proj: 'psy', parts: ['#ff80c0', '#ffffff'] },
  Bug: { proj: 'leaf', parts: ['#a8b820', '#e0e860'] }, Ghost: { proj: 'wisp', parts: ['#a070e0', '#6040a0'] },
  Dragon: { proj: 'flame', parts: ['#7060ff', '#a0c0ff'] }, Dark: { proj: 'wisp', parts: ['#504060', '#a080c0'] },
  Steel: { proj: 'star', parts: ['#c0c0d0', '#ffffff'] }, Fairy: { proj: 'heart', parts: ['#ffb0e0', '#ffffff'] },
};
function fxFor(type) { return TYPE_FX[type] || TYPE_FX.Normal; }
// Hit effect at (x,y) in world pixels.
// Cottages on a parsed map with the x of their chimney inside the tile (it swaps sides with the variant, see drawTile 'H').
function mapHouses(m) { if (!m.houses) { m.houses = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x].id === 'house') m.houses.push({ x, y, cx: (m.variants[y][x] % 2 === 1 ? 8 : 20) + 2 }); } return m.houses; }
// Smoke from a chimney top at (x, y): three puffs rise, drift east, swell and fade.
function drawChimneySmoke(x, y, t, seed = 0) { if (REDUCED) return; for (let i = 0; i < 3; i++) { const k = (t * .42 + i / 3 + seed) % 1, r = 1 + Math.round(k * 2.5); ctx.globalAlpha = (1 - k) * .5; circle(Math.round(x + Math.sin(k * 5 + seed * 7) * 1.5 + k * 5), Math.round(y - k * 16), r, k < .3 ? '#f4f4fa' : '#d8dae6'); } ctx.globalAlpha = 1; }
// A Poké Ball lying on the map (board space): it rests on a soft shadow, hops every few seconds (the shadow shrinks
// while it is up) and a four-point star twinkles on its cap. Reduced motion keeps it still.
function drawPickup(x, y, t, seed = 0) {
  const ph = REDUCED ? .5 : (t * .45 + seed * .137) % 1, hop = ph < .16 ? Math.round(Math.sin(ph / .16 * Math.PI) * 6) : ph < .22 ? Math.round(Math.sin((ph - .16) / .06 * Math.PI) * 1.5) : 0;
  ctx.globalAlpha = .3; ellipse(x, y + 7, Math.max(3, 6 - (hop >> 1)), 2, '#000000'); ctx.globalAlpha = 1;
  drawBall(x, y - hop, ITEMS.pokeball.col, 5);
  const tw = (t * .45 + seed * .137 + .5) % 1; if (!REDUCED && tw < .14) { const k = Math.sin(tw / .14 * Math.PI), L = Math.round(k * 3), sx = x - 4, sy = y - 5 - hop; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - L, sy, 2 * L + 1, 1); ctx.fillRect(sx, sy - L, 1, 2 * L + 1); if (L > 1) { ctx.fillStyle = '#fff4b0'; ctx.fillRect(sx - 1, sy - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 1, 1); } }
}
function hitEffect(type, x, y, crit, eff) {
  const F = fxFor(type), col = TYPE_COL[type] || '#ffffff', c1 = F.parts[0], c2 = F.parts[1]; const big = crit ? 1.5 : 1;
  spawnSprite('flash', x, y, { size: Math.round(7 * big), life: crit ? .18 : .12, col: crit ? '#ffd24a' : '#ffffff' });
  switch (type) {
    case 'Fire': case 'Dragon': for (let i = 0; i < 5 * big; i++) spawnSprite('flame', x + (vrnd() - .5) * 22, y + 8 + (vrnd() - .5) * 10, { size: 2 + Math.round(vrnd() * 3), life: .4 + vrnd() * .3, col: c1, col2: type === 'Fire' ? '#ff4a20' : '#4a3ad0', vy: -30 - vrnd() * 30, vx: (vrnd() - .5) * 16, delay: vrnd() * .16 }); break;
    case 'Water': for (let i = 0; i < 10 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 50 + vrnd() * 60; spawnSprite('drop', x, y + 2, { life: .45 + vrnd() * .2, col: c1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, grav: 260 }); } spawnSprite('psy', x, y + 8, { size: 12, life: .35, col: c2, col2: c1 }); break;
    case 'Electric': for (let i = 0; i < 3 * big; i++) spawnSprite('bolt', x + (vrnd() - .5) * 14, y - 4, { size: 12, life: .28, col: c1, delay: i * .05 }); for (let i = 0; i < 6 * big; i++) spawnSprite('spark', x + (vrnd() - .5) * 24, y + (vrnd() - .5) * 20, { life: .3 + vrnd() * .2, col: c1, delay: vrnd() * .15 }); break;
    case 'Grass': case 'Bug': for (let i = 0; i < 9 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 40 + vrnd() * 50; spawnSprite('leaf', x, y, { life: .55 + vrnd() * .3, col: type === 'Grass' ? '#2a6b38' : '#6a7a10', col2: type === 'Grass' ? '#c8f0a0' : '#f0f080', vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, grav: 90, rot: vrnd() * 4, spin: 10 + vrnd() * 10 }); } spawnSprite('burst', x, y, { size: 12 * big, life: .25, col: '#e8ffd0' }); break;
    case 'Ice': for (let i = 0; i < 7 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 50 + vrnd() * 40; spawnSprite('shard', x, y, { life: .5, col: c1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 160, rot: vrnd() * 2, spin: 6 }); } spawnSprite('psy', x, y, { size: 12, life: .3, col: '#ffffff', col2: c1 }); break;
    case 'Poison': for (let i = 0; i < 7 * big; i++) spawnSprite('bubble', x + (vrnd() - .5) * 18, y + (vrnd() - .5) * 10, { size: 2 + Math.round(vrnd() * 2), life: .5 + vrnd() * .3, col: c1, col2: c2, vy: -20 - vrnd() * 20, vx: (vrnd() - .5) * 10, delay: vrnd() * .15 }); break;
    case 'Ground': case 'Rock': for (let i = 0; i < 8 * big; i++) { const a = -Math.PI * (0.15 + vrnd() * .7), sp = 60 + vrnd() * 70; spawnSprite('rock', x, y + 6, { size: 2 + Math.round(vrnd() * 2), life: .55, col: c1, col2: c2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 300 }); } for (let i = 0; i < 3; i++) spawnSprite('poof', x + (i - 1) * 8, y + 10, { size: 4, life: .45, col: '#d8c8a0', col2: '#f0e6c8', vy: -10, delay: i * .04 }); break;
    case 'Flying': for (let i = 0; i < 5 * big; i++) spawnSprite('wind', x + (vrnd() - .5) * 10, y + (vrnd() - .5) * 20, { size: 10 + Math.round(vrnd() * 6), life: .3 + vrnd() * .2, col: c2, vx: 120 + vrnd() * 60, delay: vrnd() * .1 }); spawnSprite('slash', x, y, { size: 9, life: .22, col: '#ffffff' }); break;
    case 'Psychic': for (let i = 0; i < 3; i++) spawnSprite('psy', x, y, { size: 14 + i * 3, life: .5, col: c1, col2: c2, delay: i * .1 }); break;
    case 'Ghost': case 'Dark': for (let i = 0; i < 6 * big; i++) { const a = vrnd() * Math.PI * 2; spawnSprite('wisp', x, y, { size: 3 + Math.round(vrnd() * 2), life: .6, col: c1, col2: c2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 20, delay: vrnd() * .12 }); } break;
    case 'Fairy': for (let i = 0; i < 6 * big; i++) spawnSprite('heart', x + (vrnd() - .5) * 20, y + (vrnd() - .5) * 10, { life: .6, col: c1, vy: -30 - vrnd() * 20, delay: vrnd() * .15 }); spawnSprite('psy', x, y, { size: 12, life: .4, col: c1, col2: '#ffffff' }); break;
    case 'Fighting': spawnSprite('slash', x, y, { size: 10, life: .22, col: c1 }); spawnSprite('burst', x, y, { size: 14 * big, life: .3, col: '#ffffff' }); break;
    default: spawnSprite('burst', x, y, { size: 13 * big, life: .3, col: c1 }); for (let i = 0; i < 4; i++) spawnSprite('star', x + (vrnd() - .5) * 22, y + (vrnd() - .5) * 18, { size: 3, life: .3, col: c2, delay: vrnd() * .15 });
  }
  if (eff > 1) spawnSprite('burst', x, y, { size: 18 * big, life: .35, col: '#ffd24a', delay: .04 });
  spawnParts(x, y, crit ? 18 : 10, [col, c1, c2, '#ffffff'], { speed: crit ? 110 : 70, life: .5, grav: 80 });
}
// Projectile from (ax,ay) to (bx,by); returns the sprite so callers can time the impact.
function projectileFX(type, ax, ay, bx, by, dur) {
  const F = fxFor(type); const col = TYPE_COL[type] || '#ffffff'; const kind = F.proj || 'star'; const c1 = F.parts[0], c2 = F.parts[1];
  const o = { tx: bx, ty: by, life: dur, arc: kind === 'rock' || kind === 'drop' ? 14 : 6, col: c1, col2: c2, size: kind === 'flame' ? 4 : kind === 'psy' ? 6 : kind === 'wind' ? 12 : 3, spin: 14, trail: kind === 'spark' ? ['#ffe94a', '#ffffff'] : kind === 'flame' ? [c1, c2] : kind === 'wisp' ? [c1] : kind === 'drop' ? [c1] : null };
  if (kind === 'wind') o.vx = 0;
  if (kind === 'spark') { for (let i = 0; i < 4; i++) spawnSprite('bolt', ax + (bx - ax) * (i + 1) / 5, ay + (by - ay) * (i + 1) / 5 - 10, { size: 10, life: .16, col: c1, delay: i * dur / 4 }); return null; }
  if (kind === 'flame' || kind === 'drop' || kind === 'leaf' || kind === 'star' || kind === 'rock' || kind === 'shard' || kind === 'bubble') { for (let i = 0; i < 3; i++) spawnSprite(kind, ax, ay, { tx: bx + (vrnd() - .5) * 6, ty: by + (vrnd() - .5) * 6, life: dur, arc: o.arc + i * 3, col: c1, col2: c2, size: o.size, spin: 12, rot: i, trail: o.trail, delay: i * .03 }); return null; }
  return spawnSprite(kind, ax, ay, o);
}

// ---------------------------------------------------------------- icons
// A Poké Ball at any angle, closed or open, its button glowing red while it wobbles: the throw's spin, the capture's
// open mouth and its shakes. 17×19 (the lifted cap needs headroom); the ball's centre is (8, 10). Cached.
const BALLSPR = new Map();
function ballSprite(angle = 0, open = 0, glow = 0, col = '#e83c3c') {
  const key = Math.round(angle * 20) + ':' + open + ':' + glow + ':' + col; let c = BALLSPR.get(key); if (c) return c;
  c = tileCanvas(17, 19); const g = c.getContext('2d'), P = (x, y, k) => { g.fillStyle = k; g.fillRect(x, y, 1, 1); };
  const cx = 8, cy = 10, r = 6.4, sa = Math.sin(angle), ca = Math.cos(angle), lift = open ? 3 : 0, OUT = '#1e1a24';
  const px = (x, y) => { const d = Math.hypot(x, y), sd = x * sa - y * ca, lit = (-x - y) / (r * 1.4); if (d > r - .5 || Math.abs(sd) < .9) return OUT; return sd > 0 ? (lit > .42 ? mix(col, '#ffffff', .55) : lit < -.28 ? shade(col, -.32) : col) : (lit < -.28 ? '#c4c0cc' : '#f8f6f0'); };
  for (const top of [false, true]) for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { if (Math.hypot(x, y) > r + .5) continue; const sd = x * sa - y * ca; if ((sd > 0) !== top) continue; const ox = top ? Math.round(sa * lift) : 0, oy = top ? Math.round(-ca * lift) : 0; P(cx + x + ox, cy + y + oy, px(x, y)); }
  if (open) for (let t = -5; t <= 5; t++) { const x = Math.round(ca * t), y = Math.round(sa * t); P(cx + x + Math.round(sa), cy + y - Math.round(ca), '#0c0a10'); P(cx + x + Math.round(sa * 2), cy + y - Math.round(ca * 2), '#3a1010'); }
  const bx = cx + Math.round(sa * .5), by = cy - Math.round(ca * .5);
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) P(bx + dx, by + dy, OUT);
  P(bx, by, glow ? '#ff4040' : '#ffffff'); if (glow) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) P(bx + dx, by + dy, '#ff8a8a');
  if (!open) { P(cx - 3, cy - 4, '#ffffff'); P(cx - 2, cy - 4, '#ffffff'); P(cx - 3, cy - 3, '#ffffff'); }
  BALLSPR.set(key, c); return c;
}
// The Poké Ball sprite (13×13): a lit cap with a specular glint, a shaded rim, the band and a ringed button, a grey
// underside. Other ball colours reuse the rows with their own cap.
const BALL_ROWS = ['....OOOOO....', '..OORRRRROO..', '.ORRHHRRRRRO.', '.ORHHRRRRRDO.', 'ORRHRRRRRRRDO', 'ORRRRROOORRDO', 'OOOOOOWWWOOOO', 'OWWWWWOOOWWSO', 'OWWWWWWWWWWSO', '.OWWWWWWWWSO.', '.OSWWWWWWSSO.', '..OOSSSSSOO..', '....OOOOO....'];
function drawBall(x, y, col = '#f04848', r = 5) {
  if (r >= 5) { const pal = { O: '#1e1a24', R: col, H: mix(col, '#ffffff', .55), D: shade(col, -.32), W: '#f8f6f0', S: '#c4c0cc' };
    for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) { const ch = BALL_ROWS[j][i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x - 6 + i, y - 6 + j, 1, 1); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 4, 1, 1); ctx.fillRect(x + 1, y, 1, 1); return; }
  circle(x, y, r, UI.shadow); circle(x, y, r - 1, '#f6f2e6'); ctx.fillStyle = col; for (let j = -r + 1; j < 0; j++) { const w = Math.floor(Math.sqrt((r - 1) * (r - 1) - j * j) + .5); ctx.fillRect(x - w, y + j, 2 * w + 1, 1); } hline(x - r + 1, y, 2 * r - 1, UI.shadow); px(x, y, '#ffffff'); px(x - 1, y - 2, shade(col, .5));
}
const TYPE_ABBR = { Normal: 'NRM', Fire: 'FIR', Water: 'WTR', Electric: 'ELC', Grass: 'GRS', Ice: 'ICE', Fighting: 'FGT', Poison: 'PSN', Ground: 'GRD', Flying: 'FLY', Psychic: 'PSY', Bug: 'BUG', Rock: 'RCK', Ghost: 'GHO', Dragon: 'DRG', Dark: 'DRK', Steel: 'STL', Fairy: 'FRY' };
// Type badge: `w` pixels wide (24 = three-letter code); w = 'auto' spells the type out and returns the width used.
function typeBadge(t, x, y, w = 24) { const c = TYPE_COL[t] || '#888'; const full = w === 'auto'; if (full) w = textWidth(t.toUpperCase()) + 6; rrect(x, y, w, 9, shade(c, -.55), 1); rrect(x + 1, y + 1, w - 2, 7, c, 0); hline(x + 2, y + 1, w - 4, shade(c, .3)); hline(x + 2, y + 7, w - 4, shade(c, -.25)); textC(full || w >= 40 ? t.toUpperCase() : TYPE_ABBR[t] || t.slice(0, 3).toUpperCase(), x + w / 2, y + 1, '#ffffff', { shadow: shade(c, -.5) }); return w; }
function miniBadge(label, col, x, y) { rrect(x, y, 15, 8, shade(col, -.55), 1); rrect(x + 1, y + 1, 13, 6, col, 0); hline(x + 2, y + 1, 11, shade(col, .3)); textC(label, x + 8, y + 1, '#ffffff', { shadow: shade(col, -.5) }); }
// A badge sized to its label (miniBadge is fixed at 15 px); returns its width.
function tagBadge(label, col, x, y) { const w = textWidth(label) + 5; rrect(x, y, w, 8, shade(col, -.55), 1); rrect(x + 1, y + 1, w - 2, 6, col, 0); hline(x + 2, y + 1, w - 4, shade(col, .3)); text(label, x + 3, y + 1, '#ffffff', { shadow: shade(col, -.5) }); return w; }
function statusBadge(st, x, y) { const s = STATUS[st]; if (s) miniBadge(s.name, s.col, x, y); }
function teamColor(team) { return team === 0 ? '#3d7dff' : team === 1 ? '#ff4b4b' : team === 2 ? '#e0c040' : '#40d060'; }
function teamColorD(team) { return team === 0 ? '#1c3a8a' : team === 1 ? '#8a1c1c' : team === 2 ? '#7a6010' : '#1a6a30'; }
function teamColorL(team) { return team === 0 ? '#8ab4ff' : team === 1 ? '#ff9a9a' : team === 2 ? '#fff0a0' : '#a0f0b0'; }
function stampAt(x, y, rows, pal) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; const c = pal[ch]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } }
function pointerHand(x, y, t) { const b = Math.round(Math.sin(t / 120)); x += b; stampAt(x, y - 1, ST.hand, { O: UI.shadow, W: '#ffffff' }); px(x + 2, y + 3, '#e0d8c8'); px(x + 3, y + 5, '#e0d8c8'); }
// Team flag: a pale pole with a waving two-tone banner.
function drawFlag(x, y, team, wave = 0) { rect(x, y, 1, 11, '#e8e0d0'); px(x, y, '#ffffff'); const c = teamColor(team), d = teamColorD(team); const w = 6 + wave; rect(x + 1, y + 1, w, 5, c); rect(x + 1, y + 6, w - 2, 1, d); px(x + w, y + 2 + wave, d); px(x + 1, y + 1, teamColorL(team)); }
function drawCrown(x, y) { stampAt(x, y, ST.crownGold, { O: '#5a3a00', Y: UI.gold }); px(x + 2, y + 2, '#ff5a5a'); px(x + 1, y + 1, '#fff0a0'); }
function drawSkull(x, y) { stampAt(x, y, ST.skull, { O: '#3a1020', W: '#f0e8f0' }); px(x + 1, y + 2, '#ff5a5a'); px(x + 3, y + 2, '#ff5a5a'); }
// Unit base: a translucent team plate with a glossy rim, and a soft ground shadow that shrinks while the unit is airborne.
// The rim's shape also tells the side apart from the colour: the controlling team's units stand on a plain
// ring, enemy trainers on a ring with four spikes, wild Pokémon on a dashed ring, allies on a ring with a bar.
// `lit` brightens the rim (a unit that can still act); `dim` greys it (a unit that has acted).
function drawStand(cx, by, team, a = 1, air = 0, o = {}) {
  // a soft ground shadow that shrinks when airborne, then a thin team ring whose shape tells the side apart
  const sh = Math.max(.4, 1 - air / 18); const col = o.dim ? '#6a6f7c' : teamColor(team), colD = o.dim ? '#2e323c' : teamColorD(team), colL = o.dim ? '#b8bcc8' : teamColorL(team);
  ctx.globalAlpha = .34 * a * sh; ellipse(cx, by, Math.round(9 * sh), Math.max(1, Math.round(3 * sh)), '#000000');
  ctx.globalAlpha = a; ellipseRing(cx, by + 1, 12, 4, 1, '#0b1020'); ellipseRing(cx, by, 12, 4, 1, col);
  const shape = teamShape(team);
  if (shape === 'spiked') { for (const [dx, dy] of [[-14, -1], [12, -1], [-1, -6], [-1, 4]]) { rect(cx + dx, by + dy, 3, 3, colD); px(cx + dx + 1, by + dy + 1, col); } }
  else if (shape === 'dashed') { ctx.globalAlpha = .9 * a; for (const [dx, dy] of [[-9, -3], [-4, -4], [1, -4], [6, -3], [-9, 2], [-4, 3], [1, 3], [6, 2]]) rect(cx + dx, by + dy, 2, 1, '#0b1020'); ctx.globalAlpha = a; }
  else if (shape === 'barred') { rect(cx - 5, by + 4, 10, 1, colL); rect(cx - 5, by + 5, 10, 1, colD); }
  ctx.globalAlpha = .8 * a; hline(cx - 4, by - 4, 6, colL); px(cx + 3, by - 4, '#ffffff');
  if (o.lit) { ctx.globalAlpha = o.lit * a; ellipseRing(cx, by, 12, 4, 1, '#ffffff'); }
  ctx.globalAlpha = 1;
}
function teamShape(team) { const me = typeof HT === 'function' && B ? HT() : 0; if (team === me) return 'ring'; if (team === 2) return 'dashed'; if (!hostile(team, me)) return 'barred'; return 'spiked'; }
// 5×5 team glyph used on HP plates and cards: ● own, ▲ hostile trainer, ◇ wild, + ally.
function teamGlyph(x, y, team, col) {
  const s = teamShape(team); const rows = s === 'ring' ? ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'] : s === 'spiked' ? ['..O..', '..O..', '.OOO.', '.OOO.', 'OOOOO'] : s === 'dashed' ? ['..O..', '.O.O.', 'O...O', '.O.O.', '..O..'] : ['..O..', '..O..', 'OOOOO', '..O..', '..O..'];
  stampAt(x, y, rows, { O: col });
}
// Portrait window background used by cards: team colour, diagonal light band, inner frame.
function portraitBg(x, y, w, h, team) {
  rect(x, y, w, h, teamColorD(team)); ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff'; for (let j = 0; j < h; j++) { const i0 = Math.max(0, w - 10 - j); ctx.fillRect(x + i0, y + j, Math.min(6, w - i0), 1); } ctx.globalAlpha = .35; ctx.fillStyle = '#000000'; for (let j = 0; j < h; j++) { const wdt = Math.max(0, 6 - j); if (wdt) ctx.fillRect(x, y + j, wdt, 1); } ctx.globalAlpha = 1;
  outline(x, y, w, h, shade(teamColorD(team), -.4)); hline(x + 1, y + 1, w - 2, shade(teamColorD(team), .25)); vline(x + 1, y + 1, h - 2, shade(teamColorD(team), .15));
}

// ---------------------------------------------------------------- UI icons (9×9 stamps)
const ICONS = {
  sword: ['......OO.', '.....OWWO', '....OWWO.', 'O..OWWO..', 'OO.OWO...', '.OOWO....', '..OOO....', '.OO.OO...', 'OO...O...'],
  ball: ['..OOOOO..', '.ORRRRRO.', 'ORRHRRRRO', 'ORRRRRRRO', 'OOOOWOOOO', 'OWWWOWWWO', 'OWWWWWWWO', '.OWWWWWO.', '..OOOOO..'],
  bag: ['...OOO...', '..O...O..', '.OOOOOOO.', '.OBBBBBO.', '.OBOOOBO.', '.OBBBBBO.', '.OBBBBBO.', '.OBBBBBO.', '.OOOOOOO.'],
  wait: ['OOOOOOOOO', '.OWWWWWO.', '.OWWWWWO.', '..OWWWO..', '...OWO...', '..OW.WO..', '.OW...WO.', '.OWWWWWO.', 'OOOOOOOOO'],
  flag: ['OO.......', 'OYYYYO...', 'OYYYYYYO.', 'OYYYYYYYO', 'OYYYYYYO.', 'OYYYYO...', 'OO.......', 'OO.......', 'OO.......'],
  end: ['..OOOOO..', '.OWWWWWO.', 'OWO...OWO', 'OO.....OO', '........O', 'OO....OWO', 'OWO..OWO.', '.OWOOWO..', '..OOOO...'],
  skull: ['..OOOOO..', '.OWWWWWO.', 'OWWWWWWWO', 'OWOWWWOWO', 'OWWWOWWWO', '.OWWWWWO.', '..OWOWO..', '..OWWWO..', '..OOOOO..'],
  help: ['..OOOOO..', '.OWWWWWO.', 'OWWOOOWWO', 'OOO..OWWO', '....OWWO.', '...OWWO..', '...OWO...', '...OO....', '...OO....'],
  note: ['....OOO..', '....OWWO.', '....OWOO.', '....OW...', '....OW...', '..OOOW...', '.OWWOW...', '.OWWWO...', '..OOO....'],
  run: ['...OOO...', '..OWWWO..', '..OWWWO..', 'OOOOWOOOO', 'OWWOWOWWO', 'OOOOWOOOO', '..OWOWO..', '.OWO.OWO.', 'OOO...OOO'],
  x: ['OO.....OO', 'OWO...OWO', '.OWO.OWO.', '..OWOWO..', '...OWO...', '..OWOWO..', '.OWO.OWO.', 'OWO...OWO', 'OO.....OO'],
  play: ['OO.......', 'OWOO.....', 'OWWWOO...', 'OWWWWWOO.', 'OWWWWWWWO', 'OWWWWWOO.', 'OWWWOO...', 'OWOO.....', 'OO.......'],
  map: ['OOOOOOOOO', 'OYYOGGOYO', 'OYYOGGOYO', 'OYYOGGOYO', 'OGGOYYOGO', 'OGGOYYOGO', 'OGGOYYOGO', 'OGGOYYOGO', 'OOOOOOOOO'],
  dice: ['.OOOOOOO.', 'OWOWWWWWO', 'OWWWWWOWO', 'OWWWWWWWO', 'OWWWOWWWO', 'OWWWWWWWO', 'OWOWWWWWO', 'OWWWWWOWO', '.OOOOOOO.'],
  vs: ['OO.....OO', 'OWO...OWO', '.OWO.OWO.', '..OWOWO..', '...OWO...', '..OWOWO..', '.OWOYOWO.', 'OWO.Y.OWO', 'OO..Y..OO'],
  crown: ['O...O...O', 'OO.OYO.OO', 'OYOYYYOYO', 'OYYYYYYYO', 'OYYYYYYYO', '.OYYYYYO.', '.OOOOOOO.', '.OYYYYYO.', '.OOOOOOO.'],
  book: ['.OOOOOOO.', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', '.OOOOOOO.'],
  skill: ['....O....', '...OWO...', '...OWO...', 'OOOOWOOOO', 'OWWWYWWWO', 'OOOOWOOOO', '...OWO...', '...OWO...', '....O....'],
  // role glyphs (unit cards, sheet, forecast): wing = scout, shield = defender, wave = amphibious, vine = controller, target = ranged, heart = support, sword = striker
  wing: ['........O', '......OWO', '....OWWWO', '..OWWWWO.', 'OWWWWWO..', '.OOWWO...', '...OWO...', '....OO...', '.........'],
  shield: ['OOOOOOOOO', 'OWWWWWWWO', 'OWWWOWWWO', 'OWWOWOWWO', 'OWWWOWWWO', '.OWWWWWO.', '..OWWWO..', '...OWO...', '....O....'],
  wave: ['.........', '..OO.....', '.OWWO..OO', 'OWOOWOOWO', 'OW..OWWWO', '.........', '..OO.....', '.OWWO..OO', 'OWOOWOOWO'],
  vine: ['....O....', '...OWO...', '..OWOWO..', '.OWO.OWO.', 'OWO...OWO', 'OO.OWO.OO', '...OWO...', '...OWO...', '....O....'],
  target: ['..OOOOO..', '.OWWWWWO.', 'OWOOOOOWO', 'OWOWWWOWO', 'OWOWOWOWO', 'OWOWWWOWO', 'OWOOOOOWO', '.OWWWWWO.', '..OOOOO..'],
  heart: ['.OO...OO.', 'OWWO.OWWO', 'OWWWOWWWO', 'OWWWWWWWO', 'OWWWWWWWO', '.OWWWWWO.', '..OWWWO..', '...OWO...', '....O....'],
};
// Draw a UI icon; `col` overrides the main (W) colour.
function iconAt(id, x, y, col) {
  const rows = ICONS[id]; if (!rows) return;
  stampAt(x, y, rows, { O: '#101828', W: col || '#f6f2e6', Y: UI.gold, R: '#ff5a5a', H: '#ffb0b0', B: '#c48a4a', G: '#6cbe4e', L: '#a6b0c8' });
}
