// ============================================================================
// cofx.js — commander powers, Advance Wars style. Calling a power stops the war for a moment: the board darkens, a band
// tears open onto the commander's world (Brock's rock face, Misty's tide, Surge's storm, Erika's garden, Koga's smoke,
// Sabrina's psychic void, Blaine's volcano, Blue's champion burst, Giovanni's Rocket gold, the grunt's alley, or the
// Tactician's partner: flames, a water shield, a garden in bloom), the commander slides in large with their Ace roaring
// behind them, the power's name slams down, their line types out and what it does pops up as chips. Then the band
// closes and the power sweeps the field (sand, a tidal wave, a storm, petals, smoke, a psychic shockwave, fireballs,
// gold streaks, cracks), and for as long as it lasts the Pokémon it helps wear its aura and a badge, and the ones it
// hinders wear a mark. A Super Power gets the full show; a plain Power a shorter one. Reduced motion keeps it calm.
// ============================================================================
'use strict';
// Each commander's world: the band's scene, the sweep over the field, the colour of the aura and each power's line.
const COFX = {
  brock: { bg: 'rock', sweep: 'sand', quote: ['Not one step further!', 'Nothing gets through my defence!'] },
  misty: { bg: 'sea', sweep: 'wave', quote: ['Here comes the rain!', 'Ride the tide with me!'] },
  surge: { bg: 'storm', sweep: 'storm', quote: ['Stand still, soldier!', 'Feel the thunder, kid!'] },
  erika: { bg: 'garden', sweep: 'petals', quote: ['Breathe in, and heal.', 'Let my garden bloom!'] },
  koga: { bg: 'smoke', sweep: 'smoke', quote: ['Watch your step.', 'You cannot hit what you cannot see.'] },
  sabrina: { bg: 'psy', sweep: 'psy', quote: ['My mind is clear.', 'I have already seen your defeat.'] },
  blaine: { bg: 'volcano', sweep: 'meteors', quote: ['Turn up the heat!', 'Stand back! She is going to blow!'] },
  blue: { bg: 'champ', sweep: 'gold', quote: ['Try to keep up!', 'Who is the champion here?'] },
  giovanni: { bg: 'rgold', sweep: 'quake', quote: ['Kneel before Team Rocket.', 'Kanto belongs to Team Rocket!'] },
  rocket: { bg: 'alley', sweep: 'rush', quote: ['Thanks for the cash!', 'Team Rocket, full speed ahead!'] },
  you4: { bg: 'flames', sweep: 'flames', quote: ['Charge them!', 'Burn through their line!'] },
  you7: { bg: 'shield', sweep: 'shield', quote: ['Shields up!', 'Nobody falls today!'] },
  you1: { bg: 'bloom', sweep: 'bloom', quote: ['Hold on, team!', 'Grow strong together!'] },
};
function coTheme(e) { return COFX[e.co && e.co !== 'you' ? e.co : 'you' + (CAPTAINS[e.root] ? e.root : 7)] || COFX.you7; }
// How long each act lasts (seconds): the cast (the band) and the sweep over the field.
function copTimes(sup) { const f = BT.fast ? .6 : 1; return REDUCED ? { cast: sup ? 1.5 : 1.1, field: 0, open: .01 } : sup ? { cast: 2.7 * f, field: 1.4 * f, open: .3 } : { cast: 1.6 * f, field: .9 * f, open: .22 }; }
function copDur(e) { const T = copTimes(e.superPower); return T.cast + T.field; }

// What the power does, as chips: [icon, text]. Read from the commander's effect keys (or the Tactician's partner).
function copEffects(e) {
  const out = [], sup = !!e.superPower, pc = n => Math.round(n * 100);
  if (e.co && e.co !== 'you' && COS[e.co]) { const fx = sup ? COS[e.co].super : COS[e.co].power;
    if (fx.atk) out.push(['sword', fx.atkTypes ? TR('{0} moves +{1}%', fx.atkTypes.map(typeName).join('/'), pc(fx.atk)) : TR('+{0}% damage', pc(fx.atk))]);
    if (fx.spAtk) out.push(['sword', TR('Special moves +{0}%', pc(fx.spAtk))]);
    if (fx.def) out.push(['shield', TR('Take {0}% less', pc(fx.def))]);
    if (fx.eva) out.push(['wing', TR('+{0} evasion', fx.eva)]);
    if (fx.move) out.push(['run', TR('+{0} move', fx.move)]);
    if (fx.crit) out.push(['star', TR('Criticals +{0}%', fx.crit)]);
    if (fx.heal) out.push(['heart', TR('Heal {0}%', pc(fx.heal))]);
    if (fx.enemyDmg) out.push(['skull', TR('Foes take {0}%', pc(fx.enemyDmg))]);
    if (fx.enemyStatus) out.push(['skull', TRX({ par: 'Paralyses foes', psn: 'Poisons foes', brn: 'Burns foes', slp: 'Puts foes to sleep', frz: 'Freezes foes' }[fx.enemyStatus[0]] || 'Hurts foes')]);
    if (fx.enemyMove) out.push(['x', TR('Foes {0} move', fx.enemyMove)]);
    if (fx.weather) out.push(['sun', TR('{0} · {1} days', TRX(WEATHER[fx.weather[0]].name), fx.weather[1])]);
    if (fx.future) out.push(['eye', TR('Foes take {0}% next turn', pc(fx.future))]);
    if (fx.steal) out.push(['coin', TR('Steal {0}', money(fx.steal))]);
  } else { const r = CAPTAINS[e.root] ? e.root : 7;
    if (r === 4) out.push(['sword', TR('Next attack +{0}%', sup ? 50 : 25)]);
    if (r === 7) out.push(['shield', TR('Take {0}% less', sup ? 40 : 20)]);
    if (r === 1) { out.push(['heart', TR('Heal {0}%', sup ? 40 : 20)]); out.push(['heart', TRX(sup ? 'Cures and blocks new status' : 'Cures status')]); } }
  return out;
}
// Who wears the power while it lasts: the side's allies (a boost), the other side (a mark), and the badge each shows.
function copAura(team) {
  const s = powerState(team); if (!s || (!s.active && !s.future)) return null; const col = coOf(s).col;
  if (s.co && s.co !== 'you' && COS[s.co]) { const fx = s.active ? (s.active === 'super' ? COS[s.co].super : COS[s.co].power) : {};
    const icon = fx.def ? 'shield' : fx.eva ? 'wing' : fx.atk || fx.spAtk ? 'sword' : fx.move ? 'run' : fx.crit ? 'star' : null;
    return { col, ally: s.active && icon ? icon : null, foe: s.future ? 'eye' : s.active && fx.enemyMove ? 'x' : null, used: [] }; }
  if (!s.active) return null; const r = s.root;
  return { col, ally: r === 4 ? 'sword' : r === 7 ? 'shield' : r === 1 && s.active === 'super' ? 'heart' : null, foe: null, used: r === 4 ? s.used : [] };
}

