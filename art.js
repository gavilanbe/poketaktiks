// ============================================================================
// art.js — procedural pixel tiles (pre-rendered), cursor/arrow/range drawing,
// particles, small icons (Poké Ball, type badges, status badges).
// ============================================================================
'use strict';
const TILESET = {}; // key ch+variant+frame → canvas
const VARIANTS = 4, WATER_FRAMES = 4;
function tileCanvas() { const c = document.createElement('canvas'); c.width = TILE; c.height = TILE; return c; }
// Mini drawing API bound to an offscreen context.
function painter(g) {
  return {
    R: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
    P: (x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
    C: (cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    E: (cx, cy, rx, ry, c) => { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    TRI: (x0, y0, w, h, c) => { g.fillStyle = c; for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); g.fillRect(x0 + Math.round((w - ww) / 2), y0 + j, ww, 1); } },
  };
}
const PAL = {
  grass: '#6cbe4e', grassD: '#5fae43', grassL: '#86d466', grassDD: '#4d9a38', tall: '#519f3d', tallL: '#7fcf58', tallD: '#3e8530',
  tree: '#2f7d38', treeL: '#48a24a', treeH: '#73c95f', trunk: '#6b4729', trunkD: '#4a3019',
  rock: '#8b7d6b', rockD: '#6a5c4b', rockL: '#a89b88', snow: '#f3f5f8', cliff: '#5a5550', cliffL: '#7d766e', cliffH: '#9e968c', cliffD: '#3a3632',
  water: '#3d8ee3', waterD: '#2f70c2', waterL: '#7ec6ff', foam: '#dff4ff', plank: '#b98d55', plankD: '#8a6338', plankL: '#d4a86a',
  road: '#cbb38b', roadD: '#b39b74', roadL: '#dcc8a3', sand: '#ead893', sandD: '#d5c274', sandL: '#f6ebb0',
  cave: '#5b5064', caveD: '#493f51', caveL: '#6f6379', wall: '#2b2433', wallL: '#3f3549', wallH: '#54485f',
  floor: '#8a8292', floorD: '#746c7c', floorL: '#a099a8', bwall: '#3e3c4c', bwallL: '#55536a', bwallD: '#2a2834',
  lava: '#e84e1f', lavaL: '#ffb340', lavaD: '#b83410', ice: '#bfe9f9', iceL: '#e8f8ff', iceD: '#8fcbe6', snowD: '#d7e2f2',
};
function drawTile(ch, variant, frame, g) {
  const p = painter(g), r = mulberry32(ch.charCodeAt(0) * 977 + variant * 131 + 7); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const grassBase = () => { p.R(0, 0, 32, 32, PAL.grass); for (let i = 0; i < 6; i++) p.R(rr(0, 28), rr(0, 28), rr(2, 5), rr(1, 3), PAL.grassD); for (let i = 0; i < 5; i++) { const x = rr(1, 30), y = rr(2, 30); p.P(x, y, PAL.grassL); p.P(x + 1, y - 1, PAL.grassL); } };
  const caveBase = () => { p.R(0, 0, 32, 32, PAL.cave); for (let i = 0; i < 7; i++) p.R(rr(0, 28), rr(0, 28), rr(2, 4), rr(1, 2), PAL.caveD); for (let i = 0; i < 5; i++) p.P(rr(0, 31), rr(0, 31), PAL.caveL); };
  const floorBase = () => { p.R(0, 0, 32, 32, PAL.floor); for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) { p.R(x, y, 15, 15, ((x + y) / 16) % 2 ? PAL.floorD : PAL.floor); p.R(x, y, 15, 1, PAL.floorL); p.R(x, y, 1, 15, PAL.floorL); } };
  const waterBase = (f, dark) => { const W1 = dark ? '#2c4a7a' : PAL.water, W2 = dark ? '#213a62' : PAL.waterD, W3 = dark ? '#5a86c0' : PAL.waterL; p.R(0, 0, 32, 32, W1); const w = mulberry32(variant * 5 + 1); for (let i = 0; i < 4; i++) { const x = Math.floor(w() * 26), y = Math.floor(w() * 28); p.R(x, y, 4 + Math.floor(w() * 4), 2, W2); } for (let i = 0; i < 3; i++) { const bx = Math.floor(w() * 24), by = Math.floor(w() * 30); const x = (bx + f * 2 + i * 3) % 30, y = by; p.R(x, y, 4, 1, W3); p.P(x + 5, y, W3); } };
  const tree = (cx, cy, rad) => { p.E(cx, cy + rad, rad, 3, '#3d7a30'); p.R(cx - 1, cy + rad - 3, 3, 5, PAL.trunk); p.P(cx - 1, cy + rad - 3, PAL.trunkD); p.C(cx, cy, rad, PAL.tree); p.C(cx - 1, cy - 1, rad - 2, PAL.treeL); p.C(cx - 2, cy - 3, Math.max(1, rad - 4), PAL.treeH); p.P(cx + rad - 2, cy + 1, PAL.tree); p.P(cx - 3, cy + rad - 2, PAL.treeL); };
  const house = (roofCol, wallCol, sign) => { p.R(4, 12, 24, 16, '#3d6a34'); p.R(5, 13, 22, 14, wallCol); p.R(5, 26, 22, 1, shade(wallCol, -.35)); p.TRI(2, 4, 28, 9, roofCol); p.R(2, 12, 28, 2, shade(roofCol, -.3)); p.R(14, 20, 5, 7, '#5a3a20'); p.R(15, 21, 3, 5, '#7a5030'); p.R(7, 16, 4, 4, '#8fd0ff'); p.R(21, 16, 4, 4, '#8fd0ff'); p.P(8, 17, '#ffffff'); p.P(22, 17, '#ffffff'); if (sign) { p.R(11, 15, 10, 4, '#f4f0e6'); g.fillStyle = shade(roofCol, -.2); for (let i = 0; i < sign.length; i++) g.fillRect(12 + i * 3, 16, 2, 2); } };
  switch (ch) {
    case '.': grassBase(); break;
    case ',': grassBase(); for (let i = 0; i < 4; i++) { const x = rr(2, 28), y = rr(2, 28), c = vpick(['#ffffff', '#ffd6e8', '#fff08a', '#ffb0b0', '#c8b0ff']); p.P(x, y, c); p.P(x + 1, y, c); p.P(x, y + 1, c); p.P(x + 1, y + 1, c); p.P(x + 1, y + 1, '#f0b020'); p.P(x, y + 2, PAL.grassDD); } break;
    case 't': p.R(0, 0, 32, 32, PAL.tall); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 8 + (j & 1) * 4 + rr(-1, 1), y = j * 8 + rr(0, 2); p.R(x + 1, y, 1, 5, PAL.tallL); p.R(x + 3, y + 1, 1, 4, PAL.tallL); p.R(x + 5, y, 1, 5, PAL.tallD); p.P(x + 2, y + 5, PAL.tallD); p.P(x + 4, y + 5, PAL.tallD); } break;
    case 'T': grassBase(); if (variant % 2) { tree(10, 12, 8); tree(23, 19, 7); } else { tree(16, 13, 10); tree(6, 22, 5); } break;
    case 'M': grassBase(); { const w = 30, h = 27, x0 = 1, y0 = 3, cx = x0 + Math.floor(w / 2) + (variant % 2 ? 1 : -1); p.E(16, 29, 15, 3, '#4d9a38');
      for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); const xs = x0 + Math.round((w - ww) / 2); p.R(xs, y0 + j, ww, 1, PAL.rock); const lit = Math.max(1, Math.round(ww * .45)); p.R(xs, y0 + j, lit, 1, PAL.rockL); p.R(xs + ww - Math.max(1, Math.round(ww * .35)), y0 + j, Math.max(1, Math.round(ww * .35)), 1, PAL.rockD); }
      p.TRI(x0 + Math.round((w - 9) / 2), y0, 9, 6, PAL.snow); p.R(x0 + Math.round(w / 2) - 1, y0 + 6, 3, 1, PAL.snow); p.P(x0 + Math.round(w / 2) + 2, y0 + 7, PAL.snow); p.P(x0 + Math.round(w / 2) - 3, y0 + 7, PAL.snow);
      for (let i = 0; i < 5; i++) { const rx = 6 + rr(0, 20), ry = 12 + rr(0, 14); p.R(rx, ry, rr(2, 4), 1, PAL.cliffD); } for (let i = 0; i < 3; i++) p.P(8 + rr(0, 16), 14 + rr(0, 12), PAL.snow);
      p.R(x0, y0 + h - 1, w, 1, PAL.rockD); } break;
    case '^': p.R(0, 0, 32, 32, PAL.cliff); for (let i = 0; i < 5; i++) { const x = rr(2, 22), y = rr(2, 22), w = rr(7, 12), h = rr(5, 9); p.R(x, y, w, h, PAL.cliffL); p.R(x, y, w, 1, PAL.cliffH); p.R(x, y, 1, h, PAL.cliffH); p.R(x, y + h - 1, w, 1, PAL.cliffD); p.R(x + w - 1, y, 1, h, PAL.cliffD); } for (let i = 0; i < 6; i++) p.P(rr(0, 31), rr(0, 31), PAL.cliffD); break;
    case '~': waterBase(frame); break;
    case 'w': waterBase(frame, true); break;
    case '=': waterBase(frame); p.R(0, 3, 32, 26, PAL.plank); for (let x = 0; x < 32; x += 6) p.R(x, 3, 1, 26, PAL.plankD); p.R(0, 3, 32, 1, PAL.plankL); p.R(0, 28, 32, 1, PAL.plankD); p.R(0, 1, 32, 2, PAL.plankD); p.R(0, 29, 32, 2, PAL.plankD); for (let x = 2; x < 32; x += 8) { p.R(x, 0, 2, 4, PAL.plankL); p.R(x, 28, 2, 4, PAL.plankL); } break;
    case '#': p.R(0, 0, 32, 32, PAL.road); for (let i = 0; i < 8; i++) p.R(rr(0, 29), rr(0, 29), rr(1, 3), rr(1, 2), PAL.roadD); for (let i = 0; i < 5; i++) p.P(rr(0, 31), rr(0, 31), PAL.roadL); break;
    case 's': p.R(0, 0, 32, 32, PAL.sand); for (let i = 0; i < 7; i++) p.R(rr(0, 29), rr(0, 29), rr(2, 4), 1, PAL.sandD); for (let i = 0; i < 4; i++) p.R(rr(0, 29), rr(0, 29), 3, 1, PAL.sandL); break;
    case 'C': grassBase(); house('#e64848', '#f6f1e6', 'P'); p.R(15, 6, 3, 3, '#ffffff'); p.R(16, 5, 1, 5, '#ffffff'); break;
    case 'G': grassBase(); house('#3a6fd8', '#e8e4dc', 'GYM'); p.R(27, 2, 1, 12, '#f4f0e6'); p.R(28, 2, 4, 3, '#ffd24a'); break;
    case 'H': grassBase(); house(vpick(['#8a5a3a', '#6a7a9a', '#7a8a4a']), '#eee6d2', null); break;
    case 'c': caveBase(); break;
    case 'r': caveBase(); for (let i = 0; i < 4; i++) { const x = rr(2, 24), y = rr(2, 24), w = rr(4, 8), h = rr(3, 6); p.R(x, y, w, h, PAL.cliffL); p.R(x, y, w, 1, PAL.cliffH); p.R(x, y + h - 1, w, 1, PAL.cliffD); } break;
    case 'W': p.R(0, 0, 32, 32, PAL.wall); for (let i = 0; i < 6; i++) { const x = rr(0, 24), y = rr(0, 24), w = rr(6, 10), h = rr(5, 8); p.R(x, y, w, h, PAL.wallL); p.R(x, y, w, 1, PAL.wallH); p.R(x, y, 1, h, PAL.wallH); } for (let i = 0; i < 6; i++) p.P(rr(0, 31), rr(0, 31), PAL.wall); break;
    case 'f': floorBase(); break;
    case 'b': p.R(0, 0, 32, 32, PAL.bwall); for (let y = 0; y < 32; y += 8) for (let x = ((y / 8) & 1) * 8; x < 32; x += 16) { p.R(x, y, 15, 7, PAL.bwallL); p.R(x, y, 15, 1, shade(PAL.bwallL, .15)); p.R(x, y + 6, 15, 1, PAL.bwallD); } break;
    case 'L': p.R(0, 0, 32, 32, PAL.lava); { const w = mulberry32(variant * 9 + 3); for (let i = 0; i < 5; i++) { const x = (Math.floor(w() * 30) + frame * 2) % 30, y = Math.floor(w() * 30); p.R(x, y, 3 + Math.floor(w() * 4), 2, PAL.lavaL); } for (let i = 0; i < 4; i++) p.R(Math.floor(w() * 28), Math.floor(w() * 28), 4, 3, PAL.lavaD); } break;
    case 'p': floorBase(); p.R(10, 2, 12, 28, '#9a92a2'); p.R(10, 2, 2, 28, '#c0b8c8'); p.R(20, 2, 2, 28, '#5e5666'); p.R(8, 0, 16, 3, '#c0b8c8'); p.R(8, 28, 16, 4, '#7c7484'); break;
    case 'x': floorBase(); for (const [x, y] of [[3, 14], [16, 16], [8, 3]]) { p.R(x, y, 13, 12, PAL.plank); p.R(x, y, 13, 1, PAL.plankL); p.R(x, y, 1, 12, PAL.plankL); p.R(x, y + 11, 13, 1, PAL.plankD); p.R(x + 12, y, 1, 12, PAL.plankD); p.R(x + 1, y + 5, 11, 1, PAL.plankD); p.R(x + 6, y + 1, 1, 10, PAL.plankD); } break;
    case 'i': p.R(0, 0, 32, 32, PAL.ice); for (let i = 0; i < 4; i++) { const x = rr(0, 24), y = rr(0, 24); p.R(x, y, rr(4, 8), 1, PAL.iceL); p.R(x + 2, y + 2, 1, rr(3, 6), PAL.iceD); } break;
    case 'S': p.R(0, 0, 32, 32, PAL.snow); for (let i = 0; i < 6; i++) p.R(rr(0, 28), rr(0, 28), rr(2, 4), 1, PAL.snowD); for (let i = 0; i < 3; i++) p.P(rr(0, 31), rr(0, 31), '#ffffff'); break;
    default: p.R(0, 0, 32, 32, '#ff00ff');
  }
}
function buildTileset() {
  for (const ch in TERRAIN) for (let v = 0; v < VARIANTS; v++) {
    const frames = (ch === '~' || ch === 'w' || ch === '=' || ch === 'L') ? WATER_FRAMES : 1;
    for (let f = 0; f < frames; f++) { const c = tileCanvas(); drawTile(ch, v, f, c.getContext('2d')); TILESET[ch + v + f] = c; }
  }
}
function tileImg(ch, v, f) { const frames = (ch === '~' || ch === 'w' || ch === '=' || ch === 'L') ? WATER_FRAMES : 1; return TILESET[ch + (v % VARIANTS) + (f % frames)] || TILESET['.00']; }

