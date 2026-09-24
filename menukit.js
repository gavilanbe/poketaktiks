// ============================================================================
// menukit.js — the look of the screens between the title and a battle. A themed backdrop that moves (a graded sky,
// slanted light, drifting Poké Ball rings and motes, optionally the battlefield itself); a face-off band where the two
// commanders slide in on their colours with a VS on the seam; option tiles (icon, name, value; the focused one grows
// arrows, a changed value slides in with a flash) instead of rule rows; hero cards with painted key art for the modes;
// and a call to action that breathes. Everything is drawn at the game's pixel size and calms down under reduced motion.
// ============================================================================
'use strict';
Object.assign(ICONS, {
  coin: ['..OOOOO..', '.OYYYYYO.', 'OYYWYYYYO', 'OYWYYYYYO', 'OYYYYYYYO', 'OYYYYYYYO', 'OYYYYYYYO', '.OYYYYYO.', '..OOOOO..'],
  sun: ['....Y....', '.Y.....Y.', '...OOO...', '..OYYYO..', 'YYOYYYOYY', '..OYYYO..', '...OOO...', '.Y.....Y.', '....Y....'],
  up: ['....O....', '...OWO...', '..OWWWO..', '.OWWWWWO.', 'OOOWWWOOO', '..OWWWO..', '..OWWWO..', '..OWWWO..', '..OOOOO..'],
  hill: ['....O....', '...OWO...', '..OWLWO..', '..OLLLO..', '.OLLLLLO.', '.OGLLLGO.', 'OGGGGGGGO', 'OGGGGGGGO', 'OOOOOOOOO'],
  eye: ['.........', '..OOOOO..', '.OWWWWWO.', 'OWWOOOWWO', 'OWOOWOOWO', 'OWWOOOWWO', '.OWWWWWO.', '..OOOOO..', '.........'],
  chip: ['.O.O.O.O.', 'OOOOOOOOO', '.OLLLLLO.', 'OOLOOOLOO', '.OLOWOLO.', 'OOLOOOLOO', '.OLLLLLO.', 'OOOOOOOOO', '.O.O.O.O.'],
  clock: ['..OOOOO..', '.OWWWWWO.', 'OWWWOWWWO', 'OWWWOWWWO', 'OWWWOOOWO', 'OWWWWWWWO', 'OWWWWWWWO', '.OWWWWWO.', '..OOOOO..'],
  star: ['....O....', '...OYO...', '...OYO...', 'OOOOYOOOO', '.OYYYYYO.', '..OYYYO..', '..OYOYO..', '.OYO.OYO.', '.OO...OO.'],
  info: ['..OOOOO..', '.OWWOWWO.', 'OWWWWWWWO', 'OWWOOWWWO', 'OWWWOWWWO', 'OWWWOWWWO', 'OWWOOOWWO', '.OWWWWWO.', '..OOOOO..'],
});

