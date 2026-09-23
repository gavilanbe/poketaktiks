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
  return { w, h, tiles, variants, name: def.name || 'Map', objective: def.objective || { type: 'rout' }, deploy: def.deploy || [], deploy2: def.deploy2 || [], items: (def.items || []).map(i => ({ x: i.x, y: i.y, item: 'pokeball' })), seize: def.seize || null, turnLimit: def.turnLimit || 0, reinforce: def.reinforce || [], music: def.music || 'player', flags: def.flags || null, hill: def.hill || null, fog: !!def.fog };
}
function inMap(x, y) { return x >= 0 && y >= 0 && x < B.map.w && y < B.map.h; }
function terrAt(x, y) { return inMap(x, y) ? B.map.tiles[y][x] : TERRAIN['^']; }
function unitAt(x, y) { for (const u of B.units) if (u.hp > 0 && u.x === x && u.y === y) return u; return null; }
function alive(team) { return B.units.filter(u => u.hp > 0 && u.team === team); }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
// Paralysis cuts two tiles (never below one); a rooted unit cannot move at all.
function effMov(u, status = u.status, root = u.root) { if (root > 0) return 0; let m = u.mov; if (status === 'par') m = Math.max(1, m - 2); return m; }
// Dijkstra movement: returns Map key→{x,y,cost,prev}. Passing through friends allowed; ending on anyone not allowed.
function reachable(u, fromX = u.x, fromY = u.y, mov = effMov(u), opt = {}) {
  const out = new Map(); const open = [{ x: fromX, y: fromY, cost: 0, prev: null }]; out.set(key(fromX, fromY), open[0]);
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost); const c = open.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy; if (!inMap(nx, ny)) continue;
      const t = terrAt(nx, ny); const mc = moveCost(t, u); if (mc >= 99) continue;
      const occ = unitAt(nx, ny); if (occ && hostile(occ.team, u.team) && !(opt.through && opt.through(occ))) continue; // fog: hidden foes do not block planning
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
// The status a unit will have after the guaranteed parts of its next upkeep (center cure, paralysis
// and freeze timers), with no dice and no mutation. Mirrors the cure rules in upkeep().
function statusAfterUpkeep(u) {
  if (!u.status || terrAt(u.x, u.y).heal && territoryHeals(u)) return null;
  if (u.status === 'par' && u.statusTurns + 1 >= 3) return null;
  if (u.status === 'frz' && u.statusTurns + 1 >= 2) return null;
  return u.status;
}
// Root counts down one at each of the rooted unit's upkeeps (it is applied at 2, so the unit spends exactly one
// phase held); a Poké Center clears it outright. Mirrors upkeep(), no mutation.
function rootAfterUpkeep(u) { if (!u.root || terrAt(u.x, u.y).heal && territoryHeals(u)) return 0; return Math.max(0, u.root - 1); }
// Cells every hostile unit could hit on its next phase, split by who threatens them: trainer teams
// (enemy or rival trainer) and wild Pokémon. A unit that must recharge skips its next phase, so it
// threatens nothing; a unit whose upkeep is sure to cure it moves at full speed; frozen units that
// may thaw stay in.
function dangerZones(team, vis = null) {
  const zones = { trainer: new Set(), wild: new Set() };
  for (const e of B.units) {
    if (e.hp <= 0 || !hostile(e.team, team) || e.recharge) continue; if (vis && !vis.has(key(e.x, e.y))) continue; // fog: unseen foes are not on the map yet
    const set = e.team === 2 ? zones.wild : zones.trainer; const r = reachable(e, e.x, e.y, effMov(e, statusAfterUpkeep(e), rootAfterUpkeep(e)));
    for (const n of r.values()) { if (unitAt(n.x, n.y) && unitAt(n.x, n.y) !== e) continue; for (const c of ring(n.x, n.y, e.rngMin, e.rngMax)) set.add(key(c.x, c.y)); }
  }
  return zones;
}
function dangerZone(team) { const z = dangerZones(team); return new Set([...z.trainer, ...z.wild]); }