// ---------------------------------------------------------------- range/cursor/arrow overlays
function rangeOverlay(cells, inSet, sx, sy, col, edgeCol, phase) {
  ctx.globalAlpha = .38;
  for (const c of cells) rect(sx + c.x * TILE, sy + c.y * TILE, TILE, TILE, col);
  ctx.globalAlpha = 1;
  ctx.fillStyle = edgeCol;
  for (const c of cells) {
    const X = sx + c.x * TILE, Y = sy + c.y * TILE;
    if (!inSet(c.x, c.y - 1)) ctx.fillRect(X, Y, TILE, 1); if (!inSet(c.x, c.y + 1)) ctx.fillRect(X, Y + TILE - 1, TILE, 1);
    if (!inSet(c.x - 1, c.y)) ctx.fillRect(X, Y, 1, TILE); if (!inSet(c.x + 1, c.y)) ctx.fillRect(X + TILE - 1, Y, 1, TILE);
  }
  // animated dither sparkle
  ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff';
  for (const c of cells) { const X = sx + c.x * TILE, Y = sy + c.y * TILE; for (let j = 0; j < TILE; j += 4) for (let i = ((j >> 2) + phase) % 4 * 1; i < TILE; i += 4) ctx.fillRect(X + i, Y + j, 1, 1); }
  ctx.globalAlpha = 1;
}
function drawCursor(x, y, t, col = '#ffffff', col2 = '#ffd24a') {
  const o = 2 + Math.round(Math.sin(t / 180) * 1.5); const L = 7;
  const corners = [[x - o, y - o, 1, 1], [x + TILE + o - 1, y - o, -1, 1], [x - o, y + TILE + o - 1, 1, -1], [x + TILE + o - 1, y + TILE + o - 1, -1, -1]];
  for (const [cx, cy, dx, dy] of corners) {
    rect(dx > 0 ? cx : cx - L + 1, cy, L, 2, UI.shadow); rect(cx, dy > 0 ? cy : cy - L + 1, 2, L, UI.shadow);
    rect(dx > 0 ? cx : cx - L + 1, cy, L, 1, col2); rect(cx, dy > 0 ? cy : cy - L + 1, 1, L, col2);
    rect(dx > 0 ? cx + 1 : cx - L + 1, cy + (dy > 0 ? 1 : 0), L - 1, 1, col); rect(cx + (dx > 0 ? 1 : 0), dy > 0 ? cy + 1 : cy - L + 1, 1, L - 1, col);
  }
}
// FE-style path arrow: thick orange with dark outline; segments join, arrowhead at the end.
function drawArrow(path, sx, sy) {
  if (path.length < 2) return;
  const half = TILE / 2, thick = 10, out = 2;
  const pos = c => [sx + c.x * TILE + half, sy + c.y * TILE + half];
  const seg = (a, b, col, t) => { const [ax, ay] = pos(a), [bx, by] = pos(b); const x0 = Math.min(ax, bx), y0 = Math.min(ay, by); const w = Math.abs(bx - ax), h = Math.abs(by - ay); if (w) rect(x0 - t / 2, ay - t / 2, w + t, t, col); else rect(ax - t / 2, y0 - t / 2, t, h + t, col); };
  for (let pass = 0; pass < 2; pass++) {
    const col = pass ? '#ffb02e' : '#7a3a00', t = pass ? thick : thick + out * 2;
    for (let i = 0; i < path.length - 2; i++) seg(path[i], path[i + 1], col, t);
    // last segment stops short so the arrowhead reads
    const a = path[path.length - 2], b = path[path.length - 1]; const [ax, ay] = pos(a), [bx, by] = pos(b); const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    const len = TILE - 8 - (pass ? 0 : 0); const ex = ax + dx * len, ey = ay + dy * len;
    if (dx) rect(Math.min(ax, ex) - t / 2, ay - t / 2, Math.abs(ex - ax) + t, t, col); else rect(ax - t / 2, Math.min(ay, ey) - t / 2, t, Math.abs(ey - ay) + t, col);
    // arrowhead triangle
    const hw = 9 + (pass ? 0 : out), hl = 9 + (pass ? 0 : out); ctx.fillStyle = col;
    for (let k = 0; k < hl; k++) { const w = Math.round(hw * (1 - k / hl)); if (w <= 0) break; if (dx) ctx.fillRect(ex + dx * k - (dx < 0 ? 1 : 0) - (pass ? 0 : 0), ay - w, 1, 2 * w + 1); else ctx.fillRect(ax - w, ey + dy * k - (dy < 0 ? 1 : 0), 2 * w + 1, 1); }
    if (pass) { const [fx, fy] = pos(path[0]); circle(fx, fy, 5, '#ffd24a'); }
    else { const [fx, fy] = pos(path[0]); circle(fx, fy, 7, col); }
  }
}

