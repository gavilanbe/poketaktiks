// Territory (Conquest): Three Bridges, the same captain on both sides, six teammates each (three start on the map,
// three wait in the Box), income from the HQ and the three middle centers, the enemy HQ to take or two middle centers
// to hold for three turn starts. Built on the shared war rules (war.js); this file keeps the map, the setup screen,
// the guide, the objective card and the results.
'use strict';
const TERRITORY = { level: 12, cap: 5, hold: 3, turns: 40, funds: 2000 };
const TERRITORY_ROSTER = [16, 74, 7, 1, 63, 35];
const TERRITORY_MAP = {
  name: 'Three Bridges', seed: 73, music: 'player', objective: { type: 'territory' }, turnLimit: TERRITORY.turns,
  rows: ['TT....~~~....TT', 'T..T..~~~..T..T', '...T..=C=..T...', '......~~~......', '..T.M..~..M.T..', '.Q####=C=####Q.', '..T.M..~..M.T..', '......~~~......', '...T..=C=..T...', 'T..T..~~~..T..T', 'TT....~~~....TT'],
  deploy: [], units: [],
};
// The six teammates of a side: the captain in the third slot (Charmander, Squirtle or Bulbasaur), Squirtle instead of
// Bulbasaur in the fourth when Bulbasaur leads.
function territoryRoster(root = 7) { return TERRITORY_ROSTER.map((n, i) => i === 2 ? root : i === 3 && root === 1 ? 7 : n); }
function territoryInit(captains = [7, 7]) {
  const names = { '1,5': 'WEST HQ', '13,5': 'EAST HQ', '7,2': 'NORTH', '7,5': 'BRIDGE', '7,8': 'SOUTH' }, owners = { '1,5': 0, '13,5': 1, '7,2': -1, '7,5': -1, '7,8': -1 };
  warInit(TERRITORY_MAP, { war: { funds: [TERRITORY.funds, TERRITORY.funds], owners, names, centers: -1, boxes: [0, 1].map(t => territoryRoster(captains[t]).map(num => ({ num, level: TERRITORY.level }))), hold: { need: 2, turns: TERRITORY.hold }, turns: TERRITORY.turns, cap: TERRITORY.cap } });
  B.territory = { captains: captains.slice() };
  for (const team of [0, 1]) for (let i = 0; i < 3; i++) {
    const e = B.war.box[team][i], u = makeUnit(e.num, e.level, team, { x: team ? 12 : 2, y: team ? 6 - i : 4 + i });
    u.reserveSlot = i; u.ai = 'war'; B.units.push(u); e.unitId = u.id; e.state = 'field'; requestBigSprite(u.num);
  }
}
function launchTerritory(seed = 7, defer = false, captains = [7, 7]) {
  BACKDROP = makeBackdrop(TERRITORY_MAP); startBattle(TERRITORY_MAP, [], {}, { territory: true, captains, seed, defer: true });
  BT.territoryGuide = !defer && PREF.territoryGuide === 'show' && !PARAMS.has('noguide');
  goScene('battle'); if (!defer) beginPhase(0, true);
}
function startTerritorySetup(seed = 7) { goScene('territory', { seed, captain: 7, bd: makeBackdrop(TERRITORY_MAP) }); SC.i = 2; }
function territorySceneInput(ev) {
  if (SC.name === 'territory' && ev.type === 'key') { const S = SC.data; // the setup: arrows choose the Ace, Z starts, X goes back to the modes
    if (['left', 'up', 'right', 'down'].includes(ev.key)) { const i = (STARTERS.indexOf(S.captain) + (ev.key === 'left' || ev.key === 'up' ? 2 : 1)) % 3; S.captain = STARTERS[i]; SC.i = i; Audio.sfx('catch'); }
    else if (ev.key === 'ok' || ev.key === 'next') launchTerritory(S.seed, false, [S.captain, S.captain]); else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('quick', { i: 1 }); } return; }
  if (ev.type === 'key') {
    if (['left', 'up', 'right', 'down'].includes(ev.key)) { const count = Math.max(1, SC.hits.length); SC.i = (SC.i + (ev.key === 'left' || ev.key === 'up' ? count - 1 : 1)) % count; if (SC.name === 'territory' && SC.i < 3) SC.data.captain = STARTERS[SC.i]; Audio.sfx('cursor'); }
    else if (ev.key === 'ok' && SC.hits[SC.i]) SC.hits[SC.i].run();
    else if (ev.key === 'back') goScene(SC.name === 'territory' ? 'quick' : 'title');
  } else if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}