// ---------------------------------------------------------------- themes and the moving backdrop
// a / b: the sky from top to bottom; band: the theme's own colour (card frames, the CTA glow); glow: its light.
const MK_THEME = {
  quick: { a: '#27307a', b: '#0b0a1e', band: '#ffd049', glow: '#fff2b0' },
  skirmish: { a: '#1f5a3e', b: '#0a1612', band: '#3fbf6a', glow: '#b8f5c8' },
  conquest: { a: '#1f4486', b: '#0a1230', band: '#4a90e8', glow: '#bfe2ff' },
  tower: { a: '#43308a', b: '#0f0b24', band: '#9a7aee', glow: '#e2d4ff' },
  safari: { a: '#56721e', b: '#0e1808', band: '#a6d048', glow: '#efffb0' },
  versus: { a: '#5c2044', b: '#12091c', band: '#ee5a6a', glow: '#ffc4ca' },
  campaign: { a: '#2c2672', b: '#0c0a1d', band: '#ffd049', glow: '#fff2b0' },
  lab: { a: '#3c3470', b: '#120f2a', band: '#ffd049', glow: '#fff2b0' },
  cos: { a: '#3b2b72', b: '#0d0b22', band: '#ffd049', glow: '#fff2b0' },
};
const MK_GRAD = { key: '', c: null };
function mkGradient(top, bot, W, H) {
  const key = top + bot + W + 'x' + H; if (MK_GRAD.key === key && MK_GRAD.c) return MK_GRAD.c;
  const c = MK_GRAD.c || document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), n = 14;
  for (let i = 0; i < n; i++) { const y0 = Math.round(H * i / n), y1 = Math.round(H * (i + 1) / n); g.fillStyle = mix(top, bot, i / (n - 1)); g.fillRect(0, y0, W, y1 - y0 + 1); g.fillStyle = mix(top, bot, Math.min(1, (i + 1) / (n - 1))); for (let x = i & 1; x < W; x += 2) g.fillRect(x, y1 - 1, 1, 1); }
  MK_GRAD.key = key; MK_GRAD.c = c; return c;
}
// A Poké Ball emblem (ring, band, button) painted once, pixel by pixel, for the drifting rings behind the menus.
const MK_EMBLEM = {};
function mkEmblem(r) {
  if (MK_EMBLEM[r]) return MK_EMBLEM[r]; const c = document.createElement('canvas'), d = r * 2 + 2; c.width = d; c.height = d; const g = c.getContext('2d'); g.fillStyle = '#ffffff';
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const q = Math.sqrt(x * x + y * y); const ring = q <= r && q > r - 2.2, band = Math.abs(y) <= 1 && q <= r, btn = q <= r * .32 && q > r * .32 - 2.2; if ((ring || band || btn) && !(band && q <= r * .32)) g.fillRect(x + r + 1, y + r + 1, 1, 1); }
  MK_EMBLEM[r] = c; return c;
}
// The backdrop: the theme's sky, then (opt.map) the battlefield drifting under a veil, (opt.scene) a painted landscape
// along the bottom, slanted light moving across, three Poké Ball rings drifting up, motes, and a darker vignette.
function mkBackdrop(theme, opt = {}) {
  const W = VIEW.w, H = VIEW.h, T = MK_THEME[theme] || MK_THEME.quick, t = REDUCED ? 0 : SC.t;
  ctx.drawImage(mkGradient(T.a, T.b, W, H), 0, 0);
  if (opt.map) { const bd = opt.map; ctx.globalAlpha = opt.mapAlpha || .32; drawBackdrop(bd, (W - bd.canvas.width) / 2 - t * 3, (H - bd.canvas.height) / 2, 0); ctx.globalAlpha = 1; }
  if (opt.scene) { const sh = Math.round(H * .42), hz = Math.round(sh * .45), gy = Math.round(sh * .82), S = sceneFor(opt.scene, W, sh, hz, gy, 3, opt.tile || 'plain'), y0 = H - sh, drift = Math.round((t * 4) % (SCENE_PAD * 2)) - SCENE_PAD;
    ctx.globalAlpha = .55; for (const [l, k] of [[S.far, .3], [S.mid, .6], [S.ground, 1]]) ctx.drawImage(l, -SCENE_PAD + Math.round(drift * k), y0); ctx.globalAlpha = 1;
    for (let y = 0; y < 24; y++) { ctx.globalAlpha = 1 - y / 24; hline(0, y0 + y, W, T.b); } ctx.globalAlpha = 1; }
  // slanted light
  ctx.globalAlpha = .045; ctx.fillStyle = '#ffffff'; const step = 34, sd = (t * 7) % step;
  for (let x0 = -H - step + sd; x0 < W; x0 += step) { ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x0 + H, 0); ctx.lineTo(x0 + H + 12, 0); ctx.lineTo(x0 + 12, H); ctx.fill(); }
  ctx.globalAlpha = 1;
  // Poké Ball rings rising slowly, and motes
  const rings = [[.16, .7, 38, 0], [.82, .3, 52, 1.7], [.55, .95, 30, 3.1]];
  for (const [fx, fy, r, ph] of rings) { const e = mkEmblem(r), y = ((fy * (H + 2 * r) - t * 5 + ph * 40) % (H + 2 * r) + H + 2 * r) % (H + 2 * r) - r; ctx.globalAlpha = .05; ctx.drawImage(e, Math.round(fx * W - r - 1 + Math.sin(t * .4 + ph) * 6), Math.round(y - r - 1)); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 26; i++) { const sp = 6 + (i % 5) * 3, x = Math.round((i * 73.3 + Math.sin(t * .7 + i) * 4) % W), y = Math.round(((i * 41.7 - t * sp) % H + H) % H), tw = Math.sin(t * 3 + i * 1.7); if (tw < -.4) continue; px(x, y, tw > .7 ? T.glow : shade(T.glow, -.45)); }
  // vignette: the top and bottom sink into the dark
  for (let y = 0; y < 18; y++) { ctx.globalAlpha = .45 * (1 - y / 18); hline(0, y, W, '#05040f'); hline(0, H - 1 - y, W, '#05040f'); } ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the call to action
// The way forward: a raised key in its variant that breathes a glow in the theme's colour and catches a shine now
// and then. Hit label = its label, like bigButton.
function mkCTA(x, y, w, h, label, run, opt = {}) {
  const t = SC.t, dis = !!opt.disabled, over = INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h, hot = (over && !VIEW.touch) || opt.hot;
  if (!dis && !REDUCED && CLOCK.frame) { const p = .5 + .5 * Math.sin(t * 4.2), col = opt.glow || '#8ae89a'; ctx.globalAlpha = .18 + .22 * p; rrect(x - 2, y - 2, w + 4, h + 4, col, 3); ctx.globalAlpha = .1 + .12 * p; rrect(x - 4, y - 3, w + 8, h + 6, col, 4); ctx.globalAlpha = 1; }
  uiButton(x, y, w, h, label, { hot, pressed: over && INPUT.down, variant: dis ? 'neutral' : opt.variant || 'primary', big: !opt.small, disabled: dis, icon: opt.icon });
  if (!dis && !REDUCED && CLOCK.frame) { const k = (t % 2.6) / .55; if (k < 1) { const sx = Math.round(x - 8 + (w + 16) * k); ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 1, w - 4, h - 3); ctx.clip(); ctx.globalAlpha = .35; for (let i = 0; i < 4; i++) vline(sx + i - Math.round(i / 2), y + 1, h - 3, '#ffffff'); ctx.restore(); ctx.globalAlpha = 1; } }
  hit(x, y, w, h, run, label);
}

