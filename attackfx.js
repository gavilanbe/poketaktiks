// ============================================================================
// attackfx.js — how every attack looks. Each move has a choreography in three acts: the wind-up on the attacker (a
// charge gathering at its mouth, an aura, a crouch, a glint), the travel (a volley, a stream, a beam, a bolt, a wave,
// boulders from the sky, cracks racing through the ground, or the lunge itself) and an impact that sells the hit
// (a shaped burst in the type's colours, then embers, splashes, sparks, leaves, chips or wisps that settle and fade).
// The same choreography plays in the duel scene (field space, full size) and on the board (a third of the size and
// fewer particles); reduced motion keeps a calm version. Everything is pixel art drawn here at the game's resolution
// through effect-sprite kinds named 'a…', which art.js's drawSprite hands to drawAtkSprite.
// ============================================================================
'use strict';
// Each type's ramp: ink, dark, mid, light, hot.
const ATK_PAL = {
  Normal: ['#2a2622', '#8a8076', '#d8d0c0', '#f4eee0', '#ffffff'], Fire: ['#4a0c04', '#c42a0a', '#ff6a18', '#ffc03a', '#fff6b0'],
  Water: ['#0a2458', '#1c5cc4', '#3c9cf0', '#a0dcff', '#ffffff'], Grass: ['#0e3412', '#2a7a2a', '#5cbc3c', '#b0e878', '#effff0'],
  Electric: ['#4a3c00', '#c89c00', '#ffe030', '#fff7a0', '#ffffff'], Ice: ['#12406e', '#3e90d0', '#8ad0f8', '#d8f4ff', '#ffffff'],
  Fighting: ['#4a1408', '#b83c18', '#f07a38', '#ffc494', '#ffffff'], Poison: ['#260838', '#62248a', '#a24ccc', '#dca2f4', '#fbe8ff'],
  Ground: ['#302010', '#74502a', '#b8864a', '#e4c48c', '#fff4d4'], Flying: ['#1c2c5c', '#5a7ccc', '#a4c4f8', '#e4f0ff', '#ffffff'],
  Psychic: ['#50083a', '#c0287a', '#ff5aa8', '#ffb4da', '#ffffff'], Bug: ['#223008', '#5a7c10', '#a2bc22', '#dcea64', '#fbffd8'],
  Rock: ['#241c14', '#665640', '#a08a68', '#d2c29e', '#f6eed8'], Ghost: ['#120828', '#3a2870', '#6c4cbc', '#aa8ce8', '#ecdeff'],
  Dragon: ['#0e0e48', '#3226b4', '#6a5cff', '#aaa4ff', '#eceaff'], Dark: ['#08060c', '#241c2e', '#4a3a5c', '#8c74a4', '#d4c4e4'],
  Steel: ['#22222e', '#62627a', '#a8a8c4', '#dcdcec', '#ffffff'], Fairy: ['#58163e', '#d0569a', '#ff9ad2', '#ffd2ee', '#ffffff'],
};
const ATK_RAINBOW = ['#ff5aa8', '#ffd24a', '#6aff9a', '#5ab4ff', '#c85aff'];
function atkPal(type) { return ATK_PAL[type] || ATK_PAL.Normal; }

// ---------------------------------------------------------------- pixel helpers (whole pixels only: no smoothing)
const afR = Math.round;
function afDot(x, y, r, c) { r = afR(r); if (r <= 0) px(afR(x), afR(y), c); else circle(afR(x), afR(y), r, c); }
function afLine(x0, y0, x1, y1, c, w = 1) { pline(afR(x0), afR(y0), afR(x1), afR(y1), c, Math.max(1, afR(w))); }
function afDiamond(x, y, r, c) { x = afR(x); y = afR(y); r = afR(r); ctx.fillStyle = c; for (let j = -r; j <= r; j++) { const w = r - Math.abs(j); ctx.fillRect(x - w, y + j, 2 * w + 1, 1); } }
function afStar(x, y, r, c, core = '#ffffff') { x = afR(x); y = afR(y); r = Math.max(1, afR(r)); ctx.fillStyle = c; ctx.fillRect(x - r, y, 2 * r + 1, 1); ctx.fillRect(x, y - r, 1, 2 * r + 1); if (r > 2) { const d = afR(r * .4); for (let i = 1; i <= d; i++) { ctx.fillRect(x - i, y - i, 1, 1); ctx.fillRect(x + i, y - i, 1, 1); ctx.fillRect(x - i, y + i, 1, 1); ctx.fillRect(x + i, y + i, 1, 1); } } ctx.fillStyle = core; ctx.fillRect(x, y, 1, 1); }
function afRing(x, y, r, sq, c, th = 1) { x = afR(x); y = afR(y); const n = Math.max(12, afR(r * 5)); ctx.fillStyle = c; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.fillRect(afR(x + Math.cos(a) * r) - (th >> 1), afR(y + Math.sin(a) * r * sq) - (th >> 1), th, th); } }
// A quadratic curve from (x0,y0) through a control point to (x1,y1), up to parameter `e`, as whole-pixel points.
function afCurve(x0, y0, cx, cy, x1, y1, e, step = 2) { const out = [], L = Math.hypot(x1 - x0, y1 - y0) + Math.abs(cy - (y0 + y1) / 2), n = Math.max(4, Math.ceil(L / step)); for (let i = 0; i <= n * e; i++) { const t = i / n, u = 1 - t; out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); } return out; }

// ---------------------------------------------------------------- sounds (built on Audio's tone and noise)
function atkSfx(name) {
  const A = Audio; if (!A.ac || A.muted) return;
  switch (name) {
    case 'slash': A.noise(.08, .22, 0, 3500); A.tone('sawtooth', 1400, 500, .08, .06); break;
    case 'claw': for (let i = 0; i < 3; i++) A.noise(.05, .2, i * .045, 3000); A.tone('sawtooth', 1200, 600, .12, .05); break;
    case 'snap': A.tone('square', 900, 200, .06, .16); A.noise(.05, .25, .01, 1800); break;
    case 'crunch': A.noise(.16, .32, 0, 700); A.tone('square', 300, 70, .14, .18); A.noise(.06, .2, .08, 2500); break;
    case 'chop': A.noise(.07, .3, 0, 1200); A.tone('square', 640, 140, .1, .16); break;
    case 'crack': A.tone('square', 2400, 1800, .05, .1); A.noise(.12, .2, .02, 4000); A.tone('triangle', 1600, 2600, .15, .06, .05); break;
    case 'freeze': [2000, 2600, 3200].forEach((f, i) => A.tone('sine', f, f * 1.1, .12, .06, i * .05)); A.noise(.3, .08, 0, 5000); break;
    case 'rock': A.noise(.22, .32, 0, 250); A.tone('square', 160, 55, .2, .18); break;
    case 'quake': A.noise(.8, .36, 0, 60); A.tone('sine', 70, 28, .8, .36); A.noise(.4, .16, .3, 200); break;
    case 'rumble': A.noise(.45, .22, 0, 80); A.tone('sine', 62, 40, .45, .22); break;
    case 'thunder': A.noise(.7, .46, 0, 140); A.tone('sawtooth', 200, 28, .55, .26); A.noise(.16, .36, 0, 3000); break;
    case 'zap': for (let i = 0; i < 4; i++) A.tone('square', 2200 - i * 200, 1400, .03, .08, i * .03); A.noise(.1, .1, 0, 5000); break;
    case 'wind': A.noise(.36, .2, 0, 900); A.tone('sine', 300, 720, .3, .05); break;
    case 'ghost': A.tone('sine', 520, 170, .5, .12); A.tone('sine', 540, 180, .5, .08, .03); break;
    case 'sparkle': [1760, 2217, 2637, 3520].forEach((f, i) => A.tone('sine', f, f, .08, .05, i * .045)); break;
    case 'splash': A.noise(.32, .26, 0, 1500); A.tone('sine', 820, 190, .2, .1); break;
    case 'sludge': A.tone('sawtooth', 180, 70, .25, .14); A.noise(.2, .12, .05, 600); for (let i = 0; i < 3; i++) A.tone('sine', 300 + i * 90, 600 + i * 90, .05, .05, .1 + i * .05); break;
    case 'clang': A.tone('square', 1800, 1700, .25, .1); A.tone('triangle', 2700, 2600, .3, .08); A.noise(.05, .2, 0, 3000); break;
    case 'drill': for (let i = 0; i < 5; i++) A.tone('sawtooth', 700 + i * 60, 900 + i * 60, .04, .06, i * .035); break;
    case 'whip': A.noise(.06, .3, 0, 4000); A.tone('sine', 1800, 400, .06, .1); break;
    case 'blast': A.noise(.45, .42, 0, 120); A.tone('sawtooth', 220, 38, .45, .24); break;
    case 'bubbles': for (let i = 0; i < 5; i++) A.tone('sine', 700 + i * 130, 1200 + i * 130, .05, .06, i * .04); break;
    case 'psywave': A.tone('sine', 300, 900, .35, .1); A.tone('sine', 310, 920, .35, .08, .02); A.tone('triangle', 1200, 600, .3, .04, .1); break;
    case 'roar': A.tone('sawtooth', 110, 70, .4, .22); A.noise(.35, .2, 0, 200); break;
    case 'kiss': A.tone('sine', 900, 1400, .08, .1); A.tone('sine', 1400, 900, .1, .08, .08); break;
    case 'moon': [880, 1320, 1760].forEach((f, i) => A.tone('triangle', f, f * 1.5, .3, .05, i * .06)); break;
    case 'beamcharge': A.tone('sine', 150, 1200, .45, .1); A.tone('square', 300, 2400, .45, .03, .05); break;
    default: A.sfx(name); // the shared cues (fire, water, beam, psy, elec, grass, poison, absorb...)
  }
}