// ---------------------------------------------------------------- pixel helpers
function copGrad(x, y, w, h, a, b) { const n = Math.max(2, Math.min(18, Math.round(h / 8))); for (let i = 0; i < n; i++) { const y0 = y + Math.round(h * i / n), y1 = y + Math.round(h * (i + 1) / n); rect(x, y0, w, y1 - y0, mix(a, b, i / (n - 1))); if (i < n - 1) { ctx.fillStyle = mix(a, b, (i + 1) / (n - 1)); for (let xx = x + (i & 1); xx < x + w; xx += 2) ctx.fillRect(xx, y1 - 1, 1, 1); } } }
function copHash(i, s = 0) { const n = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return n - Math.floor(n); }
function copBolt(x0, y0, x1, y1, seed, col, w = 2) { const n = 7; let px0 = x0, py0 = y0; for (let i = 1; i <= n; i++) { const k = i / n, nx = i === n ? x1 : Math.round(lerp(x0, x1, k) + (copHash(i, seed) - .5) * 26), ny = Math.round(lerp(y0, y1, k)); pline(px0, py0, nx, ny, col, w); if (w > 1) pline(px0, py0, nx, ny, '#ffffff', 1); px0 = nx; py0 = ny; } }
function copPetal(x, y, c, c2) { rect(x, y, 3, 2, c); px(x + 1, y - 1, c); px(x + 1, y, c2); }
function copFlower(x, y, c) { px(x, y - 1, c); px(x - 1, y, c); px(x + 1, y, c); px(x, y + 1, c); px(x, y, '#ffe06a'); }
function copHex(cx, cy, r, c) { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]); } for (let i = 0; i < 6; i++) pline(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], c, 1); }