// ---------------------------------------------------------------- option tiles
// Each rule as a small card: icon, the rule's name above its value; the focused one wears gold and grows ◂ ▸ at its
// right edge; a changed value slides in with a flash. rules: [{ k, label, icon, vals, show }] (SK_RULES, VS_RULES).
// Hits: LABEL- / LABEL+ on the focused tile's arrows (wide screens), LABEL on each body (it cycles forward; on phones
// the body is LABEL+). opt: cols, th (tile height), gap, focus (index), onFocus(i). Returns the height used.
function mkTiles(S, rules, x, y, w, opt = {}) {
  const narrow = narrowView() || VIEW.touch, cols = opt.cols || 2, gap = opt.gap == null ? 3 : opt.gap, th = opt.th || (narrow ? 24 : 22), tw = Math.floor((w - gap * (cols - 1)) / cols), t = SC.t, M = S._mk || (S._mk = {});
  rules.forEach((rule, i) => {
    const cx = x + (i % cols) * (tw + gap), cy = y + Math.floor(i / cols) * (th + gap), focus = opt.focus === i, arrows = focus && !narrow, val = String(TRX((narrow && rule.short || rule.show)(S[rule.k], S)));
    let m = M[rule.k]; if (!m) m = M[rule.k] = { v: val, at: -9, dir: 1 }; if (m.v !== val) { m.at = t; m.v = val; }
    const ch = REDUCED ? 1 : clamp((t - m.at) / .28, 0, 1), face = focus ? '#2e3486' : '#181b44';
    rrect(cx + 1, cy + 2, tw, th, UI.shadow, 2); rrect(cx, cy, tw, th, focus ? UI.gold : UI.inset, 2); rect(cx + 1, cy + 1, tw - 2, th - 2, face); hline(cx + 2, cy + 1, tw - 4, shade(face, .3)); hline(cx + 2, cy + th - 2, tw - 4, shade(face, -.35));
    rect(cx + 1, cy + 2, 2, th - 4, rule.col || (focus ? UI.gold : '#3a4290'));
    if (ch < 1) { ctx.globalAlpha = (1 - ch) * .55; rect(cx + 1, cy + 1, tw - 2, th - 2, '#ffffff'); ctx.globalAlpha = 1; }
    const ic = rule.icon, lx = cx + (ic ? 17 : 7), aw = arrows ? 30 : 0, room = cx + tw - 4 - aw - lx;
    if (ic) iconAt(ic, cx + 5, cy + Math.round((th - 9) / 2), focus ? UI.gold : '#c8d0ff');
    text(fitLabel(rule.label, room), lx, cy + 3, focus ? UI.gold : UI.muted, { raw: true });
    ctx.save(); ctx.beginPath(); ctx.rect(lx - 1, cy + th - 12, room + 2, 10); ctx.clip(); const off = Math.round((1 - easeOut(ch)) * 8);
    text(fitLabel(val, room), lx + off, cy + th - 11, ch < 1 ? '#ffffff' : UI.ink, { raw: true }); ctx.restore();
    if (arrows) { const bounce = REDUCED ? 0 : Math.round(Math.sin(t * 6) * .6 + .4); for (const [d, gx] of [[-1, cx + tw - 30], [1, cx + tw - 15]]) { rrect(gx, cy + 3, 14, th - 6, '#101340', 1); textC(d < 0 ? '◂' : '▸', gx + 7 + d * bounce, cy + Math.round((th - 7) / 2), UI.gold, { raw: true }); hit(gx, cy + 3, 14, th - 6, () => { opt.onFocus && opt.onFocus(i); vsCycle(S, rule, d); M[rule.k].dir = d; }, rule.label + (d < 0 ? '-' : '+')); } }
    hit(cx, cy, tw - aw, th, () => { opt.onFocus && opt.onFocus(i); vsCycle(S, rule, 1); M[rule.k].dir = 1; }, narrow ? rule.label + '+' : rule.label);
  });
  return Math.ceil(rules.length / cols) * (th + gap) - gap;
}