// ---------------------------------------------------------------- effect sprites
// Spawn a sprite and keep the fields spawnSprite does not know (pal, style, ex/ey, w, h...).
function afS(kind, x, y, o = {}) { const s = spawnSprite(kind, x, y, o); if (s) for (const k in o) if (!(k in s)) s[k] = o[k]; return s; }
// Every 'a…' kind is drawn here (x, y: the sprite's position on screen; ox, oy: the offset of the space it lives in).
function drawAtkSprite(s, x, y, k, fade, ox, oy) {
  const P = s.pal || ATK_PAL.Normal, ft = Math.floor(s.t * 30), Rf = mulberry32(s.seed * 7 + ft * 131), Rs = mulberry32(s.seed);
  if (s.follow) { const o = s.follow(); x += afR(o[0]); y += afR(o[1]); }
  switch (s.kind) {
    // A stream or beam from (x,y) to (ex,ey): its head races out, holds, then its tail catches up. Styles: fire (a
    // widening cone of flame), water (a jet with a lit side and spray), ice (a thin bright beam growing crystals), psy
    // (a thread wrapped in travelling rings, rainbow for Psybeam), light (a solid beam with a white-hot core).
    case 'aStream': {
      const ex = s.ex + ox, ey = s.ey + oy, dx = ex - x, dy = ey - y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const g = s.grow || .3, h = s.hold || .72, head = L * easeOut(Math.min(1, k / g)), tail = k < h ? 0 : L * easeIn(Math.min(1, (k - h) / (1 - h)));
      const W = s.w * (k < .08 ? .45 + k / .08 * .55 : 1) * (k > h ? 1 - .5 * (k - h) / (1 - h) : 1), st = s.style, at = d => [x + ux * d, y + uy * d];
      ctx.globalAlpha = Math.min(1, fade * 1.4);
      if (st === 'fire') {
        const pts = []; for (let d = tail; d <= head; d += 3) { const f = d / L, r = W * (.35 + f * .85) * (.85 + Rf() * .3), wob = Math.sin(d * .13 - s.t * 34) * r * .3, [X, Y] = at(d); pts.push([X + nx * wob, Y + ny * wob - f * f * 3, r, f]); }
        for (const [X, Y, r] of pts) afDot(X, Y, r + 1, P[1]);
        for (const [X, Y, r, f] of pts) afDot(X, Y - r * .15, r * .74, f > .8 ? P[1] : P[2]);
        for (const [X, Y, r, f] of pts) if (f < .82) afDot(X, Y - r * .25, r * .44, P[3]);
        for (const [X, Y, r, f] of pts) if (f < .42) afDot(X, Y - r * .3, r * .2, P[4]);
        for (let i = 0; i < 7 && pts.length; i++) { const [X, Y, r] = pts[Math.floor(Rf() * pts.length)]; afLine(X, Y - r * .6, X + (Rf() - .5) * 4, Y - r - 2 - Rf() * 6, i % 2 ? P[2] : P[3], 2); }
        if (pts.length && k < h) { const [X, Y] = at(head), r = W * 1.25 * (.9 + Rf() * .2); afDot(X, Y, r + 1, P[1]); afDot(X, Y - 1, r * .75, P[2]); afDot(X - ux * 2, Y - 2, r * .42, P[3]); }
      } else if (st === 'water') {
        const pts = []; for (let d = tail; d <= head; d += 2) { const r = W * (.82 + .22 * Math.sin(d * .32 - s.t * 44)), [X, Y] = at(d); pts.push([X, Y, r]); }
        for (const [X, Y, r] of pts) afDot(X, Y, r + 1, P[1]);
        for (const [X, Y, r] of pts) afDot(X, Y, r, P[2]);
        for (const [X, Y, r] of pts) afDot(X - nx * r * .32, Y - ny * r * .32, r * .5, P[3]);
        for (const [X, Y, r] of pts) px(afR(X - nx * r * .5), afR(Y - ny * r * .5), P[4]);
        for (let i = 0; i < 6 && head > tail; i++) { const d = tail + (head - tail) * Rf(), side = Rf() < .5 ? -1 : 1, off = W + 2 + Rf() * 5, [X, Y] = at(d); afDot(X + nx * side * off, Y + ny * side * off, Rf() < .3 ? 1 : 0, Rf() < .5 ? P[3] : P[4]); }
        if (head >= L - 1 && k < h) { for (let i = 0; i < 9; i++) { const a = Math.atan2(-uy, -ux) + (i - 4) * .32 + (Rf() - .5) * .2, rr = W * (1.6 + Rf() * 1.4); afLine(ex, ey, ex + Math.cos(a) * rr, ey + Math.sin(a) * rr - rr * .4, i % 2 ? P[4] : P[3], 1); } afDot(ex, ey, W * 1.1, P[3]); afDot(ex, ey, W * .6, P[4]); }
      } else if (st === 'ice') {
        const [x0, y0] = at(tail), [x1, y1] = at(head); ctx.globalAlpha = .4 * fade; afLine(x0, y0, x1, y1, P[2], W * 2 + 3); ctx.globalAlpha = Math.min(1, fade * 1.4);
        afLine(x0, y0, x1, y1, P[3], W + 1); afLine(x0, y0, x1, y1, P[4], Math.max(1, W - 1));
        for (let d = tail + (s.seed % 5); d < head; d += 8) { const side = ((d / 8) | 0) % 2 ? 1 : -1, cr = 1 + ((d * 7 + s.seed) % 3), [X, Y] = at(d); afDiamond(X + nx * side * (W + 1), Y + ny * side * (W + 1), cr, P[3]); px(afR(X + nx * side * (W + 1)), afR(Y + ny * side * (W + 1)), '#ffffff'); }
        for (let i = 0; i < 4 && head > tail; i++) { const [X, Y] = at(tail + (head - tail) * Rf()); afStar(X + (Rf() - .5) * W * 3, Y + (Rf() - .5) * W * 3, 2 + Rf() * 2, P[3]); }
        if (head >= L - 1 && k < h) { afDot(ex, ey, W + 2, P[3]); afStar(ex, ey, W * 2 + 3, P[4]); }
      } else if (st === 'psy') {
        const [x0, y0] = at(tail), [x1, y1] = at(head); afLine(x0, y0, x1, y1, P[3], Math.max(1, W * .4)); afLine(x0, y0, x1, y1, P[4], 1);
        const sp = 9, ph = (s.t * 110) % sp; for (let d = tail + ph, i = 0; d < head; d += sp, i++) { const r = W * (1.1 + .25 * Math.sin(d * .2 - s.t * 10)), [X, Y] = at(d), col = s.rainbow ? ATK_RAINBOW[(i + ft) % 5] : i % 2 ? P[2] : P[3];
          ctx.fillStyle = col; for (let a = 0; a < 22; a++) { const ca = Math.cos(a / 22 * Math.PI * 2), sa = Math.sin(a / 22 * Math.PI * 2); ctx.fillRect(afR(X + nx * ca * r + ux * sa * r * .32), afR(Y + ny * ca * r + uy * sa * r * .32), 1, 1); } }
      } else { // light
        const [x0, y0] = at(tail), [x1, y1] = at(head), fl = ft % 2; ctx.globalAlpha = .3 * fade; afLine(x0, y0, x1, y1, P[2], W * 2 + 5 + fl * 2); ctx.globalAlpha = .65 * fade; afLine(x0, y0, x1, y1, P[2], W * 2 + 1); ctx.globalAlpha = Math.min(1, fade * 1.4);
        afLine(x0, y0, x1, y1, P[3], W * 1.35); afLine(x0, y0, x1, y1, P[4], Math.max(1, W * .6));
        for (let i = 0; i < 4; i++) { const d = (s.t * 300 + i * L / 4) % L; if (d < tail || d > head - 8) continue; const [X, Y] = at(d), o = (i % 2 ? 1 : -1) * W * .55; afLine(X + nx * o, Y + ny * o, X + ux * 9 + nx * o, Y + uy * 9 + ny * o, '#ffffff', 1); }
        if (tail < 2) { afDot(x, y, W * 1.35 + fl, P[3]); afDot(x, y, W * .8, P[4]); }
        if (head >= L - 1 && k < h) { afDot(ex, ey, W * 1.7 + fl * 2, P[2]); afDot(ex, ey, W * 1.15, P[3]); afDot(ex, ey, W * .6, P[4]); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + s.t * 4, rr = W * (2.2 + Rf()); afLine(ex + Math.cos(a) * W, ey + Math.sin(a) * W, ex + Math.cos(a) * rr, ey + Math.sin(a) * rr, P[3], 1); } }
      }
      ctx.globalAlpha = 1; break;
    }
    // A jagged bolt from (x,y) to (ex,ey), re-rolled a dozen times a second, with forks; white on its first frames.
    case 'aBolt': {
      if (s.flick && k > .3 && (ft + s.seed) % 3 === 2) break;
      const ex = s.ex + ox, ey = s.ey + oy, dx = ex - x, dy = ey - y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = s.segs || Math.max(4, afR(L / 14)), J = s.jit || 8, W = s.w || 2, Rb = mulberry32(s.seed * 3 + Math.floor(s.t * 14) * 17);
      const pts = [[x, y]]; for (let i = 1; i < n; i++) { const f = i / n, j = (Rb() - .5) * J * 2; pts.push([x + dx * f + nx * j, y + dy * f + ny * j]); } pts.push([ex, ey]);
      const white = s.t < .05, layers = white ? [['#ffffff', W + 2]] : [[P[1], W + 4, .5], [P[2], W + 2], [P[3], W], ['#ffffff', Math.max(1, W - 2)]];
      const forks = []; for (let f = 0; f < (s.forks == null ? 2 : s.forks); f++) { const i = 1 + Math.floor(Rb() * (n - 1)), a = Math.atan2(dy, dx) + (Rb() < .5 ? -1 : 1) * (.5 + Rb() * .5), l = L * (.12 + Rb() * .12); let [fx, fy] = pts[i]; const fp = [[fx, fy]]; for (let m = 1; m <= 3; m++) { fx += Math.cos(a) * l / 3 + (Rb() - .5) * 5; fy += Math.sin(a) * l / 3 + (Rb() - .5) * 5; fp.push([fx, fy]); } forks.push(fp); }
      for (const [c, w, al] of layers) { ctx.globalAlpha = (al || 1) * fade; for (let i = 0; i < pts.length - 1; i++) afLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, w); for (const fp of forks) for (let i = 0; i < fp.length - 1; i++) afLine(fp[i][0], fp[i][1], fp[i + 1][0], fp[i + 1][1], c, Math.max(1, w - 2)); }
      ctx.globalAlpha = 1; break;
    }
    // A projectile orb (moving from x0,y0 to tx,ty on an arc), with a trail sampled back along its own path.
    // Styles: shadow, sludge, moon, fire, mud, energy.
    case 'aOrb': {
      const r = afR(s.size * (k < .15 ? .6 + k / .15 * .4 : 1)), st = s.style, pos = kk => [lerp(s.x0, s.tx, kk) + ox, lerp(s.y0, s.ty, kk) - Math.sin(kk * Math.PI) * s.arc + oy];
      for (let j = 7; j >= 1; j--) { const kk = k - j * .035; if (kk < 0) continue; const [X, Y] = pos(kk), tr = Math.max(0, r * (1 - j / 8)); ctx.globalAlpha = (1 - j / 9) * fade;
        if (st === 'shadow') afDot(X + (Rf() - .5) * 3, Y + (Rf() - .5) * 3, tr, j % 2 ? P[1] : P[2]);
        else if (st === 'moon') { if (j % 2) afStar(X + (Rf() - .5) * r, Y + (Rf() - .5) * r, 1 + (j < 4 ? 1 : 0), P[3]); }
        else if (st === 'fire') afDot(X, Y - j * .5, tr + 1, j < 3 ? P[2] : P[1]);
        else if (st === 'sludge' || st === 'mud') { if (j % 3 === 0) afDot(X, Y + j, 1, P[2]); }
        else afDot(X, Y, tr, P[2]); }
      ctx.globalAlpha = fade;
      if (st === 'shadow') { ctx.globalAlpha = .45 * fade; afDot(x, y, r + 4, P[2]); ctx.globalAlpha = fade; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + s.t * 9, rr = r + 1 + Rf() * 3; afLine(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * rr, y + Math.sin(a) * rr, P[3], 1); } afDot(x, y, r + 1, P[3]); afDot(x, y, r, P[0]); afDot(x + Math.cos(s.t * 11) * r * .3, y + Math.sin(s.t * 11) * r * .3, r * .55, P[1]); px(x - afR(r * .5), y - afR(r * .5), P[4]); }
      else if (st === 'moon') { ctx.globalAlpha = .35 * fade; afDot(x, y, r + 5, P[2]); ctx.globalAlpha = fade; afDot(x, y, r + 1, P[2]); afDot(x, y, r, P[3]); afDot(x - 1, y - 1, r * .7, P[4]); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + s.t * 6; afStar(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), 1, P[4]); } }
      else if (st === 'fire') { const fl = ft % 2; afDot(x, y, r + 2 + fl, P[1]); afDot(x, y - 1, r + 1, P[2]); afDot(x - 1, y - 2, r * .68, P[3]); afDot(x - 1, y - 2, r * .34, P[4]); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .5 + (Rf() - .5) * .3; afLine(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 3 + Rf() * 4), y + Math.sin(a) * (r + 3 + Rf() * 4), P[2], 2); } }
      else if (st === 'sludge' || st === 'mud') { afDot(x, y, r + 1, P[0]); afDot(x, y, r, P[1]); afDot(x - 1, y - 1, r * .75, P[2]); afDot(x + afR(r * .4), y + afR(r * .3), afR(r * .45), P[1]); px(x - afR(r * .4), y - afR(r * .5), P[4]); if (st === 'sludge' && ft % 6 < 3) afRing(x + r * .3, y - r * .6, 1.5, 1, P[3]); }
      else { ctx.globalAlpha = .4 * fade; afDot(x, y, r + 3, P[2]); ctx.globalAlpha = fade; afDot(x, y, r + 1, P[2]); afDot(x, y, r, P[3]); afDot(x - 1, y - 1, r * .5, P[4]); }
      ctx.globalAlpha = 1; break;
    }
    // A slash: a crescent sweeping round (x,y) from angle a0 to a1 (style 'arc'; 'claw' draws three), or a straight
    // cut from (x+lx0, y+ly0) to (x+lx1, y+ly1) (style 'line'). It sweeps in, holds, thins away from its tail.
    case 'aSlash': {
      const sw = easeOut(Math.min(1, k / (s.sweep || .3))), tailK = k < .45 ? 0 : (k - .45) / .55, th = (s.th || 4) * (1 - tailK * .7);
      if (s.style === 'line') { const x0 = x + s.lx0, y0 = y + s.ly0, x1 = x + s.lx1, y1 = y + s.ly1, X1 = lerp(x0, x1, sw), Y1 = lerp(y0, y1, sw), X0 = lerp(x0, x1, tailK * sw), Y0 = lerp(y0, y1, tailK * sw);
        ctx.globalAlpha = .45 * fade; afLine(X0, Y0, X1, Y1, P[2], th + 4); ctx.globalAlpha = fade; afLine(X0, Y0, X1, Y1, P[3], th + 2); afLine(X0, Y0, X1, Y1, '#ffffff', Math.max(1, th)); if (sw < 1) afStar(X1, Y1, 3 + th, '#ffffff');
      } else { const arcs = s.style === 'claw' ? [-5, 0, 5] : [0], r = s.size, sq = s.sq || 1;
        for (const off of arcs) { const R0 = r + off, span = s.a1 - s.a0, n = Math.max(8, afR(Math.abs(span) * R0)); for (let i = 0; i <= n; i++) { const f = i / n; if (f > sw || f < tailK * sw) continue; const a = s.a0 + span * f, t2 = Math.max(1, afR(th * Math.sin(Math.PI * f))), ca = Math.cos(a), sa = Math.sin(a);
          for (let d = -1; d <= t2; d++) { ctx.fillStyle = d < 0 ? P[2] : d === 0 ? P[3] : d >= t2 - 1 ? P[3] : '#ffffff'; ctx.fillRect(afR(x + ca * (R0 - d)), afR(y + sa * (R0 - d) * sq), 1, 1); } } }
        if (sw < 1) { const a = s.a0 + (s.a1 - s.a0) * sw; afStar(x + Math.cos(a) * r, y + Math.sin(a) * r * (s.sq || 1), 4, '#ffffff'); } }
      ctx.globalAlpha = 1; break;
    }
    // Jaws: a row of fangs above and one below, snapping shut on (x,y), shaking as they bite, fading. 'bug' draws
    // two curved mandibles closing from the sides instead.
    case 'aJaws': {
      const S = s.size, close = k < .36 ? easeIn(k / .36) : 1, sh = k > .36 && k < .62 ? afR(Math.sin(k * 90) * 2) : 0, X = x + sh;
      if (s.style === 'bug') { const g = afR(S * .9 * (1 - close)); for (const side of [-1, 1]) { const pts = afCurve(X + side * (S * 1.25 + g), y + S * .35, X + side * (S * .95 + g), y - S * 1.05, X + side * (g + 1), y - S * .05, 1, 1); for (const [a, b] of pts) rect(afR(a) - 2, afR(b) - 2, 5, 5, P[0]); for (const [a, b] of pts) rect(afR(a) - 1, afR(b) - 1, 3, 3, P[2]); for (const [a, b] of pts) px(afR(a) - side, afR(b) - 1, P[4]); } }
      else { // fangs: the upper row points down to (x,y), the lower row points up, half a fang along so they interlock
        const n = s.teeth || 5, tw = Math.max(3, afR(S * 2 / n)), gap = afR(S * .9 * (1 - close)), th = Math.max(3, afR(S * .62)), gum = s.gum || P[1], left = afR(X - n * tw / 2);
        rect(left - 2, y - gap - th - 4, n * tw + 4, 4, P[0]); rect(left - 1, y - gap - th - 3, n * tw + 2, 2, gum); rect(left - 2, y + gap + th + 1, n * tw + 4, 4, P[0]); rect(left - 1, y + gap + th + 2, n * tw + 2, 2, gum);
        for (let i = 0; i < n; i++) for (let j = 0; j < th; j++) { const w = Math.max(1, afR((tw - 1) * (1 - j / th))), cu = left + tw / 2 + i * tw, cl = left + tw + i * tw, yu = y - gap - th + j, yl = y + gap + th - j;
          rect(afR(cu - w / 2) - 1, yu, w + 2, 1, P[0]); rect(afR(cu - w / 2), yu, w, 1, j ? '#ffffff' : '#d8d0dc'); if (i < n - 1) { rect(afR(cl - w / 2) - 1, yl, w + 2, 1, P[0]); rect(afR(cl - w / 2), yl, w, 1, j ? '#ffffff' : '#d8d0dc'); } } }
      ctx.globalAlpha = 1; break;
    }
    // A fissure racing along the ground from (x,y) to (ex, y): a dark crack with a glowing seam and raised chips.
    case 'aCrack': {
      const ex = s.ex + ox, reach = easeOut(Math.min(1, k / (s.grow || .45))), n = Math.max(3, afR(Math.abs(ex - x) / 6)), pts = [];
      for (let i = 0; i <= n; i++) pts.push([lerp(x, ex, i / n), y + (i && i < n ? afR((Rs() - .5) * 5) : 0)]);
      const m = reach * n; for (let i = 0; i < n && i < m; i++) { const f = Math.min(1, m - i), [a, b] = pts[i], [c2, d2] = pts[i + 1], X1 = lerp(a, c2, f), Y1 = lerp(b, d2, f);
        afLine(a, b + 1, X1, Y1 + 1, P[0], 3); afLine(a, b, X1, Y1, s.glow || P[3], 1); if (i % 2 === 0) { rect(afR(a) - 1, afR(b) - 3, 3, 2, P[2]); px(afR(a), afR(b) - 3, P[3]); } if (i % 3 === 1) afLine(a, b, a + (Rs() - .5) * 8, b + 3 + Rs() * 3, P[0], 1); }
      ctx.globalAlpha = 1; break;
    }
    // A spike erupting from the ground at (x,y): rock (faceted stone), ice (a clear crystal) or dirt (a geyser).
    case 'aSpike': {
      const H = s.h, W = s.w, grow = k < .16 ? easeOutBack(k / .16, 2.2) : 1, crumb = k > .7 ? (k - .7) / .3 : 0, h = afR(H * grow * (1 - crumb * .5)), lean = s.lean || 0;
      if (s.style === 'dirt') { for (let j = 0; j < h; j += 2) { const f = j / Math.max(1, h), r = W * (.35 + .4 * (1 - f)) * (.8 + Rs() * .4), X = x + lean * j + (Rf() - .5) * 3; afDot(X, y - j, r + 1, P[0]); afDot(X, y - j, r, j % 4 ? P[1] : P[2]); } for (let i = 0; i < 6; i++) afDot(x + (Rf() - .5) * W * 2, y - h - Rf() * 10, 1, P[2]); break; }
      for (let j = 0; j < h; j++) { const f = j / Math.max(1, h), hw = Math.max(0, afR(W / 2 * Math.pow(1 - f, .85))), X = afR(x + lean * j) + (crumb > 0 && j > h * .5 ? afR(Rs() * 2) : 0), Y = y - j;
        if (s.style === 'ice') { ctx.globalAlpha = .9 * fade; rect(X - hw - 1, Y, 2 * hw + 3, 1, P[1]); rect(X - hw, Y, 2 * hw + 1, 1, P[2]); rect(X - hw, Y, Math.max(1, hw >> 1), 1, P[4]); rect(X, Y, 1, 1, P[3]); }
        else { rect(X - hw - 1, Y, 2 * hw + 3, 1, P[0]); rect(X - hw, Y, hw, 1, P[3]); rect(X, Y, hw + 1, 1, P[1]); if ((j + (s.seed & 7)) % 5 === 0) rect(X - hw, Y, 2 * hw + 1, 1, P[2]); } }
      px(afR(x + lean * h), y - h, P[4]); ctx.globalAlpha = 1; break;
    }
    // A boulder falling from (fx0,fy0) to (fx1,fy1) with its shadow growing under it; it breaks when it lands.
    case 'aBoulder': {
      const fk = Math.min(1, k / (s.fall || .55)); if (fk >= 1) break; const X = lerp(s.fx0, s.fx1, fk) + ox, Y = lerp(s.fy0, s.fy1, easeIn(fk)) + oy, r = s.size, gy = (s.gy == null ? s.fy1 : s.gy) + oy;
      ctx.globalAlpha = .35 * fade; ellipse(afR(s.fx1 + ox), afR(gy), Math.max(2, afR(r * (.4 + .8 * fk))), Math.max(1, afR(r * .3)), '#000000'); ctx.globalAlpha = fade;
      const rot = s.rot + fk * 7, lumps = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + rot, d = r * (.35 + Rs() * .2); lumps.push([X + Math.cos(a) * d, Y + Math.sin(a) * d, r * (.55 + Rs() * .2)]); }
      for (const [a, b, c2] of lumps) afDot(a, b, c2 + 1, P[0]); for (const [a, b, c2] of lumps) afDot(a, b, c2, P[2]); for (const [a, b, c2] of lumps) afDot(a + c2 * .25, b + c2 * .3, c2 * .55, P[1]); afDot(X - r * .3, Y - r * .35, r * .35, P[3]); px(afR(X - r * .4), afR(Y - r * .5), P[4]);
      ctx.globalAlpha = 1; break;
    }
    // A whirlwind travelling from fx0 to fx1 along the ground at gy: rings of dashes spinning, wider at the top.
    case 'aTornado': {
      const e = easeInOut(Math.min(1, k / (s.go || .7))), X = lerp(s.fx0, s.fx1, e) + ox, gy = s.gy + oy, H = s.h * (k < .12 ? k / .12 : k > .85 ? 1 - (k - .85) / .15 : 1), n = Math.max(4, afR(H / 5));
      for (let j = 0; j < n; j++) { const yy = gy - j * H / n, rx = s.w * (.22 + .78 * j / n) + Math.sin(j * .9 + s.t * 7) * 2, cx = X + Math.sin(j * .5 + s.t * 5) * 3; for (let a = 0; a < 26; a++) { if ((a + j + ft) % 3 === 0) continue; const ang = a / 26 * Math.PI * 2 + s.t * 16 + j * .7, sn = Math.sin(ang); ctx.fillStyle = sn > .2 ? P[3] : sn > -.3 ? P[2] : P[1]; ctx.fillRect(afR(cx + Math.cos(ang) * rx), afR(yy + sn * rx * .22), 2, 1); } }
      for (let i = 0; i < 5; i++) { const ph = (s.t * 1.6 + i / 5) % 1, ang = s.t * 13 + i * 2.1, rr = s.w * (.3 + ph * .7); afDot(X + Math.cos(ang) * rr, gy - ph * H, 1, i % 2 ? P[4] : P[0]); }
      ctx.globalAlpha = 1; break;
    }
    // A breaking wave rolling from fx0 to fx1 over the ground at gy: a tall front with a curling lip of foam.
    case 'aWave': {
      const e = easeInOut(Math.min(1, k / (s.go || .78))), dir = s.dir, xf = afR(lerp(s.fx0, s.fx1, e) + ox), gy = afR(s.gy + oy), H = s.h * (k < .12 ? easeOut(k / .12) : k > .82 ? 1 - (k - .82) / .18 : 1), len = s.len;
      // the profile: a crest just behind the front, the back sloping away; deep water below, a lit band, foam on top
      const prof = u => u < .08 ? .3 + .7 * (u / .08) : u < .24 ? 1 : 1 - Math.pow((u - .24) / .76, 1.25) * .82;
      ctx.globalAlpha = .9 * fade;
      for (let c = 0; c < len; c++) { const u = c / len, X = xf - dir * c, hg = afR(H * prof(u) * (1 + .04 * Math.sin(c * .3 - s.t * 14))); if (hg <= 0) continue;
        rect(X, gy - hg, 1, hg, P[2]); rect(X, gy - afR(hg * .42), 1, afR(hg * .42), P[1]); rect(X, gy - hg + 2, 1, Math.max(1, afR(hg * .2)), P[3]); rect(X, gy - hg, 1, 2, (c + ft) % 6 < 4 ? P[4] : P[3]);
        if ((c * 7 + afR(s.t * 30)) % 13 === 0) rect(X, gy - afR(hg * (.45 + .3 * Math.abs(Math.sin(c)))), 2, 1, P[4]); }
      // the lip: an arc from the crest top curling forward and down over the front, foam falling from its tip
      const R = Math.max(3, H * .3), xc = xf - dir * afR(len * .16), yc = gy - H + R;
      for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * 2.36, X = xc + dir * Math.cos(a) * R, Y = yc + Math.sin(a) * R; afDot(X, Y, 3, P[3]); px(afR(xc + dir * Math.cos(a) * (R + 3)), afR(yc + Math.sin(a) * (R + 3)), P[4]); }
      const tx0 = xc + dir * Math.cos(.785) * R, ty0 = yc + Math.sin(.785) * R;
      for (let i = 0; i < 7; i++) { const f = (s.t * 2.4 + i / 7) % 1; afDot(tx0 + dir * (Rf() * 4 - 1), ty0 + f * (gy - ty0), Rf() < .4 ? 1 : 0, P[4]); }
      for (let i = 0; i < 9; i++) afDot(xf - dir * Rf() * len * .3, gy - H - 3 - Rf() * 10, Rf() < .4 ? 1 : 0, Rf() < .5 ? P[4] : P[3]);
      ctx.globalAlpha = 1; break;
    }
    // A storm cloud gathering over (x,y): dark lumps, a lit top, lightning flickering inside once it has formed.
    case 'aCloud': {
      const g = easeOut(Math.min(1, k / .25)), W = s.w * g; if (W < 2) break; const lumps = []; for (let i = 0; i < 7; i++) lumps.push([x + (Rs() - .5) * W * 1.6, y + (Rs() - .5) * W * .35, W * (.32 + Rs() * .22)]);
      ctx.globalAlpha = .9 * fade; for (const [a, b, r] of lumps) afDot(a, b + 1, r + 1, P[0]); for (const [a, b, r] of lumps) afDot(a, b, r, s.body || '#3a3a4e'); for (const [a, b, r] of lumps) afDot(a - r * .2, b - r * .35, r * .5, s.top || '#6a6a82');
      if (k > .35 && (ft + s.seed) % 5 < 2) { const [a, b] = lumps[ft % lumps.length]; afLine(a - 3, b - 2, a + 1, b + 1, P[3], 1); afLine(a + 1, b + 1, a - 1, b + 4, P[4], 1); }
      ctx.globalAlpha = 1; break;
    }
    // The moon rising over the attacker for Moonblast: a halo, the pale disc, soft craters, twinkles round it.
    case 'aMoon': {
      const rise = easeOut(Math.min(1, k / .35)), Y = y + afR((1 - rise) * 14), r = s.size; ctx.globalAlpha = .3 * fade * rise; afDot(x, Y, r + 6 + (ft % 2), P[2]); ctx.globalAlpha = fade * rise;
      afDot(x, Y, r + 1, P[2]); afDot(x, Y, r, P[4]); afDot(x + r * .35, Y + r * .1, r * .7, '#ffe8f4'); afDot(x - r * .3, Y - r * .2, r * .22, P[3]); afDot(x + r * .25, Y + r * .35, r * .15, P[3]); afDot(x - r * .1, Y + r * .45, 1, P[3]);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + s.t * 2, rr = r + 7; if ((ft + i) % 4) afStar(x + Math.cos(a) * rr, Y + Math.sin(a) * rr * .8, 1 + (i % 2), P[4], P[3]); }
      ctx.globalAlpha = 1; break;
    }
    // A big heart (Draining Kiss), pulsing, outlined, with a shine.
    case 'aHeart': {
      const r = afR(s.size * (1 + .12 * Math.sin(s.t * 18))); if (r < 2) break; const draw = (rr, c) => { afDot(x - rr * .5, y - rr * .2, rr * .56, c); afDot(x + rr * .5, y - rr * .2, rr * .56, c); ctx.fillStyle = c; for (let j = 0; j <= rr; j++) { const w = afR(rr * 1.02 * (1 - j / rr)); ctx.fillRect(afR(x) - w, afR(y + j * .95), 2 * w + 1, 1); } };
      draw(r + 1, P[0]); draw(r, P[2]); afDot(x - r * .45, y - r * .35, r * .22, P[4]); ctx.globalAlpha = 1; break;
    }
    // A rune on the ground under the target for Hex: two rings turning opposite ways with glyph marks.
    case 'aRune': {
      const r = s.size * easeOut(Math.min(1, k / .2)), pulse = .6 + .4 * Math.sin(s.t * 20); ctx.globalAlpha = fade * pulse; afRing(x, y, r, .32, P[3], 2); afRing(x, y, r * .62, .32, P[2], 1);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + s.t * 3, gx = x + Math.cos(a) * r * .82, gy = y + Math.sin(a) * r * .82 * .32; rect(afR(gx) - 1, afR(gy) - 1, 3, 1, P[4]); px(afR(gx), afR(gy), P[4]); }
      ctx.globalAlpha = 1; break;
    }
    // A needle flying from (x0,y0) to (tx,ty): a bright tip, a shaft and a fading streak behind.
    case 'aNeedle': {
      const dx = s.tx - s.x0, dy = s.ty - s.y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, len = s.size; ctx.globalAlpha = .35 * fade; afLine(x - ux * len * 3, y - uy * len * 3, x, y, P[3], 1); ctx.globalAlpha = fade;
      afLine(x - ux * len, y - uy * len, x, y, P[1], 3); afLine(x - ux * len, y - uy * len, x, y, P[3], 1); rect(afR(x) - 1, afR(y) - 1, 2, 2, '#ffffff'); ctx.globalAlpha = 1; break;
    }
    // A feather drifting down, rocking as it falls.
    case 'aFeather': {
      const sw = Math.sin(s.t * 7 + s.seed) , X = x + afR(sw * 3), a = sw * .6 + (s.rot || 0), ca = Math.cos(a), sa = Math.sin(a), L = s.size;
      for (let i = -L; i <= L; i++) { const fx = afR(X + ca * i), fy = afR(y + sa * i); px(fx, fy, P[1]); if (Math.abs(i) < L - 1) { px(fx - afR(sa), fy + afR(ca) - 1, P[4]); px(fx + afR(sa), fy - afR(ca) + 1, P[3]); } }
      ctx.globalAlpha = 1; break;
    }
    // A vine whip from (x,y) to (ex,ey): it lashes out on a curve, cracks at the tip, then recoils.
    case 'aVine': {
      const ex = s.ex + ox, ey = s.ey + oy, ext = k < .42 ? easeOut(k / .42) : k < .6 ? 1 : 1 - easeIn((k - .6) / .4), cx = (x + ex) / 2, cy = Math.min(y, ey) - (s.bend || 24) * (1 - (k > .4 && k < .5 ? (k - .4) * 5 : 0));
      const pts = afCurve(x, y, cx, cy, ex, ey, ext, 1), W = s.w || 2; for (const [a, b] of pts) rect(afR(a) - 1, afR(b) - 1, W + 2, W + 2, P[0]); for (const [a, b] of pts) rect(afR(a), afR(b), W, W, P[2]); for (const [a, b] of pts) px(afR(a), afR(b), P[3]);
      for (let i = 6; i < pts.length; i += 9) { const [a, b] = pts[i], d = (i / 9) % 2 ? 1 : -1; rect(afR(a) + d * 2, afR(b) - 2, 2, 2, P[3]); px(afR(a) + d * 3, afR(b) - 3, P[4]); }
      if (k > .38 && k < .52 && pts.length) { const [a, b] = pts[pts.length - 1]; afStar(a, b, 5, '#ffffff', '#ffffff'); }
      ctx.globalAlpha = 1; break;
    }
    // A spinning drill cone pointing along `dir` (Drill Peck), riding the attacker's lunge.
    case 'aDrill': {
      const L = s.size, w = s.w || 7, dir = s.dir; for (let j = 0; j < L; j++) { const r = afR(w * (1 - j / L)), X = afR(x + dir * j); if (r <= 0) { px(X, y, P[4]); continue; } rect(X, y - r - 1, 1, 2 * r + 3, P[0]); for (let i = -r; i <= r; i++) { const band = (i + j + ft * 2) % 6; px(X, y + i, band < 2 ? P[4] : band < 4 ? P[3] : P[2]); } }
      ctx.globalAlpha = .5 * fade; for (let i = 0; i < 3; i++) afLine(x - dir * 4, y + (i - 1) * w * .8, x - dir * (14 + i * 4), y + (i - 1) * w, P[3], 1); ctx.globalAlpha = 1; break;
    }
    // A shine sweeping across a w×h box standing on (x,y): the steel glint of Metal Claw, Iron Head, Flash Cannon.
    case 'aGlint': {
      const w = s.w, h = s.h, p = lerp(-w * .8, w * .8, easeInOut(k)); ctx.save(); ctx.beginPath(); ctx.rect(afR(x - w / 2), afR(y - h), afR(w), afR(h)); ctx.clip();
      ctx.globalAlpha = .75 * fade; afLine(x + p - h * .35, y, x + p + h * .35, y - h, '#ffffff', 3); ctx.globalAlpha = .45 * fade; afLine(x + p + 6 - h * .35, y, x + p + 6 + h * .35, y - h, '#ffffff', 1); ctx.restore(); ctx.globalAlpha = 1; break;
    }
    // Sunlight gathering on (x,y) for Solar Beam: rays reaching down from the top of the field, a sun disc above.
    case 'aSun': {
      const top = s.top + oy, reach = easeIn(Math.min(1, k / .8)); ctx.globalAlpha = .55 * fade; for (let i = 0; i < 7; i++) { const sx = x + (i - 3) * s.w, y1 = lerp(top, y, reach); afLine(sx, top, lerp(sx, x, reach), y1, i % 2 ? P[3] : P[4], 2); }
      ctx.globalAlpha = fade; afDot(x, top + 4, 5 + (ft % 2), P[3]); afDot(x, top + 4, 3, P[4]); ctx.globalAlpha = 1; break;
    }
    // Fire Blast's signature: the flame spreads into the five arms of 大 on the target, then burns up and away.
    case 'aKanji': {
      const g = easeOutBack(Math.min(1, k / .2), 1.6), rise = k > .6 ? (k - .6) * 30 : 0, S = s.size, arms = [[-Math.PI / 2, .5], [Math.PI, .9], [0, .9], [Math.PI * .72, 1], [Math.PI * .28, 1]];
      for (let pass = 0; pass < 4; pass++) for (const [a, l] of arms) { const L = S * l * g; for (let d = 0; d <= L; d += 2) { const f = d / Math.max(1, L), r = s.w * (1 - f * .45) * (.8 + Rf() * .4), X = x + Math.cos(a) * d + (Rf() - .5) * 2, Y = y + Math.sin(a) * d - rise * (1 - f * .3);
        if (pass === 0) afDot(X, Y, r + 1, P[1]); else if (pass === 1) afDot(X, Y - r * .2, r * .72, P[2]); else if (pass === 2) afDot(X, Y - r * .3, r * .42, P[3]); else if (f < .35) afDot(X, Y - r * .3, r * .2, P[4]); } }
      ctx.globalAlpha = 1; break;
    }
    // A twinkle: a four-point star breathing in size.
    case 'aSparkle': { const r = afR(s.size * (.45 + .55 * Math.abs(Math.sin(s.t * 12 + s.seed)))); afStar(x, y, r, (ft + s.seed) % 4 < 2 ? P[3] : P[4], '#ffffff'); ctx.globalAlpha = 1; break; }
    // An aura of rising tongues round a w×h box standing on (x,y) (a power-up, Outrage's rage, a Ghost's chill).
    case 'aAura': {
      const n = s.n || 9, w = s.w, h = s.h, a0 = k < .15 ? k / .15 : 1; for (let i = 0; i < n; i++) { const ph = (s.t * (s.speed || 2.4) + i * .37 + (s.seed % 10) * .1) % 1, bx = x + ((i + .5) / n - .5) * w + Math.sin(s.t * 6 + i) * 2, base = y - h * .15 * Math.abs(Math.sin(i * 1.7)), top = base - h * (.25 + .75 * ph) * .9, sway = Math.sin(s.t * 9 + i) * 3;
        ctx.globalAlpha = (1 - ph) * .85 * fade * a0; afLine(bx, base, bx + sway, top, i % 3 ? P[2] : P[3], 2); px(afR(bx + sway), afR(top), P[4]); }
      ctx.globalAlpha = 1; break;
    }
    // Psychic distortion: wavy rings breathing round (x,y).
    case 'aWarp': {
      const S = s.size; for (let i = 0; i < 3; i++) { const rr = S * (.3 + ((k * 1.8 + i / 3) % 1) * .7), col = i % 2 ? P[2] : P[3]; ctx.globalAlpha = fade * (1 - ((k * 1.8 + i / 3) % 1) * .6); ctx.fillStyle = col;
        for (let a = 0; a < 44; a++) { const ang = a / 44 * Math.PI * 2, r2 = rr + Math.sin(ang * 5 + s.t * 26 + i) * 2; ctx.fillRect(afR(x + Math.cos(ang) * r2), afR(y + Math.sin(ang) * r2 * .6), 1, 1); } }
      ctx.globalAlpha = 1; break;
    }
    // Crackling arcs inside a box round (x,y): electricity running over a Pokémon.
    case 'aShock': {
      const w = s.w, h = s.h; for (let i = 0; i < (s.n || 3); i++) { let X = x + (Rf() - .5) * w * 2, Y = y + (Rf() - .5) * h * 2; for (let m = 0; m < 3; m++) { const nx = X + (Rf() - .5) * 12, ny = Y + (Rf() - .5) * 12; afLine(X, Y, nx, ny, P[2], 2); afLine(X, Y, nx, ny, P[4], 1); X = nx; Y = ny; } }
      ctx.globalAlpha = 1; break;
    }
    // Lick: a long pink tongue curling out to the target and back.
    case 'aTongue': {
      const ex = s.ex + ox, ey = s.ey + oy, ext = k < .4 ? easeOut(k / .4) : k < .58 ? 1 : 1 - easeIn((k - .58) / .42), pts = afCurve(x, y, (x + ex) / 2, Math.max(y, ey) + 10, ex, ey, ext, 1), W = s.w || 3;
      for (const [a, b] of pts) afDot(a, b, W / 2 + 1, '#5a1030'); for (const [a, b] of pts) afDot(a, b, W / 2, '#ff7aa8'); for (const [a, b] of pts) px(afR(a), afR(b) - 1, '#ffd0e0'); if (pts.length) { const [a, b] = pts[pts.length - 1]; afDot(a, b, W / 2 + 2, '#5a1030'); afDot(a, b, W / 2 + 1, '#ff7aa8'); px(afR(a) - 1, afR(b) - 1, '#ffffff'); }
      ctx.globalAlpha = 1; break;
    }
    // A horn of light at the attacker's front (Megahorn), riding the charge.
    case 'aHorn': {
      const L = s.size, w = s.w || 5, dir = s.dir; ctx.globalAlpha = .4 * fade; afDot(x + dir * L, y, 5 + (ft % 2), P[3]); ctx.globalAlpha = fade;
      for (let j = 0; j < L; j++) { const r = afR(w * (1 - j / L)), X = afR(x + dir * j); rect(X, y - r - 1, 1, 2 * r + 2, P[0]); rect(X, y - r, 1, 2 * r + 1, P[3]); px(X, y - r, P[4]); } ctx.globalAlpha = 1; break;
    }
    // A charge: an orb swelling at (x,y) with rays turning round it (Hyper Beam, Solar Beam, Shadow Ball...).
    case 'aCharge': {
      const r = afR(s.size * easeOut(Math.min(1, k / .85)) + Math.sin(s.t * 40) * .8); if (r < 1) break; ctx.globalAlpha = .35 * fade; afDot(x, y, r + 4, P[2]); ctx.globalAlpha = fade; afDot(x, y, r + 1, P[2]); afDot(x, y, r, P[3]); afDot(x, y, r * .5, P[4]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + s.t * 7, r1 = r + 3, r2 = r + 5 + (Rf() * 4 | 0); afLine(x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a) * r2, y + Math.sin(a) * r2, P[3], 1); } ctx.globalAlpha = 1; break;
    }
    // Bubbles and leaves in flight (on their tx/ty path): a round bubble that pops at the end; a razor leaf spinning.
    case 'aBubble': { const r = Math.max(1, afR(s.size)), X = x + afR(Math.sin(s.t * 14 + s.seed) * 2); if (k > .93) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .6; afLine(X + Math.cos(a) * r, y + Math.sin(a) * r, X + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), P[4], 1); } break; }
      ctx.globalAlpha = .3 * fade; afDot(X, y, r, P[3]); ctx.globalAlpha = fade; afRing(X, y, r, 1, P[2]); px(X - afR(r * .45), y - afR(r * .45), P[4]); if (r > 2) px(X - afR(r * .45) + 1, y - afR(r * .45), P[4]); ctx.globalAlpha = 1; break; }
    // A razor leaf: a pointed lens (|v| <= b(1 - (u/a)²)) spinning at any angle, outlined, its lit half and midrib.
    case 'aLeaf': {
      const a = s.size || 5, b = a * .45, th = (s.rot || 0) + s.t * (s.spin || 16), ca = Math.cos(th), sa = Math.sin(th), n = Math.ceil(a + 1);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const u = i * ca + j * sa, v = -i * sa + j * ca, au = Math.abs(u), av = Math.abs(v);
        if (au <= a && av <= b * (1 - (u / a) * (u / a))) { ctx.fillStyle = av < .55 && au < a - 1.2 ? P[4] : v < 0 ? P[3] : P[2]; ctx.fillRect(x + i, y + j, 1, 1); }
        else if (au <= a + 1 && av <= (b + 1) * (1 - (u / (a + 1)) * (u / (a + 1)))) { ctx.fillStyle = P[0]; ctx.fillRect(x + i, y + j, 1, 1); } }
      ctx.globalAlpha = 1; break;
    }
    // A streak of wind or snow blown along (vx, vy): a line trailing behind the head.
    case 'aStreak': { const L = s.size, v = Math.hypot(s.vx, s.vy) || 1; ctx.globalAlpha = fade * (s.alpha || .8); afLine(x - s.vx / v * L, y - s.vy / v * L, x, y, P[3], 1); px(afR(x), afR(y), P[4]); ctx.globalAlpha = 1; break; }
    // A flake of snow tumbling along.
    case 'aFlake': { const f = (ft + s.seed) % 2; ctx.fillStyle = P[4]; if (s.size > 1) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); if (f) { ctx.fillStyle = P[3]; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); } } else ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; break; }
    // A splat of goo or mud left on the ground, spreading and drying.
    case 'aSplat': { const r = s.size * easeOut(Math.min(1, k / .15)); ctx.globalAlpha = fade * .9; ellipse(x, y, afR(r) + 1, afR(r * .32) + 1, P[0]); ellipse(x, y, afR(r), afR(r * .32), P[1]); ellipse(x - afR(r * .2), y - 1, afR(r * .5), afR(r * .15), P[2]); ctx.globalAlpha = 1; break; }
  }
}

