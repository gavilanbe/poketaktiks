// ============================================================================
// scenery.js — the painted panoramas of the Advance Wars style battle screen. Each half of a duel shows the
// terrain its Pokémon stands on (field, meadow, tall grass, forest, mountain, road, beach, sea, bridge, cave pool,
// town, cave, base, volcano, snow) as parallax layers painted once per size into offscreen canvases: sky, far,
// mid, ground and an optional front layer drawn over the Pokémon (tall grass, a bridge rail). Live touches —
// clouds, waves, falling leaves, snow, embers, blinking lights, crystal glints — are drawn over them each frame.
// Everything is procedural and pixel-crisp, lit from the upper left like the board tiles.
// ============================================================================
'use strict';
const SCENE_PAD = 28; // extra width on each side of every layer, room for the parallax
const SCENE_CACHE = new Map();
const HEX32 = new Map();
function hex32(h) { let v = HEX32.get(h); if (v === undefined) { const n = parseInt(h.slice(1, 7), 16); v = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; HEX32.set(h, v); } return v; }
// An offscreen layer painted straight into a 32-bit pixel buffer (fast for whole-screen art), exposing the same
// drawing calls as painter() so the tile helpers (shadeBlobs, tallClump, the building kit) paint into it too.
function sceneLayer(w, h) {
  const c = tileCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), buf = new Uint32Array(img.data.buffer);
  const R = (x, y, ww, hh, col) => { const v = hex32(col), x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(w, (x + ww) | 0), y1 = Math.min(h, (y + hh) | 0); if (x1 <= x0) return; for (let j = y0; j < y1; j++) buf.fill(v, j * w + x0, j * w + x1); };
  const P = (x, y, col) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = hex32(col); };
  const p = { g, P, R, H: (x, y, ww, col) => R(x, y, ww, 1, col), V: (x, y, hh, col) => R(x, y, 1, hh, col),
    C: (cx, cy, r, col) => { for (let y = -r; y <= r; y++) { const ww = Math.floor(Math.sqrt(r * r - y * y) + .5); R(cx - ww, cy + y, 2 * ww + 1, 1, col); } },
    E: (cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) { const ww = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + .5); R(cx - ww, cy + y, 2 * ww + 1, 1, col); } },
    TRI: (x0, y0, ww, hh, col) => { for (let j = 0; j < hh; j++) { const k = Math.round(ww * (j + 1) / hh); R(x0 + Math.round((ww - k) / 2), y0 + j, k, 1, col); } },
    S: (x, y, rows, pal) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch !== '.' && ch !== ' ' && pal[ch]) P(x + i, y + j, pal[ch]); } },
    CLEAR: (x, y, ww, hh) => { for (let j = Math.max(0, y); j < Math.min(h, y + hh); j++) buf.fill(0, j * w + Math.max(0, x), j * w + Math.min(w, x + ww)); },
    get: (x, y) => x >= 0 && y >= 0 && x < w && y < h ? buf[y * w + x] : 0 };
  return { p, w, h, done() { g.putImageData(img, 0, 0); return c; } };
}
const SCN = {
  sky: {
    day: ['#3862bc', '#4270c4', '#4f80cc', '#5e90d4', '#70a2dc', '#86b6e4', '#a0caee', '#bcdcf4'],
    warm: ['#3a66be', '#4776c6', '#5888ce', '#6c9cd6', '#86b0dc', '#a4c4e0', '#c6d6de', '#e6dcc4'],
    forest: ['#2c5484', '#366290', '#42709c', '#5080a8', '#6292b4', '#76a4c0', '#8eb6ca'],
    snow: ['#58709a', '#6680a6', '#7690b2', '#88a0bc', '#9cb2c8', '#b2c4d4', '#c8d6e2', '#dee8f0'],
    cave: ['#07060a', '#0b090e', '#100d14', '#15111a', '#1b1621', '#211b28', '#282130'],
    base: ['#0a0c12', '#0e1118', '#12161f', '#171c27', '#1c2230', '#232a3a', '#2b3244'],
    volcano: ['#0c0203', '#150405', '#1f0706', '#2c0a08', '#3e0f0a', '#56170c', '#74240f', '#9a3614'],
  },
  far: ['#34496c', '#40587c', '#4e688c', '#607c9e', '#7892b2'],
  farGreen: ['#244a4a', '#2e5854', '#3a6860', '#4a7a6e', '#5e907e'],
  hills: ['#1c4a32', '#26603c', '#327446', '#428a50', '#58a05e', '#72b872'],
  grass: ['#2a6232', '#34723a', '#3f8440', '#4b9646', '#58a84e', '#68b858', '#80c86a'],
  forestFloor: ['#15361f', '#1c4426', '#23522c', '#2b6032', '#346e38', '#3e7c40'],
  soil: ['#3a2e28', '#4a3c34', '#5a4a40', '#6c5a4c', '#806c5a', '#96806a'],
  sand: ['#a08248', '#b8985a', '#ceb070', '#e0c688', '#eed8a2', '#f8e8c0'],
  sea: ['#163e7a', '#1c4c90', '#245ca6', '#2e6eba', '#3c82ca', '#5298d8', '#70b0e4', '#94c8ee'],
  pool: ['#0a1628', '#0e1e36', '#142846', '#1a3256', '#223e68', '#2e4e7c'],
  snowG: ['#8a98bc', '#a2b0d0', '#bac6e0', '#d0dcee', '#e4ecf6', '#f4f8fc'],
  caveG: ['#1e1824', '#28202f', '#322a3a', '#3e3448', '#4a3f56', '#584c66'],
  caveWall: ['#100c14', '#16121c', '#1d1824', '#251f2e', '#2e2738', '#383044'],
  plaza: ['#56505e', '#6a6472', '#7e7886', '#948e9a', '#aaa4ae', '#c0bac4'],
  metal: ['#23252f', '#2e303c', '#3a3d4a', '#484b5a', '#585b6c', '#6c6f82', '#868a9c'],
  basalt: ['#110b0b', '#1a1210', '#241915', '#30221c', '#3c2b23', '#4a352b'],
};
// Vertical gradient between y0 and y1 in flat bands joined by a checker dither.
function sceneGradient(p, w, y0, y1, ramp) {
  const n = ramp.length - 1;
  for (let y = y0; y < y1; y++) { const v = (y - y0) / Math.max(1, y1 - y0) * n, i = Math.min(n, Math.floor(v)), fr = v - i;
    if (fr > .7 && i < n) for (let x = 0; x < w; x++) p.P(x, y, (x + y) & 1 ? ramp[i + 1] : ramp[i]); else p.H(0, y, w, ramp[i]); }
}
const tri01 = v => 1 - 2 * Math.abs(((v % 1) + 1) % 1 - .5);
// A mountain range: triangle-wave peaks, faces lit toward the west, a darker rim on shaded tops, snow on the high
// peaks, a hazy foot that fades into the horizon colour.
function sceneRange(p, w, base, amp, R, ramp, snow, haze) {
  const f1 = .011 + R() * .006, f2 = .027 + R() * .012, f3 = .07 + R() * .03, a1 = R() * 9, a2 = R() * 9, a3 = R() * 9;
  const top = x => Math.round(base - amp * (.56 * tri01(x * f1 + a1) + .32 * tri01(x * f2 + a2) + .12 * tri01(x * f3 + a3)));
  for (let x = 0; x < w; x++) { const t = top(x), lit = top(x + 2) - top(x - 2) <= 0, high = t < base - amp * .5, sd = 3 + ((x * 7) % 4) + (lit ? 1 : 0);
    for (let y = t; y <= base + 1; y++) { const d = (y - t) / Math.max(1, base - t); let c = lit ? (y - t < 2 ? ramp[4] : ramp[3]) : (y === t ? ramp[0] : ramp[1]);
      if (snow && high && y - t < sd) c = lit ? '#f2f6fc' : '#c4d0e4'; else if (snow && high && y - t === sd) c = lit ? '#d4def0' : '#9eaccc';
      if (haze && d > .72 && ((x + y) & 1)) c = haze; if (haze && d > .9) c = haze; p.P(x, y, c); } }
  return top;
}
// Rolling hills with a lit crest, darkening downward.
function sceneHills(p, w, base, amp, R, ramp) {
  const f1 = .018 + R() * .01, f2 = .05 + R() * .02, a1 = R() * 9, a2 = R() * 9;
  const top = x => Math.round(base - amp * (.55 + .3 * Math.sin(x * f1 + a1) + .15 * Math.sin(x * f2 + a2)));
  for (let x = 0; x < w; x++) { const t = top(x); p.P(x, t, ramp[5]); p.P(x, t + 1, ramp[4]); for (let y = t + 2; y <= base + 3; y++) { const d = (y - t) / Math.max(1, base - t); p.P(x, y, d < .45 ? ramp[3] : d < .55 && ((x + y) & 1) ? ramp[3] : ramp[2]); } }
  return top;
}
// A round tree for the panoramas: shaded canopy lobes with foliage marks and a trunk down to its base.
function sceneTree(p, x, by, r, R, ramp = RAMP.leaf) {
  const K = PAL.trunk, cy = by - r - Math.round(r * .5);
  p.R(x - 2, cy + Math.round(r * .5), 4, by - cy - Math.round(r * .5), K.m); p.V(x - 2, cy + Math.round(r * .5), by - cy - Math.round(r * .5), K.l); p.V(x + 1, cy + Math.round(r * .5), by - cy - Math.round(r * .5), K.d);
  const lobes = [{ x, y: cy - r * .15, rx: r * .82, ry: r * .72 }, { x: x - r * .48, y: cy + r * .2, rx: r * .6, ry: r * .52 }, { x: x + r * .5, y: cy + r * .18, rx: r * .58, ry: r * .5 }, { x, y: cy + r * .42, rx: r * .7, ry: r * .45 }];
  const at = shadeBlobs(p, lobes, ramp, RAMP.leafOut, { bias: -.22, gain: 1.15 });
  for (const b of lobes) for (let i = 0; i < Math.round(b.rx * .8); i++) { const a = -2.4 + R() * 1.4, d = .3 + R() * .5, lx = Math.round(b.x + Math.cos(a) * b.rx * d), ly = Math.round(b.y + Math.sin(a) * b.ry * d); if (at(lx, ly) >= 0 && at(lx + 3, ly + 1) >= 0) { p.P(lx, ly + 1, ramp[5]); p.H(lx + 1, ly, 2, ramp[6]); p.P(lx + 3, ly + 1, ramp[5]); } const a2 = .3 + R() * 1.4, lx2 = Math.round(b.x + Math.cos(a2) * b.rx * d), ly2 = Math.round(b.y + Math.sin(a2) * b.ry * d); if (at(lx2, ly2) >= 0 && at(lx2 + 2, ly2 + 1) >= 0) { p.P(lx2, ly2, ramp[1]); p.H(lx2 + 1, ly2 + 1, 2, ramp[1]); } }
}
// A pine: stacked needle tiers lit on the left, optionally loaded with snow.
function scenePine(p, x, by, h, snow) {
  const P = RAMP.pine, cells = new Map(), put = (px, py, c) => cells.set(px + ',' + py, c);
  p.R(x - 1, by - 4, 3, 5, PAL.trunk.d);
  const tiers = [[by - 3, Math.round(h * .46), Math.round(h * .62)], [by - 3 - Math.round(h * .3), Math.round(h * .4), Math.round(h * .5)], [by - 3 - Math.round(h * .56), Math.round(h * .36), Math.round(h * .36)]];
  for (const [bot, th, w] of tiers) for (let j = 0; j < th; j++) { const y = bot - th + 1 + j, hw = Math.max(0, Math.round((w / 2) * (j + 1) / th)); for (let px = x - hw; px <= x + hw; px++) { const rel = (px - x) / Math.max(1, hw); let v = .78 - rel * .32 - (j / th) * .28; if (j === th - 1 && (px & 1)) v -= .18; let c = rampAt(P, v, px, y); if (snow && (j < 2 || (j < 4 && rel < .2)) && (px + j) % 3) c = j === 0 || rel < -.2 ? '#f4f8fc' : '#c8d4e8'; put(px, y, c); } }
  for (const k of cells.keys()) { const [cx, cy] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has((cx + dx) + ',' + (cy + dy))) p.P(cx + dx, cy + dy, RAMP.leafOut); }
  for (const [k, c] of cells) { const [cx, cy] = k.split(',').map(Number); p.P(cx, cy, c); }
}
// A ground band from the horizon to the bottom: hazy near the horizon, richer toward the viewer, with a lit lip.
function sceneGround(p, w, hz, h, ramp) {
  const n = ramp.length;
  for (let y = hz; y < h; y++) { const d = (y - hz) / Math.max(1, h - hz), v = (1 - Math.pow(d, .7)) * (n - 2) + 1, i = Math.floor(v), fr = v - i;
    if (fr > .6 && i + 1 < n) for (let x = 0; x < w; x++) p.P(x, y, (x + y) & 1 ? ramp[i + 1] : ramp[i]); else p.H(0, y, w, ramp[Math.min(n - 1, i)]); }
  p.H(0, hz, w, ramp[n - 1]);
}
// Scatter marks over the ground, sized and spaced by depth (small and dense near the horizon).
function sceneScatter(w, hz, h, R, density, fn) {
  for (let y = hz + 2; y < h; y += 2) { const d = (y - hz) / Math.max(1, h - hz), step = 10 + d * 34; for (let x = R() * step; x < w; x += step * (.6 + R() * .8)) if (R() < density) fn(Math.round(x), y, d); }
}
const grassTuft = (p, x, y, d, ramp) => { const s = d < .3 ? 0 : d < .65 ? 1 : 2; if (s === 0) { p.P(x, y, ramp[5]); p.P(x + 2, y, ramp[5]); p.P(x + 1, y + 1, ramp[2]); } else if (s === 1) { p.P(x, y - 1, ramp[6]); p.P(x + 3, y - 1, ramp[6]); p.P(x, y, ramp[5]); p.P(x + 1, y, ramp[5]); p.P(x + 3, y, ramp[5]); p.H(x, y + 1, 4, ramp[2]); } else { p.P(x + 1, y - 2, ramp[6]); p.P(x + 4, y - 2, ramp[6]); p.P(x, y - 1, ramp[5]); p.P(x + 1, y - 1, ramp[5]); p.P(x + 4, y - 1, ramp[5]); p.P(x + 5, y - 1, ramp[5]); p.H(x, y, 6, ramp[4]); p.H(x + 1, y + 1, 5, ramp[2]); } };
// Letters for painted signs (5×5).
const SIGN_FONT = { P: ['RRRR.', 'R...R', 'RRRR.', 'R....', 'R....'], C: ['.RRRR', 'R....', 'R....', 'R....', '.RRRR'], G: ['.RRRR', 'R....', 'R..RR', 'R...R', '.RRRR'], Y: ['R...R', '.R.R.', '..R..', '..R..', '..R..'], M: ['R...R', 'RR.RR', 'R.R.R', 'R...R', 'R...R'], H: ['R...R', 'R...R', 'RRRRR', 'R...R', 'R...R'], Q: ['.RRR.', 'R...R', 'R...R', 'R..R.', '.RR.R'] };
function signText(p, x, y, s, col) { for (const ch of s) { const g = SIGN_FONT[ch]; if (g) p.S(x, y, g, { R: col }); x += 6; } }

