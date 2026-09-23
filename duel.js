// ============================================================================
// duel.js — the lateral battle scene. A resolved exchange (resolveCombat's
// event list plus the HP both units had before it) is turned into a script of
// timed beats — wind-up, launch, impact, miss, KO, thaw — replayed on a split
// battlefield with the big sprites, two HP panels, each side's terrain and the
// attack name. The script is a pure function of the events: nothing is
// rerolled, the model is never touched, and skipping only moves the clock.
// ============================================================================
'use strict';
const DUEL_T = { intro: .55, windup: .22, contact: .16, ranged: .3, hold: .4, drop: .35, gap: .2, miss: .45, ko: .75, thaw: .3, outro: .3 };
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
function duelView(units) { const v = {}; for (const u of units) v[u.id] = { name: u.name, num: u.num, level: u.level, maxHp: u.maxHp, types: u.types.slice(), status: u.status, boss: u.boss, team: u.team, brace: !!u.brace, root: !!u.root, fly: !!u.fly }; return v; }
// Status changes the scene shows: inflicted on the hit that caused them, cleared on a thaw.
function duelApplyBeat(q, b) { if (b.kind === 'impact' && b.ev.status) q.view[b.def.id].status = b.ev.status; else if (b.kind === 'thaw') q.view[b.unit.id].status = null; }
function duelActive() { return BT.mode === 'anim' && BT.anim && BT.anim.kind === 'duel' && BT.anim.started ? BT.anim : null; }
// Queue item {kind:'duel', att, def, events, hp0}: build the script, hold the board's HP bars at their
// pre-exchange values, preload sprites, count the KOs for the results screen.
function startDuel(q) {
  q.script = duelScript(q.events, q.hp0); q.t = 0; q.i = 0; q.boost = false; q.skipped = false; q.done = false; q.started = true;
  q.view = JSON.parse(JSON.stringify(q.view || duelView([q.att, q.def]))); // a private copy: replaying the item starts from the snapshot again
  q.sides = duelSides(q.att, q.def); q.pose = null; q.hitFx = null; q.missFx = null; q.koFx = null; q.banner = null; q.big = null; q.focus = null; q.entered = {};
  q.terr = { [q.att.id]: terrAt(q.att.x, q.att.y), [q.def.id]: terrAt(q.def.x, q.def.y) }; q.biome = duelBiome(q); q.seed = (q.att.id * 31 + q.def.id * 7 + B.turn * 3) | 0;
  for (const u of [q.att, q.def]) { requestBigSprite(q.view[u.id].num); requestAnim(q.view[u.id].num); BT.hpShow.set(u.id, { from: q.hp0[u.id], to: q.hp0[u.id], t: 0, hold: true }); }
  q.cam = { zoom: 1, x: 0, y: 0, tz: 1, tx: 0, ty: 0 };
  for (const e of q.events) if (e.type === 'ko') noteKo(e);
  FX.parts = []; FX.sprites = []; FX.texts = []; centerCamBetween(q.att, q.def); Audio.sfx('wipe');
}
function duelRate(q) { let r = PREF.battle === 'quick' ? 1.7 : 1; if (BT.fast) r *= 1.6; if (q.boost) r *= 3.5; return r; }
function updateDuel(q, dt) {
  const S = q.script; q.t += dt * duelRate(q);
  if (!q.big && q.t >= S.intro * .5) q.big = { [q.att.id]: duelSpriteKind(q.view[q.att.id].num), [q.def.id]: duelSpriteKind(q.view[q.def.id].num) }; // decide once: no pop-in mid-scene
  if (q.cam) { const c = q.cam, k = Math.min(1, dt * 9); c.zoom += (c.tz - c.zoom) * k; c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; }
  while (q.i < S.beats.length && S.beats[q.i].t <= q.t) duelBeat(q, S.beats[q.i++]);
  if (q.t >= S.total) q.done = true;
}
// Jump to the outro: the HP shown is the script's end state, identical to what playing it out reaches.
function skipDuel(q) {
  if (q.skipped) return; q.skipped = true; q.boost = true; const S = q.script, outroAt = S.total - S.outro;
  if (q.t < outroAt) { q.t = outroAt; while (q.i < S.beats.length && S.beats[q.i].t <= q.t) { const b = S.beats[q.i++]; if (b.kind === 'outro') duelBeat(q, b); else duelApplyBeat(q, b); } }
  q.pose = q.hitFx = q.missFx = q.banner = q.focus = null; FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; if (q.cam) { q.cam.tz = 1; q.cam.tx = q.cam.ty = 0; }
}
// First press speeds the scene up, a second press (or X / right click) skips to the result.
function duelInput(q, ev) {
  if (ev.type === 'move' || ev.type === 'up' || ev.type === 'wheel' || (ev.type === 'key' && ev.repeat)) return;
  const hard = (ev.type === 'key' && ev.key === 'back') || (ev.type === 'down' && ev.btn === 2);
  if (hard || q.boost) skipDuel(q); else q.boost = true;
}
function duelBeat(q, b) {
  const L = duelLayout(q), z = L.z, P = id => ({ x: L.pos[id].x / z, y: L.pos[id].y / z, dir: L.pos[id].dir }); duelApplyBeat(q, b);
  switch (b.kind) {
    case 'windup': { q.pose = { unit: b.att, kind: 'windup', t0: q.t, fam: b.fam }; q.banner = { move: b.move, counter: b.counter, t0: q.t, until: q.t + DUEL_T.windup + duelLaunchTime(b.fam) + .5 }; q.focus = { t0: q.t, until: q.t + DUEL_T.windup + duelLaunchTime(b.fam) + .45 }; duelCamTo(q, P(b.att.id), 1.1); if (b.fam === 'contact') Audio.sfx('swing'); break; }
    case 'launch': { q.pose = { unit: b.att, kind: b.fam === 'contact' ? 'lunge' : 'cast', t0: q.t, fam: b.fam, dur: duelLaunchTime(b.fam) }; duelLaunchFx(b, P(b.att.id), P(b.def.id)); break; }
    case 'impact': {
      const e = b.ev, d = P(b.def.id), a = P(b.att.id), cx = d.x, cy = d.y - 44; q.hitFx = { unit: b.def, t0: q.t };
      duelImpactFx(b.fam, b.move.type, cx, cy, d, e); hitEffect(b.move.type, cx, cy, e.crit, e.eff); duelCamTo(q, d, e.crit ? 1.22 : 1.15); q.jolt = { t0: q.t, dir: -d.dir, n: e.crit ? 6 : e.dmg > 0 ? 4 : 0 }; Audio.sfx(e.dmg === 0 ? 'miss' : e.crit ? 'crit' : e.eff > 1 ? 'hit2' : 'hit');
      if (e.dmg > 0) { shake(e.crit ? 7 : e.eff > 1 ? 5 : 3); if (!q.boost) FX.hitstop = e.crit ? .1 : .04; flashScreen(e.crit ? '#fff2c0' : '#ffffff', e.crit ? .5 : .22); }
      if (e.crit) spawnSprite('burst', cx, cy, { size: 30, life: .4, col: UI.gold, delay: .05 });
      floatText(cx, cy - 18, String(e.dmg), e.crit ? UI.gold : '#ffffff', { big: true, life: 1 });
      floatText(cx, cy - 36, e.crit ? 'CRITICAL!' : MOVE_POP[b.move.type], e.crit ? UI.gold : TYPE_COL[b.move.type], { life: .9, delay: .05, outline: '#000', vy: -12 });
      if (e.eff > 1) floatText(cx, cy + 10, e.eff >= 2 ? 'SUPER EFFECTIVE!!' : 'Super effective!', '#ffd24a', { delay: .22, life: 1.1, outline: '#402000', vy: -8 });
      else if (e.eff === 0) floatText(cx, cy + 10, 'No effect...', '#c0c0c0', { delay: .22, life: 1.1, vy: -8 });
      else if (e.eff < 1) floatText(cx, cy + 10, 'Not very effective', '#a0d0ff', { delay: .22, life: 1, vy: -8 });
      if (e.status) floatText(cx, cy + 22, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { delay: .42, life: 1.1, outline: '#000', vy: -8 });
      if (e.drain) floatText(a.x, a.y - 66, '+' + e.drain, UI.green, { delay: .3, outline: '#0a3a10' });
      break;
    }
    case 'miss': { const d = P(b.def.id); q.missFx = { unit: b.def, t0: q.t }; duelCamTo(q, d, 1.08); Audio.sfx('miss'); floatText(d.x, d.y - 70, 'MISS', '#c0c0c0', { big: true, life: .9 }); break; }
    case 'ko': { const p = P(b.unit.id); q.koFx = { unit: b.unit, t0: q.t }; Audio.sfx('faint'); shake(5); duelCamTo(q, p, 1.18); q.focus = { t0: q.t, until: q.t + DUEL_T.ko }; const cy = p.y - 40; spawnSprite('blast', p.x, cy, { size: 34, life: .55, col: '#ffd24a', col2: '#ffffff', delay: .2 }); for (let i = 0; i < 5; i++) spawnSprite('poof', p.x + (i - 2) * 12, cy + 10 + (i % 2) * 8, { size: 8, life: .7, col: '#6a6a78', col2: '#b0b0c0', vy: -14, delay: .25 + i * .05 }); spawnParts(p.x, cy, 22, ['#ffffff', '#ffd24a', '#ff8a2c'], { speed: 110, life: .7, grav: 80, delay: .2 }); spawnSprite('ring', p.x, cy, { size: 46, life: .5, col: '#ffffff', delay: .2 }); floatText(p.x, p.y - 84, isHuman(b.unit.team) ? 'FAINTED!' : 'KO!', isHuman(b.unit.team) ? UI.red : UI.gold, { big: true, life: 1.2 }); break; }
    case 'thaw': { const p = P(b.unit.id); floatText(p.x, p.y - 70, 'Thawed!', '#98d8f8'); break; }
    case 'outro': { FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; q.banner = null; q.focus = null; if (q.cam) { q.cam.tz = 1; q.cam.tx = q.cam.ty = 0; } for (const u of [q.att, q.def]) BT.hpShow.delete(u.id); Audio.sfx('wipe'); break; }
  }
}
// The travelling part of each family, from the attacker's front to the defender's chest (field space).
function duelLaunchFx(b, a, d) {
  const type = b.move.type, F = fxFor(type), c1 = F.parts[0], c2 = F.parts[1], dur = duelLaunchTime(b.fam);
  const ax = a.x + a.dir * 26, ay = a.y - 44, tx = d.x + d.dir * 6, ty = d.y - 44, dir = a.dir;
  switch (b.fam) {
    case 'contact': for (let i = 0; i < 2; i++) spawnSprite('speed', a.x - dir * 20, ay + 6, { size: 26, life: dur + .1, col: '#ffffff', dir, delay: i * .05 }); spawnSprite('poof', a.x - dir * 10, a.y, { size: 5, life: .35, col: '#d8d0b8', col2: '#f4f0e0', vx: -dir * 20 }); break;
    case 'fire': Audio.sfx('fire'); spawnSprite('fireball', ax, ay, { tx, ty, life: dur, arc: 6, size: type === 'Fire' ? 7 : 6, col: c1, col2: type === 'Fire' ? '#ff4a20' : '#4a3ad0', dir, trail: [c1, c2] }); for (let i = 0; i < 4; i++) spawnSprite('flame', ax, ay + (vrnd() - .5) * 10, { tx: tx + (vrnd() - .5) * 14, ty: ty + (vrnd() - .5) * 18, life: dur - i * .03, arc: 10 + i * 4, col: c1, col2: type === 'Fire' ? '#ff4a20' : '#4a3ad0', size: 2 + (i % 2), delay: .04 + i * .03 }); spawnSprite('flash', ax - dir * 8, ay, { size: 8, life: .12, col: '#ffe9a0' }); break;
    case 'water': Audio.sfx('water'); for (let i = 0; i < 3; i++) spawnSprite('wave', ax, ay + 10 + i * 6, { tx: tx, ty: ty + 10 + i * 6, life: dur + .08, size: 16 - i * 3, col: c1, col2: c2, dir, delay: i * .05 }); for (let i = 0; i < 8; i++) spawnSprite(type === 'Ice' ? 'shard' : 'drop', ax, ay + (vrnd() - .5) * 10, { tx: tx + (vrnd() - .5) * 10, ty: ty + (vrnd() - .5) * 18, life: dur - i * .02, arc: 8 + i * 2, col: c1, col2: c2, trail: [c1], rot: i, spin: 8, delay: i * .02 }); break;
    case 'grass': Audio.sfx('grass'); for (let i = 0; i < 8; i++) spawnSprite('leaf', tx, ty, { orbit: { r: 34, speed: 9 * (i % 2 ? 1 : -1), a0: i * Math.PI / 4, shrink: true }, life: dur + .25, col: '#2a6b38', col2: '#c8f0a0', rot: i, spin: 14, delay: i * .02 }); for (let i = 0; i < 5; i++) spawnSprite('leaf', ax, ay + (vrnd() - .5) * 12, { tx: tx + (vrnd() - .5) * 12, ty: ty + (vrnd() - .5) * 20, life: dur - i * .02, arc: 6 + i * 3, col: '#2a6b38', col2: '#c8f0a0', rot: i, spin: 12, delay: i * .025 }); break;
    case 'electric': Audio.sfx('elec'); spawnSprite('flash', ax - dir * 10, ay, { size: 10, life: .15, col: '#ffe94a' }); for (let i = 0; i < 3; i++) spawnSprite('bolt', ax + (tx - ax) * (i + 1) / 4, ay - 6, { size: 12, life: .12, col: c1, delay: i * dur / 4 }); spawnSprite('lightning', tx, ty + 30, { size: ty + 30 + 60, life: .32, col: c1, delay: dur * .55 }); spawnSprite('lightning', tx + dir * 6, ty + 30, { size: ty + 30 + 60, life: .22, col: '#fff7b0', delay: dur * .55 + .12 }); break;
    case 'psychic': Audio.sfx('psy'); for (let i = 0; i < 4; i++) spawnSprite('psy', tx, ty, { size: 16 + i * 6, life: .35, col: c1, col2: c2, delay: dur * .25 + i * .07 }); for (let i = 0; i < 3; i++) spawnSprite('wisp', ax, ay + (i - 1) * 8, { tx, ty: ty + (i - 1) * 6, life: dur, size: 4, col: c1, col2: c2, delay: i * .04 }); spawnSprite('ring', tx, ty, { size: 30, life: .4, col: c2, delay: dur * .3 }); break;
    default: if (type === 'Normal' || type === 'Steel') { Audio.sfx('beam'); spawnSprite('beam', ax, ay, { len: tx - ax, life: dur + .1, col: TYPE_COL[type], col2: '#ffffff', size: 6 }); spawnSprite('flash', ax, ay, { size: 9, life: .15, col: '#ffffff' }); } else { Audio.sfx('swing'); projectileFX(type, ax, ay, tx, ty, dur); } if (type === 'Ice') for (let i = 0; i < 4; i++) spawnSprite('crystal', tx + (i - 1.5) * 12, d.y, { size: 22 + (i % 2) * 8, life: .55, col: '#bde4f8', col2: '#ffffff', delay: dur * .6 + i * .04 });
  }
}
// The impact: one large, family-flavoured burst on top of the regular hit effect (field space).
function duelImpactFx(fam, type, cx, cy, d, e) {
  const F = fxFor(type), c1 = F.parts[0], c2 = F.parts[1], big = e.crit ? 1.4 : e.eff > 1 ? 1.2 : 1;
  switch (fam) {
    case 'contact': spawnSprite('impact', cx + d.dir * 6, cy, { size: Math.round(20 * big), life: .3, col: TYPE_COL[type] || '#ffd24a', rot: vrnd() * 3 }); spawnSprite('poof', d.x, d.y, { size: 6, life: .4, col: '#d8d0b8', col2: '#f4f0e0', vx: -d.dir * 20 }); break;
    case 'fire': spawnSprite('blast', cx, cy, { size: Math.round(28 * big), life: .5, col: type === 'Fire' ? '#ff4a20' : '#4a3ad0', col2: c1 }); break;
    case 'water': spawnSprite('ring', cx, cy + 8, { size: Math.round(30 * big), life: .45, col: c2 }); for (let i = 0; i < 6; i++) spawnSprite('bubble', cx + (vrnd() - .5) * 20, cy + (vrnd() - .5) * 16, { size: 2 + (i % 3), life: .5, col: c2, col2: c1, vy: -20, delay: vrnd() * .1 }); break;
    case 'electric': spawnSprite('ring', cx, cy, { size: Math.round(26 * big), life: .35, col: c1 }); break;
    case 'grass': spawnSprite('ring', cx, cy, { size: Math.round(24 * big), life: .35, col: '#c8f0a0' }); break;
    case 'psychic': spawnSprite('ring', cx, cy, { size: Math.round(36 * big), life: .5, col: c1 }); break;
    default: spawnSprite('impact', cx, cy, { size: Math.round(16 * big), life: .28, col: TYPE_COL[type] || '#ffffff', rot: vrnd() * 3 });
  }
  if (e.eff > 1) spawnSprite('ring', cx, cy, { size: Math.round(40 * big), life: .5, col: '#ffd24a', delay: .06 });
}