// ---------------------------------------------------------------- the face-off band
// Two slanted halves in each side's colour meeting at a white seam, each carrying its trainer (sliding in from its own
// edge, the Ace bobbing beside), a name plate and a subtitle, and a VS that throbs on the seam. L / R: { tr, col, name,
// sub, mon, tag, run, label }; `tr` may be null (a Pokémon alone). Returns { x, y, w, h }.
function mkFaceOff(x, y, w, h, L, R, opt = {}) {
  const t = SC.t, id = opt.id || 'faceoff', a = appear(id), sl = Math.round(h * .32), mid = x + Math.round(w / 2), big = h >= 96 ? 2 : 1;
  // each side slides in on its own clock, so changing one commander re-enters only that side
  const inK = side => { const S = side ? R : L, a2 = appear(id + ':' + side + ':' + S.tr + ':' + S.mon); return REDUCED ? 1 : easeOutBack(clamp((a2 - side * .08) / .38, 0, 1), 1.3); };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (const [side, S] of [[0, L], [1, R]]) {
    const col = mix(side ? '#d8323e' : '#2a5ae0', S.col || (side ? UI.red : UI.blue), .3), dark = shade(col, -.62), mid2 = shade(col, -.3); // blue against red, tinted by each commander
    for (let j = 0; j < h; j++) { const edge = mid + Math.round(sl / 2 - j * sl / h), x0 = side ? edge : x, x1 = side ? x + w : edge, v = j / h; rect(x0, y + j, x1 - x0, 1, v < .12 ? shade(mid2, .25) : v > .88 ? dark : mix(mid2, dark, v)); }
    // speed streaks running outward
    if (!REDUCED) { ctx.globalAlpha = .16; for (let k = 0; k < 7; k++) { const ly = y + 4 + ((k * 13 + (side ? 5 : 0)) % Math.max(4, h - 8)), len = 16 + (k * 19) % 36, run = (t * (90 + k * 20) + k * 53) % (w / 2 + len), lx = side ? x + w - run : x + run - len; rect(Math.round(lx), ly, len, 1, '#ffffff'); } ctx.globalAlpha = 1; }
  }
  // the seam
  for (let j = 0; j < h; j++) { const edge = mid + Math.round(sl / 2 - j * sl / h); rect(edge - 1, y + j, 2, 1, '#ffffff'); px(edge + 1, y + j, UI.inset); }
  // trainers slide in from their edges, the Ace beside each; plates at the foot
  for (const [side, S] of [[0, L], [1, R]]) {
    const k = inK(side), slide = Math.round((1 - clamp(k, 0, 1.2)) * (side ? 1 : -1) * w * .45), col = S.col || (side ? UI.red : UI.blue), bob = REDUCED ? 0 : Math.round(Math.sin(t * 2.2 + side * 1.4));
    const tx = side ? x + w - Math.round(w * .2) : x + Math.round(w * .2), size = 80 * big, tc = S.tr ? trainerCanvas(S.tr, side === 1, false) : null, head = (TRAINER_HEADS[S.tr] || [40, 6])[1] * big;
    const ty0 = h >= size * .9 ? y + h - size + Math.round(size * .12) : y + 4 - head;
    if (S.mon && w >= 230) { requestAnim(S.mon); const mh = typeof ANIM_META !== 'undefined' && ANIM_META[S.mon] ? ANIM_META[S.mon].h : 40, mx = tx + (side ? -1 : 1) * Math.round(w * .13) + slide, my = y + h - 12 + bob, sc = mh * big > h + 6 ? 1 : big; ctx.globalAlpha = .45; ellipse(mx, y + h - 11, 12 * sc, 2, '#000'); ctx.globalAlpha = 1; if (animReady(S.mon)) drawAnim(S.mon, mx, my, t + side, { flip: side === 0 ? false : true, sx: sc, sy: sc }); else drawMon(S.mon, mx, my, { flip: side === 1, sx: sc, sy: sc }); }
    if (tc) ctx.drawImage(tc, Math.round(tx - size / 2) + slide, ty0 + bob, size, size);
    if (S.tag) { const tw2 = textWidth(S.tag) + 8, tgx = side ? x + w - tw2 - 3 : x + 3; rrect(tgx, y + 3, tw2, 10, side ? teamColorD(1) : teamColorD(0), 1); outline(tgx, y + 3, tw2, 10, shade(col, .3)); text(S.tag, tgx + 4, y + 5, '#ffffff'); }
  }
  ctx.restore();
  // name plates under the band (outside the clip, so they never get cut by the slant)
  const pw = Math.floor(w / 2) - 3;
  for (const [side, S] of [[0, L], [1, R]]) {
    const col = S.col || (side ? UI.red : UI.blue), px0 = side ? x + w - pw : x, py0 = y + h - 1, nm = String(TRX(S.name || '')).toUpperCase();
    const foc = opt.focus === side; rect(px0, py0, pw, 12, foc ? '#2e3486' : '#07061a'); hline(px0, py0, pw, foc ? UI.gold : col); if (foc) outline(px0, py0, pw, 12, UI.gold); const nb = textWidth(nm, BIG) <= pw - 8;
    if (nb) (side ? (s, xx) => textR(s, xx, py0 + 2, UI.ink, { font: BIG, raw: true }) : (s, xx) => text(s, xx, py0 + 2, UI.ink, { font: BIG, raw: true }))(nm, side ? px0 + pw - 4 : px0 + 4);
    else (side ? textR : text)(fitLabel(nm, pw - 8), side ? px0 + pw - 4 : px0 + 4, py0 + 3, UI.ink, { raw: true });
    if (S.sub) (side ? textR : text)(fitLabel(S.sub, pw - 6), side ? px0 + pw - 3 : px0 + 3, py0 + 14, shade(col, .45), { outline: UI.inset, raw: true });
    if (S.run) hit(side ? x + Math.ceil(w / 2) : x, y, Math.floor(w / 2), h + 11, S.run, S.label || (side ? 'FOE CO' : 'YOUR CO'));
  }
  // VS on the seam
  const vk = REDUCED ? 1 : clamp((a - .3) / .15, 0, 1); if (vk > 0) { const cy = y + Math.round(h / 2), pulse = REDUCED ? 0 : Math.max(0, Math.sin(t * 5)); ctx.globalAlpha = .35 * pulse + .2; circle(mid, cy, 10 + big * 4 + Math.round(pulse * 2), '#ffffff'); ctx.globalAlpha = 1; displayC('VS', mid, cy - Math.round(5.5 * big) - 1, { style: 'red', scale: big, slant: 1, shine: true, phase: 1.1 }); }
  return { x, y, w, h: h + 11 + (L.sub || R.sub ? 10 : 0) };
}

