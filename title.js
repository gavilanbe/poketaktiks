// ============================================================================
// title.js — the title screen, drawn as pixel art at the game's own resolution: a dusk sky in dithered bands, a
// striped sun, parallax mountains, a shimmering lake, a cliff where the starters wait, and a hand-drawn wordmark.
// Nothing here loads an image except the Pokémon sprites, so the screen works (and is tested) before any art arrives.
// ============================================================================
'use strict';
// ---------------------------------------------------------------- the wordmark
// Set in the game's own display face (font.js): "POKÉ" with a Poké Ball for its O over a larger, slanted "TAKTIKS", both
// gently arched, dressed gold on blue with a navy extrusion, and a red ribbon under them carrying the subtitle. S is the
// scale of TAKTIKS (1-4); POKÉ is one step smaller on big screens.
function logoMetrics(S) {
  const s1 = S >= 3 ? S - 1 : S, sl = 1 + Math.max(0, S - 2), ball = 11 * s1 + 2, ribbon = S >= 2 ? 15 : 12;
  const top = displayWidth('P', s1) + ball + displayWidth('KÉ', s1) + 3 * s1 + 4, bottom = displayWidth('TAKTIKS', S) + (sl + 2) * S;
  const h = 3 * s1 + 11 * s1 + 2 + S + 11 * S + 2 * S + 5 + ribbon;
  return { S, s1, sl, ball, ribbon, w: Math.max(top, bottom) + 12, h, top, bottom, cell: S }; // the ribbon takes whatever width the screen allows
}
function logoCell(W, H, maxW) { for (const c of [4, 3, 2, 1]) { const m = logoMetrics(c); if (m.w <= maxW && m.h <= H * .34) return c; } return 1; }
// Draws the wordmark centred on cx with its top at y. Letters drop in one by one and land with a bounce and a puff of
// dust (the last one shakes the screen), then breathe; a shine sweeps through every few seconds, sparkles pop on the
// letters and the ribbon unfurls under them. With fx.logoSettled (after the opening) everything is already in place.
function drawLogo(cx, y, S, clock) {
  const M = logoMetrics(S), fx = SC.titleFx || {}, t = SC.t, settled = REDUCED || fx.logoSettled, now = clock != null ? clock : titleTime(); SC.titleLetters = [];
  const placed = [], y1 = y + 3 * M.s1, y2 = y1 + 11 * M.s1 + 2 + S + Math.round(S * 1.5);
  const line = (chars, sc, yy, row, arch, slant) => {
    // letters advance by their upright width: the slant is the same for every row of every letter, so it adds once per word
    const widths = chars.map(ch => ch === 'O' ? M.ball : displayWidth(ch, sc)), gap = sc; let x = Math.round(cx - (widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) + slant * sc) / 2);
    chars.forEach((ch, i) => { const w = widths[i], delay = .08 + row * .34 + i * .06, u = settled ? 1 : clamp((now - delay) / .42, 0, 1);
      const land = u >= 1 ? 0 : Math.round(-(1 - easeOutBounce(u)) * (44 + row * 12)), wave = REDUCED ? 0 : Math.round(Math.sin(t * 2.1 + i * .7 + row * 1.3) * .9);
      const tap = REDUCED ? 0 : Math.round(-Math.sin(clamp((t - (fx.logoAt || -9) - i * .04) / .35, 0, 1) * Math.PI) * 5), ay = Math.round(Math.sin(Math.PI * (i + .5) / chars.length) * -arch);
      placed.push({ ch, x, y: yy + land + wave + tap + ay, sc, slant, u, i, row, w, h: 11 * sc }); x += w + gap; }); };
  line(['P', 'O', 'K', 'É'], M.s1, y1, 0, Math.round(M.s1 * 1.5), 0); line([...'TAKTIKS'], S, y2, 1, S * 2, M.sl);
  // backs first (extrusions and outlines), then the faces, so no outline cuts into a neighbouring letter
  for (const p of placed) if (p.u > 0 && p.ch !== 'O') { const D = displayCanvas(p.ch, 'gold', p.sc, p.slant); ctx.globalAlpha = Math.min(1, p.u * 3); ctx.drawImage(D.back, p.x - D.ox, p.y - D.oy); }
  for (const p of placed) {
    if (p.u <= 0) continue; ctx.globalAlpha = Math.min(1, p.u * 3);
    if (p.ch === 'O') drawTitleBall(p.x + p.w / 2, p.y + p.h / 2, Math.round(p.w / 2), t);
    else { const D = displayCanvas(p.ch, 'gold', p.sc, p.slant); ctx.drawImage(D.face, p.x - D.ox, p.y - D.oy);
      const k = ((t - 1.6) % 4.2) / .9; if (!REDUCED && k >= 0 && k < 1) { const sx = Math.round(cx - M.w / 2 - 10 + (M.w + 20) * k) + (p.row ? 6 : 0); ctx.save(); ctx.beginPath(); ctx.rect(sx, p.y - 6, 2 * p.sc + 1, p.h + 12); ctx.rect(sx + 3 * p.sc + 1, p.y - 6, p.sc, p.h + 12); ctx.clip(); ctx.globalAlpha *= .85; ctx.drawImage(D.shine, p.x - D.ox, p.y - D.oy); ctx.restore(); } }
    SC.titleLetters.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    const lk = p.row + ':' + p.i; if (!settled && p.u >= 1 && fx.landed && !fx.landed[lk]) { fx.landed[lk] = true; titleDust(p.x + p.w / 2, p.y + p.h + 2); Audio.sfx('tick'); if (p.row && p.i === 6) { shakeTitle(); Audio.sfx('shake'); } }
  }
  ctx.globalAlpha = 1;
  // the ribbon: a red banner with folded ends, unfurling from the middle once TAKTIKS has landed
  const ry = y2 + 11 * S + 2 * S + 4, sub = 'A POKÉMON TACTICS ADVENTURE', rwFull = Math.min(Math.max(M.bottom - 8 * S, textWidth(sub) + 26), (VIEW.w - 12)), ru = settled ? 1 : easeOut(clamp((now - .9 - .34) / .35, 0, 1));
  if (ru > 0) { const rw = Math.round(rwFull * ru), rx = Math.round(cx - rw / 2), rh = M.ribbon, fold = Math.min(7, Math.round(rh * .5));
    for (const side of [-1, 1]) { const ex = side < 0 ? rx - fold + 2 : rx + rw - 2; rect(ex, ry + 3, fold, rh - 3, '#8a1424'); for (let k = 0; k < 3; k++) px(side < 0 ? ex + k : ex + fold - 1 - k, ry + rh - 1 - k, UI.inset); rect(side < 0 ? rx - 1 : rx + rw - 1, ry + rh - 2, 1, 3, '#4a0810'); }
    rect(rx, ry, rw, rh, '#d8283c'); hline(rx, ry, rw, '#ff6a78'); hline(rx, ry + 1, rw, '#ee4050'); hline(rx, ry + rh - 1, rw, '#8a1424'); outline(rx - 1, ry - 1, rw + 2, rh + 2, '#3a0610');
    if (ru >= 1) { ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); textC(sub, cx, ry + Math.round((rh - 7) / 2), '#fff3d8', { shadow: '#6a0818' }); for (const side of [-1, 1]) { const sx = Math.round(cx + side * (textWidth(sub) / 2 + 7)); px(sx, ry + Math.round(rh / 2) - 1, '#ffd049'); px(sx, ry + Math.round(rh / 2), '#ffd049'); } ctx.restore(); } }
  // sparkles: four-point stars that grow and shrink on the letters
  if (!REDUCED) for (let s2 = 0; s2 < 3; s2++) { const ph = t * .9 + s2 * 1.37, k = ph % 1, n = Math.floor(ph) * 7 + s2 * 13; const p = placed[n % placed.length]; if (!p || p.u < 1) continue; const r = Math.round(Math.sin(k * Math.PI) * 3); if (r > 0) sparkle(p.x + (n * 5) % Math.max(1, p.w), p.y + (n * 3) % Math.max(1, Math.round(p.h * .6)), r, '#ffffff'); }
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
  drawRocketBlimp(L, t);
  ctx.drawImage(BG.shore, 0, 0);
  drawTitleMeadow(L, BG);
}
// Team Rocket's airship crosses the sky now and then (the PCs are theirs), its searchlight sweeping the lake. The cone is
// drawn a row at a time so it stays pixel-crisp; nothing flies with reduced motion.
function drawRocketBlimp(L, t) {
  if (REDUCED) return; const W = VIEW.w, per = 34, k = (t - 5) % per / 16; if (t < 5 || k > 1) return;
  const x = Math.round(W + 40 - k * (W + 100)), y = Math.round(L.portrait ? L.horizon * .55 : L.horizon * .52) + Math.round(Math.sin(t * .9) * 2);
  drawSearchlight(x - 2, y + 9, Math.round(x - 14 + Math.sin(t * .8) * 34), Math.round(L.shoreY - 3), 1); drawAirshipHull(x, y, t);
}
// A searchlight cone from (gx, gy) down to a pool of light at (tx, ty), a row at a time so it stays pixel-crisp.
function drawSearchlight(gx, gy, tx, ty, k) {
  const rows = ty - gy; if (rows <= 4 || k <= 0) return; const a = ctx.globalAlpha;
  ctx.globalAlpha = a * .07 * k; for (let r = 0; r < rows; r++) { const f = r / rows, cx = gx + (tx - gx) * f, half = 1 + f * 13; rect(Math.round(cx - half), gy + r, Math.round(half * 2), 1, '#fff4c0'); }
  ctx.globalAlpha = a * .2 * k; ellipse(tx, ty, 15, 3, '#fff4c0'); ctx.globalAlpha = a * .12 * k; ellipse(tx, ty, 22, 4, '#fff4c0'); ctx.globalAlpha = a;
}
// Team Rocket's airship: a dark capsule with its fins aft (it flies left), a red band carrying the R, a lit gondola, a
// blinking light and a spinning propeller.
function drawAirshipHull(x, y, t) {
  rect(x + 18, y - 9, 5, 5, '#2e2750'); rect(x + 18, y + 4, 5, 5, '#2e2750'); rect(x + 21, y - 2, 6, 4, '#2e2750'); hline(x + 18, y - 9, 5, '#4a4270');
  rrect(x - 22, y - 6, 44, 12, '#241e3e', 5); hline(x - 17, y - 6, 34, '#4d4575'); hline(x - 20, y - 5, 40, '#35305a'); hline(x - 17, y + 5, 34, '#15122a');
  rect(x - 5, y - 6, 10, 12, '#b8283a'); hline(x - 5, y - 6, 10, '#e05060'); circle(x, y, 4, '#f2eee6'); stampAt(x - 1, y - 2, ['RR.', 'R.R', 'RR.', 'R.R', 'R.R'], { R: '#c02838' });
  rect(x - 8, y + 6, 16, 4, '#1a1630'); for (let i = 0; i < 4; i++) px(x - 6 + i * 4, y + 7, Math.floor(t * 3 + i) % 5 ? '#ffe08a' : '#8a7040');
  if (Math.floor(t * 2) % 2) px(x - 22, y, '#ff4040'); const pr = Math.floor(t * 12) % 2; vline(x + 27, y - 2 + pr, 3, '#8a86a8');
}
// The backlit meadow and the knoll: swaying grass on the rim, flowers catching the last light, the team on the knoll,
// fireflies and drifting petals. The team hops when SC.titleFx.hop says so.
function drawTitleMeadow(L, BG) {
  const W = VIEW.w, H = VIEW.h, t = SC.t, edge = BG.edge;
  for (let x = 2; x < W - 1; x += 5) { const e = edge(x), sw = REDUCED ? 0 : Math.round(Math.sin(t * 2.4 + x * .23) * 1.2), tall = 2 + (x * 7) % 3; for (let j = 1; j <= tall; j++) px(x + Math.round(sw * j / tall), e - j, j === tall ? '#f7b066' : '#8a5a5c'); px(x - 2 + sw, e - 1, '#b8704c'); }
  for (let i = 0; i < 14; i++) { const x = (i * 61 + 17) % W, e = edge(x); if (Math.abs(x - L.knollX) < L.knollW * .5 && L.portrait) continue; const y = e + 3 + (i * 5) % Math.max(3, Math.min(14, H - e - 4)); const glow = .6 + .4 * Math.sin(t * 1.7 + i); ctx.globalAlpha = glow; px(x, y, i % 3 ? '#ff9ab8' : '#ffd35a'); px(x, y + 1, '#3f6a4a'); ctx.globalAlpha = 1; }
  const fx = SC.titleFx || {};
  // the Tactician stands on the crest behind the team, backlit by the sunset
  if (L.tactician) { const tc = trainerCanvas('red', false, false), rx = Math.round(L.knollX), re = edge(rx); if (tc) { ctx.globalAlpha = .45; ellipse(rx, re + 1, 13, 2, '#07051a'); ctx.globalAlpha = 1; const bob = REDUCED ? 0 : Math.round(Math.max(0, Math.sin(t * 1.3)) * 1); ctx.drawImage(tc, rx - 40, re - 78 - bob); } }
  L.team.forEach((num, i) => {
    const x = Math.round(L.teamX + i * L.teamGap + (L.tactician ? (i < L.team.length / 2 ? -1 : 1) * L.split : 0)), e = edge(x), hop = fx.hop && fx.hop[i] ? Math.max(0, fx.hop[i] - t) : 0, dy = hop > 0 ? -Math.round(Math.sin((1 - hop / .45) * Math.PI) * 9) : 0;
    ctx.globalAlpha = .5; ellipse(x, e + 1, 12, 2, '#07051a'); ctx.globalAlpha = 1;
    requestAnim(num); requestBigSprite(num);
    if (animReady(num)) drawAnim(num, x, e + 1 + dy, t + i * .37); else if (bigReady(num)) drawBig(num, x, e + 1 + dy, { sx: .5, sy: .5 }); else drawMon(num, x, e + 2 + dy, {});
    if (L.aceAt === i) { const mh = typeof ANIM_META !== 'undefined' && ANIM_META[num] ? Math.min(ANIM_META[num].b || 40, 70) : 36; drawCrown(x - 4, e - mh - 8 + dy); }
  });
  if (!REDUCED) {
    for (let i = 0; i < 10; i++) { const k = t * .3 + i * .71, x = Math.round(((i * 53) % W) + Math.sin(k * 2.1) * 8), y = Math.round(edge(clamp(Math.round((i * 53) % W), 0, W - 1)) - 8 - (i * 13) % 30 + Math.sin(k * 1.7) * 5); if (Math.sin(t * 2.5 + i * 1.9) > .1) { px(x, y, '#fff6a0'); ctx.globalAlpha = .35; px(x - 1, y, '#ffe060'); px(x + 1, y, '#ffe060'); px(x, y - 1, '#ffe060'); px(x, y + 1, '#ffe060'); ctx.globalAlpha = 1; } }
    for (let i = 0; i < 5; i++) { const k = ((t * (.06 + i * .013)) + i * .23) % 1, x = Math.round(W * (1.1 - k * 1.3)), y = Math.round(L.horizon * .6 + i * 17 + Math.sin(t * 2 + i) * 6 + k * 40); const f = Math.floor(t * 5 + i) % 3; px(x, y, '#ffb3c9'); if (f) px(x + 1, y + (f === 1 ? -1 : 1), '#ff8fb1'); }
  }
}
// 13×13 menu icons: a star (new game), a route map (continue), crossed blades (quick battle), two balls (versus), play.
const TITLE_ICONS = {
  crown: ['.............', '.O....O....O.', 'OYO..OYO..OYO', 'OYYO.OYO.OYYO', 'OYYYOOYOOYYYO', 'OYYYYYYYYYYYO', 'OYYYYYYYYYYYO', 'OYYRYYWYYRYYO', 'OyYYYYYYYYYyO', 'OyyyyyyyyyyyO', '.OOOOOOOOOOO.', '.............', '.............'],
  star: ['......O......', '.....OYO.....', '.....OYO.....', '....OYWYO....', 'OOOOOYWYOOOOO', 'OYYYYYWYYYYyO', '.OYYYYYYYYyO.', '..OYYYYYYyO..', '...OYYYYyO...', '..OYYyOYYyO..', '..OYyO.OYyO..', '.OYyO...OyyO.', '.OOO.....OOO.'],
  map: ['.OOOO.OOO.OO.', 'OKWWWOGGGOWWO', 'OKWRWOGgGOWWO', 'OKWWWOGGGOWBO', 'OKWWROGGWOWBO', 'OKWWWRGWROBBO', 'OKGGWOWRWOWWO', 'OKGgWOWWROWWO', 'OKGGWOWWWRWWO', 'OKWWWOBBWOWRO', 'OKWWWOBBWOWWO', '.OOO.OOOO.OO.', '.............'],
  blades: ['OO.........OO', 'OSO.......OSO', '.OSO.....OSO.', '..OSO...OSO..', '...OSO.OSO...', '....OSOSO....', '.....OsO.....', '....OSOsO....', '.OO.OsO.OsO.O', 'OKKOsO...OsOK', '.OKKO.....OKO', 'OKOKKO...OKOK', 'OO..OO...OO.O'],
  duo: ['..OOOO.......', '.ORRRRO......', 'ORRhRRRO.....', 'ORRRRRRO.OOOO', 'OOOWWOOOOBBBBO', 'OWWOOWWOBBhBBBO', 'OWWWWWWOBBBBBBO', '.OWWWWOOOOWWOOO', '..OOOOOOWWOOWWO', '.......OWWWWWWO', '........OWWWWO.', '.........OOOO..', '.............'],
  gear: ['.....OOO.....', '..OO.OSO.OO..', '.OSSOOSOOSSO.', '.OSSSSSSSSsO.', '..OSSOOOSsO..', 'OOOSO...OsOOO', 'OSSSO...OssSO', 'OOOSO...OsOOO', '..OSsOOOssO..', '.OSSsssssssO.', '.OSsOOsOOssO.', '..OO.OsO.OO..', '.....OOO.....'],
  play: ['...OOOOOOO...', '..OGGGGGGGO..', '.OGGWGGGGGGO.', 'OGGGWWGGGGGGO', 'OGGGWWWGGGGGO', 'OGGGWWWWGGGGO', 'OGGGWWWWWGGGO', 'OGGGWWWWGGGGO', 'OGGGWWWGGGGGO', 'OGGGWWGGGGGGO', '.OgGWGGGGGGgO.', '..OgggggggO..', '...OOOOOOO...'],
};
function titleIcon(id, x, y, dim) { const rows = TITLE_ICONS[id]; if (!rows) return; stampAt(Math.round(x), Math.round(y), rows, dim ? { O: '#07051c', Y: '#b9a36a', y: '#8a7640', W: '#c9c6e8', S: '#b8bcd8', s: '#7e84a8', K: '#6a4a3a', G: '#5c8f5c', g: '#3e6a44', R: '#b25860', h: '#e6a0a0', B: '#5a78b8', b: '#3a5288' } : { O: '#07051c', Y: '#ffd049', y: '#e09a1c', W: '#fbf6e8', S: '#e6ecff', s: '#9aa6d6', K: '#b8764a', G: '#62c86a', g: '#2f8a4a', R: '#f04848', h: '#ffb0b0', B: '#4a8cff', b: '#2a5ad0' }); }

