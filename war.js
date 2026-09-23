// ============================================================================
// war.js — the Advance Wars layer every battle shares (Frente Kanto, see docs/frente-kanto.md): properties (HQs,
// Poké Centers, Field Centers and the map's outposts) with owners and a 20-point capture, funds paid each day, the
// Box each side deploys Pokémon from, catches that land in the Box, Pokémon that faint back into it and recover,
// and the AI that deploys and captures. Conquest (territory.js) is one configuration of it; the campaign, Skirmish
// and Versus are others. Model only: forecasts, the AI and playback share it.
// ============================================================================
'use strict';
const WAR = { income: 1000, cap: 10, capture: 20, recovery: 2, ball: 500 };
const PROP_KIND = { Q: 'hq', C: 'center', K: 'center' };
// Deploy price: base stat total × (level + 10) / 4, to the ₽100, at least ₽1000 (a Lv 5 Pidgey ₽1000, a Lv 20
// Pidgey ₽1900, a Lv 16 Ivysaur ₽2600, a Lv 30 Charizard ₽5300).
function bstOf(num) { const b = DEX[num].base; return b.hp + b.atk + b.def + b.spa + b.spd + b.spe; }
function warCost(num, level) { return Math.max(1000, Math.round(bstOf(num) * (level + 10) * .25 / 100) * 100); }
function money(n) { return '₽' + Math.round(n).toLocaleString('en-US'); }
// A Box entry: a Pokémon a side can deploy. `data` is a serialized unit (a campaign Pokémon or a catch) that keeps its
// moves and experience; otherwise the species is made fresh at `level`. state: 'box' (in the PC) or 'field'.
function warEntry(e) {
  const num = e.num || (e.data && e.data.num), level = e.level || (e.data && e.data.level) || 5;
  return { num, level, cost: e.cost != null ? e.cost : warCost(num, level), data: e.data || null, pid: e.pid == null ? null : e.pid, unitId: null, state: 'box', recovery: 0, fresh: !!e.fresh, nick: e.nick || null };
}
// Build the war state of the battle in B from the map (its property tiles and outposts) and the mode's settings:
// opts.war = { funds: [a, b], income, owners: {'x,y': team}, names, goals, boxes: [[entry]…], centers: default owner of
// centers (campaign: 0, the player's; otherwise neutral), hold: {need, turns} (Conquest), turns, bank, cap }.
function warInit(mapDef, opts = {}) {
  const cfg = Object.assign({ funds: [0, 0], income: WAR.income, incomeMult: [1, 1], owners: {}, names: {}, goals: {}, boxes: [[], []], centers: -1, hold: null, turns: null, bank: null, cap: WAR.cap }, mapDef.war || {}, opts.war || {});
  const props = [], m = B.map;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.tiles[y][x].ch, kind = PROP_KIND[ch]; if (!kind) continue; const k = x + ',' + y;
    const owner = cfg.owners[k] != null ? cfg.owners[k] : kind === 'hq' ? (x < m.w / 2 ? 0 : 1) : cfg.centers;
    props.push({ x, y, kind, ch, name: cfg.names[k] || (kind === 'hq' ? (owner === 0 ? 'YOUR HQ' : owner === 1 ? 'ENEMY HQ' : 'HQ') : ch === 'K' ? 'FIELD CENTER' : 'POKé CENTER'), hq: kind === 'hq' ? owner : -1, owner, captor: null, progress: 0, goal: !!cfg.goals[k] });
  }
  // the map's outposts: named properties (a gym to seize, a contested center) with their own owner
  for (const o of mapDef.outposts || []) { let p = props.find(q => q.x === o.x && q.y === o.y); if (!p) { p = { x: o.x, y: o.y, kind: 'outpost', ch: m.tiles[o.y][o.x].ch, hq: -1, captor: null, progress: 0 }; props.push(p); } Object.assign(p, { name: o.name || p.name, owner: o.owner != null ? o.owner : -1, goal: !!o.goal }); }
  B.war = { version: 1, income: cfg.income, incomeMult: cfg.incomeMult.slice(), funds: cfg.funds.slice(), props, box: [0, 1].map(t => (cfg.boxes[t] || []).map(warEntry)), cap: cfg.cap, hold: cfg.hold ? { need: cfg.hold.need || 2, turns: cfg.hold.turns || 3, count: [0, 0] } : null, turns: cfg.turns, bank: cfg.bank, stats: { captures: [0, 0], deployments: [0, 0], catches: [0, 0] }, stamp: [-1, -1], reason: '' };
  m.ownerAt = warOwnerAt;
}
function warProperty(x, y) { return B && B.war ? B.war.props.find(p => p.x === x && p.y === y) || null : null; }
function warOwnerAt(x, y) { const p = warProperty(x, y); return p ? p.owner : null; }
function warOwned(team) { return B && B.war ? B.war.props.filter(p => p.owner === team) : []; }
// Income comes from HQs and centers (a gym or an outpost is an objective, not a treasury).
function warIncome(team) { return B && B.war ? Math.round(warOwned(team).filter(p => p.kind === 'hq' || p.kind === 'center').length * B.war.income * (1 + coIncome(team)) * ((B.war.incomeMult || [1, 1])[team] || 1) / 100) * 100 : 0; } // incomeMult: a Skirmish difficulty's handicap
// A property heals whoever owns it (and every heal tile that is not a property heals everyone, as before).
function warHeals(u) { const p = warProperty(u.x, u.y); return !p || p.owner === u.team; }
function warDeploySites(team) { return warOwned(team).filter(p => p.kind === 'hq' || p.kind === 'center'); }
// Record what happened since the last committed action: a captor that left or fainted loses its progress; a deployed
// Pokémon that fainted goes back to its Box and recovers for two of its side's days.
function warSettle() {
  if (!B || !B.war) return; const W = B.war;
  for (const p of W.props) if (p.captor != null) { const u = B.units.find(v => v.id === p.captor && v.hp > 0); if (!u || u.x !== p.x || u.y !== p.y || u.team === p.owner) { p.captor = null; p.progress = 0; } }
  for (const team of [0, 1]) for (const e of W.box[team]) if (e.state === 'field') { const u = B.units.find(v => v.id === e.unitId); if (!u || u.hp <= 0) { e.state = 'box'; e.recovery = WAR.recovery; } }
  if (W.hold) for (const t of [0, 1]) if (warMiddleHeld(t) < W.hold.need) W.hold.count[t] = 0;
}
function warMiddleHeld(team) { return warOwned(team).filter(p => p.kind !== 'hq').length; }
// The start of a side's turn: income, recovery in the Box, Conquest's hold count. Once per side and day.
function warUpkeep(team) {
  if (!B || !B.war || team > 1) return; const W = B.war; if (W.stamp[team] === B.turn) return; warSettle(); W.stamp[team] = B.turn;
  for (const e of W.box[team]) if (e.state === 'box' && e.recovery > 0) e.recovery--;
  W.funds[team] += warIncome(team); if (W.bank) W.funds[team] = Math.min(W.bank, W.funds[team]);
  if (W.hold) W.hold.count[team] = warMiddleHeld(team) >= W.hold.need ? W.hold.count[team] + 1 : 0;
}
function warCaptureGain(u) { return Math.max(1, Math.ceil(10 * u.hp / u.maxHp)); }
function warCaptureBlock(u, p = u && warProperty(u.x, u.y), from = u) {
  if (!B || !B.war || !u || u.hp <= 0 || u.team > 1) return 'unavailable';
  if (u.acted || u.status === 'frz' || u.recharge) return 'unit not ready';
  if (!p || !B.war.props.includes(p) || p.owner === u.team || from.x !== p.x || from.y !== p.y) return 'stand on another property';
  return null;
}
function warCapture(u) {
  const p = warProperty(u.x, u.y); if (warCaptureBlock(u, p)) return null; warSettle();
  if (p.captor !== u.id) { p.captor = u.id; p.progress = 0; }
  p.progress = Math.min(WAR.capture, p.progress + warCaptureGain(u)); const done = p.progress >= WAR.capture;
  if (done) { p.owner = u.team; p.captor = null; p.progress = 0; B.war.stats.captures[u.team]++; powerCharge(u.team, 20); if (p.goal && u.team === 0) B.seized = true; }
  u.acted = u.moved = true; warSettle();
  return { type: 'property', unit: u, property: p, done, progress: p.progress };
}
function warEntryCost(e) { return e.fresh ? 0 : e.cost; }
function warDeployBlock(team, i, p) {
  if (!B || !B.war || B.result || team !== B.phase || team < 0 || team > 1) return 'not your phase';
  const e = B.war.box[team][i]; if (!e) return 'not in the box';
  if (e.state === 'field') return 'already on the map'; if (e.recovery) return 'recovering · ' + e.recovery + (e.recovery > 1 ? ' days' : ' day');
  if (!p || !B.war.props.includes(p) || p.owner !== team || (p.kind !== 'hq' && p.kind !== 'center')) return 'needs one of your centers';
  if (unitAt(p.x, p.y)) return 'the center is occupied';
  if (alive(team).length >= B.war.cap) return B.war.cap + ' on the map already';
  if (B.war.funds[team] < warEntryCost(e)) return 'needs ' + money(warEntryCost(e));
  return null;
}
// Withdraw a Pokémon from the Box onto a free property: a campaign Pokémon or a catch comes back as itself (moves,
// experience), a fainted one at full HP; it waits until its side's next turn.
function warDeploy(team, i, p) {
  if (warDeployBlock(team, i, p)) return null; const W = B.war, e = W.box[team][i];
  let u = e.unitId != null ? B.units.find(v => v.id === e.unitId) : null;
  if (u) { u.hp = u.maxHp; u.status = null; u.statusTurns = 0; u.recharge = 0; u.cd = 0; u.brace = 0; u.root = 0; u.x = p.x; u.y = p.y; u.fx.alpha = 1; u.fx.dx = u.fx.dy = 0; u.fx.sx = u.fx.sy = 1; u.captured = false; }
  else { u = e.data ? restoreUnit(Object.assign({}, e.data, { team, x: p.x, y: p.y, id: 0, acted: false, status: null, recharge: 0, cd: 0, brace: 0, root: 0 })) : makeUnit(e.num, e.level, team, { x: p.x, y: p.y }); u.hp = u.maxHp; if (e.pid != null) u.pid = e.pid; B.units.push(u); requestBigSprite(u.num); }
  u.team = team; u.acted = u.moved = true; u.fx.facing = team === 1 ? -1 : 1; e.unitId = u.id; e.state = 'field';
  W.funds[team] -= warEntryCost(e); e.fresh = false; W.stats.deployments[team]++;
  const ps = powerState(team); if (ps && ps.captainId === u.id) u.leader = true;
  return u;
}
// A catch goes to the catcher's Box, marked fresh (its first deployment is free).
function warBoxAdd(team, unit) {
  if (!B || !B.war || team > 1) return null;
  const data = serializeUnit(Object.assign({}, unit, { team, hp: unit.maxHp, status: null })); const e = warEntry({ num: unit.num, level: unit.level, data, fresh: true, nick: unit.nick });
  B.war.box[team].push(e); B.war.stats.catches[team]++; return e;
}
function warBallPrice() { return B && B.war ? WAR.ball : Infinity; }
// HQ capture ends the battle for its side; Conquest also has its hold race and turn limit.
function warObjective() {
  if (!B || !B.war || B.result) return B && B.result; warSettle(); const W = B.war;
  const finish = (winner, reason) => { W.reason = reason; if (B.versus) B.endReason = reason + '!'; return B.result = B.versus ? (winner < 0 ? 'draw' : winner === 0 ? 'p1' : 'p2') : winner < 0 ? 'draw' : winner === 0 ? 'win' : 'lose'; };
  for (const p of W.props) if (p.kind === 'hq' && p.hq >= 0 && p.owner !== p.hq) return finish(p.owner === 2 || p.owner === 3 || p.owner < 0 ? 1 - p.hq : p.owner, p.name + ' captured');
  if (W.hold) for (const t of [0, 1]) if (W.hold.count[t] >= W.hold.turns) return finish(t, (t === 0 ? 'You' : 'The enemy') + ' held ' + W.hold.need + ' centers for ' + W.hold.turns + ' turn starts');
  if (B.territory) for (const t of [0, 1]) if (!alive(t).length && !warDeploySites(t).length) return finish(1 - t, 'No Pokémon and no centers left');
  if (W.turns && B.turn > W.turns) { const a = warMiddleHeld(0), b = warMiddleHeld(1); return finish(a === b ? -1 : a > b ? 0 : 1, 'Turn limit: centers ' + a + '-' + b); }
  return null;
}
// ---------------------------------------------------------------- the AI side of the war
// Deploy: at each free own center (the ones nearest the foe first), the best affordable Pokémon for the matchups
// on the map; a side keeps a little money back when it is ahead on the field.
function warAiDeploy(team) {
  const out = []; if (!B || !B.war || team !== B.phase || team > 1) return out;
  const foes = aiTargetsOf({ team }), W = B.war;
  const sites = warDeploySites(team).slice().sort((a, b) => Math.min(...foes.map(u => dist(u, a)), 99) - Math.min(...foes.map(u => dist(u, b)), 99));
  for (const p of sites) {
    const options = W.box[team].map((e, i) => ({ e, i })).filter(o => !warDeployBlock(team, o.i, p));
    const score = e => { const d = DEX[e.num], power = bstOf(e.num) * (e.level + 10) / 400; const matches = foes.length ? Math.max(...d.types.map(t => foes.reduce((s, u) => s + effRaw(t, u.types), 0) / foes.length)) : 1; const ace = powerState(team); return power * matches + (roleFor(d) === 'support' && alive(team).some(u => u.hp < u.maxHp / 2) ? 4 : 0) + (e.fresh ? 3 : 0) + (ace && e.unitId != null && e.unitId === ace.captainId ? 6 : 0) - warEntryCost(e) / 2000; };
    options.sort((a, b) => score(b.e) - score(a.e) || a.i - b.i);
    if (options.length) { const u = warDeploy(team, options[0].i, p); if (u) out.push(u); }
  }
  return out;
}
// A war-aware decision: capture goals compete with attacks, skills, retreats to a friendly center and plain moves.
// Distance fields respect terrain access; exposed tiles carry an incoming-damage penalty. Used for war battles'
// free-roaming units (bosses, guards and scripted units keep their own AI).
function warDecide(u) {
  if (u.hp <= 0 || u.acted || u.status === 'frz' || u.recharge) return null;
  const foes = aiTargetsOf(u), reach = reachable(u), threat = dangerZone(u.team), W = B.war;
  const goals = W.props.filter(p => p.owner !== u.team || u.hp < u.maxHp * .7);
  const fields = goals.map(p => ({ p, field: distField(u, [p]) }));
  let best = null, score = -Infinity;
  for (const n of reach.values()) {
    if (!canStand(u, n.x, n.y)) continue; const tile = terrAt(n.x, n.y), danger = threat.has(key(n.x, n.y));
    const incoming = danger ? foes.reduce((s, e) => dist(e, n) > effMov(e) + e.rngMax ? s : s + Math.max(0, ...e.moves.map(m => calcDmg(e, u, m, tile))), 0) : 0;
    const risk = Math.min(60, incoming * (u.hp < u.maxHp / 2 ? .65 : .25));
    let route = -5;
    for (const { p, field } of fields) {
      const d = field.get(key(n.x, n.y)), before = field.get(key(u.x, u.y)); if (d == null || before == null) continue;
      const friendly = p.owner === u.team, importance = friendly ? (1 - u.hp / u.maxHp) * 2 : p.kind === 'hq' ? .8 : p.goal ? 1.3 : 1.2;
      const crowded = alive(u.team).filter(a => a !== u && dist(a, p) < dist(u, p)).length;
      route = Math.max(route, ((before - d) * 3 + 20 / (d + 1)) * importance - crowded * 2);
    }
    const cover = terrainDef(tile, u) * .12, offer = (s, d) => { if (s > score) { score = s; best = d; } };
    offer(route + cover - risk, { x: n.x, y: n.y });
    const p = warProperty(n.x, n.y);
    if (p && !warCaptureBlock(u, p, n)) offer(48 + (p.kind === 'hq' ? 30 : 0) + (p.goal ? 20 : 0) + (p.captor === u.id ? p.progress : 0) - risk, { x: n.x, y: n.y, capture: true });
    if (p && p.owner === u.team && u.hp < u.maxHp) offer((u.maxHp - u.hp) * .7 + 15 - risk, { x: n.x, y: n.y });
    if (u.skill && !u.skill.passive) for (const t of skillTargetsAt(u, u.skill, n)) if (!skillCheck(u, u.skill, t, n)) { const s = aiSkillScore(u, u.skill, n, t, threat, tile); if (s != null) offer(s + Math.max(0, route) * .4 - risk * .5, { x: n.x, y: n.y, skill: u.skill, target: t }); }
    for (const t of foes) for (const m of usableMoves(u, dist(n, t))) {
      const fc = forecast(u, t, m, n); let dealt = 0, taken = 0;
      for (const s of fc.strikes) if (s.nominal) { if (s.side === 'a') dealt += s.dmg * s.hit / 100; else taken += s.dmg * s.hit / 100; }
      const defending = warOwned(u.team).some(q => dist(t, q) <= 1);
      offer(dealt - taken * .8 + (fc.koD ? 35 : 0) - (fc.koA ? 80 : 0) + (defending ? 15 : 0) + Math.max(0, route) * .4 - risk * .3, { x: n.x, y: n.y, target: t, move: m });
    }
  }
  return best;
}
// Tall grass breeds encounters: B.wild = { pool: [{mon, level, ai}], cap, chance } comes from the map's wild Pokémon
// (or mapDef.wildPool / wildCap). At the start of each day after the first, while fewer wild Pokémon than the cap are
// out, one of the pool may step out of an empty patch of tall grass away from everyone (gameplay RNG, 30%).
function wildSetup(mapDef) {
  const pool = (mapDef.wildPool || (mapDef.units || []).filter(d => d.team === 2)).map(d => ({ mon: d.mon, level: d.level, ai: d.ai || 'aggro' }));
  // tall grass breeds them; a map without grass (a cave, a snowfield) breeds them on its open floor
  const has = id => B.map.tiles.some(row => row.some(t => t.id === id)), tiles = has('tall') ? ['tall'] : ['cave', 'snow', 'sand'].filter(has);
  B.wild = pool.length && tiles.length ? { pool, tiles, cap: mapDef.wildCap != null ? mapDef.wildCap : Math.max(2, pool.length), chance: mapDef.wildChance != null ? mapDef.wildChance : .3 } : null;
}
function wildSpawn() {
  const W = B.wild; if (!W || B.result || alive(2).length >= W.cap || rnd() >= W.chance) return [];
  const spots = []; for (let y = 0; y < B.map.h; y++) for (let x = 0; x < B.map.w; x++) if ((W.tiles || ['tall']).includes(B.map.tiles[y][x].id) && !unitAt(x, y) && !B.units.some(u => u.hp > 0 && dist(u, { x, y }) <= 2)) spots.push({ x, y });
  if (!spots.length) return []; const p = spots[Math.floor(rnd() * spots.length)], d = W.pool[Math.floor(rnd() * W.pool.length)];
  const u = makeUnit(d.mon, d.level, 2, { x: p.x, y: p.y, ai: d.ai }); u.provoked = false; B.units.push(u); requestBigSprite(u.num); return [u];
}
// Weather, Pokémon style: rain powers Water and dampens Fire, sun the reverse; a sandstorm and snow chip 1/16 of max HP a
// day from everyone they do not spare (never below 1 HP). B.weather = { kind, days }: days 0 is the map's own, lasting;
// a power's weather counts down at each dawn and gives the map's back.
const WEATHER = { rain: { name: 'Rain', start: 'It started to rain!', end: 'The rain stopped.' }, sun: { name: 'Harsh sun', start: 'The sunlight turned harsh!', end: 'The sunlight faded.' }, sand: { name: 'Sandstorm', start: 'A sandstorm kicked up!', end: 'The sandstorm subsided.' }, snow: { name: 'Snow', start: 'It started to snow!', end: 'The snow stopped.' } };
function setWeather(kind, days) { if (B) B.weather = WEATHER[kind] ? { kind, days: days || 0 } : null; }
function weatherKind() { return B && B.weather ? B.weather.kind : null; }
function weatherMult(type) { const k = weatherKind(); if (k === 'rain') return type === 'Water' ? 1.5 : type === 'Fire' ? .5 : 1; if (k === 'sun') return type === 'Fire' ? 1.5 : type === 'Water' ? .5 : 1; return 1; }
// The defender's side of the weather: a sandstorm hardens Rock types against special moves, snow hardens Ice types.
function weatherGuard(def, move) { const k = weatherKind(); if (k === 'sand' && move.kind !== 'P' && def.types.includes('Rock')) return 2 / 3; if (k === 'snow' && def.types.includes('Ice')) return 5 / 6; return 1; }
function weatherSpares(u, k) { return k === 'sand' ? u.types.some(t => t === 'Rock' || t === 'Ground' || t === 'Steel') : k === 'snow' ? u.types.includes('Ice') : true; }
function weatherDay(ev) { const W = B && B.weather; if (!W || !W.days) return; if (--W.days <= 0) { const kind = W.kind; B.weather = B.map.weather ? { kind: B.map.weather, days: 0 } : null; if (!B.weather || B.weather.kind !== kind) ev.push({ type: 'weatherEnd', kind }); } }
// Does this unit play the war (capture and roam) rather than a scripted role?
// Deployed Pokémon ('war') and free attackers ('aggro') do; guards, bosses and scripted roles keep their own AI.
function warRoams(u) { return !!(B && B.war && u.team <= 1 && !u.boss && (!u.ai || u.ai === 'aggro' || u.ai === 'war') && B.war.props.some(p => p.owner !== u.team)); }
// Model-only run of a whole war battle (Skirmish, Versus, the Tower): the AI plays both sides (upkeep and income,
// deployments, powers, captures, attacks) with wild Pokémon acting in between, until it ends or maxTurns pass.
function simWar(maxTurns = 40) {
  const log = [];
  for (; B.turn <= maxTurns && !B.result; B.turn++) {
    for (const team of [0, 1, 2]) {
      if (!alive(team).length && !(team <= 1 && warCanPlay(team))) continue;
      B.phase = team; upkeep(team);
      if (team <= 1) { warUpkeep(team); if (checkObjective()) break; for (const u of warAiDeploy(team)) { u.ai = 'war'; log.push('T' + B.turn + ' ' + team + ' deploys ' + u.name); } const power = aiPower(team); if (power) log.push('T' + B.turn + ' ' + team + ' uses ' + power[0].name); }
      if (team === 0 && B.turn > 1) { for (const u of safariFlee()) log.push('T' + B.turn + ' ' + u.name + ' fled'); for (const u of wildSpawn()) log.push('T' + B.turn + ' wild ' + u.name); }
      for (const u of alive(team).slice().sort((a, b) => b.level - a.level)) { if (u.acted || !canTakeAction(u)) continue; const d = aiDecide(u); if (d) aiAct(u, d, log); u.acted = true; if (checkObjective()) break; }
      if (B.result) break;
    }
  }
  return { result: B.result, turn: B.turn, reason: B.war.reason, funds: B.war.funds.slice(), captures: B.war.stats.captures.slice(), deployments: B.war.stats.deployments.slice(), alive: [alive(0).length, alive(1).length, alive(2).length], log };
}