// ---------------------------------------------------------------- combat maths
function attackStat(u, move) { let a = move.kind === 'P' ? u.atk : u.spa; if (u.status === 'brn' && move.kind === 'P') a = Math.floor(a / 2); return a; }
function defenseStat(u, move) { return move.kind === 'P' ? u.def : u.spd; }
function usableMoves(att, d) { return att.moves.filter(m => d >= m.rng[0] && d <= m.rng[1]); }
// Speed nudges accuracy a little (±10 at most). It no longer feeds the critical chance.
function calcHit(att, def, move, defTerr) { const eva = terrainEva(defTerr, def); const spdDiff = clamp(Math.round((att.spe - def.spe) / 3), -10, 10); return clamp(Math.round(move.acc - eva + spdDiff), 20, 100); }
// Critical hits: a flat CRIT_BASE, +20 for high-crit moves, certain against a frozen target. ×1.5 damage.
const CRIT_BASE = 4;
function calcCrit(att, def, move) { let c = CRIT_BASE; if (move.eff && move.eff.crit) c += 20; if (def.status === 'frz') c = 100; return clamp(c, 0, 100); }
function calcDmg(att, def, move, defTerr, crit = false) {
  const eff = effMult(move.type, def.types); if (eff === 0) return 0;
  const A = attackStat(att, move), D = Math.max(1, defenseStat(def, move));
  let d = Math.floor((Math.floor(2 * att.level / 5 + 2) * move.pow * A / D) / 50) + 2;
  if (att.types.includes(move.type)) d = Math.floor(d * 1.25);
  d = Math.floor(d * eff);
  d = Math.floor(d * (1 - terrainDef(defTerr, def) / 100));
  if (def.brace) d = Math.floor(d * BRACE_MULT);
  if (crit) d = Math.floor(d * 1.5);
  d = Math.floor(d * powerDamageMultiplier(att, def));
  if (isPracticeTarget(def)) return Math.min(Math.max(0, def.hp - 1), Math.max(1, d));
  return Math.max(eff > 0 ? 1 : 0, d);
}
// Follow-up strike: only roles built for it (scouts and strikers) turn a 10+ SPE lead into a second hit.
const FOLLOW_UP_SPE = 10;
function doubles(att, def) { return att.status !== 'par' && !!(ROLES[att.role] && ROLES[att.role].followUp) && att.spe >= def.spe + FOLLOW_UP_SPE; }
// Hyper Beam needs a charge: it cannot be fired as a counter, and a unit that fired it cannot counter until it has recharged.
function needsRecharge(move) { return !!(move.eff && move.eff.recharge); }
function counterBlock(def) { return def.status === 'frz' ? 'frozen' : def.recharge ? 'recharging' : null; }
function bestMove(att, def, d, terr, asCounter = false) { let best = null, bd = -1; for (const m of usableMoves(att, d)) { if (asCounter && needsRecharge(m)) continue; const v = calcDmg(att, def, m, terr) * calcHit(att, def, m, terr) / 100; if (v > bd) { bd = v; best = m; } } return best; }
// Healing a drain move gives back: a share of the HP actually taken, never of overkill. 0 when nothing was taken.
function drainFor(move, lost) { return move.eff && move.eff.drain && lost > 0 ? Math.max(1, Math.floor(lost * move.eff.drain)) : 0; }
// Short labels for a move's chance-based or lasting effects, for forecasts and help.
function moveEffects(move, target) { const e = move.eff, out = []; if (!e) return out; if (e.status && !(target && (powerBlocksStatus(target) || isPracticeTarget(target)))) out.push(e.chance + '% ' + STATUS[e.status].name); if (e.drain) out.push('drains ' + Math.round(e.drain * 100) + '%'); if (e.crit) out.push('high crit'); if (e.recharge) out.push('must recharge'); return out; }
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
  const side = (A, Dn, m, terr) => ({ unit: A, move: m, dmg: calcDmg(A, Dn, m, terr), critDmg: calcDmg(A, Dn, m, terr, true), hit: calcHit(A, Dn, m, terr), crit: calcCrit(A, Dn, m), dbl: doubles(A, Dn), eff: effMult(m.type, Dn.types), braced: !!Dn.brace });
  const a = side(att, def, move, dT);
  const block = counterBlock(def); const cm = block ? null : bestMove(def, att, d, aT, true);
  const c = cm ? side(def, att, cm, aT) : null;
  const order = [a]; if (c) order.push(c); if (a.dbl) order.push(a); else if (c && c.dbl) order.push(c);
  let hpA = att.hp, hpD = def.hp; const strikes = [];
  for (const s of order) {
    const isA = s === a; const strikerHp = isA ? hpA : hpD, targetHp = isA ? hpD : hpA; const nominal = strikerHp > 0 && targetHp > 0;
    // critKo: a critical on this strike would drop the target even though the normal hit would not
    const safe = isPracticeTarget(isA ? def : att), damage = safe ? Math.min(s.dmg, Math.max(0, targetHp - 1)) : s.dmg;
    const e = { side: isA ? 'a' : 'c', unit: s.unit, move: s.move, dmg: damage, hit: s.hit, crit: s.crit, critDmg: s.critDmg, critKo: !safe && nominal && s.dmg < targetHp && s.critDmg >= targetHp, braced: s.braced, eff: s.eff, drain: 0, nominal, cond: null };
    if (nominal) {
      // drain: a share of the HP taken, then capped by what the striker is missing, so the preview promises only real healing
      const dr = Math.min(drainFor(s.move, Math.min(damage, targetHp)), isA ? att.maxHp - hpA : def.maxHp - hpD); e.drain = dr;
      if (isA) { hpD = Math.max(0, hpD - damage); hpA += dr; } else { hpA = Math.max(0, hpA - damage); hpD += dr; }
    } else e.cond = 'only if ' + (strikerHp <= 0 ? s.unit : isA ? def : att).name + ' survives';
    strikes.push(e);
  }
  return { a, c, d, strikes, hpA, hpD, koA: hpA <= 0, koD: hpD <= 0, noCounter: c ? null : (block || 'range'), recharge: needsRecharge(move) };
}
// Resolve a full exchange by rolling the forecast's strikes in order. Mutates units; returns an event list
// for the animation layer. Each strike re-checks the live state: a unit frozen by an earlier hit cannot
// answer or double, a unit paralyzed mid-exchange loses its double, and hit/crit use the current status.
function resolveCombat(att, def, move, from) {
  const fc = forecast(att, def, move, from); const ev = []; const struck = new Set();
  for (const s of fc.strikes) {
    const A = s.unit, Dn = s.side === 'a' ? def : att, isCounter = s.side === 'c'; if (A.hp <= 0 || Dn.hp <= 0) continue;
    if (A.status === 'frz') continue; // frozen mid-exchange: no counter, no double
    if (struck.has(A) && !doubles(A, Dn)) continue; // paralyzed mid-exchange: no double
    struck.add(A); const dT = terrAt(Dn.x, Dn.y);
    const hit = rnd() * 100 < calcHit(A, Dn, s.move, dT);
    if (!hit) { ev.push({ type: 'miss', att: A, def: Dn, move: s.move, counter: isCounter }); continue; }
    const crit = rnd() * 100 < calcCrit(A, Dn, s.move); const dmg = calcDmg(A, Dn, s.move, dT, crit);
    const lost = Math.min(dmg, Dn.hp); Dn.hp -= lost; let status = null;
    const ef = s.move.eff; // secondary effects need a damaging hit: immunity blocks them
    if (ef && ef.status && !powerBlocksStatus(Dn) && !isPracticeTarget(Dn) && dmg > 0 && !Dn.status && Dn.hp > 0 && rnd() * 100 < ef.chance) { const st = ef.status; if (!(st === 'brn' && Dn.types.includes('Fire')) && !(st === 'psn' && (Dn.types.includes('Poison') || Dn.types.includes('Steel'))) && !(st === 'par' && Dn.types.includes('Electric')) && !(st === 'frz' && Dn.types.includes('Ice'))) { Dn.status = st; Dn.statusTurns = 0; status = st; } }
    const drain = Math.min(drainFor(s.move, lost), A.maxHp - A.hp); A.hp += drain; // the event carries the HP actually restored
    ev.push({ type: 'hit', att: A, def: Dn, move: s.move, dmg, lost, crit, eff: s.eff, hpAfter: Dn.hp, status, drain, attHpAfter: A.hp, counter: isCounter });
    if (Dn.hp <= 0) ev.push({ type: 'ko', unit: Dn, by: A });
    if (Dn.status === 'frz' && dmg > 0 && s.move.type === 'Fire') { Dn.status = null; ev.push({ type: 'thaw', unit: Dn }); }
  }
  // firing a recharge move costs the next turn whether it hit or missed
  if (fc.recharge && att.hp > 0) { att.recharge = 1; ev.push({ type: 'recharge', unit: att }); }
  powerAfterCombat(att, ev); settleOutposts();
  // experience for player-team survivors
  for (const [u, o] of [[att, def], [def, att]]) { if (!isHuman(u.team) || u.hp <= 0) continue; const took = ev.some(e => e.type === 'hit' && e.att === u); if (!took) continue; awardXp(u, xpGain(u, o, o.hp <= 0), ev); }
  return ev;
}
function awardXp(u, amount, ev) {
  if (B && B.territory) return; // equal fixed-level territory teams
  if (u.level >= 50) return; u.xp += amount; ev.push({ type: 'xp', unit: u, amount });
  while (u.xp >= xpToNext() && u.level < 50) { u.xp -= xpToNext(); const gains = levelUp(u); ev.push({ type: 'levelup', unit: u, gains, level: u.level }); const evo = evolutionFor(u); if (evo) { const from = u.dex; ev.push({ type: 'evolve', unit: u, from, to: evo }); evolve(u, evo); } }
}
// Start-of-phase upkeep for one team: recharge, status damage, terrain heals and cures, thaw checks.
// Returns events. Runs exactly once per phase; a resumed suspend save skips it (see beginPhase).
function upkeep(team) {
  powerPhaseStart(team);
  const ev = [];
  for (const u of alive(team)) {
    u.acted = false; u.moved = false;
    if (u.recharge) { u.recharge = 0; u.acted = true; u.moved = true; ev.push({ type: 'recharge', unit: u, done: true }); }
    // skills: the cooldown ticks, a brace ends at its owner's next turn, a root wears off after the held phase
    if (u.cd > 0) u.cd--;
    if (u.brace) u.brace = 0;
    if (u.root > 0) { u.root--; if (!u.root) ev.push({ type: 'unroot', unit: u }); }
    const t = terrAt(u.x, u.y);
    if (t.heal && territoryHeals(u)) {
      if (u.hp < u.maxHp) { const h = Math.max(1, Math.floor(u.maxHp * t.heal)); u.hp = Math.min(u.maxHp, u.hp + h); ev.push({ type: 'heal', unit: u, amount: h }); }
      if (u.status || u.root) { ev.push({ type: 'cure', unit: u }); u.status = null; u.root = 0; }
    }
    if (t.burn && !u.fly && !u.types.includes('Fire')) { const d = Math.max(1, Math.floor(u.maxHp / 6)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'lava' }); }
    if (u.status === 'psn') { const d = Math.max(1, Math.floor(u.maxHp / 8)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'psn' }); }
    if (u.status === 'brn') { const d = Math.max(1, Math.floor(u.maxHp / 16)); u.hp = Math.max(1, u.hp - d); ev.push({ type: 'dot', unit: u, amount: d, kind: 'brn' }); }
    if (u.status === 'frz') { u.statusTurns++; if (u.statusTurns >= 2 || rnd() < .4) { u.status = null; ev.push({ type: 'cure', unit: u, kind: 'frz' }); } }
    if (u.status === 'par') { u.statusTurns++; if (u.statusTurns >= 3) { u.status = null; ev.push({ type: 'cure', unit: u, kind: 'par' }); } }
    if (!u.acted && (u.status === 'frz' || (u.status === 'par' && rnd() < .25))) { u.acted = u.moved = true; ev.push({ type: 'blocked', unit: u, kind: u.status }); }
  }
  return ev;
}
// Capture attempt. Returns {ok, shakes}
function tryCapture(target, ball) {
  if (target.team !== 2) return { ok: false, shakes: 0, refused: true };
  const p = captureChance(target, ball);
  const ok = p === 1 || (p > 0 && rnd() < p); const shakes = ok ? 3 : Math.floor(rnd() * 3);
  return { ok, shakes, p };
}
// ---------------------------------------------------------------- role skills
// Legal targets of an active skill for `u` standing at `from` (its own tile by default). Pure.
//   brace: itself.  mend: an adjacent non-hostile unit (never itself) that is hurt, statused or rooted.
//   root: a hostile within 1-2 tiles that is not flying and not already rooted.
function skillTargetsAt(u, sk = u.skill, from = u) {
  if (!sk || sk.passive) return [];
  if (sk.target === 'self') return u.hp > 0 ? [u] : [];
  const out = [];
  for (const v of B.units) {
    if (v.hp <= 0 || v === u) continue; const d = Math.abs(v.x - from.x) + Math.abs(v.y - from.y); if (d < sk.rng[0] || d > sk.rng[1]) continue;
    if (sk.target === 'ally' && !hostile(u.team, v.team) && (v.hp < v.maxHp || v.status || v.root)) out.push(v);
    if (sk.target === 'foe' && hostile(u.team, v.team) && !v.fly && !v.root && !powerBlocksStatus(v) && !isPracticeTarget(v)) out.push(v);
  }
  return out;
}
// The one legality rule for active skills, shared by the menu, the AI and the mutation boundary. Pure: no dice,
// no mutation. Returns why `u` cannot use `sk` on `t` from tile `from` (its own tile by default), or null when it can.
// `t` may be omitted to ask only about the user; `strict` also refuses a user that has already acted this phase
// (the AI asks before acting; previews from a hypothetical tile pass `from`).
function skillCheck(u, sk = u.skill, t, from = u, strict = true) {
  if (!u || u.hp <= 0) return 'fainted';
  if (!sk || sk.passive || sk !== u.skill) return 'none';
  if (strict && u.acted) return 'acted';
  if (u.status === 'frz') return 'frozen';
  if (u.recharge) return 'recharging';
  if (u.cd > 0) return 'cooldown ' + u.cd;
  const legal = skillTargetsAt(u, sk, from); if (!legal.length) return 'no target';
  if (t !== undefined && !legal.includes(t)) return 'bad target';
  return null;
}
function skillReady(u, from = u) { return skillCheck(u, u.skill, undefined, from) === null; }
// Why a skill cannot be used right now (for the menu hint), or null.
function skillBlock(u) { return skillCheck(u, u.skill); }
// What Mend would restore: 30% of the target's max HP, capped by what is missing.
function mendAmount(t) { return Math.min(t.maxHp - t.hp, Math.max(1, Math.floor(t.maxHp * MEND_RATIO))); }
// Preview text of a skill on a target (also what the card shows). Pure.
function skillPreview(u, sk, t) {
  if (sk.id === 'brace') return 'takes ' + Math.round((1 - BRACE_MULT) * 100) + '% less damage until its next turn';
  if (sk.id === 'mend') { const h = mendAmount(t); const parts = []; if (h > 0) parts.push('+' + h + ' HP (' + t.hp + ' → ' + (t.hp + h) + ')'); if (t.status) parts.push('cures ' + STATUS[t.status].name); if (t.root) parts.push('frees it'); return parts.join(' · '); }
  if (sk.id === 'root') return 'cannot move on its next turn';
  return '';
}
// Apply an active skill. This is the only place a skill mutates anything, and it refuses anything skillCheck
// refuses: an illegal call returns null and changes nothing (no cooldown, no XP, no effect). Legal calls return the
// events for the animation layer; the action is spent by the caller. Deterministic: no dice anywhere in here.
function useSkill(u, sk, t, from = u) {
  if (skillCheck(u, sk, t, from) !== null) return null;
  const ev = [{ type: 'skill', unit: u, skill: sk, target: t }];
  if (sk.id === 'brace') { u.brace = 1; ev.push({ type: 'brace', unit: u }); }
  else if (sk.id === 'mend') { const h = mendAmount(t); if (h > 0) { t.hp += h; ev.push({ type: 'heal', unit: t, amount: h }); } if (t.status || t.root) { t.status = null; t.root = 0; ev.push({ type: 'cure', unit: t }); } }
  else if (sk.id === 'root') { t.root = 2; if (t.team === 1 && t.ai !== 'aggro') t.provoked = true; ev.push({ type: 'root', unit: t, by: u }); }
  u.cd = sk.cd;
  if (sk.xp && isHuman(u.team)) awardXp(u, sk.xp, ev);
  return ev;
}
// Dart (scout): after an attack the unit may still move up to DART_MOV tiles (less if paralyzed, none if rooted or recharging).
function dartMov(u) { return Math.min(DART_MOV, effMov(u)); }
function canDart(u) { return !!(u.skill && u.skill.id === 'dart' && u.hp > 0 && !u.recharge && u.status !== 'frz' && dartMov(u) > 0 && !B.result); }
// The AI's dart: the tile within reach that is out of hostile reach, or failing that the best-covered one farthest from foes. Null to stay.
function aiDart(u) {
  if (!canDart(u)) return null; const reach = reachable(u, u.x, u.y, dartMov(u)); const threat = dangerZone(u.team); const foes = aiTargetsOf(u);
  let best = null, bs = -1e9;
  for (const n of reach.values()) { if (!canStand(u, n.x, n.y)) continue; const near = foes.length ? Math.min(...foes.map(f => Math.abs(f.x - n.x) + Math.abs(f.y - n.y))) : 0; const s = (threat.has(key(n.x, n.y)) ? 0 : 12) + terrainDef(terrAt(n.x, n.y), u) * .3 + near * 1.5 + (n.x === u.x && n.y === u.y ? .5 : 0); if (s > bs) { bs = s; best = n; } }
  return best && (best.x !== u.x || best.y !== u.y) ? { x: best.x, y: best.y } : null;
}
function checkObjective() {
  if (B.territory) return territoryObjective();
  const o = B.map.objective; if (B.result) return B.result;
  if (B.versus) {
    syncFlags(); const a = alive(0).length, b = alive(1).length; const win = (t, why) => { B.endReason = why; return B.result = t; };
    if (!a && !b) return win('draw', 'Everyone fainted at once.'); if (!a) return win('p2', 'Player 1 has no Pokémon left.'); if (!b) return win('p1', 'Player 2 has no Pokémon left.');
    if (B.captureBy != null) return win(B.captureBy === 0 ? 'p1' : 'p2', 'Player ' + (B.captureBy + 1) + ' captured the flag!');
    if (B.hill) for (const t of [0, 1]) if (B.hill.score[t] >= B.hill.need) return win(t === 0 ? 'p1' : 'p2', 'Player ' + (t + 1) + ' held the hill.');
    if (B.map.turnLimit && B.turn > B.map.turnLimit) {
      if (B.hill && B.hill.score[0] !== B.hill.score[1]) return win(B.hill.score[0] > B.hill.score[1] ? 'p1' : 'p2', 'More hill points at the turn limit.');
      return win(a > b ? 'p1' : b > a ? 'p2' : 'draw', a === b ? 'Equal teams at the turn limit.' : 'The larger team at the turn limit.');
    }
    return null;
  }
  if (!alive(0).length) return B.result = 'lose';
  if (o.type === 'rout' && !alive(1).length && (!B.lesson || B.lesson.complete)) return B.result = 'win';
  if (o.type === 'boss' && !B.units.some(u => u.boss && u.hp > 0 && u.team === 1)) return B.result = 'win';
  if (o.type === 'survive' && B.turn > o.turns) return B.result = 'win';
  if (o.type === 'seize' && B.seized) return B.result = 'win';
  if (B.map.turnLimit && o.type !== 'survive' && B.turn > B.map.turnLimit) return B.result = 'lose';
  return null;
}
function objectiveText() { if (B.lesson && !B.lesson.complete) return 'Catch Caterpie + defeat foes'; const o = B.map.objective; switch (o.type) { case 'rout': return 'Defeat all enemies'; case 'boss': return 'Defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Survive ' + o.turns + ' turns'; case 'seize': return 'Seize the ' + (o.what || 'gym'); case 'versus': return versusObjectiveText(); } return ''; }