// ---------------------------------------------------------------- menu
function titleSelect(i) {
  if (SC.titleFx?.action || i === SC.i || SC.titleConfirm) return;
  SC.i = i; SC.titleFx.focusAt = SC.t; SC.titleFx.cardAt = null; Audio.sfx('titleFocus'); titleHop(i % 4);
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
  if (suspended) items.push({ label: 'RESUME BATTLE', sub: 'Back to your last turn', icon: 'play', col: '#5ee06a', run: resumeSuspend });
  if (save) { const chapter = CHAPTERS[clamp(save.chapter || 0, 0, CHAPTERS.length - 1)]; items.push({ label: 'CONTINUE', sub: save.beaten ? 'Kanto is free · replay for stars' : 'Front ' + chapter.num + ' · ' + chapter.title, icon: 'map', col: '#5ec8ff', run: continueCampaign }); }
  items.push({ label: 'NEW GAME', sub: 'Free Kanto from Team Rocket', icon: 'star', col: '#ffd049', run: () => { if (save) openTitleConfirm(); else startNewGame(); } });
  items.push({ label: 'QUICK BATTLE', sub: 'Skirmish · Tower · Safari · Conquest', icon: 'blades', col: '#ff6a5a', run: () => goScene('quick') });
  items.push({ label: 'VERSUS', sub: 'Two players, one screen', icon: 'duo', col: '#8ab4ff', run: startVersusSetup });
  items.push({ label: 'COMMANDERS', sub: 'Gym Leaders, their Aces and powers', icon: 'crown', col: '#e0b030', run: openCoRoom });
  items.push({ label: 'OPTIONS', sub: 'Sound, battle scenes, motion, data', icon: 'gear', col: '#aab0d8', run: () => openOptions() });
  items.forEach((item, i) => { item.hover = i === 0 ? 1 : 0; });
  SC.titleItems = items; SC.menuLen = items.length; SC.titleConfirm = null;
  // the knoll shows your own party once a journey has begun: the Ace beside the Tactician, crowned
  const party = save && save.party && save.party.length ? save.party : null;
  if (party) { const ace = party[clamp(save.captainPid || 0, 0, party.length - 1)], others = party.filter(p => p !== ace).map(p => p.num), n = Math.min(4, party.length), rs = n === 1 ? 0 : Math.ceil(n / 2);
    SC.titleTeam = others.slice(0, rs).concat([ace.num], others.slice(rs, n - 1)); SC.titleAce = rs; }
  else { SC.titleTeam = null; SC.titleAce = null; }
  SC.titleSave = save || null;
  SC.titleFx = { particles: [], focusAt: -10, logoAt: -10, down: null, action: null, hop: [], landed: {}, shake: 0 };
}
// In-game confirmation for replacing a campaign save (never a browser dialog).
function openTitleConfirm() { SC.titleConfirm = { i: 0, t: SC.t }; Audio.sfx('menu'); } // KEEP SAVE has the focus: losing a journey takes a deliberate step
function titleConfirmRect() { const w = Math.min(VIEW.w - 16, 230), h = 74; return { x: Math.round((VIEW.w - w) / 2), y: Math.round((VIEW.h - h) / 2), w, h }; }
function titleConfirmChoose(yes) { SC.titleConfirm = null; if (yes) { Audio.sfx('titleConfirm'); startNewGame(); } else Audio.sfx('cancel'); }
function titleLayout(count) {
  const W = VIEW.w, H = VIEW.h, portrait = H > W || W < 320, compact = !portrait && H < 245;
  const gap = compact ? 3 : 4;
  // two columns when one would not fit between the logo and the footer (short landscape screens)
  const cell1 = logoCell(W, H, portrait ? W - 16 : Math.max(Math.min(206, Math.floor(W * .42)) + 20, Math.floor(W * .46))), room1 = H - (compact ? 28 : 30) - ((compact ? 6 : Math.max(10, Math.min(24, Math.floor(H * .06)))) + logoMetrics(cell1).h + (compact ? 4 : 20));
  const cols = !portrait && count > 4 && room1 < count * 18 + (count - 1) * gap ? 2 : 1;
  const w = portrait ? Math.min(236, W - 24) : cols === 2 ? Math.floor((W - 44) / 2) : Math.min(206, Math.floor(W * .42));
  const x = portrait ? Math.floor((W - w) / 2) : Math.max(14, Math.floor(W * .05));
  const logoMax = portrait ? W - 16 : Math.max(w + 20, Math.floor(W * .46));
  const cell = logoCell(W, H, logoMax), M = logoMetrics(cell);
  const logoY = portrait ? Math.max(10, Math.floor(H * .04)) : compact ? 6 : Math.max(10, Math.min(24, Math.floor(H * .06)));
  const logoCx = portrait ? W / 2 : Math.max(Math.round(M.w / 2) + 4, x + w / 2), endY = H - (compact ? 28 : 30), rows = Math.ceil(count / cols); // never off the left edge
  let rowH, menuY;
  if (portrait) { rowH = clamp(Math.floor((H * .42 - (rows - 1) * gap) / rows), 20, 30); menuY = endY - rows * rowH - (rows - 1) * gap; }
  else { menuY = logoY + M.h + (compact ? 4 : 20); rowH = clamp(Math.floor((endY - menuY - (rows - 1) * gap) / rows), 18, 32); }
  // the landscape: horizon, sun, lake, the shore and the knoll with the team, placed around the logo and the menu
  const team = SC.titleTeam && SC.titleTeam.length ? SC.titleTeam : [1, 25, 4, 7];
  let horizon, shoreY, cliffY, knollX, knollW, teamGap, sunX;
  if (portrait) {
    shoreY = menuY - 12; cliffY = shoreY - 12; horizon = Math.round(clamp(cliffY - 34, logoY + M.h + 40, H * .62));
    knollX = Math.round(W / 2); knollW = Math.round(W * .62); teamGap = Math.min(42, (W - 44) / 3.3); sunX = Math.round(W * .68);
  } else {
    horizon = Math.round(H * .58); shoreY = Math.round(H * .8); cliffY = Math.round(H * .72);
    knollX = Math.round(W * .76); knollW = Math.round(W * .3); teamGap = Math.min(52, W * .1); sunX = Math.round(W * .74);
  }
  // the Tactician takes the middle of the crest when the team leaves room for them (the team parts around them)
  const tactician = !compact && H >= 200 && (portrait ? W >= 180 : W >= 300), split = tactician ? Math.round(clamp(teamGap * .35, 8, 16)) : 0;
  const teamX = Math.round(knollX - teamGap * (team.length - 1) / 2);
  return { portrait, compact, cols, x, w, cell, logoY, logoCx, logoH: M.h, menuY, rowH, gap, horizon, shoreY, cliffY, knollX, knollW, sunX, sunR: Math.round(clamp(Math.min(W, H) * .12, 14, 40)), team, teamGap, teamX, tactician, split, aceAt: SC.titleAce != null ? SC.titleAce : -1 };
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
  rect(x + 1, y + 2, 3, h - 4, selected ? (item.col || UI.gold) : shade(item.col || '#6a6a90', -.55)); if (selected) hline(x + 1, y + 2, 3, '#ffffff');
  if (selected) { if (!REDUCED) { const k = (SC.t - fx.focusAt) / .45; if (k >= 0 && k < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip(); ctx.globalAlpha = u * .25 * Math.sin(k * Math.PI); for (let q = 0; q < 6; q++) vline(x + Math.round(k * (w + 24)) - 12 + q, y + 2, h - 4, '#fff6c9'); ctx.restore(); } } }
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
  SC.hits = [];
  items.forEach((item, i) => { const x = L.cols === 2 ? 18 + (i % 2) * (L.w + 8) : L.x, y = L.menuY + Math.floor(i / L.cols) * (L.rowH + L.gap); titleCard(x, y, L.w, L.rowH, item, SC.i === i, () => titleActivate(i), i); });
  // the sound control is its own touch target, separate from keyboard navigation
  const sound = Audio.muted ? 'SOUND OFF' : 'SOUND ON', sw = textWidth(sound) + 20; SC.titleSound = { x: 6, y: H - 24, w: sw, h: 20 };
  const soundHot = !VIEW.touch && INPUT.x >= 6 && INPUT.x < 6 + sw && INPUT.y >= H - 24; if (soundHot) rrect(6, H - 23, sw, 18, '#2c2f78', 2);
  iconAt('note', 9, H - 19, Audio.muted ? '#8d8fbe' : UI.gold); text(sound, 21, H - 17, soundHot ? UI.ink : '#b9bce0', { shadow: '#07051c' });
  if (!L.portrait) { hintLine(VIEW.touch ? ['tap to begin'] : [['↑↓', 'select'], ['Z', 'confirm']], W / 2, H - 17, { pill: false, col: '#b9bce0' }); textR('GEN I · FAN GAME', W - 10, H - 17, '#8d8fbe', { shadow: '#07051c' }); }
  else textR('GEN I · FAN GAME', W - 8, H - 17, '#8d8fbe', { shadow: '#07051c' });
  if (SC.titleSave && items[SC.i] && items[SC.i].label === 'CONTINUE' && !SC.titleConfirm) drawTrainerCard(L, SC.titleSave);
  drawTitleParticles();
  if (SC.titleConfirm) drawTitleConfirm();
}
// With CONTINUE in focus, the journey so far as a trainer card: the front reached (a pip per front), the stars, the Gym
// Leaders freed (their faces, like badges) and the party with its Ace crowned. It floats in the sky on wide screens and
// sits under the logo on phones, in a compact form.
function drawTrainerCard(L, save) {
  const W = VIEW.w, t = SC.t, wide = !L.portrait, n = CHAPTERS.length, reached = clamp(save.chapter || 0, 0, n), ch = CHAPTERS[Math.min(reached, n - 1)], party = save.party || [], ace = party[save.captainPid || 0];
  const stars = CHAPTERS.reduce((a, c) => a + ((save.rating && save.rating[c.id]) || 0), 0), leaders = coUnlocked(save).filter(c => c !== 'you');
  const where = save.beaten ? 'KANTO IS FREE' : 'FRONT ' + ch.num + ' · ' + ch.title.toUpperCase(), fx = SC.titleFx, pop = REDUCED ? 1 : easeOutBack(clamp((t - (fx.cardAt == null ? (fx.cardAt = t) : fx.cardAt)) / .3, 0, 1), 1.8);
  const icons = (x, y, max) => party.slice(0, max).forEach((p, i) => { const bob = !REDUCED && i === Math.floor(t * 2) % Math.min(max, party.length) ? -1 : 0; ctx.drawImage(monIcon(p.num), x + i * 22, y + bob, 24, 18); if (p === ace) drawCrown(x + i * 22 + 13, y - 2 + bob); });
  if (!wide) { const w = W - 20, h = 38, x = 10, y = L.logoY + L.logoH + 12; if (y + h > L.menuY - 30) return; ctx.save(); ctx.globalAlpha = clamp(pop, 0, 1);
    panel(x, y, w, h, { fill: '#1a1e4a' }); text(fitLabel(where, w - 60), x + 7, y + 6, UI.gold); textR('★ ' + stars + '/' + n * 3, x + w - 7, y + 6, '#ffe070'); icons(x + 5, y + 16, Math.min(6, Math.floor((w - 10) / 22))); ctx.restore(); return; }
  const w = Math.min(190, Math.round(W * .31)), h = 100, x = W - w - 10, y = 22 + Math.round((1 - pop) * -10); ctx.save(); ctx.globalAlpha = clamp(pop, 0, 1);
  const p = panel(x, y, w, h, { header: 'TRAINER CARD', headerRight: 'TACTICIAN', headerRightCol: UI.gold, headerFill: '#2a2470' });
  const bust = trainerBust('red', false); portraitBg(x + 6, p.cy, 34, 34, 0); if (bust) { ctx.save(); ctx.beginPath(); ctx.rect(x + 6, p.cy, 34, 34); ctx.clip(); ctx.drawImage(bust, x + 6 - 7, p.cy - 4); ctx.restore(); } outline(x + 5, p.cy - 1, 36, 36, UI.border2);
  const tx = x + 46, tw = w - 52; text(fitLabel(save.beaten ? 'KANTO IS FREE' : ch.title.toUpperCase(), tw), tx, p.cy + 1, UI.gold);
  for (let i = 0; i < n; i++) { const on = i < reached, cur = i === reached && !save.beaten; rect(tx + i * 9, p.cy + 12, 7, 5, UI.inset); rect(tx + 1 + i * 9, p.cy + 13, 5, 3, on ? UI.gold : cur ? (Math.floor(t * 3) % 2 ? '#8ab4ff' : '#3d5aa0') : '#2a2d5a'); }
  text('★ ' + stars + ' / ' + n * 3 + ' stars', tx, p.cy + 22, '#ffe070');
  let yy = p.cy + 38; text('LEADERS', x + 7, yy + 5, UI.muted); const lx = x + 7 + textWidth('LEADERS') + 5;
  if (leaders.length) leaders.slice(0, Math.floor((x + w - 6 - lx) / 19)).forEach((id, i) => { const f = trainerFace(COS[id].tr); rect(lx + i * 19, yy, 17, 17, shade(COS[id].col, -.45)); if (f) { ctx.save(); ctx.beginPath(); ctx.rect(lx + i * 19, yy, 17, 17); ctx.clip(); ctx.drawImage(f, lx + i * 19, yy); ctx.restore(); } outline(lx + i * 19 - 1, yy - 1, 19, 19, COS[id].col); });
  else text('none freed yet', lx, yy + 5, UI.dim);
  yy += 22; icons(x + 4, yy, Math.min(6, Math.floor((w - 8) / 22)));
  ctx.restore();
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

// ---------------------------------------------------------------- options
// Everything that shapes how the game plays out on screen, in one place, over the title's landscape: rows like the
// battle's day menu (a chip, the label, the value or a lamp; ◂ ▸ change it), the focused row explained underneath, and
// ERASE ALL DATA behind a confirmation. Changes apply at once and are kept.
const MOTION_LABEL = { auto: 'Auto', full: 'Full', reduced: 'Reduced' };
function optionRows() {
  const cycle = (k, d) => { const vs = PREF_VALUES[k]; setPref(k, vs[(vs.indexOf(PREF[k]) + d + vs.length) % vs.length]); };
  return [
    { id: 'sound', label: 'Sound', icon: 'note', col: '#3aa870', lamp: !Audio.muted, change: () => Audio.toggle(), sub: VIEW.touch ? 'Music and sound effects' : 'Music and sound effects (M in any screen)' },
    { id: 'battle', label: 'Battle scene', icon: 'vs', col: '#d8a030', value: BATTLE_PREF_LABEL[PREF.battle], change: d => cycle('battle', d), sub: PREF.battle === 'full' ? 'Every attack plays in the side view, blow by blow' : PREF.battle === 'quick' ? 'The side view, faster' : 'Attacks play on the board itself' },
    { id: 'motion', label: 'Motion', icon: 'wing', col: '#3a8ad8', value: MOTION_LABEL[PREF.motion] + (PREF.motion === 'auto' ? (PREFERS_REDUCED ? ' · reduced' : ' · full') : ''), change: d => cycle('motion', d), sub: 'Reduced drops screen shakes, flashes and most animation; Auto follows your system' },
    { id: 'guide', label: 'Conquest guide', icon: 'help', col: '#3a8ad8', lamp: PREF.territoryGuide === 'show', change: d => cycle('territoryGuide', d), sub: 'Show the three rules before each Conquest battle' },
    { id: 'opening', label: 'Watch the opening', icon: 'play', col: '#3aa870', more: true, run: () => { Audio.sfx('ok'); startIntro(); }, sub: 'The night the PCs went dark' },
    { id: 'credits', label: 'Credits', icon: 'book', col: '#7a7a8a', more: true, run: () => { Audio.sfx('ok'); const s = loadSave(); goScene('credits', { party: s ? s.party : [], back: 'options' }); }, sub: 'Who made the game, and the sprites it uses' },
    { id: 'erase', label: 'Erase all data', icon: 'skull', col: '#d23c3c', danger: true, run: () => { Audio.sfx('menu'); SC.data.confirm = { i: 0, t: SC.t }; }, sub: 'Your journey, records and settings, gone for good (asks first)' },
  ];
}
function openOptions() { goScene('options', { back: SC.name === 'title' ? SC.i : 0 }); }
function optionsLayout() { const W = VIEW.w, H = VIEW.h, rows = optionRows(), rh = VIEW.touch || narrowView() ? 20 : 17, w = Math.min(290, W - 16), foot = setupFootTop(), top = narrowView() ? 30 : 34, h = 20 + rows.length * rh + 6 + 26; return { W, H, rows, rh, w, h, x: Math.round((W - w) / 2), y: Math.max(top, Math.round(top + (foot - top - h) / 2)), foot }; }
function optionsDraw() {
  const S = SC.data || (SC.data = {}); if (!SC.titleItems) initTitle(); const L0 = titleLayout(SC.titleItems.length); titleScene(L0); dimScreen(.55); SC.hits = [];
  const O = optionsLayout(), { x, y, w, h, rh, rows } = O; SC.i = clamp(SC.i, 0, rows.length - 1);
  setupHeader('OPTIONS', null, 0, null, 6);
  const tok = unfold('options', x, y, w, h, .18); const p = panel(x, y, w, h, { fill: '#1a1e4a', header: 'HOW THE GAME PLAYS', headerRight: w >= 260 ? 'KEPT ON THIS DEVICE' : null, headerRightCol: UI.dim });
  rows.forEach((r, i) => { const ry = p.cy - 1 + i * rh, hot = SC.i === i, cy = ry + Math.round(rh / 2);
    if (hot) { rrect(x + 4, ry, w - 8, rh - 1, r.danger ? '#4a1a2a' : '#34408e', 1); rect(x + 4, ry + 1, 2, rh - 3, r.danger ? UI.red : UI.gold); }
    rrect(x + 9, cy - 6, 13, 13, UI.inset, 2); rrect(x + 10, cy - 5, 11, 11, r.col, 1); iconAt(r.icon, x + 11, cy - 4, '#ffffff');
    text(r.label, x + 27, cy - 3, r.danger ? (hot ? '#ffb0b0' : '#e87878') : hot ? '#ffffff' : UI.ink);
    let rx = x + w - 10;
    if (r.lamp != null) { circle(rx - 4, cy, 4, UI.inset); circle(rx - 4, cy, 3, r.lamp ? '#5ee06a' : '#3a3a50'); if (r.lamp) px(rx - 5, cy - 1, '#d8ffe0'); textR(r.lamp ? 'ON' : 'OFF', rx - 11, cy - 3, r.lamp ? '#8ae89a' : UI.dim); }
    else if (r.value != null) { const aw = 10; text('▸', rx - 5, cy - 3, hot ? UI.gold : UI.dim); textR(r.value, rx - aw, cy - 3, hot ? UI.gold : '#e8d8a0'); text('◂', rx - aw - textWidth(r.value) - 8, cy - 3, hot ? UI.gold : UI.dim);
      hit(rx - aw - textWidth(r.value) - 10, ry, 12, rh, () => { SC.i = i; r.change(-1); Audio.sfx('menu'); }, r.label.toUpperCase() + '-'); hit(rx - 8, ry, 12, rh, () => { SC.i = i; r.change(1); Audio.sfx('menu'); }, r.label.toUpperCase() + '+'); }
    else if (r.more) { for (let k = 0; k < 3; k++) vline(rx - 2 - k, cy - k, 2 * k + 1, hot ? UI.gold : UI.muted); }
    hit(x + 4, ry, w - (r.value != null ? 70 : 8), rh, () => { if (SC.i !== i) { SC.i = i; Audio.sfx('cursor'); } optionActivate(r, 1); }, r.label.toUpperCase()); });
  const fy = p.cy - 1 + rows.length * rh + 4, it = rows[SC.i]; hline(x + 5, fy, w - 10, UI.inset); wrap(it.sub, w - 16).slice(0, 2).forEach((l, k) => text(l, x + 8, fy + 4 + k * 9, it.danger ? '#e8a0a0' : UI.muted));
  unfoldEnd(tok);
  setupFooter({ back: { label: '◂ TITLE', run: () => optionsBack() }, hints: VIEW.touch ? ['tap a row to change it'] : [['▲▼', 'choose'], ['◂▸', 'change'], ['X', 'back']] });
  if (S.confirm) drawOptionsConfirm(S.confirm);
}
function optionActivate(r, d) { if (r.run) r.run(); else if (r.change) { r.change(d); Audio.sfx(r.lamp === false ? 'ok' : 'menu'); } }
function optionsBack() { Audio.sfx('cancel'); const back = SC.data && SC.data.back; goScene('title'); SC.i = back || 0; if (SC.titleItems) SC.titleItems.forEach((it, k) => { it.hover = k === SC.i ? 1 : 0; }); }
function drawOptionsConfirm(c) {
  const W = VIEW.w, H = VIEW.h, w = Math.min(W - 16, 240), h = 78, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2); dimScreen(.6); SC.hits = [];
  const p = panel(x, y, w, h, { header: 'ERASE ALL DATA?', headerFill: '#5a1d2e' }); wrap('Your journey, Tower ranks, Safari record and settings will be deleted.', w - 16).slice(0, 2).forEach((l, k) => textC(l, x + w / 2, p.cy + k * 9, UI.ink));
  const bw = Math.floor((w - 24) / 2), by = y + h - 26; [['KEEP', false, 'ghost'], ['ERASE', true, 'danger']].forEach(([label, yes, variant], i) => { const bx = x + 8 + i * (bw + 8); if (c.i === i && !REDUCED) { ctx.globalAlpha = .35 + .2 * Math.sin(SC.t * 6); rrect(bx - 2, by - 2, bw + 4, 22, UI.gold, 2); ctx.globalAlpha = 1; } uiButton(bx, by, bw, 18, label, { hot: c.i === i, variant, big: true }); hit(bx, by, bw, 18, () => optionsErase(yes), label); });
}
function optionsErase(yes) {
  SC.data.confirm = null; if (!yes) { Audio.sfx('cancel'); return; } Audio.sfx('titleConfirm');
  if (!PARAMS.has('nosave')) try { const keys = ['pk_save', 'pk_suspend', 'pk_records', 'pk_mute', 'pk_intro'].concat(Object.keys(PREF).map(k => 'pk_' + k)); for (let i = 0; i < (localStorage.length || 0); i++) { const k = localStorage.key(i); if (k && k.startsWith('pk_') && !keys.includes(k)) keys.push(k); } for (const k of keys) localStorage.removeItem(k); } catch (_) { }
  SAVE = null; PREF.battle = 'full'; PREF.territoryGuide = 'show'; PREF.motion = 'auto'; applyMotion(); goScene('title');
}
function optionsInput(ev) {
  const S = SC.data || {}, rows = optionRows();
  if (S.confirm) { const c = S.confirm; if (ev.type === 'key') { if (['left', 'right', 'up', 'down'].includes(ev.key)) { c.i = 1 - c.i; Audio.sfx('cursor'); } else if (ev.key === 'ok') optionsErase(c.i === 1); else if (ev.key === 'back') optionsErase(false); } else if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } return; }
  if (ev.type === 'key') { if (ev.key === 'up' || ev.key === 'down') { SC.i = (SC.i + (ev.key === 'up' ? -1 : 1) + rows.length) % rows.length; Audio.sfx('cursor'); }
    else if (ev.key === 'left' || ev.key === 'right') { const r = rows[SC.i]; if (r.change) { r.change(ev.key === 'left' ? -1 : 1); Audio.sfx('menu'); } }
    else if (ev.key === 'ok') optionActivate(rows[SC.i], 1); else if (ev.key === 'back') optionsBack(); else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'move' && !ev.touch) { const O = optionsLayout(), i = Math.floor((ev.y - (O.y + 21)) / O.rh); if (ev.x >= O.x && ev.x < O.x + O.w && i >= 0 && i < rows.length && i !== SC.i) { SC.i = i; Audio.sfx('cursor'); } return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- the opening
// Played once when the game starts, before the title (any key or tap skips it after a moment): night over Kanto, a Poké
// Center glowing in a sleeping town until Team Rocket's airship arrives, its searchlight finds the Center and the lights
// go out, window after window; the commanders face off, Advance Wars style, the Tactician against Giovanni; a white
// flash, and the logo slams down letter by letter over the dusk, then glides to its place as the title's menu arrives.
const INTRO_T = { night: 3.7, vs: 6.1, end: 8.7 };
// It plays on the first visit, behind a PRESS START screen (a browser only lets sound play after a key or a tap), and
// again from OPTIONS; later visits open on the title. Reduced motion skips it.
function introSeen() { try { return localStorage.getItem('pk_intro') === '1'; } catch (_) { return false; } }
function introWanted() { return PARAMS.has('splash') || (!introSeen() && !(REDUCED || PARAMS.has('nosave') || PARAMS.has('silent') || PARAMS.has('nointro'))); }
function startIntro() { initTitle(); for (const tr of ['red', 'giovanni']) trainerImg(tr); if (!PARAMS.has('nosave')) try { localStorage.setItem('pk_intro', '1'); } catch (_) { } goScene('intro', {}); Audio.playMusic('enemy'); }
// PRESS START: the Poké Ball mark pulsing in the dark, the prompt blinking in the display face, the fan-game notice.
function splashDraw() {
  const W = VIEW.w, H = VIEW.h, t = SC.t, cx = Math.round(W / 2), cy = Math.round(H * .42), r = Math.round(clamp(Math.min(W, H) * .09, 12, 30)); rect(0, 0, W, H, '#04040c'); SC.hits = [];
  for (let k = 0; k < 3; k++) { const f = ((t * .5 + k / 3) % 1); ctx.globalAlpha = (1 - f) * .35; ellipseRing(cx, cy, Math.round(r + 6 + f * r * 2.2), Math.round(r + 6 + f * r * 2.2), 1, '#3a4aa8'); } ctx.globalAlpha = 1;
  const a = clamp(t / .6, 0, 1); ctx.globalAlpha = a; drawTitleBall(cx, cy, r, t); ctx.globalAlpha = 1;
  if (t > .5 && Math.floor(t * 2.2) % 3) displayC('PRESS START', cx, cy + r + 18, { style: 'gold', slant: 1 });
  textC(VIEW.touch ? 'tap anywhere' : 'any key or click', cx, cy + r + 38, '#6a6a9a');
  const full = 'A fan game · Pokémon © Nintendo / Game Freak / Creatures', notice = textWidth(full) <= W - 16 ? [full] : ['A fan game'].concat(wrap('Pokémon © Nintendo / Game Freak / Creatures', W - 16)); // it breaks at the dot first
  notice.forEach((l, k) => textC(l, cx, H - 14 - (notice.length - 1 - k) * 9, '#4a4a72'));
}
function splashInput(ev) { if (SC.t > .3 && (ev.type === 'key' || ev.type === 'up')) { Audio.sfx('titleConfirm'); startIntro(); } }
function finishIntro() { if (SC.name !== 'intro') return; goScene('title'); SC.titleFx.logoSettled = true; }
function introInput(ev) { if (SC.t > .6 && (ev.type === 'key' || ev.type === 'up')) { Audio.sfx('ok'); finishIntro(); } }
function introDraw() {
  const t = SC.t, T = INTRO_T; SC.hits = []; if (!SC.data) SC.data = {};
  if (t < T.night) introNight(t); else if (t < T.vs) introVersus(t - T.night); else if (t < T.end) introLogo(t - T.vs); else { finishIntro(); return; }
  if (t > .6 && t < T.end - .5) textR(VIEW.touch ? 'tap to skip' : 'any key to skip', VIEW.w - 6, VIEW.h - 11, '#6a6a9a', { shadow: '#000' });
}
const INTRO_CACHE = { key: null };
function introSet(W, H, g) {
  const key = W + 'x' + H; if (INTRO_CACHE.key === key) return INTRO_CACHE; const r = mulberry32(41), houses = [], cw = Math.round(clamp(Math.min(H * .32, W * .4), 52, 104));
  for (const side of [-1, 1]) { let x = Math.round(W / 2 + side * (cw / 2 + 10)); for (let k = 0; k < 8; k++) { const w = 18 + Math.floor(r() * 16), h = 12 + Math.floor(r() * 14), hx = side < 0 ? x - w : x; if (hx < -w || hx > W) break;
      const win = []; for (let wy = 4; wy < h - 4; wy += 6) for (let wx = 3; wx < w - 4; wx += 6) if (r() < .55) win.push({ x: hx + wx, y: wy }); houses.push({ x: hx, w, h, win, delay: k * .12 + r() * .1 }); x += side * (w + 3 + Math.floor(r() * 6)); } }
  return Object.assign(INTRO_CACHE, { key, far: ridge(W, 7, g * .22, g - g * .1), near: ridge(W, 19, g * .12, g - g * .02), houses, cw });
}
const NIGHT = ['#04040f', '#070818', '#0b0c22', '#10112e', '#16163a', '#1e1a46', '#27204f'];
function introNight(t) {
  const W = VIEW.w, H = VIEW.h, g = Math.round(H * .74), cx = Math.round(W / 2), D = SC.data, I = introSet(W, H, g), OUT = 2.75, out = t >= OUT;
  const bh = g / NIGHT.length; for (let i = 0; i < NIGHT.length; i++) { const y0 = Math.round(i * bh); rect(0, y0, W, Math.round((i + 1) * bh) - y0, NIGHT[i]); if (i) for (let x = (y0 & 1); x < W; x += 2) px(x, y0, NIGHT[i - 1]); }
  for (let i = 0; i < 46; i++) { const x = (i * 97 + 13) % W, y = (i * 53 + 7) % Math.max(1, Math.round(g * .62)), k = Math.sin(t * (1.1 + i % 5 * .3) + i * 2.1); if (k > .1) px(x, y, k > .85 ? '#ffffff' : '#8a88c0'); }
  const mx = Math.round(W * .8), my = Math.round(g * .2), mr = Math.round(clamp(H * .045, 7, 15)); circle(mx, my, mr + 4, '#121236'); circle(mx, my, mr, '#ece6cc'); circle(mx - Math.round(mr * .3), my - Math.round(mr * .25), Math.max(1, Math.round(mr * .25)), '#d2caae'); circle(mx + Math.round(mr * .35), my + Math.round(mr * .3), Math.max(1, Math.round(mr * .18)), '#d2caae');
  for (let x = 0; x < W; x++) { rect(x, I.far[x], 1, g - I.far[x], '#0e0c26'); rect(x, I.near[x], 1, g - I.near[x], '#141130'); }
  rect(0, g, W, H - g, '#07060e'); hline(0, g, W, '#1a1632');
  // the town: its windows go out one after another once the Center has gone dark
  for (const h of I.houses) { const top = g - h.h; rect(h.x, top, h.w, h.h, '#120f26'); for (let k = 0; k < 4; k++) hline(h.x - 1 + k, top - 1 - k, h.w + 2 - 2 * k, '#18132e'); for (const w of h.win) { const lit = !out || t < OUT + .25 + h.delay; rect(w.x, top + w.y, 2, 3, lit ? '#ffd27a' : '#1c1834'); } }
  // the Poké Center: warm windows, an open door and its PC sign, until the blackout (a flicker, then dark)
  const cw = I.cw, chh = Math.round(cw * .55), bx = cx - Math.round(cw / 2), by = g - chh, flick = t >= OUT && t < OUT + .32 ? (Math.floor(t * 38) % 3 === 0) : !out, on = !out || flick;
  if (on) for (let k = 0; k < 4; k++) { ctx.globalAlpha = .045; circle(cx, by + chh / 2, Math.round(cw * (.45 + k * .18)), '#ffd27a'); ctx.globalAlpha = 1; } // the warm glow, in soft steps
  rect(bx, by, cw, chh, '#2a2340'); hline(bx, by, cw, '#3a3058'); rect(bx - 3, by - 6, cw + 6, 6, '#5a1a2c'); hline(bx - 3, by - 6, cw + 6, '#7a2a3c'); hline(bx - 3, by - 1, cw + 6, '#3a0e1a');
  for (let k = 0; k < 4; k++) { const wx = bx + 5 + k * Math.round((cw - 14) / 3), wy = by + 5; rect(wx, wy, 6, 5, on ? '#ffe6a0' : '#1a1630'); if (on) { hline(wx, wy, 6, '#fff6d0'); ctx.globalAlpha = .12; circle(wx + 3, wy + 2, 7, '#ffd27a'); ctx.globalAlpha = 1; } }
  rect(cx - 5, g - 12, 10, 12, on ? '#ffeec0' : '#161226'); outline(cx - 6, g - 13, 12, 13, '#3a3058');
  const sw = 26; rect(cx - sw / 2, by - 18, sw, 11, '#1a0610'); outline(cx - sw / 2 - 1, by - 19, sw + 2, 13, '#3a1a2a'); textC('PC', cx, by - 16, on ? '#ff6a7a' : '#3a0a14', on ? { shadow: '#ff2a40' } : {});
  if (on) for (let k = 0; k < 3; k++) { ctx.globalAlpha = .07; circle(cx, by - 13, 9 + k * 6, '#ff4a5a'); ctx.globalAlpha = 1; }
  // the airship arrives and its searchlight finds the Center
  const ax = Math.round(lerp(W + 50, cx + cw * .75, easeOut(clamp((t - .4) / 1.7, 0, 1)))), ay = Math.round(g * .34 + Math.sin(t * 1.3) * 2);
  if (t > 1.7) { const k = clamp((t - 1.7) / .3, 0, 1), aim = clamp((t - 1.9) / .6, 0, 1); drawSearchlight(ax - 2, ay + 9, Math.round(lerp(ax - 70, cx, easeInOut(aim))), by - 3, k); }
  drawAirshipHull(ax, ay, t);
  if (out && !D.blackout) { D.blackout = true; Audio.sfx('elec'); D.shakeAt = t; } if (t >= OUT + .32 && !D.thud) { D.thud = true; Audio.sfx('thud'); }
  // the caption types itself out, and turns red when the lights die
  const cap = 'KANTO · THE NIGHT THE PCs WENT DARK', n = Math.floor(clamp((t - .5) / 1.7, 0, 1) * cap.length), cx0 = Math.round(W / 2 - textWidth(cap) / 2), cy0 = g + Math.round((H - g) / 2) - 4;
  text(cap.slice(0, n) + (n < cap.length && Math.floor(t * 6) % 2 ? '_' : ''), cx0, cy0, out ? '#ff8a9a' : '#e8e0c8', { shadow: '#000' }); if (n > (D.typed || 0)) { D.typed = n; if (n % 2 && cap[n - 1] !== ' ') Audio.sfx('text'); }
  const fade = Math.min(clamp(t / .5, 0, 1), clamp((INTRO_T.night - t) / .45, 0, 1)); if (fade < 1) { ctx.globalAlpha = 1 - fade; rect(0, 0, W, H, '#000000'); ctx.globalAlpha = 1; }
}
function introVersus(t) {
  const W = VIEW.w, H = VIEW.h, D = SC.data, big = W >= 400 && H >= 300 ? 2 : 1, mid = Math.round(H / 2), bh = Math.round(H * .34), sk = D.vsAt != null && t - D.vsAt < .3 && !REDUCED ? Math.round(Math.sin(t * 90) * 3 * (1 - (t - D.vsAt) / .3)) : 0;
  rect(0, 0, W, H, '#05040c'); ctx.save(); ctx.translate(0, sk);
  const inA = easeOut(clamp(t / .28, 0, 1)), inB = easeOut(clamp((t - .12) / .28, 0, 1)), out = easeIn(clamp((t - 2.0) / .3, 0, 1));
  // the bands: the Tactician's (blue) above from the left, Rocket's (red) below from the right, each cut on a slant
  const band = (y, dir, k, col, lite, dark) => { const off = Math.round(dir * (-(1 - k) * (W + 40) - out * (W + 40)));
    for (let r = 0; r < bh; r++) { const sl = Math.round((r - bh / 2) * .45) * dir; rect(off + sl - 30, y + r, W + 60, 1, r < 2 ? lite : r > bh - 3 ? dark : (r >> 1) % 6 === 0 ? shade(col, .1) : col); }
    if (!REDUCED) for (let i = 0; i < 9; i++) { const ly = y + 4 + (i * 13) % Math.max(4, bh - 8), len = 20 + (i * 29) % 50, lx = dir > 0 ? W - ((t * (480 + i * 70) + i * 97) % (W + len * 2)) : ((t * (480 + i * 70) + i * 97) % (W + len * 2)) - len; ctx.globalAlpha = .3; rect(Math.round(lx + off), ly, len, 1, '#ffffff'); ctx.globalAlpha = 1; } return off; };
  const offA = band(mid - bh - 3, 1, inA, '#1c3a8a', '#8ab4ff', '#0c1a4a'), offB = band(mid + 3, -1, inB, '#8a1c2a', '#ff9a9a', '#4a0a14');
  // the commanders slide in large, faces toward the middle; their names in the display face
  const red = trainerCanvas('red', false, false), gio = trainerCanvas('giovanni', true, false), sz = 80 * big;
  const rx = Math.round(offA + lerp(-sz, W * .08, easeOut(clamp((t - .12) / .35, 0, 1)))), gx = Math.round(offB + lerp(W, W * .92 - sz, easeOut(clamp((t - .26) / .35, 0, 1))));
  ctx.save(); ctx.beginPath(); ctx.rect(0, mid - bh - 3 - sz, W, bh + sz); ctx.clip(); if (red) { ctx.save(); ctx.translate(rx, mid - 3 - sz + Math.round(sz * .08)); ctx.scale(big, big); ctx.drawImage(red, 0, 0); ctx.restore(); } ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, mid + 3 - sz, W, bh + sz); ctx.clip(); if (gio) { ctx.save(); ctx.translate(gx, mid + 3 + bh - sz + Math.round(sz * .1)); ctx.scale(big, big); ctx.drawImage(gio, 0, 0); ctx.restore(); } ctx.restore();
  const ns = big === 2 && W >= 560 ? 2 : 1, na = clamp((t - .35) / .2, 0, 1), nb = clamp((t - .5) / .2, 0, 1);
  // the names sit beside the commanders when there is room, or across the band's free corner on a narrow screen
  const wa = displayWidth('THE TACTICIAN', ns) + 2 * ns, wb = displayWidth('GIOVANNI', ns) + 2 * ns, side = W * .08 + sz + 10 + wa <= W - 6;
  if (na > 0) { ctx.globalAlpha = na; const x = Math.round(offA + (side ? W * .08 + sz + 10 : W - 6 - wa)); text('YOUR SIDE', x, mid - bh + 10, '#8ab4ff', { shadow: '#000' }); displayText('THE TACTICIAN', x, mid - bh + 22, { scale: ns, style: 'blue', slant: 2 }); ctx.globalAlpha = 1; }
  if (nb > 0) { ctx.globalAlpha = nb; const x = Math.round(offB + (side ? W * .92 - sz - 12 - wb : 6)); textR('TEAM ROCKET', x + wb, mid + bh - 26 - 11 * ns, '#ff9a9a', { shadow: '#000' }); displayText('GIOVANNI', x, mid + bh - 14 - 11 * ns, { scale: ns, style: 'red', slant: 2 }); ctx.globalAlpha = 1; }
  // VS slams down between them with a flash
  const vk = clamp((t - .7) / .22, 0, 1); if (vk > 0 && out < 1) { if (vk >= 1 && D.vsAt == null) { D.vsAt = t; Audio.sfx('hit'); Audio.sfx('stamp'); } const vy = Math.round(mid - 5.5 * (big + 1) - (1 - easeOutBack(vk, 2)) * 60); ctx.globalAlpha = clamp(vk * 3, 0, 1) * (1 - out); displayC('VS', W / 2, vy, { scale: big + 1, style: 'gold', slant: 3 }); ctx.globalAlpha = 1; }
  ctx.restore();
  if (D.vsAt != null && t - D.vsAt < .18) { ctx.globalAlpha = .7 * (1 - (t - D.vsAt) / .18); rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
  if (t > 2.1) { ctx.globalAlpha = clamp((t - 2.1) / .3, 0, 1); rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
}
function introLogo(t) {
  const W = VIEW.w, H = VIEW.h, D = SC.data, L = titleLayout(SC.titleItems.length), glide = easeInOut(clamp((t - 1.75) / .75, 0, 1));
  if (!D.music) { D.music = true; Audio.playMusic('title'); Audio.sfx('boom'); }
  const shk = SC.titleFx.shake > SC.t ? Math.round(Math.sin(SC.t * 90) * 2 * (SC.titleFx.shake - SC.t) / .25) : 0; ctx.save(); ctx.translate(0, shk);
  titleScene(L);
  if (glide > 0) { if (!L.portrait) { for (let x = 0; x < Math.round(W * .5); x += 2) { ctx.globalAlpha = glide * .5 * Math.pow(1 - x / (W * .5), 1.3); rect(x, 0, 2, H, '#07051c'); } } else for (let y = L.menuY - 22; y < H; y += 2) { ctx.globalAlpha = glide * clamp((y - L.menuY + 22) / 30, 0, 1) * .6; rect(0, y, W, 2, '#07051c'); } ctx.globalAlpha = 1; }
  const cy0 = L.portrait ? L.logoY + 24 : Math.max(6, Math.round(H * .42 - L.logoH / 2)); drawLogo(Math.round(lerp(W / 2, L.logoCx, glide)), Math.round(lerp(cy0, L.logoY, glide)), L.cell, t - .2);
  ctx.restore(); drawTitleParticles();
  if (t < .4) { ctx.globalAlpha = 1 - t / .4; rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
}
function drawTitleParticles() { for (const p of SC.titleFx.particles) { const k = 1 - p.age / p.life; if (p.kind === 'dust') { ctx.globalAlpha = k * .8; rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2, '#e8d6c0'); } else if (p.kind === 'star') { ctx.globalAlpha = k; sparkle(p.x, p.y, k > .5 ? 2 : 1, '#fff2a8'); } else { ctx.globalAlpha = k; px(Math.round(p.x), Math.round(p.y), '#ffffff'); } } ctx.globalAlpha = 1; }
