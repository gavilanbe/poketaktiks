// ============================================================================
// title.js — the title screen, drawn as pixel art at the game's own resolution: a dusk sky in dithered bands, a
// striped sun, parallax mountains, a shimmering lake, a cliff where the starters wait, and a hand-drawn wordmark.
// Nothing here loads an image except the Pokémon sprites, so the screen works (and is tested) before any art arrives.
// ============================================================================
'use strict';
// ---------------------------------------------------------------- the wordmark
// Glyphs on a 6×8 grid of cells ('#' = filled); a cell is 2-4 px depending on the screen. É carries two accent rows.
const LOGO_GLYPHS = {
  P: ['#####.', '######', '##..##', '##..##', '######', '#####.', '##....', '##....'],
  K: ['##..##', '##.##.', '####..', '###...', '###...', '####..', '##.##.', '##..##'],
  E: ['######', '######', '##....', '#####.', '#####.', '##....', '######', '######'],
  'É': ['...##.', '..##..', '######', '######', '##....', '#####.', '#####.', '##....', '######', '######'],
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  A: ['.####.', '######', '##..##', '##..##', '######', '######', '##..##', '##..##'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  S: ['.#####', '######', '##....', '#####.', '.#####', '....##', '######', '#####.'],
};
const LOGO_FACE = ['#fffbe0', '#fff1a0', '#ffe04e', '#ffc823', '#f9a912', '#ee8c0a'];
const LOGO = { cache: new Map() };
// One letter as two canvases: `back` (drop shadow, navy and blue outline) and `face` (the gold fill with its lit edges),
// drawn in two passes so neighbouring outlines never cut into a letter.
function logoLetter(ch, cell) {
  const key = ch + cell; let L = LOGO.cache.get(key); if (L) return L;
  const rows = LOGO_GLYPHS[ch], P = 4, gw = rows[0].length * cell, gh = rows.length * cell, W = gw + P * 2, H = gh + P * 2 + 3;
  const m = new Uint8Array(W * H), at = (x, y) => x >= 0 && y >= 0 && x < W && y < H ? m[y * W + x] : 0;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === '#') for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) m[(P + r * cell + j) * W + P + c * cell + i] = 1;
  // round every outside corner by one pixel so the blocks read as lettering, not tiles
  const cut = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) && ((!at(x - 1, y) && !at(x, y - 1)) || (!at(x + 1, y) && !at(x, y - 1)) || (!at(x - 1, y) && !at(x, y + 1)) || (!at(x + 1, y) && !at(x, y + 1)))) cut.push(y * W + x); for (const i of cut) m[i] = 0;
  const grow = (src, diag) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (src[y * W + x]) { o[y * W + x] = 1; continue; } let hit = 0; for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) { if (!diag && dx && dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && src[Y * W + X]) { hit = 1; break; } } o[y * W + x] = hit; } return o; };
  const blue = grow(grow(m, true), false), navy = grow(blue, true);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const back = mk(), face = mk(), shine = mk(), bg = back.getContext('2d'), fg = face.getContext('2d'), sg = shine.getContext('2d');
  const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (y >= 3 && navy[(y - 3) * W + x] && !navy[i]) dot(bg, x, y, 'rgba(8,6,30,.55)'); }
  const top = P, bot = P + gh;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (navy[i] && !blue[i]) dot(bg, x, y, '#10133e'); else if (blue[i] && !m[i]) dot(bg, x, y, y < (top + bot) / 2 ? '#4a86ea' : '#2c58b6'); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue; const v = (y - top) / gh; let k = Math.min(LOGO_FACE.length - 1, Math.floor(v * LOGO_FACE.length));
    if (((x + y) & 1) && v * LOGO_FACE.length - k > .7 && k < LOGO_FACE.length - 1) k++; // dithered seam between bands
    let c = LOGO_FACE[k]; if (!at(x, y - 1)) c = '#ffffff'; else if (!at(x, y + 1)) c = '#c96a08'; else if (!at(x - 1, y) && v < .6) c = '#fff6c8'; else if (!at(x + 1, y) && v > .45) c = '#e07c06';
    dot(fg, x, y, c); dot(sg, x, y, '#ffffff');
  }
  L = { back, face, shine, w: gw, h: gh, P }; LOGO.cache.set(key, L); return L;
}
// Wordmark geometry for a cell size: "POKÉ" on top (a Poké Ball stands in for its O) and "TAKTIKS" under it, arched.
function logoMetrics(cell) {
  const small = Math.max(2, cell - 1), gap = n => n; const width = (word, c) => [...word].reduce((s, ch) => s + (ch === 'O' ? 8 * c : LOGO_GLYPHS[ch][0].length * c) + gap(c), -gap(c));
  const top = width('POKÉ', small), bottom = width('TAKTIKS', cell), h = 10 * small + 8 * cell + 5 + cell * 2;
  return { cell, small, w: Math.max(top, bottom) + 8, h, top, bottom };
}
function logoCell(W, H, maxW) { for (const c of [4, 3, 2]) { const m = logoMetrics(c); if (m.w <= maxW && m.h <= H * .3) return c; } return 2; }
// Draws the wordmark centred on cx with its top at y. Letters drop in one by one, land with a bounce, then breathe; a
// shine sweeps through every few seconds and sparkles pop on the letters. Registers the letter boxes for taps.
function drawLogo(cx, y, cell) {
  const M = logoMetrics(cell), fx = SC.titleFx || {}, t = SC.t; SC.titleLetters = [];
  const placed = [];
  const line = (word, c, yy, row, arch) => {
    const chars = [...word]; let x = Math.round(cx - (row ? M.bottom : M.top) / 2);
    chars.forEach((ch, i) => {
      const w = ch === 'O' ? 8 * c : LOGO_GLYPHS[ch][0].length * c, gh = (ch === 'É' ? 10 : 8) * c;
      const delay = .08 + row * .32 + i * .055, u = REDUCED ? 1 : clamp((titleTime() - delay) / .42, 0, 1);
      const land = u >= 1 ? 0 : Math.round(-(1 - easeOutBounce(u)) * (40 + row * 10));
      const wave = REDUCED ? 0 : Math.round(Math.sin(t * 2.1 + i * .7 + row * 1.3) * .9);
      const tap = REDUCED ? 0 : Math.round(-Math.sin(clamp((t - (fx.logoAt || -9) - i * .04) / .35, 0, 1) * Math.PI) * 5);
      const ay = arch ? Math.round(Math.sin(Math.PI * (i + .5) / chars.length) * -arch) : 0;
      const top = yy + (8 * c - gh) + land + wave + tap + ay;
      placed.push({ ch, x, y: top, c, u, i, row, w, h: gh });
      x += w + c;
    });
  };
  line('POKÉ', M.small, y, 0, 0); line('TAKTIKS', M.cell, y + 10 * M.small + 3, 1, M.cell);
  for (const p of placed) if (p.u > 0 && p.ch !== 'O') { const L = logoLetter(p.ch, p.c); ctx.globalAlpha = Math.min(1, p.u * 3); ctx.drawImage(L.back, p.x - L.P, p.y - L.P); }
  for (const p of placed) {
    if (p.u <= 0) continue; ctx.globalAlpha = Math.min(1, p.u * 3);
    if (p.ch === 'O') { drawTitleBall(p.x + p.w / 2, p.y + p.h / 2, p.w / 2 + 1, t); }
    else { const L = logoLetter(p.ch, p.c); ctx.drawImage(L.face, p.x - L.P, p.y - L.P);
      // the shine: a 3-px band sweeping left to right across the whole wordmark
      const k = ((t - 1.6) % 4.2) / .9; if (!REDUCED && k >= 0 && k < 1) { const sx = Math.round(cx - M.w / 2 - 10 + (M.w + 20) * k) + (p.row ? 6 : 0); ctx.save(); ctx.beginPath(); ctx.rect(sx, p.y - 4, 3, p.h + 8); ctx.rect(sx + 5, p.y - 4, 1, p.h + 8); ctx.clip(); ctx.globalAlpha *= .85; ctx.drawImage(L.shine, p.x - L.P, p.y - L.P); ctx.restore(); } }
    SC.titleLetters.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    const lk = p.row + ':' + p.i; if (!REDUCED && p.u >= 1 && fx.landed && !fx.landed[lk]) { fx.landed[lk] = true; titleDust(p.x + p.w / 2, p.y + p.h + 2); Audio.sfx('tick'); if (p.row && p.i === 6) { shakeTitle(); Audio.sfx('shake'); } }
  }
  ctx.globalAlpha = 1;
  // sparkles: four-point stars that grow and shrink on the letters
  if (!REDUCED) for (let s = 0; s < 3; s++) { const ph = t * .9 + s * 1.37, k = ph % 1, n = Math.floor(ph) * 7 + s * 13; const p = placed[n % placed.length]; if (!p || p.u < 1) continue; const r = Math.round(Math.sin(k * Math.PI) * 3); if (r > 0) sparkle(p.x + (n * 5) % Math.max(1, p.w), p.y + (n * 3) % Math.max(1, Math.round(p.h * .6)), r, '#ffffff'); }
  return M;
}
function easeOutBounce(t) { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; }
function sparkle(x, y, r, col) { x = Math.round(x); y = Math.round(y); hline(x - r, y, 2 * r + 1, col); vline(x, y - r, 2 * r + 1, col); if (r > 1) { px(x - 1, y - 1, col); px(x + 1, y - 1, col); px(x - 1, y + 1, col); px(x + 1, y + 1, col); } }
// The Poké Ball that replaces the O: it rocks, and its button glints.
function drawTitleBall(cx, cy, r, t) {
  const rock = REDUCED ? 0 : Math.round(Math.sin(t * 2.3) * 1.2); cx = Math.round(cx) + rock; cy = Math.round(cy) - Math.abs(rock);
  ctx.save();
  circle(cx, cy + 1, r + 3, 'rgba(8,6,30,.55)'); circle(cx, cy, r + 3, '#10133e'); circle(cx, cy, r + 1, '#2c58b6'); circle(cx, cy, r, '#f2eee6');
  ctx.save(); ctx.beginPath(); ctx.rect(cx - r - 1, cy - r - 1, 2 * r + 2, r + 1); ctx.clip(); circle(cx, cy, r, '#e6343e'); circle(cx - Math.round(r * .35), cy - Math.round(r * .4), Math.max(1, Math.round(r * .28)), '#ff8a8a'); ctx.restore();
  rect(cx - r, cy - 1, 2 * r + 1, 3, '#10133e'); circle(cx, cy, Math.max(2, Math.round(r * .38)), '#10133e'); circle(cx, cy, Math.max(1, Math.round(r * .26)), '#ffffff');
  if (!REDUCED && (t % 2.4) < .25) px(cx - 1, cy - 1, '#fff7c0');
  ctx.restore();
}
function shakeTitle() { if (SC.titleFx && !REDUCED) SC.titleFx.shake = SC.t + .25; }
function titleDust(x, y) { const fx = SC.titleFx; if (!fx) return; for (let i = 0; i < 2; i++) fx.particles.push({ x: x + (i ? 4 : -4), y, vx: (i ? 1 : -1) * (12 + Math.random() * 10), vy: -6, age: 0, life: .35, kind: 'dust' }); fx.particles = fx.particles.slice(-90); }