// ---------------------------------------------------------------- hero cards for the modes
// Key art for each mode, painted into a clip: the battlefield where two Pokémon square up (Skirmish), the three bridges
// under flags (Conquest), the tower against a dusk sky with lit windows (Battle Tower), tall grass where rare Pokémon
// peek out (Safari Zone). `live` animates it; a resting card holds still.
const MK_ART = {
  skirmish: { scene: 'field', tile: 'plain', mons: [[6, .3, 0], [9, .72, 1]] },
  conquest: { scene: 'bridge', tile: 'bridge', mons: [[18, .5, 0, 'fly']] },
  safari: { scene: 'tall', tile: 'tall', mons: [[115, .2, 1], [123, .82, 1], [128, .5, 1, 'peek']] },
  tower: { mons: [] },
};
function mkArt(id, x, y, w, h, live, seed = 0) {
  const A = MK_ART[id] || MK_ART.skirmish, t = live && !REDUCED ? SC.t : seed * 1.3 + 2, hz = Math.round(h * .5), gy = Math.round(h * .82);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (id === 'tower') mkTowerArt(x, y, w, h, t, live);
  else { const S = sceneFor(A.scene, w, h, hz, gy, 1, A.tile), drift = live && !REDUCED ? Math.round(Math.sin(t * .35) * SCENE_PAD * .8) : 0;
    ctx.drawImage(S.sky, x - SCENE_PAD + Math.round(drift * .15), y); ctx.drawImage(S.far, x - SCENE_PAD + Math.round(drift * .35), y); ctx.drawImage(S.mid, x - SCENE_PAD + Math.round(drift * .65), y); ctx.drawImage(S.ground, x - SCENE_PAD + drift, y);
    const sc = h >= 110 ? 1 : h >= 70 ? .75 : .55;
    for (const [num, fx, side, kind] of A.mons) { requestAnim(num); const cx = x + Math.round(w * fx) + drift, by = y + (kind === 'fly' ? Math.round(h * .66 + Math.sin(t * 2.4) * 3) : kind === 'peek' ? gy + 6 - Math.round(Math.max(0, Math.sin(t * 1.3)) * 8) : gy + 2), flip = side === 1;
      if (kind !== 'fly') { ctx.globalAlpha = .35; ellipse(cx, gy + 2, Math.round(16 * sc), 2, '#000'); ctx.globalAlpha = 1; }
      if (animReady(num)) drawAnim(num, cx, by, live ? t : 0, { flip, sx: sc, sy: sc }); else drawMon(num, cx, by, { flip, sx: sc * 1.6, sy: sc * 1.6 }); }
    if (S.front) ctx.drawImage(S.front, x - SCENE_PAD + drift, y);
    if (id === 'skirmish') { drawFlag(x + 8, gy - 12, 0, live ? Math.floor(t * 6) % 2 : 0); drawFlag(x + w - 16, gy - 12, 1, live ? Math.floor(t * 6 + 1) % 2 : 0); if (live && !REDUCED) { const k = (t * 1.6) % 1; sparkle(x + Math.round(w * .51), y + Math.round(h * .5), Math.round(1 + Math.sin(k * Math.PI) * 3), '#fff6c0'); } }
    if (id === 'conquest') [.22, .5, .78].forEach((fx, i) => drawFlag(x + Math.round(w * fx), gy - 16, i === 1 ? 2 : i, live ? Math.floor(t * 5 + i) % 2 : 0));
    if (id === 'safari' && live && !REDUCED) { const k = (t * .7) % 1.6; if (k < 1) { const bx = x + Math.round(w * (.1 + .6 * k)), byy = y + Math.round(h * .7 - Math.sin(k * Math.PI) * h * .45); drawBall(bx, byy, '#6aa04a', 3); } }
  }
  ctx.restore();
}
// The Battle Tower as key art: a dusk sky with stars, the tower in brick with ten lit (or dark) floors and a spire
// flying Rocket's flag, a glow at the top where the strongest commander waits.
function mkTowerArt(x, y, w, h, t, live) {
  for (let j = 0; j < h; j++) hline(x, y + j, w, mix('#2a1c5a', '#e0786a', Math.pow(j / h, 2.2)));
  for (let k = 0; k < 22; k++) { const sx = x + (k * 37) % w, sy = y + (k * 23) % Math.round(h * .6), on = !live || Math.sin(t * 2 + k) > -.3; if (on) px(sx, sy, k % 3 ? '#b8b0e8' : '#ffffff'); }
  const R0 = loadRecords(), done = R0.tower ? Object.keys(R0.tower).length : 0, tw = Math.max(18, Math.round(w * .3)), cx = x + Math.round(w / 2), top = y + Math.round(h * .16), base = y + h;
  ctx.globalAlpha = .25; circle(cx, top + 6, Math.round(tw * .9), '#ffd8a0'); ctx.globalAlpha = 1;
  const fh = (base - top - 10) / 10;
  for (let f = 0; f < 10; f++) { const fy = Math.round(base - (f + 1) * fh), hh = Math.round(fh), lit = f < done + 1, inset = Math.round((f / 10) * tw * .18), fx = cx - Math.round(tw / 2) + inset, fw = tw - inset * 2;
    rect(fx, fy, fw, hh, f % 2 ? '#2e2462' : '#342a6e'); hline(fx, fy, fw, '#4a3e8e'); vline(fx, fy, hh, '#221a4a'); vline(fx + fw - 1, fy, hh, '#1a1438');
    for (let wx = fx + 3; wx + 2 < fx + fw - 2; wx += 5) { const on = lit && (!live || Math.sin(t * 1.5 + wx + f * 3) > -.6); rect(wx, fy + Math.max(1, Math.round(hh * .3)), 2, Math.max(1, Math.round(hh * .4)), on ? (f === done ? UI.gold : '#ffe39a') : '#15102e'); } }
  const sy = Math.round(base - 10 * fh); for (let k = 0; k < 10; k++) { const half = Math.round((tw * .32) * (1 - k / 10)); hline(cx - half, sy - 1 - k, half * 2, k % 3 ? '#46387e' : '#5a4a9a'); }
  vline(cx, sy - 18, 8, '#e8e0f8'); rect(cx + 1, sy - 18, 5, 3, live ? (Math.floor(t * 4) % 2 ? UI.red : '#c23040') : UI.red);
  const tr = trainerCanvas('red', false, false); if (tr && h >= 60) ctx.drawImage(tr, cx + Math.round(tw / 2) + 2, base - 40, 40, 40);
}