// ---------------------------------------------------------------- the strike context
// c = { S: size factor (1 in the scene, ~.36 on the board), board, ax, ay: where the attack leaves the attacker (its
// front, chest high), tx, ty: the defender's chest, ex, ey: where the travel ends (past the target on a miss),
// ux, uy: the unit vector attacker → defender, dir: ±1 its horizontal sense, A/D: feet of both (x, y), gy: the
// defender's ground line, gyA: the attacker's, top: the sky above the defender, H: sprite height, dur: travel time,
// wt: wind-up time, rate: how much faster the scene clock runs than the effects (scene sprites divide by it),
// pal, type, move, e: the hit event, miss, fol(unit): a function giving that unit's live offset (to ride a lunge) }
function afN(c, n) { return Math.max(1, Math.round(n * (REDUCED ? .35 : 1) * (c.board ? .55 : 1))); }
function afT(c, t) { return t / (c.rate || 1); }
function afParts(c, x, y, n, cols, o = {}) { spawnParts(x, y, afN(c, n), cols, Object.assign({}, o, { speed: (o.speed || 60) * c.S ** .7, size: o.size ? Math.max(1, Math.round(o.size * (c.board ? .6 : 1))) : c.board ? 2 : 3 })); }
// Sparks converging on (x,y): the charge of a special move.
function afGather(c, x, y, dur, cols, n = 12, r = 42, kind = 'spark') { for (let i = 0; i < afN(c, n); i++) { const a = i / n * Math.PI * 2 + vrnd() * .6, rr = r * c.S * (.75 + vrnd() * .5); afS(kind, x + Math.cos(a) * rr, y + Math.sin(a) * rr * .75, { tx: x, ty: y, life: afT(c, dur * (.75 + vrnd() * .25)), col: cols[i % cols.length], col2: cols[(i + 1) % cols.length], size: kind === 'flame' ? Math.max(1, afR(3 * c.S)) : undefined, delay: afT(c, i * dur * .025), pal: c.pal }); } }
// The shaped burst every hit gets: a star in the type's colour with a white heart, a flash, a ring.
function afBurst(c, x, y, size = 20, o = {}) { const S = c.S, P = c.pal; spawnSprite('impact', x, y, { size: Math.round(size * S), life: .3, col: o.col || P[2], rot: vrnd() * 3 }); spawnSprite('impact', x, y, { size: Math.round(size * .55 * S), life: .2, col: '#ffffff', rot: vrnd() * 3, delay: .02 }); if (!o.noFlash) spawnSprite('flash', x, y, { size: Math.round(10 * S) + 2, life: .14, col: '#ffffff' }); if (o.ring !== false) spawnSprite('ring', x, y, { size: Math.round(size * 1.4 * S), life: .4, col: o.ringCol || P[3], delay: .03 }); }
function afSlashFx(c, x, y, o) { return afS('aSlash', x, y, Object.assign({ life: .42, pal: c.pal, th: Math.max(1, afR((o.th || 4) * (c.board ? .6 : 1))) }, o)); }
// Dust kicked from the feet at (x,y), thrown away from the attacker.
function afDust(c, x, y, n = 4, col = '#d8d0b8') { for (let i = 0; i < afN(c, n); i++) spawnSprite('poof', x + c.dir * (4 + i * 6) * c.S, y, { size: Math.max(2, Math.round((3 + (i % 2) * 2) * c.S)), life: .42, col, col2: '#f4f0e0', vx: c.dir * (30 + i * 10) * c.S, vy: -8, delay: i * .03 }); }
function afShake(c, n) { if (!REDUCED) shake(Math.max(1, Math.round(n * (c.board ? .7 : 1)))); }

