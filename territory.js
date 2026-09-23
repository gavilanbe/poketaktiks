// Territory: a finite team, contested centers, income and recoverable reserves.
// The same capture/deploy/upkeep functions drive the player, AI and simulations.
'use strict';
const TERRITORY = { level: 12, cap: 5, capture: 20, income: 2, recovery: 2, hold: 3, turns: 40, bank: 30 };
const TERRITORY_ROSTER = [[16, 3], [74, 3], [7, 3], [1, 3], [63, 4], [35, 4]];
const TERRITORY_MAP = {
  name: 'Three Bridges', seed: 73, music: 'player', objective: { type: 'territory' }, turnLimit: TERRITORY.turns,
  rows: ['TT....~~~....TT', 'T..T..~~~..T..T', '...T..=C=..T...', '......~~~......', '..T.M..~..M.T..', '.Q####=C=####Q.', '..T.M..~..M.T..', '......~~~......', '...T..=C=..T...', 'T..T..~~~..T..T', 'TT....~~~....TT'],
  deploy: [], units: [],
};
function territoryProperty(x, y) { return B && B.territory ? B.territory.properties.find(p => p.x === x && p.y === y) : null; }
function territoryCenters(team) { return B.territory.properties.filter(p => p.owner === team); }
function territoryControl(team) { return territoryCenters(team).filter(p => p.hq < 0).length; }
function territoryIncome(team) { return territoryCenters(team).length * TERRITORY.income; }
function territoryHeals(u) { if (!B.territory) { const p = campaignProperty(u.x, u.y); return !p || p.owner === u.team; } return !!territoryProperty(u.x, u.y) && territoryProperty(u.x, u.y).owner === u.team; }
function territoryRoster(root = 7) { return TERRITORY_ROSTER.map(([n, cost], i) => [i === 2 ? root : i === 3 && root === 1 ? 7 : n, cost]); }
function territoryInit(captains = [7, 7]) {
  const properties = [[1, 5, 'WEST HQ', 0], [13, 5, 'EAST HQ', 1], [7, 2, 'NORTH', -1], [7, 5, 'BRIDGE', -1], [7, 8, 'SOUTH', -1]].map(([x, y, name, hq]) => ({ x, y, name, hq, owner: hq, captor: null, progress: 0 }));
  B.territory = { version: 1, captains: captains.slice(), points: [4, 4], properties, hold: [0, 0], stamp: [-1, -1], reserves: [0, 1].map(team => territoryRoster(captains[team]).map(([num, cost]) => ({ num, cost, unitId: null, recovery: 0 }))), captures: [0, 0], deployments: [0, 0], reason: '' };
  for (const team of [0, 1]) for (let i = 0; i < 3; i++) {
    const u = makeUnit(B.territory.reserves[team][i].num, TERRITORY.level, team, { x: team ? 12 : 2, y: team ? 6 - i : 4 + i });
    u.reserveSlot = i; B.units.push(u); B.territory.reserves[team][i].unitId = u.id; requestBigSprite(u.num);
  }
}
// Record casualties once. Leaving a property or fainting interrupts that unit's capture.
// Called after committed actions, never during the reversible move/menu preview.
function territorySettle() {
  if (!B.territory) return; const S = B.territory;
  for (const team of [0, 1]) for (const r of S.reserves[team]) if (r.unitId != null) {
    const u = B.units.find(u => u.id === r.unitId);
    if (!u || u.hp <= 0) { r.unitId = null; r.recovery = TERRITORY.recovery; }
  }
  for (const p of S.properties) if (p.captor != null) {
    const u = B.units.find(u => u.id === p.captor && u.hp > 0);
    if (!u || u.x !== p.x || u.y !== p.y || u.team === p.owner) { p.captor = null; p.progress = 0; }
  }
  for (const t of [0, 1]) if (territoryControl(t) < 2) S.hold[t] = 0;
}
function territoryCaptureBlock(u, p = u && territoryProperty(u.x, u.y), from = u) {
  if (!B.territory || !u || u.hp <= 0 || u.team > 1) return 'unavailable';
  if (u.acted || u.status === 'frz' || u.recharge) return 'unit not ready';
  if (!p || !B.territory.properties.includes(p) || p.owner === u.team || from.x !== p.x || from.y !== p.y) return 'stand on another center';
  return null;
}
function territoryCaptureGain(u) { return Math.max(1, Math.ceil(10 * u.hp / u.maxHp)); }
function territoryCapture(u) {
  const p = territoryProperty(u.x, u.y); if (territoryCaptureBlock(u, p)) return null;
  territorySettle();
  if (p.captor !== u.id) { p.captor = u.id; p.progress = 0; }
  p.progress = Math.min(TERRITORY.capture, p.progress + territoryCaptureGain(u));
  const done = p.progress >= TERRITORY.capture;
  if (done) { p.owner = u.team; p.captor = null; p.progress = 0; B.territory.captures[u.team]++; powerCharge(u.team, 20); }
  u.acted = u.moved = true; territorySettle();
  return { type: 'property', unit: u, property: p, done, progress: p.progress };
}
function territoryDeployBlock(team, slot, p) {
  if (!B.territory || B.result || team !== B.phase || team < 0 || team > 1) return 'not your phase';
  const r = B.territory.reserves[team][slot]; if (!r) return 'no reserve';
  if (r.unitId != null) return 'already on map'; if (r.recovery) return 'recovering ' + r.recovery;
  if (!p || !B.territory.properties.includes(p) || p.owner !== team) return 'need an owned center';
  if (unitAt(p.x, p.y)) return 'center occupied';
  if (alive(team).length >= TERRITORY.cap) return 'five on map';
  if (B.territory.points[team] < r.cost) return 'need ' + r.cost + ' CP';
  return null;
}
function territoryDeploy(team, slot, p) {
  if (territoryDeployBlock(team, slot, p)) return null;
  const r = B.territory.reserves[team][slot], u = makeUnit(r.num, TERRITORY.level, team, { x: p.x, y: p.y });
  u.reserveSlot = slot; if (slot === 2 && powerState(team)) { powerState(team).captainId = u.id; u.leader = true; } u.acted = u.moved = true; r.unitId = u.id; B.territory.points[team] -= r.cost;
  B.territory.deployments[team]++; B.units.push(u); requestBigSprite(u.num); return u;
}
// Deduplicated by round and side. beginPhase increments the round BEFORE this for territory battles.
function territoryUpkeep(team) {
  if (!B.territory || team > 1) return; const S = B.territory;
  if (S.stamp[team] === B.turn) return; territorySettle(); S.stamp[team] = B.turn;
  for (const r of S.reserves[team]) if (r.unitId == null && r.recovery > 0) r.recovery--;
  S.points[team] = Math.min(TERRITORY.bank, S.points[team] + territoryIncome(team));
  S.hold[team] = territoryControl(team) >= 2 ? S.hold[team] + 1 : 0;
}
function territoryObjective() {
  if (B.result) return B.result; territorySettle(); const S = B.territory;
  const finish = (winner, reason) => { S.reason = reason; return B.result = winner < 0 ? 'draw' : winner === 0 ? 'win' : 'lose'; };
  for (const p of S.properties) if (p.hq >= 0 && p.owner !== p.hq) return finish(p.owner, p.name + ' captured');
  for (const team of [0, 1]) {
    if (S.hold[team] >= TERRITORY.hold) return finish(team, (team === 0 ? 'You' : 'Enemy') + ' held two centers for three turns');
    if (!alive(team).length && !territoryCenters(team).length) return finish(1 - team, 'No units or deployment centers');
  }
  if (B.turn > TERRITORY.turns) { const a = territoryControl(0), b = territoryControl(1); return finish(a === b ? -1 : a > b ? 0 : 1, 'Turn limit: contested centers ' + a + '-' + b); }
  return null;
}
function territoryAiDeploy(team) {
  const out = []; if (!B.territory || team !== B.phase) return out;
  const foes = aiTargetsOf({ team });
  const sites = territoryCenters(team).slice().sort((a, b) => Math.min(...foes.map(u => dist(u, a)), 99) - Math.min(...foes.map(u => dist(u, b)), 99));
  for (const p of sites) {
    const options = B.territory.reserves[team].map((r, i) => ({ r, i })).filter(o => !territoryDeployBlock(team, o.i, p));
    options.sort((a, b) => {
      const score = r => { const d = DEX[r.num]; const matches = foes.length ? Math.max(...d.types.map(t => foes.reduce((s, u) => s + effRaw(t, u.types), 0) / foes.length)) : 1; return matches * 3 + (roleFor(d) === 'support' && alive(team).some(u => u.hp < u.maxHp / 2) ? 3 : 0) - r.cost * .3; };
      return score(b.r) - score(a.r) || a.i - b.i;
    });
    if (options.length) { const u = territoryDeploy(team, options[0].i, p); if (u) out.push(u); }
  }
  return out;
}
// Objectives compete with attacks and skills. Distance fields respect the unit's terrain access;
// low-HP units value a friendly center, and exposed capture tiles carry an incoming-damage penalty.
function territoryDecide(u) {
  if (u.hp <= 0 || u.acted || u.status === 'frz' || u.recharge) return null;
  const foes = aiTargetsOf(u), reach = reachable(u), threat = dangerZone(u.team);
  const goals = B.territory.properties.filter(p => p.owner !== u.team || u.hp < u.maxHp * .7);
  const fields = goals.map(p => ({ p, field: distField(u, [p]) }));
  let best = null, score = -Infinity;
  for (const n of reach.values()) {
    if (!canStand(u, n.x, n.y)) continue; const tile = terrAt(n.x, n.y), danger = threat.has(key(n.x, n.y));
    const incoming = danger ? foes.reduce((s, e) => {
      if (dist(e, n) > effMov(e) + e.rngMax) return s;
      return s + Math.max(0, ...e.moves.map(m => calcDmg(e, u, m, tile)));
    }, 0) : 0;
    const risk = Math.min(60, incoming * (u.hp < u.maxHp / 2 ? .65 : .25));
    let route = -5;
    for (const { p, field } of fields) {
      const d = field.get(key(n.x, n.y)), before = field.get(key(u.x, u.y)); if (d == null || before == null) continue;
      const friendly = p.owner === u.team, importance = friendly ? (1 - u.hp / u.maxHp) * 2 : p.hq >= 0 ? .8 : 1.2;
      const crowded = alive(u.team).filter(a => a !== u && dist(a, p) < dist(u, p)).length;
      route = Math.max(route, ((before - d) * 3 + 20 / (d + 1)) * importance - crowded * 2);
    }
    const cover = terrainDef(tile, u) * .12;
    const offer = (s, d) => { if (s > score) { score = s; best = d; } };
    offer(route + cover - risk, { x: n.x, y: n.y });
    const p = territoryProperty(n.x, n.y);
    if (p && !territoryCaptureBlock(u, p, n)) offer(48 + (p.hq >= 0 ? 30 : 0) + (p.captor === u.id ? p.progress : 0) - risk, { x: n.x, y: n.y, capture: true });
    if (p && p.owner === u.team && u.hp < u.maxHp) offer((u.maxHp - u.hp) * .7 + 15 - risk, { x: n.x, y: n.y });
    if (u.skill && !u.skill.passive) for (const t of skillTargetsAt(u, u.skill, n)) if (!skillCheck(u, u.skill, t, n)) {
      const s = aiSkillScore(u, u.skill, n, t, threat, tile); if (s != null) offer(s + Math.max(0, route) * .4 - risk * .5, { x: n.x, y: n.y, skill: u.skill, target: t });
    }
    for (const t of foes) for (const m of usableMoves(u, dist(n, t))) {
      const fc = forecast(u, t, m, n); let dealt = 0, taken = 0;
      for (const s of fc.strikes) if (s.nominal) { if (s.side === 'a') dealt += s.dmg * s.hit / 100; else taken += s.dmg * s.hit / 100; }
      const defending = territoryCenters(u.team).some(p => dist(t, p) <= 1);
      offer(dealt - taken * .8 + (fc.koD ? 35 : 0) - (fc.koA ? 80 : 0) + (defending ? 15 : 0) + Math.max(0, route) * .4 - risk * .3, { x: n.x, y: n.y, target: t, move: m });
    }
  }
  return best;
}
function launchTerritory(seed = 7, defer = false, captains = [7, 7]) {
  BACKDROP = makeBackdrop(TERRITORY_MAP); startBattle(TERRITORY_MAP, [], {}, { territory: true, captains, seed, defer: true }); B.map.ownerAt = territoryOwnerAt;
  BT.territoryGuide = !defer && PREF.territoryGuide === 'show' && !PARAMS.has('noguide');
  goScene('battle'); if (!defer) beginPhase(0, true);
}
function startTerritorySetup(seed = 7) { goScene('territory', { seed, captain: 7, bd: makeBackdrop(TERRITORY_MAP) }); SC.i = 2; }
function territorySceneInput(ev) {
  if (ev.type === 'key') {
    if (['left', 'up', 'right', 'down'].includes(ev.key)) { const count = Math.max(1, SC.hits.length); SC.i = (SC.i + (ev.key === 'left' || ev.key === 'up' ? count - 1 : 1)) % count; if (SC.name === 'territory' && SC.i < 3) SC.data.captain = STARTERS[SC.i]; Audio.sfx('cursor'); }
    else if (ev.key === 'ok' && SC.hits[SC.i]) SC.hits[SC.i].run();
    else if (ev.key === 'back') goScene(SC.name === 'territory' ? 'quick' : 'title');
  } else if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}
