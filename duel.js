// ============================================================================
// duel.js — the lateral battle scene. A resolved exchange (resolveCombat's
// event list plus the HP both units had before it) is turned into a script of
// timed beats — wind-up, launch, impact, miss, KO, thaw — replayed on a split
// battlefield with the big sprites, two HP panels, each side's terrain and the
// attack name. The script is a pure function of the events: nothing is
// rerolled, the model is never touched, and skipping only moves the clock.
// ============================================================================
'use strict';
const DUEL_T = { intro: .35, windup: .22, contact: .16, ranged: .3, hold: .4, drop: .35, gap: .2, miss: .45, ko: .75, thaw: .3, outro: .3 };
const DUEL_FAMILIES = { Fire: 'fire', Water: 'water', Ice: 'water', Electric: 'electric', Grass: 'grass', Psychic: 'psychic', Ghost: 'psychic', Fairy: 'psychic', Poison: 'psychic', Dragon: 'psychic' };
// Attack family: melee-only moves are contact whatever their type; ranged ones go by type, else a generic projectile or beam.
function duelFamily(move) { if (move.rng[1] <= 1) return 'contact'; return DUEL_FAMILIES[move.type] || 'neutral'; }
function duelLaunchTime(fam) { return fam === 'contact' ? DUEL_T.contact : fam === 'electric' ? .2 : DUEL_T.ranged; }

// ---------------------------------------------------------------- script (pure)
// events: the hit/miss/ko/thaw events of one exchange, in resolver order. hp0: {unitId: hp before the exchange}.
// Returns {beats, total, intro, outro, hp0, hpEnd}. Every impact beat records the HP it starts from and
// ends at, so the displayed HP never depends on the (already final) model HP.
function duelScript(events, hp0, T = DUEL_T) {
  const beats = [], hp = Object.assign({}, hp0); let t = 0, first = true;
  beats.push({ t, kind: 'intro' }); t += T.intro;
  for (const e of events) {
    if (e.type === 'hit' || e.type === 'miss') {
      if (!first) t += T.gap; first = false; const fam = duelFamily(e.move);
      beats.push({ t, kind: 'windup', att: e.att, def: e.def, move: e.move, counter: !!e.counter, fam }); t += T.windup;
      beats.push({ t, kind: 'launch', att: e.att, def: e.def, move: e.move, fam }); t += duelLaunchTime(fam);
      if (e.type === 'miss') { beats.push({ t, kind: 'miss', att: e.att, def: e.def, move: e.move, ev: e }); t += T.miss; continue; }
      beats.push({ t, kind: 'impact', att: e.att, def: e.def, move: e.move, ev: e, fam, hpFrom: hp[e.def.id], hpTo: e.hpAfter, attFrom: hp[e.att.id], attTo: e.attHpAfter, drop: T.drop });
      hp[e.def.id] = e.hpAfter; hp[e.att.id] = e.attHpAfter; t += T.hold;
    } else if (e.type === 'ko') { beats.push({ t, kind: 'ko', unit: e.unit, by: e.by }); t += T.ko; }
    else if (e.type === 'thaw') { beats.push({ t, kind: 'thaw', unit: e.unit }); t += T.thaw; }
  }
  beats.push({ t, kind: 'outro' }); t += T.outro;
  return { beats, total: t, intro: T.intro, outro: T.outro, hp0, hpEnd: hp };
}
// Displayed HP of a unit at script time t: its pre-exchange HP until its first impact, then each drop in order.
function duelHpAt(S, t, id) {
  let v = S.hp0[id];
  for (const b of S.beats) {
    if (b.kind !== 'impact' || b.t > t) continue;
    if (b.def.id === id) v = lerp(b.hpFrom, b.hpTo, clamp((t - b.t) / b.drop, 0, 1));
    else if (b.att.id === id) v = lerp(b.attFrom, b.attTo, clamp((t - b.t - .1) / b.drop, 0, 1));
  }
  return Math.round(v);
}