// ---------------------------------------------------------------- the commanders' worlds (inside the band)
// Each draws the band's scene over (x, y, w, h) at time t; `col` is the commander's colour.
const COP_BG = {
  rock(x, y, w, h, t) { copGrad(x, y, w, h, '#5e4228', '#1a1008'); const bw = 34, bh = 22, off = Math.round(t * 10) % bw;
    for (let row = -1; row * bh < h + bh; row++) for (let col = -2; col * bw < w + bw * 2; col++) { const bx = x + col * bw - off + (row & 1 ? bw / 2 : 0), by = y + row * bh, seed = row * 31 + col * 17, sh = ['#5a3e24', '#6e4c2c', '#4c3420'][((seed % 3) + 3) % 3];
      rrect(bx + 1, by + 1, bw - 2, bh - 2, sh, 3); hline(bx + 4, by + 1, bw - 9, shade(sh, .35)); vline(bx + 1, by + 4, bh - 8, shade(sh, .18)); hline(bx + 3, by + bh - 2, bw - 6, shade(sh, -.45)); if (copHash(seed) > .55) { pline(bx + 9, by + 4, bx + 14, by + 10, shade(sh, -.55), 1); pline(bx + 14, by + 10, bx + 12, by + 16, shade(sh, -.55), 1); } }
    for (let i = 0; i < 3; i++) { const k = ((t * .5 + i * .34) % 1), bx = Math.round(x + w * (1.08 - k * 1.25)), by = Math.round(y + h * (-.2 + k * 1.3)), r = 9 + i * 3, a = t * 5 + i;
      ctx.globalAlpha = .35; for (let d = 1; d < 4; d++) circle(bx + d * 7, by - d * 6, Math.max(1, r - d * 3), '#c8a878'); ctx.globalAlpha = 1;
      circle(bx, by, r + 1, '#1a1008'); circle(bx, by, r, '#7a5a38'); circle(bx - 2, by - 2, r - 3, '#9a7650'); px(bx - r + 3, by - r + 4, '#e0c090'); pline(bx + Math.round(Math.cos(a) * (r - 2)), by + Math.round(Math.sin(a) * (r - 2)), bx, by, '#3a2614', 1); }
    ctx.globalAlpha = .22; for (let i = 0; i < 36; i++) { const mx = x + Math.round(((i * 53 + t * 70) % (w + 20)) - 10), my = y + Math.round(copHash(i) * h); rect(mx, my, 3, 1, '#e8c890'); } ctx.globalAlpha = 1; },
  sea(x, y, w, h, t) { copGrad(x, y, w, h, '#2a74d0', '#061a44');
    for (let j = 0; j < 5; j++) { const base = y + Math.round(h * (.25 + j * .17)), amp = 3 + j, sp = 1.4 + j * .5, colT = mix('#bfe6ff', '#3c9cf0', j / 5), colB = mix('#2a74d0', '#0a2a66', j / 5);
      for (let xx = x; xx < x + w; xx += 2) { const yy = base + Math.round(Math.sin(xx * .045 + t * sp + j * 1.7) * amp); rect(xx, yy, 2, 3, colT); rect(xx, yy + 3, 2, 2, colB); if ((xx + j * 7 + Math.floor(t * 8)) % 23 === 0) px(xx, yy - 1, '#ffffff'); } }
    for (let i = 0; i < 14; i++) { const bx = x + Math.round(copHash(i, 3) * w), by = y + h - Math.round(((t * (18 + i * 3) + i * 29) % (h + 10))), r = 1 + (i % 3); ctx.globalAlpha = .6; outline(bx - r, by - r, 2 * r + 1, 2 * r + 1, '#d8f0ff'); ctx.globalAlpha = 1; } },
  storm(x, y, w, h, t) { copGrad(x, y, w, h, '#2a2a48', '#08080e');
    for (let i = 0; i < 7; i++) { const cx = x + Math.round(((i * 97 - t * 14) % (w + 120) + w + 120) % (w + 120)) - 60, cy = y + 8 + (i % 3) * 7; ellipse(cx, cy, 34, 9, '#1a1a2c'); ellipse(cx + 10, cy - 3, 22, 7, '#262640'); }
    const bucket = Math.floor(t / .32), k = (t / .32) % 1; if (k < .35) { const bx = x + Math.round(copHash(bucket, 9) * w); if (k < .12) { ctx.globalAlpha = .35; rect(x, y, w, h, '#fff7c0'); ctx.globalAlpha = 1; } copBolt(bx, y, bx + Math.round((copHash(bucket, 4) - .5) * 60), y + h, bucket, '#ffe94a', 3); }
    ctx.globalAlpha = .35; for (let i = 0; i < 40; i++) { const rx = x + Math.round(((i * 37 + t * 160) % (w + 40)) - 20), ry = y + Math.round(((i * 53 + t * 220) % h)); pline(rx, ry, rx - 3, ry + 6, '#a0b0d8', 1); } ctx.globalAlpha = 1; },
  garden(x, y, w, h, t) { copGrad(x, y, w, h, '#3c8a4a', '#0c2a14');
    for (let i = 0; i < 40; i++) { const fx = x + Math.round(copHash(i, 5) * w), fy = y + Math.round(h * (.55 + copHash(i, 6) * .42)) + Math.round(Math.sin(t * 2 + i) * 1); vline(fx, fy, 4, '#2a6a2a'); copFlower(fx, fy, ['#ff8ac0', '#ffffff', '#ffb0d8', '#ffd24a'][i % 4]); }
    for (let i = 0; i < 26; i++) { const k = (t * .3 + i * .061) % 1, px0 = x + Math.round(w * (1 - k) + Math.sin(t * 2 + i) * 8 - 20 + copHash(i, 2) * 40), py0 = y + Math.round(k * h * 1.1 - 6); copPetal(px0, py0, '#ff8ac0', '#ffd0e4'); } },
  smoke(x, y, w, h, t) { copGrad(x, y, w, h, '#4a2460', '#0e0616');
    circle(x + Math.round(w * .82), y + Math.round(h * .22), 10, '#e8e0f0'); circle(x + Math.round(w * .82) + 4, y + Math.round(h * .22) - 2, 9, '#4a2460');
    for (let i = 0; i < 10; i++) { const k = (t * .12 + i * .1) % 1, sx = x + Math.round(w * k * 1.2 - 30), sy = y + Math.round(h * (.35 + copHash(i, 7) * .6)), r = 10 + (i % 4) * 5 + Math.round(k * 8); ctx.globalAlpha = .22; circle(sx, sy, r, '#b890d0'); ctx.globalAlpha = .12; circle(sx + 6, sy - 4, r - 3, '#e0c8f0'); } ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { const k = (t * .5 + i * .33) % 1, sx = x + Math.round(w * (1.1 - k * 1.2)), sy = y + Math.round(h * (.3 + i * .22)), a = t * 14 + i, r = 5; for (let q = 0; q < 4; q++) { const aa = a + q * Math.PI / 2; pline(sx, sy, Math.round(sx + Math.cos(aa) * r), Math.round(sy + Math.sin(aa) * r), '#d0d0e0', 2); } px(sx, sy, '#303040'); } },
  psy(x, y, w, h, t) { copGrad(x, y, w, h, '#7a1a5a', '#18061a'); const cx = x + Math.round(w / 2), cy = y + Math.round(h / 2);
    for (let i = 0; i < 6; i++) { const r = Math.round(((t * 40 + i * 30) % 180)); ctx.globalAlpha = .45 * (1 - r / 180); afRing(cx, cy, r, .6, i % 2 ? '#ffb4da' : '#ffffff', 2); } ctx.globalAlpha = 1;
    ctx.globalAlpha = .16; for (let i = 0; i < 12; i++) { const a = t * .4 + i * Math.PI / 6; pline(cx, cy, Math.round(cx + Math.cos(a) * w), Math.round(cy + Math.sin(a) * w * .6), '#ff5aa8', 3); } ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) { const ex = x + Math.round(w * (.12 + i * .19)), ey = y + Math.round(h * (.2 + (i % 2) * .55)) + Math.round(Math.sin(t * 2 + i) * 3), open = Math.sin(t * 1.3 + i * 1.1) > -.2; ellipse(ex, ey, 6, open ? 3 : 1, '#ffd0e8'); if (open) { circle(ex, ey, 2, '#7a1a5a'); px(ex, ey, '#ffffff'); } } },
  volcano(x, y, w, h, t) { copGrad(x, y, w, h, '#8a2a0e', '#1a0604'); const vx = x + Math.round(w * .7), base = y + h;
    for (let j = 0; j < Math.round(h * .75); j++) { const half = Math.round(12 + j * .9), yy = base - Math.round(h * .75) + j; rect(vx - half, yy, half * 2, 1, mix('#3a1208', '#1a0804', j / h)); }
    const top = base - Math.round(h * .75); ctx.globalAlpha = .5 + .3 * Math.sin(t * 6); circle(vx, top, 14, '#ff6a18'); ctx.globalAlpha = 1; rect(vx - 10, top, 20, 3, '#ffc03a');
    for (let i = 0; i < 30; i++) { const k = (t * (.5 + (i % 5) * .1) + i * .037) % 1, ex = vx + Math.round((copHash(i, 8) - .5) * 90 * k + Math.sin(t * 3 + i) * 3), ey = top - Math.round(k * h * .9); px(ex, ey, k < .5 ? '#ffe06a' : '#ff6a18'); if (i % 3 === 0) px(ex + 1, ey, '#ff9a2a'); }
    ctx.globalAlpha = .12; for (let j = 0; j < 6; j++) { const yy = y + Math.round(h * (.15 + j * .14)); for (let xx = x; xx < x + w; xx += 3) px(xx, yy + Math.round(Math.sin(xx * .1 + t * 5 + j) * 1), '#ffd0a0'); } ctx.globalAlpha = 1; },
  champ(x, y, w, h, t) { copGrad(x, y, w, h, '#2446a8', '#08103a'); const cx = x + Math.round(w * .5), cy = y + Math.round(h * .55);
    ctx.globalAlpha = .14; ctx.fillStyle = '#ffd24a'; for (let i = 0; i < 12; i++) { const a = t * .5 + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - .12) * w, cy + Math.sin(a - .12) * w); ctx.lineTo(cx + Math.cos(a + .12) * w, cy + Math.sin(a + .12) * w); ctx.fill(); } ctx.globalAlpha = 1;
    for (let i = 0; i < 22; i++) { const sx = x + Math.round(copHash(i, 11) * w), sy = y + Math.round(copHash(i, 12) * h), tw = Math.sin(t * 4 + i * 1.3); if (tw > .3) sparkle(sx, sy, tw > .8 ? 2 : 1, '#fff2b0'); }
    for (let i = 0; i < 16; i++) { const k = (t * .4 + i * .0625) % 1, cfx = x + Math.round(copHash(i, 13) * w + Math.sin(t * 3 + i) * 6), cfy = y + Math.round(k * h); rect(cfx, cfy, 2, 3, ['#ff5a6a', '#ffd24a', '#6ab0ff', '#6aff9a'][i % 4]); } },
  rgold(x, y, w, h, t) { copGrad(x, y, w, h, '#2a2018', '#050403'); const cx = x + Math.round(w / 2), cy = y + Math.round(h / 2);
    ctx.globalAlpha = .5; afRing(cx, cy, Math.round(h * .42), 1, '#b8a078', 3); ctx.globalAlpha = 1; const sc = h >= 150 ? 6 : h >= 100 ? 4 : 3, R = displayCanvas('R', 'red', sc, 0); ctx.globalAlpha = .55 + .15 * Math.sin(t * 3); ctx.drawImage(R.c, cx - Math.round(R.w / 2) - R.ox, cy - Math.round(R.h / 2) - R.oy); ctx.globalAlpha = 1; // the emblem, drawn as art
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3; let px0 = cx, py0 = cy; for (let s = 1; s <= 5; s++) { const nx = Math.round(cx + Math.cos(a) * s * h * .12 + (copHash(i * 5 + s) - .5) * 8), ny = Math.round(cy + Math.sin(a) * s * h * .1); pline(px0, py0, nx, ny, '#6a5030', 1); px0 = nx; py0 = ny; } }
    for (let i = 0; i < 24; i++) { const k = (t * .35 + i * .042) % 1, gx = x + Math.round(copHash(i, 14) * w), gy = y + Math.round(h * (1 - k)); px(gx, gy, k > .7 ? '#fff2b0' : '#d8b048'); } },
  alley(x, y, w, h, t) { copGrad(x, y, w, h, '#4a0e18', '#0a0204'); const off = Math.round(t * 12) % 28;
    const R = displayCanvas('R', 'red', 1, 0); ctx.globalAlpha = .18; for (let yy = y - 28 + off; yy < y + h; yy += 28) for (let xx = x + ((yy - y) / 28 & 1) * 14; xx < x + w; xx += 28) ctx.drawImage(R.c, xx - R.ox, yy - R.oy); ctx.globalAlpha = 1; // a pattern, not text
    for (let i = 0; i < 12; i++) { const k = (t * .6 + i * .083) % 1, cx = x + Math.round(copHash(i, 15) * w), cy = y + Math.round(k * h * 1.1) - 4; circle(cx, cy, 3, '#8a6a10'); circle(cx, cy, 2, '#ffd24a'); px(cx - 1, cy - 1, '#fff6c0'); } },
  flames(x, y, w, h, t) { copGrad(x, y, w, h, '#6a1a08', '#1a0402');
    for (let i = 0; i < Math.ceil(w / 10); i++) { const fx = x + i * 10 + Math.round(Math.sin(t * 5 + i) * 2), fh = Math.round(h * (.35 + .25 * Math.abs(Math.sin(t * 3.3 + i * 1.7)))), by = y + h; for (let j = 0; j < fh; j++) { const k = j / fh, half = Math.round(6 * (1 - k)); rect(fx - half, by - j, half * 2 + 1, 1, k < .3 ? '#ffc03a' : k < .6 ? '#ff6a18' : '#c42a0a'); } }
    for (let i = 0; i < 24; i++) { const k = (t * .8 + i * .042) % 1, sx = x + Math.round(copHash(i, 16) * w + Math.sin(t * 4 + i) * 4), sy = y + h - Math.round(k * h); px(sx, sy, k < .5 ? '#fff6b0' : '#ffc03a'); } },
  shield(x, y, w, h, t) { copGrad(x, y, w, h, '#1f5a94', '#06142e'); const r = 12, dx = r * 1.5, dy = r * 1.74, sweep = (t * .5 % 1) * (w + 80) - 40;
    for (let row = -1; row * dy < h + dy; row++) for (let col = -1; col * dx < w + dx; col++) { const cx = x + Math.round(col * dx), cy = y + Math.round(row * dy + (col & 1) * dy / 2), near = Math.abs(cx - x - sweep) < 30; ctx.globalAlpha = near ? .8 : .28; copHex(cx, cy, r - 1, near ? '#e0f4ff' : '#72bcef'); } ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { const bx = x + Math.round(copHash(i, 17) * w), by = y + h - Math.round(((t * (14 + i * 2) + i * 31) % (h + 8))); ctx.globalAlpha = .6; outline(bx - 1, by - 1, 3, 3, '#d8f0ff'); ctx.globalAlpha = 1; } },
  bloom(x, y, w, h, t) { copGrad(x, y, w, h, '#2a6e36', '#08200e');
    for (let v = 0; v < 6; v++) { const side = v % 2, sx = side ? x + w : x, sy = y + Math.round(h * (.15 + v * .14)), grow = Math.min(1, t * .9 + v * .05), len = Math.round(w * .35 * grow); let px0 = sx, py0 = sy;
      for (let s = 1; s <= 12; s++) { const k = s / 12; if (k > grow) break; const nx = Math.round(sx + (side ? -1 : 1) * len * k), ny = Math.round(sy + Math.sin(k * 6 + v) * 6); pline(px0, py0, nx, ny, '#3a9a3a', 2); if (s % 3 === 0) { rect(nx, ny - 2, 3, 2, '#6cd05a'); if (grow >= 1 && s % 6 === 0) copFlower(nx, ny - 4, '#ff8ac0'); } px0 = nx; py0 = ny; } }
    for (let i = 0; i < 20; i++) { const k = (t * .5 + i * .05) % 1, gx = x + Math.round(copHash(i, 18) * w), gy = y + h - Math.round(k * h); px(gx, gy, k > .6 ? '#e8ffd0' : '#8ae870'); } },
};