// ---------------------------------------------------------------- layout & drawing
// Advance Wars framing: the screen splits on a diagonal, each side is a diorama of that unit's own terrain that
// slides in from its edge, with a header panel (portrait, level, a big HP counter, types, terrain defence stars).
// The whole scene, panels included, is drawn at one integer zoom so every pixel is the same size; layout values
// are computed in field space (L.f) and mirrored to screen space (L.panels / L.pos / L.top ...) for callers.
function duelZoom() { return VIEW.w >= 560 && VIEW.h >= 320 ? 2 : 1; }
function duelSpriteKind(num) { return animReady(num) ? 'anim' : bigReady(num) ? 'big' : null; }
function duelCamTo(q, p, zoom) { if (!q.cam || REDUCED) return; q.cam.tz = zoom; q.cam.tx = p.x; q.cam.ty = p.y - 40; }
function duelLayout(q) {
  const W = VIEW.w, H = VIEW.h, z = duelZoom(), Wf = Math.floor(W / z), Hf = Math.floor(H / z), PH = 34, TH = 0;
  const stacked = Wf < 268; const PW = stacked ? Math.min(Wf - 12, 150) : Math.min(150, Math.floor((Wf - 18) / 2));
  const left = q.sides.left, right = q.sides.right; const f = { Wf, Hf, PW, PH, panels: {}, pos: {}, region: {}, stacked };
  if (stacked) {
    f.panels[right.id] = { x: Wf - 4 - PW, y: 4, w: PW, h: PH, side: 1 }; f.panels[left.id] = { x: 4, y: Hf - 4 - PH, w: PW, h: PH, side: -1 };
    f.top = 4 + PH + 4; f.bottom = Hf - 4 - PH - 4; const mid = Math.round((f.top + f.bottom) / 2); f.mid = mid;
    const lx = clamp(Math.round(Wf * .28), 50, 80); f.pos[left.id] = { x: lx, y: Math.min(mid + 132, f.bottom - 4), dir: 1 }; f.pos[right.id] = { x: Wf - lx, y: mid - 16, dir: -1 };
    f.split = [[Wf + 2, mid - 26], [-2, mid + 26]]; f.region[right.id] = [[-2, -2], [Wf + 2, -2], [Wf + 2, mid - 26], [-2, mid + 26]]; f.region[left.id] = [[-2, mid + 26], [Wf + 2, mid - 26], [Wf + 2, Hf + 2], [-2, Hf + 2]];
    f.hintY = mid + 22; f.bannerY = mid - 12; f.entry = { [right.id]: [0, -1], [left.id]: [0, 1] };
  } else {
    f.panels[left.id] = { x: 4, y: 4, w: PW, h: PH, side: -1 }; f.panels[right.id] = { x: Wf - 4 - PW, y: 4, w: PW, h: PH, side: 1 };
    f.top = 4 + PH + 4; f.bottom = Hf - 16; const gy = Hf - 22; const lx = Math.round(Wf * .27);
    f.pos[left.id] = { x: lx, y: gy, dir: 1 }; f.pos[right.id] = { x: Wf - lx, y: gy, dir: -1 };
    const hx = Math.round(Wf / 2), lean = 14; f.split = [[hx + lean, -2], [hx - lean, Hf + 2]]; f.region[left.id] = [[-2, -2], [hx + lean, -2], [hx - lean, Hf + 2], [-2, Hf + 2]]; f.region[right.id] = [[hx + lean, -2], [Wf + 2, -2], [Wf + 2, Hf + 2], [hx - lean, Hf + 2]];
    f.hintY = Hf - 10; f.bannerY = f.top + 4; f.entry = { [left.id]: [-1, 0], [right.id]: [1, 0] };
  }
  const L = { W, H, z, stacked, PW: PW * z, PH: PH * z, TH, panels: {}, pos: {}, f, top: f.top * z, bottom: f.bottom * z, hintY: f.hintY * z, bannerY: f.bannerY * z, gy: Math.round((f.pos[left.id].y + f.pos[right.id].y) / 2) * z };
  for (const id in f.panels) { const p = f.panels[id]; L.panels[id] = { x: p.x * z, y: p.y * z, w: p.w * z, h: p.h * z, side: p.side }; }
  for (const id in f.pos) { const p = f.pos[id]; L.pos[id] = { x: p.x * z, y: p.y * z, dir: p.dir }; }
  return L;
}
const DUEL_SKY = {
  meadow: { sky: ['#3f5f96', '#4f6fa0', '#5f82b2', '#7398c2', '#8db0d0', '#a4c2da'], far: '#3a5f63', mid: '#3b6b45', near: '#2f5a3a', trees: 7, sun: '#fff3b0', clouds: true },
  forest: { sky: ['#31506f', '#3f5f80', '#4a6d8e', '#557a9a', '#6a8aa6', '#7d9ab2'], far: '#2c4f45', mid: '#2a5238', near: '#1f4530', trees: 14, clouds: true },
  cave: { sky: ['#120e17', '#17121c', '#1d1724', '#231c2b', '#2a2233', '#2f2738'], far: '#2c2436', mid: '#332a3e', near: '#3a3046', stalactites: true },
  interior: { sky: ['#1a1a30', '#20203a', '#26263f', '#2c2c46', '#33334e', '#3a3a56'], far: '#3c3b56', mid: '#44435e', near: '#4c4a66', pillars: true },
  volcano: { sky: ['#140404', '#1e0806', '#30100a', '#45170c', '#5e2210', '#7a3016'], far: '#3a2020', mid: '#463030', near: '#2c1c1c', glow: true, embers: true },
  snow: { sky: ['#47617f', '#546a86', '#6d84a2', '#8ba0ba', '#a9bacd', '#c0cedc'], far: '#7d90a8', mid: '#93a6bc', near: '#a6b6c8', trees: 5, sun: '#ffffff', clouds: true },
};
function clipPoly(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip(); }
// Sky and distant scenery for one side, in field space, with the horizon at that side's ground line.
function duelBackdrop(q, u, L) {
  const K = DUEL_SKY[q.biome] || DUEL_SKY.meadow, f = L.f, W = f.Wf, H = f.Hf, p = f.pos[u.id], hz = p.y - 40, R = mulberry32(q.seed + (p.dir > 0 ? 0 : 977)), t = BT.time;
  const n = K.sky.length; K.sky.forEach((c, i) => { const y0 = Math.round(hz * i / n), y1 = Math.round(hz * (i + 1) / n); rect(0, y0, W, y1 - y0 + 1, c); if (i) dither(0, y0 - 2, W, 3, K.sky[i - 1], i); });
  rect(0, hz, W, H - hz, K.near);
  if (K.sun && p.dir < 0) { const sx = Math.round(W * .78), sy = Math.round(hz * .3); ctx.globalAlpha = .25; circle(sx, sy, 16, K.sun); ctx.globalAlpha = 1; circle(sx, sy, 9, K.sun); circle(sx, sy, 7, '#ffffff'); }
  if (K.clouds) for (let i = 0; i < 5; i++) { const cw = 26 + Math.round(R() * 30), cy = Math.round(hz * (.12 + R() * .5)), cx = ((R() * (W + cw * 2) + t * (3 + i)) % (W + cw * 2)) - cw; const col = shade(K.sky[Math.min(n - 1, Math.floor(cy / hz * n))], .18); ellipse(cx, cy, cw >> 1, 4, col); ellipse(cx - (cw >> 2), cy + 2, cw >> 2, 3, col); ellipse(cx + (cw >> 2), cy + 1, (cw * .3) | 0, 3, col); hline(cx - (cw >> 1), cy + 4, cw, shade(col, -.12)); }
  if (K.glow) { ctx.globalAlpha = .4; ellipse(Math.round(W / 2), hz, Math.round(W / 2), 26, '#e04e1a'); ctx.globalAlpha = 1; }
  if (K.embers) for (let i = 0; i < 14; i++) { const ex = Math.round(R() * W), ph = R() * 10; const ey = hz + 20 - ((t * (8 + R() * 10) + ph * 30) % (hz + 30)); px(ex + Math.round(Math.sin(t * 2 + ph) * 3), ey, i % 3 ? '#ff8a2c' : '#ffd25a'); }
  if (K.pillars) for (let i = 0; i < 4; i++) { const x = Math.round(W * (i + .5) / 4); rect(x - 7, 0, 14, hz + 4, K.far); vline(x - 7, 0, hz + 4, K.near); vline(x + 6, 0, hz + 4, shade(K.far, -.35)); rect(x - 9, hz - 6, 18, 4, shade(K.far, -.2)); }
  if (K.stalactites) for (let i = 0; i < 12; i++) { const x = Math.round(R() * W), h = 12 + Math.round(R() * 34); for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * 7)); rect(x - (w >> 1), j, w, 1, j % 6 ? K.mid : shade(K.mid, -.15)); } }
  const range = (base, amp, col, step) => { let y = base + Math.round((R() - .5) * amp); for (let x = 0; x <= W; x += step) { const ny = base + Math.round((R() - .5) * amp); for (let i = 0; i < step && x + i <= W; i++) { const yy = Math.round(lerp(y, ny, i / step)); rect(x + i, yy, 1, hz + 6 - yy, col); } y = ny; } };
  if (!K.stalactites && !K.pillars) { range(hz - 26, 22, shade(K.far, .12), 14); range(hz - 14, 14, K.far, 10); } else range(hz - 10, 8, K.far, 12);
  for (let i = 0; i < 6; i++) { const x = Math.round(W * (i + .5) / 6 + (R() - .5) * 40), r = 40 + Math.round(R() * 50); ellipse(x, hz + 6, r, Math.round(r * (K.stalactites ? .2 : .32)), K.mid); }
  if (K.trees) for (let i = 0; i < K.trees; i++) { const x = Math.round(R() * W), h = 12 + Math.round(R() * 14), w = 6 + Math.round(R() * 4); for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * j / h)); rect(x - (ww >> 1), hz + 4 - h + j, ww, 1, j % 5 === 0 ? shade(K.far, -.15) : K.far); } rect(x, hz + 4, 1, 2, shade(K.far, -.3)); }
  ctx.globalAlpha = .12; rect(0, hz - 8, W, 10, '#ffffff'); ctx.globalAlpha = 1;
}
// The diorama: three receding rows of that unit's terrain squashed into perspective, a lit front edge and a dark
// face below it, sitting on the near ground colour.
function duelDiorama(q, u, L) {
  const f = L.f, W = f.Wf, H = f.Hf, p = f.pos[u.id], t = q.terr[u.id], fr = Math.floor(BT.time * 3) % WATER_FRAMES, gy = p.y + 6;
  const rows = [[gy - 10, 10], [gy - 24, 14], [gy - 40, 16]]; // [top, height] from far to near, listed near first
  const start = p.x - TILE / 2 - Math.ceil(p.x / TILE) * TILE;
  for (let r = rows.length - 1; r >= 0; r--) { const [ry, rh] = rows[r]; const sh = r === 0 ? 0 : r === 1 ? -.12 : -.22; let i = 0; for (let x = start - r * 6; x < W + TILE; x += TILE, i++) { const v = (B.map.variants[u.y] || [])[(u.x + i + r * 3) % B.map.w] || 0; ctx.drawImage(tileImg(t.ch, v, fr), 0, 0, TILE, TILE, x, ry, TILE, rh); } if (sh) { ctx.globalAlpha = -sh; rect(0, ry, W, rh, '#0b1020'); ctx.globalAlpha = 1; } }
  hline(0, gy - 40, W, '#ffffff40'); rect(0, gy, W, 5, shade('#4a3a28', -.1)); rect(0, gy + 5, W, 3, '#1c1410'); ctx.globalAlpha = .55; rect(0, gy + 8, W, H - gy - 8, '#0b1020'); ctx.globalAlpha = 1;
  ctx.globalAlpha = .35; hline(0, gy - 1, W, '#ffffff'); ctx.globalAlpha = 1;
}
function duelDrawUnit(q, u, L, t) {
  const f = L.f, p = f.pos[u.id], v = q.view[u.id]; let dx = 0, dy = 0, sx = 1, sy = 1, tint = null, alpha = 1, breath = 0, speed = 1; const flip = p.dir === 1; const soft = REDUCED ? .3 : 1;
  const pose = q.pose && q.pose.unit === u ? q.pose : null; const ghosts = [];
  if (pose) {
    const k = t - pose.t0;
    if (pose.kind === 'windup') { const e = Math.min(1, k / DUEL_T.windup); dx = -p.dir * 6 * easeOut(e) * soft; speed = 2.4; if (pose.fam === 'contact') { sy = 1 - .08 * e; sx = 1 + .06 * e; } else { sy = 1 + .05 * e; sx = 1 - .03 * e; } if (Math.floor(k * 20) % 2 === 0 && e < .8) tint = shade(TYPE_COL[q.banner ? q.banner.move.type : 'Normal'] || '#ffffff', .3); }
    else if (pose.kind === 'lunge') { const e = Math.min(1, k / pose.dur); const reach = f.stacked ? 26 : 44; if (e < 1) { dx = p.dir * lerp(-6, reach, easeIn(e)) * soft; sx = 1.08; sy = .95; speed = 2; if (e > .3) ghosts.push([dx - p.dir * 8, .3], [dx - p.dir * 16, .15]); } else dx = p.dir * lerp(reach, 0, easeOut(Math.min(1, (k - pose.dur) / .35))) * soft; }
    else if (pose.kind === 'cast') { const e = Math.min(1, k / pose.dur); dx = p.dir * (e < 1 ? lerp(-6, 8, e) : lerp(8, 0, Math.min(1, (k - pose.dur) / .3))) * soft; if (e < 1) { sy = 1.04; speed = 2; } }
  }
  const hit = q.hitFx && q.hitFx.unit === u ? t - q.hitFx.t0 : -1;
  if (hit >= 0 && hit < .3) { dx += -p.dir * 10 * (1 - hit / .3) * soft; if (hit < .14 && Math.floor(hit * 30) % 2 === 0) tint = '#ffffff'; speed = 0; }
  const miss = q.missFx && q.missFx.unit === u ? t - q.missFx.t0 : -1;
  if (miss >= 0 && miss < .4) { const h = Math.sin(miss / .4 * Math.PI); dx += -p.dir * 14 * h * soft; dy -= 10 * h * soft; }
  const ko = q.koFx && q.koFx.unit === u ? t - q.koFx.t0 : -1;
  if (ko >= .28) return; // gone in the blast
  if (ko >= 0) { tint = Math.floor(ko * 30) % 2 ? '#ffffff' : null; sx = 1 + ko * .3; sy = 1 - ko * .2; }
  const idle = !pose && hit < 0 && ko < 0;
  if (!REDUCED && idle) { if (v.fly) dy -= 3 + Math.round(Math.sin(BT.time * 3 + u.id) * 3); else breath = Math.sin(BT.time * 2.2 + u.id) > 0 ? 1 : 0; }
  const shadowW = Math.round(28 * sx * (1 - Math.max(0, -dy) / 40)); ctx.globalAlpha = .32 * alpha * (v.fly ? .7 : 1); ellipse(Math.round(p.x + dx), p.y + 1, Math.max(6, shadowW), 5, '#000000'); ctx.globalAlpha = 1;
  const num = v.num, kind = q.big ? q.big[u.id] : duelSpriteKind(num); const at = BT.time * (speed || 1e-6);
  const draw = (x, o) => { if (kind === 'anim') drawAnim(num, x, p.y + dy, at, o); else if (kind === 'big') drawBig(num, x, p.y + dy, Object.assign({ breath }, o)); else drawMon(num, x, p.y + dy, Object.assign({}, o, { sx: 2 * (o.sx || 1), sy: 2 * (o.sy || 1) })); };
  for (const [gx, ga] of ghosts) draw(p.x + gx, { flip, tint: '#ffffff', alpha: ga * alpha, sx, sy });
  draw(p.x + dx, { flip, tint, alpha, sx, sy });
}
// Header panel: portrait, name and level, HP counter and bar, tags and types, terrain defence as stars.
function duelPanel(q, u, L, dy) {
  const f = L.f, P = f.panels[u.id], v = q.view[u.id], hp = duelHpAt(q.script, q.t, u.id), t = q.terr[u.id], col = teamColor(u.team), ko = q.koFx && q.koFx.unit === u && q.t - q.koFx.t0 > .3;
  const y0 = P.y + dy; panel(P.x, y0, P.w, P.h, { border: col, fill: ko ? '#1a1a22' : (u.team === 0 ? '#182440' : u.team === 1 ? '#2a1a22' : UI.panel) });
  const x = P.x + 6, y = y0 + 5;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, 26, 24); ctx.clip(); portraitBg(x, y, 26, 24, u.team); ctx.drawImage(monIcon(v.num, u.team !== 0), x + 1, y + 4, 24, 18); ctx.restore(); teamGlyph(x + 2, y + 2, u.team, teamColorL(u.team));
  const tx = x + 31; let name = v.name; while (textWidth(name) > P.w - 76 && name.length > 3) name = name.slice(0, -1);
  text(name, tx, y, ko ? UI.dim : UI.ink); textR('Lv' + v.level, P.x + P.w - 6, y, ko ? UI.dim : UI.gold);
  const ratio = clamp(hp / v.maxHp, 0, 1); const hs = String(Math.max(0, hp)), hw = textWidth(hs, BIG) + textWidth('/' + v.maxHp) + 3;
  bar(tx, y + 11, P.w - 37 - hw - 6, 6, ratio, hpColor(ratio), UI.hpBack, { notch: true }); bigText(hs, P.x + P.w - 6 - hw, y + 9, hp <= 0 ? UI.red : UI.ink, { outline: '#000' }); textR('/' + v.maxHp, P.x + P.w - 6, y + 11, UI.muted);
  let bx = tx; bx += tagBadge(duelTeamTag(u), col, bx, y + 20) + 3; v.types.forEach((tp, i) => { typeBadge(tp, bx, y + 19, 24); bx += 26; }); if (v.status) { statusBadge(v.status, bx, y + 20); bx += 17; } if (v.brace) { miniBadge('BRC', BRACE_COL, bx, y + 20); bx += 17; } else if (v.root) { miniBadge('RT', ROOT_COL, bx, y + 20); bx += 17; }
  const stars = Math.min(4, Math.round(terrainDef(t, u) / 10)); const ds = 'DEF ' + '★'.repeat(stars) + (stars ? '' : '-'); textR(ds, P.x + P.w - 6, y + 20, stars ? UI.gold : UI.dim);
}
function drawDuel(q) {
  const L = duelLayout(q), f = L.f, t = q.t, W = f.Wf, H = f.Hf, z = L.z, S = q.script, outAt = S.total - S.outro;
  const kIn = REDUCED ? 1 : easeOut(clamp((t - .1) / .4, 0, 1)), kOut = REDUCED ? 1 : 1 - easeIn(clamp((t - outAt) / (S.outro - .05), 0, 1)), k = Math.min(kIn, kOut);
  ctx.save(); ctx.scale(z, z);
  rect(0, 0, W, H, '#070a14');
  // camera (zoom towards the acting unit) and the impact jolt, both around the field
  const c = q.cam || { zoom: 1, x: 0, y: 0 }; const jolt = q.jolt && t - q.jolt.t0 < .25 && !REDUCED ? Math.round(Math.sin((t - q.jolt.t0) * 40) * q.jolt.n * (1 - (t - q.jolt.t0) / .25)) * q.jolt.dir : 0;
  ctx.save(); if (c.zoom > 1.001) { ctx.translate(c.x, c.y); ctx.scale(c.zoom, c.zoom); ctx.translate(-c.x, -c.y); } ctx.translate(FX.shakeX + jolt, FX.shakeY);
  for (const u of [q.sides.left, q.sides.right]) { // each side: its own region, sliding in from its edge
    const e = f.entry[u.id], off = (1 - k) * (e[0] ? W * .6 : H * .5); ctx.save(); clipPoly(f.region[u.id].map(pt => [pt[0] + e[0] * off, pt[1] + e[1] * off])); ctx.translate(e[0] * off, e[1] * off);
    duelBackdrop(q, u, L); duelDiorama(q, u, L); ctx.restore();
  }
  // the split line
  { const [a, b] = f.split; pline(a[0] + 1, a[1], b[0] + 1, b[1], '#ffffff60', 2); pline(a[0], a[1], b[0], b[1], '#070a14', 3); }
  if (q.focus && !REDUCED) { const fo = q.focus, kf = t < fo.t0 + .15 ? (t - fo.t0) / .15 : t > fo.until - .25 ? Math.max(0, (fo.until - t) / .25) : 1; if (kf > 0) { ctx.globalAlpha = .3 * kf; rect(-40, -40, W + 80, H + 80, '#050815'); ctx.globalAlpha = 1; } }
  const order = [q.sides.right, q.sides.left]; if (q.pose && q.pose.unit === q.sides.right) order.reverse();
  for (const u of order) { const e = f.entry[u.id], off = (1 - k) * (e[0] ? W * .6 : H * .5); ctx.save(); ctx.translate(e[0] * off, e[1] * off); duelDrawUnit(q, u, L, t); ctx.restore(); }
  drawFX(0, 0, false); drawFXTexts(0, 0); ctx.restore();
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, W, H, FX.flashCol); ctx.globalAlpha = 1; }
  for (const u of [q.sides.left, q.sides.right]) { const P = f.panels[u.id]; const fromTop = P.y < H / 2; duelPanel(q, u, L, Math.round((1 - k) * (fromTop ? -(P.h + 8) : P.h + 8))); }
  const b = q.banner;
  if (b && t < b.until) {
    const kb = Math.min(1, (t - b.t0) / .12), name = b.move.name.toUpperCase(), col = TYPE_COL[b.move.type] || UI.ink; const w = textWidth(name, BIG) + 44, x = Math.round(W / 2 - w / 2), y = Math.round(f.bannerY - (1 - easeOut(kb)) * 6);
    rrect(x + 1, y + 2, w, 17, UI.shadow, 2); rrect(x, y, w, 17, UI.inset, 2); rrect(x + 1, y + 1, w - 2, 15, '#101a30', 1); hline(x + 2, y + 1, w - 4, shade(col, -.2)); hline(x + 2, y + 15, w - 4, shade(col, -.5)); rect(x + 1, y + 2, 2, 13, col);
    typeBadge(b.move.type, x + 7, y + 4, 24); bigText(name, x + 35, y + 4, col, { outline: '#000' });
    if (b.counter) { const cw = textWidth('COUNTER!') + 10; rrect(Math.round(W / 2 - cw / 2), y - 11, cw, 10, UI.red, 1); textC('COUNTER!', W / 2, y - 10, '#ffffff'); }
  }
  if (k >= .99) hintLine(q.boost ? (VIEW.touch ? ['tap again: skip'] : [['X', 'skip']]) : (VIEW.touch ? ['tap: faster', 'tap twice: skip'] : [['any key', 'faster'], ['X', 'skip']]), W / 2, f.hintY);
  ctx.restore();
}
// The whole frame: a short dip to black from the board, the scene (its dioramas slide in and out), and back.
function drawDuelFrame(q) {
  const S = q.script, W = VIEW.w, H = VIEW.h, t = q.t, outAt = S.total - S.outro, dip = .1;
  const kIn = t < dip ? t / dip : 1, kOut = t >= S.total - dip ? (S.total - t) / dip : 1; const k = Math.min(kIn, kOut);
  if (k >= 1) { drawDuel(q); return; }
  drawBoard();
  ctx.globalAlpha = clamp(k, 0, 1); rect(0, 0, W, H, '#070a14'); ctx.globalAlpha = 1;
}