// ---------------------------------------------------------------- the landscape
const DUSK = ['#15113a', '#1f1650', '#2f1c60', '#46226e', '#632877', '#843079', '#aa3c77', '#cd506e', '#ea6b62', '#fb8c5c', '#ffae63', '#ffc877'];
const TITLE_BG = { key: null };
// Seeded 1-D ridge: summed sines, tiling across `w` pixels, for mountain silhouettes.
function ridge(w, seed, amp, base) { const r = mulberry32(seed), ph = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3], out = []; for (let x = 0; x < w; x++) { const u = x / w * Math.PI * 2; out.push(Math.round(base + amp * (.5 * Math.sin(u * 2 + ph[0]) + .28 * Math.sin(u * 5 + ph[1]) + .14 * Math.abs(Math.sin(u * 9 + ph[2])) * 2 - .14 + .08 * Math.sin(u * 23 + ph[3])))); } return out; }
function titleLandscape(L) {
  const W = VIEW.w, H = VIEW.h, key = [W, H, L.horizon, L.shoreY, L.sunX].join(':'); if (TITLE_BG.key === key) return TITLE_BG;
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const hz = L.horizon, sunX = L.sunX, sunR = L.sunR, sunY = hz - Math.round(sunR * .35);
  // sky: bands down to the horizon with a checker seam between each pair
  const [sky, g] = cnv(W, H); const bh = hz / DUSK.length;
  for (let i = 0; i < DUSK.length; i++) { const y0 = Math.round(i * bh), y1 = Math.round((i + 1) * bh); g.fillStyle = DUSK[i]; g.fillRect(0, y0, W, y1 - y0); if (i) { g.fillStyle = DUSK[i - 1]; for (let x = 0; x < W; x += 2) g.fillRect(x + (y0 & 1), y0, 1, 1); for (let x = 0; x < W; x += 4) g.fillRect(x + 1, y0 + 1, 1, 1); } }
  // the sun: a pale disc, warmer toward its base, sliced by widening bands of sky in its lower half, with a dotted halo
  for (let y = -sunR; y <= sunR; y++) { const w = Math.floor(Math.sqrt(sunR * sunR - y * y) + .5), v = (y + sunR) / (2 * sunR); if (v > .55) { const k = Math.floor((v - .55) * 22); if ((y + sunR) % 4 < Math.min(3, 1 + (k >> 1)) && k > 0) continue; } g.fillStyle = v < .3 ? '#fff6cf' : v < .55 ? '#ffe39a' : v < .78 ? '#ffc36e' : '#ff9d5c'; g.fillRect(sunX - w, sunY + y, 2 * w + 1, 1); }
  g.fillStyle = '#ffd98a'; for (let a = 0; a < 72; a++) { const an = a / 72 * Math.PI * 2, rr = sunR + 3 + (a % 3 === 0 ? 2 : 0); const x = Math.round(sunX + Math.cos(an) * rr), y = Math.round(sunY + Math.sin(an) * rr); if (y < hz - 2 && (a & 1)) g.fillRect(x, y, 1, 1); }
  // mountain ranges: faces toward the sun lit, the others in shadow (slope measured over 5 px so faces are solid), ravine
  // streaks on the lit faces and snow on the highest peaks; each layer is PAN px wider than the view for the slow pan
  const PAN = 80, FW = W + PAN;
  const range = (seed, amp, base, lit, dark, snow, streak) => { const [c, gg] = cnv(FW, H); const hs = ridge(FW, seed, amp, base), r = mulberry32(seed + 5);
    for (let x = 0; x < FW; x++) { const top = hs[x], a = hs[Math.max(0, x - 3)], b = hs[Math.min(FW - 1, x + 3)]; const facesSun = x + PAN / 2 < sunX ? b <= a : b >= a; gg.fillStyle = facesSun ? lit : dark; gg.fillRect(x, top, 1, H - top);
      if (snow && top < base - amp * .5) { const d = Math.max(1, Math.round((base - amp * .5 - top) * .7)); gg.fillStyle = facesSun ? snow[0] : snow[1]; gg.fillRect(x, top, 1, d); if (x % 3 === 0) { gg.fillRect(x, top + d, 1, 1 + (x % 2)); } }
      if (facesSun && streak && r() < .12) { gg.fillStyle = dark; gg.fillRect(x, top + 3 + Math.floor(r() * 4), 1, 3 + Math.floor(r() * 7)); } }
    return c; };
  const far = range(7, hz * .2, hz - hz * .1, '#8a4f98', '#5f387f', ['#f1d6f0', '#b393cf'], true);
  const mid = range(19, hz * .12, hz - hz * .015, '#50337a', '#382660', null, true);
  // the far shore: a band of rounded trees and pines, darker than the ranges, rimmed on the sun side
  const [near, ng] = cnv(FW, H); const tr = mulberry32(31); ng.fillStyle = '#211a48'; ng.fillRect(0, hz - 2, FW, 4);
  for (let x = -4; x < FW + 4; x += 3 + Math.floor(tr() * 3)) { const pine = tr() < .45, th = pine ? 7 + Math.floor(tr() * 5) : 4 + Math.floor(tr() * 3), col = tr() < .5 ? '#1c1640' : '#241c4e';
    for (let j = 0; j < th; j++) { const w = pine ? Math.max(0, Math.round(j / th * 2.6)) : Math.round(Math.sqrt(Math.max(0, th * th / 4 - (j - th / 2) * (j - th / 2))) * 1.1); ng.fillStyle = col; ng.fillRect(x - w, hz - 1 - th + j, 2 * w + 1, 1); if (x + PAN / 2 < sunX && w > 0) { ng.fillStyle = '#3d2d68'; ng.fillRect(x + w, hz - 1 - th + j, 1, 1); } else if (w > 0) { ng.fillStyle = '#3d2d68'; ng.fillRect(x - w, hz - 1 - th + j, 1, 1); } } }
  // the lake below: the mountains mirrored and darkened, then the water colour dithered over them
  const lakeH = L.shoreY - hz, [lake, lg] = cnv(W, Math.max(1, lakeH)); lg.fillStyle = '#2b2462'; lg.fillRect(0, 0, W, lakeH);
  lg.save(); lg.globalAlpha = .45; lg.translate(0, 2 * hz - hz); lg.scale(1, -1); lg.drawImage(mid, -PAN / 2, -hz, FW, H); lg.restore();
  lg.fillStyle = '#2b2462'; for (let y = 0; y < lakeH; y++) for (let x = (y & 1); x < W; x += 2) if (y > lakeH * .35 || (x + y) % 4 === 0) lg.fillRect(x, y, 1, 1);
  lg.fillStyle = '#4b3a86'; lg.fillRect(0, 0, W, 1);
  // the near shore: a backlit meadow across the whole width, a knoll where the team stands, and the ground under the menu
  const [shore, sg] = cnv(W, H); const edge = x => { let e = L.shoreY + Math.round(Math.sin(x * .05) * 1.5); const d = Math.abs(x - L.knollX) / L.knollW; if (d < 1) e -= Math.round((L.shoreY - L.cliffY) * (1 - d * d)); return e; };
  for (let x = 0; x < W; x++) { const e = edge(x); sg.fillStyle = '#1a1b36'; sg.fillRect(x, e, 1, H - e); sg.fillStyle = '#f0a45e'; sg.fillRect(x, e, 1, 1); sg.fillStyle = '#7a4e5a'; sg.fillRect(x, e + 1, 1, 1); sg.fillStyle = '#26284a'; if ((x * 13) % 7 === 0) sg.fillRect(x, e + 4 + (x % 6), 1, 2); }
  const fr = mulberry32(77); for (let i = 0; i < W / 5; i++) { const x = Math.floor(fr() * W), y = edge(x) + 4 + Math.floor(fr() * Math.max(4, H - edge(x) - 8)); sg.fillStyle = ['#2c2c55', '#30305c', '#242648'][i % 3]; sg.fillRect(x, y, 2, 1); }
  Object.assign(TITLE_BG, { key, sky, far, mid, near, lake, shore, edge, PAN, sunX, sunY, sunR, lakeH }); return TITLE_BG;
}
const TITLE_CLOUDS = [{ x: .1, y: .16, w: 46 }, { x: .45, y: .09, w: 34 }, { x: .7, y: .24, w: 56 }, { x: .88, y: .12, w: 28 }];
function drawTitleCloud(x, y, w) { x = Math.round(x); y = Math.round(y); const h = Math.max(5, Math.round(w / 6)); rrect(x, y + 2, w, h, '#6a2f78', 2); rrect(x + Math.round(w * .18), y, Math.round(w * .45), h, '#6a2f78', 2); rrect(x + Math.round(w * .5), y - 2, Math.round(w * .3), h, '#6a2f78', 2); hline(x + 2, y + h + 1, w - 4, '#ff9d6a'); hline(x + Math.round(w * .2), y + h, Math.round(w * .5), '#e67a6c'); hline(x + Math.round(w * .2), y, Math.round(w * .4), '#8b3f86'); }
function titleScene(L) {
  const W = VIEW.w, H = VIEW.h, t = SC.t, BG = titleLandscape(L), hz = L.horizon, pan = REDUCED ? .5 : Math.sin(t * .09) * .5 + .5;
  ctx.drawImage(BG.sky, 0, 0);
  for (let i = 0; i < 28; i++) { const x = (i * 97 + 13) % W, y = (i * 53 + 7) % Math.max(1, Math.round(hz * .42)); const k = Math.sin(t * (1.3 + i % 5 * .4) + i * 2.1); if (k > .2 || REDUCED) px(x, y, k > .85 ? '#ffffff' : '#b9a7e6'); if (k > .97 && !REDUCED) { px(x - 1, y, '#8f7fc6'); px(x + 1, y, '#8f7fc6'); } }
  for (const c of TITLE_CLOUDS) drawTitleCloud(((c.x * W + t * (3 + c.w / 20)) % (W + 80)) - 60, c.y * hz, c.w);
  ctx.drawImage(BG.far, -Math.round(pan * BG.PAN * .35), 0); ctx.drawImage(BG.mid, -Math.round(pan * BG.PAN * .6), 0); ctx.drawImage(BG.near, -Math.round(pan * BG.PAN * .8), 0);
  // the lake: its mirrored ranges, drifting glints and the sun's broken reflection
  ctx.drawImage(BG.lake, 0, hz);
  for (let i = 0; i < 18; i++) { const y = hz + 2 + (i * 7) % Math.max(1, BG.lakeH - 3), x = ((i * 71 + t * (5 + i % 3 * 3)) % (W + 40)) - 20; hline(x, y, 5 + i % 4 * 3, i % 3 ? '#4f3f8e' : '#6a54a8'); }
  for (let y = hz + 1; y < hz + BG.lakeH; y += 2) { const k = (y - hz) / BG.lakeH, ww = Math.round(BG.sunR * (1.05 - k * .45) * (.7 + .3 * Math.sin(t * 3 + y))), off = Math.round(Math.sin(t * 2 + y * .7) * 2); hline(BG.sunX - ww + off, y, ww * 2, k < .45 ? '#ffd27a' : '#f59a62'); if (y % 4 === 1) hline(BG.sunX - Math.round(ww * .4) - off, y, Math.round(ww * .8), '#fff1c0'); }
  // birds crossing now and then
  if (!REDUCED) { const k = (t % 14) / 14, bx = -20 + k * (W + 40), by = hz * .35 + Math.sin(k * 9) * 6; for (let b = 0; b < 3; b++) { const x = Math.round(bx - b * 9), y = Math.round(by + b * 4), f = Math.floor(t * 6 + b) % 2; if (f) { px(x - 2, y, '#2a1d4a'); px(x - 1, y - 1, '#2a1d4a'); px(x, y, '#2a1d4a'); px(x + 1, y - 1, '#2a1d4a'); px(x + 2, y, '#2a1d4a'); } else { hline(x - 2, y, 5, '#2a1d4a'); px(x, y + 1, '#2a1d4a'); } } }
  ctx.drawImage(BG.shore, 0, 0);
  drawTitleMeadow(L, BG);
}
// The backlit meadow and the knoll: swaying grass on the rim, flowers catching the last light, the team on the knoll,
// fireflies and drifting petals. The team hops when SC.titleFx.hop says so.
function drawTitleMeadow(L, BG) {
  const W = VIEW.w, H = VIEW.h, t = SC.t, edge = BG.edge;
  for (let x = 2; x < W - 1; x += 5) { const e = edge(x), sw = REDUCED ? 0 : Math.round(Math.sin(t * 2.4 + x * .23) * 1.2), tall = 2 + (x * 7) % 3; for (let j = 1; j <= tall; j++) px(x + Math.round(sw * j / tall), e - j, j === tall ? '#f7b066' : '#8a5a5c'); px(x - 2 + sw, e - 1, '#b8704c'); }
  for (let i = 0; i < 14; i++) { const x = (i * 61 + 17) % W, e = edge(x); if (Math.abs(x - L.knollX) < L.knollW * .5 && L.portrait) continue; const y = e + 3 + (i * 5) % Math.max(3, Math.min(14, H - e - 4)); const glow = .6 + .4 * Math.sin(t * 1.7 + i); ctx.globalAlpha = glow; px(x, y, i % 3 ? '#ff9ab8' : '#ffd35a'); px(x, y + 1, '#3f6a4a'); ctx.globalAlpha = 1; }
  const fx = SC.titleFx || {};
  L.team.forEach((num, i) => {
    const x = Math.round(L.teamX + i * L.teamGap), e = edge(x), hop = fx.hop && fx.hop[i] ? Math.max(0, fx.hop[i] - t) : 0, dy = hop > 0 ? -Math.round(Math.sin((1 - hop / .45) * Math.PI) * 9) : 0;
    ctx.globalAlpha = .5; ellipse(x, e + 1, 12, 2, '#07051a'); ctx.globalAlpha = 1;
    requestAnim(num); requestBigSprite(num);
    if (animReady(num)) drawAnim(num, x, e + 1 + dy, t + i * .37); else if (bigReady(num)) drawBig(num, x, e + 1 + dy, { sx: .5, sy: .5 }); else drawMon(num, x, e + 2 + dy, {});
  });
  if (!REDUCED) {
    for (let i = 0; i < 10; i++) { const k = t * .3 + i * .71, x = Math.round(((i * 53) % W) + Math.sin(k * 2.1) * 8), y = Math.round(edge(clamp(Math.round((i * 53) % W), 0, W - 1)) - 8 - (i * 13) % 30 + Math.sin(k * 1.7) * 5); if (Math.sin(t * 2.5 + i * 1.9) > .1) { px(x, y, '#fff6a0'); ctx.globalAlpha = .35; px(x - 1, y, '#ffe060'); px(x + 1, y, '#ffe060'); px(x, y - 1, '#ffe060'); px(x, y + 1, '#ffe060'); ctx.globalAlpha = 1; } }
    for (let i = 0; i < 5; i++) { const k = ((t * (.06 + i * .013)) + i * .23) % 1, x = Math.round(W * (1.1 - k * 1.3)), y = Math.round(L.horizon * .6 + i * 17 + Math.sin(t * 2 + i) * 6 + k * 40); const f = Math.floor(t * 5 + i) % 3; px(x, y, '#ffb3c9'); if (f) px(x + 1, y + (f === 1 ? -1 : 1), '#ff8fb1'); }
  }
}
// 13×13 menu icons: a star (new game), a route map (continue), crossed blades (quick battle), two balls (versus), play.
const TITLE_ICONS = {
  star: ['......O......', '.....OYO.....', '.....OYO.....', '....OYWYO....', 'OOOOOYWYOOOOO', 'OYYYYYWYYYYyO', '.OYYYYYYYYyO.', '..OYYYYYYyO..', '...OYYYYyO...', '..OYYyOYYyO..', '..OYyO.OYyO..', '.OYyO...OyyO.', '.OOO.....OOO.'],
  map: ['.OOOO.OOO.OO.', 'OKWWWOGGGOWWO', 'OKWRWOGgGOWWO', 'OKWWWOGGGOWBO', 'OKWWROGGWOWBO', 'OKWWWRGWROBBO', 'OKGGWOWRWOWWO', 'OKGgWOWWROWWO', 'OKGGWOWWWRWWO', 'OKWWWOBBWOWRO', 'OKWWWOBBWOWWO', '.OOO.OOOO.OO.', '.............'],
  blades: ['OO.........OO', 'OSO.......OSO', '.OSO.....OSO.', '..OSO...OSO..', '...OSO.OSO...', '....OSOSO....', '.....OsO.....', '....OSOsO....', '.OO.OsO.OsO.O', 'OKKOsO...OsOK', '.OKKO.....OKO', 'OKOKKO...OKOK', 'OO..OO...OO.O'],
  duo: ['..OOOO.......', '.ORRRRO......', 'ORRhRRRO.....', 'ORRRRRRO.OOOO', 'OOOWWOOOOBBBBO', 'OWWOOWWOBBhBBBO', 'OWWWWWWOBBBBBBO', '.OWWWWOOOOWWOOO', '..OOOOOOWWOOWWO', '.......OWWWWWWO', '........OWWWWO.', '.........OOOO..', '.............'],
  play: ['...OOOOOOO...', '..OGGGGGGGO..', '.OGGWGGGGGGO.', 'OGGGWWGGGGGGO', 'OGGGWWWGGGGGO', 'OGGGWWWWGGGGO', 'OGGGWWWWWGGGO', 'OGGGWWWWGGGGO', 'OGGGWWWGGGGGO', 'OGGGWWGGGGGGO', '.OgGWGGGGGGgO.', '..OgggggggO..', '...OOOOOOO...'],
};
function titleIcon(id, x, y, dim) { const rows = TITLE_ICONS[id]; if (!rows) return; stampAt(Math.round(x), Math.round(y), rows, dim ? { O: '#07051c', Y: '#b9a36a', y: '#8a7640', W: '#c9c6e8', S: '#b8bcd8', s: '#7e84a8', K: '#6a4a3a', G: '#5c8f5c', g: '#3e6a44', R: '#b25860', h: '#e6a0a0', B: '#5a78b8', b: '#3a5288' } : { O: '#07051c', Y: '#ffd049', y: '#e09a1c', W: '#fbf6e8', S: '#e6ecff', s: '#9aa6d6', K: '#b8764a', G: '#62c86a', g: '#2f8a4a', R: '#f04848', h: '#ffb0b0', B: '#4a8cff', b: '#2a5ad0' }); }

