// ============================================================================
// model.js — battle state, map parsing, pathfinding, ranges, combat maths,
// status effects, capture, objectives, enemy AI. No drawing here.
// ============================================================================
'use strict';
let B = null; // current battle
const key = (x, y) => x + ',' + y;
function hostile(a, b) { if (a === b) return false; if ((a === 0 && b === 3) || (a === 3 && b === 0)) return false; return true; }
function parseMap(def) {
  const rows = def.rows.map(r => r.replace(/\s+$/, '')); const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const tiles = []; for (let y = 0; y < h; y++) { tiles.push([]); for (let x = 0; x < w; x++) { const ch = rows[y][x] || '.'; tiles[y].push(TERRAIN[ch] || TERRAIN['.']); } }
  const variants = []; const vr = mulberry32((def.seed || 1) * 7919); for (let y = 0; y < h; y++) { variants.push([]); for (let x = 0; x < w; x++) variants[y].push(Math.floor(vr() * VARIANTS)); }
  return { w, h, tiles, variants, name: def.name || 'Map', objective: def.objective || { type: 'rout' }, deploy: def.deploy || [], deploy2: def.deploy2 || [], items: (def.items || []).map(i => Object.assign({}, i)), seize: def.seize || null, turnLimit: def.turnLimit || 0, reinforce: def.reinforce || [], music: def.music || 'player' };
}
function inMap(x, y) { return x >= 0 && y >= 0 && x < B.map.w && y < B.map.h; }
function terrAt(x, y) { return inMap(x, y) ? B.map.tiles[y][x] : TERRAIN['^']; }
function unitAt(x, y) { for (const u of B.units) if (u.hp > 0 && u.x === x && u.y === y) return u; return null; }
function alive(team) { return B.units.filter(u => u.hp > 0 && u.team === team); }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function effMov(u) { let m = u.mov; if (u.status === 'par') m = Math.max(1, m - 2); return m; }
// Dijkstra movement: returns Map key→{x,y,cost,prev}. Passing through friends allowed; ending on anyone not allowed.
function reachable(u, fromX = u.x, fromY = u.y, mov = effMov(u)) {
  const out = new Map(); const open = [{ x: fromX, y: fromY, cost: 0, prev: null }]; out.set(key(fromX, fromY), open[0]);
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost); const c = open.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy; if (!inMap(nx, ny)) continue;
      const t = terrAt(nx, ny); const mc = moveCost(t, u); if (mc >= 99) continue;
      const occ = unitAt(nx, ny); if (occ && hostile(occ.team, u.team)) continue;
      const nc = c.cost + mc; if (nc > mov) continue;
      const k = key(nx, ny); const ex = out.get(k); if (ex && ex.cost <= nc) continue;
      const node = { x: nx, y: ny, cost: nc, prev: c }; out.set(k, node); open.push(node);
    }
  }
  return out;
}
function canStand(u, x, y) { const o = unitAt(x, y); return !o || o === u; }
function pathTo(reach, x, y) { let n = reach.get(key(x, y)); if (!n) return null; const p = []; while (n) { p.unshift({ x: n.x, y: n.y }); n = n.prev; } return p; }
// Cells within Manhattan [min,max] of (x,y)
function ring(x, y, min, max) { const out = []; for (let dy = -max; dy <= max; dy++) for (let dx = -max; dx <= max; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d >= min && d <= max && inMap(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy }); } return out; }
function targetsFrom(u, x, y) { const out = []; for (const v of B.units) { if (v.hp <= 0 || !hostile(u.team, v.team)) continue; const d = Math.abs(v.x - x) + Math.abs(v.y - y); if (u.moves.some(m => d >= m.rng[0] && d <= m.rng[1])) out.push(v); } return out; }
function attackCells(u, reach) { const set = new Set(), out = []; for (const n of reach.values()) { if (!canStand(u, n.x, n.y)) continue; for (const c of ring(n.x, n.y, u.rngMin, u.rngMax)) { const k = key(c.x, c.y); if (!set.has(k) && !reach.has(k)) { set.add(k); out.push(c); } } } return out; }
// Cells every hostile unit could hit on its next phase, split by who threatens them: trainer teams
// (enemy or rival trainer) and wild Pokémon. A unit that must recharge skips its next phase, so it
// threatens nothing; frozen and paralyzed units may recover, so they stay in.
function dangerZones(team) {
  const zones = { trainer: new Set(), wild: new Set() };
  for (const e of B.units) {
    if (e.hp <= 0 || !hostile(e.team, team) || e.recharge) continue;
    const set = e.team === 2 ? zones.wild : zones.trainer; const r = reachable(e);
    for (const n of r.values()) { if (unitAt(n.x, n.y) && unitAt(n.x, n.y) !== e) continue; for (const c of ring(n.x, n.y, e.rngMin, e.rngMax)) set.add(key(c.x, c.y)); }
  }
  return zones;
}
function dangerZone(team) { const z = dangerZones(team); return new Set([...z.trainer, ...z.wild]); }