// A mode's hero card. Tall cards (four in a row) put the art on top; wide rows (phones, short screens) put it on the
// left. The chosen card rises, wears its theme's colour and a glow, and its art comes alive; the others rest, dimmed.
// m: { id, label, tag, bullets: [[icon, text]], record() }. Returns nothing; the caller registers the hit.
function mkModeCard(x, y, w, h, m, sel, i) {
  const T = MK_THEME[m.id] || MK_THEME.quick, t = SC.t, tall = h > w * 1.15, a = appear('mkcard' + i), k = REDUCED ? 1 : easeOutBack(clamp((a - i * .07) / .32, 0, 1), 1.5);
  const S = SC.data || (SC.data = {}), L = S.lift || (S.lift = []); L[i] = L[i] == null ? 0 : L[i] + ((sel ? 1 : 0) - L[i]) * Math.min(1, (CLOCK.dt || .016) * 12);
  const lift = REDUCED ? (sel ? 3 : 0) : Math.round(L[i] * 5), yy = y - lift + Math.round((1 - clamp(k, 0, 1.1)) * 24), frame = sel ? T.band : '#3a4290';
  if (k <= 0) return; ctx.globalAlpha = clamp(k * 2, 0, 1);
  if (sel && !REDUCED) { const p = .5 + .5 * Math.sin(t * 3.4); ctx.globalAlpha = .22 + .2 * p; rrect(x - 3, yy - 3, w + 6, h + 6, T.band, 4); ctx.globalAlpha = 1; }
  rrect(x + 2, yy + 4, w, h, UI.shadow, 3); rrect(x, yy, w, h, UI.inset, 3); rrect(x + 1, yy + 1, w - 2, h - 2, frame, 2); hline(x + 3, yy + 1, w - 6, shade(frame, .45)); rect(x + 3, yy + 3, w - 6, h - 6, UI.inset);
  const face = sel ? shade(T.a, -.15) : '#141736'; rect(x + 4, yy + 4, w - 8, h - 8, face);
  // the art
  const ax = x + 4, ay = yy + 4, aw = tall ? w - 8 : clamp(Math.round(w * .36), 56, Math.round((h - 8) * 1.5)), ah = tall ? Math.round(h * .47) : h - 8;
  mkArt(m.id, ax, ay, aw, ah, sel, i); if (!sel) { ctx.globalAlpha = .42; rect(ax, ay, aw, ah, '#07061a'); ctx.globalAlpha = 1; }
  if (tall) hline(ax, ay + ah, aw, frame); else vline(ax + aw, ay, ah, frame);
  // the words
  const tx = tall ? x + 9 : ax + aw + 7, tw = tall ? w - 18 : x + w - 8 - tx; let ty = tall ? ay + ah + 7 : ay + 4;
  const title = String(TRX(m.label)).toUpperCase(), dw = displayWidth(title);
  if (dw <= tw && (tall || h >= 44)) { (tall ? displayC : displayText)(title, tall ? x + w / 2 : tx, ty, { style: sel ? 'gold' : 'silver', slant: 1, shine: sel, phase: i * .7 }); ty += 16; }
  else if (rawTextWidth(title, BIG) <= tw) { bigText(title, tx, ty, sel ? UI.gold : '#d8dcf0', { shadow: UI.inset }); ty += 12; }
  else { text(fitLabel(title, tw), tx, ty + 1, sel ? UI.gold : '#d8dcf0', { shadow: UI.inset, raw: true }); ty += 11; }
  const tag = String(TRX(m.tag)).toUpperCase(), tgw = Math.min(tw, textWidth(tag, FONT) + 8), tgx = tall ? Math.round(x + w / 2 - tgw / 2) : tx;
  if (ty + 10 <= yy + h - 6) { rrect(tgx, ty, tgw, 10, sel ? T.band : '#2a2f66', 2); text(fitLabel(tag, tgw - 6), tgx + 4, ty + 2, sel ? shade(T.band, -.8) : UI.muted, { raw: true }); ty += 14; }
  const rec = m.record ? m.record() : null, recH = rec ? 12 : 0, room = yy + h - 6 - recH;
  // each line wraps once when there is room for it, else it is cut
  for (const [ic, s] of m.bullets) { if (ty + 9 > room) break; const ls = wrap(s, tw - 12), two = ls.length === 2 && ty + 19 <= room; iconAt(ic, tx, ty - 1, sel ? T.glow : UI.dim);
    if (two || ls.length === 1) { ls.slice(0, 2).forEach((l, k) => text(l, tx + 12, ty + k * 9, sel ? UI.ink : UI.muted, { raw: true })); ty += ls.length * 9 + 3; } else { text(fitLabel(s, tw - 12), tx + 12, ty, sel ? UI.ink : UI.muted); ty += 11; } }
  if (rec && yy + h - 16 > ty - 4) { const ry = yy + h - 16; hline(tx, ry - 3, tw, sel ? shade(T.band, -.3) : '#262a5a'); iconAt(rec[0], tx, ry - 1, sel ? UI.gold : UI.dim); text(fitLabel(rec[1], tw - 12), tx + 12, ry, sel ? UI.gold : UI.dim); }
  if (sel && !REDUCED) { const s2 = t * 2.2; sparkle(x + w - 8, yy + 7 + Math.round(Math.sin(s2)), Math.round(1 + (Math.sin(s2 * 1.7) + 1)), T.glow); }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the battlefield, framed
// The map on the table: an ink frame with a lit rim, the map scaled to fit, the war furniture over it (deploy tiles,
// properties under their owners' colours, every Pokémon; opt.war false leaves it bare), the weather (opt.weather),
// and a caption strip (opt.caption: [left, right]). opt.shake nudges it (a reroll). Returns the map's rect.
function mkMapFrame(bd, map, x, y, w, h, opt = {}) {
  const capH = opt.caption ? 12 : 0, sc = Math.min((w - 10) / bd.canvas.width, (h - 10 - capH) / bd.canvas.height), pw = Math.floor(bd.canvas.width * sc), ph = Math.floor(bd.canvas.height * sc);
  const px0 = x + Math.floor((w - pw) / 2), py0 = y + 5 + Math.floor((h - 10 - capH - ph) / 2) + (opt.shake || 0);
  rrect(px0 - 5, py0 - 5, pw + 10, ph + 10 + capH, UI.inset, 3); rect(px0 - 4, py0 - 4, pw + 8, ph + 8 + capH, '#262c6a'); hline(px0 - 4, py0 - 4, pw + 8, '#4a52a8'); hline(px0 - 4, py0 + ph + 3 + capH, pw + 8, '#161a44');
  ctx.drawImage(bd.canvas, px0, py0, pw, ph);
  if (opt.weather && opt.weather !== 'none' && opt.weather !== 'random' && !REDUCED) { ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip(); ctx.translate(px0, py0); drawWeather(opt.weather, pw, ph, SC.t); ctx.restore(); }
  if (opt.war !== false) drawWarPreview(map, bd, px0, py0, pw, ph, opt.centers == null ? -1 : opt.centers);
  if (opt.dim) { ctx.globalAlpha = opt.dim; rect(px0, py0, pw, ph, '#060a16'); ctx.globalAlpha = 1; }
  outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.inset); outline(px0 - 2, py0 - 2, pw + 4, ph + 4, '#6a72c0');
  if (capH) { const [l, r] = opt.caption, cy = py0 + ph + 3, rw = r ? textWidth(r) : 0; if (l) text(fitLabel(l, pw - rw - 10), px0 + 1, cy, UI.ink); if (r) textR(r, px0 + pw - 1, cy, UI.muted); }
  return { x: px0, y: py0, w: pw, h: ph };
}
// A side of the face-off from a commander id; the Tactician wears the partner's colour and shows its line.
function mkCoSide(id, root, extra = {}) {
  const co = COS[id] || COS.you, c = coOf({ co: id, root }), you = id === 'you';
  return Object.assign({ tr: co.tr, col: you ? (CAPTAINS[root] || CAPTAINS[7]).col : co.col, name: you ? 'TACTICIAN' : co.name, sub: c.power.name, mon: you ? root : co.ace }, extra);
}
// The line under a setup's tiles: what the focused rule means, in the theme's light.
function mkTip(s, x, y, w, col = UI.info) { if (!s) return 0; const ls = wrap(s, w - 14).slice(0, 2); iconAt('info', x, y - 1, col); ls.forEach((l, i) => text(l, x + 13, y + i * 9, UI.muted)); return ls.length * 9; }
// Read-only tiles for facts (a floor's level, par, weather, funds): the same card as an option tile, without arrows.
// items: [[icon, label, value, col?]]. Returns the height used.
function mkChips(items, x, y, w, opt = {}) {
  const cols = opt.cols || 2, gap = opt.gap == null ? 3 : opt.gap, th = opt.th || 20, tw = Math.floor((w - gap * (cols - 1)) / cols);
  items.forEach(([ic, label, val, col], i) => { const cx = x + (i % cols) * (tw + gap), cy = y + Math.floor(i / cols) * (th + gap), lx = cx + (ic ? 16 : 6), room = cx + tw - 4 - lx;
    rrect(cx, cy, tw, th, UI.inset, 2); rect(cx + 1, cy + 1, tw - 2, th - 2, '#13163a'); hline(cx + 2, cy + 1, tw - 4, '#1f2352'); if (ic) iconAt(ic, cx + 4, cy + Math.round((th - 9) / 2), col || '#c8d0ff');
    if (th >= 19) { text(fitLabel(label, room), lx, cy + 2, UI.dim); text(fitLabel(val, room), lx, cy + th - 10, col || UI.ink); } else { text(fitLabel(label, Math.round(room * .45)), lx, cy + Math.round((th - 7) / 2), UI.dim); textR(fitLabel(val, Math.round(room * .55)), cx + tw - 4, cy + Math.round((th - 7) / 2), col || UI.ink); } });
  return Math.ceil(items.length / cols) * (th + gap) - gap;
}
// A speech bubble (cream, ink border, a tail toward `tail`: 'left' | 'up'), its lines typed out after `delay`.
function mkBubble(s, x, y, w, maxLines, delay = .25, tail = 'left') {
  const ls = wrap(TR('"{0}"', TRX(s)), w - 10).slice(0, maxLines), h = ls.length * 9 + 8, t = SC.t;
  rrect(x, y, w, h, '#fff6d8', 2); outline(x, y, w, h, UI.inset); hline(x + 2, y + h - 2, w - 4, '#e8d8b0');
  if (tail === 'left') for (let k = 0; k < 3; k++) { px(x - 1 - k, y + 7 + k, '#fff6d8'); px(x - 1 - k, y + 6 + k, UI.inset); } else for (let k = 0; k < 3; k++) { hline(x + 10 - k, y - 1 - k, 1 + k * 2, '#fff6d8'); }
  let chars = REDUCED ? 1e9 : Math.floor((t - delay) * 60); ls.forEach((l, k) => { if (chars <= 0) return; const shown = l.slice(0, chars); chars -= l.length; text(shown, x + 5, y + 5 + k * 9, '#3a2a18', { raw: true }); });
  return h;
}
// One commander on a band of their colour: the trainer slides in from the right, the Ace bobs on the left, the name in
// the display face at the foot with a subtitle; `dim` shows a silhouette (locked). S: { tr, col, name, sub, mon, dim }.
function mkHero(x, y, w, h, S, opt = {}) {
  const t = SC.t, a = appear(opt.id || 'hero'), k = REDUCED ? 1 : easeOutBack(clamp(a / .35, 0, 1), 1.3), col = S.dim ? '#3a3a5a' : S.col, big = h >= 100 ? 2 : 1;
  rrect(x + 1, y + 2, w, h, UI.shadow, 3); rrect(x, y, w, h, S.dim ? UI.inset : shade(col, .2), 3); ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  for (let j = 0; j < h; j++) rect(x, y + j, w, 1, mix(shade(col, -.3), shade(col, -.8), j / h));
  if (!REDUCED) { ctx.globalAlpha = .12; for (let q = 0; q < 8; q++) { const ly = y + 3 + (q * 11) % Math.max(4, h - 6), len = 20 + (q * 17) % 40, lx = x + w - ((t * (70 + q * 15) + q * 41) % (w + len)); rect(Math.round(lx), ly, len, 1, '#ffffff'); } ctx.globalAlpha = 1; }
  const size = 80 * big, tc = S.tr ? trainerCanvas(S.tr, true, !!S.dim) : null, head = (TRAINER_HEADS[S.tr] || [40, 6])[1] * big, slide = Math.round((1 - clamp(k, 0, 1.2)) * w * .5);
  if (S.mon && !S.dim) { requestAnim(S.mon); const mh = typeof ANIM_META !== 'undefined' && ANIM_META[S.mon] ? ANIM_META[S.mon].h : 40, ms = mh * big > h - 8 ? 1 : big, mx = x + Math.round(w * .3) - Math.round(slide * .4), my = y + h - 14 + (REDUCED ? 0 : Math.round(Math.sin(t * 2.4))); ctx.globalAlpha = .4; ellipse(mx, y + h - 13, 14 * ms, 2, '#000'); ctx.globalAlpha = 1; if (animReady(S.mon)) drawAnim(S.mon, mx, my, t, { sx: ms, sy: ms }); else drawMon(S.mon, mx, my, { sx: ms, sy: ms }); drawCrown(mx - 12 * ms, y + 4); }
  if (tc) { if (S.dim) ctx.globalAlpha = .45; ctx.drawImage(tc, x + w - Math.round(size * .78) + slide, h >= size * .9 ? y + h - size + Math.round(size * .1) : y + 4 - head, size, size); ctx.globalAlpha = 1; }
  ctx.restore();
  const nm = String(TRX(S.name || '')).toUpperCase(), ny = y + h - 13; ctx.globalAlpha = .82; rect(x + 1, ny - 2, w - 2, 14, '#07061a'); ctx.globalAlpha = 1; hline(x + 1, ny - 3, w - 2, col);
  if (displayWidth(nm) <= w - 12) displayText(nm, x + 5, ny - 1, { style: S.dim ? 'silver' : 'gold', slant: 1, shine: !S.dim }); else text(fitLabel(nm, w - 10), x + 5, ny + 1, UI.gold, { raw: true });
  if (S.sub) { const sw = Math.min(w - 10, textWidth(S.sub) + 8); rrect(x + w - sw - 3, y + 3, sw, 10, '#07061ac0', 2); text(fitLabel(S.sub, sw - 6), x + w - sw + 1, y + 5, shade(col, .55)); }
}