function closeTerritoryGuide() { BT.territoryGuide = false; setPref('territoryGuide', 'hide'); BT.mode = 'idle'; }
function territoryGuideRect() {
  const w = Math.min(VIEW.w - 16, 280), lines = [];
  ['1. Move onto a grey-roofed center. Choose Capture twice at full HP.', '2. Use RESERVE at an empty center with your blue roof. Arrivals act next turn.', '3. Take the red-roofed enemy HQ, or hold two centers for three of your turn starts.'].forEach((s, i) => { if (i) lines.push(''); lines.push(...wrap(s, w - 16)); });
  const h = 60 + lines.length * 10; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w, h, lines };
}
function drawTerritoryGuide() {
  const r = territoryGuideRect(); ctx.globalAlpha = .65; rect(0, 0, VIEW.w, VIEW.h, '#050915'); ctx.globalAlpha = 1;
  const p = hudPanel(r.x, r.y, r.w, r.h, { header: 'WIN WITH YOUR TEAM' });
  r.lines.forEach((s, i) => text(s, r.x + 8, p.cy + i * 10, UI.ink));
  button(r.x + 8, r.y + r.h - 28, r.w - 16, 20, 'GOT IT · H FOR RULES', closeTerritoryGuide, { variant: 'primary' });
}
// Buildings show their owner on the roof (the tile itself, see ROOFS); the overlay only adds a capture-progress bar
// and a soft pulse on the tile under the cursor.
function drawTerritoryProperties() {
  for (const p of B.territory.properties) {
    const x = tileX(p.x), y = tileY(p.y);
    if (p.progress) { const w = TILE - 8; rect(x + 3, y + TILE - 6, w + 2, 5, UI.inset); rect(x + 4, y + TILE - 5, w, 3, '#2a2f44'); rect(x + 4, y + TILE - 5, Math.floor(w * p.progress / TERRITORY.capture), 3, UI.gold); hline(x + 4, y + TILE - 5, Math.floor(w * p.progress / TERRITORY.capture), '#fff0a0'); }
  }
}
function territoryOwnerAt(x, y) { const p = territoryProperty(x, y); return p ? p.owner : null; }
// Conquest's objective card: TURN and a pip per Pokémon that can still act; command points with their income, the three
// middle centers as tiny buildings in their owner's colour; the hold race as pips (yours against the foe's); then the
// center under the cursor, or the goal.
function miniCenter(x, y, owner) { const roof = owner === 0 ? '#3f6fd6' : owner === 1 ? '#e04848' : '#a8a8b4'; rect(x, y + 3, 7, 4, '#f2eee6'); outline(x, y + 3, 7, 4, UI.inset); rect(x - 1, y + 1, 9, 3, UI.inset); rect(x, y + 1, 7, 2, roof); px(x + 3, y, UI.inset); px(x + 3, y + 5, '#6a7aa8'); }
function drawTerritoryTurn(r) {
  const t = HT(), S = B.territory, mine = alive(t), ready = mine.filter(u => !u.acted).length, pips = mine.length <= 6;
  hudPanel(r.x, r.y, r.w, r.h, { header: 'TURN ' + B.turn + '/' + TERRITORY.turns, headerRight: pips ? null : 'READY ' + ready + '/' + mine.length, headerRightCol: UI.green, headerFill: teamColorD(t) });
  if (pips) mine.forEach((u, i) => { const px0 = r.x + r.w - 7 - (mine.length - 1 - i) * 6, py0 = r.y + 8; circle(px0, py0, 2, UI.inset); if (!u.acted) { circle(px0, py0, 2, UI.green); px(px0 - 1, py0 - 1, '#d8ffe0'); } else circle(px0, py0, 1, shade(teamColorD(t), -.3)); });
  const y1 = r.y + 16; drawBall(r.x + 9, y1 + 3, UI.gold, 3); const cp = 'CP ' + S.points[t]; text(cp, r.x + 15, y1, UI.gold); text('+' + territoryIncome(t), r.x + 18 + textWidth(cp), y1, UI.muted);
  const mids = S.properties.filter(p => p.hq < 0); mids.forEach((p, i) => miniCenter(r.x + r.w - 12 - (mids.length - 1 - i) * 10, y1, p.owner));
  if (r.h >= 32) { const y2 = r.y + 26; text('HOLD', r.x + 6, y2, UI.muted); const hx = r.x + 10 + textWidth('HOLD'); for (let k = 0; k < TERRITORY.hold; k++) { const on = S.hold[t] > k; rect(hx + k * 7, y2 + 1, 5, 5, UI.inset); if (on) rect(hx + 1 + k * 7, y2 + 2, 3, 3, UI.green); }
    const fx0 = r.x + r.w - 6 - TERRITORY.hold * 7; text(B.versus ? 'P' + (2 - t) : 'FOE', fx0 - textWidth('FOE') - 4, y2, UI.muted); for (let k = 0; k < TERRITORY.hold; k++) { const on = S.hold[1 - t] > k; rect(fx0 + k * 7, y2 + 1, 5, 5, UI.inset); if (on) rect(fx0 + 1 + k * 7, y2 + 2, 3, 3, UI.red); } }
  if (r.h >= 44) { const p = territoryProperty(BT.cx, BT.cy); let s2 = p ? p.name + ' · ' + (p.owner < 0 ? 'neutral' : p.owner === t ? 'yours' : 'enemy') + (p.progress ? ' · ' + p.progress + '/20' : '') : 'Take the HQ or hold 2 of 3'; text(fitLabel(s2, r.w - 12), r.x + 6, r.y + 34, p ? UI.gold : UI.muted); }
}
function openTerritoryReserves(p) {
  BT.sel = null; BT.autoEnd = 0; BT.mode = 'endmenu';
  if (!p) {
    BT.menu = { title: 'DEPLOY WHERE?', i: 0, items: territoryCenters(HT()).map((p, i) => ({ id: 'site:' + B.territory.properties.indexOf(p), label: p.name, icon: 'flag', off: !!unitAt(p.x, p.y), sub: unitAt(p.x, p.y) ? 'Center occupied: move that unit first' : 'Deploy a reserve here · arrivals act next turn' })).concat([{ id: 'close', label: 'Close', icon: 'x' }]) }; return;
  }
  BT.deploySite = p; BT.cx = p.x; BT.cy = p.y; keepCursorVisible();
  BT.menu = { title: 'RESERVES · ' + B.territory.points[HT()] + ' CP', i: 0, items: B.territory.reserves[HT()].map((r, i) => { const why = territoryDeployBlock(HT(), i, p); return { id: 'deploy:' + i, label: DEX[r.num].name + ' ' + r.cost + 'CP', off: !!why, sub: (why || p.name + ' · acts next turn') + ' · ' + ROLES[roleFor(DEX[r.num])].name }; }).concat([{ id: 'close', label: 'Close' }]) };
}
function territoryMenuAction(it) {
  if (!B.territory || !(it.id === 'reserves' || it.id.startsWith('site:') || it.id.startsWith('deploy:'))) return false;
  if (it.off) { Audio.sfx('error'); return true; }
  if (it.id === 'reserves') openTerritoryReserves();
  else if (it.id.startsWith('site:')) openTerritoryReserves(B.territory.properties[+it.id.slice(5)]);
  else { const u = territoryDeploy(HT(), +it.id.slice(7), BT.deploySite); if (!u) { Audio.sfx('error'); return true; } BT.queue = [{ kind: 'event', ev: { type: 'spawn', unit: u } }]; playQueue(() => { BT.mode = 'idle'; }); }
  return true;
}
function territoryResultsDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data; rect(0, 0, W, H, '#101829'); SC.hits = [];
  const w = Math.min(W - 16, 270), x = (W - w) / 2, y = Math.max(12, (H - 160) / 2);
  panel(x, y, w, 126, { title: 'THREE BRIDGES' });
  bigC(S.result === 'win' ? 'VICTORY!' : S.result === 'draw' ? 'DRAW' : 'DEFEAT', W / 2, y + 12, S.result === 'win' ? UI.gold : UI.ink);
  wrap(S.reason || 'Battle ended', w - 16).forEach((l, i) => textC(l, W / 2, y + 34 + i * 10, UI.ink));
  textC('Turn ' + S.turn + ' · Centers ' + S.centers.join('-'), W / 2, y + 64, UI.muted);
  textC('Deployed ' + S.deployments.join(' / '), W / 2, y + 78, UI.muted);
  textC('Fixed level · campaign kept separate', W / 2, y + 100, UI.muted);
  bigButton(W / 2 - 82, y + 136, 108, 22, 'REMATCH', () => launchTerritory(S.seed + 1, false, S.captains || [7, 7]), { hot: SC.i === 0, variant: 'danger' });
  bigButton(W / 2 + 32, y + 136, 50, 22, 'TITLE', () => goScene('title'), { hot: SC.i === 1, variant: 'ghost' });
}
// Deterministic model smoke. Real beginPhase/nextPhase is separately exercised by the UI-flow tests.
function simTerritory(seed = 7, maxTurns = TERRITORY.turns + 1, captains = [7, 7]) {
  launchTerritory(seed, true, captains); const actions = [];
  for (B.turn = 1; B.turn <= maxTurns && !B.result; B.turn++) {
    for (const team of [0, 1]) {
      B.phase = team; upkeep(team); territoryUpkeep(team); if (checkObjective()) break;
      territoryAiDeploy(team);
      const power = aiPower(team); if (power) actions.push({ turn: B.turn, team, kind: 'power', name: power[0].name });
      for (const u of alive(team).slice().sort((a, b) => b.level - a.level)) {
        if (u.acted || u.status === 'frz') continue;
        const d = territoryDecide(u);
        if (d) {
          const r = reachable(u); if (!r.has(key(d.x, d.y)) || !canStand(u, d.x, d.y)) throw new Error('Illegal territory AI move');
          if (d.capture && territoryCaptureBlock(u, territoryProperty(d.x, d.y), d)) throw new Error('Illegal AI capture');
          if (d.skill && skillCheck(u, d.skill, d.target, d)) throw new Error('Illegal AI skill');
          if (d.move && !usableMoves(u, dist(d, d.target)).includes(d.move)) throw new Error('Illegal AI attack');
          actions.push({ turn: B.turn, team, kind: d.capture ? 'capture' : d.skill ? d.skill.id : d.move ? 'attack' : 'move' });
          aiAct(u, d);
        }
        u.acted = true; if (checkObjective()) break;
      }
      if (B.result) break;
    }
    if (B.result) break;
  }
  return { seed, result: B.result, turn: B.turn, reason: B.territory.reason, captures: B.territory.captures.slice(), deployments: B.territory.deployments.slice(), actions };
}
