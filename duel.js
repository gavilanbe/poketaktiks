// ============================================================================
// duel.js — the lateral battle scene. A resolved exchange (resolveCombat's
// event list plus the HP both units had before it) is turned into a script of
// timed beats — wind-up, launch, impact, miss, KO, thaw — replayed on a split
// battlefield with the big sprites, two HP panels, each side's terrain and the
// attack name. The script is a pure function of the events: nothing is
// rerolled, the model is never touched, and skipping only moves the clock.
// Everything else here is presentation: stripes, VS, charge-ups, impact
// frames, focus lines, huge numbers, ghost HP, the faint and the victory hop.
// ============================================================================
'use strict';
const DUEL_T = { intro: .72, windup: .26, contact: .16, ranged: .3, hold: .46, drop: .35, gap: .18, miss: .45, ko: 1.05, thaw: .3, outro: .34 };
const DUEL_FAMILIES = { Fire: 'fire', Water: 'water', Ice: 'water', Electric: 'electric', Grass: 'grass', Psychic: 'psychic', Ghost: 'psychic', Fairy: 'psychic', Poison: 'psychic', Dragon: 'psychic' };
// Attack family: melee-only moves are contact whatever their type; ranged ones go by type, else a generic projectile or beam.
function duelFamily(move) { if (move.rng[1] <= 1) return 'contact'; return DUEL_FAMILIES[move.type] || 'neutral'; }
// How long the travel lasts: the move's own choreography decides (attackfx.js), else its family.
function duelLaunchTime(fam, move) { return move ? atkTravelTime(move, fam) : fam === 'contact' ? DUEL_T.contact : fam === 'electric' ? .2 : DUEL_T.ranged; }