// ---------------------------------------------------------------- versus rules: modes, flags, the hill, fog of war
const VS_MODES = {
  elim: { name: 'Elimination', short: 'ELIM', blurb: 'Knock out every Pokémon on the other team. At the turn limit the larger team wins.' },
  ctf: { name: 'Capture the Flag', short: 'CTF', blurb: 'Take the flag from the enemy base and carry it back to your own flag. A fainted carrier drops it; step on your own dropped flag to send it home.' },
  hill: { name: 'King of the Hill', short: 'HILL', blurb: 'Start three of your turns with more Pokémon than the other team on the hill, the 3×3 zone in the middle of the arena.' },
};
const VS_ARENAS = { s: { name: 'Small', w: 14, h: 9 }, m: { name: 'Medium', w: 18, h: 11 }, l: { name: 'Large', w: 22, h: 13 } };
function fogVision(u) { return 3 + (u.fly ? 1 : 0); }
// Tiles a team can see under fog: within each of its units' vision, except tall grass and forest, which need an adjacent unit.
function computeVision(team) {
  const vis = new Set();
  for (const u of B.units) { if (u.hp <= 0 || hostile(u.team, team)) continue; const r = fogVision(u);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d > r) continue; const x = u.x + dx, y = u.y + dy; if (!inMap(x, y)) continue; const t = terrAt(x, y); if (d > 1 && (t.id === 'tall' || t.id === 'forest')) continue; vis.add(key(x, y)); } }
  return vis;
}
function refreshVision(team) { B.vis = B.fog ? computeVision(team) : null; return B.vis; }
function fogHides(u, team) { return !!(u && B.fog && B.vis && u.hp > 0 && hostile(u.team, team) && !B.vis.has(key(u.x, u.y))); }
function flagLying(x, y) { return B.flags ? B.flags.find(f => f.carrier == null && f.x === x && f.y === y) : null; }
function flagCarriedBy(u) { return B.flags ? B.flags.find(f => f.carrier === u.id) : null; }
// Flags follow their carrier; a fainted carrier drops the flag where it fell.
function syncFlags() { if (!B.flags) return; for (const f of B.flags) { if (f.carrier == null) continue; const c = B.units.find(u => u.id === f.carrier); if (!c || c.hp <= 0) { f.carrier = null; if (c) { f.x = c.x; f.y = c.y; } } else { f.x = c.x; f.y = c.y; } } }
// A trainer's Pokémon ending its action on a flag: takes the enemy flag, returns its own, or scores by bringing the enemy flag home.
function versusAfterAction(u) {
  if (!B.versus || u.team > 1 || u.hp <= 0) return null; syncFlags(); if (!B.flags) return null; let ev = null;
  const lying = flagLying(u.x, u.y);
  if (lying && lying.team !== u.team && !flagCarriedBy(u)) { lying.carrier = u.id; lying.x = u.x; lying.y = u.y; ev = { type: 'flag', what: 'taken', unit: u, flag: lying }; }
  else if (lying && lying.team === u.team && (lying.x !== lying.home.x || lying.y !== lying.home.y)) { lying.x = lying.home.x; lying.y = lying.home.y; ev = { type: 'flag', what: 'returned', unit: u, flag: lying }; }
  const carried = flagCarriedBy(u); const own = B.flags.find(f => f.team === u.team);
  if (carried && own && u.x === own.home.x && u.y === own.home.y) { B.captureBy = u.team; ev = { type: 'flag', what: 'captured', unit: u, flag: carried }; }
  return ev;
}
function hillCount(team) { const h = B.hill; return B.units.filter(u => u.hp > 0 && u.team === team && Math.abs(u.x - h.x) <= h.r && Math.abs(u.y - h.y) <= h.r).length; }
// King of the Hill: starting a turn with more Pokémon on the hill than the other team scores a point.
function versusPhaseStart(team) { if (!B.versus) return null; syncFlags(); if (B.hill && team <= 1) { const mine = hillCount(team), theirs = hillCount(1 - team); if (mine > theirs) { B.hill.score[team]++; return { type: 'hill', team, score: B.hill.score[team] }; } } return null; }
function versusObjectiveText() { const m = B.map.objective.mode || 'elim'; return m === 'ctf' ? 'Capture the enemy flag' : m === 'hill' ? 'Hold the hill ' + (B.hill ? B.hill.need : 3) + ' turns' : 'Beat the other team'; }