// ---------------------------------------------------------------- combat maths
function attackStat(u, move) { let a = move.kind === 'P' ? u.atk : u.spa; if (u.status === 'brn' && move.kind === 'P') a = Math.floor(a / 2); return a; }
function defenseStat(u, move) { return move.kind === 'P' ? u.def : u.spd; }
function usableMoves(att, d) { return att.moves.filter(m => d >= m.rng[0] && d <= m.rng[1]); }
function calcHit(att, def, move, defTerr) { const eva = terrainEva(defTerr, def); const spdDiff = clamp((att.spe - def.spe) / 2, -15, 15); return clamp(Math.round(move.acc - eva + spdDiff), 20, 100); }
function calcCrit(att, def, move) { let c = 4 + Math.max(0, Math.floor((att.spe - def.spe) / 4)); if (move.eff && move.eff.crit) c += 20; if (def.status === 'frz') c = 100; return clamp(c, 0, 100); }
function calcDmg(att, def, move, defTerr, crit = false) {
  const eff = effMult(move.type, def.types); if (eff === 0) return 0;
  const A = attackStat(att, move), D = Math.max(1, defenseStat(def, move));
  let d = Math.floor((Math.floor(2 * att.level / 5 + 2) * move.pow * A / D) / 50) + 2;
  if (att.types.includes(move.type)) d = Math.floor(d * 1.25);
  d = Math.floor(d * eff);
  d = Math.floor(d * (1 - terrainDef(defTerr, def) / 100));
  if (crit) d = Math.floor(d * 1.5);
  return Math.max(eff > 0 ? 1 : 0, d);
}
function doubles(att, def) { return att.status !== 'par' && att.spe >= def.spe + 8; }
// Hyper Beam needs a charge: it cannot be fired as a counter, and a unit that fired it cannot counter until it has recharged.
function needsRecharge(move) { return !!(move.eff && move.eff.recharge); }
function counterBlock(def) { return def.status === 'frz' ? 'frozen' : def.recharge ? 'recharging' : null; }
function bestMove(att, def, d, terr, asCounter = false) { let best = null, bd = -1; for (const m of usableMoves(att, d)) { if (asCounter && needsRecharge(m)) continue; const v = calcDmg(att, def, m, terr) * calcHit(att, def, m, terr) / 100; if (v > bd) { bd = v; best = m; } } return best; }
// Short labels for a move's chance-based or lasting effects, for forecasts and help.
function moveEffects(move) { const e = move.eff, out = []; if (!e) return out; if (e.status) out.push(e.chance + '% ' + STATUS[e.status].name); if (e.drain) out.push('drains ' + Math.round(e.drain * 100) + '%'); if (e.crit) out.push('high crit'); if (e.recharge) out.push('must recharge'); return out; }
// Forecast the whole exchange with the attacker standing at `from`. Deterministic and side-effect
// free: no dice, no unit mutation. The strike order is exactly the one resolveCombat walks, so the
// preview cannot promise a counter or a double that the resolver would skip.
//   a, c       attacker / counter sides {unit, move, dmg, hit, crit, dbl, eff}; c is null when no counter is possible
//   strikes    ordered [{side:'a'|'c', unit, move, dmg, hit, crit, eff, drain, nominal, cond}]
//              nominal: happens when every earlier strike lands; cond: why it would not
//   hpA, hpD   HP after the nominal exchange (every strike lands, no crits, no status procs)
//   noCounter  'range' | 'frozen' | 'recharging' | null
function forecast(att, def, move, from) {
  const d = Math.abs(def.x - from.x) + Math.abs(def.y - from.y);
  const aT = terrAt(from.x, from.y), dT = terrAt(def.x, def.y);
  const side = (A, Dn, m, terr) => ({ unit: A, move: m, dmg: calcDmg(A, Dn, m, terr), hit: calcHit(A, Dn, m, terr), crit: calcCrit(A, Dn, m), dbl: doubles(A, Dn), eff: effMult(m.type, Dn.types) });
  const a = side(att, def, move, dT);
  const block = counterBlock(def); const cm = block ? null : bestMove(def, att, d, aT, true);
  const c = cm ? side(def, att, cm, aT) : null;
  const order = [a]; if (c) order.push(c); if (a.dbl) order.push(a); else if (c && c.dbl) order.push(c);
  let hpA = att.hp, hpD = def.hp; const strikes = [];
  for (const s of order) {
    const isA = s === a; const strikerHp = isA ? hpA : hpD, targetHp = isA ? hpD : hpA; const nominal = strikerHp > 0 && targetHp > 0;
    const e = { side: isA ? 'a' : 'c', unit: s.unit, move: s.move, dmg: s.dmg, hit: s.hit, crit: s.crit, eff: s.eff, drain: 0, nominal, cond: null };
    if (nominal) {
      const dr = s.move.eff && s.move.eff.drain && s.dmg > 0 ? Math.max(1, Math.floor(s.dmg * s.move.eff.drain)) : 0; e.drain = dr;
      if (isA) { hpD = Math.max(0, hpD - s.dmg); hpA = Math.min(att.maxHp, hpA + dr); } else { hpA = Math.max(0, hpA - s.dmg); hpD = Math.min(def.maxHp, hpD + dr); }
    } else e.cond = 'only if ' + (strikerHp <= 0 ? s.unit : isA ? def : att).name + ' survives';
    strikes.push(e);
  }
  return { a, c, d, strikes, hpA, hpD, koA: hpA <= 0, koD: hpD <= 0, noCounter: c ? null : (block || 'range'), recharge: needsRecharge(move) };
}
// Resolve a full exchange by rolling the forecast's strikes in order. Mutates units; returns an event list for the animation layer.
function resolveCombat(att, def, move, from) {
  const fc = forecast(att, def, move, from); const ev = [];
  for (const s of fc.strikes) {
    const A = s.unit, Dn = s.side === 'a' ? def : att, isCounter = s.side === 'c'; if (A.hp <= 0 || Dn.hp <= 0) continue;
    const hit = rnd() * 100 < s.hit;
    if (!hit) { ev.push({ type: 'miss', att: A, def: Dn, move: s.move, counter: isCounter }); continue; }
    const crit = rnd() * 100 < s.crit; const dmg = calcDmg(A, Dn, s.move, terrAt(Dn.x, Dn.y), crit);
    Dn.hp = Math.max(0, Dn.hp - dmg); let status = null;
    const ef = s.move.eff;
    if (ef && ef.status && !Dn.status && Dn.hp > 0 && rnd() * 100 < ef.chance) { const st = ef.status; if (!(st === 'brn' && Dn.types.includes('Fire')) && !(st === 'psn' && (Dn.types.includes('Poison') || Dn.types.includes('Steel'))) && !(st === 'par' && Dn.types.includes('Electric')) && !(st === 'frz' && Dn.types.includes('Ice'))) { Dn.status = st; Dn.statusTurns = 0; status = st; } }
    let drain = 0; if (ef && ef.drain && dmg > 0) { drain = Math.max(1, Math.floor(dmg * ef.drain)); A.hp = Math.min(A.maxHp, A.hp + drain); }
    ev.push({ type: 'hit', att: A, def: Dn, move: s.move, dmg, crit, eff: s.eff, hpAfter: Dn.hp, status, drain, attHpAfter: A.hp, counter: isCounter });
    if (Dn.hp <= 0) ev.push({ type: 'ko', unit: Dn, by: A });
    if (Dn.status === 'frz' && dmg > 0 && s.move.type === 'Fire') { Dn.status = null; ev.push({ type: 'thaw', unit: Dn }); }
  }
  // firing a recharge move costs the next turn whether it hit or missed
  if (fc.recharge && att.hp > 0) { att.recharge = 1; ev.push({ type: 'recharge', unit: att }); }
  // experience for player-team survivors
  for (const [u, o] of [[att, def], [def, att]]) { if (!isHuman(u.team) || u.hp <= 0) continue; const took = ev.some(e => e.type === 'hit' && e.att === u); if (!took) continue; awardXp(u, xpGain(u, o, o.hp <= 0), ev); }
  return ev;
}
function awardXp(u, amount, ev) {
  if (u.level >= 50) return; u.xp += amount; ev.push({ type: 'xp', unit: u, amount });
  while (u.xp >= xpToNext() && u.level < 50) { u.xp -= xpToNext(); const gains = levelUp(u); ev.push({ type: 'levelup', unit: u, gains, level: u.level }); const evo = evolutionFor(u); if (evo) { const from = u.dex; ev.push({ type: 'evolve', unit: u, from, to: evo }); evolve(u, evo); } }
}
// Start-of-phase upkeep for one team: recharge, status damage, terrain heals and cures, thaw checks.
// Returns events. Runs exactly once per phase; a resumed suspend save skips it (see beginPhase).
function upkeep(team) {
  const ev = [];
  for (const u of alive(team)) {
    u.acted = false; u.moved = false;
    if (u.recharge) { u.recharge = 0; u.acted = true; u.moved = true; ev.push({ type: 'recharge', unit: u, done: true }); }
    const t = terrAt(u.x, u.y);
    if (t.heal) {
      if (u.hp < u.maxHp) { const h = Math.max(1, Math.floor(u.maxHp * t.heal)); u.hp = Math.min(u.maxHp, u.hp + h); ev.push({ type: 'heal', unit: u, amount: h }); }
      if (u.status) { ev.push({ type: 'cure', unit: u }); u.status = null; }
    }
    if (t.burn && !u.fly && !u.types.includes('Fire')) { const d = Math.max(1, Math.floor(u.maxHp / 6)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'lava' }); }
    if (u.status === 'psn') { const d = Math.max(1, Math.floor(u.maxHp / 8)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'psn' }); }
    if (u.status === 'brn') { const d = Math.max(1, Math.floor(u.maxHp / 16)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'brn' }); }
    if (u.status === 'frz') { u.statusTurns++; if (u.statusTurns >= 2 || rnd() < .4) { u.status = null; ev.push({ type: 'cure', unit: u, kind: 'frz' }); } }
    if (u.status === 'par') { u.statusTurns++; if (u.statusTurns >= 3) { u.status = null; ev.push({ type: 'cure', unit: u, kind: 'par' }); } }
  }
  return ev;
}
// Capture attempt. Returns {ok, shakes}
function tryCapture(target, ball) {
  if (target.team !== 2) return { ok: false, shakes: 0, refused: true };
  let p = .22 + .68 * (1 - target.hp / target.maxHp); p *= ball.rate; if (target.status) p *= 1.3; if (target.boss) p *= .5; p = clamp(p, .05, .97);
  const ok = rnd() < p; const shakes = ok ? 3 : Math.floor(rnd() * 3);
  return { ok, shakes, p };
}
function useItem(u, item) {
  const it = ITEMS[item]; const ev = [];
  if (it.kind === 'heal') { if (it.heal) { const h = Math.max(1, Math.floor(u.maxHp * it.heal)); const before = u.hp; u.hp = Math.min(u.maxHp, u.hp + h); ev.push({ type: 'heal', unit: u, amount: u.hp - before }); } if (it.cure && u.status) { u.status = null; ev.push({ type: 'cure', unit: u }); } }
  if (it.kind === 'candy') { const gains = levelUp(u); ev.push({ type: 'levelup', unit: u, gains, level: u.level }); const evo = evolutionFor(u); if (evo) { const from = u.dex; ev.push({ type: 'evolve', unit: u, from, to: evo }); evolve(u, evo); } }
  return ev;
}
function checkObjective() {
  const o = B.map.objective; if (B.result) return B.result;
  if (B.versus) { const a = alive(0).length, b = alive(1).length; if (!a && !b) return B.result = 'draw'; if (!a) return B.result = 'p2'; if (!b) return B.result = 'p1'; if (B.map.turnLimit && B.turn > B.map.turnLimit) return B.result = a > b ? 'p1' : b > a ? 'p2' : 'draw'; return null; }
  if (!alive(0).length) return B.result = 'lose';
  if (o.type === 'rout' && !alive(1).length) return B.result = 'win';
  if (o.type === 'boss' && !B.units.some(u => u.boss && u.hp > 0 && u.team === 1)) return B.result = 'win';
  if (o.type === 'survive' && B.turn > o.turns) return B.result = 'win';
  if (o.type === 'seize' && B.seized) return B.result = 'win';
  if (B.map.turnLimit && o.type !== 'survive' && B.turn > B.map.turnLimit) return B.result = 'lose';
  return null;
}
function objectiveText() { const o = B.map.objective; switch (o.type) { case 'rout': return 'Defeat all enemies'; case 'boss': return 'Defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Survive ' + o.turns + ' turns'; case 'seize': return 'Seize the ' + (o.what || 'gym'); case 'versus': return 'Beat the other team'; } return ''; }