// ---------------------------------------------------------------- particles & floaters
const FX = { parts: [], texts: [], shake: 0, shakeX: 0, shakeY: 0, flash: 0, flashCol: '#ffffff', zoom: 0, hitstop: 0, slow: 0 };
function spawnParts(x, y, n, col, opt = {}) {
  if (REDUCED) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) { const a = vrnd() * Math.PI * 2, sp = (opt.speed || 60) * (0.4 + vrnd()); FX.parts.push({ x, y, vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp * (opt.flat ? .4 : 1) + (opt.vy || 0), life: (opt.life || .5) * (0.6 + vrnd() * .6), t: 0, col: Array.isArray(col) ? vpick(col) : col, size: opt.size || 2, grav: opt.grav == null ? 120 : opt.grav, shape: opt.shape || 'sq' }); }
}
function floatText(x, y, s, col = '#ffffff', opt = {}) { FX.texts.push({ x, y, s, col, t: 0, life: opt.life || 1, big: !!opt.big, outline: opt.outline || UI.shadow, vy: opt.vy == null ? -26 : opt.vy, delay: opt.delay || 0, pop: opt.pop !== false }); }
function updateFX(dt) {
  for (const p of FX.parts) { p.t += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  FX.parts = FX.parts.filter(p => p.t < p.life);
  for (const f of FX.texts) { if (f.delay > 0) { f.delay -= dt; continue; } f.t += dt; f.y += f.vy * dt * (f.t < .25 ? 1 : .25); }
  FX.texts = FX.texts.filter(f => f.t < f.life);
  if (FX.shake > 0) { FX.shake = Math.max(0, FX.shake - dt * 30); const m = REDUCED ? 0 : FX.shake; FX.shakeX = Math.round((vrnd() * 2 - 1) * m); FX.shakeY = Math.round((vrnd() * 2 - 1) * m); } else { FX.shakeX = FX.shakeY = 0; }
  if (FX.flash > 0) FX.flash = Math.max(0, FX.flash - dt * 4);
  if (FX.zoom > 0) FX.zoom = Math.max(0, FX.zoom - dt * 3);
}
function drawFX(ox, oy) {
  for (const p of FX.parts) { const k = 1 - p.t / p.life; const s = Math.max(1, Math.round(p.size * (k < .4 ? k / .4 : 1))); ctx.fillStyle = p.col; if (p.shape === 'ring') { const r = Math.round(p.size * (1 - k) * 3) + 2; ctx.globalAlpha = k; outline(p.x + ox - r, p.y + oy - r, 2 * r, 2 * r, p.col); ctx.globalAlpha = 1; } else ctx.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s); }
  for (const f of FX.texts) { if (f.delay > 0) continue; const k = f.t / f.life; ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; const pop = f.pop && f.t < .15 ? 1 + (1 - f.t / .15) * .5 : 1; const y = f.y + oy - (pop - 1) * 6; if (f.big) bigC(f.s, f.x + ox, y, f.col, { outline: f.outline }); else textC(f.s, f.x + ox, y, f.col, { outline: f.outline }); ctx.globalAlpha = 1; }
}
function shake(n) { FX.shake = Math.max(FX.shake, n); }
function flashScreen(col = '#ffffff', a = 1) { FX.flash = a; FX.flashCol = col; }