// ---------------------------------------------------------------- the cast: the band, the commander, the name
function copBandEdge(top, h, W, s) { return j => { const k = j / Math.max(1, W); return [Math.round(top + s - 2 * s * k), Math.round(top + h + s - 2 * s * k)]; }; }
function drawCoPower(q) {
  const e = q.ev, T = copTimes(e.superPower), t = q.t; q.cfx = q.cfx || { parts: [], cues: {} };
  if (t < T.cast) drawCoCast(q, t, T); else drawCoSweep(q, t - T.cast, T.field);
}
function copCue(q, key, at, fn) { if (!q.cfx.cues[key] && q.t >= at) { q.cfx.cues[key] = true; fn(); } }
function drawCoCast(q, t, T) {
  const W = VIEW.w, H = VIEW.h, e = q.ev, sup = !!e.superPower, c = coOf({ co: e.co, root: e.root }), th = coTheme(e), col = c.col, side = e.team === 1 ? 1 : 0, trainerCo = e.co && e.co !== 'you' && COS[e.co];
  const out = REDUCED ? 0 : clamp((t - (T.cast - .26)) / .26, 0, 1), open = REDUCED ? 1 : easeOutBack(clamp((t - .05) / T.open, 0, 1), 1.5), portrait = H > W * 1.15;
  // sound: a riser, the band tearing open, the name landing, the Ace's roar
  copCue(q, 'a', 0, () => { Audio.sfx(sup ? 'charge' : 'phase'); if (sup) Audio.sfx('evolve'); });
  copCue(q, 'b', .08, () => Audio.sfx('whoosh')); copCue(q, 'n', sup ? .62 : .42, () => { Audio.sfx('stamp'); if (sup) Audio.sfx('boom'); if (!REDUCED) shake(sup ? 6 : 3); });
  if (sup) copCue(q, 'r', .95, () => { if (typeof atkSfx === 'function') atkSfx('roar'); if (!REDUCED) shake(4); });
  copCue(q, 'x', T.cast - .24, () => Audio.sfx('wipe'));
  ctx.globalAlpha = Math.min(1, t / .12) * .8 * (1 - out * .6); rect(0, 0, W, H, '#04030e'); ctx.globalAlpha = 1;
  const BH = Math.round(Math.min(H * (portrait ? (sup ? .42 : .34) : sup ? .64 : .5), sup ? 220 : 150) * clamp(open, 0, 1.08) * (1 - easeIn(out))), cy = Math.round(portrait ? H * .36 : H * .5), top = cy - Math.round(BH / 2), s = Math.round(W * .045), edge = copBandEdge(top, BH, W, s);
  if (BH > 2) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, top + s); ctx.lineTo(W, top - s); ctx.lineTo(W, top + BH - s); ctx.lineTo(0, top + BH + s); ctx.closePath(); ctx.clip();
    (COP_BG[th.bg] || COP_BG.shield)(0, top - s, W, BH + 2 * s, t, col);
    // speed lines running away from the commander's side
    if (!REDUCED) { ctx.globalAlpha = .28; for (let i = 0; i < 16; i++) { const ly = top - s + 4 + (i * 17) % Math.max(6, BH + 2 * s - 8), len = 20 + (i * 29) % 70, run = (t * (380 + i * 60) + i * 97) % (W + len * 2), lx = side ? run - len : W - run; rect(Math.round(lx), ly, len, 1, '#ffffff'); } ctx.globalAlpha = 1; }
    // the Ace roars behind, large; the commander slides in from their side, a white silhouette on arrival
    const k2 = !portrait && BH >= 170 && W >= 560 ? 3 : W >= 300 && BH >= 100 ? 2 : 1, tx = side ? W - Math.round(W * (portrait ? .27 : .2)) : Math.round(W * (portrait ? .27 : .2)), slide = REDUCED ? 0 : Math.round((1 - easeOut(clamp((t - .12) / .3, 0, 1))) * (side ? 1 : -1) * W * .5) + Math.round(out * (side ? 1 : -1) * W * .4);
    const num = e.unit ? (e.unit.fx && e.unit.fx.showNum || e.unit.num) : trainerCo ? COS[e.co].ace : e.root; requestAnim(num); requestBigSprite(num);
    if (sup) { const roar = clamp((t - .95) / .16, 0, 1), rk = k2 + (roar > 0 && roar < 1 && !REDUCED ? 1 : 0), ax = side ? tx + Math.round(26 * k2) : tx - Math.round(26 * k2), base = top + BH + s - 4; // it looms behind its commander
      if (roar > 0 && roar < 1 && !REDUCED) { ctx.globalAlpha = .45 * (1 - roar); circle(ax, base - 24 * k2, Math.round(30 * k2 * roar + 10), '#ffffff'); ctx.globalAlpha = 1; }
      ctx.globalAlpha = .92; if (animReady(num)) drawAnim(num, ax + Math.round(slide * .6), base, t * 1.4, { flip: side === 0, sx: rk, sy: rk }); else drawBig(num, ax + Math.round(slide * .6), base, { flip: side === 0, sx: rk / 2, sy: rk / 2 }); ctx.globalAlpha = 1; }
    const trainer = trainerCanvas(trainerCo ? COS[e.co].tr : 'red', side === 1, false); if (trainer) { const size = 80 * k2, head = (TRAINER_HEADS[trainerCo ? COS[e.co].tr : 'red'] || [40, 6])[1] * k2, ty = Math.max(top - s + 4 - head, top + BH + s - size), arrive = t - .42;
      ctx.drawImage(trainer, Math.round(tx - size / 2) + slide, ty + (REDUCED ? 0 : Math.round(Math.sin(t * 2.2))), size, size);
      if (arrive > 0 && arrive < .1 && !REDUCED) { ctx.globalAlpha = .6 * (1 - arrive / .1); ctx.drawImage(trainerCanvas(trainerCo ? COS[e.co].tr : 'red', side === 1, false), Math.round(tx - size / 2) + slide, ty, size, size); rect(0, top - s, W, BH + 2 * s, '#ffffff'); ctx.globalAlpha = 1; } }
    ctx.restore();
    // the band's rims: white over ink, slanted
    for (let xx = 0; xx < W; xx++) { const [a, b] = edge(xx); rect(xx, a - 2, 1, 2, '#ffffff'); px(xx, a - 3, UI.inset); rect(xx, b, 1, 2, '#ffffff'); px(xx, b + 2, UI.inset); }
  }
  // the name slams down on the far side (under the band on a phone), SUPER POWER over it; then the line and the chips
  const nt = t - (sup ? .62 : .42); if (nt > -.2 && BH > 20) {
    const name = String(TRX(sup ? c.super.name : c.power.name)).toUpperCase() + '!', maxW = portrait ? W - 16 : W * .56, sc = displayWidth(name, 3) <= maxW ? 3 : displayWidth(name, 2) <= maxW ? 2 : 1, slam = REDUCED ? 0 : clamp(1 - nt / .1, 0, 1);
    const nx = portrait ? Math.round(W / 2) : side ? Math.round(W * .31) : Math.round(W * .69), ny = portrait ? top + BH + s + 16 : cy - Math.round(11 * sc / 2) - 8 - (sup ? 6 : 0), ox = Math.round(out * (side ? -1 : 1) * W);
    if (nt >= 0) { const drawSc = slam > 0 && displayWidth(name, sc + 1) <= W - 8 ? sc + 1 : sc, jig = slam > 0 ? Math.round(Math.sin(nt * 90) * 3) : 0, half = Math.ceil(displayWidth(name, drawSc) / 2) + 4, cx = clamp(nx + jig, half, W - half); // the slam never pushes it off the screen
      const lab = sup ? 'SUPER POWER' : 'POWER', lw = textWidth(lab) + 12; ribbonTab(lab, Math.round(nx - lw / 2) + ox, ny - 15, sup ? UI.gold : col);
      displayC(name, cx + ox, ny + (drawSc > sc ? -Math.round(5.5 * (drawSc - sc)) : 0), { style: sup ? 'gold' : 'silver', scale: drawSc, slant: 1, shine: true, phase: .3 });
      if (nt < .08 && !REDUCED) { ctx.globalAlpha = .5 * (1 - nt / .08); rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; } }
    // the commander's line, typed out
    const qt = t - (sup ? .95 : .62), quote = TRX(th.quote[sup ? 1 : 0]);
    let qh = 0; if (qt > 0) { const full = TR('"{0}"', quote), room = Math.min(W - 12, maxW + 30) - 12, ls = wrap(full, room).slice(0, 2), qw = Math.max(...ls.map(l => rawTextWidth(l))) + 12, qy = ny + Math.round(11 * sc) + 6, qx = clamp(Math.round(nx - qw / 2) + ox, 4, W - qw - 4); qh = ls.length * 9 + 5;
      ctx.globalAlpha = .85; rrect(qx, qy, qw, qh, '#07061a', 2); ctx.globalAlpha = 1; outline(qx, qy, qw, qh, shade(col, .2)); let left = REDUCED ? 1e9 : Math.floor(qt * 40); ls.forEach((l, i) => { if (left <= 0) return; text(l.slice(0, left), qx + 6, qy + 3 + i * 9, '#ffffff', { raw: true }); left -= l.length; }); }
    // what it does, one chip after another
    const ct = t - (sup ? 1.3 : .82), chips = copEffects(e); if (ct > 0 && chips.length) { const cy2 = ny + Math.round(11 * sc) + (qt > 0 ? qh + 11 : 8); copChips(chips, clamp(nx + ox, 70, W - 70), cy2, portrait ? W - 12 : maxW + 40, ct); }
  }
}
// The effect chips, centred on cx, wrapping when they do not fit; each pops in after the one before.
function copChips(chips, cx, y, maxW, t) {
  const ws = chips.map(([, s]) => textWidth(s) + 18), rows = []; let row = [], w = 0;
  chips.forEach((ch, i) => { if (row.length && w + ws[i] + 4 > maxW) { rows.push(row); row = []; w = 0; } row.push(i); w += ws[i] + 4; }); if (row.length) rows.push(row);
  rows.forEach((r, ri) => { const tw = r.reduce((a, i) => a + ws[i] + 4, -4); let x = clamp(Math.round(cx - tw / 2), 4, VIEW.w - 4 - tw); for (const i of r) { const k = REDUCED ? 1 : easeOutBack(clamp((t - i * .09) / .2, 0, 1), 2.2); if (k <= 0) { x += ws[i] + 4; continue; } const yy = y + ri * 15 + Math.round((1 - k) * 6);
    ctx.globalAlpha = clamp(k, 0, 1); rrect(x, yy, ws[i], 13, UI.inset, 2); rect(x + 1, yy + 1, ws[i] - 2, 11, '#1c2058'); hline(x + 2, yy + 1, ws[i] - 4, '#3a3f90'); iconAt(chips[i][0], x + 3, yy + 2, chips[i][0] === 'skull' || chips[i][0] === 'x' ? '#ff9a9a' : UI.gold); text(chips[i][1], x + 15, yy + 3, UI.ink); ctx.globalAlpha = 1;
    if (!REDUCED && CLOCK.frame && Math.floor((t - i * .09) * 60) === 1) Audio.sfx('tick'); x += ws[i] + 4; } });
}