// ---------------------------------------------------------------- AI
// BFS distance field over terrain the unit can enter (ignores units) from a set of goal cells.
function distField(u, goals) {
  const d = new Map(); const q = []; for (const g of goals) { d.set(key(g.x, g.y), 0); q.push(g); }
  while (q.length) { const c = q.shift(); const cd = d.get(key(c.x, c.y)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.x + dx, ny = c.y + dy; if (!inMap(nx, ny)) continue; if (moveCost(terrAt(nx, ny), u) >= 99) continue; const k = key(nx, ny); if (d.has(k)) continue; d.set(k, cd + 1); q.push({ x: nx, y: ny }); } }
  return d;
}
function aiTargetsOf(u) { return B.units.filter(v => v.hp > 0 && hostile(u.team, v.team) && !(u.team === 2 && v.team === 2)); }
// Decide an action: {x,y,target,move} to attack, {x,y} to move, or null to wait.
function aiDecide(u, cautious = false) {
  const reach = reachable(u); const targets = aiTargetsOf(u); if (!targets.length) return null;
  const provoked = u.ai === 'aggro' || u.provoked || targets.some(t => dist(t, u) <= (u.ai === 'guard' ? Math.max(u.rngMax, 1) : 2));
  let best = null, bestScore = -1e9;
  for (const n of reach.values()) {
    if (!canStand(u, n.x, n.y)) continue;
    if (u.ai !== 'aggro' && !u.provoked && !(n.x === u.x && n.y === u.y) && u.ai === 'guard') continue; // guards never move
    const aT = terrAt(n.x, n.y);
    for (const t of targets) {
      const d = Math.abs(t.x - n.x) + Math.abs(t.y - n.y); const tT = terrAt(t.x, t.y); let mv = bestMove(u, t, d, tT); if (!mv) continue;
      // a recharge move is only worth its lost turn when it finishes the target
      if (needsRecharge(mv) && calcDmg(u, t, mv, tT) < t.hp) { const alt = bestMove(u, t, d, tT, true); if (alt) mv = alt; }
      const fc = forecast(u, t, mv, n); const hits = side => fc.strikes.filter(x => x.side === side && x.nominal).length;
      let s = fc.a.dmg * fc.a.hit / 100 * (hits('a') > 1 ? 1.8 : 1);
      if (fc.koD) s += 45 + t.level; else if (fc.recharge) s -= 15 + u.level * .5; // the lost turn and the open flank

      if (fc.c && hits('c')) { const cd = fc.c.dmg * fc.c.hit / 100 * (hits('c') > 1 ? 1.8 : 1); s -= cd * .7; if (fc.koA) s -= 60; }
      s += terrainDef(aT, u) * .4 + terrainEva(aT, u) * .2; s += (1 - t.hp / t.maxHp) * 12; if (t.team === 0 && t.leader) s += 6;
      if (t.team === 2 && u.team === 1) s -= 15; // trainers prefer trainers
      if (n.x === u.x && n.y === u.y) s += 1.5;
      if (s > bestScore) { bestScore = s; best = { x: n.x, y: n.y, target: t, move: mv }; }
    }
  }
  if (best && cautious && bestScore <= 0) best = null;
  if (best && (u.ai !== 'boss' || provoked || bestScore > 0)) { return best; }
  if (!provoked) return null;
  if (u.ai === 'guard' || u.ai === 'stay') return null;
  // advance toward the nearest target (BFS over passable terrain), keeping to defensive tiles when tied
  const goals = []; for (const t of targets) for (const c of ring(t.x, t.y, 1, 1)) goals.push(c);
  const field = distField(u, goals); let mc = null, md = 1e9;
  for (const n of reach.values()) { if (!canStand(u, n.x, n.y)) continue; const dd = field.get(key(n.x, n.y)); if (dd == null) continue; const score = dd * 10 - terrainDef(terrAt(n.x, n.y), u) * .1 + (n.x === u.x && n.y === u.y ? .5 : 0); if (score < md) { md = score; mc = n; } }
  if (u.team === 2) { // wild things only wander if a target is near
    const near = targets.some(t => dist(t, u) <= u.mov + u.rngMax + 2); if (!near) { if (rnd() < .5) return null; const opts = [...reach.values()].filter(n => canStand(u, n.x, n.y) && dist(n, u) <= 2); const c = pick(opts); return c ? { x: c.x, y: c.y } : null; }
  }
  if (!mc || (mc.x === u.x && mc.y === u.y)) return null;
  return { x: mc.x, y: mc.y };
}