// ---------------------------------------------------------------- scene state
// Which unit stands on the left: the side holding the controls (P1 in Versus, the player and allies in the
// campaign), then wild, then enemy trainers; the attacker when the two rank the same.
function duelSides(att, def) {
  const rank = u => B && B.versus ? u.team : u.team === 0 ? 0 : u.team === 3 ? 1 : u.team === 2 ? 2 : 3;
  return rank(def) < rank(att) ? { left: def, right: att } : { left: att, right: def };
}
function duelTeamTag(u) { if (B && B.versus) return u.team === 2 ? 'WLD' : 'P' + (u.team + 1); return u.team === 0 ? 'YOU' : u.team === 1 ? 'FOE' : u.team === 2 ? 'WLD' : 'ALY'; }
function duelBiome(q) {
  const m = B.map, ids = [q.terr[q.att.id].id, q.terr[q.def.id].id], n = {}; for (const row of m.tiles) for (const t of row) n[t.id] = (n[t.id] || 0) + 1;
  const share = (...ks) => ks.reduce((a, k) => a + (n[k] || 0), 0) / (m.w * m.h); const on = (...ks) => ids.some(i => ks.includes(i));
  if (on('lava') || share('lava') > .04) return 'volcano';
  if (on('cave', 'wall', 'rubble') || share('cave', 'wall', 'rubble') > .3) return 'cave';
  if (on('floor', 'crate', 'pillar') || share('floor', 'bwall', 'crate', 'pillar') > .3) return 'interior';
  if (on('snow', 'ice') || share('snow', 'ice') > .3) return 'snow';
  return on('forest') || share('forest') > .3 ? 'forest' : 'meadow';
}
// Immutable presentation snapshot of each unit before the exchange: the resolver may level, evolve or inflict a
// status before the scene starts, and the scene must show the old form and advance statuses on its own beats.
function duelView(units) { const v = {}; for (const u of units) v[u.id] = { name: u.name, num: u.num, level: u.level, maxHp: u.maxHp, types: u.types.slice(), status: u.status, boss: u.boss, team: u.team }; return v; }
// Status changes the scene shows: inflicted on the hit that caused them, cleared on a thaw.
function duelApplyBeat(q, b) { if (b.kind === 'impact' && b.ev.status) q.view[b.def.id].status = b.ev.status; else if (b.kind === 'thaw') q.view[b.unit.id].status = null; }
function duelActive() { return BT.mode === 'anim' && BT.anim && BT.anim.kind === 'duel' && BT.anim.started ? BT.anim : null; }
// Queue item {kind:'duel', att, def, events, hp0}: build the script, hold the board's HP bars at their
// pre-exchange values, preload sprites, count the KOs for the results screen.
function startDuel(q) {
  q.script = duelScript(q.events, q.hp0); q.t = 0; q.i = 0; q.boost = false; q.skipped = false; q.done = false; q.started = true;
  q.view = JSON.parse(JSON.stringify(q.view || duelView([q.att, q.def]))); // a private copy: replaying the item starts from the snapshot again
  q.sides = duelSides(q.att, q.def); q.pose = null; q.hitFx = null; q.missFx = null; q.koFx = null; q.banner = null; q.big = null;
  q.terr = { [q.att.id]: terrAt(q.att.x, q.att.y), [q.def.id]: terrAt(q.def.x, q.def.y) }; q.biome = duelBiome(q); q.seed = (q.att.id * 31 + q.def.id * 7 + B.turn * 3) | 0;
  for (const u of [q.att, q.def]) { requestBigSprite(q.view[u.id].num); BT.hpShow.set(u.id, { from: q.hp0[u.id], to: q.hp0[u.id], t: 0, hold: true }); }
  for (const e of q.events) if (e.type === 'ko') noteKo(e);
  FX.parts = []; FX.sprites = []; FX.texts = []; centerCamBetween(q.att, q.def); Audio.sfx('wipe');
}
function duelRate(q) { let r = PREF.battle === 'quick' ? 1.7 : 1; if (BT.fast) r *= 1.6; if (q.boost) r *= 3.5; return r; }
function updateDuel(q, dt) {
  const S = q.script; q.t += dt * duelRate(q);
  if (!q.big && q.t >= S.intro) q.big = { [q.att.id]: bigReady(q.view[q.att.id].num), [q.def.id]: bigReady(q.view[q.def.id].num) }; // decide once: no pop-in mid-scene
  while (q.i < S.beats.length && S.beats[q.i].t <= q.t) duelBeat(q, S.beats[q.i++]);
  if (q.t >= S.total) q.done = true;
}
// Jump to the outro: the HP shown is the script's end state, identical to what playing it out reaches.
function skipDuel(q) {
  if (q.skipped) return; q.skipped = true; q.boost = true; const S = q.script, outroAt = S.total - S.outro;
  if (q.t < outroAt) { q.t = outroAt; while (q.i < S.beats.length && S.beats[q.i].t <= q.t) { const b = S.beats[q.i++]; if (b.kind === 'outro') duelBeat(q, b); else duelApplyBeat(q, b); } }
  q.pose = q.hitFx = q.missFx = q.banner = null; FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0;
}
// First press speeds the scene up, a second press (or X / right click) skips to the result.
function duelInput(q, ev) {
  if (ev.type === 'move' || ev.type === 'up' || ev.type === 'wheel' || (ev.type === 'key' && ev.repeat)) return;
  const hard = (ev.type === 'key' && ev.key === 'back') || (ev.type === 'down' && ev.btn === 2);
  if (hard || q.boost) skipDuel(q); else q.boost = true;
}
function duelBeat(q, b) {
  const L = duelLayout(q), P = id => L.pos[id]; duelApplyBeat(q, b);
  switch (b.kind) {
    case 'windup': { q.pose = { unit: b.att, kind: 'windup', t0: q.t, fam: b.fam }; q.banner = { move: b.move, counter: b.counter, t0: q.t, until: q.t + DUEL_T.windup + duelLaunchTime(b.fam) + .5 }; if (b.fam === 'contact') Audio.sfx('swing'); break; }
    case 'launch': { q.pose = { unit: b.att, kind: b.fam === 'contact' ? 'lunge' : 'cast', t0: q.t, fam: b.fam, dur: duelLaunchTime(b.fam) }; duelLaunchFx(b, P(b.att.id), P(b.def.id)); break; }
    case 'impact': {
      const e = b.ev, d = P(b.def.id), a = P(b.att.id), cx = d.x, cy = d.y - 44; q.hitFx = { unit: b.def, t0: q.t };
      hitEffect(b.move.type, cx, cy, e.crit, e.eff); Audio.sfx(e.dmg === 0 ? 'miss' : e.crit ? 'crit' : e.eff > 1 ? 'hit2' : 'hit');
      if (e.dmg > 0) { shake(e.crit ? 7 : e.eff > 1 ? 5 : 3); if (!q.boost) FX.hitstop = e.crit ? .1 : .04; }
      if (e.crit) { flashScreen('#ffffff', .5); spawnSprite('burst', cx, cy, { size: 26, life: .4, col: UI.gold, delay: .05 }); }
      floatText(cx, cy - 18, String(e.dmg), e.crit ? UI.gold : '#ffffff', { big: true, life: 1 });
      floatText(cx, cy - 36, e.crit ? 'CRITICAL!' : MOVE_POP[b.move.type], e.crit ? UI.gold : TYPE_COL[b.move.type], { life: .9, delay: .05, outline: '#000', vy: -12 });
      if (e.eff > 1) floatText(cx, cy + 10, e.eff >= 2 ? 'SUPER EFFECTIVE!!' : 'Super effective!', '#ffd24a', { delay: .22, life: 1.1, outline: '#402000', vy: -8 });
      else if (e.eff === 0) floatText(cx, cy + 10, 'No effect...', '#c0c0c0', { delay: .22, life: 1.1, vy: -8 });
      else if (e.eff < 1) floatText(cx, cy + 10, 'Not very effective', '#a0d0ff', { delay: .22, life: 1, vy: -8 });
      if (e.status) floatText(cx, cy + 22, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { delay: .42, life: 1.1, outline: '#000', vy: -8 });
      if (e.drain) floatText(a.x, a.y - 66, '+' + e.drain, UI.green, { delay: .3, outline: '#0a3a10' });
      break;
    }
    case 'miss': { const d = P(b.def.id); q.missFx = { unit: b.def, t0: q.t }; Audio.sfx('miss'); floatText(d.x, d.y - 70, 'MISS', '#c0c0c0', { big: true, life: .9 }); break; }
    case 'ko': { const p = P(b.unit.id); q.koFx = { unit: b.unit, t0: q.t }; Audio.sfx('faint'); shake(4); spawnParts(p.x, p.y - 30, 18, ['#ffffff', '#ffd24a', '#c0c0c0'], { speed: 90, life: .7, grav: 60 }); floatText(p.x, p.y - 84, isHuman(b.unit.team) ? 'FAINTED!' : 'KO!', isHuman(b.unit.team) ? UI.red : UI.gold, { big: true, life: 1.2 }); break; }
    case 'thaw': { const p = P(b.unit.id); floatText(p.x, p.y - 70, 'Thawed!', '#98d8f8'); break; }
    case 'outro': { FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; q.banner = null; for (const u of [q.att, q.def]) BT.hpShow.delete(u.id); Audio.sfx('wipe'); break; }
  }
}
// The travelling part of each family, from the attacker's front to the defender's chest.
function duelLaunchFx(b, a, d) {
  const type = b.move.type, F = fxFor(type), c1 = F.parts[0], c2 = F.parts[1], dur = duelLaunchTime(b.fam);
  const ax = a.x + a.dir * 26, ay = a.y - 44, tx = d.x + d.dir * 6, ty = d.y - 44;
  switch (b.fam) {
    case 'contact': break;
    case 'fire': Audio.sfx('fire'); for (let i = 0; i < 6; i++) spawnSprite('flame', ax, ay + (vrnd() - .5) * 8, { tx: tx + (vrnd() - .5) * 12, ty: ty + (vrnd() - .5) * 16, life: dur - i * .03, arc: 4 + i * 2, col: c1, col2: type === 'Fire' ? '#ff4a20' : '#4a3ad0', size: 4 + (i % 3), trail: [c1, c2], delay: i * .03 }); break;
    case 'water': Audio.sfx('water'); for (let i = 0; i < 8; i++) spawnSprite(type === 'Ice' ? 'shard' : 'drop', ax, ay + (vrnd() - .5) * 10, { tx: tx + (vrnd() - .5) * 10, ty: ty + (vrnd() - .5) * 18, life: dur - i * .02, arc: 8 + i * 2, col: c1, col2: c2, trail: [c1], rot: i, spin: 8, delay: i * .02 }); for (let i = 0; i < 2; i++) spawnSprite('bubble', ax, ay, { tx, ty, life: dur, size: 3, col: c2, col2: c1, delay: i * .08 }); break;
    case 'grass': Audio.sfx('grass'); for (let i = 0; i < 7; i++) spawnSprite('leaf', ax, ay + (vrnd() - .5) * 12, { tx: tx + (vrnd() - .5) * 12, ty: ty + (vrnd() - .5) * 20, life: dur - i * .02, arc: 6 + i * 3, col: '#2a6b38', col2: '#c8f0a0', rot: i, spin: 12, delay: i * .025 }); break;
    case 'electric': Audio.sfx('elec'); spawnSprite('flash', ax - a.dir * 10, ay, { size: 10, life: .15, col: '#ffe94a' }); for (let i = 0; i < 5; i++) spawnSprite('bolt', ax + (tx - ax) * (i + 1) / 6, ay - 10, { size: 14, life: .14, col: c1, delay: i * dur / 5 }); break;
    case 'psychic': Audio.sfx('psy'); for (let i = 0; i < 3; i++) spawnSprite('psy', tx, ty, { size: 14 + i * 5, life: .3, col: c1, col2: c2, delay: dur * .3 + i * .08 }); for (let i = 0; i < 3; i++) spawnSprite('wisp', ax, ay + (i - 1) * 8, { tx, ty: ty + (i - 1) * 6, life: dur, size: 4, col: c1, col2: c2, delay: i * .04 }); break;
    default: if (type === 'Normal' || type === 'Steel') { Audio.sfx('beam'); spawnSprite('beam', ax, ay, { len: tx - ax, life: dur + .1, col: TYPE_COL[type], col2: '#ffffff', size: 5 }); } else { Audio.sfx('swing'); projectileFX(type, ax, ay, tx, ty, dur); }
  }
}