// ---------------------------------------------------------------- script (pure)
// events: the hit/miss/ko/thaw events of one exchange, in resolver order. hp0: {unitId: hp before the exchange}.
// Returns {beats, total, intro, outro, hp0, hpEnd}. Every impact beat records the HP it starts from and
// ends at, so the displayed HP never depends on the (already final) model HP. Wind-ups carry the event they lead to
// (so the charge can be sized to it) and whether the strike is the attacker's follow-up.
function duelScript(events, hp0, T = DUEL_T) {
  const beats = [], hp = Object.assign({}, hp0); let t = 0, first = true, lastAtt = null;
  beats.push({ t, kind: 'intro' }); t += T.intro;
  for (const e of events) {
    if (e.type === 'hit' || e.type === 'miss') {
      if (!first) t += T.gap; first = false; const fam = duelFamily(e.move), follow = lastAtt === e.att; lastAtt = e.att;
      const wt = T === DUEL_T ? atkWindupTime(e.move) : T.windup, lt = T === DUEL_T ? duelLaunchTime(fam, e.move) : duelLaunchTime(fam); // each move charges and travels at its own pace
      beats.push({ t, kind: 'windup', att: e.att, def: e.def, move: e.move, counter: !!e.counter, fam, ev: e, follow, dur: wt, travel: lt }); t += wt;
      beats.push({ t, kind: 'launch', att: e.att, def: e.def, move: e.move, fam, ev: e, dur: lt }); t += lt;
      if (e.type === 'miss') { beats.push({ t, kind: 'miss', att: e.att, def: e.def, move: e.move, ev: e, fam }); t += T.miss; continue; }
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
function duelTeamTag(u) { if (B && B.versus) return u.team === 2 ? 'WLD' : TR('P{0}', u.team + 1); return u.team === 0 ? 'YOU' : u.team === 1 ? 'FOE' : u.team === 2 ? 'WLD' : 'ALY'; }
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
  q.flash = null; q.lines = null; q.victor = null; q.stamp = null; q.shakePanel = {}; q.cues = {}; q.lift = null; q.off = {};
  q.terr = { [q.att.id]: terrAt(q.att.x, q.att.y), [q.def.id]: terrAt(q.def.x, q.def.y) }; q.biome = duelBiome(q); q.seed = (q.att.id * 31 + q.def.id * 7 + B.turn * 3) | 0;
  for (const u of [q.att, q.def]) { requestBigSprite(q.view[u.id].num); requestAnim(q.view[u.id].num); BT.hpShow.set(u.id, { from: q.hp0[u.id], to: q.hp0[u.id], t: 0, hold: true }); }
  q.cam = { zoom: 1, x: 0, y: 0, tz: 1, tx: 0, ty: 0 };
  for (const e of q.events) if (e.type === 'ko') noteKo(e);
  FX.parts = []; FX.sprites = []; FX.texts = []; centerCamBetween(q.att, q.def); Audio.sfx('wipe');
}
function duelRate(q) { let r = PREF.battle === 'quick' ? 1.7 : 1; if (BT.fast) r *= 1.6; if (q.boost) r *= 3.5; return r; }
// One-shot cues keyed by name: fires the callback the first time the scene clock passes `at`.
function duelCue(q, key, at, fn) { if (!q.cues[key] && q.t >= at) { q.cues[key] = true; fn(); } }
function updateDuel(q, dt) {
  const S = q.script; q.t += dt * duelRate(q);
  if (!q.big && q.t >= S.intro * .5) q.big = { [q.att.id]: duelSpriteKind(q.view[q.att.id].num), [q.def.id]: duelSpriteKind(q.view[q.def.id].num) }; // decide once: no pop-in mid-scene
  if (q.cam) { const c = q.cam, k = Math.min(1, dt * 9); c.zoom += (c.tz - c.zoom) * k; c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; }
  // the VS emblem lands with a thud a moment after the dioramas meet
  if (!q.skipped) duelCue(q, 'vs', .34, () => { if (!REDUCED) { Audio.sfx('stamp'); shake(3); } });
  while (q.i < S.beats.length && S.beats[q.i].t <= q.t) duelBeat(q, S.beats[q.i++]);
  if (q.stamp && !q.stamp.landed && q.t >= q.stamp.t0 + .07) { q.stamp.landed = true; Audio.sfx('stamp'); if (!REDUCED) shake(4); }
  if (q.t >= S.total) { q.done = true; DUEL_WIPE.t0 = BT.time; duelAftermath(q); }
}
// Jump to the outro: the HP shown is the script's end state, identical to what playing it out reaches.
function skipDuel(q) {
  if (q.skipped) return; q.skipped = true; q.boost = true; const S = q.script, outroAt = S.total - S.outro;
  if (q.t < outroAt) { q.t = outroAt; while (q.i < S.beats.length && S.beats[q.i].t <= q.t) { const b = S.beats[q.i++]; if (b.kind === 'outro') duelBeat(q, b); else duelApplyBeat(q, b); } }
  q.pose = q.hitFx = q.missFx = q.banner = q.focus = q.flash = q.lines = q.victor = q.stamp = null; FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; if (q.cam) { q.cam.tz = 1; q.cam.tx = q.cam.ty = 0; }
}
// First press speeds the scene up, a second press (or X / right click) skips to the result.
function duelInput(q, ev) {
  if (ev.type === 'move' || ev.type === 'up' || ev.type === 'wheel' || (ev.type === 'key' && ev.repeat)) return;
  const hard = (ev.type === 'key' && ev.key === 'back') || (ev.type === 'down' && ev.btn === 2);
  if (hard || q.boost) skipDuel(q); else q.boost = true;
}
// Heavy moments: an impact frame (the scene flips to silhouettes on a bright field for a few frames) and manga focus
// lines converging on the point. Crits, KOs and super-effective hits get them; reduced motion never does.
function duelHeavy(q, x, y, col, frame, lines, dur = .5) {
  if (REDUCED) return; if (frame) q.flash = { t0: q.t, dur: frame, col, x, y }; if (lines) q.lines = { t0: q.t, until: q.t + dur, x, y, col: lines };
}
function duelBeat(q, b) {
  const L = duelLayout(q), z = L.z, P = id => ({ x: L.pos[id].x / z, y: L.pos[id].y / z, dir: L.pos[id].dir }); duelApplyBeat(q, b);
  switch (b.kind) {
    case 'windup': {
      const a = P(b.att.id), st = atkStyle(b.move), wt = b.dur || DUEL_T.windup, lt = b.travel || duelLaunchTime(b.fam, b.move);
      q.pose = { unit: b.att, kind: 'windup', t0: q.t, fam: b.fam, dur: wt, style: st.pose }; q.banner = { move: b.move, counter: b.counter, follow: b.follow, t0: q.t, until: q.t + wt + lt + .55 }; q.focus = { t0: q.t, until: q.t + wt + lt + .45, a: st.focus, col: st.focusCol }; duelCamTo(q, a, 1.12);
      Audio.sfx(b.fam === 'contact' ? 'swing' : 'charge'); atkWindup(duelAtkCtx(q, b, L, wt, lt)); // the move's own charge (attackfx.js)
      break;
    }
    case 'launch': { // the attacker's move (a lunge, a cast, a leap, burrowing, a stomp) and the travel of the attack
      const st = atkStyle(b.move), dur = b.dur || duelLaunchTime(b.fam, b.move), pose = st.pose || (b.fam === 'contact' ? 'lunge' : 'cast'); q.pose = { unit: b.att, kind: pose, t0: q.t, fam: b.fam, dur, style: pose };
      if (pose === 'lunge' || pose === 'rush' || pose === 'leap') Audio.sfx('whoosh'); else if (!REDUCED) shake(1);
      if (st.react === 'lift' && b.ev && b.ev.type !== 'miss') q.lift = { unit: b.def, t0: q.t, dur };
      atkLaunch(duelAtkCtx(q, b, L, 0, dur)); break; }
    case 'impact': {
      const e = b.ev, d = P(b.def.id), a = P(b.att.id), cx = d.x, cy = d.y - 44, lethal = e.hpAfter <= 0, heavy = e.crit || lethal, col = TYPE_COL[b.move.type] || '#ffffff';
      const st = atkStyle(b.move), c = duelAtkCtx(q, b, L, 0, 0); q.hitFx = { unit: b.def, t0: q.t, crit: e.crit, lethal, react: e.dmg > 0 ? st.react : null }; q.shakePanel[b.def.id] = q.t;
      atkImpact(c); duelCamTo(q, d, heavy ? 1.26 : e.eff > 1 ? 1.2 : 1.15); // the move's own impact (attackfx.js)
      q.jolt = { t0: q.t, dir: -d.dir, n: e.crit ? 7 : lethal ? 6 : e.dmg > 0 ? 4 : 0 };
      Audio.sfx(e.dmg === 0 ? 'miss' : e.crit ? 'crit' : e.eff > 1 ? 'hit2' : 'hit'); if (heavy && e.dmg > 0) Audio.sfx('thud');
      if (e.dmg > 0) {
        shake(e.crit ? 8 : lethal ? 7 : e.eff > 1 ? 5 : 3); if (!q.boost) FX.hitstop = e.crit ? .16 : lethal ? .14 : e.eff > 1 ? .08 : .05;
        flashScreen(e.crit ? '#fff2c0' : e.eff > 1 ? shade(col, .5) : '#ffffff', e.crit ? .45 : e.eff > 1 ? .35 : .2);
        if (heavy) duelHeavy(q, cx, cy, e.crit ? '#fff4c8' : '#ffffff', e.crit ? .07 : .05, e.crit ? UI.gold : '#ffffff', .55);
        else if (e.eff > 1) duelHeavy(q, cx, cy, null, 0, shade(col, .4), .35);
        // knockback dust at the feet, and chips of the ground itself thrown back and bouncing
        for (let i = 0; i < 4; i++) spawnSprite('poof', d.x + d.dir * (4 + i * 7), d.y, { size: 3 + (i % 2) * 2, life: .4, col: '#d8d0b8', col2: '#f4f0e0', vx: -d.dir * (30 + i * 10), vy: -8, delay: i * .03 });
        duelDebris(q, b.def, d, heavy ? 12 : e.eff > 1 ? 9 : 6, 0);
        if (e.crit) { spawnSprite('boom', cx + d.dir * 4, cy - 2, { size: 15, life: .62, rot: vrnd() * 6 }); for (let i = 0; i < 2; i++) spawnSprite('smoke', cx + (i ? 9 : -9), cy - 8, { size: 5, life: 1.1, col: '#5e5866', col2: '#a8a2b0', vy: -18, vx: i ? 7 : -7, delay: .28 + i * .08 }); }
      }
      if (e.crit) spawnSprite('burst', cx, cy, { size: 34, life: .45, col: UI.gold, delay: .04 });
      // the number: huge, gold on a critical, orange when super effective; the tags above and below it fade before any KO stamp
      const numCol = e.crit ? UI.gold : e.eff > 1 ? '#ffb040' : e.eff === 0 ? '#c0c0c0' : '#ffffff';
      floatText(cx - d.dir * 20, cy - 34, String(e.dmg), numCol, { huge: e.crit || e.dmg >= 20 ? 3 : 2, life: .95, vy: -18, outline: '#1a0a14' }); // up and behind the target, clear of the impact
      // the tags stack under the number: the top of the screen belongs to the panels and the move banner
      let ty = cy + 4;
      if (e.crit) { floatText(cx, ty, 'CRITICAL!', UI.gold, { big: true, life: .75, delay: .03, outline: '#3a2000', vy: -10 }); ty += 13; }
      else floatText(cx + d.dir * -18, cy - 44, MOVE_POP[b.move.type], col, { life: .6, delay: .05, outline: '#000', vy: -12 });
      if (e.eff > 1) { floatText(cx, ty + 4, e.eff >= 2 ? 'SUPER EFFECTIVE!!' : 'Super effective!', '#ffd24a', { big: e.eff >= 2, delay: .18, life: .8, outline: '#402000', vy: -8 }); ty += 12; }
      else if (e.eff === 0) { floatText(cx, ty + 4, 'No effect...', '#c0c0c0', { delay: .18, life: .8, vy: -8 }); ty += 10; }
      else if (e.eff < 1) { floatText(cx, ty + 4, 'Not very effective', '#a0d0ff', { delay: .18, life: .8, vy: -8 }); ty += 10; }
      if (e.status) { floatText(cx, ty + 6, TR('{0}!', STATUS[e.status].text.toUpperCase()), STATUS[e.status].col, { delay: .38, life: .9, outline: '#000', vy: -8 }); duelStatusFx(e.status, d, q); }
      if (e.drain) { floatText(a.x, a.y - 70, '+' + e.drain, UI.green, { delay: .45, outline: '#0a3a10', big: true }); atkDrain(c); }
      break;
    }
    case 'miss': { const d = P(b.def.id); q.missFx = { unit: b.def, t0: q.t }; duelCamTo(q, d, 1.08); Audio.sfx('miss'); Audio.sfx('whoosh'); floatText(d.x, d.y - 74, 'MISS', '#d8d8e8', { huge: 2, life: .8, outline: '#1a1a2a', vy: -14 }); for (let i = 0; i < 3; i++) spawnSprite('wind', d.x - d.dir * 10, d.y - 30 - i * 10, { size: 14, life: .3, col: '#ffffff', vx: -d.dir * 90, delay: i * .03 }); break; }
    case 'ko': {
      const p = P(b.unit.id), cy = p.y - 40, own = isHuman(b.unit.team); q.koFx = { unit: b.unit, t0: q.t }; q.focus = { t0: q.t, until: q.t + DUEL_T.ko - .1 }; duelCamTo(q, p, 1.24);
      Audio.sfx('faint'); fadeFloatTexts(.28); if (!REDUCED) { shake(5); if (!q.boost) FX.hitstop = .12; } duelHeavy(q, p.x, cy, null, 0, own ? '#ff8080' : '#ffffff', .8);
      // the faint: blink, then sink into the ground; dust where it went down; the stamp over its half of the field
      for (let i = 0; i < 6; i++) spawnSprite('poof', p.x + (i - 2.5) * 10, p.y - 2, { size: 6 + (i % 2) * 2, life: .7, col: '#6a6a78', col2: '#b0b0c0', vy: -10, vx: (i - 2.5) * 6, delay: .38 + i * .04 });
      spawnParts(p.x, cy, 18, own ? ['#ff8080', '#ffffff'] : ['#ffffff', '#ffd24a', '#ff8a2c'], { speed: 90, life: .7, grav: 80, delay: .3 });
      for (let i = 0; i < 3; i++) spawnSprite('boom', p.x + (i - 1) * 13, p.y - 16 - (i % 2) * 14, { size: 12 + i * 3, life: .75, col: 'dust', rot: i * 2.1, delay: .36 + i * .1 }); duelDebris(q, b.unit, p, 10, .4);
      q.stamp = { unit: b.unit, text: own ? 'FAINTED!' : 'K.O.!', col: own ? '#ff6a6a' : UI.gold, ink: own ? '#2a0008' : '#3a2000', t0: q.t + .3, dur: DUEL_T.ko - .32 };
      if (b.by && b.by.hp > 0 && b.by !== b.unit) q.victor = { unit: b.by, t0: q.t + .62 };
      break;
    }
    case 'thaw': { const p = P(b.unit.id); floatText(p.x, p.y - 70, 'Thawed!', '#98d8f8', { big: true }); for (let i = 0; i < 8; i++) { const an = vrnd() * Math.PI * 2; spawnSprite('shard', p.x, p.y - 30, { life: .5, col: '#bde4f8', vx: Math.cos(an) * 60, vy: Math.sin(an) * 40 - 30, grav: 160, rot: i, spin: 8 }); } break; }
    case 'outro': { FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; q.banner = null; q.focus = null; q.lines = null; q.flash = null; q.stamp = null; if (q.cam) { q.cam.tz = 1; q.cam.tx = q.cam.ty = 0; } for (const u of [q.att, q.def]) BT.hpShow.delete(u.id); Audio.sfx('wipe'); break; }
  }
}
// Chips of the ground a hit throws back: they fly away from the attacker, bounce on the defender's ground line and
// settle; on water the hit throws a splash instead. Coloured by the panorama the defender stands in.
function duelDebris(q, u, d, n, delay = 0) {
  if (REDUCED) return; const K = q.scenes && q.scenes[u.id] ? q.scenes[u.id].kind : 'field';
  if ((K === 'sea' || K === 'pool') && !q.view[u.id].fly) { for (let i = 0; i < n; i++) spawnSprite('drop', d.x + (vrnd() - .5) * 18, d.y - 8, { vx: (vrnd() - .5) * 100, vy: -70 - vrnd() * 80, grav: 330, life: .6, col: '#a2d8ff', col2: '#ffffff', delay }); spawnSprite('ring', d.x, d.y - 5, { size: 22, life: .5, col: '#e8f6ff', delay }); return; }
  const cols = K === 'beach' ? ['#e0c688', '#f8e8c0'] : K === 'snow' ? ['#ffffff', '#c8d4e8'] : K === 'cave' || K === 'mountain' ? ['#6c5a4c', '#a89a8e'] : K === 'base' ? ['#8f889a', '#c8c2cc'] : K === 'volcano' ? ['#3c2b23', '#ff8a2c'] : K === 'town' ? ['#948e9a', '#c0bac4'] : K === 'road' ? ['#b08f5a', '#ecdcaa'] : K === 'forest' ? ['#2b6032', '#b86a2a'] : K === 'bridge' ? ['#845430', '#d2a266'] : ['#3f8440', '#80c86a'];
  for (let i = 0; i < n; i++) spawnSprite('debris', d.x + (vrnd() - .5) * 14, d.y - 4 - vrnd() * 10, { vx: -d.dir * (30 + vrnd() * 100) + (vrnd() - .5) * 40, vy: -80 - vrnd() * 100, grav: 400, floor: d.y + Math.round(vrnd() * 9) - 2, life: 1 + vrnd() * .3, size: vrnd() < .5 ? 3 : 2, col: cols[0], col2: cols[1], rot: vrnd() * 4, spin: 12, delay: delay + vrnd() * .04 });
}
// What an inflicted status looks like on the Pokémon it lands on (field space).
function duelStatusFx(st, d, q) {
  const x = d.x, y = d.y - 30;
  if (st === 'brn') { Audio.sfx('burn'); for (let i = 0; i < 8; i++) spawnSprite('flame', x + (vrnd() - .5) * 30, y + 10 + (vrnd() - .5) * 20, { size: 2 + Math.round(vrnd() * 2), life: .6, col: '#ffd25a', col2: '#ff4a20', vy: -40 - vrnd() * 30, delay: .35 + vrnd() * .2 }); }
  else if (st === 'par') { Audio.sfx('para'); for (let i = 0; i < 5; i++) spawnSprite('bolt', x + (vrnd() - .5) * 34, y + (vrnd() - .5) * 24, { size: 9, life: .25, col: '#ffe94a', delay: .35 + i * .06 }); }
  else if (st === 'psn') { Audio.sfx('poison'); for (let i = 0; i < 9; i++) spawnSprite('bubble', x + (vrnd() - .5) * 30, y + 16, { size: 2 + (i % 3), life: .7, col: '#b060d0', col2: '#e0a0ff', vy: -30 - vrnd() * 20, delay: .35 + i * .04 }); }
  else if (st === 'frz') { Audio.sfx('water'); for (let i = 0; i < 5; i++) spawnSprite('crystal', x + (i - 2) * 11, d.y, { size: 18 + (i % 2) * 10, life: .8, col: '#bde4f8', col2: '#ffffff', delay: .35 + i * .05 }); }
}
// The strike context for attackfx.js in field space: where the attack leaves the attacker, the defender's chest, the
// ground lines, the sky above, the timing, and each unit's live offset so an effect can ride a lunge.
function duelAtkCtx(q, b, L, wt, dur) {
  const z = L.z, pos = id => ({ x: L.pos[id].x / z, y: L.pos[id].y / z, dir: L.pos[id].dir }), A = pos(b.att.id), D = pos(b.def.id), dir = A.dir;
  const ax = A.x + dir * 24, ay = A.y - 45, tx = D.x + D.dir * 4, ty = D.y - 42, dx = tx - ax, dy = ty - ay, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, miss = !!(b.ev && b.ev.type === 'miss');
  return { S: 1.25, board: false, stacked: !!L.f.stacked, A, D, dir, ax, ay, tx, ty, ex: miss ? tx + ux * 46 : tx, ey: miss ? ty + uy * 46 - 8 : ty, ux, uy, gy: D.y, gyA: A.y, top: L.f.top + 4, H: 84, wt, dur, rate: duelRate(q),
    move: b.move, type: b.move.type, pal: atkPal(b.move.type), e: b.ev, miss, q, att: b.att, def: b.def, fol: u => () => (q.off && q.off[u.id]) || [0, 0] };
}

// ---------------------------------------------------------------- layout & drawing
// Advance Wars framing: the screen splits on a diagonal, each side is a diorama of that unit's own terrain that
// slides in from its edge, with a header panel (portrait, level, a big HP counter, types, terrain defence stars).
// The whole scene, panels included, is drawn at one integer zoom so every pixel is the same size; layout values
// are computed in field space (L.f) and mirrored to screen space (L.panels / L.pos / L.top ...) for callers.
function duelZoom() { return VIEW.w >= 560 && VIEW.h >= 320 ? 2 : 1; }
function duelSpriteKind(num) { return animReady(num) ? 'anim' : bigReady(num) ? 'big' : null; }
// The camera pans toward the acting side (the world slides so it comes toward the middle); `zoom` sets how far.
// Panning keeps every pixel on the grid, which a zoom would not.
function duelCamTo(q, p, zoom) { if (!q.cam || REDUCED) return; const f = duelLayout(q).f, amt = Math.round((zoom - 1) * 60); if (f.stacked) { q.cam.tx = 0; q.cam.ty = Math.sign(f.Hf / 2 - p.y) * amt; } else { q.cam.tx = Math.sign(f.Wf / 2 - p.x) * amt; q.cam.ty = 0; } }
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
function clipPoly(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip(); }
// One combatant: pose (wind-up with its aura, lunge with after-images, cast), the hit reaction, a dodge, the faint (blink,
// then sink into the ground) and the victory hop. `sil` draws it as a flat silhouette for the impact frame.
function duelDrawUnit(q, u, L, t, sil = null) {
  const f = L.f, p = f.pos[u.id], v = q.view[u.id]; let dx = 0, dy = 0, sx = 1, sy = 1, tint = null, alpha = 1, breath = 0, speed = 1; const flip = p.dir === 1; const soft = REDUCED ? .3 : 1;
  const pose = q.pose && q.pose.unit === u ? q.pose : null; const ghosts = []; let aura = 0, sink = 0;
  if (pose) {
    const k = t - pose.t0, wd = pose.dur || DUEL_T.windup;
    if (pose.kind === 'windup') { const e = Math.min(1, k / wd); dx = -p.dir * 7 * easeOut(e) * soft; speed = 2.6; aura = e; if (pose.fam === 'contact') { sy = 1 - .1 * e; sx = 1 + .08 * e; } else { sy = 1 + .06 * e; sx = 1 - .04 * e; } if (Math.floor(k * 20) % 2 === 0 && e < .85) tint = shade(TYPE_COL[q.banner ? q.banner.move.type : 'Normal'] || '#ffffff', .3);
      if (pose.style === 'stomp') { dy -= Math.round(Math.sin(Math.min(1, e / .85) * Math.PI) * 26 * soft); if (e > .85) { sy = .82; sx = 1.14; } } // a hop, then it stamps the ground
      else if (pose.style === 'burrow') { sink = Math.round(easeIn(e) * 92); tint = null; } } // Dig: down into the ground
    else if (pose.kind === 'lunge' || pose.kind === 'rush') { const e = Math.min(1, k / pose.dur), reach = (f.stacked ? 28 : 48) * (pose.kind === 'rush' ? 1.45 : 1); if (e < 1) { dx = p.dir * lerp(-7, reach, easeIn(e)) * soft; sx = 1.1; sy = .94; speed = 2; if (e > .2) ghosts.push([dx - p.dir * 8, .35], [dx - p.dir * 17, .2], [dx - p.dir * 27, .1]); if (pose.kind === 'rush' && e > .2) ghosts.push([dx - p.dir * 38, .08]); } else dx = p.dir * lerp(reach, 0, easeOut(Math.min(1, (k - pose.dur) / .35))) * soft; }
    else if (pose.kind === 'leap') { const e = Math.min(1, k / pose.dur), reach = f.stacked ? 34 : 86; if (e < 1) { dx = p.dir * lerp(-7, reach, easeInOut(e)) * soft; dy -= Math.round(Math.sin(e * Math.PI) * 48 * soft); sx = .95; sy = 1.07; speed = 2; if (e > .3) ghosts.push([dx - p.dir * 10, .25]); } else { const r = Math.min(1, (k - pose.dur) / .4); dx = p.dir * lerp(reach, 0, easeInOut(r)) * soft; dy -= Math.round(Math.sin(r * Math.PI) * 14 * soft); if (r < .15) { sy = .84; sx = 1.12; } } } // Body Slam: up and onto the target
    else if (pose.kind === 'burrow') { const r = k < pose.dur + .12 ? 0 : Math.min(1, (k - pose.dur - .12) / .3); sink = Math.round((1 - easeOut(r)) * 92); if (r > 0 && r < 1) dy -= Math.round(Math.sin(r * Math.PI) * 8); } // under the ground, then back up
    else if (pose.kind === 'stomp') { const e = Math.min(1, k / .2); sy = 1 - .16 * (1 - e); sx = 1 + .12 * (1 - e); }
    else if (pose.kind === 'cast') { const e = Math.min(1, k / pose.dur); dx = p.dir * (e < 1 ? lerp(-7, 9, e) : lerp(9, 0, Math.min(1, (k - pose.dur) / .3))) * soft; if (e < 1) { sy = 1.05; sx = .97; speed = 2; } }
  }
  const hit = q.hitFx && q.hitFx.unit === u ? t - q.hitFx.t0 : -1;
  if (hit >= 0 && hit < .34) { const kb = q.hitFx.crit ? 18 : q.hitFx.lethal ? 16 : 11; dx += -p.dir * kb * (1 - easeOut(hit / .34)) * soft; if (hit < .16 && Math.floor(hit * 30) % 2 === 0) tint = '#ffffff'; speed = 0; sx *= 1 + (1 - hit / .34) * .06; sy *= 1 - (1 - hit / .34) * .05; }
  // how the move lands on it: jolted by electricity (flashing dark and bright), scorched, frozen still, flattened, rocked
  const react = hit >= 0 ? q.hitFx.react : null;
  if (react === 'shock' && hit < .45) { tint = Math.floor(hit * 22) % 2 ? '#fff7a0' : hit < .3 ? '#3a3200' : tint; speed = 0; dx += Math.round(Math.sin(hit * 90)) * soft; }
  else if (react === 'burn' && hit > .1 && hit < .42 && Math.floor(hit * 16) % 2) tint = '#ff8a40';
  else if (react === 'chill' && hit > .08 && hit < .55) { tint = hit < .45 || Math.floor(hit * 20) % 2 ? '#bde4f8' : null; speed = 0; }
  else if (react === 'crush' && hit < .36) { const kk = 1 - hit / .36; sy *= 1 - .16 * kk; sx *= 1 + .12 * kk; }
  else if (react === 'wobble' && hit < .5) dx += Math.round(Math.sin(hit * 46) * 4 * (1 - hit / .5)) * soft;
  // Psychic lifts its target while the power travels, and slams it down on the hit
  if (q.lift && q.lift.unit === u) { const lk = t - q.lift.t0; if (lk >= 0 && lk < q.lift.dur) { dy -= Math.round(easeOut(lk / q.lift.dur) * 22 * soft) + Math.round(Math.sin(lk * 30) * 1.5); speed = .3; if (Math.floor(lk * 20) % 3 === 0) tint = tint || '#ffb4da'; } else if (lk >= q.lift.dur && lk < q.lift.dur + .08) dy -= Math.round((1 - (lk - q.lift.dur) / .08) * 22 * soft); }
  const miss = q.missFx && q.missFx.unit === u ? t - q.missFx.t0 : -1;
  if (miss >= 0 && miss < .42) { const h = Math.sin(miss / .42 * Math.PI); dx += -p.dir * 16 * h * soft; dy -= 12 * h * soft; if (h > .2) ghosts.push([dx + p.dir * 8, .25], [dx + p.dir * 15, .12]); }
  const ko = q.koFx && q.koFx.unit === u ? t - q.koFx.t0 : -1;
  if (ko >= 0) { if (ko < .34) { tint = Math.floor(ko * 24) % 2 ? '#ffffff' : null; dx += Math.round(Math.sin(ko * 70) * 2) * soft; speed = 0; } else { const e = Math.min(1, (ko - .34) / .42); sink = Math.round(easeIn(e) * 90); speed = 0; if (e >= 1) return; } }
  const vic = q.victor && q.victor.unit === u ? t - q.victor.t0 : -1;
  if (vic >= 0 && vic < .7 && !REDUCED) { const h = Math.abs(Math.sin(vic / .35 * Math.PI)); dy -= Math.round(h * 10); sy *= 1 + h * .05; sx *= 1 - h * .04; }
  const idle = !pose && hit < 0 && ko < 0 && vic < 0;
  if (!REDUCED && idle) { if (v.fly) dy -= 3 + Math.round(Math.sin(BT.time * 3 + u.id) * 3); else breath = Math.sin(BT.time * 2.2 + u.id) > 0 ? 1 : 0; }
  // a swimmer floats with its lower body under the surface of a sea or a cave pool; everyone else casts a shadow
  const Sc = q.scenes && q.scenes[u.id], wl = Sc && Sc.fx.waterY != null && !v.fly ? Sc.fx.waterY + (REDUCED ? 0 : Math.round(Math.sin(BT.time * 2.4 + u.id))) : null;
  if (!sil && wl == null) { const shadowW = Math.round(28 * sx * (1 - Math.max(0, -dy) / 40) * (1 - sink / 90)); ctx.globalAlpha = .32 * alpha * (v.fly ? .7 : 1); ellipse(Math.round(p.x + dx), p.y + 1, Math.max(4, shadowW), 5, '#000000'); ctx.globalAlpha = 1; }
  // the charge aura: a pulsing disc of the move's colour behind a winding-up Pokémon
  if (aura > 0 && !sil && !REDUCED) { const col = TYPE_COL[q.banner ? q.banner.move.type : 'Normal'] || '#ffffff', r = Math.round(18 + aura * 14 + Math.sin(t * 40) * 2); ctx.globalAlpha = .22 * aura; circle(Math.round(p.x + dx), p.y - 36, r, col); ctx.globalAlpha = .35 * aura; circle(Math.round(p.x + dx), p.y - 36, Math.round(r * .55), shade(col, .5)); ctx.globalAlpha = 1; }
  if (!sil) (q.off || (q.off = {}))[u.id] = [dx, dy + sink]; // where it is drawn now, for effects riding it
  const num = v.num, kind = q.big ? q.big[u.id] : duelSpriteKind(num); const at = BT.time * (speed || 1e-6);
  const draw = (x, o) => { if (kind === 'anim') drawAnim(num, x, p.y + dy + sink, at, o); else if (kind === 'big') drawBig(num, x, p.y + dy + sink, Object.assign({ breath }, o)); else drawMon(num, x, p.y + dy + sink, Object.assign({}, o, { sx: 2 * (o.sx || 1), sy: 2 * (o.sy || 1) })); };
  const clipY = wl != null ? wl + 60 : sink > 0 ? p.y + 64 : null;
  if (clipY != null) { ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, f.Wf + 120, clipY); ctx.clip(); }
  if (!sil) for (const [gx, ga] of ghosts) draw(p.x + gx, { flip, tint: '#ffffff', alpha: ga * alpha, sx, sy });
  draw(p.x + dx, { flip, tint: sil || tint, alpha, sx, sy });
  if (clipY != null) ctx.restore();
  if (wl != null && !sil && sink < 30) { const X = Math.round(p.x + dx), k2 = REDUCED ? 0 : (BT.time * .7 + u.id * .3) % 1; ctx.globalAlpha = .9; ellipseRing(X, wl, 16, 3, 1, '#e8f6ff'); hline(X - 12, wl + 1, 25, '#5a9ad8'); if (!REDUCED) { ctx.globalAlpha = (1 - k2) * .7; ellipseRing(X, wl, Math.round(16 + k2 * 14), Math.round(3 + k2 * 3), 1, '#ffffff'); } ctx.globalAlpha = 1; }
}
// Header panel: portrait, name and level, HP counter and bar (with the ghost of the HP just lost draining after it),
// tags and types, terrain defence as stars. A hit shakes the panel of the Pokémon that took it.
function duelPanel(q, u, L, dy) {
  const f = L.f, P = f.panels[u.id], v = q.view[u.id], hp = duelHpAt(q.script, q.t, u.id), ghost = Math.max(hp, duelHpAt(q.script, q.t - .5, u.id)), t = q.terr[u.id], ko = q.koFx && q.koFx.unit === u && q.t - q.koFx.t0 > .3;
  const sh = q.shakePanel[u.id] != null && !REDUCED ? q.t - q.shakePanel[u.id] : 9, jx = sh < .3 ? Math.round(Math.sin(sh * 70) * 3 * (1 - sh / .3)) : 0, jy = sh < .3 ? Math.round(Math.cos(sh * 50) * 2 * (1 - sh / .3)) : 0;
  const x0 = P.x + jx, y0 = P.y + dy + jy, w = P.w, h = P.h, col = ko ? '#4a4a58' : teamColor(u.team), cd = ko ? '#24242c' : teamColorD(u.team), cl = ko ? '#70707e' : teamColorL(u.team), ink = '#0b0d16';
  // the plate, Advance Wars style: the side's colour from a lit top to a deep base, outlined, the edge toward the split
  // cut on the split's slant (content keeps clear of the cut)
  const slant = !f.stacked, inner = P.side < 0 ? 1 : -1, cutAt = j => slant ? Math.round((inner > 0 ? j : h - 1 - j) * .24) : 0;
  for (let j = 0; j < h; j++) { const c = cutAt(j), xs = x0 + (inner < 0 ? c : 0), xe = x0 + w - 1 - (inner > 0 ? c : 0);
    rect(xs, y0 + j, xe - xs + 1, 1, j === 0 || j === h - 1 ? ink : j === 1 ? cl : j === 2 ? mix(col, cl, .4) : j < h * .5 ? col : j < h * .56 && ((j + xs) & 1) ? col : cd);
    if (j > 0 && j < h - 1) { rect(xs, y0 + j, 1, 1, ink); rect(xe, y0 + j, 1, 1, ink); } }
  for (let i = 0; i < w; i += 6) { const c = cutAt(h - 3); if (i > c && i < w - c) rect(x0 + i, y0 + h - 3, 3, 1, shade(cd, .12)); } // a strip of lights along the base
  const lx = x0 + 6 + (inner < 0 ? 8 : 0), rx = x0 + w - 6 - (inner > 0 ? 8 : 0), y = y0 + 5;
  // portrait in a dark window, the team mark in its corner
  rect(lx - 1, y - 1, 28, 26, ink); ctx.save(); ctx.beginPath(); ctx.rect(lx, y, 26, 24); ctx.clip(); portraitBg(lx, y, 26, 24, u.team); ctx.drawImage(monIcon(v.num, u.team !== 0), lx + 1, y + 4, 24, 18); ctx.restore(); teamGlyph(lx + 2, y + 2, u.team, cl);
  const tx = lx + 31; let name = v.name; while (textWidth(name) > rx - tx - 24 && name.length > 3) name = name.slice(0, -1);
  text(name, tx, y, ko ? UI.dim : '#ffffff', { outline: ink }); textR('Lv' + v.level, rx, y, ko ? UI.dim : UI.gold, { outline: ink });
  // HP: a dark inset bar with the drained ghost, then the big counter
  const ratio = clamp(hp / v.maxHp, 0, 1), gRatio = clamp(ghost / v.maxHp, 0, 1); const hs = String(Math.max(0, hp)), hw = textWidth(hs, BIG) + textWidth('/' + v.maxHp) + 3, bw = rx - tx - hw - 4;
  rect(tx - 1, y + 10, bw + 2, 8, ink); bar(tx, y + 11, bw, 6, ratio, hpColor(ratio), '#1c1e2a', { notch: true });
  if (gRatio > ratio) { const fx0 = tx + 1 + Math.round(ratio * (bw - 2)), gw = Math.round(gRatio * (bw - 2)) - Math.round(ratio * (bw - 2)); rect(fx0, y + 12, gw, 4, sh < .12 ? '#ffffff' : '#ff9a8a'); hline(fx0, y + 12, gw, '#ffd8d0'); }
  const dropping = hp < ghost; bigText(hs, rx - hw, y + 9 + (dropping && !REDUCED ? Math.round(Math.sin(q.t * 40)) : 0), hp <= 0 ? '#ff6a6a' : dropping ? '#ffb0a0' : '#ffffff', { outline: ink }); textR('/' + v.maxHp, rx, y + 11, cl, { outline: ink });
  let bx = tx; bx += tagBadge(duelTeamTag(u), cd, bx, y + 20) + 3; v.types.forEach(tp => { typeBadge(tp, bx, y + 19, 24); bx += 26; }); if (v.status) { statusBadge(v.status, bx, y + 20); bx += 17; } if (v.brace) { miniBadge('BRC', BRACE_COL, bx, y + 20); bx += 17; } else if (v.root) { miniBadge('RT', ROOT_COL, bx, y + 20); bx += 17; }
  const stars = Math.min(4, Math.round(terrainDef(t, u) / 10)); const ds = (stars ? '★'.repeat(stars) : '-'); textR(ds, rx, y + 20, stars ? UI.gold : '#9aa0b8', { outline: ink }); textR('DEF', rx - textWidth(ds) - 2, y + 20, cl, { outline: ink });
}
// Manga focus lines: thin rays from beyond the screen edges toward the point, re-rolled a few times a second.
function duelFocusLines(q, W, H, t) {
  const Fl = q.lines; if (!Fl || t > Fl.until) return; const k = t < Fl.t0 + .08 ? (t - Fl.t0) / .08 : Math.min(1, (Fl.until - t) / .2); if (k <= 0) return;
  const R = mulberry32(Math.floor(t * 18) * 131 + 7), outer = Math.hypot(W, H), n = 34;
  ctx.globalAlpha = .55 * k; for (let i = 0; i < n; i++) { const a = (i + R() * .8) / n * Math.PI * 2, r1 = outer * (.34 + R() * .22), w = R() < .25 ? 2 : 1; pline(Fl.x + Math.cos(a) * outer, Fl.y + Math.sin(a) * outer * .7, Fl.x + Math.cos(a) * r1, Fl.y + Math.sin(a) * r1 * .7, Fl.col, w); } ctx.globalAlpha = 1;
}
// The seam between the two halves: a dark steel bar with a lit edge, as in the Advance Wars battle screen.
function duelSplit(f) { const [a, b] = f.split; pline(a[0] + 2, a[1], b[0] + 2, b[1], '#5a6078', 2); pline(a[0] - 2, a[1], b[0] - 2, b[1], '#2a2e40', 2); pline(a[0], a[1], b[0], b[1], '#0b0d16', 3); pline(a[0] + 1, a[1], b[0] + 1, b[1], '#9aa2c0', 1); }
// A starburst of rays (for the impact frame): crisp lines from the centre out.
function duelStar(x, y, r, col) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = i % 2 ? r : r * .55; pline(x, y, x + Math.cos(a) * rr, y + Math.sin(a) * rr, col, 3); } circle(Math.round(x), Math.round(y), Math.round(r * .22), col); }
// The KO stamp, in screen space over the fallen Pokémon's half (never under a panel or the banner): it slams in two
// sizes too big, lands on a dark plaque with a shockwave, holds, then fades before the outro.
function duelStamp(q, L, t) {
  const s = q.stamp; if (!s) return; const k = t - s.t0; if (k < 0 || k > s.dur) return;
  const f = L.f, W = f.Wf, p = f.pos[s.unit.id], sc = W >= 300 ? 3 : 2, tw = textWidth(s.text.toUpperCase(), BIG) * sc, th = 9 * sc;
  const x = Math.round(clamp(p.x, tw / 2 + 10, W - tw / 2 - 10)), y = Math.round(clamp(p.y - 58, f.top + th / 2 + 8, p.y - 24));
  const a = k > s.dur - .2 ? Math.max(0, (s.dur - k) / .2) : 1, land = REDUCED ? 1 : Math.min(1, k / .07);
  const pw = Math.round((tw + 26) * (REDUCED ? 1 : easeOut(Math.min(1, k / .12)))), ph = th + 10;
  ctx.globalAlpha = .72 * a; rect(x - (pw >> 1), y - (ph >> 1), pw, ph, '#070a14'); ctx.globalAlpha = a;
  if (pw > 4) { hline(x - (pw >> 1), y - (ph >> 1), pw, s.col); hline(x - (pw >> 1), y + (ph >> 1) - 1, pw, s.col); hline(x - (pw >> 1) + 2, y - (ph >> 1) + 2, pw - 4, shade(s.col, -.45)); hline(x - (pw >> 1) + 2, y + (ph >> 1) - 3, pw - 4, shade(s.col, -.45)); }
  const rk = (k - .06) / .3; if (!REDUCED && rk > 0 && rk < 1) { ctx.globalAlpha = a * (1 - rk); ellipseRing(x, y, Math.round(tw / 2 + 8 + rk * 34), Math.round(ph / 2 + 2 + rk * 14), 2, s.col); ctx.globalAlpha = a; }
  const s2 = sc + (land < .5 ? 2 : land < 1 ? 1 : 0), wob = REDUCED ? 0 : Math.round(Math.sin(k * 60) * 3 * Math.max(0, 1 - (k - .07) / .2) * (k > .07 ? 1 : 0));
  ctx.save(); ctx.translate(x + wob, y); ctx.scale(s2, s2); bigC(s.text, 0, -4.5, land < 1 ? '#ffffff' : s.col, { outline: s.ink }); ctx.restore();
  // a glint crosses the letters once they land
  const gx = (k - .2) / .3; if (!REDUCED && gx > 0 && gx < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x - tw / 2, y - th / 2, tw, th); ctx.clip(); ctx.globalAlpha = .55 * a; const sx = Math.round(x - tw / 2 - 8 + (tw + 16) * gx); for (let i = 0; i < th; i++) rect(sx - Math.round(i / 2), y - th / 2 + i, 4, 1, '#ffffff'); ctx.restore(); }
  ctx.globalAlpha = 1;
}
// Back on the board: a puff where each fainted Pokémon stood, so the map shows where the scene's KO happened.
function duelAftermath(q) {
  if (REDUCED) return;
  for (const e of q.events) if (e.type === 'ko') { const x = e.unit.x * TILE + TILE / 2, y = e.unit.y * TILE + TILE - 6; for (let i = 0; i < 5; i++) spawnSprite('poof', x + (i - 2) * 6, y - 2, { size: 5, life: .55, col: '#e8e0d0', col2: '#ffffff', vy: -14, vx: (i - 2) * 10, delay: .1 + i * .03 }); spawnParts(x, y - 8, 12, ['#ffffff', '#ffd24a', '#c0c0c0'], { speed: 60, life: .6, grav: 60, delay: .1 }); }
}
function drawDuel(q) {
  const L = duelLayout(q), f = L.f, t = q.t, W = f.Wf, H = f.Hf, z = L.z, S = q.script, outAt = S.total - S.outro;
  const kIn = REDUCED ? 1 : easeOut(clamp((t - .1) / .4, 0, 1)), kOut = REDUCED ? 1 : 1 - easeIn(clamp((t - outAt) / (S.outro - .05), 0, 1)), k = Math.min(kIn, kOut);
  ctx.save(); ctx.scale(z, z);
  rect(0, 0, W, H, '#070a14');
  // the camera pans (and the impact jolts and shakes) the whole field; the layers of each panorama follow at their own depth
  const c = q.cam || { x: 0, y: 0 }; const jolt = q.jolt && t - q.jolt.t0 < .25 && !REDUCED ? Math.round(Math.sin((t - q.jolt.t0) * 40) * q.jolt.n * (1 - (t - q.jolt.t0) / .25)) * q.jolt.dir : 0;
  const cam = { x: Math.round(c.x + FX.shakeX + jolt), y: Math.round(c.y + FX.shakeY) };
  const off = u => { const e = f.entry[u.id], o = (1 - k) * (e[0] ? W * .6 : H * .5); return [Math.round(e[0] * o), Math.round(e[1] * o)]; };
  const inRegion = (u, fn) => { const [dx, dy] = off(u); ctx.save(); clipPoly(f.region[u.id].map(pt => [pt[0] + dx, pt[1] + dy])); ctx.translate(dx, dy); fn(); ctx.restore(); };
  for (const u of [q.sides.left, q.sides.right]) inRegion(u, () => drawScenery(q, u, L, cam, t)); // each side: its own panorama, sliding in from its edge
  duelSplit(f);
  if (q.focus && !REDUCED) { const fo = q.focus, kf = t < fo.t0 + .15 ? (t - fo.t0) / .15 : t > fo.until - .25 ? Math.max(0, (fo.until - t) / .25) : 1; if (kf > 0) { ctx.globalAlpha = (fo.a || .34) * kf; rect(-40, -40, W + 80, H + 80, fo.col || '#050815'); ctx.globalAlpha = 1; } } // heavy moves darken (or whiten) the field more
  duelFocusLines(q, W, H, t);
  const order = [q.sides.right, q.sides.left]; if (q.pose && q.pose.unit === q.sides.right) order.reverse();
  ctx.save(); ctx.translate(cam.x, cam.y); for (const u of order) { const [dx, dy] = off(u); ctx.save(); ctx.translate(dx, dy); duelDrawUnit(q, u, L, t); ctx.restore(); } ctx.restore();
  for (const u of [q.sides.left, q.sides.right]) inRegion(u, () => drawSceneryFront(q, u, L, cam, t));
  drawWeather(weatherKind(), W, H, t); // the weather falls across both halves
  ctx.save(); ctx.translate(cam.x, cam.y);
  drawFX(0, 0, false);
  // the impact frame: for a few frames the field turns bright and both fighters become flat ink silhouettes
  if (q.flash && t - q.flash.t0 < q.flash.dur) { rect(-60, -60, W + 120, H + 120, q.flash.col); for (const u of order) duelDrawUnit(q, u, L, t, '#0c0a1c'); duelStar(q.flash.x, q.flash.y, 26, '#0c0a1c'); }
  drawFXTexts(0, 0); ctx.restore();
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, W, H, FX.flashCol); ctx.globalAlpha = 1; }
  for (const u of [q.sides.left, q.sides.right]) { const P = f.panels[u.id]; const fromTop = P.y < H / 2; duelPanel(q, u, L, Math.round((1 - k) * (fromTop ? -(P.h + 8) : P.h + 8))); }
  duelStamp(q, L, t);
  // VS: slams onto the split as the two halves meet, then fades
  if (!REDUCED && t > .28 && t < .82) { const kv = t - .28, [a, b] = f.split, vx = Math.round((a[0] + b[0]) / 2), vy = Math.round((f.pos[q.sides.left.id].y + f.pos[q.sides.right.id].y) / 2 - 60), s2 = (W >= 300 ? 3 : 2) + (kv < .06 ? 2 : kv < .12 ? 1 : 0); ctx.globalAlpha = kv > .42 ? Math.max(0, 1 - (kv - .42) / .12) : 1; if (kv < .1) { ctx.globalAlpha *= .5; circle(vx, vy, 30 - Math.round(kv * 100), '#ffffff'); ctx.globalAlpha = kv > .42 ? Math.max(0, 1 - (kv - .42) / .12) : 1; } ctx.save(); ctx.translate(vx, vy); ctx.scale(s2, s2); bigC('VS', 0, -4.5, UI.gold, { outline: UI.goldDark }); ctx.restore(); ctx.globalAlpha = 1; }
  const b = q.banner;
  if (b && t < b.until) {
    const kb = Math.min(1, (t - b.t0) / .12), name = mvName(b.move).toUpperCase(), col = TYPE_COL[b.move.type] || UI.ink; const w = textWidth(name, BIG) + 44, x = Math.round(W / 2 - w / 2), y = Math.round(f.bannerY - (1 - easeOutBack(kb, 2)) * 10);
    rrect(x + 1, y + 2, w, 17, UI.shadow, 2); rrect(x, y, w, 17, UI.inset, 2); rrect(x + 1, y + 1, w - 2, 15, '#101a30', 1); hline(x + 2, y + 1, w - 4, shade(col, -.2)); hline(x + 2, y + 15, w - 4, shade(col, -.5)); rect(x + 1, y + 2, 2, 13, col);
    typeBadge(b.move.type, x + 7, y + 4, 24); bigText(name, x + 35, y + 4, col, { outline: '#000' });
    // a shine sweeps across the banner as it lands
    const sw = (t - b.t0 - .05) / .35; if (!REDUCED && sw > 0 && sw < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, 13); ctx.clip(); ctx.globalAlpha = .45; const sx = x + Math.round((w + 10) * sw) - 6; rect(sx, y + 2, 3, 13, '#ffffff'); rect(sx + 5, y + 2, 1, 13, '#ffffff'); ctx.restore(); ctx.globalAlpha = 1; }
    const tag = b.counter ? 'COUNTER!' : b.follow ? 'FOLLOW-UP!' : null; if (tag) { const cw = textWidth(tag) + 10, tb = Math.min(1, (t - b.t0) / .1), ty = y - 11 - Math.round((1 - easeOutBack(tb, 3)) * 6); rrect(Math.round(W / 2 - cw / 2), ty, cw, 10, b.counter ? UI.red : '#d8991f', 1); textC(tag, W / 2, ty + 1, '#ffffff'); }
  }
  if (k >= .99) hintLine(q.boost ? (VIEW.touch ? ['tap again: skip'] : [['X', 'skip']]) : (VIEW.touch ? ['tap: faster', 'tap twice: skip'] : [['any key', 'faster'], ['X', 'skip']]), W / 2, f.hintY);
  ctx.restore();
}
// Battle-transition stripes (Pokémon style): bands slide in from alternating sides to cover the screen (k 0 → 1).
function duelStripes(k, W, H) {
  const n = 10, bh = Math.ceil(H / n);
  for (let i = 0; i < n; i++) { const w = Math.round(W * clamp(k * 1.5 - i * .05, 0, 1)); if (w <= 0) continue; const y = i * bh, x = i % 2 ? W - w : 0; rect(x, y, w, bh, '#070a14'); rect(i % 2 ? x : x + w - 2, y, 2, bh, '#3a3a64'); }
}
// Where the board meets the scene: the stripes close over the board, the scene plays, and after it the stripes open
// again over the board (drawn by the board through DUEL_WIPE).
const DUEL_WIPE = { t0: -9 };
function drawDuelFrame(q) {
  const S = q.script, W = VIEW.w, H = VIEW.h, t = q.t, dip = .14;
  if (t < dip && !REDUCED) { drawBoard(); duelStripes(t / dip, W, H); return; }
  drawDuel(q);
  if (t < dip + .14 && !REDUCED) duelStripes(1 - (t - dip) / .14, W, H);
  if (t > S.total - .12 && !REDUCED) duelStripes((t - (S.total - .12)) / .12, W, H);
}
// Called by the board after a duel: the stripes open over the map again.
function drawDuelWipeOut() { const k = (BT.time - DUEL_WIPE.t0) / .16; if (k < 0 || k >= 1 || REDUCED) return; duelStripes(1 - k, VIEW.w, VIEW.h); }