// ---------------------------------------------------------------- the kinds
// Which panorama a side shows: the tile its Pokémon stands on, read against the map's mood.
function sceneKind(q, u) {
  const id = q.terr[u.id].id, b = q.biome;
  if (id === 'water') return b === 'cave' || b === 'interior' || b === 'volcano' ? 'pool' : 'sea';
  if (id === 'bridge') return 'bridge';
  if (id === 'lava') return 'volcano';
  if (id === 'forest') return 'forest';
  if (id === 'mountain' || id === 'rock') return 'mountain';
  if (id === 'road') return 'road';
  if (id === 'sand') return 'beach';
  if (id === 'snow' || id === 'ice') return 'snow';
  if (id === 'tall') return 'tall';
  if (id === 'flower') return 'meadow';
  if (id === 'floor' || id === 'bwall' || id === 'pillar' || id === 'crate') return 'base';
  if (id === 'cave' || id === 'rubble' || id === 'wall') return b === 'volcano' ? 'volcano' : 'cave';
  if (id === 'center' || id === 'hq' || id === 'gym' || id === 'house') return b === 'interior' ? 'base' : b === 'cave' ? 'cave' : b === 'volcano' ? 'volcano' : 'town';
  return b === 'snow' ? 'snow' : b === 'volcano' ? 'volcano' : b === 'cave' ? 'cave' : b === 'interior' ? 'base' : 'field';
}
// Paint (or fetch) the layers of one panorama. `hz` is the horizon, `gy` the line the Pokémon stands on, `tile`
// the terrain id (the town shows the building the Pokémon stands in front of).
function sceneFor(kind, W, H, hz, gy, seed, tile) {
  const key = [kind, W, H, hz, gy, seed & 3, tile].join(':'); let S = SCENE_CACHE.get(key); if (S) return S;
  if (SCENE_CACHE.size > 24) SCENE_CACHE.clear();
  const LW = W + 2 * SCENE_PAD, R = mulberry32(seed * 7919 + kind.length * 131 + 17);
  const sky = sceneLayer(LW, H), far = sceneLayer(LW, H), mid = sceneLayer(LW, H), gnd = sceneLayer(LW, H); let front = null; const fx = { lights: [], crystals: [], tips: [], waterY: null, crater: null };
  const grassy = kind === 'field' || kind === 'meadow' || kind === 'tall' || kind === 'road' || kind === 'town';
  const skyRamp = kind === 'forest' ? SCN.sky.forest : kind === 'snow' ? SCN.sky.snow : kind === 'cave' || kind === 'pool' ? SCN.sky.cave : kind === 'base' ? SCN.sky.base : kind === 'volcano' ? SCN.sky.volcano : kind === 'beach' || kind === 'sea' || kind === 'bridge' ? SCN.sky.warm : SCN.sky.day;
  sceneGradient(sky.p, LW, 0, hz + 3, skyRamp);
  if (grassy || kind === 'mountain' || kind === 'sea' || kind === 'bridge' || kind === 'beach') { const sx = Math.round(LW * (.62 + R() * .2)), sy = Math.round(hz * .26); for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { const d = Math.hypot(x, y); if (d < 12 && d > 7 && dith(sx + x, sy + y) < (12 - d) / 10) sky.p.P(sx + x, sy + y, skyRamp[skyRamp.length - 1]); } sky.p.C(sx, sy, 6, '#fff4c8'); sky.p.C(sx - 1, sy - 1, 4, '#ffffff'); }
  switch (kind) {
    case 'field': case 'meadow': case 'tall': case 'road': case 'town': {
      sceneRange(far.p, LW, hz - 8, 46 + R() * 16, R, SCN.far, true, skyRamp[skyRamp.length - 2]);
      sceneRange(far.p, LW, hz - 2, 22 + R() * 8, R, SCN.farGreen, false, null);
      const hill = sceneHills(mid.p, LW, hz + 1, 12 + R() * 6, R, SCN.hills);
      if (kind === 'town') sceneTown(mid.p, LW, hz, R, tile); else for (let x = 10 + R() * 30; x < LW; x += 26 + R() * 40) sceneTree(mid.p, Math.round(x), hill(Math.round(x)) + 3, 4 + Math.round(R() * 4), R);
      if (kind === 'town') { sceneGround(gnd.p, LW, hz, H, SCN.plaza); scenePlaza(gnd.p, LW, hz, H, gy); }
      else { sceneGround(gnd.p, LW, hz, H, SCN.grass); sceneScatter(LW, hz, H, R, .55, (x, y, d) => grassTuft(gnd.p, x, y, d, SCN.grass)); }
      if (kind === 'meadow') sceneScatter(LW, hz, H, R, .45, (x, y, d) => { const c = ['#f05a5a', '#ffffff', '#ffd83a', '#ff8ac0'][Math.floor(R() * 4)]; if (d < .35) gnd.p.P(x, y, c); else { gnd.p.P(x, y - 1, c); gnd.p.P(x - 1, y, c); gnd.p.P(x + 1, y, c); gnd.p.P(x, y, '#ffd24a'); gnd.p.P(x, y + 1, SCN.grass[1]); if (d > .7) { gnd.p.P(x, y - 2, c); gnd.p.P(x - 2, y, c); gnd.p.P(x + 2, y, c); } } });
      if (kind === 'tall') { for (let row = 0; row < 5; row++) { const y = Math.round(hz + 6 + Math.pow(row / 4, 1.4) * (gy - hz - 2)), sc = .45 + row * .2; for (let x = (row % 2) * 7 + R() * 4; x < LW; x += 9 + row * 3) tallClump(gnd.p, Math.round(x), y, sc, 0, 0); }
        front = sceneLayer(LW, H); for (let x = R() * 6; x < LW; x += 13) tallClump(front.p, Math.round(x), gy + 6, 1.35, (x % 3) - 1, 0); }
      if (kind === 'road') sceneRoad(gnd.p, LW, gy, R);
      break;
    }
    case 'forest': {
      for (let x = 0; x < LW; x++) { const t = Math.round(hz - 22 - 9 * Math.abs(Math.sin(x * .09 + 1.3)) - 5 * Math.abs(Math.sin(x * .23 + .4))); for (let y = t; y <= hz + 1; y++) far.p.P(x, y, y === t ? '#2e5a40' : y < t + 3 ? '#224a34' : '#1a3c2a'); }
      for (let x = 6 + R() * 10; x < LW + 20; x += 20 + R() * 16) sceneTree(mid.p, Math.round(x), hz + 5, 13 + Math.round(R() * 8), R);
      sceneGround(gnd.p, LW, hz, H, SCN.forestFloor);
      sceneScatter(LW, hz, H, R, .6, (x, y, d) => { const k = R(); if (k < .5) grassTuft(gnd.p, x, y, d, SCN.grass); else if (k < .8) { gnd.p.P(x, y, ['#b86a2a', '#d8923a', '#8a4a20'][Math.floor(R() * 3)]); if (d > .5) gnd.p.P(x + 1, y, '#6a3a18'); } else if (d > .5) { gnd.p.R(x - 1, y - 2, 3, 2, '#d83a3a'); gnd.p.P(x - 1, y - 2, '#ffffff'); gnd.p.P(x + 1, y - 1, '#ffffff'); gnd.p.V(x, y, 2, '#f0e4d0'); } });
      break;
    }
    case 'mountain': {
      sceneRange(far.p, LW, hz - 6, 70 + R() * 14, R, SCN.far, true, skyRamp[skyRamp.length - 2]);
      sceneRange(mid.p, LW, hz + 3, 28 + R() * 10, R, [RAMP.rock[0], RAMP.rock[2], RAMP.rock[3], RAMP.rock[4], RAMP.rock[5]], false, null);
      for (let x = R() * 20; x < LW; x += 18 + R() * 30) { const r = 3 + Math.round(R() * 4); shadeBlobs(mid.p, [{ x, y: hz + 2 - r * .4, rx: r * 1.3, ry: r }], RAMP.rock, RAMP.rockOut, { bias: -.05 }); }
      sceneGround(gnd.p, LW, hz, H, SCN.soil);
      sceneScatter(LW, hz, H, R, .4, (x, y, d) => { if (R() < .6) { const r = Math.max(1, Math.round(d * 4)); if (r > 1) shadeBlobs(gnd.p, [{ x, y, rx: r * 1.4, ry: r }], RAMP.rock, RAMP.rockOut, { bias: -.05 }); else { gnd.p.P(x, y, RAMP.rock[4]); gnd.p.P(x + 1, y, RAMP.rock[2]); } } else grassTuft(gnd.p, x, y, d, SCN.grass); });
      break;
    }
    case 'sea': case 'bridge': case 'beach': {
      const seaTop = kind === 'beach' ? hz - 12 : hz;
      for (let i = 0; i < 3; i++) { const cx = Math.round(R() * LW), w = 18 + R() * 30; for (let x = -w; x <= w; x++) { const hgt = Math.round((1 - (x * x) / (w * w)) * (6 + R() * .5 + w * .12)); for (let y = 0; y < hgt; y++) far.p.P(cx + x, seaTop - y, y === hgt - 1 ? '#6a9a86' : x < 0 ? '#4a7a6a' : '#3a6456'); } }
      const seaRows = kind === 'beach' ? hz + 1 : H; for (let y = seaTop; y < seaRows; y++) { const d = (y - seaTop) / Math.max(1, (kind === 'beach' ? 14 : H - seaTop)), i = Math.max(0, Math.min(SCN.sea.length - 1, Math.round((1 - d) * (SCN.sea.length - 2)) + 1)); (kind === 'beach' ? far : gnd).p.H(0, y, LW, SCN.sea[i]); }
      if (kind === 'beach') { for (let x = 0; x < LW; x++) { const y = hz + Math.round(Math.sin(x * .15) * 1.2); mid.p.P(x, y, '#ffffff'); mid.p.P(x, y + 1, '#d8ecf8'); } sceneGround(gnd.p, LW, hz + 2, H, SCN.sand); sceneScatter(LW, hz + 2, H, R, .5, (x, y, d) => { const len = 3 + Math.round(d * 8); for (let k = 0; k < len; k++) { gnd.p.P(x + k, y + Math.round(Math.sin(k * .6) * .8), SCN.sand[1]); gnd.p.P(x + k, y - 1 + Math.round(Math.sin(k * .6) * .8), SCN.sand[5]); } if (R() < .15 && d > .5) { gnd.p.S(x, y - 3, ['.hh.', 'hphp', '.pp.'], { h: '#fff0f0', p: '#f0a8b0' }); } }); break; }
      for (let y = seaTop + 2; y < H; y += 2) { const d = (y - seaTop) / Math.max(1, H - seaTop), step = 8 + d * 30; for (let x = R() * step; x < LW; x += step * (.7 + R() * .6)) { const len = 1 + Math.round(d * 6); gnd.p.H(Math.round(x), y, len, SCN.sea[Math.min(7, 5 + Math.round(d * 2))]); if (d > .3) gnd.p.H(Math.round(x) + 1, y + 1, len, SCN.sea[1]); } }
      fx.waterY = gy - 6;
      if (kind === 'bridge') sceneBridge(gnd.p, LW, gy, (front = sceneLayer(LW, H)).p);
      break;
    }
    case 'cave': case 'pool': {
      sceneCaveWall(far.p, LW, hz, R, fx);
      for (let x = R() * 30; x < LW; x += 30 + R() * 50) { const h = 10 + Math.round(R() * 22), w = 5 + Math.round(R() * 5); for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w * (j + 1) / h)); for (let dx = -hw; dx <= hw; dx++) mid.p.P(Math.round(x) + dx, hz + 3 - h + j, dx < -hw / 3 ? SCN.caveWall[5] : dx < hw / 3 ? SCN.caveWall[4] : SCN.caveWall[2]); } mid.p.P(Math.round(x), hz + 3 - h, SCN.caveWall[5]); }
      if (kind === 'pool') { for (let y = hz; y < H; y++) { const d = (y - hz) / Math.max(1, H - hz); gnd.p.H(0, y, LW, SCN.pool[Math.max(0, Math.min(5, Math.round((1 - d) * 4) + 1))]); } for (let y = hz + 2; y < H; y += 3) { const d = (y - hz) / Math.max(1, H - hz), step = 10 + d * 30; for (let x = R() * step; x < LW; x += step) gnd.p.H(Math.round(x), y, 1 + Math.round(d * 5), SCN.pool[5]); } fx.waterY = gy - 6; }
      else { sceneGround(gnd.p, LW, hz, H, SCN.caveG); sceneScatter(LW, hz, H, R, .45, (x, y, d) => { const k = R(); if (k < .6) { const r = Math.max(1, Math.round(d * 3)); if (r > 1) shadeBlobs(gnd.p, [{ x, y, rx: r * 1.4, ry: r }], RAMP.crock, RAMP.crockOut, { bias: -.08 }); else { gnd.p.P(x, y, SCN.caveG[5]); gnd.p.P(x + 1, y, SCN.caveG[1]); } } else if (k < .85) { for (let i = 0; i < 3 + d * 6; i++) { gnd.p.P(x + i, y, SCN.caveG[0]); gnd.p.P(x + i, y + 1, SCN.caveG[4]); } } else if (d > .4) gnd.p.S(x, y - 4, ['.h.', 'hld', 'lld', '.d.'], { h: '#e8fbff', l: '#8ad4f4', d: '#3a78b4' }); }); }
      break;
    }
    case 'base': {
      sceneBaseWall(far.p, LW, hz, R, fx);
      for (let x = R() * 20; x < LW; x += 34 + R() * 40) { if (R() < .55) sceneCrates(mid.p, Math.round(x), hz + 3, R); else sceneConsole(mid.p, Math.round(x), hz + 3, fx); }
      sceneGround(gnd.p, LW, hz, H, SCN.metal); sceneFloorTiles(gnd.p, LW, hz, H);
      break;
    }
    case 'volcano': {
      const cx = Math.round(LW * (.35 + R() * .3)); sceneVolcano(far.p, LW, hz, cx, fx);
      for (let x = 0; x < LW; x++) { const t = Math.round(hz + 2 - 8 * tri01(x * .045 + .3) - 4 * tri01(x * .13)); for (let y = t; y <= hz + 3; y++) mid.p.P(x, y, y === t ? '#c85a1e' : y === t + 1 ? '#6a2a14' : SCN.basalt[2]); }
      if (q_isLava(tile)) { for (let y = hz + 2; y < H; y++) gnd.p.H(0, y, LW, PAL.lava.m); for (let y = hz + 3; y < H; y += 2) { const d = (y - hz) / Math.max(1, H - hz); for (let x = R() * 20; x < LW; x += 12 + d * 26) gnd.p.H(Math.round(x), y, 2 + Math.round(d * 7), R() < .5 ? PAL.lava.l : PAL.lava.ll); } fx.lava = true; }
      else { sceneGround(gnd.p, LW, hz + 2, H, SCN.basalt);
        // a few long glowing cracks meandering toward the viewer, and small pools of lava with bright hearts
        for (let i = 0; i < 4; i++) { let x = R() * LW, y = hz + 4 + R() * 8; while (y < H) { const d = (y - hz) / Math.max(1, H - hz); gnd.p.P(Math.round(x), Math.round(y), PAL.lava.ll); gnd.p.P(Math.round(x) + 1, Math.round(y), PAL.lava.l); if (d > .4) gnd.p.P(Math.round(x) - 1, Math.round(y), PAL.lava.m); x += (R() - .5) * 3; y += .7 + d * .6; } }
        for (let i = 0; i < 3; i++) { const x = Math.round(R() * LW), y = Math.round(hz + 10 + R() * (H - hz - 20)), d = (y - hz) / Math.max(1, H - hz), rx = Math.round(4 + d * 12), ry = Math.max(1, Math.round(rx * .28)); gnd.p.E(x, y, rx + 1, ry + 1, SCN.basalt[0]); gnd.p.E(x, y, rx, ry, PAL.lava.m); gnd.p.E(x - 1, y, Math.max(1, rx - 3), Math.max(0, ry - 1), PAL.lava.l); gnd.p.H(x - (rx >> 1), y - Math.max(0, ry - 1), rx >> 1, PAL.lava.ll); } }
      break;
    }
    case 'snow': {
      sceneRange(far.p, LW, hz - 6, 56 + R() * 14, R, ['#6a7c9c', '#7c8eac', '#90a2bc', '#aab8cc', '#c8d2e0'], true, skyRamp[skyRamp.length - 2]);
      sceneHills(mid.p, LW, hz + 1, 10, R, ['#9aaac4', '#b0bed4', '#c6d2e4', '#dae4f0', '#eef2f8', '#ffffff']);
      for (let x = 8 + R() * 20; x < LW; x += 20 + R() * 26) scenePine(mid.p, Math.round(x), hz + 3, 16 + Math.round(R() * 10), true);
      sceneGround(gnd.p, LW, hz, H, SCN.snowG);
      sceneScatter(LW, hz, H, R, .3, (x, y, d) => { const w = 3 + Math.round(d * 10); for (let k = -w; k <= w; k++) { gnd.p.P(x + k, y + 1, SCN.snowG[1]); if (Math.abs(k) < w - 1) gnd.p.P(x + k, y, '#ffffff'); } });
      if (tile === 'ice') for (let k = 0; k < 6; k++) { const x0 = Math.round(R() * LW), y0 = gy - 4 + Math.round(R() * 14); for (let i = 0; i < 16; i++) gnd.p.P(x0 + i, y0 + (i >> 2), i % 5 ? '#ffffff' : '#bde4f8'); }
      break;
    }
  }
  // a soft darker strip where the ground meets the viewer, for depth
  for (let y = H - 3; y < H; y++) for (let x = 0; x < LW; x++) if (((x + y) & 1) || y === H - 1) { const cur = gnd.p.get(x, y); if (cur) gnd.p.P(x, y, '#0c1018'); }
  S = { kind, sky: sky.done(), far: far.done(), mid: mid.done(), ground: gnd.done(), front: front ? front.done() : null, fx, LW };
  SCENE_CACHE.set(key, S); return S;
}
function q_isLava(tile) { return tile === 'lava'; }
// A dirt road across the half at the Pokémon's line: grass lips, ruts, pebbles, a fence along its far edge.
function sceneRoad(p, w, gy, R) {
  const Rd = PAL.road, y0 = gy - 11, y1 = gy + 9, G = SCN.grass;
  p.R(0, y0, w, y1 - y0, Rd.m); for (let y = y0 + 2; y < y1 - 2; y += 3) for (let x = R() * 20; x < w; x += 14 + R() * 20) p.H(Math.round(x), y, 2 + Math.round(R() * 4), R() < .5 ? Rd.l : mix(Rd.m, Rd.d, .5));
  p.H(0, y0 + 5, w, mix(Rd.m, Rd.d, .35)); p.H(0, y1 - 5, w, mix(Rd.m, Rd.d, .35));
  for (let x = 0; x < w; x += 2 + Math.floor(R() * 3)) { const d1 = 1 + Math.floor(R() * 2), d2 = 1 + Math.floor(R() * 2); for (let k = 0; k < d1; k++) p.P(x, y0 + k, G[4]); p.P(x, y0 + d1, G[1]); p.P(x, y0 + d1 + 1, Rd.d); for (let k = 0; k < d2; k++) p.P(x, y1 - 1 - k, G[4]); p.P(x, y1 - 1 - d2, G[5]); }
  for (let i = 0; i < w / 18; i++) { const x = Math.round(R() * w), y = y0 + 4 + Math.round(R() * (y1 - y0 - 8)); p.P(x, y, Rd.ll); p.P(x + 1, y, '#fff4d0'); p.P(x, y + 1, Rd.d); p.P(x + 1, y + 1, Rd.d); }
  const K = PAL.plank; for (let x = 4; x < w; x += 22) { p.R(x - 1, y0 - 12, 4, 12, PAL.outW); p.R(x, y0 - 11, 2, 11, K.l); p.V(x + 1, y0 - 11, 11, K.d); }
  for (const ry of [y0 - 10, y0 - 5]) { p.H(0, ry, w, PAL.outW); p.H(0, ry + 1, w, K.ll); p.H(0, ry + 2, w, K.d); }
}
// A wooden deck across the water at the Pokémon's line, posts into the water, a back rail; the front rail goes to
// the front layer so it passes in front of the Pokémon's feet.
function sceneBridge(p, w, gy, fp) {
  const K = PAL.plank, y0 = gy - 9, y1 = gy + 6;
  for (let x = 16; x < w; x += 40) { p.R(x - 2, y1, 5, 40, PAL.outW); p.R(x - 1, y1, 3, 40, K.d); p.V(x - 1, y1, 40, K.m); }
  p.R(0, y0, w, y1 - y0, '#3a2414'); for (let x = 0; x < w; x += 5) { p.R(x, y0 + 1, 4, y1 - y0 - 2, K.m); p.V(x, y0 + 1, y1 - y0 - 2, K.l); p.V(x + 3, y0 + 1, y1 - y0 - 2, K.d); p.P(x + 1, y0 + 2, K.nail); p.P(x + 1, y1 - 3, K.nail); }
  p.H(0, y0, w, K.ll); p.R(0, y1, w, 3, K.d); p.H(0, y1 + 3, w, PAL.outW);
  for (const [pp, ry, post] of [[p, y0 - 10, 10], [fp, y1 - 1, 7]]) { for (let x = 6; x < w; x += 24) { pp.R(x - 1, ry, 4, post + 1, PAL.outW); pp.R(x, ry, 2, post, K.l); pp.P(x, ry, K.ll); pp.V(x + 1, ry + 1, post - 1, K.d); } pp.H(0, ry + 1, w, PAL.outW); pp.H(0, ry + 2, w, K.ll); pp.H(0, ry + 3, w, K.m); pp.H(0, ry + 4, w, PAL.outW); }
}
// Paving stones in perspective, a grass verge at the horizon.
function scenePlaza(p, w, hz, h, gy) {
  const Z = SCN.plaza; let y = hz + 3, k = 0; p.R(0, hz, w, 3, SCN.grass[4]); p.H(0, hz + 2, w, SCN.grass[1]);
  while (y < h) { const rh = Math.max(2, Math.round(2 + (y - hz) * .16)), tw = rh * 3; for (let x = -((k * tw) >> 1) % tw; x < w; x += tw) { p.H(x, y, tw - 1, Z[5]); p.V(x + tw - 1, y, rh, Z[1]); } p.H(0, y + rh - 1, w, Z[1]); y += rh; k++; }
}
// The town behind a Pokémon in a town: cottages and trees along the horizon, and the building of its own tile
// (a Poké Center, a Gym or an HQ) large behind it.
function sceneTown(p, w, hz, R, tile) {
  const base = hz + 2, big = tile === 'center' ? 'center' : tile === 'gym' ? 'gym' : tile === 'hq' ? 'hq' : null, bx = Math.round(w * (.3 + R() * .4));
  const cottage = (x, rr) => { const ww = 26 + Math.round(R() * 8), R2 = [ROOF_RAMP.brown, ROOF_RAMP.blue, ROOF_RAMP.green, ROOF_RAMP.plum][Math.floor(R() * 4)]; bldWalls(p, x, ww, base - 16, base + 1, ['#d8caa8', '#b8a88a', '#ece2c8', '#fbf4e2']); bldRoof(p, x, ww, base - 26, base - 17, R2, 4); bldChimney(p, x + ww - 8, base - 28); bldWin(p, x + 4, base - 12, R() < .4, true); bldDoor(p, x + ww - 11, base - 10, 6, 9, '#8a5430', false); };
  for (let x = 4 + R() * 20; x < w; x += 44 + R() * 30) { if (big && Math.abs(x + 16 - bx) < 52) continue; if (R() < .6) cottage(Math.round(x), R); else sceneTree(p, Math.round(x) + 12, base, 7 + Math.round(R() * 3), R); }
  if (big === 'center') { const x0 = bx - 30, ww = 60; bldWalls(p, x0, ww, base - 24, base + 1, ['#e2dccc', '#c8c0b0', '#f6f2e8', '#ffffff'], false); p.R(x0, base - 6, ww, 3, '#d84040'); p.H(x0, base - 6, ww, '#f06a5a'); bldRoof(p, x0, ww, base - 40, base - 25, ROOF_RAMP.red, 7);
    p.C(bx, base - 38, 6, BOUT); p.C(bx, base - 38, 5, '#e83c3c'); p.R(bx - 5, base - 38, 11, 6, '#ffffff'); p.H(bx - 6, base - 38, 13, BOUT); p.C(bx, base - 38, 1, '#ffffff'); p.P(bx - 3, base - 41, '#ff9a88');
    p.R(bx - 15, base - 22, 30, 9, BOUT); p.R(bx - 14, base - 21, 28, 7, '#fff8e8'); signText(p, bx - 11, base - 20, 'PC', '#d83838'); bldGlassDoor(p, bx - 7, base - 11, 14, 10); bldWin(p, x0 + 5, base - 18, false, false); bldWin(p, x0 + ww - 12, base - 18, false, false); }
  else if (big === 'gym') { const x0 = bx - 30, ww = 60; bldWalls(p, x0, ww, base - 24, base + 1, ['#b8bccc', '#a0a4b8', '#dde0ea', '#f4f6fa'], false); bldRoof(p, x0, ww, base - 38, base - 25, ROOF_RAMP.slate, 7); p.H(x0 - 3, base - 25, ww + 6, '#e0a020');
    for (const cx of [x0 + 3, x0 + ww - 7]) { p.R(cx - 1, base - 23, 6, 23, BOUT); p.R(cx, base - 23, 4, 23, '#f4f6fa'); p.V(cx, base - 23, 23, '#ffffff'); p.V(cx + 3, base - 23, 23, '#a8adbf'); }
    p.R(bx - 16, base - 22, 32, 9, BOUT); p.R(bx - 15, base - 21, 30, 7, '#ffd24a'); signText(p, bx - 9, base - 20, 'GYM', '#3a2000'); p.R(bx - 7, base - 12, 14, 12, BOUT); p.R(bx - 6, base - 11, 12, 11, '#6a4a30'); p.V(bx, base - 11, 11, '#2a1a10'); p.P(bx - 2, base - 6, '#ffd24a'); p.P(bx + 1, base - 6, '#ffd24a'); }
  else if (big === 'hq') { const x0 = bx - 30, ww = 60; bldWalls(p, x0, ww, base - 26, base + 1, ['#6a6a78', '#5a5a68', '#9a9aa8', '#bcbcc8'], false); for (let y = base - 22; y < base - 2; y += 4) for (let x = x0 + ((y >> 2) & 1) * 4; x < x0 + ww - 4; x += 8) { p.H(x, y, 7, '#aaaab6'); p.H(x, y + 3, 8, '#7a7a88'); }
    bldRoof(p, x0, ww, base - 38, base - 27, ROOF_RAMP.red, 5); for (let x = x0; x < x0 + ww; x += 6) { p.R(x, base - 29, 3, 3, '#9a9aa8'); p.P(x, base - 29, '#c8c8d4'); } bldFlag(p, bx, base - 48, '#d8d8e0');
    p.R(bx - 9, base - 16, 18, 16, BOUT); p.R(bx - 8, base - 15, 16, 15, '#5a3a24'); for (let x = bx - 8; x < bx + 8; x += 3) p.V(x, base - 15, 15, '#6a4a30'); p.H(bx - 8, base - 11, 16, '#3a3a44'); p.H(bx - 8, base - 5, 16, '#3a3a44'); p.V(bx, base - 15, 15, '#2a1a10'); }
}
// The back wall of a cave: packed rock, stalactites hanging from the top with their tips remembered for drips,
// glowing crystal clusters remembered for glints.
function sceneCaveWall(p, w, hz, R, fx) {
  const C = SCN.caveWall; p.R(0, 0, w, hz + 3, C[0]);
  // big rock masses of uneven size, darker toward the top of the cave, packed so the gaps read as deep joints
  for (let y = hz - 4; y > -20; y -= 9 + R() * 6) for (let x = -10 + R() * 12; x < w + 10; x += 16 + R() * 18) { const rx = 8 + R() * 9, ry = 5 + R() * 5, lift = 1 - y / hz; shadeBlobs(p, [{ x, y, rx, ry }, { x: x + rx * .4, y: y - ry * .3, rx: rx * .6, ry: ry * .6 }], lift > .7 ? C.slice(0, 4) : C.slice(1), C[0], { bias: -.2 - lift * .25 }); }
  // stalactites: tapering spikes with a lit west edge, outlined, their tips remembered for drips
  for (let x = R() * 20; x < w; x += 16 + R() * 30) { const h = 12 + Math.round(R() * 36), wd = 3 + Math.round(R() * 4), X = Math.round(x);
    for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(wd * (1 - j / h))); p.P(X - hw - 1, j, C[0]); p.P(X + hw + 1, j, C[0]); for (let dx = -hw; dx <= hw; dx++) p.P(X + dx, j, dx < -hw / 3 ? C[5] : dx <= hw / 3 ? C[4] : C[2]); } p.P(X, h, C[0]); fx.tips.push({ x: X, y: h }); }
  for (let i = 0; i < 5; i++) { const x = Math.round(R() * (w - 10)), y = Math.round(hz * .3 + R() * hz * .55); p.S(x, y, ['...h..', '..hl..', '.hlld.', 'hllddh', '.lldd.', '..dd..'], { h: '#e8fbff', l: '#8ad4f4', d: '#3a78b4' }); fx.crystals.push({ x: x + 2, y: y + 1 }); }
}
// An industrial wall: steel panels with rivets, pipes, a hazard stripe at the foot, lamps remembered for blinking.
function sceneBaseWall(p, w, hz, R, fx) {
  const M = SCN.metal; p.R(0, 0, w, hz + 2, M[1]);
  for (let x = 0; x < w; x += 28) { p.R(x + 1, 0, 26, hz, M[2]); p.V(x + 1, 0, hz, M[4]); p.V(x + 26, 0, hz, M[0]); for (let y = 6; y < hz; y += 18) { p.P(x + 4, y, M[5]); p.P(x + 23, y, M[5]); } }
  for (const py of [Math.round(hz * .35), Math.round(hz * .35) + 7]) { p.R(0, py, w, 5, M[0]); p.H(0, py + 1, w, M[5]); p.H(0, py + 2, w, M[4]); p.H(0, py + 3, w, M[3]); for (let x = 12; x < w; x += 46) { p.R(x, py - 1, 4, 7, M[0]); p.V(x + 1, py, 5, M[6]); } }
  for (let x = 0; x < w; x++) for (let y = hz - 7; y < hz - 1; y++) p.P(x, y, ((x + y) >> 2) & 1 ? '#e8c040' : '#2a2a30');
  p.H(0, hz - 8, w, M[0]); p.H(0, hz - 1, w, M[0]);
  for (let x = 20 + R() * 20; x < w; x += 56 + R() * 30) { const y = Math.round(hz * .62); p.R(Math.round(x) - 3, y - 2, 7, 5, M[0]); fx.lights.push({ x: Math.round(x), y, col: R() < .5 ? '#ff4a4a' : '#5aff8a', ph: R() * 6 }); }
}
function sceneCrates(p, x, base, R) { const K = PAL.plank, box = (bx, by, s) => { p.R(bx - 1, by - 1, s + 2, s + 2, PAL.outW); p.R(bx, by, s, s, K.m); p.H(bx, by, s, K.ll); p.V(bx, by, s, K.l); p.V(bx + s - 1, by, s, K.d); p.H(bx, by + s - 1, s, K.d); for (let k = 0; k < s - 2; k++) { p.P(bx + 1 + k, by + 1 + k, K.d); p.P(bx + s - 2 - k, by + 1 + k, K.d); } }; box(x, base - 14, 14); box(x + 15, base - 12, 12); if (R() < .6) box(x + 5, base - 27, 12); }
function sceneConsole(p, x, base, fx) { const M = SCN.metal; p.R(x - 1, base - 20, 30, 21, M[0]); p.R(x, base - 19, 28, 19, M[3]); p.H(x, base - 19, 28, M[5]); p.R(x + 3, base - 16, 14, 8, '#0c1e18'); p.H(x + 4, base - 14, 6, '#5aff8a'); p.H(x + 4, base - 11, 10, '#2a8a5a'); for (let i = 0; i < 3; i++) { p.R(x + 20, base - 16 + i * 4, 4, 2, M[1]); fx.lights.push({ x: x + 21, y: base - 16 + i * 4, col: ['#ffd24a', '#5aff8a', '#ff4a4a'][i], ph: i * 2 }); } }
// Perspective floor tiles: rows that grow toward the viewer, bevelled joints.
function sceneFloorTiles(p, w, hz, h) {
  const F = PAL.floor; let y = hz + 2, k = 0;
  while (y < h) { const rh = Math.max(2, Math.round(3 + (y - hz) * .2)), tw = rh * 4; for (let x = -((k * tw) >> 1) % tw; x < w; x += tw) { p.R(x, y, tw, rh, k % 2 ? F.m : mix(F.m, F.l, .4)); p.H(x, y, tw - 1, F.ll); p.V(x + tw - 1, y, rh, F.d); } p.H(0, y + rh - 1, w, F.grout); y += rh; k++; }
}
// A volcano cone on the horizon: basalt faces lit orange from below, a glowing crater (remembered for its glow
// and smoke), lava streams down its sides.
function sceneVolcano(p, w, hz, cx, fx) {
  const top = Math.round(hz * .35), crater = 9;
  for (let x = 0; x < w; x++) { const dx = Math.abs(x - cx), t = dx < crater ? top : Math.round(top + (dx - crater) * .75 + Math.sin(x * .3) * 1.5); for (let y = Math.max(0, t); y <= hz + 2; y++) { const lit = x < cx, d = (y - t) / Math.max(1, hz - t); p.P(x, y, y === t ? (dx < crater ? '#ffb040' : '#5a2a1e') : lit ? (d > .8 ? '#3a1c16' : SCN.basalt[4]) : (d > .8 ? '#2a1410' : SCN.basalt[2])); } }
  for (let x = cx - crater + 1; x < cx + crater; x++) { p.P(x, top, '#ffe08a'); p.P(x, top + 1, '#ff8a2c'); }
  for (const s of [-1, 1]) { let x = cx + s * 3, y = top + 2; while (y < hz) { p.P(x, y, '#ff6a1e'); p.P(x + s, y, '#ffb040'); y += 1; if ((y & 3) === 0) x += s; } }
  fx.crater = { x: cx, y: top };
}