// ---------------------------------------------------------------- layout & drawing
// Two panels, each with its terrain strip below. Wide screens put both at the top, side by side, with the field
// under them and the ground line low. Narrow portrait screens (too narrow for two panels) put the right-hand
// side's panel at the top and the left-hand side's panel at the bottom, so the field sits between them and the
// sprites stand in the middle of the screen instead of above a long empty ground band.
function duelLayout(q) {
  const W = VIEW.w, H = VIEW.h, PH = 36, TH = 11; const pw = Math.min(150, Math.floor((W - 18) / 2)); const stacked = pw < 136; const PW = stacked ? Math.min(230, W - 12) : pw;
  const L = { W, H, stacked, PW, PH, TH, panels: {}, pos: {} }; const left = q.sides.left, right = q.sides.right; const block = PH + TH + 2;
  if (stacked) {
    L.panels[right.id] = { x: W - 6 - PW, y: 6, w: PW, h: PH, side: 1 }; L.top = 6 + block + 6;
    const by = H - 6 - block; L.panels[left.id] = { x: 6, y: by, w: PW, h: PH, side: -1 }; L.bottom = by - 4;
    L.gy = clamp(Math.round(L.top + (L.bottom - L.top) * .68), L.top + 108, L.bottom - 14); L.hintY = L.bottom - 11;
  } else {
    L.panels[left.id] = { x: 6, y: 6, w: PW, h: PH, side: -1 }; L.panels[right.id] = { x: W - 6 - PW, y: 6, w: PW, h: PH, side: 1 };
    L.top = 6 + block + 5; L.bottom = H - 16; L.gy = Math.min(Math.max(L.top + 112, Math.round(H * .8)), L.top + 300, H - 24); L.hintY = H - 10;
  }
  const half = Math.round(W / 2), spread = Math.min(clamp(Math.round(W * .23), 56, 110), Math.floor(W / 2) - 50);
  L.pos[left.id] = { x: half - spread, y: L.gy, dir: 1 }; L.pos[right.id] = { x: half + spread, y: L.gy, dir: -1 };
  L.bannerY = L.top + 12; return L;
}
const DUEL_SKY = {
  meadow: { sky: ['#4f6fa0', '#5f82b2', '#7398c2', '#8db0d0'], far: '#3a5f63', hill: '#3b6b45', near: '#2f5a3a', trees: 5 },
  forest: { sky: ['#3f5f80', '#4a6d8e', '#557a9a', '#6a8aa6'], far: '#2c4f45', hill: '#2a5238', near: '#1f4530', trees: 12 },
  cave: { sky: ['#17121c', '#1d1724', '#231c2b', '#2a2233'], far: '#2c2436', hill: '#332a3e', near: '#3a3046', stalactites: true },
  interior: { sky: ['#20203a', '#26263f', '#2c2c46', '#33334e'], far: '#3c3b56', hill: '#44435e', near: '#4c4a66', pillars: true },
  volcano: { sky: ['#1e0806', '#30100a', '#45170c', '#5e2210'], far: '#3a2020', hill: '#463030', near: '#2c1c1c', glow: true },
  snow: { sky: ['#546a86', '#6d84a2', '#8ba0ba', '#a9bacd'], far: '#7d90a8', hill: '#93a6bc', near: '#a6b6c8', trees: 4 },
};
function duelBackdrop(q, L) {
  const K = DUEL_SKY[q.biome] || DUEL_SKY.meadow, W = L.W, hz = L.gy - 34, R = mulberry32(q.seed);
  K.sky.forEach((c, i) => { const y0 = Math.round(hz * i / K.sky.length); rect(0, y0, W, Math.round(hz * (i + 1) / K.sky.length) - y0 + 1, c); });
  rect(0, hz, W, L.H - hz, K.near);
  if (K.glow) { ctx.globalAlpha = .35; ellipse(Math.round(W / 2), hz, Math.round(W / 2), 22, '#e04e1a'); ctx.globalAlpha = 1; }
  if (K.pillars) for (let i = 0; i < 4; i++) { const x = Math.round(W * (i + .5) / 4); rect(x - 7, 0, 14, hz + 4, K.far); vline(x - 7, 0, hz + 4, K.near); vline(x + 6, 0, hz + 4, shade(K.far, -.35)); }
  if (K.stalactites) for (let i = 0; i < 9; i++) { const x = Math.round(R() * W), h = 12 + Math.round(R() * 30); for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * 6)); rect(x - (w >> 1), j, w, 1, K.hill); } }
  for (let i = 0; i < 6; i++) { const x = Math.round(W * (i + .5) / 6 + (R() - .5) * 40), r = 40 + Math.round(R() * 50); ellipse(x, hz + 6, r, Math.round(r * (K.stalactites ? .2 : .35)), K.far); }
  if (K.trees) for (let i = 0; i < K.trees; i++) { const x = Math.round(R() * W), h = 14 + Math.round(R() * 14), w = 6 + Math.round(R() * 4); for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * j / h)); rect(x - (ww >> 1), hz + 4 - h + j, ww, 1, j % 5 === 0 ? shade(K.far, -.15) : K.far); } }
  for (let i = 0; i < 5; i++) { const x = Math.round(W * (i + .5) / 5 + (R() - .5) * 40), r = 36 + Math.round(R() * 40); ellipse(x, hz + 10, r, Math.round(r * .3), K.hill); }
  hline(0, hz + 12, W, shade(K.near, .12));
}
// Each half of the ground is tiled with that side's own terrain; the near rows fall into shadow for depth.
function duelGround(q, L) {
  const W = L.W, H = L.H, gy = L.gy, half = Math.round(W / 2), f = Math.floor(BT.time * 3) % WATER_FRAMES, y0 = gy - 6;
  for (const u of [q.sides.left, q.sides.right]) {
    const t = q.terr[u.id], p = L.pos[u.id], x0 = p.dir === 1 ? 0 : half, x1 = p.dir === 1 ? half : W;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, H - y0); ctx.clip();
    const start = p.x - TILE / 2 - Math.ceil((p.x - x0) / TILE) * TILE; let i = 0;
    for (let x = start; x < x1; x += TILE, i++) for (let row = 0; row < 2; row++) { const v = (B.map.variants[u.y] || [])[(u.x + i + row * 3) % B.map.w] || 0; ctx.drawImage(tileImg(t.ch, v, f), x, y0 + row * TILE); }
    ctx.restore();
  }
  ctx.globalAlpha = .18; hline(0, y0, W, '#ffffff'); ctx.globalAlpha = .25; rect(0, gy + 22, W, H - gy - 22, '#0b1020'); ctx.globalAlpha = .5; rect(0, gy + 44, W, Math.max(0, H - gy - 44), '#0b1020');
  ctx.globalAlpha = .5; dither(half - 3, y0, 6, H - y0, '#0b1020'); ctx.globalAlpha = 1; vline(half, y0, H - y0, '#0b1020');
}
function duelDrawUnit(q, u, L, t) {
  const p = L.pos[u.id]; let dx = 0, dy = 0, sx = 1, sy = 1, tint = null, alpha = 1; const flip = p.dir === 1; const soft = REDUCED ? .3 : 1;
  const pose = q.pose && q.pose.unit === u ? q.pose : null;
  if (pose) {
    const k = t - pose.t0;
    if (pose.kind === 'windup') { const e = Math.min(1, k / DUEL_T.windup); dx = -p.dir * 6 * easeOut(e) * soft; if (pose.fam === 'contact') { sy = 1 - .08 * e; sx = 1 + .06 * e; } else { sy = 1 + .05 * e; sx = 1 - .03 * e; } }
    else if (pose.kind === 'lunge') { const e = Math.min(1, k / pose.dur); if (e < 1) { dx = p.dir * lerp(-6, 30, easeIn(e)) * soft; sx = 1.1; sy = .95; } else dx = p.dir * lerp(30, 0, easeOut(Math.min(1, (k - pose.dur) / .35))) * soft; }
    else if (pose.kind === 'cast') { const e = Math.min(1, k / pose.dur); dx = p.dir * (e < 1 ? lerp(-6, 8, e) : lerp(8, 0, Math.min(1, (k - pose.dur) / .3))) * soft; if (e < 1) sy = 1.04; }
  }
  const hit = q.hitFx && q.hitFx.unit === u ? t - q.hitFx.t0 : -1;
  if (hit >= 0 && hit < .3) { dx += -p.dir * 10 * (1 - hit / .3) * soft; if (hit < .14 && Math.floor(hit * 30) % 2 === 0) tint = '#ffffff'; }
  const miss = q.missFx && q.missFx.unit === u ? t - q.missFx.t0 : -1;
  if (miss >= 0 && miss < .4) { const h = Math.sin(miss / .4 * Math.PI); dx += -p.dir * 14 * h * soft; dy -= 10 * h * soft; }
  const ko = q.koFx && q.koFx.unit === u ? t - q.koFx.t0 : -1;
  if (ko >= DUEL_T.ko) return;
  if (ko >= 0) { const e = ko / DUEL_T.ko; if (e < .35) tint = Math.floor(ko * 24) % 2 ? '#ffffff' : null; else { const r = (e - .35) / .65; alpha = 1 - r; dy += r * 30 * soft; } }
  if (!REDUCED && !pose && hit < 0 && ko < 0) { const b = Math.sin(BT.time * 2.4 + u.id) * .5 + .5; sy *= 1 - b * .025; sx *= 1 + b * .012; }
  ctx.globalAlpha = .3 * alpha; ellipse(Math.round(p.x + dx), p.y + 1, Math.round(30 * sx), 6, '#000000'); ctx.globalAlpha = 1;
  const num = q.view[u.id].num, big = q.big ? q.big[u.id] : bigReady(num);
  if (big) drawBig(num, p.x + dx, p.y + dy, { flip, tint, alpha, sx, sy }); else drawMon(num, p.x + dx, p.y + dy, { flip, tint, alpha, sx: 2 * sx, sy: 2 * sy });
}
function duelPanel(q, u, L) {
  const P = L.panels[u.id], v = q.view[u.id], hp = duelHpAt(q.script, q.t, u.id), t = q.terr[u.id], col = teamColor(u.team);
  panel(P.x, P.y, P.w, P.h, { border: col });
  const x = P.x + 6, y = P.y + 4; let name = v.name; while (textWidth(name) > P.w - 48 && name.length > 3) name = name.slice(0, -1);
  text(name, x, y, UI.ink); textR('Lv' + v.level, P.x + P.w - 6, y, UI.gold);
  // HP: the current value in the big face, the maximum small, the bar across the rest of the panel
  const ratio = clamp(hp / v.maxHp, 0, 1); const hs = String(Math.max(0, hp)), hw = textWidth(hs, BIG) + textWidth('/' + v.maxHp) + 3;
  bar(x, y + 11, P.w - 14 - hw, 6, ratio, hpColor(ratio)); bigText(hs, P.x + P.w - 6 - hw, y + 9, hp <= 0 ? UI.red : UI.ink, { outline: '#000' }); textR('/' + v.maxHp, P.x + P.w - 6, y + 11, UI.muted);
  miniBadge(duelTeamTag(u), col, x, y + 21); v.types.forEach((tp, i) => typeBadge(tp, x + 18 + i * 26, y + 20, 24)); if (v.status) statusBadge(v.status, P.x + P.w - 21, y + 21);
  const sy = P.y + P.h + 2; rrect(P.x + 1, sy + 1, P.w, L.TH, UI.shadow, 1); rrect(P.x, sy, P.w, L.TH, UI.panelDark, 1);
  ctx.drawImage(tileImg(t.ch, 0, 0), 0, 0, 32, 32, P.x + 3, sy + 2, 7, 7);
  text(t.name.toUpperCase() + '  DEF ' + terrainDef(t, u) + '%  AVO ' + terrainEva(t, u), P.x + 13, sy + 2, UI.muted);
}
function drawDuel(q) {
  const L = duelLayout(q), t = q.t, W = L.W, H = L.H;
  duelBackdrop(q, L);
  ctx.save(); ctx.translate(FX.shakeX, FX.shakeY);
  duelGround(q, L);
  const order = [q.sides.right, q.sides.left]; if (q.pose && q.pose.unit === q.sides.right) order.reverse();
  for (const u of order) duelDrawUnit(q, u, L, t);
  drawFX(0, 0, false); ctx.restore();
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, W, H, FX.flashCol); ctx.globalAlpha = 1; }
  for (const u of [q.sides.left, q.sides.right]) duelPanel(q, u, L);
  drawFXTexts(FX.shakeX, FX.shakeY);
  const b = q.banner;
  if (b && t < b.until) {
    const k = Math.min(1, (t - b.t0) / .12), name = b.move.name.toUpperCase(), col = TYPE_COL[b.move.type] || UI.ink; const w = textWidth(name, BIG) + 40, x = Math.round(W / 2 - w / 2), y = Math.round(L.bannerY - (1 - easeOut(k)) * 6);
    rrect(x + 1, y + 1, w, 15, UI.shadow, 1); rrect(x, y, w, 15, '#101a30', 1); outline(x, y, w, 15, col); typeBadge(b.move.type, x + 4, y + 3, 24); bigText(name, x + 32, y + 3, col, { outline: '#000' });
    if (b.counter) { const cw = textWidth('COUNTER!') + 8; rrect(Math.round(W / 2 - cw / 2), y - 10, cw, 9, UI.red, 1); textC('COUNTER!', W / 2, y - 9, '#ffffff'); }
  }
  textC(q.boost ? (VIEW.touch ? 'tap again: skip' : 'X / any key: skip') : (VIEW.touch ? 'tap: faster  ·  tap twice: skip' : 'any key: faster  ·  X: skip'), W / 2, L.hintY, UI.muted, { outline: UI.shadow });
}
// The whole frame: a curtain wipe from the board into the scene, the scene, and the wipe back.
function drawDuelFrame(q) {
  const S = q.script, W = VIEW.w, H = VIEW.h, t = q.t, outAt = S.total - S.outro;
  const kIn = t < S.intro ? (REDUCED ? (t < .08 ? 0 : 1) : easeOut(t / S.intro)) : 1;
  const kOut = t >= outAt ? (REDUCED ? (t - outAt < S.outro - .08 ? 1 : 0) : 1 - easeIn((t - outAt) / S.outro)) : 1;
  const k = Math.min(kIn, kOut);
  if (k >= 1) { drawDuel(q); return; }
  drawBoard(); if (k <= 0) return;
  const w = Math.round(W * k), x = Math.round((W - w) / 2);
  ctx.save(); ctx.beginPath(); ctx.rect(x, 0, w, H); ctx.clip(); drawDuel(q); ctx.restore();
  rect(x - 2, 0, 2, H, '#0b1020'); rect(x + w, 0, 2, H, '#0b1020');
}