// ---------------------------------------------------------------- menu
function titleSelect(i) {
  if (SC.titleFx?.action || i === SC.i || SC.titleConfirm) return;
  SC.i = i; SC.titleFx.focusAt = SC.t; Audio.sfx('titleFocus'); titleHop(i % 4);
  const b = SC.hits[i]; if (b) titleBurst(b.x + 12, b.y + b.h / 2, 6);
}
function titleHop(i) { const fx = SC.titleFx; if (!fx || REDUCED) return; fx.hop = fx.hop || []; fx.hop[i] = SC.t + .45; }
function titleActivate(i) {
  const fx = SC.titleFx, item = SC.titleItems[i]; if (!fx || fx.action || !item || SC.titleConfirm) return;
  SC.i = i; fx.down = null; Audio.sfx('titleConfirm');
  if (REDUCED) { item.run(); return; }
  const b = SC.hits[i]; if (b) titleBurst(b.x + 12, b.y + b.h / 2, 16); for (let k = 0; k < 4; k++) titleHop(k);
  fx.action = { i, t: 0, run: item.run };
}
function titleBurst(x, y, count = 9) {
  const fx = SC.titleFx; if (!fx || REDUCED) return;
  for (let i = 0; i < count; i++) { const a = i * Math.PI * 2 / count, sp = 18 + i % 4 * 9; fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, age: 0, life: .35 + i % 3 * .12, kind: i % 2 ? 'spark' : 'star' }); }
  fx.particles = fx.particles.slice(-90);
}
function titleUpdate(dt) {
  const fx = SC.titleFx; if (!fx) return;
  SC.titleItems.forEach((item, i) => { item.hover = REDUCED ? +(i === SC.i) : lerp(item.hover, +(i === SC.i), 1 - Math.exp(-dt * 18)); });
  for (const p of fx.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'dust' ? 10 : 30) * dt; }
  fx.particles = fx.particles.filter(p => p.age < p.life);
  if (fx.action) { fx.action.t += dt; if (fx.action.t >= .2) { const run = fx.action.run; fx.action = null; run(); } }
}
function initTitle() {
  // Save state is a scene snapshot, not a localStorage read on every animation frame.
  const save = loadSave(), suspended = loadSuspend(); const items = [];
  if (suspended) items.push({ label: 'RESUME BATTLE', sub: 'Back to your last turn', icon: 'play', run: resumeSuspend });
  if (save) { const chapter = CHAPTERS[clamp(save.chapter || 0, 0, CHAPTERS.length - 1)]; items.push({ label: 'CONTINUE', sub: save.beaten ? 'Kanto is free · replay for stars' : 'Front ' + chapter.num + ' · ' + chapter.title, icon: 'map', run: continueCampaign }); }
  items.push({ label: 'NEW GAME', sub: 'Free Kanto from Team Rocket', icon: 'star', run: () => { if (save) openTitleConfirm(); else startNewGame(); } });
  items.push({ label: 'QUICK BATTLE', sub: 'Skirmish · Tower · Safari · Conquest', icon: 'blades', run: () => goScene('quick') });
  items.push({ label: 'VERSUS', sub: 'Two players, one screen', icon: 'duo', run: startVersusSetup });
  items.forEach((item, i) => { item.hover = i === 0 ? 1 : 0; });
  SC.titleItems = items; SC.menuLen = items.length; SC.titleConfirm = null;
  SC.titleFx = { particles: [], focusAt: -10, logoAt: -10, down: null, action: null, hop: [], landed: {}, shake: 0 };
}
// In-game confirmation for replacing a campaign save (never a browser dialog).
function openTitleConfirm() { SC.titleConfirm = { i: 0, t: SC.t }; Audio.sfx('menu'); } // KEEP SAVE has the focus: losing a journey takes a deliberate step
function titleConfirmRect() { const w = Math.min(VIEW.w - 16, 230), h = 74; return { x: Math.round((VIEW.w - w) / 2), y: Math.round((VIEW.h - h) / 2), w, h }; }
function titleConfirmChoose(yes) { SC.titleConfirm = null; if (yes) { Audio.sfx('titleConfirm'); startNewGame(); } else Audio.sfx('cancel'); }
function titleLayout(count) {
  const W = VIEW.w, H = VIEW.h, portrait = H > W || W < 320, compact = !portrait && H < 245;
  const gap = compact ? 3 : 4, cols = compact && H < 190 && count > 4 ? 2 : 1;
  const w = portrait ? Math.min(236, W - 24) : cols === 2 ? Math.floor((W - 44) / 2) : Math.min(206, Math.floor(W * .42));
  const x = portrait ? Math.floor((W - w) / 2) : Math.max(14, Math.floor(W * .05));
  const logoMax = portrait ? W - 16 : Math.max(w + 20, Math.floor(W * .46));
  const cell = logoCell(W, H, logoMax), M = logoMetrics(cell);
  const logoY = portrait ? Math.max(10, Math.floor(H * .04)) : compact ? 6 : Math.max(10, Math.min(24, Math.floor(H * .06)));
  const logoCx = portrait ? W / 2 : x + w / 2, endY = H - (compact ? 28 : 30), rows = Math.ceil(count / cols);
  let rowH, menuY;
  if (portrait) { rowH = clamp(Math.floor((H * .42 - (rows - 1) * gap) / rows), 20, 30); menuY = endY - rows * rowH - (rows - 1) * gap; }
  else { menuY = logoY + M.h + (compact ? 4 : 20); rowH = clamp(Math.floor((endY - menuY - (rows - 1) * gap) / rows), 18, 32); }
  // the landscape: horizon, sun, lake, the shore and the knoll with the team, placed around the logo and the menu
  const team = [1, 25, 4, 7];
  let horizon, shoreY, cliffY, knollX, knollW, teamGap, teamX, sunX;
  if (portrait) {
    shoreY = menuY - 12; cliffY = shoreY - 12; horizon = Math.round(clamp(cliffY - 34, logoY + M.h + 40, H * .62));
    knollX = Math.round(W / 2); knollW = Math.round(W * .62); teamGap = Math.min(42, (W - 44) / 3.3); teamX = Math.round(W / 2 - teamGap * 1.5); sunX = Math.round(W * .68);
  } else {
    horizon = Math.round(H * .58); shoreY = Math.round(H * .8); cliffY = Math.round(H * .72);
    knollX = Math.round(W * .76); knollW = Math.round(W * .3); teamGap = Math.min(52, W * .1); teamX = Math.round(knollX - teamGap * 1.5); sunX = Math.round(W * .74);
  }
  return { portrait, compact, cols, x, w, cell, logoY, logoCx, logoH: M.h, menuY, rowH, gap, horizon, shoreY, cliffY, knollX, knollW, sunX, sunR: Math.round(clamp(Math.min(W, H) * .12, 14, 40)), team, teamGap, teamX };
}
// One menu entry: a dark slab that slides right when focused, with a Poké Ball cursor, an icon, the label in the display
// face and a one-line description. Pressing sinks it; confirming flashes it.
function titleCard(x, y, w, h, item, selected, run, index) {
  const fx = SC.titleFx, confirming = fx.action?.i === index, held = INPUT.down && fx.down === index, pressed = held || confirming;
  const u = REDUCED ? 1 : clamp((titleTime() - .75 - index * .07) / .3, 0, 1), slide = REDUCED ? 0 : Math.round(item.hover * 5 - Math.pow(1 - u, 3) * 40), down = pressed ? 1 : 0;
  ctx.save(); ctx.globalAlpha = u; ctx.translate(slide, down);
  ctx.globalAlpha = u * .55; rrect(x + 2, y + 3, w, h, '#05031a', 2); ctx.globalAlpha = u;
  const face = selected ? '#2c2f78' : '#17143d'; rrect(x, y, w, h, selected ? UI.gold : '#060420', 2); rrect(x + 1, y + 1, w - 2, h - 2, face, 1);
  hline(x + 2, y + 1, w - 4, shade(face, .35)); hline(x + 2, y + h - 2, w - 4, shade(face, -.45));
  if (selected) { rect(x + 1, y + 2, 2, h - 4, UI.gold); if (!REDUCED) { const k = (SC.t - fx.focusAt) / .45; if (k >= 0 && k < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip(); ctx.globalAlpha = u * .25 * Math.sin(k * Math.PI); for (let q = 0; q < 6; q++) vline(x + Math.round(k * (w + 24)) - 12 + q, y + 2, h - 4, '#fff6c9'); ctx.restore(); } } }
  if (confirming) { ctx.globalAlpha = u * clamp(1 - fx.action.t / .2, 0, 1) * .6; rrect(x + 1, y + 1, w - 2, h - 2, '#ffffff', 1); ctx.globalAlpha = u; }
  titleIcon(item.icon, x + 7, y + Math.round((h - 13) / 2) - (selected && !REDUCED ? Math.round(Math.abs(Math.sin(SC.t * 4)) * 1) : 0), !selected);
  const sub = h >= 26, ty = sub ? y + Math.round((h - 18) / 2) : y + Math.round((h - 9) / 2);
  bigText(item.label, x + 25, ty, selected ? '#fff0b6' : '#dcdaf2', { shadow: '#07051c' });
  if (sub) text(titleFitText(item.sub, w - 33), x + 25, ty + 11, selected ? '#c3c9f2' : '#8d8fbe');
  ctx.restore();
  if (selected && u >= 1) { const bob = REDUCED ? 0 : Math.round(Math.sin(SC.t * 5) * 1.5); drawBall(x - 7 + slide + bob, y + Math.round(h / 2), '#f04848', 4); }
  hit(x, y, w, h, run, item.label); // hit targets stay put while the card slides
}
// Time for entrance animations: outside the main loop (tests, tools) every entrance has already finished.
function titleTime() { return CLOCK.frame ? SC.t : 99; }
function titleFitText(s, w) { if (textWidth(s) <= w) return s; while (s.length && textWidth(s + '…') > w) s = s.slice(0, -1); return s.trimEnd() + '…'; }
function titleDraw() {
  if (!SC.titleItems) initTitle();
  const items = SC.titleItems, W = VIEW.w, H = VIEW.h, L = titleLayout(items.length);
  SC.i = clamp(SC.i, 0, items.length - 1); SC.titleCols = L.cols;
  const shk = SC.titleFx.shake > SC.t ? Math.round(Math.sin(SC.t * 90) * 2 * (SC.titleFx.shake - SC.t) / .25) : 0; ctx.save(); ctx.translate(0, shk);
  titleScene(L);
  // legibility: a soft dark wash behind the menu (left column on wide screens, the bottom on portrait)
  if (!L.portrait) { for (let x = 0; x < Math.round(W * .5); x += 2) { ctx.globalAlpha = .5 * Math.pow(1 - x / (W * .5), 1.3); rect(x, 0, 2, H, '#07051c'); } ctx.globalAlpha = 1; }
  else { for (let y = L.menuY - 22; y < H; y += 2) { ctx.globalAlpha = clamp((y - L.menuY + 22) / 30, 0, 1) * .6; rect(0, y, W, 2, '#07051c'); } ctx.globalAlpha = 1; }
  const M = drawLogo(L.logoCx, L.logoY, L.cell); ctx.restore();
  if (!L.compact && L.logoY + M.h + 10 < L.menuY - 4) { const s = 'A POKÉMON TACTICS ADVENTURE', sy = L.logoY + M.h + 1, sw = textWidth(s); textC(s, L.logoCx, sy, '#ffe2a8', { shadow: '#1a0f33' }); hline(L.logoCx - sw / 2 - 16, sy + 3, 10, '#c77a5a'); hline(L.logoCx + sw / 2 + 6, sy + 3, 10, '#c77a5a'); }
  SC.hits = [];
  items.forEach((item, i) => { const x = L.cols === 2 ? 18 + (i % 2) * (L.w + 8) : L.x, y = L.menuY + Math.floor(i / L.cols) * (L.rowH + L.gap); titleCard(x, y, L.w, L.rowH, item, SC.i === i, () => titleActivate(i), i); });
  // the sound control is its own touch target, separate from keyboard navigation
  const sound = Audio.muted ? 'SOUND OFF' : 'SOUND ON', sw = textWidth(sound) + 20; SC.titleSound = { x: 6, y: H - 24, w: sw, h: 20 };
  const soundHot = !VIEW.touch && INPUT.x >= 6 && INPUT.x < 6 + sw && INPUT.y >= H - 24; if (soundHot) rrect(6, H - 23, sw, 18, '#2c2f78', 2);
  iconAt('note', 9, H - 19, Audio.muted ? '#8d8fbe' : UI.gold); text(sound, 21, H - 17, soundHot ? UI.ink : '#b9bce0', { shadow: '#07051c' });
  if (!L.portrait) { hintLine(VIEW.touch ? ['tap to begin'] : [['↑↓', 'select'], ['Z', 'confirm']], W / 2, H - 17, { pill: false, col: '#b9bce0' }); textR('GEN I · FAN GAME', W - 10, H - 17, '#8d8fbe', { shadow: '#07051c' }); }
  else textR('GEN I · FAN GAME', W - 8, H - 17, '#8d8fbe', { shadow: '#07051c' });
  for (const p of SC.titleFx.particles) { const k = 1 - p.age / p.life; if (p.kind === 'dust') { ctx.globalAlpha = k * .8; rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2, '#e8d6c0'); } else if (p.kind === 'star') { ctx.globalAlpha = k; sparkle(p.x, p.y, k > .5 ? 2 : 1, '#fff2a8'); } else { ctx.globalAlpha = k; px(Math.round(p.x), Math.round(p.y), '#ffffff'); } }
  ctx.globalAlpha = 1;
  if (SC.titleConfirm) drawTitleConfirm();
}
function drawTitleConfirm() {
  const r = titleConfirmRect(), c = SC.titleConfirm; dimScreen(.62); const tok = unfold('titleConfirm', r.x, r.y, r.w, r.h);
  const p = panel(r.x, r.y, r.w, r.h, { header: 'START A NEW JOURNEY?', headerFill: '#5a1d2e' });
  textC('Your campaign save will be replaced.', r.x + r.w / 2, p.cy + 1, UI.ink);
  const bw = Math.floor((r.w - 24) / 2), by = r.y + r.h - 26; SC.titleConfirmHits = [];
  [['KEEP SAVE', false, 'ghost'], ['NEW GAME', true, 'danger']].forEach(([label, yes, variant], i) => { const bx = r.x + 8 + i * (bw + 8); const hot = c.i === i; uiButton(bx, by, bw, 18, label, { hot, variant, big: true }); SC.titleConfirmHits.push({ x: bx, y: by, w: bw, h: 18, run: () => titleConfirmChoose(yes), label }); });
  unfoldEnd(tok);
}
function titleInput(ev) {
  const n = SC.menuLen || 0, fx = SC.titleFx;
  if (!n || !fx || fx.action) return;
  if (SC.titleConfirm) {
    const c = SC.titleConfirm;
    if (ev.type === 'key') { if (ev.key === 'left' || ev.key === 'right' || ev.key === 'up' || ev.key === 'down') { c.i = 1 - c.i; Audio.sfx('cursor'); } else if (ev.key === 'ok') titleConfirmChoose(c.i === 1); else if (ev.key === 'back') titleConfirmChoose(false); }
    else if (ev.type === 'up') { const h = (SC.titleConfirmHits || []).find(b => ev.x >= b.x && ev.y >= b.y && ev.x < b.x + b.w && ev.y < b.y + b.h); if (h) h.run(); }
    return;
  }
  if (ev.type === 'key') {
    const cols = SC.titleCols || 1;
    if (ev.key === 'up' || ev.key === 'down' || ev.key === 'left' || ev.key === 'right' || ev.key === 'next') { const delta = ev.key === 'up' ? -cols : ev.key === 'down' ? cols : ev.key === 'left' ? -1 : 1; titleSelect((SC.i + delta + n) % n); }
    else if (ev.key === 'ok') titleActivate(SC.i);
    else if (ev.key === 'mute') Audio.toggle();
    return;
  }
  if (ev.type === 'down' && (ev.btn == null || ev.btn === 0)) { const b = hitAt(ev.x, ev.y); fx.down = b ? SC.hits.indexOf(b) : -1; if (fx.down >= 0) titleSelect(fx.down); return; }
  if (ev.type === 'move' && !ev.touch && !INPUT.down) { const b = hitAt(ev.x, ev.y); if (b) titleSelect(SC.hits.indexOf(b)); return; }
  if (ev.type === 'up' && (ev.btn == null || ev.btn === 0)) {
    const from = fx.down; fx.down = null; const s = SC.titleSound;
    if (s && ev.x >= s.x && ev.x < s.x + s.w && ev.y >= s.y && ev.y < s.y + s.h) { Audio.toggle(); return; }
    const b = hitAt(ev.x, ev.y), i = b ? SC.hits.indexOf(b) : -1;
    if (i >= 0 && (from == null || from === i)) { titleActivate(i); return; }
    if (SC.titleLetters?.some(l => ev.x >= l.x && ev.x <= l.x + l.w && ev.y >= l.y && ev.y <= l.y + l.h)) { fx.logoAt = SC.t; titleBurst(ev.x, ev.y, 12); Audio.sfx('titleFocus'); for (let k = 0; k < 4; k++) titleHop(k); }
  }
}