// ---------------------------------------------------------------- the choreographies
// Each style: pose (the attacker's move in the scene: lunge, cast, leap, burrow, stomp, rush), windup (s), travel (s),
// board (the board strike's length, as a factor), and three acts: charge(c), go(c), hit(c). `react` is how the defender
// takes it in the scene (lift, shock, burn, chill, crush, wobble).
const ATK = {};
// Contact: a crouch and a glint, the lunge's speed lines, and the style's own flourish on the hit.
function afContactCharge(c, glint = true) { const S = c.S; for (let i = 0; i < afN(c, 3); i++) spawnSprite('poof', c.A.x - c.dir * (6 + i * 6) * S, c.gyA, { size: Math.max(2, Math.round((4 + i) * S)), life: .35, col: '#d8d0b8', col2: '#f4f0e0', vx: -c.dir * (18 + i * 8) * S, vy: -6, delay: i * .04 }); if (glint) afS('aSparkle', c.ax - c.dir * 4 * S, c.ay - 6 * S, { life: afT(c, c.wt * .9), size: Math.max(2, afR(5 * S)), pal: c.pal, delay: afT(c, c.wt * .3), follow: c.fol(c.att) }); }
function afLunge(c) { if (c.board) return; for (let i = 0; i < afN(c, 3); i++) spawnSprite('speed', c.A.x - c.dir * 20, c.ay + 6 - i * 6, { size: 30, life: afT(c, c.dur + .12), col: '#ffffff', dir: c.dir, delay: i * .04 }); spawnSprite('poof', c.A.x - c.dir * 10, c.gyA, { size: 6, life: .35, col: '#d8d0b8', col2: '#f4f0e0', vx: -c.dir * 30 }); }
// Special: sparks of the type gather at the mouth while it glows.
function afSpecialCharge(c, n = 12, orb = 0) { afGather(c, c.ax, c.ay, c.wt, [c.pal[2], c.pal[3], c.pal[4]], n, 44); if (orb) afS('aCharge', c.ax, c.ay, { life: afT(c, c.wt + .06), size: orb * c.S, pal: c.pal, follow: c.fol(c.att) }); }

// ---- Normal
ATK.tackle = { pose: 'lunge', charge: c => afContactCharge(c, false), go: afLunge, hit: c => { afBurst(c, c.tx, c.ty, 22); spawnSprite('ring', c.D.x, c.gy - 2, { size: Math.round(26 * c.S), life: .45, col: '#f4eee0' }); afDust(c, c.D.x, c.gy, 5); afParts(c, c.tx, c.ty, 12, ['#ffffff', '#f4eee0', '#ffe9a0'], { speed: 110, life: .5, grav: 150 }); afShake(c, 4); }, react: 'crush' };
// Three claw cuts raking down across the body, a hair apart in time.
function afClaws(c, th = 3, pal = c.pal) { const S = c.S; for (let i = 0; i < 3; i++) afSlashFx(c, c.tx + (i - 1) * 8 * S * c.dir, c.ty + (i - 1) * 2 * S, { style: 'line', lx0: -c.dir * 15 * S, ly0: -22 * S, lx1: c.dir * 11 * S, ly1: 18 * S, th, sweep: .13, life: .5, delay: i * .035, pal }); }
ATK.scratch = { pose: 'lunge', charge: c => afContactCharge(c), go: afLunge, sfx: 'claw', hit: c => { afBurst(c, c.tx, c.ty, 14, { ring: false }); afClaws(c, 3); afParts(c, c.tx, c.ty, 10, ['#ffffff', '#f4eee0'], { speed: 90, life: .4, grav: 100 }); afShake(c, 3); } };
ATK.slam = { pose: 'leap', travel: .26, board: 1.25, charge: c => { afContactCharge(c, false); afShake(c, 1); }, go: c => { if (!c.board) for (let i = 0; i < afN(c, 4); i++) spawnSprite('wind', c.A.x - c.dir * 6, c.gyA - 10 - i * 12, { size: 16, life: .3, col: '#ffffff', vy: -60, delay: i * .03 }); },
  hit: c => { const S = c.S; afBurst(c, c.tx, c.ty + 10 * S, 26, { ring: false }); for (let i = 0; i < 2; i++) spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round((34 + i * 16) * S), life: .5 + i * .1, col: i ? '#d8d0b8' : '#ffffff', delay: i * .06 }); for (const d of [-1, 1]) for (let i = 0; i < afN(c, 3); i++) spawnSprite('poof', c.D.x + d * (12 + i * 9) * S, c.gy - 2, { size: Math.max(2, Math.round((6 - i) * S)), life: .6, col: '#d8d0b8', col2: '#f4f0e0', vx: d * (50 + i * 20) * S, vy: -14, delay: .02 + i * .03 }); afShake(c, 7); }, react: 'crush' };
ATK.hyperbeam = { pose: 'cast', windup: .44, travel: .34, board: 1.35, sfx: 'beam', focus: .5,
  charge: c => { atkSfx('beamcharge'); afSpecialCharge(c, 18, 7); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt), w: 60, h: 80, pal: ATK_PAL.Fire, n: 10, speed: 3, follow: c.fol(c.att) }); },
  go: c => { const S = c.S, P = ['#3a1a04', '#ff8a1a', '#ffc040', '#fff4b0', '#ffffff']; afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .42), w: Math.max(2, afR(8 * S)), pal: P, style: 'light', grow: .28, hold: .72 }); afShake(c, 4); if (!c.board) flashScreen('#fff4c8', .35); },
  hit: c => { const S = c.S; for (let i = 0; i < afN(c, 3); i++) spawnSprite('boom', c.tx + (i - 1) * 12 * S, c.ty - (i % 2) * 10 * S, { size: Math.round((14 + i * 3) * S), life: .7, rot: i * 2.1, delay: .05 + i * .07 }); afBurst(c, c.tx, c.ty, 30, { col: '#ffc040' }); afParts(c, c.tx, c.ty, 24, ['#ffffff', '#ffc040', '#ff8a1a'], { speed: 160, life: .7, grav: 90 }); afShake(c, 8); } };

// ---- Fire
function afFireHit(c, n = 8, spread = 26) { const S = c.S, P = c.pal; for (let i = 0; i < afN(c, n); i++) spawnSprite('flame', c.tx + (vrnd() - .5) * spread * S, c.ty + 10 * S + (vrnd() - .5) * 12 * S, { size: Math.max(1, Math.round((2 + vrnd() * 3) * S * 1.3)), life: .45 + vrnd() * .35, col: P[3], col2: P[1], vy: -40 - vrnd() * 40, vx: (vrnd() - .5) * 20, delay: vrnd() * .18 }); for (let i = 0; i < afN(c, 2); i++) spawnSprite('smoke', c.tx + (i ? 8 : -8) * S, c.ty - 10 * S, { size: Math.max(2, Math.round(5 * S)), life: 1, col: '#5e5866', col2: '#a8a2b0', vy: -20, vx: i ? 6 : -6, delay: .25 + i * .1 }); afParts(c, c.tx, c.ty, 10, [P[3], P[2], P[4]], { speed: 70, life: .7, grav: -60 }); }
ATK.ember = { pose: 'cast', sfx: 'fire', charge: c => { afSpecialCharge(c, 10); afGather(c, c.ax, c.ay, c.wt, [c.pal[2], c.pal[3]], 5, 30, 'flame'); },
  go: c => { const S = c.S; for (let i = 0; i < 3; i++) { const sp = (i - 1) * 7 * S; afS('aOrb', c.ax, c.ay + sp * .3, { tx: c.ex + (vrnd() - .5) * 8 * S, ty: c.ey + sp, life: afT(c, c.dur * (.72 + i * .14)), arc: (6 + i * 5) * S, size: Math.max(2, afR(4 * S)), pal: c.pal, style: 'fire', delay: afT(c, c.dur * i * .12) }); } },
  hit: c => { const S = c.S; for (let i = 0; i < 3; i++) spawnSprite('blast', c.tx + (i - 1) * 9 * S, c.ty + ((i % 2) * 6 - 3) * S, { size: Math.round(12 * S), life: .45, col: c.pal[1], col2: c.pal[3], delay: i * .05 }); afFireHit(c, 7, 22); afShake(c, 3); }, react: 'burn' };
ATK.flamethrower = { pose: 'cast', travel: .3, sfx: 'fire', charge: c => { afSpecialCharge(c, 14, 4); },
  go: c => { const S = c.S; afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .4), w: Math.max(2, afR(7 * S)), pal: c.pal, style: 'fire', grow: .42, hold: .74 }); for (let i = 0; i < afN(c, 8); i++) spawnSprite('flame', c.ax, c.ay, { tx: c.ex + (vrnd() - .5) * 20 * S, ty: c.ey - 10 * S - vrnd() * 16 * S, life: afT(c, c.dur + vrnd() * .2), arc: 4, size: Math.max(1, afR(2 * S)), col: c.pal[3], col2: c.pal[1], delay: afT(c, i * .04) }); },
  hit: c => { const S = c.S; spawnSprite('blast', c.tx, c.ty, { size: Math.round(24 * S), life: .55, col: c.pal[1], col2: c.pal[3] }); if (!c.board) afS('aAura', c.D.x, c.gy, { life: .75, w: 46, h: 70, pal: c.pal, n: 11, speed: 2.8 }); afFireHit(c, 12, 34); afShake(c, 5); }, react: 'burn' };
ATK.fireblast = { pose: 'cast', windup: .34, travel: .32, board: 1.25, sfx: 'fire', focus: .45, charge: c => { afSpecialCharge(c, 16, 6); if (!c.board) flashScreen('#ff9a40', .12); },
  go: c => { afS('aOrb', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 8 * c.S, size: Math.max(3, afR(9 * c.S)), pal: c.pal, style: 'fire' }); },
  hit: c => { const S = c.S; atkSfx('blast'); afS('aKanji', c.tx, c.ty - 2 * S, { life: .95, size: afR(40 * S), w: Math.max(2, 6 * S), pal: c.pal }); spawnSprite('boom', c.tx, c.ty, { size: Math.round(16 * S), life: .7, rot: 1 }); afFireHit(c, 16, 44); if (!c.board) flashScreen('#ffb060', .4); afShake(c, 8); }, react: 'burn' };