// ---------------------------------------------------------------- icons
function drawBall(x, y, col = '#f04848', r = 5) { circle(x, y, r, UI.shadow); circle(x, y, r - 1, '#f6f2e6'); ctx.fillStyle = col; for (let j = -r + 1; j < 0; j++) { const w = Math.floor(Math.sqrt((r - 1) * (r - 1) - j * j) + .5); ctx.fillRect(x - w, y + j, 2 * w + 1, 1); } hline(x - r + 1, y, 2 * r - 1, UI.shadow); circle(x, y, 2, UI.shadow); circle(x, y, 1, '#ffffff'); px(x - 2, y - 3, '#ffffff'); }
const TYPE_ABBR = { Normal: 'NRM', Fire: 'FIR', Water: 'WTR', Electric: 'ELC', Grass: 'GRS', Ice: 'ICE', Fighting: 'FGT', Poison: 'PSN', Ground: 'GRD', Flying: 'FLY', Psychic: 'PSY', Bug: 'BUG', Rock: 'RCK', Ghost: 'GHO', Dragon: 'DRG', Dark: 'DRK', Steel: 'STL', Fairy: 'FRY' };
function typeBadge(t, x, y, w = 24) { const c = TYPE_COL[t] || '#888'; rrect(x, y, w, 9, shade(c, -.45), 1); rrect(x + 1, y + 1, w - 2, 7, c, 0); hline(x + 2, y + 1, w - 4, shade(c, .3)); textC(w >= 40 ? t.toUpperCase() : TYPE_ABBR[t] || t.slice(0, 3).toUpperCase(), x + w / 2, y + 1, '#ffffff', { shadow: shade(c, -.5) }); }
function statusBadge(st, x, y) { const s = STATUS[st]; if (!s) return; rrect(x, y, 15, 8, shade(s.col, -.5), 1); rrect(x + 1, y + 1, 13, 6, s.col, 0); textC(s.name, x + 8, y + 1, '#ffffff', { shadow: shade(s.col, -.5) }); }
function teamColor(team) { return team === 0 ? '#3d7dff' : team === 1 ? '#ff4b4b' : team === 2 ? '#e0c040' : '#40d060'; }
function teamColorD(team) { return team === 0 ? '#1c3a8a' : team === 1 ? '#8a1c1c' : team === 2 ? '#7a6010' : '#1a6a30'; }
function pointerHand(x, y, t) { const b = Math.round(Math.sin(t / 120)) ; x += b; rect(x, y + 2, 6, 3, UI.shadow); rect(x + 1, y + 1, 6, 3, UI.gold); rect(x + 5, y, 2, 5, UI.gold); px(x + 6, y + 2, '#ffffff'); rect(x + 6, y + 1, 2, 3, '#ffffff'); }