// ---------------------------------------------------------------- the sweep over the field
function copScreen(u) { return { x: Math.round((u.x * TILE + TILE / 2 - CAM.x + FX.shakeX) * BT.zoom), y: Math.round((u.y * TILE + TILE / 2 - CAM.y + FX.shakeY) * BT.zoom) }; }
function drawCoSweep(q, t, dur) {
  if (dur <= 0) return; const W = VIEW.w, H = VIEW.h, e = q.ev, th = coTheme(e), col = coOf({ co: e.co, root: e.root }).col, k = clamp(t / dur, 0, 1), dir = e.team === 1 ? -1 : 1;
  const front = dir > 0 ? Math.round(-80 + (W + 200) * easeInOut(clamp(k * 1.15, 0, 1))) : Math.round(W + 80 - (W + 200) * easeInOut(clamp(k * 1.15, 0, 1)));
  const allies = B.units.filter(u => u.hp > 0 && u.team === e.team && !fogHides(u, HT())), foes = B.units.filter(u => u.hp > 0 && u.team <= 1 && u.team !== e.team && !fogHides(u, HT()));
  copCue(q, 's0', q.t - t, () => { const snd = { sand: 'whoosh', wave: 'water', storm: 'elec', petals: 'grass', smoke: 'whoosh', psy: 'psy', meteors: 'fire', gold: 'chime', quake: 'thud', rush: 'whoosh', flames: 'fire', shield: 'water', bloom: 'heal' }[th.sweep]; Audio.sfx(snd || 'whoosh'); if (typeof atkSfx === 'function') atkSfx({ sand: 'wind', wave: 'splash', storm: 'thunder', petals: 'wind', smoke: 'wind', psy: 'psywave', meteors: 'blast', gold: 'sparkle', quake: 'quake', rush: 'wind', flames: 'blast', shield: 'bubbles', bloom: 'sparkle' }[th.sweep] || 'wind'); if ((th.sweep === 'quake' || th.sweep === 'meteors') && !REDUCED) shake(8); });
  const env = Math.min(1, k / .12) * (1 - clamp((k - .72) / .28, 0, 1)), veil = (c, a) => { ctx.globalAlpha = a * env; rect(0, 0, W, H, c); ctx.globalAlpha = 1; }, behind = x => (front - x) * dir;
  switch (th.sweep) {
    case 'sand': veil('#d8b878', .22); for (let x = 0; x < W; x++) { const d = behind(x); if (d < 0) continue; ctx.globalAlpha = (d < 120 ? .8 * (1 - d / 120) + .12 : .12) * env; vline(x, 0, H, d < 26 ? '#f4e2b4' : '#d0ae70'); } ctx.globalAlpha = 1;
      for (let i = 0; i < 200; i++) { const yy = Math.round(copHash(i, 21) * H), xx = front - dir * Math.round(copHash(i, 22) * 200) + Math.round(Math.sin(t * 9 + i) * 3); ctx.globalAlpha = .9 * env; rect(xx, yy, 5, 1, i % 3 ? '#fff0c8' : '#a07c44'); } ctx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { const bx = front - dir * (20 + i * 26), by = Math.round(H * (.2 + i * .15)) + Math.round(Math.sin(t * 7 + i) * 6), r = 3 + (i % 3); circle(bx, by, r + 1, '#2a1a0c'); circle(bx, by, r, '#8a6a44'); px(bx - 1, by - 1, '#c8a878'); } break;
    case 'wave': veil('#6aa8e8', .16); { const crest = [];
      for (let x = 0; x < W; x++) { const d = behind(x); if (d < -3 || d > 230) continue; const prof = d < 4 ? (d + 3) / 7 : d < 70 ? 1 : Math.max(0, 1 - (d - 70) / 160), hgt = Math.round(H * .92 * prof * env + Math.sin(x * .07 + t * 10) * 4); if (hgt <= 2) continue; const top = H - hgt; crest.push([x, top, d]);
        ctx.globalAlpha = .72; vline(x, top, Math.min(10, hgt), '#9ad8ff'); if (hgt > 10) vline(x, top + 10, Math.round((hgt - 10) * .5), '#3c9cf0'); if (hgt > 10) vline(x, top + 10 + Math.round((hgt - 10) * .5), hgt - 10 - Math.round((hgt - 10) * .5), '#1c5cc4');
        ctx.globalAlpha = .5; for (let yy = top + 14 + ((x * 7 + Math.floor(t * 20)) % 16); yy < H; yy += 16) hline(x, yy, 1, '#d8f0ff'); }
      ctx.globalAlpha = 1; for (const [x, top, d] of crest) { rect(x, top - 1, 1, 3, '#ffffff'); if (d < 22) { const curl = Math.round((22 - d) * .55); vline(x, top - curl - 2, curl + 1, d < 8 ? '#ffffff' : '#e8f6ff'); if (d < 6) vline(x, top - curl + 3, 4, '#bfe6ff'); } }
      for (let i = 0; i < 70; i++) { const sx = front + dir * Math.round(copHash(i, 40) * 26) - dir * 6, sy = Math.round(H * (1 - .92 * env)) - 10 - Math.round(copHash(i, 42) * 26) + Math.round(copHash(i, 41) * 18), a = .9 * env; ctx.globalAlpha = a; rect(sx, sy, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#ffffff'); } ctx.globalAlpha = 1;
      for (let x = 0; x < W; x += 3) { const d = behind(x); if (d < 0 || d > 230) continue; ctx.globalAlpha = .6 * env; rect(x, H - 4 - ((x + Math.floor(t * 30)) % 3), 2, 1, '#ffffff'); } ctx.globalAlpha = 1; break; }
    case 'storm': veil('#070714', .58); { const cy0 = Math.round(H * .08); for (let i = 0; i < 12; i++) { const cx = Math.round(((i * 83 - t * 60 * dir) % (W + 160) + W + 160) % (W + 160)) - 80, cyy = cy0 + (i % 3) * 9; ctx.globalAlpha = .9 * env; ellipse(cx, cyy, 44, 14, '#1c1c30'); ellipse(cx + 16, cyy - 5, 28, 10, '#2a2a46'); } }
      ctx.globalAlpha = .45 * env; for (let i = 0; i < 70; i++) { const rx = Math.round(((i * 37 + t * 260) % (W + 40)) - 20), ry = Math.round(((i * 53 + t * 380) % H)); pline(rx, ry, rx - 4, ry + 9, '#b0c0e8', 1); } ctx.globalAlpha = 1;
      { const targets = foes.length ? foes : allies, b = Math.floor(t / .2), ph = (t / .2) % 1; if (ph < .45 && targets.length) { const tg = targets[b % targets.length], p = copScreen(tg); if (ph < .15) veil('#fff7c0', .45); ctx.globalAlpha = env; copBolt(p.x + Math.round((copHash(b, 24) - .5) * 60), 0, p.x, p.y, b, '#ffe94a', 4); circle(p.x, p.y + 4, Math.round(12 * (1 - ph)), '#fff7c0'); ctx.globalAlpha = 1; } } break;
    case 'petals': veil('#ffb0d8', .16); for (let i = 0; i < 320; i++) { const ppx = front - dir * Math.round(copHash(i, 26) * 300) + Math.round(Math.sin(t * 6 + i) * 12), ppy = Math.round(((copHash(i, 27) * H + t * 70 * (1 + copHash(i, 3))) % H) + Math.sin(t * 3 + i) * 10), turn = (Math.floor(t * 12) + i) % 4; ctx.globalAlpha = env;
        const c1 = i % 5 ? '#ff7ab4' : '#ffffff', c2 = i % 5 ? '#ffc8e0' : '#ffe8f2'; if (turn < 2) { rect(ppx, ppy, 5, 2, c1); rect(ppx + 1, ppy - 1, 3, 1, c2); px(ppx + 4, ppy + 2, c1); } else { rect(ppx, ppy, 2, 5, c1); rect(ppx - 1, ppy + 1, 1, 3, c2); px(ppx + 2, ppy + 4, c1); } } ctx.globalAlpha = 1; break;
    case 'smoke': veil('#2a1438', .3); for (let i = 0; i < 44; i++) { const d = copHash(i, 28) * 300, sx = front - dir * Math.round(d), sy = Math.round(copHash(i, 29) * (H + 40)) - 20, r = 18 + (i % 6) * 5 + Math.round(t * 10); ctx.globalAlpha = .34 * env; circle(sx, sy, r, '#9a70b8'); ctx.globalAlpha = .2 * env; circle(sx + 6, sy - 5, r - 5, '#e0c8f0'); } ctx.globalAlpha = 1; break;
    case 'psy': { veil('#ff5aa8', .1 + .06 * Math.sin(t * 20)); const o = e.unit ? copScreen(e.unit) : { x: W / 2, y: H / 2 }; for (let i = 0; i < 6; i++) { const r = Math.round(k * (W + H) * 1.1 - i * 26); if (r <= 0) continue; ctx.globalAlpha = .7 * env; afRing(o.x, o.y, r, .62, i % 2 ? '#ffffff' : '#ff5aa8', 3); } ctx.globalAlpha = 1;
      if (e.superPower) for (const f of foes) { const p = copScreen(f), open = clamp((k - .4) / .2, 0, 1); if (open <= 0) continue; ctx.globalAlpha = env; ellipse(p.x, p.y - 18, 8, Math.max(1, Math.round(4 * open)), '#ffd0e8'); if (open > .5) { circle(p.x, p.y - 18, 2, '#c0287a'); px(p.x, p.y - 18, '#ffffff'); } ctx.globalAlpha = 1; } break; }
    case 'meteors': veil('#ff7030', .18); { const targets = foes.length ? foes : allies; for (let i = 0; i < 16; i++) { const s0 = i * .05, kk = clamp((t - s0) / .42, 0, 1); if (kk <= 0) continue; const tg = i < targets.length * 2 ? targets[i % targets.length] : null, p = tg ? copScreen(tg) : { x: Math.round(copHash(i, 43) * W), y: Math.round(H * (.3 + copHash(i, 44) * .6)) }, sx = p.x + Math.round(120 * (1 - kk)) * dir, sy = p.y - Math.round(170 * (1 - kk));
        if (kk < 1) { for (let j = 0; j < 12; j++) { ctx.globalAlpha = (1 - j / 12) * env; circle(sx + j * 4 * dir, sy - j * 5, Math.max(1, 6 - (j >> 1)), j < 2 ? '#fff6b0' : j < 5 ? '#ffc03a' : '#ff6a18'); } ctx.globalAlpha = 1; } else { const bt = clamp((t - s0 - .42) / .25, 0, 1); if (bt < 1) { ctx.globalAlpha = (1 - bt) * env; circle(p.x, p.y, Math.round(6 + bt * 16), '#ffc03a'); circle(p.x, p.y, Math.round(3 + bt * 8), '#fff6b0'); ctx.globalAlpha = 1; } } } } break;
    case 'gold': veil('#ffd24a', .12); for (let i = 0; i < 70; i++) { const ly = Math.round(copHash(i, 30) * H), len = 30 + Math.round(copHash(i, 31) * 80), lx = front - dir * Math.round(copHash(i, 32) * 260); ctx.globalAlpha = .75 * env; rect(lx - (dir > 0 ? len : 0), ly, len, i % 6 ? 1 : 2, i % 4 ? '#ffd24a' : '#ffffff'); } ctx.globalAlpha = 1; for (let i = 0; i < 20; i++) { const sx = Math.round(copHash(i, 45) * W), sy = Math.round(copHash(i, 46) * H); if (Math.sin(t * 9 + i) > .4) sparkle(sx, sy, 2, '#fff2b0'); } break;
    case 'quake': { veil('#5a3a1a', .16); const o = e.unit ? copScreen(e.unit) : { x: W / 2, y: H / 2 }; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + .2; let px0 = o.x, py0 = o.y; const n = Math.round(16 * clamp(k * 1.6, 0, 1)); for (let s2 = 1; s2 <= n; s2++) { const nx = Math.round(o.x + Math.cos(a) * s2 * 30 + (copHash(i * 17 + s2) - .5) * 14), ny = Math.round(o.y + Math.sin(a) * s2 * 20); ctx.globalAlpha = env; pline(px0, py0, nx, ny, '#1a0e04', 3); pline(px0, py0 - 1, nx, ny - 1, '#d8b888', 1); if (s2 === n && k < .7) { ctx.globalAlpha = .5 * env; circle(nx, ny, 5, '#c8a878'); } px0 = nx; py0 = ny; } } ctx.globalAlpha = 1; if (k < .6 && !REDUCED && Math.floor(t * 30) % 2 === 0) shake(3); break; }
    case 'rush': veil('#ff3040', .12); for (let i = 0; i < 60; i++) { const ly = Math.round(copHash(i, 33) * H), len = 24 + Math.round(copHash(i, 34) * 70), lx = front - dir * Math.round(copHash(i, 35) * 240); ctx.globalAlpha = .7 * env; rect(lx - (dir > 0 ? len : 0), ly, len, i % 4 ? 2 : 3, i % 3 ? '#ff5a6a' : '#ffffff'); } ctx.globalAlpha = 1; break;
    case 'flames': veil('#ff6a18', .14); for (let x = 0; x < W; x += 6) { const d = behind(x); if (d < 0 || d > 260) continue; const fh = Math.round(H * .42 * env * (1 - d / 260) * (.6 + .4 * Math.abs(Math.sin(t * 7 + x * .3)))); for (let j = 0; j < fh; j += 2) { const kk = j / Math.max(1, fh), half = Math.round(4 * (1 - kk)) + 1; ctx.globalAlpha = .85; rect(x - half, H - j, half * 2 + 1, 2, kk < .3 ? '#fff0a0' : kk < .6 ? '#ff9a2a' : '#d02a0a'); } } ctx.globalAlpha = 1; break;
    case 'shield': { veil('#72bcef', .1); const r = 14, dx = r * 1.5, dy = r * 1.74, sweep = front; for (let row = -1; row * dy < H + dy; row++) for (let c2 = -1; c2 * dx < W + dx; c2++) { const cx = Math.round(c2 * dx), cy = Math.round(row * dy + (c2 & 1) * dy / 2), d = Math.abs(cx - sweep); if (d > 90) continue; ctx.globalAlpha = (1 - d / 90) * .8 * env; copHex(cx, cy, r - 1, d < 20 ? '#ffffff' : '#9cdcff'); } ctx.globalAlpha = 1; break; }
    case 'bloom': veil('#8ae870', .1); for (let i = 0; i < 140; i++) { const gx = front - dir * Math.round(copHash(i, 47) * 240), gy = Math.round(copHash(i, 48) * H) - Math.round(t * 30 * copHash(i, 49)); ctx.globalAlpha = env; if (i % 4 === 0) copFlower(gx, gy, i % 8 ? '#ff8ac0' : '#ffffff'); else px(gx, gy, i % 2 ? '#8ae870' : '#e8ffd0'); } ctx.globalAlpha = 1; break;
  }
  // then every Pokémon the power touches lights up where it stands: its colour rising, a ring, sparks
  const touched = th.sweep === 'storm' || th.sweep === 'meteors' || (th.sweep === 'psy' && e.superPower) ? foes : allies, burst = clamp((k - .3) / .55, 0, 1), fc = touched === foes ? '#ff9a9a' : col;
  if (burst > 0 && burst < 1) for (const u of touched) { const p = copScreen(u), a = 1 - burst; ctx.globalAlpha = a; afRing(p.x, p.y + 6, Math.round(8 + burst * 24), .45, fc, 2); afRing(p.x, p.y + 6, Math.round(4 + burst * 12), .45, '#ffffff', 1);
    if (th.sweep === 'flames') for (let j = 0; j < 6; j++) { const fx = p.x - 10 + j * 4, fh = Math.round((12 + (j % 2) * 8) * (1 - burst)); for (let q2 = 0; q2 < fh; q2++) px(fx, p.y + 12 - q2, q2 < fh * .4 ? '#ffc03a' : '#ff6a18'); }
    else if (th.sweep === 'shield') { copHex(p.x, p.y, 13 + Math.round(burst * 5), '#ffffff'); copHex(p.x, p.y, 11 + Math.round(burst * 5), '#72bcef'); }
    else if (th.sweep === 'bloom') { for (let j = 0; j < 5; j++) copFlower(p.x - 12 + j * 6, p.y + 10 - Math.round(burst * 8) - (j % 2) * 3, '#ff8ac0'); }
    else if (th.sweep === 'sand') { const rise = Math.round(Math.min(1, burst * 2.5) * 12); for (let j = 0; j < 3; j++) { const sx = p.x - 13 + j * 9, sh = rise - (j === 1 ? 0 : 3); if (sh <= 0) continue; rect(sx, p.y + 13 - sh, 7, sh, '#7a5a38'); hline(sx, p.y + 13 - sh, 7, '#b08a5c'); vline(sx + 6, p.y + 14 - sh, sh - 1, '#4a3420'); } }
    else for (let j = 0; j < 6; j++) sparkle(p.x - 10 + j * 4, p.y - Math.round(burst * 20) + (j % 2) * 4, j % 3 ? 1 : 2, touched === foes ? '#ffd0d0' : '#ffffff');
    ctx.globalAlpha = 1; }
}

// ---------------------------------------------------------------- while it lasts: auras and badges on the board
// Board space (inside the zoom). 'under' draws a glow at the feet of every Pokémon a live power helps; 'over' draws its
// badge over the head (a sword for damage, a shield for defence, wings for evasion, boots for movement, a star for
// criticals), and a mark over the ones it hinders (an eye for Future Sight, a cross for lost movement).
function drawPowerAuras(units, layer) {
  if (!B || !B.command) return; const t = BT.time;
  for (const team of [0, 1]) { const A = copAura(team); if (!A) continue;
    for (const u of units) { if (u.hp <= 0 || u.team > 1 || fogHides(u, HT())) continue; const mine = u.team === team, icon = mine ? A.ally : A.foe; if (!icon || (mine && A.used.includes(u.id))) continue;
      const cx = tileX(u.x) + TILE / 2 + Math.round(u.fx.dx || 0), fy = tileY(u.y) + TILE - 5 + Math.round(u.fx.dy || 0), col = mine ? A.col : '#ff5a6a';
      if (layer === 'under') { const p = REDUCED ? .5 : .5 + .5 * Math.sin(t * 4 + u.x); ctx.globalAlpha = .22 + .18 * p; ellipse(cx, fy, 13, 4, col); ctx.globalAlpha = .5 + .3 * p; afRing(cx, fy, 12, .32, shade(col, .3), 1); ctx.globalAlpha = 1;
        if (!REDUCED && mine) for (let j = 0; j < 2; j++) { const kk = (t * .8 + j * .5 + u.id * .13) % 1, sx = cx - 8 + Math.round(copHash(u.id * 3 + j) * 16), sy = fy - Math.round(kk * 22); ctx.globalAlpha = 1 - kk; px(sx, sy, shade(col, .5)); ctx.globalAlpha = 1; } }
      else { const bob = REDUCED ? 0 : Math.round(Math.sin(t * 3 + u.id) * 1), bx = tileX(u.x) + TILE - 9 + Math.round(u.fx.dx || 0), by = tileY(u.y) - 3 + bob + Math.round(u.fx.dy || 0); rrect(bx - 1, by - 1, 11, 11, UI.inset, 2); rect(bx, by, 9, 9, mine ? shade(col, -.45) : '#5a1020'); iconAt(icon, bx, by, mine ? '#ffffff' : '#ffb0b0'); } } }
}