// ---- Water
function afSplash(c, x, y, n = 14, big = 1) { const S = c.S, P = c.pal; for (let i = 0; i < afN(c, n); i++) { const a = -Math.PI / 2 + (vrnd() - .5) * 2.4, sp = (60 + vrnd() * 90) * S * big; spawnSprite('drop', x, y, { life: .55 + vrnd() * .25, col: vrnd() < .5 ? P[2] : P[3], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30 * S, grav: 420 * S + 60 }); } spawnSprite('ring', x, y + 10 * S, { size: Math.round(26 * S * big), life: .45, col: P[4] }); spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round(30 * S * big), life: .6, col: P[3], delay: .08 }); }
ATK.watergun = { pose: 'cast', sfx: 'water', charge: c => afGather(c, c.ax, c.ay, c.wt, [c.pal[3], c.pal[4], c.pal[2]], 10, 36, 'drop'),
  go: c => afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .28), w: Math.max(1, afR(3 * c.S)), pal: c.pal, style: 'water', grow: .5, hold: .72 }),
  hit: c => { afBurst(c, c.tx, c.ty, 14, { ring: false, col: c.pal[3] }); afSplash(c, c.tx, c.ty, 14); afShake(c, 3); } };
ATK.bubblebeam = { pose: 'cast', sfx: 'bubbles', charge: c => { for (let i = 0; i < afN(c, 5); i++) afS('aBubble', c.ax + (vrnd() - .5) * 20 * c.S, c.ay + (vrnd() - .5) * 20 * c.S, { vx: 0, vy: -10, life: afT(c, c.wt), size: 2 + (i % 3), pal: c.pal, delay: afT(c, i * .04) }); },
  go: c => { const S = c.S; for (let i = 0; i < afN(c, 16); i++) afS('aBubble', c.ax, c.ay, { tx: c.ex + (vrnd() - .5) * 20 * S, ty: c.ey + (vrnd() - .5) * 24 * S, life: afT(c, c.dur * (.55 + vrnd() * .45)), arc: (vrnd() - .3) * 12 * S, size: Math.max(1, afR((2.5 + vrnd() * 4) * S)), pal: c.pal, delay: afT(c, i * c.dur * .03) }); },
  hit: c => { const S = c.S; for (let i = 0; i < afN(c, 10); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 30 * S, c.ty + (vrnd() - .5) * 26 * S, { life: .3, size: Math.max(1, afR(3 * S)), pal: c.pal, delay: vrnd() * .15 }); afSplash(c, c.tx, c.ty, 10, .8); afBurst(c, c.tx, c.ty, 14, { col: c.pal[3], ring: false }); afShake(c, 3); } };
ATK.surf = { pose: 'cast', windup: .3, travel: .42, board: 1.3, sfx: 'splash', charge: c => { const S = c.S; for (let i = 0; i < afN(c, 10); i++) spawnSprite('drop', c.A.x + (vrnd() - .5) * 50 * S, c.gyA - vrnd() * 8, { vy: -60 - vrnd() * 60, vx: 0, grav: 160, life: afT(c, c.wt), col: c.pal[3], delay: afT(c, i * .02) }); },
  go: c => { const S = c.S; if (c.board) { afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .2), w: Math.max(2, afR(9 * S)), pal: c.pal, style: 'water', grow: .6, hold: .7 }); return; } const ph = c.stacked; afS('aWave', 0, 0, { fx0: ph ? c.D.x - c.dir * 150 : c.A.x - c.dir * 30, fx1: c.D.x + c.dir * 8, gy: (ph ? c.gy : Math.max(c.gy, c.gyA)) + 2, h: ph ? 64 : 78, len: ph ? 90 : 110, dir: c.dir, life: afT(c, c.dur + .3), go: c.dur / (c.dur + .3), pal: c.pal }); },
  hit: c => { afSplash(c, c.tx, c.ty - 6 * c.S, 22, 1.3); afBurst(c, c.tx, c.ty, 20, { col: c.pal[3], ring: false }); afShake(c, 6); }, react: 'crush' };
ATK.hydropump = { pose: 'cast', windup: .32, travel: .3, sfx: 'splash', charge: c => { for (let i = 0; i < afN(c, 12); i++) spawnSprite('drop', c.ax, c.ay, { orbit: { r: 22 * c.S, speed: 12, a0: i / 12 * Math.PI * 2, shrink: true, squash: .7 }, life: afT(c, c.wt), col: c.pal[3], delay: afT(c, i * .012) }); afSpecialCharge(c, 8, 4); },
  go: c => { afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .42), w: Math.max(2, afR(8 * c.S)), pal: c.pal, style: 'water', grow: .38, hold: .76 }); afShake(c, 2); },
  hit: c => { afSplash(c, c.tx, c.ty, 26, 1.5); afBurst(c, c.tx, c.ty, 24, { col: c.pal[3] }); afShake(c, 6); }, react: 'crush' };

// ---- Grass
function afLeafBurst(c, x, y, n = 10) { const S = c.S, P = c.pal; for (let i = 0; i < afN(c, n); i++) { const a = vrnd() * Math.PI * 2, sp = (40 + vrnd() * 60) * S; spawnSprite('leaf', x, y, { life: .6 + vrnd() * .4, col: P[1], col2: P[3], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30 * S, grav: 80, rot: vrnd() * 4, spin: 8 + vrnd() * 10 }); } }
ATK.vinewhip = { pose: 'cast', sfx: 'whip', charge: c => { for (const s2 of [-1, 1]) afS('aVine', c.A.x, c.ay + s2 * 8 * c.S, { ex: c.A.x + c.dir * 18 * c.S, ey: c.ay - 14 * c.S + s2 * 6 * c.S, life: afT(c, c.wt), w: Math.max(1, afR(2 * c.S)), bend: 10 * c.S, pal: c.pal }); },
  go: c => { for (const s2 of [-1, 1]) afS('aVine', c.ax, c.ay + s2 * 6 * c.S, { ex: c.ex, ey: c.ey + s2 * 8 * c.S, life: afT(c, c.dur / .42), w: Math.max(1, afR(3 * c.S)), bend: (26 + s2 * 8) * c.S, pal: c.pal }); },
  hit: c => { const S = c.S; afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: -14 * S, ly0: -14 * S, lx1: 14 * S, ly1: 12 * S, th: 3, sweep: .15, pal: c.pal }); afBurst(c, c.tx, c.ty, 14, { col: c.pal[3], ring: false }); afLeafBurst(c, c.tx, c.ty, 8); afShake(c, 3); } };
ATK.razorleaf = { pose: 'cast', sfx: 'grass', charge: c => { for (let i = 0; i < afN(c, 8); i++) afS('aLeaf', c.A.x, c.ay, { orbit: { r: 30 * c.S, speed: 10, a0: i / 8 * Math.PI * 2, squash: .5 }, life: afT(c, c.wt), pal: c.pal, delay: afT(c, i * .01) }); },
  go: c => { const S = c.S; for (let i = 0; i < afN(c, 10); i++) afS('aLeaf', c.ax, c.ay + (vrnd() - .5) * 20 * S, { tx: c.ex + (vrnd() - .5) * 16 * S, ty: c.ey + (vrnd() - .5) * 26 * S, life: afT(c, c.dur * (.65 + vrnd() * .35)), arc: (vrnd() - .5) * 26 * S, pal: c.pal, delay: afT(c, i * c.dur * .04) }); },
  hit: c => { const S = c.S; for (let i = 0; i < afN(c, 4); i++) afSlashFx(c, c.tx + (vrnd() - .5) * 18 * S, c.ty + (vrnd() - .5) * 20 * S, { style: 'line', lx0: -9 * S, ly0: (vrnd() - .5) * 10 * S, lx1: 9 * S, ly1: (vrnd() - .5) * 10 * S, th: 2, sweep: .12, life: .3, delay: i * .04, pal: c.pal }); afLeafBurst(c, c.tx, c.ty, 10); afShake(c, 3); } };
ATK.gigadrain = { pose: 'cast', sfx: 'absorb', ownDrain: true, charge: c => { afSpecialCharge(c, 12); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt), w: 56, h: 70, pal: c.pal, n: 8, speed: 2, follow: c.fol(c.att) }); },
  go: c => { afS('aWarp', c.tx, c.ty, { life: afT(c, c.dur + .55), size: 46 * c.S, pal: c.pal }); for (let i = 0; i < 3; i++) spawnSprite('psy', c.tx, c.ty, { size: Math.round((40 - i * 10) * c.S), life: afT(c, c.dur), col: c.pal[2], col2: c.pal[3], delay: afT(c, i * c.dur / 4) }); for (let i = 0; i < afN(c, 14); i++) spawnSprite('spark', c.tx + (vrnd() - .5) * 60 * c.S, c.ty + (vrnd() - .5) * 60 * c.S, { tx: c.tx, ty: c.ty, life: afT(c, c.dur), col: i % 2 ? c.pal[3] : c.pal[4], delay: afT(c, i * .015) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 18, { col: c.pal[3] }); for (let i = 0; i < afN(c, 8); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 30 * c.S, c.ty + (vrnd() - .5) * 30 * c.S, { life: .4, size: 3, pal: c.pal, delay: vrnd() * .15 }); atkDrainFx(c); afShake(c, 2); }, drainPal: 'Grass' };
ATK.solarbeam = { pose: 'cast', windup: .46, travel: .32, board: 1.35, sfx: 'beam', focus: .4,
  charge: c => { atkSfx('beamcharge'); const P = ['#3a3a00', '#c8c020', '#fff060', '#fffcc0', '#ffffff']; if (!c.board) afS('aSun', c.ax, c.ay, { life: afT(c, c.wt + .05), top: c.top, w: 16, pal: P }); afGather(c, c.ax, c.ay, c.wt, ['#fff060', '#ffffff', '#b0e878'], 16, 50); afS('aCharge', c.ax, c.ay, { life: afT(c, c.wt + .06), size: 7 * c.S, pal: P, follow: c.fol(c.att) }); },
  go: c => { const P = ['#2a4a08', '#a8e040', '#e8ff90', '#fffff0', '#ffffff']; afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .42), w: Math.max(2, afR(8 * c.S)), pal: P, style: 'light', grow: .3, hold: .74 }); afShake(c, 3); if (!c.board) flashScreen('#f8ffd0', .3); },
  hit: c => { const S = c.S; afBurst(c, c.tx, c.ty, 30, { col: '#e8ff90' }); for (let i = 0; i < afN(c, 12); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 44 * S, c.ty + (vrnd() - .5) * 40 * S, { life: .5, size: Math.max(1, afR(4 * S)), pal: ['#2a4a08', '#a8e040', '#fff060', '#fffcc0', '#ffffff'], delay: vrnd() * .2 }); afLeafBurst(c, c.tx, c.ty, 6); afShake(c, 7); } };

// ---- Electric
function afShockOn(c, x, y, life = .5, n = 3) { afS('aShock', x, y, { life, w: 22 * c.S, h: 26 * c.S, n: afN(c, n), pal: c.pal }); }
ATK.thundershock = { pose: 'cast', travel: .2, sfx: 'zap', charge: c => { afShockOn(c, c.A.x, c.gyA - c.H * .5, afT(c, c.wt), 2); afGather(c, c.ax, c.ay, c.wt, [c.pal[2], c.pal[4]], 8, 30); },
  go: c => { for (let i = 0; i < 2; i++) afS('aBolt', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .12), w: Math.max(1, afR(2 * c.S)), jit: 7 * c.S, pal: c.pal, flick: true, forks: 1, delay: afT(c, i * .07) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[2] }); afShockOn(c, c.tx, c.ty, .55, 3); afParts(c, c.tx, c.ty, 10, [c.pal[2], '#ffffff'], { speed: 110, life: .35, grav: 0 }); afShake(c, 3); }, react: 'shock' };
ATK.thunderbolt = { pose: 'cast', travel: .22, sfx: 'elec', charge: c => { afShockOn(c, c.A.x, c.gyA - c.H * .5, afT(c, c.wt), 4); afSpecialCharge(c, 12, 4); if (!c.board) spawnSprite('flash', c.ax, c.ay, { size: 14, life: afT(c, .15), col: c.pal[3], delay: afT(c, c.wt * .8) }); },
  go: c => { afS('aBolt', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .2), w: Math.max(2, afR(4 * c.S)), jit: 10 * c.S, pal: c.pal, flick: true, forks: 3 }); for (const s2 of [-1, 1]) afS('aBolt', c.ax, c.ay + s2 * 6 * c.S, { ex: c.ex, ey: c.ey + s2 * 14 * c.S, life: afT(c, c.dur + .1), w: 1, jit: 9 * c.S, pal: c.pal, flick: true, forks: 0, delay: afT(c, .05) }); if (!c.board) flashScreen('#fff7a0', .2); },
  hit: c => { afBurst(c, c.tx, c.ty, 24, { col: c.pal[2] }); spawnSprite('ring', c.tx, c.ty, { size: Math.round(34 * c.S), life: .35, col: c.pal[2] }); afShockOn(c, c.tx, c.ty, .7, 4); afParts(c, c.tx, c.ty, 16, [c.pal[2], c.pal[3], '#ffffff'], { speed: 150, life: .4, grav: 0 }); afShake(c, 5); }, react: 'shock' };
ATK.thunder = { pose: 'cast', windup: .36, travel: .24, board: 1.3, sfx: 'thunder', focus: .62, focusCol: '#05081a',
  charge: c => { atkSfx('rumble'); afS('aCloud', c.tx, c.top + 10 * c.S, { life: afT(c, c.wt + c.dur + .5), w: 34 * c.S, pal: c.pal }); afShockOn(c, c.A.x, c.gyA - c.H * .5, afT(c, c.wt), 2); },
  go: c => { const S = c.S; afS('aBolt', c.ex + (vrnd() - .5) * 6 * S, c.top + 12 * S, { ex: c.ex, ey: c.gy - 4 * S, life: afT(c, c.dur + .3), w: Math.max(2, afR(6 * S)), jit: 14 * S, pal: c.pal, flick: true, forks: 3, delay: afT(c, c.dur * .5) }); if (!c.board) spawnSprite('flash', c.ex, c.top + 14, { size: 18, life: .2, col: '#ffffff', delay: afT(c, c.dur * .5) }); },
  hit: c => { const S = c.S; flashScreen('#ffffff', c.board ? .45 : .7); afBurst(c, c.tx, c.ty, 28, { col: c.pal[2] }); spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round(40 * S), life: .5, col: c.pal[3] }); afS('aSplat', c.D.x, c.gy, { life: 1.1, size: 18 * S, pal: ['#1a1408', '#2a2418', '#4a4030', '#fff7a0', '#fff'] }); afShockOn(c, c.tx, c.ty, .8, 5); afParts(c, c.tx, c.ty, 20, [c.pal[2], '#ffffff', c.pal[3]], { speed: 170, life: .45, grav: 60 }); afShake(c, 8); }, react: 'shock' };

// ---- Ice
function afIceHit(c, n = 5, big = 1) { const S = c.S, P = c.pal; for (let i = 0; i < afN(c, n); i++) afS('aSpike', c.D.x + (i - (n - 1) / 2) * 10 * S * big, c.gy, { life: .9, h: (24 + ((i * 7) % 3) * 10) * S * big, w: Math.max(3, 8 * S * big), style: 'ice', lean: (i - (n - 1) / 2) * .12, pal: P, delay: .03 * i }); for (let i = 0; i < afN(c, 10); i++) { const a = vrnd() * Math.PI * 2, sp = (50 + vrnd() * 50) * S; spawnSprite('shard', c.tx, c.ty, { life: .55, col: P[3], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 170, rot: vrnd() * 2, spin: 6, delay: .5 }); } }
ATK.iceshard = { pose: 'lunge', sfx: 'crack', charge: c => { for (let i = 0; i < afN(c, 4); i++) spawnSprite('shard', c.ax, c.ay, { orbit: { r: 16 * c.S, speed: 14, a0: i * 1.6, shrink: false, squash: .6 }, life: afT(c, c.wt), col: c.pal[3], rot: i, delay: afT(c, i * .02) }); },
  go: c => { for (let i = 0; i < afN(c, 5); i++) spawnSprite('shard', c.ax, c.ay + (i - 2) * 4 * c.S, { tx: c.ex, ty: c.ey + (i - 2) * 5 * c.S, life: afT(c, c.dur * (.7 + i * .075)), arc: (2 + i) * c.S, col: c.pal[3], rot: i, spin: 10 }); for (let i = 0; i < afN(c, 5); i++) afS('aSparkle', lerp(c.ax, c.ex, (i + 1) / 6), lerp(c.ay, c.ey, (i + 1) / 6) + (vrnd() - .5) * 8 * c.S, { life: afT(c, .3), size: 2, pal: c.pal, delay: afT(c, c.dur * i / 6) }); afLunge(c); },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[3] }); for (let i = 0; i < afN(c, 8); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 26 * c.S, c.ty + (vrnd() - .5) * 24 * c.S, { life: .35, size: 3, pal: c.pal, delay: vrnd() * .12 }); afParts(c, c.tx, c.ty, 10, [c.pal[3], '#ffffff'], { speed: 90, life: .45, grav: 120 }); afShake(c, 3); }, react: 'chill' };