function closeTerritoryGuide() { BT.territoryGuide = false; setPref('territoryGuide', 'hide'); BT.mode = 'idle'; }
function territoryGuideRect() {
  const w = Math.min(VIEW.w - 16, 280), lines = [];
  ['1. Move onto a grey-roofed center. Choose Capture twice at full HP.', '2. Pick an empty center with your blue roof to deploy from your PC Box. Arrivals act next turn.', '3. Take the red-roofed enemy HQ, or hold two centers for three of your turn starts.'].forEach((s, i) => { if (i) lines.push(''); lines.push(...wrap(s, w - 16)); });
  const h = 60 + lines.length * 10; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w, h, lines };
}
function drawTerritoryGuide() {
  const r = territoryGuideRect(); ctx.globalAlpha = .65; rect(0, 0, VIEW.w, VIEW.h, '#050915'); ctx.globalAlpha = 1;
  const p = hudPanel(r.x, r.y, r.w, r.h, { header: 'WIN WITH YOUR TEAM' });
  r.lines.forEach((s, i) => text(s, r.x + 8, p.cy + i * 10, UI.ink));
  button(r.x + 8, r.y + r.h - 28, r.w - 16, 20, VIEW.touch ? 'GOT IT' : 'GOT IT · H FOR RULES', closeTerritoryGuide, { variant: 'primary' });
}
// Conquest's objective card: TURN and a pip per Pokémon that can still act; command points with their income, the three
// middle centers as tiny buildings in their owner's colour; the hold race as pips (yours against the foe's); then the
// center under the cursor, or the goal.
function miniCenter(x, y, owner) { const roof = owner === 0 ? '#3f6fd6' : owner === 1 ? '#e04848' : '#a8a8b4'; rect(x, y + 3, 7, 4, '#f2eee6'); outline(x, y + 3, 7, 4, UI.inset); rect(x - 1, y + 1, 9, 3, UI.inset); rect(x, y + 1, 7, 2, roof); px(x + 3, y, UI.inset); px(x + 3, y + 5, '#6a7aa8'); }
function drawTerritoryTurn(r) {
  const t = HT(), W = B.war, mine = alive(t), ready = mine.filter(u => !u.acted).length, pips = mine.length <= 6;
  hudPanel(r.x, r.y, r.w, r.h, { header: 'TURN ' + B.turn + '/' + TERRITORY.turns, headerRight: pips ? null : 'READY ' + ready + '/' + mine.length, headerRightCol: UI.green, headerFill: teamColorD(t) });
  if (pips) mine.forEach((u, i) => { const px0 = r.x + r.w - 7 - (mine.length - 1 - i) * 6, py0 = r.y + 8; circle(px0, py0, 2, UI.inset); if (!u.acted) { circle(px0, py0, 2, UI.green); px(px0 - 1, py0 - 1, '#d8ffe0'); } else circle(px0, py0, 1, shade(teamColorD(t), -.3)); });
  const y1 = r.y + 16, cash = money(W.funds[t]); drawBall(r.x + 9, y1 + 3, UI.gold, 3); text(cash, r.x + 15, y1, UI.gold); text('+' + warIncome(t), r.x + 18 + textWidth(cash), y1, UI.muted);
  const mids = W.props.filter(p => p.kind !== 'hq'); mids.forEach((p, i) => miniCenter(r.x + r.w - 12 - (mids.length - 1 - i) * 10, y1, p.owner));
  if (r.h >= 32) { const y2 = r.y + 26, H = W.hold; text('HOLD', r.x + 6, y2, UI.muted); const hx = r.x + 10 + textWidth('HOLD'); for (let k = 0; k < H.turns; k++) { const on = H.count[t] > k; rect(hx + k * 7, y2 + 1, 5, 5, UI.inset); if (on) rect(hx + 1 + k * 7, y2 + 2, 3, 3, UI.green); }
    const fx0 = r.x + r.w - 6 - H.turns * 7; text(B.versus ? 'P' + (2 - t) : 'FOE', fx0 - textWidth('FOE') - 4, y2, UI.muted); for (let k = 0; k < H.turns; k++) { const on = H.count[1 - t] > k; rect(fx0 + k * 7, y2 + 1, 5, 5, UI.inset); if (on) rect(fx0 + 1 + k * 7, y2 + 2, 3, 3, UI.red); } }
  if (r.h >= 44) { const p = warProperty(BT.cx, BT.cy); let s2 = p ? p.name + ' · ' + (p.owner < 0 ? 'neutral' : p.owner === t ? 'yours' : 'enemy') + (p.progress ? ' · ' + p.progress + '/20' : '') : 'Take the HQ or hold 2 of 3'; text(fitLabel(s2, r.w - 12), r.x + 6, r.y + 34, p ? UI.gold : UI.muted); }
}
// Conquest results: the outcome stamped letter by letter, why it ended, three stat plates (turn, middle centers, deployments)
// and both captains; REMATCH keeps the captain, TITLE leaves.
function territoryResultsDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, t = CLOCK.frame ? SC.t : 99, win = S.result === 'win', draw = S.result === 'draw'; SC.hits = [];
  rect(0, 0, W, H, win ? '#101a38' : draw ? '#161a2a' : '#1e0f1a'); if (win && !REDUCED) { const r = Math.round(Math.min(W, H) * .42); ctx.globalAlpha = .06; ctx.drawImage(sunburst(r, 12, Math.floor(SC.t * 6) % 4, '#ffffff'), Math.round(W / 2 - r), Math.round(H * .34 - r)); ctx.globalAlpha = 1; }
  const w = Math.min(W - 16, 280), x = Math.round((W - w) / 2), bh = 20, h = 118, y = Math.max(8, Math.round((H - h - bh - 12) / 2));
  const p = panel(x, y, w, h, { title: 'CONQUEST · THREE BRIDGES', fill: win ? '#1f2a5e' : UI.panel });
  const word = win ? 'VICTORY!' : draw ? 'DRAW' : 'DEFEAT', sc = w >= textWidth(word, BIG) * 2 + 20 ? 2 : 1;
  drawStampWord(word, W / 2, y + 10, t, win ? UI.gold : draw ? UI.ink : '#ff8080', win ? UI.goldDark : '#2a0a14', sc);
  wrap(S.reason || 'Battle ended', w - 16).slice(0, 2).forEach((l, i) => textC(l, W / 2, y + 16 + 9 * sc + i * 10, UI.ink));
  const plates = [['TURN', String(S.turn)], ['CENTERS', S.centers.join('-')], ['DEPLOYED', S.deployments.join('/')]], pw = Math.floor((w - 16 - 8) / 3);
  plates.forEach(([lb, v], i) => { const px0 = x + 8 + i * (pw + 4), py0 = y + h - 40; rrect(px0, py0, pw, 30, UI.inset, 1); rrect(px0 + 1, py0 + 1, pw - 2, 28, UI.panelDark, 1); textC(lb, px0 + pw / 2, py0 + 4, UI.muted); bigC(v, px0 + pw / 2, py0 + 15, UI.gold, { shadow: UI.goldDark }); });
  const caps = S.captains || [7, 7]; if (W >= 300) { drawMon(caps[0], x - 4, y + h - 2, { outline: teamColor(0) }); drawMon(caps[1], x + w + 4, y + h - 2, { flip: true, outline: teamColor(1) }); }
  const by = y + h + 10, rw = Math.min(140, Math.floor((w - 8) * .6));
  bigButton(Math.round(W / 2 - (rw + 4 + (w - 8 - rw) * .6) / 2), by, rw, bh, 'REMATCH', () => launchTerritory(S.seed + 1, false, S.captains || [7, 7]), { hot: SC.i === 0, variant: 'primary' });
  bigButton(Math.round(W / 2 - (rw + 4 + (w - 8 - rw) * .6) / 2) + rw + 4, by, Math.round((w - 8 - rw) * .6), bh, 'TITLE', () => goScene('title'), { hot: SC.i === 1, variant: 'ghost' });
}
// Deterministic model smoke. Real beginPhase/nextPhase is separately exercised by the UI-flow tests.
function simTerritory(seed = 7, maxTurns = TERRITORY.turns + 1, captains = [7, 7]) {
  launchTerritory(seed, true, captains); const actions = [];
  for (B.turn = 1; B.turn <= maxTurns && !B.result; B.turn++) {
    for (const team of [0, 1]) {
      B.phase = team; upkeep(team); warUpkeep(team); if (checkObjective()) break;
      warAiDeploy(team);
      const power = aiPower(team); if (power) actions.push({ turn: B.turn, team, kind: 'power', name: power[0].name });
      for (const u of alive(team).slice().sort((a, b) => b.level - a.level)) {
        if (u.acted || u.status === 'frz') continue;
        const d = warDecide(u);
        if (d) {
          const r = reachable(u); if (!r.has(key(d.x, d.y)) || !canStand(u, d.x, d.y)) throw new Error('Illegal territory AI move');
          if (d.capture && warCaptureBlock(u, warProperty(d.x, d.y), d)) throw new Error('Illegal AI capture');
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
  return { seed, result: B.result, turn: B.turn, reason: B.war.reason, captures: B.war.stats.captures.slice(), deployments: B.war.stats.deployments.slice(), actions };
}