// ---------------------------------------------------------------- AI
// BFS distance field over terrain the unit can enter (ignores units) from a set of goal cells.
function distField(u, goals) {
  const d = new Map(); const q = []; for (const g of goals) { d.set(key(g.x, g.y), 0); q.push(g); }
  while (q.length) { const c = q.shift(); const cd = d.get(key(c.x, c.y)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.x + dx, ny = c.y + dy; if (!inMap(nx, ny)) continue; if (moveCost(terrAt(nx, ny), u) >= 99) continue; const k = key(nx, ny); if (d.has(k)) continue; d.set(k, cd + 1); q.push({ x: nx, y: ny }); } }
  return d;
}
function aiTargetsOf(u) { return B.units.filter(v => v.hp > 0 && hostile(u.team, v.team) && !(u.team === 2 && v.team === 2)); }
// Score of using the unit's active skill from cell n on target t, on the same scale as the attack scores
// (roughly expected damage dealt), or null when it is not worth it. `threat` is the set of cells hostiles reach next phase.
function aiSkillScore(u, sk, n, t, threat, aT) {
  if (sk.id === 'mend') { const h = mendAmount(t); if (h <= 0 && !t.status && !t.root) return null; return h * 1.1 + (t.status ? 8 : 0) + (t.root ? 4 : 0) + (t.leader || t.boss ? 4 : 0) + terrainDef(aT, u) * .2 - (threat.has(key(n.x, n.y)) ? 4 : 0); }
  if (sk.id === 'root') { // worth it only against a unit that would otherwise move next phase and could then reach one of ours
    const mobile = effMov(t, statusAfterUpkeep(t), rootAfterUpkeep(t)); if (!mobile || (!isHuman(t.team) && (t.ai === 'guard' || t.ai === 'stay') && !t.provoked)) return null;
    const allies = B.units.filter(v => v.hp > 0 && !hostile(u.team, v.team) && v !== t); const menace = allies.some(a => dist(a, t) <= mobile + t.rngMax); if (!menace) return null; return 6 + t.level * .3 + (t.boss ? 5 : 0) + terrainDef(aT, u) * .2; }
  if (sk.id === 'brace') { if (!threat.has(key(n.x, n.y))) return null; return 7 + (1 - u.hp / u.maxHp) * 10 + terrainDef(aT, u) * .3; }
  return null;
}
// Decide an action: {x,y,target,move} to attack, {x,y,skill,target} to use a skill, {x,y} to move, or null to wait.
function canTakeAction(u) { return !!(u && u.hp > 0 && !u.acted && !u.recharge && u.status !== 'frz'); }
function aiDecide(u, cautious = false) {
  if (!canTakeAction(u) || isPracticeTarget(u)) return null;
  if (B.territory) return territoryDecide(u);
  const reach = reachable(u); const targets = aiTargetsOf(u); if (!targets.length) return null;
  const provoked = u.ai === 'aggro' || u.provoked || targets.some(t => dist(t, u) <= (u.ai === 'guard' ? Math.max(u.rngMax, 1) : 2));
  let best = null, bestScore = -1e9;
  const why = skillCheck(u); const sk = why === null || why === 'no target' ? u.skill : null; const threat = sk ? dangerZone(u.team) : null; // targets are checked per tile below
  for (const n of reach.values()) {
    if (!canStand(u, n.x, n.y)) continue;
    if (u.ai !== 'aggro' && !u.provoked && !(n.x === u.x && n.y === u.y) && u.ai === 'guard') continue; // guards never move
    const aT = terrAt(n.x, n.y);
    if (sk) for (const t of skillTargetsAt(u, sk, n)) { const s = aiSkillScore(u, sk, n, t, threat, aT); if (s != null && s + (n.x === u.x && n.y === u.y ? 1.5 : 0) > bestScore) { bestScore = s + (n.x === u.x && n.y === u.y ? 1.5 : 0); best = { x: n.x, y: n.y, skill: sk, target: t }; } }
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
  const capture = campaignCaptureChoice(u, bestScore); if (capture) return capture;
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