ATK.icebeam = { pose: 'cast', sfx: 'freeze', charge: c => { afSpecialCharge(c, 12, 3); for (let i = 0; i < afN(c, 6); i++) afS('aFlake', c.A.x + (vrnd() - .5) * 50 * c.S, c.gyA - vrnd() * c.H, { vx: 0, vy: -14, life: afT(c, c.wt), size: 2, pal: c.pal, delay: afT(c, i * .03) }); },
  go: c => afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .36), w: Math.max(1, afR(3 * c.S)), pal: c.pal, style: 'ice', grow: .45, hold: .74 }),
  hit: c => { atkSfx('crack'); afBurst(c, c.tx, c.ty, 18, { col: c.pal[3] }); afIceHit(c, 4, 1); afShake(c, 4); }, react: 'chill' };
ATK.blizzard = { pose: 'cast', windup: .32, travel: .36, board: 1.25, sfx: 'wind', focus: .3, focusCol: '#dfe8ff',
  charge: c => { for (let i = 0; i < afN(c, 10); i++) afS('aFlake', c.A.x + (vrnd() - .5) * 60 * c.S, c.gyA - vrnd() * c.H, { vx: c.dir * 20, vy: -10, life: afT(c, c.wt), size: 2, pal: c.pal, delay: afT(c, i * .02) }); },
  go: c => { const S = c.S, dx = c.ex - c.ax, dy = c.ey - c.ay, L = Math.hypot(dx, dy) || 1, sp = L / c.dur * .9; for (let i = 0; i < afN(c, 70); i++) { const off = (vrnd() - .5) * 70 * S, x0 = c.ax - c.ux * vrnd() * 40 * S - c.uy * off, y0 = c.ay - c.uy * vrnd() * 40 * S + c.ux * off; afS(i % 3 ? 'aFlake' : 'aStreak', x0, y0, { vx: c.ux * sp * (.8 + vrnd() * .4), vy: c.uy * sp + (vrnd() - .5) * 30 * S, life: afT(c, c.dur * (.8 + vrnd() * .5)), size: i % 3 ? (vrnd() < .6 ? 2 : 1) : 14 * S, alpha: .9, pal: c.pal, delay: afT(c, vrnd() * c.dur * .6) }); } },
  hit: c => { atkSfx('crack'); afBurst(c, c.tx, c.ty, 24, { col: c.pal[3] }); afIceHit(c, 5, 1.2); for (let i = 0; i < afN(c, 16); i++) afS('aFlake', c.tx + (vrnd() - .5) * 60 * c.S, c.ty + (vrnd() - .5) * 50 * c.S, { vx: c.dir * 40, vy: 10, life: .7, size: 2, pal: c.pal, delay: vrnd() * .2 }); if (!c.board) flashScreen('#e8f4ff', .35); afShake(c, 6); }, react: 'chill' };

// ---- Fighting
function afPowerUp(c) { if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt + .08), w: 54, h: 70, pal: c.pal, n: 9, speed: 3.2, follow: c.fol(c.att) }); afContactCharge(c); }
function afPow(c, x, y, size = 24) { const S = c.S; afBurst(c, x, y, size, { col: c.pal[2] }); if (!c.board) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, r1 = size * .9, r2 = size * 1.5; afS('aSlash', x, y, { style: 'line', lx0: Math.cos(a) * r1, ly0: Math.sin(a) * r1, lx1: Math.cos(a) * r2, ly1: Math.sin(a) * r2, th: 1, life: .28, sweep: .15, pal: c.pal }); } }
ATK.chop = { pose: 'lunge', sfx: 'chop', charge: afPowerUp, go: afLunge, hit: c => { const S = c.S; afPow(c, c.tx, c.ty, 18); afSlashFx(c, c.tx + c.dir * 2 * S, c.ty, { style: 'line', lx0: c.dir * 6 * S, ly0: -36 * S, lx1: -c.dir * 4 * S, ly1: 24 * S, th: 6, sweep: .12, life: .5 }); afShake(c, 4); } };
ATK.brickbreak = { pose: 'lunge', sfx: 'chop', charge: afPowerUp, go: afLunge, hit: c => { const S = c.S; afPow(c, c.tx, c.ty, 20); afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: -c.dir * 24 * S, ly0: -28 * S, lx1: c.dir * 20 * S, ly1: 22 * S, th: 6, sweep: .12, life: .5 }); for (let i = 0; i < afN(c, 10); i++) { const a = vrnd() * Math.PI * 2, sp = (60 + vrnd() * 80) * S; spawnSprite('debris', c.tx, c.ty, { vx: Math.cos(a) * sp + c.dir * 40 * S, vy: Math.sin(a) * sp - 50 * S, grav: 400, floor: c.gy, life: 1, size: 3, col: '#c86a3a', col2: '#f0b080', rot: vrnd() * 4, spin: 12 }); } afShake(c, 5); } };
ATK.crosschop = { pose: 'lunge', sfx: 'chop', charge: afPowerUp, go: afLunge, hit: c => { const S = c.S; afPow(c, c.tx, c.ty, 22); afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: -24 * S, ly0: -26 * S, lx1: 24 * S, ly1: 24 * S, th: 6, sweep: .12, life: .55 }); afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: 24 * S, ly0: -26 * S, lx1: -24 * S, ly1: 24 * S, th: 6, sweep: .12, life: .55, delay: .07 }); spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round(36 * S), life: .45, col: c.pal[3] }); afShake(c, 6); }, react: 'crush' };

// ---- Poison
function afGoo(c, x, y, n = 10, big = 1) { const S = c.S, P = c.pal; for (let i = 0; i < afN(c, n); i++) { const a = -Math.PI / 2 + (vrnd() - .5) * 2.8, sp = (50 + vrnd() * 80) * S * big; spawnSprite('bubble', x, y, { size: 1 + (i % 3), life: .6 + vrnd() * .3, col: P[2], col2: P[3], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 300 * S + 60 }); } afS('aSplat', c.D.x, c.gy, { life: 1.2, size: 20 * S * big, pal: P, delay: .05 }); for (let i = 0; i < afN(c, 6); i++) spawnSprite('bubble', c.D.x + (vrnd() - .5) * 30 * S, c.gy - 4, { size: 1 + (i % 3), life: .7, col: P[3], col2: P[4], vy: -24 - vrnd() * 20, delay: .15 + vrnd() * .3 }); }
ATK.poisonsting = { pose: 'lunge', sfx: 'poison', charge: c => afContactCharge(c), go: c => { for (let i = 0; i < afN(c, 4); i++) afS('aNeedle', c.ax, c.ay + (i - 1.5) * 5 * c.S, { tx: c.ex, ty: c.ey + (i - 1.5) * 7 * c.S, life: afT(c, c.dur * (.7 + i * .1)), size: Math.max(4, afR(11 * c.S)), pal: c.pal, delay: afT(c, i * .02) }); afLunge(c); },
  hit: c => { for (let i = 0; i < 3; i++) spawnSprite('burst', c.tx + (i - 1) * 7 * c.S, c.ty + (i - 1) * 6 * c.S, { size: Math.round(9 * c.S), life: .25, col: c.pal[3], delay: i * .04 }); afGoo(c, c.tx, c.ty, 6, .6); afShake(c, 2); } };
ATK.sludge = { pose: 'cast', sfx: 'sludge', charge: c => { for (let i = 0; i < afN(c, 6); i++) spawnSprite('bubble', c.ax + (vrnd() - .5) * 14 * c.S, c.ay + 6 * c.S, { size: 1 + (i % 3), life: afT(c, c.wt), col: c.pal[2], col2: c.pal[3], vy: -22, delay: afT(c, i * .03) }); },
  go: c => { for (let i = 0; i < afN(c, 3); i++) afS('aOrb', c.ax, c.ay, { tx: c.ex + (i - 1) * 8 * c.S, ty: c.ey + (i - 1) * 6 * c.S, life: afT(c, c.dur * (.8 + i * .1)), arc: (14 + i * 6) * c.S, size: Math.max(2, afR((4 + (i === 1 ? 2 : 0)) * c.S)), pal: c.pal, style: 'sludge', delay: afT(c, i * .03) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[2], ring: false }); afGoo(c, c.tx, c.ty, 12); afShake(c, 3); } };
ATK.sludgebomb = { pose: 'cast', windup: .3, sfx: 'sludge', charge: c => { afSpecialCharge(c, 10, 5); ATK.sludge.charge(c); },
  go: c => afS('aOrb', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 26 * c.S, size: Math.max(3, afR(9 * c.S)), pal: c.pal, style: 'sludge' }),
  hit: c => { const S = c.S; spawnSprite('blast', c.tx, c.ty, { size: Math.round(26 * S), life: .6, col: c.pal[2], col2: c.pal[1] }); for (let i = 0; i < afN(c, 3); i++) spawnSprite('smoke', c.tx + (i - 1) * 12 * S, c.ty - 6 * S, { size: Math.max(2, Math.round(7 * S)), life: 1, col: c.pal[1], col2: c.pal[3], vy: -16, delay: i * .06 }); afBurst(c, c.tx, c.ty, 22, { col: c.pal[3] }); afGoo(c, c.tx, c.ty, 18, 1.3); afShake(c, 5); } };

// ---- Ground
function afRocks(c, x, y, n = 8, big = 1, P = ATK_PAL.Ground) { const S = c.S; for (let i = 0; i < afN(c, n); i++) { const a = -Math.PI * (.15 + vrnd() * .7), sp = (60 + vrnd() * 80) * S * big; spawnSprite('rock', x, y, { size: Math.max(1, Math.round((2 + vrnd() * 2) * S * 1.5 * big)), life: .7, col: P[2], col2: P[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 380 }); } for (let i = 0; i < afN(c, 3); i++) spawnSprite('poof', x + (i - 1) * 10 * S, c.gy - 2, { size: Math.max(2, Math.round(5 * S)), life: .6, col: P[3], col2: P[4], vy: -12, vx: (i - 1) * 14, delay: i * .04 }); }
ATK.mudslap = { pose: 'lunge', sfx: 'splash', charge: c => afContactCharge(c, false), go: c => { for (let i = 0; i < afN(c, 5); i++) afS('aOrb', c.A.x + c.dir * 10 * c.S, c.gyA - 10 * c.S, { tx: c.ex + (vrnd() - .5) * 16 * c.S, ty: c.ey + (vrnd() - .5) * 20 * c.S, life: afT(c, c.dur * (.8 + vrnd() * .3)), arc: 10 * c.S, size: Math.max(1, afR((2 + vrnd() * 2) * c.S)), pal: c.pal, style: 'mud' }); afLunge(c); },
  hit: c => { afGoo(c, c.tx, c.ty, 8, .8); afBurst(c, c.tx, c.ty, 14, { col: c.pal[2], ring: false }); afShake(c, 2); } };
ATK.dig = { pose: 'burrow', windup: .3, travel: .32, board: 1.3, sfx: 'rumble', charge: c => { afRocks(c, c.A.x, c.gyA - 2, 8, .7); afShake(c, 2); },
  go: c => { const S = c.S; if (c.board) return; for (let i = 0; i < 6; i++) spawnSprite('poof', lerp(c.A.x, c.D.x, (i + 1) / 7), c.gy - 2, { size: Math.round(5 * S), life: .35, col: '#b8864a', col2: '#e4c48c', vy: -10, delay: afT(c, c.dur * (i + 1) / 7) }); afS('aCrack', c.stacked ? c.D.x - c.dir * 110 : c.A.x, c.stacked ? c.gy : c.gyA, { ex: c.D.x, life: afT(c, c.dur + .5), grow: c.dur / (c.dur + .5), pal: c.pal }); },
  hit: c => { const S = c.S; atkSfx('rock'); afS('aSpike', c.D.x, c.gy, { life: .75, h: 64 * S, w: 22 * S, style: 'dirt', pal: c.pal }); afRocks(c, c.D.x, c.gy - 10 * S, 12, 1.2); afBurst(c, c.tx, c.ty + 14 * S, 22, { col: c.pal[3], ring: false }); afShake(c, 6); }, react: 'crush' };
ATK.earthquake = { pose: 'stomp', windup: .32, travel: .3, board: 1.3, sfx: 'quake', focus: .35,
  charge: c => { atkSfx('rumble'); afRocks(c, c.A.x, c.gyA - 2, 6, .6); },
  go: c => { const S = c.S; afShake(c, 5); for (let i = 0; i < 3; i++) spawnSprite('ring', c.A.x, c.gyA - 1, { size: Math.round((30 + i * 26) * S), life: afT(c, .5), col: '#e4c48c', delay: afT(c, i * .07) }); afS('aCrack', c.stacked ? c.D.x - c.dir * 120 : c.A.x + c.dir * 8 * S, c.board || c.stacked ? c.gy : c.gyA, { ex: c.D.x + c.dir * 30 * S, life: afT(c, c.dur + .6), grow: c.dur / (c.dur + .6), pal: c.pal, glow: '#ffd08a' }); if (!c.board && !c.stacked) afS('aCrack', c.A.x + c.dir * 8, c.gyA + 5, { ex: c.D.x - c.dir * 10, life: afT(c, c.dur + .5), grow: c.dur / (c.dur + .5), pal: c.pal, glow: '#ffd08a', delay: afT(c, .04) }); },
  hit: c => { const S = c.S; for (let i = 0; i < afN(c, 3); i++) afS('aSpike', c.D.x + (i - 1) * 16 * S, c.gy + 2, { life: .8, h: (26 + (i % 2) * 14) * S, w: 12 * S, style: 'rock', lean: (i - 1) * .2, pal: ATK_PAL.Rock, delay: i * .04 }); afRocks(c, c.D.x, c.gy - 4, 14, 1.2); afBurst(c, c.tx, c.ty + 16 * S, 26, { col: c.pal[3] }); for (let i = 0; i < afN(c, 4); i++) spawnSprite('smoke', c.D.x + (i - 1.5) * 14 * S, c.gy - 6 * S, { size: Math.max(2, Math.round(7 * S)), life: 1, col: '#9a8468', col2: '#d8c4a0', vy: -20, delay: .1 + i * .05 }); afShake(c, 9); }, react: 'crush' };

// ---- Flying
function afFeathers(c, x, y, n = 6) { for (let i = 0; i < afN(c, n); i++) afS('aFeather', x + (vrnd() - .5) * 30 * c.S, y + (vrnd() - .5) * 20 * c.S, { vx: (vrnd() - .5) * 40 * c.S, vy: -30 * c.S - vrnd() * 20, grav: 60, life: .9 + vrnd() * .4, size: Math.max(2, afR(4 * c.S)), rot: vrnd() * 3, pal: c.pal, delay: vrnd() * .1 }); }
ATK.gust = { pose: 'cast', sfx: 'wind', charge: c => { for (let i = 0; i < afN(c, 5); i++) spawnSprite('wind', c.A.x + (vrnd() - .5) * 30 * c.S, c.ay + (i - 2) * 9 * c.S, { size: Math.round(16 * c.S), life: afT(c, c.wt), col: '#ffffff', vx: c.dir * 40 * c.S, delay: afT(c, i * .03) }); },
  go: c => { const S = c.S; if (c.board) { for (let i = 0; i < afN(c, 5); i++) spawnSprite('wind', c.ax, c.ay + (i - 2) * 4, { tx: c.ex, ty: c.ey + (i - 2) * 4, life: afT(c, c.dur), size: 10, col: '#ffffff', delay: i * .02 }); return; } afS('aTornado', 0, 0, { fx0: c.A.x + c.dir * 30, fx1: c.D.x, gy: c.gy, h: 64, w: 22, life: afT(c, c.dur + .4), go: c.dur / (c.dur + .4), pal: c.pal }); for (let i = 0; i < 6; i++) afS('aStreak', c.ax - c.uy * (i - 3) * 8, c.ay + c.ux * (i - 3) * 8, { vx: c.ux * 420, vy: c.uy * 420, life: afT(c, c.dur * .8), size: 14, pal: c.pal, delay: afT(c, i * .03) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[3], ring: false }); for (let i = 0; i < afN(c, 6); i++) spawnSprite('wind', c.tx + (vrnd() - .5) * 16 * c.S, c.ty + (vrnd() - .5) * 30 * c.S, { size: Math.round((12 + vrnd() * 8) * c.S), life: .35, col: '#ffffff', vx: c.dir * 140 * c.S, delay: vrnd() * .1 }); afFeathers(c, c.tx, c.ty, 3); afShake(c, 3); }, react: 'wobble' };
ATK.wingattack = { pose: 'lunge', sfx: 'wind', charge: c => { afContactCharge(c); if (!c.board) for (let i = 0; i < 3; i++) spawnSprite('wind', c.A.x, c.ay - 20 + i * 14, { size: 18, life: afT(c, c.wt), col: '#ffffff', vx: -c.dir * 30, delay: afT(c, i * .04) }); }, go: afLunge,
  hit: c => { const S = c.S; afSlashFx(c, c.tx - c.dir * 6 * S, c.ty, { style: 'arc', size: afR(24 * S), a0: c.dir > 0 ? -2.6 : -.5, a1: c.dir > 0 ? -.9 : -2.2, sq: .8, th: 4, sweep: .2 }); afSlashFx(c, c.tx - c.dir * 6 * S, c.ty, { style: 'arc', size: afR(24 * S), a0: c.dir > 0 ? 2.6 : .5, a1: c.dir > 0 ? .9 : 2.2, sq: .8, th: 4, sweep: .2, delay: .04 }); afBurst(c, c.tx, c.ty, 16, { ring: false }); afFeathers(c, c.tx, c.ty, 7); afShake(c, 3); } };
ATK.drillpeck = { pose: 'lunge', sfx: 'drill', charge: c => { afContactCharge(c); }, go: c => { afLunge(c); afS('aDrill', c.ax, c.ay, { life: afT(c, c.dur + .1), size: afR(22 * c.S), w: Math.max(2, afR(7 * c.S)), dir: c.dir, pal: c.pal, follow: c.fol(c.att) }); },
  hit: c => { const S = c.S; for (let i = 0; i < 3; i++) spawnSprite('psy', c.tx, c.ty, { size: Math.round((10 + i * 6) * S), life: .35, col: c.pal[3], col2: '#ffffff', delay: i * .05 }); afBurst(c, c.tx, c.ty, 20, { col: c.pal[3] }); afFeathers(c, c.tx, c.ty, 4); afParts(c, c.tx, c.ty, 12, ['#ffffff', c.pal[3]], { speed: 120, life: .4, grav: 60 }); afShake(c, 4); } };

// ---- Psychic
function afEyes(c) { for (const s2 of [-1, 1]) afS('aSparkle', c.A.x + c.dir * 10 * c.S + s2 * 4 * c.S, c.gyA - c.H * .78, { life: afT(c, c.wt), size: Math.max(2, afR(4 * c.S)), pal: c.pal, delay: afT(c, c.wt * .4), follow: c.fol(c.att) }); }
ATK.confusion = { pose: 'cast', sfx: 'psy', charge: c => { afEyes(c); if (!c.board) afS('aWarp', c.A.x, c.gyA - c.H * .5, { life: afT(c, c.wt), size: 40, pal: c.pal, follow: c.fol(c.att) }); },
  go: c => { afS('aWarp', c.tx, c.ty, { life: afT(c, c.dur + .45), size: 40 * c.S, pal: c.pal }); for (let i = 0; i < afN(c, 4); i++) spawnSprite('psy', c.ax + (c.ex - c.ax) * (i + 1) / 5, c.ay + (c.ey - c.ay) * (i + 1) / 5, { size: Math.round(10 * c.S), life: afT(c, .3), col: c.pal[2], col2: c.pal[3], delay: afT(c, i * c.dur / 5) }); },
  hit: c => { for (let i = 0; i < 4; i++) spawnSprite('psy', c.tx, c.ty, { size: Math.round((12 + i * 7) * c.S), life: .45, col: c.pal[2], col2: c.pal[3], delay: i * .06 }); afBurst(c, c.tx, c.ty, 16, { col: c.pal[3], ring: false }); for (let i = 0; i < afN(c, 6); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 34 * c.S, c.ty + (vrnd() - .5) * 34 * c.S, { life: .4, size: 3, pal: c.pal, delay: vrnd() * .15 }); afShake(c, 3); }, react: 'wobble' };
ATK.psybeam = { pose: 'cast', sfx: 'psy', charge: c => { afEyes(c); afSpecialCharge(c, 10); },
  go: c => afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .36), w: Math.max(2, afR(7 * c.S)), pal: c.pal, style: 'psy', rainbow: true, grow: .45, hold: .74 }),
  hit: c => { for (let i = 0; i < 5; i++) spawnSprite('psy', c.tx, c.ty, { size: Math.round((10 + i * 6) * c.S), life: .45, col: ATK_RAINBOW[i], col2: '#ffffff', delay: i * .05 }); afBurst(c, c.tx, c.ty, 16, { col: c.pal[2], ring: false }); afShake(c, 3); }, react: 'wobble' };