// ---------------------------------------------------------------- drawing
function duelScene(q, u, L) { const f = L.f, p = f.pos[u.id]; if (!q.scenes) q.scenes = {}; let S = q.scenes[u.id]; if (!S || S.W !== f.Wf || S.H !== f.Hf) { const kind = sceneKind(q, u); S = sceneFor(kind, f.Wf, f.Hf, p.y - 40, p.y, q.seed + (p.dir > 0 ? 0 : 1), q.terr[u.id].id); S = Object.assign({ W: f.Wf, H: f.Hf }, S); q.scenes[u.id] = S; } return S; }
// The static layers behind a side, with parallax: the camera offset moves the ground fully, the far range a little.
function drawScenery(q, u, L, cam, t) {
  const S = duelScene(q, u, L), px = k => Math.round(-SCENE_PAD + cam.x * k), py = k => Math.round(cam.y * k), K = S.kind, f = L.f, hz = f.pos[u.id].y - 40;
  ctx.drawImage(S.sky, -SCENE_PAD, 0);
  // clouds drift across outdoor skies
  if (!['cave', 'pool', 'base', 'volcano'].includes(K) && !REDUCED) { const R = mulberry32(q.seed + 11); for (let i = 0; i < 4; i++) { const cw = 14 + Math.round(R() * 16), cy = Math.round(hz * (.12 + R() * .38)), span = S.LW + 80, cx = ((R() * span + t * (2 + i * .8)) % span) - 40 + px(.05); const sh = K === 'snow' ? '#b8c6d8' : '#c8def0'; for (const [ox, oy, r] of [[0, 0, cw * .45], [-cw * .45, 2, cw * .32], [cw * .42, 2, cw * .3], [cw * .1, -3, cw * .3]]) circle(Math.round(cx + ox), Math.round(cy + oy + 2), Math.round(r), sh); for (const [ox, oy, r] of [[0, 0, cw * .45], [-cw * .45, 2, cw * .32], [cw * .42, 2, cw * .3], [cw * .1, -3, cw * .3]]) circle(Math.round(cx + ox), Math.round(cy + oy), Math.max(1, Math.round(r) - 1), '#ffffff'); } }
  if (K === 'volcano' && S.fx.crater && !REDUCED) { const c = S.fx.crater, x = c.x + px(.15); for (let i = 0; i < 5; i++) { const k = (t * .25 + i / 5) % 1; ctx.globalAlpha = (1 - k) * .45; circle(Math.round(x + Math.sin(k * 5 + i) * 4 + k * 10), Math.round(c.y - 4 - k * 36), Math.round(3 + k * 9), '#3a2a2a'); } ctx.globalAlpha = .18 + .08 * Math.sin(t * 3); circle(x, c.y, 14, '#ff8a2c'); ctx.globalAlpha = 1; }
  ctx.drawImage(S.far, px(.15), py(.15));
  if (S.fx.crystals.length && !REDUCED) for (const c of S.fx.crystals) { const k = (t * .7 + c.x * .013) % 1; if (k < .12) { const x = c.x + px(.15), L2 = Math.round(Math.sin(k / .12 * Math.PI) * 3); rect(x - L2, c.y, 2 * L2 + 1, 1, '#ffffff'); rect(x, c.y - L2, 1, 2 * L2 + 1, '#ffffff'); } }
  if (S.fx.lights.length) for (const l of S.fx.lights) if (REDUCED || Math.sin(t * 3 + l.ph) > -.2) { rect(l.x - 1 + px(.15), l.y - 1, 3, 3, l.col); px2(l.x + px(.15), l.y, '#ffffff'); }
  ctx.drawImage(S.mid, px(.4), py(.4));
  ctx.drawImage(S.ground, px(1), py(1));
  // water: highlights that slide back and forth, a glint here and there
  if ((K === 'sea' || K === 'bridge' || K === 'pool') && !REDUCED) { const R = mulberry32(q.seed + 5), top = hz, bot = f.Hf, lite = K === 'pool' ? SCN.pool[5] : '#d8ecff'; for (let i = 0; i < 26; i++) { const y = Math.round(top + 3 + R() * (bot - top - 4)), d = (y - top) / Math.max(1, bot - top), x = Math.round(R() * S.LW + Math.sin(t * (1 + R()) + i) * (2 + d * 5)) + px(1), len = 1 + Math.round(d * 5); if (Math.sin(t * 2 + i) > 0) rect(x, y + py(1), len, 1, lite); } }
  if (S.fx.lava && !REDUCED) { ctx.globalAlpha = .12 + .08 * Math.sin(t * 4); rect(0, hz, S.LW, f.Hf - hz, '#ffe08a'); ctx.globalAlpha = 1; }
}
function px2(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
// What passes in front of the Pokémon: the front layer (tall grass, a rail) and the falling weather of the kind
// (leaves in a forest, snow, embers, cave dust).
function drawSceneryFront(q, u, L, cam, t) {
  const S = duelScene(q, u, L), K = S.kind, f = L.f; if (S.front) ctx.drawImage(S.front, Math.round(-SCENE_PAD + cam.x), Math.round(cam.y));
  if (REDUCED) return; const R = mulberry32(q.seed + 29 + (f.pos[u.id].dir > 0 ? 0 : 7)), W = f.Wf, H = f.Hf;
  if (K === 'forest') for (let i = 0; i < 6; i++) { const sp = 10 + R() * 12, k = (t * sp / H + R()) % 1, x = Math.round(R() * W + Math.sin(t * 2 + i) * 8), y = Math.round(k * H), fl = Math.floor(t * 6 + i) % 2; rect(x, y, fl ? 3 : 2, fl ? 2 : 3, ['#d8923a', '#b86a2a', '#7cc45e'][i % 3]); }
  else if (K === 'snow') for (let i = 0; i < 26; i++) { const sp = 12 + R() * 16, k = (t * sp / H + R()) % 1, x = Math.round((R() * W + Math.sin(t * 1.5 + i) * 6 + t * 4) % W), y = Math.round(k * H); rect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#ffffff'); }
  else if (K === 'volcano') for (let i = 0; i < 14; i++) { const sp = 14 + R() * 20, k = (t * sp / H + R()) % 1, x = Math.round(R() * W + Math.sin(t * 2 + i) * 4), y = Math.round(H - k * H); rect(x, y, 1, 1, i % 3 ? '#ff8a2c' : '#ffd25a'); }
  else if (K === 'cave' || K === 'pool') { for (let i = 0; i < 8; i++) { const k = (t * .05 + R()) % 1, x = Math.round(R() * W + Math.sin(t + i) * 6), y = Math.round(20 + ((R() * (H - 40) + t * 3) % (H - 40))); ctx.globalAlpha = .5 * Math.sin(k * Math.PI); rect(x, y, 1, 1, '#c8b8d8'); } ctx.globalAlpha = 1;
    for (const tip of S.fx.tips.slice(0, 4)) { const k = (t * .6 + tip.x * .07) % 1, x = tip.x + Math.round(-SCENE_PAD + cam.x * .15), y = Math.round(tip.y + k * (f.pos[u.id].y - 40 - tip.y)); if (k < .9) rect(x, y, 1, 2, '#8ad4f4'); } }
}