ATK.psychic = { pose: 'cast', windup: .34, travel: .34, board: 1.25, sfx: 'psywave', focus: .5, focusCol: '#2a0a24',
  charge: c => { afEyes(c); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt + c.dur), w: 56, h: 80, pal: c.pal, n: 10, speed: 2, follow: c.fol(c.att) }); afSpecialCharge(c, 10); },
  go: c => { afS('aWarp', c.tx, c.ty - 8 * c.S, { life: afT(c, c.dur + .5), size: 52 * c.S, pal: c.pal }); for (let i = 0; i < 3; i++) spawnSprite('psy', c.tx, c.ty, { size: Math.round((22 + i * 10) * c.S), life: afT(c, .4), col: c.pal[2], col2: c.pal[3], delay: afT(c, i * .08) }); },
  hit: c => { const S = c.S; afBurst(c, c.tx, c.ty + 10 * S, 26, { col: c.pal[2] }); for (let i = 0; i < 2; i++) spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round((34 + i * 18) * S), life: .5, col: i ? c.pal[3] : c.pal[2], delay: i * .06 }); if (!c.board) flashScreen('#ffb4da', .35); afShake(c, 7); }, react: 'lift' };

// ---- Bug
ATK.bugbite = { pose: 'lunge', sfx: 'snap', charge: c => afContactCharge(c), go: afLunge, hit: c => { afS('aJaws', c.tx, c.ty, { life: .5, size: Math.max(5, afR(14 * c.S)), style: 'bug', pal: c.pal }); afBurst(c, c.tx, c.ty, 14, { col: c.pal[3], ring: false }); afParts(c, c.tx, c.ty, 10, [c.pal[2], c.pal[3]], { speed: 90, life: .4, grav: 120 }); afShake(c, 3); } };
ATK.xscissor = { pose: 'lunge', sfx: 'slash', charge: c => afContactCharge(c), go: afLunge, hit: c => { const S = c.S; afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: -20 * S, ly0: -20 * S, lx1: 20 * S, ly1: 20 * S, th: 4, sweep: .12, pal: c.pal }); afSlashFx(c, c.tx, c.ty, { style: 'line', lx0: 20 * S, ly0: -20 * S, lx1: -20 * S, ly1: 20 * S, th: 4, sweep: .12, pal: c.pal, delay: .05 }); afBurst(c, c.tx, c.ty, 18, { col: c.pal[3], ring: false }); afParts(c, c.tx, c.ty, 12, [c.pal[3], '#ffffff'], { speed: 120, life: .4, grav: 60 }); afShake(c, 4); } };
ATK.megahorn = { pose: 'rush', windup: .32, travel: .2, sfx: 'roar', charge: c => { afContactCharge(c); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt + .1), w: 56, h: 74, pal: c.pal, n: 9, speed: 3, follow: c.fol(c.att) }); },
  go: c => { afLunge(c); afS('aHorn', c.ax, c.ay - 6 * c.S, { life: afT(c, c.dur + .08), size: afR(20 * c.S), w: Math.max(2, afR(5 * c.S)), dir: c.dir, pal: c.pal, follow: c.fol(c.att) }); },
  hit: c => { const S = c.S; afBurst(c, c.tx, c.ty, 30, { col: c.pal[3] }); spawnSprite('burst', c.tx, c.ty, { size: Math.round(30 * S), life: .45, col: c.pal[4], delay: .03 }); spawnSprite('ring', c.D.x, c.gy - 1, { size: Math.round(34 * S), life: .45, col: c.pal[3], delay: .05 }); afParts(c, c.tx, c.ty, 16, [c.pal[2], c.pal[3], '#ffffff'], { speed: 140, life: .5, grav: 120 }); afShake(c, 7); }, react: 'crush' };

// ---- Rock
ATK.rockthrow = { pose: 'cast', sfx: 'rock', charge: c => { for (let i = 0; i < afN(c, 3); i++) spawnSprite('rock', c.A.x + c.dir * (8 + i * 8) * c.S, c.gyA, { size: Math.max(2, Math.round(4 * c.S)), life: afT(c, c.wt), col: c.pal[2], col2: c.pal[1], vy: -60 * c.S, grav: 0, delay: afT(c, i * .05) }); },
  go: c => { for (let i = 0; i < afN(c, 3); i++) { const b = afS('aBoulder', 0, 0, { fx0: c.ax, fy0: c.ay - 6 * c.S, fx1: c.ex + (i - 1) * 8 * c.S, fy1: c.ey - (i - 1) * 4 * c.S, gy: c.gy, life: afT(c, c.dur * (.8 + i * .1)) / .98, fall: .98, size: Math.max(2, afR((5 + (i === 1 ? 2 : 0)) * c.S)), pal: c.pal, rot: i, delay: afT(c, i * .04) }); } },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[3], ring: false }); afRocks(c, c.tx, c.ty, 10, 1, c.pal); afShake(c, 4); } };
ATK.rockslide = { pose: 'cast', windup: .3, travel: .34, board: 1.25, sfx: 'rumble', charge: c => { afShake(c, 2); for (let i = 0; i < afN(c, 5); i++) spawnSprite('rock', c.A.x + (vrnd() - .5) * 40 * c.S, c.gyA, { size: Math.max(1, Math.round(3 * c.S)), life: afT(c, c.wt), col: c.pal[2], col2: c.pal[1], vy: -40 - vrnd() * 40, grav: 60, delay: afT(c, i * .04) }); },
  go: c => { const n = afN(c, 5); for (let i = 0; i < n; i++) { const x = c.D.x + (i - (n - 1) / 2) * 14 * c.S + (vrnd() - .5) * 6 * c.S; afS('aBoulder', 0, 0, { fx0: x - c.dir * 10 * c.S, fy0: c.top - 20 * c.S, fx1: x, fy1: c.gy - 8 * c.S - (i % 2) * 10 * c.S, gy: c.gy, life: afT(c, c.dur * .55) / .98, fall: .98, size: Math.max(3, afR((10 + (i % 2) * 4) * c.S)), pal: c.pal, rot: i * 1.3, delay: afT(c, c.dur * .45 * (n > 1 ? i / (n - 1) : 1)) }); } },
  hit: c => { const S = c.S; atkSfx('rock'); for (let i = 0; i < afN(c, 3); i++) spawnSprite('boom', c.D.x + (i - 1) * 14 * S, c.gy - 10 * S, { size: Math.round(10 * S), life: .7, col: 'dust', rot: i, delay: i * .08 }); afRocks(c, c.D.x, c.gy - 8 * S, 16, 1.3, c.pal); afBurst(c, c.tx, c.ty, 22, { col: c.pal[3], ring: false }); afShake(c, 7); }, react: 'crush' };
ATK.stoneedge = { pose: 'cast', windup: .3, travel: .26, sfx: 'rock', charge: c => { for (let i = 0; i < afN(c, 6); i++) spawnSprite('rock', c.A.x, c.ay, { orbit: { r: 30 * c.S, speed: 9, a0: i / 6 * Math.PI * 2, squash: .5 }, life: afT(c, c.wt), size: Math.max(2, Math.round(4 * c.S)), col: c.pal[3], col2: c.pal[1], delay: afT(c, i * .01) }); },
  go: c => { afS('aCrack', c.D.x - 22 * c.S, c.gy + 1, { ex: c.D.x + 22 * c.S, life: afT(c, c.dur + .3), grow: .6, pal: c.pal, glow: '#fff4d4' }); for (let i = 0; i < afN(c, 4); i++) afS('aSparkle', c.D.x + (i - 1.5) * 12 * c.S, c.gy - 2, { life: afT(c, c.dur), size: 3, pal: c.pal, delay: afT(c, i * .03) }); },
  hit: c => { const S = c.S; for (let i = 0; i < afN(c, 4); i++) afS('aSpike', c.D.x + (i - 1.5) * 13 * S, c.gy + 2, { life: .85, h: (34 + ((i * 5) % 3) * 12) * S, w: 11 * S, style: 'rock', lean: (i - 1.5) * .18, pal: c.pal, delay: i * .03 }); afRocks(c, c.D.x, c.gy - 6, 10, 1, c.pal); afBurst(c, c.tx, c.ty, 22, { col: c.pal[3] }); afShake(c, 7); }, react: 'crush' };

// ---- Ghost
function afWisps(c, x, y, n = 8) { for (let i = 0; i < afN(c, n); i++) { const a = vrnd() * Math.PI * 2; spawnSprite('wisp', x, y, { size: Math.max(2, Math.round((3 + vrnd() * 2) * c.S)), life: .7, col: c.pal[2], col2: c.pal[3], vx: Math.cos(a) * 40 * c.S, vy: Math.sin(a) * 30 * c.S - 26 * c.S, delay: vrnd() * .12 }); } }
ATK.lick = { pose: 'lunge', sfx: 'ghost', charge: c => { if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt), w: 46, h: 60, pal: c.pal, n: 7, speed: 1.8, follow: c.fol(c.att) }); }, go: c => { afLunge(c); afS('aTongue', c.ax, c.ay + 4 * c.S, { ex: c.ex, ey: c.ey, life: afT(c, c.dur / .4), w: Math.max(2, afR(4 * c.S)), follow: c.fol(c.att) }); },
  hit: c => { for (let i = 0; i < afN(c, 8); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 26 * c.S, c.ty + (vrnd() - .5) * 26 * c.S, { life: .35, size: 3, pal: c.pal, delay: vrnd() * .15 }); afWisps(c, c.tx, c.ty, 5); afBurst(c, c.tx, c.ty, 12, { col: c.pal[3], ring: false }); afShake(c, 2); }, react: 'wobble' };
ATK.hex = { pose: 'cast', sfx: 'ghost', charge: c => { afEyes(c); afGather(c, c.ax, c.ay, c.wt, [c.pal[2], c.pal[3]], 8, 30, 'wisp'); },
  go: c => { afS('aRune', c.D.x, c.gy - 1, { life: afT(c, c.dur + .6), size: 30 * c.S, pal: c.pal }); for (let i = 0; i < afN(c, 8); i++) spawnSprite('flame', c.D.x + (vrnd() - .5) * 44 * c.S, c.gy - 2, { size: Math.max(1, Math.round((2 + vrnd() * 2) * c.S * 1.2)), life: afT(c, c.dur + .3), col: c.pal[3], col2: c.pal[1], vy: -30 - vrnd() * 30, delay: afT(c, vrnd() * c.dur) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 20, { col: c.pal[2] }); if (!c.board) afS('aAura', c.D.x, c.gy, { life: .6, w: 44, h: 64, pal: c.pal, n: 9, speed: 3 }); afWisps(c, c.tx, c.ty, 8); afShake(c, 4); }, react: 'wobble' };
ATK.shadowball = { pose: 'cast', windup: .32, sfx: 'ghost', focus: .45, focusCol: '#08040e', charge: c => { afGather(c, c.ax, c.ay, c.wt, [c.pal[1], c.pal[2], c.pal[0]], 14, 46, 'wisp'); afS('aCharge', c.ax, c.ay, { life: afT(c, c.wt + .05), size: 6 * c.S, pal: [c.pal[0], c.pal[2], c.pal[0], c.pal[1], c.pal[3]], follow: c.fol(c.att) }); },
  go: c => afS('aOrb', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 4 * c.S, size: Math.max(3, afR(9 * c.S)), pal: c.pal, style: 'shadow' }),
  hit: c => { const S = c.S; for (let i = 0; i < 3; i++) spawnSprite('ring', c.tx, c.ty, { size: Math.round((20 + i * 12) * S), life: .45, col: i % 2 ? c.pal[3] : c.pal[1], delay: i * .05 }); afBurst(c, c.tx, c.ty, 24, { col: c.pal[1], ringCol: c.pal[2] }); afWisps(c, c.tx, c.ty, 10); if (!c.board) flashScreen('#3a2870', .35); afShake(c, 5); } };

// ---- Dragon
ATK.twister = { pose: 'cast', sfx: 'wind', charge: c => { for (let i = 0; i < afN(c, 8); i++) spawnSprite('wind', c.A.x, c.ay, { orbit: { r: 26 * c.S, speed: 12, a0: i * .8, squash: .5 }, size: Math.round(10 * c.S), life: afT(c, c.wt), col: c.pal[3], delay: afT(c, i * .02) }); },
  go: c => { if (c.board) { spawnSprite('psy', c.ex, c.ey, { size: 14, life: afT(c, c.dur + .2), col: c.pal[2], col2: c.pal[3] }); return; } afS('aTornado', 0, 0, { fx0: c.A.x + c.dir * 30, fx1: c.D.x, gy: c.gy, h: 70, w: 26, life: afT(c, c.dur + .45), go: c.dur / (c.dur + .45), pal: c.pal }); },
  hit: c => { afBurst(c, c.tx, c.ty, 18, { col: c.pal[2] }); for (let i = 0; i < afN(c, 8); i++) spawnSprite('wind', c.tx + (vrnd() - .5) * 20 * c.S, c.ty + (vrnd() - .5) * 40 * c.S, { size: Math.round(14 * c.S), life: .4, col: c.pal[3], vx: (vrnd() < .5 ? -1 : 1) * 120 * c.S, delay: vrnd() * .12 }); afShake(c, 3); }, react: 'wobble' };
ATK.dragonclaw = { pose: 'lunge', sfx: 'claw', charge: c => { afContactCharge(c); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt), w: 50, h: 66, pal: c.pal, n: 8, speed: 3, follow: c.fol(c.att) }); }, go: afLunge,
  hit: c => { const S = c.S; afSlashFx(c, c.tx, c.ty, { style: 'claw', size: afR(24 * S), a0: -2.4, a1: -.5, sq: 1, th: 4, sweep: .2 }); afBurst(c, c.tx, c.ty, 20, { col: c.pal[2] }); afParts(c, c.tx, c.ty, 14, [c.pal[2], c.pal[3], '#ffffff'], { speed: 120, life: .45, grav: 80 }); afShake(c, 5); } };
ATK.outrage = { pose: 'rush', windup: .34, travel: .2, board: 1.3, sfx: 'roar', focus: .5, focusCol: '#2a0404',
  charge: c => { const rage = ['#3a0404', '#c42a0a', '#ff4a20', '#ffa060', '#fff0c0']; if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt + c.dur + .3), w: 60, h: 84, pal: rage, n: 12, speed: 3.6, follow: c.fol(c.att) }); afContactCharge(c, false); afShake(c, 2); },
  go: afLunge,
  hit: c => { const S = c.S; for (let i = 0; i < 3; i++) { const x = c.tx + (i - 1) * 9 * S, y = c.ty + ((i % 2) * 14 - 7) * S; spawnSprite('impact', x, y, { size: Math.round(22 * S), life: .28, col: i === 1 ? '#ff4a20' : c.pal[2], rot: i, delay: i * .08 }); spawnSprite('flash', x, y, { size: Math.round(10 * S) + 2, life: .12, col: '#ffffff', delay: i * .08 }); } spawnSprite('boom', c.tx, c.ty, { size: Math.round(15 * S), life: .7, rot: 1, delay: .16 }); afParts(c, c.tx, c.ty, 18, ['#ff4a20', c.pal[2], '#ffffff'], { speed: 150, life: .55, grav: 90 }); afShake(c, 8); }, react: 'crush' };

// ---- Dark
ATK.bite = { pose: 'lunge', sfx: 'snap', charge: c => afContactCharge(c), go: afLunge, hit: c => { afS('aJaws', c.tx, c.ty, { life: .5, size: Math.max(5, afR(14 * c.S)), teeth: 5, pal: c.pal }); afBurst(c, c.tx, c.ty, 14, { col: c.pal[3], ring: false }); afParts(c, c.tx, c.ty, 8, [c.pal[3], '#ffffff'], { speed: 90, life: .4, grav: 120 }); afShake(c, 3); } };
ATK.crunch = { pose: 'lunge', sfx: 'crunch', charge: c => { afContactCharge(c); if (!c.board) afS('aAura', c.A.x, c.gyA, { life: afT(c, c.wt), w: 50, h: 64, pal: c.pal, n: 8, speed: 2.2, follow: c.fol(c.att) }); }, go: afLunge,
  hit: c => { const S = c.S; afS('aJaws', c.tx, c.ty, { life: .6, size: Math.max(6, afR(19 * S)), teeth: 6, pal: c.pal, gum: c.pal[2] }); afBurst(c, c.tx, c.ty, 22, { col: c.pal[2], ringCol: c.pal[3] }); for (let i = 0; i < afN(c, 10); i++) { const a = vrnd() * Math.PI * 2, sp = (60 + vrnd() * 70) * S; spawnSprite('shard', c.tx, c.ty, { life: .5, col: c.pal[3], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 200, rot: vrnd() * 2, spin: 8, delay: .1 }); } afShake(c, 5); } };

// ---- Steel
function afSparksOrange(c, x, y, n = 12) { afParts(c, x, y, n, ['#ffd24a', '#ff9a30', '#ffffff'], { speed: 150, life: .45, grav: 260 }); }
ATK.metalclaw = { pose: 'lunge', sfx: 'claw', charge: c => { afContactCharge(c, false); if (!c.board) afS('aGlint', c.A.x, c.gyA, { life: afT(c, c.wt), w: 60, h: 80, follow: c.fol(c.att) }); }, go: afLunge,
  hit: c => { atkSfx('clang'); afBurst(c, c.tx, c.ty, 16, { col: c.pal[3], ring: false }); afClaws(c, 4); afSparksOrange(c, c.tx, c.ty, 14); afShake(c, 4); } };
ATK.ironhead = { pose: 'rush', travel: .18, sfx: 'clang', charge: c => { afContactCharge(c, false); if (!c.board) afS('aGlint', c.A.x, c.gyA, { life: afT(c, c.wt), w: 60, h: 80, follow: c.fol(c.att) }); }, go: afLunge,
  hit: c => { const S = c.S; afBurst(c, c.tx, c.ty, 26, { col: c.pal[3], ringCol: '#ffffff' }); for (let i = 0; i < 2; i++) spawnSprite('ring', c.tx, c.ty, { size: Math.round((30 + i * 16) * S), life: .4, col: i ? c.pal[2] : '#ffffff', delay: i * .05 }); afSparksOrange(c, c.tx, c.ty, 18); afShake(c, 6); }, react: 'crush' };
ATK.flashcannon = { pose: 'cast', windup: .3, sfx: 'beam', charge: c => { if (!c.board) afS('aGlint', c.A.x, c.gyA, { life: afT(c, c.wt), w: 60, h: 80, follow: c.fol(c.att) }); afSpecialCharge(c, 12, 5); },
  go: c => { afS('aStream', c.ax, c.ay, { ex: c.ex, ey: c.ey, life: afT(c, c.dur + .38), w: Math.max(2, afR(6 * c.S)), pal: c.pal, style: 'light', grow: .35, hold: .74 }); if (!c.board) flashScreen('#ffffff', .25); },
  hit: c => { afBurst(c, c.tx, c.ty, 24, { col: c.pal[3], ringCol: '#ffffff' }); for (let i = 0; i < afN(c, 10); i++) afS('aSparkle', c.tx + (vrnd() - .5) * 40 * c.S, c.ty + (vrnd() - .5) * 36 * c.S, { life: .45, size: Math.max(1, afR(4 * c.S)), pal: c.pal, delay: vrnd() * .2 }); afShake(c, 5); } };

// ---- Fairy
function afFairyDust(c, x, y, n = 10, r = 34) { for (let i = 0; i < afN(c, n); i++) afS('aSparkle', x + (vrnd() - .5) * r * c.S, y + (vrnd() - .5) * r * c.S, { life: .4 + vrnd() * .3, size: Math.max(1, afR((2 + vrnd() * 3) * c.S)), pal: c.pal, vy: -20, delay: vrnd() * .2 }); }
ATK.fairywind = { pose: 'cast', sfx: 'sparkle', charge: c => { afFairyDust(c, c.A.x, c.gyA - c.H * .5, 8, 50); },
  go: c => { const S = c.S; for (let i = 0; i < afN(c, 12); i++) afS('aStreak', c.ax - c.ux * 10 * S, c.ay + (i - 6) * 5 * S, { vx: c.ux * 380 * S + 60 * c.ux, vy: c.uy * 380 * S + Math.sin(i) * 20, life: afT(c, c.dur * .9), size: 18 * S, alpha: .9, pal: i % 3 ? c.pal : ['#ffffff', '#fff', '#fff', '#ffffff', '#ffd2ee'], delay: afT(c, i * .02) }); for (let i = 0; i < afN(c, 3); i++) spawnSprite('heart', c.ax, c.ay, { tx: c.ex + (vrnd() - .5) * 16 * S, ty: c.ey + (vrnd() - .5) * 20 * S, arc: 10 * S, life: afT(c, c.dur), col: c.pal[2], delay: afT(c, i * .04) }); for (let i = 0; i < afN(c, 10); i++) afS('aSparkle', c.ax, c.ay + (vrnd() - .5) * 30 * S, { tx: c.ex + (vrnd() - .5) * 20 * S, ty: c.ey + (vrnd() - .5) * 30 * S, arc: (vrnd() - .5) * 20 * S, life: afT(c, c.dur * (.7 + vrnd() * .3)), size: Math.max(1, afR(3 * S)), pal: c.pal, delay: afT(c, i * .02) }); },
  hit: c => { afBurst(c, c.tx, c.ty, 16, { col: c.pal[2] }); afFairyDust(c, c.tx, c.ty, 12); afShake(c, 2); }, react: 'wobble' };
ATK.drainingkiss = { pose: 'cast', sfx: 'kiss', ownDrain: true, charge: c => { for (let i = 0; i < afN(c, 4); i++) spawnSprite('heart', c.ax + (vrnd() - .5) * 20 * c.S, c.ay, { life: afT(c, c.wt), col: c.pal[2], vy: -30, delay: afT(c, i * .05) }); },
  go: c => afS('aHeart', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 12 * c.S, size: Math.max(3, afR(7 * c.S)), pal: c.pal }),
  hit: c => { for (let i = 0; i < afN(c, 8); i++) { const a = vrnd() * Math.PI * 2; spawnSprite('heart', c.tx, c.ty, { life: .6, col: c.pal[2], vx: Math.cos(a) * 50 * c.S, vy: Math.sin(a) * 40 * c.S - 20, delay: vrnd() * .1 }); } afBurst(c, c.tx, c.ty, 14, { col: c.pal[2], ring: false }); afFairyDust(c, c.tx, c.ty, 6); atkDrainFx(c); afShake(c, 2); }, drainPal: 'Fairy' };
ATK.moonblast = { pose: 'cast', windup: .36, sfx: 'moon', focus: .45, focusCol: '#0a0626',
  charge: c => { atkSfx('moon'); if (!c.board) afS('aMoon', c.A.x - c.dir * 18, c.gyA - c.H - 12, { life: afT(c, c.wt + c.dur + .2), size: 11, pal: c.pal }); afGather(c, c.ax, c.ay, c.wt, [c.pal[3], c.pal[4], c.pal[2]], 14, 48); },
  go: c => afS('aOrb', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 6 * c.S, size: Math.max(3, afR(8 * c.S)), pal: c.pal, style: 'moon' }),
  hit: c => { const S = c.S; for (let i = 0; i < 3; i++) spawnSprite('ring', c.tx, c.ty, { size: Math.round((22 + i * 12) * S), life: .5, col: i % 2 ? c.pal[3] : c.pal[2], delay: i * .06 }); afBurst(c, c.tx, c.ty, 26, { col: c.pal[3] }); afFairyDust(c, c.tx, c.ty, 16, 50); if (!c.board) flashScreen('#ffd2ee', .4); afShake(c, 5); } };

// ---- fallbacks by type, for any move without its own
ATK.gcontact = { pose: 'lunge', charge: c => afContactCharge(c), go: afLunge, hit: c => { afBurst(c, c.tx, c.ty, 20); afParts(c, c.tx, c.ty, 12, [c.pal[2], c.pal[3], '#ffffff'], { speed: 100, life: .45, grav: 100 }); afShake(c, 3); } };
ATK.gshot = { pose: 'cast', charge: c => afSpecialCharge(c, 10), go: c => afS('aOrb', c.ax, c.ay, { tx: c.ex, ty: c.ey, life: afT(c, c.dur), arc: 6 * c.S, size: Math.max(2, afR(5 * c.S)), pal: c.pal, style: 'energy' }), hit: c => { afBurst(c, c.tx, c.ty, 20); afParts(c, c.tx, c.ty, 12, [c.pal[2], c.pal[3], '#ffffff'], { speed: 100, life: .45, grav: 80 }); afShake(c, 3); } };

const ATK_MOVE = {
  Tackle: 'tackle', Scratch: 'scratch', 'Body Slam': 'slam', 'Hyper Beam': 'hyperbeam', Ember: 'ember', Flamethrower: 'flamethrower', 'Fire Blast': 'fireblast',
  'Water Gun': 'watergun', 'Bubble Beam': 'bubblebeam', Surf: 'surf', 'Hydro Pump': 'hydropump', 'Vine Whip': 'vinewhip', 'Razor Leaf': 'razorleaf', 'Giga Drain': 'gigadrain', 'Solar Beam': 'solarbeam',
  'Thunder Shock': 'thundershock', Thunderbolt: 'thunderbolt', Thunder: 'thunder', 'Ice Shard': 'iceshard', 'Ice Beam': 'icebeam', Blizzard: 'blizzard',
  'Karate Chop': 'chop', 'Brick Break': 'brickbreak', 'Cross Chop': 'crosschop', 'Poison Sting': 'poisonsting', Sludge: 'sludge', 'Sludge Bomb': 'sludgebomb',
  'Mud-Slap': 'mudslap', Dig: 'dig', Earthquake: 'earthquake', Gust: 'gust', 'Wing Attack': 'wingattack', 'Drill Peck': 'drillpeck',
  Confusion: 'confusion', Psybeam: 'psybeam', Psychic: 'psychic', 'Bug Bite': 'bugbite', 'X-Scissor': 'xscissor', Megahorn: 'megahorn',
  'Rock Throw': 'rockthrow', 'Rock Slide': 'rockslide', 'Stone Edge': 'stoneedge', Lick: 'lick', Hex: 'hex', 'Shadow Ball': 'shadowball',
  Twister: 'twister', 'Dragon Claw': 'dragonclaw', Outrage: 'outrage', Bite: 'bite', Crunch: 'crunch', 'Metal Claw': 'metalclaw', 'Iron Head': 'ironhead', 'Flash Cannon': 'flashcannon',
  'Fairy Wind': 'fairywind', 'Draining Kiss': 'drainingkiss', Moonblast: 'moonblast',
};
// The style a move plays: its own, else its type's for a contact or a ranged move.
function atkStyleId(move) { return ATK_MOVE[move.name] || (move.rng && move.rng[1] <= 1 ? 'gcontact' : 'gshot'); }
function atkStyle(move) { return ATK[atkStyleId(move)]; }
// Scene timing: the wind-up and the travel of this move (a contact move's travel is its lunge).
function atkWindupTime(move) { const s = atkStyle(move); return s.windup || DUEL_T.windup; }
function atkTravelTime(move, fam) { const s = atkStyle(move); return s.travel || (fam === 'contact' ? DUEL_T.contact : fam === 'electric' ? .2 : DUEL_T.ranged); }

// ---------------------------------------------------------------- playing a choreography
// Runs one act; in the scene small pixel sprites spawned by it are drawn at twice their size (FX.pixel).
function atkSafe(fn, c) { FX.pixel = c.board ? 1 : 2; try { fn(c); } catch (err) { if (typeof console !== 'undefined') console.error('attack fx', c.move && c.move.name, err); } FX.pixel = 1; }
function atkWindup(c) { const s = atkStyle(c.move); if (s.charge) atkSafe(s.charge, c); }
function atkLaunch(c) { const s = atkStyle(c.move); if (s.sfx) atkSfx(s.sfx); if (s.go) atkSafe(s.go, c); }
function atkImpact(c) {
  const s = atkStyle(c.move), e = c.e || {}; if (e.eff === 0 || e.dmg === 0) { spawnSprite('poof', c.tx, c.ty, { size: Math.round(6 * c.S) + 1, life: .45, col: '#c8c8d0', col2: '#ffffff', vy: -10 }); return; }
  if (s.hit) atkSafe(s.hit, c);
  // escalation: super effective adds a gold ring, a critical a gold starburst and a shower of gold
  if (e.eff > 1) { spawnSprite('ring', c.tx, c.ty, { size: Math.round(46 * c.S), life: .5, col: '#ffd24a', delay: .06 }); spawnSprite('ring', c.tx, c.ty, { size: Math.round(30 * c.S), life: .4, col: '#fff4b0', delay: .12 }); }
  if (e.crit) { spawnSprite('burst', c.tx, c.ty, { size: Math.round(34 * c.S), life: .45, col: UI.gold, delay: .04 }); afParts(c, c.tx, c.ty, 14, [UI.gold, '#ffffff'], { speed: 160, life: .5, grav: 100 }); }
}
// The drain after a draining hit: the type's motes (green for Giga Drain, pink hearts for Draining Kiss) fly back.
function atkDrain(c) { if (!atkStyle(c.move).ownDrain) atkSafe(atkDrainFx, c); } // Giga Drain and Draining Kiss show their own on every hit
function atkDrainFx(c) { const s = atkStyle(c.move), P = atkPal(s.drainPal || c.type); for (let i = 0; i < afN(c, 9); i++) { const heart = s.drainPal === 'Fairy' && i % 2; spawnSprite(heart ? 'heart' : 'bubble', c.tx + (vrnd() - .5) * 16 * c.S, c.ty + (vrnd() - .5) * 16 * c.S, { tx: c.A.x + (vrnd() - .5) * 10 * c.S, ty: c.ay + (vrnd() - .5) * 14 * c.S, life: .5, arc: (14 + i * 3) * c.S, size: 2 + (i % 2), col: P[3], col2: '#ffffff', delay: .1 + i * .045 }); } }
